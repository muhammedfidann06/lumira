/* ============================================================================
   pwa.js — Lumira | Dil Kartları  ·  Uygulama katmanı
   ----------------------------------------------------------------------------
   Mevcut uygulama koduna DOKUNMAZ. Sadece dışarıdan bağlanır:

     1  Service Worker kaydı + otomatik güncelleme kontrolü
     2  Tam ekran / edge-to-edge + durum çubuğu rengi (Android 16/17 uyumlu)
     3  Android geri tuşu (predictive back dahil) ve "çıkmak için tekrar bas"
     4  Deep link · uygulama kısayolları · paylaşım menüsünden gelen metin
     5  Kurulum afişi (Android) + iOS "Ana Ekrana Ekle" rehberi
     6  Bildirimler: günlük hatırlatma + push (FCM uyumlu)
     7  Çevrimdışı paket indirme (tüm sözlükler)
     8  Favoriler ⭐ ve kullanım istatistikleri
     9  Dışa aktarma: dosya indirme + Web Share ile paylaşma
    10  Hata kaydı / çökme raporu
    11  Puanlama isteği (Play Store)
    12  Yumuşak sayfa geçişleri + kaldığı yerden devam

   Global API:  window.PWA  (toast, share, saveFile, notify, openSettings ...)
   ========================================================================== */
(function () {
'use strict';
var APP_VERSION='1.11.1';


/* ========================================================== AYARLAR ====== */
var CONFIG = {
  appName:      'Dil Kartları',
  brand:        'Lumira',
  packageId:    'com.lumira.dilkartlari',   /* Bubblewrap ile aynı olmalı */
  playUrl:      'https://play.google.com/store/apps/details?id=com.lumira.dilkartlari',
  vapidKey:     '',                          /* FCM/WebPush açık anahtarı (ops.) */
  pushEndpoint: '',                          /* abonelik gönderilecek sunucu (ops.) */
  errorEndpoint:'',                          /* hata raporu sunucusu (ops.) */
  reminderHour: 20,                          /* varsayılan hatırlatma saati */
  reminderMin:  0
};
window.PWA_CONFIG = CONFIG;

/* ============================================================ YARDIM ===== */
var $  = function (id) { return document.getElementById(id); };
var qs = function (s, r) { return (r || document).querySelector(s); };

function store(key, val) {
  try {
    if (val === undefined) {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
    localStorage.setItem(key, JSON.stringify(val));
    return val;
  } catch (e) { return null; }
}
function today() {
  var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
/* Ana script'teki top-level let/const değişkenlerine güvenli erişim */
function G(name) {
  try { return new Function('try{return typeof ' + name + '!=="undefined"?' + name + ':null}catch(e){return null}')(); }
  catch (e) { return null; }
}
/* ...ve onlara güvenli yazma (idx gibi) */
function setG(name, val) {
  try { new Function('v', 'try{' + name + '=v}catch(e){}')(val); return true; }
  catch (e) { return false; }
}
function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

/* -------------------------------------------------------------- TOAST --- */
function toastHost() {
  var h = $('pwa-toasts');
  if (!h) { h = document.createElement('div'); h.id = 'pwa-toasts'; document.body.appendChild(h); }
  return h;
}
function toast(msg, opts) {
  opts = opts || {};
  var el = document.createElement('div');
  el.className = 'pwa-toast' + (opts.kind ? ' ' + opts.kind : '');
  el.innerHTML = '<span>' + msg + '</span>';
  if (opts.action) {
    var b = document.createElement('button');
    b.className = 't-act';
    b.textContent = opts.action;
    b.onclick = function () { try { opts.onAction && opts.onAction(); } catch (e) {} close(); };
    el.appendChild(b);
  }
  toastHost().appendChild(el);
  requestAnimationFrame(function () { el.classList.add('in'); });
  var timer = setTimeout(close, opts.duration || (opts.action ? 9000 : 3200));
  function close() {
    clearTimeout(timer);
    el.classList.remove('in');
    setTimeout(function () { el.remove(); }, 340);
  }
  return close;
}
/* Notlarım/favoriler gibi index.html'in kendi inline script'i de aynı
   toast sistemini kullanabilsin diye dışarı açıyoruz. */
window.LUM_toast = toast;

/* ------------------------------------------------------- ALT SAYFA ------ */
var openSheets = [];
function sheet(title, subtitle, buildBody) {
  /* Aynı panel zaten açıksa ikinci dokunuş onu KAPATIR — üst üste kopya
     açılmasını engeller (ayar düğmesindeki davranışın aynısı). */
  for (var i = openSheets.length - 1; i >= 0; i--) {
    if (openSheets[i].title === title) { openSheets[i].close(); return null; }
  }

  var back = document.createElement('div');
  back.className = 'pwa-sheet-backdrop';
  var box = document.createElement('div');
  box.className = 'pwa-sheet';
  box.setAttribute('role', 'dialog');
  box.innerHTML = '<div class="grab"></div>' +
                  '<button type="button" class="pwa-sheet-x" aria-label="Kapat">✕</button>' +
                  '<h3>' + title + '</h3>' +
                  (subtitle ? '<p class="sheet-sub">' + subtitle + '</p>' : '');
  var body = document.createElement('div');
  box.appendChild(body);
  document.body.appendChild(back);
  document.body.appendChild(box);

  requestAnimationFrame(function () { back.classList.add('in'); box.classList.add('in'); });
  back.onclick = function () { api.close(); };

  /* aşağı sürükleyerek kapatma */
  var y0 = null;
  box.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
  box.addEventListener('touchmove', function (e) {
    if (y0 === null || box.scrollTop > 0) return;
    var dy = e.touches[0].clientY - y0;
    if (dy > 0) box.style.transform = 'translateY(' + dy + 'px)';
  }, { passive: true });
  box.addEventListener('touchend', function (e) {
    var dy = e.changedTouches[0].clientY - (y0 || 0);
    box.style.transform = '';
    y0 = null;
    if (dy > 110) api.close();
  });

  var api = {
    body: body,
    close: function () {
      var i = openSheets.indexOf(api);
      if (i > -1) openSheets.splice(i, 1);
      if (settingsOpen === api) settingsOpen = null;
      back.classList.remove('in'); box.classList.remove('in');
      setTimeout(function () { back.remove(); box.remove(); }, 380);
    }
  };
  openSheets.push(api);
  var xBtn = qs('.pwa-sheet-x', box);
  if (xBtn) xBtn.onclick = function (e) { e.stopPropagation(); api.close(); };
  api.title = title;
  pushGuard();
  /* İçerik, api hazır olduktan SONRA kuruluyor: aksi hâlde geri çağrıya
     gönderilen api tanımsız oluyordu (var hoisting). */
  try { buildBody(body, api); } catch (e) { logError(e); }
  return api;
}
function row(icon, title, desc, right) {
  var d = document.createElement('div');
  d.className = 'pwa-row';
  d.innerHTML = '<div class="ic">' + icon + '</div><div class="tx"><b>' + title + '</b>' +
                (desc ? '<span>' + desc + '</span>' : '') + '</div>';
  if (right) d.insertAdjacentHTML('beforeend', right);
  return d;
}

/* ============================================== 1 · SERVICE WORKER ======= */
var swReg = null, waitingWorker = null;

function registerSW() {
  startUpdatePolling();
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then(function (reg) {
      swReg = reg;

      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);

      reg.addEventListener('updatefound', function () {watchInstallingWorker(reg.installing);});

      watchInstallingWorker(reg.installing);
      registerPeriodicSync(reg);
    })
    .catch(function (err) {
      /* Bazı tarayıcılar (ör. iOS'ta Chrome) Service Worker'ı desteklemez.
         Uygulama bu durumda da tam çalışır; yalnızca çevrimdışı kullanım ve
         bildirimler devre dışı kalır. Hata raporuna yazmıyoruz. */
      console.warn('[PWA] Service Worker kullanılamıyor:', err && err.message);
    });

  var refreshing=false;
  navigator.serviceWorker.addEventListener('controllerchange',function(){
    if(refreshing)return;
    swVersion(function(version){
      if(version && cleanVersion(version)===APP_VERSION)return;
      var key='lumira_sw_applied_'+new URL('./',location.href).pathname;
      try{if(version && sessionStorage.getItem(key)===version)return;if(version)sessionStorage.setItem(key,version);}catch(e){}
      refreshing=true;reloadLatest(version);
    });
  });

  navigator.serviceWorker.addEventListener('message', function (ev) {
    var d = ev.data || {};
    if (d.type === 'CACHE_PROGRESS') onCacheProgress(d.done, d.total);
    if (d.type === 'CACHE_DONE')     onCacheDone();
    if (d.type === 'CACHE_FAILED') toast(window.t ? window.t('download_failed') : 'İndirme tamamlanamadı', {kind:'bad'});
    if (d.type === 'NOTIFICATION_OPEN') route(new URL(d.url, location.href).searchParams, true);
    if (d.type === 'BACK_ONLINE')    refreshOnlineState();
  });
}

var watchedWorkers=new WeakSet();
function watchInstallingWorker(worker){
 if(!worker || watchedWorkers.has(worker))return;watchedWorkers.add(worker);
 function changed(){if(worker.state==='installed' && navigator.serviceWorker.controller)offerUpdate(worker);}
 worker.addEventListener('statechange',changed);changed();
}
function offerUpdate(worker){
 if(worker)waitingWorker=worker;
 toast(window.t?window.t('set_update_new_toast'):'✨ Yeni sürüm hazır',{
  action:window.t?window.t('set_update_install_now'):'Şimdi yükle',duration:14000,onAction:function(){hardRefresh(false);}
 });
}
var updatePollStarted=false,lastUpdateCheck=0;
function startUpdatePolling(){
 if(updatePollStarted)return;updatePollStarted=true;
 function poll(){if(document.hidden || !navigator.onLine || Date.now()-lastUpdateCheck<60000)return;lastUpdateCheck=Date.now();checkForUpdate(function(state){if(state==='new')offerUpdate(swReg&&swReg.waiting);});}
 setTimeout(poll,8000);setInterval(poll,15*60*1000);document.addEventListener('visibilitychange',poll);
}

/* ================================ 2 · TAM EKRAN / DURUM ÇUBUĞU =========== */
var isStandalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) ||
                   (window.matchMedia && matchMedia('(display-mode: fullscreen)').matches) ||
                   navigator.standalone === true ||
                   /android-app:\/\//.test(document.referrer);

/* Play Store (TWA) üzerinden mi açıldı? Üç bağımsız sinyal kontrol edilir,
   biri bile true ise TWA sayılır — hiçbiri tek başına %100 güvenilir değil:
   1) 'android-app://' referrer — bazı Android/Chrome sürümlerinde (özellikle
      uygulama simgesinden soğuk başlatmada) hiç set edilmiyor, bilinen sorun.
   2) '?src=twa' — twa-manifest.json'daki startUrl'e bağlı, PWABuilder formunda
      doğru girilmemişse eksik kalabilir.
   3) getDigitalGoodsService — EN GÜVENİLİR sinyal: bu API sadece gerçek,
      Play Billing'e bağlı bir TWA içinde var olur, sıradan tarayıcı
      sekmelerinde asla bulunmaz. */
var isTwa = /android-app:\/\//.test(document.referrer) ||
            /(^|[?&])src=twa(&|$)/.test(location.search) ||
            (typeof window.getDigitalGoodsService === 'function') ||
            store('pwa_src_twa') === true;
if (/(^|[?&])src=twa(&|$)/.test(location.search)) { try { store('pwa_src_twa', true); } catch (e) {} }

function setupShell() {
  document.documentElement.classList.toggle('pwa-standalone', isStandalone);

  /* Durum çubuğu / gezinme çubuğu rengi — splash koyu, uygulama koyu */
  setThemeColor('#04050a');

  /* Yakınlaştırma artık viewport meta etiketiyle kilitli.
     gesturestart engellenmiyor: engellendiğinde, sayfa bir şekilde büyüdüğünde
     kullanıcı parmakla GERİ KÜÇÜLTEMİYORDU. */

  /* Standalone modda dış bağlantılar tarayıcıda açılsın (uygulamadan çıkmasın) */
  if (isStandalone) {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="http"]') : null;
      if (!a) return;
      if (a.host === location.host) return;
      e.preventDefault();
      window.open(a.href, '_blank', 'noopener');
    });
  }

  /* Çevrimdışı rozeti.
     navigator.onLine tek başına güvenilmez: iOS'ta uygulama modunda açılışta
     kısa süre "false" dönebiliyor ve sonra 'online' olayı hiç gelmediği için
     rozet çevrimiçiyken de asılı kalıyordu. Bu yüzden durum, sunucuya küçük
     bir istek atılarak GERÇEKTEN doğrulanıyor. */
  var badge = document.createElement('div');
  badge.id = 'pwa-offline';
  badge.textContent = '● ÇEVRİMDIŞI — kayıtlı kartlar açık';
  document.body.appendChild(badge);

  addEventListener('online', function () { refreshOnlineState(); });
  addEventListener('offline', function () { refreshOnlineState(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refreshOnlineState();
  });
  /* Açılışta bir an bekle: ilk saniyede yanlış "çevrimdışı" göstermesin */
  setTimeout(refreshOnlineState, 1500);
  setInterval(function () { if (wasOffline) refreshOnlineState(); }, 20000);
}

/* Service Worker araya girmesin diye adrese __ping ekleniyor;
   sw.js bu istekleri doğrudan ağa bırakır. */
