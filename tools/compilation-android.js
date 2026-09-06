/* ============================================================
   Lembar kompilasi Android — 2 baris x 4 kolom
   Delapan tampilan terpenting dalam mockup ponsel.
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'screenshots-mobile');
const OUT = path.join(ROOT, 'screenshots-android');

const PICKS = [
  { f: '09-sinyal-emg.png', t: 'Sinyal EMG & Lengan Bionik',
    d: 'Empat kanal sEMG menggerakkan aktuator' },
  { f: '04-latihan-berjalan.png', t: 'Sesi Latihan Terpandu',
    d: 'Repetisi dihitung dari kontraksi otot' },
  { f: '05-catatan-nyeri.png', t: 'Catatan Nyeri Phantom',
    d: 'Skala NRS dengan peta tubuh interaktif' },
  { f: '07-terapi-cermin.png', t: 'Terapi Cermin & GMI',
    d: 'Umpan balik visual untuk nyeri phantom' },
  { f: '13-analisis-fase-a-b-a.png', t: 'Analisis Fase A-B-A',
    d: 'Menguji efek umpan balik sensorik' },
  { f: '02-dasbor-pasien.png', t: 'Dasbor Pasien',
    d: 'Kepatuhan, jadwal, dan status alat' },
  { f: '17-dasbor-terapis.png', t: 'Dasbor Klinis Terapis',
    d: 'Triase pasien menurut risiko' },
  { f: '22-dasbor-prostetis.png', t: 'Dasbor Teknis Prostetis',
    d: 'Kondisi armada dan mutu sinyal' },
];

const PW = 300;   // lebar layar dalam mockup kompilasi

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const cards = PICKS.map((p, i) => {
  const src = 'file:///' + path.join(RAW, p.f).replace(/\\/g, '/');
  if (!fs.existsSync(path.join(RAW, p.f))) console.log(`  ! tidak ditemukan: ${p.f}`);
  return `
  <figure class="card">
    <div class="num">${i + 1}</div>
    <div class="phone">
      <div class="screen">
        <div class="punch"></div>
        <div class="sb">
          <span>09:41</span>
          <span class="ic">
            <svg width="13" height="10" viewBox="0 0 15 12" fill="none">
              <path d="M1 8.5h2v3H1zM4.5 6h2v5.5h-2zM8 3.5h2v8H8zM11.5 1h2v10.5h-2z" fill="#16233a"/></svg>
            <svg width="19" height="10" viewBox="0 0 22 12" fill="none">
              <rect x="1" y="2" width="17" height="8" rx="2.2" stroke="#16233a" stroke-width="1.3"/>
              <rect x="2.6" y="3.6" width="12" height="4.8" rx="1.2" fill="#16233a"/></svg>
          </span>
        </div>
        <img src="${src}">
        <div class="nb"><i></i></div>
      </div>
    </div>
    <figcaption>
      <div class="t">${esc(p.t)}</div>
      <div class="d">${esc(p.d)}</div>
    </figcaption>
  </figure>`;
}).join('');

const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1720px;
    font-family: "Segoe UI", Inter, system-ui, sans-serif;
    background: linear-gradient(160deg, #eef3fa 0%, #e2eaf6 55%, #d8e2f1 100%);
    padding: 52px 48px 56px; color: #16233a;
  }
  header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 42px; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .mark {
    width: 72px; height: 72px; border-radius: 23px;
    background: linear-gradient(145deg, #4a87f2, #17428f);
    display: grid; place-items: center;
    box-shadow: 8px 8px 20px #c3d0e2, -8px -8px 20px #fff;
  }
  .name { font-size: 43px; font-weight: 750; letter-spacing: .12em; color: #17428f; line-height: 1; }
  .tag { font-size: 13px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase;
         color: #6b7f99; margin-top: 7px; }
  .sub { text-align: right; max-width: 660px; }
  .sub h1 { font-size: 23px; font-weight: 650; line-height: 1.35; }
  .sub p { font-size: 14.5px; color: #40546f; margin-top: 8px; line-height: 1.55; }

  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 40px 24px; justify-items: center; }
  .card { position: relative; width: ${PW + 26}px; }
  .num {
    position: absolute; top: -10px; left: -10px; z-index: 5;
    width: 40px; height: 40px; border-radius: 50%;
    background: linear-gradient(145deg, #4a87f2, #1f57bb);
    color: #fff; font-size: 18px; font-weight: 750;
    display: grid; place-items: center;
    box-shadow: 4px 4px 12px rgba(20,45,85,.32);
  }
  .phone {
    width: ${PW + 20}px; border-radius: 34px;
    background: linear-gradient(150deg, #2c3543, #171d27);
    padding: 10px; position: relative;
    box-shadow: 0 28px 50px -16px rgba(14,30,58,.45), 0 0 0 1.5px #0d1218;
  }
  .phone::after {
    content: ""; position: absolute; right: -2px; top: 112px;
    width: 2px; height: 56px; border-radius: 2px; background: #39424f;
  }
  .screen { border-radius: 25px; overflow: hidden; background: #e8eef7; position: relative; }
  .punch {
    position: absolute; top: 6px; left: 50%; transform: translateX(-50%);
    width: 10px; height: 10px; border-radius: 50%; background: #10161f; z-index: 10;
  }
  .sb {
    height: 24px; background: #e8eef7; display: flex; align-items: center;
    justify-content: space-between; padding: 0 12px;
    font-size: 10.5px; font-weight: 650; color: #16233a; position: relative; z-index: 5;
  }
  .sb .ic { display: flex; align-items: center; gap: 4px; }
  .screen img { width: 100%; display: block; }
  .nb { height: 18px; background: #e8eef7; display: grid; place-items: center; }
  .nb i { width: 88px; height: 3px; border-radius: 2px; background: #9fb2c9; display: block; }
  figcaption { padding: 18px 4px 0; text-align: center; }
  figcaption .t { font-size: 17px; font-weight: 700; }
  figcaption .d { font-size: 13.5px; color: #40546f; margin-top: 5px; line-height: 1.45; }

  footer {
    margin-top: 44px; padding-top: 24px; border-top: 2px solid #d6e0ee;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13.5px; color: #6b7f99;
  }
  footer strong { color: #17428f; }
  .pills { display: flex; gap: 9px; }
  .pill {
    padding: 7px 14px; border-radius: 999px; background: #edf2f9;
    box-shadow: 3px 3px 8px #c3d0e2, -3px -3px 8px #fff;
    font-size: 12.5px; font-weight: 650; color: #1f57bb;
  }
</style></head><body>
  <header>
    <div class="brand">
      <span class="mark">
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
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
      <h1>Antarmuka Mobile untuk Penggunaan Satu Tangan</h1>
      <p>Navigasi bawah dalam jangkauan ibu jari, target sentuh minimum 44 piksel,
         dan tata letak satu kolom. Diuji pada lebar 360 dan 393 piksel.</p>
    </div>
  </header>

  <div class="grid">${cards}</div>

  <footer>
    <div>Prototipe penelitian <strong>ASTA</strong> &middot; native HTML, CSS, JavaScript
         &middot; bukan alat diagnostik</div>
    <div class="pills">
      <span class="pill">Navigasi bawah</span>
      <span class="pill">Target sentuh 44px</span>
      <span class="pill">Tanpa scroll horizontal</span>
      <span class="pill">Mode satu tangan</span>
    </div>
  </footer>
</body></html>`;

(async () => {
  const tmp = path.join(OUT, '_comp.html');
  fs.writeFileSync(tmp, html, 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1720, height: 1400 }, deviceScaleFactor: 2 });
  await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images).map(im =>
      im.complete ? Promise.resolve() : new Promise(r => { im.onload = im.onerror = r; })));
  });
  await page.waitForTimeout(900);

  const out = path.join(OUT, '00-kompilasi-android-8-halaman.png');
  await page.screenshot({ path: out, fullPage: true });
  const dim = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  console.log(`Kompilasi Android: ${path.basename(out)}  (${dim.w}x${dim.h} @2x)`);

  await browser.close();
  fs.unlinkSync(tmp);
})();
