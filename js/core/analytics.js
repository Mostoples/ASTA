/* ============================================================
   ASTA — Analytics
   Perhitungan kepatuhan, tren nyeri phantom, korelasi
   nyeri vs pemakaian, dan agregasi untuk dashboard.
   ============================================================ */
(function (global) {
  'use strict';

  var A = {};

  /* ---------------- Pengambilan data dasar ---------------- */
  A.sessions = function (patientId, days) {
    var from = days ? U.dayKey(U.addDays(new Date(), -(days - 1))) : null;
    return Store.list('sessions').filter(function (s) {
      return s.patientId === patientId && (!from || s.date >= from);
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };

  A.painLogs = function (patientId, days) {
    var from = days ? U.dayKey(U.addDays(new Date(), -(days - 1))) : null;
    return Store.list('painLogs').filter(function (p) {
      return p.patientId === patientId && (!from || p.date >= from);
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };

  A.telemetry = function (patientId, days) {
    var from = days ? U.dayKey(U.addDays(new Date(), -(days - 1))) : null;
    return Store.list('telemetry').filter(function (t) {
      return t.patientId === patientId && (!from || t.date >= from);
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };

  A.prescription = function (patientId) {
    return Store.list('prescriptions').find(function (r) { return r.patientId === patientId; }) || null;
  };

  A.schedules = function (patientId) {
    return Store.list('schedules').filter(function (s) {
      return s.patientId === patientId && s.active !== false;
    });
  };

  /* ============================================================
     SKOR KEPATUHAN
     Komposit 3 komponen (transparan agar bisa dipertanggungjawabkan
     secara metodologis):
       - frekuensi (50%): sesi terlaksana / target sesi
       - kelengkapan (30%): rata-rata penyelesaian latihan per sesi
       - pemakaian alat (20%): jam pakai vs target 6 jam/hari
     ============================================================ */
  A.adherence = function (patientId, days) {
    var d = days || 14;
    var rx = A.prescription(patientId);
    var weeklyTarget = rx ? (rx.weeklyTarget || 5) : 5;
    var targetSessions = Math.max(1, Math.round((weeklyTarget / 7) * d));

    var ses = A.sessions(patientId, d);
    var tel = A.telemetry(patientId, d);

    // Frekuensi berdasar hari unik yang ada sesi
    var uniqueDays = Object.keys(U.groupBy(ses, 'date')).length;
    var freq = U.clamp(uniqueDays / targetSessions, 0, 1);

    // Kelengkapan
    var comp = ses.length ? U.avg(ses.map(function (s) { return s.adherencePct || 0; })) / 100 : 0;
    comp = U.clamp(comp, 0, 1);

    // Pemakaian alat (target 6 jam/hari)
    var wearAvg = tel.length ? U.avg(tel.map(function (t) { return t.wearHours || 0; })) : 0;
    var wear = U.clamp(wearAvg / 6, 0, 1);

    var score = Math.round((freq * 0.5 + comp * 0.3 + wear * 0.2) * 100);
    var tone = U.adherenceTone(score);

    return {
      score: score,
      tone: tone.tone,
      label: tone.label,
      days: d,
      sessionsDone: uniqueDays,
      sessionsTarget: targetSessions,
      freqPct: Math.round(freq * 100),
      completionPct: Math.round(comp * 100),
      wearPct: Math.round(wear * 100),
      wearAvgHours: U.round(wearAvg, 1)
    };
  };

  /** Deret kepatuhan mingguan untuk grafik tren */
  A.adherenceWeekly = function (patientId, weeks) {
    var w = weeks || 12;
    var rx = A.prescription(patientId);
    var weeklyTarget = rx ? (rx.weeklyTarget || 5) : 5;
    var out = [];
    for (var i = w - 1; i >= 0; i--) {
      var end = U.addDays(new Date(), -i * 7);
      var start = U.addDays(end, -6);
      var sk = U.dayKey(start), ek = U.dayKey(end);
      var ses = Store.list('sessions').filter(function (s) {
        return s.patientId === patientId && s.date >= sk && s.date <= ek;
      });
      var uniq = Object.keys(U.groupBy(ses, 'date')).length;
      out.push({
        label: 'W' + (w - i),
        weekEnd: ek,
        pct: U.clamp(Math.round((uniq / weeklyTarget) * 100), 0, 130),
        sessions: uniq,
        quality: ses.length ? Math.round(U.avg(ses.map(function (s) { return s.qualityScore || 0; }))) : null
      });
    }
    return out;
  };

  /* ---------------- Streak (rentetan hari latihan) ---------------- */
  A.streak = function (patientId) {
    var byDay = {};
    Store.list('sessions').forEach(function (s) {
      if (s.patientId === patientId) byDay[s.date] = true;
    });
    var cur = 0, cursor = new Date();
    // Hari ini belum latihan tidak langsung memutus streak
    if (!byDay[U.dayKey(cursor)]) cursor = U.addDays(cursor, -1);
    while (byDay[U.dayKey(cursor)]) { cur++; cursor = U.addDays(cursor, -1); }

    // Streak terpanjang 180 hari ke belakang
    var best = 0, run = 0;
    for (var i = 180; i >= 0; i--) {
      if (byDay[U.dayKey(U.addDays(new Date(), -i))]) { run++; best = Math.max(best, run); }
      else run = 0;
    }
    return { current: cur, best: best, todayDone: !!byDay[U.today()] };
  };

  /* ---------------- Statistik nyeri phantom ---------------- */
  A.painStats = function (patientId, days) {
    var d = days || 30;
    var logs = A.painLogs(patientId, d);
    if (!logs.length) {
      return { count: 0, avg: 0, min: 0, max: 0, latest: null, delta: 0, trend: 'stabil',
        severeDays: 0, sleepDays: 0, medDays: 0, topTypes: [], topZones: [], topTriggers: [] };
    }
    var lvls = logs.map(function (l) { return l.level; });
    var half = Math.floor(logs.length / 2);
    var firstHalf = U.avg(lvls.slice(0, half || 1));
    var lastHalf = U.avg(lvls.slice(half));
    var delta = U.round(lastHalf - firstHalf, 1);

    function topCount(arrs) {
      var c = {};
      arrs.forEach(function (list) {
        (list || []).forEach(function (v) { c[v] = (c[v] || 0) + 1; });
      });
      return Object.keys(c).map(function (k) { return { key: k, n: c[k] }; })
        .sort(function (a, b) { return b.n - a.n; });
    }

    return {
      count: logs.length,
      avg: U.round(U.avg(lvls), 1),
      min: Math.min.apply(null, lvls),
      max: Math.max.apply(null, lvls),
      latest: logs[logs.length - 1],
      delta: delta,
      trend: delta <= -0.6 ? 'menurun' : delta >= 0.6 ? 'meningkat' : 'stabil',
      severeDays: logs.filter(function (l) { return l.level >= 7; }).length,
      sleepDays: logs.filter(function (l) { return l.sleepDisturbed; }).length,
      medDays: logs.filter(function (l) { return l.medication; }).length,
      avgDuration: Math.round(U.avg(logs.map(function (l) { return l.durationMin || 0; }))),
      topTypes: topCount(logs.map(function (l) { return l.types; })).slice(0, 4),
      topZones: topCount(logs.map(function (l) { return l.zones; })).slice(0, 5),
      topTriggers: topCount(logs.map(function (l) { return [l.trigger]; })).slice(0, 4)
    };
  };

  /* ============================================================
     KORELASI NYERI vs PEMAKAIAN ALAT
     Ini analisis inti penelitian ASTA: apakah pemakaian lengan
     dengan umpan balik sensorik berhubungan dengan penurunan
     nyeri phantom.
     ============================================================ */
  A.painVsUsage = function (patientId, days) {
    var d = days || 60;
    var logs = A.painLogs(patientId, d);
    var tel = A.telemetry(patientId, d);
    var telMap = {};
    tel.forEach(function (t) { telMap[t.date] = t; });

    var points = [], xs = [], ys = [];
    logs.forEach(function (l) {
      var t = telMap[l.date];
      if (!t) return;
      points.push({
        x: t.wearHours, y: l.level, date: l.date,
        color: U.painColor(l.level)
      });
      xs.push(t.wearHours);
      ys.push(l.level);
    });

    var r = U.pearson(xs, ys);

    // Bandingkan nyeri pada hari pakai tinggi vs rendah (median split)
    var sorted = xs.slice().sort(function (a, b) { return a - b; });
    var median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    var hi = [], lo = [];
    points.forEach(function (p) { (p.x >= median ? hi : lo).push(p.y); });

    return {
      points: points,
      r: r,
      strength: U.corrLabel(r),
      n: points.length,
      medianWear: U.round(median, 1),
      painHighUse: U.round(U.avg(hi), 1),
      painLowUse: U.round(U.avg(lo), 1),
      gap: U.round(U.avg(lo) - U.avg(hi), 1)
    };
  };

  /** Deret harian selaras untuk grafik dua sumbu */
  A.dailySeries = function (patientId, days) {
    var d = days || 30;
    var labels = [], pain = [], wear = [], quality = [], sessionMin = [];
    var painMap = {}, telMap = {}, sesMap = {};

    A.painLogs(patientId, d).forEach(function (p) { painMap[p.date] = p; });
    A.telemetry(patientId, d).forEach(function (t) { telMap[t.date] = t; });
    U.groupBy(A.sessions(patientId, d), 'date');
    var grouped = U.groupBy(A.sessions(patientId, d), 'date');
    Object.keys(grouped).forEach(function (k) { sesMap[k] = grouped[k]; });

    for (var i = d - 1; i >= 0; i--) {
      var date = U.addDays(new Date(), -i);
      var key = U.dayKey(date);
      labels.push(U.fmtDate(date, 'short'));
      pain.push(painMap[key] ? painMap[key].level : null);
      wear.push(telMap[key] ? telMap[key].wearHours : 0);
      var ss = sesMap[key] || [];
      quality.push(ss.length ? Math.round(U.avg(ss.map(function (s) { return s.qualityScore; }))) : null);
      sessionMin.push(U.sum(ss.map(function (s) { return s.durationMin; })));
    }
    return { labels: labels, pain: pain, wear: wear, quality: quality, sessionMin: sessionMin };
  };

  /* ---------------- Telemetri agregat ---------------- */
  A.usageStats = function (patientId, days) {
    var tel = A.telemetry(patientId, days || 7);
    if (!tel.length) {
      return { wearAvg: 0, wearTotal: 0, gripTotal: 0, successRate: 0, emgQuality: 0,
        hapticTotal: 0, forceAvg: 0, recalibrations: 0 };
    }
    return {
      wearAvg: U.round(U.avg(tel.map(function (t) { return t.wearHours; })), 1),
      wearTotal: U.round(U.sum(tel.map(function (t) { return t.wearHours; })), 1),
      gripTotal: U.sum(tel.map(function (t) { return t.gripCount; })),
      successRate: Math.round(U.avg(tel.map(function (t) { return t.gripSuccess * 100; }))),
      emgQuality: Math.round(U.avg(tel.map(function (t) { return t.emgQuality; }))),
      hapticTotal: U.sum(tel.map(function (t) { return t.hapticEvents; })),
      forceAvg: Math.round(U.avg(tel.map(function (t) { return t.avgForce; }))),
      socketTemp: U.round(U.avg(tel.map(function (t) { return t.socketTempAvg; })), 1),
      socketHumidity: Math.round(U.avg(tel.map(function (t) { return t.socketHumidity; }))),
      recalibrations: U.sum(tel.map(function (t) { return t.recalibrations; }))
    };
  };

  /* ---------------- Progres per kategori latihan ---------------- */
  A.categoryProgress = function (patientId, days) {
    var ses = A.sessions(patientId, days || 30);
    var acc = { motorik: [], phantom: [], adl: [] };
    ses.forEach(function (s) {
      (s.exercises || []).forEach(function (e) {
        var ex = Seed.exercise(e.exId);
        if (!ex) return;
        if (!acc[ex.cat]) acc[ex.cat] = [];
        acc[ex.cat].push(e.quality || 0);
      });
    });
    return Object.keys(acc).map(function (k) {
      return {
        cat: k,
        label: k === 'motorik' ? 'Motorik' : k === 'phantom' ? 'Phantom Pain' : 'ADL',
        n: acc[k].length,
        avgQuality: acc[k].length ? Math.round(U.avg(acc[k])) : 0
      };
    });
  };

  /* ---------------- Jadwal hari ini & mendatang ---------------- */
  A.todaySchedule = function (patientId) {
    var dow = new Date().getDay();
    var todayKey = U.today();
    var doneToday = Store.list('sessions').filter(function (s) {
      return s.patientId === patientId && s.date === todayKey;
    });
    return A.schedules(patientId)
      .filter(function (s) { return (s.days || []).indexOf(dow) >= 0; })
      .sort(function (a, b) { return a.time < b.time ? -1 : 1; })
      .map(function (s) {
        var done = s.type === 'latihan'
          ? doneToday.length > 0
          : s.type === 'nyeri'
            ? Store.list('painLogs').some(function (p) { return p.patientId === patientId && p.date === todayKey; })
            : doneToday.some(function (x) {
              return (x.exercises || []).some(function (e) {
                var ex = Seed.exercise(e.exId);
                return ex && ex.cat === 'phantom';
              });
            });
        var overdue = !done && s.time < U.fmtTime(new Date());
        return Object.assign({}, s, { done: done, overdue: overdue });
      });
  };

  A.upcomingAppointments = function (userId, limit) {
    var now = Date.now();
    return Store.list('appointments')
      .filter(function (a) {
        return (a.patientId === userId || a.withId === userId) &&
          a.status === 'terjadwal' && new Date(a.at).getTime() >= now - 3600000;
      })
      .sort(function (a, b) { return new Date(a.at) - new Date(b.at); })
      .slice(0, limit || 5);
  };

  /* ---------------- Ringkasan panel terapis ---------------- */
  A.patientOverview = function (patientId) {
    var u = Store.find('users', patientId);
    if (!u) return null;
    var adh = A.adherence(patientId, 14);
    var pain = A.painStats(patientId, 14);
    var usage = A.usageStats(patientId, 7);
    var streak = A.streak(patientId);
    var lastSes = A.sessions(patientId, 90).slice(-1)[0] || null;
    var daysSince = lastSes ? U.daysBetween(U.d(lastSes.date), new Date()) : 999;

    var risks = [];
    if (adh.score < 50) risks.push('Kepatuhan rendah');
    if (daysSince >= 3) risks.push(daysSince + ' hari tanpa latihan');
    if (pain.avg >= 7) risks.push('Nyeri phantom berat');
    if (pain.trend === 'meningkat') risks.push('Nyeri meningkat');
    if (usage.emgQuality && usage.emgQuality < 60) risks.push('Kualitas EMG buruk');
    if (usage.wearAvg < 2) risks.push('Alat jarang dipakai');

    return {
      user: u, adherence: adh, pain: pain, usage: usage, streak: streak,
      lastSession: lastSes, daysSinceSession: daysSince,
      risks: risks,
      riskLevel: risks.length >= 3 ? 'tinggi' : risks.length >= 1 ? 'sedang' : 'rendah'
    };
  };

  A.allPatientsOverview = function (therapistId) {
    return Store.list('users')
      .filter(function (u) {
        return u.role === 'pasien' && (!therapistId || u.therapistId === therapistId);
      })
      .map(function (u) { return A.patientOverview(u.id); })
      .filter(Boolean);
  };

  /* ---------------- Skor GMI ---------------- */
  A.gmiStats = function (patientId, days) {
    var from = U.dayKey(U.addDays(new Date(), -((days || 60) - 1)));
    var list = Store.list('gmiScores').filter(function (g) {
      return g.patientId === patientId && g.date >= from;
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (!list.length) return { list: [], accuracy: 0, avgMs: 0, delta: 0 };
    var half = Math.floor(list.length / 2);
    return {
      list: list,
      accuracy: Math.round(U.avg(list.map(function (g) { return g.accuracy; }))),
      avgMs: Math.round(U.avg(list.map(function (g) { return g.avgMs; }))),
      latest: list[list.length - 1],
      delta: Math.round(
        U.avg(list.slice(half).map(function (g) { return g.accuracy; })) -
        U.avg(list.slice(0, half || 1).map(function (g) { return g.accuracy; }))
      )
    };
  };

  /* ---------------- Ekspor data penelitian ---------------- */
  A.exportPatientCSV = function (patientId, anonymize) {
    var u = Store.find('users', patientId);
    var pid = anonymize ? 'SUBJ-' + String(patientId).slice(-1) : patientId;
    var d = 90;
    var painMap = {}, telMap = {}, sesMap = {};
    A.painLogs(patientId, d).forEach(function (p) { painMap[p.date] = p; });
    A.telemetry(patientId, d).forEach(function (t) { telMap[t.date] = t; });
    var g = U.groupBy(A.sessions(patientId, d), 'date');

    var rows = [];
    for (var i = d - 1; i >= 0; i--) {
      var key = U.dayKey(U.addDays(new Date(), -i));
      var p = painMap[key], t = telMap[key], ss = g[key] || [];
      rows.push([
        pid, key,
        p ? p.level : '', p ? (p.types || []).join('|') : '', p ? (p.zones || []).join('|') : '',
        p ? p.trigger : '', p ? (p.sleepDisturbed ? 1 : 0) : '', p ? p.durationMin : '',
        t ? t.wearHours : '', t ? t.gripCount : '', t ? U.round(t.gripSuccess * 100, 1) : '',
        t ? t.emgQuality : '', t ? t.avgForce : '', t ? t.hapticEvents : '',
        ss.length, U.sum(ss.map(function (s) { return s.durationMin; })),
        ss.length ? Math.round(U.avg(ss.map(function (s) { return s.qualityScore; }))) : ''
      ]);
    }
    var headers = ['subject_id', 'date', 'pain_nrs', 'pain_types', 'pain_zones', 'pain_trigger',
      'sleep_disturbed', 'pain_duration_min', 'wear_hours', 'grip_count', 'grip_success_pct',
      'emg_quality', 'avg_force_pct', 'haptic_events', 'sessions', 'session_minutes', 'quality_score'];
    return { csv: U.toCSV(rows, headers), name: (anonymize ? pid : U.slug(u ? u.name : pid)) + '_asta_90hari.csv' };
  };

  global.Analytics = A;
})(window);
