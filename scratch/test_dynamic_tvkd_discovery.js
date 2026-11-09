const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '../backend/node_modules/xlsx'));

// Test dynamic TVKD extraction
function loadDynamicTvkdNames(monthDir) {
  const tvkdMap = new Map();

  // 1. Scan QL TT TVKD.xlsx if exists
  const ccpDir = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026';
  if (fs.existsSync(ccpDir)) {
    const days = fs.readdirSync(ccpDir).filter(d => /^\d{2}\.\d{2}$/.test(d));
    for (const d of days) {
      const qlPath = path.join(ccpDir, d, 'QL TT TVKD.xlsx');
      if (fs.existsSync(qlPath)) {
        const wb = XLSX.readFile(qlPath);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        rows.forEach(r => {
          const code = String(r['Mã TVKD'] || '').trim().padStart(3, '0');
          const name = String(r['Tên TVKD'] || '').trim();
          if (code && name) tvkdMap.set(code, name);
        });
        console.log(`Found QL TT TVKD.xlsx on ${d}, loaded ${tvkdMap.size} TVKDs!`);
        break;
      }
    }
  }

  // 2. Scan DSGD.xlsx first available day to discover any additional TVKDs
  const msDir = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026';
  if (fs.existsSync(msDir)) {
    const days = fs.readdirSync(msDir).filter(d => /^\d{2}\.\d{2}$/.test(d));
    for (const d of days) {
      const dsgdPath = path.join(msDir, d, 'DSGD.xlsx');
      if (fs.existsSync(dsgdPath)) {
        const wb = XLSX.readFile(dsgdPath);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        rows.forEach(r => {
          const code = String(r['Mã TVKD'] || '').trim().padStart(3, '0');
          const name = String(r['Tên TVKD'] || '').trim();
          if (code && name && !tvkdMap.has(code)) {
            tvkdMap.set(code, name);
          }
        });
        break;
      }
    }
  }

  return tvkdMap;
}

const map = loadDynamicTvkdNames();
console.log('Total TVKDs dynamically discovered:', map.size);
console.log('Sample TVKDs:');
Array.from(map.entries()).slice(0, 10).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

