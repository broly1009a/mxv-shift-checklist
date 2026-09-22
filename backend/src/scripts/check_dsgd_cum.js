const XLSX = require('xlsx');
const path = require('path');

const p = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull_2', 'review_output', 'DSGD T09.2026 CCP.xlsx');
const wb = XLSX.readFile(p);
console.log('Sheets in DSGD cumulative:', wb.SheetNames);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log('Total rows in DSGD cumulative:', data.length);
console.log('First data row:', data[1]);
console.log('Last data row:', data[data.length - 1]);
