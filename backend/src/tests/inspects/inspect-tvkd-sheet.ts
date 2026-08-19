import * as ExcelJS from 'exceljs';
import { toStr, toNum } from './modules/lot-statistics/helpers/excel-parser.helper';

async function main() {
  // Check the marco folder TVKD file (used in marco tool)
  const filePath = "c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Thong ke gia tri giao dich theo TVKD\\Thong ke gia tri giao dich 2026 theo TVKD.xlsx";
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log("Worksheets:", wb.worksheets.map(w => w.name));
  const ws = wb.worksheets[0];
  console.log(`Sheet: ${ws.name}, Row count: ${ws.rowCount}`);

  // Print row 4 (headers: col number -> TVKD code)
  const row4 = ws.getRow(4);
  const headers: {[col: number]: string} = {};
  row4.eachCell((c, colNum) => {
    const val = String(c.value ?? '').trim();
    const match = val.match(/\b(\d{3})\b/);
    if (match) {
      headers[colNum] = match[1];
    } else if (val) {
      headers[colNum] = val;
    }
  });
  console.log("Col -> TVKD mapping:", JSON.stringify(headers, null, 2));

  // Print all rows with data
  console.log("\nAll data rows:");
  for (let r = 5; r <= Math.min(ws.rowCount, 50); r++) {
    const dateVal = ws.getCell(r, 2).value;
    const dateStr = dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : toStr(dateVal as any);
    const sttVal = ws.getCell(r, 1).value;
    // Check if row has any numeric values
    let hasData = false;
    let rowTotal = 0;
    const rowValues: string[] = [];
    for (let col = 3; col <= 70; col++) {
      const numVal = toNum(ws.getCell(r, col).value as any);
      if (numVal && numVal > 0) {
        hasData = true;
        rowValues.push(`${headers[col] || 'c'+col}=${numVal.toLocaleString('en-US')}`);
        if (headers[col] && /^\d{3}$/.test(headers[col])) {
          rowTotal += numVal;
        }
      }
    }
    if (dateVal || sttVal || hasData) {
      console.log(`  Row ${r} [${dateStr || 'no date'}]: total=${rowTotal.toLocaleString('en-US')}`);
      if (hasData) {
        console.log(`    ${rowValues.slice(0, 10).join(', ')}${rowValues.length > 10 ? '...' : ''}`);
      }
    }
  }
}

main().catch(console.error);
