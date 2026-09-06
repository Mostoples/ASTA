/* ============================================================
   ASTA — Pengaturan
   Profil, aksesibilitas (mode satu tangan), notifikasi,
   informed consent, log akses data, skrining, dan ekspor.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard(['pasien', 'terapis', 'prostetis', 'admin']);
  if (!user) return;

  var isPatient = user.role === 'pasien';
  var shell = Shell.mount({
    title: 'Pengaturan',
    desc: 'Profil, aksesibilitas, privasi, dan data Anda'
  });
  if (!shell) return;
  var c = shell.content;

  var st = Store.get('settings', {});
  var consent = isPatient ? Study.consent(user.id) : null;
  var role = Auth.role(user.role);

  c.innerHTML =
    '<div class="tabs" id="tabs" role="tablist">' +
    '<button class="tab" data-tab="profil" aria-selected="true" role="tab">' +
    Icon('user', 16) + ' Profil</button>' +
    '<button class="tab" data-tab="akses" aria-selected="false" role="tab">' +
    Icon('eye', 16) + ' Aksesibilitas</button>' +
    (isPatient
      ? '<button class="tab" data-tab="etik" aria-selected="false" role="tab">' +
        Icon('shield', 16) + ' Persetujuan & Privasi</button>' +
        '<button class="tab" data-tab="skrining" aria-selected="false" role="tab">' +
        Icon('brain', 16) + ' Skrining</button>'
      : '') +
    '<button class="tab" data-tab="data" aria-selected="false" role="tab">' +
    Icon('download', 16) + ' Data</button>' +
    '</div>' +

    '<div id="panels">' +
    '<section data-panel="profil" class="col gap-5"></section>' +
    '<section data-panel="akses" class="col gap-5 hidden"></section>' +
    (isPatient
      ? '<section data-panel="etik" class="col gap-5 hidden"></section>' +
        '<section data-panel="skrining" class="col gap-5 hidden"></section>'
      : '') +
    '<section data-panel="data" class="col gap-5 hidden"></section>' +
    '</div>';

  renderProfil();
  renderAkses();
  if (isPatient) { renderEtik(); renderSkrining(); }
  renderData();
  UI.bindTabs(U.$('#tabs'), U.$('#panels'));

  /* ============================================================
     Profil
     ============================================================ */
  function renderProfil() {
    var host = U.$('[data-panel="profil"]');
    var amp = user.amputation || {};
    var dev = Store.list('devices').find(function (d) { return d.patientId === user.id; });

    host.innerHTML =
      '<div class="card">' +
      '<div class="row-t gap-4 mb-5">' +
      '<span class="avatar xl ' + U.esc(user.avatar || '') + '">' +
      U.esc(U.initials(user.name)) + '</span>' +
      '<div class="grow">' +
      '<h2>' + U.esc(user.name) + '</h2>' +
      '<div class="row gap-2 mt-2 wrap">' +
      '<span class="badge badge-primary">' + Icon(role.icon, 12) + U.esc(role.label) + '</span>' +
      (user.title ? '<span class="badge">' + U.esc(user.title) + '</span>' : '') +
      (user.str ? '<span class="badge">' + U.esc(user.str) + '</span>' : '') +
      '</div>' +
      '<div class="t-sm muted mt-2">' + U.esc(user.email) +
      (user.phone ? ' · ' + U.esc(user.phone) : '') + '</div>' +
      '</div></div>' +

      '<dl class="kv">' +
      (user.city ? '<dt>Kota</dt><dd>' + U.esc(user.city) + '</dd>' : '') +
      (user.birth ? '<dt>Tanggal lahir</dt><dd>' + U.esc(U.fmtDate(user.birth, 'long')) +
        ' (' + age(user.birth) + ' tahun)</dd>' : '') +
      (user.clinic ? '<dt>Klinik</dt><dd>' + U.esc(user.clinic) + '</dd>' : '') +
      (user.joinedAt ? '<dt>Terdaftar sejak</dt><dd>' + U.esc(U.fmtDate(user.joinedAt, 'long')) +
        '</dd>' : '') +
      '</dl>' +
      '</div>' +

      (isPatient
        ? '<div class="grid g2">' +
          '<div class="card">' +
          '<div class="card-title mb-4">Data amputasi</div>' +
          '<dl class="kv">' +
          '<dt>Tingkat</dt><dd>' + U.esc(amp.level || '-') + '</dd>' +
          '<dt>Sisi</dt><dd>' + U.esc(amp.side || '-') + '</dd>' +
          '<dt>Penyebab</dt><dd>' + U.esc(amp.cause || '-') + '</dd>' +
          '<dt>Tanggal</dt><dd>' + U.esc(amp.date ? U.fmtDate(amp.date, 'long') : '-') + '</dd>' +
          '<dt>Lama pasca</dt><dd>' + (amp.date ? monthsSince(amp.date) + ' bulan' : '-') + '</dd>' +
          '</dl>' +
          '<div class="alert info mt-4"><span class="a-ico">' + Icon('info', 17) + '</span>' +
          '<span class="t-xs">Perubahan data klinis hanya dapat dilakukan oleh tim klinis Anda ' +
          'untuk menjaga keutuhan rekam medis.</span></div>' +
          '</div>' +

          '<div class="card">' +
          '<div class="card-title mb-4">Tim klinis Anda</div>' +
          '<div class="col gap-3">' +
          [['therapistId', 'Fisioterapis', 'stethoscope'],
          ['doctorId', 'Dokter Rehab Medik', 'hospital'],
          ['prosthetistId', 'Prostetis', 'wrench']].map(function (t) {
            var u = user[t[0]] ? Store.find('users', user[t[0]]) : null;
            if (!u) return '';
            return '<div class="row gap-3">' +
              '<span class="avatar sm ' + U.esc(u.avatar || '') + '">' +
              U.esc(U.initials(u.name)) + '</span>' +
              '<span class="grow" style="min-width:0">' +
              '<span class="t-sm semi truncate" style="display:block">' + U.esc(u.name) + '</span>' +
              '<span class="t-xs muted">' + U.esc(t[1]) + '</span></span>' +
              '<span class="stat-ico" style="width:32px;height:32px">' + Icon(t[2], 15) + '</span>' +
              '</div>';
          }).join('') + '</div>' +
          (dev ? '<div class="div-label">Perangkat</div>' +
            '<dl class="kv"><dt>Nomor seri</dt><dd class="mono t-xs">' + U.esc(dev.serial) + '</dd>' +
            '<dt>Model</dt><dd class="t-xs">' + U.esc(dev.model) + '</dd>' +
            '<dt>Socket</dt><dd class="t-xs">' + U.esc((user.device || {}).socket || '-') + '</dd></dl>'
            : '') +
          '</div></div>'
        : '') +

      '<div class="card">' +
      '<div class="card-title mb-4">Keamanan</div>' +
      '<div class="alert warning"><span class="a-ico">' + Icon('lock', 18) + '</span>' +
      '<span class="t-sm"><strong>Catatan prototipe:</strong> aplikasi ini menyimpan data di ' +
      'peramban Anda tanpa autentikasi server, sehingga tidak layak dipakai untuk data pasien ' +
      'nyata. Versi produksi memerlukan autentikasi di sisi server, penyandian data, ' +
      'dan kontrol akses berbasis peran yang ditegakkan di server.</span></div>' +
      '<button class="btn mt-4" id="btn-logout-2">' + Icon('logout', 18) +
      '<span>Keluar dari akun</span></button>' +
      '</div>';

    U.$('#btn-logout-2').addEventListener('click', function () {
      var b = U.$('#btn-logout');
      if (b) b.click();
    });
  }

  function age(birth) {
    var d = U.d(birth), n = new Date();
    var a = n.getFullYear() - d.getFullYear();
    if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
    return a;
  }
  function monthsSince(date) {
    var d = U.d(date), n = new Date();
    return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
  }

  /* ============================================================
     Aksesibilitas
     ============================================================ */
  function renderAkses() {
    var host = U.$('[data-panel="akses"]');
    host.innerHTML =
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Aksesibilitas</div>' +
      '<div class="card-sub">Sebagian besar pengguna ASTA mengoperasikan aplikasi dengan satu tangan. ' +
      'Pengaturan ini menyesuaikan tampilan agar lebih mudah dijangkau.</div></div></div>' +

      '<div class="col gap-4">' +
      toggleRow('one-hand', 'Mode satu tangan', 'Target sentuh diperbesar dan tombol utama ' +
        'ditempatkan agar mudah dijangkau ibu jari.', st.oneHandMode) +
      toggleRow('text-large', 'Teks besar', 'Memperbesar seluruh ukuran huruf.', st.textLarge) +
      toggleRow('contrast', 'Kontras tinggi', 'Meningkatkan ketegasan warna dan garis untuk ' +
        'kondisi penglihatan rendah atau cahaya terang.', st.contrastHigh) +
      toggleRow('reduce-motion', 'Kurangi animasi', 'Menonaktifkan transisi yang dapat ' +
        'mengganggu sebagian pengguna.', st.reduceMotion) +
      toggleRow('data-saver', 'Mode hemat data', 'Mengurangi frekuensi pembaruan grafik dan ' +
        'menonaktifkan video pada telekonsultasi.', st.dataSaver) +
      '</div>' +

      '<div class="div-label">Pratinjau</div>' +
      '<div class="row gap-3 wrap">' +
      '<button class="btn btn-lg btn-primary">' + Icon('play', 20) + '<span>Tombol utama</span></button>' +
      '<button class="btn btn-lg">' + Icon('check', 20) + '<span>Tombol biasa</span></button>' +
      '<span class="badge badge-primary">Label</span>' +
      '</div>' +
      '<p class="t-sm muted mt-3">Contoh teks paragraf untuk memeriksa keterbacaan pada ' +
      'pengaturan yang Anda pilih.</p>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-4">Bahasa</div>' +
      '<div class="field" style="max-width:280px">' +
      '<label class="label" for="lang">Bahasa antarmuka</label>' +
      '<select class="select" id="lang">' +
      '<option value="id" selected>Bahasa Indonesia</option>' +
      '<option value="en" disabled>English (belum tersedia)</option>' +
      '<option value="jv" disabled>Basa Jawa (belum tersedia)</option>' +
      '</select><span class="hint">Terjemahan tambahan direncanakan pada tahap lanjut.</span></div>' +
      '</div>';

    bindToggle('one-hand', 'oneHandMode');
    bindToggle('data-saver', 'dataSaver');

    U.$('#text-large').addEventListener('change', function () {
      saveSetting({ textLarge: this.checked });
      document.body.classList.toggle('text-lg', this.checked);
    });
    U.$('#contrast').addEventListener('change', function () {
      saveSetting({ contrastHigh: this.checked });
      document.body.classList.toggle('contrast-high', this.checked);
    });
    U.$('#reduce-motion').addEventListener('change', function () {
      saveSetting({ reduceMotion: this.checked });
      document.documentElement.style.setProperty('--t', this.checked ? '1ms' : '');
      document.documentElement.style.setProperty('--t-slow', this.checked ? '1ms' : '');
    });
  }

  function toggleRow(id, label, desc, checked) {
    return '<div class="row-t between gap-4">' +
      '<span class="grow"><span class="t-sm semi" style="display:block">' + U.esc(label) + '</span>' +
      '<span class="t-xs muted">' + U.esc(desc) + '</span></span>' +
      '<label class="switch shrink-0"><input type="checkbox" id="' + id + '"' +
      (checked ? ' checked' : '') + '>' +
      '<span class="track" aria-hidden="true"></span>' +
      '<span class="sr-only">' + U.esc(label) + '</span></label></div>';
  }

  function bindToggle(id, key) {
    var el = U.$('#' + id);
    if (el) el.addEventListener('change', function () {
      var p = {}; p[key] = this.checked;
      saveSetting(p);
    });
  }

  function saveSetting(patch) {
    st = Object.assign(Store.get('settings', {}), patch);
    Store.set('settings', st);
    UI.toast('Pengaturan disimpan.', 'success', { duration: 1500 });
  }

  /* ============================================================
     Persetujuan & Privasi
     ============================================================ */
  function renderEtik() {
    var host = U.$('[data-panel="etik"]');
    var valid = Study.consentValid(user.id);
    var log = Study.accessLog(user.id, 20);

    host.innerHTML =
      '<div class="card">' +
      '<div class="card-head">' +
      '<div><div class="card-title">Persetujuan penelitian</div>' +
      '<div class="card-sub">Versi ' + Study.CONSENT_VERSION +
      (consent ? ' · ditandatangani ' + U.esc(U.fmtDate(consent.at, 'long')) : '') + '</div></div>' +
      '<span class="badge badge-' + (consent && consent.withdrawn ? 'danger' : valid ? 'success' : 'warning') + '">' +
      (consent && consent.withdrawn ? 'Ditarik' : valid ? 'Berlaku' : 'Perlu diperbarui') + '</span>' +
      '</div>' +

      (consent && consent.withdrawn
        ? '<div class="alert danger"><span class="a-ico">' + Icon('info', 18) + '</span>' +
          '<span class="t-sm">Anda telah menarik persetujuan pada ' +
          U.esc(U.fmtDate(consent.withdrawnAt, 'long')) + '. Data Anda tidak lagi dipakai untuk ' +
          'keperluan penelitian. Layanan rehabilitasi tetap berjalan normal.</span></div>'
        : !valid
          ? '<div class="alert warning"><span class="a-ico">' + Icon('alert', 18) + '</span>' +
            '<span class="t-sm">Persetujuan Anda belum lengkap atau versinya sudah diperbarui. ' +
            'Mohon tinjau kembali.</span></div>'
          : '') +

      '<div class="col gap-3 mt-4">' +
      Study.CONSENT_ITEMS.map(function (it) {
        var agreed = consent && consent.agreed && consent.agreed.indexOf(it.id) >= 0;
        return '<div class="row-t gap-3">' +
          '<span class="stat-ico ' + (agreed ? 'success' : '') + '" style="width:32px;height:32px">' +
          Icon(agreed ? 'checkCircle' : 'x', 15) + '</span>' +
          '<span class="grow"><span class="t-sm semi" style="display:block">' +
          U.esc(it.label) + (it.required ? ' <span class="c-danger">*</span>' : '') + '</span>' +
          '<span class="t-xs muted">' + U.esc(it.body) + '</span></span></div>';
      }).join('') + '</div>' +

      '<div class="row gap-2 mt-5 wrap">' +
      '<button class="btn btn-primary" id="btn-consent">' + Icon('edit', 18) +
      '<span>' + (consent && !consent.withdrawn ? 'Perbarui persetujuan' : 'Berikan persetujuan') +
      '</span></button>' +
      (consent && !consent.withdrawn
        ? '<button class="btn btn-danger" id="btn-withdraw">' + Icon('x', 18) +
          '<span>Tarik persetujuan</span></button>'
        : '') +
      '</div>' +
      '<p class="t-xs muted mt-3">Anda berhak menarik persetujuan kapan saja tanpa memengaruhi ' +
      'layanan rehabilitasi yang Anda terima.</p>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Log akses data</div>' +
      '<div class="card-sub">Catatan setiap kali tim klinis membuka data Anda</div></div>' +
      '<span class="badge">' + log.length + ' entri</span></div>' +
      (log.length
        ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Waktu</th><th>Siapa</th><th>Peran</th><th>Tindakan</th></tr></thead><tbody>' +
          log.map(function (l) {
            var actor = Store.find('users', l.actorId);
            var r = actor ? Auth.role(actor.role) : null;
            return '<tr><td class="t-xs nowrap">' + U.esc(U.fmtDateTime(l.at)) + '</td>' +
              '<td class="semi t-xs">' + U.esc(actor ? actor.name : l.actorId) + '</td>' +
              '<td class="t-xs">' + U.esc(r ? r.label : '-') + '</td>' +
              '<td><span class="badge">' + U.esc(l.action.replace(/-/g, ' ')) + '</span></td></tr>';
          }).join('') + '</tbody></table></div>'
        : UI.empty({ icon: 'shield', title: 'Belum ada akses tercatat' })) +
      '</div>';

    U.$('#btn-consent').addEventListener('click', openConsent);
    var w = U.$('#btn-withdraw');
    if (w) w.addEventListener('click', function () {
      UI.modal({
        title: 'Tarik persetujuan penelitian',
        size: 'sm',
        content: '<div class="alert warning mb-4"><span class="a-ico">' + Icon('info', 18) + '</span>' +
          '<span class="t-sm">Layanan rehabilitasi Anda tidak akan terpengaruh. Yang dihentikan ' +
          'hanyalah penggunaan data untuk keperluan penelitian.</span></div>' +
          '<div class="field"><label class="label" for="wd-reason">Alasan (opsional)</label>' +
          '<textarea class="textarea" id="wd-reason" maxlength="300"></textarea></div>',
        actions: [
          { label: 'Batal' },
          {
            label: 'Tarik persetujuan', class: 'btn-danger',
            onClick: function (m) {
              Study.withdrawConsent(user.id, U.$('#wd-reason', m.root).value.trim());
              UI.toast('Persetujuan ditarik. Terapis Anda telah diberi tahu.', 'info', { duration: 5000 });
              consent = Study.consent(user.id);
              renderEtik();
            }
          }
        ]
      });
    });
  }

  function openConsent() {
    var agreed = consent && !consent.withdrawn ? (consent.agreed || []).slice() : [];

    UI.modal({
      title: 'Lembar persetujuan penelitian ASTA',
      subtitle: 'Versi ' + Study.CONSENT_VERSION,
      size: 'lg',
      content:
        '<div class="alert info mb-4"><span class="a-ico">' + Icon('info', 18) + '</span>' +
        '<span class="t-sm">Bacalah setiap butir. Butir bertanda <span class="c-danger">*</span> ' +
        'wajib disetujui untuk mengikuti penelitian. Anda dapat menarik persetujuan kapan saja.</span></div>' +

        '<div class="col gap-3">' +
        Study.CONSENT_ITEMS.map(function (it) {
          return '<div class="card sunken tight">' +
            '<label class="check" style="align-items:flex-start">' +
            '<input type="checkbox" data-cs="' + U.esc(it.id) + '"' +
            (agreed.indexOf(it.id) >= 0 ? ' checked' : '') + '>' +
            '<span class="box" aria-hidden="true" style="margin-top:2px"></span>' +
            '<span><span class="t-sm semi">' + U.esc(it.label) +
            (it.required ? ' <span class="c-danger">*</span>' : ' <span class="muted">(opsional)</span>') +
            '</span><br><span class="t-xs muted">' + U.esc(it.body) + '</span></span></label></div>';
        }).join('') + '</div>' +

        '<div class="field mt-4"><label class="label" for="cs-sign">Tanda tangan (tulis nama lengkap)</label>' +
        '<input class="input" id="cs-sign" maxlength="80" placeholder="' + U.esc(user.name) + '"></div>',

      actions: [
        { label: 'Batal' },
        {
          label: 'Setujui', class: 'btn-primary', icon: 'check',
          onClick: function (m) {
            var picked = U.$$('[data-cs]', m.root).filter(function (i) { return i.checked; })
              .map(function (i) { return i.dataset.cs; });
            var missing = Study.CONSENT_ITEMS.filter(function (it) {
              return it.required && picked.indexOf(it.id) < 0;
            });
            if (missing.length) {
              UI.toast('Butir wajib belum disetujui: ' + missing[0].label, 'warning', { duration: 5000 });
              return false;
            }
            var sign = U.$('#cs-sign', m.root).value.trim();
            if (sign.length < 3) {
              UI.toast('Mohon tulis nama lengkap Anda sebagai tanda tangan.', 'warning');
              return false;
            }
            Study.giveConsent(user.id, picked, sign);
            consent = Study.consent(user.id);
            UI.toast('Persetujuan tersimpan. Terima kasih atas partisipasi Anda.', 'success', { duration: 5000 });
            renderEtik();
          }
        }
      ]
    });
  }

  /* ============================================================
     Skrining PHQ-9
     ============================================================ */
  function renderSkrining() {
    var host = U.$('[data-panel="skrining"]');
    var list = Study.screenings(user.id, 'PHQ-9');
    var due = Study.screeningDue(user.id, 30);
    var last = list.length ? list[list.length - 1] : null;

    host.innerHTML =
      '<div class="card">' +
      '<div class="card-head">' +
      '<div><div class="card-title">Skrining kesejahteraan (PHQ-9)</div>' +
      '<div class="card-sub">Kondisi psikologis memengaruhi persepsi nyeri dan kepatuhan terapi. ' +
      'Skrining berkala membantu tim klinis memberi dukungan yang tepat.</div></div>' +
      (due ? '<span class="badge badge-warning">Jatuh tempo</span>'
        : '<span class="badge badge-success">Terkini</span>') +
      '</div>' +

      (last
        ? '<div class="grid g3 gap-3 mb-4">' +
          '<div class="mini-stat"><span class="ms-v">' + last.score + '<span class="t-xs muted">/27</span>' +
          '</span><span class="ms-l">Skor terakhir</span></div>' +
          '<div class="mini-stat"><span class="ms-v">' +
          U.esc(Study.phq9Interpret(last.score).label) + '</span>' +
          '<span class="ms-l">Kategori</span></div>' +
          '<div class="mini-stat"><span class="ms-v">' + U.esc(U.fmtDate(last.date, 'short')) + '</span>' +
          '<span class="ms-l">Tanggal</span></div>' +
          '</div>' +
          '<div class="alert ' + toneOf(Study.phq9Interpret(last.score).tone) + '">' +
          '<span class="a-ico">' + Icon('info', 18) + '</span>' +
          '<span class="t-sm">' + U.esc(Study.phq9Interpret(last.score).advice) + '</span></div>' +
          (last.flagSelfHarm
            ? '<div class="alert danger mt-3"><span class="a-ico">' + Icon('alert', 18) + '</span>' +
              '<span class="t-sm"><strong>Penting:</strong> Anda melaporkan pikiran menyakiti diri. ' +
              'Bila pikiran ini muncul, hubungi tim klinis Anda, layanan gawat darurat 112, ' +
              'atau layanan kesehatan jiwa terdekat. Anda tidak harus menghadapinya sendiri.</span></div>'
            : '')
        : UI.empty({ icon: 'clipboard', title: 'Belum pernah mengisi',
          desc: 'Pengisian memerlukan sekitar 2 menit.' })) +

      '<button class="btn btn-primary btn-lg mt-5" id="btn-phq">' + Icon('clipboard', 19) +
      '<span>' + (last ? 'Isi ulang skrining' : 'Mulai skrining') + '</span></button>' +
      '</div>' +

      (list.length > 1
        ? '<div class="card">' +
          '<div class="card-title mb-4">Riwayat skor</div>' +
          '<div class="chart-box"><canvas id="ch-phq" data-height="200"></canvas></div>' +
          '<div class="table-wrap mt-4"><table class="table"><thead><tr>' +
          '<th>Tanggal</th><th>Skor</th><th>Kategori</th></tr></thead><tbody>' +
          list.slice().reverse().map(function (s) {
            var i = Study.phq9Interpret(s.score);
            return '<tr><td>' + U.esc(U.fmtDate(s.date, 'long')) + '</td>' +
              '<td class="semi">' + s.score + '/27</td>' +
              '<td><span class="badge badge-' + i.tone + '">' + U.esc(i.label) + '</span></td></tr>';
          }).join('') + '</tbody></table></div></div>'
        : '');

    if (list.length > 1) {
      Chart.line(U.$('#ch-phq'), {
        labels: list.map(function (s) { return U.fmtDate(s.date, 'short'); }),
        height: 200, yMax: 27, ticks: 3,
        series: [{ name: 'PHQ-9', data: list.map(function (s) { return s.score; }),
          color: '#7a5af8', fill: true }]
      });
    }

    U.$('#btn-phq').addEventListener('click', openPhq);
  }

  function toneOf(t) { return t === 'primary' ? 'info' : t; }

  function openPhq() {
    var answers = new Array(9).fill(null);
    UI.modal({
      title: 'Skrining PHQ-9',
      subtitle: 'Selama 2 minggu terakhir, seberapa sering Anda merasakan hal berikut?',
      size: 'lg',
      content:
        '<div class="alert info mb-4"><span class="a-ico">' + Icon('info', 18) + '</span>' +
        '<span class="t-sm">Ini alat skrining, bukan diagnosis. Hasil dibagikan kepada terapis Anda ' +
        'agar dukungan dapat disesuaikan.</span></div>' +
        '<div class="col gap-4">' +
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
            var miss = answers.findIndex(function (a) { return a === null; });
            if (miss >= 0) {
              UI.toast('Pertanyaan nomor ' + (miss + 1) + ' belum dijawab.', 'warning');
              var el = U.$('[data-q="' + miss + '"]', m.root);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return false;
            }
            var rec = Study.saveScreening(user.id, answers);
            var i = Study.phq9Interpret(rec.score);
            UI.toast('Skor ' + rec.score + '/27 — ' + i.label, 'success', { duration: 5000 });
            renderSkrining();
          }
        }
      ],
      onOpen: function (m) {
        U.on(m.root, 'click', '[data-v]', function (e, btn) {
          var g = btn.closest('[data-q]');
          answers[Number(g.dataset.q)] = Number(btn.dataset.v);
          U.$$('[data-v]', g).forEach(function (b) {
            b.setAttribute('aria-pressed', String(b === btn));
          });
        });
      }
    });
  }

  /* ============================================================
     Data
     ============================================================ */
  function renderData() {
    var host = U.$('[data-panel="data"]');
    var keys = Store.keys();
    var counts = {
      sessions: Store.list('sessions').length,
      painLogs: Store.list('painLogs').length,
      telemetry: Store.list('telemetry').length,
      adverseEvents: Store.list('adverseEvents').length,
      notifications: Store.list('notifications').length
    };

    host.innerHTML =
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Ekspor data</div>' +
      '<div class="card-sub">Unduh salinan data dalam format CSV</div></div></div>' +
      '<div class="grid g2 gap-3">' +
      (isPatient
        ? exportCard('mine', 'file', 'Data harian saya', '90 hari nyeri, pemakaian alat, dan sesi latihan') +
          exportCard('anon', 'shield', 'Versi anonim', 'Identitas diganti kode subjek')
        : exportCard('study', 'chart', 'Dataset penelitian', 'Semua subjek, 90 hari, termasuk fase studi') +
          exportCard('ae', 'alert', 'Daftar kejadian tak diinginkan', 'Format pelaporan komite etik')) +
      '</div>' +
      '<div class="alert info mt-4"><span class="a-ico">' + Icon('info', 18) + '</span>' +
      '<span class="t-sm">Berkas memakai pemisah titik koma agar langsung terbaca pada Excel ' +
      'dengan pengaturan wilayah Indonesia.</span></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-4">Data pada peramban ini</div>' +
      '<dl class="kv">' +
      '<dt>Sesi latihan</dt><dd>' + U.nf(counts.sessions) + ' catatan</dd>' +
      '<dt>Catatan nyeri</dt><dd>' + U.nf(counts.painLogs) + ' catatan</dd>' +
      '<dt>Telemetri alat</dt><dd>' + U.nf(counts.telemetry) + ' hari</dd>' +
      '<dt>Kejadian dilaporkan</dt><dd>' + counts.adverseEvents + '</dd>' +
      '<dt>Notifikasi</dt><dd>' + counts.notifications + '</dd>' +
      '<dt>Kunci penyimpanan</dt><dd>' + keys.length + '</dd>' +
      '<dt>Penyimpanan</dt><dd>' + (Store.available ? 'localStorage tersedia' : 'memori sementara') + '</dd>' +
      '</dl>' +
      '<div class="row gap-2 mt-5 wrap">' +
      '<button class="btn" id="btn-backup">' + Icon('download', 17) + '<span>Cadangkan semua (JSON)</span></button>' +
      '<button class="btn" id="btn-restore">' + Icon('upload', 17) + '<span>Pulihkan cadangan</span></button>' +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-title mb-3">Zona berisiko</div>' +
      '<div class="alert danger mb-4"><span class="a-ico">' + Icon('alert', 18) + '</span>' +
      '<span class="t-sm">Tindakan berikut menghapus data pada peramban ini dan tidak dapat ' +
      'dibatalkan. Buat cadangan terlebih dahulu bila data masih diperlukan.</span></div>' +
      '<div class="row gap-2 wrap">' +
      '<button class="btn" id="btn-reseed">' + Icon('refresh', 17) +
      '<span>Bangun ulang data demo</span></button>' +
      '<button class="btn btn-danger" id="btn-wipe">' + Icon('trash', 17) +
      '<span>Hapus semua data</span></button>' +
      '</div></div>';

    U.on(host, 'click', '[data-exp]', function (e, btn) {
      var kind = btn.dataset.exp;
      var res;
      if (kind === 'mine') res = Analytics.exportPatientCSV(user.id, false);
      else if (kind === 'anon') res = Analytics.exportPatientCSV(user.id, true);
      else if (kind === 'study') res = Study.exportStudyCSV(true);
      else res = Study.exportAECSV(true);
      U.downloadText(res.name, res.csv, 'text/csv;charset=utf-8');
      UI.toast('Berkas ' + res.name + ' diunduh' +
        (res.rows ? ' (' + U.nf(res.rows) + ' baris)' : '') + '.', 'success', { duration: 4500 });
    });

    U.$('#btn-backup').addEventListener('click', function () {
      var data = Store.exportAll();
      U.downloadText('asta_backup_' + U.today() + '.json',
        JSON.stringify(data, null, 2), 'application/json');
      UI.toast('Cadangan diunduh.', 'success');
    });

    U.$('#btn-restore').addEventListener('click', function () {
      var input = U.el('input', { type: 'file', accept: '.json', style: 'display:none' });
      document.body.appendChild(input);
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) { input.remove(); return; }
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var obj = JSON.parse(reader.result);
            Store.importAll(obj);
            UI.toast('Cadangan dipulihkan. Halaman akan dimuat ulang.', 'success');
            setTimeout(function () { location.reload(); }, 1200);
          } catch (err) {
            UI.toast('Berkas tidak dapat dibaca: ' + err.message, 'danger', { duration: 6000 });
          }
          input.remove();
        };
        reader.readAsText(f);
      });
      input.click();
    });

    U.$('#btn-reseed').addEventListener('click', function () {
      UI.confirm({
        title: 'Bangun ulang data demo?',
        message: 'Semua data pada peramban ini diganti dengan data awal penelitian.',
        okLabel: 'Bangun ulang', danger: true
      }).then(function (ok) {
        if (!ok) return;
        Seed.reset();
        UI.toast('Data demo dibangun ulang.', 'success');
        setTimeout(function () { location.reload(); }, 900);
      });
    });

    U.$('#btn-wipe').addEventListener('click', function () {
      UI.confirm({
        title: 'Hapus semua data?',
        message: 'Seluruh sesi latihan, catatan nyeri, persetujuan, dan pengaturan pada peramban ini ' +
          'akan dihapus permanen. Anda akan dikeluarkan dari akun.',
        okLabel: 'Hapus permanen', danger: true
      }).then(function (ok) {
        if (!ok) return;
        if (Device.state.connected) Device.disconnect();
        Store.clearAll();
        UI.toast('Semua data dihapus.', 'info');
        setTimeout(function () { location.href = 'masuk.html'; }, 900);
      });
    });
  }

  function exportCard(kind, icon, title, desc) {
    return '<button class="role-opt" data-exp="' + kind + '">' +
      '<span class="r-ico">' + Icon(icon, 19) + '</span>' +
      '<span><span class="r-name">' + U.esc(title) + '</span>' +
      '<span class="r-desc">' + U.esc(desc) + '</span></span></button>';
  }
})();
