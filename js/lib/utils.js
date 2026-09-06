/* ============================================================
   ASTA — Utilitas umum
   ============================================================ */
(function (global) {
  'use strict';

  var U = {};

  /* ---------- DOM ---------- */
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  U.el = function (tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'dataset') Object.keys(attrs[k]).forEach(function (d) { n.dataset[d] = attrs[k][d]; });
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
      });
    }
    if (html !== undefined && html !== null) n.innerHTML = html;
    return n;
  };

  /** Escape HTML — WAJIB dipakai untuk semua data dari user */
  U.esc = function (s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /** Delegasi event */
  U.on = function (root, evt, sel, fn) {
    root.addEventListener(evt, function (e) {
      var t = e.target.closest(sel);
      if (t && root.contains(t)) fn.call(t, e, t);
    });
  };

  /* ---------- Angka ---------- */
  U.clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.round = function (v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; };
  U.pct = function (a, b) { return b ? U.clamp(Math.round((a / b) * 100), 0, 100) : 0; };
  U.avg = function (arr) {
    if (!arr || !arr.length) return 0;
    return arr.reduce(function (s, v) { return s + (Number(v) || 0); }, 0) / arr.length;
  };
  U.sum = function (arr) {
    return (arr || []).reduce(function (s, v) { return s + (Number(v) || 0); }, 0);
  };
  U.nf = function (v, d) {
    var n = Number(v) || 0;
    return n.toLocaleString('id-ID', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  };

  /* ---------- Random (dengan seed, supaya data demo konsisten) ---------- */
  U.seedRand = function (seed) {
    var s = seed || 42;
    return function () {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  };
  U.rnd = function (min, max) { return Math.random() * (max - min) + min; };
  U.rndInt = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.uid = function (p) {
    return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  /* ---------- Tanggal ---------- */
  var DOW = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var DOW_S = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  U.DOW = DOW; U.DOW_S = DOW_S; U.MON = MON; U.MON_S = MON_S;

  U.d = function (v) { return v instanceof Date ? new Date(v.getTime()) : new Date(v); };

  /** Kunci tanggal lokal YYYY-MM-DD (hindari toISOString karena pergeseran UTC) */
  U.dayKey = function (v) {
    var x = U.d(v || new Date());
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  };

  U.today = function () { return U.dayKey(new Date()); };

  U.addDays = function (v, n) {
    var x = U.d(v); x.setDate(x.getDate() + n); return x;
  };

  U.startOfDay = function (v) { var x = U.d(v); x.setHours(0, 0, 0, 0); return x; };

  U.fmtDate = function (v, style) {
    var x = U.d(v);
    if (isNaN(x)) return '-';
    if (style === 'long') return x.getDate() + ' ' + MON[x.getMonth()] + ' ' + x.getFullYear();
    if (style === 'dow') return DOW[x.getDay()] + ', ' + x.getDate() + ' ' + MON_S[x.getMonth()] + ' ' + x.getFullYear();
    if (style === 'short') return x.getDate() + ' ' + MON_S[x.getMonth()];
    if (style === 'num') return String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0') + '/' + x.getFullYear();
    return x.getDate() + ' ' + MON_S[x.getMonth()] + ' ' + x.getFullYear();
  };

  U.fmtTime = function (v) {
    var x = U.d(v);
    if (isNaN(x)) return '-';
    return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
  };

  U.fmtDateTime = function (v) { return U.fmtDate(v, 'short') + ' ' + U.fmtTime(v); };

  /** "3 menit lalu", "2 hari lalu" */
  U.ago = function (v) {
    var diff = Date.now() - U.d(v).getTime();
    if (isNaN(diff)) return '-';
    var m = Math.floor(diff / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return m + ' menit lalu';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    var d = Math.floor(h / 24);
    if (d < 7) return d + ' hari lalu';
    if (d < 30) return Math.floor(d / 7) + ' minggu lalu';
    return U.fmtDate(v, 'short');
  };

  /** Selisih hari (kunci tanggal) */
  U.daysBetween = function (a, b) {
    return Math.round((U.startOfDay(b) - U.startOfDay(a)) / 86400000);
  };

  /** mm:ss */
  U.mmss = function (sec) {
    var s = Math.max(0, Math.floor(sec));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  /** "1j 24m" */
  U.dur = function (minutes) {
    var m = Math.max(0, Math.round(minutes));
    var h = Math.floor(m / 60);
    if (!h) return m + 'm';
    return h + 'j' + (m % 60 ? ' ' + (m % 60) + 'm' : '');
  };

  /* ---------- String ---------- */
  U.initials = function (name) {
    var p = String(name || '?').trim().split(/\s+/);
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  };

  U.slug = function (s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  U.titlecase = function (s) {
    return String(s || '').replace(/\w\S*/g, function (t) { return t[0].toUpperCase() + t.slice(1).toLowerCase(); });
  };

  /* ---------- Warna ---------- */
  /** Warna skala nyeri 0-10 */
  U.painColor = function (lvl) {
    var n = Number(lvl) || 0;
    if (n <= 2) return '#1c9e6b';
    if (n <= 4) return '#8cbf3f';
    if (n <= 6) return '#d9b40b';
    if (n <= 8) return '#e07a1f';
    return '#d63a3a';
  };

  U.painLabel = function (lvl) {
    var n = Number(lvl) || 0;
    if (n === 0) return 'Tidak nyeri';
    if (n <= 3) return 'Ringan';
    if (n <= 6) return 'Sedang';
    if (n <= 8) return 'Berat';
    return 'Sangat berat';
  };

  /** Warna & label kepatuhan */
  U.adherenceTone = function (score) {
    var s = Number(score) || 0;
    if (s >= 80) return { tone: 'success', label: 'Baik' };
    if (s >= 60) return { tone: 'primary', label: 'Cukup' };
    if (s >= 40) return { tone: 'warning', label: 'Perlu perhatian' };
    return { tone: 'danger', label: 'Risiko putus terapi' };
  };

  /* ---------- Fungsional ---------- */
  U.debounce = function (fn, ms) {
    var t;
    return function () {
      var a = arguments, c = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(c, a); }, ms || 250);
    };
  };

  U.throttle = function (fn, ms) {
    var last = 0, t;
    return function () {
      var a = arguments, c = this, now = Date.now();
      if (now - last >= (ms || 100)) { last = now; fn.apply(c, a); }
      else { clearTimeout(t); t = setTimeout(function () { last = Date.now(); fn.apply(c, a); }, ms - (now - last)); }
    };
  };

  U.groupBy = function (arr, keyFn) {
    return (arr || []).reduce(function (acc, item) {
      var k = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  };

  U.sortBy = function (arr, keyFn, desc) {
    var f = typeof keyFn === 'function' ? keyFn : function (o) { return o[keyFn]; };
    return (arr || []).slice().sort(function (a, b) {
      var x = f(a), y = f(b);
      if (x === y) return 0;
      return (x > y ? 1 : -1) * (desc ? -1 : 1);
    });
  };

  U.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* ---------- Query string ---------- */
  U.query = function (key) {
    var p = new URLSearchParams(location.search);
    return key ? p.get(key) : p;
  };

  /* ---------- Statistik sederhana ---------- */
  /** Rata-rata bergerak */
  U.movingAvg = function (arr, win) {
    var w = win || 3, out = [];
    for (var i = 0; i < arr.length; i++) {
      var a = Math.max(0, i - w + 1);
      out.push(U.avg(arr.slice(a, i + 1)));
    }
    return out;
  };

  /** Korelasi Pearson — untuk analisis nyeri vs pemakaian */
  U.pearson = function (xs, ys) {
    var n = Math.min(xs.length, ys.length);
    if (n < 3) return 0;
    var mx = U.avg(xs.slice(0, n)), my = U.avg(ys.slice(0, n));
    var num = 0, dx = 0, dy = 0;
    for (var i = 0; i < n; i++) {
      var a = xs[i] - mx, b = ys[i] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    if (!dx || !dy) return 0;
    return U.round(num / Math.sqrt(dx * dy), 2);
  };

  /** Interpretasi kekuatan korelasi */
  U.corrLabel = function (r) {
    var a = Math.abs(r);
    var s = a >= 0.7 ? 'kuat' : a >= 0.4 ? 'sedang' : a >= 0.2 ? 'lemah' : 'sangat lemah';
    return s + ' (' + (r < 0 ? 'negatif' : 'positif') + ')';
  };

  /* ---------- Unduh file ---------- */
  U.downloadText = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  };

  U.toCSV = function (rows, headers) {
    function cell(v) {
      var s = v === null || v === undefined ? '' : String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var out = [];
    if (headers) out.push(headers.map(cell).join(';'));
    rows.forEach(function (r) { out.push(r.map(cell).join(';')); });
    return out.join('\r\n');
  };

  global.U = U;
})(window);
