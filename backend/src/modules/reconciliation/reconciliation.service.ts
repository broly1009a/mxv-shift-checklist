import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { TelegramService } from '../telegram/telegram.service';
import { MarginCheckerService } from '../margin-checker/margin-checker.service';
import { decrypt } from '../bot-engine/utils/crypto';
import { chromium } from 'playwright-core';
import { TeamsNotifierService } from '../notifications/teams-notifier.service';
import { EmailWatcherService } from '../bot-engine/email-watcher.service';

export interface CheckKLGDResult {
  totals: {
    totalDSGD: number;
    totalFR: number;
    totalACM: number;
    totalNano: number;
    differ: number;
    differACM: number;
    totalTTTT?: number;
    totalPS?: number;
    differTTTT?: number;
  };
  mismatchedTrades: Array<{
    source: 'MSystem' | 'CQG' | 'ACM' | 'Nano';
    maLenh?: string;
    maTKGD: string;
    maHD: string;
    giaKhop: number;
    klGiaoDich: number;
    ngayGio: string;
    reason: string;
  }>;
  mismatchedTTM: Array<{
    maTKGD: string;
    ttmValue: number;
    opValue: number;
    differ: number;
  }>;
  mismatchedTTTT?: Array<{
    maTKGD: string;
    ttttValue: number;
    psValue: number;
    differ: number;
  }>;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly telegramService: TelegramService,
    private readonly marginCheckerService: MarginCheckerService,
    private readonly teamsNotifierService: TeamsNotifierService,
    @Inject(forwardRef(() => EmailWatcherService))
    private readonly emailWatcherService: EmailWatcherService,
  ) {}

  private parseCqgNumber(val: any): number {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    if (!str) return 0;

    let normalized = str;
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');

    if (lastComma !== -1 && lastDot !== -1) {
      if (lastDot < lastComma) {
        // Vietnamese/European format: -26.960,00 -> remove dots, replace comma with dot
        normalized = str.replace(/\./g, '').replace(/,/g, '.');
      } else {
        // US format: -26,960.00 -> remove commas
        normalized = str.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      // Only comma: replace with dot
      normalized = str.replace(/,/g, '.');
    }

    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }


  private parseCqgDateTime(timeStr: string, defaultDate: Date): Date | null {
    if (!timeStr) return null;
    timeStr = timeStr.trim();

    // Check if it has a date part (contains '/' or '-')
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
        // YYYY-MM-DD
        year = dateBits[0];
        month = dateBits[1];
        day = dateBits[2];
      } else {
        // Dynamic detection of MM/DD/YY vs DD/MM/YY based on defaultDate (tradingDate) month
        const targetMonth = defaultDate.getMonth() + 1;
        const bit0 = dateBits[0];
        const bit1 = dateBits[1];
        
        if (bit1 === targetMonth || bit1 === targetMonth - 1 || (targetMonth === 1 && bit1 === 12)) {
          // Assume bit1 is Month and bit0 is Day (DD/MM/YY)
          day = bit0;
          month = bit1;
        } else if (bit0 === targetMonth || bit0 === targetMonth - 1 || (targetMonth === 1 && bit0 === 12)) {
          // Assume bit0 is Month and bit1 is Day (MM/DD/YY)
          month = bit0;
          day = bit1;
        } else {
          // Fallback to MM/DD/YY (standard CQG US export format)
          month = bit0;
          day = bit1;
        }
        year = dateBits[2];
      }

      if (year < 100) {
        year += 2000;
      }

      const timeBits = timePart.split(':');
      const hours = Number(timeBits[0]) || 0;
      const minutes = Number(timeBits[1]) || 0;
      const secondsVal = parseFloat(timeBits[2] || '0') || 0;
      const seconds = Math.floor(secondsVal);
      const ms = Math.round((secondsVal - seconds) * 1000);

      return new Date(year, month - 1, day, hours, minutes, seconds, ms);
    } else {
      // Time only: combine with defaultDate (keeping defaultDate's year, month, day)
      const timeBits = timeStr.split(':');
      if (timeBits.length < 2) return null;
      const hours = Number(timeBits[0]) || 0;
      const minutes = Number(timeBits[1]) || 0;
      const secondsVal = parseFloat(timeBits[2] || '0') || 0;
      const seconds = Math.floor(secondsVal);
      const ms = Math.round((secondsVal - seconds) * 1000);

      const result = new Date(defaultDate);
      result.setHours(hours, minutes, seconds, ms);
      return result;
    }
  }

  // Mappings for LME symbols (from statics.json)
  private readonly LME_CODE_MAP: Record<string, string> = {
    LALZ: 'AHD',
    LDKZ: 'CAD',
    LEDZ: 'PBD',
    LNIZ: 'NID',
    LTIZ: 'SND',
    LZHZ: 'ZDS',
  };

  private readonly REVERSE_MONTH_CODE: Record<string, string> = {
    '01': 'F',
    '02': 'G',
    '03': 'H',
    '04': 'J',
    '05': 'K',
    '06': 'M',
    '07': 'N',
    '08': 'Q',
    '09': 'U',
    '10': 'V',
    '11': 'X',
    '12': 'Z',
  };

  /**
   * Helper to find a header index in a case-insensitive, accent-insensitive, and alias-friendly way.
   */
  private findHeaderIndex(headers: string[], target: string, aliases: string[] = []): number {
    const normalize = (str: string): string => {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents/diacritics
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normTarget = normalize(target);
    const normAliases = aliases.map(a => normalize(a));

    return headers.findIndex(h => {
      const normH = normalize(h);
      return normH === normTarget || normAliases.includes(normH);
    });
  }

  isIgnoredCommodity(symbol: string): boolean {
    if (!symbol) return false;
    const upper = symbol.toUpperCase();
    return ['TRU', 'ZFT', 'FEF', 'MPO'].some(ignored => upper.startsWith(ignored));
  }

  /**
   * Helper to convert LME symbols based on trading date.
   */
  convertLMESymbol(symbol: string, date: Date, holidays: string[] = []): string {
    if (!this.LME_CODE_MAP[symbol]) {
      return symbol;
    }

    // Add 3 months to date
    const adjustedDate = new Date(date);
    adjustedDate.setMonth(adjustedDate.getMonth() + 3);

    // Shift weekend
    const dayOfWeek = adjustedDate.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 6) {
      adjustedDate.setDate(adjustedDate.getDate() - 1);
    } else if (dayOfWeek === 0) {
      adjustedDate.setDate(adjustedDate.getDate() + 1);
    }

    // Format helper
    const formatDDMMYYYY = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Shift LME Dayoffs
    let adjustedDateStr = formatDDMMYYYY(adjustedDate);
    const dayoffMap = new Map<string, string>();
    holidays.forEach(h => {
      const parts = h.split(',');
      if (parts.length >= 2) {
        dayoffMap.set(parts[0].trim(), parts[1].trim());
      }
    });

    while (dayoffMap.has(adjustedDateStr)) {
      const nextDateStr = dayoffMap.get(adjustedDateStr);
      if (!nextDateStr) break;
      adjustedDateStr = nextDateStr;
      const [d, m, y] = adjustedDateStr.split('/').map(Number);
      adjustedDate.setFullYear(y, m - 1, d);
    }

    const newDay = String(adjustedDate.getDate()).padStart(2, '0');
    const newMonth = String(adjustedDate.getMonth() + 1).padStart(2, '0');
    const newYear = String(adjustedDate.getFullYear());

    const mapped = this.LME_CODE_MAP[symbol];
    const monthCode = this.REVERSE_MONTH_CODE[newMonth];
    if (!monthCode) {
      throw new Error(`Convert month failed for: ${newMonth}`);
    }
    const yearShort = newYear.substring(2);

    return `${mapped}D${newDay}${monthCode}${yearShort}`;
  }

  /**
   * Parse M-System DSGD.xlsx
   */
  parseDSGD(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('Không tìm thấy sheet nào trong file DSGD.xlsx');

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim());
    const maLenhIdx = header.indexOf('Mã lệnh');
    const maTKGDIdx = header.indexOf('Mã TKGD');
    const maHDIdx = header.indexOf('Mã HĐ');
    const klGiaoDichIdx = header.indexOf('KL giao dịch');
    const giaKhopIdx = header.indexOf('Giá khớp');
    const ngayGioIdx = header.indexOf('Ngày giờ thực hiện');

    if (maLenhIdx === -1 || maTKGDIdx === -1 || maHDIdx === -1 || klGiaoDichIdx === -1 || giaKhopIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file DSGD.xlsx (Mã lệnh, Mã TKGD, Mã HĐ, KL giao dịch, Giá khớp)');
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maLenh = String(row[maLenhIdx] || '').trim();
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const maHD = String(row[maHDIdx] || '').trim();
      const klGiaoDich = parseFloat(row[klGiaoDichIdx]) || 0;
      const giaKhop = parseFloat(row[giaKhopIdx]) || 0;
      const ngayGio = ngayGioIdx !== -1 ? String(row[ngayGioIdx] || '').trim() : '';

      if (!maLenh || !maTKGD || !maHD) continue;

      result.push({
        maLenh,
        maTKGD,
        maHD,
        klGiaoDich,
        giaKhop,
        ngayGio,
        // Combined key as C# does: {maTKGD}{maHD}{giaKhop}
        combinedKey: `${maTKGD}${maHD}${giaKhop}`,
      });
    }
    return result;
  }

  /**
   * Parse CQG FR1.xlsx / FR2.xlsx
   */
  parseFR(buffer: Buffer, date: Date, holidays: string[] = []): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    let headerRowIdx = 1; // Default fallback to row index 1 (row 2 in Excel)
    let ordIdx = -1;
    let accountIdx = -1;
    let symbolIdx = -1;
    let qtyIdx = -1;
    let fillPIdx = -1;
    let timeIdx = -1;

    // Scan first 5 rows to locate the header row dynamically
    const scanLimit = Math.min(rows.length, 5);
    for (let r = 0; r < scanLimit; r++) {
      if (!rows[r]) continue;
      const rowHeaders = rows[r].map(h => String(h || '').trim());
      
      const tempOrdIdx = this.findHeaderIndex(rowHeaders, 'Ord #', ['ord', 'ord #', 'order', 'order #', 'order number']);
      const tempAccountIdx = this.findHeaderIndex(rowHeaders, 'Account', ['account', 'tk', 'tài khoản', 'ma tkgd', 'account number', 'acc']);
      const tempSymbolIdx = this.findHeaderIndex(rowHeaders, 'Symbol', ['symbol', 'ma hd', 'mã hợp đồng', 'ma hop dong', 'contract']);
      const tempQtyIdx = this.findHeaderIndex(rowHeaders, 'Qty', ['qty', 'quantity', 'kl', 'khối lượng', 'volume', 'qty.']);
      const tempFillPIdx = this.findHeaderIndex(rowHeaders, 'Fill P', ['fill p', 'fill price', 'gia khop', 'giá khớp', 'fill_p', 'fillpx', 'fill px']);
      const tempTimeIdx = this.findHeaderIndex(rowHeaders, 'Time', ['time', 'thoi gian', 'ngày giờ', 'ngay gio']);

      if (tempOrdIdx !== -1 && tempAccountIdx !== -1 && tempSymbolIdx !== -1 && tempQtyIdx !== -1 && tempFillPIdx !== -1) {
        headerRowIdx = r;
        ordIdx = tempOrdIdx;
        accountIdx = tempAccountIdx;
        symbolIdx = tempSymbolIdx;
        qtyIdx = tempQtyIdx;
        fillPIdx = tempFillPIdx;
        timeIdx = tempTimeIdx;
        break;
      }
    }

    // Fallback search if not found dynamically
    if (ordIdx === -1 || accountIdx === -1 || symbolIdx === -1 || qtyIdx === -1 || fillPIdx === -1) {
      const fallbackHeader = rows[1] ? rows[1].map(h => String(h || '').trim()) : [];
      ordIdx = this.findHeaderIndex(fallbackHeader, 'Ord #', ['ord', 'ord #', 'order', 'order #', 'order number']);
      accountIdx = this.findHeaderIndex(fallbackHeader, 'Account', ['account', 'tk', 'tài khoản', 'ma tkgd', 'account number', 'acc']);
      symbolIdx = this.findHeaderIndex(fallbackHeader, 'Symbol', ['symbol', 'ma hd', 'mã hợp đồng', 'ma hop dong', 'contract']);
      qtyIdx = this.findHeaderIndex(fallbackHeader, 'Qty', ['qty', 'quantity', 'kl', 'khối lượng', 'volume', 'qty.']);
      fillPIdx = this.findHeaderIndex(fallbackHeader, 'Fill P', ['fill p', 'fill price', 'gia khop', 'giá khớp', 'fill_p', 'fillpx', 'fill px']);
      timeIdx = this.findHeaderIndex(fallbackHeader, 'Time', ['time', 'thoi gian', 'ngày giờ', 'ngay gio']);
    }

    if (ordIdx === -1 || accountIdx === -1 || symbolIdx === -1 || qtyIdx === -1 || fillPIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file CQG FR (Ord #, Account, Symbol, Qty, Fill P)');
    }

    const result = [];
    // Data starts after header row
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const ord = String(row[ordIdx] || '').trim();
      const account = String(row[accountIdx] || '').trim();
      const symbol = String(row[symbolIdx] || '').trim();
      const qty = this.parseCqgNumber(row[qtyIdx]);
      const fillPVal = this.parseCqgNumber(row[fillPIdx]);
      const time = timeIdx !== -1 ? String(row[timeIdx] || '').trim() : '';

      if (!ord || !account || !symbol) continue;

      // Handle account suffix adjustment as in C#
      let accountRaw = account;
      if (accountRaw.endsWith('L') || accountRaw.endsWith('l')) {
        accountRaw = accountRaw.slice(0, -1) + '-L';
      } else if (accountRaw.endsWith('S') || accountRaw.endsWith('s')) {
        accountRaw = accountRaw.slice(0, -1) + '-S';
      } else if (accountRaw.endsWith('F') || accountRaw.endsWith('f')) {
        accountRaw = accountRaw.slice(0, -1);
      }

      let tradeDate = date;
      if (time) {
        const parsedTime = this.parseCqgDateTime(time, date);
        if (parsedTime) {
          tradeDate = parsedTime;
        }
      }

      const symbolRaw = this.convertLMESymbol(symbol, tradeDate, holidays);

      result.push({
        ord,
        account,
        symbol,
        qty,
        fillP: fillPVal,
        time,
        accountRaw,
        // Combined key as C# does: {accountRaw}{symbolRaw}{fillP}
        combinedKey: `${accountRaw}${symbolRaw}${fillPVal}`,
      });
    }
    return result;
  }

  /**
   * Parse ACM Nano.xls/xlsx
   */
  parseNano(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    // Header on row 0
    const header = rows[0].map(h => String(h || '').trim());
    const maLenhIdx = header.indexOf('Order Sysid');
    const maTKGDIdx = header.indexOf('Trader Id');
    const maHDIdx = header.indexOf('Instrument Id');
    const klGiaoDichIdx = header.indexOf('Volume');
    const giaKhopIdx = header.indexOf('Price');
    const ngayIdx = header.indexOf('Trading Day');
    const gioIdx = header.indexOf('Trade Time');
    const maGDIdx = header.indexOf('Trade Id');

    if (maLenhIdx === -1 || maTKGDIdx === -1 || maHDIdx === -1 || klGiaoDichIdx === -1 || giaKhopIdx === -1 || maGDIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file Nano (Order Sysid, Trader Id, Instrument Id, Volume, Price, Trade Id)');
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maLenh = String(row[maLenhIdx] || '').trim();
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const maHD = String(row[maHDIdx] || '').trim();
      const klGiaoDich = parseFloat(row[klGiaoDichIdx]) || 0;
      const giaKhop = parseFloat(row[giaKhopIdx]) || 0;
      const ngay = ngayIdx !== -1 ? String(row[ngayIdx] || '').trim() : '';
      const gio = gioIdx !== -1 ? String(row[gioIdx] || '').trim() : '';
      const maGD = String(row[maGDIdx] || '').trim();

      if (!maLenh || !maTKGD || !maHD) continue;

      result.push({
        maLenh,
        maTKGD,
        maHD,
        klGiaoDich,
        giaKhop,
        ngayGio: `${ngay} ${gio}`,
        maGD,
        // Combined key as C# does: {maTKGD}{maGD}{klGiaoDich}
        combinedKey: `${maTKGD}${maGD}${klGiaoDich}`,
      });
    }
    return result;
  }

  /**
   * Parse CQG TTM OP1.xlsx / OP2.xlsx
   */
  parseOP(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    let headerRowIdx = 1;
    let accountIdx = -1;
    let symbolIdx = -1;
    let lIdx = -1;
    let sIdx = -1;

    // Scan first 5 rows to locate the header row dynamically
    const scanLimit = Math.min(rows.length, 5);
    for (let r = 0; r < scanLimit; r++) {
      if (!rows[r]) continue;
      const rowHeaders = rows[r].map(h => String(h || '').trim());

      const tempAccountIdx = this.findHeaderIndex(rowHeaders, 'Account', ['account', 'tk', 'tài khoản', 'ma tkgd', 'account number', 'acc']);
      const tempSymbolIdx = this.findHeaderIndex(rowHeaders, 'Symbol', ['symbol', 'ma hd', 'mã hợp đồng', 'ma hop dong', 'contract']);
      
      let tempLIdx = rowHeaders.findIndex(h => {
        const norm = h.toLowerCase().trim();
        return norm === 'l' || norm.startsWith('l (') || norm.startsWith('(');
      });
      let tempSIdx = rowHeaders.findIndex(h => {
        const norm = h.toLowerCase().trim();
        return norm === 's' || norm.startsWith('s (') || norm.startsWith('s(');
      });

      if (tempAccountIdx !== -1 && tempSymbolIdx !== -1 && tempLIdx !== -1 && tempSIdx !== -1) {
        headerRowIdx = r;
        accountIdx = tempAccountIdx;
        symbolIdx = tempSymbolIdx;
        lIdx = tempLIdx;
        sIdx = tempSIdx;
        break;
      }
    }

    if (accountIdx === -1 || symbolIdx === -1 || lIdx === -1 || sIdx === -1) {
      const fallbackHeader = rows[1] ? rows[1].map(h => String(h || '').trim()) : [];
      accountIdx = this.findHeaderIndex(fallbackHeader, 'Account', ['account', 'tk', 'tài khoản', 'ma tkgd', 'account number', 'acc']);
      symbolIdx = this.findHeaderIndex(fallbackHeader, 'Symbol', ['symbol', 'ma hd', 'mã hợp đồng', 'ma hop dong', 'contract']);
      lIdx = fallbackHeader.findIndex(h => {
        const norm = h.toLowerCase().trim();
        return norm === 'l' || norm.startsWith('l (') || norm.startsWith('(');
      });
      sIdx = fallbackHeader.findIndex(h => {
        const norm = h.toLowerCase().trim();
        return norm === 's' || norm.startsWith('s (') || norm.startsWith('s(');
      });
    }

    if (accountIdx === -1 || symbolIdx === -1 || lIdx === -1 || sIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file OP (Account, Symbol, L, S)');
    }

    const result = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const account = String(row[accountIdx] || '').trim();
      const symbol = String(row[symbolIdx] || '').trim();
      const lValue = this.parseCqgNumber(row[lIdx]);
      const sValue = this.parseCqgNumber(row[sIdx]);

      if (!symbol) continue;

      let accountRaw = account;
      if (accountRaw.endsWith('L') || accountRaw.endsWith('l')) {
        accountRaw = accountRaw.slice(0, -1) + '-L';
      } else if (accountRaw.endsWith('S') || accountRaw.endsWith('s')) {
        accountRaw = accountRaw.slice(0, -1) + '-S';
      } else if (accountRaw.endsWith('F') || accountRaw.endsWith('f')) {
        accountRaw = accountRaw.slice(0, -1);
      }

      result.push({
        account: accountRaw,
        symbol,
        lValue,
        sValue,
      });
    }
    return result;
  }

  /**
   * Parse M-System TTM.xlsx
   */
  parseTTM(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim());

    // Support all variations of headers
    const maTKGDIdx = header.findIndex(h => h === 'Mã TKGD' || h === 'Mã tài khoản');
    const maHDIdx = header.findIndex(h => h === 'Mã HĐ' || h === 'Mã hợp đồng');

    const tongMuaIdx = header.findIndex(h =>
      h === 'KL Mua' || h === 'Tổng KL Mua' || h === 'Tổng mua' || h === 'Tổng KL mua'
    );
    const tongBanIdx = header.findIndex(h =>
      h === 'KL Bán' || h === 'Tổng KL Bán' || h === 'Tổng bán' || h === 'Tổng KL bán'
    );
    const giaKhopIdx = header.findIndex(h =>
      h === 'Giá TB' || h === 'Giá khớp' || h === 'Giá trung bình'
    );

    if (maTKGDIdx === -1 || maHDIdx === -1 || tongMuaIdx === -1 || tongBanIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file TTM.xlsx (Mã TKGD, Mã HĐ, KL Mua/Tổng mua, KL Bán/Tổng bán)');
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const maHD = String(row[maHDIdx] || '').trim();
      const tongMua = parseFloat(row[tongMuaIdx]) || 0;
      const tongBan = parseFloat(row[tongBanIdx]) || 0;
      const giaKhop = giaKhopIdx !== -1 ? parseFloat(row[giaKhopIdx]) || 0 : 0;

      if (!maTKGD || !maHD) continue;

      result.push({
        maTKGD,
        maHD,
        tongMua,
        tongBan,
        giaKhop,
      });
    }
    return result;
  }

  parseTTTTForVolume(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim());

    const maTKGDIdx = this.findHeaderIndex(header, 'Mã TKGD', ['Mã tài khoản', 'Account', 'Mã khách hàng', 'Mã KH']);
    const maHDIdx = this.findHeaderIndex(header, 'Mã HĐ', ['Mã hợp đồng', 'Symbol', 'Mã HH', 'Mã hàng hóa']);
    const tongMuaIdx = this.findHeaderIndex(header, 'KL Mua', ['Tổng KL Mua', 'Tổng mua', 'KL mua']);
    const tongBanIdx = this.findHeaderIndex(header, 'KL Bán', ['Tổng KL Bán', 'Tổng bán', 'KL bán']);

    // fallbacks
    const finalAccIdx = maTKGDIdx !== -1 ? maTKGDIdx : 7;
    const finalSymIdx = maHDIdx !== -1 ? maHDIdx : 9;
    const finalMuaIdx = tongMuaIdx !== -1 ? tongMuaIdx : 15;
    const finalBanIdx = tongBanIdx !== -1 ? tongBanIdx : 16;

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maTKGD = String(row[finalAccIdx] || '').trim();
      const maHD = String(row[finalSymIdx] || '').trim();
      const tongMua = parseFloat(row[finalMuaIdx]) || 0;
      const tongBan = parseFloat(row[finalBanIdx]) || 0;

      if (!maTKGD || !maHD) continue;

      result.push({
        maTKGD,
        maHD,
        tongMua,
        tongBan,
      });
    }
    return result;
  }

  parsePSForVolume(buffer: Buffer): any[] {
    return this.parseOP(buffer);
  }

  /**
   * Match Trade Volumes (CheckKLGD)
   */
  async checkKLGD(
    files: {
      dsgd?: Buffer;
      fr1?: Buffer;
      fr2?: Buffer;
      nano?: Buffer;
      ttm?: Buffer;
      op1?: Buffer;
      op2?: Buffer;
      tttt?: Buffer;
      ps1?: Buffer;
      ps2?: Buffer;
    },
    tradingDate: Date,
    holidays: string[] = [],
    sessionStartStr: string = '05:00'
  ): Promise<CheckKLGDResult> {
    if (sessionStartStr) {
      await this.settingsService.setSetting('session_start_time', sessionStartStr);
    }
    const rawDsgdData = files.dsgd ? this.parseDSGD(files.dsgd) : [];
    const rawNanoData = files.nano ? this.parseNano(files.nano) : [];

    // Parse and merge FR files
    const rawFrData: any[] = [];
    if (files.fr1) rawFrData.push(...this.parseFR(files.fr1, tradingDate, holidays));
    if (files.fr2) rawFrData.push(...this.parseFR(files.fr2, tradingDate, holidays));

    // Calculate time bounds: sessionStart and checkTime
    let sessionStart = new Date(tradingDate);
    const [sHour, sMin] = sessionStartStr.split(':').map(Number);

    const isPastDateOrDateOnly =
      (tradingDate.getHours() === 0 && tradingDate.getMinutes() === 0 && tradingDate.getSeconds() === 0) ||
      (tradingDate.getUTCHours() === 0 && tradingDate.getUTCMinutes() === 0 && tradingDate.getUTCSeconds() === 0);

    let checkTime: Date;
    if (isPastDateOrDateOnly) {
      // Historical check or date-only upload: include the entire 24h session window
      sessionStart.setHours(sHour, sMin, 0, 0);
      checkTime = new Date(sessionStart);
      checkTime.setDate(checkTime.getDate() + 1);
    } else {
      // Live check: mimic the C# tool logic
      checkTime = new Date(tradingDate);
      sessionStart.setHours(sHour, sMin, 0, 0);
      if (checkTime < sessionStart) {
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
      while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) { // 0: Sunday, 6: Saturday
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
    }

    // Filter DSGD data
    const dsgdData = rawDsgdData.filter(gd => {
      if (this.isIgnoredCommodity(gd.maHD)) return false;
      if (!gd.ngayGio) return true;
      const parts = gd.ngayGio.split(/\s+/);
      const dateParts = parts[0].split('-');
      const timeParts = (parts[1] || '00:00:00').split(':');
      if (dateParts.length < 3) return true;
      const d = Number(dateParts[0]);
      const m = Number(dateParts[1]);
      const y = Number(dateParts[2]);
      const hr = Number(timeParts[0]) || 0;
      const min = Number(timeParts[1]) || 0;
      const secVal = parseFloat(timeParts[2] || '0') || 0;
      const sec = Math.floor(secVal);
      const ms = Math.round((secVal - sec) * 1000);
      const tradeTime = new Date(y, m - 1, d, hr, min, sec, ms);
      return tradeTime <= checkTime;
    });

    // Filter Nano data
    const nanoData = rawNanoData.filter(gd => {
      if (this.isIgnoredCommodity(gd.maHD)) return false;
      if (!gd.ngayGio) return true;
      const parts = gd.ngayGio.split(/\s+/);
      const dateStr = parts[0];
      let y = 0, m = 0, d = 0;
      if (dateStr.includes('-')) {
        const bits = dateStr.split('-');
        y = Number(bits[0]);
        m = Number(bits[1]);
        d = Number(bits[2]);
      } else if (dateStr.length === 8) {
        y = Number(dateStr.substring(0, 4));
        m = Number(dateStr.substring(4, 6));
        d = Number(dateStr.substring(6, 8));
      } else {
        return true;
      }
      const timeParts = (parts[1] || '00:00:00').split(':');
      const hr = Number(timeParts[0]) || 0;
      const min = Number(timeParts[1]) || 0;
      const secVal = parseFloat(timeParts[2] || '0') || 0;
      const sec = Math.floor(secVal);
      const ms = Math.round((secVal - sec) * 1000);
      const tradeTime = new Date(y, m - 1, d, hr, min, sec, ms);
      return tradeTime <= checkTime;
    });

    // Filter CQG data using parseCqgDateTime
    const frData = rawFrData.filter(fr => {
      if (this.isIgnoredCommodity(fr.symbol)) return false;
      if (!fr.time) return true;
      const tradeTime = this.parseCqgDateTime(fr.time, tradingDate);
      if (!tradeTime) return true;
      return tradeTime >= sessionStart && tradeTime <= checkTime;
    });

    // Calculate totals
    let totalDSGD = 0;
    let totalACM = 0;
    let totalFR = 0;
    let totalNano = 0;

    // DSGD calculations
    dsgdData.forEach(gd => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) {
        totalACM += gd.klGiaoDich;
      } else {
        totalDSGD += gd.klGiaoDich;
      }
    });

    // CQG FR calculations
    frData.forEach(fr => {
      if (fr.symbol !== 'ZWAZCE') {
        totalFR += fr.qty;
      }
    });

    // ACM Nano calculations
    nanoData.forEach(gd => {
      totalNano += gd.klGiaoDich;
    });

    const differ = Math.abs(totalFR - totalDSGD);
    const differACM = Math.abs(totalNano - totalACM);

    const mismatchedTrades: Array<{
      source: 'MSystem' | 'CQG' | 'ACM' | 'Nano';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      reason: string;
    }> = [];

    // Find FR rows not in DSGD
    frData.forEach(fr => {
      if (fr.symbol === 'ZWAZCE') return;
      const existsInDSGD = dsgdData.some(gd => gd.combinedKey === fr.combinedKey);
      if (!existsInDSGD) {
        mismatchedTrades.push({
          source: 'CQG',
          maLenh: fr.ord,
          maTKGD: fr.accountRaw,
          maHD: fr.symbol,
          giaKhop: fr.fillP,
          klGiaoDich: fr.qty,
          ngayGio: fr.time,
          reason: 'Lệnh CQG không tìm thấy bên M-System',
        });
      }
    });

    // Find DSGD rows not in FR
    dsgdData.forEach(gd => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) return;
      const existsInFR = frData.some(fr => fr.combinedKey === gd.combinedKey);
      if (!existsInFR) {
        mismatchedTrades.push({
          source: 'MSystem',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch M-System không tìm thấy bên CQG',
        });
      }
    });

    // Find ACM Nano rows not in MSystem
    nanoData.forEach(gd => {
      const existsInDSGD = dsgdData.some(row => row.maTKGD.toUpperCase().endsWith('A') && row.maLenh === gd.maGD);
      if (!existsInDSGD) {
        mismatchedTrades.push({
          source: 'ACM',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch ACM không đồng bộ bên M-System',
        });
      }
    });

    // Find MSystem ACM rows not in Nano
    dsgdData.forEach(gd => {
      if (!gd.maTKGD.toUpperCase().endsWith('A')) return;
      const existsInNano = nanoData.some(row => row.maGD === gd.maLenh);
      if (!existsInNano) {
        mismatchedTrades.push({
          source: 'Nano',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch M-System (tự doanh) không có bên cổng ACM',
        });
      }
    });

    // --- II. TTM (Open Positions Matching) ---
    const mismatchedTTM: Array<{
      maTKGD: string;
      ttmValue: number;
      opValue: number;
      differ: number;
    }> = [];
    if (files.ttm && (files.op1 || files.op2)) {
      const ttmData = this.parseTTM(files.ttm);
      const opData: any[] = [];
      if (files.op1) opData.push(...this.parseOP(files.op1));
      if (files.op2) opData.push(...this.parseOP(files.op2));

      // Group totals by Account
      const ttmSummary: Record<string, number> = {};
      ttmData.forEach(t => {
        ttmSummary[t.maTKGD] = (ttmSummary[t.maTKGD] || 0) + t.tongMua + t.tongBan;
      });

      const opSummary: Record<string, number> = {};
      opData.forEach(o => {
        opSummary[o.account] = (opSummary[o.account] || 0) + o.lValue + o.sValue;
      });

      const allAccounts = Array.from(new Set([...Object.keys(ttmSummary), ...Object.keys(opSummary)]));
      allAccounts.forEach(acc => {
        if (acc.toUpperCase().endsWith('A')) return; // Skip ACM

        const ttmVal = ttmSummary[acc] || 0;
        const opVal = opSummary[acc] || 0;

        if (Math.abs(ttmVal - opVal) > 0) {
          mismatchedTTM.push({
            maTKGD: acc,
            ttmValue: ttmVal,
            opValue: opVal,
            differ: Math.abs(ttmVal - opVal),
          });
        }
      });
    }

    // --- III. TTTT vs PS (Closed Trades Matching) ---
    let totalTTTT = 0;
    let totalPS = 0;
    const mismatchedTTTT: Array<{
      maTKGD: string;
      ttttValue: number;
      psValue: number;
      differ: number;
    }> = [];

    if (files.tttt && (files.ps1 || files.ps2)) {
      const ttttData = this.parseTTTTForVolume(files.tttt).filter(t => !this.isIgnoredCommodity(t.maHD));
      const psData: any[] = [];
      if (files.ps1) psData.push(...this.parsePSForVolume(files.ps1));
      if (files.ps2) psData.push(...this.parsePSForVolume(files.ps2));
      const filteredPsData = psData.filter(p => !this.isIgnoredCommodity(p.symbol));

      const ttttSummary: Record<string, number> = {};
      ttttData.forEach(t => {
        if (!t.maTKGD.toUpperCase().endsWith('A')) {
          totalTTTT += t.tongBan;
          ttttSummary[t.maTKGD] = (ttttSummary[t.maTKGD] || 0) + t.tongBan;
        }
      });

      const psSummary: Record<string, number> = {};
      filteredPsData.forEach(p => {
        totalPS += p.sValue;
        psSummary[p.account] = (psSummary[p.account] || 0) + p.sValue;
      });

      const allTtttAccounts = Array.from(new Set([...Object.keys(ttttSummary), ...Object.keys(psSummary)]));
      allTtttAccounts.forEach(acc => {
        if (acc.toUpperCase().endsWith('A')) return; // Skip ACM

        const ttttVal = ttttSummary[acc] || 0;
        const psVal = psSummary[acc] || 0;

        if (Math.abs(ttttVal - psVal) > 0) {
          mismatchedTTTT.push({
            maTKGD: acc,
            ttttValue: ttttVal,
            psValue: psVal,
            differ: Math.abs(ttttVal - psVal),
          });
        }
      });
    }

    return {
      totals: {
        totalDSGD,
        totalFR,
        totalACM,
        totalNano,
        differ,
        differACM,
        totalTTTT: files.tttt ? totalTTTT : undefined,
        totalPS: files.tttt ? totalPS : undefined,
        differTTTT: files.tttt ? Math.abs(totalTTTT - totalPS) : undefined,
      },
      mismatchedTrades,
      mismatchedTTM,
      mismatchedTTTT: files.tttt ? mismatchedTTTT : undefined,
    };
  }

  /**
   * Helper to load statics.json
   */
  private loadStatics(): any {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), '../it-tool-src/operate-transaction-app/Configuration/statics.json');
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (err) {
      this.logger.error('Không thể load statics.json:', err);
    }
    // Fallback static config
    return { LMECode: {}, MonthCode: {}, Commodity: [] };
  }

  /**
   * EOD Calculation and Balance Reconciliation (CheckEOD)
   */
  async checkEOD(
    files: {
      qltkgd: Buffer;
      eod?: Buffer;
      tttt?: Buffer;
      qltkgdName?: string;
      eodName?: string;
      ttttName?: string;
    },
    exchangeRates?: {
      usdLoss: number;
      usdGain: number;
      jpyLoss: number;
      jpyGain: number;
      myrLoss: number;
      myrGain: number;
    }
  ): Promise<{
    negativeIMRAcc: string[];
    negativeBalanceAccs?: string[];
    mismatchedEOD: Array<{
      maTKGD: string;
      calculatedBalance: number;
      eodBalance: number;
      differ: number;
    }>;
    excelBase64?: string;
  }> {
    // 1. Parse QLTKGD.xlsx
    const qltkgdWorkbook = XLSX.read(files.qltkgd, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet) throw new Error('Không tìm thấy sheet nào trong QLTKGD.xlsx');
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 }) as any[][];
    if (qltkgdRows.length < 2) throw new Error('File QLTKGD.xlsx rỗng');

    const qltkgdHeader = qltkgdRows[0].map(h => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(qltkgdHeader, 'Mã TKGD', ['Mã tài khoản', 'Mã TK', 'Tai khoan', 'TKGD', 'Investor Code', 'InvestorCode', 'Account Number', 'Account']);
    const soDuTKKQHienTaiIdx = this.findHeaderIndex(qltkgdHeader, 'Số dư TKKQ hiện tại', ['Số dư TKKQ cuối ngày', 'Số dư hiện tại', 'Số dư cuối ngày', 'Số dư TKKQ', 'TKKQ hiện tại', 'TKKQ cuối ngày']);

    const qltkgdName = files.qltkgdName || 'QLTKGD.xlsx';
    if (maTKGDIdx === -1 || soDuTKKQHienTaiIdx === -1) {
      const missing = [];
      if (maTKGDIdx === -1) missing.push('Mã TKGD');
      if (soDuTKKQHienTaiIdx === -1) missing.push('Số dư TKKQ hiện tại / cuối ngày');
      throw new Error(`${qltkgdName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có trong file: [${qltkgdHeader.slice(0, 15).join(', ')}...]`);
    }

    const negativeBalanceAccs: string[] = [];
    const negativeRows: any[][] = [qltkgdRows[0]]; // Include the header as the first row
    for (let i = 1; i < qltkgdRows.length; i++) {
      const row = qltkgdRows[i];
      if (!row || row.length === 0) continue;
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const balanceVal = parseFloat(row[soDuTKKQHienTaiIdx]);
      if (!maTKGD) continue;

      if (!isNaN(balanceVal) && balanceVal < 0) {
        negativeBalanceAccs.push(maTKGD);
        negativeRows.push(row);
      }
    }

    const negativeIMRAcc: string[] = [];

    // 2. Parse EOD CSV file (eod.csv) if provided
    if (files.eod) {
      const eodWorkbook = XLSX.read(files.eod, { type: 'buffer' });
      const eodSheet = eodWorkbook.Sheets[eodWorkbook.SheetNames[0]];
      if (eodSheet) {
        const eodRows = XLSX.utils.sheet_to_json(eodSheet, { header: 1 }) as any[][];
        if (eodRows.length >= 2) {
          const eodHeader = eodRows[0].map(h => String(h || '').trim());
          const investorCodeIdx = this.findHeaderIndex(eodHeader, 'InvestorCode', ['Investor Code', 'investor_code']);
          const initialRequiredMarginIdx = this.findHeaderIndex(eodHeader, 'InitialRequiredMargin', ['Initial Required Margin', 'initial_required_margin']);
          const estimatedProfitVNDIdx = this.findHeaderIndex(eodHeader, 'EstimatedProfitVND', ['Estimated Profit VND', 'estimated_profit_vnd']);
          const optionsEstimatedProfitVNDIdx = this.findHeaderIndex(eodHeader, 'OptionsEstimatedProfitVND', ['Options Estimated Profit VND', 'options_estimated_profit_vnd']);
          const netMarginIdx = this.findHeaderIndex(eodHeader, 'NetMargin', ['Net Margin', 'net_margin']);
          const availableMarginIdx = this.findHeaderIndex(eodHeader, 'AvailableMargin', ['Available Margin', 'available_margin']);
          const additionalMarginIdx = this.findHeaderIndex(eodHeader, 'AdditionalMargin', ['Additional Margin', 'additional_margin']);

          const eodName = files.eodName || 'eod.csv';
          if (investorCodeIdx === -1) {
            throw new Error(`${eodName} không hợp lệ vì thiếu cột: InvestorCode. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${eodHeader.slice(0, 15).join(', ')}...]`);
          }

          for (let i = 1; i < eodRows.length; i++) {
            const row = eodRows[i];
            if (!row || row.length === 0) continue;
            const investorCode = String(row[investorCodeIdx] || '').trim();
            if (!investorCode) continue;

            const initialRequiredMargin = initialRequiredMarginIdx !== -1 ? (parseFloat(row[initialRequiredMarginIdx]) || 0) : 0;
            const estimatedProfitVND = estimatedProfitVNDIdx !== -1 ? (parseFloat(row[estimatedProfitVNDIdx]) || 0) : 0;
            const optionsEstimatedProfitVND = optionsEstimatedProfitVNDIdx !== -1 ? (parseFloat(row[optionsEstimatedProfitVNDIdx]) || 0) : 0;
            const netMargin = netMarginIdx !== -1 ? (parseFloat(row[netMarginIdx]) || 0) : 0;
            const availableMargin = availableMarginIdx !== -1 ? (parseFloat(row[availableMarginIdx]) || 0) : 0;
            const additionalMargin = additionalMarginIdx !== -1 ? (parseFloat(row[additionalMarginIdx]) || 0) : 0;

            if (initialRequiredMargin === 0 && estimatedProfitVND === 0 && optionsEstimatedProfitVND === 0 && netMargin === availableMargin && availableMargin < 0 && additionalMargin > 0) {
              negativeIMRAcc.push(investorCode);
            }
          }
        }
      }
    }

    // 3. Generate new workbook containing negative current balance rows
    const newSheet = XLSX.utils.aoa_to_sheet(negativeRows);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Negative Balance Accounts');
    const excelBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    // Gửi email báo cáo tài khoản âm ký quỹ
    try {
      const emailConfig = await this.marginCheckerService.loadConfig();
      const mailSettings = emailConfig.negativeMarginReport || { isSendWarning: true, email: ['it.support@mxv.vn'] };
      if (mailSettings.isSendWarning && (negativeBalanceAccs.length > 0 || negativeIMRAcc.length > 0)) {
        const subject = `🚨 [MXV MARGIN WARNING] Danh sách Tài khoản Âm ký quỹ đầu ngày`;
        const htmlBody = this.buildNegativeMarginEmailHtml(negativeBalanceAccs, negativeIMRAcc);
        const attachments = [{
          filename: `NegativeAccounts_${new Date().toISOString().split('T')[0]}.xlsx`,
          content: Buffer.from(excelBuffer),
        }];
        const emailResult = await this.marginCheckerService.sendEmailNotification(
          emailConfig,
          mailSettings.email,
          subject,
          htmlBody,
          attachments
        );
        if (emailResult.success) {
          this.logger.log(`Đã gửi email báo cáo tài khoản âm ký quỹ thành công: ${emailResult.messageId}`);
        } else {
          this.logger.error(`Không thể gửi email báo cáo tài khoản âm ký quỹ: ${emailResult.error}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Lỗi gửi email báo cáo tài khoản âm ký quỹ: ${err.message}`);
    }

    // Hook: check contract maturity notifications if tttt file is provided
    if (files.tttt) {
      try {
        const email = await this.emailWatcherService.getLatestEmail('Thông báo tất toán hợp đồng', 'daonguyen@mxv.vn');
        if (email) {
          const expiringContracts = this.teamsNotifierService.parseMaturityEmail(email.body);
          if (expiringContracts.length > 0) {
            await this.teamsNotifierService.checkMaturityAndNotifyFromFiles(
              files.qltkgd,
              files.tttt,
              expiringContracts,
              'EOD Manual Upload Trigger'
            );
          }
        }
      } catch (err: any) {
        this.logger.error(`Lỗi khi chạy đối chiếu đáo hạn tự động trong EOD: ${err.message}`);
      }
    }

    return {
      negativeIMRAcc,
      negativeBalanceAccs,
      mismatchedEOD: [],
      excelBase64: excelBuffer.toString('base64'),
    };
  }

  /**
   * CQG EOD Balance Reconciliation (CheckEODCQG)
   */
  async checkEODCQG(
    files: {
      qltkgd: Buffer;
      accountsBalances: Buffer;
      qltkgdName?: string;
      accountsBalancesName?: string;
    },
    usdExchangeRate: number = 25220
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
    // 1. Parse QLTKGD.xlsx
    const qltkgdWorkbook = XLSX.read(files.qltkgd, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet) throw new Error('Không tìm thấy sheet nào trong QLTKGD.xlsx');
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 }) as any[][];
    if (qltkgdRows.length < 2) throw new Error('File QLTKGD.xlsx rỗng');

    const qltkgdHeader = qltkgdRows[0].map(h => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(qltkgdHeader, 'Mã TKGD', ['Mã tài khoản', 'Mã TK', 'Tai khoan', 'TKGD', 'Investor Code', 'InvestorCode', 'Account Number', 'Account']);
    const laiLoChoDaoHanIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế chờ đáo hạn', ['Chờ đáo hạn', 'Cho dao han', 'Lai lo cho dao han', 'Lãi lỗ chờ đáo hạn']);
    const laiLoThucTeFuturesVNDIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (VND)', ['Lãi lỗ thực tế Futures', 'Lãi lỗ Futures', 'Lai lo thuc te Futures', 'Lai lo Futures']);
    const soDuTKKQHienTaiIdx = this.findHeaderIndex(qltkgdHeader, 'Số dư TKKQ hiện tại', ['Số dư TKKQ cuối ngày', 'Số dư hiện tại', 'Số dư cuối ngày', 'Số dư TKKQ', 'TKKQ hiện tại', 'TKKQ cuối ngày']);

    const qltkgdName = files.qltkgdName || 'QLTKGD.xlsx';
    if (maTKGDIdx === -1 || soDuTKKQHienTaiIdx === -1) {
      const missing = [];
      if (maTKGDIdx === -1) missing.push('Mã TKGD');
      if (soDuTKKQHienTaiIdx === -1) missing.push('Số dư TKKQ hiện tại / cuối ngày');
      throw new Error(`${qltkgdName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${qltkgdHeader.slice(0, 15).join(', ')}...]`);
    }

    const qltkgdDataMap = new Map<string, {
      choDaoHan: number;
      laiLoVND: number;
      soDuTKKQHienTai: number;
    }>();

    for (let i = 1; i < qltkgdRows.length; i++) {
      const row = qltkgdRows[i];
      if (!row || row.length === 0) continue;
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      if (!maTKGD) continue;

      qltkgdDataMap.set(maTKGD, {
        choDaoHan: laiLoChoDaoHanIdx !== -1 ? (parseFloat(row[laiLoChoDaoHanIdx]) || 0) : 0,
        laiLoVND: laiLoThucTeFuturesVNDIdx !== -1 ? (parseFloat(row[laiLoThucTeFuturesVNDIdx]) || 0) : 0,
        soDuTKKQHienTai: soDuTKKQHienTaiIdx !== -1 ? (parseFloat(row[soDuTKKQHienTaiIdx]) || 0) : 0,
      });
    }

    // 2. Parse Accounts_Balances.xlsx (CQG balances)
    const asWorkbook = XLSX.read(files.accountsBalances, { type: 'buffer' });
    const asSheet = asWorkbook.Sheets[asWorkbook.SheetNames[0]];
    if (!asSheet) throw new Error('Không tìm thấy sheet nào trong Accounts_Balances.xlsx');
    const asRows = XLSX.utils.sheet_to_json(asSheet, { header: 1 }) as any[][];
    if (asRows.length < 2) throw new Error('File Accounts_Balances.xlsx rỗng');

    const asHeader = asRows[0].map(h => String(h || '').trim());
    const accountNumberIdx = this.findHeaderIndex(asHeader, 'Account Number', ['Account', 'Tài khoản', 'Mã TKGD', 'Tai khoan']);
    const endCashBalanceIdx = this.findHeaderIndex(asHeader, 'End Cash Balance', ['Cash Balance', 'Balance', 'Số dư', 'Số dư cuối ngày', 'So du']);
    const recordDescriptionIdx = this.findHeaderIndex(asHeader, 'Record Description', ['Description', 'Mô tả', 'Mo ta']);

    const asName = files.accountsBalancesName || 'Accounts_Balances.xlsx';
    if (accountNumberIdx === -1 || endCashBalanceIdx === -1) {
      const missing = [];
      if (accountNumberIdx === -1) missing.push('Account Number');
      if (endCashBalanceIdx === -1) missing.push('End Cash Balance');
      throw new Error(`${asName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${asHeader.slice(0, 15).join(', ')}...]`);
    }

    const cqgBalanceMap = new Map<string, number>();

    for (let i = 1; i < asRows.length; i++) {
      const row = asRows[i];
      if (!row || row.length === 0) continue;

      const recordDescription = recordDescriptionIdx !== -1 ? String(row[recordDescriptionIdx] || '').trim() : '';
      if (!recordDescription.startsWith('Current-day')) {
        continue;
      }

      const account = String(row[accountNumberIdx] || '').trim();
      const balance = this.parseCqgNumber(row[endCashBalanceIdx]);

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

    // 3. Perform comparison
    const result: Array<{
      maTKGD: string;
      calculatedBalance: number;
      cqgBalance: number;
      differ: number;
      inMS: boolean;
      inCQG: boolean;
    }> = [];

    for (const maTKGD of cqgBalanceMap.keys()) {
      if (maTKGD.startsWith('999') || maTKGD.startsWith('050') || !/^\d/.test(maTKGD)) {
        continue;
      }

      const qltkgdRow = qltkgdDataMap.get(maTKGD);
      const cqgBalance = cqgBalanceMap.get(maTKGD) ?? 0;

      if (qltkgdRow) {
        const calculated = (qltkgdRow.soDuTKKQHienTai + qltkgdRow.choDaoHan - qltkgdRow.laiLoVND) / usdExchangeRate;
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
      } else if (cqgBalance !== undefined) {
        const roundedCQG = Math.round(cqgBalance * 100) / 100;
        result.push({
          maTKGD,
          calculatedBalance: 0,
          cqgBalance: roundedCQG,
          differ: roundedCQG,
          inMS: false,
          inCQG: true,
        });
      }
    }

    // Gửi email báo cáo đối chiếu EOD
    try {
      const emailConfig = await this.marginCheckerService.loadConfig();
      const mailSettings = emailConfig.eodCheck || { isSendWarning: true, email: ['it.support@mxv.vn'] };
      if (mailSettings.isSendWarning) {
        const passed = result.length === 0;
        const subject = `[MXV EOD CHECK] Báo cáo đối chiếu số dư cuối ngày CQG vs M-System - ${passed ? 'KHỚP' : 'LỆCH'}`;
        const htmlBody = this.buildEodEmailHtml(passed, result, usdExchangeRate);
        const emailResult = await this.marginCheckerService.sendEmailNotification(
          emailConfig,
          mailSettings.email,
          subject,
          htmlBody
        );
        if (emailResult.success) {
          this.logger.log(`Đã gửi email báo cáo EOD thành công: ${emailResult.messageId}`);
        } else {
          this.logger.error(`Không thể gửi email báo cáo EOD: ${emailResult.error}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Lỗi gửi email báo cáo EOD: ${err.message}`);
    }

    return result;
  }

  /**
   * Filter negative margin accounts and generate NegativeAccounts.xlsx buffer
   */
  async checkNegativeMargin(
    files: {
      qltkgd: Buffer;
      eod?: Buffer;
      qltkgdName?: string;
      eodName?: string;
    }
  ): Promise<{
    negativeBalanceAccs: string[];
    negativeIMRAcc: string[];
    excelBase64: string;
  }> {
    // 1. Parse QLTKGD.xlsx
    const qltkgdWorkbook = XLSX.read(files.qltkgd, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet) throw new Error('Không tìm thấy sheet nào trong QLTKGD.xlsx');
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 }) as any[][];
    if (qltkgdRows.length < 2) throw new Error('File QLTKGD.xlsx rỗng');

    const qltkgdHeader = qltkgdRows[0].map(h => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(qltkgdHeader, 'Mã TKGD', ['Mã tài khoản', 'Mã TK', 'Tai khoan', 'TKGD', 'Investor Code', 'InvestorCode', 'Account Number', 'Account']);
    const soDuTKKQHienTaiIdx = this.findHeaderIndex(qltkgdHeader, 'Số dư TKKQ hiện tại', ['Số dư TKKQ cuối ngày', 'Số dư hiện tại', 'Số dư cuối ngày', 'Số dư TKKQ', 'TKKQ hiện tại', 'TKKQ cuối ngày']);

    const qltkgdName = files.qltkgdName || 'QLTKGD.xlsx';
    if (maTKGDIdx === -1 || soDuTKKQHienTaiIdx === -1) {
      const missing = [];
      if (maTKGDIdx === -1) missing.push('Mã TKGD');
      if (soDuTKKQHienTaiIdx === -1) missing.push('Số dư TKKQ hiện tại / cuối ngày');
      throw new Error(`${qltkgdName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${qltkgdHeader.slice(0, 15).join(', ')}...]`);
    }

    const negativeBalanceAccs: string[] = [];
    const negativeRows: any[][] = [qltkgdRows[0]]; // Include the header as the first row

    for (let i = 1; i < qltkgdRows.length; i++) {
      const row = qltkgdRows[i];
      if (!row || row.length === 0) continue;
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const balanceVal = parseFloat(row[soDuTKKQHienTaiIdx]);
      if (!maTKGD) continue;

      if (!isNaN(balanceVal) && balanceVal < 0) {
        negativeBalanceAccs.push(maTKGD);
        negativeRows.push(row);
      }
    }

    // 2. Parse EOD CSV file (eod.csv) if provided
    const negativeIMRAcc: string[] = [];
    if (files.eod) {
      const eodWorkbook = XLSX.read(files.eod, { type: 'buffer' });
      const eodSheet = eodWorkbook.Sheets[eodWorkbook.SheetNames[0]];
      if (eodSheet) {
        const eodRows = XLSX.utils.sheet_to_json(eodSheet, { header: 1 }) as any[][];
        if (eodRows.length >= 2) {
          const eodHeader = eodRows[0].map(h => String(h || '').trim());
          const investorCodeIdx = this.findHeaderIndex(eodHeader, 'InvestorCode', ['Investor Code', 'investor_code']);
          const initialRequiredMarginIdx = this.findHeaderIndex(eodHeader, 'InitialRequiredMargin', ['Initial Required Margin', 'initial_required_margin']);
          const estimatedProfitVNDIdx = this.findHeaderIndex(eodHeader, 'EstimatedProfitVND', ['Estimated Profit VND', 'estimated_profit_vnd']);
          const optionsEstimatedProfitVNDIdx = this.findHeaderIndex(eodHeader, 'OptionsEstimatedProfitVND', ['Options Estimated Profit VND', 'options_estimated_profit_vnd']);
          const netMarginIdx = this.findHeaderIndex(eodHeader, 'NetMargin', ['Net Margin', 'net_margin']);
          const availableMarginIdx = this.findHeaderIndex(eodHeader, 'AvailableMargin', ['Available Margin', 'available_margin']);
          const additionalMarginIdx = this.findHeaderIndex(eodHeader, 'AdditionalMargin', ['Additional Margin', 'additional_margin']);

          if (investorCodeIdx !== -1) {
            for (let i = 1; i < eodRows.length; i++) {
              const row = eodRows[i];
              if (!row || row.length === 0) continue;
              const investorCode = String(row[investorCodeIdx] || '').trim();
              if (!investorCode) continue;

              const initialRequiredMargin = initialRequiredMarginIdx !== -1 ? (parseFloat(row[initialRequiredMarginIdx]) || 0) : 0;
              const estimatedProfitVND = estimatedProfitVNDIdx !== -1 ? (parseFloat(row[estimatedProfitVNDIdx]) || 0) : 0;
              const optionsEstimatedProfitVND = optionsEstimatedProfitVNDIdx !== -1 ? (parseFloat(row[optionsEstimatedProfitVNDIdx]) || 0) : 0;
              const netMargin = netMarginIdx !== -1 ? (parseFloat(row[netMarginIdx]) || 0) : 0;
              const availableMargin = availableMarginIdx !== -1 ? (parseFloat(row[availableMarginIdx]) || 0) : 0;
              const additionalMargin = additionalMarginIdx !== -1 ? (parseFloat(row[additionalMarginIdx]) || 0) : 0;

              if (initialRequiredMargin === 0 && estimatedProfitVND === 0 && optionsEstimatedProfitVND === 0 && netMargin === availableMargin && availableMargin < 0 && additionalMargin > 0) {
                negativeIMRAcc.push(investorCode);
              }
            }
          }
        }
      }
    }

    // 3. Generate new workbook containing negative current balance rows
    const newSheet = XLSX.utils.aoa_to_sheet(negativeRows);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Negative Balance Accounts');
    const excelBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    // Gửi email báo cáo tài khoản âm ký quỹ
    try {
      const emailConfig = await this.marginCheckerService.loadConfig();
      const mailSettings = emailConfig.negativeMarginReport || { isSendWarning: true, email: ['it.support@mxv.vn'] };
      if (mailSettings.isSendWarning && (negativeBalanceAccs.length > 0 || negativeIMRAcc.length > 0)) {
        const subject = `🚨 [MXV MARGIN WARNING] Danh sách Tài khoản Âm ký quỹ đầu ngày`;
        const htmlBody = this.buildNegativeMarginEmailHtml(negativeBalanceAccs, negativeIMRAcc);
        const attachments = [{
          filename: `NegativeAccounts_${new Date().toISOString().split('T')[0]}.xlsx`,
          content: Buffer.from(excelBuffer),
        }];
        const emailResult = await this.marginCheckerService.sendEmailNotification(
          emailConfig,
          mailSettings.email,
          subject,
          htmlBody,
          attachments
        );
        if (emailResult.success) {
          this.logger.log(`Đã gửi email báo cáo tài khoản âm ký quỹ thành công: ${emailResult.messageId}`);
        } else {
          this.logger.error(`Không thể gửi email báo cáo tài khoản âm ký quỹ: ${emailResult.error}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Lỗi gửi email báo cáo tài khoản âm ký quỹ: ${err.message}`);
    }

    return {
      negativeBalanceAccs,
      negativeIMRAcc,
      excelBase64: excelBuffer.toString('base64'),
    };
  }

  /**
   * Parse Straits CSV file containing "Buy" and "Sell" columns
   */
  private parseStraitsCsv(buffer: Buffer): { totalVolume: number } {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) {
      throw new Error('File Straits CSV rỗng');
    }
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
    const buyColIndex = headers.indexOf('buy');
    const sellColIndex = headers.indexOf('sell');

    if (buyColIndex === -1 || sellColIndex === -1) {
      throw new Error("Không tìm thấy cột 'Buy' hoặc 'Sell' trong file CSV Straits");
    }

    let totalVolume = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',');
      if (buyColIndex < values.length) {
        const buyVal = parseFloat(values[buyColIndex].replace(/"/g, '').trim()) || 0;
        totalVolume += buyVal;
      }
      if (sellColIndex < values.length) {
        const sellVal = parseFloat(values[sellColIndex].replace(/"/g, '').trim()) || 0;
        totalVolume += sellVal;
      }
    }
    return { totalVolume };
  }

  /**
   * Parse TTTT.xlsx / TTM.xlsx for Position reconciliation
   */
  private parseTTTTForRecon(buffer: Buffer): { account: string; symbol: string; position: number }[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim());
    const accountIdx = this.findHeaderIndex(header, 'Mã TKGD', ['Mã tài khoản', 'Account', 'Mã khách hàng', 'Mã KH']);
    const symbolIdx = this.findHeaderIndex(header, 'Mã HĐ', ['Mã hợp đồng', 'Symbol', 'Mã HH', 'Mã hàng hóa']);
    const positionIdx = this.findHeaderIndex(header, 'KL ròng', ['Khối lượng ròng', 'Net Position', 'Position', 'Vị thế ròng', 'Trạng thái ròng']);

    // fallback to index if not found (column H is 7, column J is 9, column T is 19)
    const finalAccIdx = accountIdx !== -1 ? accountIdx : 7;
    const finalSymIdx = symbolIdx !== -1 ? symbolIdx : 9;
    const finalPosIdx = positionIdx !== -1 ? positionIdx : 19;

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const account = String(row[finalAccIdx] || '').trim();
      const symbol = String(row[finalSymIdx] || '').trim();
      const position = parseFloat(row[finalPosIdx]) || 0;
      if (!account || !symbol) continue;
      result.push({ account, symbol, position });
    }
    return result;
  }

  /**
   * Parse PS.xlsx for Position reconciliation
   */
  private parsePSForRecon(
    buffer: Buffer,
    tradingDate: Date,
    holidays: string[] = [],
  ): { account: string; symbol: string; position: number }[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim());
    const accountIdx = this.findHeaderIndex(header, 'Account', ['Mã TKGD', 'Mã tài khoản']);
    const symbolIdx = this.findHeaderIndex(header, 'Symbol', ['Mã HĐ', 'Mã hợp đồng']);
    const positionIdx = this.findHeaderIndex(header, 'Position', ['Net', 'KL ròng', 'Vị thế', 'Trạng thái ròng']);

    // fallback to index if not found (column A is 0, column D is 3, column I is 8)
    const finalAccIdx = accountIdx !== -1 ? accountIdx : 0;
    const finalSymIdx = symbolIdx !== -1 ? symbolIdx : 3;
    const finalPosIdx = positionIdx !== -1 ? positionIdx : 8;

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      let account = String(row[finalAccIdx] || '').trim();
      let symbol = String(row[finalSymIdx] || '').trim();
      const position = this.parseCqgNumber(row[finalPosIdx]);
      if (!account || !symbol) continue;

      // adjust account suffix
      account = account.replace(/F$/i, '')
        .replace(/L$/i, '-L')
        .replace(/S$/i, '-S')
        .replace(/--/g, '-');

      // convert LME symbols
      symbol = this.convertLMESymbol(symbol, tradingDate, holidays);

      result.push({ account, symbol, position });
    }
    return result;
  }

  async checkPreEOD(
    files: {
      dsgd: Buffer;
      acmTrades: Buffer;
      cqgFr: Buffer;
      tttt: Buffer;
      cqgPs: Buffer;
    },
    acmTradesName: string,
    tradingDate: Date,
    holidays: string[] = [],
    sessionStartStr: string = '05:00',
  ): Promise<{
    passed: boolean;
    totals: {
      totalACM_MS: number;
      totalACM_Straits: number;
      differACM: number;
      totalCQG_MS: number;
      totalCQG_FR: number;
      differCQG: number;
    };
    mismatchedTrades: Array<{
      source: 'MSystem' | 'CQG';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      reason: string;
    }>;
    mismatchedPositions: Array<{
      account: string;
      symbol: string;
      msPosition: number;
      cqgPosition: number;
      differ: number;
    }>;
  }> {
    if (sessionStartStr) {
      await this.settingsService.setSetting('session_start_time', sessionStartStr);
    }
    // 1. Calculate expected T-1 date relative to tradingDate
    const d = new Date(tradingDate);
    d.setDate(d.getDate() - 1);
    while (d.getDay() === 0 || d.getDay() === 6) { // 0 Sunday, 6 Saturday
      d.setDate(d.getDate() - 1);
    }
    const expectedDateStr = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;

    // Validate filename date suffix for acmTrades
    if (acmTradesName && !acmTradesName.includes(expectedDateStr)) {
      throw new Error(`File ACM Trades (${acmTradesName}) không đúng ngày T-1 (${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}). Vui lòng kiểm tra lại.`);
    }

    // Calculate time bounds: sessionStart and checkTime
    const [sHour, sMin] = sessionStartStr.split(':').map(Number);

    const isPastDateOrDateOnly =
      (tradingDate.getHours() === 0 && tradingDate.getMinutes() === 0 && tradingDate.getSeconds() === 0) ||
      (tradingDate.getUTCHours() === 0 && tradingDate.getUTCMinutes() === 0 && tradingDate.getUTCSeconds() === 0);

    let sessionStart: Date;
    let checkTime: Date;
    if (isPastDateOrDateOnly) {
      // Session start is T-1 date at 06:00
      sessionStart = new Date(d);
      sessionStart.setHours(sHour, sMin, 0, 0);
      
      // checkTime is tradingDate (checking date) at 06:00
      checkTime = new Date(tradingDate);
      checkTime.setHours(sHour, sMin, 0, 0);
    } else {
      checkTime = new Date(tradingDate);
      sessionStart = new Date(tradingDate);
      sessionStart.setHours(sHour, sMin, 0, 0);
      if (checkTime < sessionStart) {
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
      while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
    }

    // 2. Parse DSGD and separate into ACM and CQG trades
    const rawDsgdData = this.parseDSGD(files.dsgd);
    const dsgdData = rawDsgdData.filter(gd => {
      if (this.isIgnoredCommodity(gd.maHD)) return false;
      if (!gd.ngayGio) return true;
      const parts = gd.ngayGio.split(/\s+/);
      const dateParts = parts[0].split('-');
      const timeParts = (parts[1] || '00:00:00').split(':');
      if (dateParts.length < 3) return true;
      const d = Number(dateParts[0]);
      const m = Number(dateParts[1]);
      const y = Number(dateParts[2]);
      const hr = Number(timeParts[0]) || 0;
      const min = Number(timeParts[1]) || 0;
      const secVal = parseFloat(timeParts[2] || '0') || 0;
      const sec = Math.floor(secVal);
      const ms = Math.round((secVal - sec) * 1000);
      const tradeTime = new Date(y, m - 1, d, hr, min, sec, ms);
      return tradeTime >= sessionStart && tradeTime <= checkTime;
    });

    let totalACM_MS = 0;
    let totalCQG_MS = 0;
    dsgdData.forEach(gd => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) {
        totalACM_MS += gd.klGiaoDich;
      } else {
        totalCQG_MS += gd.klGiaoDich;
      }
    });

    // 3. Parse Straits ACM Trades CSV
    const acmStraitsData = this.parseStraitsCsv(files.acmTrades);
    const totalACM_Straits = acmStraitsData.totalVolume;
    const differACM = Math.abs(totalACM_MS - totalACM_Straits);

    // 4. Parse CQG FR.xlsx and filter out ZWAZCE
    const rawFrData = this.parseFR(files.cqgFr, tradingDate, holidays);
    const frData = rawFrData.filter(fr => {
      if (this.isIgnoredCommodity(fr.symbol)) return false;
      if (!fr.time) return true;
      const tradeTime = this.parseCqgDateTime(fr.time, tradingDate);
      if (!tradeTime) return true;
      return tradeTime >= sessionStart && tradeTime <= checkTime;
    });

    let totalCQG_FR = 0;
    frData.forEach(fr => {
      if (fr.symbol !== 'ZWAZCE') {
        totalCQG_FR += fr.qty;
      }
    });
    const differCQG = Math.abs(totalCQG_MS - totalCQG_FR);

    // 5. Find trade discrepancies for normal CQG trades (similar to checkKLGD)
    const mismatchedTrades: Array<{
      source: 'MSystem' | 'CQG';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      reason: string;
    }> = [];

    // Find FR rows not in DSGD
    frData.forEach(fr => {
      if (fr.symbol === 'ZWAZCE') return;
      const existsInDSGD = dsgdData.some(gd => gd.combinedKey === fr.combinedKey);
      if (!existsInDSGD) {
        mismatchedTrades.push({
          source: 'CQG',
          maLenh: fr.ord,
          maTKGD: fr.accountRaw,
          maHD: fr.symbol,
          giaKhop: fr.fillP,
          klGiaoDich: fr.qty,
          ngayGio: fr.time,
          reason: 'Lệnh CQG không tìm thấy bên M-System',
        });
      }
    });

    // Find DSGD rows not in FR (excluding ACM trades)
    dsgdData.forEach(gd => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) return;
      const existsInFR = frData.some(fr => fr.combinedKey === gd.combinedKey);
      if (!existsInFR) {
        mismatchedTrades.push({
          source: 'MSystem',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch M-System không tìm thấy bên CQG',
        });
      }
    });

    // 6. Compare Net Positions (Check 2: TTTT.xlsx vs PS.xlsx)
    const ttttList = this.parseTTTTForRecon(files.tttt);
    const psList = this.parsePSForRecon(files.cqgPs, tradingDate, holidays);

    // Group MS positions by Account + Symbol
    const msSummary = new Map<string, { account: string; symbol: string; position: number }>();
    ttttList.forEach(item => {
      // Filter out self-trading (ACM) accounts ending with 'A' or 'a' (like -A, -a, etc.)
      if (item.account.toUpperCase().endsWith('A')) return;
      if (this.isIgnoredCommodity(item.symbol)) return;

      const key = `${item.account}_${item.symbol}`;
      const existing = msSummary.get(key) || { account: item.account, symbol: item.symbol, position: 0 };
      existing.position += item.position;
      msSummary.set(key, existing);
    });

    // Group CQG positions by Account + Symbol
    const cqgSummary = new Map<string, { account: string; symbol: string; position: number }>();
    psList.forEach(item => {
      if (this.isIgnoredCommodity(item.symbol)) return;
      const key = `${item.account}_${item.symbol}`;
      const existing = cqgSummary.get(key) || { account: item.account, symbol: item.symbol, position: 0 };
      existing.position += item.position;
      cqgSummary.set(key, existing);
    });

    // Find mismatched net positions
    const mismatchedPositions: Array<{
      account: string;
      symbol: string;
      msPosition: number;
      cqgPosition: number;
      differ: number;
    }> = [];

    const allKeys = new Set([...msSummary.keys(), ...cqgSummary.keys()]);
    for (const key of allKeys) {
      const ms = msSummary.get(key);
      const cqg = cqgSummary.get(key);
      const account = ms?.account || cqg?.account || '';
      const symbol = ms?.symbol || cqg?.symbol || '';
      const msVal = ms?.position || 0;
      const cqgVal = cqg?.position || 0;
      const diff = msVal - cqgVal;

      if (Math.abs(diff) > 0.001) {
        mismatchedPositions.push({
          account,
          symbol,
          msPosition: msVal,
          cqgPosition: cqgVal,
          differ: diff,
        });
      }
    }

    const passed = differACM === 0 && differCQG === 0 && mismatchedTrades.length === 0 && mismatchedPositions.length === 0;

    // Gửi email báo cáo đối chiếu Pre-EOD
    try {
      const emailConfig = await this.marginCheckerService.loadConfig();
      const mailSettings = emailConfig.preEodCheck || { isSendWarning: true, email: ['it.support@mxv.vn'] };
      if (mailSettings.isSendWarning) {
        const subject = `[MXV PRE-EOD CHECK] Báo cáo đối chiếu Khối lượng & Vị thế cuối ngày - ${passed ? 'KHỚP' : 'LỆCH'}`;
        const htmlBody = this.buildPreEodEmailHtml(passed, {
          totalACM_MS,
          totalACM_Straits,
          differACM,
          totalCQG_MS,
          totalCQG_FR,
          differCQG,
        }, mismatchedTrades, mismatchedPositions);
        const emailResult = await this.marginCheckerService.sendEmailNotification(
          emailConfig,
          mailSettings.email,
          subject,
          htmlBody
        );
        if (emailResult.success) {
          this.logger.log(`Đã gửi email báo cáo Pre-EOD thành công: ${emailResult.messageId}`);
        } else {
          this.logger.error(`Không thể gửi email báo cáo Pre-EOD: ${emailResult.error}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Lỗi gửi email Pre-EOD: ${err.message}`);
    }

    return {
      passed,
      totals: {
        totalACM_MS,
        totalACM_Straits,
        differACM,
        totalCQG_MS,
        totalCQG_FR,
        differCQG,
      },
      mismatchedTrades,
      mismatchedPositions,
    };
  }

  private findLatestFile(dirPath: string, pattern: RegExp): string | null {
    try {
      const fs = require('fs');
      const path = require('path');
      if (!fs.existsSync(dirPath)) return null;

      const files = fs.readdirSync(dirPath);
      const matches = files
        .filter((f: string) => pattern.test(f))
        .map((f: string) => {
          const fullPath = path.join(dirPath, f);
          const stat = fs.statSync(fullPath);
          return { name: f, fullPath, mtime: stat.mtimeMs };
        });

      if (matches.length === 0) return null;
      matches.sort((a: any, b: any) => b.mtime - a.mtime);
      return matches[0].fullPath;
    } catch (err) {
      this.logger.error(`Lỗi khi tìm file mới nhất trong ${dirPath}:`, err);
      return null;
    }
  }

  async runAutoCheckSOD(tradingDate: Date): Promise<any> {
    const fs = require('fs');
    const path = require('path');

    // 1. Tìm file Accounts_Balances mới nhất trong temp/cast-downloads
    const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');
    const accountsBalancesPath = this.findLatestFile(castDownloadsDir, /^Accounts_Balances_.*\.xlsx$/i);

    if (!accountsBalancesPath) {
      throw new Error(`Không tìm thấy file Accounts_Balances trong thư mục ${castDownloadsDir}`);
    }

    // 2. Tìm file QLTKGD.xlsx mới nhất của ngày tradingDate
    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );
    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const dailyPath = path.join(msBackupBase, subFolder);

    const qltkgdPath = path.join(dailyPath, 'QLTKGD.xlsx');
    if (!fs.existsSync(qltkgdPath)) {
      throw new Error(`Không tìm thấy file QLTKGD.xlsx của ngày ${day}/${month}/${year} tại: ${qltkgdPath}`);
    }

    this.logger.log(`Bắt đầu chạy đối chiếu SOD tự động:`);
    this.logger.log(`- File QLTKGD: ${qltkgdPath}`);
    this.logger.log(`- File Accounts_Balances: ${accountsBalancesPath}`);

    // 3. Thực hiện đối chiếu CQG Balance (dùng hàm checkEODCQG)
    const qltkgdBuffer = fs.readFileSync(qltkgdPath);
    const accountsBalancesBuffer = fs.readFileSync(accountsBalancesPath);
    const emailConfig = await this.marginCheckerService.loadConfig();
    const differThreshold = emailConfig?.sodCheck?.differThreshold !== undefined ? emailConfig.sodCheck.differThreshold : 100;
    const isSendWarning = emailConfig?.sodCheck?.isSendWarning !== false;

    let usdRate = 25220;
    try {
      this.logger.log('Đang tự động đồng bộ tỷ giá USD từ M-System...');
      usdRate = await this.syncUsdRateFromMSystem();
    } catch (err) {
      this.logger.warn(`Không thể đồng bộ tỷ giá USD tự động (sẽ sử dụng tỷ giá cũ): ${err.message}`);
      const usdRateStr = await this.settingsService.getSetting('usd_exchange_rate', '25220');
      usdRate = parseFloat(usdRateStr) || 25220;
    }

    const discrepancies = await this.checkEODCQG({
      qltkgd: qltkgdBuffer,
      accountsBalances: accountsBalancesBuffer,
      qltkgdName: 'QLTKGD.xlsx',
      accountsBalancesName: path.basename(accountsBalancesPath),
    }, usdRate);

    const significantDiscrepancies = discrepancies.filter(d => d.differ > differThreshold);
    const hasDiscrepancy = significantDiscrepancies.length > 0;
    
    // Soạn tin nhắn Telegram
    let telegramMsg = `🔔 <b>[ĐỐI CHIẾU SOD TỰ ĐỘNG - ${day}/${month}/${year}]</b>\n`;
    telegramMsg += `• Trạng thái: ${hasDiscrepancy ? '🚨 <b>PHÁT HIỆN LỆCH SỐ DƯ</b>' : `✓ Khớp hoàn toàn (sai số &lt; $${differThreshold})`}\n`;
    telegramMsg += `• File QLTKGD: <code>${path.basename(qltkgdPath)}</code>\n`;
    telegramMsg += `• File CQG CAST: <code>${path.basename(accountsBalancesPath)}</code>\n`;
    telegramMsg += `• Tỷ giá USD áp dụng: <code>${usdRate} VND</code>\n`;

    if (hasDiscrepancy) {
      telegramMsg += `\n⚠️ <b>Danh sách tài khoản lệch (> $${differThreshold}):</b>\n`;
      significantDiscrepancies.slice(0, 15).forEach((d) => {
        telegramMsg += `- <b>TK ${d.maTKGD}</b>: MS <code>$${d.calculatedBalance}</code> vs CQG <code>$${d.cqgBalance}</code> (Lệch: <b>$${d.differ.toFixed(2)}</b>)\n`;
      });
      if (significantDiscrepancies.length > 15) {
        telegramMsg += `- ... và <i>${significantDiscrepancies.length - 15} tài khoản khác</i>.\n`;
      }
    } else {
      telegramMsg += `\n✓ Số dư khớp hoàn hảo giữa M-System và CQG CAST.`;
    }

    this.logger.log(`Gửi tin nhắn cảnh báo Telegram: ${hasDiscrepancy ? 'LỆCH' : 'KHỚP'}`);
    await this.telegramService.sendMessage(telegramMsg);

    // 4. Gửi báo cáo Email qua SMTP (Kế thừa từ MarginCheckerService)
    try {
      if (!isSendWarning) {
        this.logger.log(`Gửi email báo cáo SOD đã bị tắt trong cấu hình.`);
      } else {
        let toEmails = emailConfig?.sodCheck?.email || emailConfig?.marginOnOrder?.email || ['it.support@mxv.vn'];
        
        const customEmailsStr = await this.settingsService.getSetting('sod_email_recipients', '');
        if (customEmailsStr) {
          toEmails = customEmailsStr.split(',').map((e: string) => e.trim()).filter(Boolean);
        }

        this.logger.log(`Bắt đầu soạn và gửi email báo cáo SOD đến: ${toEmails.join(', ')}`);
        
        const statusText = hasDiscrepancy ? '🚨 PHÁT HIỆN LỆCH SỐ DƯ' : `✓ Khớp Hoàn Toàn (Sai số < $${differThreshold})`;
        const statusClass = hasDiscrepancy ? 'status-diff' : 'status-match';

        let discrepanciesRowsHtml = '';
      if (hasDiscrepancy) {
        significantDiscrepancies.forEach((d) => {
          discrepanciesRowsHtml += `
            <tr>
              <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${d.maTKGD}</td>
              <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">$${d.calculatedBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">$${d.cqgBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #b82c1c; font-family: monospace;">$${d.differ.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          `;
        });
      } else {
        discrepanciesRowsHtml = `
          <tr>
            <td colspan="4" style="padding: 20px; text-align: center; color: #1f7a28; background-color: #f0fdf4; font-weight: bold;">
              ✓ Không có chênh lệch nào được phát hiện giữa hai hệ thống.
            </td>
          </tr>
        `;
      }

      const emailHtmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Báo cáo đối chiếu số dư đầu ngày (SOD)</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333333; background-color: #f4f6f9; margin: 0; padding: 20px;">
          <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e1e4e8;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1f4068, #162447); color: #ffffff; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">BÁO CÁO ĐỐI CHIẾU SỐ DƯ ĐẦU NGÀY (SOD)</h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.85;">Hệ thống tự động thực hiện đối chiếu CQG CAST vs M-System</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 25px;">
              <!-- Status Badge -->
              <div style="margin-bottom: 25px;">
                <span class="${statusClass}">
                  ${statusText}
                </span>
              </div>
              
              <!-- Info Block Table (Outlook Compatible) -->
              <table style="width: 100%; background-color: #f8fafc; border-radius: 6px; padding: 15px; border: 1px solid #edf2f7; border-collapse: separate; margin-bottom: 25px;">
                <tr>
                  <td style="width: 50%; padding: 5px; border: none; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">File QLTKGD (M-System):</div>
                    <div style="font-size: 13px; font-family: monospace; font-weight: bold; color: #0f172a; margin-top: 2px;">${path.basename(qltkgdPath)}</div>
                  </td>
                  <td style="width: 50%; padding: 5px; border: none; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">File CQG CAST (Balance):</div>
                    <div style="font-size: 13px; font-family: monospace; font-weight: bold; color: #0f172a; margin-top: 2px;">${path.basename(accountsBalancesPath)}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 5px; border: none; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Tỷ giá USD áp dụng:</div>
                    <div style="font-size: 13px; font-family: monospace; font-weight: bold; color: #0f172a; margin-top: 2px;">${usdRate.toLocaleString('vi-VN')} VND</div>
                  </td>
                  <td style="padding: 5px; border: none; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Thời gian đối chiếu:</div>
                    <div style="font-size: 13px; font-family: monospace; font-weight: bold; color: #0f172a; margin-top: 2px;">${day}/${month}/${year} ${new Date().toLocaleTimeString('vi-VN')}</div>
                  </td>
                </tr>
              </table>
              
              <!-- Table Title -->
              <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #1e293b; border-left: 4px solid #1f4068; padding-left: 10px;">Chi tiết chênh lệch số dư</h3>
              
              <!-- Discrepancy Table -->
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 12px 10px; text-align: left; color: #475569; font-weight: 600;">Mã TKGD</th>
                    <th style="padding: 12px 10px; text-align: right; color: #475569; font-weight: 600;">Số dư M-System (USD)</th>
                    <th style="padding: 12px 10px; text-align: right; color: #475569; font-weight: 600;">Số dư CQG CAST (USD)</th>
                    <th style="padding: 12px 10px; text-align: right; color: #475569; font-weight: 600;">Chênh lệch (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  ${discrepanciesRowsHtml}
                </tbody>
              </table>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #edf2f7;">
              Hệ thống Đối Chiếu Tự Động MXV - Vui lòng không trả lời email này.<br>
              Hỗ trợ kỹ thuật: <a href="mailto:it.support@mxv.vn" style="color: #1f4068; text-decoration: none;">it.support@mxv.vn</a>
            </div>
          </div>
        </body>
        </html>
      `;

      // Apply CSS rules inline for email clients compatibility
      const formattedHtml = emailHtmlBody
        .replace(/class="status-match"/g, 'style="display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; background-color: #e3f9e5; color: #1f7a28; border: 1px solid #c2f0c5;"')
        .replace(/class="status-diff"/g, 'style="display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; background-color: #ffe8e6; color: #b82c1c; border: 1px solid #ffd0cc;"');

      const emailSubject = `[ĐỐI CHIẾU SOD] Kết quả đối chiếu số dư đầu ngày ${day}/${month}/${year}`;
      
      const emailResult = await this.marginCheckerService.sendEmailNotification(
        emailConfig,
        toEmails,
        emailSubject,
        formattedHtml
      );
      
      if (emailResult.success) {
        this.logger.log(`Đã gửi email báo cáo SOD thành công: ${emailResult.messageId}`);
      } else {
        this.logger.error(`Không thể gửi email báo cáo SOD: ${emailResult.error}`);
      }
      }
    } catch (emailErr: any) {
      this.logger.error(`Lỗi trong quá trình tạo/gửi email báo cáo SOD: ${emailErr.message}`);
    }

    return {
      success: !hasDiscrepancy,
      discrepancies: significantDiscrepancies,
      usdRate,
      qltkgdPath,
      accountsBalancesPath,
    };
  }

  private buildPreEodEmailHtml(
    passed: boolean,
    totals: any,
    mismatchedTrades: any[],
    mismatchedPositions: any[],
  ): string {
    const statusColor = passed ? '#2e7d32' : '#c62828';
    const statusText = passed ? 'KHỚP HOÀN TOÀN' : 'CÓ CHÊNH LỆCH';
    
    let tradesRows = '';
    if (mismatchedTrades.length > 0) {
      tradesRows = mismatchedTrades.map((t, idx) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${t.source}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${t.maLenh || '-'}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${t.maTKGD}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${t.maHD}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${t.giaKhop.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${t.klGiaoDich.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; color: #c62828;">${t.reason}</td>
        </tr>
      `).join('');
    } else {
      tradesRows = `<tr><td colspan="8" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2e7d32;">Không phát hiện chênh lệch khớp lệnh.</td></tr>`;
    }

    let positionsRows = '';
    if (mismatchedPositions.length > 0) {
      positionsRows = mismatchedPositions.map((p, idx) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${p.account}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${p.symbol}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${p.msPosition.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${p.cqgPosition.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: #c62828;">${p.differ.toLocaleString()}</td>
        </tr>
      `).join('');
    } else {
      positionsRows = `<tr><td colspan="6" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2e7d32;">Không phát hiện chênh lệch vị thế.</td></tr>`;
    }

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
          <div style="max-width: 800px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid ${statusColor};">
            <div style="padding: 20px;">
              <h2 style="color: ${statusColor}; margin-top: 0;">Báo Cáo Đối Chiếu Pre-EOD (Khớp Lệnh & Vị Thế)</h2>
              <p>Hệ thống vừa thực hiện kiểm tra đối chiếu cuối ngày (Pre-EOD) tự động.</p>
              
              <div style="background-color: ${passed ? '#e8f5e9' : '#ffebee'}; border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <span style="font-weight: bold; color: ${statusColor};">Kết quả: ${statusText}</span>
              </div>

              <h3>1. Tổng Hợp Khối Lượng Giao Dịch</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Hạng mục đối chiếu</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">M-System (Vô số)</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Đối tác (Straits/CQG)</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Khối lượng ACM (Straits)</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.totalACM_MS.toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.totalACM_Straits.toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: ${totals.differACM > 0 ? '#c62828' : '#2e7d32'};">${totals.differACM.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Khối lượng CQG (FR)</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.totalCQG_MS.toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.totalCQG_FR.toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: ${totals.differCQG > 0 ? '#c62828' : '#2e7d32'};">${totals.differCQG.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <h3>2. Chi Tiết Lệnh Lệch (Nếu Có)</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">STT</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Nguồn</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã Lệnh</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã TKGD</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã HĐ</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Giá</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">KL</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  ${tradesRows}
                </tbody>
              </table>

              <h3>3. Chi Tiết Lệch Vị Thế Net (Nếu Có)</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">STT</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã TKGD</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã HĐ</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Vị thế M-System</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Vị thế CQG</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  ${positionsRows}
                </tbody>
              </table>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd;">
              Đây là email tự động từ hệ thống MXV Shift Checklist.
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private buildEodEmailHtml(
    passed: boolean,
    mismatches: any[],
    usdRate: number,
  ): string {
    const statusColor = passed ? '#2e7d32' : '#c62828';
    const statusText = passed ? 'KHỚP HOÀN TOÀN' : 'CÓ CHÊNH LỆCH';
    
    let mismatchRows = '';
    if (mismatches.length > 0) {
      mismatchRows = mismatches.map((m, idx) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${m.maTKGD}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${m.calculatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${m.cqgBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: #c62828;">${m.differ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">
            ${!m.inMS ? '<span style="color: #c62828;">Chỉ có bên CQG</span>' : ''}
            ${!m.inCQG ? '<span style="color: #c62828;">Chỉ có bên M-System</span>' : ''}
            ${m.inMS && m.inCQG ? '<span style="color: #e65100;">Lệch số dư</span>' : ''}
          </td>
        </tr>
      `).join('');
    } else {
      mismatchRows = `<tr><td colspan="6" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2e7d32;">Không phát hiện chênh lệch số dư EOD giữa M-System và CQG.</td></tr>`;
    }

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
          <div style="max-width: 800px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid ${statusColor};">
            <div style="padding: 20px;">
              <h2 style="color: ${statusColor}; margin-top: 0;">Báo Cáo Đối Chiếu Số Dư EOD (M-System vs CQG)</h2>
              <p>Hệ thống vừa thực hiện kiểm tra đối chiếu số dư cuối ngày (EOD) tự động.</p>
              
              <div style="background-color: ${passed ? '#e8f5e9' : '#ffebee'}; border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <span style="font-weight: bold; color: ${statusColor};">Kết quả: ${statusText} (Tỷ giá USD sử dụng: ${usdRate.toLocaleString()} VND)</span>
              </div>

              <h3>Chi Tiết Tài Khoản Lệch Số Dư EOD (> $100)</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">STT</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã TKGD</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Số dư tính toán (USD)</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Số dư CQG (USD)</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Chênh lệch (USD)</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  ${mismatchRows}
                </tbody>
              </table>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd;">
              Đây là email tự động từ hệ thống MXV Shift Checklist.
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private buildNegativeMarginEmailHtml(
    negativeBalances: string[],
    negativeIMR: string[],
  ): string {
    const total = negativeBalances.length + negativeIMR.length;
    
    let balanceRows = '';
    if (negativeBalances.length > 0) {
      balanceRows = negativeBalances.map((acc, idx) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: #c62828;">${acc}</td>
          <td style="border: 1px solid #ddd; padding: 8px; color: #c62828;">Âm số dư tài khoản hiện tại</td>
        </tr>
      `).join('');
    } else {
      balanceRows = `<tr><td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2e7d32;">Không có tài khoản âm số dư hiện tại.</td></tr>`;
    }

    let imrRows = '';
    if (negativeIMR.length > 0) {
      imrRows = negativeIMR.map((acc, idx) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: #c62828;">${acc}</td>
          <td style="border: 1px solid #ddd; padding: 8px; color: #c62828;">Âm ký quỹ khả dụng đầu ngày (IMR < 0)</td>
        </tr>
      `).join('');
    } else {
      imrRows = `<tr><td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2e7d32;">Không có tài khoản âm ký quỹ khả dụng (IMR).</td></tr>`;
    }

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
          <div style="max-width: 800px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid #c62828;">
            <div style="padding: 20px;">
              <h2 style="color: #c62828; margin-top: 0;">🚨 Cảnh Báo Tài Khoản Âm Ký Quỹ Đầu Ngày (Post-EOD)</h2>
              <p>Phát hiện tổng cộng <b>${total} tài khoản bị âm ký quỹ hoặc âm số dư</b> đầu ngày sau phiên EOD.</p>
              
              <div style="background-color: #ffebee; border-left: 4px solid #c62828; padding: 15px; margin-bottom: 20px; border-radius: 4px; color: #c62828; font-weight: bold;">
                Chú ý: Vui lòng xem danh sách tài khoản chi tiết trong file Excel đính kèm (NegativeAccounts.xlsx).
              </div>

              <h3>1. Tài Khoản Âm Số Dư TKKQ Hiện Tại (${negativeBalances.length})</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 60px;">STT</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã TKGD</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mô tả lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  ${balanceRows}
                </tbody>
              </table>

              <h3>2. Tài Khoản Âm Ký Quy Khả Dụng CQG (${negativeIMR.length})</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 60px;">STT</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã TKGD</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mô tả lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  ${imrRows}
                </tbody>
              </table>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd;">
              Đây là email tự động từ hệ thống MXV Shift Checklist.
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async runAutoCheckPreEOD(tradingDate: Date): Promise<any> {
    const fs = require('fs');
    const path = require('path');

    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );
    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const dailyPath = path.join(msBackupBase, subFolder);

    const dsgdPath = path.join(dailyPath, 'DSGD.xlsx');
    const ttttPath = path.join(dailyPath, 'TTTT.xlsx');
    
    const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');
    
    const acmTradesPath = this.findLatestFile(dailyPath, /Straits/i) || this.findLatestFile(castDownloadsDir, /Straits/i);
    const cqgFrPath = this.findLatestFile(dailyPath, /FR/i) || this.findLatestFile(castDownloadsDir, /FR/i);
    const cqgPsPath = this.findLatestFile(dailyPath, /Positions/i) || this.findLatestFile(castDownloadsDir, /Positions/i);

    if (!fs.existsSync(dsgdPath)) throw new Error(`Thiếu file DSGD.xlsx tại ${dsgdPath}`);
    if (!fs.existsSync(ttttPath)) throw new Error(`Thiếu file TTTT.xlsx tại ${ttttPath}`);
    if (!acmTradesPath) throw new Error('Không tìm thấy file ACM Trades/Straits');
    if (!cqgFrPath) throw new Error('Không tìm thấy file CQG FR');
    if (!cqgPsPath) throw new Error('Không tìm thấy file CQG Positions');

    const sessionStartStr = await this.settingsService.getSetting('session_start_time', '05:00');

    const result = await this.checkPreEOD({
      dsgd: fs.readFileSync(dsgdPath),
      acmTrades: fs.readFileSync(acmTradesPath),
      cqgFr: fs.readFileSync(cqgFrPath),
      tttt: fs.readFileSync(ttttPath),
      cqgPs: fs.readFileSync(cqgPsPath),
    }, path.basename(acmTradesPath), tradingDate, [], sessionStartStr);

    // Gửi Telegram alert
    let telegramMsg = `🔔 <b>[ĐỐI CHIẾU PRE-EOD TỰ ĐỘNG - ${day}/${month}/${year}]</b>\n`;
    telegramMsg += `• Trạng thái: ${result.passed ? '✓ Khớp hoàn toàn' : '🚨 <b>PHÁT HIỆN LỆCH KHỚP LỆNH/VỊ THẾ</b>'}\n`;
    telegramMsg += `• ACM (M-System vs Straits): MS <code>${result.totals.totalACM_MS}</code> vs Partner <code>${result.totals.totalACM_Straits}</code> (Lệch: <b>${result.totals.differACM}</b>)\n`;
    telegramMsg += `• CQG (M-System vs CQG): MS <code>${result.totals.totalCQG_MS}</code> vs Partner <code>${result.totals.totalCQG_FR}</code> (Lệch: <b>${result.totals.differCQG}</b>)\n`;
    telegramMsg += `• Số lượng lệnh lệch: <b>${result.mismatchedTrades.length}</b>\n`;
    telegramMsg += `• Số vị thế net lệch: <b>${result.mismatchedPositions.length}</b>\n`;

    await this.telegramService.sendMessage(telegramMsg);

    return result;
  }

  async runAutoCheckEodMm(tradingDate: Date): Promise<any> {
    const fs = require('fs');
    const path = require('path');

    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );
    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const dailyPath = path.join(msBackupBase, subFolder);

    const qltkgdPath = path.join(dailyPath, 'QLTKGD.xlsx');
    
    const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');
    const eodPath = this.findLatestFile(dailyPath, /eod/i) || this.findLatestFile(castDownloadsDir, /eod/i);
    const accountsBalancesPath = this.findLatestFile(castDownloadsDir, /^Accounts_Balances_.*\.xlsx$/i) || this.findLatestFile(dailyPath, /Accounts_Balances/i);

    if (!fs.existsSync(qltkgdPath)) throw new Error(`Thiếu file QLTKGD.xlsx tại ${qltkgdPath}`);
    if (!eodPath) throw new Error('Không tìm thấy file eod.csv / eod.xlsx');
    if (!accountsBalancesPath) throw new Error('Không tìm thấy file Accounts_Balances.xlsx');

    let usdRate = 25220;
    try {
      this.logger.log('Đang tự động đồng bộ tỷ giá USD từ M-System...');
      usdRate = await this.syncUsdRateFromMSystem();
    } catch (err) {
      this.logger.warn(`Không thể đồng bộ tỷ giá USD tự động (sẽ sử dụng tỷ giá cũ): ${err.message}`);
      const usdRateStr = await this.settingsService.getSetting('usd_exchange_rate', '25220');
      usdRate = parseFloat(usdRateStr) || 25220;
    }

    // Chạy check EOD (Negative Margin)
    const eodResult = await this.checkEOD({
      qltkgd: fs.readFileSync(qltkgdPath),
      eod: fs.readFileSync(eodPath),
    });

    // Chạy check EOD CQG (Balance Reconciliation)
    const cqgResult = await this.checkEODCQG({
      qltkgd: fs.readFileSync(qltkgdPath),
      accountsBalances: fs.readFileSync(accountsBalancesPath),
    }, usdRate);

    // Gửi Telegram alert
    const negativeBalanceAccs = eodResult?.negativeBalanceAccs || [];
    const negativeIMRAcc = eodResult?.negativeIMRAcc || [];
    const totalNegative = negativeBalanceAccs.length + negativeIMRAcc.length;
    const totalMismatched = cqgResult ? cqgResult.length : 0;
    let telegramMsg = `🔔 <b>[ĐỐI CHIẾU EOD TỰ ĐỘNG - ${day}/${month}/${year}]</b>\n`;
    telegramMsg += `• Trạng thái: ${(totalNegative === 0 && totalMismatched === 0) ? '✓ Khớp hoàn toàn & Không có tài khoản âm' : '🚨 <b>PHÁT HIỆN BẤT THƯỜNG</b>'}\n`;
    telegramMsg += `• Tài khoản âm số dư hiện tại: <b>${negativeBalanceAccs.length}</b>\n`;
    telegramMsg += `• Tài khoản âm ký quỹ khả dụng (IMR): <b>${negativeIMRAcc.length}</b>\n`;
    telegramMsg += `• Số tài khoản lệch số dư EOD: <b>${totalMismatched}</b>\n`;

    await this.telegramService.sendMessage(telegramMsg);

    return { eodResult, cqgResult };
  }

  /**
   * Helper to retrieve Chrome executable path.
   */
  private getChromeExecutablePath(): string | null {
    const bundledPath = path.join(
      process.cwd(),
      '..',
      'it-tool-src',
      'operate-transaction-app',
      'Chrome',
      'chrome-win',
      'chrome.exe'
    );

    if (fs.existsSync(bundledPath)) {
      this.logger.log(`Using bundled Chrome binary at: ${bundledPath}`);
      return bundledPath;
    }

    this.logger.warn(`Bundled Chrome binary not found at ${bundledPath}. Falling back to default playwright launch.`);
    return null;
  }

  /**
   * Tự động đăng nhập M-System và đồng bộ tỷ giá USD/VND hiện tại
   */
  async syncUsdRateFromMSystem(): Promise<number> {
    this.logger.log('Khởi động bot đồng bộ tỷ giá USD từ M-System...');

    let msUrl = 'https://msadmin.mxv.com.vn/';
    let msUser = process.env.MS_USER || '';
    let msPass = process.env.MS_PASSWORD || '';
    let msPin = process.env.MS_PIN || '';

    const credentialsRaw = await this.settingsService.getSetting('bot_credentials_msystem', '');
    if (credentialsRaw) {
      try {
        const credentials = JSON.parse(decrypt(credentialsRaw));
        if (credentials.url) msUrl = credentials.url;
        if (credentials.username) msUser = credentials.username;
        if (credentials.password) msPass = credentials.password;
        if (credentials.pin) msPin = credentials.pin;
      } catch (err) {
        this.logger.warn('Không thể giải mã cấu hình M-System từ DB, dùng biến môi trường.');
      }
    }

    if (!msUser || !msPass || !msPin) {
      throw new Error('Cấu hình tài khoản M-System không đầy đủ (username, password, pin). Vui lòng cấu hình qua Admin UI hoặc file .env');
    }

    const chromePath = this.getChromeExecutablePath();
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    if (chromePath) {
      launchOptions.executablePath = chromePath;
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    try {
      this.logger.log(`Đi tới trang M-System: ${msUrl}...`);
      await page.goto(msUrl);
      await page.waitForTimeout(2000);

      this.logger.log('Nhập tài khoản và mật khẩu...');
      await page.waitForSelector('input[name="username"]', { state: 'visible' });
      await page.fill('input[name="username"]', msUser);
      await page.fill('input[name="password"]', msPass);
      await page.waitForTimeout(500);

      this.logger.log('Nhấn nút Đăng nhập...');
      await page.click('button.btn-primary');
      await page.waitForTimeout(2000);

      this.logger.log('Đang đợi bảng nhập mã PIN ảo hiển thị...');
      let pinSelectorVisible = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        pinSelectorVisible = await page.locator('div.pincode').isVisible({ timeout: 5000 }).catch(() => false);
        if (pinSelectorVisible) break;
        this.logger.warn(`Chưa hiển thị bảng PIN (lần thử ${attempt}), thử click lại nút Đăng nhập...`);
        await page.click('button.btn-primary').catch(() => { });
        await page.waitForTimeout(2000);
      }

      await page.waitForSelector('div.pincode', { state: 'visible', timeout: 10000 });
      this.logger.log('Đang tự động click mã PIN ảo...');
      const pinDigits = msPin.split('');
      for (const digit of pinDigits) {
        const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
        await page.waitForSelector(digitSelector, { state: 'visible' });
        await page.click(digitSelector);
        await page.waitForTimeout(500);
      }

      this.logger.log('Xác thực đăng nhập...');
      await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => { });
      await page.waitForTimeout(3000);
      this.logger.log('🎉 Đăng nhập M-System thành công! Đang chuyển hướng tới trang tỷ giá...');

      const exchangeRateUrl = `${msUrl.split('#')[0]}#/currencyManagement/exchangeRate`;
      await page.goto(exchangeRateUrl);
      await page.waitForTimeout(5000); // Đợi bảng tải dữ liệu

      // Trích xuất tỷ giá USD/VND
      const rateText = await page.evaluate(() => {
        // 1. Thử tìm theo cấu trúc ag-Grid (M-System mới dùng ag-Grid)
        const agRows = Array.from(document.querySelectorAll('[role="row"]'));
        for (const row of agRows) {
          const baseCell = row.querySelector('[col-id="monetaryBase"]');
          const counterCell = row.querySelector('[col-id="counterCurrency"]');
          const rateCell = row.querySelector('[col-id="exchangeRate"]');
          
          if (baseCell && counterCell && rateCell) {
            const baseVal = (baseCell.textContent || '').trim();
            const counterVal = (counterCell.textContent || '').trim();
            if (baseVal === 'USD' && counterVal === 'VND') {
              return (rateCell.textContent || '').trim();
            }
          }
        }

        // 2. Fallback sang cấu trúc table HTML thông thường
        const rows = Array.from(document.querySelectorAll('tr'));
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 4) {
            const baseCurrency = (cells[1].innerText || cells[1].textContent || '').trim();
            const quoteCurrency = (cells[2].innerText || cells[2].textContent || '').trim();
            if (baseCurrency === 'USD' && quoteCurrency === 'VND') {
              return (cells[3].innerText || cells[3].textContent || '').trim();
            }
          }
        }
        return null;
      });

      if (!rateText) {
        throw new Error('Không tìm thấy dòng tỷ giá USD/VND trong bảng quản lý tỷ giá.');
      }

      const rate = parseFloat(rateText.replace(/,/g, ''));
      if (isNaN(rate) || rate <= 0) {
        throw new Error(`Giá trị tỷ giá tìm thấy không hợp lệ: ${rateText}`);
      }

      this.logger.log(`Tìm thấy tỷ giá USD/VND trên M-System: ${rate} VND. Đang cập nhật vào hệ thống...`);
      await this.settingsService.setSetting('usd_exchange_rate', rate.toString());
      return rate;
    } finally {
      await browser.close();
    }
  }

  async getCurrentUsdRate(): Promise<number> {
    const usdRateStr = await this.settingsService.getSetting('usd_exchange_rate', '25220');
    return parseFloat(usdRateStr) || 25220;
  }

  async saveUsdRate(rate: number): Promise<void> {
    const current = await this.getCurrentUsdRate();
    if (current !== rate) {
      this.logger.log(`Tỷ giá mới (${rate}) khác tỷ giá hiện tại (${current}). Đang cập nhật vào cấu hình...`);
      await this.settingsService.setSetting('usd_exchange_rate', rate.toString());
    }
  }
}




