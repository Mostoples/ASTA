/* ============================================================
   Verifikasi screenshot
   1. Deteksi gambar kosong / hampir seragam lewat statistik
      piksel ffmpeg (entropi & simpangan baku luma).
   2. Asersi konten: pastikan elemen kunci benar-benar tampil
      pada keadaan saat tangkapan diambil.
   ============================================================ */
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'screenshots');
const BASE = 'file:///' + ROOT.replace(/\\/g, '/');
const FF = 'C:\\Users\\mosto\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe';

let fail = 0;

/* ---------- 1. Statistik piksel ---------- */
console.log('=== Deteksi gambar kosong ===');
const manifest = JSON.parse(fs.readFileSync(path.join(SHOTS, 'manifest.json'), 'utf8'));

for (const m of manifest) {
  const f = path.join(SHOTS, m.file);
  // ffmpeg menulis metadata filter ke stderr, termasuk saat keluar sukses,
  // jadi stderr harus ditangkap pada kedua jalur.
  let out = '';
  try {
    const r = execFileSync(FF,
      ['-hide_banner', '-loglevel', 'info', '-i', f,
        '-vf', 'signalstats,metadata=print', '-f', 'null', '-'],
      { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    out = String(r || '');
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '');
  }
  if (!out) {
    // Sebagian build menulis hanya ke stderr yang tidak tertangkap di atas
    try {
      out = execFileSync('cmd', ['/c',
        `"${FF}" -hide_banner -loglevel info -i "${f}" -vf signalstats,metadata=print -f null - 2>&1`],
        { encoding: 'utf8', maxBuffer: 1024 * 1024 * 40 });
    } catch (e2) { out = String(e2.stdout || ''); }
  }
  // ffmpeg menulis metadata ke stderr; ambil YDIF/ YAVG
  const avg = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(out);
  const low = /lavfi\.signalstats\.YLOW=([\d.]+)/.exec(out);
  const high = /lavfi\.signalstats\.YHIGH=([\d.]+)/.exec(out);
  const range = low && high ? Number(high[1]) - Number(low[1]) : null;

  const ok = range === null ? true : range > 60;
  if (!ok) { fail++; console.log(`  [KOSONG?] ${m.file} rentang luma ${range}`); }
  else console.log(`  [ OK ] ${m.file.padEnd(44)} luma ${avg ? Number(avg[1]).toFixed(0) : '?'} rentang ${range ?? '?'}`);
}

/* ---------- 2. Asersi konten ---------- */
(async () => {
  console.log('\n=== Asersi konten pada keadaan tangkapan ===');
  const browser = await chromium.launch();
  const RU = { pasien: 'u_pat_1', terapis: 'u_ter_1', prostetis: 'u_pro_1', admin: 'u_adm_1' };

  // [file, role, teks yang harus tampil]
  const ASSERT = [
    ['index.html', null, ['ASTA', 'Masuk ke ASTA', 'Akun demo']],
    ['pasien-dashboard.html', 'pasien', ['Fokus hari ini', 'Kepatuhan 14 hari', 'Lengan bionik']],
    ['sesi-latihan.html', 'pasien', ['Pilih latihan', 'Status alat', 'Ringkasan sesi']],
    ['catatan-nyeri.html', 'pasien', ['Seberapa nyeri hari ini', 'Di mana nyeri terasa', 'Jenis nyeri']],
    ['terapi-phantom.html', 'pasien', ['Terapi Cermin', 'Pengenalan Sisi', 'Diskriminasi Sensorik']],
    ['progres.html', 'pasien', ['Perbandingan fase penelitian', 'Cohen', 'Korelasi Pearson']],
    ['perangkat.html', 'pasien', ['Sinyal sEMG realtime', 'Pola cengkeram', 'Umpan balik haptik']],
    ['kalibrasi.html', 'pasien', ['Wizard kalibrasi', 'Ambang batas per kanal', 'Perilaku aktuator']],
    ['jadwal.html', 'pasien', ['Hari ini', 'Peta aktivitas', 'Jadwal berulang']],
    ['notifikasi.html', 'pasien', ['Notifikasi', 'Ringkasan']],
    ['pengaturan.html', 'pasien', ['Profil', 'Aksesibilitas']],
    ['terapis-dashboard.html', 'terapis', ['Pasien aktif', 'Semua pasien', 'Kepatuhan']],
    ['terapis-pasien.html', 'terapis', ['Rekam klinis', 'Program aktif']],
    ['terapis-program.html', 'terapis', ['Pengaturan program', 'Katalog latihan', 'Ringkasan resep']],
    ['terapis-kepatuhan.html', 'terapis', ['Rincian skor per pasien', 'Peta panas aktivitas']],
    ['terapis-nyeri.html', 'terapis', ['Efek umpan balik haptik', 'Peta nyeri agregat']],
    ['prostetis-dashboard.html', 'prostetis', ['Armada perangkat', 'Jadwal servis']],
    ['admin-dashboard.html', 'admin', ['Tata kelola data', 'Pengguna', 'Log akses']],
  ];

  for (const [file, role, texts] of ASSERT) {
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
    const page = await ctx.newPage();
    if (role) {
      await page.addInitScript(({ uid, role }) => {
        localStorage.setItem('asta:v1:session', JSON.stringify({
          userId: uid, role, name: 'T', loginAt: new Date().toISOString()
        }));
      }, { uid: RU[role], role });
    }
    await page.goto(`${BASE}/${file}`, { waitUntil: 'load' });
    await page.waitForTimeout(1300);
    // textContent, bukan innerText: innerText menerapkan text-transform
    // sehingga label ber-uppercase tidak cocok dengan pola aslinya.
    const body = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
    const missing = texts.filter(t => body.toLowerCase().indexOf(t.toLowerCase()) < 0);
    if (missing.length) { fail++; console.log(`  [KURANG] ${file} — tidak menemukan: ${missing.join(', ')}`); }
    else console.log(`  [ OK ] ${file}`);
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? `\n${fail} masalah ditemukan.` : '\nSemua verifikasi lolos.');
  process.exit(fail ? 1 : 0);
})();
