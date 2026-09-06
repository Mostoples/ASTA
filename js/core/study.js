/* ============================================================
   ASTA — Study Layer (lapisan metodologi penelitian)
   ------------------------------------------------------------
   Menangani hal-hal yang membuat data ASTA bisa
   dipertanggungjawabkan secara ilmiah dan etik:

   1. FASE STUDI (desain A-B-A withdrawal)
      A1 = baseline, umpan balik haptik NONAKTIF
      B  = intervensi, umpan balik haptik AKTIF
      A2 = penarikan, haptik dinonaktifkan kembali
      B2 = reinstatement
      Bila nyeri naik saat haptik dicabut lalu turun lagi
      ketika dipasang, itu bukti kausal yang jauh lebih kuat
      daripada sekadar tren menurun sepanjang waktu.

   2. ADVERSE EVENT (kejadian tidak diinginkan)
      Wajib untuk studi alat medis: iritasi kulit, luka
      tunggul, alat macet, nyeri meningkat setelah sesi.
      Berfungsi ganda sebagai mekanisme keselamatan.

   3. INFORMED CONSENT berversi + hak menarik diri.

   4. SKRINING PSIKOLOGIS (PHQ-9)
      Menjawab pertanyaan yang tidak bisa dijawab data alat:
      MENGAPA pasien berhenti latihan.
   ============================================================ */
