/* ============================================================
   ASTA — Render kartu dan overlay video
   ------------------------------------------------------------
   Membuka cards.html pada 1920x1080 lalu menyimpan tiap kartu
   sebagai PNG. Kartu bertipe overlay disimpan dengan latar
   transparan (omitBackground) supaya dapat ditumpuk di atas
   footage oleh build.py.

   Jalankan:  node tools/asta-video/render-cards.js
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'ASTA REKAMAN FIX MP4', '_build', 'cards');
const PORT = 8237;
const W = 1920, H = 1080;

/* Kartu overlay dipotong pakai latar transparan; kartu penuh tidak. */
const FULL = ['title', 'masalah', 'metode', 'integrasi', 'sus', 'end'];
const OVER = [
  'kata-menggenggam', 'kata-mengangkat', 'kata-menjangkau',
  'lt-leader', 'lt-research-a', 'lt-research-b', 'lt-software', 'lt-it', 'lt-iot',
  'cap-13a', 'cap-13b', 'cap-13c', 'cap-13d', 'cap-13e', 'cap-13f',
  'cap-dashboard', 'cap-metode',
];

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

const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png',
               '.js': 'text/javascript; charset=utf-8' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // logo.png adalah aset tetap di folder ini: hasil potong dari animasi
  // opening, latar putihnya sudah dijadikan transparan supaya menyatu
  // dengan gradien kartu.
  if (!fs.existsSync(path.join(HERE, 'logo.png'))) {
    throw new Error('tools/asta-video/logo.png tidak ada');
  }

  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'cards.html';
    const f = path.join(HERE, rel);
    if (!f.startsWith(HERE) || !fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(PORT, r));

  const browser = await chromium.launch({ executablePath: localChromium(),
    args: ['--force-device-scale-factor=1', '--hide-scrollbars'] });
  const page = await (await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', e => console.log('  ! ' + e.message.slice(0, 90)));

  async function shot(card, n, name) {
    const u = `http://localhost:${PORT}/cards.html?card=${encodeURIComponent(card)}` +
              (n != null ? `&n=${n}` : '');
    await page.goto(u, { waitUntil: 'networkidle' });
    await page.waitForTimeout(160);
    const over = !FULL.includes(card);
    await page.screenshot({ path: path.join(OUT, (name || card) + '.png'),
      omitBackground: over, clip: { x: 0, y: 0, width: W, height: H } });
    console.log('  ' + (name || card) + (over ? '  (transparan)' : ''));
  }

  for (const c of FULL) await shot(c, null, c);
  for (const c of OVER) await shot(c, null, c);
  // Empat fokus: poin bertambah satu per satu
  for (let i = 0; i <= 4; i++) await shot('fokus', i, 'fokus-' + i);
  // Penghitung repetisi 01..08
  for (let i = 1; i <= 8; i++) await shot('reps', i, 'reps-' + String(i).padStart(2, '0'));

  await browser.close();
  srv.close();
  console.log('\nKartu tersimpan di ' + path.relative(ROOT, OUT));
})();
