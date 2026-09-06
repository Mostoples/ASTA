/* ============================================================
   ASTA — Resep Program Latihan
   Menyusun program berjenjang dari katalog latihan, dengan
   saran otomatis berbasis tingkat nyeri dan fase pasien.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard('terapis');
  if (!user) return;

  var qid = U.query('id');
  var pid = qid && Store.find('users', qid) ? qid : Auth.activePatientId();
  var patient = pid ? Store.find('users', pid) : null;
  if (!patient) {
    document.body.innerHTML = '<p style="padding:40px">Tidak ada pasien terdaftar.</p>';
    return;
  }
  Auth.activePatientId(patient.id);
  Study.logAccess(user.id, patient.id, 'ubah-resep');

  var shell = Shell.mount({
    title: 'Resep Program',
    desc: 'Menyusun program untuk ' + patient.name
  });
  if (!shell) return;
  var c = shell.content;

  var rx = Analytics.prescription(patient.id);
  var ov = Analytics.patientOverview(patient.id);
  var pain = Analytics.painStats(patient.id, 14);
  var gmi = Analytics.gmiStats(patient.id, 30);

  // Salinan kerja
  var draft = rx
    ? { phase: rx.phase, weeklyTarget: rx.weeklyTarget, note: rx.note, items: U.clone(rx.items) }
    : { phase: 1, weeklyTarget: 5, note: '', items: [] };

  var CATS = [
    { key: 'motorik', label: 'Motorik', icon: 'activity', tone: '' },
    { key: 'phantom', label: 'Phantom Pain', icon: 'brain', tone: 'violet' },
    { key: 'adl', label: 'ADL', icon: 'home', tone: 'teal' }
  ];

  c.innerHTML =
    '<section class="card">' +
    '<div class="row between wrap gap-4">' +
    '<div class="row gap-3">' +
    '<span class="avatar ' + U.esc(patient.avatar || '') + '">' +
    U.esc(U.initials(patient.name)) + '</span>' +
    '<div><span class="semi">' + U.esc(patient.name) + '</span>' +
    '<div class="t-xs muted">' + U.esc((patient.amputation || {}).level || '') + ' ' +
    U.esc((patient.amputation || {}).side || '') + ' · ' + U.esc(patient.program || '') + '</div></div>' +
    '</div>' +
    '<div id="picker-slot"></div></div>' +

    '<div class="grid g4 gap-3 mt-4">' +
    '<div class="mini-stat"><span class="ms-v">' + ov.adherence.score + '%</span>' +
    '<span class="ms-l">Kepatuhan 14 hari</span></div>' +
    '<div class="mini-stat"><span class="ms-v" style="color:' + U.painColor(pain.avg) + '">' +
    pain.avg + '/10</span><span class="ms-l">Nyeri (tren ' + U.esc(pain.trend) + ')</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' + ov.usage.wearAvg + 'j</span>' +
    '<span class="ms-l">Pakai alat/hari</span></div>' +
    '<div class="mini-stat"><span class="ms-v">' + (gmi.accuracy || '–') + '%</span>' +
    '<span class="ms-l">Ketepatan GMI</span></div>' +
    '</div></section>' +

    /* ===== Saran otomatis ===== */
    '<section id="advice"></section>' +

    '<section class="grid g-1-2">' +
    /* ===== Pengaturan program ===== */
    '<div class="col gap-4">' +
    '<div class="card">' +
    '<div class="card-title mb-4">Pengaturan program</div>' +
    '<div class="field mb-4">' +
    '<div class="row between"><label class="label" for="ph">Fase program</label>' +
    '<span class="t-sm bold" id="ph-v">Fase ' + draft.phase + '</span></div>' +
    '<input class="range" type="range" id="ph" min="1" max="6" value="' + draft.phase + '">' +
    '<span class="hint" id="ph-hint"></span></div>' +

    '<div class="field mb-4">' +
    '<div class="row between"><label class="label" for="wt">Target sesi per minggu</label>' +
    '<span class="t-sm bold" id="wt-v">' + draft.weeklyTarget + 'x</span></div>' +
    '<input class="range" type="range" id="wt" min="2" max="7" value="' + draft.weeklyTarget + '">' +
    '<span class="hint">Target ini dipakai untuk menghitung skor kepatuhan.</span></div>' +

    '<div class="field"><label class="label" for="note">Catatan untuk pasien</label>' +
    '<textarea class="textarea" id="note" maxlength="400" ' +
    'placeholder="Instruksi, peringatan, atau motivasi…">' + U.esc(draft.note) + '</textarea></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-title mb-3">Ringkasan resep</div>' +
    '<div id="summary"></div>' +
    '<div class="row gap-2 mt-5">' +
    '<button class="btn grow" id="btn-reset">' + Icon('refresh', 17) + '<span>Batalkan</span></button>' +
    '<button class="btn btn-primary grow" id="btn-save">' + Icon('check', 18) +
    '<span>Simpan resep</span></button></div>' +
    '</div></div>' +

    /* ===== Katalog & keranjang ===== */
    '<div class="col gap-4">' +
    '<div class="card">' +
    '<div class="card-head"><div><div class="card-title">Latihan dalam program</div>' +
    '<div class="card-sub">Atur set, repetisi, dan frekuensi mingguan</div></div>' +
    '<span class="badge" id="cnt-badge">0 latihan</span></div>' +
    '<div class="col gap-3" id="basket"></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><div class="card-title">Katalog latihan</div>' +
    '<div class="seg" id="seg-cat">' +
    '<button data-value="all" aria-selected="true">Semua</button>' +
    CATS.map(function (k) {
      return '<button data-value="' + k.key + '" aria-selected="false">' + U.esc(k.label) + '</button>';
    }).join('') + '</div></div>' +
    '<div class="col gap-2" id="catalog"></div>' +
    '</div></div></section>';

  U.$('#picker-slot').appendChild(Shell.patientPicker(function (id) {
    location.href = 'terapis-program.html?id=' + encodeURIComponent(id);
  }));

  /* ---------------- Saran otomatis ---------------- */
  function renderAdvice() {
    var tips = [];
    if (pain.avg >= 7) {
      tips.push({ tone: 'warning', icon: 'brain',
        text: 'Nyeri phantom berat (' + pain.avg + '/10). Prioritaskan modul phantom seperti GMI, ' +
          'terapi cermin, dan relaksasi. Batasi beban motorik sampai nyeri menurun.' });
    }
    if (pain.trend === 'meningkat') {
      tips.push({ tone: 'danger', icon: 'trend',
        text: 'Tren nyeri meningkat. Pertimbangkan menurunkan intensitas dan menambah sesi desensitisasi.' });
    }
    if (ov.adherence.score < 50) {
      tips.push({ tone: 'warning', icon: 'target',
        text: 'Kepatuhan rendah (' + ov.adherence.score + '%). Program yang terlalu berat sering ' +
          'menjadi penyebab. Pertimbangkan mengurangi jumlah latihan atau target mingguan.' });
    }
    if (gmi.accuracy && gmi.accuracy >= 90 && gmi.avgMs <= 2000) {
      tips.push({ tone: 'success', icon: 'checkCircle',
        text: 'Ketepatan GMI sudah ' + gmi.accuracy + '% dengan waktu reaksi ' +
          (gmi.avgMs / 1000).toFixed(1) + 's. Pasien siap naik ke tahap imajinasi gerak dan terapi cermin.' });
    }
    if (ov.usage.wearAvg < 3) {
      tips.push({ tone: 'warning', icon: 'clock',
        text: 'Pemakaian alat hanya ' + ov.usage.wearAvg + ' jam/hari. Tambahkan latihan ADL agar ' +
          'alat terasa berguna dalam kegiatan sehari-hari.' });
    }
    var aeOpen = Study.adverseEvents(patient.id, { openOnly: true });
    if (aeOpen.length) {
      tips.push({ tone: 'danger', icon: 'shield',
        text: aeOpen.length + ' kejadian tidak diinginkan belum ditangani. Tinjau sebelum menaikkan beban.' });
    }

    U.$('#advice').innerHTML = tips.length
      ? '<div class="card"><div class="card-title mb-4">Saran berbasis data pasien</div>' +
        '<div class="col gap-3">' + tips.map(function (t) {
          return '<div class="alert ' + t.tone + '"><span class="a-ico">' + Icon(t.icon, 18) + '</span>' +
            '<span class="t-sm">' + U.esc(t.text) + '</span></div>';
        }).join('') + '</div></div>'
      : '<div class="alert success"><span class="a-ico">' + Icon('checkCircle', 18) + '</span>' +
        '<span class="t-sm">Data pasien tidak menunjukkan tanda yang memerlukan penyesuaian khusus.</span></div>';
  }
  renderAdvice();

  /* ---------------- Fase ---------------- */
  var PHASE_HINT = {
    1: 'Fase 1: adaptasi awal. Fokus toleransi socket, pengenalan sinyal, dan GMI bila nyeri tinggi.',
    2: 'Fase 2: penguasaan kontrol dasar buka-tutup dan gradasi gaya.',
    3: 'Fase 3: kontrol presisi, pola cengkeram bervariasi, mulai ADL sederhana.',
    4: 'Fase 4: ADL kompleks, ketahanan, dan penggunaan sepanjang hari.',
    5: 'Fase 5: integrasi pekerjaan dan aktivitas bermakna.',
    6: 'Fase 6: pemeliharaan mandiri dengan pemantauan berkala.'
  };

  var ph = U.$('#ph');
  function syncPhase() {
    draft.phase = Number(ph.value);
    U.$('#ph-v').textContent = 'Fase ' + draft.phase;
    U.$('#ph-hint').textContent = PHASE_HINT[draft.phase] || '';
    renderSummary();
  }
  ph.addEventListener('input', syncPhase);
  syncPhase();

  var wt = U.$('#wt');
  wt.addEventListener('input', function () {
    draft.weeklyTarget = Number(this.value);
    U.$('#wt-v').textContent = draft.weeklyTarget + 'x';
    renderSummary();
  });

  U.$('#note').addEventListener('input', function () { draft.note = this.value; });

  /* ---------------- Katalog ---------------- */
  var catFilter = 'all';
  function renderCatalog() {
    var list = Seed.EXERCISES.filter(function (ex) {
      return catFilter === 'all' || ex.cat === catFilter;
    });
    U.$('#catalog').innerHTML = list.map(function (ex) {
      var inBasket = draft.items.some(function (i) { return i.exId === ex.id; });
      var cat = CATS.find(function (k) { return k.key === ex.cat; }) || CATS[0];
      return '<div class="ex-item' + (inBasket ? ' done' : '') + '">' +
        '<span class="stat-ico ' + cat.tone + '" style="width:34px;height:34px">' +
        Icon(cat.icon, 16) + '</span>' +
        '<span class="grow" style="min-width:0">' +
        '<span class="t-sm semi truncate" style="display:block">' + U.esc(ex.name) + '</span>' +
        '<span class="t-xs muted">' + U.esc(ex.desc.slice(0, 72)) +
        (ex.desc.length > 72 ? '…' : '') + '</span></span>' +
        (inBasket
          ? '<span class="badge badge-success shrink-0">' + Icon('check', 11) + 'Dipakai</span>'
          : '<button class="btn btn-sm btn-primary shrink-0" data-add="' + U.esc(ex.id) + '">' +
            Icon('plus', 14) + '<span>Tambah</span></button>') +
        '</div>';
    }).join('');
  }

  UI.bindSeg(U.$('#seg-cat'), function (v) { catFilter = v; renderCatalog(); });

  U.on(U.$('#catalog'), 'click', '[data-add]', function (e, btn) {
    var ex = Seed.exercise(btn.dataset.add);
    if (!ex) return;
    draft.items.push({
      exId: ex.id,
      sets: ex.cat === 'phantom' ? 1 : 2,
      reps: ex.target,
      freq: ex.cat === 'phantom' ? 4 : 3
    });
    renderBasket(); renderCatalog(); renderSummary();
    UI.toast(ex.name + ' ditambahkan.', 'success', { duration: 1800 });
  });

  /* ---------------- Keranjang ---------------- */
  function renderBasket() {
    var host = U.$('#basket');
    U.$('#cnt-badge').textContent = draft.items.length + ' latihan';

    if (!draft.items.length) {
      host.innerHTML = UI.empty({ icon: 'clipboard', title: 'Program masih kosong',
        desc: 'Tambahkan latihan dari katalog di bawah.' });
      return;
    }

    host.innerHTML = draft.items.map(function (it, idx) {
      var ex = Seed.exercise(it.exId);
      if (!ex) return '';
      var cat = CATS.find(function (k) { return k.key === ex.cat; }) || CATS[0];
      return '<div class="card flat">' +
        '<div class="row between mb-3 wrap gap-2">' +
        '<span class="row gap-2">' +
        '<span class="stat-ico ' + cat.tone + '" style="width:32px;height:32px">' +
        Icon(cat.icon, 15) + '</span>' +
        '<span><span class="t-sm semi">' + U.esc(ex.name) + '</span><br>' +
        '<span class="t-xs muted">' + U.esc(cat.label) + ' · satuan ' + U.esc(ex.unit) + '</span></span>' +
        '</span>' +
        '<span class="row gap-1">' +
        (idx > 0 ? '<button class="btn btn-ghost btn-icon btn-sm" data-up="' + idx +
          '" aria-label="Naikkan urutan">' + Icon('arrowUp', 15) + '</button>' : '') +
        '<button class="btn btn-ghost btn-icon btn-sm" data-rm="' + idx +
        '" aria-label="Hapus latihan">' + Icon('trash', 15) + '</button>' +
        '</span></div>' +
        '<div class="grid g3 gap-3">' +
        numField('Set', 'sets', idx, it.sets, 1, 6) +
        numField(U.titlecase(ex.unit), 'reps', idx, it.reps, 1, 300) +
        numField('Per minggu', 'freq', idx, it.freq, 1, 7) +
        '</div></div>';
    }).join('');

    U.on(host, 'change', '[data-f]', function (e, el) {
      var i = Number(el.dataset.i), f = el.dataset.f;
      draft.items[i][f] = UI.numVal(el, Number(el.min), Number(el.max), draft.items[i][f]);
      el.value = draft.items[i][f];
      renderSummary();
    });
    U.on(host, 'click', '[data-rm]', function (e, btn) {
      draft.items.splice(Number(btn.dataset.rm), 1);
      renderBasket(); renderCatalog(); renderSummary();
    });
    U.on(host, 'click', '[data-up]', function (e, btn) {
      var i = Number(btn.dataset.up);
      var tmp = draft.items[i - 1];
      draft.items[i - 1] = draft.items[i];
      draft.items[i] = tmp;
      renderBasket();
    });
  }

  function numField(label, field, idx, val, min, max) {
    return '<div class="field"><label class="label t-xs" for="f-' + field + '-' + idx + '">' +
      U.esc(label) + '</label>' +
      '<input class="input" type="number" id="f-' + field + '-' + idx + '" ' +
      'data-f="' + field + '" data-i="' + idx + '" min="' + min + '" max="' + max +
      '" value="' + val + '"></div>';
  }

  /* ---------------- Ringkasan ---------------- */
  function renderSummary() {
    var byCat = { motorik: 0, phantom: 0, adl: 0 };
    var weeklyMin = 0;
    draft.items.forEach(function (it) {
      var ex = Seed.exercise(it.exId);
      if (!ex) return;
      byCat[ex.cat] = (byCat[ex.cat] || 0) + 1;
      var perSession = ex.unit === 'menit' ? it.reps
        : ex.unit === 'detik' ? it.reps / 60
          : it.reps * it.sets * 0.32;
      weeklyMin += perSession * it.freq;
    });
    var perSession = draft.weeklyTarget ? Math.round(weeklyMin / draft.weeklyTarget) : 0;

    U.$('#summary').innerHTML =
      '<dl class="kv">' +
      '<dt>Total latihan</dt><dd>' + draft.items.length + '</dd>' +
      '<dt>Motorik</dt><dd>' + byCat.motorik + '</dd>' +
      '<dt>Phantom pain</dt><dd>' + byCat.phantom + '</dd>' +
      '<dt>ADL</dt><dd>' + byCat.adl + '</dd>' +
      '<dt>Beban mingguan</dt><dd>' + U.esc(U.dur(weeklyMin)) + '</dd>' +
      '<dt>Perkiraan per sesi</dt><dd>' + U.esc(U.dur(perSession)) + '</dd>' +
      '</dl>' +
      (perSession > 45
        ? '<div class="alert warning mt-3"><span class="a-ico">' + Icon('alert', 17) + '</span>' +
          '<span class="t-xs">Sesi diperkirakan ' + U.dur(perSession) +
          '. Sesi panjang menurunkan kepatuhan. Pertimbangkan mengurangi latihan atau ' +
          'menaikkan frekuensi dengan durasi lebih pendek.</span></div>'
        : '') +
      (pain.avg >= 7 && byCat.phantom < 2
        ? '<div class="alert warning mt-3"><span class="a-ico">' + Icon('brain', 17) + '</span>' +
          '<span class="t-xs">Nyeri pasien tinggi namun modul phantom hanya ' + byCat.phantom +
          '. Pertimbangkan menambah GMI atau terapi cermin.</span></div>'
        : '');
  }

  renderBasket();
  renderCatalog();
  renderSummary();

  /* ---------------- Simpan ---------------- */
  U.$('#btn-save').addEventListener('click', function () {
    if (!draft.items.length) {
      UI.toast('Tambahkan minimal satu latihan.', 'warning');
      return;
    }
    var payload = {
      patientId: patient.id, therapistId: user.id,
      phase: draft.phase, weeklyTarget: draft.weeklyTarget,
      note: draft.note.trim(), items: draft.items,
      startedAt: rx ? rx.startedAt : U.today(),
      updatedAt: new Date().toISOString()
    };

    if (rx) Store.update('prescriptions', rx.id, payload);
    else Store.insert('prescriptions', payload);

    Store.update('users', patient.id, {
      program: 'Program 12 Minggu — Fase ' + draft.phase
    });

    Notify.push(patient.id, {
      type: 'program', tone: 'primary', icon: 'clipboard',
      title: 'Program latihan Anda diperbarui',
      body: draft.items.length + ' latihan, target ' + draft.weeklyTarget + ' sesi per minggu' +
        (draft.note ? '. ' + draft.note.slice(0, 80) : '.'),
      link: 'sesi-latihan.html'
    });

    UI.toast('Resep tersimpan dan pasien sudah diberi tahu.', 'success', { duration: 4500 });
    rx = Analytics.prescription(patient.id);
  });

  U.$('#btn-reset').addEventListener('click', function () {
    UI.confirm({
      title: 'Batalkan perubahan?',
      message: 'Program akan dikembalikan ke versi tersimpan.'
    }).then(function (ok) { if (ok) location.reload(); });
  });
})();
