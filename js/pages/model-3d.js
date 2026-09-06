/* ============================================================
   ASTA — Studio 3D Lengan Bionik
   Penampil interaktif model hasil Blender (assets/3d/asta-arm.glb)
   plus galeri render studio dan rincian modul perangkat keras.
   ============================================================ */
(function () {
  'use strict';

  Seed.run();
  var user = Auth.guard();
  if (!user) return;

  var shell = Shell.mount({
    title: 'Studio 3D',
    desc: 'Model tiga dimensi lengan bionik ASTA — putar, ganti pose, dan telusuri modulnya'
  });
  if (!shell) return;
  var c = shell.content;

  /* Pose demonstrasi. Nilai per digit mengikuti Device.GRIPS
     (urutan: ibu jari, telunjuk, tengah, manis, kelingking). */
  var POSES = [
    { key: 'terbuka', label: 'Terbuka', img: 'terbuka', digits: [0, 0, 0, 0, 0], force: 0 },
    { key: 'santai', label: 'Santai', img: 'santai', digits: [0.30, 0.26, 0.30, 0.34, 0.40], force: 8 },
    { key: 'genggam', label: 'Power grip', img: 'genggam', digits: [0.78, 0.90, 0.92, 0.92, 0.94], force: 74 },
    { key: 'jepit', label: 'Pinch', img: 'jepit', digits: [0.72, 0.66, 0.12, 0.10, 0.10], force: 38 },
    { key: 'tunjuk', label: 'Menunjuk', img: 'tunjuk', digits: [0.55, 0.02, 0.92, 0.92, 0.92], force: 12 }
  ];

  /* Modul perangkat keras — angka mengikuti purwarupa cetak 3D */
  var MODULES = [
    { icon: 'hand', name: 'Terminal device 5 jari',
      desc: 'Empat belas ruas berartikulasi, poros baja, bantalan silikon di ujung. ' +
            'Aktuasi tendon dengan delapan pola cengkeram tersimpan.' },
    { icon: 'refresh', name: 'Konektor pergelangan cepat-lepas',
      desc: 'Kunci tiga slot 120°. Tangan dapat dilepas tanpa alat untuk dibersihkan ' +
            'atau ditukar dengan terminal lain.' },
    { icon: 'cpu', name: 'Selongsong lengan bawah',
      desc: 'Rumah kontroler, baterai, dan empat kanal EMG. Cetak PETG dinding 3 mm ' +
            'dengan ventilasi internal.' },
    { icon: 'waves', name: 'Elektroda EMG (4 kanal)',
      desc: 'Fleksor dan ekstensor carpi radialis, bisep, trisep. Terbaca di penampil 3D ' +
            'sebagai titik yang menyala mengikuti kekuatan sinyal.' },
    { icon: 'target', name: 'Sendi siku & cangkang',
      desc: 'Engsel dua pelat dengan poros baja, cangkang ovoid membagi beban ke socket.' },
    { icon: 'shield', name: 'Socket humeral',
      desc: 'Cangkir kontak total berlapis liner. Titik tumpu utama beban lengan.' }
  ];

  var R = 'assets/render/web/';

  c.innerHTML =
    '<section class="grid g-2-1">' +

      /* ===== Penampil 3D ===== */
      '<div class="card pad-lg">' +
        '<div class="row between wrap gap-3 mb-4">' +
          '<div>' +
            '<h2 class="t-lg mb-1">Model interaktif</h2>' +
            '<p class="muted t-sm mb-0" id="viewer-note">Seret untuk memutar, gulir untuk memperbesar.</p>' +
          '</div>' +
          '<span class="badge badge-primary shrink-0" id="viewer-mode">Memuat…</span>' +
        '</div>' +

        '<div id="stage"></div>' +

        '<div class="div-label">Pose genggaman</div>' +
        '<div class="pose-grid" id="poses"></div>' +

        '<div class="div-label">Gaya cengkeram</div>' +
        '<div class="row gap-3 wrap">' +
          '<input type="range" id="force" min="0" max="100" value="0" step="1" ' +
                 'aria-label="Gaya cengkeram" style="flex:1;min-width:180px">' +
          '<span class="badge" id="force-val">0%</span>' +
        '</div>' +

        '<div class="div-label">Rotasi pergelangan</div>' +
        '<div class="row gap-3 wrap">' +
          '<input type="range" id="wrist" min="-90" max="90" value="0" step="1" ' +
                 'aria-label="Rotasi pergelangan" style="flex:1;min-width:180px">' +
          '<span class="badge" id="wrist-val">0°</span>' +
        '</div>' +

        '<div class="alert info mt-5">' +
          '<span class="a-ico">' + Icon('info', 18) + '</span>' +
          '<span class="t-sm">Bila perangkat terhubung, penampil ini mengikuti sinyal EMG ' +
          'secara langsung. Kendali di atas hanya untuk pratinjau ketika alat sedang tidak ' +
          'tersambung.</span>' +
        '</div>' +
      '</div>' +

      /* ===== Sisi kanan: modul & unduhan ===== */
      '<div class="col gap-4">' +
        '<div class="card pad-lg">' +
          '<h2 class="t-lg mb-1">Modul perangkat keras</h2>' +
          '<p class="muted t-sm mb-4">Enam modul yang menyusun lengan, dari socket sampai ujung jari.</p>' +
          '<div class="col gap-4" id="modules"></div>' +
        '</div>' +

        '<div class="card pad-lg">' +
          '<h2 class="t-lg mb-1">Berkas sumber</h2>' +
          '<p class="muted t-sm mb-4">Model dibuat prosedural di Blender; skripnya ikut disertakan ' +
          'sehingga geometri dapat dibangun ulang dan diubah.</p>' +
          '<div class="col gap-2">' +
            '<a class="btn" href="assets/3d/asta-arm.glb" download>' +
              Icon('download', 18) + '<span>Model glTF (.glb)</span></a>' +
            '<a class="btn" href="assets/3d/asta-arm.blend" download>' +
              Icon('download', 18) + '<span>Berkas Blender (.blend)</span></a>' +
            '<a class="btn" href="assets/render/00-poster.png" download>' +
              Icon('camera', 18) + '<span>Render poster (1920×1080)</span></a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===== Galeri render ===== */
    '<section class="card pad-lg mt-4">' +
      '<h2 class="t-lg mb-1">Galeri render studio</h2>' +
      '<p class="muted t-sm mb-4">Dirender di Blender dengan penataan cahaya tiga titik ' +
      'dan latar kertas putih, mengikuti dokumentasi foto purwarupa.</p>' +
      '<div class="render-grid" id="gallery"></div>' +
    '</section>';

  /* ---------------- Penampil ---------------- */
  var stage = Arm3D.create(U.$('#stage'), { view: 'penuh', autoRotate: true });

  var badge = U.$('#viewer-mode');
  var note = U.$('#viewer-note');

  U.$('#stage').addEventListener('arm3d:ready', function () {
    if (stage.mode === '3d') {
      badge.textContent = 'WebGL';
      badge.className = 'badge badge-success shrink-0';
    } else {
      badge.textContent = 'Mode gambar';
      badge.className = 'badge badge-warning shrink-0';
      note.textContent = 'Peramban ini tidak mendukung WebGL, jadi ditampilkan ' +
        '36 bingkai render. Seret untuk memutar.';
    }
  });

  /* ---------------- Pose ---------------- */
  var current = { digits: POSES[1].digits.slice(), force: 0, wrist: 0 };

  function push() {
    stage.setPose(current.digits, current.force, current.wrist);
  }

  U.$('#poses').innerHTML = POSES.map(function (p, i) {
    return '<button type="button" class="pose-card' + (i === 1 ? ' active' : '') + '" ' +
      'data-i="' + i + '" aria-pressed="' + (i === 1) + '">' +
      '<img src="' + R + 'pose/' + p.img + '.png" alt="" loading="lazy" width="240" height="240">' +
      '<span>' + U.esc(p.label) + '</span></button>';
  }).join('');

  U.on(U.$('#poses'), 'click', '.pose-card', function () {
    var p = POSES[+this.dataset.i];
    current.digits = p.digits.slice();
    current.force = p.force;
    U.$('#force').value = p.force;
    U.$('#force-val').textContent = p.force + '%';
    U.$$('.pose-card').forEach(function (b) {
      var on = b === this;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    }, this);
    push();
  });

  U.$('#force').addEventListener('input', function () {
    current.force = +this.value;
    U.$('#force-val').textContent = current.force + '%';
    push();
  });

  U.$('#wrist').addEventListener('input', function () {
    current.wrist = +this.value;
    U.$('#wrist-val').textContent = current.wrist + '°';
    push();
  });

  push();

  /* Perangkat sungguhan mengambil alih kendali pratinjau */
  Device.on('pose', function (d) {
    current.digits = d.pose.slice();
    current.force = d.force;
    current.wrist = d.wrist;
    U.$('#force').value = Math.round(d.force);
    U.$('#force-val').textContent = Math.round(d.force) + '%';
    U.$('#wrist').value = Math.round(d.wrist);
    U.$('#wrist-val').textContent = Math.round(d.wrist) + '°';
    push();
  });
  Device.on('signal', U.throttle(function (d) {
    stage.highlightElectrodes(d.raw);
  }, 90));
  Device.on('haptic', function (h) {
    if (h.intensity > 0) stage.pulseHaptic(h.pad, h.intensity);
  });

  /* ---------------- Modul ---------------- */
  U.$('#modules').innerHTML = MODULES.map(function (m) {
    return '<div class="row-t gap-3">' +
      '<span class="stat-ico shrink-0" style="width:40px;height:40px">' + Icon(m.icon, 18) + '</span>' +
      '<div><div class="semi t-sm">' + U.esc(m.name) + '</div>' +
      '<div class="muted t-xs mt-1" style="line-height:1.6">' + U.esc(m.desc) + '</div></div>' +
      '</div>';
  }).join('');

  /* ---------------- Galeri ---------------- */
  var SHOTS = [
    ['01-lengan-penuh', 'Lengan penuh', 'Socket humeral sampai ujung jari, panjang total ±62 cm.'],
    ['02-tangan-genggam', 'Power grip', 'Seluruh digit menutup penuh dengan bantalan silikon menghadap objek.'],
    ['03-tangan-jepit', 'Pinch', 'Oposisi ibu jari–telunjuk untuk objek kecil.'],
    ['04-siku-socket', 'Siku & socket', 'Engsel dua pelat dan cangkir kontak total.']
  ];
  U.$('#gallery').innerHTML = SHOTS.map(function (s) {
    return '<figure class="render-card">' +
      '<img src="' + R + 'hero/' + s[0] + '.jpg" alt="Render ' + U.esc(s[1]) +
      '" loading="lazy" width="1200" height="1200">' +
      '<figcaption><b>' + U.esc(s[1]) + '</b>' + U.esc(s[2]) + '</figcaption></figure>';
  }).join('');
})();
