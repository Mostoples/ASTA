/* ============================================================
   ASTA — Halaman Masuk
   ============================================================ */
(function () {
  'use strict';

  // Bangun data demo bila belum ada
  Seed.run();

  var selectedRole = null;

  /* ---------------- Logo & ikon ---------------- */
  U.$('#logo-slot').innerHTML = Shell.logo(30);
  U.$('#ico-mail').innerHTML = Icon('mail', 19);
  U.$('#ico-lock').innerHTML = Icon('lock', 19);
  var logoMobile = U.$('#logo-mobile');
  if (logoMobile) logoMobile.innerHTML = Shell.logo(34);

  /* ---------------- Nilai jual di sisi kiri ---------------- */
  var PROPS = [
    { icon: 'brain', title: 'Modul phantom pain', desc: 'Terapi cermin digital, Graded Motor Imagery, dan diskriminasi sensorik berbasis haptik.' },
    { icon: 'pulse', title: 'Lengan bergerak dari sinyal EMG', desc: 'Empat kanal sEMG diterjemahkan menjadi pola cengkeram dan gaya proporsional.' },
    { icon: 'target', title: 'Kepatuhan terukur', desc: 'Jadwal, pengingat berjenjang, dan skor kepatuhan komposit untuk tim klinis.' }
  ];
  U.$('#value-props').innerHTML = PROPS.map(function (p) {
    return '<div class="row-t gap-4">' +
      '<span style="width:42px;height:42px;border-radius:14px;background:rgba(255,255,255,.16);' +
      'display:grid;place-items:center;flex:0 0 auto">' + Icon(p.icon, 21) + '</span>' +
      '<span><span class="semi" style="display:block">' + U.esc(p.title) + '</span>' +
      '<span class="t-sm" style="opacity:.86">' + U.esc(p.desc) + '</span></span>' +
      '</div>';
  }).join('');

  /* ---------------- Hiasan panel identitas ----------------
     Panel kiri berlatar gradasi gelap, jadi motifnya dipakai dalam
     rona putih (.on-dark) supaya terbaca tanpa menambah kontras teks. */
  var side = document.querySelector('.auth-side');
  if (side && window.Decor) {
    side.classList.add('decor-host', 'on-dark');
    Decor.mount(side, 'digits', { seed: 17, pos: 'corner', size: '340px' });
  }

  /* ---------------- Hero 3D ----------------
     Render Blender dipasang sebagai gambar statis supaya halaman masuk
     tetap ringan; kedalaman datang dari kemiringan halus mengikuti kursor.
     Model 3D penuh baru dimuat setelah pengguna masuk (Studio 3D). */
  var heroSlot = U.$('#hero-3d');
  if (heroSlot) {
    heroSlot.innerHTML =
      '<figure class="hero3d" id="hero3d">' +
        '<img src="assets/render/web/hero/00-poster.jpg" width="1920" height="1080" ' +
             'alt="Render 3D lengan bionik ASTA: socket humeral, cangkang siku, ' +
             'lengan bawah grafit, dan tangan lima jari berartikulasi." ' +
             'fetchpriority="high" decoding="async">' +
        '<figcaption>Purwarupa cetak 3D · ' + Device.CHANNELS.length + ' kanal EMG · ' +
          Object.keys(Device.GRIPS).length + ' pola cengkeram</figcaption>' +
      '</figure>';

    var fig = U.$('#hero3d');
    var reduce = window.matchMedia &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduce && window.matchMedia && matchMedia('(hover: hover)').matches) {
      fig.addEventListener('pointermove', function (e) {
        var r = fig.getBoundingClientRect();
        var dx = (e.clientX - r.left) / r.width - 0.5;
        var dy = (e.clientY - r.top) / r.height - 0.5;
        fig.style.setProperty('--ry', U.round(dx * 9, 2) + 'deg');
        fig.style.setProperty('--rx', U.round(-dy * 6, 2) + 'deg');
      });
      fig.addEventListener('pointerleave', function () {
        fig.style.setProperty('--ry', '0deg');
        fig.style.setProperty('--rx', '0deg');
      });
    }
  }

  /* ---------------- Pemilih peran ---------------- */
  var pick = U.$('#role-pick');

  /* Landing page menautkan ?peran=<kunci> dari kartu "Untuk siapa";
     peran itu langsung dipilih supaya pengunjung tidak mengulang. */
  var wanted = U.query('peran');
  pick.innerHTML = Auth.roleList().map(function (r) {
    return '<button type="button" class="role-opt" data-role="' + U.esc(r.key) + '" aria-pressed="false">' +
      '<span class="r-ico">' + Icon(r.icon, 19) + '</span>' +
      '<span><span class="r-name">' + U.esc(r.label) + '</span>' +
      '<span class="r-desc">' + U.esc(r.desc) + '</span></span>' +
      '</button>';
  }).join('');

  if (wanted && Auth.role(wanted)) {
    selectRole(wanted);
  }

  function selectRole(role) {
    selectedRole = role;
    U.$$('.role-opt', pick).forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.role === selectedRole));
    });
    if (!selectedRole) return;
    var u = Store.list('users').find(function (x) { return x.role === selectedRole; });
    if (u) {
      U.$('#email').value = u.email;
      U.$('#password').value = 'demo1234';
    }
  }

  U.on(pick, 'click', '.role-opt', function (e, btn) {
    var role = btn.dataset.role;
    selectRole(selectedRole === role ? null : role);   // klik ulang = batal pilih
    hideError();
  });

  /* ---------------- Daftar akun demo ---------------- */
  var demoUsers = ['u_pat_1', 'u_ter_1', 'u_pro_1', 'u_adm_1']
    .map(function (id) { return Store.find('users', id); })
    .filter(Boolean);

  U.$('#demo-accounts').innerHTML = demoUsers.map(function (u) {
    var r = Auth.role(u.role);
    return '<button type="button" class="role-opt" data-quick="' + U.esc(u.role) + '" ' +
      'style="min-height:58px">' +
      '<span class="avatar sm ' + U.esc(u.avatar || '') + '">' + U.esc(U.initials(u.name)) + '</span>' +
      '<span class="grow" style="min-width:0">' +
      '<span class="r-name truncate">' + U.esc(u.name) + '</span>' +
      '<span class="r-desc truncate">' + U.esc(r.label) + ' · ' + U.esc(u.email) + '</span></span>' +
      '<span style="color:var(--text-3)">' + Icon('chevronRight', 18) + '</span>' +
      '</button>';
  }).join('');

  U.on(U.$('#demo-accounts'), 'click', '[data-quick]', function (e, btn) {
    var res = Auth.quickLogin(btn.dataset.quick);
    if (!res.ok) { showError(res.error); return; }
    go(res);
  });

  /* ---------------- Submit form ---------------- */
  U.$('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    hideError();
    var email = U.$('#email').value.trim();
    var pass = U.$('#password').value;

    var res = Auth.login(email, pass, selectedRole);
    if (!res.ok) {
      showError(res.error);
      U.$('#email').setAttribute('aria-invalid', 'true');
      return;
    }
    go(res);
  });

  function go(res) {
    UI.toast('Selamat datang, ' + res.user.name.split(' ')[0] + '.', 'success', { duration: 2200 });
    var next = U.query('next');
    var dest = res.home;
    // Hanya izinkan tujuan internal untuk mencegah open-redirect
    if (next && /^[a-z0-9\-]+\.html$/i.test(next)) dest = next;
    setTimeout(function () { location.href = dest; }, 380);
  }

  function showError(msg) {
    var box = U.$('#login-error');
    box.innerHTML = '<span class="a-ico">' + Icon('alert', 18) + '</span><span>' + U.esc(msg) + '</span>';
    box.classList.remove('hidden');
  }
  function hideError() {
    U.$('#login-error').classList.add('hidden');
    U.$('#email').removeAttribute('aria-invalid');
  }

  /* ---------------- Lupa sandi (prototipe) ---------------- */
  U.$('#forgot').addEventListener('click', function (e) {
    e.preventDefault();
    UI.modal({
      title: 'Pemulihan kata sandi',
      size: 'sm',
      content: '<p class="muted-2 t-sm">Pada prototipe ini pemulihan kata sandi belum terhubung ke server. ' +
        'Gunakan salah satu akun demo untuk masuk.</p>' +
        '<div class="alert info mt-4"><span class="a-ico">' + Icon('info', 18) + '</span>' +
        '<span class="t-sm">Pada versi produksi, tautan reset dikirim lewat email dan kedaluwarsa dalam 15 menit.</span></div>',
      actions: [{ label: 'Mengerti', class: 'btn-primary' }]
    });
  });

  /* ---------------- Setel ulang data demo ---------------- */
  U.$('#btn-reset-data').addEventListener('click', function () {
    UI.confirm({
      title: 'Setel ulang data demo?',
      message: 'Semua sesi latihan, catatan nyeri, dan pengaturan pada peramban ini akan dibuat ulang dari data awal.',
      okLabel: 'Setel ulang',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      Seed.reset();
      UI.toast('Data demo dibangun ulang.', 'success');
      setTimeout(function () { location.reload(); }, 800);
    });
  });

  /* ---------------- Bila sudah login, arahkan ---------------- */
  if (Auth.isLoggedIn()) {
    var s = Auth.current();
    var r = Auth.role(s.role);
    if (r) {
      var bar = U.el('div', { class: 'alert info mt-4' },
        '<span class="a-ico">' + Icon('info', 18) + '</span>' +
        '<span class="grow t-sm">Anda masih masuk sebagai <strong>' + U.esc(s.name) + '</strong>.</span>');
      var b = U.el('button', { class: 'btn btn-sm btn-primary' }, 'Lanjutkan');
      b.addEventListener('click', function () { location.href = r.home; });
      bar.appendChild(b);
      U.$('.auth-card .card').appendChild(bar);
    }
  }

  /* ---------------- Info browser untuk Web Bluetooth ---------------- */
  if (!Device.bleSupported()) {
    var note = U.el('p', { class: 't-xs muted mt-3' },
      Icon('info', 13) + ' Peramban ini belum mendukung Web Bluetooth. Mode Simulator tetap berfungsi penuh.');
    U.$('.auth-card').appendChild(note);
  }
})();
