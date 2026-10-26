/* app-main.js — Lumira ana uygulama kodu (kartlar, quiz, Notlarım, ayarlar). index.html içinde
   satır içiydi; ayrı dosyada önbelleğe alınır, V8 derleme önbelleğinden yararlanır. Sıra ve konum aynıdır. */
/* Kelime verisi vocab-core.js + vocab-<dil>.js dosyalarından geliyor.
   Açılışta yalnızca vocab-de.js yükleniyor; diğer diller o dile geçildiğinde
   pwa.js tarafından indiriliyor
   (bkz. yukarıdaki <script src> etiketleri). Tüm altı dilin sözlüğü mevcuttur. */
/* ======================= CONFIG ======================= */
const LANGS = {
  de:{ label:"Almanca", native:"Deutsch", levels:["A1","A2","B1","B2"], voice:"de-DE", dir:"ltr" },
  en:{ label:"İngilizce", native:"English", levels:["A1","A2","B1","B2"], voice:"en-US", dir:"ltr" },
  ar:{ label:"Arapça", native:"العربية", levels:["A1","A2","B1","B2"], voice:"ar-SA", dir:"rtl" },
  fr:{ label:"Fransızca", native:"Français", levels:["A1","A2","B1","B2"], voice:"fr-FR", dir:"ltr" },
  es:{ label:"İspanyolca", native:"Español", levels:["A1","A2","B1","B2"], voice:"es-ES", dir:"ltr" },
  ru:{ label:"Rusça", native:"Русский", levels:["A1","A2","B1","B2"], voice:"ru-RU", dir:"ltr" }
};

/* ======================= ANA DİL / HEDEF DİL — çok yönlü öğrenme =======================
   Varsayılan: NATIVE_LANG='tr', TARGET_LANG=seçilen dil. Bu durumda UYGULAMA
   HİÇBİR ŞEKİLDE DEĞİŞMEZ — mevcut davranışın birebir aynısı.

   Üç mod:
   1) NORMAL     (native=tr, target=biri):   vocab-X.js doğrudan kullanılır (orijinal davranış)
   2) REVERSED   (native≠tr, target=tr):     kişinin kendi dilinin sözlüğü (vocab-X.js) kullanılır,
                                              sadece ön/arka (kelime/çeviri) yer değiştirir
   3) CROSS      (native≠tr, target≠tr,
                  native≠target):            iki gerçek sözlük dosyası, ORTAK TÜRKÇE KARŞILIK
                                              üzerinden eşleştirilir (ör. Almanca "Auto" ve İngilizce
                                              "car" ikisi de Türkçede "araba" ise eşleştirilir).
                                              Belirsiz kelimeler atlanır. Örnekler ayrıca tam Türkçe
                                              cümle karşılığı veya incelenmiş paralel cümlelerle
                                              eşleştirilir; ilgisiz örnek çeviri olarak gösterilmez.
   Veri yapısı, ilerleme kayıtları (wordKeyFor v.w'ye dayanır) ve tüm diğer
   mantık DOKUNULMADAN kalır — sadece görüntüleme ve kaynak seçim katmanı değişir. */
let NATIVE_LANG = 'tr';
let TARGET_LANG = 'de';
try { NATIVE_LANG = localStorage.getItem('lumira_native_lang') || 'tr'; } catch(e){}
try { TARGET_LANG = localStorage.getItem('lumira_target_lang') || (NATIVE_LANG!=='tr' ? '' : 'de'); } catch(e){}
if(!TARGET_LANG){ TARGET_LANG = (NATIVE_LANG==='tr') ? 'de' : 'tr'; }
let REVERSED_MODE = (NATIVE_LANG !== 'tr' && TARGET_LANG === 'tr');
let IS_CROSS = (NATIVE_LANG !== 'tr' && TARGET_LANG !== 'tr' && TARGET_LANG !== NATIVE_LANG);
let CROSS_DECK = [];
let activeLang = REVERSED_MODE ? NATIVE_LANG : TARGET_LANG;
/* t() ve geç yüklenen Personal/Notebook modülleri aynı anlık durumu görsün.
   setLangPair() bunu her değişimde tekrar günceller. */
window.NATIVE_LANG = NATIVE_LANG;
window.TARGET_LANG = TARGET_LANG;

function isReversed(){ return REVERSED_MODE; }
function isCross(){ return IS_CROSS; }
function FRONT_W(v){ return isReversed() ? v.tr : v.w; }
function BACK_W(v){ return isReversed() ? v.w : v.tr; }
function FRONT_EX(v){ return isReversed() ? v.exTr : v.ex; }
function BACK_EX(v){ return isReversed() ? v.ex : (v.exTr || (isCross() ? window.LUMIRA_EXAMPLES?.get(v.lang,NATIVE_LANG,v.ex) : '') || ''); }
function FRONT_DIR(v){ return isReversed() ? 'ltr' : LANGS[v.lang].dir; }
function BACK_DIR(v){ return isReversed() ? LANGS[v.lang].dir : (isCross() ? LANGS[NATIVE_LANG].dir : 'ltr'); }
function FRONT_VOICE(v){ return isReversed() ? 'tr-TR' : LANGS[v.lang].voice; }
function BACK_VOICE(v){ return isReversed() ? LANGS[v.lang].voice : (isCross() ? LANGS[NATIVE_LANG].voice : 'tr-TR'); }
function FRONT_LABEL(){ return isReversed() ? 'Türkçe' : LANGS[activeLang].native; }
function BACK_LABEL(){ return isReversed() ? LANGS[activeLang].native : (isCross() ? LANGS[NATIVE_LANG].native : 'Türkçe'); }
window.isReversed = isReversed; window.isCross = isCross;
window.FRONT_W = FRONT_W; window.BACK_W = BACK_W;
window.FRONT_EX = FRONT_EX; window.BACK_EX = BACK_EX;
window.FRONT_DIR = FRONT_DIR; window.BACK_DIR = BACK_DIR;
window.FRONT_VOICE = FRONT_VOICE; window.BACK_VOICE = BACK_VOICE;

/* Notlarım çalışma/quiz destesindeki kayıtlar, ana Kartlar destesinden
   bağımsız bir dil çifti taşır (ör. global hedef Almanca iken defterden
   İngilizce seçilebilir). Ana destenin ön/arka yön yardımcıları bu öğelere
   uygulanırsa kelime doğru olsa bile etiket, yön ve ses dili yanlış görünür.
   Bu küçük bağlam yardımcıları yalnızca _nbPair işaretli defter öğelerinde
   devreye girer; normal Kartlar/Quiz akışı birebir aynı kalır. */
function isNotebookPair(v){ return !!(v && v._nbPair); }
function cardFrontWord(v){ return isNotebookPair(v) ? (v.w || '') : FRONT_W(v); }
function cardBackWord(v){ return isNotebookPair(v) ? (v.tr || '') : BACK_W(v); }
function cardFrontExample(v){ return isNotebookPair(v) ? (v.ex || '') : FRONT_EX(v); }
function cardBackExample(v){ return isNotebookPair(v) ? (v.exTr || window.LUMIRA_EXAMPLES?.get(v.lang,v.meaningLang||'tr',v.ex) || '') : BACK_EX(v); }
function cardFrontDir(v){ return isNotebookPair(v) ? ((LANGS[v.lang] && LANGS[v.lang].dir) || 'ltr') : FRONT_DIR(v); }
function cardBackDir(v){ return isNotebookPair(v) ? ((LANGS[v.meaningLang] || {}).dir || 'ltr') : BACK_DIR(v); }
function cardFrontVoice(v){ return isNotebookPair(v) ? ((LANGS[v.lang] && LANGS[v.lang].voice) || (v.lang === 'tr' ? 'tr-TR' : 'en-US')) : FRONT_VOICE(v); }
function cardBackVoice(v){ return isNotebookPair(v) ? ((LANGS[v.meaningLang] || {}).voice || 'tr-TR') : BACK_VOICE(v); }
function cardFrontLabel(v){
  if(!isNotebookPair(v)) return FRONT_LABEL();
  const names = (typeof t === 'function' && t('lang_names')) || {};
  return names[v.lang] || ((LANGS[v.lang] && LANGS[v.lang].label) || v.lang || '');
}
function cardBackLabel(v){
  if(!isNotebookPair(v)) return BACK_LABEL();
  const names = (typeof t === 'function' && t('lang_names')) || {};
  return names[v.meaningLang || 'tr'] || 'Türkçe';
}

/* basePool(): tüm seviye/kategori/quiz/dağıtıcı filtrelemesi TEK NOKTADAN
   buradan geçer. CROSS modda gerçek VOCAB yerine CROSS_DECK kullanılır;
   diğer iki modda eskisi gibi VOCAB, activeLang'e göre filtrelenir. */
let poolSize=-1,languagePools=new Map();
function basePool(){if(poolSize!==VOCAB.length){poolSize=VOCAB.length;languagePools=new Map();}if(!languagePools.has(activeLang))languagePools.set(activeLang,VOCAB.filter(v=>v.lang===activeLang));const rows=IS_CROSS?CROSS_DECK:languagePools.get(activeLang);return window.LUMIRA_MAINTENANCE?rows.filter(v=>LUMIRA_MAINTENANCE.categoryAvailable(v.cat)):rows;}
window.basePool = basePool;

/* Kelime anlamları ve örnek cümleler ayrı ayrı eşleştirilir. Aynı
   kelimeye ait iki farklı cümle hiçbir zaman birbirinin çevirisi sayılmaz. */
function buildCrossDeck(nativeCode, targetCode){
  return window.LUMIRA_VOCAB_PAIRS.build(VOCAB, nativeCode, targetCode);
}
window.buildCrossDeck = buildCrossDeck;

/* Native/hedef çiftini uygular: localStorage'a yazar, modu (normal/ters/
   çapraz) hesaplar, gerekiyorsa iki sözlüğü de yükleyip CROSS_DECK'i
   kurar, arayüzü (dil kutusu, alt metin, aktif buton) günceller. Bir
   Promise döner — çağıran taraf .then() içinde render fonksiyonlarını
   (renderLangPair/rebuildLevelBox/rebuildChips/applyFilter) çalıştırmalı. */
function setLangPair(native, target){
  const previousNative = NATIVE_LANG;
  NATIVE_LANG = native || 'tr';
  TARGET_LANG = target || (NATIVE_LANG==='tr' ? 'de' : 'tr');
  /* Aynı dil iki tarafta seçilirse ters/çapraz modun kaynak dili belirsiz
     kalmasın. Ayarlar ekranı bunu zaten engeller; bu koruma eski bağlantılar
     ve kaydedilmiş hatalı tercihler için güvenli yedektir. */
  if(!I18N[NATIVE_LANG]) NATIVE_LANG = 'tr';
  if(NATIVE_LANG === TARGET_LANG){
    TARGET_LANG = (NATIVE_LANG === 'tr') ? 'de' : 'tr';
  }
  try { localStorage.setItem('lumira_native_lang', NATIVE_LANG); } catch(e){}
  try { localStorage.setItem('lumira_target_lang', TARGET_LANG); } catch(e){}
  window.NATIVE_LANG = NATIVE_LANG;
  window.TARGET_LANG = TARGET_LANG;
  REVERSED_MODE = (NATIVE_LANG !== 'tr' && TARGET_LANG === 'tr');
  IS_CROSS = (NATIVE_LANG !== 'tr' && TARGET_LANG !== 'tr' && TARGET_LANG !== NATIVE_LANG);
  activeLang = REVERSED_MODE ? NATIVE_LANG : TARGET_LANG;

  const lb = document.getElementById('langBox');
  const sb = document.getElementById('mainSub');
  const trOpt = document.getElementById('langOptTr');
  if (trOpt) trOpt.style.display = (NATIVE_LANG !== 'tr') ? '' : 'none';
  document.querySelectorAll('.lang-opt').forEach(o=>{
    /* kendi ana dilini "öğrenme" seçeneği olarak gösterme */
    o.style.display = (o.dataset.lang === NATIVE_LANG) ? 'none' : '';
    o.classList.toggle('active', o.dataset.lang === TARGET_LANG);
  });
  if (lb) lb.style.display = '';
  if (sb) sb.textContent = t('main_sub_full');
  applyUIChrome();

  const need = [];
  if(!IS_CROSS){
    if(activeLang !== 'de' && !window.VOCAB_LOADED[activeLang]) need.push(window.ensureVocab(activeLang));
  } else {
    if(!window.VOCAB_LOADED[NATIVE_LANG]) need.push(window.ensureVocab(NATIVE_LANG));
    if(!window.VOCAB_LOADED[TARGET_LANG]) need.push(window.ensureVocab(TARGET_LANG));
  }
  if(window.LUMIRA_PHRASES)need.push(LUMIRA_PHRASES.ready(NATIVE_LANG));
  return Promise.all(need).then(()=>{
    if(IS_CROSS){ CROSS_DECK = buildCrossDeck(NATIVE_LANG, TARGET_LANG); }
    /* Dinamik Notlarım/Yazma Pratiği ekranları DOM'a sonradan kurulduğu için
       yalnızca ana sayfanın statik metinlerini güncellemek yetmez. Native
       arayüz dili değiştiğinde açık olan modül de aynı çevrimde yenilenir.
       Hedef dil değişiminde bu olay gönderilmez; o değişim ilgili modülün
       kendi seçimiyle zaten yönetilir. */
    if(previousNative !== NATIVE_LANG){
      try{
        const ev = new CustomEvent('lumira:localechange', { detail:{ native:NATIVE_LANG, target:TARGET_LANG } });
        window.dispatchEvent(ev);
      }catch(e){
        try{ window.onlumiraLocaleChange && window.onlumiraLocaleChange(NATIVE_LANG, TARGET_LANG); }catch(_e){}
      }
    }
  });
}
window.setLangPair = setLangPair;

/* Statik arayüz metinlerini (sekmeler, kart başlıkları, quiz sorusu vb.)
   NATIVE_LANG'e göre günceller. Kelime kartlarının İÇERİĞİNE (vocab verisi,
   kategori adları) DOKUNMAZ — o Türkçe kalır, sadece arayüz kabuğu değişir. */
function applyUIChrome(){
  try {
    document.documentElement.setAttribute('lang', NATIVE_LANG);
    document.documentElement.setAttribute('dir', NATIVE_LANG==='ar' ? 'rtl' : 'ltr');
    const $$ = (id)=>document.getElementById(id);
    if($$('tabCards')) $$('tabCards').textContent = t('tab_cards');
    if($$('tabQuiz')) $$('tabQuiz').textContent = t('tab_quiz');
    if($$('tabLiveTranslate')) $$('tabLiveTranslate').textContent = t('tab_live_translation');
    if($$('tabPersonal')) $$('tabPersonal').textContent = t('tab_personal');
    if($$('tabNotebook')) $$('tabNotebook').textContent = t('tab_notebook');
    window.LUMIRA_LEARNING?.updateNav();
    /* Genel amaçlı statik metin çevirisi: Bilgilendirme/Nasıl Kullanılır
       panelleri gibi düz metin blokları data-i18n="anahtar" ile işaretlenir,
       burada tek seferde toplu olarak çevrilir. */
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if(val !== undefined && val !== null && typeof val !== 'function') el.textContent = val;
    });
    document.querySelectorAll('.speak-caption').forEach(el=>el.textContent=t('tap_to_listen'));
    const hint = document.querySelector('.hint'); if(hint) hint.textContent = t('tap_to_flip');
    document.querySelectorAll('.speak-lbl').forEach((el,i)=>{ el.textContent = (i%2===0)?t('normal_speed'):t('slow_speed'); });
    const quizTag = document.querySelector('#quizView .tag'); if(quizTag) quizTag.textContent = t('quiz_prompt');
    const catAll = $$('catAllChip'); if(catAll) catAll.textContent = t('cat_all');
    /* dil butonlarının altındaki isimler (Almanca/German/Deutsch/...) */
    const names = t('lang_names') || {};
    document.querySelectorAll('.lang-opt').forEach(o=>{
      const code = o.dataset.lang;
      const nm = o.querySelector('.lname');
      if(nm && names[code]) nm.textContent = names[code];
    });
    /* kart kontrol butonları */
    if($$('prevBtn')) $$('prevBtn').textContent = t('prev');
    if($$('shuffleBtn')) $$('shuffleBtn').textContent = t('shuffle');
    if($$('nextBtn')) $$('nextBtn').textContent = t('next');
    if($$('quizPrevBtn')) $$('quizPrevBtn').textContent = t('prev');
    if($$('quizNextBtn')) $$('quizNextBtn').textContent = t('next');
    if($$('quizFinishBtn')) $$('quizFinishBtn').textContent = t('quiz_finish');
    /* footer / destek butonu / kategori modal başlığı / H1 alt başlık */
    const rightsEl = $$('creditRights'); if(rightsEl) rightsEl.textContent = t('rights');
    const supportBtnText = $$('supportBtnText'); if(supportBtnText) supportBtnText.textContent = t('support_app');
    const catPanelTitle = $$('catPanelTitle'); if(catPanelTitle) catPanelTitle.textContent = t('cat_pick_title');
    const h1 = document.querySelector('.app h1'); if(h1) h1.textContent = t('app_subtitle');
    const spSub = $$('splashSubtitle'); if(spSub) spSub.textContent = t('splash_subtitle');
    const spTap = $$('splashTap'); if(spTap) spTap.textContent = t('splash_tap');
    const spGoe = $$('splashGoethe'); if(spGoe) spGoe.textContent = t('splash_goethe');
    const spLbT = $$('splashLbTitle'); if(spLbT) spLbT.textContent = '🏆 '+t('rankings');
    const spLbTime = $$('splashLbTimeLbl'); if(spLbTime) spLbTime.textContent = '⏱️ '+t('time_rank');
    const spLbLevel = $$('splashLbLevelLbl'); if(spLbLevel) spLbLevel.textContent = '⭐ '+t('level_rank');
    /* giriş / şifre ekranı */
    const lwt = $$('loginWelcomeTitle'); if(lwt) lwt.textContent = t('login_welcome');
    const ldesc = $$('loginDesc'); if(ldesc) ldesc.textContent = t('login_desc');
    const lhint = $$('loginHint'); if(lhint) lhint.textContent = t('login_hint');
    const nameInp = $$('nameInput'); if(nameInp) nameInp.placeholder = t('login_name_ph');
    const pwInp = $$('passwordInput'); if(pwInp) pwInp.placeholder = t('login_pw_ph');
    const pwEye = $$('pwEye'); if(pwEye) pwEye.title = t('login_pw_toggle');
    const nameSub = $$('nameSubmit'); if(nameSub) nameSub.textContent = t('login_start');
    /* zorluk kutusu (kart altı) + çalışmayı bitir düğmesi */
    const diffTitle = document.querySelector('#nbDifficultyBox .nb-diff-title'); if(diffTitle) diffTitle.textContent = t('nb_diff_level_title');
    const diffOpts = document.querySelectorAll('#nbDifficultyBox .nb-diff-opt');
    const diffData = [['nb_diff_easy','nb_diff_easy_sub'],['nb_diff_medium','nb_diff_medium_sub'],['nb_diff_hard','nb_diff_hard_sub']];
    diffOpts.forEach((el,i)=>{
      if(!diffData[i]) return;
      const nm = el.querySelector('.nb-diff-name'); if(nm) nm.textContent = t(diffData[i][0]);
      const sb = el.querySelector('.nb-diff-sub'); if(sb) sb.textContent = t(diffData[i][1]);
    });
    if($$('nbFinishStudyBtn')) $$('nbFinishStudyBtn').textContent = t('nb_finish_study');
    if($$('nbBackToNotebookBtn')) $$('nbBackToNotebookBtn').textContent = '📒 '+t('tab_notebook');
    updateCatUI();
    if(typeof rebuildLevelBox==='function') rebuildLevelBox();
  } catch(e){}
}
window.applyUIChrome = applyUIChrome;
/* Geriye dönük uyumluluk: eski çağrı biçimi hâlâ çalışsın (sadece native
   verir, hedef otomatik 'tr' olur — splash.js artık setLangPair kullanıyor
   ama başka bir yerden çağrılırsa diye bırakıldı). */