var wasOffline = false;
var probing = false;
function probeConnection(cb) {
  if (probing) return;
  probing = true;
  var done = false;
  var finish = function (ok) {
    if (done) return;
    done = true; probing = false;
    cb(ok);
  };
  var t = setTimeout(function () { finish(false); }, 5000);
  try {
    fetch('./favicon-16.png?__ping=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { clearTimeout(t); finish(!!(r && (r.ok || r.type === 'opaque'))); })
      .catch(function () { clearTimeout(t); finish(false); });
  } catch (e) { clearTimeout(t); finish(false); }
}
function refreshOnlineState() {
  probeConnection(function (ok) {
    /* Rozet YALNIZCA iki kanıt birden varken çıkar:
       hem tarayıcı "bağlantı yok" diyecek, hem de sunucuya atılan istek
       başarısız olacak. Tek başına navigator.onLine iOS'ta yanılıyor. */
    var offline = (ok === false) && (navigator.onLine === false);
    setOffline(offline);
    if (!offline && wasOffline) toast('🌐 Bağlantı geri geldi', { kind: 'good' });
    wasOffline = offline;
  });
}
function setOffline(on) {
  var b = $('pwa-offline');
  if (b) b.classList.toggle('in', !!on);
}
function setThemeColor(hex) {
  var m = qs('meta[name="theme-color"]:not([media])');
  if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
  m.setAttribute('content', hex);
}

/* ================================== 3 · ANDROID GERİ TUŞU ================ */
var lastBack = 0;
function pushGuard() {
  try { history.pushState({ pwaGuard: Date.now() }, ''); } catch (e) {}
}
function setupBackButton() {
  try {
    history.replaceState({ pwaRoot: true }, '');
    history.pushState({ pwaGuard: 0 }, '');
  } catch (e) {}

  addEventListener('popstate', function () {
    /* 1) Açık bir alt sayfa varsa onu kapat */
    if (openSheets.length) {
      openSheets[openSheets.length - 1].close();
      pushGuard();
      return;
    }
    if(window.LUMIRA_STORIES?.back?.()){pushGuard();return;}
    if(window.LUMIRA_LEARNING?.back?.()){pushGuard();return;}
    if($('tabWriting')?.classList.contains('active')&&$('wpBackHomeBtn')){$('wpBackHomeBtn').click();pushGuard();return;}
    /* 2) Kategori paneli açıksa kapat */
    var cat = $('catOverlay');
    if (cat && getComputedStyle(cat).display !== 'none' && cat.classList.contains('show')) {
      var cc = $('catClose'); if (cc) cc.click(); else cat.classList.remove('show');
      pushGuard();
      return;
    }
    if (cat && cat.classList.contains('open')) {
      var cc2 = $('catClose'); if (cc2) cc2.click();
      pushGuard();
      return;
    }
    /* 3) Hata listesi / sonuç ekranı açıksa kartlara dön */
    var mv = $('mistakesView');
    if (mv && mv.style.display === 'block') {
      var back = $('backToQuizBtn') || $('backBtn');
      if (back) back.click(); else mv.style.display = 'none';
      pushGuard();
      return;
    }
    /* 4) Kartlar sekmesinde değilsek oraya dön */
    var tc = $('tabCards');
    if (tc && !tc.classList.contains('active')) {
      tc.click();
      pushGuard();
      return;
    }
    /* 5) Kök ekrandayız: çıkmak için iki kez */
    var now = Date.now();
    if (now - lastBack < 2200) {
      history.back();               /* kök state tüketilir → uygulama kapanır */
      return;
    }
    lastBack = now;
    vibrate(18);
    toast(window.t ? window.t('back_to_exit') : 'Çıkmak için geri tuşuna tekrar bas');
    pushGuard();
  });

  /* Sekme/panel değişimlerinde geçmişe kayıt ekle */
  ['tabQuiz', 'tabLiveTranslate', 'tabPersonal', 'tabNotebook', 'tabWriting', 'tabPlacement', 'tabStories', 'catTrigger'].forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener('click', function () { pushGuard(); }, true);
  });
}

/* ============================ 4 · DEEP LINK · KISAYOL · PAYLAŞIM ========= */
function dismissSplash(cb) {
  var sp = $('splash');
  if (!sp || sp.classList.contains('hidden')) { cb && cb(); return; }
  sp.click();
  setTimeout(function () { cb && cb(); }, 700);
}

function route(params, force) {
  if (!params) return;
  var tab   = params.get('tab');
  var lang  = params.get('lang');
  var level = params.get('level');
  var act   = params.get('action');
  var src   = params.get('src');
  var shared = params.get('share_text') || params.get('share_title') || params.get('share_url');

  var needsApp = tab || lang || level || act || shared || src === 'shortcut' ||
                 src === 'notification' || src === 'push' || src === 'reminder' || force;
  if (!needsApp) return;

  dismissSplash(function () {
    if (lang) {
      var lo = qs('.lang-opt[data-lang="' + lang.toLowerCase() + '"]');
      if (lo) lo.click();     /* sözlük hazır değilse setupLazyVocab devralır */
    }
    if (level) {
      var lv = Array.prototype.slice.call(document.querySelectorAll('.level-opt'))
        .filter(function (e) { return e.textContent.trim().toUpperCase() === level.toUpperCase(); })[0];
      if (lv) lv.click();
    }
    if (tab === 'quiz' && $('tabQuiz')) $('tabQuiz').click();
    else if (tab === 'live' && $('tabLiveTranslate')) $('tabLiveTranslate').click();
    else if ((tab === 'personal' || tab === 'profile') && $('tabPersonal')) $('tabPersonal').click();
    else if (tab === 'cards' && $('tabCards')) $('tabCards').click();
    else if ({writing:'tabWriting',placement:'tabPlacement',stories:'tabStories',notebook:'tabNotebook'}[tab]) $({writing:'tabWriting',placement:'tabPlacement',stories:'tabStories',notebook:'tabNotebook'}[tab])?.click();

    if (act === 'daily') setTimeout(showDailyWord, 450);
    if (act === 'favorites') setTimeout(openFavorites, 450);
    if (act === 'settings') setTimeout(openSettings, 450);

    if (shared) {
      var txt = (params.get('share_text') || '') + ' ' + (params.get('share_title') || '');
      handleSharedText(txt.trim());
    }

    /* URL'i temizle ki yenilemede tekrar tetiklenmesin */
    try { history.replaceState(history.state, '', location.pathname); } catch (e) {}
  });
}

function handleSharedText(txt) {
  if (!txt) return;
  var word = txt.split(/\s+/).slice(0, 3).join(' ');
  var T = window.t || function(k){ return k; };
  sheet(T('shared_content_title'), T('shared_content_desc'), function (b) {
    var box = document.createElement('div');
    box.className = 'pwa-row';
    box.innerHTML = '<div class="ic">📝</div><div class="tx"><b>' + escapeHtml(word) + '</b><span>' +
                    escapeHtml(txt.slice(0, 140)) + '</span></div>';
    b.appendChild(box);
    var save = row('⭐', T('add_to_favs'), T('save_to_word_list'));
    save.onclick = async function () {
      if(await addFavorite({ w: word, tr: txt.slice(0, 120), lang: activeLangCode(), meaningLang:window.NATIVE_LANG||'tr', pos: 'not' }))toast(T('added_to_favs_toast'), { kind: 'good' });
    };
    b.appendChild(save);
    var copy = row('📋', T('copy_to_clipboard'), '');
    copy.onclick = function () { copyText(txt); };
    b.appendChild(copy);
  });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

/* ==================================== 5 · KURULUM (INSTALL) ============== */
var deferredPrompt = null;

function setupInstall() {
  addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var seen = store('pwa_install_dismissed');
    var opens = (store('pwa_opens') || 0);
    if (!isStandalone && !isTwa && !seen && opens >= 2) setTimeout(showInstallBanner, 2500);
  });

  addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideInstallBanner();
    store('pwa_installed', true);
    toast(window.t ? window.t('install_added') : '🎉 Uygulama ana ekranına eklendi!', { kind: 'good' });
  });

  /* iOS: beforeinstallprompt yok → yönergeli rehber */
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && !isStandalone && !isTwa && !store('pwa_ios_hint') && (store('pwa_opens') || 0) >= 2) {
    setTimeout(function () { store('pwa_ios_hint', true); iosInstallGuide(); }, 4000);
  }
}

function showInstallBanner() {
  if ($('pwa-install') || !deferredPrompt) return;
  var el = document.createElement('div');
  el.id = 'pwa-install';
  var T = window.t || function(k){ return k; };
  el.innerHTML =
    '<img src="icon-192.png" alt="">' +
    '<div class="txt"><b>' + T('install_add_title') + '</b><span>' + T('install_add_desc') + '</span></div>' +
    '<button class="go">' + T('install_go') + '</button><button class="x" aria-label="' + T('close') + '">✕</button>';
  document.body.appendChild(el);
  requestAnimationFrame(function () { el.classList.add('in'); });
  qs('.go', el).onclick = function () { doInstall(); };
  qs('.x', el).onclick = function () {
    store('pwa_install_dismissed', Date.now());
    hideInstallBanner();
  };
}
function hideInstallBanner() {
  var el = $('pwa-install');
  if (!el) return;
  el.classList.remove('in');
  setTimeout(function () { el.remove(); }, 460);
}
function doInstall() {
  if (!deferredPrompt) { iosInstallGuide(); return; }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function (c) {
    if (c && c.outcome === 'accepted') toast(window.t ? window.t('installing') : 'Kuruluyor…', { kind: 'good' });
    deferredPrompt = null;
    hideInstallBanner();
  }).catch(function () {});
}
function iosInstallGuide() {
  var T = window.t || function(k){ return k; };
  sheet('📲 ' + T('install_add_title'), T('ios_install_desc'), function (b) {
    [['1️⃣', T('ios_step1_title'), T('ios_step1_desc')],
     ['2️⃣', T('ios_step2_title'), T('ios_step2_desc')],
     ['3️⃣', T('ios_step3_title'), T('ios_step3_desc')]]
      .forEach(function (r) { b.appendChild(row(r[0], r[1], r[2])); });
    b.insertAdjacentHTML('beforeend', '<p class="pwa-note">' + T('ios_install_note') + '</p>');
  });
}

/* ===================================== 6 · BİLDİRİMLER ================== */
function notifyState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
function askNotifyPermission() {
  return new Promise(function (resolve) {
    if (!('Notification' in window)) { resolve('unsupported'); return; }
    if (Notification.permission !== 'default') { resolve(Notification.permission); return; }
    Notification.requestPermission().then(resolve).catch(function () { resolve('denied'); });
  });
}
function showNotification(title, body, url) {
  var payload = { title: title, body: body, url: url || './?src=notification', tag: 'lumira-local' };
  if (swReg && swReg.active) {
    try { swReg.active.postMessage({ type: 'SHOW_NOTIFICATION', payload: payload }); return true; } catch (e) {}
  }
  if (swReg && swReg.showNotification) {
    try { swReg.showNotification(title, { body: body, icon: './icon-192.png', badge: './icon-96.png', data: { url: payload.url } }); return true; } catch (e) {}
  }
  try { new Notification(title, { body: body, icon: './icon-192.png' }); return true; } catch (e) {}
  return false;
}

/* --- Günlük hatırlatma: uygulama açıkken zamanlayıcı, kapalıyken periodicSync */
var reminderTimer = null;
function reminderSettings() {
  return store('pwa_reminder') || { on: false, hour: CONFIG.reminderHour, min: CONFIG.reminderMin };
}
function saveReminder(s) { store('pwa_reminder', s); scheduleReminder(); }

function scheduleReminder() {
  clearTimeout(reminderTimer);
  var s = reminderSettings();
  if (!s.on || notifyState() !== 'granted') return;

  var now = new Date();
  var next = new Date();
  next.setHours(s.hour, s.min, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  /* Uygulama açılırken bugünün saati geçmişse ve hiç gösterilmediyse hemen göster */
  var last = store('pwa_reminder_last');
  var passed = new Date(); passed.setHours(s.hour, s.min, 0, 0);
  if (now >= passed && last !== today() && !studiedToday()) {
    fireReminder();
  }

  var ms = next - now;
  if (ms < 2147483647) {
    reminderTimer = setTimeout(function () { fireReminder(); scheduleReminder(); }, ms);
  }
}
function fireReminder() {
  if (studiedToday()) return;
  store('pwa_reminder_last', today());
  var w = pickDailyWord();
  var fw = w ? (window.FRONT_W ? window.FRONT_W(w) : w.w) : '';
  var bw = w ? (window.BACK_W ? window.BACK_W(w) : w.tr) : '';
  showNotification(
    'Bugün birkaç kelime? 🌙',
    w ? (fw + ' — ' + (bw || '') + '  ·  serini bozma!') : 'Serini bozma, 5 dakika yeter.',
    './?src=reminder&tab=cards'
  );
}
function studiedToday() {
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || k.indexOf('meta') === -1 && k.indexOf('progress') === -1) continue;
      var v = JSON.parse(localStorage.getItem(k) || 'null');
      if (v && v.todayDate === today() && v.todayCount > 0) return true;
    }
  } catch (e) {}
  return false;
}
function registerPeriodicSync(reg) {
  if (!('periodicSync' in reg)) return;
  navigator.permissions && navigator.permissions.query({ name: 'periodic-background-sync' })
    .then(function (st) {
      if (st.state !== 'granted') return;
      reg.periodicSync.register('daily-reminder', { minInterval: 12 * 60 * 60 * 1000 })
        .catch(function () {});
    }).catch(function () {});
}

/* --- Push aboneliği (sunucu tarafı VAPID anahtarı verilirse) -------------- */
function subscribePush() {
  if (!swReg || !swReg.pushManager || !CONFIG.vapidKey) return Promise.resolve(null);
  return swReg.pushManager.getSubscription().then(function (sub) {
    if (sub) return sub;
    return swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64(CONFIG.vapidKey)
    });
  }).then(function (sub) {
    if (sub && CONFIG.pushEndpoint) {
      fetch(CONFIG.pushEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      }).catch(function () {});
    }
    return sub;
  }).catch(function () { return null; });
}
function urlB64(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var b64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(b64), arr = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

/* ================================ 7 · ÇEVRİMDIŞI PAKET ================== */
var cacheBar = null;
async function downloadOfflinePack() {
  if(window.LUMIRA_ACCESS && !await window.LUMIRA_ACCESS.require('offline'))return;
  var T = window.t || function(k){ return k; };
  if (!swReg || !swReg.active) { toast(T('sw_not_ready'), { kind: 'bad' }); return; }
  if (!navigator.onLine) { toast(T('need_internet_download'), { kind: 'bad' }); return; }
  swReg.active.postMessage({ type: 'CACHE_ALL' });
  toast(T('downloading_dicts'));
}
function onCacheProgress(done, total) {
  if (cacheBar) cacheBar.style.width = Math.round(done / total * 100) + '%';
}
function onCacheDone() {
  if (cacheBar) cacheBar.style.width = '100%';
  store('pwa_offline_pack', today());
  toast(window.t ? window.t('offline_pack_ready') : '✅ Çevrimdışı paket hazır — internet olmadan da çalışır', { kind: 'good', duration: 5000 });
}
function estimateStorage() {
  if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
  return navigator.storage.estimate().then(function (e) {
    return { used: e.usage || 0, quota: e.quota || 0 };
  }).catch(function () { return null; });
}
function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }

