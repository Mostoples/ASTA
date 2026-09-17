// Mewarnai ulang SVG keluaran LibreCAD menjadi gaya blueprint lalu menyimpannya sebagai PNG.
//   node tools/ppt/bp-render.js
const fs = require('fs'), path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIR = path.join(__dirname, 'out', 'blueprint');
const CSS = `
  html,body{margin:0;background:#0f3d7a}
  .bp{position:relative;padding:28px;background:
     linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px) 0 0/24px 24px,
     linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px) 0 0/24px 24px,
     radial-gradient(ellipse at 30% 20%,#1b5fae,#0f3d7a 70%)}
  svg{display:block;width:100%;height:auto}
  svg g{stroke:#eaf4ff;stroke-width:1}
  .ly-TAMPAK{stroke:#ffffff;stroke-width:2.4}
  .ly-TERSEMBUNYI{stroke:#8fbfff;stroke-width:1;stroke-dasharray:7 5;opacity:.7}
  .ly-SUMBU{stroke:#ffd166;stroke-width:1.2;stroke-dasharray:24 6 4 6}
  .ly-UKURAN{stroke:#7fe0ff;stroke-width:1.2}
  .ly-TEKS{stroke:#ffffff;stroke-width:1.1}
  .ly-BINGKAI{stroke:#cfe3ff;stroke-width:2.6}
`;
(async () => {
  const b = await chromium.launch();
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.svg') && !f.startsWith('_'))) {
    let svg = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/^<\?xml[^>]*>/, '');
    // Gaya per layer ditulis langsung ke atribut grup (selektor atribut ber-namespace tidak andal)
    svg = svg.replace(/<g lc:layername="([^"]+)"([^>]*?)stroke="black" stroke-width="1"/g,
      (m, layer, mid) => `<g lc:layername="${layer}"${mid}class="ly-${layer}"`);
    const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const W = 2400, H = Math.round(W * vb[2] / vb[1]) + 56;
    const p = await b.newPage({ viewport: { width: W + 56, height: H }, deviceScaleFactor: 1 });
    await p.setContent(`<style>${CSS}</style><div class="bp">${svg}</div>`);
    await p.waitForTimeout(200);
    const out = path.join(DIR, f.replace('.svg', '.png'));
    await (await p.$('.bp')).screenshot({ path: out });
    console.log(out);
    await p.close();
  }
  await b.close();
})();
