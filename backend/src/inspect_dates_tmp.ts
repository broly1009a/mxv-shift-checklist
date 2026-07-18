import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

async function main() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const fileNormal = path.join(baseDir, 'Thong ke so lot giao dich 2026 2.xlsx');
  
  if (!fs.existsSync(fileNormal)) {
    console.error('File not found:', fileNormal);
    return;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fileNormal);
  const ws = wb.getWorksheet('T07.2026') || wb.worksheets[0];
  console.log(`Sheet: ${ws.name}, rowCount = ${ws.rowCount}`);

  for (let r = 5; r <= Math.min(40, ws.rowCount); r++) {
    const cellVal = ws.getCell(r, 2).value;
    const cellStt = ws.getCell(r, 1).value;
    console.log(`Row ${r}: STT = ${JSON.stringify(cellStt)}, Col 2 (Date) = ${JSON.stringify(cellVal)} (Type: ${typeof cellVal}, constructor: ${cellVal?.constructor?.name})`);
  }
}

main().catch(console.error);
