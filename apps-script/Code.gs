/**
 * Dashboard Branding Cluster Sumbawa Barat — backend Google Apps Script
 * Data   : Google Sheet (tab Outlet, Laporan, Riwayat)
 * Foto   : Google Drive (folder "Dokumentasi Branding KSB" / satu folder per outlet)
 *
 * Deploy otomatis: setiap perubahan folder apps-script/ di GitHub dikirim ke
 * Apps Script dan dideploy sebagai versi baru oleh GitHub Actions
 * (.github/workflows/deploy-apps-script.yml).
 * Bila mengedit langsung di editor Apps Script: Deploy > Manage deployments >
 * ikon pensil > Version: New version > Deploy. Dashboard menampilkan
 * "Kode Apps Script lama" bila versinya tidak cocok.
 */

// ======= PENGATURAN =======
// Kode akses diisi otomatis dari GitHub secret ACCESS_CODE saat deploy.
// Bila mengisi manual, ganti '__KODE_AKSES__' dengan kode Anda (mis. 'ksb2026').
var KODE_AKSES = '__KODE_AKSES__';
var NAMA_FOLDER_FOTO = 'Dokumentasi Branding KSB';
var VERSI_KODE = '2026-11-09b';             // jangan diubah kecuali dashboard juga diperbarui
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

function kodeAktif_() {
  if (KODE_AKSES && KODE_AKSES.indexOf('__') !== 0) return KODE_AKSES;
  return PropertiesService.getScriptProperties().getProperty('KODE_AKSES') || '';
}

function cekKode_(k) {
  var kode = kodeAktif_();
  if (kode && String(k || '') !== kode) throw new Error('KODE_SALAH');
}

/* ---------------- setup ---------------- */
/**
 * Menu di Google Sheet + inisialisasi otomatis saat file dibuka.
 * onOpen (simple trigger) boleh mengubah Sheet ini tanpa izin tambahan,
 * jadi tab Outlet/Laporan/Riwayat/Ringkasan langsung terbentuk walau
 * fungsi setup belum pernah dijalankan.
 */
function onOpen() {
  var ss = SpreadsheetApp.getActive();
  try {
    SpreadsheetApp.getUi().createMenu('Branding KSB')
      .addItem('Setup & rapikan tampilan', 'setup')
      .addItem('Perbarui Ringkasan', 'perbaruiRingkasan')
      .addToUi();
  } catch (e) { /* tanpa UI (mis. dipanggil dari script) */ }
  try {
    if (!ss.getSheetByName('Outlet') || !ss.getSheetByName('Laporan') || !ss.getSheetByName('Ringkasan')) siapkanSemua_(ss);
  } catch (e) { console.warn('onOpen: ' + e); }
}

/** Jalankan sekali dari editor (atau menu Branding KSB). Aman diulang: data tidak pernah dihapus. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  siapkanSemua_(ss);
  folderInduk_();
  return 'Setup selesai.';
}

function perbaruiRingkasan() { buatRingkasan_(SpreadsheetApp.getActive()); }

function siapkanSemua_(ss) {
  siapkanSheet_(ss, 'Outlet', HEAD_OUTLET);
  var lap = siapkanSheet_(ss, 'Laporan', HEAD_LAPORAN);
  siapkanSheet_(ss, 'Riwayat', HEAD_RIWAYAT);
  // kolom tanggal & ID disimpan sebagai teks supaya tidak bergeser zona waktu / jadi angka ilmiah
  var li = indeksKolom_(lap.getRange(1, 1, 1, lap.getLastColumn()).getDisplayValues()[0]);
  ['Tanggal Pemasangan', 'Jadwal Cek Matpro', 'Tanggal Cek Terakhir', 'ID Digipos'].forEach(function (h) {
    if (li[h] != null) lap.getRange(2, li[h] + 1, lap.getMaxRows() - 1, 1).setNumberFormat('@');
  });
  isiOutletAwal_(ss);
  rapikanTampilan_(ss);
  buatRingkasan_(ss);
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
}

/* ---------------- tampilan ---------------- */
var WARNA = { navy: '#0f1d3a', navyMuda: '#e6ecf7', merah: '#d5121c', hijau: '#e3f4e8', hijauTeks: '#17803d', oranye: '#fdf0dc', oranyeTeks: '#b45309', abu: '#eceff4', abuTeks: '#5d6879' };

