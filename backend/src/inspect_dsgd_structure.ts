import * as ExcelJS from 'exceljs';

async function main() {
  const filePath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07\\DSGD.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  
  console.log('=== DSGD.xlsx Column Headers ===');
  const headerRow = ws.getRow(1);
  for (let c = 1; c <= ws.columnCount; c++) {
    console.log(`Col ${c}: ${headerRow.getCell(c).value}`);
  }

  console.log('\n=== DSGD.xlsx Row 2 (First Data Row) ===');
  const row2 = ws.getRow(2);
  for (let c = 1; c <= ws.columnCount; c++) {
    console.log(`Col ${c} (${headerRow.getCell(c).value}): ${JSON.stringify(row2.getCell(c).value)}`);
  }
}

main().catch(console.error);
