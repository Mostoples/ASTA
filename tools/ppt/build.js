// Merender deck.html menjadi bahan PPTX dan PDF.
//   node tools/ppt/build.js [--pdf-only]
// Keluaran di tools/ppt/out/deck/:
//   sNN.png        pratinjau slide lengkap
//   sNN-bg.png     latar slide tanpa teks (teks dijadikan kotak teks asli di PPTX)
//   deck.json      posisi & gaya setiap teks, video, catatan pembicara, transisi
//   deck.pdf       PDF vektor semua slide
const fs = require('fs'), path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const OUT = path.join(__dirname, 'out', 'deck');
const URL = 'file:///' + path.join(__dirname, 'deck.html').replace(/\\/g, '/');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('requestfailed', r => errs.push('gagal memuat ' + r.url()));
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => window.DECK_READY === true);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);

  const data = await p.evaluate(() => {
    const px = v => parseFloat(v) || 0;
    function runsOf(el) {
      // Teks dikelompokkan per paragraf (dipisah <br>), tiap paragraf berisi run bergaya
      const paras = [[]];
      const walk = node => {
        for (const c of node.childNodes) {
          if (c.nodeType === 3) {
            const t = c.textContent.replace(/\s+/g, ' ');
            if (!t) continue;
            const cs = getComputedStyle(c.parentElement);
            let text = t;
            if (cs.textTransform === 'uppercase') text = text.toUpperCase();
            paras[paras.length - 1].push({
              text, size: px(cs.fontSize), weight: parseInt(cs.fontWeight, 10),
              color: cs.color, italic: cs.fontStyle === 'italic', spacing: px(cs.letterSpacing)
            });
          } else if (c.nodeName === 'BR') {
            paras.push([]);
          } else if (c.nodeType === 1 && !c.classList.contains('tx')) {
            walk(c);
          }
        }
      };
      walk(el);
      paras.forEach(pr => {            // rapikan spasi di tepi paragraf
        if (pr.length) { pr[0].text = pr[0].text.replace(/^ /, ''); pr[pr.length - 1].text = pr[pr.length - 1].text.replace(/ $/, ''); }
      });
      return paras.filter(pr => pr.some(r => r.text));
    }
    return [...document.querySelectorAll('section.slide')].map(s => {
      const sb = s.getBoundingClientRect();
      const texts = [...s.querySelectorAll('.tx')].map(el => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        // kotak isi (tanpa padding) agar teks tidak bergeser
        const pl = px(cs.paddingLeft), pr = px(cs.paddingRight), pt = px(cs.paddingTop), pb = px(cs.paddingBottom);
        return {
          x: r.left - sb.left + pl, y: r.top - sb.top + pt, w: r.width - pl - pr, h: r.height - pt - pb,
          align: cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' ? 'right' : 'left',
          lineHeight: px(cs.lineHeight) || px(cs.fontSize) * 1.3,
          valign: (cs.display === 'grid' || cs.display.includes('flex')) ? 'middle' : 'top',
          paras: runsOf(el)
        };
      }).filter(t => t.paras.length);
      const videos = [...s.querySelectorAll('.vid')].map(el => {
        const r = el.getBoundingClientRect();
        return { x: r.left - sb.left, y: r.top - sb.top, w: r.width, h: r.height, src: el.dataset.src, poster: el.dataset.poster };
      });
      return { id: s.id, notes: (s.dataset.notes || '').trim(), transition: s.dataset.transition || 'fade', texts, videos };
    });
  });

  const pdfOnly = process.argv.includes('--pdf-only');
  if (!pdfOnly) {
    const ids = data.map(d => d.id);
    for (const id of ids) {
      const el = await p.$('#' + id);
      await el.screenshot({ path: path.join(OUT, id + '.png') });
    }
    await p.addStyleTag({ content: '.tx,.tx *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}' });
    await p.waitForTimeout(150);
    for (const id of ids) {
      const el = await p.$('#' + id);
      await el.screenshot({ path: path.join(OUT, id + '-bg.png') });
    }
    fs.writeFileSync(path.join(OUT, 'deck.json'), JSON.stringify(data, null, 1));
  }

  // PDF vektor: muat ulang halaman tanpa gaya penyembunyi teks
  const q = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await q.goto(URL, { waitUntil: 'load' });
  await q.waitForFunction(() => window.DECK_READY === true);
  await q.emulateMedia({ media: 'print' });
  await q.pdf({ path: path.join(OUT, 'deck.pdf'), width: '1920px', height: '1080px', printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 } });

  await b.close();
  console.log('slide:', data.length, ' teks:', data.reduce((a, d) => a + d.texts.length, 0),
    ' video:', data.reduce((a, d) => a + d.videos.length, 0));
  if (errs.length) { console.log('PERINGATAN:\n' + errs.join('\n')); process.exitCode = 1; }
})();
