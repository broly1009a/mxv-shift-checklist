import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

async function main() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const fileDsgd = path.join(baseDir, 'DSGD T07.2026.xlsx');
  
  if (!fs.existsSync(fileDsgd)) {
    console.error('File not found:', fileDsgd);
    return;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fileDsgd);
  const ws = wb.getWorksheet('sheet1') || wb.getWorksheet('Sheet1') || wb.worksheets[0];
  console.log(`Sheet: ${ws.name}, rowCount = ${ws.rowCount}`);

  // Let's sample rows from row 2, and also find unique dates in column 23 (W)
  const uniqueDates = new Map<string, number>();
  let nullCount = 0;
  
  for (let r = 2; r <= Math.min(200000, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const val = row.getCell(23).value;
    if (val === null || val === undefined) {
      nullCount++;
      continue;
    }
    const valStr = JSON.stringify(val);
    uniqueDates.set(valStr, (uniqueDates.get(valStr) || 0) + 1);
  }

  console.log(`Null / Undefined count in Col 23: ${nullCount}`);
  console.log('Unique values in Col 23 (W):');
  for (const [val, count] of uniqueDates.entries()) {
    console.log(`- ${val}: ${count} rows`);
  }
}

main().catch(console.error);
