import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import {
  findOrCreateTargetRow,
  getSheetName,
} from '../../lot-statistics/helpers/excel-accumulator.helper';
import { findOrCreateValueTargetRow } from '../../lot-statistics/helpers/excel-value-accumulator.helper';
import { ensureMonthSheetExists } from '../../lot-statistics/helpers/excel-sheet-cloner.helper';
import * as XLSX from 'xlsx';
import { safeWriteExcel } from '../../lot-statistics/helpers/excel-safe-writer.helper';
import { ensureBaseFileExists } from '../../../common/file-guard.helper';
import { CcpLotResult } from '../ccp-lot-statistics.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CcpAccumulatorPaths {
  /** Phase 1 — Đã hoàn thiện */
  pathAcmLot?: string;          // "Thong ke so lot giao dich ACM [year].xlsx"
  pathAcmGtgd?: string;         // "Thong ke gia tri giao dich ACM [year].xlsx"

  /** Phase 2 — Số Lot */
  pathNormalLot?: string;       // "Thong ke so lot giao dich [year].xlsx"
  pathSpreadLot?: string;       // "Thong ke so lot giao dich Spread [year].xlsx"
  pathLmeLot?: string;          // "Thong ke so lot giao dich LME [year].xlsx"
  pathOptionsLot?: string;      // "Thong ke so lot giao dich Options [year].xlsx"
  pathDsgdCumulative?: string;  // "DSGD T[MM].[YYYY] CCP.xlsx" — raw DSGD lũy kế

  /** Phase 2 — Giá Trị Giao Dịch (GTGD) */
  pathGtgdNormal?: string;      // "Thong ke gia tri giao dich [year].xlsx"
  pathGtgdSpread?: string;      // "Thong ke gia tri giao dich Spread [year].xlsx"
  pathGtgdLme?: string;         // "Thong ke gia tri giao dich LME [year].xlsx"
  pathGtgdOptions?: string;     // "Thong ke gia tri giao dich Options [year].xlsx"
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

function backupFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const fileDir = path.dirname(filePath);
    const backupDir = path.join(fileDir, 'Backup_Snapshots');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const base = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);
    fs.copyFileSync(filePath, path.join(backupDir, `${base}_backup_${ts}${ext}`));
  } catch (err: any) {
    console.warn(`[CCP-ACC WARN] Không thể backup ${path.basename(filePath)}: ${err.message}`);
  }
}

