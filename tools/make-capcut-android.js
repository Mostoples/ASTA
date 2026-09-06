/* ============================================================
   Proyek CapCut untuk video Android
   ------------------------------------------------------------
   Klip per adegan sudah dirakit (mockup + judul + scroll),
   jadi proyek CapCut memakai klip-klip itu sebagai segmen.
   Dengan begitu timeline di CapCut identik dengan video final
   dan tetap dapat diedit lanjut di aplikasi.
   ============================================================ */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FRAMES = path.join(ROOT, 'video-android');
const WORK = path.join(FRAMES, '_assets');
const CLIPS = path.join(ROOT, 'video-android-clips');
const SPEC = path.join(__dirname, 'asta-android-spec.json');
const PROJ = path.join(ROOT, 'capcut-project-android');

const man = JSON.parse(fs.readFileSync(path.join(FRAMES, 'manifest.json'), 'utf8'));

function capcut(args, label) {
  const q = args.map(a => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ');
  try {
    const out = execFileSync('cmd', ['/c', `capcut ${q} 2>&1`],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 60 });
    const s = String(out || '').trim();
    if (/"error"\s*:/.test(s)) {
      console.log(`  [gagal] ${label}: ${s.slice(0, 500)}`);
      return { ok: false, out: s };
    }
    return { ok: true, out: s };
  } catch (e) {
    const m = (String(e.stdout || '') + String(e.stderr || '')).trim();
    console.log(`  [gagal] ${label}: ${m.slice(0, 500) || 'tanpa pesan'}`);
    return { ok: false, out: m };
  }
}

/* ---------- Pindahkan klip ke folder tetap ---------- */
if (fs.existsSync(CLIPS)) fs.rmSync(CLIPS, { recursive: true });
fs.mkdirSync(CLIPS, { recursive: true });

const items = [];
let t = 0;
for (const s of man.scenes) {
  const src = path.join(WORK, `clip-${s.id}.mp4`);
  if (!fs.existsSync(src)) {
    console.log(`  ! klip tidak ada: clip-${s.id}.mp4`);
    continue;
  }
  const dst = path.join(CLIPS, `adegan-${s.id}.mp4`);
  fs.copyFileSync(src, dst);
  items.push({
    path: path.relative(path.dirname(SPEC), dst).replace(/\\/g, '/'),
    start: Number(t.toFixed(3)),
    duration: s.seconds,
    width: 1080,
    height: 1920,
  });
  t += s.seconds;
}

console.log(`${items.length} klip disiapkan di video-android-clips/`);
console.log(`Total ${t.toFixed(1)} detik (sebelum transisi)`);

const spec = {
  name: 'ASTA Demo Android Portrait',
  ratio: '9:16',
  width: 1080,
  height: 1920,
  fps: man.fps,
  tracks: [{ type: 'video', name: 'adegan', items: items }],
};
fs.writeFileSync(SPEC, JSON.stringify(spec, null, 2), 'utf8');

console.log('\nMemvalidasi spec...');
const chk = capcut(['compile', SPEC, '--check'], 'check');
if (!chk.ok) process.exit(1);
console.log('  valid');

console.log('\nMembangun draft CapCut...');
if (fs.existsSync(PROJ)) fs.rmSync(PROJ, { recursive: true });
const build = capcut(['compile', SPEC, '--out', PROJ], 'compile');
if (!build.ok) process.exit(1);

/* ---------- Transisi antar adegan ---------- */
const segRes = capcut(['segments', PROJ, '--track', 'video'], 'segments');
let segs = [];
if (segRes.ok) {
  try {
    const p = JSON.parse(segRes.out);
    segs = Array.isArray(p) ? p : (p.segments || p.items || []);
  } catch (e) { }
}
console.log(`\n${segs.length} segmen terdeteksi.`);

let applied = 0;
for (let i = 0; i < segs.length - 1; i++) {
  const id = segs[i].id || segs[i].segment_id;
  if (!id) continue;
  const r = capcut(['transition', PROJ, id, 'dissolve', '--duration', '0.45'], 'transition');
  if (r.ok) applied++;
}
console.log(`${applied}/${Math.max(0, segs.length - 1)} transisi terpasang.`);

/* ---------- Teks penanda bagian ---------- */
let tt = 0, texts = 0;
for (const s of man.scenes) {
  const r = capcut([
    'add-text', PROJ,
    String(Number(tt.toFixed(2))), String(Math.min(2.4, s.seconds - 0.4)),
    s.kicker.toUpperCase(),
    '--font-size', '9', '--color', '#A8FFE8', '--align', '1',
    '--x', '0', '--y', '-0.9', '--track-name', 'penanda'
  ], 'add-text');
  if (r.ok) texts++;
  tt += s.seconds;
}
console.log(`${texts}/${man.scenes.length} teks penanda ditambahkan.`);

console.log('\nLint:');
const lint = capcut(['lint', PROJ, '-H'], 'lint');
console.log('  ' + (lint.out || '').trim().slice(0, 500));

console.log('\nRingkasan proyek:');
const info = capcut(['info', PROJ, '-H'], 'info');
console.log((info.out || '').trim().slice(0, 700));
