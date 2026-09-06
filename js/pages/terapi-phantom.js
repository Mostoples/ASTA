/* ============================================================
   ASTA — Terapi Cermin & Graded Motor Imagery
   Empat modul: terapi cermin, pengenalan sisi (GMI-1),
   imajinasi gerak (GMI-2), dan diskriminasi sensorik haptik.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('pasien');
  if (!user) return;

  var pid = user.id;
  var side = (user.amputation || {}).side || 'Kanan';
  var shell = Shell.mount({
    title: 'Terapi Cermin & GMI',
    desc: 'Latihan untuk menurunkan nyeri phantom melalui umpan balik visual dan sensorik'
  });
  if (!shell) return;
  var c = shell.content;

  var gmi = Analytics.gmiStats(pid, 60);
  var painBefore = null;

  c.innerHTML =
    '<div class="explainer tone-violet mb-1">' +
      '<div class="art">' + Illus.cermin({
        title: 'Terapi cermin: tangan yang utuh dipantulkan sehingga otak ' +
               'menerima citra dua tangan yang bergerak selaras.'
      }) + '</div>' +
      '<div>' +
        '<h3>Graded Motor Imagery dikerjakan berjenjang</h3>' +
        '<p>Mulai dari pengenalan sisi, lanjut ke imajinasi gerak, baru terapi cermin. ' +
        'Jangan lewati tahap bila nyeri masih tinggi — urutannya yang membuat ' +
        'latihan ini bekerja.</p>' +
        '<p>Semua pemrosesan kamera berlangsung di peramban Anda dan tidak dikirim ' +
        'ke mana pun.</p>' +
      '</div>' +
    '</div>' +

    '<div class="tabs" id="tabs" role="tablist">' +
    '<button class="tab" data-tab="mirror" aria-selected="true" role="tab">' +
    Icon('mirror', 17) + ' Terapi Cermin</button>' +
    '<button class="tab" data-tab="lat" aria-selected="false" role="tab">' +
    Icon('grid', 17) + ' Pengenalan Sisi (GMI-1)</button>' +
    '<button class="tab" data-tab="imagery" aria-selected="false" role="tab">' +
    Icon('brain', 17) + ' Imajinasi Gerak (GMI-2)</button>' +
    '<button class="tab" data-tab="sensory" aria-selected="false" role="tab">' +
    Icon('waves', 17) + ' Diskriminasi Sensorik</button>' +
    '</div>' +

    '<div id="panels">' +
    '<section data-panel="mirror" class="col gap-5"></section>' +
    '<section data-panel="lat" class="col gap-5 hidden"></section>' +
    '<section data-panel="imagery" class="col gap-5 hidden"></section>' +
    '<section data-panel="sensory" class="col gap-5 hidden"></section>' +
    '</div>';

  /* ============================================================
     1. TERAPI CERMIN
     ============================================================ */
  var mirrorApi = null;
  var mirrorMode = 'camera';
  var mirrorTimer = null, mirrorSec = 0;
  var CUES = [
    'Buka tangan perlahan',
    'Tutup tangan membentuk kepalan',
    'Jumput dengan ibu jari dan telunjuk',
    'Putar pergelangan ke dalam',
    'Putar pergelangan ke luar',
    'Rentangkan jari selebar mungkin',
    'Rileks sepenuhnya'
  ];

  function renderMirror() {
    var host = U.$('[data-panel="mirror"]');
    host.innerHTML =
      '<div class="grid g-2-1">' +
      '<div class="card">' +
      '<div class="card-head">' +
      '<div><div class="card-title">Cermin digital</div>' +
      '<div class="card-sub">Letakkan tangan sehat di depan kamera. Sisi ' +
      U.esc(side.toLowerCase()) + ' menampilkan bayangan cerminnya.</div></div>' +
      '<div class="seg" id="seg-mirror">' +
      '<button data-value="camera" aria-selected="true">Kamera</button>' +
      '<button data-value="anim" aria-selected="false">Animasi</button>' +
      '</div></div>' +
      '<div id="mirror-host"></div>' +
      '<div class="row between mt-4 wrap gap-3">' +
      '<div class="row gap-3">' +
      '<span class="timer-big" id="m-timer" style="font-size:30px">00:00</span>' +
      '<span class="t-sm muted">target 12 menit</span></div>' +
      '<div class="row gap-2">' +
      '<button class="btn btn-primary btn-lg" id="m-start">' + Icon('play', 19) +
      '<span>Mulai</span></button>' +
      '<button class="btn btn-success" id="m-finish" disabled>' + Icon('check', 18) +
      '<span>Selesai</span></button>' +
      '</div></div>' +
      '<div class="prog mt-4"><i id="m-prog" style="width:0%"></i></div>' +
      '</div>' +

      '<div class="col gap-4">' +
      '<div class="card">' +
      '<div class="card-title mb-3">Panduan gerakan</div>' +
      '<div class="cue-box" id="m-cue"><div>' +
      '<div class="cue-text" style="font-size:18px" id="m-cue-text">Tekan Mulai</div>' +
      '<div class="cue-sub" id="m-cue-sub">Gerakan akan dipandu bergantian</div>' +
      '</div></div>' +
      '<div class="col gap-2 mt-4" id="m-cue-list"></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-3">Nyeri sebelum & sesudah</div>' +
      '<p class="t-xs muted mb-3">Mengukur nyeri sebelum dan sesudah sesi membantu melihat ' +
      'efek langsung terapi cermin.</p>' +
      '<div id="m-prepost"></div>' +
      '</div>' +
      '</div></div>';

    U.$('#m-cue-list').innerHTML = CUES.map(function (q, i) {
      return '<div class="row gap-2 t-xs" data-cue-i="' + i + '">' +
        '<span class="ex-num" style="width:24px;height:24px;font-size:10px">' + (i + 1) + '</span>' +
        '<span class="grow">' + U.esc(q) + '</span></div>';
    }).join('');

    renderPrePost();
    buildMirror();

    UI.bindSeg(U.$('#seg-mirror'), function (v) {
      if (mirrorApi && mirrorApi.isRunning()) mirrorApi.stop();
      mirrorMode = v;
      buildMirror();
    });

    U.$('#m-start').addEventListener('click', toggleMirror);
    U.$('#m-finish').addEventListener('click', finishMirror);
  }

  function buildMirror() {
    var h = U.$('#mirror-host');
    if (mirrorApi) mirrorApi.destroy();
    var opts = {
      side: side,
      onStatus: function (state, msg) {
        if (state === 'error') UI.toast(msg, 'warning', { duration: 6000 });
      }
    };
    mirrorApi = mirrorMode === 'camera' ? Mirror.create(h, opts) : Mirror.createAnimated(h, opts);
  }

  function toggleMirror() {
    var btn = U.$('#m-start');
    if (mirrorApi.isRunning()) {
      mirrorApi.stop();
      clearInterval(mirrorTimer);
      btn.innerHTML = Icon('play', 19) + '<span>Lanjut</span>';
      return;
    }
    // Tanya nyeri sebelum mulai, sekali per sesi
    if (painBefore === null) {
      askPain('Sebelum memulai, seberapa nyeri phantom Anda sekarang?', function (lvl) {
        painBefore = lvl;
        renderPrePost();
        actuallyStart();
      });
      return;
    }
    actuallyStart();

    function actuallyStart() {
      mirrorApi.start().then(function () {
        btn.innerHTML = Icon('pause', 19) + '<span>Jeda</span>';
        U.$('#m-finish').disabled = false;
        startMirrorTimer();
      }).catch(function (err) {
        UI.toast(err.message, 'warning', { duration: 6500 });
        if (mirrorMode === 'camera') {
          UI.toast('Beralih ke mode animasi.', 'info');
          U.$$('#seg-mirror button').forEach(function (b) {
            b.setAttribute('aria-selected', String(b.dataset.value === 'anim'));
          });
          mirrorMode = 'anim';
          buildMirror();
        }
      });
    }
  }

  function startMirrorTimer() {
    clearInterval(mirrorTimer);
    var cueIdx = 0, lastCue = mirrorSec;
    mirrorTimer = setInterval(function () {
      mirrorSec++;
      U.$('#m-timer').textContent = U.mmss(mirrorSec);
      U.$('#m-prog').style.width = U.pct(mirrorSec, 12 * 60) + '%';

      if (mirrorSec - lastCue >= 22) {
        cueIdx = (cueIdx + 1) % CUES.length;
        lastCue = mirrorSec;
        U.$('#m-cue-text').textContent = CUES[cueIdx];
        U.$('#m-cue-sub').textContent = 'Gerakkan tangan sehat, amati bayangannya';
        if (mirrorApi.setHint) mirrorApi.setHint(CUES[cueIdx]);
        U.$$('#m-cue-list [data-cue-i]').forEach(function (n) {
          n.style.opacity = Number(n.dataset.cueI) === cueIdx ? '1' : '.45';
          n.style.fontWeight = Number(n.dataset.cueI) === cueIdx ? '700' : '400';
        });
      }
      if (mirrorSec === 12 * 60) {
        UI.toast('Target 12 menit tercapai. Anda dapat menyelesaikan sesi.', 'success', { duration: 5000 });
      }
    }, 1000);
  }

  function finishMirror() {
    if (mirrorApi.isRunning()) mirrorApi.stop();
    clearInterval(mirrorTimer);
    var minutes = Math.max(1, Math.round(mirrorSec / 60));

    askPain('Setelah sesi, seberapa nyeri phantom Anda sekarang?', function (after) {
      saveTherapySession('ex_mirror', minutes, minutes, 'menit', {
        painBefore: painBefore, painAfter: after, mode: mirrorMode
      });

      var diff = painBefore !== null ? painBefore - after : null;
      UI.modal({
        title: 'Sesi terapi cermin selesai',
        size: 'sm',
        content:
          '<div class="grid g2 gap-3">' +
          '<div class="mini-stat"><span class="ms-v">' + U.esc(U.dur(minutes)) + '</span>' +
          '<span class="ms-l">Durasi</span></div>' +
          '<div class="mini-stat"><span class="ms-v">' + (painBefore !== null ? painBefore : '–') +
          ' → ' + after + '</span><span class="ms-l">Nyeri</span></div>' +
          '</div>' +
          (diff !== null
            ? '<div class="alert ' + (diff > 0 ? 'success' : diff < 0 ? 'warning' : 'info') + ' mt-4">' +
              '<span class="a-ico">' + Icon(diff > 0 ? 'checkCircle' : 'info', 18) + '</span>' +
              '<span class="t-sm">' +
              (diff > 0 ? 'Nyeri turun ' + diff + ' poin setelah sesi ini.'
                : diff < 0 ? 'Nyeri naik ' + Math.abs(diff) + ' poin. Bila berulang, laporkan ke terapis.'
                  : 'Nyeri tidak berubah pada sesi ini.') +
              '</span></div>'
            : ''),
        actions: [{ label: 'Tutup', class: 'btn-primary' }]
      });

      mirrorSec = 0; painBefore = null;
      U.$('#m-timer').textContent = '00:00';
      U.$('#m-prog').style.width = '0%';
      U.$('#m-start').innerHTML = Icon('play', 19) + '<span>Mulai</span>';
      U.$('#m-finish').disabled = true;
      renderPrePost();
    });
  }

  function renderPrePost() {
    var sessions = Store.list('sessions').filter(function (s) {
      return s.patientId === pid && (s.exercises || []).some(function (e) {
        return e.exId === 'ex_mirror' && e.painBefore !== undefined && e.painBefore !== null;
      });
    }).slice(-6);

    var host = U.$('#m-prepost');
    if (!sessions.length) {
      host.innerHTML = '<span class="t-sm muted">Belum ada data sebelum/sesudah. ' +
        'Selesaikan satu sesi untuk mulai mengukur.</span>';
      return;
    }
    var rows = sessions.map(function (s) {
      var e = (s.exercises || []).find(function (x) { return x.exId === 'ex_mirror'; });
      return { date: s.date, before: e.painBefore, after: e.painAfter };
    });
    var avgDrop = U.round(U.avg(rows.map(function (r) { return r.before - r.after; })), 1);

    host.innerHTML =
      '<div class="mini-stat mb-3"><span class="ms-v ' + (avgDrop > 0 ? 'c-success' : '') + '">' +
      (avgDrop > 0 ? '−' : '+') + Math.abs(avgDrop) + ' poin</span>' +
      '<span class="ms-l">Rata-rata perubahan nyeri per sesi</span></div>' +
      rows.reverse().map(function (r) {
        return '<div class="row between t-xs mb-2">' +
          '<span class="muted">' + U.esc(U.fmtDate(r.date, 'short')) + '</span>' +
          '<span class="row gap-2">' +
          '<span class="badge" style="background:' + Chart.alpha(U.painColor(r.before), 0.16) +
          ';color:' + U.painColor(r.before) + '">' + r.before + '</span>' +
          Icon('chevronRight', 12) +
          '<span class="badge" style="background:' + Chart.alpha(U.painColor(r.after), 0.16) +
          ';color:' + U.painColor(r.after) + '">' + r.after + '</span></span></div>';
      }).join('');
  }

  /* ============================================================
     2. PENGENALAN SISI (GMI-1)
     ============================================================ */
  var lat = { set: [], idx: 0, correct: 0, times: [], startAt: 0, running: false };

  function renderLaterality() {
    var host = U.$('[data-panel="lat"]');
    host.innerHTML =
      '<div class="grid g-2-1">' +
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Kiri atau kanan?</div>' +
      '<div class="card-sub">Tentukan secepat mungkin. Ketepatan dan waktu reaksi keduanya diukur.</div></div>' +
      '<span class="badge" id="lat-progress">0 / 20</span></div>' +

      '<div class="lat-stage" id="lat-stage">' +
      '<div class="center-t"><div class="bold t-lg mb-3" style="color:var(--text-2)">Siap memulai?</div>' +
      '<p class="t-sm muted" style="max-width:40ch">Anda akan melihat gambar tangan dalam berbagai ' +
      'posisi dan rotasi. Tentukan apakah itu tangan kiri atau kanan.</p></div>' +
      '</div>' +

      '<div class="lat-answer mt-5" id="lat-answer" style="display:none">' +
      '<button class="btn btn-lg lat-btn" data-side="kiri">' + Icon('chevronLeft', 22) +
      '<span>KIRI</span></button>' +
      '<button class="btn btn-lg lat-btn" data-side="kanan"><span>KANAN</span>' +
      Icon('chevronRight', 22) + '</button>' +
      '</div>' +

      '<div class="row center mt-5" id="lat-controls">' +
      '<button class="btn btn-primary btn-lg" id="lat-start">' + Icon('play', 19) +
      '<span>Mulai 20 soal</span></button></div>' +

      '<div class="row between mt-4 t-sm" id="lat-live" style="display:none">' +
      '<span class="muted">Benar: <strong id="lat-correct">0</strong></span>' +
      '<span class="muted">Waktu rata-rata: <strong id="lat-avg">–</strong></span>' +
      '</div>' +
      '</div>' +

      '<div class="col gap-4">' +
      '<div class="card center-t">' +
      '<div class="card-title mb-4">Ketepatan 60 hari</div>' +
      '<div id="lat-ring"></div>' +
      '<div class="grid g2 gap-2 mt-5" style="text-align:left">' +
      '<div class="mini-stat"><span class="ms-v">' + (gmi.avgMs ? (gmi.avgMs / 1000).toFixed(1) + 's' : '–') +
      '</span><span class="ms-l">Waktu reaksi</span></div>' +
      '<div class="mini-stat"><span class="ms-v ' + (gmi.delta > 0 ? 'c-success' : '') + '">' +
      (gmi.delta > 0 ? '+' : '') + gmi.delta + '%</span><span class="ms-l">Perubahan</span></div>' +
      '</div></div>' +

      '<div class="card">' +
      '<div class="card-title mb-3">Riwayat latihan</div>' +
      '<div class="chart-box"><canvas id="ch-lat" data-height="180"></canvas></div>' +
      '<div class="chart-legend mt-3">' +
      '<span><i style="background:#2b6cde"></i>Ketepatan (%)</span>' +
      '<span><i style="background:#d98b0b"></i>Waktu reaksi (detik)</span></div>' +
      '</div>' +

      '<div class="alert info"><span class="a-ico">' + Icon('info', 18) + '</span>' +
      '<span class="t-xs">Target klinis umum: ketepatan di atas 90% dengan waktu reaksi ' +
      'di bawah 2 detik. Bila tercapai konsisten, Anda dapat lanjut ke tahap imajinasi gerak.</span></div>' +
      '</div></div>';

    U.$('#lat-ring').innerHTML = UI.ring({
      value: gmi.accuracy, size: 128, stroke: 13,
      color: gmi.accuracy >= 90 ? 'var(--success)' : 'var(--primary)',
      label: '<div class="t-xl bold">' + gmi.accuracy + '<span class="t-sm muted">%</span></div>' +
        '<div class="t-xs muted">ketepatan</div>'
    });

    drawLatChart();
    U.$('#lat-start').addEventListener('click', startLat);
    U.on(U.$('#lat-answer'), 'click', '[data-side]', function (e, btn) {
      answerLat(btn.dataset.side, btn);
    });
  }

  function drawLatChart() {
    if (!gmi.list.length) return;
    Chart.line(U.$('#ch-lat'), {
      labels: gmi.list.map(function (g) { return U.fmtDate(g.date, 'short'); }),
      height: 180, yMax: 100, ticks: 4, yMaxRight: 4,
      showDots: gmi.list.length <= 20,
      series: [
        { name: 'Ketepatan', data: gmi.list.map(function (g) { return g.accuracy; }),
          color: '#2b6cde', fill: true },
        { name: 'Waktu', data: gmi.list.map(function (g) { return U.round(g.avgMs / 1000, 2); }),
          color: '#d98b0b', axis: 'right', dashed: true }
      ]
    });
  }

  function startLat() {
    lat = { set: HandShapes.buildSet(20), idx: 0, correct: 0, times: [], startAt: 0, running: true };
    U.$('#lat-controls').style.display = 'none';
    U.$('#lat-answer').style.display = 'grid';
    U.$('#lat-live').style.display = 'flex';
    showLatTrial();
  }

  function showLatTrial() {
    var t = lat.set[lat.idx];
    U.$('#lat-stage').innerHTML = t.svg;
    U.$('#lat-progress').textContent = (lat.idx + 1) + ' / ' + lat.set.length;
    lat.startAt = performance.now();
  }

  function answerLat(answer, btn) {
    if (!lat.running) return;
    var t = lat.set[lat.idx];
    var ms = performance.now() - lat.startAt;
    var ok = answer === t.side;
    if (ok) lat.correct++;
    lat.times.push(ms);

    btn.classList.add(ok ? 'correct' : 'wrong');
    setTimeout(function () { btn.classList.remove('correct', 'wrong'); }, 640);

    U.$('#lat-correct').textContent = lat.correct;
    U.$('#lat-avg').textContent = (U.avg(lat.times) / 1000).toFixed(2) + 's';

    lat.idx++;
    if (lat.idx >= lat.set.length) { finishLat(); return; }
    setTimeout(showLatTrial, 260);
  }

  function finishLat() {
    lat.running = false;
    var accuracy = Math.round((lat.correct / lat.set.length) * 100);
    var avgMs = Math.round(U.avg(lat.times));

    Store.insert('gmiScores', {
      patientId: pid, date: U.today(), accuracy: accuracy,
      avgMs: avgMs, total: lat.set.length
    });
    saveTherapySession('ex_laterality', lat.set.length, lat.set.length, 'soal', {
      accuracy: accuracy, avgMs: avgMs
    });

    var ready = accuracy >= 90 && avgMs <= 2000;
    UI.modal({
      title: 'Latihan pengenalan sisi selesai',
      content:
        '<div class="grid g3 gap-3">' +
        '<div class="mini-stat"><span class="ms-v">' + accuracy + '%</span>' +
        '<span class="ms-l">Ketepatan</span></div>' +
        '<div class="mini-stat"><span class="ms-v">' + (avgMs / 1000).toFixed(2) + 's</span>' +
        '<span class="ms-l">Waktu rata-rata</span></div>' +
        '<div class="mini-stat"><span class="ms-v">' + lat.correct + '/' + lat.set.length + '</span>' +
        '<span class="ms-l">Benar</span></div>' +
        '</div>' +
        '<div class="alert ' + (ready ? 'success' : 'info') + ' mt-4">' +
        '<span class="a-ico">' + Icon(ready ? 'checkCircle' : 'info', 18) + '</span>' +
        '<span class="t-sm">' + (ready
          ? 'Target tercapai. Anda dapat melanjutkan ke tahap imajinasi gerak.'
          : 'Terus latih sampai ketepatan di atas 90% dengan waktu di bawah 2 detik.') +
        '</span></div>',
      actions: [
        { label: 'Ulangi', onClick: function () { setTimeout(startLat, 200); } },
        { label: 'Selesai', class: 'btn-primary', onClick: function () { location.reload(); } }
      ]
    });
  }

  /* ============================================================
     3. IMAJINASI GERAK (GMI-2)
     ============================================================ */
  var img = { running: false, sec: 0, timer: null, idx: 0 };
  var IMAGERY = [
    { pose: 'fist', text: 'Bayangkan menggenggam erat', sub: 'Rasakan otot lengan bawah menegang' },
    { pose: 'open', text: 'Bayangkan membuka tangan', sub: 'Rasakan jari-jari merentang' },
    { pose: 'pinch', text: 'Bayangkan menjumput koin', sub: 'Ibu jari bertemu telunjuk' },
    { pose: 'point', text: 'Bayangkan menunjuk', sub: 'Hanya telunjuk yang lurus' },
    { pose: 'three', text: 'Bayangkan memegang gelas', sub: 'Tiga jari melingkupi permukaan' }
  ];

  function renderImagery() {
    var host = U.$('[data-panel="imagery"]');
    host.innerHTML =
      '<div class="grid g-2-1">' +
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Imajinasi gerak terpandu</div>' +
      '<div class="card-sub">Bayangkan gerakan tanpa benar-benar bergerak. ' +
      'Ini mengaktifkan korteks motorik tanpa memicu nyeri.</div></div></div>' +

      '<div class="lat-stage" id="img-stage" style="min-height:260px"></div>' +

      '<div class="cue-box mt-4" id="img-cue"><div>' +
      '<div class="cue-text" id="img-text">Tekan Mulai</div>' +
      '<div class="cue-sub" id="img-sub">Setiap gerakan dibayangkan 20 detik</div>' +
      '</div></div>' +

      '<div class="row between mt-4 wrap gap-3">' +
      '<span class="timer-big" id="img-timer" style="font-size:30px">00:00</span>' +
      '<div class="row gap-2">' +
      '<button class="btn btn-primary btn-lg" id="img-start">' + Icon('play', 19) +
      '<span>Mulai</span></button>' +
      '<button class="btn btn-success" id="img-finish" disabled>' + Icon('check', 18) +
      '<span>Selesai</span></button></div></div>' +
      '<div class="prog mt-4"><i id="img-prog" style="width:0%"></i></div>' +
      '</div>' +

      '<div class="col gap-4">' +
      '<div class="card">' +
      '<div class="card-title mb-3">Cara melakukannya</div>' +
      '<ol class="t-sm muted-2" style="padding-left:18px;line-height:1.9">' +
      '<li>Duduk nyaman, tarik napas dalam beberapa kali.</li>' +
      '<li>Amati gambar tangan di sisi kiri.</li>' +
      '<li>Bayangkan tangan yang diamputasi melakukan gerakan itu.</li>' +
      '<li>Jangan gerakkan otot mana pun. Cukup bayangkan.</li>' +
      '<li>Bila nyeri muncul, berhenti dan beralih ke relaksasi.</li>' +
      '</ol>' +
      '<div class="alert warning mt-4"><span class="a-ico">' + Icon('alert', 17) + '</span>' +
      '<span class="t-xs">Berhenti bila nyeri meningkat. Naiknya nyeri saat imajinasi ' +
      'menandakan tahap ini masih terlalu berat, dan sebaiknya kembali ke pengenalan sisi.</span></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-3">Urutan gerakan</div>' +
      '<div class="col gap-2" id="img-list"></div>' +
      '</div></div></div>';

    U.$('#img-list').innerHTML = IMAGERY.map(function (q, i) {
      return '<div class="ex-item" data-img-i="' + i + '" style="padding:8px 12px">' +
        '<span class="ex-num" style="width:26px;height:26px;font-size:10px">' + (i + 1) + '</span>' +
        '<span class="t-xs grow">' + U.esc(q.text) + '</span></div>';
    }).join('');

    U.$('#img-stage').innerHTML = '<div style="width:60%;max-width:180px">' +
      HandShapes.guide('open', side === 'Kanan' ? 'kanan' : 'kiri') + '</div>';

    U.$('#img-start').addEventListener('click', toggleImagery);
    U.$('#img-finish').addEventListener('click', finishImagery);
  }

  function toggleImagery() {
    var btn = U.$('#img-start');
    if (img.running) {
      img.running = false;
      clearInterval(img.timer);
      btn.innerHTML = Icon('play', 19) + '<span>Lanjut</span>';
      return;
    }
    img.running = true;
    U.$('#img-finish').disabled = false;
    btn.innerHTML = Icon('pause', 19) + '<span>Jeda</span>';
    showImagery();
    img.timer = setInterval(function () {
      img.sec++;
      U.$('#img-timer').textContent = U.mmss(img.sec);
      U.$('#img-prog').style.width = U.pct(img.sec, 8 * 60) + '%';
      if (img.sec % 20 === 0) { img.idx = (img.idx + 1) % IMAGERY.length; showImagery(); }
      if (img.sec === 8 * 60) UI.toast('Target 8 menit tercapai.', 'success');
    }, 1000);
  }

  function showImagery() {
    var q = IMAGERY[img.idx];
    U.$('#img-text').textContent = q.text;
    U.$('#img-sub').textContent = q.sub;
    U.$('#img-stage').innerHTML = '<div style="width:60%;max-width:180px">' +
      HandShapes.guide(q.pose, side === 'Kanan' ? 'kanan' : 'kiri') + '</div>';
    U.$$('#img-list [data-img-i]').forEach(function (n) {
      n.classList.toggle('now', Number(n.dataset.imgI) === img.idx);
    });
  }

  function finishImagery() {
    img.running = false;
    clearInterval(img.timer);
    var minutes = Math.max(1, Math.round(img.sec / 60));
    saveTherapySession('ex_imagery', minutes, minutes, 'menit', {});
    UI.toast('Sesi imajinasi gerak ' + U.dur(minutes) + ' tersimpan.', 'success');
    img.sec = 0; img.idx = 0;
    U.$('#img-timer').textContent = '00:00';
    U.$('#img-prog').style.width = '0%';
    U.$('#img-start').innerHTML = Icon('play', 19) + '<span>Mulai</span>';
    U.$('#img-finish').disabled = true;
  }

  /* ============================================================
     4. DISKRIMINASI SENSORIK (haptik lengan bionik)
     ============================================================ */
  var sensory = { running: false, trial: 0, total: 20, correct: 0, target: -1, answered: false };

  function renderSensory() {
    var host = U.$('[data-panel="sensory"]');
    host.innerHTML =
      '<div class="grid g-2-1">' +
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Di mana Anda merasakan getaran?</div>' +
      '<div class="card-sub">Lengan bionik memberi getaran pada salah satu titik. ' +
      'Tebak lokasinya tanpa melihat lengan.</div></div>' +
      '<span class="badge" id="sd-progress">0 / 20</span></div>' +

      '<div id="sd-gate"></div>' +

      '<div id="sd-body" class="hidden">' +
      '<div class="cue-box mb-4" id="sd-cue"><div>' +
      '<div class="cue-text" id="sd-text">Tekan Mulai</div>' +
      '<div class="cue-sub" id="sd-sub">Fokus pada sensasi di tunggul Anda</div>' +
      '</div></div>' +

      '<div class="row center"><div class="sd-grid" id="sd-grid"></div></div>' +

      '<div class="row center gap-3 mt-5">' +
      '<button class="btn btn-primary btn-lg" id="sd-start">' + Icon('play', 19) +
      '<span>Mulai 20 soal</span></button>' +
      '<button class="btn" id="sd-repeat" disabled>' + Icon('refresh', 18) +
      '<span>Ulangi getaran</span></button>' +
      '</div>' +
      '<div class="row between mt-4 t-sm">' +
      '<span class="muted">Benar: <strong id="sd-correct">0</strong></span>' +
      '<span class="muted">Ketepatan: <strong id="sd-acc">–</strong></span>' +
      '</div></div>' +
      '</div>' +

      '<div class="col gap-4">' +
      '<div class="card">' +
      '<div class="card-title mb-3">Mengapa latihan ini penting</div>' +
      '<p class="t-sm muted-2">Setelah amputasi, peta sensorik di otak mengalami reorganisasi, ' +
      'dan hal ini dikaitkan dengan nyeri phantom. Melatih pengenalan lokasi rangsang haptik ' +
      'bertujuan mempertajam kembali peta tersebut.</p>' +
      '<div class="alert info mt-4"><span class="a-ico">' + Icon('zap', 17) + '</span>' +
      '<span class="t-xs">Latihan ini membutuhkan lengan bionik terhubung, karena ' +
      'getaran dihasilkan oleh aktuator haptik pada socket.</span></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-3">Riwayat</div>' +
      '<div class="col gap-2" id="sd-hist"></div>' +
      '</div></div></div>';

    U.$('#sd-grid').innerHTML = [0, 1, 2, 3].map(function (i) {
      return '<button class="sd-cell" data-pad="' + i + '" aria-pressed="false" ' +
        'aria-label="Titik ' + (i + 1) + '">' + (i + 1) + '</button>';
    }).join('');

    renderSdHist();
    syncSensoryGate();
    Device.on('connected', syncSensoryGate);
    Device.on('disconnected', syncSensoryGate);

    U.on(U.$('#sd-grid'), 'click', '[data-pad]', function (e, btn) {
      answerSensory(Number(btn.dataset.pad), btn);
    });
  }

  function syncSensoryGate() {
    var gate = U.$('#sd-gate'), body = U.$('#sd-body');
    if (!gate) return;
    if (Device.state.connected) {
      gate.innerHTML = '';
      body.classList.remove('hidden');
      var s = U.$('#sd-start');
      if (s && !s.dataset.bound) {
        s.dataset.bound = '1';
        s.addEventListener('click', startSensory);
        U.$('#sd-repeat').addEventListener('click', function () {
          if (sensory.running && sensory.target >= 0) fireHaptic(sensory.target);
        });
      }
    } else {
      body.classList.add('hidden');
      gate.innerHTML = UI.empty({
        icon: 'bluetooth', title: 'Lengan bionik belum terhubung',
        desc: 'Latihan ini memerlukan aktuator haptik pada lengan. Hubungkan alat atau jalankan Mode Simulator.',
        action: '<button class="btn btn-primary" id="sd-conn">' + Icon('bluetooth', 18) +
          '<span>Hubungkan alat</span></button>'
      });
      var b = U.$('#sd-conn');
      if (b) b.addEventListener('click', function () {
        Device.connect('mock').then(function () { UI.toast('Simulator terhubung.', 'success'); });
      });
    }
  }

  function startSensory() {
    sensory = { running: true, trial: 0, total: 20, correct: 0, target: -1, answered: false };
    U.$('#sd-repeat').disabled = false;
    nextSensory();
  }

  function nextSensory() {
    if (sensory.trial >= sensory.total) { finishSensory(); return; }
    sensory.target = U.rndInt(0, 3);
    sensory.answered = false;
    U.$('#sd-progress').textContent = (sensory.trial + 1) + ' / ' + sensory.total;
    U.$('#sd-text').textContent = 'Rasakan…';
    U.$('#sd-sub').textContent = 'Tebak titik mana yang bergetar';
    U.$$('#sd-grid .sd-cell').forEach(function (n) {
      n.classList.remove('reveal-ok', 'reveal-bad');
      n.setAttribute('aria-pressed', 'false');
    });
    setTimeout(function () { fireHaptic(sensory.target); }, 420);
  }

  function fireHaptic(pad) {
    Device.testHaptic(pad);
    // Umpan visual singkat pada pad haptik virtual bila ada
    var stage = U.$('#sd-cue');
    if (stage) {
      stage.classList.add('hold');
      setTimeout(function () { stage.classList.remove('hold'); }, 380);
    }
  }

  function answerSensory(pad, btn) {
    if (!sensory.running || sensory.answered) return;
    sensory.answered = true;
    var ok = pad === sensory.target;
    if (ok) sensory.correct++;

    btn.classList.add(ok ? 'reveal-ok' : 'reveal-bad');
    if (!ok) {
      var right = U.$('#sd-grid [data-pad="' + sensory.target + '"]');
      if (right) right.classList.add('reveal-ok');
    }
    U.$('#sd-text').textContent = ok ? 'Tepat' : 'Belum tepat';
    U.$('#sd-sub').textContent = ok ? 'Lanjut ke soal berikutnya'
      : 'Yang bergetar adalah titik ' + (sensory.target + 1);

    sensory.trial++;
    U.$('#sd-correct').textContent = sensory.correct;
    U.$('#sd-acc').textContent = Math.round((sensory.correct / sensory.trial) * 100) + '%';
    setTimeout(nextSensory, 1150);
  }

  function stopSensory() {
    sensory.running = false;
  }

  function finishSensory() {
    sensory.running = false;
    var accuracy = Math.round((sensory.correct / sensory.total) * 100);
    Store.insert('sensoryScores', {
      patientId: pid, date: U.today(), accuracy: accuracy,
      correct: sensory.correct, total: sensory.total
    });
    saveTherapySession('ex_sensory', sensory.total, sensory.total, 'soal', { accuracy: accuracy });

    UI.modal({
      title: 'Diskriminasi sensorik selesai',
      size: 'sm',
      content: '<div class="grid g2 gap-3">' +
        '<div class="mini-stat"><span class="ms-v">' + accuracy + '%</span>' +
        '<span class="ms-l">Ketepatan</span></div>' +
        '<div class="mini-stat"><span class="ms-v">' + sensory.correct + '/' + sensory.total + '</span>' +
        '<span class="ms-l">Benar</span></div></div>' +
        '<div class="alert ' + (accuracy >= 70 ? 'success' : 'info') + ' mt-4">' +
        '<span class="a-ico">' + Icon(accuracy >= 70 ? 'checkCircle' : 'info', 18) + '</span>' +
        '<span class="t-sm">' + (accuracy >= 70
          ? 'Kemampuan membedakan lokasi rangsang Anda baik.'
          : 'Peluang menebak acak adalah 25%. Latihan rutin membantu meningkatkan ketepatan.') +
        '</span></div>',
      actions: [{ label: 'Tutup', class: 'btn-primary', onClick: function () { renderSdHist(); } }]
    });
    U.$('#sd-repeat').disabled = true;
  }

  function renderSdHist() {
    var host = U.$('#sd-hist');
    if (!host) return;
    var list = Store.list('sensoryScores').filter(function (s) { return s.patientId === pid; })
      .sort(function (a, b) { return b.date < a.date ? -1 : 1; }).slice(-6).reverse();
    if (!list.length) {
      host.innerHTML = '<span class="t-sm muted">Belum ada riwayat</span>';
      return;
    }
    host.innerHTML = list.map(function (s) {
      return '<div><div class="row between t-xs mb-1">' +
        '<span class="muted">' + U.esc(U.fmtDate(s.date, 'short')) + '</span>' +
        '<span class="semi">' + s.accuracy + '%</span></div>' +
        '<div class="prog sm teal"><i style="width:' + s.accuracy + '%"></i></div></div>';
    }).join('');
  }

  /* ============================================================
     Utilitas bersama
     ============================================================ */
  function askPain(question, cb) {
    var chosen = null;
    UI.modal({
      title: 'Skala nyeri phantom',
      size: 'sm',
      dismissible: false,
      content: '<p class="t-sm muted-2 mb-4">' + U.esc(question) + '</p>' +
        '<div class="pain-scale" id="ask-scale"></div>' +
        '<div class="row between mt-3 t-xs muted"><span>0 tidak nyeri</span><span>10 terberat</span></div>',
      actions: [{
        label: 'Lanjutkan', class: 'btn-primary',
        onClick: function () {
          if (chosen === null) { UI.toast('Pilih tingkat nyeri dahulu.', 'warning'); return false; }
          cb(chosen);
        }
      }],
      onOpen: function (m) {
        var h = U.$('#ask-scale', m.root);
        h.innerHTML = Array.from({ length: 11 }, function (_, i) {
          return '<button type="button" class="pain-btn" data-lvl="' + i + '" ' +
            'style="width:44px;height:44px;font-size:15px" aria-pressed="false">' + i + '</button>';
        }).join('');
        U.on(h, 'click', '.pain-btn', function (e, btn) {
          chosen = Number(btn.dataset.lvl);
          U.$$('.pain-btn', h).forEach(function (b) {
            b.setAttribute('aria-pressed', String(Number(b.dataset.lvl) === chosen));
          });
        });
      }
    });
  }

  /** Simpan sesi terapi phantom sebagai sesi latihan */
  function saveTherapySession(exId, done, target, unit, extra) {
    var ex = Seed.exercise(exId);
    var quality = extra.accuracy !== undefined ? extra.accuracy
      : U.clamp(Math.round((done / Math.max(1, target)) * 90), 20, 100);

    Store.insert('sessions', {
      patientId: pid,
      prescriptionId: (Analytics.prescription(pid) || {}).id || null,
      date: U.today(),
      startedAt: new Date().toISOString(),
      durationMin: unit === 'menit' ? done : Math.max(2, Math.round(done * 0.3)),
      status: 'selesai',
      adherencePct: U.clamp(Math.round((done / Math.max(1, target)) * 100), 0, 100),
      qualityScore: quality,
      exercises: [Object.assign({
        exId: exId, target: target, done: done, unit: unit,
        minutes: unit === 'menit' ? done : Math.max(2, Math.round(done * 0.3)),
        quality: quality
      }, extra)],
      deviceMode: Device.state.connected ? 'bionic' : 'tanpa-alat',
      studyPhase: (Study.currentPhase(pid) || {}).phase || null,
      category: 'phantom',
      note: ''
    });
    Notify.checkAchievements(pid);
  }

  /* ---------------- Bersihkan saat keluar ---------------- */
  window.addEventListener('pagehide', function () {
    if (mirrorApi && mirrorApi.isRunning()) mirrorApi.stop();
    clearInterval(mirrorTimer);
    clearInterval(img.timer);
  });

  /* ============================================================
     Inisialisasi
     Dijalankan di akhir modul supaya seluruh konstanta panel
     (CUES, IMAGERY, state sensorik) sudah terisi nilainya.
     Deklarasi var terangkat ke atas, tetapi nilainya baru ada
     setelah baris penugasan dieksekusi.
     ============================================================ */
  renderMirror();
  renderLaterality();
  renderImagery();
  renderSensory();

  UI.bindTabs(U.$('#tabs'), U.$('#panels'), function (name) {
    // Matikan kamera bila pindah tab, demi privasi dan hemat baterai
    if (name !== 'mirror' && mirrorApi && mirrorApi.isRunning()) mirrorApi.stop();
    if (name !== 'sensory' && sensory.running) stopSensory();
  });
})();
