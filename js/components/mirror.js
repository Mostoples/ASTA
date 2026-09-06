/* ============================================================
   ASTA — Terapi Cermin Digital
   ------------------------------------------------------------
   Prinsip: pasien menggerakkan tangan yang sehat di depan
   kamera. Separuh layar menampilkan tangan sehat, separuh
   lainnya menampilkan bayangan cerminnya pada posisi lengan
   yang diamputasi. Otak menerima umpan balik visual seolah
   lengan yang hilang bergerak, yang pada banyak kasus
   menurunkan nyeri phantom.

   Catatan privasi: aliran video diproses sepenuhnya di dalam
   peramban. Tidak ada frame yang dikirim ke mana pun.
   ============================================================ */
(function (global) {
  'use strict';

  var Mirror = {};

  /**
   * @param {HTMLElement} host
   * @param {object} opts { side: 'Kanan'|'Kiri', onStatus: fn(state, msg) }
   */
  Mirror.create = function (host, opts) {
    if (!host) return null;
    var o = opts || {};
    // Amputasi kanan -> bayangan ditempatkan di sisi kanan layar
    var mirrorRight = o.side !== 'Kiri';

    host.innerHTML =
      '<div class="mirror-stage" id="mirror-stage">' +
      '<video id="mirror-video" class="src-hidden" playsinline muted autoplay></video>' +
      '<canvas id="mirror-canvas"></canvas>' +
      '<div class="mirror-divider"></div>' +
      '<div class="mirror-off" id="mirror-off">' +
      '<div style="width:66px;height:66px;margin:0 auto 14px;border-radius:50%;' +
      'background:rgba(255,255,255,.1);display:grid;place-items:center">' +
      Icon('camera', 30) + '</div>' +
      '<div class="bold">Kamera belum aktif</div>' +
      '<div class="t-sm mt-2" style="opacity:.8;max-width:38ch;margin-inline:auto">' +
      'Letakkan tangan sehat Anda di depan kamera. Bayangan cerminnya akan tampil ' +
      'pada posisi lengan yang diamputasi.</div>' +
      '</div>' +
      '<div class="mirror-hint hidden" id="mirror-hint"></div>' +
      '</div>';

    var video = U.$('#mirror-video', host);
    var canvas = U.$('#mirror-canvas', host);
    var offBox = U.$('#mirror-off', host);
    var hintBox = U.$('#mirror-hint', host);
    var ctx = canvas.getContext('2d');
    var stream = null, raf = null, running = false;

    function status(state, msg) {
      if (o.onStatus) o.onStatus(state, msg);
    }

    function sizeCanvas() {
      var r = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(2, Math.round(r.width * dpr));
      canvas.height = Math.max(2, Math.round(r.height * dpr));
    }

    function draw() {
      if (!running) return;
      if (video.readyState >= 2) {
        var W = canvas.width, H = canvas.height;
        var vw = video.videoWidth, vh = video.videoHeight;
        if (vw && vh) {
          ctx.clearRect(0, 0, W, H);

          // Hitung crop agar video mengisi kanvas tanpa distorsi
          var scale = Math.max(W / vw, H / vh);
          var dw = vw * scale, dh = vh * scale;
          var dx = (W - dw) / 2, dy = (H - dh) / 2;

          var halfW = W / 2;

          // --- Sisi sumber: tangan sehat ---
          ctx.save();
          ctx.beginPath();
          ctx.rect(mirrorRight ? 0 : halfW, 0, halfW, H);
          ctx.clip();
          // Kamera depan menampilkan bayangan; balik agar terasa natural
          ctx.translate(W, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, W - dx - dw, dy, dw, dh);
          ctx.restore();

          // --- Sisi cermin: bayangan pada posisi lengan yang hilang ---
          ctx.save();
          ctx.beginPath();
          ctx.rect(mirrorRight ? halfW : 0, 0, halfW, H);
          ctx.clip();
          // Cerminkan terhadap garis tengah
          ctx.translate(halfW * (mirrorRight ? 2 : 0), 0);
          ctx.scale(-1, 1);
          ctx.translate(mirrorRight ? 0 : -W, 0);
          ctx.translate(W, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, W - dx - dw, dy, dw, dh);
          ctx.restore();

          // Sedikit vignet supaya fokus ke tengah
          var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, 'rgba(6,18,38,.42)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
      }
      raf = requestAnimationFrame(draw);
    }

    var onResize = U.debounce(sizeCanvas, 180);

    var api = {
      start: function () {
        if (running) return Promise.resolve(true);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          var e = new Error('Peramban ini tidak mendukung akses kamera. Gunakan mode animasi.');
          status('error', e.message);
          return Promise.reject(e);
        }
        status('requesting', 'Menunggu izin kamera…');
        return navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        }).then(function (s) {
          stream = s;
          video.srcObject = s;
          return video.play().catch(function () { });
        }).then(function () {
          running = true;
          offBox.classList.add('hidden');
          hintBox.classList.remove('hidden');
          sizeCanvas();
          window.addEventListener('resize', onResize);
          raf = requestAnimationFrame(draw);
          status('running', 'Kamera aktif');
          return true;
        }).catch(function (err) {
          var msg = err && err.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Anda tetap bisa memakai mode animasi.'
            : err && err.name === 'NotFoundError'
              ? 'Kamera tidak ditemukan pada perangkat ini.'
              : (err && err.message) || 'Gagal mengakses kamera.';
          status('error', msg);
          throw new Error(msg);
        });
      },

      stop: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        window.removeEventListener('resize', onResize);
        if (stream) {
          stream.getTracks().forEach(function (t) { t.stop(); });
          stream = null;
        }
        video.srcObject = null;
        offBox.classList.remove('hidden');
        hintBox.classList.add('hidden');
        try { ctx.clearRect(0, 0, canvas.width, canvas.height); } catch (e) { }
        status('stopped', 'Kamera dimatikan');
      },

      setHint: function (text) {
        hintBox.textContent = text || '';
        hintBox.classList.toggle('hidden', !text);
      },

      isRunning: function () { return running; },

      /** Ambil cuplikan untuk dokumentasi sesi (tetap lokal) */
      snapshot: function () {
        try { return canvas.toDataURL('image/jpeg', 0.7); } catch (e) { return null; }
      },

      destroy: function () {
        api.stop();
        host.innerHTML = '';
      }
    };

    return api;
  };

  /* ============================================================
     Mode animasi — alternatif tanpa kamera
     Menampilkan dua tangan bergerak simetris. Berguna untuk
     pasien yang tidak nyaman memakai kamera, atau perangkat
     tanpa kamera.
     ============================================================ */
  Mirror.createAnimated = function (host, opts) {
    if (!host) return null;
    var o = opts || {};
    var side = o.side !== 'Kiri' ? 'Kanan' : 'Kiri';

    host.innerHTML =
      '<div class="mirror-stage" style="background:linear-gradient(160deg,#0f2a58,#0b1c3d)">' +
      '<div class="mirror-divider"></div>' +
      '<div style="position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;' +
      'align-items:center;justify-items:center;padding:16px;z-index:2">' +
      '<div id="anim-a" style="width:78%;max-width:190px"></div>' +
      '<div id="anim-b" style="width:78%;max-width:190px"></div>' +
      '</div>' +
      '<div class="mirror-hint" id="anim-hint">Bayangkan kedua tangan bergerak bersamaan</div>' +
      '</div>';

    var a = U.$('#anim-a', host), b = U.$('#anim-b', host);
    var hint = U.$('#anim-hint', host);
    var running = false, raf = null, t = 0;
    var sequence = ['open', 'fist', 'open', 'pinch', 'open', 'point'];
    var seqIdx = 0, lastSwitch = 0;

    function render(bend, pose) {
      var poseDef = HandShapes.POSES.find(function (p) { return p.key === pose; }) || HandShapes.POSES[0];
      var digits = poseDef.digits.map(function (d) { return d * bend; });
      // Sisi sehat & sisi phantom digambar bercermin
      a.innerHTML = HandShapes.render(side === 'Kanan' ? 'kiri' : 'kanan', digits, 0, 'dorsal');
      b.innerHTML = HandShapes.render(side === 'Kanan' ? 'kanan' : 'kiri', digits, 0, 'dorsal');
      // Beri kesan bayangan pada sisi phantom
      b.style.opacity = '0.86';
      b.style.filter = 'drop-shadow(0 0 12px rgba(122,180,255,.5))';
    }

    function loop() {
      if (!running) return;
      t += 1 / 60;
      // Gerak buka-tutup halus 3,4 detik per siklus
      var bend = (1 - Math.cos(t * (Math.PI * 2) / 3.4)) / 2;
      if (t - lastSwitch > 10.2) { seqIdx = (seqIdx + 1) % sequence.length; lastSwitch = t; }
      var pose = sequence[seqIdx];
      render(bend, pose);
      var label = HandShapes.POSES.find(function (p) { return p.key === pose; });
      hint.textContent = bend > 0.5
        ? 'Bayangkan tangan ' + (label ? label.label : 'bergerak')
        : 'Bayangkan tangan kembali rileks';
      raf = requestAnimationFrame(loop);
    }

    render(0, 'open');

    return {
      start: function () {
        if (running) return Promise.resolve(true);
        running = true; t = 0; lastSwitch = 0;
        raf = requestAnimationFrame(loop);
        if (o.onStatus) o.onStatus('running', 'Mode animasi aktif');
        return Promise.resolve(true);
      },
      stop: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        render(0, 'open');
        if (o.onStatus) o.onStatus('stopped', 'Animasi dihentikan');
      },
      setHint: function (txt) { hint.textContent = txt || ''; },
      isRunning: function () { return running; },
      snapshot: function () { return null; },
      destroy: function () { running = false; if (raf) cancelAnimationFrame(raf); host.innerHTML = ''; }
    };
  };

  global.Mirror = Mirror;
})(window);
