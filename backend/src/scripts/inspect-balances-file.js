const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures\\2026\\T08.2026\\07.08\\Accounts_Balances.xlsx';

if (!fs.existsSync(filePath)) {
  console.log(`File not found: ${filePath}`);
  process.exit(1);
}

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- INSPECTING ACCOUNTS_BALANCES.XLSX ---');
console.log('Number of rows:', rows.length);

if (rows.length > 0) {
  console.log('Header:', rows[0]);
}

// Print first 5 data rows
console.log('First 5 rows:');
for (let i = 1; i < Math.min(6, rows.length); i++) {
  console.log(`[Row ${i}]`, rows[i]);
}

// Find distinct values in "Record Description" column
const header = rows[0].map(h => String(h || '').trim());
const descIdx = header.indexOf('Record Description');
if (descIdx !== -1) {
  const descriptions = new Set();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] && rows[i][descIdx] !== undefined) {
      descriptions.add(String(rows[i][descIdx]).trim());
    }
  }
  console.log('\nDistinct "Record Description" values:', Array.from(descriptions));
} else {
  console.log('\n"Record Description" column not found in header.');
}
