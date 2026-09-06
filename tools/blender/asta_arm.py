# -*- coding: utf-8 -*-
"""
ASTA — Model 3D Lengan Bionik (prosthesis transradial modular)
===============================================================
Skrip prosedural Blender. Membangun ulang purwarupa cetak-3D ASTA:
cangkir socket humeral, cangkang siku, lengan bawah dua-warna,
konektor pergelangan, telapak, dan lima jari berartikulasi.

Setiap ruas jari adalah objek terpisah yang di-parent berantai dengan
origin tepat di sendi, sehingga pose dapat dikendalikan dari web
(three.js) maupun dari Blender hanya dengan memutar objek pada sumbu X.

Konvensi ruang:
  +Y = arah ujung jari      (distal)
  -Y = arah socket/bahu     (proksimal)
  +Z = punggung tangan      (jari menekuk ke -Z)
  +X = sisi kelingking      (model tangan kanan)
Satuan: meter. Panjang total ± 0,62 m.

Jalankan:
  blender --background --python tools/blender/asta_arm.py
Keluaran:
  assets/3d/asta-arm.blend
  assets/3d/asta-arm.glb
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

# --------------------------------------------------------------------------
# Lokasi proyek: naik dua tingkat dari tools/blender/
# --------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
OUT_3D = os.path.join(ROOT, "assets", "3d")
os.makedirs(OUT_3D, exist_ok=True)

TAU = math.tau
RAD = math.radians


# ==========================================================================
# Utilitas dasar
# ==========================================================================

def purge_scene():
    """Kosongkan berkas start-up bawaan Blender."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for item in list(block):
            block.remove(item)


def set_input(node, names, value):
    """Set soket Principled lintas versi Blender (nama soket berubah-ubah)."""
    if isinstance(names, str):
        names = [names]
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False


def link_mesh(name, bm, mat=None, parent=None, location=(0, 0, 0)):
    """Bekukan bmesh menjadi objek scene."""
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.location = location
    if mat:
        ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob


def smooth(ob, angle=34.0):
    """Shade smooth dengan batas sudut, aman lintas versi."""
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    try:
        bpy.ops.object.shade_auto_smooth(angle=RAD(angle))
    except Exception:
        try:
            bpy.ops.object.shade_smooth()
        except Exception:
            pass
    ob.select_set(False)


def bevel(ob, width=0.0016, segments=3, angle=42.0):
    m = ob.modifiers.new("Bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = RAD(angle)
    m.harden_normals = False
    return m


# ==========================================================================
# Primitif geometri
# ==========================================================================

def revolve(name, profile, mat=None, segs=48, parent=None,
            location=(0, 0, 0), cap_start=True, cap_end=True):
    """
    Bentuk putar mengelilingi sumbu Y.
    profile: [(y, radius), ...] berurutan dari pangkal ke ujung.
    Radius 0 diperlakukan sebagai titik poros (ujung lancip / dasar tertutup).
    """
    bm = bmesh.new()
    rings = []
    for y, r in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((0.0, y, 0.0))])
        else:
            ring = []
            for i in range(segs):
                a = TAU * i / segs
                ring.append(bm.verts.new((math.cos(a) * r, y, math.sin(a) * r)))
            rings.append(ring)

    for a_ring, b_ring in zip(rings[:-1], rings[1:]):
        if len(a_ring) == 1 and len(b_ring) == 1:
            continue
        if len(a_ring) == 1:                      # kipas dari titik poros
            for i in range(segs):
                bm.faces.new((a_ring[0], b_ring[i], b_ring[(i + 1) % segs]))
        elif len(b_ring) == 1:
            for i in range(segs):
                bm.faces.new((a_ring[(i + 1) % segs], a_ring[i], b_ring[0]))
        else:
            for i in range(segs):
                j = (i + 1) % segs
                bm.faces.new((a_ring[i], a_ring[j], b_ring[j], b_ring[i]))

    if cap_start and len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if cap_end and len(rings[-1]) > 1:
        bm.faces.new(rings[-1])

    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return link_mesh(name, bm, mat, parent, location)