function gayaHeader_(sh, nKolom) {
  var h = sh.getRange(1, 1, 1, nKolom);
  h.setBackground(WARNA.navy).setFontColor('#ffffff').setFontWeight('bold')
    .setVerticalAlignment('middle').setWrap(true);
  sh.setRowHeight(1, 36);
  sh.setFrozenRows(1);
}

function lebarKolom_(sh, idx, peta) {
  Object.keys(peta).forEach(function (h) { if (idx[h] != null) sh.setColumnWidth(idx[h] + 1, peta[h]); });
}

function pastikanFilter_(sh, nKolom) {
  if (sh.getFilter()) return;
  sh.getRange(1, 1, Math.max(sh.getLastRow(), 2), nKolom).createFilter();
}

function rapikanTampilan_(ss) {
  // Outlet
  var o = ss.getSheetByName('Outlet');
  var oi = indeksKolom_(o.getRange(1, 1, 1, o.getLastColumn()).getDisplayValues()[0]);
  gayaHeader_(o, o.getLastColumn());
  o.setFrozenColumns(3);
  lebarKolom_(o, oi, { 'ID Digipos': 110, 'NO RS': 115, 'Nama Outlet': 210, 'Kabupaten': 125, 'Kecamatan': 130, 'TAP': 120, 'Nama SF': 170, 'Hari PJP': 80, 'Klasifikasi': 115 });
  pastikanFilter_(o, o.getLastColumn());
  o.setTabColor(WARNA.abuTeks);

  // Laporan
  var l = ss.getSheetByName('Laporan');
  var nL = l.getLastColumn();
  var li = indeksKolom_(l.getRange(1, 1, 1, nL).getDisplayValues()[0]);
  gayaHeader_(l, nL);
  l.setFrozenColumns(2);
  var lebar = { 'ID Digipos': 110, 'Nama Outlet': 190, 'TAP': 115, 'Nama SF': 160, 'Jumlah Matpro': 80, 'Status': 125,
    'Tanggal Pemasangan': 105, 'Jadwal Cek Matpro': 105, 'Tanggal Cek Terakhir': 105, 'Kondisi Cek': 150, 'Keterangan': 120,
    'Pelapor': 140, 'Catatan': 220, 'Diperbarui': 125, 'Folder Foto': 120 };
  MAT.forEach(function (m) { lebar[m[1]] = 82; });
  lebarKolom_(l, li, lebar);
  // matpro: rata tengah; kolom JSON foto disembunyikan (dibaca dashboard, tidak untuk manusia)
  MAT.forEach(function (m) { if (li[m[1]] != null) l.getRange(1, li[m[1]] + 1, l.getMaxRows(), 1).setHorizontalAlignment('center'); });
  if (li['Foto (JSON)'] != null) l.hideColumns(li['Foto (JSON)'] + 1);
  pastikanFilter_(l, nL);
  l.setTabColor(WARNA.merah);
  // warna status
  var rules = [];
  var kol = function (h) { return li[h] == null ? null : l.getRange(2, li[h] + 1, l.getMaxRows() - 1, 1); };
  var pasang = function (rg, teks, bg, fg) {
    if (!rg) return;
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(teks).setBackground(bg).setFontColor(fg).setBold(true).setRanges([rg]).build());
  };
  pasang(kol('Status'), 'Sudah Branding', WARNA.hijau, WARNA.hijauTeks);
  pasang(kol('Status'), 'Belum Branding', WARNA.abu, WARNA.abuTeks);
  pasang(kol('Keterangan'), 'Branding', WARNA.hijau, WARNA.hijauTeks);
  pasang(kol('Keterangan'), 'Cek Matpro', WARNA.oranye, WARNA.oranyeTeks);
  pasang(kol('Keterangan'), 'Belum branding', WARNA.abu, WARNA.abuTeks);
  MAT.forEach(function (m) { pasang(kol(m[1]), 'Ya', WARNA.navyMuda, WARNA.navy); });
  l.setConditionalFormatRules(rules);

  // Riwayat
  var r = ss.getSheetByName('Riwayat');
  gayaHeader_(r, HEAD_RIWAYAT.length);
  var ri = indeksKolom_(HEAD_RIWAYAT);
  lebarKolom_(r, ri, { 'Waktu': 150, 'Versi Kode': 95, 'Aksi': 70, 'ID Digipos': 110, 'Nama Outlet': 190, 'Oleh': 140, 'Detail': 320 });
  r.setTabColor(WARNA.abuTeks);
}

