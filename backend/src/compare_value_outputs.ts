import * as ExcelJS from 'exceljs';
import * as path from 'path';

function isSameDate(cellVal: any, targetDate: Date): boolean {
  if (cellVal === null || cellVal === undefined) return false;
  let d: Date | null = null;
  if (cellVal instanceof Date) {
    d = cellVal;
  } else if (typeof cellVal === 'object' && cellVal !== null) {
    if ('result' in cellVal) {
      return isSameDate(cellVal.result, targetDate);
    }
  } else {
    const str = String(cellVal).trim();
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }
  if (!d) return false;
  return (
    d.getFullYear() === targetDate.getFullYear() &&
    d.getMonth() === targetDate.getMonth() &&
    d.getDate() === targetDate.getDate()
  );
}

async function compareFiles() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke gia tri';
  const rootDir = path.join(baseDir, 'root');
  const targetDate = new Date(2026, 6, 16); // 16-Jul-2026

  const filesToCompare = [
    { name: 'Thong ke gia tri giao dich 2026 1.xlsx', rootName: 'Thong ke gia tri giao dich 2026 1.xlsx' },
    { name: 'Thong ke gia tri giao dich ACM 2026 1.xlsx', rootName: 'Thong ke gia tri giao dich ACM 2026 1.xlsx' },
    { name: 'Thong ke gia tri giao dich LME 2026.xlsx', rootName: 'Thong ke gia tri giao dich LME 2026.xlsx' },
    { name: 'Thong ke gia tri giao dich Options 2026.xlsx', rootName: 'Thong ke gia tri giao dich Options 2026.xlsx' },
    { name: 'Thong ke gia tri giao dich Spread 2026.xlsx', rootName: 'Thong ke gia tri giao dich Spread 2026.xlsx' },
  ];

  for (const item of filesToCompare) {
    console.log(`\n=== Comparing ${item.name} ===`);
    const pathGen = path.join(baseDir, item.name);
    const pathRoot = path.join(rootDir, item.rootName);

    const wbGen = new ExcelJS.Workbook();
    const wbRoot = new ExcelJS.Workbook();

    await wbGen.xlsx.readFile(pathGen);
    await wbRoot.xlsx.readFile(pathRoot);

    const findWs = (wb: ExcelJS.Workbook) => {
      return wb.worksheets.find(s => s.name === 'T07.2026' || s.name === 'T7.2026') || wb.worksheets[wb.worksheets.length - 1];
    };

    const wsGen = findWs(wbGen);
    const wsRoot = findWs(wbRoot);

    console.log(`Sheet Gen: ${wsGen.name} (${wsGen.rowCount} rows), Sheet Root: ${wsRoot.name} (${wsRoot.rowCount} rows)`);

    let rowGenIdx = -1;
    let rowRootIdx = -1;

    const dateCol = 1;
    const startRow = 6;

    for (let r = startRow; r <= wsGen.rowCount; r++) {
      const v = wsGen.getCell(r, dateCol).value;
      if (isSameDate(v, targetDate)) {
        rowGenIdx = r;
        break;
      }
    }

    for (let r = startRow; r <= wsRoot.rowCount; r++) {
      const v = wsRoot.getCell(r, dateCol).value;
      if (isSameDate(v, targetDate)) {
        rowRootIdx = r;
        break;
      }
    }

    if (rowGenIdx === -1 || rowRootIdx === -1) {
      console.log(`[WARN] Could not find row for 16-Jul-2026. GenRow: ${rowGenIdx}, RootRow: ${rowRootIdx}`);
      continue;
    }

    console.log(`Found 16-Jul-2026 at Gen Row ${rowGenIdx}, Root Row ${rowRootIdx}`);
    const rowGen = wsGen.getRow(rowGenIdx);
    const rowRoot = wsRoot.getRow(rowRootIdx);

    let diffCount = 0;
    const maxCols = Math.max(rowGen.cellCount, rowRoot.cellCount);
    for (let c = 1; c <= maxCols; c++) {
      const valGen = rowGen.getCell(c).value;
      const valRoot = rowRoot.getCell(c).value;

      const isFormula = (val: any) => {
        return val && typeof val === 'object' && ('formula' in val || 'sharedFormula' in val);
      };

      if (isFormula(valGen) || isFormula(valRoot)) {
        continue;
      }

      const cleanVal = (val: any) => {
        if (val && typeof val === 'object' && 'result' in val) return val.result;
        return val;
      };

      const cg = cleanVal(valGen);
      const cr = cleanVal(valRoot);

      const getNum = (v: any) => {
        if (v === null || v === undefined) return 0;
        if (typeof v === 'number') return v;
        const p = parseFloat(String(v).replace(/,/g, ''));
        return isNaN(p) ? 0 : p;
      };

      const numGen = getNum(cg);
      const numRoot = getNum(cr);

      if (Math.abs(numGen - numRoot) > 1e-2) {
        diffCount++;
        const header = wsRoot.getCell(5, c).value || wsRoot.getCell(4, c).value || `Col ${c}`;
        console.log(`Col ${c} (${header}): Gen=${JSON.stringify(cg)}, Root=${JSON.stringify(cr)}`);
      }
    }
    console.log(`Total differences in 16-Jul-2026 row: ${diffCount}`);
  }
}

compareFiles().catch(console.error);
