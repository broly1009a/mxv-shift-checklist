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

    console.log(`\n=== File: ${file} (Sheet: ${ws.name}) ===`);
    for (let r = 14; r <= 18; r++) {
      const stt = ws.getCell(r, 1).value;
      const val = ws.getCell(r, 2).value;
      console.log(
        `Row ${r}: STT = ${JSON.stringify(stt)}, Col 2 = ${JSON.stringify(val)}`,
      );
    }
  }
}

main().catch(console.error);
