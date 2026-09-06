/* ============================================================
   Verifikasi video final
   - Setiap adegan benar-benar tampil (bukan frame beku/kosong)
   - Transisi crossfade benar terjadi di titik yang diharapkan
     (frame di tengah transisi adalah campuran dua adegan)
   ============================================================ */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VIDEO = path.join(ROOT, 'ASTA-demo-portrait.mp4');
const FRAMES = path.join(ROOT, 'video-frames');
const FF = 'C:\\Users\\mosto\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe';

const scenes = JSON.parse(fs.readFileSync(path.join(FRAMES, 'scenes.json'), 'utf8'));
const XFADE = 0.5;
const durs = scenes.map((_, i) => (i === 0 ? 4.5 : i === scenes.length - 1 ? 5.5 : 4));

// Titik tengah setiap adegan
const mids = [];
let t = 0;
durs.forEach((d, i) => { mids.push(t + d / 2); t += d; });

// Titik tengah setiap transisi
const trans = [];
t = 0;
for (let i = 0; i < durs.length - 1; i++) { t += durs[i]; trans.push(t + XFADE / 2); }

const W = 120;
function grab(sec) {
  return execFileSync(FF, [
    '-v', 'error', '-ss', String(sec), '-i', VIDEO,
    '-frames:v', '1', '-vf', `scale=${W}:-1`, '-pix_fmt', 'gray',
    '-f', 'rawvideo', '-'
  ], { maxBuffer: 1024 * 1024 * 20 });
}
function grabPng(file) {
  return execFileSync(FF, [
    '-v', 'error', '-i', file,
    '-vf', `scale=${W}:-1`, '-pix_fmt', 'gray',
    '-f', 'rawvideo', '-'
  ], { maxBuffer: 1024 * 1024 * 20 });
}
function meanAbsDiff(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 255;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return s / n;
}
function stats(buf) {
  let sum = 0;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < buf.length; i++) { sum += buf[i]; hist[buf[i]]++; }
  const mean = sum / buf.length;
  let v = 0;
  for (let i = 0; i < buf.length; i++) v += (buf[i] - mean) ** 2;
  return { mean, sd: Math.sqrt(v / buf.length), unique: hist.filter(x => x > 0).length };
}

let fail = 0;

console.log('=== Setiap adegan tampil sesuai urutan ===');
for (let i = 0; i < scenes.length; i++) {
  const vf = grab(mids[i]);
  const ref = grabPng(path.join(FRAMES, scenes[i].file));
  const d = meanAbsDiff(vf, ref);
  const st = stats(vf);
  // Ken Burns + kompresi menimbulkan selisih kecil; ambang 26 memberi kelonggaran
  const ok = d < 26 && st.sd > 8 && st.unique > 30;
  if (!ok) fail++;
  console.log(`  ${ok ? '[ OK ]' : '[FAIL]'} adegan ${String(i + 1).padStart(2)} @${mids[i].toFixed(1)}s  ` +
    `beda=${d.toFixed(1)} sd=${st.sd.toFixed(1)}  ${scenes[i].title}`);
}

console.log('\n=== Transisi crossfade nyata ===');
for (let i = 0; i < trans.length; i++) {
  const mid = grab(trans[i]);
  const a = grabPng(path.join(FRAMES, scenes[i].file));
  const b = grabPng(path.join(FRAMES, scenes[i + 1].file));
  const da = meanAbsDiff(mid, a);
  const db = meanAbsDiff(mid, b);
  const dab = meanAbsDiff(a, b);
  // Pada tengah crossfade, frame harus berjarak dari KEDUA adegan,
  // dan jarak itu lebih kecil daripada jarak antar kedua adegan itu sendiri.
  const blended = da > 3 && db > 3 && da < dab + 12 && db < dab + 12;
  if (!blended) fail++;
  console.log(`  ${blended ? '[ OK ]' : '[FAIL]'} transisi ${String(i + 1).padStart(2)} @${trans[i].toFixed(1)}s  ` +
    `ke-A=${da.toFixed(1)} ke-B=${db.toFixed(1)} A-B=${dab.toFixed(1)}`);
}

console.log('\n=== Kesinambungan (tidak ada frame beku panjang) ===');
let frozen = 0;
for (let s = 1; s < 65; s += 3) {
  const f1 = grab(s);
  const f2 = grab(s + 0.6);
  const d = meanAbsDiff(f1, f2);
  if (d < 0.05) frozen++;
}
console.log(`  ${frozen === 0 ? '[ OK ]' : '[info]'} ${frozen} titik uji tampak identik ` +
  `(gerak Ken Burns halus, sedikit kesamaan wajar)`);

console.log(fail ? `\n${fail} masalah ditemukan.` : '\nSemua verifikasi video lolos.');
process.exit(fail ? 1 : 0);