def rbox(name, size, mat=None, parent=None, location=(0, 0, 0),
         center=(0, 0, 0), round_w=0.004, round_seg=4):
    """Kotak membulat (dipakai untuk telapak dan ruas jari)."""
    sx, sy, sz = size
    cx, cy, cz = center
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = v.co.x * sx + cx
        v.co.y = v.co.y * sy + cy
        v.co.z = v.co.z * sz + cz
    bm.normal_update()
    ob = link_mesh(name, bm, mat, parent, location)
    bevel(ob, width=round_w, segments=round_seg, angle=30.0)
    return ob


def disc(name, radius, mat=None, parent=None, location=(0, 0, 0),
         normal="Z", segs=28, thickness=0.0016):
    """Cakram tipis — dipakai untuk elektroda EMG dan panel indikator."""
    bm = bmesh.new()
    verts = []
    for i in range(segs):
        a = TAU * i / segs
        verts.append(bm.verts.new((math.cos(a) * radius, math.sin(a) * radius, 0.0)))
    bm.faces.new(verts)
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=thickness)
    bm.normal_update()
    ob = link_mesh(name, bm, mat, parent, location)
    if normal == "X":
        ob.rotation_euler = (0, RAD(90), 0)
    elif normal == "Y":
        ob.rotation_euler = (RAD(90), 0, 0)
    return ob


def empty(name, location=(0, 0, 0), parent=None, size=0.02):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = "PLAIN_AXES"
    ob.empty_display_size = size
    bpy.context.collection.objects.link(ob)
    ob.location = location
    if parent:
        ob.parent = parent
    return ob


# ==========================================================================
# Material — plastik cetak 3D dengan garis lapisan (layer line) prosedural
# ==========================================================================

def shell_material(name, color, roughness=0.42, layer_lines=True,
                   layer_scale=460.0, bump=0.09, sheen=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (620, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (300, 0)
    set_input(bsdf, "Base Color", (*color, 1.0))
    set_input(bsdf, "Roughness", roughness)
    set_input(bsdf, ["Specular IOR Level", "Specular"], 0.42)
    set_input(bsdf, ["Sheen Weight", "Sheen"], sheen)
    set_input(bsdf, ["Coat Weight", "Clearcoat"], 0.05)
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])

    if layer_lines:
        # Garis lapisan FDM: gelombang halus sepanjang sumbu part + derau mikro
        tc = nt.nodes.new("ShaderNodeTexCoord")
        tc.location = (-720, -180)
        mapn = nt.nodes.new("ShaderNodeMapping")
        mapn.location = (-540, -180)
        mapn.inputs["Rotation"].default_value[2] = RAD(90)   # pita tegak lurus sumbu Y

        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.location = (-350, -140)
        wave.wave_type = "BANDS"
        wave.bands_direction = "X"
        wave.wave_profile = "SIN"
        wave.inputs["Scale"].default_value = layer_scale
        wave.inputs["Distortion"].default_value = 0.6
        wave.inputs["Detail"].default_value = 1.0

        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.location = (-350, 140)
        noise.inputs["Scale"].default_value = 180.0
        noise.inputs["Detail"].default_value = 3.0

        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.location = (-140, 0)
        mix.inputs["Factor"].default_value = 0.28
        nt.links.new(tc.outputs["Object"], mapn.inputs["Vector"])
        nt.links.new(mapn.outputs["Vector"], wave.inputs["Vector"])
        nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        nt.links.new(wave.outputs["Color"], mix.inputs[6])
        nt.links.new(noise.outputs["Color"], mix.inputs[7])

        bumpn = nt.nodes.new("ShaderNodeBump")
        bumpn.location = (60, -180)
        bumpn.inputs["Strength"].default_value = bump
        bumpn.inputs["Distance"].default_value = 0.02
        nt.links.new(mix.outputs[2], bumpn.inputs["Height"])
        nt.links.new(bumpn.outputs["Normal"], bsdf.inputs["Normal"])

        # Kekasaran ikut bervariasi mengikuti alur cetak
        rmap = nt.nodes.new("ShaderNodeMapRange")
        rmap.location = (60, 180)
        rmap.inputs["To Min"].default_value = max(0.05, roughness - 0.09)
        rmap.inputs["To Max"].default_value = min(1.0, roughness + 0.09)
        nt.links.new(mix.outputs[2], rmap.inputs["Value"])
        nt.links.new(rmap.outputs["Result"], bsdf.inputs["Roughness"])
    return mat


