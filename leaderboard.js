
/* ================================================================
   LEADERBOARD.JS — Firebase Authentication ile kullanıcı adı + şifre
   girişi, kalıcı ve tüm cihazlarda tutarlı liderlik tablosu
   ================================================================

   YENİ MİMARİ (v2):
   - Artık kimlik "isim" değil, Firebase Authentication tarafından
     verilen sabit bir UID (hesap kimliği). Bu, "aynı isim farklı
     yazılınca / boşlukla girilince ilerleme sıfırlanıyor" sınıfı
     hataların kökten önüne geçer.
   - Kullanıcı adı, biçimsel olarak geçerli bir e-postaya çevrilip
     (gerçek mail ATILMIYOR, sadece hesap anahtarı) Firebase'in
     Email/Password sağlayıcısına veriliyor. Şifreler bizim
     veritabanımızda ASLA saklanmıyor.
   - Yeni kullanıcı adı + şifre -> hesap oluşturulur (createUser).
   - Var olan kullanıcı adı + DOĞRU şifre -> o hesaba giriş yapılır.
   - Var olan kullanıcı adı + YANLIŞ şifre -> reddedilir.
   - Tarayıcı aynı kalırsa (aynı cihaz/tarayıcı), Firebase Authentication
     oturumu kendisi hatırlar; sayfa yeniden açıldığında şifre tekrar
     sorulmaz (onAuthStateChanged).
   - Eski (isim tabanlı) ilerleme/liderlik verisi varsa, ilk şifre
     belirlemede otomatik olarak yeni UID anahtarına taşınır.

   TEK YAPMAN GEREKEN ADIM:
   1) https://console.firebase.google.com > projenin var (Mhamzac).
   2) Authentication > Sign-in method > "Email/Password" sağlayıcısını
      ETKİNLEŞTİR (Enable).
   3) Realtime Database > Rules kısmına, ayrıca paylaştığım
      firebase-security-rules.json içeriğini yapıştır ve Publish et.
================================================================ */

const FIREBASE_CONFIG = {
  // Public Firebase browser identifier. netlify.toml safelists this exact
  // value while keeping secret scanning enabled for the rest of the site.
  apiKey: "AIzaSyBHgCtHuIunwlleLCxFCexErrjyZkuNYE0",
  authDomain: "mhamzac-ca73d.firebaseapp.com",
  databaseURL: "https://mhamzac-ca73d-default-rtdb.firebaseio.com",
  projectId: "mhamzac-ca73d",
  storageBucket: "mhamzac-ca73d.firebasestorage.app",
  messagingSenderId: "1002199445271",
  appId: "1:1002199445271:web:2c6620ff1db498c4679152"
};

const FAKE_EMAIL_DOMAIN = '@dilkartlari-user.app';

