/* ============================================================
   Uji fungsional inti ASTA (desktop)
   Memastikan perbaikan mobile tidak merusak logika aplikasi:
   simulator EMG, rep counter, analisis fase, kepatuhan, ekspor.
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

async function newPage(browser, role) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

  /* 1. Simulator EMG & pipeline gerak */
  {
    const { ctx, page } = await newPage(browser, 'pasien');
    await page.goto(`${BASE}/perangkat.html`, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    const r = await page.evaluate(async () => {
      await Device.connect('mock');
      const s = [], poses = [];
      const o1 = Device.on('signal', d => s.push(d.raw.ch1));
      const o2 = Device.on('pose', d => poses.push(d.pose.slice()));
      for (let i = 0; i < 5; i++) {
        Device.simulateContraction('ch1', 0.95, 700);
        await new Promise(x => setTimeout(x, 480));
      }
      await new Promise(x => setTimeout(x, 800));
      o1(); o2();
      return {
        connected: Device.state.connected, n: s.length, max: Math.max(...s, 0),
        poses: poses.length, bend: poses.length ? Math.max(...poses.flat()) : 0
      };
    });
    check('Simulator terhubung', r.connected);
    check('Sinyal EMG mengalir', r.n > 30, `${r.n} sampel`);
    check('Amplitudo mencapai ambang', r.max > 0.35, `puncak ${r.max.toFixed(2)}`);
    check('Pose lengan diperbarui', r.poses > 10, `${r.poses} update`);
    check('Jari menekuk', r.bend > 0.15, `${r.bend.toFixed(2)}`);
    await ctx.close();
  }

  /* 2. Rep counter */
  {
    const { ctx, page } = await newPage(browser, 'pasien');
    await page.goto(`${BASE}/sesi-latihan.html`, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      await Device.connect('mock');
      const rc = RepCounter.create({ channel: 'ch1', holdMs: 600 });
      rc.start();
      const thr = Device.getCal().threshold.ch1;
      const feed = v => Device._ingest({ ch1: v, ch2: 0.02, ch3: 0.02, ch4: 0.02 });
      for (let c = 0; c < 4; c++) {
        for (const v of [0.02, thr + 0.15, thr + 0.3, thr + 0.32, thr + 0.33]) {
          feed(v); await new Promise(x => setTimeout(x, 40));
        }
        for (let i = 0; i < 12; i++) {
          feed(thr + 0.31 + Math.random() * 0.02); await new Promise(x => setTimeout(x, 45));
        }
        for (const v of [thr * 0.6, thr * 0.3, 0.02, 0.02]) {
          feed(v); await new Promise(x => setTimeout(x, 45));
        }
        await new Promise(x => setTimeout(x, 420));
      }
      const s = rc.summary(); rc.destroy();
      return { count: s.count, q: s.avgQuality, hold: s.avgHoldMs };
    });
    check('Rep counter menghitung repetisi', r.count >= 3, `${r.count} dari 4 siklus`);
    check('Mutu repetisi dinilai', r.q !== null && r.q > 0, `skor ${r.q}`);
    check('Durasi tahan terukur', r.hold > 200, `${r.hold} ms`);
    await ctx.close();
  }

  /* 3. Analisis fase A-B-A */
  {
    const { ctx, page } = await newPage(browser, 'terapis');
    await page.goto(`${BASE}/terapis-nyeri.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1100);
    const r = await page.evaluate(() => {
      const sum = Study.phaseSummary('u_pat_1');
      const eff = Study.effect('u_pat_1');
      const a2 = sum.find(p => p.phase === 'A2');
      const hap = a2 ? Store.list('telemetry')
        .filter(t => t.patientId === 'u_pat_1' && t.date >= a2.from && t.date <= a2.to)
        .reduce((s, t) => s + (t.hapticEvents || 0), 0) : null;
      return {
        phases: sum.map(p => p.phase).join(','),
        allData: sum.every(p => p.painN > 0),
        hap, eff
      };
    });
    check('Empat fase A-B-A terbentuk', r.phases === 'A1,B1,A2,B2', r.phases);
    check('Setiap fase punya data nyeri', r.allData);
    check('Haptik nol pada fase A', r.hap === 0, `hapticEvents=${r.hap}`);
    check('Ukuran efek terhitung', r.eff && typeof r.eff.cohensD === 'number',
      r.eff ? `d=${r.eff.cohensD}` : 'null');
    check('Nyeri lebih rendah saat haptik aktif', r.eff && r.eff.favorsHaptic,
      r.eff ? `on=${r.eff.painWithHaptic} off=${r.eff.painWithoutHaptic}` : '');
    await ctx.close();
  }

  /* 4. Skor kepatuhan */
  {
    const { ctx, page } = await newPage(browser, 'terapis');
    await page.goto(`${BASE}/terapis-kepatuhan.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const r = await page.evaluate(() => {
      const a = Analytics.adherence('u_pat_1', 14);
      const b = Analytics.adherence('u_pat_5', 14);
      const re = Math.round((a.freqPct / 100) * 50 + (a.completionPct / 100) * 30 + (a.wearPct / 100) * 20);
      return { a: a.score, b: b.score, re, inRange: a.score >= 0 && a.score <= 100 };
    });
    check('Skor kepatuhan dalam rentang', r.inRange);
    check('Skor konsisten dengan bobotnya', Math.abs(r.re - r.a) <= 1, `hitung=${r.re} aktual=${r.a}`);
    check('Pasien patuh > tidak patuh', r.a > r.b, `${r.a} vs ${r.b}`);
    await ctx.close();
  }

  /* 5. Guard peran */
  {
    const { ctx, page } = await newPage(browser, 'pasien');
    await page.goto(`${BASE}/terapis-dashboard.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    check('Pasien tidak bisa buka dasbor terapis',
      !page.url().includes('terapis-dashboard'), page.url().split('/').pop());
    await ctx.close();
  }

  /* 6. Ekspor CSV */
  {
    const { ctx, page } = await newPage(browser, 'terapis');
    await page.goto(`${BASE}/terapis-nyeri.html`, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const s = Study.exportStudyCSV(true);
      const ae = Study.exportAECSV(true);
      const h = s.csv.split('\r\n')[0];
      return {
        rows: s.rows, subj: s.subjects,
        phase: h.includes('study_phase'), haptic: h.includes('haptic_active'),
        anon: !s.csv.includes('Rizky'), aeRows: ae.rows
      };
    });
    check('Ekspor dataset berisi baris', r.rows > 400, `${r.rows} baris, ${r.subj} subjek`);
    check('Kolom fase studi ada', r.phase);
    check('Kolom status haptik ada', r.haptic);
    check('Data teranonimkan', r.anon);
    check('Ekspor kejadian tak diinginkan', r.aeRows > 0, `${r.aeRows} baris`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} lolos, ${fail} gagal.`);
  process.exit(fail ? 1 : 0);
})();