/* ======================================== 8 · FAVORİLER ================= */
var FAV_KEY = 'lumira_favs_v1';
function favs() { return window.NB_getFavorites ? window.NB_getFavorites() : (store(FAV_KEY) || []); }
function favKey(o) { return JSON.stringify([o.lang || '',o.meaningLang || 'tr',o.w || '',o.tr || '']); }
function isFav(o) { return favs().some(function (f) { return favKey(f) === favKey(o); }); }
async function addFavorite(o) {
  try{
    if(window.NB_saveFavorite)return await window.NB_saveFavorite(o);
    var list=favs();
    if(list.some(function(f){return favKey(f)===favKey(o);}))return true;
    list.unshift(Object.assign({at:Date.now()},o));store(FAV_KEY,list.slice(0,500));return true;
  }catch(error){toast(window.t?window.t(error.message==='nb_fav_login_required'?error.message:'nb_fav_add_failed'):'Could not save the word.',{kind:'bad'});return false;}
}
async function removeFavorite(o) {
  try{
    if(window.NB_removeFavorite && !await window.NB_removeFavorite(o))return false;
    var legacy=store(FAV_KEY)||[];
    store(FAV_KEY,legacy.filter(function(f){return favKey(f)!==favKey(o);}));return true;
  }catch(error){toast(window.t?window.t('nb_fav_remove_failed'):'Could not remove the favorite.',{kind:'bad'});return false;}
}
function activeLangCode() {
  var el = qs('.lang-opt.active');
  return el ? el.getAttribute('data-lang') : 'de';
}
function currentCard() {
  if(window.NB_currentFavorite)return window.NB_currentFavorite();
  var w = $('frontWord'), tr = $('trWord'), pos = $('frontPos');
  if (!w || !w.textContent.trim()) return null;
  return {
    w: w.textContent.trim(),
    tr: tr ? tr.textContent.trim() : '',
    pos: pos ? pos.textContent.trim() : '',
    lang: activeLangCode()
  };
}
function setupFavButton() {
  var card = $('card');
  if (!card || $('favBtn')) return;
  var btn = document.createElement('div');
  btn.id = 'favBtn';
  btn.title = 'Favorilere ekle';
  btn.textContent = '☆';
  var stage = card.parentElement;
  if (stage) { stage.style.position = stage.style.position || 'relative'; stage.appendChild(btn); }

  btn.onclick = async function (e) {
    e.stopPropagation();
    var c = currentCard();
    if (!c) return;
    if (isFav(c)) { if(await removeFavorite(c))toast(window.t ? window.t('removed_from_favs') : 'Favorilerden çıkarıldı'); }
    else {
      if(await addFavorite(c)){vibrate(24);toast(window.t?window.t('nb_fav_added'):'⭐ '+c.w,{kind:'good'});}
    }
    syncFavButton();
  };

  var mo = new MutationObserver(syncFavButton);
  try { mo.observe($('frontWord'), { childList: true, characterData: true, subtree: true }); } catch (e) {}
  try { mo.observe($('trWord'), { childList: true, characterData: true, subtree: true }); } catch (e) {}
  window.addEventListener('lumira:notebookchange',syncFavButton);
  syncFavButton();
}
function syncFavButton() {
  var btn = $('favBtn'); if (!btn) return;
  var c = currentCard(); if (!c) return;
  var on = isFav(c);
  btn.textContent = on ? '★' : '☆';
  btn.classList.toggle('on', on);
}
function openFavorites() {
  sheet(window.t?window.t('fav_title'):'⭐ Favorilerim', window.t?window.t('fav_sub'):'Kaydettiğin kelimeler cihazında saklanır.', function (b) {
    var list = favs();
    if (!list.length) {
      b.innerHTML = '<div class="pwa-empty">'+(window.t?window.t('fav_empty'):'Henüz favori yok.<br>Kartın sağ üstündeki ☆ ile ekleyebilirsin.')+'</div>';
      return;
    }
    var flags = { de: '🇩🇪', en: '🇬🇧', ar: '🇸🇦', fr: '🇫🇷', es: '🇪🇸', ru: '🇷🇺' };
    list.forEach(function (f) {
      var it = document.createElement('div');
      it.className = 'fav-item';
      it.innerHTML = '<div class="fl">' + (flags[f.lang] || '🏳️') + '</div>' +
        '<div class="w"><b>' + escapeHtml(f.w) + '</b><span>' + escapeHtml(f.tr || '') + '</span></div>' +
        '<button class="rm" aria-label="Sil">✕</button>';
      qs('.rm', it).onclick = async function () { if(await removeFavorite(f)){it.remove();syncFavButton();} };
      b.appendChild(it);
    });
    var exp = row('📤', window.t?window.t('fav_share_row'):'Favorileri paylaş / indir', (window.t?window.t('word_count')(list.length):(list.length + ' kelime')));
    exp.onclick = function () { exportFavorites(); };
    b.appendChild(exp);
  });
}
function exportFavorites() {
  var list = favs();
  var txt = list.map(function (f) { return f.w + ' — ' + (f.tr || ''); }).join('\n');
  var content = (window.t?window.t('fav_export_title')(today()):('Lumira · Dil Kartları — Favorilerim (' + today() + ')')) + '\n\n' + txt;
  shareOrSave('favorilerim-' + today() + '.txt', content, 'text/plain', window.t?window.t('fav_export_title_short'):'Favori kelimelerim');
}

/* ================== 9 · DOSYA İNDİRME · PAYLAŞMA ======================== */
function saveFile(filename, content, mime) {
  try {
    var blob = (content instanceof Blob) ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast((window.t?window.t('downloaded')(filename):('⬇️ ' + filename + ' indirildi')), { kind: 'good' });
    return true;
  } catch (e) { logError(e); toast(window.t?window.t('download_failed'):'İndirme başarısız', { kind: 'bad' }); return false; }
}
function shareOrSave(filename, content, mime, title) {
  var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  var file = null;
  try { file = new File([blob], filename, { type: blob.type }); } catch (e) {}
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: title || filename })
      .catch(function () { saveFile(filename, blob); });
    return;
  }
  saveFile(filename, blob);
}
function shareApp() {
  var PLAY_URL = CONFIG.playUrl || ('https://play.google.com/store/apps/details?id=' + CONFIG.packageId);
  var shareUrl = isTwa ? PLAY_URL : (location.origin + location.pathname);
  var data = {
    title: CONFIG.brand + ' · ' + CONFIG.appName,
    text: window.t?window.t('share_app_text'):'6 dilde kelime kartları, quiz ve seslendirme — çevrimdışı da çalışıyor 🌙',
    url: shareUrl
  };
  if (navigator.share) {
    navigator.share(data).catch(function () {});
  } else {
    copyText(data.text + ' ' + data.url);
  }
}
function copyText(t) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(t)
      .then(function () { toast(window.t?window.t('copied_clipboard'):'📋 Panoya kopyalandı', { kind: 'good' }); })
      .catch(function () { toast(window.t?window.t('copy_failed'):'Kopyalanamadı', { kind: 'bad' }); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(window.t?window.t('copied_clipboard'):'📋 Panoya kopyalandı', { kind: 'good' }); } catch (e) {}
    ta.remove();
  }
}
function exportAllData() {
  var dump = { app: CONFIG.brand, exportedAt: new Date().toISOString(), data: {} };
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      dump.data[k] = localStorage.getItem(k);
    }
  } catch (e) {}
  shareOrSave('dil-kartlari-yedek-' + today() + '.json',
    JSON.stringify(dump, null, 2), 'application/json', window.t?window.t('backup_title'):'İlerleme yedeğim');
}
function importData() {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = function () {
    var f = inp.files && inp.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var j = JSON.parse(fr.result);
        var d = j.data || j;
        Object.keys(d).forEach(function (k) { localStorage.setItem(k, d[k]); });
        toast(window.t?window.t('backup_restored'):'✅ Yedek geri yüklendi, yenileniyor…', { kind: 'good' });
        setTimeout(function () { location.reload(); }, 1200);
      } catch (e) { toast(window.t?window.t('file_unreadable'):'Dosya okunamadı', { kind: 'bad' }); }
    };
    fr.readAsText(f);
  };
  inp.click();
}

/* ================================ 10 · HATA RAPORU ====================== */
var ERR_KEY = 'lumira_errors_v1';
/* Kullanıcı için anlamı olmayan, uygulamayı etkilemeyen bilinen mesajlar.
   Bunlar rapora yazılmaz; yoksa liste gerçek hataları gizleyen gürültüyle
   dolar. */
var IGNORED_ERRORS = [
  'sw.js load failed',
  'ServiceWorker script',
  'The operation is insecure',
  'disconnect',
  'ResizeObserver loop',
  /* Firebase SDK'nın dahili IndexedDB kalıcılık katmanından gelen, zararsız
     ve geçici bir yarış-durumu hatası. İşlevselliği etkilemez (Firebase
     otomatik olarak yeniden dener); hata raporlarını kirletmesin. */
  'Attempt to get records from database without an in-progress transaction'
];
function isNoise(msg) {
  msg = String(msg || '');
  for (var i = 0; i < IGNORED_ERRORS.length; i++) {
    if (msg.indexOf(IGNORED_ERRORS[i]) > -1) return true;
  }
  return false;
}