(function (global) {
  'use strict';

  var Study = {};

  /* ============================================================
     1. FASE STUDI
     ============================================================ */
  var PHASES = {
    A1: { key: 'A1', label: 'Baseline (A1)', short: 'A1', haptic: false,
      color: '#8496ad', desc: 'Pengukuran awal tanpa umpan balik sensorik. Menjadi pembanding.' },
    B1: { key: 'B1', label: 'Intervensi (B1)', short: 'B1', haptic: true,
      color: '#2b6cde', desc: 'Umpan balik haptik aktif. Fase perlakuan utama.' },
    A2: { key: 'A2', label: 'Penarikan (A2)', short: 'A2', haptic: false,
      color: '#d98b0b', desc: 'Haptik dinonaktifkan sementara untuk menguji ketergantungan efek.' },
    B2: { key: 'B2', label: 'Reinstatement (B2)', short: 'B2', haptic: true,
      color: '#1c9e6b', desc: 'Haptik diaktifkan kembali. Menguji apakah efek dapat dipulihkan.' }
  };
  Study.PHASES = PHASES;
  Study.phaseDef = function (k) { return PHASES[k] || null; };

  /** Seluruh rentang fase milik seorang pasien, terurut */
  Study.phases = function (patientId) {
    return Store.list('studyPhases')
      .filter(function (p) { return p.patientId === patientId; })
      .sort(function (a, b) { return a.from < b.from ? -1 : 1; });
  };

  /** Fase yang berlaku pada tanggal tertentu */
  Study.phaseOn = function (patientId, dayKey) {
    var d = dayKey || U.today();
    var found = null;
    Study.phases(patientId).forEach(function (p) {
      if (d >= p.from && (!p.to || d <= p.to)) found = p;
    });
    return found;
  };

  Study.currentPhase = function (patientId) {
    return Study.phaseOn(patientId, U.today());
  };

  /** Apakah haptik seharusnya aktif hari ini menurut protokol */
  Study.hapticAllowed = function (patientId) {
    var p = Study.currentPhase(patientId);
    if (!p) return true;   // di luar protokol: bebas
    var def = PHASES[p.phase];
    return def ? def.haptic : true;
  };

  /**
   * Indeks label untuk penandaan pada grafik.
   * Mengembalikan daftar band {from,to,label,color} dalam satuan
   * indeks array agar bisa langsung dipakai Chart.line.
   */
  Study.phaseBands = function (patientId, dayKeys) {
    var phases = Study.phases(patientId);
    var out = [];
    phases.forEach(function (p) {
      var def = PHASES[p.phase];
      if (!def) return;
      var fromIdx = -1, toIdx = -1;
      dayKeys.forEach(function (k, i) {
        if (k >= p.from && (!p.to || k <= p.to)) {
          if (fromIdx < 0) fromIdx = i;
          toIdx = i;
        }
      });
      if (fromIdx >= 0) {
        out.push({
          from: fromIdx, to: toIdx, phase: p.phase,
          label: def.short, color: Chart.alpha(def.color, 0.1),
          textColor: def.color
        });
      }
    });
    return out;
  };

  /** Ringkasan hasil per fase — inti analisis penelitian */
  Study.phaseSummary = function (patientId) {
    var painAll = Store.list('painLogs').filter(function (p) { return p.patientId === patientId; });
    var telAll = Store.list('telemetry').filter(function (t) { return t.patientId === patientId; });
    var sesAll = Store.list('sessions').filter(function (s) { return s.patientId === patientId; });

    return Study.phases(patientId).map(function (p) {
      var def = PHASES[p.phase] || {};
      function inPhase(x) { return x.date >= p.from && (!p.to || x.date <= p.to); }

      var pain = painAll.filter(inPhase).map(function (x) { return x.level; });
      var tel = telAll.filter(inPhase);
      var ses = sesAll.filter(inPhase);
      var days = U.daysBetween(U.d(p.from), p.to ? U.d(p.to) : new Date()) + 1;
      var uniqDays = Object.keys(U.groupBy(ses, 'date')).length;

      var severe = painAll.filter(inPhase).filter(function (x) { return x.level >= 7; }).length;
      var sleep = painAll.filter(inPhase).filter(function (x) { return x.sleepDisturbed; }).length;

      return {
        phase: p.phase,
        label: def.label || p.phase,
        color: def.color,
        haptic: def.haptic,
        from: p.from,
        to: p.to,
        days: Math.max(1, days),
        note: p.note || '',
        painAvg: pain.length ? U.round(U.avg(pain), 2) : null,
        painSd: pain.length > 1 ? U.round(sd(pain), 2) : null,
        painMin: pain.length ? Math.min.apply(null, pain) : null,
        painMax: pain.length ? Math.max.apply(null, pain) : null,
        painN: pain.length,
        severeDays: severe,
        sleepDays: sleep,
        wearAvg: tel.length ? U.round(U.avg(tel.map(function (t) { return t.wearHours; })), 2) : null,
        gripSuccess: tel.length ? Math.round(U.avg(tel.map(function (t) { return t.gripSuccess * 100; }))) : null,
        sessions: uniqDays,
        adherencePct: Math.round((uniqDays / Math.max(1, days)) * 100),
        qualityAvg: ses.length ? Math.round(U.avg(ses.map(function (s) { return s.qualityScore || 0; }))) : null
      };
    });
  };

  function sd(arr) {
    if (arr.length < 2) return 0;
    var m = U.avg(arr);
    return Math.sqrt(U.avg(arr.map(function (v) { return Math.pow(v - m, 2); })));
  }
  Study.sd = sd;

  /**
   * Perbandingan antar fase: selisih nyeri baseline vs intervensi,
   * plus ukuran efek Cohen's d agar bisa dilaporkan.
   */
  Study.effect = function (patientId) {
    var sum = Study.phaseSummary(patientId);
    var withH = sum.filter(function (s) { return s.haptic && s.painAvg !== null; });
    var noH = sum.filter(function (s) { return !s.haptic && s.painAvg !== null; });
    if (!withH.length || !noH.length) return null;

    var mWith = U.avg(withH.map(function (s) { return s.painAvg; }));
    var mNo = U.avg(noH.map(function (s) { return s.painAvg; }));
    var sWith = U.avg(withH.map(function (s) { return s.painSd || 0; }));
    var sNo = U.avg(noH.map(function (s) { return s.painSd || 0; }));
    var pooled = Math.sqrt((Math.pow(sWith, 2) + Math.pow(sNo, 2)) / 2) || 1;
    var d = U.round((mNo - mWith) / pooled, 2);

    return {
      painWithHaptic: U.round(mWith, 2),
      painWithoutHaptic: U.round(mNo, 2),
      diff: U.round(mNo - mWith, 2),
      cohensD: d,
      magnitude: Math.abs(d) >= 0.8 ? 'besar' : Math.abs(d) >= 0.5 ? 'sedang' : Math.abs(d) >= 0.2 ? 'kecil' : 'sangat kecil',
      favorsHaptic: mWith < mNo,
      phasesWith: withH.map(function (s) { return s.phase; }),
      phasesWithout: noH.map(function (s) { return s.phase; })
    };
  };

  Study.addPhase = function (patientId, phase, from, to, note) {
    return Store.insert('studyPhases', {
      patientId: patientId, phase: phase, from: from, to: to || null, note: note || ''
    });
  };

  /* ============================================================
     2. ADVERSE EVENT
     ============================================================ */
  var AE_TYPES = [
    { id: 'iritasi_kulit', label: 'Iritasi / kemerahan kulit', icon: 'droplet', severityHint: 'ringan' },
    { id: 'luka_tunggul', label: 'Luka atau lecet pada tunggul', icon: 'alert', severityHint: 'sedang' },
    { id: 'socket_sore', label: 'Nyeri tekan akibat socket', icon: 'target', severityHint: 'ringan' },
    { id: 'nyeri_meningkat', label: 'Nyeri meningkat setelah sesi', icon: 'trend', severityHint: 'sedang' },
    { id: 'alat_macet', label: 'Aktuator macet / tidak merespons', icon: 'cpu', severityHint: 'sedang' },
    { id: 'elektroda_lepas', label: 'Elektroda lepas atau sinyal hilang', icon: 'wifiOff', severityHint: 'ringan' },
    { id: 'haptik_tidak_nyaman', label: 'Umpan balik haptik tidak nyaman', icon: 'zap', severityHint: 'ringan' },
    { id: 'panas_berlebih', label: 'Socket terasa panas berlebih', icon: 'thermometer', severityHint: 'sedang' },
    { id: 'jatuh', label: 'Terjatuh atau kehilangan keseimbangan', icon: 'alert', severityHint: 'berat' },
    { id: 'lain', label: 'Lainnya', icon: 'info', severityHint: 'ringan' }
  ];

  var AE_SEVERITY = {
    ringan: { key: 'ringan', label: 'Ringan', tone: 'success', desc: 'Tidak mengganggu aktivitas, sembuh sendiri.' },
    sedang: { key: 'sedang', label: 'Sedang', tone: 'warning', desc: 'Mengganggu aktivitas atau perlu penyesuaian alat.' },
    berat: { key: 'berat', label: 'Berat', tone: 'danger', desc: 'Menghentikan terapi atau perlu tindakan medis.' }
  };

  Study.AE_TYPES = AE_TYPES;
  Study.AE_SEVERITY = AE_SEVERITY;
  Study.aeType = function (id) { return AE_TYPES.find(function (t) { return t.id === id; }) || null; };

  Study.adverseEvents = function (patientId, opts) {
    var o = opts || {};
    var out = Store.list('adverseEvents');
    if (patientId) out = out.filter(function (a) { return a.patientId === patientId; });
    if (o.openOnly) out = out.filter(function (a) { return a.status !== 'selesai'; });
    if (o.severity) out = out.filter(function (a) { return a.severity === o.severity; });
    return out.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
  };

  /**
   * Laporkan kejadian tidak diinginkan.
   * Kejadian sedang/berat otomatis dieskalasi ke terapis & prostetis.
   */
  Study.reportAE = function (data) {
    var ae = Store.insert('adverseEvents', Object.assign({
      patientId: null,
      type: 'lain',
      severity: 'ringan',
      date: U.today(),
      at: new Date().toISOString(),
      body: '',
      relatedTo: 'alat',      // alat | latihan | haptik | socket | tidak-jelas
      stoppedTherapy: false,
      soughtCare: false,
      status: 'baru',          // baru | ditinjau | selesai
      reviewedBy: null,
      reviewNote: '',
      phase: null
    }, data));

    if (ae.patientId) {
      Store.update('adverseEvents', ae.id, {
        phase: (Study.currentPhase(ae.patientId) || {}).phase || null
      });
    }

    // Eskalasi
    var patient = ae.patientId ? Store.find('users', ae.patientId) : null;
    if (patient && (ae.severity === 'sedang' || ae.severity === 'berat')) {
      var t = Study.aeType(ae.type);
      var targets = [patient.therapistId, patient.prosthetistId].filter(Boolean);
      targets.forEach(function (uid) {
        Notify.push(uid, {
          type: 'adverse', tone: ae.severity === 'berat' ? 'danger' : 'warning',
          icon: 'alert',
          title: patient.name + ': ' + (t ? t.label : 'kejadian tidak diinginkan'),
          body: 'Tingkat ' + ae.severity + '.' + (ae.stoppedTherapy ? ' Terapi dihentikan.' : '') +
            (ae.body ? ' "' + String(ae.body).slice(0, 90) + '"' : ''),
          link: 'terapis-pasien.html?id=' + patient.id
        });
      });
    }
    return ae;
  };

  Study.reviewAE = function (id, reviewerId, note, status) {
    return Store.update('adverseEvents', id, {
      status: status || 'ditinjau',
      reviewedBy: reviewerId,
      reviewNote: note || '',
      reviewedAt: new Date().toISOString()
    });
  };

  Study.aeStats = function (patientId) {
    var list = Study.adverseEvents(patientId);
    var byType = U.groupBy(list, 'type');
    return {
      total: list.length,
      open: list.filter(function (a) { return a.status !== 'selesai'; }).length,
      ringan: list.filter(function (a) { return a.severity === 'ringan'; }).length,
      sedang: list.filter(function (a) { return a.severity === 'sedang'; }).length,
      berat: list.filter(function (a) { return a.severity === 'berat'; }).length,
      stopped: list.filter(function (a) { return a.stoppedTherapy; }).length,
      topTypes: Object.keys(byType).map(function (k) {
        return { key: k, n: byType[k].length, label: (Study.aeType(k) || {}).label || k };
      }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5),
      latest: list[0] || null
    };
  };

  /* ============================================================
     3. INFORMED CONSENT
     ============================================================ */
  var CONSENT_VERSION = '1.2';
  var CONSENT_ITEMS = [
    { id: 'tujuan', required: true,
      label: 'Saya memahami tujuan penelitian ASTA',
      body: 'Penelitian ini menguji apakah lengan bionik dengan umpan balik sensorik dapat menurunkan nyeri phantom dan meningkatkan kepatuhan terapi.' },
    { id: 'data_alat', required: true,
      label: 'Saya bersedia data pemakaian lengan bionik direkam',
      body: 'Meliputi jam pakai, jumlah cengkeraman, sinyal otot, gaya cengkeram, suhu dan kelembapan socket.' },
    { id: 'data_nyeri', required: true,
      label: 'Saya bersedia mencatat nyeri dan mengisi kuesioner',
      body: 'Termasuk skala nyeri harian, lokasi nyeri phantom, gangguan tidur, dan skrining kondisi psikologis.' },
    { id: 'fase', required: true,
      label: 'Saya memahami adanya fase tanpa umpan balik sensorik',
      body: 'Pada fase tertentu umpan balik haptik dinonaktifkan untuk pembanding. Anda dapat meminta penghentian fase ini kapan saja bila terasa memberat.' },
    { id: 'akses', required: true,
      label: 'Saya memahami siapa yang dapat mengakses data saya',
      body: 'Tim klinis yang menangani Anda: fisioterapis, dokter rehabilitasi medik, dan prostetis. Setiap akses tercatat.' },
    { id: 'publikasi', required: false,
      label: 'Saya mengizinkan data anonim digunakan untuk publikasi ilmiah',
      body: 'Identitas dihapus dan diganti kode subjek. Bersifat opsional dan tidak memengaruhi layanan Anda.' },
    { id: 'kontak', required: false,
      label: 'Saya bersedia dihubungi untuk tindak lanjut penelitian',
      body: 'Misalnya wawancara singkat mengenai pengalaman memakai alat.' }
  ];

  Study.CONSENT_VERSION = CONSENT_VERSION;
  Study.CONSENT_ITEMS = CONSENT_ITEMS;

  Study.consent = function (patientId) {
    var list = Store.list('consents')
      .filter(function (c) { return c.patientId === patientId; })
      .sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    return list[0] || null;
  };

  Study.consentValid = function (patientId) {
    var c = Study.consent(patientId);
    if (!c || c.withdrawn) return false;
    if (c.version !== CONSENT_VERSION) return false;
    return CONSENT_ITEMS.filter(function (i) { return i.required; })
      .every(function (i) { return c.agreed && c.agreed.indexOf(i.id) >= 0; });
  };

  Study.giveConsent = function (patientId, agreedIds, signature) {
    return Store.insert('consents', {
      patientId: patientId,
      version: CONSENT_VERSION,
      agreed: agreedIds || [],
      signature: signature || '',
      at: new Date().toISOString(),
      withdrawn: false
    });
  };

  Study.withdrawConsent = function (patientId, reason) {
    var c = Study.consent(patientId);
    if (!c) return null;
    var res = Store.update('consents', c.id, {
      withdrawn: true, withdrawnAt: new Date().toISOString(), withdrawReason: reason || ''
    });
    var p = Store.find('users', patientId);
    if (p && p.therapistId) {
      Notify.push(p.therapistId, {
        type: 'consent', tone: 'danger', icon: 'shield',
        title: p.name + ' menarik persetujuan penelitian',
        body: 'Pengumpulan data untuk keperluan penelitian dihentikan. Layanan rehabilitasi tetap berjalan.',
        link: 'terapis-pasien.html?id=' + patientId
      });
    }
    return res;
  };

  /* ---------------- Log akses data ---------------- */
  Study.logAccess = function (actorId, patientId, action) {
    if (!actorId || !patientId || actorId === patientId) return null;
    var list = Store.list('accessLog');
    // Batasi 400 entri terakhir agar tidak membebani penyimpanan
    if (list.length > 400) {
      Store.set('accessLog', list.slice(-350));
    }
    return Store.insert('accessLog', {
      actorId: actorId, patientId: patientId,
      action: action || 'lihat-data',
      at: new Date().toISOString()
    });
  };

  Study.accessLog = function (patientId, limit) {
    var out = Store.list('accessLog')
      .filter(function (l) { return !patientId || l.patientId === patientId; })
      .sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    return limit ? out.slice(0, limit) : out;
  };

  /* ============================================================
     4. SKRINING PSIKOLOGIS — PHQ-9
     ============================================================ */
  var PHQ9 = [
    'Kurang minat atau kesenangan dalam melakukan hal apa pun',
    'Merasa sedih, tertekan, atau putus harapan',
    'Sulit tidur, sering terbangun, atau tidur terlalu banyak',
    'Merasa lelah atau kurang bertenaga',
    'Nafsu makan berkurang atau makan berlebihan',
    'Merasa buruk tentang diri sendiri, merasa gagal atau mengecewakan orang lain',
    'Sulit berkonsentrasi, misalnya saat membaca atau menonton',
    'Bergerak atau berbicara sangat lambat, atau sebaliknya sangat gelisah',
    'Berpikir lebih baik mati atau ingin menyakiti diri sendiri'
  ];

  var PHQ9_OPTIONS = [
    { v: 0, label: 'Tidak pernah' },
    { v: 1, label: 'Beberapa hari' },
    { v: 2, label: 'Lebih dari separuh hari' },
    { v: 3, label: 'Hampir setiap hari' }
  ];

  Study.PHQ9 = PHQ9;
  Study.PHQ9_OPTIONS = PHQ9_OPTIONS;

  Study.phq9Interpret = function (score) {
    if (score <= 4) return { level: 'minimal', label: 'Minimal', tone: 'success',
      advice: 'Tidak ada indikasi depresi. Lanjutkan pemantauan rutin.' };
    if (score <= 9) return { level: 'ringan', label: 'Ringan', tone: 'primary',
      advice: 'Gejala ringan. Pantau dan tawarkan dukungan psikososial.' };
    if (score <= 14) return { level: 'sedang', label: 'Sedang', tone: 'warning',
      advice: 'Pertimbangkan rujukan ke psikolog klinis. Risiko putus terapi meningkat.' };
    if (score <= 19) return { level: 'sedang-berat', label: 'Sedang-Berat', tone: 'danger',
      advice: 'Rujukan ke psikolog atau psikiater dianjurkan.' };
    return { level: 'berat', label: 'Berat', tone: 'danger',
      advice: 'Rujukan segera ke layanan kesehatan jiwa.' };
  };

  Study.screenings = function (patientId, instrument) {
    return Store.list('screenings')
      .filter(function (s) {
        return s.patientId === patientId && (!instrument || s.instrument === instrument);
      })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };

  Study.latestScreening = function (patientId, instrument) {
    var l = Study.screenings(patientId, instrument || 'PHQ-9');
    return l.length ? l[l.length - 1] : null;
  };

  /** Apakah sudah waktunya skrining ulang (default 30 hari) */
  Study.screeningDue = function (patientId, days) {
    var last = Study.latestScreening(patientId, 'PHQ-9');
    if (!last) return true;
    return U.daysBetween(U.d(last.date), new Date()) >= (days || 30);
  };

  Study.saveScreening = function (patientId, answers) {
    var score = U.sum(answers);
    var interp = Study.phq9Interpret(score);
    var rec = Store.insert('screenings', {
      patientId: patientId,
      instrument: 'PHQ-9',
      date: U.today(),
      at: new Date().toISOString(),
      answers: answers,
      score: score,
      max: 27,
      level: interp.level,
      flagSelfHarm: (answers[8] || 0) >= 1
    });

    var p = Store.find('users', patientId);
    // Butir 9 (ide menyakiti diri) selalu dieskalasi, apa pun skor totalnya
    if (rec.flagSelfHarm && p && p.therapistId) {
      Notify.push(p.therapistId, {
        type: 'skrining', tone: 'danger', icon: 'alert',
        title: p.name + ': butir keselamatan PHQ-9 positif',
        body: 'Pasien melaporkan pikiran menyakiti diri. Perlu tindak lanjut segera.',
        link: 'terapis-pasien.html?id=' + patientId
      });
    } else if (score >= 15 && p && p.therapistId) {
      Notify.push(p.therapistId, {
        type: 'skrining', tone: 'warning', icon: 'brain',
        title: p.name + ': skor PHQ-9 ' + score + ' (' + interp.label + ')',
        body: interp.advice,
        link: 'terapis-pasien.html?id=' + patientId
      });
    }
    return rec;
  };

  /* ============================================================
     Korelasi kondisi psikologis dengan kepatuhan
     ============================================================ */
  Study.psychVsAdherence = function (therapistId) {
    var out = [];
    Store.list('users').filter(function (u) {
      return u.role === 'pasien' && (!therapistId || u.therapistId === therapistId);
    }).forEach(function (u) {
      var sc = Study.latestScreening(u.id, 'PHQ-9');
      if (!sc) return;
      var adh = Analytics.adherence(u.id, 14);
      out.push({ patient: u, phq9: sc.score, level: sc.level, adherence: adh.score });
    });
    var r = U.pearson(out.map(function (o) { return o.phq9; }), out.map(function (o) { return o.adherence; }));
    return { rows: out, r: r, strength: U.corrLabel(r) };
  };

  /* ============================================================
     Ekspor dataset penelitian lengkap (CSV, anonim)
     ============================================================ */
  Study.exportStudyCSV = function (anonymize) {
    var rows = [];
    var patients = Store.list('users').filter(function (u) { return u.role === 'pasien'; });

    patients.forEach(function (u, idx) {
      var sid = anonymize ? 'SUBJ-' + String(idx + 1).padStart(2, '0') : u.id;
      var painMap = {}, telMap = {};
      Store.list('painLogs').forEach(function (p) { if (p.patientId === u.id) painMap[p.date] = p; });
      Store.list('telemetry').forEach(function (t) { if (t.patientId === u.id) telMap[t.date] = t; });
      var sesByDay = U.groupBy(Store.list('sessions').filter(function (s) { return s.patientId === u.id; }), 'date');
      var aeByDay = U.groupBy(Study.adverseEvents(u.id), 'date');

      for (var i = 89; i >= 0; i--) {
        var key = U.dayKey(U.addDays(new Date(), -i));
        var ph = Study.phaseOn(u.id, key);
        var phDef = ph ? PHASES[ph.phase] : null;
        var p = painMap[key], t = telMap[key];
        var ss = sesByDay[key] || [];
        var ae = aeByDay[key] || [];

        rows.push([
          sid, key,
          ph ? ph.phase : '',
          phDef ? (phDef.haptic ? 1 : 0) : '',
          anonymize ? '' : u.amputation.level,
          anonymize ? '' : u.amputation.side,
          p ? p.level : '',
          p ? (p.types || []).join('|') : '',
          p ? (p.zones || []).join('|') : '',
          p ? (p.sleepDisturbed ? 1 : 0) : '',
          p ? (p.medication ? 1 : 0) : '',
          p ? p.durationMin : '',
          t ? t.wearHours : '',
          t ? t.gripCount : '',
          t ? U.round(t.gripSuccess * 100, 1) : '',
          t ? t.emgQuality : '',
          t ? t.avgForce : '',
          t ? t.hapticEvents : '',
          ss.length,
          U.sum(ss.map(function (s) { return s.durationMin; })),
          ss.length ? Math.round(U.avg(ss.map(function (s) { return s.qualityScore; }))) : '',
          ae.length,
          ae.length ? ae.map(function (a) { return a.type + ':' + a.severity; }).join('|') : ''
        ]);
      }
    });

    var headers = ['subject_id', 'date', 'study_phase', 'haptic_active', 'amputation_level',
      'amputation_side', 'pain_nrs', 'pain_types', 'pain_zones', 'sleep_disturbed',
      'medication_used', 'pain_duration_min', 'wear_hours', 'grip_count', 'grip_success_pct',
      'emg_quality', 'avg_force_pct', 'haptic_events', 'sessions', 'session_minutes',
      'quality_score', 'adverse_events', 'adverse_detail'];

    return {
      csv: U.toCSV(rows, headers),
      name: 'asta_dataset_' + U.today() + (anonymize ? '_anonim' : '') + '.csv',
      rows: rows.length,
      subjects: patients.length
    };
  };

  /** Ekspor daftar adverse event terpisah (format pelaporan etik) */
  Study.exportAECSV = function (anonymize) {
    var patients = Store.list('users').filter(function (u) { return u.role === 'pasien'; });
    var idMap = {};
    patients.forEach(function (u, i) { idMap[u.id] = 'SUBJ-' + String(i + 1).padStart(2, '0'); });

    var rows = Study.adverseEvents().map(function (a) {
      var t = Study.aeType(a.type);
      return [
        anonymize ? (idMap[a.patientId] || '-') : (Store.find('users', a.patientId) || {}).name || '-',
        a.date, a.phase || '', a.type, t ? t.label : '', a.severity,
        a.relatedTo, a.stoppedTherapy ? 1 : 0, a.soughtCare ? 1 : 0,
        a.status, String(a.body || '').replace(/[\r\n]+/g, ' '),
        String(a.reviewNote || '').replace(/[\r\n]+/g, ' ')
      ];
    });
    var headers = ['subject', 'date', 'study_phase', 'ae_code', 'ae_label', 'severity',
      'related_to', 'stopped_therapy', 'sought_care', 'status', 'description', 'review_note'];
    return { csv: U.toCSV(rows, headers), name: 'asta_adverse_events_' + U.today() + '.csv', rows: rows.length };
  };

  global.Study = Study;
})(window);
