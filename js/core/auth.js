/* ============================================================
   ASTA — Auth & Role (prototipe lokal)
   ------------------------------------------------------------
   CATATAN KEAMANAN (penting untuk dokumentasi penelitian):
   Ini prototipe frontend. Sesi disimpan di localStorage dan
   kredensial demo ada di sisi klien, jadi TIDAK aman untuk
   data pasien nyata. Untuk produksi wajib: autentikasi di
   server, hashing password (mis. Argon2/bcrypt), token
   berumur pendek, HTTPS, audit log, dan kontrol akses
   di sisi server (bukan hanya menyembunyikan menu di UI).
   ============================================================ */
(function (global) {
  'use strict';

  var Auth = {};

  var ROLES = {
    pasien: {
      key: 'pasien',
      label: 'Pasien',
      desc: 'Latihan & pantau nyeri',
      icon: 'user',
      home: 'pasien-dashboard.html',
      color: 'primary'
    },
    terapis: {
      key: 'terapis',
      label: 'Fisioterapis',
      desc: 'Resep & pantau pasien',
      icon: 'stethoscope',
      home: 'terapis-dashboard.html',
      color: 'teal'
    },
    prostetis: {
      key: 'prostetis',
      label: 'Prostetis',
      desc: 'Kalibrasi & servis alat',
      icon: 'wrench',
      home: 'prostetis-dashboard.html',
      color: 'violet'
    },
    admin: {
      key: 'admin',
      label: 'Admin Klinik',
      desc: 'Kelola pengguna & alat',
      icon: 'shield',
      home: 'admin-dashboard.html',
      color: 'success'
    }
  };

  Auth.ROLES = ROLES;
  Auth.roleList = function () { return Object.keys(ROLES).map(function (k) { return ROLES[k]; }); };
  Auth.role = function (k) { return ROLES[k] || null; };

  /* ---------------- Sesi ---------------- */
  Auth.current = function () {
    return Store.get('session', null);
  };

  Auth.isLoggedIn = function () {
    var s = Auth.current();
    return !!(s && s.userId && s.role);
  };

  Auth.user = function () {
    var s = Auth.current();
    if (!s) return null;
    var u = Store.find('users', s.userId);
    return u || null;
  };

  /** Login demo: cocokkan email (password tidak diverifikasi di prototipe) */
  Auth.login = function (email, password, roleHint) {
    var mail = String(email || '').trim().toLowerCase();
    if (!mail) return { ok: false, error: 'Email wajib diisi.' };
    if (!password) return { ok: false, error: 'Kata sandi wajib diisi.' };

    var users = Store.list('users');
    var u = users.find(function (x) { return String(x.email).toLowerCase() === mail; });

    if (!u) {
      return { ok: false, error: 'Akun tidak ditemukan. Coba salah satu akun demo di bawah.' };
    }
    if (u.active === false) {
      return { ok: false, error: 'Akun ini dinonaktifkan. Hubungi admin klinik.' };
    }
    if (roleHint && u.role !== roleHint) {
      return { ok: false, error: 'Akun ini terdaftar sebagai ' + ROLES[u.role].label + ', bukan ' + ROLES[roleHint].label + '.' };
    }

    Store.set('session', {
      userId: u.id,
      role: u.role,
      name: u.name,
      loginAt: new Date().toISOString()
    });
    Store.update('users', u.id, { lastLogin: new Date().toISOString() });
    return { ok: true, user: u, home: ROLES[u.role].home };
  };

  /** Login cepat untuk demo penelitian */
  Auth.quickLogin = function (roleKey) {
    var u = Store.list('users').find(function (x) { return x.role === roleKey && x.active !== false; });
    if (!u) return { ok: false, error: 'Akun demo untuk peran ini belum tersedia.' };
    Store.set('session', {
      userId: u.id, role: u.role, name: u.name, loginAt: new Date().toISOString()
    });
    return { ok: true, user: u, home: ROLES[u.role].home };
  };

  Auth.logout = function () {
    Store.remove('session');
  };

  /**
   * Pasang penjaga halaman. Panggil di awal setiap halaman dalam app.
   * @param {string|string[]} allowed peran yang diizinkan
   */
  Auth.guard = function (allowed) {
    if (!Auth.isLoggedIn()) {
      location.replace('masuk.html?next=' + encodeURIComponent(location.pathname.split('/').pop()));
      return null;
    }
    var s = Auth.current();
    if (allowed) {
      var list = Array.isArray(allowed) ? allowed : [allowed];
      if (list.indexOf(s.role) < 0) {
        var home = ROLES[s.role] ? ROLES[s.role].home : 'masuk.html';
        location.replace(home + '?denied=1');
        return null;
      }
    }
    return Auth.user();
  };

  /** Pasien aktif yang sedang dilihat (untuk terapis/prostetis) */
  Auth.activePatientId = function (setTo) {
    if (setTo !== undefined) {
      Store.set('ui:activePatient', setTo);
      return setTo;
    }
    var s = Auth.current();
    if (s && s.role === 'pasien') return s.userId;
    var stored = Store.get('ui:activePatient', null);
    if (stored && Store.find('users', stored)) return stored;
    var first = Store.list('users').filter(function (u) { return u.role === 'pasien'; })[0];
    return first ? first.id : null;
  };

  Auth.activePatient = function () {
    var id = Auth.activePatientId();
    return id ? Store.find('users', id) : null;
  };

  global.Auth = Auth;
})(window);
