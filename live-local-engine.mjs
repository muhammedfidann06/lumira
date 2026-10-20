import { SPEECH, LANGUAGES } from './live-local-config.mjs';
import { failure, languageScores, removeOverlap, speechEnergy } from './live-local-core.mjs';

// Runtime and text translator are injected so production inference can be
// checked with real recordings in Node and in a browser worker.
export class LocalEngine {
  constructor({ pipeline, Tensor, translateText, backend = 'wasm', onProgress = () => {} }) {
    this.pipeline = pipeline; this.Tensor = Tensor; this.backend = backend;
    this.translateText = translateText; this.onProgress = onProgress; this.previous = '';
  }
  async prepare({ target,sourceLanguage='auto' }) {
    if (!LANGUAGES.includes(target)) throw failure('unsupported_language');
    if(sourceLanguage!=='auto'&&!LANGUAGES.includes(sourceLanguage))throw failure('unsupported_language');
    this.target = target;this.sourceLanguage=sourceLanguage;
    this.asr = await this.pipeline('automatic-speech-recognition', SPEECH.id, {
      revision: SPEECH.revision, dtype: 'q8', device: this.backend,
      session_options: this.backend === 'cpu' ? { intraOpNumThreads: 2 } : {},
      progress_callback: event => this.onProgress(event),
    });
  }
  async process(audio, { overlap = false } = {}) {
    let peak = 0;
    for (const sample of audio) peak = Math.max(peak, Math.abs(sample));
    if (peak < 0.00002) return { empty: true };
    const gain = Math.min(100, 0.8 / peak);
    if (gain > 1.1) audio = audio.map(sample => sample * gain);
    if (speechEnergy(audio).rms < 0.0001) return { empty: true };
    let features, detection, decoder, tokens;
    try {
      features = await this.asr.processor(audio);
      decoder = new this.Tensor('int64', BigInt64Array.of(BigInt(this.asr.model.config.decoder_start_token_id)), [1, 1]);
      detection = await this.asr.model({ ...features, decoder_input_ids: decoder });
      const generation = this.asr.model.generation_config;
      const { language:detected, noSpeech } = languageScores(detection.logits.data, generation.lang_to_id, generation.no_timestamps_token_id - 1);
      if (noSpeech > 0.65) return { empty: true };
      const language=this.sourceLanguage&&this.sourceLanguage!=='auto'?this.sourceLanguage:detected;
      if (!LANGUAGES.includes(language)) return { unsupported: true, language };
      tokens = await this.asr.model.generate({
        ...features, encoder_outputs: detection.encoder_outputs, language, task: 'transcribe',
        max_new_tokens: 220, repetition_penalty: 1.05, no_repeat_ngram_size: 5,
      });
      let original = (this.asr.tokenizer.batch_decode(tokens, { skip_special_tokens: true })[0] || '').trim();
      const fullOriginal = original;
      if (overlap) original = removeOverlap(this.previous, original);
      this.previous = fullOriginal;
      if (!original) return { empty: true };
      // Small Whisper models can change meaning in their translate task.
      // Recognise source text only, then use the purpose-built NMT models.
      const translated = language === this.target ? original : await this.translateText(original, language, this.target);
      return { original, translated, language };
    } finally {
      const seen = new Set();
      const dispose = value => {
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        if (typeof value.dispose === 'function' && value.ort_tensor) { try { value.dispose(); } catch {} return; }
        for (const item of Object.values(value)) dispose(item);
      };
      dispose(features); dispose(detection); dispose(decoder); dispose(tokens);
    }
  }
  async dispose() { await this.asr?.dispose(); this.asr = null; }
}
