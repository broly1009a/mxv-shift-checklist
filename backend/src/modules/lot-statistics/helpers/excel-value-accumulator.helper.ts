import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import {
  isSameDate,
  getSheetName,
  ensureDirExists,
} from './excel-accumulator.helper';

import { ensureBaseFileExists } from '../../../common/file-guard.helper';

// ─── Commodity Code Mappings matching Sheet1 ranges ─────────────────────────

export const NORMAL_COMMODITIES = [
  'ZLE',
  'ZCE',
  'C.ZCE',
  'P.ZCE',
  'ZSE',
  'C.ZSE',
  'P.ZSE',
  'ZME',
  'ZWA',
  'C.ZWA',
  'P.ZWA',
  'KWE',
  'ZRE',
  'XW',
  'XC',
  'XB',
  'MZW',
  'MZC',
  'MZS',
  'MZL',
  'MZM',
  'CCE',
  'CTE',
  'KCE',
  'C.KCE',
  'P.KCE',
  'SBE',
  'C.SBE',
  'P.SBE',
  'LRC',
  'QW',
  'MPO',
  'TRU',
  'ZFT',
  'ALI',
  'CPE',
  'MQC',
  'MHG',
  'SIE',
  'MQI',
  'SIL',
  'PLE',
  'FEF',
  'CLE',
  'C.CLE',
  'P.CLE',
  'NGE',
  'C.NGE',
  'P.NGE',
  'NQM',
  'RBE',
  'QO',
  'C.QO',
  'P.QO',
  'QP',
  'MCLE',
  'NQG',
  'BM',
  'CAD',
  'AHD',
  'PBD',
  'SND',
  'ZDS',
  'NID',
  'SSC',
  'SSR',
  'LHC',
];

export const SPREAD_COMMODITIES = [
  'ZSE',
  'C.ZCE',
  'ZLE',
  'ZCE',
  'P.ZCE',
  'ZRE',
  'XC',
  'TRU',
  'MHG',
];

export const LME_COMMODITIES = [
  'CAD',
  'AHD',
  'PBD',
  'SND',
  'ZDS',
  'NID',
  'SSC',
  'SSR',
  'LHC',
];

export const OPTIONS_COMMODITIES = [
  'C.ZCE',
  'P.ZCE',
  'C.ZSE',
  'P.ZSE',
  'C.ZWA',
  'P.ZWA',
  'C.KCE',
  'P.KCE',
  'C.SBE',
  'P.SBE',
  'C.CLE',
  'P.CLE',
  'C.NGE',
  'P.NGE',
  'C.QO',
  'P.QO',
];

export const ACM_COMMODITIES = ['SI5CO', 'PL1NY', 'CP2CO'];

export interface ValueAccumulatorPaths {
  pathNormal: string; // Thong ke gia tri giao dich 2026.xlsx
  pathSpread: string; // Thong ke gia tri giao dich Spread 2026.xlsx
  pathLme: string; // Thong ke gia tri giao dich LME 2026.xlsx
  pathOptions: string; // Thong ke gia tri giao dich Options 2026.xlsx
  pathAcm: string; // Thong ke gia tri giao dich ACM 2026.xlsx
  pathTvkd?: string; // Thong ke gia tri giao dich theo TVKD 2026.xlsx
}

/**
 * Value statistics specific target row finder.
 * Assumes Date is in Column A (1) and there is no STT column.
 */
function getNextWorkday(d: Date): Date {
  const next = new Date(d);
  do {
    next.setDate(next.getDate() + 1);
  } while (next.getDay() === 0 || next.getDay() === 6);
  return next;
}

export function findOrCreateValueTargetRow(
  ws: ExcelJS.Worksheet,
  ngayGD: Date,
): number {
  let targetRowIndex = -1;
  let tongRowIndex = -1;
  let currentCalculatedDate: Date | null = null;

  for (let r = 6; r <= ws.rowCount; r++) {
    const dateCellVal = ws.getCell(r, 1).value;

    const dateStr =
      dateCellVal !== null && dateCellVal !== undefined
        ? String(dateCellVal).trim().toLowerCase()
        : '';

    if (dateStr === 'tổng') {
      tongRowIndex = r;
      break;
    }

    let rowDateVal: any = dateCellVal;
    if (dateCellVal instanceof Date) {
      currentCalculatedDate = new Date(dateCellVal);
    } else if (typeof dateCellVal === 'object' && dateCellVal !== null && (dateCellVal as any).result) {
      const res = (dateCellVal as any).result;
      if (res instanceof Date || !isNaN(new Date(res).getTime())) {
        currentCalculatedDate = new Date(res);
      }
    } else if (currentCalculatedDate) {
      currentCalculatedDate = getNextWorkday(currentCalculatedDate);
      rowDateVal = currentCalculatedDate;
    }

    if (isSameDate(rowDateVal, ngayGD)) {
      targetRowIndex = r;
      break;
    }
  }

  if (targetRowIndex === -1) {
    if (tongRowIndex !== -1) {
      ws.insertRow(tongRowIndex, []);
      targetRowIndex = tongRowIndex;
    } else {
      let lastContentRow = 5;
      for (let r = 6; r <= ws.rowCount; r++) {
        const c1 = ws.getCell(r, 1).value;
        if (c1 !== null && c1 !== undefined && c1 !== '') {
          lastContentRow = r;
        }
      }
      targetRowIndex = lastContentRow + 1;
    }

    // Set Date in Column A
    ws.getCell(targetRowIndex, 1).value = ngayGD;
    ws.getCell(targetRowIndex, 1).numFmt = 'yyyy-mm-dd';
  }

  return targetRowIndex;
}