/** Chuyển column index (1-indexed) sang ký tự cột Excel (1 -> A, 27 -> AA) */
function getColLetter(colIdx: number): string {
  let temp = colIdx;
  let letter = '';
  while (temp > 0) {
    const modulo = (temp - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    temp = Math.floor((temp - modulo) / 26);
  }
  return letter;
}

/** Fix shared formula references to avoid exceljs writing crashes */
function fixSharedFormulas(ws: ExcelJS.Worksheet): void {
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

// ─── Main: Write Lot Stats to ACM Lot File ───────────────────────────────────

/**
 * Ghi kết quả CCP Lot Statistics vào file lũy kế số lot ACM.
 *
 * Cấu trúc file "Thong ke so lot giao dich ACM [year].xlsx":
 *  - Sheet theo tháng (vd: T09.2026)
 *  - Row 4: headers:
 *      col 6: Số Lot GD (ACM / CQG)
 *      col 7: Số lot tất toán (ACM / CQG)
 *      col 8: Vị thế mở (ACM / CQG)
 *      col 11..: TVKD columns (HN 001, SF 002, ..., Wynthor 088)
 *      col first "Tổng": Tổng lot TVKD
 *      col commodities: SI5CO, PL1NY, CP2CO
 *      col second "Tổng": Tổng lot Hàng hoá
 */
export async function writeCcpLotToAccumulator(
  result: CcpLotResult,
  filePath: string,
  jobLogs?: string[],
): Promise<void> {
  ensureBaseFileExists(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File lũy kế lot ACM CCP không tồn tại: "${filePath}". Vui lòng kiểm tra cấu hình đường dẫn.`,
    );
  }

  backupFile(filePath);

  const ngayGD = new Date(result.ngayGD);
  if (isNaN(ngayGD.getTime())) {
    throw new Error(`ngayGD không hợp lệ: "${result.ngayGD}"`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheetName = getSheetName(path.basename(filePath), ngayGD);
  let ws = wb.getWorksheet(sheetName);

  // Tự động clone sheet tháng mới nếu chưa có
  if (!ws) {
    const cloned = ensureMonthSheetExists(filePath, sheetName, jobLogs);
    if (cloned) {
      await wb.xlsx.readFile(filePath);
      ws = wb.getWorksheet(sheetName);
    }
  }

  if (!ws) {
    throw new Error(
      `File "${path.basename(filePath)}" chưa có sheet "${sheetName}". ` +
      `Vui lòng tạo sheet tháng mới trong file trước.`,
    );
  }

  const targetRowIndex = findOrCreateTargetRow(ws, ngayGD);
  const log = (msg: string) => jobLogs?.push(`[CCP-ACC] ${msg}`);

  // Quét Row 4 động 100% để lập bản đồ cột (Zero hardcoded column indices)
  const headerRow = ws.getRow(4);

  let colAcmDsgd = 3;
  let colAcmTttt = 4;
  let colAcmTtm = 5;
  const tvkdColMap = new Map<string, number>();
  const hhColMap = new Map<string, number>();
  let colTotalTvkd = -1;
  let colTotalHh = -1;

  const maxCol = Math.min(ws.columnCount || 100, 120);
  for (let c = 1; c <= maxCol; c++) {
    const headerVal = headerRow.getCell(c).value;
    if (headerVal === null || headerVal === undefined) continue;

    const headerText = String(headerVal).trim();
    const norm = headerText.replace(/[\r\n\s]+/g, ' ').toUpperCase();

    // Nhận diện cột tổng hợp M-System / CCP (nằm ở cols 3, 4, 5: C, D, E)
    if (c >= 3 && c <= 5) {
      if (norm.includes('SỐ LOT') && (norm.includes('GD') || norm.includes('GIAO DỊCH'))) {
        colAcmDsgd = c;
      } else if (norm.includes('TẤT TOÁN') || norm.includes('TAT TOAN')) {
        colAcmTttt = c;
      } else if (norm.includes('VỊ THẾ') || norm.includes('VI THE') || norm.includes('MỞ')) {
        colAcmTtm = c;
      }
    }

    // Nhận diện các cột TVKD (bắt đầu từ col 10 trở đi, trước cột Tổng TVKD)
    if (c >= 10 && colTotalTvkd === -1) {
      if (norm === 'TỔNG' || norm === 'TONG' || norm.startsWith('TỔNG')) {
        colTotalTvkd = c;
        continue;
      }
      const match = headerText.match(/\b(\d{3})\b/);
      if (match) {
        tvkdColMap.set(match[1], c);
      }
    } else if (colTotalTvkd !== -1) {
      // Đã qua cột Tổng TVKD -> Khu vực Hàng hoá & Tổng Hàng hoá
      if (norm === 'TỔNG' || norm === 'TONG' || norm.startsWith('TỔNG')) {
        if (colTotalHh === -1) colTotalHh = c;
      } else if (['SI5CO', 'PL1NY', 'CP2CO'].includes(norm)) {
        hhColMap.set(norm, c);
      }
    }
  }

  // ── 1. Block M-System / CCP Summary (cols 3-5: C, D, E) ────────────────────────
  ws.getCell(targetRowIndex, colAcmDsgd).value = result.totalSoLot;
  ws.getCell(targetRowIndex, colAcmTttt).value = result.totalKltt ?? result.totalTtttLot ?? 0;
  ws.getCell(targetRowIndex, colAcmTtm).value  = result.totalTtmLot;

  // Dọn sạch các cột 6, 7, 8 (CQG: F, G, H) nếu trước đó từng bị ghi nhầm vào đây
  ws.getCell(targetRowIndex, 6).value = null;
  ws.getCell(targetRowIndex, 7).value = null;
  ws.getCell(targetRowIndex, 8).value = null;

  log(`Row ${targetRowIndex}: MS_DSGD(col ${colAcmDsgd})=${result.totalSoLot}, MS_TTTT(col ${colAcmTttt})=${result.totalKltt ?? result.totalTtttLot ?? 0}, MS_TTM(col ${colAcmTtm})=${result.totalTtmLot} (Đã dọn sạch cột CQG 6, 7, 8)`);

  // ── 2. Per TVKD ─────────────────────────────────────────────────────────────
  let tvkdWritten = 0;
  for (const [code, col] of tvkdColMap.entries()) {
    const item = result.byTvkd.find((t) => t.tvkd === code);
    const lot = item?.soLot || 0;
    ws.getCell(targetRowIndex, col).value = lot;
    if (lot > 0) tvkdWritten++;
  }
  log(`Per-TVKD: ghi ${tvkdWritten} TVKD có lot > 0 trên tổng số ${tvkdColMap.size} TVKD được nhận diện`);

  // Công thức Tổng TVKD
  if (colTotalTvkd !== -1 && tvkdColMap.size > 0) {
    const firstTvkdCol = Math.min(...Array.from(tvkdColMap.values()));
    const lastTvkdCol = Math.max(...Array.from(tvkdColMap.values()));
    const firstColLetter = getColLetter(firstTvkdCol);
    const lastColLetter = getColLetter(lastTvkdCol);
    ws.getCell(targetRowIndex, colTotalTvkd).value = {
      formula: `SUM(${firstColLetter}${targetRowIndex}:${lastColLetter}${targetRowIndex})`,
      result: result.totalSoLot,
    };
  }

  // ── 3. Per HH (SI5CO, PL1NY, CP2CO) ─────────────────────────────────────────
  for (const [maHH, col] of hhColMap.entries()) {
    let sumLot = 0;
    for (const item of result.byTvkd) {
      for (const hh of item.byHH ?? []) {
        if (hh.maHH.toUpperCase() === maHH) {
          sumLot += hh.soLot;
        }
      }
    }
    ws.getCell(targetRowIndex, col).value = sumLot;
    log(`Per-HH: ${maHH} (col ${col}) = ${sumLot} lot`);
  }

  // Công thức Tổng Hàng hoá
  if (colTotalHh !== -1 && hhColMap.size > 0) {
    const firstHhCol = Math.min(...Array.from(hhColMap.values()));
    const lastHhCol = Math.max(...Array.from(hhColMap.values()));
    const firstHhColLetter = getColLetter(firstHhCol);
    const lastHhColLetter = getColLetter(lastHhCol);
    ws.getCell(targetRowIndex, colTotalHh).value = {
      formula: `SUM(${firstHhColLetter}${targetRowIndex}:${lastHhColLetter}${targetRowIndex})`,
      result: result.totalSoLot,
    };
  }

  // Clean shared formulas
  for (const sheet of wb.worksheets) {
    fixSharedFormulas(sheet);
  }

  await safeWriteExcel(wb, filePath);
  log(`Đã lưu file lũy kế lot ACM: ${path.basename(filePath)}`);
}

// ─── GTGD Daily Accumulator ──────────────────────────────────────────────────

/**
 * Ghi kết quả CCP GTGD vào file lũy kế giá trị ACM.
 *
 * Cấu trúc file "Thong ke gia tri giao dich ACM [year].xlsx":
 *  - Sheet theo tháng (vd: T09.2026)
 *  - Cột A: Phiên giao dịch (Ngày tháng - không có cột STT)
 *  - Row 4: Header Tên Hàng Hoá ("Phiên giao dịch", "Bạc Nano", "Bạch kim Nano", "Đồng Nano", "Tổng")
 *  - Row 5: Header Mã HĐ/HH ("SI5CO", "PL1NY", "CP2CO")
 *  - Rows 6+: Dữ liệu từng phiên theo ngày
 */
export async function writeCcpGtgdToAccumulator(
  result: CcpLotResult,
  filePath: string,
  jobLogs?: string[],
): Promise<void> {
  ensureBaseFileExists(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File lũy kế GTGD ACM CCP không tồn tại: "${filePath}". Vui lòng kiểm tra cấu hình đường dẫn.`,
    );
  }

  backupFile(filePath);

  const ngayGD = new Date(result.ngayGD);
  if (isNaN(ngayGD.getTime())) {
    throw new Error(`ngayGD không hợp lệ: "${result.ngayGD}"`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheetName = getSheetName(path.basename(filePath), ngayGD);
  let ws = wb.getWorksheet(sheetName);

  // Tự động clone sheet tháng mới nếu chưa có
  if (!ws) {
    const cloned = ensureMonthSheetExists(filePath, sheetName, jobLogs);
    if (cloned) {
      await wb.xlsx.readFile(filePath);
      ws = wb.getWorksheet(sheetName);
    }
  }

  if (!ws) {
    throw new Error(
      `File "${path.basename(filePath)}" chưa có Sheet "${sheetName}". ` +
      `Vui lòng tạo Sheet tháng mới trong file trước.`,
    );
  }

  const log = (msg: string) => jobLogs?.push(`[CCP-GTGD-ACC] ${msg}`);

  // Tìm row phiên giao dịch theo ngày (Cột A là ngày, dùng findOrCreateValueTargetRow)
  const targetRowIndex = findOrCreateValueTargetRow(ws, ngayGD);

  // Quét Row 4 và Row 5 để map cột hàng hoá động
  const hhColMap = new Map<string, number>();
  let colTong = -1;

  for (const rowNum of [4, 5]) {
    const row = ws.getRow(rowNum);
    for (let c = 1; c <= 20; c++) {
      const v = row.getCell(c).value;
      if (!v) continue;
      const s = String(v).replace(/[\s\r\n]+/g, '').toUpperCase();
      if (['SI5CO', 'PL1NY', 'CP2CO'].includes(s)) {
        hhColMap.set(s, c);
      } else if (s === 'TỔNG' || s === 'TONG') {
        colTong = c;
      }
    }
  }

  // Fallbacks chuẩn nếu file không ghi header ở row 5
  if (!hhColMap.has('SI5CO')) hhColMap.set('SI5CO', 2);
  if (!hhColMap.has('PL1NY')) hhColMap.set('PL1NY', 3);
  if (!hhColMap.has('CP2CO')) hhColMap.set('CP2CO', 4);
  if (colTong === -1) colTong = 5;

  // Tính GTGD per HH từ danh sách TVKD
  const gtgdByHh = new Map<string, number>();
  for (const tvkd of result.byTvkd) {
    for (const hh of tvkd.byHH ?? []) {
      const key = hh.maHH.toUpperCase();
      gtgdByHh.set(key, (gtgdByHh.get(key) || 0) + hh.giaTri);
    }
  }

  // Ghi giá trị từng mặt hàng vào ngày hiện tại
  let totalGtgd = 0;
  for (const [maHH, col] of hhColMap.entries()) {
    const val = Math.round(gtgdByHh.get(maHH) || 0);
    ws.getCell(targetRowIndex, col).value = val;
    totalGtgd += val;
    log(`GTGD ${maHH} (col ${col}) = ${val.toLocaleString('vi-VN')} VND`);
  }

  // Ghi công thức Tổng dòng = SUM(B...:D...)
  const firstColLetter = getColLetter(Math.min(...Array.from(hhColMap.values())));
  const lastColLetter = getColLetter(Math.max(...Array.from(hhColMap.values())));
  ws.getCell(targetRowIndex, colTong).value = {
    formula: `SUM(${firstColLetter}${targetRowIndex}:${lastColLetter}${targetRowIndex})`,
    result: totalGtgd,
  };

  log(`Row ${targetRowIndex}: Tổng GTGD ngày = ${totalGtgd.toLocaleString('vi-VN')} VND`);

  // Clean shared formulas
  for (const sheet of wb.worksheets) {
    fixSharedFormulas(sheet);
  }

  await safeWriteExcel(wb, filePath);
  log(`Đã lưu file lũy kế GTGD ACM: ${path.basename(filePath)}`);
}

// ─── Phase 2: Typed Lot Accumulator (Normal, Spread, LME, Options) ───────────

/**
 * Ghi số lot theo phân hệ (Normal/Spread/LME/Options) vào file lũy kế CCP tương ứng.
 * Quét Row 4 động 100% để map mã TVKD và mã Sản phẩm.
 */
export async function writeCcpTypedLotToAccumulator(
  result: CcpLotResult,
  filePath: string,
  tradeType: 'normal' | 'spread' | 'lme' | 'options',
  jobLogs?: string[],
): Promise<void> {
  ensureBaseFileExists(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File lũy kế lot ${tradeType.toUpperCase()} CCP không tồn tại: "${filePath}". Vui lòng kiểm tra cấu hình đường dẫn.`,
    );
  }

  backupFile(filePath);

  const ngayGD = new Date(result.ngayGD);
  if (isNaN(ngayGD.getTime())) {
    throw new Error(`ngayGD không hợp lệ: "${result.ngayGD}"`);
  }

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
      `File "${path.basename(filePath)}" chưa có Sheet "${sheetName}". Vui lòng tạo sheet trước.`,
    );
  }

  const log = (msg: string) => jobLogs?.push(`[CCP-LOT-${tradeType.toUpperCase()}] ${msg}`);
  const targetRowIndex = findOrCreateTargetRow(ws, ngayGD);

  // Lấy dữ liệu phân hệ tương ứng
  const typeStats = (result as any).byType?.[tradeType];
  const tvkdList: any[] = typeStats?.byTvkd ?? [];
  const totalSoLot: number = typeStats?.totalSoLot ?? 0;

  const headerRow = ws.getRow(4);
  const tvkdColMap = new Map<string, number>();
  const productColMap = new Map<string, number>();
  let colTotalTvkd = -1;
  let colTotalProduct = -1;
  const maxCol = Math.min(ws.columnCount || 100, 150);

  for (let c = 3; c <= maxCol; c++) {
    const headerVal = headerRow.getCell(c).value;
    if (headerVal === null || headerVal === undefined) continue;

    const headerText = String(headerVal).trim();
    const norm = headerText.replace(/[\r\n\s]+/g, ' ').toUpperCase();

    if (colTotalTvkd === -1) {
      if (norm === 'TỔNG' || norm === 'TONG' || norm.startsWith('TỔNG')) {
        colTotalTvkd = c;
        continue;
      }
      const match = headerText.match(/\b(\d{3})\b/);
      if (match) {
        tvkdColMap.set(match[1], c);
      }
    } else {
      if (norm === 'TỔNG' || norm === 'TONG' || norm.startsWith('TỔNG')) {
        if (colTotalProduct === -1) colTotalProduct = c;
        continue;
      }
      const spCode = norm.replace(/\s+/g, '');
      if (spCode && spCode.length >= 2) {
        productColMap.set(spCode, c);
      }
    }
  }

  // 1. Ghi per TVKD
  let tvkdWritten = 0;
  for (const [code, col] of tvkdColMap.entries()) {
    const item = tvkdList.find((t) => t.tvkd === code);
    const lot = item?.soLot || 0;
    ws.getCell(targetRowIndex, col).value = lot;
    if (lot > 0) tvkdWritten++;
  }
  log(`Ghi ${tvkdWritten} TVKD có phát sinh lot (trên ${tvkdColMap.size} cột TVKD)`);

  // 2. Ghi cột Tổng TVKD
  if (colTotalTvkd !== -1 && tvkdColMap.size > 0) {
    const firstCol = Math.min(...Array.from(tvkdColMap.values()));
    const lastCol = Math.max(...Array.from(tvkdColMap.values()));
    ws.getCell(targetRowIndex, colTotalTvkd).value = {
      formula: `SUM(${getColLetter(firstCol)}${targetRowIndex}:${getColLetter(lastCol)}${targetRowIndex})`,
      result: totalSoLot,
    };
  }

  // 3. Ghi per Product
  for (const [spCode, col] of productColMap.entries()) {
    let sumLot = 0;
    for (const tvkd of tvkdList) {
      for (const hh of tvkd.byHH ?? []) {
        if (hh.maHH.toUpperCase() === spCode) {
          sumLot += hh.soLot;
        }
      }
    }
    ws.getCell(targetRowIndex, col).value = sumLot;
    if (sumLot > 0) log(`Sản phẩm ${spCode} (col ${col}) = ${sumLot} lot`);
  }

  // 4. Ghi cột Tổng Sản phẩm
  if (colTotalProduct !== -1 && productColMap.size > 0) {
    const firstCol = Math.min(...Array.from(productColMap.values()));
    const lastCol = Math.max(...Array.from(productColMap.values()));
    ws.getCell(targetRowIndex, colTotalProduct).value = {
      formula: `SUM(${getColLetter(firstCol)}${targetRowIndex}:${getColLetter(lastCol)}${targetRowIndex})`,
      result: totalSoLot,
    };
  }

  for (const sheet of wb.worksheets) {
    fixSharedFormulas(sheet);
  }

  await safeWriteExcel(wb, filePath);
  log(`Đã lưu file lũy kế lot ${tradeType.toUpperCase()}: ${path.basename(filePath)}`);
}

// ─── Phase 2: Typed GTGD Accumulator (Normal, Spread, LME, Options) ─────────

/**
 * Ghi Giá Trị Giao Dịch (VND) theo phân hệ vào file lũy kế GTGD CCP tương ứng.
 * Quét Row 4 và Row 5 động 100% để map mã sản phẩm và cột Tổng.
 */
export async function writeCcpTypedValueToAccumulator(
  result: CcpLotResult,
  filePath: string,
  tradeType: 'normal' | 'spread' | 'lme' | 'options',
  jobLogs?: string[],
): Promise<void> {
  ensureBaseFileExists(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File lũy kế GTGD ${tradeType.toUpperCase()} CCP không tồn tại: "${filePath}". Vui lòng kiểm tra cấu hình đường dẫn.`,
    );
  }

  backupFile(filePath);

  const ngayGD = new Date(result.ngayGD);
  if (isNaN(ngayGD.getTime())) {
    throw new Error(`ngayGD không hợp lệ: "${result.ngayGD}"`);
  }

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
      `File "${path.basename(filePath)}" chưa có Sheet "${sheetName}". Vui lòng tạo sheet trước.`,
    );
  }

  const log = (msg: string) => jobLogs?.push(`[CCP-GTGD-${tradeType.toUpperCase()}] ${msg}`);
  const targetRowIndex = findOrCreateValueTargetRow(ws, ngayGD);

  // Lấy dữ liệu phân hệ tương ứng
  const typeStats = (result as any).byType?.[tradeType];
  const tvkdList: any[] = typeStats?.byTvkd ?? [];

  const gtgdByHh = new Map<string, number>();
  for (const tvkd of tvkdList) {
    for (const hh of tvkd.byHH ?? []) {
      const k = hh.maHH.toUpperCase();
      gtgdByHh.set(k, (gtgdByHh.get(k) || 0) + hh.giaTri);
    }
  }

  // Quét Row 4 & Row 5 để map cột hàng hoá động
  const hhColMap = new Map<string, number>();
  let colTong = -1;

  for (const rowNum of [4, 5]) {
    const row = ws.getRow(rowNum);
    const maxScanCol = Math.min(ws.columnCount || 50, 100);
    for (let c = 2; c <= maxScanCol; c++) {
      const v = row.getCell(c).value;
      if (!v) continue;
      const s = String(v).replace(/[\s\r\n]+/g, '').toUpperCase();
      if (s === 'TỔNG' || s === 'TONG' || s.startsWith('TỔNG')) {
        if (colTong === -1) colTong = c;
      } else if (s.length >= 2 && !hhColMap.has(s) && !s.includes('PHIÊN') && !s.includes('NGÀY')) {
        hhColMap.set(s, c);
      }
    }
  }

  // Ghi giá trị từng mặt hàng vào ngày hiện tại
  let totalGtgd = 0;
  for (const [maHH, col] of hhColMap.entries()) {
    const val = Math.round(gtgdByHh.get(maHH) || 0);
    ws.getCell(targetRowIndex, col).value = val;
    totalGtgd += val;
    if (val > 0) log(`GTGD ${maHH} (col ${col}) = ${val.toLocaleString('vi-VN')} VND`);
  }

  // Ghi công thức Tổng dòng = SUM(B...:ColEnd...)
  if (colTong !== -1 && hhColMap.size > 0) {
    const firstColLetter = getColLetter(Math.min(...Array.from(hhColMap.values())));
    const lastColLetter = getColLetter(Math.max(...Array.from(hhColMap.values())));
    ws.getCell(targetRowIndex, colTong).value = {
      formula: `SUM(${firstColLetter}${targetRowIndex}:${lastColLetter}${targetRowIndex})`,
      result: totalGtgd,
    };
  }

  // LME: Xóa ô M1 theo quy ước CQG
  if (tradeType === 'lme') {
    ws.getCell(1, 13).value = null;
  }

  log(`Row ${targetRowIndex}: Tổng GTGD ngày = ${totalGtgd.toLocaleString('vi-VN')} VND`);

  for (const sheet of wb.worksheets) {
    fixSharedFormulas(sheet);
  }

  await safeWriteExcel(wb, filePath);
  log(`Đã lưu file lũy kế GTGD ${tradeType.toUpperCase()}: ${path.basename(filePath)}`);
}

