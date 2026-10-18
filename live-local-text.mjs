import { LANGUAGES, MODEL_CACHE } from './live-local-config.mjs';
import { failure } from './live-local-core.mjs';

// Firefox's CPU-optimised translation models in a bundled Bergamot worker.
// Model downloads contain no speech/text. Only two NMT models stay loaded.
export class LocalTextTranslator {
  constructor({ onProgress = () => {} } = {}) {
    this.onProgress = onProgress; this.pending = new Map(); this.nextId = 1;
    this.loaded = new Set(); this.memoryCache = new Map(); this.closed = false;
    this.abort = new AbortController();
  }
  async prepare(target) {
    this.target = target;
    const response = await fetch(new URL('./live-local-models.json', import.meta.url));
    if (!response.ok) throw failure('local_download_error');
    this.models = (await response.json()).models;
    try { this.cache = await caches.open(MODEL_CACHE); } catch { this.cache = null; }
    this.worker = new Worker(new URL('./vendor/bergamot-0.4.9/translator-worker.js', import.meta.url));
    this.worker.onmessage = ({ data }) => {
      const item = this.pending.get(data.id);
      if (!item) return;
      this.pending.delete(data.id); clearTimeout(item.timer);
      data.error ? item.reject(failure('local_model_error')) : item.resolve(data.result);
    };
    this.worker.onerror = () => {
      for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(failure('local_model_error')); }
      this.pending.clear();
    };
    await this.rpc('initialize', [{ cacheSize: 0, useNativeIntGemm: false }]);
    const pairs = LANGUAGES.filter(lang => lang !== 'en' && lang !== target).map(lang => `${lang}-en`);
    if (target !== 'en') pairs.push(`en-${target}`);
    const files = pairs.flatMap(pair => Object.values(this.models[pair]));
    // Limit concurrent downloads and peak RAM. Prewarm every source language
    // so changing speakers does not depend on the Azure service.
    for (let index = 0; index < files.length; index += 2) {
      await Promise.all(files.slice(index, index + 2).map(file => this.compressed(file)));
      if (this.closed) throw failure('local_cancelled');
    }
    if (target !== 'en') await this.load(`en-${target}`);
  }
  rpc(name, args, transfer = []) {
    if (this.closed) return Promise.reject(failure('local_cancelled'));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(failure('local_too_slow')); }, 90000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, name, args }, transfer);
    });
  }
  async hash(bytes) {
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  progress(file, loaded) {
    this.onProgress({ status: 'progress', name: 'Firefox Translations', file: file.url, loaded, total: file.bytes });
  }
  async compressed(file) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await this.readCompressed(file); }
      catch (error) {
        if (this.closed || error.featureCode === 'local_cancelled') throw error;
        if (attempt === 2) throw failure('local_download_error');
        await new Promise(resolve => setTimeout(resolve, 400 * 2 ** attempt));
      }
    }
  }
  async readCompressed(file) {
    if (this.closed) throw failure('local_cancelled');
    const memory = this.memoryCache.get(file.url);
    if (memory) { this.progress(file, file.bytes); return memory; }
    let cached;
    try { cached = await this.cache?.match(file.url); } catch {}
    if (cached) {
      const bytes = await cached.arrayBuffer();
      if (await this.hash(bytes) === file.sha256) { this.progress(file, file.bytes); return bytes; }
      try { await this.cache.delete(file.url); } catch {}
    }
    const response = await fetch(file.url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: this.abort.signal });
    if (!response.ok) throw failure('local_download_error');
    const reader = response.body?.getReader();
    let bytes;
    if (reader) {
      const chunks = []; let loaded = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (this.closed) { await reader.cancel(); throw failure('local_cancelled'); }
        chunks.push(value); loaded += value.byteLength; this.progress(file, loaded);
      }
      const joined = new Uint8Array(loaded); let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
      bytes = joined.buffer;
    } else bytes = await response.arrayBuffer();
    if (await this.hash(bytes) !== file.sha256) throw failure('local_download_error');
    try {
      if (!this.cache) throw new Error('no cache');
      await this.cache.put(file.url, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));
    } catch { this.memoryCache.set(file.url, bytes); }
    this.progress(file, file.bytes); return bytes;
  }
  async uncompressed(file) {
    const bytes = await this.compressed(file);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const output = await new Response(stream).arrayBuffer();
    if (await this.hash(output) !== file.uncompressedSha256) throw failure('local_download_error');
    return output;
  }
  async load(pair) {
    if (this.loaded.has(pair)) return;
    const files = this.models[pair];
    const [model, shortlist, vocab] = await Promise.all([
      this.uncompressed(files.model), this.uncompressed(files.lexicalShortlist), this.uncompressed(files.vocab),
    ]);
    const [from, to] = pair.split('-');
    await this.rpc('loadTranslationModel', [{ from, to }, { model, shortlist, vocabs: [vocab] }], [model, shortlist, vocab]);
    this.loaded.add(pair);
  }
  async translate(text, from, to = this.target) {
    if (from === to) return text;
    const pairs = from === 'en' ? [`en-${to}`] : to === 'en' ? [`${from}-en`] : [`${from}-en`, `en-${to}`];
    const keep = new Set(pairs);
    if (to !== 'en') keep.add(`en-${to}`);
    for (const pair of this.loaded) {
      if (keep.has(pair)) continue;
      const [source, target] = pair.split('-');
      await this.rpc('freeTranslationModel', [{ from: source, to: target }]); this.loaded.delete(pair);
    }
    for (const pair of pairs) await this.load(pair);
    const rows = await this.rpc('translate', [{
      models: pairs.map(pair => { const [source, target] = pair.split('-'); return { from: source, to: target }; }),
      texts: [{ text, html: false, qualityScores: false }],
    }]);
    const output = rows?.[0]?.target?.text?.trim();
    if (!output) throw failure('local_model_error');
    return output;
  }
  stop() {
    this.closed = true; this.abort.abort(); this.worker?.terminate();
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(failure('local_cancelled')); }
    this.pending.clear(); this.memoryCache.clear(); this.loaded.clear();
  }
}
