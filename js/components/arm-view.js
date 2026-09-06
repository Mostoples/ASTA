/* ============================================================
   ASTA — Visualisasi Lengan Bionik (SVG animatif)
   Jari bergerak mengikuti pose dari Device (hasil sinyal EMG).
   ============================================================ */
(function (global) {
  'use strict';

  var ArmView = {};

  /* Definisi jari: posisi pangkal, panjang segmen, sudut maksimum */
  var FINGERS = [
    { key: 'thumb',  x: 34,  y: 150, w: 19, segs: [30, 26],     baseRot: -38, maxBend: 52 },
    { key: 'index',  x: 74,  y: 84,  w: 17, segs: [36, 27, 20], baseRot: 0,   maxBend: 76 },
    { key: 'middle', x: 100, y: 76,  w: 18, segs: [40, 29, 21], baseRot: 0,   maxBend: 78 },
    { key: 'ring',   x: 126, y: 82,  w: 17, segs: [36, 27, 20], baseRot: 0,   maxBend: 78 },
    { key: 'pinky',  x: 150, y: 94,  w: 15, segs: [28, 22, 17], baseRot: 0,   maxBend: 80 }
  ];

  /**
   * Render lengan ke dalam elemen container.
   * @param {HTMLElement} host
   * @param {object} opts { showLabels, interactive }
   */
  ArmView.create = function (host, opts) {
    if (!host) return null;
    var o = opts || {};

    // Sisipkan ke wadah sendiri, bukan menimpa innerHTML host.
    // Host sering memuat elemen lain (badge status, indikator gaya)
    // yang tidak boleh terhapus saat lengan dirender ulang.
    var mount = host.querySelector('[data-armview]');
    if (!mount) {
      mount = document.createElement('div');
      mount.setAttribute('data-armview', '1');
      mount.style.cssText = 'width:100%;display:grid;place-items:center';
      host.appendChild(mount);
    }
    mount.innerHTML = svgMarkup(o);
    var svg = mount.querySelector('svg');
    var groups = {};
    FINGERS.forEach(function (f) {
      groups[f.key] = [];
      for (var i = 0; i < f.segs.length; i++) {
        groups[f.key].push(svg.querySelector('[data-seg="' + f.key + '-' + i + '"]'));
      }
    });
    var wristGroup = svg.querySelector('[data-wrist]');
    var forceGlow = svg.querySelector('[data-glow]');
    var hapticRing = svg.querySelector('[data-haptic]');
    var offPose = null, offHaptic = null;

    var api = {
      svg: svg,
      /** pose: [thumb, index, middle, ring, pinky] 0..1 */
      setPose: function (pose, force, wristDeg) {
        FINGERS.forEach(function (f, idx) {
          var v = U.clamp(pose[idx] || 0, 0, 1);
          var segs = groups[f.key];
          for (var i = 0; i < segs.length; i++) {
            if (!segs[i]) continue;
            // Segmen distal menekuk lebih tajam (biomekanik jari)
            var factor = 0.55 + i * 0.3;
            var ang = f.baseRot + v * f.maxBend * factor;
            segs[i].setAttribute('transform', 'rotate(' + U.round(ang, 1) + ')');
          }
        });
        if (forceGlow) {
          var f2 = U.clamp((force || 0) / 100, 0, 1);
          forceGlow.setAttribute('opacity', U.round(f2 * 0.6, 2));
          forceGlow.setAttribute('r', String(22 + f2 * 16));
        }
        if (wristGroup && wristDeg !== undefined) {
          wristGroup.setAttribute('transform', 'rotate(' + U.round(wristDeg * 0.35, 1) + ' 100 190)');
        }
      },
      pulseHaptic: function (padIndex, intensity) {
        if (!hapticRing) return;
        hapticRing.setAttribute('opacity', String(U.clamp((intensity || 50) / 100, 0.15, 0.85)));
        hapticRing.setAttribute('r', '30');
        // Animasi denyut
        var start = performance.now();
        function step(t) {
          var p = U.clamp((t - start) / 420, 0, 1);
          hapticRing.setAttribute('r', String(30 + p * 34));
          hapticRing.setAttribute('opacity', String((1 - p) * 0.7));
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      },
      destroy: function () {
        if (offPose) offPose();
        if (offHaptic) offHaptic();
        mount.remove();
      }
    };

    // Sinkron otomatis dengan Device
    offPose = Device.on('pose', function (d) {
      api.setPose(d.pose, d.force, d.wrist);
    });
    offHaptic = Device.on('haptic', function (h) {
      if (h.intensity > 0) api.pulseHaptic(h.pad, h.intensity);
    });

    // Set posisi awal
    api.setPose(Device.state.gripPose, Device.state.force, Device.state.wristRot);
    return api;
  };

  function svgMarkup(o) {
    var fingersSvg = FINGERS.map(function (f) {
      return fingerMarkup(f);
    }).join('');

    return '' +
      '<svg viewBox="0 0 200 300" role="img" aria-label="Visualisasi lengan bionik ASTA yang bergerak mengikuti sinyal otot">' +
      '<defs>' +
      '<linearGradient id="mtl" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#fbfdff"/><stop offset="46%" stop-color="#dde6f3"/>' +
      '<stop offset="100%" stop-color="#b9c9de"/></linearGradient>' +
      '<linearGradient id="mtl2" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#eef3fb"/><stop offset="100%" stop-color="#c3d2e5"/></linearGradient>' +
      '<linearGradient id="sock" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#2b6cde"/><stop offset="100%" stop-color="#17428f"/></linearGradient>' +
      '<radialGradient id="glowg"><stop offset="0%" stop-color="#2b6cde" stop-opacity=".85"/>' +
      '<stop offset="100%" stop-color="#2b6cde" stop-opacity="0"/></radialGradient>' +
      '</defs>' +

      '<g data-wrist>' +
      // Socket / lengan bawah
      '<rect x="72" y="196" width="56" height="86" rx="20" fill="url(#sock)"/>' +
      '<rect x="78" y="204" width="44" height="10" rx="5" fill="#ffffff" opacity=".26"/>' +
      '<rect x="78" y="220" width="44" height="6" rx="3" fill="#ffffff" opacity=".16"/>' +
      // Label elektroda EMG
      '<circle cx="84" cy="246" r="5.5" fill="#a8ffe8" opacity=".92" data-electrode="ch1"/>' +
      '<circle cx="116" cy="246" r="5.5" fill="#a8ffe8" opacity=".55" data-electrode="ch2"/>' +
      '<circle cx="84" cy="264" r="5.5" fill="#a8ffe8" opacity=".38" data-electrode="ch3"/>' +
      '<circle cx="116" cy="264" r="5.5" fill="#a8ffe8" opacity=".38" data-electrode="ch4"/>' +

      // Sendi pergelangan
      '<rect x="76" y="180" width="48" height="24" rx="11" fill="url(#mtl2)" stroke="#a9bcd4" stroke-width="1.4"/>' +
      '<circle cx="100" cy="192" r="6" fill="#8fa6c2"/>' +
      '<circle cx="100" cy="192" r="2.6" fill="#eef3fb"/>' +

      // Cahaya gaya cengkeram
      '<circle data-glow cx="100" cy="140" r="22" fill="url(#glowg)" opacity="0"/>' +
      '<circle data-haptic cx="100" cy="150" r="30" fill="none" stroke="#7a5af8" stroke-width="3" opacity="0"/>' +

      // Telapak
      '<g class="arm-palm">' +
      '<path d="M62 92 Q58 78 70 76 L152 84 Q166 88 164 104 L160 152 Q158 182 128 184 L84 184 Q60 182 60 152 Z" ' +
      'fill="url(#mtl)" stroke="#a9bcd4" stroke-width="1.6"/>' +
      '<path d="M70 100 L152 106" stroke="#c4d2e4" stroke-width="1.4"/>' +
      '<rect x="86" y="120" width="30" height="22" rx="6" fill="#dbe5f2" stroke="#b7c7dc" stroke-width="1.2"/>' +
      '<circle cx="101" cy="131" r="4.4" fill="#2b6cde" opacity=".72"/>' +
      '</g>' +

      fingersSvg +
      '</g>' +
      '</svg>';
  }

  function fingerMarkup(f) {
    // Susun segmen bersarang agar rotasi bertumpuk seperti sendi nyata
    function seg(i) {
      if (i >= f.segs.length) return '';
      var len = f.segs[i];
      var w = f.w * (1 - i * 0.12);
      var inner = seg(i + 1);
      return '<g data-seg="' + f.key + '-' + i + '" style="transform-origin:0 0" class="finger-seg">' +
        '<rect x="' + (-w / 2) + '" y="' + (-len) + '" width="' + w + '" height="' + (len + 4) + '" rx="' + (w / 2) +
        '" fill="url(#mtl)" stroke="#a9bcd4" stroke-width="1.4"/>' +
        // Sendi
        '<circle cx="0" cy="0" r="' + (w / 2.6) + '" fill="#c9d6e7" stroke="#a9bcd4" stroke-width="1"/>' +
        (inner ? '<g transform="translate(0,' + (-len) + ')">' + inner + '</g>' : '') +
        '</g>';
    }
    return '<g transform="translate(' + f.x + ',' + f.y + ')">' + seg(0) + '</g>';
  }

  /** Sorot elektroda sesuai aktivitas kanal */
  ArmView.highlightElectrodes = function (svg, raw) {
    if (!svg) return;
    Device.CHANNELS.forEach(function (c) {
      var node = svg.querySelector('[data-electrode="' + c.id + '"]');
      if (!node) return;
      var v = U.clamp(raw[c.id] || 0, 0, 1);
      node.setAttribute('opacity', String(0.3 + v * 0.7));
      node.setAttribute('r', String(5 + v * 3.2));
    });
  };

  global.ArmView = ArmView;
})(window);
