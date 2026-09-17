/* ============================================================
   ASTA — Landing page publik
   Halaman terbuka (tanpa autentikasi) yang memperkenalkan ASTA.
   Seluruh gambar di halaman ini adalah SVG yang dibangkitkan
   js/lib/illustrations.js dan js/lib/decor.js, kecuali foto
   purwarupa asli (assets/foto/) dan video profil (assets/video/).

   Catatan isi: ASTA adalah purwarupa penelitian. Halaman ini
   sengaja hanya memuat spesifikasi teknis yang benar-benar ada
   di dalam aplikasi — tidak ada angka adopsi, testimoni, atau
   klaim hasil klinis.
   ============================================================ */
(function () {
  'use strict';

  /* Halaman ini tidak menampilkan data demo, jadi Seed.run() sengaja
     tidak dipanggil: penyemaian baru terjadi di halaman masuk. Dengan
     begitu landing page tidak perlu memuat modul study/analytics/notify. */

  var R = 'assets/render/web/';
  var session = Auth.isLoggedIn() ? Auth.current() : null;
  var role = session ? Auth.role(session.role) : null;

  /* ---------------- Data isi ---------------- */

  /* Angka diambil dari konfigurasi alat yang sesungguhnya
     (js/core/device.js) dan dari model Blender, bukan karangan. */
  var STATS = [
    { v: String(Device.CHANNELS.length), s: 'kanal sEMG permukaan' },
    { v: String(Object.keys(Device.GRIPS).length), s: 'pola cengkeram tersimpan' },
    { v: '14', s: 'ruas jari berartikulasi' },
    { v: '±38 ms', s: 'latensi niat ke gerak' }
  ];

  /* Latar belakang: isi naskah video profil (Scene 9). */
  var MASALAH = [
    { icon: 'shield', tone: '', h: 'Biaya',
      p: 'Harga lengan prostetik fungsional masih menjadi hambatan utama bagi banyak ' +
         'penyandang amputasi untuk memilikinya.' },
    { icon: 'cloud', tone: 'teal', h: 'Akses layanan',
      p: 'Kontrol dan latihan rutin menuntut perjalanan berulang ke pusat rehabilitasi ' +
         'yang belum tentu dekat dari rumah.' },
    { icon: 'hand', tone: 'violet', h: 'Kebutuhan yang berbeda',
      p: 'Tungkai sisa, kekuatan otot, dan tujuan rehabilitasi setiap orang tidak sama. ' +
         'Satu ukuran untuk semua jarang benar-benar pas.' }
  ];

  /* Empat fokus utama (Scene 10) */
  var FOKUS = [
    { icon: 'print', tone: '', h: 'Sistem modular yang dapat disesuaikan',
      p: 'Socket dan bagian tangan dapat disesuaikan dengan pengguna dan dicetak ulang ' +
         'bila rusak, tanpa mengganti seluruh alat.' },
    { icon: 'emg', tone: 'violet', h: 'Kontrol berbasis intent',
      p: 'Gerak diambil dari niat pengguna yang terbaca lewat sinyal otot permukaan ' +
         '(sEMG), lalu diterjemahkan menjadi pola cengkeram.' },
    { icon: 'haptic', tone: 'teal', h: 'Umpan balik sensorik',
      p: 'Saat jari menyentuh objek, bantalan getar di socket menyampaikan kontak dan ' +
         'kekuatan genggaman kepada pengguna.' },
    { icon: 'chart', tone: '', h: 'Pemantauan aktivitas rehabilitasi',
      p: 'Repetisi dan aktivitas latihan tercatat otomatis, lalu dapat dipantau lewat ' +
         'aplikasi pengguna dan dasbor rehabilitator.' }
  ];

  /* Metode pengembangan (Scene 11) */
  var PEMANGKU = [
    { icon: 'user', h: 'Penyandang amputasi', p: 'pengalaman memakai alat dalam aktivitas sehari-hari' },
    { icon: 'stethoscope', h: 'Fisioterapis', p: 'kebutuhan latihan dan proses rehabilitasi' },
    { icon: 'wrench', h: 'Prostetis & ortotis', p: 'kecocokan socket dan kenyamanan pemakaian' }
  ];
  var ITERASI = ['Kebutuhan', 'Desain', 'Pengembangan', 'Pengujian', 'Evaluasi'];

  /* Lima sistem terintegrasi (Scene 12) */
  var SISTEM = [
    ['Mekanik', 'Jari 14 ruas, cetak 3D PETG/PLA'],
    ['Kontrol', 'Pola cengkeram dari niat pengguna'],
    ['Sensor', '4 kanal sEMG + deteksi kontak'],
    ['Umpan balik sensorik', 'Haptik getar, 4 bantalan di socket'],
    ['Pemantauan aplikasi', 'Terhubung lewat Bluetooth LE']
  ];

  /* Pola cengkeram yang tersimpan di konfigurasi alat */
  var POLA = ['Terbuka', 'Power grip', 'Pinch', 'Tripod', 'Lateral / kunci', 'Menunjuk', 'Hook', 'Tap / ketuk'];

  /* Foto purwarupa asli, diambil dari rekaman footage tim */
  var FOTO = [
    ['genggam-bohlam', 'Menggenggam bohlam'],
    ['jari-terbuka', 'Jari terbuka penuh'],
    ['genggam-benda', 'Menjepit benda'],
    ['siku-socket', 'Sambungan siku'],
    ['telapak', 'Telapak dan lengan bawah'],
    ['mekanisme', 'Mekanisme pergelangan']
  ];

  var FITUR = [
    { icon: 'emg', tone: '', h: 'Kendali dari sinyal otot',
      p: 'Empat kanal sEMG permukaan membaca kontraksi fleksor dan ekstensor, ' +
         'lalu menerjemahkannya menjadi gerak dan gaya cengkeram proporsional.' },
    { icon: 'grip', tone: '', h: 'Delapan pola cengkeram',
      p: 'Dari power grip sampai pinch dan hook. Pola berpindah lewat isyarat otot ' +
         'singkat, tanpa perlu tangan yang lain.' },
    { icon: 'brain', tone: 'violet', h: 'Modul nyeri phantom',
      p: 'Terapi cermin digital, Graded Motor Imagery bertahap, dan diskriminasi ' +
         'sensorik — tiga pendekatan yang biasa dipakai di klinik, dibawa ke rumah.' },
    { icon: 'haptic', tone: 'teal', h: 'Umpan balik haptik',
      p: 'Bantalan getar di soket menyampaikan kekuatan genggaman, sehingga pengguna ' +
         'merasakan objek tanpa harus terus menatap tangannya.' },
    { icon: 'chart', tone: '', h: 'Analisis untuk tim klinis',
      p: 'Skor kepatuhan, tren nyeri, jam pakai, dan analisis fase A-B-A tersaji ' +
         'dalam satu dasbor yang dibagi bersama fisioterapis dan prostetis.' },
    { icon: 'print', tone: 'teal', h: 'Modular dan tercetak 3D',
      p: 'Setiap bagian dapat dicetak ulang dan ditukar sendiri: tangan, selongsong ' +
         'lengan bawah, sampai soket. Perbaikan tidak berarti mengganti seluruh alat.' }
  ];

  var LANGKAH = [
    { h: 'Socket modular', p: 'ASTA diawali socket modular yang disesuaikan dengan ' +
      'tungkai dan kebutuhan penggunanya. Tanpa operasi, tanpa implan.' },
    { h: 'Kontrol berbasis intent', p: 'Sinyal otot pengguna diproses (envelope, ' +
      'normalisasi, ambang) menjadi perintah gerak dan pola cengkeram.' },
    { h: 'Deteksi kontak', p: 'Ketika ASTA bersentuhan dengan objek, sensor mendeteksi ' +
      'kontak dan mengirimkan informasinya ke sistem.' },
    { h: 'Umpan balik sensorik', p: 'Informasi kontak diteruskan menjadi getaran haptik, ' +
      'sehingga pengguna merasakan genggamannya.' },
    { h: 'Hitung repetisi', p: 'Dalam latihan rehabilitasi, ASTA menghitung repetisi ' +
      'gerakan secara otomatis.' },
    { h: 'Pantau di aplikasi', p: 'Data aktivitas dapat dipantau lewat aplikasi pengguna ' +
      'dan dasbor rehabilitator.' }
  ];

  var SPEC = [
    ['Jenis', 'Transradial modular, non-invasif'],
    ['Akuisisi sinyal', '4 kanal sEMG permukaan'],
    ['Derajat kebebasan', '5 digit + rotasi pergelangan'],
    ['Ruas berartikulasi', '14 ruas, poros baja'],
    ['Umpan balik', 'Haptik getar, 4 bantalan'],
    ['Material', 'PETG / PLA cetak 3D'],
    ['Panjang model', '±62 cm (socket ke ujung jari)'],
    ['Konektivitas', 'Bluetooth Low Energy']
  ];

  /* Tim: peran dan foto diambil dari klip perkenalan di video profil.
     Nama sengaja belum ditulis sampai ejaan resminya dikonfirmasi tim;
     isi `name` untuk menampilkannya. */
  var TIM = [
    { name: '', role: 'Team Leader', seed: 'a1', photo: 'assets/tim/team-leader.webp' },
    { name: '', role: 'Researcher', seed: 'b2', photo: 'assets/tim/researcher-a.webp' },
    { name: '', role: 'Researcher', seed: 'c3', photo: 'assets/tim/researcher-b.webp' },
    { name: '', role: 'Software Engineer', seed: 'd4', photo: 'assets/tim/software-engineer.webp' },
    { name: '', role: 'IT Engineer', seed: 'e5', photo: 'assets/tim/it-engineer.webp' },
    { name: '', role: 'IoT Engineer', seed: 'f6', photo: 'assets/tim/iot-engineer.webp' }
  ];

  var FAQ = [
    ['Bagaimana ASTA diuji?',
     'Kegunaan ASTA dievaluasi dengan System Usability Scale (SUS), kuesioner standar ' +
     'untuk menilai seberapa mudah sebuah produk dipakai. Hasilnya menyatakan produk ' +
     'layak untuk dipakai. Karena masih purwarupa, pengujian ini belum merupakan uji klinis.'],
    ['Apakah ASTA memerlukan operasi?',
     'Tidak. ASTA memakai elektroda sEMG permukaan yang ditempel di kulit lengan bawah. ' +
     'Tidak ada implan, tidak ada prosedur bedah, dan alat dapat dilepas kapan saja.'],
    ['Apa bedanya dengan lengan prostetik biasa?',
     'Perbedaannya ada pada sisi pemantauan. Selain menggerakkan tangan dari sinyal otot, ' +
     'ASTA mencatat pemakaian, nyeri, dan kepatuhan latihan, lalu membagikannya ke ' +
     'fisioterapis dan prostetis lewat satu dasbor bersama.'],
    ['Apakah ini sudah bisa dipakai pasien?',
     'Belum. ASTA masih berstatus purwarupa penelitian dan bukan alat diagnostik. ' +
     'Aplikasi yang dapat Anda coba di sini berjalan dengan data demo dan simulator ' +
     'perangkat, bukan data pasien sungguhan.'],
    ['Bagaimana modul nyeri phantom bekerja?',
     'Modul ini membawa tiga pendekatan yang lazim di klinik ke rumah: terapi cermin ' +
     'digital, Graded Motor Imagery bertahap (pengenalan sisi, imajinasi gerak, lalu ' +
     'gerak cermin), dan latihan diskriminasi sensorik berbasis haptik.'],
    ['Ke mana data saya disimpan?',
     'Pada demo ini seluruh data tersimpan di dalam peramban Anda sendiri (localStorage) ' +
     'dan tidak dikirim ke mana pun. Tombol "Setel ulang data demo" di halaman masuk ' +
     'menghapusnya kembali.'],
    ['Bisakah desain 3D-nya saya pakai ulang?',
     'Model lengan dibuat prosedural di Blender dan skrip pembangunnya disertakan di ' +
     'dalam repositori. Berkas .blend dan .glb dapat diunduh dari halaman Studio 3D ' +
     'setelah Anda masuk.']
  ];

  /* ---------------- Pembantu markup ---------------- */

  function arrow() {
    return '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M3 8h10m0 0-4-4m4 4-4 4" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function card(f) {
    return '<article class="lp-card lp-reveal">' +
      '<span class="lp-ico ' + f.tone + '">' + Illus.icon(f.icon) + '</span>' +
      '<h3>' + U.esc(f.h) + '</h3><p>' + U.esc(f.p) + '</p></article>';
  }

  /* ---------------- Rakit halaman ---------------- */

  var masukLabel = session ? 'Buka dasbor' : 'Masuk';
  var masukHref = session && role ? role.home : 'masuk.html';

  document.body.className = 'lp';
  document.body.innerHTML =

    '<a class="skip-link" href="#utama">Lompat ke konten utama</a>' +

    /* ===================== Navigasi ===================== */
    '<header class="lp-nav" id="nav">' +
      '<div class="lp-wrap lp-nav-in">' +
        '<a class="lp-brand" href="#utama"><span class="mark">' + Shell.logo(24) + '</span>ASTA</a>' +
        '<nav class="lp-links" id="links" aria-label="Navigasi halaman">' +
          '<a href="#video">Video</a>' +
          '<a href="#masalah">Latar</a>' +
          '<a href="#fokus">Fokus</a>' +
          '<a href="#cara-kerja">Cara kerja</a>' +
          '<a href="#pengujian">Pengujian</a>' +
          '<a href="#tim">Tim</a>' +
          '<a href="#faq">FAQ</a>' +
        '</nav>' +
        '<button class="btn btn-ghost btn-icon lp-burger" id="burger" ' +
          'aria-label="Buka menu" aria-expanded="false" aria-controls="links">' +
          Icon('menu', 22) + '</button>' +
        '<a class="btn btn-primary btn-masuk" href="' + U.esc(masukHref) + '">' +
          '<span>' + masukLabel + '</span></a>' +
      '</div>' +
    '</header>' +

    '<main id="utama">' +

    /* ===================== Hero ===================== */
    '<section class="lp-hero" id="hero">' +
      '<div class="lp-wrap">' +
        '<div class="lp-hero-grid">' +
          '<div>' +
            '<span class="lp-badge"><span class="dot"></span>' +
              'Purwarupa penelitian · Lengan bionik modular non-invasif</span>' +
            '<h1 class="lp-h1">Setiap gerakan <em>memiliki arti.</em></h1>' +
            '<p>ASTA — Adaptive Sensory-feedback Telerehabilitation Arm — adalah lengan ' +
              'bionik modular non-invasif untuk mendukung aktivitas fungsional dan proses ' +
              'rehabilitasi penyandang amputasi. Lengan dan aplikasinya dirancang bersama, ' +
              'sehingga latihan di rumah dapat dipantau oleh rehabilitator.</p>' +
            '<p class="lp-tagline">Move with Purpose.</p>' +
            '<div class="lp-cta">' +
              '<a class="btn btn-primary btn-lg" href="' + U.esc(masukHref) + '">' +
                Icon('play', 19) + '<span>' +
                (session ? 'Buka dasbor' : 'Coba demo aplikasi') + '</span></a>' +
              '<a class="btn btn-lg" href="#video">' + Icon('video', 19) +
                '<span>Tonton video profil</span></a>' +
            '</div>' +
          '</div>' +
          '<div class="lp-hero-stage">' +
            '<span class="lp-stage-tag">Model 3D langsung</span>' +
            '<div id="hero-3d"></div>' +
          '</div>' +
        '</div>' +

        '<div class="lp-stats lp-reveal">' +
          STATS.map(function (s) {
            return '<div class="lp-stat"><b>' + U.esc(s.v) + '</b><span>' +
              U.esc(s.s) + '</span></div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Video profil ===================== */
    '<section class="lp-section" id="video">' +
      '<div class="lp-wrap">' +
        '<div class="lp-center">' +
          '<span class="lp-eyebrow">Video profil</span>' +
          '<h2 class="lp-h2">Kenali ASTA dalam kurang dari lima menit.</h2>' +
          '<p class="lp-lead">Dari latar belakang, metode pengembangan, cara kerja, ' +
            'sampai hasil pengujian — diceritakan langsung oleh tim.</p>' +
        '</div>' +
        '<div class="lp-video lp-reveal">' +
          '<video controls playsinline preload="none" ' +
            'poster="assets/video/asta-profil-poster.jpg" width="1280" height="720">' +
            '<source src="assets/video/asta-profil-720.mp4" type="video/mp4">' +
            'Peramban Anda tidak dapat memutar video ini.' +
          '</video>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Latar belakang ===================== */
    '<section class="lp-section lp-alt" id="masalah">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Latar belakang</span>' +
        '<h2 class="lp-h2">Teknologi asistif belum terjangkau oleh semua yang membutuhkannya.</h2>' +
        '<p class="lp-lead">Keterbatasan akses terhadap teknologi asistif masih menjadi ' +
          'salah satu tantangan bagi penyandang amputasi di Indonesia. Tiga hambatan ' +
          'yang paling sering muncul:</p>' +
        '<div class="lp-grid-3" style="margin-top:38px">' +
          MASALAH.map(card).join('') +
        '</div>' +
        '<p class="lp-callout lp-reveal">' + Icon('check', 20) +
          '<span>Dibutuhkan teknologi asistif yang <b>dapat menyesuaikan kebutuhan ' +
          'penggunanya</b>. Dari kebutuhan itulah ASTA dikembangkan.</span></p>' +
      '</div>' +
    '</section>' +

    /* ===================== Empat fokus ===================== */
    '<section class="lp-section" id="fokus">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Empat fokus utama</span>' +
        '<h2 class="lp-h2">Empat hal yang menjadi dasar setiap keputusan desain.</h2>' +
        '<div class="lp-grid-4" style="margin-top:38px">' +
          FOKUS.map(function (f, i) {
            return card(f).replace('<h3>', '<em class="lp-num">0' + (i + 1) + '</em><h3>');
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Metode ===================== */
    '<section class="lp-section lp-alt" id="metode">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Metode pengembangan</span>' +
        '<h2 class="lp-h2">User-Centered Design dan Agile Development.</h2>' +
        '<p class="lp-lead">Kebutuhan pengguna diidentifikasi lewat konsultasi dengan tiga ' +
          'pihak, diterjemahkan ke dalam desain, lalu dikembangkan secara iteratif melalui ' +
          'pengujian dan evaluasi.</p>' +
        '<div class="lp-grid-3" style="margin-top:38px">' +
          PEMANGKU.map(function (m) {
            return '<article class="lp-card lp-reveal"><span class="lp-ico teal">' +
              Icon(m.icon, 24) + '</span><h3>' + U.esc(m.h) + '</h3><p>' +
              U.esc(m.p) + '</p></article>';
          }).join('') +
        '</div>' +
        '<ol class="lp-loop lp-reveal" aria-label="Siklus pengembangan iteratif">' +
          ITERASI.map(function (t) { return '<li>' + U.esc(t) + '</li>'; }).join('') +
        '</ol>' +
        '<p class="lp-loop-note">' + Icon('refresh', 16) +
          '<span>Hasil evaluasi kembali menjadi masukan kebutuhan pada iterasi berikutnya.</span></p>' +
      '</div>' +
    '</section>' +

    /* ===================== Solusi ===================== */
    '<section class="lp-section" id="solusi">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Solusi</span>' +
        '<h2 class="lp-h2">Lengan bionik modular non-invasif dengan lima sistem terintegrasi.</h2>' +
        '<p class="lp-lead">Hasil dari proses pengembangan adalah ASTA: mekanik, kontrol, ' +
          'sensor, umpan balik sensorik, dan pemantauan aktivitas lewat aplikasi bekerja ' +
          'sebagai satu kesatuan.</p>' +
        '<div class="lp-systems lp-reveal">' +
          SISTEM.map(function (x, i) {
            return '<div><i>' + (i + 1) + '</i><b>' + U.esc(x[0]) + '</b><span>' +
              U.esc(x[1]) + '</span></div>';
          }).join('') +
        '</div>' +
        '<h3 class="lp-h3">Yang dapat dilakukan lengan dan aplikasinya</h3>' +
        '<div class="lp-grid-3" style="margin-top:38px">' +
          FITUR.map(card).join('') +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Cara kerja ===================== */
    '<section class="lp-section lp-alt" id="cara-kerja">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Cara kerja</span>' +
        '<h2 class="lp-h2">Dari socket sampai dasbor rehabilitator, dalam enam langkah.</h2>' +
        '<div class="lp-steps lp-steps-3" style="margin-top:42px">' +
          LANGKAH.map(function (s) {
            return '<div class="lp-step lp-reveal"><h3>' + U.esc(s.h) + '</h3><p>' +
              U.esc(s.p) + '</p></div>';
          }).join('') +
        '</div>' +
        '<div class="lp-flow lp-reveal">' +
          Illus.sinyal({ title: 'Jalur sinyal: kontraksi otot dibaca elektroda EMG, ' +
            'diolah menjadi jejak sinyal, lalu menjadi pola cengkeram tangan.' }) +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Teknologi ===================== */
    '<section class="lp-section" id="teknologi">' +
      '<div class="lp-wrap">' +
        '<div class="lp-tech-grid">' +
          '<div>' +
            '<span class="lp-eyebrow">Teknologi</span>' +
            '<h2 class="lp-h2">Purwarupa yang sudah bisa menggenggam.</h2>' +
            '<p class="lp-lead">Seluruh bagian dicetak 3D dan dapat ditukar sendiri. ' +
              'Foto di samping diambil dari rekaman purwarupa ASTA yang sesungguhnya, ' +
              'bukan render.</p>' +
            '<div class="lp-spec">' +
              SPEC.map(function (s) {
                return '<div><span>' + U.esc(s[0]) + '</span><b>' + U.esc(s[1]) + '</b></div>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="lp-reveal">' +
            '<div class="lp-shots lp-photos">' +
              FOTO.map(function (f) {
                return '<figure class="lp-shot"><img src="assets/foto/' + f[0] +
                  '.webp" alt="Purwarupa ASTA — ' + U.esc(f[1]) +
                  '" loading="lazy" width="1600" height="900"><figcaption>' +
                  U.esc(f[1]) + '</figcaption></figure>';
              }).join('') +
            '</div>' +
            '<div class="row center mt-4">' +
              '<a class="btn" href="' + (session ? 'model-3d.html' : 'masuk.html?next=model-3d.html') +
                '">' + Icon('grid', 18) + '<span>Jelajahi model 3D</span></a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Pengujian & manfaat ===================== */
    '<section class="lp-section lp-alt" id="pengujian">' +
      '<div class="lp-wrap">' +
        '<div class="lp-test">' +
          '<div class="lp-sus lp-reveal">' +
            '<span class="lp-eyebrow">Hasil pengujian</span>' +
            '<h2 class="lp-h2">Layak untuk dipakai.</h2>' +
            '<p class="lp-lead">Kegunaan ASTA dievaluasi dengan <b>System Usability ' +
              'Scale (SUS)</b>, kuesioner standar untuk menilai seberapa mudah sebuah ' +
              'produk dipakai. Hasilnya menyatakan produk layak untuk dipakai.</p>' +
            '<p class="t-sm muted">Pengujian kegunaan purwarupa, bukan uji klinis.</p>' +
          '</div>' +
          '<div class="lp-benefit">' +
            '<article class="lp-card lp-reveal"><span class="lp-ico">' + Icon('user', 24) +
              '</span><h3>Bagi pengguna</h3><p>Mendukung aktivitas fungsional sekaligus ' +
              'menunjang rehabilitasi. Sistem yang dapat disesuaikan dan merespons input ' +
              'pengguna menghadirkan pengalaman pemakaian yang lebih adaptif.</p></article>' +
            '<article class="lp-card lp-reveal"><span class="lp-ico teal">' +
              Icon('stethoscope', 24) + '</span><h3>Bagi rehabilitator</h3><p>Data ' +
              'aktivitas pengguna menjadi informasi tambahan untuk memantau perkembangan ' +
              'latihan dan mengevaluasi proses rehabilitasi.</p></article>' +
          '</div>' +
        '</div>' +
        '<div class="lp-diff lp-reveal">' +
          '<div><h3>Yang membedakan ASTA</h3>' +
            '<ul>' +
              '<li>' + Icon('shield', 18) + '<span><b>Non-invasif</b> — tanpa operasi, tanpa implan</span></li>' +
              '<li>' + Icon('refresh', 18) + '<span><b>Modular</b> — bagian rusak dicetak ulang, bukan ganti alat</span></li>' +
              '<li>' + Icon('link', 18) + '<span><b>Terhubung</b> — data latihan sampai ke tim rehabilitasi</span></li>' +
            '</ul></div>' +
          '<div><h3>' + POLA.length + ' pola cengkeram tersimpan</h3>' +
            '<div class="lp-chips">' +
              POLA.map(function (p) { return '<span>' + U.esc(p) + '</span>'; }).join('') +
            '</div></div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Untuk siapa ===================== */
    '<section class="lp-section" id="peran">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Untuk siapa</span>' +
        '<h2 class="lp-h2">Empat peran, satu sumber kebenaran.</h2>' +
        '<p class="lp-lead">Masuk sebagai peran mana pun untuk menelusuri demo. ' +
          'Setiap peran melihat data yang sama dari sudut pandang tugasnya.</p>' +
        '<div class="lp-grid-2" style="margin-top:38px;grid-template-columns:repeat(4,1fr)" id="peran-grid"></div>' +
      '</div>' +
    '</section>' +

    /* ===================== Tim ===================== */
    '<section class="lp-section lp-alt" id="tim">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Tim</span>' +
        '<h2 class="lp-h2">Dibangun oleh enam pelajar SMA Negeri 1 Surakarta.</h2>' +
        '<p class="lp-lead">ASTA dikerjakan lintas peran: riset, perangkat lunak, ' +
          'infrastruktur TI, dan Internet of Things.</p>' +
        '<div class="lp-team" style="margin-top:38px" id="tim-grid"></div>' +
      '</div>' +
    '</section>' +

    /* ===================== FAQ ===================== */
    '<section class="lp-section lp-alt" id="faq">' +
      '<div class="lp-wrap">' +
        '<div style="text-align:center;margin-bottom:38px">' +
          '<span class="lp-eyebrow">FAQ</span>' +
          '<h2 class="lp-h2" style="margin-inline:auto">Pertanyaan yang sering muncul.</h2>' +
        '</div>' +
        '<div class="lp-faq">' +
          FAQ.map(function (q) {
            return '<details><summary>' + U.esc(q[0]) + '</summary>' +
              '<div class="ans">' + U.esc(q[1]) + '</div></details>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Ajakan penutup ===================== */
    '<section class="lp-section">' +
      '<div class="lp-wrap">' +
        '<div class="lp-final" id="final">' +
          '<h2>ASTA hadir bukan sekadar menggantikan gerakan, tetapi membantu penggunanya ' +
            'kembali berinteraksi dengan dunia di sekitarnya.</h2>' +
          '<p>Telusuri alurnya sendiri, dari sesi latihan sampai dasbor rehabilitator. ' +
            'Demo berjalan penuh di peramban dengan simulator perangkat. Tidak perlu mendaftar.</p>' +
          '<div class="lp-cta" style="justify-content:center">' +
            '<a class="btn btn-lg btn-white" href="' + U.esc(masukHref) + '">' +
              '<span>' + (session ? 'Buka dasbor' : 'Coba demo sekarang') + '</span>' +
              arrow() + '</a>' +
            '<a class="btn btn-lg btn-outline-white" href="#video">' +
              '<span>Tonton video profil</span></a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '</main>' +

    /* ===================== Kaki ===================== */
    '<footer class="lp-foot">' +
      '<div class="lp-wrap">' +
        '<div class="lp-foot-in">' +
          '<div style="max-width:34ch">' +
            '<div class="lp-brand" style="font-size:17px"><span class="mark" ' +
              'style="width:32px;height:32px;border-radius:10px">' + Shell.logo(20) +
              '</span>ASTA</div>' +
            '<p class="t-sm muted mt-3" style="line-height:1.65">Adaptive Sensory-feedback ' +
              'Telerehabilitation Arm. Purwarupa penelitian lengan bionik modular ' +
              'non-invasif dan platform telerehabilitasinya.</p>' +
          '</div>' +
          '<div class="lp-foot-cols">' +
            '<div><h4>Produk</h4><ul>' +
              '<li><a href="#video">Video profil</a></li>' +
              '<li><a href="#solusi">Fitur</a></li>' +
              '<li><a href="#cara-kerja">Cara kerja</a></li>' +
              '<li><a href="#teknologi">Teknologi</a></li>' +
            '</ul></div>' +
            '<div><h4>Aplikasi</h4><ul>' +
              '<li><a href="masuk.html">Masuk</a></li>' +
              '<li><a href="masuk.html?next=model-3d.html">Studio 3D</a></li>' +
              '<li><a href="#peran">Peran pengguna</a></li>' +
            '</ul></div>' +
            '<div><h4>Informasi</h4><ul>' +
              '<li><a href="#masalah">Latar belakang</a></li>' +
              '<li><a href="#metode">Metode</a></li>' +
              '<li><a href="#pengujian">Pengujian</a></li>' +
              '<li><a href="#tim">Tim</a></li>' +
              '<li><a href="#faq">FAQ</a></li>' +
            '</ul></div>' +
          '</div>' +
        '</div>' +
        '<p class="lp-legal">ASTA adalah purwarupa penelitian. Bukan alat diagnostik dan ' +
          'tidak menggantikan penilaian klinis. Data pada demo ini tersimpan lokal di ' +
          'peramban Anda dan tidak dikirim ke server mana pun.</p>' +
      '</div>' +
    '</footer>';

  /* ---------------- Kartu peran ---------------- */
  U.$('#peran-grid').innerHTML = Auth.roleList().map(function (r) {
    return '<a class="lp-role lp-reveal" href="masuk.html?peran=' + U.esc(r.key) + '">' +
      '<span class="lp-ico ' + (r.color === 'teal' ? 'teal' : r.color === 'violet' ? 'violet' : '') +
        '">' + Icon(r.icon, 24) + '</span>' +
      '<h3>' + U.esc(r.label) + '</h3><p>' + U.esc(r.desc) + '</p>' +
      '<span class="go">Masuk sebagai ini ' + arrow() + '</span></a>';
  }).join('');

  /* ---------------- Kartu tim ---------------- */
  U.$('#tim-grid').innerHTML = TIM.map(function (m) {
    return '<div class="lp-member lp-reveal">' +
      '<div class="ava">' +
        (m.photo
          ? '<img src="' + U.esc(m.photo) + '" alt="Foto ' + U.esc(m.name || m.role) + ' ASTA" width="480" height="480" loading="lazy">'
          : Illus.avatar({ seed: m.seed, hijab: m.hijab })) +
      '</div>' +
      '<h3>' + U.esc(m.name || m.role) + '</h3><span>' +
        U.esc(m.name ? m.role : 'SMA Negeri 1 Surakarta') + '</span></div>';
  }).join('');

  /* ---------------- Hiasan latar ---------------- */
  var hero = U.$('#hero');
  hero.classList.add('decor-host');
  Decor.mount(hero, 'mesh', { seed: 12, pos: 'right', size: '58%' });

  var final = U.$('#final');
  final.classList.add('decor-host', 'on-dark');
  Decor.mount(final, 'wave', { seed: 6, pos: 'bottom' });

  [['#masalah', 'neuro', 19, 'violet'], ['#metode', 'orbit', 27, 'teal'],
   ['#cara-kerja', 'circuit', 61, 'primary'], ['#tim', 'grid', 40, 'teal'],
   ['#faq', 'orbit', 88, 'primary']].forEach(function (d) {
    var el = U.$(d[0]);
    if (!el) return;
    el.classList.add('decor-host');
    el.style.overflow = 'hidden';
    Decor.mount(el, d[1], { seed: d[2], tone: d[3], pos: 'corner', size: '300px' });
  });

  /* ---------------- Model 3D di hero ---------------- */
  Arm3D.create(U.$('#hero-3d'), { view: 'penuh', autoRotate: true });

  /* ---------------- Interaksi ---------------- */

  // Bilah navigasi mendapat garis batas begitu halaman digulir
  var nav = U.$('#nav');
  var onScroll = function () { nav.classList.toggle('scrolled', scrollY > 8); };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Menu ponsel
  var burger = U.$('#burger'), links = U.$('#links');
  burger.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  U.on(links, 'click', 'a', function () {
    links.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  });

  // Munculkan elemen saat masuk layar. Bila IntersectionObserver
  // tidak tersedia, semuanya langsung ditampilkan.
  var reveals = U.$$('.lp-reveal');
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }
})();