// ─── Phase 2: Raw DSGD Cumulative File (DSGD T[MM].[YYYY] CCP.xlsx) ──────────

/**
 * Nối tiếp các dòng giao dịch thô (Raw DSGD 25 cột) từ CoreCCP vào file lũy kế tháng.
 * Tự động loại bỏ các dòng của cùng ngày nếu chạy lại (Upsert không trùng lặp).
 */
export async function appendCcpRawDsgd(
  dsgdBuffer: Buffer,
  targetFilePath: string,
  ngayGD: Date,
  jobLogs?: string[],
): Promise<void> {
  ensureBaseFileExists(targetFilePath);
  backupFile(targetFilePath);

  const log = (msg: string) => jobLogs?.push(`[CCP-RAW-DSGD] ${msg}`);

  // Đọc dữ liệu từ buffer nguồn bằng XLSX
  const wbIn = XLSX.read(dsgdBuffer, { type: 'buffer' });
  const sheetNameIn = wbIn.SheetNames[0];
  const wsIn = wbIn.Sheets[sheetNameIn];
  const allRows = XLSX.utils.sheet_to_json(wsIn, { header: 1, defval: '' }) as any[][];
  if (allRows.length <= 1) {
    log('Buffer DSGD không chứa dữ liệu giao dịch.');
    return;
  }

  const headerRow = allRows[0];
  const dataRows = allRows.slice(1);

  const targetWb = new ExcelJS.Workbook();
  const sheetName = getSheetName(path.basename(targetFilePath), ngayGD);

  const isExisting = fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).size > 0;
  if (isExisting) {
    try {
      await targetWb.xlsx.readFile(targetFilePath);
    } catch (readErr: any) {
      log(`Không thể đọc file lũy kế cũ (${readErr.message}). Tạo mới file.`);
    }
  }

  let targetWs = targetWb.getWorksheet(sheetName);
  const rowsToKeep: any[][] = [];

  const dayStr = String(ngayGD.getDate()).padStart(2, '0');
  const monthStr = String(ngayGD.getMonth() + 1).padStart(2, '0');
  const yearStr = String(ngayGD.getFullYear());
  const targetDateSlash = `${dayStr}/${monthStr}/${yearStr}`;
  const targetDateDash = `${yearStr}-${monthStr}-${dayStr}`;

  if (targetWs) {
    for (let r = 2; r <= targetWs.rowCount; r++) {
      const row = targetWs.getRow(r);
      const rowVals: any[] = [];
      const colCount = Math.max(row.cellCount || 25, 25);
      for (let c = 1; c <= colCount; c++) {
        rowVals.push(row.getCell(c).value);
      }

      // Kiểm tra xem dòng này có thuộc ngày đang chạy không (Col 1: Ngày hệ thống, Col 2: Ngày phiên)
      const d1 = String(rowVals[0] || '');
      const d2 = String(rowVals[1] || '');
      const isCurrentDay =
        d1.includes(targetDateSlash) ||
        d2.includes(targetDateSlash) ||
        d1.includes(targetDateDash) ||
        d2.includes(targetDateDash);

      if (!isCurrentDay && rowVals.some((v) => v !== null && v !== '')) {
        rowsToKeep.push(rowVals);
      }
    }
    targetWb.removeWorksheet(targetWs.id);
  }

  targetWs = targetWb.addWorksheet(sheetName);
  targetWs.getRow(1).values = headerRow.slice();

  let currentRowIdx = 2;
  // Ghi lại các dòng ngày khác
  for (const rVals of rowsToKeep) {
    targetWs.getRow(currentRowIdx).values = rVals;
    currentRowIdx++;
  }

  // Ghi các dòng giao dịch mới của ngày hôm nay
  for (const dRow of dataRows) {
    if (!dRow || dRow.length === 0 || !dRow.some((v) => v !== null && v !== '')) continue;
    targetWs.getRow(currentRowIdx).values = dRow;
    currentRowIdx++;
  }

  for (const sheet of targetWb.worksheets) {
    fixSharedFormulas(sheet);
  }

  await safeWriteExcel(targetWb, targetFilePath);
  log(`Đã ghi lũy kế ${dataRows.length} dòng DSGD vào file: ${path.basename(targetFilePath)} (Sheet ${sheetName})`);
}
