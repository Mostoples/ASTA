/* ============================================================
   ASTA — Dekorasi SVG
   ------------------------------------------------------------
   Kumpulan motif SVG orisinil untuk menghias antarmuka. Semua
   digambar dari rumus di berkas ini (bukan aset impor), sehingga:

     - tidak menambah berkas yang harus diunduh
     - warnanya mengikuti token tema lewat currentColor
     - bentuknya deterministik: benih yang sama selalu memberi
       gambar yang sama, jadi tampilan halaman tidak berubah-ubah
       setiap kali dimuat ulang

   Semua motif murni hiasan: aria-hidden dan tidak menerima
   pointer. Tidak ada teks di dalamnya.
   ============================================================ */
(function (global) {
  'use strict';

  var Decor = {};

  /* Pembangkit acak deterministik (mulberry32). */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function n(v, d) {
    var p = Math.pow(10, d === undefined ? 2 : d);
    return Math.round(v * p) / p;
  }

  /* Bungkus baku: mengisi wadah, tidak mengganggu tata letak. */
  function wrap(w, h, body, cls) {
    return '<svg class="decor-svg ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" ' +
      'preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true" focusable="false">' +
      body + '</svg>';
  }

  /* ==========================================================
     pulse — jejak sinyal EMG
     Empat kanal envelope bertumpuk, meniru tampilan osiloskop
     pada halaman perangkat dan kalibrasi.
     ========================================================== */
  function pulse(o) {
    var W = 600, H = 200, r = rng(o.seed || 1);
    var out = '';
    for (var k = 0; k < 4; k++) {
      var base = 46 + k * 38;
      var amp = 15 + r() * 13;
      var burstAt = 0.18 + r() * 0.5;        // satu ledakan kontraksi per kanal
      var d = 'M0 ' + base;
      for (var x = 0; x <= W; x += 6) {
        var t = x / W;
        var env = Math.exp(-Math.pow((t - burstAt) / 0.13, 2));
        var noise = (r() - 0.5) * 2;
        var y = base - Math.sin(t * 34 + k * 2.1) * noise * amp * env - env * amp * 0.35;
        d += ' L' + x + ' ' + n(y, 1);
      }
      out += '<path d="M0 ' + base + ' H' + W + '" stroke="currentColor" ' +
        'stroke-width=".6" opacity=".1" stroke-dasharray="2 7"/>';
      out += '<path d="' + d + '" stroke="currentColor" stroke-width="' +
        n(1.5 - k * 0.18, 2) + '" stroke-linecap="round" opacity="' +
        n(0.42 - k * 0.07, 2) + '"/>';
    }
    return wrap(W, H, out, 'decor-pulse');
  }

  /* ==========================================================
     neuro — peta simpul saraf
     Simpul yang saling terhubung; mengacu pada reorganisasi
     korteks yang menjadi dasar terapi nyeri phantom.
     ========================================================== */
  function neuro(o) {
    var W = 520, H = 260, r = rng(o.seed || 1);
    var pts = [], i, j;
    for (i = 0; i < 22; i++) {
      pts.push({ x: 26 + r() * (W - 52), y: 22 + r() * (H - 44), s: 1.6 + r() * 3.4 });
    }
    var edges = '', dots = '';
    for (i = 0; i < pts.length; i++) {
      for (j = i + 1; j < pts.length; j++) {
        var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 96) {
          edges += '<line x1="' + n(pts[i].x, 1) + '" y1="' + n(pts[i].y, 1) +
            '" x2="' + n(pts[j].x, 1) + '" y2="' + n(pts[j].y, 1) +
            '" stroke="currentColor" stroke-width=".85" opacity="' +
            n(0.3 * (1 - dist / 96), 3) + '"/>';
        }
      }
      dots += '<circle cx="' + n(pts[i].x, 1) + '" cy="' + n(pts[i].y, 1) + '" r="' +
        n(pts[i].s, 1) + '" fill="currentColor" opacity="' + n(0.16 + r() * 0.3, 2) + '"/>';
    }
    return wrap(W, H, edges + dots, 'decor-neuro');
  }

  /* ==========================================================
     circuit — jalur papan sirkuit
     Rute bersudut 45 derajat dengan bantalan solder di ujungnya.
     ========================================================== */
  function circuit(o) {
    var W = 520, H = 240, r = rng(o.seed || 1), out = '';
    for (var k = 0; k < 9; k++) {
      var x = 10 + r() * 90;
      var y = 16 + k * 26 + r() * 8;
      var cx = x, cy = y;
      var d = 'M' + n(x, 1) + ' ' + n(y, 1);
      var steps = 3 + Math.floor(r() * 4);
      for (var s = 0; s < steps; s++) {
        var run = 40 + r() * 80;
        d += ' h' + n(run, 1);
        cx += run;
        if (s < steps - 1) {
          var dz = (r() > 0.5 ? 1 : -1) * (12 + r() * 16);
          d += ' l' + n(Math.abs(dz), 1) + ' ' + n(dz, 1);
          cx += Math.abs(dz);
          cy += dz;
        }
      }
      out += '<path d="' + d + '" stroke="currentColor" stroke-width="1.15" ' +
        'stroke-linecap="round" stroke-linejoin="round" opacity="' +
        n(0.16 + r() * 0.16, 2) + '"/>';
      out += '<circle cx="' + n(cx, 1) + '" cy="' + n(cy, 1) +
        '" r="3.2" stroke="currentColor" stroke-width="1.1" opacity="' +
        n(0.22 + r() * 0.2, 2) + '"/>';
    }
    return wrap(W, H, out, 'decor-circuit');
  }

  /* ==========================================================
     orbit — busur sepusat
     Cincin terpotong bergaya pengukur untuk halaman progres.
     ========================================================== */
  function orbit(o) {
    var W = 320, H = 320, r = rng(o.seed || 1), cx = W / 2, cy = H / 2, out = '';
    for (var k = 0; k < 7; k++) {
      var rad = 32 + k * 20;
      var start = r() * Math.PI * 2;
      var sweep = 0.7 + r() * 3.4;
      var x1 = cx + Math.cos(start) * rad, y1 = cy + Math.sin(start) * rad;
      var x2 = cx + Math.cos(start + sweep) * rad, y2 = cy + Math.sin(start + sweep) * rad;
      out += '<path d="M' + n(x1, 1) + ' ' + n(y1, 1) + ' A' + rad + ' ' + rad +
        ' 0 ' + (sweep > Math.PI ? 1 : 0) + ' 1 ' + n(x2, 1) + ' ' + n(y2, 1) +
        '" stroke="currentColor" stroke-width="' + n(1.1 + r() * 2.6, 2) +
        '" stroke-linecap="round" opacity="' + n(0.12 + r() * 0.22, 2) + '"/>';
      out += '<circle cx="' + n(x2, 1) + '" cy="' + n(y2, 1) + '" r="' +
        n(2 + r() * 2.4, 1) + '" fill="currentColor" opacity="' +
        n(0.2 + r() * 0.25, 2) + '"/>';
    }
    return wrap(W, H, out, 'decor-orbit');
  }

  /* ==========================================================
     wave — pita gelombang berlapis
     Lengkungan tenang untuk terapi cermin dan halaman jadwal.
     ========================================================== */
  function wave(o) {
    var W = 600, H = 200, r = rng(o.seed || 1), out = '';
    for (var k = 0; k < 5; k++) {
      var base = 60 + k * 26;
      var amp = 14 + r() * 12;
      var freq = 1.1 + r() * 1.6;
      var phase = r() * Math.PI * 2;
      var d = 'M0 ' + n(base, 1);
      for (var x = 0; x <= W; x += 10) {
        d += ' L' + x + ' ' + n(base + Math.sin(x / W * Math.PI * 2 * freq + phase) * amp, 1);
      }
      out += '<path d="' + d + '" stroke="currentColor" stroke-width="' +
        n(1.4 - k * 0.15, 2) + '" stroke-linecap="round" opacity="' +
        n(0.3 - k * 0.045, 2) + '"/>';
    }
    return wrap(W, H, out, 'decor-wave');
  }

  /* ==========================================================
     bars — siluet data
     Batang dengan tren naik landai, untuk halaman kepatuhan.
     ========================================================== */
  function bars(o) {
    var W = 480, H = 200, r = rng(o.seed || 1), out = '';
    var count = 26, gap = W / count;
    for (var i = 0; i < count; i++) {
      var trend = 0.32 + (i / count) * 0.4;
      var h = Math.max(10, Math.min(H - 20, (trend + (r() - 0.5) * 0.34) * H * 0.82));
      out += '<rect x="' + n(i * gap + gap * 0.22, 1) + '" y="' + n(H - h, 1) +
        '" width="' + n(gap * 0.5, 1) + '" height="' + n(h, 1) +
        '" rx="' + n(gap * 0.25, 1) + '" fill="currentColor" opacity="' +
        n(0.09 + (i / count) * 0.16, 2) + '"/>';
    }
    return wrap(W, H, out, 'decor-bars');
  }

  /* ==========================================================
     grid — kisi titik memudar
     Motif netral serba guna; kerapatan menurun ke satu sisi.
     ========================================================== */
  function grid(o) {
    // Satu ubin <pattern> dengan mask gradien: hasilnya sama dengan
    // menggambar ratusan lingkaran, tetapi markupnya tetap ringkas.
    var W = 480, H = 240, id = 'g' + (o.seed || 0);
    var body =
      '<defs>' +
        '<pattern id="' + id + 'p" width="18" height="18" patternUnits="userSpaceOnUse">' +
          '<circle cx="9" cy="9" r="1.7" fill="currentColor"/>' +
        '</pattern>' +
        '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0%" stop-color="#fff" stop-opacity=".85"/>' +
          '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<mask id="' + id + 'm"><rect width="' + W + '" height="' + H +
          '" fill="url(#' + id + 'g)"/></mask>' +
      '</defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'p)" ' +
        'mask="url(#' + id + 'm)" opacity=".3"/>';
    return wrap(W, H, body, 'decor-grid');
  }

  /* ==========================================================
     digits — kontur lima jari
     Lengkung ruas jari bergaya untuk halaman yang berkaitan
     langsung dengan tangan bionik.
     ========================================================== */
  function digits(o) {
    var W = 300, H = 240, out = '';
    var spec = [
      { x: 58, len: 96, tilt: -26 }, { x: 106, len: 150, tilt: -9 },
      { x: 150, len: 164, tilt: 0 }, { x: 194, len: 148, tilt: 8 },
      { x: 234, len: 116, tilt: 19 }
    ];
    spec.forEach(function (f, i) {
      var rad = f.tilt * Math.PI / 180;
      var tipX = f.x + Math.sin(rad) * f.len;
      var tipY = 196 - Math.cos(rad) * f.len;
      out += '<path d="M' + f.x + ' 196 Q' +
        n(f.x + Math.sin(rad) * f.len * 0.45, 1) + ' ' + n(196 - f.len * 0.55, 1) + ' ' +
        n(tipX, 1) + ' ' + n(tipY, 1) + '" stroke="currentColor" stroke-width="' +
        n(9 - i * 0.5, 1) + '" stroke-linecap="round" opacity=".13"/>';
      for (var s = 1; s <= 2; s++) {
        var t = s / 3;
        out += '<circle cx="' + n(f.x + Math.sin(rad) * f.len * t, 1) + '" cy="' +
          n(196 - Math.cos(rad) * f.len * t, 1) +
          '" r="2.4" fill="currentColor" opacity=".2"/>';
      }
    });
    out += '<rect x="44" y="188" width="204" height="40" rx="19" ' +
      'stroke="currentColor" stroke-width="2" opacity=".16"/>';
    return wrap(W, H, out, 'decor-digits');
  }

  /* ==========================================================
     shield — lapisan perisai
     Untuk halaman pengaturan, privasi, dan administrasi.
     ========================================================== */
  function shield(o) {
    var W = 260, H = 280, out = '';
    for (var k = 0; k < 4; k++) {
      var s = 1 - k * 0.16;
      var w = 92 * s, h = 112 * s, cx = 130, cy = 132;
      out += '<path d="M' + cx + ' ' + n(cy - h, 1) +
        ' L' + n(cx + w, 1) + ' ' + n(cy - h * 0.62, 1) +
        ' L' + n(cx + w, 1) + ' ' + n(cy + h * 0.18, 1) +
        ' Q' + n(cx + w, 1) + ' ' + n(cy + h * 0.78, 1) + ' ' + cx + ' ' + n(cy + h, 1) +
        ' Q' + n(cx - w, 1) + ' ' + n(cy + h * 0.78, 1) + ' ' + n(cx - w, 1) + ' ' + n(cy + h * 0.18, 1) +
        ' L' + n(cx - w, 1) + ' ' + n(cy - h * 0.62, 1) + ' Z" ' +
        'stroke="currentColor" stroke-width="1.6" opacity="' + n(0.24 - k * 0.05, 2) + '"/>';
    }
    return wrap(W, H, out, 'decor-shield');
  }

  /* ==========================================================
     timeline — blok waktu
     Kotak jadwal berulang untuk halaman jadwal dan notifikasi.
     ========================================================== */
  function timeline(o) {
    var W = 460, H = 220, r = rng(o.seed || 1), out = '';
    out += '<path d="M0 40 H' + W + '" stroke="currentColor" stroke-width="1" opacity=".14"/>';
    for (var i = 0; i < 12; i++) {
      var x = 18 + i * 38;
      out += '<path d="M' + x + ' 32 V48" stroke="currentColor" stroke-width="1.4" ' +
        'stroke-linecap="round" opacity="' + (i % 3 === 0 ? '.3' : '.14') + '"/>';
      if (r() > 0.42) {
        var row = 70 + Math.floor(r() * 3) * 34;
        var w = 26 + r() * 52;
        out += '<rect x="' + x + '" y="' + row + '" width="' + n(w, 1) +
          '" height="20" rx="9" fill="currentColor" opacity="' + n(0.07 + r() * 0.12, 3) + '"/>';
      }
    }
    return wrap(W, H, out, 'decor-timeline');
  }

  /* ==========================================================
     mesh — gradasi lembut untuk latar hero
     Beberapa lingkaran kabur bertumpuk; menggantikan gambar
     latar bitmap pada landing page.
     ========================================================== */
  function mesh(o) {
    var W = 800, H = 500, r = rng(o.seed || 1);
    var cols = o.colors || ['#2b6cde', '#10a5a5', '#7a5af8'];
    var id = 'mesh' + (o.seed || 0);
    var body = '<defs><filter id="' + id + '" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feGaussianBlur stdDeviation="52"/></filter></defs><g filter="url(#' + id + ')">';
    for (var k = 0; k < 6; k++) {
      body += '<circle cx="' + n(r() * W, 1) + '" cy="' + n(r() * H, 1) + '" r="' +
        n(70 + r() * 130, 1) + '" fill="' + cols[k % cols.length] + '" opacity="' +
        n(0.2 + r() * 0.3, 2) + '"/>';
    }
    return wrap(W, H, body + '</g>', 'decor-mesh');
  }

  var MOTIFS = {
    pulse: pulse, neuro: neuro, circuit: circuit, orbit: orbit, wave: wave,
    bars: bars, grid: grid, digits: digits, shield: shield,
    timeline: timeline, mesh: mesh
  };

  /* Motif per halaman — dipilih menurut makna halaman, bukan acak:
     halaman sinyal memakai jejak EMG, halaman nyeri memakai peta
     simpul saraf, dan seterusnya. Benih dikunci agar gambar stabil. */
  var PAGE = {
    'pasien-dashboard.html': ['pulse', 71, 'primary'],
    'terapis-dashboard.html': ['bars', 12, 'teal'],
    'prostetis-dashboard.html': ['circuit', 44, 'primary'],
    'admin-dashboard.html': ['shield', 8, 'violet'],
    'sesi-latihan.html': ['digits', 3, 'primary'],
    'catatan-nyeri.html': ['neuro', 19, 'violet'],
    'terapi-phantom.html': ['wave', 27, 'violet'],
    'perangkat.html': ['circuit', 61, 'primary'],
    'kalibrasi.html': ['pulse', 35, 'teal'],
    'model-3d.html': ['digits', 52, 'primary'],
    'progres.html': ['orbit', 88, 'teal'],
    'jadwal.html': ['timeline', 5, 'primary'],
    'notifikasi.html': ['timeline', 64, 'primary'],
    'pengaturan.html': ['shield', 23, 'violet'],
    'terapis-pasien.html': ['grid', 40, 'teal'],
    'terapis-program.html': ['bars', 77, 'primary'],
    'terapis-kepatuhan.html': ['orbit', 15, 'teal'],
    'terapis-nyeri.html': ['neuro', 90, 'violet']
  };

  /**
   * Markup satu motif.
   * @param {string} name kunci pada MOTIFS
   * @param {object} opts { seed, colors }
   */
  Decor.svg = function (name, opts) {
    var fn = MOTIFS[name] || MOTIFS.grid;
    return fn(opts || {});
  };

  Decor.names = function () { return Object.keys(MOTIFS); };

  /** Motif yang ditetapkan untuk sebuah halaman, atau null. */
  Decor.forPage = function (file) {
    var e = PAGE[file];
    return e ? { name: e[0], seed: e[1], tone: e[2] } : null;
  };

  /**
   * Pasang motif sebagai lapisan hiasan di dalam sebuah elemen.
   * @param {HTMLElement} host
   * @param {string} name
   * @param {object} opts { seed, tone, pos, size, colors }
   */
  Decor.mount = function (host, name, opts) {
    if (!host || !name) return null;
    var o = opts || {};
    var layer = document.createElement('div');
    layer.className = 'decor-layer' +
      (o.tone ? ' decor-' + o.tone : '') +
      (o.pos ? ' decor-at-' + o.pos : '');
    if (o.size) layer.style.setProperty('--decor-size', o.size);
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = Decor.svg(name, o);
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.insertBefore(layer, host.firstChild);
    return layer;
  };

  global.Decor = Decor;
})(window);
