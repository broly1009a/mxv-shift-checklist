const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '../../it-tool-src/margin-checker/margin-checker/bin/Debug/Configuration/Commodity.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

const formulas = new Set();
data.forEach(r => {
  const f = r['Công thức'] || r['Công thức '];
  if (f) formulas.add(f.trim());
});

console.log('Unique Formulas:');
console.log(Array.from(formulas));
