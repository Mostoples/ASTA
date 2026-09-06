/* ============================================================
   Render final ASTA — kualitas tinggi + transisi
   ------------------------------------------------------------
   `capcut render` menghasilkan proxy preview (CRF 28, tanpa
   compositing transisi). Untuk demo penelitian, teks antarmuka
   harus tajam, jadi render final dibuat langsung dengan ffmpeg
   memakai timeline yang sama dari proyek CapCut:
     - CRF 18 agar teks tetap terbaca
     - xfade antar adegan (transisi nyata, bukan potong keras)
     - gerak Ken Burns halus agar tidak terasa statis
   ============================================================ */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRAMES = path.join(ROOT, 'video-frames');
const PROJ = path.join(ROOT, 'capcut-project');
const FF = 'C:\\Users\\mosto\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe';

const W = 1080, H = 1920, FPS = 30;
const XFADE = 0.5;          // durasi transisi antar adegan

/* Ambil timeline dari proyek CapCut agar dua keluaran konsisten */
function capcutJson(args) {
  const quoted = args.map(a => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ');
  const out = execFileSync('cmd', ['/c', `capcut ${quoted} 2>&1`],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 60 });
  return JSON.parse(out);
}

let segs;
try {
  const p = capcutJson(['segments', PROJ, '--track', 'video']);
  segs = (Array.isArray(p) ? p : (p.segments || p.items || []));
} catch (e) {
  console.log('Tidak dapat membaca timeline CapCut, memakai scenes.json.');
  segs = null;
}

const scenes = JSON.parse(fs.readFileSync(path.join(FRAMES, 'scenes.json'), 'utf8'));

// Bangun daftar {file, duration} dari timeline CapCut bila tersedia
let clips;
if (segs && segs.length === scenes.length) {
  clips = segs.map((s, i) => {
    const us = s.duration_us ?? s.duration ?? null;
    const dur = us ? (us > 10000 ? us / 1e6 : us) : (i === 0 ? 4.5 : i === scenes.length - 1 ? 5.5 : 4);
    return { file: path.join(FRAMES, scenes[i].file), duration: Number(dur.toFixed(3)) };
  });
} else {
  clips = scenes.map((s, i) => ({
    file: path.join(FRAMES, s.file),
    duration: i === 0 ? 4.5 : i === scenes.length - 1 ? 5.5 : 4
  }));
}

console.log(`${clips.length} adegan, total ${clips.reduce((a, c) => a + c.duration, 0).toFixed(1)}s sebelum transisi`);

/* ---------- Bangun filter graph ---------- */
const inputs = [];
clips.forEach(c => {
  inputs.push('-loop', '1', '-t', String(c.duration + XFADE), '-i', c.file);
});

const parts = [];
clips.forEach((c, i) => {
  // Ken Burns lembut: zoom sangat halus supaya terasa hidup tanpa mengganggu
  const zTo = 1.04;
  const frames = Math.round((c.duration + XFADE) * FPS);
  parts.push(
    `[${i}:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=decrease,` +
    `pad=${W * 2}:${H * 2}:(ow-iw)/2:(oh-ih)/2,` +
    `zoompan=z='min(zoom+${((zTo - 1) / frames).toFixed(7)},${zTo})':` +
    `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},` +
    `setsar=1,format=yuv420p[v${i}]`
  );
});

// Rangkai xfade berantai
let last = 'v0';
let offset = clips[0].duration;
for (let i = 1; i < clips.length; i++) {
  const out = (i === clips.length - 1) ? 'vout' : `x${i}`;
  parts.push(
    `[${last}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[${out}]`
  );
  last = out;
  offset += clips[i].duration;
}
if (clips.length === 1) parts.push('[v0]null[vout]');

const filter = parts.join(';');
const totalDur = offset;

const out = path.join(ROOT, 'ASTA-demo-portrait.mp4');
const args = [
  '-y', '-hide_banner', '-loglevel', 'error', '-stats',
  ...inputs,
  '-filter_complex', filter,
  '-map', '[vout]',
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '18',                 // teks antarmuka tetap tajam
  '-pix_fmt', 'yuv420p',
  '-profile:v', 'high',
  '-level', '4.1',
  '-movflags', '+faststart',    // siap diputar langsung dari web
  '-r', String(FPS),
  '-t', totalDur.toFixed(3),
  '-an',
  out
];

console.log(`\nMerender ${totalDur.toFixed(1)}s pada CRF 18 dengan transisi fade ${XFADE}s...`);
const r = spawnSync(FF, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 80 });

if (r.status !== 0) {
  console.log('GAGAL:\n' + (r.stderr || '').slice(-2500));
  process.exit(1);
}

const size = fs.statSync(out).size;
console.log(`\nSelesai: ${path.basename(out)}  ${(size / 1024 / 1024).toFixed(1)} MB`);
