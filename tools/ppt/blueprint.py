"""Blueprint rakitan ASTA dari mesh 3D -> DXF (LibreCAD) -> SVG.

    python tools/ppt/blueprint.py                      # model sementara assets/3d/asta-arm.glb
    python tools/ppt/blueprint.py path/ke/folder-stl   # satu berkas STL = satu komponen
    python tools/ppt/blueprint.py a.stl b.stl ...

Setiap lembar berisi proyeksi ortografis (garis tampak tebal, garis tersembunyi
putus-putus), ukuran utama, dan kepala gambar. Garis tersembunyi dihitung per
komponen: siluet komponen dikurangi siluet komponen yang lebih dekat ke mata.

Keluaran di tools/ppt/out/blueprint/:
  asta-blueprint-rakitan.dxf   tampak depan, atas, samping + isometri
  asta-blueprint-urai.dxf      isometri terurai (exploded) dengan label komponen
  *.svg                        hasil render LibreCAD (dxf2svg)
"""
import os, re, sys, glob, subprocess, datetime
import numpy as np
import trimesh
import ezdxf
from ezdxf.enums import TextEntityAlignment
from shapely.geometry import Polygon, MultiPolygon, LineString
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'tools', 'ppt', 'out', 'blueprint')
LIBRECAD = r'C:\Program Files\LibreCAD\LibreCAD.exe'

# Nama kelompok untuk model GLB sementara (awalan nama objek Blender)
GROUPS_GLB = [
    ('Socket', ('ASTA_Socket', 'BOLT_', 'EL_')),
    ('Sendi siku', ('ASTA_Elbow',)),
    ('Lengan bawah', ('ASTA_Forearm', 'ASTA_Status')),
    ('Pergelangan', ('ASTA_Wrist',)),
    ('Telapak', ('ASTA_Palm', 'ASTA_Dorsal', 'ASTA_Knuckle', 'ASTA_Thenar')),
    ('Jari', ('JNT_', 'PIN_', 'PAD_', 'SENSOR_')),
]


# ---------------------------------------------------------------- muat mesh
def load_parts(args):
    """-> list of (nama komponen, nama kelompok, trimesh) dalam milimeter."""
    parts = []
    if not args:
        args = [os.path.join(ROOT, 'assets', '3d', 'asta-arm.glb')]
    files = []
    for a in args:
        files += sorted(glob.glob(os.path.join(a, '*.stl')) + glob.glob(os.path.join(a, '*.STL'))) \
            if os.path.isdir(a) else [a]
    for f in files:
        obj = trimesh.load(f)
        if isinstance(obj, trimesh.Scene):
            for node in obj.graph.nodes_geometry:
                T, gname = obj.graph[node]
                m = obj.geometry[gname].copy()
                m.apply_transform(T)
                grp = next((g for g, pre in GROUPS_GLB if node.startswith(pre)), 'Lainnya')
                parts.append((node, grp, m))
        else:
            stem = os.path.splitext(os.path.basename(f))[0]
            parts.append((stem, stem, obj))
    # Satuan: mesh berukuran < 5 unit dianggap meter
    ext = np.ptp(np.vstack([p[2].bounds for p in parts]), axis=0).max()
    if ext < 5:
        for _, _, m in parts:
            m.apply_scale(1000.0)
    # Sumbu model: terpanjang -> X, menengah -> Y (tinggi tampak depan), terpendek -> Z
    allb = np.vstack([p[2].bounds for p in parts])
    order = np.argsort(-np.ptp(allb, axis=0))
    for _, _, m in parts:
        m.vertices = m.vertices[:, order]
    center = np.vstack([p[2].bounds for p in parts]).mean(axis=0)
    for _, _, m in parts:
        m.apply_translation(-center)
    return parts


# ---------------------------------------------------------------- proyeksi
def view_basis(name):
    """Baris: u (kanan), v (atas), d (menuju mata)."""
    if name == 'depan':
        return np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]], float)
    if name == 'atas':
        return np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)
    if name == 'samping':
        return np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]], float)
    if name == 'iso':
        d = np.array([-1.0, 0.9, 1.1]); d /= np.linalg.norm(d)
        up = np.array([0, 1.0, 0])
        u = np.cross(up, d); u /= np.linalg.norm(u)
        v = np.cross(d, u)
        return np.array([u, v, d])
    raise ValueError(name)


def silhouette(mesh, B):
    p = mesh.vertices @ B.T
    tris = p[mesh.faces][:, :, :2]
    polys = []
    for t in tris:
        a = (t[1, 0] - t[0, 0]) * (t[2, 1] - t[0, 1]) - (t[2, 0] - t[0, 0]) * (t[1, 1] - t[0, 1])
        if abs(a) > 1e-6:
            polys.append(Polygon(t))
    if not polys:
        return None, 0.0
    sil = unary_union(polys).buffer(0.05).buffer(-0.05)
    return sil, float(p[:, 2].mean())


