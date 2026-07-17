import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

async function main() {
  const rootFile = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\root\\DSGD T07.2026 root.xlsx';
  if (!fs.existsSync(rootFile)) {
    console.error('Root file not found:', rootFile);
    return;
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(rootFile);
  const ws = wb.worksheets[0];
  console.log(`Sheet: ${ws.name}, rowCount = ${ws.rowCount}`);

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
