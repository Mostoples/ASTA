"""
============================================================
ASTA — Perakit video semifinal HRIE 2026
------------------------------------------------------------
Merakit video 1920x1080 (16:9, 30 fps) dari:
  - klip kamera yang sudah dinamai per scene
  - footage tangan bionik
  - voice over (slate terucap di awal dipotong lewat titik CUT)
  - kartu grafis hasil render-cards.js
  - potongan showreel aplikasi dan dasbor

Dua tahap supaya kegagalan mudah dilacak:
  1. tiap segmen dirender terpisah ke _build/seg/NN.mp4 dengan
     spesifikasi identik (1920x1080, 30 fps, yuv420p, 48 kHz stereo)
  2. seluruh segmen disambung tanpa encode ulang, lalu musik latar
     dicampur dengan ducking terhadap narasi

Jalankan:  python tools/asta-video/build.py
============================================================
"""
import os, subprocess, sys, json, shutil, array, math, re, unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MED  = os.path.join(ROOT, "ASTA REKAMAN FIX MP4")
FTG  = os.path.join(MED, "FOOTAGE TANGAN BIONIC")
VO   = os.path.join(MED, "VOICE OVER")
BUILD= os.path.join(MED, "_build")
SEGD = os.path.join(BUILD, "seg")
CARD = os.path.join(BUILD, "cards")
OUT  = os.path.join(ROOT, "ASTA - Video Semifinal HRIE 2026.mp4")
BGM  = os.path.join(MED, "BACKGROUND MUSIC.mp3")

FF = os.path.expandvars(
    r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source"
    r"_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffmpeg.exe")
FPS, W, H = 30, 1920, 1080
BG = "0xEFF6FF"          # latar terang, senada dengan kartu dan footage putih

def med(n):  return os.path.join(MED, n)
def ftg(n):  return os.path.join(FTG, n)
def vo(n):   return os.path.join(VO, n)
def card(n): return os.path.join(CARD, n + ".png")

# ---------- pustaka footage ----------
F_DETAIL   = ftg("FTG DETAIL TELAPAK-LENGAN - S07 S12 [203849477].mp4")
F_DETAIL2  = ftg("FTG DETAIL LENGAN-JARI - S07 reveal [203135485].mp4")
F_ANGKAT1  = ftg("FTG GENGGAM-ANGKAT - S04 S17 [191926789].mp4")
F_ANGKAT2  = ftg("FTG GENGGAM-ANGKAT - S04 S17 [192143512].mp4")
F_ANGKAT3  = ftg("FTG GENGGAM-ANGKAT - S04 S17 [192322488].mp4")
F_GENGGAM  = ftg("FTG GENGGAM - S03 S13D [192201942].mp4")
F_BEAUTY1  = ftg("FTG GENGGAM MULTI-ANGLE - S12 beauty [192458957].mp4")
F_BEAUTY2  = ftg("FTG GENGGAM-LEPAS MULTI-ANGLE - S12 beauty [192758208].mp4")
F_JANGKAU1 = ftg("FTG JANGKAU-KONTAK - S05 S13C [193000137].mp4")
F_JANGKAU2 = ftg("FTG JANGKAU-KONTAK - S05 S13C [193038539].mp4")
F_JANGKAU3 = ftg("FTG JANGKAU-KONTAK - S05 S13D [193548843].mp4")
F_ALUR     = ftg("FTG JANGKAU-GENGGAM PENUH - S13B S13C [193354575].mp4")
F_KONTAK   = ftg("FTG BUKA JARI-KONTAK - S13C [201719110].mp4")
F_BUKATUTUP= ftg("FTG BUKA-TUTUP - S13B S13E [202757315].mp4")

SHOW_AND = os.path.join(ROOT, "ASTA-showreel-android-1080p.mp4")
SHOW_DSK = os.path.join(ROOT, "ASTA-showreel-desktop-1080p.mp4")
# Ambil hanya mockup perangkatnya, supaya hiasan showreel tidak ikut terbawa
CROP_PHONE = f"crop=441:878:1168:92,scale=-2:980,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={BG}"
CROP_BROWS = f"crop=1204:842:628:128,scale=-2:1000,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={BG}"

# Daftar segmen ada di segments(), di bawah fungsi pemotongan presisi.

# ---------- transisi antar scene naskah ----------
# Kunci = indeks scene tujuan (1 = S1→S2, …, 16 = S16→S17). Di dalam satu
# scene segmen disambung langsung; hanya pergantian scene yang bertransisi.
XF = 0.5
TRANS = {
    1: "fade",          # video intro → "Setiap hari…"
    2: "fade",
    3: "slideleft",     # menggenggam → mengangkat → menjangkau: berirama
    4: "slideleft",
    5: "fade",          # piktogram → wajah siswa
    6: "circleopen",    # dari hitam: reveal ASTA (naskah: reveal sinematik)
    7: "fade",
    8: "smoothleft",    # bagian penjelasan
    9: "smoothleft",
    10: "smoothleft",
    11: "smoothleft",
    12: "wipeleft",     # product shot → demonstrasi
    13: "smoothleft",
    14: "smoothleft",
    15: "smoothleft",
    16: "fadeblack",    # menuju penutup
}


