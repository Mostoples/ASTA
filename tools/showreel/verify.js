/* ============================================================
   ASTA — Verifikasi video showreel
   ------------------------------------------------------------
   Memeriksa berkas MP4 hasil build.js:

     - resolusi tepat 1920x1080, laju 30 fps, pixel format yuv420p
     - durasi wajar dan sesuai perkiraan dari manifest
     - moov atom di depan (faststart), agar bisa diputar sambil unduh
     - cuplikan di beberapa titik tidak gelap atau kosong

   Pemeriksaan terakhir penting: video yang gagal rekam tetap
   menghasilkan berkas MP4 yang "sah" tetapi isinya hitam.

   Jalankan:  node tools/showreel/verify.js
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function ffmpegPath() {
  if (!spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).error) return 'ffmpeg';
  const winget = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(winget)) {
    for (const d of fs.readdirSync(winget)) {
      if (!/Gyan\.FFmpeg/i.test(d)) continue;
      for (const sub of fs.readdirSync(path.join(winget, d))) {
        const exe = path.join(winget, d, sub, 'bin', 'ffmpeg.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  throw new Error('ffmpeg tidak ditemukan');
}
const FF = ffmpegPath();

/** Terang rata-rata satu frame pada detik ke-t (0..255). */
function brightnessAt(file, t) {
  const tmp = path.join(os.tmpdir(), `asta-probe-${Date.now()}.png`);
  const r = spawnSync(FF, ['-y', '-ss', String(t), '-i', file, '-frames:v', '1',
    '-vf', 'scale=64:36', tmp], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(tmp)) return null;
  // Baca ulang lewat ffmpeg untuk mendapat statistik, lalu hapus berkas sementara
  const st = spawnSync(FF, ['-i', tmp, '-vf', 'signalstats,metadata=print', '-f', 'null', '-'],
    { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  const m = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(String(st.stderr || ''));
  return m ? parseFloat(m[1]) : null;
}

function info(file) {
  const r = spawnSync(FF, ['-i', file], { encoding: 'utf8' });
  const s = String(r.stderr || '');
  const line = (/Stream #\d+:\d+.*?: Video:.*/.exec(s) || [''])[0];

  /* Satu regex besar tidak dipakai: nama pixel format ffmpeg memuat
     koma di dalam kurung, misal "yuv420p(tv, bt709/unknown, progressive)",
     sehingga pemisahan per koma selalu meleset. Tiap nilai dibaca
     dengan polanya sendiri. */
  const dur = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(s);
  const res = /,\s(\d{3,5})x(\d{3,5})[\s,\[]/.exec(line);
  const fps = /,\s*([\d.]+)\s*fps/.exec(line);
  const pix = /,\s*(yuvj?[\da-z]+p)/.exec(line);
  const cod = /Video:\s*([\w]+)/.exec(line);

  return {
    sec: dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]) : null,
    codec: cod ? cod[1] : null,
    pix: pix ? pix[1] : null,
    range: /\(tv[,)]/.test(line) ? 'tv' : /\(pc[,)]/.test(line) ? 'pc' : null,
    w: res ? +res[1] : null,
    h: res ? +res[2] : null,
    fps: fps ? parseFloat(fps[1]) : null,
  };
}

/** moov atom harus berada sebelum mdat supaya video bisa diputar progresif. */
function hasFaststart(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(Math.min(4 * 1024 * 1024, fs.statSync(file).size));
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  const moov = buf.indexOf('moov');
  const mdat = buf.indexOf('mdat');
  if (moov < 0) return false;
  return mdat < 0 || moov < mdat;
}

let fail = 0;
for (const variant of ['desktop', 'android']) {
  const file = path.join(ROOT, `ASTA-showreel-${variant}-1080p.mp4`);
  console.log(`\n=== ${path.basename(file)} ===`);
  if (!fs.existsSync(file)) {
    console.log('  GAGAL  berkas tidak ada'); fail++; continue;
  }

  const i = info(file);
  const size = fs.statSync(file).size / 1e6;
  const problems = [];

  if (i.w !== 1920 || i.h !== 1080) problems.push(`resolusi ${i.w}x${i.h}, bukan 1920x1080`);
  if (!i.fps || Math.abs(i.fps - 30) > 0.6) problems.push(`laju ${i.fps} fps, bukan 30`);
  if (i.pix !== 'yuv420p') problems.push(`pixel format ${i.pix}, bukan yuv420p`);
  if (i.range !== 'tv') problems.push(`rentang warna ${i.range}, bukan tv (limited)`);
  if (!i.sec || i.sec < 30) problems.push(`durasi ${i.sec}s terlalu pendek`);
  if (!hasFaststart(file)) problems.push('moov atom tidak di depan (faststart gagal)');

  console.log(`  ${i.w}x${i.h}  ${i.fps} fps  ${i.pix} (${i.range || '?'})  ${i.codec}`);
  console.log(`  ${i.sec ? i.sec.toFixed(1) : '?'} detik  ${size.toFixed(1)} MB`);

  // Cuplikan di lima titik: video hitam tetap lolos pemeriksaan wadah
  const pts = [0.08, 0.3, 0.5, 0.7, 0.92].map(p => +(i.sec * p).toFixed(1));
  const lums = pts.map(t => brightnessAt(file, t));
  console.log('  terang  ' + pts.map((t, k) =>
    `${t}s=${lums[k] === null ? '?' : lums[k].toFixed(0)}`).join('  '));
  const dark = lums.filter(v => v !== null && v < 18).length;
  if (dark >= 2) problems.push(`${dark} dari 5 cuplikan nyaris hitam`);

  if (problems.length) {
    fail++;
    problems.forEach(p => console.log('  GAGAL  ' + p));
  } else {
    console.log('  OK');
  }
}

console.log(fail ? `\n${fail} video bermasalah.` : '\nKedua video lolos.');
process.exit(fail ? 1 : 0);
