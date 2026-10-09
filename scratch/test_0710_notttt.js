const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '../backend/node_modules/xlsx'));

function findHeaderIndex(headers, target, aliases = []) {
  const normalize = (str) => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const normTarget = normalize(target);
  const normAliases = aliases.map((a) => normalize(a));
  return headers.findIndex((h) => {
    const normH = normalize(h);
    return normH === normTarget || normAliases.includes(normH);
  });
}

function formatVnd(num) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
}

const targetDir = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures\\2026\\T10.2026\\07.10';

// ĐẶC BIỆT: CHỈ ĐỊNH RÕ RÀNG QL TT TKGD.xlsx (LOẠI BỎ "truoc 4h20")
const qltkgdFile = path.join(targetDir, 'QL TT TKGD.xlsx');
const eodFile = path.join(targetDir, 'EOD.xlsx');
const ttttFile = path.join(targetDir, 'TTTT.xlsx');

console.log('Testing with:');
console.log('  QL TT TKGD:', path.basename(qltkgdFile));
console.log('  EOD:', path.basename(eodFile));
console.log('  TTTT:', path.basename(ttttFile));

const qlWb = XLSX.readFile(qltkgdFile);
const qlSheet = qlWb.Sheets[qlWb.SheetNames[0]];
const qlRows = XLSX.utils.sheet_to_json(qlSheet, { header: 1 });
const qlHeaders = qlRows[0].map((h) => String(h || '').trim());

const maTKGDIdx = findHeaderIndex(qlHeaders, 'Mã TKGD', ['Mã tài khoản', 'Mã tiểu khoản', 'InvestorCode']);
const soDuTKKQHienTaiIdx = findHeaderIndex(qlHeaders, 'Số dư TKKQ hiện tại', ['Số dư hiện tại', 'Số dư TKKQ']);
const soDuDauNgayIdx = findHeaderIndex(qlHeaders, 'Số dư TKKQ đầu ngày', ['Số dư đầu ngày', 'TKKQ đầu ngày']);
const nopRutIdx = findHeaderIndex(qlHeaders, 'Nộp rút trong phiên', ['Nộp rút']);
const phiGDIdx = findHeaderIndex(qlHeaders, 'Phí giao dịch', ['Phí GD']);
const phiQCIdx = findHeaderIndex(qlHeaders, 'Phí quyền chọn', ['Phí QC']);
const laiLoVNDIdx = findHeaderIndex(qlHeaders, 'Lãi lỗ thực tế Futures (VND)', [
  'Lãi lỗ thực tế (VND)',
  'Lãi lỗ Futures (VND)',
  'Lãi lỗ thực tế Future (VND)',
  'Lãi lỗ Future (VND)',
  'Lãi lỗ thực tế Future',
  'Lãi lỗ Future',
]);
const laiLoUSDIdx = findHeaderIndex(qlHeaders, 'Lãi lỗ thực tế Futures (USD)', [
  'Lãi lỗ USD',
  'Lãi lỗ thực tế (USD)',
  'Lãi lỗ thực tế Future (USD)',
  'Lãi lỗ Future (USD)',
]);
const laiLoJPYIdx = findHeaderIndex(qlHeaders, 'Lãi lỗ JPY', ['Lãi/lỗ JPY']);
const laiLoMYRIdx = findHeaderIndex(qlHeaders, 'Lãi lỗ MYR', ['Lãi/lỗ MYR']);
const phiDVIdx = findHeaderIndex(qlHeaders, 'Phí dịch vụ thanh toán (VND)', [
  'Phí DV thanh toán',
  'Phí thanh toán',
  'Phí dịch vụ thanh toán',
]);

const ttttFeeMap = new Map();
if (fs.existsSync(ttttFile)) {
  const ttttWb = XLSX.readFile(ttttFile);
  const ttttRows = XLSX.utils.sheet_to_json(ttttWb.Sheets[ttttWb.SheetNames[0]], { header: 1 });
  if (ttttRows.length >= 2) {
    const ttttHeaders = ttttRows[0].map((h) => String(h || '').trim());
    const ttttAccIdx = findHeaderIndex(ttttHeaders, 'Mã TKGD', ['Mã tiểu khoản', 'InvestorCode']);
    const ttttFeeIdx = findHeaderIndex(ttttHeaders, 'Phí dịch vụ thanh toán (VND)', ['Phí dịch vụ thanh toán', 'Phí DV thanh toán']);
    for (let i = 1; i < ttttRows.length; i++) {
      const r = ttttRows[i];
      if (!r) continue;
      const acc = String(r[ttttAccIdx] || '').trim();
      const fee = parseFloat(r[ttttFeeIdx]) || 0;
      if (acc) ttttFeeMap.set(acc, (ttttFeeMap.get(acc) || 0) + fee);
    }
  }
}

