// Pinned public model files; inference runs on the learner's device.
export const RUNTIME = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
export const WASM = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';
export const SPEECH = { id: 'Xenova/whisper-base', revision: '64da57285918e20ea79ea5c88eed7197933abaa8', bytes: 80000000 };
export const LANGUAGES = Object.freeze(['tr', 'de', 'en', 'ar', 'fr', 'es', 'ru']);
// The browser downloads only the required six directions, not every pair.
export const MODEL_CACHE = 'lumira-local-models-v1';
export const DOWNLOAD_BYTES = Object.freeze({ tr: 225000000, en: 230000000, de: 235000000, ar: 235000000, fr: 235000000, es: 235000000, ru: 235000000 });
export const CHUNK_SECONDS = 20;
export const OVERLAP_SECONDS = 0.8;
export const MAX_BUFFER_SECONDS = 75;
export const SAMPLE_RATE = 16000;
