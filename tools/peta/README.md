# Peta internal halte.id

Peta interaktif khusus tim, untuk memvalidasi jawaban rute di X/Threads. **Tidak ikut build/deploy**
(Astro hanya membangun `src/pages/` dan `public/` di root), jadi data mentah tidak terbuka ke publik.

## Menjalankan

```
npm run peta
```

lalu buka http://localhost:4400 (port bisa diganti dengan `PETA_PORT` di `.env`).

Pengaturan dibaca dari `.env` di root halte-id-site, sama dengan situs:

```
PUBLIC_MAPBOX_TOKEN=pk....        # token Mapbox (sebaiknya token khusus lokal, dibatasi ke localhost)
DATA_DIR=../halte-id-data         # folder data; tanpa ini dibaca dari ./data
```

Data dibaca sekali saat server dinyalakan. Setelah data berubah (git pull di halte-id-data), matikan
server (Ctrl+C) lalu jalankan ulang.

## Isi (tahap 1)

- Semua rute (filter per jenis), halte, stasiun, dan rel.
- Klik **halte**: rute yang berhenti, stasiun ≤ 400 m, halte lain ≤ 300 m beserta rutenya.
- Klik **stasiun**: lin, halte ≤ 500 m beserta rutenya.
- Klik **garis rute** (atau badge rute): lintasan disorot, halte rute ditandai, urutan halte per arah.
- Kotak cari: nomor rute, nama halte, nama stasiun.

## Isi (tahap 2): cek rute A → B

- Asal/tujuan bisa halte, stasiun, atau tempat (ketik di kotak "Cek rute A → B", atau tombol
  "Jadikan asal/tujuan" di panel halte/stasiun).
- Mencari pilihan **langsung**, **1× transit**, dan **2× transit** (mis. Mikrotrans → Transjakarta → Mikrotrans), bus + kereta.
  Pilihan 2× transit hanya muncul bila tidak ada pilihan yang lebih sederhana dengan waktu kira-kira sama.
  KA Bandara dan Whoosh hanya dipakai bila asal/tujuan adalah stasiunnya (tiket & tarif berbeda). Jalan kaki maksimal 600 m dari/ke
  halte, 800 m dari/ke stasiun, 300 m saat pindah. Urutan memakai perkiraan kasar (jarak tempuh,
  jumlah halte, jalan kaki, penalti transit), bukan jadwal atau kondisi lalu lintas.
- **Salin jawaban**: teks siap tempel untuk balasan X/Threads, lengkap dengan tautan halte.id.
- **Bandingkan di Google Maps** untuk perjalanan yang butuh lebih dari sekali transit.
- Selalu cek gangguan di akun resmi operator sebelum menjawab.

## Isi (tahap 3): mode gangguan

- Di panel halte/stasiun, klik **Tandai gangguan**. Titik ditandai merah di peta dan muncul di kotak "Gangguan aktif".
- **Lihat rute terdampak**: per titik, layanan yang lewat titik itu dan alternatif (layanan lain ≤ 300 m yang
  tidak lewat titik gangguan mana pun).
- Cek rute A → B otomatis menghindari titik gangguan. Opsi "Rute terputus di titik gangguan" (bawaan: aktif)
  menganggap layanan tidak bisa melewati titik itu; matikan bila bus hanya tidak berhenti tapi tetap lewat.
- Daftar gangguan disimpan di browser ini saja (localStorage). Klik "Hapus semua" setelah gangguan selesai.

Logika kode lin, warna, dan label rute diambil langsung dari `src/lib/`, jadi selalu sama dengan situs.
