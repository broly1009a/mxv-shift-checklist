import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function main() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const rootDir = path.join(baseDir, 'root');

  const wbGen = new ExcelJS.Workbook();
  await wbGen.xlsx.readFile(path.join(baseDir, 'DSGD T07.2026.xlsx'));
  const wsGen = wbGen.worksheets[0];

  const wbRoot = new ExcelJS.Workbook();
  await wbRoot.xlsx.readFile(path.join(rootDir, 'DSGD T07.2026.xlsx'));
  const wsRoot = wbRoot.worksheets[0];

  console.log(`Gen Columns: ${wsGen.columnCount}, Root Columns: ${wsRoot.columnCount}`);
  
  console.log('\n=== Gen Headers ===');
  for (let c = 1; c <= wsGen.columnCount; c++) {
    console.log(`Col ${c}: ${wsGen.getRow(1).getCell(c).value}`);
  }

  console.log('\n=== Root Headers ===');
  for (let c = 1; c <= wsRoot.columnCount; c++) {
    console.log(`Col ${c}: ${wsRoot.getRow(1).getCell(c).value}`);
  }
}

main().catch(console.error);
