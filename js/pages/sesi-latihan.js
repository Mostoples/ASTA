/* ============================================================
   ASTA — Sesi Latihan Terpandu
   Repetisi dihitung otomatis dari sinyal EMG, dengan penilaian
   mutu gerak per repetisi dan panduan fase kontraksi.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('pasien');
  if (!user) return;

  var pid = user.id;
  var shell = Shell.mount({
    title: 'Sesi Latihan',
    desc: 'Repetisi dihitung otomatis dari sinyal otot Anda'
  });
  if (!shell) return;
  var c = shell.content;

  var rx = Analytics.prescription(pid);
  var phase = Study.currentPhase(pid);

  /* ---------------- State sesi ---------------- */
  var S = {
    active: false,
    paused: false,
    queue: [],          // daftar latihan sesi ini
    idx: 0,
    startedAt: null,
    elapsed: 0,
    results: [],
    timer: null,
    counter: null,
    arm: null,
    scope: null,
    meters: null
  };

  if (!rx || !rx.items.length) {
    c.innerHTML = UI.empty({
      icon: 'clipboard', title: 'Belum ada program latihan',
      desc: 'Terapis Anda belum menyusun resep. Hubungi tim klinis Anda.',
      action: '<a class="btn btn-primary" href="pasien-dashboard.html">Kembali ke dasbor</a>'
    });
    return;
  }

  renderSetup();

  /* ============================================================
     TAMPILAN 1: Persiapan sesi
     ============================================================ */
  function renderSetup() {
    var todaySessions = Store.list('sessions').filter(function (s) {
      return s.patientId === pid && s.date === U.today();
    });

    c.innerHTML =
      (phase && !Study.phaseDef(phase.phase).haptic
        ? '<div class="alert warning"><span class="a-ico">' + Icon('info', 18) + '</span>' +
          '<span class="t-sm">Anda sedang pada fase <strong>' +
          U.esc(Study.phaseDef(phase.phase).label) + '</strong>. Umpan balik haptik dinonaktifkan ' +
          'sesuai protokol penelitian. Latihan tetap berjalan normal.</span></div>'
        : '') +

      (todaySessions.length
        ? '<div class="alert success"><span class="a-ico">' + Icon('checkCircle', 18) + '</span>' +
          '<span class="t-sm">Anda sudah menyelesaikan ' + todaySessions.length +
          ' sesi hari ini. Latihan tambahan tetap dicatat.</span></div>'
        : '') +

      '<section class="grid g-2-1">' +
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Pilih latihan</div>' +
      '<div class="card-sub">' + U.esc(rx.note ? 'Catatan terapis: ' + rx.note : user.program || '') +
      '</div></div>' +
      '<button class="btn btn-sm" id="btn-all">' + Icon('check', 15) + '<span>Pilih semua</span></button>' +
      '</div>' +
      '<div class="col gap-3" id="ex-picker"></div>' +
      '</div>' +

      '<div class="col gap-4">' +
      '<div class="card">' +
      '<div class="card-title mb-4">Status alat</div>' +
      '<div class="row gap-3 mb-4">' +
      '<span class="dot" id="setup-dot"></span>' +
      '<span class="grow t-sm semi" id="setup-status">Memeriksa…</span>' +
      '</div>' +
      '<div id="setup-note"></div>' +
      '<button class="btn btn-block mt-4" id="btn-conn">' + Icon('bluetooth', 18) +
      '<span>Hubungkan alat</span></button>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-3">Ringkasan sesi</div>' +
      '<dl class="kv">' +
      '<dt>Latihan dipilih</dt><dd id="sum-count">0</dd>' +
      '<dt>Perkiraan durasi</dt><dd id="sum-dur">0 menit</dd>' +
      '<dt>Mode hitung</dt><dd id="sum-mode">Manual</dd>' +
      '</dl>' +
      '<button class="btn btn-primary btn-lg btn-block mt-5" id="btn-start" disabled>' +
      Icon('play', 20) + '<span>Mulai Sesi</span></button>' +
      '</div>' +
      '</div>' +
      '</section>';

    /* --- Daftar latihan --- */
    var picker = U.$('#ex-picker');
    picker.innerHTML = rx.items.map(function (it, i) {
      var ex = Seed.exercise(it.exId);
      if (!ex) return '';
      var tone = ex.cat === 'phantom' ? 'violet' : ex.cat === 'adl' ? 'teal' : '';
      return '<label class="ex-item" style="cursor:pointer">' +
        '<input type="checkbox" class="sr-only" data-ex="' + U.esc(it.exId) + '" ' +
        'data-target="' + it.reps + '" data-sets="' + it.sets + '"' + (i < 3 ? ' checked' : '') + '>' +
        '<span class="ex-num" data-num>' + (i + 1) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="semi truncate" style="display:block">' + U.esc(ex.name) + '</span>' +
        '<span class="t-xs muted">' + it.sets + ' set × ' + it.reps + ' ' + U.esc(ex.unit) +
        ' · ' + U.esc(ex.desc.slice(0, 68)) + (ex.desc.length > 68 ? '…' : '') + '</span></span>' +
        '<span class="badge ' + (tone ? 'badge-' + tone : 'badge-primary') + ' shrink-0">' +
        U.esc(ex.cat === 'phantom' ? 'Phantom' : ex.cat === 'adl' ? 'ADL' : 'Motorik') + '</span>' +
        '</label>';
    }).join('');

    function syncPicker() {
      var checked = U.$$('input[data-ex]', picker).filter(function (i) { return i.checked; });
      U.$$('input[data-ex]', picker).forEach(function (i) {
        i.closest('.ex-item').classList.toggle('now', i.checked);
      });
      var mins = U.sum(checked.map(function (i) {
        var ex = Seed.exercise(i.dataset.ex);
        var t = Number(i.dataset.target);
        return ex.unit === 'menit' ? t : ex.unit === 'detik' ? Math.round(t / 60) + 1 : Math.round(t * 0.35) + 1;
      }));
      U.$('#sum-count').textContent = checked.length + ' latihan';
      U.$('#sum-dur').textContent = U.dur(mins);
      U.$('#btn-start').disabled = checked.length === 0;
    }
    picker.addEventListener('change', syncPicker);
    syncPicker();

    U.$('#btn-all').addEventListener('click', function () {
      var all = U.$$('input[data-ex]', picker);
      var target = !all.every(function (i) { return i.checked; });
      all.forEach(function (i) { i.checked = target; });
      syncPicker();
    });

    /* --- Status alat --- */
    function syncSetup() {
      var st = Device.statusText();
      U.$('#setup-dot').className = 'dot ' + st.dot;
      U.$('#setup-status').textContent = st.label;
      var btn = U.$('#btn-conn');
      var note = U.$('#setup-note');

      if (Device.state.connected) {
        btn.innerHTML = Icon('x', 18) + '<span>Putuskan</span>';
        btn.className = 'btn btn-block';
        U.$('#sum-mode').textContent = 'Otomatis dari EMG';
        var cal = Device.getCal();
        note.innerHTML = cal.calibratedAt
          ? '<div class="alert success"><span class="a-ico">' + Icon('checkCircle', 17) + '</span>' +
            '<span class="t-xs">Kalibrasi terakhir ' + U.esc(U.ago(cal.calibratedAt)) +
            '. Repetisi akan dihitung otomatis.</span></div>'
          : '<div class="alert warning"><span class="a-ico">' + Icon('alert', 17) + '</span>' +
            '<span class="t-xs">Alat belum dikalibrasi. Hitungan bisa kurang akurat. ' +
            '<a href="kalibrasi.html">Kalibrasi dulu</a></span></div>';
      } else {
        btn.innerHTML = Icon('bluetooth', 18) + '<span>Hubungkan alat</span>';
        btn.className = 'btn btn-primary btn-block';
        U.$('#sum-mode').textContent = 'Manual (ketuk tombol)';
        note.innerHTML = '<div class="alert info"><span class="a-ico">' + Icon('info', 17) + '</span>' +
          '<span class="t-xs">Tanpa alat, sesi tetap bisa dijalankan dengan menghitung repetisi manual.</span></div>';
      }
    }
    syncSetup();
    Device.on('connected', syncSetup);
    Device.on('disconnected', syncSetup);

    U.$('#btn-conn').addEventListener('click', function () {
      if (Device.state.connected) { Device.disconnect(); return; }
      connectFlow(syncSetup);
    });

    /* --- Mulai sesi --- */
    U.$('#btn-start').addEventListener('click', function () {
      S.queue = U.$$('input[data-ex]', picker).filter(function (i) { return i.checked; })
        .map(function (i) {
          var ex = Seed.exercise(i.dataset.ex);
          return {
            exId: i.dataset.ex, ex: ex,
            target: Number(i.dataset.target),
            sets: Number(i.dataset.sets),
            unit: ex.unit
          };
        });
      S.idx = 0;
      S.results = [];
      S.startedAt = Date.now();
      S.elapsed = 0;
      S.active = true;
      renderActive();
    });
  }

  /* ============================================================
     TAMPILAN 2: Sesi berjalan
     ============================================================ */
  function renderActive() {
    var item = S.queue[S.idx];
    var ex = item.ex;
    var isTimed = ex.unit === 'menit' || ex.unit === 'detik';

    c.innerHTML =
      '<section class="row between wrap gap-3">' +
      '<div class="row gap-3">' +
      '<span class="badge badge-primary">Latihan ' + (S.idx + 1) + ' dari ' + S.queue.length + '</span>' +
      '<span class="badge">' + Icon('clock', 12) + '<span id="sess-time">00:00</span></span>' +
      '</div>' +
      '<div class="row gap-2">' +
      '<button class="btn btn-sm" id="btn-pause">' + Icon('pause', 16) + '<span>Jeda</span></button>' +
      '<button class="btn btn-sm btn-danger" id="btn-abort">' + Icon('x', 16) + '<span>Akhiri</span></button>' +
      '</div></section>' +

      '<section class="session-hero">' +
      /* --- Panel utama --- */
      '<div class="col gap-4">' +
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">' + U.esc(ex.name) + '</div>' +
      '<div class="card-sub">' + U.esc(ex.desc) + '</div></div></div>' +

      '<div class="cue-box" id="cue"><div>' +
      '<div class="cue-text" id="cue-text">Bersiap…</div>' +
      '<div class="cue-sub" id="cue-sub">Rileks dulu, lalu mulai kontraksi</div>' +
      '</div></div>' +

      '<div class="grid g2 gap-4 mt-4">' +
      '<div class="rep-counter">' +
      '<div class="rep-big" id="rep-now">0</div>' +
      '<div class="rep-target">dari ' + item.target + ' ' + U.esc(ex.unit) + '</div>' +
      '</div>' +
      '<div class="center-t"><div class="timer-big" id="ex-timer">00:00</div>' +
      '<div class="rep-target">durasi latihan</div></div>' +
      '</div>' +

      '<div class="prog lg mt-4"><i id="rep-prog" style="width:0%"></i></div>' +

      '<div class="row gap-2 mt-4 wrap">' +
      (Device.state.connected && !isTimed
        ? '<button class="btn grow" id="btn-manual">' + Icon('plus', 17) + '<span>Tambah manual</span></button>'
        : '<button class="btn btn-primary grow" id="btn-manual">' + Icon('plus', 18) +
          '<span>' + (isTimed ? 'Tandai selesai' : 'Hitung repetisi') + '</span></button>') +
      '<button class="btn btn-success grow" id="btn-next">' + Icon('chevronRight', 18) +
      '<span>' + (S.idx === S.queue.length - 1 ? 'Selesaikan sesi' : 'Latihan berikutnya') + '</span></button>' +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div class="card-title">Sinyal otot</div>' +
      EmgScope.legend() + '</div>' +
      '<div class="emg-canvas-wrap"><canvas id="scope" data-height="180"></canvas></div>' +
      '<div class="mt-4" id="meters"></div>' +
      '</div>' +
      '</div>' +

      /* --- Panel samping --- */
      '<div class="col gap-4">' +
      '<div class="card">' +
      '<div class="card-title mb-3">Lengan bionik</div>' +
      '<div class="arm-stage" id="arm" style="min-height:250px"></div>' +
      '<div class="row between t-sm mt-3"><span class="muted">Gaya</span>' +
      '<span class="bold" id="force-val">0%</span></div>' +
      '<div class="force-gauge mt-2"><i id="force-bar" style="width:0%"></i></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-3">Mutu repetisi</div>' +
      '<div class="grid g2 gap-2">' +
      '<div class="mini-stat"><span class="ms-v" id="q-avg">–</span><span class="ms-l">Skor rata-rata</span></div>' +
      '<div class="mini-stat"><span class="ms-v" id="q-smooth">–</span><span class="ms-l">Kehalusan</span></div>' +
      '<div class="mini-stat"><span class="ms-v" id="q-hold">–</span><span class="ms-l">Durasi tahan</span></div>' +
      '<div class="mini-stat"><span class="ms-v" id="q-peak">–</span><span class="ms-l">Puncak EMG</span></div>' +
      '</div>' +
      '<div class="div-label">Riwayat repetisi</div>' +
      '<div class="col gap-2" id="rep-log" style="max-height:210px;overflow-y:auto">' +
      '<span class="t-sm muted">Belum ada repetisi</span></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-3">Urutan sesi</div>' +
      '<div class="ex-list" id="queue-list"></div>' +
      '</div>' +
      '</div>' +
      '</section>';

    renderQueue();
    startArm();
    startTimer();

    if (isTimed) startTimedExercise(item);
    else startRepExercise(item);

    U.$('#btn-pause').addEventListener('click', togglePause);
    U.$('#btn-abort').addEventListener('click', abortSession);
    U.$('#btn-next').addEventListener('click', nextExercise);
    U.$('#btn-manual').addEventListener('click', function () {
      if (isTimed) { markTimedDone(item); return; }
      if (S.counter) S.counter.manualRep();
      else bumpManual();
    });
  }

  /* ---------------- Latihan berbasis repetisi ---------------- */
  var manualCount = 0;

  function startRepExercise(item) {
    manualCount = 0;
    if (!Device.state.connected) {
      U.$('#cue-text').textContent = 'Mode manual';
      U.$('#cue-sub').textContent = 'Ketuk "Hitung repetisi" setiap kali selesai satu gerakan';
      return;
    }

    // Arahkan pola cengkeram sesuai latihan
    if (item.ex.grip) Device.setGrip(item.ex.grip);

    S.counter = RepCounter.create({
      channel: 'ch1',
      holdMs: 1400,
      onPhaseChange: function (ph) {
        var info = RepCounter.phaseInfo(ph);
        U.$('#cue').className = 'cue-box ' + info.cls;
        U.$('#cue-text').textContent = info.label;
        U.$('#cue-sub').textContent = info.hint;
      },
      onRep: function (rep, st) {
        updateRepUI(st.count, item.target);
        logRep(rep);
        updateQuality(S.counter.summary());
        if (st.count >= item.target) {
          UI.toast('Target ' + item.target + ' repetisi tercapai.', 'success', { duration: 2600 });
        }
      }
    });
    S.counter.start();
  }

  function bumpManual() {
    manualCount++;
    updateRepUI(manualCount, S.queue[S.idx].target);
    logRep({ index: manualCount, manual: true, at: Date.now() });
  }

  function currentCount() {
    return S.counter ? S.counter.state.count : manualCount;
  }

  function updateRepUI(count, target) {
    U.$('#rep-now').textContent = count;
    U.$('#rep-prog').style.width = U.pct(count, target) + '%';
    if (count >= target) {
      U.$('#rep-now').style.color = 'var(--success)';
    }
  }

  function logRep(rep) {
    var host = U.$('#rep-log');
    if (host.querySelector('.muted')) host.innerHTML = '';
    var q = rep.quality;
    var tone = q === null || q === undefined ? '' : q >= 75 ? 'success' : q >= 50 ? 'warning' : 'danger';
    var row = U.el('div', { class: 'row between t-xs' },
      '<span class="semi">Rep ' + rep.index + (rep.manual ? ' <span class="muted">(manual)</span>' : '') + '</span>' +
      (q !== null && q !== undefined
        ? '<span class="badge badge-' + tone + '">' + q + '</span>'
        : '<span class="badge">–</span>'));
    host.insertBefore(row, host.firstChild);
  }

  function updateQuality(sum) {
    U.$('#q-avg').textContent = sum.avgQuality !== null ? sum.avgQuality : '–';
    U.$('#q-smooth').textContent = sum.avgSmoothness !== null ? sum.avgSmoothness + '%' : '–';
    U.$('#q-hold').textContent = sum.avgHoldMs !== null ? (sum.avgHoldMs / 1000).toFixed(1) + 's' : '–';
    U.$('#q-peak').textContent = sum.avgPeak !== null ? Math.round(sum.avgPeak * 100) + '%' : '–';
  }

  /* ---------------- Latihan berbasis waktu ---------------- */
  var timedDone = false;
  function startTimedExercise(item) {
    timedDone = false;
    var totalSec = item.unit === 'menit' ? item.target * 60 : item.target;
    U.$('#cue-text').textContent = 'Latihan berdurasi';
    U.$('#cue-sub').textContent = 'Target ' + item.target + ' ' + item.unit +
      '. Ikuti panduan, tekan Tandai selesai bila sudah.';
    U.$('#rep-now').textContent = '0';

    if (item.ex.grip && Device.state.connected) Device.setGrip(item.ex.grip);

    // Panduan berputar bila ada cue
    if (item.ex.cue && item.ex.cue.length) {
      var ci = 0;
      var cueTimer = setInterval(function () {
        if (!S.active || S.paused) return;
        U.$('#cue-text').textContent = item.ex.cue[ci % item.ex.cue.length];
        ci++;
      }, 4200);
      S._cueTimer = cueTimer;
    }

    S._timedTotal = totalSec;
  }

  function markTimedDone(item) {
    if (timedDone) return;
    timedDone = true;
    var elapsed = Math.round((Date.now() - (S._exStart || Date.now())) / 1000);
    var achieved = item.unit === 'menit' ? Math.round(elapsed / 60) : elapsed;
    U.$('#rep-now').textContent = Math.max(1, achieved);
    U.$('#rep-prog').style.width = U.pct(achieved, item.target) + '%';
    UI.toast('Latihan ditandai selesai.', 'success', { duration: 2200 });
  }

  /* ---------------- Timer ---------------- */
  function startTimer() {
    S._exStart = Date.now();
    clearInterval(S.timer);
    S.timer = setInterval(function () {
      if (S.paused) return;
      S.elapsed = Math.round((Date.now() - S.startedAt) / 1000);
      var exEl = Math.round((Date.now() - S._exStart) / 1000);
      var st = U.$('#sess-time'), et = U.$('#ex-timer');
      if (st) st.textContent = U.mmss(S.elapsed);
      if (et) et.textContent = U.mmss(exEl);

      // Latihan berdurasi: progres otomatis
      if (S._timedTotal && !timedDone) {
        var item = S.queue[S.idx];
        var achieved = item.unit === 'menit' ? exEl / 60 : exEl;
        var rn = U.$('#rep-now');
        if (rn) rn.textContent = item.unit === 'menit' ? achieved.toFixed(1) : Math.round(achieved);
        var rp = U.$('#rep-prog');
        if (rp) rp.style.width = U.pct(achieved, item.target) + '%';
        if (achieved >= item.target) markTimedDone(item);
      }
    }, 1000);
  }

  function togglePause() {
    S.paused = !S.paused;
    var b = U.$('#btn-pause');
    b.innerHTML = S.paused
      ? Icon('play', 16) + '<span>Lanjut</span>'
      : Icon('pause', 16) + '<span>Jeda</span>';
    if (S.counter) S.paused ? S.counter.pause() : S.counter.resume();
    if (S.paused) UI.toast('Sesi dijeda.', 'info', { duration: 1800 });
  }

  /* ---------------- Lengan & scope ---------------- */
  function startArm() {
    var armHost = U.$('#arm');
    if (armHost) {
      if (S.arm) S.arm.destroy();
      S.arm = ArmStage.create(armHost, {});
    }
    var sc = U.$('#scope');
    if (sc) {
      if (S.scope) S.scope.destroy();
      S.scope = EmgScope.create(sc, { height: 180 });
    }
    var mh = U.$('#meters');
    if (mh) {
      if (S.meters) S.meters.destroy();
      S.meters = EmgScope.meters(mh);
    }
    Device.on('signal', U.throttle(function (d) {
      var fb = U.$('#force-bar'), fv = U.$('#force-val');
      if (fb) fb.style.width = d.force + '%';
      if (fv) fv.textContent = d.force + '%';
      if (S.arm) ArmView.highlightElectrodes(S.arm.svg, d.raw);
    }, 100));
  }

  function renderQueue() {
    var host = U.$('#queue-list');
    if (!host) return;
    host.innerHTML = S.queue.map(function (q, i) {
      var cls = i < S.idx ? 'done' : i === S.idx ? 'now' : '';
      return '<div class="ex-item ' + cls + '">' +
        '<span class="ex-num">' + (i < S.idx ? Icon('check', 13) : i + 1) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi truncate" style="display:block">' + U.esc(q.ex.name) + '</span>' +
        '<span class="t-xs muted">' + q.target + ' ' + U.esc(q.unit) + '</span></span></div>';
    }).join('');
  }

  /* ---------------- Pindah latihan ---------------- */
  function nextExercise() {
    saveCurrentResult();
    cleanupExercise();

    if (S.idx >= S.queue.length - 1) { finishSession(); return; }
    S.idx++;
    S._timedTotal = null;
    renderActive();
  }

  function saveCurrentResult() {
    var item = S.queue[S.idx];
    var exEl = Math.round((Date.now() - (S._exStart || Date.now())) / 1000);
    var sum = S.counter ? S.counter.summary() : null;
    var done;

    if (item.unit === 'menit') done = Math.max(0, U.round(exEl / 60, 1));
    else if (item.unit === 'detik') done = exEl;
    else done = currentCount();

    S.results.push({
      exId: item.exId,
      target: item.target,
      done: done,
      unit: item.unit,
      minutes: Math.max(1, Math.round(exEl / 60)),
      quality: sum && sum.avgQuality !== null ? sum.avgQuality : estimateQuality(done, item.target),
      avgEmg: sum && sum.avgPeak !== null ? sum.avgPeak : null,
      peakForce: Math.round(Device.state.force) || null,
      smoothness: sum && sum.avgSmoothness !== null ? sum.avgSmoothness : null,
      reps: sum ? sum.reps.length : done,
      manualReps: sum ? sum.manualCount : done,
      autoCounted: !!(sum && sum.reps.length > sum.manualCount)
    });
  }

  function estimateQuality(done, target) {
    return U.clamp(Math.round((done / Math.max(1, target)) * 88), 15, 100);
  }

  function cleanupExercise() {
    if (S.counter) { S.counter.destroy(); S.counter = null; }
    if (S._cueTimer) { clearInterval(S._cueTimer); S._cueTimer = null; }
    timedDone = false;
    manualCount = 0;
  }

  function abortSession() {
    UI.confirm({
      title: 'Akhiri sesi sekarang?',
      message: 'Latihan yang sudah selesai akan tetap dicatat sebagai sesi sebagian.',
      okLabel: 'Akhiri', danger: true
    }).then(function (ok) {
      if (!ok) return;
      saveCurrentResult();
      cleanupExercise();
      finishSession(true);
    });
  }

  /* ============================================================
     TAMPILAN 3: Ringkasan sesi
     ============================================================ */
  function finishSession(partial) {
    clearInterval(S.timer);
    cleanupExercise();
    S.active = false;

    var totalMin = Math.max(1, Math.round(S.elapsed / 60));
    var completion = Math.round(U.avg(S.results.map(function (r) {
      return U.clamp((r.done / Math.max(1, r.target)) * 100, 0, 100);
    })));
    var quality = Math.round(U.avg(S.results.map(function (r) { return r.quality || 0; })));

    var rec = Store.insert('sessions', {
      patientId: pid,
      prescriptionId: rx.id,
      date: U.today(),
      startedAt: new Date(S.startedAt).toISOString(),
      durationMin: totalMin,
      status: partial ? 'sebagian' : 'selesai',
      adherencePct: completion,
      qualityScore: quality,
      exercises: S.results,
      deviceMode: Device.state.connected ? 'bionic' : 'tanpa-alat',
      studyPhase: phase ? phase.phase : null,
      note: ''
    });

    var autoCount = S.results.filter(function (r) { return r.autoCounted; }).length;

    c.innerHTML =
      '<section class="card pad-lg center-t">' +
      '<div style="width:78px;height:78px;margin:0 auto var(--s-4);border-radius:50%;' +
      'background:var(--success-soft);display:grid;place-items:center;color:var(--success)">' +
      Icon('checkCircle', 38) + '</div>' +
      '<h2>' + (partial ? 'Sesi diakhiri' : 'Sesi selesai') + '</h2>' +
      '<p class="muted mt-2">Data sudah tersimpan dan dapat dilihat terapis Anda.</p>' +

      '<div class="grid g4 mt-6" style="text-align:left">' +
      UI.statCard({ label: 'Durasi', value: U.dur(totalMin), icon: 'clock' }) +
      UI.statCard({ label: 'Kelengkapan', value: completion, unit: '%', icon: 'target',
        tone: completion >= 80 ? 'success' : 'warning' }) +
      UI.statCard({ label: 'Mutu gerak', value: quality, unit: '/100', icon: 'activity',
        tone: quality >= 75 ? 'success' : quality >= 50 ? 'warning' : 'danger' }) +
      UI.statCard({ label: 'Latihan', value: S.results.length, unit: 'selesai', icon: 'checkCircle' }) +
      '</div>' +

      (autoCount
        ? '<div class="alert success mt-5" style="text-align:left"><span class="a-ico">' +
          Icon('pulse', 18) + '</span><span class="t-sm">' + autoCount +
          ' latihan dihitung otomatis dari sinyal EMG Anda. Data mutu gerak ini lebih objektif ' +
          'daripada laporan mandiri.</span></div>'
        : '<div class="alert info mt-5" style="text-align:left"><span class="a-ico">' +
          Icon('info', 18) + '</span><span class="t-sm">Sesi ini dihitung manual. ' +
          'Hubungkan lengan bionik agar repetisi dan mutu gerak terukur otomatis.</span></div>') +

      '<div class="div-label">Rincian per latihan</div>' +
      '<div class="table-wrap" style="text-align:left"><table class="table"><thead><tr>' +
      '<th>Latihan</th><th>Capaian</th><th>Mutu</th><th>Kehalusan</th><th>Durasi</th>' +
      '</tr></thead><tbody>' +
      S.results.map(function (r) {
        var ex = Seed.exercise(r.exId);
        var pctv = U.pct(r.done, r.target);
        return '<tr><td class="semi">' + U.esc(ex ? ex.name : r.exId) + '</td>' +
          '<td>' + r.done + '/' + r.target + ' ' + U.esc(r.unit) +
          ' <span class="muted t-xs">(' + pctv + '%)</span></td>' +
          '<td>' + (r.quality !== null ? '<span class="badge badge-' +
            (r.quality >= 75 ? 'success' : r.quality >= 50 ? 'warning' : 'danger') + '">' +
            r.quality + '</span>' : '–') + '</td>' +
          '<td>' + (r.smoothness !== null ? r.smoothness + '%' : '–') + '</td>' +
          '<td>' + U.esc(U.dur(r.minutes)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +

      '<div class="field mt-5" style="text-align:left">' +
      '<label class="label" for="sess-note">Bagaimana rasanya sesi ini? (opsional)</label>' +
      '<textarea class="textarea" id="sess-note" maxlength="300" ' +
      'placeholder="Misalnya: terasa lebih ringan, atau cepat lelah di latihan terakhir…"></textarea></div>' +

      '<div class="row center gap-3 mt-5 wrap">' +
      '<button class="btn" id="btn-save-note">' + Icon('check', 18) + '<span>Simpan catatan</span></button>' +
      '<a class="btn btn-primary" href="catatan-nyeri.html">' + Icon('brain', 18) +
      '<span>Catat nyeri hari ini</span></a>' +
      '<a class="btn" href="pasien-dashboard.html">' + Icon('home', 18) + '<span>Dasbor</span></a>' +
      '</div>' +
      '</section>';

    U.$('#btn-save-note').addEventListener('click', function () {
      var v = U.$('#sess-note').value.trim();
      Store.update('sessions', rec.id, { note: v });
      UI.toast('Catatan sesi tersimpan.', 'success');
    });

    // Eskalasi bila mutu gerak turun tajam
    var prev = Analytics.sessions(pid, 30).slice(-6, -1);
    if (prev.length >= 3) {
      var prevQ = U.avg(prev.map(function (s) { return s.qualityScore || 0; }));
      if (quality < prevQ - 18 && user.therapistId) {
        Notify.push(user.therapistId, {
          type: 'kualitas', tone: 'warning', icon: 'trend',
          title: user.name + ': mutu gerak turun',
          body: 'Skor sesi terakhir ' + quality + ', sebelumnya rata-rata ' + Math.round(prevQ) + '.',
          link: 'terapis-pasien.html?id=' + pid
        });
      }
    }

    Notify.checkAchievements(pid);
    if (S.scope) { S.scope.destroy(); S.scope = null; }
    if (S.meters) { S.meters.destroy(); S.meters = null; }
  }

  /* ---------------- Dialog koneksi ---------------- */
  function connectFlow(after) {
    var bleOk = Device.bleSupported();
    UI.modal({
      title: 'Hubungkan lengan bionik',
      size: 'sm',
      content: '<p class="t-sm muted-2 mb-4">Pilih cara menghubungkan perangkat ASTA Arm.</p>' +
        '<div class="col gap-3">' +
        '<button class="role-opt" data-mode="ble"' + (bleOk ? '' : ' disabled style="opacity:.5"') + '>' +
        '<span class="r-ico">' + Icon('bluetooth', 19) + '</span>' +
        '<span><span class="r-name">Bluetooth (alat fisik)</span>' +
        '<span class="r-desc">' + (bleOk ? 'Pindai perangkat ASTA-ARM' : 'Tidak didukung peramban ini') +
        '</span></span></button>' +
        '<button class="role-opt" data-mode="mock">' +
        '<span class="r-ico">' + Icon('cpu', 19) + '</span>' +
        '<span><span class="r-name">Mode Simulator</span>' +
        '<span class="r-desc">Sinyal sEMG tiruan untuk demo</span></span></button>' +
        '</div>',
      actions: [{ label: 'Batal' }],
      onOpen: function (m) {
        U.$$('[data-mode]', m.root).forEach(function (b) {
          b.addEventListener('click', function () {
            if (b.hasAttribute('disabled')) return;
            m.close();
            Device.connect(b.dataset.mode).then(function () {
              UI.toast('Lengan ASTA terhubung.', 'success');
              if (after) after();
            }).catch(function (err) {
              UI.toast(err.message || 'Gagal menghubungkan.', 'danger', { duration: 6500 });
            });
          });
        });
      }
    });
  }

  /* ---------------- Cegah keluar tanpa sengaja ---------------- */
  window.addEventListener('beforeunload', function (e) {
    if (S.active && S.results.length + currentCount() > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
})();
