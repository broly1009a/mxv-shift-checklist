import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { LotSummaryResult } from '../lot-statistics.service';
import { DsgdClassified } from './trade-classifier.helper';
import {
  aggregateByTvkd,
  sumDsgdLot,
  sumTtmLot,
  sumTtttLot,
  aggregateByProduct,
  getSPFromDsgd,
  getSPFromSpread,
} from './lot-aggregator.helper';
import {
  assertSafeWritePath,
  ensureBaseFileExists,
} from '../../../common/file-guard.helper';
import { ensureMonthSheetExists } from './excel-sheet-cloner.helper';
export interface AccumulatorPaths {
  pathDsgdCumulative: string; // DSGD T[MM].[YYYY].xlsx
  pathNormal: string; // Thong ke so lot giao dich 2026 2.xlsx
  pathAcm: string; // Thong ke so lot giao dich ACM 2026 2.xlsx
  pathLme: string; // Thong ke so lot giao dich LME 2026.xlsx
  pathOptions: string; // Thong ke so lot giao dich Options 2026.xlsx
  pathSpread: string; // Thong ke so lot giao dich Spread 2026.xlsx
}

/**
 * Robust date comparison matcher
 */
export function isSameDate(cellVal: any, targetDate: Date): boolean {
  if (cellVal === null || cellVal === undefined) return false;
  let d: Date | null = null;

  if (cellVal instanceof Date) {
    d = cellVal;
  } else if (typeof cellVal === 'number') {
    const epoch = new Date(1899, 11, 30);
    d = new Date(epoch.getTime() + cellVal * 86400000);
  } else if (typeof cellVal === 'object' && cellVal !== null) {
    if ('result' in cellVal && cellVal.result !== undefined && cellVal.result !== null) {
      return isSameDate(cellVal.result, targetDate);
    }
  } else {
    const str = String(cellVal).trim();
    const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      let year = parseInt(match[3], 10);
      if (year < 100) year += 2000;
      d = new Date(year, month, day);
    } else {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }
  }

  if (!d || isNaN(d.getTime())) return false;

  const formatYMD = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const formatUtcYMD = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

  const tLocal = formatYMD(targetDate);
  const tUtc = formatUtcYMD(targetDate);
  const dLocal = formatYMD(d);
  const dUtc = formatUtcYMD(d);

  return (
    dLocal === tLocal ||
    dUtc === tUtc ||
    dLocal === tUtc ||
    dUtc === tLocal
  );
}

/**
 * Helper to find or create target row index by scanning until "Tổng" or matching date
 */
function getNextWorkday(d: Date): Date {
  const next = new Date(d);
  do {
    next.setDate(next.getDate() + 1);
  } while (next.getDay() === 0 || next.getDay() === 6);
  return next;
}

export function findOrCreateTargetRow(
  ws: ExcelJS.Worksheet,
  ngayGD: Date,
): number {
  let targetRowIndex = -1;
  let tongRowIndex = -1;
  let currentCalculatedDate: Date | null = null;

  for (let r = 5; r <= ws.rowCount; r++) {
    const sttVal = ws.getCell(r, 1).value;
    const dateCellVal = ws.getCell(r, 2).value;

    const sttStr =
      sttVal !== null && sttVal !== undefined
        ? String(sttVal).trim().toLowerCase()
        : '';
    const dateStr =
      dateCellVal !== null && dateCellVal !== undefined
        ? String(dateCellVal).trim().toLowerCase()
        : '';

    if (sttStr === 'tổng' || dateStr === 'tổng') {
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
      // Find the last row with content in column 1 or 2
      let lastContentRow = 4;
      for (let r = 5; r <= ws.rowCount; r++) {
        const c1 = ws.getCell(r, 1).value;
        const c2 = ws.getCell(r, 2).value;
        if (
          (c1 !== null && c1 !== undefined && c1 !== '') ||
          (c2 !== null && c2 !== undefined && c2 !== '')
        ) {
          lastContentRow = r;
        }
      }
      targetRowIndex = lastContentRow + 1;
    }

    // Set STT and Date
    let maxStt = 0;
    for (let r = 5; r < targetRowIndex; r++) {
      const stt = parseInt(String(ws.getCell(r, 1).value || 0), 10);
      if (stt > maxStt) maxStt = stt;
    }
    ws.getCell(targetRowIndex, 1).value = maxStt + 1;
    ws.getCell(targetRowIndex, 2).value = ngayGD;
    ws.getCell(targetRowIndex, 2).numFmt = 'yyyy-mm-dd';
  }

  return targetRowIndex;
}

