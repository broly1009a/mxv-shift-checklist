import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function main() {
  const filePath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheet2 = wb.worksheets.find(w => w.name.toLowerCase() === 'sheet2')!;
  console.log('--- SHEET2 CONFIG VALUES ---');
  for (let r = 1; r <= 40; r++) {
    const cellA = sheet2.getCell(r, 1);
    const cellB = sheet2.getCell(r, 2);
    
    const getValStr = (cell: ExcelJS.Cell) => {
      const val = cell.value;
      if (val === null || val === undefined) return '';
      if (typeof val === 'object' && val !== null) {
        if ('formula' in val) {
          return `[Formula: ${val.formula} | Result: ${JSON.stringify(val.result)}]`;
        }
        return JSON.stringify(val);
      }
      return String(val);
    };

    const strA = getValStr(cellA);
    const strB = getValStr(cellB);
    if (strA) {
      console.log(`Row ${r}: A = ${strA} | B = ${strB}`);
    }
  }
}
main().catch(console.error);
