import * as ExcelJS from 'exceljs';

async function main() {
  const filePath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log('Worksheets:', wb.worksheets.map(w => w.name));

  const sheet1 = wb.worksheets.find(w => w.name.toLowerCase() === 'sheet1')!;
  const sheet2 = wb.worksheets.find(w => w.name.toLowerCase() === 'sheet2')!;

  console.log('--- SHEET2 CONFIG PATHS ---');
  for (let row = 1; row <= 40; row++) {
    const valA = sheet2.getCell(row, 1).value;
    if (valA) {
      if (typeof valA === 'object' && valA !== null) {
        console.log(`Row ${row}: A=${JSON.stringify(valA)}`);
      } else {
        console.log(`Row ${row}: A=${valA}`);
      }
    }
  }

  console.log('--- SHEET1 EXCHANGE RATES & TARGET DATE ---');
  console.log('D2 (Exchange rate Default):', sheet1.getCell('D2').value);
  console.log('D3 (Exchange rate TRU):', sheet1.getCell('D3').value);
  console.log('D4 (Exchange rate MPO):', sheet1.getCell('D4').value);
  console.log('G2 (Target Date):', sheet1.getCell('G2').value);

  console.log('--- SHEET1 CELL VALUES / FORMULAS ---');
  const printRange = (label: string, startRow: number, endRow: number, col: number) => {
    console.log(`\nRange ${label} (Col ${col}, Row ${startRow} to ${endRow}):`);
    for (let r = startRow; r <= endRow; r++) {
      const cell = sheet1.getCell(r, col);
      const val = cell.value;
      const display = typeof val === 'object' && val !== null ? JSON.stringify(val) : val;
      console.log(`  Row ${r}: ${display}`);
    }
  };

  console.log('--- HH SHEET ---');
  const hhSheet = wb.worksheets.find(w => w.name === 'HH')!;
  for (let r = 1; r <= 100; r++) {
    const rowVal = [
      hhSheet.getCell(r, 1).value,
      hhSheet.getCell(r, 2).value,
      hhSheet.getCell(r, 3).value
    ];
    if (rowVal.some(v => v !== null)) {
      console.log(`Row ${r}: ${JSON.stringify(rowVal)}`);
    }
  }

  console.log('--- Hhoa Vlookup SHEET ---');
  const hhoaVl = wb.worksheets.find(w => w.name === 'Hhoa Vlookup')!;
  for (let r = 1; r <= 100; r++) {
    const rowVal = [
      hhoaVl.getCell(r, 1).value,
      hhoaVl.getCell(r, 2).value,
      hhoaVl.getCell(r, 3).value,
      hhoaVl.getCell(r, 4).value
    ];
    if (rowVal.some(v => v !== null)) {
      console.log(`Row ${r}: ${JSON.stringify(rowVal)}`);
    }
  }




}

main().catch(console.error);
