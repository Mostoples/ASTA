"""
============================================================
ASTA — Pemeriksaan video semifinal
------------------------------------------------------------
Dijalankan setelah build.py. Tiga pemeriksaan:

1. SENYAP DI LUAR UCAPAN (objektif, tidak bergantung transkripsi)
   Di setiap segmen, audio sebelum kata pertama dan sesudah kata
   terakhir harus nyaris nol digital. Musik latar baru dicampur setelah
   penyambungan, jadi di tingkat segmen bagian ini hanya bisa berisi
   aba-aba yang bocor. Batasnya -50 dB puncak.

2. UJUNG-UJUNG SEGMEN (transkripsi)
   Kata pertama dan terakhir yang terdengar di setiap segmen dibaca
   ulang dengan Whisper medium, lalu diperiksa apakah berupa aba-aba.

3. WAJAH SISWA
   Satu frame dari setiap segmen berwajah dikumpulkan menjadi lembar
   kontak _build/wajah.jpg.

Jalankan:  python tools/asta-video/verify.py
============================================================
"""
import os, re, subprocess, sys, json, array, math

sys.path.insert(0, os.path.dirname(__file__))
import build as B

FP = B.FF.replace("ffmpeg.exe", "ffprobe.exe")
LIMIT_DB = -50.0
PROG = os.path.join(B.BUILD, "verify-progress.json")


def progress(stage, done, total, current=""):
    """Progres untuk panel pemantau (monitor.py)."""
    with open(PROG, "w", encoding="utf-8") as fh:
        json.dump({"stage": stage, "done": done, "total": total, "current": current}, fh,
                  ensure_ascii=False)


_PCM = {}