/**
 * Format sheet name according to month and year (e.g. T07.2026 or T7.2026)
 */
export function getSheetName(filename: string, date: Date): string {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (filename.toLowerCase().includes('options')) {
    return `T${month}.${year}`;
  }
  const monthStr = month.toString().padStart(2, '0');
  return `T${monthStr}.${year}`;
}

/**
 * Extract 3-digit member code from column header (e.g. "HN\n001" -> "001")
 */
function matchTvkdHeader(header: string, tvkdCode: string): boolean {
  if (!header) return false;
  const normalized = header.replace(/\s+/g, '').toUpperCase();
  const normalizedCode = tvkdCode.trim().toUpperCase();
  const parts = normalized.split(',');
  return parts.some((p) => p.includes(normalizedCode));
}

function matchProductHeader(header: string, productCode: string): boolean {
  if (!header) return false;
  const normalizedHeader = header.replace(/[\s.]+/g, '').toUpperCase();
  const normalizedProd = productCode.replace(/[\s.]+/g, '').toUpperCase();
  return normalizedHeader === normalizedProd;
}

/**
 * Ensures directory exists and validates safety against allowed root
 */
export function ensureDirExists(filePath: string) {
  const allowedRoot = process.env.BOT_MACRO_TARGET_ROOT || process.env.BOT_LOT_MACRO_TARGET_ROOT || '';
  if (allowedRoot) {
    assertSafeWritePath(filePath, allowedRoot);
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Helper to backup file before modification
 */
function backupFile(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return;
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
      `[WARN] Không thể tự động tạo file sao lưu cho ${path.basename(filePath)}: ${err.message}`,
    );
  }
}

/**
 * 1. Append raw daily DSGD rows to cumulative DSGD file
 */
export async function appendRawDsgd(
  dailyDsgdBuffer: Buffer,
  targetFilePath: string,
  ngayGD: Date,
) {
  ensureDirExists(targetFilePath);
  backupFile(targetFilePath);

  // Read daily DSGD rows
  const dailyWb = new ExcelJS.Workbook();
  await dailyWb.xlsx.load(dailyDsgdBuffer as any);
  const dailyWs = dailyWb.worksheets[0];
  if (!dailyWs) return;

  const targetWb = new ExcelJS.Workbook();
  let targetWs: ExcelJS.Worksheet;
  const rowsToKeep: any[][] = [];
  const headerValues = dailyWs.getRow(1).values as any[];

  const isExistingNonEmpty =
    fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).size > 0;

  if (isExistingNonEmpty) {
    await targetWb.xlsx.readFile(targetFilePath);
    const existingWs =
      targetWb.getWorksheet('sheet1') ||
      targetWb.getWorksheet('Sheet1') ||
      targetWb.worksheets[0];
    if (existingWs) {
      for (let r = 2; r <= existingWs.rowCount; r++) {
        const row = existingWs.getRow(r);
        const dateVal = row.getCell(23).value;
        if (!isSameDate(dateVal, ngayGD)) {
          const rowVals: any[] = [];
          for (let c = 1; c <= 23; c++) {
            rowVals.push(row.getCell(c).value);
          }
          rowsToKeep.push(rowVals);
        }
      }
      targetWb.removeWorksheet(existingWs.id);
    }
  }

  targetWs = targetWb.addWorksheet('sheet1');
  targetWs.getRow(1).values = headerValues.slice(1);

  let currentGenRow = 2;
  // Write kept rows
  for (const rowVals of rowsToKeep) {
    const newRow = targetWs.getRow(currentGenRow);
    for (let c = 1; c <= 23; c++) {
      newRow.getCell(c).value = rowVals[c - 1];
    }
    newRow.getCell(23).numFmt = 'yyyy-mm-dd';
    currentGenRow++;
  }

  // Append daily rows starting from row 2
  for (let r = 2; r <= dailyWs.rowCount; r++) {
    const dailyRow = dailyWs.getRow(r);
    if (!dailyRow.values || (dailyRow.values as any[]).length === 0) continue;

    const newRow = targetWs.getRow(currentGenRow);
    // Copy columns A to V (1 to 22)
    for (let c = 1; c <= 22; c++) {
      newRow.getCell(c).value = dailyRow.getCell(c).value;
    }
    // Column W (23) gets transaction date
    newRow.getCell(23).value = ngayGD;
    newRow.getCell(23).numFmt = 'yyyy-mm-dd';

    currentGenRow++;
  }

  await targetWb.xlsx.writeFile(targetFilePath);
}

