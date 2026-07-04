const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'temp', 'debug', 'ms-prices-test', 'trang-thai-mo.xlsx');

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const headers = data[0];
const contractIndex = headers.indexOf('Mã HĐ');
console.log('Contract Code Column Index:', contractIndex);

if (contractIndex === -1) {
  console.error('Column "Mã HĐ" not found!');
  process.exit(1);
}

const uniqueContracts = new Set();
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  if (row && row[contractIndex]) {
    uniqueContracts.add(row[contractIndex].toString().trim());
  }
}

console.log('Total Unique Contracts:', uniqueContracts.size);
console.log('Unique Contracts List:', Array.from(uniqueContracts).sort());
