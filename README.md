# ASTA — Adaptive Sensory-feedback Telerehabilitation Arm

Purwarupa penelitian lengan bionik transradial modular non-invasif, beserta
platform telerehabilitasinya. Fokusnya pada dua hal yang paling sering luput
dalam rehabilitasi penyandang amputasi ekstremitas atas: **nyeri phantom** dan
**kepatuhan terapi jangka panjang**.

**Demo langsung:** <https://asta-id.web.app>

> ASTA adalah purwarupa penelitian, **bukan alat diagnostik**, dan tidak
> menggantikan penilaian klinis. Aplikasi pada tautan di atas berjalan penuh di
> peramban dengan data demo dan simulator perangkat — tidak ada data pasien
> sungguhan, dan tidak ada data yang dikirim ke server mana pun.

---

## Isi singkat

| Bagian | Keterangan |
|---|---|
| Landing page | Halaman publik bergaya situs perusahaan, dengan penampil 3D langsung di hero |
| Aplikasi | 19 halaman untuk 4 peran: pasien, fisioterapis, prostetis, admin klinik |
| Model 3D | Lengan bionik dibangun prosedural di Blender, ditampilkan di web lewat three.js |
| Sistem visual | Motif hiasan dan ilustrasi SVG yang seluruhnya dibangkitkan dari kode |

Tidak ada framework dan tidak ada langkah build: seluruh aplikasi berupa HTML,
CSS, dan JavaScript biasa (ES5-style, IIFE, tanpa modul bundler). Satu-satunya
pustaka pihak ketiga adalah three.js, yang di-*vendor* lokal di
`js/vendor/three/` dan dimuat *lazy* hanya pada halaman yang menampilkan model.

---

## Menjalankan secara lokal

Aplikasi memerlukan protokol `http` — WebGL dan modul ES tidak berjalan lewat
`file://`. Server statis apa pun cukup:

```bash
# Python
python -m http.server 8080

# atau Node
npx serve .
```

Lalu buka <http://localhost:8080>.

Akun demo tersedia di halaman masuk; kata sandinya apa saja (tidak diverifikasi
pada purwarupa frontend). Tombol **Setel ulang data demo** mengembalikan seluruh
data ke keadaan awal.

---

## Struktur

```
├── index.html              Landing page publik
├── masuk.html              Halaman masuk
├── *.html                  19 halaman aplikasi
│
├── css/
│   ├── tokens.css          Token desain (warna, bayangan neumorphic, radius)
│   ├── base.css            Reset dan utilitas
│   ├── components.css      Kartu, tombol, tabel, keadaan kosong
│   ├── layout.css          Shell aplikasi: sidebar, topbar, konten
│   ├── features.css        Gaya khusus fitur
│   ├── mobile.css          Penyesuaian ponsel dan tablet
│   ├── decor.css           Lapisan hiasan SVG dan blok penjelas
│   ├── arm3d.css           Panggung penampil 3D
│   └── landing.css         Landing page
│
├── js/
│   ├── lib/                Utilitas mandiri
│   │   ├── utils.js        Bantuan DOM, tanggal, angka
│   │   ├── icons.js        Ikon UI berukuran kecil
│   │   ├── decor.js        11 motif hiasan SVG prosedural
│   │   ├── illustrations.js  Ilustrasi naratif + 9 adegan keadaan kosong
│   │   ├── store.js        Persistensi localStorage
│   │   ├── ui.js           Toast, modal, kartu statistik, keadaan kosong
│   │   └── chart.js        Grafik garis/batang tanpa dependensi
│   │
│   ├── core/               Logika domain
│   │   ├── auth.js         Peran, sesi, penjagaan halaman
│   │   ├── seed.js         Pembangkit data penelitian demo
│   │   ├── device.js       Simulator lengan: 4 kanal EMG, 8 pola cengkeram
│   │   ├── analytics.js    Kepatuhan, tren nyeri, ringkasan pasien
│   │   ├── study.js        Instrumen penelitian, fase A-B-A, kejadian
│   │   ├── notify.js       Pengingat berjenjang
│   │   └── shell.js        Sidebar, topbar, navigasi per peran
│   │
│   ├── components/         Komponen visual
│   │   ├── arm-3d.js       Penampil 3D + ArmStage (pengganti ArmView)
│   │   ├── arm-view.js     Lengan SVG 2D (cadangan)
│   │   ├── emg-scope.js    Osiloskop sinyal EMG
│   │   ├── mirror.js       Terapi cermin berbasis kamera
│   │   └── ...
│   │
│   ├── pages/              Satu modul per halaman
│   └── vendor/three/       three.js 0.160.0 (di-vendor, bare import dipatch)
│
├── assets/
│   ├── 3d/                 asta-arm.blend, asta-arm.glb
│   └── render/             Render Blender; turunan siap-web di render/web/
│
└── tools/
    ├── blender/            Skrip pembangun model dan perender
    ├── optimize_renders.py Render mentah -> turunan siap-web
    ├── verify-3d.js        Uji penampil 3D dengan peramban sungguhan
    └── ...                 Perkakas video dan tangkapan layar
```

---

## Model 3D

Geometri lengan **tidak dipahat manual** — seluruhnya dibangkitkan skrip Python
di Blender. Satu angka diubah, model tercetak ulang konsisten; hal yang penting
untuk alat yang harus pas dengan tubuh berbeda-beda.

```bash
BLENDER="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"

# Bangun model -> assets/3d/asta-arm.{blend,glb}
"$BLENDER" --background --python tools/blender/asta_arm.py

# Render studio -> assets/render/**
"$BLENDER" --background --python tools/blender/render_asta.py -- --preset all --samples 96

# Turunkan untuk web (15 MB -> ~1 MB)
python tools/optimize_renders.py
```