/**
 * Helper to update tracker file for Options, Spread, LME
 */
async function updateTvkdTrackerFile(
  filePath: string,
  classifiedRows: any[],
  ngayGD: Date,
  categoryName: 'LME' | 'Options' | 'Spread',
  jobLogs?: string[],
) {
  ensureBaseFileExists(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File lũy kế ${categoryName} không tồn tại: "${filePath}"`);
  }
  backupFile(filePath);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheetName = getSheetName(path.basename(filePath), ngayGD);
  let ws = wb.getWorksheet(sheetName);
  if (!ws) {
    const cloned = ensureMonthSheetExists(filePath, sheetName, jobLogs);
    if (cloned) {
      await wb.xlsx.readFile(filePath);
      ws = wb.getWorksheet(sheetName);
    }
  }
  if (!ws) {
    throw new Error(
      `File "${path.basename(filePath)}" chưa có Sheet "${sheetName}". Không thể tự động tạo Sheet bằng Python openpyxl.`,
    );
  }

  const targetRowIndex = findOrCreateTargetRow(ws, ngayGD);

  const tvkdLots = aggregateByTvkd(classifiedRows);

  // Update TVKD columns: 3 to 63
  const headerRow = ws.getRow(4);
  for (let col = 3; col <= 63; col++) {
    const headerVal = headerRow.getCell(col).value;
    if (headerVal === null || headerVal === undefined) continue;

    const headerText = String(headerVal);
    let sumLot = 0;
    for (const item of tvkdLots) {
      if (matchTvkdHeader(headerText, item.tvkd)) {
        sumLot += item.total;
      }
    }
    ws.getCell(targetRowIndex, col).value = sumLot;
  }

  // Update Product columns: 66 to 74 (Spread/LME) or 81 (Options)
  const productLots = aggregateByProduct(
    classifiedRows,
    categoryName === 'Spread' ? getSPFromSpread : getSPFromDsgd,
  );

  const prodStart = 66;
  const prodEnd = categoryName === 'Options' ? 81 : 74;

  for (let col = prodStart; col <= prodEnd; col++) {
    const headerVal = headerRow.getCell(col).value;
    if (headerVal === null || headerVal === undefined) continue;

    const headerText = String(headerVal);
    let sumLot = 0;
    for (const item of productLots) {
      if (matchProductHeader(headerText, item.maSP)) {
        sumLot += item.total;
      }
    }
    ws.getCell(targetRowIndex, col).value = sumLot;
  }

  await wb.xlsx.writeFile(filePath);
}

/**
 * 2. Update ACM Tracker File
 */
async function updateAcmTrackerFile(
  filePath: string,
  classified: DsgdClassified,
  ttttAcm: any[],
  ttmAcm: any[],
  ngayGD: Date,
  jobLogs?: string[],
) {
  ensureBaseFileExists(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File lũy kế ACM không tồn tại: "${filePath}"`);
  }
  backupFile(filePath);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheetName = getSheetName(path.basename(filePath), ngayGD);
  let ws = wb.getWorksheet(sheetName);
  if (!ws) {
    const cloned = ensureMonthSheetExists(filePath, sheetName, jobLogs);
    if (cloned) {
      await wb.xlsx.readFile(filePath);
      ws = wb.getWorksheet(sheetName);
    }
  }
  if (!ws) {
    throw new Error(
      `File "${path.basename(filePath)}" chưa có Sheet "${sheetName}". Không thể tự động tạo Sheet bằng Python openpyxl.`,
    );
  }

  const targetRowIndex = findOrCreateTargetRow(ws, ngayGD);

  // Update summary columns
  ws.getCell(targetRowIndex, 3).value = sumDsgdLot(classified.dsgdAcm); // CQG lot
  ws.getCell(targetRowIndex, 4).value = sumTtttLot(ttttAcm); // TTTT lot
  ws.getCell(targetRowIndex, 5).value = sumTtmLot(ttmAcm); // TTM lot
  ws.getCell(targetRowIndex, 6).value = null; // Placeholder/formula
  ws.getCell(targetRowIndex, 7).value = null; // Placeholder/formula
  ws.getCell(targetRowIndex, 8).value = null; // Placeholder/formula
  ws.getCell(targetRowIndex, 9).value = ''; // Ghi chú

  // Update TVKD columns: 11 to 71
  const tvkdLots = aggregateByTvkd(classified.dsgdAcm);
  const headerRow = ws.getRow(4);
  for (let col = 11; col <= 71; col++) {
    const headerVal = headerRow.getCell(col).value;
    if (headerVal === null || headerVal === undefined) continue;

    const headerText = String(headerVal);
    let sumLot = 0;
    for (const item of tvkdLots) {
      if (matchTvkdHeader(headerText, item.tvkd)) {
        sumLot += item.total;
      }
    }
    ws.getCell(targetRowIndex, col).value = sumLot;
  }

  // Update Product columns: 74 to 76
  const productLots = aggregateByProduct(classified.dsgdAcm, getSPFromDsgd);
  for (let col = 74; col <= 76; col++) {
    const headerVal = headerRow.getCell(col).value;
    if (headerVal === null || headerVal === undefined) continue;

    const headerText = String(headerVal);
    let sumLot = 0;
    for (const item of productLots) {
      if (matchProductHeader(headerText, item.maSP)) {
        sumLot += item.total;
      }
    }
    ws.getCell(targetRowIndex, col).value = sumLot;
  }

  await wb.xlsx.writeFile(filePath);
}

