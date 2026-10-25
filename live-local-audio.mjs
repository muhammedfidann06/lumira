import { Resampler } from './live-local-core.mjs';

class LumiraCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.resampler = new Resampler(sampleRate, audio => this.port.postMessage(audio, [audio.buffer]));
  }
  process(inputs) {
    // Virtual microphones may deliver speech on just one stereo channel.
    // Select the channel with the strongest signal instead of discarding it
    // or averaging phase-inverted channels into silence.
    const channels=inputs[0]||[];let channel=channels[0],maximum=-1;
    for(const candidate of channels){let energy=0;for(const value of candidate)energy+=value*value;if(energy>maximum){maximum=energy;channel=candidate;}}
    if (channel) this.resampler.push(channel);
    return true;
  }
}
registerProcessor('lumira-capture', LumiraCapture);
