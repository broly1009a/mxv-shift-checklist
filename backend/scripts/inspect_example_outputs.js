const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

const outputLotDir = path.join(process.cwd(), 'src/modules/ccp-statistics/Input&Ouput_Example/Output/Thống kê lot giao dịch');
const outputValDir = path.join(process.cwd(), 'src/modules/ccp-statistics/Input&Ouput_Example/Output/Thống kê giá trị giao dịch');

function dumpDayData(filePath) {
  const fileName = path.basename(filePath);
  const wb = XLSX.readFile(filePath);
  console.log('\n======================================================');
  console.log('FILE:', fileName);
  console.log('Sheets:', wb.SheetNames.join(', '));
  
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    for (let rIdx = 0; rIdx < data.length; rIdx++) {
      const row = data[rIdx];
      if (!row) continue;
      const has3112 = row.some(cell => cell === 46022 || String(cell).includes('31/12/2025') || String(cell).includes('31-12-2025'));
      if (has3112) {
        console.log('  Sheet [' + sheetName + '] Row ' + rIdx + ' found 31/12/2025:');
        const nonZero = [];
        row.forEach((val, cIdx) => {
          if (val !== null && val !== undefined && val !== 0 && val !== '') {
            let colName = 'Col ' + cIdx;
            if (data[1] && data[1][cIdx]) colName = data[1][cIdx];
            else if (data[2] && data[2][cIdx]) colName = data[2][cIdx];
            else if (data[3] && data[3][cIdx]) colName = data[3][cIdx];
            else if (data[4] && data[4][cIdx]) colName = data[4][cIdx];
            nonZero.push({ col: cIdx, header: String(colName).replace(/[\r\n]+/g, ' '), val });
          }
        });
        console.log('  Non-zero columns count:', nonZero.length);
        console.log('  Non-zero values:', JSON.stringify(nonZero));
      }
    }
  }
}

fs.readdirSync(outputLotDir).filter(f => f.endsWith('.xlsx')).forEach(f => dumpDayData(path.join(outputLotDir, f)));
fs.readdirSync(outputValDir).filter(f => f.endsWith('.xlsx')).forEach(f => dumpDayData(path.join(outputValDir, f)));
