/* ============================================================
   Membangun proyek CapCut ASTA dari frame portrait
   ------------------------------------------------------------
   Menghasilkan spec JSON deklaratif lalu memanggil
   `capcut compile`. Proyek dapat dibuka dan diedit lanjut di
   aplikasi CapCut, dan pratinjau dapat dirender via
   `capcut render`.
   ============================================================ */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRAMES = path.join(ROOT, 'video-frames');
const SPEC = path.join(__dirname, 'asta-video-spec.json');

const scenes = JSON.parse(fs.readFileSync(path.join(FRAMES, 'scenes.json'), 'utf8'));

// Durasi per adegan: pembuka & penutup lebih lama, isi 4 detik
function durationFor(s, i, total) {
  if (i === 0) return 4.5;
  if (i === total - 1) return 5.5;
  return 4;
}

const videoItems = [];
const textItems = [];
let t = 0;

scenes.forEach((s, i) => {
  const dur = durationFor(s, i, scenes.length);
  videoItems.push({
    // Path relatif terhadap berkas spec
    path: path.relative(path.dirname(SPEC), path.join(FRAMES, s.file)).replace(/\\/g, '/'),
    start: Number(t.toFixed(3)),
    duration: dur,
    width: 1080,
    height: 1920,
  });
  t += dur;
});

const totalDur = t;

const spec = {
  name: 'ASTA Telerehabilitasi Portrait',
  ratio: '9:16',
  width: 1080,
  height: 1920,
  fps: 30,
  tracks: [
    { type: 'video', name: 'tampilan', items: videoItems },
  ],
};

fs.writeFileSync(SPEC, JSON.stringify(spec, null, 2), 'utf8');
console.log(`Spec ditulis: ${path.basename(SPEC)}`);
console.log(`  ${videoItems.length} adegan, total ${totalDur.toFixed(1)} detik`);

/* ---------- Validasi dulu, baru tulis ---------- */
function capcut(args, label) {
  // capcut adalah shim .ps1 di Windows, jadi dipanggil lewat cmd
  // dengan stderr digabung agar pesan galat maupun keluaran sukses tertangkap.
  const quoted = args.map(a => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ');
  try {
    const out = execFileSync('cmd', ['/c', `capcut ${quoted} 2>&1`],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 60 });
    const s = String(out || '').trim();
    if (/"error"\s*:/.test(s)) {
      console.log(`  [gagal] ${label}: ${s.slice(0, 600)}`);
      return { ok: false, out: s };
    }
    return { ok: true, out: s };
  } catch (e) {
    const msg = (String(e.stdout || '') + String(e.stderr || '')).trim();
    console.log(`  [gagal] ${label}: ${msg.slice(0, 600) || 'tanpa pesan'}`);
    return { ok: false, out: msg };
  }
}

console.log('\nMemvalidasi spec...');
const check = capcut(['compile', SPEC, '--check'], 'check');
if (!check.ok) process.exit(1);
console.log('  valid: ' + check.out.trim().slice(0, 220));

console.log('\nMembangun draft CapCut...');
const outDir = path.join(ROOT, 'capcut-project');
if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });

const build = capcut(['compile', SPEC, '--out', outDir], 'compile');
if (!build.ok) process.exit(1);
console.log('  ' + build.out.trim().slice(0, 400));

console.log('\nMemeriksa hasil (lint)...');
const lint = capcut(['lint', outDir, '-H'], 'lint');
console.log('  ' + (lint.out || '').trim().slice(0, 600));

console.log('\nRingkasan proyek:');
const info = capcut(['info', outDir, '-H'], 'info');
console.log((info.out || '').trim().slice(0, 900));
