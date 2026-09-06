/* ============================================================
   ASTA — Detail Pasien (Terapis / Admin)
   Rekam ringkas, riwayat sesi, analisis fase, catatan SOAP,
   asesmen, dan kejadian tidak diinginkan.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard(['terapis', 'admin']);
  if (!user) return;

  /* ---------------- Pilih pasien ---------------- */
  var qid = U.query('id');
  var patients = Store.list('users').filter(function (u) { return u.role === 'pasien'; });
  var pid = qid && Store.find('users', qid) ? qid : Auth.activePatientId();
  var patient = pid ? Store.find('users', pid) : patients[0];

  if (!patient) {
    document.body.innerHTML = '<p style="padding:40px">Tidak ada pasien terdaftar.</p>';
    return;
  }
  Auth.activePatientId(patient.id);
  Study.logAccess(user.id, patient.id, 'lihat-data');

  var shell = Shell.mount({
    title: patient.name,
    desc: (patient.amputation || {}).level + ' ' + (patient.amputation || {}).side +
      ' · ' + (patient.program || ''),
    actions: '<button class="btn" id="btn-msg">' + Icon('message', 18) + '<span>Kirim Pesan</span></button>' +
      '<a class="btn btn-primary" href="terapis-program.html?id=' + U.esc(patient.id) + '">' +
      Icon('clipboard', 18) + '<span>Atur Program</span></a>'
  });
  if (!shell) return;
  var c = shell.content;

  /* ---------------- Data ---------------- */
  var ov = Analytics.patientOverview(patient.id);
  var phaseSum = Study.phaseSummary(patient.id);
  var effect = Study.effect(patient.id);
  var corr = Analytics.painVsUsage(patient.id, 90);
  var pain30 = Analytics.painStats(patient.id, 30);
  var sessions = Analytics.sessions(patient.id, 90).slice().reverse();
  var aeList = Study.adverseEvents(patient.id);
  var assessments = Store.list('assessments').filter(function (a) { return a.patientId === patient.id; });
  var screenings = Study.screenings(patient.id, 'PHQ-9');
  var rx = Analytics.prescription(patient.id);
  var soap = Store.list('soapNotes').filter(function (n) { return n.patientId === patient.id; })
    .sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
  var consent = Study.consent(patient.id);

  c.innerHTML =
    /* ===== Pemilih pasien + identitas ===== */
    '<section class="card">' +
    '<div class="row between wrap gap-4">' +
    '<div class="row gap-4">' +
    '<span class="avatar lg ' + U.esc(patient.avatar || '') + '">' +
    U.esc(U.initials(patient.name)) + '</span>' +
    '<div>' +
    '<h2>' + U.esc(patient.name) + '</h2>' +
    '<div class="row gap-2 mt-2 wrap">' +
    '<span class="badge badge-primary">' + U.esc((patient.amputation || {}).level || '') + '</span>' +
    '<span class="badge">Sisi ' + U.esc((patient.amputation || {}).side || '') + '</span>' +
    '<span class="badge">' + U.esc(patient.city || '') + '</span>' +
    (consent
      ? '<span class="badge badge-' + (consent.withdrawn ? 'danger' : 'success') + '">' +
        Icon('shield', 11) + (consent.withdrawn ? 'Persetujuan ditarik' : 'Consent v' + consent.version) +
        '</span>'
      : '<span class="badge badge-warning">Belum ada consent</span>') +
    '</div>' +
    '<div class="t-sm muted mt-2">' + U.esc(patient.email) +
    (patient.phone ? ' · ' + U.esc(patient.phone) : '') + '</div>' +
    '</div></div>' +
    '<div id="picker-slot"></div>' +
    '</div>' +

    (ov.risks.length
      ? '<div class="row gap-2 mt-4 wrap">' +
        ov.risks.map(function (r) {
          return '<span class="badge badge-' + (ov.riskLevel === 'tinggi' ? 'danger' : 'warning') + '">' +
            Icon('alert', 11) + U.esc(r) + '</span>';
        }).join('') + '</div>'
      : '') +
    '</section>' +

    /* ===== Statistik ===== */
    '<section class="grid g4">' +
    UI.statCard({ label: 'Kepatuhan 14h', value: ov.adherence.score, unit: '%', icon: 'target',
      tone: ov.adherence.tone, hint: ov.adherence.sessionsDone + '/' + ov.adherence.sessionsTarget + ' sesi' }) +
    UI.statCard({ label: 'Nyeri 14h', value: ov.pain.avg, unit: '/10', icon: 'brain', tone: 'violet',
      hint: 'tren ' + ov.pain.trend }) +
    UI.statCard({ label: 'Pakai alat', value: ov.usage.wearAvg, unit: 'jam/hari', icon: 'clock',
      tone: 'teal', hint: ov.usage.emgQuality + '% mutu EMG' }) +
    UI.statCard({ label: 'Streak', value: ov.streak.current, unit: 'hari', icon: 'fire',
      hint: 'terbaik ' + ov.streak.best + ' hari' }) +
    '</section>' +

    '<div class="tabs" id="tabs" role="tablist">' +
    '<button class="tab" data-tab="ringkas" aria-selected="true" role="tab">' +
    Icon('chart', 16) + ' Ringkasan</button>' +
    '<button class="tab" data-tab="fase" aria-selected="false" role="tab">' +
    Icon('activity', 16) + ' Analisis Fase</button>' +
    '<button class="tab" data-tab="sesi" aria-selected="false" role="tab">' +
    Icon('clipboard', 16) + ' Riwayat Sesi</button>' +
    '<button class="tab" data-tab="nyeri" aria-selected="false" role="tab">' +
    Icon('brain', 16) + ' Nyeri</button>' +
    '<button class="tab" data-tab="kejadian" aria-selected="false" role="tab">' +
    Icon('shield', 16) + ' Kejadian' + (aeList.length ? ' (' + aeList.length + ')' : '') + '</button>' +
    '<button class="tab" data-tab="catatan" aria-selected="false" role="tab">' +
    Icon('edit', 16) + ' Catatan SOAP</button>' +
    '</div>' +

    '<div id="panels">' +
    '<section data-panel="ringkas" class="col gap-5"></section>' +
    '<section data-panel="fase" class="col gap-5 hidden"></section>' +
    '<section data-panel="sesi" class="col gap-5 hidden"></section>' +
    '<section data-panel="nyeri" class="col gap-5 hidden"></section>' +
    '<section data-panel="kejadian" class="col gap-5 hidden"></section>' +
    '<section data-panel="catatan" class="col gap-5 hidden"></section>' +
    '</div>';

  U.$('#picker-slot').appendChild(Shell.patientPicker(function (id) {
    location.href = 'terapis-pasien.html?id=' + encodeURIComponent(id);
  }));

  renderRingkas();
  renderFase();
  renderSesi();
  renderNyeri();
  renderKejadian();
  renderCatatan();
  UI.bindTabs(U.$('#tabs'), U.$('#panels'), function (name) {
    if (name === 'ringkas') drawDaily();
    if (name === 'fase') drawPhase();
    if (name === 'nyeri') { drawScatter(); }
  });

  /* ============================================================
     Ringkasan
     ============================================================ */
  function renderRingkas() {
    var host = U.$('[data-panel="ringkas"]');
    host.innerHTML =
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Nyeri, pemakaian alat, dan mutu gerak</div>' +
      '<div class="card-sub">60 hari terakhir</div></div></div>' +
      '<div class="chart-box"><canvas id="ch-daily" data-height="260"></canvas></div>' +
      '<div class="chart-legend mt-3">' +
      '<span><i style="background:#7a5af8"></i>Nyeri (0–10)</span>' +
      '<span><i class="sq" style="background:rgba(43,108,222,.22)"></i>Jam pakai</span>' +
      '<span><i style="background:#10a5a5"></i>Mutu gerak (0–100)</span></div>' +
      '</div>' +

      '<div class="grid g3">' +
      '<div class="card">' +
      '<div class="card-title mb-4">Rekam klinis</div>' +
      '<dl class="kv">' +
      '<dt>Usia</dt><dd>' + age(patient.birth) + ' tahun</dd>' +
      '<dt>Tingkat</dt><dd>' + U.esc((patient.amputation || {}).level || '-') + '</dd>' +
      '<dt>Penyebab</dt><dd>' + U.esc((patient.amputation || {}).cause || '-') + '</dd>' +
      '<dt>Tgl amputasi</dt><dd>' + U.esc(U.fmtDate((patient.amputation || {}).date, 'short')) + '</dd>' +
      '<dt>Socket</dt><dd class="t-xs">' + U.esc((patient.device || {}).socket || '-') + '</dd>' +
      '<dt>Alat dipasang</dt><dd>' + U.esc(U.fmtDate((patient.device || {}).fittedAt, 'short')) + '</dd>' +
      '<dt>Program</dt><dd>' + U.esc(patient.program || '-') + '</dd>' +
      '</dl></div>' +

      '<div class="card">' +
      '<div class="card-title mb-4">Program aktif</div>' +
      (rx
        ? '<div class="t-xs muted mb-3">Fase ' + rx.phase + ' · target ' + rx.weeklyTarget +
          ' sesi/minggu · mulai ' + U.esc(U.fmtDate(rx.startedAt, 'short')) + '</div>' +
          '<div class="col gap-2">' +
          rx.items.map(function (it) {
            var ex = Seed.exercise(it.exId);
            return '<div class="row between t-xs">' +
              '<span class="semi truncate">' + U.esc(ex ? ex.name : it.exId) + '</span>' +
              '<span class="muted nowrap">' + it.sets + '×' + it.reps + ' · ' + it.freq + '/mg</span></div>';
          }).join('') + '</div>' +
          (rx.note ? '<div class="alert info mt-3"><span class="a-ico">' + Icon('message', 15) + '</span>' +
            '<span class="t-xs">' + U.esc(rx.note) + '</span></div>' : '')
        : '<span class="t-sm muted">Belum ada resep</span>') +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-4">Asesmen & skrining</div>' +
      (assessments.length
        ? U.sortBy(assessments, 'date', true).slice(0, 4).map(function (a) {
          return '<div class="mb-3"><div class="row between t-xs mb-1">' +
            '<span class="semi">' + U.esc(a.instrument) + '</span>' +
            '<span class="muted">' + a.score + '/' + a.max + '</span></div>' +
            '<div class="prog sm"><i style="width:' + U.pct(a.score, a.max) + '%"></i></div>' +
            '<div class="t-xs muted mt-1">' + U.esc(U.fmtDate(a.date, 'short')) + '</div></div>';
        }).join('')
        : '<span class="t-sm muted">Belum ada asesmen</span>') +
      (screenings.length
        ? '<div class="div-label">PHQ-9</div>' +
          (function () {
            var last = screenings[screenings.length - 1];
            var i = Study.phq9Interpret(last.score);
            return '<div class="row between mb-2"><span class="t-lg bold">' + last.score +
              '<span class="muted t-xs">/27</span></span>' +
              '<span class="badge badge-' + i.tone + '">' + U.esc(i.label) + '</span></div>' +
              '<div class="t-xs muted">' + U.esc(i.advice) + '</div>' +
              (last.flagSelfHarm
                ? '<div class="alert danger mt-2"><span class="a-ico">' + Icon('alert', 15) + '</span>' +
                  '<span class="t-xs">Butir keselamatan positif. Perlu tindak lanjut.</span></div>'
                : '');
          })()
        : '') +
      '<button class="btn btn-sm btn-block mt-4" id="btn-assess">' + Icon('plus', 15) +
      '<span>Tambah asesmen</span></button>' +
      '</div></div>';

    drawDaily();
    U.$('#btn-assess').addEventListener('click', openAssessForm);
  }

  function drawDaily() {
    var el = U.$('#ch-daily');
    if (!el) return;
    var s = Analytics.dailySeries(patient.id, 60);
    Chart.line(el, {
      labels: s.labels, height: 260, yMax: 100, ticks: 4, yMaxRight: 12, showDots: false,
      series: [
        { name: 'Jam pakai', data: s.wear, color: 'rgba(43,108,222,.22)', type: 'bar', axis: 'right' },
        { name: 'Mutu', data: s.quality, color: '#10a5a5' },
        { name: 'Nyeri', data: s.pain.map(function (p) { return p === null ? null : p * 10; }),
          color: '#7a5af8', width: 2.6 }
      ]
    });
  }

  /* ============================================================
     Analisis fase
     ============================================================ */
  function renderFase() {
    var host = U.$('[data-panel="fase"]');
    if (!phaseSum.length) {
      host.innerHTML = '<div class="card">' + UI.empty({
        icon: 'activity', title: 'Belum ada fase penelitian',
        desc: 'Pasien ini belum masuk protokol A-B-A.'
      }) + '</div>';
      return;
    }

    host.innerHTML =
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Perbandingan fase A-B-A</div>' +
      '<div class="card-sub">Fase A tanpa umpan balik haptik, fase B dengan haptik</div></div></div>' +
      '<div class="chart-box"><canvas id="ch-phase" data-height="270"></canvas></div>' +
      '<div class="chart-legend mt-3" id="ph-legend"></div>' +
      (effect
        ? '<div class="alert ' + (effect.favorsHaptic ? 'success' : 'warning') + ' mt-4">' +
          '<span class="a-ico">' + Icon(effect.favorsHaptic ? 'checkCircle' : 'info', 18) + '</span>' +
          '<span class="t-sm">Nyeri saat haptik aktif <strong>' + effect.painWithHaptic +
          '</strong> vs nonaktif <strong>' + effect.painWithoutHaptic + '</strong>. ' +
          'Selisih ' + Math.abs(effect.diff) + ' poin, Cohen\u2019s d = ' + effect.cohensD +
          ' (' + effect.magnitude + '). ' +
          (effect.favorsHaptic
            ? 'Konsisten dengan hipotesis penelitian.'
            : 'Arah efek belum mendukung hipotesis.') + '</span></div>'
        : '') +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div class="card-title">Rincian statistik per fase</div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Fase</th><th>Haptik</th><th>Periode</th><th>Hari</th><th>n</th>' +
      '<th>Nyeri ± SD</th><th>Min–Maks</th><th>Berat</th><th>Tidur</th>' +
      '<th>Pakai alat</th><th>Grip sukses</th><th>Kepatuhan</th><th>Mutu</th>' +
      '</tr></thead><tbody>' +
      phaseSum.map(function (p) {
        return '<tr>' +
          '<td><span class="badge" style="background:' + Chart.alpha(p.color, 0.15) +
          ';color:' + p.color + '">' + U.esc(p.phase) + '</span></td>' +
          '<td>' + (p.haptic ? '<span class="c-success bold">on</span>'
            : '<span class="muted bold">off</span>') + '</td>' +
          '<td class="t-xs nowrap">' + U.esc(U.fmtDate(p.from, 'short')) + '–' +
          U.esc(p.to ? U.fmtDate(p.to, 'short') : 'kini') + '</td>' +
          '<td>' + p.days + '</td><td>' + p.painN + '</td>' +
          '<td class="semi">' + (p.painAvg !== null ? p.painAvg + ' ± ' + (p.painSd || 0) : '–') + '</td>' +
          '<td class="t-xs">' + (p.painMin !== null ? p.painMin + '–' + p.painMax : '–') + '</td>' +
          '<td>' + p.severeDays + '</td><td>' + p.sleepDays + '</td>' +
          '<td>' + (p.wearAvg !== null ? p.wearAvg + 'j' : '–') + '</td>' +
          '<td>' + (p.gripSuccess !== null ? p.gripSuccess + '%' : '–') + '</td>' +
          '<td>' + p.adherencePct + '%</td>' +
          '<td>' + (p.qualityAvg !== null ? p.qualityAvg : '–') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="t-xs muted mt-3">SD = simpangan baku. n = jumlah hari dengan catatan nyeri. ' +
      'Perbandingan ini deskriptif; uji hipotesis formal memerlukan perangkat statistik terpisah ' +
      'dengan data yang diekspor.</p>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-4">Catatan fase</div>' +
      '<div class="timeline">' +
      phaseSum.map(function (p) {
        return '<div class="tl-item ' + (p.haptic ? 'ok' : 'warn') + '">' +
          '<div class="t-sm semi">' + U.esc(p.label) + ' · ' +
          U.esc(U.fmtDate(p.from, 'short')) + '</div>' +
          '<div class="t-xs muted">' + U.esc(p.note || '-') + '</div></div>';
      }).join('') + '</div></div>';
  }

  function drawPhase() {
    var el = U.$('#ch-phase');
    if (!el) return;
    var keys = [], labels = [], pain = [], wear = [];
    var painMap = {}, telMap = {};
    Analytics.painLogs(patient.id, 90).forEach(function (p) { painMap[p.date] = p; });
    Analytics.telemetry(patient.id, 90).forEach(function (t) { telMap[t.date] = t; });
    for (var i = 89; i >= 0; i--) {
      var d = U.addDays(new Date(), -i), k = U.dayKey(d);
      keys.push(k); labels.push(U.fmtDate(d, 'short'));
      pain.push(painMap[k] ? painMap[k].level : null);
      wear.push(telMap[k] ? telMap[k].wearHours : 0);
    }
    var bands = Study.phaseBands(patient.id, keys);
    Chart.line(el, {
      labels: labels, height: 270, yMax: 10, ticks: 5, yMaxRight: 14,
      showDots: false, bands: bands,
      series: [
        { name: 'Jam pakai', data: wear, color: 'rgba(43,108,222,.2)', type: 'bar', axis: 'right' },
        { name: 'Nyeri', data: pain, color: '#7a5af8', fill: true, width: 2.8 }
      ]
    });
    var lg = U.$('#ph-legend');
    if (lg) {
      lg.innerHTML = '<span><i style="background:#7a5af8"></i>Nyeri</span>' +
        '<span><i class="sq" style="background:rgba(43,108,222,.2)"></i>Jam pakai</span>' +
        bands.map(function (b) {
          var def = Study.phaseDef(b.phase);
          return '<span><i class="sq" style="background:' + Chart.alpha(def.color, 0.28) +
            ';border:1.5px solid ' + def.color + '"></i>' + U.esc(def.short) + '</span>';
        }).join('');
    }
  }

  /* ============================================================
     Riwayat sesi
     ============================================================ */
  function renderSesi() {
    var host = U.$('[data-panel="sesi"]');
    host.innerHTML =
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Riwayat sesi latihan</div>' +
      '<div class="card-sub">' + sessions.length + ' sesi dalam 90 hari</div></div></div>' +
      (sessions.length
        ? '<div class="table-wrap"><table class="table clickable"><thead><tr>' +
          '<th>Tanggal</th><th>Waktu</th><th>Durasi</th><th>Latihan</th><th>Kelengkapan</th>' +
          '<th>Mutu</th><th>Mode</th><th>Fase</th><th>Status</th></tr></thead><tbody>' +
          sessions.slice(0, 40).map(function (s) {
            var ph = Study.phaseOn(patient.id, s.date);
            var phDef = ph ? Study.phaseDef(ph.phase) : null;
            return '<tr data-ses="' + U.esc(s.id) + '">' +
              '<td class="nowrap">' + U.esc(U.fmtDate(s.date, 'short')) + '</td>' +
              '<td>' + U.esc(U.fmtTime(s.startedAt)) + '</td>' +
              '<td>' + U.esc(U.dur(s.durationMin)) + '</td>' +
              '<td>' + (s.exercises || []).length + '</td>' +
              '<td>' + s.adherencePct + '%</td>' +
              '<td><span class="badge badge-' + (s.qualityScore >= 75 ? 'success'
                : s.qualityScore >= 50 ? 'warning' : 'danger') + '">' + s.qualityScore + '</span></td>' +
              '<td class="t-xs">' + (s.deviceMode === 'bionic'
                ? '<span class="c-primary">' + Icon('cpu', 12) + ' bionik</span>'
                : '<span class="muted">manual</span>') + '</td>' +
              '<td class="t-xs">' + (phDef ? U.esc(phDef.short) : '–') + '</td>' +
              '<td><span class="badge badge-' + (s.status === 'selesai' ? 'success' : 'warning') + '">' +
              U.esc(s.status) + '</span></td></tr>';
          }).join('') + '</tbody></table></div>'
        : UI.empty({ icon: 'activity', title: 'Belum ada sesi latihan' })) +
      '</div>';

    U.on(host, 'click', '[data-ses]', function (e, row) {
      showSession(row.dataset.ses);
    });
  }

  function showSession(id) {
    var s = Store.find('sessions', id);
    if (!s) return;
    UI.modal({
      title: 'Sesi ' + U.fmtDate(s.date, 'long'),
      subtitle: U.fmtTime(s.startedAt) + ' · ' + U.dur(s.durationMin) + ' · ' +
        (s.deviceMode === 'bionic' ? 'dengan lengan bionik' : 'tanpa alat'),
      size: 'lg',
      content:
        '<div class="grid g4 gap-3 mb-4">' +
        '<div class="mini-stat"><span class="ms-v">' + s.adherencePct + '%</span>' +
        '<span class="ms-l">Kelengkapan</span></div>' +
        '<div class="mini-stat"><span class="ms-v">' + s.qualityScore + '</span>' +
        '<span class="ms-l">Mutu gerak</span></div>' +
        '<div class="mini-stat"><span class="ms-v">' + (s.exercises || []).length + '</span>' +
        '<span class="ms-l">Latihan</span></div>' +
        '<div class="mini-stat"><span class="ms-v">' + U.esc(s.studyPhase || '–') + '</span>' +
        '<span class="ms-l">Fase</span></div></div>' +

        '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Latihan</th><th>Capaian</th><th>Mutu</th><th>Kehalusan</th><th>EMG puncak</th><th>Durasi</th>' +
        '</tr></thead><tbody>' +
        (s.exercises || []).map(function (e) {
          var ex = Seed.exercise(e.exId);
          return '<tr><td class="semi">' + U.esc(ex ? ex.name : e.exId) + '</td>' +
            '<td>' + e.done + '/' + e.target + ' ' + U.esc(e.unit) + '</td>' +
            '<td>' + (e.quality !== null && e.quality !== undefined ? e.quality : '–') + '</td>' +
            '<td>' + (e.smoothness !== null && e.smoothness !== undefined ? e.smoothness + '%' : '–') + '</td>' +
            '<td>' + (e.avgEmg ? Math.round(e.avgEmg * 100) + '%' : '–') + '</td>' +
            '<td>' + U.esc(U.dur(e.minutes || 0)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +

        (s.note
          ? '<div class="card sunken tight mt-4"><span class="t-xs upper">Catatan pasien</span>' +
            '<p class="t-sm mt-2 mb-0">' + U.esc(s.note) + '</p></div>'
          : '') +
        ((s.exercises || []).some(function (e) { return e.painBefore !== undefined; })
          ? '<div class="div-label">Nyeri sebelum & sesudah</div>' +
            (s.exercises || []).filter(function (e) { return e.painBefore !== undefined; })
              .map(function (e) {
                return '<div class="row gap-3 t-sm"><span class="semi">' +
                  U.esc((Seed.exercise(e.exId) || {}).name || '') + '</span>' +
                  '<span class="badge">' + e.painBefore + ' → ' + e.painAfter + '</span></div>';
              }).join('')
          : ''),
      actions: [{ label: 'Tutup', class: 'btn-primary' }]
    });
  }

  /* ============================================================
     Nyeri
     ============================================================ */
  function renderNyeri() {
    var host = U.$('[data-panel="nyeri"]');
    var logs = Analytics.painLogs(patient.id, 90).slice().reverse();

    host.innerHTML =
      '<div class="grid g-2-1">' +
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Nyeri vs pemakaian alat</div>' +
      '<div class="card-sub">Korelasi r = ' + corr.r + ' (' + U.esc(corr.strength) + ')</div></div></div>' +
      '<div class="chart-box"><canvas id="ch-scatter" data-height="270"></canvas></div>' +
      '</div>' +

      '<div class="col gap-4">' +
      '<div class="card">' +
      '<div class="card-title mb-3">Peta nyeri 90 hari</div>' +
      '<div class="bodymap" id="heat"></div>' +
      '<div class="mt-3">' + BodyMap.heatLegend() + '</div></div>' +
      '<div class="card">' +
      '<div class="card-title mb-3">Pola tersering</div>' +
      '<div class="col gap-2" id="top-types"></div>' +
      '<div class="div-label">Pemicu</div>' +
      '<div class="col gap-2" id="top-trig"></div>' +
      '</div></div></div>' +

      '<div class="card">' +
      '<div class="card-head"><div class="card-title">Catatan nyeri</div>' +
      '<span class="badge">' + logs.length + ' catatan</span></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Tanggal</th><th>Skor</th><th>Fase</th><th>Jenis</th><th>Area</th>' +
      '<th>Pemicu</th><th>Durasi</th><th>Tidur</th><th>Obat</th><th>Catatan</th>' +
      '</tr></thead><tbody>' +
      logs.slice(0, 40).map(function (l) {
        var ph = Study.phaseOn(patient.id, l.date);
        return '<tr>' +
          '<td class="nowrap">' + U.esc(U.fmtDate(l.date, 'short')) + '</td>' +
          '<td><span class="badge" style="background:' + Chart.alpha(U.painColor(l.level), 0.16) +
          ';color:' + U.painColor(l.level) + '">' + l.level + '</span></td>' +
          '<td class="t-xs">' + U.esc(ph ? ph.phase : '–') + '</td>' +
          '<td class="t-xs">' + U.esc((l.types || []).map(function (t) {
            return (Seed.painType(t) || {}).label || t;
          }).join(', ') || '-') + '</td>' +
          '<td class="t-xs">' + U.esc((l.zones || []).map(BodyMap.zoneLabel).join(', ') || '-') + '</td>' +
          '<td class="t-xs">' + U.esc(l.trigger || '-') + '</td>' +
          '<td class="t-xs">' + U.esc(U.dur(l.durationMin || 0)) + '</td>' +
          '<td>' + (l.sleepDisturbed ? Icon('alert', 13) : '') + '</td>' +
          '<td>' + (l.medication ? Icon('droplet', 13) : '') + '</td>' +
          '<td class="t-xs muted">' + U.esc((l.note || '').slice(0, 40)) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    BodyMap.create(U.$('#heat'), {
      readonly: true, side: (patient.amputation || {}).side,
      heat: BodyMap.heatFromLogs(Analytics.painLogs(patient.id, 90))
    });

    renderTop('#top-types', pain30.topTypes, function (k) {
      return (Seed.painType(k) || {}).label || k;
    }, 'violet');
    renderTop('#top-trig', pain30.topTriggers, function (k) { return k; }, 'warning');
    drawScatter();
  }

  function renderTop(sel, items, labelFn, tone) {
    var host = U.$(sel);
    if (!host) return;
    if (!items.length) { host.innerHTML = '<span class="t-sm muted">Belum ada data</span>'; return; }
    var max = items[0].n;
    host.innerHTML = items.map(function (it) {
      return '<div><div class="row between t-xs mb-1">' +
        '<span class="semi">' + U.esc(labelFn(it.key)) + '</span>' +
        '<span class="muted">' + it.n + 'x</span></div>' +
        '<div class="prog sm ' + tone + '"><i style="width:' + U.pct(it.n, max) + '%"></i></div></div>';
    }).join('');
  }

  function drawScatter() {
    var el = U.$('#ch-scatter');
    if (!el) return;
    Chart.scatter(el, {
      points: corr.points, height: 270, yMax: 10,
      xTitle: 'Jam pakai per hari', yTitle: 'Nyeri (0–10)'
    });
  }

  /* ============================================================
     Kejadian tidak diinginkan
     ============================================================ */
  function renderKejadian() {
    var host = U.$('[data-panel="kejadian"]');
    var stats = Study.aeStats(patient.id);

    host.innerHTML =
      '<div class="grid g4">' +
      UI.statCard({ label: 'Total', value: stats.total, icon: 'shield' }) +
      UI.statCard({ label: 'Ringan', value: stats.ringan, icon: 'info', tone: 'success' }) +
      UI.statCard({ label: 'Sedang', value: stats.sedang, icon: 'alert', tone: 'warning' }) +
      UI.statCard({ label: 'Berat', value: stats.berat, icon: 'alert', tone: 'danger' }) +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Daftar kejadian</div>' +
      '<div class="card-sub">' + stats.open + ' belum selesai ditangani</div></div></div>' +
      (aeList.length
        ? '<div class="col gap-3">' + aeList.map(function (a) {
          var t = Study.aeType(a.type);
          var sev = Study.AE_SEVERITY[a.severity] || {};
          var rev = a.reviewedBy ? Store.find('users', a.reviewedBy) : null;
          return '<div class="card flat" style="border-left:4px solid var(--' + (sev.tone || 'primary') + ')">' +
            '<div class="row-t between gap-3">' +
            '<div class="row-t gap-3">' +
            '<span class="stat-ico ' + (sev.tone === 'success' ? '' : sev.tone) +
            '" style="width:38px;height:38px">' + Icon(t ? t.icon : 'alert', 18) + '</span>' +
            '<div><span class="t-sm semi">' + U.esc(t ? t.label : a.type) + '</span>' +
            '<div class="t-xs muted">' + U.esc(U.fmtDate(a.date, 'long')) + ' · ' +
            U.esc(sev.label || '') + ' · ' + U.esc(a.relatedTo) +
            (a.phase ? ' · fase ' + U.esc(a.phase) : '') + '</div>' +
            '<p class="t-sm mt-2 mb-0">' + U.esc(a.body) + '</p>' +
            '<div class="row gap-2 mt-2 wrap">' +
            (a.stoppedTherapy ? '<span class="badge badge-danger">Terapi dihentikan</span>' : '') +
            (a.soughtCare ? '<span class="badge badge-warning">Cari bantuan medis</span>' : '') +
            '<span class="badge badge-' + (a.status === 'selesai' ? 'success'
              : a.status === 'ditinjau' ? 'primary' : 'warning') + '">' + U.esc(a.status) + '</span>' +
            '</div>' +
            (a.reviewNote
              ? '<div class="alert info mt-3"><span class="a-ico">' + Icon('stethoscope', 15) + '</span>' +
                '<span class="t-xs"><strong>' + U.esc(rev ? rev.name : 'Tinjauan') + ':</strong> ' +
                U.esc(a.reviewNote) + '</span></div>'
              : '') +
            '</div></div>' +
            (a.status !== 'selesai'
              ? '<button class="btn btn-sm btn-primary shrink-0" data-rv="' + U.esc(a.id) + '">' +
                Icon('stethoscope', 15) + '<span>Tinjau</span></button>'
              : '') +
            '</div></div>';
        }).join('') + '</div>'
        : UI.empty({ icon: 'checkCircle', title: 'Tidak ada kejadian dilaporkan',
          desc: 'Pasien belum melaporkan iritasi, luka, atau masalah alat.' })) +
      '</div>';

    U.on(host, 'click', '[data-rv]', function (e, btn) {
      openReview(btn.dataset.rv);
    });
  }

  function openReview(id) {
    var a = Store.find('adverseEvents', id);
    if (!a) return;
    var t = Study.aeType(a.type);
    UI.modal({
      title: 'Tinjau: ' + (t ? t.label : a.type),
      content:
        '<div class="card sunken tight mb-4"><span class="t-xs upper">Laporan pasien</span>' +
        '<p class="t-sm mt-2 mb-0">' + U.esc(a.body) + '</p></div>' +
        '<div class="field mb-4"><label class="label" for="rv-note">Catatan tinjauan</label>' +
        '<textarea class="textarea" id="rv-note" maxlength="400">' +
        U.esc(a.reviewNote || '') + '</textarea></div>' +
        '<div class="field"><span class="label">Status</span>' +
        '<div class="row gap-2" id="rv-st">' +
        [['ditinjau', 'Ditinjau, dipantau'], ['selesai', 'Selesai']].map(function (s) {
          return '<button type="button" class="chip" data-s="' + s[0] + '" aria-pressed="' +
            (a.status === s[0]) + '">' + U.esc(s[1]) + '</button>';
        }).join('') + '</div></div>',
      actions: [
        { label: 'Batal' },
        {
          label: 'Simpan', class: 'btn-primary',
          onClick: function (m) {
            var note = U.$('#rv-note', m.root).value.trim();
            if (!note) { UI.toast('Catatan tinjauan wajib diisi.', 'warning'); return false; }
            var sel = m.root.querySelector('[data-s][aria-pressed="true"]');
            Study.reviewAE(a.id, user.id, note, sel ? sel.dataset.s : 'ditinjau');
            Notify.push(patient.id, {
              type: 'adverse', tone: 'primary', icon: 'stethoscope',
              title: 'Laporan Anda sudah ditinjau', body: note.slice(0, 120),
              link: 'catatan-nyeri.html'
            });
            UI.toast('Tinjauan tersimpan.', 'success');
            setTimeout(function () { location.reload(); }, 800);
          }
        }
      ],
      onOpen: function (m) {
        U.on(m.root, 'click', '[data-s]', function (e, b) {
          U.$$('[data-s]', m.root).forEach(function (x) {
            x.setAttribute('aria-pressed', String(x === b));
          });
        });
      }
    });
  }

  /* ============================================================
     Catatan SOAP
     ============================================================ */
  function renderCatatan() {
    var host = U.$('[data-panel="catatan"]');
    host.innerHTML =
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Catatan klinis SOAP</div>' +
      '<div class="card-sub">Subjective, Objective, Assessment, Plan</div></div>' +
      '<button class="btn btn-primary btn-sm" id="btn-soap">' + Icon('plus', 15) +
      '<span>Catatan baru</span></button></div>' +
      (soap.length
        ? '<div class="col gap-4">' + soap.map(function (n) {
          var by = Store.find('users', n.byId);
          return '<div class="card flat">' +
            '<div class="row between mb-3 wrap gap-2">' +
            '<span class="semi t-sm">' + U.esc(U.fmtDate(n.at, 'dow')) + '</span>' +
            '<span class="t-xs muted">' + U.esc(by ? by.name : '') + '</span></div>' +
            ['S', 'O', 'A', 'P'].map(function (k) {
              var map = { S: 'subjective', O: 'objective', A: 'assessment', P: 'plan' };
              var full = { S: 'Subjektif', O: 'Objektif', A: 'Asesmen', P: 'Rencana' };
              if (!n[map[k]]) return '';
              return '<div class="mb-3"><span class="badge badge-primary">' + k + '</span> ' +
                '<span class="t-xs upper" style="margin-left:4px">' + full[k] + '</span>' +
                '<p class="t-sm mt-2 mb-0">' + U.esc(n[map[k]]) + '</p></div>';
            }).join('') + '</div>';
        }).join('') + '</div>'
        : UI.empty({ icon: 'edit', title: 'Belum ada catatan klinis',
          desc: 'Tambahkan catatan SOAP setelah evaluasi.' })) +
      '</div>';

    U.$('#btn-soap').addEventListener('click', openSoapForm);
  }

  function openSoapForm() {
    UI.modal({
      title: 'Catatan SOAP baru',
      subtitle: patient.name + ' · ' + U.fmtDate(new Date(), 'long'),
      size: 'lg',
      content:
        [['subjective', 'S — Subjektif', 'Keluhan dan laporan pasien, termasuk nyeri phantom'],
        ['objective', 'O — Objektif', 'Temuan pemeriksaan dan data alat: kepatuhan, mutu gerak, telemetri'],
        ['assessment', 'A — Asesmen', 'Interpretasi klinis dan kemajuan terhadap target'],
        ['plan', 'P — Rencana', 'Penyesuaian program, rujukan, atau tindak lanjut']
        ].map(function (f) {
          return '<div class="field mb-4"><label class="label" for="sp-' + f[0] + '">' +
            U.esc(f[1]) + '</label>' +
            '<textarea class="textarea" id="sp-' + f[0] + '" maxlength="600" ' +
            'placeholder="' + U.esc(f[2]) + '"></textarea></div>';
        }).join('') +
        '<div class="alert info"><span class="a-ico">' + Icon('info', 17) + '</span>' +
        '<span class="t-xs">Data pendukung otomatis: kepatuhan ' + ov.adherence.score +
        '%, nyeri ' + ov.pain.avg + '/10, pakai alat ' + ov.usage.wearAvg + ' jam/hari, ' +
        'mutu EMG ' + ov.usage.emgQuality + '%.</span></div>',
      actions: [
        { label: 'Batal' },
        {
          label: 'Simpan catatan', class: 'btn-primary', icon: 'check',
          onClick: function (m) {
            var vals = {};
            ['subjective', 'objective', 'assessment', 'plan'].forEach(function (k) {
              vals[k] = U.$('#sp-' + k, m.root).value.trim();
            });
            if (!vals.assessment && !vals.plan) {
              UI.toast('Bagian Asesmen atau Rencana perlu diisi.', 'warning');
              return false;
            }
            Store.insert('soapNotes', Object.assign({
              patientId: patient.id, byId: user.id, at: new Date().toISOString(),
              snapshot: {
                adherence: ov.adherence.score, pain: ov.pain.avg,
                wear: ov.usage.wearAvg, emg: ov.usage.emgQuality
              }
            }, vals));
            UI.toast('Catatan SOAP tersimpan.', 'success');
            soap = Store.list('soapNotes').filter(function (n) { return n.patientId === patient.id; })
              .sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
            renderCatatan();
          }
        }
      ]
    });
  }

  /* ============================================================
     Asesmen & pesan
     ============================================================ */
  function openAssessForm() {
    var INSTR = ['QuickDASH', 'Box & Block Test', 'TAPES (Penyesuaian)', 'PEQ', 'DASH'];
    UI.modal({
      title: 'Tambah asesmen',
      size: 'sm',
      content:
        '<div class="field mb-4"><label class="label" for="as-i">Instrumen</label>' +
        '<select class="select" id="as-i">' +
        INSTR.map(function (i) { return '<option>' + U.esc(i) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="grid g2 gap-3 mb-4">' +
        '<div class="field"><label class="label" for="as-s">Skor</label>' +
        '<input class="input" type="number" id="as-s" min="0" max="200" value="0"></div>' +
        '<div class="field"><label class="label" for="as-m">Skor maksimum</label>' +
        '<input class="input" type="number" id="as-m" min="1" max="200" value="100"></div></div>' +
        '<label class="check"><input type="checkbox" id="as-lb" checked>' +
        '<span class="box" aria-hidden="true"></span>' +
        '<span class="t-sm">Skor lebih rendah berarti lebih baik</span></label>',
      actions: [
        { label: 'Batal' },
        {
          label: 'Simpan', class: 'btn-primary',
          onClick: function (m) {
            var score = UI.numVal(U.$('#as-s', m.root), 0, 200, 0);
            var max = UI.numVal(U.$('#as-m', m.root), 1, 200, 100);
            if (score > max) { UI.toast('Skor tidak boleh melebihi maksimum.', 'warning'); return false; }
            Store.insert('assessments', {
              patientId: patient.id, instrument: U.$('#as-i', m.root).value,
              score: score, max: max,
              lowerBetter: U.$('#as-lb', m.root).checked,
              date: U.today(), by: user.id
            });
            UI.toast('Asesmen tersimpan.', 'success');
            setTimeout(function () { location.reload(); }, 800);
          }
        }
      ]
    });
  }

  U.$('#btn-msg').addEventListener('click', function () {
    UI.modal({
      title: 'Kirim pesan ke ' + patient.name,
      size: 'sm',
      content: '<div class="field"><label class="label" for="msg-body">Pesan</label>' +
        '<textarea class="textarea" id="msg-body" maxlength="500" ' +
        'placeholder="Tulis pesan untuk pasien…"></textarea></div>',
      actions: [
        { label: 'Batal' },
        {
          label: 'Kirim', class: 'btn-primary', icon: 'message',
          onClick: function (m) {
            var body = U.$('#msg-body', m.root).value.trim();
            if (body.length < 3) { UI.toast('Pesan terlalu singkat.', 'warning'); return false; }
            Store.insert('messages', {
              threadId: patient.id + '|' + user.id,
              fromId: user.id, toId: patient.id, body: body,
              at: new Date().toISOString(), read: false
            });
            Notify.push(patient.id, {
              type: 'pesan', tone: 'primary', icon: 'message',
              title: 'Pesan dari ' + user.name, body: body.slice(0, 120),
              link: 'pasien-dashboard.html'
            });
            UI.toast('Pesan terkirim.', 'success');
          }
        }
      ]
    });
  });

  function age(birth) {
    if (!birth) return '-';
    var d = U.d(birth), n = new Date();
    var a = n.getFullYear() - d.getFullYear();
    if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
    return a;
  }

  Chart.responsive(function () { drawDaily(); drawPhase(); drawScatter(); });
})();