const eodWb = XLSX.readFile(eodFile);
const eodRows = XLSX.utils.sheet_to_json(eodWb.Sheets[eodWb.SheetNames[0]], { header: 1 });
const eodHeaders = eodRows[0].map((h) => String(h || '').trim());
const investorCodeIdx = findHeaderIndex(eodHeaders, 'InvestorCode', ['Mã TKGD', 'Mã tài khoản', 'Mã tiểu khoản']);
const eodBalanceIdx = findHeaderIndex(eodHeaders, 'eodBalance', ['EOD Balance', 'Số dư cuối ngày', 'Số dư EOD']);

const eodMap = new Map();
for (let i = 1; i < eodRows.length; i++) {
  const r = eodRows[i];
  if (!r) continue;
  const acc = String(r[investorCodeIdx] || '').trim();
  const bal = parseFloat(r[eodBalanceIdx]);
  if (acc && !isNaN(bal)) eodMap.set(acc, bal);
}

const effectiveRates = { usdLoss: 26000, usdGain: 26000, jpyLoss: 175, jpyGain: 175, myrLoss: 6000, myrGain: 6000 };
const mismatched = [];
let checked = 0;

for (let i = 1; i < qlRows.length; i++) {
  const row = qlRows[i];
  if (!row) continue;
  const acc = String(row[maTKGDIdx] || '').trim();
  if (!acc || !eodMap.has(acc)) continue;
  checked++;

  const soDuDauNgay = parseFloat(row[soDuDauNgayIdx]) || 0;
  const nopRut = nopRutIdx !== -1 ? parseFloat(row[nopRutIdx]) || 0 : 0;
  const phiGD = phiGDIdx !== -1 ? parseFloat(row[phiGDIdx]) || 0 : 0;
  const phiQC = phiQCIdx !== -1 ? parseFloat(row[phiQCIdx]) || 0 : 0;
  const laiLoVND = laiLoVNDIdx !== -1 ? parseFloat(row[laiLoVNDIdx]) || 0 : 0;
  const laiLoUSD = laiLoUSDIdx !== -1 ? parseFloat(row[laiLoUSDIdx]) || 0 : 0;
  const laiLoJPY = laiLoJPYIdx !== -1 ? parseFloat(row[laiLoJPYIdx]) || 0 : 0;
  const laiLoMYR = laiLoMYRIdx !== -1 ? parseFloat(row[laiLoMYRIdx]) || 0 : 0;
  let phiDV = phiDVIdx !== -1 ? parseFloat(row[phiDVIdx]) || 0 : 0;
  if (false && phiDV === 0 && ttttFeeMap.has(acc)) {
    phiDV = ttttFeeMap.get(acc) || 0;
  }

  const tyGiaUSD = (phiQC + laiLoUSD < 0) ? effectiveRates.usdLoss : effectiveRates.usdGain;
  const tyGiaJPY = (laiLoJPY < 0) ? effectiveRates.jpyLoss : effectiveRates.jpyGain;
  const tyGiaMYR = (laiLoMYR < 0) ? effectiveRates.myrLoss : effectiveRates.myrGain;

  const totalTradeProfit = laiLoVND !== 0
    ? (laiLoVND + phiQC * tyGiaUSD)
    : ((phiQC + laiLoUSD) * tyGiaUSD + laiLoJPY * tyGiaJPY + laiLoMYR * tyGiaMYR);

  const calculated = soDuDauNgay + nopRut - phiGD - phiDV + totalTradeProfit;
  const eodVal = eodMap.get(acc);
  const differ = Math.abs(eodVal - calculated);

  if (differ >= 1000) {
    mismatched.push({ acc, calculated, eodVal, differ });
  }
}

console.log('--- KẾT QUẢ KHI DÙNG ĐÚNG FILE QL TT TKGD.xlsx ---');
console.log('Tổng kiểm tra:', checked);
console.log('Lệch:', mismatched.length);
if (mismatched.length === 0) {
  console.log('🎉 KHỚP HOÀN TOÀN 100%! ZERO LỆCH!');
} else {
  console.log('Top lệch:', mismatched.slice(0, 5));
}
