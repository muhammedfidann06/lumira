/* Lumira speech controller: keep iOS playback inside the user's tap. */
(function () {
  'use strict';
  var synth = window.speechSynthesis;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var serial = 0, utterance = null, startTimer = null, watchTimer = null;
  var audio = null, audioSerial = 0, audioTimer = null;
  var lastError = '';

  function stopAudio() {
    audioSerial++;
    clearTimeout(audioTimer);
    if (audio) {
      audio.onended = audio.onerror = audio.onplaying = null;
      try { audio.pause(); } catch (e) {}
    }
  }
  function primeAudio() {
    if (!ios) return;
    try {
      if (!audio) audio = new Audio();
      if (audio.dataset && audio.dataset.unlocked) return;
      // A real, silent WAV primes this same element during the original tap.
      audio.src = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==';
      audio.playsInline = true;
      var id = audioSerial;
      var p = audio.play();
      if (p && p.then) p.then(function () {
        if (id !== audioSerial) return;
        if (audio.dataset) audio.dataset.unlocked = '1';
      }).catch(function () {});
    } catch (e) {}
  }
  function reportFailure() {
    var messages = {
      tr:'Ses başlatılamadı. Medya sesini kontrol edip ses düğmesine tekrar dokun.',
      en:'Audio could not start. Check your media volume and tap the audio button again.',
      de:'Audio konnte nicht starten. Prüfe die Medienlautstärke und tippe erneut auf die Audiotaste.',
      fr:'Le son n’a pas démarré. Vérifie le volume et réessaie.',
      es:'No se pudo iniciar el audio. Revisa el volumen y vuelve a pulsar.',
      ru:'Не удалось включить звук. Проверь громкость и нажми ещё раз.',
      ar:'تعذر تشغيل الصوت. تحقق من مستوى الصوت واضغط مرة أخرى.'
    };
    if (window.PWA && window.PWA.toast) window.PWA.toast(messages[window.NATIVE_LANG] || messages.en, {kind:'bad'});
  }
  function speakGoogle(text, lang, slow, onEnd) {
    stopAudio();
    var id = audioSerial, done = false;
    function finish(ok) {
      if (done || id !== audioSerial) return;
      done = true;
      clearTimeout(audioTimer);
      if (!ok) { lastError = 'audio-playback-failed'; reportFailure(); }
      if (onEnd) onEnd(ok);
    }
    try {
      if (!audio) audio = new Audio();
      audio.src = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' +
        encodeURIComponent(String(lang).split('-')[0]) + '&ttsspeed=' + (slow ? '0.24' : '1') + '&q=' + encodeURIComponent(text);
      audio.onended = function () { finish(true); };
      audio.onerror = function () { finish(false); };
      audio.onplaying = function () { clearTimeout(audioTimer); };
      audioTimer = setTimeout(function () { try { audio.pause(); } catch(e) {} finish(false); }, 10000);
      var p = audio.play();
      if (p && p.catch) p.catch(function () { finish(false); });
    } catch (e) { finish(false); }
  }
  function speakNative(text, lang, rate, onResult) {
    var id = ++serial, done = false, started = false;
    clearTimeout(startTimer);
    clearTimeout(watchTimer);
    stopAudio();
    primeAudio();
    // Detach old callbacks before cancel: cancellation must not launch an old fallback.
    if (utterance) utterance.onstart = utterance.onend = utterance.onerror = null;
    utterance = null;
    function finish(ok) {
      if (done || id !== serial) return;
      done = true;
      clearTimeout(watchTimer);
      utterance = null;
      if (onResult) onResult(ok);
    }
    if (!text || !synth) { finish(false); return; }
    var busy = synth.speaking || synth.pending;
    if (busy) { try { synth.cancel(); } catch (e) {} }
    function start() {
      if (id !== serial) return;
      try {
        var u = new SpeechSynthesisUtterance(String(text));
        utterance = u;
        u.lang = lang || 'de-DE';
        // Let iOS choose its installed default. A listed Siri/Premium voice
        // can exist in getVoices() but be unavailable to web speech.
        if (!ios && typeof window.pickVoice === 'function') {
          var voice = window.pickVoice(u.lang);
          if (voice) { u.voice = voice; u.lang = voice.lang; }
        }
        u.rate = rate < 0.8 ? (ios ? 0.55 : 0.35) : (rate || 0.92);
        u.pitch = 1; u.volume = 1;
        u.onstart = function () { if (id === serial) { started = true; clearTimeout(watchTimer); } };
        u.onend = function () { finish(true); };
        u.onerror = function (event) {
          if (id !== serial) return;
          lastError = event && event.error || 'speech-error';
          finish(false);
        };
        // Arm before speak(): mocked or very fast implementations can start synchronously.
        watchTimer = setTimeout(function () {
          if (started || done || id !== serial) return;
          lastError = 'speech-start-timeout';
          u.onerror = u.onend = null;
          try { synth.cancel(); } catch (e) {}
          finish(false);
        }, ios ? 6000 : 3500);
        synth.speak(u);
        if (synth.paused) synth.resume();
      } catch (e) { lastError = String(e); finish(false); }
    }
    if (ios || !busy) start();
    else startTimer = setTimeout(start, 0);
  }
  function manualSpeak(text, lang, slow) {
    speakNative(text, lang, slow ? 0.55 : 0.92, function (ok) {
      if (!ok) speakGoogle(text, lang, slow, function () {});
    });
  }
  window.speakNative = speakNative;
  window.speakGoogle = speakGoogle;
  window.PM_speakGoogle = speakGoogle;
  window.VOICE_speakManual = manualSpeak;
  window.warmUpSpeech = function () {
    try { if (synth) synth.getVoices(); } catch (e) {}
  };
  window.VOICE_debug = function () {
    return {version:'1.8.8', ios:ios, available:!!synth,
      speaking:!!(synth && synth.speaking), lastError:lastError};
  };
})();