/**
 * 3. Update Normal Futures Tracker File
 */
async function updateNormalTrackerFile(
  filePath: string,
  result: LotSummaryResult,
  classified: DsgdClassified,
  lmeExpiredLot: number,
  jobLogs?: string[],
) {
  ensureBaseFileExists(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File lũy kế Normal Futures không tồn tại: "${filePath}"`);
  }
  backupFile(filePath);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheetName = getSheetName(path.basename(filePath), result.ngayGD);
  let ws = wb.getWorksheet(sheetName);
  if (!ws) {
    const cloned = ensureMonthSheetExists(filePath, sheetName, jobLogs);
    if (cloned) {
      await wb.xlsx.readFile(filePath);
      ws = wb.getWorksheet(sheetName);
    }
  }
  if (!ws) {
    throw new Error(
      `File "${path.basename(filePath)}" chưa có Sheet "${sheetName}". Không thể tự động tạo Sheet bằng Python openpyxl.`,
    );
  }

  const targetRowIndex = findOrCreateTargetRow(ws, result.ngayGD);

  const s = result.summary;

  // ── Block 1: M-System (cols 3-16) ──────────────────────────────────────────
  // Futures (DSGD/TTTT/TTM)
  ws.getCell(targetRowIndex, 3).value = s.dsgdProduct; // Số Lot giao dịch M-System
  ws.getCell(targetRowIndex, 4).value = s.ttttProduct; // Số lot tất toán
  ws.getCell(targetRowIndex, 5).value = s.ttmProduct; // Vị thế mở
  // Spread
  ws.getCell(targetRowIndex, 6).value = s.dsgdSpread;
  ws.getCell(targetRowIndex, 7).value = s.ttttSpread;
  ws.getCell(targetRowIndex, 8).value = s.ttmSpread;
  // LME
  ws.getCell(targetRowIndex, 9).value = s.dsgdLme;
  ws.getCell(targetRowIndex, 10).value = s.psLme - lmeExpiredLot; // Số lot tất toán LME (lấy từ số liệu CQG PS để đồng bộ)
  ws.getCell(targetRowIndex, 11).value = s.ttmLme;
  // Options
  ws.getCell(targetRowIndex, 12).value = s.dsgdOptions;
  ws.getCell(targetRowIndex, 13).value = s.ttttOptions;
  ws.getCell(targetRowIndex, 14).value = s.ttmOptions;
  // Totals (formula cells - skip or set 0; ExcelJS will preserve formulas)
  // Col 15 (Tổng Lot giao dịch M-System) & Col 16 (Tổng vị thế mở M-System) are SUM formulas

  // ── Block 2: CQG (cols 17-30) ───────────────────────────────────────────────
  // Futures
  ws.getCell(targetRowIndex, 17).value = s.frProduct; // FR Số Lot giao dịch
  ws.getCell(targetRowIndex, 18).value = s.psProduct; // PS Số lot tất toán
  ws.getCell(targetRowIndex, 19).value = s.opProduct; // OP Vị thế mở
  // Spread
  ws.getCell(targetRowIndex, 20).value = s.frSpread;
  ws.getCell(targetRowIndex, 21).value = s.psSpread;
  ws.getCell(targetRowIndex, 22).value = s.opSpread;
  // LME
  ws.getCell(targetRowIndex, 23).value = s.frLme;
  ws.getCell(targetRowIndex, 24).value = s.psLme - lmeExpiredLot;
  ws.getCell(targetRowIndex, 25).value = s.opLme;
  // Options
  ws.getCell(targetRowIndex, 26).value = s.frOptions;
  ws.getCell(targetRowIndex, 27).value = s.psOptions;
  ws.getCell(targetRowIndex, 28).value = s.opOptions;
  // Totals (formula cells)
  // Col 29 & 30 are SUM formulas - skip to preserve

  // Ghi nhận ghi chú tự động từ bot và bảo toàn ghi chú thủ công của user
  const existingNote = ws.getCell(targetRowIndex, 31).value;
  const autoNoteStr =
    result.autoNotes && result.autoNotes.length > 0
      ? result.autoNotes.join('; ').trim()
      : '';

  if (
    existingNote === null ||
    existingNote === undefined ||
    String(existingNote).trim() === ''
  ) {
    ws.getCell(targetRowIndex, 31).value = autoNoteStr;
  } else {
    // Nếu đã có ghi chú cũ, chỉ append thêm các ghi chú tự động chưa tồn tại
    if (result.autoNotes && result.autoNotes.length > 0) {
      const existingStr = String(existingNote).trim();
      const newNotesToAppend = result.autoNotes
        .map((note) => note.trim())
        .filter((note) => note && !existingStr.includes(note));
      if (newNotesToAppend.length > 0) {
        ws.getCell(targetRowIndex, 31).value =
          existingStr + '; ' + newNotesToAppend.join('; ');
      }
    }
  }

  // Update TVKD columns: 33 to 93
  const tvkdLots = aggregateByTvkd(classified.dsgd);
  const headerRow = ws.getRow(4);
  for (let col = 33; col <= 93; col++) {
    const headerVal = headerRow.getCell(col).value;
    if (headerVal === null || headerVal === undefined) continue;

    const headerText = String(headerVal);
    let sumLot = 0;
    for (const item of tvkdLots) {
      if (matchTvkdHeader(headerText, item.tvkd)) {
        sumLot += item.total;
      }
    }
    ws.getCell(targetRowIndex, col).value = sumLot;
  }

  // Update Product columns: 96 to 162
  const productLots = aggregateByProduct(classified.dsgd, getSPFromDsgd);
  for (let col = 96; col <= 162; col++) {
    const headerVal = headerRow.getCell(col).value;
    if (headerVal === null || headerVal === undefined) continue;

    const headerText = String(headerVal);
    let sumLot = 0;
    for (const item of productLots) {
      if (matchProductHeader(headerText, item.maSP)) {
        sumLot += item.total;
      }
    }
    ws.getCell(targetRowIndex, col).value = sumLot;
  }

  // ── Block 3: Parity styling and highlights ──────────────────────────────────
  const compareAndHighlight = (
    colMs: number,
    colCqg: number,
    valMs: number,
    valCqg: number,
  ) => {
    const cellMs = ws.getCell(targetRowIndex, colMs);
    const cellCqg = ws.getCell(targetRowIndex, colCqg);

    if (valMs !== valCqg) {
      const redFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC7CE' }, // Light red background
      };
      const redFont: Partial<ExcelJS.Font> = {
        color: { argb: 'FF9C0006' }, // Dark red text
        bold: true,
      };
      cellMs.style = { ...cellMs.style, fill: redFill, font: redFont };
      cellCqg.style = { ...cellCqg.style, fill: redFill, font: redFont };
    } else {
      // Restore default clean template style for Columns 3 and 17
      const defaultFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { theme: 9, tint: 0.5999938962981048 } as any,
        bgColor: { indexed: 64 } as any,
      };
      const defaultFont: Partial<ExcelJS.Font> = {
        size: 11,
        color: { argb: 'FF000000' },
        name: 'Times New Roman',
        family: 1,
      };
      cellMs.style = { ...cellMs.style, fill: defaultFill, font: defaultFont };
      cellCqg.style = {
        ...cellCqg.style,
        fill: defaultFill,
        font: defaultFont,
      };
    }
  };

  // 1. Futures Lot (Only compare and highlight MS Futures Lot vs CQG Futures Lot)
  compareAndHighlight(3, 17, s.dsgdProduct || 0, s.frProduct || 0);

  await wb.xlsx.writeFile(filePath);
}

/**
 * Main function to update all 6 cumulative files
 */
export async function updateAllCumulativeFiles(
  dailyDsgdBuffer: Buffer,
  result: LotSummaryResult,
  classifiedDsgd: DsgdClassified,
  ttttAcmRows: any[],
  ttmAcmRows: any[],
  lmeExpiredLot: number,
  paths: AccumulatorPaths,
  jobLogs?: string[],
) {
  // 1. Append raw DSGD
  if (paths.pathDsgdCumulative) {
    await appendRawDsgd(
      dailyDsgdBuffer,
      paths.pathDsgdCumulative,
      result.ngayGD,
    );
  }

  // 2. Update LME
  if (paths.pathLme) {
    await updateTvkdTrackerFile(
      paths.pathLme,
      classifiedDsgd.dsgdLme,
      result.ngayGD,
      'LME',
      jobLogs,
    );
  }

  // 3. Update Options
  if (paths.pathOptions) {
    await updateTvkdTrackerFile(
      paths.pathOptions,
      classifiedDsgd.dsgdOptions,
      result.ngayGD,
      'Options',
      jobLogs,
    );
  }

  // 4. Update Spread
  if (paths.pathSpread) {
    await updateTvkdTrackerFile(
      paths.pathSpread,
      classifiedDsgd.dsgdSpread,
      result.ngayGD,
      'Spread',
      jobLogs,
    );
  }

  // 5. Update ACM
  if (paths.pathAcm) {
    await updateAcmTrackerFile(
      paths.pathAcm,
      classifiedDsgd,
      ttttAcmRows,
      ttmAcmRows,
      result.ngayGD,
      jobLogs,
    );
  }

  // 6. Update Normal
  if (paths.pathNormal) {
    await updateNormalTrackerFile(
      paths.pathNormal,
      result,
      classifiedDsgd,
      lmeExpiredLot,
      jobLogs,
    );
  }
}
