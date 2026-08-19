import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

async function main() {
  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const files = [
    'Thong ke so lot giao dich ACM 2026 2.xlsx',
    'Thong ke so lot giao dich LME 2026.xlsx',
    'Thong ke so lot giao dich Options 2026.xlsx',
    'Thong ke so lot giao dich Spread 2026.xlsx',
  ];

  for (const file of files) {
    const filePath = path.join(baseDir, file);
    if (!fs.existsSync(filePath)) continue;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.worksheets[wb.worksheets.length - 1];

    console.log(`\n=== File: ${file} (Row 16 = 16/07, Row 17 = 17/07) ===`);
    const headerRow = ws.getRow(4);
    const row16 = ws.getRow(16);
    const row17 = ws.getRow(17);

    console.log('Row 16 (16/07) populated cols:');
    const pop16 = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const val = row16.getCell(c).value;
      if (val !== null && val !== undefined && val !== '') {
        pop16.push(`${c}(${val})`);
      }
    }
    console.log(`- ${pop16.join(', ')}`);

    console.log('Row 17 (17/07) populated cols:');
    const pop17 = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const val = row17.getCell(c).value;
      if (val !== null && val !== undefined && val !== '') {
        pop17.push(`${c}(${val})`);
      }
    }
    console.log(`- ${pop17.join(', ')}`);
  }
}

main().catch(console.error);
