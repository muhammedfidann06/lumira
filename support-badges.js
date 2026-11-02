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
    // The server has already verified the purchase; a stale "hidden" flag in
    // the cached policy must not swallow the thank-you toast and XP.
    if (!t) return false;
    var list = myBadges();
    if (list.indexOf(t.badge) === -1) { list.push(t.badge); saveBadges(list); }
    try { if (typeof window.PR_addXp === 'function') window.PR_addXp(t.xp, tierName(t)); } catch (e) {}
    toast((window.t ? window.t('purchase_success_toast')(t.badge, tierName(t), t.xp) : (t.badge + ' ' + t.name + ' rozeti kazandın · +' + t.xp + ' XP')), { kind: 'good', duration: 6000 });
    return true;
  };
  window.LUMIRA_BADGES = { list: myBadges, has: hasBadge, tiers: TIERS };

  /* Play: five monthly subscriptions plus one lifetime Crown. Old one-time
     identifiers remain accepted by the server for purchase restoration. */
  let purchaseInFlight=false,purchaseStartedAt=0;
  function purchaseTier(t, options) {
    options = options || {};
    window.LUMIRA_PLAY.checkoutStep?.('selected',t.sku);
    const blocked=code=>{window.LUMIRA_PLAY.checkoutStep?.('blocked',t.sku,{featureCode:code});window.PWA?.logError?.({message:'Play checkout blocked ('+t.sku+'): '+code,stack:''});};
    // Every outcome is shown in the open sheet as well as in a toast, so a
    // stop is never just a vanished tap.
    const say=(text,kind,extra)=>{if(!text)return;try{options.report?.(text);}catch(ignore){}if(kind)toast(text,Object.assign({kind:kind,duration:kind==='bad'?8000:4000},extra||{}));};
    const N=key=>window.LUMIRA_PLAY.notice?.(key)||'';
    var purchaseUid = null;
    try { purchaseUid = window.firebase.auth().currentUser.uid; } catch (e) {}
    if (!purchaseUid) {
      blocked('login_required');
      say(window.LUMIRA_FEATURES ? window.LUMIRA_FEATURES.text('login_required') : 'Önce hesabına giriş yap.', 'bad');
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
    if(!window.PaymentRequest||typeof window.getDigitalGoodsService!=='function'){blocked('store_unsupported');say(window.LUMIRA_PLAY.text(5),'bad');return;}
    const apiBlock=window.LUMIRA_PLAY.blockedReason?.();if(apiBlock){blocked(apiBlock);say(window.LUMIRA_PLAY.errorText({featureCode:apiBlock}),'bad');return;}
    // A product that is not in the cached catalog yet is no reason to ignore
    // the tap: Google Play shows its sheet (or its own error) and the server
    // still verifies every receipt before a badge opens.
    const catalogReady=window.LUMIRA_PLAY.canPurchase(t.sku);
    // A sheet that never settled must not block every later tap silently.
    if(purchaseInFlight&&Date.now()-purchaseStartedAt<120000){blocked('checkout_in_progress');say(window.LUMIRA_BILLING.text(27),'good');return;}
    purchaseInFlight=false;
    const policy=window.LUMIRA_FEATURES?.entitlement(),purchaseSku=window.LUMIRA_PLAY.purchaseSku?.(t.sku)||t.sku;
    // Nothing locks a badge any more: one removed by an administrator, or
    // hidden by the buyer, is simply bought again and the verified purchase
    // opens it.
    const ownedPurchase=window.LUMIRA_PLAY.ownedPurchase?.(t.sku);
    if(ownedPurchase){
      window.LUMIRA_PLAY.checkoutStep?.('restoring',purchaseSku);
      purchaseInFlight=true;purchaseStartedAt=Date.now();say(N('owned'));
      return window.LUMIRA_FEATURES.verifyPurchase(purchaseSku,ownedPurchase.purchaseToken,purchaseUid).then(()=>{window.LUMIRA_PLAY.checkoutStep?.('restored',purchaseSku);say(window.LUMIRA_FEATURES.text('restored'),'good');window.LUMIRA_FEATURES.api('status').catch(()=>{});}).catch(e=>{window.LUMIRA_PLAY.checkoutStep?.('verification_failed',purchaseSku,e);say(window.LUMIRA_FEATURES.text(e.featureCode||'purchase_verification_unavailable'),'bad');}).finally(()=>{purchaseInFlight=false;});
    }
    // Every badge is its own purchase. Owning one badge never blocks, and never
    // replaces, another: buying Kahve while holding Destekçi adds Kahve.
    // (Play replacement used to swap the old subscription away, and other
    // active subscriptions stopped Checkout altogether.) Only the very same
    // badge, already active, asks once so it is not paid for twice by mistake.
    if(!options.force&&policy?.supportAmounts?.includes(t.amount)){
      blocked('badge_already_active');
      say(N('already'),'good',{action:N('anyway'),duration:12000,onAction:()=>purchaseTier(t,Object.assign({},options,{force:true}))});
      return;
    }

    const paymentData={sku:purchaseSku};
    var methodData = [{ supportedMethods: 'https://play.google.com/billing', data: paymentData }];
    // Google Play charges its own store price. Chrome's Play Billing guide uses
    // a placeholder total when the store price has not been read yet.
    const price=window.LUMIRA_PLAY.paymentAmount?.(t.sku)||{currency:'USD',value:'0'};
    var details = { total: { label: tierName(t), amount:price } };
    var request;
    try { request = new PaymentRequest(methodData, details); }
    catch (e) { window.LUMIRA_PLAY.checkoutStep?.('request_failed',purchaseSku,e);window.PWA?.logError?.({message:'Play request ('+t.sku+'): '+(e.name||'failed'),stack:''});say((window.t?window.t('purchase_start_failed'):'Satın alma başlatılamadı.')+' ('+(e.name||'request')+')','bad'); return; }

    purchaseInFlight=true;purchaseStartedAt=Date.now();
    let shown;try{window.LUMIRA_PLAY.checkoutStep?.('opening',purchaseSku);shown=request.show();say(N('opening'));}catch(e){purchaseInFlight=false;window.LUMIRA_PLAY.checkoutStep?.('show_failed',purchaseSku,e);window.PWA?.logError?.({message:'Play show ('+t.sku+'): '+window.LUMIRA_PLAY.reason(e),stack:''});say(window.LUMIRA_PLAY.text(7)+' ('+window.LUMIRA_PLAY.reason(e)+')','bad');return;}
    // Read prices/owned purchases after show() so the tap's activation is used first.
    if(!catalogReady)window.LUMIRA_PLAY.catalog().catch(()=>{});
    return shown.then(async function (response) {
      window.LUMIRA_PLAY.checkoutStep?.('verifying',purchaseSku);
      let paymentDetails=response.details;try{if(typeof paymentDetails==='string')paymentDetails=JSON.parse(paymentDetails);}catch{paymentDetails=null;}
      const token=paymentDetails?.purchaseToken || paymentDetails?.token;
      try {
        if(!token || !window.LUMIRA_FEATURES)throw new Error('purchase_verification_unavailable');
        await window.LUMIRA_FEATURES.verifyPurchase(purchaseSku,token,purchaseUid);
        try{await response.complete('success');}catch(ignore){}
        if(window.firebase.auth().currentUser?.uid!==purchaseUid)return;
        window.grantSupportTier(t.amount);
        window.LUMIRA_PLAY.checkoutStep?.('completed',purchaseSku);say(N('done'));
        window.dispatchEvent(new Event('lumira:purchaseverified'));
        window.LUMIRA_FEATURES.api('status').catch(()=>{});
      }catch(e){
        window.LUMIRA_PLAY.checkoutStep?.('verification_failed',purchaseSku,e);
        window.PWA?.logError?.({message:'Play verify ('+t.sku+'): '+(e.featureCode||e.code||e.name||'failed'),stack:''});
        try{await response.complete('fail');}catch(ignore){}
        say(window.LUMIRA_FEATURES?.text(e.featureCode||'purchase_verification_unavailable') || e.message,'bad');
      }
    }).catch(function(e){
      // AbortError also covers native billing failures. Keep a sanitized
      // diagnostic; never log the response details or purchase token.
      window.LUMIRA_PLAY.catalog({refresh:true}).catch(()=>{});
      const reason=window.LUMIRA_PLAY.reason(e);
      window.LUMIRA_PLAY.checkoutStep?.(reason==='usercanceled'?'canceled':'show_failed',purchaseSku,e);
      window.PWA?.logError?.({message:'Play checkout ('+t.sku+' → '+purchaseSku+'): '+reason,stack:''});
      if(reason==='usercanceled'){say(N('canceled'));return;}
      // Google Play already owns it: restore instead of asking to pay again.
      if(reason==='itemalreadyowned'){say(N('owned'),'good');window.LUMIRA_FEATURES?.restorePurchases?.().then(count=>say(window.LUMIRA_FEATURES.text(count?'restored':'noPurchases'),count?'good':'bad')).catch(error=>say(window.LUMIRA_FEATURES.errorText(error),'bad'));return;}
      // A product that priced correctly but cannot be bought points at the
      // install/licence setup (sideloaded APK, emulator account), not the SKU.
      const message=reason==='developererror'||reason==='itemunavailable'&&catalogReady?N('developer'):reason==='itemunavailable'?window.LUMIRA_PLAY.text(2):['billingunavailable','serviceunavailable','servicedisconnected','featurenotsupported','clientappunavailable','unsupportedcontext'].includes(reason)?N('billing'):['networkerror','servicetimeout'].includes(reason)?N('network'):window.LUMIRA_PLAY.text(7);
      say(message+' ('+reason+')','bad');
    }).finally(()=>{purchaseInFlight=false;});
  }
  window.purchaseSupportTier = purchaseTier;

  /* ============================================================ DESTEK OL */
  /* Play ekranında her rozetin açtığı haklar kartın üzerinde yazar; metin
     bağış değil abonelik olduğunu ve iptalin nasıl yapıldığını söyler. */
  var SUPPORT_COPY = {
    tr:'Rozetler aylık aboneliktir; Kral rozeti tek seferlik ve süresizdir. Ödeme ve iptal Google Play hesabından yapılır, iptal ettiğinde ödediğin dönemin sonuna kadar hakların devam eder. Kullanım hakları son 24 saate göre yenilenir.',
    en:'Badges are monthly subscriptions; the Crown badge is a one-time, lifetime purchase. Payment and cancellation are handled in your Google Play account; after cancelling, your benefits last until the end of the paid period. Usage limits renew over the last 24 hours.',
    de:'Abzeichen sind Monatsabos; die Krone ist ein einmaliger, dauerhafter Kauf. Zahlung und Kündigung laufen über dein Google-Play-Konto; nach der Kündigung bleiben die Vorteile bis zum Ende des bezahlten Zeitraums. Nutzungslimits erneuern sich über die letzten 24 Stunden.',
    ar:'الشارات اشتراكات شهرية؛ وشارة التاج شراء لمرة واحدة ودائم. يتم الدفع والإلغاء من حساب Google Play، وبعد الإلغاء تبقى المزايا حتى نهاية الفترة المدفوعة. تتجدد حدود الاستخدام وفق آخر 24 ساعة.',
    fr:'Les badges sont des abonnements mensuels ; la Couronne est un achat unique et à vie. Le paiement et la résiliation se font dans ton compte Google Play ; après résiliation, tes avantages restent jusqu’à la fin de la période payée. Les limites se renouvellent sur les dernières 24 heures.',
    es:'Las insignias son suscripciones mensuales; la Corona es una compra única y de por vida. El pago y la cancelación se gestionan en tu cuenta de Google Play; tras cancelar, mantienes las ventajas hasta el final del periodo pagado. Los límites se renuevan según las últimas 24 horas.',
    ru:'Значки — ежемесячные подписки; Корона — разовая бессрочная покупка. Оплата и отмена выполняются в аккаунте Google Play; после отмены преимущества действуют до конца оплаченного периода. Лимиты обновляются за последние 24 часа.'
  };
  function tierBenefits(t) {
    var C = window.LUMIRA_ACCESS_COPY, row = window.LUMIRA_ACCESS && window.LUMIRA_ACCESS.tiers.find(function (x) { return x.amount === t.amount; });
    if (!C || !row) return [];
    return [C.text(row.minutes === null ? 'liveUnlimited' : 'live', { n: row.minutes }), C.text(row.count === null ? 'writingUnlimited' : 'writing', { n: row.count }), C.text(t.amount === 1 ? 'pdfTotal' : 'pdfUnlimited'), C.text('offline')];
  }
  function openSupport() {
    if(!window.LUMIRA_PLAY.isNative() && window.LUMIRA_ACCESS)return window.LUMIRA_ACCESS.open('shop');
    if (!(window.PWA && window.PWA.sheet)) return;
    const C=window.LUMIRA_ACCESS_COPY,shopTitle=C&&C.text('shopTitle');
    window.PWA.sheet(shopTitle&&shopTitle!=='shopTitle'?shopTitle:(window.t?window.t('support_title'):'❤️ Lumira\'yı Destekle'), '', function (b,panel) {
      var grid = document.createElement('div');
      const native=window.LUMIRA_PLAY.isNative();
      grid.className = 'sup-grid' + (native ? ' sup-list' : '');

      const storeCards=[];let report=null;
      TIERS.forEach(function (t) {
        var owned = hasBadge(t.badge);
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'sup-item' + (owned ? ' owned' : '');
        if(native){
          el.innerHTML =
            '<span class="sup-head"><span class="sup-badge">' + t.badge + '</span>' +
            '<span class="sup-name"><span class="sup-amount">' + esc(tierName(t)) + '</span><span class="sup-eur">' + esc(window.LUMIRA_BILLING.text(t.amount===100?3:4)) + '</span></span>' +
            '<span class="sup-store-price">' + esc(window.LUMIRA_BILLING.text(24)) + '</span></span>' +
            '<span class="sup-benefits">' + tierBenefits(t).map(function (line) { return '<span><i aria-hidden="true">✓</i>' + esc(line) + '</span>'; }).join('') + '</span>' +
            '<span class="sup-foot"><span class="sup-xp">+' + t.xp + ' XP</span>' + (owned && C ? '<span class="sup-owned">' + esc(C.text('owned')) + '</span>' : '') + '</span>';
        }else{
          el.innerHTML =
            '<span class="sup-amount">' + tierName(t) + '</span>' +
            '<span class="sup-eur">' + window.LUMIRA_BILLING.text(28) + '</span>' +
            '<span class="sup-badge">' + t.badge + '</span>' +
            '<span class="sup-xp">+' + t.xp + ' XP</span>';
        }
        // Cards stay tappable while prices load or fail, and also for removed
        // badges: a disabled card swallowed the tap without any explanation.
        el.disabled=false;
        if(native)storeCards.push({t,el,price:el.querySelector('.sup-store-price')});
        el.onclick = function () { purchaseTier(t,{report:function(text){if(report)report(text);}}); };
        grid.appendChild(el);
      });
      b.appendChild(grid);
      if(native){
        const status=document.createElement('p'),retry=document.createElement('button'),setup=document.createElement('button');let admin=false,setupRelevant=false;
        status.className='pwa-note';status.dataset.storeStatus='';status.setAttribute('role','status');retry.type='button';retry.dataset.storeRetry='';retry.className='pwa-btn';retry.textContent=window.LUMIRA_PLAY.text(4);retry.hidden=true;
        setup.type='button';setup.className='pwa-btn ghost';setup.textContent=window.LUMIRA_PLAY.setupText(0);setup.dataset.storeSetup='';setup.hidden=true;setup.onclick=()=>window.LUMIRA_PLAY.openSetup();b.append(status,retry,setup);
        // The latest checkout step stays visible under the cards.
        report=text=>{if(grid.isConnected)status.textContent=text;};
        const account=window.firebase?.auth?.().currentUser?.uid;
        try{const ref=window.LB_getDb?.()?.ref('admins/'+account);ref?.once('value').then(snapshot=>{if(grid.isConnected&&window.firebase.auth().currentUser?.uid===account){admin=snapshot.val()===true;setup.hidden=!admin||!setupRelevant;}},()=>{});}catch{}
        const load=async refresh=>{retry.disabled=true;setupRelevant=false;setup.hidden=true;status.textContent=window.LUMIRA_PLAY.text(0);try{
          const items=await window.LUMIRA_PLAY.catalog({refresh});if(!grid.isConnected)return;
          for(const row of storeCards){const detail=items.get(row.t.sku);row.price.textContent=detail?.price||window.LUMIRA_PLAY.errorText(items.errors?.get(row.t.sku));}
          const partial=items.size<storeCards.length;status.textContent=partial?window.LUMIRA_PLAY.text(1):'';retry.hidden=!partial;setupRelevant=partial;
        }catch(error){if(!grid.isConnected)return;status.textContent=window.LUMIRA_PLAY.errorText(error);retry.hidden=false;setupRelevant=true;for(const row of storeCards){row.price.textContent='—';}}
        finally{retry.disabled=false;setup.hidden=!admin||!setupRelevant;}};retry.onclick=()=>load(true);
        const refresh=()=>{if(grid.isConnected)load(true);};window.addEventListener('lumira:playsetupready',refresh);
        const close=panel.close;panel.close=()=>{window.removeEventListener('lumira:playsetupready',refresh);close();};load(false);
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

      if(native)b.insertAdjacentHTML('beforeend','<p class="sup-desc">' + esc(SUPPORT_COPY[window.NATIVE_LANG] || SUPPORT_COPY.en) + '</p>');
      else b.insertAdjacentHTML('beforeend',
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

  /* ============================================ KELİME LİSTESİ → PDF
     Tek bir kategori ya da tüm kategoriler (her biri ayrı bölüm) yazdırılır.
     Bölüm içindeki kelimeler hedef dilin alfabesine göre sıralanır; anlamlar
     her zaman öğrencinin kendi dilindedir (öğrenme ekranlarıyla aynı deste). */
  var LANG_INFO = {
    de: { renk: '#b7791f' }, en: { renk: '#1f63c8' }, ar: { renk: '#0f7a4e' }, fr: { renk: '#a3247c' },
    es: { renk: '#c2410c' }, ru: { renk: '#5b34b3' }, tr: { renk: '#c8102e' }
  };
  var PDF_COPY = {
    tr:{category:'Kategori',allCategories:'Tüm kategoriler (bölümlere ayrılmış)',contents:'İçindekiler',categories:'{n} kategori',words:'{n} kelime',examples:'Örnek cümleleri ekle',note:'Tek bir kategoriyi ya da tüm kategorileri ayrı bölümler hâlinde yazdırabilirsin. Her bölümde kelimeler alfabetik sıradadır.',articles:'Artikel renkleri',loading:'Kelimeler yükleniyor…',empty:'Bu seçimde kelime bulunamadı.',date:'Tarih',count:'Kelime',scope:'Kapsam'},
    en:{category:'Category',allCategories:'All categories (in sections)',contents:'Contents',categories:'{n} categories',words:'{n} words',examples:'Include example sentences',note:'Print a single category, or all categories in separate sections. Words are in alphabetical order in every section.',articles:'Article colours',loading:'Loading words…',empty:'No words for this selection.',date:'Date',count:'Words',scope:'Scope'},
    de:{category:'Kategorie',allCategories:'Alle Kategorien (in Abschnitten)',contents:'Inhalt',categories:'{n} Kategorien',words:'{n} Wörter',examples:'Beispielsätze hinzufügen',note:'Drucke eine einzelne Kategorie oder alle Kategorien in eigenen Abschnitten. In jedem Abschnitt sind die Wörter alphabetisch sortiert.',articles:'Artikelfarben',loading:'Wörter werden geladen…',empty:'Für diese Auswahl gibt es keine Wörter.',date:'Datum',count:'Wörter',scope:'Umfang'},
    ar:{category:'الفئة',allCategories:'كل الفئات (في أقسام)',contents:'المحتويات',categories:'{n} فئة',words:'{n} كلمة',examples:'إضافة جمل أمثلة',note:'اطبع فئة واحدة أو كل الفئات في أقسام منفصلة. الكلمات مرتبة أبجديًا في كل قسم.',articles:'ألوان أدوات التعريف',loading:'جارٍ تحميل الكلمات…',empty:'لا توجد كلمات لهذا الاختيار.',date:'التاريخ',count:'الكلمات',scope:'النطاق'},
    fr:{category:'Catégorie',allCategories:'Toutes les catégories (en sections)',contents:'Sommaire',categories:'{n} catégories',words:'{n} mots',examples:'Ajouter des phrases d’exemple',note:'Imprime une seule catégorie ou toutes les catégories en sections séparées. Dans chaque section, les mots sont classés par ordre alphabétique.',articles:'Couleurs des articles',loading:'Chargement des mots…',empty:'Aucun mot pour cette sélection.',date:'Date',count:'Mots',scope:'Contenu'},
    es:{category:'Categoría',allCategories:'Todas las categorías (por secciones)',contents:'Índice',categories:'{n} categorías',words:'{n} palabras',examples:'Añadir frases de ejemplo',note:'Imprime una sola categoría o todas en secciones separadas. En cada sección las palabras están en orden alfabético.',articles:'Colores de los artículos',loading:'Cargando palabras…',empty:'No hay palabras para esta selección.',date:'Fecha',count:'Palabras',scope:'Contenido'},
    ru:{category:'Категория',allCategories:'Все категории (по разделам)',contents:'Содержание',categories:'Категорий: {n}',words:'Слов: {n}',examples:'Добавить примеры предложений',note:'Распечатай одну категорию или все категории отдельными разделами. В каждом разделе слова расположены по алфавиту.',articles:'Цвета артиклей',loading:'Загрузка слов…',empty:'Для этого выбора нет слов.',date:'Дата',count:'Слов',scope:'Охват'}
  };
  function nativeLang() { return window.NATIVE_LANG || 'tr'; }
  function pdfText(key, values) {
    var s = (PDF_COPY[nativeLang()] || PDF_COPY.en)[key] || PDF_COPY.en[key] || key;
    Object.keys(values || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(values[k])); });
    return s;
  }
  function vocabRows() { try { return typeof VOCAB !== 'undefined' ? VOCAB : []; } catch (e) { return []; } }
  function deckFor(lang) {
    var native = nativeLang(), V = vocabRows(), source;
    if (native === 'tr') source = V;
    else if (lang === 'tr') source = V.filter(function (v) { return v.lang === native && !v.phraseId; }).map(function (v) { return Object.assign({}, v, { lang: 'tr', w: v.tr, tr: v.w, ex: v.exTr, exTr: v.ex }); });
    else source = typeof window.buildCrossDeck === 'function' ? window.buildCrossDeck(native, lang) : [];
    return source.filter(function (v) {
      return v.lang === lang && !v.phraseId && v.w && v.tr && (!window.LUMIRA_MAINTENANCE || window.LUMIRA_MAINTENANCE.categoryAvailable(v.cat) !== false);
    });
  }
  /* Hedef dilin ve (Türkçe dışındaki) ana dilin sözlüğü yüklenmiş olmalı. */
  function ensureDeck(lang) {
    var need = [lang, nativeLang()].filter(function (l, i, all) { return l !== 'tr' && all.indexOf(l) === i && window.VOCAB_LOADED && !window.VOCAB_LOADED[l]; });
    if (!need.length || !window.ensureVocab) return Promise.resolve();
    return Promise.all(need.map(function (l) { return window.ensureVocab(l); }));
  }
  function collectWords(lang, level, category) {
    var seen = {}, out = [];
    deckFor(lang).forEach(function (v) {
      if (level !== 'TÜMÜ' && v.level !== level) return;
      if (category && v.cat !== category) return;
      var key = v.cat + '\u0000' + v.w + '\u0000' + v.tr;
      if (seen[key]) return; seen[key] = 1;
      out.push({ w: v.w, tr: v.tr, cat: v.cat || '', level: v.level || '', ex: v.ex || '', exTr: v.exTr || '' });
    });
    return out;
  }

  /* Sözlük düzeni: artikel ve harekeler sıralamaya ve harf başlığına girmez. */
  var LEADING = { de: /^(der|die|das)\s+/i, fr: /^(les|le|la)\s+|^l['’]\s*/i, es: /^(los|las|el|la)\s+/i, en: /^(the|to)\s+/i, ar: /^ال/ };
  function sortKey(word, lang) {
    var s = String(word).trim();
    if (LEADING[lang]) s = s.replace(LEADING[lang], '');
    if (lang === 'ar') s = s.replace(/[ً-ٰٟ]/g, '');
    return s || String(word);
  }
  function letterOf(word, lang) {
    var c = (Array.from(sortKey(word, lang))[0] || '#').toLocaleUpperCase(lang);
    if (lang === 'ar') c = c.replace(/[أإآ]/, 'ا');
    else if (['de', 'fr', 'en', 'es'].indexOf(lang) >= 0 && !(lang === 'es' && c === 'Ñ')) c = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return /\p{L}/u.test(c) ? c : '#';
  }
  function groupWords(words, lang, ui) {
    var order = new Intl.Collator(lang, { sensitivity: 'base', numeric: true }), names = new Intl.Collator(ui, { sensitivity: 'base' }), groups = {};
    words.forEach(function (w) { (groups[w.cat] = groups[w.cat] || []).push(w); });
    return Object.keys(groups).map(function (cat) {
      return { cat: cat, name: (window.catName ? window.catName(cat) : cat) || '—', words: groups[cat].sort(function (a, b) { return order.compare(sortKey(a.w, lang), sortKey(b.w, lang)) || order.compare(a.w, b.w); }) };
    }).sort(function (a, b) { return names.compare(a.name, b.name); });
  }
  function wordHtml(word, lang) {
    var m = lang === 'de' && /^(der|die|das)\s+(.+)$/i.exec(String(word));
    return m ? '<span class="art art-' + m[1].toLowerCase() + '">' + esc(m[1]) + '</span>&nbsp;' + esc(m[2]) : esc(word);
  }
  var BUTTERFLY = '<svg viewBox="0 0 64 48" aria-hidden="true"><path fill="#a5ecdb" d="M30 22C25 2 2-2 6 13c3 9 13 13 24 12C12 22 9 39 20 40c9 1 11-10 12-14Z"/><path fill="#b4b9ee" d="M34 22C39 2 62-2 58 13c-3 9-13 13-24 12 18-3 21 14 10 15-9 1-11-10-12-14Z"/></svg>';

  function buildPdfHtml(lang, level, words, options) {
    options = options || {};
    var C = window.LUMIRA_ACCESS_COPY, ui = nativeLang(), names = new Intl.DisplayNames([ui], { type: 'language' });
    var accent = (LANG_INFO[lang] || LANG_INFO.de).renk, groups = groupWords(words, lang, ui), single = !!options.category;
    var wordDir = lang === 'ar' ? 'rtl' : 'ltr', uiDir = ui === 'ar' ? 'rtl' : 'ltr';
    var today = new Date().toLocaleDateString(ui, { day: 'numeric', month: 'long', year: 'numeric' });
    var levelText = level === 'TÜMÜ' ? C.text('all') : level, scope = single ? groups[0].name : pdfText('categories', { n: groups.length });
    var title = 'Lumira · ' + names.of(lang) + ' · ' + C.text('wordList') + (single ? ' · ' + groups[0].name : '') + (level === 'TÜMÜ' ? '' : ' · ' + level);
    var two = function (n) { return String(n).padStart(2, '0'); };

    var sections = groups.map(function (g, gi) {
      var body = '', last = '';
      g.words.forEach(function (w) {
        var letter = letterOf(w.w, lang);
        if (letter !== last) { body += '<div class="letter" aria-hidden="true">' + esc(letter) + '</div>'; last = letter; }
        body += '<div class="entry"><div class="line">' +
          '<span class="src" lang="' + lang + '" dir="' + wordDir + '">' + wordHtml(w.w, lang) + '</span>' +
          (level === 'TÜMÜ' && w.level ? '<span class="lvl">' + esc(w.level) + '</span>' : '') +
          '<span class="dots"></span><span class="tr" lang="' + ui + '" dir="' + uiDir + '">' + esc(w.tr) + '</span></div>' +
          (options.examples && w.ex ? '<div class="ex" lang="' + lang + '" dir="' + wordDir + '">' + esc(w.ex) + '</div>' + (w.exTr ? '<div class="ex-tr" lang="' + ui + '" dir="' + uiDir + '">' + esc(w.exTr) + '</div>' : '') : '') +
          '</div>';
      });
      return '<section class="cat" id="cat-' + gi + '"><header class="cat-head">' + (single ? '' : '<span class="cat-no">' + two(gi + 1) + '</span>') +
        '<h2>' + esc(g.name) + '</h2><span class="cat-count">' + esc(pdfText('words', { n: g.words.length })) + '</span></header>' +
        '<div class="cols' + (options.examples ? ' with-ex' : '') + '">' + body + '</div></section>';
    }).join('');

    var contents = !single && groups.length > 1 ? '<section class="toc"><h2>' + esc(pdfText('contents')) + '</h2><ol>' + groups.map(function (g, gi) {
      return '<li><a href="#cat-' + gi + '"><span class="toc-no">' + two(gi + 1) + '</span><span class="toc-name">' + esc(g.name) + '</span><span class="dots"></span><span class="toc-count">' + g.words.length + '</span></a></li>';
    }).join('') + '</ol></section>' : '';
    var legend = lang === 'de' ? '<p class="legend">' + esc(pdfText('articles')) + ': <span class="art art-der">der</span> · <span class="art art-die">die</span> · <span class="art art-das">das</span></p>' : '';

    return '<!DOCTYPE html><html lang="' + esc(ui) + '" dir="' + uiDir + '"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title><style>' +
      ':root{--accent:' + accent + ';--tint:' + accent + '14;--line:#dfe4ee;--ink:#172033;--muted:#5d6a80}' +
      '@page{size:A4;margin:15mm 14mm 17mm;@bottom-center{content:"lumira-tr.com  ·  @lumira.learn  ·  " counter(page);font:8pt system-ui,sans-serif;color:#8a94a6}}' +
      '@page :first{@bottom-center{content:none}}' +
      '*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      'body{margin:0;background:#e8ecf3;color:var(--ink);font-family:Georgia,"Iowan Old Style","Times New Roman",serif}' +
      '.paper{width:210mm;max-width:100%;margin:72px auto 32px;padding:15mm 14mm;background:#fff;box-shadow:0 10px 40px #1c26402e;border-radius:4px}' +
      '.bar{position:fixed;inset:0 0 auto;z-index:9;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px 16px;padding:12px 16px;background:#0d1226;color:#e6ecff;font:14px system-ui,sans-serif;text-align:center}' +
      '.bar button{font:inherit;font-weight:700;padding:9px 20px;border:0;border-radius:10px;background:linear-gradient(120deg,#4fe8ff,#9b7bff);color:#04050a;cursor:pointer}' +
      '.cover{position:relative;display:flex;flex-direction:column;min-height:262mm;break-after:page;page-break-after:always}' +
      '.cover-band{display:flex;align-items:center;justify-content:space-between;padding:12mm 12mm 26mm;border-radius:10px;background:linear-gradient(125deg,#0f1b33,#262150 70%,#3a2462);color:#eef4ff}' +
      '.brand{display:flex;align-items:center;gap:9px;font:700 12pt system-ui,sans-serif;letter-spacing:.38em}.brand svg{width:34px;height:26px}' +
      '.band-tag{font:600 9pt system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#a9b8d6}' +
      '.cover-card{margin:-16mm 9mm 0;padding:12mm 11mm;border-radius:10px;background:#fff;border:1px solid var(--line);box-shadow:0 8px 28px #1c26401f}' +
      '.eyebrow{font:700 9pt system-ui,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}' +
      '.cover h1{margin:6px 0 2px;font-size:40pt;line-height:1.08;letter-spacing:-.01em}' +
      '.pair{margin:0;font-size:14pt;font-style:italic;color:var(--muted)}' +
      '.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10mm}' +
      '.stats div{padding:9px 12px;border-radius:9px;background:var(--tint);border:1px solid ' + accent + '33}' +
      '.stats span{display:block;font:600 8pt system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}' +
      '.stats b{display:block;margin-top:2px;font-size:13pt;overflow-wrap:anywhere}' +
      '.legend{margin:8mm 0 0;font:10pt system-ui,sans-serif;color:var(--muted)}' +
      '.art{font-weight:700}.art-der{color:#2563eb}.art-die{color:#dc2626}.art-das{color:#15803d}' +
      '.cover-foot{margin-top:auto;padding-top:10mm;text-align:center;font:9pt system-ui,sans-serif;letter-spacing:.06em;color:#8a94a6}' +
      '.toc{break-after:page;page-break-after:always}' +
      '.toc h2,.cat-head h2{margin:0;font-size:15pt}.toc h2{padding-bottom:6px;margin-bottom:8px;border-bottom:2px solid var(--accent)}' +
      '.toc ol{margin:0;padding:0;list-style:none;columns:2;column-gap:10mm}' +
      '.toc a{display:flex;align-items:baseline;gap:6px;padding:4px 0;color:inherit;text-decoration:none;break-inside:avoid;font-size:10.5pt}' +
      '.toc-no{font:700 8.5pt system-ui,sans-serif;color:var(--accent)}.toc-count{font:9pt system-ui,sans-serif;color:var(--muted)}' +
      '.cat+.cat{margin-top:8mm}' +
      '.cat-head{display:flex;align-items:center;gap:9px;margin-bottom:4mm;padding:7px 12px;border-radius:9px;background:var(--tint);border-inline-start:4px solid var(--accent);break-after:avoid;page-break-after:avoid}' +
      '.cat-head h2{flex:1;line-height:1.3}.cat-no{font:700 9pt system-ui,sans-serif;color:var(--accent)}' +
      '.cat-count{font:600 8.5pt system-ui,sans-serif;color:var(--muted);white-space:nowrap}' +
      '.cols{column-count:2;column-gap:10mm;column-rule:.5pt solid var(--line)}' +
      '.letter{margin:5pt 0 2pt;padding-bottom:1pt;border-bottom:1pt solid ' + accent + '55;font:700 9pt system-ui,sans-serif;letter-spacing:.1em;color:var(--accent);break-after:avoid;page-break-after:avoid}' +
      '.cols>.letter:first-child{margin-top:0}' +
      '.entry{padding:1.6pt 0;font-size:10.3pt;line-height:1.48;break-inside:avoid;page-break-inside:avoid}' +
      '.with-ex .entry{padding:3pt 0}' +
      '.line{display:flex;align-items:baseline;gap:4px}' +
      '.src{flex:0 1 auto;font-weight:700;color:var(--ink);unicode-bidi:isolate' + (lang === 'ar' ? ';font-size:12pt' : '') + '}' +
      '.lvl{flex:none;padding:0 3px;border:.6pt solid var(--accent);border-radius:3px;font:700 6.5pt system-ui,sans-serif;color:var(--accent)}' +
      '.dots{flex:1 1 10px;min-width:8px;border-bottom:1px dotted #c3cad8;transform:translateY(-3px)}' +
      '.tr{flex:0 3 auto;color:#2b3547;text-align:end;unicode-bidi:isolate}' +
      '.ex{margin-inline-start:9px;font-size:8.8pt;font-style:italic;color:#46526a}.ex-tr{margin-inline-start:9px;font:8.4pt system-ui,sans-serif;color:#8a94a6}' +
      '@media screen and (max-width:640px){.paper{margin-top:96px;padding:6vw}.cols,.toc ol{column-count:1;columns:1}.cover{min-height:0}.cover h1{font-size:30pt}.stats{grid-template-columns:1fr}}' +
      '@media print{body{background:#fff}.bar{display:none!important}.paper{width:auto;margin:0;padding:0;box-shadow:none;border-radius:0}}' +
      '</style></head><body>' +
      '<div class="bar">' + esc(C.text('pdfSave')) + '<button onclick="window.print()">' + esc(C.text('pdfPrint')) + '</button></div>' +
      '<main class="paper"><section class="cover"><div class="cover-band"><div class="brand">' + BUTTERFLY + 'LUMIRA</div><div class="band-tag">' + esc(levelText) + '</div></div>' +
      '<div class="cover-card"><div class="eyebrow">' + esc(C.text('wordList')) + '</div><h1>' + esc(names.of(lang)) + '</h1>' +
      '<p class="pair">' + esc(names.of(lang)) + ' → ' + esc(names.of(ui)) + '</p><div class="stats">' +
      '<div><span>' + esc(C.text('level')) + '</span><b>' + esc(levelText) + '</b></div>' +
      '<div><span>' + esc(pdfText('scope')) + '</span><b>' + esc(scope) + '</b></div>' +
      '<div><span>' + esc(pdfText('count')) + '</span><b>' + words.length + '</b></div>' +
      '<div><span>' + esc(pdfText('date')) + '</span><b>' + esc(today) + '</b></div></div>' + legend + '</div>' +
      '<div class="cover-foot">lumira-tr.com · @lumira.learn</div></section>' +
      contents + sections + '</main></body></html>';
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
      pdfText('note'), function (b) {

      var codes = (typeof window.learningLanguageCodes === 'function' ? window.learningLanguageCodes() : ['de','en','ar','fr','es','ru']).filter(function (c) { return c !== nativeLang() && LANG_INFO[c]; });
      var target = typeof TARGET_LANG !== 'undefined' ? TARGET_LANG : 'de';
      var lang = codes.indexOf(target) >= 0 ? target : codes[0], level = 'TÜMÜ', category = '', examples = false, run = 0;

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

      const languageNames = new Intl.DisplayNames([nativeLang()], {type:'language'});
      b.appendChild(chipRow(window.LUMIRA_ACCESS_COPY.text('language'), codes.map(code => ({v:code,t:languageNames.of(code)})), function(){return lang;}, function(v){lang=v;refresh();}));

      b.appendChild(chipRow(window.LUMIRA_ACCESS_COPY.text('level'), [
        { v: 'TÜMÜ', t: window.LUMIRA_ACCESS_COPY.text('all') }, { v: 'A1', t: 'A1' }, { v: 'A2', t: 'A2' },
        { v: 'B1', t: 'B1' }, { v: 'B2', t: 'B2' }
      ], function () { return level; }, function (v) { level = v; refresh(); }));

      /* Kategori: boş değer tüm kategorileri ayrı bölümler hâlinde basar. */
      var catRow = document.createElement('label');
      catRow.className = 'pdf-row';
      catRow.innerHTML = '<span class="pdf-lbl">' + esc(pdfText('category')) + '</span>';
      var select = document.createElement('select');
      select.className = 'pdf-select';
      select.dataset.pdfCategory = '';
      catRow.appendChild(select);
      b.appendChild(catRow);

      var exRow = document.createElement('label');
      exRow.className = 'pdf-check';
      var exBox = document.createElement('input');
      exBox.type = 'checkbox';
      exBox.onchange = function () { examples = exBox.checked; };
      exRow.append(exBox, document.createTextNode(pdfText('examples')));
      b.appendChild(exRow);

      var summary = document.createElement('p');
      summary.className = 'pdf-summary';
      summary.setAttribute('role', 'status');
      b.appendChild(summary);

      var go = document.createElement('button');
      go.type = 'button';
      go.className = 'pwa-btn';
      go.textContent = window.t?window.t('pdf_generate_btn'):'Listeyi oluştur';

      var counts = {}, total = 0;
      function paintSummary() {
        var n = category ? (counts[category] || 0) : total, groups = Object.keys(counts).length;
        summary.textContent = !n ? pdfText('empty') : category ? pdfText('words', { n: n }) : pdfText('words', { n: n }) + ' · ' + pdfText('categories', { n: groups });
        go.disabled = !n;
      }
      select.onchange = function () { category = select.value; paintSummary(); };
      async function refresh() {
        var mine = ++run;
        select.disabled = true; go.disabled = true;
        select.innerHTML = '<option>' + esc(pdfText('loading')) + '</option>';
        summary.textContent = pdfText('loading');
        try { await ensureDeck(lang); } catch (e) {}
        if (mine !== run || !select.isConnected) return;
        var words = collectWords(lang, level, ''), order = new Intl.Collator(nativeLang(), { sensitivity: 'base' });
        counts = {}; total = words.length;
        words.forEach(function (w) { counts[w.cat] = (counts[w.cat] || 0) + 1; });
        if (category && !counts[category]) category = '';
        select.innerHTML = '';
        var all = document.createElement('option');
        all.value = ''; all.textContent = pdfText('allCategories') + ' · ' + total;
        select.appendChild(all);
        Object.keys(counts).map(function (c) { return { c: c, name: window.catName ? window.catName(c) : c }; })
          .sort(function (x, y) { return order.compare(x.name, y.name); })
          .forEach(function (x) { var o = document.createElement('option'); o.value = x.c; o.textContent = x.name + ' · ' + counts[x.c]; select.appendChild(o); });
        select.value = category;
        select.disabled = !total;
        paintSummary();
      }

      go.onclick = async function () {
        go.disabled=true;go.textContent=window.t?window.t('pdf_generating'):'…';
        const F=window.LUMIRA_FEATURES, C=window.LUMIRA_ACCESS_COPY;
        const finish=()=>{go.textContent=window.t?window.t('pdf_generate_btn'):'PDF';paintSummary();};
        // Open synchronously during the click so Safari keeps the user gesture.
        let win=window.open('','_blank'), frame, operation, committed=false;
        try{
          if(win)win.document.body.textContent=C.text('checking');
          await ensureDeck(lang);
          const words=collectWords(lang,level,category);
          if(!words.length)throw new Error(pdfText('empty'));
          const html=buildPdfHtml(lang,level,words,{category:category,examples:examples});
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
      refresh();
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
