import ExcelJS from 'exceljs';
import * as path from 'path';

async function inspectBoth() {
  const originalPath = path.join(__dirname, '../../../POC/TKGD-Automation/inputs/excel-templates/Auto Data mail.xlsm');
  const generatedPath = path.join(__dirname, '../../../POC/TKGD-Automation/output/Auto_Data_mail_20260903.xlsx');

  console.log('======================================================================');
  console.log('1. PHÂN TÍCH CHI TIẾT FILE GỐC (TEMPLATE):', originalPath);
  console.log('======================================================================');
  const wbOrig = new ExcelJS.Workbook();
  await wbOrig.xlsx.readFile(originalPath);

  wbOrig.worksheets.forEach((ws) => {
    console.log(`\n📄 Sheet: "${ws.name}" (Tổng dòng: ${ws.rowCount}, Tổng cột: ${ws.columnCount})`);
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
      if (vals.some((v) => v !== null && v !== undefined && v !== '')) {
        console.log(`  [Dòng ${r}]:`, JSON.stringify(vals));
      }
    }
  });

  console.log('\n======================================================================');
  console.log('2. PHÂN TÍCH CHI TIẾT FILE VỪA SINH RA (OUTPUT):', generatedPath);
  console.log('======================================================================');
  const wbGen = new ExcelJS.Workbook();
  await wbGen.xlsx.readFile(generatedPath);

  wbGen.worksheets.forEach((ws) => {
    console.log(`\n📄 Sheet: "${ws.name}" (Tổng dòng: ${ws.rowCount}, Tổng cột: ${ws.columnCount})`);
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
      if (vals.some((v) => v !== null && v !== undefined && v !== '')) {
        console.log(`  [Dòng ${r}]:`, JSON.stringify(vals));
      }
    }
  });
}

inspectBoth().catch(console.error);
