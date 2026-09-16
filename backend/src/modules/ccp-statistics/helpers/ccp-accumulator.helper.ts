import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import {
  findOrCreateTargetRow,
  getSheetName,
} from '../../lot-statistics/helpers/excel-accumulator.helper';
import { findOrCreateValueTargetRow } from '../../lot-statistics/helpers/excel-value-accumulator.helper';
import { ensureMonthSheetExists } from '../../lot-statistics/helpers/excel-sheet-cloner.helper';
import { safeWriteExcel } from '../../lot-statistics/helpers/excel-safe-writer.helper';
import { ensureBaseFileExists } from '../../../common/file-guard.helper';
import { CcpLotResult } from '../ccp-lot-statistics.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CcpAccumulatorPaths {
  /** File lũy kế số lot ACM: "Thong ke so lot giao dich ACM [year].xlsx" */
  pathAcmLot?: string;
  /** File lũy kế giá trị ACM: "Thong ke gia tri giao dich ACM [year].xlsx" */
  pathAcmGtgd?: string;
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
