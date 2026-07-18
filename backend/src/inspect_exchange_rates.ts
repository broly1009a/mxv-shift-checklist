import * as ExcelJS from 'exceljs';

async function main() {
  const filePath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheet1 = wb.worksheets.find(w => w.name.toLowerCase() === 'sheet1')!;
  console.log('D2 (Exchange rate Default):', sheet1.getCell('D2').value);
  console.log('D3 (Exchange rate TRU):', sheet1.getCell('D3').value);
  console.log('D4 (Exchange rate MPO):', sheet1.getCell('D4').value);
  console.log('G2 (Target Date):', sheet1.getCell('G2').value);
}
main().catch(console.error);
