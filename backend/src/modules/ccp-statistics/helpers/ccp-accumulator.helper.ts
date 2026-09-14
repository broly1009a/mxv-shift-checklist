import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import {
  findOrCreateTargetRow,
  getSheetName,
} from '../../lot-statistics/helpers/excel-accumulator.helper';
import { ensureMonthSheetExists } from '../../lot-statistics/helpers/excel-sheet-cloner.helper';
import { safeWriteExcel } from '../../lot-statistics/helpers/excel-safe-writer.helper';
import { ensureBaseFileExists } from '../../../common/file-guard.helper';
import { CcpLotResult, CcpTvkdStat } from '../ccp-lot-statistics.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CcpAccumulatorPaths {
  /** File lũy kế số lot ACM: "Thong ke so lot giao dich ACM 2025.xlsx" */
  pathAcmLot?: string;
  /** File lũy kế giá trị ACM: "Thong ke gia tri giao dich ACM 2025.xlsx" */
  pathAcmGtgd?: string;
}

// ─── Column Mapping Constants (1-indexed, ExcelJS style) ─────────────────────

/**
 * Cấu trúc file "Thong ke so lot giao dich ACM 2025.xlsx"
 * (đã xác nhận từ file thực tế TONGHOP sheet):
 *
 *  Row 1: Title
 *  Row 2: group headers (col[0]=STT, col[1]=Ngày, col[2]="M-System", col[5]="ACM, Strait Indo"...)
 *  Row 3: sub-group (Futures...)
 *  Row 4: column labels (1-indexed in ExcelJS: col1=STT, col2=Ngày, col3=MS_DSGD, col4=MS_TTTT,
 *          col5=MS_TTM, col6=CCP_DSGD, col7=CCP_TTTT, col8=CCP_TTM, ...)
 *         TVKD headers: col11..col67
 *         HH headers:  col70=SI5CO, col71=PL1NY, col72=CP2CO
 *
 * CCP sẽ ghi vào khối "ACM, Strait Indo" (cols 6-8):
 *   col6 = CCP Số Lot GD (DSGD)
 *   col7 = CCP Số lot tất toán (TTTT)
 *   col8 = CCP Vị thế mở (TTM)
 */
const LOT_FILE_CCP_DSGD_COL = 6;   // ExcelJS 1-indexed
const LOT_FILE_CCP_TTTT_COL = 7;
const LOT_FILE_CCP_TTM_COL  = 8;
const LOT_FILE_TVKD_START   = 11;  // col11 = HN001
const LOT_FILE_TVKD_END     = 67;  // col67 = APEX080
const LOT_FILE_HEADER_ROW   = 4;   // Row 4 contains per-column labels
const LOT_FILE_HH_START     = 70;  // col70 = SI5CO
const LOT_FILE_HH_END       = 72;  // col72 = CP2CO

/**
 * Cấu trúc file "Thong ke gia tri giao dich ACM 2025.xlsx":
 *  Row 1: Title
 *  Row 3: "Tháng giao dịch" | "Giá trị giao dịch theo phiên" | ... | "Tổng"
 *  Row 4: "" | "Bạc Nano / SI5CO" | "Bạch kim Nano / PL1NY" | "Đồng Nano / CP2CO" | ...
 *  Row 5+: Data rows by month (not daily – chỉ ghi theo tháng)
 *
 * NOTE: GTGD file ghi theo tháng, không ghi daily.
 * Ta sẽ implement monthly accumulation logic riêng (gộp theo tháng).
 */

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

/**
 * Match header cell với mã TVKD 3 ký tự.
 * Header dạng "HN\n001", "SF\n002" → match với "001", "002"
 */
function matchTvkdHeader(header: string, tvkdCode: string): boolean {
  if (!header) return false;
  const normalized = header.replace(/[\s\r\n]+/g, '').toUpperCase();
  const code = tvkdCode.trim().toUpperCase();
  // Mã 3 ký tự (041, 011...) xuất hiện trong chuỗi header
  return normalized.includes(code);
}

/**
 * Match header cell với mã HH (SI5CO, PL1NY, CP2CO).
 */
function matchHhHeader(header: string, maHH: string): boolean {
  if (!header) return false;
  return header.replace(/[\s\r\n]+/g, '').toUpperCase() === maHH.toUpperCase();
}

// ─── Main: Write Lot Stats to ACM Lot File ───────────────────────────────────

