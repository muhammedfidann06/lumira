import { RUNTIME, WASM } from './live-local-config.mjs';
import { LocalEngine } from './live-local-engine.mjs';
import { LocalTextTranslator } from './live-local-text.mjs';

let engine, translator;
self.onmessage = async event => {
  const { id, action, payload } = event.data || {};
  try {
    if (action === 'prepare') {
      const progress = event => self.postMessage({ progress: event });
      const { pipeline, env, Tensor } = await import(RUNTIME);
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.proxy = false;
      env.backends.onnx.wasm.wasmPaths = WASM;
      translator = new LocalTextTranslator({ onProgress: progress });
      engine = new LocalEngine({ pipeline, Tensor, translateText: (text, from, to) => translator.translate(text, from, to), onProgress: progress });
      // Sequential loading bounds peak RAM on phones.
      await engine.prepare(payload); await translator.prepare(payload.target);
      self.postMessage({ id, result: { ready: true } });
    } else if (action === 'process' && engine) {
      const result = await engine.process(new Float32Array(payload.audio), { overlap: payload.overlap });
      self.postMessage({ id, result });
    } else throw new Error('local_model_error');
  } catch (error) {
    self.postMessage({ id, error: error.featureCode || (action === 'prepare' ? 'local_download_error' : 'local_model_error') });
  }
};
