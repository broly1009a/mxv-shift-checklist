import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { LotSummaryResult } from '../lot-statistics.service';
import { DsgdClassified } from './trade-classifier.helper';
import { aggregateByTvkd, sumDsgdLot, sumTtmLot, sumTtttLot, aggregateByProduct, getSPFromDsgd, getSPFromSpread } from './lot-aggregator.helper';
import { toDate } from './excel-parser.helper';

export interface AccumulatorPaths {
  pathDsgdCumulative: string;   // DSGD T[MM].[YYYY].xlsx
  pathNormal: string;           // Thong ke so lot giao dich 2026 2.xlsx
  pathAcm: string;              // Thong ke so lot giao dich ACM 2026 2.xlsx
  pathLme: string;              // Thong ke so lot giao dich LME 2026.xlsx
  pathOptions: string;          // Thong ke so lot giao dich Options 2026.xlsx
  pathSpread: string;           // Thong ke so lot giao dich Spread 2026.xlsx
}

/**
 * Robust date comparison matcher
 */
function isSameDate(cellVal: any, targetDate: Date): boolean {
  if (cellVal === null || cellVal === undefined) return false;
  let d: Date | null = null;
  
  if (cellVal instanceof Date) {
    d = cellVal;
  } else if (typeof cellVal === 'number') {
    const epoch = new Date(1899, 11, 30);
    d = new Date(epoch.getTime() + cellVal * 86400000);
  } else if (typeof cellVal === 'object' && cellVal !== null) {
    if ('result' in cellVal) {
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
  return (
    d.getFullYear() === targetDate.getFullYear() &&
    d.getMonth() === targetDate.getMonth() &&
    d.getDate() === targetDate.getDate()
  );
}

/**
 * Format sheet name according to month and year (e.g. T07.2026 or T7.2026)
 */
function getSheetName(filename: string, date: Date): string {
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
  return parts.some(p => p.includes(normalizedCode));
}

function matchProductHeader(header: string, productCode: string): boolean {
  if (!header) return false;
  const normalizedHeader = header.replace(/[\s.]+/g, '').toUpperCase();
  const normalizedProd = productCode.replace(/[\s.]+/g, '').toUpperCase();
  return normalizedHeader === normalizedProd;
}

/**
 * Ensures directory exists
 */
function ensureDirExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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
  
  // Read daily DSGD rows
  const dailyWb = new ExcelJS.Workbook();
  await dailyWb.xlsx.load(dailyDsgdBuffer as any);
  const dailyWs = dailyWb.worksheets[0];
  if (!dailyWs) return;

  const targetWb = new ExcelJS.Workbook();
  let targetWs: ExcelJS.Worksheet;

  if (fs.existsSync(targetFilePath)) {
    await targetWb.xlsx.readFile(targetFilePath);
    targetWs = targetWb.getWorksheet('sheet1') || targetWb.getWorksheet('Sheet1') || targetWb.worksheets[0];
  } else {
    targetWs = targetWb.addWorksheet('sheet1');
    // Copy headers from daily
    const headers = dailyWs.getRow(1).values as any[];
    targetWs.getRow(1).values = headers.slice(1); // ExcelJS values are 1-indexed
  }

  const startRow = targetWs.rowCount + 1;
  let addedCount = 0;

  // Append daily rows starting from row 2
  for (let r = 2; r <= dailyWs.rowCount; r++) {
    const dailyRow = dailyWs.getRow(r);
    if (!dailyRow.values || (dailyRow.values as any[]).length === 0) continue;

    const newRow = targetWs.getRow(startRow + addedCount);
    // Copy columns A to V (1 to 22)
    for (let c = 1; c <= 22; c++) {
      newRow.getCell(c).value = dailyRow.getCell(c).value;
    }
    // Column W (23) gets transaction date
    newRow.getCell(23).value = ngayGD;
    newRow.getCell(23).numFmt = 'yyyy-mm-dd';

    addedCount++;
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
) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File lũy kế ${categoryName} không tồn tại: "${filePath}"`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheetName = getSheetName(path.basename(filePath), ngayGD);
  let ws = wb.getWorksheet(sheetName);
  if (!ws) {
    ws = wb.worksheets[wb.worksheets.length - 1];
  }

  let targetRowIndex = -1;
  for (let r = 5; r <= ws.rowCount; r++) {
    const dateCellVal = ws.getCell(r, 2).value;
    if (isSameDate(dateCellVal, ngayGD)) {
      targetRowIndex = r;
      break;
    }
  }

  if (targetRowIndex === -1) {
    targetRowIndex = ws.rowCount + 1;
    let maxStt = 0;
    for (let r = 5; r < targetRowIndex; r++) {
      const stt = parseInt(String(ws.getCell(r, 1).value || 0), 10);
      if (stt > maxStt) maxStt = stt;
    }
    ws.getCell(targetRowIndex, 1).value = maxStt + 1;
    ws.getCell(targetRowIndex, 2).value = ngayGD;
    ws.getCell(targetRowIndex, 2).numFmt = 'yyyy-mm-dd';
  }

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
) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File lũy kế ACM không tồn tại: "${filePath}"`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheetName = getSheetName(path.basename(filePath), ngayGD);
  let ws = wb.getWorksheet(sheetName);
  if (!ws) {
    ws = wb.worksheets[wb.worksheets.length - 1];
  }

  let targetRowIndex = -1;
  for (let r = 5; r <= ws.rowCount; r++) {
    const dateCellVal = ws.getCell(r, 2).value;
    if (isSameDate(dateCellVal, ngayGD)) {
      targetRowIndex = r;
      break;
    }
  }

  if (targetRowIndex === -1) {
    targetRowIndex = ws.rowCount + 1;
    let maxStt = 0;
    for (let r = 5; r < targetRowIndex; r++) {
      const stt = parseInt(String(ws.getCell(r, 1).value || 0), 10);
      if (stt > maxStt) maxStt = stt;
    }
    ws.getCell(targetRowIndex, 1).value = maxStt + 1;
    ws.getCell(targetRowIndex, 2).value = ngayGD;
    ws.getCell(targetRowIndex, 2).numFmt = 'yyyy-mm-dd';
  }

  // Update summary columns
  ws.getCell(targetRowIndex, 3).value = sumDsgdLot(classified.dsgdAcm); // CQG lot
  ws.getCell(targetRowIndex, 4).value = sumTtttLot(ttttAcm);           // TTTT lot
  ws.getCell(targetRowIndex, 5).value = sumTtmLot(ttmAcm);             // TTM lot
  ws.getCell(targetRowIndex, 6).value = 0;                             // Placeholder/formula
  ws.getCell(targetRowIndex, 7).value = 0;                             // Placeholder/formula
  ws.getCell(targetRowIndex, 8).value = 0;                             // Placeholder/formula
  ws.getCell(targetRowIndex, 9).value = '';                            // Ghi chú

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
) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File lũy kế Normal Futures không tồn tại: "${filePath}"`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheetName = getSheetName(path.basename(filePath), result.ngayGD);
  let ws = wb.getWorksheet(sheetName);
  if (!ws) {
    ws = wb.worksheets[wb.worksheets.length - 1];
  }

  let targetRowIndex = -1;
  for (let r = 5; r <= ws.rowCount; r++) {
    const dateCellVal = ws.getCell(r, 2).value;
    if (isSameDate(dateCellVal, result.ngayGD)) {
      targetRowIndex = r;
      break;
    }
  }

  if (targetRowIndex === -1) {
    targetRowIndex = ws.rowCount + 1;
    let maxStt = 0;
    for (let r = 5; r < targetRowIndex; r++) {
      const stt = parseInt(String(ws.getCell(r, 1).value || 0), 10);
      if (stt > maxStt) maxStt = stt;
    }
    ws.getCell(targetRowIndex, 1).value = maxStt + 1;
    ws.getCell(targetRowIndex, 2).value = result.ngayGD;
    ws.getCell(targetRowIndex, 2).numFmt = 'yyyy-mm-dd';
  }

  const s = result.summary;

  // ── Block 1: M-System (cols 3-16) ──────────────────────────────────────────
  // Futures (DSGD/TTTT/TTM)
  ws.getCell(targetRowIndex, 3).value = s.dsgdProduct;   // Số Lot giao dịch M-System
  ws.getCell(targetRowIndex, 4).value = s.ttttProduct;   // Số lot tất toán
  ws.getCell(targetRowIndex, 5).value = s.ttmProduct;    // Vị thế mở
  // Spread
  ws.getCell(targetRowIndex, 6).value = s.dsgdSpread;
  ws.getCell(targetRowIndex, 7).value = s.ttttSpread;
  ws.getCell(targetRowIndex, 8).value = s.ttmSpread;
  // LME
  ws.getCell(targetRowIndex, 9).value = s.dsgdLme;
  ws.getCell(targetRowIndex, 10).value = s.psLme - lmeExpiredLot;          // Số lot tất toán LME (lấy từ số liệu CQG PS để đồng bộ)
  ws.getCell(targetRowIndex, 11).value = s.ttmLme;
  // Options
  ws.getCell(targetRowIndex, 12).value = s.dsgdOptions;
  ws.getCell(targetRowIndex, 13).value = s.ttttOptions;
  ws.getCell(targetRowIndex, 14).value = s.ttmOptions;
  // Totals (formula cells - skip or set 0; ExcelJS will preserve formulas)
  // Col 15 (Tổng Lot giao dịch M-System) & Col 16 (Tổng vị thế mở M-System) are SUM formulas

  // ── Block 2: CQG (cols 17-30) ───────────────────────────────────────────────
  // Futures
  ws.getCell(targetRowIndex, 17).value = s.frProduct;    // FR Số Lot giao dịch
  ws.getCell(targetRowIndex, 18).value = s.psProduct;    // PS Số lot tất toán
  ws.getCell(targetRowIndex, 19).value = s.opProduct;    // OP Vị thế mở
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

  ws.getCell(targetRowIndex, 31).value = ''; // Ghi chú

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
) {
  // 1. Append raw DSGD
  if (paths.pathDsgdCumulative) {
    await appendRawDsgd(dailyDsgdBuffer, paths.pathDsgdCumulative, result.ngayGD);
  }

  // 2. Update LME
  if (paths.pathLme) {
    await updateTvkdTrackerFile(paths.pathLme, classifiedDsgd.dsgdLme, result.ngayGD, 'LME');
  }

  // 3. Update Options
  if (paths.pathOptions) {
    await updateTvkdTrackerFile(paths.pathOptions, classifiedDsgd.dsgdOptions, result.ngayGD, 'Options');
  }

  // 4. Update Spread
  if (paths.pathSpread) {
    await updateTvkdTrackerFile(paths.pathSpread, classifiedDsgd.dsgdSpread, result.ngayGD, 'Spread');
  }

  // 5. Update ACM
  if (paths.pathAcm) {
    await updateAcmTrackerFile(paths.pathAcm, classifiedDsgd, ttttAcmRows, ttmAcmRows, result.ngayGD);
  }

  // 6. Update Normal
  if (paths.pathNormal) {
    await updateNormalTrackerFile(paths.pathNormal, result, classifiedDsgd, lmeExpiredLot);
  }
}
