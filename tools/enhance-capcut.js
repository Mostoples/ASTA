/* ============================================================
   Menambahkan transisi dan trek teks pada proyek CapCut ASTA
   ------------------------------------------------------------
   Judul sudah tergambar di dalam frame, jadi trek teks di sini
   dipakai untuk keterangan tambahan di bagian bawah layar
   (tidak menutupi antarmuka), plus transisi antar adegan.
   ============================================================ */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROJ = path.join(ROOT, 'capcut-project');
const FRAMES = path.join(ROOT, 'video-frames');

function capcut(args, label, quiet) {
  const quoted = args.map(a => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ');
  try {
    const out = execFileSync('cmd', ['/c', `capcut ${quoted} 2>&1`],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 60 });
    const s = String(out || '').trim();
    if (/"error"\s*:/.test(s)) {
      if (!quiet) console.log(`  [gagal] ${label}: ${s.slice(0, 300)}`);
      return { ok: false, out: s };
    }
    return { ok: true, out: s };
  } catch (e) {
    const msg = (String(e.stdout || '') + String(e.stderr || '')).trim();
    if (!quiet) console.log(`  [gagal] ${label}: ${msg.slice(0, 300) || 'tanpa pesan'}`);
    return { ok: false, out: msg };
  }
}

/* ---------- 1. Lihat transisi yang tersedia ---------- */
console.log('Transisi yang tersedia:');
const tr = capcut(['enums', '--transitions'], 'enums', true);
let slugs = [];
if (tr.ok) {
  try {
    const parsed = JSON.parse(tr.out);
    const arr = Array.isArray(parsed) ? parsed : (parsed.transitions || parsed.items || []);
    slugs = arr.map(x => (typeof x === 'string' ? x : x.slug || x.name)).filter(Boolean);
  } catch (e) {
    slugs = tr.out.split(/\s+/).filter(s => /^[a-z][a-z0-9_-]+$/.test(s));
  }
}
console.log('  ' + (slugs.slice(0, 14).join(', ') || '(tidak terbaca)'));

/* ---------- 2. Ambil daftar segmen ---------- */
const segRes = capcut(['segments', PROJ, '--track', 'video'], 'segments');
if (!segRes.ok) process.exit(1);

let segs = [];
try {
  const p = JSON.parse(segRes.out);
  segs = Array.isArray(p) ? p : (p.segments || p.items || []);
} catch (e) {
  console.log('  tidak dapat membaca daftar segmen');
  process.exit(1);
}
console.log(`\n${segs.length} segmen video terdeteksi.`);

/* ---------- 3. Terapkan transisi antar adegan ---------- */
// Pilih transisi halus; jatuh ke nama alternatif bila tidak ada
const prefer = ['dissolve', 'fade', 'blur', 'zoom_in', 'slide_left', 'mix'];
const pick = prefer.find(s => slugs.includes(s)) || slugs[0];

let applied = 0;
if (pick) {
  console.log(`\nMenerapkan transisi "${pick}" antar adegan...`);
  // Transisi dipasang pada segmen selain yang terakhir
  for (let i = 0; i < segs.length - 1; i++) {
    const id = segs[i].id || segs[i].segment_id;
    if (!id) continue;
    const r = capcut(['transition', PROJ, id, pick, '--duration', '0.4'], 'transition', true);
    if (r.ok) applied++;
  }
  console.log(`  ${applied}/${segs.length - 1} transisi terpasang.`);
} else {
  console.log('\nTidak ada slug transisi yang dikenali; dilewati.');
}

/* ---------- 4. Trek teks keterangan di bawah ---------- */
const scenes = JSON.parse(fs.readFileSync(path.join(FRAMES, 'scenes.json'), 'utf8'));
const DUR = i => (i === 0 ? 4.5 : i === scenes.length - 1 ? 5.5 : 4);

console.log('\nMenambahkan trek teks keterangan...');
let t = 0, texts = 0;
for (let i = 0; i < scenes.length; i++) {
  const d = DUR(i);
  // Tampilkan kicker sebagai penanda bagian, muncul sebentar di awal adegan
  const label = scenes[i].kicker.toUpperCase();
  const r = capcut([
    'add-text', PROJ,
    String(Number(t.toFixed(2))), String(Math.min(2.2, d - 0.4)),
    label,
    '--font-size', '9',
    '--color', '#A8FFE8',
    '--align', '1',
    '--x', '0', '--y', '-0.86',
    '--track-name', 'penanda'
  ], 'add-text', true);
  if (r.ok) texts++;
  t += d;
}
console.log(`  ${texts}/${scenes.length} teks penanda ditambahkan.`);

/* ---------- 5. Verifikasi akhir ---------- */
console.log('\nLint akhir:');
const lint = capcut(['lint', PROJ, '-H'], 'lint');
console.log('  ' + (lint.out || '').trim().slice(0, 700));

console.log('\nRingkasan:');
const info = capcut(['info', PROJ, '-H'], 'info');
console.log((info.out || '').trim().slice(0, 800));
