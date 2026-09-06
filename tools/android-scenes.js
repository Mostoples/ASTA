/* ============================================================
   ASTA — Definisi adegan video Android
   ------------------------------------------------------------
   Dipakai bersama oleh perekam frame dan pembangun proyek
   CapCut, agar timeline keduanya selalu konsisten.

   Tiap adegan menerangkan:
     f        berkas halaman
     role     peran yang login
     kicker   penanda bagian
     title    judul besar
     sub      keterangan singkat
     prep     persiapan keadaan sebelum merekam (opsional)
     action   aksi yang direkam: scroll, tap, atau diam
   ============================================================ */

const ROLE = {
  pasien: { id: 'u_pat_1', name: 'Rizky Nugraha' },
  terapis: { id: 'u_ter_1', name: 'Anisa Rahmawati' },
  prostetis: { id: 'u_pro_1', name: 'Budi Santoso' },
  admin: { id: 'u_adm_1', name: 'Maya Kusuma' },
};

/** Sambungkan simulator lengan bionik */
async function connectSim(p) {
  await p.evaluate(async () => {
    if (!Device.state.connected) await Device.connect('mock');
  });
  await p.waitForTimeout(900);
}

/** Picu beberapa kontraksi agar grafik EMG hidup */
async function pulse(p, n, ch) {
  await p.evaluate(async ({ n, ch }) => {
    for (let i = 0; i < n; i++) {
      Device.simulateContraction(ch || 'ch1', 0.92, 750);
      await new Promise(r => setTimeout(r, 470));
    }
  }, { n: n || 3, ch: ch });
}

