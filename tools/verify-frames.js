/* ============================================================
   Verifikasi frame rekaman
   - Adegan scroll benar-benar bergerak (bukan frame beku)
   - Adegan live menunjukkan perubahan (grafik EMG hidup)
   - Tidak ada frame kosong
   ============================================================ */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'video-android');
const FF = 'C:\\Users\\mosto\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe';

const man = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
const W = 120;

function gray(file) {
  return execFileSync(FF, [
    '-v', 'error', '-i', file, '-vf', `scale=${W}:-1`,
    '-pix_fmt', 'gray', '-f', 'rawvideo', '-'
  ], { maxBuffer: 1024 * 1024 * 30 });
}
function mad(a, b) {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return n ? s / n : 255;
}
function sd(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i];
  const m = sum / buf.length;
  let v = 0;
  for (let i = 0; i < buf.length; i++) v += (buf[i] - m) ** 2;
  return Math.sqrt(v / buf.length);
}

let fail = 0;
console.log('adegan  aksi        frame  beda-total  beda-maks  sd    hasil   judul');
console.log('-'.repeat(96));

for (const s of man.scenes) {
  const dir = path.join(OUT, `scene-${s.id}`);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
  if (!files.length) { console.log(`${s.id}  tidak ada frame`); fail++; continue; }

  // Ambil 6 titik uji merata sepanjang adegan
  const picks = [];
  for (let k = 0; k < 6; k++) {
    picks.push(files[Math.min(files.length - 1, Math.round((files.length - 1) * k / 5))]);
  }
  const bufs = picks.map(f => gray(path.join(dir, f)));

  // Beda antara frame pertama dan terakhir
  const totalDiff = mad(bufs[0], bufs[bufs.length - 1]);
  // Beda terbesar antar frame berurutan
  let maxStep = 0;
  for (let i = 1; i < bufs.length; i++) maxStep = Math.max(maxStep, mad(bufs[i - 1], bufs[i]));
  const contrast = sd(bufs[0]);

  // Kriteria berbeda per jenis aksi
  let ok, note = '';
  if (s.action === 'scroll' || s.action === 'scrollTo') {
    ok = totalDiff > 6 && contrast > 8;
    if (!ok) note = 'scroll tidak terlihat bergerak';
  } else if (s.action === 'live') {
    ok = maxStep > 0.3 && contrast > 8;
    if (!ok) note = 'tidak ada perubahan langsung';
  } else if (s.action === 'tapTabbar') {
    ok = maxStep > 0.05 && contrast > 8;
    if (!ok) note = 'sorotan navigasi tidak terlihat';
  } else {
    ok = contrast > 8;
    if (!ok) note = 'frame tampak kosong';
  }
  if (!ok) fail++;

  console.log(
    `${s.id.padEnd(7)} ${s.action.padEnd(11)} ${String(s.frames).padStart(4)}  ` +
    `${totalDiff.toFixed(2).padStart(9)}  ${maxStep.toFixed(2).padStart(8)}  ` +
    `${contrast.toFixed(0).padStart(4)}  ${(ok ? 'OK' : 'GAGAL').padEnd(6)}  ${s.title}` +
    (note ? `  <- ${note}` : '')
  );
}

console.log('-'.repeat(96));
console.log(`Total ${man.totalFrames} frame, ${man.totalSeconds}s`);
console.log(fail ? `${fail} adegan bermasalah.` : 'Semua adegan terverifikasi bergerak & berisi.');
process.exit(fail ? 1 : 0);
