const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

const baseDir = path.resolve(__dirname, '../../../Thong ke ccp');
console.log('=== Base Dir ===', baseDir);

const inputDir = path.join(baseDir, 'input');
const outputDir = path.join(baseDir, 'output');

console.log('\n--- INPUT FILES ---');
if (fs.existsSync(inputDir)) {
  const files = fs.readdirSync(inputDir);
  for (const f of files) {
    const filePath = path.join(inputDir, f);
    const wb = XLSX.readFile(filePath);
    console.log(`\n[Input File]: ${f}`);
    console.log(`Sheets:`, wb.SheetNames);
    for (const sName of wb.SheetNames) {
      const sheet = wb.Sheets[sName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      console.log(`  Sheet "${sName}": ${rows.length} rows`);
      if (rows.length > 0) {
        console.log(`    Header (row 0):`, rows[0]);
      }
      if (rows.length > 1) {
        console.log(`    Row 1:`, rows[1]);
      }
    }
  }
}

console.log('\n--- OUTPUT FILES ---');
if (fs.existsSync(outputDir)) {
  const files = fs.readdirSync(outputDir);
  for (const f of files) {
    const filePath = path.join(outputDir, f);
    const wb = XLSX.readFile(filePath);
    console.log(`\n[Output File]: ${f}`);
    console.log(`Sheets:`, wb.SheetNames);
    for (const sName of wb.SheetNames.slice(0, 3)) {
      const sheet = wb.Sheets[sName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      console.log(`  Sheet "${sName}": ${rows.length} rows`);
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        console.log(`    Row ${i}:`, (rows[i] || []).slice(0, 10));
      }
    }
  }
}
