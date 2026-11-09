const fs = require('fs');
const path = require('path');
const XLSX = require('../backend/node_modules/xlsx');

const msDir = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026';
const ccpDir = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026';

console.log('=== VERIFYING ACTUAL M: DRIVE BACKUP FILES FOR OCTOBER 2026 ===');

// 1. Check folders in MS
const msFolders = fs.readdirSync(msDir).filter(f => /^\d{2}\.\d{2}$/.test(f)).sort();
console.log(`MS Folders (${msFolders.length}): ${msFolders.join(', ')}`);

// 2. Check folders in CCP
const ccpFolders = fs.readdirSync(ccpDir).filter(f => /^\d{2}\.\d{2}$/.test(f)).sort();
console.log(`CCP Folders (${ccpFolders.length}): ${ccpFolders.join(', ')}`);

// 3. Analyze MS Folders day by day
let totalCqgTrades22 = 0;
let totalCqgLot22 = 0;
let totalCqgLotWithWeekends = 0;

const cqgByDay = {};
const cqgByMember22 = {};
const memberDaily = {}; // member -> { day: lot }

for (const d of msFolders) {
  const [day, mon] = d.split('.').map(Number);
  const dateObj = new Date(Date.UTC(2026, 9, day, 12, 0, 0));
  const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getUTCDay()];

  const filePath = path.join(msDir, d, 'DSGD.xlsx');
  if (!fs.existsSync(filePath)) {
    console.log(`[MS] ${d} (${dayName}): NO DSGD.xlsx`);
    continue;
  }

  const wb = XLSX.readFile(filePath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  
  let dayLot = 0;
  let dayTrades = 0;

  for (const r of rows) {
    const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
    const lot = Number(r['KL giao dịch']) || 0;
    if (!acc || lot <= 0 || acc.endsWith('A')) continue;

    const tvkdCode = (String(r['Mã TVKD'] || '').trim() || acc.substring(0, 3)).padStart(3, '0');
    
    dayLot += lot;
    dayTrades++;

    if (!isWeekend) {
      cqgByMember22[tvkdCode] = (cqgByMember22[tvkdCode] || 0) + lot;
      if (!memberDaily[tvkdCode]) memberDaily[tvkdCode] = {};
      memberDaily[tvkdCode][d] = (memberDaily[tvkdCode][d] || 0) + lot;
    }
  }

  cqgByDay[d] = { dayName, isWeekend, dayTrades, dayLot };
  totalCqgLotWithWeekends += dayLot;
  if (!isWeekend) {
    totalCqgLot22 += dayLot;
    totalCqgTrades22 += dayTrades;
  }
}

console.log('\n--- MS / CQG DAY-BY-DAY BREAKDOWN ---');
for (const [d, info] of Object.entries(cqgByDay)) {
  const mark = info.isWeekend ? ' [WEEKEND - DUPLICATE]' : '';
  console.log(`  ${d} (${info.dayName}): ${info.dayLot.toLocaleString()} lots (${info.dayTrades.toLocaleString()} trades)${mark}`);
}

console.log('\n--- CQG TOTAL SUMMARY ---');
console.log(`Total 22 Trading Days (Mon-Fri): ${totalCqgLot22.toLocaleString()} lots (${totalCqgTrades22.toLocaleString()} trades)`);
console.log(`Total including Saturdays (03.10 & 10.10): ${totalCqgLotWithWeekends.toLocaleString()} lots`);
console.log(`Difference (Weekend Duplicate Lots): ${(totalCqgLotWithWeekends - totalCqgLot22).toLocaleString()} lots`);

// 4. Analyze CCP Folders day by day
let totalAcmTrades22 = 0;
let totalAcmLot22 = 0;
const acmByDay = {};
const acmByMember22 = {};

for (const d of ccpFolders) {
  const filePath = path.join(ccpDir, d, 'DSGD CCP.xlsx');
  if (!fs.existsSync(filePath)) {
    console.log(`[CCP] ${d}: NO DSGD CCP.xlsx`);
    continue;
  }

  const wb = XLSX.readFile(filePath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  let dayLot = 0;
  let dayTrades = 0;

  for (const r of rows) {
    const exchange = String(r['Sàn giao dịch'] || r['San giao dich'] || '').trim().toUpperCase();
    const inst = String(r['Mã HĐ'] || r['Ma HD'] || '').trim().toUpperCase();
    const isAcmTrade = exchange === 'ACM' || ['SI5CO', 'PL1NY', 'CP2CO', 'NSI', 'NPT', 'NCP'].some(c => inst.startsWith(c));
    if (!isAcmTrade) continue;

    const tvkdCode = String(r['Mã thành viên'] || r['Ma thanh vien'] || '').trim().padStart(3, '0');
    const lot = Number(r['KL khớp'] || r['KL khop'] || 0);
    if (!tvkdCode || lot <= 0) continue;

    dayLot += lot;
    dayTrades++;
    acmByMember22[tvkdCode] = (acmByMember22[tvkdCode] || 0) + lot;
  }

  acmByDay[d] = { dayTrades, dayLot };
  totalAcmLot22 += dayLot;
  totalAcmTrades22 += dayTrades;
}

console.log('\n--- CCP / ACM DAY-BY-DAY BREAKDOWN ---');
for (const [d, info] of Object.entries(acmByDay)) {
  console.log(`  ${d}: ${info.dayLot.toLocaleString()} lots (${info.dayTrades.toLocaleString()} trades)`);
}

console.log('\n--- ACM TOTAL SUMMARY ---');
console.log(`Total 22 Trading Days ACM (from Backup CCP): ${totalAcmLot22.toLocaleString()} lots (${totalAcmTrades22.toLocaleString()} trades)`);

console.log('\n==================================================');
console.log('GRAND TOTAL MARKET OCTOBER 2026 (22 SESSIONS):');
console.log(`  CQG Volume: ${totalCqgLot22.toLocaleString()} lots`);
console.log(`  ACM Volume: ${totalAcmLot22.toLocaleString()} lots`);
console.log(`  TOTAL MARKET: ${(totalCqgLot22 + totalAcmLot22).toLocaleString()} lots`);
console.log('==================================================');

// 5. Check Gia Cát Lợi (003) Peak Day
console.log('\n--- GIA CAT LOI (003) DAILY STATS IN OCTOBER 2026 ---');
const gclDaily = memberDaily['003'] || {};
let gclPeakDay = '';
let gclPeakLot = 0;
for (const [d, lot] of Object.entries(gclDaily)) {
  console.log(`  Ngày ${d}: ${lot.toLocaleString()} lots`);
  if (lot > gclPeakLot) {
    gclPeakLot = lot;
    gclPeakDay = d;
  }
}
console.log(`Gia Cát Lợi (003) Total (22 days): ${(cqgByMember22['003'] || 0).toLocaleString()} lots`);
console.log(`Gia Cát Lợi (003) Real Peak Day: ${gclPeakDay} (${gclPeakLot.toLocaleString()} lots)`);
