# halte.id — situs statis

Generator situs statis (Astro) untuk halte.id: 1 halaman per rute, 1 halaman
per halte, landing page, dibangun dari data JSON yang dibuat lewat Transit
Data Manager.

## Struktur

```
src/
  lib/data.js        <- baca JSON, slug, sortir (logic sama persis dengan admin tool)
  layouts/            <- layout HTML dasar + SEO meta
  pages/
    index.astro        <- landing page
    rute/index.astro    <- daftar semua rute
    rute/[slug].astro   <- halaman tiap rute (generated)
    halte/index.astro   <- daftar semua halte
    halte/[slug].astro  <- halaman tiap halte (generated)
    tentang.astro, kebijakan-privasi.astro
data-sample/           <- data PALSU kecil, untuk `npm run dev` lokal & smoke-test CI. Aman di-commit.
```

Data asli (stops.json, routes/, dll — hasil export dari Transit Data Manager)
**tidak pernah** disimpan di repo ini. Repo ini cuma baca dari folder yang
ditunjuk env var `DATA_DIR` (default: `data-sample`).

## Dua repo terpisah

1. **Repo data** (private) — isinya cuma file JSON hasil export admin tool
   Anda (stops.json, routes-index.json, routes/*.json, stop-services.json,
   routes/*-jalur.json). Repo ini tidak perlu kode apa pun.
2. **Repo situs** (repo ini) — kode Astro + workflow deploy.

## Setup sekali di awal

1. Buat repo data private di GitHub, isi dengan file-file export dari Transit
   Data Manager (stops.json, routes-index.json, folder routes/, dll — struktur
   sama persis dengan yang dibaca `src/lib/data.js`).
2. Di repo **situs** ini, buat Fine-grained Personal Access Token yang HANYA
   bisa baca repo data itu (Settings → Developer settings → Fine-grained
   tokens, scope: Contents: Read-only, repository access: pilih repo data
   saja) → simpan sebagai secret `DATA_REPO_PAT` di repo situs.
3. Di repo **data**, salin `ci-templates/data-repo-trigger.yml` ke
   `.github/workflows/trigger-site-build.yml`, ganti `YOUR_GITHUB_USERNAME`.
   Buat PAT lain (scope: Actions: write, repository access: repo situs saja)
   → simpan sebagai secret `SITE_REPO_PAT` **di repo data**.
4. Di Cloudflare dashboard → buat Pages project kosong bernama `halte-id`
   (connect-nya tidak usah lewat Cloudflare's auto-git-integration, karena
   kita deploy manual lewat Action supaya bisa inject data dari repo privat
   dulu). Ambil `CLOUDFLARE_API_TOKEN` (scope: Cloudflare Pages Edit) dan
   `CLOUDFLARE_ACCOUNT_ID` → simpan sebagai secret di repo situs.
5. (Opsional) Kalau mau peta statis per rute muncul, simpan Mapbox public
   token sebagai secret `PUBLIC_MAPBOX_TOKEN` di repo situs.
6. Edit `.github/workflows/deploy.yml` di repo situs: ganti
   `YOUR_GITHUB_USERNAME/halte-id-data` dengan nama repo data Anda yang
   sebenarnya.
7. Edit `astro.config.mjs` dan `public/robots.txt`: ganti `halte.id` kalau
   domain Anda beda.

## Alur setelah setup

Edit data lewat Transit Data Manager → export → commit & push ke repo data →
workflow di repo data otomatis memberi tahu repo situs → repo situs rebuild
SEMUA halaman (full rebuild, bukan partial — di skala ratusan rute/ribuan
halte ini tetap cepat, hitungan detik–menit) → deploy ke Cloudflare Pages.

## Development lokal

```bash
npm install
npm run dev
```

Pakai `data-sample/` secara default (9 halte, 2 rute contoh). Untuk coba
dengan data asli secara lokal, clone repo data di sebelah folder ini lalu:

```bash
DATA_DIR=../halte-id-data npm run dev
```

## Yang masih perlu Anda lengkapi sebelum live

- Isi `src/pages/tentang.astro` dan `kebijakan-privasi.astro` (placeholder
  saat ini, kebijakan privasi WAJIB lengkap sebelum submit AdSense).
- Ganti semua `YOUR_GITHUB_USERNAME` / `halte.id` di file konfigurasi.
- Pertimbangkan tambah Google Analytics / Search Console verification tag di
  `BaseLayout.astro` kalau mau.
