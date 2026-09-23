const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull_2', 'review_output');

const files = [
  'Thong ke so lot giao dich ACM 2026.xlsx',
  'Thong ke gia tri giao dich ACM 2026.xlsx',
  'Thong ke so lot giao dich 2026.xlsx',
  'Thong ke gia tri giao dich 2026.xlsx',
  'Thong ke so lot giao dich LME 2026.xlsx',
  'Thong ke gia tri giao dich LME 2026.xlsx',
];

console.log('=== CHI TIẾT SỐ LIỆU GHI VÀO EXCEL (NGÀY 17/09/2026) ===\n');

for (const f of files) {
  const p = path.join(outDir, f);
  if (!fs.existsSync(p)) continue;
  const wb = XLSX.readFile(p);
  console.log(`--- File: ${f} ---`);
  for (const sName of wb.SheetNames) {
    const ws = wb.Sheets[sName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log(`  Sheet: ${sName} (Tổng số dòng: ${data.length})`);
    for (let r = 0; r < Math.min(data.length, 25); r++) {
      const row = data[r];
      if (row && (row[0] === 17 || row[0] === '17' || String(row[0]).includes('17') || r >= 16 && r <= 22)) {
        const nonNulls = row.map((v, i) => (v !== undefined && v !== null && v !== '') ? `[Cột ${i}]: ${typeof v === 'number' ? v.toLocaleString('vi-VN') : v}` : null).filter(Boolean);
        if (nonNulls.length > 0) {
          console.log(`    Dòng ${r + 1}: ${nonNulls.slice(0, 8).join(' | ')}`);
        }
      }
    }
  }
  console.log('');
}