def emissive_material(name, color, strength=3.2):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (-300, 0)
    set_input(bsdf, "Base Color", (*color, 1.0))
    set_input(bsdf, "Roughness", 0.25)
    set_input(bsdf, ["Emission Color", "Emission"], (*color, 1.0))
    set_input(bsdf, "Emission Strength", strength)
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def metal_material(name, color, roughness=0.3):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    set_input(bsdf, "Base Color", (*color, 1.0))
    set_input(bsdf, "Metallic", 1.0)
    set_input(bsdf, "Roughness", roughness)
    return mat


def rubber_material(name, color, roughness=0.72):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    set_input(bsdf, "Base Color", (*color, 1.0))
    set_input(bsdf, "Roughness", roughness)
    set_input(bsdf, ["Specular IOR Level", "Specular"], 0.28)
    return mat


# ==========================================================================
# Data jari — panjang ruas dalam meter, mengikuti proporsi purwarupa
# ==========================================================================
FINGERS = [
    # key,      x,      y_base, z,      spread, segs (panjang ruas),        lebar,  tebal
    ("index",  -0.0255, 0.0955, 0.002,   -6.0, (0.0430, 0.0276, 0.0212), 0.0196, 0.0186),
    ("middle", -0.0010, 0.0990, 0.001,   -1.0, (0.0466, 0.0300, 0.0222), 0.0202, 0.0192),
    ("ring",    0.0245, 0.0955, 0.000,    4.0, (0.0428, 0.0274, 0.0210), 0.0192, 0.0182),
    ("pinky",   0.0478, 0.0865, -0.002,  11.0, (0.0346, 0.0228, 0.0180), 0.0168, 0.0160),
]
THUMB = ("thumb", -0.0430, 0.0210, -0.008, (0.0400, 0.0308), 0.0228, 0.0212)


def build_finger(key, palm, mat_dark, mat_joint, x, y, z, spread, segs, w, t):
    """
    Rantai ruas jari. Setiap objek diberi nama JNT_<key>_<i>; origin objek
    berada tepat di sendi sehingga rotasi X murni = fleksi.
    """
    parent = palm
    loc = (x, y, z)
    chain = []
    for i, ln in enumerate(segs):
        taper = 1.0 - i * 0.10
        ww, tt = w * taper, t * taper
        name = "JNT_%s_%d" % (key, i)
        ob = rbox(
            name,
            (ww, ln, tt),
            mat_dark,
            parent=parent,
            location=loc,
            center=(0.0, ln * 0.5, 0.0),
            round_w=min(ww, tt) * 0.34,
            round_seg=4,
        )
        if i == 0:
            ob.rotation_euler = (0.0, 0.0, RAD(spread))
        smooth(ob)
        # Poros sendi (silinder melintang sumbu X)
        pin = revolve(
            "PIN_%s_%d" % (key, i),
            [(-ww * 0.62, 0.0), (-ww * 0.62, tt * 0.30), (ww * 0.62, tt * 0.30), (ww * 0.62, 0.0)],
            mat_joint, segs=20, parent=ob,
        )
        pin.rotation_euler = (0, 0, RAD(90))   # sumbu putar mengarah ke X
        smooth(pin)
        # Bantalan silikon di sisi telapak (ruas distal saja)
        if i == len(segs) - 1:
            pad = rbox("PAD_%s" % key, (ww * 0.74, ln * 0.62, tt * 0.22),
                       PAD_MAT, parent=ob, location=(0, ln * 0.42, -tt * 0.46),
                       round_w=0.0018, round_seg=3)
            smooth(pad)
        chain.append(ob)
        parent = ob
        loc = (0.0, ln, 0.0)
    return chain