function cleanErrorText(value, limit) {
  return String(value || '')
    .replace(/\bpdl_(?:live|sdbx)_apikey_[A-Za-z0-9_]+/g, '[API_KEY]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(?:https?|chrome-extension|moz-extension|safari-web-extension):\/\/[^\s)'"<>]+/g, function (raw) {
      try {
        var ending = raw.match(/:\d+(?::\d+)?$/);
        var suffix = ending ? ending[0] : '';
        var parsed = new URL(suffix ? raw.slice(0, -suffix.length) : raw);
        return parsed.protocol + '//' + parsed.host + parsed.pathname + suffix;
      } catch (ignore) { return raw.split(/[?#]/)[0]; }
    }).slice(0, limit);
}
function errorSource(stack) {
  var urls = String(stack || '').match(/(?:https?|chrome-extension|moz-extension|safari-web-extension):\/\/[^\s)'"<>]+/g) || [];
  if (!urls.length) return 'unknown';
  if (urls.every(function (url) { return /^(?:chrome-extension|moz-extension|safari-web-extension):/.test(url); })) return 'extension';
  if (urls.some(function (url) { try { return new URL(url).origin === location.origin; } catch (ignore) { return false; } })) return 'app';
  return 'external';
}
function errorSourceLabel(kind) {
  var copy = {
    tr: ['Uygulama', 'Tarayıcı eklentisi', 'Harici betik', 'Kaynak bilinmiyor'],
    en: ['Application', 'Browser extension', 'External script', 'Unknown source'],
    de: ['Anwendung', 'Browser-Erweiterung', 'Externes Skript', 'Unbekannte Quelle'],
    ar: ['التطبيق', 'إضافة المتصفح', 'برنامج نصي خارجي', 'مصدر غير معروف'],
    fr: ['Application', 'Extension du navigateur', 'Script externe', 'Source inconnue'],
    es: ['Aplicación', 'Extensión del navegador', 'Script externo', 'Origen desconocido'],
    ru: ['Приложение', 'Расширение браузера', 'Внешний скрипт', 'Неизвестный источник']
  };
  return (copy[window.NATIVE_LANG] || copy.en)[{app: 0, extension: 1, external: 2, unknown: 3}[kind] ?? 3];
}
function groupErrors(list) {
  var groups = [];
  (Array.isArray(list) ? list : []).forEach(function (entry) {
    if (!entry || typeof entry.m !== 'string') return;
    var same = groups.find(function (row) { return row.m === entry.m && row.s === entry.s && row.kind === entry.kind; });
    var count = Number.isFinite(entry.count) && entry.count > 0 ? entry.count : 1;
    if (same) same.count += count;
    else groups.push(Object.assign({}, entry, {count: count}));
  });
  return groups;
}

function logError(err, extra) {
  try {
    if (isNoise(err && (err.message || err.reason || err))) return;
    var stored = store(ERR_KEY), list = Array.isArray(stored) ? stored.filter(function (entry) { return entry && typeof entry.m === 'string'; }) : [];
    var message = cleanErrorText(err && (err.message || err.reason || err), 1000);
    var stack = cleanErrorText((err && err.stack || '') + (err && err.source ? '\n' + err.source : ''), 1800);
    var kind = errorSource(stack), now = Date.now();
    var index = list.findIndex(function (entry) { return entry.m === message && entry.s === stack && entry.kind === kind && now - Date.parse(entry.t) < 60000; });
    var previous = index >= 0 ? list.splice(index, 1)[0] : null;
    list.unshift({
      t: new Date().toISOString(),
      m: message, s: stack, kind: kind,
      count: previous ? (Number(previous.count) || 1) + 1 : 1,
      u: cleanErrorText(location.href, 400), ua: navigator.userAgent, extra: extra || null
    });
    store(ERR_KEY, list.slice(0, 40));
    if (CONFIG.errorEndpoint) {
      var body = JSON.stringify(list[0]);
      if (navigator.sendBeacon) navigator.sendBeacon(CONFIG.errorEndpoint, body);
      else fetch(CONFIG.errorEndpoint, { method: 'POST', body: body, keepalive: true }).catch(function () {});
    }
  } catch (e) {}
}
function setupErrorReporting() {
  addEventListener('error', function (e) {
    if (e && e.message) logError({ message: e.message, stack: e.error && e.error.stack || '', source: (e.filename || '') + ':' + (e.lineno || '') });
  });
  addEventListener('unhandledrejection', function (e) { var reason = e && e.reason; logError({ message: 'Promise: ' + (reason && reason.message || reason), stack: reason && reason.stack || '' }); });
}
function openErrorReport() {
  var list = groupErrors(store(ERR_KEY));
  sheet(window.t?window.t('err_report_title'):'🐞 Hata raporu', list.length ? (window.t?window.t('err_records_found')(list.length):(list.length + ' kayıt bulundu.')) : (window.t?window.t('err_no_records'):'Kayıtlı hata yok — her şey yolunda.'), function (b) {
    if (!list.length) {
      b.innerHTML = '<div class="pwa-empty">'+(window.t?window.t('err_none_logged'):'🎉 Hiç hata kaydedilmemiş.')+'</div>';
    } else {
      list.slice(0, 8).forEach(function (e) {
        var item = row('•', escapeHtml((e.m || '').slice(0, 100)), new Date(e.t).toLocaleString(window.NATIVE_LANG || 'en') + ' · ' + errorSourceLabel(e.kind) + (e.count > 1 ? ' · ×' + e.count : ''));
        item.onclick = function () {
          sheet(errorSourceLabel(e.kind), cleanErrorText(e.m, 1000), function (details) {
            var trace = document.createElement('pre');
            trace.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.7';
            trace.textContent = cleanErrorText(e.s || errorSourceLabel('unknown'), 1800);
            details.appendChild(trace);
          });
        };
        b.appendChild(item);
      });
    }
    var snd = row('📤', window.t?window.t('err_share_row'):'Raporu paylaş / indir', window.t?window.t('err_share_desc'):'Cihaz bilgisi + son hatalar');
    snd.onclick = function () {
      shareOrSave('hata-raporu-' + today() + '.json',
        JSON.stringify({ app: CONFIG.brand, ua: navigator.userAgent, errors: list }, null, 2),
        'application/json', window.t?window.t('err_report_title2'):'Hata raporu');
    };
    b.appendChild(snd);
    var clr = row('🧹', window.t?window.t('err_clear_row'):'Kayıtları temizle', '');
    clr.onclick = function () { store(ERR_KEY, []); toast(window.t?window.t('cleared'):'Temizlendi'); };
    b.appendChild(clr);
  });
}

/* ================================ 11 · PUANLAMA İSTEĞİ ================== */
function maybeAskRating() {
  if (store('pwa_rated') || store('pwa_rate_never')) return;
  var opens = store('pwa_opens') || 0;
  var first = store('pwa_first_open') || Date.now();
  var days = (Date.now() - first) / 86400000;
  var snoozed = store('pwa_rate_snooze') || 0;
  if (opens < 6 || days < 2 || Date.now() - snoozed < 7 * 86400000) return;

  setTimeout(function () {
    sheet(window.t?window.t('rate_title'):'⭐ Beğendin mi?', window.t?window.t('rate_sub'):'Uygulamayı puanlaman bize çok yardımcı olur.', function (b) {
      var yes = row('💛', window.t?window.t('rate_now'):'Play Store\'da puan ver', window.t?window.t('rate_time'):'30 saniye sürer');
      yes.onclick = function () {
        store('pwa_rated', true);
        try { location.href = 'market://details?id=' + CONFIG.packageId; } catch (e) {}
        setTimeout(function () { window.open(CONFIG.playUrl, '_blank', 'noopener'); }, 700);
      };
      var later = row('⏰', window.t?window.t('rate_later'):'Sonra hatırlat', window.t?window.t('rate_later_desc'):'1 hafta sonra tekrar sorulur');
      later.onclick = function () { store('pwa_rate_snooze', Date.now()); openSheets[openSheets.length - 1].close(); };
      var never = row('🚫', window.t?window.t('rate_never'):'Bir daha sorma', '');
      never.onclick = function () { store('pwa_rate_never', true); openSheets[openSheets.length - 1].close(); };
      b.appendChild(yes); b.appendChild(later); b.appendChild(never);
    });
  }, 3000);
}

/* ================================ 12 · GEÇİŞLER · DEVAM ================= */
function setupTransitions() {
  ['tabCards', 'tabQuiz', 'tabLiveTranslate', 'tabWriting', 'tabPersonal', 'tabNotebook', 'tabPlacement', 'tabStories'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('click', function () {
      if(document.documentElement.classList.contains('lite') ||
         window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
         window.LUMIRA_LIVE?.isActive?.())return;
      var app = qs('.app');
      if (!app) return;
      if (document.startViewTransition) {
        try {
          var transition=document.startViewTransition(function () {});
          // Rotation or another tab click can skip an animation normally.
          // Its rejected ready promise must not become an application error.
          transition.ready?.catch(function () {});
          transition.finished?.catch(function () {});
          transition.updateCallbackDone?.catch(function () {});
          return;
        } catch (e) {}
      }
      var view = $('cardsView');
      var target = id === 'tabQuiz' ? $('quizView') : (id === 'tabLiveTranslate' ? $('liveTranslateView') : (['tabPersonal','tabWriting','tabPlacement','tabStories'].includes(id) ? $('personalView') : (id === 'tabNotebook' ? $('notebookView') : view)));
      if (target) {
        target.classList.remove('pwa-fade-in');
        void target.offsetWidth;
        target.classList.add('pwa-fade-in');
      }
    });
  });
}

var RESUME_KEY = 'lumira_resume_v1';
function saveResume() {
  var tab = Object.entries({cards:'tabCards',quiz:'tabQuiz',live:'tabLiveTranslate',writing:'tabWriting',personal:'tabPersonal',notebook:'tabNotebook',placement:'tabPlacement',stories:'tabStories'}).find(function(pair){return $(pair[1])?.classList.contains('active');})?.[0]||'cards';
  var lvEl = qs('.level-opt.active');
  var card = currentCard();
  var deck = G('deck');
  var idx = G('idx');
  if (!card) return;
  store(RESUME_KEY, {
    tab: tab,
    lang: activeLangCode(),
    level: lvEl ? lvEl.textContent.trim() : null,
    cat: ($('cardCat') ? $('cardCat').textContent.trim() : null),
    idx: (typeof idx === 'number' ? idx : 0),
    total: (deck && deck.length) || 0,
    word: card.w || null,
    at: Date.now()
  });
}

/* Kart sırasını gerçekten geri yükler: idx'i yazar ve kartı yeniden çizer. */
function applyResume(r) {
  var deck = G('deck');
  var render = G('renderCard');
  if (!deck || !deck.length || typeof render !== 'function') return false;

  var target = -1;
  /* Önce kelimeyi ara (deste karıştırılmış olabilir), bulamazsan sırayı kullan */
  if (r.word) {
    for (var i = 0; i < deck.length; i++) {
      var fw = (window.FRONT_W && deck[i]) ? window.FRONT_W(deck[i]) : (deck[i] && deck[i].w);
      if (deck[i] && fw === r.word) { target = i; break; }
    }
  }
  if (target < 0 && typeof r.idx === 'number' && r.idx < deck.length) target = r.idx;
  if (target < 0) return false;

  setG('idx', target);
  setG('flipped', false);
  var cardEl = $('card');
  if (cardEl) cardEl.classList.remove('flipped');
  try { render(); } catch (e) { logError(e); return false; }
  try { var sc = G('saveCardPosition'); if (typeof sc === 'function') sc(); } catch (e) {}
  return true;
}

function offerResume() {
  var r = store(RESUME_KEY);
  if (!r || !r.at || !r.word) return;
  var params = new URLSearchParams(location.search);
  if (params.get('tab') || params.get('action')) return;   /* kısayolla açıldıysa karışmasın */
  if (Date.now() - r.at > 30 * 86400000) return;
  /* İlk karttaysa hatırlatmaya gerek yok */
  if (r.tab === 'cards' && (r.idx || 0) === 0) return;

  var pos = (typeof r.idx === 'number' && r.total) ? ' · ' + (r.idx + 1) + '/' + r.total : '';
  var T = window.t || function(k){ return k; };
  toast(window.t ? window.t('resume_prompt')(escapeHtml(r.word), pos) : ('📖 "' + escapeHtml(r.word) + '"' + pos + ' — kaldığın yerden devam?'), {
    action: T('resume_action'),
    duration: 11000,
    onAction: function () {
      var lo = qs('.lang-opt[data-lang="' + r.lang + '"]');
      var switched = false;
      if (lo && !lo.classList.contains('active')) { lo.click(); switched = true; }
      if (r.level) {
        var lv = Array.prototype.slice.call(document.querySelectorAll('.level-opt'))
          .filter(function (e) { return e.textContent.trim() === r.level; })[0];
        if (lv && !lv.classList.contains('active')) { lv.click(); switched = true; }
      }
      if (r.tab === 'quiz' && $('tabQuiz')) { $('tabQuiz').click(); return; }
      if (r.tab === 'personal' && $('tabPersonal')) { $('tabPersonal').click(); return; }
      var resumeTab={live:'tabLiveTranslate',writing:'tabWriting',notebook:'tabNotebook',placement:'tabPlacement',stories:'tabStories'}[r.tab];
      if(resumeTab&&$(resumeTab)){$(resumeTab).click();return;}

      /* Dil/seviye değiştiyse deste yeniden kurulur — kısa bir nefes al */
      setTimeout(function () {
        if (applyResume(r)) toast(window.t ? window.t('resume_returned')(r.word) : ('✅ ' + r.word + ' kartına dönüldü'), { kind: 'good' });
        else toast(T('resume_not_found'), { kind: 'bad' });
      }, switched ? 420 : 60);
    }
  });
}

/* ======================== GÜNÜN KELİMESİ / WIDGET VERİSİ ================= */
function pickDailyWord() {
  try {
    var d = G('deck');
    if (d && d.length) {
      var seed = parseInt(today().replace(/-/g, ''), 10);
      return d[seed % d.length];
    }
    var f = favs();
    if (f.length) return f[0];
  } catch (e) {}
  return null;
}
function showDailyWord() {
  var w = pickDailyWord();
  var T = window.t || function(k){ return k; };
  sheet(T('daily_word_title'), today(), function (b) {
    if (!w) {
      b.innerHTML = '<div class="pwa-empty">' + T('daily_word_not_loaded') + '</div>';
      return;
    }
    var fw = window.FRONT_W ? window.FRONT_W(w) : w.w;
    var bw = window.BACK_W ? window.BACK_W(w) : (w.tr || w.t);
    var card = document.createElement('div');
    card.className = 'pwa-row';
    card.innerHTML = '<div class="ic">📘</div><div class="tx"><b style="font-size:19px">' +
      escapeHtml(fw || '') + '</b><span style="font-size:13px">' + escapeHtml(bw || '') + '</span></div>';
    b.appendChild(card);

    var listen = row('🔊', T('listen_row'), T('listen_desc'));
    listen.onclick = function () {
      try {
        if (typeof window.speakNative === 'function') {
          var map = { de: 'de-DE', en: 'en-US', ar: 'ar-SA', fr: 'fr-FR', es: 'es-ES', ru: 'ru-RU' };
          var voice = window.FRONT_VOICE ? window.FRONT_VOICE(w) : (map[w.lang || activeLangCode()] || 'de-DE');
          window.speakNative(fw, voice, 0.92, function () {});
        }
      } catch (e) { logError(e); }
    };
    b.appendChild(listen);

    var fav = row('⭐', T('add_to_favs'), '');
    fav.onclick = async function () { var reversed=window.isReversed?.();if(await addFavorite({w:fw,tr:bw||'',lang:reversed?'tr':(w.lang||activeLangCode()),meaningLang:reversed?w.lang:(window.NATIVE_LANG||'tr'),ex:(window.FRONT_EX?window.FRONT_EX(w):w.ex)||'',exTr:(window.BACK_EX?window.BACK_EX(w):w.exTr)||'',cat:w.cat||'',level:w.level||''}))toast(T('added_toast'),{kind:'good'}); };
    b.appendChild(fav);

    var sh = row('📤', T('share_row'), T('share_desc'));
    sh.onclick = function () {
      var txt = fw + ' — ' + (bw || '') + '\n' + CONFIG.brand + ' · ' + CONFIG.appName;
      if (navigator.share) navigator.share({ text: txt, url: location.origin + location.pathname }).catch(function () {});
      else copyText(txt);
    };
    b.appendChild(sh);
  });
  updateWidgetData(w);
}
function updateWidgetData(w) {
  if (!w) return;
  var fw = window.FRONT_W ? window.FRONT_W(w) : w.w;
  var bw = window.BACK_W ? window.BACK_W(w) : (w.tr || '');
  store('lumira_daily_word', { date: today(), w: fw, tr: bw || '', lang: w.lang || activeLangCode() });
  try {
    if ('widgets' in navigator) {
      /* Windows Widgets Board / desteklenen platformlar */
      navigator.widgets.updateByTag && navigator.widgets.updateByTag('daily-word', {
        template: 'daily-word', data: JSON.stringify({ word: fw, translation: bw || '' })
      });
    }
  } catch (e) {}
}

/* Sözlüklerin ihtiyaç anında yüklenmesi artık index.html içinde
   (sürüm uyuşmazlığı yaşanmasın diye sözlük etiketleriyle aynı dosyada). */

/* ===================== OTOMATİK HAFİF MOD (lite) ======================== */
/* Zayıf cihazlarda arka plan bulanıklıkları, kelebekler ve film taneciği
   kare hızını yarıya düşürebiliyor. Cihaz gerçekten zorlanıyorsa bu süslemeler
   kapatılır — işlevsellik aynen kalır. */
function liteSetting() { return store('pwa_lite'); }   /* true / false / null(oto) */

function applyLite(on) {
  document.documentElement.classList.toggle('lite', !!on);
  window.dispatchEvent(new Event('lumira:performancechange'));
  if (on && typeof window.__snowStop === 'function') {
    try { window.__snowStop(); } catch (e) {}
  }
}

/* Hafif mod YALNIZCA kullanıcı ayarlardan açtığında devreye girer.
   Cihaz özelliklerine bakıp otomatik açma kaldırıldı. */
function initLite() {
  var preference=liteSetting();
  var modest=(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||(navigator.deviceMemory&&navigator.deviceMemory<=4)||navigator.connection?.saveData||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  applyLite(preference===true||(preference!==false&&!!modest));
}

/* ======================= HOŞ GELDİN KARTI ============================== */
/* Giriş yapmış kullanıcıya, açılış ekranı kapandıktan sonra kısa bir
   karşılama gösterir. Butonu yoktur: 2,6 saniye sonra kendiliğinden kaybolur
   ya da dokunulunca kapanır. Her açılışta DEĞİL — günün ilk girişinde veya
   son gösterimden en az 8 saat geçmişse. */
var WELCOME_KEY = 'lumira_welcome_v1';

function shouldShowWelcome() {
  try {
    var last = store(WELCOME_KEY) || 0;
    if (!last) return true;
    var now = Date.now();
    if (now - last >= 8 * 3600 * 1000) return true;      /* 8 saat geçtiyse */
    return new Date(last).toDateString() !== new Date(now).toDateString();
  } catch (e) { return false; }
}

function welcomeStats() {
  var out = { streak: 0, xp: 0, level: 1, goal: 0, done: 0 };
  try {
    if (typeof window.PR_getXp === 'function') out.xp = window.PR_getXp();
    if (typeof window.PR_getLevel === 'function') out.level = window.PR_getLevel();
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || k.indexOf('meta') === -1) continue;
      var v = JSON.parse(localStorage.getItem(k) || 'null');
      if (!v || typeof v !== 'object') continue;
      if (typeof v.streak === 'number') out.streak = Math.max(out.streak, v.streak);
      if (typeof v.dailyGoal === 'number') out.goal = Math.max(out.goal, v.dailyGoal);
      if (typeof v.todayCount === 'number') out.done = Math.max(out.done, v.todayCount);
    }
  } catch (e) {}
  return out;
}

function showWelcomeCard(name) {
  if (!name || $('lumira-welcome')) return;
  var st = welcomeStats();

  var lines = [];
  if (st.streak > 0) lines.push(window.t ? window.t('welcome_streak')(st.streak) : ('🔥 <b>' + st.streak + ' günlük</b> serin devam ediyor'));
  lines.push(window.t ? '⭐ ' + window.t('level_xp')(st.level, st.xp) : ('⭐ Seviye <b>' + st.level + '</b> · ' + st.xp + ' XP'));
  if (st.goal > 0) lines.push(window.t ? window.t('welcome_goal')(st.goal) : ('📚 Bugünkü hedefin: <b>' + st.goal + '</b> kelime'));

  var el = document.createElement('div');
  el.id = 'lumira-welcome';
  el.innerHTML =
    '<div class="wc-card">' +
      '<span class="wc-mark">🦋</span>' +
      '<div class="wc-hi">' + (window.t ? window.t('welcome_hi') : 'Hoş geldin,') + '</div>' +
      '<div class="wc-name">' + escapeHtml(name) + '</div>' +
      '<div class="wc-lines">' + lines.map(function (l) {
        return '<div class="wc-line">' + l + '</div>';
      }).join('') + '</div>' +
      '<span class="wc-fly">🦋</span>' +
    '</div>';
  document.body.appendChild(el);
  requestAnimationFrame(function () { el.classList.add('in'); });

  var closed = false;
  var close = function () {
    if (closed) return;
    closed = true;
    el.classList.remove('in');
    setTimeout(function () { el.remove(); }, 420);
  };
  el.addEventListener('click', close);
  setTimeout(close, 2600);
  store(WELCOME_KEY, Date.now());
}

function setupWelcome() {
  if (!shouldShowWelcome()) return;
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (tries > 40) { clearInterval(timer); return; }        /* ~20 sn sonra vazgeç */
    var sp = $('splash');
    if (sp && !sp.classList.contains('hidden')) return;       /* açılış ekranı hâlâ açık */
    var u = fbUser();
    if (!u) return;
    clearInterval(timer);
    setTimeout(function () {
      showWelcomeCard(u.displayName || (u.email || '').split('@')[0]);
    }, 500);
  }, 500);
}

