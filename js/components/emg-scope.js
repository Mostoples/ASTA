/* ============================================================
   ASTA — EMG Scope (osiloskop sinyal otot realtime)
   Menggambar 4 kanal sEMG bergulir + garis threshold.
   ============================================================ */
(function (global) {
  'use strict';

  var EmgScope = {};

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts { height, window (jumlah sampel), showThreshold }
   */
  EmgScope.create = function (canvas, opts) {
    if (!canvas) return null;
    var o = opts || {};
    var WIN = o.window || 190;
    var buf = {};
    Device.CHANNELS.forEach(function (c) { buf[c.id] = new Array(WIN).fill(0); });

    var raf = null;
    var dpr = window.devicePixelRatio || 1;
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var visible = {};
    Device.CHANNELS.forEach(function (c) { visible[c.id] = true; });

    function resize() {
      var w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
      var h = o.height || 210;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = w; H = h;
    }
    resize();
    var onResize = U.debounce(resize, 160);
    window.addEventListener('resize', onResize);

    var offSignal = Device.on('signal', function (d) {
      Device.CHANNELS.forEach(function (c) {
        buf[c.id].push(d.raw[c.id] || 0);
        if (buf[c.id].length > WIN) buf[c.id].shift();
      });
    });

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Latar gelap seperti monitor medis
      ctx.fillStyle = '#0d2148';
      ctx.fillRect(0, 0, W, H);

      var pad = { t: 14, r: 10, b: 20, l: 30 };
      var cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

      // Grid
      ctx.strokeStyle = 'rgba(120,168,240,.16)';
      ctx.lineWidth = 1;
      for (var i = 0; i <= 4; i++) {
        var y = pad.t + (ch / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
      }
      for (var k = 0; k <= 6; k++) {
        var x = pad.l + (cw / 6) * k;
        ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ch); ctx.stroke();
      }

      // Label sumbu Y (% MVC)
      ctx.fillStyle = 'rgba(180,210,255,.7)';
      ctx.font = '600 9.5px "Segoe UI", sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      [100, 75, 50, 25, 0].forEach(function (v, i) {
        ctx.fillText(v + '%', pad.l - 5, pad.t + (ch / 4) * i);
      });

      var cal = Device.getCal();

      // Garis threshold per kanal
      if (o.showThreshold !== false) {
        Device.CHANNELS.forEach(function (c) {
          if (!visible[c.id]) return;
          var thr = cal.threshold[c.id] || 0.3;
          var y = pad.t + ch - U.clamp(thr, 0, 1) * ch;
          ctx.strokeStyle = Chart.alpha(c.color, 0.42);
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      // Sinyal per kanal
      Device.CHANNELS.forEach(function (c) {
        if (!visible[c.id]) return;
        var data = buf[c.id];
        var thr = cal.threshold[c.id] || 0.3;
        var stepX = cw / (WIN - 1);

        // Area bayangan di bawah kurva saat melewati threshold
        ctx.beginPath();
        data.forEach(function (v, i) {
          var x = pad.l + i * stepX;
          var y = pad.t + ch - U.clamp(v, 0, 1.05) * ch;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Isi gradien halus
        ctx.lineTo(pad.l + cw, pad.t + ch);
        ctx.lineTo(pad.l, pad.t + ch);
        ctx.closePath();
        var g = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
        g.addColorStop(0, Chart.alpha(c.color, 0.3));
        g.addColorStop(1, Chart.alpha(c.color, 0));
        ctx.fillStyle = g;
        ctx.fill();

        // Titik nilai terkini + penanda aktif
        var last = data[data.length - 1];
        var lx = pad.l + cw, ly = pad.t + ch - U.clamp(last, 0, 1.05) * ch;
        var active = last > thr;
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.arc(lx, ly, active ? 4.6 : 3, 0, 7); ctx.fill();
        if (active) {
          ctx.strokeStyle = Chart.alpha(c.color, 0.5);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(lx, ly, 8.5, 0, 7); ctx.stroke();
        }
      });

      // Status tidak terhubung
      if (!Device.state.connected) {
        ctx.fillStyle = 'rgba(13,33,72,.72)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#a8c4f0';
        ctx.font = '600 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Lengan bionik belum terhubung', W / 2, H / 2 - 8);
        ctx.font = '600 11px "Segoe UI", sans-serif';
        ctx.fillStyle = 'rgba(168,196,240,.75)';
        ctx.fillText('Hubungkan alat atau jalankan Mode Simulator', W / 2, H / 2 + 12);
      }

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return {
      toggleChannel: function (chId, on) {
        visible[chId] = on === undefined ? !visible[chId] : !!on;
        return visible[chId];
      },
      isVisible: function (chId) { return !!visible[chId]; },
      destroy: function () {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        if (offSignal) offSignal();
      }
    };
  };

  /** Legend HTML untuk kanal */
  EmgScope.legend = function () {
    return '<div class="emg-legend">' + Device.CHANNELS.map(function (c) {
      return '<span><i style="background:' + c.color + '"></i>' + U.esc(c.name) + '</span>';
    }).join('') + '</div>';
  };

  /** Baris meter per kanal (bar + nilai) */
  EmgScope.meters = function (host) {
    if (!host) return null;
    host.innerHTML = '<div class="ch-meter">' + Device.CHANNELS.map(function (c) {
      return '<div class="ch-row">' +
        '<span class="ch-name" title="' + U.esc(c.muscle) + '">' + U.esc(c.name) + '</span>' +
        '<span class="ch-bar"><i data-bar="' + c.id + '" style="width:0%;background:' + c.color + '"></i>' +
        '<span class="thr" data-thr="' + c.id + '" style="left:30%"></span></span>' +
        '<span class="ch-val" data-val="' + c.id + '">0%</span>' +
        '</div>';
    }).join('') + '</div>';

    var bars = {}, vals = {}, thrs = {};
    Device.CHANNELS.forEach(function (c) {
      bars[c.id] = host.querySelector('[data-bar="' + c.id + '"]');
      vals[c.id] = host.querySelector('[data-val="' + c.id + '"]');
      thrs[c.id] = host.querySelector('[data-thr="' + c.id + '"]');
    });

    function syncThresholds() {
      var cal = Device.getCal();
      Device.CHANNELS.forEach(function (c) {
        if (thrs[c.id]) thrs[c.id].style.left = U.clamp((cal.threshold[c.id] || 0.3) * 100, 0, 100) + '%';
      });
    }
    syncThresholds();
    var offCal = Device.on('cal', syncThresholds);

    var off = Device.on('signal', U.throttle(function (d) {
      var cal = Device.getCal();
      Device.CHANNELS.forEach(function (c) {
        var v = U.clamp(d.raw[c.id] || 0, 0, 1.1);
        if (bars[c.id]) bars[c.id].style.width = (v * 100).toFixed(0) + '%';
        if (vals[c.id]) {
          vals[c.id].textContent = Math.round(v * 100) + '%';
          vals[c.id].style.color = v > (cal.threshold[c.id] || 0.3) ? c.color : 'var(--text-3)';
        }
      });
    }, 70));

    return { destroy: function () { off(); offCal(); } };
  };

  global.EmgScope = EmgScope;
})(window);
