/* ============================================================
   ASTA — Notifikasi
   Daftar pengingat, eskalasi, peringatan alat, dan capaian.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard(['pasien', 'terapis', 'prostetis', 'admin']);
  if (!user) return;

  var shell = Shell.mount({
    title: 'Notifikasi',
    desc: 'Pengingat, peringatan, dan kabar dari tim klinis',
    actions: '<button class="btn" id="btn-read-all">' + Icon('check', 18) +
      '<span>Tandai semua dibaca</span></button>'
  });
  if (!shell) return;
  var c = shell.content;

  var TYPES = [
    { key: 'all', label: 'Semua', icon: 'bell' },
    { key: 'reminder', label: 'Pengingat', icon: 'clock' },
    { key: 'eskalasi', label: 'Eskalasi', icon: 'alert' },
    { key: 'nyeri', label: 'Nyeri', icon: 'brain' },
    { key: 'adverse', label: 'Kejadian', icon: 'shield' },
    { key: 'alat', label: 'Perangkat', icon: 'cpu' },
    { key: 'capaian', label: 'Capaian', icon: 'award' },
    { key: 'jadwal', label: 'Jadwal', icon: 'calendar' }
  ];

  var filter = 'all';
  var unreadOnly = false;

  c.innerHTML =
    '<section class="card tight">' +
    '<div class="row between wrap gap-3">' +
    '<div class="tabs" id="tabs" role="tablist"></div>' +
    '<label class="check shrink-0" style="min-height:auto">' +
    '<input type="checkbox" id="only-unread">' +
    '<span class="box" aria-hidden="true"></span>' +
    '<span class="t-sm">Hanya belum dibaca</span></label>' +
    '</div></section>' +

    '<section class="grid g-2-1">' +
    '<div class="col gap-3" id="list"></div>' +

    '<div class="col gap-4">' +
    '<div class="card">' +
    '<div class="card-title mb-4">Ringkasan</div>' +
    '<div class="grid g2 gap-2" id="summary"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Notifikasi sistem</div>' +
    '<div class="card-sub">Agar pengingat sampai walau aplikasi ditutup</div></div></div>' +
    '<div id="perm-box"></div>' +
    '</div>' +

    (user.role === 'pasien'
      ? '<div class="card">' +
        '<div class="card-title mb-3">Cara kerja eskalasi</div>' +
        '<div class="timeline">' +
        '<div class="tl-item"><div class="t-sm semi">Pengingat harian</div>' +
        '<div class="t-xs muted">Sesuai jadwal yang Anda atur</div></div>' +
        '<div class="tl-item warn"><div class="t-sm semi">Jadwal terlewat</div>' +
        '<div class="t-xs muted">Pengingat kedua 90 menit setelahnya</div></div>' +
        '<div class="tl-item warn"><div class="t-sm semi">3 hari kosong</div>' +
        '<div class="t-xs muted">Anda diberi tahu sebelum terapis dikabari</div></div>' +
        '<div class="tl-item bad"><div class="t-sm semi">7 hari kosong</div>' +
        '<div class="t-xs muted">Terapis menerima peringatan risiko putus terapi</div></div>' +
        '</div></div>'
      : '') +
    '</div></section>';

  U.$('#tabs').innerHTML = TYPES.map(function (t) {
    return '<button class="tab" data-f="' + t.key + '" role="tab" aria-selected="' +
      (t.key === filter) + '">' + Icon(t.icon, 15) + ' ' + U.esc(t.label) + '</button>';
  }).join('');

  U.on(U.$('#tabs'), 'click', '[data-f]', function (e, btn) {
    filter = btn.dataset.f;
    U.$$('[data-f]').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.f === filter));
    });
    renderList();
  });

  U.$('#only-unread').addEventListener('change', function () {
    unreadOnly = this.checked;
    renderList();
  });

  U.$('#btn-read-all').addEventListener('click', function () {
    var n = Notify.unreadCount(user.id);
    if (!n) { UI.toast('Tidak ada notifikasi belum dibaca.', 'info'); return; }
    Notify.markAllRead(user.id);
    UI.toast(n + ' notifikasi ditandai sudah dibaca.', 'success');
    renderList(); renderSummary();
  });

  /* ---------------- Daftar ---------------- */
  function renderList() {
    var all = Notify.list(user.id);
    var list = all.filter(function (n) {
      if (filter !== 'all' && n.type !== filter) return false;
      if (unreadOnly && n.read) return false;
      return true;
    });

    var host = U.$('#list');
    if (!list.length) {
      host.innerHTML = '<div class="card">' + UI.empty({
        icon: 'bell', title: 'Tidak ada notifikasi',
        desc: unreadOnly ? 'Semua notifikasi sudah Anda baca.'
          : filter === 'all' ? 'Notifikasi akan muncul di sini.'
            : 'Tidak ada notifikasi pada kategori ini.'
      }) + '</div>';
      return;
    }

    // Kelompokkan menurut hari
    var groups = U.groupBy(list, function (n) { return U.dayKey(n.at); });
    var keys = Object.keys(groups).sort().reverse();

    host.innerHTML = keys.map(function (k) {
      var label = k === U.today() ? 'Hari ini'
        : k === U.dayKey(U.addDays(new Date(), -1)) ? 'Kemarin'
          : U.fmtDate(k, 'dow');
      return '<div class="div-label" style="margin-top:0">' + U.esc(label) + '</div>' +
        groups[k].map(function (n) {
          return '<div class="notif-item' + (n.read ? '' : ' unread') + '" data-id="' + U.esc(n.id) + '">' +
            '<span class="notif-ico ' + toneClass(n.tone) + '">' + Icon(n.icon || 'bell', 19) + '</span>' +
            '<span class="grow" style="min-width:0">' +
            '<span class="row between gap-2">' +
            '<span class="t-sm semi">' + U.esc(n.title) + '</span>' +
            '<span class="t-xs muted nowrap shrink-0">' + U.esc(U.fmtTime(n.at)) + '</span></span>' +
            (n.body ? '<span class="t-sm muted" style="display:block;margin-top:2px">' +
              U.esc(n.body) + '</span>' : '') +
            '<span class="row gap-2 mt-2">' +
            (n.link ? '<a class="btn btn-sm" href="' + U.esc(n.link) + '">' +
              Icon('chevronRight', 14) + '<span>Buka</span></a>' : '') +
            (!n.read ? '<button class="btn btn-sm btn-ghost" data-read="' + U.esc(n.id) + '">' +
              Icon('check', 14) + '<span>Tandai dibaca</span></button>' : '') +
            '<button class="btn btn-sm btn-ghost" data-del="' + U.esc(n.id) + '" ' +
            'aria-label="Hapus notifikasi">' + Icon('trash', 14) + '</button>' +
            '</span></span></div>';
        }).join('');
    }).join('');

    U.on(host, 'click', '[data-read]', function (e, btn) {
      e.stopPropagation();
      Notify.markRead(btn.dataset.read);
      renderList(); renderSummary();
    });
    U.on(host, 'click', '[data-del]', function (e, btn) {
      e.stopPropagation();
      Notify.remove(btn.dataset.del);
      UI.toast('Notifikasi dihapus.', 'info', { duration: 1600 });
      renderList(); renderSummary();
    });
  }

  function toneClass(t) {
    return t === 'danger' ? 'danger' : t === 'warning' ? 'warning'
      : t === 'success' ? 'success' : t === 'violet' ? 'violet' : '';
  }

  /* ---------------- Ringkasan ---------------- */
  function renderSummary() {
    var all = Notify.list(user.id);
    var unread = all.filter(function (n) { return !n.read; }).length;
    var byType = U.groupBy(all, 'type');
    U.$('#summary').innerHTML =
      '<div class="mini-stat"><span class="ms-v">' + all.length + '</span>' +
      '<span class="ms-l">Total</span></div>' +
      '<div class="mini-stat"><span class="ms-v ' + (unread ? 'c-primary' : '') + '">' + unread + '</span>' +
      '<span class="ms-l">Belum dibaca</span></div>' +
      Object.keys(byType).slice(0, 4).map(function (k) {
        var t = TYPES.find(function (x) { return x.key === k; });
        return '<div class="mini-stat"><span class="ms-v">' + byType[k].length + '</span>' +
          '<span class="ms-l">' + U.esc(t ? t.label : k) + '</span></div>';
      }).join('');
  }

  /* ---------------- Izin notifikasi ---------------- */
  function renderPerm() {
    var perm = Notify.permission();
    var st = Store.get('settings', {});
    var host = U.$('#perm-box');

    var statusRow = '<div class="row gap-3 mb-4">' +
      '<span class="dot ' + (perm === 'granted' ? 'dot-live' : perm === 'denied' ? 'dot-danger' : 'dot-off') +
      '"></span><span class="t-sm semi">' +
      (perm === 'granted' ? 'Notifikasi diizinkan'
        : perm === 'denied' ? 'Notifikasi diblokir'
          : perm === 'unsupported' ? 'Tidak didukung peramban'
            : 'Belum diminta') + '</span></div>';

    host.innerHTML = statusRow +
      (perm === 'default'
        ? '<button class="btn btn-primary btn-block mb-3" id="ask-perm">' + Icon('bell', 18) +
          '<span>Izinkan notifikasi</span></button>'
        : perm === 'denied'
          ? '<div class="alert warning mb-3"><span class="a-ico">' + Icon('info', 17) + '</span>' +
            '<span class="t-xs">Izin diblokir pada tingkat peramban. Buka pengaturan situs ' +
            'pada peramban Anda untuk mengizinkannya kembali.</span></div>'
          : '') +
      '<label class="switch mb-3"><input type="checkbox" id="p-push"' +
      (st.notifPush ? ' checked' : '') + '>' +
      '<span class="track" aria-hidden="true"></span>' +
      '<span class="t-sm semi">Kirim notifikasi sistem</span></label>' +
      '<label class="switch mb-3"><input type="checkbox" id="p-sound"' +
      (st.notifSound ? ' checked' : '') + '>' +
      '<span class="track" aria-hidden="true"></span>' +
      '<span class="t-sm semi">Suara notifikasi</span></label>' +
      '<button class="btn btn-block" id="p-test">' + Icon('zap', 17) + '<span>Uji notifikasi</span></button>';

    var ask = U.$('#ask-perm');
    if (ask) ask.addEventListener('click', function () {
      Notify.requestPermission().then(function (r) {
        if (r === 'granted') {
          UI.toast('Notifikasi diizinkan.', 'success');
          Notify.system('Notifikasi aktif', 'ASTA akan mengingatkan jadwal terapi Anda.');
        }
        renderPerm();
      });
    });

    U.$('#p-push').addEventListener('change', function () {
      Store.set('settings', Object.assign(Store.get('settings', {}), { notifPush: this.checked }));
      if (this.checked && Notify.permission() === 'default') Notify.requestPermission().then(renderPerm);
    });
    U.$('#p-sound').addEventListener('change', function () {
      Store.set('settings', Object.assign(Store.get('settings', {}), { notifSound: this.checked }));
    });
    U.$('#p-test').addEventListener('click', function () {
      Notify.push(user.id, {
        type: 'reminder', tone: 'primary', icon: 'bell',
        title: 'Uji notifikasi ASTA',
        body: 'Notifikasi berfungsi. Beginilah pengingat Anda akan tampil.'
      });
      setTimeout(function () { renderList(); renderSummary(); }, 300);
    });
  }

  renderList();
  renderSummary();
  renderPerm();
})();
