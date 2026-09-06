/* ============================================================
   ASTA — Perangkat & EMG
   Osiloskop sEMG realtime, kontrol pola cengkeram, telemetri,
   dan uji umpan balik haptik. Dipakai pasien maupun prostetis.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard(['pasien', 'prostetis']);
  if (!user) return;

  var isPro = user.role === 'prostetis';
  var patient = isPro ? Auth.activePatient() : user;
  if (!patient) {
    document.body.innerHTML = '<p style="padding:40px">Tidak ada pasien terdaftar.</p>';
    return;
  }
  if (isPro) Study.logAccess(user.id, patient.id, 'lihat-telemetri');

  var shell = Shell.mount({
    title: 'Perangkat & EMG',
    desc: isPro ? 'Memantau ' + patient.name : 'Lengan bionik dan sinyal otot Anda'
  });
  if (!shell) return;
  var c = shell.content;

  var dev = Store.list('devices').find(function (d) { return d.patientId === patient.id; });
  var usage7 = Analytics.usageStats(patient.id, 7);
  var usage30 = Analytics.usageStats(patient.id, 30);
  var tel = Analytics.telemetry(patient.id, 30);
  var profile = Device.getProfile();
  var cal = Device.getCal();
  var phase = Study.currentPhase(patient.id);
  var hapticAllowed = Study.hapticAllowed(patient.id);

  var scope = null, meters = null, arm = null;

  c.innerHTML =
    (isPro ? '<section class="card tight"><div class="row between wrap gap-3">' +
      '<div class="row gap-3"><span class="avatar ' + U.esc(patient.avatar || '') + '">' +
      U.esc(U.initials(patient.name)) + '</span>' +
      '<span><span class="semi">' + U.esc(patient.name) + '</span><br>' +
      '<span class="t-xs muted">' + U.esc((dev || {}).serial || '-') + ' · ' +
      U.esc((patient.amputation || {}).level || '') + ' ' +
      U.esc((patient.amputation || {}).side || '') + '</span></span></div>' +
      '<div id="picker-slot"></div></div></section>' : '') +

    (!hapticAllowed && phase
      ? '<div class="alert warning"><span class="a-ico">' + Icon('info', 18) + '</span>' +
        '<span class="t-sm">Fase penelitian <strong>' + U.esc(Study.phaseDef(phase.phase).label) +
        '</strong> sedang berjalan: umpan balik haptik dinonaktifkan sesuai protokol. ' +
        'Pengaturan haptik di bawah dikunci agar data fase tetap sah.</span></div>'
      : '') +

    /* ===== Status koneksi ===== */
    '<section class="card">' +
    '<div class="row between wrap gap-4">' +
    '<div class="row gap-4">' +
    '<span class="stat-ico" style="width:56px;height:56px">' + Icon('cpu', 26) + '</span>' +
    '<div>' +
    '<div class="row gap-2"><span class="dot" id="st-dot"></span>' +
    '<span class="bold t-lg" id="st-label">—</span></div>' +
    '<div class="t-sm muted" id="st-sub">Perangkat ASTA Arm</div>' +
    '</div></div>' +
    '<div class="row gap-2 wrap" id="conn-actions"></div>' +
    '</div>' +
    '<div class="grid g4 gap-3 mt-5" id="live-tel"></div>' +
    '</section>' +

    /* ===== Osiloskop + lengan ===== */
    '<section class="device-hero">' +
    '<div class="card">' +
    '<div class="card-head">' +
    '<div><div class="card-title">Sinyal sEMG realtime</div>' +
    '<div class="card-sub">Garis putus adalah ambang aktivasi tiap kanal. ' +
    'Sinyal di atas ambang menggerakkan aktuator.</div></div>' +
    '<button class="btn btn-sm" id="btn-cal">' + Icon('sliders', 15) + '<span>Kalibrasi</span></button>' +
    '</div>' +
    '<div class="emg-canvas-wrap">' + EmgScope.legend() +
    '<canvas id="scope" data-height="230"></canvas></div>' +
    '<div class="mt-4" id="meters"></div>' +
    '<div class="row gap-2 mt-4 wrap" id="sim-controls"></div>' +
    '</div>' +

    '<div class="col gap-4">' +
    '<div class="card">' +
    '<div class="card-title mb-3">Lengan bionik</div>' +
    '<div class="arm-stage" id="arm" style="min-height:270px">' +
    '<div class="arm-badge"><span class="dot" id="arm-dot"></span>' +
    '<span class="t-xs bold" id="arm-grip">—</span></div></div>' +
    '<div class="row between t-sm mt-3"><span class="muted">Gaya cengkeram</span>' +
    '<span class="bold" id="force-val">0%</span></div>' +
    '<div class="force-gauge mt-2"><i id="force-bar" style="width:0%"></i></div>' +
    '<div class="row between t-sm mt-3"><span class="muted">Rotasi pergelangan</span>' +
    '<span class="bold" id="wrist-val">0°</span></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-title mb-3">Kontrol manual</div>' +
    '<p class="t-xs muted mb-3">Gunakan bila sinyal EMG belum stabil atau untuk menguji pose.</p>' +
    '<div class="field mb-3"><label class="label" for="m-force">Gaya cengkeram</label>' +
    '<input class="range" type="range" id="m-force" min="0" max="100" value="0"></div>' +
    '<div class="field"><label class="label" for="m-wrist">Rotasi pergelangan</label>' +
    '<input class="range" type="range" id="m-wrist" min="-90" max="90" value="0"></div>' +
    '</div>' +
    '</div></section>' +

    /* ===== Pola cengkeram ===== */
    '<section class="grid g-2-1">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Pola cengkeram</div>' +
    '<div class="card-sub">Ganti pola dengan ko-kontraksi fleksor dan ekstensor, atau pilih di sini.</div></div></div>' +
    '<div class="grip-grid" id="grip-grid"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Umpan balik haptik</div>' +
    '<div class="card-sub">' + (hapticAllowed ? 'Getaran sesuai gaya cengkeram' : 'Dikunci oleh protokol') +
    '</div></div></div>' +
    '<div class="haptic-pads mb-4" id="haptic-pads"></div>' +
    '<div class="field mb-3">' +
    '<div class="row between"><label class="label" for="h-int">Intensitas</label>' +
    '<span class="t-sm bold" id="h-int-val">' + profile.hapticIntensity + '%</span></div>' +
    '<input class="range" type="range" id="h-int" min="0" max="100" value="' +
    profile.hapticIntensity + '"' + (hapticAllowed ? '' : ' disabled') + '></div>' +
    '<div class="field mb-4"><label class="label" for="h-mode">Mode</label>' +
    '<select class="select" id="h-mode"' + (hapticAllowed ? '' : ' disabled') + '>' +
    ['proporsional', 'diskret', 'adaptif'].map(function (m) {
      return '<option value="' + m + '"' + (profile.hapticMode === m ? ' selected' : '') + '>' +
        U.titlecase(m) + '</option>';
    }).join('') + '</select></div>' +
    '<label class="switch"><input type="checkbox" id="h-on"' +
    (profile.hapticEnabled && hapticAllowed ? ' checked' : '') +
    (hapticAllowed ? '' : ' disabled') + '>' +
    '<span class="track" aria-hidden="true"></span>' +
    '<span class="t-sm semi">Aktifkan umpan balik haptik</span></label>' +
    '</div></section>' +

    /* ===== Telemetri riwayat ===== */
    '<section class="grid g-2-1">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Riwayat pemakaian 30 hari</div>' +
    '<div class="card-sub">Jam pakai dan mutu sinyal EMG harian</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-usage" data-height="230"></canvas></div>' +
    '<div class="chart-legend mt-3">' +
    '<span><i class="sq" style="background:rgba(43,108,222,.35)"></i>Jam pakai</span>' +
    '<span><i style="background:#10a5a5"></i>Mutu EMG (%)</span>' +
    '<span><i style="background:#7a5af8"></i>Keberhasilan grip (%)</span></div>' +
    '</div>' +

    '<div class="col gap-4">' +
    '<div class="card">' +
    '<div class="card-title mb-3">Ringkasan 7 hari</div>' +
    '<dl class="kv">' +
    '<dt>Rata-rata pakai</dt><dd>' + usage7.wearAvg + ' jam/hari</dd>' +
    '<dt>Total cengkeraman</dt><dd>' + U.nf(usage7.gripTotal) + '</dd>' +
    '<dt>Keberhasilan</dt><dd>' + usage7.successRate + '%</dd>' +
    '<dt>Mutu EMG</dt><dd>' + usage7.emgQuality + '%</dd>' +
    '<dt>Getaran haptik</dt><dd>' + U.nf(usage7.hapticTotal) + '</dd>' +
    '<dt>Gaya rata-rata</dt><dd>' + usage7.forceAvg + '%</dd>' +
    '<dt>Suhu socket</dt><dd>' + usage7.socketTemp + ' °C</dd>' +
    '<dt>Kelembapan</dt><dd>' + usage7.socketHumidity + '%</dd>' +
    '<dt>Re-kalibrasi</dt><dd>' + usage7.recalibrations + 'x</dd>' +
    '</dl></div>' +

    (dev ? '<div class="card">' +
      '<div class="card-title mb-3">Informasi alat</div>' +
      '<dl class="kv">' +
      '<dt>Nomor seri</dt><dd class="mono t-xs">' + U.esc(dev.serial) + '</dd>' +
      '<dt>Model</dt><dd class="t-xs">' + U.esc(dev.model) + '</dd>' +
      '<dt>Firmware</dt><dd>' + U.esc(dev.firmware) + '</dd>' +
      '<dt>Dipasang</dt><dd>' + U.esc(U.fmtDate(dev.fittedAt, 'short')) + '</dd>' +
      '<dt>Servis terakhir</dt><dd>' + U.esc(U.fmtDate(dev.lastService, 'short')) + '</dd>' +
      '<dt>Servis berikut</dt><dd>' + U.esc(U.fmtDate(dev.nextService, 'short')) + '</dd>' +
      '<dt>Siklus aktuator</dt><dd>' + U.nf(dev.actuatorCycles) + '</dd>' +
      '<dt>Kesehatan baterai</dt><dd>' + dev.batteryHealth + '%</dd>' +
      '<dt>Status</dt><dd><span class="badge badge-' +
      (dev.status === 'baik' ? 'success' : dev.status === 'perlu-servis' ? 'danger' : 'warning') + '">' +
      U.esc(U.titlecase(dev.status.replace('-', ' '))) + '</span></dd>' +
      '</dl>' +
      (U.daysBetween(new Date(), U.d(dev.nextService)) <= 14
        ? '<div class="alert warning mt-4"><span class="a-ico">' + Icon('wrench', 17) + '</span>' +
          '<span class="t-xs">Servis berkala dalam ' +
          Math.max(0, U.daysBetween(new Date(), U.d(dev.nextService))) +
          ' hari. Hubungi prostetis Anda untuk penjadwalan.</span></div>'
        : '') +
      '</div>' : '') +
    '</div></section>';

  if (isPro) {
    U.$('#picker-slot').appendChild(Shell.patientPicker(function () { location.reload(); }));
  }

  /* ---------------- Osiloskop, meter, lengan ---------------- */
  scope = EmgScope.create(U.$('#scope'), { height: 230 });
  meters = EmgScope.meters(U.$('#meters'));
  arm = ArmStage.create(U.$('#arm'), {});

  Device.on('signal', U.throttle(function (d) {
    U.$('#force-bar').style.width = d.force + '%';
    U.$('#force-val').textContent = d.force + '%';
    U.$('#wrist-val').textContent = Math.round(Device.state.wristRot) + '°';
    ArmView.highlightElectrodes(arm.svg, d.raw);
  }, 90));

  Device.on('haptic', function (h) {
    U.$$('.haptic-pad').forEach(function (p, i) {
      p.classList.toggle('fire', i === h.pad && h.intensity > 0);
    });
    if (h.intensity > 0) {
      setTimeout(function () {
        U.$$('.haptic-pad').forEach(function (p) { p.classList.remove('fire'); });
      }, 260);
    }
  });

  /* ---------------- Pola cengkeram ---------------- */
  function renderGrips() {
    U.$('#grip-grid').innerHTML = Object.keys(Device.GRIPS).map(function (k) {
      var g = Device.GRIPS[k];
      return '<button class="grip-opt" data-grip="' + k + '" ' +
        'aria-pressed="' + (Device.state.grip === k) + '">' +
        '<span class="g-ico">' + Icon(g.icon, 24) + '</span>' +
        '<span class="g-name">' + U.esc(g.label) + '</span></button>';
    }).join('');
  }
  renderGrips();

  U.on(U.$('#grip-grid'), 'click', '[data-grip]', function (e, btn) {
    if (!Device.state.connected) {
      UI.toast('Hubungkan lengan bionik terlebih dahulu.', 'warning');
      return;
    }
    Device.setGrip(btn.dataset.grip);
  });

  Device.on('grip', function (g) {
    U.$$('[data-grip]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.grip === g.grip));
    });
    var el = U.$('#arm-grip');
    if (el) el.textContent = g.def.label;
  });

  /* ---------------- Haptik ---------------- */
  U.$('#haptic-pads').innerHTML = [0, 1, 2, 3, 4].map(function (i) {
    return '<button class="haptic-pad" data-pad="' + i + '" ' +
      'aria-label="Uji getaran titik ' + (i + 1) + '">' + (i + 1) + '</button>';
  }).join('');

  U.on(U.$('#haptic-pads'), 'click', '[data-pad]', function (e, btn) {
    if (!hapticAllowed) {
      UI.toast('Haptik dikunci pada fase penelitian saat ini.', 'warning');
      return;
    }
    Device.testHaptic(Number(btn.dataset.pad));
  });

  var hInt = U.$('#h-int');
  hInt.addEventListener('input', function () {
    U.$('#h-int-val').textContent = this.value + '%';
  });
  hInt.addEventListener('change', function () {
    Device.saveProfile({ hapticIntensity: Number(this.value) });
    UI.toast('Intensitas haptik disimpan.', 'success', { duration: 1800 });
  });

  U.$('#h-mode').addEventListener('change', function () {
    Device.saveProfile({ hapticMode: this.value });
    UI.toast('Mode haptik: ' + U.titlecase(this.value), 'success', { duration: 1800 });
  });

  U.$('#h-on').addEventListener('change', function () {
    Device.saveProfile({ hapticEnabled: this.checked });
    UI.toast(this.checked ? 'Umpan balik haptik aktif.' : 'Umpan balik haptik dimatikan.', 'info');
  });

  /* ---------------- Kontrol manual ---------------- */
  U.$('#m-force').addEventListener('input', function () {
    if (!Device.state.connected) return;
    Device.setForceManual(Number(this.value));
  });
  U.$('#m-wrist').addEventListener('input', function () {
    if (!Device.state.connected) return;
    Device.setWrist(Number(this.value));
    U.$('#wrist-val').textContent = this.value + '°';
  });

  /* ---------------- Koneksi & telemetri ---------------- */
  function syncStatus() {
    var st = Device.statusText();
    U.$('#st-dot').className = 'dot ' + st.dot;
    U.$('#st-label').textContent = Device.state.connected
      ? (Device.state.deviceName || 'ASTA Arm') : st.label;
    U.$('#st-sub').textContent = Device.state.connected
      ? (Device.state.mode === 'ble' ? 'Terhubung via Bluetooth' : 'Mode simulator aktif') +
        ' · firmware ' + Device.state.firmware
      : 'Perangkat ASTA Arm';

    U.$('#arm-dot').className = 'dot ' + st.dot;
    var ag = U.$('#arm-grip');
    if (ag) ag.textContent = Device.state.connected ? Device.GRIPS[Device.state.grip].label : '—';

    U.$('#conn-actions').innerHTML = Device.state.connected
      ? '<button class="btn" id="btn-recal">' + Icon('refresh', 17) + '<span>Re-kalibrasi cepat</span></button>' +
        '<button class="btn btn-danger" id="btn-disc">' + Icon('x', 17) + '<span>Putuskan</span></button>'
      : '<button class="btn btn-primary btn-lg" id="btn-conn">' + Icon('bluetooth', 19) +
        '<span>Hubungkan Perangkat</span></button>';

    bindConn();
    renderLiveTel();
    renderSimControls();
  }

  function bindConn() {
    var b = U.$('#btn-conn');
    if (b) b.addEventListener('click', connectFlow);
    var d = U.$('#btn-disc');
    if (d) d.addEventListener('click', function () {
      Device.disconnect();
      UI.toast('Perangkat diputuskan.', 'info');
    });
    var r = U.$('#btn-recal');
    if (r) r.addEventListener('click', quickRecal);
  }

  function renderLiveTel() {
    var host = U.$('#live-tel');
    if (!Device.state.connected) {
      host.innerHTML = '<div class="explainer" style="grid-column:1/-1">' +
        '<div class="art">' + Illus.lengan({
          title: 'Skema lengan ASTA: cangkir socket, cangkang siku, lengan bawah ' +
                 'dengan empat elektroda EMG, pergelangan, dan tangan lima jari.'
        }) + '</div>' +
        '<div>' +
          '<h3>Perangkat belum terhubung</h3>' +
          '<p>Hubungkan lengan untuk melihat telemetri langsung: sinyal per kanal, ' +
          'suhu, baterai, dan kualitas kontak elektroda.</p>' +
          '<p>Mode Simulator menghasilkan sinyal sEMG tiruan yang berperilaku seperti ' +
          'alat nyata, sehingga seluruh alur dapat ditelusuri tanpa perangkat keras.</p>' +
        '</div>' +
      '</div>';
      return;
    }
    var s = Device.snapshot();
    host.innerHTML =
      UI.statCard({ label: 'Baterai', value: Math.round(s.battery), unit: '%', icon: 'battery',
        tone: s.battery > 40 ? 'success' : s.battery > 15 ? 'warning' : 'danger' }) +
      UI.statCard({ label: 'Suhu socket', value: s.temp, unit: '°C', icon: 'thermometer',
        tone: s.temp > 37 ? 'warning' : 'teal' }) +
      UI.statCard({ label: 'Mutu sinyal', value: s.signalQuality, unit: '%', icon: 'pulse',
        tone: s.signalQuality > 75 ? 'success' : 'warning' }) +
      UI.statCard({ label: 'Latensi', value: s.latency, unit: 'ms', icon: 'zap',
        tone: s.latency < 50 ? 'success' : 'warning' });
  }

  function renderSimControls() {
    var host = U.$('#sim-controls');
    if (!Device.state.connected || Device.state.mode !== 'mock') { host.innerHTML = ''; return; }
    host.innerHTML = '<span class="t-xs muted shrink-0">Uji kontraksi:</span>' +
      Device.CHANNELS.map(function (ch) {
        return '<button class="btn btn-sm" data-sim="' + ch.id + '" ' +
          'style="border-left:3px solid ' + ch.color + '">' + U.esc(ch.name) + '</button>';
      }).join('') +
      '<button class="btn btn-sm" data-sim="co">Ko-kontraksi (ganti pola)</button>';

    U.on(host, 'click', '[data-sim]', function (e, btn) {
      var v = btn.dataset.sim;
      if (v === 'co') {
        Device.simulateContraction('ch1', 0.9, 900);
        Device.simulateContraction('ch2', 0.9, 900);
      } else {
        Device.simulateContraction(v, 0.92, 1100);
      }
    });
  }

  syncStatus();
  Device.on('connected', syncStatus);
  Device.on('disconnected', syncStatus);
  Device.on('telemetry', renderLiveTel);

  function connectFlow() {
    var bleOk = Device.bleSupported();
    UI.modal({
      title: 'Hubungkan lengan bionik',
      size: 'sm',
      content: '<div class="col gap-3">' +
        '<button class="role-opt" data-mode="ble"' + (bleOk ? '' : ' disabled style="opacity:.5"') + '>' +
        '<span class="r-ico">' + Icon('bluetooth', 19) + '</span>' +
        '<span><span class="r-name">Bluetooth (alat fisik)</span>' +
        '<span class="r-desc">' + (bleOk
          ? 'Pindai perangkat dengan nama ASTA-ARM'
          : 'Perlu Chrome/Edge pada HTTPS atau localhost') + '</span></span></button>' +
        '<button class="role-opt" data-mode="mock">' +
        '<span class="r-ico">' + Icon('cpu', 19) + '</span>' +
        '<span><span class="r-name">Mode Simulator</span>' +
        '<span class="r-desc">Sinyal sEMG tiruan, tidak memerlukan alat</span></span></button></div>',
      actions: [{ label: 'Batal' }],
      onOpen: function (m) {
        U.$$('[data-mode]', m.root).forEach(function (b) {
          b.addEventListener('click', function () {
            if (b.hasAttribute('disabled')) return;
            m.close();
            Device.connect(b.dataset.mode).then(function () {
              UI.toast('Perangkat terhubung. Sinyal EMG aktif.', 'success');
            }).catch(function (err) {
              UI.toast(err.message || 'Gagal menghubungkan.', 'danger', { duration: 7000 });
            });
          });
        });
      }
    });
  }

  /* ---------------- Re-kalibrasi cepat ---------------- */
  function quickRecal() {
    UI.modal({
      title: 'Re-kalibrasi cepat',
      size: 'sm',
      dismissible: false,
      content: '<p class="t-sm muted-2 mb-4">Rileksasikan otot Anda sepenuhnya selama 4 detik. ' +
        'Nilai dasar (baseline) akan diperbarui agar sinyal tidak salah terbaca.</p>' +
        '<div class="prog lg"><i id="rc-prog" style="width:0%"></i></div>' +
        '<div class="center-t mt-3 t-sm semi" id="rc-status">Bersiap…</div>',
      actions: [],
      onOpen: function (m) {
        Device.record('baseline', 4000, function (p) {
          U.$('#rc-prog', m.root).style.width = Math.round(p * 100) + '%';
          U.$('#rc-status', m.root).textContent = p < 1
            ? 'Merekam… tetap rileks (' + Math.ceil((1 - p) * 4) + 's)'
            : 'Menghitung…';
        }).then(function (baseline) {
          Device.saveCal({ baseline: baseline, calibratedAt: new Date().toISOString() });
          m.close();
          UI.toast('Baseline diperbarui. Ambang batas disesuaikan.', 'success');
        });
      }
    });
  }

  U.$('#btn-cal').addEventListener('click', function () {
    location.href = 'kalibrasi.html';
  });

  /* ---------------- Grafik pemakaian ---------------- */
  function drawUsage() {
    Chart.line(U.$('#ch-usage'), {
      labels: tel.map(function (t) { return U.fmtDate(t.date, 'short'); }),
      height: 230, yMax: 100, ticks: 4, yMaxRight: 14, showDots: false,
      series: [
        { name: 'Jam pakai', data: tel.map(function (t) { return t.wearHours; }),
          color: 'rgba(43,108,222,.35)', type: 'bar', axis: 'right' },
        { name: 'Mutu EMG', data: tel.map(function (t) { return t.emgQuality; }), color: '#10a5a5' },
        { name: 'Keberhasilan', data: tel.map(function (t) { return Math.round(t.gripSuccess * 100); }),
          color: '#7a5af8', dashed: true }
      ]
    });
  }
  drawUsage();
  Chart.responsive(drawUsage);

  /* ---------------- Bersihkan ---------------- */
  window.addEventListener('pagehide', function () {
    if (scope) scope.destroy();
    if (meters) meters.destroy();
  });
})();
