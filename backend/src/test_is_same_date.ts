import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

function isSameDate(cellVal: any, targetDate: Date): boolean {
  if (cellVal === null || cellVal === undefined) return false;
  let d: Date | null = null;
  
  if (cellVal instanceof Date) {
    d = cellVal;
  } else if (typeof cellVal === 'number') {
    const epoch = new Date(1899, 11, 30);
    d = new Date(epoch.getTime() + cellVal * 86400000);
  } else if (typeof cellVal === 'object' && cellVal !== null) {
    if ('result' in cellVal) {
      return isSameDate(cellVal.result, targetDate);
    }
  } else {
    const str = String(cellVal).trim();
    const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      let year = parseInt(match[3], 10);
      if (year < 100) year += 2000;
      d = new Date(year, month, day);
    } else {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }
  }

  if (!d || isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === targetDate.getFullYear() &&
    d.getMonth() === targetDate.getMonth() &&
    d.getDate() === targetDate.getDate()
  );
}

async function main() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const fileNormal = path.join(baseDir, 'Thong ke so lot giao dich 2026 2.xlsx');
  
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fileNormal);
  const ws = wb.getWorksheet('T07.2026') || wb.worksheets[0];

  const target16 = new Date('2026-07-16');
  const target17 = new Date('2026-07-17');

  console.log(`Checking match for 16-Jul-2026 (target: ${target16.toISOString()}):`);
  let found16 = -1;
  for (let r = 5; r <= 35; r++) {
    const val = ws.getCell(r, 2).value;
    if (isSameDate(val, target16)) {
      found16 = r;
      console.log(`- Matched Row ${r}: STT = ${ws.getCell(r, 1).value}, val = ${JSON.stringify(val)}`);
    }
  }
  if (found16 === -1) console.log('- No match found!');

  console.log(`\nChecking match for 17-Jul-2026 (target: ${target17.toISOString()}):`);
  let found17 = -1;
  for (let r = 5; r <= 35; r++) {
    const val = ws.getCell(r, 2).value;
    if (isSameDate(val, target17)) {
      found17 = r;
      console.log(`- Matched Row ${r}: STT = ${ws.getCell(r, 1).value}, val = ${JSON.stringify(val)}`);
    }
  }
  if (found17 === -1) console.log('- No match found!');
}

main().catch(console.error);
