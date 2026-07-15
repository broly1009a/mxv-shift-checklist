import * as XLSX from 'xlsx';
import * as path from 'path';

const openPosPath = path.join(process.cwd(), 'temp', 'downloads', 'open_positions.xlsx');
const pendingOrdersPath = path.join(process.cwd(), 'temp', 'downloads', 'pending_orders.xlsx');

function searchExcel(filePath: string, label: string) {
  console.log(`\n=== SEARCHING ${label} ===`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const header = rows[0].map(h => String(h || '').trim());
  const symbolIdx = header.indexOf('Mã HĐ');
  const accountIdx = header.indexOf('Mã TKGD');
  const memberIdx = header.indexOf('Mã TVKD');
  
  const targets = ['MPOQ26', 'ZFTQ26', 'FEFN26'];
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const symbol = String(row[symbolIdx] || '').trim();
    if (targets.some(t => symbol.toUpperCase().includes(t))) {
      console.log(`Row ${i+1}: Symbol=${symbol}, Account=${row[accountIdx]}, Member=${row[memberIdx]}, RowData=${JSON.stringify(row)}`);
      count++;
    }
  }
  console.log(`Total matching rows found: ${count}`);
}

searchExcel(openPosPath, 'Open Positions');
searchExcel(pendingOrdersPath, 'Pending Orders');
