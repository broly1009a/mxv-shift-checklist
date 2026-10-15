const fs = require('fs');
const path = require('path');
const ExcelJS = require('../backend/node_modules/exceljs');

const targetDir = path.resolve(__dirname, '..', 'Bao cao - Thong ke');

async function inspectAllTitles() {
  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));
  for (const file of files) {
    const fullPath = path.join(targetDir, file);
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(fullPath);
      const ws = wb.worksheets.find(s => /^T(0?[1-9]|1[0-2])\.2026$/i.test(s.name)) || wb.worksheets[0];
      console.log(`================================================================`);
      console.log(`FILE: ${file}`);
      console.log(`Worksheet: "${ws.name}"`);
      for (let r = 1; r <= 4; r++) {
        const row = ws.getRow(r);
        const nonNull = [];
        for (let c = 1; c <= 15; c++) {
          let v = row.getCell(c).value;
          if (v && typeof v === 'object' && v.richText) v = v.richText.map(t=>t.text).join('');
          if (v && typeof v === 'object' && v.result) v = v.result;
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            nonNull.push(`c${c}: ${String(v).replace(/\r?\n/g, ' ').trim()}`);
          }
        }
        console.log(`  R${r}: ${nonNull.slice(0, 8).join(' | ')}`);
      }
    } catch (e) {
      console.log(`FILE: ${file} - ERROR: ${e.message}`);
    }
  }
}

inspectAllTitles().catch(console.error);
