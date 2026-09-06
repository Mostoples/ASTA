/* ============================================================
   ASTA — Chart engine ringan (Canvas 2D, tanpa dependensi)
   Mendukung: line, area, bar, dual-axis (nyeri vs pemakaian),
   scatter, sparkline, radar
   ============================================================ */
(function (global) {
  'use strict';

  var Chart = {};

  var C = {
    grid: '#d6e0ee',
    axis: '#6b7f99',
    text: '#40546f',
    textSoft: '#8496ad',
    font: '600 11px "Segoe UI", Inter, system-ui, sans-serif',
    fontSm: '600 10px "Segoe UI", Inter, system-ui, sans-serif'
  };

  /** Siapkan canvas dengan skala DPI supaya tajam */
  function prep(canvas, height) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    var h = height || canvas.dataset.height || 220;
    h = Number(h);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / e;
    var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * e;
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  /** Kurva halus (Catmull-Rom → bezier) */
  function smoothPath(ctx, pts) {
    if (pts.length < 2) return;
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i], p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var t = 0.2;
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) * t, p1.y + (p2.y - p0.y) * t,
        p2.x - (p3.x - p1.x) * t, p2.y - (p3.y - p1.y) * t,
        p2.x, p2.y
      );
    }
  }

  /* ============================================================
     LINE / AREA — mendukung banyak seri dan dua sumbu Y
     opts: {
       labels: [], series: [{name,data,color,axis:'left'|'right',fill,dashed,type:'line'|'bar'}],
       height, yMax, yMaxRight, yLabelRight, showDots, band:{from,to}
     }
     ============================================================ */
  Chart.line = function (canvas, opts) {
    if (!canvas) return;
    var o = opts || {};
    var p = prep(canvas, o.height);
    var ctx = p.ctx, W = p.w, H = p.h;
    var labels = o.labels || [];
    var series = (o.series || []).filter(function (s) { return s && s.data; });
    if (!series.length || !labels.length) { drawNoData(ctx, W, H); return; }

    var hasRight = series.some(function (s) { return s.axis === 'right'; });
    var pad = { t: 18, r: hasRight ? 46 : 16, b: 30, l: 42 };
    var cw = W - pad.l - pad.r;
    var ch = H - pad.t - pad.b;
    if (cw <= 10 || ch <= 10) return;

    var leftS = series.filter(function (s) { return s.axis !== 'right'; });
    var rightS = series.filter(function (s) { return s.axis === 'right'; });

    function maxOf(list, override) {
      if (override !== undefined && override !== null) return override;
      var m = 0;
      list.forEach(function (s) { s.data.forEach(function (v) { if (v !== null && v > m) m = v; }); });
      return niceMax(m * 1.12) || 1;
    }
    var maxL = maxOf(leftS, o.yMax);
    var maxR = maxOf(rightS, o.yMaxRight);

    var stepX = labels.length > 1 ? cw / (labels.length - 1) : 0;
    function X(i) { return pad.l + (labels.length > 1 ? i * stepX : cw / 2); }
    function YL(v) { return pad.t + ch - (v / maxL) * ch; }
    function YR(v) { return pad.t + ch - (v / maxR) * ch; }

    // Band highlight — menandai periode (mis. fase penelitian A/B).
    // Menerima o.band (tunggal) maupun o.bands (banyak).
    var bandList = o.bands ? o.bands.slice() : [];
    if (o.band && o.band.from !== undefined) bandList.push(o.band);
    bandList.forEach(function (b) {
      if (b.from === undefined || b.from === null) return;
      var x0 = X(b.from);
      var x1 = X(b.to === undefined || b.to === null ? labels.length - 1 : b.to);
      // Lebarkan setengah langkah agar batas fase terlihat menyambung
      var half = stepX / 2 || 0;
      var left = Math.max(pad.l, x0 - half);
      var right = Math.min(pad.l + cw, x1 + half);
      ctx.fillStyle = b.color || 'rgba(122,90,248,.08)';
      ctx.fillRect(left, pad.t, right - left, ch);
      // Garis batas fase
      ctx.strokeStyle = b.textColor ? Chart.alpha(b.textColor, 0.45) : 'rgba(122,90,248,.35)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(left, pad.t); ctx.lineTo(left, pad.t + ch); ctx.stroke();
      ctx.setLineDash([]);
      if (b.label) {
        ctx.fillStyle = b.textColor || '#7a5af8';
        ctx.font = '700 10px "Segoe UI", Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(b.label, left + 4, pad.t + 3);
      }
    });

    // Grid + label Y kiri
    var ticks = o.ticks || 4;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.font = C.font;
    ctx.fillStyle = C.textSoft;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (var t = 0; t <= ticks; t++) {
      var yv = (maxL / ticks) * t;
      var y = YL(yv);
      ctx.beginPath();
      ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y);
      ctx.stroke();
      ctx.fillText(fmtTick(yv), pad.l - 8, y);
    }

    // Label Y kanan
    if (hasRight) {
      ctx.textAlign = 'left';
      ctx.fillStyle = rightS[0].color || C.textSoft;
      for (var t2 = 0; t2 <= ticks; t2++) {
        var yv2 = (maxR / ticks) * t2;
        ctx.fillText(fmtTick(yv2), pad.l + cw + 8, YR(yv2));
      }
    }

    // Label X (dijarangkan bila padat)
    ctx.fillStyle = C.textSoft;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var every = Math.max(1, Math.ceil(labels.length / (cw / 54)));
    labels.forEach(function (l, i) {
      if (i % every !== 0 && i !== labels.length - 1) return;
      ctx.fillText(String(l), X(i), pad.t + ch + 9);
    });

    // Bar dulu (di belakang garis)
    series.forEach(function (s) {
      if (s.type !== 'bar') return;
      var Y = s.axis === 'right' ? YR : YL;
      var bw = Math.max(3, Math.min(22, stepX * 0.5 || 18));
      ctx.fillStyle = s.color || 'rgba(43,108,222,.28)';
      s.data.forEach(function (v, i) {
        if (v === null || v === undefined) return;
        var y = Y(v);
        roundRect(ctx, X(i) - bw / 2, y, bw, pad.t + ch - y, 4);
        ctx.fill();
      });
    });

    // Garis / area
    series.forEach(function (s) {
      if (s.type === 'bar') return;
      var Y = s.axis === 'right' ? YR : YL;
      var col = s.color || '#2b6cde';
      var pts = [];
      s.data.forEach(function (v, i) {
        if (v === null || v === undefined) return;
        pts.push({ x: X(i), y: Y(v) });
      });
      if (!pts.length) return;

      if (s.fill) {
        var g = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
        g.addColorStop(0, hexA(col, 0.32));
        g.addColorStop(1, hexA(col, 0.02));
        ctx.fillStyle = g;
        ctx.beginPath();
        smoothPath(ctx, pts);
        ctx.lineTo(pts[pts.length - 1].x, pad.t + ch);
        ctx.lineTo(pts[0].x, pad.t + ch);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = col;
      ctx.lineWidth = s.width || 2.6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(s.dashed ? [6, 5] : []);
      ctx.beginPath();
      smoothPath(ctx, pts);
      ctx.stroke();
      ctx.setLineDash([]);

      if (o.showDots !== false && pts.length <= 40) {
        pts.forEach(function (pt) {
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 4.2, 0, 7); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 4.2, 0, 7); ctx.stroke();
        });
      }
    });

    // Garis target horizontal
    if (o.targetLine !== undefined && o.targetLine !== null) {
      var ty = YL(o.targetLine);
      ctx.strokeStyle = o.targetColor || '#1c9e6b';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.moveTo(pad.l, ty); ctx.lineTo(pad.l + cw, ty); ctx.stroke();
      ctx.setLineDash([]);
      if (o.targetLabel) {
        ctx.fillStyle = o.targetColor || '#1c9e6b';
        ctx.font = C.fontSm;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(o.targetLabel, pad.l + 4, ty - 4);
      }
    }
  };

  /* ============================================================
     BAR chart (vertikal, mendukung warna per item)
     ============================================================ */
  Chart.bar = function (canvas, opts) {
    if (!canvas) return;
    var o = opts || {};
    var p = prep(canvas, o.height);
    var ctx = p.ctx, W = p.w, H = p.h;
    var labels = o.labels || [];
    var data = o.data || [];
    if (!data.length) { drawNoData(ctx, W, H); return; }

    var pad = { t: 18, r: 14, b: 32, l: 40 };
    var cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    var max = o.yMax || niceMax(Math.max.apply(null, data.concat([1])) * 1.14);
    var slot = cw / data.length;
    var bw = Math.min(o.barWidth || 34, slot * 0.62);

    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.font = C.font; ctx.fillStyle = C.textSoft;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var t = 0; t <= 4; t++) {
      var yv = (max / 4) * t, y = pad.t + ch - (yv / max) * ch;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
      ctx.fillText(fmtTick(yv), pad.l - 8, y);
    }

    data.forEach(function (v, i) {
      var x = pad.l + slot * i + slot / 2 - bw / 2;
      var h = (v / max) * ch;
      var y = pad.t + ch - h;
      var col = (o.colors && o.colors[i]) || o.color || '#2b6cde';
      var g = ctx.createLinearGradient(0, y, 0, pad.t + ch);
      g.addColorStop(0, col);
      g.addColorStop(1, hexA(col, 0.55));
      ctx.fillStyle = g;
      roundRect(ctx, x, y, bw, Math.max(h, 2), 6);
      ctx.fill();

      if (o.showValues) {
        ctx.fillStyle = C.text; ctx.font = C.fontSm;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(fmtTick(v), x + bw / 2, y - 4);
      }
    });

    ctx.fillStyle = C.textSoft; ctx.font = C.font;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    labels.forEach(function (l, i) {
      ctx.fillText(String(l), pad.l + slot * i + slot / 2, pad.t + ch + 9);
    });
  };

  /* ============================================================
     SCATTER — untuk korelasi nyeri vs pemakaian
     ============================================================ */
  Chart.scatter = function (canvas, opts) {
    if (!canvas) return;
    var o = opts || {};
    var p = prep(canvas, o.height);
    var ctx = p.ctx, W = p.w, H = p.h;
    var pts = o.points || [];
    if (!pts.length) { drawNoData(ctx, W, H); return; }

    var pad = { t: 18, r: 18, b: 40, l: 46 };
    var cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    var xMax = o.xMax || niceMax(Math.max.apply(null, pts.map(function (q) { return q.x; })) * 1.1);
    var yMax = o.yMax || 10;

    function X(v) { return pad.l + (v / xMax) * cw; }
    function Y(v) { return pad.t + ch - (v / yMax) * ch; }

    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.font = C.font; ctx.fillStyle = C.textSoft;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var t = 0; t <= 5; t++) {
      var yv = (yMax / 5) * t, y = Y(yv);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
      ctx.fillText(fmtTick(yv), pad.l - 8, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var k = 0; k <= 4; k++) {
      var xv = (xMax / 4) * k;
      ctx.fillText(fmtTick(xv), X(xv), pad.t + ch + 9);
    }

    // Garis tren (regresi linear sederhana)
    if (o.trend !== false && pts.length >= 3) {
      var n = pts.length;
      var mx = U.avg(pts.map(function (q) { return q.x; }));
      var my = U.avg(pts.map(function (q) { return q.y; }));
      var num = 0, den = 0;
      pts.forEach(function (q) { num += (q.x - mx) * (q.y - my); den += Math.pow(q.x - mx, 2); });
      if (den) {
        var b = num / den, a = my - b * mx;
        ctx.strokeStyle = o.trendColor || '#d64545';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(X(0), Y(U.clamp(a, 0, yMax)));
        ctx.lineTo(X(xMax), Y(U.clamp(a + b * xMax, 0, yMax)));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    pts.forEach(function (q) {
      var col = q.color || o.color || '#2b6cde';
      ctx.fillStyle = hexA(col, 0.72);
      ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), q.r || 5.4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), q.r || 5.4, 0, 7); ctx.stroke();
    });

    // Judul sumbu
    ctx.fillStyle = C.text; ctx.font = C.fontSm;
    if (o.xTitle) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(o.xTitle, pad.l + cw / 2, H - 3);
    }
    if (o.yTitle) {
      ctx.save();
      ctx.translate(11, pad.t + ch / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(o.yTitle, 0, 0);
      ctx.restore();
    }
  };

  /* ============================================================
     SPARKLINE mini
     ============================================================ */
  Chart.spark = function (canvas, data, opts) {
    if (!canvas || !data || !data.length) return;
    var o = opts || {};
    var p = prep(canvas, o.height || 46);
    var ctx = p.ctx, W = p.w, H = p.h;
    var min = Math.min.apply(null, data), max = Math.max.apply(null, data);
    var span = (max - min) || 1;
    var pad = 4;
    var pts = data.map(function (v, i) {
      return {
        x: (i / Math.max(1, data.length - 1)) * (W - pad * 2) + pad,
        y: H - pad - ((v - min) / span) * (H - pad * 2)
      };
    });
    var col = o.color || '#2b6cde';
    if (o.fill !== false) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, hexA(col, 0.3));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); smoothPath(ctx, pts);
      ctx.lineTo(pts[pts.length - 1].x, H); ctx.lineTo(pts[0].x, H); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); smoothPath(ctx, pts); ctx.stroke();
    var last = pts[pts.length - 1];
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(last.x, last.y, 3.4, 0, 7); ctx.fill();
  };

  /* ============================================================
     RADAR — untuk profil fungsi tangan / skor domain
     ============================================================ */
  Chart.radar = function (canvas, opts) {
    if (!canvas) return;
    var o = opts || {};
    var p = prep(canvas, o.height || 260);
    var ctx = p.ctx, W = p.w, H = p.h;
    var axes = o.axes || [];
    if (axes.length < 3) { drawNoData(ctx, W, H); return; }
    var cx = W / 2, cy = H / 2 + 4;
    var R = Math.min(W, H) / 2 - 42;
    var n = axes.length;
    var max = o.max || 100;

    function pt(i, val) {
      var ang = (Math.PI * 2 * i) / n - Math.PI / 2;
      var r = (val / max) * R;
      return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
    }

    // Jaring
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (var ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var q = pt(i, (max / 4) * ring);
        i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
      ctx.closePath(); ctx.stroke();
    }
    for (var j = 0; j < n; j++) {
      var e = pt(j, max);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(e.x, e.y); ctx.stroke();
    }

    // Seri
    (o.series || []).forEach(function (s) {
      var col = s.color || '#2b6cde';
      ctx.beginPath();
      s.data.forEach(function (v, i) {
        var q = pt(i, v);
        i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      });
      ctx.closePath();
      ctx.fillStyle = hexA(col, 0.2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke();
      s.data.forEach(function (v, i) {
        var q = pt(i, v);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(q.x, q.y, 3.6, 0, 7); ctx.fill();
      });
    });

    // Label
    ctx.fillStyle = C.text; ctx.font = C.fontSm;
    axes.forEach(function (a, i) {
      var q = pt(i, max * 1.17);
      ctx.textAlign = Math.abs(q.x - cx) < 12 ? 'center' : (q.x > cx ? 'left' : 'right');
      ctx.textBaseline = q.y > cy + 6 ? 'top' : (q.y < cy - 6 ? 'bottom' : 'middle');
      ctx.fillText(a, q.x, q.y);
    });
  };

  /* ---------------- Helper ---------------- */
  function fmtTick(v) {
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
    return String(U.round(v, Math.abs(v) < 10 ? 1 : 0)).replace('.0', '');
  }

  function hexA(hex, a) {
    if (!hex) return 'rgba(43,108,222,' + a + ')';
    if (hex.indexOf('rgba') === 0) return hex;
    if (hex.indexOf('rgb(') === 0) return hex.replace('rgb(', 'rgba(').replace(')', ',' + a + ')');
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  Chart.alpha = hexA;

  function drawNoData(ctx, W, H) {
    ctx.fillStyle = C.textSoft;
    ctx.font = '600 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Belum ada data untuk ditampilkan', W / 2, H / 2);
  }

  /** Redraw otomatis saat resize */
  Chart.responsive = function (fn) {
    var run = U.debounce(fn, 180);
    window.addEventListener('resize', run);
    return function () { window.removeEventListener('resize', run); };
  };

  global.Chart = Chart;
})(window);
