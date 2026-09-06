/* ============================================================
   ASTA — Notifikasi & Pengingat
   Menangani: pengingat jadwal, eskalasi kepatuhan ke terapis,
   peringatan alat, dan izin Notification API.
   ============================================================ */
(function (global) {
  'use strict';

  var N = {};
  var checkTimer = null;
  var firedKeys = {};   // cegah pengingat berulang dalam satu sesi

  /* ---------------- CRUD notifikasi ---------------- */
  N.list = function (userId, opts) {
    var o = opts || {};
    var out = Store.list('notifications')
      .filter(function (n) { return n.userId === userId; })
      .sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    if (o.unreadOnly) out = out.filter(function (n) { return !n.read; });
    if (o.type) out = out.filter(function (n) { return n.type === o.type; });
    return o.limit ? out.slice(0, o.limit) : out;
  };

  N.unreadCount = function (userId) {
    return Store.list('notifications').filter(function (n) {
      return n.userId === userId && !n.read;
    }).length;
  };

  N.push = function (userId, data) {
    var n = Store.insert('notifications', Object.assign({
      userId: userId,
      type: 'info',
      tone: 'primary',
      icon: 'bell',
      title: '',
      body: '',
      at: new Date().toISOString(),
      read: false,
      link: null
    }, data));
    // Tampilkan sebagai toast bila untuk pengguna aktif
    var s = Auth.current();
    if (s && s.userId === userId) {
      UI.toast(n.body || n.title, toneToToast(n.tone), { title: n.title, duration: 5600 });
      N.system(n.title, n.body);
    }
    return n;
  };

  N.markRead = function (id) { return Store.update('notifications', id, { read: true }); };

  N.markAllRead = function (userId) {
    Store.list('notifications').forEach(function (n) {
      if (n.userId === userId && !n.read) Store.update('notifications', n.id, { read: true });
    });
  };

  N.remove = function (id) { Store.delete('notifications', id); };

  function toneToToast(tone) {
    if (tone === 'danger') return 'danger';
    if (tone === 'warning') return 'warning';
    if (tone === 'success') return 'success';
    return 'info';
  }

  /* ---------------- Notifikasi sistem (browser) ---------------- */
  N.permission = function () {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  };

  N.requestPermission = function () {
    if (!('Notification' in window)) {
      return Promise.resolve('unsupported');
    }
    return Notification.requestPermission();
  };

  N.system = function (title, body) {
    var st = Store.get('settings', {});
    if (!st.notifPush) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      var n = new Notification('ASTA — ' + title, {
        body: body || '',
        tag: 'asta-' + U.slug(title),
        silent: !st.notifSound
      });
      setTimeout(function () { try { n.close(); } catch (e) { } }, 9000);
    } catch (e) { /* beberapa browser butuh service worker */ }
  };

  /* ============================================================
     PENGINGAT JADWAL
     Cek setiap menit: apakah ada jadwal yang mendekat / terlewat.
     ============================================================ */
  N.startReminderLoop = function () {
    if (checkTimer) return;
    tick();
    checkTimer = setInterval(tick, 60000);
  };

  N.stopReminderLoop = function () {
    clearInterval(checkTimer);
    checkTimer = null;
  };

  function tick() {
    var s = Auth.current();
    if (!s) return;
    if (s.role === 'pasien') checkPatientReminders(s.userId);
    else checkTherapistEscalations(s.userId);
  }

  function checkPatientReminders(patientId) {
    var st = Store.get('settings', {});
    var lead = st.reminderLead === undefined ? 15 : st.reminderLead;
    var now = new Date();
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var todayKey = U.today();

    Analytics.todaySchedule(patientId).forEach(function (sc) {
      if (!sc.reminder || sc.done) return;
      var parts = String(sc.time).split(':');
      var schMin = Number(parts[0]) * 60 + Number(parts[1]);
      var diff = schMin - nowMin;
      var before = sc.reminderBefore === undefined ? lead : sc.reminderBefore;

      var key = 'rem:' + sc.id + ':' + todayKey;
      if (firedKeys[key]) return;

      if (diff <= before && diff >= -1) {
        firedKeys[key] = true;
        N.push(patientId, {
          type: 'reminder', tone: 'primary', icon: iconFor(sc.type),
          title: sc.title + ' pukul ' + sc.time,
          body: diff <= 0 ? 'Waktunya mulai sekarang.' : 'Dimulai dalam ' + diff + ' menit.',
          link: linkFor(sc.type)
        });
      }
      // Terlewat lebih dari 90 menit
      else if (diff < -90 && diff > -100) {
        var mk = 'miss:' + sc.id + ':' + todayKey;
        if (firedKeys[mk]) return;
        firedKeys[mk] = true;
        N.push(patientId, {
          type: 'terlewat', tone: 'warning', icon: 'clock',
          title: sc.title + ' terlewat',
          body: 'Masih bisa dikerjakan hari ini. Konsistensi lebih penting daripada durasi.',
          link: linkFor(sc.type)
        });
      }
    });

    // Eskalasi mandiri: beri tahu pasien bila sudah beberapa hari kosong
    var streak = Analytics.streak(patientId);
    if (!streak.todayDone) {
      var ses = Analytics.sessions(patientId, 30);
      var last = ses.slice(-1)[0];
      var gap = last ? U.daysBetween(U.d(last.date), new Date()) : 99;
      var gk = 'gap:' + patientId + ':' + todayKey;
      if (gap >= 3 && gap < 90 && !firedKeys[gk]) {
        firedKeys[gk] = true;
        N.push(patientId, {
          type: 'eskalasi', tone: 'warning', icon: 'alert',
          title: gap + ' hari belum latihan',
          body: 'Terapis Anda akan diberi tahu bila melewati 7 hari. Mulai dengan sesi singkat 10 menit.',
          link: 'sesi-latihan.html'
        });
      }
    }
  }

  function checkTherapistEscalations(therapistId) {
    var st = Store.get('settings', {});
    var limit = st.escalateAfterDays || 3;
    var todayKey = U.today();

    Analytics.allPatientsOverview(therapistId).forEach(function (ov) {
      var key = 'esc:' + ov.user.id + ':' + todayKey;
      if (firedKeys[key]) return;

      if (ov.daysSinceSession >= limit + 4) {
        firedKeys[key] = true;
        N.push(therapistId, {
          type: 'eskalasi', tone: 'danger', icon: 'alert',
          title: ov.user.name + ': ' + ov.daysSinceSession + ' hari tanpa latihan',
          body: 'Skor kepatuhan ' + ov.adherence.score + '%. Perlu tindak lanjut telekonsultasi.',
          link: 'terapis-pasien.html?id=' + ov.user.id
        });
      } else if (ov.pain.avg >= 7.5) {
        firedKeys[key] = true;
        N.push(therapistId, {
          type: 'nyeri', tone: 'warning', icon: 'brain',
          title: ov.user.name + ': nyeri phantom rata-rata ' + ov.pain.avg + '/10',
          body: 'Tren ' + ov.pain.trend + '. ' + ov.pain.sleepDays + ' hari tidur terganggu.',
          link: 'terapis-pasien.html?id=' + ov.user.id
        });
      }
    });
  }

  function iconFor(type) {
    return type === 'nyeri' ? 'brain' : type === 'phantom' ? 'mirror' : 'activity';
  }
  function linkFor(type) {
    return type === 'nyeri' ? 'catatan-nyeri.html'
      : type === 'phantom' ? 'terapi-phantom.html'
        : 'sesi-latihan.html';
  }

  /* ---------------- Notifikasi capaian ---------------- */
  N.checkAchievements = function (patientId) {
    var streak = Analytics.streak(patientId);
    var have = Store.list('achievements').filter(function (a) { return a.patientId === patientId; });
    function has(code) { return have.some(function (a) { return a.code === code; }); }

    var unlocked = [];
    [[7, 'streak_7', 'Konsisten 7 Hari'], [14, 'streak_14', 'Konsisten 14 Hari'],
    [30, 'streak_30', 'Konsisten 30 Hari']].forEach(function (t) {
      if (streak.current >= t[0] && !has(t[1])) {
        unlocked.push(Store.insert('achievements', {
          patientId: patientId, code: t[1], label: t[2], icon: 'fire', at: new Date().toISOString()
        }));
      }
    });

    var pain = Analytics.painStats(patientId, 30);
    if (pain.delta <= -3 && !has('pain_down_3')) {
      unlocked.push(Store.insert('achievements', {
        patientId: patientId, code: 'pain_down_3', label: 'Nyeri Turun 3 Poin',
        icon: 'brain', at: new Date().toISOString()
      }));
    }

    var usage = Analytics.usageStats(patientId, 90);
    if (usage.gripTotal >= 1000 && !has('grip_1000')) {
      unlocked.push(Store.insert('achievements', {
        patientId: patientId, code: 'grip_1000', label: '1.000 Cengkeraman',
        icon: 'hand', at: new Date().toISOString()
      }));
    }

    unlocked.forEach(function (a) {
      N.push(patientId, {
        type: 'capaian', tone: 'success', icon: 'award',
        title: 'Capaian baru: ' + a.label,
        body: 'Kerja bagus. Konsistensi Anda terlihat pada data.',
        link: 'progres.html'
      });
    });
    return unlocked;
  };

  global.Notify = N;
})(window);
