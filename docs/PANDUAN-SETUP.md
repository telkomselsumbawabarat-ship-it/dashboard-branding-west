# Panduan Setup — Dashboard Branding Cluster Sumbawa Barat

Isi paket:

| File | Fungsi |
|---|---|
| `vercel/index.html` | Halaman dashboard + form input (yang dibuka SF) |
| `vercel/config.js` | Tempat menempel URL Apps Script (satu-satunya yang perlu diubah) |
| `vercel/assets/` | Logo Telkomsel & Mitra Cipta Teknologi |
| `apps-script/Code.gs` | Backend: simpan data ke Google Sheet, foto ke Google Drive |
| `Outlet_Master.xlsx` | 987 outlet (Sumbawa 669 + Sumbawa Barat 318) untuk diisi ke tab Outlet |

Alurnya: **SF buka link Vercel → isi laporan → data masuk Google Sheet, foto masuk Google Drive → dashboard membaca dari Sheet.**

Waktu setup ±20 menit. Kerjakan berurutan.

> **Lebih mudah:** ikuti `docs/OTOMATISASI.md`. GitHub Actions akan membuat Sheet, mengisi outlet, mendeploy Apps Script, dan mengisi `config.js` otomatis. Panduan manual di bawah ini hanya cadangan.

---

## Bagian A — Google Sheet & Apps Script

