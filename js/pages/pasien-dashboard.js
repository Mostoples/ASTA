/* ============================================================
   ASTA — Dasbor Pasien
   Ringkasan harian: jadwal, status alat, nyeri, kepatuhan.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('pasien');
  if (!user) return;

  var pid = user.id;
  var shell = Shell.mount({
    title: 'Dasbor',
    desc: greeting() + ', ' + user.name.split(' ')[0],
    actions: '<a class="btn btn-primary" href="sesi-latihan.html">' + Icon('play', 18) +
      '<span>Mulai Latihan</span></a>'
  });
  if (!shell) return;

  var c = shell.content;

  /* ---------------- Data ---------------- */
  var adh = Analytics.adherence(pid, 14);
  var pain = Analytics.painStats(pid, 14);
  var pain30 = Analytics.painStats(pid, 30);
  var usage = Analytics.usageStats(pid, 7);
  var streak = Analytics.streak(pid);
  var series = Analytics.dailySeries(pid, 21);
  var todaySch = Analytics.todaySchedule(pid);
  var rx = Analytics.prescription(pid);
  var appts = Analytics.upcomingAppointments(pid, 3);
  var achievements = Store.list('achievements').filter(function (a) { return a.patientId === pid; })
    .sort(function (a, b) { return new Date(b.at) - new Date(a.at); });

  var doneToday = todaySch.filter(function (s) { return s.done; }).length;
  var painToday = Store.list('painLogs').find(function (p) { return p.patientId === pid && p.date === U.today(); });

  /* ---------------- Render ---------------- */
  c.innerHTML =
    /* ===== Baris 1: fokus hari ini ===== */
    '<section class="grid g-2-1">' +
    '<div class="card">' +
    '<div class="card-head">' +
    '<div><div class="card-title">Fokus hari ini</div>' +
    '<div class="card-sub">' + U.esc(U.fmtDate(new Date(), 'dow')) + '</div></div>' +
    '<span class="badge ' + (doneToday === todaySch.length ? 'badge-success' : 'badge-primary') + '">' +
    doneToday + '/' + todaySch.length + ' selesai</span>' +
    '</div>' +
    '<div class="col gap-2" id="today-list"></div>' +
    '</div>' +

    '<div class="card center-t">' +
    '<div class="card-title mb-4">Kepatuhan 14 hari</div>' +
    '<div id="adh-ring"></div>' +
    '<div class="badge badge-' + adh.tone + ' mt-4">' + U.esc(adh.label) + '</div>' +
    '<div class="grid g2 gap-2 mt-5" style="text-align:left">' +
    '<div class="mini-stat"><span class="ms-v">' + adh.sessionsDone + '<span class="t-xs muted">/' + adh.sessionsTarget + '</span></span>' +
    '<span class="ms-l">Sesi terlaksana</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' + streak.current + '</span>' +
    '<span class="ms-l">Hari berturut</span></div>' +
    '</div>' +
    '</div>' +
    '</section>' +

    /* ===== Baris 2: statistik ringkas ===== */
    '<section class="grid g4">' +
    UI.statCard({
      label: 'Nyeri phantom', value: pain.avg, unit: '/10', icon: 'brain', tone: 'violet',
      delta: pain30.delta ? U.round(pain30.delta, 1) : null, deltaUnit: ' poin', invert: true,
      hint: '30 hari · ' + pain30.trend
    }) +
    UI.statCard({
      label: 'Pemakaian alat', value: usage.wearAvg, unit: 'jam/hari', icon: 'clock', tone: 'teal',
      hint: 'rata-rata 7 hari'
    }) +
    UI.statCard({
      label: 'Cengkeraman', value: U.nf(usage.gripTotal), unit: 'x', icon: 'hand',
      hint: usage.successRate + '% berhasil'
    }) +
    UI.statCard({
      label: 'Kualitas sinyal', value: usage.emgQuality, unit: '%', icon: 'pulse',
      tone: usage.emgQuality >= 75 ? 'success' : 'warning',
      hint: usage.emgQuality >= 75 ? 'sinyal EMG stabil' : 'pertimbangkan kalibrasi'
    }) +
    '</section>' +

    /* ===== Baris 3: grafik nyeri vs pemakaian + lengan bionik ===== */
    '<section class="grid g-2-1">' +
    '<div class="card">' +
    '<div class="card-head">' +
    '<div><div class="card-title">Nyeri phantom & pemakaian alat</div>' +
    '<div class="card-sub">21 hari terakhir. Perhatikan hubungan antara jam pakai dan skor nyeri.</div></div>' +
    '<a class="btn btn-sm" href="progres.html">' + Icon('chart', 16) + '<span>Analisis</span></a>' +
    '</div>' +
    '<div class="chart-box"><canvas id="ch-main" data-height="238"></canvas></div>' +
    '<div class="chart-legend mt-3">' +
    '<span><i style="background:#7a5af8"></i>Skor nyeri (0-10)</span>' +
    '<span><i class="sq" style="background:rgba(43,108,222,.32)"></i>Jam pakai lengan</span>' +
    '</div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head">' +
    '<div><div class="card-title">Lengan bionik</div>' +
    '<div class="card-sub" id="arm-sub">Status perangkat</div></div>' +
    '</div>' +
    '<div class="arm-stage" id="arm-stage">' +
    '<div class="arm-badge"><span class="dot dot-off" id="arm-dot"></span>' +
    '<span class="t-xs bold" id="arm-status">Tidak terhubung</span></div>' +
    '</div>' +
    '<div class="col gap-2 mt-4">' +
    '<div class="row between t-sm"><span class="muted">Gaya cengkeram</span>' +
    '<span class="bold" id="arm-force">0%</span></div>' +
    '<div class="force-gauge"><i id="arm-force-bar" style="width:0%"></i></div>' +
    '</div>' +
    '<div class="row gap-2 mt-4">' +
    '<button class="btn btn-primary grow" id="btn-connect">' + Icon('bluetooth', 18) +
    '<span>Hubungkan</span></button>' +
    '<a class="btn btn-icon" href="perangkat.html" data-tip="Detail perangkat" aria-label="Detail perangkat">' +
    Icon('chevronRight', 18) + '</a>' +
    '</div>' +
    '</div>' +
    '</section>' +

    /* ===== Baris 4: program, jadwal, capaian ===== */
    '<section class="grid g3">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Program Anda</div>' +
    '<div class="card-sub">' + U.esc(user.program || '-') + '</div></div></div>' +
    '<div class="col gap-3" id="rx-list"></div>' +
    (rx && rx.note ? '<div class="alert info mt-4"><span class="a-ico">' + Icon('stethoscope', 17) + '</span>' +
      '<span class="t-sm"><strong>Catatan terapis:</strong> ' + U.esc(rx.note) + '</span></div>' : '') +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div class="card-title">Jadwal mendatang</div>' +
    '<a class="btn btn-sm btn-ghost" href="jadwal.html">Semua</a></div>' +
    '<div class="col gap-3" id="appt-list"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div class="card-title">Capaian</div>' +
    '<span class="badge badge-success">' + achievements.length + '</span></div>' +
    '<div class="col gap-3" id="ach-list"></div>' +
    '</div>' +
    '</section>';

  /* ---------------- Ring kepatuhan ---------------- */
  U.$('#adh-ring').innerHTML = UI.ring({
    value: adh.score, size: 138, stroke: 14,
    color: 'var(--' + (adh.tone === 'primary' ? 'primary' : adh.tone) + ')',
    aria: 'Skor kepatuhan ' + adh.score + ' persen',
    label: '<div class="t-2xl bold">' + adh.score + '<span class="t-sm muted">%</span></div>' +
      '<div class="t-xs muted">kepatuhan</div>'
  });

  /* ---------------- Daftar tugas hari ini ---------------- */
  var todayHost = U.$('#today-list');
  if (!todaySch.length) {
    todayHost.innerHTML = UI.empty({ icon: 'calendar', title: 'Tidak ada jadwal hari ini', desc: 'Nikmati waktu istirahat Anda.' });
  } else {
    todayHost.innerHTML = todaySch.map(function (s) {
      var ico = s.type === 'nyeri' ? 'brain' : s.type === 'phantom' ? 'mirror' : 'activity';
      var link = s.type === 'nyeri' ? 'catatan-nyeri.html' : s.type === 'phantom' ? 'terapi-phantom.html' : 'sesi-latihan.html';
      var badge = s.done ? '<span class="badge badge-success">' + Icon('check', 13) + 'Selesai</span>'
        : s.overdue ? '<span class="badge badge-warning">Terlewat</span>'
          : '<span class="badge">' + U.esc(s.time) + '</span>';
      return '<a class="sched-item card-link" href="' + link + '" style="box-shadow:var(--nm-1)">' +
        '<span class="sched-time"><span class="h">' + U.esc(s.time.split(':')[0]) + '</span>' +
        '<span class="m">' + U.esc(s.time.split(':')[1]) + '</span></span>' +
        '<span class="stat-ico ' + (s.type === 'nyeri' ? 'violet' : s.type === 'phantom' ? 'teal' : '') + '">' +
        Icon(ico, 20) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="semi truncate" style="display:block">' + U.esc(s.title) + '</span>' +
        '<span class="t-xs muted">' + U.esc(s.durationMin) + ' menit</span></span>' +
        badge + '</a>';
    }).join('');
  }

  // Ingatkan mencatat nyeri bila belum
  if (!painToday) {
    todayHost.insertAdjacentHTML('beforeend',
      '<div class="alert warning mt-2"><span class="a-ico">' + Icon('brain', 18) + '</span>' +
      '<span class="grow t-sm">Anda belum mencatat nyeri hari ini. Data harian membantu terapis melihat pola phantom pain.</span>' +
      '<a class="btn btn-sm btn-primary shrink-0" href="catatan-nyeri.html">Catat</a></div>');
  }

  /* ---------------- Daftar latihan dari resep ---------------- */
  var rxHost = U.$('#rx-list');
  if (!rx || !rx.items.length) {
    rxHost.innerHTML = UI.empty({ icon: 'clipboard', title: 'Belum ada resep', desc: 'Terapis Anda belum menyusun program.' });
  } else {
    rxHost.innerHTML = rx.items.slice(0, 5).map(function (it) {
      var ex = Seed.exercise(it.exId);
      if (!ex) return '';
      var catTone = ex.cat === 'phantom' ? 'violet' : ex.cat === 'adl' ? 'teal' : 'primary';
      return '<div class="row gap-3">' +
        '<span class="stat-ico ' + (catTone === 'primary' ? '' : catTone) + '" style="width:38px;height:38px">' +
        Icon(ex.cat === 'phantom' ? 'brain' : ex.cat === 'adl' ? 'home' : 'activity', 18) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi truncate" style="display:block">' + U.esc(ex.name) + '</span>' +
        '<span class="t-xs muted">' + it.sets + ' set × ' + it.reps + ' ' + U.esc(ex.unit) +
        ' · ' + it.freq + 'x/minggu</span></span>' +
        '</div>';
    }).join('');
    if (rx.items.length > 5) {
      rxHost.insertAdjacentHTML('beforeend',
        '<div class="t-xs muted">+' + (rx.items.length - 5) + ' latihan lainnya</div>');
    }
  }

  /* ---------------- Janji temu ---------------- */
  var apptHost = U.$('#appt-list');
  if (!appts.length) {
    apptHost.innerHTML = UI.empty({ icon: 'calendar', title: 'Tidak ada jadwal', desc: 'Belum ada telekonsultasi terjadwal.' });
  } else {
    apptHost.innerHTML = appts.map(function (a) {
      var withUser = Store.find('users', a.withId);
      var dt = new Date(a.at);
      var soon = dt - Date.now() < 86400000;
      return '<div class="row-t gap-3">' +
        '<span class="stat-ico ' + (a.type === 'kunjungan' ? 'violet' : 'teal') + '" style="width:38px;height:38px">' +
        Icon(a.type === 'kunjungan' ? 'hospital' : 'video', 18) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi truncate" style="display:block">' + U.esc(a.title) + '</span>' +
        '<span class="t-xs muted">' + U.esc(withUser ? withUser.name : '-') + ' · ' +
        U.esc(U.fmtDate(dt, 'short') + ' ' + U.fmtTime(dt)) + '</span></span>' +
        (soon ? '<span class="badge badge-warning shrink-0">Segera</span>' : '') +
        '</div>';
    }).join('');
  }

  /* ---------------- Capaian ---------------- */
  var achHost = U.$('#ach-list');
  if (!achievements.length) {
    achHost.innerHTML = UI.empty({ icon: 'award', title: 'Belum ada capaian', desc: 'Selesaikan 7 hari latihan berturut untuk lencana pertama.' });
  } else {
    achHost.innerHTML = achievements.slice(0, 4).map(function (a) {
      return '<div class="row gap-3">' +
        '<span class="stat-ico success" style="width:38px;height:38px">' + Icon(a.icon || 'award', 18) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi truncate" style="display:block">' + U.esc(a.label) + '</span>' +
        '<span class="t-xs muted">' + U.esc(U.ago(a.at)) + '</span></span></div>';
    }).join('');
  }

  /* ---------------- Grafik utama ---------------- */
  function drawMain() {
    Chart.line(U.$('#ch-main'), {
      labels: series.labels,
      height: 238,
      yMax: 10,
      ticks: 5,
      yMaxRight: 12,
      showDots: series.labels.length <= 24,
      series: [
        { name: 'Jam pakai', data: series.wear, color: 'rgba(43,108,222,.3)', type: 'bar', axis: 'right' },
        { name: 'Nyeri', data: series.pain, color: '#7a5af8', fill: true }
      ]
    });
  }
  drawMain();
  Chart.responsive(drawMain);

  /* ---------------- Lengan bionik ---------------- */
  var arm = ArmStage.create(U.$('#arm-stage'), {});

  var forceBar = U.$('#arm-force-bar');
  var forceVal = U.$('#arm-force');
  Device.on('signal', U.throttle(function (d) {
    forceBar.style.width = d.force + '%';
    forceVal.textContent = d.force + '%';
    ArmView.highlightElectrodes(arm.svg, d.raw);
  }, 90));

  Device.on('grip', function (g) {
    U.$('#arm-sub').textContent = 'Mode: ' + g.def.label;
  });

  function syncDeviceUI() {
    var st = Device.statusText();
    U.$('#arm-dot').className = 'dot ' + st.dot;
    U.$('#arm-status').textContent = st.label;
    var btn = U.$('#btn-connect');
    if (Device.state.connected) {
      btn.innerHTML = Icon('x', 18) + '<span>Putuskan</span>';
      btn.className = 'btn grow';
      U.$('#arm-sub').textContent = 'Baterai ' + Math.round(Device.state.battery) + '% · ' +
        Device.GRIPS[Device.state.grip].label;
    } else {
      btn.innerHTML = Icon('bluetooth', 18) + '<span>Hubungkan</span>';
      btn.className = 'btn btn-primary grow';
      U.$('#arm-sub').textContent = 'Status perangkat';
      forceBar.style.width = '0%';
      forceVal.textContent = '0%';
    }
  }
  syncDeviceUI();
  Device.on('connected', syncDeviceUI);
  Device.on('disconnected', syncDeviceUI);
  Device.on('telemetry', syncDeviceUI);

  U.$('#btn-connect').addEventListener('click', function () {
    if (Device.state.connected) { Device.disconnect(); return; }
    connectFlow();
  });

  function connectFlow() {
    var bleOk = Device.bleSupported();
    UI.modal({
      title: 'Hubungkan lengan bionik',
      size: 'sm',
      content:
        '<p class="t-sm muted-2 mb-4">Pilih cara menghubungkan perangkat ASTA Arm.</p>' +
        '<div class="col gap-3">' +
        '<button class="role-opt" data-mode="ble"' + (bleOk ? '' : ' disabled style="opacity:.5"') + '>' +
        '<span class="r-ico">' + Icon('bluetooth', 19) + '</span>' +
        '<span><span class="r-name">Bluetooth (alat fisik)</span>' +
        '<span class="r-desc">' + (bleOk ? 'Pindai perangkat ASTA-ARM di sekitar' : 'Tidak didukung peramban ini') +
        '</span></span></button>' +
        '<button class="role-opt" data-mode="mock">' +
        '<span class="r-ico">' + Icon('cpu', 19) + '</span>' +
        '<span><span class="r-name">Mode Simulator</span>' +
        '<span class="r-desc">Sinyal sEMG tiruan untuk demo dan uji antarmuka</span></span></button>' +
        '</div>',
      actions: [{ label: 'Batal' }],
      onOpen: function (m) {
        U.$$('[data-mode]', m.root).forEach(function (b) {
          b.addEventListener('click', function () {
            if (b.hasAttribute('disabled')) return;
            m.close();
            var mode = b.dataset.mode;
            UI.toast('Menghubungkan ' + (mode === 'ble' ? 'via Bluetooth' : 'simulator') + '…', 'info', { duration: 1800 });
            Device.connect(mode).then(function () {
              UI.toast('Lengan ASTA terhubung. Sinyal EMG aktif.', 'success');
            }).catch(function (err) {
              UI.toast(err.message || 'Gagal menghubungkan perangkat.', 'danger', { duration: 6500 });
            });
          });
        });
      }
    });
  }

  /* ---------------- Cek capaian baru ---------------- */
  Notify.checkAchievements(pid);

  function greeting() {
    var h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 19) return 'Selamat sore';
    return 'Selamat malam';
  }
})();
