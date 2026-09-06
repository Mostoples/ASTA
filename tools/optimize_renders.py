# -*- coding: utf-8 -*-
"""
ASTA — Optimalkan hasil render Blender untuk web.

Render mentah Blender berukuran 1600–1920 px (belasan MB). Skrip ini
menghasilkan turunan siap-web di assets/render/web/:

  hero/*.jpg        bidikan produk, latar putih  -> JPEG progresif
  pose/*.png        pose genggaman, latar tembus  -> PNG dipangkas + kuantisasi
  turntable/*.webp  36 bingkai putar              -> WebP beralfa (ringan)

Jalankan:  python tools/optimize_renders.py
"""

import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SRC = os.path.join(ROOT, "assets", "render")
DST = os.path.join(SRC, "web")


def ensure(*parts):
    p = os.path.join(*parts)
    os.makedirs(p, exist_ok=True)
    return p


def fit(im, longest):
    """Skala proporsional agar sisi terpanjang = longest (tanpa memperbesar)."""
    w, h = im.size
    if max(w, h) <= longest:
        return im
    s = longest / float(max(w, h))
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def trim_alpha(im, pad=6):
    """Pangkas piksel transparan di tepi agar subjek mengisi bingkai."""
    box = im.getchannel("A").getbbox()
    if not box:
        return im
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad),
                    min(im.width, r + pad), min(im.height, b + pad)))


def save_jpeg(im, path, longest, quality=84):
    im = fit(im.convert("RGB"), longest)
    im.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    return os.path.getsize(path)


def save_png(im, path, longest):
    im = fit(im, longest)
    im.save(path, "PNG", optimize=True)
    return os.path.getsize(path)


def save_webp(im, path, longest, quality=86):
    im = fit(im, longest)
    im.save(path, "WEBP", quality=quality, method=6)
    return os.path.getsize(path)


def run():
    total_in = total_out = 0

    # ---- Bidikan produk: latar putih, tidak perlu alfa -> JPEG
    hero_dir = ensure(DST, "hero")
    hero_size = {"00-poster": 1920}
    for fn in sorted(os.listdir(SRC)):
        if not fn.endswith(".png"):
            continue
        stem = os.path.splitext(fn)[0]
        src = os.path.join(SRC, fn)
        total_in += os.path.getsize(src)
        with Image.open(src) as im:
            out = os.path.join(hero_dir, stem + ".jpg")
            total_out += save_jpeg(im, out, hero_size.get(stem, 1200))
        print("hero      ", stem)

    # ---- Pose genggaman: butuh alfa, dipangkas rapat -> PNG
    pose_src = os.path.join(SRC, "pose")
    if os.path.isdir(pose_src):
        pose_dir = ensure(DST, "pose")
        for fn in sorted(os.listdir(pose_src)):
            if not fn.endswith(".png"):
                continue
            src = os.path.join(pose_src, fn)
            total_in += os.path.getsize(src)
            with Image.open(src) as im:
                im = trim_alpha(im.convert("RGBA"))
                total_out += save_png(im, os.path.join(pose_dir, fn), 520)
            print("pose      ", fn)

    # ---- Turntable: 36 bingkai, alfa, dipakai penampil sprite tanpa WebGL
    tt_src = os.path.join(SRC, "turntable")
    if os.path.isdir(tt_src):
        tt_dir = ensure(DST, "turntable")
        # Kotak pangkas seragam untuk seluruh bingkai agar tidak bergetar
        box = None
        names = sorted(f for f in os.listdir(tt_src) if f.endswith(".png"))
        for fn in names:
            with Image.open(os.path.join(tt_src, fn)) as im:
                b = im.convert("RGBA").getchannel("A").getbbox()
            if b:
                box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]),
                                             max(box[2], b[2]), max(box[3], b[3]))
        for fn in names:
            src = os.path.join(tt_src, fn)
            total_in += os.path.getsize(src)
            with Image.open(src) as im:
                im = im.convert("RGBA")
                if box:
                    im = im.crop(box)
                out = os.path.join(tt_dir, os.path.splitext(fn)[0] + ".webp")
                total_out += save_webp(im, out, 560)
        print("turntable ", len(names), "bingkai, kotak =", box)

    print("\nmasukan %.1f MB  ->  keluaran %.1f MB  (%.0f%% lebih kecil)"
          % (total_in / 1e6, total_out / 1e6,
             100 * (1 - total_out / max(total_in, 1))))


if __name__ == "__main__":
    run()
