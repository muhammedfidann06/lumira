/* ================================================================
   PROGRESS.JS - "Kişisel Mod": isme özel ilerleme takibi (v2)
   - Bir kelime quiz'de doğru cevaplanınca bilindiği varsayılır, bir
     daha normal çalışmada karşımıza çıkmaz (self-report yalanı yok).
   - Çalışmaya Başla: aynı kategoriden 10 kelime -> kart (tanışma) ->
     yazılı quiz -> dinleme quizi. İki turda da doğruysa bilinir;
     yanlışsa bir sonraki değil ondan sonraki oturumda tekrar çıkar.
   - Genel Tekrar: seviye grubunda (A1-A2/B1-B2) bilinen kelimeleri
     tekrar sorar; yanlışsa bilinmiyor listesine geri düşer.
   - Görevler + XP sistemi, günlük tekrar kuyruğu (dün öğrenilenler).
================================================================ */
(function(){

  const BADGE_THRESHOLDS = [50, 100, 250, 500, 1000];
  const PM_FLAGS = { de:'🇩🇪', en:'🇬🇧', ar:'🇸🇦', fr:'🇫🇷', es:'🇪🇸', ru:'🇷🇺', tr:'🇹🇷' };
  const DEFAULT_DAILY_GOAL = 100;
  const BATCH_SIZE = 10;
  const RETRY_SESSION_GAP = 1; // 1: hemen bir sonraki oturumu atlar, ondan sonraki oturumda tekrar çıkar
  const XP_PER_NEW_WORD = 5;
  const TASK_XP = { t1:25, t2:100, t3:300, t5:200 };
  const TASK5_SECONDS = 60*60;
  /* Personal modülünde kalan kısa yardımcı metinler I18N'in ana akışından
     bağımsız render edilir. Native arayüz dili değiştiğinde karışık dil
     bırakmamak için bu kısa metinler de aynı seçime bağlanır. */
  const PM_COPY = {
    tr:{ weakDesc:'En çok yanlış yaptığın kelimeler', fillPlaceholder:'Buraya yaz…', nextWord:'Sonraki Kelime' },
    en:{ weakDesc:'Words you miss most often', fillPlaceholder:'Type your answer…', nextWord:'Next Word' },
    de:{ weakDesc:'Wörter, bei denen du am häufigsten Fehler machst', fillPlaceholder:'Hier schreiben…', nextWord:'Nächstes Wort' },
    ar:{ weakDesc:'الكلمات التي تخطئ فيها غالبًا', fillPlaceholder:'اكتب هنا…', nextWord:'الكلمة التالية' },
    fr:{ weakDesc:'Les mots que tu rates le plus souvent', fillPlaceholder:'Écris ici…', nextWord:'Mot suivant' },
    es:{ weakDesc:'Palabras que más sueles fallar', fillPlaceholder:'Escribe aquí…', nextWord:'Siguiente palabra' },
    ru:{ weakDesc:'Слова, в которых ты чаще всего ошибаешься', fillPlaceholder:'Напиши здесь…', nextWord:'Следующее слово' }
  };
  function pmCopy(key, fallback){
    const lang = window.NATIVE_LANG || 'tr';
    return (PM_COPY[lang] && PM_COPY[lang][key]) || fallback;
  }
  const FOCUS_COPY = {
    tr:['Bugün ne çalışalım?','Çalışma kategorisi','Tüm kategoriler','Seçtiğin kategorideki bilmediğin kelimelerle çalış. Dil ve seviye seçimin de uygulanır.','Çalışılacak kelime: {n}','Bu kategori ve seviyede bilmediğin kelime kalmadı. Başka bir kategori veya seviye seçebilirsin.'],
    en:['What shall we study today?','Study category','All categories','Study words you do not know in your chosen category. Your language and level filters also apply.','Words to study: {n}','You know all the words in this category and level. Choose another category or level.'],
    de:['Was lernen wir heute?','Lernkategorie','Alle Kategorien','Lerne unbekannte Wörter aus deiner gewählten Kategorie. Sprache und Niveau werden ebenfalls berücksichtigt.','Wörter zum Lernen: {n}','Du kennst alle Wörter dieser Kategorie und dieses Niveaus. Wähle eine andere Kategorie oder ein anderes Niveau.'],
    ar:['ماذا نتعلم اليوم؟','فئة الدراسة','جميع الفئات','تدرّب على الكلمات التي لا تعرفها من الفئة المختارة. تُطبّق أيضًا اللغة والمستوى اللذان اخترتهما.','كلمات للدراسة: {n}','تعرف جميع الكلمات في هذه الفئة وهذا المستوى. اختر فئة أو مستوى آخر.'],
    fr:['Qu’allons-nous apprendre aujourd’hui ?','Catégorie à étudier','Toutes les catégories','Étudie les mots que tu ne connais pas dans la catégorie choisie. Tes filtres de langue et de niveau s’appliquent aussi.','Mots à étudier : {n}','Tu connais tous les mots de cette catégorie et de ce niveau. Choisis une autre catégorie ou un autre niveau.'],
    es:['¿Qué estudiamos hoy?','Categoría de estudio','Todas las categorías','Estudia las palabras que aún no conoces de la categoría elegida. También se aplican tus filtros de idioma y nivel.','Palabras para estudiar: {n}','Ya conoces todas las palabras de esta categoría y nivel. Elige otra categoría u otro nivel.'],
    ru:['Что будем учить сегодня?','Категория для изучения','Все категории','Изучай незнакомые слова из выбранной категории. Выбранные язык и уровень также учитываются.','Слов для изучения: {n}','Ты знаешь все слова этой категории и уровня. Выбери другую категорию или уровень.']
  };
  const focusText = (index,n)=>(FOCUS_COPY[window.NATIVE_LANG] || FOCUS_COPY.en)[index].replace('{n}',String(n??''));


  let currentName = '';
  let currentKey = '';
  let userLoadRun = 0;
  let dataLoaded = false;
  let wordProgress = {};
  let meta = null;
  /* Kullanıcı Yazma Pratiği ekranlarındayken, arka planda geç gelen bir
     kimlik doğrulama/isim olayı (LB_onNameReady) onu sessizce Ana Sayfa'ya
     ATMASIN ve bu sırada üst dil kutusunu tekrar göstermesin diye. */
  let pmInWritingFlow = false;
  let pmInStoryFlow = false;

  let batch = [];
  let batchResult = {};
  let cardIdx = 0, quizIdx = 0, listenIdx = 0, fillIdx = 0;
  let quizOrder = [], listenOrder = [], fillOrder = [];
  let sessionStats = { total:0, correct:0, wrong:0, xp:0, newKnown:0, newBadges:[], mistakes:[] };
  let currentAnswered = false;
  let reviewMode = null;

  const root = document.getElementById('personalView');

  function sanitizeKeyFallback(name){
    return String(name).trim().toLowerCase().replace(/\s+/g,'_').slice(0,20).replace(/[.#$\/\[\]]/g,'_');
  }
  function getKey(name){
    return (window.LB_sanitizeKey ? window.LB_sanitizeKey(name) : sanitizeKeyFallback(name));
  }
  function dbRef(path){
    const db = window.LB_getDb ? window.LB_getDb() : null;
    return db ? db.ref(path) : null;
  }
  function safeLocalGet(k){
    try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
  }
  function safeLocalSet(k, val){
    if(window.LUMIRA_CLEARING_DATA)return;
    try{ localStorage.setItem(k, JSON.stringify(val)); }catch(e){}
  }
  function todayStr(){
    const d = new Date();
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }
  function dayDiff(a,b){
    const da = new Date(a+'T00:00:00');
    const db_ = new Date(b+'T00:00:00');
    return Math.round((db_-da)/86400000);
  }
  function defaultMeta(){
    return {
      xp:0, streak:0, lastStudyDate:null, todayDate:null, todayCount:0,
      dailyGoal:DEFAULT_DAILY_GOAL, badges:{}, dailyCounts:{},
      studySessionCount:0,
      tasksDate:null, tasks:{t1:false,t2:false,t3:false,t4:false,t5:false},
      lastDueCount:0
    };
  }
  function wordKeyFor(v){ return window.LUMIRA_VOCAB_ID.key(v); }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }
  function pmSpeak(text, langCode, slow){
    if(typeof soundOn !== 'undefined' && !soundOn) return;
    try{
      if(slow && typeof speakSlow === 'function'){ speakSlow(text, langCode); return; }
      if(typeof speak === 'function'){ speak(text, langCode); return; }
    }catch(e){}
  }

  // Firebase'den gelen kelime kayıtlarını, hafızadaki (henüz Firebase'e
  // ulaşmamış olabilecek) daha taze ilerlemenin ÜZERİNE KÖRÜ KÖRÜNE
  // YAZMAK yerine, her kelime için hangi kayıt daha güncelse (lastSeen'e
  // göre) onu koruyarak birleştirir. Bu, "bilinen kelimeler sıfırlandı"
  // hatasının kök nedenini (loadUserData'nın tekrar tetiklenip henüz
  // senkronize olmamış Firebase verisiyle hafızayı ezmesi) engeller.
  function mergeWordProgress(localWords, remoteWords){
    const merged = Object.assign({}, remoteWords || {});
    Object.keys(localWords || {}).forEach(key=>{
      const l = localWords[key];
      const r = merged[key];
      if(!r){ merged[key] = l; return; }
      const lTime = l.lastSeen || 0;
      const rTime = r.lastSeen || 0;
      // Eşitlik durumunda (ör. iki tarafta da lastSeen yoksa) yerelde
      // "known" varsa onu koru — veri kaybını asla tercih etme.
      if(lTime > rTime || (lTime === rTime && l.known && !r.known)){
        merged[key] = l;
      }
    });
    return merged;
  }

  function mergeRemoteBadges(target,remote){
    target=target||{};
    if(remote && remote.awards)target.awards=Object.assign({},target.awards||{},remote.awards);
    if(remote && remote.supportGrants)target.supportGrants=remote.supportGrants;else delete target.supportGrants;
    return target;
  }
  let badgeRef=null,badgeListener=null;
  function watchRemoteAwards(){
    if(badgeRef && badgeListener)badgeRef.off('value',badgeListener);
    const key=currentKey;badgeRef=dbRef('progress/'+key+'/meta/awards');
    if(!badgeRef)return;
    let lastSignature=JSON.stringify(meta?.awards||{});
    const listener=function(snap){
      if(currentKey!==key || badgeListener!==listener)return;
      const value=snap.val()||{},signature=JSON.stringify(value);if(signature===lastSignature)return;lastSignature=signature;
      meta=mergeRemoteBadges(meta,{awards:value,supportGrants:meta?.supportGrants});persistLocalMirror();refreshBadges();
    };
    badgeListener=listener;
    badgeRef.on('value',badgeListener,function(){});
  }
  function refreshBadges(){
    const tab=document.getElementById('tabPersonal');
    if(dataLoaded && tab?.classList.contains('active') && root?.querySelector('.pm-sup-grid'))renderHome();
  }
  window.PR_refreshBadges=refreshBadges;
  function loadUserData(name, cb){
    const run=++userLoadRun;
    currentName = name;
    currentKey = getKey(name);
    const accountKey=currentKey;
    const stillCurrent=()=>run===userLoadRun&&currentKey===accountKey;
    dataLoaded = false;
    const local = safeLocalGet('pm_data_'+currentKey);
    const localWords = (local && local.words) ? local.words : {};
    const localMeta = (local && local.meta) ? local.meta : null;
    wordProgress = localWords;
    meta = localMeta;

    const ref = dbRef('progress/'+currentKey);
    if(ref){
      ref.once('value').then(snap=>{
        if(!stillCurrent())return;
        const val = snap.val();
        if(val){
          if(val.words) wordProgress = mergeWordProgress(localWords, val.words);
          // meta için de veri kaybını önle: hangi taraf daha ilerideyse
          // (xp daha yüksekse) onu esas al; xp yoksa/eşitse yereli koru.
          if(val.meta){
            const localXp = (localMeta && localMeta.xp) || 0;
            const remoteXp = val.meta.xp || 0;
            meta = mergeRemoteBadges((remoteXp >= localXp) ? val.meta : localMeta,val.meta);
          }
        }
        finalizeLoad(cb);
      }).catch(()=>{if(stillCurrent())finalizeLoad(cb);});
    } else {
      finalizeLoad(cb);
    }
  }
  function finalizeLoad(cb){
    wordProgress = wordProgress || {};
    VOCAB.forEach(getRecord);
    for(const [key,record] of Object.entries(wordProgress)) if(record && record._legacyKey && record._legacyKey !== key) delete wordProgress[record._legacyKey];
    meta = Object.assign(defaultMeta(), meta || {});
    if(!meta.tasks) meta.tasks = {t1:false,t2:false,t3:false,t4:false,t5:false};
    ensureDailyRollover();
    persistLocalMirror();
    dataLoaded = true;
    watchRemoteAwards();
    // Bu oturumda hiç XP kazanılmasa bile (ör. kullanıcı sadece göz atıyor),
    // seviye liderlik tablosunun güncel kalması için mevcut XP'yi bildir.
    if(window.LB_updateXp) window.LB_updateXp(meta.xp||0);
    if(cb) cb();
  }
  let mirrorTimer=0,mirrorPending=null;
  function flushLocalMirror(){clearTimeout(mirrorTimer);mirrorTimer=0;const pending=mirrorPending;mirrorPending=null;if(pending)safeLocalSet(pending.key,{words:pending.words,meta:pending.meta});}
  function persistLocalMirror(){
    const key='pm_data_'+currentKey;if(mirrorPending&&mirrorPending.key!==key)flushLocalMirror();
    mirrorPending={key,words:wordProgress,meta};clearTimeout(mirrorTimer);mirrorTimer=setTimeout(flushLocalMirror,250);
  }
  window.addEventListener('pagehide',flushLocalMirror);
  window.addEventListener('lumira:storagepause',()=>{clearTimeout(mirrorTimer);mirrorTimer=0;mirrorPending=null;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flushLocalMirror();});
  function persistMeta(){
    persistLocalMirror();
    const ref = dbRef('progress/'+currentKey+'/meta');
    if(ref){
      /* Sunucudaki XP bu cihazınkinden yüksekse (başka bir cihazda çalışılmış
         ya da yöneticiden XP gelmişse) onu EZMEYELİM: önce yükseğe hizalanıp
         öyle yazıyoruz. Aksi hâlde iki cihaz birbirinin değerini sürekli geri
         alıyor ve sıralama oynuyordu. */
      ref.transaction(function(cur){
        var remoteXp = (cur && typeof cur.xp === 'number') ? cur.xp : 0;
        if(remoteXp > (meta.xp||0)) meta.xp = remoteXp;
        // Remote tombstones keep an old device from restoring removed badges.
        meta=mergeRemoteBadges(meta,cur);
        /* İlk kayıt zamanı bir kez yazılır, bir daha değişmez — ileride
           "ilk N kişi" gibi kayıt-sırası bazlı işler için gerekli. */
        meta.joinedAt = (cur && cur.joinedAt) ? cur.joinedAt : Date.now();
        return meta;
      }, function(){ persistLocalMirror(); }, false).catch(error=>{persistLocalMirror();window.PWA?.logError?.({message:'Firebase progress_meta: '+String(error?.code||error?.message||'write_failed').replace(/[^a-z_]/gi,'').slice(0,80),stack:''});});
    }
    // Seviye liderlik tablosu 'leaderboard/{uid}/xp' alanını okur; her meta
    // kaydında (görev tamamlama, XP kazanma, oturum bitişi vb.) burayı da
    // güncel tutuyoruz ki ayrı bir okuma yapmadan tek dinleyiciyle hem süre
    // hem seviye sıralaması hesaplanabilsin.
    if(window.LB_updateXp) window.LB_updateXp(meta.xp||0);
  }
  function ensureDailyRollover(){
    const t = todayStr();
    if(meta.todayDate !== t){ meta.todayDate = t; meta.todayCount = 0; }
    if(meta.tasksDate !== t){ meta.tasksDate = t; meta.tasks = {t1:false,t2:false,t3:false,t4:false,t5:false}; meta.todayActiveSeconds = 0; }
  }
  function markStudyToday(){
    const t = todayStr();
    if(meta.lastStudyDate !== t){
      const diff = meta.lastStudyDate ? dayDiff(meta.lastStudyDate, t) : null;
      meta.streak = (diff === 1) ? (meta.streak||0)+1 : 1;
      meta.lastStudyDate = t;
    }
    meta.dailyCounts = meta.dailyCounts || {};
    meta.dailyCounts[t] = (meta.dailyCounts[t]||0) + 1;
    const keys = Object.keys(meta.dailyCounts).sort();
    while(keys.length > 30){ delete meta.dailyCounts[keys.shift()]; }
  }
  function checkBadges(){
    const known = Object.values(wordProgress).filter(r=>r.known).length;
    BADGE_THRESHOLDS.forEach(t=>{
      if(known>=t && !(meta.badges && meta.badges[t])){
        meta.badges = meta.badges || {};
        meta.badges[t] = true;
        sessionStats.newBadges.push(t);
        showToast(window.t ? window.t('toast_badge_earned')(t) : ('Rozet kazandın: '+t+' kelime öğrenildi!'));
      }
    });
    checkStreakAwards();
  }
  /* Seri (streak) kilometre taşı başarımları → meta.awards (özel rozetlerle aynı yer) */
  function checkStreakAwards(){
    const s = meta.streak||0;
    const STREAK_AWARDS = [[3,'🔥','3 Gün Seri'],[7,'⚡','7 Gün Seri'],[14,'🌙','14 Gün Seri'],
                           [30,'🏅','30 Gün Seri'],[60,'💎','60 Gün Seri'],[100,'👑','100 Gün Seri']];
    meta.awards = meta.awards || {};
    STREAK_AWARDS.forEach(a=>{
      const key = 'streak'+a[0];
      if(s>=a[0] && !meta.awards[key]){
        meta.awards[key] = { e:a[1], n:a[2], ts:Date.now() };
        const dispName = window.t ? window.t('streak_award')(a[0]) : a[2];
        showToast((window.t ? window.t('achievement_unlocked') : 'Başarım açıldı:')+' '+dispName+' 🎉');
      }
    });
  }
  function addXp(amount, reason){
    if(amount <= 0) return;
    meta.xp = (meta.xp||0) + amount;
    if(reason) showToast('+'+amount+' XP - '+reason);
  }
  function showToast(msg){
    let layer = document.getElementById('pmToastLayer');
    if(!layer){
      layer = document.createElement('div');
      layer.id = 'pmToastLayer';
      layer.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
      document.body.appendChild(layer);
    }
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'background:linear-gradient(135deg,#1a1235,#0a0715);border:1px solid rgba(79,232,255,0.6);color:#eef4ff;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:700;box-shadow:0 6px 22px rgba(0,0,0,0.4),0 0 18px rgba(79,232,255,0.3);opacity:0;transform:translateY(-8px);transition:opacity .35s ease, transform .35s ease;';
    layer.appendChild(t);
    requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateY(0)'; });
    setTimeout(()=>{
      t.style.opacity='0'; t.style.transform='translateY(-8px)';
      setTimeout(()=>t.remove(), 400);
    }, 3200);
  }
  function getRecord(v){
    const key=wordKeyFor(v), old=window.LUMIRA_VOCAB_ID.legacy(v);
    // Migrate only a legacy key that identified one word. Collided historical
    // records cannot honestly be attributed to every Arabic/Cyrillic word.
    if(key !== old && wordProgress[old] && window.LUMIRA_VOCAB_ID.unambiguous(v,VOCAB)){
      if(!wordProgress[key]) wordProgress[key]=Object.assign({},wordProgress[old]);
      wordProgress[key]._legacyKey=old;
      delete wordProgress[old];
    }
    return wordProgress[key] || null;
  }

  function checkThresholdTasks(){
    const t = meta.todayCount||0;
    if(t>=10 && !meta.tasks.t1){ meta.tasks.t1 = true; addXp(TASK_XP.t1, window.t?window.t('toast_task_10'):'Görev: bugün 10 yeni kelime'); }
    if(t>=50 && !meta.tasks.t2){ meta.tasks.t2 = true; addXp(TASK_XP.t2, window.t?window.t('toast_task_50'):'Görev: bugün 50 yeni kelime'); }
    if(t>=100 && !meta.tasks.t3){ meta.tasks.t3 = true; addXp(TASK_XP.t3, window.t?window.t('toast_task_100'):'Görev: bugün 100 yeni kelime'); }
  }
  let _t5SessionBaseline = 0; /* bu sayfa yüklemesinde en son okunan oturum süresi (yinelemeyi önlemek için) */
  function checkTask5(){
    ensureDailyRollover();
    if(meta.tasks.t5) return;
    /* DÜZELTME: eskiden var olmayan window.APP_getActiveSeconds çağrılıyordu,
       bu yüzden süre her zaman 0 okunup görev asla tamamlanamıyordu. Doğru
       fonksiyon window.LB_getActiveSeconds (leaderboard.js). Ayrıca artık
       tek bir oturuma bağlı değil — GÜNLÜK toplam aktif süreye göre çalışır:
       uygulamayı gün içinde birden çok kez açıp kapatsa bile birikir. */
    const sessionSecs = (window.LB_getActiveSeconds ? window.LB_getActiveSeconds() : 0);
    const delta = Math.max(0, sessionSecs - _t5SessionBaseline);
    _t5SessionBaseline = sessionSecs;
    if(delta > 0){
      meta.todayActiveSeconds = (meta.todayActiveSeconds||0) + delta;
    }
    if((meta.todayActiveSeconds||0) >= TASK5_SECONDS){
      meta.tasks.t5 = true; addXp(TASK_XP.t5, window.t?window.t('toast_task_60min'):'Görev: günde 60dk çalışma');
      persistMeta();
    }
  }
  function awardTask4(reviewedCount){
    if(meta.tasks.t4 || reviewedCount<=0) return;
    meta.tasks.t4 = true;
    addXp(reviewedCount*2, window.t?window.t('toast_task_daily_review'):'Görev: günlük tekrarı tamamla');
  }

  function levelGroups(){
    const levels = LANGS[activeLang].levels;
    const groups = [];
    for(let i=0;i<levels.length;i+=2){
      const chunk = levels.slice(i, i+2);
      groups.push({ name: chunk.join('-'), levels: chunk });
    }
    return groups;
  }

  function poolForActiveLang(){ return (window.basePool ? window.basePool() : VOCAB.filter(v => v.lang === activeLang)); }
  function poolForActiveFilter(){
    return (activeLevel === 'TUMU' || activeLevel === 'TÜMÜ') ? poolForActiveLang() : poolForActiveLang().filter(v=>v.level===activeLevel);
  }
  // Keep this preference local to the account and language pair. It must not
  // change statistics, saved progress, placement tests or review queues.
  function studyCategoryKey(){return 'pm_category_'+currentKey+'_'+(window.NATIVE_LANG || 'tr')+'_'+(window.TARGET_LANG || activeLang);}
  function studyCategory(){
    const saved=safeLocalGet(studyCategoryKey());
    return typeof saved==='string' && poolForActiveLang().some(v=>v.cat===saved) ? saved : '';
  }
  function studyPool(){
    const category=studyCategory(),pool=poolForActiveFilter();
    return category ? pool.filter(v=>v.cat===category) : pool;
  }
  function knownCountIn(list){
    return list.filter(v=>{ const r=getRecord(v); return r && r.known; }).length;
  }
  function totalStudiedCount(){
    return Object.values(wordProgress).filter(r=>(r.seen||0) > 0).length;
  }
  function accuracyOverall(){
    let c=0,w=0;
    Object.values(wordProgress).forEach(r=>{ c+=r.correct||0; w+=r.wrong||0; });
    const tot = c+w;
    return tot>0 ? Math.round((c/tot)*100) : null;
  }
  function categoryAccuracy(){
    const byCat = {};
    Object.values(wordProgress).forEach(r=>{
      const cat = r.cat || '-';
      byCat[cat] = byCat[cat] || {c:0,w:0};
      byCat[cat].c += r.correct||0; byCat[cat].w += r.wrong||0;
    });
    let best=null,worst=null;
    Object.keys(byCat).forEach(cat=>{
      const tot = byCat[cat].c+byCat[cat].w;
      if(tot < 3) return;
      const acc = byCat[cat].c/tot;
      if(!best || acc>best.acc) best = {cat, acc};
      if(!worst || acc<worst.acc) worst = {cat, acc};
    });
    return {best, worst};
  }
  // ESKİ (dahili) mekanik: bir çalışma oturumunda yanlış yapılan kelimeler,
  // bir sonraki oturumu atlayıp ondan sonraki oturumda normal çalışma
  // havuzuna geri döner. Bu, kullanıcıya AYRI bir "kuyruk" olarak GÖSTERİLMEZ,
  // sadece pickBatch() içinde sessizce çalışır.
  function sessionRetryDueWords(){
    const pool = poolForActiveFilter();
    const out = [];
    pool.forEach(v=>{
      const r = getRecord(v);
      if(r && !r.known && r.retryAfterSession != null && r.retryAfterSession <= meta.studySessionCount){
        out.push(v);
      }
    });
    return out;
  }
  // YENİ Günlük Tekrar: DÜN öğrenilmiş (bilinen işaretlenmiş) kelimeleri bugün
  // tekrar sormak için. Aktif dile göre (seviye filtresinden bağımsız).
  function yesterdayStr(){
    const d = new Date();
    d.setDate(d.getDate()-1);
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }
  function dailyReviewWords(){
    const y = yesterdayStr();
    return poolForActiveLang().filter(v=>{
      const r = getRecord(v);
      return r && r.known && r.learnedDate === y;
    });
  }

  function injectStyles(){
    if(document.getElementById('pmStyles')) return;
    const style = document.createElement('style');
    style.id = 'pmStyles';
    style.textContent = `
      .pm-root{
        --pm-accent:#4fe8ff; --pm-accent2:#ff5fb8; --pm-accent3:#9b7bff; --pm-good:#3dffa0; --pm-bad:#ff5f7a;
        --pm-panel: linear-gradient(160deg, rgba(18,14,38,0.38), rgba(10,8,22,0.42));
        --pm-border: rgba(79,232,255,0.35);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      }
      .pm-root .pm-head{
        text-align:center;padding:18px 14px 22px;border-radius:22px;margin-bottom:16px;
        background: radial-gradient(circle at 50% -10%, rgba(79,232,255,0.16), transparent 60%), var(--pm-panel);
        border:1px solid var(--pm-border);
        box-shadow:0 8px 30px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(79,232,255,0.12);
      }
      .pm-root .pm-eyebrow{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--pm-accent);margin-bottom:6px;}
      .pm-root .pm-title{font-family:Georgia,'Iowan Old Style',serif;font-size:22px;font-weight:700;color:#eef4ff;margin-bottom:2px;}
      .pm-root .pm-sub{font-size:11.5px;color:#8291b3;}
      .pm-root .pm-pill-row{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:14px;}
      .pm-root .pm-pill{padding:6px 12px;border-radius:999px;font-size:11.5px;font-weight:700;background:rgba(79,232,255,0.1);border:1px solid var(--pm-border);color:#eef4ff;}
      .pm-root .pm-pill.flame{background:rgba(255,95,184,0.14);border-color:rgba(255,95,184,0.4);}
      .pm-root .pm-mini-select{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:14px;}
      .pm-root .pm-lang-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px;}
      .pm-root .pm-lang-card{display:flex;flex-direction:column;align-items:center;gap:4px;padding:11px 6px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(79,232,255,0.18);cursor:pointer;transition:border-color .15s,background .15s,transform .1s;}
      .pm-root .pm-cat-card{position:relative;}
      .pm-root .pm-cat-check{position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:9px;color:transparent;transition:all .15s;}
      .pm-root .pm-cat-card.sel{border-color:#3dffa0;background:rgba(61,255,160,0.08);}
      .pm-root .pm-cat-card.sel .pm-cat-check{background:#3dffa0;border-color:#3dffa0;color:#0a0d14;}
      .pm-root .pm-lang-card:active{transform:scale(.96);}
      .pm-root .pm-lang-card.active{border-color:#4fe8ff;background:rgba(79,232,255,0.10);}
      .pm-root .pm-lang-card .fl{font-size:22px;line-height:1;}
      .pm-root .pm-lang-card .nm{font-size:11.5px;font-weight:700;color:#8291b3;}
      .pm-root .pm-lang-card.active .nm{color:#eef4ff;}
      .pm-root .pm-level-seg{display:flex;gap:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(79,232,255,0.18);border-radius:14px;padding:5px;margin-top:10px;}
      .pm-root .pm-level-seg .lvl{flex:1;text-align:center;padding:8px 0;border-radius:10px;font-size:12.5px;font-weight:700;letter-spacing:.04em;color:#8291b3;cursor:pointer;transition:all .2s;}
      .pm-root .pm-level-seg .lvl:active{transform:scale(.94);}
      .pm-root .pm-level-seg .lvl.active{background:rgba(79,232,255,0.16);color:#eef4ff;}
      .pm-root .pm-sup-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
      .pm-root .pm-sup-badge{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 6px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);}
      .pm-root .pm-sup-badge .e{font-size:26px;line-height:1;filter:grayscale(1);opacity:.32;transition:filter .2s,opacity .2s;}
      .pm-root .pm-sup-badge.owned{border-color:rgba(255,210,59,0.35);background:rgba(255,210,59,0.08);}
      .pm-root .pm-sup-badge.owned .e{filter:none;opacity:1;}
      .pm-root .pm-sup-badge .lock{position:absolute;top:7px;right:8px;font-size:13px;opacity:.75;}
      .pm-root .pm-sup-badge .nm{font-size:10.5px;font-weight:700;color:#8291b3;text-align:center;}
      .pm-root .pm-sup-badge.owned .nm{color:#ffe9a8;}
      .pm-root .pm-chip{padding:6px 11px;border-radius:10px;font-size:11.5px;font-weight:700;color:#8291b3;background:rgba(255,255,255,0.03);border:1px solid rgba(79,232,255,0.18);cursor:pointer;transition:transform .15s ease, border-color .15s ease, background .15s ease, color .15s ease;}
      .pm-root .pm-chip:hover{border-color:rgba(79,232,255,0.4);color:#eef4ff;}
      .pm-root .pm-chip:active{transform:scale(.94);}
      .pm-root .pm-chip.active{
        color:#0a0715;
        background:linear-gradient(120deg,var(--pm-accent),var(--pm-accent3),var(--pm-accent2));
        background-size:250% 250%;
        animation:pmNeonShift 6s ease-in-out infinite;
        border-color:transparent;
        box-shadow:0 0 14px rgba(79,232,255,0.35);
      }
      .pm-root .pm-goal-wrap{margin-top:14px;text-align:left;}
      .pm-root .pm-goal-row{display:flex;justify-content:space-between;font-size:11px;color:#8291b3;margin-bottom:5px;}
      .pm-root .pm-bar{height:6px;border-radius:6px;background:rgba(255,255,255,0.08);overflow:hidden;}
      .pm-root .pm-bar-fill{height:100%;background:linear-gradient(90deg,var(--pm-accent),var(--pm-accent2));transition:width .3s ease;}
      .pm-root .pm-card{
        background:var(--pm-panel);border:1px solid var(--pm-border);border-radius:18px;padding:16px;margin-bottom:12px;
        box-shadow:0 6px 22px rgba(0,0,0,0.3);
      }
      .pm-root .pm-card h4{margin:0 0 10px;font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--pm-accent);}
      .pm-root .pm-focus{background:linear-gradient(125deg,rgba(79,232,255,.07),rgba(155,123,255,.08)),var(--pm-panel);text-align:start;}
      .pm-root .pm-focus h3{margin:0 0 12px;font-size:19px;line-height:1.45;color:#eef4ff;}
      .pm-root .pm-focus label{display:block;font-size:13px;line-height:1.5;margin-bottom:7px;color:#b8cbea;}
      .pm-root .pm-focus .lumira-select-field{display:block;min-width:0;width:100%;}
      .pm-root .pm-focus p{font-size:13px;line-height:1.65;overflow-wrap:break-word;color:#b8cbea;margin:10px 0;}
      .pm-root .pm-focus-count{display:block;font-size:14px;line-height:1.6;color:var(--pm-accent);margin:12px 0;}
      .pm-root .pm-focus button.pm-btn{margin-bottom:0;min-height:48px;}
      .pm-root button.pm-btn:disabled{opacity:.5;cursor:default;transform:none;}
      .pm-root .pm-level-row{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:#eef4ff;margin-bottom:8px;}
      .pm-root .pm-level-row .pm-bar{flex:1;margin:0 10px;}
      .pm-root .pm-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      .pm-root .pm-stat-box{background:rgba(255,255,255,0.03);border:1px solid rgba(79,232,255,0.14);border-radius:12px;padding:10px 12px;}
      .pm-root .pm-stat-num{font-size:19px;font-weight:800;color:#eef4ff;font-family:Georgia,serif;}
      .pm-root .pm-stat-label{font-size:10.5px;color:#8291b3;margin-top:2px;}
      .pm-root .pm-badges{display:flex;gap:8px;flex-wrap:wrap;}
      .pm-root .pm-awards{display:flex;gap:8px;flex-wrap:wrap;}
      .pm-root .pm-award{display:flex;align-items:center;gap:7px;padding:7px 12px 7px 9px;border-radius:999px;background:rgba(255,210,59,0.10);border:1px solid rgba(255,210,59,0.35);}
      .pm-root .pm-award-e{font-size:17px;line-height:1;}
      .pm-root .pm-award-n{font-size:12.5px;font-weight:700;color:#ffe9a8;white-space:nowrap;}
      .pm-root .pm-badge{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;background:rgba(79,232,255,0.12);border:1px solid var(--pm-border);}
      .pm-root .pm-badge.locked{opacity:.25;filter:grayscale(1);}
      .pm-root .pm-task{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(79,232,255,0.12);}
      .pm-root .pm-task:last-child{border-bottom:none;}
      .pm-root .pm-task-icon{font-size:16px;width:22px;text-align:center;flex-shrink:0;}
      .pm-root .pm-task-body{flex:1;min-width:0;}
      .pm-root .pm-task-label{font-size:12.5px;color:#eef4ff;}
      .pm-root .pm-task-ring{position:relative;width:40px;height:40px;min-width:40px;max-width:40px;flex:none;display:flex;align-items:center;justify-content:center;}
      .pm-root .pm-task-ring-svg{position:absolute;inset:0;width:40px;height:40px;display:block;}
      .pm-root .pm-task-ring span{position:relative;z-index:1;font-size:9px;font-weight:800;color:#eef4ff;}
      .pm-root .pm-task-sub{font-size:10.5px;color:#8291b3;margin-top:2px;}
      .pm-root .pm-task.done .pm-task-label{color:var(--pm-good);text-decoration:line-through;opacity:.8;}
      .pm-root .pm-due-banner{
        display:flex;justify-content:space-between;align-items:center;gap:10px;
        background:rgba(255,95,122,0.1);border:1px solid rgba(255,95,122,0.4);border-radius:14px;padding:12px 14px;margin-bottom:12px;
      }
      .pm-root .pm-due-banner .pm-due-text{font-size:12.5px;color:#ffd2d9;}
      .pm-root .pm-due-banner button{flex-shrink:0;padding:8px 14px;border-radius:10px;border:1px solid rgba(255,95,122,0.5);background:rgba(255,95,122,0.18);color:#ffd2d9;font-size:12px;font-weight:700;cursor:pointer;transition:transform .15s ease, background .15s ease;}
      .pm-root .pm-due-banner button:hover{background:rgba(255,95,122,0.3);}
      .pm-root .pm-due-banner button:active{transform:scale(.94);}
      .pm-root .pm-group-row{display:flex;gap:8px;margin-top:8px;}
      .pm-root .pm-group-btn{flex:1;padding:12px 6px;border-radius:12px;text-align:center;background:rgba(255,255,255,0.03);border:1px solid var(--pm-border);color:#eef4ff;font-size:12.5px;font-weight:700;cursor:pointer;transition:transform .15s ease, border-color .15s ease, box-shadow .15s ease;}
      .pm-root .pm-group-btn:hover{transform:translateY(-2px);border-color:rgba(79,232,255,0.45);box-shadow:0 6px 16px rgba(0,0,0,0.3);}
      .pm-root .pm-group-btn:active{transform:scale(.96);}
      .pm-root .pm-group-btn .g-count{display:block;font-size:10px;color:#8291b3;font-weight:400;margin-top:2px;}
      .pm-root button.pm-btn{
        width:100%;padding:14px 0;border-radius:14px;border:1px solid var(--pm-border);
        background:rgba(255,255,255,0.03);color:#eef4ff;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px;
        transition:transform .15s ease, box-shadow .2s ease, opacity .15s ease;
      }
      .pm-root button.pm-btn:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,0,0,0.3);}
      .pm-root button.pm-btn.primary{
        position:relative;overflow:hidden;
        background:linear-gradient(120deg, var(--pm-accent), var(--pm-accent3), var(--pm-accent2), var(--pm-accent));
        background-size:300% 300%;
        animation:pmNeonShift 5s ease-in-out infinite;
        color:#04050a;border:none;font-weight:800;
        box-shadow:0 6px 24px rgba(79,232,255,0.35), 0 0 34px rgba(255,95,184,0.28);
      }
      @keyframes pmNeonShift{
        0%{background-position:0% 50%;}
        50%{background-position:100% 50%;}
        100%{background-position:0% 50%;}
      }
      .pm-root button.pm-btn.primary:hover{box-shadow:0 10px 32px rgba(79,232,255,0.5), 0 0 44px rgba(255,95,184,0.4);}
      .pm-root button.pm-btn:active{opacity:.7;transform:scale(.98);}
      .pm-root button.pm-btn.small{padding:10px 0;font-size:12.5px;}
      .pm-root .pm-session-bar{display:flex;justify-content:space-between;font-size:11.5px;color:#8291b3;margin-bottom:8px;}
      .pm-root .pm-study-card{
        background:var(--pm-panel);border:1px solid var(--pm-border);border-radius:20px;padding:26px 20px;text-align:center;margin-bottom:16px;
        box-shadow:0 10px 30px rgba(0,0,0,0.35);cursor:pointer;transition:transform .2s ease, box-shadow .2s ease;
      }
      .pm-root .pm-study-card:hover{transform:translateY(-2px);box-shadow:0 14px 38px rgba(0,0,0,0.42);}
      .pm-root .pm-study-card:active{transform:scale(.99);}
      .pm-root .pm-mode-tag{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--pm-accent);margin-bottom:10px;}
      .pm-root .pm-word{font-size:27px;font-weight:700;font-family:Georgia,'Iowan Old Style',serif;color:#eef4ff;margin-bottom:6px;}
      .pm-root .pm-word-sub{font-size:12px;color:#8291b3;margin-bottom:8px;}
      .pm-root .pm-speak-row{display:flex;justify-content:center;gap:10px;margin:10px 0 4px;}
      .pm-root .pm-fill-row{font-family:Georgia,'Iowan Old Style',serif;font-size:19px;color:#eef4ff;background:var(--pm-panel);border:1px solid var(--pm-border);border-radius:14px;padding:16px;margin-bottom:0;line-height:1.6;}
      .pm-root .pm-fill-input{width:100%;box-sizing:border-box;font-family:Georgia,'Iowan Old Style',serif;font-size:16px;color:#eef4ff;background:var(--pm-panel);border:1px solid var(--pm-border);border-radius:14px;padding:14px 16px;outline:none;}
      .pm-root .pm-fill-input:focus{border-color:var(--pm-accent);}
      .pm-root .pm-fill-fb{min-height:20px;font-size:12.5px;margin:10px 0 4px;font-weight:600;}
      .pm-root .pm-fill-fb.ok{color:#3dffa0;}
      .pm-root .pm-fill-fb.bad{color:#ff8a8a;}
      .pm-root .pm-speak-caption{
        text-align:center;margin-bottom:8px;
        font-size:10.5px;font-weight:600;letter-spacing:.03em;
        color:#9b7bff;
        opacity:.85;
      }
      @supports ((background-clip:text) or (-webkit-background-clip:text)){
        .pm-root .pm-speak-caption{
          background:linear-gradient(90deg,#4fe8ff,#ff5fb8,#9b7bff);
          -webkit-background-clip:text;background-clip:text;
          -webkit-text-fill-color:transparent;color:transparent;
          filter:drop-shadow(0 0 4px rgba(155,123,255,0.35));
        }
      }
      .pm-root .pm-speak-btn{
        display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;font-size:19px;
        background:rgba(79,232,255,0.14);border:1px solid var(--pm-border);cursor:pointer;
        transition:transform .15s ease, box-shadow .15s ease;
      }
      .pm-root .pm-speak-btn:hover{transform:translateY(-1px);box-shadow:0 0 12px rgba(79,232,255,0.35);}
      .pm-root .pm-speak-btn:active{transform:scale(.88);}
      .pm-root .pm-options{display:flex;flex-direction:column;gap:9px;margin-top:6px;}
      .pm-root .pm-opt{padding:12px 14px;border-radius:12px;border:1px solid var(--pm-border);background:rgba(255,255,255,0.03);color:#eef4ff;font-size:14px;text-align:left;cursor:pointer;transition:transform .15s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease;}
      .pm-root .pm-opt:hover:not([disabled]){border-color:rgba(79,232,255,0.5);background:rgba(79,232,255,0.08);transform:translateX(2px);}
      .pm-root .pm-opt:active:not([disabled]){transform:scale(.98);}
      .pm-root .pm-opt.correct{background:rgba(61,255,160,0.14);border-color:var(--pm-good);color:var(--pm-good);box-shadow:0 0 14px rgba(61,255,160,0.25);}
      .pm-root .pm-opt.wrong{background:rgba(255,95,122,0.14);border-color:var(--pm-bad);color:var(--pm-bad);box-shadow:0 0 14px rgba(255,95,122,0.25);}
      .pm-root .pm-opt[disabled]{cursor:default;}
      .pm-root .pm-weak-item{background:var(--pm-panel);border:1px solid var(--pm-border);border-radius:14px;padding:14px 16px;margin-bottom:10px;text-align:left;}
      .pm-root .pm-weak-word{font-size:16px;font-weight:700;color:#eef4ff;}
      .pm-root .pm-weak-meta{font-size:11px;color:#8291b3;margin-top:4px;line-height:1.6;}
      .pm-root .pm-known-item{display:flex;justify-content:space-between;gap:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(79,232,255,0.16);border-radius:10px;padding:8px 12px;margin-bottom:6px;font-size:12.5px;}
      .pm-root .pm-known-item b{color:#eef4ff;}
      .pm-root .pm-known-item span{color:#8291b3;}
      .pm-root .pm-empty{text-align:center;padding:30px 10px;color:#8291b3;font-size:13px;}
      .pm-root .pm-loading{text-align:center;padding:40px 10px;color:#8291b3;font-size:13px;}
      .pm-root .pm-back-link{display:block;text-align:center;font-size:11.5px;color:#8291b3;margin-top:4px;cursor:pointer;text-decoration:underline;}
      .pm-root .wp-textarea{
        width:100%;box-sizing:border-box;min-height:140px;resize:vertical;
        font-family:Georgia,'Iowan Old Style',serif;font-size:15px;line-height:1.6;color:#eef4ff;
        background:var(--pm-panel);border:1px solid var(--pm-border);border-radius:14px;padding:14px 16px;outline:none;
      }
      .pm-root .wp-textarea:focus{border-color:var(--pm-accent);}
      .pm-root .wp-counter{text-align:right;font-size:10.5px;color:#8291b3;margin:4px 2px 12px;}
      .pm-root .wp-section-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--pm-accent);margin:4px 0 8px;}
      .pm-root .wp-original{
        font-family:Georgia,'Iowan Old Style',serif;font-size:15px;line-height:1.8;color:#eef4ff;
        background:var(--pm-panel);border:1px solid var(--pm-border);border-radius:14px;padding:14px 16px;margin-bottom:14px;
        white-space:pre-wrap;word-break:break-word;
      }
      .pm-root .wp-original mark.wp-err{
        background:rgba(255,95,122,0.22);color:#ffd2d9;border-bottom:2px solid var(--pm-bad);
        border-radius:3px;padding:0 2px;cursor:pointer;
      }
      .pm-root .wp-corrected{
        font-family:Georgia,'Iowan Old Style',serif;font-size:15px;line-height:1.8;color:var(--pm-good);
        background:rgba(61,255,160,0.06);border:1px solid rgba(61,255,160,0.35);border-radius:14px;padding:14px 16px;margin-bottom:14px;
        white-space:pre-wrap;word-break:break-word;
      }
      .pm-root .wp-clean-msg{text-align:center;color:var(--pm-good);font-size:13px;font-weight:700;padding:16px 10px;}
      .pm-root .wp-issue{display:flex;gap:10px;background:var(--pm-panel);border:1px solid var(--pm-border);border-radius:14px;padding:12px 14px;margin-bottom:10px;text-align:left;}
      .pm-root .wp-issue-num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:rgba(255,95,122,0.18);border:1px solid var(--pm-bad);color:#ffd2d9;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;}
      .pm-root .wp-issue-body{flex:1;min-width:0;}
      .pm-root .wp-issue-orig{font-size:13.5px;color:#eef4ff;margin-bottom:3px;}
      .pm-root .wp-issue-orig b{color:var(--pm-good);}
      .pm-root .wp-issue-msg{font-size:11.5px;color:#8291b3;line-height:1.5;}
      .pm-root .wp-loading{text-align:center;padding:26px 10px;color:#8291b3;font-size:13px;}
      .pm-root .wp-error{text-align:center;padding:20px 10px;color:#ffd2d9;font-size:12.5px;background:rgba(255,95,122,0.1);border:1px solid rgba(255,95,122,0.35);border-radius:14px;margin-bottom:12px;}
      .pm-root .wp-speak-row{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
      .pm-root .wp-speak-row button{flex:1;min-width:120px;}
      .pm-root .wp-tools{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px;}
      .pm-root .wp-tools button{flex:1;min-width:120px;margin:0;}
      .pm-root .wp-topic{font-size:13.5px;line-height:1.6;color:#dfe9ff;background:rgba(79,232,255,0.07);border:1px dashed rgba(79,232,255,0.45);border-radius:12px;padding:10px 12px;margin:0 0 10px;text-align:start;}
      .pm-root .wp-topic b{display:block;color:var(--pm-accent);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px;}
      .pm-root .wp-summary{font-size:12.5px;color:#c2d0df;margin:0 0 10px;}
      .pm-root .wp-cat{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.04em;padding:2px 8px;border-radius:20px;margin-bottom:5px;background:rgba(79,232,255,0.12);color:#bfefff;}
      .pm-root .wp-cat.spelling{background:rgba(255,95,122,0.16);color:#ffd2d9;}
      .pm-root .wp-cat.grammar{background:rgba(255,190,90,0.16);color:#ffe2b8;}
      .pm-root .wp-cat.punctuation,.pm-root .wp-cat.casing{background:rgba(180,185,238,0.18);color:#dcdfff;}
      .pm-root .wp-cat.style{background:rgba(61,255,160,0.12);color:#c6ffe3;}
      .pm-root .wp-alts{display:flex;gap:6px;flex-wrap:wrap;margin:7px 0 2px;}
      .pm-root .wp-alt{font:inherit;font-size:12px;padding:4px 10px;border-radius:20px;border:1px solid rgba(61,255,160,0.4);background:transparent;color:#c6ffe3;cursor:pointer;}
      .pm-root .wp-alt[aria-pressed="true"]{background:rgba(61,255,160,0.16);border-color:var(--pm-good);color:var(--pm-good);font-weight:700;}
      .pm-root .wp-issue.is-focus{border-color:var(--pm-accent);box-shadow:0 0 0 2px rgba(79,232,255,0.22);}
    `;
    document.head.appendChild(style);
  }
  /* Notlarım (index.html) sekmesi de aynı .pm-* görünümünü kullanıyor;
     kullanıcı "Kişisel" sekmesini hiç açmadan doğrudan "Notlarım"a
     girerse bu stil hiç eklenmemiş oluyordu (yalnızca renderHome/PM_open
     içinde çağrılıyordu) ve form stilsiz/çıplak görünüyordu. Artık
     dışarıdan da tetiklenebiliyor. */
  window.PM_injectStyles = injectStyles;

  function renderHome(){
    if(pmInStoryFlow)window.LUMIRA_STORIES?.unmount();pmInStoryFlow=false;
    pmInWritingFlow = false;
    injectStyles();
    if(!dataLoaded){
      root.innerHTML = '<div class="pm-root"><div class="pm-loading">'+(window.t?window.t('pm_loading'):'Kişisel alan yükleniyor...')+'</div></div>';
      return;
    }
    checkTask5();
    persistMeta();

    const L = LANGS[activeLang];
    const filterPool = poolForActiveFilter();
    const filterKnown = knownCountIn(filterPool);
    const filterPct = filterPool.length ? Math.round((filterKnown/filterPool.length)*100) : 0;
    const today = meta.todayCount||0;
    const goal = meta.dailyGoal||DEFAULT_DAILY_GOAL;
    const goalPct = Math.min(100, Math.round((today/goal)*100));
    const acc = accuracyOverall();
    const totalStudied = totalStudiedCount();
    const totalKnownLang = knownCountIn(poolForActiveLang());
    const catInfo = categoryAccuracy();
    const due = dailyReviewWords();

    let levelRows = '';
    L.levels.forEach(lv=>{
      const list = poolForActiveLang().filter(v=>v.level===lv);
      const known = knownCountIn(list);
      const pct = list.length ? Math.round((known/list.length)*100) : 0;
      levelRows += '<div class="pm-level-row"><span>'+lv+'</span><div class="pm-bar"><div class="pm-bar-fill" style="width:'+pct+'%"></div></div><span>'+pct+'%</span></div>';
    });

    let badgeRow = '';
    BADGE_THRESHOLDS.forEach(th=>{
      const earned = meta.badges && meta.badges[th];
      badgeRow += '<div class="pm-badge '+(earned?'':'locked')+'" title="'+th+' '+window.t('pm_words_suffix')+'">'+(earned?'🏅':'🔒')+'</div>';
    });

    const groups = levelGroups();
    let groupRow = '';
    groups.forEach(g=>{
      const glist = poolForActiveLang().filter(v=>g.levels.includes(v.level));
      const gknown = knownCountIn(glist);
      groupRow += '<div class="pm-group-btn" data-group="'+g.name+'">'+g.name+'<span class="g-count">'+gknown+' '+window.t('pm_known_suffix')+'</span></div>';
    });

    const t = meta.tasks;
    const t4Sub = t.t4
      ? window.t('task_completed')(due.length*2)
      : (due.length>0 ? window.t('task_words_waiting')(due.length) : window.t('task_no_words_yesterday'));
    const taskDefs = [
      { icon:'📋', label:window.t('task_daily_review'), sub: t4Sub, done:t.t4, pct: t.t4?100:0 },
      { icon:'💵', label:window.t('task_learn_words')(10), sub:Math.min(today,10)+'/10 · +'+TASK_XP.t1+' XP', done:t.t1, pct:Math.min(100,Math.round(today/10*100)) },
      { icon:'💰', label:window.t('task_learn_words')(50), sub:Math.min(today,50)+'/50 · +'+TASK_XP.t2+' XP', done:t.t2, pct:Math.min(100,Math.round(today/50*100)) },
      { icon:'🏆', label:window.t('task_learn_words')(100), sub:Math.min(today,100)+'/100 · +'+TASK_XP.t3+' XP', done:t.t3, pct:Math.min(100,Math.round(today/100*100)) },
      { icon:'⏱️', label:window.t('task_study_minutes'), sub:Math.min(60,Math.floor((meta.todayActiveSeconds||0)/60))+'/60 '+window.t('min_abbr')+' · +'+TASK_XP.t5+' XP', done:t.t5, pct:t.t5?100:Math.min(100,Math.round(((meta.todayActiveSeconds||0)/TASK5_SECONDS)*100)) },
    ];

    try{document.body.classList.add('pm-active');}catch(e){}
    try{['langBox','langPair','levelBox','chips'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}catch(e){}
    let html = '<div class="pm-root">';
    html += '<div class="pm-head">';
    html += '<div class="pm-eyebrow">'+window.t('pm_personal_space')+'</div>';
    html += '<div class="pm-title">'+(window.t ? window.t('pm_home_title')(escapeHtml(currentName)) : ('👤 '+escapeHtml(currentName)+'\'e Özel'))+'</div>';
    const learningLabel = window.FRONT_LABEL ? window.FRONT_LABEL() : L.native;
    const speaksLabel = window.BACK_LABEL ? window.BACK_LABEL() : 'Türkçe';
    const pairSentence = window.t ? window.t('lang_change_sub')(speaksLabel, learningLabel) : (speaksLabel+' konuşuyorsun, '+learningLabel+' öğreniyorsun');
    const syncNote = window.t ? window.t('pm_sync_note') : 'ilerlemen tüm cihazlarında senkron';
    html += '<div class="pm-sub">'+pairSentence+' - '+syncNote+'</div>';
    html += '<div class="lang-box" id="pmLangSelect">';
    /* Ana dil hariç kalan tüm diller + (ana dil Türkçe değilse) Türkçe
       seçeneği — ana ekrandaki dil kutusuyla BİREBİR aynı mantık.
       Kartlar/Notlarım'daki ile aynı görünüm (landmark ikonlu) kullanılır. */
    const nativeCode = (window.NATIVE_LANG || 'tr');
    let pmOpts = Object.keys(LANGS).filter(c=>c!==nativeCode);
    if(nativeCode !== 'tr') pmOpts = pmOpts.concat(['tr']);
    pmOpts.forEach(code=>{
      const label = (code==='tr') ? (window.t?window.t('lang_names').tr:'Türkçe') : (window.t?window.t('lang_names')[code]:LANGS[code].label);
      const landmark = (typeof LANG_LANDMARK !== 'undefined' && LANG_LANDMARK[code]) ? LANG_LANDMARK[code] : '';
      html += '<div class="lang-opt '+(code===(window.isReversed&&window.isReversed()?'tr':activeLang)?'active':'')+'" data-lang="'+code+'"><span class="landmark" aria-hidden="true">'+landmark+'</span><div class="flag">'+(PM_FLAGS[code]||'🌐')+'</div><div class="lname">'+label+'</div></div>';
    });
    html += '</div>';
    html += '<div class="pm-level-seg" id="pmLevelSelect">';
    html += '<div class="lvl '+(activeLevel==='TÜMÜ'?'active':'')+'" data-level="TÜMÜ">'+(window.t?window.t('level_all'):'TÜMÜ')+'</div>';
    L.levels.forEach(lv=>{
      html += '<div class="lvl '+(lv===activeLevel?'active':'')+'" data-level="'+lv+'">'+lv+'</div>';
    });
    html += '</div>';
    html += '<div class="pm-pill-row"><div class="pm-pill flame">🔥 '+(window.t?window.t('streak_days')(meta.streak||0):((meta.streak||0)+' günlük seri'))+'</div><div class="pm-pill">⭐ '+(window.t?window.t('level_xp')(Math.floor((meta.xp||0)/200)+1, meta.xp||0):('Seviye '+(Math.floor((meta.xp||0)/200)+1)+' - '+(meta.xp||0)+' XP'))+'</div></div>';
    html += '<div class="pm-goal-wrap"><div class="pm-goal-row"><span>'+window.t('pm_today_learned')+'</span><span>'+today+' / '+goal+' '+window.t('pm_words_suffix')+'</span></div><div class="pm-bar"><div class="pm-bar-fill" style="width:'+goalPct+'%"></div></div></div>';
    html += '</div>';

    const focusedCategory=studyCategory(),categories=[...new Set(poolForActiveLang().map(v=>v.cat).filter(Boolean))];
    const unknownCounts=new Map();
    filterPool.forEach(v=>{if(!getRecord(v)?.known)unknownCounts.set(v.cat,(unknownCounts.get(v.cat)||0)+1);});
    const allUnknown=[...unknownCounts.values()].reduce((sum,n)=>sum+n,0),focusedUnknown=focusedCategory?(unknownCounts.get(focusedCategory)||0):allUnknown;
    html += '<section class="pm-card pm-focus"><h3>🎯 '+escapeHtml(focusText(0))+'</h3><label for="pmStudyCategory">'+escapeHtml(focusText(1))+'</label><select id="pmStudyCategory" data-lumira-select aria-describedby="pmFocusHint pmFocusCount"><option value="">'+escapeHtml(focusText(2))+' · '+allUnknown+'</option>';
    categories.forEach(category=>{
      const label=(typeof catName==='function')?catName(category):category;
      html += '<option value="'+escapeHtml(category)+'"'+(category===focusedCategory?' selected':'')+'>'+escapeHtml(label)+' · '+(unknownCounts.get(category)||0)+'</option>';
    });
    html += '</select><p id="pmFocusHint">'+escapeHtml(focusText(3))+'</p><strong class="pm-focus-count" id="pmFocusCount">'+escapeHtml(focusText(4,focusedUnknown))+'</strong>';
    if(!focusedUnknown)html += '<p class="pm-focus-empty" role="status">'+escapeHtml(focusedCategory?focusText(5):window.t('pm_no_new_words_level'))+'</p>';
    html += '<button class="pm-btn primary" id="pmStartBtn"'+(focusedUnknown?'':' disabled')+'>'+window.t('pm_start_studying')+'</button></section>';

    if(due.length > 0 && !t.t4){
      html += '<div class="pm-due-banner"><div class="pm-due-text">📋 '+(window.t?window.t('due_review_banner')(due.length):('Dün öğrendiğin <b>'+due.length+'</b> kelimenin günlük tekrarı var'))+'</div><button id="pmDueBtn">'+(window.t?window.t('review_btn'):'Tekrar Et')+'</button></div>';
    }

    const levelLabelDisp = (activeLevel === 'TÜMÜ') ? (window.t ? window.t('level_all') : 'TÜMÜ') : activeLevel;
    html += '<div class="pm-card"><h4>'+window.t('pm_progress')+' - '+levelLabelDisp+' - '+filterKnown+' / '+filterPool.length+' '+window.t('pm_words_suffix')+' (%'+filterPct+')</h4>';
    html += levelRows || '<div class="pm-empty">'+window.t('pm_no_level_defined')+'</div>';
    html += '</div>';

    html += '<div class="pm-card"><h4>'+window.t('pm_general_review')+'</h4><div class="pm-weak-meta">'+window.t('pm_general_review_desc')+'</div><div class="pm-group-row" id="pmGroupRow">'+groupRow+'</div></div>';

    html += '<div class="pm-card"><h4>'+window.t('pm_statistics')+'</h4><div class="pm-stat-grid">';
    html += '<div class="pm-stat-box"><div class="pm-stat-num">'+totalKnownLang+'</div><div class="pm-stat-label">'+window.t('pm_learned_in')((typeof nbLangLabel==='function')?nbLangLabel(activeLang):L.label)+'</div></div>';
    html += '<div class="pm-stat-box"><div class="pm-stat-num">'+today+'</div><div class="pm-stat-label">'+window.t('pm_today_learned')+'</div></div>';
    html += '<div class="pm-stat-box"><div class="pm-stat-num">'+totalStudied+'</div><div class="pm-stat-label">'+window.t('pm_total_studied')+'</div></div>';
    html += '<div class="pm-stat-box"><div class="pm-stat-num">'+(acc===null?'-':acc+'%')+'</div><div class="pm-stat-label">'+window.t('pm_accuracy')+'</div></div>';
    html += '</div>';
    html += '<div class="pm-weak-meta" style="margin-top:10px;">'+(catInfo.best ? ('💪 '+window.t('pm_strongest_cat')+' <b>'+escapeHtml((typeof catName==='function')?catName(catInfo.best.cat):catInfo.best.cat)+'</b>') : window.t('pm_not_enough_data'))+'<br>'+(catInfo.worst ? ('🎯 '+window.t('pm_weakest_cat')+' <b>'+escapeHtml((typeof catName==='function')?catName(catInfo.worst.cat):catInfo.worst.cat)+'</b>') : '')+'</div>';
    html += '<div class="pm-weak-meta" id="pmTotalTime" style="margin-top:6px;">⏱ '+window.t('pm_total_time_loading')+'</div>';
    html += '</div>';

    html += '<div class="pm-card"><h4>'+window.t('pm_daily_tasks')+'</h4>';
    taskDefs.forEach(td=>{
      const rp = Math.max(0, Math.min(100, td.pct||0));
      const R = 16, C = 2*Math.PI*R, off = C - (C*rp/100);
      const ringColor = td.done ? '#3dffa0' : '#4fe8ff';
      const svg = '<svg width="40" height="40" viewBox="0 0 40 40" class="pm-task-ring-svg">'+
        '<circle cx="20" cy="20" r="'+R+'" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="4"></circle>'+
        '<circle cx="20" cy="20" r="'+R+'" fill="none" stroke="'+ringColor+'" stroke-width="4" '+
        'stroke-linecap="round" stroke-dasharray="'+C.toFixed(2)+'" stroke-dashoffset="'+off.toFixed(2)+'" '+
        'transform="rotate(-90 20 20)"></circle></svg>';
      html += '<div class="pm-task '+(td.done?'done':'')+'"><div class="pm-task-icon">'+(td.done?'✅':td.icon)+'</div><div class="pm-task-body"><div class="pm-task-label">'+td.label+'</div><div class="pm-task-sub">'+td.sub+'</div></div><div class="pm-task-ring">'+svg+'<span>'+rp+'%</span></div></div>';
    });
    html += '</div>';

    /* Rozetler (destek) + Başarımlar — mistakes butonunun ALTINA taşınacak (Başarımlar → Rozetler) */
    var _tiers = (window.LUMIRA_BADGES && window.LUMIRA_BADGES.tiers) || [];
    var supHtml = '';
    if(_tiers.length){
      var supRow = '';
      _tiers.forEach(function(tier){
        var owned = !!(window.LUMIRA_BADGES && window.LUMIRA_BADGES.has(tier.badge));
        var tierNames = window.t ? window.t('tier_names') : null;
        var dispName = (tierNames && tierNames[tier.sku]) ? tierNames[tier.sku] : tier.name;
        supRow += '<div class="pm-sup-badge'+(owned?' owned':'')+'"><span class="e">'+tier.badge+'</span>'+(owned?'':'<span class="lock">🔒</span>')+'<span class="nm">'+String(dispName||'').replace(/</g,'')+'</span></div>';
      });
      supHtml = '<div class="pm-card"><h4>'+window.t('pm_badges_header')+'</h4><div class="pm-sup-grid">'+supRow+'</div></div>';
    }
  const ADMIN_BADGE_NAMES = {
    sampiyon: { tr:"Şampiyon", en:"Champion", de:"Champion", ar:"بطل", fr:"Champion", es:"Campeón", ru:"Чемпион" },
    elmas: { tr:"Elmas", en:"Diamond", de:"Diamant", ar:"الماس", fr:"Diamant", es:"Diamante", ru:"Алмаз" },
    efsane: { tr:"Efsane", en:"Legend", de:"Legende", ar:"أسطورة", fr:"Légende", es:"Leyenda", ru:"Легенда" },
    nisanci: { tr:"Nişancı", en:"Sharpshooter", de:"Scharfschütze", ar:"قناص", fr:"Tireur d'élite", es:"Tirador", ru:"Снайпер" },
    ates: { tr:"Ateş", en:"Fire", de:"Feuer", ar:"نار", fr:"Feu", es:"Fuego", ru:"Огонь" },
    oncu: { tr:"Öncü", en:"Pioneer", de:"Pionier", ar:"رائد", fr:"Pionnier", es:"Pionero", ru:"Первопроходец" },
    bilge: { tr:"Bilge", en:"Sage", de:"Weiser", ar:"حكيم", fr:"Sage", es:"Sabio", ru:"Мудрец" },
    kitapkurdu: { tr:"Kitap Kurdu", en:"Bookworm", de:"Bücherwurm", ar:"دودة الكتب", fr:"Rat de bibliothèque", es:"Ratón de biblioteca", ru:"Книжный червь" },
    birinci: { tr:"Birinci", en:"First Place", de:"Erster Platz", ar:"المركز الأول", fr:"Première place", es:"Primer lugar", ru:"Первое место" },
    madalya: { tr:"Madalya", en:"Medal", de:"Medaille", ar:"ميدالية", fr:"Médaille", es:"Medalla", ru:"Медаль" },
    onur: { tr:"Onur", en:"Honor", de:"Ehre", ar:"شرف", fr:"Honneur", es:"Honor", ru:"Честь" },
    kelebek: { tr:"Kelebek", en:"Butterfly", de:"Schmetterling", ar:"فراشة", fr:"Papillon", es:"Mariposa", ru:"Бабочка" },
  };

    var awHtml = '';
    const awards = meta.awards || {};
    const awardKeys = Object.keys(awards).filter(key=>awards[key] && awards[key].removed!==true);
    if(awardKeys.length){
      awardKeys.sort((x,y)=>(awards[x].ts||0)-(awards[y].ts||0));
      let awRow = '';
      awardKeys.forEach(k=>{
        const a = awards[k] || {};
        /* "streakN" anahtarlı ödüller (seri başarımları) görüntülenirken
           güncel arayüz diline çevrilir; diğerleri (yönetici tarafından
           özel verilenler gibi) olduğu gibi (kaydedildiği hâliyle) kalır. */
        const streakMatch = /^streak(\d+)$/.exec(k);
        const nativeLang = (typeof NATIVE_LANG !== 'undefined' && NATIVE_LANG) || 'tr';
        const adminBadge = ADMIN_BADGE_NAMES[k];
        const dispName = (streakMatch && window.t) ? window.t('streak_award')(streakMatch[1])
          : (adminBadge ? (adminBadge[nativeLang] || adminBadge.tr) : (a.n||''));
        awRow += '<div class="pm-award" title="'+String(dispName).replace(/"/g,'')+'"><span class="pm-award-e">'+(a.e||'🏅')+'</span><span class="pm-award-n">'+String(dispName).replace(/</g,'')+'</span></div>';
      });
      awHtml = '<div class="pm-card"><h4>'+window.t('pm_achievements_header')+'</h4><div class="pm-awards">'+awRow+'</div></div>';
    }

    html += '<button class="pm-btn small" id="pmKnownBtn">✅ '+window.t('pm_known')+' ('+totalKnownLang+')</button>';
    html += '<button class="pm-btn small" id="pmWeakBtn">📉 '+window.t('pm_weak')+'</button>';
    html += awHtml;    /* Başarımlar (mistakes butonunun altında) */
    html += supHtml;   /* Rozetler */
    html += '</div>';

    root.innerHTML = html;
    const categorySelect=document.getElementById('pmStudyCategory');
    categorySelect.onchange=()=>{
      safeLocalSet(studyCategoryKey(),categorySelect.value);
      renderHome();
      window.LUMIRA_LANGUAGE?.enhance(document.getElementById('pmStudyCategory')).focus({preventScroll:true});
    };
    window.LUMIRA_LANGUAGE?.enhance(categorySelect);

    document.querySelectorAll('#pmLangSelect .lang-opt').forEach(el=>{
      el.onclick = () => {
        const target = el.dataset.lang;
        const go = window.setLangPair ? window.setLangPair(NATIVE_LANG, target) : Promise.resolve();
        go.then(()=>{
          activeLevel = 'TÜMÜ';
          if(typeof renderLangPair==='function') renderLangPair();
          if(typeof rebuildLevelBox==='function') rebuildLevelBox();
          if(typeof rebuildChips==='function') rebuildChips();
          if(typeof applyFilter==='function') applyFilter();
          renderHome();
        });
      };
    });
    document.querySelectorAll('#pmLevelSelect .lvl').forEach(el=>{
      el.onclick = () => {
        activeLevel = el.dataset.level;
        if(typeof rebuildLevelBox==='function') rebuildLevelBox();
        if(typeof rebuildChips==='function') rebuildChips();
        if(typeof applyFilter==='function') applyFilter();
        renderHome();
      };
    });
    document.querySelectorAll('#pmGroupRow .pm-group-btn').forEach(el=>{
      el.onclick = () => startGeneralReview(el.dataset.group);
    });
    document.getElementById('pmStartBtn').onclick = startSession;
    document.getElementById('pmKnownBtn').onclick = renderKnownWords;
    document.getElementById('pmWeakBtn').onclick = renderWeakWords;
    const dueBtn = document.getElementById('pmDueBtn');
    if(dueBtn) dueBtn.onclick = startDailyReview;

    if(window.LB_getTotalSeconds){
      window.LB_getTotalSeconds(currentName, (secs)=>{
        const el = document.getElementById('pmTotalTime');
        if(!el) return;
        const s = Math.floor(secs);
        const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
        el.textContent = '⏱ '+window.t('pm_total_time')+' '+(h>0?h+(window.t('hour_abbr')||'s')+' ':'')+m+(window.t('min_abbr')||'dk');
      });
    }
  }

  function pickBatch(){
    const focusedCategory = studyCategory();
    const pool = studyPool();
    const unknown = pool.filter(v=>{ const r=getRecord(v); return !(r && r.known); });
    const due = unknown.filter(v=>{
      const r = getRecord(v);
      return r && r.retryAfterSession != null && r.retryAfterSession <= meta.studySessionCount;
    });
    const fresh = unknown.filter(v=> !due.includes(v));

    function bestCategoryFrom(list){
      const byCat = {};
      list.forEach(v=>{ (byCat[v.cat] = byCat[v.cat]||[]).push(v); });
      let bestCat = null, bestList = [];
      Object.keys(byCat).forEach(cat=>{
        if(byCat[cat].length > bestList.length){ bestCat = cat; bestList = byCat[cat]; }
      });
      return bestCat;
    }

    let chosenCat = bestCategoryFrom(due.length ? due : fresh);
    if(!chosenCat) return [];

    const inCat = unknown.filter(v=>v.cat===chosenCat);
    const dueInCat = inCat.filter(v=>{
      const r=getRecord(v); return r && r.retryAfterSession!=null && r.retryAfterSession<=meta.studySessionCount;
    });
    const freshInCat = inCat.filter(v=> !dueInCat.includes(v));
    shuffle(freshInCat);
    let chosen = dueInCat.concat(freshInCat).slice(0, BATCH_SIZE);

    if(!focusedCategory && chosen.length < BATCH_SIZE){
      const rest = unknown.filter(v=>v.cat!==chosenCat);
      const restDue = rest.filter(v=>{
        const r=getRecord(v); return r && r.retryAfterSession!=null && r.retryAfterSession<=meta.studySessionCount;
      });
      shuffle(restDue);
      chosen = chosen.concat(restDue.slice(0, BATCH_SIZE-chosen.length));
    }
    return chosen.map(v=>({v, key:wordKeyFor(v)}));
  }

  /* ============================================ SEVİYE TESPİT SINAVI
     A1-B2 seçilir → o seviyedeki (aktif dilde) kelimelerden 20 soruluk quiz.
     Doğru cevaplanan kelimeler doğrudan "bilinen" sayılır. Tamamlama ödülü
     sabit +100 XP. Her seviye İÇİN AYRI AYRI haftada bir kez girilebilir
     (A1'i tamamlamak A2'yi bekletmez; bir seviyeyi TEKRAR yapmak için o
     seviyenin son tamamlanmasından itibaren 7 gün geçmesi gerekir). */
  const LT_COOLDOWN_MS = 24*60*60*1000; /* 24 saat (önceden 3 gün) */
  let ltState = null; // { level, order:[...], idx, correct, learnedKeys:[] }

  function ltProgressKey(){ return 'lumira_lt_inprogress_'+activeLang; }
  function ltSaveProgress(){
    if(!ltState) return;
    safeLocalSet(ltProgressKey(), {
      level: ltState.level,
      categories: ltState.categories||null,
      orderKeys: ltState.order.map(wordKeyFor), /* hafif: sadece anahtarlar saklanır */
      idx: ltState.idx,
      correct: ltState.correct,
      learnedKeys: ltState.learnedKeys
    });
  }
  function ltLoadProgress(level){
    const saved = safeLocalGet(ltProgressKey());
    if(!saved || saved.level !== level || !Array.isArray(saved.orderKeys)) return null;
    /* anahtarlardan gerçek kelime nesnelerini VOCAB'dan geri kur */
    const byKey = {};
    poolForActiveLang().filter(v=>v.level===level).forEach(v=>{ byKey[wordKeyFor(v)] = v; if(window.LUMIRA_VOCAB_ID.unambiguous(v,VOCAB)) byKey[window.LUMIRA_VOCAB_ID.legacy(v)] = v; });
    const order = saved.orderKeys.map(k=>byKey[k]).filter(Boolean);
    if(order.length !== saved.orderKeys.length) return null; /* veri tutarsızsa güvenli şekilde vazgeç */
    return { level, categories: saved.categories||null, order, idx: saved.idx, correct: saved.correct, learnedKeys: (saved.learnedKeys||[]).map(k=>byKey[k] ? wordKeyFor(byKey[k]) : null).filter(Boolean) };
  }
  function ltClearProgress(){ safeLocalSet(ltProgressKey(), null); }

  function ltKey(level){ return activeLang+'_'+level; }
  function ltCooldownLeft(level){
    const rec = (meta.levelTest||{})[ltKey(level)];
    if(!rec || !rec.ts) return 0;
    const left = LT_COOLDOWN_MS - (Date.now() - rec.ts);
    return left > 0 ? left : 0;
  }
  function ltFmtLeft(ms){
    const d = Math.ceil(ms / (24*60*60*1000));
    return window.t ? window.t('day_count')(d) : (d <= 1 ? '1 gün' : d+' gün');
  }
  function ltWordCount(level){
    return poolForActiveLang().filter(v=>v.level===level).length;
  }

  function openLevelTestPicker(){
    pmInWritingFlow = false;
    let html = '<div class="pm-root"><div class="pm-head"><div class="pm-eyebrow">'+(window.t?window.t('pm_level_test_btn'):'🎓 Seviye Tespit Sınavı')+'</div>'+
      '<div class="pm-title">'+(window.t?window.t('pm_level_test_header'):'🎓 Seviyeni Test Et')+'</div>'+
      '<div class="pm-sub">'+(window.t?window.t('pm_level_test_desc'):'Bir seviye seç · o seviyedeki TÜM kelimeler sorulur · tamamlayınca +100 XP · doğru bildiğin kelimeler bilinenler listene eklenir')+'</div></div>';
    html += '<div class="pm-lang-grid" style="grid-template-columns:1fr 1fr;">';
    LANGS[activeLang].levels.forEach(lv=>{
      const left = ltCooldownLeft(lv);
      const locked = left > 0;
      const cnt = ltWordCount(lv);
      const inProgress = !locked && ltLoadProgress(lv);
      let sub;
      if(locked) sub = '🔒 '+ltFmtLeft(left);
      else if(inProgress) sub = (window.t?window.t('pm_continue'):'▶ Devam et · ')+inProgress.idx+'/'+inProgress.order.length;
      else sub = (window.t?window.t('nb_word_count')(cnt):(cnt+' kelime'));
      html += '<div class="pm-lang-card lt-lv-opt'+(locked?' locked':'')+(inProgress?' active':'')+'" data-level="'+lv+'" style="'+(locked?'opacity:.5;cursor:default;':'cursor:pointer;')+'">'+
        '<span class="nm" style="font-size:16px;font-weight:800;">'+lv+'</span>'+
        '<span class="nm" style="font-size:10px;">'+sub+'</span></div>';
    });
    html += '</div>';
    html += '<button type="button" class="ctrl primary" id="pmBackHome" style="width:100%;margin-top:18px;">'+(window.t?window.t('pm_back_home_btn'):'← Ana Sayfaya Dön')+'</button></div>';
    root.innerHTML = html;
    document.getElementById('pmBackHome').onclick=()=>document.getElementById('tabPersonal')?.click();
    const label=document.createElement('h3'),picker=document.createElement('div');label.className='work-label';label.id='ltLanguageLabel';label.textContent=window.LUMIRA_LEARNING.text('choose');picker.className='practice-language-grid';picker.setAttribute('role','group');picker.setAttribute('aria-labelledby',label.id);
    for(const code of(window.learningLanguageCodes?.()||Object.keys(LANGS).filter(code=>code!==window.NATIVE_LANG))){const button=document.createElement('button');button.type='button';button.dataset.ltLanguage=code;window.LUMIRA_LEARNING.decorateLanguage(button,code,(window.t('lang_names')||{})[code]||LANGS[code].native,code===(window.TARGET_LANG||activeLang));button.onclick=async()=>{if(code===(window.TARGET_LANG||activeLang))return;for(const item of picker.children)item.disabled=true;try{await window.setLangPair(window.NATIVE_LANG,code);if(!picker.isConnected||root.style.display==='none')return;activeLevel='TÜMÜ';ltState=null;openLevelTestPicker();}catch{if(!picker.isConnected)return;showToast(window.LUMIRA_LEARNING.text('error'));for(const item of picker.children)item.disabled=false;}};picker.append(button);}
    root.querySelector('.pm-head').append(label,picker);
    document.querySelectorAll('.lt-lv-opt').forEach(el=>{
      if(el.classList.contains('locked')) return;
      el.onclick = () => {
        const saved = ltLoadProgress(el.dataset.level);
        if(saved){ ltState = saved; renderLevelTestQuestion(); }
        else openLevelTestCategoryPicker(el.dataset.level);
      };
    });
  }

  /* ============================== SEVİYE TESPİT — KATEGORİ SEÇİMİ
     Kullanıcı isterse seviyenin TÜMÜNDEN, isterse seçtiği bir veya birden
     fazla kategoriden sınava girebilir. Sadece seçilen kategorilerdeki
     kelimeler sorulur ve doğru bilinenler bilinenler listesine geçer. */
  function openLevelTestCategoryPicker(level){
    const pool = poolForActiveLang().filter(v=>v.level===level);
    const catCounts=Object.fromEntries(window.LUMIRA_CATALOG.categoryCounts(pool));
    const cats = Object.keys(catCounts).sort((a,b)=>catCounts[b]-catCounts[a]);
    const selected = new Set();

    let html = '<div class="pm-root"><div class="pm-head">'+
      '<div class="pm-eyebrow">'+(window.t?('🎓 '+window.t('pm_step_2_of_2')(level)):('🎓 '+level+' · Adım 2/2'))+'</div>'+
      '<div class="pm-title">'+(window.t?window.t('cat_pick_title'):'Kategori Seç')+'</div>'+
      '<div class="pm-sub">'+(window.t?window.t('pm_lt_category_desc'):'İstediğin kategorileri seç, ya da tümünden sınava gir. Sadece seçtiğin kategorilerin kelimeleri test edilir.')+'</div></div>';
    html += '<button type="button" class="ctrl primary" id="pmLtAllCats" style="width:100%;margin-bottom:14px;">'+(window.t?window.t('pm_all_categories_btn')(pool.length):('🎯 Tüm Kategorilerden Gir ('+pool.length+' kelime)'))+'</button>';
    html += '<div class="pm-lang-grid" id="pmLtCatGrid">';
    cats.forEach(c=>{
      const emoji = (window.CAT_EMOJI && window.CAT_EMOJI[c]) || '📖';
      html += '<div class="pm-lang-card pm-cat-card" data-cat="'+escapeHtml(c)+'">'+
        '<span class="pm-cat-check">✓</span>'+
        '<span class="fl">'+emoji+'</span>'+
        '<span class="nm">'+escapeHtml((typeof catName==='function')?catName(c):c)+'</span>'+
        '<span class="nm" style="font-size:9.5px;opacity:.7;">'+(window.t?window.t('nb_word_count')(catCounts[c]):(catCounts[c]+' kelime'))+'</span></div>';
    });
    html += '</div>';
    html += '<button type="button" class="ctrl primary" id="pmLtStartCats" style="width:100%;margin-top:16px;opacity:.4;" disabled>'+(window.t?window.t('pm_start_exam'):'Sınava Başla')+'</button>';
    html += '<button type="button" class="ctrl primary" id="pmBackLevels" style="width:100%;margin-top:10px;">'+(window.t?window.t('pm_back_to_levels'):'← Seviye Seçime Dön')+'</button></div>';
    root.innerHTML = html;

    document.getElementById('pmBackLevels').onclick = openLevelTestPicker;
    document.getElementById('pmLtAllCats').onclick = () => startLevelTest(level, null);

    const startBtn = document.getElementById('pmLtStartCats');
    function refreshStartBtn(){
      const n = selected.size;
      startBtn.textContent = n>0 ? (window.t?window.t('pm_start_exam_n')(n):('Sınava Başla ('+n+' kategori)')) : (window.t?window.t('pm_start_exam'):'Sınava Başla');
      startBtn.disabled = n===0;
      startBtn.style.opacity = n>0 ? '1' : '.4';
    }
    document.querySelectorAll('.pm-cat-card').forEach(el=>{
      el.onclick = () => {
        const c = el.dataset.cat;
        if(selected.has(c)){ selected.delete(c); el.classList.remove('sel'); }
        else { selected.add(c); el.classList.add('sel'); }
        refreshStartBtn();
      };
    });
    startBtn.onclick = () => { if(selected.size>0) startLevelTest(level, Array.from(selected)); };
  }

  function startLevelTest(level, categories){
    let pool = poolForActiveLang().filter(v=>v.level===level);
    if(categories && categories.length){
      pool = pool.filter(v=>categories.includes(v.cat));
    }
    if(pool.length < 4){
      showToast(window.t?window.t('toast_not_enough_words'):'Bu seçimde yeterli kelime yok'); openLevelTestCategoryPicker(level); return;
    }
    const order = shuffle(pool.slice());
    ltState = { level, categories: categories||null, order, idx:0, correct:0, learnedKeys:[] };
    ltSaveProgress();
    renderLevelTestQuestion();
  }

  function renderLevelTestQuestion(){
    if(!ltState) return;
    if(ltState.idx >= ltState.order.length){ finishLevelTest(); return; }
    const v = ltState.order[ltState.idx];
    const distractors = pickCategoryDistractors(v, 3);
    const correctBack = BACK_W(v);
    const opts = shuffle([correctBack].concat(distractors.map(d=>BACK_W(d))));
    let answered = false;
    const barHtml = '<div class="pm-session-bar"><span>Soru '+(ltState.idx+1)+' / '+ltState.order.length+'</span><span>🎓 '+ltState.level+' Seviye Tespit</span></div>'+
      '<div class="pm-bar" style="margin-bottom:14px;"><div class="pm-bar-fill" style="width:'+Math.round((ltState.idx/ltState.order.length)*100)+'%"></div></div>';
    root.innerHTML = '<div class="pm-root">'+barHtml+
      '<div class="pm-study-card" style="cursor:default;"><div class="pm-mode-tag">'+t('quiz_prompt')+'</div>'+
      '<div class="pm-word" dir="'+FRONT_DIR(v)+'">'+escapeHtml(FRONT_W(v))+'</div>'+
      '<div class="pm-word-sub">'+escapeHtml(((typeof catName==='function')?catName(v.cat):v.cat)||v.pos||'')+'</div></div>'+
      '<div class="pm-options" id="pmOptions"></div>'+
      '<button type="button" class="ctrl primary" id="pmLtExit" style="width:100%;margin-top:16px;">'+(window.t?window.t('pm_save_exit'):'← Kaydet ve Çık')+'</button></div>';
    const wrap = document.getElementById('pmOptions');
    document.getElementById('pmLtExit').onclick = () => { ltSaveProgress(); ltState = null; openLevelTestPicker(); };
    opts.forEach(o=>{
      const b = document.createElement('button');
      b.className = 'pm-opt'; b.textContent = o;
      b.onclick = () => {
        if(answered) return;
        answered = true;
        const ok = (o === correctBack);
        if(ok){
          ltState.correct++;
          ltState.learnedKeys.push(wordKeyFor(v));
        }
        document.querySelectorAll('#pmOptions .pm-opt').forEach(x=>{
          x.disabled = true;
          if(x.textContent === correctBack) x.classList.add('correct');
          else if(x===b && !ok) x.classList.add('wrong');
        });
        setTimeout(()=>{ ltState.idx++; ltSaveProgress(); renderLevelTestQuestion(); }, 650);
      };
      wrap.appendChild(b);
    });
  }

  function finishLevelTest(){
    const { level, categories, order, correct, learnedKeys } = ltState;
    ltClearProgress();
    /* doğru cevaplanan kelimeler doğrudan "bilinen" listesine geçer */
    const y = todayStr();
    learnedKeys.forEach(k=>{
      const v = order.find(x=>wordKeyFor(x)===k);
      let rec = (v && getRecord(v)) || wordProgress[k] || { seen:0, correct:0, wrong:0, known:false, lang:v?v.lang:activeLang, level:v?v.level:level, cat:v?v.cat:null };
      rec.seen = (rec.seen||0)+1;
      rec.correct = (rec.correct||0)+1;
      if(!rec.known){ rec.known = true; rec.learnedDate = y; }
      wordProgress[k] = rec;
    });
    meta.levelTest = meta.levelTest || {};
    meta.levelTest[ltKey(level)] = { ts: Date.now(), lastScore: correct, lastTotal: order.length };
    addXp(100, window.t ? window.t('toast_level_test_done')(level) : ('Seviye tespit sınavı: '+level+' tamamlandı'));
    persistMeta();
    try{
      const ref = dbRef('progress/'+currentKey+'/words');
      if(ref) learnedKeys.forEach(k=>ref.child(k).set(wordProgress[k]).catch(()=>{}));
    }catch(e){}

    const pct = Math.round((correct/order.length)*100);
    const scopeTxt = (categories && categories.length) ? t('pm_scope_categories')(categories.length) : t('pm_scope_all_categories');
    let html = '<div class="pm-root"><div class="pm-head"><div class="pm-eyebrow">'+t('pm_exam_completed')+'</div>'+
      '<div class="pm-title">'+t('pm_level_result')(level)+'</div>'+
      '<div class="pm-sub">'+t('pm_result_summary')(correct, order.length, pct, scopeTxt, 100, learnedKeys.length)+'</div></div>'+
      '<button type="button" class="ctrl primary" id="pmBackHome2" style="width:100%;margin-top:8px;">'+t('pm_back_home')+'</button></div>';
    root.innerHTML = html;
    document.getElementById('pmBackHome2').onclick = openLevelTestPicker;
    ltState = null;
  }

  function startSession(){
    batch = pickBatch();
    if(batch.length === 0){
      root.innerHTML = '<div class="pm-root"><div class="pm-empty">'+(studyCategory()?escapeHtml(focusText(5)):t('pm_no_new_words_level')+'<br><br>'+t('pm_try_general_review'))+'</div><span class="pm-back-link" id="pmBackHome">'+t('pm_back_home')+'</span></div>';
      document.getElementById('pmBackHome').onclick = renderHome;
      return;
    }
    beginBatchFlow();
  }

  function startDailyReview(){
    const list = dailyReviewWords();
    if(list.length === 0){ renderHome(); return; }
    shuffle(list);
    reviewMode = { kind:'daily', group:(window.t?window.t('pm_daily_review_group'):'Günlük Tekrar'), order:list, idx:0, stats:{ total:list.length, correct:0, wrong:0 } };
    renderReviewCard();
  }

  function beginBatchFlow(){
    batchResult = {};
    batch.forEach(item => { batchResult[item.key] = { quizOk:null, listenOk:null, fillOk:null }; });
    cardIdx = 0;
    sessionStats = { total:0, correct:0, wrong:0, xp:0, newKnown:0, newBadges:[], mistakes:[] };
    renderCardsPhase();
  }

  function renderCardsPhase(){
    if(cardIdx >= batch.length){
      quizOrder = shuffle(batch.map((_,i)=>i));
      quizIdx = 0;
      renderQuizPhase();
      return;
    }
    const v = batch[cardIdx].v;
    const L = LANGS[v.lang];
    const barHtml = '<div class="pm-session-bar"><span>'+(window.t?window.t('pm_intro_label'):'Tanışma')+' '+(cardIdx+1)+' / '+batch.length+'</span><span>'+(window.t?window.t('pm_step')(1,4):'Adım 1/4')+'</span></div><div class="pm-bar" style="margin-bottom:14px;"><div class="pm-bar-fill" style="width:'+Math.round((cardIdx/batch.length)*100)+'%"></div></div>';
    let flipped = false;
    const catEmoji = (window.CAT_EMOJI && window.CAT_EMOJI[v.cat]) || '📖';
    function draw(){
      let html = '<div class="pm-root">'+barHtml;
      /* Kartlar sekmesiyle BİREBİR AYNI markup/CSS/flip animasyonu (.stage/.card/.face) */
      html += '<div class="stage"><div class="card'+(flipped?' flipped':'')+'" id="pmCard">'+
        '<div class="face face-front"><div class="card-bg-emoji">'+catEmoji+'</div>'+
        '<div class="level-badge">'+(v.level||'')+'</div>'+
        '<div class="tag">'+FRONT_LABEL()+'</div>'+
        '<div class="word" dir="'+FRONT_DIR(v)+'">'+escapeHtml(FRONT_W(v))+'</div>'+
        '<div class="pos">'+escapeHtml(((typeof catName==='function')?catName(v.cat):v.cat)||v.pos||'')+'</div>'+
        '<div class="example" dir="'+FRONT_DIR(v)+'">'+(FRONT_EX(v) ? colorSplit(FRONT_EX(v), FRONT_W(v), v.c1, v.c2) : '')+'</div>'+
        '<div class="speak-controls">'+
          '<div class="speak-item"><button type="button" class="speak-icon-btn" id="pmRabbit" title="Normal hızda dinle">🔊</button><span class="speak-lbl">'+t('normal_speed')+'</span></div>'+
          '<div class="speak-item"><button type="button" class="speak-icon-btn" id="pmTurtle" title="Yavaş dinle">🐢</button><span class="speak-lbl">'+t('slow_speed')+'</span></div>'+
        '</div><div class="speak-caption">'+t('tap_to_listen')+'</div></div>'+
        '<div class="face face-back"><div class="card-bg-emoji">'+catEmoji+'</div>'+
        '<div class="level-badge">'+(v.level||'')+'</div>'+
        '<div class="tag">'+BACK_LABEL()+'</div>'+
        '<div class="word" dir="'+BACK_DIR(v)+'">'+escapeHtml(BACK_W(v))+'</div>'+
        '<div class="example" dir="'+BACK_DIR(v)+'">'+(BACK_EX(v) ? escapeHtml(BACK_EX(v)) : '')+'</div></div>'+
        '</div></div>';
      html += '<div class="hint">Çevirmek için karta dokun</div>';
      html += '<button class="pm-btn primary" id="pmNextCard">'+pmCopy('nextWord', 'Sonraki Kelime')+'</button>';
      html += '</div>';
      root.innerHTML = html;
      // Karta her tıklandığında SADECE kelime/Türkçe arasında geçiş yapar
      // (Kartlar sekmesindeki mantıkla birebir aynı) — bir sonraki kelimeye
      // GEÇMEZ. İlerlemek için ayrı "Sonraki Kelime" butonu kullanılır.
      document.getElementById('pmCard').onclick = () => {
        flipped = !flipped;
        draw();
        if(!flipped) pmSpeak(FRONT_W(v), FRONT_VOICE(v), false);
      };
      document.getElementById('pmNextCard').onclick = (e) => {
        e.stopPropagation();
        cardIdx++;
        renderCardsPhase();
      };
      const rb = document.getElementById('pmRabbit'), tb = document.getElementById('pmTurtle');
      if(rb) rb.onclick = (e)=>{ e.stopPropagation(); pmSpeak(FRONT_W(v), FRONT_VOICE(v), false); };
      if(tb) tb.onclick = (e)=>{ e.stopPropagation(); pmSpeak(FRONT_W(v), FRONT_VOICE(v), true); };
    }
    draw();
    pmSpeak(FRONT_W(v), FRONT_VOICE(v), false);
  }

  /* ============================== ÇELDİRİCİ ÜRETİMİ (akıllı yanlış şıklar)
     Amaç: kelimeyi bilmeyen biri sadece "hangisi tanıdık" diye rastgele
     doğru cevaba basamasın. İki mod var:
     1) pickCategoryDistractors — büyük havuzlar için (Seviye Tespit,
        Günlük/Genel Tekrar): TÜM yanlış şıklar sorunun KATEGORİSİNDEN gelir.
     2) pickBatchDistractors — küçük 10 kelimelik oturum için (Kişisel
        Quiz/Dinleme): 2 şık kategoriden, 1 şık o an çalışılan diğer
        kelimelerden (tuzak) — "bugün öğrendiğim kelime" ezberiyle rastgele
        doğru cevaba basmayı zorlaştırır. */
  function pickCategoryDistractors(v, count, exclude){
    exclude = exclude || [];
    let pool = poolForActiveLang().filter(x=>x.cat===v.cat && x.w!==v.w && !exclude.some(e=>e.w===x.w));
    if(pool.length < count){
      let fallback = poolForActiveLang().filter(x=>x.level===v.level && x.w!==v.w &&
                                      !exclude.some(e=>e.w===x.w) && !pool.some(p=>p.w===x.w));
      shuffle(fallback);
      pool = pool.concat(fallback);
    }
    if(pool.length < count){
      let fallback2 = poolForActiveLang().filter(x=>x.w!==v.w &&
                                       !exclude.some(e=>e.w===x.w) && !pool.some(p=>p.w===x.w));
      shuffle(fallback2);
      pool = pool.concat(fallback2);
    }
    shuffle(pool);
    return pool.slice(0, count);
  }
  function pickBatchDistractors(v, count, batchWords){
    const catPicks = pickCategoryDistractors(v, Math.max(0, count-1));
    let result = catPicks.slice();
    const usedWords = [v].concat(result);
    const trapPool = shuffle((batchWords||[]).filter(x=>x.w!==v.w && !usedWords.some(u=>u.w===x.w)));
    if(trapPool[0]){
      result.push(trapPool[0]);
    } else {
      const extra = pickCategoryDistractors(v, 1, result);
      if(extra[0]) result.push(extra[0]);
    }
    shuffle(result);
    return result.slice(0, count);
  }

  function renderQuizPhase(){
    if(quizIdx >= quizOrder.length){
      listenOrder = shuffle(batch.map((_,i)=>i));
      listenIdx = 0;
      renderListenPhase();
      return;
    }
    currentAnswered = false;
    const item = batch[quizOrder[quizIdx]];
    const v = item.v;
    const distractors = pickBatchDistractors(v, 3, batch.map(it=>it.v));
    const correctBack = BACK_W(v);
    const opts = shuffle([correctBack].concat(distractors.map(d=>BACK_W(d))));
    const barHtml = '<div class="pm-session-bar"><span>'+(window.t?window.t('pm_question_label'):'Soru')+' '+(quizIdx+1)+' / '+batch.length+'</span><span>'+(window.t?window.t('pm_step_meaning')(2,4):'Adım 2/4 - Anlam Testi')+'</span></div><div class="pm-bar" style="margin-bottom:14px;"><div class="pm-bar-fill" style="width:'+Math.round((quizIdx/batch.length)*100)+'%"></div></div>';
    root.innerHTML = '<div class="pm-root">'+barHtml+
      '<div class="pm-study-card" style="cursor:default;"><div class="pm-mode-tag">'+t('quiz_prompt')+'</div><div class="pm-word" dir="'+FRONT_DIR(v)+'">'+escapeHtml(FRONT_W(v))+'</div><div class="pm-word-sub">'+escapeHtml(((typeof catName==='function')?catName(v.cat):v.cat)||v.pos||'')+'</div><div class="speak-controls"><div class="speak-item"><button type="button" class="speak-icon-btn" id="pmRabbit">🔊</button><span class="speak-lbl">'+t('normal_speed')+'</span></div><div class="speak-item"><button type="button" class="speak-icon-btn" id="pmTurtle">🐢</button><span class="speak-lbl">'+t('slow_speed')+'</span></div></div><div class="speak-caption">'+t('tap_to_listen')+'</div></div>'+
      '<div class="pm-options" id="pmOptions"></div></div>';
    document.getElementById('pmRabbit').onclick = () => pmSpeak(FRONT_W(v), FRONT_VOICE(v), false);
    document.getElementById('pmTurtle').onclick = () => pmSpeak(FRONT_W(v), FRONT_VOICE(v), true);
    const wrap = document.getElementById('pmOptions');
    opts.forEach(o=>{
      const b = document.createElement('button');
      b.className = 'pm-opt'; b.textContent = o;
      b.onclick = () => {
        if(currentAnswered) return;
        currentAnswered = true;
        const ok = (o === correctBack);
        batchResult[item.key].quizOk = ok;
        document.querySelectorAll('#pmOptions .pm-opt').forEach(x=>{
          x.disabled = true;
          if(x.textContent === correctBack) x.classList.add('correct');
          else if(x===b && !ok) x.classList.add('wrong');
        });
        setTimeout(()=>{ quizIdx++; renderQuizPhase(); }, 650);
      };
      wrap.appendChild(b);
    });
  }

  function renderListenPhase(){
    if(listenIdx >= listenOrder.length){
      fillOrder = shuffle(batch.map((_,i)=>i));
      fillIdx = 0;
      renderFillPhase();
      return;
    }
    currentAnswered = false;
    const item = batch[listenOrder[listenIdx]];
    const v = item.v;
    const distractors = pickBatchDistractors(v, 3, batch.map(it=>it.v));
    const correctBack = BACK_W(v);
    const opts = shuffle([correctBack].concat(distractors.map(d=>BACK_W(d))));
    const barHtml = '<div class="pm-session-bar"><span>'+(window.t?window.t('pm_question_label'):'Soru')+' '+(listenIdx+1)+' / '+batch.length+'</span><span>'+(window.t?window.t('pm_step_listening')(3,4):'Adım 3/4 - Dinleme')+'</span></div><div class="pm-bar" style="margin-bottom:14px;"><div class="pm-bar-fill" style="width:'+Math.round((listenIdx/batch.length)*100)+'%"></div></div>';
    root.innerHTML = '<div class="pm-root">'+barHtml+
      '<div class="pm-study-card" style="cursor:default;"><div class="pm-mode-tag">🎧 '+(window.t?window.t('pm_listening_prompt'):'Duydugun kelimenin anlami ne?')+'</div><div class="pm-word" style="font-size:34px;">🎙️</div><div class="speak-controls"><div class="speak-item"><button type="button" class="speak-icon-btn" id="pmRabbit" title="'+(window.t?window.t('normal_speed'):'Hızlı tekrar dinle')+'">🔊</button><span class="speak-lbl">'+t('normal_speed')+'</span></div><div class="speak-item"><button type="button" class="speak-icon-btn" id="pmTurtle" title="'+(window.t?window.t('slow_speed'):'Yavaş dinle')+'">🐢</button><span class="speak-lbl">'+t('slow_speed')+'</span></div></div><div class="speak-caption">'+t('tap_to_listen')+'</div></div>'+
      '<div class="pm-options" id="pmOptions"></div></div>';
    const playFast = () => pmSpeak(FRONT_W(v), FRONT_VOICE(v), false);
    const playSlow = () => pmSpeak(FRONT_W(v), FRONT_VOICE(v), true);
    document.getElementById('pmRabbit').onclick = playFast;
    document.getElementById('pmTurtle').onclick = playSlow;
    playFast();
    const wrap = document.getElementById('pmOptions');
    opts.forEach(o=>{
      const b = document.createElement('button');
      b.className = 'pm-opt'; b.textContent = o;
      b.onclick = () => {
        if(currentAnswered) return;
        currentAnswered = true;
        const ok = (o === correctBack);
        batchResult[item.key].listenOk = ok;
        document.querySelectorAll('#pmOptions .pm-opt').forEach(x=>{
          x.disabled = true;
          if(x.textContent === correctBack) x.classList.add('correct');
          else if(x===b && !ok) x.classList.add('wrong');
        });
        setTimeout(()=>{ listenIdx++; renderListenPhase(); }, 650);
      };
      wrap.appendChild(b);
    });
  }

  /* ============================== ADIM 4 — BOŞLUK DOLDURMA (yazarak)
     Örnek cümledeki kelime boşluk yapılır ("İch bin ___" gibi), kullanıcı
     yazarak doldurur — tıpkı Duolingo'daki gibi. v.ex yoksa bu kelime
     atlanır (tüm kelimelerde örnek cümle olmayabilir). */
  function blankSentence(sentence, word){
    const range = (typeof findStemMatch === 'function') ? findStemMatch(sentence, word) : null;
    if(!range) return null;
    return {
      before: sentence.slice(0, range.start),
      answer: sentence.slice(range.start, range.end),
      after: sentence.slice(range.end)
    };
  }

  /* ============================== BOŞLUK DOLDURMA — AKILLI EŞLEŞTİRME
     Amaç kelimeyi doğru YAZMAK, gramer çekimini test etmek değil. Bu yüzden:
     1) Noktalama işaretleri yok sayılır ("Leihen?" ~ "leihen").
     2) Küçük yazım hataları (özellikle ä/ö/ü gibi tek harf farkları)
        tolere edilir — kelime uzunluğuna göre ölçeklenen bir eşik ile.
     3) Cümledeki çekimli hâl (ör. "bedeutet") YERİNE öğrenilen sözlük
        hâli (v.w, ör. "bedeuten") de kabul edilir. */
  function fillNormalize(s){
    return String(s||'')
      .trim()
      .toLocaleLowerCase('tr')
      .replace(/[.,!?;:"'„"«»…()\[\]]/g, '')  /* noktalama tamamen at */
      .replace(/\s+/g, ' ')
      .trim();
  }
  function levenshtein(a, b){
    if(a === b) return 0;
    const al = a.length, bl = b.length;
    if(al === 0) return bl;
    if(bl === 0) return al;
    let prev = new Array(bl+1);
    for(let j=0; j<=bl; j++) prev[j] = j;
    for(let i=1; i<=al; i++){
      const cur = [i];
      for(let j=1; j<=bl; j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost);
      }
      prev = cur;
    }
    return prev[bl];
  }
  function fillWordsMatch(userRaw, correctRaw){
    const u = fillNormalize(userRaw);
    const c = fillNormalize(correctRaw);
    if(!u) return false;
    if(u === c) return true;
    /* uzunluğa göre ölçeklenen tolerans: çok kısa kelimede yazım hatası
       payı verilmez (anlamsız hâle gelir), uzun kelimede 1-2 harf affedilir */
    const maxLen = Math.max(u.length, c.length);
    const tolerance = maxLen <= 3 ? 0 : (maxLen <= 7 ? 1 : 2);
    return levenshtein(u, c) <= tolerance;
  }

  function renderFillPhase(){
    if(fillIdx >= fillOrder.length){
      finalizeBatch();
      return;
    }
    const item = batch[fillOrder[fillIdx]];
    const v = item.v;
    const blanked = FRONT_EX(v) ? blankSentence(FRONT_EX(v), FRONT_W(v)) : null;
    if(!blanked){ fillIdx++; renderFillPhase(); return; } // örnek cümlesi yoksa atla

    const barHtml = '<div class="pm-session-bar"><span>'+(window.t?window.t('pm_question_label'):'Soru')+' '+(fillIdx+1)+' / '+batch.length+'</span><span>'+(window.t?window.t('pm_step_fill')(4,4):'Adım 4/4 - Boşluk Doldurma')+'</span></div><div class="pm-bar" style="margin-bottom:14px;"><div class="pm-bar-fill" style="width:'+Math.round((fillIdx/batch.length)*100)+'%"></div></div>';
    root.innerHTML = '<div class="pm-root">'+barHtml+
      '<div class="pm-study-card" style="cursor:default;"><div class="pm-mode-tag">'+t('fill_blank')+'</div>'+
      '<div class="pm-fill-row" id="pmFillRow" dir="'+FRONT_DIR(v)+'">'+escapeHtml(blanked.before)+'<b>_____</b>'+escapeHtml(blanked.after)+'</div>'+
      '<div class="pm-word-sub" style="margin-top:10px;">'+escapeHtml(BACK_EX(v)||BACK_W(v)||'')+'</div>'+
      '<div class="speak-controls"><div class="speak-item"><button type="button" class="speak-icon-btn" id="pmRabbit" title="Normal hızda dinle">🔊</button><span class="speak-lbl">'+t('normal_speed')+'</span></div><div class="speak-item"><button type="button" class="speak-icon-btn" id="pmTurtle" title="Yavaş dinle">🐢</button><span class="speak-lbl">'+t('slow_speed')+'</span></div></div><div class="speak-caption">'+t('tap_to_listen')+'</div></div>'+
      '<input type="text" class="pm-fill-input" id="pmFillInput" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="'+pmCopy('fillPlaceholder','Buraya yaz…')+'" style="margin-bottom:12px;">'+
      '<div class="pm-fill-fb" id="pmFillFb"></div>'+
      '<button class="pm-btn primary" id="pmFillCheck">'+(window.t?window.t('wp_check_btn'):'Kontrol Et')+'</button>'+
      '<button class="pm-btn primary" id="pmFillNext" style="display:none;">Devam</button></div>';

    document.getElementById('pmRabbit').onclick = () => pmSpeak(FRONT_EX(v), FRONT_VOICE(v), false);
    document.getElementById('pmTurtle').onclick = () => pmSpeak(FRONT_EX(v), FRONT_VOICE(v), true);
    pmSpeak(FRONT_EX(v), FRONT_VOICE(v), false); /* soru gelince otomatik bir kez oku */

    const input = document.getElementById('pmFillInput');
    const fb = document.getElementById('pmFillFb');
    const checkBtn = document.getElementById('pmFillCheck');
    const nextBtn = document.getElementById('pmFillNext');
    input.focus();
    function check(){
      const typed = input.value || '';
      /* Hem cümledeki çekimli hâl hem de öğrenilen sözlük hâli (FRONT_W)
         kabul edilir — amaç kelimeyi doğru yazmak, çekimi test etmek değil. */
      const ok = fillWordsMatch(typed, blanked.answer) || fillWordsMatch(typed, FRONT_W(v));
      batchResult[item.key].fillOk = ok;
      /* Kontrol Et'e basınca boşluk, doğru kelimeyle ve farklı renkte
         dolduruluyor — kelime doğru şekliyle görsel olarak pekişsin. */
      const fillRow = document.getElementById('pmFillRow');
      if(fillRow){
        fillRow.innerHTML = escapeHtml(blanked.before) +
          '<b style="color:'+(ok?'#3dffa0':'#ff8a8a')+'">'+escapeHtml(blanked.answer)+'</b>' +
          escapeHtml(blanked.after);
      }
      fb.textContent = ok ? (window.t?window.t('fill_correct'):'✅ Doğru!') : ((window.t?window.t('pm_correct_answer'):'Doğrusu:')+' '+blanked.answer);
      fb.className = 'pm-fill-fb ' + (ok ? 'ok' : 'bad');
      input.disabled = true; checkBtn.style.display = 'none'; nextBtn.style.display = '';
    }
    checkBtn.onclick = check;
    input.addEventListener('keydown', e=>{ if(e.key==='Enter') check(); });
    nextBtn.onclick = () => { fillIdx++; renderFillPhase(); };
  }

  function finalizeBatch(){
    meta.studySessionCount = (meta.studySessionCount||0) + 1;
    const now = Date.now();
    batch.forEach(item => {
      const v = item.v, key = item.key;
      const res = batchResult[key];
      /* Bir kelime "bilinen" sayılması için Anlam Testi + Dinleme + Boşluk
         Doldurma adımlarının ÜÇÜNÜ DE geçmesi gerekir. fillOk === false
         (yanlış yazıldı) → bilinmez. fillOk === null (bu kelimenin örnek
         cümlesi yoktu, Adım 4'te hiç sorulmadı) → bu adım için nötr sayılır,
         cezalandırılmaz. */
      const bothOk = res.quizOk === true && res.listenOk === true && res.fillOk !== false;
      let rec = getRecord(v) || { seen:0, correct:0, wrong:0, known:false, retryAfterSession:null, lang:v.lang, level:v.level, cat:v.cat };
      rec.seen = (rec.seen||0) + 1;
      sessionStats.total++;
      if(bothOk){
        rec.correct = (rec.correct||0) + 1;
        if(!rec.known){
          rec.known = true;
          rec.retryAfterSession = null;
          rec.learnedDate = todayStr();
          sessionStats.newKnown++;
          meta.todayCount = (meta.todayCount||0) + 1;
          meta.xp = (meta.xp||0) + XP_PER_NEW_WORD;
        }
        sessionStats.correct++;
      } else {
        rec.wrong = (rec.wrong||0) + 1;
        rec.known = false;
        rec.retryAfterSession = meta.studySessionCount + RETRY_SESSION_GAP;
        sessionStats.wrong++;
        sessionStats.mistakes.push({ word:FRONT_W(v), tr:BACK_W(v) });
      }
      rec.lastSeen = now;
      wordProgress[key] = rec;
    });
    persistLocalMirror();
    batch.forEach(item => {
      const ref = dbRef('progress/'+currentKey+'/words/'+item.key);
      if(ref) ref.set(wordProgress[item.key]).catch(()=>{});
    });
    markStudyToday();
    checkThresholdTasks();
    checkBadges();
    sessionStats.xp = sessionStats.newKnown * XP_PER_NEW_WORD;
    persistMeta();
    renderSessionSummary();
  }

  function renderSessionSummary(){
    pmInWritingFlow = false;
    const s = sessionStats;
    try{document.body.classList.add('pm-active');}catch(e){}
    try{['langBox','langPair','levelBox','chips'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}catch(e){}
    let html = '<div class="pm-root">';
    html += '<div class="pm-head"><div class="pm-eyebrow">'+t('pm_session_complete')+'</div><div class="pm-title">'+t('pm_great_job')+'</div><div class="pm-sub">'+t('pm_session_summary')(s.newKnown, s.xp)+'</div></div>';
    html += '<div class="pm-card"><h4>'+t('pm_result')+'</h4><div class="pm-stat-grid"><div class="pm-stat-box"><div class="pm-stat-num">'+s.newKnown+'</div><div class="pm-stat-label">'+t('pm_newly_learned')+'</div></div><div class="pm-stat-box"><div class="pm-stat-num">'+s.wrong+'</div><div class="pm-stat-label">'+t('pm_needs_review')+'</div></div></div></div>';
    if(s.newBadges.length){
      html += '<div class="pm-card"><h4>'+t('pm_new_badges')+'</h4><div class="pm-weak-meta">'+s.newBadges.map(function(n){ return '🏅 '+t('pm_word_badge')(n); }).join('<br>')+'</div></div>';
    }
    if(s.mistakes.length){
      html += '<button class="pm-btn small" id="pmSeeMistakes">'+t('pm_see_review_words')(s.mistakes.length)+'</button>';
    }
    html += '<button class="pm-btn primary" id="pmBackHomeBtn">'+t('pm_back_home_btn')+'</button></div>';
    root.innerHTML = html;
    document.getElementById('pmBackHomeBtn').onclick = renderHome;
    if(s.mistakes.length){
      document.getElementById('pmSeeMistakes').onclick = () => {
        let h2 = '<div class="pm-root"><div class="pm-head"><div class="pm-title">'+t('pm_review_words_title')+'</div><div class="pm-sub">'+t('pm_review_words_desc')+'</div></div>';
        s.mistakes.forEach(m=>{
          h2 += '<div class="pm-weak-item"><div class="pm-weak-word">'+escapeHtml(m.word)+'</div><div class="pm-weak-meta">'+t('pm_correct_answer')+' '+escapeHtml(m.tr)+'</div></div>';
        });
        h2 += '<button class="pm-btn primary" id="pmBackSummary">'+t('pm_go_back')+'</button></div>';
        root.innerHTML = h2;
        document.getElementById('pmBackSummary').onclick = renderSessionSummary;
      };
    }
  }

  function startGeneralReview(groupName){
    const group = levelGroups().find(g=>g.name===groupName);
    if(!group) return;
    const list = poolForActiveLang().filter(v=>group.levels.includes(v.level));
    const known = list.filter(v=>{ const r=getRecord(v); return r && r.known; });
    if(known.length === 0){
      root.innerHTML = '<div class="pm-root"><div class="pm-empty">'+t('pm_no_known_in_group')+'</div><span class="pm-back-link" id="pmBackHome">'+t('pm_back_home')+'</span></div>';
      document.getElementById('pmBackHome').onclick = renderHome;
      return;
    }
    shuffle(known);
    reviewMode = { kind:'level', group: groupName, order: known, idx: 0, stats: { total:known.length, correct:0, wrong:0 } };
    renderReviewCard();
  }

  function renderReviewCard(){
    if(reviewMode.idx >= reviewMode.order.length){ finalizeReview(); return; }
    currentAnswered = false;
    const v = reviewMode.order[reviewMode.idx];
    const distractors = pickCategoryDistractors(v, 3);
    const correctBack = BACK_W(v);
    const opts = shuffle([correctBack].concat(distractors.map(d=>BACK_W(d))));
    const barHtml = '<div class="pm-session-bar"><span>'+(window.t?window.t('pm_general_review'):'Genel Tekrar')+' ('+reviewMode.group+')</span><span>'+(reviewMode.idx+1)+' / '+reviewMode.order.length+'</span></div><div class="pm-bar" style="margin-bottom:14px;"><div class="pm-bar-fill" style="width:'+Math.round((reviewMode.idx/reviewMode.order.length)*100)+'%"></div></div>';
    root.innerHTML = '<div class="pm-root">'+barHtml+
      '<div class="pm-study-card" style="cursor:default;"><div class="pm-mode-tag">'+t('quiz_prompt')+'</div><div class="pm-word" dir="'+FRONT_DIR(v)+'">'+escapeHtml(FRONT_W(v))+'</div><div class="pm-word-sub">'+escapeHtml(((typeof catName==='function')?catName(v.cat):v.cat)||v.pos||'')+'</div><div class="speak-controls"><div class="speak-item"><button type="button" class="speak-icon-btn" id="pmRabbit">🔊</button><span class="speak-lbl">'+t('normal_speed')+'</span></div><div class="speak-item"><button type="button" class="speak-icon-btn" id="pmTurtle">🐢</button><span class="speak-lbl">'+t('slow_speed')+'</span></div></div><div class="speak-caption">'+t('tap_to_listen')+'</div></div>'+
      '<div class="pm-options" id="pmOptions"></div></div>';
    document.getElementById('pmRabbit').onclick = () => pmSpeak(FRONT_W(v), FRONT_VOICE(v), false);
    document.getElementById('pmTurtle').onclick = () => pmSpeak(FRONT_W(v), FRONT_VOICE(v), true);
    const wrap = document.getElementById('pmOptions');
    opts.forEach(o=>{
      const b = document.createElement('button');
      b.className = 'pm-opt'; b.textContent = o;
      b.onclick = () => {
        if(currentAnswered) return;
        currentAnswered = true;
        const ok = (o === correctBack);
        const key = wordKeyFor(v);
        let rec = getRecord(v);
        if(rec){
          rec.seen = (rec.seen||0)+1;
          rec.lastSeen = Date.now();
          if(ok){ rec.correct=(rec.correct||0)+1; reviewMode.stats.correct++; }
          else {
            rec.wrong=(rec.wrong||0)+1;
            rec.known = false;
            rec.retryAfterSession = null;
            reviewMode.stats.wrong++;
          }
          wordProgress[key] = rec;
        }
        document.querySelectorAll('#pmOptions .pm-opt').forEach(x=>{
          x.disabled = true;
          if(x.textContent === correctBack) x.classList.add('correct');
          else if(x===b && !ok) x.classList.add('wrong');
        });
        setTimeout(()=>{ reviewMode.idx++; renderReviewCard(); }, 650);
      };
      wrap.appendChild(b);
    });
  }

  function finalizeReview(){
    persistLocalMirror();
    reviewMode.order.forEach(v=>{
      const key = wordKeyFor(v);
      const ref = dbRef('progress/'+currentKey+'/words/'+key);
      if(ref) ref.set(wordProgress[key]).catch(()=>{});
    });
    const stats = reviewMode.stats;
    const isDaily = reviewMode.kind === 'daily';
    if(isDaily){
      awardTask4(stats.total);
    }
    persistMeta();
    const titleEyebrow = isDaily ? (window.t?window.t('pm_daily_review_completed'):'Günlük Tekrar Tamamlandı') : (window.t?window.t('pm_general_review_completed'):'Genel Tekrar Tamamlandı');
    const titleIcon = isDaily ? '📋' : '🔁';
    let html = '<div class="pm-root"><div class="pm-head"><div class="pm-eyebrow">'+titleEyebrow+'</div><div class="pm-title">'+titleIcon+' '+reviewMode.group+'</div><div class="pm-sub">'+(window.t?window.t('quiz_final_score')(stats.correct, stats.total):(stats.correct+' / '+stats.total+' doğru'))+(isDaily ? (' · +'+(stats.total*2)+' XP') : '')+'</div></div>';
    if(stats.wrong>0){
      html += '<div class="pm-weak-meta" style="text-align:center;margin-bottom:14px;">'+(window.t?window.t('pm_returned_to_unknown')(stats.wrong):(stats.wrong+' kelime bilinmiyor listesine geri döndü, normal çalışmada tekrar karşına çıkacak.'))+'</div>';
    }
    html += '<button class="pm-btn primary" id="pmBackHomeBtn">'+(window.t?window.t('pm_back_home_btn'):'Ana Sayfaya Dön')+'</button></div>';
    root.innerHTML = html;
    document.getElementById('pmBackHomeBtn').onclick = renderHome;
    reviewMode = null;
  }

  function renderKnownWords(){
    pmInWritingFlow = false;
    const list = poolForActiveLang().filter(v=>{ const r=getRecord(v); return r && r.known; });
    let html = '<div class="pm-root"><div class="pm-head"><div class="pm-title">✅ '+t('pm_known')+'</div><div class="pm-sub">'+(window.t?window.t('nb_word_count')(list.length):(list.length+' kelime'))+' ('+(window.isReversed && window.isReversed() ? ((window.t?window.t('lang_names').tr:'Türkçe')) : ((typeof nbLangLabel==='function')?nbLangLabel(activeLang):LANGS[activeLang].label))+')</div></div>';
    if(list.length===0){
      html += '<div class="pm-empty">'+(window.t?window.t('pm_no_known_words'):'Henüz öğrenilmiş kelime yok - çalışmaya başla!')+'</div>';
    } else {
      list.slice(0,300).forEach(v=>{
        html += '<div class="pm-known-item" dir="'+FRONT_DIR(v)+'"><b>'+escapeHtml(FRONT_W(v))+'</b><span>'+escapeHtml(BACK_W(v))+'</span></div>';
      });
      if(list.length>300) html += '<div class="pm-weak-meta" style="text-align:center;">...ve '+(list.length-300)+' kelime daha</div>';
    }
    html += '<button class="pm-btn primary" id="pmBackHomeBtn" style="margin-top:14px;">'+(window.t?window.t('pm_back_home_btn'):'Ana Sayfaya Dön')+'</button></div>';
    root.innerHTML = html;
    document.getElementById('pmBackHomeBtn').onclick = renderHome;
  }

  function renderWeakWords(){
    pmInWritingFlow = false;
    const entries = poolForActiveLang().map(v=>({key:wordKeyFor(v),rec:getRecord(v),v}))
      .filter(e=>e.rec && (e.rec.wrong||0)>0)
      .sort((a,b)=>(b.rec.wrong||0)-(a.rec.wrong||0)).slice(0,30);

    let html = '<div class="pm-root"><div class="pm-head"><div class="pm-title">📉 '+(window.t?t('pm_weak'):'Hata Yaptığın Kelimeler')+'</div><div class="pm-sub">'+pmCopy('weakDesc','En çok yanlış yaptığın kelimeler')+'</div></div>';
    if(entries.length===0){
      html += '<div class="pm-empty">'+(window.t?window.t('pm_no_mistakes'):'Hic hata yapmamissin - harika! 🎉')+'</div>';
    } else {
      entries.forEach(e=>{
        const v = e.v;
        if(!v) return;
        const status = e.rec.known ? (window.t?window.t('pm_currently_known'):'✅ Su an bilinen kelimeler arasinda') : (window.t?window.t('pm_waiting_retry'):'⏳ Tekrar bekliyor');
        html += '<div class="pm-weak-item"><div class="pm-weak-word" dir="'+FRONT_DIR(v)+'">'+escapeHtml(FRONT_W(v))+' <span style="color:var(--pm-accent);font-size:12px;">- '+escapeHtml(BACK_W(v))+'</span></div><div class="pm-weak-meta">❌ '+(window.t?window.t('pm_wrong_label'):'Yanlış:')+' '+(e.rec.wrong||0)+' - ✅ '+(window.t?window.t('pm_correct_label'):'Doğru:')+' '+(e.rec.correct||0)+' - 👁 '+(window.t?window.t('pm_seen_label'):'Görülme:')+' '+(e.rec.seen||0)+'<br>'+status+'</div></div>';
      });
    }
    html += '<button class="pm-btn primary" id="pmBackHomeBtn2">'+(window.t?window.t('pm_back_home_btn'):'Ana Sayfaya Dön')+'</button></div>';
    root.innerHTML = html;
    document.getElementById('pmBackHomeBtn2').onclick = renderHome;
  }

  /* =========================================================
     YAZMA PRATİĞİ — Çok dilli Metin Düzeltici (CheckYourWrite benzeri)
     Akış: Dil Seç → Seviye Seç (A1-B2) → Yaz & Kontrol Et
     Kontrol, hesaba bağlı kayan 24 saatlik kotayı sunucuda doğrulayan Netlify
     işlevinden geçer. Başarısız kontrol kullanım hakkı düşürmez.
     A1/A2’de üslup önerileri gösterilmez. Türkçe ve Arapça için sunucudaki
     yapay zekâ yedeği, diğer dillerde LanguageTool kullanılır.
     ========================================= */
  const WP_LANGS = [
    { code:'tr', tts:'tr-TR', lt:'tr' },
    { code:'en', tts:'en-US', lt:'en-US' },
    { code:'de', tts:'de-DE', lt:'de-DE' },
    { code:'ar', tts:'ar-SA', lt:'ar'    },
    { code:'fr', tts:'fr-FR', lt:'fr'    },
    { code:'es', tts:'es-ES', lt:'es'    },
    { code:'ru', tts:'ru-RU', lt:'ru-RU' }
  ];
  const WP_LEVELS = ['A1','A2','B1','B2'];
  let wpLang = null;
  let wpLevel = null;
  let wpBusy = false;
  let wpLocalePending = false;
  let wpLastResult = null;

  function wpFindLang(code){
    const w = WP_LANGS.find(x=>x.code===code);
    if(!w) return null;
    const L = (typeof LANGS !== 'undefined' && LANGS[code]) ? LANGS[code] : { label: code };
    const flag = (typeof LANG_FLAGS !== 'undefined' && LANG_FLAGS[code]) ? LANG_FLAGS[code] : '🌐';
    /* Dil adı kullanıcının ANA diline göre gösterilir (nbLangLabel varsa
       onu, yoksa I18N'in lang_names sözlüğünü, o da yoksa Türkçe adı kullanır). */
    let label = L.label;
    if(typeof nbLangLabel === 'function'){ label = nbLangLabel(code); }
    else if(window.t){ const names = window.t('lang_names'); if(names && names[code]) label = names[code]; }
    return { code: w.code, tts: w.tts, lt: w.lt, label: label, flag: flag };
  }

  function wpLevelShowsStyle(level){
    return level === 'B1' || level === 'B2';
  }

  /* Yazma ekranı yardımcıları: seviyeye uygun konu önerisi, cihazda saklanan
     taslak, kelime sayacı, hata türü etiketi ve önerileri metne uygulama. */
  const WP_EXTRA = {
    tr:{words:'{n} kelime',topic:'💡 Konu öner',topicLabel:'Yazma konusu',clear:'Temizle',clearConfirm:'Metnin silinsin mi?',apply:'✔ Düzeltmeleri metnime uygula',applied:'Düzeltmeler metnine uygulandı. İstersen yeniden kontrol et.',copy:'📋 Kopyala',copied:'Kopyalandı',summary:'{words} kelime · {errors} öneri',alternatives:'Seçenekler:',shortcut:'Ctrl + Enter ile de kontrol edebilirsin',draft:'Taslağın bu cihazda saklanır.',
      cats:{spelling:'Yazım',grammar:'Dilbilgisi',punctuation:'Noktalama',casing:'Büyük/küçük harf',style:'Üslup',other:'Öneri'},
      prompts:{A1:['Kendini tanıt: adın, yaşın ve nerede yaşadığın.','Aileni anlat: kaç kişisiniz, ne iş yapıyorlar?','Bugün ne yedin ve içtin? Kısa cümlelerle yaz.','Odanı veya evini anlat: içinde neler var?'],A2:['Geçen hafta sonu ne yaptın? Geçmiş zamanla anlat.','En sevdiğin yemeğin tarifini adım adım yaz.','Bir arkadaşını doğum gününe davet eden kısa bir mesaj yaz.','Şehrindeki en sevdiğin yeri anlat ve nedenini açıkla.'],B1:['Unutamadığın bir yolculuğu anlat: nereye gittin, ne oldu?','Bir otele şikâyet e-postası yaz: sorun neydi, ne istiyorsun?','Sosyal medyanın günlük hayata etkisi hakkındaki düşüncelerini yaz.','Gelecekte nerede yaşamak isterdin? Nedenleriyle anlat.'],B2:['Evden çalışmanın avantajlarını ve dezavantajlarını karşılaştır.','Okullarda yabancı dil öğretimi nasıl daha iyi olabilir? Önerilerini savun.','Yapay zekâ meslekleri nasıl değiştirecek? Görüşünü örneklerle açıkla.','Yaşadığın yerdeki bir sorunu belediye başkanına resmî bir mektupla anlat.']}},
    en:{words:'{n} words',topic:'💡 Suggest a topic',topicLabel:'Writing topic',clear:'Clear',clearConfirm:'Delete your text?',apply:'✔ Apply corrections to my text',applied:'Corrections applied to your text. Check again if you like.',copy:'📋 Copy',copied:'Copied',summary:'{words} words · {errors} suggestions',alternatives:'Options:',shortcut:'You can also check with Ctrl + Enter',draft:'Your draft is kept on this device.',
      cats:{spelling:'Spelling',grammar:'Grammar',punctuation:'Punctuation',casing:'Capitalisation',style:'Style',other:'Suggestion'},
      prompts:{A1:['Introduce yourself: your name, age and where you live.','Describe your family: how many of you are there, and what do they do?','What did you eat and drink today? Write short sentences.','Describe your room or home: what is in it?'],A2:['What did you do last weekend? Use the past tense.','Write the recipe for your favourite dish step by step.','Write a short message inviting a friend to your birthday.','Describe your favourite place in your town and say why.'],B1:['Describe a trip you will never forget: where did you go and what happened?','Write a complaint email to a hotel: what was the problem and what do you want?','Write your thoughts on how social media affects daily life.','Where would you like to live in the future? Explain why.'],B2:['Compare the advantages and disadvantages of working from home.','How could foreign languages be taught better at school? Argue for your ideas.','How will artificial intelligence change our jobs? Explain with examples.','Write a formal letter to your mayor about a local problem.']}},
    de:{words:'{n} Wörter',topic:'💡 Thema vorschlagen',topicLabel:'Schreibthema',clear:'Leeren',clearConfirm:'Text löschen?',apply:'✔ Korrekturen in meinen Text übernehmen',applied:'Korrekturen übernommen. Prüfe den Text gern noch einmal.',copy:'📋 Kopieren',copied:'Kopiert',summary:'{words} Wörter · {errors} Hinweise',alternatives:'Möglichkeiten:',shortcut:'Prüfen geht auch mit Strg + Enter',draft:'Dein Entwurf bleibt auf diesem Gerät gespeichert.',
      cats:{spelling:'Rechtschreibung',grammar:'Grammatik',punctuation:'Zeichensetzung',casing:'Groß-/Kleinschreibung',style:'Stil',other:'Hinweis'},
      prompts:{A1:['Stell dich vor: Name, Alter und Wohnort.','Beschreib deine Familie: Wie viele seid ihr, und was machen sie?','Was hast du heute gegessen und getrunken? Schreib kurze Sätze.','Beschreib dein Zimmer oder deine Wohnung: Was gibt es dort?'],A2:['Was hast du letztes Wochenende gemacht? Erzähl in der Vergangenheit.','Schreib das Rezept deines Lieblingsgerichts Schritt für Schritt.','Schreib eine kurze Einladung zu deinem Geburtstag an einen Freund.','Beschreib deinen Lieblingsort in deiner Stadt und sag, warum.'],B1:['Erzähl von einer unvergesslichen Reise: Wohin ging es, und was ist passiert?','Schreib eine Beschwerde-E-Mail an ein Hotel: Was war das Problem, was möchtest du?','Schreib deine Meinung dazu, wie soziale Medien den Alltag beeinflussen.','Wo möchtest du in Zukunft leben? Begründe deine Antwort.'],B2:['Vergleiche Vor- und Nachteile der Arbeit im Homeoffice.','Wie könnte man Fremdsprachen in der Schule besser unterrichten? Begründe deine Vorschläge.','Wie wird künstliche Intelligenz unsere Berufe verändern? Erkläre mit Beispielen.','Schreib einen formellen Brief an die Bürgermeisterin über ein Problem vor Ort.']}},
    ar:{words:'{n} كلمة',topic:'💡 اقترح موضوعًا',topicLabel:'موضوع الكتابة',clear:'مسح',clearConfirm:'هل تريد حذف النص؟',apply:'✔ طبّق التصحيحات على نصي',applied:'طُبّقت التصحيحات على نصك. يمكنك التدقيق مجددًا.',copy:'📋 نسخ',copied:'تم النسخ',summary:'{words} كلمة · {errors} اقتراحات',alternatives:'خيارات:',shortcut:'يمكنك التدقيق أيضًا بـ Ctrl + Enter',draft:'تُحفظ مسودتك على هذا الجهاز.',
      cats:{spelling:'إملاء',grammar:'نحو',punctuation:'ترقيم',casing:'حالة الأحرف',style:'أسلوب',other:'اقتراح'},
      prompts:{A1:['عرّف بنفسك: اسمك وعمرك وأين تسكن.','صف عائلتك: كم عددكم وماذا يعملون؟','ماذا أكلت وشربت اليوم؟ اكتب جملًا قصيرة.','صف غرفتك أو بيتك: ماذا يوجد فيه؟'],A2:['ماذا فعلت في عطلة نهاية الأسبوع الماضية؟ استخدم الماضي.','اكتب وصفة طبقك المفضل خطوة بخطوة.','اكتب رسالة قصيرة تدعو فيها صديقًا إلى عيد ميلادك.','صف مكانك المفضل في مدينتك وقل لماذا.'],B1:['احكِ عن رحلة لا تنساها: إلى أين ذهبت وماذا حدث؟','اكتب بريد شكوى إلى فندق: ما المشكلة وماذا تطلب؟','اكتب رأيك في تأثير وسائل التواصل الاجتماعي على الحياة اليومية.','أين تحب أن تعيش في المستقبل؟ اشرح الأسباب.'],B2:['قارن بين مزايا العمل من المنزل وعيوبه.','كيف يمكن تحسين تعليم اللغات الأجنبية في المدارس؟ دافع عن اقتراحاتك.','كيف سيغيّر الذكاء الاصطناعي الوظائف؟ اشرح رأيك بأمثلة.','اكتب رسالة رسمية إلى رئيس البلدية عن مشكلة في منطقتك.']}},
    fr:{words:'{n} mots',topic:'💡 Proposer un sujet',topicLabel:'Sujet d’écriture',clear:'Effacer',clearConfirm:'Effacer ton texte ?',apply:'✔ Appliquer les corrections à mon texte',applied:'Corrections appliquées. Vérifie à nouveau si tu veux.',copy:'📋 Copier',copied:'Copié',summary:'{words} mots · {errors} suggestions',alternatives:'Options :',shortcut:'Tu peux aussi vérifier avec Ctrl + Entrée',draft:'Ton brouillon reste enregistré sur cet appareil.',
      cats:{spelling:'Orthographe',grammar:'Grammaire',punctuation:'Ponctuation',casing:'Majuscules',style:'Style',other:'Suggestion'},
      prompts:{A1:['Présente-toi : ton nom, ton âge et où tu habites.','Décris ta famille : vous êtes combien et que font-ils ?','Qu’as-tu mangé et bu aujourd’hui ? Écris des phrases courtes.','Décris ta chambre ou ton logement : qu’y a-t-il ?'],A2:['Qu’as-tu fait le week-end dernier ? Utilise le passé.','Écris la recette de ton plat préféré étape par étape.','Écris un court message pour inviter un ami à ton anniversaire.','Décris ton endroit préféré dans ta ville et explique pourquoi.'],B1:['Raconte un voyage inoubliable : où es-tu allé et que s’est-il passé ?','Écris un e-mail de réclamation à un hôtel : quel était le problème, que veux-tu ?','Donne ton avis sur l’influence des réseaux sociaux au quotidien.','Où aimerais-tu vivre plus tard ? Explique pourquoi.'],B2:['Compare les avantages et les inconvénients du télétravail.','Comment mieux enseigner les langues étrangères à l’école ? Défends tes idées.','Comment l’intelligence artificielle va-t-elle changer nos métiers ? Donne des exemples.','Écris une lettre formelle au maire au sujet d’un problème local.']}},
    es:{words:'{n} palabras',topic:'💡 Sugerir un tema',topicLabel:'Tema de escritura',clear:'Borrar',clearConfirm:'¿Borrar tu texto?',apply:'✔ Aplicar correcciones a mi texto',applied:'Correcciones aplicadas. Revísalo otra vez si quieres.',copy:'📋 Copiar',copied:'Copiado',summary:'{words} palabras · {errors} sugerencias',alternatives:'Opciones:',shortcut:'También puedes revisar con Ctrl + Enter',draft:'Tu borrador se guarda en este dispositivo.',
      cats:{spelling:'Ortografía',grammar:'Gramática',punctuation:'Puntuación',casing:'Mayúsculas',style:'Estilo',other:'Sugerencia'},
      prompts:{A1:['Preséntate: tu nombre, tu edad y dónde vives.','Describe a tu familia: ¿cuántos sois y a qué se dedican?','¿Qué has comido y bebido hoy? Escribe frases cortas.','Describe tu habitación o tu casa: ¿qué hay en ella?'],A2:['¿Qué hiciste el fin de semana pasado? Usa el pasado.','Escribe la receta de tu plato favorito paso a paso.','Escribe un mensaje corto para invitar a un amigo a tu cumpleaños.','Describe tu lugar favorito de tu ciudad y explica por qué.'],B1:['Cuenta un viaje que nunca olvidarás: ¿adónde fuiste y qué pasó?','Escribe un correo de queja a un hotel: ¿cuál fue el problema y qué pides?','Da tu opinión sobre cómo influyen las redes sociales en la vida diaria.','¿Dónde te gustaría vivir en el futuro? Explica por qué.'],B2:['Compara las ventajas y desventajas del teletrabajo.','¿Cómo podrían enseñarse mejor los idiomas en la escuela? Defiende tus ideas.','¿Cómo cambiará la inteligencia artificial nuestros trabajos? Explícalo con ejemplos.','Escribe una carta formal a tu alcalde sobre un problema local.']}},
    ru:{words:'{n} слов',topic:'💡 Предложить тему',topicLabel:'Тема для письма',clear:'Очистить',clearConfirm:'Удалить текст?',apply:'✔ Применить исправления к тексту',applied:'Исправления применены. При желании проверь ещё раз.',copy:'📋 Копировать',copied:'Скопировано',summary:'Слов: {words} · подсказок: {errors}',alternatives:'Варианты:',shortcut:'Проверить можно и через Ctrl + Enter',draft:'Черновик сохраняется на этом устройстве.',
      cats:{spelling:'Орфография',grammar:'Грамматика',punctuation:'Пунктуация',casing:'Регистр',style:'Стиль',other:'Подсказка'},
      prompts:{A1:['Представься: имя, возраст и где ты живёшь.','Опиши свою семью: сколько вас и чем они занимаются?','Что ты сегодня ел и пил? Пиши короткими предложениями.','Опиши свою комнату или квартиру: что в ней есть?'],A2:['Что ты делал в прошлые выходные? Используй прошедшее время.','Напиши рецепт любимого блюда шаг за шагом.','Напиши другу короткое приглашение на свой день рождения.','Опиши любимое место в своём городе и объясни почему.'],B1:['Расскажи о незабываемой поездке: куда ты ездил и что случилось?','Напиши жалобу в отель: в чём была проблема и чего ты хочешь?','Напиши своё мнение о том, как соцсети влияют на повседневную жизнь.','Где бы ты хотел жить в будущем? Объясни почему.'],B2:['Сравни плюсы и минусы удалённой работы.','Как лучше преподавать иностранные языки в школе? Обоснуй свои идеи.','Как искусственный интеллект изменит профессии? Объясни на примерах.','Напиши официальное письмо мэру о местной проблеме.']}}
  };
  function wpX(key, values){
    let value = (WP_EXTRA[window.NATIVE_LANG] || WP_EXTRA.en)[key];
    if(typeof value === 'string') Object.keys(values || {}).forEach(k => { value = value.replaceAll('{'+k+'}', String(values[k])); });
    return value;
  }
  function wpWordCount(text){ return (String(text).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length; }
  function wpCounterText(text){ return wpX('words', {n: wpWordCount(text)}) + ' · ' + text.length + ' / 4000'; }
  function wpCategory(m){
    const id = String(m.rule && m.rule.category && m.rule.category.id || '').toUpperCase(), type = String(m.rule && m.rule.issueType || '').toLowerCase();
    if(id === 'TYPOS' || type === 'misspelling') return 'spelling';
    if(id === 'CASING') return 'casing';
    if(id === 'PUNCTUATION' || id === 'TYPOGRAPHY' || type === 'typographical') return 'punctuation';
    if(id === 'STYLE' || id === 'REDUNDANCY' || id === 'COLLOQUIALISMS' || type === 'style' || type === 'register') return 'style';
    if(id === 'GRAMMAR' || id === 'CONFUSED_WORDS' || type === 'grammar') return 'grammar';
    return 'other';
  }
  // Drafts are a per-device convenience: an unavailable storage only means
  // the text is not restored next time.
  function wpDraftKey(){ let uid = ''; try{ uid = window.firebase.auth().currentUser.uid || ''; }catch(e){} return 'lumira_wp_draft_v1_' + (uid || 'guest') + '_' + wpLang; }
  function wpReadDraft(){ try{ return localStorage.getItem(wpDraftKey()) || ''; }catch(e){ return ''; } }
  function wpSaveDraft(text){ try{ if(window.LUMIRA_CLEARING_DATA) return; if(text.trim()) localStorage.setItem(wpDraftKey(), text.slice(0, 4000)); else localStorage.removeItem(wpDraftKey()); }catch(e){} }
  let wpTopicIndex = -1, wpDraftTimer = null;
  function wpPaintTopic(){
    const box = document.getElementById('wpTopic'), list = (wpX('prompts') || {})[wpLevel] || [];
    if(!box) return;
    if(wpTopicIndex < 0 || !list[wpTopicIndex]){ box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false; box.innerHTML = '<b>' + escapeHtml(wpX('topicLabel')) + '</b>' + escapeHtml(list[wpTopicIndex]);
  }

  /* ---- 1. adım: dil seçimi ---- */
  function renderWritingLangSelect(){
    pmInWritingFlow = true;
    try{document.body.classList.add('pm-active');}catch(e){}
    try{['langBox','langPair','levelBox','chips'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}catch(e){}
    injectStyles();
    let html = '<div class="pm-root"><div class="pm-head"><div class="pm-title">'+(window.t?window.t('nb_writing_practice'):'✍️ Yazma Pratiği')+'</div><div class="pm-sub">'+(window.t?window.t('wp_choose_lang_sub'):'Hangi dilde yazma pratiği yapmak istersin?')+'</div></div>';
    html += '<div class="feature-quota" data-writing-quota></div>';
    html += '<div class="practice-language-grid">';
    (window.learningLanguageCodes?.()||WP_LANGS.map(l=>l.code)).map(code=>WP_LANGS.find(l=>l.code===code)).filter(l=>l&&l.code!==(window.NATIVE_LANG||'tr')).forEach(l=>{
      const L = (typeof LANGS !== 'undefined' && LANGS[l.code]) ? LANGS[l.code] : { label: l.code };
      html += '<button type="button" class="practice-language" data-lang="'+l.code+'" data-wp-lang="'+l.code+'"><span class="lname">'+escapeHtml((typeof nbLangLabel==='function')?nbLangLabel(l.code):L.label)+'</span></button>';
    });
    html += '</div>';
    html += '<button class="pm-btn small" id="wpBackHomeBtn" style="margin-top:16px;">'+(window.t?window.t('wp_back_to_notebook'):'← Notlarım\'a Dön')+'</button></div>';
    root.innerHTML = html;
    window.LUMIRA_FEATURES.mountWriting(root.querySelector('[data-writing-quota]'));
    root.querySelectorAll('[data-wp-lang]').forEach(el=>{
      window.LUMIRA_LEARNING.decorateLanguage(el,el.dataset.wpLang,window.t('lang_names')?.[el.dataset.wpLang]||el.dataset.wpLang,el.dataset.wpLang===wpLang);
      el.onclick = () => { wpLang = el.getAttribute('data-wp-lang'); wpLevel = null; wpLastResult = null; renderWritingLevelSelect(); };
    });
    document.getElementById('wpBackHomeBtn').onclick = () => window.PM_openWritingPractice();
    document.getElementById('wpBackHomeBtn').textContent='← '+window.LUMIRA_LEARNING.text('title');
  }

  /* ---- 2. adım: seviye seçimi ---- */
  function renderWritingLevelSelect(){
    pmInWritingFlow = true;
    try{document.body.classList.add('pm-active');}catch(e){}
    try{['langBox','langPair','levelBox','chips'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}catch(e){}
    injectStyles();
    const lang = wpFindLang(wpLang);
    if(!lang){ renderWritingLangSelect(); return; }
    let html = '<div class="pm-root"><div class="pm-head"><div class="pm-title">'+lang.flag+' '+lang.label+'</div><div class="pm-sub">'+(window.t?window.t('wp_choose_level_sub'):'Seviyeni seç')+'</div></div>';
    html += '<div class="feature-quota" data-writing-quota></div>';
    html += '<div class="pm-lang-grid" style="grid-template-columns:repeat(2,1fr);">';
    WP_LEVELS.forEach(l=>{
      html += '<div class="pm-lang-card" data-lvl="'+l+'"><div class="nm" style="font-size:16px;font-weight:800;color:#eef4ff;">'+l+'</div></div>';
    });
    html += '</div>';
    html += '<button class="pm-btn small" id="wpBackLangBtn" style="margin-top:16px;">'+(window.t?window.t('nb_back_change_lang'):'← Dili Değiştir')+'</button></div>';
    root.innerHTML = html;
    window.LUMIRA_FEATURES.mountWriting(root.querySelector('[data-writing-quota]'));
    root.querySelectorAll('.pm-lang-card').forEach(el=>{
      el.onclick = () => { wpLevel = el.getAttribute('data-lvl'); wpLastResult = null; wpTopicIndex = -1; renderWritingPractice(); };
    });
    document.getElementById('wpBackLangBtn').onclick = renderWritingLangSelect;
  }

  /* LanguageTool'un offset/length tabanlı 'matches' listesinden orijinal
     metin üzerinde vurgulu görünüm, açıklama listesi ve önerilen düzeltme
     üretir. */
  // Only rule descriptions are translated; the learner's text stays local to
  // LanguageTool. Failure keeps a native-language explanation and correction.
  const wpMessageCache = new Map();
  function wpMessage(m){
    const native = window.NATIVE_LANG || 'tr';
    if(m._messageLang === native && m._message) return m._message;
    const fallback = {
      tr:'Bu bölümde yazım, dilbilgisi veya ifade sorunu olabilir. Yukarıdaki önerilen düzeltmeyi kontrol et.',
      en:'This passage may contain a spelling, grammar or wording issue. Check the suggested correction above.',
      de:'Hier liegt möglicherweise ein Rechtschreib-, Grammatik- oder Ausdrucksfehler vor. Prüfe die vorgeschlagene Korrektur oben.',
      ar:'قد يحتوي هذا الجزء على خطأ إملائي أو نحوي أو تعبيري. راجع التصحيح المقترح أعلاه.',
      fr:'Ce passage peut contenir une erreur d’orthographe, de grammaire ou de formulation. Vérifie la correction proposée ci-dessus.',
      es:'Este fragmento puede contener un error de ortografía, gramática o expresión. Revisa la corrección propuesta arriba.',
      ru:'Возможно, здесь есть орфографическая, грамматическая или речевая ошибка. Проверь предложенное исправление выше.'
    };
    return fallback[native] || fallback.en;
  }
  async function wpLocalizeMessages(matches, source){
    const native = window.NATIVE_LANG || 'tr';
    await Promise.all(matches.map(async m => {
      const message = m.message || m.shortMessage || '';
      if(!message) return;
      const key = native + ':' + source + ':' + message;
      if(!wpMessageCache.has(key)){
        const task = (async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          try{
            const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(native) + '&dt=t&q=' + encodeURIComponent(message), {signal:controller.signal});
            if(!response.ok) return '';
            const data = await response.json();
            return Array.isArray(data[0]) ? data[0].map(part => part[0] || '').join('') : '';
          }catch(e){ return ''; }
          finally{ clearTimeout(timer); }
        })();
        wpMessageCache.set(key, task);
      }
      m._message = await wpMessageCache.get(key);
      m._messageLang = native;
    }));
  }

  function wpBuildViews(text, matches){
    const sorted = matches.slice().sort((a,b)=> a.offset - b.offset), items = [];
    let cursor = 0, origHtml = '', corrected = '', issuesHtml = '', count = 0;
    sorted.forEach(m=>{
      if(m.offset < cursor || m.offset > text.length) return; /* üst üste binenleri atla */
      const errText = text.slice(m.offset, m.offset + m.length);
      const options = (m.replacements || []).map(r => r && r.value).filter(v => v != null).slice(0, 4);
      /* Öğrencinin seçtiği öneri (_choice) düzeltilmiş metne girer; yoksa ilki. */
      const repl = m._choice != null ? m._choice : (options.length ? options[0] : null);
      origHtml += escapeHtml(text.slice(cursor, m.offset));
      origHtml += '<mark class="wp-err" data-wp-ref="'+(count+1)+'" title="'+escapeHtml(wpMessage(m))+'">'+escapeHtml(errText)+'</mark>';
      corrected += text.slice(cursor, m.offset);
      corrected += (repl !== null) ? repl : errText;
      items.push(m);
      count++;
      const cat = wpCategory(m);
      let alts = '';
      if(options.length > 1){
        alts = '<div class="wp-alts" role="group" aria-label="'+escapeHtml(wpX('alternatives'))+'">'+options.map((value,i)=>'<button type="button" class="wp-alt" data-wp-fix="'+(count-1)+'" data-wp-alt="'+i+'" aria-pressed="'+String(value===repl)+'">'+escapeHtml(value || '∅')+'</button>').join('')+'</div>';
      }
      issuesHtml += '<div class="wp-issue" data-wp-issue="'+count+'"><div class="wp-issue-num">'+count+'</div><div class="wp-issue-body">'+
        '<span class="wp-cat '+cat+'">'+escapeHtml((wpX('cats') || {})[cat] || cat)+'</span>'+
        '<div class="wp-issue-orig">❌ '+escapeHtml(errText)+(repl!==null ? ' → <b>'+escapeHtml(repl)+'</b>' : '')+'</div>'+
        '<div class="wp-issue-msg">'+escapeHtml(wpMessage(m))+'</div>'+alts+'</div></div>';
      cursor = m.offset + m.length;
    });
    origHtml += escapeHtml(text.slice(cursor));
    corrected += text.slice(cursor);
    return { origHtml, corrected, issuesHtml, count, items, matches };
  }

  /* Sonucu ayrı bir render adımında tutuyoruz. Native arayüz dili
     değiştiğinde HTML kabuğu yenilenirken metin ve hata vurguları korunur;
     dinleme düğmesi de yeni DOM'a yeniden bağlanır. */
  function wpRenderResult(resultBox, text, lang, views){
    if(!resultBox || !lang || !views) return;
    if(views.count === 0){
      resultBox.innerHTML = '<div class="wp-clean-msg">'+(window.t?window.t('wp_clean_msg'):'✅ Hata bulunamadı, harika bir metin yazmışsın!')+'</div>'+
        '<div class="wp-section-label">'+(window.t?window.t('wp_your_text'):'Metnin')+'</div><div class="wp-corrected">'+escapeHtml(text)+'</div>'+
        '<div class="wp-speak-row"><button class="pm-btn small" id="wpListenBtn">'+(window.t?window.t('wp_listen'):'🔊 Dinle')+'</button></div>';
    } else {
      resultBox.innerHTML =
        '<div class="wp-section-label">'+(window.t?window.t('wp_errors_found')(views.count):('Bulunan Hatalar ('+views.count+')'))+'</div>'+
        '<p class="wp-summary">'+escapeHtml(wpX('summary',{words:wpWordCount(text),errors:views.count}))+'</p>'+
        '<div class="wp-original">'+views.origHtml+'</div>'+
        '<div class="wp-section-label">'+(window.t?window.t('wp_explanations'):'Açıklamalar')+'</div>'+views.issuesHtml+
        '<div class="wp-section-label">'+(window.t?window.t('wp_corrected_text'):'Düzeltilmiş Metin')+'</div>'+
        '<div class="wp-corrected">'+escapeHtml(views.corrected)+'</div>'+
        '<div class="wp-speak-row"><button class="pm-btn small" id="wpListenBtn">'+(window.t?window.t('wp_listen'):'🔊 Dinle')+'</button>'+
        '<button class="pm-btn small" id="wpCopyBtn">'+escapeHtml(wpX('copy'))+'</button></div>'+
        '<button class="pm-btn primary" id="wpApplyBtn">'+escapeHtml(wpX('apply'))+'</button>';
    }
    const listenBtn = document.getElementById('wpListenBtn');
    if(listenBtn) listenBtn.onclick = () => { speak(views.count ? views.corrected : text, lang.tts); };
    const copyBtn = document.getElementById('wpCopyBtn');
    if(copyBtn) copyBtn.onclick = () => {
      Promise.resolve().then(() => navigator.clipboard.writeText(views.corrected)).then(() => { copyBtn.textContent = wpX('copied'); setTimeout(() => { if(copyBtn.isConnected) copyBtn.textContent = wpX('copy'); }, 1800); }).catch(() => {});
    };
    const applyBtn = document.getElementById('wpApplyBtn');
    if(applyBtn) applyBtn.onclick = () => {
      const ta = document.getElementById('wpInput');
      if(!ta) return;
      ta.value = views.corrected;
      ta.dispatchEvent(new Event('input'));
      ta.focus();
      if(window.PWA && window.PWA.toast) window.PWA.toast(wpX('applied'), {kind:'good'});
    };
    /* Bir seçenek seçilince yalnızca düzeltilmiş metin ve vurgu yenilenir. */
    resultBox.querySelectorAll('[data-wp-fix]').forEach(button => {
      button.onclick = () => {
        const m = views.items[Number(button.dataset.wpFix)], options = (m && m.replacements || []).map(r => r && r.value).filter(v => v != null);
        if(!m || options[Number(button.dataset.wpAlt)] == null) return;
        m._choice = options[Number(button.dataset.wpAlt)];
        const next = wpBuildViews(text, views.matches);
        if(wpLastResult && wpLastResult.text === text) wpLastResult.views = next;
        wpRenderResult(resultBox, text, lang, next);
        const issue = resultBox.querySelector('[data-wp-issue="'+(Number(button.dataset.wpFix)+1)+'"]');
        if(issue) issue.scrollIntoView({block:'nearest'});
      };
    });
    resultBox.querySelectorAll('mark[data-wp-ref]').forEach(mark => {
      mark.onclick = () => {
        const issue = resultBox.querySelector('[data-wp-issue="'+mark.dataset.wpRef+'"]');
        if(!issue) return;
        resultBox.querySelectorAll('.wp-issue.is-focus').forEach(e => e.classList.remove('is-focus'));
        issue.classList.add('is-focus');
        issue.scrollIntoView({block:'center', behavior:'smooth'});
      };
    });
  }

  const WP_ERRORS = {
    tr:{unsupported:'Seçilen dil için otomatik yazım kontrolü henüz desteklenmiyor. Metnini burada yazabilirsin.',timeout:'Yazım kontrol servisi zamanında yanıt vermedi. Tekrar deneyebilirsin.',network:'Yazım kontrol servisine ulaşılamadı. Biraz sonra tekrar dene.',offline:'Çevrimdışısın. Kontrol için internete bağlan.',format:'Kontrol servisinden geçerli bir sonuç alınamadı. Tekrar dene.'},
    en:{unsupported:'Automatic checking is not yet supported for this language. You can still write here.',timeout:'The checking service timed out. Please try again.',network:'The checking service could not be reached. Please try again later.',offline:'You are offline. Connect to check your text.',format:'The checking service returned an invalid result. Please try again.'},
    de:{unsupported:'Für diese Sprache ist die automatische Prüfung noch nicht verfügbar. Du kannst hier weiter schreiben.',timeout:'Der Prüfdienst hat nicht rechtzeitig geantwortet. Versuche es erneut.',network:'Der Prüfdienst ist nicht erreichbar. Versuche es später erneut.',offline:'Du bist offline. Verbinde dich zum Prüfen mit dem Internet.',format:'Der Prüfdienst hat kein gültiges Ergebnis geliefert. Versuche es erneut.'},
    ar:{unsupported:'التدقيق التلقائي غير مدعوم لهذه اللغة بعد. يمكنك الكتابة هنا.',timeout:'انتهت مهلة خدمة التدقيق. حاول مجدداً.',network:'تعذر الوصول إلى خدمة التدقيق. حاول لاحقاً.',offline:'أنت غير متصل. اتصل بالإنترنت لتدقيق النص.',format:'لم ترجع خدمة التدقيق نتيجة صالحة. حاول مجدداً.'},
    fr:{unsupported:'La vérification automatique ne prend pas encore en charge cette langue. Tu peux écrire ici.',timeout:'Le service de correction a mis trop de temps à répondre. Réessaie.',network:'Le service de correction est inaccessible. Réessaie plus tard.',offline:'Tu es hors ligne. Connecte-toi pour vérifier ton texte.',format:'Le service de correction a renvoyé un résultat invalide. Réessaie.'},
    es:{unsupported:'La revisión automática aún no admite este idioma. Puedes escribir aquí.',timeout:'El servicio de revisión tardó demasiado. Inténtalo de nuevo.',network:'No se pudo conectar con el servicio de revisión. Inténtalo más tarde.',offline:'Estás sin conexión. Conéctate para revisar el texto.',format:'El servicio de revisión devolvió un resultado no válido. Inténtalo de nuevo.'},
    ru:{unsupported:'Автоматическая проверка этого языка пока не поддерживается. Здесь можно писать текст.',timeout:'Сервис проверки не ответил вовремя. Попробуй ещё раз.',network:'Не удалось связаться с сервисом проверки. Попробуй позже.',offline:'Нет подключения. Подключись к интернету для проверки.',format:'Сервис проверки вернул некорректный результат. Попробуй ещё раз.'}
  };
  function wpErrorMessage(error){
    if(error && error.featureCode && window.LUMIRA_FEATURES) return window.LUMIRA_FEATURES.errorText(error);
    const copy = WP_ERRORS[window.NATIVE_LANG] || WP_ERRORS.en;
    if(error && error.wpStatus) return window.t ? window.t('wp_service_error')(error.wpStatus) : copy.network;
    if(error && error.name === 'AbortError') return copy.timeout;
    if(error && error.wpKind) return copy[error.wpKind] || copy.network;
    return navigator.onLine === false ? copy.offline : copy.network;
  }
  let wpRetryOperation = null;
  async function wpRequestCheck(text, lang){
    if(!lang.lt){ const e = new Error('unsupported-language'); e.wpKind = 'unsupported'; throw e; }
    const fingerprint = lang.code + '\n' + text;
    if(!wpRetryOperation || wpRetryOperation.fingerprint !== fingerprint){
      wpRetryOperation = { fingerprint: fingerprint, id: window.LUMIRA_FEATURES.id() };
    }
    const result = await window.LUMIRA_FEATURES.api('check', {
      id: wpRetryOperation.id, text: text, language: lang.code, uiLanguage: window.NATIVE_LANG || 'tr'
    });
    wpRetryOperation = null;
    return result.matches;
  }

  function wpRunCheck(){
    if(wpBusy) return;
    const lang = wpFindLang(wpLang);
    if(!lang) return;
    const ta = document.getElementById('wpInput');
    const text = ta ? ta.value.trim() : '';
    const resultBox = document.getElementById('wpResult');
    if(!text){
      wpLastResult = null;
      if(resultBox) resultBox.innerHTML = '<div class="wp-error">'+(window.t?window.t('wp_empty_text'):'Önce bir şeyler yaz, sonra kontrol edelim 🙂')+'</div>';
      return;
    }
    if(text.length > 4000){
      wpLastResult = null;
      if(resultBox) resultBox.innerHTML = '<div class="wp-error">'+(window.t?window.t('wp_too_long'):'Metin çok uzun (max. 4000 karakter). Daha kısa bir bölüm dene.')+'</div>';
      return;
    }

    wpLastResult = null;
    wpBusy = true;
    const btn = document.getElementById('wpCheckBtn');
    if(btn){ btn.disabled = true; btn.textContent = (window.t?window.t('wp_checking'):'Kontrol ediliyor...'); }
    if(resultBox) resultBox.innerHTML = '<div class="wp-loading">'+(window.t?window.t('wp_loading_msg'):'📝 Metnin kontrol ediliyor, birkaç saniye sürebilir...')+'</div>';

    wpRequestCheck(text, lang)
    .then(async matches => {
      if(!wpLevelShowsStyle(wpLevel)){
        matches = matches.filter(m=>{
          const catId = m.rule && m.rule.category && m.rule.category.id;
          return catId !== 'STYLE' && catId !== 'REDUNDANCY';
        });
      }
      // A translation failure must never discard successful grammar results.
      try{ await wpLocalizeMessages(matches, lang.code); }catch(e){}
      const views = wpBuildViews(text, matches);
      wpLastResult = { text:text, langCode:lang.code, matches:matches, views:views };
      wpRenderResult(resultBox, text, lang, views);
    })
    .catch((err)=>{
      console.error('[Yazma Pratiği] Kontrol hatası:', err);
      const msg = wpErrorMessage(err);
      wpLastResult = null;
      if(resultBox) resultBox.innerHTML = '<div class="wp-error">'+escapeHtml(msg)+'</div>';
    })
    .finally(()=>{
      wpBusy = false;
      if(window.LUMIRA_FEATURES) window.LUMIRA_FEATURES.api('status').catch(function(){});
      if(btn){ btn.disabled = false; btn.textContent = (window.t?window.t('wp_check_btn'):'Kontrol Et'); }
      if(wpLocalePending){ wpLocalePending = false; refreshLocale(); }
    });
  }

  /* ---- 3. adım: yazma & kontrol ---- */
  function renderWritingPractice(){
    pmInWritingFlow = true;
    try{document.body.classList.add('pm-active');}catch(e){}
    try{['langBox','langPair','levelBox','chips'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}catch(e){}
    injectStyles();
    const lang = wpFindLang(wpLang);
    if(!lang || !wpLevel){ renderWritingLangSelect(); return; }
    let html = '<div class="pm-root"><div class="pm-head"><div class="pm-title">'+(window.t?window.t('nb_writing_practice'):'✍️ Yazma Pratiği')+'</div>'+
      '<div class="pm-sub">'+(window.t?window.t('wp_lang_level_sub')(lang.flag+' '+lang.label,wpLevel):(lang.flag+' '+lang.label+' · Seviye '+wpLevel))+'</div></div>';
    html += '<div class="feature-quota" data-writing-quota></div>';
    html += '<div class="wp-topic" id="wpTopic" hidden></div>';
    html += '<textarea class="wp-textarea" id="wpInput" maxlength="4000" lang="'+lang.code+'" dir="'+(lang.code==='ar'?'rtl':'ltr')+'" placeholder="'+(window.t?window.t('wp_placeholder')(lang.label):('Buraya '+lang.label+' bir metin yaz...'))+'"></textarea>';
    html += '<div class="wp-counter" id="wpCounter" title="'+escapeHtml(wpX('draft'))+'">'+escapeHtml(wpCounterText(''))+'</div>';
    html += '<div class="wp-tools"><button class="pm-btn small" id="wpTopicBtn" type="button">'+escapeHtml(wpX('topic'))+'</button><button class="pm-btn small" id="wpClearBtn" type="button">'+escapeHtml(wpX('clear'))+'</button></div>';
    html += '<button class="pm-btn primary" id="wpCheckBtn" title="'+escapeHtml(wpX('shortcut'))+'">'+(window.t?window.t('wp_check_btn'):'Kontrol Et')+'</button>';
    html += '<div id="wpResult"></div>';
    html += '<button class="pm-btn small" id="wpBackLevelBtn">'+(window.t?window.t('wp_back_level'):'← Seviye Değiştir')+'</button>';
    html += '<button class="pm-btn primary" id="wpBackHomeBtn">'+(window.t?window.t('wp_back_to_notebook'):'📒 Notlarım\'a Dön')+'</button></div>';
    root.innerHTML = html;
    window.LUMIRA_FEATURES.mountWriting(root.querySelector('[data-writing-quota]'));

    document.getElementById('wpBackHomeBtn').onclick = () => window.PM_openWritingPractice();
    document.getElementById('wpBackHomeBtn').textContent='← '+window.LUMIRA_LEARNING.text('title');
    document.getElementById('wpBackLevelBtn').onclick = renderWritingLevelSelect;
    document.getElementById('wpCheckBtn').onclick = wpRunCheck;
    if(!lang.lt){
      document.getElementById('wpCheckBtn').disabled = true;
      document.getElementById('wpResult').textContent = wpErrorMessage({wpKind:'unsupported'});
    }
    const ta = document.getElementById('wpInput');
    const counter = document.getElementById('wpCounter');
    if(ta && counter){
      ta.value = wpReadDraft();
      counter.textContent = wpCounterText(ta.value);
      ta.addEventListener('input', ()=>{
        counter.textContent = wpCounterText(ta.value);
        clearTimeout(wpDraftTimer);
        const key = wpDraftKey(), value = ta.value;
        wpDraftTimer = setTimeout(()=>{ if(key === wpDraftKey()) wpSaveDraft(value); }, 400);
      });
      ta.addEventListener('keydown', e=>{ if(e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing){ e.preventDefault(); wpRunCheck(); } });
    }
    wpPaintTopic();
    document.getElementById('wpTopicBtn').onclick = () => {
      const list = (wpX('prompts') || {})[wpLevel] || [];
      if(!list.length) return;
      let next = Math.floor(Math.random() * list.length);
      if(list.length > 1 && next === wpTopicIndex) next = (next + 1) % list.length;
      wpTopicIndex = next;
      wpPaintTopic();
    };
    document.getElementById('wpClearBtn').onclick = () => {
      if(!ta) return;
      if(ta.value.trim().length > 40 && !window.confirm(wpX('clearConfirm'))) return;
      clearTimeout(wpDraftTimer);
      ta.value = '';
      wpSaveDraft('');
      if(counter) counter.textContent = wpCounterText('');
      wpLastResult = null;
      const resultBox = document.getElementById('wpResult');
      if(resultBox) resultBox.innerHTML = '';
      ta.focus();
    };
  }

  let openRun=0;
  function openPersonalMode(landingFn){
    const request=++openRun,activeTab=document.querySelector('.tabs .tab.active')?.id;
    landingFn = (typeof landingFn === 'function') ? landingFn : renderHome;
    if(!root) return;
    injectStyles();
    const name = window.LB_getUserName ? window.LB_getUserName() : '';
    if(!name){
      root.innerHTML = '<div class="pm-root"><div class="pm-empty">'+(window.t?window.t('pm_need_name'):'Kişisel alanı kullanmak için önce adını girmen gerekiyor.')+'</div><button class="pm-btn primary" id="pmAskNameBtn">'+(window.t?window.t('pm_enter_name_btn'):'Adımı Gir')+'</button></div>';
      document.getElementById('pmAskNameBtn').onclick = () => { if(window.LB_checkName) window.LB_checkName(); };
      return;
    }
    if(dataLoaded && currentName === name){ landingFn(); return; }
    root.innerHTML = '<div class="pm-root"><div class="pm-loading">'+(window.t?window.t('pm_loading'):'Kişisel alan yükleniyor...')+'</div></div>';
    loadUserData(name,()=>{if(request===openRun&&root.style.display!=='none'&&document.querySelector('.tabs .tab.active')?.id===activeTab)landingFn();});
  }

  window.LB_onNameReady = function(name){
    if(dataLoaded && currentName === name){ return; } // zaten yüklü, gereksiz yeniden yüklemeyi (ve olası veri ezmeyi) engelle
    // Kişisel panel şu an görünür değilse bile veriyi sessizce yükle: bu sayede
    // meta.xp (dolayısıyla seviye liderlik tablosu) kullanıcı "Kişisel Mod"u
    // hiç açmasa bile girişte güncellenir. Panel görünürse ayrıca render eder -
    // AMA kullanıcı o an Yazma Pratiği ekranındaysa onu Ana Sayfa'ya ATMIYORUZ
    // (bu hem akışı bölüyor hem de üstteki dil kutusunun yanlışlıkla tekrar
    // görünmesine yol açıyordu, çünkü renderHome kendi dil kutusu gizleme
    // mantığını çalıştırırken kullanıcı farklı bir ekrandaydı).
    const isVisible = root && root.style.display !== 'none';
    const activeTab=document.querySelector('.tabs .tab.active')?.id;
    const landing=isVisible?(activeTab==='tabPersonal'?renderHome:activeTab==='tabPlacement'?openLevelTestPicker:activeTab==='tabStories'?renderStories:activeTab==='tabWriting'&&!window.LUMIRA_LEARNING?.isMounted()?renderWritingLangSelect:null):null;
    loadUserData(name,()=>{if(root.style.display!=='none'&&document.querySelector('.tabs .tab.active')?.id===activeTab)landing?.();});
  };

  window.PM_open = function(){ openPersonalMode(); };

  /* Native arayüz dili ayarlardan değiştirildiğinde Notlarım ve Yazma
     Pratiği DOM'u ana sayfa gibi otomatik çevrilmez; bu iki ekranı da açık
     akışı bozmadan yenile. Yazma ekranındaki metni koru, sonuç panelini de
     kaybetme — kullanıcı sadece arayüz dilini değiştirmiş olur. */
  function refreshLocale(){
    try{
      if(window.LUMIRA_LIVE && window.LUMIRA_LIVE.isMounted()){ window.LUMIRA_LIVE.refreshLocale(); return; }
      const nbTab = document.getElementById('tabNotebook');
      const nbView = document.getElementById('notebookView');
      if(nbTab && nbTab.classList.contains('active') && nbView && nbView.style.display !== 'none'){
        if(window.NB_refreshLocale) window.NB_refreshLocale();
        return;
      }

      const personalTab=document.querySelector('#tabPersonal.active,#tabWriting.active,#tabPlacement.active,#tabStories.active');
      if(!personalTab || !root || root.style.display === 'none') return;
      if(pmInStoryFlow&&window.LUMIRA_STORIES?.isMounted()){window.LUMIRA_STORIES.refreshLocale();return;}

      if(window.LUMIRA_LEARNING?.isMounted())return;
      if(document.getElementById('tabPlacement')?.classList.contains('active')){if(!ltState)openLevelTestPicker();return;}
      if(pmInWritingFlow){
        ['langBox','langPair','levelBox','chips'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
        if(wpBusy){ wpLocalePending = true; return; }
        const oldInput = document.getElementById('wpInput');
        const oldValue = oldInput ? oldInput.value : '';
        const oldResult = document.getElementById('wpResult');
        const hadResult = !!(oldResult && oldResult.innerHTML.trim());
        if(oldInput) renderWritingPractice();
        else if(root.querySelector('[data-lvl]')) renderWritingLevelSelect();
        else renderWritingLangSelect();
        const nextInput = document.getElementById('wpInput');
        if(nextInput){
          nextInput.value = oldValue;
          const counter = document.getElementById('wpCounter');
          if(counter) counter.textContent = wpCounterText(oldValue);
        }
        const nextResult = document.getElementById('wpResult');
        const freshLang = wpFindLang(wpLang);
        if(nextResult && hadResult && wpLastResult && freshLang && wpLastResult.langCode === freshLang.code){
          wpRenderResult(nextResult, wpLastResult.text, freshLang, wpBuildViews(wpLastResult.text, wpLastResult.matches || []));
        }
      }else if(dataLoaded){
        renderHome();
      }
    }catch(e){ console.error('[Lumira] Dil arayüzü yenilenemedi:', e); }
  }
  window.PM_refreshLocale = refreshLocale;
  window.onlumiraLocaleChange = function(){ refreshLocale(); };
  window.addEventListener('lumira:localechange', function(){
    /* setLangPair sözlük yüklemesini tamamladıktan sonra olayı gönderir;
       mikro görev, aynı turdaki DOM güncellemelerinin bitmesini garanti eder. */
    setTimeout(refreshLocale, 0);
  });

  /* Notlarım sekmesinden doğrudan Yazma Pratiği akışını açmak için:
     Kişisel sekmesine geçer (isim/veri kontrolü dahil) ve Ana Sayfa
     yerine doğrudan dil seçim ekranını gösterir. */
  window.PM_openWritingPractice=function(){openRun++;pmInWritingFlow=true;pmInStoryFlow=false;injectStyles();window.LUMIRA_LEARNING.mount(root);};
  window.PM_openTextWriting=function(){openPersonalMode(renderWritingLangSelect);};
  window.PM_openPlacement=function(){pmInWritingFlow=false;pmInStoryFlow=false;openPersonalMode(openLevelTestPicker);};
  function renderStories(){pmInWritingFlow=false;pmInStoryFlow=true;['langBox','langPair','levelBox','chips'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});window.LUMIRA_STORIES.mount(root,()=>document.getElementById('tabPersonal')?.click());}
  window.PM_openStories=function(){openPersonalMode(renderStories);};
  window.PR_storyWords=function(language){const uid=window.firebase?.auth?.().currentUser?.uid;if(!dataLoaded||!uid||currentKey!==uid||language!==TARGET_LANG)return[];return poolForActiveLang().filter(v=>getRecord(v)?.known).map(v=>({w:FRONT_W(v),meaning:BACK_W(v)}));};
  window.PM_openLiveTranslation = function(){
    const tab = document.getElementById('tabLiveTranslate');
    if(tab) tab.click();
  };


  /* Dışarıdan XP eklemek için ortak kapı: quiz doğru cevapları ve
     destek rozetleri bunu kullanır. Kaydetme ve sunucuya yazma dahil. */
  window.PR_addXp = function(amount, reason){
    try{
      amount = parseInt(amount, 10) || 0;
      if(amount <= 0) return 0;
      addXp(amount, reason || '');
      persistMeta();
      return meta.xp || 0;
    }catch(e){ return 0; }
  };
  /* Mevcut XP ve seviyeyi okumak için (Profilim / PDF kilitleri) */
  window.PR_getXp = function(){ try{ return meta.xp || 0; }catch(e){ return 0; } };
  window.PR_getLevel = function(){ try{ return Math.floor((meta.xp||0)/200) + 1; }catch(e){ return 1; } };
})();
