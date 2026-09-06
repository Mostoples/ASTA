# -*- coding: utf-8 -*-
"""
ASTA — Rendering studio untuk model lengan bionik
==================================================
Membuka assets/3d/asta-arm.blend, menyiapkan studio (latar kertas putih,
pencahayaan tiga titik), lalu merender:

  hero       : 4 bidikan produk beresolusi tinggi
  turntable  : 36 bingkai putar 360° untuk penampil sprite di web
  poster     : satu bidikan 16:9 untuk hero halaman masuk

Jalankan:
  blender --background --python tools/blender/render_asta.py -- --preset all
  blender --background --python tools/blender/render_asta.py -- --preset hero --samples 128
"""

import bpy
import math
import os
import sys

RAD = math.radians
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
BLEND = os.path.join(ROOT, "assets", "3d", "asta-arm.blend")
OUT = os.path.join(ROOT, "assets", "render")
OUT_TT = os.path.join(OUT, "turntable")


def argv():
    """Ambil argumen setelah '--'."""
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1:]
    return []


def opt(name, default):
    a = argv()
    if name in a:
        i = a.index(name)
        if i + 1 < len(a):
            return a[i + 1]
    return default


# ==========================================================================
# Pose jari
# ==========================================================================
FINGER_KEYS = ["thumb", "index", "middle", "ring", "pinky"]
MAX_BEND = {"thumb": (46, 40), "index": (78, 84, 72), "middle": (80, 86, 74),
            "ring": (80, 86, 74), "pinky": (82, 88, 76)}


def set_pose(pose, wrist_deg=0.0):
    """pose = dict {finger: 0..1}. Menekuk ke arah telapak (-Z)."""
    for key in FINGER_KEYS:
        v = max(0.0, min(1.0, pose.get(key, 0.0)))
        for i, maxb in enumerate(MAX_BEND[key]):
            ob = bpy.data.objects.get("JNT_%s_%d" % (key, i))
            if not ob:
                continue
            e = list(ob.rotation_euler)
            e[0] = RAD(-maxb * v * (0.62 + i * 0.19))
            ob.rotation_euler = e
    w = bpy.data.objects.get("JNT_Wrist")
    if w:
        e = list(w.rotation_euler)
        e[1] = RAD(wrist_deg)
        w.rotation_euler = e


POSES = {
    "terbuka":   {},
    "santai":    {"thumb": 0.30, "index": 0.26, "middle": 0.30, "ring": 0.34, "pinky": 0.40},
    "genggam":   {"thumb": 0.78, "index": 0.90, "middle": 0.92, "ring": 0.92, "pinky": 0.94},
    "jepit":     {"thumb": 0.72, "index": 0.66, "middle": 0.12, "ring": 0.10, "pinky": 0.10},
    "tunjuk":    {"thumb": 0.55, "index": 0.02, "middle": 0.92, "ring": 0.92, "pinky": 0.92},
}


# ==========================================================================
# Studio
# ==========================================================================

def clear_helpers():
    for ob in list(bpy.data.objects):
        if ob.type in {"LIGHT", "CAMERA"} or ob.name.startswith("STUDIO_"):
            bpy.data.objects.remove(ob, do_unlink=True)


