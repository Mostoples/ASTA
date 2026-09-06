/* ============================================================
   ASTA — Screenshot dalam mockup Android
   ------------------------------------------------------------
   Dua keluaran per tampilan:
     1. screenshots-mobile/  — tangkapan mentah 360x800 viewport
     2. screenshots-android/ — dibungkus mockup ponsel Android
        lengkap dengan status bar, bezel, dan bilah navigasi.

   Mockup dibuat sebagai HTML/CSS lalu ditangkap, sehingga tidak
   memerlukan aset gambar eksternal.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'screenshots-mobile');
const MOCK = path.join(ROOT, 'screenshots-android');
const BASE = 'file:///' + ROOT.replace(/\\/g, '/');

// Pixel 5: 393x851 @2.75. Dipakai 393x830 agar proporsional dengan bezel.
const VW = 393, VH = 830, DPR = 3;

const ROLE = {
  pasien: { id: 'u_pat_1', name: 'Rizky Nugraha' },
  terapis: { id: 'u_ter_1', name: 'Anisa Rahmawati' },
  prostetis: { id: 'u_pro_1', name: 'Budi Santoso' },
  admin: { id: 'u_adm_1', name: 'Maya Kusuma' },
};

async function connectSim(p) {
  await p.evaluate(async () => { if (!Device.state.connected) await Device.connect('mock'); });
  await p.waitForTimeout(900);
}

const SCENES = [
  { n: '01', f: 'index.html', role: null, t: 'Halaman Masuk' },
  { n: '02', f: 'pasien-dashboard.html', role: 'pasien', t: 'Dasbor Pasien',
    prep: connectSim },
  { n: '03', f: 'sesi-latihan.html', role: 'pasien', t: 'Sesi Latihan',
    prep: connectSim },
  { n: '04', f: 'sesi-latihan.html', role: 'pasien', t: 'Latihan Berjalan',
    prep: async (p) => {
      await connectSim(p);
      const b = await p.$('#btn-start');
      if (b) { await b.click(); await p.waitForTimeout(2400); }
      await p.evaluate(async () => {
        for (let i = 0; i < 3; i++) {
          Device.simulateContraction('ch1', 0.92, 800);
          await new Promise(r => setTimeout(r, 500));
        }
      });
      await p.waitForTimeout(1000);
    } },
  { n: '05', f: 'catatan-nyeri.html', role: 'pasien', t: 'Catatan Nyeri',
    prep: async (p) => {
      const b = await p.$('.pain-btn[data-lvl="5"]');
      if (b) await b.click();
      const z = await p.$('[data-zone="ph_palm"]');
      if (z) await z.click();
      await p.waitForTimeout(400);
    } },
  { n: '06', f: 'catatan-nyeri.html', role: 'pasien', t: 'Peta Tubuh Nyeri',
    scrollTo: '.bodymap-wrap',
    prep: async (p) => {
      for (const z of ['ph_palm', 'ph_fingers', 'ph_wrist']) {
        const el = await p.$(`[data-zone="${z}"]`);
        if (el) await el.click();
      }
      await p.waitForTimeout(400);
    } },
  { n: '07', f: 'terapi-phantom.html', role: 'pasien', t: 'Terapi Cermin',
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
    } },
  { n: '08', f: 'terapi-phantom.html', role: 'pasien', t: 'GMI Pengenalan Sisi',
    prep: async (p) => {
      const tab = await p.$('.tab[data-tab="lat"]');
      if (tab) { await tab.click(); await p.waitForTimeout(500); }
      const st = await p.$('#lat-start');
      if (st) { await st.click(); await p.waitForTimeout(800); }
    } },
  { n: '09', f: 'perangkat.html', role: 'pasien', t: 'Sinyal EMG',
    prep: async (p) => {
      await connectSim(p);
      await p.evaluate(async () => {
        Device.setGrip('power');
        for (let i = 0; i < 4; i++) {
          Device.simulateContraction('ch1', 0.9, 700);
          await new Promise(r => setTimeout(r, 450));
        }
      });
      await p.waitForTimeout(1200);
    } },
  { n: '10', f: 'perangkat.html', role: 'pasien', t: 'Pola Cengkeram',
    scrollTo: '#grip-grid',
    prep: connectSim },
  { n: '11', f: 'kalibrasi.html', role: 'pasien', t: 'Kalibrasi',
    prep: connectSim },
  { n: '12', f: 'progres.html', role: 'pasien', t: 'Progres & Analisis' },
  { n: '13', f: 'progres.html', role: 'pasien', t: 'Analisis Fase A-B-A',
    scrollTo: '#ch-phase' },
  { n: '14', f: 'jadwal.html', role: 'pasien', t: 'Jadwal & Kalender' },
  { n: '15', f: 'notifikasi.html', role: 'pasien', t: 'Notifikasi' },
  { n: '16', f: 'pengaturan.html', role: 'pasien', t: 'Pengaturan' },
  { n: '16b', f: 'pasien-dashboard.html', role: 'pasien', t: 'Menu Navigasi',
    prep: async (p) => {
      const b = await p.$('#btn-menu');
      if (b) { await b.tap(); await p.waitForTimeout(800); }
    } },
  { n: '17', f: 'terapis-dashboard.html', role: 'terapis', t: 'Dasbor Terapis' },
  { n: '18', f: 'terapis-pasien.html', role: 'terapis', t: 'Detail Pasien' },
  { n: '19', f: 'terapis-program.html', role: 'terapis', t: 'Resep Program' },
  { n: '20', f: 'terapis-kepatuhan.html', role: 'terapis', t: 'Kepatuhan' },
  { n: '21', f: 'terapis-nyeri.html', role: 'terapis', t: 'Pemantauan Nyeri' },
  { n: '22', f: 'prostetis-dashboard.html', role: 'prostetis', t: 'Dasbor Prostetis' },
  { n: '23', f: 'admin-dashboard.html', role: 'admin', t: 'Dasbor Admin' },
];

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ---------- Mockup Android sebagai HTML ---------- */
function mockupHtml(imgPath, title) {
  const src = 'file:///' + imgPath.replace(/\\/g, '/');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${VW + 96}px;
    background: linear-gradient(160deg, #eef3fa, #dde6f2);
    padding: 48px;
    font-family: "Segoe UI", Inter, system-ui, sans-serif;
    display: grid; place-items: center;
  }
  /* Rangka ponsel */
  .phone {
    width: ${VW + 26}px;
    border-radius: 42px;
    background: linear-gradient(150deg, #2c3543, #171d27);
    padding: 13px;
    box-shadow:
      0 40px 70px -20px rgba(14,30,58,.5),
      0 0 0 2px #0d1218,
      inset 0 0 0 1px rgba(255,255,255,.14);
    position: relative;
  }
  /* Tombol samping */
  .phone::after {
    content: "";
    position: absolute; right: -3px; top: 148px;
    width: 3px; height: 74px; border-radius: 2px;
    background: #39424f;
  }
  .phone::before {
    content: "";
    position: absolute; left: -3px; top: 132px;
    width: 3px; height: 46px; border-radius: 2px;
    background: #39424f;
  }
  .screen {
    width: 100%;
    border-radius: 31px;
    overflow: hidden;
    background: #e8eef7;
    position: relative;
  }
  /* Status bar Android */
  .statusbar {
    height: 30px;
    background: #e8eef7;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px;
    font-size: 12px; font-weight: 650; color: #16233a;
    position: relative; z-index: 5;
  }
  .statusbar .icons { display: flex; align-items: center; gap: 5px; }
  /* Punch-hole kamera */
  .punch {
    position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
    width: 13px; height: 13px; border-radius: 50%;
    background: #10161f; z-index: 10;
    box-shadow: inset 0 0 0 1.5px #262e39;
  }
  .shot { width: 100%; display: block; background: #e8eef7; }
  /* Bilah navigasi Android (gesture bar) */
  .navbar {
    height: 22px; background: #e8eef7;
    display: grid; place-items: center;
  }
  .navbar i {
    width: 116px; height: 4px; border-radius: 2px;
    background: #9fb2c9; display: block;
  }
  .cap {
    margin-top: 24px; text-align: center;
  }
  .cap .t { font-size: 19px; font-weight: 700; color: #16233a; }
  .cap .d { font-size: 13px; color: #6b7f99; margin-top: 4px; letter-spacing: .04em; }
</style></head><body>
  <div>
    <div class="phone">
      <div class="screen">
        <div class="punch"></div>
        <div class="statusbar">
          <span>09:41</span>
          <span class="icons">
            <svg width="15" height="12" viewBox="0 0 15 12" fill="none">
              <path d="M1 8.5h2v3H1zM4.5 6h2v5.5h-2zM8 3.5h2v8H8zM11.5 1h2v10.5h-2z" fill="#16233a"/>
            </svg>
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <path d="M7 10.5 1 4.2A8.5 8.5 0 0 1 13 4.2z" fill="#16233a" opacity=".9"/>
            </svg>
            <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
              <rect x="1" y="2" width="17" height="8" rx="2.2" stroke="#16233a" stroke-width="1.3"/>
              <rect x="2.6" y="3.6" width="12" height="4.8" rx="1.2" fill="#16233a"/>
              <path d="M19.6 4.6v2.8" stroke="#16233a" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </span>
        </div>
        <img class="shot" src="${src}">
        <div class="navbar"><i></i></div>
      </div>
    </div>
    <div class="cap">
      <div class="t">${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
      <div class="d">ASTA &middot; Android 393 &times; 830</div>
    </div>
  </div>
</body></html>`;
}

(async () => {
  [RAW, MOCK].forEach(d => {
    if (fs.existsSync(d)) fs.rmSync(d, { recursive: true });
    fs.mkdirSync(d, { recursive: true });
  });

  const browser = await chromium.launch();
  const manifest = [];

  for (const s of SCENES) {
    const ctx = await browser.newContext({
      viewport: { width: VW, height: VH },
      deviceScaleFactor: DPR,
      isMobile: true, hasTouch: true,
      reducedMotion: 'reduce',
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(`   ! ${s.f}: ${e.message.slice(0, 70)}`));

    if (s.role) {
      const u = ROLE[s.role];
      await page.addInitScript(({ uid, name, role }) => {
        localStorage.setItem('asta:v1:session', JSON.stringify({
          userId: uid, role, name, loginAt: new Date().toISOString()
        }));
      }, { uid: u.id, name: u.name, role: s.role });
    }

    try {
      await page.goto(`${BASE}/${s.f}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1400);
      if (s.prep) await s.prep(page);
      if (s.scrollTo) {
        await page.evaluate(sel => {
          const el = document.querySelector(sel);
          if (el) el.scrollIntoView({ block: 'center' });
        }, s.scrollTo);
        await page.waitForTimeout(700);
      }
      await page.evaluate(() => {
        const h = document.querySelector('.toast-host');
        if (h) h.remove();
      });
      await page.waitForTimeout(350);

      const name = `${s.n}-${slug(s.t)}.png`;
      const rawFile = path.join(RAW, name);
      // Tangkap viewport saja (bukan fullPage) agar sesuai layar ponsel
      await page.screenshot({ path: rawFile });

      manifest.push({ n: s.n, file: name, title: s.t, page: s.f, role: s.role });
      console.log(`[ OK ] ${name}`);
    } catch (e) {
      console.log(`[GAGAL] ${s.f} — ${e.message.slice(0, 70)}`);
    }
    await ctx.close();
  }

  /* ---------- Bungkus dalam mockup ---------- */
  console.log('\nMembungkus dalam mockup Android...');
  const mctx = await browser.newContext({
    viewport: { width: VW + 96, height: 1200 },
    deviceScaleFactor: 2,
  });
  const mpage = await mctx.newPage();

  for (const m of manifest) {
    const tmp = path.join(MOCK, '_m.html');
    fs.writeFileSync(tmp, mockupHtml(path.join(RAW, m.file), m.title), 'utf8');
    await mpage.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'load' });
    await mpage.evaluate(async () => {
      await Promise.all(Array.from(document.images).map(im =>
        im.complete ? Promise.resolve() : new Promise(r => { im.onload = im.onerror = r; })));
    });
    await mpage.waitForTimeout(220);
    await mpage.screenshot({ path: path.join(MOCK, m.file), fullPage: true });
    fs.unlinkSync(tmp);
    console.log(`  [ OK ] mockup ${m.file}`);
  }

  await mctx.close();
  await browser.close();

  fs.writeFileSync(path.join(RAW, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(MOCK, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n${manifest.length} tangkapan mentah di screenshots-mobile/`);
  console.log(`${manifest.length} mockup Android di screenshots-android/`);
})();
