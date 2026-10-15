const fs = require('fs');
const path = require('path');
const ExcelJS = require('../backend/node_modules/exceljs');

const targetDir = path.resolve(__dirname, '..', 'Bao cao - Thong ke');

async function inspectCompact() {
  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));
  
  for (const file of files) {
    const fullPath = path.join(targetDir, file);
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(fullPath);
      const sheetNames = wb.worksheets.map(w => w.name);
      
      // Look for a month sheet or first sheet
      const ws = wb.worksheets.find(s => /^T\d{1,2}\.2026$/i.test(s.name)) || wb.worksheets[0];
      
      console.log(`----------------------------------------------------------------`);
      console.log(`FILE: ${file}`);
      console.log(`Sheets (${sheetNames.length}): ${sheetNames.join(', ')}`);
      if (!ws) {
        console.log(`No worksheet found!`);
        continue;
      }
      console.log(`Inspecting sheet: "${ws.name}" (Rows: ${ws.rowCount}, Cols: ${ws.columnCount})`);
      
      // Let's check headers in rows 1 to 6
      for (let r = 1; r <= Math.min(6, ws.rowCount); r++) {
        const row = ws.getRow(r);
        let cells = [];
        for (let c = 1; c <= Math.min(ws.columnCount, 15); c++) {
          let val = row.getCell(c).value;
          if (val && typeof val === 'object' && val.richText) val = val.richText.map(t=>t.text).join('');
          if (val && typeof val === 'object' && val.result) val = val.result;
          cells.push(`[${c}] ${String(val || '').replace(/\r?\n/g, ' ')}`);
        }
        console.log(`  R${r}: ${cells.join(' | ')}`);
      }
    } catch (e) {
      console.log(`FILE: ${file} - ERROR: ${e.message}`);
    }
  }
}

inspectCompact().catch(console.error);
