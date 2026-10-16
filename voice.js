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
  var status = 'idle';
  function setStatus(value) {
    status = value;
    window.dispatchEvent(new CustomEvent('lumira:voice-status', {detail:window.VOICE_debug ? window.VOICE_debug() : {status:value}}));
  }
  function prepareSession() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e) {}
  }
  // Discard the removed diagnostic panel's preference: it must not strand
  // visitors on a broken online-only selection after upgrading.
  try { localStorage.removeItem('lumira_voice_mode'); } catch(e) {}
  function reportFailure(fallback) {
    var messages = fallback ? {
      tr:'İnternet sesi alınamadı. Cihaz sesi deneniyor; iPhone’da sessiz modu kapatman gerekebilir.',
      en:'Online audio is unavailable. Trying the device voice; you may need to turn off silent mode on iPhone.',
      de:'Online-Audio ist nicht verfügbar. Die Gerätestimme wird versucht; schalte am iPhone bei Bedarf den Stummmodus aus.',
      fr:'Audio en ligne indisponible. Essai de la voix de l’appareil ; désactive le mode silencieux sur iPhone si nécessaire.',
      es:'Audio en línea no disponible. Se probará la voz del dispositivo; puede ser necesario desactivar el modo silencio en iPhone.',
      ru:'Онлайн-аудио недоступно. Пробуем голос устройства; на iPhone может потребоваться выключить беззвучный режим.',
      ar:'الصوت عبر الإنترنت غير متاح. سنجرب صوت الجهاز؛ قد تحتاج إلى إيقاف الوضع الصامت على iPhone.'
    } : {
      tr:'Ses başlatılamadı. Biraz sonra yeniden dene.', en:'Audio could not start. Please try again later.',
      de:'Audio konnte nicht starten. Versuche es später erneut.', fr:'Le son n’a pas démarré. Réessaie plus tard.',
      es:'No se pudo iniciar el audio. Inténtalo más tarde.', ru:'Не удалось включить звук. Попробуй позже.', ar:'تعذر تشغيل الصوت. حاول لاحقاً.'
    };
    if (window.PWA && window.PWA.toast) window.PWA.toast(messages[window.NATIVE_LANG] || messages.en, {kind:'bad'});
  }
  function audioChunks(text) {
    var chars = Array.from(String(text || '').trim()), chunks = [];
    while (chars.length) {
      var end = Math.min(180, chars.length);
      // Also respect the server's UTF-16 length limit for emoji/surrogates.
      while (chars.slice(0, end).join('').length > 180) end--;
      if (end < chars.length) {
        for (var i = end - 1; i > end / 2; i--) {
          if (/\s/.test(chars[i])) { end = i + 1; break; }
        }
      }
      var chunk = chars.splice(0, end).join('').trim();
      if (chunk) chunks.push(chunk);
    }
    return chunks;
  }
  function speakGoogle(text, lang, slow, onEnd) {
    stopAudio();
    prepareSession();
    lastError = '';
    setStatus('online-requested');
    var id = audioSerial, done = false, chunks = audioChunks(text), index = 0;
    function finish(ok) {
      if (done || id !== audioSerial) return;
      done = true;
      clearTimeout(audioTimer);
      if (!ok) lastError = 'media-playback-failed';
      setStatus(ok ? 'online-ended' : 'online-error');
      if (onEnd) onEnd(ok);
    }
    function playChunk() {
      if (done || id !== audioSerial) return;
      if (index >= chunks.length) { finish(true); return; }
      try {
        if (!audio) audio = new Audio();
        audio.playsInline = true;
        audio.preload = 'auto';
        audio.src = '/.netlify/functions/tts?lang=' + encodeURIComponent(String(lang).split('-')[0]) +
          '&slow=' + (slow ? '1' : '0') + '&text=' + encodeURIComponent(chunks[index]);
        audio.onended = function () {
          if (done || id !== audioSerial) return;
          index++; playChunk();
        };
        audio.onerror = function () { finish(false); };
        audio.onplaying = function () {
          if (id !== audioSerial) return;
          clearTimeout(audioTimer); setStatus('online-playing');
        };
        clearTimeout(audioTimer);
        audioTimer = setTimeout(function () {
          if (id !== audioSerial || done) return;
          try { audio.pause(); } catch(e) {} finish(false);
        }, 18000);
        // Called directly by the user's tap. No fetch()/await before play().
        var promise = audio.play();
        if (promise && promise.catch) promise.catch(function () { finish(false); });
      } catch (e) { finish(false); }
    }
    playChunk();
  }
  function speakNative(text, lang, rate, onResult) {
    var id = ++serial, done = false, started = false;
    clearTimeout(startTimer);
    clearTimeout(watchTimer);
    stopAudio();
    prepareSession();
    setStatus('device-requested');
    // Detach old callbacks before cancel: cancellation must not launch an old fallback.
    if (utterance) utterance.onstart = utterance.onend = utterance.onerror = null;
    utterance = null;
    function finish(ok) {
      if (done || id !== serial) return;
      done = true;
      clearTimeout(watchTimer);
      utterance = null;
      setStatus(ok ? 'device-ended' : 'device-error');
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
        u.onstart = function () { if (id === serial) { started = true; clearTimeout(watchTimer); setStatus('device-speaking'); } };
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
    if (!String(text || '').trim()) return;
    if (ios && navigator.onLine !== false) {
      stopSpeech();
      // Media playback is used on iOS instead of the ringer-dependent voice.
      speakGoogle(text, lang, slow, function (ok) {
        if (!ok) {
          reportFailure(true);
          speakNative(text, lang, slow ? 0.55 : 0.92, function (nativeOK) {
            if (!nativeOK) reportFailure(false);
          });
        }
      });
      return;
    }
    speakNative(text, lang, slow ? 0.55 : 0.92, function (ok) {
      if (!ok) speakGoogle(text, lang, slow, function (mediaOK) { if (!mediaOK) reportFailure(false); });
    });
  }
  function stopSpeech() {
    ++serial;
    clearTimeout(startTimer); clearTimeout(watchTimer);
    if (utterance) utterance.onstart = utterance.onend = utterance.onerror = null;
    utterance = null;
    try { if (synth) synth.cancel(); } catch(e) {}
  }
  window.VOICE_stop = function () { stopSpeech(); stopAudio(); };
  window.speak = function (text, lang) {
    if (typeof soundOn !== 'undefined' && !soundOn) return;
    manualSpeak(text, lang, false);
  };
  window.speakSlow = function (text, lang) {
    if (typeof soundOn !== 'undefined' && !soundOn) return;
    manualSpeak(text, lang, true);
  };
  window.speakNative = speakNative;
  window.speakGoogle = speakGoogle;
  window.PM_speakGoogle = speakGoogle;
  window.VOICE_speakManual = manualSpeak;
  window.warmUpSpeech = function () {
    try { if (synth) synth.getVoices(); } catch (e) {}
  };
  window.VOICE_debug = function () {
    return {version:'1.8.10', status:status, mode:ios ? 'media' : 'device', ios:ios, available:!!synth, voices:synth ? synth.getVoices().length : 0, audioSession:navigator.audioSession ? navigator.audioSession.type : 'unavailable',
      speaking:!!(synth && synth.speaking), lastError:lastError};
  };
})();
