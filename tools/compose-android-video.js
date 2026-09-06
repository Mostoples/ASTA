/* ============================================================
   ASTA — Menyusun video mockup Android
   ------------------------------------------------------------
   Tiap adegan dirakit dengan ffmpeg dalam satu lintasan:

     latar gradien  ->  overlay layar ponsel  ->  overlay bingkai
     mockup (PNG statis dengan lubang transparan)  ->  teks judul

   Bingkai ponsel dan panel judul dibuat sekali sebagai PNG
   melalui Playwright, lalu dipakai ulang untuk seluruh frame.
   Ini jauh lebih cepat daripada membungkus tiap frame di
   peramban (4170 frame).
   ============================================================ */
const { chromium } = require('playwright');
const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FRAMES = path.join(ROOT, 'video-android');
const WORK = path.join(FRAMES, '_assets');
const FF = 'C:\\Users\\mosto\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe';

const man = JSON.parse(fs.readFileSync(path.join(FRAMES, 'manifest.json'), 'utf8'));
const FPS = man.fps;

/* ---------- Kanvas video 1080x1920 ---------- */
const OW = 1080, OH = 1920;

/* Tata letak: judul di atas, ponsel di bawah.
   Layar ponsel 393x830 diskalakan supaya proporsional. */
const PH_SCALE = 1.62;                                  // 393*1.62 = 637px lebar layar
const SCR_W = Math.round(393 * PH_SCALE);               // 637
const SCR_H = Math.round(830 * PH_SCALE);               // 1345
const BEZEL = 20;                                       // ketebalan bingkai
const PH_W = SCR_W + BEZEL * 2;                         // 677
const PH_H = SCR_H + BEZEL * 2;                         // 1385
const PH_X = Math.round((OW - PH_W) / 2);               // 201
const PH_Y = 452;                                       // di bawah panel judul
const SCR_X = PH_X + BEZEL;
const SCR_Y = PH_Y + BEZEL;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ============================================================
   1. Buat aset: latar, bingkai ponsel, panel judul per adegan
   ============================================================ */
