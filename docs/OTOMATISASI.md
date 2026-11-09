# Otomatisasi Deploy — sekali setup, selanjutnya otomatis

Setelah langkah di bawah selesai:
- **Tampilan dashboard** (`index.html`, `config.js`, `assets/`) → setiap push ke `main` otomatis tayang di Vercel.
- **Backend Google** (`apps-script/`) → setiap push otomatis dideploy ke Apps Script sebagai versi baru, URL tetap.
- **Google Sheet, tab Outlet (987 outlet), folder foto Drive, dan URL di `config.js`** dibuat dan diisi otomatis pada run pertama.

Total waktu ±15 menit, cukup sekali.

---

## 1. Rapikan Vercel (1 menit)
Repo ini sekarang terhubung ke **3 project Vercel** (`dashboard-branding-west`, `dashboard-branding-west-e48c`, `dashboard-branding-west-glvx`), jadi setiap update dideploy 3 kali.
Simpan satu saja (`dashboard-branding-west`). Untuk dua lainnya: buka project › **Settings** › gulir ke bawah › **Delete Project**.

## 2. Aktifkan Apps Script API (30 detik)
Buka https://script.google.com/home/usersettings dengan akun Google yang akan menyimpan data → **Google Apps Script API: On**.

## 3. Buat kunci akses Google untuk GitHub (5 menit, lewat browser)
1. Di halaman repo GitHub: **Code › Codespaces › Create codespace on main**. Tunggu sampai terminal muncul di bawah.
2. Ketik di terminal lalu Enter (**tanpa** `--no-localhost`; opsi itu sudah diblokir Google dan memunculkan *"Access blocked: … request is invalid"*):
   ```
   npx -y @google/clasp@2.4.2 login
   ```
   Terminal menampilkan link dan **menunggu**. Biarkan terminal ini tetap berjalan.
3. Buka link itu, pilih akun Google yang sama dengan langkah 2, lalu klik **Allow**.
4. Browser berakhir di halaman error *"localhost refused to connect"*. Itu normal. **Salin seluruh alamat di address bar** (diawali `http://localhost:` dan berisi `code=`).
   Buka **terminal kedua** (ikon **+** di panel terminal), ketik `curl "` lalu tempel alamat tadi, tutup dengan `"`, Enter. Contoh:
   ```
   curl "http://localhost:37XXX/?code=4/0Ab...&scope=..."
   ```
   Terminal pertama akan menulis **Authorization successful**.
5. Ketik `cat ~/.clasprc.json`, lalu **salin seluruh teks** yang muncul (diawali `{` dan diakhiri `}`).
6. Hapus codespace: **Code › Codespaces › … › Delete**.

## 4. Simpan 2 secret di GitHub (2 menit)
Repo › **Settings › Secrets and variables › Actions › New repository secret**:

| Name | Secret |
|---|---|
| `CLASPRC_JSON` | teks dari langkah 3.5 |
| `ACCESS_CODE` | kode akses untuk SF, mis. `ksb2026` |

Secret tidak terlihat oleh siapa pun, walaupun repo public.

## 5. Jalankan deploy pertama (3 menit)
Repo › **Actions › Deploy Apps Script › Run workflow › Run workflow**.
Tunggu sampai centang hijau. Workflow akan:
1. membuat Google Sheet **Dashboard Branding KSB** dan Apps Script-nya,
2. mengirim kode dan mendeploy Web App,
3. menulis URL Web App ke `config.js`, sehingga Vercel deploy ulang otomatis.

## 6. Beri izin sekali (1 menit)
Buka run yang hijau tadi › bagian **Summary** › klik link **Editor Apps Script**.
Pilih fungsi **setup** › **Run** › **Review permissions** › pilih akun › **Advanced › Go to … (unsafe) › Allow**.
Ini membuat tab Outlet (terisi 987 outlet), Laporan, Riwayat, dan folder foto di Drive.

## 7. Selesai
Buka dashboard Vercel, masukkan kode akses. Indikator kanan atas: **Tersinkron**.
Link Google Sheet ada di Summary workflow, dan ID-nya tersimpan di `.github/apps-script-deploy.json`.

---

## Bila ada masalah

| Gejala | Solusi |
|---|---|
| Workflow merah: *CLASPRC_JSON belum diisi* / *bukan JSON* | Ulangi langkah 3–4. Pastikan yang disalin seluruh isi file, dari `{` sampai `}` |
| Workflow merah saat *Buat Google Sheet* | Apps Script API belum ON (langkah 2), atau tunggu 5 menit setelah menyalakannya lalu Run ulang |
| Workflow merah: *invalid_grant* | Kunci kedaluwarsa atau dicabut. Ulangi langkah 3–4 |
| Dashboard: *Gagal memuat* setelah deploy | Langkah 6 belum dikerjakan |
| Ingin ganti kode akses | Ubah secret `ACCESS_CODE`, lalu Actions › Deploy Apps Script › Run workflow |

Setup manual tanpa otomatisasi tetap bisa dilakukan lewat `docs/PANDUAN-SETUP.md`.
