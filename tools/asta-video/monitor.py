"""
============================================================
ASTA — Panel pemantau build video
------------------------------------------------------------
Panel lokal di peramban untuk memantau build.py dan verify.py:
tahap aktif, frame motion graphic, segmen yang sudah jadi,
perkiraan waktu selesai, video akhir, dan hasil verifikasi.

Keadaan dibaca langsung dari folder _build (bukan dari log), jadi
panel bisa dibuka kapan saja — sebelum, selama, atau sesudah build.

Jalankan:  python tools/asta-video/monitor.py
           lalu buka http://localhost:8240  (dibuka otomatis)
============================================================
"""
import os, sys, json, glob, time, threading, webbrowser, subprocess
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BUILD = os.path.join(ROOT, "ASTA REKAMAN FIX MP4", "_build")
SEGD = os.path.join(BUILD, "seg")
MGD = os.path.join(BUILD, "mg")
OUT = os.path.join(ROOT, "ASTA - Video Semifinal HRIE 2026.mp4")
FFPROBE = os.path.expandvars(
    r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source"
    r"_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffprobe.exe")
PORT = 8240

_fallback = {"plan": None, "loading": False}
_probe = {"mtime": None, "dur": None}


def _mtime(p):
    return os.path.getmtime(p) if os.path.exists(p) else None


def _load_fallback_plan():
    """Build yang dimulai sebelum ada plan.json: hitung rencana dari build.py."""
    _fallback["loading"] = True
    try:
        sys.path.insert(0, HERE)
        import build as B
        S = B.segments()
        _fallback["plan"] = {"segments": [
            {"id": s["id"], "note": s["note"],
             "dur": s.get("dur") or s.get("black") or s["v"][2]} for s in S]}
    except Exception as e:                      # panel tetap jalan tanpa rencana
        _fallback["plan"] = {"segments": [], "error": str(e)}
    _fallback["loading"] = False


def _plan():
    p = os.path.join(BUILD, "plan.json")
    if os.path.exists(p):
        try:
            return json.load(open(p, encoding="utf-8"))
        except Exception:
            pass
    return _fallback["plan"]


def _duration(path):
    m = _mtime(path)
    if m and _probe["mtime"] != m:
        r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                            "-of", "csv=p=0", path], capture_output=True, text=True)
        try:
            _probe["dur"] = float(r.stdout.strip())
            _probe["mtime"] = m
        except ValueError:
            return None
    return _probe["dur"]


def status():
    now = time.time()

    # ---- motion graphic ----
    jobs = []
    jf = os.path.join(MGD, "jobs.json")
    if os.path.exists(jf):
        try:
            jobs = json.load(open(jf, encoding="utf-8"))
        except Exception:
            jobs = []
    mg, ftot, fdone, newest = [], 0, 0, 0.0
    for j in jobs:
        n = round(j["dur"] * 30)
        d = os.path.join(MGD, j["sid"])
        k = len(glob.glob(os.path.join(d, "f-*.jpg"))) if os.path.isdir(d) else 0
        done = os.path.exists(os.path.join(d, "job.json")) and k >= n
        got = n if done else min(k, n)
        mg.append({"id": j["sid"], "scene": j["scene"], "frames": got, "total": n, "done": done})
        ftot += n
        fdone += got
        if os.path.isdir(d):
            newest = max(newest, os.path.getmtime(d))

    # ---- segmen ----
    P = _plan() or {"segments": []}
    segs, times = [], []
    for s in P.get("segments", []):
        f = os.path.join(SEGD, s["id"] + ".mp4")
        t = _mtime(f)
        ok = t is not None and os.path.getsize(f) > 0
        segs.append({"id": s["id"], "note": s["note"], "dur": round(s["dur"], 2), "done": ok})
        if ok:
            times.append(t)
    nseg, ndone = len(segs), sum(x["done"] for x in segs)
    last_seg = max(times) if times else None

    # ---- sambung, musik, verifikasi ----
    j = _mtime(os.path.join(BUILD, "joined.mp4"))
    o = _mtime(OUT)
    final = bool(nseg and ndone == nseg and o and last_seg and o >= last_seg)
    verify = None
    vf = os.path.join(BUILD, "verify.json")
    if final and os.path.exists(vf) and _mtime(vf) >= o:
        try:
            verify = json.load(open(vf, encoding="utf-8"))
        except Exception:
            verify = None

    # Progres verify.py yang sedang berjalan (tiga tahap, diberi bobot
    # sesuai lamanya: transkripsi paling lama)
    vprog, vp = None, 0.0
    pf = os.path.join(BUILD, "verify-progress.json")
    if final and not verify and os.path.exists(pf) and _mtime(pf) >= o:
        try:
            vprog = json.load(open(pf, encoding="utf-8"))
            W = {"Senyap di luar ucapan": (0.0, 0.15), "Transkripsi ujung segmen": (0.15, 0.80),
                 "Lembar wajah siswa": (0.95, 0.05)}
            base, w = W.get(vprog["stage"], (0.0, 1.0))
            vp = base + w * (vprog["done"] / max(1, vprog["total"]))
        except Exception:
            vprog = None

    # ---- tahap & perkiraan waktu ----
    stages = [
        {"name": "Motion graphic", "p": (fdone / ftot) if ftot else 1.0,
         "detail": f"{fdone}/{ftot} frame"},
        {"name": "Segmen", "p": (ndone / nseg) if nseg else 0.0,
         "detail": f"{ndone}/{nseg} segmen"},
        {"name": "Sambung & musik", "p": 1.0 if final else 0.0,
         "detail": "selesai" if final else "menunggu segmen"},
        {"name": "Verifikasi", "p": 1.0 if verify else vp,
         "detail": ("lolos" if verify and verify.get("ok") else
                    "ada temuan" if verify else
                    f"{vprog['stage'].lower()} {vprog['done']}/{vprog['total']}" if vprog else
                    "belum dijalankan")},
    ]
    active = next((i for i, s in enumerate(stages) if s["p"] < 1.0), len(stages))

    eta = None
    if 1 < ndone < nseg:
        ts = sorted(times)[-9:]
        rate = (ts[-1] - ts[0]) / max(1, len(ts) - 1)
        eta = round(rate * (nseg - ndone) + 60)          # +60 s sambung & musik
    elif ftot and fdone < ftot:
        eta = None                                        # laju frame belum stabil

    recent = max([x for x in [last_seg, newest, j, o, _mtime(pf) if vprog else None] if x] or [0])
    running = (now - recent) < 90 and (not final or (vprog is not None and not verify))

    out = None
    if final:
        out = {"name": os.path.basename(OUT), "mb": round(os.path.getsize(OUT) / 1e6, 1),
               "dur": _duration(OUT), "time": time.strftime("%H:%M:%S", time.localtime(o))}

    current = next((s for s in segs if not s["done"]), None)
    return {"now": time.strftime("%H:%M:%S"), "running": running, "active": active,
            "stages": stages, "eta": eta, "mg": mg, "segments": segs,
            "current": current, "out": out, "verify": verify,
            "planning": _fallback["loading"], "plan_error": (P or {}).get("error")}


