import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { MarginExcelParser } from '../../parsers';
import { extractCqgSnapshotTime } from '../../parsers/cqg-excel.parser';
import { SystemSettingsService } from '../../../system-settings/system-settings.service';
import { TelegramService } from '../../../telegram/telegram.service';
import { resolveStoragePathCrossPlatform, resolveDailySubfolder, FAST_XLSX_READ_OPTIONS as FAST_XLSX_OPTS } from '../../../../shared';

export interface CqgAuditResult {
  key: string;
  filename: string;
  type: 'RAW' | 'CONSOLIDATED' | 'MANUAL';
  status: 'OK' | 'MISSING' | 'OUTDATED';
  lastModified?: Date;
}

export const REQUIRED_CQG_FILES = [
  { key: 'FR1', filename: 'FR1.xlsx', type: 'RAW' as const },
  { key: 'FR2', filename: 'FR2.xlsx', type: 'RAW' as const },
  { key: 'OD1', filename: 'OD1.xlsx', type: 'RAW' as const },
  { key: 'OD2', filename: 'OD2.xlsx', type: 'RAW' as const },
  { key: 'OP1', filename: 'OP1.xlsx', type: 'RAW' as const },
  { key: 'OP2', filename: 'OP2.xlsx', type: 'RAW' as const },
  { key: 'PS1', filename: 'PS1.xlsx', type: 'RAW' as const },
  { key: 'PS2', filename: 'PS2.xlsx', type: 'RAW' as const },
  { key: 'FR', filename: 'FR.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'Od', filename: 'Od.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'OP', filename: 'OP.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'PS', filename: 'PS.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'AS', filename: 'AS.xlsx', type: 'MANUAL' as const },
];

export interface ICqgMergeResult {
  success: boolean;
  mergedFiles: string[];
  logs: string[];
  errors: string[];
}

export interface CqgPairValidationResult {
  isValid: boolean;
  reason?: string;
  stat1?: fs.Stats;
  stat2?: fs.Stats;
  mtimeDiffMinutes?: number;
  snap1?: Date | null;
  snap2?: Date | null;
}

export interface CqgMergeOptions {
  checkFreshness?: boolean;
  maxTimeGapMinutes?: number;
  requireBothFiles?: boolean;
}

/**
 * Kiểm định tính đồng bộ và độ tươi của 2 file thô từ 2 tài khoản CQG trước khi ghép nối.
 * Ngăn chặn tuyệt đối việc ghép 1 file mới hôm nay với 1 file sót lại từ hôm qua (Fail-Fast & Zero-Silent-Swallow).
 */
export function validateCqgPairFreshness(
  src1: string,
  src2: string,
  options?: {
    maxTimeGapMinutes?: number;
    requireBothFiles?: boolean;
    logger?: Logger;
  },
): CqgPairValidationResult {
  const exists1 = fs.existsSync(src1);
  const exists2 = fs.existsSync(src2);

  if (!exists1 && !exists2) {
    return {
      isValid: false,
      reason: `Cả hai file nguồn đều không tồn tại: ${path.basename(src1)}, ${path.basename(src2)}`,
    };
  }

  // 1. Kiểm tra thiếu file khi bắt buộc cả 2 tài khoản
  if (!exists1 || !exists2) {
    const presentFile = exists1 ? src1 : src2;
    const missingFile = exists1 ? src2 : src1;
    if (options?.requireBothFiles !== false) {
      return {
        isValid: false,
        reason: `Thiếu file nguồn của 1 tài khoản CQG (${path.basename(missingFile)}). Chỉ tìm thấy ${path.basename(presentFile)}. Cần đủ cả 2 tài khoản để tránh thiếu hụt 50% dữ liệu.`,
      };
    }
    return {
      isValid: true,
      reason: `Chỉ tồn tại 1 file (${path.basename(presentFile)}), nhưng cờ requireBothFiles=false cho phép xử lý.`,
    };
  }

  // 2. Cả 2 file đều tồn tại -> Lấy stat
  const stat1 = fs.statSync(src1);
  const stat2 = fs.statSync(src2);

  // 3. Kiểm tra Header Snapshot Date (nếu có trong nội dung file)
  const snap1 = extractCqgSnapshotTime(src1);
  const snap2 = extractCqgSnapshotTime(src2);
  if (snap1 && snap2) {
    const d1 = snap1.toISOString().split('T')[0];
    const d2 = snap2.toISOString().split('T')[0];
    if (d1 !== d2) {
      return {
        isValid: false,
        stat1,
        stat2,
        snap1,
        snap2,
        reason: `Phát hiện 2 file CQG thuộc về 2 ngày giao dịch khác nhau trong Header: ${path.basename(src1)} (${d1}) vs ${path.basename(src2)} (${d2}). Tuyệt đối không được ghép!`,
      };
    }
  }

  // 4. Kiểm tra khoảng cách thời gian ghi đĩa (mtime gap)
  const maxGapMs = (options?.maxTimeGapMinutes ?? 60) * 60 * 1000;
  const diffMs = Math.abs(stat1.mtimeMs - stat2.mtimeMs);
  const diffMin = Math.round(diffMs / (60 * 1000));

  if (diffMs > maxGapMs) {
    return {
      isValid: false,
      stat1,
      stat2,
      snap1,
      snap2,
      mtimeDiffMinutes: diffMin,
      reason: `Khoảng cách thời gian sửa đổi giữa ${path.basename(src1)} (${stat1.mtime.toLocaleTimeString('vi-VN')}) và ${path.basename(src2)} (${stat2.mtime.toLocaleTimeString('vi-VN')}) vượt ngưỡng an toàn (${diffMin} phút > ${options?.maxTimeGapMinutes ?? 60} phút). Nghi ngờ 1 trong 2 file là file tồn đọng từ phiên cũ!`,
    };
  }

  return {
    isValid: true,
    stat1,
    stat2,
    snap1,
    snap2,
    mtimeDiffMinutes: diffMin,
  };
}

