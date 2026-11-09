/**
 * Dashboard Branding Cluster Sumbawa Barat — backend Google Apps Script
 * Data   : Google Sheet (tab Outlet, Laporan, Riwayat)
 * Foto   : Google Drive (folder "Dokumentasi Branding KSB" / satu folder per outlet)
 *
 * PENTING setiap kali kode ini diubah:
 *   Deploy > Manage deployments > (ikon pensil) > Version: New version > Deploy
 *   Tanpa langkah ini, perubahan TIDAK aktif. Dashboard akan menampilkan
 *   peringatan "Kode Apps Script lama" bila versinya tidak cocok.
 */

// ======= PENGATURAN =======
var KODE_AKSES = 'ganti-kode-ini';          // kode yang diketik SF saat pertama buka dashboard ('' = tanpa kode)
var NAMA_FOLDER_FOTO = 'Dokumentasi Branding KSB';
var VERSI_KODE = '2026-11-09a';             // jangan diubah kecuali dashboard juga diperbarui
// ==========================

var MAT = [
  ['poster', 'Poster'], ['layar', 'Layar Toko'], ['sticker', 'Sticker Etalase'],
  ['shopsign', 'Shop Sign'], ['neonbox', 'Neon Box'], ['backdrop', 'Backdrop Dinding']
];
var HEAD_OUTLET = ['ID Digipos', 'NO RS', 'Nama Outlet', 'Kabupaten', 'Kecamatan', 'TAP', 'Nama SF', 'Hari PJP', 'Klasifikasi'];
var HEAD_LAPORAN = ['ID Digipos', 'Nama Outlet', 'TAP', 'Nama SF']
  .concat(MAT.map(function (m) { return m[1]; }))
  .concat(['Jumlah Matpro', 'Status', 'Tanggal Pemasangan', 'Jadwal Cek Matpro', 'Tanggal Cek Terakhir',
    'Kondisi Cek', 'Keterangan', 'Pelapor', 'Catatan', 'Diperbarui', 'Foto (JSON)', 'Folder Foto']);
var HEAD_RIWAYAT = ['Waktu', 'Versi Kode', 'Aksi', 'ID Digipos', 'Nama Outlet', 'Oleh', 'Detail'];

/* ---------------- entry points ---------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  try {
    if (p.action === 'ping') out = { ok: true, versi: VERSI_KODE };
    else { cekKode_(p.key); out = ambilData_(); }
  } catch (err) { out = { ok: false, error: String(err.message || err), versi: VERSI_KODE }; }
  return kirim_(out, p.callback);
}

function doPost(e) {
  var out;
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    cekKode_(b.key);
    if (b.action === 'upload') out = uploadFoto_(b);
    else if (b.action === 'simpan') out = simpanLaporan_(b.laporan || {});
    else if (b.action === 'cek') out = simpanCek_(b);
    else throw new Error('Aksi tidak dikenal: ' + b.action);
  } catch (err) { out = { ok: false, error: String(err.message || err) }; }
  out.versi = VERSI_KODE;
  return kirim_(out);
}

function kirim_(obj, callback) {
  var s = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + s + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

function cekKode_(k) {
  if (KODE_AKSES && String(k || '') !== KODE_AKSES) throw new Error('KODE_SALAH');
}

/* ---------------- setup (jalankan sekali dari editor) ---------------- */
function setup() {
  var ss = SpreadsheetApp.getActive();
  siapkanSheet_(ss, 'Outlet', HEAD_OUTLET);
  var lap = siapkanSheet_(ss, 'Laporan', HEAD_LAPORAN);
  siapkanSheet_(ss, 'Riwayat', HEAD_RIWAYAT);
  // kolom tanggal disimpan sebagai teks yyyy-mm-dd supaya tidak bergeser zona waktu
  ['Tanggal Pemasangan', 'Jadwal Cek Matpro', 'Tanggal Cek Terakhir', 'ID Digipos'].forEach(function (h) {
    var c = HEAD_LAPORAN.indexOf(h) + 1;
    lap.getRange(2, c, lap.getMaxRows() - 1, 1).setNumberFormat('@');
  });
  folderInduk_();
  return 'Setup selesai. Isi tab Outlet dengan data outlet (lihat panduan).';
}

