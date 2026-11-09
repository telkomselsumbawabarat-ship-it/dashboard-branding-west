# Dashboard Branding Cluster Sumbawa Barat

Dashboard rekap branding outlet + form pelaporan pemasangan matpro (Telkomsel × Mitra Cipta Teknologi).

- `index.html`, `config.js`, `assets/`: halaman statis yang dideploy Vercel (Framework Preset: **Other**, tanpa build).
- `config.js`: isi `API_URL` dengan URL Web App Apps Script (berakhiran `/exec`).
- `apps-script/Code.gs`: backend Google Apps Script (Sheet + Drive). Tidak ikut dideploy ke Vercel.
- `docs/PANDUAN-SETUP.md`: langkah setup lengkap. `docs/Outlet_Master.xlsx`: 987 outlet untuk tab Outlet.

Setiap push ke `main` otomatis dideploy ulang oleh Vercel. Perubahan di `apps-script/` otomatis dideploy ke Google Apps Script oleh GitHub Actions; setup sekali ada di **`docs/OTOMATISASI.md`**.
