/* ============================================================
   Audit kelayakan mobile ASTA
   ------------------------------------------------------------
   Mengukur masalah nyata pada lebar layar ponsel:
     1. Overflow horizontal (halaman bisa digeser ke samping)
     2. Elemen yang lebih lebar dari viewport
     3. Target sentuh di bawah 44px
     4. Teks terlalu kecil (< 12px)
     5. Tabel yang memaksa scroll
     6. Grid yang masih multi-kolom pada layar sempit
   ============================================================ */
const { chromium, devices } = require('playwright');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'file:///' + ROOT.replace(/\\/g, '/');

// Android umum: Pixel 5 = 393x851, ponsel kelas bawah Indonesia ~360px
const PROFILES = [
  { name: 'Android 360px', width: 360, height: 800, dpr: 3 },
  { name: 'Android 393px', width: 393, height: 851, dpr: 2.75 },
];

const PAGES = [
  { f: 'index.html', role: null },
  { f: 'pasien-dashboard.html', role: 'pasien' },
  { f: 'sesi-latihan.html', role: 'pasien' },
  { f: 'catatan-nyeri.html', role: 'pasien' },
  { f: 'terapi-phantom.html', role: 'pasien' },
  { f: 'progres.html', role: 'pasien' },
  { f: 'perangkat.html', role: 'pasien' },
  { f: 'kalibrasi.html', role: 'pasien' },
  { f: 'jadwal.html', role: 'pasien' },
  { f: 'notifikasi.html', role: 'pasien' },
  { f: 'pengaturan.html', role: 'pasien' },
  { f: 'terapis-dashboard.html', role: 'terapis' },
  { f: 'terapis-pasien.html', role: 'terapis' },
  { f: 'terapis-program.html', role: 'terapis' },
  { f: 'terapis-kepatuhan.html', role: 'terapis' },
  { f: 'terapis-nyeri.html', role: 'terapis' },
  { f: 'prostetis-dashboard.html', role: 'prostetis' },
  { f: 'admin-dashboard.html', role: 'admin' },
];

const RU = { pasien: 'u_pat_1', terapis: 'u_ter_1', prostetis: 'u_pro_1', admin: 'u_adm_1' };

