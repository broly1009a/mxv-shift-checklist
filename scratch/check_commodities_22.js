const fs = require('fs');
const path = require('path');
const XLSX = require('../backend/node_modules/xlsx');
const msDir = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026';

const msFolders = fs.readdirSync(msDir).filter(f => /^\d{2}\.\d{2}$/.test(f)).sort();
const commCqg = {};

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
    const hd = String(r['Mã HĐ'] || '').trim().toUpperCase();
    commCqg[hd] = (commCqg[hd] || 0) + lot;
  }
}

console.log('TOP 10 COMMODITIES (RAW HD):');
Object.entries(commCqg).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v], i) => {
  console.log('  STT ' + (i+1) + ': ' + k + ' = ' + v.toLocaleString() + ' lots');
});

