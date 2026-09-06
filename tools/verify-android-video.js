/* ============================================================
   Verifikasi video mockup Android
   1. Layar ponsel benar-benar terender (bukan gelap/kosong)
   2. Area layar cocok dengan frame sumbernya
   3. Scroll terlihat bergerak di dalam mockup
   4. Panel judul tampil
   ============================================================ */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VIDEO = path.join(ROOT, 'ASTA-demo-android.mp4');
const FRAMES = path.join(ROOT, 'video-android');
const FF = 'C:\\Users\\mosto\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe';

const man = JSON.parse(fs.readFileSync(path.join(FRAMES, 'manifest.json'), 'utf8'));
const XF = 0.45;

// Geometri harus sama dengan compose-android-video.js
const OW = 1080, OH = 1920;
const PH_SCALE = 1.62;
const SCR_W = Math.round(393 * PH_SCALE);
const SCR_H = Math.round(830 * PH_SCALE);
const BEZEL = 20;
const PH_W = SCR_W + BEZEL * 2;
const PH_X = Math.round((OW - PH_W) / 2);
const PH_Y = 452;
const SCR_X = PH_X + BEZEL;
const SCR_Y = PH_Y + BEZEL;

let fail = 0;
function check(n, ok, d) {
  if (ok) console.log(`  [ OK ] ${n}${d ? '  ' + d : ''}`);
  else { console.log(`  [FAIL] ${n}${d ? ' — ' + d : ''}`); fail++; }
}

/** Ambil crop area layar dari video pada detik tertentu, sebagai grayscale */
function cropScreen(sec, w) {
  const scale = w || 100;
  return execFileSync(FF, [
    '-v', 'error', '-ss', String(sec), '-i', VIDEO, '-frames:v', '1',
    '-vf', `crop=${SCR_W}:${SCR_H}:${SCR_X}:${SCR_Y},scale=${scale}:-1`,
    '-pix_fmt', 'gray', '-f', 'rawvideo', '-'
  ], { maxBuffer: 1024 * 1024 * 40 });
}
/** Ambil crop area panel judul */
function cropTitle(sec, w) {
  const scale = w || 100;
  return execFileSync(FF, [
    '-v', 'error', '-ss', String(sec), '-i', VIDEO, '-frames:v', '1',
    '-vf', `crop=${OW}:${PH_Y}:0:0,scale=${scale}:-1`,
    '-pix_fmt', 'gray', '-f', 'rawvideo', '-'
  ], { maxBuffer: 1024 * 1024 * 40 });
}
function pngGray(file, w) {
  return execFileSync(FF, [
    '-v', 'error', '-i', file, '-vf', `scale=${w || 100}:-1`,
    '-pix_fmt', 'gray', '-f', 'rawvideo', '-'
  ], { maxBuffer: 1024 * 1024 * 40 });
}
function stats(b) {
  let s = 0; const h = new Array(256).fill(0);
  for (let i = 0; i < b.length; i++) { s += b[i]; h[b[i]]++; }
  const m = s / b.length;
  let v = 0;
  for (let i = 0; i < b.length; i++) v += (b[i] - m) ** 2;
  return { mean: m, sd: Math.sqrt(v / b.length), unique: h.filter(x => x > 0).length };
}
function mad(a, b) {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return n ? s / n : 255;
}

/* ---------- Hitung titik tengah tiap adegan pada timeline ---------- */
const mids = [];
let t = 0;
man.scenes.forEach((s, i) => {
  const start = t;
  const dur = s.seconds;
  mids.push({ id: s.id, title: s.title, action: s.action, mid: start + dur / 2, start, dur });
  t += dur - XF;
});

console.log('=== 1. Layar ponsel terender ===');
for (const m of mids) {
  const b = cropScreen(m.mid);
  const st = stats(b);
  // Layar ASTA terang (latar biru-putih). Ceruk kosong akan gelap (<40).
  const ok = st.mean > 120 && st.sd > 10 && st.unique > 40;
  check(`adegan ${m.id} @${m.mid.toFixed(1)}s`, ok,
    `luma=${st.mean.toFixed(0)} sd=${st.sd.toFixed(0)} unik=${st.unique}  ${m.title}`);
}

console.log('\n=== 2. Layar cocok dengan frame sumber ===');
for (const m of mids) {
  const dir = path.join(FRAMES, `scene-${m.id}`);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
  const midIdx = Math.floor(files.length / 2);
  const src = pngGray(path.join(dir, files[midIdx]));
  const vid = cropScreen(m.mid);
  const d = mad(src, vid);
  // Toleransi: penskalaan + kompresi + waktu tidak persis sama
  const ok = d < 34;
  check(`adegan ${m.id}`, ok, `beda=${d.toFixed(1)}  ${m.title}`);
}

console.log('\n=== 3. Scroll bergerak di dalam mockup ===');
for (const m of mids) {
  if (m.action !== 'scroll' && m.action !== 'scrollTo') continue;
  const a = cropScreen(m.start + m.dur * 0.2);
  const b = cropScreen(m.start + m.dur * 0.85);
  const d = mad(a, b);
  const ok = d > 5;
  check(`adegan ${m.id} (${m.action})`, ok, `beda=${d.toFixed(1)}  ${m.title}`);
}

console.log('\n=== 4. Panel judul tampil ===');
for (const m of mids) {
  const b = cropTitle(m.mid);
  const st = stats(b);
  // Panel judul: teks terang di latar biru gelap -> perlu kontras
  const ok = st.sd > 14 && st.unique > 30;
  check(`adegan ${m.id}`, ok, `sd=${st.sd.toFixed(0)} unik=${st.unique}`);
}

/* ---------- Properti berkas ---------- */
console.log('\n=== 5. Properti video ===');
const probe = execFileSync(FF.replace('ffmpeg.exe', 'ffprobe.exe'), [
  '-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height,r_frame_rate,nb_frames,codec_name',
  '-show_entries', 'format=duration,size,bit_rate',
  '-of', 'default=noprint_wrappers=1', VIDEO
], { encoding: 'utf8' });
const p = {};
probe.trim().split(/\r?\n/).forEach(l => {
  const [k, v] = l.split('=');
  p[k] = v;
});
console.log(`  ${p.codec_name} ${p.width}x${p.height} @${p.r_frame_rate} · ` +
  `${Number(p.duration).toFixed(1)}s · ${(Number(p.size) / 1024 / 1024).toFixed(1)} MB · ` +
  `${Math.round(Number(p.bit_rate) / 1000)} kbps`);
check('Resolusi 1080x1920 portrait', p.width === '1080' && p.height === '1920');
check('Bitrate memadai untuk teks tajam', Number(p.bit_rate) > 1200000,
  `${Math.round(Number(p.bit_rate) / 1000)} kbps`);
check('Durasi sesuai rencana', Math.abs(Number(p.duration) - 129.1) < 3,
  `${Number(p.duration).toFixed(1)}s`);

console.log(fail ? `\n${fail} masalah ditemukan.` : '\nSemua verifikasi video Android lolos.');
process.exit(fail ? 1 : 0);
