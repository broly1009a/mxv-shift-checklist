import * as ExcelJS from 'exceljs';

async function main() {
  const rootPath =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\root\\Thong ke so lot giao dich LME 2026 root.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(rootPath);

  const ws = wb.worksheets[wb.worksheets.length - 1];
  console.log(`Sheet name: ${ws.name}`);

  const targetDate = new Date(2026, 6, 16); // July 16
  const isSameDate = (cellVal: any) => {
    if (cellVal === null || cellVal === undefined) return false;
    let d: Date | null = null;
    if (cellVal instanceof Date) {
      d = cellVal;
    } else if (
      typeof cellVal === 'object' &&
      cellVal !== null &&
      'result' in cellVal
    ) {
      return isSameDate(cellVal.result);
    } else {
      const parsed = new Date(String(cellVal).trim());
      if (!isNaN(parsed.getTime())) d = parsed;
    }
    if (!d) return false;
    return (
      d.getFullYear() === targetDate.getFullYear() &&
      d.getMonth() === targetDate.getMonth() &&
      d.getDate() === targetDate.getDate()
    );
  };

  let foundRowIdx = -1;
  for (let r = 5; r <= ws.rowCount; r++) {
    if (isSameDate(ws.getCell(r, 2).value)) {
      foundRowIdx = r;
      break;
    }
  }

  if (foundRowIdx === -1) {
    console.log('Row for 16-Jul-2026 not found');
    return;
  }

  console.log(`Found 16-Jul-2026 at row ${foundRowIdx}`);
  const row = ws.getRow(foundRowIdx);

  // Print all non-empty columns
  for (let c = 1; c <= ws.columnCount; c++) {
    const val = row.getCell(c).value;
    if (val !== null && val !== undefined) {
      console.log(
        `Col ${c} (${ws.getCell(4, c).value || ''}): ${JSON.stringify(val)}`,
      );
    }
  }
}

main().catch(console.error);
