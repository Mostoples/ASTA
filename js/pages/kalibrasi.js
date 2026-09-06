/* ============================================================
   ASTA — Kalibrasi & Tuning
   Wizard tiga langkah: baseline (rileks) → MVC (kontraksi maks)
   → verifikasi. Lalu penyetelan ambang, kecepatan, dan haptik.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard(['pasien', 'prostetis']);
  if (!user) return;

  var isPro = user.role === 'prostetis';
  var patient = isPro ? Auth.activePatient() : user;
  if (isPro && patient) Study.logAccess(user.id, patient.id, 'kalibrasi');

  var shell = Shell.mount({
    title: 'Kalibrasi & Tuning',
    desc: isPro ? 'Menyetel alat ' + (patient ? patient.name : '') : 'Menyesuaikan alat dengan sinyal otot Anda'
  });
  if (!shell) return;
  var c = shell.content;

  var cal = Device.getCal();
  var profile = Device.getProfile();
  var scope = null, meters = null, arm = null;

  // Hasil sementara wizard
  var wiz = { step: 0, baseline: null, mvc: null, running: false };

  c.innerHTML =
    '<div class="alert info">' +
    '<span class="a-ico">' + Icon('info', 18) + '</span>' +
    '<span class="t-sm">Kalibrasi menyesuaikan alat dengan kekuatan otot Anda hari ini. ' +
    'Sinyal otot berubah karena kelelahan, keringat, dan posisi elektroda, jadi kalibrasi ulang ' +
    'secara berkala membuat lengan lebih responsif.</span></div>' +

    '<section class="grid g-2-1">' +
    /* ===== Wizard ===== */
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Wizard kalibrasi</div>' +
    '<div class="card-sub" id="wiz-sub">Tiga langkah, sekitar 1 menit</div></div>' +
    (cal.calibratedAt
      ? '<span class="badge badge-success">' + Icon('check', 12) + 'Terakhir ' +
        U.esc(U.ago(cal.calibratedAt)) + '</span>'
      : '<span class="badge badge-warning">Belum dikalibrasi</span>') +
    '</div>' +

    '<div class="steps mb-5" id="steps"></div>' +
    '<div id="wiz-body"></div>' +
    '</div>' +

    /* ===== Monitor sinyal ===== */
    '<div class="col gap-4">' +
    '<div class="card">' +
    '<div class="card-title mb-3">Sinyal langsung</div>' +
    '<div class="emg-canvas-wrap"><canvas id="scope" data-height="150"></canvas></div>' +
    '<div class="mt-3" id="meters"></div>' +
    '</div>' +
    '<div class="card">' +
    '<div class="card-title mb-3">Lengan</div>' +
    '<div class="arm-stage" id="arm" style="min-height:210px"></div>' +
    '</div>' +
    '</div></section>' +

    /* ===== Penyetelan lanjut ===== */
    '<section class="grid g2">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Ambang batas per kanal</div>' +
    '<div class="card-sub">Nilai terlalu rendah membuat lengan bergerak sendiri. ' +
    'Terlalu tinggi membuat lengan sulit digerakkan.</div></div></div>' +
    '<div class="col gap-4" id="thr-list"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Perilaku aktuator</div>' +
    '<div class="card-sub">Kecepatan, batas gaya, dan kehalusan gerak</div></div></div>' +
    '<div class="col gap-4" id="act-list"></div>' +
    '<div class="row gap-2 mt-5">' +
    '<button class="btn grow" id="btn-reset-prof">' + Icon('refresh', 17) +
    '<span>Kembalikan bawaan</span></button>' +
    '<button class="btn btn-primary grow" id="btn-save-prof">' + Icon('check', 17) +
    '<span>Simpan</span></button>' +
    '</div></div></section>' +

    /* ===== Riwayat kalibrasi ===== */
    '<section class="card">' +
    '<div class="card-head"><div><div class="card-title">Nilai kalibrasi saat ini</div>' +
    '<div class="card-sub">Nilai ternormalisasi 0–1 relatif terhadap kontraksi maksimum</div></div></div>' +
    '<div class="table-wrap"><table class="table"><thead><tr>' +
    '<th>Kanal</th><th>Otot</th><th>Baseline</th><th>MVC</th><th>Ambang</th>' +
    '<th>Rentang dinamis</th><th>Fungsi</th></tr></thead><tbody id="cal-table"></tbody></table></div>' +
    '</section>';

  /* ---------------- Monitor ---------------- */
  scope = EmgScope.create(U.$('#scope'), { height: 150 });
  meters = EmgScope.meters(U.$('#meters'));
  arm = ArmStage.create(U.$('#arm'), {});
  Device.on('signal', U.throttle(function (d) {
    ArmView.highlightElectrodes(arm.svg, d.raw);
  }, 110));

  /* ============================================================
     WIZARD
     ============================================================ */
  var STEPS = [
    { key: 'siap', label: 'Persiapan' },
    { key: 'baseline', label: 'Rileks' },
    { key: 'mvc', label: 'Kontraksi maks' },
    { key: 'verify', label: 'Verifikasi' }
  ];

  function renderSteps() {
    U.$('#steps').innerHTML = STEPS.map(function (s, i) {
      var cls = i < wiz.step ? 'done' : i === wiz.step ? 'now' : '';
      return '<span class="step-dot ' + cls + '">' +
        '<span class="sd">' + (i < wiz.step ? Icon('check', 13) : (i + 1)) + '</span>' +
        '<span>' + U.esc(s.label) + '</span></span>' +
        (i < STEPS.length - 1 ? '<span class="step-line"></span>' : '');
    }).join('');
  }

  function renderWizard() {
    renderSteps();
    var body = U.$('#wiz-body');
    var step = STEPS[wiz.step].key;

    if (!Device.state.connected) {
      body.innerHTML = UI.empty({
        icon: 'bluetooth', title: 'Perangkat belum terhubung',
        desc: 'Kalibrasi memerlukan sinyal langsung dari lengan bionik.',
        action: '<button class="btn btn-primary" id="w-conn">' + Icon('bluetooth', 18) +
          '<span>Hubungkan perangkat</span></button>'
      });
      U.$('#w-conn').addEventListener('click', function () {
        Device.connect('mock').then(function () {
          UI.toast('Simulator terhubung.', 'success');
          renderWizard();
        });
      });
      return;
    }

    if (step === 'siap') {
      body.innerHTML =
        '<div class="col gap-4">' +
        '<p class="t-sm muted-2">Sebelum mulai, pastikan hal berikut:</p>' +
        '<div class="col gap-2">' +
        [['Socket terpasang rapat dan nyaman', 'shield'],
        ['Elektroda menempel pada kulit yang bersih dan kering', 'droplet'],
        ['Anda duduk dengan lengan rileks di atas meja', 'user'],
        ['Tidak baru selesai latihan berat (otot lelah)', 'clock']
        ].map(function (p) {
          return '<div class="row gap-3"><span class="stat-ico" style="width:34px;height:34px">' +
            Icon(p[1], 16) + '</span><span class="t-sm">' + U.esc(p[0]) + '</span></div>';
        }).join('') + '</div>' +
        '<button class="btn btn-primary btn-lg btn-block" id="w-next">' + Icon('play', 19) +
        '<span>Mulai kalibrasi</span></button>' +
        '</div>';
      U.$('#w-next').addEventListener('click', function () { wiz.step = 1; renderWizard(); });
      return;
    }

    if (step === 'baseline' || step === 'mvc') {
      var isBase = step === 'baseline';
      body.innerHTML =
        '<div class="cue-box mb-4" id="w-cue"><div>' +
        '<div class="cue-text">' + (isBase ? 'Rileks sepenuhnya' : 'Kontraksi sekuat mungkin') + '</div>' +
        '<div class="cue-sub">' + (isBase
          ? 'Jangan gerakkan otot lengan selama 5 detik'
          : 'Tegangkan otot lengan bawah sekuat yang Anda bisa, tahan 5 detik') +
        '</div></div>' +
        '<div class="prog lg mb-3"><i id="w-prog" style="width:0%"></i></div>' +
        '<div class="center-t t-sm semi mb-4" id="w-status">Tekan tombol untuk mulai merekam</div>' +
        '<div class="row gap-2">' +
        '<button class="btn grow" id="w-back">' + Icon('chevronLeft', 17) + '<span>Kembali</span></button>' +
        '<button class="btn btn-primary grow" id="w-rec">' + Icon('pulse', 18) +
        '<span>Rekam 5 detik</span></button>' +
        '</div>';

      U.$('#w-back').addEventListener('click', function () {
        if (wiz.running) return;
        wiz.step--; renderWizard();
      });

      U.$('#w-rec').addEventListener('click', function () {
        if (wiz.running) return;
        wiz.running = true;
        var btn = U.$('#w-rec');
        btn.disabled = true;
        U.$('#w-cue').classList.add(isBase ? 'rest' : 'hold');

        Device.record(isBase ? 'baseline' : 'mvc', 5000, function (p) {
          var el = U.$('#w-prog'); if (el) el.style.width = Math.round(p * 100) + '%';
          var st = U.$('#w-status');
          if (st) st.textContent = p < 1
            ? 'Merekam… ' + Math.ceil((1 - p) * 5) + ' detik lagi'
            : 'Menghitung hasil…';
        }).then(function (res) {
          wiz.running = false;
          if (isBase) wiz.baseline = res; else wiz.mvc = res;
          wiz.step++;
          renderWizard();
        });
      });
      return;
    }

    /* --- Verifikasi --- */
    var b = wiz.baseline || cal.baseline;
    var m = wiz.mvc || cal.mvc;
    var problems = [];
    Device.CHANNELS.forEach(function (ch) {
      var range = (m[ch.id] || 0) - (b[ch.id] || 0);
      if (range < 0.12) {
        problems.push(ch.name + ': rentang sinyal sangat kecil (' + U.round(range, 3) +
          '). Periksa posisi elektroda.');
      }
      if ((b[ch.id] || 0) > 0.25) {
        problems.push(ch.name + ': noise dasar tinggi (' + U.round(b[ch.id], 3) +
          '). Pastikan kulit bersih dan kering.');
      }
    });

    body.innerHTML =
      '<div class="table-wrap mb-4"><table class="table"><thead><tr>' +
      '<th>Kanal</th><th>Baseline</th><th>MVC</th><th>Rentang</th><th>Mutu</th>' +
      '</tr></thead><tbody>' +
      Device.CHANNELS.map(function (ch) {
        var range = U.round((m[ch.id] || 0) - (b[ch.id] || 0), 3);
        var good = range >= 0.25;
        var ok = range >= 0.12;
        return '<tr><td class="semi" style="border-left:3px solid ' + ch.color + '">' +
          U.esc(ch.name) + '</td>' +
          '<td class="mono t-xs">' + U.round(b[ch.id] || 0, 3) + '</td>' +
          '<td class="mono t-xs">' + U.round(m[ch.id] || 0, 3) + '</td>' +
          '<td class="mono t-xs">' + range + '</td>' +
          '<td><span class="badge badge-' + (good ? 'success' : ok ? 'warning' : 'danger') + '">' +
          (good ? 'Baik' : ok ? 'Cukup' : 'Lemah') + '</span></td></tr>';
      }).join('') + '</tbody></table></div>' +

      (problems.length
        ? '<div class="alert warning mb-4"><span class="a-ico">' + Icon('alert', 18) + '</span>' +
          '<span class="t-sm"><strong>Perlu diperhatikan:</strong><br>' +
          problems.map(U.esc).join('<br>') + '</span></div>'
        : '<div class="alert success mb-4"><span class="a-ico">' + Icon('checkCircle', 18) + '</span>' +
          '<span class="t-sm">Semua kanal menunjukkan rentang sinyal yang memadai. ' +
          'Ambang batas akan dihitung otomatis dari hasil ini.</span></div>') +

      '<div class="row gap-2">' +
      '<button class="btn grow" id="w-restart">' + Icon('refresh', 17) + '<span>Ulangi</span></button>' +
      '<button class="btn btn-success grow" id="w-apply">' + Icon('check', 18) +
      '<span>Terapkan kalibrasi</span></button></div>';

    U.$('#w-restart').addEventListener('click', function () {
      wiz = { step: 1, baseline: null, mvc: null, running: false };
      renderWizard();
    });

    U.$('#w-apply').addEventListener('click', function () {
      Device.applyCalibration(b, m, true);
      cal = Device.getCal();
      UI.toast('Kalibrasi diterapkan. Ambang batas disesuaikan otomatis.', 'success', { duration: 5000 });

      // Catat sebagai kejadian teknis pada telemetri hari ini
      var todayTel = Store.list('telemetry').find(function (t) {
        return t.patientId === patient.id && t.date === U.today();
      });
      if (todayTel) {
        Store.update('telemetry', todayTel.id, { recalibrations: (todayTel.recalibrations || 0) + 1 });
      }

      if (isPro && patient && patient.id !== user.id) {
        Notify.push(patient.id, {
          type: 'alat', tone: 'success', icon: 'sliders',
          title: 'Alat Anda dikalibrasi ulang',
          body: 'Prostetis ' + user.name + ' menyetel ulang ambang sinyal lengan Anda.',
          link: 'perangkat.html'
        });
      }

      wiz = { step: 0, baseline: null, mvc: null, running: false };
      renderWizard();
      renderThresholds();
      renderCalTable();
    });
  }

  renderWizard();
  Device.on('connected', renderWizard);
  Device.on('disconnected', renderWizard);

  /* ============================================================
     Penyetelan ambang
     ============================================================ */
  function renderThresholds() {
    cal = Device.getCal();
    U.$('#thr-list').innerHTML = Device.CHANNELS.map(function (ch) {
      var v = cal.threshold[ch.id] || 0.3;
      return '<div class="field">' +
        '<div class="row between">' +
        '<label class="label" for="thr-' + ch.id + '" style="border-left:3px solid ' + ch.color +
        ';padding-left:8px">' + U.esc(ch.name) + '</label>' +
        '<span class="t-sm bold mono" id="thrv-' + ch.id + '">' + U.round(v * 100, 0) + '%</span></div>' +
        '<input class="range" type="range" id="thr-' + ch.id + '" data-thr="' + ch.id + '" ' +
        'min="10" max="80" value="' + Math.round(v * 100) + '">' +
        '<span class="hint">' + U.esc(ch.muscle) + ' · ' + U.esc(fnLabel(ch.action)) + '</span>' +
        '</div>';
    }).join('');

    U.$$('[data-thr]').forEach(function (el) {
      el.addEventListener('input', function () {
        U.$('#thrv-' + el.dataset.thr).textContent = el.value + '%';
      });
      el.addEventListener('change', function () {
        var patch = {};
        var cur = Device.getCal().threshold;
        patch[el.dataset.thr] = Number(el.value) / 100;
        Device.saveCal({ threshold: Object.assign({}, cur, patch) });
        UI.toast('Ambang ' + el.dataset.thr + ' disimpan.', 'success', { duration: 1600 });
        renderCalTable();
      });
    });
  }
  renderThresholds();

  function fnLabel(a) {
    return a === 'close' ? 'menutup tangan' : a === 'open' ? 'membuka tangan'
      : a === 'rotate' ? 'rotasi pergelangan' : 'ganti pola cengkeram';
  }

  /* ============================================================
     Perilaku aktuator
     ============================================================ */
  var ACT = [
    { key: 'speed', label: 'Kecepatan aktuator', min: 20, max: 100, unit: '%',
      hint: 'Makin tinggi makin cepat merespons, namun kurang halus.' },
    { key: 'forceLimit', label: 'Batas gaya maksimum', min: 30, max: 100, unit: '%',
      hint: 'Membatasi gaya cengkeram untuk mencegah benda pecah atau socket tertekan.' },
    { key: 'dwellMs', label: 'Waktu tahan ganti pola', min: 120, max: 800, unit: 'ms',
      hint: 'Lama ko-kontraksi yang diperlukan untuk berpindah pola cengkeram.' }
  ];

  function renderActuator() {
    profile = Device.getProfile();
    U.$('#act-list').innerHTML = ACT.map(function (a) {
      var v = profile[a.key];
      return '<div class="field">' +
        '<div class="row between"><label class="label" for="act-' + a.key + '">' +
        U.esc(a.label) + '</label>' +
        '<span class="t-sm bold mono" id="actv-' + a.key + '">' + v + a.unit + '</span></div>' +
        '<input class="range" type="range" id="act-' + a.key + '" data-act="' + a.key + '" ' +
        'min="' + a.min + '" max="' + a.max + '" value="' + v + '">' +
        '<span class="hint">' + U.esc(a.hint) + '</span></div>';
    }).join('') +
      '<div class="field">' +
      '<div class="row between"><label class="label" for="act-smooth">Kehalusan gerak</label>' +
      '<span class="t-sm bold mono" id="actv-smooth">' +
      Math.round(profile.smoothing * 100) + '%</span></div>' +
      '<input class="range" type="range" id="act-smooth" min="5" max="60" value="' +
      Math.round(profile.smoothing * 100) + '">' +
      '<span class="hint">Nilai rendah membuat gerak lebih halus namun terasa lebih lambat.</span></div>' +
      '<label class="switch mt-2"><input type="checkbox" id="act-auto"' +
      (profile.autoGrip ? ' checked' : '') + '>' +
      '<span class="track" aria-hidden="true"></span>' +
      '<span class="t-sm semi">Pilih pola cengkeram otomatis dari pola kontraksi</span></label>';

    U.$$('[data-act]').forEach(function (el) {
      el.addEventListener('input', function () {
        var a = ACT.find(function (x) { return x.key === el.dataset.act; });
        U.$('#actv-' + el.dataset.act).textContent = el.value + a.unit;
      });
    });
    U.$('#act-smooth').addEventListener('input', function () {
      U.$('#actv-smooth').textContent = this.value + '%';
    });
  }
  renderActuator();

  U.$('#btn-save-prof').addEventListener('click', function () {
    var patch = { smoothing: Number(U.$('#act-smooth').value) / 100, autoGrip: U.$('#act-auto').checked };
    ACT.forEach(function (a) { patch[a.key] = Number(U.$('#act-' + a.key).value); });
    Device.saveProfile(patch);
    UI.toast('Pengaturan aktuator disimpan.', 'success');
  });

  U.$('#btn-reset-prof').addEventListener('click', function () {
    UI.confirm({
      title: 'Kembalikan ke bawaan?',
      message: 'Semua penyetelan aktuator dan haptik akan dikembalikan ke nilai awal.'
    }).then(function (ok) {
      if (!ok) return;
      Store.remove('device:profile');
      renderActuator();
      UI.toast('Pengaturan dikembalikan ke bawaan.', 'info');
    });
  });

  /* ============================================================
     Tabel nilai kalibrasi
     ============================================================ */
  function renderCalTable() {
    cal = Device.getCal();
    U.$('#cal-table').innerHTML = Device.CHANNELS.map(function (ch) {
      var b = cal.baseline[ch.id] || 0;
      var m = cal.mvc[ch.id] || 1;
      var range = U.round(m - b, 3);
      return '<tr>' +
        '<td class="semi" style="border-left:3px solid ' + ch.color + '">' + U.esc(ch.name) + '</td>' +
        '<td class="t-xs muted">' + U.esc(ch.muscle) + '</td>' +
        '<td class="mono t-xs">' + U.round(b, 3) + '</td>' +
        '<td class="mono t-xs">' + U.round(m, 3) + '</td>' +
        '<td class="mono t-xs">' + U.round(cal.threshold[ch.id] || 0.3, 3) + '</td>' +
        '<td><span class="badge badge-' + (range >= 0.25 ? 'success' : range >= 0.12 ? 'warning' : 'danger') +
        '">' + range + '</span></td>' +
        '<td class="t-xs">' + U.esc(fnLabel(ch.action)) + '</td></tr>';
    }).join('');
  }
  renderCalTable();

  window.addEventListener('pagehide', function () {
    if (scope) scope.destroy();
    if (meters) meters.destroy();
  });
})();
