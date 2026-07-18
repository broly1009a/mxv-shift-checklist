import * as ExcelJS from 'exceljs';

async function main() {
  const rootPath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\root\\Thong ke so lot giao dich 2026 2 root.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(rootPath);
  
  const ws = wb.worksheets[wb.worksheets.length - 1];
  console.log(`Sheet name: ${ws.name}`);

  console.log('Date | MS LME TTTT (Col 10) | CQG LME PS (Col 24)');
  console.log('------------------------------------------------');

  for (let r = 5; r <= ws.rowCount; r++) {
    const dateVal = ws.getCell(r, 2).value;
    if (!dateVal) continue;
    
    // Format date string
    let dateStr = '';
    if (dateVal instanceof Date) {
      dateStr = dateVal.toLocaleDateString('en-US');
    } else if (typeof dateVal === 'object' && dateVal !== null && 'result' in dateVal) {
      const res = dateVal.result;
      dateStr = res instanceof Date ? res.toLocaleDateString('en-US') : String(res);
    } else {
      dateStr = String(dateVal);
    }

    const cleanVal = (val: any) => {
      if (val && typeof val === 'object' && 'result' in val) return val.result;
      return val;
    };

    const col10 = cleanVal(ws.getCell(r, 10).value);
    const col24 = cleanVal(ws.getCell(r, 24).value);

    if (col10 !== 0 || col24 !== 0) {
      console.log(`${dateStr.padEnd(12)} | ${String(col10).padEnd(20)} | ${String(col24).padEnd(20)}`);
    }
  }
}

main().catch(console.error);
