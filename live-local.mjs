import { CHUNK_SECONDS, OVERLAP_SECONDS, SAMPLE_RATE, DOWNLOAD_BYTES } from './live-local-config.mjs';
import { AudioBufferQueue, Resampler, failure, removeOverlap, speechEnergy } from './live-local-core.mjs';

export class LocalSession {
  static removeOverlap(previous, next, maxWords = 12) { return removeOverlap(previous, next, maxWords); }
  static fallbackAllowed(device = navigator) {
    // WebKit can terminate the whole page while the WASM models allocate
    // memory. A worker error cannot catch that process kill. Never start
    // this fallback on iOS or a phone with an unknown/small memory budget.
    const ios = /iPad|iPhone|iPod/i.test(device.userAgent || '') || device.platform === 'MacIntel' && device.maxTouchPoints > 1;
    const mobile = /Android|Mobile/i.test(device.userAgent || '');
    const memory = Number(device.deviceMemory || 0);
    return !ios && (!mobile || memory >= 8) && (!memory || memory >= 8);
  }
  static supported() { return !!(window.Worker && window.WebAssembly && window.DecompressionStream && window.crypto?.subtle && (window.AudioContext || window.webkitAudioContext)); }
  constructor({ target, sourceLanguage='auto', onProgress, onResult, onError, onNotice, audioContext, onAudio }) {
    this.target = target; this.sourceLanguage=sourceLanguage; this.onProgress = onProgress; this.onResult = onResult;
    this.onError = onError; this.onNotice = onNotice; this.closed = false;
    this.onAudio = onAudio;
    this.pending = new Map(); this.nextId = 1; this.files = new Map();
    this.recent = new AudioBufferQueue(SAMPLE_RATE * 60);
    this.queue = new AudioBufferQueue(); this.samples = 0; this.committed = 0;
    this.tail = new Float32Array(); this.lastOriginal = ''; this.lastTranslated = '';
    // Called directly from Start's user gesture, before awaiting the API or a
    // large download. iOS will otherwise leave a new AudioContext suspended.
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw failure('local_unsupported');
    if (audioContext) this.context = audioContext;
    else this.context = new Audio();
    this.context.resume().catch(() => {});
  }
  get position() { return this.samples / SAMPLE_RATE; }
  markCommitted(seconds) { this.committed = Math.max(this.committed, Math.floor(seconds * SAMPLE_RATE)); }
  progress(event) {
    if (event.status === 'progress' && event.file) this.files.set(event.name + '/' + event.file, { loaded: event.loaded || 0, total: event.total || 0 });
    let loaded = 0;
    for (const file of this.files.values()) loaded += file.loaded;
    const total = DOWNLOAD_BYTES[this.target];
    this.onProgress?.({ percent: Math.min(99, Math.floor(loaded / total * 100)), loaded, total, ready: !!this.ready });
  }
  rpc(action, payload, transfer = [], timeout = 90000) {
    if (this.closed || !this.worker) return Promise.reject(failure('local_cancelled'));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id); reject(failure(action === 'process' ? 'local_too_slow' : 'local_download_error'));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, action, payload }, transfer);
    });
  }
  async prepare() {
    if (this.preparing) return this.preparing;
    this.preparing = (async () => {
      if (!LocalSession.fallbackAllowed()) throw failure('local_device_limited');
      if (!LocalSession.supported()) throw failure('local_unsupported');
      if (this.closed) throw failure('local_cancelled');
      this.worker = new Worker(new URL('./live-local-worker.mjs', import.meta.url), { type: 'module' });
      this.worker.onmessage = event => {
        if (event.data.progress) { this.progress(event.data.progress); return; }
        const item = this.pending.get(event.data.id);
        if (!item) return;
        this.pending.delete(event.data.id); clearTimeout(item.timer);
        event.data.error ? item.reject(failure(event.data.error)) : item.resolve(event.data.result);
      };
      this.worker.onerror = () => {
        for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(failure('local_download_error')); }
        this.pending.clear();
      };
      await this.rpc('prepare', { target: this.target,sourceLanguage:this.sourceLanguage }, [], 600000);
      this.ready = true; this.onProgress?.({ ready: true, percent: 100, total: DOWNLOAD_BYTES[this.target] });
    })().catch(error => {
      this.worker?.terminate(); this.worker = null; this.preparing = null;
      throw error;
    });
    return this.preparing;
  }
  async arm(stream) {
    if (this.source) return;
    if (this.closed) throw failure('local_cancelled');
    this.stream = stream.clone();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.mute = this.context.createGain(); this.mute.gain.value = 0;
    if (this.context.audioWorklet && window.AudioWorkletNode) {
      let deadline;
      try {
        // A blocked module request can stay pending without rejecting. Keep
        // capture independent of that request and of any model download.
        await Promise.race([
          this.context.audioWorklet.addModule(new URL('./live-local-audio.mjs', import.meta.url)),
          new Promise((_, reject) => { deadline=setTimeout(() => reject(failure('local_audio_error')),2500); })
        ]);
        if (this.closed) throw failure('local_cancelled');
        this.capture = new AudioWorkletNode(this.context, 'lumira-capture', { channelCountMode:'max' });
        this.captureMode = 'worklet';
        this.capture.port.onmessage = event => this.receive(event.data);
      } catch (error) {
        if (this.closed) throw failure('local_cancelled');
        // Older WebViews or a failed module request must not disable every
        // cloud provider. Keep the same microphone and AudioContext.
      } finally { clearTimeout(deadline); }
    }
    if (!this.capture) {
      this.capture = this.scriptCapture();
      this.captureMode = 'script';
    }
    this.source.connect(this.capture); this.capture.connect(this.mute); this.mute.connect(this.context.destination);
    await this.context.resume();
  }
  scriptCapture() {
    const capture=this.context.createScriptProcessor(4096,Math.min(2,this.stream.getAudioTracks?.()[0]?.getSettings?.().channelCount||1),1);
    const resampler=new Resampler(this.context.sampleRate,audio=>this.receive(audio));
    capture.onaudioprocess=event=>{
      if(this.closed||this.capture!==capture)return;
      let best=event.inputBuffer.getChannelData(0),maximum=-1;
      for(let n=0;n<event.inputBuffer.numberOfChannels;n++){const channel=event.inputBuffer.getChannelData(n);let energy=0;for(const value of channel)energy+=value*value;if(energy>maximum){maximum=energy;best=channel;}}
      resampler.push(best);
    };
    return capture;
  }
  recoverCapture() {
    if(this.closed||!this.source||!this.capture||!this.mute||this.captureMode!=='worklet')return false;
    try{
      const next=this.scriptCapture(),previous=this.capture;
      this.source.disconnect();previous.disconnect();previous.port.onmessage=null;previous.port.close?.();
      this.capture=next;this.captureMode='script';this.source.connect(next);next.connect(this.mute);this.resumeCapture();return true;
    }catch{return false;}
  }
  receive(audio) {
    if (this.closed) return;
    this.samples += audio.length;
    this.onAudio?.(audio, this.position);
    this.quietSamples = speechEnergy(audio).rms < 0.006 ? (this.quietSamples || 0) + audio.length : 0;
    if (this.collecting) {
      try { this.queue.push(audio); } catch (error) { this.collecting = false; this.onError?.(error); return; }
      this.pump();
    } else {
      const discard = this.recent.length + audio.length - this.recent.limit;
      if (discard > 0) this.recent.take(discard);
      this.recent.push(audio);
    }
  }
  recentAudio() {
    const audio = this.recent.take(); this.recent.push(audio);
    const useful = Math.max(0, Math.min(audio.length, this.samples - this.committed + 8000));
    return useful ? audio.slice(-useful) : new Float32Array();
  }
  start({ original = '', translated = '' } = {}) {
    if (this.closed || !this.ready) throw failure('local_model_error');
    this.lastOriginal = original; this.lastTranslated = translated; this.transition = true;
    const recent = this.recent.take();
    const useful = Math.max(0, Math.min(recent.length, this.samples - this.committed + Math.floor(0.5 * SAMPLE_RATE)));
    if (useful) this.queue.push(recent.slice(-useful));
    this.collecting = true; this.pump();
  }
  pause() { this.collecting = false; this.recent.clear(); }
  resumeCapture() { if (!this.closed && this.context.state !== 'running') this.context.resume().catch(() => {}); }
  resume() { this.recent.clear(); this.collecting = true; this.context.resume().catch(() => {}); }
  async pump() {
    if (this.processing || !this.collecting || this.closed) return;
    // Prefer a short silence, so words at a normal sentence boundary are not
    // cut in half. In uninterrupted speech use bounded, overlapping windows.
    if (this.queue.length < SAMPLE_RATE * 4) return;
    const quiet = this.quietSamples >= SAMPLE_RATE * 0.6;
    if (this.queue.length < SAMPLE_RATE * CHUNK_SECONDS && !quiet) return;
    this.processing = true;
    try {
      const body = this.queue.take(SAMPLE_RATE * CHUNK_SECONDS);
      const audio = new Float32Array(this.tail.length + body.length);
      audio.set(this.tail); audio.set(body, this.tail.length);
      const overlap = this.tail.length > 0;
      this.tail = body.slice(-Math.floor(OVERLAP_SECONDS * SAMPLE_RATE));
      let result = await this.rpc('process', { audio: audio.buffer, overlap }, [audio.buffer]);
      if (this.closed) return;
      if (result.unsupported) { this.onNotice?.('local_source_unsupported'); return; }
      if (result.empty) return;
      if (this.transition) {
        result.original = removeOverlap(this.lastOriginal, result.original, 50);
        result.translated = removeOverlap(this.lastTranslated, result.translated, 50);
        this.transition = false;
      }
      if (result.original || result.translated) this.onResult?.(result);
    } catch (error) { if (!this.closed) { this.collecting = false; this.onError?.(error); } }
    finally {
      this.processing = false;
      // The next window may already have arrived while WASM was decoding.
      if (this.collecting && !this.closed) queueMicrotask(() => this.pump());
    }
  }
  stop() {
    this.closed = true; this.collecting = false;
    this.worker?.terminate(); this.worker = null;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(failure('local_cancelled')); }
    this.pending.clear(); this.queue.clear(); this.recent.clear(); this.tail = new Float32Array();
    try { this.source?.disconnect(); this.capture?.disconnect(); this.mute?.disconnect(); } catch {}
    this.stream?.getTracks().forEach(track => track.stop());
    this.context.close().catch(() => {});
  }
}
