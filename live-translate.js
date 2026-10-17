/* Continuous Azure speech translation. No browser SpeechRecognition fallback:
   the source language is actually detected from the microphone audio. */
(function () {
  'use strict';
  const F = window.LUMIRA_FEATURES;
  const LOCALES = ['tr-TR','de-DE','en-US','ar-SA','fr-FR','es-ES','ru-RU'];
  const FLAGS = { tr:'🇹🇷', de:'🇩🇪', en:'🇬🇧', ar:'🇸🇦', fr:'🇫🇷', es:'🇪🇸', ru:'🇷🇺' };
  const s = { root:null, phase:'idle', generation:0, entries:[], draft:null, detected:'', target:'tr', quota:null, sessionId:null, recognizer:null, stream:null, inputStream:null, audio:null, observer:null, timer:null, deadlineTimer:null, tick:null, leaseDeadline:0, tokenDeadline:0, remainingAt:0, remaining:null, sdkPromise:null, SDK:null, speech:null, restartTimer:null, restartPending:false, restartAttempt:0, authRetries:0, cancelStart:null, wakeLock:null, message:'ready', error:false, renewPending:false, releasePromise:null, providerConfigured:null };
  const node = id => s.root?.querySelector('#' + id);
  const active = () => s.phase === 'starting' || s.phase === 'listening' || s.phase === 'reconnecting';
  const label = code => { const names = window.t && window.t('lang_names'); return (names && names[code]) || code.toUpperCase(); };
  const time = seconds => { seconds = Math.max(0, Math.ceil(seconds)); return Math.floor(seconds/60) + ':' + String(seconds % 60).padStart(2,'0'); };
  function error(code) { return Object.assign(new Error(code), { featureCode:code }); }
  function stopTracks(stream) { try { stream?.getTracks().forEach(track => track.stop()); } catch (e) {} }
  function status(message, bad) { s.message = message; s.error = !!bad; drawControls(); }
  function drawControls() {
    if (!s.root) return;
    const button = node('ltMic'), select = node('ltTarget'), clear = node('ltClear'), statusBox = node('ltStatus');
    if (button) {
      button.textContent = F.text(active() ? 'stop' : 'start');
      button.setAttribute('aria-pressed', String(active()));
      button.disabled = !active() && s.providerConfigured === false;
    }
    if (select) select.disabled = active();
    if (clear) clear.disabled = active() || (!s.entries.length && !s.draft);
    if (statusBox) { statusBox.textContent = F.text(s.message); statusBox.className = 'lt-status' + (s.error ? ' is-error' : s.phase === 'listening' ? ' is-live' : ''); }
    drawQuota();
  }
  function drawQuota() {
    const el = node('ltQuota');
    if (!el) return;
    if (!s.quota) { el.textContent = F.text('loading'); return; }
    const q = s.quota.live;
    if (q.limitSeconds === null) el.textContent = F.text('unlimited');
    else {
      const left = active() && s.remaining !== null ? Math.max(0,s.remaining - (performance.now()-s.remainingAt)/1000) : q.remainingSeconds;
      el.textContent = F.text('live',{ time:time(left), limit:q.limitSeconds/60 });
    }
    el.title = F.text('reset',{date:new Date(q.resetsAt).toLocaleString(window.NATIVE_LANG || 'tr',{timeZone:q.timeZone})}) + ' (' + q.timeZone + ')';
  }
  function drawText() {
    const original = node('ltOriginal'), translated = node('ltTranslation');
    if (!original || !translated) return;
    const paint = (el, field, placeholder) => {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight-60;
      el.replaceChildren();
      const full = s.entries.map(e => e[field]).filter(Boolean).join('\n');
      if (full) el.appendChild(document.createTextNode(full));
      if (s.draft?.[field]) {
        const span = document.createElement('span'); span.className='lt-draft'; span.textContent=(full?'\n':'')+s.draft[field]; el.appendChild(span);
      }
      if (!full && !s.draft?.[field]) { const span=document.createElement('span');span.className='lt-placeholder';span.textContent=F.text(placeholder);el.appendChild(span); }
      if (nearBottom) el.scrollTop = el.scrollHeight;
    };
    paint(original,'original','emptySource'); paint(translated,'translated','emptyTarget');
    const detected = node('ltDetected');
    if (detected) detected.textContent = s.detected ? (FLAGS[s.detected] || '🌐') + ' ' + label(s.detected) : F.text('auto');
    drawControls();
  }
  function sdk() {
    if (window.SpeechSDK) return Promise.resolve(window.SpeechSDK);
    if (s.sdkPromise) return s.sdkPromise;
    s.sdkPromise = new Promise((resolve,reject) => {
      const script=document.createElement('script'); script.src='./vendor/speech-sdk-1.52.0.min.js'; script.async=true;
      const timeout=setTimeout(() => { script.remove();s.sdkPromise=null;reject(error('sdk_unavailable')); },15000);
      script.onload=() => { clearTimeout(timeout);if(window.SpeechSDK)resolve(window.SpeechSDK);else{s.sdkPromise=null;reject(error('sdk_unavailable'));} };
      script.onerror=() => {clearTimeout(timeout);script.remove();s.sdkPromise=null;reject(error('sdk_unavailable'));};
      document.head.appendChild(script);
    });
    return s.sdkPromise;
  }
  function applyLease(data, generation) {
    if (generation !== s.generation || !active()) return;
    s.quota = data.quota;
    const now=performance.now();
    s.leaseDeadline=now+Math.max(0,(data.session?.until || 0)-data.quota.serverNow);
    s.remaining=data.quota.live.remainingSeconds;s.remainingAt=now;
    clearTimeout(s.deadlineTimer);
    const wait=s.leaseDeadline-now;
    s.deadlineTimer=setTimeout(() => {
      if(generation!==s.generation || !active())return;
      // A lease boundary (including midnight) is not the user's Stop action.
      // Pause the provider until a new server lease has been obtained.
      reconnect(generation);
      renew(generation,s.sessionId);
    },Math.max(0,wait));
    if (data.speech) {
      s.speech=data.speech;
      s.tokenDeadline=now+data.speech.expiresAt-data.quota.serverNow;
      if (s.recognizer) s.recognizer.authorizationToken=data.speech.token;
    }
    drawQuota();
  }
  async function renew(generation, id) {
    if (s.renewPending || generation !== s.generation || !active()) return;
    s.renewPending=true;
    try {
      let data;
      try {
        data=await F.api('liveRenew',{id,refreshToken:s.tokenDeadline-performance.now()<60000});
      } catch(e) {
        if(e.featureCode!=='session_expired' || generation!==s.generation || !active())throw e;
        // Reacquire after a day reset or an expired lease. The server still
        // enforces the daily allowance and the one-session-per-account rule.
        data=await F.api('liveStart',{id});
      }
      if (generation !== s.generation || !active()) { F.api('liveStop',{id}).catch(()=>{}); return; }
      applyLease(data,generation);
    } catch (e) { if(generation===s.generation)stop(e.featureCode || 'speech_unavailable',true); }
    finally { if(generation===s.generation)s.renewPending=false; }
  }
  function releaseRecognizer(keepMicrophone) {
    const r=s.recognizer,a=s.audio,input=s.inputStream;
    s.recognizer=null;s.audio=null;s.inputStream=null;
    if(s.cancelStart){s.cancelStart();s.cancelStart=null;}
    if(!keepMicrophone){stopTracks(s.stream);s.stream=null;}
    return new Promise(resolve=>{
      let closed=false,timer;
      const close=()=>{
        if(closed)return;closed=true;clearTimeout(timer);
        try{r?.close();}catch(e){}try{a?.close();}catch(e){}
        stopTracks(input);resolve();
      };
      if(!r){close();return;}
      timer=setTimeout(close,1500);
      try{r.stopContinuousRecognitionAsync(close,close);}catch(e){close();}
    });
  }
  function holdScreen(generation) {
    if(document.hidden || !navigator.wakeLock || s.wakeLock)return;
    navigator.wakeLock.request('screen').then(lock=>{
      if(generation!==s.generation || !active()){lock.release().catch(()=>{});return;}
      s.wakeLock=lock;
      lock.addEventListener('release',()=>{if(s.wakeLock===lock)s.wakeLock=null;},{once:true});
    }).catch(()=>{});
  }
  function reconnect(generation) {
    if(generation!==s.generation || !active() || s.restartPending || s.restartTimer)return;
    s.restartPending=true;s.phase='reconnecting';s.draft=null;status('reconnecting');
    releaseRecognizer(true).then(()=>{
      if(generation!==s.generation || !active())return;
      const delay=Math.min(5000,250*Math.pow(2,Math.min(s.restartAttempt++,5)));
      s.restartTimer=setTimeout(async()=>{
        s.restartTimer=null;s.restartPending=false;
        if(generation!==s.generation || !active())return;
        if(s.leaseDeadline<=performance.now()){reconnect(generation);return;}
        try{await connectRecognizer(generation);}
        catch(e){if(generation===s.generation && active() && e.featureCode!=='recognizer_replaced')reconnect(generation);}
      },delay);
    });
  }
  async function connectRecognizer(generation) {
    const SDK=s.SDK,media=s.stream,speech=s.speech;
    if(!SDK || !media || !speech || generation!==s.generation || !active())throw error('recognizer_replaced');
    const config=SDK.SpeechTranslationConfig.fromEndpoint(new URL('wss://'+speech.region+'.stt.speech.microsoft.com/speech/universal/v2'));
    config.authorizationToken=speech.token;
    config.speechRecognitionLanguage='en-US';
    config.setProperty(SDK.PropertyId.SpeechServiceConnection_LanguageIdMode,'Continuous');
    config.addTargetLanguage(s.target);
    const detect=SDK.AutoDetectSourceLanguageConfig.fromLanguages(LOCALES);
    // Closing an SDK audio source can stop its tracks. Give it clones so a
    // provider reconnection cannot destroy the user's original microphone.
    s.inputStream=media.clone();
    s.audio=SDK.AudioConfig.fromStreamInput(s.inputStream);
    const recognizer=SDK.TranslationRecognizer.FromConfig(config,detect,s.audio);
    s.recognizer=recognizer;
    const current=()=>generation===s.generation && active() && s.recognizer===recognizer;
    const seen=new Set();
    function result(event,final){
      if(!current())return;
      const r=event.result;
      if(!r || !r.text || (final && r.reason!==SDK.ResultReason.TranslatedSpeech))return;
      let locale=r.language || '';
      if(!locale){try{locale=SDK.AutoDetectSourceLanguageResult.fromResult(r).language || '';}catch(e){}}
      if(!locale){try{locale=r.properties.getProperty(SDK.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult)||'';}catch(e){}}
      if(!locale || locale.startsWith('{')){
        try{
          const json=JSON.parse(locale.startsWith('{')?locale:(r.json || r.properties.getProperty(SDK.PropertyId.SpeechServiceResponse_JsonResult) || '{}'));
          locale=json.PrimaryLanguage?.Language || json.SpeechPhrase?.PrimaryLanguage?.Language || json.Language || '';
        }catch(e){locale='';}
      }
      const code=locale.split('-')[0].toLowerCase();
      if(FLAGS[code])s.detected=code;
      let translated='';try{translated=r.translations.get(s.target)||'';}catch(e){}
      if(!translated && code===s.target)translated=r.text;
      const entry={original:r.text,translated};
      if(final){
        // Azure's translation resultId can be the same for a whole session.
        // Audio offsets, not resultId alone, distinguish successive sentences.
        const key=Number.isFinite(r.offset)?[r.resultId,r.offset,r.duration].join(':'):null;
        if(key && seen.has(key))return;
        if(key)seen.add(key);
        s.entries.push(entry);s.draft=null;s.restartAttempt=0;s.authRetries=0;
      }else s.draft=entry;
      drawText();
    }
    recognizer.recognizing=(_,e)=>result(e,false);
    recognizer.recognized=(_,e)=>result(e,true);
    recognizer.canceled=(_,e)=>{
      if(!current())return;
      const codes=SDK.CancellationErrorCode || {},code=e?.errorCode;
      if(code!==undefined && [codes.AuthenticationFailure,codes.Forbidden].includes(code)){
        // The active connection may still use the preceding token. Reopen it
        // once with the most recently renewed token before declaring failure.
        if(s.authRetries++===0){reconnect(generation);return;}
        stop('speech_auth_error',true);return;
      }
      if(code!==undefined && code===codes.TooManyRequests){stop('speech_busy',true);return;}
      if(code!==undefined && code===codes.BadRequest){stop('speech_config_error',true);return;}
      reconnect(generation);
    };
    recognizer.sessionStopped=()=>{if(current())reconnect(generation);};
    await new Promise((resolve,reject)=>{
      let settled=false;
      const finish=e=>{
        if(settled)return;settled=true;clearTimeout(timeout);
        if(s.cancelStart===cancel)s.cancelStart=null;
        e?reject(e):resolve();
      };
      const cancel=()=>finish(error('recognizer_replaced'));
      const timeout=setTimeout(()=>finish(error('speech_unavailable')),10000);
      s.cancelStart=cancel;
      recognizer.startContinuousRecognitionAsync(()=>finish(),()=>finish(error('speech_unavailable')));
    });
    if(current()){s.phase='listening';status('listening');holdScreen(generation);}
  }
  function stop(message, bad, exiting) {
    const id=s.sessionId;
    ++s.generation;s.sessionId=null;s.phase='idle';s.renewPending=false;s.draft=null;
    clearInterval(s.timer);clearInterval(s.tick);clearTimeout(s.deadlineTimer);clearTimeout(s.restartTimer);
    s.restartTimer=null;s.restartPending=false;s.restartAttempt=0;s.authRetries=0;s.speech=null;
    if(s.wakeLock){s.wakeLock.release().catch(()=>{});s.wakeLock=null;}
    releaseRecognizer();
    if(id){
      if(exiting)F.releaseOnExit(id);
      else {
        s.releasePromise=F.api('liveStop',{id},{keepalive:true}).then(data=>{s.quota=data.quota;drawQuota();}).catch(()=>{}).finally(()=>{s.releasePromise=null;});
      }
    }
    status(message || 'stopped',bad);drawText();
  }
  async function start() {
    if(active())return;
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia){status('browser_unsupported',true);return;}
    const generation=++s.generation,id=F.id();
    s.phase='starting';s.sessionId=id;s.draft=null;s.detected='';status('starting');drawText();
    let media,SDK;
    try {
      // Request microphone access within the user's click; load SDK in parallel.
      const mediaTask=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}).then(stream=>{
        if(generation!==s.generation){stopTracks(stream);throw error('session_expired');}
        s.stream=stream;return stream;
      });
      [media,SDK]=await Promise.all([mediaTask,sdk()]);
      if(generation!==s.generation){stopTracks(media);return;}
      if(s.releasePromise)await s.releasePromise;
      if(generation!==s.generation){stopTracks(media);return;}
      const data=await F.api('liveStart',{id});
      if(generation!==s.generation){stopTracks(media);F.api('liveStop',{id}).catch(()=>{});return;}
      applyLease(data,generation);
      if(!data.session || !data.speech)throw error('speech_unavailable');
      s.SDK=SDK;
      media.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(generation===s.generation)stop('microphone_unavailable',true);},{once:true}));
      s.timer=setInterval(()=>renew(generation,id),5000);
      s.tick=setInterval(drawQuota,1000);
      await connectRecognizer(generation);
    }catch(e){
      if(generation!==s.generation)return;
      if(e.featureCode==='recognizer_replaced')return;
      stopTracks(media);
      const kind=e.featureCode || (e.name==='NotAllowedError' || e.name==='PermissionDeniedError' ? 'microphone_denied' : e.name==='NotFoundError' || e.name==='NotReadableError' ? 'microphone_unavailable' : 'speech_unavailable');
      stop(kind,true);
    }
  }
  function shell() {
    const root=s.root;if(!root)return;
    root.innerHTML='<section class="lt-screen" id="liveTranslateScreen"><div class="lt-top"><button type="button" class="lt-back" id="ltBack"></button><h2 id="ltTitle"></h2></div><div class="lt-target"><label for="ltTarget" id="ltTargetLabel"></label><select id="ltTarget"></select></div><section class="lt-panel" aria-labelledby="ltOriginalLabel"><div class="lt-panel-head"><span id="ltOriginalLabel"></span><span class="lt-detected" id="ltDetected"></span></div><div class="lt-transcript" id="ltOriginal" dir="auto"></div></section><section class="lt-panel lt-panel-target" aria-labelledby="ltTranslationLabel"><div class="lt-panel-head"><span id="ltTranslationLabel"></span><span id="ltTargetName"></span></div><div class="lt-transcript" id="ltTranslation" dir="auto"></div></section><div class="lt-controls"><button type="button" class="lt-mic" id="ltMic" aria-pressed="false"></button><button type="button" class="lt-clear" id="ltClear"></button></div><div class="lt-status" id="ltStatus" role="status" aria-live="polite"></div><div class="feature-quota" id="ltQuota"></div><button type="button" class="lt-restore" id="ltRestore" hidden></button><p class="lt-privacy" id="ltPrivacy"></p></section>';
    const select=node('ltTarget');
    Object.keys(FLAGS).forEach(code=>{const option=document.createElement('option');option.value=code;option.textContent=FLAGS[code]+' '+label(code);select.appendChild(option);});
    select.value=s.target;
    select.onchange=()=>{s.target=select.value;s.entries=[];s.draft=null;s.detected='';node('ltTargetName').textContent=FLAGS[s.target]+' '+label(s.target);drawText();};
    node('ltMic').onclick=()=>active()?stop():start();
    node('ltBack').onclick=()=>{stop();unmount();document.getElementById('tabNotebook')?.click();};
    node('ltClear').onclick=()=>{s.entries=[];s.draft=null;drawText();};
    const restore=node('ltRestore');
    restore.hidden=typeof window.getDigitalGoodsService!=='function';
    restore.onclick=async()=>{restore.disabled=true;try{const count=await F.restorePurchases();status(count?'restored':'noPurchases');}catch(e){status(e.featureCode || 'purchase_verification_unavailable',true);}finally{restore.disabled=false;}};
    refreshLocale();
  }
  function refreshLocale(){
    if(!s.root)return;
    const copy={ltBack:'back',ltTitle:'title',ltTargetLabel:'target',ltOriginalLabel:'original',ltTranslationLabel:'translation',ltClear:'clear',ltPrivacy:'privacy',ltRestore:'restore'};
    Object.keys(copy).forEach(id=>{if(node(id))node(id).textContent=F.text(copy[id]);});
    node('ltTarget')?.querySelectorAll('option').forEach(option=>{option.textContent=FLAGS[option.value]+' '+label(option.value);});
    if(node('ltTargetName'))node('ltTargetName').textContent=FLAGS[s.target]+' '+label(s.target);
    if(node('liveTranslateScreen'))node('liveTranslateScreen').dir=window.NATIVE_LANG==='ar'?'rtl':'ltr';
    drawText();
  }
  function unmount(){
    if(!s.root)return;
    if(active() || s.sessionId)stop();
    s.observer?.disconnect();s.observer=null;s.root=null;
    document.body.classList.remove('lt-focus');
  }
  function mount(root){
    if(s.root)unmount();
    s.root=root;s.target=FLAGS[window.NATIVE_LANG]?window.NATIVE_LANG:'tr';s.entries=[];s.draft=null;s.detected='';s.message='ready';s.error=false;s.providerConfigured=null;
    s.quota=F.getQuota();document.body.classList.add('lt-focus');shell();
    s.observer=new MutationObserver(()=>{if(s.root && (!s.root.querySelector('#liveTranslateScreen') || s.root.style.display==='none'))unmount();});
    s.observer.observe(root,{childList:true,attributes:true,attributeFilter:['style']});
    F.api('status').then(data=>{
      if(s.root!==root)return;
      s.quota=data.quota;s.providerConfigured=data.speechConfigured;
      if(!data.speechConfigured)status('speech_not_configured',true);else drawControls();
    }).catch(e=>{if(s.root===root)status(e.featureCode || 'usage_unavailable',true);});
  }
  F.subscribe(quota=>{if(s.root){s.quota=quota;drawQuota();}});
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && active()){holdScreen(s.generation);renew(s.generation,s.sessionId);}
  });
  window.addEventListener('pagehide',()=>{if(active() || s.sessionId)stop('paused',false,true);});
  window.addEventListener('offline',()=>{if(active())stop('speech_unavailable',true);});
  window.addEventListener('lumira:featureauthchange',()=>{if(s.root){stop('login_required',true);s.entries=[];s.draft=null;drawText();}});
  window.LUMIRA_LIVE={mount,unmount,refreshLocale,isMounted:()=>!!s.root,stop};
})();