/**
 * Ghi kết quả CCP Lot Statistics vào file lũy kế số lot ACM.
 *
 * Sử dụng cùng pattern với `updateAcmTrackerFile` trong MS accumulator:
 *  1. Mở workbook, tìm sheet theo tháng (T09.2026)
 *  2. findOrCreateTargetRow(ngayGD) → targetRowIndex
 *  3. Ghi block CCP (col 6-8): DSGD lot, TTTT lot, TTM lot
 *  4. Ghi per-TVKD (col 11-67): match header
 *  5. Ghi per-HH (col 70-72): SI5CO, PL1NY, CP2CO
 *  6. safeWriteExcel()
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

  // Tự động clone sheet tháng mới nếu chưa có (dùng Python openpyxl qua ensureMonthSheetExists)
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

  // ── Block CCP Summary (cols 6-8) ────────────────────────────────────────────
  ws.getCell(targetRowIndex, LOT_FILE_CCP_DSGD_COL).value = result.totalSoLot;
  ws.getCell(targetRowIndex, LOT_FILE_CCP_TTTT_COL).value = result.totalTtttLot;
  ws.getCell(targetRowIndex, LOT_FILE_CCP_TTM_COL).value  = result.totalTtmLot;
  log(`Row ${targetRowIndex}: DSGD=${result.totalSoLot}, TTTT=${result.totalTtttLot}, TTM=${result.totalTtmLot}`);

  // ── Per TVKD (cols 11-67) ────────────────────────────────────────────────────
  const headerRow = ws.getRow(LOT_FILE_HEADER_ROW);
  let tvkdWritten = 0;

  for (let col = LOT_FILE_TVKD_START; col <= LOT_FILE_TVKD_END; col++) {
    const headerVal = headerRow.getCell(col).value;
    if (headerVal === null || headerVal === undefined) continue;

    const headerText = String(headerVal);
    let sumLot = 0;

    for (const item of result.byTvkd) {
      if (matchTvkdHeader(headerText, item.tvkd)) {
        sumLot += item.soLot;
      }
    }

    ws.getCell(targetRowIndex, col).value = sumLot;
    if (sumLot > 0) tvkdWritten++;
  }

  log(`Per-TVKD: ghi ${tvkdWritten} cột có lot > 0`);

  // ── Per HH (cols 70-72: SI5CO, PL1NY, CP2CO) ────────────────────────────────
  for (let col = LOT_FILE_HH_START; col <= LOT_FILE_HH_END; col++) {
    const headerVal = headerRow.getCell(col).value;
    if (headerVal === null || headerVal === undefined) continue;

    const maHH = String(headerVal).replace(/[\s\r\n]+/g, '').toUpperCase();
    let sumLot = 0;

    for (const item of result.byTvkd) {
      for (const hh of item.byHH ?? []) {
        if (hh.maHH.toUpperCase() === maHH) {
          sumLot += hh.soLot;
        }
      }
    }

    ws.getCell(targetRowIndex, col).value = sumLot;
  }

  log(`Per-HH viết xong. Tổng CCP lot = ${result.totalSoLot}`);

  await safeWriteExcel(wb, filePath);
  log(`Đã lưu file: ${path.basename(filePath)}`);
}

// ─── GTGD Monthly Accumulator ─────────────────────────────────────────────────

/**
 * Ghi kết quả CCP GTGD vào file lũy kế giá trị ACM.
 *
 * File GTGD ACM tổng hợp theo tháng (không phải theo ngày):
 *  - Row 3: "Tháng giao dịch" | "Giá trị giao dịch theo phiên" | ...
 *  - Row 4: label tên HH (SI5CO / PL1NY / CP2CO)
 *  - Row 5+: data theo tháng (vd "04/2025", "05/2025"...)
 *
 * Mỗi lần ghi: cộng dồn GTGD vào dòng tháng hiện tại (upsert).
 */
export async function writeCcpGtgdToAccumulator(
  result: CcpLotResult,
  filePath: string,
  jobLogs?: string[],
): Promise<void> {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File lũy kế GTGD ACM CCP không tồn tại: "${filePath}". Vui lòng kiểm tra cấu hình đường dẫn.`,
    );
  }

  backupFile(filePath);

  const ngayGD = new Date(result.ngayGD);
  const thangGD = `${String(ngayGD.getMonth() + 1).padStart(2, '0')}/${ngayGD.getFullYear()}`;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  // Sheet đầu tiên (TONGHOP) — hoặc sheet theo tháng nếu có
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File GTGD ACM không có worksheet nào.');

  const log = (msg: string) => jobLogs?.push(`[CCP-GTGD-ACC] ${msg}`);

  // Tìm row header HH (row 4 = index 4 trong ExcelJS 1-indexed)
  const hhHeaderRow = ws.getRow(4);

  // Map maHH → cột (ExcelJS 1-indexed)
  const hhColMap: Record<string, number> = {};
  for (let col = 1; col <= 10; col++) {
    const v = hhHeaderRow.getCell(col).value;
    if (v) {
      const maHH = String(v).replace(/[\s\r\n]+/g, '').toUpperCase();
      if (['SI5CO', 'PL1NY', 'CP2CO'].includes(maHH)) {
        hhColMap[maHH] = col;
      }
    }
  }

  // Tìm row tháng hiện tại hoặc tạo mới
  let targetRowIdx = -1;
  let lastDataRow = 4;
  for (let r = 5; r <= ws.rowCount + 5; r++) {
    const cellVal = ws.getCell(r, 1).value;
    if (cellVal === null || cellVal === undefined || String(cellVal).trim() === '') break;
    const cellStr = String(cellVal).trim();
    if (cellStr === thangGD) { targetRowIdx = r; break; }
    lastDataRow = r;
  }

  if (targetRowIdx === -1) {
    targetRowIdx = lastDataRow + 1;
    ws.getCell(targetRowIdx, 1).value = thangGD;
  }

  // Tính GTGD per HH
  const gtgdByHH: Record<string, number> = {};
  for (const tvkd of result.byTvkd) {
    for (const hh of tvkd.byHH ?? []) {
      const maHH = hh.maHH.toUpperCase();
      gtgdByHH[maHH] = (gtgdByHH[maHH] ?? 0) + hh.giaTri;
    }
  }

  // Tính tổng GTGD toàn bộ
  let tongGtgd = 0;
  for (const [maHH, col] of Object.entries(hhColMap)) {
    const existing = Number(ws.getCell(targetRowIdx, col).value ?? 0);
    const newVal = existing + (gtgdByHH[maHH] ?? 0);
    ws.getCell(targetRowIdx, col).value = newVal;
    tongGtgd += newVal;
  }

  // Cột Tổng (col 5 trong file GTGD)
  ws.getCell(targetRowIdx, 5).value = tongGtgd;

  log(`Tháng ${thangGD}: row ${targetRowIdx}, Tổng GTGD=${tongGtgd.toLocaleString('vi-VN')} VND`);

  await safeWriteExcel(wb, filePath);
  log(`Đã lưu file: ${path.basename(filePath)}`);
}