/** Tab Ringkasan berisi rumus saja (dibangun ulang aman; tidak menyimpan data). */
function buatRingkasan_(ss) {
  var sh = ss.getSheetByName('Ringkasan') || ss.insertSheet('Ringkasan', 0);
  ss.setActiveSheet(sh); ss.moveActiveSheet(1);
  var l = ss.getSheetByName('Laporan'), o = ss.getSheetByName('Outlet');
  var li = indeksKolom_(l.getRange(1, 1, 1, l.getLastColumn()).getDisplayValues()[0]);
  var oi = indeksKolom_(o.getRange(1, 1, 1, o.getLastColumn()).getDisplayValues()[0]);
  var L = function (h) { var c = colLetter_(li[h] + 1); return 'Laporan!$' + c + '$2:$' + c; };
  var Oc = function (h) { var c = colLetter_(oi[h] + 1); return 'Outlet!$' + c + '$2:$' + c; };
  sh.clear(); sh.clearConditionalFormatRules && sh.clearConditionalFormatRules();
  if (sh.getMaxColumns() < 6) sh.insertColumnsAfter(sh.getMaxColumns(), 6 - sh.getMaxColumns());

  var baris = [];
  baris.push(['Rekap Branding Cluster Sumbawa Barat', '', '', '', '', '']);
  baris.push(['Terhitung otomatis dari tab Laporan & Outlet. Status cek matpro mengikuti tanggal hari ini.', '', '', '', '', '']);
  baris.push(['', '', '', '', '', '']);
  baris.push(['Total outlet', '=COUNTA(' + Oc('ID Digipos') + ')', '', '', '', '']);
  baris.push(['Sudah branding', '=COUNTIF(' + L('Status') + ',"Sudah Branding")', '', '', '', '']);
  baris.push(['Belum branding', '=B4-B5', '', '', '', '']);
  baris.push(['Perlu cek matpro', '=COUNTIF(' + L('Keterangan') + ',"Cek Matpro")', '', '', '', '']);
  baris.push(['Branding share', '=IFERROR(B5/B4,0)', '', '', '', '']);
  baris.push(['', '', '', '', '', '']);
  var mulaiTap = baris.length + 1;
  baris.push(['Per TAP', 'Outlet', 'Sudah branding', 'Belum branding', 'Branding share', 'Perlu cek']);
  var taps = unik_(o, oi['TAP']);
  taps.forEach(function (t) {
    var r = baris.length + 1;
    baris.push([t, '=COUNTIF(' + Oc('TAP') + ',A' + r + ')', '=COUNTIFS(' + L('TAP') + ',A' + r + ',' + L('Status') + ',"Sudah Branding")', '=B' + r + '-C' + r, '=IFERROR(C' + r + '/B' + r + ',0)', '=COUNTIFS(' + L('TAP') + ',A' + r + ',' + L('Keterangan') + ',"Cek Matpro")']);
  });
  baris.push(['', '', '', '', '', '']);
  var mulaiMat = baris.length + 1;
  baris.push(['Per matpro', 'Outlet terpasang', '% dari sudah branding', '', '', '']);
  MAT.forEach(function (m) {
    var r = baris.length + 1;
    baris.push([m[1], '=COUNTIF(' + L(m[1]) + ',"Ya")', '=IFERROR(B' + r + '/$B$5,0)', '', '', '']);
  });
  baris.push(['', '', '', '', '', '']);
  var mulaiSf = baris.length + 1;
  baris.push(['Per Sales Force', 'Outlet', 'Sudah branding', 'Belum branding', 'Branding share', 'Perlu cek']);
  var sfs = unik_(o, oi['Nama SF']);
  sfs.forEach(function (t) {
    var r = baris.length + 1;
    baris.push([t, '=COUNTIF(' + Oc('Nama SF') + ',A' + r + ')', '=COUNTIFS(' + L('Nama SF') + ',A' + r + ',' + L('Status') + ',"Sudah Branding")', '=B' + r + '-C' + r, '=IFERROR(C' + r + '/B' + r + ',0)', '=COUNTIFS(' + L('Nama SF') + ',A' + r + ',' + L('Keterangan') + ',"Cek Matpro")']);
  });

  if (sh.getMaxRows() < baris.length) sh.insertRowsAfter(sh.getMaxRows(), baris.length - sh.getMaxRows());
  sh.getRange(1, 1, baris.length, 6).setValues(baris);

  // gaya
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 230); for (var c = 2; c <= 6; c++) sh.setColumnWidth(c, 125);
  sh.getRange('A1').setFontSize(16).setFontWeight('bold').setFontColor(WARNA.navy);
  sh.getRange('A2').setFontColor(WARNA.abuTeks).setFontStyle('italic');
  sh.getRange('A4:A8').setFontWeight('bold');
  sh.getRange('B4:B8').setFontSize(13).setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('A4:B8').setBackground(WARNA.abu).setBorder(true, true, true, true, true, true, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.getRange('B5').setFontColor(WARNA.hijauTeks); sh.getRange('B7').setFontColor(WARNA.oranyeTeks);
  sh.getRange('B8').setNumberFormat('0.0%');
  [[mulaiTap, taps.length], [mulaiMat, MAT.length], [mulaiSf, sfs.length]].forEach(function (t) {
    var lebar = t[0] === mulaiMat ? 3 : 6;
    sh.getRange(t[0], 1, 1, lebar).setBackground(WARNA.navy).setFontColor('#ffffff').setFontWeight('bold');
    if (t[1]) {
      var isi = sh.getRange(t[0] + 1, 1, t[1], lebar);
      isi.setBorder(null, null, true, null, null, true, '#dbe1ea', SpreadsheetApp.BorderStyle.SOLID);
      sh.getRange(t[0] + 1, 2, t[1], lebar - 1).setHorizontalAlignment('right');
    }
  });
  if (taps.length) sh.getRange(mulaiTap + 1, 5, taps.length, 1).setNumberFormat('0.0%');
  sh.getRange(mulaiMat + 1, 3, MAT.length, 1).setNumberFormat('0.0%');
  if (sfs.length) sh.getRange(mulaiSf + 1, 5, sfs.length, 1).setNumberFormat('0.0%');
  sh.setFrozenRows(2);
  sh.setTabColor(WARNA.navy);
}