/* ==================== PROFİL VE YÖNETİCİ BÖLÜMÜ ========================= */
/* Firebase'e doğrudan erişim (yüklenmediyse hepsi sessizce devre dışı kalır) */
function fbAuth() {
  try { return (window.firebase && firebase.apps.length) ? firebase.auth() : null; } catch (e) { return null; }
}
function fbDb() {
  try { return (window.firebase && firebase.apps.length) ? firebase.database() : null; } catch (e) { return null; }
}
function fbUser() {
  var a = fbAuth();
  return a ? a.currentUser : null;
}

/* Yönetici tanımı — UID artık istemcide SABİT DEĞİL.
   Yetki /admins/<uid> düğümünden okunur; gerçek koruma Firebase
   kurallarındadır. Bu yalnızca ARAYÜZ içindir (Admin Panel satırını
   göstermek/gizlemek). Yeni yönetici eklemek için: Firebase Console'da
   /admins/<yeni-uid> = true düğümünü ekle — kod değişmez. */
var _isAdmin = false;

/* Yönetici arayüzünü ANINDA ve güvenilir göstermek için sabit UID (1.7.4 gibi).
   Gerçek veritabanı güvenliği yine Firebase kurallarındaki /admins düğümüyle
   sağlanır; bu liste yalnızca arayüzün (admin panelinin) görünmesi içindir. */
var ADMIN_UIDS = ['49AyoEDRltPQ8NSzPU9y2fDtWDI2'];

function refreshAdminFlag(cb) {
  var u = fbUser();
  var d = (typeof fbDb === 'function') ? fbDb() : null;
  /* sabit listedeyse hemen yönetici say, DB'yi bekleme */
  if (u && ADMIN_UIDS.indexOf(u.uid) !== -1) { _isAdmin = true; if (cb) cb(true); return; }
  if (!u || !d) { _isAdmin = false; if (cb) cb(false); return; }
  d.ref('admins/' + u.uid).once('value').then(function (s) {
    _isAdmin = (s.val() === true);
    if (cb) cb(_isAdmin);
  }).catch(function () { _isAdmin = false; if (cb) cb(false); });
}

function isAdmin() {
  if (_isAdmin === true) return true;
  var u = fbUser();
  return !!(u && ADMIN_UIDS.indexOf(u.uid) !== -1);
}

/* Firebase hazır olunca oturum değişimlerini dinle, yönetici bayrağını tazele. */
(function attachAdminWatch() {
  var a = (typeof fbAuth === 'function') ? fbAuth() : null;
  if (!a) { setTimeout(attachAdminWatch, 800); return; }
  a.onAuthStateChanged(function () { refreshAdminFlag(); });
})();

function inputRow(label, type, value, placeholder) {
  var d = document.createElement('label');
  d.className = 'pwa-field';
  d.innerHTML = '<span>' + label + '</span>' +
    '<input class="pwa-input" type="' + type + '" ' +
    (value ? 'value="' + escapeHtml(value) + '" ' : '') +
    (placeholder ? 'placeholder="' + escapeHtml(placeholder) + '" ' : '') +
    'autocomplete="off" autocapitalize="off" spellcheck="false">';
  return d;
}
function bigButton(text) {
  var b = document.createElement('button');
  b.className = 'pwa-btn';
  b.type = 'button';
  b.textContent = text;
  return b;
}

/* ------------------------------- PROFİLİM ------------------------------- */
/* ============================================== DİL AYARI (native/hedef) === */
function openLanguageSettings() {
  sheet('🌐 ' + t('language_row'), '', function (b, api) {
    var NATIVE_OPTS = [
      { c: 'tr', t: '🇹🇷 Türkçe' }, { c: 'de', t: '🇩🇪 Deutsch' }, { c: 'en', t: '🇬🇧 English' },
      { c: 'ar', t: '🇸🇦 العربية' }, { c: 'ru', t: '🇷🇺 Русский' }, { c: 'fr', t: '🇫🇷 Français' }, { c: 'es', t: '🇪🇸 Español' }
    ];
    var TARGET_OPTS = [
      { c: 'de', t: '🇩🇪 Deutsch' }, { c: 'en', t: '🇬🇧 English' }, { c: 'ar', t: '🇸🇦 العربية' },
      { c: 'fr', t: '🇫🇷 Français' }, { c: 'es', t: '🇪🇸 Español' }, { c: 'ru', t: '🇷🇺 Русский' }, { c: 'tr', t: '🇹🇷 Türkçe' }
    ];
    var native = window.NATIVE_LANG || 'tr';
    var target = (window.isReversed && window.isReversed()) ? 'tr' : (window.TARGET_LANG || 'de');

    var nativeWrap = document.createElement('div');
    nativeWrap.className = 'pwa-row'; nativeWrap.style.display = 'block'; nativeWrap.style.cursor = 'default';
    nativeWrap.innerHTML = '<b style="display:block;margin-bottom:10px;">' + t('onb_native_title') + '</b>';
    var nativeChips = document.createElement('div');
    nativeChips.className = 'pdf-chips';
    nativeWrap.appendChild(nativeChips);
    b.appendChild(nativeWrap);

    var targetWrap = document.createElement('div');
    targetWrap.className = 'pwa-row'; targetWrap.style.display = 'block'; targetWrap.style.cursor = 'default';
    targetWrap.innerHTML = '<b style="display:block;margin-bottom:10px;margin-top:6px;">' + t('onb_target_title') + '</b>';
    var targetChips = document.createElement('div');
    targetChips.className = 'pdf-chips';
    targetWrap.appendChild(targetChips);
    b.appendChild(targetWrap);

    function drawNative() {
      nativeChips.innerHTML = '';
      NATIVE_OPTS.forEach(function (o) {
        var c = document.createElement('button');
        c.type = 'button';
        c.className = 'pdf-chip' + (o.c === native ? ' on' : '');
        c.textContent = o.t;
        c.onclick = function () {
          native = o.c;
          if (target === native) target = (native === 'tr') ? 'de' : 'tr'; /* çakışma olursa otomatik düzelt */
          drawNative(); drawTarget();
        };
        nativeChips.appendChild(c);
      });
    }
    function drawTarget() {
      targetChips.innerHTML = '';
      TARGET_OPTS.filter(function (o) { return o.c !== native && (o.c !== 'tr' || native !== 'tr'); }).forEach(function (o) {
        var c = document.createElement('button');
        c.type = 'button';
        c.className = 'pdf-chip' + (o.c === target ? ' on' : '');
        c.textContent = o.t;
        c.onclick = function () { target = o.c; drawTarget(); };
        targetChips.appendChild(c);
      });
    }
    drawNative(); drawTarget();

    var go = document.createElement('button');
    go.type = 'button';
    go.className = 'pwa-btn';
    go.style.marginTop = '18px';
    go.textContent = t('save_apply');
    go.onclick = function () {
      go.disabled = true; go.textContent = t('applying');
      /* Sadece gerçekten kaybedilecek bir şey varsa (Yazma Pratiği'ne yazılmış
         metin ya da az önce gelen bir sonuç) sayfa yenilenmez; onun dışında
         -Notlarım dahil- her yerde güvenilir olan tam sayfa yenilemesi
         kullanılır, çünkü dil arayüzünü HER köşede tutarlı göstermenin en
         sağlam yolu budur. */
      var wpInputEl = document.getElementById('wpInput');
      var hasWpContent = !!(wpInputEl && wpInputEl.value.trim());
      var wpResultEl = document.getElementById('wpResult');
      var hasWpResult = !!(wpResultEl && wpResultEl.innerHTML.trim());
      var preserveFlow = hasWpContent || hasWpResult || window.LUMIRA_LEARNING?.isMounted() || window.LUMIRA_STORIES?.isMounted();
      var p = window.setLangPair ? window.setLangPair(native, target) : Promise.resolve();
      p.then(function () {
        try {
          document.querySelectorAll('.lang-opt').forEach(function (o) { o.classList.toggle('active', o.dataset.lang === target); });
          if (window.renderLangPair) window.renderLangPair();
          if (window.rebuildLevelBox) window.rebuildLevelBox();
          if (window.rebuildChips) window.rebuildChips();
          if (!preserveFlow && window.applyFilter) window.applyFilter();
          /* Kişisel/Notlarım/Yazma Pratiği açıkken PM_open() çağrısı her
             seferinde Personal ana ekranını yeniden kurup mevcut akışı
             (özellikle yazma metnini) sıfırlıyordu. Yeni locale kapısı açık
             ekranı kendi türünde yeniler; eski sürümle uyumluluk için PM_open
             yalnızca bu kapı bulunamazsa yedek olarak kullanılır. */
          if(window.PM_refreshLocale) window.PM_refreshLocale();
          else if (document.querySelector('.pm-root') && window.PM_open) window.PM_open();
          if(preserveFlow) ['langBox','langPair','levelBox','chips'].forEach(function(id){ var el = document.getElementById(id); if(el) el.style.display = 'none'; });
        } catch (e) { logError(e); }
        toast(window.t?window.t('lang_setting_updated_toast'):'🌐 Dil ayarı güncellendi', { kind: 'good' });
        settingsOpen && settingsOpen.close && settingsOpen.close();
        api.close();
        /* Yazma Pratiği'nde kaybedilecek bir metin/sonuç yoksa (Notlarım ve
           Kartlar/Kişisel dahil HER YERDE) güvenilir tam sayfa yenilemesi
           kullanılır; sadece gerçek bir taslak varsa canlı yenilemeyle
           korunur (yukarıdaki preserveFlow). */
        if(!preserveFlow) setTimeout(function(){ location.reload(); }, 700);
      }).catch(function () {
        go.disabled = false; go.textContent = t('save_apply');
        toast(window.t?window.t('lang_dict_load_failed_toast'):'⚠️ Sözlük yüklenemedi, tekrar dene', { kind: 'bad' });
      });
    };
    b.appendChild(go);
  });
}