async function buildAssets() {
  if (fs.existsSync(WORK)) fs.rmSync(WORK, { recursive: true });
  fs.mkdirSync(WORK, { recursive: true });

  const browser = await chromium.launch();

  /* --- Badan ponsel (solid, ditempatkan DI BAWAH layar) ---
     Catatan: elemen anak ber-`background: transparent` tidak
     melubangi induknya, ia justru menampilkan induk. Jadi
     bingkai dibuat solid, lalu layar dioverlay di atasnya
     dengan sudut dibulatkan lewat alphamerge. */
  {
    const page = await browser.newPage({
      viewport: { width: PH_W, height: PH_H },
      deviceScaleFactor: 1,
    });
    await page.goto('data:text/html,' + encodeURIComponent(`
      <html><head><style>
        html,body{margin:0;background:transparent;}
        .p{
          width:${PH_W}px;height:${PH_H}px;box-sizing:border-box;
          border-radius:${BEZEL + 34}px;
          background:linear-gradient(150deg,#33404f,#141a23);
          position:relative;
          box-shadow:inset 0 0 0 2px #0b1016;
        }
        /* Ceruk layar: gelap, sebagai dasar di balik tangkapan */
        .well{
          position:absolute;left:${BEZEL}px;top:${BEZEL}px;
          width:${SCR_W}px;height:${SCR_H}px;
          border-radius:34px;background:#0d1218;
        }
        .btn1,.btn2{position:absolute;background:#3d4753;border-radius:3px;}
        .btn1{right:-4px;top:250px;width:4px;height:118px;}
        .btn2{left:-4px;top:224px;width:4px;height:74px;}
      </style></head><body>
        <div class="p"><div class="well"></div>
          <div class="btn1"></div><div class="btn2"></div>
        </div>
      </body></html>`), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(WORK, 'phone-body.png'),
      omitBackground: true,
    });
    await page.close();
    console.log('  aset: badan ponsel');
  }

  /* --- Mask sudut layar: putih = tampil, hitam = tersembunyi --- */
  {
    const page = await browser.newPage({
      viewport: { width: SCR_W, height: SCR_H },
      deviceScaleFactor: 1,
    });
    await page.goto('data:text/html,' + encodeURIComponent(`
      <html><head><style>
        html,body{margin:0;background:#000;width:${SCR_W}px;height:${SCR_H}px;overflow:hidden;}
        .m{width:${SCR_W}px;height:${SCR_H}px;border-radius:34px;background:#fff;}
      </style></head><body><div class="m"></div></body></html>`), { waitUntil: 'load' });
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(WORK, 'screen-mask.png') });
    await page.close();
    console.log('  aset: mask sudut layar');
  }

  /* --- Lapisan atas ponsel: punch-hole kamera + kilau tepi --- */
  {
    const page = await browser.newPage({
      viewport: { width: PH_W, height: PH_H },
      deviceScaleFactor: 1,
    });
    await page.goto('data:text/html,' + encodeURIComponent(`
      <html><head><style>
        html,body{margin:0;background:transparent;}
        .o{width:${PH_W}px;height:${PH_H}px;position:relative;
           border-radius:${BEZEL + 34}px;
           box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.11);}
        .cam{
          position:absolute;top:${BEZEL + 14}px;left:50%;transform:translateX(-50%);
          width:19px;height:19px;border-radius:50%;
          background:#0b1016;box-shadow:inset 0 0 0 2px #2b3440;
        }
      </style></head><body><div class="o"><div class="cam"></div></div></body></html>`),
      { waitUntil: 'load' });
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(WORK, 'phone-top.png'), omitBackground: true });
    await page.close();
    console.log('  aset: lapisan atas ponsel');
  }

  /* --- Latar gradien --- */
  {
    const page = await browser.newPage({ viewport: { width: OW, height: OH }, deviceScaleFactor: 1 });
    await page.goto('data:text/html,' + encodeURIComponent(`
      <html><head><style>
        html,body{margin:0;width:${OW}px;height:${OH}px;overflow:hidden;}
        body{background:linear-gradient(168deg,#1b4fa8 0%,#17428f 44%,#0e2a5e 100%);position:relative;}
        .g1,.g2{position:absolute;border-radius:50%;}
        .g1{width:760px;height:760px;right:-260px;top:-200px;background:rgba(255,255,255,.055);}
        .g2{width:560px;height:560px;left:-200px;bottom:-160px;background:rgba(168,255,232,.05);}
      </style></head><body><div class="g1"></div><div class="g2"></div></body></html>`),
      { waitUntil: 'load' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(WORK, 'bg.png') });
    await page.close();
    console.log('  aset: latar');
  }

  /* --- Panel judul per adegan (transparan) --- */
  {
    const page = await browser.newPage({ viewport: { width: OW, height: PH_Y }, deviceScaleFactor: 1 });
    const total = man.scenes.length;

    for (let i = 0; i < total; i++) {
      const s = man.scenes[i];
      const dots = man.scenes.map((_, j) =>
        `<span class="d${j === i ? ' on' : ''}"></span>`).join('');

      await page.goto('data:text/html,' + encodeURIComponent(`
        <html><head><style>
          html,body{margin:0;background:transparent;
            width:${OW}px;height:${PH_Y}px;overflow:hidden;
            font-family:"Segoe UI",Inter,system-ui,sans-serif;color:#f4f8ff;}
          .w{padding:74px 76px 0;}
          .k{display:inline-block;padding:10px 22px;border-radius:999px;
             background:rgba(255,255,255,.17);font-size:22px;font-weight:700;
             letter-spacing:.11em;text-transform:uppercase;}
          h1{margin:26px 0 0;font-size:60px;font-weight:750;letter-spacing:-.02em;
             line-height:1.13;max-width:22ch;}
          p{margin:16px 0 0;font-size:27px;color:#c9dcff;line-height:1.42;max-width:32ch;}
          .dots{position:absolute;left:76px;bottom:20px;display:flex;gap:7px;align-items:center;}
          .d{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.3);}
          .d.on{width:26px;border-radius:999px;background:#a8ffe8;}
          .num{position:absolute;right:76px;bottom:16px;font-size:20px;font-weight:700;
               color:#b9d2ff;letter-spacing:.05em;}
        </style></head><body>
          <div class="w">
            <span class="k">${esc(s.kicker)}</span>
            <h1>${esc(s.title)}</h1>
            <p>${esc(s.sub)}</p>
          </div>
          <div class="dots">${dots}</div>
          <div class="num">${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</div>
        </body></html>`), { waitUntil: 'load' });
      await page.waitForTimeout(140);
      await page.screenshot({
        path: path.join(WORK, `title-${s.id}.png`),
        omitBackground: true,
      });
    }
    await page.close();
    console.log(`  aset: ${total} panel judul`);
  }

  await browser.close();
}

/* ============================================================
   2. Susun tiap adegan menjadi klip mp4
   ============================================================ */
