/* ============================================================
   ASTA — Perekam frame showreel
   ------------------------------------------------------------
   Merekam tiap adegan sebagai deretan frame 1920x1080 yang sudah
   final: aplikasi dimuat di dalam panggung (stage.html) pada
   ukuran aslinya, jadi satu tangkapan layar panggung = satu frame
   video. Tidak ada langkah compositing terpisah.

   Scroll dihitung per frame lalu disetel langsung (bukan animasi
   CSS), sehingga gerakannya terikat pada laju frame video dan
   bebas jitter.

   Jalankan:
     node tools/showreel/record.js --variant desktop
     node tools/showreel/record.js --variant android
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { SCENES, ROLE } = require('./scenes');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8231;
const W = 1920, H = 1080, FPS = 30;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
};

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

/* Playwright di mesin ini kadang meminta build peramban yang lebih baru
   daripada yang sudah terunduh; pakai chromium yang tersedia. */
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

/** Pelembut gerak: mulai pelan, cepat di tengah, melambat di akhir. */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

(async () => {
  const variant = arg('variant', 'desktop') === 'android' ? 'android' : 'desktop';
  const OUT = path.join(ROOT, 'video-showreel', variant);

  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const srv = await serve();
  const browser = await chromium.launch({
    executablePath: localChromium(),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--force-device-scale-factor=1', '--hide-scrollbars'],
  });

  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    // Ponsel disimulasikan lewat lebar iframe, bukan lewat konteks:
    // panggungnya sendiri tetap halaman desktop 1920x1080.
    userAgent: variant === 'android'
      ? 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120 Mobile Safari/537.36'
      : undefined,
  });

  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('   ! panggung: ' + e.message.slice(0, 80)));

  const manifest = [];
  const totalSec = SCENES.reduce((a, s) => a + s.sec, 0);
  let elapsed = 0;

  /* Kartu pembuka dan penutup: satu frame diam yang ditahan beberapa
     detik. Cukup merekam satu berkas lalu memberi tahu perakit berapa
     lama kartu ditahan — jauh lebih hemat daripada menulis 75 salinan. */
  async function recordCard(kind, sec) {
    const dir = path.join(OUT, 'card-' + kind);
    fs.mkdirSync(dir, { recursive: true });
    await page.goto('http://localhost:' + PORT + '/tools/showreel/stage.html?' +
      new URLSearchParams({ variant, card: kind }), { waitUntil: 'networkidle' });
    await page.evaluate(v => window.setProgress(v), kind === 'intro' ? 0 : 1);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(dir, 'still.jpg'), type: 'jpeg', quality: 95,
      clip: { x: 0, y: 0, width: W, height: H },
    });
    console.log('  --  kartu ' + kind.padEnd(21) + ' ' + sec + 's');
    return { id: 'card-' + kind, kind: 'card', sec };
  }

  // --only 03,07  merekam sebagian adegan saja (untuk pemeriksaan cepat)
  const only = arg('only', '');
  const pick = only ? new Set(only.split(',').map(x => x.trim())) : null;

  if (!pick) manifest.push(await recordCard('intro', 2.6));

  for (let si = 0; si < SCENES.length; si++) {
    const s = SCENES[si];
    if (pick && !pick.has(s.id)) continue;
    const dir = path.join(OUT, 'scene-' + s.id);
    fs.mkdirSync(dir, { recursive: true });

    // Sesi peran disetel sebelum halaman panggung dimuat
    const sess = s.role ? ROLE[s.role] : null;
    await page.goto('http://localhost:' + PORT + '/tools/showreel/_blank.html',
      { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.evaluate(u => {
      if (u) {
        localStorage.setItem('asta:v1:session', JSON.stringify({
          userId: u.uid, role: u.role, name: u.name, loginAt: new Date().toISOString(),
        }));
      } else {
        localStorage.removeItem('asta:v1:session');
      }
    }, sess);

    const url = 'http://localhost:' + PORT + '/tools/showreel/stage.html?' +
      new URLSearchParams({
        variant, src: s.f, title: s.title, sub: s.sub,
        n: String(si + 1), of: String(SCENES.length),
      });
    await page.goto(url, { waitUntil: 'networkidle' });

    // Sembunyikan bilah gulir di dalam iframe dan tunggu isinya mapan
    await page.evaluate(() => {
      const fr = document.getElementById('app');
      const d = fr.contentDocument;
      const st = d.createElement('style');
      st.textContent =
        '::-webkit-scrollbar{width:0;height:0;display:none}' +
        'html{scrollbar-width:none}';
      d.head.appendChild(st);
    });
    // Model 3D, grafik, dan animasi masuk perlu waktu mengendap
    await page.waitForTimeout(s.f === 'model-3d.html' || s.f === 'index.html' ? 5200 : 2600);

    // Landing page memunculkan elemen saat digulir; untuk video semua
    // dibuka lebih dulu agar tidak ada blok yang tiba-tiba melompat.
    await page.evaluate(() => {
      const d = document.getElementById('app').contentDocument;
      d.querySelectorAll('.lp-reveal').forEach(e => e.classList.add('in'));
    });

    const plan = await page.evaluate(({ mode }) => {
      const doc = document.getElementById('app').contentDocument;
      const de = doc.documentElement;
      const cands = [
        { kind: 'doc', el: de },
        { kind: 'el', el: doc.body },
        ...Array.from(doc.querySelectorAll('.content, .main, .app'))
          .map(el => ({ kind: 'el', el })),
      ];
      let sc = { kind: 'doc', el: de };
      for (const c of cands) {
        if (c.el && c.el.scrollHeight - c.el.clientHeight > 8) { sc = c; break; }
      }
      const max = Math.max(0, sc.el.scrollHeight - sc.el.clientHeight);
      window.__sc = sc;
      const target = mode === 'none' ? 0 : mode === 'full' ? max : max * mode;
      return { max, target: Math.round(target) };
    }, { mode: s.scroll });

    const frames = Math.round(s.sec * FPS);
    const holdF = Math.round((s.hold || 0) * FPS);
    // Sisakan jeda singkat di dasar halaman agar tidak terasa terpotong
    const tailF = plan.target > 0 ? Math.round(0.45 * FPS) : 0;
    const moveF = Math.max(1, frames - holdF - tailF);

    for (let f = 0; f < frames; f++) {
      let y = 0;
      if (plan.target > 0) {
        const t = Math.min(1, Math.max(0, (f - holdF) / moveF));
        y = Math.round(plan.target * easeInOutCubic(t));
      }
      await page.evaluate(({ y, p }) => {
        const sc = window.__sc;
        if (sc.kind === 'doc') sc.el.ownerDocument.defaultView.scrollTo(0, y);
        else sc.el.scrollTop = y;
        window.setProgress(p);
      }, { y, p: (elapsed + f / FPS) / totalSec });

      await page.screenshot({
        path: path.join(dir, 'f-' + String(f).padStart(4, '0') + '.jpg'),
        type: 'jpeg', quality: 95,
        clip: { x: 0, y: 0, width: W, height: H },
      });
    }

    elapsed += s.sec;
    manifest.push({ id: s.id, file: s.f, title: s.title, sub: s.sub,
      frames, sec: s.sec, scrollMax: plan.max, scrollTo: plan.target });
    console.log(`  ${s.id}  ${s.title.padEnd(24)} ${frames} frame` +
      (plan.target ? `  gulir 0→${plan.target}px` : '  diam'));
  }

  if (!pick) manifest.push(await recordCard('outro', 3.2));

  fs.writeFileSync(path.join(OUT, 'manifest.json'),
    JSON.stringify({ variant, fps: FPS, w: W, h: H, scenes: manifest }, null, 2));

  await browser.close();
  srv.close();
  const total = manifest.reduce((a, m) => a + (m.frames || 0), 0);
  const dur = manifest.reduce((a, m) => a + m.sec, 0);
  console.log(`\n${variant}: ${manifest.length} segmen, ${total} frame ` +
    `+ kartu, ${dur.toFixed(1)} detik sebelum transisi`);
})();
