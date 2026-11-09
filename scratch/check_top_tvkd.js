const fs = require('fs');
const path = require('path');
const XLSX = require('../backend/node_modules/xlsx');
const msDir = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026';
const ccpDir = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026';

const msFolders = fs.readdirSync(msDir).filter(f => /^\d{2}\.\d{2}$/.test(f)).sort();
const tvkdCqg = {};
const tvkdAcm = {};

for (const d of msFolders) {
  const [day] = d.split('.').map(Number);
  const dateObj = new Date(Date.UTC(2026, 9, day, 12, 0, 0));
  if (dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6) continue;
  const fp = path.join(msDir, d, 'DSGD.xlsx');
  if (!fs.existsSync(fp)) continue;
  const wb = XLSX.readFile(fp);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  for (const r of rows) {
    const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
    const lot = Number(r['KL giao dịch']) || 0;
    if (!acc || lot <= 0 || acc.endsWith('A')) continue;
    const code = (String(r['Mã TVKD'] || '').trim() || acc.substring(0, 3)).padStart(3, '0');
    tvkdCqg[code] = (tvkdCqg[code] || 0) + lot;
  }
}

const ccpFolders = fs.readdirSync(ccpDir).filter(f => /^\d{2}\.\d{2}$/.test(f)).sort();
for (const d of ccpFolders) {
  const fp = path.join(ccpDir, d, 'DSGD CCP.xlsx');
  if (!fs.existsSync(fp)) continue;
  const wb = XLSX.readFile(fp);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  for (const r of rows) {
    const exchange = String(r['Sàn giao dịch'] || r['San giao dich'] || '').trim().toUpperCase();
    const inst = String(r['Mã HĐ'] || r['Ma HD'] || '').trim().toUpperCase();
    const isAcm = exchange === 'ACM' || ['SI5CO', 'PL1NY', 'CP2CO', 'NSI', 'NPT', 'NCP'].some(c => inst.startsWith(c));
    if (!isAcm) continue;
    const code = String(r['Mã thành viên'] || r['Ma thanh vien'] || '').trim().padStart(3, '0');
    const lot = Number(r['KL khớp'] || r['KL khop'] || 0);
    if (!code || lot <= 0) continue;
    tvkdAcm[code] = (tvkdAcm[code] || 0) + lot;
  }
}

console.log('TOP 10 TVKD CQG (22 DAYS):');
Object.entries(tvkdCqg).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v], i) => {
  console.log('  STT ' + (i+1) + ': TVKD ' + k + ' = ' + v.toLocaleString() + ' lots (' + (v/169289*100).toFixed(2) + '%)');
});

console.log('\nTOP 10 TVKD ACM (22 DAYS):');
Object.entries(tvkdAcm).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v], i) => {
  console.log('  STT ' + (i+1) + ': TVKD ' + k + ' = ' + v.toLocaleString() + ' lots (' + (v/58307*100).toFixed(2) + '%)');
});

