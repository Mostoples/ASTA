/* ============================================================
   ASTA — Ilustrasi SVG
   ------------------------------------------------------------
   Ilustrasi foreground orisinil: gambar yang menjelaskan sesuatu,
   bukan sekadar hiasan latar (untuk itu ada js/lib/decor.js).

   Semua digambar dari koordinat di berkas ini. Warna memakai
   variabel CSS lewat atribut style pada elemen pembungkus,
   sehingga ilustrasi ikut tema tanpa perlu berkas terpisah.

   Setiap fungsi mengembalikan string SVG. Bila ilustrasi memuat
   informasi (bukan hiasan), berikan opts.title supaya pembaca
   layar mendapat keterangannya.
   ============================================================ */
(function (global) {
  'use strict';

  var Illus = {};
  var uid = 0;

  function svg(vb, body, o) {
    o = o || {};
    var id = 'il' + (++uid);
    var a11y = o.title
      ? ' role="img" aria-labelledby="' + id + 't"'
      : ' aria-hidden="true" focusable="false"';
    return '<svg class="illus ' + (o.cls || '') + '" viewBox="' + vb + '" fill="none"' +
      a11y + ' xmlns="http://www.w3.org/2000/svg">' +
      (o.title ? '<title id="' + id + 't">' + o.title + '</title>' : '') +
      body + '</svg>';
  }

  /* Palet: mengacu token tema, dengan nilai cadangan agar ilustrasi
     tetap benar bila dipakai di luar konteks aplikasi. */
  var C = {
    ink: 'var(--illus-ink, #16233a)',
    line: 'var(--illus-line, #a9bcd4)',
    soft: 'var(--illus-soft, #dde6f3)',
    pri: 'var(--illus-pri, #2b6cde)',
    priS: 'var(--illus-pri-soft, #d3e4ff)',
    teal: 'var(--illus-teal, #10a5a5)',
    violet: 'var(--illus-violet, #7a5af8)',
    white: 'var(--illus-white, #ffffff)'
  };

  /* ==========================================================
     lengan — skema garis lengan bionik ASTA
     Mengikuti proporsi model Blender: cangkir socket, cangkang
     siku, lengan bawah meruncing, pergelangan, tangan lima jari.
     ========================================================== */
  Illus.lengan = function (o) {
    o = o || {};
    var b =
      /* Cangkir socket humeral — gelap, mulutnya menghadap ke kiri
         supaya terbaca sebagai cangkir, bukan sekadar tonjolan. */
      '<path d="M40 44 h-14 a20 30 0 0 0 0 60 h14z" fill="' + C.ink + '" opacity=".88"/>' +
      '<ellipse cx="26" cy="74" rx="7" ry="30" fill="' + C.ink + '"/>' +
      '<ellipse cx="26" cy="74" rx="4.5" ry="24" fill="' + C.soft + '" opacity=".35"/>' +

      // Braket putih penghubung socket ke siku
      '<rect x="38" y="58" width="22" height="32" rx="8" fill="' + C.white + '" ' +
        'stroke="' + C.line + '" stroke-width="2"/>' +

      // Cangkang siku (ovoid putih)
      '<ellipse cx="94" cy="74" rx="36" ry="31" fill="' + C.white + '" ' +
        'stroke="' + C.line + '" stroke-width="2"/>' +
      '<path d="M74 54 a30 31 0 0 0 0 40" stroke="' + C.soft + '" stroke-width="3" ' +
        'stroke-linecap="round"/>' +
      // Cincin pemisah gelap di ujung distal siku
      '<path d="M128 60 a34 31 0 0 1 0 28" stroke="' + C.ink + '" stroke-width="5" ' +
        'stroke-linecap="round" opacity=".85"/>' +

      // Lengan bawah meruncing ke pergelangan
      '<path d="M128 58 L238 66 L238 82 L128 90 Z" fill="' + C.ink + '" opacity=".9"/>' +
      // Bilah terang di sisi bawah, seperti dua warna pada purwarupa
      '<path d="M128 86 L238 79 L238 82 L128 90 Z" fill="' + C.white + '" opacity=".22"/>' +

      // Elektroda EMG (empat kanal)
      '<circle cx="152" cy="66" r="4.4" fill="' + C.teal + '"/>' +
      '<circle cx="178" cy="66" r="4.4" fill="' + C.teal + '" opacity=".72"/>' +
      '<circle cx="152" cy="84" r="4.4" fill="' + C.teal + '" opacity=".5"/>' +
      '<circle cx="178" cy="84" r="4.4" fill="' + C.teal + '" opacity=".5"/>' +

      // Cincin pergelangan cepat-lepas
      '<rect x="238" y="60" width="20" height="28" rx="8" fill="' + C.white + '" ' +
        'stroke="' + C.line + '" stroke-width="2"/>' +

      // Telapak + pelat punggung tangan
      '<rect x="258" y="50" width="48" height="46" rx="13" fill="' + C.ink + '" opacity=".9"/>' +
      '<rect x="270" y="60" width="24" height="18" rx="5" fill="' + C.white + '" opacity=".85"/>' +

      // Empat jari, panjangnya berbeda seperti proporsi tangan
      '<g stroke="' + C.ink + '" stroke-width="9" stroke-linecap="round" opacity=".88">' +
        '<path d="M306 58 h24"/>' +
        '<path d="M306 70 h30"/>' +
        '<path d="M306 82 h26"/>' +
        '<path d="M304 93 h18"/>' +
      '</g>' +
      // Ibu jari beroposisi dari sisi bawah telapak
      '<path d="M268 96 q4 18 22 21" stroke="' + C.ink + '" stroke-width="9" ' +
        'stroke-linecap="round" opacity=".88"/>';
    return svg('0 0 350 132', b, { title: o.title, cls: 'illus-lengan ' + (o.cls || '') });
  };

  /* ==========================================================
     sinyal — jalur sinyal: otot -> elektroda -> pola cengkeram
     Dipakai di bagian "Cara kerja".
     ========================================================== */
  Illus.sinyal = function (o) {
    o = o || {};
    var wave = 'M0 30';
    for (var x = 0; x <= 120; x += 3) {
      var t = x / 120;
      var env = Math.exp(-Math.pow((t - 0.45) / 0.18, 2));
      var y = 30 - Math.sin(x * 0.9) * 18 * env;
      wave += ' L' + x + ' ' + Math.round(y * 10) / 10;
    }
    var b =
      // Penampang lengan bawah dengan dua berkas otot
      '<circle cx="46" cy="46" r="34" fill="' + C.soft + '" stroke="' + C.line + '" stroke-width="2"/>' +
      '<ellipse cx="36" cy="36" rx="13" ry="9" fill="' + C.pri + '" opacity=".28" ' +
        'transform="rotate(-24 36 36)"/>' +
      '<ellipse cx="57" cy="55" rx="12" ry="8" fill="' + C.violet + '" opacity=".26" ' +
        'transform="rotate(-24 57 55)"/>' +
      // Bantalan elektroda pada permukaan kulit
      '<circle cx="24" cy="30" r="5" fill="' + C.teal + '"/>' +
      '<circle cx="46" cy="14" r="5" fill="' + C.teal + '" opacity=".7"/>' +
      '<circle cx="70" cy="34" r="5" fill="' + C.teal + '" opacity=".55"/>' +
      '<circle cx="60" cy="76" r="5" fill="' + C.teal + '" opacity=".55"/>' +
      // Panah ke jejak sinyal
      '<path d="M86 46 h20" stroke="' + C.line + '" stroke-width="2" stroke-linecap="round" ' +
        'stroke-dasharray="3 4"/>' +
      // Jejak sinyal
      '<g transform="translate(112 16)">' +
        '<rect x="-4" y="-4" width="128" height="68" rx="12" fill="' + C.white + '" ' +
          'stroke="' + C.line + '" stroke-width="1.6"/>' +
        '<path d="' + wave + '" stroke="' + C.pri + '" stroke-width="2.2" ' +
          'stroke-linecap="round" transform="translate(0 12)"/>' +
      '</g>' +
      // Panah ke tangan
      '<path d="M246 46 h20" stroke="' + C.line + '" stroke-width="2" stroke-linecap="round" ' +
        'stroke-dasharray="3 4"/>' +
      // Tangan bionik yang menggenggam: telapak, empat jari melengkung
      // ke dalam, dan ibu jari beroposisi dari sisi bawah.
      '<g transform="translate(268 16)" opacity=".88">' +
        '<rect x="0" y="12" width="30" height="32" rx="9" fill="' + C.ink + '"/>' +
        '<rect x="7" y="18" width="15" height="11" rx="3" fill="' + C.white + '" opacity=".8"/>' +
        '<g stroke="' + C.ink + '" stroke-width="5.4" stroke-linecap="round" fill="none">' +
          '<path d="M30 17 q13 1 12 8 q-1 6 -10 6"/>' +
          '<path d="M30 25 q14 1 13 8 q-1 6 -11 6"/>' +
          '<path d="M30 33 q12 1 11 7 q-1 5 -9 5"/>' +
          '<path d="M5 44 q1 11 12 13"/>' +
        '</g>' +
      '</g>';
    return svg('0 0 340 96', b, { title: o.title, cls: 'illus-sinyal' });
  };

  /* ==========================================================
     telerehab — lingkar pemantauan pasien <-> klinik
     Tiga simpul: rumah pasien, awan data, tim klinis.
     ========================================================== */
  Illus.telerehab = function (o) {
    o = o || {};
    function node(cx, cy, r, fill) {
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + C.white + '" ' +
        'stroke="' + C.line + '" stroke-width="2"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 9) + '" fill="' + fill + '" opacity=".18"/>';
    }
    var b =
      // Jalur data melengkung antar simpul
      '<path d="M62 96 Q150 40 238 96" stroke="' + C.pri + '" stroke-width="2" ' +
        'stroke-dasharray="5 6" opacity=".6"/>' +
      '<path d="M62 104 Q150 160 238 104" stroke="' + C.teal + '" stroke-width="2" ' +
        'stroke-dasharray="5 6" opacity=".6"/>' +
      node(62, 100, 34, C.pri) +
      node(238, 100, 34, C.teal) +
      // Kiri: rumah pasien + lengan
      '<path d="M48 106 v-12 l14-11 14 11 v12 z" stroke="' + C.pri + '" stroke-width="2.2" ' +
        'stroke-linejoin="round"/>' +
      '<path d="M56 106 v-8 h12 v8" stroke="' + C.pri + '" stroke-width="2"/>' +
      // Kanan: stetoskop yang disederhanakan
      '<path d="M228 88 v10 a10 10 0 0 0 20 0 v-10" stroke="' + C.teal + '" stroke-width="2.2" ' +
        'stroke-linecap="round"/>' +
      '<circle cx="228" cy="86" r="3" fill="' + C.teal + '"/>' +
      '<circle cx="248" cy="86" r="3" fill="' + C.teal + '"/>' +
      '<circle cx="238" cy="114" r="6" stroke="' + C.teal + '" stroke-width="2.2"/>' +
      // Tengah: paket data
      '<rect x="128" y="52" width="44" height="30" rx="10" fill="' + C.white + '" ' +
        'stroke="' + C.line + '" stroke-width="2"/>' +
      '<path d="M138 62 h24 M138 70 h16" stroke="' + C.pri + '" stroke-width="2.4" ' +
        'stroke-linecap="round"/>' +
      '<rect x="128" y="118" width="44" height="30" rx="10" fill="' + C.white + '" ' +
        'stroke="' + C.line + '" stroke-width="2"/>' +
      '<path d="M138 128 h24 M138 136 h16" stroke="' + C.teal + '" stroke-width="2.4" ' +
        'stroke-linecap="round"/>';
    return svg('0 0 300 200', b, { title: o.title, cls: 'illus-telerehab' });
  };

  /* ==========================================================
     cermin — terapi cermin / Graded Motor Imagery
     Tangan utuh dan bayangannya, dipisah garis cermin.
     ========================================================== */
  Illus.cermin = function (o) {
    o = o || {};
    function hand(tx, flip, opacity) {
      return '<g transform="translate(' + tx + ' 60)' + (flip ? ' scale(-1 1)' : '') +
        '" opacity="' + opacity + '">' +
        '<rect x="0" y="0" width="40" height="34" rx="11" fill="' + C.pri + '" opacity=".85"/>' +
        '<path d="M40 6 h20 M40 15 h24 M40 24 h20" stroke="' + C.pri + '" stroke-width="7" ' +
          'stroke-linecap="round" opacity=".85"/>' +
        '<path d="M10 34 q2 14 16 16" stroke="' + C.pri + '" stroke-width="7" ' +
          'stroke-linecap="round" opacity=".85"/>' +
        '</g>';
    }
    var b =
      // Bidang cermin
      '<rect x="146" y="14" width="8" height="152" rx="4" fill="' + C.priS + '"/>' +
      '<path d="M150 14 v152" stroke="' + C.pri + '" stroke-width="2" opacity=".5" ' +
        'stroke-dasharray="6 7"/>' +
      hand(56, false, '1') +
      hand(244, true, '.42') +
      // Kilau pantulan
      '<path d="M160 34 l16 -12 M160 58 l24 -18" stroke="' + C.white + '" ' +
        'stroke-width="3" stroke-linecap="round" opacity=".8"/>';
    return svg('0 0 300 180', b, { title: o.title, cls: 'illus-cermin' });
  };

  /* ==========================================================
     avatar — potret geometris parametrik
     Dipakai pada bagian Tim sampai foto asli tersedia. Bentuknya
     ditentukan oleh benih, jadi setiap orang punya wajah tetap
     yang berbeda tanpa perlu berkas gambar.
     ========================================================== */
  Illus.avatar = function (o) {
    o = o || {};
    var str = String(o.seed || o.name || 'asta');
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    /* Tiap ciri diambil dari potongan bit yang berbeda, bukan dari
       deret berurutan. Dengan cara ini dua benih yang mirip tetap
       menghasilkan wajah yang jelas berbeda. */
    var slot = function (shift, arr) {
      return arr[(h >>> shift) % arr.length];
    };

    var skin = slot(0, ['#f0d7bd', '#e8c9a8', '#d8ab86', '#c08e63', '#a97244', '#8d5b34']);
    var hair = slot(5, ['#2a2118', '#3d2c1d', '#1c1a19', '#4a3527', '#5b4632']);
    var shirt = slot(9, [C.pri, C.teal, C.violet, '#1f57bb', '#0e8f8f']);
    var hijab = !!o.hijab;
    var glasses = ((h >>> 14) & 3) < 2;          // sekitar separuh berkacamata
    var hairStyle = (h >>> 17) % 3;              // pendek / belah / bergelombang

    var b =
      '<circle cx="60" cy="60" r="60" fill="' + shirt + '" opacity=".14"/>' +
      // Bahu / jas lab
      '<path d="M18 120 a42 42 0 0 1 84 0z" fill="' + C.white + '"/>' +
      '<path d="M18 120 a42 42 0 0 1 20 -33 l22 33z" fill="' + shirt + '" opacity=".22"/>' +
      '<path d="M102 120 a42 42 0 0 0 -20 -33 l-22 33z" fill="' + shirt + '" opacity=".22"/>' +
      '<path d="M52 87 h16 l-8 16z" fill="' + shirt + '"/>' +
      // Leher
      '<rect x="52" y="72" width="16" height="18" rx="7" fill="' + skin + '"/>';

    if (hijab) {
      b += '<path d="M60 22 a26 30 0 0 1 26 32 q0 22 -8 34 h-36 q-8 -12 -8 -34 a26 30 0 0 1 26 -32z" ' +
        'fill="' + slot(21, ['#e6eefb', '#dff3f0', '#efe9ff', '#f3f6fb', '#e9f0e6']) + '"/>' +
        '<ellipse cx="60" cy="54" rx="17" ry="20" fill="' + skin + '"/>';
    } else {
      b += '<ellipse cx="60" cy="54" rx="20" ry="23" fill="' + skin + '"/>';
      if (hairStyle === 0) {            // cepak
        b += '<path d="M40 50 a20 22 0 0 1 40 0 q-6 -12 -20 -12 t-20 12z" fill="' + hair + '"/>';
      } else if (hairStyle === 1) {     // belah samping
        b += '<path d="M40 52 a20 23 0 0 1 40 -2 q-4 -14 -19 -14 q-9 0 -13 6 q7 3 9 8 q-9 3 -17 2z" ' +
          'fill="' + hair + '"/>';
      } else {                          // bergelombang
        b += '<path d="M39 54 q-2 -22 21 -22 t21 22 q-3 -8 -8 -6 q-3 -9 -13 -9 t-13 9 q-5 -2 -8 6z" ' +
          'fill="' + hair + '"/>';
      }
    }

    // Mata & senyum
    b += '<circle cx="53" cy="54" r="2.4" fill="' + C.ink + '"/>' +
      '<circle cx="68" cy="54" r="2.4" fill="' + C.ink + '"/>' +
      '<path d="M54 64 q6 5 12 0" stroke="' + C.ink + '" stroke-width="2" ' +
        'stroke-linecap="round" opacity=".7"/>';

    if (glasses) {
      b += '<g stroke="' + C.ink + '" stroke-width="1.8" opacity=".62">' +
        '<circle cx="53" cy="54" r="7"/><circle cx="68" cy="54" r="7"/>' +
        '<path d="M60 54 h1"/></g>';
    }

    return svg('0 0 120 120', b, { title: o.title, cls: 'illus-avatar' });
  };

  /* ==========================================================
     Ikon fitur — set garis 48x48, gaya seragam
     Berbeda dari js/lib/icons.js yang berukuran UI kecil; yang
     ini lebih besar dan lebih berdetail untuk kartu fitur.
     ========================================================== */
  var FEATURE = {
    emg: '<path d="M4 24h7l4-12 6 24 5-16 3 4h11" stroke-width="2.6"/>' +
         '<circle cx="10" cy="24" r="2.6" fill="currentColor" stroke="none"/>',
    grip: '<rect x="8" y="18" width="17" height="16" rx="5" stroke-width="2.4"/>' +
          '<path d="M25 22h9M25 27h11M25 32h8" stroke-width="3.4" stroke-linecap="round"/>' +
          '<path d="M12 34q2 7 9 8" stroke-width="3.4" stroke-linecap="round"/>',
    brain: '<path d="M20 10a6 6 0 0 0-6 6 5 5 0 0 0-3 9 5 5 0 0 0 4 8 6 6 0 0 0 5 5V10z" stroke-width="2.3"/>' +
           '<path d="M28 10a6 6 0 0 1 6 6 5 5 0 0 1 3 9 5 5 0 0 1-4 8 6 6 0 0 1-5 5V10z" stroke-width="2.3"/>' +
           '<path d="M24 10v28" stroke-width="2.3"/>',
    haptic: '<circle cx="24" cy="24" r="5" stroke-width="2.4"/>' +
            '<path d="M32 16a11 11 0 0 1 0 16M16 32a11 11 0 0 1 0-16" stroke-width="2.4" stroke-linecap="round"/>' +
            '<path d="M37 11a17 17 0 0 1 0 26M11 37a17 17 0 0 1 0-26" stroke-width="2.2" ' +
              'stroke-linecap="round" opacity=".55"/>',
    chart: '<path d="M8 38V22M18 38V12M28 38V26M38 38V17" stroke-width="3.4" stroke-linecap="round"/>' +
           '<path d="M6 42h36" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>',
    cloud: '<path d="M15 34a8 8 0 0 1 .6-16 11 11 0 0 1 20.8 4A7 7 0 0 1 35 34z" stroke-width="2.4" ' +
             'stroke-linejoin="round"/>' +
           '<path d="M24 22v12m0 0-4-4m4 4 4-4" stroke-width="2.4" stroke-linecap="round"/>',
    print: '<path d="M14 18V9h20v9" stroke-width="2.4" stroke-linejoin="round"/>' +
           '<rect x="8" y="18" width="32" height="14" rx="4" stroke-width="2.4"/>' +
           '<path d="M14 32v8h20v-8" stroke-width="2.4" stroke-linejoin="round"/>' +
           '<circle cx="33" cy="24" r="1.8" fill="currentColor" stroke="none"/>',
    shield: '<path d="M24 6l15 6v11c0 10-6.4 16.4-15 19-8.6-2.6-15-9-15-19V12z" stroke-width="2.4" ' +
              'stroke-linejoin="round"/>' +
            '<path d="M17 24l5 5 9-10" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  /**
   * Ikon fitur 48x48.
   * @param {string} name kunci pada FEATURE
   */
  Illus.icon = function (name, o) {
    o = o || {};
    var body = FEATURE[name] || FEATURE.chart;
    return '<svg class="illus-icon ' + (o.cls || '') + '" viewBox="0 0 48 48" fill="none" ' +
      'stroke="currentColor" stroke-linecap="round" aria-hidden="true" focusable="false">' +
      body + '</svg>';
  };

  Illus.iconNames = function () { return Object.keys(FEATURE); };

  /* ==========================================================
     Ilustrasi keadaan kosong
     ------------------------------------------------------------
     Dipakai UI.empty() ketika sebuah daftar belum berisi apa pun.
     Semuanya berbagi satu bahasa bentuk: gundukan lembut sebagai
     alas, obyek bergaris di atasnya, dan satu aksen warna supaya
     tidak terasa seperti pesan galat.
     ========================================================== */

  /* Alas berbentuk gundukan, dipakai semua adegan */
  function ground() {
    return '<ellipse cx="90" cy="112" rx="58" ry="9" fill="' + C.soft + '" opacity=".85"/>';
  }

  var EMPTY = {
    /* Kotak terbuka — makna umum "belum ada isinya" */
    kotak: ground() +
      '<path d="M46 62 h88 l-10 44 h-68z" stroke="' + C.line + '" stroke-width="2.4" ' +
        'stroke-linejoin="round" fill="' + C.white + '"/>' +
      '<path d="M40 48 h100 v14 h-100z" stroke="' + C.line + '" stroke-width="2.4" ' +
        'stroke-linejoin="round" fill="' + C.soft + '"/>' +
      '<path d="M90 48 v58" stroke="' + C.line + '" stroke-width="1.6" opacity=".55"/>' +
      '<circle cx="62" cy="30" r="4" fill="' + C.pri + '" opacity=".4"/>' +
      '<circle cx="112" cy="24" r="5.5" fill="' + C.pri + '" opacity=".26"/>' +
      '<circle cx="90" cy="36" r="3" fill="' + C.teal + '" opacity=".45"/>',

    /* Kalender tanpa agenda */
    jadwal: ground() +
      '<rect x="46" y="30" width="88" height="76" rx="10" fill="' + C.white + '" ' +
        'stroke="' + C.line + '" stroke-width="2.4"/>' +
      '<path d="M46 50 h88" stroke="' + C.line + '" stroke-width="2.4"/>' +
      '<path d="M64 24 v14 M116 24 v14" stroke="' + C.line + '" stroke-width="3.4" ' +
        'stroke-linecap="round"/>' +
      '<g fill="' + C.soft + '">' +
        '<rect x="58" y="60" width="14" height="10" rx="3"/>' +
        '<rect x="80" y="60" width="14" height="10" rx="3"/>' +
        '<rect x="102" y="60" width="14" height="10" rx="3"/>' +
        '<rect x="58" y="78" width="14" height="10" rx="3"/>' +
        '<rect x="102" y="78" width="14" height="10" rx="3"/>' +
      '</g>' +
      '<rect x="80" y="78" width="14" height="10" rx="3" fill="' + C.pri + '" opacity=".3"/>',

    /* Dokumen bergaris dengan sudut terlipat */
    catatan: ground() +
      '<path d="M56 24 h48 l22 22 v60 a6 6 0 0 1-6 6 H56 a6 6 0 0 1-6-6 V30 a6 6 0 0 1 6-6z" ' +
        'fill="' + C.white + '" stroke="' + C.line + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M104 24 v16 a6 6 0 0 0 6 6 h16" stroke="' + C.line + '" stroke-width="2.4" ' +
        'stroke-linejoin="round"/>' +
      '<path d="M64 58 h44 M64 70 h48 M64 82 h30" stroke="' + C.soft + '" ' +
        'stroke-width="4.5" stroke-linecap="round"/>' +
      '<circle cx="120" cy="88" r="13" fill="' + C.white + '" stroke="' + C.pri + '" ' +
        'stroke-width="2.4" opacity=".85"/>' +
      '<path d="M120 82 v12 M114 88 h12" stroke="' + C.pri + '" stroke-width="2.4" ' +
        'stroke-linecap="round"/>',

    /* Medali — untuk capaian yang belum diraih */
    lencana: ground() +
      '<path d="M70 24 l12 30 M110 24 l-12 30" stroke="' + C.line + '" stroke-width="3" ' +
        'stroke-linecap="round"/>' +
      '<circle cx="90" cy="72" r="30" fill="' + C.white + '" stroke="' + C.line + '" stroke-width="2.4"/>' +
      '<circle cx="90" cy="72" r="19" stroke="' + C.soft + '" stroke-width="3" ' +
        'stroke-dasharray="5 6"/>' +
      '<path d="M90 62 l3.2 6.6 7.3 1-5.3 5.2 1.3 7.2-6.5-3.4-6.5 3.4 1.3-7.2-5.3-5.2 7.3-1z" ' +
        'fill="' + C.pri + '" opacity=".28"/>',

    /* Lonceng — untuk notifikasi kosong */
    lonceng: ground() +
      '<path d="M90 26 a24 24 0 0 1 24 24 v18 l8 12 H58 l8-12 V50 a24 24 0 0 1 24-24z" ' +
        'fill="' + C.white + '" stroke="' + C.line + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M82 80 a8 8 0 0 0 16 0" stroke="' + C.line + '" stroke-width="2.4" ' +
        'stroke-linecap="round"/>' +
      '<path d="M90 20 v6" stroke="' + C.line + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M126 34 q8 6 8 14 M54 34 q-8 6-8 14" stroke="' + C.pri + '" stroke-width="2.4" ' +
        'stroke-linecap="round" opacity=".35"/>',

    /* Sumbu grafik dengan garis datar — belum ada tren */
    grafik: ground() +
      '<path d="M46 26 v76 h94" stroke="' + C.line + '" stroke-width="2.4" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M56 80 h74" stroke="' + C.pri + '" stroke-width="2.6" stroke-linecap="round" ' +
        'stroke-dasharray="7 7" opacity=".45"/>' +
      '<g fill="' + C.soft + '">' +
        '<rect x="58" y="86" width="12" height="10" rx="3"/>' +
        '<rect x="80" y="86" width="12" height="10" rx="3"/>' +
        '<rect x="102" y="86" width="12" height="10" rx="3"/>' +
        '<rect x="124" y="86" width="12" height="10" rx="3"/>' +
      '</g>' +
      '<circle cx="130" cy="52" r="4" fill="' + C.teal + '" opacity=".4"/>' +
      '<circle cx="108" cy="42" r="3" fill="' + C.pri + '" opacity=".3"/>',

    /* Perisai bercentang — untuk catatan akses / privasi kosong */
    perisai: ground() +
      '<path d="M90 22 l32 13 v24c0 21-13.6 34.8-32 40-18.4-5.2-32-19-32-40V35z" ' +
        'fill="' + C.white + '" stroke="' + C.line + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M78 62 l9 9 17-19" stroke="' + C.pri + '" stroke-width="3.4" ' +
        'stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>',

    /* Jendela panggilan video — untuk telekonsultasi kosong */
    panggilan: ground() +
      '<rect x="40" y="34" width="76" height="54" rx="10" fill="' + C.white + '" ' +
        'stroke="' + C.line + '" stroke-width="2.4"/>' +
      '<path d="M116 52 l24-12 v42 l-24-12z" fill="' + C.soft + '" stroke="' + C.line + '" ' +
        'stroke-width="2.4" stroke-linejoin="round"/>' +
      '<circle cx="78" cy="55" r="10" stroke="' + C.line + '" stroke-width="2.4"/>' +
      '<path d="M62 78 a16 16 0 0 1 32 0" stroke="' + C.line + '" stroke-width="2.4" ' +
        'stroke-linecap="round"/>' +
      '<circle cx="52" cy="45" r="3.4" fill="' + C.pri + '" opacity=".4"/>',

    /* Tangan bionik istirahat — untuk daftar sesi / perangkat kosong */
    tangan: ground() +
      '<rect x="52" y="52" width="40" height="40" rx="12" fill="' + C.white + '" ' +
        'stroke="' + C.line + '" stroke-width="2.4"/>' +
      '<rect x="62" y="62" width="20" height="14" rx="4" fill="' + C.soft + '"/>' +
      '<g stroke="' + C.line + '" stroke-width="7" stroke-linecap="round">' +
        '<path d="M92 60 h20"/><path d="M92 71 h24"/><path d="M92 82 h19"/>' +
      '</g>' +
      '<path d="M58 92 q2 12 14 14" stroke="' + C.line + '" stroke-width="7" ' +
        'stroke-linecap="round"/>' +
      '<circle cx="120" cy="40" r="4" fill="' + C.teal + '" opacity=".45"/>' +
      '<circle cx="106" cy="30" r="2.6" fill="' + C.pri + '" opacity=".35"/>'
  };

  /* Ikon lama pada pemanggilan UI.empty yang sudah ada dipetakan ke
     adegan yang paling dekat maknanya, sehingga 26 titik pemakaian
     ikut terangkat tanpa perlu diubah satu per satu. */
  var EMPTY_BY_ICON = {
    calendar: 'jadwal', clock: 'jadwal',
    clipboard: 'catatan', file: 'catatan', edit: 'catatan',
    award: 'lencana', star: 'lencana', target: 'lencana',
    bell: 'lonceng', message: 'lonceng',
    chart: 'grafik', trend: 'grafik', bars: 'grafik', pulse: 'grafik',
    shield: 'perisai', lock: 'perisai', eye: 'perisai',
    video: 'panggilan', camera: 'panggilan', phone: 'panggilan',
    hand: 'tangan', activity: 'tangan', cpu: 'tangan',
    bluetooth: 'tangan', sliders: 'tangan', brain: 'catatan'
  };

  /**
   * Ilustrasi keadaan kosong.
   * @param {string} name nama adegan, atau nama ikon lama (dipetakan)
   */
  Illus.kosong = function (name, o) {
    o = o || {};
    var key = EMPTY[name] ? name : (EMPTY_BY_ICON[name] || 'kotak');
    return svg('0 0 180 130', EMPTY[key], { title: o.title, cls: 'illus-empty' });
  };

  Illus.kosongNames = function () { return Object.keys(EMPTY); };

  global.Illus = Illus;
})(window);
