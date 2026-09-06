/* Pemeriksaan piksel: deteksi tangkapan kosong / gagal render.
   Metrik: nilai luma unik, simpangan baku, dan kerapatan tepi.
   Folder ditentukan lewat argumen; bawaan screenshots/. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', process.argv[2] || 'screenshots');
const FF = 'C:\\Users\\mosto\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe';
const W = 700;

const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
let fail = 0;

console.log(`Folder: ${path.basename(dir)}  (${files.length} berkas)`);
console.log('berkas'.padEnd(40) + 'unik'.padStart(6) + 's.baku'.padStart(9) + 'tepi/1k'.padStart(10) + '   hasil');
console.log('-'.repeat(76));

for (const f of files) {
  const raw = execFileSync(FF, [
    '-v', 'error', '-i', path.join(dir, f),
    '-vf', `scale=${W}:-1`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-'
  ], { maxBuffer: 1024 * 1024 * 400 });

  const n = raw.length;
  if (!n) { console.log(`${f.padEnd(40)}  gagal dibaca`); fail++; continue; }
  const H = Math.floor(n / W);

  const hist = new Array(256).fill(0);
  let sum = 0;
  for (let i = 0; i < n; i++) { hist[raw[i]]++; sum += raw[i]; }
  const mean = sum / n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (raw[i] - mean) ** 2;
  const sd = Math.sqrt(v / n);
  const unique = hist.filter(x => x > 0).length;

  let edges = 0, checked = 0;
  for (let y = 0; y < H; y += 2) {
    const row = y * W;
    for (let x = 1; x < W; x++) {
      if (Math.abs(raw[row + x] - raw[row + x - 1]) > 18) edges++;
      checked++;
    }
  }
  const edgePerK = (edges / checked) * 1000;

  const ok = unique >= 40 && sd >= 8 && edgePerK >= 3;
  if (!ok) fail++;
  console.log(f.padEnd(40) + String(unique).padStart(6) + sd.toFixed(1).padStart(9) +
    edgePerK.toFixed(1).padStart(10) + '   ' + (ok ? 'OK' : 'CURIGA'));
}

console.log('-'.repeat(76));
console.log(fail ? `${fail} berkas perlu ditinjau.` : `${files.length} berkas semuanya berisi konten.`);
process.exit(fail ? 1 : 0);
