/* ============================================================
   ASTA — Pembuat screenshot portrait
   ------------------------------------------------------------
   Memuat setiap halaman pada viewport portrait, menyiapkan
   keadaan yang representatif (simulator EMG tersambung, tab
   tertentu terbuka), lalu menyimpan tangkapan layar penuh.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'screenshots');
const BASE = 'file:///' + ROOT.replace(/\\/g, '/');

// Portrait 1080x1920 pada DPR 2 menghasilkan berkas tajam
const VIEW = { width: 1080, height: 1920 };
const DPR = 2;

const ROLE_USER = {
  pasien: { id: 'u_pat_1', name: 'Rizky Nugraha' },
  terapis: { id: 'u_ter_1', name: 'Anisa Rahmawati' },
  prostetis: { id: 'u_pro_1', name: 'Budi Santoso' },
  admin: { id: 'u_adm_1', name: 'Maya Kusuma' },
};

/**
 * prep: dijalankan di dalam halaman setelah load, untuk
 * menyiapkan keadaan visual (mis. sambungkan simulator).
 */
const PAGES = [
  { n: '01', file: 'index.html', role: null, title: 'Halaman Masuk' },

  { n: '02', file: 'pasien-dashboard.html', role: 'pasien', title: 'Dasbor Pasien',
    prep: async (p) => { await connectSim(p); } },

  { n: '03', file: 'sesi-latihan.html', role: 'pasien', title: 'Sesi Latihan — Persiapan',
    prep: async (p) => { await connectSim(p); } },

  { n: '04', file: 'sesi-latihan.html', role: 'pasien', title: 'Sesi Latihan — Berjalan',
    prep: async (p) => {
      await connectSim(p);
      await p.waitForTimeout(400);
      const btn = await p.$('#btn-start');
      if (btn) { await btn.click(); await p.waitForTimeout(2600); }
      // Picu beberapa kontraksi agar grafik EMG berisi
      await p.evaluate(async () => {
        for (let i = 0; i < 4; i++) {
          Device.simulateContraction('ch1', 0.92, 800);
          await new Promise(r => setTimeout(r, 520));
        }
      });
      await p.waitForTimeout(1200);
    } },

  { n: '05', file: 'catatan-nyeri.html', role: 'pasien', title: 'Catatan Nyeri Phantom',
    prep: async (p) => {
      // Pilih skor & zona supaya form terlihat terisi
      const b = await p.$('.pain-btn[data-lvl="5"]');
      if (b) await b.click();
      for (const z of ['ph_palm', 'ph_fingers']) {
        const el = await p.$(`[data-zone="${z}"]`);
        if (el) await el.click();
      }
      const t = await p.$('[data-type="kesetrum"]');
      if (t) await t.click();
      await p.waitForTimeout(500);
    } },

  { n: '06', file: 'terapi-phantom.html', role: 'pasien', title: 'Terapi Cermin & GMI',
    prep: async (p) => {
      // Mode animasi agar tidak butuh izin kamera
      const seg = await p.$('#seg-mirror button[data-value="anim"]');
      if (seg) { await seg.click(); await p.waitForTimeout(600); }
      const start = await p.$('#m-start');
      if (start) { await start.click(); await p.waitForTimeout(700); }
      // Lewati dialog nyeri bila muncul
      const lvl = await p.$('#ask-scale .pain-btn[data-lvl="6"]');
      if (lvl) {
        await lvl.click();
        const ok = await p.$('.modal .btn-primary');
        if (ok) await ok.click();
        await p.waitForTimeout(1600);
      }
    } },

  { n: '07', file: 'terapi-phantom.html', role: 'pasien', title: 'GMI — Pengenalan Sisi',
    prep: async (p) => {
      const tab = await p.$('.tab[data-tab="lat"]');
      if (tab) { await tab.click(); await p.waitForTimeout(600); }
      const start = await p.$('#lat-start');
      if (start) { await start.click(); await p.waitForTimeout(900); }
    } },

  { n: '08', file: 'progres.html', role: 'pasien', title: 'Progres & Analisis Fase A-B-A' },

  { n: '09', file: 'perangkat.html', role: 'pasien', title: 'Perangkat & Sinyal EMG',
    prep: async (p) => {
      await connectSim(p);
      await p.evaluate(async () => {
        Device.setGrip('power');
        for (let i = 0; i < 5; i++) {
          Device.simulateContraction('ch1', 0.9, 700);
          await new Promise(r => setTimeout(r, 450));
        }
      });
      await p.waitForTimeout(1400);
    } },

  { n: '10', file: 'kalibrasi.html', role: 'pasien', title: 'Kalibrasi & Tuning',
    prep: async (p) => { await connectSim(p); await p.waitForTimeout(800); } },

  { n: '11', file: 'jadwal.html', role: 'pasien', title: 'Jadwal & Pengingat' },
  { n: '12', file: 'notifikasi.html', role: 'pasien', title: 'Notifikasi' },

  { n: '13', file: 'pengaturan.html', role: 'pasien', title: 'Persetujuan & Privasi',
    prep: async (p) => {
      const tab = await p.$('.tab[data-tab="etik"]');
      if (tab) { await tab.click(); await p.waitForTimeout(600); }
    } },

  { n: '14', file: 'terapis-dashboard.html', role: 'terapis', title: 'Dasbor Klinis Terapis' },

  { n: '15', file: 'terapis-pasien.html', role: 'terapis', title: 'Detail Pasien' },

  { n: '16', file: 'terapis-pasien.html', role: 'terapis', title: 'Analisis Fase per Pasien',
    prep: async (p) => {
      const tab = await p.$('.tab[data-tab="fase"]');
      if (tab) { await tab.click(); await p.waitForTimeout(1000); }
    } },

  { n: '17', file: 'terapis-program.html', role: 'terapis', title: 'Resep Program Latihan' },
  { n: '18', file: 'terapis-kepatuhan.html', role: 'terapis', title: 'Pemantauan Kepatuhan' },
  { n: '19', file: 'terapis-nyeri.html', role: 'terapis', title: 'Pemantauan Nyeri Lintas Pasien' },
  { n: '20', file: 'prostetis-dashboard.html', role: 'prostetis', title: 'Dasbor Teknis Prostetis' },
  { n: '21', file: 'admin-dashboard.html', role: 'admin', title: 'Dasbor Admin' },
];

