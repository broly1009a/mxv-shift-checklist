import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function inspect() {
  const filePath = path.join(
    __dirname,
    '..',
    'Marco thong ke lot',
    'Thong ke so lot giao dich LME 2026.xlsx',
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet('T07.2026')!;
  console.log(`LME Sheet Row count: ${ws.rowCount}`);
  for (let r = 5; r <= Math.min(ws.rowCount, 30); r++) {
    const val = ws.getCell(r, 2).value;
    console.log(
      `Row ${r}: value=${JSON.stringify(val)}, type=${typeof val}, isDate=${val instanceof Date}`,
    );
  }
}

inspect().catch(console.error);
