/* ============================================================
   ASTA — Body Map interaktif
   Menandai lokasi nyeri, termasuk zona phantom (bergaris putus)
   yang secara anatomis sudah tidak ada namun tetap dirasakan.
   ============================================================ */
(function (global) {
  'use strict';

  var BodyMap = {};

  /* Zona pada tubuh: koordinat mengikuti viewBox 0 0 200 340.
     Sisi amputasi digambar di kanan gambar (kiri pasien) atau
     dibalik sesuai data pasien. */
  var ZONE_SHAPES = {
    neck:       { type: 'rect', x: 86, y: 40, w: 28, h: 16, label: 'Leher', phantom: false },
    shoulder:   { type: 'circle', cx: 138, cy: 70, r: 15, label: 'Bahu', phantom: false },
    stump:      { type: 'rect', x: 146, y: 88, w: 22, h: 44, rx: 11, label: 'Tunggul', phantom: false },
    ph_forearm: { type: 'rect', x: 148, y: 134, w: 19, h: 40, rx: 9, label: 'Lengan bawah', phantom: true },
    ph_wrist:   { type: 'rect', x: 149, y: 176, w: 17, h: 13, rx: 6, label: 'Pergelangan', phantom: true },
    ph_palm:    { type: 'rect', x: 147, y: 191, w: 21, h: 20, rx: 7, label: 'Telapak', phantom: true },
    ph_thumb:   { type: 'circle', cx: 142, cy: 199, r: 7, label: 'Ibu jari', phantom: true },
    ph_fingers: { type: 'rect', x: 148, y: 213, w: 19, h: 17, rx: 7, label: 'Jari-jari', phantom: true }
  };

  /**
   * Render body map.
   * @param {HTMLElement} host
   * @param {object} opts {
   *   selected: [zoneId], side: 'Kanan'|'Kiri',
   *   heat: { zoneId: 0..10 } untuk mode intensitas,
   *   readonly: bool, onChange: fn(selectedArray)
   * }
   */
  BodyMap.create = function (host, opts) {
    if (!host) return null;
    var o = opts || {};
    var selected = (o.selected || []).slice();
    var readonly = !!o.readonly;
    // Amputasi kiri pasien tampil di sisi kanan gambar (pandangan anterior)
    var flip = o.side === 'Kanan';

    host.innerHTML = markup(o, flip);
    var svg = host.querySelector('svg');

    function paint() {
      Object.keys(ZONE_SHAPES).forEach(function (id) {
        var node = svg.querySelector('[data-zone="' + id + '"]');
        if (!node) return;
        var on = selected.indexOf(id) >= 0;
        node.setAttribute('data-selected', String(on));
        if (o.heat) {
          var v = o.heat[id];
          if (v === undefined || v === null) {
            node.style.fill = 'var(--surface-alt)';
          } else {
            node.style.fill = Chart.alpha(U.painColor(v), 0.28 + (v / 10) * 0.62);
          }
        } else {
          node.style.fill = on
            ? Chart.alpha(ZONE_SHAPES[id].phantom ? '#7a5af8' : '#2b6cde', 0.42)
            : (ZONE_SHAPES[id].phantom ? 'rgba(122,90,248,.09)' : 'var(--surface-alt)');
        }
      });
    }
    paint();

    if (!readonly) {
      U.$$('[data-zone]', svg).forEach(function (node) {
        node.setAttribute('tabindex', '0');
        node.setAttribute('role', 'checkbox');
        var id = node.dataset.zone;
        node.setAttribute('aria-label', ZONE_SHAPES[id].label +
          (ZONE_SHAPES[id].phantom ? ' (phantom)' : ''));
        node.setAttribute('aria-checked', String(selected.indexOf(id) >= 0));

        function toggle() {
          var i = selected.indexOf(id);
          if (i >= 0) selected.splice(i, 1); else selected.push(id);
          node.setAttribute('aria-checked', String(selected.indexOf(id) >= 0));
          paint();
          if (o.onChange) o.onChange(selected.slice());
        }
        node.addEventListener('click', toggle);
        node.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
      });
    }

    return {
      svg: svg,
      get: function () { return selected.slice(); },
      set: function (arr) { selected = (arr || []).slice(); paint(); },
      clear: function () { selected = []; paint(); if (o.onChange) o.onChange([]); },
      setHeat: function (heat) { o.heat = heat; paint(); }
    };
  };

  function markup(o, flip) {
    var shapes = Object.keys(ZONE_SHAPES).map(function (id) {
      var z = ZONE_SHAPES[id];
      var cls = 'bm-zone' + (z.phantom ? ' bm-phantom' : '');
      var common = 'class="' + cls + '" data-zone="' + id + '" data-selected="false"';
      if (z.type === 'circle') {
        return '<circle ' + common + ' cx="' + z.cx + '" cy="' + z.cy + '" r="' + z.r + '"/>';
      }
      return '<rect ' + common + ' x="' + z.x + '" y="' + z.y + '" width="' + z.w +
        '" height="' + z.h + '" rx="' + (z.rx || 5) + '"/>';
    }).join('');

    return '<svg viewBox="0 0 200 340" role="group" ' +
      'aria-label="Peta tubuh untuk menandai lokasi nyeri. Zona bergaris putus adalah area phantom.">' +
      '<g' + (flip ? ' transform="translate(200,0) scale(-1,1)"' : '') + '>' +
      // Tubuh (siluet sederhana, netral gender)
      '<g fill="#e6edf7" stroke="#c2d1e4" stroke-width="1.6">' +
      '<circle cx="100" cy="26" r="18"/>' +                       // kepala
      '<rect x="88" y="42" width="24" height="14" rx="6"/>' +      // leher
      '<path d="M74 58 h52 q14 0 14 14 v66 q0 10 -8 10 h-64 q-8 0 -8 -10 v-66 q0 -14 14 -14 z"/>' + // torso
      '<rect x="76" y="146" width="20" height="86" rx="9"/>' +     // kaki kiri
      '<rect x="104" y="146" width="20" height="86" rx="9"/>' +    // kaki kanan
      '<rect x="76" y="234" width="20" height="60" rx="9"/>' +
      '<rect x="104" y="234" width="20" height="60" rx="9"/>' +
      // Lengan sehat (sisi berlawanan)
      '<rect x="42" y="88" width="19" height="46" rx="9"/>' +
      '<rect x="43" y="136" width="17" height="42" rx="8"/>' +
      '<rect x="43" y="180" width="17" height="22" rx="8"/>' +
      '</g>' +
      // Garis pemisah batas amputasi
      '<line x1="142" y1="132" x2="172" y2="132" stroke="#d64545" stroke-width="1.8" stroke-dasharray="4 3"/>' +
      '<text x="176" y="130" class="bm-label"' + (flip ? ' transform="translate(200,0) scale(-1,1)"' : '') +
      ' style="font-size:7.5px">batas</text>' +
      shapes +
      '</g></svg>';
  }

  /** Legend untuk peta */
  BodyMap.legend = function () {
    return '<div class="legend-pain">' +
      '<span><i style="background:rgba(43,108,222,.42)"></i>Area fisik</span>' +
      '<span><i style="background:rgba(122,90,248,.42);border:1.5px dashed #7a5af8"></i>Area phantom</span>' +
      '</div>';
  };

  /** Legend intensitas untuk mode heatmap */
  BodyMap.heatLegend = function () {
    return '<div class="legend-pain">' +
      [0, 3, 5, 7, 10].map(function (v) {
        return '<span><i style="background:' + Chart.alpha(U.painColor(v), 0.75) + '"></i>' + v + '</span>';
      }).join('') + '</div>';
  };

  BodyMap.zoneLabel = function (id) {
    return ZONE_SHAPES[id] ? ZONE_SHAPES[id].label : (Seed.zone(id) || {}).label || id;
  };

  BodyMap.isPhantom = function (id) {
    return ZONE_SHAPES[id] ? ZONE_SHAPES[id].phantom : false;
  };

  /** Hitung frekuensi zona dari daftar catatan nyeri -> untuk heatmap */
  BodyMap.heatFromLogs = function (logs) {
    var acc = {}, cnt = {};
    (logs || []).forEach(function (l) {
      (l.zones || []).forEach(function (z) {
        acc[z] = (acc[z] || 0) + (l.level || 0);
        cnt[z] = (cnt[z] || 0) + 1;
      });
    });
    var out = {};
    Object.keys(acc).forEach(function (z) { out[z] = U.round(acc[z] / cnt[z], 1); });
    return out;
  };

  global.BodyMap = BodyMap;
})(window);
