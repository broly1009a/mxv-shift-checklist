const fs = require('fs');
const pathMod = require('path');
const XLSX = require(pathMod.join(__dirname, '../backend/node_modules/xlsx'));

const baseDir = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures';
const dsgdPath = `${baseDir}/2026/T10.2026/19.10/DSGD.xlsx`;
const frPath = `${baseDir}/CQG/2026/T10.2026/19.10/FR.xlsx`;
const fr1Path = `${baseDir}/CQG/2026/T10.2026/19.10/FR1.xlsx`;
const fr2Path = `${baseDir}/CQG/2026/T10.2026/19.10/FR2.xlsx`;

function readRows(filePath) {
  const wb = XLSX.readFile(filePath);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
}

const dsgdRows = readRows(dsgdPath);
const fr1Rows = readRows(fr1Path);
const fr2Rows = readRows(fr2Path);

// Parse DSGD
// Col 3: Mã TKGD, Col 12: KL giao dịch, Col 21: Ngày giờ thực hiện
let totalDsgdCqg = 0;
let totalDsgdAcm = 0;
for (let i = 1; i < dsgdRows.length; i++) {
  const r = dsgdRows[i];
  if (!r || r.length === 0) continue;
  const tk = String(r[3] || '').trim();
  const qty = Number(r[12] || 0);
  if (tk.endsWith('A')) {
    totalDsgdAcm += qty;
  } else {
    totalDsgdCqg += qty;
  }
}

// Parse FR1 and FR2 without deduplication
function getFrLots(rows) {
  if (rows.length <= 4) return 0;
  const data = rows.slice(2, rows.length - 2);
  let sum = 0;
  for (const r of data) {
    const sym = String(r[2] || '').trim();
    if (sym === 'ZWAZCE') continue;
    sum += Number(r[5] || 0);
  }
  return sum;
}

const fr1Lots = getFrLots(fr1Rows);
const fr2Lots = getFrLots(fr2Rows);
const totalFrLots = fr1Lots + fr2Lots;

console.log('Total DSGD CQG Lots:', totalDsgdCqg);
console.log('Total DSGD ACM Lots:', totalDsgdAcm);
console.log('FR1 Lots:', fr1Lots);
console.log('FR2 Lots:', fr2Lots);
console.log('Total FR Lots (FR1 + FR2):', totalFrLots);
console.log('DIFFERENCE (DSGD CQG - Total FR):', totalDsgdCqg - totalFrLots);

// Check latest times
const allFrTimes = [];
for (const rows of [fr1Rows, fr2Rows]) {
  if (rows.length > 4) {
    for (const r of rows.slice(2, rows.length - 2)) {
      if (r[1]) allFrTimes.push(String(r[1]).trim());
    }
  }
}
allFrTimes.sort();
console.log('Latest CQG Fill Time:', allFrTimes[allFrTimes.length - 1]);

// Check trades in DSGD after that time
for (let i = 1; i < dsgdRows.length; i++) {
  const r = dsgdRows[i];
  if (!r || r.length === 0) continue;
  const matchTime = String(r[21] || '').trim();
  if (matchTime.includes('10:38:') || matchTime.includes('10:39:')) {
    console.log('DSGD Trade around cutoff:', {
      orderId: r[1],
      tradeId: r[2],
      acc: r[3],
      sym: r[5],
      qty: r[12],
      price: r[13],
      time: r[21]
    });
  }
}