/**
 * Fix shared formula references to avoid exceljs writing crashes
 */
function fixSharedFormulas(ws: ExcelJS.Worksheet) {
  const masters = new Set<string>();
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Formula) {
        const val = cell.value as any;
        if (val && val.shareType === 'shared' && val.ref) {
          masters.add(cell.address);
        }
      }
    });
  });

  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Formula) {
        const val = cell.value as any;
        if (val && val.sharedFormula && !masters.has(val.sharedFormula)) {
          if (val.result !== undefined && val.result !== null) {
            cell.value = val.result;
          } else {
            cell.value = null;
          }
        }
      }
    });
  });
}

/**
 * Helper to update a target value tracker file.
 * Loops through the given order of commodities, gets their values from the map,
 * and writes them starting at Column B (2).
 */
async function updateValueTrackerFile(
  filePath: string,
  ngayGD: Date,
  commodities: string[],
  valueMap: Map<string, number>,
  fileType: string,
) {
  ensureBaseFileExists(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File lũy kế ${fileType} không tồn tại: "${filePath}"`);
  }

  // ─── Tự động tạo bản sao lưu trước khi sửa đổi (Backup Snapshot) ───────────
  try {
    const fileDir = path.dirname(filePath);
    const backupDir = path.join(fileDir, 'Backup_Snapshots');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date()
      .toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');
    const baseName = path.basename(filePath, path.extname(filePath));
    const extName = path.extname(filePath);
    const backupPath = path.join(
      backupDir,
      `${baseName}_backup_${timestamp}${extName}`,
    );
    fs.copyFileSync(filePath, backupPath);
  } catch (err: any) {
    console.warn(
      `[WARN] Không thể tự động tạo file sao lưu cho ${fileType}: ${err.message}`,
    );
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheetName = getSheetName(path.basename(filePath), ngayGD);
  let ws = wb.getWorksheet(sheetName);
  if (!ws) {
    throw new Error(
      `File "${path.basename(filePath)}" chưa có Sheet "${sheetName}". Vui lòng tạo/copy Sheet "${sheetName}" trong tệp Excel trước khi chạy dữ liệu tháng này.`,
    );
  }

  const targetRowIndex = findOrCreateValueTargetRow(ws, ngayGD);

  // Write values starting at column 2 (Column B)
  for (let i = 0; i < commodities.length; i++) {
    const code = commodities[i];
    const val = valueMap.get(code) || 0;
    ws.getCell(targetRowIndex, 2 + i).value = val;
  }

  // LME specific step in VBA: ws2.Range("M1").Delete (clears a temporary label if any)
  if (fileType === 'LME') {
    ws.getCell(1, 13).value = null; // Cell M1
  }

  // Clean up shared formula issues on save
  for (const sheet of wb.worksheets) {
    fixSharedFormulas(sheet);
  }

  await wb.xlsx.writeFile(filePath);
}

/**
 * Helper to update cumulative TVKD value tracker file
 */
export async function updateValueTvkdTrackerFile(
  filePath: string,
  ngayGD: Date,
  tvkdValues: Map<string, number>,
) {
  ensureBaseFileExists(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File lũy kế TVKD không tồn tại: "${filePath}"`);
  }

  // Backup snapshot
  try {
    const fileDir = path.dirname(filePath);
    const backupDir = path.join(fileDir, 'Backup_Snapshots');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date()
      .toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');
    const baseName = path.basename(filePath, path.extname(filePath));
    const extName = path.extname(filePath);
    const backupPath = path.join(
      backupDir,
      `${baseName}_backup_${timestamp}${extName}`,
    );
    fs.copyFileSync(filePath, backupPath);
  } catch (err: any) {
    console.warn(`[WARN] Không thể tự động tạo file sao lưu cho TVKD: ${err.message}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheetName = getSheetName(path.basename(filePath), ngayGD);
  let ws = wb.getWorksheet(sheetName);
  if (!ws) {
    throw new Error(
      `File "${path.basename(filePath)}" chưa có Sheet "${sheetName}". Vui lòng tạo/copy Sheet "${sheetName}" trong tệp Excel trước khi chạy dữ liệu tháng này.`,
    );
  }

  // Find date row index using Column B (2)
  let targetRowIndex = -1;
  let tongRowIndex = -1;

  for (let r = 5; r <= ws.rowCount; r++) {
    const dateCellVal = ws.getCell(r, 2).value;
    const dateStr =
      dateCellVal !== null && dateCellVal !== undefined
        ? String(dateCellVal).trim().toLowerCase()
        : '';

    if (dateStr === 'tổng') {
      tongRowIndex = r;
      break;
    }

    if (isSameDate(dateCellVal, ngayGD)) {
      targetRowIndex = r;
      break;
    }
  }

  if (targetRowIndex === -1) {
    if (tongRowIndex !== -1) {
      ws.insertRow(tongRowIndex, []);
      targetRowIndex = tongRowIndex;
    } else {
      let lastContentRow = 4;
      for (let r = 5; r <= ws.rowCount; r++) {
        const c2 = ws.getCell(r, 2).value;
        if (c2 !== null && c2 !== undefined && c2 !== '') {
          lastContentRow = r;
        }
      }
      targetRowIndex = lastContentRow + 1;
    }

    // Set Date in Column B
    ws.getCell(targetRowIndex, 2).value = ngayGD;
    ws.getCell(targetRowIndex, 2).numFmt = 'yyyy-mm-dd';
    // Set STT in Column A
    ws.getCell(targetRowIndex, 1).value = targetRowIndex - 4;
  }

  // Parse TVKD column mappings from Row 4 (Column 3 to Column 100)
  const colMappings = new Map<string, number>();
  const row4 = ws.getRow(4);
  row4.eachCell((cell, colNumber) => {
    if (colNumber >= 3) {
      const val = cell.value;
      if (val !== null && val !== undefined) {
        const headerStr = String(val).replace(/\s+/g, '').toUpperCase();
        const match = headerStr.match(/\d{3}/);
        if (match) {
          colMappings.set(match[0], colNumber);
        }
      }
    }
  });

  // Write TVKD values
  for (const [tvkd, val] of tvkdValues.entries()) {
    const colIdx = colMappings.get(tvkd);
    if (colIdx !== undefined) {
      ws.getCell(targetRowIndex, colIdx).value = val;
    }
  }

  // Helper to convert column index to Excel column letter
  const getColLetter = (colIdx: number): string => {
    let temp = colIdx;
    let letter = '';
    while (temp > 0) {
      const modulo = (temp - 1) % 26;
      letter = String.fromCharCode(65 + modulo) + letter;
      temp = Math.floor((temp - modulo) / 26);
    }
    return letter;
  };

  // Dynamically find 'Tổng' column index in Row 2
  let tongColIdx = 61; // default fallback
  for (let col = 3; col <= 100; col++) {
    const cellVal = ws.getCell(2, col).value;
    if (cellVal !== null && cellVal !== undefined) {
      const strVal = String(cellVal).trim().toLowerCase();
      if (strVal === 'tổng') {
        tongColIdx = col;
        break;
      }
    }
  }

  // Fill Row total in the dynamically located 'Tổng' column
  const prevColLetter = getColLetter(tongColIdx - 1);
  ws.getCell(targetRowIndex, tongColIdx).value = {
    formula: `SUM(C${targetRowIndex}:${prevColLetter}${targetRowIndex})`,
    result: undefined,
  };

  // Clean shared formulas
  for (const sheet of wb.worksheets) {
    fixSharedFormulas(sheet);
  }

  await wb.xlsx.writeFile(filePath);
}

/**
 * Orchestrator to update all cumulative value tracker files including TVKD
 */
export async function updateAllValueCumulativeFiles(
  paths: ValueAccumulatorPaths,
  ngayGD: Date,
  normalGtgdMap: Map<string, number>,
  spreadGtgdMap: Map<string, number>,
  tvkdValues?: Map<string, number>,
) {
  // 1. Normal Value Tracker
  ensureDirExists(paths.pathNormal);
  await updateValueTrackerFile(
    paths.pathNormal,
    ngayGD,
    NORMAL_COMMODITIES,
    normalGtgdMap,
    'Normal',
  );

  // 2. Spread Value Tracker
  ensureDirExists(paths.pathSpread);
  await updateValueTrackerFile(
    paths.pathSpread,
    ngayGD,
    SPREAD_COMMODITIES,
    spreadGtgdMap,
    'Spread',
  );

  // 3. LME Value Tracker
  ensureDirExists(paths.pathLme);
  await updateValueTrackerFile(
    paths.pathLme,
    ngayGD,
    LME_COMMODITIES,
    normalGtgdMap,
    'LME',
  );

  // 4. Options Value Tracker
  ensureDirExists(paths.pathOptions);
  await updateValueTrackerFile(
    paths.pathOptions,
    ngayGD,
    OPTIONS_COMMODITIES,
    normalGtgdMap,
    'Options',
  );

  // 5. ACM Value Tracker
  ensureDirExists(paths.pathAcm);
  await updateValueTrackerFile(
    paths.pathAcm,
    ngayGD,
    ACM_COMMODITIES,
    normalGtgdMap,
    'ACM',
  );

  // 6. TVKD Value Tracker (New)
  if (paths.pathTvkd && tvkdValues) {
    ensureDirExists(paths.pathTvkd);
    await updateValueTvkdTrackerFile(
      paths.pathTvkd,
      ngayGD,
      tvkdValues,
    );
  }
}