function setNativeLang(code){ return setLangPair(code || 'tr', (code && code!=='tr') ? 'tr' : (TARGET_LANG||'de')); }
window.setNativeLang = setNativeLang;
window.FRONT_LABEL = FRONT_LABEL; window.BACK_LABEL = BACK_LABEL;
let activeLevel = "TÜMÜ";
let activeCat = "Tümü";
let deck = [];
let idx = 0;
let flipped = false;
let soundOn = true;

let quizDeck = [];
let qIdx = 0;
let score = 0;
let answered = false;
let mistakes = []; // QUIZ HATALARINI TUTACAĞIMIZ DİZİ
let quizAnswers = []; // her soru indexine karşılık { opts, chosen, correct } - geri dönüp bakabilmek için

/* ======================= TTS (best available system voice) ======================= */
/* =========================================================
   SES SİSTEMİ
   Öncelik:
   1. Cihazın / tarayıcının kendi speechSynthesis TTS sistemi
   2. TTS çalışmazsa Google Translate TTS yedek sistem
   ========================================================= */
/* =========================================================
   1. TTS SESLERİNİ YÜKLE
   ========================================================= */
let voicesCache = [];
function loadVoices(){
  if('speechSynthesis' in window){
    voicesCache = window.speechSynthesis.getVoices() || [];
  }else{
    voicesCache = [];
  }
}
if('speechSynthesis' in window){
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}
/* =========================================================
   2. UYGUN TTS SESİNİ BUL
   ========================================================= */
function pickVoice(langCode){
  if(!voicesCache.length) loadVoices();
  const prefix = String(langCode || '')
    .split('-')[0]
    .toLowerCase();
  if(!prefix) return null;
  const candidates = voicesCache.filter(v =>
    v.lang &&
    v.lang.toLowerCase().startsWith(prefix)
  );
  if(candidates.length === 0){
    return null;
  }
  // Önce tam dil eşleşmesi
  const exact = candidates.filter(v =>
    v.lang.toLowerCase() === String(langCode).toLowerCase()
  );
  const pool = exact.length ? exact : candidates;
  // Daha doğal sesleri önceliklendir
  const priorityKeywords = [
    "Siri",
    "Enhanced",
    "Premium",
    "Pro",
    "Natural",
    "Neural",
    "Wavenet",
    "Google",
    "Online",
    "Samantha",
    "Alex",
    "Ava",
    "Serena",
    "Daniel",
    "Anna",
    "Markus",
    "Petra"
  ];
  for(const kw of priorityKeywords){
    const found = pool.find(v =>
      v.name &&
      v.name.toLowerCase().includes(kw.toLowerCase())
    );
    if(found){
      return found;
    }
  }
  // Hiçbiri bulunamazsa ilk uygun sesi kullan
  return pool[0];
}
/* =========================================================
   3. GOOGLE TRANSLATE TTS
   YEDEK SES SİSTEMİ
   ========================================================= */
