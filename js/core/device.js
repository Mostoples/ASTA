/* ============================================================
   ASTA — Device Layer (Lengan Bionik)
   ------------------------------------------------------------
   Arsitektur adapter supaya app bisa jalan tanpa hardware:
     - MockAdapter      : simulator sinyal sEMG (untuk demo/uji)
     - BluetoothAdapter : Web Bluetooth API (hardware nyata)

   Alur kontrol: sEMG mentah -> envelope (RMS) -> normalisasi
   terhadap MVC -> threshold -> keputusan gerak -> pose grip
   -> gaya cengkeram -> umpan balik haptik.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------------- Konfigurasi kanal ---------------- */
  var CHANNELS = [
    { id: 'ch1', name: 'Fleksor', muscle: 'Flexor carpi radialis', color: '#4a87f2', action: 'close' },
    { id: 'ch2', name: 'Ekstensor', muscle: 'Extensor carpi radialis', color: '#10a5a5', action: 'open' },
    { id: 'ch3', name: 'Bisep', muscle: 'Biceps brachii', color: '#7a5af8', action: 'rotate' },
    { id: 'ch4', name: 'Trisep', muscle: 'Triceps brachii', color: '#d98b0b', action: 'switch' }
  ];

  /* ---------------- Pola cengkeram ---------------- */
  /* Nilai per digit 0..1 (0 = terbuka penuh, 1 = tertutup penuh)
     urutan: [ibu jari, telunjuk, tengah, manis, kelingking] */
  var GRIPS = {
    open:     { label: 'Terbuka',        icon: 'hand',  digits: [0, 0, 0, 0, 0],                 thumbRot: 0 },
    power:    { label: 'Power Grip',     icon: 'hand',  digits: [0.9, 1, 1, 1, 1],               thumbRot: 32 },
    pinch:    { label: 'Pinch',          icon: 'target',digits: [0.85, 0.9, 0.1, 0.05, 0.05],    thumbRot: 46 },
    tripod:   { label: 'Tripod',         icon: 'target',digits: [0.8, 0.85, 0.85, 0.1, 0.05],    thumbRot: 42 },
    lateral:  { label: 'Lateral / Kunci',icon: 'grid',  digits: [0.55, 1, 1, 1, 1],              thumbRot: 8 },
    point:    { label: 'Menunjuk',       icon: 'zap',   digits: [0.85, 0, 1, 1, 1],              thumbRot: 40 },
    hook:     { label: 'Hook (Menenteng)', icon: 'link',digits: [0.1, 0.95, 0.95, 0.95, 0.95],   thumbRot: 0 },
    tap:      { label: 'Tap / Ketuk',    icon: 'cpu',   digits: [0.9, 0.15, 1, 1, 1],            thumbRot: 44 }
  };

  /* ---------------- State perangkat ---------------- */
  var state = {
    connected: false,
    connecting: false,
    mode: 'mock',           // 'mock' | 'ble'
    deviceName: null,
    battery: 82,
    temp: 33.4,
    humidity: 41,
    firmware: '2.4.1',
    signalQuality: 94,
    latency: 38,

    // Sinyal per kanal
    raw: { ch1: 0, ch2: 0, ch3: 0, ch4: 0 },      // envelope 0..1 (ternormalisasi MVC)
    rawUv: { ch1: 0, ch2: 0, ch3: 0, ch4: 0 },    // mikrovolt untuk tampilan

    // Aktuator
    grip: 'open',
    gripPose: [0, 0, 0, 0, 0],   // pose aktual (dihaluskan)
    targetPose: [0, 0, 0, 0, 0],
    force: 0,                    // 0..100 (%)
    wristRot: 0,                 // derajat -90..90

    // Aktivitas
    actuatorCycles: 18420,
    activeSince: null
  };

  /* ---------------- Kalibrasi & profil (tersimpan) ---------------- */
  var DEFAULT_CAL = {
    mvc: { ch1: 1, ch2: 1, ch3: 1, ch4: 1 },        // faktor normalisasi
    baseline: { ch1: 0.04, ch2: 0.04, ch3: 0.05, ch4: 0.05 },
    threshold: { ch1: 0.32, ch2: 0.32, ch3: 0.45, ch4: 0.45 },
    gain: { ch1: 1, ch2: 1, ch3: 1, ch4: 1 },
    calibratedAt: null
  };

  var DEFAULT_PROFILE = {
    speed: 62,            // kecepatan aktuator 0..100
    forceLimit: 78,       // batas gaya maksimum (%)
    smoothing: 0.18,      // faktor low-pass pose
    dwellMs: 260,         // waktu tahan untuk ganti mode grip
    hapticEnabled: true,
    hapticIntensity: 58,  // 0..100
    hapticMode: 'proporsional', // proporsional | diskret | adaptif
    autoGrip: true,       // pilih grip otomatis dari pola kontraksi
    gripSet: ['open', 'power', 'pinch', 'tripod', 'lateral', 'hook']
  };

  function cal() { return Object.assign({}, DEFAULT_CAL, Store.get('device:cal', {})); }
  function profile() { return Object.assign({}, DEFAULT_PROFILE, Store.get('device:profile', {})); }

  /* ---------------- Event bus ---------------- */
  var handlers = {};
  function on(evt, fn) {
    (handlers[evt] = handlers[evt] || []).push(fn);
    return function () { handlers[evt] = handlers[evt].filter(function (f) { return f !== fn; }); };
  }
  function fire(evt, payload) {
    (handlers[evt] || []).forEach(function (f) {
      try { f(payload); } catch (e) { console.error('[Device] handler', evt, e); }
    });
  }

  /* ============================================================
     MOCK ADAPTER — simulator sEMG
     Menghasilkan sinyal realistis: baseline noise + burst
     kontraksi + drift kelelahan otot.
     ============================================================ */
  var Mock = (function () {
    var timer = null;
    var t = 0;
    var FPS = 30;

    // Skenario aktivitas: mendorong burst pada kanal tertentu
    var scenario = { mode: 'idle', until: 0, ch: null, level: 0 };
    var fatigue = 0;   // 0..1, naik saat kontraksi lama (menurunkan amplitudo)

    function burst(ch, level, ms) {
      scenario = { mode: 'burst', ch: ch, level: level, until: t + (ms || 900) / (1000 / FPS) };
    }

    function step() {
      t++;
      var c = cal();
      var out = {};

      // Auto-skenario: bergantian kontraksi fleksor/ekstensor agar demo hidup
      if (scenario.mode === 'idle' && Math.random() < 0.022) {
        var ch = Math.random() < 0.55 ? 'ch1' : (Math.random() < 0.7 ? 'ch2' : U.pick(['ch3', 'ch4']));
        burst(ch, U.rnd(0.45, 0.95), U.rnd(700, 1800));
      }
      if (scenario.mode === 'burst' && t > scenario.until) {
        scenario = { mode: 'idle', until: 0, ch: null, level: 0 };
      }

      CHANNELS.forEach(function (chDef) {
        var id = chDef.id;
        // Baseline noise fisiologis
        var noise = Math.abs(
          Math.sin(t * 0.31 + id.length) * 0.012 +
          (Math.random() - 0.5) * 0.055
        );
        var v = (c.baseline[id] || 0.04) + noise;

        // Burst kontraksi dengan envelope naik-turun halus
        if (scenario.mode === 'burst' && scenario.ch === id) {
          var span = Math.max(1, scenario.until - (scenario.until - 30));
          var prog = U.clamp(1 - (scenario.until - t) / 40, 0, 1);
          var envelope = Math.sin(Math.min(prog, 1) * Math.PI);
          v += scenario.level * Math.max(envelope, 0.35) * (1 - fatigue * 0.34);
          // Ripple frekuensi tinggi khas sEMG
          v += Math.abs(Math.sin(t * 1.9)) * 0.05 * scenario.level;
        }
        // Co-contraction ringan pada otot antagonis (realistis)
        if (scenario.mode === 'burst' && scenario.ch !== id && (id === 'ch1' || id === 'ch2')) {
          v += scenario.level * 0.11;
        }

        v = U.clamp(v * (c.gain[id] || 1), 0, 1.25);
        out[id] = U.round(v, 4);
      });

      // Kelelahan otot naik saat kontraksi, turun saat rileks
      var maxV = Math.max(out.ch1, out.ch2);
      fatigue = U.clamp(fatigue + (maxV > 0.4 ? 0.004 : -0.006), 0, 0.6);

      Device._ingest(out);

      // Telemetri lambat
      if (t % 90 === 0) {
        state.battery = U.clamp(state.battery - U.rnd(0.02, 0.09), 3, 100);
        state.temp = U.clamp(state.temp + U.rnd(-0.18, 0.22), 29, 39.5);
        state.humidity = U.clamp(state.humidity + U.rnd(-1.4, 1.7), 25, 82);
        state.signalQuality = U.clamp(state.signalQuality + U.rnd(-2.4, 2.2), 58, 99);
        state.latency = Math.round(U.clamp(state.latency + U.rnd(-4, 4), 22, 92));
        fire('telemetry', Device.snapshot());
      }
    }

    return {
      name: 'ASTA-Arm Simulator',
      start: function () {
        if (timer) return;
        timer = setInterval(step, 1000 / FPS);
      },
      stop: function () { clearInterval(timer); timer = null; },
      /** Untuk tombol demo manual */
      trigger: function (ch, level, ms) { burst(ch, level || 0.85, ms || 1000); },
      isRunning: function () { return !!timer; }
    };
  })();

  /* ============================================================
     BLUETOOTH ADAPTER — Web Bluetooth (hardware nyata)
     ============================================================ */
  var Ble = (function () {
    // UUID contoh; sesuaikan dengan firmware lengan ASTA
    var SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
    var CHAR_EMG = '0000fff1-0000-1000-8000-00805f9b34fb';   // notify: data EMG
    var CHAR_CMD = '0000fff2-0000-1000-8000-00805f9b34fb';   // write: perintah aktuator

    var dev = null, emgChar = null, cmdChar = null;

    function supported() {
      return typeof navigator !== 'undefined' && !!navigator.bluetooth;
    }

    function onData(e) {
      var v = e.target.value; // DataView
      // Format asumsi: 4 kanal x uint16 little-endian (0..4095)
      if (v.byteLength < 8) return;
      var out = {};
      CHANNELS.forEach(function (c, i) {
        out[c.id] = U.round(v.getUint16(i * 2, true) / 4095, 4);
      });
      // Byte tambahan opsional: baterai & suhu
      if (v.byteLength >= 10) state.battery = v.getUint8(8);
      if (v.byteLength >= 11) state.temp = U.round(v.getUint8(9) + v.getUint8(10) / 100, 1);
      Device._ingest(out);
    }

    return {
      name: 'Web Bluetooth',
      supported: supported,
      connect: function () {
        if (!supported()) {
          return Promise.reject(new Error(
            'Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome/Edge di HTTPS atau localhost, atau pakai Mode Simulator.'
          ));
        }
        return navigator.bluetooth.requestDevice({
          filters: [{ namePrefix: 'ASTA' }],
          optionalServices: [SERVICE]
        }).then(function (d) {
          dev = d;
          d.addEventListener('gattserverdisconnected', function () {
            state.connected = false;
            fire('disconnected', { reason: 'gatt' });
          });
          return d.gatt.connect();
        }).then(function (server) {
          return server.getPrimaryService(SERVICE);
        }).then(function (svc) {
          return Promise.all([
            svc.getCharacteristic(CHAR_EMG),
            svc.getCharacteristic(CHAR_CMD).catch(function () { return null; })
          ]);
        }).then(function (chars) {
          emgChar = chars[0]; cmdChar = chars[1];
          emgChar.addEventListener('characteristicvaluechanged', onData);
          return emgChar.startNotifications();
        }).then(function () {
          return dev.name || 'ASTA Arm';
        });
      },
      disconnect: function () {
        try {
          if (emgChar) emgChar.removeEventListener('characteristicvaluechanged', onData);
          if (dev && dev.gatt && dev.gatt.connected) dev.gatt.disconnect();
        } catch (e) { }
        dev = emgChar = cmdChar = null;
      },
      /** Kirim perintah ke aktuator: [opcode, ...payload] */
      send: function (bytes) {
        if (!cmdChar) return Promise.resolve(false);
        return cmdChar.writeValue(new Uint8Array(bytes)).then(function () { return true; })
          .catch(function () { return false; });
      }
    };
  })();

  /* ============================================================
     DEVICE — API publik
     ============================================================ */
  var Device = {};

  Device.CHANNELS = CHANNELS;
  Device.GRIPS = GRIPS;
  Device.state = state;

  Device.getCal = cal;
  Device.getProfile = profile;

  Device.saveCal = function (patch) {
    var next = Object.assign(cal(), patch);
    Store.set('device:cal', next);
    fire('cal', next);
    return next;
  };

  Device.saveProfile = function (patch) {
    var next = Object.assign(profile(), patch);
    Store.set('device:profile', next);
    fire('profile', next);
    return next;
  };

  Device.on = on;
  Device.bleSupported = Ble.supported;

  Device.snapshot = function () {
    return {
      connected: state.connected, mode: state.mode, deviceName: state.deviceName,
      battery: U.round(state.battery, 1), temp: U.round(state.temp, 1),
      humidity: Math.round(state.humidity), signalQuality: Math.round(state.signalQuality),
      latency: state.latency, firmware: state.firmware,
      raw: Object.assign({}, state.raw), rawUv: Object.assign({}, state.rawUv),
      grip: state.grip, gripPose: state.gripPose.slice(),
      force: Math.round(state.force), wristRot: Math.round(state.wristRot),
      actuatorCycles: state.actuatorCycles
    };
  };

  /* ---------------- Koneksi ---------------- */
  Device.connect = function (mode) {
    if (state.connected || state.connecting) return Promise.resolve(state);
    state.connecting = true;
    state.mode = mode || 'mock';
    fire('connecting', { mode: state.mode });

    if (state.mode === 'ble') {
      return Ble.connect().then(function (name) {
        state.connected = true; state.connecting = false;
        state.deviceName = name;
        state.activeSince = Date.now();
        fire('connected', Device.snapshot());
        startPoseLoop();
        return state;
      }).catch(function (err) {
        state.connecting = false;
        fire('error', err);
        throw err;
      });
    }

    // Mock: beri jeda singkat supaya UI terasa seperti handshake nyata
    return new Promise(function (resolve) {
      setTimeout(function () {
        state.connected = true; state.connecting = false;
        state.deviceName = Mock.name;
        state.activeSince = Date.now();
        Mock.start();
        startPoseLoop();
        fire('connected', Device.snapshot());
        resolve(state);
      }, 620);
    });
  };

  Device.disconnect = function () {
    Mock.stop();
    if (state.mode === 'ble') Ble.disconnect();
    stopPoseLoop();
    state.connected = false;
    state.activeSince = null;
    state.force = 0;
    state.targetPose = [0, 0, 0, 0, 0];
    fire('disconnected', { reason: 'user' });
  };

  /** Untuk tombol demo: paksa kontraksi kanal tertentu */
  Device.simulateContraction = function (ch, level, ms) {
    if (state.mode === 'mock') Mock.trigger(ch, level, ms);
  };

  /* ---------------- Pipeline sinyal -> gerak ---------------- */
  var lastGripSwitch = 0;
  var dwellStart = 0;
  var pendingGrip = null;

  Device._ingest = function (chVals) {
    var c = cal();
    var p = profile();

    // Normalisasi terhadap MVC & simpan
    CHANNELS.forEach(function (chDef) {
      var id = chDef.id;
      var v = chVals[id] || 0;
      var mvc = c.mvc[id] || 1;
      var norm = U.clamp((v - (c.baseline[id] || 0)) / Math.max(0.08, mvc - (c.baseline[id] || 0)), 0, 1.2);
      state.raw[id] = U.round(norm, 4);
      state.rawUv[id] = Math.round(v * 620); // perkiraan tampilan mikrovolt
    });

    if (!Device.calibrating) decideMotion(c, p);

    fire('signal', {
      raw: Object.assign({}, state.raw),
      rawUv: Object.assign({}, state.rawUv),
      force: Math.round(state.force),
      grip: state.grip
    });
  };

  /** Keputusan gerak berbasis threshold dua kanal utama */
  function decideMotion(c, p) {
    var flex = state.raw.ch1;      // menutup
    var ext = state.raw.ch2;       // membuka
    var bi = state.raw.ch3;        // rotasi pergelangan
    var tri = state.raw.ch4;       // ganti mode grip
    var thr = c.threshold;
    var now = Date.now();

    // Co-contraction (fleksor + ekstensor bersamaan) = perintah ganti grip
    var coCon = flex > thr.ch1 && ext > thr.ch2;

    if (coCon || tri > thr.ch4) {
      if (!dwellStart) dwellStart = now;
      if (now - dwellStart > p.dwellMs && now - lastGripSwitch > 700) {
        Device.cycleGrip();
        lastGripSwitch = now;
        dwellStart = 0;
      }
      // Saat ganti mode, jangan ubah gaya
      return;
    }
    dwellStart = 0;

    // Rotasi pergelangan dari bisep
    if (bi > thr.ch3) {
      state.wristRot = U.clamp(state.wristRot + (bi - thr.ch3) * 6, -90, 90);
    } else {
      state.wristRot *= 0.96;
    }

    // Menutup: gaya proporsional terhadap amplitudo di atas threshold
    if (flex > thr.ch1) {
      var drive = U.clamp((flex - thr.ch1) / Math.max(0.12, 1 - thr.ch1), 0, 1);
      var wanted = drive * p.forceLimit;
      state.force = U.lerp(state.force, wanted, 0.22 * (p.speed / 62));
      var g = GRIPS[state.grip] || GRIPS.power;
      var target = (state.grip === 'open' ? GRIPS.power : g).digits;
      state.targetPose = target.map(function (d) { return d * U.clamp(drive * 1.15, 0, 1); });
      if (state.grip === 'open') setGrip('power', true);
    } else if (ext > thr.ch2) {
      // Membuka
      state.force = U.lerp(state.force, 0, 0.3);
      state.targetPose = [0, 0, 0, 0, 0];
    } else {
      // Rileks: tahan posisi, gaya turun perlahan (fitur hemat energi)
      state.force = U.lerp(state.force, state.force * 0.9, 0.2);
      if (state.force < 1.5) state.force = 0;
    }

    // Umpan balik haptik proporsional terhadap gaya
    if (p.hapticEnabled) emitHaptic(p);
  }

  /* ---------------- Haptik ---------------- */
  var lastHapticBucket = -1;
  function emitHaptic(p) {
    var f = state.force;
    var bucket = Math.floor(f / 20);   // 5 tingkat
    if (bucket === lastHapticBucket) return;
    lastHapticBucket = bucket;
    if (f < 2) { fire('haptic', { level: 0, pad: -1, intensity: 0 }); return; }
    var intensity = (p.hapticMode === 'diskret')
      ? (bucket + 1) * 20
      : Math.round(f * (p.hapticIntensity / 100));
    fire('haptic', {
      level: bucket,
      pad: U.clamp(bucket, 0, 4),
      intensity: U.clamp(intensity, 0, 100),
      mode: p.hapticMode
    });
    // Getar perangkat pengguna sebagai proksi umpan balik (bila didukung)
    if (navigator.vibrate && p.hapticIntensity > 0) {
      try { navigator.vibrate(Math.round(8 + bucket * 6)); } catch (e) { }
    }
  }

  Device.testHaptic = function (padIndex) {
    var p = profile();
    fire('haptic', { level: padIndex, pad: padIndex, intensity: p.hapticIntensity, test: true });
    if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) { } }
  };

  /* ---------------- Kontrol grip ---------------- */
  function setGrip(name, silent) {
    if (!GRIPS[name]) return;
    state.grip = name;
    state.actuatorCycles++;
    if (state.mode === 'ble') Ble.send([0x01, Object.keys(GRIPS).indexOf(name)]);
    if (!silent) fire('grip', { grip: name, def: GRIPS[name] });
  }

  Device.setGrip = function (name) {
    setGrip(name);
    var g = GRIPS[name];
    if (g) state.targetPose = g.digits.slice();
    if (name === 'open') state.force = 0;
    fire('grip', { grip: name, def: g });
  };

  Device.cycleGrip = function () {
    var set = profile().gripSet.filter(function (g) { return GRIPS[g]; });
    if (!set.length) return;
    var i = set.indexOf(state.grip);
    var next = set[(i + 1) % set.length];
    Device.setGrip(next);
    fire('gripCycled', { grip: next });
  };

  Device.setWrist = function (deg) {
    state.wristRot = U.clamp(Number(deg) || 0, -90, 90);
    if (state.mode === 'ble') Ble.send([0x02, Math.round(state.wristRot) + 90]);
  };

  /** Kontrol manual (untuk pasien tanpa alat / uji pose) */
  Device.setForceManual = function (pct) {
    var p = profile();
    state.force = U.clamp(Number(pct) || 0, 0, p.forceLimit);
    var g = GRIPS[state.grip] || GRIPS.power;
    var drive = state.force / Math.max(1, p.forceLimit);
    state.targetPose = g.digits.map(function (d) { return d * drive; });
    if (p.hapticEnabled) emitHaptic(p);
  };

  /* ---------------- Loop penghalus pose (60fps) ---------------- */
  var poseRaf = null;
  function poseLoop() {
    var p = profile();
    var k = U.clamp(p.smoothing * (p.speed / 62), 0.05, 0.6);
    var changed = false;
    for (var i = 0; i < 5; i++) {
      var d = state.targetPose[i] - state.gripPose[i];
      if (Math.abs(d) > 0.002) {
        state.gripPose[i] += d * k;
        changed = true;
      } else {
        state.gripPose[i] = state.targetPose[i];
      }
    }
    if (changed) fire('pose', { pose: state.gripPose.slice(), grip: state.grip, force: state.force, wrist: state.wristRot });
    poseRaf = requestAnimationFrame(poseLoop);
  }
  function startPoseLoop() { if (!poseRaf) poseRaf = requestAnimationFrame(poseLoop); }
  function stopPoseLoop() { if (poseRaf) cancelAnimationFrame(poseRaf); poseRaf = null; }

  /* ============================================================
     KALIBRASI — wizard: baseline (rileks) lalu MVC (kontraksi maks)
     ============================================================ */
  Device.calibrating = false;

  /**
   * Rekam nilai puncak/rata-rata selama durasi tertentu.
   * @param {string} phase 'baseline' | 'mvc'
   * @param {number} ms durasi
   * @param {function} onTick (progress 0..1, nilai sementara)
   */
  Device.record = function (phase, ms, onTick) {
    return new Promise(function (resolve) {
      Device.calibrating = true;
      var samples = { ch1: [], ch2: [], ch3: [], ch4: [] };
      var start = Date.now();
      var dur = ms || 4000;

      // Saat kalibrasi MVC, dorong simulator agar menghasilkan kontraksi kuat
      var pusher = null;
      if (state.mode === 'mock' && phase === 'mvc') {
        pusher = setInterval(function () {
          CHANNELS.forEach(function (c) { Mock.trigger(c.id, U.rnd(0.82, 1.05), 700); });
        }, 620);
      }

      var iv = setInterval(function () {
        CHANNELS.forEach(function (c) {
          // Ambil nilai mentah pra-normalisasi dari rawUv
          samples[c.id].push(state.rawUv[c.id] / 620);
        });
        var prog = U.clamp((Date.now() - start) / dur, 0, 1);
        if (onTick) onTick(prog, samples);
        if (prog >= 1) {
          clearInterval(iv);
          if (pusher) clearInterval(pusher);
          Device.calibrating = false;

          var result = {};
          CHANNELS.forEach(function (c) {
            var arr = samples[c.id].filter(function (v) { return !isNaN(v); });
            if (!arr.length) { result[c.id] = phase === 'mvc' ? 1 : 0.05; return; }
            if (phase === 'mvc') {
              // Ambil persentil 85 agar tahan outlier
              var s = arr.slice().sort(function (a, b) { return a - b; });
              result[c.id] = U.round(Math.max(0.15, s[Math.floor(s.length * 0.85)]), 4);
            } else {
              result[c.id] = U.round(U.avg(arr), 4);
            }
          });
          resolve(result);
        }
      }, 60);
    });
  };

  Device.applyCalibration = function (baseline, mvc, autoThreshold) {
    var patch = { baseline: baseline, mvc: mvc, calibratedAt: new Date().toISOString() };
    if (autoThreshold !== false) {
      var thr = {};
      CHANNELS.forEach(function (c) {
        // Domain sudah ternormalisasi 0..1. Basis 28% rentang dinamis,
        // dinaikkan bila noise baseline relatif tinggi terhadap MVC
        // supaya tidak terjadi aktivasi palsu.
        var b = baseline[c.id] || 0;
        var m = Math.max(b + 0.1, mvc[c.id] || 1);
        var noiseRatio = U.clamp(b / m, 0, 0.5);
        thr[c.id] = U.round(U.clamp(0.28 + noiseRatio * 0.5, 0.18, 0.62), 3);
      });
      patch.threshold = thr;
    }
    return Device.saveCal(patch);
  };

  Device.isCalibrated = function () {
    return !!cal().calibratedAt;
  };

  /* ---------------- Ringkasan status untuk UI ---------------- */
  Device.statusText = function () {
    if (state.connecting) return { label: 'Menghubungkan…', dot: 'dot-warn' };
    if (!state.connected) return { label: 'Tidak terhubung', dot: 'dot-off' };
    return {
      label: state.mode === 'ble' ? 'Terhubung (Bluetooth)' : 'Terhubung (Simulator)',
      dot: 'dot-live'
    };
  };

  Device.wearMinutes = function () {
    if (!state.activeSince) return 0;
    return Math.round((Date.now() - state.activeSince) / 60000);
  };

  global.Device = Device;
})(window);
