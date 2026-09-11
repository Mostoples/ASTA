/* ============================================================
   ASTA — Perender frame motion graphic
   ------------------------------------------------------------
   Membaca daftar pekerjaan dari build.py:
     [{ sid, scene, dur, cues }]
   lalu memotret mg.html frame demi frame (30 fps) ke
     _build/mg/<sid>/f-0000.jpg …

   Waktu disetel lewat window.setTime(t) per frame, jadi animasinya
   deterministik dan terkunci pada laju video.

   Adegan yang parameternya tidak berubah (termasuk isi mg.html)
   dilewati, supaya build ulang cepat.

   Jalankan:  node tools/asta-video/render-mg.js <jobs.json> [--preview]
     --preview  hanya satu frame per adegan (dekat akhir), untuk
                memeriksa tata letak sebelum render penuh
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const MG = path.join(ROOT, 'ASTA REKAMAN FIX MP4', '_build', 'mg');
const PORT = 8238;
const W = 1920, H = 1080, FPS = 30;

function localChromium() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const builds = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.slice(9)) - parseInt(a.slice(9)));
  for (const b of builds) {
    for (const sub of ['chrome-win64', 'chrome-win']) {
      const exe = path.join(base, b, sub, 'chrome.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return undefined;
}

(async () => {
  const jobsFile = process.argv[2];
  const preview = process.argv.includes('--preview');
  if (!jobsFile) { console.error('pakai: node render-mg.js <jobs.json> [--preview]'); process.exit(2); }
  const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
  fs.mkdirSync(MG, { recursive: true });
  const mgStamp = fs.statSync(path.join(HERE, 'mg.html')).mtimeMs;

  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'mg.html';
    const f = path.join(HERE, rel);
    if (!f.startsWith(HERE) || !fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(PORT, r));

  const browser = await chromium.launch({ executablePath: localChromium(),
    args: ['--force-device-scale-factor=1', '--hide-scrollbars'] });
  const page = await (await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', e => { console.log('  ! ' + e.message.slice(0, 120)); });

  let rendered = 0;
  for (const j of jobs) {
    const dir = path.join(MG, j.sid);
    const n = Math.round(j.dur * FPS);
    const sig = JSON.stringify({ scene: j.scene, dur: j.dur, cues: j.cues || {}, mg: mgStamp });
    const last = path.join(dir, 'f-' + String(n - 1).padStart(4, '0') + '.jpg');

    if (!preview) {
      const sf = path.join(dir, 'job.json');
      if (fs.existsSync(sf) && fs.readFileSync(sf, 'utf8') === sig && fs.existsSync(last)) {
        console.log(`  ${j.sid.padEnd(6)} ${j.scene.padEnd(11)} (sudah ada)`);
        continue;
      }
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }

    const u = `http://localhost:${PORT}/mg.html?` + new URLSearchParams({
      scene: j.scene, dur: String(j.dur), cues: JSON.stringify(j.cues || {}) });
    await page.goto(u, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true);

    if (preview) {
      await page.evaluate(t => window.setTime(t), Math.max(0, j.dur - 0.7));
      await page.screenshot({ path: path.join(MG, `_preview-${j.sid}.jpg`), type: 'jpeg',
        quality: 85, clip: { x: 0, y: 0, width: W, height: H } });
      console.log(`  pratinjau ${j.sid} ${j.scene}`);
      continue;
    }

    for (let f = 0; f < n; f++) {
      await page.evaluate(t => window.setTime(t), f / FPS);
      await page.screenshot({ path: path.join(dir, 'f-' + String(f).padStart(4, '0') + '.jpg'),
        type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W, height: H } });
    }
    fs.writeFileSync(path.join(dir, 'job.json'), sig);
    rendered++;
    console.log(`  ${j.sid.padEnd(6)} ${j.scene.padEnd(11)} ${n} frame`);
  }

  await browser.close();
  srv.close();
  if (!preview) console.log(`\n${rendered} adegan dirender, ${jobs.length - rendered} dari cache.`);
})();