function siapkanSheet_(ss, nama, head) {
  var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
  if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
  var ada = sh.getLastRow() >= 1 ? sh.getRange(1, 1, 1, head.length).getDisplayValues()[0] : [];
  if (ada.join('') === '') {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ---------------- baca data ---------------- */
function ambilData_() {
  var ss = SpreadsheetApp.getActive();
  var shO = ss.getSheetByName('Outlet');
  if (!shO) throw new Error('Tab "Outlet" belum ada. Jalankan fungsi setup() dulu.');
  var outlets = [];
  if (shO.getLastRow() > 1) {
    var vals = shO.getRange(1, 1, shO.getLastRow(), shO.getLastColumn()).getValues();
    var idx = indeksKolom_(vals[0], HEAD_OUTLET);
    for (var i = 1; i < vals.length; i++) {
      var r = vals[i];
      var id = teks_(r[idx['ID Digipos']]);
      if (!id) continue;
      outlets.push(HEAD_OUTLET.map(function (h) { return idx[h] == null ? '' : teks_(r[idx[h]]); }));
    }
  }
  var laporan = {};
  var shL = ss.getSheetByName('Laporan');
  if (shL && shL.getLastRow() > 1) {
    var lv = shL.getRange(1, 1, shL.getLastRow(), shL.getLastColumn()).getDisplayValues();
    var li = indeksKolom_(lv[0], HEAD_LAPORAN);
    for (var j = 1; j < lv.length; j++) {
      var row = lv[j], oid = row[li['ID Digipos']];
      if (!oid) continue;
      laporan[oid] = barisKeLaporan_(row, li);
    }
  }
  return { ok: true, versi: VERSI_KODE, outlets: outlets, laporan: laporan };
}

function barisKeLaporan_(row, li) {
  var g = function (h) { return li[h] == null ? '' : row[li[h]]; };
  var items = MAT.filter(function (m) { return String(g(m[1])).toLowerCase() === 'ya'; }).map(function (m) { return m[0]; });
  var foto = {};
  try { foto = JSON.parse(g('Foto (JSON)') || '{}'); } catch (e) { foto = {}; }
  return {
    items: items, tglPasang: g('Tanggal Pemasangan'), tglCek: g('Tanggal Cek Terakhir'),
    kondisiCek: g('Kondisi Cek'), pelapor: g('Pelapor'), catatan: g('Catatan'),
    updatedAt: g('Diperbarui'), fotoMat: foto
  };
}

function indeksKolom_(header, wajib) {
  var m = {};
  header.forEach(function (h, i) { var k = String(h).trim(); if (k && m[k] == null) m[k] = i; });
  return m;
}

function teks_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.round(v) === v ? v : v).replace(/\.0+$/, '');
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).trim();
}

/* ---------------- foto ---------------- */
function folderInduk_() {
  var it = DriveApp.getFoldersByName(NAMA_FOLDER_FOTO);
  return it.hasNext() ? it.next() : DriveApp.createFolder(NAMA_FOLDER_FOTO);
}

function folderOutlet_(id, nama) {
  var induk = folderInduk_();
  var it = induk.getFoldersByName(id);
  if (it.hasNext()) return it.next();
  // folder lama mungkin bernama "ID - Nama"
  var semua = induk.getFolders();
  while (semua.hasNext()) { var f = semua.next(); if (f.getName().indexOf(id + ' ') === 0) return f; }
  return induk.createFolder(id + ' - ' + (nama || ''));
}

function uploadFoto_(b) {
  if (!b.outletId || !b.mat || !b.data) throw new Error('Data foto tidak lengkap.');
  var matNama = namaMat_(b.mat);
  var folder = folderOutlet_(String(b.outletId), b.nama);
  var bytes = Utilities.base64Decode(String(b.data).replace(/^data:[^,]+,/, ''));
  var nama = matNama.replace(/\s+/g, '_') + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '_' + Math.floor(Math.random() * 1000) + '.jpg';
  var file = folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', nama));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* kebijakan domain bisa menolak */ }
  return { ok: true, fileId: file.getId() };
}