PAGE = r"""<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>ASTA — Pemantau Build</title>
<style>
 :root{--navy:#0d3068;--blue:#2f7fe0;--ok:#10a574;--warn:#d98b0b;--bad:#d6453d;--ink:#0e2038;--muted:#5b789c;
       --bg:#f3f8ff;--card:#fff;--line:rgba(19,72,150,.12)}
 @media (prefers-color-scheme:dark){:root{--ink:#e8f0ff;--muted:#8ea6c8;--bg:#0a1424;--card:#10203a;--line:rgba(143,192,255,.14)}}
 *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 'Segoe UI',system-ui,sans-serif}
 main{max-width:1080px;margin:0 auto;padding:28px 22px 60px}
 header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
 h1{font-size:24px;margin:0;letter-spacing:-.01em} .sub{color:var(--muted);font-size:14px}
 .pill{padding:6px 14px;border-radius:999px;font-weight:700;font-size:13px;display:inline-flex;gap:8px;align-items:center}
 .pill i{width:9px;height:9px;border-radius:50%;background:currentColor}
 .run{background:rgba(47,127,224,.14);color:var(--blue)} .run i{animation:b 1s infinite}
 .done{background:rgba(16,165,116,.14);color:var(--ok)} .idle{background:rgba(91,120,156,.14);color:var(--muted)}
 @keyframes b{50%{opacity:.25}}
 .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin-top:18px}
 .stage{display:grid;grid-template-columns:170px 1fr 150px;gap:14px;align-items:center;padding:9px 0}
 .stage b{font-weight:700} .bar{height:10px;border-radius:6px;background:var(--line);overflow:hidden}
 .bar span{display:block;height:100%;background:linear-gradient(90deg,var(--blue),#3fd0c9);transition:width .6s}
 .stage.cur b{color:var(--blue)} .stage small{color:var(--muted);text-align:right}
 .big{display:flex;gap:28px;flex-wrap:wrap;align-items:baseline}
 .big div b{display:block;font-size:30px;letter-spacing:-.02em} .big div span{color:var(--muted);font-size:13px}
 .grid{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
 .sg{font-size:12px;padding:5px 8px;border-radius:8px;border:1px solid var(--line);color:var(--muted);font-variant-numeric:tabular-nums}
 .sg.ok{background:rgba(16,165,116,.12);color:var(--ok);border-color:transparent}
 .sg.now{background:rgba(47,127,224,.16);color:var(--blue);border-color:var(--blue);animation:b 1.2s infinite}
 h2{font-size:15px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
 table{width:100%;border-collapse:collapse;font-size:14px} td{padding:6px 4px;border-top:1px solid var(--line)}
 .ok{color:var(--ok)} .bad{color:var(--bad)} .muted{color:var(--muted)}
</style></head><body><main>
<header><div><h1>Pemantau Build Video ASTA</h1><div class="sub" id="sub">memuat…</div></div><div id="state"></div></header>
<section class="card"><div class="big" id="big"></div></section>
<section class="card"><h2>Tahap</h2><div id="stages"></div></section>
<section class="card"><h2>Segmen</h2><div class="sub" id="curr"></div><div class="grid" id="segs"></div></section>
<section class="card"><h2>Motion graphic</h2><div class="grid" id="mg"></div></section>
<section class="card" id="vcard" hidden><h2>Hasil</h2><div id="verify"></div></section>
</main>
<script>
function fmt(s){ if(s==null) return '—'; s=Math.max(0,Math.round(s)); var m=Math.floor(s/60); return m? m+' mnt '+(s%60)+' dtk' : s+' dtk'; }
function mmss(s){ if(s==null) return '—'; var m=Math.floor(s/60); return m+':'+(s%60).toFixed(1).padStart(4,'0'); }
function esc(t){ return String(t).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]}); }
async function tick(){
  var r; try{ r = await (await fetch('/status',{cache:'no-store'})).json(); }catch(e){ document.getElementById('sub').textContent='panel tidak terhubung'; return; }
  document.getElementById('sub').textContent = 'diperbarui '+r.now+(r.planning?' · menghitung rencana segmen…':'');
  var st = r.out ? '<span class="pill done"><i></i>Selesai</span>' : r.running ? '<span class="pill run"><i></i>Sedang berjalan</span>' : '<span class="pill idle"><i></i>Tidak ada proses aktif</span>';
  document.getElementById('state').innerHTML = st;
  var done = r.segments.filter(function(s){return s.done}).length;
  var total = r.stages.reduce(function(a,s){return a+s.p},0)/r.stages.length;
  document.getElementById('big').innerHTML =
    '<div><b>'+Math.round(total*100)+'%</b><span>keseluruhan</span></div>'+
    '<div><b>'+(r.eta!=null?fmt(r.eta):(r.out?'selesai':'—'))+'</b><span>perkiraan sisa</span></div>'+
    '<div><b>'+done+' / '+r.segments.length+'</b><span>segmen jadi</span></div>'+
    (r.out ? '<div><b>'+mmss(r.out.dur)+'</b><span>durasi video · '+r.out.mb+' MB</span></div>' : '');
  document.getElementById('stages').innerHTML = r.stages.map(function(s,i){
    return '<div class="stage'+(i===r.active?' cur':'')+'"><b>'+s.name+'</b><div class="bar"><span style="width:'+(s.p*100).toFixed(1)+'%"></span></div><small>'+esc(s.detail)+'</small></div>'; }).join('');
  document.getElementById('curr').textContent = r.current ? 'Sedang dikerjakan: '+r.current.id+' — '+r.current.note : (r.segments.length?'Semua segmen selesai':'');
  document.getElementById('segs').innerHTML = r.segments.map(function(s){
    var cls = s.done?'ok':(r.current&&s.id===r.current.id&&r.running?'now':'');
    return '<span class="sg '+cls+'" title="'+esc(s.note)+' · '+s.dur+' s">'+s.id+'</span>'; }).join('');
  document.getElementById('mg').innerHTML = r.mg.map(function(m){
    return '<span class="sg '+(m.done?'ok':'')+'" title="'+m.frames+'/'+m.total+' frame">'+m.id+' · '+m.scene+'</span>'; }).join('') || '<span class="muted">belum ada</span>';
  var vc=document.getElementById('vcard');
  if(r.out){ vc.hidden=false;
    var v=r.verify, rows='<tr><td>Berkas</td><td>'+esc(r.out.name)+' · '+r.out.mb+' MB · selesai '+r.out.time+'</td></tr>'+
      '<tr><td>Durasi</td><td class="'+(r.out.dur<=300?'ok':'bad')+'">'+mmss(r.out.dur)+(r.out.dur<=300?' (≤ 5:00)':' — MELEBIHI 5 MENIT')+'</td></tr>';
    if(v){ rows+='<tr><td>Senyap di luar ucapan</td><td class="'+(v.silence_fail.length?'bad':'ok')+'">'+(v.silence_fail.length?'bocor di '+v.silence_fail.join(', '):'lolos, '+v.checked+' segmen')+'</td></tr>'+
      '<tr><td>Ujung segmen</td><td class="'+(v.edge_fail.length?'bad':'ok')+'">'+(v.edge_fail.length?esc(JSON.stringify(v.edge_fail)):'tidak ada aba-aba')+'</td></tr>'; }
    else rows+='<tr><td>Verifikasi</td><td class="muted">belum dijalankan untuk video ini</td></tr>';
    document.getElementById('verify').innerHTML='<table>'+rows+'</table>'; }
}
tick(); setInterval(tick, 1500);
</script></body></html>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith("/status"):
            body = json.dumps(status(), ensure_ascii=False).encode("utf-8")
            ctype = "application/json; charset=utf-8"
        else:
            body = PAGE.encode("utf-8")
            ctype = "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def main():
    if not os.path.exists(os.path.join(BUILD, "plan.json")):
        threading.Thread(target=_load_fallback_plan, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    url = f"http://localhost:{PORT}"
    print(f"Panel pemantau: {url}  (Ctrl+C untuk berhenti)")
    if "--no-browser" not in sys.argv:
        webbrowser.open(url)
    srv.serve_forever()


if __name__ == "__main__":
    main()
