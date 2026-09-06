/* ============================================================
   Uji fungsional mobile — interaksi sentuh nyata
   Memastikan alur inti dapat dikerjakan dengan tap di ponsel,
   bukan hanya "tidak error".
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'file:///' + ROOT.replace(/\\/g, '/');

let pass = 0, fail = 0;
function check(n, ok, d) {
  if (ok) { console.log(`[ OK ] ${n}`); pass++; }
  else { console.log(`[FAIL] ${n}${d ? ' — ' + d : ''}`); fail++; }
}

const RU = { pasien: 'u_pat_1', terapis: 'u_ter_1', prostetis: 'u_pro_1', admin: 'u_adm_1' };

async function mobilePage(browser, role) {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 830 },
    deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('   !! ' + e.message.slice(0, 80)));
  if (role) {
    await page.addInitScript(({ uid, role }) => {
      localStorage.setItem('asta:v1:session', JSON.stringify({
        userId: uid, role, name: 'T', loginAt: new Date().toISOString()
      }));
    }, { uid: RU[role], role });
  }
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();

  /* 1. Navigasi bawah berfungsi dengan tap */
  {
    const { ctx, page } = await mobilePage(browser, 'pasien');
    await page.goto(`${BASE}/pasien-dashboard.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1300);

    const tabs = await page.$$('.tabbar a');
    check('Navigasi bawah punya 5 tujuan', tabs.length === 5, `${tabs.length} tujuan`);

    const box = await tabs[1].boundingBox();
    check('Target navigasi bawah cukup besar', box.height >= 54 && box.width >= 44,
      `${Math.round(box.width)}x${Math.round(box.height)}`);

    // Tap tujuan kedua (Latihan)
    await tabs[1].tap();
    await page.waitForTimeout(1600);
    check('Tap navigasi bawah berpindah halaman',
      page.url().includes('sesi-latihan'), page.url().split('/').pop());
    await ctx.close();
  }

  /* 2. Drawer menu samping bisa dibuka & ditutup */
  {
    const { ctx, page } = await mobilePage(browser, 'pasien');
    await page.goto(`${BASE}/pasien-dashboard.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1300);

    const before = await page.evaluate(() =>
      document.querySelector('#sidebar').classList.contains('open'));
    await page.tap('#btn-menu');
    await page.waitForTimeout(600);
    const after = await page.evaluate(() =>
      document.querySelector('#sidebar').classList.contains('open'));
    check('Menu samping tertutup pada awalnya', before === false);
    check('Tombol menu membuka drawer', after === true);

    const scrim = await page.$('.scrim');
    check('Scrim muncul saat drawer terbuka', !!scrim);

    // Area scrim harus cukup lebar untuk ditap dengan ibu jari
    const scrimW = await page.evaluate(() => {
      const sb = document.querySelector('#sidebar');
      return Math.round(window.innerWidth - sb.getBoundingClientRect().width);
    });
    check('Area scrim cukup lebar untuk ditap', scrimW >= 80, `${scrimW}px tersisa`);

    // Tombol tutup di dalam drawer: jalur utama menutup menu
    await page.tap('#btn-close-drawer');
    await page.waitForTimeout(600);
    const closed = await page.evaluate(() =>
      document.querySelector('#sidebar').classList.contains('open'));
    check('Tombol tutup menutup drawer', closed === false);
    await ctx.close();
  }

  /* 3. Alur catat nyeri dengan tap */
  {
    const { ctx, page } = await mobilePage(browser, 'pasien');
    await page.goto(`${BASE}/catatan-nyeri.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1400);

    await page.evaluate(() => {
      const t = U.today();
      const ex = Store.list('painLogs').find(p => p.patientId === 'u_pat_1' && p.date === t);
      if (ex) Store.delete('painLogs', ex.id);
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1400);

    // Skala nyeri harus dua baris di ponsel
    const scaleRows = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.pain-btn'));
      const tops = new Set(btns.map(b => Math.round(b.getBoundingClientRect().top)));
      return { rows: tops.size, count: btns.length };
    });
    check('Skala nyeri tersusun rapi di ponsel',
      scaleRows.count === 11 && scaleRows.rows >= 2, `${scaleRows.count} tombol, ${scaleRows.rows} baris`);

    await page.tap('.pain-btn[data-lvl="7"]');
    await page.waitForTimeout(400);
    await page.tap('[data-zone="ph_palm"]');
    await page.waitForTimeout(300);
    await page.tap('[data-type="kesetrum"]');
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('#btn-save').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    await page.tap('#btn-save');
    // Halaman memuat ulang sendiri setelah simpan; tunggu sampai stabil
    // agar evaluate tidak berjalan di konteks yang sudah dibuang.
    await page.waitForTimeout(2200);
    await page.waitForLoadState('load').catch(() => {});

    const saved = await page.evaluate(() => {
      const r = Store.list('painLogs').find(p => p.patientId === 'u_pat_1' && p.date === U.today());
      return r ? { lvl: r.level, zones: r.zones, types: r.types } : null;
    });
    check('Catatan nyeri tersimpan lewat tap', !!saved && saved.lvl === 7,
      saved ? `level ${saved.lvl}` : 'tidak tersimpan');
    check('Zona terpilih lewat tap pada SVG', saved && saved.zones.includes('ph_palm'));
    await ctx.close();
  }

  /* 4. Modal jadi lembar bawah dan tombolnya terjangkau */
  {
    const { ctx, page } = await mobilePage(browser, 'pasien');
    await page.goto(`${BASE}/pengaturan.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1400);

    await page.tap('.tab[data-tab="skrining"]');
    await page.waitForTimeout(700);
    await page.tap('#btn-phq');
    await page.waitForTimeout(900);

    const sheet = await page.evaluate(() => {
      const m = document.querySelector('.modal');
      if (!m) return null;
      const b = m.getBoundingClientRect();
      const cs = getComputedStyle(m);
      return {
        w: Math.round(b.width),
        bottomAligned: Math.abs(b.bottom - window.innerHeight) < 4,
        radius: cs.borderTopLeftRadius,
        vw: window.innerWidth
      };
    });
    check('Modal menjadi lembar bawah', sheet && sheet.bottomAligned,
      sheet ? `bawah=${sheet.bottomAligned}` : 'modal tidak ada');
    check('Lembar selebar layar', sheet && sheet.w >= sheet.vw - 2,
      sheet ? `${sheet.w}/${sheet.vw}px` : '');

    // Semua tombol pilihan PHQ harus cukup besar
    const chipOk = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.modal .chip'));
      return chips.length > 0 && chips.every(c => c.getBoundingClientRect().height >= 40);
    });
    check('Pilihan jawaban cukup besar untuk disentuh', chipOk);
    await ctx.close();
  }

  /* 5. Simulator EMG jalan di ponsel */
  {
    const { ctx, page } = await mobilePage(browser, 'pasien');
    await page.goto(`${BASE}/perangkat.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1400);

    const r = await page.evaluate(async () => {
      await Device.connect('mock');
      const s = [];
      const off = Device.on('signal', d => s.push(d.raw.ch1));
      for (let i = 0; i < 3; i++) {
        Device.simulateContraction('ch1', 0.92, 700);
        await new Promise(r2 => setTimeout(r2, 450));
      }
      await new Promise(r2 => setTimeout(r2, 600));
      off();
      return { n: s.length, max: Math.max(...s, 0), connected: Device.state.connected };
    });
    check('Simulator EMG jalan di ponsel', r.connected && r.n > 20, `${r.n} sampel`);
    check('Sinyal mencapai ambang di ponsel', r.max > 0.35, `puncak ${r.max.toFixed(2)}`);

    // Kanvas osiloskop harus muat dalam layar
    const canvasFit = await page.evaluate(() => {
      const c = document.querySelector('#scope');
      if (!c) return null;
      return c.getBoundingClientRect().width <= window.innerWidth;
    });
    check('Osiloskop EMG muat dalam layar', canvasFit === true);
    await ctx.close();
  }

  /* 6. Tabel dapat digeser tanpa merusak layout */
  {
    const { ctx, page } = await mobilePage(browser, 'terapis');
    await page.goto(`${BASE}/terapis-dashboard.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    const r = await page.evaluate(() => {
      const w = document.querySelector('.table-wrap');
      if (!w) return null;
      return {
        scrollable: w.scrollWidth > w.clientWidth,
        fits: w.getBoundingClientRect().width <= window.innerWidth + 1,
        docNoOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1
      };
    });
    check('Tabel dapat digeser di dalam wadahnya', r && r.scrollable);
    check('Wadah tabel tidak melebihi layar', r && r.fits);
    check('Halaman tetap tanpa scroll horizontal', r && r.docNoOverflow);
    await ctx.close();
  }

  /* 7. Mode satu tangan menaikkan target sentuh */
  {
    const { ctx, page } = await mobilePage(browser, 'pasien');
    await page.goto(`${BASE}/pasien-dashboard.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1300);

    const withOneHand = await page.evaluate(() => {
      document.body.classList.add('one-hand');
      const b = document.querySelector('.tabbar a');
      return b ? b.getBoundingClientRect().height : 0;
    });
    const without = await page.evaluate(() => {
      document.body.classList.remove('one-hand');
      const b = document.querySelector('.tabbar a');
      return b ? b.getBoundingClientRect().height : 0;
    });
    check('Mode satu tangan memperbesar target', withOneHand > without,
      `${Math.round(without)}px -> ${Math.round(withOneHand)}px`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} lolos, ${fail} gagal.`);
  process.exit(fail ? 1 : 0);
})();
