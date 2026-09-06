/* ============================================================
   ASTA — Catatan Nyeri Phantom
   Skala NRS, peta tubuh, tipe & pemicu nyeri, dampak tidur,
   pelaporan kejadian tidak diinginkan, dan riwayat.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('pasien');
  if (!user) return;

  var pid = user.id;
  var shell = Shell.mount({
    title: 'Catatan Nyeri Phantom',
    desc: 'Data harian ini yang dipakai terapis melihat pola nyeri Anda',
    actions: '<button class="btn btn-danger" id="btn-ae">' + Icon('alert', 18) +
      '<span>Lapor Kejadian</span></button>'
  });
  if (!shell) return;
  var c = shell.content;

  /* ---------------- State form ---------------- */
  var todayKey = U.today();
  var existing = Store.list('painLogs').find(function (p) {
    return p.patientId === pid && p.date === todayKey;
  });

  var form = {
    level: existing ? existing.level : null,
    types: existing ? (existing.types || []).slice() : [],
    zones: existing ? (existing.zones || []).slice() : [],
    trigger: existing ? existing.trigger : '',
    durationMin: existing ? existing.durationMin : 30,
    sleepDisturbed: existing ? !!existing.sleepDisturbed : false,
    medication: existing ? !!existing.medication : false,
    note: existing ? (existing.note || '') : ''
  };

  var phase = Study.currentPhase(pid);
  var phaseDef = phase ? Study.phaseDef(phase.phase) : null;
  var stats = Analytics.painStats(pid, 30);
  var logs90 = Analytics.painLogs(pid, 90);

  /* ---------------- Render ---------------- */
  c.innerHTML =
    (phaseDef
      ? '<div class="alert info">' +
        '<span class="a-ico">' + Icon('info', 18) + '</span>' +
        '<span class="t-sm"><strong>Fase penelitian: ' + U.esc(phaseDef.label) + '</strong> — ' +
        U.esc(phaseDef.desc) + ' Umpan balik haptik saat ini <strong>' +
        (phaseDef.haptic ? 'aktif' : 'nonaktif') + '</strong>.</span></div>'
      : '') +

    '<section class="grid g-2-1">' +
    /* ===== Kolom kiri: form ===== */
    '<div class="col gap-5">' +

    '<div class="card">' +
    '<div class="card-head">' +
    '<div><div class="card-title">Seberapa nyeri hari ini?</div>' +
    '<div class="card-sub">Skala NRS 0–10 · ' + U.esc(U.fmtDate(new Date(), 'dow')) + '</div></div>' +
    (existing ? '<span class="badge badge-success">' + Icon('check', 13) + 'Sudah dicatat</span>' : '') +
    '</div>' +
    '<div class="pain-scale" id="pain-scale" role="group" aria-label="Pilih tingkat nyeri 0 sampai 10"></div>' +
    '<div class="row between mt-3 t-xs muted"><span>0 — tidak nyeri</span><span>10 — nyeri terberat</span></div>' +
    '<div class="cue-box mt-4" id="pain-readout"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Di mana nyeri terasa?</div>' +
    '<div class="card-sub">Ketuk area pada gambar. Area bergaris putus adalah bagian phantom.</div></div></div>' +
    '<div class="bodymap-wrap">' +
    '<div><div class="bodymap" id="bodymap"></div>' +
    '<div class="mt-3">' + BodyMap.legend() + '</div></div>' +
    '<div>' +
    '<div class="upper mb-3">Area terpilih</div>' +
    '<div id="zone-list" class="col gap-2"></div>' +
    '<div class="div-label">Jenis nyeri</div>' +
    '<div class="pain-type-grid" id="type-grid"></div>' +
    '</div>' +
    '</div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div class="card-title">Rincian</div></div>' +
    '<div class="grid g2 gap-4">' +
    '<div class="field"><label class="label" for="trigger">Pemicu utama</label>' +
    '<select class="select" id="trigger"><option value="">Pilih pemicu…</option>' +
    Seed.PAIN_TRIGGERS.map(function (t) {
      return '<option value="' + U.esc(t) + '"' + (form.trigger === t ? ' selected' : '') + '>' +
        U.esc(t) + '</option>';
    }).join('') + '</select></div>' +

    '<div class="field"><label class="label" for="duration">Lama nyeri berlangsung</label>' +
    '<div class="row gap-3"><input class="range grow" type="range" id="duration" min="5" max="360" step="5" ' +
    'value="' + form.durationMin + '" aria-describedby="dur-val">' +
    '<span class="bold nowrap" id="dur-val" style="min-width:64px;text-align:right">' +
    U.esc(U.dur(form.durationMin)) + '</span></div></div>' +
    '</div>' +

    '<div class="grid g2 gap-3 mt-4">' +
    '<label class="check"><input type="checkbox" id="sleep"' + (form.sleepDisturbed ? ' checked' : '') + '>' +
    '<span class="box" aria-hidden="true"></span>' +
    '<span class="t-sm">Nyeri mengganggu tidur saya</span></label>' +
    '<label class="check"><input type="checkbox" id="med"' + (form.medication ? ' checked' : '') + '>' +
    '<span class="box" aria-hidden="true"></span>' +
    '<span class="t-sm">Saya memakai obat pereda nyeri</span></label>' +
    '</div>' +

    '<div class="field mt-4"><label class="label" for="note">Catatan (opsional)</label>' +
    '<textarea class="textarea" id="note" maxlength="500" ' +
    'placeholder="Misalnya: muncul saat cuaca dingin, berkurang setelah terapi cermin…">' +
    U.esc(form.note) + '</textarea>' +
    '<span class="hint" id="note-count">0/500</span></div>' +

    '<div class="row between mt-5 wrap gap-3">' +
    '<span class="t-xs muted" id="save-hint">Data tersimpan di perangkat ini</span>' +
    '<div class="row gap-2">' +
    (existing ? '<button class="btn" id="btn-delete">' + Icon('trash', 17) + '<span>Hapus</span></button>' : '') +
    '<button class="btn btn-primary btn-lg" id="btn-save">' + Icon('check', 19) +
    '<span>' + (existing ? 'Perbarui Catatan' : 'Simpan Catatan') + '</span></button>' +
    '</div></div>' +
    '</div>' +

    '</div>' +

    /* ===== Kolom kanan: ringkasan ===== */
    '<div class="col gap-5">' +

    '<div class="card center-t">' +
    '<div class="card-title mb-4">Rata-rata 30 hari</div>' +
    '<div id="pain-ring"></div>' +
    '<div class="badge badge-' + (stats.trend === 'menurun' ? 'success' : stats.trend === 'meningkat' ? 'danger' : 'primary') +
    ' mt-4">Tren ' + U.esc(stats.trend) +
    (stats.delta ? ' ' + (stats.delta > 0 ? '+' : '') + stats.delta + ' poin' : '') + '</div>' +
    '<div class="grid g2 gap-2 mt-5" style="text-align:left">' +
    '<div class="mini-stat"><span class="ms-v">' + stats.severeDays + '</span>' +
    '<span class="ms-l">Hari nyeri berat</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' + stats.sleepDays + '</span>' +
    '<span class="ms-l">Tidur terganggu</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' + stats.medDays + '</span>' +
    '<span class="ms-l">Pakai obat</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' + U.esc(U.dur(stats.avgDuration)) + '</span>' +
    '<span class="ms-l">Durasi rata-rata</span></div>' +
    '</div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Peta nyeri 30 hari</div>' +
    '<div class="card-sub">Warna menunjukkan intensitas rata-rata per area</div></div></div>' +
    '<div class="bodymap" id="heatmap"></div>' +
    '<div class="mt-3">' + BodyMap.heatLegend() + '</div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div class="card-title">Pola tersering</div></div>' +
    '<div class="div-label" style="margin-top:0">Jenis nyeri</div>' +
    '<div class="col gap-2" id="top-types"></div>' +
    '<div class="div-label">Pemicu</div>' +
    '<div class="col gap-2" id="top-triggers"></div>' +
    '</div>' +

    '</div>' +
    '</section>' +

    /* ===== Grafik tren dengan penanda fase ===== */
    '<section class="card">' +
    '<div class="card-head">' +
    '<div><div class="card-title">Tren nyeri & fase penelitian</div>' +
    '<div class="card-sub">Blok berwarna menandai fase studi. Perhatikan perubahan saat umpan balik haptik dicabut.</div></div>' +
    '<div class="seg" id="seg-range" role="tablist">' +
    '<button data-value="30" aria-selected="true">30 hari</button>' +
    '<button data-value="60" aria-selected="false">60 hari</button>' +
    '<button data-value="90" aria-selected="false">90 hari</button>' +
    '</div></div>' +
    '<div class="chart-box"><canvas id="ch-trend" data-height="250"></canvas></div>' +
    '<div class="chart-legend mt-3" id="phase-legend"></div>' +
    '</section>' +

    /* ===== Riwayat & kejadian ===== */
    '<section class="grid g-2-1">' +
    '<div class="card">' +
    '<div class="card-head"><div class="card-title">Riwayat catatan</div>' +
    '<span class="badge" id="hist-count"></span></div>' +
    '<div class="table-wrap"><table class="table"><thead><tr>' +
    '<th>Tanggal</th><th>Nyeri</th><th>Fase</th><th>Jenis</th><th>Area</th><th>Pemicu</th><th></th>' +
    '</tr></thead><tbody id="hist-body"></tbody></table></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Kejadian tidak diinginkan</div>' +
    '<div class="card-sub">Laporan Anda dipantau tim klinis</div></div></div>' +
    '<div class="col gap-3" id="ae-list"></div>' +
    '<button class="btn btn-block mt-4" id="btn-ae-2">' + Icon('plus', 18) +
    '<span>Laporkan kejadian</span></button>' +
    '</div>' +
    '</section>';

  /* ---------------- Skala nyeri ---------------- */
  var scaleHost = U.$('#pain-scale');
  scaleHost.innerHTML = [].concat.apply([], Array.from({ length: 11 }, function (_, i) { return i; }))
    .map(function (i) {
      return '<button type="button" class="pain-btn" data-lvl="' + i + '" ' +
        'aria-pressed="' + (form.level === i) + '" aria-label="Tingkat nyeri ' + i + '">' + i + '</button>';
    }).join('');

  U.on(scaleHost, 'click', '.pain-btn', function (e, btn) {
    form.level = Number(btn.dataset.lvl);
    U.$$('.pain-btn', scaleHost).forEach(function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.lvl) === form.level));
    });
    renderReadout();
  });

  function renderReadout() {
    var host = U.$('#pain-readout');
    if (form.level === null) {
      host.className = 'cue-box mt-4';
      host.innerHTML = '<div><div class="cue-text" style="color:var(--text-3)">Belum dipilih</div>' +
        '<div class="cue-sub">Ketuk angka di atas sesuai nyeri yang Anda rasakan</div></div>';
      return;
    }
    var col = U.painColor(form.level);
    host.className = 'cue-box mt-4';
    host.innerHTML = '<div><div class="cue-text" style="color:' + col + '">' +
      U.esc(U.painLabel(form.level)) + ' · ' + form.level + '/10</div>' +
      '<div class="cue-sub">' + U.esc(advice(form.level)) + '</div></div>';
  }
  renderReadout();

  function advice(lvl) {
    if (lvl === 0) return 'Bagus. Catat tetap setiap hari agar pola tetap terlihat.';
    if (lvl <= 3) return 'Nyeri ringan. Terapi cermin dapat membantu menjaganya tetap rendah.';
    if (lvl <= 6) return 'Nyeri sedang. Pertimbangkan sesi relaksasi sebelum latihan motorik.';
    if (lvl <= 8) return 'Nyeri berat. Kurangi beban latihan dan prioritaskan GMI serta desensitisasi.';
    return 'Nyeri sangat berat. Terapis Anda akan diberi tahu. Hubungi tim klinis bila menetap.';
  }

  /* ---------------- Body map ---------------- */
  var bm = BodyMap.create(U.$('#bodymap'), {
    selected: form.zones,
    side: (user.amputation || {}).side,
    onChange: function (zones) { form.zones = zones; renderZoneList(); }
  });

  function renderZoneList() {
    var host = U.$('#zone-list');
    if (!form.zones.length) {
      host.innerHTML = '<span class="t-sm muted">Belum ada area dipilih</span>';
      return;
    }
    host.innerHTML = form.zones.map(function (z) {
      var ph = BodyMap.isPhantom(z);
      return '<span class="badge ' + (ph ? 'badge-violet' : 'badge-primary') + '">' +
        Icon(ph ? 'brain' : 'target', 12) + U.esc(BodyMap.zoneLabel(z)) + '</span>';
    }).join('');
  }
  renderZoneList();

  /* ---------------- Jenis nyeri ---------------- */
  var typeHost = U.$('#type-grid');
  typeHost.innerHTML = Seed.PAIN_TYPES.map(function (t) {
    return '<button type="button" class="chip" data-type="' + U.esc(t.id) + '" ' +
      'aria-pressed="' + (form.types.indexOf(t.id) >= 0) + '">' +
      Icon(t.icon, 15) + '<span>' + U.esc(t.label) + '</span></button>';
  }).join('');

  U.on(typeHost, 'click', '[data-type]', function (e, btn) {
    var id = btn.dataset.type;
    var i = form.types.indexOf(id);
    if (i >= 0) form.types.splice(i, 1); else form.types.push(id);
    btn.setAttribute('aria-pressed', String(form.types.indexOf(id) >= 0));
  });

  /* ---------------- Input lain ---------------- */
  U.$('#trigger').addEventListener('change', function () { form.trigger = this.value; });

  var dur = U.$('#duration');
  dur.addEventListener('input', function () {
    form.durationMin = Number(this.value);
    U.$('#dur-val').textContent = U.dur(form.durationMin);
  });

  U.$('#sleep').addEventListener('change', function () { form.sleepDisturbed = this.checked; });
  U.$('#med').addEventListener('change', function () { form.medication = this.checked; });

  var noteEl = U.$('#note');
  function syncCount() {
    U.$('#note-count').textContent = noteEl.value.length + '/500';
  }
  noteEl.addEventListener('input', function () { form.note = this.value; syncCount(); });
  syncCount();

  /* ---------------- Simpan ---------------- */
  U.$('#btn-save').addEventListener('click', function () {
    if (form.level === null) {
      UI.toast('Pilih tingkat nyeri terlebih dahulu.', 'warning');
      scaleHost.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!form.zones.length) {
      UI.toast('Tandai minimal satu area nyeri pada peta tubuh.', 'warning');
      return;
    }

    var payload = {
      patientId: pid,
      date: todayKey,
      loggedAt: new Date().toISOString(),
      level: form.level,
      types: form.types,
      zones: form.zones,
      trigger: form.trigger || 'Tanpa pemicu jelas',
      durationMin: form.durationMin,
      sleepDisturbed: form.sleepDisturbed,
      medication: form.medication,
      note: form.note.trim(),
      didExerciseToday: Store.list('sessions').some(function (s) {
        return s.patientId === pid && s.date === todayKey;
      }),
      phase: phase ? phase.phase : null
    };

    if (existing) {
      Store.update('painLogs', existing.id, payload);
      UI.toast('Catatan nyeri diperbarui.', 'success');
    } else {
      Store.insert('painLogs', payload);
      UI.toast('Catatan nyeri tersimpan. Terima kasih sudah konsisten.', 'success');
    }

    // Eskalasi ke terapis bila nyeri berat
    if (form.level >= 8 && user.therapistId) {
      Notify.push(user.therapistId, {
        type: 'nyeri', tone: 'danger', icon: 'brain',
        title: user.name + ': nyeri phantom ' + form.level + '/10',
        body: 'Dilaporkan hari ini' + (form.sleepDisturbed ? ', tidur terganggu' : '') +
          '. Pemicu: ' + payload.trigger + '.',
        link: 'terapis-pasien.html?id=' + pid
      });
    }

    Notify.checkAchievements(pid);
    setTimeout(function () { location.reload(); }, 900);
  });

  var delBtn = U.$('#btn-delete');
  if (delBtn) {
    delBtn.addEventListener('click', function () {
      UI.confirm({
        title: 'Hapus catatan hari ini?',
        message: 'Catatan nyeri untuk tanggal ' + U.fmtDate(new Date(), 'long') + ' akan dihapus.',
        okLabel: 'Hapus', danger: true
      }).then(function (ok) {
        if (!ok) return;
        Store.delete('painLogs', existing.id);
        UI.toast('Catatan dihapus.', 'info');
        setTimeout(function () { location.reload(); }, 700);
      });
    });
  }

  /* ---------------- Ring rata-rata ---------------- */
  U.$('#pain-ring').innerHTML = UI.ring({
    value: (stats.avg / 10) * 100, size: 138, stroke: 14,
    color: U.painColor(stats.avg),
    aria: 'Rata-rata nyeri ' + stats.avg + ' dari 10',
    label: '<div class="t-2xl bold" style="color:' + U.painColor(stats.avg) + '">' + stats.avg +
      '<span class="t-sm muted">/10</span></div><div class="t-xs muted">' +
      U.esc(U.painLabel(stats.avg)) + '</div>'
  });

  /* ---------------- Heatmap peta tubuh ---------------- */
  BodyMap.create(U.$('#heatmap'), {
    readonly: true,
    side: (user.amputation || {}).side,
    heat: BodyMap.heatFromLogs(Analytics.painLogs(pid, 30))
  });

  /* ---------------- Pola tersering ---------------- */
  function renderTop(hostSel, items, labelFn, tone) {
    var host = U.$(hostSel);
    if (!items.length) { host.innerHTML = '<span class="t-sm muted">Belum ada data</span>'; return; }
    var max = items[0].n;
    host.innerHTML = items.map(function (it) {
      return '<div><div class="row between t-xs mb-1">' +
        '<span class="semi">' + U.esc(labelFn(it.key)) + '</span>' +
        '<span class="muted">' + it.n + 'x</span></div>' +
        '<div class="prog sm ' + tone + '"><i style="width:' + U.pct(it.n, max) + '%"></i></div></div>';
    }).join('');
  }
  renderTop('#top-types', stats.topTypes, function (k) {
    var t = Seed.painType(k); return t ? t.label : k;
  }, 'violet');
  renderTop('#top-triggers', stats.topTriggers, function (k) { return k; }, 'warning');

  /* ---------------- Grafik tren dengan fase ---------------- */
  var range = 30;

  function drawTrend() {
    var labels = [], keys = [], pain = [], wear = [];
    var painMap = {}, telMap = {};
    Analytics.painLogs(pid, range).forEach(function (p) { painMap[p.date] = p; });
    Analytics.telemetry(pid, range).forEach(function (t) { telMap[t.date] = t; });

    for (var i = range - 1; i >= 0; i--) {
      var d = U.addDays(new Date(), -i);
      var k = U.dayKey(d);
      keys.push(k);
      labels.push(U.fmtDate(d, 'short'));
      pain.push(painMap[k] ? painMap[k].level : null);
      wear.push(telMap[k] ? telMap[k].wearHours : 0);
    }

    var bands = Study.phaseBands(pid, keys);
    // Chart.line menerima satu band; gambar berlapis untuk beberapa fase
    Chart.line(U.$('#ch-trend'), {
      labels: labels, height: 250, yMax: 10, ticks: 5, yMaxRight: 12,
      showDots: range <= 35,
      bands: bands,
      series: [
        { name: 'Jam pakai', data: wear, color: 'rgba(43,108,222,.24)', type: 'bar', axis: 'right' },
        { name: 'Nyeri', data: pain, color: '#7a5af8', fill: true, width: 2.8 }
      ]
    });

    U.$('#phase-legend').innerHTML =
      '<span><i style="background:#7a5af8"></i>Skor nyeri</span>' +
      '<span><i class="sq" style="background:rgba(43,108,222,.24)"></i>Jam pakai</span>' +
      bands.map(function (b) {
        var def = Study.phaseDef(b.phase);
        return '<span><i class="sq" style="background:' + Chart.alpha(def.color, 0.3) +
          ';border:1.5px solid ' + def.color + '"></i>' + U.esc(def.label) +
          (def.haptic ? '' : ' · haptik mati') + '</span>';
      }).join('');
  }
  drawTrend();
  Chart.responsive(drawTrend);

  UI.bindSeg(U.$('#seg-range'), function (v) {
    range = Number(v);
    drawTrend();
  });

  /* ---------------- Riwayat ---------------- */
  var histAll = logs90.slice().reverse();
  U.$('#hist-count').textContent = histAll.length + ' catatan';
  U.$('#hist-body').innerHTML = histAll.slice(0, 30).map(function (l) {
    var ph = Study.phaseOn(pid, l.date);
    var phDef = ph ? Study.phaseDef(ph.phase) : null;
    return '<tr>' +
      '<td class="nowrap">' + U.esc(U.fmtDate(l.date, 'short')) + '</td>' +
      '<td><span class="badge" style="background:' + Chart.alpha(U.painColor(l.level), 0.18) +
      ';color:' + U.painColor(l.level) + '">' + l.level + '/10</span></td>' +
      '<td>' + (phDef ? '<span class="badge" style="background:' + Chart.alpha(phDef.color, 0.14) +
        ';color:' + phDef.color + '">' + U.esc(phDef.short) + '</span>' : '-') + '</td>' +
      '<td class="t-xs">' + U.esc((l.types || []).map(function (t) {
        var d = Seed.painType(t); return d ? d.label : t;
      }).join(', ') || '-') + '</td>' +
      '<td class="t-xs">' + U.esc((l.zones || []).map(BodyMap.zoneLabel).join(', ') || '-') + '</td>' +
      '<td class="t-xs">' + U.esc(l.trigger || '-') + '</td>' +
      '<td class="right nowrap">' +
      (l.sleepDisturbed ? '<span data-tip="Tidur terganggu">' + Icon('clock', 14) + '</span> ' : '') +
      (l.medication ? '<span data-tip="Pakai obat">' + Icon('droplet', 14) + '</span>' : '') +
      '</td></tr>';
  }).join('') || '<tr><td colspan="7" class="center-t muted t-sm" style="padding:24px">Belum ada catatan</td></tr>';

  /* ---------------- Adverse events ---------------- */
  function renderAE() {
    var list = Study.adverseEvents(pid);
    var host = U.$('#ae-list');
    if (!list.length) {
      host.innerHTML = UI.empty({
        icon: 'shield', title: 'Tidak ada laporan',
        desc: 'Laporkan bila ada iritasi kulit, luka, alat bermasalah, atau nyeri yang justru meningkat.'
      });
      return;
    }
    host.innerHTML = list.slice(0, 5).map(function (a) {
      var t = Study.aeType(a.type);
      var sev = Study.AE_SEVERITY[a.severity] || {};
      return '<div class="row-t gap-3">' +
        '<span class="stat-ico ' + (sev.tone === 'success' ? '' : sev.tone) + '" ' +
        'style="width:38px;height:38px">' + Icon(t ? t.icon : 'alert', 18) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi" style="display:block">' + U.esc(t ? t.label : a.type) + '</span>' +
        '<span class="t-xs muted">' + U.esc(U.fmtDate(a.date, 'short')) + ' · ' +
        U.esc(sev.label || a.severity) +
        (a.status === 'selesai' ? ' · ditangani' : a.status === 'ditinjau' ? ' · ditinjau terapis' : ' · menunggu') +
        '</span>' +
        (a.reviewNote ? '<span class="t-xs c-primary" style="display:block;margin-top:3px">' +
          Icon('stethoscope', 11) + ' ' + U.esc(a.reviewNote) + '</span>' : '') +
        '</span>' +
        '<span class="badge badge-' + (sev.tone || 'primary') + ' shrink-0">' +
        U.esc(sev.label || a.severity) + '</span></div>';
    }).join('');
  }
  renderAE();

  function openAEForm() {
    var st = { type: '', severity: 'ringan', relatedTo: 'alat', stopped: false, care: false, body: '' };

    UI.modal({
      title: 'Laporkan kejadian tidak diinginkan',
      subtitle: 'Laporan ini membantu menjaga keselamatan Anda dan mutu penelitian',
      size: 'lg',
      content:
        '<div class="alert warning mb-4"><span class="a-ico">' + Icon('alert', 18) + '</span>' +
        '<span class="t-sm">Bila Anda mengalami keadaan darurat medis, hentikan pemakaian alat dan ' +
        'hubungi layanan gawat darurat atau tim klinis Anda secara langsung. Formulir ini bukan kanal darurat.</span></div>' +

        '<div class="field mb-4"><span class="label">Jenis kejadian</span>' +
        '<div class="pain-type-grid" id="ae-types">' +
        Study.AE_TYPES.map(function (t) {
          return '<button type="button" class="chip" data-ae="' + U.esc(t.id) + '" aria-pressed="false">' +
            Icon(t.icon, 15) + '<span>' + U.esc(t.label) + '</span></button>';
        }).join('') + '</div></div>' +

        '<div class="grid g2 gap-4">' +
        '<div class="field"><span class="label">Tingkat keparahan</span>' +
        '<div class="col gap-2" id="ae-sev">' +
        Object.keys(Study.AE_SEVERITY).map(function (k) {
          var s = Study.AE_SEVERITY[k];
          return '<label class="check radio"><input type="radio" name="sev" value="' + k + '"' +
            (k === 'ringan' ? ' checked' : '') + '>' +
            '<span class="box" aria-hidden="true"></span>' +
            '<span><span class="t-sm semi">' + U.esc(s.label) + '</span><br>' +
            '<span class="t-xs muted">' + U.esc(s.desc) + '</span></span></label>';
        }).join('') + '</div></div>' +

        '<div class="field"><label class="label" for="ae-rel">Berkaitan dengan</label>' +
        '<select class="select" id="ae-rel">' +
        [['alat', 'Lengan bionik / aktuator'], ['socket', 'Socket atau liner'],
        ['haptik', 'Umpan balik haptik'], ['latihan', 'Sesi latihan'],
        ['tidak-jelas', 'Tidak jelas']].map(function (p) {
          return '<option value="' + p[0] + '">' + U.esc(p[1]) + '</option>';
        }).join('') + '</select>' +
        '<div class="col gap-2 mt-3">' +
        '<label class="check"><input type="checkbox" id="ae-stop">' +
        '<span class="box" aria-hidden="true"></span>' +
        '<span class="t-sm">Saya menghentikan terapi karena ini</span></label>' +
        '<label class="check"><input type="checkbox" id="ae-care">' +
        '<span class="box" aria-hidden="true"></span>' +
        '<span class="t-sm">Saya mencari bantuan medis</span></label>' +
        '</div></div>' +
        '</div>' +

        '<div class="field mt-4"><label class="label" for="ae-body">Deskripsi kejadian</label>' +
        '<textarea class="textarea" id="ae-body" maxlength="600" ' +
        'placeholder="Ceritakan apa yang terjadi, kapan, dan berapa lama berlangsung…"></textarea></div>',

      actions: [
        { label: 'Batal' },
        {
          label: 'Kirim Laporan', class: 'btn-danger', icon: 'upload',
          onClick: function (m) {
            if (!st.type) {
              UI.toast('Pilih jenis kejadian terlebih dahulu.', 'warning');
              return false;
            }
            var body = U.$('#ae-body', m.root).value.trim();
            if (body.length < 10) {
              UI.toast('Mohon jelaskan kejadian minimal 10 karakter.', 'warning');
              return false;
            }
            Study.reportAE({
              patientId: pid,
              type: st.type,
              severity: st.severity,
              relatedTo: U.$('#ae-rel', m.root).value,
              stoppedTherapy: U.$('#ae-stop', m.root).checked,
              soughtCare: U.$('#ae-care', m.root).checked,
              body: body
            });
            UI.toast(st.severity === 'ringan'
              ? 'Laporan terkirim dan tercatat.'
              : 'Laporan terkirim. Terapis dan prostetis Anda sudah diberi tahu.',
              st.severity === 'berat' ? 'danger' : 'success', { duration: 6000 });
            renderAE();
          }
        }
      ],
      onOpen: function (m) {
        U.on(m.root, 'click', '[data-ae]', function (e, btn) {
          st.type = btn.dataset.ae;
          U.$$('[data-ae]', m.root).forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.dataset.ae === st.type));
          });
          // Sarankan keparahan sesuai jenis
          var t = Study.aeType(st.type);
          if (t && t.severityHint) {
            var radio = m.root.querySelector('input[name="sev"][value="' + t.severityHint + '"]');
            if (radio) { radio.checked = true; st.severity = t.severityHint; }
          }
        });
        U.$$('input[name="sev"]', m.root).forEach(function (r) {
          r.addEventListener('change', function () { st.severity = r.value; });
        });
      }
    });
  }

  U.$('#btn-ae').addEventListener('click', openAEForm);
  U.$('#btn-ae-2').addEventListener('click', openAEForm);

  /* ---------------- Tawarkan skrining bila jatuh tempo ---------------- */
  if (Study.screeningDue(pid, 30)) {
    setTimeout(function () {
      UI.toast('Skrining kesejahteraan bulanan Anda sudah jatuh tempo. Buka Pengaturan untuk mengisinya.',
        'info', { title: 'Skrining PHQ-9', duration: 8000 });
    }, 1600);
  }
})();
