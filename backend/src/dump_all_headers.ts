import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\root';
  const files = [
    { name: 'Thong ke so lot giao dich 2026 2 root.xlsx', label: 'Normal' },
    { name: 'Thong ke so lot giao dich ACM 2026 2 root.xlsx', label: 'ACM' },
    { name: 'Thong ke so lot giao dich LME 2026 root.xlsx', label: 'LME' },
    {
      name: 'Thong ke so lot giao dich Options 2026 root.xlsx',
      label: 'Options',
    },
    {
      name: 'Thong ke so lot giao dich Spread 2026 root.xlsx',
      label: 'Spread',
    },
  ];

  let out = '';
  for (const f of files) {
    const filePath = path.join(baseDir, f.name);
    if (!fs.existsSync(filePath)) {
      out += `File not found: ${filePath}\n`;
      continue;
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.worksheets[wb.worksheets.length - 1];
    out += `\n=========================================\n`;
    out += `${f.label} Tracker (Sheet: ${ws.name}, Rows: ${ws.rowCount}, Cols: ${ws.columnCount})\n`;
    out += `=========================================\n`;

    for (let c = 1; c <= ws.columnCount; c++) {
      const h4 = ws.getCell(4, c).value;
      const h3 = ws.getCell(3, c).value;
      const val16 = ws.getCell(16, c).value;
      if (h4 || val16) {
        out += `Col ${c}: H3=${JSON.stringify(h3)}, H4=${JSON.stringify(h4)}, Val16=${JSON.stringify(val16)}\n`;
      }
    }
  }

  fs.writeFileSync('../artifacts/headers_dump.txt', out);
  console.log('Headers dumped successfully!');
}

main().catch(console.error);
