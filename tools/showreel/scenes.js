/* ============================================================
   ASTA — Daftar adegan showreel
   ------------------------------------------------------------
   Dipakai bersama oleh varian desktop dan Android, sehingga
   kedua video menampilkan halaman yang sama dengan urutan dan
   penamaan yang sama.

   sec     lama adegan dalam detik
   scroll  'full'  gulir dari atas sampai bawah halaman
           'none'  diam (halaman pendek / form)
           0..1    gulir sampai sebagian tinggi halaman
   hold    detik jeda di puncak sebelum mulai bergulir
   ============================================================ */

const ROLE = {
  pasien:    { uid: 'u_pat_1', role: 'pasien',    name: 'Rizky Nugraha' },
  terapis:   { uid: 'u_ter_1', role: 'terapis',   name: 'Anisa Rahmawati' },
  prostetis: { uid: 'u_pro_1', role: 'prostetis', name: 'Budi Santoso' },
  admin:     { uid: 'u_adm_1', role: 'admin',     name: 'Admin Klinik' },
};

const SCENES = [
  { id: '01', f: 'index.html', role: null,
    title: 'Beranda', sub: 'Profil produk, teknologi, dan ajakan mencoba demo',
    sec: 10, scroll: 'full', hold: 1.4 },

  { id: '02', f: 'masuk.html', role: null,
    title: 'Masuk', sub: 'Empat peran: pasien, fisioterapis, prostetis, admin klinik',
    sec: 4, scroll: 'none', hold: 0 },

  { id: '03', f: 'pasien-dashboard.html', role: 'pasien',
    title: 'Dasbor Pasien', sub: 'Fokus hari ini, kepatuhan 14 hari, dan status lengan',
    sec: 6.5, scroll: 'full', hold: 1.2 },

  { id: '04', f: 'sesi-latihan.html', role: 'pasien',
    title: 'Sesi Latihan', sub: 'Panduan repetisi dengan umpan balik sinyal otot langsung',
    sec: 6, scroll: 'full', hold: 1.2 },

  { id: '05', f: 'catatan-nyeri.html', role: 'pasien',
    title: 'Catatan Nyeri Phantom', sub: 'Skala harian, peta lokasi, dan pemicu yang terlacak',
    sec: 6.5, scroll: 'full', hold: 1 },

  { id: '06', f: 'terapi-phantom.html', role: 'pasien',
    title: 'Terapi Cermin & GMI', sub: 'Graded Motor Imagery bertahap, diproses di peramban',
    sec: 6, scroll: 'full', hold: 1.2 },

  { id: '07', f: 'model-3d.html', role: 'pasien',
    title: 'Studio 3D', sub: 'Model Blender yang dapat diputar dan diubah posenya',
    sec: 8, scroll: 0.55, hold: 3.2 },

  { id: '08', f: 'perangkat.html', role: 'pasien',
    title: 'Perangkat & EMG', sub: 'Telemetri empat kanal sinyal otot secara langsung',
    sec: 6, scroll: 'full', hold: 1.4 },

  { id: '09', f: 'kalibrasi.html', role: 'pasien',
    title: 'Kalibrasi', sub: 'Wizard tiga langkah menyetel ambang sesuai kondisi hari itu',
    sec: 5.5, scroll: 'full', hold: 1.2 },

  { id: '10', f: 'progres.html', role: 'pasien',
    title: 'Progres & Analisis', sub: 'Tren nyeri, jam pakai, dan perbandingan fase A-B-A',
    sec: 6.5, scroll: 'full', hold: 1 },

  { id: '11', f: 'jadwal.html', role: 'pasien',
    title: 'Jadwal & Pengingat', sub: 'Agenda latihan dan telekonsultasi dengan pengingat berjenjang',
    sec: 5.5, scroll: 'full', hold: 1 },

  { id: '12', f: 'terapis-dashboard.html', role: 'terapis',
    title: 'Dasbor Klinis', sub: 'Triase pasien menurut risiko dan kepatuhan',
    sec: 6.5, scroll: 'full', hold: 1.2 },

  { id: '13', f: 'terapis-pasien.html', role: 'terapis',
    title: 'Detail Pasien', sub: 'Riwayat sesi, nyeri, dan catatan klinis dalam satu tempat',
    sec: 6, scroll: 'full', hold: 1 },

  { id: '14', f: 'prostetis-dashboard.html', role: 'prostetis',
    title: 'Dasbor Teknis', sub: 'Kesehatan alat, siklus aktuator, dan jadwal servis',
    sec: 5.5, scroll: 'full', hold: 1 },

  { id: '15', f: 'admin-dashboard.html', role: 'admin',
    title: 'Dasbor Admin', sub: 'Pengguna, perangkat, dan jejak akses data',
    sec: 5, scroll: 'full', hold: 1 },
];

module.exports = { SCENES, ROLE };
