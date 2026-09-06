/* ============================================================
   ASTA — App Shell
   Merender sidebar, topbar, dan status perangkat pada
   semua halaman aplikasi. Menu disesuaikan per peran.
   ============================================================ */
(function (global) {
  'use strict';

  var Shell = {};

  /* ---------------- Definisi menu per peran ---------------- */
  var MENU = {
    pasien: [
      { group: 'Utama', items: [
        { href: 'pasien-dashboard.html', icon: 'home', label: 'Dasbor' },
        { href: 'sesi-latihan.html', icon: 'activity', label: 'Sesi Latihan' },
        { href: 'jadwal.html', icon: 'calendar', label: 'Jadwal & Pengingat' }
      ]},
      { group: 'Phantom Pain', items: [
        { href: 'catatan-nyeri.html', icon: 'brain', label: 'Catatan Nyeri' },
        { href: 'terapi-phantom.html', icon: 'mirror', label: 'Terapi Cermin & GMI' }
      ]},
      { group: 'Lengan Bionik', items: [
        { href: 'perangkat.html', icon: 'cpu', label: 'Perangkat & EMG' },
        { href: 'kalibrasi.html', icon: 'sliders', label: 'Kalibrasi' },
        { href: 'model-3d.html', icon: 'grid', label: 'Studio 3D' }
      ]},
      { group: 'Lainnya', items: [
        { href: 'progres.html', icon: 'chart', label: 'Progres & Analisis' },
        { href: 'notifikasi.html', icon: 'bell', label: 'Notifikasi', badge: 'notif' },
        { href: 'pengaturan.html', icon: 'settings', label: 'Pengaturan' }
      ]}
    ],
    terapis: [
      { group: 'Utama', items: [
        { href: 'terapis-dashboard.html', icon: 'home', label: 'Dasbor Klinis' },
        { href: 'terapis-pasien.html', icon: 'users', label: 'Daftar Pasien' },
        { href: 'terapis-program.html', icon: 'clipboard', label: 'Resep Program' }
      ]},
      { group: 'Pemantauan', items: [
        { href: 'terapis-kepatuhan.html', icon: 'target', label: 'Kepatuhan' },
        { href: 'terapis-nyeri.html', icon: 'brain', label: 'Pemantauan Nyeri' }
      ]},
      { group: 'Lainnya', items: [
        { href: 'model-3d.html', icon: 'grid', label: 'Studio 3D' },
        { href: 'jadwal.html', icon: 'calendar', label: 'Jadwal & Konsultasi' },
        { href: 'notifikasi.html', icon: 'bell', label: 'Notifikasi', badge: 'notif' },
        { href: 'pengaturan.html', icon: 'settings', label: 'Pengaturan' }
      ]}
    ],
    prostetis: [
      { group: 'Utama', items: [
        { href: 'prostetis-dashboard.html', icon: 'home', label: 'Dasbor Teknis' },
        { href: 'perangkat.html', icon: 'cpu', label: 'Monitor Perangkat' },
        { href: 'kalibrasi.html', icon: 'sliders', label: 'Kalibrasi & Tuning' },
        { href: 'model-3d.html', icon: 'grid', label: 'Studio 3D' }
      ]},
      { group: 'Lainnya', items: [
        { href: 'jadwal.html', icon: 'calendar', label: 'Jadwal Servis' },
        { href: 'notifikasi.html', icon: 'bell', label: 'Notifikasi', badge: 'notif' },
        { href: 'pengaturan.html', icon: 'settings', label: 'Pengaturan' }
      ]}
    ],
    admin: [
      { group: 'Utama', items: [
        { href: 'admin-dashboard.html', icon: 'home', label: 'Dasbor Admin' },
        { href: 'terapis-pasien.html', icon: 'users', label: 'Semua Pasien' }
      ]},
      { group: 'Lainnya', items: [
        { href: 'model-3d.html', icon: 'grid', label: 'Studio 3D' },
        { href: 'jadwal.html', icon: 'calendar', label: 'Jadwal Klinik' },
        { href: 'notifikasi.html', icon: 'bell', label: 'Notifikasi', badge: 'notif' },
        { href: 'pengaturan.html', icon: 'settings', label: 'Pengaturan' }
      ]}
    ]
  };

  /* ---------------- Render ---------------- */
  /**
   * @param {object} opts { title, desc, actions (html), activeHref }
   * @returns {object} { content, user, session }
   */
  Shell.mount = function (opts) {
    var o = opts || {};
    var user = Auth.user();
    var session = Auth.current();
    if (!user || !session) return null;

    var role = Auth.role(session.role);
    var here = o.activeHref || location.pathname.split('/').pop() || '';

    document.title = (o.title ? o.title + ' — ' : '') + 'ASTA';

    var app = U.el('div', { class: 'app' });
    app.appendChild(buildSidebar(user, session, role, here));

    var main = U.el('div', { class: 'main' });
    var topbar = buildTopbar(o, user, session);
    main.appendChild(topbar);

    // Hiasan SVG khas halaman, dipasang di belakang judul.
    // Motifnya dipilih menurut makna halaman (lihat js/lib/decor.js).
    if (global.Decor) {
      var motif = Decor.forPage(here);
      if (motif) {
        topbar.classList.add('decor-host');
        Decor.mount(topbar, motif.name, {
          seed: motif.seed, tone: motif.tone, pos: 'right'
        });
      }
    }

    var content = U.el('main', { class: 'content', id: 'main-content', tabindex: '-1' });
    main.appendChild(content);

    main.appendChild(U.el('footer', { class: 'footer' },
      'ASTA — Adaptive Sensory-feedback Telerehabilitation Arm · Prototipe penelitian, bukan alat diagnostik'));

    app.appendChild(main);

    var skip = U.el('a', { class: 'skip-link', href: '#main-content' }, 'Lompat ke konten utama');
    document.body.insertBefore(skip, document.body.firstChild);
    document.body.appendChild(app);

    // Navigasi bawah untuk ponsel: menu utama berada dalam
    // jangkauan ibu jari, penting bagi pengguna satu tangan.
    document.body.appendChild(buildTabbar(user, session, here));

    applyA11ySettings();
    bindShell();
    startDeviceStatusSync();
    Notify.startReminderLoop();

    return { content: content, user: user, session: session, role: role };
  };

  function buildSidebar(user, session, role, here) {
    var menu = MENU[session.role] || [];
    var unread = Notify.unreadCount(user.id);

    var navHtml = menu.map(function (g) {
      return '<div class="nav-group">' +
        '<div class="nav-group-title">' + U.esc(g.group) + '</div>' +
        g.items.map(function (it) {
          var active = here === it.href;
          var badge = '';
          if (it.badge === 'notif' && unread > 0) {
            badge = '<span class="n-badge">' + (unread > 9 ? '9+' : unread) + '</span>';
          }
          return '<a class="nav-item' + (active ? ' active' : '') + '" href="' + it.href + '"' +
            (active ? ' aria-current="page"' : '') + '>' +
            '<span class="n-ico">' + Icon(it.icon, 20) + '</span>' +
            '<span class="grow truncate">' + U.esc(it.label) + '</span>' + badge +
            '</a>';
        }).join('') +
        '</div>';
    }).join('');

    var sb = U.el('aside', { class: 'sidebar', id: 'sidebar', 'aria-label': 'Navigasi utama' });
    sb.innerHTML =
      '<button class="btn-close-drawer" id="btn-close-drawer" aria-label="Tutup menu">' +
      Icon('x', 20) + '</button>' +
      '<div class="brand">' +
      '<span class="brand-mark">' + logoSvg(26) + '</span>' +
      '<span><span class="brand-name">ASTA</span>' +
      '<span class="brand-tag">Telerehabilitasi</span></span>' +
      '</div>' +
      '<nav class="nav">' + navHtml + '</nav>' +
      '<div class="sidebar-foot col gap-2">' +
      '<div class="device-mini" id="device-mini">' +
      '<span class="dot dot-off" id="dm-dot"></span>' +
      '<span class="grow"><span class="semi" id="dm-label">Alat tidak terhubung</span>' +
      '<br><span class="muted" id="dm-sub">Buka halaman Perangkat</span></span>' +
      '</div>' +
      '<div class="row gap-2">' +
      '<span class="avatar sm ' + U.esc(user.avatar || '') + '">' + U.esc(U.initials(user.name)) + '</span>' +
      '<span class="grow" style="min-width:0">' +
      '<span class="t-sm semi truncate" style="display:block">' + U.esc(user.name) + '</span>' +
      '<span class="t-xs muted">' + U.esc(role.label) + '</span></span>' +
      '<button class="btn btn-ghost btn-icon btn-sm" id="btn-logout" data-tip="Keluar" aria-label="Keluar">' +
      Icon('logout', 18) + '</button>' +
      '</div>' +
      '</div>';
    return sb;
  }

  /* ---------------- Navigasi bawah (ponsel) ---------------- */
  /* Lima tujuan tersering per peran. Menu lengkap tetap
     tersedia lewat tombol menu di topbar. */
  var TABBAR = {
    pasien: [
      { href: 'pasien-dashboard.html', icon: 'home', label: 'Dasbor' },
      { href: 'sesi-latihan.html', icon: 'activity', label: 'Latihan' },
      { href: 'catatan-nyeri.html', icon: 'brain', label: 'Nyeri' },
      { href: 'perangkat.html', icon: 'cpu', label: 'Alat' },
      { href: 'progres.html', icon: 'chart', label: 'Progres' }
    ],
    terapis: [
      { href: 'terapis-dashboard.html', icon: 'home', label: 'Dasbor' },
      { href: 'terapis-pasien.html', icon: 'users', label: 'Pasien' },
      { href: 'terapis-kepatuhan.html', icon: 'target', label: 'Patuh' },
      { href: 'terapis-nyeri.html', icon: 'brain', label: 'Nyeri' },
      { href: 'notifikasi.html', icon: 'bell', label: 'Notif', badge: true }
    ],
    prostetis: [
      { href: 'prostetis-dashboard.html', icon: 'home', label: 'Dasbor' },
      { href: 'perangkat.html', icon: 'cpu', label: 'Monitor' },
      { href: 'kalibrasi.html', icon: 'sliders', label: 'Kalibrasi' },
      { href: 'jadwal.html', icon: 'calendar', label: 'Servis' },
      { href: 'notifikasi.html', icon: 'bell', label: 'Notif', badge: true }
    ],
    admin: [
      { href: 'admin-dashboard.html', icon: 'home', label: 'Dasbor' },
      { href: 'terapis-pasien.html', icon: 'users', label: 'Pasien' },
      { href: 'jadwal.html', icon: 'calendar', label: 'Jadwal' },
      { href: 'notifikasi.html', icon: 'bell', label: 'Notif', badge: true },
      { href: 'pengaturan.html', icon: 'settings', label: 'Atur' }
    ]
  };

  function buildTabbar(user, session, here) {
    var items = TABBAR[session.role] || [];
    var unread = Notify.unreadCount(user.id);

    var nav = U.el('nav', {
      class: 'tabbar',
      'aria-label': 'Navigasi cepat'
    });
    nav.innerHTML = items.map(function (it) {
      var active = here === it.href;
      return '<a href="' + it.href + '"' + (active ? ' class="active" aria-current="page"' : '') + '>' +
        '<span class="tb-ico">' + Icon(it.icon, 21) + '</span>' +
        '<span class="tb-label">' + U.esc(it.label) + '</span>' +
        (it.badge && unread ? '<span class="tb-dot"></span>' : '') +
        '</a>';
    }).join('');
    return nav;
  }

  function buildTopbar(o, user, session) {
    var tb = U.el('header', { class: 'topbar' });
    var unread = Notify.unreadCount(user.id);
    tb.innerHTML =
      '<button class="btn btn-ghost btn-icon btn-menu" id="btn-menu" aria-label="Buka menu" aria-expanded="false">' +
      Icon('menu', 22) + '</button>' +
      '<div class="grow" style="min-width:0">' +
      '<h1 class="truncate">' + U.esc(o.title || 'Dasbor') + '</h1>' +
      (o.desc ? '<div class="topbar-sub truncate">' + U.esc(o.desc) + '</div>' : '') +
      '</div>' +
      (o.actions || '') +
      '<a class="btn btn-ghost btn-icon rel" href="notifikasi.html" aria-label="Notifikasi' +
      (unread ? ', ' + unread + ' belum dibaca' : '') + '">' + Icon('bell', 21) +
      (unread ? '<span class="n-badge" style="position:absolute;top:6px;right:6px">' +
        (unread > 9 ? '9+' : unread) + '</span>' : '') + '</a>';
    return tb;
  }

  function logoSvg(size) {
    // Lambang: lengan/tangan bergaya dengan gelombang sinyal
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
      '<path d="M11 21V9.5a2.2 2.2 0 0 1 4.4 0V19" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M15.4 13.6V8a2.2 2.2 0 0 1 4.4 0v11" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M19.8 14.4v-2.2a2.2 2.2 0 0 1 4.4 0V19a8 8 0 0 1-8 8h-1.6A7.8 7.8 0 0 1 7 19.2" ' +
      'stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M2 7.5h3l1.6-3.2L9 10l1.6-2.5h2" stroke="#a8ffe8" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  Shell.logo = logoSvg;

  /* ---------------- Interaksi shell ---------------- */
  function bindShell() {
    var sidebar = U.$('#sidebar');
    var btn = U.$('#btn-menu');
    var scrim = null;

    function closeDrawer() {
      sidebar.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      if (scrim) { scrim.remove(); scrim = null; }
    }
    function openDrawer() {
      sidebar.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      scrim = U.el('div', { class: 'scrim' });
      scrim.addEventListener('click', closeDrawer);
      document.body.appendChild(scrim);
    }
    if (btn) {
      btn.addEventListener('click', function () {
        sidebar.classList.contains('open') ? closeDrawer() : openDrawer();
      });
    }
    var closeBtn = U.$('#btn-close-drawer');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    // Geser ke kiri untuk menutup drawer
    var touchX = null;
    sidebar.addEventListener('touchstart', function (e) {
      touchX = e.touches[0].clientX;
    }, { passive: true });
    sidebar.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (dx < -60 && sidebar.classList.contains('open')) closeDrawer();
      touchX = null;
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) closeDrawer();
    });

    // Menutup drawer otomatis saat berpindah halaman lewat menu
    U.on(sidebar, 'click', '.nav-item', function () { closeDrawer(); });

    var lo = U.$('#btn-logout');
    if (lo) {
      lo.addEventListener('click', function () {
        UI.confirm({
          title: 'Keluar dari ASTA?',
          message: 'Sesi Anda akan diakhiri. Data latihan tetap tersimpan di perangkat ini.',
          okLabel: 'Keluar'
        }).then(function (ok) {
          if (!ok) return;
          if (Device.state.connected) Device.disconnect();
          Notify.stopReminderLoop();
          Auth.logout();
          location.href = 'masuk.html';
        });
      });
    }
  }

  /* ---------------- Status perangkat di sidebar ---------------- */
  function startDeviceStatusSync() {
    render();
    Device.on('connected', render);
    Device.on('disconnected', render);
    Device.on('connecting', render);
    Device.on('telemetry', render);

    function render() {
      var dot = U.$('#dm-dot'), label = U.$('#dm-label'), sub = U.$('#dm-sub');
      if (!dot) return;
      var st = Device.statusText();
      dot.className = 'dot ' + st.dot;
      label.textContent = Device.state.connected ? 'Lengan ASTA aktif' : st.label;
      if (Device.state.connected) {
        sub.textContent = 'Baterai ' + Math.round(Device.state.battery) + '% · ' +
          Device.GRIPS[Device.state.grip].label;
      } else {
        sub.textContent = 'Buka halaman Perangkat';
      }
    }
  }

  /* ---------------- Pengaturan aksesibilitas ---------------- */
  function applyA11ySettings() {
    var st = Store.get('settings', {});
    document.body.classList.toggle('contrast-high', !!st.contrastHigh);
    document.body.classList.toggle('text-lg', !!st.textLarge);
    // Mode satu tangan memperbesar seluruh target sentuh pada layar kecil
    document.body.classList.toggle('one-hand', st.oneHandMode !== false);
    if (st.reduceMotion) {
      document.documentElement.style.setProperty('--t', '1ms');
      document.documentElement.style.setProperty('--t-slow', '1ms');
    }
  }
  Shell.applyA11ySettings = applyA11ySettings;

  /* ---------------- Pemilih pasien (untuk terapis/prostetis) ---------------- */
  Shell.patientPicker = function (onChange) {
    var patients = Store.list('users').filter(function (u) { return u.role === 'pasien'; });
    var active = Auth.activePatientId();
    var sel = U.el('select', { class: 'select', 'aria-label': 'Pilih pasien', style: 'max-width:250px' },
      patients.map(function (p) {
        return '<option value="' + U.esc(p.id) + '"' + (p.id === active ? ' selected' : '') + '>' +
          U.esc(p.name) + '</option>';
      }).join(''));
    sel.addEventListener('change', function () {
      Auth.activePatientId(sel.value);
      if (onChange) onChange(sel.value);
    });
    return sel;
  };

  global.Shell = Shell;
})(window);