function namaMat_(k) {
  for (var i = 0; i < MAT.length; i++) if (MAT[i][0] === k) return MAT[i][1];
  throw new Error('Jenis matpro tidak dikenal: ' + k);
}

/* ---------------- simpan laporan ---------------- */
function simpanLaporan_(L) {
  var id = String(L.outletId || '');
  if (!id) throw new Error('ID outlet kosong.');
  var items = (L.items || []).filter(function (k) { return MAT.some(function (m) { return m[0] === k; }); });
  if (items.length && !/^\d{4}-\d{2}-\d{2}$/.test(L.tglPasang || '')) throw new Error('Tanggal pemasangan tidak valid.');
  var fotoMat = {};
  items.forEach(function (k) { fotoMat[k] = ((L.fotoMat || {})[k] || []).filter(String); });
  var kurang = items.filter(function (k) { return !fotoMat[k].length; });
  if (kurang.length) throw new Error('Foto belum ada untuk: ' + kurang.map(namaMat_).join(', '));

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();
    var o = cariOutlet_(ss, id);
    var sh = siapkanSheet_(ss, 'Laporan', HEAD_LAPORAN);
    var pos = cariBaris_(sh, id);
    var lama = pos.row ? barisKeLaporan_(pos.values, pos.idx) : null;
    var tglCek = '', kondisi = '';
    if (lama && lama.tglPasang === L.tglPasang && items.length) { tglCek = lama.tglCek; kondisi = lama.kondisiCek; }
    var dasar = tglCek && tglCek > L.tglPasang ? tglCek : L.tglPasang;
    var rec = {
      'ID Digipos': id, 'Nama Outlet': o.nama, 'TAP': o.tap, 'Nama SF': o.sf,
      'Jumlah Matpro': items.length, 'Status': items.length ? 'Sudah Branding' : 'Belum Branding',
      'Tanggal Pemasangan': items.length ? L.tglPasang : '',
      'Jadwal Cek Matpro': items.length ? tambahBulan_(dasar, 3) : '',
      'Tanggal Cek Terakhir': tglCek, 'Kondisi Cek': kondisi,
      'Pelapor': String(L.pelapor || '').slice(0, 80), 'Catatan': String(L.catatan || '').slice(0, 500),
      'Diperbarui': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
      'Foto (JSON)': JSON.stringify(fotoMat),
      'Folder Foto': folderOutlet_(id, o.nama).getUrl()
    };
    MAT.forEach(function (m) { rec[m[1]] = items.indexOf(m[0]) >= 0 ? 'Ya' : ''; });
    tulisBaris_(sh, pos, rec);

    // foto yang dihapus dari laporan dipindah ke sampah Drive
    if (lama) {
      var baru = {}; Object.keys(fotoMat).forEach(function (k) { fotoMat[k].forEach(function (f) { baru[f] = 1; }); });
      Object.keys(lama.fotoMat || {}).forEach(function (k) {
        (lama.fotoMat[k] || []).forEach(function (f) { if (!baru[f]) { try { DriveApp.getFileById(f).setTrashed(true); } catch (e) { } } });
      });
    }
    catat_('lapor', id, o.nama, L.pelapor, items.map(namaMat_).join(', ') + (items.length ? ' · pasang ' + L.tglPasang : ' · belum branding'));
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function simpanCek_(b) {
  var id = String(b.outletId || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.tglCek || '')) throw new Error('Tanggal cek tidak valid.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = siapkanSheet_(ss, 'Laporan', HEAD_LAPORAN);
    var pos = cariBaris_(sh, id);
    if (!pos.row) throw new Error('Outlet ini belum punya laporan pemasangan.');
    var lama = barisKeLaporan_(pos.values, pos.idx);
    var dasar = b.tglCek > lama.tglPasang ? b.tglCek : lama.tglPasang;
    tulisBaris_(sh, pos, {
      'Tanggal Cek Terakhir': b.tglCek, 'Kondisi Cek': String(b.kondisi || ''),
      'Jadwal Cek Matpro': tambahBulan_(dasar, 3),
      'Diperbarui': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
    });
    catat_('cek', id, pos.values[pos.idx['Nama Outlet']], b.oleh, b.tglCek + ' · ' + b.kondisi);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

/* ---------------- util sheet ---------------- */
function cariOutlet_(ss, id) {
  var sh = ss.getSheetByName('Outlet');
  var vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var idx = indeksKolom_(vals[0], HEAD_OUTLET);
  for (var i = 1; i < vals.length; i++) {
    if (teks_(vals[i][idx['ID Digipos']]) === id) {
      return { nama: teks_(vals[i][idx['Nama Outlet']]), tap: teks_(vals[i][idx['TAP']]), sf: teks_(vals[i][idx['Nama SF']]) };
    }
  }
  throw new Error('ID ' + id + ' tidak ada di tab Outlet.');
}

/** Cari baris laporan berdasarkan ID; tidak pernah mengosongkan sheet. */
function cariBaris_(sh, id) {
  var lastCol = Math.max(sh.getLastColumn(), HEAD_LAPORAN.length);
  var all = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), lastCol).getDisplayValues();
  var idx = indeksKolom_(all[0], HEAD_LAPORAN);
  // header lama tanpa kolom baru: tambahkan di kanan, jangan geser data
  HEAD_LAPORAN.forEach(function (h) {
    if (idx[h] == null) {
      var c = sh.getLastColumn() + 1;
      if (sh.getMaxColumns() < c) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
      sh.getRange(1, c).setValue(h).setFontWeight('bold');
      idx[h] = c - 1;
    }
  });
  var ci = idx['ID Digipos'];
  for (var i = 1; i < all.length; i++) {
    if (String(all[i][ci]).trim() === id) return { row: i + 1, values: all[i], idx: idx };
  }
  return { row: 0, values: null, idx: idx };
}