def lines_of(geom):
    if geom is None or geom.is_empty:
        return []
    if geom.geom_type == 'LineString':
        return [list(geom.coords)]
    if geom.geom_type in ('MultiLineString', 'GeometryCollection'):
        out = []
        for g in geom.geoms:
            out += lines_of(g)
        return out
    if geom.geom_type in ('Polygon', 'MultiPolygon'):
        return lines_of(geom.boundary)
    return []


def project(parts, name, offset=None):
    """-> (garis tampak, garis tersembunyi, batas 2D, siluet per kelompok)."""
    B = view_basis(name)
    items = []
    for pname, grp, m in parts:
        mm = m
        if offset is not None:
            mm = m.copy(); mm.apply_translation(offset.get(grp, (0, 0, 0)))
        sil, depth = silhouette(mm, B)
        if sil is not None:
            items.append((depth, grp, sil))
    items.sort(key=lambda x: -x[0])          # terdekat ke mata lebih dulu
    visible, hidden, cover = [], [], None
    groups = {}
    for depth, grp, sil in items:
        edge = sil.boundary
        if cover is None:
            vis, hid = edge, None
        else:
            vis = edge.difference(cover)
            hid = edge.intersection(cover)
        visible += [l for l in lines_of(vis) if LineString(l).length > 0.4]
        hidden += [l for l in lines_of(hid) if LineString(l).length > 1.5]
        cover = sil if cover is None else unary_union([cover, sil])
        groups[grp] = sil if grp not in groups else unary_union([groups[grp], sil])
    minx, miny, maxx, maxy = cover.bounds
    return visible, hidden, (minx, miny, maxx, maxy), groups


# ---------------------------------------------------------------- DXF
def new_doc():
    doc = ezdxf.new('R2010', setup=True)
    doc.units = ezdxf.units.MM
    doc.layers.add('TAMPAK', color=7, lineweight=50)
    doc.layers.add('TERSEMBUNYI', color=8, linetype='DASHED', lineweight=18)
    doc.layers.add('SUMBU', color=1, linetype='CENTER', lineweight=13)
    doc.layers.add('UKURAN', color=5, lineweight=18)
    doc.layers.add('TEKS', color=7, lineweight=25)
    doc.layers.add('BINGKAI', color=7, lineweight=70)
    doc.header['$LTSCALE'] = 4.0
    doc.header['$DIMSCALE'] = 5.0
    return doc


def put(msp, lines, layer, dx, dy):
    for l in lines:
        msp.add_lwpolyline([(x + dx, y + dy) for x, y in l], dxfattribs={'layer': layer})


def text(msp, s, x, y, h, align=TextEntityAlignment.LEFT, layer='TEKS'):
    t = msp.add_text(s, height=h, dxfattribs={'layer': layer, 'style': 'OpenSans'})
    t.set_placement((x, y), align=align)
    return t


def frame(msp, W, H, title, sheet):
    m = 12
    msp.add_lwpolyline([(0, 0), (W, 0), (W, H), (0, H)], close=True, dxfattribs={'layer': 'BINGKAI'})
    msp.add_lwpolyline([(m, m), (W - m, m), (W - m, H - m), (m, H - m)], close=True,
                       dxfattribs={'layer': 'BINGKAI'})
    # kepala gambar
    bw, bh = 420, 92
    x0, y0 = W - m - bw, m
    msp.add_lwpolyline([(x0, y0), (x0 + bw, y0), (x0 + bw, y0 + bh), (x0, y0 + bh)], close=True,
                       dxfattribs={'layer': 'BINGKAI'})
    for yy in (y0 + 30, y0 + 58):
        msp.add_line((x0, yy), (x0 + bw, yy), dxfattribs={'layer': 'BINGKAI'})
    msp.add_line((x0 + 290, y0), (x0 + 290, y0 + 58), dxfattribs={'layer': 'BINGKAI'})
    text(msp, 'ASTA - ' + title, x0 + 10, y0 + 68, 14)
    text(msp, 'Lengan bionik modular non-invasif', x0 + 10, y0 + 39, 9)
    text(msp, 'SMA Negeri 1 Surakarta | HRIE 2026', x0 + 10, y0 + 11, 9)
    text(msp, 'SATUAN: mm', x0 + 300, y0 + 39, 9)
    text(msp, 'LEMBAR ' + sheet, x0 + 300, y0 + 11, 9)


DIMOV = {'dimtxt': 14, 'dimasz': 9, 'dimexe': 5, 'dimexo': 4, 'dimgap': 3, 'dimscale': 1, 'dimtad': 1}


