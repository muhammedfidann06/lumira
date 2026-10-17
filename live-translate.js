/* Continuous Azure speech translation. No browser SpeechRecognition fallback:
   the source language is actually detected from the microphone audio. */
(function () {
  'use strict';
  const F = window.LUMIRA_FEATURES;
  const LOCALES = ['tr-TR','de-DE','en-US','ar-SA','fr-FR','es-ES','ru-RU'];
  const FLAGS = { tr:'🇹🇷', de:'🇩🇪', en:'🇬🇧', ar:'🇸🇦', fr:'🇫🇷', es:'🇪🇸', ru:'🇷🇺' };
  const s = { root:null, phase:'idle', generation:0, entries:[], draft:null, detected:'', target:'tr', quota:null, sessionId:null, recognizer:null, stream:null, audio:null, observer:null, timer:null, deadlineTimer:null, tick:null, leaseDeadline:0, tokenDeadline:0, remainingAt:0, remaining:null, sdkPromise:null, message:'ready', error:false, renewPending:false, releasePromise:null, providerConfigured:null };
  const node = id => s.root?.querySelector('#' + id);
  const active = () => s.phase === 'starting' || s.phase === 'listening';
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
    s.deadlineTimer=setTimeout(() => stop(s.remaining !== null && s.remaining <= 16 ? 'live_limit' : 'session_expired',true),Math.max(0,wait));
    if (data.speech) {
      s.tokenDeadline=now+data.speech.expiresAt-data.quota.serverNow;
      if (s.recognizer) s.recognizer.authorizationToken=data.speech.token;
    }
    drawQuota();
  }
  async function renew(generation, id) {
    if (s.renewPending || generation !== s.generation || !active()) return;
    s.renewPending=true;
    try {
      const data=await F.api('liveRenew',{id,refreshToken:s.tokenDeadline-performance.now()<60000});
      if (generation !== s.generation || !active()) { F.api('liveStop',{id}).catch(()=>{}); return; }
      applyLease(data,generation);
    } catch (e) { if(generation===s.generation)stop(e.featureCode || 'speech_unavailable',true); }
    finally { if(generation===s.generation)s.renewPending=false; }
  }
  function releaseRecognizer() {
    const r=s.recognizer,a=s.audio;s.recognizer=null;s.audio=null;
    stopTracks(s.stream);s.stream=null;
    if (!r) {try{a?.close();}catch(e){}return;}
    let closed=false;
    const close=()=>{if(closed)return;closed=true;try{r.close();}catch(e){}try{a?.close();}catch(e){}};
    try{r.stopContinuousRecognitionAsync(close,close);}catch(e){close();}
    setTimeout(close,1500);
  }
  function stop(message, bad, exiting) {
    const id=s.sessionId;
    ++s.generation;s.sessionId=null;s.phase='idle';s.renewPending=false;s.draft=null;
    clearInterval(s.timer);clearInterval(s.tick);clearTimeout(s.deadlineTimer);
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
      const config=SDK.SpeechTranslationConfig.fromEndpoint(new URL('wss://'+data.speech.region+'.stt.speech.microsoft.com/speech/universal/v2'));
      config.authorizationToken=data.speech.token;
      config.speechRecognitionLanguage='en-US'; // Required placeholder; auto-detect supplies the actual language.
      config.setProperty(SDK.PropertyId.SpeechServiceConnection_LanguageIdMode,'Continuous');
      config.addTargetLanguage(s.target);
      const detect=SDK.AutoDetectSourceLanguageConfig.fromLanguages(LOCALES);
      s.audio=SDK.AudioConfig.fromStreamInput(media);
      const recognizer=SDK.TranslationRecognizer.FromConfig(config,detect,s.audio);
      s.recognizer=recognizer;
      const seen=new Set();
      function result(event,final){
        if(generation!==s.generation || !active())return;
        const r=event.result;
        if(!r || !r.text || (final && r.reason!==SDK.ResultReason.TranslatedSpeech))return;
        let locale='';
        try{locale=SDK.AutoDetectSourceLanguageResult.fromResult(r).language || '';}catch(e){}
        if(!locale){try{locale=r.properties.getProperty(SDK.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult)||'';}catch(e){}}
        const code=locale.split('-')[0];
        if(FLAGS[code])s.detected=code;
        let translated='';try{translated=r.translations.get(s.target)||'';}catch(e){}
        if(!translated && code===s.target)translated=r.text;
        const entry={original:r.text,translated};
        if(final){
          if(r.resultId && seen.has(r.resultId))return;
          if(r.resultId)seen.add(r.resultId);
          s.entries.push(entry);s.draft=null;
          if(s.entries.length>100)s.entries.shift();
        }else s.draft=entry;
        drawText();
      }
      recognizer.recognizing=(_,e)=>result(e,false);
      recognizer.recognized=(_,e)=>result(e,true);
      recognizer.canceled=()=>{if(generation===s.generation)stop('speech_unavailable',true);};
      recognizer.sessionStopped=()=>{if(generation===s.generation && active())stop('stopped');};
      media.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(generation===s.generation)stop('microphone_unavailable',true);},{once:true}));
      s.timer=setInterval(()=>renew(generation,id),5000);
      s.tick=setInterval(drawQuota,1000);
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(error('speech_unavailable')),10000);
        recognizer.startContinuousRecognitionAsync(()=>{clearTimeout(timeout);resolve();},()=>{clearTimeout(timeout);reject(error('speech_unavailable'));});
      });
      if(generation!==s.generation)return;
      s.phase='listening';status('listening');
    }catch(e){
      stopTracks(media);
      if(generation!==s.generation)return;
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
  document.addEventListener('visibilitychange',()=>{if(document.hidden && active())stop('paused');});
  window.addEventListener('pagehide',()=>{if(active() || s.sessionId)stop('paused',false,true);});
  window.addEventListener('offline',()=>{if(active())stop('speech_unavailable',true);});
  window.addEventListener('lumira:featureauthchange',()=>{if(s.root){stop('login_required',true);s.entries=[];s.draft=null;drawText();}});
  window.LUMIRA_LIVE={mount,unmount,refreshLocale,isMounted:()=>!!s.root,stop};
})();