function googleTTSUrl(text, langCode, slow){
  const speed = slow ? 0.24 : 1;
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(langCode)}&client=tw-ob&ttsspeed=${speed}`;
}
/* =========================================================
   4. GOOGLE TTS SESLENDİRME
   ========================================================= */
function speakGoogle(text, langCode, slow, onEnd){
  try{
    const audio = new Audio(
      googleTTSUrl(text, langCode, slow)
    );
    let done = false;
    const finish = (ok) => {
      if(done) return;
      done = true;
      if(onEnd){
        onEnd(ok);
      }
    };
    audio.onended = () => {
      finish(true);
    };
    audio.onerror = () => {
      finish(false);
    };
    // Google TTS çok uzun süre cevap vermezse başarısız kabul et
    const timeout = setTimeout(() => {
      finish(false);
    }, 5000);
    audio.addEventListener(
      'playing',
      () => {
        clearTimeout(timeout);
      },
      { once:true }
    );
    const playPromise = audio.play();
    if(playPromise){
      playPromise.catch(() => {
        clearTimeout(timeout);
        finish(false);
      });
    }
  }catch(e){
    if(onEnd){
      onEnd(false);
    }
  }
}
/* =========================================================
   5. SADECE CİHAZ / TARAYICI TTS
   ========================================================= */
function speakNative(text, lang, rate, onResult){
  if(!('speechSynthesis' in window)){
    if(onResult){
      onResult(false);
    }
    return;
  }
  try{
    // Önce devam eden sesleri durdur
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    // Uygun dili seç
    const voice = pickVoice(lang);
    if(voice){
      u.voice = voice;
      u.lang = voice.lang;
    }else{
      u.lang = lang;
    }
    u.rate = rate || 0.92;
    u.pitch = 1.0;
    u.volume = 1.0;
    let started = false;
    let finished = false;
    // Native TTS başarısız olursa Google TTS'ye geç
    const fail = () => {
      if(finished) return;
      finished = true;
      if(onResult){
        onResult(false);
      }
    };
    // TTS gerçekten başladı
    u.onstart = () => {
      started = true;
    };
    // TTS başarıyla tamamlandı
    u.onend = () => {
      if(finished) return;
      finished = true;
      if(onResult){
        onResult(true);
      }
    };
    // TTS hata verdi
    u.onerror = () => {
      fail();
    };
    // TTS 2.5 saniye içinde başlamadıysa başarısız kabul et
    setTimeout(() => {
      if(!started && !finished){
        try{
          window.speechSynthesis.cancel();
        }catch(e){}
        fail();
      }
    }, 2500);
    // TTS'yi başlat
    window.speechSynthesis.speak(u);
  }catch(e){
    if(onResult){
      onResult(false);
    }
  }
}
/* =========================================================
   6. ANA SESLENDİRME
   ÖNCE NATIVE TTS
   BAŞARISIZSA GOOGLE TTS
   ========================================================= */
function speak(text, lang){
  if(!soundOn) return;
  // Önce cihazın kendi TTS sistemini dene
  speakNative(
    text,
    lang,
    0.92,
    (ok) => {
      // Native TTS başarısız olduysa
      // Google Translate TTS'yi kullan
      if(!ok){
        const code = String(lang).split('-')[0];
        speakGoogle(
          text,
          code,
          false,
          () => {}
        );
      }
    }
  );
}
/* =========================================================
   7. YAVAŞ SESLENDİRME
   ÖNCE NATIVE TTS
   BAŞARISIZSA GOOGLE TTS
   ========================================================= */
function speakSlow(text, lang){
  if(!soundOn) return;
  // Önce cihazın kendi TTS sistemini dene
  speakNative(
    text,
    lang,
    0.55,
    (ok) => {
      // Native TTS başarısız olduysa
      // Google Translate TTS'yi kullan
      if(!ok){
        const code = String(lang).split('-')[0];
        speakGoogle(
          text,
          code,
          true,
          () => {}
        );
      }
    }
  );
}
/* =========================================================
   8. MEDYANIN / TARAYICININ TTS MOTORUNU ISIT
   ========================================================= */
function warmUpSpeech(){
  if(!('speechSynthesis' in window)) return;
  try{
    loadVoices();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
/* =========================================================
   9. GOOGLE TTS FONKSİYONUNU DIŞARIDAN ERİŞİLEBİLİR YAP
   ========================================================= */
window.PM_speakGoogle = speakGoogle;
/* ======================= OTURUM SÜRESİ GÖSTERGESİ ======================= */
function startSessionTimer(){
  const el = document.getElementById('sessionTimer');
  if(!el) return;
  const start = Date.now();
  function fmt(totalSeconds){
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const H = t('hour_abbr'), M = t('min_abbr'), S = t('sec_abbr');
    if(h > 0) return `${h}${H} ${m}${M} ${sec}${S}`;
    if(m > 0) return `${m}${M} ${sec}${S}`;
    return `${sec}${S}`;
  }
  function tick(){
    const elapsed = (window.LB_getActiveSeconds ? window.LB_getActiveSeconds() : (Date.now() - start) / 1000);
    const idle = (window.LB_isIdle ? window.LB_isIdle() : false);
    el.textContent = `${t('session_time')(fmt(elapsed))}${idle ? ' ⏸' : ''}`;
  }
  tick();
  setInterval(tick, 1000);
}

document.getElementById('soundBtn').onclick = () => {
  soundOn = !soundOn;
  const btn = document.getElementById('soundBtn');
  btn.classList.toggle('on', soundOn);
  btn.classList.toggle('off', !soundOn);
  const offLabel = document.getElementById('soundOffLabel');
  if(offLabel) offLabel.classList.toggle('show', !soundOn);
  if(!soundOn){
    if(window.VOICE_stop) window.VOICE_stop();
    else if('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
};

document.getElementById('fullscreenBtn').onclick = () => {
  try{
    if(!document.fullscreenElement){
      (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen || function(){}).call(document.documentElement);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || function(){}).call(document);
    }
  }catch(e){}
};

document.getElementById('infoBtn').onclick = () => {
  const el = document.getElementById('infoPanel');
  if(el) el.classList.add('open');
};
document.getElementById('infoCloseBtn').onclick = () => {
  const el = document.getElementById('infoPanel');
  if(el) el.classList.remove('open');
};
document.getElementById('howToOpenBtn').onclick = () => {
  const el = document.getElementById('howToPanel');
  if(el) el.classList.add('open');
};
document.getElementById('howToCloseBtn').onclick = () => {
  const el = document.getElementById('howToPanel');
  if(el) el.classList.remove('open');
};

/* ======================= COLOR SPLIT (kök eşleştirmeli) ======================= */
function normalizeWord(w){
  return String(w)
    .replace(/^(der|die|das)\s+/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim();
}

function buildCandidates(word){
  const w = word.toLowerCase();
  const cands = new Set([w]);
  if(/mek$/.test(w) && w.length > 5){ cands.add(w.slice(0, -3)); cands.add(w.slice(0, -4)); }
  else if(/mak$/.test(w) && w.length > 5){ cands.add(w.slice(0, -3)); cands.add(w.slice(0, -4)); }
  if(/en$/.test(w) && w.length > 4) cands.add(w.slice(0, -2));
  if(w.length > 4) cands.add(w.slice(0, Math.ceil(w.length * 0.7)));
  return Array.from(cands).filter(c => c.length >= 2).sort((a, b) => b.length - a.length);
}

function findStemMatch(sentence, dictWord){
  const clean = normalizeWord(dictWord);
  if(!clean) return null;
  const skip = new Set(['sich','zu','to','a','an','the','in','on','at','for','with','of','up','out','get','be']);
  const tokens = clean.split(/\s+/).filter(t => t && !skip.has(t.toLowerCase()));
  const mainToken = tokens.sort((a, b) => b.length - a.length)[0] || clean;
  const isShort = mainToken.length <= 2;
  const candidates = isShort ? [mainToken.toLowerCase()] : buildCandidates(mainToken);

  const parts = sentence.split(/(\s+)/);
  for(const target of candidates){
    let bestIdx = -1, bestLen = -1;
    for(let i = 0; i < parts.length; i++){
      const clean2 = parts[i].normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}]/gu, '');
      if(!clean2) continue;
      if(isShort){
        if(clean2 === target){ bestIdx = i; break; }
        continue;
      }
      if(clean2.length < target.length) continue;
      let common = 0;
      for(let k = 0; k < target.length; k++){
        if(clean2[k] === target[k]) common++; else break;
      }
      if(common === target.length && clean2.length > bestLen){
        bestLen = clean2.length; bestIdx = i;
      }
    }
    if(bestIdx !== -1){
      let offset = 0;
      for(let i = 0; i < bestIdx; i++) offset += parts[i].length;
      return { start: offset, end: offset + parts[bestIdx].length };
    }
  }
  return null;
}

function colorSplit(sentence, word, c1, c2){
  if(!sentence) return '';
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const range = findStemMatch(sentence, word);
  if(!range){
    return `<span style="color:${c1}">${esc(sentence)}</span>`;
  }
  const before = sentence.slice(0, range.start);
  const match = sentence.slice(range.start, range.end);
  const after = sentence.slice(range.end);
  return `${esc(before)}<span style="color:${c1}">${esc(match)}</span><span style="color:${c2}">${esc(after)}</span>`;
}

/* ======================= RENDER: LANG / LEVEL / CHIPS ======================= */
function renderLangPair(){
  const L = LANGS[activeLang];
  const colorMap = { de:"var(--gold)", en:"var(--cyan-soft)", ar:"var(--green)", fr:"var(--pink)", es:"var(--red)", ru:"var(--violet)", tr:"#ff5a5a" };
  if(isReversed()){
    document.getElementById('langPair').innerHTML =
      `<span class="a tr-flag-text">Türkçe</span> <span style="color:var(--muted)">⇄</span> <span class="a" style="color:${colorMap[activeLang]}">${L.native}</span>`;
  } else if(isCross()){
    document.getElementById('langPair').innerHTML =
      `<span class="a" style="color:${colorMap[activeLang]}">${L.native}</span> <span style="color:var(--muted)">⇄</span> <span class="a" style="color:${colorMap[NATIVE_LANG]}">${LANGS[NATIVE_LANG].native}</span>`;
  } else {
    document.getElementById('langPair').innerHTML =
      `<span class="a" style="color:${colorMap[activeLang]}">${L.native}</span> <span style="color:var(--muted)">⇄</span> <span class="a tr-flag-text">Türkçe</span>`;
  }
}

function rebuildLevelBox(){
  const L = LANGS[activeLang];
  const allLevels = ["TÜMÜ", ...L.levels];
  if(!allLevels.includes(activeLevel)) activeLevel = "TÜMÜ";
  const box = document.getElementById('levelBox');
  box.innerHTML = '';
  allLevels.forEach(lv => {
    const d = document.createElement('div');
    d.className = 'level-opt' + (lv===activeLevel ? ' active' : '');
    d.textContent = (lv === "TÜMÜ") ? t('level_all') : lv;
    d.onclick = () => { activeLevel = lv; activeCat='Tümü'; rebuildLevelBox(); rebuildChips(); applyFilter(); };
    box.appendChild(d);
  });
}

function poolForLevel(){
  if(activeLevel === "TÜMÜ") return basePool();
  return basePool().filter(v => v.level===activeLevel);
}

function rebuildChips(){
  const pool = poolForLevel();
  const categoryCounts=LUMIRA_CATALOG.categoryCounts(pool);
  const cats=[...categoryCounts.keys()].sort((a,b)=>a.localeCompare(b,'tr'));
  if(cats.length && !cats.includes(activeCat) && activeCat !== 'Tümü') activeCat = 'Tümü';

  const gridEl = document.getElementById('catGrid');
  gridEl.innerHTML = '';
  cats.forEach(cat=>{
    const c = document.createElement('div');
    c.className = 'chip' + (cat===activeCat ? ' active' : '');
    c.textContent = catName(cat)+' · '+categoryCounts.get(cat);
    c.dataset.cat = cat;
    c.onclick = () => {
      activeCat = cat;
      applyFilter();
      closeCatPanel();
    };
    gridEl.appendChild(c);
  });
  updateCatUI();
}

function updateCatUI(){
  const allChip = document.getElementById('catAllChip');
  const trigger = document.getElementById('catTrigger');
  const isAll = activeCat === 'Tümü';
  allChip.textContent = t('cat_all')+' · '+poolForLevel().length;
  allChip.classList.toggle('active', isAll);
  trigger.classList.toggle('active', !isAll);
  trigger.textContent = isAll ? ('📂 '+t('cat_pick')) : ('📂 ' + catName(activeCat));
  document.querySelectorAll('#catGrid .chip').forEach(c=>{
    c.classList.toggle('active', c.dataset.cat===activeCat);
  });
}

function openCatPanel(){ document.getElementById('catOverlay').classList.add('open'); }
function closeCatPanel(){ document.getElementById('catOverlay').classList.remove('open'); }

document.getElementById('catAllChip').onclick = () => { activeCat = 'Tümü'; applyFilter(); };
document.getElementById('catTrigger').onclick = openCatPanel;
document.getElementById('catClose').onclick = closeCatPanel;
document.getElementById('catOverlay').onclick = (e) => { if(e.target.id === 'catOverlay') closeCatPanel(); };

document.querySelectorAll('.lang-opt').forEach(opt=>{
  opt.onclick = () => {
    const target = opt.dataset.lang;
    opt.style.opacity = '.55';
    setLangPair(NATIVE_LANG, target).then(()=>{
      opt.style.opacity = '';
      document.querySelectorAll('.lang-opt').forEach(o=>o.classList.toggle('active', o===opt));
      activeLevel = "TÜMÜ";
      activeCat = 'Tümü';
      renderLangPair();
      rebuildLevelBox();
      rebuildChips();
      applyFilter();
    }).catch(()=>{ opt.style.opacity = ''; });
  };
});

function applyFilter(){
  updateCatUI();
  const pool = poolForLevel();
  deck = activeCat==='Tümü' ? [...pool] : pool.filter(v=>v.cat===activeCat);
  idx = 0; flipped = false;
  restoreCardPosition();
  renderCard();
  if(document.getElementById('tabQuiz')?.classList.contains('active'))buildQuizDeck();
}

/* ======================= CARD RENDER ======================= */
var CAT_EMOJI = {
  'Aile':'👨‍👩‍👧','Alışveriş':'🛍️','Aylar':'📅','Bahçe':'🌷','Bayramlar':'🎉','Bağlaçlar':'🔗',
  'Kalıp Cümleler':'✉️','Deyimler':'💬','Doğa':'🌿','Duygular':'😊','Duygu':'😊','Edatlar':'🔤','Ev Eşyaları':'🪑','Ev İşleri':'🧹',
  'Ev':'🏠','Eylemler':'🏃','Fiiller':'🏃','Eğitim':'📚','Genel':'🗂️','Giysi':'👕','Günler':'📆','Hava Durumu':'🌤️',
  'Hayvanlar':'🐾','Hobiler':'🎨','Kişilik':'🧑','Malzeme':'🧱','Meslekler':'👔','Meslek':'👔','Mevsimler':'🍂',
  'Meyve ve Sebze':'🍎','Mutfak':'🍳','Okul':'🏫','Renkler':'🎨','Renk':'🎨','Sanat':'🎭','Sayılar':'🔢',
  'Sağlık':'🏥','Selamlaşma':'👋','Sinema ve Televizyon':'🎬','Sorular':'❓','Spor':'⚽','Sıfatlar':'🏷️','Sıfat':'🏷️',
  'Teknoloji':'💻','Toplum':'🏙️','Ulaşım':'🚗','Ekonomi':'💰','Bilim':'🔬','Seyahat':'✈️','Yemek':'🍽️',
  'Gıda':'🍽️','Yiyecek':'🍽️','İçecek':'🥤','İş Dünyası':'💼','İş':'💼','Müzik':'🎵','Vücut':'💪','Zaman':'⏰',
  'Şehir':'🏙️','Ülkeler':'🌍','Coğrafya':'🗺️','Tarih':'📜','Din':'🕌','Hukuk':'⚖️','Siyaset':'🏛️',
  'Matematik':'➗','Gramer':'🔤','Zamirler':'🔤','Zarflar':'🔤','İletişim':'📞','Para':'💰','Bankacılık':'🏦',
  'İnternet':'🌐','Oyun':'🎮','Kitaplar':'📕','Yön':'🧭','Ölçü':'📏','Araçlar':'🔧','Bitkiler':'🌱'
};
function renderCard(){
  if(deck.length===0){
     document.getElementById('frontWord').textContent = "Kelime Yok";
     document.getElementById('trWord').textContent = "";
     document.getElementById('frontExample').textContent = "";
     document.getElementById('trExample').textContent = "";
     const exampleNote=document.getElementById('exampleTranslationNote');if(exampleNote)exampleNote.hidden=true;
     if(typeof nbUpdateFavStar === 'function') nbUpdateFavStar();
     if(typeof nbRenderDifficultyBox === 'function') nbRenderDifficultyBox();
     if(typeof nbUpdateFinishButton === 'function') nbUpdateFinishButton();
     return;
  }
  const v = deck[idx];
  document.getElementById('card')?.classList.toggle('phrase-card',!!v.phraseId||cardFrontWord(v).length>65||cardBackWord(v).length>85);
  const L = LANGS[v.lang];
  const frontWordEl = document.getElementById('frontWord');
  frontWordEl.textContent = cardFrontWord(v);
  frontWordEl.setAttribute('dir', cardFrontDir(v));
  document.getElementById('frontPos').textContent = catName(v.cat) || v.pos;
  document.getElementById('tagFront').textContent = cardFrontLabel(v);
  document.getElementById('tagBack').textContent = cardBackLabel(v);
  document.getElementById('trWord').textContent = cardBackWord(v);

  const frontEx = document.getElementById('frontExample');
  frontEx.innerHTML = colorSplit(cardFrontExample(v), cardFrontWord(v), v.c1, v.c2);
  frontEx.setAttribute('dir', cardFrontDir(v));

  refreshCardExample();

  document.getElementById('cardCount').textContent = `${idx+1} / ${deck.length}`;
  document.getElementById('cardCat').textContent = activeCat;
  document.getElementById('cardBar').style.width = `${((idx+1)/deck.length)*100}%`;
  document.getElementById('levelBadgeFront').textContent = v.level;
  document.getElementById('levelBadgeBack').textContent = v.level;
  /* kategoriye uygun soluk arka plan emojisi (her iki yüz) */
  var _catE = (CAT_EMOJI[v.cat] || '📖');
  var _fbg = document.getElementById('frontBgEmoji'); if(_fbg) _fbg.textContent = _catE;
  var _bbg = document.getElementById('backBgEmoji'); if(_bbg) _bbg.textContent = _catE;
  document.getElementById('card').classList.remove('flipped');
  flipped = false;
  if(typeof nbUpdateFavStar === 'function') nbUpdateFavStar();
  if(typeof nbRenderDifficultyBox === 'function') nbRenderDifficultyBox();
  if(typeof nbUpdateFinishButton === 'function') nbUpdateFinishButton();
}

/* Updating an asynchronously translated example must preserve the current
   card, its flipped state, navigation position and keyboard focus. */
function refreshCardExample(){
  const v=deck[idx],el=document.getElementById('trExample');if(!v || !el || document.getElementById('cardsView')?.style.display==='none')return;
  const meaning=isNotebookPair(v)?(v.meaningLang||'tr'):NATIVE_LANG;
  const source=isNotebookPair(v)?v.lang:(isReversed()?'tr':v.lang);
  const text=cardBackExample(v),E=window.LUMIRA_EXAMPLES;
  el.innerHTML=colorSplit(text,cardBackWord(v),v.c1,v.c2);el.setAttribute('dir',cardBackDir(v));
  let note=document.getElementById('exampleTranslationNote');
  if(!note){note=document.createElement('div');note.id='exampleTranslationNote';note.className='example-translation-note';el.after(note);}
  note.replaceChildren();note.hidden=true;
  const needs=!isNotebookPair(v) && isCross() && !v.exTr && v.ex;
  if(!needs){if(!text && v._exampleTranslation==='unavailable')el.textContent=window.LUMIRA_VOCAB_PAIRS.missing[meaning];return;}
  if(!E){el.textContent=window.LUMIRA_VOCAB_PAIRS.missing[meaning];return;}
  const cached=E.get(source,meaning,v.ex);
  if(cached){el.innerHTML=colorSplit(cached,cardBackWord(v),v.c1,v.c2);note.textContent=E.label('automatic');note.hidden=false;return;}
  E.request(source,meaning,v.ex);
  const state=E.state(source,meaning,v.ex);el.textContent=E.label(state);
  if(state!=='loading'){
    const button=document.createElement('button');button.type='button';button.textContent=E.label('retry');button.disabled=navigator.onLine===false;
    button.onclick=e=>{e.stopPropagation();E.request(source,meaning,v.ex,{retry:true});refreshCardExample();};note.append(button);note.hidden=false;
  }
  // Four nearby examples share one server request and are ready before a flip.
  for(let n=1;n<=3;n++){const next=deck[(idx+n)%deck.length];if(next && next.lang===source && !next.exTr && next.ex)E.request(source,meaning,next.ex,{priority:1});}
}
window.refreshCardExample=refreshCardExample;

document.getElementById('rabbitBtn').onclick = (e) => {
  e.stopPropagation();
  const v = deck[idx]; if(!v) return;
  if(window.VOICE_speakManual) window.VOICE_speakManual(cardFrontWord(v), cardFrontVoice(v), false);
  else speak(cardFrontWord(v), cardFrontVoice(v));
};
document.getElementById('turtleBtn').onclick = (e) => {
  e.stopPropagation();
  const v = deck[idx]; if(!v) return;
  if(window.VOICE_speakManual) window.VOICE_speakManual(cardFrontWord(v), cardFrontVoice(v), true);
  else speakSlow(cardFrontWord(v), cardFrontVoice(v));
};

document.getElementById('card').onclick = () => {
  flushCardNavigation();
  flipped = !flipped;
  document.getElementById('card').classList.toggle('flipped', flipped);
  const v = deck[idx];
  if(!v) return;
  if(!flipped){ (window.VOICE_autoSpeak||speak)(cardFrontWord(v), cardFrontVoice(v)); }
  saveCardPosition();
};

let cardNavigationFrame=0;
function flushCardNavigation(){
  if(!cardNavigationFrame)return;
  cancelAnimationFrame(cardNavigationFrame);cardNavigationFrame=0;
  renderCard();saveCardPosition();
}
function scheduleCardNavigation(){
  if(!cardNavigationFrame)cardNavigationFrame=requestAnimationFrame(flushCardNavigation);
  const v=deck[idx];
  if(v)(window.VOICE_autoSpeak||speak)(cardFrontWord(v),cardFrontVoice(v));
}
document.getElementById('nextBtn').onclick = () => {
  if(deck.length===0) return;
  idx = (idx+1) % deck.length;
  scheduleCardNavigation();
};
document.getElementById('prevBtn').onclick = () => {
  if(deck.length===0) return;
  idx = (idx-1+deck.length) % deck.length;
  scheduleCardNavigation();
};
document.getElementById('shuffleBtn').onclick = () => {
  for(let i=deck.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
  idx = 0; renderCard();
  saveCardPosition();
};

/* ======================= KART KONUMU HAFIZASI (sessionStorage) =======================
   Sekme/uygulama arka plana atılsa veya ekran kilitlense bile kaldığı yerden
   devam etsin diye sessionStorage kullanıyoruz (localStorage DEĞİL): tarayıcı
   sekmesi tamamen kapatılıp yeniden açıldığında (yeni gün, yeni oturum) bu
   veri otomatik silinir ve kullanıcı en baştan başlar — istenen davranış budur. */
const CARD_POS_KEY = 'cardPos_v1';
function saveCardPosition(){
  try{
    sessionStorage.setItem(CARD_POS_KEY, JSON.stringify({ lang:activeLang, level:activeLevel, cat:activeCat, idx }));
  }catch(e){}
}
function restoreCardPosition(){
  try{
    const raw = sessionStorage.getItem(CARD_POS_KEY);
    if(!raw) return;
    const saved = JSON.parse(raw);
    if(saved.lang===activeLang && saved.level===activeLevel && saved.cat===activeCat && saved.idx < deck.length){
      idx = saved.idx;
    }
  }catch(e){}
}

/* ======================= QUIZ ======================= */
function buildQuizDeck(){
  quizDeck = [...deck];
  mistakes = [];
  quizAnswers = [];
  for(let i=quizDeck.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [quizDeck[i],quizDeck[j]]=[quizDeck[j],quizDeck[i]]; }
  qIdx = 0; score = 0; answered = false;
  const quizTabActive = document.getElementById('tabQuiz').classList.contains('active') || document.getElementById('tabNotebook').classList.contains('active');
  document.getElementById('doneView').style.display = 'none';
  document.getElementById('mistakesView').style.display = 'none';
  if(quizTabActive){ document.getElementById('quizView').style.display = 'block'; }
  try{
    renderQuiz._done = false;
    if(window.LUMIRA_TRACK) window.LUMIRA_TRACK('started_quiz');
    if(window.LUMIRA_TRACK_FUNNEL) window.LUMIRA_TRACK_FUNNEL('quiz_started');
  }catch(e){}
  renderQuiz();
}

function renderQuiz(){
  const quizTabActive = document.getElementById('tabQuiz').classList.contains('active') || document.getElementById('tabNotebook').classList.contains('active');
  if(quizDeck.length===0) return;
  if(qIdx >= quizDeck.length){
    const answeredCount = quizAnswers.filter(a=>a).length;
    /* huni ölçümü: quizi bitirenler */
    try{
      if(!renderQuiz._done){
        renderQuiz._done = true;
        if(window.LUMIRA_TRACK) window.LUMIRA_TRACK('finished_quiz');
        if(window.LUMIRA_TRACK_FUNNEL) window.LUMIRA_TRACK_FUNNEL('quiz_finished');
      }
    }catch(e){}
    if(quizTabActive){
      document.getElementById('quizView').style.display = 'none';
      document.getElementById('doneView').style.display = 'block';
      const mistakeBtn = document.getElementById('showMistakesBtn');
      if(mistakes.length > 0) {
        mistakeBtn.style.display = 'block';
      } else {
        mistakeBtn.style.display = 'none';
      }
      const backNb = document.getElementById('nbBackToNotebookBtn');
      if(backNb) backNb.style.display = (activeCat === 'Notlarım') ? 'block' : 'none';
    }
    document.getElementById('finalScore').textContent = t('quiz_final_score')(score, answeredCount);
    return;
  }
  if(quizTabActive){
    document.getElementById('quizView').style.display = 'block';
    document.getElementById('doneView').style.display = 'none';
    document.getElementById('mistakesView').style.display = 'none';
  }
  const v = quizDeck[qIdx];
  const qWordEl = document.getElementById('quizWord');
  qWordEl.textContent = cardFrontWord(v);
  qWordEl.setAttribute('dir', cardFrontDir(v));
  document.getElementById('quizPos').textContent = catName(v.cat) || v.pos;
  document.getElementById('quizCount').textContent = t('quiz_progress')(qIdx+1, quizDeck.length);
  document.getElementById('quizBar').style.width = `${((qIdx+1)/quizDeck.length)*100}%`;
  document.getElementById('scorePill').textContent = t('quiz_score')(score);

  const existing = quizAnswers[qIdx];

  const prevBtnEl = document.getElementById('quizPrevBtn');
  if(prevBtnEl) prevBtnEl.disabled = (qIdx===0);
  const nextBtnEl = document.getElementById('quizNextBtn');
  if(nextBtnEl) nextBtnEl.disabled = !existing;
  const finishBtnEl = document.getElementById('quizFinishBtn');
  if(finishBtnEl) finishBtnEl.disabled = (quizAnswers.filter(a=>a).length===0);

  const optionsEl = document.getElementById('options');
  optionsEl.innerHTML = '';

  if(existing){
    // Daha önce cevaplanmış soru: sadece görüntüle, seçim değiştirilemez.
    answered = true;
    existing.opts.forEach(o=>{
      const b = document.createElement('button');
      b.className = 'opt';
      b.textContent = o;
      b.disabled = true;
      if(o === existing.correct) b.classList.add('correct');
      else if(o === existing.chosen) b.classList.add('wrong');
      optionsEl.appendChild(b);
    });
    return;
  }

  answered = false;
  const correctBack = cardBackWord(v);
  let opts = [correctBack];
  /* Çeldiriciler artık sorunun KATEGORİSİNDEN seçiliyor — kategori yeterince
     kalabalık değilse seviyeye, o da yetmezse dile geri düşülür. Amaç:
     kelimeyi bilmeyen biri "hangisi tanıdık" diye rastgele doğru cevaba
     basamasın, gerçekten anlamı bilmesi gereksin. */
  const answerWord = x => isNotebookPair(v) ? x.tr : cardBackWord(x);
  const answerPool = isNotebookPair(v) ? VOCAB.filter(x => x.lang===v.lang) : basePool();
  const levelPool = isNotebookPair(v) ? answerPool.filter(x => x.level===v.level) : poolForLevel();
  let pool = answerPool.filter(x => x.cat===v.cat && answerWord(x) !== correctBack);
  if(pool.length < 3){
    let fallback = levelPool.filter(x => answerWord(x) !== correctBack && !pool.some(p=>answerWord(p)===answerWord(x)));
    pool = pool.concat(fallback);
  }
  if(pool.length < 3){
    let fallback2 = answerPool.filter(x => answerWord(x) !== correctBack && !pool.some(p=>answerWord(p)===answerWord(x)));
    pool = pool.concat(fallback2);
  }
  for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  opts = opts.concat(pool.slice(0,3).map(answerWord));
  for(let i=opts.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [opts[i],opts[j]]=[opts[j],opts[i]]; }

  opts.forEach(o=>{
    const b = document.createElement('button');
    b.className = 'opt';
    b.textContent = o;
    b.onclick = () => selectAnswer(o, correctBack, b, opts);
    optionsEl.appendChild(b);
  });
}

function selectAnswer(chosen, correct, btnEl, opts){
  if(answered) return;
  answered = true;
  const v = quizDeck[qIdx];
  document.querySelectorAll('.opt').forEach(b=>{
    b.disabled = true;
    if(b.textContent===correct) b.classList.add('correct');
    else if(b===btnEl) b.classList.add('wrong');
  });

  quizAnswers[qIdx] = { opts: opts.slice(), chosen: chosen, correct: correct };

  if(chosen===correct) {
    score++;
    /* Her doğru cevap +1 XP */
    try{ if(typeof window.PR_addXp === 'function') window.PR_addXp(1); }catch(e){}
  } else {
    mistakes.push({ word: cardFrontWord(v), correct: correct, given: chosen });
  }
  
  document.getElementById('scorePill').textContent = t('quiz_score')(score);
  setTimeout(()=>{ qIdx++; renderQuiz(); }, 700);
}

document.getElementById('quizPrevBtn').onclick = () => {
  if(qIdx > 0){ qIdx--; renderQuiz(); }
};
document.getElementById('quizNextBtn').onclick = () => {
  if(quizAnswers[qIdx]){ qIdx++; renderQuiz(); }
};
document.getElementById('quizFinishBtn').onclick = () => {
  qIdx = quizDeck.length;
  renderQuiz();
};

document.getElementById('restartBtn').onclick = buildQuizDeck;
if(document.getElementById('nbBackToNotebookBtn')) document.getElementById('nbBackToNotebookBtn').onclick = () => {
  const tabBtn = document.getElementById('tabNotebook'); if(tabBtn) tabBtn.click();
};

document.getElementById('showMistakesBtn').onclick = () => {
    document.getElementById('doneView').style.display = 'none';
    document.getElementById('mistakesView').style.display = 'block';
    
    const list = document.getElementById('mistakesList');
    list.innerHTML = '';
    
    mistakes.forEach(m => {
        list.innerHTML += `
        <div class="mistake-item">
            <div class="mistake-word">${m.word}</div>
            <div class="mistake-given">${t('quiz_your_answer')} <b>${m.given}</b></div>
            <div class="mistake-correct">${t('quiz_correct_answer')} <b>${m.correct}</b></div>
        </div>`;
    });
};

document.getElementById('backToDoneBtn').onclick = () => {
    document.getElementById('mistakesView').style.display = 'none';
    document.getElementById('doneView').style.display = 'block';
};

/* ======================= TABS ======================= */
// $ : küçük bir yardımcı — eleman yoksa (ör. dosyalardan biri eski kaldıysa)
// sessizce atlar, TÜM script'in çökmesine (ve giriş tıklamasının bile
// çalışmamasına) yol açmaz.
function $(id){ return document.getElementById(id); }
function setDisplay(id, val){ const el = $(id); if(el) el.style.display = val; }
function toggleActive(id,on){const el=$(id);if(el){el.classList.toggle('active',on);if(el.getAttribute('role')==='tab'){el.setAttribute('aria-selected',String(on));el.tabIndex=on?0:-1;}}}

function deactivateAllTabs(){
  window.VOICE_stop?.();window.LUMIRA_LANGUAGE?.close();
  window.LUMIRA_STORIES?.unmount();window.LUMIRA_LEARNING?.unmount();
  ['tabWriting','tabPlacement','tabStories'].forEach(id=>toggleActive(id,false));
  setDisplay('maintenanceView','none');
  if(window.LUMIRA_LIVE && window.LUMIRA_LIVE.isMounted()) window.LUMIRA_LIVE.unmount();
  try{document.body.classList.remove('pm-active');}catch(e){}
  try{document.body.classList.remove('notebook-active');}catch(e){}
  toggleActive('tabCards', false);
  toggleActive('tabQuiz', false);
  toggleActive('tabLiveTranslate', false);
  toggleActive('tabPersonal', false);
  toggleActive('tabNotebook', false);
  setDisplay('cardsView', 'none');
  setDisplay('quizView', 'none');
  setDisplay('liveTranslateView', 'none');
  setDisplay('doneView', 'none');
  setDisplay('mistakesView', 'none');
  setDisplay('personalView', 'none');
  setDisplay('notebookView', 'none');
  // Kişisel mod farklı bir tema/arkaplan kullandığı için sekmeden çıkınca
  // ana chip/level seçicilerini tekrar görünür yapıyoruz.
  setDisplay('levelBox', '');
  setDisplay('chips', '');
  setDisplay('langBox', '');
  setDisplay('mainSub', '');
}
if($('tabCards')) $('tabCards').onclick = () => {
  deactivateAllTabs();
  toggleActive('tabCards', true);
  setDisplay('cardsView', 'block');
  setDisplay('langBox', '');       /* dil butonları Kartlar'da görünür */
  setDisplay('langPair', '');
  if(activeCat === 'Notlarım'){    /* Notlarım'dan geldiyse normal desteye dön */
    activeCat = 'Tümü';
    applyFilter();
  }
};
if($('tabQuiz')) $('tabQuiz').onclick = () => {
  deactivateAllTabs();
  toggleActive('tabQuiz', true);
  setDisplay('quizView', 'block');
  setDisplay('langBox', '');       /* dil butonları Quiz'de görünür */
  setDisplay('langPair', '');
  if(activeCat === 'Notlarım'){
    activeCat = 'Tümü';
    applyFilter();
  }
  buildQuizDeck();
};
if($('tabLiveTranslate')) $('tabLiveTranslate').onclick = () => {
  if($('tabLiveTranslate').classList.contains('active') && window.LUMIRA_LIVE && window.LUMIRA_LIVE.isMounted()) return;
  deactivateAllTabs();
  toggleActive('tabLiveTranslate', true);
  setDisplay('liveTranslateView', 'block');
  ['levelBox','chips','langBox','langPair'].forEach(id => setDisplay(id, 'none'));
  if(window.LUMIRA_LIVE) window.LUMIRA_LIVE.mount($('liveTranslateView'));
};
if($('tabPersonal')) $('tabPersonal').onclick = () => {
  deactivateAllTabs();
  toggleActive('tabPersonal', true);
  setDisplay('personalView', 'block');
  setDisplay('levelBox', 'none');
  setDisplay('chips', 'none');
  setDisplay('langBox', 'none');    /* Kişisel ayrı sayfa: dil butonları gizli */
  setDisplay('langPair', 'none');
  if(window.PM_open) window.PM_open();
};

if($('tabNotebook')) $('tabNotebook').onclick = () => {
  deactivateAllTabs();
  toggleActive('tabNotebook', true);
  try{document.body.classList.add('notebook-active');}catch(e){}
  setDisplay('notebookView', 'block');
  setDisplay('levelBox', 'none');
  setDisplay('chips', 'none');
  setDisplay('langBox', 'none');
  setDisplay('langPair', 'none');
  nbInitSync();
  nbStudyPicking = false;
  nbRender();
};

['tabWriting','tabPlacement','tabStories'].forEach(id=>{const tab=$(id);tab.onclick=()=>{deactivateAllTabs();toggleActive(id,true);setDisplay('personalView','block');['langBox','langPair','levelBox','chips','mainSub'].forEach(key=>setDisplay(key,'none'));if(id==='tabWriting')window.PM_openWritingPractice?.();else if(id==='tabPlacement')window.PM_openPlacement?.();else window.PM_openStories?.();};});
window.addEventListener('lumira:maintenancechange',()=>{rebuildChips();applyFilter();});

/* =========================================================================
   📒 NOTLARIM — kullanıcının kendi eklediği kelime defteri + favoriler
   Mevcut kelime kartı sistemine (deck / renderCard / nextBtn vb.) DOKUNMADAN,
   sadece "Çalışmaya Başla" ile deck'i kullanıcının kendi kelimeleri +
   favorilediği kelimelerle doldurup aynı kartlar arayüzünü yeniden
   kullanıyoruz. Hazır kelime havuzlarıyla (VOCAB) hiç karışmaz.

   HESABA BAĞLI: Veriler artık localStorage yerine Firebase Realtime
   Database'de, giriş yapan kullanıcının UID'sine bağlı olarak saklanır
   (progress/{uid}/notebook ve progress/{uid}/favorites) — böylece aynı
   hesapla farklı cihazdan girildiğinde de kelimeler ve favoriler görünür.
   Bu yollar zaten mevcut Firebase kuralındaki "progress/$uid" izniyle
   (auth.uid === $uid) kapsandığı için kural değişikliği GEREKMEZ.

   Önceki (sadece bu cihazda, localStorage) sürümden kalan kelimeler varsa,
   ilk senkronizasyonda otomatik olarak hesaba taşınır (nbMigrateLocalOnce).
   ========================================================= */
const LANG_FLAGS = { de:'🇩🇪', en:'🇬🇧', ar:'🇸🇦', fr:'🇫🇷', es:'🇪🇸', ru:'🇷🇺', tr:'🇹🇷' };
const LANG_LANDMARK = { de:'🏛️', en:'🕰️', ar:'🕌', fr:'🗼', es:'⛪', ru:'🏰', tr:'🧿' };
const CAT_I18N = {
  "Aile": { en:"Family", de:"Familie", ar:"العائلة", fr:"Famille", es:"Familia", ru:"Семья" },
  "Alet ve Ekipman": { en:"Tools & Equipment", de:"Werkzeug & Ausrüstung", ar:"الأدوات والمعدات", fr:"Outils et équipement", es:"Herramientas y equipo", ru:"Инструменты и оборудование" },
  "Alışveriş": { en:"Shopping", de:"Einkaufen", ar:"التسوق", fr:"Achats", es:"Compras", ru:"Покупки" },
  "Aylar": { en:"Months", de:"Monate", ar:"الأشهر", fr:"Mois", es:"Meses", ru:"Месяцы" },
  "Baharatlar": { en:"Spices", de:"Gewürze", ar:"التوابل", fr:"Épices", es:"Especias", ru:"Специи" },
  "Bahçe": { en:"Garden", de:"Garten", ar:"الحديقة", fr:"Jardin", es:"Jardín", ru:"Сад" },
  "Banyo": { en:"Bathroom", de:"Badezimmer", ar:"الحمام", fr:"Salle de bain", es:"Baño", ru:"Ванная" },
  "Bayramlar": { en:"Holidays", de:"Feiertage", ar:"الأعياد", fr:"Fêtes", es:"Fiestas", ru:"Праздники" },
  "Bağlaçlar": { en:"Conjunctions", de:"Konjunktionen", ar:"أدوات الربط", fr:"Conjonctions", es:"Conjunciones", ru:"Союзы" },
  "Bilim": { en:"Science", de:"Wissenschaft", ar:"العلوم", fr:"Sciences", es:"Ciencia", ru:"Наука" },
  "Deyimler": { en:"Idioms", de:"Redewendungen", ar:"التعابير الاصطلاحية", fr:"Expressions idiomatiques", es:"Modismos", ru:"Идиомы" },
  "Din": { en:"Religion", de:"Religion", ar:"الدين", fr:"Religion", es:"Religión", ru:"Религия" },
  "Doğa": { en:"Nature", de:"Natur", ar:"الطبيعة", fr:"Nature", es:"Naturaleza", ru:"Природа" },
  "Duygular": { en:"Emotions", de:"Gefühle", ar:"المشاعر", fr:"Émotions", es:"Emociones", ru:"Эмоции" },
  "Edatlar": { en:"Prepositions", de:"Präpositionen", ar:"حروف الجر", fr:"Prépositions", es:"Preposiciones", ru:"Предлоги" },
  "Ekonomi": { en:"Economy", de:"Wirtschaft", ar:"الاقتصاد", fr:"Économie", es:"Economía", ru:"Экономика" },
  "Ev": { en:"Home", de:"Zuhause", ar:"المنزل", fr:"Maison", es:"Casa", ru:"Дом" },
  "Ev Eşyaları": { en:"Household Items", de:"Haushaltsgegenstände", ar:"أدوات المنزل", fr:"Objets ménagers", es:"Artículos del hogar", ru:"Предметы быта" },
  "Ev İşleri": { en:"Housework", de:"Hausarbeit", ar:"الأعمال المنزلية", fr:"Tâches ménagères", es:"Tareas domésticas", ru:"Домашние дела" },
  "Eylemler": { en:"Actions", de:"Handlungen", ar:"الأفعال", fr:"Actions", es:"Acciones", ru:"Действия" },
  "Eğitim": { en:"Education", de:"Bildung", ar:"التعليم", fr:"Éducation", es:"Educación", ru:"Образование" },
  "Fiiller": { en:"Verbs", de:"Verben", ar:"الأفعال (اللغوية)", fr:"Verbes", es:"Verbos", ru:"Глаголы" },
  "Genel": { en:"General", de:"Allgemein", ar:"عام", fr:"Général", es:"General", ru:"Общее" },
  "Giysi": { en:"Clothing", de:"Kleidung", ar:"الملابس", fr:"Vêtements", es:"Ropa", ru:"Одежда" },
  "Görüşler": { en:"Opinions", de:"Meinungen", ar:"الآراء", fr:"Opinions", es:"Opiniones", ru:"Мнения" },
  "Günler": { en:"Days", de:"Tage", ar:"الأيام", fr:"Jours", es:"Días", ru:"Дни" },
  "Hava Durumu": { en:"Weather", de:"Wetter", ar:"الطقس", fr:"Météo", es:"Clima", ru:"Погода" },
  "Hayvanlar": { en:"Animals", de:"Tiere", ar:"الحيوانات", fr:"Animaux", es:"Animales", ru:"Животные" },
  "Hobiler": { en:"Hobbies", de:"Hobbys", ar:"الهوايات", fr:"Loisirs", es:"Pasatiempos", ru:"Хобби" },
  "Kişilik": { en:"Personality", de:"Persönlichkeit", ar:"الشخصية", fr:"Personnalité", es:"Personalidad", ru:"Характер" },
  "Malzeme": { en:"Material", de:"Material", ar:"المواد", fr:"Matériaux", es:"Materiales", ru:"Материалы" },
  "Medya": { en:"Media", de:"Medien", ar:"الإعلام", fr:"Médias", es:"Medios", ru:"Медиа" },
  "Meslekler": { en:"Professions", de:"Berufe", ar:"المهن", fr:"Métiers", es:"Profesiones", ru:"Профессии" },
  "Mevsimler": { en:"Seasons", de:"Jahreszeiten", ar:"الفصول", fr:"Saisons", es:"Estaciones", ru:"Времена года" },
  "Meyve ve Sebze": { en:"Fruits & Vegetables", de:"Obst & Gemüse", ar:"الفواكه والخضروات", fr:"Fruits et légumes", es:"Frutas y verduras", ru:"Фрукты и овощи" },
  "Mutfak": { en:"Kitchen", de:"Küche", ar:"المطبخ", fr:"Cuisine", es:"Cocina", ru:"Кухня" },
  "Müzik": { en:"Music", de:"Musik", ar:"الموسيقى", fr:"Musique", es:"Música", ru:"Музыка" },
  "Ofis": { en:"Office", de:"Büro", ar:"المكتب", fr:"Bureau", es:"Oficina", ru:"Офис" },
  "Okul": { en:"School", de:"Schule", ar:"المدرسة", fr:"École", es:"Escuela", ru:"Школа" },
  "Politika ve Hukuk": { en:"Politics & Law", de:"Politik & Recht", ar:"السياسة والقانون", fr:"Politique et droit", es:"Política y derecho", ru:"Политика и право" },
  "Psikoloji": { en:"Psychology", de:"Psychologie", ar:"علم النفس", fr:"Psychologie", es:"Psicología", ru:"Психология" },
  "Renkler": { en:"Colors", de:"Farben", ar:"الألوان", fr:"Couleurs", es:"Colores", ru:"Цвета" },
  "Sanat": { en:"Art", de:"Kunst", ar:"الفن", fr:"Art", es:"Arte", ru:"Искусство" },
  "Sayılar": { en:"Numbers", de:"Zahlen", ar:"الأرقام", fr:"Nombres", es:"Números", ru:"Числа" },
  "Sağlık": { en:"Health", de:"Gesundheit", ar:"الصحة", fr:"Santé", es:"Salud", ru:"Здоровье" },
  "Selamlaşma": { en:"Greetings", de:"Begrüßungen", ar:"التحية", fr:"Salutations", es:"Saludos", ru:"Приветствия" },
  "Sesler ve Duyular": { en:"Sounds & Senses", de:"Geräusche & Sinne", ar:"الأصوات والحواس", fr:"Sons et sens", es:"Sonidos y sentidos", ru:"Звуки и чувства" },
  "Seyahat": { en:"Travel", de:"Reisen", ar:"السفر", fr:"Voyage", es:"Viajes", ru:"Путешествия" },
  "Sinema ve Televizyon": { en:"Film & TV", de:"Film & Fernsehen", ar:"السينما والتلفزيون", fr:"Cinéma et télévision", es:"Cine y televisión", ru:"Кино и телевидение" },
  "Sorular": { en:"Questions", de:"Fragen", ar:"الأسئلة", fr:"Questions", es:"Preguntas", ru:"Вопросы" },
  "Soyut Kavramlar": { en:"Abstract Concepts", de:"Abstrakte Begriffe", ar:"المفاهيم المجردة", fr:"Concepts abstraits", es:"Conceptos abstractos", ru:"Абстрактные понятия" },
  "Spor": { en:"Sports", de:"Sport", ar:"الرياضة", fr:"Sport", es:"Deportes", ru:"Спорт" },
  "Sıfatlar": { en:"Adjectives", de:"Adjektive", ar:"الصفات", fr:"Adjectifs", es:"Adjetivos", ru:"Прилагательные" },
  "Sıvı Yiyecekler": { en:"Liquid Foods", de:"Flüssige Speisen", ar:"الأطعمة السائلة", fr:"Aliments liquides", es:"Alimentos líquidos", ru:"Жидкая пища" },
  "Teknoloji": { en:"Technology", de:"Technologie", ar:"التكنولوجيا", fr:"Technologie", es:"Tecnología", ru:"Технологии" },
  "Toplum": { en:"Society", de:"Gesellschaft", ar:"المجتمع", fr:"Société", es:"Sociedad", ru:"Общество" },
  "Ulaşım": { en:"Transportation", de:"Transport", ar:"النقل", fr:"Transport", es:"Transporte", ru:"Транспорт" },
  "Vücut": { en:"Body", de:"Körper", ar:"الجسم", fr:"Corps", es:"Cuerpo", ru:"Тело" },
  "Kalıp Cümleler": { en:"Useful Phrases",de:"Nützliche Sätze",ar:"عبارات مفيدة",fr:"Expressions utiles",es:"Expresiones útiles",ru:"Полезные выражения" },
  "Yerler": { en:"Places", de:"Orte", ar:"الأماكن", fr:"Lieux", es:"Lugares", ru:"Места" },
  "Yiyecek": { en:"Food", de:"Essen", ar:"الطعام", fr:"Nourriture", es:"Comida", ru:"Еда" },
  "Zaman": { en:"Time", de:"Zeit", ar:"الوقت", fr:"Temps", es:"Tiempo", ru:"Время" },
  "Zamanlar": { en:"Tenses", de:"Zeitformen", ar:"الأزمنة", fr:"Temps (grammaire)", es:"Tiempos verbales", ru:"Времена (грамматика)" },
  "Zamirler": { en:"Pronouns", de:"Pronomen", ar:"الضمائر", fr:"Pronoms", es:"Pronombres", ru:"Местоимения" },
  "Zarflar": { en:"Adverbs", de:"Adverbien", ar:"الظروف", fr:"Adverbes", es:"Adverbios", ru:"Наречия" },
  "Çevre": { en:"Environment", de:"Umwelt", ar:"البيئة", fr:"Environnement", es:"Medio ambiente", ru:"Окружающая среда" },
  "Ölçüler": { en:"Measurements", de:"Maße", ar:"المقاييس", fr:"Mesures", es:"Medidas", ru:"Измерения" },
  "Ülkeler ve Milliyetler": { en:"Countries & Nationalities", de:"Länder & Nationalitäten", ar:"البلدان والجنسيات", fr:"Pays et nationalités", es:"Países y nacionalidades", ru:"Страны и национальности" },
  "İletişim": { en:"Communication", de:"Kommunikation", ar:"التواصل", fr:"Communication", es:"Comunicación", ru:"Общение" },
  "İlişkiler": { en:"Relationships", de:"Beziehungen", ar:"العلاقات", fr:"Relations", es:"Relaciones", ru:"Отношения" },
  "İş ve Kariyer": { en:"Work & Career", de:"Arbeit & Karriere", ar:"العمل والمهنة", fr:"Travail et carrière", es:"Trabajo y carrera", ru:"Работа и карьера" },
  "Şekiller": { en:"Shapes", de:"Formen", ar:"الأشكال", fr:"Formes", es:"Formas", ru:"Формы" },
};
/* Kategori adı, kullanıcının ANA diline göre çevrilir; ana dil Türkçe
   ise veya sözlükte karşılığı yoksa orijinal (Türkçe) ad döner. */
function catName(trName){
  if(!trName) return trName;
  const nl = (typeof NATIVE_LANG !== 'undefined' && NATIVE_LANG) || 'tr';
  if(nl === 'tr') return trName;
  const entry = CAT_I18N[trName];
  return (entry && entry[nl]) ? entry[nl] : trName;
}
window.CAT_I18N = CAT_I18N; window.catName = catName;
let nbWords = {};        /* {pushId: {w,tr,ex,lang,cat,ts}} — manuel eklenenler */
let nbFavorites = {};    /* ARTIK KULLANILMIYOR (geriye dönük uyumluluk için bırakıldı) — favoriler artık nbWords içinde isFavorite bayrağıyla tutuluyor. */
let nbSyncedUid = null;
let nbSyncRef = null, nbSyncListener = null, nbSyncReady = null;
let nbMigrationTask = null;
const nbFavoriteWrites = new Set();
let nbEditingId = null;      /* düzenlenen manuel kelimenin pushId'si */
let nbSelectedAddLang = null; /* ekleme formunda seçilen dil (zorunlu) */
let nbPrefill = null;         /* Kelime Ara'dan seçilince formu önceden dolduran veri {w,tr,ex,cat} */
let nbStudyPicking = false;   /* false | 'lang' | 'level' — "Çalışmaya Başla" akışının hangi adımda olduğu */
let nbStudyLang = null;       /* çalışma akışında seçilen dil (geçici) */
let nbFilterText = '';
let nbFilterLang = '';
let nbFilterCat = '';
let nbFilterDiff = '';

function nbSanitizeKey(s){
  return 'u_'+encodeURIComponent(String(s||'').normalize('NFC').trim()).replace(/\./g,'%2E');
}
function nbFavKey(lang, w){ return 'fav_' + (lang||'de') + '_' + nbSanitizeKey(w); }
let nbFavoriteIndexSource=null,nbFavoriteIndex=new Map(),nbFavoriteList=[];
function nbFavoriteIdentity(v){return JSON.stringify([v.lang||'de',v.meaningLang||'tr',v.w,v.tr||'']);}
function nbInvalidateFavoriteIndex(){nbFavoriteIndexSource=null;}
function nbEnsureFavoriteIndex(){
  if(nbFavoriteIndexSource===nbWords)return;
  nbFavoriteIndexSource=nbWords;nbFavoriteIndex=new Map();nbFavoriteList=[];
  for(const[id,it]of Object.entries(nbWords||{})){
    if(!it)continue;const key=nbFavoriteIdentity(it);if(!nbFavoriteIndex.has(key))nbFavoriteIndex.set(key,id);
    if(it.isFavorite)nbFavoriteList.push({...it,id,source:'favorite',lang:it.lang||'de',meaningLang:it.meaningLang||'tr'});
  }
  nbFavoriteList.sort((a,b)=>(b.ts||0)-(a.ts||0));
}
window.addEventListener?.('lumira:notebookchange',nbInvalidateFavoriteIndex);
function nbExistingFavId(v, words=nbWords){
  let exact;
  if(words===nbWords){nbEnsureFavoriteIndex();exact=nbFavoriteIndex.get(nbFavoriteIdentity(v));}
  else exact=Object.keys(words||{}).find(id=>{const it=words[id];return it && (it.lang||'de')===v.lang && (it.meaningLang||'tr')===(v.meaningLang||'tr') && it.w===v.w && (it.tr||'')===(v.tr||'');});
  if(exact) return exact;
  const base=nbFavKey(v.lang,v.w); let key=base, suffix=2;
  while(words[key]) key=base+'_'+suffix++;
  return key;
}

function nbInitSync(){
  const db = window.LB_getDb ? window.LB_getDb() : null;
  const uid = window.LB_getUid ? window.LB_getUid() : null;
  if(nbSyncedUid === uid && nbSyncRef) return;
  if(nbSyncRef && nbSyncListener) nbSyncRef.off('value',nbSyncListener);
  nbSyncRef=null; nbSyncListener=null; nbSyncReady=null;
  nbSyncedUid = uid;
  nbWords={}; nbMigrationTask=null; nbOldFavMigrationAttempted=false; nbMigrationAttempted=false; nbDedupeAttempted=false; nbPwaFavMigrationAttempted=false;
  nbFavoriteWrites.clear(); nbEditingId=null;
  if(!db || !uid){nbUpdateFavStar();nbRenderIfOpen();return;}
  let resolveReady,rejectReady;
  nbSyncReady=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  nbSyncReady.catch(()=>{});
  nbSyncRef=db.ref('progress/'+uid+'/notebook');
  nbSyncListener=snap=>{
    if(nbSyncedUid!==uid || nbSyncListener!==listener) return;
    nbWords = snap.val() || {};
    if(!nbMigrationTask){
      nbMigrationTask=Promise.resolve().then(()=>nbSyncedUid===uid?nbMigrateLocalOnce():undefined)
        .then(()=>nbSyncedUid===uid?nbMigrateOldFavoritesOnce():undefined)
        .then(()=>nbSyncedUid===uid?nbMigratePwaFavoritesOnce():undefined)
        .then(()=>nbSyncedUid===uid?nbDedupeIfNeeded():undefined).catch(()=>{});
    }
    nbUpdateFavStar();
    nbRenderIfOpen();
    window.dispatchEvent(new Event('lumira:notebookchange'));
    resolveReady();
  };
  const listener=nbSyncListener;
  nbSyncRef.on('value',nbSyncListener,error=>{
    if(nbSyncedUid!==uid || nbSyncListener!==listener) return;
    rejectReady(error); nbSyncRef?.off('value',nbSyncListener); nbSyncRef=null;
  });
}
/* ESKİ VERİ TAŞIMA: Favoriler önceden ayrı bir 'progress/{uid}/favorites'
   düğümünde tutuluyordu ve favoriden çıkarınca kelime tamamen siliniyordu.
   Artık favoriler de Kelime Defterinin (notebook) kalıcı bir parçası —
   sadece 'isFavorite' bayrağıyla işaretleniyor; favoriden çıkarmak bayrağı
   kaldırır, kelimeyi SİLMEZ. Eski düğümde kalmış veri varsa bir kereliğine
   buraya taşınır. */
let nbOldFavMigrationAttempted = false;
function nbMigrateOldFavoritesOnce(){
  if(nbOldFavMigrationAttempted) return;
  nbOldFavMigrationAttempted = true;
  try{
    if(!nbSyncedUid) return;
    const db = window.LB_getDb(); if(!db) return;
    const uid=nbSyncedUid;
    return db.ref('progress/'+uid+'/favorites').once('value').then(async snap => {
      if(nbSyncedUid!==uid) return;
      const old = snap.val();
      if(!old) return;
      const updates = {}, imported={...nbWords};
      Object.keys(old).forEach(key => {
        const it = old[key] || {};
        if(!it.w) return;
        const favId = nbExistingFavId({...it,lang:it.lang||'de'},imported);
        const existing=imported[favId];
        if(existing && Object.prototype.hasOwnProperty.call(existing,'isFavorite')) return;
        imported[favId]=updates['progress/'+uid+'/notebook/'+favId] = {...{
          w: it.w, tr: it.tr||'', ex: it.ex||'', exTr: it.exTr||'', cat: it.cat||'',
          level: it.level||'', difficulty: it.difficulty||'orta', lang: it.lang||'de',
          isFavorite: true, ts: it.ts || Date.now()
        },...existing,isFavorite:true};
      });
      if(Object.keys(updates).length) await db.ref().update(updates);
      if(nbSyncedUid===uid) await db.ref('progress/'+uid+'/favorites').remove();
    }).catch(()=>{});
  }catch(e){}
}
/* Kullanıcı henüz giriş sürecini tamamlamamış olabilir; uid hazır olana
   kadar (giriş formunu doldurmak dahil, uzunca sürebilir) periyodik dener. */
(function nbWatchAuth(){
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const uid = window.LB_getUid ? window.LB_getUid() : null;
    if(uid){ nbInitSync(); clearInterval(iv); }
    else if(tries > 600){ clearInterval(iv); } /* ~5 dakika sonra vazgeç */
  }, 500);
})();

/* BUG NOTU (düzeltildi): nbMigrateLocalOnce daha önce yalnızca bir
   localStorage bayrağıyla korunuyordu. localStorage.setItem herhangi bir
   sebeple (gizli sekme, depolama kısıtlaması vb.) sessizce başarısız
   olursa, bayrak hiç kalıcı olmuyor ve her push() sonrası tekrar tetiklenen
   'value' olayı fonksiyonu YENİDEN çalıştırıp AYNI kelimeyi tekrar tekrar
   ekliyordu (sonsuz döngü → yüzlerce kopya). Artık bellek-içi bir bayrakla
   (nbMigrationAttempted) sayfa boyunca KESİN olarak bir kez çalışıyor. */
let nbMigrationAttempted = false;
let nbDedupeAttempted = false;
let nbPwaFavMigrationAttempted = false;

/* Eski PWA yıldızı yalnızca bu cihazdaki ayrı bir listeye yazıyordu.
   Başarılı sunucu kaydından sonra işaretlenir; asıl liste yedek olarak kalır. */
function nbMigratePwaFavoritesOnce(){
  if(nbPwaFavMigrationAttempted || !nbSyncedUid) return;
  nbPwaFavMigrationAttempted=true;
  const uid=nbSyncedUid,flag='lumira_pwa_favs_migrated_'+uid;
  try{
    const owner=localStorage.getItem('lumira_pwa_favs_owner');
    if((owner && owner!==uid) || localStorage.getItem(flag)) return;
    let old=JSON.parse(localStorage.getItem('lumira_favs_v1')||'[]');
    if(!Array.isArray(old)) return;
    const updates={},imported={...nbWords};
    old.slice(0,500).forEach(it=>{
      if(!it || typeof it.w!=='string' || !it.w.trim() || !LANGS[it.lang]) return;
      const id=nbExistingFavId(it,imported);
      const existing=imported[id];
      if(existing && Object.prototype.hasOwnProperty.call(existing,'isFavorite')) return;
      imported[id]=updates[id]={w:it.w,tr:it.tr||'',ex:it.ex||'',exTr:it.exTr||'',pos:it.pos||'',lang:it.lang,meaningLang:it.meaningLang||'tr',cat:it.cat||'',level:it.level||'',difficulty:'orta',ts:it.ts||it.at||Date.now(),...existing,isFavorite:true};
    });
    if(old.length) localStorage.setItem('lumira_pwa_favs_owner',uid);
    const write=Object.keys(updates).length?window.LB_getDb().ref('progress/'+uid+'/notebook').update(updates):Promise.resolve();
    return write.then(()=>{localStorage.setItem(flag,'1');}).catch(()=>{nbPwaFavMigrationAttempted=false;});
  }catch(e){nbPwaFavMigrationAttempted=false;}
}

function nbMigrateLocalOnce(){
  if(nbMigrationAttempted || !nbSyncedUid) return;
  nbMigrationAttempted=true;
  const uid=nbSyncedUid,flagKey='lumira_notebook_migrated_'+uid;
  try{
    if(localStorage.getItem(flagKey)) return;
    const raw=localStorage.getItem('lumira_notebook_v1');
    let local=raw?JSON.parse(raw):[];
    if(!Array.isArray(local)) local=[];
    const db=window.LB_getDb();if(!db)return;
    const updates={},imported={...nbWords};
    local.slice(0,200).forEach(item=>{
      if(!item || typeof item.w!=='string' || !item.w.trim())return;
      const value={w:item.w,tr:item.tr||'',ex:item.ex||'',exTr:item.exTr||'',lang:item.lang||'de',meaningLang:item.meaningLang||'tr',cat:item.cat||'',ts:item.ts||Date.now()};
      const id=nbExistingFavId(value,imported);if(imported[id])return;
      imported[id]=updates[id]=value;
    });
    const write=Object.keys(updates).length?db.ref('progress/'+uid+'/notebook').update(updates):Promise.resolve();
    return write.then(()=>{
      localStorage.setItem(flagKey,'1');
      if(localStorage.getItem('lumira_notebook_v1')===raw)localStorage.removeItem('lumira_notebook_v1');
    }).catch(()=>{nbMigrationAttempted=false;});
  }catch(e){nbMigrationAttempted=false;}
}

/* Kendi kendini onaran temizlik: aynı (dil + kelime) için birden fazla
   manuel kayıt varsa (ör. yukarıdaki eski bug'dan kalanlar) yalnızca en
   eskisini tutup gerisini tek seferde siler. Sayfa başına bir kez çalışır. */
function nbDedupeIfNeeded(){
  if(nbDedupeAttempted) return;
  nbDedupeAttempted = true;
  try{
    if(!nbSyncedUid) return;
    const db = window.LB_getDb(); if(!db) return;
    const seen = {};
    const updates = {};
    Object.keys(nbWords||{}).sort().forEach(id => {
      const it = nbWords[id] || {};
      const key = (it.lang||'de')+'::'+(it.meaningLang||'tr')+'::'+nbSanitizeKey(it.w)+'::'+nbSanitizeKey(it.tr||'');
      if(seen[key]){
        const keep=seen[key],merged={...(updates[keep]||nbWords[keep])};
        for(const [field,value]of Object.entries(it))if(merged[field]==null || merged[field]==='')merged[field]=value;
        merged.isFavorite=!!(merged.isFavorite || it.isFavorite);
        updates[keep]=merged;updates[id]=null;
      }
      else{ seen[key] = id; }
    });
    if(Object.keys(updates).length){
      db.ref('progress/'+nbSyncedUid+'/notebook').update(updates).catch(()=>{});
    }
  }catch(e){}
}

function nbRenderIfOpen(){
  const tab = document.getElementById('tabNotebook');
  if(tab && tab.classList.contains('active') && document.getElementById('notebookView').style.display !== 'none'){
    nbRender();
  }
}
/* Dil/arayüz ayarı değiştiğinde açık olan Notlarım listesini aynı anda
   yeniden kurmak için dışarıya güvenli bir kapı. Çalışma kartları
   cardsView'da gösterildiğinden burada yalnızca notebookView görünürken
   render edilir; kullanıcının devam eden kart oturumu bölünmez. */
window.NB_refreshLocale = function(){
  if(!nbEditingId && nbSelectedAddLang === NATIVE_LANG){ nbSelectedAddLang = null; nbPrefill = null; }
  nbRenderIfOpen();
};

function nbEsc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* Dil adını (Almanca/German/Deutsch...) kullanıcının ANA diline göre döner.
   LANGS[code].label her zaman Türkçe olduğu için, varsa I18N'in
   lang_names sözlüğünden NATIVE_LANG'e göre çevrilmiş adı kullanır. */
function learningLanguageCodes(){
  return ['de','en','ar','fr','es','ru','tr'].filter(code => code !== NATIVE_LANG);
}
window.learningLanguageCodes = learningLanguageCodes;
function nbLangLabel(code){
  const names = (typeof t === 'function' && t('lang_names')) || {};
  return names[code] || ((LANGS[code]||{}).label) || code;
}

/* nbWords + nbFavorites birleşik liste — her öğe {id, source, w, tr, ex, lang, cat} */
function nbCombinedList(){
  const out = [];
  Object.keys(nbWords||{}).forEach(id => {
    const it = nbWords[id] || {};
    out.push({ id, source: it.isFavorite ? 'favorite' : 'manual', w:it.w, tr:it.tr||'', ex:it.ex||'', exTr:it.exTr||'', pos:it.pos||'', meaningLang:it.meaningLang || (it.lang === 'tr' ? NATIVE_LANG : 'tr'), lang:it.lang||'de', cat:it.cat||'', level:it.level||'', difficulty:it.difficulty||'orta', ts:it.ts||0 });
  });
  out.sort((a,b) => (b.ts||0) - (a.ts||0));
  return out;
}
function nbLangsPresent(list){
  const seen = {};
  list.forEach(it => { seen[it.lang||'de'] = true; });
  return Object.keys(seen);
}

/* ---------------------- Özel açılır menü (native <select> yerine) ----------------------
   Native <select>'in açılır listesi tarayıcı temasını kullanır ve uygulamanın
   koyu temasıyla uyuşmuyordu. Bunun yerine uygulamanın kendi görsel diliyle
   (arama sonucu kutusuyla aynı stil) tamamen özel, dokunmatik-uyumlu bir
   açılır menü. */
function nbCSelectHtml(id, options, selectedVal, placeholderLabel){
  return '<div class="nb-cselect" id="'+id+'Box"><select data-lumira-select id="'+id+'Native" aria-label="'+nbEsc(placeholderLabel||'')+'">'+options.map(o=>'<option value="'+nbEsc(o[0])+'"'+(o[0]===selectedVal?' selected':'')+'>'+nbEsc(o[1])+'</option>').join('')+'</select></div>';
}
function nbCSelectBind(id,onChange){
  const select=document.getElementById(id+'Native');if(!select)return;
  select.onchange=()=>onChange(select.value);window.LUMIRA_LANGUAGE?.enhance(select);
}

/* ---------------------- Hazır listede kelime arama ---------------------- */
function nbEnsureSearchVocabReady(cb){
  try{
    const langs = nbSelectedAddLang ? [nbSelectedAddLang === 'tr' ? NATIVE_LANG : nbSelectedAddLang] : Object.keys(LANGS);
    const need = langs.filter(l => !(window.VOCAB_LOADED && window.VOCAB_LOADED[l]));
    if(!need.length || !window.ensureVocab){ cb(); return; }
    Promise.all(need.map(l => window.ensureVocab(l))).then(cb).catch(cb);
  }catch(e){ cb(); }
}
function nbSearchVocab(query){
  const q = query.trim().toLowerCase();
  if(!q || typeof VOCAB === 'undefined') return [];
  const langFilter = nbSelectedAddLang;
  const starts = [];
  const contains = [];
  for(let i=0; i<VOCAB.length; i++){
    let v = VOCAB[i];
    if(langFilter === 'tr'){
      if(v.lang !== NATIVE_LANG) continue;
      v = { ...v, lang:'tr', w:v.tr, tr:v.w, ex:v.exTr, exTr:v.ex };
    }else if(langFilter && v.lang !== langFilter) continue;
    const w = (v.w||'').toLowerCase();
    const tr = (v.tr||'').toLowerCase();
    if(w.indexOf(q) === 0 || tr.indexOf(q) === 0){ starts.push(v); }
    else if(w.indexOf(q) > -1 || tr.indexOf(q) > -1){ contains.push(v); }
    if(starts.length >= 8) break;
  }
  return starts.concat(contains).slice(0, 8);
}
/* --------------------------- Akıllı otomatik doldurma ---------------------------
   Not: Bu statik (sunucusuz) sitede gerçek bir üretken yapay zeka API'sini
   güvenle çağıramayız — API anahtarını tarayıcıya koymak herkesin onu
   çalıp kötüye kullanmasına açık kapı bırakır. Onun yerine "akıllı
   doldurma" yapıyoruz: kelime hazır 30.000+ kelimelik veritabanımızda
   varsa oradaki kategori/örnek cümleyi kullanıyoruz; yoksa basit ama
   dilbilgisel olarak doğru bir şablon cümle üretip kategoriyi "Genel"
   olarak bırakıyoruz. Kullanıcı istediği zaman elle değiştirebilir. */
function nbFindExactVocabMatch(lang, word){
  if(lang === 'tr') return nbSearchVocab(word).find(v => v.w.toLowerCase() === word.trim().toLowerCase()) || null;
  if(typeof VOCAB === 'undefined') return null;
  const q = word.trim().toLowerCase();
  for(let i=0;i<VOCAB.length;i++){
    const v = VOCAB[i];
    if(v.lang === lang && (v.w||'').toLowerCase() === q) return v;
  }
  return null;
}
/* Sözlükte tam eşleşmesi olmayan (tamamen özel/yeni) kelimeler için otomatik
   örnek cümle: TEK bir kalıbı harfi harfine tekrar etmek yerine, kelimeye
   göre SABİT ama ÇEŞİTLİ bir kalıp seçilir (aynı kelime her zaman aynı
   cümleyi alır, ama farklı kelimeler farklı cümle yapıları görür). Gerçek
   bir yapay zekâ değildir - dilbilgisi/cinsiyet/hal bilgisi olmadan kelimeyi
   cümleye doğru şekilde çekemeyiz - ama en azından tek düze şablon tekrarı
   yerine daha doğal, çeşitlenmiş günlük-defteri cümleleri sunar. */
function nbTemplateIndex(word){
  let h = 0;
  const s = String(word||'');
  for(let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) >>> 0; }
  return h % 5;
}
const NB_TEMPLATE_EX = {
  de: w => [
    'Ich habe heute das Wort "'+w+'" gelernt.',
    'Das Wort "'+w+'" ist neu für mich.',
    'Ich habe gerade das Wort "'+w+'" entdeckt.',
    'Ich möchte mir das Wort "'+w+'" merken.',
    'Heute ist mir das Wort "'+w+'" begegnet.'
  ][nbTemplateIndex(w)],
  en: w => [
    'I learned the word "'+w+'" today.',
    'The word "'+w+'" is new to me.',
    'I just came across the word "'+w+'".',
    'I want to remember the word "'+w+'".',
    'Today I noted down the word "'+w+'".'
  ][nbTemplateIndex(w)],
  ar: w => [
    'تعلمت اليوم كلمة "'+w+'".',
    'كلمة "'+w+'" جديدة بالنسبة لي.',
    'صادفت للتو كلمة "'+w+'".',
    'أريد أن أتذكر كلمة "'+w+'".',
    'دوّنت اليوم كلمة "'+w+'".'
  ][nbTemplateIndex(w)],
  fr: w => [
    'J\'ai appris le mot « '+w+' » aujourd\'hui.',
    'Le mot « '+w+' » est nouveau pour moi.',
    'Je viens de découvrir le mot « '+w+' ».',
    'Je veux retenir le mot « '+w+' ».',
    'J\'ai noté le mot « '+w+' » aujourd\'hui.'
  ][nbTemplateIndex(w)],
  es: w => [
    'Hoy aprendí la palabra "'+w+'".',
    'La palabra "'+w+'" es nueva para mí.',
    'Acabo de descubrir la palabra "'+w+'".',
    'Quiero recordar la palabra "'+w+'".',
    'Hoy anoté la palabra "'+w+'".'
  ][nbTemplateIndex(w)],
  ru: w => [
    'Сегодня я выучил слово "'+w+'".',
    'Слово "'+w+'" новое для меня.',
    'Я только что встретил слово "'+w+'".',
    'Хочу запомнить слово "'+w+'".',
    'Сегодня я записал слово "'+w+'".'
  ][nbTemplateIndex(w)]
};
const NB_TEMPLATE_EX_TR = w => [
  'Bugün "'+w+'" kelimesini öğrendim.',
  '"'+w+'" kelimesi benim için yeni.',
  'Az önce "'+w+'" kelimesiyle karşılaştım.',
  '"'+w+'" kelimesini hatırlamak istiyorum.',
  'Bugün "'+w+'" kelimesini not ettim.'
][nbTemplateIndex(w)];
function nbAutoFill(lang, word, currentCat, currentEx, currentExTr){
  let cat = currentCat, ex = currentEx, exTr = currentExTr||'', level = '', filled = false;
  const match = nbFindExactVocabMatch(lang, word);
  if(match){
    if(!cat && match.cat){ cat = match.cat; filled = true; }
    if(!ex && match.ex){ ex = match.ex; filled = true; }
    if(!exTr && match.exTr && ex === match.ex){ exTr = match.exTr; filled = true; }
    if(match.level){ level = match.level; }
  }
  if(!cat){ cat = 'Genel'; filled = true; }
  if(!ex && NB_TEMPLATE_EX[lang]){ ex = NB_TEMPLATE_EX[lang](word); exTr = NB_TEMPLATE_EX_TR(word); filled = true; }
  return { cat, ex, exTr, level, filled };
}

function nbQuickAdd(v){
  try{
    if(!v) return;
    nbSelectedAddLang = v.lang;
    nbEditingId = null;
    nbPrefill = { w: v.w||'', tr: v.tr||'', ex: v.ex||'', cat: v.cat||'', exTr: v.exTr||'', meaningLang:v.meaningLang || (v.lang === 'tr' ? NATIVE_LANG : 'tr') };
    nbRender();
    const wi = document.getElementById('nbInputWord');
    if(wi) wi.scrollIntoView({ behavior:'smooth', block:'center' });
  }catch(e){ console.error('nbQuickAdd hata:', e); }
}

function nbRender(){
  const host = document.getElementById('notebookView');
  if(!host) return;
  if(window.PM_injectStyles) window.PM_injectStyles();

  const uid = window.LB_getUid ? window.LB_getUid() : null;
  if(!uid){
    host.innerHTML = '<div class="nb-wrap"><div class="nb-empty">'+t('nb_login_required')+'</div></div>';
    return;
  }

  const list = nbCombinedList();

  if(nbStudyPicking === 'lang'){
    const langs = nbLangsPresent(list);
    let html = '<div class="nb-wrap"><div class="pm-root"><div class="pm-card">';
    html += '<h4>'+t('nb_study_lang_title')+'</h4>';
    html += '<div class="pm-sub" style="margin-bottom:12px;">'+t('nb_study_lang_sub')+'</div>';
    html += '<div class="lang-box">';
    langs.forEach(code => {
      const L = LANGS[code] || { label: code };
      const count = list.filter(it => (it.lang||'de') === code).length;
      html += '<div class="lang-opt" data-lang="'+code+'" data-nb-study-lang="'+code+'"><span class="landmark" aria-hidden="true">'+(LANG_LANDMARK[code]||'')+'</span><div class="flag">'+(LANG_FLAGS[code]||'🌐')+'</div><div class="lname">'+nbEsc(nbLangLabel(code))+'</div><div class="lname" style="opacity:.65;font-weight:600;">'+t('nb_word_count')(count)+'</div></div>';
    });
    html += '</div>';
    html += '<button type="button" class="pm-btn small" id="nbStudyCancel" style="width:100%;margin-top:14px;">'+t('nb_cancel')+'</button>';
    html += '</div></div></div>';
    host.innerHTML = html;
    host.querySelectorAll('[data-nb-study-lang]').forEach(el => {
      el.onclick = () => { nbStudyLang = el.getAttribute('data-nb-study-lang'); nbStudyPicking = 'level'; nbRender(); };
    });
    const cancelStudy = document.getElementById('nbStudyCancel');
    if(cancelStudy) cancelStudy.onclick = () => { nbStudyPicking = false; nbRender(); };
    return;
  }

  if(nbStudyPicking === 'level'){
    const langWords = list.filter(it => (it.lang||'de') === nbStudyLang);
    const levelsPresent = Array.from(new Set(langWords.map(it => it.level).filter(Boolean)));
    const LEVEL_ORDER = ['A1','A2','B1','B2'];
    levelsPresent.sort((a,b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));
    let html = '<div class="nb-wrap"><div class="pm-root"><div class="pm-card">';
    html += '<h4>'+t('nb_study_level_title')+'</h4>';
    html += '<div class="pm-sub" style="margin-bottom:12px;">'+t('nb_study_level_sub')((LANG_FLAGS[nbStudyLang]||'')+' '+nbEsc(nbLangLabel(nbStudyLang)))+'</div>';
    html += '<div class="lang-box">';
    html += '<div class="lang-opt" data-nb-study-level=""><div class="lname" style="font-size:15px;">'+t('nb_all_caps')+'</div><div class="lname" style="opacity:.65;font-weight:600;">'+t('nb_word_count')(langWords.length)+'</div></div>';
    levelsPresent.forEach(lv => {
      const count = langWords.filter(it => it.level === lv).length;
      html += '<div class="lang-opt" data-nb-study-level="'+lv+'"><div class="lname" style="font-size:15px;">'+lv+'</div><div class="lname" style="opacity:.65;font-weight:600;">'+t('nb_word_count')(count)+'</div></div>';
    });
    html += '</div>';
    html += '<button type="button" class="pm-btn small" id="nbStudyBack" style="width:100%;margin-top:14px;">'+t('nb_back_change_lang')+'</button>';
    html += '</div></div></div>';
    host.innerHTML = html;
    host.querySelectorAll('[data-nb-study-level]').forEach(el => {
      el.onclick = () => nbStartStudy(nbStudyLang, el.getAttribute('data-nb-study-level') || null);
    });
    const backL = document.getElementById('nbStudyBack');
    if(backL) backL.onclick = () => { nbStudyPicking = 'lang'; nbRender(); };
    return;
  }

  if(nbQuizPicking === 'lang'){
    const langs = nbLangsPresent(list);
    let html = '<div class="nb-wrap"><div class="pm-root"><div class="pm-card">';
    html += '<h4>'+t('nb_quiz_lang_title')+'</h4>';
    html += '<div class="pm-sub" style="margin-bottom:12px;">'+t('nb_quiz_lang_sub')+'</div>';
    html += '<div class="lang-box">';
    langs.forEach(code => {
      const L = LANGS[code] || { label: code };
      const count = list.filter(it => (it.lang||'de') === code).length;
      html += '<div class="lang-opt" data-lang="'+code+'" data-nb-quiz-lang="'+code+'"><span class="landmark" aria-hidden="true">'+(LANG_LANDMARK[code]||'')+'</span><div class="flag">'+(LANG_FLAGS[code]||'🌐')+'</div><div class="lname">'+nbEsc(nbLangLabel(code))+'</div><div class="lname" style="opacity:.65;font-weight:600;">'+t('nb_word_count')(count)+'</div></div>';
    });
    html += '</div>';
    html += '<button type="button" class="pm-btn small" id="nbQuizCancel" style="width:100%;margin-top:14px;">'+t('nb_cancel')+'</button>';
    html += '</div></div></div>';
    host.innerHTML = html;
    host.querySelectorAll('[data-nb-quiz-lang]').forEach(el => {
      el.onclick = () => { nbQuizLang = el.getAttribute('data-nb-quiz-lang'); nbQuizPicking = 'diff'; nbRender(); };
    });
    const c1 = document.getElementById('nbQuizCancel');
    if(c1) c1.onclick = () => { nbQuizPicking = null; nbRender(); };
    return;
  }

  if(nbQuizPicking === 'diff'){
    const langWords = list.filter(it => (it.lang||'de') === nbQuizLang);
    const counts = { kolay:0, orta:0, zor:0 };
    langWords.forEach(it => { counts[it.difficulty||'orta']++; });
    let html = '<div class="nb-wrap"><div class="pm-root"><div class="pm-card">';
    html += '<h4>'+t('nb_quiz_diff_title')+'</h4>';
    html += '<div class="pm-sub" style="margin-bottom:12px;">'+t('nb_quiz_diff_sub')((LANG_FLAGS[nbQuizLang]||'')+' '+nbEsc(nbLangLabel(nbQuizLang)))+'</div>';
    html += '<div class="nb-diff-row" style="margin-bottom:14px;">';
    [['kolay','🙂',t('nb_diff_easy'),counts.kolay],['orta','😐',t('nb_diff_medium'),counts.orta],['zor','☹️',t('nb_diff_hard'),counts.zor]].forEach(d => {
      const disabled = d[3] === 0;
      html += '<div class="nb-diff-opt'+(disabled?'':' ')+'" data-nb-quiz-diff="'+d[0]+'" style="'+(disabled?'opacity:.4;pointer-events:none;':'cursor:pointer;')+'"><span class="nb-diff-emoji">'+d[1]+'</span><div class="nb-diff-text"><div class="nb-diff-name">'+d[2]+'</div><div class="nb-diff-sub">'+t('nb_word_count')(d[3])+'</div></div></div>';
    });
    html += '</div>';
    html += '<button type="button" class="pm-btn primary" data-nb-quiz-diff="" style="width:100%;margin-bottom:8px;">'+t('nb_quiz_all_diff')(langWords.length)+'</button>';
    html += '<button type="button" class="pm-btn small" id="nbQuizBack" style="width:100%;">'+t('nb_back_change_lang')+'</button>';
    html += '</div></div></div>';
    host.innerHTML = html;
    host.querySelectorAll('[data-nb-quiz-diff]').forEach(el => {
      el.onclick = () => nbStartQuiz(nbQuizLang, el.getAttribute('data-nb-quiz-diff') || null);
    });
    const back = document.getElementById('nbQuizBack');
    if(back) back.onclick = () => { nbQuizPicking = 'lang'; nbRender(); };
    return;
  }

  const editing = nbEditingId != null ? list.find(w => w.id === nbEditingId) : null;
  if(editing && nbSelectedAddLang == null) nbSelectedAddLang = editing.lang;
  const formSrc = editing || nbPrefill || null;

  let html = '<div class="nb-wrap">';
  html += '<p class="nb-intro">'+t('nb_intro')+'</p>';

  html += '<div class="pm-root">';
  html += '<div class="pm-card" style="position:relative;">';
  html += '<h4>'+(editing ? t('nb_edit_title') : t('nb_add_title'))+'</h4>';

  html += '<div class="pm-sub" style="margin-bottom:8px;">'+t('nb_step1_lang')+'</div>';
  html += '<div class="lang-box">';
  (editing ? [...new Set([...learningLanguageCodes(), editing.lang])] : learningLanguageCodes()).forEach(code => {
    const L = LANGS[code] || { label:nbLangLabel(code) };
    const active = nbSelectedAddLang === code;
    html += '<div class="lang-opt'+(active?' active':'')+'" data-lang="'+code+'" data-nb-add-lang="'+code+'"><span class="landmark" aria-hidden="true">'+(LANG_LANDMARK[code]||'')+'</span><div class="flag">'+(LANG_FLAGS[code]||'🌐')+'</div><div class="lname">'+nbEsc(nbLangLabel(code))+'</div></div>';
  });
  html += '</div>';
  html += '<div class="nb-lang-required" id="nbLangWarn"></div>';

  if(!editing){
    html += '<div class="pm-sub" style="margin:14px 0 8px;">'+t('nb_step2_search')+'</div>';
    html += '<input type="text" class="pm-fill-input" id="nbSearchInput" placeholder="'+t('nb_search_placeholder')+'" autocomplete="off" autocapitalize="off" spellcheck="false">';
    html += '<div id="nbSearchResults" class="nb-search-results"></div>';
    html += '<div class="pm-sub" style="margin:14px 0 8px;">'+t('nb_step3_info')+'</div>';
  }

  html += '<input type="text" class="pm-fill-input" id="nbInputWord" placeholder="'+t('nb_word_placeholder')+'" maxlength="60" style="margin-top:'+(editing?'14px':'0')+';margin-bottom:10px;" value="'+nbEsc(formSrc?formSrc.w:'')+'">';
  html += '<input type="text" class="pm-fill-input" id="nbInputTr" placeholder="'+nbEsc(nbSelectedAddLang === 'tr' ? nbLangLabel(NATIVE_LANG) : t('nb_meaning_placeholder'))+'" maxlength="60" style="margin-bottom:10px;" value="'+nbEsc(formSrc?formSrc.tr:'')+'">';
  html += '<input type="text" class="pm-fill-input" id="nbInputCat" placeholder="'+t('nb_cat_placeholder')+'" maxlength="30" style="margin-bottom:10px;" value="'+nbEsc(formSrc?formSrc.cat:'')+'">';
  html += '<textarea class="pm-fill-input" id="nbInputEx" placeholder="'+t('nb_example_placeholder')+'" style="margin-bottom:14px;min-height:46px;resize:vertical;font-family:inherit;font-size:14px;">'+nbEsc(formSrc?formSrc.ex:'')+'</textarea>';
  html += '<div style="display:flex;gap:10px;">';
  if(editing){
    html += '<button type="button" class="pm-btn small" id="nbCancelEdit" style="flex:1;">'+t('nb_cancel')+'</button>';
    html += '<button type="button" class="pm-btn primary" id="nbSaveWord" style="flex:1;">'+t('nb_save')+'</button>';
  }else{
    html += '<button type="button" class="pm-btn primary" id="nbSaveWord" style="width:100%;">'+t('nb_add_to_notebook')+'</button>';
  }
  html += '</div></div></div>';

  html += '<button type="button" class="nb-start" id="nbStartStudy" '+(list.length===0?'disabled':'')+'>'+t('nb_start_study')(list.length)+'</button>';
  html += '<button type="button" class="nb-start-secondary" id="nbQuizOl" '+(list.length===0?'disabled style="opacity:.4;"':'')+'>'+t('nb_quiz_ol')+'</button>';

  const filterLangs = nbLangsPresent(list);
  const filterCats = Array.from(new Set(list.map(it => it.cat).filter(Boolean))).sort();
  let filtered = list;
  if(nbFilterLang) filtered = filtered.filter(it => (it.lang||'de') === nbFilterLang);
  if(nbFilterCat) filtered = filtered.filter(it => (it.cat||'') === nbFilterCat);
  if(nbFilterDiff) filtered = filtered.filter(it => (it.difficulty||'orta') === nbFilterDiff);
  if(nbFilterText.trim()){
    const q = nbFilterText.trim().toLowerCase();
    filtered = filtered.filter(it => (it.w||'').toLowerCase().includes(q) || (it.tr||'').toLowerCase().includes(q));
  }

  html += '<div class="nb-filter-bar">';
  html += '<div class="nb-filter-search-wrap"><span class="nb-filter-search-icon">🔍</span><input type="text" class="nb-filter-search" id="nbFilterInput" placeholder="'+t('nb_search_notebook_placeholder')+'" value="'+nbEsc(nbFilterText)+'"></div>';
  html += '<div class="nb-filter-row">';

  const langOptions = [['',t('nb_all_langs'),'']].concat(filterLangs.map(code => [code, nbEsc(nbLangLabel(code)), LANG_FLAGS[code]||'']));
  html += nbCSelectHtml('nbFilterLang', langOptions, nbFilterLang, t('nb_all_langs'));

  const catOptions = [['',t('nb_all_cats'),'']].concat(filterCats.map(cat => [cat, nbEsc(catName(cat)), '']));
  html += nbCSelectHtml('nbFilterCat', catOptions, nbFilterCat, t('nb_all_cats'));

  const diffOptions = [['',t('nb_all_diffs'),''],['kolay',t('nb_diff_easy'),'🙂'],['orta',t('nb_diff_medium'),'😐'],['zor',t('nb_diff_hard'),'☹️']];
  html += nbCSelectHtml('nbFilterDiff', diffOptions, nbFilterDiff, t('nb_all_diffs'));

  html += '</div></div>';

  html += '<div class="nb-list-title"><span>'+t('nb_list_title')+'</span><span>'+t('nb_list_count')(filtered.length,list.length)+'</span></div>';
  if(list.length === 0){
    html += '<div class="nb-empty">'+t('nb_empty_none')+'</div>';
  }else if(filtered.length === 0){
    html += '<div class="nb-empty">'+t('nb_empty_filtered')+'</div>';
  }else{
    const diffLabel = { kolay:['🙂',t('nb_diff_easy')], orta:['😐',t('nb_diff_medium')], zor:['☹️',t('nb_diff_hard')] };
    filtered.forEach(w => {
      const dl = diffLabel[w.difficulty||'orta'];
      html += '<div class="nb-item">';
      html += '<div class="nb-item-main">';
      html += '<div class="nb-item-w">'+nbEsc(w.w)+'</div>';
      if(w.tr) html += '<div class="nb-item-tr">'+nbEsc(w.tr)+'</div>';
      if(w.ex) html += '<div class="nb-item-ex">'+nbEsc(w.ex)+'</div>';
      html += '<div>';
      html += '<span class="nb-badge nb-badge-'+(w.source==='favorite'?'fav':'manual')+'">'+(w.source==='favorite'?t('nb_badge_favorite'):t('nb_badge_added'))+'</span>';
      html += '<span class="nb-badge nb-badge-lang">'+(LANG_FLAGS[w.lang]||'🌐')+' '+nbEsc(nbLangLabel(w.lang))+'</span>';
      if(w.cat) html += '<span class="nb-badge nb-badge-cat">'+nbEsc(catName(w.cat))+'</span>';
      if(w.level) html += '<span class="nb-badge nb-badge-level">'+nbEsc(w.level)+'</span>';
      html += '</div>';
      html += '<div class="nb-diff-mini">';
      ['kolay','orta','zor'].forEach(d => {
        html += '<div class="nb-diff-mini-btn'+((w.difficulty||'orta')===d?' active':'')+'" data-diff="'+d+'" data-nb-diff-set="'+w.id+'" data-nb-diff-source="'+w.source+'" data-nb-diff-level="'+d+'">'+diffLabel[d][0]+' '+diffLabel[d][1]+'</div>';
      });
      html += '</div>';
      html += '</div>';
      html += '<div class="nb-item-actions">';
      html += '<div class="nb-icon-btn" data-nb-edit="'+w.id+'" title="'+t('nb_edit_tooltip')+'">✏️</div>';
      html += '<div class="nb-icon-btn danger" data-nb-del="'+w.id+'" title="'+t('nb_delete_tooltip')+'">🗑️</div>';
      html += '</div></div>';
    });
  }
  html += '</div>';
  host.innerHTML = html;

  const filterInput = document.getElementById('nbFilterInput');
  if(filterInput) filterInput.oninput = () => {
    nbFilterText = filterInput.value;
    const cursorPos = filterInput.selectionStart;
    nbRender();
    const freshInput = document.getElementById('nbFilterInput');
    if(freshInput){ freshInput.focus(); try{ freshInput.setSelectionRange(cursorPos, cursorPos); }catch(e){} }
  };

  nbCSelectBind('nbFilterLang', val => { nbFilterLang = val; nbRender(); });
  nbCSelectBind('nbFilterCat', val => { nbFilterCat = val; nbRender(); });
  nbCSelectBind('nbFilterDiff', val => { nbFilterDiff = val; nbRender(); });

  host.querySelectorAll('[data-nb-diff-set]').forEach(el => {
    el.onclick = () => nbSetDifficultyDirect(el.getAttribute('data-nb-diff-set'), el.getAttribute('data-nb-diff-source'), el.getAttribute('data-nb-diff-level'));
  });

  const quizBtn = document.getElementById('nbQuizOl');
  if(quizBtn) quizBtn.onclick = () => {
    if(nbCombinedList().length === 0) return;
    nbQuizPicking = 'lang';
    nbRender();
  };

  host.querySelectorAll('[data-nb-add-lang]').forEach(el => {
    el.onclick = () => { nbSelectedAddLang = el.getAttribute('data-nb-add-lang'); nbRender(); };
  });

  const searchInput = document.getElementById('nbSearchInput');
  const searchResults = document.getElementById('nbSearchResults');
  if(searchInput && searchResults){
    let searchSeq = 0;
    const closeResults = () => { searchResults.innerHTML = ''; searchResults.style.display = 'none'; };
    searchInput.oninput = () => {
      const q = searchInput.value.trim();
      const mySeq = ++searchSeq;
      if(q.length < 2){ closeResults(); return; }
      nbEnsureSearchVocabReady(() => {
        if(mySeq !== searchSeq) return; /* kullanıcı yazmaya devam etmiş, eski sonucu atla */
        const matches = nbSearchVocab(q);
        if(!matches.length){
          searchResults.innerHTML = '<div class="nb-search-empty">Hazır listelerde bulunamadı — aşağıdan elle ekleyebilirsin.</div>';
          searchResults.style.display = 'block';
          return;
        }
        searchResults.innerHTML = matches.map((v,i) =>
          '<div class="nb-search-item" data-nb-pick="'+i+'"><span class="nb-search-flag">'+(LANG_FLAGS[v.lang]||'🌐')+'</span><div class="nb-search-text"><b>'+nbEsc(v.w)+'</b>'+(v.tr?(' — '+nbEsc(v.tr)):'')+'</div></div>'
        ).join('');
        searchResults.style.display = 'block';
        /* Not: 'onclick' yerine 'onmousedown' + preventDefault kullanıyoruz.
           Arama kutusu odaklıyken bir öğeye tıklamak önce 'blur' (odak
           kaybı) tetikler; input'un blur'da sonucu gizlemesi click'ten
           ÖNCE gerçekleşebiliyor ve tıklama hiç işlemiyormuş gibi
           görünüyordu. mousedown + preventDefault, blur'un hiç
           tetiklenmesini engelleyip seçimi güvenilir hale getiriyor. */
        searchResults.querySelectorAll('[data-nb-pick]').forEach(el => {
          el.onmousedown = (e) => {
            e.preventDefault();
            const v = matches[parseInt(el.getAttribute('data-nb-pick'), 10)];
            if(!v) return;
            closeResults();
            searchInput.value = '';
            nbQuickAdd(v);
          };
        });
      });
    };
    /* Dışarı tıklanınca sonuç listesini kapat (dokümana bir kez bağlanır) */
    if(!window._nbOutsideCloseBound){
      window._nbOutsideCloseBound = true;
      document.addEventListener('mousedown', (e) => {
        const wrap = document.getElementById('nbSearchResults');
        const input = document.getElementById('nbSearchInput');
        if(!wrap || wrap.style.display === 'none') return;
        if(e.target === input || wrap.contains(e.target)) return;
        wrap.innerHTML = ''; wrap.style.display = 'none';
      });
    }
    searchInput.onfocus = () => { if(searchResults.innerHTML) searchResults.style.display = 'block'; };
  }

  const wordInput = document.getElementById('nbInputWord');
  const trInput = document.getElementById('nbInputTr');
  const exInput = document.getElementById('nbInputEx');
  const catInput = document.getElementById('nbInputCat');
  const langWarn = document.getElementById('nbLangWarn');

  const saveBtn = document.getElementById('nbSaveWord');
  if(saveBtn) saveBtn.onclick = () => {
    const w = (wordInput.value||'').trim();
    const tr = (trInput.value||'').trim();
    let ex = (exInput.value||'').trim();
    let cat = (catInput.value||'').trim();
    let exTr = (nbPrefill && nbPrefill.w === w) ? (nbPrefill.exTr||'') : (editing && editing.w === w ? (editing.exTr||'') : '');
    if(!nbSelectedAddLang){
      if(langWarn) langWarn.textContent = t('nb_select_lang_first');
      return;
    }
    if(!w){ wordInput.focus(); return; }
    const db = window.LB_getDb(); const uid2 = window.LB_getUid();
    if(!db || !uid2) return;
    const reference = (nbPrefill && nbPrefill.w === w) ? nbPrefill : (editing && editing.w === w ? editing : null);
    if(reference && ex && ex !== reference.ex) exTr = '';
    const af = nbAutoFill(nbSelectedAddLang, w, cat, ex, exTr);
    if(af.filled) nbToast(t('nb_autofilled_toast'));
    cat = af.cat; ex = af.ex; exTr = af.exTr;
    const level = af.level || '';
    const meaningLang = (nbPrefill && nbPrefill.w === w && nbPrefill.meaningLang) || (editing && editing.w === w && editing.meaningLang) || (nbSelectedAddLang === 'tr' ? NATIVE_LANG : 'tr');
    if(nbEditingId != null){
      db.ref('progress/'+uid2+'/notebook/'+nbEditingId).update({ w, tr, ex, exTr, cat, level, meaningLang, lang: nbSelectedAddLang });
      nbEditingId = null;
    }else{
      const dupExists = Object.keys(nbWords||{}).some(id => {
        const it = nbWords[id]||{};
        return (it.lang||'de') === nbSelectedAddLang && nbSanitizeKey(it.w) === nbSanitizeKey(w);
      });
      if(dupExists){
        alert(t('nb_duplicate_word'));
        return;
      }
      db.ref('progress/'+uid2+'/notebook').push({ w, tr, ex, exTr, cat, level, meaningLang, lang: nbSelectedAddLang, ts: Date.now() });
    }
    nbSelectedAddLang = null;
    nbPrefill = null;
    nbRender();
  };

  const cancelBtn = document.getElementById('nbCancelEdit');
  if(cancelBtn) cancelBtn.onclick = () => { nbEditingId = null; nbSelectedAddLang = null; nbPrefill = null; nbRender(); };

  host.querySelectorAll('[data-nb-edit]').forEach(el => {
    el.onclick = () => { nbEditingId = el.getAttribute('data-nb-edit'); nbSelectedAddLang = null; nbPrefill = null; nbRender(); };
  });
  host.querySelectorAll('[data-nb-del]').forEach(el => {
    el.onclick = () => {
      const id = el.getAttribute('data-nb-del');
      const db = window.LB_getDb(); const uid2 = window.LB_getUid();
      if(!db || !uid2) return;
      /* Not: burası artık her zaman Kelime Defterinden (notebook) tam
         silme demek — favori olsa bile. Sadece favoriden çıkarmak
         isteyen kişi kartın üzerindeki ⭐'a basar (o, silmeden sadece
         rozeti kaldırır). Bu yüzden burada onay istemiyoruz; işlem geri
         alınamaz bir "favoriden çıkarma" değil, doğrudan bir "sil". */
      let backupWord = nbWords[id];
      delete nbWords[id];
      nbInvalidateFavoriteIndex();
      if(nbEditingId === id) nbEditingId = null;
      nbRender();
      db.ref('progress/'+uid2+'/notebook/'+id).remove().then(() => {
        nbToast(t('nb_deleted_toast'));
      }).catch(err => {
        console.error('Silinemedi:', err);
        if(backupWord) nbWords[id] = backupWord;
        nbInvalidateFavoriteIndex();
        nbRenderIfOpen();
        nbToast(t('nb_delete_failed_toast'), 'bad');
      });
    };
  });

  const startBtn = document.getElementById('nbStartStudy');
  if(startBtn) startBtn.onclick = () => {
    if(nbCombinedList().length === 0) return;
    nbStudyPicking = 'lang';
    nbRender();
  };
}

function nbStartStudy(lang, level){
  let list = nbCombinedList().filter(it => (it.lang||'de') === lang);
  if(level) list = list.filter(it => (it.level||'') === level);
  if(list.length === 0) return;
  deck = list.map((item, i) => {
    const c = (typeof pair === 'function') ? pair(i) : ['#4fe8ff','#ff5fb8'];
    return {
      lang: item.lang || 'de',
      level: t('nb_custom_level_tag'),
      cat: item.cat || 'Notlarım',
      w: item.w,
      tr: item.tr || '',
      pos: item.source === 'favorite' ? (item.pos || t('nb_favorite_tag')) : t('nb_my_notebook_tag'),
      ex: item.ex || '',
      exTr: item.exTr || '',
      c1: c[0], c2: c[1],
      meaningLang:item.meaningLang, _nbPair: true, _nbId: item.id, _nbSource: item.source, difficulty: item.difficulty || 'orta'
    };
  });
  idx = 0; flipped = false;
  activeCat = 'Notlarım';
  nbStudyPicking = false;
  deactivateAllTabs();
  toggleActive('tabNotebook', true);
  try{document.body.classList.add('notebook-active');}catch(e){}
  setDisplay('cardsView', 'block');
  setDisplay('levelBox', 'none');
  setDisplay('chips', 'none');
  setDisplay('langBox', 'none');
  setDisplay('langPair', 'none');
  renderCard();
}

function nbRenderDifficultyBox(){
  const box = document.getElementById('nbDifficultyBox');
  if(!box) return;
  const v = deck[idx];
  const stage = document.querySelector('.stage');
  if(activeCat !== 'Notlarım' || !v || !v._nbId){
    box.style.display = 'none';
    if(stage) stage.classList.remove('stage-merged');
    return;
  }
  box.style.display = '';
  if(stage) stage.classList.add('stage-merged');
  box.querySelectorAll('[data-diff]').forEach(el => {
    el.classList.toggle('active', (v.difficulty||'orta') === el.getAttribute('data-diff'));
  });
}
function nbUpdateFinishButton(){
  const btn = document.getElementById('nbFinishStudyBtn');
  if(!btn) return;
  btn.style.display = (activeCat === 'Notlarım') ? '' : 'none';
}
(function(){
  const btn = document.getElementById('nbFinishStudyBtn');
  if(btn) btn.onclick = () => { const t = document.getElementById('tabNotebook'); if(t) t.click(); };
})();
function nbSetDifficulty(level){
  const v = deck[idx];
  if(!v || !v._nbId) return;
  const db = window.LB_getDb ? window.LB_getDb() : null;
  const uid = window.LB_getUid ? window.LB_getUid() : null;
  if(!db || !uid) return;
  v.difficulty = level;
  if(nbWords[v._nbId]) nbWords[v._nbId].difficulty = level;
  nbRenderDifficultyBox();
  db.ref('progress/'+uid+'/notebook/'+v._nbId).update({ difficulty: level }).catch(err => {
    console.error('Zorluk seviyesi kaydedilemedi:', err);
    nbToast('Zorluk seviyesi kaydedilemedi.', 'bad');
  });
}
(function(){
  const box = document.getElementById('nbDifficultyBox');
  if(box){
    box.querySelectorAll('[data-diff]').forEach(el => {
      el.onclick = () => nbSetDifficulty(el.getAttribute('data-diff'));
    });
  }
})();

/* Kelime Defterim listesinden (çalışma moduna girmeden) zorluk değiştirme */
function nbSetDifficultyDirect(id, source, level){
  const db = window.LB_getDb ? window.LB_getDb() : null;
  const uid = window.LB_getUid ? window.LB_getUid() : null;
  if(!db || !uid) return;
  if(nbWords[id]) nbWords[id].difficulty = level;
  nbRenderIfOpen();
  db.ref('progress/'+uid+'/notebook/'+id).update({ difficulty: level }).catch(err => {
    console.error('Zorluk seviyesi kaydedilemedi:', err);
    nbToast('Zorluk seviyesi kaydedilemedi.', 'bad');
  });
}

/* --------------------------- QUIZ OL (dil + zorluk seçip quiz) --------------------------- */
let nbQuizPicking = null;  /* null | 'lang' | 'diff' */
let nbQuizLang = null;
function nbStartQuiz(lang, difficulty){
  let list = nbCombinedList().filter(it => (it.lang||'de') === lang);
  if(difficulty) list = list.filter(it => (it.difficulty||'orta') === difficulty);
  if(list.length === 0) return;
  deck = list.map((item, i) => {
    const c = (typeof pair === 'function') ? pair(i) : ['#4fe8ff','#ff5fb8'];
    return {
      lang: item.lang || 'de', level:t('nb_custom_level_tag'), cat: item.cat || 'Notlarım',
      w: item.w, tr: item.tr || '',
      pos: item.source === 'favorite' ? (item.pos || t('nb_favorite_tag')) : t('nb_my_notebook_tag'),
      ex: item.ex || '', exTr: item.exTr || '', c1: c[0], c2: c[1],
      meaningLang:item.meaningLang, _nbPair: true, _nbId: item.id, _nbSource: item.source, difficulty: item.difficulty || 'orta'
    };
  });
  activeCat = 'Notlarım';
  nbQuizPicking = null;
  deactivateAllTabs();
  toggleActive('tabNotebook', true);
  try{document.body.classList.add('notebook-active');}catch(e){}
  setDisplay('quizView', 'block');
  setDisplay('levelBox', 'none');
  setDisplay('chips', 'none');
  setDisplay('langBox', 'none');
  setDisplay('langPair', 'none');
  buildQuizDeck();
}

/* --------------------------- FAVORİ YILDIZI (kartlar üzerinde) --------------------------- */
function nbUpdateFavStar(){
  const v = deck[idx];
  const inNotebookStudy = (activeCat === 'Notlarım');
  ['favStarFront','favStarBack'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    if(!v || inNotebookStudy){ el.style.display = 'none'; return; }
    el.style.display = '';
    const key = nbExistingFavId(nbCurrentFavorite() || v);
    const on = !!(nbWords && nbWords[key] && nbWords[key].isFavorite);
    el.textContent = on ? '★' : '☆';
    el.classList.toggle('on', on);
    el.classList.toggle('off', !on);
  });
}
function nbToast(msg, kind){
  try{
    if(window.LUM_toast){ window.LUM_toast(msg, kind ? {kind:kind} : undefined); return; }
  }catch(e){}
  /* pwa.js her nedenle yüklenmemiş olabilir — sessiz kalmak yerine en azından konsola yaz */
  console.log('[Lumira]', msg);
}

/* Favoriler artık Kelime Defterinin (notebook) kalıcı bir parçası —
   favoriden çıkarmak sadece 'isFavorite' bayrağını kaldırır, kelimeyi
   Kelime Defterinden SİLMEZ. Silmek için Kelime Defterim'deki 🗑️ kullanılır. */
function nbCurrentFavorite(){
  const v=deck[idx];
  if(!v || activeCat==='Notlarım') return null;
  return {w:cardFrontWord(v),tr:cardBackWord(v),ex:cardFrontExample(v)||'',exTr:cardBackExample(v)||'',pos:v.pos||'',lang:isReversed()?'tr':v.lang,meaningLang:isReversed()?v.lang:(v.meaningLang || (isCross()?NATIVE_LANG:'tr')),cat:v.cat||'',level:v.level||''};
}
async function nbSetFavorite(word, desired){
  const db=window.LB_getDb?.(),uid=window.LB_getUid?.();
  if(!db || !uid) throw new Error('nb_fav_login_required');
  if(!word || typeof word.w!=='string' || !word.w.trim() || !LANGS[word.lang]) return false;
  const v={...word,tr:word.tr||''};
  nbInitSync();
  let timer;
  try{await Promise.race([nbSyncReady,new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('nb_fav_add_failed')),8000);})]);}
  finally{clearTimeout(timer);}
  if(window.LB_getUid?.()!==uid || nbSyncedUid!==uid) throw new Error('nb_fav_login_required');
  const favId=nbExistingFavId(v),existing=nbWords[favId];
  const on=desired===undefined?!existing?.isFavorite:!!desired;
  if(existing && !!existing.isFavorite===on) return true;
  if(!existing && !on) return true;
  const writeKey=uid+'/'+favId;
  if(nbFavoriteWrites.has(writeKey)) return false;
  nbFavoriteWrites.add(writeKey);
  const payload=existing?{...existing,isFavorite:on}:{w:v.w,tr:v.tr,ex:v.ex||'',exTr:v.exTr||'',pos:v.pos||'',lang:v.lang,meaningLang:v.meaningLang||'tr',cat:v.cat||'',level:v.level||'',difficulty:'orta',isFavorite:on,ts:Date.now()};
  nbWords[favId]=payload;
  nbInvalidateFavoriteIndex();
  nbUpdateFavStar();nbRenderIfOpen();window.dispatchEvent(new Event('lumira:notebookchange'));
  try{
    if(existing) await db.ref('progress/'+uid+'/notebook/'+favId).update({isFavorite:on});
    else await db.ref('progress/'+uid+'/notebook/'+favId).set(payload);
    return true;
  }catch(error){
    if(nbSyncedUid===uid){
      if(existing) nbWords[favId]=existing;else delete nbWords[favId];
      nbInvalidateFavoriteIndex();
      nbUpdateFavStar();nbRenderIfOpen();window.dispatchEvent(new Event('lumira:notebookchange'));
    }
    throw new Error(on?'nb_fav_add_failed':'nb_fav_remove_failed');
  }finally{nbFavoriteWrites.delete(writeKey);}
}
async function nbToggleFavorite(silent){
  const v=nbCurrentFavorite();if(!v) return false;
  const wasFavorite=!!nbWords[nbExistingFavId(v)]?.isFavorite;
  try{
    const saved=await nbSetFavorite(v);
    if(saved && !silent) nbToast(t(wasFavorite?'nb_fav_removed':'nb_fav_added'));
    return saved;
  }catch(error){if(!silent)nbToast(t(error.message==='nb_fav_login_required'?error.message:(wasFavorite?'nb_fav_remove_failed':'nb_fav_add_failed')),'bad');return false;}
}
['favStarFront','favStarBack'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.onclick=e=>{e.stopPropagation();nbToggleFavorite();};
});
/* Kart, arama sonucu ve Ayarlar > Favorilerim aynı hesap kaydını kullanır.
   Favoriden çıkarmak kelimeyi Notlarım'dan silmez. */
window.NB_currentFavorite=nbCurrentFavorite;
window.NB_saveFavorite=word=>nbSetFavorite(word,true);
window.NB_removeFavorite=word=>nbSetFavorite(word,false);
window.NB_getFavorites=function(){
  if(!nbSyncedUid || window.LB_getUid?.()!==nbSyncedUid) return [];
  nbEnsureFavoriteIndex();return nbFavoriteList;
};
window.NB_isFavorite=function(word){nbEnsureFavoriteIndex();const id=nbFavoriteIndex.get(nbFavoriteIdentity(word));return !!(id&&nbWords[id]?.isFavorite);};
window.NB_toggleFavoriteFromCard=()=>nbToggleFavorite(true);
window.NB_unfavoriteByWord=function(lang,w){
  const item=Object.values(nbWords).find(it=>it.lang===lang && it.w===w);
  return item?nbSetFavorite(item,false):Promise.resolve(true);
};
window.addEventListener('lumira:featureauthchange',()=>setTimeout(nbInitSync,0));

/* ======================= INIT =======================
   TARGET_LANG 'de' değilse (ör. onboarding'de İngilizce/Fransızca vb.
   seçilmişse veya CROSS moddaysa) gereken sözlük(ler) henüz senkron
   yüklenmemiş olabilir — bu yüzden ilk render, gerekli dosyalar
   yüklenene KADAR bekliyor. Türkçe-ana-dilli mevcut kullanıcılar için
   (activeLang zaten 'de' önceden yüklü) bu bekleme anlık/gözle
   görülmez şekilde geçer; davranış değişmez. */
/* ======================= INIT =======================
   TARGET_LANG 'de' değilse (ör. onboarding'de İngilizce/Fransızca vb.
   seçilmişse veya CROSS moddaysa) gereken sözlük(ler) henüz senkron
   yüklenmemiş olabilir — bu yüzden ilk render, gerekli dosyalar
   yüklenene KADAR bekliyor. Türkçe-ana-dilli mevcut kullanıcılar için
   (activeLang zaten 'de' önceden yüklü) bu bekleme anlık/gözle
   görülmez şekilde geçer; davranış değişmez. */
setLangPair(NATIVE_LANG, TARGET_LANG).then(function(){
  renderLangPair();
  rebuildLevelBox();
  rebuildChips();
  applyFilter();
});

/* ======================= SNOW / CRYSTAL EFFECT ======================= */
(function(){
  /* Hafif mod açıksa kar efekti hiç çalıştırılmaz. Bu betik pwa.js'ten önce
     çalıştığı için tercih doğrudan depodan okunuyor. */
  /* Hafif mod SADECE kullanıcı açtıysa true olur. Depoda değer yoksa ya da
     'false' ise kar normal şekilde yağar. */
  /* Hafif mod yalnızca kullanıcı ayarlardan açtığında etkin. Bu betik
     pwa.js'ten önce çalıştığı için tercih doğrudan depodan okunuyor. */
  let liteOn = false;
  try{
    var raw = localStorage.getItem('pwa_lite');
    liteOn = (raw === 'true');   /* yalnızca kullanıcı açtıysa */
    if(liteOn) document.documentElement.classList.add('lite');
  }catch(e){ liteOn = false; }

  const canvas = document.getElementById('snowCanvas');
  if(liteOn){ canvas.style.display = 'none'; }
  const ctx = canvas.getContext('2d');
  let w, h, flakes, running = !liteOn, windPhase = 0;

  function resize(){ w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();

  /* --- Kar taneleri: her kare yeniden ÇİZİLMİYOR, bir kez resme dönüştürülüp
     sonra sadece kopyalanıyor.
     Eskiden her tane için 6 kol × 3 çizgi = kare başına ~1100 stroke() çağrısı
     yapılıyordu; açılış ekranındaki donmanın sebebi buydu. Şimdi tane başına
     tek bir drawImage var. Görüntü birebir aynı. */
  function makeSprite(r, hue){
    const pad = 3;
    const size = Math.ceil(r * 2 + pad * 2);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    x.translate(size / 2, size / 2);
    x.strokeStyle = `rgba(${hue},1)`;
    x.fillStyle = `rgba(${hue},1)`;
    x.lineWidth = Math.max(0.6, r * 0.09);
    x.lineCap = 'round';
    for(let i = 0; i < 6; i++){
      x.save();
      x.rotate((Math.PI / 3) * i);
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(0, r);
      x.stroke();
      x.beginPath();
      x.moveTo(0, r * 0.45);
      x.lineTo(r * 0.22, r * 0.62);
      x.moveTo(0, r * 0.45);
      x.lineTo(-r * 0.22, r * 0.62);
      x.stroke();
      x.beginPath();
      x.moveTo(0, r * 0.75);
      x.lineTo(r * 0.16, r * 0.88);
      x.moveTo(0, r * 0.75);
      x.lineTo(-r * 0.16, r * 0.88);
      x.stroke();
      x.restore();
    }
    x.beginPath();
    x.arc(0, 0, r * 0.14, 0, Math.PI * 2);
    x.fill();
    return c;
  }

  /* Aynı yarıçapı defalarca çizmemek için küçük bir önbellek */
  const spriteCache = {};
  function spriteFor(r, hue){
    const key = Math.round(r) + '|' + hue;
    if(!spriteCache[key]) spriteCache[key] = makeSprite(Math.round(r), hue);
    return spriteCache[key];
  }

  function flakeCount(){
    if(document.documentElement.classList.contains('lite')) return 0;
    const small = Math.min(window.innerWidth, window.innerHeight) < 430;
    return small ? 34 : 56;
  }

  function makeFlakes(n){
    return Array.from({length:n}, () => {
      const r = Math.random()*9 + 4;
      const hue = Math.random() < 0.5 ? "190,235,255" : "210,220,255";
      return {
        x: Math.random()*w,
        y: Math.random()*h,
        r, hue,
        sprite: spriteFor(r, hue),
        speedY: Math.random()*1.6 + 0.7,
        speedX: Math.random()*1.0 - 0.5,
        rot: Math.random()*Math.PI*2,
        rotSpeed: (Math.random()*0.05 - 0.025),
        drift: Math.random()*Math.PI*2,
        driftSpeed: Math.random()*0.03 + 0.015,
        opacity: Math.random()*0.5 + 0.55
      };
    });
  }

  flakes = liteOn ? [] : makeFlakes(flakeCount());

  /* Ayarlardan hafif mod açılırsa kar anında dursun */
  window.__snowStop = function(){ running = false; try{ ctx.clearRect(0,0,w,h); canvas.style.display='none'; }catch(e){} };

  /* Hareket ZAMANA bağlı hesaplanıyor.
     Önceden sabit bir kare hızı varsayılıyor ve 30 fps sınırı konuyordu;
     120 Hz ekranlarda (iPhone Pro modelleri) bu sınır ekranın ritmine
     oturmadığı için kar tanelerinin hızı dalgalanıyor, animasyon "gidip
     geliyor" gibi görünüyordu. Artık iki kare arasındaki gerçek süre
     ölçülüyor: hangi ekranda olursa olsun aynı hızda ve akıcı. */
  let prevTime = 0;

  /* Açılış ekranı da kaydırılabiliyor; kar taneleri kaydırma sırasında
     aynı sıçramayı yapıyordu. Parmak ekrandayken çizim duruyor. */
  let scrollingNow = false, scrollT = 0;
  function markScroll(){
    if(!scrollingNow){
      scrollingNow = true;
      document.documentElement.classList.add('scrolling');
    }
    clearTimeout(scrollT);
    scrollT = setTimeout(()=>{
      scrollingNow = false;
      document.documentElement.classList.remove('scrolling');
      prevTime = 0;                 /* zaman farkı sıçramasın */
    }, 140);
  }
  window.addEventListener('scroll', markScroll, { passive:true });
  window.addEventListener('touchmove', markScroll, { passive:true });

  function tick(now){
    if(!running) return;
    requestAnimationFrame(tick);
    if(scrollingNow) return;

    if(!prevTime) prevTime = now;
    /* saniye cinsinden fark; sekme arka plandan dönerse sıçramasın diye sınırlı */
    let dt = Math.min((now - prevTime) / 1000, 0.05);
    prevTime = now;
    const k = dt * 60;                   /* 60 fps'e göre ölçek */

    ctx.clearRect(0,0,w,h);
    windPhase += 0.012 * k;
    const gust = Math.sin(windPhase) * 0.6;

    for(let i = 0; i < flakes.length; i++){
      const f = flakes[i];
      f.drift += f.driftSpeed * k;
      f.rot += f.rotSpeed * k;
      f.y += f.speedY * k;
      f.x += (f.speedX + gust + Math.sin(f.drift)*0.6) * k;
      if(f.y > h + 12){ f.y = -12; f.x = Math.random()*w; }
      if(f.x > w + 12) f.x = -12;
      if(f.x < -12) f.x = w + 12;

      const s = f.sprite;
      ctx.globalAlpha = f.opacity;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.drawImage(s, -s.width/2, -s.height/2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  if(!liteOn) requestAnimationFrame(tick);

  const splash = document.getElementById('splash');
  const mainApp = document.getElementById('mainApp');
  splash.addEventListener('click', () => {
    splash.classList.add('hidden');
    mainApp.classList.add('revealed');
    setTimeout(()=>{ running = false; }, 900);
    if(window.LB_checkName){
      setTimeout(window.LB_checkName, 500);
    }
    if(typeof warmUpSpeech === 'function') warmUpSpeech();
    startSessionTimer();
  }, { once:true });
})();
