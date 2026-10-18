import { SAMPLE_RATE, MAX_BUFFER_SECONDS } from './live-local-config.mjs';

export function failure(code) { return Object.assign(new Error(code), { featureCode: code }); }

// A three-hour lesson must not become a three-hour audio recording in RAM.
// This bounded buffer contains only unprocessed audio and is never persisted.
export class AudioBufferQueue {
  constructor(limit = SAMPLE_RATE * MAX_BUFFER_SECONDS) {
    this.limit = limit; this.parts = []; this.length = 0;
  }
  push(part) {
    if (!(part instanceof Float32Array)) throw failure('local_audio_error');
    if (this.length + part.length > this.limit) throw failure('local_too_slow');
    if (part.length) { this.parts.push(part); this.length += part.length; }
  }
  take(count = this.length) {
    count = Math.max(0, Math.min(this.length, Math.floor(count)));
    const result = new Float32Array(count);
    let offset = 0;
    while (offset < count) {
      const part = this.parts.shift(), size = Math.min(part.length, count - offset);
      result.set(part.subarray(0, size), offset); offset += size;
      if (size < part.length) this.parts.unshift(part.subarray(size));
    }
    this.length -= count;
    return result;
  }
  clear() { this.parts = []; this.length = 0; }
}

// Integrate samples into 16 kHz bins, preserving fractional boundaries across
// callbacks. AudioContext may use 44.1 or 48 kHz on phones despite our request.
export class Resampler {
  constructor(rate, emit, size = 1600) {
    this.ratio = rate / SAMPLE_RATE; this.left = this.ratio; this.sum = 0;
    this.emit = emit; this.size = size; this.output = new Float32Array(size); this.index = 0;
  }
  push(input) {
    for (const sample of input) {
      let left = 1;
      while (left > 1e-8) {
        const take = Math.min(left, this.left);
        this.sum += sample * take; this.left -= take; left -= take;
        if (this.left < 1e-8) {
          this.output[this.index++] = this.sum / this.ratio;
          this.sum = 0; this.left = this.ratio;
          if (this.index === this.size) {
            this.emit(this.output); this.output = new Float32Array(this.size); this.index = 0;
          }
        }
      }
    }
  }
}

const word = value => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// Remove only an overlap at the join. Repeated sentences later in a lesson
// remain valid speech, so there is deliberately no global text deduplication.
export function removeOverlap(previous, next, maxWords = 12) {
  if (!previous || !next) return next || '';
  const before = previous.trim().split(/\s+/), after = next.trim().split(/\s+/);
  for (let n = Math.min(maxWords, before.length, after.length); n >= 2; --n) {
    const a = before.slice(-n).map(word), b = after.slice(0, n).map(word);
    if (a.every((value, i) => value && value === b[i])) return after.slice(n).join(' ');
  }
  return next;
}

export function speechEnergy(audio) {
  let total = 0, active = 0;
  for (let i = 0; i < audio.length; i++) {
    total += audio[i] * audio[i];
    if (Math.abs(audio[i]) > 0.008) active++;
  }
  return { rms: Math.sqrt(total / Math.max(1, audio.length)), active: active / Math.max(1, audio.length) };
}

export function languageScores(logits, languageIds, noSpeechId) {
  let maximum = -Infinity;
  for (const value of logits) if (value > maximum) maximum = value;
  let sum = 0;
  for (const value of logits) sum += Math.exp(value - maximum);
  const ranked = Object.entries(languageIds).map(([token, id]) => ({
    language: token.replace(/[<>|]/g, ''), score: logits[id],
  })).sort((a, b) => b.score - a.score);
  return { language: ranked[0]?.language || '', noSpeech: Math.exp(logits[noSpeechId] - maximum) / sum };
}