Rinciannya — konvensi sumbu, hierarki sendi, dan cara nilai pencahayaan
dikalibrasi — ada di [`tools/blender/README.md`](tools/blender/README.md).

Di sisi web, `js/components/arm-3d.js` memuat `.glb` tersebut dan
menggerakkannya langsung dari sinyal EMG: pose jari terinterpolasi halus,
elektroda menyala mengikuti kekuatan kanal, dan cincin denyut muncul saat umpan
balik haptik aktif. Tersedia tiga tingkat penurunan mutu otomatis:

1. **WebGL** — model 3D penuh, dapat diputar dengan seret
2. **Sprite** — 36 bingkai render turntable, tetap dapat diputar (tanpa WebGL)
3. **SVG** — lengan 2D `arm-view.js`

Kontrak antara Blender dan web adalah **nama node**: `arm-3d.js` mencari
`JNT_<jari>_<ruas>` dan `EL_<kanal>`. Mengganti nama di skrip Blender berarti
harus mengganti polanya di `arm-3d.js` juga.

---

## Sistem visual

Seluruh gambar dekoratif dibangkitkan dari kode, bukan aset yang diimpor —
ukuran unduhannya nol dan warnanya ikut token tema lewat `currentColor`.

- **`js/lib/decor.js`** — 11 motif latar: `pulse` (jejak EMG), `neuro` (peta
  simpul saraf), `circuit`, `orbit`, `wave`, `bars`, `grid`, `digits`, `shield`,
  `timeline`, `mesh`. Bentuknya **deterministik**: benih yang sama selalu
  menghasilkan gambar identik, jadi tampilan halaman tidak berubah tiap dimuat.
  Motif dipetakan ke halaman menurut maknanya, lalu dipasang otomatis oleh
  `Shell.mount`.

- **`js/lib/illustrations.js`** — ilustrasi naratif (skema lengan, jalur sinyal,
  lingkar telerehabilitasi, terapi cermin), generator avatar parametrik, 8 ikon
  fitur, dan 9 adegan keadaan kosong yang dipakai `UI.empty`.

Semua hiasan `aria-hidden`, tidak menerima pointer, dan otomatis dilepas pada
`prefers-contrast: more` maupun saat dicetak.

---

## Video showreel

Dua showreel 1920x1080 (16:9, 30 fps, ±92 detik) menelusuri 15 halaman penting
sambil menggulirkannya:

| Berkas | Isi |
|---|---|
| `ASTA-showreel-desktop-1080p.mp4` | Aplikasi dalam mockup jendela peramban |
| `ASTA-showreel-android-1080p.mp4` | Aplikasi dalam mockup ponsel, panel judul di sisi kiri |

Keduanya dirakit dari sumber yang sama; hanya lebar iframe-nya yang berbeda,
sehingga tata letak ponsel dan desktop tampil apa adanya.

```bash
node tools/showreel/record.js --variant desktop   # frame -> video-showreel/
node tools/showreel/build.js  --variant desktop   # frame -> MP4
node tools/showreel/capcut.js --variant desktop   # MP4 -> proyek CapCut
node tools/showreel/verify.js                     # periksa kedua video
```

Ganti `desktop` dengan `android` untuk varian satunya. Tambahkan
`--only 03,07` pada `record.js` untuk merekam sebagian adegan saja saat
memeriksa perubahan.

Daftar halaman, durasi, dan perilaku gulirnya ada di
[`tools/showreel/scenes.js`](tools/showreel/scenes.js).

**Cara kerjanya.** `tools/showreel/stage.html` adalah panggung 1920x1080 yang
memuat aplikasi di dalam `<iframe>` pada ukuran aslinya, lengkap dengan mockup
perangkat, lockup merek, judul adegan, dan bilah progres. Satu tangkapan layar
panggung itu sudah menjadi satu frame video yang final — tidak ada tahap
compositing terpisah, dan teksnya tetap tajam 1:1 tanpa penskalaan.

Posisi gulir dihitung per frame lalu disetel langsung, bukan lewat animasi CSS.
Dengan begitu gerakannya terikat pada laju frame video dan bebas jitter.

Frame mentah (~1,2 GB per varian) dan klip per adegan tidak masuk repositori;
keduanya dapat dibuat ulang dengan perintah di atas. Proyek CapCut
(`capcut-showreel-*/`) menyimpan salinan klipnya sendiri, jadi dapat langsung
dibuka untuk menambah musik atau menyunting lanjut.

---

## Pengujian

```bash
node tools/verify-3d.js     # penampil 3D di peramban sungguhan
```

Skrip ini menyalakan server statis lokal, membuka tiap halaman ber-3D dengan
Chromium, lalu memastikan: tidak ada galat JavaScript, tidak ada berkas 404,
penampil mencapai keadaan siap, dan **ruas jari benar-benar berputar** saat pose
diubah (14 ruas ditemukan, selisih fleksi terukur dalam radian).

Memerlukan `playwright`. Bila peramban bawaannya belum terunduh, skrip memakai
Chromium yang sudah ada di `%LOCALAPPDATA%\ms-playwright`.

---

## Deployment

Firebase Hosting, proyek `asta-id`:

```bash
firebase deploy --only hosting --project asta-id
```

`firebase.json` mengecualikan perkakas dan media mentah dari unggahan, serta
menetapkan header cache: HTML selalu divalidasi ulang, sedangkan model 3D dan
render dianggap tetap (`immutable`, 7 hari).

---

## Status

Purwarupa penelitian yang masih berjalan. Bagian **Tim** pada landing page
sengaja masih berupa penanda — nama dan potret asli belum dimasukkan.

Belum ada berkas lisensi, sehingga hak cipta sepenuhnya tetap pada penulis.
