const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCode = `node -e '
const fs = require("fs");
const path = require("path");

// Load các module parser và recon của hệ thống trên server
const { KlgdReconService } = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/services/klgd-recon.service");
const { SystemSettingsService } = require("/opt/mxv-checklist/backend/dist/modules/system-settings/system-settings.service");

const klgdService = new KlgdReconService({ getSetting: async () => "", setSetting: async () => {} });

const msFile = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/16.10/DSGD.xlsx";
const cqgDir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/16.10";
const frFile = path.join(cqgDir, "FR.xlsx");
const fr1File = path.join(cqgDir, "FR1.xlsx");
const fr2File = path.join(cqgDir, "FR2.xlsx");
const acmFile = path.join("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/2026/T10.2026/16.10", "Straits.csv");

const files = {
  dsgd: fs.readFileSync(msFile),
  fr: fs.readFileSync(frFile),
};
if (fs.existsSync(acmFile)) files.nano = fs.readFileSync(acmFile);

// Trích xuất snapshot thời gian thực tế
const XLSX = require("/opt/mxv-checklist/backend/node_modules/xlsx");
function getSnap(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const wb = XLSX.readFile(filePath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const m = String(rows[0][0] || "").match(/reported as of\\s+([0-9]{1,2}\\/[0-9]{1,2}\\/[0-9]{2,4}\\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\\s*(?:\\u202f|\\s)*(?:AM|PM)?)/i);
  return m ? new Date(m[1].replace(/\\u202f|\\s+/g, " ")) : null;
}

const snap1 = getSnap(fr1File);
const snap2 = getSnap(fr2File);
const effectiveCqgCutoff = (snap1 && snap2) ? new Date(Math.max(snap1.getTime(), snap2.getTime())) : (snap1 || snap2);

console.log("CQG Cutoff Time trích xuất từ Header:", effectiveCqgCutoff.toISOString());

(async () => {
  // 1. Chạy nguyên bản
  const resOriginal = await klgdService.checkKLGD(
    files,
    new Date("2026-10-16"),
    [],
    "05:00",
    { cutoffTime: new Date(fs.statSync(msFile).mtime.getTime() - 2000) }
  );
  console.log("\\n1. KẾT QUẢ GỐC (CHƯA CÓ LỌC CHIỀU MS -> CQG):");
  console.log("   • Total DSGD:", resOriginal.totals.totalDSGD);
  console.log("   • Total FR  :", resOriginal.totals.totalFR);
  console.log("   • Differ    :", resOriginal.totals.differ);
  console.log("   • Passed    :", resOriginal.passed);
  console.log("   • Lệch      :", resOriginal.mismatchedTrades.length);

  // 2. Mô phỏng hàm lọc chính xác
  // Đọc MS và lọc các lệnh sau cqgCutoffTime
  const { parseDSGD, parseFR, parseTradeDateTime } = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/helpers/trading-math.helper");
  const rawDsgd = parseDSGD(files.dsgd);
  const rawFr = parseFR(files.fr, new Date("2026-10-16"), []);

  const pendingSync = [];
  const filteredDsgd = rawDsgd.filter(gd => {
    if (!gd.ngayGio) return true;
    const t = parseTradeDateTime(gd.ngayGio, new Date("2026-10-16"));
    if (!t) return true;
    if (effectiveCqgCutoff && !gd.maTKGD.toUpperCase().endsWith("A") && t > effectiveCqgCutoff) {
      pendingSync.push({
        source: "MS",
        maTKGD: gd.maTKGD,
        maHD: gd.maHD,
        giaKhop: gd.giaKhop,
        klGiaoDich: gd.klGiaoDich,
        ngayGio: gd.ngayGio,
        cutoffTime: effectiveCqgCutoff.toISOString(),
        note: \`Giao dịch M-System khớp lúc \${gd.ngayGio}, sau mốc chốt dữ liệu CQG (\${effectiveCqgCutoff.toLocaleTimeString("vi-VN")})\`
      });
      return false;
    }
    return true;
  });

  let totDSGD = 0;
  filteredDsgd.forEach(g => {
    if (!g.maTKGD.toUpperCase().endsWith("A")) totDSGD += g.klGiaoDich;
  });
  let totFR = 0;
  const sessionStart = new Date("2026-10-16T05:00:00");
  const { parseCqgDateTime } = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/helpers/trading-math.helper");
  rawFr.forEach(f => {
    if (f.symbol === "ZWAZCE") return;
    if (f.time) {
      const t = parseCqgDateTime(f.time, new Date("2026-10-16"));
      if (t && t < sessionStart) return; // Lọc lệnh trước 05:00 sáng
    }
    totFR += f.qty;
  });

  const mismatches = [];
  filteredDsgd.forEach(gd => {
    if (gd.maTKGD.toUpperCase().endsWith("A")) return;
    const exists = rawFr.some(f => f.combinedKey === gd.combinedKey);
    if (!exists) mismatches.push(gd);
  });

  console.log("\\n2. KẾT QUẢ SAU KHI ÁP DỤNG HÀM LỌC CHUẨN XÁC HAI CHIỀU:");
  console.log("   • Total DSGD:", totDSGD);
  console.log("   • Total FR  :", totFR);
  console.log("   • Differ    :", Math.abs(totFR - totDSGD));
  console.log("   • Passed    :", (Math.abs(totFR - totDSGD) === 0 && mismatches.length === 0));
  console.log("   • Số lệnh bảo lưu pendingSyncTrades:", pendingSync.length);
  pendingSync.forEach(p => console.log("     +", p.maTKGD, p.maHD, "Giá:", p.giaKhop, "Qty:", p.klGiaoDich, "Khớp:", p.ngayGio));
  console.log("   • Số lệnh lệch thực sự (Mismatched):", mismatches.length);
})();
'`;

  conn.exec(remoteCode, (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', () => { conn.end(); });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
