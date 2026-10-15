const fs = require('fs');
const path = require('path');
const ExcelJS = require('../backend/node_modules/exceljs');

const targetDir = path.resolve(__dirname, '..', 'Bao cao - Thong ke');

async function inspectAll() {
  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));
  console.log(`Found ${files.length} Excel files in ${targetDir}\n`);

  for (const file of files) {
    const fullPath = path.join(targetDir, file);
    const stat = fs.statSync(fullPath);
    console.log(`================================================================`);
    console.log(`FILE: ${file} (${(stat.size / 1024).toFixed(1)} KB)`);
    console.log(`================================================================`);

    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(fullPath);
      const sheetNames = wb.worksheets.map(w => w.name);
      console.log(`Sheets (${sheetNames.length}):`, sheetNames);

      // Check first sheet or month sheet (e.g. T09.2026 or T10.2026 or sheet 0)
      const targetSheet = wb.getWorksheet('T10.2026') || wb.getWorksheet('T09.2026') || wb.worksheets[0];
      if (targetSheet) {
        console.log(`\nSample Sheet: "${targetSheet.name}" (Total Rows: ${targetSheet.rowCount}, Total Cols: ${targetSheet.columnCount})`);
        
        // Print rows 1 to 6
        for (let r = 1; r <= Math.min(6, targetSheet.rowCount); r++) {
          const row = targetSheet.getRow(r);
          const nonNull = [];
          for (let c = 1; c <= Math.min(40, targetSheet.columnCount); c++) {
            const val = row.getCell(c).value;
            if (val !== null && val !== undefined && val !== '') {
              const strVal = typeof val === 'object' && val.result ? val.result : (typeof val === 'object' && val.richText ? val.richText.map(t=>t.text).join('') : val);
              nonNull.push(`[${c}] ${String(strVal).trim()}`);
            }
          }
          if (nonNull.length > 0) {
            console.log(`  Row ${r}: ${nonNull.slice(0, 15).join(' | ')}${nonNull.length > 15 ? ' ...' : ''}`);
          }
        }
      }
    } catch (e) {
      console.error(`  Error reading ${file}: ${e.message}`);
    }
    console.log('\n');
  }
}

inspectAll().catch(console.error);