const SCENES = [
  {
    id: '01', f: 'index.html', role: null,
    kicker: 'Pembuka', title: 'ASTA',
    sub: 'Telerehabilitasi lengan bionik non-invasif',
    action: { type: 'hold', seconds: 4 },
  },
  {
    id: '02', f: 'index.html', role: null,
    kicker: 'Masuk', title: 'Empat Peran Pengguna',
    sub: 'Pasien, fisioterapis, prostetis, dan admin klinik',
    action: { type: 'scroll', seconds: 5 },
  },
  {
    id: '03', f: 'pasien-dashboard.html', role: 'pasien',
    kicker: 'Pasien', title: 'Dasbor Harian',
    sub: 'Kepatuhan, jadwal terapi, dan status lengan bionik',
    prep: connectSim,
    action: { type: 'scroll', seconds: 7 },
  },
  {
    id: '04', f: 'pasien-dashboard.html', role: 'pasien',
    kicker: 'Navigasi', title: 'Dirancang untuk Satu Tangan',
    sub: 'Menu utama berada dalam jangkauan ibu jari',
    prep: connectSim,
    action: { type: 'tapTabbar', seconds: 5 },
  },
  {
    id: '05', f: 'perangkat.html', role: 'pasien',
    kicker: 'Hardware', title: 'Sinyal Otot Menggerakkan Lengan',
    sub: 'Empat kanal sEMG diterjemahkan menjadi gerak aktuator',
    prep: async (p) => {
      await connectSim(p);
      // Fokuskan ke area osiloskop dan lengan agar geraknya jelas terlihat
      await p.evaluate(() => {
        const el = document.querySelector('#scope');
        if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 130);
      });
      await p.waitForTimeout(500);
      await pulse(p, 2);
    },
    // Denyut berkelanjutan: tanpa kontraksi, sinyal sEMG nyaris rata
    // sehingga adegan tampak beku meski teknisnya "live".
    action: { type: 'live', seconds: 7, drive: { channel: 'ch1', everyMs: 900, level: 0.95 } },
  },
  {
    id: '06', f: 'perangkat.html', role: 'pasien',
    kicker: 'Hardware', title: 'Pola Cengkeram & Haptik',
    sub: 'Delapan pola cengkeram dengan umpan balik getaran',
    prep: connectSim,
    action: { type: 'scrollTo', target: '#grip-grid', seconds: 6 },
  },
  {
    id: '07', f: 'kalibrasi.html', role: 'pasien',
    kicker: 'Hardware', title: 'Kalibrasi Terpandu',
    sub: 'Ambang tiap kanal dihitung dari kontraksi maksimum',
    prep: connectSim,
    action: { type: 'scroll', seconds: 6 },
  },
  {
    id: '08', f: 'sesi-latihan.html', role: 'pasien',
    kicker: 'Latihan', title: 'Sesi Latihan Terpandu',
    sub: 'Pilih latihan sesuai resep terapis',
    prep: connectSim,
    action: { type: 'scroll', seconds: 5 },
  },
  {
    id: '09', f: 'sesi-latihan.html', role: 'pasien',
    kicker: 'Latihan', title: 'Repetisi Terhitung Otomatis',
    sub: 'Mutu gerak dinilai dari kehalusan dan durasi tahan',
    prep: async (p) => {
      await connectSim(p);
      const b = await p.$('#btn-start');
      if (b) { await b.click(); await p.waitForTimeout(2400); }
      await pulse(p, 2);
    },
    action: { type: 'live', seconds: 8 },
  },
  {
    id: '10', f: 'catatan-nyeri.html', role: 'pasien',
    kicker: 'Phantom Pain', title: 'Catatan Nyeri Harian',
    sub: 'Skala NRS 0 sampai 10 dengan panduan interpretasi',
    prep: async (p) => {
      const b = await p.$('.pain-btn[data-lvl="6"]');
      if (b) await b.click();
      await p.waitForTimeout(500);
    },
    action: { type: 'hold', seconds: 4 },
  },
  {
    id: '11', f: 'catatan-nyeri.html', role: 'pasien',
    kicker: 'Phantom Pain', title: 'Peta Tubuh Interaktif',
    sub: 'Area bergaris putus menandai bagian phantom',
    prep: async (p) => {
      const b = await p.$('.pain-btn[data-lvl="6"]');
      if (b) await b.click();
      for (const z of ['ph_palm', 'ph_fingers', 'ph_wrist']) {
        const el = await p.$(`[data-zone="${z}"]`);
        if (el) await el.click();
      }
      await p.waitForTimeout(400);
    },
    action: { type: 'scrollTo', target: '.bodymap-wrap', seconds: 6 },
  },
  {
    id: '12', f: 'catatan-nyeri.html', role: 'pasien',
    kicker: 'Phantom Pain', title: 'Riwayat & Tren Nyeri',
    sub: 'Blok warna menandai fase penelitian',
    action: { type: 'scrollTo', target: '#ch-trend', seconds: 6 },
  },
  {
    id: '13', f: 'terapi-phantom.html', role: 'pasien',
    kicker: 'Phantom Pain', title: 'Terapi Cermin Digital',
    sub: 'Umpan balik visual pada posisi lengan yang diamputasi',
    prep: async (p) => {
      const s = await p.$('#seg-mirror button[data-value="anim"]');
      if (s) { await s.click(); await p.waitForTimeout(500); }
      const st = await p.$('#m-start');
      if (st) { await st.click(); await p.waitForTimeout(600); }
      const lvl = await p.$('#ask-scale .pain-btn[data-lvl="6"]');
      if (lvl) {
        await lvl.click();
        const ok = await p.$('.modal .btn-primary');
        if (ok) await ok.click();
        await p.waitForTimeout(1500);
      }
    },
    action: { type: 'live', seconds: 7 },
  },
  {
    id: '14', f: 'terapi-phantom.html', role: 'pasien',
    kicker: 'Phantom Pain', title: 'Graded Motor Imagery',
    sub: 'Pengenalan sisi kiri dan kanan melatih peta motorik',
    prep: async (p) => {
      const t = await p.$('.tab[data-tab="lat"]');
      if (t) { await t.click(); await p.waitForTimeout(500); }
      const s = await p.$('#lat-start');
      if (s) { await s.click(); await p.waitForTimeout(900); }
    },
    action: { type: 'hold', seconds: 5 },
  },
  {
    id: '15', f: 'progres.html', role: 'pasien',
    kicker: 'Bukti', title: 'Analisis Fase A-B-A',
    sub: 'Nyeri naik saat haptik dicabut, turun lagi saat dipasang',
    action: { type: 'scrollTo', target: '#ch-phase', seconds: 7 },
  },
  {
    id: '16', f: 'progres.html', role: 'pasien',
    kicker: 'Bukti', title: 'Korelasi Nyeri & Pemakaian',
    sub: 'Setiap titik satu hari, garis putus adalah tren',
    action: { type: 'scrollTo', target: '#ch-scatter', seconds: 6 },
  },
  {
    id: '17', f: 'jadwal.html', role: 'pasien',
    kicker: 'Kepatuhan', title: 'Jadwal & Pengingat',
    sub: 'Eskalasi otomatis ke terapis bila latihan terlewat',
    action: { type: 'scroll', seconds: 7 },
  },
  {
    id: '18', f: 'terapis-dashboard.html', role: 'terapis',
    kicker: 'Klinis', title: 'Dasbor Klinis Terapis',
    sub: 'Triase pasien menurut risiko putus terapi',
    action: { type: 'scroll', seconds: 7 },
  },
  {
    id: '19', f: 'terapis-kepatuhan.html', role: 'terapis',
    kicker: 'Klinis', title: 'Skor Kepatuhan Komposit',
    sub: 'Frekuensi, kelengkapan, dan pemakaian alat dari telemetri',
    action: { type: 'scroll', seconds: 7 },
  },
  {
    id: '20', f: 'terapis-nyeri.html', role: 'terapis',
    kicker: 'Bukti', title: 'Efek Haptik Lintas Pasien',
    sub: 'Perbandingan nyeri antar fase beserta ukuran efek',
    action: { type: 'scroll', seconds: 7 },
  },
  {
    id: '21', f: 'prostetis-dashboard.html', role: 'prostetis',
    kicker: 'Klinis', title: 'Dasbor Teknis Prostetis',
    sub: 'Mutu sinyal, kondisi socket, dan jadwal servis',
    action: { type: 'scroll', seconds: 6 },
  },
  {
    id: '22', f: 'pengaturan.html', role: 'pasien',
    kicker: 'Etik', title: 'Persetujuan & Jejak Audit',
    sub: 'Hak menarik diri dan catatan setiap akses data',
    prep: async (p) => {
      const t = await p.$('.tab[data-tab="etik"]');
      if (t) { await t.click(); await p.waitForTimeout(600); }
    },
    action: { type: 'scroll', seconds: 6 },
  },
  {
    id: '23', f: 'pasien-dashboard.html', role: 'pasien',
    kicker: 'Penutup', title: '18 Halaman, 4 Peran',
    sub: 'asta-id.web.app',
    prep: connectSim,
    action: { type: 'hold', seconds: 5 },
  },
];

module.exports = { SCENES, ROLE, connectSim, pulse };
