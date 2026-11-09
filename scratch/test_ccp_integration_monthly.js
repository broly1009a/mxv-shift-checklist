const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '../backend/node_modules/xlsx'));

const msBase = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026';
const ccpBase = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026';

const days = fs.readdirSync(msBase).filter(d => /^\d{2}\.\d{2}$/.test(d)).sort();
console.log('Testing integration for', days.length, 'days in October 2026...');

let cqgLot = 0;
let acmLot = 0;
let cqgTrades = 0;
let acmTrades = 0;

days.forEach(d => {
  // 1. CQG from Backup MS
  const msPath = path.join(msBase, d, 'DSGD.xlsx');
  if (fs.existsSync(msPath)) {
    const wb = XLSX.readFile(msPath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    rows.forEach(r => {
      const acc = String(r['Tài khoản'] || r['Tai khoan'] || '').trim();
      if (acc.endsWith('A') || acc.endsWith('-A')) return;
      const lot = Number(r['Khối lượng'] || r['Khoi luong'] || 0);
      cqgTrades++;
      cqgLot += lot;
    });
  }

  // 2. ACM from Backup CCP (DSGD CCP.xlsx)
  const ccpPath = path.join(ccpBase, d, 'DSGD CCP.xlsx');
  if (fs.existsSync(ccpPath)) {
    const wb = XLSX.readFile(ccpPath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    rows.forEach(r => {
      const lot = Number(r['KL khớp'] || r['KL khop'] || 0);
      acmTrades++;
      acmLot += lot;
    });
  }
});

console.log('=== OCTOBER 2026 SUMMARY ===');
console.log('CQG Trades:', cqgTrades, '| CQG Lot:', cqgLot);
console.log('ACM Trades:', acmTrades, '| ACM Lot:', acmLot);
console.log('Total Market Lot:', cqgLot + acmLot);
console.log('ACM Ratio:', ((acmLot / (cqgLot + acmLot)) * 100).toFixed(2) + '%');