def dim_h(msp, x1, x2, y, base_y):
    d = msp.add_linear_dim(base=(x1, base_y), p1=(x1, y), p2=(x2, y), angle=0,
                           text='%.0f' % abs(x2 - x1),
                           dimstyle='EZDXF', override=DIMOV, dxfattribs={'layer': 'UKURAN'})
    d.set_text_format(dec=0); d.render()


def dim_v(msp, y1, y2, x, base_x):
    d = msp.add_linear_dim(base=(base_x, y1), p1=(x, y1), p2=(x, y2), angle=90,
                           text='%.0f' % abs(y2 - y1),
                           dimstyle='EZDXF', override=DIMOV, dxfattribs={'layer': 'UKURAN'})
    d.set_text_format(dec=0); d.render()


def sheet_assembly(parts, path):
    doc = new_doc(); msp = doc.modelspace()
    views = {n: project(parts, n) for n in ('depan', 'atas', 'samping', 'iso')}
    (fx0, fy0, fx1, fy1) = views['depan'][2]
    (tx0, ty0, tx1, ty1) = views['atas'][2]
    (sx0, sy0, sx1, sy1) = views['samping'][2]
    (ix0, iy0, ix1, iy1) = views['iso'][2]
    L, Hf, Ht = fx1 - fx0, fy1 - fy0, ty1 - ty0
    gap = 110
    # tata letak proyeksi sudut pertama: depan kiri-atas, atas di bawahnya, samping di kanan depan
    ox, oy = 80 - fx0, 120 + Ht + gap - fy0
    tox, toy = 80 - tx0, 120 - ty0
    sox, soy = 80 + L + gap - sx0, oy
    W = 80 + L + gap + (sx1 - sx0) + gap + (ix1 - ix0) + 80
    H = max(120 + Ht + gap + Hf + 120, (iy1 - iy0) + 260)
    iox, ioy = W - 80 - ix1, H - 80 - iy1
    for n, (dx, dy) in (('depan', (ox, oy)), ('atas', (tox, toy)), ('samping', (sox, soy)), ('iso', (iox, ioy))):
        vis, hid, b, _ = views[n]
        put(msp, hid, 'TERSEMBUNYI', dx, dy)
        put(msp, vis, 'TAMPAK', dx, dy)
        label = {'depan': 'TAMPAK DEPAN', 'atas': 'TAMPAK ATAS', 'samping': 'TAMPAK SAMPING',
                 'iso': 'ISOMETRI'}[n]
        text(msp, label, (b[0] + b[2]) / 2 + dx, b[1] + dy - 72, 12, TextEntityAlignment.CENTER)
    # sumbu memanjang
    cy = oy + (fy0 + fy1) / 2
    msp.add_line((ox + fx0 - 25, cy), (ox + fx1 + 25, cy), dxfattribs={'layer': 'SUMBU'})
    # ukuran utama
    dim_h(msp, ox + fx0, ox + fx1, oy + fy1, oy + fy1 + 45)
    dim_v(msp, oy + fy0, oy + fy1, ox + fx0, ox + fx0 - 40)
    dim_v(msp, soy + sy0, soy + sy1, sox + sx1, sox + sx1 + 40)
    dim_h(msp, sox + sx0, sox + sx1, soy + sy0, soy + sy0 - 30)
    frame(msp, W, H, 'Gambar Rakitan', '1/2')
    doc.saveas(path)
    return (W, H), dict(L=L, H=Hf, W=sx1 - sx0)


