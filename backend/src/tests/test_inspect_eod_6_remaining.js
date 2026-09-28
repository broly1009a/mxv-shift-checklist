// Script thứ 2: Inspect chi tiết 6 tài khoản còn lệch trong Kịch bản B (24.09 vs EOD)
// Mục tiêu: Xác định chính xác nguyên nhân còn lệch (tỷ giá, phí DVTT, hay dữ liệu QLTKGD 24.09 thiếu cột)
// Chạy: node backend/src/tests/test_inspect_eod_6_remaining.js

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const baseDir = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T09.2026';
const dir24 = path.join(baseDir, '24.09');
const dir25 = path.join(baseDir, '25.09');

// 6 tài khoản còn lệch trong Kịch bản B
const SUSPECT_ACCS = [
  '001C0120311',
  '001C0120820',
  '001C0665689',
  '001C0891111',
  '001C1066776',
  '001C1263003',
];

// --- Đọc EOD ---
let eodPath = path.join(dir24, 'eod.2026-09-24.csv');
if (!fs.existsSync(eodPath)) eodPath = path.join(dir25, 'eod.2026-09-24.csv');

const eodWb = XLSX.read(fs.readFileSync(eodPath), { type: 'buffer' });
const eodRows = XLSX.utils.sheet_to_json(eodWb.Sheets[eodWb.SheetNames[0]], { header: 1 });
const eodHeader = eodRows[0].map((h) => String(h || '').trim());
const eodHeaderLower = eodHeader.map((h) => h.toLowerCase());

const eodMap = new Map();
const eodRawMap = new Map();
for (let i = 1; i < eodRows.length; i++) {
  const row = eodRows[i];
  if (!row || row.length === 0) continue;
  const accIdx = eodHeaderLower.findIndex((h) => h.includes('investorcode') || h.includes('mã tkgd') || h.includes('tkgd'));
  const acc = String(row[accIdx] || '').trim();
  const eodBalIdx = eodHeaderLower.findIndex((h) => h.includes('eodbalance') || h.includes('eod balance'));
  if (!acc) continue;
  eodMap.set(acc, parseFloat(row[eodBalIdx]) || 0);
  eodRawMap.set(acc, Object.fromEntries(eodHeader.map((h, i) => [h, row[i]])));
}

// --- Đọc QLTKGD 24.09 ---
const qWb24 = XLSX.read(fs.readFileSync(path.join(dir24, 'QLTKGD.xlsx')), { type: 'buffer' });
const qSheet24 = qWb24.Sheets[qWb24.SheetNames[0]];
const qRows24 = XLSX.utils.sheet_to_json(qSheet24, { header: 1 });
const qHead24 = qRows24[0].map((h) => String(h || '').trim());

// --- Đọc TTTT 24.09 ---
const ttttFeeMap24 = new Map();
if (fs.existsSync(path.join(dir24, 'TTTT.xlsx'))) {
  const tWb = XLSX.read(fs.readFileSync(path.join(dir24, 'TTTT.xlsx')), { type: 'buffer' });
  const tRows = XLSX.utils.sheet_to_json(tWb.Sheets[tWb.SheetNames[0]], { header: 1 });
  if (tRows.length > 1) {
    const tHead = tRows[0].map((h) => String(h || '').trim().toLowerCase());
    const tAccIdx = tHead.findIndex((h) => h.includes('mã tkgd') || h.includes('tkgd'));
    const tFeeIdx = tHead.findIndex((h) => h.includes('phí dịch vụ') || h.includes('phí dv'));
    for (let r = 1; r < tRows.length; r++) {
      const acc = String(tRows[r][tAccIdx] || '').trim();
      const fee = parseFloat(tRows[r][tFeeIdx]) || 0;
      if (acc) ttttFeeMap24.set(acc, (ttttFeeMap24.get(acc) || 0) + fee);
    }
  }
}

// --- In toàn bộ header QLTKGD 24.09 ---
console.log('================================================================================');
console.log('📋 DANH SÁCH CỘT TRONG FILE QLTKGD.xlsx PHIÊN 24.09:');
console.log('================================================================================');
qHead24.forEach((h, i) => {
  if (h) console.log(`  [${i}] "${h}"`);
});

// --- Inspect từng tài khoản ---
console.log('\n================================================================================');
console.log('🔬 INSPECT CHI TIẾT 6 TÀI KHOẢN CÒN LỆCH SAU KHI ĐỌC TỪ 24.09:');
console.log('================================================================================\n');

