/* ============================================================
   ASTA — Perakit video showreel
   ------------------------------------------------------------
   Mengubah frame hasil record.js menjadi satu berkas MP4 1920x1080.

   Dua tahap, sengaja dipisah supaya kegagalan mudah dilacak:
     1. Tiap segmen (adegan atau kartu) dirender menjadi klip
        H.264 tersendiri di video-showreel-clips/<varian>/
     2. Seluruh klip disambung dengan transisi silang (xfade)

   Klip per segmen juga dipakai proyek CapCut, sehingga timeline
   di CapCut identik dengan video final.

   Jalankan:
     node tools/showreel/build.js --variant desktop
     node tools/showreel/build.js --variant android
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const FPS = 30;
const XF = 0.45;          // lama transisi silang antar segmen (detik)

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

/* ffmpeg dicari di PATH lebih dulu, lalu di lokasi pemasangan WinGet. */
function ffmpegPath() {
  const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (!probe.error) return 'ffmpeg';
  const winget = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet',
    'Packages');
  if (fs.existsSync(winget)) {
    for (const d of fs.readdirSync(winget)) {
      if (!/Gyan\.FFmpeg/i.test(d)) continue;
      const base = path.join(winget, d);
      for (const sub of fs.readdirSync(base)) {
        const exe = path.join(base, sub, 'bin', 'ffmpeg.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  throw new Error('ffmpeg tidak ditemukan');
}

const FF = ffmpegPath();

function run(args, label) {
  const r = spawnSync(FF, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 120 });
  if (r.status !== 0) {
    const err = String(r.stderr || '').trim().split('\n').slice(-12).join('\n');
    throw new Error(`ffmpeg gagal pada ${label}:\n${err}`);
  }
  return r;
}

function probeDuration(file) {
  const r = spawnSync(FF, ['-i', file], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(String(r.stderr || ''));
  if (!m) return null;
  return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
}

(async () => {
  const variant = arg('variant', 'desktop') === 'android' ? 'android' : 'desktop';
  const SRC = path.join(ROOT, 'video-showreel', variant);
  const CLIPS = path.join(ROOT, 'video-showreel-clips', variant);
  const OUT = path.join(ROOT, `ASTA-showreel-${variant}-1080p.mp4`);

  const man = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));

  fs.rmSync(CLIPS, { recursive: true, force: true });
  fs.mkdirSync(CLIPS, { recursive: true });

  /* ---------- Tahap 1: klip per segmen ---------- */
  const clips = [];
  for (const seg of man.scenes) {
    const out = path.join(CLIPS, seg.id + '.mp4');

    if (seg.kind === 'card') {
      // Kartu diam: satu gambar ditahan, dengan muncul & pudar lembut
      const still = path.join(SRC, seg.id, 'still.jpg');
      run(['-y', '-loop', '1', '-framerate', String(FPS), '-i', still,
        '-t', String(seg.sec),
        '-vf', `fade=t=in:st=0:d=0.5,fade=t=out:st=${(seg.sec - 0.5).toFixed(2)}:d=0.5,` +
               'scale=in_range=full:out_range=limited,format=yuv420p',
        '-color_range', 'tv',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
        '-r', String(FPS), out], seg.id);
    } else {
      run(['-y', '-framerate', String(FPS),
        '-i', path.join(SRC, 'scene-' + seg.id, 'f-%04d.jpg'),
        '-vf', 'scale=in_range=full:out_range=limited,format=yuv420p',
        '-color_range', 'tv',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
        '-r', String(FPS), out], seg.id);
    }

    const d = probeDuration(out);
    clips.push({ id: seg.id, file: out, sec: d || seg.sec, title: seg.title || seg.id });
    console.log(`  klip ${String(seg.id).padEnd(12)} ${(d || seg.sec).toFixed(2)}s`);
  }

  /* ---------- Tahap 2: sambung dengan transisi silang ----------
     Tiap xfade memangkas XF detik dari total, jadi offset ke-k adalah
     jumlah durasi sampai klip ke-k dikurangi (k+1) x XF. */
  const inputs = [];
  clips.forEach(c => inputs.push('-i', c.file));

  let filter = '';
  let prev = '0:v';
  let acc = clips[0].sec;
  for (let i = 1; i < clips.length; i++) {
    const off = (acc - XF).toFixed(3);
    const label = i === clips.length - 1 ? 'vout' : `v${i}`;
    filter += `[${prev}][${i}:v]xfade=transition=fade:duration=${XF}:offset=${off}[${label}];`;
    prev = label;
    acc = acc + clips[i].sec - XF;
  }
  filter = filter.replace(/;$/, '');

  const total = acc;
  console.log(`\nmenyambung ${clips.length} klip -> ${total.toFixed(1)} detik`);

  run(['-y', ...inputs,
    '-filter_complex', filter,
    '-map', `[${prev}]`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-profile:v', 'high', '-level', '4.1',
    // faststart: video dapat mulai diputar sebelum seluruh berkas terunduh
    '-movflags', '+faststart',
    '-r', String(FPS), OUT], 'sambung');

  const size = fs.statSync(OUT).size / 1e6;
  const dur = probeDuration(OUT);
  console.log(`\n${path.basename(OUT)}  ${dur ? dur.toFixed(1) + 's' : '?'}  ` +
    `${size.toFixed(1)} MB`);
})();