async function connectSim(page) {
  await page.evaluate(async () => {
    if (!Device.state.connected) await Device.connect('mock');
  });
  await page.waitForTimeout(900);
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const manifest = [];

  for (const p of PAGES) {
    const ctx = await browser.newContext({
      viewport: VIEW,
      deviceScaleFactor: DPR,
      reducedMotion: 'reduce',   // hentikan animasi agar tangkapan stabil
      colorScheme: 'light',
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(`   ! ${p.file}: ${e.message}`));

    if (p.role) {
      const u = ROLE_USER[p.role];
      await page.addInitScript(({ uid, name, role }) => {
        localStorage.setItem('asta:v1:session', JSON.stringify({
          userId: uid, role, name, loginAt: new Date().toISOString()
        }));
      }, { uid: u.id, name: u.name, role: p.role });
    }

    try {
      await page.goto(`${BASE}/${p.file}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1500);

      if (p.prep) await p.prep(page);

      // Tutup toast agar tidak menutupi konten
      await page.evaluate(() => {
        const h = document.querySelector('.toast-host');
        if (h) h.remove();
      });
      await page.waitForTimeout(400);

      const slug = p.title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const name = `${p.n}-${slug}.png`;
      const file = path.join(OUT, name);

      await page.screenshot({ path: file, fullPage: true });

      const dim = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight
      }));

      manifest.push({ n: p.n, file: name, title: p.title, page: p.file, role: p.role, h: dim.h });
      console.log(`[ OK ] ${name}  (tinggi halaman ${dim.h}px)`);
    } catch (e) {
      console.log(`[GAGAL] ${p.file} — ${e.message}`);
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n${manifest.length}/${PAGES.length} tangkapan tersimpan di screenshots/`);
})();
