/* ============================================================
   ASTA — Pemantauan Nyeri Phantom (lintas pasien)
   Tren antar pasien, efek terapi cermin, agregat fase A-B-A,
   dan daftar kejadian tidak diinginkan.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('terapis');
  if (!user) return;

  var shell = Shell.mount({
    title: 'Pemantauan Nyeri',
    desc: 'Tren nyeri phantom, efek intervensi, dan analisis pemicu',
    actions: '<button class="btn" id="btn-export">' + Icon('download', 18) +
      '<span>Ekspor Dataset</span></button>'
  });
  if (!shell) return;
  var c = shell.content;

  var overviews = Analytics.allPatientsOverview(user.id);
  if (!overviews.length) overviews = Analytics.allPatientsOverview(null);

  /* ---------------- Agregat fase lintas pasien ---------------- */
  var effects = overviews.map(function (o) {
    return { user: o.user, effect: Study.effect(o.user.id) };
  }).filter(function (e) { return e.effect; });

  var groupWith = [], groupWithout = [];
  effects.forEach(function (e) {
    groupWith.push(e.effect.painWithHaptic);
    groupWithout.push(e.effect.painWithoutHaptic);
  });
  var aggDiff = groupWith.length ? U.round(U.avg(groupWithout) - U.avg(groupWith), 2) : null;
  var favorCount = effects.filter(function (e) { return e.effect.favorsHaptic; }).length;

  /* ---------------- Efek terapi cermin ---------------- */
  var mirrorRows = [];
  overviews.forEach(function (o) {
    Store.list('sessions').forEach(function (s) {
      if (s.patientId !== o.user.id) return;
      (s.exercises || []).forEach(function (e) {
        if (e.exId === 'ex_mirror' && e.painBefore !== undefined && e.painBefore !== null) {
          mirrorRows.push({ patient: o.user, before: e.painBefore, after: e.painAfter, date: s.date });
        }
      });
    });
  });
  var mirrorDrop = mirrorRows.length
    ? U.round(U.avg(mirrorRows.map(function (r) { return r.before - r.after; })), 2) : null;

  /* ---------------- Agregat pemicu & zona ---------------- */
  var allLogs = [];
  overviews.forEach(function (o) {
    Analytics.painLogs(o.user.id, 90).forEach(function (l) { allLogs.push(l); });
  });
  var trigCount = {}, zoneCount = {}, typeCount = {};
  allLogs.forEach(function (l) {
    if (l.trigger) trigCount[l.trigger] = (trigCount[l.trigger] || 0) + 1;
    (l.zones || []).forEach(function (z) { zoneCount[z] = (zoneCount[z] || 0) + 1; });
    (l.types || []).forEach(function (t) { typeCount[t] = (typeCount[t] || 0) + 1; });
  });
  function topOf(obj, n) {
    return Object.keys(obj).map(function (k) { return { key: k, n: obj[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, n || 6);
  }

  var aeAll = Study.adverseEvents();
  var severeToday = allLogs.filter(function (l) {
    return l.date === U.today() && l.level >= 7;
  });

  c.innerHTML =
    '<section class="grid g4">' +
    UI.statCard({ label: 'Nyeri rata-rata', value: U.round(U.avg(allLogs.map(function (l) {
      return l.level;
    })), 1), unit: '/10', icon: 'brain', tone: 'violet', hint: 'semua pasien, 90 hari' }) +
    UI.statCard({ label: 'Efek haptik', value: aggDiff !== null ? (aggDiff > 0 ? '−' : '+') +
      Math.abs(aggDiff) : '–', unit: 'poin', icon: 'zap',
      tone: aggDiff > 0 ? 'success' : 'warning',
      hint: favorCount + '/' + effects.length + ' pasien mendukung' }) +
    UI.statCard({ label: 'Efek terapi cermin', value: mirrorDrop !== null
      ? (mirrorDrop > 0 ? '−' : '+') + Math.abs(mirrorDrop) : '–', unit: 'poin',
      icon: 'mirror', tone: mirrorDrop > 0 ? 'success' : 'warning',
      hint: mirrorRows.length + ' sesi terukur' }) +
    UI.statCard({ label: 'Nyeri berat hari ini', value: severeToday.length, unit: 'pasien',
      icon: 'alert', tone: severeToday.length ? 'danger' : 'success', hint: 'skor ≥ 7' }) +
    '</section>' +

    /* ===== Perbandingan fase lintas pasien ===== */
    (effects.length
      ? '<section class="card">' +
        '<div class="card-head"><div><div class="card-title">Efek umpan balik haptik per pasien</div>' +
        '<div class="card-sub">Perbandingan nyeri rata-rata pada fase dengan dan tanpa haptik. ' +
        'Cohen\u2019s d menunjukkan besar efek.</div></div></div>' +
        '<div class="table-wrap"><table class="table clickable"><thead><tr>' +
        '<th>Pasien</th><th>Fase haptik on</th><th>Fase haptik off</th>' +
        '<th>Nyeri dengan haptik</th><th>Tanpa haptik</th><th>Selisih</th>' +
        '<th>Cohen\u2019s d</th><th>Besar efek</th><th>Arah</th></tr></thead><tbody>' +
        effects.map(function (e) {
          var f = e.effect;
          return '<tr data-open="' + U.esc(e.user.id) + '">' +
            '<td class="semi">' + U.esc(e.user.name) + '</td>' +
            '<td class="t-xs">' + U.esc(f.phasesWith.join(', ')) + '</td>' +
            '<td class="t-xs">' + U.esc(f.phasesWithout.join(', ')) + '</td>' +
            '<td><span class="badge" style="background:' + Chart.alpha(U.painColor(f.painWithHaptic), 0.16) +
            ';color:' + U.painColor(f.painWithHaptic) + '">' + f.painWithHaptic + '</span></td>' +
            '<td><span class="badge" style="background:' + Chart.alpha(U.painColor(f.painWithoutHaptic), 0.16) +
            ';color:' + U.painColor(f.painWithoutHaptic) + '">' + f.painWithoutHaptic + '</span></td>' +
            '<td class="semi ' + (f.diff > 0 ? 'c-success' : 'c-danger') + '">' +
            (f.diff > 0 ? '−' : '+') + Math.abs(f.diff) + '</td>' +
            '<td class="mono">' + f.cohensD + '</td>' +
            '<td>' + U.esc(f.magnitude) + '</td>' +
            '<td>' + (f.favorsHaptic
              ? '<span class="badge badge-success">' + Icon('check', 11) + 'Mendukung</span>'
              : '<span class="badge badge-warning">Tidak mendukung</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="alert ' + (favorCount > effects.length / 2 ? 'success' : 'info') + ' mt-4">' +
        '<span class="a-ico">' + Icon('info', 18) + '</span>' +
        '<span class="t-sm">' + favorCount + ' dari ' + effects.length +
        ' pasien menunjukkan nyeri lebih rendah pada fase dengan umpan balik haptik. ' +
        'Selisih rata-rata ' + Math.abs(aggDiff) + ' poin. Ini analisis deskriptif; ' +
        'pengujian hipotesis formal memerlukan analisis statistik pada data yang diekspor.</span></div>' +
        '</section>'
      : '') +

    /* ===== Tren lintas pasien ===== */
    '<section class="grid g-2-1">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Tren nyeri semua pasien</div>' +
    '<div class="card-sub">Rata-rata bergerak 7 hari, 90 hari terakhir</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-multi" data-height="270"></canvas></div>' +
    '<div class="chart-legend mt-3" id="multi-legend"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div class="card-title">Peta nyeri agregat</div></div>' +
    '<div class="bodymap" id="heat-agg"></div>' +
    '<div class="mt-3">' + BodyMap.heatLegend() + '</div>' +
    '<div class="div-label">Lokasi tersering</div>' +
    '<div class="col gap-2" id="top-zones"></div>' +
    '</div></section>' +

    /* ===== Pemicu & jenis ===== */
    '<section class="grid g2">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Pemicu nyeri tersering</div>' +
    '<div class="card-sub">Agregat ' + allLogs.length + ' catatan nyeri</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-trig" data-height="250"></canvas></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div class="card-title">Jenis nyeri phantom</div></div>' +
    '<div class="col gap-3 mt-2" id="top-types"></div>' +
    '<div class="div-label">Dampak</div>' +
    '<div class="grid g2 gap-2">' +
    '<div class="mini-stat"><span class="ms-v">' +
    allLogs.filter(function (l) { return l.sleepDisturbed; }).length + '</span>' +
    '<span class="ms-l">Hari tidur terganggu</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' +
    allLogs.filter(function (l) { return l.medication; }).length + '</span>' +
    '<span class="ms-l">Hari pakai obat</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' +
    allLogs.filter(function (l) { return l.level >= 7; }).length + '</span>' +
    '<span class="ms-l">Hari nyeri berat</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' +
    U.dur(U.avg(allLogs.map(function (l) { return l.durationMin || 0; }))) + '</span>' +
    '<span class="ms-l">Durasi rata-rata</span></div>' +
    '</div></div></section>' +

    /* ===== Efek terapi cermin ===== */
    (mirrorRows.length
      ? '<section class="card">' +
        '<div class="card-head"><div><div class="card-title">Efek langsung terapi cermin</div>' +
        '<div class="card-sub">Nyeri sebelum dan sesudah sesi, semua pasien</div></div></div>' +
        '<div class="chart-box"><canvas id="ch-mirror" data-height="240"></canvas></div>' +
        '<div class="chart-legend mt-3">' +
        '<span><i style="background:#d64545"></i>Sebelum sesi</span>' +
        '<span><i style="background:#1c9e6b"></i>Sesudah sesi</span></div>' +
        '<p class="t-xs muted mt-3">Rata-rata penurunan ' + Math.abs(mirrorDrop) +
        ' poin per sesi berdasarkan ' + mirrorRows.length + ' pengukuran berpasangan.</p>' +
        '</section>'
      : '') +

    /* ===== Kejadian tidak diinginkan ===== */
    '<section class="card">' +
    '<div class="card-head"><div><div class="card-title">Kejadian tidak diinginkan</div>' +
    '<div class="card-sub">Seluruh pasien · ' +
    aeAll.filter(function (a) { return a.status !== 'selesai'; }).length + ' belum selesai</div></div>' +
    '<button class="btn btn-sm" id="btn-ae-export">' + Icon('download', 15) +
    '<span>Ekspor untuk etik</span></button></div>' +
    (aeAll.length
      ? '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Pasien</th><th>Jenis</th><th>Keparahan</th><th>Terkait</th>' +
        '<th>Fase</th><th>Hentikan terapi</th><th>Status</th><th>Deskripsi</th></tr></thead><tbody>' +
        aeAll.map(function (a) {
          var p = Store.find('users', a.patientId);
          var t = Study.aeType(a.type);
          var sev = Study.AE_SEVERITY[a.severity] || {};
          return '<tr>' +
            '<td class="nowrap t-xs">' + U.esc(U.fmtDate(a.date, 'short')) + '</td>' +
            '<td class="semi t-xs">' + U.esc(p ? p.name : '-') + '</td>' +
            '<td class="t-xs">' + U.esc(t ? t.label : a.type) + '</td>' +
            '<td><span class="badge badge-' + (sev.tone || 'primary') + '">' +
            U.esc(sev.label || a.severity) + '</span></td>' +
            '<td class="t-xs">' + U.esc(a.relatedTo) + '</td>' +
            '<td class="t-xs">' + U.esc(a.phase || '–') + '</td>' +
            '<td>' + (a.stoppedTherapy ? '<span class="c-danger bold">Ya</span>' : 'Tidak') + '</td>' +
            '<td><span class="badge badge-' + (a.status === 'selesai' ? 'success'
              : a.status === 'ditinjau' ? 'primary' : 'warning') + '">' + U.esc(a.status) + '</span></td>' +
            '<td class="t-xs muted">' + U.esc((a.body || '').slice(0, 60)) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : UI.empty({ icon: 'checkCircle', title: 'Tidak ada kejadian dilaporkan' })) +
    '</section>';

  U.on(c, 'click', '[data-open]', function (e, row) {
    location.href = 'terapis-pasien.html?id=' + encodeURIComponent(row.dataset.open);
  });

  /* ---------------- Grafik tren multi-pasien ---------------- */
  var COLORS = ['#2b6cde', '#10a5a5', '#7a5af8', '#d98b0b', '#1c9e6b', '#d64545'];

  function drawMulti() {
    var labels = [];
    for (var i = 89; i >= 0; i--) labels.push(U.fmtDate(U.addDays(new Date(), -i), 'short'));

    var series = overviews.slice(0, 6).map(function (o, idx) {
      var map = {};
      Analytics.painLogs(o.user.id, 90).forEach(function (l) { map[l.date] = l.level; });
      var raw = [];
      for (var j = 89; j >= 0; j--) {
        var k = U.dayKey(U.addDays(new Date(), -j));
        raw.push(map[k] !== undefined ? map[k] : null);
      }
      // Rata-rata bergerak 7 hari, mengabaikan nilai kosong
      var smooth = raw.map(function (_, i2) {
        var win = raw.slice(Math.max(0, i2 - 6), i2 + 1).filter(function (v) { return v !== null; });
        return win.length ? U.round(U.avg(win), 2) : null;
      });
      return { name: o.user.name, color: COLORS[idx % COLORS.length], data: smooth };
    });

    Chart.line(U.$('#ch-multi'), {
      labels: labels, height: 270, yMax: 10, ticks: 5, showDots: false, series: series
    });

    U.$('#multi-legend').innerHTML = series.map(function (s) {
      return '<span><i style="background:' + s.color + '"></i>' +
        U.esc(s.name.split(' ')[0]) + '</span>';
    }).join('');
  }

  /* ---------------- Pemicu ---------------- */
  function drawTrig() {
    var top = topOf(trigCount, 6);
    Chart.bar(U.$('#ch-trig'), {
      labels: top.map(function (t) { return t.key.split(' ')[0]; }),
      data: top.map(function (t) { return t.n; }),
      height: 250, showValues: true, color: '#d98b0b'
    });
  }

  /* ---------------- Terapi cermin ---------------- */
  function drawMirror() {
    var el = U.$('#ch-mirror');
    if (!el) return;
    var rows = mirrorRows.slice(-16);
    Chart.line(el, {
      labels: rows.map(function (r) { return U.fmtDate(r.date, 'short'); }),
      height: 240, yMax: 10, ticks: 5,
      series: [
        { name: 'Sebelum', data: rows.map(function (r) { return r.before; }), color: '#d64545' },
        { name: 'Sesudah', data: rows.map(function (r) { return r.after; }), color: '#1c9e6b' }
      ]
    });
  }

  drawMulti(); drawTrig(); drawMirror();
  Chart.responsive(function () { drawMulti(); drawTrig(); drawMirror(); });

  /* ---------------- Peta agregat ---------------- */
  BodyMap.create(U.$('#heat-agg'), {
    readonly: true, heat: BodyMap.heatFromLogs(allLogs)
  });

  var tz = topOf(zoneCount, 6);
  U.$('#top-zones').innerHTML = tz.length
    ? tz.map(function (z) {
      var ph = BodyMap.isPhantom(z.key);
      return '<div><div class="row between t-xs mb-1">' +
        '<span class="semi">' + Icon(ph ? 'brain' : 'target', 11) + ' ' +
        U.esc(BodyMap.zoneLabel(z.key)) + '</span>' +
        '<span class="muted">' + z.n + '</span></div>' +
        '<div class="prog sm ' + (ph ? 'violet' : '') + '">' +
        '<i style="width:' + U.pct(z.n, tz[0].n) + '%"></i></div></div>';
    }).join('')
    : '<span class="t-sm muted">Belum ada data</span>';

  var tt = topOf(typeCount, 6);
  U.$('#top-types').innerHTML = tt.length
    ? tt.map(function (t) {
      var d = Seed.painType(t.key);
      return '<div><div class="row between t-xs mb-1">' +
        '<span class="semi">' + Icon(d ? d.icon : 'zap', 11) + ' ' +
        U.esc(d ? d.label : t.key) + '</span>' +
        '<span class="muted">' + t.n + 'x</span></div>' +
        '<div class="prog sm violet"><i style="width:' + U.pct(t.n, tt[0].n) + '%"></i></div></div>';
    }).join('')
    : '<span class="t-sm muted">Belum ada data</span>';

  /* ---------------- Ekspor ---------------- */
  U.$('#btn-export').addEventListener('click', function () {
    var res = Study.exportStudyCSV(true);
    U.downloadText(res.name, res.csv, 'text/csv;charset=utf-8');
    UI.toast('Dataset penelitian diunduh: ' + U.nf(res.rows) + ' baris, ' +
      res.subjects + ' subjek.', 'success', { duration: 5000 });
  });

  U.$('#btn-ae-export').addEventListener('click', function () {
    var res = Study.exportAECSV(true);
    U.downloadText(res.name, res.csv, 'text/csv;charset=utf-8');
    UI.toast('Daftar kejadian diunduh (' + res.rows + ' baris).', 'success');
  });
})();
