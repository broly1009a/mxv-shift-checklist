const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '../backend/node_modules/xlsx'));

const msBase = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026';
const ccpBase = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026';

const days = new Set();
fs.readdirSync(msBase).forEach(d => { if (/^\d{2}\.\d{2}$/.test(d)) days.add(d); });
fs.readdirSync(ccpBase).forEach(d => { if (/^\d{2}\.\d{2}$/.test(d)) days.add(d); });

const sortedDays = Array.from(days).sort();
console.log('Total trading days found:', sortedDays.length);

let totalCqgTrades = 0, totalCqgLots = 0;
let totalAcmTrades = 0, totalAcmLots = 0;
const acmTvkdLots = {};
const acmCommLots = {};

for (const d of sortedDays) {
  const [dayPart] = d.split('.');
  const dateObj = new Date(Date.UTC(2026, 9, parseInt(dayPart, 10), 12, 0, 0));
  if (dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6) continue;

  // 1. CQG: DSGD.xlsx in Backup MS
  const dsgdPath = path.join(msBase, d, 'DSGD.xlsx');
  if (fs.existsSync(dsgdPath)) {
    const wb = XLSX.readFile(dsgdPath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    for (const r of rows) {
      const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
      const lot = Number(r['KL giao dịch']) || 0;
      if (!acc || lot <= 0 || acc.endsWith('A')) continue;
      totalCqgTrades++;
      totalCqgLots += lot;
    }
  }

  // 2. ACM: DSGD CCP.xlsx in Backup CCP
  const ccpPath = path.join(ccpBase, d, 'DSGD CCP.xlsx');
  if (fs.existsSync(ccpPath)) {
    const wb = XLSX.readFile(ccpPath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    for (const r of rows) {
      const ex = String(r['Sàn giao dịch'] || '').trim().toUpperCase();
      const inst = String(r['Mã HĐ'] || '').trim().toUpperCase();
      if (ex !== 'ACM' && !['SI5CO', 'PL1NY', 'CP2CO'].some(c => inst.startsWith(c))) continue;

      const tvkd = String(r['Mã thành viên'] || '').trim().padStart(3, '0');
      const lot = Number(r['KL khớp']) || 0;
      if (!tvkd || lot <= 0) continue;

      totalAcmTrades++;
      totalAcmLots += lot;
      acmTvkdLots[tvkd] = (acmTvkdLots[tvkd] || 0) + lot;
      const comm = inst.substring(0, 5);
      acmCommLots[comm] = (acmCommLots[comm] || 0) + lot;
    }
  }
}

console.log('=== KẾT QUẢ ĐỐI SOÁT 2 NGUỒN CHUẨN (BACKUP MS & BACKUP CCP) ===');
console.log('CQG Trades:', totalCqgTrades, '| Lots:', totalCqgLots);
console.log('ACM Trades:', totalAcmTrades, '| Lots:', totalAcmLots);
console.log('TỔNG TOÀN THỊ TRƯỜNG:', totalCqgLots + totalAcmLots, 'lots');
console.log('Tỷ trọng ACM:', ((totalAcmLots / (totalCqgLots + totalAcmLots)) * 100).toFixed(2) + '%');
console.log('ACM Commodities:', acmCommLots);
console.log('Top 5 TVKD ACM:');
Object.entries(acmTvkdLots).sort((a,b) => b[1] - a[1]).slice(0, 5).forEach(([tvkd, lot]) => {
  console.log(`  TVKD ${tvkd}: ${lot.toLocaleString()} lots (${((lot/totalAcmLots)*100).toFixed(2)}%)`);
});

