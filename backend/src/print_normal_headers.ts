import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function main() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const fileGen = path.join(baseDir, 'Thong ke so lot giao dich 2026 2.xlsx');
  
  const wbGen = new ExcelJS.Workbook();
  await wbGen.xlsx.readFile(fileGen);
  const wsGen = wbGen.worksheets[wbGen.worksheets.length - 1]; // last sheet

  console.log(`=== Cell Details of Column 2 in Gen File: ${wsGen.name} ===`);
  for (let r = 5; r <= 20; r++) {
    const cell = wsGen.getCell(r, 2);
    console.log(`Row ${r}: value = ${JSON.stringify(cell.value)}, type = ${cell.type}`);
  }
}

main().catch(console.error);
