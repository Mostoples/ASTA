/* ============================================================
   ASTA — Seed data demo
   Membangun dataset 90 hari yang realistis dan konsisten:
   pasien, resep latihan, sesi, catatan nyeri, jadwal,
   telemetri harian, notifikasi.
   Pola yang ditanam: kepatuhan tinggi -> nyeri phantom turun.
   ============================================================ */
(function (global) {
  'use strict';

  var Seed = {};
  var SEED_VERSION = 7;

  /* ---------------- Katalog latihan ---------------- */
  var EXERCISES = [
    { id: 'ex_open_close', name: 'Buka–Tutup Terkontrol', cat: 'motorik', unit: 'rep', target: 15,
      desc: 'Kontraksi fleksor untuk menutup, ekstensor untuk membuka, tahan 2 detik setiap posisi.',
      cue: ['Tutup perlahan', 'Tahan 2 detik', 'Buka penuh', 'Rileks'], grip: 'power', minEmg: 0.35 },
    { id: 'ex_pinch', name: 'Presisi Pinch', cat: 'motorik', unit: 'rep', target: 12,
      desc: 'Latih cengkeraman halus ibu jari dan telunjuk untuk memegang benda kecil.',
      cue: ['Bentuk pinch', 'Jaga gaya rendah', 'Lepas'], grip: 'pinch', minEmg: 0.28 },
    { id: 'ex_tripod', name: 'Tripod Grip', cat: 'motorik', unit: 'rep', target: 12,
      desc: 'Tiga jari untuk memegang alat tulis atau sendok.', cue: ['Tripod', 'Tahan', 'Lepas'],
      grip: 'tripod', minEmg: 0.3 },
    { id: 'ex_force_ctrl', name: 'Kontrol Gaya Bertingkat', cat: 'motorik', unit: 'rep', target: 10,
      desc: 'Capai target gaya 30%, 60%, lalu 85% tanpa melampaui batas. Melatih gradasi kontraksi.',
      cue: ['Target 30%', 'Target 60%', 'Target 85%', 'Rileks'], grip: 'power', minEmg: 0.25 },
    { id: 'ex_wrist_rot', name: 'Rotasi Pergelangan', cat: 'motorik', unit: 'rep', target: 14,
      desc: 'Pronasi dan supinasi memakai sinyal bisep.', cue: ['Putar dalam', 'Netral', 'Putar luar'],
      grip: 'open', minEmg: 0.4 },
    { id: 'ex_endurance', name: 'Ketahanan Cengkeram', cat: 'motorik', unit: 'detik', target: 90,
      desc: 'Pertahankan gaya 50% selama mungkin untuk melatih ketahanan otot residual.',
      cue: ['Tahan 50%', 'Napas teratur'], grip: 'power', minEmg: 0.4 },

    { id: 'ex_mirror', name: 'Terapi Cermin', cat: 'phantom', unit: 'menit', target: 12,
      desc: 'Gerakkan tangan sehat di depan cermin digital. Otak menerima umpan balik visual seolah lengan yang hilang bergerak.',
      cue: ['Buka tangan', 'Tutup tangan', 'Putar pergelangan'] },
    { id: 'ex_laterality', name: 'Pengenalan Sisi (GMI-1)', cat: 'phantom', unit: 'soal', target: 30,
      desc: 'Tentukan gambar tangan kiri atau kanan secepat mungkin. Tahap pertama Graded Motor Imagery.' },
    { id: 'ex_imagery', name: 'Imajinasi Gerak (GMI-2)', cat: 'phantom', unit: 'menit', target: 8,
      desc: 'Bayangkan gerakan tangan tanpa menggerakkannya. Mengaktifkan korteks motorik tanpa nyeri.',
      cue: ['Bayangkan menggenggam', 'Bayangkan melepas', 'Bayangkan menunjuk'] },
    { id: 'ex_sensory', name: 'Diskriminasi Sensorik', cat: 'phantom', unit: 'soal', target: 20,
      desc: 'Tebak lokasi getaran haptik dari lengan bionik tanpa melihat. Melatih ulang peta sensorik.' },
    { id: 'ex_desens', name: 'Desensitisasi Tunggul', cat: 'phantom', unit: 'menit', target: 6,
      desc: 'Usapan bertekstur pada tunggul untuk menurunkan hipersensitivitas.',
      cue: ['Tekstur halus', 'Tekstur sedang', 'Tekstur kasar'] },
    { id: 'ex_relax', name: 'Relaksasi & Napas', cat: 'phantom', unit: 'menit', target: 10,
      desc: 'Napas terkontrol untuk menurunkan tonus otot dan persepsi nyeri.', cue: ['Tarik 4', 'Tahan 4', 'Buang 6'] },

    { id: 'ex_adl_cup', name: 'ADL: Memegang Cangkir', cat: 'adl', unit: 'rep', target: 10,
      desc: 'Angkat dan letakkan cangkir tanpa menjatuhkan. Uji kontrol gaya dunia nyata.', grip: 'power' },
    { id: 'ex_adl_zip', name: 'ADL: Menutup Zipper', cat: 'adl', unit: 'rep', target: 8,
      desc: 'Latihan pinch fungsional untuk berpakaian mandiri.', grip: 'pinch' },
    { id: 'ex_adl_bottle', name: 'ADL: Membuka Botol', cat: 'adl', unit: 'rep', target: 8,
      desc: 'Kombinasi power grip dan rotasi pergelangan.', grip: 'power' },
    { id: 'ex_bbt', name: 'Box & Block Test', cat: 'adl', unit: 'blok', target: 22,
      desc: 'Pindahkan blok sebanyak mungkin dalam 60 detik. Asesmen fungsi standar.', grip: 'tripod' }
  ];

  var PAIN_TYPES = [
    { id: 'kesetrum', label: 'Seperti kesetrum', icon: 'zap' },
    { id: 'kram', label: 'Kram / kaku', icon: 'minus' },
    { id: 'terjepit', label: 'Terjepit / tertekan', icon: 'target' },
    { id: 'terbakar', label: 'Panas terbakar', icon: 'fire' },
    { id: 'tertusuk', label: 'Tertusuk', icon: 'zap' },
    { id: 'gatal', label: 'Gatal phantom', icon: 'waves' },
    { id: 'telescoping', label: 'Terasa memendek', icon: 'minus' }
  ];

  var PAIN_TRIGGERS = ['Cuaca dingin', 'Kelelahan', 'Stres', 'Kurang tidur', 'Socket longgar',
    'Setelah latihan berat', 'Tanpa pemicu jelas', 'Duduk terlalu lama'];

  var ZONES = [
    { id: 'stump', label: 'Tunggul', phantom: false },
    { id: 'ph_forearm', label: 'Lengan bawah (phantom)', phantom: true },
    { id: 'ph_wrist', label: 'Pergelangan (phantom)', phantom: true },
    { id: 'ph_palm', label: 'Telapak (phantom)', phantom: true },
    { id: 'ph_thumb', label: 'Ibu jari (phantom)', phantom: true },
    { id: 'ph_fingers', label: 'Jari-jari (phantom)', phantom: true },
    { id: 'shoulder', label: 'Bahu sisi amputasi', phantom: false },
    { id: 'neck', label: 'Leher / punggung atas', phantom: false }
  ];

  Seed.EXERCISES = EXERCISES;
  Seed.PAIN_TYPES = PAIN_TYPES;
  Seed.PAIN_TRIGGERS = PAIN_TRIGGERS;
  Seed.ZONES = ZONES;

  Seed.exercise = function (id) { return EXERCISES.find(function (e) { return e.id === id; }) || null; };
  Seed.zone = function (id) { return ZONES.find(function (z) { return z.id === id; }) || null; };
  Seed.painType = function (id) { return PAIN_TYPES.find(function (p) { return p.id === id; }) || null; };

  /* ============================================================
     Pembangkit data
     ============================================================ */
  Seed.run = function (force) {
    if (!force && Store.get('seed:version') === SEED_VERSION) return false;

    var rand = U.seedRand(20260828);
    function r(min, max) { return rand() * (max - min) + min; }
    function ri(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
    function chance(p) { return rand() < p; }
    function pick(a) { return a[Math.floor(rand() * a.length)]; }

    /* ---------- Pengguna ---------- */
    var users = [
      { id: 'u_pat_1', role: 'pasien', name: 'Rizky Nugraha', email: 'rizky@asta.id', phone: '0812-1100-2201',
        gender: 'L', birth: '1994-03-17', city: 'Bandung',
        amputation: { level: 'Transradial', side: 'Kanan', cause: 'Trauma kecelakaan kerja', date: '2024-05-11' },
        device: { serial: 'ASTA-ARM-0142', fittedAt: '2025-11-20', socket: 'Silikon liner + suspensi vakum' },
        therapistId: 'u_ter_1', prosthetistId: 'u_pro_1', doctorId: 'u_ter_2',
        program: 'Program 12 Minggu — Fase 3', joinedAt: '2025-11-25', active: true, avatar: 'primary' },
      { id: 'u_pat_2', role: 'pasien', name: 'Sri Wahyuni', email: 'sri@asta.id', phone: '0857-2300-1188',
        gender: 'P', birth: '1988-09-02', city: 'Yogyakarta',
        amputation: { level: 'Transradial', side: 'Kiri', cause: 'Amputasi pasca infeksi', date: '2023-12-04' },
        device: { serial: 'ASTA-ARM-0118', fittedAt: '2025-09-08', socket: 'Laminasi karbon' },
        therapistId: 'u_ter_1', prosthetistId: 'u_pro_1', doctorId: 'u_ter_2',
        program: 'Program 12 Minggu — Fase 4', joinedAt: '2025-09-15', active: true, avatar: 'teal' },
      { id: 'u_pat_3', role: 'pasien', name: 'Bagas Prasetyo', email: 'bagas@asta.id', phone: '0813-4400-9922',
        gender: 'L', birth: '2001-01-28', city: 'Surabaya',
        amputation: { level: 'Transhumeral', side: 'Kanan', cause: 'Trauma kecelakaan lalu lintas', date: '2025-06-19' },
        device: { serial: 'ASTA-ARM-0203', fittedAt: '2026-04-02', socket: 'Silikon liner + pin lock' },
        therapistId: 'u_ter_1', prosthetistId: 'u_pro_1', doctorId: 'u_ter_2',
        program: 'Program 12 Minggu — Fase 1', joinedAt: '2026-04-06', active: true, avatar: 'violet' },
      { id: 'u_pat_4', role: 'pasien', name: 'Dewi Lestari', email: 'dewi@asta.id', phone: '0821-7788-3300',
        gender: 'P', birth: '1979-06-14', city: 'Semarang',
        amputation: { level: 'Transradial', side: 'Kanan', cause: 'Komplikasi diabetes', date: '2024-11-30' },
        device: { serial: 'ASTA-ARM-0166', fittedAt: '2026-01-15', socket: 'Laminasi karbon' },
        therapistId: 'u_ter_1', prosthetistId: 'u_pro_1', doctorId: 'u_ter_2',
        program: 'Program 12 Minggu — Fase 2', joinedAt: '2026-01-20', active: true, avatar: 'success' },
      { id: 'u_pat_5', role: 'pasien', name: 'Ahmad Fauzan', email: 'fauzan@asta.id', phone: '0819-2211-4455',
        gender: 'L', birth: '1996-11-08', city: 'Makassar',
        amputation: { level: 'Transradial', side: 'Kiri', cause: 'Trauma mesin industri', date: '2025-02-21' },
        device: { serial: 'ASTA-ARM-0187', fittedAt: '2026-02-27', socket: 'Silikon liner' },
        therapistId: 'u_ter_1', prosthetistId: 'u_pro_1', doctorId: 'u_ter_2',
        program: 'Program 12 Minggu — Fase 2', joinedAt: '2026-03-02', active: true, avatar: 'primary' },

      { id: 'u_ter_1', role: 'terapis', name: 'Anisa Rahmawati', email: 'anisa@asta.id',
        title: 'S.Ft, Fisioterapis', str: 'STR-FT-2231-0091', clinic: 'Klinik Rehab ASTA Bandung',
        active: true, avatar: 'teal' },
      { id: 'u_ter_2', role: 'terapis', name: 'dr. Hendra Wijaya', email: 'hendra@asta.id',
        title: 'Sp.KFR (Rehab Medik)', str: 'STR-DR-1180-0447', clinic: 'RS Rehab Medik ASTA',
        active: true, avatar: 'primary' },
      { id: 'u_pro_1', role: 'prostetis', name: 'Budi Santoso', email: 'budi@asta.id',
        title: 'Prostetis-Ortotis', str: 'STR-PO-3390-0028', clinic: 'Bengkel P&O ASTA',
        active: true, avatar: 'violet' },
      { id: 'u_adm_1', role: 'admin', name: 'Maya Kusuma', email: 'maya@asta.id',
        title: 'Admin Klinik', clinic: 'Klinik Rehab ASTA Bandung', active: true, avatar: 'success' }
    ];
    Store.set('users', users);

    var patients = users.filter(function (u) { return u.role === 'pasien'; });

    /* ---------- Resep program per pasien ---------- */
    var prescriptions = [
      { id: 'rx_1', patientId: 'u_pat_1', therapistId: 'u_ter_1', phase: 3, weeklyTarget: 5,
        startedAt: '2026-07-06', note: 'Fokus kontrol gaya dan ADL. Nyeri phantom menurun, lanjutkan terapi cermin 3x/minggu.',
        items: [
          { exId: 'ex_open_close', sets: 3, reps: 15, freq: 5 },
          { exId: 'ex_force_ctrl', sets: 3, reps: 10, freq: 4 },
          { exId: 'ex_pinch', sets: 2, reps: 12, freq: 4 },
          { exId: 'ex_mirror', sets: 1, reps: 12, freq: 3 },
          { exId: 'ex_sensory', sets: 1, reps: 20, freq: 3 },
          { exId: 'ex_adl_cup', sets: 2, reps: 10, freq: 3 }
        ] },
      { id: 'rx_2', patientId: 'u_pat_2', therapistId: 'u_ter_1', phase: 4, weeklyTarget: 5,
        startedAt: '2026-06-15', note: 'Fase lanjut, tekankan ADL dan ketahanan. Kepatuhan sangat baik.',
        items: [
          { exId: 'ex_endurance', sets: 2, reps: 90, freq: 4 },
          { exId: 'ex_tripod', sets: 3, reps: 12, freq: 4 },
          { exId: 'ex_adl_bottle', sets: 2, reps: 8, freq: 3 },
          { exId: 'ex_bbt', sets: 1, reps: 22, freq: 2 },
          { exId: 'ex_mirror', sets: 1, reps: 10, freq: 2 }
        ] },
      { id: 'rx_3', patientId: 'u_pat_3', therapistId: 'u_ter_1', phase: 1, weeklyTarget: 6,
        startedAt: '2026-08-03', note: 'Pasien baru, nyeri phantom tinggi. Prioritaskan GMI dan desensitisasi sebelum beban motorik.',
        items: [
          { exId: 'ex_laterality', sets: 1, reps: 30, freq: 6 },
          { exId: 'ex_imagery', sets: 1, reps: 8, freq: 6 },
          { exId: 'ex_mirror', sets: 1, reps: 12, freq: 5 },
          { exId: 'ex_desens', sets: 1, reps: 6, freq: 5 },
          { exId: 'ex_open_close', sets: 2, reps: 10, freq: 3 },
          { exId: 'ex_relax', sets: 1, reps: 10, freq: 4 }
        ] },
      { id: 'rx_4', patientId: 'u_pat_4', therapistId: 'u_ter_1', phase: 2, weeklyTarget: 4,
        startedAt: '2026-07-20', note: 'Perhatikan kondisi kulit tunggul (riwayat diabetes). Hentikan bila ada kemerahan.',
        items: [
          { exId: 'ex_open_close', sets: 2, reps: 12, freq: 4 },
          { exId: 'ex_pinch', sets: 2, reps: 10, freq: 3 },
          { exId: 'ex_mirror', sets: 1, reps: 10, freq: 3 },
          { exId: 'ex_relax', sets: 1, reps: 10, freq: 4 },
          { exId: 'ex_adl_zip', sets: 2, reps: 8, freq: 2 }
        ] },
      { id: 'rx_5', patientId: 'u_pat_5', therapistId: 'u_ter_1', phase: 2, weeklyTarget: 5,
        startedAt: '2026-07-13', note: 'Kepatuhan menurun 2 minggu terakhir. Perlu tindak lanjut telekonsultasi.',
        items: [
          { exId: 'ex_open_close', sets: 3, reps: 15, freq: 5 },
          { exId: 'ex_wrist_rot', sets: 2, reps: 14, freq: 4 },
          { exId: 'ex_laterality', sets: 1, reps: 30, freq: 3 },
          { exId: 'ex_mirror', sets: 1, reps: 12, freq: 3 },
          { exId: 'ex_adl_cup', sets: 2, reps: 10, freq: 2 }
        ] }
    ];
    Store.set('prescriptions', prescriptions);

    /* ---------- Profil kepatuhan per pasien ---------- */
    // adherenceBase: peluang latihan per hari; painStart/painEnd: tren nyeri
    var profiles = {
      u_pat_1: { adh: 0.82, painStart: 7.2, painEnd: 3.4, wear: [5.2, 7.8], quality: [72, 91], trend: 'baik' },
      u_pat_2: { adh: 0.91, painStart: 6.4, painEnd: 2.1, wear: [6.4, 9.1], quality: [80, 95], trend: 'sangat baik' },
      u_pat_3: { adh: 0.63, painStart: 8.6, painEnd: 6.8, wear: [2.1, 4.4], quality: [48, 68], trend: 'awal' },
      u_pat_4: { adh: 0.71, painStart: 6.8, painEnd: 4.6, wear: [3.6, 5.8], quality: [61, 78], trend: 'stabil' },
      u_pat_5: { adh: 0.42, painStart: 7.0, painEnd: 6.4, wear: [2.4, 3.2], quality: [55, 63], trend: 'menurun' }
    };

    var DAYS = 90;
    var sessions = [];
    var painLogs = [];
    var telemetry = [];
    var today = U.startOfDay(new Date());

    /* ---------- Fase studi (desain A-B-A withdrawal) ----------
       Rizky (u_pat_1) dan Sri (u_pat_2) menjalani protokol penuh
       A1 -> B1 -> A2 -> B2 sehingga efek penarikan haptik
       dapat dianalisis. Pasien lain baru pada fase awal. */
    var studyPhases = [];
    function phase(pid, ph, fromOffset, toOffset, note) {
      studyPhases.push({
        id: 'sp_' + pid + '_' + ph,
        patientId: pid, phase: ph,
        from: U.dayKey(U.addDays(today, -fromOffset)),
        to: toOffset === null ? null : U.dayKey(U.addDays(today, -toOffset)),
        note: note || ''
      });
    }
    // Protokol penuh A1-B1-A2-B2
    phase('u_pat_1', 'A1', 89, 76, 'Baseline 14 hari tanpa umpan balik haptik.');
    phase('u_pat_1', 'B1', 75, 41, 'Intervensi haptik proporsional 35 hari.');
    phase('u_pat_1', 'A2', 40, 27, 'Penarikan haptik 14 hari untuk uji ketergantungan efek.');
    phase('u_pat_1', 'B2', 26, null, 'Haptik diaktifkan kembali.');

    phase('u_pat_2', 'A1', 89, 79, 'Baseline 11 hari.');
    phase('u_pat_2', 'B1', 78, 45, 'Intervensi haptik.');
    phase('u_pat_2', 'A2', 44, 31, 'Penarikan haptik.');
    phase('u_pat_2', 'B2', 30, null, 'Reinstatement, adaptif.');

    // Pasien lain: baru baseline/intervensi awal
    phase('u_pat_3', 'A1', 24, 11, 'Baseline pasien baru.');
    phase('u_pat_3', 'B1', 10, null, 'Mulai intervensi haptik.');
    phase('u_pat_4', 'A1', 55, 42, 'Baseline.');
    phase('u_pat_4', 'B1', 41, null, 'Intervensi haptik.');
    phase('u_pat_5', 'A1', 62, 49, 'Baseline.');
    phase('u_pat_5', 'B1', 48, null, 'Intervensi haptik.');
    Store.set('studyPhases', studyPhases);

    /** Cari fase untuk pasien pada tanggal tertentu */
    function phaseFor(pid, dayKey) {
      var found = null;
      studyPhases.forEach(function (sp) {
        if (sp.patientId !== pid) return;
        if (dayKey >= sp.from && (!sp.to || dayKey <= sp.to)) found = sp;
      });
      return found;
    }
    var HAPTIC_ON = { A1: false, B1: true, A2: false, B2: true };

    patients.forEach(function (p) {
      var prof = profiles[p.id];
      var rx = prescriptions.find(function (x) { return x.patientId === p.id; });
      var items = rx ? rx.items : [];

      for (var d = DAYS - 1; d >= 0; d--) {
        var date = U.addDays(today, -d);
        var key = U.dayKey(date);
        var progress = (DAYS - 1 - d) / (DAYS - 1);   // 0 di awal, 1 hari ini
        var dow = date.getDay();

        // Fase studi hari itu & status haptik
        var ph = phaseFor(p.id, key);
        var hapticOn = ph ? HAPTIC_ON[ph.phase] : true;
        // Efek haptik pada nyeri: menurunkan, dengan sedikit jeda adaptasi.
        // Saat haptik dicabut (A2), nyeri naik kembali sebagian.
        var hapticEffect = hapticOn ? -1.35 : 0.75;

        // Kepatuhan: pasien "menurun" makin jarang di akhir, yang lain membaik
        var adh = prof.adh;
        if (prof.trend === 'menurun') adh = prof.adh * (1 - progress * 0.55);
        else if (prof.trend === 'awal') adh = prof.adh * (0.72 + progress * 0.38);
        else adh = prof.adh * (0.86 + progress * 0.2);
        if (dow === 0) adh *= 0.55;   // Minggu lebih santai

        var didExercise = chance(U.clamp(adh, 0, 0.97));

        /* ---- Sesi latihan ---- */
        if (didExercise && items.length) {
          var nItems = ri(2, Math.min(4, items.length));
          var chosen = items.slice().sort(function () { return rand() - 0.5; }).slice(0, nItems);
          var hour = ri(7, 20);
          var minute = pick([0, 15, 30, 45]);
          var sessStart = new Date(date.getTime());
          sessStart.setHours(hour, minute, 0, 0);

          var qMin = prof.quality[0], qMax = prof.quality[1];
          var quality = Math.round(U.lerp(qMin, qMax, progress) + r(-6, 6));

          var totalMin = 0;
          var exResults = chosen.map(function (it) {
            var ex = Seed.exercise(it.exId);
            var targetVal = it.reps;
            var completion = U.clamp(r(0.62, 1.06) * (0.82 + quality / 500), 0.2, 1.15);
            var done = Math.round(targetVal * completion);
            var mins = ex.unit === 'menit' ? Math.round(targetVal * completion)
              : ex.unit === 'detik' ? Math.round(targetVal * completion / 60) + 2
                : Math.round(targetVal * completion * 0.32) + 2;
            totalMin += mins;
            return {
              exId: it.exId, target: targetVal, done: done, unit: ex.unit,
              minutes: mins,
              quality: U.clamp(Math.round(quality + r(-9, 9)), 20, 100),
              avgEmg: U.round(r(0.34, 0.86), 2),
              peakForce: Math.round(r(38, 88)),
              smoothness: U.clamp(Math.round(quality + r(-12, 10)), 15, 100)
            };
          });

          sessions.push({
            id: 'ses_' + p.id + '_' + key + '_' + ri(100, 999),
            patientId: p.id, prescriptionId: rx.id,
            date: key,
            startedAt: sessStart.toISOString(),
            durationMin: totalMin,
            status: chance(0.93) ? 'selesai' : 'sebagian',
            adherencePct: U.clamp(Math.round((chosen.length / Math.max(1, Math.min(4, items.length))) * 100 + r(-8, 8)), 20, 100),
            qualityScore: U.clamp(quality, 20, 100),
            exercises: exResults,
            deviceMode: chance(0.86) ? 'bionic' : 'tanpa-alat',
            note: chance(0.16) ? pick([
              'Terasa lebih ringan dari biasanya.',
              'Tunggul sedikit nyeri di akhir sesi.',
              'Sinyal EMG sempat drop, perlu re-kalibrasi.',
              'Bisa memegang cangkir tanpa terjatuh hari ini.',
              'Cepat lelah, istirahat dua kali.'
            ]) : ''
          });
        }

        /* ---- Catatan nyeri phantom ---- */
        // Nyeri menurun seiring waktu, dan lebih rendah bila hari itu latihan
        if (chance(0.78)) {
          var basePain = U.lerp(prof.painStart, prof.painEnd, progress);
          var exerciseEffect = didExercise ? -0.85 : 0.55;
          var noise = r(-0.85, 0.85);
          var weather = (dow === 6 || dow === 0) ? r(-0.3, 0.4) : 0;
          var lvl = U.clamp(
            Math.round(basePain + exerciseEffect + hapticEffect + noise + weather), 0, 10);

          var zoneCount = lvl >= 7 ? ri(2, 3) : ri(1, 2);
          var zones = [];
          var phantomZones = ZONES.filter(function (z) { return z.phantom; });
          for (var z = 0; z < zoneCount; z++) {
            var zz = pick(phantomZones).id;
            if (zones.indexOf(zz) < 0) zones.push(zz);
          }
          if (chance(0.28)) zones.push('stump');

          painLogs.push({
            id: 'pain_' + p.id + '_' + key,
            patientId: p.id,
            date: key,
            loggedAt: new Date(date.getTime() + (ri(6, 22) * 3600000)).toISOString(),
            level: lvl,
            types: (function () {
              var n = lvl >= 6 ? ri(1, 3) : 1;
              var out = [];
              for (var i = 0; i < n; i++) {
                var t = pick(PAIN_TYPES).id;
                if (out.indexOf(t) < 0) out.push(t);
              }
              return out;
            })(),
            zones: zones,
            trigger: pick(PAIN_TRIGGERS),
            durationMin: lvl >= 7 ? ri(45, 220) : ri(8, 60),
            sleepDisturbed: lvl >= 7 && chance(0.62),
            medication: lvl >= 8 && chance(0.5),
            didExerciseToday: didExercise,
            note: chance(0.14) ? pick([
              'Muncul saat cuaca dingin pagi hari.',
              'Berkurang setelah terapi cermin.',
              'Terasa jari phantom mengepal sendiri.',
              'Nyeri saat socket dilepas.',
              'Terbangun tengah malam karena nyeri.'
            ]) : ''
          });
        }

        /* ---- Telemetri harian lengan bionik ---- */
        var wearH = didExercise
          ? U.lerp(prof.wear[0], prof.wear[1], progress) + r(-0.9, 1.2)
          : U.lerp(prof.wear[0], prof.wear[1], progress) * r(0.25, 0.6);
        wearH = U.clamp(wearH, 0, 13);

        telemetry.push({
          id: 'tel_' + p.id + '_' + key,
          patientId: p.id,
          date: key,
          wearHours: U.round(wearH, 1),
          gripCount: Math.round(wearH * r(24, 52)),
          gripSuccess: U.round(U.clamp(U.lerp(0.71, 0.94, progress) + r(-0.06, 0.05), 0.4, 0.99), 3),
          avgForce: Math.round(r(42, 76)),
          peakForce: Math.round(r(72, 96)),
          hapticEvents: hapticOn ? Math.round(wearH * r(14, 34)) : 0,
          hapticActive: hapticOn,
          studyPhase: ph ? ph.phase : null,
          emgQuality: Math.round(U.clamp(U.lerp(74, 94, progress) + r(-9, 7), 45, 99)),
          batteryCycles: chance(0.7) ? 1 : 2,
          socketTempAvg: U.round(r(31.6, 35.4), 1),
          socketHumidity: Math.round(r(32, 68)),
          recalibrations: chance(0.12) ? 1 : 0
        });
      }
    });

    Store.set('sessions', sessions);
    Store.set('painLogs', painLogs);
    Store.set('telemetry', telemetry);

    /* ---------- Jadwal terapi ---------- */
    var schedules = [];
    patients.forEach(function (p) {
      var rx = prescriptions.find(function (x) { return x.patientId === p.id; });
      // Jadwal latihan mandiri rutin
      var slots = p.id === 'u_pat_3' ? ['07:30', '16:00'] : ['08:00'];
      slots.forEach(function (time, i) {
        schedules.push({
          id: 'sch_' + p.id + '_r' + i,
          patientId: p.id,
          type: 'latihan',
          title: 'Latihan Mandiri' + (slots.length > 1 ? (i === 0 ? ' Pagi' : ' Sore') : ''),
          time: time,
          days: p.id === 'u_pat_3' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5],
          durationMin: 25,
          prescriptionId: rx ? rx.id : null,
          reminder: true,
          reminderBefore: 15,
          active: true
        });
      });
      // Sesi terapi cermin khusus
      schedules.push({
        id: 'sch_' + p.id + '_m',
        patientId: p.id, type: 'phantom',
        title: 'Terapi Cermin & GMI',
        time: '19:30',
        days: p.id === 'u_pat_3' ? [1, 2, 3, 4, 5] : [1, 3, 5],
        durationMin: 20,
        reminder: true, reminderBefore: 10, active: true
      });
      // Catat nyeri harian
      schedules.push({
        id: 'sch_' + p.id + '_p',
        patientId: p.id, type: 'nyeri',
        title: 'Catat Nyeri Harian',
        time: '21:00',
        days: [0, 1, 2, 3, 4, 5, 6],
        durationMin: 3,
        reminder: true, reminderBefore: 0, active: true
      });
    });

    /* ---------- Telekonsultasi (janji temu) ---------- */
    var appointments = [
      { id: 'apt_1', patientId: 'u_pat_1', withId: 'u_ter_1', type: 'telekonsultasi',
        title: 'Evaluasi Fase 3', at: iso(U.addDays(today, 1), 10, 0), durationMin: 30,
        status: 'terjadwal', note: 'Review kontrol gaya dan skor nyeri 2 minggu terakhir.' },
      { id: 'apt_2', patientId: 'u_pat_3', withId: 'u_ter_1', type: 'telekonsultasi',
        title: 'Pendampingan GMI', at: iso(U.addDays(today, 0), 16, 30), durationMin: 45,
        status: 'terjadwal', note: 'Nyeri phantom masih tinggi, dampingi tahap imagery.' },
      { id: 'apt_3', patientId: 'u_pat_5', withId: 'u_ter_1', type: 'telekonsultasi',
        title: 'Tindak Lanjut Kepatuhan', at: iso(U.addDays(today, 2), 14, 0), durationMin: 30,
        status: 'terjadwal', note: 'Kepatuhan turun ke 42%. Cari hambatan penggunaan alat.' },
      { id: 'apt_4', patientId: 'u_pat_2', withId: 'u_pro_1', type: 'kunjungan',
        title: 'Servis & Tuning Socket', at: iso(U.addDays(today, 4), 9, 0), durationMin: 60,
        status: 'terjadwal', note: 'Keluhan socket agak longgar saat berkeringat.' },
      { id: 'apt_5', patientId: 'u_pat_4', withId: 'u_ter_2', type: 'telekonsultasi',
        title: 'Kontrol Dokter Rehab Medik', at: iso(U.addDays(today, 6), 11, 0), durationMin: 30,
        status: 'terjadwal', note: 'Periksa kondisi kulit tunggul, riwayat diabetes.' },
      { id: 'apt_6', patientId: 'u_pat_1', withId: 'u_ter_1', type: 'telekonsultasi',
        title: 'Evaluasi Fase 2', at: iso(U.addDays(today, -14), 10, 0), durationMin: 30,
        status: 'selesai', note: 'Naik ke fase 3. Nyeri turun dari 7 ke 4.' }
    ];
    Store.set('appointments', appointments);

    /* ---------- Sesi mendatang otomatis dari jadwal ---------- */
    Store.set('schedules', schedules);

    /* ---------- Notifikasi ---------- */
    var notifs = [
      { id: 'n_1', userId: 'u_pat_1', type: 'reminder', tone: 'primary', icon: 'bell',
        title: 'Latihan Mandiri pukul 08:00', body: 'Program Fase 3: buka-tutup terkontrol, kontrol gaya, pinch.',
        at: iso(today, 7, 45), read: false, link: 'sesi-latihan.html' },
      { id: 'n_2', userId: 'u_pat_1', type: 'nyeri', tone: 'violet', icon: 'brain',
        title: 'Waktunya catat nyeri harian', body: 'Data ini dipakai terapis untuk menyesuaikan program Anda.',
        at: iso(U.addDays(today, -1), 21, 0), read: false, link: 'catatan-nyeri.html' },
      { id: 'n_3', userId: 'u_pat_1', type: 'capaian', tone: 'success', icon: 'award',
        title: 'Streak 6 hari!', body: 'Kualitas gerak naik 8% dibanding minggu lalu.',
        at: iso(U.addDays(today, -1), 20, 12), read: true, link: 'progres.html' },
      { id: 'n_4', userId: 'u_pat_1', type: 'alat', tone: 'warning', icon: 'battery',
        title: 'Baterai lengan 24%', body: 'Segera cas sebelum sesi latihan berikutnya.',
        at: iso(U.addDays(today, -2), 18, 30), read: true, link: 'perangkat.html' },
      { id: 'n_5', userId: 'u_pat_1', type: 'jadwal', tone: 'primary', icon: 'video',
        title: 'Telekonsultasi besok 10:00', body: 'Evaluasi Fase 3 dengan Anisa Rahmawati, S.Ft.',
        at: iso(today, 9, 0), read: false, link: 'jadwal.html' },

      { id: 'n_6', userId: 'u_ter_1', type: 'eskalasi', tone: 'danger', icon: 'alert',
        title: 'Ahmad Fauzan: 5 hari tanpa latihan', body: 'Skor kepatuhan turun ke 42%. Risiko putus terapi.',
        at: iso(today, 8, 5), read: false, link: 'terapis-pasien.html?id=u_pat_5' },
      { id: 'n_7', userId: 'u_ter_1', type: 'nyeri', tone: 'warning', icon: 'brain',
        title: 'Bagas Prasetyo: nyeri phantom 8/10', body: 'Naik 2 poin dari rata-rata mingguan. Tidur terganggu.',
        at: iso(U.addDays(today, -1), 22, 10), read: false, link: 'terapis-pasien.html?id=u_pat_3' },
      { id: 'n_8', userId: 'u_ter_1', type: 'capaian', tone: 'success', icon: 'checkCircle',
        title: 'Sri Wahyuni menyelesaikan Fase 4', body: 'Box & Block Test naik dari 14 ke 22 blok.',
        at: iso(U.addDays(today, -2), 15, 40), read: true, link: 'terapis-pasien.html?id=u_pat_2' },

      { id: 'n_9', userId: 'u_pro_1', type: 'alat', tone: 'warning', icon: 'thermometer',
        title: 'ASTA-ARM-0118: kelembapan socket 68%', body: 'Sri Wahyuni. Pertimbangkan liner berventilasi.',
        at: iso(today, 7, 20), read: false, link: 'prostetis-dashboard.html' },
      { id: 'n_10', userId: 'u_pro_1', type: 'alat', tone: 'danger', icon: 'cpu',
        title: 'ASTA-ARM-0203: kualitas EMG 52%', body: 'Bagas Prasetyo. Elektroda kemungkinan bergeser.',
        at: iso(U.addDays(today, -1), 13, 15), read: false, link: 'prostetis-dashboard.html' }
    ];
    Store.set('notifications', notifs);

    /* ---------- Capaian / badge ---------- */
    Store.set('achievements', [
      { id: 'ach_streak7', patientId: 'u_pat_1', code: 'streak_7', label: 'Konsisten 7 Hari', icon: 'fire', at: iso(U.addDays(today, -9), 20, 0) },
      { id: 'ach_pain3', patientId: 'u_pat_1', code: 'pain_down_3', label: 'Nyeri Turun 3 Poin', icon: 'brain', at: iso(U.addDays(today, -16), 21, 0) },
      { id: 'ach_grip1k', patientId: 'u_pat_1', code: 'grip_1000', label: '1.000 Cengkeraman', icon: 'hand', at: iso(U.addDays(today, -22), 17, 30) },
      { id: 'ach_adl', patientId: 'u_pat_1', code: 'adl_first', label: 'ADL Pertama Berhasil', icon: 'award', at: iso(U.addDays(today, -30), 11, 0) },
      { id: 'ach_streak30', patientId: 'u_pat_2', code: 'streak_30', label: 'Konsisten 30 Hari', icon: 'fire', at: iso(U.addDays(today, -5), 19, 0) }
    ]);

    /* ---------- Skor GMI (laterality) ---------- */
    var gmi = [];
    patients.forEach(function (p) {
      for (var d = 60; d >= 0; d -= 3) {
        if (!chance(0.6)) continue;
        var prog = (60 - d) / 60;
        gmi.push({
          id: 'gmi_' + p.id + '_' + d,
          patientId: p.id,
          date: U.dayKey(U.addDays(today, -d)),
          accuracy: Math.round(U.clamp(U.lerp(62, 93, prog) + r(-8, 7), 40, 100)),
          avgMs: Math.round(U.clamp(U.lerp(2450, 1180, prog) + r(-180, 220), 700, 3200)),
          total: 30
        });
      }
    });
    Store.set('gmiScores', gmi);

    /* ---------- Asesmen standar ---------- */
    Store.set('assessments', [
      { id: 'as_1', patientId: 'u_pat_1', instrument: 'QuickDASH', score: 38, max: 100, lowerBetter: true,
        date: U.dayKey(U.addDays(today, -60)), by: 'u_ter_1' },
      { id: 'as_2', patientId: 'u_pat_1', instrument: 'QuickDASH', score: 24, max: 100, lowerBetter: true,
        date: U.dayKey(U.addDays(today, -14)), by: 'u_ter_1' },
      { id: 'as_3', patientId: 'u_pat_1', instrument: 'Box & Block Test', score: 19, max: 40, lowerBetter: false,
        date: U.dayKey(U.addDays(today, -14)), by: 'u_ter_1' },
      { id: 'as_4', patientId: 'u_pat_1', instrument: 'TAPES (Penyesuaian)', score: 71, max: 100, lowerBetter: false,
        date: U.dayKey(U.addDays(today, -14)), by: 'u_ter_1' },
      { id: 'as_5', patientId: 'u_pat_2', instrument: 'Box & Block Test', score: 22, max: 40, lowerBetter: false,
        date: U.dayKey(U.addDays(today, -7)), by: 'u_ter_1' },
      { id: 'as_6', patientId: 'u_pat_3', instrument: 'QuickDASH', score: 66, max: 100, lowerBetter: true,
        date: U.dayKey(U.addDays(today, -20)), by: 'u_ter_1' }
    ]);

    /* ---------- Inventaris perangkat ---------- */
    Store.set('devices', [
      { id: 'dev_1', serial: 'ASTA-ARM-0142', patientId: 'u_pat_1', model: 'ASTA Arm v2 Transradial',
        firmware: '2.4.1', fittedAt: '2025-11-20', lastService: U.dayKey(U.addDays(today, -46)),
        nextService: U.dayKey(U.addDays(today, 44)), status: 'baik', actuatorCycles: 184200, batteryHealth: 92 },
      { id: 'dev_2', serial: 'ASTA-ARM-0118', patientId: 'u_pat_2', model: 'ASTA Arm v2 Transradial',
        firmware: '2.4.1', fittedAt: '2025-09-08', lastService: U.dayKey(U.addDays(today, -30)),
        nextService: U.dayKey(U.addDays(today, 4)), status: 'perlu-servis', actuatorCycles: 268400, batteryHealth: 84 },
      { id: 'dev_3', serial: 'ASTA-ARM-0203', patientId: 'u_pat_3', model: 'ASTA Arm v2 Transhumeral',
        firmware: '2.3.8', fittedAt: '2026-04-02', lastService: U.dayKey(U.addDays(today, -18)),
        nextService: U.dayKey(U.addDays(today, 72)), status: 'perhatian', actuatorCycles: 46100, batteryHealth: 97 },
      { id: 'dev_4', serial: 'ASTA-ARM-0166', patientId: 'u_pat_4', model: 'ASTA Arm v2 Transradial',
        firmware: '2.4.1', fittedAt: '2026-01-15', lastService: U.dayKey(U.addDays(today, -25)),
        nextService: U.dayKey(U.addDays(today, 65)), status: 'baik', actuatorCycles: 88700, batteryHealth: 95 },
      { id: 'dev_5', serial: 'ASTA-ARM-0187', patientId: 'u_pat_5', model: 'ASTA Arm v2 Transradial',
        firmware: '2.4.0', fittedAt: '2026-02-27', lastService: U.dayKey(U.addDays(today, -12)),
        nextService: U.dayKey(U.addDays(today, 78)), status: 'baik', actuatorCycles: 52300, batteryHealth: 96 }
    ]);

    /* ---------- Pesan (chat asinkron) ---------- */
    Store.set('messages', [
      { id: 'msg_1', threadId: 'u_pat_1|u_ter_1', fromId: 'u_ter_1', toId: 'u_pat_1',
        body: 'Pak Rizky, grafik nyeri Anda turun konsisten 3 minggu terakhir. Lanjutkan terapi cermin ya.',
        at: iso(U.addDays(today, -2), 9, 12), read: true },
      { id: 'msg_2', threadId: 'u_pat_1|u_ter_1', fromId: 'u_pat_1', toId: 'u_ter_1',
        body: 'Baik Bu. Tapi kemarin sinyal EMG sempat tidak terbaca saat berkeringat.',
        at: iso(U.addDays(today, -2), 10, 3), read: true },
      { id: 'msg_3', threadId: 'u_pat_1|u_ter_1', fromId: 'u_ter_1', toId: 'u_pat_1',
        body: 'Coba re-kalibrasi sebelum latihan. Saya juga sudah info ke Pak Budi untuk cek elektroda.',
        at: iso(U.addDays(today, -1), 8, 40), read: false }
    ]);

    /* ---------- Kejadian tidak diinginkan (adverse events) ---------- */
    Store.set('adverseEvents', [
      { id: 'ae_1', patientId: 'u_pat_4', type: 'iritasi_kulit', severity: 'sedang',
        date: U.dayKey(U.addDays(today, -5)), at: iso(U.addDays(today, -5), 19, 20),
        body: 'Kemerahan pada sisi dalam tunggul setelah pakai 6 jam. Riwayat diabetes, perlu perhatian khusus.',
        relatedTo: 'socket', stoppedTherapy: true, soughtCare: false,
        status: 'ditinjau', reviewedBy: 'u_ter_1',
        reviewNote: 'Batasi pemakaian 4 jam/hari sampai kulit pulih. Rujuk ke prostetis untuk cek fit socket.',
        reviewedAt: iso(U.addDays(today, -4), 9, 10), phase: 'B1' },
      { id: 'ae_2', patientId: 'u_pat_3', type: 'nyeri_meningkat', severity: 'sedang',
        date: U.dayKey(U.addDays(today, -8)), at: iso(U.addDays(today, -8), 21, 40),
        body: 'Nyeri phantom naik dari 7 ke 9 setelah sesi latihan motorik 25 menit.',
        relatedTo: 'latihan', stoppedTherapy: false, soughtCare: false,
        status: 'ditinjau', reviewedBy: 'u_ter_1',
        reviewNote: 'Kurangi beban motorik, prioritaskan GMI dan relaksasi dulu.',
        reviewedAt: iso(U.addDays(today, -7), 8, 30), phase: 'A1' },
      { id: 'ae_3', patientId: 'u_pat_1', type: 'elektroda_lepas', severity: 'ringan',
        date: U.dayKey(U.addDays(today, -11)), at: iso(U.addDays(today, -11), 15, 5),
        body: 'Sinyal kanal fleksor hilang saat berkeringat, lengan tidak merespons sekitar 2 menit.',
        relatedTo: 'alat', stoppedTherapy: false, soughtCare: false,
        status: 'selesai', reviewedBy: 'u_pro_1',
        reviewNote: 'Elektroda dibersihkan dan gel diganti. Disarankan re-kalibrasi mingguan.',
        reviewedAt: iso(U.addDays(today, -10), 11, 0), phase: 'A2' },
      { id: 'ae_4', patientId: 'u_pat_2', type: 'haptik_tidak_nyaman', severity: 'ringan',
        date: U.dayKey(U.addDays(today, -18)), at: iso(U.addDays(today, -18), 20, 15),
        body: 'Getaran haptik terasa terlalu kuat pada intensitas di atas 70%.',
        relatedTo: 'haptik', stoppedTherapy: false, soughtCare: false,
        status: 'selesai', reviewedBy: 'u_pro_1',
        reviewNote: 'Intensitas diturunkan ke 55% dan mode diubah ke proporsional.',
        reviewedAt: iso(U.addDays(today, -17), 10, 20), phase: 'A2' },
      { id: 'ae_5', patientId: 'u_pat_5', type: 'socket_sore', severity: 'ringan',
        date: U.dayKey(U.addDays(today, -3)), at: iso(U.addDays(today, -3), 17, 45),
        body: 'Nyeri tekan di ujung tunggul saat memakai lebih dari 3 jam.',
        relatedTo: 'socket', stoppedTherapy: false, soughtCare: false,
        status: 'baru', reviewedBy: null, reviewNote: '', phase: 'B1' }
    ]);

    /* ---------- Informed consent ---------- */
    Store.set('consents', patients.map(function (p, i) {
      var allIds = ['tujuan', 'data_alat', 'data_nyeri', 'fase', 'akses', 'publikasi', 'kontak'];
      // Pasien terakhir tidak mengizinkan publikasi & kontak (realistis)
      var agreed = i === 4 ? allIds.slice(0, 5) : allIds;
      return {
        id: 'cs_' + p.id,
        patientId: p.id,
        version: '1.2',
        agreed: agreed,
        signature: p.name,
        at: iso(U.addDays(today, -(70 - i * 8)), 10, 0),
        withdrawn: false
      };
    }));

    /* ---------- Skrining PHQ-9 ---------- */
    var screenings = [];
    var phqProfiles = {
      u_pat_1: [14, 11, 8, 6],     // membaik seiring nyeri turun
      u_pat_2: [10, 7, 4, 3],
      u_pat_3: [17, 19],           // nyeri tinggi, distres tinggi
      u_pat_4: [12, 10, 9],
      u_pat_5: [13, 16]            // memburuk, sejalan kepatuhan turun
    };
    patients.forEach(function (p) {
      var arr = phqProfiles[p.id] || [8];
      arr.forEach(function (score, i) {
        var offset = (arr.length - i) * 22 - 6;
        // Bagi skor total ke 9 butir secara wajar
        var answers = distribute(score, 9, 3, rand);
        screenings.push({
          id: 'scr_' + p.id + '_' + i,
          patientId: p.id,
          instrument: 'PHQ-9',
          date: U.dayKey(U.addDays(today, -offset)),
          at: iso(U.addDays(today, -offset), 20, 30),
          answers: answers,
          score: U.sum(answers),
          max: 27,
          level: Study.phq9Interpret(U.sum(answers)).level,
          flagSelfHarm: answers[8] >= 1
        });
      });
    });
    Store.set('screenings', screenings);

    /* ---------- Log akses data ---------- */
    var accessLog = [];
    [['u_ter_1', 'u_pat_1', 'lihat-data', 2], ['u_ter_1', 'u_pat_3', 'lihat-data', 1],
    ['u_ter_1', 'u_pat_5', 'lihat-kepatuhan', 1], ['u_pro_1', 'u_pat_2', 'lihat-telemetri', 3],
    ['u_ter_2', 'u_pat_4', 'lihat-data', 4], ['u_ter_1', 'u_pat_1', 'ubah-resep', 14],
    ['u_pro_1', 'u_pat_3', 'kalibrasi', 6], ['u_ter_1', 'u_pat_2', 'lihat-nyeri', 5]
    ].forEach(function (a, i) {
      accessLog.push({
        id: 'al_' + i, actorId: a[0], patientId: a[1], action: a[2],
        at: iso(U.addDays(today, -a[3]), ri(8, 17), ri(0, 59))
      });
    });
    Store.set('accessLog', accessLog);

    /* ---------- Preferensi default pasien ---------- */
    Store.set('device:cal', {
      mvc: { ch1: 0.86, ch2: 0.81, ch3: 0.74, ch4: 0.7 },
      baseline: { ch1: 0.045, ch2: 0.042, ch3: 0.052, ch4: 0.05 },
      threshold: { ch1: 0.31, ch2: 0.33, ch3: 0.46, ch4: 0.48 },
      gain: { ch1: 1, ch2: 1, ch3: 1, ch4: 1 },
      calibratedAt: iso(U.addDays(today, -3), 8, 12)
    });

    Store.set('settings', {
      notifPush: true, notifEmail: false, notifSound: true,
      reminderLead: 15, escalateAfterDays: 3,
      language: 'id', contrastHigh: false, textLarge: false,
      dataSaver: false, oneHandMode: true
    });

    Store.set('seed:version', SEED_VERSION);
    Store.set('seed:at', new Date().toISOString());
    return true;

    function iso(dateObj, h, m) {
      var x = U.d(dateObj);
      x.setHours(h || 0, m || 0, 0, 0);
      return x.toISOString();
    }
  };

  /**
   * Bagi skor total ke n butir, masing-masing 0..maxPer.
   * Dipakai untuk merekonstruksi jawaban PHQ-9 dari skor total
   * agar data demo tetap konsisten secara internal.
   */
  function distribute(total, n, maxPer, rand) {
    var out = new Array(n).fill(0);
    var left = U.clamp(total, 0, n * maxPer);
    var guard = 0;
    while (left > 0 && guard < 500) {
      guard++;
      var i = Math.floor((rand ? rand() : Math.random()) * n);
      if (out[i] < maxPer) { out[i]++; left--; }
    }
    return out;
  }

  Seed.reset = function () {
    Store.clearAll();
    Seed.run(true);
  };

  global.Seed = Seed;
})(window);