const getCol = (head, name, alts = []) => {
  let idx = head.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  if (idx !== -1) return idx;
  for (const alt of alts) {
    idx = head.findIndex((h) => h.toLowerCase().includes(alt.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
};

const cMaTKGD = getCol(qHead24, 'Mã TKGD', ['Mã tài khoản', 'TKGD']);
const cDauNgay = getCol(qHead24, 'Số dư TKKQ đầu ngày', ['Số dư đầu ngày']);
const cNopRut = getCol(qHead24, 'Nộp rút trong phiên', ['Nộp rút']);
const cPhiGD = getCol(qHead24, 'Phí giao dịch', ['Phí GD']);
const cPhiQC = getCol(qHead24, 'Phí quyền chọn', ['Phí QC']);
const cPhiDV = getCol(qHead24, 'Phí dịch vụ thanh toán (VND)', ['Phí DV thanh toán']);
const cLaiLoVND = getCol(qHead24, 'Lãi lỗ thực tế Futures (VND)', ['Lãi lỗ thực tế (VND)', 'Lãi/lỗ Futures VND']);
const cLaiLoUSD = getCol(qHead24, 'Lãi lỗ thực tế Futures (USD)', ['Lãi lỗ USD', 'Lãi/lỗ USD']);

console.log(`Mapping cột QLTKGD 24.09: Mã TKGD=[${cMaTKGD}], Đầu ngày=[${cDauNgay}], Nộp rút=[${cNopRut}], PhíGD=[${cPhiGD}], PhíQC=[${cPhiQC}], PhíDV=[${cPhiDV}], LãiLỗVND=[${cLaiLoVND}], LãiLỗUSD=[${cLaiLoUSD}]\n`);

// Tỷ giá tham chiếu (dùng đúng tỷ giá từ file EOD/M-System ngày 24.09)
const RATES_TO_TEST = [
  { label: 'Tỷ giá USD 26,362 / 26,428 (mua/bán chuẩn 24/09)', usdLoss: 26362, usdGain: 26428 },
  { label: 'Tỷ giá USD 26,400 (trung bình)', usdLoss: 26400, usdGain: 26400 },
  { label: 'Tỷ giá USD 26,390 (theo QLTKGD 24.09)', usdLoss: 26390, usdGain: 26390 },
];

for (const acc of SUSPECT_ACCS) {
  const row = qRows24.find((r) => String(r[cMaTKGD] || '').trim() === acc);
  const eodVal = eodMap.get(acc);
  if (!row) {
    console.log(`❌ TK ${acc}: KHÔNG TÌM THẤY trong QLTKGD 24.09!\n`);
    continue;
  }

  const dauNgay = parseFloat(row[cDauNgay]) || 0;
  const nopRut = cNopRut !== -1 ? parseFloat(row[cNopRut]) || 0 : 0;
  const phiGD = cPhiGD !== -1 ? parseFloat(row[cPhiGD]) || 0 : 0;
  const phiQC = cPhiQC !== -1 ? parseFloat(row[cPhiQC]) || 0 : 0;
  const laiLoVND = cLaiLoVND !== -1 ? parseFloat(row[cLaiLoVND]) || 0 : 0;
  const laiLoUSD = cLaiLoUSD !== -1 ? parseFloat(row[cLaiLoUSD]) || 0 : 0;
  let phiDV = cPhiDV !== -1 ? parseFloat(row[cPhiDV]) || 0 : 0;
  if (phiDV === 0 && ttttFeeMap24.has(acc)) {
    phiDV = ttttFeeMap24.get(acc);
  }

  console.log(`──────────────────────────────────────────────────────────────────────────────`);
  console.log(`TK: ${acc}`);
  console.log(`  Dữ liệu QLTKGD 24.09:`);
  console.log(`    Số dư đầu ngày (24.09):   ${dauNgay.toLocaleString('vi-VN')} đ`);
  console.log(`    Nộp rút trong phiên:      ${nopRut.toLocaleString('vi-VN')} đ`);
  console.log(`    Phí giao dịch:            ${phiGD.toLocaleString('vi-VN')} đ`);
  console.log(`    Phí quyền chọn (USD):     ${phiQC}`);
  console.log(`    Lãi lỗ VND trực tiếp:     ${laiLoVND.toLocaleString('vi-VN')} đ`);
  console.log(`    Lãi lỗ USD:               ${laiLoUSD} USD`);
  console.log(`    Phí DVTT (TTTT 24.09):    ${phiDV.toLocaleString('vi-VN')} đ`);
  console.log(`  EOD Kết quả chốt đêm:       ${eodVal?.toLocaleString('vi-VN')} đ`);

  for (const rateSet of RATES_TO_TEST) {
    const tyGia = (phiQC + laiLoUSD < 0) ? rateSet.usdLoss : rateSet.usdGain;
    const tradeProfit = laiLoVND !== 0 ? (laiLoVND + phiQC * tyGia) : ((phiQC + laiLoUSD) * tyGia);
    const calc = dauNgay + nopRut - phiGD - phiDV + tradeProfit;
    const diff = Math.abs(calc - eodVal);
    const match = diff < 1000 ? '✅ KHỚP' : `❌ LỆCH ${diff.toLocaleString('vi-VN')} đ`;
    console.log(`  [${rateSet.label}]: Tính toán = ${Math.round(calc).toLocaleString('vi-VN')} → ${match}`);
  }

  // In thêm toàn bộ row dữ liệu thô để inspect
  console.log(`  Dữ liệu thô row QLTKGD:`);
  qHead24.forEach((h, i) => {
    if (row[i] !== undefined && row[i] !== '' && row[i] !== null) {
      console.log(`    [${i}] ${h}: ${row[i]}`);
    }
  });
  console.log();
}
