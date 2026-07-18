import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function inspect() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const rootDir = path.join(baseDir, 'root');

  const files = [
    { gen: path.join(baseDir, 'Thong ke so lot giao dich ACM 2026 2.xlsx'), root: path.join(rootDir, 'Thong ke so lot giao dich ACM 2026 2 root.xlsx') }
  ];

  for (const f of files) {
    const wbGen = new ExcelJS.Workbook();
    await wbGen.xlsx.readFile(f.gen);
    const wsGen = wbGen.getWorksheet('T07.2026')!;

    const wbRoot = new ExcelJS.Workbook();
    await wbRoot.xlsx.readFile(f.root);
    const wsRoot = wbRoot.getWorksheet('T07.2026')!;

    console.log('=== LME GEN Row 16 vs ROOT Row 16 ===');
    for (let c = 1; c <= Math.max(wsGen.columnCount, wsRoot.columnCount); c++) {
      const hGen = wsGen.getCell(4, c).value;
      const hRoot = wsRoot.getCell(4, c).value;
      const vGen = wsGen.getCell(16, c).value;
      const vRoot = wsRoot.getCell(16, c).value;
      if (vGen !== null || vRoot !== null) {
        console.log(`Col ${c}: HeaderGen=${JSON.stringify(hGen)}, HeaderRoot=${JSON.stringify(hRoot)} | Gen=${JSON.stringify(vGen)}, Root=${JSON.stringify(vRoot)}`);
      }
    }
  }
}

inspect().catch(console.error);
