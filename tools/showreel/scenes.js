/* ============================================================
   ASTA — Daftar adegan showreel
   ------------------------------------------------------------
   Dipakai bersama oleh varian desktop dan Android, sehingga
   kedua video menampilkan halaman yang sama dengan urutan dan
   penamaan yang sama.

   Susunannya mengikuti alur presentasi profil perusahaan:
   masalah -> produk -> cara kerja -> pemakaian per peran ->
   spesifikasi -> ajakan mencoba. Kartu penjelas (CARDS)
   disisipkan di antara adegan halaman lewat SEQUENCE.

   Bidang adegan:
     sec     lama adegan dalam detik
     scroll  'full'  gulir dari atas sampai bawah halaman
             'none'  diam (halaman pendek / form)
             0..1    gulir sampai sebagian tinggi halaman
     hold    detik jeda di puncak sebelum mulai bergulir
     points  tiga butir penjelas; muncul bergiliran, dihitung
             per frame supaya tetap terkunci laju video

   Isi butir penjelas hanya menyebut hal yang benar-benar ada
   di aplikasi atau di konfigurasi alat (js/core/device.js).
   ============================================================ */

const ROLE = {
  pasien:    { uid: 'u_pat_1', role: 'pasien',    name: 'Rizky Nugraha' },
  terapis:   { uid: 'u_ter_1', role: 'terapis',   name: 'Anisa Rahmawati' },
  prostetis: { uid: 'u_pro_1', role: 'prostetis', name: 'Budi Santoso' },
  admin:     { uid: 'u_adm_1', role: 'admin',     name: 'Admin Klinik' },
};

/* Label peran yang tampil sebagai badge di atas judul adegan. */
const ROLE_LABEL = {
  null:      'Halaman publik',
  pasien:    'Untuk pasien',
  terapis:   'Untuk fisioterapis',
  prostetis: 'Untuk prostetis',
  admin:     'Untuk admin klinik',
};

