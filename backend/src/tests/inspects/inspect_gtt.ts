import * as ExcelJS from 'exceljs';

async function main() {
  const filePath =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\GTT.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log(
    'Worksheets:',
    wb.worksheets.map((w) => w.name),
  );
  const ws = wb.worksheets[0];
  console.log('Row 4 values:', ws.getRow(4).values);
  console.log('Row 5 values:', ws.getRow(5).values);
  console.log('Row 6 values:', ws.getRow(6).values);
  console.log('Row 7 values:', ws.getRow(7).values);
  console.log('Row 8 values:', ws.getRow(8).values);
}
main().catch(console.error);
