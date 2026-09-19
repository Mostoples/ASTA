"""Mengubah berkas Markdown menjadi PDF A4 siap cetak.

    python tools/ppt/md2pdf.py PANDUAN-WAWANCARA-RESPONDEN.md

PDF ditulis di samping berkas sumber dengan nama yang sama. Penataan halaman
memakai Chromium (Playwright) supaya hasilnya sama di mana pun dicetak.
"""
import os, sys, io, re, json, subprocess, tempfile
import markdown

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))

CSS = """
@page { size: A4; margin: 20mm 18mm 18mm; }
body { font-family: "Segoe UI", system-ui, sans-serif; color: #16233a; font-size: 10.6pt; line-height: 1.6; margin: 0; }
h1 { font-size: 22pt; line-height: 1.2; margin: 0 0 4pt; letter-spacing: -.01em; }
h1 + p { color: #40546f; }
h2 { font-size: 14pt; margin: 20pt 0 8pt; padding-top: 10pt; border-top: 2px solid #d6e0ee; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 14pt 0 4pt; color: #17428f; break-after: avoid; }
h2:first-of-type { border-top: 0; }
p, li { margin: 0 0 6pt; }
ul, ol { padding-left: 16pt; margin: 0 0 8pt; }
strong { color: #0f2f68; }
em { color: #40546f; }
hr { border: 0; border-top: 2px solid #d6e0ee; margin: 16pt 0; }
a { color: #2b6cde; text-decoration: none; }
blockquote { margin: 6pt 0 10pt; padding: 9pt 14pt; border-left: 4px solid #2b6cde;
  background: #f1f5fb; border-radius: 0 8px 8px 0; color: #16233a; font-size: 11.2pt; break-inside: avoid; }
blockquote p { margin: 0; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 9.8pt; }
th, td { border: 1px solid #d6e0ee; padding: 6pt 8pt; text-align: left; vertical-align: top; }
th { background: #eaf2ff; color: #17428f; }
pre { background: #f5f8fc; border: 1px solid #d6e0ee; border-radius: 8px; padding: 10pt 12pt;
  font-family: Consolas, "Courier New", monospace; font-size: 9pt; line-height: 1.55; white-space: pre-wrap;
  break-inside: avoid; }
code { font-family: Consolas, "Courier New", monospace; font-size: 9.4pt; }
h2, h3 { break-inside: avoid; }
"""

RUNNER = """
const path = require('path');
const { chromium } = require(HTMLDIR_PLAYWRIGHT);
(async () => {
  const [html, pdf, footer] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file:///' + html.replace(/\\\\/g, '/'), { waitUntil: 'load' });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: pdf, format: 'A4', printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;font-family:Segoe UI;font-size:7.5pt;color:#6b7f99;padding:0 18mm;display:flex;justify-content:space-between">'
      + '<span>' + footer + '</span><span class="pageNumber"></span></div>',
    margin: { top: '20mm', bottom: '18mm', left: '18mm', right: '18mm' } });
  await b.close();
})();
"""


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'PANDUAN-WAWANCARA-RESPONDEN.md'
    src = os.path.join(ROOT, src) if not os.path.isabs(src) else src
    text = io.open(src, encoding='utf-8').read()
    body = markdown.markdown(text, extensions=['tables', 'fenced_code', 'sane_lists'])
    title = re.sub(r'^#\s+', '', text.splitlines()[0])
    html = ('<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>' + title +
            '</title><style>' + CSS + '</style></head><body>' + body + '</body></html>')
    tmp_html = os.path.splitext(src)[0] + '.tmp.html'
    io.open(tmp_html, 'w', encoding='utf-8').write(html)
    runner = os.path.join(tempfile.gettempdir(), 'md2pdf-runner.js')
    pw = json.dumps(os.path.join(ROOT, 'node_modules', 'playwright'))
    io.open(runner, 'w', encoding='utf-8').write(RUNNER.replace('HTMLDIR_PLAYWRIGHT', pw))
    pdf = os.path.splitext(src)[0] + '.pdf'
    subprocess.run(['node', runner, tmp_html, pdf, 'ASTA · SMA Negeri 1 Surakarta · HRIE 2026'],
                   check=True)
    os.remove(tmp_html)
    print(pdf, '%.0f KB' % (os.path.getsize(pdf) / 1024))


if __name__ == '__main__':
    main()
