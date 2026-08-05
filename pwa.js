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

/* ------------------------------------------------------- ALT SAYFA ------ */
var openSheets = [];
function sheet(title, subtitle, buildBody) {
  var back = document.createElement('div');
  back.className = 'pwa-sheet-backdrop';
  var box = document.createElement('div');
  box.className = 'pwa-sheet';
  box.setAttribute('role', 'dialog');
  box.innerHTML = '<div class="grab"></div><h3>' + title + '</h3>' +
                  (subtitle ? '<p class="sheet-sub">' + subtitle + '</p>' : '');
  var body = document.createElement('div');
  box.appendChild(body);
  document.body.appendChild(back);
  document.body.appendChild(box);
  try { buildBody(body, api); } catch (e) { logError(e); }

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
      back.classList.remove('in'); box.classList.remove('in');
      setTimeout(function () { back.remove(); box.remove(); }, 380);
    }
  };
  openSheets.push(api);
  pushGuard();
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
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then(function (reg) {
      swReg = reg;

      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);

      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(nw);
        });
      });

      /* Otomatik güncelleme kontrolü: açılışta, saatte bir ve öne gelince */
      setTimeout(function () { try { reg.update(); } catch (e) {} }, 8000);
      setInterval(function () { try { reg.update(); } catch (e) {} }, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { try { reg.update(); } catch (e) {} }
      });

      registerPeriodicSync(reg);
    })
    .catch(function (err) { console.warn('[PWA] SW kaydı başarısız:', err); });

  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });

  navigator.serviceWorker.addEventListener('message', function (ev) {
    var d = ev.data || {};
    if (d.type === 'CACHE_PROGRESS') onCacheProgress(d.done, d.total);
    if (d.type === 'CACHE_DONE')     onCacheDone();
    if (d.type === 'NOTIFICATION_OPEN') route(new URL(d.url, location.href).searchParams, true);
    if (d.type === 'BACK_ONLINE')    setOffline(false);
  });
}

function offerUpdate(worker) {
  waitingWorker = worker;
  toast('✨ Yeni sürüm hazır', {
    action: 'Güncelle',
    duration: 14000,
    onAction: function () {
      try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) { location.reload(); }
    }
  });
}

/* ================================ 2 · TAM EKRAN / DURUM ÇUBUĞU =========== */
var isStandalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) ||
                   (window.matchMedia && matchMedia('(display-mode: fullscreen)').matches) ||
                   navigator.standalone === true ||
                   /android-app:\/\//.test(document.referrer);

function setupShell() {
  document.documentElement.classList.toggle('pwa-standalone', isStandalone);

  /* Durum çubuğu / gezinme çubuğu rengi — splash koyu, uygulama koyu */
  setThemeColor('#04050a');

  /* iOS: iki parmakla yakınlaştırmayı kapat.
     (Çift dokunma engellenmiyor — kartı hızlı çevirmeyi bozuyordu.) */
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

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

  /* Çevrimdışı rozeti */
  var badge = document.createElement('div');
  badge.id = 'pwa-offline';
  badge.textContent = '● ÇEVRİMDIŞI — kayıtlı kartlar açık';
  document.body.appendChild(badge);
  addEventListener('online',  function () { setOffline(false); toast('🌐 Bağlantı geri geldi', { kind: 'good' }); });
  addEventListener('offline', function () { setOffline(true); });
  setOffline(!navigator.onLine);
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
    toast('Çıkmak için geri tuşuna tekrar bas');
    pushGuard();
  });

  /* Sekme/panel değişimlerinde geçmişe kayıt ekle */
  ['tabQuiz', 'tabPersonal', 'catTrigger'].forEach(function (id) {
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
      if (lo) lo.click();
    }
    if (level) {
      var lv = Array.prototype.slice.call(document.querySelectorAll('.level-opt'))
        .filter(function (e) { return e.textContent.trim().toUpperCase() === level.toUpperCase(); })[0];
      if (lv) lv.click();
    }
    if (tab === 'quiz' && $('tabQuiz')) $('tabQuiz').click();
    else if ((tab === 'personal' || tab === 'profile') && $('tabPersonal')) $('tabPersonal').click();
    else if (tab === 'cards' && $('tabCards')) $('tabCards').click();

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
  sheet('📥 Paylaşılan metin', 'Başka bir uygulamadan gönderdiğin içerik:', function (b) {
    var box = document.createElement('div');
    box.className = 'pwa-row';
    box.innerHTML = '<div class="ic">📝</div><div class="tx"><b>' + escapeHtml(word) + '</b><span>' +
                    escapeHtml(txt.slice(0, 140)) + '</span></div>';
    b.appendChild(box);
    var save = row('⭐', 'Favorilere ekle', 'Kendi kelime listene kaydet');
    save.onclick = function () {
      addFavorite({ w: word, tr: txt.slice(0, 120), lang: activeLangCode(), pos: 'not' });
      toast('⭐ Favorilere eklendi', { kind: 'good' });
    };
    b.appendChild(save);
    var copy = row('📋', 'Panoya kopyala', '');
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
    if (!isStandalone && !seen && opens >= 2) setTimeout(showInstallBanner, 2500);
  });

  addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideInstallBanner();
    store('pwa_installed', true);
    toast('🎉 Uygulama ana ekranına eklendi!', { kind: 'good' });
  });

  /* iOS: beforeinstallprompt yok → yönergeli rehber */
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && !isStandalone && !store('pwa_ios_hint') && (store('pwa_opens') || 0) >= 2) {
    setTimeout(function () { store('pwa_ios_hint', true); iosInstallGuide(); }, 4000);
  }
}