def probe_dur(path):
    r = subprocess.run([FF.replace("ffmpeg.exe", "ffprobe.exe"), "-v", "error",
                        "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def run(args, label):
    r = subprocess.run([FF, "-hide_banner", "-v", "error", "-y"] + args,
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(f"\nGAGAL pada {label}:\n" + (r.stderr or "").strip()[-1500:])
        sys.exit(1)


def vfilter(seg):
    """Rantai video: normalkan ke 1920x1080, tangani sumber potret."""
    if "vf" in seg:
        base = seg["vf"]
    else:
        base = (f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
                f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={BG}")
    return f"fps={FPS},{base},setsar=1,format=yuv420p"


def portrait(path):
    r = subprocess.run([FF.replace("ffmpeg.exe", "ffprobe.exe"), "-v", "error",
                        "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        w, h = [int(x) for x in r.stdout.strip().split(",")[:2]]
        return h > w
    except Exception:
        return False


# ============================================================
# Pemotongan suara presisi
# ------------------------------------------------------------
# Aba-aba perekam ("dua, tiga", "oke", slate "Scene 13C") bisa bocor
# karena dua hal: stempel waktu Whisper hanya tepat ±0,1 detik, dan
# aba-aba yang diucapkan pelan sering tidak tertranskripsi sama sekali.
#
# Karena itu setiap segmen bersuara diperlakukan begini:
#   1. dari words.json diambil kata pertama dan terakhir yang BUKAN
#      aba-aba di dalam jendela segmen
#   2. batas potongnya digeser ke titik lembah energi terdekat
#      (jeda antarkata), bukan langsung di stempel Whisper
#   3. seluruh audio di luar batas itu dibungkam (fade 30/60 ms),
#      sehingga aba-aba yang tak tertranskripsi pun ikut terbuang
# ============================================================
WJSON = os.path.join(BUILD, "words.json")
WORDS = json.load(open(WJSON, encoding="utf-8")) if os.path.exists(WJSON) else {}
HOP = 0.01                                   # resolusi amplop energi: 10 ms
CUE = {"satu", "dua", "tiga", "oke", "ok", "okay", "sip", "action", "cut", "scene",
       "sin", "sim", "syn", "sinti", "kamera", "rolling", "take", "siap", "mulai",
       "yak", "udah", "sudah"}
_ENV = {}
GATES = {}


def _norm(w):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", w).lower())


def _is_cue(w):
    n = _norm(w)
    return (not n) or n in CUE or re.fullmatch(r"\d+[a-f]?", n) is not None


def envelope(path):
    """Energi (dB) per 10 ms dari audio mono 16 kHz."""
    if path in _ENV:
        return _ENV[path]
    r = subprocess.run([FF, "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000",
                        "-f", "s16le", "-"], capture_output=True)
    a = array.array("h"); a.frombytes(r.stdout[: len(r.stdout) // 2 * 2])
    hop = int(16000 * HOP)
    env = []
    for i in range(0, len(a) - hop, hop):
        s = 0
        for x in a[i:i + hop]:
            s += x * x
        env.append(10 * math.log10(s / hop + 1e-9))
    _ENV[path] = env
    return env


def onset(env, t):
    """Titik lembah terakhir sebelum kata yang dimulai sekitar t."""
    i0 = max(0, int((t - 0.30) / HOP)); i1 = min(len(env) - 1, int((t + 0.06) / HOP))
    if i1 <= i0:
        return t
    w = env[i0:i1 + 1]; m = min(w)
    k = max(j for j, v in enumerate(w) if v <= m + 4.0)
    return (i0 + k) * HOP


def offset(env, t):
    """Titik lembah pertama setelah kata yang berakhir sekitar t."""
    i0 = max(0, int((t - 0.05) / HOP)); i1 = min(len(env) - 1, int((t + 0.35) / HOP))
    if i1 <= i0:
        return t
    w = env[i0:i1 + 1]; m = min(w)
    k = min(j for j, v in enumerate(w) if v <= m + 4.0)
    return (i0 + k) * HOP + 0.02


# ------------------------------------------------------------
# Potongan aba-aba yang menempel di awal klip
# ------------------------------------------------------------
# Kamera sering mulai merekam saat perekam masih mengucapkan "…ga" dari
# "tiga". Polanya konsisten: potongan pendek (≤ 0,45 s), hening ≥ 0,24 s,
# lalu narasi. Transkripsi merentangkan kata pertama menutupi potongan
# DAN jedanya, sehingga gerbang ikut membuka di detik nol. Karena itu
# potongan ini dicari dari energi suara, bukan dari transkripsi.
# Hening minimal 0,18 s (bukan 0,24): di S11 jeda sesudah potongan terpecah
# oleh satu letupan kecil sehingga terukur sedikit di bawah 0,24 s. Aman,
# karena skip_fragment tetap mensyaratkan transkripsi merentangkan kata
# pertama melewati jeda itu.
FRAG_MAX, GAP_MIN = 45, 18          # dalam satuan 10 ms


def _thr(env):
    return sorted(env)[len(env) // 10] + 6.0       # lantai derau + 6 dB


def skip_fragment(env, sa, w_end, force=False):
    """Awal ucapan sesungguhnya bila di `sa` ada potongan pendek + jeda.

    Tanpa `force`, hanya berlaku bila transkripsi merentangkan kata pertama
    (w_end) melewati jeda itu — tanda pasti bahwa potongan tersebut bukan
    kata pertama. Kata pendek sungguhan yang diikuti jeda tidak tersentuh."""
    thr, n = _thr(env), len(env)
    i = max(0, int(sa / HOP))
    while i < n and env[i] < thr:
        i += 1
    b0, k, gap = i, i, 0
    while k < n and k - b0 < FRAG_MAX + GAP_MIN:
        gap = gap + 1 if env[k] < thr else 0
        if gap >= GAP_MIN:
            break
        k += 1
    if gap < GAP_MIN or (k - GAP_MIN - b0) > FRAG_MAX:
        return None
    m = k
    while m < n and env[m] < thr:
        m += 1
    if m >= n:
        return None
    ns = m * HOP
    if force or w_end > ns + 0.10:
        return max(0.0, ns - 0.03)
    return None


def first_burst(env, t):
    thr, i = _thr(env), max(0, int(t / HOP))
    while i < len(env) and env[i] < thr:
        i += 1
    return max(0.0, i * HOP - 0.03)


def energy_end(env, t):
    """Akhir rangkaian ucapan yang dimulai di t (jeda ≥ 0,24 s menandai akhir)."""
    thr, n = _thr(env), len(env)
    i = k = max(0, int(t / HOP))
    last, gap = i, 0
    while k < n:
        if env[k] >= thr:
            last, gap = k, 0
        else:
            gap += 1
            if gap >= GAP_MIN and k - i > 20:
                break
        k += 1
    return last * HOP + 0.05


# Perluasan batas memakai ambang 4 dB lebih ketat dari _thr(): desis ruangan
# tipis tepat di atas ambang sempat terhitung sebagai ucapan, sehingga akhir
# "pengujian" (S14a) meluas menyeberangi jeda sampai bunyi "t-" dari kata
# berikutnya, "terhadap", ikut lolos. EXT_STRICT=False = perilaku lama
# (dipakai untuk membandingkan segmen mana yang berubah).
EXT_STRICT = True
EXT_MARGIN_DB = 4.0


def _ext_thr(env):
    return _thr(env) + (EXT_MARGIN_DB if EXT_STRICT else 0.0)


def extend_back(env, t, lo_t, max_s=0.35):
    """Mundurkan awal ucapan selama energinya bersambung (celah ≤ 30 ms).

    Awal kata yang lembut — vokal, desis — sering mendahului stempel
    transkripsi: "ASTA" di VO Scene 15 mulai 4,61 s, stempelnya 4,94 s,
    sehingga "AS-" terpotong. Tidak melewati lo_t (akhir kata sebelumnya)."""
    thr = _ext_thr(env)
    i = int(t / HOP)
    lo = max(0, int((lo_t + (0.03 if EXT_STRICT else 0.0)) / HOP))
    first, dip, j = i, 0, i - 1
    while j >= lo and (i - j) <= int(max_s / HOP):
        if env[j] >= thr:
            first, dip = j, 0
        else:
            dip += 1
            if dip > 3:
                break
        j -= 1
    return first * HOP


def extend_fwd(env, t, hi_t, max_s=0.35):
    """Majukan akhir ucapan selama energinya bersambung.

    Berhenti 50 ms sebelum hi_t (awal kata berikutnya), supaya bunyi awal
    kata sesudahnya tidak ikut terbawa."""
    thr = _ext_thr(env)
    i = int(t / HOP)
    hi = min(len(env) - 1, int((hi_t - (0.05 if EXT_STRICT else 0.0)) / HOP))
    last, dip, j = i - 1, 0, i
    while j <= hi and (j - i) <= int(max_s / HOP):
        if env[j] >= thr:
            last, dip = j, 0
        else:
            dip += 1
            if dip > 3:
                break
        j += 1
    return max(t, (last + 1) * HOP)


def split_point(env, ws, k):
    """Titik belah bersama antara kata k-1 dan kata k: energi terendah di sekitarnya.

    Dipakai sebagai akhir segmen sebelumnya DAN awal segmen berikutnya pada
    sambungan L-cut, sehingga tidak ada suara yang hilang maupun terulang."""
    a = min(ws[k - 1][2], ws[k][1]) - 0.12
    b = max(ws[k - 1][2], ws[k][1]) + 0.12
    i0, i1 = max(0, int(a / HOP)), min(len(env) - 1, int(b / HOP))
    if i1 <= i0:
        return ws[k][1]
    w = env[i0:i1 + 1]
    return (i0 + min(range(len(w)), key=lambda x: w[x])) * HOP


def gate(path, ss, dur, gin=True, gout=True):
    """Batas suara (detik, relatif terhadap awal segmen) + ringkasan kata."""
    key = os.path.relpath(path, MED).replace("\\", "/")
    ws = WORDS.get(key)
    if not ws:
        return None, None, "(tanpa data kata)"
    inside = [w for w in ws if w[2] > ss + 0.02 and w[1] < ss + dur - 0.02]
    while inside and _is_cue(inside[0][0]):
        inside.pop(0)
    while inside and _is_cue(inside[-1][0]):
        inside.pop()
    if not inside:
        return None, None, "(tidak ada kata)"
    env = envelope(path)
    g0 = g1 = None
    if gin and inside[0][1] > ss + 0.02:
        g0 = max(0.0, onset(env, inside[0][1]) - ss)
    if gout and inside[-1][2] < ss + dur - 0.02:
        g1 = min(dur, offset(env, inside[-1][2]) - ss)
    return g0, g1, f"{inside[0][0]} … {inside[-1][0]}"


def _words(path):
    key = os.path.relpath(path, MED).replace("\\", "/")
    if key not in WORDS:
        raise SystemExit(f"Tidak ada data kata untuk {key}. Jalankan analyze.py dulu.")
    return WORDS[key]


def _find(ws, text, start=0):
    t = _norm(text)
    for i in range(start, len(ws)):
        if _norm(ws[i][0]) == t:
            return i
    raise SystemExit(f"Kata '{text}' tidak ditemukan (mulai indeks {start}).")


def span(path, first=None, last=None, lead=0.0, tail=0.0, after=None,
         i0=None, i1=None, energy=False, joint_in=False, joint_out=False):
    """(mulai, durasi) sebuah ucapan, dari kata `first` sampai `last`.

    Titik potong diturunkan dari kata, bukan ditulis tangan, supaya tidak
    pernah jatuh di tengah kata. Tanpa `first`/`last` dipakai kata pertama
    dan terakhir yang bukan aba-aba. `after` melompati kemunculan sebuah
    kata lebih dulu (untuk kata yang berulang, mis. slate "Pertama").
    `lead`/`tail` hanya menambah ruang gambar; suaranya tetap dibungkam
    oleh gate() di luar ucapan."""
    ws = _words(path)
    env = envelope(path)
    lo = _find(ws, after) + 1 if after else 0
    if i0 is None:
        i0 = _find(ws, first, lo) if first else \
            next(i for i in range(lo, len(ws)) if not _is_cue(ws[i][0]))
    if i1 is None:
        i1 = _find(ws, last, i0) if last else \
            max(i for i in range(i0, len(ws)) if not _is_cue(ws[i][0]))
    # Batas ucapan dijepit oleh kata tetangga: tidak boleh mulai sebelum
    # kata sebelumnya selesai, dan tidak boleh berakhir setelah kata
    # sesudahnya mulai. Tanpa jepitan ini lead/tail bisa menyeret awal kata
    # berikutnya ("…penggunanya. Da-") atau mengulang kata di belahan L-cut.
    sa = onset(env, ws[i0][1])
    if i0 > 0:
        sa = max(sa, ws[i0 - 1][2])
    sb = offset(env, ws[i1][2])
    if i1 + 1 < len(ws):
        sb = min(sb, ws[i1 + 1][1])
    # Buang potongan aba-aba yang menempel di awal (lihat skip_fragment)
    fs = skip_fragment(env, sa, ws[i0][2], force=energy)
    if fs is not None:
        sa = max(sa, fs)
    if energy:
        # Klip satu kata: transkripsinya tidak bisa diandalkan ("Mengangkat"
        # terbaca "Sampai jumpa!" dengan waktu yang salah), jadi awal dan
        # akhir kata diambil dari energi suara.
        sa = first_burst(env, sa)
        sb = energy_end(env, sa)
    # Sambungan L-cut memakai satu titik belah bersama; batas lainnya
    # diperluas mengikuti energi ucapan (lihat extend_back / extend_fwd).
    if joint_in and i0 > 0:
        sa = split_point(env, ws, i0)
    elif not energy:
        sa = extend_back(env, sa, ws[i0 - 1][2] if i0 > 0 else 0.0)
    if joint_out and i1 + 1 < len(ws):
        sb = split_point(env, ws, i1 + 1)
    elif not energy:
        sb = extend_fwd(env, sb, ws[i1 + 1][1] if i1 + 1 < len(ws) else len(env) * HOP)
    if sb <= sa:
        sb = ws[i1][2]
    # Fade sedikit lebih panjang dari 30 ms supaya perpindahan room tone
    # tidak terasa janggal, tetapi tetap tidak menyentuh kata tetangga.
    pe = ws[i0 - 1][2] if i0 > 0 else 0.0
    ne = ws[i1 + 1][1] if (i1 + 1 < len(ws) and not energy) else sb + 1.0
    if fs is not None:
        pe = max(pe, sa - 0.06)          # fade masuk tidak boleh menyentuh potongan
    # Di titik belah bersama, fade dibuat 20 ms saja agar tidak menumpuk
    # suara segmen tetangga.
    fa = sa - 0.02 if joint_in else max(pe, sa - 0.06)
    fb = sb + 0.02 if joint_out else min(ne, sb + 0.10)
    # Fade-out (minimal 30 ms di build_segment) tidak boleh melewati awal
    # kata berikutnya: tutup gerbang paling lambat 30 ms sebelum kata itu.
    if EXT_STRICT and not joint_out and not energy and i1 + 1 < len(ws):
        nxt = ws[i1 + 1][1]
        if sb > nxt - 0.03:
            sb = max(sa + 0.10, nxt - 0.03)
        fb = min(fb, nxt)
    a = max(0.0, sa - lead)
    b = min(len(env) * HOP, sb + tail)
    return (round(a, 3), round(b - a, 3), round(sa, 3), round(sb, 3),
            round(fa, 3), round(fb, 3), f"{ws[i0][0]} … {ws[i1][0]}")


def wi(path, word, after=None):
    """Indeks sebuah kata di berkas (opsional: setelah kata `after`)."""
    ws = _words(path)
    return _find(ws, word, _find(ws, after) + 1 if after else 0)


def _fit(d, min_dur):
    return max(d, min_dur) if min_dur else d


def talk(sid, path, first=None, last=None, lead=0.15, tail=0.25, after=None,
         min_dur=None, joint_in=False, joint_out=False, **kw):
    """Siswa berbicara ke kamera: gambar dan suara dari klip yang sama."""
    ss, d, sa, sb, fa, fb, txt = span(path, first, last, lead, tail, after,
                                      joint_in=joint_in, joint_out=joint_out)
    return dict(id=sid, v=(path, ss, _fit(d, min_dur)), a="sync",
                g=(sa, sb, fa, fb), gtxt=txt, **kw)


def over(sid, vpath, vss, apath, first=None, last=None, lead=0.15, tail=0.35,
         after=None, i0=None, i1=None, min_dur=None, joint_in=False, joint_out=False, **kw):
    """Suara (VO atau lanjutan klip siswa) di atas footage lain."""
    ss, d, sa, sb, fa, fb, txt = span(apath, first, last, lead, tail, after, i0, i1,
                                      joint_in=joint_in, joint_out=joint_out)
    return dict(id=sid, v=(vpath, vss, _fit(d, min_dur)), a=(apath, ss),
                g=(sa, sb, fa, fb), gtxt=txt, **kw)


def card_vo(sid, cname, apath, first=None, last=None, lead=0.2, tail=0.45,
            after=None, i0=None, i1=None, **kw):
    """Kartu penjelas dengan narasi; lama kartu mengikuti panjang narasi."""
    ss, d, sa, sb, fa, fb, txt = span(apath, first, last, lead, tail, after, i0, i1)
    return dict(id=sid, c=cname, dur=d, a=(apath, ss), g=(sa, sb, fa, fb), gtxt=txt, **kw)


def cue_times(path, sa, sb, ss, spec):
    """Waktu kata (detik relatif awal segmen) untuk sinkronisasi motion graphic.

    spec: {nama: [ejaan...]} atau {nama: ([ejaan...], kata_sebelumnya)}.
    Beberapa ejaan diterima karena transkripsi kadang meleset
    (mis. "pemantauan" terbaca "pemandangan"). Kata yang tidak ketemu
    dilewati; mg.html memakai waktu cadangannya sendiri."""
    ws = _words(path)
    out = {}
    for name, sp in spec.items():
        cands, after = (sp if isinstance(sp, tuple) else (sp, None))
        cands = {_norm(c) for c in cands}
        lo = sa - 0.05
        if after:
            for w in ws:
                if _norm(w[0]) == _norm(after) and w[1] >= sa - 0.05:
                    lo = w[2]
                    break
        for w in ws:
            if lo <= w[1] <= sb and _norm(w[0]) in cands:
                out[name] = round(w[1] - ss, 3)
                break
    return out


def mg(sid, scene, apath=None, first=None, last=None, lead=0.15, tail=0.5, after=None,
       i0=None, i1=None, cue=None, min_dur=None, dur=None, energy=False,
       joint_in=False, joint_out=False, **kw):
    """Adegan motion graphic (mg.html). Dengan narasi: lamanya mengikuti
    ucapan dan elemennya muncul pada kata-kata di `cue`. Tanpa narasi:
    `dur` tetap, hanya musik latar."""
    if apath is None:
        return dict(id=sid, m=scene, dur=dur, a=None, cues={}, **kw)
    ss, d, sa, sb, fa, fb, txt = span(apath, first, last, lead, tail, after, i0, i1,
                                      energy=energy, joint_in=joint_in, joint_out=joint_out)
    d = _fit(d, min_dur)
    cues = cue_times(apath, sa, sb, ss, cue or {})
    return dict(id=sid, m=scene, dur=round(d, 3), a=(apath, ss), g=(sa, sb, fa, fb),
                gtxt=txt, cues=cues, **kw)


def segments():
    """Susunan video — PERSIS mengikuti 17 scene naskah, berurutan.

    Aturan penyusunan (sesuai arahan tim):
      - setiap klip footage lengan bionik dipakai paling banyak SEKALI,
        dan hanya di tempat yang maknanya sesuai kalimatnya
      - adegan tanpa footage yang sesuai diisi motion graphic (mg.html),
        yang elemennya muncul tepat saat kata terkait diucapkan
      - render Blender tidak dipakai
      - semua titik potong suara diturunkan dari kata (words.json)
    """
    V11, V12 = vo("Scene 11 Iwang.wav"), vo("Scene 12 Iwang.wav")
    V13C = vo("Scene 13C Radit.wav")
    V15a = vo("Scene 15 bagian pertama rora.wav")
    V16, V17 = vo("Scene 16 Rora.wav"), vo("Scene 17 rora.wav")
    K = vo("Scene 8 Keysara.wav")
    C = {k: med(v) for k, v in {
        "7112": "S01 - VO Ratusan Gerakan [IMG_7112].mp4",
        "7113": "S02 - VO Tanpa Memikirkannya [IMG_7113].mp4",
        "7129": "S03 - Kata Menggenggam [IMG_7129].mp4",
        "7126": "S04 - Kata Mengangkat [IMG_7126].mp4",
        "7130": "S05 - Kata Menjangkau [IMG_7130].mp4",
        "7131": "S06 - VO Sampai Tidak Lagi Bisa [IMG_7131].mp4",
        "7132": "S07 - VO Reveal Teknologi [IMG_7132].mp4",
        "grup": "S08 - Inilah ASTA Grup [INILAH ASTA].mp4",
        "7245": "S08 - Perkenalan Team Leader [IMG_7245].mp4",
        "7243": "S08 - Perkenalan Researcher A [IMG_7243].mp4",
        "7240": "S08 - Perkenalan Researcher B [IMG_7240].mp4",
        "7239": "S08 - Perkenalan Software Engineer [IMG_7239].mp4",
        "7246": "S08 - Perkenalan IT Engineer [IMG_7246].mp4",
        "7247": "S08 - Perkenalan IoT Engineer [IMG_7247].mp4",
        "7138": "S09 - Latar Belakang [IMG_7138].mp4",
        "7141": "S09 - Latar Belakang Penutup [IMG_7141].mp4",
        "7142": "S10 - Empat Fokus Intro [IMG_7142].mp4",
        "7145": "S10 - Fokus 1 Modular [IMG_7145].mp4",
        "7148": "S10 - Fokus 2 Intent [IMG_7148].mp4",
        "7149": "S10 - Fokus 3 Umpan Balik [IMG_7149].mp4",
        "7150": "S10 - Fokus 4 Pemantauan [IMG_7150].mp4",
        "7155": "S11 - Metode UCD dan Agile [IMG_7155].mp4",
        "7168": "S12 - Hasil Pengembangan [IMG_7168].mp4",
        "7178": "S13A - Socket Modular [IMG_7178].mp4",
        "7200": "S14 - Hasil Pengujian [IMG_7200].mp4",
    }.items()}

    # Titik belah kalimat, dicari dari kata
    k11 = wi(V11, "kebutuhan", after="konsultasi")   # awal kalimat ke-3 Scene 11
    k12 = wi(V12, "yang")                            # "…non-invasif | yang mengintegrasikan…"
    k15 = wi(V15a, "dirancang") - 1                  # "ASTA" sesudah slate "Scene 15 Pertama"
    k16 = wi(V16, "untuk")                           # "…informasi tambahan | untuk memantau…"

    # 13C: lencana "Kontak terdeteksi" muncul tepat saat kata "mendeteksi"
    # Footage F_ALUR sempat dipakai di sini, tetapi kameranya bergerak ke
    # socket persis saat lencana "Kontak terdeteksi" muncul. Diganti klip
    # tangan menggenggam bohlam (kontak dengan benda sungguhan), diperlambat
    # 0,7x agar genggamannya menutupi kalimat. Sumbernya 30 fps, jadi tidak
    # dilambatkan lebih jauh supaya tidak patah-patah.
    s13c = over("s13c", F_ANGKAT1, 0.0, V13C, first="Ketika", ov="cap-13c",
                speed=0.7, note="S13C deteksi kontak")
    kc = cue_times(V13C, s13c["g"][0], s13c["g"][1], s13c["a"][1],
                   {"k": ["mendeteksi", "kontak"]}).get("k", 3.0)
    s13c["ovt"] = [("kontak", kc, s13c["v"][2])]

    return [
     # ===== SCENE 1 — OPENING (video intro) =====
     dict(id="s01a", v=(med("S01 - Opening Logo [OPENING].mp4"), 0.0, 5.0), a="sync",
          raw=0.8, note="S1 video intro"),
     mg("s01b", "hari", C["7112"], tail=0.5,
        cue={"setiap": ["setiap"], "kita": ["kita"], "ratusan": ["ratusan"]},
        note="S1 Setiap hari, kita melakukan ratusan gerakan"),

     # ===== SCENE 2 — GERAKAN SEHARI-HARI =====
     mg("s02", "tanpa", C["7113"], tail=0.45,
        cue={"tanpa": ["tanpa"], "memikirkannya": ["memikirkannya"]},
        note="S2 Tanpa pernah benar-benar memikirkannya"),

     # ===== SCENE 3–5 — MENGGENGGAM / MENGANGKAT / MENJANGKAU =====
     # Klip satu kata: batas diambil dari energi (energy=True), karena
     # transkripsinya meleset ("Mengangkat" terbaca "Sampai jumpa!")
     mg("s03", "genggam", C["7129"], tail=0.5, min_dur=2.0, energy=True, note="S3 Menggenggam"),
     mg("s04", "angkat", C["7126"], tail=0.5, min_dur=2.0, energy=True, note="S4 Mengangkat"),
     mg("s05", "jangkau", C["7130"], tail=0.5, min_dur=2.0, energy=True, note="S5 Menjangkau"),

     # ===== SCENE 6 — TRANSISI MASALAH → cut to black =====
     talk("s06a", C["7131"], first="Kita", last="melakukannya", tail=0.2,
          joint_out=True, note="S6 [wajah] Kita terbiasa melakukannya"),
     mg("s06b", "berhenti", C["7131"], first="sampai", lead=0.1, tail=0.8,
        cue={"sampai": ["sampai"], "tidak": ["tidak"]},
        joint_in=True, note="S6 sampai kita tidak lagi bisa"),
     dict(id="s06c", black=0.7, note="S6 cut to black"),

     # ===== SCENE 7 — ASTA REVEAL (bertahap, tidak langsung seluruh produk) =====
     over("s07a", F_DETAIL2, 0.4, C["7132"], note="S7 reveal: detail mekanisme"),
     # (Adegan teks tanpa narasi "s07b" dihapus: bersama beauty shot S8
     #  ia membuat 00:31–00:35 terdengar kosong.)

     # ===== SCENE 8 — PRODUCT INTRODUCTION =====
     dict(id="s08a", v=(F_DETAIL, 0.4, 1.6), a=None, note="S8 beauty shot"),
     talk("s08b", C["grup"], first="inilah", lead=0.5, tail=0.6, note="S8 Inilah ASTA"),
     dict(id="s08c", c="title", dur=4.0, note="S8 judul produk"),
     talk("s08d", C["7245"], after="semuanya", ov="lt-leader", note="S8 perkenalan Team Leader"),
     talk("s08e", C["7243"], ov="lt-research-a", note="S8 perkenalan Researcher"),
     talk("s08f", C["7240"], ov="lt-research-b", note="S8 perkenalan Researcher"),
     talk("s08g", C["7239"], after="semuanya", ov="lt-software", note="S8 perkenalan Software Engineer"),
     talk("s08h", C["7246"], ov="lt-it", note="S8 perkenalan IT Engineer"),
     talk("s08i", C["7247"], ov="lt-iot", note="S8 perkenalan IoT Engineer"),

     # ===== SCENE 9 — LATAR BELAKANG =====
     talk("s09a", C["7138"], note="S9 [wajah] keterbatasan akses teknologi asistif"),
     mg("s09b", "masalah", K, first="Selain", last="penggunanya", lead=0.2, tail=0.5,
        cue={"biaya": ["biaya"], "akses": ["akses"], "kebutuhan": (["kebutuhan"], "layanan"),
             "karena": ["karena"]},
        note="S9 tiga hambatan"),
     talk("s09c", C["7141"], note="S9 [wajah] kami mengembangkan ASTA"),

     # ===== SCENE 10 — TUJUAN: empat fokus, motion graphic di samping anggota =====
     talk("s10a", C["7142"], ov="fokus-0", note="S10 [wajah] empat fokus utama"),
     talk("s10b", C["7145"], ov="fokus-1", note="S10 fokus 1"),
     talk("s10c", C["7148"], ov="fokus-2", note="S10 fokus 2"),
     talk("s10d", C["7149"], ov="fokus-3", note="S10 fokus 3"),
     talk("s10e", C["7150"], ov="fokus-4", note="S10 fokus 4"),

     # ===== SCENE 11 — METODE: proses teknis, bukan hanya diskusi =====
     talk("s11a", C["7155"], note="S11 [wajah] User-Centered Design & Agile"),
     mg("s11b", "ucd", V11, first="Kami", i1=k11 - 1,
        cue={"kebutuhan": ["kebutuhan"], "penyandang": ["penyandang"],
             "fisioterapis": ["fisioterapis"],
             "prostetis": ["prostetis", "prostatis", "prosthetis"]},
        joint_out=True, note="S11 konsultasi pengguna"),
     mg("s11c", "iterasi", V11, i0=k11,
        cue={"kebutuhan": ["kebutuhan"], "desain": ["desain", "design"],
             "dikembangkan": ["dikembangkan"], "iteratif": ["iteratif"],
             "pengujian": ["pengujian"], "evaluasi": ["evaluasi"]},
        joint_in=True, note="S11 pengembangan iteratif"),

     # ===== SCENE 12 — HASIL: product shot utama sebelum demonstrasi =====
     talk("s12a", C["7168"], first="Hasil", last="Asta", note="S12 [wajah] hasilnya adalah ASTA"),
     over("s12b", F_BEAUTY2, 1.0, V12, first="sebuah", i1=k12 - 1, tail=0.1,
          joint_out=True, note="S12 product shot: lengan bionik modular non-invasif"),
     mg("s12c", "sistem", V12, i0=k12, lead=0.0, tail=1.3,
        cue={"mekanik": ["mekanik"], "kontrol": ["kontrol"], "sensor": ["sensor"],
             "umpan": ["umpan", "mempunyai"], "pemantauan": ["pemantauan", "pemandangan"]},
        joint_in=True, note="S12 lima sistem terintegrasi"),

     # ===== SCENE 13 — DEMONSTRASI: satu alur (caption 1 dari 6 … 6 dari 6) =====
     talk("s13a1", C["7178"], first="Asta", last="modular", tail=0.0, ov="cap-13a",
          joint_out=True, note="S13A [wajah] socket modular"),
     over("s13a2", F_BEAUTY1, 8.0, C["7178"], first="yang", after="modular", lead=0.0,
          ov="cap-13a", joint_in=True, note="S13A socket disesuaikan"),
     mg("s13b", "intent", vo("Scene 13B Radit.wav"), first="Input", tail=0.6,
        cue={"input": ["input"], "diproses": ["diproses", "proses"], "perintah": ["perintah"]},
        note="S13B kontrol berbasis intent"),
     s13c,
     mg("s13d", "umpanbalik", vo("Scene 13D Radit.wav"), first="Informasi", tail=0.6,
        cue={"informasi": ["informasi"], "umpan": ["umpan"], "pengguna": ["pengguna"]},
        note="S13D umpan balik sensorik"),
     over("s13e", F_BUKATUTUP, 0.8, vo("Scene 13E Radit.wav"), first="dalam",
          ov="cap-13e", reps=True, note="S13E hitung repetisi"),
     over("s13f", SHOW_AND, 49.5, vo("Scene 13F Radit.wav"), first="Data",
          vf=CROP_PHONE, ov="cap-13f", note="S13F aplikasi pengguna"),

     # ===== SCENE 14 — HASIL PENGUJIAN =====
     # Dipotong sesudah "pengujian": lanjutannya menyebut "Phantom Pain",
     # bertentangan dengan VO Scene 14 (System Usability Scale).
     talk("s14a", C["7200"], first="Untuk", last="pengujian", tail=0.25,
          note="S14 [wajah] kami melakukan pengujian"),
     mg("s14b", "sus", vo("Scene 14 Rora.wav"), first="Dari", tail=1.0,
        cue={"system": ["system", "sistem"], "usability": ["usability"], "layak": ["layak"]},
        note="S14 System Usability Scale"),

     # ===== SCENE 15 — PENGGUNAAN ASTA =====
     over("s15a", F_ANGKAT3, 0.5, V15a, i0=k15, note="S15 mengambil & mengangkat"),
     mg("s15b", "adaptif", vo("Scene 15 bagian kedua rora.wav"), first="Dengan", tail=1.0,
        cue={"disesuaikan": ["disesuaikan"], "merespons": ["merespons", "merespon"],
             "membantu": ["membantu"]},
        note="S15 adaptif & pembeda ASTA"),

     # ===== SCENE 16 — REHABILITATOR: aplikasi → data → dasbor =====
     over("s16a", SHOW_AND, 107.5, V16, first="Sementara", i1=k16 - 1, tail=0.1,
          vf=CROP_PHONE, ov="cap-progres", joint_out=True, note="S16 data aktivitas di aplikasi"),
     over("s16b", SHOW_DSK, 128.5, V16, i0=k16, lead=0.0,
          vf=CROP_BROWS, ov="cap-dashboard", joint_in=True, note="S16 dasbor rehabilitator"),

     # ===== SCENE 17 — CLOSING: callback → cut to black → ASTA, Move with Purpose =====
     over("s17a", F_GENGGAM, 3.0, V17, first="karena", i1=wi(V17, "menggenggam"), tail=0.2,
          joint_out=True, note="S17 callback menggenggam"),
     over("s17b", F_ANGKAT2, 1.0, V17, first="mengangkat", last="mengangkat", lead=0.0,
          tail=0.2, joint_in=True, joint_out=True, note="S17 callback mengangkat"),
     over("s17c", F_JANGKAU1, 8.0, V17, first="dan", after="mengangkat", last="sederhana",
          lead=0.0, joint_in=True, joint_out=True, note="S17 callback menjangkau"),
     mg("s17d", "arti", V17, first="Namun", last="arti", tail=0.4,
        cue={"namun": ["namun"], "setiap": ["setiap"]},
        joint_in=True, joint_out=True, note="S17 setiap gerakan memiliki arti"),
     over("s17e", F_KONTAK, 0.8, V17, first="Asta", last="gerakan", after="arti",
          joint_in=True, joint_out=True, note="S17 ASTA hadir bukan sekadar menggantikan gerakan"),
     # Tangan menggenggam bohlam = berinteraksi dengan benda di sekitarnya.
     # (F_JANGKAU2 sebelumnya bergeser ke socket di tengah kalimat ini.)
     over("s17f", ftg("FTG GENGGAM PORTRAIT - S03 [192119808].mp4"), 0.0, V17,
          first="tetapi", tail=0.6, speed=0.7, pillar=True,
          joint_in=True, note="S17 kembali berinteraksi dengan dunia"),
     dict(id="s17g", black=0.6, note="S17 cut to black"),
     dict(id="s17h", v=(med("S17 - Logo Outro [TERAKHIR].mp4"), 0.0, 5.2), a="sync",
          raw=0.8, note="S17 logo ASTA"),
     dict(id="s17i", c="end", dur=2.6, note="S17 ASTA, Move with Purpose."),
    ]


def build_segment(seg):
    sid = seg["id"]
    out = os.path.join(SEGD, sid + ".mp4")
    inputs, fc, vlab, alab = [], [], None, None
    idx = 0

    # ---------- video ----------
    if "black" in seg:
        dur = seg["black"]
        inputs += ["-f", "lavfi", "-t", f"{dur}", "-i", f"color=c=black:s={W}x{H}:r={FPS}"]
        fc.append(f"[{idx}:v]format=yuv420p,setsar=1[v0]"); vlab = "v0"; idx += 1
    elif "m" in seg:
        # Frame JPEG dari render-mg.js: rentang penuh -> rentang video terbatas
        dur = seg["dur"]
        inputs += ["-framerate", str(FPS), "-i",
                   os.path.join(BUILD, "mg", sid, "f-%04d.jpg")]
        fc.append(f"[{idx}:v]scale=in_range=full:out_range=limited,format=yuv420p,setsar=1[v0]")
        vlab = "v0"; idx += 1
    elif "c" in seg:
        dur = seg["dur"]
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur}", "-i", card(seg["c"])]
        # Dinaikkan dulu lalu di-zoom pelan supaya kartu tidak terasa mati
        # d=1: satu frame masuk menjadi satu frame keluar, zoom menumpuk
        # lewat pzoom (d=dur*FPS justru melipatgandakan jumlah frame)
        z = ("zoompan=z='min(pzoom+0.0004,1.09)':d=1"
             ":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
             f":s={W}x{H}:fps={FPS}")
        fc.append(f"[{idx}:v]scale={W*2}:-2,{z},format=yuv420p,setsar=1[v0]")
        vlab = "v0"; idx += 1
    else:
        path, ss, dur = seg["v"]
        # speed < 1: gerak lambat, supaya bagian footage yang maknanya pas
        # (mis. tangan menggenggam) cukup menutupi seluruh kalimat.
        spd = seg.get("speed", 1.0)
        inputs += ["-ss", f"{ss}", "-t", f"{dur * spd:.3f}", "-i", path]
        slow = f"setpts=PTS/{spd}," if spd != 1.0 else ""
        # pillar: gambar potret yang sudah terbungkus bingkai hitam 16:9 —
        # potong bagian tengahnya, lalu perlakukan seperti klip potret.
        pil = "crop=ih*9/16:ih," if seg.get("pillar") else ""
        if portrait(path) or seg.get("pillar"):
            fc.append(
                f"[{idx}:v]{slow}{pil}fps={FPS},split[pa][pb];"
                f"[pa]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                f"gblur=sigma=30,eq=brightness=0.05[pbg];"
                f"[pb]scale=-2:{H}[pfg];[pbg][pfg]overlay=(W-w)/2:0,setsar=1,format=yuv420p[v0]")
        else:
            fc.append(f"[{idx}:v]{slow}{vfilter(seg)}[v0]")
        vlab = "v0"; idx += 1

    # ---------- overlay ----------
    if seg.get("ov"):
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur}", "-i", card(seg["ov"])]
        fc.append(f"[{idx}:v]format=rgba[ov];[{vlab}][ov]overlay=0:0:format=auto[v1]"); vlab = "v1"; idx += 1

    # ---------- penghitung repetisi ----------
    if seg.get("reps"):
        n = 6
        step = dur / n
        for k in range(n):
            inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur}", "-i",
                       card("reps-" + str(k + 1).zfill(2))]
            a, b = k * step, (k + 1) * step + 0.01
            nl = f"vr{k}"
            fc.append(f"[{idx}:v]format=rgba[or{k}];[{vlab}][or{k}]"
                      f"overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[{nl}]")
            vlab = nl; idx += 1

    # ---------- overlay berjadwal: (kartu, mulai, selesai) ----------
    for k, (oname, ta, tb) in enumerate(seg.get("ovt", [])):
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur}", "-i", card(oname)]
        nl = f"vt{k}"
        fc.append(f"[{idx}:v]format=rgba[ot{k}];[{vlab}][ot{k}]"
                  f"overlay=0:0:enable='between(t,{ta:.2f},{tb:.2f})'[{nl}]")
        vlab = nl; idx += 1

    # ---------- audio ----------
    # Sumber suara boleh berbeda dari sumber gambar: a=(berkas, mulai)
    # memungkinkan L-cut, yaitu suara siswa berlanjut di atas footage.
    a = seg.get("a")
    apath, ass = None, 0.0
    if a == "sync":
        apath, ass = seg["v"][0], seg["v"][1]
        fc.append("[0:a]aresample=48000,aformat=channel_layouts=stereo[araw]")
        alab = "araw"
    elif isinstance(a, tuple):
        apath, ass = a
        inputs += ["-ss", f"{ass}", "-t", f"{dur}", "-i", apath]
        fc.append(f"[{idx}:a]aresample=48000,aformat=channel_layouts=stereo[araw]")
        alab = "araw"; idx += 1
    else:
        inputs += ["-f", "lavfi", "-t", f"{dur}", "-i",
                   "anullsrc=channel_layout=stereo:sample_rate=48000"]
        fc.append(f"[{idx}:a]anull[araw]"); alab = "araw"; idx += 1

    # Bungkam di luar ucapan dulu, baru ratakan kenyaringan: nol digital
    # tetap nol, jadi loudnorm tidak bisa mengangkat derau yang sudah dibuang.
    if a is None:
        chain = "anull"
    elif seg.get("raw"):
        chain = f"volume={seg['raw']}"
    else:
        fin = fout = None
        if seg.get("g"):
            # Batas dari span(): sudah dijepit kata tetangga
            gg = seg["g"]
            sa, sb = gg[0], gg[1]
            fa = gg[2] if len(gg) > 2 else sa - 0.03
            fb = gg[3] if len(gg) > 3 else sb + 0.06
            g0 = sa - ass if sa - ass > 0.005 else None
            g1 = sb - ass if sb - ass < dur - 0.005 else None
            if g0 is not None:
                st = max(0.0, fa - ass)
                fin = (st, max(0.02, (sa - ass) - st))
            if g1 is not None:
                fout = (g1, max(0.03, fb - sb))
            txt = seg.get("gtxt", "")
        else:
            g0, g1, txt = gate(apath, ass, dur, seg.get("gin", True), seg.get("gout", True))
            if g0 is not None and g0 > 0.005:
                fin = (g0, 0.03)
            if g1 is not None and g1 < dur - 0.005:
                fout = (g1, 0.06)
        GATES[sid] = (g0, g1, txt)
        parts = []
        if fin:
            parts.append(f"afade=t=in:st={fin[0]:.3f}:d={fin[1]:.3f}")
        if fout:
            parts.append(f"afade=t=out:st={fout[0]:.3f}:d={fout[1]:.3f}")
        parts.append("loudnorm=I=-16:TP=-1.5:LRA=11")
        chain = ",".join(parts)
    fc.append(f"[{alab}]{chain},apad,atrim=0:{dur},afade=t=in:st=0:d=0.015,"
              f"afade=t=out:st={max(0.0, dur - 0.02):.3f}:d=0.02[aout]")

    args = inputs + ["-filter_complex", ";".join(fc),
                     "-map", f"[{vlab}]", "-map", "[aout]",
                     "-t", f"{dur}",
                     "-c:v", "libx264", "-preset", "medium", "-crf", "19",
                     "-pix_fmt", "yuv420p", "-color_range", "tv",
                     "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                     "-profile:v", "high", "-level", "4.1",
                     "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                     "-r", str(FPS), "-video_track_timescale", "30000", out]
    run(args, "segmen " + sid)
    return out, dur


def main():
    if "--clean" in sys.argv:
        shutil.rmtree(SEGD, ignore_errors=True)
    os.makedirs(SEGD, exist_ok=True)

    if not WORDS:
        raise SystemExit("words.json belum ada. Jalankan analyze.py dulu.")
    S = segments()
    # Rencana segmen untuk panel pemantau (monitor.py)
    os.makedirs(BUILD, exist_ok=True)
    json.dump({"started": __import__("time").strftime("%H:%M:%S"),
               "segments": [{"id": x["id"], "note": x["note"],
                             "dur": x.get("dur") or x.get("black") or x["v"][2]} for x in S]},
              open(os.path.join(BUILD, "plan.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    jobs = [dict(sid=x["id"], scene=x["m"], dur=x["dur"], cues=x.get("cues", {}))
            for x in S if "m" in x]
    if jobs:
        os.makedirs(os.path.join(BUILD, "mg"), exist_ok=True)
        jf = os.path.join(BUILD, "mg", "jobs.json")
        json.dump(jobs, open(jf, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"Merender {len(jobs)} adegan motion graphic…")
        r = subprocess.run(["node", os.path.join(os.path.dirname(__file__), "render-mg.js"), jf]
                           + (["--preview"] if "--preview" in sys.argv else []))
        if r.returncode != 0:
            raise SystemExit("render-mg.js gagal")
        if "--preview" in sys.argv:
            raise SystemExit("Pratinjau selesai: _build/mg/_preview-*.jpg")
    total = 0.0
    files = []
    for seg in S:
        dst = os.path.join(SEGD, seg["id"] + ".mp4")
        d = seg.get("dur") or seg.get("black") or seg["v"][2]
        if os.path.exists(dst) and os.path.getsize(dst) > 0:
            files.append(dst); total += d
            print(f"  {seg['id']}  {d:5.2f}s  {seg['note']}  (sudah ada)")
            continue
        f, d = build_segment(seg)
        files.append(f); total += d
        g = GATES.get(seg["id"])
        gtxt = ""
        if g:
            g0, g1, txt = g
            gtxt = (f"   suara {'%.2f' % g0 if g0 is not None else '0'}"
                    f"-{'%.2f' % g1 if g1 is not None else 'akhir'}  [{txt}]")
        print(f"  {seg['id']}  {d:5.2f}s  {seg['note']}{gtxt}")

    print(f"\ntotal sebelum musik: {total:.1f} detik ({int(total//60)}:{total%60:04.1f})")

    # ---------- sambung per scene naskah ----------
    # Segmen dikelompokkan per scene (s01…s17). Di dalam satu scene disambung
    # langsung tanpa encode ulang; ANTAR scene diberi efek transisi.
    groups = []
    for seg, f in zip(S, files):
        sc = int(re.match(r"s(\d+)", seg["id"]).group(1))
        if not groups or groups[-1][0] != sc:
            groups.append([sc, []])
        groups[-1][1].append(f)
    scene_files = []
    for sc, fl in groups:
        lst = os.path.join(BUILD, f"scene-{sc:02d}.txt")
        with open(lst, "w", encoding="utf-8") as fh:
            for f in fl:
                fh.write("file '" + f.replace("\\", "/").replace("'", "'\\''") + "'\n")
        sf = os.path.join(BUILD, f"scene-{sc:02d}.mp4")
        run(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", sf], f"sambung scene {sc}")
        scene_files.append(sf)

    # ---------- transisi antar scene + musik latar, satu kali encode ----------
    # Narasi TIDAK boleh ikut memudar. Tiap scene diberi bantalan H detik
    # gambar diam (tpad) dan H detik hening (adelay/apad) di tepinya; transisi
    # video dan crossfade audio sepanjang 2H hanya menumpuk bantalan itu.
    # Durasi total tetap sama dengan jumlah durasi scene.
    H = XF / 2
    n = len(scene_files)
    lens = [probe_dur(f) for f in scene_files]
    inputs, fc = [], []
    for i, f in enumerate(scene_files):
        inputs += ["-i", f]
        sp = H if i > 0 else 0.0
        ep = H if i < n - 1 else 0.0
        fc.append(f"[{i}:v]tpad=start_mode=clone:start_duration={sp:.3f}:"
                  f"stop_mode=clone:stop_duration={ep:.3f},settb=AVTB,fps={FPS},format=yuv420p[pv{i}]")
        fc.append(f"[{i}:a]adelay=delays={int(round(sp * 1000))}:all=1,"
                  f"apad=pad_dur={ep:.3f}[pa{i}]")
    acc = lens[0] + (H if n > 1 else 0.0)
    vprev, aprev = "pv0", "pa0"
    for i in range(1, n):
        li = lens[i] + H + (H if i < n - 1 else 0.0)
        fc.append(f"[{vprev}][pv{i}]xfade=transition={TRANS.get(i, 'smoothleft')}:"
                  f"duration={XF}:offset={acc - XF:.3f}[xv{i}]")
        fc.append(f"[{aprev}][pa{i}]acrossfade=d={XF}:c1=tri:c2=tri[xa{i}]")
        vprev, aprev = f"xv{i}", f"xa{i}"
        acc += li - XF
    total = acc
    fo = max(0.0, total - 3.0)
    inputs += ["-stream_loop", "-1", "-i", BGM]
    fc.append(f"[{n}:a]volume=0.42,aresample=48000,aformat=channel_layouts=stereo,"
              f"afade=t=in:st=0:d=2.5,afade=t=out:st={fo:.2f}:d=3[bgm]")
    fc.append(f"[{aprev}]asplit=2[nar][key]")
    # Musik ditekan otomatis saat ada narasi, jadi suara tetap jelas
    fc.append("[bgm][key]sidechaincompress=threshold=0.02:ratio=12:attack=15:release=350[duck]")
    fc.append(f"[nar][duck]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95,"
              f"afade=t=out:st={fo:.2f}:d=3[aout]")
    print(f"\nmenyambung {n} scene dengan {n - 1} transisi -> {total:.1f} detik")
    run(inputs + ["-filter_complex", ";".join(fc), "-map", f"[{vprev}]", "-map", "[aout]",
                  "-t", f"{total:.3f}",
                  "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
                  "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709",
                  "-color_trc", "bt709", "-profile:v", "high", "-level", "4.1",
                  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                  "-r", str(FPS), "-movflags", "+faststart", OUT], "transisi & musik")

    sz = os.path.getsize(OUT) / 1e6
    print(f"\n{os.path.basename(OUT)}  {sz:.1f} MB")


if __name__ == "__main__":
    main()
