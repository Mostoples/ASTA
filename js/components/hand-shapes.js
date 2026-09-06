/* ============================================================
   ASTA — Hand Shapes
   Gambar tangan untuk latihan pengenalan sisi kiri/kanan
   (Graded Motor Imagery tahap 1 / limb laterality recognition).

   Gambar dibuat prosedural: satu bentuk dasar tangan kanan,
   lalu dicerminkan untuk tangan kiri, dan diputar/dimiringkan
   secara acak agar tugas menuntut rotasi mental — inti dari
   latihan ini.
   ============================================================ */
(function (global) {
  'use strict';

  var HandShapes = {};

  /* Varian pose agar tugas tidak monoton */
  var POSES = [
    { key: 'open', label: 'terbuka', digits: [0, 0, 0, 0, 0] },
    { key: 'fist', label: 'mengepal', digits: [0.85, 1, 1, 1, 1] },
    { key: 'pinch', label: 'menjumput', digits: [0.8, 0.85, 0.1, 0.05, 0] },
    { key: 'point', label: 'menunjuk', digits: [0.8, 0, 1, 1, 1] },
    { key: 'three', label: 'tiga jari', digits: [0.7, 0, 0, 0, 1] }
  ];

  /* Sudut rotasi & kemiringan untuk menuntut rotasi mental */
  var ROTATIONS = [0, 35, 70, 110, 145, 180, 215, 250, 290, 325];
  var VIEWS = ['dorsal', 'palmar'];   // punggung tangan / telapak

  var FINGERS = [
    { x: 30, y: 118, w: 17, segs: [26, 22], base: -42, max: 48 },
    { x: 66, y: 62, w: 15, segs: [32, 24, 18], base: 0, max: 74 },
    { x: 90, y: 54, w: 16, segs: [36, 26, 19], base: 0, max: 76 },
    { x: 114, y: 60, w: 15, segs: [32, 24, 18], base: 0, max: 76 },
    { x: 136, y: 72, w: 13, segs: [25, 19, 15], base: 0, max: 78 }
  ];

  /**
   * Bangun satu soal laterality.
   * @returns {object} { side:'kiri'|'kanan', svg, pose, rotation, view }
   */
  HandShapes.randomTrial = function () {
    var side = Math.random() < 0.5 ? 'kiri' : 'kanan';
    var pose = U.pick(POSES);
    var rotation = U.pick(ROTATIONS);
    var view = U.pick(VIEWS);
    return {
      side: side,
      pose: pose.key,
      poseLabel: pose.label,
      rotation: rotation,
      view: view,
      svg: HandShapes.render(side, pose.digits, rotation, view)
    };
  };

  /**
   * Render SVG tangan.
   * @param {string} side 'kiri' | 'kanan'
   * @param {number[]} digits lima nilai 0..1
   * @param {number} rotation derajat
   * @param {string} view 'dorsal' | 'palmar'
   */
  HandShapes.render = function (side, digits, rotation, view) {
    var d = digits || [0, 0, 0, 0, 0];
    // Tangan kanan = bentuk dasar. Tangan kiri = pencerminan horizontal.
    // Tampilan palmar juga mencerminkan, sehingga kombinasi keduanya
    // membuat tugas benar-benar menuntut rotasi mental.
    var mirrored = (side === 'kiri') !== (view === 'palmar');

    var fingers = FINGERS.map(function (f, i) {
      return segMarkup(f, U.clamp(d[i] || 0, 0, 1));
    }).join('');

    var skin = view === 'palmar' ? '#f4dfd2' : '#eed5c6';
    var line = '#c9a893';

    return '<svg viewBox="0 0 200 230" role="img" ' +
      'aria-label="Gambar tangan untuk ditentukan sisinya">' +
      '<g transform="rotate(' + rotation + ' 100 130)">' +
      '<g' + (mirrored ? ' transform="translate(200,0) scale(-1,1)"' : '') + '>' +
      // Pergelangan
      '<rect x="72" y="176" width="52" height="42" rx="16" fill="' + skin +
      '" stroke="' + line + '" stroke-width="2"/>' +
      // Telapak
      '<path d="M52 74 Q46 58 60 56 L140 62 Q156 66 154 84 L150 146 Q148 182 118 184 L82 184 ' +
      'Q52 182 52 146 Z" fill="' + skin + '" stroke="' + line + '" stroke-width="2"/>' +
      // Detail palmar: garis telapak (memberi petunjuk sisi)
      (view === 'palmar'
        ? '<path d="M66 96 Q94 112 120 100" fill="none" stroke="' + line +
          '" stroke-width="1.6" opacity=".7"/>' +
          '<path d="M62 118 Q88 132 116 124" fill="none" stroke="' + line +
          '" stroke-width="1.6" opacity=".55"/>'
        : '<path d="M78 96 v54 M100 92 v58 M122 96 v52" stroke="' + line +
          '" stroke-width="1.4" opacity=".38"/>') +
      fingers +
      '</g></g></svg>';
  };

  function segMarkup(f, bend) {
    function seg(i) {
      if (i >= f.segs.length) return '';
      var len = f.segs[i];
      var w = f.w * (1 - i * 0.13);
      var factor = 0.6 + i * 0.28;
      var ang = f.base + bend * f.max * factor;
      var inner = seg(i + 1);
      return '<g transform="rotate(' + U.round(ang, 1) + ')">' +
        '<rect x="' + (-w / 2) + '" y="' + (-len) + '" width="' + w + '" height="' + (len + 5) +
        '" rx="' + (w / 2) + '" fill="#eed5c6" stroke="#c9a893" stroke-width="1.8"/>' +
        (inner ? '<g transform="translate(0,' + (-len) + ')">' + inner + '</g>' : '') +
        '</g>';
    }
    return '<g transform="translate(' + f.x + ',' + f.y + ')">' + seg(0) + '</g>';
  }

  /** Rangkaian soal dengan jumlah kiri/kanan seimbang */
  HandShapes.buildSet = function (n) {
    var count = n || 20;
    var out = [];
    for (var i = 0; i < count; i++) out.push(HandShapes.randomTrial());
    // Seimbangkan agar tidak semua satu sisi
    var kiri = out.filter(function (t) { return t.side === 'kiri'; }).length;
    var need = Math.round(count / 2) - kiri;
    var idx = 0;
    while (need !== 0 && idx < out.length) {
      var want = need > 0 ? 'kanan' : 'kiri';
      if (out[idx].side === want) {
        var newSide = need > 0 ? 'kiri' : 'kanan';
        var pose = U.pick(POSES);
        out[idx] = {
          side: newSide, pose: pose.key, poseLabel: pose.label,
          rotation: out[idx].rotation, view: out[idx].view,
          svg: HandShapes.render(newSide, pose.digits, out[idx].rotation, out[idx].view)
        };
        need += need > 0 ? -1 : 1;
      }
      idx++;
    }
    return out;
  };

  /** Gambar tangan statis untuk panduan imajinasi gerak (GMI-2) */
  HandShapes.guide = function (poseKey, side) {
    var pose = POSES.find(function (p) { return p.key === poseKey; }) || POSES[0];
    return HandShapes.render(side || 'kanan', pose.digits, 0, 'dorsal');
  };

  HandShapes.POSES = POSES;

  global.HandShapes = HandShapes;
})(window);