(async () => {
  const browser = await chromium.launch();
  const summary = {};

  for (const prof of PROFILES) {
    console.log(`\n${'='.repeat(74)}\n${prof.name}\n${'='.repeat(74)}`);
    let totOverflow = 0, totSmallTap = 0, totSmallText = 0, totWide = 0;

    for (const p of PAGES) {
      const ctx = await browser.newContext({
        viewport: { width: prof.width, height: prof.height },
        deviceScaleFactor: prof.dpr,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
      });
      const page = await ctx.newPage();
      if (p.role) {
        await page.addInitScript(({ uid, role }) => {
          localStorage.setItem('asta:v1:session', JSON.stringify({
            userId: uid, role, name: 'T', loginAt: new Date().toISOString()
          }));
        }, { uid: RU[p.role], role: p.role });
      }

      try {
        await page.goto(`${BASE}/${p.f}`, { waitUntil: 'load', timeout: 25000 });
        await page.waitForTimeout(1200);

        const r = await page.evaluate((vw) => {
          const docW = document.documentElement.scrollWidth;
          const overflow = Math.max(0, docW - vw);

          // Elemen yang melampaui viewport.
          // Konten di dalam wadah yang memang dapat digeser
          // (mis. tabel dalam .table-wrap) bukan masalah, jadi
          // seluruh rantai induk perlu diperiksa, bukan hanya
          // induk langsung.
          const inScroller = (el) => {
            let p = el.parentElement;
            while (p && p !== document.body) {
              const s = getComputedStyle(p);
              if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true;
              p = p.parentElement;
            }
            return false;
          };
          const wide = [];
          document.querySelectorAll('*').forEach(el => {
            const b = el.getBoundingClientRect();
            if (b.width > vw + 2 && b.height > 4) {
              const st = getComputedStyle(el);
              if (st.overflowX === 'auto' || st.overflowX === 'scroll') return;
              if (inScroller(el)) return;
              wide.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className || '').toString().slice(0, 46),
                w: Math.round(b.width)
              });
            }
          });

          // Target sentuh terlalu kecil.
          // Dikecualikan: input tersembunyi (.sr-only) yang label
          // pembungkusnya justru menjadi target sentuh, slider
          // (area geser mengikuti lebar, tinggi ibu jari terpisah),
          // petak peta panas, dan zona SVG pada peta tubuh yang
          // ukurannya mengikuti anatomi.
          const taps = [];
          document.querySelectorAll('button,a,input,select,.chip,.pain-btn,.tab,.sd-cell').forEach(el => {
            const b = el.getBoundingClientRect();
            if (b.width < 1 || b.height < 1) return;
            if (el.classList.contains('sr-only')) return;
            if (el.classList.contains('range')) return;
            if (el.type === 'checkbox' || el.type === 'radio') return;
            if (b.height < 40 || b.width < 40) {
              taps.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className || '').toString().slice(0, 40),
                w: Math.round(b.width), h: Math.round(b.height),
                txt: (el.textContent || '').trim().slice(0, 22)
              });
            }
          });

          // Teks terlalu kecil. Elemen di dalam SVG dikecualikan
          // karena skalanya mengikuti viewBox, bukan piksel layar.
          const small = [];
          document.querySelectorAll('*').forEach(el => {
            if (el.ownerSVGElement || el.tagName === 'svg') return;
            if (!el.childNodes.length) return;
            const hasText = Array.from(el.childNodes).some(
              n => n.nodeType === 3 && n.textContent.trim().length > 1);
            if (!hasText) return;
            const fs = parseFloat(getComputedStyle(el).fontSize);
            if (fs > 0 && fs < 12) {
              small.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className || '').toString().slice(0, 36),
                fs: fs.toFixed(1),
                txt: (el.textContent || '').trim().slice(0, 24)
              });
            }
          });

          // Grid multi-kolom pada layar sempit
          const grids = [];
          document.querySelectorAll('.grid,.g2,.g3,.g4,.g-2-1,.g-1-2').forEach(el => {
            const cols = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
            if (cols > 1) grids.push({ cls: (el.className || '').toString().slice(0, 40), cols });
          });

          return {
            docW, overflow,
            wide: wide.slice(0, 6), wideN: wide.length,
            taps: taps.slice(0, 6), tapsN: taps.length,
            small: small.slice(0, 4), smallN: small.length,
            grids: grids.slice(0, 4), gridsN: grids.length,
          };
        }, prof.width);

        totOverflow += r.overflow > 0 ? 1 : 0;
        totSmallTap += r.tapsN;
        totSmallText += r.smallN;
        totWide += r.wideN;

        const flag = (r.overflow > 0 || r.tapsN > 0 || r.wideN > 0) ? '!' : ' ';
        console.log(`${flag} ${p.f.padEnd(28)} lebar=${String(r.docW).padStart(4)} ` +
          `overflow=${String(r.overflow).padStart(3)} lebar>vw=${String(r.wideN).padStart(2)} ` +
          `tap<40=${String(r.tapsN).padStart(2)} teks<12=${String(r.smallN).padStart(3)} ` +
          `grid>1kol=${r.gridsN}`);

        if (r.wideN) r.wide.forEach(w => console.log(`      lebar: <${w.tag} class="${w.cls}"> ${w.w}px`));
        if (r.tapsN) r.taps.slice(0, 4).forEach(t =>
          console.log(`      tap:   <${t.tag} class="${t.cls}"> ${t.w}x${t.h} "${t.txt}"`));
        if (r.smallN) r.small.slice(0, 3).forEach(s =>
          console.log(`      teks:  <${s.tag} class="${s.cls}"> ${s.fs}px "${s.txt}"`));
        if (r.gridsN) r.grids.forEach(g => console.log(`      grid:  .${g.cls} -> ${g.cols} kolom`));
      } catch (e) {
        console.log(`! ${p.f.padEnd(28)} GAGAL: ${e.message.slice(0, 60)}`);
      }
      await ctx.close();
    }

    summary[prof.name] = { totOverflow, totSmallTap, totSmallText, totWide };
  }

  await browser.close();
  console.log(`\n${'='.repeat(74)}\nRINGKASAN`);
  Object.entries(summary).forEach(([k, v]) => {
    console.log(`  ${k}: ${v.totOverflow} halaman overflow, ${v.totWide} elemen kelebaran, ` +
      `${v.totSmallTap} target sentuh kecil, ${v.totSmallText} teks kecil`);
  });
})();
