import * as ExcelJS from 'exceljs';

async function main() {
  const filePath =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const hhWs = wb.worksheets.find((w) => w.name.toLowerCase() === 'hh')!;
  console.log('HH Sheet (first 20 rows):');
  for (let r = 1; r <= 20; r++) {
    const row = hhWs.getRow(r).values as any[];
    console.log(`Row ${r}:`, row.slice(1, 4));
  }

  const vlookupWs = wb.worksheets.find(
    (w) => w.name.toLowerCase() === 'hhoa vlookup',
  )!;
  console.log('\nHhoa Vlookup Sheet (first 20 rows):');
  for (let r = 1; r <= 20; r++) {
    const row = vlookupWs.getRow(r).values as any[];
    console.log(`Row ${r}:`, row.slice(1, 4));
  }
}
main().catch(console.error);
