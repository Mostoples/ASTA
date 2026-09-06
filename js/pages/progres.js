/* ============================================================
   ASTA — Progres & Analisis
   Analisis inti penelitian: perbandingan fase A-B-A,
   korelasi nyeri vs pemakaian, tren kepatuhan, dan ekspor data.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('pasien');
  if (!user) return;

  var pid = user.id;
  var shell = Shell.mount({
    title: 'Progres & Analisis',
    desc: 'Data 90 hari perjalanan rehabilitasi Anda',
    actions: '<button class="btn" id="btn-export">' + Icon('download', 18) +
      '<span>Ekspor Data</span></button>'
  });
  if (!shell) return;
  var c = shell.content;

  /* ---------------- Data ---------------- */
  var corr = Analytics.painVsUsage(pid, 90);
  var phaseSum = Study.phaseSummary(pid);
  var effect = Study.effect(pid);
  var adhWeekly = Analytics.adherenceWeekly(pid, 12);
  var pain90 = Analytics.painStats(pid, 90);
  var pain30 = Analytics.painStats(pid, 30);
  var usage30 = Analytics.usageStats(pid, 30);
  var catProg = Analytics.categoryProgress(pid, 30);
  var assessments = Store.list('assessments').filter(function (a) { return a.patientId === pid; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  var screenings = Study.screenings(pid, 'PHQ-9');
  var aeStats = Study.aeStats(pid);

  c.innerHTML =
    /* ===== Ringkasan atas ===== */
    '<section class="grid g4">' +
    UI.statCard({ label: 'Nyeri 30 hari', value: pain30.avg, unit: '/10', icon: 'brain', tone: 'violet',
      delta: pain90.delta ? U.round(pain90.delta, 1) : null, deltaUnit: ' poin', invert: true,
      hint: 'tren ' + pain90.trend }) +
    UI.statCard({ label: 'Pemakaian alat', value: usage30.wearAvg, unit: 'jam/hari', icon: 'clock', tone: 'teal',
      hint: U.nf(usage30.gripTotal) + ' cengkeraman' }) +
    UI.statCard({ label: 'Keberhasilan grip', value: usage30.successRate, unit: '%', icon: 'hand',
      tone: usage30.successRate >= 85 ? 'success' : 'warning', hint: '30 hari' }) +
    UI.statCard({ label: 'Kejadian tak diinginkan', value: aeStats.total, unit: 'laporan', icon: 'shield',
      tone: aeStats.berat ? 'danger' : aeStats.sedang ? 'warning' : 'success',
      hint: aeStats.open + ' belum selesai' }) +
    '</section>' +

    /* ===== Analisis fase A-B-A ===== */
    (phaseSum.length
      ? '<section class="card">' +
        '<div class="card-head">' +
        '<div><div class="card-title">Perbandingan fase penelitian</div>' +
        '<div class="card-sub">Desain A-B-A: fase A tanpa umpan balik haptik, fase B dengan haptik. ' +
        'Perbandingan ini menguji apakah efek benar-benar berasal dari umpan balik sensorik.</div></div>' +
        '</div>' +
        '<div class="chart-box"><canvas id="ch-phase" data-height="270"></canvas></div>' +
        '<div class="chart-legend mt-3" id="phase-legend"></div>' +
        (effect
          ? '<div class="alert ' + (effect.favorsHaptic ? 'success' : 'warning') + ' mt-4">' +
            '<span class="a-ico">' + Icon(effect.favorsHaptic ? 'checkCircle' : 'info', 18) + '</span>' +
            '<span class="t-sm">Rata-rata nyeri saat haptik <strong>aktif</strong> adalah ' +
            '<strong>' + effect.painWithHaptic + '/10</strong>, sedangkan saat <strong>nonaktif</strong> ' +
            '<strong>' + effect.painWithoutHaptic + '/10</strong>. Selisih ' + Math.abs(effect.diff) +
            ' poin, ukuran efek Cohen\u2019s d = ' + effect.cohensD + ' (' + effect.magnitude + ').' +
            (effect.favorsHaptic
              ? ' Pola ini konsisten dengan hipotesis bahwa umpan balik sensorik menurunkan nyeri phantom.'
              : ' Arah efek belum mendukung hipotesis pada data Anda saat ini.') +
            '</span></div>'
          : '') +
        '<div class="div-label">Rincian per fase</div>' +
        '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Fase</th><th>Haptik</th><th>Periode</th><th>Hari</th>' +
        '<th>Nyeri (rata ± SD)</th><th>Hari berat</th><th>Tidur terganggu</th>' +
        '<th>Jam pakai</th><th>Kepatuhan</th></tr></thead><tbody>' +
        phaseSum.map(function (p) {
          return '<tr>' +
            '<td><span class="badge" style="background:' + Chart.alpha(p.color, 0.15) +
            ';color:' + p.color + '">' + U.esc(p.label) + '</span></td>' +
            '<td>' + (p.haptic
              ? '<span class="badge badge-success">Aktif</span>'
              : '<span class="badge">Nonaktif</span>') + '</td>' +
            '<td class="t-xs nowrap">' + U.esc(U.fmtDate(p.from, 'short')) + ' – ' +
            U.esc(p.to ? U.fmtDate(p.to, 'short') : 'kini') + '</td>' +
            '<td>' + p.days + '</td>' +
            '<td class="semi">' + (p.painAvg !== null
              ? p.painAvg + (p.painSd !== null ? ' ± ' + p.painSd : '') : '–') + '</td>' +
            '<td>' + p.severeDays + '</td>' +
            '<td>' + p.sleepDays + '</td>' +
            '<td>' + (p.wearAvg !== null ? p.wearAvg + 'j' : '–') + '</td>' +
            '<td>' + p.adherencePct + '%</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '</section>'
      : '') +

    /* ===== Korelasi nyeri vs pemakaian ===== */
    '<section class="grid g-2-1">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Nyeri terhadap pemakaian alat</div>' +
    '<div class="card-sub">Setiap titik adalah satu hari. Garis putus adalah tren.</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-scatter" data-height="290"></canvas></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-title mb-4">Interpretasi</div>' +
    '<div class="mini-stat mb-3">' +
    '<span class="ms-v ' + (corr.r < -0.2 ? 'c-success' : corr.r > 0.2 ? 'c-danger' : '') + '">r = ' +
    corr.r + '</span>' +
    '<span class="ms-l">Korelasi Pearson · ' + U.esc(corr.strength) + '</span></div>' +
    '<p class="t-sm muted-2">' +
    (corr.r < -0.2
      ? 'Korelasi negatif: hari dengan pemakaian alat lebih lama cenderung menunjukkan nyeri lebih rendah.'
      : corr.r > 0.2
        ? 'Korelasi positif: hari dengan pemakaian lebih lama justru menunjukkan nyeri lebih tinggi. Perlu ditinjau bersama terapis.'
        : 'Belum terlihat hubungan yang jelas antara lama pemakaian dan tingkat nyeri.') +
    '</p>' +
    '<div class="alert info mt-4"><span class="a-ico">' + Icon('info', 17) + '</span>' +
    '<span class="t-xs">Korelasi bukan sebab-akibat. Perbandingan fase A-B-A di atas lebih kuat ' +
    'untuk menyimpulkan pengaruh umpan balik sensorik.</span></div>' +
    '<div class="div-label">Pembagian median</div>' +
    '<div class="grid g2 gap-2">' +
    '<div class="mini-stat"><span class="ms-v">' + (corr.painLowUse || '–') + '</span>' +
    '<span class="ms-l">Nyeri saat pakai < ' + corr.medianWear + 'j</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' + (corr.painHighUse || '–') + '</span>' +
    '<span class="ms-l">Nyeri saat pakai ≥ ' + corr.medianWear + 'j</span></div>' +
    '</div>' +
    '<div class="t-xs muted mt-3">Berdasarkan ' + corr.n + ' hari dengan data lengkap.</div>' +
    '</div></section>' +

    /* ===== Kepatuhan & kategori ===== */
    '<section class="grid g-2-1">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Kepatuhan mingguan</div>' +
    '<div class="card-sub">Persentase target sesi yang terlaksana, 12 minggu</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-adh" data-height="220"></canvas></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-title mb-4">Mutu per kategori</div>' +
    '<div class="chart-box"><canvas id="ch-radar" data-height="230"></canvas></div>' +
    '<div class="col gap-2 mt-3">' +
    catProg.map(function (k) {
      return '<div class="row between t-xs">' +
        '<span class="semi">' + U.esc(k.label) + '</span>' +
        '<span class="muted">' + k.avgQuality + '/100 · ' + k.n + ' latihan</span></div>';
    }).join('') +
    '</div></div></section>' +

    /* ===== Asesmen & kesejahteraan ===== */
    '<section class="grid g2">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Asesmen terstandar</div>' +
    '<div class="card-sub">Instrumen klinis yang diisi bersama terapis</div></div></div>' +
    '<div id="assess-list"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Kesejahteraan psikologis</div>' +
    '<div class="card-sub">PHQ-9 · skor lebih rendah lebih baik</div></div>' +
    '<button class="btn btn-sm" id="btn-phq">' + Icon('clipboard', 15) + '<span>Isi sekarang</span></button>' +
    '</div>' +
    '<div id="phq-box"></div>' +
    '</div></section>' +

    /* ===== Peta nyeri & catatan ===== */
    '<section class="grid g3">' +
    '<div class="card">' +
    '<div class="card-title mb-3">Peta nyeri 90 hari</div>' +
    '<div class="bodymap" id="heat90"></div>' +
    '<div class="mt-3">' + BodyMap.heatLegend() + '</div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-title mb-3">Lokasi tersering</div>' +
    '<div class="col gap-3" id="top-zones"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-title mb-3">Kejadian tidak diinginkan</div>' +
    '<div class="grid g2 gap-2 mb-4">' +
    '<div class="mini-stat"><span class="ms-v">' + aeStats.ringan + '</span><span class="ms-l">Ringan</span></div>' +
    '<div class="mini-stat"><span class="ms-v ' + (aeStats.sedang ? 'c-warning' : '') + '">' +
    aeStats.sedang + '</span><span class="ms-l">Sedang</span></div>' +
    '<div class="mini-stat"><span class="ms-v ' + (aeStats.berat ? 'c-danger' : '') + '">' +
    aeStats.berat + '</span><span class="ms-l">Berat</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' + aeStats.stopped + '</span>' +
    '<span class="ms-l">Terapi dihentikan</span></div>' +
    '</div>' +
    '<div class="col gap-2" id="ae-top"></div>' +
    '</div></section>';

  /* ---------------- Grafik fase ---------------- */
  function drawPhase() {
    var keys = [], labels = [], pain = [], wear = [], haptic = [];
    var painMap = {}, telMap = {};
    Analytics.painLogs(pid, 90).forEach(function (p) { painMap[p.date] = p; });
    Analytics.telemetry(pid, 90).forEach(function (t) { telMap[t.date] = t; });

    for (var i = 89; i >= 0; i--) {
      var d = U.addDays(new Date(), -i);
      var k = U.dayKey(d);
      keys.push(k);
      labels.push(U.fmtDate(d, 'short'));
      pain.push(painMap[k] ? painMap[k].level : null);
      wear.push(telMap[k] ? telMap[k].wearHours : 0);
      haptic.push(telMap[k] ? (telMap[k].hapticEvents || 0) : 0);
    }

    var bands = Study.phaseBands(pid, keys);
    Chart.line(U.$('#ch-phase'), {
      labels: labels, height: 270, yMax: 10, ticks: 5, yMaxRight: 14,
      showDots: false, bands: bands,
      series: [
        { name: 'Jam pakai', data: wear, color: 'rgba(43,108,222,.2)', type: 'bar', axis: 'right' },
        { name: 'Nyeri', data: pain, color: '#7a5af8', fill: true, width: 2.8 }
      ]
    });

    U.$('#phase-legend').innerHTML =
      '<span><i style="background:#7a5af8"></i>Skor nyeri (0–10)</span>' +
      '<span><i class="sq" style="background:rgba(43,108,222,.2)"></i>Jam pakai alat</span>' +
      bands.map(function (b) {
        var def = Study.phaseDef(b.phase);
        return '<span><i class="sq" style="background:' + Chart.alpha(def.color, 0.28) +
          ';border:1.5px solid ' + def.color + '"></i>' + U.esc(def.short) + ' · ' +
          (def.haptic ? 'haptik aktif' : 'haptik mati') + '</span>';
      }).join('');
  }
  if (phaseSum.length) { drawPhase(); }

  /* ---------------- Scatter korelasi ---------------- */
  function drawScatter() {
    Chart.scatter(U.$('#ch-scatter'), {
      points: corr.points, height: 290, yMax: 10,
      xTitle: 'Jam pakai lengan bionik per hari',
      yTitle: 'Skor nyeri phantom (0–10)',
      trendColor: '#d64545'
    });
  }
  drawScatter();

  /* ---------------- Kepatuhan mingguan ---------------- */
  function drawAdh() {
    Chart.bar(U.$('#ch-adh'), {
      labels: adhWeekly.map(function (w) { return w.label; }),
      data: adhWeekly.map(function (w) { return w.pct; }),
      height: 220, yMax: 120, showValues: true,
      colors: adhWeekly.map(function (w) {
        return w.pct >= 80 ? '#1c9e6b' : w.pct >= 60 ? '#2b6cde' : w.pct >= 40 ? '#d98b0b' : '#d64545';
      })
    });
  }
  drawAdh();

  /* ---------------- Radar kategori ---------------- */
  function drawRadar() {
    var axes = catProg.map(function (k) { return k.label; });
    if (axes.length < 3) axes = axes.concat(['—']);
    Chart.radar(U.$('#ch-radar'), {
      height: 230, max: 100, axes: axes,
      series: [{
        name: 'Mutu', color: '#2b6cde',
        data: catProg.map(function (k) { return k.avgQuality; }).concat(
          axes.length > catProg.length ? [0] : [])
      }]
    });
  }
  drawRadar();

  Chart.responsive(function () {
    if (phaseSum.length) drawPhase();
    drawScatter(); drawAdh(); drawRadar();
  });

  /* ---------------- Asesmen ---------------- */
  var assessHost = U.$('#assess-list');
  if (!assessments.length) {
    assessHost.innerHTML = UI.empty({ icon: 'clipboard', title: 'Belum ada asesmen',
      desc: 'Terapis akan mengisi instrumen ini saat evaluasi berkala.' });
  } else {
    var byInstr = U.groupBy(assessments, 'instrument');
    assessHost.innerHTML = Object.keys(byInstr).map(function (name) {
      var list = byInstr[name];
      var last = list[list.length - 1];
      var first = list[0];
      var change = list.length > 1 ? last.score - first.score : null;
      var better = change === null ? null : (last.lowerBetter ? change < 0 : change > 0);
      return '<div class="mb-4">' +
        '<div class="row between mb-2">' +
        '<span class="semi t-sm">' + U.esc(name) + '</span>' +
        '<span class="row gap-2">' +
        (change !== null
          ? '<span class="stat-delta ' + (better ? 'c-success' : 'c-danger') + '">' +
            Icon(change > 0 ? 'arrowUp' : 'arrowDown', 12) + Math.abs(change) + '</span>'
          : '') +
        '<span class="bold">' + last.score + '<span class="muted t-xs">/' + last.max + '</span></span>' +
        '</span></div>' +
        '<div class="prog sm ' + (better === false ? 'danger' : 'success') + '">' +
        '<i style="width:' + U.pct(last.score, last.max) + '%"></i></div>' +
        '<div class="t-xs muted mt-1">' + U.esc(U.fmtDate(last.date, 'long')) +
        (last.lowerBetter ? ' · skor rendah lebih baik' : ' · skor tinggi lebih baik') + '</div>' +
        '</div>';
    }).join('');
  }

  /* ---------------- PHQ-9 ---------------- */
  function renderPhq() {
    var host = U.$('#phq-box');
    if (!screenings.length) {
      host.innerHTML = UI.empty({ icon: 'brain', title: 'Belum pernah diisi',
        desc: 'Skrining singkat ini membantu tim klinis memahami hambatan non-fisik dalam terapi Anda.' });
      return;
    }
    var last = screenings[screenings.length - 1];
    var interp = Study.phq9Interpret(last.score);
    host.innerHTML =
      '<div class="row between mb-3">' +
      '<span><span class="t-2xl bold">' + last.score + '</span>' +
      '<span class="muted t-sm">/27</span></span>' +
      '<span class="badge badge-' + interp.tone + '">' + U.esc(interp.label) + '</span></div>' +
      '<div class="prog ' + (interp.tone === 'primary' ? '' : interp.tone) + '">' +
      '<i style="width:' + U.pct(last.score, 27) + '%"></i></div>' +
      '<p class="t-xs muted mt-2">Diisi ' + U.esc(U.fmtDate(last.date, 'long')) + '</p>' +
      (last.flagSelfHarm
        ? '<div class="alert danger mt-3"><span class="a-ico">' + Icon('alert', 17) + '</span>' +
          '<span class="t-xs">Anda melaporkan pikiran menyakiti diri. Bila pikiran ini muncul, ' +
          'segera hubungi tim klinis Anda atau layanan kesehatan jiwa terdekat. ' +
          'Anda tidak sendirian dalam hal ini.</span></div>'
        : '') +
      (screenings.length > 1
        ? '<div class="chart-box mt-4"><canvas id="ch-phq" data-height="140"></canvas></div>'
        : '');

    if (screenings.length > 1) {
      Chart.line(U.$('#ch-phq'), {
        labels: screenings.map(function (s) { return U.fmtDate(s.date, 'short'); }),
        height: 140, yMax: 27, ticks: 3,
        series: [{ name: 'PHQ-9', data: screenings.map(function (s) { return s.score; }),
          color: '#7a5af8', fill: true }]
      });
    }
  }
  renderPhq();

  U.$('#btn-phq').addEventListener('click', openPhq);

  function openPhq() {
    var answers = new Array(9).fill(null);
    UI.modal({
      title: 'Skrining PHQ-9',
      subtitle: 'Selama 2 minggu terakhir, seberapa sering Anda merasakan hal berikut?',
      size: 'lg',
      content:
        '<div class="alert info mb-4"><span class="a-ico">' + Icon('info', 18) + '</span>' +
        '<span class="t-sm">Kuesioner ini alat skrining, bukan diagnosis. Hasilnya dibagikan ' +
        'kepada terapis Anda untuk menyesuaikan dukungan yang diberikan.</span></div>' +
        '<div class="col gap-4" id="phq-items">' +
        Study.PHQ9.map(function (q, i) {
          return '<div class="card sunken tight">' +
            '<div class="t-sm semi mb-3">' + (i + 1) + '. ' + U.esc(q) + '</div>' +
            '<div class="row wrap gap-2" data-q="' + i + '">' +
            Study.PHQ9_OPTIONS.map(function (o) {
              return '<button type="button" class="chip" data-v="' + o.v + '" aria-pressed="false">' +
                U.esc(o.label) + '</button>';
            }).join('') + '</div></div>';
        }).join('') + '</div>',
      actions: [
        { label: 'Batal' },
        {
          label: 'Simpan', class: 'btn-primary', icon: 'check',
          onClick: function (m) {
            var missing = answers.findIndex(function (a) { return a === null; });
            if (missing >= 0) {
              UI.toast('Pertanyaan nomor ' + (missing + 1) + ' belum dijawab.', 'warning');
              var el = U.$('[data-q="' + missing + '"]', m.root);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return false;
            }
            var rec = Study.saveScreening(pid, answers);
            var interp = Study.phq9Interpret(rec.score);
            screenings = Study.screenings(pid, 'PHQ-9');
            renderPhq();
            UI.toast('Skor ' + rec.score + '/27 — ' + interp.label + '. ' + interp.advice,
              interp.tone === 'success' ? 'success' : interp.tone === 'danger' ? 'warning' : 'info',
              { title: 'Skrining tersimpan', duration: 7000 });
          }
        }
      ],
      onOpen: function (m) {
        U.on(m.root, 'click', '[data-v]', function (e, btn) {
          var group = btn.closest('[data-q]');
          var qi = Number(group.dataset.q);
          answers[qi] = Number(btn.dataset.v);
          U.$$('[data-v]', group).forEach(function (b) {
            b.setAttribute('aria-pressed', String(b === btn));
          });
        });
      }
    });
  }

  /* ---------------- Peta nyeri 90 hari ---------------- */
  BodyMap.create(U.$('#heat90'), {
    readonly: true, side: (user.amputation || {}).side,
    heat: BodyMap.heatFromLogs(Analytics.painLogs(pid, 90))
  });

  var zoneHost = U.$('#top-zones');
  if (!pain90.topZones.length) {
    zoneHost.innerHTML = '<span class="t-sm muted">Belum ada data</span>';
  } else {
    var maxZ = pain90.topZones[0].n;
    zoneHost.innerHTML = pain90.topZones.map(function (z) {
      var ph = BodyMap.isPhantom(z.key);
      return '<div><div class="row between t-xs mb-1">' +
        '<span class="semi">' + Icon(ph ? 'brain' : 'target', 12) + ' ' +
        U.esc(BodyMap.zoneLabel(z.key)) + '</span>' +
        '<span class="muted">' + z.n + ' hari</span></div>' +
        '<div class="prog sm ' + (ph ? 'violet' : '') + '">' +
        '<i style="width:' + U.pct(z.n, maxZ) + '%"></i></div></div>';
    }).join('');
  }

  var aeTopHost = U.$('#ae-top');
  if (!aeStats.topTypes.length) {
    aeTopHost.innerHTML = '<span class="t-sm muted">Tidak ada laporan kejadian. Ini kabar baik.</span>';
  } else {
    var maxA = aeStats.topTypes[0].n;
    aeTopHost.innerHTML = aeStats.topTypes.map(function (t) {
      return '<div><div class="row between t-xs mb-1">' +
        '<span class="semi">' + U.esc(t.label) + '</span>' +
        '<span class="muted">' + t.n + 'x</span></div>' +
        '<div class="prog sm warning"><i style="width:' + U.pct(t.n, maxA) + '%"></i></div></div>';
    }).join('');
  }

  /* ---------------- Ekspor ---------------- */
  U.$('#btn-export').addEventListener('click', function () {
    var consent = Study.consent(pid);
    var allowPub = consent && consent.agreed && consent.agreed.indexOf('publikasi') >= 0;

    UI.modal({
      title: 'Ekspor data Anda',
      size: 'sm',
      content:
        '<p class="t-sm muted-2 mb-4">Anda berhak memperoleh salinan data Anda sendiri. ' +
        'Berkas CSV dapat dibuka dengan Excel atau perangkat analisis statistik.</p>' +
        '<div class="col gap-3">' +
        '<button class="role-opt" data-exp="mine">' +
        '<span class="r-ico">' + Icon('file', 19) + '</span>' +
        '<span><span class="r-name">Data harian saya (90 hari)</span>' +
        '<span class="r-desc">Nyeri, pemakaian alat, sesi latihan, mutu gerak</span></span></button>' +
        '<button class="role-opt" data-exp="anon">' +
        '<span class="r-ico">' + Icon('shield', 19) + '</span>' +
        '<span><span class="r-name">Versi anonim</span>' +
        '<span class="r-desc">Identitas diganti kode subjek, untuk keperluan penelitian</span></span></button>' +
        '</div>' +
        '<div class="alert ' + (allowPub ? 'info' : 'warning') + ' mt-4">' +
        '<span class="a-ico">' + Icon(allowPub ? 'info' : 'alert', 17) + '</span>' +
        '<span class="t-xs">' + (allowPub
          ? 'Anda telah menyetujui penggunaan data anonim untuk publikasi ilmiah.'
          : 'Anda belum menyetujui penggunaan data untuk publikasi. Ekspor pribadi tetap dapat dilakukan.') +
        '</span></div>',
      actions: [{ label: 'Tutup' }],
      onOpen: function (m) {
        U.$$('[data-exp]', m.root).forEach(function (b) {
          b.addEventListener('click', function () {
            var anon = b.dataset.exp === 'anon';
            var res = Analytics.exportPatientCSV(pid, anon);
            U.downloadText(res.name, res.csv, 'text/csv;charset=utf-8');
            UI.toast('Berkas ' + res.name + ' diunduh.', 'success');
            m.close();
          });
        });
      }
    });
  });

  /* ---------------- Tawarkan skrining bila jatuh tempo ---------------- */
  if (Study.screeningDue(pid, 30)) {
    setTimeout(function () {
      UI.toast('Skrining PHQ-9 bulanan Anda sudah jatuh tempo.', 'info',
        { title: 'Pengingat skrining', duration: 6500 });
    }, 1400);
  }
})();
