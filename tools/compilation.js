/* ============================================================
   ASTA — Lembar kompilasi 2 baris x 4 kolom
   ------------------------------------------------------------
   Membangun satu halaman berisi 8 tampilan terpenting. Dibuat
   sebagai halaman HTML lalu ditangkap sebagai gambar, supaya
   penataan, judul, dan keterangan mudah disesuaikan.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'screenshots');

/* Delapan tampilan paling penting untuk ditonjolkan.
   Dipilih agar mewakili: hardware (EMG), fokus phantom pain,
   kepatuhan, dan sisi klinis multi-peran. */
const PICKS = [
  { file: '09-perangkat-sinyal-emg.png', title: 'Sinyal EMG & Lengan Bionik',
    desc: 'Empat kanal sEMG realtime menggerakkan aktuator' },
  { file: '04-sesi-latihan-berjalan.png', title: 'Sesi Latihan Terpandu',
    desc: 'Repetisi dihitung otomatis dari kontraksi otot' },
  { file: '05-catatan-nyeri-phantom.png', title: 'Catatan Nyeri Phantom',
    desc: 'Skala NRS dengan peta tubuh interaktif' },
  { file: '06-terapi-cermin-gmi.png', title: 'Terapi Cermin & GMI',
    desc: 'Umpan balik visual untuk menurunkan nyeri phantom' },
  { file: '08-progres-analisis-fase-a-b-a.png', title: 'Analisis Fase A-B-A',
    desc: 'Menguji efek umpan balik sensorik terhadap nyeri' },
  { file: '02-dasbor-pasien.png', title: 'Dasbor Pasien',
    desc: 'Kepatuhan, jadwal, dan status alat harian' },
  { file: '14-dasbor-klinis-terapis.png', title: 'Dasbor Klinis Terapis',
    desc: 'Triase pasien menurut risiko putus terapi' },
  { file: '20-dasbor-teknis-prostetis.png', title: 'Dasbor Teknis Prostetis',
    desc: 'Kondisi armada alat dan mutu sinyal' },
];