function openProfile() {
  var u = fbUser();
  var T = window.t || function(k){ return k; };
  sheet(T('profile_title'), u ? T('profile_logged_in') : T('profile_need_login'), function (b) {
    if (!u) {
      b.innerHTML = '<div class="pwa-empty">' + T('profile_login_from_splash') + '</div>';
      return;
    }

    window.LUMIRA_BILLING?.mountProfile(b);
    var loginName = (u.email || '').split('@')[0];
    var info = row('🪪', T('profile_login_name_row'), T('profile_login_name_desc')(loginName));
    info.style.cursor = 'default';
    b.appendChild(info);

    var idRow = row('🔑', T('profile_user_id_row'), T('profile_tap_copy'));
    idRow.onclick = function () { copyText(u.uid); };
    b.appendChild(idRow);

    /* --- görünen ad --- */
    b.insertAdjacentHTML('beforeend', '<p class="pwa-note" style="margin:18px 2px 6px">' + T('profile_display_name_header') + '</p>');
    var nameF = inputRow(T('profile_display_name_label'), 'text', u.displayName || '', T('profile_name_ph'));
    b.appendChild(nameF);
    var nameBtn = bigButton(T('profile_update_name_btn'));
    nameBtn.onclick = function () {
      var v = qs('input', nameF).value.trim();
      if (v.length < 2) { toast(T('toast_name_too_short'), { kind: 'bad' }); return; }
      nameBtn.disabled = true; nameBtn.textContent = T('profile_updating');
      u.updateProfile({ displayName: v }).then(function () {
        var db = fbDb();
        if (db) return db.ref('leaderboard/' + u.uid + '/name').set(v);
      }).then(function () {
        nameBtn.disabled = false; nameBtn.textContent = T('profile_update_name_btn');
        toast(T('toast_name_updated'), { kind: 'good' });
      }).catch(function (e) {
        nameBtn.disabled = false; nameBtn.textContent = T('profile_update_name_btn');
        toast(T('toast_name_failed')(e && e.code ? e.code : T('error_generic_short')), { kind: 'bad', duration: 6000 });
      });
    };
    b.appendChild(nameBtn);

    /* --- şifre --- */
    b.insertAdjacentHTML('beforeend', '<p class="pwa-note" style="margin:22px 2px 6px">' + T('profile_change_password_header') + '</p>');
    var oldF = inputRow(T('profile_current_password_label'), 'password', '', '••••••');
    var newF = inputRow(T('profile_new_password_label'), 'password', '', '••••••');
    b.appendChild(oldF); b.appendChild(newF);
    var passBtn = bigButton(T('profile_change_password_btn'));
    passBtn.onclick = function () {
      var oldP = qs('input', oldF).value;
      var newP = qs('input', newF).value;
      if (!oldP) { toast(T('toast_write_current_pw'), { kind: 'bad' }); return; }
      if (!newP || newP.length < 6) { toast(T('toast_new_pw_short'), { kind: 'bad' }); return; }
      passBtn.disabled = true; passBtn.textContent = T('profile_changing');

      var cred;
      try { cred = firebase.auth.EmailAuthProvider.credential(u.email, oldP); }
      catch (e) { passBtn.disabled = false; passBtn.textContent = T('profile_change_password_btn'); toast(T('toast_cannot_do'), { kind: 'bad' }); return; }

      u.reauthenticateWithCredential(cred).then(function () {
        return u.updatePassword(newP);
      }).then(function () {
        passBtn.disabled = false; passBtn.textContent = T('profile_change_password_btn');
        qs('input', oldF).value = ''; qs('input', newF).value = '';
        toast(T('toast_pw_changed'), { kind: 'good' });
      }).catch(function (e) {
        passBtn.disabled = false; passBtn.textContent = T('profile_change_password_btn');
        var code = e && e.code;
        toast(code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? T('toast_wrong_current_pw')
          : T('toast_failed_generic')(code || T('error_generic_short')), { kind: 'bad', duration: 6000 });
      });
    };
    b.appendChild(passBtn);

    var logoutText=window.LUMIRA_LEARNING_COPY.text;
    var logout=bigButton(logoutText('logout'));logout.id='profileLogout';
    logout.onclick=async function(){logout.disabled=true;try{window.LUMIRA_LIVE?.stop('stopped',false,true);window.VOICE_stop?.();await firebase.auth().signOut();location.reload();}catch(error){logError({message:'Sign out: '+(error.code||error.name||'failed')});logout.disabled=false;toast(T('toast_cannot_do'),{kind:'bad'});}};
    var logoutNote=document.createElement('p');logoutNote.className='pwa-note';logoutNote.textContent=logoutText('logoutNote');b.append(logout,logoutNote);

    /* --- Hesabı sil (KALICI) --------------------------------------- */
    b.insertAdjacentHTML('beforeend',
      '<p class="pwa-note" style="margin:24px 2px 6px;color:#ff8a8a">' + T('profile_delete_header') + '</p>' +
      '<p class="pwa-note" style="margin:0 2px 8px;opacity:.75">' + T('profile_delete_warning') + '</p>');
    var delF = inputRow(T('profile_delete_confirm_label'), 'password', '', '••••••');
    b.appendChild(delF);
    var delBtn = bigButton(T('profile_delete_btn'));
    delBtn.style.background = 'rgba(255,80,80,.14)';
    delBtn.style.borderColor = 'rgba(255,80,80,.5)';
    delBtn.style.color = '#ff8a8a';
    delBtn.onclick = function () {
      var pw = qs('input', delF).value;
      if (!pw) { toast(T('toast_write_pw_first'), { kind: 'bad' }); return; }
      if (!window.confirm(T('confirm_delete_account'))) return;

      var uid = u.uid;
      var d = (typeof fbDb === 'function') ? fbDb() : null;
      delBtn.disabled = true; delBtn.textContent = T('profile_deleting');

      var cred;
      try { cred = firebase.auth.EmailAuthProvider.credential(u.email, pw); }
      catch (e) { delBtn.disabled = false; delBtn.textContent = T('profile_delete_btn'); toast(T('toast_cannot_do'), { kind: 'bad' }); return; }

      u.reauthenticateWithCredential(cred).then(function () {
        /* Kimlik hâlâ geçerliyken önce sunucudaki verileri sil */
        var jobs = [];
        if (d) {
          jobs.push(d.ref('progress/' + uid).remove().catch(function () {}));
          jobs.push(d.ref('leaderboard/' + uid).remove().catch(function () {}));
        }
        return Promise.all(jobs);
      }).then(function () {
        return u.delete();               /* sonra hesabı sil */
      }).then(function () {
        try { localStorage.clear(); } catch (e) {}
        toast(T('toast_account_deleted'), { kind: 'good' });
        setTimeout(function () { location.reload(); }, 1200);
      }).catch(function (e) {
        delBtn.disabled = false; delBtn.textContent = T('profile_delete_btn');
        var code = e && e.code;
        toast(code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? T('toast_wrong_password')
          : T('toast_delete_failed')(code || T('error_generic_short')), { kind: 'bad', duration: 6000 });
      });
    };
    b.appendChild(delBtn);

    b.insertAdjacentHTML('beforeend',
      '<p class="pwa-note">' + T('profile_footer_note')(escapeHtml(loginName)) + '</p>');
  });
}

/* --------------------------- YÖNETİCİ: XP GÖNDER ------------------------ */
function openAdminXp() {
  sheet('🛡️ XP Gönder', 'Yalnızca yönetici görür. Seçtiğin kişinin XP\'si kalıcı olarak artar.', function (b) {
    var db = fbDb();
    if (!db) {
      b.innerHTML = '<div class="pwa-empty">Bağlantı yok — internet gerekiyor.</div>';
      return;
    }

    var searchF = inputRow('Kişi ara', 'text', '', 'İsim yaz…');
    b.appendChild(searchF);

    var amountF = inputRow('Gönderilecek XP', 'number', '', 'ör. 500');
    b.appendChild(amountF);

    var list = document.createElement('div');
    list.innerHTML = '<div class="pwa-empty">Kullanıcılar yükleniyor…</div>';
    b.appendChild(list);

    var users = [];
    var selected = null;

    function draw() {
      var q = qs('input', searchF).value.trim().toLowerCase();
      var shown = users.filter(function (u) {
        return !q || (u.name || '').toLowerCase().indexOf(q) > -1;
      }).slice(0, 40);

      list.innerHTML = '';
      if (!shown.length) {
        list.innerHTML = '<div class="pwa-empty">Eşleşen kullanıcı yok.</div>';
        return;
      }
      shown.forEach(function (u) {
        var r = row('👤', escapeHtml(u.name || '(isimsiz)'),
          (u.xp || 0) + ' XP · Sv ' + (Math.floor((u.xp || 0) / 200) + 1) +
          (u.realXp ? '' : ' · dokun, gerçek XP okunsun'));
        if (selected && selected.uid === u.uid) {
          r.style.borderColor = 'rgba(79,232,255,.6)';
          r.style.background = 'rgba(79,232,255,.10)';
        }
        r.onclick = function () {
          selected = u;
          draw();
          /* Gerçek XP, kişinin progress kaydında tutulur; leaderboard'daki
             kopya yalnızca "Kişisel Mod" kullanıldığında güncellenir ve çoğu
             kullanıcıda 0 kalır. Seçilen kişinin asıl değerini okuyoruz. */
          db.ref('progress/' + u.uid + '/meta/xp').once('value').then(function (sn) {
            var real = sn.val();
            if (typeof real === 'number') {
              u.xp = real;
              u.realXp = true;
              if (selected && selected.uid === u.uid) draw();
            }
          }).catch(function () {});
        };
        list.appendChild(r);
      });
    }

    qs('input', searchF).addEventListener('input', draw);

    db.ref('leaderboard').once('value').then(function (snap) {
      var val = snap.val() || {};
      users = Object.keys(val).map(function (uid) {
        return { uid: uid, name: val[uid] && val[uid].name, xp: (val[uid] && val[uid].xp) || 0 };
      }).sort(function (a, b2) { return (b2.xp || 0) - (a.xp || 0); });
      draw();
    }).catch(function (e) {
      list.innerHTML = '<div class="pwa-empty">Liste okunamadı: ' + escapeHtml((e && e.code) || 'hata') + '</div>';
    });

    var send = bigButton('XP gönder');
    send.onclick = function () {
      if (!selected) { toast('Önce bir kişi seç', { kind: 'bad' }); return; }
      var amount = parseInt(qs('input', amountF).value, 10);
      if (!amount || amount <= 0) { toast('Geçerli bir XP miktarı yaz', { kind: 'bad' }); return; }
      if (amount > 100000) { toast('Tek seferde en fazla 100.000 XP', { kind: 'bad' }); return; }

      var target = selected;

      /* Gönderimden hemen önce gerçek değeri bir kez daha oku: aradan zaman
         geçtiyse kişi XP kazanmış olabilir, üzerine yazıp geri almayalım. */
      send.disabled = true; send.textContent = 'Okunuyor…';
      db.ref('progress/' + target.uid + '/meta/xp').once('value').then(function (sn) {
        var cur = sn.val();
        if (typeof cur !== 'number') cur = target.xp || 0;
        target.xp = cur;
        target.realXp = true;
        send.disabled = false; send.textContent = 'XP gönder';
        draw();
        askAndSend(target, cur, amount);
      }).catch(function () {
        send.disabled = false; send.textContent = 'XP gönder';
        askAndSend(target, target.xp || 0, amount);
      });
    };

    function askAndSend(target, cur, amount) {
      var newXp = cur + amount;

      confirmSheet('XP gönderilsin mi?',
        escapeHtml(target.name || '(isimsiz)') + ' → ' + cur + ' XP yerine <b>' + newXp + ' XP</b> olacak.',
        function () {
          send.disabled = true; send.textContent = 'Gönderiliyor…';
          /* SADECE xp alanı yazılıyor: kişinin serisi, günlük sayacı ve
             öğrendiği kelimeler asla değiştirilmiyor. */
          /* Sıralamaya yazarken ADI da koruyoruz. Yalnızca "xp" alanı
             yazıldığında, kaydın adı boş kalırsa kişi sıralamada hiç
             görünmüyordu. */
          var lbUpdate = { xp: newXp };
          if (target.name) lbUpdate.name = target.name;
          Promise.all([
            db.ref('progress/' + target.uid + '/meta/xp').set(newXp),
            db.ref('leaderboard/' + target.uid).update(lbUpdate)
          ]).then(function () {
            target.xp = newXp;
            send.disabled = false; send.textContent = 'XP gönder';
            qs('input', amountF).value = '';
            draw();

            /* Kendine gönderdiysen: bu cihaz eski XP'yi hâlâ bellekte tutuyor
               ve düzenli aralıklarla sunucuya geri yazıyor. Sıralamanın bir
               görünüp bir kaybolmasının sebebi bu çekişme. Sayfa yenilenince
               cihaz sunucudaki yüksek değeri benimsiyor ve çekişme bitiyor. */
            var me = fbUser();
            if (me && me.uid === target.uid) {
              toast('✅ Gönderildi — yenileniyor…', { kind: 'good' });
              setTimeout(function () { location.reload(); }, 1200);
            } else {
              toast('✅ ' + amount + ' XP gönderildi. Kişi uygulamayı bir daha açtığında değer ona geçecek.',
                    { kind: 'good', duration: 7000 });
            }
          }).catch(function (e) {
            send.disabled = false; send.textContent = 'XP gönder';
            toast('Gönderilemedi: ' + ((e && e.code) || 'izin yok'), { kind: 'bad', duration: 8000 });
          });
        });
    }
    b.appendChild(send);

    b.insertAdjacentHTML('beforeend',
      '<p class="pwa-note">Kişinin cihazı, sunucudaki XP kendi kaydından yüksekse ' +
      'onu esas alır; yani gönderdiğin XP bir sonraki açılışta ona geçer. ' +
      'Serisi, günlük sayacı ve öğrendiği kelimeler değişmez.</p>');
  });
}

/* Basit onay penceresi */
function confirmSheet(title, html, onYes) {
  sheet(title, '', function (b, api) {
    b.insertAdjacentHTML('beforeend', '<p class="sheet-sub">' + html + '</p>');
    var yes = bigButton('Evet, gönder');
    yes.onclick = function () { api.close(); onYes(); };
    var no = document.createElement('button');
    no.className = 'pwa-btn ghost';
    no.type = 'button';
    no.textContent = 'Vazgeç';
    no.onclick = function () { api.close(); };
    b.appendChild(yes); b.appendChild(no);
  });
}

/* ============================== AYAR DÜĞMESİ ============================ */
/* NOT: Bu fonksiyon bir önceki düzenlemede yanlışlıkla silinmişti; ayar
   düğmesinin ekrandan kaybolmasının sebebi buydu. */
function setupFab() {
  if ($('pwa-fab')) return;
  var fab = document.createElement('div');
  fab.id = 'pwa-fab';
  fab.setAttribute('role', 'button');
  fab.setAttribute('aria-label', 'Uygulama ayarları');
  fab.title = 'Uygulama ayarları';
  fab.innerHTML = '⚙️';
  document.body.appendChild(fab);
  /* Aç/kapa: panel açıkken tekrar basınca üst üste açmak yerine kapatır. */
  fab.onclick = function () {
    if (openSheets.length) {
      while (openSheets.length) openSheets[openSheets.length - 1].close();
      return;
    }
    openSettings();
  };

  /* Açılış ekranı görünürken gizli dursun, kapanınca belirsin */
  var sp = $('splash');
  if (sp && !sp.classList.contains('hidden')) {
    fab.classList.add('hidden');
    var show = function () { fab.classList.remove('hidden'); };
    sp.addEventListener('click', function () { setTimeout(show, 400); }, { once: true });
    try {
      var obs = new MutationObserver(function () {
        if (sp.classList.contains('hidden')) { show(); obs.disconnect(); }
      });
      obs.observe(sp, { attributes: true, attributeFilter: ['class'] });
    } catch (e) { show(); }
    /* Her ihtimale karşı: 12 sn sonra düğme kesinlikle görünür olsun */
    setTimeout(show, 12000);
  }
}

/* ---------------------- GÜNCELLEME YARDIMCILARI ------------------------ */
/* Service Worker'a sürümünü sorar (sw.js'teki GET_VERSION'a cevap verir). */
function swVersion(cb) {
  try {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) { cb(null); return; }
    var ch = new MessageChannel();
    var done = false;
    ch.port1.onmessage = function (e) {
      if (done) return;
      done = true;
      cb((e.data && e.data.version) || null);
    };
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
    setTimeout(function () { if (!done) { done = true; cb(null); } }, 2500);
  } catch (e) { cb(null); }
}

