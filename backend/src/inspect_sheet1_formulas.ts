import * as ExcelJS from 'exceljs';

async function main() {
  const filePath =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheet1 = wb.worksheets.find((w) => w.name.toLowerCase() === 'sheet1')!;

  const getCellDetails = (cell: ExcelJS.Cell) => {
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object' && val !== null) {
      if ('formula' in val) {
        return `[Formula: ${val.formula} | Result: ${JSON.stringify(val.result)}]`;
      }
      return JSON.stringify(val);
    }
    return String(val);
  };

  console.log('--- INSPECTING SHEET1 FORMULAS ---');

  console.log('\n--- Range L11:L77 ---');
  for (let r = 11; r <= 77; r++) {
    const cellL = sheet1.getCell(r, 12);
    const cellK = sheet1.getCell(r, 11);
    console.log(
      `L${r} (Label ${getCellDetails(cellK)}): ${getCellDetails(cellL)}`,
    );
  }

  console.log('\n--- Range N12:N20 ---');
  for (let r = 12; r <= 20; r++) {
    const cellN = sheet1.getCell(r, 14);
    const cellM = sheet1.getCell(r, 13);
    console.log(
      `N${r} (Label ${getCellDetails(cellM)}): ${getCellDetails(cellN)}`,
    );
  }

  console.log('\n--- Range L69:L77 ---');
  for (let r = 69; r <= 77; r++) {
    const cellL = sheet1.getCell(r, 12);
    const cellK = sheet1.getCell(r, 11);
    console.log(
      `L${r} (Label ${getCellDetails(cellK)}): ${getCellDetails(cellL)}`,
    );
  }

  console.log('\n--- Range O11:O26 ---');
  for (let r = 11; r <= 26; r++) {
    const cellO = sheet1.getCell(r, 15);
    const cellN = sheet1.getCell(r, 14); // Label in column N or M?
    console.log(`O${r}: ${getCellDetails(cellO)}`);
  }

  console.log('\n--- Range T11:T13 ---');
  for (let r = 11; r <= 13; r++) {
    const cellT = sheet1.getCell(r, 20);
    const cellS = sheet1.getCell(r, 19);
    console.log(
      `T${r} (Label ${getCellDetails(cellS)}): ${getCellDetails(cellT)}`,
    );
  }
}

main().catch(console.error);
