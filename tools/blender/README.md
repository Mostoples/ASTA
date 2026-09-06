# ASTA — Pipeline 3D

Model lengan bionik ASTA dibuat **prosedural** di Blender: tidak ada mesh yang
dipahat manual, seluruh geometri dihasilkan skrip Python. Konsekuensinya, ukuran
mana pun bisa diubah dengan mengedit satu angka lalu membangun ulang, dan hasilnya
selalu identik.

## Berkas

| Berkas | Isi |
|---|---|
| `asta_arm.py` | Membangun model, material, dan hierarki sendi. Menyimpan `.blend` + ekspor `.glb` |
| `render_asta.py` | Menyiapkan studio (latar kertas putih, cahaya tiga titik) dan merender |
| `../optimize_renders.py` | Mengubah render mentah menjadi turunan siap-web (15 MB → ~1 MB) |
| `../verify-3d.js` | Uji otomatis: penampil termuat, tidak ada galat, jari benar-benar menekuk |

## Menjalankan ulang

```bash
BLENDER="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"

# 1. Bangun model  ->  assets/3d/asta-arm.{blend,glb}
"$BLENDER" --background --python tools/blender/asta_arm.py

# 2. Render         ->  assets/render/**
"$BLENDER" --background --python tools/blender/render_asta.py -- --preset all --samples 96

# 3. Optimalkan     ->  assets/render/web/**
python tools/optimize_renders.py

# 4. Verifikasi web
node tools/verify-3d.js
```

Preset render: `hero` (4 bidikan produk), `poster` (16:9 untuk halaman masuk),
`poses` (5 pose genggaman, latar tembus), `turntable` (36 bingkai putar), `all`.

## Konvensi ruang

Di Blender model dibangun **Z-atas**:

```
+Y = arah ujung jari (distal)      +Z = punggung tangan
-Y = arah socket (proksimal)       +X = sisi kelingking
```

Ekspor glTF memakai `export_yup=True`, sehingga di web sumbunya berputar
(Blender Z → glTF Y). Karena itu `js/components/arm-3d.js` **tidak pernah**
menuliskan posisi kamera sebagai koordinat mutlak — hanya arah pandang, dan
jaraknya dihitung dari kotak pembatas model.

## Hierarki sendi

Setiap ruas jari adalah objek tersendiri dengan origin tepat di sendi, di-parent
berantai. Menekuk jari = memutar objek pada sumbu **X lokal** saja.

```
ASTA_Arm
├── JNT_Socket   → ASTA_SocketCup
├── JNT_Elbow    → ASTA_ElbowShell, ASTA_ElbowPlate_L/R
├── JNT_Forearm  → ASTA_ForearmShell, EL_ch1..ch4, ASTA_StatusLED
└── JNT_Wrist    → ASTA_WristRing
    └── JNT_Palm → ASTA_Palm
        ├── JNT_index_0 → JNT_index_1 → JNT_index_2
        ├── JNT_middle_0 …  JNT_ring_0 …  JNT_pinky_0 …
        └── JNT_thumb_root → JNT_thumb_0 → JNT_thumb_1
```

Nama-nama ini adalah kontrak antara Blender dan web: `arm-3d.js` mencari node
lewat pola `JNT_<jari>_<ruas>` dan `EL_<kanal>`. Mengganti nama di skrip Blender
berarti harus mengganti pola di `arm-3d.js` juga.

## Pencahayaan

Nilai daya lampu di `render_asta.py` bukan hasil coba-coba yang ditinggalkan
begitu saja — nilainya dipilih lewat kalibrasi terukur: merender pada beberapa
tingkat cahaya lalu mengukur histogram luminans. Target: **0 % piksel ter-clip**
pada cangkang putih (agar tidak lebur dengan latar kertas), namun bagian grafit
tetap pekat. `Standard` dipakai sebagai view transform karena AgX terlalu
mencuci warna gelap di atas latar putih.

Bila daya lampu diubah, jalankan ulang kalibrasi sebelum menerima hasilnya.
