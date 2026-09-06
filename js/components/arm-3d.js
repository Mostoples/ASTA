/* ============================================================
   ASTA — Penampil 3D Lengan Bionik
   ------------------------------------------------------------
   Memuat model assets/3d/asta-arm.glb (hasil Blender) dan
   menggerakkannya secara langsung dari Device: pose jari, rotasi
   pergelangan, gaya cengkeram, aktivitas elektroda EMG, dan denyut
   umpan balik haptik.

   Tiga tingkat penurunan mutu, dipilih otomatis:
     1. WebGL  -> model 3D penuh, bisa diputar dengan seret
     2. Sprite -> 36 bingkai render turntable (tanpa WebGL)
     3. SVG    -> ArmView 2D yang sudah ada

   three.js di-vendor lokal (js/vendor/three), tidak ada permintaan
   ke CDN saat runtime.
   ============================================================ */
(function (global) {
  'use strict';

  var Arm3D = {};

  /* Basis URL dihitung dari <script> ini agar tidak bergantung
     pada kedalaman folder halaman pemanggil. */
  var BASE = (function () {
    var s = document.currentScript;
    if (!s || !s.src) return '';
    return s.src.replace(/js\/components\/arm-3d\.js.*$/, '');
  })();

  var VENDOR = BASE + 'js/vendor/three/';
  var MODEL = BASE + 'assets/3d/asta-arm.glb';
  var TURNTABLE = BASE + 'assets/render/web/turntable/';
  var TT_FRAMES = 36;

  /* Urutan digit mengikuti Device.state.gripPose */
  var DIGITS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

  /* Sudut fleksi maksimum per ruas (derajat), meniru biomekanik jari:
     ruas distal menekuk lebih tajam daripada ruas proksimal. */
  var MAX_BEND = {
    thumb: [46, 40],
    index: [78, 84, 72],
    middle: [80, 86, 74],
    ring: [80, 86, 74],
    pinky: [82, 88, 76]
  };

  /* Sudut pandang siap pakai.

     Posisi kamera tidak ditulis sebagai koordinat mutlak: glTF memakai
     sumbu Y-atas sementara model dibangun Z-atas di Blender, sehingga
     koordinat kaku mudah meleset. Sebagai gantinya tiap pandangan hanya
     menyebut ARAH pandang, bagian yang disorot, dan jari-jari daerah
     yang harus muat. Jaraknya dihitung dari bidang pandang kamera. */
  var VIEWS = {
    penuh: { label: 'Lengan penuh', dir: [0.62, 0.42, 0.66], focus: null, radius: null, fov: 34 },
    tangan: { label: 'Tangan', dir: [0.70, 0.34, 0.62], focus: 'JNT_Palm', radius: 0.105, fov: 32 },
    telapak: { label: 'Telapak', dir: [0.20, -0.62, 0.75], focus: 'JNT_Palm', radius: 0.105, fov: 32 },
    siku: { label: 'Siku & socket', dir: [0.72, 0.36, 0.58], focus: 'JNT_Elbow', radius: 0.145, fov: 36 }
  };

  /* ---------------------------------------------------------
     Deteksi dukungan
     --------------------------------------------------------- */
  var _webgl = null;
  Arm3D.supported = function () {
    if (_webgl !== null) return _webgl;
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      _webgl = !!(gl && gl.getExtension);
      // Perangkat dengan memori sangat kecil lebih baik memakai sprite
      if (_webgl && navigator.deviceMemory && navigator.deviceMemory < 1) _webgl = false;
    } catch (e) {
      _webgl = false;
    }
    return _webgl;
  };

  /* Hormati preferensi gerakan pengguna */
  function reducedMotion() {
    return !!(global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------------------------------------------------------
     Pemuatan modul three.js (sekali per halaman)
     --------------------------------------------------------- */
  var _libP = null;
  function lib() {
    if (_libP) return _libP;
    _libP = Promise.all([
      import(VENDOR + 'three.module.js'),
      import(VENDOR + 'GLTFLoader.js'),
      import(VENDOR + 'OrbitControls.js'),
      import(VENDOR + 'RoomEnvironment.js')
    ]).then(function (m) {
      return {
        THREE: m[0],
        GLTFLoader: m[1].GLTFLoader,
        OrbitControls: m[2].OrbitControls,
        RoomEnvironment: m[3].RoomEnvironment
      };
    });
    return _libP;
  }

  /* Model dipakai bersama antar penampil pada satu halaman:
     unduh sekali, lalu tiap penampil memakai klon. */
  var _gltfP = null;
  function gltf(L) {
    if (_gltfP) return _gltfP;
    _gltfP = new Promise(function (resolve, reject) {
      new L.GLTFLoader().load(MODEL, function (g) { resolve(g); }, null, reject);
    });
    return _gltfP;
  }

  /* ---------------------------------------------------------
     Penampil WebGL
     --------------------------------------------------------- */
  function createWebGL(mount, o, done, fail) {
    lib().then(function (L) {
      var THREE = L.THREE;
      return gltf(L).then(function (g) { build(THREE, L, g); });
    }).catch(function (err) {
      console.warn('[Arm3D] WebGL gagal, beralih ke sprite:', err);
      fail(err);
    });

    function build(THREE, L, g) {
      var renderer = new THREE.WebGLRenderer({
        antialias: true, alpha: true, powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.cssText =
        'width:100%;height:100%;display:block;touch-action:none;cursor:grab;outline:none';
      renderer.domElement.setAttribute('tabindex', '0');
      renderer.domElement.setAttribute('role', 'img');
      renderer.domElement.setAttribute('aria-label',
        'Model 3D lengan bionik ASTA yang bergerak mengikuti sinyal otot. ' +
        'Seret untuk memutar pandangan.');
      mount.appendChild(renderer.domElement);

      var scene = new THREE.Scene();

      // Lingkungan studio ringan (tanpa berkas HDR eksternal)
      var pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new L.RoomEnvironment(), 0.04).texture;

      var viewName = VIEWS[o.view] ? o.view : 'penuh';
      var camera = new THREE.PerspectiveCamera(VIEWS[viewName].fov, 1, 0.02, 40);

      // Pencahayaan kunci + isian, meniru penataan render Blender
      var key = new THREE.DirectionalLight(0xffffff, 2.1);
      key.position.set(-0.9, 1.25, 0.85);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 0.1;
      key.shadow.camera.far = 4;
      key.shadow.camera.left = key.shadow.camera.bottom = -0.7;
      key.shadow.camera.right = key.shadow.camera.top = 0.7;
      key.shadow.bias = -0.0015;
      key.shadow.radius = 3;
      scene.add(key);

      var rim = new THREE.DirectionalLight(0x9dc0ff, 1.5);
      rim.position.set(0.7, 0.5, -1.1);
      scene.add(rim);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c9de, 0.7));

      // Model
      var model = g.scene.clone(true);
      var box = new THREE.Box3().setFromObject(model);
      var mid = box.getCenter(new THREE.Vector3());
      var pivot = new THREE.Group();
      // Titik berat lengan digeser ke pusat orbit agar rotasi terasa alami
      model.position.set(-mid.x, -mid.y, -mid.z);
      pivot.add(model);
      scene.add(pivot);

      // Jari-jari bola pembatas seluruh lengan, dipakai untuk menghitung
      // jarak kamera agar model selalu muat di bingkai berapa pun rasionya.
      var sphere = box.getBoundingSphere(new THREE.Sphere());
      var FULL_RADIUS = sphere.radius;

      // Bidang bayangan lembut (murah, tidak memakai ContactShadows)
      var floor = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2),
        new THREE.ShadowMaterial({ opacity: 0.11 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = box.min.y - mid.y - 0.012;
      floor.receiveShadow = true;
      scene.add(floor);

      // Indeks node yang akan dianimasikan + material yang boleh diubah.
      // Material di-klon agar beberapa penampil pada satu halaman
      // tidak saling mengubah warna.
      var joints = {}, electrodes = {}, leds = [], glowSources = [];
      DIGITS.forEach(function (k) { joints[k] = []; });

      model.traverse(function (n) {
        if (n.isMesh) {
          n.castShadow = true;
          n.receiveShadow = true;
          if (n.material) {
            n.material = n.material.clone();
            n.material.envMapIntensity = 0.85;
          }
        }
        var m = /^JNT_(thumb|index|middle|ring|pinky)_(\d)$/.exec(n.name);
        if (m) joints[m[1]][+m[2]] = n;
        var e = /^EL_(ch\d)$/.exec(n.name);
        if (e) {
          electrodes[e[1]] = n;
          if (n.material) n.material.toneMapped = false;
        }
        if (n.name === 'ASTA_StatusLED' && n.material) leds.push(n.material);
        if (/^SENSOR_/.test(n.name) && n.material) glowSources.push(n);
      });
      var wristNode = model.getObjectByName('JNT_Wrist');
      var thumbRoot = model.getObjectByName('JNT_thumb_root');
      var indexTip = model.getObjectByName('JNT_index_2');

      // Cincin denyut haptik: lingkaran tipis yang mengembang di ujung jari
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(0.012, 0.016, 40),
        new THREE.MeshBasicMaterial({
          color: 0x7a5af8, transparent: true, opacity: 0, side: THREE.DoubleSide,
          depthWrite: false, toneMapped: false
        })
      );
      scene.add(ring);

      // Kendali orbit: hanya putar & zoom; geser dimatikan supaya
      // model tidak pernah hilang dari bingkai.
      var controls = new L.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.075;
      controls.enablePan = false;
      controls.minDistance = 0.10;
      controls.maxDistance = FULL_RADIUS * 6;
      controls.minPolarAngle = 0.22;
      controls.maxPolarAngle = Math.PI - 0.22;
      controls.rotateSpeed = 0.85;
      controls.zoomSpeed = 0.7;
      controls.autoRotate = o.autoRotate !== false && !reducedMotion();
      controls.autoRotateSpeed = 0.9;

      /* Jarak kamera dihitung, bukan ditebak.

         Memakai jari-jari bola pembatas akan boros ruang untuk benda
         panjang-kurus seperti lengan: bolanya jauh lebih besar daripada
         siluetnya bila dilihat dari samping. Jadi kedelapan sudut kotak
         pembatas diproyeksikan ke bidang tegak lurus arah pandang, lalu
         jarak diambil dari rentang nyata di sumbu layar — hasilnya
         bingkai yang rapat pada rasio layar apa pun. */
      var _corners = [], _target = new THREE.Vector3(), _dir = new THREE.Vector3();
      var _right = new THREE.Vector3(), _up = new THREE.Vector3(), _v = new THREE.Vector3();
      var UP = new THREE.Vector3(0, 1, 0);
      (function () {
        for (var i = 0; i < 8; i++) {
          _corners.push(new THREE.Vector3(
            i & 1 ? box.max.x : box.min.x,
            i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z
          ).sub(mid));    // model sudah dipusatkan, jadi ikut digeser
        }
      })();

      function fitDistance(target, dir, radius) {
        var vFov = camera.fov * Math.PI / 180;
        var hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);

        // Untuk pandangan terfokus (tangan, siku) cukup pakai jari-jari
        if (radius) {
          return radius / Math.tan(Math.min(vFov, hFov) / 2) * 1.05;
        }

        _right.crossVectors(dir, UP).normalize();
        if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
        _up.crossVectors(_right, dir).normalize();

        var tanH = Math.tan(hFov / 2), tanV = Math.tan(vFov / 2);
        var need = 0;

        // Untuk tiap sudut kotak: jarak minimum agar sudut itu tetap di
        // dalam frustum. Perhitungan per-sudut (bukan gabungan lebar &
        // kedalaman terjauh) memberi bingkai yang benar-benar rapat.
        for (var i = 0; i < 8; i++) {
          _v.copy(_corners[i]).sub(target);
          var z = _v.dot(dir);                    // + = ke arah kamera
          need = Math.max(need,
            z + Math.abs(_v.dot(_right)) / tanH,
            z + Math.abs(_v.dot(_up)) / tanV);
        }
        return need * 1.04;
      }

      function applyView(name) {
        var v = VIEWS[name] || VIEWS.penuh;
        viewName = name;
        camera.fov = v.fov;
        camera.updateProjectionMatrix();

        var node = v.focus && model.getObjectByName(v.focus);
        if (node) node.getWorldPosition(_target);
        else _target.set(0, 0, 0);          // model sudah dipusatkan ke origin

        _dir.set(v.dir[0], v.dir[1], v.dir[2]).normalize();
        var dist = fitDistance(_target, _dir, v.radius);

        controls.target.copy(_target);
        camera.position.copy(_target).addScaledVector(_dir, dist);
        controls.update();
      }

      var idleTimer = null;
      function pauseAuto() {
        controls.autoRotate = false;
        clearTimeout(idleTimer);
        if (o.autoRotate !== false && !reducedMotion()) {
          idleTimer = setTimeout(function () { controls.autoRotate = true; }, 5200);
        }
      }
      controls.addEventListener('start', pauseAuto);
      renderer.domElement.addEventListener('pointerdown', function () {
        renderer.domElement.style.cursor = 'grabbing';
      });
      global.addEventListener('pointerup', function () {
        renderer.domElement.style.cursor = 'grab';
      });

      /* ---------- Ukuran & siklus render ---------- */
      var lastAspect = 0, userMoved = false;
      controls.addEventListener('start', function () { userMoved = true; });

      function resize() {
        var w = mount.clientWidth || 1, h = mount.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // Rasio berubah berarti lebar bingkai berubah: pasang ulang kamera
        // supaya lengan tetap muat — kecuali pengguna sudah memutar sendiri.
        if (!userMoved && Math.abs(camera.aspect - lastAspect) > 0.01) {
          applyView(viewName);
        }
        lastAspect = camera.aspect;
      }
      resize();
      var ro = global.ResizeObserver ? new ResizeObserver(resize) : null;
      if (ro) ro.observe(mount); else global.addEventListener('resize', resize);

      // Hemat baterai: hanya menggambar saat penampil terlihat
      var visible = true, running = true, raf = 0;
      var io = global.IntersectionObserver ? new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
      }, { threshold: 0.02 }) : null;
      if (io) io.observe(mount);

      function onVisibility() { visible = !document.hidden; }
      document.addEventListener('visibilitychange', onVisibility);

      // Pose ditemukan lewat interpolasi agar gerakan jari halus
      var target = { pose: [0, 0, 0, 0, 0], wrist: 0, force: 0, thumbRot: 0 };
      var shown = { pose: [0, 0, 0, 0, 0], wrist: 0, force: 0, thumbRot: 0 };
      var ringT = -1, ringFrom = 0;

      var clock = new THREE.Clock();

      function tick() {
        raf = requestAnimationFrame(tick);
        if (!running || !visible) return;
        var dt = Math.min(clock.getDelta(), 0.1);
        var k = 1 - Math.pow(0.0016, dt);   // pemulusan tak bergantung fps

        for (var i = 0; i < 5; i++) {
          shown.pose[i] += (target.pose[i] - shown.pose[i]) * k;
        }
        shown.wrist += (target.wrist - shown.wrist) * k;
        shown.force += (target.force - shown.force) * k;
        shown.thumbRot += (target.thumbRot - shown.thumbRot) * k;

        applyPose();
        applyForce();

        if (ringT >= 0) {
          ringT += dt / 0.46;
          if (ringT >= 1) {
            ringT = -1;
            ring.material.opacity = 0;
          } else {
            var s = 1 + ringT * 2.6;
            ring.scale.setScalar(s);
            ring.material.opacity = (1 - ringT) * ringFrom;
            ring.quaternion.copy(camera.quaternion);
          }
        }

        controls.update();
        renderer.render(scene, camera);
      }

      function applyPose() {
        DIGITS.forEach(function (key, di) {
          var v = shown.pose[di];
          var chain = joints[key], max = MAX_BEND[key];
          for (var i = 0; i < chain.length; i++) {
            if (!chain[i]) continue;
            // Ruas distal menekuk lebih tajam
            chain[i].rotation.x = -(max[i] * Math.PI / 180) * v * (0.62 + i * 0.19);
          }
        });
        if (thumbRoot) {
          // Oposisi ibu jari: berputar keluar bidang telapak
          thumbRoot.rotation.z = (34 + shown.thumbRot * 0.42) * Math.PI / 180;
        }
        if (wristNode) wristNode.rotation.y = shown.wrist * Math.PI / 180;
      }

      function applyForce() {
        var f = shown.force / 100;
        for (var i = 0; i < leds.length; i++) {
          if (leds[i].emissive) {
            leds[i].emissiveIntensity = 0.9 + f * 3.4;
          }
        }
        for (var j = 0; j < glowSources.length; j++) {
          var mt = glowSources[j].material;
          if (mt && mt.emissive) mt.emissiveIntensity = 0.4 + f * 4.6;
        }
      }

      tick();

      /* ---------- API ---------- */
      var api = {
        mode: '3d',
        el: renderer.domElement,

        setPose: function (pose, force, wristDeg, thumbRot) {
          for (var i = 0; i < 5; i++) {
            target.pose[i] = Math.min(1, Math.max(0, (pose && pose[i]) || 0));
          }
          if (force !== undefined) target.force = Math.min(100, Math.max(0, force));
          if (wristDeg !== undefined) target.wrist = wristDeg;
          if (thumbRot !== undefined) target.thumbRot = thumbRot;
        },

        highlightElectrodes: function (raw) {
          Object.keys(electrodes).forEach(function (id) {
            var mt = electrodes[id].material;
            if (!mt || !mt.emissive) return;
            var v = Math.min(1, Math.max(0, (raw && raw[id]) || 0));
            mt.emissiveIntensity = 0.5 + v * 6.5;
            electrodes[id].scale.setScalar(1 + v * 0.32);
          });
        },

        pulseHaptic: function (pad, intensity) {
          var tip = indexTip || model;
          tip.getWorldPosition(ring.position);
          ringFrom = Math.min(0.85, Math.max(0.2, (intensity || 50) / 100));
          ringT = 0;
        },

        setView: function (name) {
          if (!VIEWS[name]) return;
          userMoved = false;      // pandangan tersimpan boleh menata ulang lagi
          applyView(name);
          pauseAuto();
        },

        setAutoRotate: function (on) {
          controls.autoRotate = !!on && !reducedMotion();
        },

        resize: resize,

        destroy: function () {
          running = false;
          cancelAnimationFrame(raf);
          clearTimeout(idleTimer);
          document.removeEventListener('visibilitychange', onVisibility);
          if (ro) ro.disconnect(); else global.removeEventListener('resize', resize);
          if (io) io.disconnect();
          controls.dispose();
          scene.traverse(function (n) {
            if (n.isMesh) {
              n.geometry.dispose();
              if (n.material) [].concat(n.material).forEach(function (m) { m.dispose(); });
            }
          });
          pmrem.dispose();
          renderer.dispose();
          if (renderer.domElement.parentNode) renderer.domElement.remove();
        }
      };
      // Rujukan untuk pengujian otomatis (tools/verify-3d.js) dan
      // untuk kode halaman yang perlu menyentuh scene secara langsung.
      api.model = model;
      api.scene = scene;
      mount.__arm3d = api;

      done(api);
    }
  }

  /* ---------------------------------------------------------
     Penampil sprite turntable (cadangan tanpa WebGL)
     Memakai 36 bingkai render Blender; bisa diseret untuk memutar.
     --------------------------------------------------------- */
  function createSprite(mount, o, done) {
    var wrap = document.createElement('div');
    wrap.className = 'arm3d-sprite';
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label',
      'Render 3D lengan bionik ASTA. Seret untuk memutar 360 derajat.');
    wrap.setAttribute('tabindex', '0');

    var imgs = [];
    for (var i = 0; i < TT_FRAMES; i++) {
      var im = document.createElement('img');
      im.src = TURNTABLE + 'tt-' + String(i).padStart(2, '0') + '.webp';
      im.alt = '';
      im.decoding = 'async';
      im.loading = i === 0 ? 'eager' : 'lazy';
      im.hidden = i !== 0;
      wrap.appendChild(im);
      imgs.push(im);
    }
    mount.appendChild(wrap);

    var frame = 0, dragging = false, lastX = 0, spin = null;

    function show(n) {
      n = ((n % TT_FRAMES) + TT_FRAMES) % TT_FRAMES;
      if (n === frame) return;
      imgs[frame].hidden = true;
      imgs[n].hidden = false;
      frame = n;
    }

    function onDown(e) {
      dragging = true;
      lastX = (e.touches ? e.touches[0] : e).clientX;
      stopSpin();
      wrap.style.cursor = 'grabbing';
    }
    function onMove(e) {
      if (!dragging) return;
      var x = (e.touches ? e.touches[0] : e).clientX;
      var dx = x - lastX;
      if (Math.abs(dx) < 9) return;
      show(frame - Math.round(dx / 9));
      lastX = x;
      if (e.cancelable) e.preventDefault();
    }
    function onUp() { dragging = false; wrap.style.cursor = 'grab'; }

    function startSpin() {
      if (spin || reducedMotion() || o.autoRotate === false) return;
      spin = setInterval(function () { show(frame + 1); }, 110);
    }
    function stopSpin() { clearInterval(spin); spin = null; }

    wrap.addEventListener('pointerdown', onDown);
    global.addEventListener('pointermove', onMove, { passive: false });
    global.addEventListener('pointerup', onUp);
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { stopSpin(); show(frame - 1); }
      if (e.key === 'ArrowRight') { stopSpin(); show(frame + 1); }
    });
    startSpin();

    done({
      mode: 'sprite',
      el: wrap,
      setPose: function () {},               // sprite bersifat statis
      highlightElectrodes: function () {},
      pulseHaptic: function () {},
      setView: function () {},
      setAutoRotate: function (on) { on ? startSpin() : stopSpin(); },
      resize: function () {},
      destroy: function () {
        stopSpin();
        global.removeEventListener('pointermove', onMove);
        global.removeEventListener('pointerup', onUp);
        wrap.remove();
      }
    });
  }

  /* ---------------------------------------------------------
     Arm3D.create — penampil mandiri (tanpa panel kendali)
     --------------------------------------------------------- */
  Arm3D.create = function (host, opts) {
    if (!host) return null;
    var o = opts || {};

    var mount = document.createElement('div');
    mount.className = 'arm3d-canvas';
    host.appendChild(mount);

    var skeleton = document.createElement('div');
    skeleton.className = 'arm3d-loading';
    skeleton.innerHTML = '<span class="arm3d-spinner" aria-hidden="true"></span>' +
      '<span>Memuat model 3D…</span>';
    mount.appendChild(skeleton);

    var handle = {
      mode: 'loading', ready: false, inner: null,
      setPose: function () {}, highlightElectrodes: function () {},
      pulseHaptic: function () {}, setView: function () {},
      setAutoRotate: function () {}, resize: function () {},
      destroy: function () { mount.remove(); }
    };
    var queued = null;

    function adopt(inner) {
      skeleton.remove();
      handle.inner = inner;
      handle.mode = inner.mode;
      handle.ready = true;
      ['setPose', 'highlightElectrodes', 'pulseHaptic', 'setView',
        'setAutoRotate', 'resize'].forEach(function (fn) {
        handle[fn] = function () { return inner[fn].apply(inner, arguments); };
      });
      handle.destroy = function () { inner.destroy(); mount.remove(); };
      if (queued) inner.setPose.apply(inner, queued);
      if (typeof o.onReady === 'function') o.onReady(handle);
      host.dispatchEvent(new CustomEvent('arm3d:ready', { detail: handle, bubbles: true }));
    }

    // Pose yang masuk sebelum model siap tidak dibuang, tetapi ditahan.
    handle.setPose = function () { queued = [].slice.call(arguments); };

    if (Arm3D.supported() && o.mode !== 'sprite') {
      createWebGL(mount, o, adopt, function () { createSprite(mount, o, adopt); });
    } else {
      createSprite(mount, o, adopt);
    }
    return handle;
  };

  /* ---------------------------------------------------------
     ArmStage — pengganti langsung ArmView pada halaman aplikasi.

     Menyatukan penampil 3D dengan ArmView 2D dalam satu wadah,
     lengkap dengan tombol alih 3D/2D dan pilihan sudut pandang.
     Objek yang dikembalikan tetap memiliki properti .svg sehingga
     pemanggilan ArmView.highlightElectrodes(arm.svg, raw) yang sudah
     ada di halaman lain tetap berjalan.
     --------------------------------------------------------- */
  var ArmStage = {};
  var PREF_KEY = 'arm:viewmode';

  ArmStage.create = function (host, opts) {
    if (!host) return null;
    var o = opts || {};

    var wrap = host.querySelector('[data-armstage]');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.setAttribute('data-armstage', '1');
      wrap.className = 'arm3d-stage';
      host.appendChild(wrap);
    }
    wrap.innerHTML = '';

    // --- Bilah kendali
    var bar = document.createElement('div');
    bar.className = 'arm3d-bar';
    bar.innerHTML =
      '<div class="arm3d-toggle" role="group" aria-label="Mode tampilan lengan">' +
        '<button type="button" class="arm3d-toggle-btn" data-mode="3d" aria-pressed="false">3D</button>' +
        '<button type="button" class="arm3d-toggle-btn" data-mode="2d" aria-pressed="false">2D</button>' +
      '</div>' +
      '<div class="arm3d-views" hidden>' +
        Object.keys(VIEWS).map(function (k) {
          return '<button type="button" class="arm3d-view-btn" data-view="' + k + '">' +
            VIEWS[k].label + '</button>';
        }).join('') +
      '</div>';

    var pane3d = document.createElement('div');
    pane3d.className = 'arm3d-pane arm3d-pane-3d';
    var pane2d = document.createElement('div');
    pane2d.className = 'arm3d-pane arm3d-pane-2d';

    wrap.appendChild(pane3d);
    wrap.appendChild(pane2d);
    // Bilah diletakkan di bawah kanvas: sudut kiri-atas panggung sudah
    // dipakai badge status perangkat pada beberapa halaman.
    if (o.controls !== false) wrap.appendChild(bar);

    // ArmView 2D tetap dibangun: menjadi cadangan sekaligus menjaga
    // kompatibilitas dengan kode halaman yang membaca .svg
    var view2d = (global.ArmView && ArmView.create) ? ArmView.create(pane2d, o) : null;

    var view3d = Arm3D.create(pane3d, {
      view: o.view || 'penuh',
      autoRotate: o.autoRotate,
      onReady: function () { syncFromDevice(); }
    });

    /* --- Mode aktif: hormati pilihan terakhir pengguna --- */
    var mode = o.mode || readPref() || '3d';
    if (!Arm3D.supported() && mode === '3d') mode = '3d';   // sprite tetap "3d"

    function readPref() {
      try {
        return global.Store ? Store.get(PREF_KEY, null) : localStorage.getItem(PREF_KEY);
      } catch (e) { return null; }
    }
    function writePref(v) {
      try {
        if (global.Store) Store.set(PREF_KEY, v); else localStorage.setItem(PREF_KEY, v);
      } catch (e) { /* penyimpanan tidak tersedia — abaikan */ }
    }

    function setMode(next, remember) {
      mode = next;
      pane3d.hidden = next !== '3d';
      pane2d.hidden = next !== '2d';
      var views = bar.querySelector('.arm3d-views');
      if (views) views.hidden = next !== '3d' || view3d.mode === 'sprite';
      Array.prototype.forEach.call(bar.querySelectorAll('.arm3d-toggle-btn'), function (b) {
        var on = b.dataset.mode === next;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      if (next === '3d') view3d.resize();
      if (remember) writePref(next);
    }

    bar.addEventListener('click', function (e) {
      var t = e.target.closest('.arm3d-toggle-btn');
      if (t) { setMode(t.dataset.mode, true); return; }
      var v = e.target.closest('.arm3d-view-btn');
      if (v) {
        view3d.setView(v.dataset.view);
        Array.prototype.forEach.call(bar.querySelectorAll('.arm3d-view-btn'), function (b) {
          b.classList.toggle('active', b === v);
        });
      }
    });
    setMode(mode, false);

    /* --- Sinkronisasi dengan Device --- */
    var offPose = null, offHaptic = null, offEmg = null;

    /* Device tidak menyimpan sudut oposisi ibu jari pada state; nilainya
       melekat pada definisi pola cengkeram yang sedang aktif. */
    function thumbRotOf(grip) {
      var g = global.Device && Device.GRIPS[grip];
      return g ? (g.thumbRot || 0) : 0;
    }

    function syncFromDevice() {
      if (!global.Device) return;
      var s = Device.state;
      api.setPose(s.gripPose, s.force, s.wristRot, thumbRotOf(s.grip));
      if (s.raw) api.highlightElectrodes(s.raw);
    }

    var api = {
      /* Elemen SVG 2D — dipertahankan demi kode halaman yang sudah ada */
      get svg() { return view2d ? view2d.svg : null; },
      view3d: view3d,
      view2d: view2d,
      get mode() { return mode; },

      setPose: function (pose, force, wristDeg, thumbRot) {
        if (view2d) view2d.setPose(pose, force, wristDeg);
        view3d.setPose(pose, force, wristDeg, thumbRot);
      },
      highlightElectrodes: function (raw) {
        if (view2d && global.ArmView) ArmView.highlightElectrodes(view2d.svg, raw);
        view3d.highlightElectrodes(raw);
      },
      pulseHaptic: function (pad, intensity) {
        if (view2d) view2d.pulseHaptic(pad, intensity);
        view3d.pulseHaptic(pad, intensity);
      },
      setView: function (v) { view3d.setView(v); },
      setMode: function (m) { setMode(m, true); },
      resize: function () { view3d.resize(); },
      destroy: function () {
        if (offPose) offPose();
        if (offHaptic) offHaptic();
        if (offEmg) offEmg();
        view3d.destroy();
        if (view2d) view2d.destroy();
        wrap.remove();
      }
    };

    if (global.Device) {
      offPose = Device.on('pose', function (d) {
        api.setPose(d.pose, d.force, d.wrist, thumbRotOf(d.grip));
      });
      offHaptic = Device.on('haptic', function (h) {
        if (h.intensity > 0) api.pulseHaptic(h.pad, h.intensity);
      });
      offEmg = Device.on('signal', function (d) {
        if (d && d.raw) view3d.highlightElectrodes(d.raw);
      });
      syncFromDevice();
    }

    return api;
  };

  Arm3D.VIEWS = VIEWS;
  global.Arm3D = Arm3D;
  global.ArmStage = ArmStage;
})(window);
