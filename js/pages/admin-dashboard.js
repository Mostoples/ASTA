/* ============================================================
   ASTA — Dasbor Admin
   Manajemen pengguna, inventaris perangkat, statistik
   platform, dan tata kelola data (consent + log akses).
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('admin');
  if (!user) return;

  var shell = Shell.mount({
    title: 'Dasbor Admin',
    desc: 'Pengguna, perangkat, dan tata kelola data klinik'
  });
  if (!shell) return;
  var c = shell.content;

  var users = Store.list('users');
  var patients = users.filter(function (u) { return u.role === 'pasien'; });
  var devices = Store.list('devices');
  var sessions = Store.list('sessions');
  var painLogs = Store.list('painLogs');
  var aeAll = Study.adverseEvents();
  var accessLog = Study.accessLog(null, 60);

  // Statistik platform
  var sessions30 = sessions.filter(function (s) {
    return s.date >= U.dayKey(U.addDays(new Date(), -29));
  });
  var activeUsers = patients.filter(function (p) {
    return sessions30.some(function (s) { return s.patientId === p.id; });
  }).length;
  var consentOk = patients.filter(function (p) { return Study.consentValid(p.id); }).length;
  var consentWithdrawn = patients.filter(function (p) {
    var cs = Study.consent(p.id);
    return cs && cs.withdrawn;
  }).length;
  var screeningDue = patients.filter(function (p) { return Study.screeningDue(p.id, 30); }).length;

  c.innerHTML =
    '<section class="grid g4">' +
    UI.statCard({ label: 'Total pengguna', value: users.length, icon: 'users',
      hint: patients.length + ' pasien' }) +
    UI.statCard({ label: 'Pasien aktif 30 hari', value: activeUsers, unit: '/' + patients.length,
      icon: 'activity', tone: activeUsers === patients.length ? 'success' : 'warning',
      hint: U.pct(activeUsers, patients.length) + '% aktif' }) +
    UI.statCard({ label: 'Perangkat terpasang', value: devices.length, icon: 'cpu',
      hint: devices.filter(function (d) { return d.status !== 'baik'; }).length + ' perlu perhatian' }) +
    UI.statCard({ label: 'Sesi 30 hari', value: U.nf(sessions30.length), icon: 'chart',
      hint: U.dur(U.sum(sessions30.map(function (s) { return s.durationMin; }))) + ' total' }) +
    '</section>' +

    /* ===== Tata kelola data ===== */
    '<section class="card">' +
    '<div class="card-head"><div><div class="card-title">Tata kelola data & etik</div>' +
    '<div class="card-sub">Status persetujuan, skrining, dan pelaporan kejadian</div></div></div>' +
    '<div class="grid g4 gap-3">' +
    '<div class="mini-stat"><span class="ms-v ' + (consentOk === patients.length ? 'c-success' : 'c-warning') +
    '">' + consentOk + '/' + patients.length + '</span>' +
    '<span class="ms-l">Consent berlaku</span></div>' +
    '<div class="mini-stat"><span class="ms-v ' + (consentWithdrawn ? 'c-danger' : '') + '">' +
    consentWithdrawn + '</span><span class="ms-l">Consent ditarik</span></div>' +
    '<div class="mini-stat"><span class="ms-v ' + (screeningDue ? 'c-warning' : 'c-success') + '">' +
    screeningDue + '</span><span class="ms-l">Skrining jatuh tempo</span></div>' +
    '<div class="mini-stat"><span class="ms-v ' + (aeAll.filter(function (a) {
      return a.status !== 'selesai';
    }).length ? 'c-warning' : 'c-success') + '">' +
    aeAll.filter(function (a) { return a.status !== 'selesai'; }).length + '</span>' +
    '<span class="ms-l">Kejadian terbuka</span></div>' +
    '</div>' +
    (consentOk < patients.length
      ? '<div class="alert warning mt-4"><span class="a-ico">' + Icon('shield', 17) + '</span>' +
        '<span class="t-sm">' + (patients.length - consentOk) + ' pasien belum memiliki persetujuan ' +
        'yang berlaku untuk versi ' + Study.CONSENT_VERSION + '. Data mereka sebaiknya tidak ' +
        'dimasukkan dalam analisis penelitian sampai persetujuan diperbarui.</span></div>'
      : '<div class="alert success mt-4"><span class="a-ico">' + Icon('checkCircle', 17) + '</span>' +
        '<span class="t-sm">Semua pasien memiliki persetujuan yang berlaku.</span></div>') +
    '</section>' +

    /* ===== Manajemen pengguna ===== */
    '<section class="card">' +
    '<div class="card-head"><div><div class="card-title">Pengguna</div>' +
    '<div class="card-sub">Kelola akun dan peran</div></div>' +
    '<div class="row gap-2">' +
    '<div class="seg" id="seg-role">' +
    '<button data-value="all" aria-selected="true">Semua</button>' +
    Auth.roleList().map(function (r) {
      return '<button data-value="' + r.key + '" aria-selected="false">' + U.esc(r.label) + '</button>';
    }).join('') + '</div>' +
    '<button class="btn btn-sm btn-primary" id="btn-add-user">' + Icon('plus', 15) +
    '<span>Tambah</span></button></div></div>' +
    '<div class="table-wrap"><table class="table"><thead><tr>' +
    '<th>Nama</th><th>Peran</th><th>Email</th><th>Detail</th><th>Consent</th>' +
    '<th>Terakhir masuk</th><th>Status</th><th></th></tr></thead><tbody id="user-table"></tbody></table></div>' +
    '</section>' +

    /* ===== Statistik & inventaris ===== */
    '<section class="grid g2">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Aktivitas platform</div>' +
    '<div class="card-sub">Sesi latihan dan catatan nyeri per minggu</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-activity" data-height="250"></canvas></div>' +
    '<div class="chart-legend mt-3">' +
    '<span><i class="sq" style="background:rgba(43,108,222,.4)"></i>Sesi latihan</span>' +
    '<span><i style="background:#7a5af8"></i>Catatan nyeri</span></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Inventaris perangkat</div>' +
    '<div class="card-sub">' + devices.length + ' unit terpasang</div></div></div>' +
    '<div class="table-wrap"><table class="table"><thead><tr>' +
    '<th>Serial</th><th>Model</th><th>Pasien</th><th>Firmware</th><th>Status</th>' +
    '</tr></thead><tbody>' +
    devices.map(function (d) {
      var p = Store.find('users', d.patientId);
      return '<tr><td class="mono t-xs semi">' + U.esc(d.serial) + '</td>' +
        '<td class="t-xs">' + U.esc(d.model.replace('ASTA Arm v2 ', '')) + '</td>' +
        '<td class="t-xs">' + U.esc(p ? p.name : '-') + '</td>' +
        '<td class="t-xs">' + U.esc(d.firmware) + '</td>' +
        '<td><span class="badge badge-' + (d.status === 'baik' ? 'success'
          : d.status === 'perlu-servis' ? 'danger' : 'warning') + '">' +
        U.esc(U.titlecase(d.status.replace('-', ' '))) + '</span></td></tr>';
    }).join('') + '</tbody></table></div></div></section>' +

    /* ===== Log akses ===== */
    '<section class="card">' +
    '<div class="card-head"><div><div class="card-title">Log akses data pasien</div>' +
    '<div class="card-sub">Jejak audit siapa membuka data siapa</div></div>' +
    '<button class="btn btn-sm" id="btn-log-export">' + Icon('download', 15) +
    '<span>Ekspor log</span></button></div>' +
    (accessLog.length
      ? '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Waktu</th><th>Pelaku</th><th>Peran</th><th>Pasien</th><th>Tindakan</th>' +
        '</tr></thead><tbody>' +
        accessLog.slice(0, 30).map(function (l) {
          var a = Store.find('users', l.actorId);
          var p = Store.find('users', l.patientId);
          var r = a ? Auth.role(a.role) : null;
          return '<tr><td class="t-xs nowrap">' + U.esc(U.fmtDateTime(l.at)) + '</td>' +
            '<td class="semi t-xs">' + U.esc(a ? a.name : l.actorId) + '</td>' +
            '<td class="t-xs">' + U.esc(r ? r.label : '-') + '</td>' +
            '<td class="t-xs">' + U.esc(p ? p.name : l.patientId) + '</td>' +
            '<td><span class="badge">' + U.esc(String(l.action).replace(/-/g, ' ')) + '</span></td></tr>';
        }).join('') + '</tbody></table></div>'
      : UI.empty({ icon: 'shield', title: 'Belum ada akses tercatat' })) +
    '</section>';

  /* ---------------- Tabel pengguna ---------------- */
  var roleFilter = 'all';

  function renderUsers() {
    var list = users.filter(function (u) {
      return roleFilter === 'all' || u.role === roleFilter;
    });
    U.$('#user-table').innerHTML = list.map(function (u) {
      var r = Auth.role(u.role);
      var cs = u.role === 'pasien' ? Study.consent(u.id) : null;
      var detail = u.role === 'pasien'
        ? (u.amputation || {}).level + ' ' + (u.amputation || {}).side
        : (u.title || '') + (u.str ? ' · ' + u.str : '');

      return '<tr>' +
        '<td><span class="row gap-2">' +
        '<span class="avatar sm ' + U.esc(u.avatar || '') + '">' + U.esc(U.initials(u.name)) + '</span>' +
        '<span class="semi">' + U.esc(u.name) + '</span></span></td>' +
        '<td><span class="badge badge-primary">' + Icon(r.icon, 11) + U.esc(r.label) + '</span></td>' +
        '<td class="t-xs">' + U.esc(u.email) + '</td>' +
        '<td class="t-xs muted">' + U.esc(detail) + '</td>' +
        '<td>' + (u.role === 'pasien'
          ? (cs
            ? '<span class="badge badge-' + (cs.withdrawn ? 'danger'
              : Study.consentValid(u.id) ? 'success' : 'warning') + '">' +
              (cs.withdrawn ? 'ditarik' : 'v' + cs.version) + '</span>'
            : '<span class="badge badge-warning">belum ada</span>')
          : '<span class="muted">–</span>') + '</td>' +
        '<td class="t-xs">' + (u.lastLogin ? U.esc(U.ago(u.lastLogin)) : '<span class="muted">belum</span>') + '</td>' +
        '<td>' + (u.active === false
          ? '<span class="badge badge-danger">Nonaktif</span>'
          : '<span class="badge badge-success">Aktif</span>') + '</td>' +
        '<td class="right nowrap">' +
        (u.role === 'pasien'
          ? '<a class="btn btn-ghost btn-icon btn-sm" href="terapis-pasien.html?id=' + U.esc(u.id) +
            '" data-tip="Lihat data" aria-label="Lihat data pasien">' + Icon('eye', 15) + '</a>'
          : '') +
        (u.id !== user.id
          ? '<button class="btn btn-ghost btn-icon btn-sm" data-toggle="' + U.esc(u.id) +
            '" data-tip="' + (u.active === false ? 'Aktifkan' : 'Nonaktifkan') +
            '" aria-label="Ubah status akun">' + Icon(u.active === false ? 'check' : 'lock', 15) + '</button>'
          : '') +
        '</td></tr>';
    }).join('');

    U.on(U.$('#user-table'), 'click', '[data-toggle]', function (e, btn) {
      var u = Store.find('users', btn.dataset.toggle);
      if (!u) return;
      var next = u.active === false;
      UI.confirm({
        title: next ? 'Aktifkan akun?' : 'Nonaktifkan akun?',
        message: next
          ? u.name + ' akan dapat masuk kembali ke ASTA.'
          : u.name + ' tidak akan dapat masuk. Data tetap tersimpan dan tidak dihapus.',
        okLabel: next ? 'Aktifkan' : 'Nonaktifkan',
        danger: !next
      }).then(function (ok) {
        if (!ok) return;
        Store.update('users', u.id, { active: next });
        users = Store.list('users');
        renderUsers();
        UI.toast('Akun ' + u.name + (next ? ' diaktifkan.' : ' dinonaktifkan.'), 'success');
      });
    });
  }

  UI.bindSeg(U.$('#seg-role'), function (v) { roleFilter = v; renderUsers(); });
  renderUsers();

  /* ---------------- Tambah pengguna ---------------- */
  U.$('#btn-add-user').addEventListener('click', function () {
    UI.modal({
      title: 'Tambah pengguna',
      content:
        '<div class="alert warning mb-4"><span class="a-ico">' + Icon('lock', 18) + '</span>' +
        '<span class="t-sm">Pada prototipe ini akun dibuat tanpa kata sandi terenkripsi. ' +
        'Versi produksi wajib memakai autentikasi sisi server.</span></div>' +
        '<div class="field mb-4"><label class="label" for="nu-name">Nama lengkap</label>' +
        '<input class="input" id="nu-name" maxlength="60"></div>' +
        '<div class="field mb-4"><label class="label" for="nu-email">Email</label>' +
        '<input class="input" type="email" id="nu-email" maxlength="80"></div>' +
        '<div class="field mb-4"><span class="label">Peran</span>' +
        '<div class="role-pick" id="nu-role">' +
        Auth.roleList().map(function (r, i) {
          return '<button type="button" class="role-opt" data-r="' + r.key + '" aria-pressed="' +
            (i === 0) + '"><span class="r-ico">' + Icon(r.icon, 18) + '</span>' +
            '<span><span class="r-name">' + U.esc(r.label) + '</span>' +
            '<span class="r-desc">' + U.esc(r.desc) + '</span></span></button>';
        }).join('') + '</div></div>' +
        '<div class="field"><label class="label" for="nu-title">Jabatan / keterangan</label>' +
        '<input class="input" id="nu-title" maxlength="60" placeholder="Opsional"></div>',
      actions: [
        { label: 'Batal' },
        {
          label: 'Tambah', class: 'btn-primary', icon: 'plus',
          onClick: function (m) {
            var name = U.$('#nu-name', m.root).value.trim();
            var email = U.$('#nu-email', m.root).value.trim().toLowerCase();
            var sel = m.root.querySelector('[data-r][aria-pressed="true"]');
            if (name.length < 3) { UI.toast('Nama minimal 3 karakter.', 'warning'); return false; }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              UI.toast('Format email tidak valid.', 'warning'); return false;
            }
            if (users.some(function (u) { return u.email.toLowerCase() === email; })) {
              UI.toast('Email sudah terdaftar.', 'warning'); return false;
            }
            Store.insert('users', {
              role: sel ? sel.dataset.r : 'pasien',
              name: name, email: email,
              title: U.$('#nu-title', m.root).value.trim(),
              active: true,
              avatar: U.pick(['primary', 'teal', 'violet', 'success']),
              joinedAt: U.today(),
              amputation: {}, device: {}
            });
            users = Store.list('users');
            renderUsers();
            UI.toast('Pengguna ' + name + ' ditambahkan.', 'success');
          }
        }
      ],
      onOpen: function (m) {
        U.on(m.root, 'click', '[data-r]', function (e, b) {
          U.$$('[data-r]', m.root).forEach(function (x) {
            x.setAttribute('aria-pressed', String(x === b));
          });
        });
      }
    });
  });

  /* ---------------- Grafik aktivitas ---------------- */
  function drawActivity() {
    var labels = [], ses = [], pain = [];
    for (var w = 11; w >= 0; w--) {
      var end = U.addDays(new Date(), -w * 7);
      var start = U.addDays(end, -6);
      var sk = U.dayKey(start), ek = U.dayKey(end);
      labels.push('W' + (12 - w));
      ses.push(sessions.filter(function (s) { return s.date >= sk && s.date <= ek; }).length);
      pain.push(painLogs.filter(function (p) { return p.date >= sk && p.date <= ek; }).length);
    }
    Chart.line(U.$('#ch-activity'), {
      labels: labels, height: 250, ticks: 4, showDots: false,
      series: [
        { name: 'Sesi', data: ses, color: 'rgba(43,108,222,.4)', type: 'bar' },
        { name: 'Nyeri', data: pain, color: '#7a5af8' }
      ]
    });
  }
  drawActivity();
  Chart.responsive(drawActivity);

  /* ---------------- Ekspor log akses ---------------- */
  U.$('#btn-log-export').addEventListener('click', function () {
    var rows = Study.accessLog(null).map(function (l) {
      var a = Store.find('users', l.actorId);
      var p = Store.find('users', l.patientId);
      return [l.at, a ? a.name : l.actorId, a ? a.role : '', p ? p.name : l.patientId, l.action];
    });
    U.downloadText('asta_log_akses_' + U.today() + '.csv',
      U.toCSV(rows, ['waktu', 'pelaku', 'peran', 'pasien', 'tindakan']),
      'text/csv;charset=utf-8');
    UI.toast('Log akses diunduh (' + rows.length + ' entri).', 'success');
  });
})();
