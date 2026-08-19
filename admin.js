/* ============================================================================
   admin.js — Lumira | Dil Kartları  ·  Yönetici Paneli
   ----------------------------------------------------------------------------
   Yalnızca ADMIN_UIDS listesindeki hesapta görünür. İçindekiler:
     · 📊 Kullanım istatistikleri (analytics.js'in topladığı veriler)
     · ⭐ XP gönderme
     · 🚫 Kullanıcı yasaklama (ilerlemesi yedeklenir, sonra silinir)
     · ✅ Yasak kaldırma (yedekten geri yüklenir)

   ÖNEMLİ: Buradaki gizleme yalnızca arayüz içindir. Gerçek koruma Firebase
   kurallarındadır; yasaklama ve XP yazma işlemleri yönetici UID'si kurala
   yazılmadan çalışmaz.
   ========================================================================== */
(function () {
  'use strict';

  function fb() {
    try {
      return (window.firebase && firebase.apps && firebase.apps.length) ? firebase : null;
    } catch (e) { return null; }
  }
  function db() { var f = fb(); return f ? f.database() : null; }
  function me() { var f = fb(); return f ? f.auth().currentUser : null; }
  function sheet() { return window.PWA && window.PWA.sheet; }
  function toast(m, o) { return (window.PWA && window.PWA.toast) ? window.PWA.toast(m, o) : function () {}; }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  function dayKey(offset) {
    var d = new Date();
    d.setDate(d.getDate() - (offset || 0));
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* =========================================================== ANA PANEL */
  function openAdmin() {
    if (!sheet()) return;
    window.PWA.sheet('🛡️ Yönetici Paneli', 'Yalnızca yönetici hesabında görünür.', function (b) {
      var rows = [
        ['📊', 'Kullanım istatistikleri', 'Günlük kullanıcı, olaylar, quiz hunisi', openStats],
        ['⭐', 'XP gönder',               'Bir kullanıcıya XP ekle',                openXp],
        ['🏅', 'Başarım rozeti ver',      'Özel başarım rozeti (Başarımlar)',       openGiveBadge],
        ['💛', 'Destek rozeti ver',       'Satın alma gibi açar (PDF vb. + XP)',    openGiveSupport],
        ['🚫', 'Kullanıcı yasakla',       'Hesabı kapat, ilerlemesini kaldır',      openBan],
        ['✅', 'Yasağı kaldır',           'Hesabı aç, ilerlemesini geri getir',     openUnban]
      ];
      rows.forEach(function (r) {
        var el = mkRow(r[0], r[1], r[2]);
        el.onclick = r[3];
        b.appendChild(el);
      });
      b.insertAdjacentHTML('beforeend',
        '<p class="pwa-note">Bu işlemler geri alınamaz sonuçlar doğurabilir. ' +
        'Yasaklamada kullanıcının ilerlemesi silinmeden önce yedeklenir, ' +
        'yasak kaldırıldığında geri yüklenir.</p>');
    });
  }
  window.openAdminPanel = openAdmin;

  function mkRow(icon, title, desc, right) {
    var d = document.createElement('div');
    d.className = 'pwa-row';
    d.innerHTML = '<div class="ic">' + icon + '</div><div class="tx"><b>' + title + '</b>' +
                  (desc ? '<span>' + desc + '</span>' : '') + '</div>' + (right || '');
    return d;
  }
  function mkInput(label, type, ph) {
    var d = document.createElement('label');
    d.className = 'pwa-field';
    d.innerHTML = '<span>' + label + '</span><input class="pwa-input" type="' + type +
                  '" placeholder="' + (ph || '') + '" autocomplete="off" spellcheck="false">';
    return d;
  }
  function mkBtn(t, ghost) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pwa-btn' + (ghost ? ' ghost' : '');
    b.textContent = t;
    return b;
  }

  /* ==================================================== 1) İSTATİSTİKLER */
  function openStats() {
    var d = db();
    if (!sheet()) return;
    window.PWA.sheet('📊 Kullanım İstatistikleri', 'Son 7 gün', function (b) {
      if (!d) { b.innerHTML = '<div class="pwa-empty">Bağlantı yok.</div>'; return; }

      var wrap = document.createElement('div');
      wrap.innerHTML = '<div class="pwa-empty">Veriler okunuyor…</div>';
      b.appendChild(wrap);

      Promise.all([
        d.ref('analytics/events').once('value'),
        d.ref('analytics/dau').once('value'),
        d.ref('analytics/funnel').once('value'),
        d.ref('analytics/sessions').once('value')
      ]).then(function (snaps) {
        var ev = snaps[0].val() || {}, dau = snaps[1].val() || {},
            fn = snaps[2].val() || {}, ss = snaps[3].val() || {};
        var days = [];
        for (var i = 0; i < 7; i++) days.push(dayKey(i));

        /* --- günlük aktif kullanıcı --- */
        var dauRows = days.map(function (day) {
          var n = dau[day] ? Object.keys(dau[day]).length : 0;
          return { label: day.slice(5), value: n };
        }).reverse();

        /* --- olay toplamları (7 gün) --- */
        var totals = {};
        days.forEach(function (day) {
          var e = ev[day] || {};
          Object.keys(e).forEach(function (k) { totals[k] = (totals[k] || 0) + (e[k] || 0); });
        });
        var evList = Object.keys(totals).map(function (k) { return { k: k, v: totals[k] }; })
                       .sort(function (a, c) { return c.v - a.v; });

        /* --- huni --- */
        var fStart = 0, fFinish = 0, opens = 0;
        days.forEach(function (day) {
          var f = fn[day] || {};
          fStart += f.quiz_started || 0;
          fFinish += f.quiz_finished || 0;
          opens += (ev[day] && ev[day].app_opened) || 0;
        });

        /* --- oturum --- */
        var sN = 0, sSec = 0;
        days.forEach(function (day) {
          var o = ss[day] || {};
          sN += o.n || 0; sSec += o.totalSec || 0;
        });
        var avgSec = sN ? Math.round(sSec / sN) : 0;

        var TR = {
          app_opened: 'Uygulama açılışı', opened_flashcard: 'Kelime kartı',
          opened_quiz_tab: 'Quiz sekmesi', started_quiz: 'Quiz başlatma',
          finished_quiz: 'Quiz bitirme', played_pronunciation: 'Seslendirme',
          changed_language: 'Dil değiştirme', opened_personal: 'Kişisel mod',
          opened_leaderboard: 'Liderlik tablosu', support_clicked: 'Destek ekranı',
          pdf_exported: 'PDF dışa aktarma', opened_profile: 'Profil'
        };

        var html = '';

        html += '<div class="adm-cards">' +
          card('Günlük aktif', dauRows.length ? dauRows[dauRows.length - 1].value : 0, 'bugün') +
          card('Oturum', sN, 'son 7 gün') +
          card('Ort. süre', avgSec > 59 ? Math.round(avgSec / 60) + ' dk' : avgSec + ' sn', 'oturum başına') +
          '</div>';

        /* DAU çubukları */
        var maxD = Math.max.apply(null, dauRows.map(function (r) { return r.value; }).concat([1]));
        html += '<h4 class="adm-h">Günlük aktif kullanıcı</h4><div class="adm-bars">';
        dauRows.forEach(function (r) {
          html += '<div class="adm-bar"><i style="height:' +
                  Math.max(4, Math.round(r.value / maxD * 100)) + '%"></i>' +
                  '<b>' + r.value + '</b><span>' + r.label + '</span></div>';
        });
        html += '</div>';

        /* huni */
        var pct = function (a, b2) { return b2 ? Math.round(a / b2 * 100) : 0; };
        html += '<h4 class="adm-h">Quiz hunisi (7 gün)</h4><div class="adm-funnel">' +
          funnelRow('Uygulamayı açan', opens, 100) +
          funnelRow('Quiz başlatan', fStart, pct(fStart, opens)) +
          funnelRow('Quizi bitiren', fFinish, pct(fFinish, opens)) +
          '</div>' +
          '<p class="pwa-note" style="margin:6px 2px 0">Tamamlama oranı: <b>' +
          pct(fFinish, fStart) + '%</b> (başlayanlara göre)</p>';

        /* olaylar */
        html += '<h4 class="adm-h">Özellik kullanımı (7 gün)</h4>';
        if (!evList.length) {
          html += '<div class="pwa-empty">Henüz veri yok. Ölçüm yeni başladıysa ' +
                  'birkaç gün beklemek gerekiyor.</div>';
        } else {
          var maxE = evList[0].v || 1;
          html += '<div class="adm-list">';
          evList.forEach(function (e) {
            html += '<div class="adm-item"><span class="n">' + esc(TR[e.k] || e.k) + '</span>' +
                    '<span class="track"><i style="width:' +
                    Math.max(3, Math.round(e.v / maxE * 100)) + '%"></i></span>' +
                    '<b>' + e.v + '</b></div>';
          });
          html += '</div>';
        }

        wrap.innerHTML = html;
      }).catch(function (e) {
        wrap.innerHTML = '<div class="pwa-empty">Okunamadı: ' + esc((e && e.code) || 'izin yok') +
                         '<br><br>Firebase kurallarına <b>analytics</b> izni eklenmiş mi?</div>';
      });
    });
  }
  function card(t, v, s) {
    return '<div class="adm-card"><span class="t">' + t + '</span>' +
           '<b>' + v + '</b><span class="s">' + s + '</span></div>';
  }
  function funnelRow(label, v, p) {
    return '<div class="adm-fn"><span>' + label + '</span>' +
           '<span class="bar"><i style="width:' + Math.max(3, p) + '%"></i></span>' +
           '<b>' + v + '</b></div>';
  }

  /* ============================================ ortak kullanıcı seçici */
  function userPicker(container, onPick) {
    var searchF = mkInput('Kişi ara', 'text', 'İsim yaz…');
    container.appendChild(searchF);
    var list = document.createElement('div');
    list.innerHTML = '<div class="pwa-empty">Kullanıcılar yükleniyor…</div>';
    container.appendChild(list);

    var users = [], selected = null;

    function draw() {
      var q = searchF.querySelector('input').value.trim().toLowerCase();
      var shown = users.filter(function (u) {
        return !q || (u.name || '').toLowerCase().indexOf(q) > -1;
      }).slice(0, 40);
      list.innerHTML = '';
      if (!shown.length) { list.innerHTML = '<div class="pwa-empty">Eşleşen kullanıcı yok.</div>'; return; }
      shown.forEach(function (u) {
        var r = mkRow(u.banned ? '🚫' : '👤', esc(u.name || '(isimsiz)'),
                      (u.xp || 0) + ' XP · Sv ' + (Math.floor((u.xp || 0) / 200) + 1) +
                      (u.banned ? ' · yasaklı' : ''));
        if (selected && selected.uid === u.uid) {
          r.style.borderColor = 'rgba(79,232,255,.6)';
          r.style.background = 'rgba(79,232,255,.10)';
        }
        r.onclick = function () { selected = u; draw(); onPick(u); };
        list.appendChild(r);
      });
    }
    searchF.querySelector('input').addEventListener('input', draw);

    var d = db();
    if (d) {
      Promise.all([
        d.ref('leaderboard').once('value'),
        d.ref('banned').once('value')
      ]).then(function (sn) {
        var val = sn[0].val() || {}, bans = sn[1].val() || {};
        users = Object.keys(val).map(function (uid) {
          return {
            uid: uid,
            name: (val[uid] && val[uid].name) || 'Kullanıcı',
            xp: (val[uid] && val[uid].xp) || 0,
            banned: !!bans[uid]
          };
        }).sort(function (a, c) { return (c.xp || 0) - (a.xp || 0); });
        draw();
      }).catch(function (e) {
        list.innerHTML = '<div class="pwa-empty">Liste okunamadı: ' + esc((e && e.code) || 'hata') + '</div>';
      });
    }
    return { get: function () { return selected; }, refresh: draw };
  }

  /* ================================================== 2) XP GÖNDERME */
  function openXp() {
    if (!sheet()) return;
    window.PWA.sheet('⭐ XP Gönder', 'Seçtiğin kişinin XP\'si kalıcı olarak artar.', function (b) {
      var d = db();
      if (!d) { b.innerHTML = '<div class="pwa-empty">Bağlantı yok.</div>'; return; }

      var amountF = mkInput('Gönderilecek XP', 'number', 'ör. 500');
      b.appendChild(amountF);
      var picker = userPicker(b, function (u) {
        d.ref('progress/' + u.uid + '/meta/xp').once('value').then(function (sn) {
          var real = sn.val();
          if (typeof real === 'number') { u.xp = real; picker.refresh(); }
        }).catch(function () {});
      });

      var send = mkBtn('XP gönder');
      send.onclick = function () {
        var t = picker.get();
        if (!t) { toast('Önce bir kişi seç', { kind: 'bad' }); return; }
        var amount = parseInt(amountF.querySelector('input').value, 10);
        if (!amount || amount <= 0) { toast('Geçerli bir miktar yaz', { kind: 'bad' }); return; }

        send.disabled = true; send.textContent = 'Gönderiliyor…';
        d.ref('progress/' + t.uid + '/meta/xp').once('value').then(function (sn) {
          var cur = typeof sn.val() === 'number' ? sn.val() : (t.xp || 0);
          var next = cur + amount;
          return Promise.all([
            d.ref('progress/' + t.uid + '/meta/xp').set(next),
            d.ref('leaderboard/' + t.uid).update({ xp: next, name: t.name })
          ]).then(function () { return next; });
        }).then(function (next) {
          t.xp = next; picker.refresh();
          send.disabled = false; send.textContent = 'XP gönder';
          amountF.querySelector('input').value = '';
          var m = me();
          if (m && m.uid === t.uid) {
            toast('✅ Gönderildi — yenileniyor…', { kind: 'good' });
            setTimeout(function () { location.reload(); }, 1200);
          } else {
            toast('✅ ' + amount + ' XP gönderildi', { kind: 'good', duration: 6000 });
          }
        }).catch(function (e) {
          send.disabled = false; send.textContent = 'XP gönder';
          toast('Gönderilemedi: ' + ((e && e.code) || 'izin yok'), { kind: 'bad', duration: 8000 });
        });
      };
      b.appendChild(send);
    });
  }

  /* ============================================ 2.5) BAŞARIM ROZETİ VER */
  function openGiveBadge() {
    if (!sheet()) return;
    window.PWA.sheet('🏅 Başarım Rozeti Ver', 'Özel başarım rozeti. Kişinin "Başarımlar" bölümünde görünür.', function (b) {
      var d = db();
      if (!d) { b.innerHTML = '<div class="pwa-empty">Bağlantı yok.</div>'; return; }

      var BADGES = [
        ['sampiyon', '🏆', 'Şampiyon'], ['elmas', '💎', 'Elmas'], ['efsane', '🌟', 'Efsane'],
        ['nisanci', '🎯', 'Nişancı'], ['ates', '🔥', 'Ateş'], ['oncu', '🚀', 'Öncü'],
        ['bilge', '🧠', 'Bilge'], ['kitapkurdu', '📚', 'Kitap Kurdu'], ['birinci', '🥇', 'Birinci'],
        ['madalya', '🏅', 'Madalya'], ['onur', '🎖️', 'Onur'], ['kelebek', '🦋', 'Kelebek']
      ];
      var chosen = null;

      b.insertAdjacentHTML('beforeend', '<p class="pwa-note" style="margin:2px 2px 8px">Rozet seç</p>');
      var grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px';
      BADGES.forEach(function (bd) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.03);color:#e8eef7;font-size:11px;cursor:pointer';
        cell.innerHTML = '<span style="font-size:22px;line-height:1">' + bd[1] + '</span>' + bd[2];
        cell.onclick = function () {
          chosen = bd;
          Array.prototype.forEach.call(grid.children, function (c) {
            c.style.borderColor = 'rgba(255,255,255,.12)'; c.style.background = 'rgba(255,255,255,.03)';
          });
          cell.style.borderColor = 'rgba(255,210,59,.7)'; cell.style.background = 'rgba(255,210,59,.12)';
        };
        grid.appendChild(cell);
      });
      b.appendChild(grid);

      var picker = userPicker(b, function () {});

      var send = mkBtn('Rozet ver');
      send.onclick = function () {
        var t = picker.get();
        if (!t) { toast('Önce bir kişi seç', { kind: 'bad' }); return; }
        if (!chosen) { toast('Önce bir rozet seç', { kind: 'bad' }); return; }
        send.disabled = true; send.textContent = 'Veriliyor…';
        d.ref('progress/' + t.uid + '/meta/awards/' + chosen[0])
          .set({ e: chosen[1], n: chosen[2], ts: Date.now() })
          .then(function () {
            send.disabled = false; send.textContent = 'Rozet ver';
            toast('✅ ' + chosen[1] + ' ' + chosen[2] + ' rozeti verildi', { kind: 'good', duration: 6000 });
          }).catch(function (e) {
            send.disabled = false; send.textContent = 'Rozet ver';
            toast('Verilemedi: ' + ((e && e.code) || 'izin yok'), { kind: 'bad', duration: 8000 });
          });
      };
      b.appendChild(send);
    });
  }

  /* ======================================= 2.6) DESTEK ROZETİ VER (ödüllü)
     Satın alma gibi davranır: rozeti supportGrants'a yazar (uygulama okuyup
     özellikleri açar) + tier XP'sini bir kez ekler. */
  function openGiveSupport() {
    if (!sheet()) return;
    window.PWA.sheet('💛 Destek Rozeti Ver', 'Satın almış gibi rozeti açar, özellikleri ve XP ödülünü verir.', function (b) {
      var d = db();
      if (!d) { b.innerHTML = '<div class="pwa-empty">Bağlantı yok.</div>'; return; }

      var TIERS = [
        [1, '👍🏻', 'Teşekkür', 10], [5, '☕️', 'Kahve', 50], [10, '❤️', 'Destekçi', 100],
        [25, '💛', 'Dost', 250], [50, '⭐️', 'Yıldız', 500], [100, '👑', 'Kurucu', 1000]
      ];
      var chosen = null;

      b.insertAdjacentHTML('beforeend', '<p class="pwa-note" style="margin:2px 2px 8px">Destek rozeti seç (💛 ⭐️ 👑 PDF ve kilitli özellikleri açar)</p>');
      var grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px';
      TIERS.forEach(function (t) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.03);color:#e8eef7;font-size:11px;cursor:pointer';
        cell.innerHTML = '<span style="font-size:22px;line-height:1">' + t[1] + '</span>' + t[2] + '<span style="font-size:9px;color:#8791a3">+' + t[3] + ' XP</span>';
        cell.onclick = function () {
          chosen = t;
          Array.prototype.forEach.call(grid.children, function (c) { c.style.borderColor = 'rgba(255,255,255,.12)'; c.style.background = 'rgba(255,255,255,.03)'; });
          cell.style.borderColor = 'rgba(255,210,59,.7)'; cell.style.background = 'rgba(255,210,59,.12)';
        };
        grid.appendChild(cell);
      });
      b.appendChild(grid);

      var picker = userPicker(b, function () {});

      var send = mkBtn('Rozeti ver');
      send.onclick = function () {
        var u = picker.get();
        if (!u) { toast('Önce bir kişi seç', { kind: 'bad' }); return; }
        if (!chosen) { toast('Önce bir rozet seç', { kind: 'bad' }); return; }
        send.disabled = true; send.textContent = 'Veriliyor…';
        var amount = chosen[0], xp = chosen[3];
        /* XP ödülünü bir kez ekle (mevcut değeri oku, üstüne koy) */
        d.ref('progress/' + u.uid + '/meta/xp').once('value').then(function (sn) {
          var cur = typeof sn.val() === 'number' ? sn.val() : (u.xp || 0);
          var next = cur + xp;
          return Promise.all([
            d.ref('progress/' + u.uid + '/meta/supportGrants/' + amount).set(true),
            d.ref('progress/' + u.uid + '/meta/xp').set(next),
            d.ref('leaderboard/' + u.uid).update({ xp: next, name: u.name })
          ]);
        }).then(function () {
          send.disabled = false; send.textContent = 'Rozeti ver';
          var m = me();
          if (m && m.uid === u.uid) {
            toast('✅ Verildi — yenileniyor…', { kind: 'good' });
            setTimeout(function () { location.reload(); }, 1200);
          } else {
            toast('✅ ' + chosen[1] + ' ' + chosen[2] + ' verildi · +' + xp + ' XP · özellikler açık', { kind: 'good', duration: 7000 });
          }
        }).catch(function (e) {
          send.disabled = false; send.textContent = 'Rozeti ver';
          toast('Verilemedi: ' + ((e && e.code) || 'izin yok'), { kind: 'bad', duration: 8000 });
        });
      };
      b.appendChild(send);
    });
  }

  /* ================================================== 3) YASAKLAMA */
  function openBan() {
    if (!sheet()) return;
    window.PWA.sheet('🚫 Kullanıcı Yasakla',
      'Hesap kapatılır ve ilerlemesi kaldırılır. Veri silinmeden önce yedeklenir.', function (b) {
      var d = db();
      if (!d) { b.innerHTML = '<div class="pwa-empty">Bağlantı yok.</div>'; return; }

      var reasonF = mkInput('Sebep (isteğe bağlı)', 'text', 'ör. hile / uygunsuz ad');
      b.appendChild(reasonF);
      var picker = userPicker(b, function () {});

      var go = mkBtn('Yasakla');
      go.onclick = function () {
        var t = picker.get();
        if (!t) { toast('Önce bir kişi seç', { kind: 'bad' }); return; }
        if (t.banned) { toast('Bu kullanıcı zaten yasaklı', { kind: 'bad' }); return; }
        var m = me();
        if (m && m.uid === t.uid) { toast('Kendini yasaklayamazsın 🙂', { kind: 'bad' }); return; }

        confirmBox('Yasaklansın mı?',
          '<b>' + esc(t.name) + '</b> yasaklanacak, ilerlemesi ve sıralamadaki kaydı ' +
          'kaldırılacak. Veriler yedeklenir; yasağı kaldırdığında geri gelir.',
          function () {
            go.disabled = true; go.textContent = 'İşleniyor…';
            var reason = reasonF.querySelector('input').value.trim();

            Promise.all([
              d.ref('progress/' + t.uid).once('value'),
              d.ref('leaderboard/' + t.uid).once('value')
            ]).then(function (sn) {
              var backup = {
                at: Date.now(),
                by: (m && m.uid) || '',
                reason: reason || null,
                name: t.name,
                progress: sn[0].val() || null,
                leaderboard: sn[1].val() || null
              };
              return d.ref('banned/' + t.uid).set(backup);
            }).then(function () {
              return Promise.all([
                d.ref('progress/' + t.uid).remove(),
                d.ref('leaderboard/' + t.uid).remove()
              ]);
            }).then(function () {
              t.banned = true; picker.refresh();
              go.disabled = false; go.textContent = 'Yasakla';
              toast('🚫 ' + t.name + ' yasaklandı', { kind: 'good', duration: 6000 });
            }).catch(function (e) {
              go.disabled = false; go.textContent = 'Yasakla';
              toast('Yapılamadı: ' + ((e && e.code) || 'izin yok'), { kind: 'bad', duration: 8000 });
            });
          });
      };
      b.appendChild(go);
    });
  }

  /* ================================================ 4) YASAK KALDIRMA */
  function openUnban() {
    if (!sheet()) return;
    window.PWA.sheet('✅ Yasağı Kaldır', 'Yedekten ilerleme geri yüklenir.', function (b) {
      var d = db();
      if (!d) { b.innerHTML = '<div class="pwa-empty">Bağlantı yok.</div>'; return; }

      var list = document.createElement('div');
      list.innerHTML = '<div class="pwa-empty">Yasaklılar okunuyor…</div>';
      b.appendChild(list);

      d.ref('banned').once('value').then(function (sn) {
        var val = sn.val() || {};
        var keys = Object.keys(val);
        if (!keys.length) { list.innerHTML = '<div class="pwa-empty">Yasaklı kullanıcı yok.</div>'; return; }
        list.innerHTML = '';
        keys.forEach(function (uid) {
          var o = val[uid] || {};
          var when = o.at ? new Date(o.at).toLocaleDateString('tr-TR') : '';
          var r = mkRow('🚫', esc(o.name || uid),
                        (o.reason ? esc(o.reason) + ' · ' : '') + when);
          r.onclick = function () {
            confirmBox('Yasak kaldırılsın mı?',
              '<b>' + esc(o.name || uid) + '</b> hesabı açılacak ve ilerlemesi geri yüklenecek.',
              function () {
                var jobs = [];
                if (o.progress) jobs.push(d.ref('progress/' + uid).set(o.progress));
                if (o.leaderboard) jobs.push(d.ref('leaderboard/' + uid).set(o.leaderboard));
                Promise.all(jobs)
                  .then(function () { return d.ref('banned/' + uid).remove(); })
                  .then(function () {
                    r.remove();
                    toast('✅ Yasak kaldırıldı, ilerleme geri yüklendi', { kind: 'good', duration: 6000 });
                  })
                  .catch(function (e) {
                    toast('Yapılamadı: ' + ((e && e.code) || 'izin yok'), { kind: 'bad' });
                  });
              });
          };
          list.appendChild(r);
        });
      }).catch(function (e) {
        list.innerHTML = '<div class="pwa-empty">Okunamadı: ' + esc((e && e.code) || 'hata') + '</div>';
      });
    });
  }

  function confirmBox(title, html, onYes) {
    window.PWA.sheet(title, '', function (b, api) {
      b.insertAdjacentHTML('beforeend', '<p class="lock-msg">' + html + '</p>');
      var y = mkBtn('Evet, onaylıyorum');
      y.onclick = function () { api.close(); onYes(); };
      var n = mkBtn('Vazgeç', true);
      n.onclick = function () { api.close(); };
      b.appendChild(y); b.appendChild(n);
    });
  }

  /* ====================================== yasaklı kullanıcıyı engelle */
  function enforceBan() {
    var d = db(), m = me();
    if (!d || !m) return;
    d.ref('banned/' + m.uid).once('value').then(function (sn) {
      if (!sn.exists()) return;
      var o = sn.val() || {};
      if (window.PWA && window.PWA.sheet) {
        window.PWA.sheet('🚫 Hesabın askıya alındı',
          o.reason ? ('Sebep: ' + esc(o.reason)) : '', function (b) {
          b.insertAdjacentHTML('beforeend',
            '<p class="lock-msg">Bu hesap yönetici tarafından askıya alındı. ' +
            'İtiraz için Instagram üzerinden ulaşabilirsin.</p>');
        });
      }
      try { firebase.auth().signOut(); } catch (e) {}
    }).catch(function () {});
  }

  /* Giriş yapıldığında yasak kontrolü */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      try {
        var f = fb();
        if (f) f.auth().onAuthStateChanged(function (u) { if (u) setTimeout(enforceBan, 1500); });
      } catch (e) {}
    }, 2500);
  });
})();