1. Buka [sheets.new](https://sheets.new) dengan akun Google yang akan menyimpan data (mis. akun cluster). Beri nama **Dashboard Branding KSB**.
2. Menu **Extensions › Apps Script**. Hapus semua isi `Code.gs` bawaan, lalu tempel seluruh isi file `apps-script/Code.gs`.
3. Klik **+ › Script**, beri nama `Outlets`, lalu tempel isi `apps-script/Outlets.gs` (data 987 outlet). Kembali ke `Code.gs`, ganti `'__KODE_AKSES__'` pada baris `var KODE_AKSES` dengan kode untuk SF, misalnya `'ksb2026'`. Klik **Save**.
4. Di toolbar, pilih fungsi **setup** lalu klik **Run**.
   Google akan meminta izin: **Review permissions › pilih akun › Advanced › Go to … (unsafe) › Allow**. Ini normal untuk script buatan sendiri.
   Hasilnya: tab **Outlet**, **Laporan**, **Riwayat** terbentuk, dan folder **Dokumentasi Branding KSB** dibuat di Google Drive.
5. Tab **Outlet** otomatis terisi 987 outlet saat `setup` dijalankan. `Outlet_Master.xlsx` hanya cadangan bila ingin mengisi manual.
6. Klik **Deploy › New deployment** → ikon gerigi → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy**, lalu **salin URL Web app** (berakhiran `/exec`).

## Bagian B — Vercel

1. Buka `vercel/config.js`, tempel URL tadi:
   ```js
   window.APP_CONFIG = {
     API_URL: "https://script.google.com/macros/s/XXXX/exec"
   };
   ```
2. Deploy, pilih salah satu:

   **Cara 1 — lewat GitHub (tanpa install apa pun)**
   1. Buat repository baru di github.com (boleh Private).
   2. **Add file › Upload files**, unggah isi folder `vercel` (`index.html`, `config.js`, folder `assets`). Commit.
   3. Di vercel.com: **Add New › Project › Import** repository tadi. Framework Preset: **Other**. Klik **Deploy**.

   **Cara 2 — lewat terminal**
   ```bash
   cd vercel
   npx vercel --prod
   ```
3. Buka link Vercel, masukkan kode akses. Indikator di kanan atas harus **Tersinkron**.
4. Bagikan **link + kode akses** ke tim SF. Di HP, mereka bisa memilih **Tambahkan ke Layar Utama** supaya tampil seperti aplikasi.

---

## Cara pakai singkat

**Input Laporan (SF)**
1. Ketik ID Digipos → pilih outlet.
2. Centang matpro yang terpasang (Poster, Layar Toko, Sticker Etalase, Shop Sign, Neon Box, Backdrop Dinding).
3. Unggah foto untuk **setiap** matpro yang dicentang (wajib min. 1, maks. 3 per matpro).
4. Isi tanggal pemasangan dan nama pelapor → **Simpan laporan**.

**Status otomatis**
- **Sudah Branding**: minimal 1 matpro terpasang.
- **Cek Matpro**: 3 bulan setelah tanggal pasang atau tanggal cek terakhir.
- Hasil cek dicatat dari tombol **Detail** outlet › *Catat hasil cek matpro*. Jadwal cek berikutnya otomatis mundur 3 bulan.

**Dokumentasi foto di dashboard**
- Bagian *Daftar outlet* › tombol **Dokumentasi foto**: galeri per outlet, foto dikelompokkan per matpro. Klik foto untuk memperbesar, geser antar foto, atau buka di Google Drive.
- Filter TAP / SF / matpro / status tetap berlaku di galeri.

**Rekap**
- Tab **Laporan** di Google Sheet = rekap lengkap (kolom Keterangan: Branding / Cek Matpro / Belum branding, ikut berubah tiap hari).
- Tombol **Unduh Excel** di dashboard mengunduh rekap sesuai filter yang aktif.
- Tab **Riwayat** mencatat setiap simpan & cek (waktu, versi kode, pelapor).

---

## Bila mengubah kode Apps Script

Setiap perubahan `Code.gs` **wajib** dideploy ulang sebagai versi baru:
**Deploy › Manage deployments › ikon pensil › Version: New version › Deploy.**
URL tetap sama, `config.js` tidak perlu diubah.
Jika lupa, dashboard menampilkan peringatan **"Kode Apps Script lama"**.

## Mengubah daftar outlet

Edit langsung tab **Outlet** di Google Sheet (tambah/hapus baris). Dashboard membaca ulang setiap dibuka atau saat tombol ↻ ditekan. Jangan ubah judul kolom.

## Mengganti kode akses

Bila memakai otomatisasi: ubah secret `ACCESS_CODE` di GitHub lalu jalankan workflow *Deploy Apps Script*. Bila manual: ubah `KODE_AKSES` di `Code.gs` → Save → deploy **New version**. SF akan diminta kode baru saat membuka dashboard.

---

## Batasan yang perlu diketahui

- **Kapasitas foto**: foto disimpan di Google Drive akun pemilik Sheet (gratis 15 GB, dipakai bersama Gmail). Satu foto ±150–300 KB setelah diperkecil, jadi 15 GB cukup untuk puluhan ribu foto.
- **Foto harus bisa dibuka lewat link**: script mengatur setiap foto ke *Anyone with the link – Viewer* agar tampil di dashboard. Akun Google Workspace kantor kadang melarang ini; gunakan akun Gmail biasa bila foto tidak tampil.
- **Kode akses** hanya penghalang sederhana, bukan login per orang. Jangan sebar link + kode di grup publik.
- **Vercel**: paket gratis (Hobby) ditujukan untuk pemakaian pribadi/non-komersial. Untuk pemakaian resmi perusahaan, cek ketentuan terbaru di vercel.com/pricing.
- **Kecepatan**: Apps Script butuh 1–3 detik per permintaan. Unggah foto dilakukan satu per satu, jadi laporan dengan banyak foto butuh beberapa detik. Bila sinyal putus di tengah, ulangi Simpan; foto yang sudah terunggah tidak diunggah ulang.

## Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| "Belum tersambung" | `API_URL` di `config.js` masih kosong / belum deploy ulang Vercel |
| "Gagal memuat" | Web app belum di-set **Who has access: Anyone**, atau URL bukan yang `/exec` |
| "Kode Apps Script lama" | Deploy ulang Apps Script sebagai **New version** |
| Kode akses selalu salah | `KODE_AKSES` diubah tapi belum deploy New version |
| Foto tidak tampil | Kebijakan berbagi Drive membatasi link publik (lihat Batasan) |
| "ID … tidak ada di tab Outlet" | Outlet belum ada di tab Outlet, atau kolom ID terformat angka — set Plain text lalu tempel ulang |
