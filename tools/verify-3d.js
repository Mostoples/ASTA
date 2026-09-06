/* ============================================================
   ASTA — Verifikasi penampil 3D
   Menjalankan server statis lokal (WebGL dan modul ES memerlukan
   protokol http, bukan file://), lalu memeriksa tiap halaman yang
   menampilkan lengan bionik:

     - tidak ada galat JavaScript dan tidak ada berkas 404
     - penampil mencapai keadaan siap (webgl atau sprite)
     - ruas jari benar-benar berputar saat pose diubah

   Jalankan:  node tools/verify-3d.js
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8137;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml',
};

/* Playwright di mesin ini kadang meminta build peramban yang lebih baru
   daripada yang sudah terunduh. Pakai chromium yang tersedia supaya
   verifikasi tidak menuntut unduhan ratusan MB. */
function localChromium() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const builds = fs.readdirSync(base)
    .filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.slice(9)) - parseInt(a.slice(9)));
  for (const b of builds) {
    for (const sub of ['chrome-win64', 'chrome-win']) {
      const exe = path.join(base, b, sub, 'chrome.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return undefined;
}

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); return res.end('404');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

/* Lengan pada halaman sesi latihan baru dipasang setelah sesi dimulai. */
async function startSession(page) {
  await page.evaluate(() => {
    document.querySelectorAll('input[type=checkbox]').forEach(c => {
      if (!c.checked) {
        c.checked = true;
        c.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
  const btn = await page.$('#btn-start');
  if (btn) { await btn.click(); await page.waitForTimeout(1000); }
}

const PAGES = [
  // Landing page publik: penampil 3D ada di hero, tanpa perlu masuk
  { file: 'index.html', role: null, arm: true },
  { file: 'masuk.html', role: null, arm: false },
  { file: 'model-3d.html', role: 'pasien', arm: true },
  { file: 'pasien-dashboard.html', role: 'pasien', arm: true },
  { file: 'perangkat.html', role: 'pasien', arm: true },
  { file: 'kalibrasi.html', role: 'pasien', arm: true },
  { file: 'sesi-latihan.html', role: 'pasien', arm: true, before: startSession },
];
const RU = { pasien: 'u_pat_1', terapis: 'u_ter_1', prostetis: 'u_pro_1', admin: 'u_adm_1' };

/* Dijalankan di dalam halaman: tunggu penampil siap, buka jari penuh,
   lalu tutup penuh, dan pastikan rotasi ruas benar-benar berubah. */
async function probe() {
  const host = document.querySelector('#stage, #arm-stage, #arm, #hero-3d');
  if (!host) return { mode: 'wadah tidak ditemukan' };

  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    if (host.querySelector('canvas') || host.querySelector('.arm3d-sprite img')) break;
    await new Promise(r => setTimeout(r, 120));
  }

  const canvasEl = host.querySelector('canvas');
  const mountEl = host.querySelector('.arm3d-canvas');
  const mode = canvasEl ? 'webgl'
    : host.querySelector('.arm3d-sprite') ? 'sprite' : 'gagal';

  const out = {
    mode,
    canvasSize: canvasEl ? canvasEl.width + 'x' + canvasEl.height : null,
  };
  if (mode !== 'webgl') return out;

  const api = mountEl && mountEl.__arm3d;
  if (!api || !api.model) { out.note = 'model tidak terjangkau'; return out; }

  const read = () => {
    let sum = 0, n = 0;
    api.model.traverse(o => {
      if (/^JNT_(thumb|index|middle|ring|pinky)_\d$/.test(o.name)) { sum += o.rotation.x; n++; }
    });
    return { sum, n };
  };

  api.setPose([0, 0, 0, 0, 0], 0, 0);
  await new Promise(r => setTimeout(r, 1700));
  const open = read();
  api.setPose([1, 1, 1, 1, 1], 90, 0);
  await new Promise(r => setTimeout(r, 1700));
  const shut = read();

  out.joints = open.n;
  // Menekuk ke arah telapak = rotasi X negatif, jadi jumlah harus turun
  out.bend = +(open.sum - shut.sum).toFixed(2);
  out.bendOk = open.n >= 14 && out.bend > 5;
  return out;
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch({
    executablePath: localChromium(),
    // SwiftShader: WebGL tetap tersedia di lingkungan tanpa GPU
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  let fail = 0;

  for (const p of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => {
      const t = m.text();
      // 404 generik ditangani handler response di bawah, jangan dihitung dua kali
      if (m.type() === 'error' && !/Failed to load resource/.test(t)) errs.push('console: ' + t);
    });
    page.on('response', r => {
      if (r.status() >= 400 && !/favicon/.test(r.url())) {
        errs.push(`http ${r.status()}: ${r.url().replace(/^https?:\/\/[^/]+/, '')}`);
      }
    });

    if (p.role) {
      await page.addInitScript(({ uid, r }) => {
        localStorage.setItem('asta:v1:session', JSON.stringify({
          userId: uid, role: r, name: 'T', loginAt: new Date().toISOString(),
        }));
      }, { uid: RU[p.role], r: p.role });
    }

    await page.goto(`http://localhost:${PORT}/${p.file}`, { waitUntil: 'networkidle' });
    if (p.before) await p.before(page);

    let info = { mode: '—' };
    if (p.arm) info = await page.evaluate(probe);

    const armOk = !p.arm || ((info.mode === 'webgl' || info.mode === 'sprite') &&
      (info.mode !== 'webgl' || info.bendOk === true));
    const ok = errs.length === 0 && armOk;
    if (!ok) fail++;

    console.log(
      `${ok ? 'OK   ' : 'GAGAL'} ${p.file.padEnd(24)} mode=${info.mode}` +
      (info.canvasSize ? ` canvas=${info.canvasSize}` : '') +
      (info.joints ? ` ruas=${info.joints}` : '') +
      (info.bend !== undefined ? ` Δfleksi=${info.bend}rad` : '') +
      (info.note ? ` (${info.note})` : '')
    );
    errs.slice(0, 6).forEach(e => console.log('        · ' + e.slice(0, 150)));
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log(fail ? `\n${fail} halaman bermasalah.` : '\nSemua halaman lolos.');
  process.exit(fail ? 1 : 0);
})();