const SCENES = [
  { id: '01', f: 'index.html', role: null,
    title: 'Beranda', sub: 'Profil produk: masalah, solusi, teknologi, dan spesifikasi',
    points: [
      'Masalah, solusi, dan cara kerja dalam satu halaman',
      'Model 3D lengan dapat diputar langsung di hero',
      'Spesifikasi terbuka, tanpa klaim hasil klinis',
    ],
    sec: 13, scroll: 'full', hold: 1.6 },

  { id: '02', f: 'masuk.html', role: null,
    title: 'Masuk', sub: 'Satu aplikasi, empat peran dengan hak akses berbeda',
    points: [
      'Pasien, fisioterapis, prostetis, admin klinik',
      'Navigasi dan data menyesuaikan peran yang masuk',
      'Akun demo tersedia untuk mencoba seluruh alur',
    ],
    sec: 6.5, scroll: 'none', hold: 0 },

  { id: '03', f: 'pasien-dashboard.html', role: 'pasien',
    title: 'Dasbor Pasien', sub: 'Satu layar untuk menjawab: hari ini saya harus apa?',
    points: [
      'Satu fokus utama, bukan daftar tugas yang panjang',
      'Kepatuhan 14 hari terakhir dalam satu grafik',
      'Status lengan: baterai, kualitas sinyal, suhu soket',
    ],
    sec: 9, scroll: 'full', hold: 1.4 },

  { id: '04', f: 'sesi-latihan.html', role: 'pasien',
    title: 'Sesi Latihan', sub: 'Repetisi terpandu dengan umpan balik sinyal otot langsung',
    points: [
      'Latihan mengikuti resep yang disusun fisioterapis',
      'Sinyal sEMG terlihat saat gerakan sedang dilakukan',
      'Hasil sesi tercatat otomatis untuk tim klinis',
    ],
    sec: 8.5, scroll: 'full', hold: 1.4 },

  { id: '05', f: 'catatan-nyeri.html', role: 'pasien',
    title: 'Catatan Nyeri Phantom', sub: 'Nyeri yang tercatat rutin jauh lebih mudah ditangani',
    points: [
      'Skala harian 0–10 beserta jenis dan durasinya',
      'Peta lokasi nyeri pada anggota tubuh yang telah tiada',
      'Pemicu dan pereda terlacak dari waktu ke waktu',
    ],
    sec: 9, scroll: 'full', hold: 1.2 },

  { id: '06', f: 'terapi-phantom.html', role: 'pasien',
    title: 'Terapi Cermin & GMI', sub: 'Tiga pendekatan klinis untuk nyeri phantom, dibawa ke rumah',
    points: [
      'Graded Motor Imagery bertahap, dari citra ke gerak',
      'Terapi cermin digital memakai kamera perangkat',
      'Video diproses di peramban, tidak diunggah ke mana pun',
    ],
    sec: 8.5, scroll: 'full', hold: 1.4 },

  { id: '07', f: 'model-3d.html', role: 'pasien',
    title: 'Studio 3D', sub: 'Model lengan yang bergerak mengikuti sinyal otot',
    points: [
      'Geometri dibangkitkan skrip Python di Blender',
      '14 ruas jari berartikulasi, pose terinterpolasi halus',
      'Turun mutu otomatis ke sprite atau SVG bila perlu',
    ],
    sec: 10, scroll: 0.55, hold: 3.4 },

  { id: '08', f: 'perangkat.html', role: 'pasien',
    title: 'Perangkat & EMG', sub: 'Telemetri empat kanal sinyal otot secara langsung',
    points: [
      'Fleksor, ekstensor, bisep, dan trisep terbaca terpisah',
      'Delapan pola cengkeram, dari power grip sampai pinch',
      'Bluetooth Low Energy; simulator dipakai bila alat tak ada',
    ],
    sec: 8.5, scroll: 'full', hold: 1.6 },

  { id: '09', f: 'kalibrasi.html', role: 'pasien',
    title: 'Kalibrasi', sub: 'Otot berubah setiap hari, ambangnya ikut disetel ulang',
    points: [
      'Wizard tiga langkah: baseline, kontraksi maksimum, ambang',
      'Normalisasi terhadap MVC agar gerak tetap proporsional',
      'Profil tersimpan per pengguna dan dapat diulang kapan saja',
    ],
    sec: 8, scroll: 'full', hold: 1.4 },

  { id: '10', f: 'progres.html', role: 'pasien',
    title: 'Progres & Analisis', sub: 'Bukti bahwa latihan berjalan, bukan sekadar perasaan',
    points: [
      'Tren nyeri dan jam pakai alat dari waktu ke waktu',
      'Kepatuhan dihitung dari sesi yang benar-benar selesai',
      'Perbandingan fase A-B-A untuk keperluan penelitian',
    ],
    sec: 9, scroll: 'full', hold: 1.2 },

  { id: '11', f: 'jadwal.html', role: 'pasien',
    title: 'Jadwal & Pengingat', sub: 'Kepatuhan jangka panjang jatuh karena lupa, bukan karena malas',
    points: [
      'Agenda latihan harian dan jadwal telekonsultasi',
      'Pengingat berjenjang bila sesi mulai terlewat',
      'Terhubung langsung dengan resep dari terapis',
    ],
    sec: 8, scroll: 'full', hold: 1.2 },

  { id: '12', f: 'terapis-dashboard.html', role: 'terapis',
    title: 'Dasbor Klinis', sub: 'Seluruh pasien binaan tertriase dalam satu layar',
    points: [
      'Urutan berdasarkan risiko dan kepatuhan, bukan abjad',
      'Penurunan pemakaian terlihat sebelum kontrol berikutnya',
      'Resep latihan dapat disesuaikan dari jarak jauh',
    ],
    sec: 9, scroll: 'full', hold: 1.4 },

  { id: '13', f: 'terapis-pasien.html', role: 'terapis',
    title: 'Detail Pasien', sub: 'Riwayat sesi, nyeri, dan catatan klinis dalam satu tempat',
    points: [
      'Garis waktu sesi latihan beserta capaian repetisinya',
      'Tren nyeri disandingkan dengan jam pakai alat',
      'Catatan klinis dan kejadian penelitian bertanggal',
    ],
    sec: 8.5, scroll: 'full', hold: 1.2 },

  { id: '14', f: 'prostetis-dashboard.html', role: 'prostetis',
    title: 'Dasbor Teknis', sub: 'Sisi perawatan alat: yang membuat lengan tetap terpakai',
    points: [
      'Kesehatan alat, siklus aktuator, dan kualitas sinyal',
      'Jadwal servis serta penggantian komponen cetak 3D',
      'Bagian rusak dicetak ulang, bukan alatnya diganti',
    ],
    sec: 8, scroll: 'full', hold: 1.2 },

  { id: '15', f: 'admin-dashboard.html', role: 'admin',
    title: 'Dasbor Admin', sub: 'Tata kelola pengguna, perangkat, dan akses data',
    points: [
      'Manajemen akun klinik beserta perannya',
      'Pendaftaran perangkat dan status pemakaiannya',
      'Jejak akses data pasien tercatat dan dapat ditinjau',
    ],
    sec: 7.5, scroll: 'full', hold: 1.2 },
];

/* ------------------------------------------------------------
   Kartu penjelas. Isinya digambar stage.html (lihat objek CARDS
   di sana); di sini hanya lama tayangnya, karena kartu berupa
   satu frame diam yang ditahan oleh perakit.
   ------------------------------------------------------------ */
const CARDS = {
  intro:   { sec: 3.6 },
  masalah: { sec: 9.5 },
  produk:  { sec: 4.6 },
  alur:    { sec: 10 },
  pasien:  { sec: 4.6 },
  klinis:  { sec: 4.6 },
  spek:    { sec: 10 },
  teknis:  { sec: 9 },
  outro:   { sec: 4.4 },
};

/* Urutan tayang. 'c' = kartu, 's' = adegan halaman. */
const SEQUENCE = [
  { type: 'c', id: 'intro' },
  { type: 'c', id: 'masalah' },
  { type: 'c', id: 'produk' },
  { type: 's', id: '01' },
  { type: 's', id: '02' },
  { type: 'c', id: 'alur' },
  { type: 'c', id: 'pasien' },
  { type: 's', id: '03' },
  { type: 's', id: '04' },
  { type: 's', id: '05' },
  { type: 's', id: '06' },
  { type: 's', id: '07' },
  { type: 's', id: '08' },
  { type: 's', id: '09' },
  { type: 's', id: '10' },
  { type: 's', id: '11' },
  { type: 'c', id: 'klinis' },
  { type: 's', id: '12' },
  { type: 's', id: '13' },
  { type: 's', id: '14' },
  { type: 's', id: '15' },
  { type: 'c', id: 'spek' },
  { type: 'c', id: 'teknis' },
  { type: 'c', id: 'outro' },
];

module.exports = { SCENES, ROLE, ROLE_LABEL, CARDS, SEQUENCE };