function findHeaderIndex(header: string[], primary: string, aliases: string[] = []): number {
  const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const targets = [primary, ...aliases].map(norm);
  return header.findIndex((h) => {
    const nh = norm(h);
    return targets.some((t) => nh === t || nh.includes(t));
  });
}

function findLatestFile(dir: string, pattern: RegExp): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => pattern.test(f));
  if (files.length === 0) return null;
  files.sort((a, b) => {
    const sa = fs.statSync(path.join(dir, a)).mtimeMs;
    const sb = fs.statSync(path.join(dir, b)).mtimeMs;
    return sb - sa;
  });
  return path.join(dir, files[0]);
}

function parseCqgNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (!str) return 0;
  let normalized = str;
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastDot < lastComma) {
      normalized = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      normalized = str.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    normalized = str.replace(/,/g, '.');
  }
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

@Injectable()
export class CqgMergerService {
  private readonly logger = new Logger(CqgMergerService.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
    @Optional()
    private readonly telegramService?: TelegramService,
  ) {}

  /**
   * Ghép FR1.xlsx + FR2.xlsx -> FR.xlsx (Giao dịch khớp lệnh)
   *
   * QUY CHUẨN BẢO TỒN 100% TỪ C# FILEUTILS.CS & MONOLITH V1:
   * - Lấy header từ hàng 2 (index 1) hoặc hàng 1.
   * - Bỏ 2 dòng chân trang (Footer rows) của từng file thô: data = rows.slice(2, lr - 2).
   */
  mergeFR(src1: string, src2: string, dest: string, options?: CqgMergeOptions): boolean {
    if (options?.checkFreshness !== false) {
      const validation = validateCqgPairFreshness(src1, src2, {
        maxTimeGapMinutes: options?.maxTimeGapMinutes,
        requireBothFiles: options?.requireBothFiles,
        logger: this.logger,
      });
      if (!validation.isValid) {
        this.logger.error(`[CQG Merger Guard] Chặn ghép FR: ${validation.reason}`);
        throw new Error(`[CQG Merger Guard] ${validation.reason}`);
      }
    }

    let rows1: any[][] = [];
    if (fs.existsSync(src1)) {
      try {
        const wb1 = XLSX.readFile(src1, FAST_XLSX_OPTS);
        rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src1}: ${err.message}`);
      }
    }

    let rows2: any[][] = [];
    if (fs.existsSync(src2)) {
      try {
        const wb2 = XLSX.readFile(src2, FAST_XLSX_OPTS);
        rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src2}: ${err.message}`);
      }
    }

    const lr1 = rows1.length;
    const lr2 = rows2.length;

    const headerRow = rows1[1] || rows1[0] || rows2[1] || rows2[0] || [];
    const data1 = lr1 > 4 ? rows1.slice(2, lr1 - 2) : lr1 > 2 ? rows1.slice(2) : [];
    const data2 = lr2 > 4 ? rows2.slice(2, lr2 - 2) : lr2 > 2 ? rows2.slice(2) : [];

    // Khử trùng (Deduplicate) giữa FR1 và FR2 nếu có bản ghi khớp lệnh xuất hiện ở cả 2 file (do tài khoản thuộc quyền xem của cả 2 user CQG)
    // Lưu ý quan trọng: Một lệnh (Ord #) có thể khớp làm nhiều phần (partial fills). TUYỆT ĐỐI không khử trùng chỉ theo Ord # vì sẽ làm mất các lần khớp tiếp theo.
    // Chỉ loại bỏ bản ghi trong FR2 nếu bản ghi đó trùng khớp hoàn toàn (composite key: ord, account, symbol, qty, fillP, time) với một bản ghi đã có ở FR1.
    const normHeaders = headerRow.map((h: any) => String(h || '').trim());
    const ordIdx = findHeaderIndex(normHeaders, 'Ord #', ['ord', 'ord #', 'order', 'order #']);
    const accIdx = findHeaderIndex(normHeaders, 'Account', ['account', 'acc', 'tk']);
    const symIdx = findHeaderIndex(normHeaders, 'Symbol', ['symbol', 'sym', 'contract']);
    const qtyIdx = findHeaderIndex(normHeaders, 'Qty', ['qty', 'quantity', 'kl']);
    const fillPIdx = findHeaderIndex(normHeaders, 'Fill P', ['fill p', 'fill price', 'price', 'gia']);
    const timeIdx = findHeaderIndex(normHeaders, 'Time', ['time', 'gio']);

    const seenFr1Records = new Set<string>();
    for (const r of data1) {
      const key = `${r[ordIdx] || ''}|${r[accIdx] || ''}|${r[symIdx] || ''}|${r[qtyIdx] || ''}|${r[fillPIdx] || ''}|${r[timeIdx] || ''}`;
      seenFr1Records.add(key);
    }

    const uniqueData2: any[] = [];
    let dupCount = 0;
    for (const r of data2) {
      const key = `${r[ordIdx] || ''}|${r[accIdx] || ''}|${r[symIdx] || ''}|${r[qtyIdx] || ''}|${r[fillPIdx] || ''}|${r[timeIdx] || ''}`;
      if (seenFr1Records.has(key)) {
        dupCount++;
        continue;
      }
      uniqueData2.push(r);
    }

    if (dupCount > 0) {
      this.logger.log(`[CQG Merger] Đã khử trùng ${dupCount} bản ghi khớp lệnh trùng lặp giữa FR1 và FR2 theo composite key (Ord/Account/Symbol/Qty/Price/Time).`);
    }

    const mergedData: any[] = [];
    if (headerRow && headerRow.length > 0) {
      mergedData.push(headerRow);
    }
    mergedData.push(...data1, ...uniqueData2);

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const nwb = XLSX.utils.book_new();
    const ns = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
    XLSX.writeFile(nwb, dest, { compression: true });
    this.logger.log(
      `[CQG Merger] Ghép FR thành công: FR1 (${data1.length}) + FR2 (${uniqueData2.length}${dupCount > 0 ? `, đã khử ${dupCount} trùng` : ''}) -> ${dest}`,
    );
    return true;
  }

  /**
   * Ghép OP1.xlsx + OP2.xlsx -> OP.xlsx (Trạng thái mở)
   */
  mergeOP(src1: string, src2: string, dest: string, options?: CqgMergeOptions): boolean {
    if (options?.checkFreshness !== false) {
      const validation = validateCqgPairFreshness(src1, src2, {
        maxTimeGapMinutes: options?.maxTimeGapMinutes,
        requireBothFiles: options?.requireBothFiles,
        logger: this.logger,
      });
      if (!validation.isValid) {
        this.logger.error(`[CQG Merger Guard] Chặn ghép OP: ${validation.reason}`);
        throw new Error(`[CQG Merger Guard] ${validation.reason}`);
      }
    }

    let rows1: any[][] = [];
    if (fs.existsSync(src1)) {
      try {
        const wb1 = XLSX.readFile(src1, FAST_XLSX_OPTS);
        rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src1}: ${err.message}`);
      }
    }

    const headerRow = rows1[1] || [];
    const data1 = rows1.slice(2);
    const mergedData = [headerRow, ...data1];

    if (fs.existsSync(src2)) {
      try {
        const wb2 = XLSX.readFile(src2, FAST_XLSX_OPTS);
        const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 }) as any[][];
        if (rows2.length > 3) {
          const data2 = rows2.slice(2);
          mergedData.push(...data2);
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src2}: ${err.message}`);
      }
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const nwb = XLSX.utils.book_new();
    const ns = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
    XLSX.writeFile(nwb, dest, { compression: true });
    this.logger.log(`[CQG Merger] Ghép OP thành công -> ${dest}`);
    return true;
  }

  /**
   * Ghép OD1.xlsx + OD2.xlsx -> Od.xlsx (Sổ lệnh)
   */
  mergeOD(src1: string, src2: string, dest: string, options?: CqgMergeOptions): boolean {
    if (options?.checkFreshness !== false) {
      const validation = validateCqgPairFreshness(src1, src2, {
        maxTimeGapMinutes: options?.maxTimeGapMinutes,
        requireBothFiles: options?.requireBothFiles,
        logger: this.logger,
      });
      if (!validation.isValid) {
        this.logger.error(`[CQG Merger Guard] Chặn ghép OD: ${validation.reason}`);
        throw new Error(`[CQG Merger Guard] ${validation.reason}`);
      }
    }

    let rows1: any[][] = [];
    if (fs.existsSync(src1)) {
      try {
        const wb1 = XLSX.readFile(src1, FAST_XLSX_OPTS);
        rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src1}: ${err.message}`);
      }
    }

    const lr1 = rows1.length;
    const data1 = rows1.slice(2);
    let mergedData = [...data1];

    if (fs.existsSync(src2)) {
      try {
        const wb2 = XLSX.readFile(src2, FAST_XLSX_OPTS);
        const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 }) as any[][];
        if (rows2.length > 3) {
          const data2 = rows2.slice(3);
          const pasteIdx = lr1 - 4;
          if (pasteIdx >= 0 && pasteIdx < data1.length) {
            mergedData = data1.slice(0, pasteIdx).concat(data2);
          } else {
            mergedData.push(...data2);
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src2}: ${err.message}`);
      }
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const nwb = XLSX.utils.book_new();
    const ns = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
    XLSX.writeFile(nwb, dest, { compression: true });
    this.logger.log(`[CQG Merger] Ghép OD thành công -> ${dest}`);
    return true;
  }

  /**
   * Ghép PS1.xlsx + PS2.xlsx -> PS.xlsx kèm xây dựng 3 Sheet đối chiếu vị thế:
   * Sheet 1: Sheet1 (Dữ liệu gộp)
   * Sheet 2: Check CQG-MS (Quy chuẩn hậu tố tài khoản: F$ -> "", L$ -> "-L", S$ -> "-S")
   * Sheet 3: Check MS-CQG (Đối soát với TTM của M-System)
   */
  mergePS(src1: string, src2: string, dest: string, ttmPath?: string, options?: CqgMergeOptions): boolean {
    if (options?.checkFreshness !== false) {
      const validation = validateCqgPairFreshness(src1, src2, {
        maxTimeGapMinutes: options?.maxTimeGapMinutes,
        requireBothFiles: options?.requireBothFiles,
        logger: this.logger,
      });
      if (!validation.isValid) {
        this.logger.error(`[CQG Merger Guard] Chặn ghép PS: ${validation.reason}`);
        throw new Error(`[CQG Merger Guard] ${validation.reason}`);
      }
    }
    let rows1: any[][] = [];
    if (fs.existsSync(src1)) {
      try {
        const wb1 = XLSX.readFile(src1, FAST_XLSX_OPTS);
        rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src1}: ${err.message}`);
      }
    }

    let rows2: any[][] = [];
    if (fs.existsSync(src2)) {
      try {
        const wb2 = XLSX.readFile(src2, FAST_XLSX_OPTS);
        rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src2}: ${err.message}`);
      }
    }

    // 1. Merge Sheet1
    const headerRow = rows1[1] || rows1[0] || rows2[1] || rows2[0] || [];
    const data1 = rows1.length > 2 ? rows1.slice(2) : [];
    const data2 = rows2.length > 2 ? rows2.slice(2) : [];
    const mergedData: any[] = [];
    if (headerRow && headerRow.length > 0) {
      mergedData.push(headerRow);
    }
    mergedData.push(...data1, ...data2);

    const ws1 = XLSX.utils.aoa_to_sheet(mergedData);

    // 2. Check CQG-MS Sheet
    const sheet2Rows = mergedData
      .filter((row, idx) => {
        if (idx === 0) return true;
        return row[0] !== undefined && row[0] !== null && String(row[0]).trim() !== '';
      })
      .map((row) => row.slice(0, 10));

    // Xử lý hậu tố mã tài khoản: F$ -> "", L$ -> "-L", S$ -> "-S"
    for (let i = 1; i < sheet2Rows.length; i++) {
      let acc = String(sheet2Rows[i][0] || '').trim();
      acc = acc
        .replace(/F$/i, '')
        .replace(/L$/i, '-L')
        .replace(/S$/i, '-S')
        .replace(/--/g, '-');
      sheet2Rows[i][0] = acc;
    }

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);

    // Công thức tính toán đối soát cho Check CQG-MS
    for (let i = 1; i < sheet2Rows.length; i++) {
      const r = i + 1;
      ws2[XLSX.utils.encode_cell({ r: i, c: 10 })] = { t: 's', f: `A${r}&D${r}`, v: '' }; // Ma check
      ws2[XLSX.utils.encode_cell({ r: i, c: 11 })] = { t: 'n', f: `I${r}`, v: 0 }; // CQG
      ws2[XLSX.utils.encode_cell({ r: i, c: 12 })] = {
        t: 'n',
        f: `SUMIF('Check MS-CQG'!Z:Z,'Check CQG-MS'!K${r},'Check MS-CQG'!T:T)`,
        v: 0,
      }; // MS
      ws2[XLSX.utils.encode_cell({ r: i, c: 13 })] = { t: 'n', f: `L${r}-M${r}`, v: 0 }; // Check
    }

    ws2[XLSX.utils.encode_cell({ r: 0, c: 10 })] = { t: 's', v: 'Ma check' };
    ws2[XLSX.utils.encode_cell({ r: 0, c: 11 })] = { t: 's', v: 'CQG' };
    ws2[XLSX.utils.encode_cell({ r: 0, c: 12 })] = { t: 's', v: 'MS' };
    ws2[XLSX.utils.encode_cell({ r: 0, c: 13 })] = { t: 's', v: 'Check' };

    if (ws2['!ref']) {
      const range = XLSX.utils.decode_range(ws2['!ref']);
      range.e.c = 13;
      ws2['!ref'] = XLSX.utils.encode_range(range);
    }

    // 3. Check MS-CQG Sheet
    let ttmRows: any[][] = [];
    if (ttmPath && fs.existsSync(ttmPath)) {
      try {
        const wbTtm = XLSX.readFile(ttmPath, FAST_XLSX_OPTS);
        ttmRows = XLSX.utils.sheet_to_json(wbTtm.Sheets[wbTtm.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.error(`Không thể đọc file TTM tại ${ttmPath}: ${err.message}`);
      }
    }

    const sheet3Rows = ttmRows.map((row) => {
      const newRow = [...row];
      while (newRow.length < 20) {
        newRow.push(null);
      }
      return newRow;
    });

    if (sheet3Rows.length === 0) {
      const emptyHeaders = Array(20).fill(null);
      emptyHeaders[7] = 'Mã TKGD';
      emptyHeaders[9] = 'Mã HĐ';
      emptyHeaders[19] = 'KL ròng';
      sheet3Rows.push(emptyHeaders);
    }

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);

    for (let i = 1; i < sheet3Rows.length; i++) {
      const r = i + 1;
      ws3[XLSX.utils.encode_cell({ r: i, c: 25 })] = { t: 's', f: `H${r}&J${r}`, v: '' }; // Ma check
      ws3[XLSX.utils.encode_cell({ r: i, c: 26 })] = { t: 'n', f: `SUMIF(Z:Z,Z${r},T:T)`, v: 0 }; // MS
      ws3[XLSX.utils.encode_cell({ r: i, c: 27 })] = {
        t: 'n',
        f: `VLOOKUP(Z${r},'Check CQG-MS'!K:L,2,0)`,
        v: 0,
      }; // CQG
      ws3[XLSX.utils.encode_cell({ r: i, c: 28 })] = { t: 'n', f: `AA${r}-AB${r}`, v: 0 }; // Check
    }

    ws3[XLSX.utils.encode_cell({ r: 0, c: 25 })] = { t: 's', v: 'Ma check' };
    ws3[XLSX.utils.encode_cell({ r: 0, c: 26 })] = { t: 's', v: 'MS' };
    ws3[XLSX.utils.encode_cell({ r: 0, c: 27 })] = { t: 's', v: 'CQG' };
    ws3[XLSX.utils.encode_cell({ r: 0, c: 28 })] = { t: 's', v: 'Check' };

    if (ws3['!ref']) {
      const range = XLSX.utils.decode_range(ws3['!ref']);
      range.e.c = 28;
      ws3['!ref'] = XLSX.utils.encode_range(range);
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1');
    XLSX.utils.book_append_sheet(wb, ws2, 'Check CQG-MS');
    XLSX.utils.book_append_sheet(wb, ws3, 'Check MS-CQG');
    XLSX.writeFile(wb, dest, { compression: true });
    this.logger.log(`[CQG Merger] Ghép PS thành công cả 3 sheet -> ${dest}`);
    return true;
  }

  /**
   * Tự động quét và ghép toàn bộ 4 cặp file thô có trong thư mục chỉ định
   */
  mergeAll(folder: string, ttmPath?: string, options?: CqgMergeOptions): ICqgMergeResult {
    const logs: string[] = [];
    const errors: string[] = [];
    const mergedFiles: string[] = [];

    // 1. Merge FR
    const fr1 = path.join(folder, 'FR1.xlsx');
    const fr2 = path.join(folder, 'FR2.xlsx');
    const frDest = path.join(folder, 'FR.xlsx');
    if (fs.existsSync(fr1) || fs.existsSync(fr2)) {
      try {
        this.mergeFR(fr1, fr2, frDest, options);
        mergedFiles.push(frDest);
        logs.push('Ghép thành công FR.xlsx');
      } catch (e: any) {
        errors.push(`Lỗi ghép FR.xlsx: ${e.message}`);
      }
    }

    // 2. Merge OP
    const op1 = path.join(folder, 'OP1.xlsx');
    const op2 = path.join(folder, 'OP2.xlsx');
    const opDest = path.join(folder, 'OP.xlsx');
    if (fs.existsSync(op1) || fs.existsSync(op2)) {
      try {
        this.mergeOP(op1, op2, opDest, options);
        mergedFiles.push(opDest);
        logs.push('Ghép thành công OP.xlsx');
      } catch (e: any) {
        errors.push(`Lỗi ghép OP.xlsx: ${e.message}`);
      }
    }

    // 3. Merge OD
    const od1 = path.join(folder, 'OD1.xlsx');
    const od2 = path.join(folder, 'OD2.xlsx');
    const odDest = path.join(folder, 'Od.xlsx');
    if (fs.existsSync(od1) || fs.existsSync(od2)) {
      try {
        this.mergeOD(od1, od2, odDest, options);
        mergedFiles.push(odDest);
        logs.push('Ghép thành công Od.xlsx');
      } catch (e: any) {
        errors.push(`Lỗi ghép Od.xlsx: ${e.message}`);
      }
    }

    // 4. Merge PS
    const ps1 = path.join(folder, 'PS1.xlsx');
    const ps2 = path.join(folder, 'PS2.xlsx');
    const psDest = path.join(folder, 'PS.xlsx');
    if (fs.existsSync(ps1) || fs.existsSync(ps2)) {
      try {
        this.mergePS(ps1, ps2, psDest, ttmPath, options);
        mergedFiles.push(psDest);
        logs.push('Ghép thành công PS.xlsx');
      } catch (e: any) {
        errors.push(`Lỗi ghép PS.xlsx: ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      mergedFiles,
      logs,
      errors,
    };
  }

  /**
   * Đối chiếu số dư CQG (CheckEODCQG)
   */
  async checkEODCQG(
    files: {
      qltkgd: Buffer;
      accountsBalances: Buffer;
      qltkgdName?: string;
      accountsBalancesName?: string;
    },
    usdExchangeRate?: number,
  ): Promise<
    Array<{
      maTKGD: string;
      calculatedBalance: number;
      cqgBalance: number;
      differ: number;
      inMS: boolean;
      inCQG: boolean;
    }>
  > {
    let effectiveRate = usdExchangeRate;
    if (!effectiveRate || effectiveRate <= 0) {
      if (this.settingsService) {
        const usdRateStr = await this.settingsService.getSetting('usd_exchange_rate', '25400');
        effectiveRate = parseFloat(usdRateStr) || 25400;
      } else {
        effectiveRate = 25400;
      }
    }

    // 1. Parse QLTKGD.xlsx qua MarginExcelParser dùng chung
    const qltkgdRes = MarginExcelParser.parseQltkgd(files.qltkgd, { fileName: files.qltkgdName });
    const qltkgdDataMap = qltkgdRes.dataMap;

    // 2. Parse Accounts_Balances.xlsx
    const asWorkbook = XLSX.read(files.accountsBalances, { type: 'buffer' });
    const asSheet = asWorkbook.Sheets[asWorkbook.SheetNames[0]];
    if (!asSheet) throw new Error('Không tìm thấy sheet nào trong Accounts_Balances.xlsx');
    const asRows = XLSX.utils.sheet_to_json(asSheet, { header: 1 }) as any[][];
    if (asRows.length < 2) throw new Error('File Accounts_Balances.xlsx rỗng');

    const asHeader = asRows[0].map((h: any) => String(h || '').trim());
    const accountNumberIdx = findHeaderIndex(asHeader, 'Account Number', ['Account', 'Tài khoản', 'Mã TKGD', 'Tai khoan']);
    const endCashBalanceIdx = findHeaderIndex(asHeader, 'End Cash Balance', ['Cash Balance', 'Balance', 'Số dư', 'Số dư cuối ngày']);
    const recordDescriptionIdx = findHeaderIndex(asHeader, 'Record Description', ['Description', 'Mô tả']);

    const asName = files.accountsBalancesName || 'Accounts_Balances.xlsx';
    if (accountNumberIdx === -1 || endCashBalanceIdx === -1) {
      throw new Error(`${asName} không hợp lệ vì thiếu các cột: Account Number hoặc End Cash Balance.`);
    }

    const cqgBalanceMap = new Map<string, number>();
    for (let i = 1; i < asRows.length; i++) {
      const row = asRows[i];
      if (!row || row.length === 0) continue;

      const recordDescription = recordDescriptionIdx !== -1 ? String(row[recordDescriptionIdx] || '').trim() : '';
      if (!recordDescription.startsWith('Current-day')) continue;

      const account = String(row[accountNumberIdx] || '').trim();
      const balance = parseCqgNumber(row[endCashBalanceIdx]);
      if (!account) continue;

      let accountRaw = account;
      if (accountRaw.endsWith('L') || accountRaw.endsWith('l')) {
        accountRaw = accountRaw.substring(0, accountRaw.length - 1) + '-L';
      } else if (accountRaw.endsWith('S') || accountRaw.endsWith('s')) {
        accountRaw = accountRaw.substring(0, accountRaw.length - 1) + '-S';
      } else if (accountRaw.endsWith('F') || accountRaw.endsWith('f')) {
        accountRaw = accountRaw.substring(0, accountRaw.length - 1);
      }

      const existingBalance = cqgBalanceMap.get(accountRaw) || 0;
      cqgBalanceMap.set(accountRaw, existingBalance + balance);
    }

    // 3. Compare balances
    const result: Array<{
      maTKGD: string;
      calculatedBalance: number;
      cqgBalance: number;
      differ: number;
      inMS: boolean;
      inCQG: boolean;
    }> = [];

    for (const maTKGD of cqgBalanceMap.keys()) {
      if (maTKGD.startsWith('999') || maTKGD.startsWith('050') || !/^\d/.test(maTKGD)) continue;

      const qltkgdRow = qltkgdDataMap.get(maTKGD);
      const cqgBalance = cqgBalanceMap.get(maTKGD) ?? 0;

      if (qltkgdRow) {
        const calculated = (qltkgdRow.soDuTKKQHienTai + qltkgdRow.choDaoHan - qltkgdRow.laiLoVND) / effectiveRate;
        const roundedCalc = Math.round(calculated * 100) / 100;
        const roundedCQG = Math.round(cqgBalance * 100) / 100;
        const differ = Math.abs(roundedCalc - roundedCQG);

        if (differ > 100) {
          result.push({
            maTKGD,
            calculatedBalance: roundedCalc,
            cqgBalance: roundedCQG,
            differ,
            inMS: true,
            inCQG: true,
          });
        }
      } else {
        result.push({
          maTKGD,
          calculatedBalance: 0,
          cqgBalance: Math.round(cqgBalance * 100) / 100,
          differ: Math.abs(cqgBalance),
          inMS: false,
          inCQG: true,
        });
      }
    }

    return result;
  }

  /**
   * Tự động kiểm tra đối chiếu đồng bộ số dư CQG (runAutoCheckCQGSync)
   */
  async runAutoCheckCQGSync(tradingDate: Date): Promise<any> {
    if (!this.settingsService) {
      throw new Error('SystemSettingsService chưa sẵn sàng trong CqgMergerService.');
    }

    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_ms',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
      ),
    );
    const cqgBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_cqg',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
      ),
    );

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);

    const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');
    const accountsBalancesPath =
      findLatestFile(cqgDailyPath, /Accounts_Balances/i) ||
      findLatestFile(msDailyPath, /Accounts_Balances/i);

    if (!fs.existsSync(qltkgdPath)) {
      throw new Error(`Thiếu file QLTKGD.xlsx tại ${qltkgdPath}`);
    }
    if (!accountsBalancesPath) {
      throw new Error('Không tìm thấy file Accounts_Balances.xlsx từ CQG');
    }

    const usdRateStr = await this.settingsService.getSetting('usd_exchange_rate', '25400');
    const usdRate = parseFloat(usdRateStr) || 25400;

    const cqgResult = await this.checkEODCQG(
      {
        qltkgd: fs.readFileSync(qltkgdPath),
        accountsBalances: fs.readFileSync(accountsBalancesPath),
      },
      usdRate,
    );

    const totalMismatched = cqgResult ? cqgResult.length : 0;
    let telegramMsg = ` [ĐỐI CHIẾU ĐỒNG BỘ SỐ DƯ CQG - ${day}/${month}/${year}]\n`;
    telegramMsg += `• Trạng thái: ${totalMismatched === 0 ? '✓ Khớp hoàn toàn giữa MS và CQG' : 'PHÁT HIỆN LỆCH SỐ DƯ'}\n`;
    telegramMsg += `• Số tài khoản lệch số dư CQG (> $100): ${totalMismatched}\n`;

    if (this.telegramService) {
      await this.telegramService.sendMessage(telegramMsg).catch(() => {});
    }

    return {
      cqgResult,
      totals: {
        totalMismatchedCQG: totalMismatched,
      },
    };
  }

  /**
   * Retrieves the configured CQG backup base folder and resolves the daily subfolder.
   * Path format: baseDir\YYYY\TMM.YYYY\DD.MM
   */
  async getDailyBackupPath(
    targetDate: Date = new Date(),
  ): Promise<{ baseDir: string; fullPath: string }> {
    const rawBaseDir = this.settingsService
      ? await this.settingsService.getSetting(
          'bot_backup_path_cqg',
          'M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
        )
      : 'M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures';
    const baseDir = resolveStoragePathCrossPlatform(rawBaseDir);
    const { fullPath } = resolveDailySubfolder(baseDir, targetDate);
    return { baseDir, fullPath };
  }

  /**
   * Scans the daily backup folder and returns the status of required files.
   */
  async scanCqgBackupFiles(
    targetDate: Date = new Date(),
    customDir?: string,
  ): Promise<CqgAuditResult[]> {
    let fullPath = customDir;
    if (!fullPath) {
      const backupPathRes = await this.getDailyBackupPath(targetDate);
      fullPath = backupPathRes.fullPath;
      if (!fs.existsSync(fullPath)) {
        // Fallback: Kiểm tra thư mục TradingCheck trong phiên nếu thư mục Backup CQG chưa tồn tại
        const baseDir = resolveStoragePathCrossPlatform(backupPathRes.baseDir);
        const year = targetDate.getFullYear().toString();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
        const tradingCheckBase = baseDir
          .replace(/Backup CQG[\\/]Futures/i, 'TradingCheck/Futures/CQG')
          .replace(/Backup CQG/i, 'TradingCheck/CQG');
        const tradingCheckFullPath = path.join(tradingCheckBase, subFolder);
        if (fs.existsSync(tradingCheckFullPath)) {
          fullPath = tradingCheckFullPath;
        }
      }
    }
    const results: CqgAuditResult[] = [];

    // Scan CQG files
    for (const f of REQUIRED_CQG_FILES) {
      let filePath = path.join(fullPath, f.filename);
      if (f.key === 'AS' && (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0)) {
        const altPath = path.join(fullPath, 'Accounts_Balances.xlsx');
        if (fs.existsSync(altPath) && fs.statSync(altPath).size > 0) {
          filePath = altPath;
        }
      }

      if (!fs.existsSync(fullPath) || !fs.existsSync(filePath)) {
        results.push({
          key: f.key,
          filename: f.filename,
          type: f.type,
          status: 'MISSING',
        });
      } else {
        const stat = fs.statSync(filePath);
        results.push({
          key: f.key,
          filename: f.filename,
          type: f.type,
          status: stat.size > 0 ? 'OK' : 'MISSING',
          lastModified: stat.mtime,
        });
      }
    }

    // Scan M-System TTTT.xlsx file
    const msBackupBase = this.settingsService
      ? await this.settingsService.getSetting('bot_backup_path_ms', '')
      : '';
    const tradingCheckBase = this.settingsService
      ? (await this.settingsService.getSetting('bot_trading_check_path', '')) ||
        msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck')
      : msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck');
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    let msFilePath = '';
    const possiblePaths = [
      path.join(tradingCheckBase, subFolder, 'TTTT.xlsx'),
      path.join(tradingCheckBase, subFolder, 'TTM.xlsx'),
      path.join(msBackupBase, subFolder, 'TTTT.xlsx'),
      path.join(msBackupBase, 'TTTT.xlsx'),
      path.join(msBackupBase, subFolder, 'TTM.xlsx'),
      path.join(msBackupBase, 'TTM.xlsx'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        msFilePath = p;
        break;
      }
    }

    if (msFilePath) {
      const stat = fs.statSync(msFilePath);
      results.push({
        key: 'MS_TTTT',
        filename: `TTTT.xlsx (M-System - ${path.basename(msFilePath)})`,
        type: 'RAW',
        status: stat.size > 0 ? 'OK' : 'MISSING',
        lastModified: stat.mtime,
      });
    } else {
      results.push({
        key: 'MS_TTTT',
        filename: 'TTTT.xlsx (M-System)',
        type: 'RAW',
        status: 'MISSING',
      });
    }

    return results;
  }

  /**
   * Merges all missing/outdated consolidated CQG reports from their raw counterparts.
   */
  async autoMergeMissingFiles(
    targetDate: Date = new Date(),
    keysToMerge?: Array<'FR' | 'OP' | 'Od' | 'PS'>,
    forceRemerge: boolean = false,
    customDir?: string,
  ): Promise<{ success: boolean; logs: string[] }> {
    const logs: string[] = [];
    let fullPath = customDir;
    if (!fullPath) {
      const backupPathRes = await this.getDailyBackupPath(targetDate);
      fullPath = backupPathRes.fullPath;
      if (!fs.existsSync(fullPath)) {
        // Fallback: Kiểm tra thư mục TradingCheck trong phiên nếu thư mục Backup CQG chưa tồn tại
        const baseDir = resolveStoragePathCrossPlatform(backupPathRes.baseDir);
        const year = targetDate.getFullYear().toString();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
        const tradingCheckBase = baseDir
          .replace(/Backup CQG[\\/]Futures/i, 'TradingCheck/Futures/CQG')
          .replace(/Backup CQG/i, 'TradingCheck/CQG');
        const tradingCheckFullPath = path.join(tradingCheckBase, subFolder);
        if (fs.existsSync(tradingCheckFullPath)) {
          fullPath = tradingCheckFullPath;
        }
      }
    }

    if (!fs.existsSync(fullPath)) {
      try {
        fs.mkdirSync(fullPath, { recursive: true });
      } catch (mkdirErr: any) {
        const errorMsg = `Thư mục backup CQG cho ngày ${targetDate.toLocaleDateString('vi-VN')} không tồn tại và không thể tạo: ${fullPath}`;
        this.logger.error(errorMsg);
        return { success: false, logs: [errorMsg] };
      }
    }

    const audit = await this.scanCqgBackupFiles(targetDate, fullPath);
    logs.push(
      `Bắt đầu chạy quy trình tự động ghép file tại thư mục: ${fullPath} (forceRemerge=${forceRemerge})`,
    );

    // Resolve M-System backup path for PS reconciliation
    const msBackupBase = this.settingsService
      ? await this.settingsService.getSetting('bot_backup_path_ms', '')
      : '';
    const tradingCheckBase = this.settingsService
      ? (await this.settingsService.getSetting('bot_trading_check_path', '')) ||
        msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck')
      : msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck');

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    let ttmPath = '';
    const possiblePaths = [
      path.join(tradingCheckBase, subFolder, 'TTTT.xlsx'),
      path.join(tradingCheckBase, subFolder, 'TTM.xlsx'),
      path.join(msBackupBase, subFolder, 'TTTT.xlsx'),
      path.join(msBackupBase, 'TTTT.xlsx'),
      path.join(msBackupBase, subFolder, 'TTM.xlsx'),
      path.join(msBackupBase, 'TTM.xlsx'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        ttmPath = p;
        break;
      }
    }

    if (!ttmPath) {
      ttmPath = path.join(tradingCheckBase, subFolder, 'TTTT.xlsx');
    }
    this.logger.log(`Sử dụng file MS để đối chiếu PS: ${ttmPath}`);

    let hasMergeError = false;
    const runMerge = async (
      name: string,
      mergeFn: () => any,
      rawKeys: string[],
    ) => {
      const missingRaw = rawKeys.filter((k) => {
        const item = audit.find((a) => a.key === k);
        return !item || item.status === 'MISSING';
      });

      if (missingRaw.length > 0) {
        if (name === 'FR') {
          const msg = ` Không ghép file FR.xlsx vì thiếu file nguồn: ${missingRaw.join(', ')}. Cần đủ cả FR1 và FR2 để tránh mất dữ liệu giao dịch.`;
          this.logger.warn(msg);
          logs.push(msg);
          hasMergeError = true;
          return;
        }
        if (missingRaw.length === rawKeys.length) {
          const msg = ` Bỏ qua ghép ${name}.xlsx vì thiếu toàn bộ file nguồn: ${missingRaw.join(', ')}`;
          this.logger.warn(msg);
          logs.push(msg);
          return;
        }
      }

      try {
        logs.push(`Đang ghép file ${name}.xlsx...`);
        await mergeFn();
        logs.push(` Ghép file ${name}.xlsx thành công.`);
      } catch (err: any) {
        hasMergeError = true;
        const msg = ` Lỗi khi ghép file ${name}.xlsx: ${err.message}`;
        this.logger.error(msg, err.stack);
        logs.push(msg);
      }
    };

    const shouldMerge = (targetKey: string, rawKeys: string[]): boolean => {
      if (forceRemerge) return true;
      const mergedItem = audit.find((a) => a.key === targetKey);
      if (!mergedItem || mergedItem.status !== 'OK' || !mergedItem.lastModified) return true;

      const targetPath = path.join(fullPath, `${targetKey}.xlsx`);
      if (fs.existsSync(targetPath)) {
        try {
          const stats = fs.statSync(targetPath);
          if (stats.size < 2500) return true; // File rỗng/hỏng (<2.5KB) -> Bắt buộc ghép lại
        } catch { }
      }

      // Kiểm tra xem có file raw nào mới hơn file đã ghép không
      for (const rawKey of rawKeys) {
        const rawItem = audit.find((a) => a.key === rawKey);
        if (
          rawItem &&
          rawItem.status !== 'MISSING' &&
          rawItem.lastModified &&
          new Date(rawItem.lastModified).getTime() > new Date(mergedItem.lastModified).getTime()
        ) {
          return true;
        }
      }
      return false;
    };

    // 1. Merge FR.xlsx
    if (!keysToMerge || keysToMerge.includes('FR')) {
      if (shouldMerge('FR', ['FR1', 'FR2'])) {
        await runMerge(
          'FR',
          () =>
            this.mergeFR(
              path.join(fullPath, 'FR1.xlsx'),
              path.join(fullPath, 'FR2.xlsx'),
              path.join(fullPath, 'FR.xlsx'),
            ),
          ['FR1', 'FR2'],
        );
      } else {
        logs.push(`FR.xlsx đã tồn tại và cập nhật hôm nay.`);
      }
    }

    // 2. Merge OP.xlsx
    if (!keysToMerge || keysToMerge.includes('OP')) {
      if (shouldMerge('OP', ['OP1', 'OP2'])) {
        await runMerge(
          'OP',
          () =>
            this.mergeOP(
              path.join(fullPath, 'OP1.xlsx'),
              path.join(fullPath, 'OP2.xlsx'),
              path.join(fullPath, 'OP.xlsx'),
            ),
          ['OP1', 'OP2'],
        );
      } else {
        logs.push(`OP.xlsx đã tồn tại và cập nhật hôm nay.`);
      }
    }

    // 3. Merge Od.xlsx (OD1 and OD2)
    if (!keysToMerge || keysToMerge.includes('Od')) {
      if (shouldMerge('Od', ['OD1', 'OD2'])) {
        await runMerge(
          'Od',
          () =>
            this.mergeOD(
              path.join(fullPath, 'OD1.xlsx'),
              path.join(fullPath, 'OD2.xlsx'),
              path.join(fullPath, 'Od.xlsx'),
            ),
          ['OD1', 'OD2'],
        );
      } else {
        logs.push(`Od.xlsx đã tồn tại và cập nhật hôm nay.`);
      }
    }

    // 4. Merge PS.xlsx
    if (!keysToMerge || keysToMerge.includes('PS')) {
      if (shouldMerge('PS', ['PS1', 'PS2'])) {
        await runMerge(
          'PS',
          () =>
            this.mergePS(
              path.join(fullPath, 'PS1.xlsx'),
              path.join(fullPath, 'PS2.xlsx'),
              path.join(fullPath, 'PS.xlsx'),
              ttmPath,
            ),
          ['PS1', 'PS2'],
        );
      } else {
        logs.push(`PS.xlsx đã tồn tại và cập nhật hôm nay.`);
      }
    }

    logs.push('Hoàn tất quy trình kiểm tra và tự động ghép file.');
    return { success: !hasMergeError, logs };
  }
}
