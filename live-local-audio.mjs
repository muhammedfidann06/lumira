import { Resampler } from './live-local-core.mjs';

class LumiraCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.resampler = new Resampler(sampleRate, audio => this.port.postMessage(audio, [audio.buffer]));
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.resampler.push(channel);
    return true;
  }
}
registerProcessor('lumira-capture', LumiraCapture);