// Ukuran kartu: potong bagian atas tiap tangkapan agar seragam
const CARD_W = 430;
const CARD_H = 760;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const cards = PICKS.map((p, i) => {
  const src = 'file:///' + path.join(SHOTS, p.file).replace(/\\/g, '/');
  const missing = !fs.existsSync(path.join(SHOTS, p.file));
  if (missing) console.log(`  ! tidak ditemukan: ${p.file}`);
  return `
  <figure class="card">
    <div class="num">${i + 1}</div>
    <div class="frame">
      <div class="bar"><span></span><span></span><span></span></div>
      <div class="shot"><img src="${src}" alt="${esc(p.title)}"></div>
    </div>
    <figcaption>
      <div class="t">${esc(p.title)}</div>
      <div class="d">${esc(p.desc)}</div>
    </figcaption>
  </figure>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<link rel="stylesheet" href="file:///${path.join(ROOT, 'css/tokens.css').replace(/\\/g, '/')}">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1960px;
    font-family: "Segoe UI", Inter, system-ui, sans-serif;
    background: linear-gradient(160deg, #eef3fa 0%, #e2eaf6 55%, #dae4f2 100%);
    padding: 54px 56px 60px;
    color: #16233a;
  }
  header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 40px; }
  .brand { display: flex; align-items: center; gap: 20px; }
  .mark {
    width: 76px; height: 76px; border-radius: 24px;
    background: linear-gradient(145deg, #4a87f2, #17428f);
    display: grid; place-items: center;
    box-shadow: 8px 8px 20px #c3d0e2, -8px -8px 20px #ffffff;
  }
  .name { font-size: 46px; font-weight: 750; letter-spacing: .12em; color: #17428f; line-height: 1; }
  .tag { font-size: 14px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
         color: #6b7f99; margin-top: 7px; }
  .sub { text-align: right; max-width: 720px; }
  .sub h1 { font-size: 25px; font-weight: 650; letter-spacing: -.01em; line-height: 1.35; }
  .sub p { font-size: 15px; color: #40546f; margin-top: 8px; line-height: 1.55; }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, ${CARD_W}px);
    gap: 34px 28px;
    justify-content: center;
  }
  .card { position: relative; }
  .num {
    position: absolute; top: -12px; left: -12px; z-index: 3;
    width: 42px; height: 42px; border-radius: 50%;
    background: linear-gradient(145deg, #4a87f2, #1f57bb);
    color: #fff; font-size: 19px; font-weight: 750;
    display: grid; place-items: center;
    box-shadow: 4px 4px 12px rgba(20,45,85,.3);
  }
  .frame {
    border-radius: 22px;
    background: #edf2f9;
    box-shadow: 12px 12px 28px #c3d0e2, -10px -10px 24px #ffffff;
    padding: 12px;
    overflow: hidden;
  }
  .bar { display: flex; gap: 7px; padding: 4px 6px 11px; }
  .bar span { width: 11px; height: 11px; border-radius: 50%; background: #cdd9e9; }
  .bar span:first-child { background: #f0a8a8; }
  .bar span:nth-child(2) { background: #f0d4a0; }
  .bar span:nth-child(3) { background: #a8d8b4; }
  .shot {
    width: 100%; height: ${CARD_H}px;
    border-radius: 14px; overflow: hidden;
    background: #e8eef7;
    box-shadow: inset 0 0 0 1px #d6e0ee;
  }
  /* Tampilkan bagian atas halaman: paling informatif */
  .shot img { width: 100%; display: block; object-fit: cover; object-position: top center; height: 100%; }
  figcaption { padding: 18px 8px 0; }
  figcaption .t { font-size: 19px; font-weight: 700; letter-spacing: -.01em; }
  figcaption .d { font-size: 14.5px; color: #40546f; margin-top: 5px; line-height: 1.5; }

  footer {
    margin-top: 46px; padding-top: 24px;
    border-top: 2px solid #d6e0ee;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 14px; color: #6b7f99;
  }
  footer strong { color: #17428f; }
  .pills { display: flex; gap: 10px; }
  .pill {
    padding: 7px 15px; border-radius: 999px; background: #edf2f9;
    box-shadow: 3px 3px 8px #c3d0e2, -3px -3px 8px #ffffff;
    font-size: 13px; font-weight: 650; color: #1f57bb;
  }
</style></head>
<body>
  <header>
    <div class="brand">
      <span class="mark">
        <svg width="42" height="42" viewBox="0 0 32 32" fill="none">
          <path d="M11 21V9.5a2.2 2.2 0 0 1 4.4 0V19" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M15.4 13.6V8a2.2 2.2 0 0 1 4.4 0v11" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M19.8 14.4v-2.2a2.2 2.2 0 0 1 4.4 0V19a8 8 0 0 1-8 8h-1.6A7.8 7.8 0 0 1 7 19.2"
                stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M2 7.5h3l1.6-3.2L9 10l1.6-2.5h2" stroke="#a8ffe8" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span>
        <div class="name">ASTA</div>
        <div class="tag">Adaptive Sensory-feedback Telerehabilitation Arm</div>
      </span>
    </div>
    <div class="sub">
      <h1>Platform Telerehabilitasi Lengan Bionik Modular Non-Invasif</h1>
      <p>Fokus pada penurunan nyeri phantom dan kepatuhan terapi bagi penyandang
         amputasi di Indonesia. Delapan tampilan utama dari 18 halaman aplikasi.</p>
    </div>
  </header>

  <div class="grid">${cards}</div>

  <footer>
    <div>Prototipe penelitian <strong>ASTA</strong> &middot; antarmuka native HTML, CSS,
         dan JavaScript &middot; bukan alat diagnostik</div>
    <div class="pills">
      <span class="pill">4 peran pengguna</span>
      <span class="pill">Kontrol sEMG 4 kanal</span>
      <span class="pill">Desain studi A-B-A</span>
      <span class="pill">18 halaman</span>
    </div>
  </footer>
</body></html>`;

(async () => {
  const tmp = path.join(SHOTS, '_compilation.html');
  fs.writeFileSync(tmp, html, 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1960, height: 1400 }, deviceScaleFactor: 2 });
  await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'load' });
  // Pastikan semua gambar termuat sebelum ditangkap
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images).map(img =>
      img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; })));
  });
  await page.waitForTimeout(900);

  const out = path.join(SHOTS, '00-kompilasi-8-halaman.png');
  await page.screenshot({ path: out, fullPage: true });

  const dim = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight
  }));
  console.log(`Kompilasi tersimpan: ${path.basename(out)}  (${dim.w}x${dim.h} @2x)`);

  await browser.close();
  fs.unlinkSync(tmp);
})();