function cleanVersion(version){return String(version||'').replace(/^v/,'');}
function newerVersion(a,b){var x=cleanVersion(a).split('.').map(Number),y=cleanVersion(b).split('.').map(Number);if(x.length!==3||y.length!==3||[...x,...y].some(function(n){return !Number.isInteger(n)||n<0;}))return false;for(var i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
var releaseVersion=null,updateFlight=null;
function updateDownloading(){return ({tr:'Güncelleme indiriliyor…',en:'Downloading the update…',de:'Das Update wird heruntergeladen…',ar:'جارٍ تنزيل التحديث…',fr:'Téléchargement de la mise à jour…',es:'Descargando la actualización…',ru:'Обновление загружается…'})[window.NATIVE_LANG||'tr']||'Downloading the update…';}
async function fetchReleaseVersion(){
 var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},5000);
 try{var url=new URL('./app-version.json',location.href);url.searchParams.set('__ping',String(Date.now()));var response=await fetch(url.href,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!response.ok)return null;var data=await response.json();if(!/^\d+\.\d+\.\d+$/.test(data.version||''))return null;releaseVersion=data.version;return data.version;}catch(e){return null;}finally{clearTimeout(timer);}
}
async function findUpdate(){
 var remote=await fetchReleaseVersion();
 if(!swReg)return remote?(newerVersion(remote,APP_VERSION)?'new':'current'):'error';
 if(swReg.waiting){waitingWorker=swReg.waiting;return'new';}
 try{await swReg.update();}catch(e){return remote&&newerVersion(remote,APP_VERSION)?'new':'error';}
 if(swReg.waiting){waitingWorker=swReg.waiting;return'new';}
 var worker=swReg.installing;
 if(worker){
  watchInstallingWorker(worker);
  return await new Promise(function(resolve){
   var done=false,timer;
   function finish(state){if(done)return;done=true;clearTimeout(timer);worker.removeEventListener('statechange',changed);if(state==='new')waitingWorker=swReg.waiting||worker;resolve(state);}
   function changed(){if(worker.state==='installed'||worker.state==='activated')finish('new');else if(worker.state==='redundant')finish('error');}
   worker.addEventListener('statechange',changed);timer=setTimeout(function(){finish(swReg.waiting?'new':'downloading');},20000);changed();
  });
 }
 return remote&&newerVersion(remote,APP_VERSION)?'new':'current';
}
function checkForUpdate(cb){
 if(!updateFlight)updateFlight=findUpdate().catch(function(){return'error';}).finally(function(){updateFlight=null;});
 updateFlight.then(function(state){cb(state);});
}
function reloadLatest(version){
 if(window.LUMIRA_LIVE?.isActive?.()){toast(window.LUMIRA_LEARNING_COPY?.text('updateAfterLive')||'Güncelleme hazır. Çeviriyi durdurduktan sonra yükleyebilirsin.');return;}
 var url=new URL(location.href);url.searchParams.set('lumira_update',cleanVersion(version||releaseVersion||APP_VERSION));url.searchParams.set('__ping','lumira-update-'+Date.now());location.replace(url.href);
}
async function clearDownloadedData(){
 window.LUMIRA_LIVE?.stop('stopped',false,true);window.VOICE_stop?.();
 if(navigator.serviceWorker?.getRegistration){const reg=await navigator.serviceWorker.getRegistration(new URL('./',location.href).href);if(reg)await reg.unregister();}
 if(window.caches){for(const name of await caches.keys()){
  if(name.startsWith('lumira-'))await caches.delete(name);
  else if(name==='transformers-cache'){const cache=await caches.open(name);for(const request of await cache.keys())if(new URL(request.url).pathname.includes('/Xenova/whisper-base/'))await cache.delete(request);}
 }}
 try{localStorage.removeItem('pwa_offline_pack');}catch{}
 reloadLatest(releaseVersion);
}
function hardRefresh(full){
 if(window.LUMIRA_LIVE?.isActive?.()){toast(window.LUMIRA_LEARNING_COPY?.text('updateAfterLive')||'Güncelleme hazır. Çeviriyi durdurduktan sonra yükleyebilirsin.');return Promise.resolve(false);}
 var worker=(swReg&&swReg.waiting)||waitingWorker;
 if(!full && worker && worker.state!=='redundant'){
  try{worker.postMessage({type:'SKIP_WAITING'});setTimeout(function(){reloadLatest(releaseVersion);},5000);return Promise.resolve();}catch(e){}
 }
 var jobs=[];
 if(full){
  if(window.caches)jobs.push(caches.keys().then(function(names){return Promise.all(names.filter(function(name){return name.indexOf('lumira-shell-')===0;}).map(function(name){return caches.delete(name);}));}));
  if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration)jobs.push(navigator.serviceWorker.getRegistration(new URL('./',location.href).href).then(function(reg){return reg?reg.unregister():undefined;}));
 }
 return Promise.all(jobs).catch(function(){}).then(function(){reloadLatest(releaseVersion);});
}

/* ================================ AYARLAR PANELİ ======================== */
var settingsOpen = null;
function openSettings() {
  if (settingsOpen) { try { settingsOpen.close(); } catch (e) {} settingsOpen = null; return; }
  settingsOpen = sheet(t('set_app_title'), CONFIG.brand + ' · ' + CONFIG.appName + (isStandalone ? ' · uygulama modu' : ''), function (b) {
    b.classList.add('settings-organized');
    var copy=window.LUMIRA_LEARNING?.text||function(key){return key;};
    var shortcuts=document.createElement('div');shortcuts.className='settings-shortcuts';
    [['✍️','title','tabWriting'],['📖','stories','tabStories'],['🎙️','live','tabLiveTranslate'],['🎓','placement','tabPlacement']].forEach(function(item){
      var button=document.createElement('button');button.type='button';
      var labels=window.LUMIRA_LEARNING_COPY?.nav[window.NATIVE_LANG]||window.LUMIRA_LEARNING_COPY?.nav.en;
      var index=['tabCards','tabQuiz','tabLiveTranslate','tabWriting','tabPersonal','tabNotebook','tabPlacement','tabStories'].indexOf(item[2]);
      button.textContent=item[0]+' '+(labels?.[index]||copy(item[1]));button.onclick=function(){settingsOpen?.close();settingsOpen=null;$(item[2])?.click();};shortcuts.appendChild(button);
    });
    var quick=document.createElement('h3');quick.textContent=copy('tools');b.appendChild(quick);b.appendChild(shortcuts);
    var groups={};
    ['account','tools','notifications','preferences','savedData','privacy','technical'].forEach(function(key){var section=document.createElement('section');section.className='settings-group';section.dataset.settingsGroup=key;var h=document.createElement('h3');h.textContent=copy(key==='tools'?'learn':key);section.appendChild(h);groups[key]=section;b.appendChild(section);});
    groups.admin=document.createElement('section');groups.admin.className='settings-group';groups.admin.dataset.settingsGroup='admin';b.appendChild(groups.admin);

    var liteOn = document.documentElement.classList.contains('lite');
    var liteRow = row('⚡', t('set_lite_row'),
      liteOn
        ? (liteSetting() === true ? (window.t?window.t('set_lite_on_desc'):'Açık — süslemeler kapalı, daha akıcı')
                                  : (window.t?window.t('set_lite_on_auto_desc'):'Açık (cihaz zayıf olduğu için otomatik)'))
        : (window.t?window.t('set_lite_off_desc'):'Kapalı — tüm görsel efektler açık'),
      '<div class="pwa-switch' + (liteOn ? ' on' : '') + '"></div>');
    liteRow.onclick = function () {
      var next = !document.documentElement.classList.contains('lite');
      applyLite(next);
      store('pwa_lite', next);
      qs('.pwa-switch', liteRow).classList.toggle('on', next);
      qs('.tx span', liteRow).textContent = next
        ? (window.t?window.t('set_lite_on_desc'):'Açık — süslemeler kapalı, daha akıcı')
        : (window.t?window.t('set_lite_off_desc'):'Kapalı — tüm görsel efektler açık');
      toast(next ? (window.t?window.t('set_lite_on_toast'):'⚡ Hafif mod açık — tam etki için sayfayı yenile')
                 : (window.t?window.t('set_lite_off_toast'):'Efektler geri açıldı — yenileyince tamamlanır'), { kind: 'good', duration: 5000 });
    };
    groups.preferences.appendChild(liteRow);


    /* --- Bildirimler ------------------------------------------------- */
    var s = reminderSettings();
    var permOk = notifyState() === 'granted';
    var notifRow = row('🔔', t('set_notif_row'),
      permOk ? (s.on ? (window.t?window.t('set_notif_daily_desc')(pad(s.hour),pad(s.min)):('Her gün ' + pad(s.hour) + ':' + pad(s.min))) : (window.t?window.t('set_notif_off_desc'):'Kapalı')) : (window.t?window.t('set_notif_need_perm'):'İzin gerekiyor'),
      '<div class="pwa-switch' + (s.on && permOk ? ' on' : '') + '"></div>');
    notifRow.onclick = function () {
      askNotifyPermission().then(function (p) {
        if (p !== 'granted') { toast(window.t?window.t('set_notif_denied_toast'):'Bildirim izni verilmedi', { kind: 'bad' }); return; }
        var cur = reminderSettings();
        cur.on = !cur.on;
        saveReminder(cur);
        qs('.pwa-switch', notifRow).classList.toggle('on', cur.on);
        qs('.tx span', notifRow).textContent = cur.on ? (window.t?window.t('set_notif_daily_desc')(pad(cur.hour),pad(cur.min)):('Her gün ' + pad(cur.hour) + ':' + pad(cur.min))) : (window.t?window.t('set_notif_off_desc'):'Kapalı');
        if (cur.on) { subscribePush(); toast(window.t?window.t('set_notif_on_toast'):'🔔 Hatırlatma açıldı', { kind: 'good' }); }
      });
    };
    groups.notifications.appendChild(notifRow);

    var timeRow = row('⏰', t('set_notif_time_row'), (window.t?window.t('set_notif_time_desc'):'Bildirimin geleceği saat'),
      '<input class="pwa-time" type="time" value="' + pad(s.hour) + ':' + pad(s.min) + '">');
    var inp = qs('.pwa-time', timeRow);
    inp.onclick = function (e) { e.stopPropagation(); };
    inp.onchange = function () {
      var parts = inp.value.split(':');
      var cur = reminderSettings();
      var hour=Number(parts[0]);cur.hour=Number.isInteger(hour)&&hour>=0&&hour<=23?hour:20;
      var minute=Number(parts[1]);cur.min=Number.isInteger(minute)&&minute>=0&&minute<=59?minute:0;
      saveReminder(cur);
      toast((window.t?window.t('set_notif_time_updated_toast')(inp.value):('Saat güncellendi: ' + inp.value)), { kind: 'good' });
    };
    groups.notifications.appendChild(timeRow);

    var testRow = row('📨', t('set_notif_test_row'), (window.t?window.t('set_notif_test_desc'):'Çalışıyor mu diye bak'));
    testRow.onclick = function () {
      askNotifyPermission().then(function (p) {
        if (p !== 'granted') { toast(window.t?window.t('set_notif_need_perm_first_toast'):'Önce izin ver', { kind: 'bad' }); return; }
        showNotification((window.t?window.t('set_notif_test_title'):'Merhaba! 👋'), (window.t?window.t('set_notif_test_body'):'Bildirimler çalışıyor. İyi çalışmalar!'), './?src=notification&tab=cards');
      });
    };
    groups.technical.appendChild(testRow);

    /* --- Çevrimdışı --------------------------------------------------- */
    var packRow = row('📦', t('set_offline_row'), (window.t?window.t('set_offline_desc'):'6 dilin tüm sözlükleri · destek rozeti gerekir'));
    var bar = document.createElement('div');
    bar.className = 'pwa-progress';
    bar.innerHTML = '<i></i>';
    cacheBar = qs('i', bar);
    packRow.onclick = function () {
      downloadOfflinePack();
    };
    groups.tools.appendChild(packRow); groups.tools.appendChild(bar);
    if (store('pwa_offline_pack')) cacheBar.style.width = '100%';

    estimateStorage().then(function (st) {
      var r = row('💾', t('set_storage_row'), st?mb(st.used) + ' / ' + mb(st.quota):'—');
      r.style.cursor = 'default';
      groups.technical.appendChild(r);
      var copy=window.LUMIRA_LEARNING_COPY.text,clear=bigButton(copy('storageClear'));clear.id='clearDownloadedData';
      var note=document.createElement('p');note.className='pwa-note';note.textContent=copy('storageClearNote');
      clear.onclick=async function(){clear.disabled=true;clear.textContent=copy('storageClearing');try{await clearDownloadedData();}catch(error){logError({message:'Clear downloads: '+(error.name||'failed')});clear.disabled=false;clear.textContent=copy('storageClear');toast(window.LUMIRA_LEARNING_COPY.text('error'),{kind:'bad'});}};
      groups.technical.append(clear,note);
    });

    /* --- Favoriler & veri --------------------------------------------- */
    var favRow = row('⭐', t('set_favs_row'), (window.t?window.t('nb_word_count')(favs().length):String(favs().length)));
    favRow.onclick = function () { openFavorites(); };
    groups.tools.appendChild(favRow);

    var check = row('🔍', t('set_check_row'), (window.t?window.t('set_check_desc'):'Kayıtlı ilerleme kayıtlarını say'));
    check.onclick = function () {
      var n = 0, keys = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (!k) continue;
          n++;
          if (/prog|xp|streak|meta|word|badge|stat/i.test(k)) keys.push(k);
        }
      } catch (e) {}
      toast((window.t?window.t('set_check_toast')(n,keys.length):('💾 ' + n + ' kayıt var, ' + keys.length + ' tanesi ilerleme verisi')), { duration: 7000 });
    };
    groups.technical.appendChild(check);

    var exp = row('⬇️', t('set_export_row'), (window.t?window.t('set_export_desc'):'JSON dosyası indir veya paylaş'));
    exp.onclick = exportAllData;
    groups.savedData.appendChild(exp);

    var imp = row('⬆️', t('set_import_row'), (window.t?window.t('set_import_desc'):'Daha önce indirdiğin dosyayı seç'));
    imp.onclick = importData;
    groups.savedData.appendChild(imp);

    var shr = row('🔗', t('set_share_row'), (window.t?window.t('set_share_desc'):'Arkadaşlarına gönder'));
    shr.onclick = shareApp;
    groups.privacy.appendChild(shr);

    /* --- Kurulum / güncelleme ----------------------------------------- */
    if (!isStandalone && !isTwa) {
      var ins = row('📲', t('set_install_row'), (window.t?window.t('set_install_desc'):'Tam ekran, hızlı ve çevrimdışı'));
      ins.onclick = doInstall;
      groups.technical.appendChild(ins);
    }

    var myVer = (window.PWA && window.PWA.version) ? window.PWA.version : 'bilinmiyor';
    var upd = row('🔄', t('set_update_row'), (window.t?window.t('set_update_desc')(myVer):('Çalışan sürüm: ' + myVer)));
    var updDesc = qs('.tx span', upd);
    groups.technical.appendChild(upd);

    /* Service Worker'ın kendi sürümünü de göster: ikisi farklıysa cihazda
       eski dosyalar takılı kalmış demektir. */
    swVersion(function (v) {
      if (!v) return;
      updDesc.textContent = (window.t?window.t('set_update_cache_desc')(myVer,v):('Çalışan: ' + myVer + ' · önbellek: ' + v));
    });

    upd.onclick = function () {
      if (!navigator.onLine) { toast(window.t?window.t('set_update_need_internet_toast'):'Güncelleme için internet gerekli', { kind: 'bad' }); return; }
      updDesc.textContent = (window.t?window.t('set_update_checking_desc'):'Denetleniyor…');
      checkForUpdate(function (state) {
        if (state === 'new') {
          updDesc.textContent = (window.t?window.t('set_update_new_desc'):'Yeni sürüm indirildi');
          toast(window.t?window.t('set_update_new_toast'):'✨ Yeni sürüm hazır', {
            action: (window.t?window.t('set_update_install_now'):'Şimdi yükle'), duration: 14000,
            onAction: function () { hardRefresh(); }
          });
        } else if (state === 'downloading') {
          updDesc.textContent=updateDownloading();toast(updateDownloading());
        } else if (state === 'error') {
          updDesc.textContent = (window.t?window.t('set_update_error_desc'):'Denetlenemedi');
          toast(window.t?window.t('set_update_error_toast'):'Denetlenemedi', { kind: 'bad' });
        } else {
          swVersion(function (cachedVersion) {
            var same = !cachedVersion || cachedVersion.replace(/^v/, '') === myVer.replace(/^v/, '');
            updDesc.textContent = cachedVersion ? t('set_update_cache_desc')(myVer, cachedVersion) : t('set_update_desc')(myVer);
            if (!same) {
              toast(t('set_update_new_toast'), {
                action:t('set_update_install_now'), duration:14000,
                onAction:function () { hardRefresh(); }
              });
            } else {
              toast(t('set_update_uptodate_toast'), { kind:'good' });
            }
          });
        }
      });
    };

    /* Takılı kalan dosyalar için kesin çözüm */
    var force = row('🧹', (window.t?window.t('set_force_update_row'):'Zorla güncelle'), (window.t?window.t('set_force_update_desc'):'Önbelleği temizler ve yeniler — verilerin silinmez'));
    force.onclick = function () {
      confirmSheet((window.t?window.t('set_force_update_confirm_title'):'Zorla güncellensin mi?'),
        (window.t?window.t('set_force_update_confirm_body'):'Kayıtlı dosyalar silinip yeniden indirilecek. <b>İlerlemen, favorilerin ve ayarların silinmez.</b> Uygulama bir kez yenilenecek.'),
        function () { hardRefresh(true); });
    };
    groups.technical.appendChild(force);

    var net = row('📶', (window.t?window.t('set_net_check_row'):'Bağlantı durumunu denetle'), (window.t?window.t('set_net_check_desc'):'Çevrimdışı uyarısı yanlışsa buraya bak'));
    net.onclick = function () { refreshOnlineState(); window.PWA.netStatus(); };
    groups.technical.appendChild(net);

    var bug = row('🐞', (window.t?window.t('set_bug_row'):'Hata raporu'), (window.t?window.t('set_bug_desc'):'Sorun mu var? Rapor gönder'));
    bug.onclick = openErrorReport;
    groups.technical.appendChild(bug);

    var rate = row('💛', (window.t?window.t('set_rate_row'):'Puan ver'), (window.t?window.t('set_rate_desc'):'Play Store\'da değerlendir'));
    rate.onclick = function () {
      store('pwa_rated', true);
      try { location.href = 'market://details?id=' + CONFIG.packageId; } catch (e) {}
      setTimeout(function () { window.open(CONFIG.playUrl, '_blank', 'noopener'); }, 700);
    };
    groups.privacy.appendChild(rate);

    /* --- Yönetici (yalnızca yönetici hesabında görünür) --------------- */
    (function (adminBox) {
      function injectAdmin() {
        if (adminBox.querySelector('.pwa-admin-row')) return; /* zaten eklendi */
        adminBox.insertAdjacentHTML('beforeend',
          '<p class="pwa-note" style="margin:20px 2px 8px">'+(window.t?window.t('set_admin_section'):'Yönetici')+'</p>');
        var adm = row('🛡️', (window.t?window.t('set_admin_row'):'Admin Panel'), (window.t?window.t('set_admin_desc'):'İstatistik · XP · yasaklama'));
        adm.className += ' pwa-admin-row';
        adm.style.borderColor = 'rgba(255,210,59,.4)';
        adm.onclick = function () {
          if (typeof window.openAdminPanel === 'function') window.openAdminPanel();
          else toast(window.t?window.t('set_admin_load_fail_toast'):'Yönetici paneli yüklenemedi', { kind: 'bad' });
        };
        adminBox.appendChild(adm);
      }
      /* Bayrak zaten çözülmüşse hemen; değilse /admins okunduktan sonra. */
      if (isAdmin()) injectAdmin();
      else refreshAdminFlag(function (ok) { if (ok) injectAdmin(); });
    })(groups.admin);

    var curNative = window.NATIVE_LANG || 'tr';
    var curTarget = (window.isReversed && window.isReversed()) ? 'tr' : (window.TARGET_LANG || 'de');
    var NATIVE_NAMES = { tr:'Türkçe', de:'Deutsch', en:'English', ar:'العربية', ru:'Русский', fr:'Français', es:'Español' };
    var langSub = (window.I18N && window.I18N[curNative] && window.I18N[curNative].lang_change_sub)
      ? window.I18N[curNative].lang_change_sub(NATIVE_NAMES[curNative]||curNative, NATIVE_NAMES[curTarget]||curTarget)
      : (NATIVE_NAMES[curNative]||curNative) + ' konuşuyorsun · ' + (NATIVE_NAMES[curTarget]||curTarget) + ' öğreniyorsun';
    var langRow = row('🌐', t('language_row'), langSub);
    langRow.onclick = function () { openLanguageSettings(); };
    groups.account.appendChild(langRow);

    if(!isTwa&&typeof window.getDigitalGoodsService!=='function'){var pricing=row('💳',window.LUMIRA_BILLING?.text(0)||'Plans','');pricing.onclick=function(){location.href=new URL('./pricing/?lang='+(window.NATIVE_LANG||'tr'),location.href).href;};groups.account.appendChild(pricing);}
    var prof = row('👤', t('profile_row'), t('profile_desc'));
    prof.onclick = function () {
      openProfile();
    };
    groups.account.appendChild(prof);

    var pdfRow = row('📄', (window.t?window.t('set_pdf_row'):'Kelimeleri PDF olarak indir'), (window.t?window.t('set_pdf_desc'):'Kitap düzeninde kelime listesi · rozet gerekir'));
    pdfRow.onclick = function () {
      if (typeof window.openPdfExport === 'function') window.openPdfExport();
    };
    groups.tools.appendChild(pdfRow);

    var priv = row('🔒', (window.t?window.t('set_privacy_row'):'Gizlilik Politikası'), (window.t?window.t('set_privacy_desc'):'Hangi veriler saklanıyor?'));
    priv.onclick = function () { window.open('privacy/', '_blank', 'noopener'); };
    groups.privacy.appendChild(priv);

    var supRow = row('❤️', (window.t?window.t('set_support_row'):'Lumira\'yı Destekle'), (window.t?window.t('set_support_desc_row'):'Rozet kazan, gelişime katkıda bulun'));
    supRow.style.borderColor = 'rgba(255,95,184,.32)';
    supRow.onclick = function () {
      if (typeof window.openSupport === 'function') window.openSupport();
    };
    groups.account.appendChild(supRow);

    b.insertAdjacentHTML('beforeend',
      '<p class="pwa-note">' + (window.t ? window.t('set_footer_note')(CONFIG.brand, CONFIG.appName, (store('pwa_opens') || 1)) :
        (CONFIG.brand + ' · ' + CONFIG.appName + ' — çevrimdışı çalışır, verilerin cihazında saklanır.<br>Toplam açılış: ' + (store('pwa_opens') || 1))) + '</p>');
  });
}
function pad(n) { return String(n).padStart(2, '0'); }

