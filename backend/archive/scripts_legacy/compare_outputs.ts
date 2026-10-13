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
  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const rootDir = path.join(baseDir, 'root');
  const targetDate = new Date(2026, 6, 16); // 16-Jul-2026

  const filesToCompare = [
    { name: 'DSGD T07.2026.xlsx', rootName: 'DSGD T07.2026 root.xlsx' },
    {
      name: 'Thong ke so lot giao dich 2026 2.xlsx',
      rootName: 'Thong ke so lot giao dich 2026 2 root.xlsx',
    },
    {
      name: 'Thong ke so lot giao dich ACM 2026 2.xlsx',
      rootName: 'Thong ke so lot giao dich ACM 2026 2 root.xlsx',
    },
    {
      name: 'Thong ke so lot giao dich LME 2026.xlsx',
      rootName: 'Thong ke so lot giao dich LME 2026 root.xlsx',
    },
    {
      name: 'Thong ke so lot giao dich Options 2026.xlsx',
      rootName: 'Thong ke so lot giao dich Options 2026 root.xlsx',
    },
    {
      name: 'Thong ke so lot giao dich Spread 2026.xlsx',
      rootName: 'Thong ke so lot giao dich Spread 2026 root.xlsx',
    },
  ];

  for (const item of filesToCompare) {
    console.log(`\n=== Comparing ${item.name} ===`);
    const pathGen = path.join(baseDir, item.name);
    const pathRoot = path.join(rootDir, item.rootName);

    const wbGen = new ExcelJS.Workbook();
    const wbRoot = new ExcelJS.Workbook();

    await wbGen.xlsx.readFile(pathGen);
    await wbRoot.xlsx.readFile(pathRoot);

    const wsGen = wbGen.worksheets[wbGen.worksheets.length - 1];
    const wsRoot = wbRoot.worksheets[wbRoot.worksheets.length - 1];

    console.log(
      `Sheet Gen: ${wsGen.name} (${wsGen.rowCount} rows), Sheet Root: ${wsRoot.name} (${wsRoot.rowCount} rows)`,
    );

    // Let's find Row for 16-Jul-2026 in both
    let rowGenIdx = -1;
    let rowRootIdx = -1;

    const dateCol = item.name.startsWith('DSGD') ? 23 : 2;
    const startRow = item.name.startsWith('DSGD') ? 2 : 5;

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
      console.log(
        `[WARN] Could not find row for 16-Jul-2026. GenRow: ${rowGenIdx}, RootRow: ${rowRootIdx}`,
      );
      continue;
    }

    console.log(
      `Found 16-Jul-2026 at Gen Row ${rowGenIdx}, Root Row ${rowRootIdx}`,
    );
    const rowGen = wsGen.getRow(rowGenIdx);
    const rowRoot = wsRoot.getRow(rowRootIdx);

    let diffCount = 0;
    const maxCols = Math.max(rowGen.cellCount, rowRoot.cellCount);
    for (let c = 1; c <= maxCols; c++) {
      const valGen = rowGen.getCell(c).value;
      const valRoot = rowRoot.getCell(c).value;

      // Check if a cell is a formula cell
      const isFormula = (val: any) => {
        return (
          val &&
          typeof val === 'object' &&
          ('formula' in val || 'sharedFormula' in val)
        );
      };

      if (isFormula(valGen) || isFormula(valRoot)) {
        continue; // Skip formula cells because Excel recalculates them when opened
      }

      const cleanVal = (val: any) => {
        if (val && typeof val === 'object' && 'result' in val)
          return val.result;
        return val;
      };

      const cg = cleanVal(valGen);
      const cr = cleanVal(valRoot);

      const strGen = cg !== null && cg !== undefined ? String(cg).trim() : '';
      const strRoot = cr !== null && cr !== undefined ? String(cr).trim() : '';

      if (strGen !== strRoot) {
        diffCount++;
        const headerRowIndex = item.name.startsWith('DSGD') ? 1 : 4;
        const header = wsRoot.getCell(headerRowIndex, c).value;
        console.log(
          `Col ${c} (${header}): Gen=${JSON.stringify(cg)}, Root=${JSON.stringify(cr)}`,
        );
      }
    }
    console.log(`Total differences in 16-Jul-2026 row: ${diffCount}`);
  }
}

compareFiles().catch(console.error);
