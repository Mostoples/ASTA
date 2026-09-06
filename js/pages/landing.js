/* ============================================================
   ASTA — Landing page publik
   Halaman terbuka (tanpa autentikasi) yang memperkenalkan ASTA.
   Seluruh gambar di halaman ini adalah SVG yang dibangkitkan
   js/lib/illustrations.js dan js/lib/decor.js, kecuali render
   Blender pada bagian Teknologi.

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

  var MASALAH = [
    { icon: 'brain', tone: 'violet', h: 'Nyeri phantom jarang tertangani',
      p: 'Nyeri pada anggota tubuh yang sudah tiada kerap berlanjut bertahun-tahun. ' +
         'Penanganannya menuntut latihan rutin yang terpandu, bukan obat semata.' },
    { icon: 'grip', tone: '', h: 'Lengan prostetik sering ditinggalkan',
      p: 'Alat yang terasa berat, lambat, atau sulit dikendalikan berakhir di lemari. ' +
         'Tanpa pemantauan, tim klinis tidak tahu kapan pemakaian mulai menurun.' },
    { icon: 'cloud', tone: 'teal', h: 'Layanan rehabilitasi jauh dari rumah',
      p: 'Kontrol rutin menuntut perjalanan berulang ke pusat rehabilitasi. ' +
         'Banyak sesi latihan akhirnya berjalan tanpa pengawasan sama sekali.' }
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
    { h: 'Pasang elektroda', p: 'Empat bantalan sEMG ditempel pada titik otot yang ' +
      'sudah ditandai prostetis. Tanpa operasi, tanpa implan.' },
    { h: 'Kalibrasi', p: 'Wizard tiga langkah mengukur baseline dan kontraksi maksimum ' +
      'hari itu, lalu menyetel ambang secara otomatis.' },
    { h: 'Latihan terpandu', p: 'Aplikasi memandu sesi harian sesuai resep terapis, ' +
      'menghitung repetisi, dan mencatat nyeri sesudahnya.' },
    { h: 'Tim klinis memantau', p: 'Hasil sesi langsung terlihat di dasbor terapis, ' +
      'sehingga program dapat disesuaikan tanpa menunggu kontrol berikutnya.' }
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

  /* Tim: avatar SVG dulu. Nama sengaja ditandai sebagai isian
     sementara supaya tidak terbaca sebagai identitas sungguhan.
     Ganti `placeholder: false` beserta nama & perannya bila data
     asli sudah tersedia. */
  var TIM = [
    { name: 'Nama anggota 1', role: 'Ketua tim · Riset klinis', seed: 'a1', hijab: false, placeholder: true },
    { name: 'Nama anggota 2', role: 'Desain mekanik & cetak 3D', seed: 'b2', hijab: true, placeholder: true },
    { name: 'Nama anggota 3', role: 'Elektronika & sinyal EMG', seed: 'c3', hijab: false, placeholder: true },
    { name: 'Nama anggota 4', role: 'Perangkat lunak & data', seed: 'd4', hijab: true, placeholder: true }
  ];

  var FAQ = [
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
          '<a href="#masalah">Masalah</a>' +
          '<a href="#solusi">Solusi</a>' +
          '<a href="#cara-kerja">Cara kerja</a>' +
          '<a href="#teknologi">Teknologi</a>' +
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
            '<h1 class="lp-h1">Lengan bionik yang <em>terhubung</em> dengan tim klinis Anda.</h1>' +
            '<p>ASTA — Adaptive Sensory-feedback Telerehabilitation Arm — menggabungkan ' +
              'lengan prostetik cetak 3D berkendali sinyal otot dengan platform ' +
              'telerehabilitasi. Fokusnya dua hal yang paling sering luput: nyeri phantom ' +
              'dan kepatuhan terapi jangka panjang.</p>' +
            '<div class="lp-cta">' +
              '<a class="btn btn-primary btn-lg" href="' + U.esc(masukHref) + '">' +
                Icon('play', 19) + '<span>' +
                (session ? 'Buka dasbor' : 'Coba demo aplikasi') + '</span></a>' +
              '<a class="btn btn-lg" href="#teknologi">' + Icon('grid', 19) +
                '<span>Lihat model 3D</span></a>' +
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

    /* ===================== Masalah ===================== */
    '<section class="lp-section lp-alt" id="masalah">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Masalah</span>' +
        '<h2 class="lp-h2">Kehilangan tangan tidak berakhir di ruang operasi.</h2>' +
        '<p class="lp-lead">Tiga hambatan yang berulang kali muncul dalam rehabilitasi ' +
          'penyandang amputasi ekstremitas atas — dan ketiganya saling memperberat.</p>' +
        '<div class="lp-grid-3" style="margin-top:38px">' +
          MASALAH.map(card).join('') +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Solusi ===================== */
    '<section class="lp-section" id="solusi">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Solusi</span>' +
        '<h2 class="lp-h2">Satu alat, satu aplikasi, satu tim yang melihat hal yang sama.</h2>' +
        '<p class="lp-lead">Lengan dan platformnya dirancang bersamaan, sehingga setiap ' +
          'gerakan yang dilakukan di rumah punya jejak yang dapat dibaca di klinik.</p>' +
        '<div class="lp-grid-3" style="margin-top:38px">' +
          FITUR.map(card).join('') +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Cara kerja ===================== */
    '<section class="lp-section lp-alt" id="cara-kerja">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Cara kerja</span>' +
        '<h2 class="lp-h2">Dari niat gerak sampai catatan klinis, dalam empat langkah.</h2>' +
        '<div class="lp-steps" style="margin-top:42px">' +
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
            '<h2 class="lp-h2">Dirancang prosedural, dicetak sendiri.</h2>' +
            '<p class="lp-lead">Geometri lengan dibangun lewat skrip di Blender, bukan ' +
              'dipahat manual. Satu angka diubah, seluruh model tercetak ulang konsisten — ' +
              'penting untuk alat yang harus pas dengan tubuh yang berbeda-beda.</p>' +
            '<div class="lp-spec">' +
              SPEC.map(function (s) {
                return '<div><span>' + U.esc(s[0]) + '</span><b>' + U.esc(s[1]) + '</b></div>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="lp-reveal">' +
            '<div class="lp-shots">' +
              [['01-lengan-penuh', 'Lengan penuh'], ['02-tangan-genggam', 'Power grip'],
               ['03-tangan-jepit', 'Pinch'], ['04-siku-socket', 'Siku & socket']]
                .map(function (s) {
                  return '<figure class="lp-shot"><img src="' + R + 'hero/' + s[0] +
                    '.jpg" alt="Render 3D ASTA — ' + U.esc(s[1]) +
                    '" loading="lazy" width="1200" height="1200"></figure>';
                }).join('') +
            '</div>' +
            '<div class="row center mt-4">' +
              '<a class="btn" href="' + (session ? 'model-3d.html' : 'masuk.html?next=model-3d.html') +
                '">' + Icon('grid', 18) + '<span>Buka Studio 3D</span></a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ===================== Untuk siapa ===================== */
    '<section class="lp-section lp-alt" id="peran">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Untuk siapa</span>' +
        '<h2 class="lp-h2">Empat peran, satu sumber kebenaran.</h2>' +
        '<p class="lp-lead">Masuk sebagai peran mana pun untuk menelusuri demo. ' +
          'Setiap peran melihat data yang sama dari sudut pandang tugasnya.</p>' +
        '<div class="lp-grid-2" style="margin-top:38px;grid-template-columns:repeat(4,1fr)" id="peran-grid"></div>' +
      '</div>' +
    '</section>' +

    /* ===================== Tim ===================== */
    '<section class="lp-section" id="tim">' +
      '<div class="lp-wrap">' +
        '<span class="lp-eyebrow">Tim</span>' +
        '<h2 class="lp-h2">Dibangun oleh tim riset pelajar.</h2>' +
        '<p class="lp-lead">ASTA dikerjakan lintas disiplin: riset klinis, desain mekanik, ' +
          'elektronika, dan perangkat lunak.</p>' +
        '<div class="lp-team" style="margin-top:38px" id="tim-grid"></div>' +
        '<p class="lp-note">' + Icon('info', 18) +
          '<span><b>Isian sementara.</b> Nama dan potret di atas masih berupa penanda. ' +
          'Simpan foto tim ke <code>assets/tim/</code> lalu perbarui daftar ' +
          '<code>TIM</code> di <code>js/pages/landing.js</code> untuk menggantinya.</span></p>' +
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
          '<h2>Telusuri seluruh alurnya, dari sesi latihan sampai dasbor klinis.</h2>' +
          '<p>Demo berjalan penuh di peramban Anda dengan simulator perangkat dan data ' +
            'penelitian bawaan. Tidak perlu mendaftar.</p>' +
          '<div class="lp-cta" style="justify-content:center">' +
            '<a class="btn btn-lg btn-white" href="' + U.esc(masukHref) + '">' +
              '<span>' + (session ? 'Buka dasbor' : 'Coba demo sekarang') + '</span>' +
              arrow() + '</a>' +
            '<a class="btn btn-lg btn-outline-white" href="#teknologi">' +
              '<span>Pelajari teknologinya</span></a>' +
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
              '<li><a href="#masalah">Latar masalah</a></li>' +
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
    return '<div class="lp-member lp-reveal' + (m.placeholder ? ' placeholder' : '') + '">' +
      '<div class="ava">' +
        (m.photo
          ? '<img src="' + U.esc(m.photo) + '" alt="" width="96" height="96">'
          : Illus.avatar({ seed: m.seed, hijab: m.hijab })) +
      '</div>' +
      '<h3>' + U.esc(m.name) + '</h3><span>' + U.esc(m.role) + '</span></div>';
  }).join('');

  /* ---------------- Hiasan latar ---------------- */
  var hero = U.$('#hero');
  hero.classList.add('decor-host');
  Decor.mount(hero, 'mesh', { seed: 12, pos: 'right', size: '58%' });

  var final = U.$('#final');
  final.classList.add('decor-host', 'on-dark');
  Decor.mount(final, 'wave', { seed: 6, pos: 'bottom' });

  [['#masalah', 'neuro', 19, 'violet'], ['#cara-kerja', 'circuit', 61, 'primary'],
   ['#tim', 'grid', 40, 'teal'], ['#faq', 'orbit', 88, 'primary']].forEach(function (d) {
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