def sheet_exploded(parts, path):
    doc = new_doc(); msp = doc.modelspace()
    order = [g for g, _ in GROUPS_GLB if any(p[1] == g for p in parts)] or \
        sorted({p[1] for p in parts}, key=lambda g: np.mean([m.bounds[:, 0].mean() for _, gg, m in parts if gg == g]))
    extra = [g for g in {p[1] for p in parts} if g not in order]
    order += extra
    # urutkan kelompok menurut posisi sepanjang sumbu X, lalu renggangkan
    cx = {g: np.mean([m.centroid[0] for _, gg, m in parts if gg == g]) for g in order}
    order.sort(key=lambda g: cx[g])
    # renggangkan kelompok berurutan di sepanjang sumbu X tanpa saling tumpang
    gap, x_cur, offset = 45.0, None, {}
    for g in order:
        gx0 = min(m.bounds[0, 0] for _, gg, m in parts if gg == g)
        gx1 = max(m.bounds[1, 0] for _, gg, m in parts if gg == g)
        shift = 0.0 if x_cur is None else (x_cur + gap - gx0)
        offset[g] = (shift, 0, 0)
        x_cur = gx1 + shift
    vis, hid, (x0, y0, x1, y1), groups = project(parts, 'iso', offset)
    W, H = (x1 - x0) + 300, (y1 - y0) + 460
    dx, dy = 150 - x0, 300 - y0
    put(msp, hid, 'TERSEMBUNYI', dx, dy)
    put(msp, vis, 'TAMPAK', dx, dy)
    # balon label per kelompok
    for i, g in enumerate(order):
        if g not in groups:
            continue
        c = groups[g].representative_point()
        bx0, by0, bx1, by1 = groups[g].bounds
        up = i % 2 == 0
        ty = (y1 + 90) if up else (y0 - 90)
        tx = c.x
        msp.add_line((c.x + dx, c.y + dy), (tx + dx, ty + dy - (14 if up else -14)),
                     dxfattribs={'layer': 'UKURAN'})
        msp.add_circle((tx + dx, ty + dy), 14, dxfattribs={'layer': 'TEKS'})
        text(msp, str(i + 1), tx + dx, ty + dy, 13, TextEntityAlignment.MIDDLE_CENTER)
        text(msp, g.upper(), tx + dx, ty + dy + (26 if up else -36), 11, TextEntityAlignment.CENTER)
        msp.add_circle((c.x + dx, c.y + dy), 2.5, dxfattribs={'layer': 'UKURAN'})
    frame(msp, W, H, 'Isometri Terurai', '2/2')
    doc.saveas(path)
    return order


def render_copy(dxf):
    """Salinan DXF khusus render: ukuran & blok dipecah, teks jadi garis.

    dxf2svg LibreCAD hanya menggambar entitas garis di modelspace, jadi DXF
    asli (yang tetap bisa diedit di LibreCAD) disalin lalu disederhanakan."""
    from ezdxf.addons import text2path
    from ezdxf import path as ezpath
    doc = ezdxf.readfile(dxf); msp = doc.modelspace()
    for _ in range(4):
        todo = [e for e in msp if e.dxftype() in ('DIMENSION', 'INSERT')]
        if not todo:
            break
        for e in todo:
            e.explode()
    for e in [e for e in msp if e.dxftype() == 'MTEXT']:   # teks ukuran
        t = msp.add_text(e.plain_text(), height=e.dxf.char_height,
                         dxfattribs={'layer': e.dxf.layer, 'rotation': e.get_rotation()})
        t.set_placement(e.dxf.insert, align=TextEntityAlignment.MIDDLE_CENTER)
        msp.delete_entity(e)
    for e in [e for e in msp if e.dxftype() == 'TEXT']:
        layer = e.dxf.layer
        for p in text2path.make_paths_from_entity(e):
            for sub in p.sub_paths():
                pts = [(v.x, v.y) for v in sub.flattening(0.05)]
                if len(pts) > 1:
                    msp.add_lwpolyline(pts, dxfattribs={'layer': layer})
        msp.delete_entity(e)
    for e in [e for e in msp if e.dxftype() == 'SOLID']:
        v = [e.dxf.vtx0, e.dxf.vtx1, e.dxf.vtx3, e.dxf.vtx2]
        msp.add_lwpolyline([(p.x, p.y) for p in v], close=True, dxfattribs={'layer': e.dxf.layer})
        msp.delete_entity(e)
    out = os.path.join(os.path.dirname(dxf), '_render-' + os.path.basename(dxf))
    doc.saveas(out)
    return out


def librecad_svg(dxf):
    src = render_copy(dxf)
    r = subprocess.run([LIBRECAD, 'dxf2svg', src], capture_output=True, text=True, timeout=180)
    tmp = os.path.splitext(src)[0] + '.svg'
    svg = os.path.splitext(dxf)[0] + '.svg'
    if os.path.exists(tmp):
        os.replace(tmp, svg)
    if not os.path.exists(svg):
        raise RuntimeError('LibreCAD gagal merender %s\n%s' % (dxf, r.stdout[-800:] + r.stderr[-800:]))
    return svg


def main():
    os.makedirs(OUT, exist_ok=True)
    parts = load_parts(sys.argv[1:])
    print('komponen:', len(parts), ' kelompok:', sorted({p[1] for p in parts}))
    a = os.path.join(OUT, 'asta-blueprint-rakitan.dxf')
    size, dims = sheet_assembly(parts, a)
    print('rakitan', a, 'ukuran utama (mm): P %.0f  T %.0f  L %.0f' % (dims['L'], dims['H'], dims['W']))
    e = os.path.join(OUT, 'asta-blueprint-urai.dxf')
    order = sheet_exploded(parts, e)
    print('urai', e, order)
    for f in (a, e):
        print('LibreCAD ->', librecad_svg(f))


if __name__ == '__main__':
    main()
