import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';


async function checkExcel() {
  const filePath = path.join(__dirname, '../../../POC/TKGD-Automation/inputs/excel-templates/Auto Data mail.xlsm');
  console.log('Kiểm tra template gốc MXV:', filePath);

  console.log('File tồn tại:', fs.existsSync(filePath));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log('\nCác sheet có trong file:');
  wb.worksheets.forEach((sheet) => {
    console.log(`\n📄 Sheet: "${sheet.name}" (Số dòng: ${sheet.rowCount})`);
    for (let r = 1; r <= Math.min(sheet.rowCount, 4); r++) {
      const row = sheet.getRow(r);
      const values = Array.isArray(row.values) ? row.values.slice(1, 13) : [];
      console.log(`  [Dòng ${r}]:`, JSON.stringify(values));
    }
  });
}

checkExcel().catch(console.error);
