/* ============================================================
   Menyiapkan frame video portrait 1080x1920
   ------------------------------------------------------------
   Screenshot fullPage sangat tinggi (sampai 6473px). Bila
   dipaksa masuk kanvas 9:16 akan terdistorsi atau terpotong
   sembarangan. Jadi tiap tangkapan diproses menjadi satu frame
   1080x1920 berisi:
     - bagian atas halaman (paling informatif) sebagai isi utama
     - latar biru lembut sesuai tema, bukan bilah hitam
     - kepala berisi nomor, judul, dan keterangan
   ============================================================ */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'screenshots');
const FRAMES = path.join(ROOT, 'video-frames');

// Urutan cerita video: mulai dari masalah, ke solusi, ke bukti
const SCENES = [
  { file: '01-halaman-masuk.png', title: 'ASTA',
    sub: 'Telerehabilitasi lengan bionik non-invasif', kicker: 'Pembuka' },
  { file: '02-dasbor-pasien.png', title: 'Dasbor Pasien',
    sub: 'Kepatuhan, jadwal terapi, dan status alat dalam satu layar', kicker: 'Pasien' },
  { file: '09-perangkat-sinyal-emg.png', title: 'Sinyal Otot Menggerakkan Lengan',
    sub: 'Empat kanal sEMG diterjemahkan menjadi pola cengkeram dan gaya', kicker: 'Hardware' },
  { file: '10-kalibrasi-tuning.png', title: 'Kalibrasi Terpandu',
    sub: 'Baseline dan kontraksi maksimum menentukan ambang tiap kanal', kicker: 'Hardware' },
  { file: '04-sesi-latihan-berjalan.png', title: 'Repetisi Terhitung Otomatis',
    sub: 'Mutu gerak dinilai dari kehalusan dan durasi tahan kontraksi', kicker: 'Latihan' },
  { file: '05-catatan-nyeri-phantom.png', title: 'Catatan Nyeri Phantom',
    sub: 'Skala NRS, peta tubuh interaktif, pemicu, dan dampak tidur', kicker: 'Phantom Pain' },
  { file: '06-terapi-cermin-gmi.png', title: 'Terapi Cermin Digital',
    sub: 'Umpan balik visual pada posisi lengan yang diamputasi', kicker: 'Phantom Pain' },
  { file: '07-gmi-pengenalan-sisi.png', title: 'Graded Motor Imagery',
    sub: 'Pengenalan sisi kiri-kanan melatih ulang peta motorik', kicker: 'Phantom Pain' },
  { file: '08-progres-analisis-fase-a-b-a.png', title: 'Analisis Fase A-B-A',
    sub: 'Nyeri naik saat haptik dicabut, turun lagi saat dipasang', kicker: 'Bukti' },
  { file: '11-jadwal-pengingat.png', title: 'Jadwal & Pengingat Berjenjang',
    sub: 'Eskalasi otomatis ke terapis bila latihan lama terlewat', kicker: 'Kepatuhan' },
  { file: '14-dasbor-klinis-terapis.png', title: 'Dasbor Klinis Terapis',
    sub: 'Triase pasien menurut risiko putus terapi', kicker: 'Klinis' },
  { file: '18-pemantauan-kepatuhan.png', title: 'Skor Kepatuhan Komposit',
    sub: 'Frekuensi, kelengkapan, dan pemakaian alat dari telemetri', kicker: 'Klinis' },
  { file: '19-pemantauan-nyeri-lintas-pasien.png', title: 'Efek Haptik Lintas Pasien',
    sub: 'Perbandingan nyeri antar fase beserta ukuran efek', kicker: 'Bukti' },
  { file: '20-dasbor-teknis-prostetis.png', title: 'Dasbor Teknis Prostetis',
    sub: 'Mutu sinyal, kondisi socket, dan jadwal servis armada', kicker: 'Klinis' },
  { file: '13-persetujuan-privasi.png', title: 'Persetujuan & Jejak Audit',
    sub: 'Hak menarik diri dan catatan setiap akses data', kicker: 'Etik' },
  { file: '00-kompilasi-8-halaman.png', title: '18 Halaman, 4 Peran',
    sub: 'Pasien, fisioterapis, prostetis, dan admin klinik', kicker: 'Penutup' },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

(async () => {
  if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, { recursive: true });
  fs.mkdirSync(FRAMES, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });

  const built = [];

  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i];
    const src = path.join(SHOTS, s.file);
    if (!fs.existsSync(src)) { console.log(`  ! lewati, tidak ada: ${s.file}`); continue; }

    const isWide = s.file.startsWith('00-');
    const url = 'file:///' + src.replace(/\\/g, '/');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 1080px; height: 1920px; overflow: hidden;
        font-family: "Segoe UI", Inter, system-ui, sans-serif;
        background: linear-gradient(165deg, #1b4fa8 0%, #17428f 42%, #0f2f68 100%);
        color: #f4f8ff; display: flex; flex-direction: column;
      }
      .head { padding: 74px 76px 34px; flex: 0 0 auto; }
      .kicker {
        display: inline-block; padding: 9px 20px; border-radius: 999px;
        background: rgba(255,255,255,.16); font-size: 21px; font-weight: 700;
        letter-spacing: .1em; text-transform: uppercase;
      }
      h1 { font-size: 62px; font-weight: 750; letter-spacing: -.02em;
           line-height: 1.14; margin-top: 26px; }
      p.sub { font-size: 27px; color: #c8dcff; margin-top: 18px; line-height: 1.45;
              max-width: 30ch; }
      .stage {
        flex: 1 1 auto; margin: 6px 60px 46px; border-radius: 26px;
        background: #e8eef7; overflow: hidden; position: relative;
        box-shadow: 0 30px 70px rgba(4,16,38,.5);
      }
      .stage img {
        width: 100%; display: block;
        ${isWide
          ? 'height: 100%; object-fit: contain; object-position: center; background:#e8eef7;'
          : 'object-fit: cover; object-position: top center; height: 100%;'}
      }
      .foot {
        position: absolute; left: 0; right: 0; bottom: 0;
        padding: 22px 30px; display: flex; justify-content: space-between;
        align-items: center; font-size: 19px; font-weight: 650;
        background: linear-gradient(to top, rgba(15,47,104,.92), rgba(15,47,104,0));
        color: #e7f0ff;
      }
      .dots { display: flex; gap: 8px; }
      .dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,.32); }
      .dot.on { background: #a8ffe8; width: 26px; border-radius: 999px; }
    </style></head><body>
      <div class="head">
        <span class="kicker">${esc(s.kicker)}</span>
        <h1>${esc(s.title)}</h1>
        <p class="sub">${esc(s.sub)}</p>
      </div>
      <div class="stage">
        <img src="${url}">
        <div class="foot">
          <span>asta-id.web.app</span>
          <span class="dots">${SCENES.map((_, j) =>
            `<span class="dot${j === i ? ' on' : ''}"></span>`).join('')}</span>
          <span>${String(i + 1).padStart(2, '0')} / ${String(SCENES.length).padStart(2, '0')}</span>
        </div>
      </div>
    </body></html>`;

    const tmp = path.join(FRAMES, `_f${i}.html`);
    fs.writeFileSync(tmp, html, 'utf8');
    await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'load' });
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.images).map(im =>
        im.complete ? Promise.resolve() : new Promise(r => { im.onload = im.onerror = r; })));
    });
    await page.waitForTimeout(320);

    const out = path.join(FRAMES, `frame-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    fs.unlinkSync(tmp);

    built.push({ index: i + 1, file: path.basename(out), title: s.title, sub: s.sub, kicker: s.kicker });
    console.log(`[ OK ] ${path.basename(out)}  ${s.title}`);
  }

  await browser.close();
  fs.writeFileSync(path.join(FRAMES, 'scenes.json'), JSON.stringify(built, null, 2));
  console.log(`\n${built.length} frame portrait 1080x1920 siap di video-frames/`);
})();
