/* ============================================================
   ASTA — Rep Counter (penghitung repetisi otomatis dari sEMG)
   ------------------------------------------------------------
   Mendeteksi satu repetisi sebagai siklus lengkap:
     rileks -> kontraksi melewati ambang -> tahan -> rileks lagi

   Memakai histeresis (ambang naik lebih tinggi daripada ambang
   turun) agar sinyal yang bergetar di sekitar ambang tidak
   dihitung berkali-kali. Ini masalah nyata pada sEMG.

   Selain menghitung, komponen ini menilai mutu tiap repetisi:
     - kehalusan (smoothness): variabilitas sinyal saat menahan
     - durasi tahan dibanding target
     - kestabilan puncak
   ============================================================ */
(function (global) {
  'use strict';

  var RepCounter = {};

  /**
   * @param {object} opts {
   *   channel: 'ch1',            kanal pemicu
   *   holdMs: 1200,              target durasi tahan
   *   minRelaxMs: 350,           wajib rileks sebelum rep berikutnya
   *   onRep: fn(repData),
   *   onPhaseChange: fn(phase),  'rileks' | 'naik' | 'tahan' | 'turun'
   *   onTick: fn(state)
   * }
   */
  RepCounter.create = function (opts) {
    var o = opts || {};
    var channel = o.channel || 'ch1';
    var holdTarget = o.holdMs || 1200;
    var minRelax = o.minRelaxMs || 350;

    var st = {
      count: 0,
      phase: 'rileks',
      peak: 0,
      holdStart: 0,
      holdMs: 0,
      relaxStart: Date.now(),
      samples: [],       // sinyal selama satu repetisi
      reps: [],          // riwayat repetisi
      running: false
    };

    var off = null;

    /* Konfirmasi transisi: sinyal sEMG berfluktuasi cepat, sehingga
       satu sampel di bawah ambang belum berarti kontraksi berakhir.
       Transisi baru diakui setelah beberapa sampel berurutan sepakat.
       Tanpa ini, satu repetisi bisa terpecah menjadi beberapa, atau
       justru hilang sama sekali. */
    var CONFIRM = o.confirmSamples || 3;
    var belowRun = 0, aboveRun = 0;

    function thresholds() {
      var cal = Device.getCal();
      var base = cal.threshold[channel] || 0.3;
      return {
        // Histeresis: butuh 100% ambang untuk naik, 65% untuk dianggap turun
        up: base,
        down: base * 0.65
      };
    }

    function handle(d) {
      if (!st.running) return;
      var v = d.raw[channel] || 0;
      var th = thresholds();
      var now = Date.now();

      // Hitung rentetan sampel di atas / di bawah ambang
      if (v >= th.up) { aboveRun++; belowRun = 0; }
      else if (v < th.down) { belowRun++; aboveRun = 0; }

      if (st.phase === 'rileks') {
        if (aboveRun >= 1 && now - st.relaxStart >= minRelax) {
          st.phase = 'naik';
          st.peak = v;
          st.samples = [v];
          emitPhase();
        }
      } else if (st.phase === 'naik') {
        st.samples.push(v);
        if (v > st.peak) st.peak = v;
        // Masuk fase tahan bila sinyal berhenti menanjak dan tetap di atas ambang
        if (st.samples.length >= 3 && v >= th.up) {
          var recent = st.samples.slice(-3);
          var rising = recent[recent.length - 1] > recent[0] + 0.04;
          if (!rising) {
            st.phase = 'tahan';
            st.holdStart = now;
            emitPhase();
          }
        }
        // Batalkan hanya bila benar-benar turun secara konsisten
        if (belowRun >= CONFIRM) {
          st.phase = 'rileks';
          st.relaxStart = now;
          st.samples = [];
          emitPhase();
        }
      } else if (st.phase === 'tahan') {
        st.samples.push(v);
        if (v > st.peak) st.peak = v;
        st.holdMs = now - st.holdStart;
        if (belowRun >= CONFIRM) {
          st.phase = 'turun';
          emitPhase();
        }
      } else if (st.phase === 'turun') {
        st.samples.push(v);
        // Repetisi diakui selesai setelah rileks terkonfirmasi.
        // Syarat holdMs mencegah gerakan setengah dihitung sebagai repetisi.
        if (belowRun >= CONFIRM && st.holdMs >= 120) {
          finishRep(now);
        } else if (aboveRun >= CONFIRM) {
          // Naik lagi sebelum rileks: anggap masih satu repetisi
          st.phase = 'tahan';
          st.holdStart = now - st.holdMs;
          emitPhase();
        }
      }

      if (o.onTick) o.onTick({ value: v, phase: st.phase, count: st.count, holdMs: st.holdMs });
    }

    function finishRep(now) {
      var holdMs = st.holdMs;
      var samples = st.samples.slice();

      // Kehalusan: makin kecil simpangan saat menahan, makin halus
      var holdSamples = samples.filter(function (v) { return v >= thresholds().down; });
      var variability = holdSamples.length > 2 ? Study.sd(holdSamples) : 0.25;
      var smoothness = U.clamp(Math.round(100 - variability * 260), 10, 100);

      // Ketepatan durasi tahan
      var holdAccuracy = U.clamp(
        Math.round(100 - (Math.abs(holdMs - holdTarget) / holdTarget) * 100), 0, 100);

      // Kekuatan puncak relatif
      var peakScore = U.clamp(Math.round(st.peak * 100), 0, 100);

      var quality = Math.round(smoothness * 0.4 + holdAccuracy * 0.4 + peakScore * 0.2);

      var rep = {
        index: st.count + 1,
        at: now,
        peak: U.round(st.peak, 3),
        holdMs: holdMs,
        smoothness: smoothness,
        holdAccuracy: holdAccuracy,
        quality: quality,
        samples: samples.length
      };

      st.count++;
      st.reps.push(rep);
      st.phase = 'rileks';
      st.relaxStart = now;
      st.holdMs = 0;
      st.peak = 0;
      st.samples = [];
      belowRun = 0;
      aboveRun = 0;

      emitPhase();
      if (o.onRep) o.onRep(rep, st);
    }

    function emitPhase() {
      if (o.onPhaseChange) o.onPhaseChange(st.phase, st);
    }

    return {
      state: st,
      start: function () {
        if (st.running) return;
        st.running = true;
        st.relaxStart = Date.now();
        if (!off) off = Device.on('signal', handle);
      },
      pause: function () { st.running = false; },
      resume: function () { st.running = true; st.relaxStart = Date.now(); },
      reset: function () {
        st.count = 0; st.reps = []; st.phase = 'rileks';
        st.peak = 0; st.holdMs = 0; st.samples = [];
        st.relaxStart = Date.now();
        belowRun = 0; aboveRun = 0;
        emitPhase();
      },
      /** Tambah repetisi manual — untuk latihan tanpa alat */
      manualRep: function () {
        var rep = {
          index: st.count + 1, at: Date.now(), peak: null, holdMs: null,
          smoothness: null, holdAccuracy: null, quality: null, manual: true
        };
        st.count++; st.reps.push(rep);
        if (o.onRep) o.onRep(rep, st);
        return rep;
      },
      setChannel: function (ch) { channel = ch; },
      summary: function () {
        var scored = st.reps.filter(function (r) { return r.quality !== null; });
        return {
          count: st.count,
          avgQuality: scored.length ? Math.round(U.avg(scored.map(function (r) { return r.quality; }))) : null,
          avgSmoothness: scored.length ? Math.round(U.avg(scored.map(function (r) { return r.smoothness; }))) : null,
          avgHoldMs: scored.length ? Math.round(U.avg(scored.map(function (r) { return r.holdMs; }))) : null,
          avgPeak: scored.length ? U.round(U.avg(scored.map(function (r) { return r.peak; })), 2) : null,
          reps: st.reps.slice(),
          manualCount: st.reps.filter(function (r) { return r.manual; }).length
        };
      },
      destroy: function () {
        st.running = false;
        if (off) { off(); off = null; }
      }
    };
  };

  /** Label & warna fase untuk UI */
  RepCounter.phaseInfo = function (phase) {
    var map = {
      rileks: { label: 'Rileks', cls: 'rest', hint: 'Lepaskan kontraksi sepenuhnya' },
      naik: { label: 'Kontraksi', cls: '', hint: 'Tingkatkan kontraksi perlahan' },
      tahan: { label: 'Tahan', cls: 'hold', hint: 'Pertahankan kontraksi stabil' },
      turun: { label: 'Lepaskan', cls: '', hint: 'Turunkan kontraksi perlahan' }
    };
    return map[phase] || map.rileks;
  };

  global.RepCounter = RepCounter;
})(window);
