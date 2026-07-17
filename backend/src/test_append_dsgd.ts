import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { appendRawDsgd } from './modules/lot-statistics/helpers/excel-accumulator.helper';

async function main() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const rootFile = path.join(baseDir, 'root', 'DSGD T07.2026 root.xlsx');
  const tempFile = path.join(__dirname, '..', 'temp_dsgd_append_test.xlsx');
  
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
  fs.copyFileSync(rootFile, tempFile);
  
  // Let's read some daily DSGD buffer
  const dailyDsgdPath = path.join(baseDir, 'Backup MS', '16.07', 'DSGD.xlsx');
  const dailyDsgdBuffer = fs.readFileSync(dailyDsgdPath);

  console.log('Running appendRawDsgd for 2026-07-16...');
  await appendRawDsgd(dailyDsgdBuffer, tempFile, new Date('2026-07-16'));

  // Now read tempFile to see what is inside
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tempFile);
  const ws = wb.worksheets[0];
  console.log(`After append: Sheet name = ${ws.name}, rowCount = ${ws.rowCount}`);

  const uniqueDates = new Map<string, number>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const val = ws.getRow(r).getCell(23).value;
    const valStr = JSON.stringify(val);
    uniqueDates.set(valStr, (uniqueDates.get(valStr) || 0) + 1);
  }
  console.log('Unique values in Col 23 (W) after append:');
  for (const [val, count] of uniqueDates.entries()) {
    console.log(`- ${val}: ${count} rows`);
  }

  // Clean up
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
}

main().catch(console.error);
