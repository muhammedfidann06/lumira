/* Azure → Gemini → Groq → Cloudflare → local. One microphone and account lease. */
(function () {
  'use strict';
  const F = window.LUMIRA_FEATURES;
  // Review link for testing the free engine without exhausting Azure first.
  // This changes only provider selection; server-side account limits remain.
  const LOCAL_TEST = new URLSearchParams(window.location.search).get('liveEngine') === 'local';
  const LOCALES = ['tr-TR','de-DE','en-US','ar-SA','fr-FR','es-ES','ru-RU'];
  const FLAGS = { tr:'🇹🇷', de:'🇩🇪', en:'🇬🇧', ar:'🇸🇦', fr:'🇫🇷', es:'🇪🇸', ru:'🇷🇺' };
  const browserRetryCopy={tr:'Tarayıcı motoruyla yeniden dene',en:'Retry with the browser engine',de:'Mit Browser-Erkennung erneut versuchen',ar:'أعد المحاولة باستخدام محرك المتصفح',fr:'Réessayer avec le moteur du navigateur',es:'Reintentar con el motor del navegador',ru:'Повторить с распознаванием браузера'};
  const s = { root:null, phase:'idle', generation:0, entries:[], draft:null, detected:'', source:'auto', target:'tr', quota:null, sessionId:null, recognizer:null, stream:null, inputStream:null, audio:null, observer:null, timer:null, deadlineTimer:null, tick:null, leaseDeadline:0, tokenDeadline:0, remainingAt:0, remaining:null, sdkPromise:null, SDK:null, speech:null, restartTimer:null, restartPending:false, restartAttempt:0, authRetries:0, cancelStart:null, wakeLock:null, message:'ready', error:false, renewPending:false, releasePromise:null, providerConfigured:null, provider:'', browser:null, textQueue:null, local:null, localProgress:null, localError:false, localArm:null, switching:null, pendingAudio:null, azureStartedAt:0, azureFailures:0, providers:[], failed:new Set(), cloud:null, cloudEpoch:0, lastResult:0, awaitingSince:0, sdkTask:null };
  const node = id => s.root?.querySelector('#' + id);
  s.microphoneId='';s.processing=true;s.inputPaint=0;
  async function inputDevices(){
    const host=s.root,select=node('ltInputDevice');if(!select||!navigator.mediaDevices?.enumerateDevices)return;
    try{const devices=await navigator.mediaDevices.enumerateDevices();if(s.root!==host||!select.isConnected)return;select.replaceChildren();const option=document.createElement('option');option.value='';option.textContent=window.LUMIRA_SOURCE.inputText(2);select.append(option);let number=0;for(const device of devices)if(device.kind==='audioinput'&&device.deviceId&&device.deviceId!=='default'){const row=document.createElement('option');row.value=device.deviceId;row.textContent=device.label||window.LUMIRA_SOURCE.inputText(1)+' '+(++number);select.append(row);}select.value=s.microphoneId;if(select.value!==s.microphoneId)s.microphoneId='';}catch{}
  }
  const active = () => ['starting','listening','reconnecting','preparing'].includes(s.phase);
  const providerError = e => ['speech_unavailable','speech_not_configured','speech_auth_error','speech_busy','speech_config_error','sdk_unavailable'].includes(e?.featureCode);
  const label = code => { const names = window.t && window.t('lang_names'); return (names && names[code]) || code.toUpperCase(); };
  const time = seconds => { seconds = Math.max(0, Math.ceil(seconds)); return Math.floor(seconds/60) + ':' + String(seconds % 60).padStart(2,'0'); };
  function error(code) { return Object.assign(new Error(code), { featureCode:code }); }
  function stopTracks(stream) { try { stream?.getTracks().forEach(track => track.stop()); } catch (e) {} }
  function status(message, bad) { s.message = message; s.error = !!bad; drawControls(); }
  async function captureReady(generation){
    if(!s.localArm)return;
    let timer;
    try{await Promise.race([s.localArm,new Promise((_,reject)=>{timer=setTimeout(()=>reject(error('capture_unavailable')),6000);})]);}
    catch{throw error('capture_unavailable');}
    finally{clearTimeout(timer);}
    if(generation!==s.generation||!active())throw error('recognizer_replaced');
  }
  function captureHealth(generation){
    if(generation!==s.generation||s.phase!=='listening'||!s.local||!s.providers.includes(s.provider)||!s.captureArmedAt)return;
    const now=performance.now();
    if(now-(s.lastAudioAt||s.captureArmedAt)<4000)return;
    if(!s.captureRecoveryAt){s.captureRecoveryAt=now;if(!s.local.recoverCapture?.())s.local.resumeCapture();return;}
    if(now-s.captureRecoveryAt<2000)return;
    s.captureUnavailable=true;s.providers.forEach(provider=>s.failed.add(provider));
    window.PWA?.logError?.({message:'Live capture: no_pcm_frames',stack:''});
    fallback(generation);
  }
  function drawControls() {
    if (!s.root) return;
    const button = node('ltMic'), select = node('ltTarget'), clear = node('ltClear'), statusBox = node('ltStatus');
    if (button) {
      button.textContent = F.text(active() ? 'stop' : 'start');
      button.setAttribute('aria-pressed', String(active()));
      button.disabled = false;
    }
    if (select && select.disabled!==active()) select.disabled = active();
    const source=node('ltSource');if(source&&source.disabled!==active())source.disabled=active();
    for(const id of['ltInputDevice','ltInputProcessing'])if(node(id))node(id).disabled=active();
    if(!active()&&node('ltInputFill'))node('ltInputFill').style.transform='scaleX(0)';
    for(const id of['ltInputLevel','ltInputHint'])if(node(id))node(id).hidden=s.provider==='browser'&&active();
    if (clear) clear.disabled = active() || (!s.entries.length && !s.draft);
    const browserRetry=node('ltBrowserRetry');if(browserRetry){browserRetry.hidden=!window.LUMIRA_BROWSER?.BrowserSession.supported()||!(s.error||s.failed.size);browserRetry.textContent=browserRetryCopy[window.NATIVE_LANG]||browserRetryCopy.en;}
    if (statusBox) { statusBox.textContent = F.text(s.message,{percent:s.localProgress?.percent || 0}); statusBox.className = 'lt-status' + (s.error ? ' is-error' : s.phase === 'listening' ? ' is-live' : ''); }
    const backup=node('ltBackup'), retry=node('ltBackupRetry'), backupBox=node('ltBackupBox');
    const showBackup=active() && (s.localError || (s.localProgress && !s.localProgress.ready));
    if(backupBox)backupBox.hidden=!showBackup;
    if(backup)backup.textContent=showBackup?F.text(s.localError?'local_backup_error':'local_downloading',{percent:s.localProgress?.percent || 0,mb:Math.ceil((s.localProgress?.total || 235000000)/1000000)}):'';
    if(retry){retry.hidden=!s.localError || !active() || s.provider!=='azure';retry.textContent=F.text('local_retry');}
    drawQuota();
  }
  function drawQuota() {
    const el = node('ltQuota');
    if (!el) return;
    if (!s.quota) { el.textContent = F.text('loading'); return; }
    const q = s.quota.live;
    if (q.limitSeconds === null) el.textContent = F.text('unlimited');
    else {
      const left = active() && s.sessionId && s.remaining !== null ? Math.max(0,s.remaining - (performance.now()-s.remainingAt)/1000) : q.remainingSeconds;
      el.textContent = F.text('live',{ time:time(left), limit:q.limitSeconds/60 });
    }
    el.title = F.text('reset',{date:new Date(q.resetsAt).toLocaleString(window.NATIVE_LANG || 'tr',{timeZone:q.timeZone})}) + ' (' + q.timeZone + ')';
  }
  function boundEntries(){
    for(const row of s.entries){row.original=typeof row.original==='string'?row.original.slice(-30000):'';row.translated=typeof row.translated==='string'?row.translated.slice(-30000):'';}
    let characters=s.entries.reduce((n,row)=>n+row.original.length+row.translated.length,0);
    while(s.entries.length>250 || (characters>60000 && s.entries.length>1)){const row=s.entries.shift();characters-=row.original.length+row.translated.length;}
  }
  // A queued translation fills the sentence rows that are already visible.
  // Batched rows keep their own originals; the last one carries the text.
  function applyTranslation(entry,translated){
    const rows=(entry.rows||(entry.row?[entry.row]:[])).filter(row=>s.entries.includes(row));
    if(rows.length)rows.forEach((row,i)=>{row.translated=i===rows.length-1?translated:(row.translated||'');});
    else s.entries.push({original:entry.original,translated});
  }
  let textFrame=0;const painted=new WeakMap();
  function drawText() {boundEntries();if(!textFrame)textFrame=requestAnimationFrame(()=>{textFrame=0;paintText();});}
  function paintText() {
    const original = node('ltOriginal'), translated = node('ltTranslation');
    if (!original || !translated) return;
    // One block per sentence: a new partial result re-lays out only the last
    // lines instead of re-rendering up to 60,000 characters on every update.
    const paint = (el, field, placeholder) => {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight-60;
      const lines = s.entries.map(e => e[field]).filter(Boolean), draft=s.draft?.[field]||'';
      let view=painted.get(el);
      if(!view||view.host!==el.firstChild&&view.lines.length){el.replaceChildren();view={lines:[],nodes:[],draft:null,empty:null,host:null};painted.set(el,view);}
      let same=0;while(same<view.lines.length&&same<lines.length&&view.lines[same]===lines[same])same++;
      for(const row of view.nodes.splice(same))row.remove();
      view.draft?.remove();view.draft=null;view.empty?.remove();view.empty=null;
      for(let i=same;i<lines.length;i++){const row=document.createElement('div');row.textContent=lines[i];el.appendChild(row);view.nodes.push(row);}
      view.lines=lines;view.host=view.nodes[0]||null;
      if(draft){view.draft=document.createElement('div');view.draft.className='lt-draft';view.draft.textContent=draft;el.appendChild(view.draft);}
      if(!lines.length&&!draft){view.empty=document.createElement('span');view.empty.className='lt-placeholder';view.empty.textContent=F.text(placeholder);el.appendChild(view.empty);}
      if (nearBottom) el.scrollTop = el.scrollHeight;
    };
    paint(original,'original','emptySource'); paint(translated,'translated','emptyTarget');
    const detected = node('ltDetected');
    if (detected){const language=s.source==='auto'?s.detected:s.source;detected.textContent=language?(FLAGS[language]||'🌐')+' '+label(language):F.text('auto');}
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
  async function initLocal(generation) {
    const Local=window.LUMIRA_LOCAL || await window.LUMIRA_LOCAL_READY;
    if(generation!==s.generation || !active())return;
    if(!Local || !(window.AudioContext || window.webkitAudioContext))return;
    try{
      const local=new Local({target:s.target,sourceLanguage:s.source,audioContext:s.pendingAudio,
        onAudio:(audio,position)=>{
          if(generation!==s.generation || !active())return;
          s.lastAudioAt=performance.now();s.captureRecoveryAt=0;s.audioFrames++;
          if(performance.now()-s.inputPaint>150){s.inputPaint=performance.now();let energy=0;for(const value of audio)energy+=value*value;const level=Math.min(1,Math.sqrt(energy/Math.max(1,audio.length))*5);const fill=node('ltInputFill');if(fill)fill.style.transform='scaleX('+level.toFixed(3)+')';}
          if(s.azureInput){
            const bytes=new ArrayBuffer(audio.length*2),view=new DataView(bytes);
            for(let i=0;i<audio.length;i++){const value=Math.max(-1,Math.min(1,audio[i]));view.setInt16(i*2,value<0?value*32768:value*32767,true);}
            try{s.azureInput.write(bytes);}catch{fallback(generation);}
          }
          s.cloud?.receive(audio,position);
          if(s.provider==='azure' && s.phase==='listening'){
            // Count only clearly voiced audio. Room noise boosted by automatic
            // gain passed the old 0.01 threshold and abandoned a healthy Azure
            // session after eight quiet seconds.
            let energy=0;for(const v of audio)energy+=v*v;
            if(Math.sqrt(energy/Math.max(1,audio.length))>.03)s.voicedSinceResult=(s.voicedSinceResult||0)+audio.length/16000;
            if(s.voicedSinceResult>12 && performance.now()-s.lastResult>20000){s.voicedSinceResult=0;window.PWA?.logError?.({message:'Live Azure: audio_without_transcript',stack:''});fallback(generation);}
          }
        },
        onProgress:progress=>{if(generation===s.generation){s.localProgress=progress;s.localError=false;drawControls();}},
        onResult:entry=>{
          if(generation!==s.generation || !active() || s.provider!=='local')return;
          s.entries.push({original:entry.original || '',translated:entry.translated || ''});
          s.detected=s.source==='auto'?entry.language:s.source;s.draft=null;status('local_listening');drawText();
        },
        onError:e=>{if(generation===s.generation && s.provider==='local')stop(e.featureCode || 'local_model_error',true);},
        onNotice:key=>{if(generation===s.generation && s.provider==='local')status(key);}
      });
      s.pendingAudio=null;s.local=local;
      s.localArm=local.arm(s.stream);
      s.localArm.then(()=>{if(generation===s.generation&&s.local===local)s.captureArmedAt=performance.now();},()=>{});
      s.localArm.catch(e=>{if(generation===s.generation){s.localError=true;window.PWA?.logError?.({message:'Live capture setup: '+String(e?.featureCode||e?.name||'failed').replace(/[^a-z_]/gi,'').slice(0,80),stack:''});drawControls();}});
    }catch(e){s.localError=true;window.PWA?.logError?.({message:'Live capture setup: '+String(e?.featureCode||e?.name||'failed').replace(/[^a-z_]/gi,'').slice(0,80),stack:''});drawControls();}
  }
  function warmLocal(generation) {
    if(!s.local || !['local','local-preparing'].includes(s.provider))return;
    s.local.prepare().catch(()=>{if(generation===s.generation){s.localError=true;drawControls();}});
  }
  function heartbeat(generation,id) {
    clearInterval(s.timer);clearInterval(s.tick);
    s.timer=setInterval(()=>renew(generation,id),5000);s.tick=setInterval(()=>{drawQuota();captureHealth(generation);},1000);
  }
  async function fallback(generation) {
    if(generation!==s.generation || !active() || s.provider==='local')return;
    if(s.switching)return s.switching;
    if(s.provider && !s.provider.endsWith('preparing'))s.failed.add(s.provider);
    if(s.azureRetryPlain){s.azureRetryPlain=false;s.failed.delete('azure');}
    s.switching=(async()=>{
      const current=()=>generation===s.generation && active();
      s.cloudEpoch++;s.cloud?.stop();s.cloud=null;s.textQueue?.stop();s.textQueue=null;
      await releaseRecognizer(true);
      if(!current())return;
      for(let index=0;index<s.providers.length;index++){
        const provider=s.providers[index];
        if(s.failed.has(provider))continue;
        s.provider=provider;s.phase='reconnecting';s.draft=null;s.awaitingSince=0;status('reconnecting');
        const epoch=++s.cloudEpoch;
        try {
          const data=await F.api('liveConnect',{id:s.sessionId,provider,target:s.target,source:s.source},{timeoutMs:6500});
          if(!current() || epoch!==s.cloudEpoch)return;
          if(provider==='azure'){
            s.SDK=await (s.sdkTask || sdk());
            if(!current())return;
            s.speech=data.speech;s.tokenDeadline=performance.now()+Math.max(0,data.speech.expiresAt-Date.now());
            await connectRecognizer(generation);
            if(s.failed.has('azure'))throw error('speech_unavailable');
          }else{
            if(!s.local || !window.LUMIRA_CLOUD)throw error('sdk_unavailable');
            await captureReady(generation);
            if(!current())return;
            const previous=s.entries.slice(-3), baseOriginal=previous.map(e=>e.original).join(' '), baseTranslation=previous.map(e=>e.translated).join(' ');
            let lastOriginal=baseOriginal,lastTranslation=baseTranslation,firstResult=true;
            const trim=(before,value,max)=>window.LUMIRA_LOCAL?.removeOverlap?.(before,value,max) ?? value;
            const cloud=new window.LUMIRA_CLOUD.CloudSession({provider,credential:data.credential,target:s.target,source:s.source,id:s.sessionId,entryId:s.sessionId+'-'+epoch,
              onResult:entry=>{
                if(!current() || s.cloud!==cloud || s.provider!==provider)return;
                if(entry.id){
                  let item=s.entries.find(e=>e.id===entry.id);
                  if(!item){item={id:entry.id,original:'',translated:''};s.entries.push(item);}
                  item.original=trim(baseOriginal,entry.original || '',50);item.translated=trim(baseTranslation,entry.translated || '',50);
                }else {
                  const original=trim(lastOriginal,entry.original || '',firstResult?50:12),translated=trim(lastTranslation,entry.translated || '',firstResult?50:12);
                  if(original || translated)s.entries.push({original,translated});
                  lastOriginal=entry.original || lastOriginal;lastTranslation=entry.translated || lastTranslation;firstResult=false;
                }
                if(s.source!=='auto')s.detected=s.source;else if(!entry.partial&&FLAGS[entry.language])s.detected=entry.language;
                s.draft=null;s.lastResult=performance.now();s.awaitingSince=0;drawText();
              },
              onCommit:position=>{if(current() && s.cloud===cloud)s.local?.markCommitted(position);},
              onError:e=>{
                if(!current() || s.cloud!==cloud)return;
                if(['login_required','live_limit','usage_unavailable'].includes(e.featureCode)){stop(e.featureCode,true);return;}
                if(e.featureCode==='cloud_rotate'){
                  cloud.stop();s.cloud=null;
                  // Normal timed session renewal is not exhausted credit.
                  if(s.switching)return;
                  s.provider='';fallback(generation);return;
                }
                if(s.switching){s.failed.add(provider);cloud.stop();return;}
                fallback(generation);
              }});
            s.cloud=cloud;
            await cloud.start();
            if(!current() || epoch!==s.cloudEpoch){cloud.stop();return;}
            if(s.failed.has(provider))throw error('speech_unavailable');
            // Replay only the recent uncommitted tail; memory stays bounded.
            const replay=s.local.recentAudio?.();
            if(replay?.length)for(let n=0;n<replay.length;n+=1600)cloud.receive(replay.subarray(n,n+1600),Math.max(0,s.local.position-(replay.length-n-1600)/16000));
            if(s.failed.has(provider)||cloud.closed||!cloud.ready)throw error('speech_unavailable');
            s.phase='listening';status('listening');holdScreen(generation);warmLocal(generation);
          }
          if(current())return;
        }catch(e){
          if(!current())return;
          if(['login_required','live_limit','usage_unavailable','live_already_active'].includes(e.featureCode))throw e;
          if(e.featureCode==='capture_unavailable'){s.captureUnavailable=true;s.providers.forEach(value=>s.failed.add(value));await releaseRecognizer(true);break;}
          s.failed.add(provider);s.cloud?.stop();s.cloud=null;
          await releaseRecognizer(true);
          // A rejected Azure setting during startup gets the same single retry.
          if(provider==='azure'&&s.azureRetryPlain&&current()){s.azureRetryPlain=false;s.failed.delete('azure');index--;}
        }
      }
      if(!current())return;
      if(window.LUMIRA_BROWSER?.BrowserSession.supported()){
        // Release cloud capture first. Running two microphone paths on iOS
        // can suspend recognition; the browser owns capture in this mode.
        s.local?.stop();s.local=null;s.localArm=null;stopTracks(s.stream);s.stream=null;
        if(s.pendingAudio){s.pendingAudio.close().catch(()=>{});s.pendingAudio=null;}
        const hint=s.detected||(typeof TARGET_LANG!=='undefined'?TARGET_LANG:'de');
        const source=s.source==='auto'?(FLAGS[hint]?hint:'de'):s.source;
        s.source=source;const select=node('ltSource');if(select){select.value=source;window.LUMIRA_LANGUAGE?.sync(select);}
        s.provider='browser';s.phase='listening';
        s.browser=new window.LUMIRA_BROWSER.BrowserSession({id:s.sessionId,source,target:s.target,
          onReady:()=>{if(current())status('browser_listening');},
          onDraft:text=>{if(current()){s.draft={original:text,translated:''};drawText();}},
          onFinal:text=>{if(!current())return null;const row={original:text,translated:''};s.entries.push(row);s.draft=null;s.detected=source;drawText();return row;},
          onResult:entry=>{if(current()){applyTranslation(entry,entry.translated);s.draft=null;s.detected=source;status('browser_listening');drawText();}},
          // A slow or exhausted text service keeps the recognized speech and
          // marks only its translation as pending; recognition keeps running.
          onError:(e,entry)=>{if(!current())return;if(entry&&!['login_required','live_limit','session_expired','maintenance'].includes(e.featureCode)){applyTranslation(entry,F.text('translation_pending'));drawText();status(e.featureCode==='free_text_limit'?'free_text_limit':'text_translation_unavailable',true);return;}stop(e.featureCode||'browser_speech_unavailable',true);}
        });s.browser.start();status('browser_listening');holdScreen(generation);return;
      }
      if(s.captureUnavailable)throw error('microphone_unavailable');
      if(!window.LUMIRA_LOCAL?.fallbackAllowed?.())throw error('browser_speech_unsupported');
      s.provider='local-preparing';s.phase='preparing';status('local_preparing');
      clearInterval(s.timer);clearTimeout(s.deadlineTimer);
      const oldId=s.sessionId;s.sessionId=null;
      const released=oldId?F.api('liveStop',{id:oldId}):Promise.resolve();released.catch(()=>{});
      if(!s.local)throw error('local_unsupported');
      await s.localArm;await s.local.prepare();await released;
      if(!current())return;
      const id=F.id();s.sessionId=id;
      const data=await F.api('liveStart',{id,provider:'local'});
      if(!current()){F.api('liveStop',{id}).catch(()=>{});return;}
      s.provider='local';s.tokenDeadline=Infinity;applyLease(data,generation);
      const previous=s.entries.slice(-3);
      s.local.start({original:previous.map(e=>e.original).join(' '),translated:previous.map(e=>e.translated).join(' ')});
      s.draft=null;s.phase='listening';status('local_listening');heartbeat(generation,id);holdScreen(generation);
    })().catch(e=>{if(generation===s.generation && active())stop(e.featureCode || 'speech_unavailable',true);})
      .finally(()=>{
        if(generation!==s.generation)return;
        s.switching=null;
        // A cancellation can arrive after the successful start callback but
        // before this switch settles. Its error handler marks the provider;
        // finish the pending failover instead of leaving a dead listener.
        if(active()&&s.failed.has(s.provider))queueMicrotask(()=>{
          if(generation===s.generation&&active()&&s.failed.has(s.provider))fallback(generation);
        });
      });
    return s.switching;
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
      // Never continue spending after the last server-authorized second.
      const exhausted=s.remaining!==null && s.remaining-(performance.now()-s.remainingAt)/1000<=.1;
      stop(exhausted?'live_limit':'usage_unavailable',true);
    },Math.max(0,wait));
    if (data.speech) {
      s.speech=data.speech;
      s.tokenDeadline=now+data.speech.expiresAt-data.quota.serverNow;
      if (s.recognizer && s.provider==='azure') s.recognizer.authorizationToken=data.speech.token;
    }
    if(s.provider==='local')s.local?.resume();
    drawQuota();
  }
  async function renew(generation, id) {
    if(!id || id!==s.sessionId || s.renewPending || generation!==s.generation || !active())return;
    s.renewPending=id;
    try {
      let data;
      // A hung request must not hold the heartbeat past the 15-second lease.
      try{data=await F.api('liveRenew',{id,provider:'local'},{timeoutMs:6000});}
      catch(e){if(generation!==s.generation || id!==s.sessionId || !active())return;if(e.featureCode!=='session_expired')throw e;data=await F.api('liveStart',{id,provider:'local'},{timeoutMs:6000});}
      if(generation!==s.generation || id!==s.sessionId || !active()){F.api('liveStop',{id}).catch(()=>{});return;}
      applyLease(data,generation);
      if(s.provider==='azure' && s.tokenDeadline-performance.now()<60000){
        const epoch=s.cloudEpoch;
        try {
          const token=await F.api('liveConnect',{id,provider:'azure',target:s.target,source:s.source},{timeoutMs:6500});
          if(generation===s.generation && epoch===s.cloudEpoch && s.provider==='azure'){
            s.speech=token.speech;s.tokenDeadline=performance.now()+token.speech.expiresAt-Date.now();
            if(s.recognizer)s.recognizer.authorizationToken=token.speech.token;
          }
        // The current token stays valid for up to a minute; later heartbeats
        // retry, and Azure is abandoned only when the token is about to expire.
        }catch(e){if(generation===s.generation && epoch===s.cloudEpoch && s.provider==='azure' && s.tokenDeadline-performance.now()<15000)fallback(generation);}
      }
    }catch(e){
      if(generation!==s.generation || id!==s.sessionId)return;
      // One slow or failed heartbeat used to end the whole lesson. Retry soon;
      // the lease timer still stops at the last server-authorized second.
      if(['login_required','live_limit','maintenance','live_already_active'].includes(e.featureCode)){stop(e.featureCode,true);return;}
      clearTimeout(s.renewRetry);s.renewRetry=setTimeout(()=>renew(generation,id),1500);
    }
    finally{if(s.renewPending===id)s.renewPending=false;}
  }
  function releaseRecognizer(keepMicrophone) {
    const r=s.recognizer,a=s.audio,input=s.inputStream,pcm=s.azureInput;
    s.recognizer=null;s.audio=null;s.inputStream=null;s.azureInput=null;
    try{pcm?.close();}catch{}
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
    if(generation!==s.generation || !active() || s.provider!=='azure' || s.restartPending || s.restartTimer || s.switching)return;
    if(performance.now()-s.azureStartedAt>30000)s.azureFailures=0;
    if(++s.azureFailures>2){fallback(generation);return;}
    s.restartPending=true;s.phase='reconnecting';s.draft=null;status('reconnecting');
    releaseRecognizer(true).then(()=>{
      if(generation!==s.generation || !active() || s.provider!=='azure')return;
      const delay=Math.min(5000,250*Math.pow(2,Math.min(s.restartAttempt++,5)));
      s.restartTimer=setTimeout(async()=>{
        s.restartTimer=null;s.restartPending=false;
        // A provider switch that began meanwhile owns the next recognizer.
        if(generation!==s.generation || !active() || s.provider!=='azure' || s.switching)return;
        if(s.leaseDeadline<=performance.now()){reconnect(generation);return;}
        try{await connectRecognizer(generation);}
        catch(e){if(generation===s.generation && active() && e.featureCode!=='recognizer_replaced')fallback(generation);}
      },delay);
    });
  }
  async function connectRecognizer(generation) {
    const SDK=s.SDK,media=s.stream,speech=s.speech;
    if(!SDK || !media || !speech || generation!==s.generation || !active() || s.provider!=='azure')throw error('recognizer_replaced');
    // Reuse the capture opened by Start's user gesture. In particular, iOS
    // must not create a second, suspended microphone AudioContext here.
    if(s.local && SDK.AudioInputStream?.createPushStream && SDK.AudioStreamFormat?.getWaveFormatPCM){
      await captureReady(generation);
      if(generation!==s.generation || !active() || s.provider!=='azure')throw error('recognizer_replaced');
      s.azureInput=SDK.AudioInputStream.createPushStream(SDK.AudioStreamFormat.getWaveFormatPCM(16000,16,1));
      s.audio=SDK.AudioConfig.fromStreamInput(s.azureInput);
    }else{
      s.inputStream=media.clone();s.audio=SDK.AudioConfig.fromStreamInput(s.inputStream);
    }
    const recognizer=window.LUMIRA_SOURCE.recognizer(SDK,speech,s.target,s.source,s.audio,{plain:s.azurePlain});
    s.recognizer=recognizer;s.voicedSinceResult=0;
    const captureStart=s.local?.position || 0;
    const current=()=>generation===s.generation && active() && s.provider==='azure' && s.recognizer===recognizer;
    const seen=new Set();
    if(recognizer.lumiraTranscriptOnly){s.textQueue?.stop();s.textQueue=new window.LUMIRA_TEXT.TextQueue({id:s.sessionId,target:s.target,
      onResult:entry=>{if(current()){applyTranslation(entry,entry.translated);drawText();}},
      onError:(e,entry)=>{if(current()){if(['login_required','live_limit','session_expired','maintenance'].includes(e.featureCode)){stop(e.featureCode,true);return;}if(entry)applyTranslation(entry,F.text('translation_pending'));status(e.featureCode||'text_translation_unavailable',true);drawText();}}
    });}
    function result(event,final){
      if(!current())return;
      const r=event?.result;
      if(!r || typeof r.text!=='string' || !r.text.trim() || r.text.length>4000 || (final && r.reason!==(recognizer.lumiraTranscriptOnly?SDK.ResultReason.RecognizedSpeech:SDK.ResultReason.TranslatedSpeech)))return;
      let locale=typeof r.language==='string'?r.language:'';
      if(!locale){try{locale=SDK.AutoDetectSourceLanguageResult.fromResult(r).language || '';}catch(e){}}
      if(!locale){try{locale=r.properties.getProperty(SDK.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult)||'';}catch(e){}}
      if(typeof locale!=='string')locale='';
      if(!locale || locale.startsWith('{')){
        try{
          const json=JSON.parse(locale.startsWith('{')?locale:(r.json || r.properties.getProperty(SDK.PropertyId.SpeechServiceResponse_JsonResult) || '{}'));
          locale=json.PrimaryLanguage?.Language || json.SpeechPhrase?.PrimaryLanguage?.Language || json.Language || '';
        }catch(e){locale='';}
      }
      if(typeof locale!=='string')locale='';
      const observed=locale.split('-')[0].toLowerCase();
      if(s.source!=='auto'&&FLAGS[observed]&&observed!==s.source)return;
      // NoMatch/empty events are not proof of a working transcription. They
      // must not keep resetting the silent-service watchdog indefinitely.
      s.lastResult=performance.now();s.azureResultAt=s.lastResult;s.awaitingSince=0;s.voicedSinceResult=0;
      const code=s.source==='auto'?observed:s.source;
      if(s.source!=='auto'||final){if(FLAGS[code])s.detected=code;}
      let translated='';try{translated=r.translations.get(s.target)||'';}catch(e){}
      if(!translated && code===s.target)translated=r.text;
      const entry={original:r.text.slice(0,4000),translated:typeof translated==='string'?translated.slice(0,4000):''};
      if(final){
        // Azure's translation resultId can be the same for a whole session.
        // Audio offsets, not resultId alone, distinguish successive sentences.
        const key=Number.isFinite(r.offset)?[r.resultId,r.offset,r.duration].join(':'):null;
        if(key && seen.has(key))return;
        if(key){seen.add(key);if(seen.size>512)seen.delete(seen.values().next().value);}
        // Show the recognized sentence at once; its translation fills in later.
        if(recognizer.lumiraTranscriptOnly&&FLAGS[code]){const row={original:entry.original,translated:''};s.entries.push(row);s.textQueue.add({original:entry.original,language:code,row});}else s.entries.push(entry);s.draft=null;s.restartAttempt=0;s.authRetries=0;s.azureFailures=0;
        if(Number.isFinite(r.offset) && Number.isFinite(r.duration))s.local?.markCommitted(captureStart+(r.offset+r.duration)/10000000);
      }else s.draft=entry;
      drawText();
    }
    recognizer.recognizing=(_,e)=>result(e,false);
    recognizer.recognized=(_,e)=>result(e,true);
    recognizer.speechStartDetected=()=>{if(current()&&!s.awaitingSince)s.awaitingSince=performance.now();};
    recognizer.canceled=(_,event)=>{if(current()){const raw=String(event?.errorDetails||'').toLowerCase(),code=Number(event?.errorCode),kind=/auth|401|403|subscription/.test(raw)?'authentication':/quota|429|limit/.test(raw)?'quota':/timeout/.test(raw)?'timeout':/websocket|connect|network|dns/.test(raw)?'connection':'service';window.PWA?.logError?.({message:'Live Azure canceled: '+String(event?.errorCode??event?.reason??'unknown')+' ('+kind+')'+(s.azurePlain?' plain':''),stack:''});
      recognizer.lumiraCanceled=true;
      // 2 = BadRequestParameters (socket 1007): the service rejected a request
      // setting. Retry Azure once with service defaults before falling back.
      if(code===2&&!s.azurePlain){s.azurePlain=true;s.azureRetryPlain=true;try{localStorage.setItem('lumira_live_azure_plain_v1','1');}catch{}}
      // A dropped connection after Azure already produced text is a network
      // blip, not a broken provider: reconnect instead of switching engines.
      else if((code===4||code===5||kind==='connection')&&s.azureResultAt>s.azureStartedAt&&!s.switching){s.cancelStart?.();reconnect(generation);return;}
      s.failed.add('azure');s.cancelStart?.();if(!s.switching)fallback(generation);}};
    recognizer.sessionStopped=()=>{if(current()&&!recognizer.lumiraCanceled)reconnect(generation);};
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
    if(current()){if(s.failed.has('azure'))throw error('speech_unavailable');s.azureStartedAt=performance.now();s.phase='listening';status('listening');holdScreen(generation);warmLocal(generation);}
  }
  function stop(message, bad, exiting) {
    if(bad){s.lastFailure={code:String(message||'speech_unavailable').replace(/[^a-z_]/gi,'').slice(0,80),provider:s.provider,phase:s.phase,at:Date.now()};window.PWA?.logError?.({message:'Live stopped ('+(s.provider||'starting')+'): '+s.lastFailure.code,stack:''});}
    const id=s.sessionId;
    ++s.generation;s.browser?.stop();s.browser=null;s.textQueue?.stop();s.textQueue=null;s.cloudEpoch++;s.cloud?.stop();s.cloud=null;s.sessionId=null;s.phase='idle';s.renewPending=false;s.draft=null;
    clearInterval(s.timer);clearInterval(s.tick);clearTimeout(s.deadlineTimer);clearTimeout(s.restartTimer);clearTimeout(s.renewRetry);
    s.restartTimer=null;s.restartPending=false;s.restartAttempt=0;s.authRetries=0;s.speech=null;s.azureFailures=0;s.provider='';s.switching=null;
    s.local?.stop();s.local=null;s.localArm=null;
    if(s.pendingAudio){s.pendingAudio.close().catch(()=>{});s.pendingAudio=null;}
    if(s.previousAudioSession!==undefined){try{if(navigator.audioSession)navigator.audioSession.type=s.previousAudioSession;}catch{}s.previousAudioSession=undefined;}
    if(s.wakeLock){s.wakeLock.release().catch(()=>{});s.wakeLock=null;}
    releaseRecognizer();
    if(id){
      if(exiting)F.releaseOnExit(id);
      else {
        s.releasePromise=F.api('liveStop',{id},{keepalive:true}).then(data=>{s.quota=data.quota;drawQuota();}).catch(()=>{}).finally(()=>{s.releasePromise=null;});
      }
    }
    status(message || 'stopped',bad);drawText();
    if(message==='live_limit')window.LUMIRA_ACCESS?.open('live_limit',s.quota);
  }
  async function start({browserOnly=false}={}) {
    if(active())return;
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia){status('browser_unsupported',true);return;}
    const generation=++s.generation,id=F.id();
    s.captureArmedAt=0;s.lastAudioAt=0;s.captureRecoveryAt=0;s.audioFrames=0;s.captureUnavailable=false;s.lastFailure=null;s.azureResultAt=0;s.voicedSinceResult=0;s.azureRetryPlain=false;
    try{s.azurePlain=localStorage.getItem('lumira_live_azure_plain_v1')==='1';}catch{s.azurePlain=false;}
    s.failed=new Set();s.providers=[];s.provider='';s.phase='starting';s.sessionId=id;s.draft=null;s.detected='';s.localProgress=null;s.localError=false;s.lastResult=performance.now();s.awaitingSince=0;status('starting');drawText();
    window.VOICE_stop?.();
    try{if(navigator.audioSession){s.previousAudioSession=navigator.audioSession.type;navigator.audioSession.type='play-and-record';}}catch{}
    const Audio=window.AudioContext || window.webkitAudioContext;
    // Use the device rate; the shared resampler supplies provider 16 kHz PCM.
    // Forcing a 16 kHz hardware graph can reject a desktop microphone input.
    if(Audio){try{s.pendingAudio=new Audio();}catch(e){}s.pendingAudio?.resume().catch(()=>{});}
    s.sdkTask=sdk();s.sdkTask.catch(()=>{});
    let media;
    try{
      media=await navigator.mediaDevices.getUserMedia({audio:{...(s.microphoneId?{deviceId:{ideal:s.microphoneId}}:{}),echoCancellation:s.processing,noiseSuppression:s.processing,autoGainControl:s.processing}});
      if(generation!==s.generation){stopTracks(media);return;}
      s.stream=media;
      inputDevices();
      if(s.releasePromise)await s.releasePromise;
      if(generation!==s.generation){stopTracks(media);return;}
      await initLocal(generation);
      if(generation!==s.generation)return;
      media.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(generation===s.generation)stop('microphone_unavailable',true);},{once:true}));
      const configured=await F.api('status');
      if(generation!==s.generation)return;
      s.providers=LOCAL_TEST||browserOnly?[]:(configured.providers || (configured.speechConfigured?['azure']:[])).flatMap(provider=>provider==='azure'?['azure',...(s.source==='auto'?[]:['azure-http'])]:provider==='gemini'?[...(s.source==='auto'?['gemini']:[]),'gemini-http']:[provider]);
      const data=await F.api('liveStart',{id,provider:'local'});
      if(generation!==s.generation){F.api('liveStop',{id}).catch(()=>{});return;}
      applyLease(data,generation);heartbeat(generation,id);
      await fallback(generation);
    }catch(e){
      if(generation!==s.generation)return;
      const kind=e.featureCode || (['NotAllowedError','PermissionDeniedError'].includes(e.name)?'microphone_denied':['NotFoundError','NotReadableError'].includes(e.name)?'microphone_unavailable':'speech_unavailable');
      window.PWA?.logError?.({message:'Live start: '+String(e.featureCode||e.name||'failed'),stack:''});
      stop(kind,true);
    }
  }
  function shell() {
    const root=s.root;if(!root)return;
    root.innerHTML='<section class="lt-screen" id="liveTranslateScreen"><div class="lt-top"><button type="button" class="lt-back" id="ltBack"></button><h2 id="ltTitle"></h2></div><div class="lt-source"><label for="ltSource" id="ltSourceLabel"></label><select id="ltSource" aria-describedby="ltSourceHint"></select><p id="ltSourceHint"></p></div><div class="lt-target"><label for="ltTarget" id="ltTargetLabel"></label><select id="ltTarget"></select></div><section class="lt-panel" aria-labelledby="ltOriginalLabel"><div class="lt-panel-head"><span id="ltOriginalLabel"></span><span class="lt-detected" id="ltDetected"></span></div><div class="lt-transcript" id="ltOriginal" dir="auto"></div></section><section class="lt-panel lt-panel-target" aria-labelledby="ltTranslationLabel"><div class="lt-panel-head"><span id="ltTranslationLabel"></span><span id="ltTargetName"></span></div><div class="lt-transcript" id="ltTranslation" dir="auto"></div></section><div class="lt-controls"><button type="button" class="lt-mic" id="ltMic" aria-pressed="false"></button><button type="button" class="lt-clear" id="ltClear"></button></div><div class="lt-status" id="ltStatus" role="status" aria-live="polite"></div><div class="feature-quota" id="ltQuota"></div><button type="button" class="lt-restore" id="ltRestore" hidden></button></section>';
    const backup=document.createElement('aside');backup.id='ltBackupBox';backup.className='lt-backup';backup.hidden=true;
    backup.innerHTML='<p id="ltBackup"></p><button type="button" class="lt-restore" id="ltBackupRetry" hidden></button>';
    node('liveTranslateScreen').append(backup);
    const browserRetry=document.createElement('button');browserRetry.type='button';browserRetry.className='lt-restore';browserRetry.id='ltBrowserRetry';browserRetry.hidden=true;browserRetry.onclick=()=>{if(active())stop();start({browserOnly:true});};node('liveTranslateScreen').append(browserRetry);
    const inputs=document.createElement('details');inputs.className='lt-input-options';inputs.innerHTML='<summary id="ltInputSummary"></summary><label for="ltInputDevice" id="ltInputLabel"></label><select id="ltInputDevice"></select><label><input type="checkbox" id="ltInputProcessing"><span id="ltInputProcessingLabel"></span></label><p id="ltInputHelp"></p><div class="lt-input-level" role="img" id="ltInputLevel"><span id="ltInputFill"></span></div><p id="ltInputHint"></p>';
    node('ltSource').closest('.lt-source').after(inputs);node('ltInputProcessing').checked=s.processing;
    node('ltInputDevice').onchange=()=>{s.microphoneId=node('ltInputDevice').value;try{localStorage.setItem('lumira_live_microphone_v1',s.microphoneId);}catch{}};
    node('ltInputProcessing').onchange=()=>{s.processing=node('ltInputProcessing').checked;try{localStorage.setItem('lumira_live_processing_v1',String(s.processing));}catch{}};inputDevices();
    node('ltBackupRetry').onclick=()=>{s.localError=false;drawControls();warmLocal(s.generation);};
    const source=node('ltSource'),automatic=document.createElement('option');automatic.value='auto';automatic.textContent=window.LUMIRA_SOURCE.text(1);source.append(automatic);
    Object.keys(FLAGS).forEach(code=>{const option=document.createElement('option');option.value=code;option.textContent=FLAGS[code]+' '+label(code);source.append(option);});source.value=s.source;
    source.onchange=()=>{const resume=active();if(resume)stop();s.source=window.LUMIRA_SOURCE.normalize(source.value);s.detected=s.source==='auto'?'':s.source;try{localStorage.setItem('lumira_live_source_v1',s.source);}catch{}drawText();if(resume)start();};
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
    for(const[id,index]of Object.entries({ltInputSummary:0,ltInputLabel:1,ltInputProcessingLabel:5,ltInputHelp:6,ltInputHint:4}))if(node(id))node(id).textContent=window.LUMIRA_SOURCE.inputText(index);node('ltInputLevel')?.setAttribute('aria-label',window.LUMIRA_SOURCE.inputText(3));
    node('ltSourceLabel').textContent=window.LUMIRA_SOURCE.text(0);node('ltSourceHint').textContent=window.LUMIRA_SOURCE.text(2);node('ltSource').querySelectorAll('option').forEach(option=>{option.textContent=option.value==='auto'?window.LUMIRA_SOURCE.text(1):FLAGS[option.value]+' '+label(option.value);});
    const copy={ltBack:'back',ltTitle:'title',ltTargetLabel:'target',ltOriginalLabel:'original',ltTranslationLabel:'translation',ltClear:'clear',ltRestore:'restore'};
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
    document.body.classList.remove('lt-focus');window.dispatchEvent(new Event('lumira:performancechange'));
  }
  function mount(root){
    if(s.root)unmount();
    try{s.microphoneId=localStorage.getItem('lumira_live_microphone_v1')||'';s.processing=localStorage.getItem('lumira_live_processing_v1')!=='false';}catch{s.microphoneId='';s.processing=true;}
    s.root=root;try{s.source=window.LUMIRA_SOURCE.normalize(localStorage.getItem('lumira_live_source_v1'));}catch{s.source='auto';}s.target=FLAGS[window.NATIVE_LANG]?window.NATIVE_LANG:'tr';s.entries=[];s.draft=null;s.detected='';s.message='ready';s.error=false;s.providerConfigured=null;
    s.quota=F.getQuota();document.body.classList.add('lt-focus');window.dispatchEvent(new Event('lumira:performancechange'));shell();
    s.observer=new MutationObserver(()=>{if(s.root && (!s.root.querySelector('#liveTranslateScreen') || s.root.style.display==='none'))unmount();});
    s.observer.observe(root,{childList:true,attributes:true,attributeFilter:['style']});
    F.api('status').then(data=>{
      if(s.root!==root)return;
      s.quota=data.quota;s.providerConfigured=(data.providers || []).length>0 || data.speechConfigured;
      drawControls();
    }).catch(e=>{if(s.root===root)status(e.featureCode || 'usage_unavailable',true);});
  }
  F.subscribe(quota=>{if(s.root){s.quota=quota;drawQuota();}});
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && active()){s.local?.resumeCapture();holdScreen(s.generation);renew(s.generation,s.sessionId);}
  });
  window.addEventListener('pagehide',()=>{if(active() || s.sessionId)stop('paused',false,true);});
  window.addEventListener('offline',()=>{if(active())stop('speech_unavailable',true);});
  window.addEventListener('lumira:featureauthchange',()=>{if(s.root){stop('login_required',true);s.entries=[];s.draft=null;drawText();}});
  window.LUMIRA_LIVE={mount,unmount,refreshLocale,isMounted:()=>!!s.root,isActive:active,stop,
    debug:()=>({phase:s.phase,provider:s.provider,failed:[...s.failed],source:s.source,target:s.target,audioFrames:s.audioFrames||0,lastAudioMs:s.lastAudioAt?Math.round(performance.now()-s.lastAudioAt):null,audioContext:s.local?.context?.state||s.pendingAudio?.state||null,captureMode:s.local?.captureMode||null,sampleRate:s.local?.context?.sampleRate||s.pendingAudio?.sampleRate||null,lastFailure:s.lastFailure||null})};
})();