/* ============================================================ BAŞLAT ==== */

/* Splash'taki ✦ işaretini "I" harfinin tam üstüne, harfin GERÇEK çizim
   konumuna göre yerleştirir.
   Önceki sürüm harf genişliklerini canvas ile tahmin ediyordu; sistem yazı
   tipi (-apple-system) canvas'ta farklı bir yazı tipine düştüğü için ölçüm
   tutmuyor, yıldız kayıyordu. Range API doğrudan ekranda çizilmiş harfin
   dikdörtgenini verir — tahmin yok. */
function placeBrandSpark() {
  try {
    var h = qs('.brand-name');
    var sp = qs('.brand-spark');
    if (!h || !sp) return;

    var node = null;
    for (var i = 0; i < h.childNodes.length; i++) {
      if (h.childNodes[i].nodeType === 3 && h.childNodes[i].nodeValue.indexOf('I') > -1) {
        node = h.childNodes[i]; break;
      }
    }
    if (!node) return;

    var pos = node.nodeValue.indexOf('I');       /* LUM[I]RA */
    if (pos < 0) return;

    var r = document.createRange();
    r.setStart(node, pos);
    r.setEnd(node, pos + 1);
    var box = r.getBoundingClientRect();
    var host = h.getBoundingClientRect();
    if (!box.width || !host.width) return;

    /* harfin yatay ortası, başlığın sol kenarına göre */
    var center = box.left - host.left + box.width / 2;
    sp.style.left = center.toFixed(1) + 'px';

    /* --- Gradyanı yazıyla hizala ---------------------------------------
       Başlıktaki gradyan 220% genişliğinde ve animasyonla sağa-sola kayıyor.
       Yıldızın kendi kutusu küçük olduğu için aynı gradyan ona verildiğinde
       farklı bir renkte kalırdı. Burada yıldızın gradyanı, başlığınkiyle
       aynı ölçeğe getirilip yıldızın bulunduğu noktaya kaydırılıyor:
       böylece her an "I" harfiyle birebir aynı rengi gösteriyor. */
    var W = h.clientWidth;
    if (W > 0) {
      var bgW = W * 2.2;                       /* background-size:220% */
      var travel = bgW - W;                    /* animasyonun kat ettiği yol */
      var x = center - sp.offsetWidth / 2;     /* translateX(-50%) sonrası sol kenar */
      sp.style.backgroundSize = bgW.toFixed(1) + 'px 100%';
      sp.style.setProperty('--sp-a', (-x).toFixed(1) + 'px');
      sp.style.setProperty('--sp-b', (-x - travel).toFixed(1) + 'px');
      sp.classList.add('aligned');
    }
  } catch (e) {}
}

/* Eksik kalan efekt: "Sonraki" düğmesinin işleyicisi sky.js'teki
   spawnShootingStar()'ı çağırıyordu. O dosya kaldırıldığı için her tıklamada
   ReferenceError atıyor ve HEMEN ARDINDAKİ saveCardPosition() çalışmıyordu
   (kart konumu bu yüzden hiç kaydedilmiyordu). Hafif bir sürüm burada. */
if (typeof window.spawnShootingStar !== 'function') {
  window.spawnShootingStar = function () {
    try {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var s = document.createElement('div');
      s.className = 'pwa-shoot';
      s.style.left = (Math.random() * 55 + 20) + 'vw';
      s.style.top  = (Math.random() * 22 + 6) + 'vh';
      document.body.appendChild(s);
      setTimeout(function () { s.remove(); }, 1200);
    } catch (e) {}
  };
}

function boot() {
  try{var cleanUrl=new URL(location.href);if((cleanUrl.searchParams.get('__ping')||'').indexOf('lumira-update-')===0){cleanUrl.searchParams.delete('__ping');history.replaceState(history.state,'',cleanUrl.href);}}catch(e){}
  try {
    /* açılış sayacı */
    var opens = (store('pwa_opens') || 0) + 1;
    store('pwa_opens', opens);
    if (!store('pwa_first_open')) store('pwa_first_open', Date.now());

    setupErrorReporting();
    placeBrandSpark();
    addEventListener('resize', placeBrandSpark);
    addEventListener('orientationchange', function () { setTimeout(placeBrandSpark, 250); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(placeBrandSpark).catch(function () {});
    }
    [120, 400, 900, 1800].forEach(function (ms) { setTimeout(placeBrandSpark, ms); });
    registerSW();
    setupShell();
    setupBackButton();
    setupInstall();
    setupFab();
    setupTransitions();
    setupWelcome();
    initLite();
    scheduleReminder();

    /* Kart alanı hazır olunca favori yıldızını ekle */
    setTimeout(setupFavButton, 1200);
    setTimeout(function () { updateWidgetData(pickDailyWord()); }, 3000);

    /* Kaldığın yeri kaydet — tıklama işleyicileri bittikten SONRA çalışsın,
       yoksa idx bir adım geride kaydedilir. */
    document.addEventListener('click', function () {
      setTimeout(function () { try { saveResume(); } catch (e) {} }, 120);
    }, false);
    document.addEventListener('visibilitychange', function () {
      try { saveResume(); } catch (e) {}
    });
    addEventListener('pagehide', saveResume);

    /* Deep link / kısayol / paylaşım */
    route(new URLSearchParams(location.search));

    /* Splash kapandıktan sonraki nazik davranışlar */
    var sp = $('splash');
    var afterSplash = function () {
      setTimeout(offerResume, 1400);
      maybeAskRating();
    };
    if (sp) {
      sp.addEventListener('click', afterSplash, { once: true });
      if (sp.classList.contains('hidden')) afterSplash();
    } else afterSplash();

  } catch (e) { logError(e); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

/* ============================================================ PUBLIC ==== */
window.PWA = {
  config: CONFIG,
  toast: toast,
  sheet: sheet,
  openSettings: openSettings,
  openFavorites: openFavorites,
  showDailyWord: showDailyWord,
  install: doInstall,
  share: shareApp,
  saveFile: saveFile,
  shareFile: shareOrSave,
  exportData: exportAllData,
  importData: importData,
  notify: showNotification,
  askNotifyPermission: askNotifyPermission,
  downloadOfflinePack: downloadOfflinePack,
  favorites: favs,
  addFavorite: addFavorite,
  logError: logError,
  openProfile: openProfile,
  hardRefresh: hardRefresh,
  netStatus: function () {
    probeConnection(function (ok) {
      toast('navigator.onLine: ' + navigator.onLine + ' · sunucu testi: ' + (ok ? 'başarılı' : 'başarısız'), { duration: 7000 });
    });
    return { onLine: navigator.onLine, badgeVisible: !!(document.getElementById('pwa-offline') || {}).classList && document.getElementById('pwa-offline').classList.contains('in') };
  },
  version: APP_VERSION,
  isStandalone: function () { return isStandalone; }
};

})();
