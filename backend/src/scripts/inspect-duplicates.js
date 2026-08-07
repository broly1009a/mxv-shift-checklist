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
const rows = XLSX.utils.sheet_to_json(sheet);

console.log('--- DUPLICATE AND CURRENCY ANALYSIS ---');
console.log('Total data rows:', rows.length);

const currencies = new Set();
const accounts = new Map();

rows.forEach(r => {
  const currency = r['Currency'];
  currencies.add(currency);

  const acc = r['Account Number'];
  if (!accounts.has(acc)) {
    accounts.set(acc, []);
  }
  accounts.get(acc).push(r);
});

console.log('Distinct Currencies:', Array.from(currencies));
console.log('Distinct Accounts:', accounts.size);

// Find accounts with more than 1 row
const duplicateAccounts = Array.from(accounts.entries()).filter(([acc, list]) => list.length > 1);
console.log(`Number of accounts with multiple rows: ${duplicateAccounts.length}`);

if (duplicateAccounts.length > 0) {
  console.log('\nExample duplicate account:', duplicateAccounts[0][0]);
  duplicateAccounts[0][1].forEach((r, idx) => {
    console.log(`Row ${idx + 1}:`, r);
  });
}
