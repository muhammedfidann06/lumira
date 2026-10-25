/* ============================================================================
   support-badges.js — Lumira | Dil Kartları
   ----------------------------------------------------------------------------
   · ❤️ Destek ekranı (bağış tutarları — ödeme Play Store üzerinden yapılacak)
   · Destek rozetleri ve XP ödülleri
   · Seviye/rozet kilitleri (Profilim, Çevrimdışı paket, PDF)
   · Kelime listesini kitap düzeninde PDF olarak dışa aktarma

   Play Billing makbuzları sunucuda doğrulanır. Günlük kullanım hakları
   hesap bazında; PDF ve çevrim dışı erişim rozet ekranına bağlıdır.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'lumira_support_v1';

  /* --------------------------------------------------------- rozet tablosu */
  var TIERS = [
    { amount: 1,   badge: '👍🏻', name: 'Teşekkür',  xp: 10,   try_: '59,95',   sku: 'lumira_support_1_monthly', legacySku:'lumira_support_1'   },
    { amount: 5,   badge: '☕️', name: 'Kahve',     xp: 50,   try_: '299,95',  sku: 'lumira_support_5_monthly', legacySku:'lumira_support_5'   },
    { amount: 10,  badge: '❤️', name: 'Destekçi',  xp: 100,  try_: '599,95',  sku: 'lumira_support_10_monthly', legacySku:'lumira_support_10'  },
    { amount: 25,  badge: '💛', name: 'Dost',      xp: 250,  try_: '1499,95', sku: 'lumira_support_25_monthly', legacySku:'lumira_support_25'  },
    { amount: 50,  badge: '⭐️', name: 'Yıldız',    xp: 500,  try_: '2999,95', sku: 'lumira_support_50_monthly', legacySku:'lumira_support_50'  },
    { amount: 100, badge: '👑', name: 'Kral',    xp: 1000, try_: '5999,95', sku: 'lumira_support_100' }
  ];
  /* PDF için gereken rozetler */
  var PDF_BADGES = ['💛', '⭐️', '👑'];

  /* Rozet adını kullanıcının ANA diline göre döner (I18N.tier_names, sku ile
     eşleşir); çeviri yoksa TIERS tablosundaki Türkçe ada düşer. */
  function tierName(t){
    try{
      var lang = (typeof NATIVE_LANG !== 'undefined' && NATIVE_LANG) || 'tr';
      var names = window.I18N && window.I18N[lang] && window.I18N[lang].tier_names;
      if(names && names[t.legacySku||t.sku]) return names[t.legacySku||t.sku];
    }catch(e){}
    return t.name;
  }

  function store(k, v) {
    try {
      if (v === undefined) { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }
      if(window.LUMIRA_CLEARING_DATA)return null;
      localStorage.setItem(k, JSON.stringify(v)); return v;
    } catch (e) { return null; }
  }
  function account(){try{return window.firebase.auth().currentUser?.uid||'';}catch(e){return'';}}
  function myBadges(){
    const uid=account();if(!uid)return[];
    const policy=window.LUMIRA_FEATURES?.entitlement();
    if(Array.isArray(policy?.supportAmounts))return TIERS.filter(t=>policy.supportAmounts.includes(t.amount)).map(t=>t.badge);
    const revoked=policy?.revokedSupport||[];
    return (store(KEY+'_'+uid)||[]).filter(b=>!TIERS.some(t=>t.badge===b && revoked.includes(t.amount)));
  }
  function saveBadges(list){const uid=account();if(uid)store(KEY+'_'+uid,list);}
  function revoked(amount){return !!window.LUMIRA_FEATURES?.entitlement()?.revokedSupport?.includes(amount);}

  function hasBadge(b) { return myBadges().indexOf(b) > -1; }
  function hasAnyPdfBadge() { return PDF_BADGES.some(hasBadge); }
  function myLevel() {
    try { return (typeof window.PR_getLevel === 'function') ? window.PR_getLevel() : 1; }
    catch (e) { return 1; }
  }
  function toast(m, o) {
    if (window.PWA && window.PWA.toast) return window.PWA.toast(m, o);
    return function () {};
  }

  /* Ödeme onaylandığında çağrılacak tek kapı.
     Play Store satın alma akışı buraya bağlanacak. */
  window.grantSupportTier = function (amount) {
    var t = null;
    for (var i = 0; i < TIERS.length; i++) if (TIERS[i].amount === amount) t = TIERS[i];
    if (!t || revoked(amount)) return false;
    var list = myBadges();
    if (list.indexOf(t.badge) === -1) { list.push(t.badge); saveBadges(list); }
    try { if (typeof window.PR_addXp === 'function') window.PR_addXp(t.xp, tierName(t)); } catch (e) {}
    toast((window.t ? window.t('purchase_success_toast')(t.badge, tierName(t), t.xp) : (t.badge + ' ' + t.name + ' rozeti kazandın · +' + t.xp + ' XP')), { kind: 'good', duration: 6000 });
    return true;
  };
  window.LUMIRA_BADGES = { list: myBadges, has: hasBadge, tiers: TIERS };

  /* Play: five monthly subscriptions plus one lifetime Crown. Old one-time
     identifiers remain accepted by the server for purchase restoration. */
  let purchaseInFlight=false;
  function purchaseTier(t) {
    var purchaseUid = null;
    try { purchaseUid = window.firebase.auth().currentUser.uid; } catch (e) {}
    if (!purchaseUid) {
      toast(window.LUMIRA_FEATURES ? window.LUMIRA_FEATURES.text('login_required') : 'Önce hesabına giriş yap.', { kind: 'bad' });
      return;
    }
    /* isTwa yerine DOĞRUDAN gerçek yeteneği kontrol ediyoruz: PaymentRequest +
       getDigitalGoodsService sadece gerçek, Play Billing'e bağlı bir TWA
       içinde var olur. isTwa referrer'a dayandığı için bazı Android/Chrome
       sürümlerinde yanlışlıkla false çıkabiliyordu (bilinen sorun) — bu,
       gerçek satın alma kararını etkilememesi için doğrudan API varlığına
       bakıyoruz, daha güvenilir. */
    if (!window.LUMIRA_PLAY.isNative()) {
      return window.LUMIRA_BILLING?.purchase(t.amount);
    }
    if(!window.PaymentRequest||typeof window.getDigitalGoodsService!=='function'){toast(window.LUMIRA_PLAY.text(5),{kind:'bad'});return;}
    if(!window.LUMIRA_PLAY.canPurchase(t.sku)){toast(window.LUMIRA_PLAY.text(3),{kind:'bad'});window.LUMIRA_PLAY.catalog({refresh:true}).catch(()=>{});return;}
    if(purchaseInFlight)return;
    if(revoked(t.amount)){toast(({tr:'Bu rozet hesabında yönetici tarafından kaldırıldı.',en:'An administrator has removed this badge from your account.',de:'Dieses Abzeichen wurde von einem Administrator aus deinem Konto entfernt.',ar:'أزال المسؤول هذه الشارة من حسابك.',fr:'Un administrateur a retiré ce badge de ton compte.',es:'Un administrador ha retirado esta insignia de tu cuenta.',ru:'Администратор удалил этот значок из твоего аккаунта.'})[window.NATIVE_LANG||'tr']||'An administrator has removed this badge from your account.',{kind:'bad'});return;}
    const policy=window.LUMIRA_FEATURES?.entitlement(),purchaseSku=window.LUMIRA_PLAY.purchaseSku?.(t.sku)||t.sku;
    const ownedPurchase=window.LUMIRA_PLAY.ownedPurchase?.(t.sku);
    if(ownedPurchase){
      purchaseInFlight=true;
      return window.LUMIRA_FEATURES.verifyPurchase(purchaseSku,ownedPurchase.purchaseToken,purchaseUid).then(()=>{toast(window.LUMIRA_FEATURES.text('restored'),{kind:'good'});window.LUMIRA_FEATURES.api('status').catch(()=>{});}).catch(e=>toast(window.LUMIRA_FEATURES.text(e.featureCode||'purchase_verification_unavailable'),{kind:'bad'})).finally(()=>{purchaseInFlight=false;});
    }
    const renewing=policy?.memberships?.flatMap(row=>Array.isArray(row?.sources)?row.sources:[]).filter(source=>source?.renewsAt&&!source.cancelAt&&source.active)||[];
    // Native subscription changes use Play's documented replacement fields.
    // A Paddle subscription must be managed through its own customer portal.
    if(renewing.some(source=>source.provider==='paddle')){toast(window.LUMIRA_BILLING.text(22),{kind:'bad'});window.PWA.openProfile();return;}
    const replacementFailure=window.LUMIRA_PLAY.replacementFailure?.();if(replacementFailure&&t.amount!==100){toast(window.LUMIRA_FEATURES.text(replacementFailure),{kind:'bad'});return;}
    const replace=t.amount===100?null:window.LUMIRA_PLAY.replacement?.();
    if(renewing.length&&(t.amount===100||!replace)){toast(window.LUMIRA_BILLING.text(22),{kind:'bad'});window.PWA.openProfile();return;}

    const paymentData={sku:purchaseSku};if(replace){paymentData.oldSku=replace.itemId;paymentData.purchaseToken=replace.purchaseToken;paymentData.replacementMode='withTimeProration';}
    var methodData = [{ supportedMethods: 'https://play.google.com/billing', data: paymentData }];
    var details = { total: { label: (window.t ? window.t('purchase_total_label') : 'Toplam'), amount: { currency: 'TRY', value: '0' } } };
    var request;
    try { request = new PaymentRequest(methodData, details); }
    catch (e) { window.PWA?.logError?.({message:'Play request ('+t.sku+'): '+(e.name||'failed'),stack:''});toast(window.t?window.t('purchase_start_failed'):'Satın alma başlatılamadı.', { kind: 'bad' }); return; }

    purchaseInFlight=true;
    let shown;try{shown=request.show();}catch(e){purchaseInFlight=false;window.PWA?.logError?.({message:'Play show ('+t.sku+'): '+window.LUMIRA_PLAY.reason(e),stack:''});toast(window.LUMIRA_PLAY.text(7),{kind:'bad'});return;}
    return shown.then(async function (response) {
      let paymentDetails=response.details;try{if(typeof paymentDetails==='string')paymentDetails=JSON.parse(paymentDetails);}catch{paymentDetails=null;}
      const token=paymentDetails?.purchaseToken || paymentDetails?.token;
      try {
        if(!token || !window.LUMIRA_FEATURES)throw new Error('purchase_verification_unavailable');
        await window.LUMIRA_FEATURES.verifyPurchase(purchaseSku,token,purchaseUid);
        try{await response.complete('success');}catch(ignore){}
        if(window.firebase.auth().currentUser?.uid!==purchaseUid)return;
        window.grantSupportTier(t.amount);
        window.dispatchEvent(new Event('lumira:purchaseverified'));
        window.LUMIRA_FEATURES.api('status').catch(()=>{});
      }catch(e){
        window.PWA?.logError?.({message:'Play verify ('+t.sku+'): '+(e.featureCode||e.code||e.name||'failed'),stack:''});
        try{await response.complete('fail');}catch(ignore){}
        toast(window.LUMIRA_FEATURES?.text(e.featureCode||'purchase_verification_unavailable') || e.message,{kind:'bad',duration:8000});
      }
    }).catch(function(e){
      // AbortError also covers native billing failures. Keep a sanitized
      // diagnostic; never log the response details or purchase token.
      window.LUMIRA_PLAY.catalog({refresh:true}).catch(()=>{});
      const reason=window.LUMIRA_PLAY.reason(e);
      window.PWA?.logError?.({message:'Play checkout ('+t.sku+' → '+purchaseSku+'): '+reason,stack:''});
      if(reason==='usercanceled')return;
      toast(reason==='itemunavailable'?window.LUMIRA_PLAY.text(2):window.LUMIRA_PLAY.text(7),{kind:'bad',duration:6000});
    }).finally(()=>{purchaseInFlight=false;});
  }
  window.purchaseSupportTier = purchaseTier;

  /* ============================================================ DESTEK OL */
  function openSupport() {
    if(!window.LUMIRA_PLAY.isNative() && window.LUMIRA_ACCESS)return window.LUMIRA_ACCESS.open('shop');
    if (!(window.PWA && window.PWA.sheet)) return;
    window.PWA.sheet(window.t?window.t('support_title'):'❤️ Lumira\'yı Destekle', '', function (b) {
      var grid = document.createElement('div');
      grid.className = 'sup-grid';

      const native=window.LUMIRA_PLAY.isNative();
      const storeCards=[];
      TIERS.forEach(function (t) {
        var owned = hasBadge(t.badge);
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'sup-item' + (owned ? ' owned' : '');
        el.innerHTML =
          '<span class="sup-amount">' + tierName(t) + '</span>' +
          '<span class="sup-eur">' + window.LUMIRA_BILLING.text(native?(t.amount===100?3:4):28) + '</span>' +
          '<span class="sup-badge">' + t.badge + '</span>' +
          '<span class="sup-xp">+' + t.xp + ' XP</span>';
        el.disabled=native;
        if(native){const price=document.createElement('span');price.className='sup-store-price';price.style.cssText='display:block;font-size:14px;line-height:1.6;margin:6px 0;color:#b9f4df';price.textContent=window.LUMIRA_BILLING.text(24);el.append(price);storeCards.push({t,el,price});}
        el.onclick = function () { purchaseTier(t); };
        grid.appendChild(el);
      });
      b.appendChild(grid);
      if(native){
        const status=document.createElement('p'),retry=document.createElement('button'),setup=document.createElement('button');let admin=false,setupRelevant=false;
        status.className='pwa-note';status.dataset.storeStatus='';status.setAttribute('role','status');retry.type='button';retry.dataset.storeRetry='';retry.className='pwa-btn';retry.textContent=window.LUMIRA_PLAY.text(4);retry.hidden=true;
        setup.type='button';setup.className='pwa-btn ghost';setup.textContent=window.LUMIRA_PLAY.setupText(0);setup.dataset.storeSetup='';setup.hidden=true;setup.onclick=()=>window.LUMIRA_PLAY.openSetup();b.append(status,retry,setup);
        const account=window.firebase?.auth?.().currentUser?.uid;
        try{const ref=window.LB_getDb?.()?.ref('admins/'+account);ref?.once('value').then(snapshot=>{if(grid.isConnected&&window.firebase.auth().currentUser?.uid===account){admin=snapshot.val()===true;setup.hidden=!admin||!setupRelevant;}},()=>{});}catch{}
        const load=async refresh=>{retry.disabled=true;setupRelevant=false;setup.hidden=true;status.textContent=window.LUMIRA_PLAY.text(0);try{
          const items=await window.LUMIRA_PLAY.catalog({refresh});if(!grid.isConnected)return;
          for(const row of storeCards){const detail=items.get(row.t.sku);row.price.textContent=detail?.price||window.LUMIRA_PLAY.errorText(items.errors?.get(row.t.sku));row.el.disabled=!detail||revoked(row.t.amount);}
          const partial=items.size<storeCards.length;status.textContent=partial?window.LUMIRA_PLAY.text(1):'';retry.hidden=!partial;setupRelevant=partial;
        }catch(error){if(!grid.isConnected)return;status.textContent=window.LUMIRA_PLAY.errorText(error);retry.hidden=false;setupRelevant=true;for(const row of storeCards){row.price.textContent='—';row.el.disabled=true;}}
        finally{retry.disabled=false;setup.hidden=!admin||!setupRelevant;}};retry.onclick=()=>load(true);load(false);
      }
      if (window.LUMIRA_FEATURES && typeof window.getDigitalGoodsService === 'function') {
        var restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'pwa-btn';
        restore.textContent = window.LUMIRA_FEATURES.text('restore');
        restore.onclick = async function () {
          restore.disabled = true;
          try {
            var count = await window.LUMIRA_FEATURES.restorePurchases();
            toast(window.LUMIRA_FEATURES.text(count ? 'restored' : 'noPurchases'), { kind: 'good' });
          } catch (e) {
            toast(window.LUMIRA_FEATURES.errorText(e), { kind: 'bad' });
          } finally { restore.disabled = false; }
        };
        b.appendChild(restore);
      }

      var mine = myBadges();
      if (mine.length) {
        b.insertAdjacentHTML('beforeend',
          '<p class="pwa-note" style="text-align:center;font-size:15px;margin:14px 0 0">' +
          (window.t?window.t('your_badges')(mine.join(' ')):('Rozetlerin: ' + mine.join(' '))) + '</p>');
      }

      b.insertAdjacentHTML('beforeend',
        '<p class="sup-desc">' + (window.t ? window.t('support_desc') :
        'Lumira\'yı herkes için ücretsiz sunmaya devam etmek istiyoruz. ' +
        'Eğer uygulamayı faydalı bulduysanız, tamamen isteğe bağlı bir destekle yeni ' +
        'özelliklerin geliştirilmesine katkıda bulunabilirsiniz. Her katkı bizim için ' +
        'çok değerli. ❤️ 🇹🇷') + '</p>');
    });
  }
  window.openSupport = openSupport;

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#supportBtn') : null;
    if (t) { e.preventDefault(); openSupport(); }
  });

  /* ======================================================== KİLİT UYARILARI */
  function lockNotice(title, msg) {
    if (!(window.PWA && window.PWA.sheet)) { alert(msg); return; }
    window.PWA.sheet('🔒 ' + title, '', function (b) {
      b.insertAdjacentHTML('beforeend', '<p class="lock-msg">' + msg + '</p>');
    });
  }
  window.LUMIRA_LOCK = {
    level: function (need, featureName) {
      var lvl = myLevel();
      if (lvl >= need) return true;
      var T = window.t || function(k){ return k; };
      lockNotice(featureName, window.t ? window.t('lock_level_msg')(need, lvl) :
        ('Bu özelliği kullanmak için en az <b>' + need + '. seviye</b> olmalısın. ' +
        'Şu anki seviyen: <b>' + lvl + '</b>.<br><br>' +
        '🎯 <b>Kişisel</b> sekmesinden çalışarak seviyeni yükseltebilirsin.'));
      return false;
    },
    pdfBadge: function () {
      const entitlement=window.LUMIRA_FEATURES?.entitlement();
      if(entitlement?.tier>0 && entitlement.pdf?.remaining!==0)return true;
      if(window.LUMIRA_ACCESS){window.LUMIRA_ACCESS.open(entitlement?.tier?'pdf_limit':'pdf_badge_required',entitlement);return false;}
      if (hasAnyPdfBadge()) return true;
      var T = window.t || function(k){ return k; };
      lockNotice(T('lock_pdf_feature_name'), T('lock_pdf_msg'));
      return false;
    },
    /* Herhangi bir destek rozeti yeterli olan özellikler için genel kilit
       (Çevrimdışı paket, Favoriler). En küçük rozet (👍🏻 Teşekkür) bile yeter. */
    anyBadge: function (featureName) {
      if (myBadges().length > 0) return true;
      var T = window.t || function(k){ return k; };
      lockNotice(featureName, T('lock_any_badge_msg'));
      return false;
    }
  };

  /* ============================================ KELİME LİSTESİ → PDF */
  var LANG_INFO = {
    de: { ad: 'Almanca',    yerel: 'Deutsch',  renk: '#c8901e', rtl: false },
    en: { ad: 'İngilizce',  yerel: 'English',  renk: '#1f63c8', rtl: false },
    ar: { ad: 'Arapça',     yerel: 'العربية',  renk: '#0f7a4e', rtl: true  },
    fr: { ad: 'Fransızca',  yerel: 'Français', renk: '#a3247c', rtl: false },
    es: { ad: 'İspanyolca', yerel: 'Español',  renk: '#c2410c', rtl: false },
    ru: { ad: 'Rusça',      yerel: 'Русский',  renk: '#5b34b3', rtl: false }
  };

  function collectWords(lang, level) {
    var out = [];
    try {
      var V = (typeof VOCAB !== 'undefined') ? VOCAB : null;
      if (!V) {
        V = new Function('try{return typeof VOCAB!=="undefined"?VOCAB:null}catch(e){return null}')();
      }
      if (!V) return out;
      for (var i = 0; i < V.length; i++) {
        var v = V[i];
        if (v.lang !== lang) continue;
        if (level !== 'TÜMÜ' && v.level !== level) continue;
        out.push({ w: v.w, tr: v.tr, cat: v.cat, level: v.level });
      }
    } catch (e) {}
    out.sort(function (a, b2) {
      return String(a.w).localeCompare(String(b2.w), 'tr', { sensitivity: 'base' });
    });
    return out;
  }

  function buildPdfHtml(lang, level, words) {
    var info = LANG_INFO[lang] || LANG_INFO.de;
    const C=window.LUMIRA_ACCESS_COPY, ui=window.NATIVE_LANG || 'tr', languageNames=new Intl.DisplayNames([ui],{type:'language'});
    var bugun = new Date().toLocaleDateString(ui, { day: 'numeric', month: 'long', year: 'numeric' });
    /* Kişi kendi ana dilinin (NATIVE_LANG) listesini indiriyorsa ve ters
       öğrenme modundaysa (Türkçe öğreniyorsa), liste de onun öğrendiği
       yönde olsun: soldaki sütun Türkçe, sağdaki kendi dili. Başka bir
       dilin listesini indirirse (bonus/merak amaçlı) eski davranış kalır. */
    var flip = (typeof window.isReversed === 'function') && window.isReversed() &&
               (typeof window.NATIVE_LANG !== 'undefined') && window.NATIVE_LANG === lang;

    /* Liste her zaman "src" sütununa göre alfabetik sıralanır (dictionary
       düzeni); collectWords varsayılan olarak w'ye göre sıralar, ters
       modda src=Türkçe olduğu için burada tr'ye göre yeniden sıralanır. */
    words = words.slice();
    if (flip) {
      words.sort(function (a, b2) { return String(a.tr).localeCompare(String(b2.tr), 'tr', { sensitivity: 'base' }); });
    }

    var rows = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var srcTxt = flip ? w.tr : w.w;
      var trTxt  = flip ? w.w  : w.tr;
      rows += '<div class="entry">' +
                '<span class="src">' + esc(srcTxt) + '</span>' +
                '<span class="dots"></span>' +
                '<span class="tr">' + esc(trTxt) + '</span>' +
              '</div>';
    }

    return '<!DOCTYPE html><html lang="'+esc(ui)+'" dir="'+(ui==='ar'?'rtl':'ltr')+'"><head><meta charset="utf-8">' +
      '<title>Lumira ' + esc(languageNames.of(lang)) + ' · '+esc(C.text('wordList'))+'</title>' +
      '<style>' +
      '@page{size:A4;margin:18mm 16mm 20mm;}' +
      '*{box-sizing:border-box;}' +
      'body{margin:0;font-family:"Georgia","Times New Roman",serif;color:#1a1a1a;' +
      '     -webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
      '.cover{height:100vh;display:flex;flex-direction:column;align-items:center;' +
      '       justify-content:center;text-align:center;page-break-after:always;}' +
      '.cover .brand{font-size:13pt;letter-spacing:.42em;color:' + info.renk + ';' +
      '       text-transform:uppercase;margin-bottom:26px;}' +
      '.cover h1{font-size:34pt;margin:0 0 6px;font-weight:700;letter-spacing:-.01em;}' +
      '.cover h2{font-size:15pt;margin:0;font-weight:400;color:#555;font-style:italic;}' +
      '.cover .rule{width:120px;height:2px;background:' + info.renk + ';margin:26px 0;}' +
      '.cover .meta{font-size:10.5pt;color:#666;line-height:1.9;}' +
      '.cover .foot{position:absolute;bottom:24mm;font-size:9pt;color:#888;}' +
      'h3.sec{font-size:11pt;letter-spacing:.28em;text-transform:uppercase;' +
      '       color:' + info.renk + ';border-bottom:1.5px solid ' + info.renk + ';' +
      '       padding-bottom:6px;margin:0 0 14px;}' +
      '.cols{column-count:2;column-gap:12mm;column-rule:.5pt solid #ddd;}' +
      '.entry{display:flex;align-items:baseline;font-size:10.5pt;line-height:1.62;' +
      '       break-inside:avoid;page-break-inside:avoid;padding:1.5px 0;}' +
      '.src{color:' + info.renk + ';font-weight:700;white-space:nowrap;' +
      ((info.rtl && !flip) ? 'direction:rtl;unicode-bidi:isolate;font-size:12pt;' : '') + '}' +
      '.dots{flex:1 1 auto;border-bottom:1px dotted #bbb;margin:0 5px;transform:translateY(-3px);}' +
      '.tr{color:#111;white-space:nowrap;' +
      ((info.rtl && flip) ? 'direction:rtl;unicode-bidi:isolate;font-size:12pt;' : '') + '}' +
      '@media print{.noprint{display:none !important;}}' +
      '.noprint{position:fixed;top:0;left:0;right:0;background:#0d1226;color:#fff;' +
      '   padding:12px 16px;font-family:system-ui,sans-serif;font-size:14px;text-align:center;z-index:9;}' +
      '.noprint button{font:inherit;font-weight:700;margin-left:10px;padding:8px 18px;' +
      '   border:0;border-radius:8px;background:#4fe8ff;color:#04050a;cursor:pointer;}' +
      '</style></head><body>' +
      '<div class="noprint">'+esc(C.text('pdfSave'))+'<button onclick="window.print()">'+esc(C.text('pdfPrint'))+'</button></div>' +
      '<div class="cover">' +
        '<div class="brand">Lumira</div>' +
        '<h1>' + esc(languageNames.of(flip?'tr':lang)) + ' · '+esc(C.text('wordList'))+'</h1>' +
        '<h2>' + esc(languageNames.of(flip?'tr':lang)) + ' — ' + esc(languageNames.of(flip?lang:'tr')) + '</h2>' +
        '<div class="rule"></div>' +
        '<div class="meta">'+esc(C.text('level'))+': <b>' + esc(level==='TÜMÜ'?C.text('all'):level) + '</b><br>' +
          esc(C.text('words'))+': <b>' + words.length + '</b><br>' + bugun + '</div>' +
        '<div class="foot">lumira-tr.com</div>' +
      '</div>' +
      '<h3 class="sec">' + esc(languageNames.of(flip?'tr':lang)) + ' — ' + esc(languageNames.of(flip?lang:'tr')) + ' · ' + esc(level==='TÜMÜ'?C.text('all'):level) + '</h3>' +
      '<div class="cols">' + rows + '</div>' +
      '</body></html>';
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  async function openPdfExport() {
    if (!await window.LUMIRA_ACCESS.require('pdf')) return;
    if (!(window.PWA && window.PWA.sheet)) return;

    window.PWA.sheet(window.t?window.t('pdf_export_title'):'📄 Kelimeleri PDF olarak indir',
      window.LUMIRA_ACCESS_COPY.text('pdfNoteExport'), function (b) {

      var lang = 'de', level = 'TÜMÜ';

      function chipRow(label, items, current, onPick) {
        var wrap = document.createElement('div');
        wrap.className = 'pdf-row';
        wrap.innerHTML = '<span class="pdf-lbl">' + label + '</span>';
        var box = document.createElement('div');
        box.className = 'pdf-chips';
        items.forEach(function (it) {
          var c = document.createElement('button');
          c.type = 'button';
          c.className = 'pdf-chip' + (it.v === current() ? ' on' : '');
          c.textContent = it.t;
          c.onclick = function () {
            onPick(it.v);
            Array.prototype.forEach.call(box.children, function (x) { x.classList.remove('on'); });
            c.classList.add('on');
          };
          box.appendChild(c);
        });
        wrap.appendChild(box);
        return wrap;
      }

      const languageNames = new Intl.DisplayNames([window.NATIVE_LANG || 'tr'], {type:'language'});
      b.appendChild(chipRow(window.LUMIRA_ACCESS_COPY.text('language'), ['de','en','ar','fr','es','ru'].map(code => ({v:code,t:languageNames.of(code)})), function(){return lang;}, function(v){lang=v;}));

      b.appendChild(chipRow(window.LUMIRA_ACCESS_COPY.text('level'), [
        { v: 'TÜMÜ', t: window.LUMIRA_ACCESS_COPY.text('all') }, { v: 'A1', t: 'A1' }, { v: 'A2', t: 'A2' },
        { v: 'B1', t: 'B1' }, { v: 'B2', t: 'B2' }
      ], function () { return level; }, function (v) { level = v; }));

      var go = document.createElement('button');
      go.type = 'button';
      go.className = 'pwa-btn';
      go.textContent = window.t?window.t('pdf_generate_btn'):'Listeyi oluştur';
      go.onclick = async function () {
        go.disabled=true;go.textContent=window.t?window.t('pdf_generating'):'…';
        const F=window.LUMIRA_FEATURES, C=window.LUMIRA_ACCESS_COPY;
        const finish=()=>{go.disabled=false;go.textContent=window.t?window.t('pdf_generate_btn'):'PDF';};
        // Open synchronously during the click so Safari keeps the user gesture.
        let win=window.open('','_blank'), frame, operation, committed=false;
        try{
          if(win)win.document.body.textContent=C.text('checking');
          if(window.VOCAB_LOADED && !window.VOCAB_LOADED[lang] && window.ensureVocab)await window.ensureVocab(lang);
          const words=collectWords(lang,level);
          if(!words.length)throw new Error(window.t('pdf_words_not_found'));
          const html=buildPdfHtml(lang,level,words);
          // A finite account-wide allowance requires an online reservation.
          // Cached, verified higher badges can generate unlimited PDFs offline.
          const entitlement=F.entitlement();
          if(navigator.onLine){operation=F.id();await F.api('pdfBegin',{id:operation});}
          else if(!entitlement || entitlement.tier<5)throw new Error(C.text('net'));
          if(!win){
            frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;';document.body.append(frame);
          }
          const doc=win?win.document:frame.contentWindow.document;
          if(operation){await F.api('pdfCommit',{id:operation});committed=true;}
          doc.open();doc.write(html);doc.close();
          if(frame){const clean=()=>{frame?.remove();frame=null;};frame.contentWindow.addEventListener('afterprint',clean,{once:true});setTimeout(()=>{try{frame?.contentWindow.focus();frame?.contentWindow.print();}catch(e){clean();}},350);setTimeout(clean,60000);}
          toast(C.text('pdfReady',{n:words.length}),{kind:'good',duration:7000});
        }catch(e){
          try{win?.close();}catch(ignore){}frame?.remove();
          if(operation && !committed)await F.api('pdfCancel',{id:operation}).catch(()=>{});
          if(!['pdf_limit','pdf_badge_required'].includes(e.featureCode))toast(e.featureCode?F.errorText(e):e.message,{kind:'bad',duration:7000});
        }finally{finish();}
      };
      b.appendChild(go);

      const note=document.createElement('p');note.className='pwa-note';note.textContent=window.LUMIRA_ACCESS_COPY.text('pdfNoteExport');b.appendChild(note);
    });
  }
  window.openPdfExport = openPdfExport;

  /* ====================================== ADMIN HEDİYE ROZETİ SENKRONU
     Admin bir kullanıcıya destek rozeti verdiğinde bunu Firebase'e yazar
     (progress/<uid>/meta/supportGrants/<tutar> = true). Burada o kayıt
     okunur ve rozet yerel listeye eklenir; böylece SATIN ALMIŞ GİBİ tüm
     özellikler (PDF, Profilim vb.) açılır ve "Lumira'yı Destekle"de görünür.
     XP ödülü admin tarafında bir kez eklenir; burada tekrar eklenmez. */
  let grantRef=null,grantListener=null,policySignature='';
  function syncSupportGrants(){
    if(grantRef && grantListener)grantRef.off('value',grantListener);
    grantRef=null;grantListener=null;
    const uid=account();if(!uid)return;
    grantRef=firebase.database().ref('progress/'+uid+'/meta/supportGrants');
    grantListener=function(snap){
      if(account()!==uid)return;
      const grants=snap.val()||{};
      // An explicit false removes the local mirror even before the API reply.
      saveBadges(myBadges().filter(b=>!TIERS.some(t=>t.badge===b && grants[t.amount]===false)));
      window.LUMIRA_FEATURES?.api('status').catch(()=>{});
    };
    grantRef.on('value',grantListener,function(){});
  }
  function bindPolicy(){
    const F=window.LUMIRA_FEATURES;if(!F)return;
    F.subscribe(function(quota){
      if(!Array.isArray(quota.supportAmounts))return;
      const signature=account()+':'+quota.supportAmounts.join(',')+':'+(quota.revokedSupport||[]).join(',');
      saveBadges(TIERS.filter(t=>quota.supportAmounts.includes(t.amount)).map(t=>t.badge));
      if(signature!==policySignature){policySignature=signature;window.PR_refreshBadges?.();}
    });
  }
  bindPolicy();
  (function initGiftSync(){
    try{if(typeof firebase!=='undefined' && firebase.apps?.length){firebase.auth().onAuthStateChanged(syncSupportGrants);}else setTimeout(initGiftSync,800);}catch(e){setTimeout(initGiftSync,800);}
  })();

})();
