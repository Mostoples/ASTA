/* ============================================================
   ASTA — UI primitives: toast, modal, confirm, ring, helper render
   ============================================================ */
(function (global) {
  'use strict';

  var UI = {};

  /* ---------------- Toast ---------------- */
  function toastHost() {
    var h = document.querySelector('.toast-host');
    if (!h) {
      h = U.el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(h);
    }
    return h;
  }

  var TOAST_ICO = { info: 'info', success: 'checkCircle', warning: 'alert', danger: 'alert' };

  UI.toast = function (msg, type, opts) {
    var o = opts || {};
    var t = type || 'info';
    var node = U.el('div', { class: 'toast ' + t, role: 'alert' },
      '<span class="t-ico">' + Icon(TOAST_ICO[t] || 'info', 20) + '</span>' +
      '<span class="grow">' +
      (o.title ? '<strong class="semi">' + U.esc(o.title) + '</strong><br>' : '') +
      '<span class="t-sm">' + U.esc(msg) + '</span>' +
      '</span>' +
      '<button class="btn btn-ghost btn-icon btn-sm" aria-label="Tutup notifikasi">' + Icon('x', 16) + '</button>'
    );
    var host = toastHost();
    host.appendChild(node);

    var timer = setTimeout(close, o.duration || 4200);
    function close() {
      clearTimeout(timer);
      node.classList.add('out');
      setTimeout(function () { node.remove(); }, 220);
    }
    node.querySelector('button').addEventListener('click', close);
    return close;
  };

  /* ---------------- Modal ---------------- */
  var openModals = [];

  UI.modal = function (opts) {
    var o = opts || {};
    var lastFocus = document.activeElement;

    var back = U.el('div', { class: 'modal-backdrop', role: 'presentation' });
    var box = U.el('div', {
      class: 'modal ' + (o.size || ''),
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': o.title || 'Dialog'
    });

    box.innerHTML =
      '<div class="row between mb-4">' +
      '<div><h3 id="mt">' + U.esc(o.title || '') + '</h3>' +
      (o.subtitle ? '<div class="card-sub">' + U.esc(o.subtitle) + '</div>' : '') + '</div>' +
      '<button class="btn btn-ghost btn-icon" data-close aria-label="Tutup dialog">' + Icon('x', 20) + '</button>' +
      '</div>' +
      '<div data-body></div>' +
      (o.footer === false ? '' : '<div class="row between mt-5" data-foot></div>');

    var body = box.querySelector('[data-body]');
    if (typeof o.content === 'string') body.innerHTML = o.content;
    else if (o.content) body.appendChild(o.content);

    var foot = box.querySelector('[data-foot]');
    if (foot) {
      var left = U.el('div', { class: 'row gap-2' });
      var right = U.el('div', { class: 'row gap-2' });
      foot.appendChild(left); foot.appendChild(right);
      (o.actions || []).forEach(function (a) {
        var b = U.el('button', { class: 'btn ' + (a.class || ''), type: 'button' },
          (a.icon ? Icon(a.icon, 18) : '') + '<span>' + U.esc(a.label) + '</span>');
        b.addEventListener('click', function () {
          if (a.onClick) {
            var r = a.onClick(api);
            if (r === false) return;
          }
          if (a.close !== false) api.close();
        });
        (a.align === 'left' ? left : right).appendChild(b);
      });
    }

    back.appendChild(box);
    document.body.appendChild(back);
    document.body.style.overflow = 'hidden';

    var api = {
      root: box,
      body: body,
      close: function () {
        back.remove();
        openModals = openModals.filter(function (m) { return m !== api; });
        if (!openModals.length) document.body.style.overflow = '';
        document.removeEventListener('keydown', onKey);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        if (o.onClose) o.onClose();
      }
    };
    openModals.push(api);

    function onKey(e) {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === api) {
        e.preventDefault();
        if (o.dismissible !== false) api.close();
      }
      if (e.key === 'Tab') trapFocus(e, box);
    }
    document.addEventListener('keydown', onKey);

    box.querySelector('[data-close]').addEventListener('click', function () { api.close(); });
    back.addEventListener('click', function (e) {
      if (e.target === back && o.dismissible !== false) api.close();
    });

    // Fokus awal
    setTimeout(function () {
      var f = box.querySelector('[autofocus]') || box.querySelector('input,select,textarea,button:not([data-close])');
      if (f) f.focus(); else box.focus();
    }, 40);

    if (o.onOpen) o.onOpen(api);
    return api;
  };

  function trapFocus(e, root) {
    var f = U.$$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', root)
      .filter(function (n) { return n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  UI.confirm = function (opts) {
    var o = opts || {};
    return new Promise(function (resolve) {
      UI.modal({
        title: o.title || 'Konfirmasi',
        size: 'sm',
        content: '<p class="muted-2">' + U.esc(o.message || 'Lanjutkan tindakan ini?') + '</p>',
        actions: [
          { label: o.cancelLabel || 'Batal', onClick: function () { resolve(false); } },
          {
            label: o.okLabel || 'Lanjutkan',
            class: o.danger ? 'btn-danger' : 'btn-primary',
            onClick: function () { resolve(true); }
          }
        ],
        onClose: function () { resolve(false); }
      });
    });
  };

  /* ---------------- Ring progress ---------------- */
  UI.ring = function (opts) {
    var o = opts || {};
    var size = o.size || 128;
    var sw = o.stroke || 12;
    var r = (size - sw) / 2;
    var c = 2 * Math.PI * r;
    var val = U.clamp(o.value || 0, 0, 100);
    var off = c * (1 - val / 100);
    var color = o.color || 'var(--primary)';

    return '<div class="ring-wrap" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + U.esc(o.aria || (val + ' persen')) + '">' +
      '<circle class="ring-bg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + sw + '"/>' +
      '<circle class="ring-fg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + sw + '" ' +
      'stroke="' + color + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/>' +
      '</svg>' +
      '<div class="ring-val">' + (o.label || '<div class="t-xl bold">' + val + '<span class="t-sm muted">%</span></div>') + '</div>' +
      '</div>';
  };

  /* ---------------- Statistik kartu ---------------- */
  UI.statCard = function (o) {
    var deltaHtml = '';
    if (o.delta !== undefined && o.delta !== null) {
      var up = Number(o.delta) >= 0;
      var good = o.invert ? !up : up;
      deltaHtml = '<span class="stat-delta ' + (good ? 'c-success' : 'c-danger') + '">' +
        Icon(up ? 'arrowUp' : 'arrowDown', 13) +
        U.esc(Math.abs(o.delta) + (o.deltaUnit || '%')) + '</span>';
    }
    return '<div class="card pad-sm">' +
      '<div class="row between gap-2">' +
      '<div class="stat grow">' +
      '<span class="stat-label">' + U.esc(o.label) + '</span>' +
      '<span class="stat-value">' + U.esc(o.value) +
      (o.unit ? ' <span class="stat-unit">' + U.esc(o.unit) + '</span>' : '') + '</span>' +
      (o.hint || deltaHtml ? '<span class="t-xs muted">' + deltaHtml + (o.hint ? ' ' + U.esc(o.hint) : '') + '</span>' : '') +
      '</div>' +
      (o.icon ? '<span class="stat-ico ' + (o.tone || '') + '">' + Icon(o.icon, 22) + '</span>' : '') +
      '</div></div>';
  };

  /* ---------------- Empty state ----------------
     Menggambar adegan SVG dari js/lib/illustrations.js. Nama adegan
     boleh ditentukan lewat `illus`; bila tidak, adegan dipilih dari
     `icon` supaya seluruh pemanggilan lama ikut terangkat tanpa
     perlu diubah. Bila pustaka ilustrasi tidak dimuat, tampilan
     kembali ke lingkaran berikon seperti sebelumnya. */
  UI.empty = function (o) {
    var art = (global.Illus && Illus.kosong)
      ? '<div class="e-art">' + Illus.kosong(o.illus || o.icon || 'kotak') + '</div>'
      : '<div class="e-ico">' + Icon(o.icon || 'info', 32) + '</div>';

    return '<div class="empty">' + art +
      '<div class="bold t-lg" style="color:var(--text-2)">' + U.esc(o.title || 'Belum ada data') + '</div>' +
      (o.desc ? '<p class="t-sm mt-2" style="max-width:44ch;margin-inline:auto">' + U.esc(o.desc) + '</p>' : '') +
      (o.action ? '<div class="mt-4">' + o.action + '</div>' : '') +
      '</div>';
  };

  /* ---------------- Accordion & Tabs binding ---------------- */
  UI.bindAccordions = function (root) {
    U.$$('.acc-head', root || document).forEach(function (h) {
      if (h.dataset.bound) return;
      h.dataset.bound = '1';
      h.addEventListener('click', function () {
        var acc = h.closest('.acc');
        var open = acc.dataset.open === 'true';
        acc.dataset.open = open ? 'false' : 'true';
        h.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
    });
  };

  /**
   * Tabs: butuh .tabs > .tab[data-tab] dan panel [data-panel]
   */
  UI.bindTabs = function (tabsEl, panelRoot, onChange) {
    if (!tabsEl) return;
    var tabs = U.$$('.tab', tabsEl);
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { activate(t.dataset.tab); });
      t.addEventListener('keydown', function (e) {
        var i = tabs.indexOf(t);
        if (e.key === 'ArrowRight') { e.preventDefault(); tabs[(i + 1) % tabs.length].focus(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); tabs[(i - 1 + tabs.length) % tabs.length].focus(); }
      });
    });
    function activate(name) {
      tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === name)); });
      if (panelRoot) {
        U.$$('[data-panel]', panelRoot).forEach(function (p) {
          p.classList.toggle('hidden', p.dataset.panel !== name);
        });
      }
      if (onChange) onChange(name);
    }
    var init = tabsEl.querySelector('.tab[aria-selected="true"]') || tabs[0];
    if (init) activate(init.dataset.tab);
    return activate;
  };

  /* ---------------- Segmented control ---------------- */
  UI.bindSeg = function (segEl, onChange) {
    if (!segEl) return;
    var btns = U.$$('button', segEl);
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        if (onChange) onChange(b.dataset.value, b);
      });
    });
  };

  /* ---------------- Sanitasi input angka ---------------- */
  UI.numVal = function (input, min, max, fallback) {
    var v = parseFloat(input && input.value);
    if (isNaN(v)) return fallback;
    return U.clamp(v, min, max);
  };

  global.UI = UI;
})(window);
