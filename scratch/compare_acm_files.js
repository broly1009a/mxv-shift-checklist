const path = require('path');
const ExcelJS = require('../backend/node_modules/exceljs');

const targetDir = path.resolve(__dirname, '..', 'Bao cao - Thong ke');

async function compareAcmFiles() {
  const pairs = [
    ['Thong ke so lot giao dich ACM 2026 (trên CCP).xlsx', 'Thong ke so lot giao dich ACM 2026.xlsx'],
    ['Thong ke gia tri giao dich ACM 2026 (Theo CCP).xlsx', 'Thong ke gia tri giao dich ACM 2026.xlsx']
  ];

  for (const [f1, f2] of pairs) {
    console.log(`\n======================================================`);
    console.log(`COMPARING: \n  (A) ${f1}\n  (B) ${f2}`);
    console.log(`======================================================`);

    const wb1 = new ExcelJS.Workbook();
    await wb1.xlsx.readFile(path.join(targetDir, f1));
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile(path.join(targetDir, f2));

    console.log(`(A) Sheets:`, wb1.worksheets.map(w => w.name));
    console.log(`(B) Sheets:`, wb2.worksheets.map(w => w.name));

    const s1 = wb1.getWorksheet('T10.2026') || wb1.worksheets[1] || wb1.worksheets[0];
    const s2 = wb2.getWorksheet('T10.2026') || wb2.worksheets[1] || wb2.worksheets[0];

    console.log(`\n(A) Sheet "${s1.name}": ${s1.rowCount} rows, ${s1.columnCount} cols`);
    for (let r = 1; r <= 5; r++) {
      const vals = [];
      for (let c = 1; c <= Math.min(s1.columnCount, 12); c++) {
        let v = s1.getRow(r).getCell(c).value;
        if (v && typeof v === 'object' && v.result) v = v.result;
        vals.push(`[${c}] ${String(v||'').trim()}`);
      }
      console.log(`  R${r}: ${vals.join(' | ')}`);
    }

    console.log(`\n(B) Sheet "${s2.name}": ${s2.rowCount} rows, ${s2.columnCount} cols`);
    for (let r = 1; r <= 5; r++) {
      const vals = [];
      for (let c = 1; c <= Math.min(s2.columnCount, 12); c++) {
        let v = s2.getRow(r).getCell(c).value;
        if (v && typeof v === 'object' && v.result) v = v.result;
        vals.push(`[${c}] ${String(v||'').trim()}`);
      }
      console.log(`  R${r}: ${vals.join(' | ')}`);
    }
  }
}

compareAcmFiles().catch(console.error);