def area_light(name, loc, rot, size, energy, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.size = size
    data.color = color
    data.shape = "RECTANGLE"
    data.size_y = size * 0.62
    ob = bpy.data.objects.new(name, data)
    ob.location = loc
    ob.rotation_euler = rot
    bpy.context.collection.objects.link(ob)
    return ob


def build_studio(bg=True):
    """Latar kertas putih melengkung (cyclorama) + pencahayaan tiga titik."""
    clear_helpers()

    if bg:
        # Kertas putih: lantai menyatu melengkung ke dinding belakang (+Y),
        # meniru alas kertas pada foto purwarupa. Kamera selalu di sisi -Y.
        mesh = bpy.data.meshes.new("STUDIO_Backdrop")
        verts, faces = [], []
        HALF, Z0, Y0, R = 7.0, -0.092, 0.62, 0.55

        def row(y, z):
            verts.append((-HALF, y, z))
            verts.append((HALF, y, z))

        row(-7.0, Z0)                       # lantai jauh ke arah kamera
        n = 16
        for i in range(n + 1):              # lengkungan lantai -> dinding
            a = RAD(90) * i / n
            row(Y0 + math.sin(a) * R, Z0 + R - math.cos(a) * R)
        row(Y0 + R, Z0 + R + 6.0)           # dinding tegak

        for i in range(len(verts) // 2 - 1):
            a, b = i * 2, i * 2 + 1
            faces.append((a, b, b + 2, a + 2))
        mesh.from_pydata(verts, [], faces)
        mesh.validate()
        bd = bpy.data.objects.new("STUDIO_Backdrop", mesh)
        bpy.context.collection.objects.link(bd)

        m = bpy.data.materials.new("STUDIO_Paper")
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (0.930, 0.945, 0.965, 1)
        b.inputs["Roughness"].default_value = 0.62
        bd.data.materials.append(m)

    # Pencahayaan tiga titik: key besar & lembut, fill dingin, rim biru ASTA
    area_light("STUDIO_Key", (-1.05, -0.75, 1.30), (RAD(52), 0, RAD(-52)), 1.9, 31)
    area_light("STUDIO_Fill", (1.35, -0.35, 0.60), (RAD(74), 0, RAD(62)), 2.4, 11,
               color=(0.90, 0.94, 1.0))
    area_light("STUDIO_Rim", (0.55, 1.35, 1.05), (RAD(122), 0, RAD(168)), 1.2, 25,
               color=(0.62, 0.76, 1.0))
    area_light("STUDIO_Bounce", (0.0, -0.20, -0.85), (RAD(180), 0, 0), 2.6, 6.5,
               color=(0.96, 0.97, 1.0))

    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    world.use_nodes = True
    bgn = world.node_tree.nodes.get("Background")
    if bgn:
        bgn.inputs[0].default_value = (0.82, 0.86, 0.92, 1)
        bgn.inputs[1].default_value = 0.22


def make_camera(loc, target=(0, -0.16, 0), lens=85.0, name="CAM"):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam = bpy.data.objects.new(name, cam_data)
    cam.location = loc
    bpy.context.collection.objects.link(cam)

    tgt = bpy.data.objects.new(name + "_TGT", None)
    tgt.location = target
    bpy.context.collection.objects.link(tgt)
    c = cam.constraints.new("TRACK_TO")
    c.target = tgt
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    bpy.context.scene.camera = cam
    return cam


def setup_engine(samples=96, res=(1600, 1600), transparent=False):
    sc = bpy.context.scene
    engines = [e.bl_idname if hasattr(e, "bl_idname") else e
               for e in bpy.types.RenderEngine.__subclasses__()]
    prefer = ["BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"]
    chosen = None
    for p in prefer:
        try:
            sc.render.engine = p
            chosen = p
            break
        except (TypeError, ValueError):
            continue
    if chosen is None:
        sc.render.engine = "CYCLES"
        chosen = "CYCLES"

    if chosen.startswith("BLENDER_EEVEE"):
        ee = sc.eevee
        for attr, val in (("taa_render_samples", samples), ("use_gtao", True),
                          ("use_bloom", False), ("use_shadow_jitter_viewport", True),
                          ("use_raytracing", True), ("shadow_ray_count", 3),
                          ("shadow_step_count", 8)):
            if hasattr(ee, attr):
                try:
                    setattr(ee, attr, val)
                except Exception:
                    pass
    else:
        sc.cycles.samples = samples
        sc.cycles.use_denoising = True

    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    sc.render.image_settings.compression = 70
    # Standard + kontras ringan: warna cangkang gelap tetap pekat seperti
    # pada purwarupa; AgX terlalu mencuci bagian gelap pada latar putih.
    try:
        sc.view_settings.view_transform = "Standard"
        sc.view_settings.look = "None"
    except TypeError:
        pass
    sc.view_settings.exposure = 0.12
    sc.view_settings.gamma = 1.0
    print("[ASTA] engine:", chosen)
    return chosen


def render_to(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("[ASTA] render ->", path)


# ==========================================================================
# Preset
# ==========================================================================

def preset_hero(samples):
    build_studio(bg=True)
    setup_engine(samples, (1600, 1600))
    shots = [
        ("01-lengan-penuh",   (1.14, -0.80, 0.54), (0.0, -0.17, 0.02), 70, "santai"),
        ("02-tangan-genggam", (0.46, 0.26, 0.30),  (0.0, 0.055, 0.0),  95, "genggam"),
        ("03-tangan-jepit",   (0.40, 0.05, 0.34),  (-0.01, 0.06, 0.0), 95, "jepit"),
        ("04-siku-socket",    (0.86, -1.05, 0.46), (0.0, -0.40, 0.0),  85, "santai"),
    ]
    for name, loc, tgt, lens, pose in shots:
        set_pose(POSES[pose])
        make_camera(loc, tgt, lens, "CAM_" + name)
        render_to(os.path.join(OUT, name + ".png"))
        clear_cams()


def clear_cams():
    for ob in list(bpy.data.objects):
        if ob.type == "CAMERA" or ob.name.endswith("_TGT"):
            bpy.data.objects.remove(ob, do_unlink=True)


def preset_poster(samples):
    build_studio(bg=True)
    setup_engine(samples, (1920, 1080))
    set_pose(POSES["santai"])
    make_camera((1.02, -0.75, 0.40), (0.02, -0.16, 0.01), 62, "CAM_poster")
    render_to(os.path.join(OUT, "00-poster.png"))


def preset_turntable(samples, frames=36, res=768):
    """Bingkai putar dengan latar transparan — dipakai penampil sprite web."""
    build_studio(bg=False)
    setup_engine(samples, (res, res), transparent=True)
    set_pose(POSES["santai"])
    root = bpy.data.objects.get("ASTA_Arm")
    os.makedirs(OUT_TT, exist_ok=True)

    # Poros putar harus berada di titik berat lengan (bukan di pergelangan),
    # agar model tetap terbingkai di seluruh 360 derajat.
    pivot = bpy.data.objects.new("STUDIO_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    prev_parent, prev_loc = root.parent, tuple(root.location)
    root.parent = pivot
    root.location = (0.0, 0.175, 0.0)

    make_camera((0.0, -1.78, 0.60), (0.0, 0.0, 0.0), 66, "CAM_tt")
    for i in range(frames):
        pivot.rotation_euler = (0, 0, 2 * math.pi * i / frames)
        bpy.context.view_layer.update()
        render_to(os.path.join(OUT_TT, "tt-%02d.png" % i))

    root.parent, root.location = prev_parent, prev_loc
    bpy.data.objects.remove(pivot, do_unlink=True)


def preset_poses(samples, res=900):
    """Satu bidikan per pose genggaman — kartu genggaman di UI."""
    build_studio(bg=False)
    setup_engine(samples, (res, res), transparent=True)
    make_camera((0.46, -0.02, 0.30), (0.0, 0.045, 0.0), 74, "CAM_pose")
    for name, pose in POSES.items():
        set_pose(pose)
        render_to(os.path.join(OUT, "pose", "%s.png" % name))


if __name__ == "__main__":
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    preset = opt("--preset", "all")
    samples = int(opt("--samples", "96"))
    frames = int(opt("--frames", "36"))

    if preset in ("hero", "all"):
        preset_hero(samples)
    if preset in ("poster", "all"):
        preset_poster(samples)
    if preset in ("poses", "all"):
        preset_poses(samples)
    if preset in ("turntable", "all"):
        preset_turntable(max(48, samples), frames)
    print("[ASTA] rendering selesai.")
