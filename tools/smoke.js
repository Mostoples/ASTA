/* Uji asap lintas ukuran layar: desktop, tablet, ponsel */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'file:///' + ROOT.replace(/\\/g, '/');

const VIEWPORTS = [
  { name: 'desktop 1440', w: 1440, h: 900, mobile: false },
  { name: 'tablet 820', w: 820, h: 1180, mobile: true },
  { name: 'ponsel 360', w: 360, h: 800, mobile: true },
];

const PAGES = [
  ['index.html', null], ['pasien-dashboard.html', 'pasien'], ['sesi-latihan.html', 'pasien'],
  ['catatan-nyeri.html', 'pasien'], ['terapi-phantom.html', 'pasien'], ['progres.html', 'pasien'],
  ['perangkat.html', 'pasien'], ['kalibrasi.html', 'pasien'], ['jadwal.html', 'pasien'],
  ['notifikasi.html', 'pasien'], ['pengaturan.html', 'pasien'],
  ['terapis-dashboard.html', 'terapis'], ['terapis-pasien.html', 'terapis'],
  ['terapis-program.html', 'terapis'], ['terapis-kepatuhan.html', 'terapis'],
  ['terapis-nyeri.html', 'terapis'], ['prostetis-dashboard.html', 'prostetis'],
  ['admin-dashboard.html', 'admin'],
];
const RU = { pasien: 'u_pat_1', terapis: 'u_ter_1', prostetis: 'u_pro_1', admin: 'u_adm_1' };

(async () => {
  const browser = await chromium.launch();
  let fail = 0;

  for (const vp of VIEWPORTS) {
    let vpFail = 0;
    for (const [file, role] of PAGES) {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        isMobile: vp.mobile, hasTouch: vp.mobile,
      });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

      if (role) {
        await page.addInitScript(({ uid, role }) => {
          localStorage.setItem('asta:v1:session', JSON.stringify({
            userId: uid, role, name: 'T', loginAt: new Date().toISOString()
          }));
        }, { uid: RU[role], role });
      }
      try {
        await page.goto(`${BASE}/${file}`, { waitUntil: 'load', timeout: 25000 });
        await page.waitForTimeout(1200);
        const len = await page.evaluate(() => document.body.innerText.trim().length);
        if (len < 40) errs.push('halaman tampak kosong');

        // Navigasi bawah harus ada di ponsel/tablet, tidak di desktop
        if (role) {
          const tabbarVisible = await page.evaluate(() => {
            const t = document.querySelector('.tabbar');
            if (!t) return null;
            return getComputedStyle(t).display !== 'none';
          });
          if (vp.w <= 960 && tabbarVisible !== true) errs.push('navigasi bawah tidak tampil');
          if (vp.w > 960 && tabbarVisible !== false) errs.push('navigasi bawah tampil di desktop');
        }
      } catch (e) { errs.push('navigasi gagal: ' + e.message); }

      const real = errs.filter(e => !/favicon|Notification|permission|getUserMedia|bluetooth/i.test(e));
      if (real.length) { vpFail++; fail++; console.log(`[GAGAL] ${vp.name} · ${file}: ${real[0].slice(0, 90)}`); }
      await ctx.close();
    }
    console.log(`${vp.name.padEnd(16)} ${PAGES.length - vpFail}/${PAGES.length} lolos`);
  }

  await browser.close();
  console.log(fail ? `\n${fail} kegagalan.` : '\nSemua ukuran layar lolos.');
  process.exit(fail ? 1 : 0);
})();
