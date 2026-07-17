import * as ExcelJS from 'exceljs';

async function main() {
  const filePath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log('Worksheets in Macro workbook:', wb.worksheets.map(w => w.name));

  const sheet1 = wb.worksheets.find(w => w.name.toLowerCase() === 'sheet1')!;
  console.log('\nSheet1 columns J, K, L (rows 10-15):');
  for (let r = 10; r <= 15; r++) {
    console.log(`Row ${r}:`, {
      J: sheet1.getCell(`J${r}`).value,
      K: sheet1.getCell(`K${r}`).value,
      L: sheet1.getCell(`L${r}`).value,
    });
  }

  console.log('\nSheet1 columns N, O, P (rows 10-15):');
  for (let r = 10; r <= 15; r++) {
    console.log(`Row ${r}:`, {
      N: sheet1.getCell(`N${r}`).value,
      O: sheet1.getCell(`O${r}`).value,
      P: sheet1.getCell(`P${r}`).value,
    });
  }

  console.log('\nSheet1 columns R, S, T (rows 10-15):');
  for (let r = 10; r <= 15; r++) {
    console.log(`Row ${r}:`, {
      R: sheet1.getCell(`R${r}`).value,
      S: sheet1.getCell(`S${r}`).value,
      T: sheet1.getCell(`T${r}`).value,
    });
  }
}
main().catch(console.error);
