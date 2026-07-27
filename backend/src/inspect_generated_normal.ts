import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

async function main() {
  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const fileNormal = path.join(
    baseDir,
    'Thong ke so lot giao dich 2026 2.xlsx',
  );

  if (!fs.existsSync(fileNormal)) {
    console.error('File not found:', fileNormal);
    return;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fileNormal);
  const ws = wb.getWorksheet('T07.2026') || wb.worksheets[0];

  const headerRow = ws.getRow(4);
  const row17 = ws.getRow(17);
  const row18 = ws.getRow(18);

  console.log('=== ROW 17 (16/07) VALUES ===');
  for (let c = 1; c <= 35; c++) {
    const header = headerRow.getCell(c).value;
    const val = row17.getCell(c).value;
    if (val !== null && val !== undefined && val !== '') {
      console.log(`Col ${c} (${header}): ${JSON.stringify(val)}`);
    }
  }

  console.log('\n=== ROW 18 (17/07) VALUES ===');
  for (let c = 1; c <= 35; c++) {
    const header = headerRow.getCell(c).value;
    const val = row18.getCell(c).value;
    if (val !== null && val !== undefined && val !== '') {
      console.log(`Col ${c} (${header}): ${JSON.stringify(val)}`);
    }
  }
}

main().catch(console.error);
