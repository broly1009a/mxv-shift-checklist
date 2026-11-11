/**
 * trading-math.helper.ts
 *
 * Tiện ích toán học & xử lý ngày giờ thuần túy cho phân hệ Trading Operations.
 * Đã bóc tách toàn bộ Parsers và Symbol Normalizers sang thư mục `../parsers/`.
 * File này re-export toàn bộ để bảo đảm 100% Zero Breaking Changes cho các service đang import.
 */

import * as fs from 'fs';
import * as path from 'path';

// =========================================================================
// RE-EXPORT 100% TỪ LỚP PARSERS & SYMBOL NORMALIZER (ZERO BREAKING CHANGES)
// =========================================================================
export * from '../parsers/symbol-normalizer.helper';
export * from '../parsers/ms-excel.parser';
export * from '../parsers/cqg-excel.parser';
export * from '../parsers/straits-csv.parser';
export * from '../parsers/ccp-excel.parser';

// =========================================================================
// CÁC HÀM TIỆN ÍCH TOÁN HỌC, NGÀY GIỜ & QUẢN LÝ FILE THUẦN TÚY
// =========================================================================

/**
 * Phân tích chuỗi số từ CQG (hỗ trợ cả định dạng US 1,234.56 và VN/EU 1.234,56).
 */