function initLeaderboard(){
  try{
    const isConfigured = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.indexOf('BURAYA_YAPISTIR') === -1;
    let db = null;
    let authSvc = null;

    if(isConfigured && typeof firebase !== 'undefined'){
      try{
        firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.database();
        authSvc = firebase.auth();
        /* Oturum cihazda kalıcı olsun: uygulama kapanıp açılınca tekrar
           giriş istenmesin. (Varsayılan zaten LOCAL'dir; bazı tarayıcılarda
           SESSION'a düştüğü için açıkça belirtiliyor.) */
        try{
          authSvc.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .catch(function(e){ console.warn('Oturum kalıcılığı ayarlanamadı:', e); });
        }catch(e){}
      }catch(e){ console.warn('Firebase başlatılamadı:', e); }
    } else if(!isConfigured){
      console.warn('Liderlik tablosu: FIREBASE_CONFIG henüz doldurulmadı.');
    } else {
      console.warn('Liderlik tablosu: Firebase SDK yüklenemedi (script src hatası olabilir).');
    }

    /* ---------------- KULLANICI ADI / ANAHTAR YARDIMCILARI ---------------- */
    function sanitizeUsername(name){
      return String(name||'').trim().toLowerCase()
        .replace(/\s+/g,'_')
        .replace(/[^a-z0-9_.]/g,'')
        .slice(0,30);
    }
    // Eski (isim tabanlı) anahtar üretimi — sadece göç (migration) amaçlı.
    function legacyKey(name){
      return String(name||'').trim().toLowerCase().replace(/\s+/g,'_').slice(0,20).replace(/[.#$/\[\]]/g, '_');
    }

    let currentUid = null;
    let currentName = '';

    // progress.js hâlâ window.LB_sanitizeKey(name) çağırıyor; artık isimden
    // bağımsız olarak DAİMA güncel UID'yi döndürüyoruz (tek doğruluk kaynağı).
    window.LB_sanitizeKey = function(name){
      return currentUid || sanitizeUsername(name);
    };

    /* ---------------- GİRİŞ FORMU (isim + şifre) ---------------- */
    const nameOverlay = document.getElementById('nameOverlay');
    const nameInput = document.getElementById('nameInput');
    const passwordInput = document.getElementById('passwordInput');
    const nameSubmit = document.getElementById('nameSubmit');
    const loginErrorEl = document.getElementById('loginError');

    function showNameModal(){ if(nameOverlay) nameOverlay.classList.add('open'); }
    function hideNameModal(){ if(nameOverlay) nameOverlay.classList.remove('open'); }
    function showLoginError(msg){ if(loginErrorEl) loginErrorEl.textContent = msg || ''; }
    function setSubmitLoading(loading){
      if(!nameSubmit) return;
      nameSubmit.disabled = loading;
      nameSubmit.textContent = loading ? 'Kontrol ediliyor…' : 'Başla';
    }

    async function migrateLegacyIfExists(oldKey, uid, displayName){
      if(!db || !oldKey) return;
      try{
        const progSnap = await db.ref('progress/'+oldKey).once('value');
        if(progSnap.exists()){
          const uidProgSnap = await db.ref('progress/'+uid).once('value');
          if(!uidProgSnap.exists()){
            await db.ref('progress/'+uid).set(progSnap.val());
          } else {
            /* Hedefte kayıt varsa eskisini silmeden önce XP'yi koru:
               hangisi yüksekse o kalsın. */
            const oldMeta = (progSnap.val() || {}).meta || {};
            const newMeta = (uidProgSnap.val() || {}).meta || {};
            const bestXp = Math.max(oldMeta.xp || 0, newMeta.xp || 0);
            if(bestXp > (newMeta.xp || 0)){
              await db.ref('progress/'+uid+'/meta/xp').set(bestXp).catch(()=>{});
            }
          }
          await db.ref('progress/'+oldKey).remove().catch(()=>{});
        }
      }catch(e){}
      try{
        const lbSnap = await db.ref('leaderboard/'+oldKey).once('value');
        if(lbSnap.exists()){
          const oldVal = lbSnap.val() || {};
          const uidLbSnap = await db.ref('leaderboard/'+uid).once('value');
          const newVal = uidLbSnap.val() || {};

          /* BİRLEŞTİR, ÜZERİNE YAZMA.
             Eskiden: hedefte kayıt varsa eski kayıt hiç okunmadan siliniyordu
             ve içindeki XP/süre kayboluyordu. Kişi sıralamada bir görünüp
             sonra kayboluyordu. Artık iki kayıttan da YÜKSEK olan değerler
             alınıp birleştiriliyor. */
          const merged = {
            name: displayName || newVal.name || oldVal.name || (window.t?window.t('fallback_user'):'Kullanıcı'),
            xp: Math.max(oldVal.xp || 0, newVal.xp || 0),
            totalSeconds: Math.max(oldVal.totalSeconds || 0, newVal.totalSeconds || 0),
            lastSeen: Date.now()
          };
          await db.ref('leaderboard/'+uid).update(merged);

          /* Eski kaydı ancak birleştirme başarıyla yazıldıktan SONRA sil. */
          await db.ref('leaderboard/'+oldKey).remove().catch(()=>{});
        }
      }catch(e){}
    }

    async function handleLoginSubmit(){
      const rawName = nameInput ? nameInput.value : '';
      const password = passwordInput ? passwordInput.value : '';
      const uname = sanitizeUsername(rawName);
      const displayName = String(rawName||'').trim();

      if(!displayName){ showLoginError(window.t?window.t('err_no_username'):'Lütfen bir kullanıcı adı yaz.'); return; }
      if(!uname){ showLoginError(window.t?window.t('err_invalid_username'):'Kullanıcı adında en az bir harf/rakam olmalı.'); return; }
      if(!password || password.length < 6){ showLoginError(window.t?window.t('err_weak_password'):'Şifre en az 6 karakter olmalı.'); return; }
      if(!authSvc){ showLoginError(window.t?window.t('err_no_connection'):'Bağlantı kurulamadı, lütfen tekrar dene.'); return; }

      showLoginError('');
      setSubmitLoading(true);
      const email = uname + FAKE_EMAIL_DOMAIN;

      try{
        const cred = await authSvc.createUserWithEmailAndPassword(email, password);
        try{ await cred.user.updateProfile({ displayName: displayName }); }catch(e){}
        onAuthSuccess(cred.user.uid, displayName);
      }catch(err){
        console.error('Giriş hatası:', err && err.code, err && err.message);
        if(err && err.code === 'auth/email-already-in-use'){
          try{
            const cred2 = await authSvc.signInWithEmailAndPassword(email, password);
            const dn = cred2.user.displayName || displayName;
            onAuthSuccess(cred2.user.uid, dn);
          }catch(err2){
            console.error('Giriş hatası (signIn):', err2 && err2.code, err2 && err2.message);
            setSubmitLoading(false);
            const unk = window.t ? window.t('err_unknown') : 'bilinmeyen hata';
            if(err2 && (err2.code === 'auth/wrong-password' || err2.code === 'auth/invalid-credential')){
              showLoginError(window.t?window.t('err_username_taken'):'Bu kullanıcı adı zaten alınmış ve şifre yanlış. Lütfen doğru şifreyi gir.');
            } else if(err2 && err2.code === 'auth/too-many-requests'){
              showLoginError(window.t?window.t('err_too_many'):'Çok fazla yanlış deneme yapıldı. Biraz sonra tekrar dene.');
            } else {
              showLoginError(window.t?window.t('err_login_failed')(err2 && err2.code || unk):('Giriş başarısız (' + (err2 && err2.code || unk) + ').'));
            }
          }
        } else if(err && err.code === 'auth/weak-password'){
          setSubmitLoading(false);
          showLoginError(window.t?window.t('err_weak_password'):'Şifre çok zayıf, en az 6 karakter olmalı.');
        } else if(err && err.code === 'auth/invalid-email'){
          setSubmitLoading(false);
          showLoginError(window.t?window.t('err_invalid_chars'):'Kullanıcı adında geçersiz karakterler var, sadece harf/rakam kullan.');
        } else if(err && (err.code === 'auth/operation-not-allowed' || err.code === 'auth/configuration-not-found')){
          setSubmitLoading(false);
          showLoginError(window.t?window.t('err_auth_disabled'):'Giriş sistemi henüz etkin değil: Firebase Console > Authentication > Sign-in method kısmından "Email/Password" sağlayıcısını etkinleştirmen gerekiyor.');
        } else if(err && err.code === 'auth/network-request-failed'){
          setSubmitLoading(false);
          showLoginError(window.t?window.t('err_network'):'İnternet bağlantısı sorunu, lütfen tekrar dene.');
        } else {
          setSubmitLoading(false);
          const unk2 = window.t ? window.t('err_unknown') : 'bilinmeyen hata';
          showLoginError(window.t?window.t('err_generic')(err && err.code || (err && err.message) || unk2):('Hata: ' + (err && err.code || (err && err.message) || unk2)));
        }
      }
    }

    if(nameSubmit){
      nameSubmit.onclick = handleLoginSubmit;
    }
    if(passwordInput){
      passwordInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') handleLoginSubmit(); });
    }
    if(nameInput){
      nameInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter'){ if(passwordInput) passwordInput.focus(); }
      });
    }
    if(!nameSubmit || !nameInput){
      console.warn('Liderlik tablosu: giriş formu elementleri bulunamadı.');
    }

    // First-300 gifts are verified and issued by the account server.
    function onAuthSuccess(uid, displayName){
      setSubmitLoading(false);
      hideNameModal();
      startTrackingWithUid(uid, displayName);
    }

    /* ---------------- SÜRE TAKİBİ (aktiflik bazlı, hile önleyici) ---------------- */
    let heartbeatTimer = null;
    let creditedSeconds = 0;
    let activeAccumulated = 0;
    let lastActivity = Date.now();
    let lastTick = Date.now();
    /* 5 sn idi: her açık uygulama 5 sn'de bir yazınca, tüm tabloyu dinleyen
       herkes saniyede onlarca güncelleme alıyordu. Süre yine kaybolmaz —
       sekme gizlenirken ve kapanırken ayrıca yazılır. */
    const FLUSH_MS = 15000;
    const IDLE_MS = 600000; /* 10 dakika (önceden 1dk) */

    const ACTIVITY_EVENTS = ['click','touchstart','touchmove','mousemove','keydown','scroll','pointerdown'];
    ACTIVITY_EVENTS.forEach(evt => {
      window.addEventListener(evt, () => { lastActivity = Date.now(); }, { passive:true });
    });

    function tickActive(){
      const now = Date.now();
      const idleFor = now - lastActivity;
      if(idleFor < IDLE_MS){
        activeAccumulated += (now - lastTick) / 1000;
      }
      lastTick = now;
    }
    setInterval(tickActive, 1000);

    function isIdleNow(){
      return (Date.now() - lastActivity) >= IDLE_MS;
    }

    async function startTrackingWithUid(uid, name){
      currentUid = uid;
      currentName = name;
      // currentUid az önce belli oldu; yeni bir veritabanı yazması beklemeden
      // önbellekteki son liderlik verisiyle "kaçıncı sıradayım" kutusunu hemen
      // güncelle (aksi halde bir sonraki veri değişikliğine kadar boş görünür).
      renderRanks();
      listenOwnProfile(uid, name);
      // Göçü SADECE ilk kayıtta değil, HER girişte tekrar dene — bu sayede
      // güvenlik kuralları yeni yayınlandığında veya ilk göç bir sebeple
      // başarısız olduğunda, hesap kendi kendini bir sonraki girişte düzeltir.
      // migrateLegacyIfExists zaten "hedefte veri varsa dokunma" mantığında
      // olduğu için tekrar tekrar çağrılması güvenlidir.
      try{ await migrateLegacyIfExists(legacyKey(name), uid, name); }catch(e){}
      // progress.js (kişisel öğrenme modu) UID'nin hazır olduğu anı bekliyor;
      // burada haber veriyoruz ki kendi Firebase dinleyicilerini kursun.
      if(window.LB_onNameReady){
        try{ window.LB_onNameReady(name); }catch(e){}
      }
      if(!db) return;
      if(heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(flushElapsed, FLUSH_MS);
    }

    function listenOwnProfile(uid, name){
      const el = document.getElementById('profileTimer');
      if(!el) return;
      if(!db){
        el.textContent = `👤 ${name} — ${window.t ? window.t('profile_not_connected') : 'profil henüz bağlanmadı'}`;
        return;
      }
      db.ref('leaderboard/' + uid).on('value', (snap) => {
        const val = snap.val();
        /* Sıram, sunucu özetindeki puanlara göre kendi kaydımdan hesaplanır. */
        if(currentUid === uid){ myEntry = val; renderRanks(); }
        const total = val && typeof val.totalSeconds === 'number' ? val.totalSeconds : 0;
        el.textContent = window.t ? window.t('total_time_label')(name, fmtTime(total)) : `👤 ${name} — Toplam süren: ${fmtTime(total)}`;
      });
    }

    function flushElapsed(useBeacon){
      tickActive();
      if(!currentUid) return;
      const delta = activeAccumulated - creditedSeconds;
      if(delta >= 0.5){
        addSeconds(currentUid, currentName, delta, useBeacon);
        creditedSeconds = activeAccumulated;
      }
    }

    function addSeconds(uid, name, seconds, useBeacon){
      if(!uid) return;
      if(authSvc?.currentUser?.uid!==uid)return;
      /* KALDIRILDI: buradaki kimliksiz (auth'suz) REST PUT güvenlik kuralları
         'auth != null' istediği için zaten sessizce reddediliyordu (ölü kod) ve
         kimliksiz yazma yüzeyi bırakıyordu. 'useBeacon' imza uyumu için duruyor
         ama kullanılmıyor; süre aşağıdaki KİMLİKLİ transaction ile yazılır.
         Sekme kapanırken son yazmayı garanti etmek istersen doğru yol,
         önceden alınmış ID token'ı ekleyip '...lastFlushAttempt.json?auth=<token>'
         çağırmaktır (token bayatlarsa güvenilmez olabilir). */
      void useBeacon;
      if(!db) return;
      const ref = db.ref('leaderboard/' + uid);
      ref.transaction((current) => {
        if(authSvc?.currentUser?.uid!==uid)return;
        const prev = current && typeof current === 'object' ? current : { name: name, totalSeconds: 0 };
        /* ÖNEMLİ: Buradan SIFIRDAN yeni bir nesne döndürülüyordu ve içinde "xp"
           alanı yoktu. Süre her kaydedildiğinde (giriş anında, sekme
           değişiminde, düzenli aralıklarla) kişinin XP'si siliniyordu; seviye
           sıralamasında bir görünüp kaybolmasının ve "XP silinmiş gibi"
           düşmesinin sebebi buydu. Artık mevcut alanlar korunuyor. */
        return Object.assign({}, prev, {
          name: String(name || prev.name || (window.t?window.t('fallback_user'):'Kullanıcı')).trim().slice(0,30),
          totalSeconds: Math.max(0,Number(prev.totalSeconds)||0) + Math.max(0,Number(seconds)||0),
          lastSeen: Date.now()
        });
      }).catch(error=>window.PWA?.logError?.({message:'Firebase leaderboard_time: '+String(error?.code||error?.message||'write_failed').replace(/[^a-z_]/gi,'').slice(0,80),stack:''}));
    }

    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'hidden'){
        flushElapsed(true);
      } else {
        flushElapsed();
      }
    });
    window.addEventListener('beforeunload', () => flushElapsed(true));
    window.addEventListener('pagehide', () => flushElapsed(true));

    /* ---------------- LİDERLİK TABLOSU GÖRÜNÜMÜ (splash içinde sabit) ---------------- */
    /* Ayrıntılı süre — profil satırında kullanılır (ör. "4s 39dk"). */
    function fmtTime(totalSeconds){
      const s = Math.max(0, Math.floor(totalSeconds || 0));
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const D = window.t?window.t('day_abbr'):'g', H = window.t?window.t('hour_abbr'):'s', M = window.t?window.t('min_abbr'):'dk', S = window.t?window.t('sec_abbr'):'sn';
      if(d > 0) return `${d}${D} ${h}${H}`;
      if(h > 0) return `${h}${H} ${m}${M}`;
      if(m > 0) return `${m}${M}`;
      return `${s}${S}`;
    }

    /* Sıralama tablosu için kısa süre.
       İsimlere yer kalsın diye tek birim gösterilir:
         1 günü geçtiyse  → "2g +"
         1 saati geçtiyse → "4s +"
         altındaysa       → "42dk" / "35sn" */
    function fmtTimeShort(totalSeconds){
      const s = Math.max(0, Math.floor(totalSeconds || 0));
      const D = window.t?window.t('day_abbr'):'g', H = window.t?window.t('hour_abbr'):'s', M = window.t?window.t('min_abbr'):'dk', S = window.t?window.t('sec_abbr'):'sn';
      const d = Math.floor(s / 86400);
      if(d > 0) return `${d}${D} +`;
      const h = Math.floor(s / 3600);
      if(h > 0) return `${h}${H} +`;
      const m = Math.floor(s / 60);
      if(m > 0) return `${m}${M}`;
      return `${s}${S}`;
    }

    function escapeHtml(s){
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    const MEDALS = ['🥇','🥈','🥉'];

    // XP -> Seviye dönüşümü, progress.js ile BİREBİR aynı formül olmalı
    // (Math.floor(xp/200)+1). Farklı bir formül kullanılırsa kişisel modda
    // gösterilen seviye ile liderlik tablosundaki seviye tutmaz.
    function levelFromXp(xp){
      return Math.floor((xp||0) / 200) + 1;
    }

    // progress.js her meta.xp değiştiğinde (persistMeta) bunu çağırır; böylece
    // liderlik tablosu tek bir 'leaderboard' düğümünden hem süreyi hem de
    // XP/seviyeyi okuyabilir, ekstra bir veri okumasına gerek kalmaz.
    window.LB_updateXp = function(xp){
      if(!currentUid || !db) return;
      if(authSvc?.currentUser?.uid!==currentUid)return;
      const owner=currentUid;
      const ref = db.ref('leaderboard/' + currentUid);
      ref.transaction((current) => {
        if(authSvc?.currentUser?.uid!==owner)return;
        const prev = current && typeof current === 'object' ? current : { name: currentName, totalSeconds: 0 };
        /* XP asla GERİ ALINMAZ.
           Aynı hesapla birden fazla cihaz/sekme açıkken her biri kendi
           belleğindeki değeri yazıyor; biri düşük kalmışsa sıralama sürekli
           bir yükselip bir iniyordu. Artık yalnızca daha yüksek değer geçer. */
        const prevXp = (prev && typeof prev.xp === 'number') ? prev.xp : 0;
        const nextXp = Math.max(prevXp,Math.min(100000000,Number.isFinite(Number(xp))?Math.max(0,Number(xp)):0));
        return Object.assign({}, prev, {
          name: String(currentName || prev.name || (window.t?window.t('fallback_user'):'Kullanıcı')).trim().slice(0,30),
          xp: nextXp,
          lastSeen: Date.now()
        });
      }).catch(error=>window.PWA?.logError?.({message:'Firebase leaderboard_xp: '+String(error?.code||error?.message||'write_failed').replace(/[^a-z_]/gi,'').slice(0,80),stack:''}));
    };
    function renderBoard(elId, entries, formatValue){
      const list = document.getElementById(elId);
      if(!list) return;
      if(!db){
        list.innerHTML = '<div class="lb-empty">'+(window.t?window.t('lb_not_connected'):'Tablo henüz bağlanmadı.')+'</div>';
        return;
      }
      if(!entries.length){
        list.innerHTML = '<div class="lb-empty">'+(window.t?window.t('lb_empty'):'Henüz kimse yok.<br>İlk sen ol! 🎉')+'</div>';
        return;
      }
      list.innerHTML = '';
      entries.forEach((e, i) => {
        const row = document.createElement('div');
        const isMe = e.uid === currentUid;
        row.className = 'lb-row' + (isMe ? ' me' : '');
        const rankDisplay = MEDALS[i] || (i+1);
        row.innerHTML = `
          <div class="lb-rank">${rankDisplay}</div>
          <div class="lb-name">${escapeHtml(e.name)}</div>
          <div class="lb-time">${formatValue(e)}</div>`;
        list.appendChild(row);
      });
    }

    function renderTimeBoard(entries){
      renderBoard('splashLbTimeList', entries, e => fmtTimeShort(e.totalSeconds));
    }
    function renderLevelBoard(entries){
      renderBoard('splashLbLevelList', entries, e => 'Sv ' + levelFromXp(e.xp));
    }

    function renderMyRanks(timeRank, timeTotal, levelRank, levelTotal){
      const box = document.getElementById('myRankBox');
      if(!box) return;
      if(!db){
        box.innerHTML = '<div class="my-rank-empty">🏅 '+(window.t?window.t('lb_not_connected'):'Tablo henüz bağlanmadı.')+'</div>';
        return;
      }
      if(!currentUid){
        box.innerHTML = '<div class="my-rank-empty">'+(window.t?window.t('lb_login_to_see_rank'):'🏅 Sıralamanı görmek için giriş yap')+'</div>';
        return;
      }
      const noData = (window.t ? window.t('no_data_yet') : 'henüz veri yok');
      const timeLbl = (window.t ? window.t('time_rank') : 'Süre sıralaması');
      const levelLbl = (window.t ? window.t('level_rank') : 'Seviye sıralaması');
      const timeTxt = timeRank
        ? `<span class="my-rank-value">${timeRank}.</span><span class="my-rank-total"> / ${timeTotal}</span>`
        : `<span class="my-rank-pending">${noData}</span>`;
      const levelTxt = levelRank
        ? `<span class="my-rank-value">${levelRank}.</span><span class="my-rank-total"> / ${levelTotal}</span>`
        : `<span class="my-rank-pending">${noData}</span>`;
      box.innerHTML = `
        <div class="my-rank-row">
          <span class="my-rank-icon">⏱️</span>
          <span class="my-rank-label">${timeLbl}</span>
          ${timeTxt}
        </div>
        <div class="my-rank-row">
          <span class="my-rank-icon">⭐</span>
          <span class="my-rank-label">${levelLbl}</span>
          ${levelTxt}
        </div>`;
    }

    /* ÖNCEKİ YÖNTEM: Her uygulama 'leaderboard' düğümünün TAMAMINI canlı
       dinliyordu. Her öğrencinin düzenli süre yazımı açık olan bütün
       uygulamalara gönderiliyor, tablo her telefonda yeniden sıralanıyordu;
       kullanıcı sayısı arttıkça Firebase trafiği katlanarak büyüyordu.
       ŞİMDİ: Sunucu tabloyu okuyup özetliyor (ilk 5 + sıralama için yalnızca
       puanlar) ve Netlify CDN bu özeti 5 dakika saklıyor. Uygulama 2 dakikada
       bir (yalnızca ekrandayken) bu küçük özeti alır; kendi süren/XP'in ise
       yalnızca kendi kaydını dinleyen dinleyiciden anlık güncellenir. */
    let lastTop = null, myEntry = null;
    const LB_TOP_KEY = 'lumira_lb_top_v1', LB_CACHE_KEY = 'lumira_lb_cache_v1';
    function summarize(val){
      const rows = Object.entries(val && typeof val === 'object' ? val : {})
        .filter(([, v]) => v && typeof v === 'object' && (v.name || v.xp || v.totalSeconds))
        .map(([uid, v]) => ({ uid, name: String(v.name || '').trim().slice(0, 30), totalSeconds: Math.max(0, Math.floor(Number(v.totalSeconds) || 0)), xp: Math.max(0, Math.floor(Number(v.xp) || 0)) }));
      const byTime = rows.slice().sort((a, b) => b.totalSeconds - a.totalSeconds);
      const byLevel = rows.slice().sort((a, b) => b.xp - a.xp);
      return { updatedAt: Date.now(), total: rows.length, time: byTime.slice(0, 5), level: byLevel.slice(0, 5), timeScores: byTime.map(r => r.totalSeconds), xpScores: byLevel.map(r => r.xp) };
    }
    function validTop(top){ return !!top && Array.isArray(top.time) && Array.isArray(top.level) && Array.isArray(top.timeScores) && Array.isArray(top.xpScores); }
    function readTopCache(){
      try{
        const o = JSON.parse(localStorage.getItem(LB_TOP_KEY) || 'null');
        if(o && validTop(o.v) && Date.now() - (o.t || 0) < 7 * 86400000) return o.v;
        /* Eski sürümün sakladığı ham tablo: bir kez özetlenip gösterilir. */
        const legacy = JSON.parse(localStorage.getItem(LB_CACHE_KEY) || 'null');
        if(legacy && legacy.v && Date.now() - (legacy.t || 0) < 7 * 86400000) return summarize(legacy.v);
      }catch(e){}
      return null;
    }
    /* Puanlar büyükten küçüğe sıralı: sıram = benden yüksek puan sayısı + 1. */
    function rankOf(scores, value){
      if(!Array.isArray(scores) || !Number.isFinite(value)) return null;
      let higher = 0; for(const score of scores){ if(score > value) higher++; else break; }
      return higher + 1;
    }
    function renderRanks(){
      if(!lastTop) return;
      const has = myEntry && (myEntry.name || myEntry.xp || myEntry.totalSeconds);
      if(!currentUid || !has){ renderMyRanks(null, lastTop.total || 0, null, lastTop.total || 0); return; }
      renderMyRanks(
        rankOf(lastTop.timeScores, Math.floor(Number(myEntry.totalSeconds) || 0)), lastTop.total || 0,
        rankOf(lastTop.xpScores, Math.floor(Number(myEntry.xp) || 0)), lastTop.total || 0
      );
    }
    function renderTop(top){
      try { window.__lumLbReady = true; } catch(e){}   /* splash: sıralama hazır sinyali */
      lastTop = top;
      const named = e => ({ ...e, name: e.name || (window.t ? window.t('fallback_user') : 'Kullanıcı') });
      renderTimeBoard(top.time.map(named));
      renderLevelBoard(top.level.map(named));
      renderRanks();
    }

    /* Veri gelene kadar boş kutu yerine yüklenme iskeleti göster */
    function showLbSkeleton(){
      ['splashLbTimeList','splashLbLevelList'].forEach(id => {
        const list = document.getElementById(id);
        if(!list || list.children.length) return;
        list.innerHTML = '<div class="lb-row lb-skel"></div>'.repeat(4);
      });
    }

    let topFetchedAt = 0, topTimer = 0, topFailures = 0, topLoading = false;
    async function refreshTop(){
      clearTimeout(topTimer); topTimer = 0;
      if(document.hidden || topLoading) return;
      topLoading = true;
      try{
        const response = await fetch(window.LUMIRA_BACKEND.url('leaderboard-top'), { credentials: 'omit' });
        const top = response.ok ? await response.json() : null;
        if(!validTop(top)) throw new Error('leaderboard_top');
        topFetchedAt = Date.now(); topFailures = 0;
        renderTop(top);
        try{ localStorage.setItem(LB_TOP_KEY, JSON.stringify({ t: Date.now(), v: top })); localStorage.removeItem(LB_CACHE_KEY); }catch(e){}
      }catch(error){
        topFailures++;
        /* Yeni fonksiyon henüz yayında değilse (veya geçici hata varsa) tablo
           seyrek olarak BİR KEZ okunur — kalıcı bir canlı dinleyici kurulmaz. */
        if(db && (topFailures === 1 || topFailures % 5 === 0)){
          try{ const snap = await db.ref('leaderboard').once('value'); topFetchedAt = Date.now(); renderTop(summarize(snap.val() || {})); }
          catch(err){ if(!lastTop){ renderTimeBoard([]); renderLevelBoard([]); renderMyRanks(null, 0, null, 0); } }
        }else if(!lastTop){ renderTimeBoard([]); renderLevelBoard([]); renderMyRanks(null, 0, null, 0); }
      }finally{
        topLoading = false;
        if(!document.hidden) topTimer = setTimeout(refreshTop, 120000);
      }
    }
    document.addEventListener('visibilitychange', () => {
      if(document.hidden){ clearTimeout(topTimer); topTimer = 0; }
      else if(Date.now() - topFetchedAt > 60000) refreshTop();
      else if(!topTimer && !topLoading) topTimer = setTimeout(refreshTop, 120000);
    });

    function listenLeaderboard(){
      /* Önce cihazdaki son kopya — anında görünür */
      const cached = readTopCache();
      if(cached) { try{ renderTop(cached); }catch(e){} }
      else showLbSkeleton();
      refreshTop();
    }

    /* ---------------- BAŞLAT ---------------- */
    listenLeaderboard();

    /* Firebase, kayıtlı oturumu diskten geri yüklerken kısa bir süre geçer.
       Eskiden LB_checkName bu süre dolmadan çalışıp giriş penceresini açıyordu;
       kullanıcı zaten girişliyken tekrar giriş istenmesinin sebebi buydu.
       Artık önce oturum durumunun netleşmesi bekleniyor. */
    let authResolved = false;
    let loginCheckPending = false;

    function resolveAuth(user){
      authResolved = true;
      if(user){
        const dn = user.displayName || (window.t?window.t('fallback_user'):'Kullanıcı');
        startTrackingWithUid(user.uid, dn);
        hideNameModal();
      } else if(loginCheckPending){
        loginCheckPending = false;
        showNameModal();
      }
    }

    if(authSvc){
      authSvc.onAuthStateChanged(resolveAuth);
      /* Ağ hiç cevap vermezse (çevrimdışı ilk açılış) sonsuza kadar bekleme */
      setTimeout(function(){
        if(!authResolved && !currentUid && loginCheckPending){
          loginCheckPending = false;
          showNameModal();
        }
      }, 6000);
    }

    window.LB_checkName = function(){
      if(currentUid) return;              /* zaten girişli */
      if(!authSvc){ showNameModal(); return; }   /* Firebase yok: eski davranış */
      if(authResolved){ showNameModal(); return; }
      loginCheckPending = true;           /* oturum netleşince karar verilir */
    };
    window.LB_getActiveSeconds = () => activeAccumulated;
    window.LB_isIdle = isIdleNow;
    window.LB_getDb = () => db;
    window.LB_getUid = () => currentUid;
    window.LB_getUserName = () => currentName;
    window.LB_getTotalSeconds = (name, cb) => {
      if(!db || !currentUid){ cb(0); return; }
      db.ref('leaderboard/' + currentUid).once('value').then(snap=>{
        const val = snap.val();
        cb(val && typeof val.totalSeconds === 'number' ? val.totalSeconds : 0);
      }).catch(()=>cb(0));
    };
  }catch(err){
    console.error('Liderlik tablosu başlatılırken hata oluştu:', err);
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initLeaderboard);
} else {
  initLeaderboard();
}