function tulisBaris_(sh, pos, rec) {
  var width = Math.max(sh.getLastColumn(), Object.keys(pos.idx).length);
  var row = pos.row;
  var cur;
  if (row) cur = sh.getRange(row, 1, 1, width).getValues()[0];
  else { row = sh.getLastRow() + 1; cur = new Array(width).fill(''); }
  Object.keys(rec).forEach(function (h) { if (pos.idx[h] != null) cur[pos.idx[h]] = rec[h]; });
  // kolom tanggal & ID ditulis sebagai teks
  ['ID Digipos', 'Tanggal Pemasangan', 'Jadwal Cek Matpro', 'Tanggal Cek Terakhir'].forEach(function (h) {
    if (pos.idx[h] != null) sh.getRange(row, pos.idx[h] + 1).setNumberFormat('@');
  });
  sh.getRange(row, 1, 1, width).setValues([cur]);
  // keterangan otomatis (ikut berubah setiap hari)
  var c = function (h) { return colLetter_(pos.idx[h] + 1) + row; };
  sh.getRange(row, pos.idx['Keterangan'] + 1).setFormula(
    '=IF(' + c('Status') + '<>"Sudah Branding","Belum branding",IFERROR(IF(TODAY()>=DATEVALUE(' + c('Jadwal Cek Matpro') + '),"Cek Matpro","Branding"),"Branding"))');
}

function colLetter_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

function tambahBulan_(s, n) {
  var p = s.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1 + n, 1);
  var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(p[2], last));
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function catat_(aksi, id, nama, oleh, detail) {
  try {
    var sh = siapkanSheet_(SpreadsheetApp.getActive(), 'Riwayat', HEAD_RIWAYAT);
    sh.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), VERSI_KODE, aksi, "'" + id, nama || '', oleh || '', detail || '']);
  } catch (e) { /* log tidak boleh menggagalkan simpan */ }
}
