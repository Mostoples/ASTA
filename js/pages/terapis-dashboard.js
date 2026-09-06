/* ============================================================
   ASTA — Dasbor Klinis (Terapis)
   Triase pasien menurut risiko putus terapi, nyeri berat,
   kejadian tidak diinginkan, dan skrining psikologis.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('terapis');
  if (!user) return;

  var shell = Shell.mount({
    title: 'Dasbor Klinis',
    desc: 'Ikhtisar pasien dan prioritas tindak lanjut hari ini'
  });
  if (!shell) return;
  var c = shell.content;

  var overviews = Analytics.allPatientsOverview(user.id);
  // Pasien tanpa terapis terdaftar tetap ditampilkan agar demo utuh
  if (!overviews.length) overviews = Analytics.allPatientsOverview(null);

  var openAE = Study.adverseEvents(null, { openOnly: true });
  var appts = Analytics.upcomingAppointments(user.id, 8);
  var psych = Study.psychVsAdherence(user.id);

  // Triase: urutkan menurut tingkat risiko
  var risk = { tinggi: 0, sedang: 1, rendah: 2 };
  var sorted = overviews.slice().sort(function (a, b) {
    var d = risk[a.riskLevel] - risk[b.riskLevel];
    if (d !== 0) return d;
    return a.adherence.score - b.adherence.score;
  });

  var needAttention = sorted.filter(function (o) { return o.riskLevel !== 'rendah'; });
  var avgAdh = Math.round(U.avg(overviews.map(function (o) { return o.adherence.score; })));
  var avgPain = U.round(U.avg(overviews.map(function (o) { return o.pain.avg; })), 1);
  var totalSessions7 = U.sum(overviews.map(function (o) {
    return Analytics.sessions(o.user.id, 7).length;
  }));

  c.innerHTML =
    /* ===== Statistik klinik ===== */
    '<section class="grid g4">' +
    UI.statCard({ label: 'Pasien aktif', value: overviews.length, icon: 'users',
      hint: needAttention.length + ' perlu perhatian' }) +
    UI.statCard({ label: 'Kepatuhan rata-rata', value: avgAdh, unit: '%', icon: 'target',
      tone: avgAdh >= 70 ? 'success' : avgAdh >= 50 ? 'warning' : 'danger', hint: '14 hari' }) +
    UI.statCard({ label: 'Nyeri rata-rata', value: avgPain, unit: '/10', icon: 'brain', tone: 'violet',
      hint: 'seluruh pasien' }) +
    UI.statCard({ label: 'Kejadian terbuka', value: openAE.length, icon: 'shield',
      tone: openAE.length ? 'warning' : 'success', hint: 'perlu ditinjau' }) +
    '</section>' +

    /* ===== Prioritas hari ini ===== */
    (needAttention.length
      ? '<section class="card">' +
        '<div class="card-head">' +
        '<div><div class="card-title">Prioritas tindak lanjut</div>' +
        '<div class="card-sub">Pasien dengan penanda risiko, diurutkan dari yang paling mendesak</div></div>' +
        '<span class="badge badge-warning">' + needAttention.length + ' pasien</span>' +
        '</div>' +
        '<div class="col gap-3">' +
        needAttention.map(function (o) {
          return '<div class="card flat" style="border-left:4px solid var(--' +
            (o.riskLevel === 'tinggi' ? 'danger' : 'warning') + ')">' +
            '<div class="row between wrap gap-3">' +
            '<div class="row gap-3">' +
            '<span class="avatar ' + U.esc(o.user.avatar || '') + '">' +
            U.esc(U.initials(o.user.name)) + '</span>' +
            '<div><span class="semi">' + U.esc(o.user.name) + '</span>' +
            '<div class="t-xs muted">' + U.esc(o.user.program || '') + '</div></div></div>' +
            '<div class="row gap-4 wrap">' +
            '<span class="mini-stat" style="min-width:78px"><span class="ms-v">' +
            o.adherence.score + '%</span><span class="ms-l">Kepatuhan</span></span>' +
            '<span class="mini-stat" style="min-width:78px"><span class="ms-v" style="color:' +
            U.painColor(o.pain.avg) + '">' + o.pain.avg + '</span><span class="ms-l">Nyeri</span></span>' +
            '<span class="mini-stat" style="min-width:78px"><span class="ms-v">' +
            o.daysSinceSession + 'h</span><span class="ms-l">Tanpa latihan</span></span>' +
            '<a class="btn btn-sm btn-primary" href="terapis-pasien.html?id=' + U.esc(o.user.id) + '">' +
            Icon('chevronRight', 15) + '<span>Buka</span></a>' +
            '</div></div>' +
            '<div class="row gap-2 mt-3 wrap">' +
            o.risks.map(function (r) {
              return '<span class="badge badge-' + (o.riskLevel === 'tinggi' ? 'danger' : 'warning') +
                '">' + Icon('alert', 11) + U.esc(r) + '</span>';
            }).join('') + '</div></div>';
        }).join('') + '</div></section>'
      : '<div class="alert success"><span class="a-ico">' + Icon('checkCircle', 18) + '</span>' +
        '<span class="t-sm">Tidak ada pasien dengan penanda risiko saat ini.</span></div>') +

    /* ===== Tabel semua pasien ===== */
    '<section class="card">' +
    '<div class="card-head">' +
    '<div><div class="card-title">Semua pasien</div>' +
    '<div class="card-sub">Skor kepatuhan komposit: frekuensi 50%, kelengkapan 30%, pemakaian alat 20%</div></div>' +
    '<a class="btn btn-sm" href="terapis-kepatuhan.html">' + Icon('chart', 15) +
    '<span>Analisis kepatuhan</span></a>' +
    '</div>' +
    '<div class="table-wrap"><table class="table clickable"><thead><tr>' +
    '<th>Pasien</th><th>Fase studi</th><th>Kepatuhan</th><th>Nyeri 14h</th><th>Tren</th>' +
    '<th>Pakai alat</th><th>Streak</th><th>Terakhir latihan</th><th>PHQ-9</th><th>Risiko</th>' +
    '</tr></thead><tbody id="pt-table"></tbody></table></div>' +
    '</section>' +

    /* ===== Kejadian & agenda ===== */
    '<section class="grid g-2-1">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Kejadian tidak diinginkan</div>' +
    '<div class="card-sub">Laporan yang belum selesai ditangani</div></div>' +
    '<a class="btn btn-sm btn-ghost" href="terapis-nyeri.html">Semua</a></div>' +
    '<div class="col gap-3" id="ae-list"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div class="card-title">Agenda</div>' +
    '<a class="btn btn-sm btn-ghost" href="jadwal.html">Kalender</a></div>' +
    '<div class="col gap-3" id="appt-list"></div>' +
    '</div></section>' +

    /* ===== Analisis lintas pasien ===== */
    '<section class="grid g2">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Kepatuhan vs nyeri</div>' +
    '<div class="card-sub">Setiap titik satu pasien. Pola menurun mendukung hipotesis bahwa ' +
    'kepatuhan berhubungan dengan nyeri lebih rendah.</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-adh-pain" data-height="240"></canvas></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Kesejahteraan vs kepatuhan</div>' +
    '<div class="card-sub">Skor PHQ-9 tinggi sering mendahului putus terapi</div></div></div>' +
    '<div class="chart-box"><canvas id="ch-psych" data-height="240"></canvas></div>' +
    (psych.rows.length
      ? '<div class="alert ' + (psych.r > 0.2 ? 'warning' : 'info') + ' mt-3">' +
        '<span class="a-ico">' + Icon('info', 17) + '</span>' +
        '<span class="t-xs">Korelasi r = ' + psych.r + ' (' + U.esc(psych.strength) + '). ' +
        (psych.r < -0.3
          ? 'Skor distres yang lebih tinggi berhubungan dengan kepatuhan yang lebih rendah.'
          : 'Belum terlihat hubungan yang jelas pada jumlah pasien saat ini.') +
        '</span></div>'
      : '') +
    '</div></section>' +

    /* ===== Penjelas alur pemantauan ===== */
    '<section class="explainer tone-teal">' +
      '<div class="art">' + Illus.telerehab({
        title: 'Alur telerehabilitasi: sesi latihan di rumah pasien terkirim ke ' +
               'basis data, lalu terbaca oleh tim klinis, dan penyesuaian program ' +
               'kembali ke pasien.'
      }) + '</div>' +
      '<div>' +
        '<h3>Angka di halaman ini datang dari rumah pasien</h3>' +
        '<p>Setiap sesi latihan, catatan nyeri, dan jam pakai lengan terkirim segera ' +
        'setelah selesai — bukan menunggu kunjungan berikutnya.</p>' +
        '<p>Karena itu penyesuaian program dapat dilakukan pada minggu yang sama, ' +
        'ketika polanya masih terbaca.</p>' +
      '</div>' +
    '</section>';

  /* ---------------- Tabel pasien ---------------- */
  U.$('#pt-table').innerHTML = sorted.map(function (o) {
    var ph = Study.currentPhase(o.user.id);
    var phDef = ph ? Study.phaseDef(ph.phase) : null;
    var scr = Study.latestScreening(o.user.id, 'PHQ-9');
    var scrI = scr ? Study.phq9Interpret(scr.score) : null;
    var tone = U.adherenceTone(o.adherence.score);

    return '<tr data-open="' + U.esc(o.user.id) + '">' +
      '<td><span class="row gap-2"><span class="avatar sm ' + U.esc(o.user.avatar || '') + '">' +
      U.esc(U.initials(o.user.name)) + '</span>' +
      '<span><span class="semi">' + U.esc(o.user.name) + '</span><br>' +
      '<span class="t-xs muted">' + U.esc((o.user.amputation || {}).level || '') + ' ' +
      U.esc((o.user.amputation || {}).side || '') + '</span></span></span></td>' +

      '<td>' + (phDef
        ? '<span class="badge" style="background:' + Chart.alpha(phDef.color, 0.14) + ';color:' +
          phDef.color + '">' + U.esc(phDef.short) + '</span>' +
          '<br><span class="t-xs muted">' + (phDef.haptic ? 'haptik on' : 'haptik off') + '</span>'
        : '<span class="muted">–</span>') + '</td>' +

      '<td><span class="semi">' + o.adherence.score + '%</span>' +
      '<div class="prog sm ' + (tone.tone === 'primary' ? '' : tone.tone) + '" style="width:60px;margin-top:4px">' +
      '<i style="width:' + o.adherence.score + '%"></i></div></td>' +

      '<td><span class="badge" style="background:' + Chart.alpha(U.painColor(o.pain.avg), 0.16) +
      ';color:' + U.painColor(o.pain.avg) + '">' + o.pain.avg + '/10</span></td>' +

      '<td><span class="stat-delta ' + (o.pain.trend === 'menurun' ? 'c-success'
        : o.pain.trend === 'meningkat' ? 'c-danger' : 'muted') + '">' +
      Icon(o.pain.trend === 'menurun' ? 'arrowDown' : o.pain.trend === 'meningkat' ? 'arrowUp' : 'minus', 12) +
      U.esc(o.pain.trend) + '</span></td>' +

      '<td>' + o.usage.wearAvg + 'j</td>' +
      '<td>' + (o.streak.current ? Icon('fire', 12) + ' ' + o.streak.current : '–') + '</td>' +
      '<td class="t-xs">' + (o.lastSession
        ? U.esc(U.fmtDate(o.lastSession.date, 'short')) +
          '<br><span class="muted">' + o.daysSinceSession + ' hari lalu</span>'
        : '<span class="muted">belum ada</span>') + '</td>' +

      '<td>' + (scrI
        ? '<span class="badge badge-' + scrI.tone + '">' + scr.score + '</span>' +
          (scr.flagSelfHarm ? '<br><span class="t-xs c-danger bold">flag</span>' : '')
        : '<span class="muted">–</span>') + '</td>' +

      '<td><span class="risk-flag ' + (o.riskLevel === 'tinggi' ? 'c-danger'
        : o.riskLevel === 'sedang' ? 'c-warning' : 'c-success') + '">' +
      '<span class="dot ' + (o.riskLevel === 'tinggi' ? 'dot-danger'
        : o.riskLevel === 'sedang' ? 'dot-warn' : 'dot-live') + '"></span>' +
      U.esc(U.titlecase(o.riskLevel)) + '</span></td></tr>';
  }).join('');

  U.on(U.$('#pt-table'), 'click', '[data-open]', function (e, row) {
    location.href = 'terapis-pasien.html?id=' + encodeURIComponent(row.dataset.open);
  });

  /* ---------------- Kejadian tidak diinginkan ---------------- */
  var aeHost = U.$('#ae-list');
  if (!openAE.length) {
    aeHost.innerHTML = UI.empty({ icon: 'checkCircle', title: 'Tidak ada kejadian terbuka',
      desc: 'Semua laporan sudah ditinjau atau ditangani.' });
  } else {
    aeHost.innerHTML = openAE.map(function (a) {
      var p = Store.find('users', a.patientId);
      var t = Study.aeType(a.type);
      var sev = Study.AE_SEVERITY[a.severity] || {};
      return '<div class="card flat" style="border-left:4px solid var(--' + (sev.tone || 'primary') + ')">' +
        '<div class="row-t between gap-3">' +
        '<div class="row-t gap-3">' +
        '<span class="stat-ico ' + (sev.tone === 'success' ? '' : sev.tone) + '" ' +
        'style="width:38px;height:38px">' + Icon(t ? t.icon : 'alert', 18) + '</span>' +
        '<div><span class="t-sm semi">' + U.esc(t ? t.label : a.type) + '</span>' +
        '<div class="t-xs muted">' + U.esc(p ? p.name : '-') + ' · ' +
        U.esc(U.fmtDate(a.date, 'short')) + ' · ' + U.esc(sev.label || '') +
        (a.stoppedTherapy ? ' · terapi dihentikan' : '') + '</div>' +
        (a.body ? '<div class="t-xs muted-2 mt-1">"' + U.esc(a.body) + '"</div>' : '') +
        '</div></div>' +
        '<button class="btn btn-sm btn-primary shrink-0" data-review="' + U.esc(a.id) + '">' +
        Icon('stethoscope', 15) + '<span>Tinjau</span></button>' +
        '</div></div>';
    }).join('');

    U.on(aeHost, 'click', '[data-review]', function (e, btn) {
      openReview(btn.dataset.review);
    });
  }

  function openReview(id) {
    var a = Store.find('adverseEvents', id);
    if (!a) return;
    var p = Store.find('users', a.patientId);
    var t = Study.aeType(a.type);
    var sev = Study.AE_SEVERITY[a.severity] || {};

    UI.modal({
      title: 'Tinjau kejadian tidak diinginkan',
      subtitle: (p ? p.name : '') + ' · ' + U.fmtDate(a.date, 'long'),
      content:
        '<dl class="kv mb-4">' +
        '<dt>Jenis</dt><dd>' + U.esc(t ? t.label : a.type) + '</dd>' +
        '<dt>Keparahan</dt><dd><span class="badge badge-' + (sev.tone || 'primary') + '">' +
        U.esc(sev.label || a.severity) + '</span></dd>' +
        '<dt>Berkaitan dengan</dt><dd>' + U.esc(a.relatedTo) + '</dd>' +
        '<dt>Fase studi</dt><dd>' + U.esc(a.phase || '–') + '</dd>' +
        '<dt>Terapi dihentikan</dt><dd>' + (a.stoppedTherapy ? 'Ya' : 'Tidak') + '</dd>' +
        '<dt>Cari bantuan medis</dt><dd>' + (a.soughtCare ? 'Ya' : 'Tidak') + '</dd>' +
        '</dl>' +
        '<div class="card sunken tight mb-4"><span class="t-xs upper">Laporan pasien</span>' +
        '<p class="t-sm mt-2 mb-0">' + U.esc(a.body || '-') + '</p></div>' +
        '<div class="field mb-4"><label class="label" for="rv-note">Catatan tinjauan klinis</label>' +
        '<textarea class="textarea" id="rv-note" maxlength="400">' +
        U.esc(a.reviewNote || '') + '</textarea></div>' +
        '<div class="field"><span class="label">Status</span>' +
        '<div class="row gap-2" id="rv-status">' +
        [['ditinjau', 'Ditinjau, dipantau'], ['selesai', 'Selesai ditangani']].map(function (s) {
          return '<button type="button" class="chip" data-s="' + s[0] + '" aria-pressed="' +
            (a.status === s[0]) + '">' + U.esc(s[1]) + '</button>';
        }).join('') + '</div></div>',
      actions: [
        { label: 'Batal' },
        {
          label: 'Simpan tinjauan', class: 'btn-primary', icon: 'check',
          onClick: function (m) {
            var status = m.root.querySelector('[data-s][aria-pressed="true"]');
            var note = U.$('#rv-note', m.root).value.trim();
            if (!note) { UI.toast('Catatan tinjauan wajib diisi.', 'warning'); return false; }
            Study.reviewAE(a.id, user.id, note, status ? status.dataset.s : 'ditinjau');
            if (p) {
              Notify.push(p.id, {
                type: 'adverse', tone: 'primary', icon: 'stethoscope',
                title: 'Laporan Anda sudah ditinjau',
                body: note.slice(0, 120),
                link: 'catatan-nyeri.html'
              });
            }
            UI.toast('Tinjauan tersimpan dan pasien diberi tahu.', 'success');
            setTimeout(function () { location.reload(); }, 900);
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

  /* ---------------- Agenda ---------------- */
  var apptHost = U.$('#appt-list');
  if (!appts.length) {
    apptHost.innerHTML = UI.empty({ icon: 'calendar', title: 'Tidak ada agenda' });
  } else {
    apptHost.innerHTML = appts.map(function (a) {
      var p = Store.find('users', a.patientId);
      var dt = new Date(a.at);
      var today = U.dayKey(dt) === U.today();
      return '<div class="sched-item">' +
        '<span class="sched-time"><span class="h">' + U.esc(U.fmtTime(dt).split(':')[0]) + '</span>' +
        '<span class="m">' + U.esc(U.fmtTime(dt).split(':')[1]) + '</span></span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi truncate" style="display:block">' + U.esc(a.title) + '</span>' +
        '<span class="t-xs muted">' + U.esc(p ? p.name : '-') + ' · ' +
        U.esc(U.fmtDate(dt, 'short')) + '</span></span>' +
        (today ? '<span class="badge badge-primary shrink-0">Hari ini</span>' : '') +
        '</div>';
    }).join('');
  }

  /* ---------------- Grafik lintas pasien ---------------- */
  function drawAdhPain() {
    Chart.scatter(U.$('#ch-adh-pain'), {
      height: 240, yMax: 10, xMax: 100,
      xTitle: 'Skor kepatuhan (%)', yTitle: 'Nyeri rata-rata (0–10)',
      points: overviews.map(function (o) {
        return { x: o.adherence.score, y: o.pain.avg, r: 7, color: U.painColor(o.pain.avg) };
      })
    });
  }

  function drawPsych() {
    if (!psych.rows.length) return;
    Chart.scatter(U.$('#ch-psych'), {
      height: 240, yMax: 100, xMax: 27,
      xTitle: 'Skor PHQ-9 (0–27)', yTitle: 'Kepatuhan (%)',
      points: psych.rows.map(function (r) {
        var i = Study.phq9Interpret(r.phq9);
        return {
          x: r.phq9, y: r.adherence, r: 7,
          color: i.tone === 'success' ? '#1c9e6b' : i.tone === 'warning' ? '#d98b0b'
            : i.tone === 'danger' ? '#d64545' : '#2b6cde'
        };
      })
    });
  }

  drawAdhPain();
  drawPsych();
  Chart.responsive(function () { drawAdhPain(); drawPsych(); });
})();