function buildScene(s, idx) {
  const dir = path.join(FRAMES, `scene-${s.id}`);
  const out = path.join(WORK, `clip-${s.id}.mp4`);

  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    // 0: latar
    '-loop', '1', '-framerate', String(FPS), '-i', path.join(WORK, 'bg.png'),
    // 1: badan ponsel (solid, di bawah layar)
    '-loop', '1', '-framerate', String(FPS), '-i', path.join(WORK, 'phone-body.png'),
    // 2: deret frame layar
    '-framerate', String(FPS), '-i', path.join(dir, 'frame-%04d.png'),
    // 3: mask sudut layar
    '-loop', '1', '-framerate', String(FPS), '-i', path.join(WORK, 'screen-mask.png'),
    // 4: lapisan atas ponsel (kamera, kilau tepi)
    '-loop', '1', '-framerate', String(FPS), '-i', path.join(WORK, 'phone-top.png'),
    // 5: panel judul
    '-loop', '1', '-framerate', String(FPS), '-i', path.join(WORK, `title-${s.id}.png`),
  ];

  /* Urutan penyusunan:
       latar -> badan ponsel -> layar (sudut dibulatkan via
       alphamerge) -> lapisan atas -> panel judul
     alphamerge memakai kanal luma mask sebagai alpha layar,
     sehingga sudut membulat tanpa perhitungan geq yang lambat. */
  const filter =
    `[0:v]scale=${OW}:${OH},format=yuv420p[bg];` +
    `[2:v]scale=${SCR_W}:${SCR_H}:flags=lanczos,format=rgba[scr0];` +
    `[3:v]scale=${SCR_W}:${SCR_H},format=gray[msk];` +
    `[scr0][msk]alphamerge[scr];` +
    `[bg][1:v]overlay=${PH_X}:${PH_Y}[a];` +
    `[a][scr]overlay=${SCR_X}:${SCR_Y}:shortest=1[b];` +
    `[b][4:v]overlay=${PH_X}:${PH_Y}[c];` +
    `[c][5:v]overlay=0:0,format=yuv420p[v]`;

  args.push(
    '-filter_complex', filter,
    '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-frames:v', String(s.frames),
    out
  );

  const r = spawnSync(FF, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 80 });
  if (r.status !== 0) {
    console.log(`  [GAGAL] scene-${s.id}:\n${(r.stderr || '').slice(-1400)}`);
    return null;
  }
  return out;
}

/* ============================================================
   3. Gabung semua klip dengan crossfade
   ============================================================ */
function concatClips(clips) {
  const XF = 0.45;
  const out = path.join(ROOT, 'ASTA-demo-android.mp4');

  const inputs = [];
  clips.forEach(c => inputs.push('-i', c));

  const parts = [];
  clips.forEach((_, i) => parts.push(`[${i}:v]setpts=PTS-STARTPTS,format=yuv420p[v${i}]`));

  let last = 'v0';
  let offset = man.scenes[0].seconds - XF;
  for (let i = 1; i < clips.length; i++) {
    const lbl = (i === clips.length - 1) ? 'vout' : `x${i}`;
    parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${XF}:offset=${offset.toFixed(3)}[${lbl}]`);
    last = lbl;
    offset += man.scenes[i].seconds - XF;
  }
  if (clips.length === 1) parts.push('[v0]null[vout]');

  const args = [
    '-y', '-hide_banner', '-loglevel', 'error', '-stats',
    ...inputs,
    '-filter_complex', parts.join(';'),
    '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
    '-movflags', '+faststart', '-r', String(FPS), '-an',
    out
  ];

  const r = spawnSync(FF, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 120 });
  if (r.status !== 0) {
    console.log('GAGAL menggabungkan:\n' + (r.stderr || '').slice(-2000));
    return null;
  }
  return out;
}

/* ============================================================
   Jalankan
   ============================================================ */
(async () => {
  console.log('Membuat aset...');
  await buildAssets();

  console.log(`\nMenyusun ${man.scenes.length} adegan...`);
  const clips = [];
  for (let i = 0; i < man.scenes.length; i++) {
    const s = man.scenes[i];
    const c = buildScene(s, i);
    if (!c) process.exit(1);
    const mb = (fs.statSync(c).size / 1024 / 1024).toFixed(1);
    clips.push(c);
    console.log(`  [ OK ] clip-${s.id}  ${s.seconds}s  ${mb} MB  ${s.title}`);
  }

  const totalRaw = man.scenes.reduce((a, s) => a + s.seconds, 0);
  const finalDur = totalRaw - 0.45 * (clips.length - 1);
  console.log(`\nMenggabungkan dengan crossfade -> ${finalDur.toFixed(1)}s...`);

  const out = concatClips(clips);
  if (!out) process.exit(1);

  const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
  console.log(`\nSelesai: ${path.basename(out)}  ${mb} MB`);
})();