def _pcm(path):
    """Audio segmen didekode UTUH dari awal (mono 48 kHz, 16-bit)."""
    if path not in _PCM:
        r = subprocess.run([B.FF, "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "48000",
                            "-f", "s16le", "-"], capture_output=True)
        a = array.array("h")
        a.frombytes(r.stdout[: len(r.stdout) // 2 * 2])
        _PCM.clear()
        _PCM[path] = a
    return _PCM[path]


def peak_db(path, ss, dur):
    """Puncak (dBFS) pada rentang [ss, ss+dur].

    Sengaja TIDAK memakai -ss: pada audio AAC, lompatan posisi bisa mundur
    ke paket sebelumnya sehingga ekor kalimat ikut terukur dan segmen yang
    sebenarnya senyap dilaporkan bocor (positif palsu). Audio didekode dari
    awal berkas, lalu puncaknya dihitung pada sampel yang tepat."""
    if dur < 0.05:
        return None
    a = _pcm(path)
    i0, i1 = max(0, int(ss * 48000)), min(len(a), int((ss + dur) * 48000))
    if i1 <= i0:
        return None
    m = max(abs(x) for x in a[i0:i1])
    return -120.0 if m == 0 else 20 * math.log10(m / 32768)


_E16 = {}


def _env16(path):
    """Energi (dB) per 10 ms, dari audio segmen yang didekode utuh."""
    if path not in _E16:
        r = subprocess.run([B.FF, "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000",
                            "-f", "s16le", "-"], capture_output=True)
        a = array.array("h")
        a.frombytes(r.stdout[: len(r.stdout) // 2 * 2])
        _E16.clear()
        _E16[path] = [10 * math.log10(sum(x * x for x in a[i:i + 160]) / 160 + 1e-9)
                      for i in range(0, len(a) - 160, 160)]
    return _E16[path]


def lead_fragment(path, g0):
    """Pola aba-aba yang menempel: potongan ≤ 0,45 s, hening ≥ 0,24 s, lalu
    ucapan lagi — tepat setelah suara segmen dibuka. Diperiksa dari energi,
    karena transkripsi justru menyembunyikan potongan seperti "…ga"."""
    e = _env16(path)
    if not e:
        return None
    thr, n = max(e) - 20.0, len(e)
    i = max(0, int(g0 / 0.01))
    while i < n and e[i] < thr:
        i += 1
    b0, k, gap = i, i, 0
    while k < n and k - b0 < 63:
        gap = gap + 1 if e[k] < thr else 0
        if gap >= 18:                      # sama peka dengan build.py (GAP_MIN)
            break
        k += 1
    # potongan < 50 ms diabaikan: itu sisa tepi fade, bukan ucapan
    if gap < 18 or not (5 <= (k - 18 - b0) <= 45):
        return None
    m = k
    while m < n and e[m] < thr:
        m += 1
    return (round(b0 * 0.01, 2), round((k - 18) * 0.01, 2), round(m * 0.01, 2)) if m < n else None


def rel_gate(seg, dur):
    a = seg["a"]
    ass = seg["v"][1] if a == "sync" else a[1]
    sa, sb = seg["g"][0], seg["g"][1]
    g0 = max(0.0, sa - ass)
    g1 = min(dur, sb - ass)
    return g0, g1


def main():
    S = B.segments()
    speech = [s for s in S if "g" in s]
    # Hasil lama dihapus supaya panel tidak menampilkan verifikasi video sebelumnya
    vj = os.path.join(B.BUILD, "verify.json")
    if os.path.exists(vj):
        os.remove(vj)
    progress("Senyap di luar ucapan", 0, len(speech))

    # ---------- 1. senyap di luar ucapan ----------
    print("1. Senyap di luar ucapan (puncak, batas %.0f dB)\n" % LIMIT_DB)
    fail1 = []
    frags = {}
    for i, s in enumerate(speech):
        progress("Senyap di luar ucapan", i, len(speech), s["id"])
        f = os.path.join(B.SEGD, s["id"] + ".mp4")
        d = s.get("dur") or s["v"][2]
        g0, g1 = rel_gate(s, d)
        # sisakan 80 ms dari tepi fade supaya ekor fade tidak ikut terukur
        pre = peak_db(f, 0.0, g0 - 0.08)
        post = peak_db(f, g1 + 0.14, d - g1 - 0.14)
        bad = [x for x in (pre, post) if x is not None and x > LIMIT_DB]
        frag = lead_fragment(f, g0)
        tag = "BOCOR" if bad else ("POTONGAN AWAL?" if frag else "ok")
        if bad:
            fail1.append(s["id"])
        if frag:
            frags[s["id"]] = (s, f, frag)       # dipastikan di tahap 1b
        fmt = lambda x: "  -   " if x is None else f"{x:6.1f}"
        extra = f"   potongan {frag[0]}-{frag[1]} s, ucapan lagi {frag[2]} s" if frag else ""
        print(f"  {s['id']:>5}  sebelum {fmt(pre)} dB   sesudah {fmt(post)} dB   {tag}{extra}")

    # --quick: hanya pemeriksaan suara (hitungan detik, tanpa transkripsi)
    if "--quick" in sys.argv:
        print(f"\nsenyap di luar ucapan: {'OK, ' + str(len(speech)) + ' segmen' if not fail1 else 'BOCOR di ' + ', '.join(fail1)}")
        if frags:
            print(f"potongan awal perlu dipastikan lewat transkripsi (jalankan tanpa --quick): "
                  f"{', '.join(frags)}")
        sys.exit(1 if (fail1 or frags) else 0)

    # ---------- 2. ujung-ujung segmen ----------
    print("\n2. Kata di ujung-ujung segmen\n")
    from faster_whisper import WhisperModel
    m = WhisperModel("medium", device="cpu", compute_type="int8")

    # ---------- 1b. potongan awal: kata sungguhan atau aba-aba? ----------
    # Detektor energi tidak bisa membedakan "…ga" dari kata pertama yang
    # pendek dan diikuti jeda koma ("Kedua, …"). Potongan itu didengarkan
    # ulang SENDIRIAN, lalu dibandingkan dengan kata pertama kalimatnya.
    import difflib
    fail3 = []
    if frags:
        print("\n1b. Potongan pendek di awal segmen, didengarkan ulang\n")
    tmpw = os.path.join(B.BUILD, "_burst.wav")
    for sid, (s, f, (b0, b1, mm)) in frags.items():
        # Didengarkan BERSAMA 0,9 s ucapan sesudahnya: potongan 0,3 s tanpa
        # konteks membuat model berhalusinasi ("Terima kasih telah menonton!"
        # untuk kata "ASTA"). Yang dinilai: apakah kalimat dibuka kata yang benar.
        subprocess.run([B.FF, "-v", "error", "-y", "-i", f, "-ss", f"{max(0.0, b0 - 0.05):.2f}",
                        "-t", f"{mm - b0 + 0.9:.2f}", "-vn", "-ac", "1", "-ar", "16000", tmpw])
        segs, _ = m.transcribe(tmpw, language="id", beam_size=5, vad_filter=False,
                               condition_on_previous_text=False)
        heard = " ".join(x.text.strip() for x in segs).strip()
        exp = B._norm(s.get("gtxt", "").split(" ")[0])
        got = B._norm(heard.split(" ")[0]) if heard else ""
        sim = difflib.SequenceMatcher(None, exp, got).ratio() if (exp and got) else 0.0
        legit = bool(got) and not B._is_cue(got) and (sim >= 0.5 or exp[:3] == got[:3])
        print(f"  {sid:>5}  terdengar «{heard}»  diharapkan «{exp}»  -> "
              f"{'kata pertama sungguhan' if legit else 'ABA-ABA / MENCURIGAKAN'}")
        if not legit:
            fail3.append((sid, heard))
    if os.path.exists(tmpw):
        os.remove(tmpw)

    fail2 = []
    for i, s in enumerate(speech):
        progress("Transkripsi ujung segmen", i, len(speech), s["id"])
        f = os.path.join(B.SEGD, s["id"] + ".mp4")
        segs, _ = m.transcribe(f, language="id", beam_size=5, vad_filter=False,
                               word_timestamps=True, condition_on_previous_text=False)
        ws = [w.word.strip() for x in segs for w in (x.words or [])]
        if not ws:
            print(f"  {s['id']:>4}  (tidak terbaca)"); continue
        edge = [ws[0], ws[-1]]
        cue = [w for w in edge if B._is_cue(w)]
        if cue:
            fail2.append((s["id"], cue))
        print(f"  {s['id']:>4}  «{ws[0]} … {ws[-1]}»" + (f"   ABA-ABA? {cue}" if cue else ""))

    # ---------- 3. wajah siswa ----------
    progress("Lembar wajah siswa", 0, 1)
    from PIL import Image, ImageDraw, ImageFont
    faces = [s for s in S if "[wajah]" in s["note"] or "perkenalan" in s["note"]]
    TW, TH, LAB, COLS = 480, 270, 26, 4
    rows = (len(faces) + COLS - 1) // COLS
    sheet = Image.new("RGB", (TW * COLS, (TH + LAB) * rows), (16, 18, 22))
    dr = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("segoeuib.ttf", 16)
    except Exception:
        font = ImageFont.load_default()
    tmp = os.path.join(B.BUILD, "_f.jpg")
    for i, s in enumerate(faces):
        r, c = divmod(i, COLS)
        x, y = c * TW, r * (TH + LAB)
        d = s["v"][2]
        subprocess.run([B.FF, "-v", "error", "-y", "-ss", f"{d * 0.5:.2f}",
                        "-i", os.path.join(B.SEGD, s["id"] + ".mp4"), "-frames:v", "1",
                        "-vf", f"scale={TW}:{TH}", tmp], capture_output=True)
        dr.rectangle([x, y, x + TW, y + LAB], fill=(28, 34, 46))
        dr.text((x + 8, y + 4), f"{s['id']}  {s['note'][:44]}", fill=(180, 215, 255), font=font)
        if os.path.exists(tmp):
            sheet.paste(Image.open(tmp), (x, y + LAB))
    out = os.path.join(B.BUILD, "wajah.jpg")
    sheet.save(out, quality=84)
    if os.path.exists(tmp):
        os.remove(tmp)

    # ---------- ringkasan ----------
    r = subprocess.run([FP, "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", B.OUT], capture_output=True, text=True)
    total = float(r.stdout.strip() or 0)
    print("\n=== Ringkasan ===")
    print(f"  durasi video      {int(total // 60)}:{total % 60:04.1f}  "
          f"{'OK' if 0 < total <= 300 else 'MELEBIHI 5 MENIT'}")
    print(f"  senyap di luar    {'OK' if not fail1 else 'BOCOR di ' + ', '.join(fail1)}")
    print(f"  ujung segmen      {'OK' if not fail2 else fail2}")
    print(f"  lembar wajah      {os.path.relpath(out, B.ROOT)}  ({len(faces)} segmen)")
    print(f"  potongan awal     {'OK' if not fail3 else fail3}"
          f"{'  (' + str(len(frags)) + ' ditandai, semuanya kata pertama sungguhan)' if frags and not fail3 else ''}")
    # Ringkasan untuk panel pemantau (monitor.py)
    ok = not (fail1 or fail2 or fail3 or not (0 < total <= 300))
    with open(os.path.join(B.BUILD, "verify.json"), "w", encoding="utf-8") as fh:
        json.dump({"ok": ok, "duration": total, "checked": len(speech),
                   "silence_fail": fail1, "edge_fail": fail2 + fail3}, fh, ensure_ascii=False)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
