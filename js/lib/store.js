/* ============================================================
   ASTA — Store (persistensi lokal + pub/sub)
   Semua akses data lewat sini, sehingga nanti mudah ditukar
   ke REST API tanpa menyentuh kode halaman.
   ============================================================ */
(function (global) {
  'use strict';

  var NS = 'asta:v1:';
  var subs = {};
  var memFallback = {};
  var hasLS = (function () {
    try {
      var k = NS + '__t';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  var Store = {};

  Store.available = hasLS;

  /* ---------- Baca / tulis ---------- */
  Store.get = function (key, fallback) {
    try {
      var raw = hasLS ? localStorage.getItem(NS + key) : memFallback[key];
      if (raw === null || raw === undefined) return fallback === undefined ? null : fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[Store] gagal baca', key, e);
      return fallback === undefined ? null : fallback;
    }
  };

  Store.set = function (key, val) {
    var raw = JSON.stringify(val);
    try {
      if (hasLS) localStorage.setItem(NS + key, raw);
      else memFallback[key] = raw;
    } catch (e) {
      // Kuota penuh: fallback ke memori supaya app tidak mati
      memFallback[key] = raw;
      console.warn('[Store] gagal tulis (kuota?)', key, e);
    }
    emit(key, val);
    return val;
  };

  Store.remove = function (key) {
    if (hasLS) localStorage.removeItem(NS + key);
    delete memFallback[key];
    emit(key, null);
  };

  Store.keys = function () {
    if (!hasLS) return Object.keys(memFallback);
    return Object.keys(localStorage)
      .filter(function (k) { return k.indexOf(NS) === 0; })
      .map(function (k) { return k.slice(NS.length); });
  };

  Store.clearAll = function () {
    Store.keys().forEach(function (k) { Store.remove(k); });
    memFallback = {};
  };

  /* ---------- Koleksi (array of object dengan id) ---------- */
  Store.list = function (key) {
    var v = Store.get(key, []);
    return Array.isArray(v) ? v : [];
  };

  Store.insert = function (key, item) {
    var arr = Store.list(key);
    if (!item.id) item.id = U.uid(key.replace(/[^a-z]/gi, '').slice(0, 4));
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    arr.push(item);
    Store.set(key, arr);
    return item;
  };

  Store.update = function (key, id, patch) {
    var arr = Store.list(key);
    var i = arr.findIndex(function (x) { return x.id === id; });
    if (i < 0) return null;
    arr[i] = Object.assign({}, arr[i], patch, { updatedAt: new Date().toISOString() });
    Store.set(key, arr);
    return arr[i];
  };

  Store.upsert = function (key, item) {
    if (item.id && Store.find(key, item.id)) return Store.update(key, item.id, item);
    return Store.insert(key, item);
  };

  Store.find = function (key, id) {
    return Store.list(key).find(function (x) { return x.id === id; }) || null;
  };

  Store.where = function (key, pred) {
    return Store.list(key).filter(pred);
  };

  Store.delete = function (key, id) {
    var arr = Store.list(key).filter(function (x) { return x.id !== id; });
    Store.set(key, arr);
  };

  /* ---------- Pub/Sub ---------- */
  function emit(key, val) {
    (subs[key] || []).forEach(function (fn) {
      try { fn(val, key); } catch (e) { console.error('[Store] subscriber error', e); }
    });
    (subs['*'] || []).forEach(function (fn) {
      try { fn(val, key); } catch (e) { console.error(e); }
    });
  }

  Store.subscribe = function (key, fn) {
    (subs[key] = subs[key] || []).push(fn);
    return function () {
      subs[key] = subs[key].filter(function (f) { return f !== fn; });
    };
  };

  /* ---------- Sinkron antar tab ---------- */
  if (hasLS) {
    window.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf(NS) !== 0) return;
      var key = e.key.slice(NS.length);
      var val = null;
      try { val = e.newValue ? JSON.parse(e.newValue) : null; } catch (err) { }
      emit(key, val);
    });
  }

  /* ---------- Export / import (untuk keperluan penelitian) ---------- */
  Store.exportAll = function () {
    var out = { app: 'ASTA', version: 1, exportedAt: new Date().toISOString(), data: {} };
    Store.keys().forEach(function (k) { out.data[k] = Store.get(k); });
    return out;
  };

  Store.importAll = function (obj) {
    if (!obj || !obj.data) throw new Error('Format data tidak dikenali');
    Object.keys(obj.data).forEach(function (k) { Store.set(k, obj.data[k]); });
  };

  global.Store = Store;
})(window);
