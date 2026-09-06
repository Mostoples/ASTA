/* ============================================================
   ASTA — Perekam frame video Android dengan scrolling
   ------------------------------------------------------------
   Merekam tiap adegan sebagai deretan frame PNG. Scroll
   dikendalikan per frame (bukan animasi CSS) sehingga gerakan
   benar-benar halus dan sinkron dengan laju frame video.

   Pendekatan: untuk setiap frame ke-n, hitung posisi scroll
   yang seharusnya, setel scrollTop secara langsung, lalu ambil
   tangkapan. Ini menghindari jitter akibat smooth-scroll
   peramban yang tidak terikat waktu frame.

   Keluaran: video-android/scene-XX/frame-0000.png
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { SCENES, ROLE } = require('./android-scenes');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'video-android');
const BASE = 'file:///' + ROOT.replace(/\\/g, '/');

const VW = 393, VH = 830;   // layar ponsel
const FPS = 30;
const DPR = 2;              // 786x1660 per frame, cukup tajam untuk 1080p

/** Pelembut gerak: mulai lambat, cepat di tengah, melambat di akhir */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

(async () => {
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const manifest = [];
  let totalFrames = 0;

  for (const s of SCENES) {
    const dir = path.join(OUT, `scene-${s.id}`);
    fs.mkdirSync(dir, { recursive: true });

    const ctx = await browser.newContext({
      viewport: { width: VW, height: VH },
      deviceScaleFactor: DPR,
      isMobile: true, hasTouch: true,
      reducedMotion: 'reduce',
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(`   ! ${s.f}: ${e.message.slice(0, 60)}`));

    if (s.role) {
      const u = ROLE[s.role];
      await page.addInitScript(({ uid, name, role }) => {
        localStorage.setItem('asta:v1:session', JSON.stringify({
          userId: uid, role, name, loginAt: new Date().toISOString()
        }));
      }, { uid: u.id, name: u.name, role: s.role });
    }

    try {
      await page.goto(`${BASE}/${s.f}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1500);
      if (s.prep) await s.prep(page);

      // Bersihkan toast agar tidak menutupi konten
      await page.evaluate(() => {
        const h = document.querySelector('.toast-host');
        if (h) h.remove();
      });
      await page.waitForTimeout(300);

      const nFrames = Math.round(s.action.seconds * FPS);
      const act = s.action;

      /* ---------- Tentukan rencana scroll ----------
         Kontainer scroll dicari secara dinamis: dokumen, body,
         atau elemen ber-overflow. Ini mencegah adegan diam
         diam-diam bila struktur halaman berubah. */
      let scrollTo = 0;
      let scrollMax = 0;

      if (act.type === 'scroll' || act.type === 'scrollTo') {
        const plan = await page.evaluate((sel) => {
          function scroller() {
            const de = document.documentElement;
            if (de.scrollHeight - de.clientHeight > 4) return { kind: 'doc', el: de };
            if (document.body.scrollHeight - document.body.clientHeight > 4)
              return { kind: 'body', el: document.body };
            const cands = document.querySelectorAll('.main, .content, .app');
            for (const c of cands) {
              if (c.scrollHeight - c.clientHeight > 4) return { kind: 'el', el: c };
            }
            return { kind: 'doc', el: de };
          }
          const s = scroller();
          const max = Math.max(0, s.el.scrollHeight - s.el.clientHeight);
          let want = max;
          if (sel) {
            const t = document.querySelector(sel);
            if (t) {
              const cur = s.kind === 'doc' ? window.scrollY : s.el.scrollTop;
              want = t.getBoundingClientRect().top + cur - s.el.clientHeight * 0.28;
            }
          }
          return {
            kind: s.kind,
            selector: s.kind === 'el'
              ? '.' + String(s.el.className).split(' ')[0]
              : null,
            max,
            target: Math.min(max, Math.max(0, want)),
          };
        }, act.target || null);

        scrollMax = plan.max;
        scrollTo = plan.target;
        s._scrollKind = plan.kind;
        s._scrollSel = plan.selector;

        if (scrollMax < 20) {
          console.log(`   ! scene-${s.id}: halaman tidak cukup panjang untuk scroll ` +
            `(maks ${Math.round(scrollMax)}px)`);
        }
      }

      /** Setel posisi scroll pada kontainer yang tepat */
      async function setScroll(y) {
        await page.evaluate(({ y, kind, sel }) => {
          if (kind === 'doc') { window.scrollTo(0, y); return; }
          const el = kind === 'body' ? document.body : document.querySelector(sel);
          if (el) el.scrollTop = y;
        }, { y, kind: s._scrollKind || 'doc', sel: s._scrollSel });
      }

      /* ---------- Sisipan aksi tap navigasi bawah ---------- */
      let tapPlan = null;
      if (act.type === 'tapTabbar') {
        tapPlan = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('.tabbar a'));
          return links.map(a => {
            const b = a.getBoundingClientRect();
            return {
              x: Math.round(b.left + b.width / 2),
              y: Math.round(b.top + b.height / 2),
              label: a.querySelector('.tb-label') ? a.querySelector('.tb-label').textContent : ''
            };
          });
        });
      }

      /* ---------- Rekam frame ---------- */
      let framesWritten = 0;
      let lastDrive = -1e9;

      for (let i = 0; i < nFrames; i++) {
        const t = nFrames > 1 ? i / (nFrames - 1) : 0;
        const elapsedMs = (i / FPS) * 1000;

        // Pemicu kontraksi berkala untuk adegan yang butuh sinyal hidup
        if (act.drive && elapsedMs - lastDrive >= act.drive.everyMs) {
          lastDrive = elapsedMs;
          await page.evaluate(({ ch, lv }) => {
            if (typeof Device !== 'undefined' && Device.state.connected) {
              Device.simulateContraction(ch, lv, 700);
            }
          }, { ch: act.drive.channel || 'ch1', lv: act.drive.level || 0.9 });
        }

        if (act.type === 'scroll' || act.type === 'scrollTo') {
          // Tahan sebentar di awal & akhir agar mata bisa menangkap konteks
          const holdIn = 0.14, holdOut = 0.12;
          let prog;
          if (t < holdIn) prog = 0;
          else if (t > 1 - holdOut) prog = 1;
          else prog = easeInOutCubic((t - holdIn) / (1 - holdIn - holdOut));
          await setScroll(Math.round(scrollTo * prog));
        }

        if (act.type === 'tapTabbar' && tapPlan && tapPlan.length >= 5) {
          // Sorot tujuan navigasi satu per satu agar terlihat interaktif
          const step = Math.floor(t * 5);
          const idx = Math.min(4, step);
          await page.evaluate((i2) => {
            document.querySelectorAll('.tabbar a').forEach((a, j) => {
              a.style.transform = j === i2 ? 'scale(1.12)' : '';
              a.style.background = j === i2 ? 'var(--primary-100)' : '';
              a.style.color = j === i2 ? 'var(--primary-700)' : '';
            });
          }, idx);
        }

        const file = path.join(dir, `frame-${String(i).padStart(4, '0')}.png`);
        await page.screenshot({ path: file });
        framesWritten++;
      }

      // Pastikan adegan scroll benar-benar berpindah posisi
      let moved = null;
      if (act.type === 'scroll' || act.type === 'scrollTo') {
        moved = await page.evaluate(({ kind, sel }) => {
          if (kind === 'doc') return Math.round(window.scrollY);
          const el = kind === 'body' ? document.body : document.querySelector(sel);
          return el ? Math.round(el.scrollTop) : 0;
        }, { kind: s._scrollKind || 'doc', sel: s._scrollSel });
      }

      manifest.push({
        id: s.id, kicker: s.kicker, title: s.title, sub: s.sub,
        page: s.f, role: s.role, frames: framesWritten,
        seconds: Number((framesWritten / FPS).toFixed(3)),
        action: act.type,
        scrollMax: Math.round(scrollMax),
        scrollEnd: moved,
      });
      totalFrames += framesWritten;

      var extra = '';
      if (moved !== null) {
        extra = `  scroll ${moved}/${Math.round(scrollMax)}px`;
        if (moved < 20 && scrollMax > 20) extra += '  <- TIDAK BERGERAK';
      }
      console.log(`[ OK ] scene-${s.id}  ${String(framesWritten).padStart(3)} frame  ` +
        `${act.type.padEnd(10)} ${s.title}${extra}`);
    } catch (e) {
      console.log(`[GAGAL] scene-${s.id} (${s.f}) — ${e.message.slice(0, 70)}`);
    }
    await ctx.close();
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
    fps: FPS, viewport: { w: VW, h: VH }, dpr: DPR,
    totalFrames, totalSeconds: Number((totalFrames / FPS).toFixed(2)),
    scenes: manifest
  }, null, 2));

  console.log(`\n${manifest.length} adegan, ${totalFrames} frame, ` +
    `${(totalFrames / FPS).toFixed(1)} detik mentah`);
})();
