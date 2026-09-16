const path = require('path');
const XLSX = require('xlsx');

const filePath = path.resolve(__dirname, '../../../Thong ke ccp/output/Thong ke so lot giao dich ACM 2026.xlsx');
const wb = XLSX.readFile(filePath);

for (const sName of wb.SheetNames) {
  console.log(`\n=== Sheet: ${sName} ===`);
  const sheet = wb.Sheets[sName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Total rows: ${rows.length}`);
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i]));
  }
}
