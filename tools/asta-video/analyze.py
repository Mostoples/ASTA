"""
============================================================
ASTA — Analisis ucapan untuk pemotongan presisi
------------------------------------------------------------
Menghasilkan _build/words.json: stempel waktu PER KATA untuk setiap
berkas audio/video yang dipakai build.py.

Stempel waktu Whisper hanya tepat sekitar ±0,1 detik. Karena itu
build.py tidak memotong langsung di stempel ini, melainkan mencari
titik lembah energi suara terdekat di sekitarnya (lihat gate() di
build.py). Berkas ini hanya menjawab "kata apa, kira-kira kapan".

Model medium dipakai tanpa VAD supaya kata pendek seperti aba-aba
"dua", "tiga", "oke" ikut tertangkap, bukan dibuang sebagai jeda.

Jalankan:  python tools/asta-video/analyze.py
============================================================
"""
import os, sys, json, glob

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MED = os.path.join(ROOT, "ASTA REKAMAN FIX MP4")
OUT = os.path.join(MED, "_build", "words.json")


def main():
    from faster_whisper import WhisperModel
    files = sorted(glob.glob(os.path.join(MED, "S*.mp4"))) + \
            sorted(glob.glob(os.path.join(MED, "VOICE OVER", "*.wav")))
    old = {}
    if os.path.exists(OUT):
        old = json.load(open(OUT, encoding="utf-8"))
    m = WhisperModel("medium", device="cpu", compute_type="int8")
    res = dict(old)
    for f in files:
        key = os.path.relpath(f, MED).replace("\\", "/")
        if key in res and "--ulang" not in sys.argv:
            continue
        segs, _ = m.transcribe(f, language="id", beam_size=5, vad_filter=False,
                               word_timestamps=True, condition_on_previous_text=False)
        words = [[w.word.strip(), round(w.start, 3), round(w.end, 3)]
                 for s in segs for w in (s.words or [])]
        res[key] = words
        print(f"{key}\n   " + " ".join(f"{w}@{a:.2f}" for w, a, _ in words), flush=True)
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        json.dump(res, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n{len(res)} berkas -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
