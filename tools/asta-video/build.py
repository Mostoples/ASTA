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
import os, subprocess, sys, json, shutil

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

# ---------- daftar segmen ----------
# v: (berkas, mulai, durasi) | c: kartu | black
# a: 'sync' | (berkas_vo, mulai) | None
S = [
 dict(id="01", v=(med("S01 - Opening Logo [OPENING].mp4"), 0.0, 5.6), a="sync",
      raw=0.8, note="animasi logo pembuka"),
 dict(id="02", v=(F_DETAIL, 0.4, 4.3), a=(med("S01 - VO Ratusan Gerakan [IMG_7112].mp4"), 0.0),
      note="Setiap hari kita melakukan ratusan gerakan"),
 dict(id="03", v=(F_BEAUTY1, 2.0, 3.5), a=(med("S02 - VO Tanpa Memikirkannya [IMG_7113].mp4"), 1.55),
      note="Tanpa pernah benar-benar memikirkannya"),
 dict(id="04", v=(F_GENGGAM, 0.5, 2.1), a=(med("S03 - Kata Menggenggam [IMG_7129].mp4"), 0.0),
      ov="kata-menggenggam", note="MENGGENGGAM"),
 dict(id="05", v=(F_ANGKAT1, 3.6, 2.1), a=(med("S04 - Kata Mengangkat [IMG_7126].mp4"), 0.0),
      ov="kata-mengangkat", note="MENGANGKAT"),
 dict(id="06", v=(F_JANGKAU1, 4.6, 2.1), a=(med("S05 - Kata Menjangkau [IMG_7130].mp4"), 0.0),
      ov="kata-menjangkau", note="MENJANGKAU"),
 dict(id="07", v=(F_JANGKAU3, 2.6, 6.0), a=(med("S06 - VO Sampai Tidak Lagi Bisa [IMG_7131].mp4"), 0.0),
      note="Kita terbiasa melakukannya, sampai tidak lagi bisa"),
 dict(id="08", black=0.9, note="jeda hitam"),
 dict(id="09", v=(F_DETAIL2, 0.4, 4.9), a=(med("S07 - VO Reveal Teknologi [IMG_7132].mp4"), 0.0),
      note="Lalu bagaimana jika teknologi..."),
 dict(id="10", v=(med("S08 - Inilah ASTA Grup [INILAH ASTA].mp4"), 0.0, 3.9), a="sync",
      note="Inilah ASTA"),
 dict(id="11", c="title", dur=4.6, note="kartu judul"),

 dict(id="12", v=(med("S08 - Perkenalan Team Leader [IMG_7245].mp4"), 2.1, 8.5), a="sync",
      ov="lt-leader", note="perkenalan Team Leader"),
 dict(id="13", v=(med("S08 - Perkenalan Researcher A [IMG_7243].mp4"), 0.6, 6.8), a="sync",
      ov="lt-research-a", note="perkenalan Researcher"),
 dict(id="14", v=(med("S08 - Perkenalan Researcher B [IMG_7240].mp4"), 2.05, 6.3), a="sync",
      ov="lt-research-b", note="perkenalan Researcher"),
 dict(id="15", v=(med("S08 - Perkenalan Software Engineer [IMG_7239].mp4"), 1.3, 7.7), a="sync",
      ov="lt-software", note="perkenalan Software Engineer"),
 dict(id="16", v=(med("S08 - Perkenalan IT Engineer [IMG_7246].mp4"), 0.0, 6.6), a="sync",
      ov="lt-it", note="perkenalan IT Engineer"),
 dict(id="17", v=(med("S08 - Perkenalan IoT Engineer [IMG_7247].mp4"), 0.0, 6.3), a="sync",
      ov="lt-iot", note="perkenalan IoT Engineer"),

 dict(id="18", v=(med("S09 - Latar Belakang [IMG_7138].mp4"), 1.45, 8.6), a="sync",
      note="latar belakang kalimat 1"),
 dict(id="19", c="masalah", dur=12.9, a=(vo("Scene 8 Keysara.wav"), 10.82),
      note="tiga hambatan — VO kalimat 2 dan 3"),
 dict(id="20", v=(med("S09 - Latar Belakang Penutup [IMG_7141].mp4"), 0.0, 4.4), a="sync",
      note="dari kebutuhan tersebut kami mengembangkan ASTA"),

 dict(id="21", v=(med("S10 - Empat Fokus Intro [IMG_7142].mp4"), 0.0, 3.8), a="sync",
      ov="fokus-0", note="empat fokus utama"),
 dict(id="22", v=(med("S10 - Fokus 1 Modular [IMG_7145].mp4"), 0.0, 4.3), a="sync",
      ov="fokus-1", note="fokus 1"),
 dict(id="23", v=(med("S10 - Fokus 2 Intent [IMG_7148].mp4"), 0.0, 3.2), a="sync",
      ov="fokus-2", note="fokus 2"),
 dict(id="24", v=(med("S10 - Fokus 3 Umpan Balik [IMG_7149].mp4"), 0.0, 3.2), a="sync",
      ov="fokus-3", note="fokus 3"),
 dict(id="25", v=(med("S10 - Fokus 4 Pemantauan [IMG_7150].mp4"), 0.0, 4.3), a="sync",
      ov="fokus-4", note="fokus 4"),

 dict(id="26", c="metode", dur=11.6, a=(vo("Scene 11 Iwang.wav"), 1.26),
      note="metode UCD dan Agile"),
 dict(id="27", v=(F_BEAUTY2, 1.0, 11.8), a=(vo("Scene 11 Iwang.wav"), 12.86),
      ov="cap-metode", note="konsultasi, desain, iterasi"),
 dict(id="28", c="integrasi", dur=13.6, a=(vo("Scene 12 Iwang.wav"), 1.92),
      note="lima sistem terintegrasi"),

 dict(id="29", v=(F_BEAUTY1, 8.0, 6.2), a=(vo("Scene 13A Radit.wav"), 2.90),
      ov="cap-13a", note="socket modular"),
 dict(id="30", v=(F_BUKATUTUP, 0.8, 7.5), a=(vo("Scene 13B Radit.wav"), 2.34),
      ov="cap-13b", note="kontrol berbasis intent"),
 dict(id="31", v=(F_ALUR, 1.6, 9.8), a=(vo("Scene 13C Radit.wav"), 2.92),
      ov="cap-13c", note="deteksi kontak"),
 dict(id="32", v=(F_GENGGAM, 1.0, 7.2), a=(vo("Scene 13D Radit.wav"), 3.08),
      ov="cap-13d", note="umpan balik sensorik"),
 dict(id="33", v=(F_KONTAK, 0.8, 7.0), a=(vo("Scene 13E Radit.wav"), 3.24),
      ov="cap-13e", reps=True, note="hitung repetisi"),
 dict(id="34", v=(SHOW_AND, 50.5, 7.2), a=(vo("Scene 13F Radit.wav"), 2.70),
      vf=CROP_PHONE, ov="cap-13f", note="aplikasi pengguna"),

 dict(id="35", c="sus", dur=7.2, a=(vo("Scene 14 Rora.wav"), 2.50),
      note="hasil pengujian System Usability Scale"),
 dict(id="36", v=(F_ANGKAT3, 0.5, 8.4), a=(vo("Scene 15 bagian pertama rora.wav"), 4.52),
      note="mendukung aktivitas fungsional"),
 dict(id="37", v=(F_JANGKAU2, 2.0, 10.4), a=(vo("Scene 15 bagian kedua rora.wav"), 2.81),
      note="pengalaman penggunaan yang adaptif"),
 dict(id="38", v=(SHOW_DSK, 128.5, 12.1), a=(vo("Scene 16 Rora.wav"), 2.04),
      vf=CROP_BROWS, ov="cap-dashboard", note="dasbor rehabilitator"),

 # Penutup: callback ke tiga gerakan pembuka. Narasi Scene 17 dipotong
 # mengikuti kata "menggenggam", "mengangkat", "menjangkau" supaya gambar
 # berganti tepat pada katanya.
 dict(id="39", v=(F_GENGGAM, 3.0, 3.65), a=(vo("Scene 17 rora.wav"), 2.10),
      note="closing - menggenggam"),
 dict(id="40", v=(F_ANGKAT2, 1.0, 1.25), a=(vo("Scene 17 rora.wav"), 5.75),
      note="closing - mengangkat"),
 dict(id="41", v=(F_JANGKAU1, 8.0, 2.90), a=(vo("Scene 17 rora.wav"), 7.00),
      note="closing - menjangkau"),
 dict(id="42", v=(F_BEAUTY2, 14.0, 6.95), a=(vo("Scene 17 rora.wav"), 10.20),
      note="closing - setiap gerakan memiliki arti"),
 dict(id="43", v=(F_DETAIL, 6.0, 4.25), a=(vo("Scene 17 rora.wav"), 17.15),
      note="closing - bukan sekadar menggantikan gerakan"),
 dict(id="44", v=(med("S17 - Grup Sebelum Outro [SEBELUM OUTRO].mp4"), 0.6, 6.80),
      a=(vo("Scene 17 rora.wav"), 21.40), note="closing - grup tim"),
 dict(id="45", v=(med("S17 - Logo Outro [TERAKHIR].mp4"), 0.0, 7.0), a="sync",
      raw=0.8, note="animasi logo penutup"),
 dict(id="46", c="end", dur=3.6, note="kartu penutup"),
]


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
    elif "c" in seg:
        dur = seg["dur"]
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur}", "-i", card(seg["c"])]
        # Dinaikkan dulu lalu di-zoom pelan supaya kartu tidak terasa mati
        z = f"zoompan=z='min(zoom+0.00035,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'" \
            f":d={int(dur*FPS)}:s={W}x{H}:fps={FPS}"
        fc.append(f"[{idx}:v]scale={W*2}:-2,{z},format=yuv420p,setsar=1[v0]")
        vlab = "v0"; idx += 1
    else:
        path, ss, dur = seg["v"]
        inputs += ["-ss", f"{ss}", "-t", f"{dur}", "-i", path]
        if portrait(path):
            fc.append(
                f"[{idx}:v]fps={FPS},split[pa][pb];"
                f"[pa]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                f"gblur=sigma=30,eq=brightness=0.05[pbg];"
                f"[pb]scale=-2:{H}[pfg];[pbg][pfg]overlay=(W-w)/2:0,setsar=1,format=yuv420p[v0]")
        else:
            fc.append(f"[{idx}:v]{vfilter(seg)}[v0]")
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

    # ---------- audio ----------
    a = seg.get("a")
    if a == "sync":
        pass                                  # diambil dari input video (indeks 0)
    elif isinstance(a, tuple):
        vopath, voss = a
        inputs += ["-ss", f"{voss}", "-t", f"{dur}", "-i", vopath]
        fc.append(f"[{idx}:a]aresample=48000,aformat=channel_layouts=stereo[araw]")
        alab = "araw"; idx += 1

    if a == "sync":
        fc.append("[0:a]aresample=48000,aformat=channel_layouts=stereo[araw]")
        alab = "araw"
    elif a is None:
        inputs += ["-f", "lavfi", "-t", f"{dur}", "-i",
                   "anullsrc=channel_layout=stereo:sample_rate=48000"]
        fc.append(f"[{idx}:a]anull[araw]"); alab = "araw"; idx += 1

    # Rata-kan kenyaringan lalu pastikan panjangnya persis
    if a is None:
        chain = "anull"
    elif seg.get("raw"):
        chain = f"volume={seg['raw']}"
    else:
        chain = "loudnorm=I=-16:TP=-1.5:LRA=11"
    fc.append(f"[{alab}]{chain},apad,atrim=0:{dur}[aout]")

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
        print(f"  {seg['id']}  {d:5.2f}s  {seg['note']}")

    print(f"\ntotal sebelum musik: {total:.1f} detik ({int(total//60)}:{total%60:04.1f})")

    # ---------- sambung ----------
    lst = os.path.join(BUILD, "concat.txt")
    with open(lst, "w", encoding="utf-8") as fh:
        for f in files:
            fh.write("file '" + f.replace("\\", "/").replace("'", "'\\''") + "'\n")
    joined = os.path.join(BUILD, "joined.mp4")
    run(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined], "sambung")

    # ---------- musik latar dengan ducking ----------
    fo = max(0.0, total - 3.0)
    mix = (
        f"[1:a]volume=0.42,aresample=48000,aformat=channel_layouts=stereo,"
        f"afade=t=in:st=0:d=2.5,afade=t=out:st={fo:.2f}:d=3[bgm];"
        f"[0:a]asplit=2[nar][key];"
        # Musik ditekan otomatis saat ada narasi, jadi suara tetap jelas
        f"[bgm][key]sidechaincompress=threshold=0.02:ratio=12:attack=15:release=350[duck];"
        f"[nar][duck]amix=inputs=2:duration=first:normalize=0,"
        f"alimiter=limit=0.95,afade=t=out:st={fo:.2f}:d=3[aout]"
    )
    run(["-i", joined, "-stream_loop", "-1", "-i", BGM,
         "-filter_complex", mix, "-map", "0:v", "-map", "[aout]",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
         "-movflags", "+faststart", "-shortest", OUT], "campur musik")

    sz = os.path.getsize(OUT) / 1e6
    print(f"\n{os.path.basename(OUT)}  {sz:.1f} MB")


if __name__ == "__main__":
    main()
