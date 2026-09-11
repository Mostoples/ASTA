/* ============================================================
   ASTA — Proyek CapCut dari klip showreel
   ------------------------------------------------------------
   Klip per segmen sudah dirakit build.js lengkap dengan mockup,
   judul, dan gerak gulir. Proyek CapCut memakai klip-klip itu
   apa adanya, sehingga timeline di CapCut identik dengan video
   final dan tetap bisa diedit lanjut (ganti musik, potong, dsb).

   Jalankan setelah build.js:
     node tools/showreel/capcut.js --variant desktop
     node tools/showreel/capcut.js --variant android
   ============================================================ */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

/* capcut-cli mengembalikan JSON; kegagalan ditandai kunci "error". */
function capcut(args, label) {
  const q = args.map(a => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ');
  try {
    const out = execFileSync('cmd', ['/c', `capcut ${q} 2>&1`],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 60 });
    const s = String(out || '').trim();
    if (/"error"\s*:/.test(s)) {
      console.log(`  [gagal] ${label}: ${s.slice(0, 300)}`);
      return { ok: false, out: s };
    }
    return { ok: true, out: s };
  } catch (e) {
    const m = (String(e.stdout || '') + String(e.stderr || '')).trim();
    console.log(`  [gagal] ${label}: ${m.slice(0, 300) || 'tanpa pesan'}`);
    return { ok: false, out: m };
  }
}

const variant = arg('variant', 'desktop') === 'android' ? 'android' : 'desktop';
const SRC = path.join(ROOT, 'video-showreel', variant);
const CLIPS = path.join(ROOT, 'video-showreel-clips', variant);
const SPEC = path.join(__dirname, `spec-${variant}.json`);
const PROJ = path.join(ROOT, 'capcut-showreel-' + variant);

const man = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));

/* ---------- Susun daftar segmen ---------- */
const items = [];
let t = 0;
for (const seg of man.scenes) {
  const file = path.join(CLIPS, seg.id + '.mp4');
  if (!fs.existsSync(file)) {
    console.log(`  ! klip tidak ada: ${seg.id}.mp4`);
    continue;
  }
  items.push({
    path: path.relative(path.dirname(SPEC), file).replace(/\\/g, '/'),
    start: Number(t.toFixed(3)),
    duration: seg.sec,
    width: man.w,
    height: man.h,
  });
  t += seg.sec;
}

console.log(`${items.length} klip · ${t.toFixed(1)} detik sebelum transisi`);

const spec = {
  name: `ASTA Showreel ${variant === 'android' ? 'Android' : 'Desktop'} 1080p`,
  ratio: '16:9',
  width: man.w,
  height: man.h,
  fps: man.fps,
  tracks: [{ type: 'video', name: 'adegan', items }],
};
fs.writeFileSync(SPEC, JSON.stringify(spec, null, 2), 'utf8');

console.log('\nMemvalidasi spec...');
if (!capcut(['compile', SPEC, '--check'], 'check').ok) process.exit(1);
console.log('  valid');

console.log('\nMembangun draft CapCut...');
fs.rmSync(PROJ, { recursive: true, force: true });
if (!capcut(['compile', SPEC, '--out', PROJ], 'compile').ok) process.exit(1);

/* ---------- Transisi silang antar segmen ---------- */
const segRes = capcut(['segments', PROJ, '--track', 'video'], 'segments');
let segs = [];
if (segRes.ok) {
  try {
    const p = JSON.parse(segRes.out);
    segs = Array.isArray(p) ? p : (p.segments || p.items || []);
  } catch (e) { /* daftar segmen tidak terbaca; transisi dilewati */ }
}

let applied = 0;
for (let i = 0; i < segs.length - 1; i++) {
  const id = segs[i].id || segs[i].segment_id;
  if (!id) continue;
  if (capcut(['transition', PROJ, id, 'dissolve', '--duration', '0.45'], 'transition').ok) {
    applied++;
  }
}
console.log(`\n${applied}/${Math.max(0, segs.length - 1)} transisi terpasang.`);

console.log(`\nProyek: ${path.relative(ROOT, PROJ)}`);
console.log('Buka lewat CapCut (Draft) untuk menambah musik atau menyunting lanjut.');
