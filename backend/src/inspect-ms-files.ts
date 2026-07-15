import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

function inspectFile(filePath: string, label: string) {
  console.log(`\n=================== INSPECTING ${label} ===================`);
  console.log(`Path: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.log('❌ File does not exist!');
    return;
  }
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  console.log(`Sheet Name: ${sheetName}`);
  console.log(`Total Rows: ${rows.length}`);
  if (rows.length > 0) {
    console.log('Headers (Row 1):', rows[0]);
  }
  for (let i = 1; i < Math.min(rows.length, 5); i++) {
    console.log(`Row ${i + 1}:`, rows[i]);
  }
}

const openPosPath = path.join(process.cwd(), 'temp', 'downloads', 'open_positions.xlsx');
const pendingOrdersPath = path.join(process.cwd(), 'temp', 'downloads', 'pending_orders.xlsx');

inspectFile(openPosPath, 'Open Positions');
inspectFile(pendingOrdersPath, 'Pending Orders');
