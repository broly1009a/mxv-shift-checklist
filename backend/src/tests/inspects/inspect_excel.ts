import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function inspect() {
  const filePath =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\root\\Thong ke so lot giao dich LME 2026 root.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  // Print sheet names
  console.log(
    'Sheet names:',
    wb.worksheets.map((w) => w.name),
  );
  const ws =
    wb.getWorksheet('T07.2026') || wb.worksheets[wb.worksheets.length - 1];
  console.log(`Using sheet: ${ws.name}, rowCount: ${ws.rowCount}`);

  for (let r = 1; r <= Math.min(ws.rowCount, 40); r++) {
    const stt = ws.getCell(r, 1).value;
    const dateVal = ws.getCell(r, 2).value;
    if (dateVal !== null && dateVal !== undefined) {
      console.log(
        `Row ${r}: STT=${JSON.stringify(stt)}, Date=${JSON.stringify(dateVal)}, Type=${typeof dateVal}, isDate=${dateVal instanceof Date}`,
      );
    }
  }
}

inspect().catch(console.error);
