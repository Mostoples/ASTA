/* ============================================================
   ASTA — Pemantauan Kepatuhan
   Rincian skor komposit, peta panas aktivitas, dan peringkat
   risiko putus terapi lintas pasien.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('terapis');
  if (!user) return;

  var shell = Shell.mount({
    title: 'Pemantauan Kepatuhan',
    desc: 'Skor komposit dan pola aktivitas seluruh pasien',
    actions: '<button class="btn" id="btn-export">' + Icon('download', 18) +
      '<span>Ekspor Rekap</span></button>'
  });
  if (!shell) return;
  var c = shell.content;

  var range = 14;
  var overviews = Analytics.allPatientsOverview(user.id);
  if (!overviews.length) overviews = Analytics.allPatientsOverview(null);

  c.innerHTML =
    '<div class="alert info">' +
    '<span class="a-ico">' + Icon('info', 18) + '</span>' +
    '<span class="t-sm"><strong>Cara skor dihitung:</strong> frekuensi sesi terhadap target (50%), ' +
    'kelengkapan latihan per sesi (30%), dan pemakaian alat terhadap 6 jam/hari (20%). ' +
    'Komponen pemakaian alat berasal dari telemetri, bukan laporan mandiri, sehingga lebih objektif.</span></div>' +

    '<section class="card tight">' +
    '<div class="row between wrap gap-3">' +
    '<div class="seg" id="seg-range">' +
    '<button data-value="7" aria-selected="false">7 hari</button>' +
    '<button data-value="14" aria-selected="true">14 hari</button>' +
    '<button data-value="30" aria-selected="false">30 hari</button>' +
    '</div>' +
    '<div class="row gap-3 t-sm" id="agg"></div>' +
    '</div></section>' +

    '<section class="grid g4" id="stats"></section>' +

    '<section class="card">' +
    '<div class="card-head"><div><div class="card-title">Rincian skor per pasien</div>' +
    '<div class="card-sub">Diurutkan dari risiko tertinggi</div></div></div>' +
    '<div class="col gap-3" id="rows"></div>' +
    '</section>' +

    '<section class="grid g2">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Tren kepatuhan mingguan</div>' +
    '<div class="card-sub">12 minggu, semua pasien</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-trend" data-height="250"></canvas></div>' +
    '<div class="chart-legend mt-3" id="trend-legend"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Distribusi hari latihan</div>' +
    '<div class="card-sub">Total sesi per hari dalam seminggu</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-dow" data-height="250"></canvas></div>' +
    '<p class="t-xs muted mt-3" id="dow-note"></p>' +
    '</div></section>' +

    '<section class="card">' +
    '<div class="card-head"><div><div class="card-title">Peta panas aktivitas</div>' +
    '<div class="card-sub">Setiap baris satu pasien, 12 minggu terakhir</div></div></div>' +
    '<div id="heatmaps"></div>' +
    '</section>';

  UI.bindSeg(U.$('#seg-range'), function (v) {
    range = Number(v);
    renderAll();
  });

  renderAll();
  renderTrend();
  renderDow();
  renderHeatmaps();

  function renderAll() {
    var rows = overviews.map(function (o) {
      return { ov: o, adh: Analytics.adherence(o.user.id, range) };
    }).sort(function (a, b) { return a.adh.score - b.adh.score; });

    var avg = Math.round(U.avg(rows.map(function (r) { return r.adh.score; })));
    var atRisk = rows.filter(function (r) { return r.adh.score < 60; }).length;
    var goodCount = rows.filter(function (r) { return r.adh.score >= 80; }).length;
    var totalSes = U.sum(rows.map(function (r) { return r.adh.sessionsDone; }));

    U.$('#agg').innerHTML =
      '<span class="muted">Rata-rata <strong class="' +
      (avg >= 70 ? 'c-success' : avg >= 50 ? 'c-warning' : 'c-danger') + '">' + avg + '%</strong></span>' +
      '<span class="muted">Berisiko <strong>' + atRisk + '</strong></span>';

    U.$('#stats').innerHTML =
      UI.statCard({ label: 'Kepatuhan rata-rata', value: avg, unit: '%', icon: 'target',
        tone: avg >= 70 ? 'success' : avg >= 50 ? 'warning' : 'danger',
        hint: range + ' hari terakhir' }) +
      UI.statCard({ label: 'Kepatuhan baik', value: goodCount, unit: 'pasien', icon: 'checkCircle',
        tone: 'success', hint: 'skor ≥ 80%' }) +
      UI.statCard({ label: 'Perlu perhatian', value: atRisk, unit: 'pasien', icon: 'alert',
        tone: atRisk ? 'warning' : 'success', hint: 'skor < 60%' }) +
      UI.statCard({ label: 'Total sesi', value: totalSes, icon: 'activity',
        hint: 'dalam ' + range + ' hari' });

    U.$('#rows').innerHTML = rows.map(function (r) {
      var o = r.ov, a = r.adh;
      var tone = U.adherenceTone(a.score);
      var scr = Study.latestScreening(o.user.id, 'PHQ-9');

      return '<div class="card flat"' +
        (a.score < 40 ? ' style="border-left:4px solid var(--danger)"' : '') + '>' +
        '<div class="row between wrap gap-4 mb-4">' +
        '<div class="row gap-3">' +
        '<span class="avatar ' + U.esc(o.user.avatar || '') + '">' +
        U.esc(U.initials(o.user.name)) + '</span>' +
        '<div><span class="semi">' + U.esc(o.user.name) + '</span>' +
        '<div class="t-xs muted">' + U.esc(o.user.program || '') + '</div></div></div>' +
        '<div class="row gap-3 wrap">' +
        '<span class="badge badge-' + tone.tone + '">' + U.esc(tone.label) + '</span>' +
        '<span class="t-2xl bold" style="line-height:1">' + a.score + '<span class="t-sm muted">%</span></span>' +
        '<a class="btn btn-sm btn-primary" href="terapis-pasien.html?id=' + U.esc(o.user.id) + '">' +
        Icon('chevronRight', 15) + '<span>Detail</span></a>' +
        '</div></div>' +

        /* Rincian komponen */
        '<div class="grid g3 gap-4">' +
        component('Frekuensi (50%)', a.freqPct, a.sessionsDone + '/' + a.sessionsTarget + ' sesi', '') +
        component('Kelengkapan (30%)', a.completionPct, 'rata-rata per sesi', 'teal') +
        component('Pemakaian alat (20%)', a.wearPct, a.wearAvgHours + ' dari 6 jam/hari', 'violet') +
        '</div>' +

        '<div class="row gap-3 mt-4 wrap t-xs">' +
        '<span class="badge">' + Icon('fire', 11) + 'Streak ' + o.streak.current + ' hari</span>' +
        '<span class="badge">' + Icon('clock', 11) +
        (o.lastSession ? o.daysSinceSession + ' hari sejak latihan' : 'belum pernah latihan') + '</span>' +
        '<span class="badge" style="background:' + Chart.alpha(U.painColor(o.pain.avg), 0.14) +
        ';color:' + U.painColor(o.pain.avg) + '">' + Icon('brain', 11) + 'Nyeri ' + o.pain.avg + '</span>' +
        (scr ? '<span class="badge badge-' + Study.phq9Interpret(scr.score).tone + '">' +
          Icon('clipboard', 11) + 'PHQ-9 ' + scr.score + '</span>' : '') +
        '</div>' +

        (a.score < 60
          ? '<div class="alert warning mt-4"><span class="a-ico">' + Icon('info', 17) + '</span>' +
            '<span class="t-xs"><strong>Hambatan terbesar:</strong> ' + U.esc(bottleneck(a)) + '</span></div>'
          : '') +
        '</div>';
    }).join('');
  }

  function component(label, pct, sub, tone) {
    return '<div>' +
      '<div class="row between t-xs mb-1"><span class="semi">' + U.esc(label) + '</span>' +
      '<span class="muted">' + pct + '%</span></div>' +
      '<div class="prog sm ' + tone + '"><i style="width:' + U.clamp(pct, 0, 100) + '%"></i></div>' +
      '<div class="t-xs muted mt-1">' + U.esc(sub) + '</div></div>';
  }

  function bottleneck(a) {
    var parts = [
      { k: 'frekuensi sesi', v: a.freqPct,
        tip: 'pasien jarang memulai sesi. Pertimbangkan mengurangi target mingguan atau memperpendek sesi.' },
      { k: 'kelengkapan latihan', v: a.completionPct,
        tip: 'sesi dimulai namun tidak diselesaikan. Program mungkin terlalu berat atau terlalu panjang.' },
      { k: 'pemakaian alat', v: a.wearPct,
        tip: 'alat jarang dipakai di luar sesi. Periksa kenyamanan socket dan tambahkan latihan ADL.' }
    ].sort(function (x, y) { return x.v - y.v; });
    return parts[0].k + ' (' + parts[0].v + '%) — ' + parts[0].tip;
  }

  /* ---------------- Tren mingguan ---------------- */
  function renderTrend() {
    var COLORS = ['#2b6cde', '#10a5a5', '#7a5af8', '#d98b0b', '#1c9e6b', '#d64545'];
    var series = overviews.slice(0, 6).map(function (o, i) {
      var w = Analytics.adherenceWeekly(o.user.id, 12);
      return {
        name: o.user.name, color: COLORS[i % COLORS.length],
        data: w.map(function (x) { return x.pct; })
      };
    });
    var labels = Analytics.adherenceWeekly(overviews[0].user.id, 12).map(function (x) { return x.label; });

    Chart.line(U.$('#ch-trend'), {
      labels: labels, height: 250, yMax: 120, ticks: 4,
      showDots: false, series: series,
      targetLine: 80, targetLabel: 'Target 80%'
    });

    U.$('#trend-legend').innerHTML = series.map(function (s) {
      return '<span><i style="background:' + s.color + '"></i>' +
        U.esc(s.name.split(' ')[0]) + '</span>';
    }).join('');
  }

  /* ---------------- Distribusi hari ---------------- */
  function renderDow() {
    var counts = [0, 0, 0, 0, 0, 0, 0];
    overviews.forEach(function (o) {
      Analytics.sessions(o.user.id, 84).forEach(function (s) {
        counts[U.d(s.date).getDay()]++;
      });
    });
    Chart.bar(U.$('#ch-dow'), {
      labels: U.DOW_S, data: counts, height: 250, showValues: true,
      colors: counts.map(function (v) {
        var max = Math.max.apply(null, counts) || 1;
        return v / max >= 0.8 ? '#1c9e6b' : v / max >= 0.5 ? '#2b6cde' : '#d98b0b';
      })
    });

    var min = counts.indexOf(Math.min.apply(null, counts));
    var max = counts.indexOf(Math.max.apply(null, counts));
    U.$('#dow-note').textContent = 'Hari paling aktif: ' + U.DOW[max] +
      ' (' + counts[max] + ' sesi). Paling sepi: ' + U.DOW[min] + ' (' + counts[min] +
      ' sesi). Pertimbangkan memindahkan jadwal dari hari yang jarang dipatuhi.';
  }

  /* ---------------- Peta panas ---------------- */
  function renderHeatmaps() {
    U.$('#heatmaps').innerHTML = overviews.map(function (o) {
      var byDay = {};
      Store.list('sessions').forEach(function (s) {
        if (s.patientId !== o.user.id) return;
        byDay[s.date] = (byDay[s.date] || 0) + (s.durationMin || 0);
      });

      var cells = [];
      var start = U.addDays(new Date(), -83);
      start = U.addDays(start, -start.getDay());
      var cursor = U.d(start);
      var todayKey = U.today();
      while (U.dayKey(cursor) <= todayKey) {
        var k = U.dayKey(cursor);
        var mins = byDay[k] || 0;
        var lvl = mins === 0 ? 0 : mins < 15 ? 1 : mins < 30 ? 2 : mins < 50 ? 3 : 4;
        cells.push('<span class="heat-cell" data-lvl="' + lvl + '" data-tip="' +
          U.esc(U.fmtDate(cursor, 'short') + ': ' + (mins ? U.dur(mins) : 'kosong')) + '"></span>');
        cursor = U.addDays(cursor, 1);
      }

      return '<div class="mb-5">' +
        '<div class="row between mb-2 wrap gap-2">' +
        '<span class="row gap-2"><span class="avatar sm ' + U.esc(o.user.avatar || '') + '">' +
        U.esc(U.initials(o.user.name)) + '</span>' +
        '<span class="t-sm semi">' + U.esc(o.user.name) + '</span></span>' +
        '<span class="badge badge-' + U.adherenceTone(o.adherence.score).tone + '">' +
        o.adherence.score + '%</span></div>' +
        '<div style="overflow-x:auto"><div class="heat">' + cells.join('') + '</div></div>' +
        '</div>';
    }).join('');
  }

  /* ---------------- Ekspor rekap ---------------- */
  U.$('#btn-export').addEventListener('click', function () {
    var rows = overviews.map(function (o) {
      var a = Analytics.adherence(o.user.id, range);
      var scr = Study.latestScreening(o.user.id, 'PHQ-9');
      var ph = Study.currentPhase(o.user.id);
      return [
        o.user.name, (o.user.amputation || {}).level, (o.user.amputation || {}).side,
        ph ? ph.phase : '', a.score, a.freqPct, a.completionPct, a.wearPct,
        a.sessionsDone, a.sessionsTarget, a.wearAvgHours,
        o.pain.avg, o.pain.trend, o.streak.current, o.daysSinceSession,
        scr ? scr.score : '', o.riskLevel, o.risks.join('; ')
      ];
    });
    var headers = ['nama', 'tingkat_amputasi', 'sisi', 'fase_studi', 'skor_kepatuhan',
      'komponen_frekuensi', 'komponen_kelengkapan', 'komponen_pemakaian',
      'sesi_terlaksana', 'sesi_target', 'jam_pakai_rata2', 'nyeri_rata2', 'tren_nyeri',
      'streak_hari', 'hari_sejak_latihan', 'phq9', 'tingkat_risiko', 'penanda_risiko'];
    U.downloadText('asta_rekap_kepatuhan_' + U.today() + '.csv',
      U.toCSV(rows, headers), 'text/csv;charset=utf-8');
    UI.toast('Rekap kepatuhan diunduh.', 'success');
  });

  Chart.responsive(function () { renderTrend(); renderDow(); });
})();