function showInstallBanner() {
  if ($('pwa-install') || !deferredPrompt) return;
  var el = document.createElement('div');
  el.id = 'pwa-install';
  el.innerHTML =
    '<img src="icon-192.png" alt="">' +
    '<div class="txt"><b>Ana ekrana ekle</b><span>Tam ekran, çevrimdışı ve daha hızlı</span></div>' +
    '<button class="go">Yükle</button><button class="x" aria-label="Kapat">✕</button>';
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
    if (c && c.outcome === 'accepted') toast('Kuruluyor…', { kind: 'good' });
    deferredPrompt = null;
    hideInstallBanner();
  }).catch(function () {});
}
function iosInstallGuide() {
  sheet('📲 Ana ekrana ekle', 'Uygulamayı tam ekran ve çevrimdışı kullanmak için:', function (b) {
    [['1️⃣', 'Safari\'de paylaş simgesine dokun', 'Alt çubuktaki ⬆️ simgesi'],
     ['2️⃣', '"Ana Ekrana Ekle"yi seç', 'Listede aşağı kaydırman gerekebilir'],
     ['3️⃣', '"Ekle"ye dokun', 'Uygulama ana ekranında belirir']]
      .forEach(function (r) { b.appendChild(row(r[0], r[1], r[2])); });
    b.insertAdjacentHTML('beforeend',
      '<p class="pwa-note">Not: iOS\'ta bu adım yalnızca Safari üzerinden çalışır. ' +
      'Ekledikten sonra bildirimler de (iOS 16.4+) etkinleştirilebilir.</p>');
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
  showNotification(
    'Bugün birkaç kelime? 🌙',
    w ? (w.w + ' — ' + (w.tr || '') + '  ·  serini bozma!') : 'Serini bozma, 5 dakika yeter.',
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
function downloadOfflinePack() {
  if (!swReg || !swReg.active) { toast('Service Worker henüz hazır değil', { kind: 'bad' }); return; }
  if (!navigator.onLine) { toast('İndirmek için internet gerekli', { kind: 'bad' }); return; }
  swReg.active.postMessage({ type: 'CACHE_ALL' });
  toast('📦 Sözlükler indiriliyor…');
}
function onCacheProgress(done, total) {
  if (cacheBar) cacheBar.style.width = Math.round(done / total * 100) + '%';
}
function onCacheDone() {
  if (cacheBar) cacheBar.style.width = '100%';
  store('pwa_offline_pack', today());
  toast('✅ Çevrimdışı paket hazır — internet olmadan da çalışır', { kind: 'good', duration: 5000 });
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
function favs() { return store(FAV_KEY) || []; }
function favKey(o) { return (o.lang || '') + '|' + (o.w || ''); }
function isFav(o) { return favs().some(function (f) { return favKey(f) === favKey(o); }); }
function addFavorite(o) {
  var list = favs();
  if (list.some(function (f) { return favKey(f) === favKey(o); })) return false;
  o.at = Date.now();
  list.unshift(o);
  store(FAV_KEY, list.slice(0, 500));
  return true;
}
function removeFavorite(o) {
  store(FAV_KEY, favs().filter(function (f) { return favKey(f) !== favKey(o); }));
}
function activeLangCode() {
  var el = qs('.lang-opt.active');
  return el ? el.getAttribute('data-lang') : 'de';
}
function currentCard() {
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

  btn.onclick = function (e) {
    e.stopPropagation();
    var c = currentCard();
    if (!c) return;
    if (isFav(c)) { removeFavorite(c); toast('Favorilerden çıkarıldı'); }
    else { addFavorite(c); vibrate(24); toast('⭐ ' + c.w + ' favorilere eklendi', { kind: 'good' }); }
    syncFavButton();
  };

  var mo = new MutationObserver(syncFavButton);
  try { mo.observe($('frontWord'), { childList: true, characterData: true, subtree: true }); } catch (e) {}
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
  sheet('⭐ Favorilerim', 'Kaydettiğin kelimeler cihazında saklanır.', function (b) {
    var list = favs();
    if (!list.length) {
      b.innerHTML = '<div class="pwa-empty">Henüz favori yok.<br>Kartın sağ üstündeki ☆ ile ekleyebilirsin.</div>';
      return;
    }
    var flags = { de: '🇩🇪', en: '🇬🇧', ar: '🇸🇦', fr: '🇫🇷', es: '🇪🇸', ru: '🇷🇺' };
    list.forEach(function (f) {
      var it = document.createElement('div');
      it.className = 'fav-item';
      it.innerHTML = '<div class="fl">' + (flags[f.lang] || '🏳️') + '</div>' +
        '<div class="w"><b>' + escapeHtml(f.w) + '</b><span>' + escapeHtml(f.tr || '') + '</span></div>' +
        '<button class="rm" aria-label="Sil">✕</button>';
      qs('.rm', it).onclick = function () { removeFavorite(f); it.remove(); syncFavButton(); };
      b.appendChild(it);
    });
    var exp = row('📤', 'Favorileri paylaş / indir', list.length + ' kelime');
    exp.onclick = function () { exportFavorites(); };
    b.appendChild(exp);
  });
}
function exportFavorites() {
  var list = favs();
  var txt = list.map(function (f) { return f.w + ' — ' + (f.tr || ''); }).join('\n');
  var content = 'Lumira · Dil Kartları — Favorilerim (' + today() + ')\n\n' + txt;
  shareOrSave('favorilerim-' + today() + '.txt', content, 'text/plain', 'Favori kelimelerim');
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
    toast('⬇️ ' + filename + ' indirildi', { kind: 'good' });
    return true;
  } catch (e) { logError(e); toast('İndirme başarısız', { kind: 'bad' }); return false; }
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
  var data = {
    title: CONFIG.brand + ' · ' + CONFIG.appName,
    text: '6 dilde kelime kartları, quiz ve seslendirme — çevrimdışı da çalışıyor 🌙',
    url: location.origin + location.pathname
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
      .then(function () { toast('📋 Panoya kopyalandı', { kind: 'good' }); })
      .catch(function () { toast('Kopyalanamadı', { kind: 'bad' }); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('📋 Panoya kopyalandı', { kind: 'good' }); } catch (e) {}
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
    JSON.stringify(dump, null, 2), 'application/json', 'İlerleme yedeğim');
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
        toast('✅ Yedek geri yüklendi, yenileniyor…', { kind: 'good' });
        setTimeout(function () { location.reload(); }, 1200);
      } catch (e) { toast('Dosya okunamadı', { kind: 'bad' }); }
    };
    fr.readAsText(f);
  };
  inp.click();
}

/* ================================ 10 · HATA RAPORU ====================== */
var ERR_KEY = 'lumira_errors_v1';
function logError(err, extra) {
  try {
    var list = store(ERR_KEY) || [];
    list.unshift({
      t: new Date().toISOString(),
      m: (err && (err.message || err.reason || err)) + '',
      s: (err && err.stack ? String(err.stack).slice(0, 900) : ''),
      u: location.href, ua: navigator.userAgent, extra: extra || null
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
    if (e && e.message) logError({ message: e.message, stack: (e.filename || '') + ':' + (e.lineno || '') });
  });
  addEventListener('unhandledrejection', function (e) { logError({ message: 'Promise: ' + (e.reason && e.reason.message || e.reason) }); });
}
function openErrorReport() {
  var list = store(ERR_KEY) || [];
  sheet('🐞 Hata raporu', list.length ? (list.length + ' kayıt bulundu.') : 'Kayıtlı hata yok — her şey yolunda.', function (b) {
    if (!list.length) {
      b.innerHTML = '<div class="pwa-empty">🎉 Hiç hata kaydedilmemiş.</div>';
    } else {
      list.slice(0, 8).forEach(function (e) {
        b.appendChild(row('•', escapeHtml((e.m || '').slice(0, 60)), new Date(e.t).toLocaleString('tr-TR')));
      });
    }
    var snd = row('📤', 'Raporu paylaş / indir', 'Cihaz bilgisi + son hatalar');
    snd.onclick = function () {
      shareOrSave('hata-raporu-' + today() + '.json',
        JSON.stringify({ app: CONFIG.brand, ua: navigator.userAgent, errors: list }, null, 2),
        'application/json', 'Hata raporu');
    };
    b.appendChild(snd);
    var clr = row('🧹', 'Kayıtları temizle', '');
    clr.onclick = function () { store(ERR_KEY, []); toast('Temizlendi'); };
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
    sheet('⭐ Beğendin mi?', 'Uygulamayı puanlaman bize çok yardımcı olur.', function (b) {
      var yes = row('💛', 'Play Store\'da puan ver', '30 saniye sürer');
      yes.onclick = function () {
        store('pwa_rated', true);
        try { location.href = 'market://details?id=' + CONFIG.packageId; } catch (e) {}
        setTimeout(function () { window.open(CONFIG.playUrl, '_blank', 'noopener'); }, 700);
      };
      var later = row('⏰', 'Sonra hatırlat', '1 hafta sonra tekrar sorulur');
      later.onclick = function () { store('pwa_rate_snooze', Date.now()); openSheets[openSheets.length - 1].close(); };
      var never = row('🚫', 'Bir daha sorma', '');
      never.onclick = function () { store('pwa_rate_never', true); openSheets[openSheets.length - 1].close(); };
      b.appendChild(yes); b.appendChild(later); b.appendChild(never);
    });
  }, 3000);
}

/* ================================ 12 · GEÇİŞLER · DEVAM ================= */
function setupTransitions() {
  ['tabCards', 'tabQuiz', 'tabPersonal'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('click', function () {
      var app = qs('.app');
      if (!app) return;
      if (document.startViewTransition) {
        try { document.startViewTransition(function () {}); return; } catch (e) {}
      }
      var view = $('cardsView');
      var target = id === 'tabQuiz' ? $('quizView') : (id === 'tabPersonal' ? $('personalView') : view);
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
  var tab = $('tabQuiz') && $('tabQuiz').classList.contains('active') ? 'quiz'
          : ($('tabPersonal') && $('tabPersonal').classList.contains('active') ? 'personal' : 'cards');
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
      if (deck[i] && deck[i].w === r.word) { target = i; break; }
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
  toast('📖 "' + escapeHtml(r.word) + '"' + pos + ' — kaldığın yerden devam?', {
    action: 'Devam',
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

      /* Dil/seviye değiştiyse deste yeniden kurulur — kısa bir nefes al */
      setTimeout(function () {
        if (applyResume(r)) toast('✅ ' + r.word + ' kartına dönüldü', { kind: 'good' });
        else toast('Bu kart artık listede yok', { kind: 'bad' });
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
  sheet('🌙 Günün kelimesi', today(), function (b) {
    if (!w) {
      b.innerHTML = '<div class="pwa-empty">Kartlar henüz yüklenmedi. Birkaç saniye sonra tekrar dene.</div>';
      return;
    }
    var card = document.createElement('div');
    card.className = 'pwa-row';
    card.innerHTML = '<div class="ic">📘</div><div class="tx"><b style="font-size:19px">' +
      escapeHtml(w.w || '') + '</b><span style="font-size:13px">' + escapeHtml(w.tr || w.t || '') + '</span></div>';
    b.appendChild(card);

    var listen = row('🔊', 'Dinle', 'Telaffuzu seslendir');
    listen.onclick = function () {
      try {
        if (typeof window.speakNative === 'function') {
          var map = { de: 'de-DE', en: 'en-US', ar: 'ar-SA', fr: 'fr-FR', es: 'es-ES', ru: 'ru-RU' };
          window.speakNative(w.w, map[w.lang || activeLangCode()] || 'de-DE', 0.92, function () {});
        }
      } catch (e) { logError(e); }
    };
    b.appendChild(listen);

    var fav = row('⭐', 'Favorilere ekle', '');
    fav.onclick = function () { addFavorite({ w: w.w, tr: w.tr || '', lang: w.lang || activeLangCode() }); toast('⭐ Eklendi', { kind: 'good' }); };
    b.appendChild(fav);

    var sh = row('📤', 'Paylaş', 'Arkadaşına gönder');
    sh.onclick = function () {
      var txt = w.w + ' — ' + (w.tr || '') + '\n' + CONFIG.brand + ' · ' + CONFIG.appName;
      if (navigator.share) navigator.share({ text: txt, url: location.origin + location.pathname }).catch(function () {});
      else copyText(txt);
    };
    b.appendChild(sh);
  });
  updateWidgetData(w);
}
function updateWidgetData(w) {
  if (!w) return;
  store('lumira_daily_word', { date: today(), w: w.w, tr: w.tr || '', lang: w.lang || activeLangCode() });
  try {
    if ('widgets' in navigator) {
      /* Windows Widgets Board / desteklenen platformlar */
      navigator.widgets.updateByTag && navigator.widgets.updateByTag('daily-word', {
        template: 'daily-word', data: JSON.stringify({ word: w.w, translation: w.tr || '' })
      });
    }
  } catch (e) {}
}

/* ================================ AYARLAR PANELİ ======================== */
function setupFab() {
  if ($('pwa-fab')) return;
  var fab = document.createElement('div');
  fab.id = 'pwa-fab';
  fab.setAttribute('role', 'button');
  fab.title = 'Uygulama ayarları';
  fab.innerHTML = '⚙️';
  document.body.appendChild(fab);
  fab.onclick = openSettings;
  /* Splash açıkken gizli kalsın */
  var sp = $('splash');
  if (sp && !sp.classList.contains('hidden')) {
    fab.classList.add('hidden');
    var obs = new MutationObserver(function () {
      if (sp.classList.contains('hidden')) { fab.classList.remove('hidden'); obs.disconnect(); }
    });
    obs.observe(sp, { attributes: true, attributeFilter: ['class'] });
  }
}

function openSettings() {
  sheet('⚙️ Uygulama', CONFIG.brand + ' · ' + CONFIG.appName + (isStandalone ? ' · uygulama modu' : ''), function (b) {

    /* --- Bildirimler ------------------------------------------------- */
    var s = reminderSettings();
    var permOk = notifyState() === 'granted';
    var notifRow = row('🔔', 'Günlük hatırlatma',
      permOk ? (s.on ? 'Her gün ' + pad(s.hour) + ':' + pad(s.min) : 'Kapalı') : 'İzin gerekiyor',
      '<div class="pwa-switch' + (s.on && permOk ? ' on' : '') + '"></div>');
    notifRow.onclick = function () {
      askNotifyPermission().then(function (p) {
        if (p !== 'granted') { toast('Bildirim izni verilmedi', { kind: 'bad' }); return; }
        var cur = reminderSettings();
        cur.on = !cur.on;
        saveReminder(cur);
        qs('.pwa-switch', notifRow).classList.toggle('on', cur.on);
        qs('.tx span', notifRow).textContent = cur.on ? 'Her gün ' + pad(cur.hour) + ':' + pad(cur.min) : 'Kapalı';
        if (cur.on) { subscribePush(); toast('🔔 Hatırlatma açıldı', { kind: 'good' }); }
      });
    };
    b.appendChild(notifRow);

    var timeRow = row('⏰', 'Hatırlatma saati', 'Bildirimin geleceği saat',
      '<input class="pwa-time" type="time" value="' + pad(s.hour) + ':' + pad(s.min) + '">');
    var inp = qs('.pwa-time', timeRow);
    inp.onclick = function (e) { e.stopPropagation(); };
    inp.onchange = function () {
      var parts = inp.value.split(':');
      var cur = reminderSettings();
      cur.hour = parseInt(parts[0], 10) || 20;
      cur.min = parseInt(parts[1], 10) || 0;
      saveReminder(cur);
      toast('Saat güncellendi: ' + inp.value, { kind: 'good' });
    };
    b.appendChild(timeRow);

    var testRow = row('📨', 'Test bildirimi gönder', 'Çalışıyor mu diye bak');
    testRow.onclick = function () {
      askNotifyPermission().then(function (p) {
        if (p !== 'granted') { toast('Önce izin ver', { kind: 'bad' }); return; }
        showNotification('Merhaba! 👋', 'Bildirimler çalışıyor. İyi çalışmalar!', './?src=notification&tab=cards');
      });
    };
    b.appendChild(testRow);

    /* --- Çevrimdışı --------------------------------------------------- */
    var packRow = row('📦', 'Çevrimdışı paketi indir', '6 dilin tüm sözlükleri (~5 MB)');
    var bar = document.createElement('div');
    bar.className = 'pwa-progress';
    bar.innerHTML = '<i></i>';
    cacheBar = qs('i', bar);
    packRow.onclick = function () { downloadOfflinePack(); };
    b.appendChild(packRow); b.appendChild(bar);
    if (store('pwa_offline_pack')) cacheBar.style.width = '100%';

    estimateStorage().then(function (st) {
      if (!st) return;
      var r = row('💾', 'Kullanılan alan', mb(st.used) + ' / ' + mb(st.quota));
      r.style.cursor = 'default';
      b.insertBefore(r, packRow.nextSibling);
    });

    /* --- Favoriler & veri --------------------------------------------- */
    var favRow = row('⭐', 'Favorilerim', favs().length + ' kelime');
    favRow.onclick = function () { openFavorites(); };
    b.appendChild(favRow);

    var exp = row('⬇️', 'İlerlememi yedekle', 'JSON dosyası indir veya paylaş');
    exp.onclick = exportAllData;
    b.appendChild(exp);

    var imp = row('⬆️', 'Yedekten geri yükle', 'Daha önce indirdiğin dosyayı seç');
    imp.onclick = importData;
    b.appendChild(imp);

    var shr = row('🔗', 'Uygulamayı paylaş', 'Arkadaşlarına gönder');
    shr.onclick = shareApp;
    b.appendChild(shr);

    /* --- Kurulum / güncelleme ----------------------------------------- */
    if (!isStandalone) {
      var ins = row('📲', 'Ana ekrana ekle', 'Tam ekran, hızlı ve çevrimdışı');
      ins.onclick = doInstall;
      b.appendChild(ins);
    }

    var upd = row('🔄', 'Güncellemeleri denetle', 'Sürüm: ' + (store('pwa_version') || 'v1.0.0'));
    upd.onclick = function () {
      if (!swReg) { toast('Service Worker yok'); return; }
      toast('Denetleniyor…');
      swReg.update().then(function () {
        setTimeout(function () {
          if (!waitingWorker) toast('✅ En güncel sürümdesin', { kind: 'good' });
        }, 2500);
      }).catch(function () { toast('Denetlenemedi', { kind: 'bad' }); });
    };
    b.appendChild(upd);

    var bug = row('🐞', 'Hata raporu', 'Sorun mu var? Rapor gönder');
    bug.onclick = openErrorReport;
    b.appendChild(bug);

    var rate = row('💛', 'Puan ver', 'Play Store\'da değerlendir');
    rate.onclick = function () {
      store('pwa_rated', true);
      try { location.href = 'market://details?id=' + CONFIG.packageId; } catch (e) {}
      setTimeout(function () { window.open(CONFIG.playUrl, '_blank', 'noopener'); }, 700);
    };
    b.appendChild(rate);

    b.insertAdjacentHTML('beforeend',
      '<p class="pwa-note">' + CONFIG.brand + ' · ' + CONFIG.appName +
      ' — çevrimdışı çalışır, verilerin cihazında saklanır.<br>' +
      'Toplam açılış: ' + (store('pwa_opens') || 1) + '</p>');
  });
}
function pad(n) { return String(n).padStart(2, '0'); }

/* ============================================================ BAŞLAT ==== */

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
  try {
    /* açılış sayacı */
    var opens = (store('pwa_opens') || 0) + 1;
    store('pwa_opens', opens);
    if (!store('pwa_first_open')) store('pwa_first_open', Date.now());

    setupErrorReporting();
    registerSW();
    setupShell();
    setupBackButton();
    setupInstall();
    setupFab();
    setupTransitions();
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
  isStandalone: function () { return isStandalone; }
};

})();