# ==========================================================================
# Pembangunan model
# ==========================================================================

def build():
    purge_scene()

    global PAD_MAT
    WHITE = shell_material("ASTA_Shell_White", (0.885, 0.897, 0.912),
                           roughness=0.40, layer_scale=520.0, bump=0.10, sheen=0.12)
    DARK = shell_material("ASTA_Shell_Dark", (0.058, 0.062, 0.070),
                          roughness=0.47, layer_scale=470.0, bump=0.11)
    DARK2 = shell_material("ASTA_Shell_Graphite", (0.088, 0.094, 0.104),
                           roughness=0.44, layer_scale=430.0, bump=0.10)
    STEEL = metal_material("ASTA_Steel", (0.62, 0.65, 0.70), roughness=0.28)
    BLUE = emissive_material("ASTA_Accent_Blue", (0.169, 0.424, 0.871), 2.4)
    TEAL = emissive_material("ASTA_Electrode", (0.063, 0.647, 0.647), 4.0)
    PAD_MAT = rubber_material("ASTA_Grip_Pad", (0.030, 0.032, 0.036))

    root = empty("ASTA_Arm", size=0.05)

    # ---------------------------------------------------------------- socket
    # Cangkir humeral (bagian gelap paling proksimal) + braket putih
    socket = empty("JNT_Socket", (0.0, -0.4980, 0.0), parent=root)

    cup = revolve(
        "ASTA_SocketCup",
        [
            (0.0000, 0.0000), (0.0000, 0.0455),      # dasar cangkir
            (0.0090, 0.0498), (0.0300, 0.0545),
            (0.0560, 0.0575), (0.0620, 0.0578),      # bibir luar
            (0.0622, 0.0540),                        # bibir dalam
            (0.0560, 0.0532), (0.0300, 0.0500),
            (0.0110, 0.0452), (0.0105, 0.0000),      # dinding dalam & dasar
        ],
        DARK, segs=64, parent=socket, cap_start=False, cap_end=False,
    )
    cup.rotation_euler = (RAD(-74), 0, 0)   # mulut cangkir menghadap atas-belakang
    smooth(cup)

    bracket = rbox("ASTA_SocketBracket", (0.0190, 0.1180, 0.0420), WHITE,
                   parent=root, location=(0.0, -0.4340, -0.0180),
                   center=(0, 0, 0), round_w=0.006, round_seg=4)
    bracket.rotation_euler = (RAD(9), 0, 0)
    smooth(bracket)

    for sx in (-0.0135, 0.0135):
        for py in (-0.470, -0.432, -0.396):
            b = revolve("BOLT_%s_%s" % (sx, py),
                        [(-0.0016, 0.0), (-0.0016, 0.0042), (0.0016, 0.0042), (0.0016, 0.0)],
                        STEEL, segs=16, parent=root, location=(sx, py, -0.018))
            b.rotation_euler = (0, 0, RAD(90))
            smooth(b)

    # ------------------------------------------------------------- siku/elbow
    elbow = empty("JNT_Elbow", (0.0, -0.3480, 0.0), parent=root)

    elbow_shell = revolve(
        "ASTA_ElbowShell",
        [
            (-0.0980, 0.0000), (-0.0960, 0.0300), (-0.0880, 0.0510),
            (-0.0720, 0.0655), (-0.0520, 0.0742), (-0.0260, 0.0788),
            (0.0000, 0.0800), (0.0300, 0.0790), (0.0560, 0.0752),
            (0.0790, 0.0690), (0.0930, 0.0630),
        ],
        WHITE, segs=64, parent=elbow, cap_start=True, cap_end=False,
    )
    smooth(elbow_shell)

    # Cincin pemisah gelap pada sambungan siku–lengan bawah
    elbow_ring = revolve(
        "ASTA_ElbowRing",
        [(0.0930, 0.0632), (0.1010, 0.0620), (0.1080, 0.0596)],
        DARK2, segs=64, parent=elbow, cap_start=False, cap_end=False,
    )
    smooth(elbow_ring)

    # Engsel siku samping (dua pelat + poros)
    for sx in (-0.0640, 0.0640):
        plate = rbox("ASTA_ElbowPlate_%s" % ("L" if sx < 0 else "R"),
                     (0.0080, 0.0560, 0.0330), WHITE, parent=elbow,
                     location=(sx, -0.0560, -0.0130), round_w=0.005, round_seg=4)
        plate.rotation_euler = (RAD(-16), 0, 0)
        smooth(plate)
        hub = revolve("ASTA_ElbowHub_%s" % ("L" if sx < 0 else "R"),
                      [(-0.0060, 0.0), (-0.0060, 0.0132), (0.0035, 0.0140), (0.0035, 0.0)],
                      STEEL, segs=28, parent=elbow,
                      location=(sx + (0.006 if sx < 0 else -0.006), -0.0560, -0.0130))
        hub.rotation_euler = (0, 0, RAD(90 if sx < 0 else -90))
        smooth(hub)

    # ---------------------------------------------------------- lengan bawah
    forearm = empty("JNT_Forearm", (0.0, -0.2400, 0.0), parent=root)

    # Selongsong putih proksimal (menyatu dengan siku)
    fa_top = revolve(
        "ASTA_ForearmProximal",
        [(-0.1120, 0.0596), (-0.0900, 0.0578), (-0.0660, 0.0548), (-0.0470, 0.0518)],
        WHITE, segs=56, parent=forearm, cap_start=False, cap_end=False,
    )
    smooth(fa_top)

    # Badan grafit — bagian terpanjang, meruncing ke pergelangan
    fa_mid = revolve(
        "ASTA_ForearmShell",
        [
            (-0.0470, 0.0519), (-0.0200, 0.0492), (0.0200, 0.0452),
            (0.0700, 0.0400), (0.1200, 0.0348), (0.1650, 0.0303),
            (0.1950, 0.0276),
        ],
        DARK, segs=56, parent=forearm, cap_start=False, cap_end=False,
    )
    smooth(fa_mid)

    # Cincin putih distal + konektor pergelangan cepat-lepas
    fa_cuff = revolve(
        "ASTA_ForearmCuff",
        [(0.1950, 0.0277), (0.2120, 0.0272), (0.2260, 0.0268), (0.2270, 0.0250)],
        WHITE, segs=56, parent=forearm, cap_start=False, cap_end=True,
    )
    smooth(fa_cuff)

    # Elektroda EMG di permukaan lengan bawah (kanal ch1..ch4)
    el_defs = [
        ("ch1", 0.0000, 0.0180, -1.0),
        ("ch2", 0.0480, 0.0180, -1.0),
        ("ch3", 0.0000, -0.0180, 1.0),
        ("ch4", 0.0480, -0.0180, 1.0),
    ]
    for cid, ey, ex, sgn in el_defs:
        r_here = 0.0452 - (ey - 0.02) * 0.105
        ang = math.atan2(sgn * 1.0, 0.0)
        cx = ex
        cz = math.sqrt(max(r_here ** 2 - cx ** 2, 1e-6)) * (-1.0 if sgn < 0 else 1.0)
        pod = revolve("EL_%s" % cid,
                      [(0.0, 0.0), (0.0, 0.0092), (0.0028, 0.0092), (0.0034, 0.0072)],
                      TEAL, segs=24, parent=forearm, location=(cx, ey, cz))
        # Arahkan keluar dari sumbu lengan
        pod.rotation_euler = (RAD(90) if cz > 0 else RAD(-90), 0, 0)
        d = Vector((cx, 0.0, cz)).normalized()
        pod.rotation_euler = (
            math.atan2(d.z, 0.0) * 0 + (RAD(-90) if d.z > 0 else RAD(90)),
            0.0,
            math.atan2(d.x, abs(d.z) + 1e-6) * (1.0 if d.z > 0 else -1.0),
        )
        pod.name = "EL_%s" % cid
        smooth(pod)

    # Panel indikator biru di punggung lengan bawah
    panel = rbox("ASTA_StatusPanel", (0.0230, 0.0520, 0.0060), DARK2, parent=forearm,
                 location=(0.0, 0.1150, 0.0316), round_w=0.0022, round_seg=3)
    panel.rotation_euler = (RAD(-6), 0, 0)
    smooth(panel)
    led = rbox("ASTA_StatusLED", (0.0150, 0.0330, 0.0030), BLUE, parent=forearm,
               location=(0.0, 0.1150, 0.0336), round_w=0.0012, round_seg=2)
    led.rotation_euler = (RAD(-6), 0, 0)
    smooth(led)

    # ---------------------------------------------------------- pergelangan
    wrist = empty("JNT_Wrist", (0.0, -0.0150, 0.0), parent=root)

    wrist_ring = revolve(
        "ASTA_WristRing",
        [
            (-0.0270, 0.0248), (-0.0180, 0.0262), (-0.0060, 0.0268),
            (0.0060, 0.0264), (0.0150, 0.0252),
        ],
        WHITE, segs=48, parent=wrist, cap_start=True, cap_end=True,
    )
    smooth(wrist_ring)

    for i in range(3):
        slot = rbox("ASTA_WristSlot_%d" % i, (0.0044, 0.0170, 0.0044), DARK2,
                    parent=wrist, location=(0, -0.006, 0), round_w=0.0014, round_seg=2)
        slot.rotation_euler = (0, RAD(120 * i), 0)
        slot.location = (
            math.sin(RAD(120 * i)) * 0.0262,
            -0.006,
            math.cos(RAD(120 * i)) * 0.0262,
        )
        smooth(slot)

    wrist_hub = revolve("ASTA_WristHub",
                        [(0.0150, 0.0), (0.0150, 0.0252), (0.0230, 0.0238), (0.0230, 0.0)],
                        DARK2, segs=48, parent=wrist)
    smooth(wrist_hub)

    # ---------------------------------------------------------------- tangan
    palm = empty("JNT_Palm", (0.0, 0.0080, 0.0), parent=wrist)
    palm.scale = (1.09, 1.09, 1.09)

    palm_body = rbox("ASTA_Palm", (0.0865, 0.0930, 0.0300), DARK, parent=palm,
                     location=(0.0, 0.0450, 0.0), round_w=0.0075, round_seg=5)
    smooth(palm_body)

    # Punggung tangan: pelat rangka miring seperti pada purwarupa
    knuckle = rbox("ASTA_Knuckle", (0.0800, 0.0230, 0.0250), DARK2, parent=palm,
                   location=(0.0, 0.0890, 0.0032), round_w=0.0060, round_seg=4)
    knuckle.rotation_euler = (RAD(-9), 0, 0)
    smooth(knuckle)

    dorsal = rbox("ASTA_DorsalPlate", (0.0560, 0.0520, 0.0042), WHITE, parent=palm,
                  location=(0.0, 0.0430, 0.0160), round_w=0.0018, round_seg=3)
    dorsal.rotation_euler = (RAD(3), 0, 0)
    smooth(dorsal)

    thenar = rbox("ASTA_Thenar", (0.0230, 0.0420, 0.0270), DARK2, parent=palm,
                  location=(-0.0345, 0.0170, -0.0020), round_w=0.0060, round_seg=4)
    thenar.rotation_euler = (0, 0, RAD(8))
    smooth(thenar)

    pad_palm = rbox("ASTA_PalmPad", (0.0620, 0.0560, 0.0050), PAD_MAT, parent=palm,
                    location=(0.0, 0.0450, -0.0158), round_w=0.0020, round_seg=3)
    smooth(pad_palm)

    # Jari-jari
    for key, x, y, z, spread, segs, w, t in FINGERS:
        build_finger(key, palm, DARK, STEEL, x, y, z, spread, segs, w, t)

    # Ibu jari: pangkal berputar keluar bidang telapak
    tkey, tx, ty, tz, tsegs, tw, tt = THUMB
    thumb_base = empty("JNT_thumb_root", (tx, ty, tz), parent=palm)
    thumb_base.rotation_euler = (RAD(-42), RAD(-18), RAD(34))
    parent = thumb_base
    loc = (0.0, 0.0, 0.0)
    for i, ln in enumerate(tsegs):
        taper = 1.0 - i * 0.10
        ww, ttk = tw * taper, tt * taper
        ob = rbox("JNT_thumb_%d" % i, (ww, ln, ttk), DARK, parent=parent, location=loc,
                  center=(0.0, ln * 0.5, 0.0), round_w=min(ww, ttk) * 0.34, round_seg=4)
        smooth(ob)
        pin = revolve("PIN_thumb_%d" % i,
                      [(-ww * 0.62, 0.0), (-ww * 0.62, ttk * 0.30),
                       (ww * 0.62, ttk * 0.30), (ww * 0.62, 0.0)],
                      STEEL, segs=20, parent=ob)
        pin.rotation_euler = (0, 0, RAD(90))
        smooth(pin)
        if i == len(tsegs) - 1:
            pad = rbox("PAD_thumb", (ww * 0.74, ln * 0.62, ttk * 0.22), PAD_MAT,
                       parent=ob, location=(0, ln * 0.42, -ttk * 0.46),
                       round_w=0.0018, round_seg=3)
            smooth(pad)
        parent = ob
        loc = (0.0, ln, 0.0)

    # Sensor gaya di ujung telunjuk & ibu jari (titik umpan balik haptik)
    for host_name in ("JNT_index_2", "JNT_thumb_1"):
        host = bpy.data.objects.get(host_name)
        if host:
            s = disc("SENSOR_%s" % host_name, 0.0052, BLUE, parent=host,
                     location=(0.0, 0.0130, -0.0072), normal="Z", segs=20)
            s.rotation_euler = (RAD(180), 0, 0)

    bpy.context.view_layer.update()
    return root


# ==========================================================================
# Ekspor
# ==========================================================================

def export(root):
    blend_path = os.path.join(OUT_3D, "asta-arm.blend")
    glb_path = os.path.join(OUT_3D, "asta-arm.glb")

    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print("[ASTA] blend  ->", blend_path)

    kwargs = dict(
        filepath=glb_path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError:
        kwargs.pop("export_apply", None)
        bpy.ops.export_scene.gltf(**kwargs)
    size = os.path.getsize(glb_path) / 1024.0
    print("[ASTA] glb    -> %s (%.0f KB)" % (glb_path, size))


if __name__ == "__main__":
    root = build()
    n_obj = len(bpy.context.scene.objects)
    n_tri = sum(len(o.data.loop_triangles) if o.type == "MESH" else 0
                for o in bpy.context.scene.objects)
    print("[ASTA] objek: %d" % n_obj)
    export(root)
    print("[ASTA] selesai.")
