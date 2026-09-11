# Perakit video semifinal HRIE 2026

Merakit video penjelasan ASTA (1920×1080, 16:9, di bawah 5 menit) dari rekaman tim,
voice over, footage lengan bionik, motion graphic, dan potongan aplikasi. Susunannya
mengikuti **17 scene naskah secara berurutan**.

Materi mentah ada di `ASTA REKAMAN FIX MP4/` dan tidak masuk repositori. Hasil
antara ditulis ke `ASTA REKAMAN FIX MP4/_build/`, sedangkan video akhirnya ke
`ASTA - Video Semifinal HRIE 2026.mp4` di akar proyek.

## Urutan perintah

```bash
python tools/asta-video/analyze.py        # stempel waktu per kata (sekali saja)
node   tools/asta-video/render-cards.js   # kartu & overlay transparan
python tools/asta-video/build.py --clean  # segmen, transisi, musik latar
python tools/asta-video/verify.py         # pemeriksaan otomatis
python tools/asta-video/monitor.py        # panel pemantau: http://localhost:8240
```

`build.py` tanpa `--clean` hanya membangun segmen yang belum ada. Pakai `--clean`
setiap kali batas potong suara berubah. `build.py --preview` merender satu frame per
adegan motion graphic ke `_build/mg/_preview-*.jpg` untuk memeriksa tata letak.
`verify.py --quick` hanya menjalankan pemeriksaan suara, selesai dalam hitungan detik.

## Berkas

| Berkas | Isi |
|---|---|
| `analyze.py` | Transkripsi Whisper medium per kata → `_build/words.json` |
| `build.py` | Susunan 17 scene (`segments()`), pemotongan suara presisi, transisi, musik latar |
| `mg.html` + `render-mg.js` | 15 adegan motion graphic, dirender frame demi frame dan sinkron dengan kata |
| `cards.html` + `render-cards.js` | Kartu judul/penutup, lower-third, overlay empat fokus, caption cara kerja |
| `verify.py` | Senyap di luar ucapan, potongan aba-aba di awal, kata di ujung segmen, lembar wajah |
| `monitor.py` | Panel peramban untuk progres build dan verifikasi |
| `logo.png` | Logo dari animasi opening tim, latar dibuat transparan |

## Pemotongan suara

Rekaman kamera membawa aba-aba perekam ("…ga" dari "tiga", slate "Scene 13A"), dan
stempel waktu transkripsi hanya tepat ±0,1 detik. Karena itu setiap titik potong
diturunkan dari **kata dan energi suara**, bukan ditulis tangan:

1. **Kata pembuka dan penutup** kalimat diambil dari `words.json`. Aba-aba di tepi
   diabaikan.
2. **Potongan aba-aba yang menempel di awal klip** dicari dari energi: potongan
   pendek (≤ 0,45 s), lalu hening (≥ 0,18 s), sementara transkripsi merentangkan kata
   pertama melewati jeda itu. Potongan seperti ini dibuang.
3. **Awal dan akhir kata yang lembut** (vokal, desis) diperluas mengikuti energi
   ucapan yang bersambung, tanpa melewati kata tetangga. Contoh: "ASTA" di Scene 15
   mulai 0,33 s lebih awal dari stempel transkripsinya.
4. **Sambungan L-cut** (satu kalimat dibelah ke dua gambar) memakai satu titik belah
   bersama, jadi tidak ada suara yang hilang maupun terulang.
5. **Semua audio di luar batas itu dibungkam.** Aba-aba yang tidak tertranskripsi pun
   ikut terbuang.
6. **Klip satu kata** (Scene 3–5) memakai batas dari energi saja, karena
   transkripsinya tidak bisa diandalkan.

## Transisi

Transisi dipasang di setiap pergantian scene naskah (16 transisi). Segmen di dalam
satu scene disambung langsung. Tiap scene diberi bantalan 0,25 s gambar diam dan
hening di tepinya, sehingga efek video dan crossfade audio hanya menumpuk bantalan
itu. Hasilnya, narasi tidak ikut memudar dan durasi total tidak bertambah.

## Pemeriksaan (`verify.py`)

- **Senyap di luar ucapan.** Puncak audio sebelum kata pertama dan sesudah kata
  terakhir harus di bawah −50 dBFS. Audio didekode utuh dari awal, karena lompatan
  posisi (`-ss`) pada AAC bisa mundur ke paket sebelumnya dan menghasilkan positif
  palsu.
- **Potongan pendek di awal segmen.** Dideteksi dari energi, lalu didengarkan ulang
  bersama 0,9 s ucapan sesudahnya. Potongan lolos hanya jika kalimatnya terdengar
  dibuka kata yang benar.
- **Kata di ujung segmen.** Tidak boleh berupa aba-aba.
- **Wajah setiap siswa.** Dikumpulkan di `_build/wajah.jpg`.
- **Durasi.** Maksimal 5 menit.
