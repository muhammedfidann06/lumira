/* ============================================================================
   splash.js — Lumira | Dil Kartları
   Animasyonlu açılış (splash) + başlangıç kontrolleri + routing + onboarding.
   TAMAMEN KATMAN (overlay) olarak çalışır; mevcut uygulama mantığına dokunmaz.
   Akış:  Splash → kontroller → (eski kullanıcı → Ana uygulama)
                              → (yeni kullanıcı → Hoş geldin / dil / seviye → Ana uygulama)
   ========================================================================== */
(function () {
  'use strict';
  if (window.__lumBootDone) return;          /* iki kez çalışmasın (race koruması) */
  window.__lumBootDone = true;

  var ONBOARD_KEY = 'lumira_onboarded_v1';
  var MIN_SPLASH  = 1100;   /* logo animasyonu nefes alsın */
  var MAX_SPLASH  = 3000;   /* asla sonsuz beklemez */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var GREETINGS = [
    { t: 'Hallo',  l: 'de' }, { t: 'Hello', l: 'en' }, { t: 'Bonjour', l: 'fr' },
    { t: 'Hola',   l: 'es' }, { t: 'Привет', l: 'ru' }, { t: 'مرحبا',  l: 'ar' }
  ];
  var LANGS = [
    { c: 'de', flag: '🇩🇪', name: 'Almanca' }, { c: 'en', flag: '🇬🇧', name: 'İngilizce' },
    { c: 'fr', flag: '🇫🇷', name: 'Fransızca' }, { c: 'es', flag: '🇪🇸', name: 'İspanyolca' },
    { c: 'ar', flag: '🇸🇦', name: 'Arapça' }, { c: 'ru', flag: '🇷🇺', name: 'Rusça' }
  ];
  var LEVELS = ['A1', 'A2', 'B1', 'B2'];

  /* ------------------------------------------------------------- stiller -- */
  function injectCss() {
    if (document.getElementById('lumBootCss')) return;
    /* iki font: Fraunces + DM Mono (JS ile, render'ı bloklamaz) */
    var fl = document.createElement('link');
    fl.rel = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(fl);

    var s = document.createElement('style'); s.id = 'lumBootCss';
    s.textContent = [
      ':root{--lb-bg:#0d1016;--lb-panel:#141a24;--lb-ink:#eef1f6;--lb-dim:#8b93a3;',
      '--lb-line:#242c38;--lb-acc:#5f8fd6;--lb-r:6px;',
      '--lb-serif:"Fraunces",Georgia,"Times New Roman",serif;',
      '--lb-mono:"DM Mono",ui-monospace,"SFMono-Regular",Menlo,monospace;}',

      '#lumSplash,#lumOnb{position:fixed;inset:0;z-index:99999;background:var(--lb-bg);',
      'display:flex;align-items:center;justify-content:center;',
      'padding:calc(env(safe-area-inset-top) + 20px) 22px calc(env(safe-area-inset-bottom) + 20px);',
      'opacity:1;transition:opacity .38s ease;overflow:hidden;color:var(--lb-ink);}',
      '#lumSplash.lb-out,#lumOnb.lb-out{opacity:0;pointer-events:none;}',

      /* süzülen selamlama sözcükleri */
      '.lb-word{position:absolute;font-family:var(--lb-mono);font-size:13px;letter-spacing:.04em;',
      'color:var(--lb-dim);opacity:0;white-space:nowrap;will-change:transform,opacity;}',
      '@keyframes lbDrift{0%{opacity:0;transform:translateY(14px)}',
      '18%{opacity:.5}82%{opacity:.5}100%{opacity:0;transform:translateY(-14px)}}',

      /* splash logo */
      '.lb-logo{position:relative;z-index:2;text-align:center;}',
      '.lb-logo img{width:132px;height:132px;border-radius:26px;display:block;margin:0 auto;',
      'opacity:0;transform:scale(.86);}',
      '.lb-logo.lb-in img{animation:lbLogo 1000ms cubic-bezier(.2,.7,.2,1) forwards;}',
      '@keyframes lbLogo{0%{opacity:0;transform:scale(.86)}60%{opacity:1;transform:scale(1.04)}',
      '100%{opacity:1;transform:scale(1)}}',
      '.lb-logo.lb-float img{animation:lbLogo 1000ms cubic-bezier(.2,.7,.2,1) forwards, lbFloat 3.6s ease-in-out 1000ms infinite;}',
      '@keyframes lbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}',
      '.lb-tag{margin-top:18px;font-family:var(--lb-mono);font-size:11px;letter-spacing:.34em;',
      'text-transform:uppercase;color:var(--lb-dim);opacity:0;transition:opacity .5s ease .5s;}',
      '.lb-logo.lb-in .lb-tag{opacity:1;}',

      /* onboarding panel */
      '.lb-panel{position:relative;z-index:2;width:100%;max-width:440px;}',
      '.lb-step{opacity:0;transform:translateY(10px);transition:opacity .32s ease, transform .32s ease;',
      'display:none;}',
      '.lb-step.on{display:block;opacity:1;transform:none;}',
      '.lb-eyebrow{font-family:var(--lb-mono);font-size:11px;letter-spacing:.28em;text-transform:uppercase;',
      'color:var(--lb-acc);margin-bottom:16px;}',
      '.lb-h{font-family:var(--lb-serif);font-weight:600;font-size:34px;line-height:1.06;',
      'letter-spacing:-.01em;margin:0 0 12px;}',
      '.lb-p{color:var(--lb-dim);font-size:15.5px;line-height:1.5;margin:0 0 26px;max-width:34ch;',
      'font-family:var(--lb-serif);}',
      '.lb-cta{display:block;width:100%;border:none;cursor:pointer;font-family:var(--lb-mono);',
      'font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:var(--lb-bg);',
      'background:var(--lb-ink);border-radius:var(--lb-r);padding:15px 18px;transition:background .2s;}',
      '.lb-cta:hover{background:var(--lb-acc);color:#fff;}',
      '.lb-cta[disabled]{opacity:.4;cursor:default;}',

      /* seçenek ızgarası (dil / seviye) */
      '.lb-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:26px;}',
      '.lb-opt{display:flex;align-items:center;gap:11px;padding:14px 15px;cursor:pointer;',
      'border:1px solid var(--lb-line);border-radius:var(--lb-r);background:var(--lb-panel);',
      'color:var(--lb-ink);font-family:var(--lb-serif);font-size:16px;transition:border-color .15s, background .15s;}',
      '.lb-opt:hover{border-color:var(--lb-acc);}',
      '.lb-opt.sel{border-color:var(--lb-acc);background:#182230;}',
      '.lb-opt .fl{font-size:20px;line-height:1;}',
      '.lb-lv{grid-template-columns:1fr 1fr;}',
      '.lb-lv .lb-opt{justify-content:center;font-family:var(--lb-mono);letter-spacing:.08em;}',
      '.lb-steps{display:flex;gap:6px;margin-top:22px;}',
      '.lb-dot{height:3px;flex:1;background:var(--lb-line);border-radius:2px;transition:background .3s;}',
      '.lb-dot.on{background:var(--lb-acc);}',

      reduce ? '*{animation:none!important;transition:opacity .2s ease!important;}' : ''
    ].join('');
    document.head.appendChild(s);
  }

  /* ------------------------------------------------- süzülen sözcükler --- */
  function seedWords(host) {
    if (reduce) return;
    var W = host.clientWidth || window.innerWidth, H = host.clientHeight || window.innerHeight;
    GREETINGS.forEach(function (g, i) {
      var el = document.createElement('span');
      el.className = 'lb-word'; el.textContent = g.t;
      var x = 8 + Math.random() * 76, y = 12 + Math.random() * 72;
      el.style.left = x + '%'; el.style.top = y + '%';
      var dur = 5 + Math.random() * 3, delay = i * 0.5;
      el.style.animation = 'lbDrift ' + dur + 's ease-in-out ' + delay + 's infinite';
      host.appendChild(el);
    });
  }

  /* ------------------------------------------------ uygulamayı göster ---- */
  function revealApp() {
    var sp = document.getElementById('lumSplash');
    if (sp) { sp.classList.add('lb-out'); setTimeout(function () { sp.remove(); }, 420); }
  }

  /* ------------------------------------------------ başlangıç kontrol ---- */
  function authResolved(cb) {
    var done = false, finish = function () { if (!done) { done = true; cb(); } };
    /* Firebase yüklüyse ilk auth durumunu bekle, değilse hemen geç */
    try {
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
        var un = firebase.auth().onAuthStateChanged(function () { try { un(); } catch (e) {} finish(); },
          function () { finish(); });
      } else { setTimeout(function () { authResolved(cb); }, 250); return; }
    } catch (e) { finish(); }
    setTimeout(finish, MAX_SPLASH);           /* güvenlik: asla asılı kalma */
  }

  function isReturning() {
    try {
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length &&
          firebase.auth().currentUser) return true;
    } catch (e) {}
    return false;
  }
  function isOnboarded() { try { return !!localStorage.getItem(ONBOARD_KEY); } catch (e) { return false; } }

  /* ---------------------------------------------------------- routing ---- */
  function decideRoute() {
    if (isReturning() || isOnboarded()) {
      /* eski/giriş yapmış kullanıcı: bir daha onboarding görmesin (çevrimdışı da) */
      try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
      revealApp(); return;                                        /* → ana uygulama */
    }
    startOnboarding();                                            /* yeni kullanıcı → onboarding */
  }

  /* --------------------------------------------------------- onboarding -- */
  function applyChoice(lang, level) {
    /* mevcut arayüzün kendi handler'larını tetikleyerek uygula (mantık kopyalamıyoruz) */
    try {
      var lo = document.querySelector('.lang-opt[data-lang="' + lang + '"]');
      if (lo) lo.click();
    } catch (e) {}
    if (level) {
      var tries = 0;
      (function setLvl() {
        var btns = document.querySelectorAll('.level-opt');
        for (var i = 0; i < btns.length; i++) {
          if ((btns[i].textContent || '').trim().toUpperCase() === level) { btns[i].click(); return; }
        }
        if (tries++ < 10) setTimeout(setLvl, 300);   /* levelBox sonradan dolabilir */
      })();
    }
    try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
  }

  function startOnboarding() {
    var sp = document.getElementById('lumSplash');
    var ob = document.createElement('div'); ob.id = 'lumOnb'; ob.setAttribute('role', 'dialog');
    var words = document.createElement('div'); words.style.cssText = 'position:absolute;inset:0;';
    ob.appendChild(words);
    var panel = document.createElement('div'); panel.className = 'lb-panel'; ob.appendChild(panel);

    var chosen = { lang: null, level: null };
    var stepEls = [];

    function step(html) { var d = document.createElement('div'); d.className = 'lb-step'; d.innerHTML = html; panel.appendChild(d); stepEls.push(d); return d; }

    /* 0 — hoş geldin */
    var s0 = step(
      '<div class="lb-eyebrow">Lumira · Dil Kartları</div>' +
      '<h1 class="lb-h">Hoş geldin</h1>' +
      '<p class="lb-p">Yeni dil. Yeni kelimeler. Yeni sen. 40.000\u2019den fazla kelime kartı seni bekliyor.</p>' +
      '<button class="lb-cta" data-go="1">Başlayalım</button>');

    /* 1 — dil */
    var s1 = step(
      '<div class="lb-eyebrow">Adım 1 / 2</div>' +
      '<h1 class="lb-h">Ne öğrenmek istiyorsun?</h1>' +
      '<div class="lb-grid" id="lbLangs"></div>' +
      '<button class="lb-cta" data-go="2" disabled>Devam</button>');
    var lg = s1.querySelector('#lbLangs');
    LANGS.forEach(function (L) {
      var o = document.createElement('div'); o.className = 'lb-opt';
      o.innerHTML = '<span class="fl">' + L.flag + '</span>' + L.name;
      o.onclick = function () {
        chosen.lang = L.c;
        lg.querySelectorAll('.lb-opt').forEach(function (x) { x.classList.remove('sel'); });
        o.classList.add('sel'); s1.querySelector('.lb-cta').removeAttribute('disabled');
      };
      lg.appendChild(o);
    });

    /* 2 — seviye */
    var s2 = step(
      '<div class="lb-eyebrow">Adım 2 / 2</div>' +
      '<h1 class="lb-h">Seviyen nedir?</h1>' +
      '<div class="lb-grid lb-lv" id="lbLevels"></div>' +
      '<button class="lb-cta" data-go="3" disabled>Devam</button>');
    var lv = s2.querySelector('#lbLevels');
    LEVELS.forEach(function (L) {
      var o = document.createElement('div'); o.className = 'lb-opt'; o.textContent = L;
      o.onclick = function () {
        chosen.level = L;
        lv.querySelectorAll('.lb-opt').forEach(function (x) { x.classList.remove('sel'); });
        o.classList.add('sel'); s2.querySelector('.lb-cta').removeAttribute('disabled');
      };
      lv.appendChild(o);
    });

    /* 3 — hazır */
    var s3 = step(
      '<div class="lb-eyebrow">Hazırsın</div>' +
      '<h1 class="lb-h">Öğrenme yolculuğun<br>şimdi başlıyor.</h1>' +
      '<p class="lb-p">Seçtiğin dille ilk kartına birazdan bakacaksın. Dilediğinde dili ve seviyeni değiştirebilirsin.</p>' +
      '<button class="lb-cta" data-go="done">Lumira\u2019ya Başla</button>');

    /* adım göstergesi */
    var dots = document.createElement('div'); dots.className = 'lb-steps';
    for (var i = 0; i < 4; i++) { var d = document.createElement('i'); d.className = 'lb-dot'; dots.appendChild(d); }
    panel.appendChild(dots);

    var cur = 0;
    function show(n) {
      stepEls.forEach(function (el, k) { el.classList.toggle('on', k === n); });
      dots.querySelectorAll('.lb-dot').forEach(function (dd, k) { dd.classList.toggle('on', k <= n); });
      cur = n;
    }
    panel.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-go]'); if (!b) return;
      var go = b.getAttribute('data-go');
      if (go === 'done') { finishOnboarding(); return; }
      show(parseInt(go, 10));
    });

    document.body.appendChild(ob);
    seedWords(words);
    /* splash'tan onboarding'e yumuşak geçiş */
    if (sp) { sp.classList.add('lb-out'); setTimeout(function () { sp.remove(); }, 420); }
    requestAnimationFrame(function () { show(0); });

    function finishOnboarding() {
      applyChoice(chosen.lang || 'de', chosen.level);
      ob.classList.add('lb-out');
      setTimeout(function () { ob.remove(); }, 420);
    }
  }

  /* ------------------------------------------------------------ başlat --- */
  function run() {
    injectCss();
    var sp = document.getElementById('lumSplash');
    if (!sp) { decideRoute(); return; }         /* overlay yoksa yine de yönlendir */
    var logo = sp.querySelector('.lb-logo');
    var words = sp.querySelector('.lb-words');
    if (words) seedWords(words);
    if (logo) { logo.classList.add('lb-in'); if (!reduce) logo.classList.add('lb-float'); }

    var t0 = Date.now(), checksDone = false;
    authResolved(function () { checksDone = true; maybeGo(); });
    setTimeout(function () { checksDone = true; maybeGo(); }, MAX_SPLASH);

    function maybeGo() {
      if (!checksDone) return;
      var wait = Math.max(0, MIN_SPLASH - (Date.now() - t0));
      setTimeout(decideRoute, wait);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
