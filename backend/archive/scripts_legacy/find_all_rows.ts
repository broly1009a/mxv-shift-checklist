import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

function isSameDate(cellVal: any, targetDate: Date): boolean {
  if (cellVal === null || cellVal === undefined) return false;
  let d: Date | null = null;
  if (cellVal instanceof Date) {
    d = cellVal;
  } else if (typeof cellVal === 'object' && cellVal !== null) {
    if ('result' in cellVal) {
      return isSameDate(cellVal.result, targetDate);
    }
  } else {
    const str = String(cellVal).trim();
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }
  if (!d) return false;
  return (
    d.getFullYear() === targetDate.getFullYear() &&
    d.getMonth() === targetDate.getMonth() &&
    d.getDate() === targetDate.getDate()
  );
}

async function main() {
  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const targetDate = new Date(2026, 6, 16); // 16-Jul-2026

  const files = [
    'Thong ke so lot giao dich 2026 2.xlsx',
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

    const matchedRows: number[] = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const v = ws.getCell(r, 2).value;
      if (isSameDate(v, targetDate)) {
        matchedRows.push(r);
      }
    }
    console.log(
      `${file}: matched rows for 16-Jul = ${JSON.stringify(matchedRows)}`,
    );
  }
}

main().catch(console.error);