export function parseCqgNumber(val: any): number {
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

/**
 * Phân tích chuỗi ngày giờ từ CQG theo ca trực.
 */
export function parseCqgDateTime(
  timeStr: string,
  defaultDate: Date,
  sessionStartHour: number = 6,
): Date | null {
  if (!timeStr) return null;
  timeStr = String(timeStr).trim();
  if (!timeStr) return null;

  if (timeStr.includes('/') || timeStr.includes('-')) {
    const parts = timeStr.split(/\s+/);
    const datePart = parts[0];
    const timePart = parts[1] || '00:00:00';

    const dateSep = datePart.includes('/') ? '/' : '-';
    const dateBits = datePart.split(dateSep).map(Number);
    if (dateBits.length < 3) return null;

    let year = 0;
    let month = 0;
    let day = 0;

    if (dateBits[0] > 31) {
      // Định dạng ISO: YYYY-MM-DD hoặc YYYY/MM/DD
      year = dateBits[0];
      month = dateBits[1];
      day = dateBits[2];
    } else {
      year = dateBits[2];
      if (year < 100) year += 2000;

      // Chuẩn CQG Gateway: Mặc định 100% US (MM/DD/YY) theo hợp đồng dữ liệu chuẩn Clean Architecture (Zero-Guessing).
      // Trường hợp bit0 > 12: bit0 không thể là tháng, bắt buộc là Day (DD/MM/YY).
      if (dateBits[0] > 12) {
        day = dateBits[0];
        month = dateBits[1];
      } else {
        month = dateBits[0];
        day = dateBits[1];
      }
    }

    const timeBits = timePart.split(':');
    const hours = Number(timeBits[0]) || 0;
    const minutes = Number(timeBits[1]) || 0;
    // Bỏ mili-giây, giống C# TransactionCheckingService.cs#L140 (TimeSpan.FromSeconds((int)TotalSeconds))
    const seconds = Math.floor(parseFloat(timeBits[2] || '0') || 0);

    const d = new Date(year, month - 1, day, hours, minutes, seconds, 0);
    return isNaN(d.getTime()) ? null : d;
  } else if (timeStr.includes(':')) {
    const timeBits = timeStr.split(':');
    if (timeBits.length < 2) return null;
    const hours = Number(timeBits[0]) || 0;
    const minutes = Number(timeBits[1]) || 0;
    // Bỏ mili-giây, giống C# TransactionCheckingService.cs#L140 (TimeSpan.FromSeconds((int)TotalSeconds))
    const seconds = Math.floor(parseFloat(timeBits[2] || '0') || 0);

    // Lệnh không kèm ngày: Nếu giờ < sessionStartHour (ví dụ < 6h sáng), lệnh thuộc phiên đêm (ngày hôm sau D+1)
    const d = new Date(
      defaultDate.getFullYear(),
      defaultDate.getMonth(),
      defaultDate.getDate() + (hours < sessionStartHour ? 1 : 0),
      hours,
      minutes,
      seconds,
      0,
    );
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Phân tích chuỗi ngày giờ giao dịch chuẩn M-System.
 */
export function parseTradeDateTime(dateTimeStr: string, defaultDate?: Date): Date | null {
  if (!dateTimeStr) return null;
  const str = String(dateTimeStr).trim();
  if (!str) return null;

  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  const parts = str.split(/\s+/);
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';

  let year = 0;
  let month = 0;
  let day = 0;

  if (/^\d{8}$/.test(datePart)) {
    year = Number(datePart.substring(0, 4));
    month = Number(datePart.substring(4, 6));
    day = Number(datePart.substring(6, 8));
  } else if (datePart.includes('/') || datePart.includes('-')) {
    const sep = datePart.includes('/') ? '/' : '-';
    const bits = datePart.split(sep).map(Number);
    if (bits.length >= 3) {
      if (bits[0] > 31) {
        year = bits[0];
        month = bits[1];
        day = bits[2];
      } else {
        day = bits[0];
        month = bits[1];
        year = bits[2];
      }
      if (year < 100) year += 2000;
    } else if (defaultDate) {
      year = defaultDate.getFullYear();
      month = defaultDate.getMonth() + 1;
      day = defaultDate.getDate();
    } else {
      return null;
    }
  } else if (parts.length === 1 && str.includes(':')) {
    if (defaultDate) {
      year = defaultDate.getFullYear();
      month = defaultDate.getMonth() + 1;
      day = defaultDate.getDate();
    } else {
      return null;
    }
  } else {
    return null;
  }

  const timeBits = (parts.length === 1 && str.includes(':') ? str : timePart).split(':');
  const hr = Number(timeBits[0]) || 0;
  const min = Number(timeBits[1]) || 0;
  // Bỏ mili-giây, giống C# TransactionCheckingService.cs#L140 (TimeSpan.FromSeconds((int)TotalSeconds))
  const sec = Math.floor(parseFloat(timeBits[2] || '0') || 0);

  const result = new Date(year, month - 1, day, hr, min, sec);
  if (parts.length === 1 && str.includes(':') && defaultDate && hr < 6) {
    result.setDate(result.getDate() + 1);
  }
  return isNaN(result.getTime()) ? null : result;
}

/**
 * Tìm chỉ mục của cột trong danh sách tiêu đề bảng tính với cơ chế alias không phân biệt dấu/hoa thường.
 */
export function findHeaderIndex(headers: string[], target: string, aliases: string[] = []): number {
  const normalize = (str: string): string => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normTarget = normalize(target);
  const normAliases = aliases.map((a) => normalize(a));

  return headers.findIndex((h) => {
    const normH = normalize(h);
    return normH === normTarget || normAliases.includes(normH);
  });
}

/**
 * Kiểm tra các mã hàng hóa bỏ qua đối soát đặc thù (TRU, ZFT, FEF, MPO).
 */
export function isIgnoredCommodity(symbol: string): boolean {
  if (!symbol) return false;
  const upper = symbol.toUpperCase();
  return ['TRU', 'ZFT', 'FEF', 'MPO'].some((ignored) => upper.startsWith(ignored));
}

/**
 * Tìm file mới nhất trong thư mục theo Regex pattern.
 */
export function findLatestFile(dirPath: string, pattern: RegExp): string | null {
  try {
    if (!fs.existsSync(dirPath)) return null;

    let files: string[] = [];
    try {
      files = fs.readdirSync(dirPath);
    } catch {
      return null;
    }

    const matches: Array<{ name: string; fullPath: string; mtime: number }> = [];

    for (const f of files) {
      const fullPath = path.join(dirPath, f);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const subFiles = fs.readdirSync(fullPath);
          for (const sf of subFiles) {
            if (pattern.test(sf)) {
              const subFullPath = path.join(fullPath, sf);
              const subStat = fs.statSync(subFullPath);
              matches.push({ name: sf, fullPath: subFullPath, mtime: subStat.mtimeMs });
            }
          }
        } else if (pattern.test(f)) {
          matches.push({ name: f, fullPath, mtime: stat.mtimeMs });
        }
      } catch {}
    }

    if (matches.length === 0) return null;
    matches.sort((a: any, b: any) => b.mtime - a.mtime);
    return matches[0].fullPath;
  } catch {
    return null;
  }
}