function unik_(sh, ci) {
  if (ci == null || sh.getLastRow() < 2) return [];
  var v = sh.getRange(2, ci + 1, sh.getLastRow() - 1, 1).getValues();
  var seen = {}, out = [];
  v.forEach(function (r) { var t = teks_(r[0]); if (t && !seen[t]) { seen[t] = 1; out.push(t); } });
  return out.sort();
}

/** Mengisi tab Outlet dari OUTLET_AWAL (Outlets.gs) hanya bila tab masih kosong. */
function isiOutletAwal_(ss) {
  var sh = ss.getSheetByName('Outlet');
  if (sh.getLastRow() > 1 || typeof OUTLET_AWAL === 'undefined' || !OUTLET_AWAL.length) return;
  var n = OUTLET_AWAL.length;
  if (sh.getMaxRows() < n + 1) sh.insertRowsAfter(sh.getMaxRows(), n + 1 - sh.getMaxRows());
  sh.getRange(2, 1, n, 2).setNumberFormat('@');
  sh.getRange(2, 1, n, HEAD_OUTLET.length).setValues(OUTLET_AWAL);
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
  if (!ss.getSheetByName('Outlet') || !ss.getSheetByName('Laporan')) setup();
  var shO = ss.getSheetByName('Outlet');
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
