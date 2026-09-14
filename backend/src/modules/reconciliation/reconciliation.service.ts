// @ts-nocheck
import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
import { BotJob } from '../../schemas/bot-job.schema';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { BotJobQueueService } from '../bot-engine/bot-job-queue.service';
import { ShiftsService } from '../shifts/shifts.service';
import { BOT_TASK_REGISTRY, findBotTasksInShift } from '../bot-engine/constants/bot-task-registry';
import { resolveStoragePathCrossPlatform } from '../bot-engine/helpers/bot-path.helper';
import { CcpExcelParser } from './parsers';
import { CcpCeDownloaderService } from '../bot-engine/ccp-ce-downloader.service';

export interface EODMismatchedItem {
  system?: 'MS' | 'CCP';
  maTKGD: string;
  calculatedBalance: number;
  eodBalance: number;
  differ: number;
}

export interface CheckKLGDResult {
  totals: {
    totalDSGD: number;
    totalFR: number;
    totalACM: number;
    totalNano: number;
    differ: number;
    differACM: number;
    totalTTM?: number;
    totalTTM_MS?: number;
    totalOP?: number;
    totalTTM_CQG?: number;
    differTTM?: number;
    totalTTTT?: number;
    totalTTTT_MS?: number;
    totalPS?: number;
    totalPS_CQG?: number;
    differTTTT?: number;
    // CoreCCP fields
    totalCCP_DSGD?: number;
    totalCCP_TTM?: number;
    totalCCP_TTTT?: number;
    differCCP_KLGD?: number;
    differCCP_TTM?: number;
    differCCP_TTTT?: number;
    ccpStatus?: 'IDLE' | 'LOADING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    ccpErrorMessage?: string;
  };
  mismatchedTrades: Array<{
    source: 'MSystem' | 'CQG' | 'ACM' | 'Nano' | 'CoreCCP';
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
  sessionStart?: Date;
  checkTime?: Date;
  passed?: boolean;
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
    @Optional() @InjectModel(BotJob.name)
    private readonly botJobModel?: Model<BotJob>,
    @Optional() @InjectModel(ShiftLog.name)
    private readonly shiftLogModel?: Model<ShiftLog>,
    @Optional() @Inject(forwardRef(() => BotJobQueueService))
    private readonly botJobQueueService?: BotJobQueueService,
    @Optional() @Inject(forwardRef(() => ShiftsService))
    private readonly shiftsService?: ShiftsService,
    @Optional() @Inject(forwardRef(() => CcpCeDownloaderService))
    private readonly ccpCeDownloaderService?: CcpCeDownloaderService,
  ) { }

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

        if (
          bit1 === targetMonth ||
          bit1 === targetMonth - 1 ||
          (targetMonth === 1 && bit1 === 12)
        ) {
          // Assume bit1 is Month and bit0 is Day (DD/MM/YY)
          day = bit0;
          month = bit1;
        } else if (
          bit0 === targetMonth ||
          bit0 === targetMonth - 1 ||
          (targetMonth === 1 && bit0 === 12)
        ) {
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
  private findHeaderIndex(
    headers: string[],
    target: string,
    aliases: string[] = [],
  ): number {
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
    const normAliases = aliases.map((a) => normalize(a));

    return headers.findIndex((h) => {
      const normH = normalize(h);
      return normH === normTarget || normAliases.includes(normH);
    });
  }

  isIgnoredCommodity(symbol: string): boolean {
    if (!symbol) return false;
    const upper = symbol.toUpperCase();
    return ['TRU', 'ZFT', 'FEF', 'MPO'].some((ignored) =>
      upper.startsWith(ignored),
    );
  }

  /**
   * Helper to convert LME symbols based on trading date.
   */
  convertLMESymbol(
    symbol: string,
    date: Date,
    holidays: string[] = [],
  ): string {
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
    holidays.forEach((h) => {
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

  getNormalizedAccount(account: string): string {
    if (!account) return '';
    let acc = account.trim();
    acc = acc.replace(/F$/i, '');
    acc = acc.replace(/L$/i, '-L');
    acc = acc.replace(/S$/i, '-S');
    acc = acc.replace(/--/g, '-');
    return acc.toUpperCase();
  }

  /**
   * Parse M-System DSGD.xlsx
   */
  parseDSGD(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet)
      throw new Error('Không tìm thấy sheet nào trong file DSGD.xlsx');

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    const header = rows[0].map((h) => String(h || '').trim());
    const maLenhIdx = header.indexOf('Mã lệnh');
    const maTKGDIdx = header.indexOf('Mã TKGD');
    const maHDIdx = header.indexOf('Mã HĐ');
    const klGiaoDichIdx = header.indexOf('KL giao dịch');
    const giaKhopIdx = header.indexOf('Giá khớp');
    const ngayGioIdx = header.indexOf('Ngày giờ thực hiện');
    const maGDIdx = header.indexOf('Mã giao dịch');

    if (
      maLenhIdx === -1 ||
      maTKGDIdx === -1 ||
      maHDIdx === -1 ||
      klGiaoDichIdx === -1 ||
      giaKhopIdx === -1
    ) {
      throw new Error(
        'Thiếu cột bắt buộc trong file DSGD.xlsx (Mã lệnh, Mã TKGD, Mã HĐ, KL giao dịch, Giá khớp)',
      );
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maLenh = String(row[maLenhIdx] || '').trim();
      const maTKGD = this.getNormalizedAccount(String(row[maTKGDIdx] || ''));
      const maHD = String(row[maHDIdx] || '').trim();
      const klGiaoDich = parseFloat(row[klGiaoDichIdx]) || 0;
      const giaKhop = parseFloat(row[giaKhopIdx]) || 0;
      const ngayGio =
        ngayGioIdx !== -1 ? String(row[ngayGioIdx] || '').trim() : '';
      const maGD = maGDIdx !== -1 ? String(row[maGDIdx] || '').trim() : '';

      if (!maLenh || !maTKGD || !maHD) continue;

      result.push({
        maLenh,
        maTKGD,
        maHD,
        klGiaoDich,
        giaKhop,
        ngayGio,
        maGD,
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

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
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
      const rowHeaders = rows[r].map((h) => String(h || '').trim());

      const tempOrdIdx = this.findHeaderIndex(rowHeaders, 'Ord #', [
        'ord',
        'ord #',
        'order',
        'order #',
        'order number',
      ]);
      const tempAccountIdx = this.findHeaderIndex(rowHeaders, 'Account', [
        'account',
        'tk',
        'tài khoản',
        'ma tkgd',
        'account number',
        'acc',
      ]);
      const tempSymbolIdx = this.findHeaderIndex(rowHeaders, 'Symbol', [
        'symbol',
        'ma hd',
        'mã hợp đồng',
        'ma hop dong',
        'contract',
      ]);
      const tempQtyIdx = this.findHeaderIndex(rowHeaders, 'Qty', [
        'qty',
        'quantity',
        'kl',
        'khối lượng',
        'volume',
        'qty.',
      ]);
      const tempFillPIdx = this.findHeaderIndex(rowHeaders, 'Fill P', [
        'fill p',
        'fill price',
        'gia khop',
        'giá khớp',
        'fill_p',
        'fillpx',
        'fill px',
      ]);
      const tempTimeIdx = this.findHeaderIndex(rowHeaders, 'Time', [
        'time',
        'thoi gian',
        'ngày giờ',
        'ngay gio',
      ]);

      if (
        tempOrdIdx !== -1 &&
        tempAccountIdx !== -1 &&
        tempSymbolIdx !== -1 &&
        tempQtyIdx !== -1 &&
        tempFillPIdx !== -1
      ) {
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
    if (
      ordIdx === -1 ||
      accountIdx === -1 ||
      symbolIdx === -1 ||
      qtyIdx === -1 ||
      fillPIdx === -1
    ) {
      const fallbackHeader = rows[1]
        ? rows[1].map((h) => String(h || '').trim())
        : [];
      ordIdx = this.findHeaderIndex(fallbackHeader, 'Ord #', [
        'ord',
        'ord #',
        'order',
        'order #',
        'order number',
      ]);
      accountIdx = this.findHeaderIndex(fallbackHeader, 'Account', [
        'account',
        'tk',
        'tài khoản',
        'ma tkgd',
        'account number',
        'acc',
      ]);
      symbolIdx = this.findHeaderIndex(fallbackHeader, 'Symbol', [
        'symbol',
        'ma hd',
        'mã hợp đồng',
        'ma hop dong',
        'contract',
      ]);
      qtyIdx = this.findHeaderIndex(fallbackHeader, 'Qty', [
        'qty',
        'quantity',
        'kl',
        'khối lượng',
        'volume',
        'qty.',
      ]);
      fillPIdx = this.findHeaderIndex(fallbackHeader, 'Fill P', [
        'fill p',
        'fill price',
        'gia khop',
        'giá khớp',
        'fill_p',
        'fillpx',
        'fill px',
      ]);
      timeIdx = this.findHeaderIndex(fallbackHeader, 'Time', [
        'time',
        'thoi gian',
        'ngày giờ',
        'ngay gio',
      ]);
    }

    if (
      ordIdx === -1 ||
      accountIdx === -1 ||
      symbolIdx === -1 ||
      qtyIdx === -1 ||
      fillPIdx === -1
    ) {
      throw new Error(
        'Thiếu cột bắt buộc trong file CQG FR (Ord #, Account, Symbol, Qty, Fill P)',
      );
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
      const accountRaw = this.getNormalizedAccount(account);

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
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/);
    if (lines.length > 0) {
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes('buy') && firstLine.includes('sell')) {
        // Parse Straits CSV
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const buyColIndex = headers.indexOf('buy');
        const sellColIndex = headers.indexOf('sell');
        const priceColIndex = headers.indexOf('price');
        const tradeDateColIndex = headers.indexOf('trade date');
        const executionTimeColIndex = headers.indexOf('execution date-time');
        const brokerTradeIdColIndex = headers.indexOf('broker trade id');
        const subAccColIndex = headers.indexOf('sub-a/c');
        const productCodeColIndex = headers.indexOf('product code');

        if (buyColIndex === -1 || sellColIndex === -1) {
          throw new Error(
            "Không tìm thấy cột 'Buy' hoặc 'Sell' trong file CSV Straits",
          );
        }

        const result = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',');

          const buyVal =
            buyColIndex !== -1 && buyColIndex < values.length
              ? parseFloat(values[buyColIndex].replace(/"/g, '').trim()) || 0
              : 0;
          const sellVal =
            sellColIndex !== -1 && sellColIndex < values.length
              ? parseFloat(values[sellColIndex].replace(/"/g, '').trim()) || 0
              : 0;
          const volume = buyVal + sellVal;
          if (volume === 0) continue;

          const maLenh =
            brokerTradeIdColIndex !== -1 &&
              brokerTradeIdColIndex < values.length
              ? values[brokerTradeIdColIndex].replace(/"/g, '').trim()
              : 'STRAITS';
          const maTKGD =
            subAccColIndex !== -1 && subAccColIndex < values.length
              ? this.getNormalizedAccount(
                values[subAccColIndex].replace(/"/g, '').trim(),
              )
              : 'Straits';
          const maHD =
            productCodeColIndex !== -1 && productCodeColIndex < values.length
              ? values[productCodeColIndex].replace(/"/g, '').trim()
              : 'Straits';
          const giaKhop =
            priceColIndex !== -1 && priceColIndex < values.length
              ? parseFloat(values[priceColIndex].replace(/"/g, '').trim()) || 0
              : 0;
          const ngayGio =
            executionTimeColIndex !== -1 &&
              executionTimeColIndex < values.length
              ? values[executionTimeColIndex].replace(/"/g, '').trim()
              : '';
          const maGD = maLenh;

          result.push({
            maLenh,
            maTKGD,
            maHD,
            klGiaoDich: volume,
            giaKhop,
            ngayGio,
            maGD,
            combinedKey: `${maTKGD}${maGD}${volume}`,
          });
        }
        return result;
      }
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    // Header on row 0 (case-insensitive)
    const header = rows[0].map((h) =>
      String(h || '')
        .trim()
        .toLowerCase(),
    );
    const maLenhIdx = header.indexOf('order sysid');
    const maTKGDIdx = header.indexOf('trader id');
    const maHDIdx = header.indexOf('instrument id');
    const klGiaoDichIdx = header.indexOf('volume');
    const giaKhopIdx = header.indexOf('price');
    const ngayIdx = header.indexOf('trading day');
    const gioIdx = header.indexOf('trade time');
    const maGDIdx = header.indexOf('trade id');

    if (
      maLenhIdx === -1 ||
      maTKGDIdx === -1 ||
      maHDIdx === -1 ||
      klGiaoDichIdx === -1 ||
      giaKhopIdx === -1 ||
      maGDIdx === -1
    ) {
      throw new Error(
        'Thiếu cột bắt buộc trong file Nano (Order Sysid, Trader Id, Instrument Id, Volume, Price, Trade Id)',
      );
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maLenh = String(row[maLenhIdx] || '').trim();
      const maTKGD = this.getNormalizedAccount(String(row[maTKGDIdx] || ''));
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

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
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
      const rowHeaders = rows[r].map((h) => String(h || '').trim());

      const tempAccountIdx = this.findHeaderIndex(rowHeaders, 'Account', [
        'account',
        'tk',
        'tài khoản',
        'ma tkgd',
        'account number',
        'acc',
      ]);
      const tempSymbolIdx = this.findHeaderIndex(rowHeaders, 'Symbol', [
        'symbol',
        'ma hd',
        'mã hợp đồng',
        'ma hop dong',
        'contract',
      ]);

      const tempLIdx = rowHeaders.findIndex((h) => {
        const norm = h.toLowerCase().trim();
        return norm === 'l' || norm.startsWith('l (') || norm.startsWith('(');
      });
      const tempSIdx = rowHeaders.findIndex((h) => {
        const norm = h.toLowerCase().trim();
        return norm === 's' || norm.startsWith('s (') || norm.startsWith('s(');
      });

      if (
        tempAccountIdx !== -1 &&
        tempSymbolIdx !== -1 &&
        tempLIdx !== -1 &&
        tempSIdx !== -1
      ) {
        headerRowIdx = r;
        accountIdx = tempAccountIdx;
        symbolIdx = tempSymbolIdx;
        lIdx = tempLIdx;
        sIdx = tempSIdx;
        break;
      }
    }

    if (accountIdx === -1 || symbolIdx === -1 || lIdx === -1 || sIdx === -1) {
      const fallbackHeader = rows[1]
        ? rows[1].map((h) => String(h || '').trim())
        : [];
      accountIdx = this.findHeaderIndex(fallbackHeader, 'Account', [
        'account',
        'tk',
        'tài khoản',
        'ma tkgd',
        'account number',
        'acc',
      ]);
      symbolIdx = this.findHeaderIndex(fallbackHeader, 'Symbol', [
        'symbol',
        'ma hd',
        'mã hợp đồng',
        'ma hop dong',
        'contract',
      ]);
      lIdx = fallbackHeader.findIndex((h) => {
        const norm = h.toLowerCase().trim();
        return norm === 'l' || norm.startsWith('l (') || norm.startsWith('(');
      });
      sIdx = fallbackHeader.findIndex((h) => {
        const norm = h.toLowerCase().trim();
        return norm === 's' || norm.startsWith('s (') || norm.startsWith('s(');
      });
    }

    if (accountIdx === -1 || symbolIdx === -1 || lIdx === -1 || sIdx === -1) {
      throw new Error(
        'Thiếu cột bắt buộc trong file OP (Account, Symbol, L, S)',
      );
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

      const accountRaw = this.getNormalizedAccount(account);

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

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    const header = rows[0].map((h) => String(h || '').trim());

    // Support all variations of headers
    const maTKGDIdx = header.findIndex(
      (h) => h === 'Mã TKGD' || h === 'Mã tài khoản',
    );
    const maHDIdx = header.findIndex(
      (h) => h === 'Mã HĐ' || h === 'Mã hợp đồng',
    );

    const tongMuaIdx = header.findIndex((h) => h.toLowerCase() === 'kl mua');
    const tongBanIdx = header.findIndex((h) => h.toLowerCase() === 'kl bán');
    const giaKhopIdx = header.findIndex(
      (h) => h === 'Giá TB' || h === 'Giá khớp' || h === 'Giá trung bình',
    );

    if (
      maTKGDIdx === -1 ||
      maHDIdx === -1 ||
      tongMuaIdx === -1 ||
      tongBanIdx === -1
    ) {
      throw new Error(
        'Thiếu cột bắt buộc trong file TTM.xlsx (Mã TKGD, Mã HĐ, KL Mua/Tổng mua, KL Bán/Tổng bán)',
      );
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maTKGD = this.getNormalizedAccount(String(row[maTKGDIdx] || ''));
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

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    const header = rows[0].map((h) => String(h || '').trim());

    const maTKGDIdx = this.findHeaderIndex(header, 'Mã TKGD', [
      'Mã tài khoản',
      'Account',
      'Mã khách hàng',
      'Mã KH',
    ]);
    const maHDIdx = this.findHeaderIndex(header, 'Mã HĐ', [
      'Mã hợp đồng',
      'Symbol',
      'Mã HH',
      'Mã hàng hóa',
    ]);
    const tongMuaIdx = this.findHeaderIndex(header, 'KL Mua', ['KL mua']);
    const tongBanIdx = this.findHeaderIndex(header, 'KL Bán', ['KL bán']);

    // fallbacks
    const finalAccIdx = maTKGDIdx !== -1 ? maTKGDIdx : 7;
    const finalSymIdx = maHDIdx !== -1 ? maHDIdx : 9;
    const finalMuaIdx = tongMuaIdx !== -1 ? tongMuaIdx : 15;
    const finalBanIdx = tongBanIdx !== -1 ? tongBanIdx : 16;

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maTKGD = this.getNormalizedAccount(String(row[finalAccIdx] || ''));
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
      fr?: Buffer;
      fr1?: Buffer;
      fr2?: Buffer;
      nano?: Buffer;
      ttm?: Buffer;
      op?: Buffer;
      op1?: Buffer;
      op2?: Buffer;
      tttt?: Buffer;
      ps?: Buffer;
      ps1?: Buffer;
      ps2?: Buffer;
      dsgdCcp?: Buffer;
      ttmCcp?: Buffer;
      ttttCcp?: Buffer;
      ccpStatus?: 'IDLE' | 'LOADING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    },
    tradingDate: Date,
    holidays: string[] = [],
    sessionStartStr: string = '05:00',
    options?: {
      checkKlgd?: boolean;
      checkTtm?: boolean;
      checkTttt?: boolean;
    },
  ): Promise<CheckKLGDResult> {
    if (sessionStartStr) {
      await this.settingsService.setSetting(
        'session_start_time',
        sessionStartStr,
      );
    }
    const rawDsgdData = files.dsgd ? this.parseDSGD(files.dsgd) : [];
    const rawNanoData = files.nano ? this.parseNano(files.nano) : [];

    // Parse and merge FR files
    const rawFrData: any[] = [];
    if (files.fr)
      rawFrData.push(...this.parseFR(files.fr, tradingDate, holidays));
    if (files.fr1)
      rawFrData.push(...this.parseFR(files.fr1, tradingDate, holidays));
    if (files.fr2)
      rawFrData.push(...this.parseFR(files.fr2, tradingDate, holidays));

    // Calculate time bounds: sessionStart and checkTime
    const sessionStart = new Date(tradingDate);
    const [sHour, sMin] = sessionStartStr.split(':').map(Number);

    const isPastDateOrDateOnly =
      (tradingDate.getHours() === 0 &&
        tradingDate.getMinutes() === 0 &&
        tradingDate.getSeconds() === 0) ||
      (tradingDate.getUTCHours() === 0 &&
        tradingDate.getUTCMinutes() === 0 &&
        tradingDate.getUTCSeconds() === 0);

    let checkTime: Date;
    if (isPastDateOrDateOnly) {
      // Historical check or date-only upload:
      // tradingDate là ngày bắt đầu phiên (do FE truyền vào), checkTime = sessionStart + 1 ngày
      sessionStart.setHours(sHour, sMin, 0, 0);
      while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
        // 0: Sunday, 6: Saturday
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
      checkTime = new Date(sessionStart);
      checkTime.setDate(checkTime.getDate() + 1);
    } else {
      // Live check: mimic the C# tool logic
      checkTime = new Date(tradingDate);
      sessionStart.setHours(sHour, sMin, 0, 0);
      if (checkTime < sessionStart) {
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
      while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
        // 0: Sunday, 6: Saturday
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
    }

    // Filter DSGD data
    // DSGD is filtered from sessionStart to checkTime (session-based rolling window)
    // to align with CQG session bounds and support DSGD files containing next day trades.
    const dsgdUpperBound = checkTime;

    const dsgdData = rawDsgdData.filter((gd) => {
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
      return tradeTime >= sessionStart && tradeTime <= dsgdUpperBound;
    });

    // Filter Nano data - same logic as DSGD: always end-of-tradingDate
    const nanoUpperBound = dsgdUpperBound;
    const nanoData = rawNanoData.filter((gd) => {
      if (!gd.ngayGio) return true;
      const parts = gd.ngayGio.split(/\s+/);
      const dateStr = parts[0];
      let y = 0,
        m = 0,
        d = 0;
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
      return tradeTime >= sessionStart && tradeTime <= nanoUpperBound;
    });

    // Filter CQG data using parseCqgDateTime
    const frData = rawFrData.filter((fr) => {
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
    dsgdData.forEach((gd) => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) {
        totalACM += gd.klGiaoDich;
      } else {
        totalDSGD += gd.klGiaoDich;
      }
    });

    // CQG FR calculations
    frData.forEach((fr) => {
      if (fr.symbol !== 'ZWAZCE') {
        totalFR += fr.qty;
      }
    });

    // ACM Nano calculations
    nanoData.forEach((gd) => {
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
    frData.forEach((fr) => {
      if (fr.symbol === 'ZWAZCE') return;
      const existsInDSGD = dsgdData.some(
        (gd) => gd.combinedKey === fr.combinedKey,
      );
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
    dsgdData.forEach((gd) => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) return;
      const existsInFR = frData.some((fr) => fr.combinedKey === gd.combinedKey);
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
    nanoData.forEach((gd) => {
      const existsInDSGD = dsgdData.some(
        (row) =>
          row.maTKGD.toUpperCase().endsWith('A') &&
          row.maGD === gd.maGD &&
          row.klGiaoDich === gd.klGiaoDich,
      );
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
    dsgdData.forEach((gd) => {
      if (!gd.maTKGD.toUpperCase().endsWith('A')) return;
      const existsInNano = nanoData.some(
        (row) => row.maGD === gd.maGD && row.klGiaoDich === gd.klGiaoDich,
      );
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
    let totalTTM = 0;
    let totalACM_TTM = 0;
    let totalOP = 0;
    const ttmSummary: Record<string, number> = {};
    const opSummary: Record<string, number> = {};
    const mismatchedTTM: Array<{
      maTKGD: string;
      ttmValue: number;
      opValue: number;
      differ: number;
    }> = [];

    // 1. Độc lập parse TTM (M-System)
    if (files.ttm) {
      const ttmData = this.parseTTM(files.ttm);
      ttmData.forEach((t) => {
        const qty = t.tongMua + t.tongBan;
        const cleanAcc = String(t.maTKGD || '').trim().toUpperCase();
        if (cleanAcc.endsWith('A')) {
          totalACM_TTM += qty;
        } else {
          totalTTM += qty;
        }
        ttmSummary[cleanAcc] = (ttmSummary[cleanAcc] || 0) + qty;
      });
    }

    // 2. Độc lập parse OP (CQG)
    if (files.op || files.op1 || files.op2) {
      const opData: any[] = [];
      if (files.op) opData.push(...this.parseOP(files.op));
      if (files.op1) opData.push(...this.parseOP(files.op1));
      if (files.op2) opData.push(...this.parseOP(files.op2));

      opData.forEach((o) => {
        const cleanAcc = String(o.account || '').trim().toUpperCase();
        const qty = o.lValue + o.sValue;
        if (!cleanAcc.endsWith('A')) {
          totalOP += qty;
        }
        opSummary[cleanAcc] = (opSummary[cleanAcc] || 0) + qty;
      });
    }

    // 3. Đối chiếu chi tiết từng tài khoản khi có đủ cả 2 file
    if (files.ttm && (files.op || files.op1 || files.op2)) {
      const allAccounts = Array.from(
        new Set([...Object.keys(ttmSummary), ...Object.keys(opSummary)]),
      );
      allAccounts.forEach((acc) => {
        if (acc.endsWith('A')) return; // Bỏ qua tài khoản ACM

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
    let totalACM_TTTT = 0;
    let totalPS = 0;
    const ttttSummary: Record<string, number> = {};
    const psSummary: Record<string, number> = {};
    const mismatchedTTTT: Array<{
      maTKGD: string;
      ttttValue: number;
      psValue: number;
      differ: number;
    }> = [];

    // 1. Độc lập parse TTTT (M-System)
    if (files.tttt) {
      const ttttData = this.parseTTTTForVolume(files.tttt);
      ttttData.forEach((t) => {
        const cleanAcc = String(t.maTKGD || '').trim().toUpperCase();
        if (cleanAcc.endsWith('A')) {
          totalACM_TTTT += t.tongBan;
        } else {
          totalTTTT += t.tongBan;
        }
        ttttSummary[cleanAcc] = (ttttSummary[cleanAcc] || 0) + t.tongBan;
      });
    }

    // 2. Độc lập parse PS (CQG)
    if (files.ps || files.ps1 || files.ps2) {
      const psData: any[] = [];
      if (files.ps) psData.push(...this.parsePSForVolume(files.ps));
      if (files.ps1) psData.push(...this.parsePSForVolume(files.ps1));
      if (files.ps2) psData.push(...this.parsePSForVolume(files.ps2));

      psData.forEach((p) => {
        const cleanAcc = String(p.account || '').trim().toUpperCase();
        if (!cleanAcc.endsWith('A')) {
          totalPS += p.sValue;
        }
        psSummary[cleanAcc] = (psSummary[cleanAcc] || 0) + p.sValue;
      });
    }

    // 3. Đối chiếu chi tiết từng tài khoản khi có đủ cả 2 file
    if (files.tttt && (files.ps || files.ps1 || files.ps2)) {
      const allTtttAccounts = Array.from(
        new Set([...Object.keys(ttttSummary), ...Object.keys(psSummary)]),
      );
      allTtttAccounts.forEach((acc) => {
        if (acc.endsWith('A')) return; // Bỏ qua tài khoản ACM

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

    const checkKlgdFlag = options?.checkKlgd !== false;
    const checkTtmFlag = options?.checkTtm !== false;
    const checkTtttFlag = options?.checkTttt !== false;

    const finalMismatchedTrades = checkKlgdFlag ? mismatchedTrades : [];
    const finalDiffer = checkKlgdFlag ? differ : 0;
    const finalDifferACM = checkKlgdFlag ? differACM : 0;
    const finalMismatchedTTM = checkTtmFlag ? mismatchedTTM : [];
    const finalMismatchedTTTT = checkTtttFlag && files.tttt ? mismatchedTTTT : undefined;
    const finalDifferTTTT = checkTtttFlag && files.tttt && (files.ps || files.ps1 || files.ps2) ? Math.abs(totalTTTT - totalPS) : undefined;

    const hasDiscrepancy =
      (checkKlgdFlag && (finalDiffer > 0 || finalDifferACM > 0 || finalMismatchedTrades.length > 0)) ||
      (checkTtmFlag && finalMismatchedTTM.length > 0) ||
      (checkTtttFlag && files.tttt && (files.ps || files.ps1 || files.ps2) && ((finalDifferTTTT || 0) > 0 || (finalMismatchedTTTT || []).length > 0));

    // 4. Bóc tách báo cáo CoreCCP (nếu có)
    let totalCCP_DSGD: number | undefined;
    let totalCCP_TTM: number | undefined;
    let totalCCP_TTTT: number | undefined;
    let ccpStatus: 'IDLE' | 'LOADING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' = files.ccpStatus || 'IDLE';

    if (files.dsgdCcp) {
      try {
        const parsed = CcpExcelParser.parseDSGD(files.dsgdCcp);
        totalCCP_DSGD = parsed.totalKhop;
        ccpStatus = 'COMPLETED';
      } catch (err: any) {
        this.logger.warn(`[Recon] Lỗi parse DSGD CoreCCP: ${err.message}`);
      }
    }
    if (files.ttmCcp) {
      try {
        const parsed = CcpExcelParser.parseTTM(files.ttmCcp);
        totalCCP_TTM = parsed.totalTTM;
        ccpStatus = 'COMPLETED';
      } catch (err: any) {
        this.logger.warn(`[Recon] Lỗi parse TTM CoreCCP: ${err.message}`);
      }
    }
    if (files.ttttCcp) {
      try {
        const parsed = CcpExcelParser.parseTTTT(files.ttttCcp);
        totalCCP_TTTT = parsed.totalTTTT;
        ccpStatus = 'COMPLETED';
      } catch (err: any) {
        this.logger.warn(`[Recon] Lỗi parse TTTT CoreCCP: ${err.message}`);
      }
    }

    const differCCP_KLGD = totalCCP_DSGD !== undefined ? Math.abs(totalDSGD - totalCCP_DSGD) : undefined;
    const differCCP_TTM = totalCCP_TTM !== undefined && files.ttm ? Math.abs(totalTTM - totalCCP_TTM) : undefined;
    const differCCP_TTTT = totalCCP_TTTT !== undefined && files.tttt ? Math.abs(totalTTTT - totalCCP_TTTT) : undefined;

    return {
      totals: {
        totalDSGD,
        totalFR,
        totalACM,
        totalNano,
        differ: finalDiffer,
        differACM: finalDifferACM,
        totalTTM: files.ttm ? totalTTM : 0,
        totalTTM_MS: files.ttm ? totalTTM : 0,
        totalOP: files.op || files.op1 || files.op2 ? totalOP : 0,
        totalTTM_CQG: files.op || files.op1 || files.op2 ? totalOP : 0,
        totalACM_TTM: files.ttm ? totalACM_TTM : 0,
        totalTTM_ACM: files.ttm ? totalACM_TTM : 0,
        differTTM: files.ttm && (files.op || files.op1 || files.op2) ? Math.abs(totalTTM - totalOP) : 0,
        totalTTTT: files.tttt ? totalTTTT : 0,
        totalTTTT_MS: files.tttt ? totalTTTT : 0,
        totalPS: files.ps || files.ps1 || files.ps2 ? totalPS : 0,
        totalPS_CQG: files.ps || files.ps1 || files.ps2 ? totalPS : 0,
        totalACM_TTTT: files.tttt ? totalACM_TTTT : 0,
        totalTTTT_ACM: files.tttt ? totalACM_TTTT : 0,
        differTTTT: finalDifferTTTT,
        totalCCP_DSGD,
        totalCCP_TTM,
        totalCCP_TTTT,
        differCCP_KLGD,
        differCCP_TTM,
        differCCP_TTTT,
        ccpStatus: files.dsgdCcp || files.ttmCcp || files.ttttCcp ? 'COMPLETED' : ccpStatus,
      },
      totalTTM: files.ttm ? totalTTM : 0,
      totalOP: files.op || files.op1 || files.op2 ? totalOP : 0,
      totalTtmAcm: files.ttm ? totalACM_TTM : 0,
      totalDSGD,
      totalFR,
      totalACM,
      totalNano,
      differ: finalDiffer,
      differACM: finalDifferACM,
      totalTTTT: files.tttt ? totalTTTT : 0,
      totalPS: files.ps || files.ps1 || files.ps2 ? totalPS : 0,
      totalTtttAcm: files.tttt ? totalACM_TTTT : 0,
      differTTTT: finalDifferTTTT,
      mismatchedTrades: finalMismatchedTrades,
      mismatchedTTM: finalMismatchedTTM,
      mismatchedTTTT: finalMismatchedTTTT,
      sessionStart,
      checkTime,
      passed: !hasDiscrepancy,
    };
  }

  /**
   * Helper to load statics.json
   */
  private loadStatics(): any {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(
        process.cwd(),
        '../it-tool-src/operate-transaction-app/Configuration/statics.json',
      );
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
   * EOD Calculation and Balance Reconciliation (CheckEOD - Hỗ trợ song song MS & CCP)
   */
  async checkEOD(
    files: {
      qltkgd?: Buffer;
      eod?: Buffer;
      tttt?: Buffer;
      qltkgdName?: string;
      eodName?: string;
      ttttName?: string;
      qltkgdCcp?: Buffer;
      eodCcp?: Buffer;
      ttttCcp?: Buffer;
      qltkgdCcpName?: string;
      eodCcpName?: string;
      ttttCcpName?: string;
    },
    exchangeRates?: {
      usdLoss: number;
      usdGain: number;
      jpyLoss: number;
      jpyGain: number;
      myrLoss: number;
      myrGain: number;
    },
  ): Promise<{
    negativeIMRAcc: string[];
    negativeBalanceAccs?: string[];
    mismatchedEOD: EODMismatchedItem[];
    excelBase64?: string;
  }> {
    if (!files.qltkgd && !files.qltkgdCcp) {
      throw new Error('Cần cung cấp ít nhất một file QLTKGD (M-System hoặc CCP) để đối chiếu EOD.');
    }

    const negativeBalanceAccs: string[] = [];
    const negativeIMRAcc: string[] = [];
    const mismatchedEOD: EODMismatchedItem[] = [];
    let excelBuffer: Buffer = Buffer.from('');

    // ==========================================
    // 1. Phân hệ M-System (MS)
    // ==========================================
    if (files.qltkgd) {
      const qltkgdWorkbook = XLSX.read(files.qltkgd, { type: 'buffer' });
      const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
      if (!qltkgdSheet)
        throw new Error('Không tìm thấy sheet nào trong QLTKGD.xlsx');
      const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, {
        header: 1,
      }) as any[][];
      if (qltkgdRows.length < 2) throw new Error('File QLTKGD.xlsx rỗng');

      const qltkgdHeader = qltkgdRows[0].map((h) => String(h || '').trim());
      const maTKGDIdx = this.findHeaderIndex(qltkgdHeader, 'Mã TKGD', [
        'Mã tài khoản',
        'Mã TK',
        'Tai khoan',
        'TKGD',
        'Investor Code',
        'InvestorCode',
        'Account Number',
        'Account',
      ]);
      const soDuTKKQHienTaiIdx = this.findHeaderIndex(
        qltkgdHeader,
        'Số dư TKKQ hiện tại',
        [
          'Số dư TKKQ cuối ngày',
          'Số dư hiện tại',
          'Số dư cuối ngày',
          'Số dư TKKQ',
          'TKKQ hiện tại',
          'TKKQ cuối ngày',
        ],
      );

      const qltkgdName = files.qltkgdName || 'QLTKGD.xlsx';
      if (maTKGDIdx === -1 || soDuTKKQHienTaiIdx === -1) {
        const missing = [];
        if (maTKGDIdx === -1) missing.push('Mã TKGD');
        if (soDuTKKQHienTaiIdx === -1)
          missing.push('Số dư TKKQ hiện tại / cuối ngày');
        throw new Error(
          `${qltkgdName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có trong file: [${qltkgdHeader.slice(0, 15).join(', ')}...]`,
        );
      }

      const negativeRows: any[][] = [qltkgdRows[0]]; // Include header
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

      // Parse EOD CSV file (eod.csv) if provided
      if (files.eod) {
        const eodWorkbook = XLSX.read(files.eod, { type: 'buffer' });
        const eodSheet = eodWorkbook.Sheets[eodWorkbook.SheetNames[0]];
        if (eodSheet) {
          const eodRows = XLSX.utils.sheet_to_json(eodSheet, {
            header: 1,
          }) as any[][];
          if (eodRows.length >= 2) {
            const eodHeader = eodRows[0].map((h) => String(h || '').trim());
            const investorCodeIdx = this.findHeaderIndex(
              eodHeader,
              'InvestorCode',
              ['Investor Code', 'investor_code'],
            );
            const initialRequiredMarginIdx = this.findHeaderIndex(
              eodHeader,
              'InitialRequiredMargin',
              ['Initial Required Margin', 'initial_required_margin'],
            );
            const estimatedProfitVNDIdx = this.findHeaderIndex(
              eodHeader,
              'EstimatedProfitVND',
              ['Estimated Profit VND', 'estimated_profit_vnd'],
            );
            const optionsEstimatedProfitVNDIdx = this.findHeaderIndex(
              eodHeader,
              'OptionsEstimatedProfitVND',
              ['Options Estimated Profit VND', 'options_estimated_profit_vnd'],
            );
            const netMarginIdx = this.findHeaderIndex(eodHeader, 'NetMargin', [
              'Net Margin',
              'net_margin',
            ]);
            const availableMarginIdx = this.findHeaderIndex(
              eodHeader,
              'AvailableMargin',
              ['Available Margin', 'available_margin'],
            );
            const additionalMarginIdx = this.findHeaderIndex(
              eodHeader,
              'AdditionalMargin',
              ['Additional Margin', 'additional_margin'],
            );

            const eodName = files.eodName || 'eod.csv';
            if (investorCodeIdx === -1) {
              throw new Error(
                `${eodName} không hợp lệ vì thiếu cột: InvestorCode. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${eodHeader.slice(0, 15).join(', ')}...]`,
              );
            }

            const eodBalanceIdx = this.findHeaderIndex(eodHeader, 'eodBalance', [
              'EOD Balance',
              'EODBalance',
              'eod_balance',
            ]);

            const eodMap = new Map<string, number>();

            for (let i = 1; i < eodRows.length; i++) {
              const row = eodRows[i];
              if (!row || row.length === 0) continue;
              const investorCode = String(row[investorCodeIdx] || '').trim();
              if (!investorCode) continue;

              if (eodBalanceIdx !== -1) {
                const eodBal = parseFloat(row[eodBalanceIdx]);
                if (!isNaN(eodBal)) {
                  eodMap.set(investorCode, eodBal);
                }
              }

              const initialRequiredMargin =
                initialRequiredMarginIdx !== -1
                  ? parseFloat(row[initialRequiredMarginIdx]) || 0
                  : 0;
              const estimatedProfitVND =
                estimatedProfitVNDIdx !== -1
                  ? parseFloat(row[estimatedProfitVNDIdx]) || 0
                  : 0;
              const optionsEstimatedProfitVND =
                optionsEstimatedProfitVNDIdx !== -1
                  ? parseFloat(row[optionsEstimatedProfitVNDIdx]) || 0
                  : 0;
              const netMargin =
                netMarginIdx !== -1 ? parseFloat(row[netMarginIdx]) || 0 : 0;
              const availableMargin =
                availableMarginIdx !== -1
                  ? parseFloat(row[availableMarginIdx]) || 0
                  : 0;
              const additionalMargin =
                additionalMarginIdx !== -1
                  ? parseFloat(row[additionalMarginIdx]) || 0
                  : 0;

              if (
                initialRequiredMargin === 0 &&
                estimatedProfitVND === 0 &&
                optionsEstimatedProfitVND === 0 &&
                netMargin === availableMargin &&
                availableMargin < 0 &&
                additionalMargin > 0
              ) {
                negativeIMRAcc.push(investorCode);
              }
            }

            // C# IT Tool: Đối chiếu công thức QLTKGD vs EOD Balance MS (ngưỡng lệch >= 1000)
            if (eodMap.size > 0) {
              const dynamicRates = await this.getCurrentExchangeRates();
              const effectiveRates = {
                usdLoss: exchangeRates?.usdLoss || dynamicRates.usdLoss,
                usdGain: exchangeRates?.usdGain || dynamicRates.usdGain,
                jpyLoss: exchangeRates?.jpyLoss || dynamicRates.jpyLoss,
                jpyGain: exchangeRates?.jpyGain || dynamicRates.jpyGain,
                myrLoss: exchangeRates?.myrLoss || dynamicRates.myrLoss,
                myrGain: exchangeRates?.myrGain || dynamicRates.myrGain,
              };

              const soDuDauNgayIdx = this.findHeaderIndex(qltkgdHeader, 'Số dư TKKQ đầu ngày', ['Số dư đầu ngày', 'TKKQ đầu ngày']);
              const nopRutIdx = this.findHeaderIndex(qltkgdHeader, 'Nộp rút trong phiên', ['Nộp rút']);
              const phiGDIdx = this.findHeaderIndex(qltkgdHeader, 'Phí giao dịch', ['Phí GD']);
              const phiQCIdx = this.findHeaderIndex(qltkgdHeader, 'Phí quyền chọn', ['Phí QC']);
              const laiLoVNDIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (VND)', ['Lãi lỗ thực tế (VND)', 'Lãi lỗ Futures (VND)', 'Lãi lỗ VND']);
              const laiLoUSDIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (USD)', ['Lãi lỗ USD', 'Lãi/lỗ USD', 'Lãi lỗ thực tế (USD)', 'Lãi lỗ Futures (USD)']);
              const laiLoJPYIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ JPY', ['Lãi/lỗ JPY']);
              const laiLoMYRIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ MYR', ['Lãi/lỗ MYR']);
              const phiDVIdx = this.findHeaderIndex(qltkgdHeader, 'Phí dịch vụ thanh toán (VND)', ['Phí DV thanh toán', 'Phí thanh toán', 'Payment Fee']);

              // Parse TTTT MS file nếu có để trích xuất phí DV thanh toán theo từng tài khoản
              const ttttFeeMap = new Map<string, number>();
              if (files.tttt) {
                try {
                  const ttttWorkbook = XLSX.read(files.tttt, { type: 'buffer' });
                  const ttttSheet = ttttWorkbook.Sheets[ttttWorkbook.SheetNames[0]];
                  if (ttttSheet) {
                    const ttttRows = XLSX.utils.sheet_to_json(ttttSheet, { header: 1 }) as any[][];
                    if (ttttRows.length >= 2) {
                      const ttttHeader = ttttRows[0].map((h) => String(h || '').trim());
                      const ttttAccIdx = this.findHeaderIndex(ttttHeader, 'Mã TKGD', [
                        'Mã tài khoản',
                        'Mã tiểu khoản',
                        'Số tiểu khoản',
                        'Investor Code',
                        'InvestorCode',
                        'Account',
                      ]);
                      const ttttFeeIdx = this.findHeaderIndex(ttttHeader, 'Phí dịch vụ thanh toán (VND)', [
                        'Phí dịch vụ thanh toán',
                        'Phí DV thanh toán',
                        'Phí thanh toán',
                        'Payment Fee',
                      ]);
                      if (ttttAccIdx !== -1 && ttttFeeIdx !== -1) {
                        for (let i = 1; i < ttttRows.length; i++) {
                          const r = ttttRows[i];
                          if (!r || r.length === 0) continue;
                          const a = String(r[ttttAccIdx] || '').trim();
                          const f = parseFloat(r[ttttFeeIdx]) || 0;
                          if (a) ttttFeeMap.set(a, (ttttFeeMap.get(a) || 0) + f);
                        }
                      }
                    }
                  }
                } catch (e: any) {
                  this.logger.warn(`Không thể đọc phí dịch vụ từ file TTTT MS: ${e.message}`);
                }
              }

              if (soDuDauNgayIdx !== -1) {
                for (let i = 1; i < qltkgdRows.length; i++) {
                  const qRow = qltkgdRows[i];
                  if (!qRow || qRow.length === 0) continue;
                  const acc = String(qRow[maTKGDIdx] || '').trim();
                  if (!acc || !eodMap.has(acc)) continue;

                  const soDuDauNgay = parseFloat(qRow[soDuDauNgayIdx]) || 0;
                  const nopRut = nopRutIdx !== -1 ? parseFloat(qRow[nopRutIdx]) || 0 : 0;
                  const phiGD = phiGDIdx !== -1 ? parseFloat(qRow[phiGDIdx]) || 0 : 0;
                  const phiQC = phiQCIdx !== -1 ? parseFloat(qRow[phiQCIdx]) || 0 : 0;
                  const laiLoVND = laiLoVNDIdx !== -1 ? parseFloat(qRow[laiLoVNDIdx]) || 0 : 0;
                  const laiLoUSD = laiLoUSDIdx !== -1 ? parseFloat(qRow[laiLoUSDIdx]) || 0 : 0;
                  const laiLoJPY = laiLoJPYIdx !== -1 ? parseFloat(qRow[laiLoJPYIdx]) || 0 : 0;
                  const laiLoMYR = laiLoMYRIdx !== -1 ? parseFloat(qRow[laiLoMYRIdx]) || 0 : 0;
                  let phiDV = phiDVIdx !== -1 ? parseFloat(qRow[phiDVIdx]) || 0 : 0;
                  // Ưu tiên lấy phí dịch vụ thanh toán từ file TTTT nếu có
                  if (ttttFeeMap.has(acc)) {
                    phiDV = ttttFeeMap.get(acc) || 0;
                  }

                  const tyGiaUSD = (phiQC + laiLoUSD < 0) ? effectiveRates.usdLoss : effectiveRates.usdGain;
                  const tyGiaJPY = (laiLoJPY < 0) ? effectiveRates.jpyLoss : effectiveRates.jpyGain;
                  const tyGiaMYR = (laiLoMYR < 0) ? effectiveRates.myrLoss : effectiveRates.myrGain;

                  const totalTradeProfit = laiLoVND !== 0
                    ? (laiLoVND + phiQC * tyGiaUSD)
                    : ((phiQC + laiLoUSD) * tyGiaUSD + laiLoJPY * tyGiaJPY + laiLoMYR * tyGiaMYR);

                  const calculated = soDuDauNgay + nopRut - phiGD - phiDV + totalTradeProfit;
                  const eodVal = eodMap.get(acc)!;
                  const differ = Math.abs(eodVal - calculated);

                  if (differ >= 1000) {
                    mismatchedEOD.push({
                      system: 'MS',
                      maTKGD: acc,
                      calculatedBalance: Math.round(calculated),
                      eodBalance: Math.round(eodVal),
                      differ: Math.round(differ),
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Generate workbook containing negative current balance rows
      if (negativeRows.length > 1) {
        const newSheet = XLSX.utils.aoa_to_sheet(negativeRows);
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          newWorkbook,
          newSheet,
          'Negative Balance Accounts',
        );
        excelBuffer = XLSX.write(newWorkbook, {
          type: 'buffer',
          bookType: 'xlsx',
        });
      }

      // Gửi email báo cáo tài khoản âm ký quỹ
      try {
        const emailConfig = await this.marginCheckerService.loadConfig();
        const mailSettings = emailConfig.negativeMarginReport || {
          isSendWarning: true,
          email: ['it.support@mxv.vn'],
        };
        if (
          mailSettings.isSendWarning &&
          excelBuffer.length > 0 &&
          (negativeBalanceAccs.length > 0 || negativeIMRAcc.length > 0)
        ) {
          const subject = `[MXV MARGIN WARNING] Danh sách Tài khoản Âm ký quỹ đầu ngày`;
          const htmlBody = this.buildNegativeMarginEmailHtml(
            negativeBalanceAccs,
            negativeIMRAcc,
          );
          const attachments = [
            {
              filename: `NegativeAccounts_${new Date().toISOString().split('T')[0]}.xlsx`,
              content: Buffer.from(excelBuffer),
            },
          ];
          const emailResult =
            await this.marginCheckerService.sendEmailNotification(
              emailConfig,
              mailSettings.email,
              subject,
              htmlBody,
              attachments,
              'negativeMarginReport',
            );
          if (emailResult.success) {
            this.logger.log(
              `Đã gửi email báo cáo tài khoản âm ký quỹ thành công: ${emailResult.messageId}`,
            );
          } else {
            this.logger.error(
              `Không thể gửi email báo cáo tài khoản âm ký quỹ: ${emailResult.error}`,
            );
          }
        }
      } catch (err: any) {
        this.logger.error(
          `Lỗi gửi email báo cáo tài khoản âm ký quỹ: ${err.message}`,
        );
      }

      // Hook: check contract maturity notifications if tttt file is provided
      if (files.tttt) {
        try {
          const email = await this.emailWatcherService.getLatestEmail(
            'Thông báo tất toán hợp đồng',
            'daonguyen@mxv.vn',
          );
          if (email) {
            const expiringContracts =
              this.teamsNotifierService.parseMaturityEmail(email.body);
            if (expiringContracts.length > 0) {
              await this.teamsNotifierService.checkMaturityAndNotifyFromFiles(
                files.qltkgd,
                files.tttt,
                expiringContracts,
                'EOD Manual Upload Trigger',
              );
            }
          }
        } catch (err: any) {
          this.logger.error(
            `Lỗi khi chạy đối chiếu đáo hạn tự động trong EOD: ${err.message}`,
          );
        }
      }
    }

    // ==========================================
    // 2. Phân hệ CoreCCP (CCP)
    // ==========================================
    if (files.qltkgdCcp) {
      try {
        const ccpResult = await this.checkEODCCP(
          {
            qltkgdCcp: files.qltkgdCcp,
            eodCcp: files.eodCcp,
            ttttCcp: files.ttttCcp,
            qltkgdCcpName: files.qltkgdCcpName,
            eodCcpName: files.eodCcpName,
            ttttCcpName: files.ttttCcpName,
          },
          exchangeRates,
        );
        if (ccpResult.negativeBalanceAccs?.length > 0) {
          negativeBalanceAccs.push(...ccpResult.negativeBalanceAccs);
        }
        if (ccpResult.negativeIMRAcc?.length > 0) {
          negativeIMRAcc.push(...ccpResult.negativeIMRAcc);
        }
        if (ccpResult.mismatchedEOD?.length > 0) {
          mismatchedEOD.push(...ccpResult.mismatchedEOD);
        }
      } catch (err: any) {
        this.logger.error(`Lỗi khi đối chiếu EOD CoreCCP: ${err.message}`);
        throw err;
      }
    }

    return {
      negativeIMRAcc,
      negativeBalanceAccs,
      mismatchedEOD,
      excelBase64: excelBuffer.length > 0 ? excelBuffer.toString('base64') : undefined,
    };
  }

  /**
   * Core Reconciliation Engine for CoreCCP EOD Balance (CheckEOD CCP)
   * Công thức 4 thành phần:
   * Số dư EOD CCP = Số dư đầu ngày + Nộp rút - Phí GD - Phí DVTT + Lãi lỗ thực tế
   */
  async checkEODCCP(
    files: {
      qltkgdCcp: Buffer;
      eodCcp?: Buffer;
      ttttCcp?: Buffer;
      qltkgdCcpName?: string;
      eodCcpName?: string;
      ttttCcpName?: string;
    },
    exchangeRates?: {
      usdLoss: number;
      usdGain: number;
      jpyLoss: number;
      jpyGain: number;
      myrLoss: number;
      myrGain: number;
    },
  ): Promise<{
    negativeIMRAcc: string[];
    negativeBalanceAccs: string[];
    mismatchedEOD: EODMismatchedItem[];
  }> {
    const qltkgdWorkbook = XLSX.read(files.qltkgdCcp, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet)
      throw new Error('Không tìm thấy sheet nào trong file QLTTTKGD CCP');
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 }) as any[][];
    if (qltkgdRows.length < 2) throw new Error('File QLTTTKGD CCP rỗng');

    const qltkgdHeader = qltkgdRows[0].map((h) => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(qltkgdHeader, 'Mã TKGD', [
      'Mã tài khoản',
      'Mã TK',
      'Mã tiểu khoản',
      'Số tiểu khoản',
      'Tai khoan',
      'TKGD',
      'Investor Code',
      'InvestorCode',
      'Account Number',
      'Account',
    ]);
    const soDuTKKQHienTaiIdx = this.findHeaderIndex(
      qltkgdHeader,
      'Số dư TKKQ hiện tại',
      [
        'Số dư TKKQ cuối ngày',
        'Số dư hiện tại',
        'Số dư cuối ngày',
        'Số dư TKKQ',
        'TKKQ hiện tại',
        'TKKQ cuối ngày',
        'End Balance',
        'Ending Balance',
      ],
    );

    const qltkgdCcpName = files.qltkgdCcpName || 'QLTTTKGD_CCP.xlsx';
    if (maTKGDIdx === -1) {
      throw new Error(
        `${qltkgdCcpName} không hợp lệ vì thiếu cột: Mã TKGD / Mã tiểu khoản. Các cột hiện có: [${qltkgdHeader.slice(0, 15).join(', ')}...]`,
      );
    }

    const negativeBalanceAccs: string[] = [];
    if (soDuTKKQHienTaiIdx !== -1) {
      for (let i = 1; i < qltkgdRows.length; i++) {
        const row = qltkgdRows[i];
        if (!row || row.length === 0) continue;
        const maTKGD = String(row[maTKGDIdx] || '').trim();
        const balanceVal = parseFloat(row[soDuTKKQHienTaiIdx]);
        if (!maTKGD) continue;
        if (!isNaN(balanceVal) && balanceVal < 0) {
          negativeBalanceAccs.push(maTKGD);
        }
      }
    }

    const negativeIMRAcc: string[] = [];
    const mismatchedEOD: EODMismatchedItem[] = [];

    // Parse TTTT CCP file nếu có để trích xuất phí DV thanh toán theo tài khoản
    const ttttFeeMap = new Map<string, number>();
    if (files.ttttCcp) {
      try {
        const ttttWorkbook = XLSX.read(files.ttttCcp, { type: 'buffer' });
        const ttttSheet = ttttWorkbook.Sheets[ttttWorkbook.SheetNames[0]];
        if (ttttSheet) {
          const ttttRows = XLSX.utils.sheet_to_json(ttttSheet, { header: 1 }) as any[][];
          if (ttttRows.length >= 2) {
            const ttttHeader = ttttRows[0].map((h) => String(h || '').trim());
            const ttttAccIdx = this.findHeaderIndex(ttttHeader, 'Mã TKGD', [
              'Mã tài khoản',
              'Mã tiểu khoản',
              'Số tiểu khoản',
              'Investor Code',
              'InvestorCode',
              'Account',
            ]);
            const ttttFeeIdx = this.findHeaderIndex(ttttHeader, 'Phí dịch vụ thanh toán', [
              'Phí dịch vụ thanh toán (VND)',
              'Phí DV thanh toán',
              'Phí thanh toán',
              'Payment Fee',
            ]);

            if (ttttAccIdx !== -1 && ttttFeeIdx !== -1) {
              for (let i = 1; i < ttttRows.length; i++) {
                const r = ttttRows[i];
                if (!r || r.length === 0) continue;
                const acc = String(r[ttttAccIdx] || '').trim();
                const fee = parseFloat(r[ttttFeeIdx]) || 0;
                if (acc) {
                  ttttFeeMap.set(acc, (ttttFeeMap.get(acc) || 0) + fee);
                }
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Không thể đọc file TTTT CCP: ${err.message}`);
      }
    }

    // Parse EOD CCP file nếu có
    if (files.eodCcp) {
      const eodWorkbook = XLSX.read(files.eodCcp, { type: 'buffer' });
      const eodSheet = eodWorkbook.Sheets[eodWorkbook.SheetNames[0]];
      if (eodSheet) {
        const eodRows = XLSX.utils.sheet_to_json(eodSheet, { header: 1 }) as any[][];
        if (eodRows.length >= 2) {
          const eodHeader = eodRows[0].map((h) => String(h || '').trim());
          const investorCodeIdx = this.findHeaderIndex(eodHeader, 'InvestorCode', [
            'Investor Code',
            'investor_code',
            'Mã TKGD',
            'Mã tài khoản',
            'Mã tiểu khoản',
            'Số tiểu khoản',
            'Account',
            'Account Number',
          ]);
          const eodBalanceIdx = this.findHeaderIndex(eodHeader, 'eodBalance', [
            'EOD Balance',
            'EODBalance',
            'eod_balance',
            'Số dư cuối ngày',
            'Số dư EOD',
            'End Balance',
            'Ending Balance',
            'Balance',
          ]);

          const initialRequiredMarginIdx = this.findHeaderIndex(eodHeader, 'InitialRequiredMargin', [
            'Initial Required Margin',
            'initial_required_margin',
            'Ký quỹ ban đầu',
            'KQ ban đầu yêu cầu',
            'Ký quỹ ban đầu yêu cầu',
          ]);
          const availableMarginIdx = this.findHeaderIndex(eodHeader, 'AvailableMargin', [
            'Available Margin',
            'available_margin',
            'Ký quỹ khả dụng',
          ]);
          const netMarginIdx = this.findHeaderIndex(eodHeader, 'NetMargin', [
            'Net Margin',
            'net_margin',
            'Ký quỹ ròng',
            'Giá trị ròng ký quỹ',
          ]);
          const additionalMarginIdx = this.findHeaderIndex(eodHeader, 'AdditionalMargin', [
            'Additional Margin',
            'additional_margin',
            'Ký quỹ bổ sung',
            'Mức bổ sung ký quỹ',
          ]);

          const eodMap = new Map<string, number>();
          for (let i = 1; i < eodRows.length; i++) {
            const row = eodRows[i];
            if (!row || row.length === 0) continue;
            const investorCode = String(row[investorCodeIdx] || '').trim();
            if (!investorCode) continue;

            if (eodBalanceIdx !== -1) {
              const eodBal = parseFloat(row[eodBalanceIdx]);
              if (!isNaN(eodBal)) {
                eodMap.set(investorCode, eodBal);
              }
            }

            // Kiểm tra âm ký quỹ IMR CCP nếu có các cột
            if (availableMarginIdx !== -1 && additionalMarginIdx !== -1) {
              const avMargin = parseFloat(row[availableMarginIdx]) || 0;
              const addMargin = parseFloat(row[additionalMarginIdx]) || 0;
              const initMargin = initialRequiredMarginIdx !== -1 ? parseFloat(row[initialRequiredMarginIdx]) || 0 : 0;
              const nMargin = netMarginIdx !== -1 ? parseFloat(row[netMarginIdx]) || 0 : 0;
              if (initMargin === 0 && nMargin === avMargin && avMargin < 0 && addMargin > 0) {
                negativeIMRAcc.push(investorCode);
              }
            }
          }

          if (eodMap.size > 0) {
            const dynamicRates = await this.getCurrentExchangeRates();
            const effectiveRates = {
              usdLoss: exchangeRates?.usdLoss || dynamicRates.usdLoss,
              usdGain: exchangeRates?.usdGain || dynamicRates.usdGain,
              jpyLoss: exchangeRates?.jpyLoss || dynamicRates.jpyLoss,
              jpyGain: exchangeRates?.jpyGain || dynamicRates.jpyGain,
              myrLoss: exchangeRates?.myrLoss || dynamicRates.myrLoss,
              myrGain: exchangeRates?.myrGain || dynamicRates.myrGain,
            };

            const soDuDauNgayIdx = this.findHeaderIndex(qltkgdHeader, 'Số dư TKKQ đầu ngày', [
              'Số dư đầu ngày',
              'TKKQ đầu ngày',
              'Beginning Balance',
              'Start Balance',
            ]);
            const nopRutIdx = this.findHeaderIndex(qltkgdHeader, 'Nộp rút trong phiên', [
              'Nộp rút',
              'Net Deposit',
            ]);
            const phiGDIdx = this.findHeaderIndex(qltkgdHeader, 'Phí giao dịch', [
              'Phí GD',
              'Trade Fee',
            ]);
            const phiQCIdx = this.findHeaderIndex(qltkgdHeader, 'Phí quyền chọn', [
              'Phí QC',
              'Option Fee',
            ]);
            const laiLoVNDIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (VND)', [
              'Lãi lỗ thực tế (VND)',
              'Lãi lỗ Futures (VND)',
              'Lãi lỗ VND',
              'Lãi lỗ thực tế',
              'Realized PnL',
            ]);
            const laiLoUSDIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (USD)', [
              'Lãi lỗ USD',
              'Lãi/lỗ USD',
              'Lãi lỗ thực tế (USD)',
              'Lãi lỗ Futures (USD)',
              'Realized PnL USD',
            ]);
            const laiLoJPYIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ JPY', ['Lãi/lỗ JPY']);
            const laiLoMYRIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ MYR', ['Lãi/lỗ MYR']);
            const phiDVIdx = this.findHeaderIndex(qltkgdHeader, 'Phí dịch vụ thanh toán (VND)', [
              'Phí DV thanh toán',
              'Phí thanh toán',
              'Payment Fee',
            ]);

            if (soDuDauNgayIdx !== -1) {
              for (let i = 1; i < qltkgdRows.length; i++) {
                const qRow = qltkgdRows[i];
                if (!qRow || qRow.length === 0) continue;
                const acc = String(qRow[maTKGDIdx] || '').trim();
                if (!acc || !eodMap.has(acc)) continue;

                const soDuDauNgay = parseFloat(qRow[soDuDauNgayIdx]) || 0;
                const nopRut = nopRutIdx !== -1 ? parseFloat(qRow[nopRutIdx]) || 0 : 0;
                const phiGD = phiGDIdx !== -1 ? parseFloat(qRow[phiGDIdx]) || 0 : 0;
                const phiQC = phiQCIdx !== -1 ? parseFloat(qRow[phiQCIdx]) || 0 : 0;
                const laiLoVND = laiLoVNDIdx !== -1 ? parseFloat(qRow[laiLoVNDIdx]) || 0 : 0;
                const laiLoUSD = laiLoUSDIdx !== -1 ? parseFloat(qRow[laiLoUSDIdx]) || 0 : 0;
                const laiLoJPY = laiLoJPYIdx !== -1 ? parseFloat(qRow[laiLoJPYIdx]) || 0 : 0;
                const laiLoMYR = laiLoMYRIdx !== -1 ? parseFloat(qRow[laiLoMYRIdx]) || 0 : 0;
                let phiDV = phiDVIdx !== -1 ? parseFloat(qRow[phiDVIdx]) || 0 : 0;
                if (phiDV === 0 && ttttFeeMap.has(acc)) {
                  phiDV = ttttFeeMap.get(acc) || 0;
                }

                const tyGiaUSD = (phiQC + laiLoUSD < 0) ? effectiveRates.usdLoss : effectiveRates.usdGain;
                const tyGiaJPY = (laiLoJPY < 0) ? effectiveRates.jpyLoss : effectiveRates.jpyGain;
                const tyGiaMYR = (laiLoMYR < 0) ? effectiveRates.myrLoss : effectiveRates.myrGain;

                const totalTradeProfit = laiLoVND !== 0
                  ? (laiLoVND + phiQC * tyGiaUSD)
                  : ((phiQC + laiLoUSD) * tyGiaUSD + laiLoJPY * tyGiaJPY + laiLoMYR * tyGiaMYR);

                const calculated = soDuDauNgay + nopRut - phiGD - phiDV + totalTradeProfit;
                const eodVal = eodMap.get(acc)!;
                const differ = Math.abs(eodVal - calculated);

                if (differ >= 1000) {
                  mismatchedEOD.push({
                    system: 'CCP',
                    maTKGD: acc,
                    calculatedBalance: Math.round(calculated),
                    eodBalance: Math.round(eodVal),
                    differ: Math.round(differ),
                  });
                }
              }
            }
          }
        }
      }
    }

    return {
      negativeIMRAcc,
      negativeBalanceAccs,
      mismatchedEOD,
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
    if (!effectiveRate || effectiveRate === 25220) {
      effectiveRate = await this.getCurrentUsdRate();
    }
    // 1. Parse QLTKGD.xlsx
    const qltkgdWorkbook = XLSX.read(files.qltkgd, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet)
      throw new Error('Không tìm thấy sheet nào trong QLTKGD.xlsx');
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, {
      header: 1,
    });
    if (qltkgdRows.length < 2) throw new Error('File QLTKGD.xlsx rỗng');

    const qltkgdHeader = qltkgdRows[0].map((h) => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(qltkgdHeader, 'Mã TKGD', [
      'Mã tài khoản',
      'Mã TK',
      'Tai khoan',
      'TKGD',
      'Investor Code',
      'InvestorCode',
      'Account Number',
      'Account',
    ]);
    const laiLoChoDaoHanIdx = this.findHeaderIndex(
      qltkgdHeader,
      'Lãi lỗ thực tế chờ đáo hạn',
      [
        'Chờ đáo hạn',
        'Cho dao han',
        'Lai lo cho dao han',
        'Lãi lỗ chờ đáo hạn',
      ],
    );
    const laiLoThucTeFuturesVNDIdx = this.findHeaderIndex(
      qltkgdHeader,
      'Lãi lỗ thực tế Futures (VND)',
      [
        'Lãi lỗ thực tế Futures',
        'Lãi lỗ Futures',
        'Lai lo thuc te Futures',
        'Lai lo Futures',
      ],
    );
    const soDuTKKQHienTaiIdx = this.findHeaderIndex(
      qltkgdHeader,
      'Số dư TKKQ hiện tại',
      [
        'Số dư TKKQ cuối ngày',
        'Số dư hiện tại',
        'Số dư cuối ngày',
        'Số dư TKKQ',
        'TKKQ hiện tại',
        'TKKQ cuối ngày',
      ],
    );

    const qltkgdName = files.qltkgdName || 'QLTKGD.xlsx';
    if (maTKGDIdx === -1 || soDuTKKQHienTaiIdx === -1) {
      const missing = [];
      if (maTKGDIdx === -1) missing.push('Mã TKGD');
      if (soDuTKKQHienTaiIdx === -1)
        missing.push('Số dư TKKQ hiện tại / cuối ngày');
      throw new Error(
        `${qltkgdName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${qltkgdHeader.slice(0, 15).join(', ')}...]`,
      );
    }

    const qltkgdDataMap = new Map<
      string,
      {
        choDaoHan: number;
        laiLoVND: number;
        soDuTKKQHienTai: number;
      }
    >();

    for (let i = 1; i < qltkgdRows.length; i++) {
      const row = qltkgdRows[i];
      if (!row || row.length === 0) continue;
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      if (!maTKGD) continue;

      qltkgdDataMap.set(maTKGD, {
        choDaoHan:
          laiLoChoDaoHanIdx !== -1
            ? parseFloat(row[laiLoChoDaoHanIdx]) || 0
            : 0,
        laiLoVND:
          laiLoThucTeFuturesVNDIdx !== -1
            ? parseFloat(row[laiLoThucTeFuturesVNDIdx]) || 0
            : 0,
        soDuTKKQHienTai:
          soDuTKKQHienTaiIdx !== -1
            ? parseFloat(row[soDuTKKQHienTaiIdx]) || 0
            : 0,
      });
    }

    // 2. Parse Accounts_Balances.xlsx (CQG balances)
    const asWorkbook = XLSX.read(files.accountsBalances, { type: 'buffer' });
    const asSheet = asWorkbook.Sheets[asWorkbook.SheetNames[0]];
    if (!asSheet)
      throw new Error('Không tìm thấy sheet nào trong Accounts_Balances.xlsx');
    const asRows = XLSX.utils.sheet_to_json(asSheet, { header: 1 });
    if (asRows.length < 2) throw new Error('File Accounts_Balances.xlsx rỗng');

    const asHeader = asRows[0].map((h) => String(h || '').trim());
    const accountNumberIdx = this.findHeaderIndex(asHeader, 'Account Number', [
      'Account',
      'Tài khoản',
      'Mã TKGD',
      'Tai khoan',
    ]);
    const endCashBalanceIdx = this.findHeaderIndex(
      asHeader,
      'End Cash Balance',
      ['Cash Balance', 'Balance', 'Số dư', 'Số dư cuối ngày', 'So du'],
    );
    const recordDescriptionIdx = this.findHeaderIndex(
      asHeader,
      'Record Description',
      ['Description', 'Mô tả', 'Mo ta'],
    );

    const asName = files.accountsBalancesName || 'Accounts_Balances.xlsx';
    if (accountNumberIdx === -1 || endCashBalanceIdx === -1) {
      const missing = [];
      if (accountNumberIdx === -1) missing.push('Account Number');
      if (endCashBalanceIdx === -1) missing.push('End Cash Balance');
      throw new Error(
        `${asName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${asHeader.slice(0, 15).join(', ')}...]`,
      );
    }

    const cqgBalanceMap = new Map<string, number>();

    for (let i = 1; i < asRows.length; i++) {
      const row = asRows[i];
      if (!row || row.length === 0) continue;

      const recordDescription =
        recordDescriptionIdx !== -1
          ? String(row[recordDescriptionIdx] || '').trim()
          : '';
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
      if (
        maTKGD.startsWith('999') ||
        maTKGD.startsWith('050') ||
        !/^\d/.test(maTKGD)
      ) {
        continue;
      }

      const qltkgdRow = qltkgdDataMap.get(maTKGD);
      const cqgBalance = cqgBalanceMap.get(maTKGD) ?? 0;

      if (qltkgdRow) {
        const calculated =
          (qltkgdRow.soDuTKKQHienTai +
            qltkgdRow.choDaoHan -
            qltkgdRow.laiLoVND) /
          effectiveRate;
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
      const mailSettings = emailConfig.eodCheck || {
        isSendWarning: true,
        email: ['it.support@mxv.vn'],
      };
      if (mailSettings.isSendWarning) {
        const passed = result.length === 0;
        const subject = `[MXV EOD CHECK] Báo cáo đối chiếu số dư cuối ngày CQG vs M-System - ${passed ? 'KHỚP' : 'LỆCH'}`;
        const htmlBody = this.buildEodEmailHtml(
          passed,
          result,
          usdExchangeRate,
        );
        const emailResult =
          await this.marginCheckerService.sendEmailNotification(
            emailConfig,
            mailSettings.email,
            subject,
            htmlBody,
            [],
            'eodCheck',
          );
        if (emailResult.success) {
          this.logger.log(
            `Đã gửi email báo cáo EOD thành công: ${emailResult.messageId}`,
          );
        } else {
          this.logger.error(
            `Không thể gửi email báo cáo EOD: ${emailResult.error}`,
          );
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
  async checkNegativeMargin(files: {
    qltkgd: Buffer;
    eod?: Buffer;
    qltkgdName?: string;
    eodName?: string;
  }): Promise<{
    negativeBalanceAccs: string[];
    negativeIMRAcc: string[];
    excelBase64: string;
  }> {
    // 1. Parse QLTKGD.xlsx
    const qltkgdWorkbook = XLSX.read(files.qltkgd, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet)
      throw new Error('Không tìm thấy sheet nào trong QLTKGD.xlsx');
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, {
      header: 1,
    });
    if (qltkgdRows.length < 2) throw new Error('File QLTKGD.xlsx rỗng');

    const qltkgdHeader = qltkgdRows[0].map((h) => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(qltkgdHeader, 'Mã TKGD', [
      'Mã tài khoản',
      'Mã TK',
      'Tai khoan',
      'TKGD',
      'Investor Code',
      'InvestorCode',
      'Account Number',
      'Account',
    ]);
    const soDuTKKQHienTaiIdx = this.findHeaderIndex(
      qltkgdHeader,
      'Số dư TKKQ hiện tại',
      [
        'Số dư TKKQ cuối ngày',
        'Số dư hiện tại',
        'Số dư cuối ngày',
        'Số dư TKKQ',
        'TKKQ hiện tại',
        'TKKQ cuối ngày',
      ],
    );

    const qltkgdName = files.qltkgdName || 'QLTKGD.xlsx';
    if (maTKGDIdx === -1 || soDuTKKQHienTaiIdx === -1) {
      const missing = [];
      if (maTKGDIdx === -1) missing.push('Mã TKGD');
      if (soDuTKKQHienTaiIdx === -1)
        missing.push('Số dư TKKQ hiện tại / cuối ngày');
      throw new Error(
        `${qltkgdName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${qltkgdHeader.slice(0, 15).join(', ')}...]`,
      );
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
        const eodRows = XLSX.utils.sheet_to_json(eodSheet, {
          header: 1,
        });
        if (eodRows.length >= 2) {
          const eodHeader = eodRows[0].map((h) => String(h || '').trim());
          const investorCodeIdx = this.findHeaderIndex(
            eodHeader,
            'InvestorCode',
            ['Investor Code', 'investor_code'],
          );
          const initialRequiredMarginIdx = this.findHeaderIndex(
            eodHeader,
            'InitialRequiredMargin',
            ['Initial Required Margin', 'initial_required_margin'],
          );
          const estimatedProfitVNDIdx = this.findHeaderIndex(
            eodHeader,
            'EstimatedProfitVND',
            ['Estimated Profit VND', 'estimated_profit_vnd'],
          );
          const optionsEstimatedProfitVNDIdx = this.findHeaderIndex(
            eodHeader,
            'OptionsEstimatedProfitVND',
            ['Options Estimated Profit VND', 'options_estimated_profit_vnd'],
          );
          const netMarginIdx = this.findHeaderIndex(eodHeader, 'NetMargin', [
            'Net Margin',
            'net_margin',
          ]);
          const availableMarginIdx = this.findHeaderIndex(
            eodHeader,
            'AvailableMargin',
            ['Available Margin', 'available_margin'],
          );
          const additionalMarginIdx = this.findHeaderIndex(
            eodHeader,
            'AdditionalMargin',
            ['Additional Margin', 'additional_margin'],
          );

          if (investorCodeIdx !== -1) {
            for (let i = 1; i < eodRows.length; i++) {
              const row = eodRows[i];
              if (!row || row.length === 0) continue;
              const investorCode = String(row[investorCodeIdx] || '').trim();
              if (!investorCode) continue;

              const initialRequiredMargin =
                initialRequiredMarginIdx !== -1
                  ? parseFloat(row[initialRequiredMarginIdx]) || 0
                  : 0;
              const estimatedProfitVND =
                estimatedProfitVNDIdx !== -1
                  ? parseFloat(row[estimatedProfitVNDIdx]) || 0
                  : 0;
              const optionsEstimatedProfitVND =
                optionsEstimatedProfitVNDIdx !== -1
                  ? parseFloat(row[optionsEstimatedProfitVNDIdx]) || 0
                  : 0;
              const netMargin =
                netMarginIdx !== -1 ? parseFloat(row[netMarginIdx]) || 0 : 0;
              const availableMargin =
                availableMarginIdx !== -1
                  ? parseFloat(row[availableMarginIdx]) || 0
                  : 0;
              const additionalMargin =
                additionalMarginIdx !== -1
                  ? parseFloat(row[additionalMarginIdx]) || 0
                  : 0;

              if (
                initialRequiredMargin === 0 &&
                estimatedProfitVND === 0 &&
                optionsEstimatedProfitVND === 0 &&
                netMargin === availableMargin &&
                availableMargin < 0 &&
                additionalMargin > 0
              ) {
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
    XLSX.utils.book_append_sheet(
      newWorkbook,
      newSheet,
      'Negative Balance Accounts',
    );
    const excelBuffer = XLSX.write(newWorkbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    // Gửi email báo cáo tài khoản âm ký quỹ
    try {
      const emailConfig = await this.marginCheckerService.loadConfig();
      const mailSettings = emailConfig.negativeMarginReport || {
        isSendWarning: true,
        email: ['it.support@mxv.vn'],
      };
      if (
        mailSettings.isSendWarning &&
        (negativeBalanceAccs.length > 0 || negativeIMRAcc.length > 0)
      ) {
        const subject = `[MXV MARGIN WARNING] Danh sách Tài khoản Âm ký quỹ đầu ngày`;
        const htmlBody = this.buildNegativeMarginEmailHtml(
          negativeBalanceAccs,
          negativeIMRAcc,
        );
        const attachments = [
          {
            filename: `NegativeAccounts_${new Date().toISOString().split('T')[0]}.xlsx`,
            content: Buffer.from(excelBuffer),
          },
        ];
        const emailResult =
          await this.marginCheckerService.sendEmailNotification(
            emailConfig,
            mailSettings.email,
            subject,
            htmlBody,
            attachments,
            'negativeMarginReport',
          );
        if (emailResult.success) {
          this.logger.log(
            `Đã gửi email báo cáo tài khoản âm ký quỹ thành công: ${emailResult.messageId}`,
          );
        } else {
          this.logger.error(
            `Không thể gửi email báo cáo tài khoản âm ký quỹ: ${emailResult.error}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Lỗi gửi email báo cáo tài khoản âm ký quỹ: ${err.message}`,
      );
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
    const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
    const buyColIndex = headers.indexOf('buy');
    const sellColIndex = headers.indexOf('sell');

    if (buyColIndex === -1 || sellColIndex === -1) {
      throw new Error(
        "Không tìm thấy cột 'Buy' hoặc 'Sell' trong file CSV Straits",
      );
    }

    let totalVolume = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',');
      if (buyColIndex < values.length) {
        const buyVal =
          parseFloat(values[buyColIndex].replace(/"/g, '').trim()) || 0;
        totalVolume += buyVal;
      }
      if (sellColIndex < values.length) {
        const sellVal =
          parseFloat(values[sellColIndex].replace(/"/g, '').trim()) || 0;
        totalVolume += sellVal;
      }
    }
    return { totalVolume };
  }

  /**
   * Parse TTTT.xlsx / TTM.xlsx for Position reconciliation
   */
  private parseTTTTForRecon(
    buffer: Buffer,
  ): { account: string; symbol: string; position: number }[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    let headerRowIdx = 0;
    let accountIdx = -1;
    let symbolIdx = -1;
    let positionIdx = -1;

    const scanLimit = Math.min(rows.length, 5);
    for (let r = 0; r < scanLimit; r++) {
      if (!rows[r]) continue;
      const rowHeaders = rows[r].map((h) => String(h || '').trim());
      const tempAccIdx = this.findHeaderIndex(rowHeaders, 'Mã TKGD', [
        'mã tài khoản',
        'account',
        'mã khách hàng',
        'mã kh',
        'tk',
      ]);
      const tempSymIdx = this.findHeaderIndex(rowHeaders, 'Mã HĐ', [
        'mã hợp đồng',
        'symbol',
        'mã hh',
        'mã hàng hóa',
      ]);
      const tempPosIdx = this.findHeaderIndex(rowHeaders, 'KL ròng', [
        'khối lượng ròng',
        'net position',
        'position',
        'vị thế ròng',
        'trạng thái ròng',
        'lãi lỗ thực tế',
        'lãi/lỗ',
      ]);

      if (tempAccIdx !== -1 && tempSymIdx !== -1) {
        headerRowIdx = r;
        accountIdx = tempAccIdx;
        symbolIdx = tempSymIdx;
        if (tempPosIdx !== -1) {
          positionIdx = tempPosIdx;
        }
        break;
      }
    }

    if (accountIdx === -1 || symbolIdx === -1) {
      accountIdx = 7;
      symbolIdx = 9;
    }
    const finalPosIdx = positionIdx !== -1 ? positionIdx : 19;

    const result = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const accountRaw = String(row[accountIdx] || '').trim();
      const symbol = String(row[symbolIdx] || '').trim();
      const position = parseFloat(row[finalPosIdx]) || 0;
      if (!accountRaw || !symbol) continue;

      const account = this.getNormalizedAccount(accountRaw);
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
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    let headerRowIdx = 1; // default fallback to index 1 (row 2 in Excel)
    let accountIdx = -1;
    let symbolIdx = -1;
    let positionIdx = -1;

    const scanLimit = Math.min(rows.length, 5);
    for (let r = 0; r < scanLimit; r++) {
      if (!rows[r]) continue;
      const rowHeaders = rows[r].map((h) => String(h || '').trim());
      const tempAccIdx = this.findHeaderIndex(rowHeaders, 'Account', [
        'account',
        'tk',
        'tài khoản',
        'ma tkgd',
        'account number',
        'acc',
      ]);
      const tempSymIdx = this.findHeaderIndex(rowHeaders, 'Symbol', [
        'symbol',
        'ma hd',
        'mã hợp đồng',
        'ma hop dong',
        'contract',
      ]);
      const tempPosIdx = this.findHeaderIndex(rowHeaders, 'Position', [
        'net',
        'kl ròng',
        'vị thế',
        'trạng thái ròng',
        'pl',
        'profit',
        'lỗ',
      ]);

      if (tempAccIdx !== -1 && tempSymIdx !== -1) {
        headerRowIdx = r;
        accountIdx = tempAccIdx;
        symbolIdx = tempSymIdx;
        if (tempPosIdx !== -1) {
          positionIdx = tempPosIdx;
        }
        break;
      }
    }

    if (accountIdx === -1 || symbolIdx === -1) {
      // Fallback index matching C# default values
      accountIdx = 0;
      symbolIdx = 3;
    }
    const finalPosIdx = positionIdx !== -1 ? positionIdx : 8;

    const result = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const accountRaw = String(row[accountIdx] || '').trim();
      let symbol = String(row[symbolIdx] || '').trim();
      const position = this.parseCqgNumber(row[finalPosIdx]);
      if (!accountRaw || !symbol) continue;

      const account = this.getNormalizedAccount(accountRaw);
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
    sessionStart?: Date;
    checkTime?: Date;
  }> {
    if (sessionStartStr) {
      await this.settingsService.setSetting(
        'session_start_time',
        sessionStartStr,
      );
    }
    // Calculate time bounds: sessionStart and checkTime
    const [sHour, sMin] = sessionStartStr.split(':').map(Number);

    const isPastDateOrDateOnly =
      (tradingDate.getHours() === 0 &&
        tradingDate.getMinutes() === 0 &&
        tradingDate.getSeconds() === 0) ||
      (tradingDate.getUTCHours() === 0 &&
        tradingDate.getUTCMinutes() === 0 &&
        tradingDate.getUTCSeconds() === 0);

    const sessionStart = new Date(tradingDate);
    let checkTime: Date;

    if (isPastDateOrDateOnly) {
      // Historical check or date-only upload:
      // tradingDate là ngày bắt đầu phiên (do FE truyền vào), checkTime = sessionStart + 1 ngày
      sessionStart.setHours(sHour, sMin, 0, 0);
      while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
        // 0: Sunday, 6: Saturday
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
      checkTime = new Date(sessionStart);
      checkTime.setDate(checkTime.getDate() + 1);
    } else {
      // Live check: mimic the C# tool logic
      checkTime = new Date(tradingDate);
      sessionStart.setHours(sHour, sMin, 0, 0);
      if (checkTime < sessionStart) {
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
      while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
        // 0: Sunday, 6: Saturday
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
    }

    // Validate filename date suffix for acmTrades (only if filename contains an 8-digit date pattern)
    const expectedDateStr = `${String(tradingDate.getDate()).padStart(2, '0')}${String(tradingDate.getMonth() + 1).padStart(2, '0')}${tradingDate.getFullYear()}`;
    const dateMatchInName = acmTradesName ? acmTradesName.match(/\d{8}/) : null;
    if (dateMatchInName && dateMatchInName[0] !== expectedDateStr) {
      this.logger.warn(
        `File ACM Trades (${acmTradesName}) date suffix ${dateMatchInName[0]} does not match expected ${expectedDateStr}. Continuing with folder date.`,
      );
    }

    // 2. Parse DSGD and separate into ACM and CQG trades
    // DSGD is filtered from sessionStart to checkTime (session-based rolling window)
    // to align with CQG session bounds and support DSGD files containing next day trades.
    const rawDsgdData = this.parseDSGD(files.dsgd);
    const dsgdUpperBound = checkTime;
    const dsgdData = rawDsgdData.filter((gd) => {
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
      return tradeTime >= sessionStart && tradeTime <= dsgdUpperBound;
    });

    let totalACM_MS = 0;
    let totalCQG_MS = 0;
    dsgdData.forEach((gd) => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) {
        totalACM_MS += gd.klGiaoDich;
      } else {
        totalCQG_MS += gd.klGiaoDich;
      }
    });

    // 3. Parse Straits ACM Trades CSV
    let acmStraitsData: any = { totalVolume: 0, trades: [] };
    try {
      acmStraitsData = this.parseStraitsCsv(files.acmTrades);
    } catch (acmErr: any) {
      this.logger.warn(
        `Lỗi parse file ACM Trades: ${acmErr.message}. Tiếp tục đối chiếu MS vs CQG.`,
      );
    }
    const totalACM_Straits = acmStraitsData.totalVolume || 0;
    const differACM = Math.abs(totalACM_MS - totalACM_Straits);

    // 4. Parse CQG FR.xlsx and filter out ZWAZCE
    const rawFrData = this.parseFR(files.cqgFr, tradingDate, holidays);
    const frData = rawFrData.filter((fr) => {
      if (!fr.time) return true;
      const tradeTime = this.parseCqgDateTime(fr.time, tradingDate);
      if (!tradeTime) return true;
      return tradeTime >= sessionStart && tradeTime <= checkTime;
    });

    let totalCQG_FR = 0;
    frData.forEach((fr) => {
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
    frData.forEach((fr) => {
      if (fr.symbol === 'ZWAZCE') return;
      const existsInDSGD = dsgdData.some(
        (gd) => gd.combinedKey === fr.combinedKey,
      );
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
    dsgdData.forEach((gd) => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) return;
      const existsInFR = frData.some((fr) => fr.combinedKey === gd.combinedKey);
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
    const msSummary = new Map<
      string,
      { account: string; symbol: string; position: number }
    >();
    ttttList.forEach((item) => {
      // Filter out self-trading (ACM) accounts ending with 'A' or 'a' (like -A, -a, etc.)
      if (item.account.toUpperCase().endsWith('A')) return;

      const key = `${item.account}_${item.symbol}`;
      const existing = msSummary.get(key) || {
        account: item.account,
        symbol: item.symbol,
        position: 0,
      };
      existing.position += item.position;
      msSummary.set(key, existing);
    });

    // Group CQG positions by Account + Symbol
    const cqgSummary = new Map<
      string,
      { account: string; symbol: string; position: number }
    >();
    psList.forEach((item) => {
      const key = `${item.account}_${item.symbol}`;
      const existing = cqgSummary.get(key) || {
        account: item.account,
        symbol: item.symbol,
        position: 0,
      };
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

    const passed =
      differACM === 0 &&
      differCQG === 0 &&
      mismatchedTrades.length === 0 &&
      mismatchedPositions.length === 0;

    // Gửi email báo cáo đối chiếu Pre-EOD
    try {
      const emailConfig = await this.marginCheckerService.loadConfig();
      const mailSettings = emailConfig.preEodCheck || {
        isSendWarning: true,
        email: ['it.support@mxv.vn'],
      };
      if (mailSettings.isSendWarning) {
        const subject = `[MXV PRE-EOD CHECK] Báo cáo đối chiếu Khối lượng & Vị thế cuối ngày - ${passed ? 'KHỚP' : 'LỆCH'}`;
        const htmlBody = this.buildPreEodEmailHtml(
          passed,
          {
            totalACM_MS,
            totalACM_Straits,
            differACM,
            totalCQG_MS,
            totalCQG_FR,
            differCQG,
          },
          mismatchedTrades,
          mismatchedPositions,
        );
        const emailResult =
          await this.marginCheckerService.sendEmailNotification(
            emailConfig,
            mailSettings.email,
            subject,
            htmlBody,
            [],
            'preEodCheck',
          );
        if (emailResult.success) {
          this.logger.log(
            `Đã gửi email báo cáo Pre-EOD thành công: ${emailResult.messageId}`,
          );
        } else {
          this.logger.error(
            `Không thể gửi email báo cáo Pre-EOD: ${emailResult.error}`,
          );
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
      sessionStart,
      checkTime,
    };
  }

  private findLatestFile(dirPath: string, pattern: RegExp): string | null {
    try {
      const fs = require('fs');
      const path = require('path');
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
            // Quét thêm 1 cấp thư mục con (ví dụ QLTTTKGD/...)
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
    } catch (err) {
      this.logger.error(`Lỗi khi tìm file mới nhất trong ${dirPath}:`, err);
      return null;
    }
  }

  async runAutoCheckSOD(tradingDate: Date): Promise<any> {
    const fs = require('fs');
    const path = require('path');

    // 1. Tìm file QLTKGD.xlsx mới nhất của ngày tradingDate
    const msBackupBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    ));
    const cqgBackupBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
    ));

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const dailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);

    const qltkgdPath = path.join(dailyPath, 'QLTKGD.xlsx');
    if (!fs.existsSync(qltkgdPath)) {
      throw new Error(
        `Không tìm thấy file QLTKGD.xlsx của ngày ${day}/${month}/${year} tại: ${qltkgdPath}`,
      );
    }

    const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');
    const accountsBalancesPath =
      this.findLatestFile(cqgDailyPath, /Accounts_Balances/i) ||
      this.findLatestFile(dailyPath, /Accounts_Balances/i);
    // Fallback UAT (Commented out for Go-Live):
    // || this.findLatestFile(castDownloadsDir, /^Accounts_Balances_.*\.xlsx$/i);

    if (!accountsBalancesPath) {
      throw new Error(
        `Không tìm thấy file Accounts_Balances.xlsx của ngày ${day}/${month}/${year} tại ${cqgDailyPath} hoặc thư mục tạm ${castDownloadsDir}`,
      );
    }

    this.logger.log(`Bắt đầu chạy đối chiếu SOD tự động:`);
    this.logger.log(`- File QLTKGD: ${qltkgdPath}`);
    this.logger.log(`- File Accounts_Balances: ${accountsBalancesPath}`);

    // 3. Thực hiện đối chiếu CQG Balance (dùng hàm checkEODCQG)
    const qltkgdBuffer = fs.readFileSync(qltkgdPath);
    const accountsBalancesBuffer = fs.readFileSync(accountsBalancesPath);
    const emailConfig = await this.marginCheckerService.loadConfig();
    const differThreshold =
      emailConfig?.sodCheck?.differThreshold !== undefined
        ? emailConfig.sodCheck.differThreshold
        : 100;
    const isSendWarning = emailConfig?.sodCheck?.isSendWarning !== false;

    let usdRate = 25220;
    try {
      this.logger.log('Đang tự động đồng bộ tỷ giá USD từ M-System...');
      usdRate = await this.syncUsdRateFromMSystem();
    } catch (err) {
      this.logger.warn(
        `Không thể đồng bộ tỷ giá USD tự động (sẽ sử dụng tỷ giá cũ): ${err.message}`,
      );
      const usdRateStr = await this.settingsService.getSetting(
        'usd_exchange_rate',
        '25220',
      );
      usdRate = parseFloat(usdRateStr) || 25220;
    }

    const discrepancies = await this.checkEODCQG(
      {
        qltkgd: qltkgdBuffer,
        accountsBalances: accountsBalancesBuffer,
        qltkgdName: 'QLTKGD.xlsx',
        accountsBalancesName: path.basename(accountsBalancesPath),
      },
      usdRate,
    );

    const significantDiscrepancies = discrepancies.filter(
      (d) => d.differ > differThreshold,
    );
    const hasDiscrepancy = significantDiscrepancies.length > 0;

    // Soạn tin nhắn Telegram
    let telegramMsg = ` <b>[ĐỐI CHIẾU SOD TỰ ĐỘNG - ${day}/${month}/${year}]</b>\n`;
    telegramMsg += `• Trạng thái: ${hasDiscrepancy ? '<b>PHÁT HIỆN LỆCH SỐ DƯ</b>' : `✓ Khớp hoàn toàn (sai số &lt; $${differThreshold})`}\n`;
    telegramMsg += `• File QLTKGD: <code>${path.basename(qltkgdPath)}</code>\n`;
    telegramMsg += `• File CQG CAST: <code>${path.basename(accountsBalancesPath)}</code>\n`;
    telegramMsg += `• Tỷ giá USD áp dụng: <code>${usdRate} VND</code>\n`;

    if (hasDiscrepancy) {
      telegramMsg += `\n <b>Danh sách tài khoản lệch (> $${differThreshold}):</b>\n`;
      significantDiscrepancies.slice(0, 15).forEach((d) => {
        telegramMsg += `- <b>TK ${d.maTKGD}</b>: MS <code>$${d.calculatedBalance}</code> vs CQG <code>$${d.cqgBalance}</code> (Lệch: <b>$${d.differ.toFixed(2)}</b>)\n`;
      });
      if (significantDiscrepancies.length > 15) {
        telegramMsg += `- ... và <i>${significantDiscrepancies.length - 15} tài khoản khác</i>.\n`;
      }
    } else {
      telegramMsg += `\n✓ Số dư khớp hoàn hảo giữa M-System và CQG CAST.`;
    }

    this.logger.log(
      `Gửi tin nhắn cảnh báo Telegram: ${hasDiscrepancy ? 'LỆCH' : 'KHỚP'}`,
    );
    await this.telegramService.sendMessage(telegramMsg);

    // 4. Gửi báo cáo Email qua SMTP (Kế thừa từ MarginCheckerService)
    try {
      if (!isSendWarning) {
        this.logger.log(`Gửi email báo cáo SOD đã bị tắt trong cấu hình.`);
      } else {
        let toEmails = emailConfig?.sodCheck?.email ||
          emailConfig?.marginOnOrder?.email || ['it.support@mxv.vn'];

        const customEmailsStr = await this.settingsService.getSetting(
          'sod_email_recipients',
          '',
        );
        if (customEmailsStr) {
          toEmails = customEmailsStr
            .split(',')
            .map((e: string) => e.trim())
            .filter(Boolean);
        }

        this.logger.log(
          `Bắt đầu soạn và gửi email báo cáo SOD đến: ${toEmails.join(', ')}`,
        );

        const statusText = hasDiscrepancy
          ? 'PHÁT HIỆN LỆCH SỐ DƯ'
          : `✓ Khớp Hoàn Toàn (Sai số < $${differThreshold})`;
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
          .replace(
            /class="status-match"/g,
            'style="display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; background-color: #e3f9e5; color: #1f7a28; border: 1px solid #c2f0c5;"',
          )
          .replace(
            /class="status-diff"/g,
            'style="display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; background-color: #ffe8e6; color: #b82c1c; border: 1px solid #ffd0cc;"',
          );

        const emailSubject = `[ĐỐI CHIẾU SOD] Kết quả đối chiếu số dư đầu ngày ${day}/${month}/${year}`;

        const emailResult =
          await this.marginCheckerService.sendEmailNotification(
            emailConfig,
            toEmails,
            emailSubject,
            formattedHtml,
            [],
            'sodCheck',
          );

        if (emailResult.success) {
          this.logger.log(
            `Đã gửi email báo cáo SOD thành công: ${emailResult.messageId}`,
          );
        } else {
          this.logger.error(
            `Không thể gửi email báo cáo SOD: ${emailResult.error}`,
          );
        }
      }
    } catch (emailErr: any) {
      this.logger.error(
        `Lỗi trong quá trình tạo/gửi email báo cáo SOD: ${emailErr.message}`,
      );
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
      tradesRows = mismatchedTrades
        .map(
          (t, idx) => `
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
      `,
        )
        .join('');
    } else {
      tradesRows = `<tr><td colspan="8" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2e7d32;">Không phát hiện chênh lệch khớp lệnh.</td></tr>`;
    }

    let positionsRows = '';
    if (mismatchedPositions.length > 0) {
      positionsRows = mismatchedPositions
        .map(
          (p, idx) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${p.account}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${p.symbol}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${p.msPosition.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${p.cqgPosition.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: #c62828;">${p.differ.toLocaleString()}</td>
        </tr>
      `,
        )
        .join('');
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
      mismatchRows = mismatches
        .map(
          (m, idx) => `
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
      `,
        )
        .join('');
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
      balanceRows = negativeBalances
        .map(
          (acc, idx) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: #c62828;">${acc}</td>
          <td style="border: 1px solid #ddd; padding: 8px; color: #c62828;">Âm số dư tài khoản hiện tại</td>
        </tr>
      `,
        )
        .join('');
    } else {
      balanceRows = `<tr><td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2e7d32;">Không có tài khoản âm số dư hiện tại.</td></tr>`;
    }

    let imrRows = '';
    if (negativeIMR.length > 0) {
      imrRows = negativeIMR
        .map(
          (acc, idx) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: #c62828;">${acc}</td>
          <td style="border: 1px solid #ddd; padding: 8px; color: #c62828;">Âm ký quỹ khả dụng đầu ngày (IMR < 0)</td>
        </tr>
      `,
        )
        .join('');
    } else {
      imrRows = `<tr><td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2e7d32;">Không có tài khoản âm ký quỹ khả dụng (IMR).</td></tr>`;
    }

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
          <div style="max-width: 800px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid #c62828;">
            <div style="padding: 20px;">
              <h2 style="color: #c62828; margin-top: 0;">Cảnh Báo Tài Khoản Âm Ký Quỹ Đầu Ngày (Post-EOD)</h2>
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

  private mergeCqgRawFiles(
    dirPath: string,
    prefix: 'FR' | 'PS' | 'OP' | 'OD',
  ): string | null {
    if (!fs.existsSync(dirPath)) return null;
    try {
      const files = fs.readdirSync(dirPath);
      const regex1 = new RegExp(`^${prefix}\\s*1.*\\.xlsx$`, 'i');
      const regex2 = new RegExp(`^${prefix}\\s*2.*\\.xlsx$`, 'i');

      const f1 = files.find((f) => regex1.test(f) && !f.startsWith('~$'));
      const f2 = files.find((f) => regex2.test(f) && !f.startsWith('~$'));

      if (!f1 && !f2) return null;

      const p1 = f1 ? path.join(dirPath, f1) : null;
      const p2 = f2 ? path.join(dirPath, f2) : null;
      const destPath = path.join(dirPath, `${prefix}.xlsx`);

      let rows1: any[][] = [];
      if (p1 && fs.existsSync(p1)) {
        try {
          const wb1 = XLSX.readFile(p1);
          rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 });
        } catch {}
      }

      let rows2: any[][] = [];
      if (p2 && fs.existsSync(p2)) {
        try {
          const wb2 = XLSX.readFile(p2);
          rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 });
        } catch {}
      }

      const headerRow = rows1[1] || rows1[0] || rows2[1] || rows2[0] || [];
      const data1 =
        rows1.length > 4
          ? rows1.slice(2, rows1.length - (prefix === 'FR' ? 2 : 0))
          : rows1.length > 2
            ? rows1.slice(2)
            : [];
      const data2 =
        rows2.length > 4
          ? rows2.slice(2, rows2.length - (prefix === 'FR' ? 2 : 0))
          : rows2.length > 2
            ? rows2.slice(2)
            : [];

      const mergedData: any[] = [];
      if (headerRow && headerRow.length > 0) {
        mergedData.push(headerRow);
      }
      mergedData.push(...data1, ...data2);

      const nwb = XLSX.utils.book_new();
      const ns = XLSX.utils.aoa_to_sheet(mergedData);
      XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
      XLSX.writeFile(nwb, destPath, { compression: true });
      this.logger.log(`Tự động ghép ${f1 || ''} + ${f2 || ''} -> ${destPath} (${mergedData.length} dòng)`);
      return destPath;
    } catch (err: any) {
      this.logger.error(`Lỗi ghép file ${prefix}: ${err.message}`);
      return null;
    }
  }

  private resolveCqgFile(
    dirPath: string,
    prefix: 'FR' | 'PS' | 'OP',
  ): string | null {
    if (!fs.existsSync(dirPath)) return null;

    const mergedFile = this.findLatestFile(dirPath, new RegExp(`^${prefix}\\.xlsx$`, 'i'));
    const f1 = this.findLatestFile(dirPath, new RegExp(`^${prefix}\\s*1.*\\.xlsx$`, 'i'));
    const f2 = this.findLatestFile(dirPath, new RegExp(`^${prefix}\\s*2.*\\.xlsx$`, 'i'));

    if (f1 || f2) {
      if (!mergedFile) {
        return this.mergeCqgRawFiles(dirPath, prefix);
      }
      try {
        const mergedMtime = fs.statSync(mergedFile).mtimeMs;
        const f1Mtime = f1 ? fs.statSync(f1).mtimeMs : 0;
        const f2Mtime = f2 ? fs.statSync(f2).mtimeMs : 0;
        const mergedSize = fs.statSync(mergedFile).size;

        if (f1Mtime > mergedMtime || f2Mtime > mergedMtime || mergedSize < 2500) {
          this.logger.log(
            `[Recon] Raw files cho ${prefix} mới hơn hoặc file gộp quá nhỏ (${mergedSize}B). Tự động ghép lại...`,
          );
          const newMerged = this.mergeCqgRawFiles(dirPath, prefix);
          if (newMerged) return newMerged;
        }
      } catch (err: any) {
        this.logger.warn(`[Recon] Lỗi kiểm tra mtime ${prefix}: ${err.message}`);
      }
    }

    return (
      mergedFile ||
      this.mergeCqgRawFiles(dirPath, prefix) ||
      this.findLatestFile(dirPath, new RegExp(`${prefix}`, 'i'))
    );
  }

  async runAutoCheckKLGD(
    tradingDate: Date,
    options?: {
      checkKlgd?: boolean;
      checkTtm?: boolean;
      checkTttt?: boolean;
    },
  ): Promise<any> {
    const msBackupBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    ));
    const cqgBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
    );
    const acmBackupBase = (
      await this.settingsService.getSetting('bot_backup_path_acm', '')
    ) || msBackupBase.replace(
      /Backup MS[\\/]Futures/i,
      (match) => match.includes('/') ? 'Backup MS/ACM' : 'Backup MS\\ACM',
    );

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);
    const acmDailyPath = path.join(acmBackupBase, subFolder);

    const rawCcpBase = await this.settingsService.getSetting(
      'bot_backup_path_ccp',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
    );
    const ccpBackupBase = resolveStoragePathCrossPlatform(rawCcpBase);
    let ccpDailyPath = path.join(ccpBackupBase, subFolder);
    if (!fs.existsSync(ccpDailyPath)) {
      const localBackup = path.join(process.cwd(), 'backupCCP');
      const localDaily = path.join(localBackup, subFolder);
      if (fs.existsSync(localDaily)) {
        ccpDailyPath = localDaily;
      } else if (fs.existsSync(localBackup)) {
        ccpDailyPath = localBackup;
      }
    }

    const dsgdPath = path.join(msDailyPath, 'DSGD.xlsx');
    const ttttPath = path.join(msDailyPath, 'TTTT.xlsx');
    const ttmPath = path.join(msDailyPath, 'TTM.xlsx');

    const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');

    const acmTradesPath =
      this.findLatestFile(acmDailyPath, /Straits/i) ||
      this.findLatestFile(acmDailyPath, /Nano|Fill/i);

    const cqgFrPath = this.resolveCqgFile(cqgDailyPath, 'FR');
    const cqgPsPath = this.resolveCqgFile(cqgDailyPath, 'PS');
    const cqgOpPath = this.resolveCqgFile(cqgDailyPath, 'OP');

    const dsgdCcpPath = this.findLatestFile(ccpDailyPath, /dsgd/i);
    const ttmCcpPath = this.findLatestFile(ccpDailyPath, /ttm/i);
    const ttttCcpPath = this.findLatestFile(ccpDailyPath, /tttt/i);

    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );

    const [sHour, sMin] = sessionStartStr.split(':').map(Number);
    const sessionStart = new Date(tradingDate);
    sessionStart.setHours(sHour, sMin, 0, 0);
    const checkTime = new Date();
    if (checkTime < sessionStart) {
      sessionStart.setDate(sessionStart.getDate() - 1);
    }
    while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
      sessionStart.setDate(sessionStart.getDate() - 1);
    }

    const checkKlgdFlag = options?.checkKlgd !== false;
    const checkTtmFlag = options?.checkTtm !== false;

    const missingFiles: string[] = [];
    if (checkKlgdFlag) {
      if (!fs.existsSync(dsgdPath)) missingFiles.push(`DSGD.xlsx`);
      if (!acmTradesPath) missingFiles.push(`ACM Trades (Fill.xlsx / Straits.csv)`);
      if (!cqgFrPath) missingFiles.push(`CQG FR`);
    }
    if (checkTtmFlag) {
      if (!fs.existsSync(ttmPath)) missingFiles.push(`TTM.xlsx`);
    }

    if (missingFiles.length > 0) {
      return {
        passed: true,
        isWaitingFiles: true,
        sessionStart,
        checkTime,
        message: `[Đang chờ dữ liệu] Thư mục backup ngày ${day}.${month}.${year} đang chờ cập nhật đầy đủ file đối chiếu (Đang thiếu: ${missingFiles.join(', ')}). Bot sẽ tự động kiểm tra lại ở chu kỳ tiếp theo.`,
        totals: {
          totalDSGD: 0,
          totalFR: 0,
          totalACM: 0,
          totalNano: 0,
          differ: 0,
          differACM: 0,
        },
        mismatchedTrades: [],
      };
    }

    const files: any = {};
    if (fs.existsSync(dsgdPath)) files.dsgd = fs.readFileSync(dsgdPath);
    if (cqgFrPath && fs.existsSync(cqgFrPath))
      files.fr = fs.readFileSync(cqgFrPath);
    if (acmTradesPath && fs.existsSync(acmTradesPath))
      files.nano = fs.readFileSync(acmTradesPath);
    if (fs.existsSync(ttmPath)) files.ttm = fs.readFileSync(ttmPath);
    if (fs.existsSync(ttttPath)) files.tttt = fs.readFileSync(ttttPath);
    if (cqgPsPath && fs.existsSync(cqgPsPath))
      files.ps = fs.readFileSync(cqgPsPath);
    if (cqgOpPath && fs.existsSync(cqgOpPath))
      files.op = fs.readFileSync(cqgOpPath);

    if (dsgdCcpPath && fs.existsSync(dsgdCcpPath)) files.dsgdCcp = fs.readFileSync(dsgdCcpPath);
    if (ttmCcpPath && fs.existsSync(ttmCcpPath)) files.ttmCcp = fs.readFileSync(ttmCcpPath);
    if (ttttCcpPath && fs.existsSync(ttttCcpPath)) files.ttttCcp = fs.readFileSync(ttttCcpPath);

    return this.checkKLGD(files, tradingDate, [], sessionStartStr, options);
  }

  async runAutoCheckPreEOD(tradingDate: Date): Promise<any> {
    // Đối chiếu Pre-EOD chốt số liệu cho phiên giao dịch T-1 (ngày làm việc vừa kết thúc)
    const targetDate = new Date(tradingDate);
    targetDate.setDate(targetDate.getDate() - 1);
    targetDate.setHours(0, 0, 0, 0);

    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );
    const cqgBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
    );
    const acmBackupBase = (
      await this.settingsService.getSetting('bot_backup_path_acm', '')
    ) || msBackupBase.replace(
      /Backup MS[\\/]Futures/i,
      (match) => match.includes('/') ? 'Backup MS/ACM' : 'Backup MS\\ACM',
    );

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);
    const acmDailyPath = path.join(acmBackupBase, subFolder);

    const dsgdPath = path.join(msDailyPath, 'DSGD.xlsx');
    const ttttPath = path.join(msDailyPath, 'TTTT.xlsx');

    const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');

    const acmTradesPath =
      this.findLatestFile(acmDailyPath, /Straits/i) ||
      this.findLatestFile(acmDailyPath, /Nano|Fill/i);

    const cqgFrPath = this.resolveCqgFile(cqgDailyPath, 'FR');
    const cqgPsPath = this.resolveCqgFile(cqgDailyPath, 'PS');

    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );

    const [sHour, sMin] = sessionStartStr.split(':').map(Number);
    const sessionStart = new Date(targetDate);
    sessionStart.setHours(sHour, sMin, 0, 0);
    while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
      sessionStart.setDate(sessionStart.getDate() - 1);
    }
    const checkTime = new Date(sessionStart);
    checkTime.setDate(checkTime.getDate() + 1);

    const missingFiles: string[] = [];
    if (!fs.existsSync(dsgdPath)) missingFiles.push(`DSGD.xlsx`);
    if (!fs.existsSync(ttttPath)) missingFiles.push(`TTTT.xlsx`);
    if (!acmTradesPath) missingFiles.push(`ACM Trades (Fill.xlsx / Straits.csv)`);
    if (!cqgFrPath) missingFiles.push(`CQG FR`);
    if (!cqgPsPath) missingFiles.push(`CQG Positions/PS`);

    if (missingFiles.length > 0) {
      return {
        passed: true,
        isWaitingFiles: true,
        sessionStart,
        checkTime,
        message: `[Đang chờ dữ liệu] Thư mục backup ngày ${day}.${month}.${year} đang chờ cập nhật đầy đủ file đối chiếu (Đang thiếu: ${missingFiles.join(', ')}). Bot sẽ tự động kiểm tra lại ở chu kỳ tiếp theo.`,
        totals: {
          totalDSGD: 0,
          totalFR: 0,
          totalACM: 0,
          totalNano: 0,
          differ: 0,
          differACM: 0,
          totalTTTT: 0,
          totalPS: 0,
          differTTTT: 0,
        },
        mismatchedTrades: [],
        mismatchedPositions: [],
        mismatchedTTM: [],
        mismatchedTTTT: [],
      };
    }

    const result = await this.checkPreEOD(
      {
        dsgd: fs.readFileSync(dsgdPath),
        acmTrades: fs.readFileSync(acmTradesPath!),
        cqgFr: fs.readFileSync(cqgFrPath!),
        tttt: fs.readFileSync(ttttPath),
        cqgPs: fs.readFileSync(cqgPsPath!),
      },
      path.basename(acmTradesPath!),
      targetDate,
      [],
      sessionStartStr,
    );

    // Gửi Telegram alert
    let telegramMsg = ` <b>[ĐỐI CHIẾU PRE-EOD TỰ ĐỘNG - ${day}/${month}/${year}]</b>\n`;
    if (result.sessionStart && result.checkTime) {
      const startStr = result.sessionStart.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      const endStr = result.checkTime.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      telegramMsg += `• Khoảng thời gian lọc: <code>${startStr}</code> đến <code>${endStr}</code>\n`;
    }
    telegramMsg += `• Trạng thái: ${result.passed ? '✓ Khớp hoàn toàn' : '<b>PHÁT HIỆN LỆCH KHỚP LỆNH/VỊ THẾ</b>'}\n`;
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

    const msBackupBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    ));

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');
    const eodPath = this.findLatestFile(msDailyPath, /eod/i);
    const ttttPath = path.join(msDailyPath, 'TTTT.xlsx');

    if (!fs.existsSync(qltkgdPath))
      throw new Error(`Thiếu file QLTKGD.xlsx tại ${qltkgdPath}`);
    if (!eodPath) throw new Error('Không tìm thấy file eod.csv / eod.xlsx từ email M-System');

    // Quét thư mục Backup CCP nếu có
    const rawCcpBase = await this.settingsService.getSetting(
      'bot_backup_path_ccp',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
    );
    const ccpBackupBase = resolveStoragePathCrossPlatform(rawCcpBase);
    let ccpDailyPath = path.join(ccpBackupBase, subFolder);
    if (!fs.existsSync(ccpDailyPath)) {
      const localBackup = path.join(process.cwd(), 'backupCCP');
      const localDaily = path.join(localBackup, subFolder);
      if (fs.existsSync(localDaily)) {
        ccpDailyPath = localDaily;
      } else if (fs.existsSync(localBackup)) {
        ccpDailyPath = localBackup;
      }
    }
    let qltkgdCcpBuffer: Buffer | undefined;
    let eodCcpBuffer: Buffer | undefined;
    let ttttCcpBuffer: Buffer | undefined;

    if (fs.existsSync(ccpDailyPath)) {
      const qltkgdCcpFile = this.findLatestFile(ccpDailyPath, /qltkgd|qltttkgd/i);
      const eodCcpFile = this.findLatestFile(ccpDailyPath, /eod/i);
      const ttttCcpFile = this.findLatestFile(ccpDailyPath, /tttt/i);

      if (qltkgdCcpFile && fs.existsSync(qltkgdCcpFile)) {
        qltkgdCcpBuffer = fs.readFileSync(qltkgdCcpFile);
      }
      if (eodCcpFile && fs.existsSync(eodCcpFile)) {
        eodCcpBuffer = fs.readFileSync(eodCcpFile);
      }
      if (ttttCcpFile && fs.existsSync(ttttCcpFile)) {
        ttttCcpBuffer = fs.readFileSync(ttttCcpFile);
      }
    }

    // Chạy check EOD song song MS & CCP (công thức 4 thành phần)
    const eodResult = await this.checkEOD({
      qltkgd: fs.readFileSync(qltkgdPath),
      eod: fs.readFileSync(eodPath),
      tttt: fs.existsSync(ttttPath) ? fs.readFileSync(ttttPath) : undefined,
      qltkgdCcp: qltkgdCcpBuffer,
      eodCcp: eodCcpBuffer,
      ttttCcp: ttttCcpBuffer,
    });

    const negativeBalanceAccs = eodResult?.negativeBalanceAccs || [];
    const negativeIMRAcc = eodResult?.negativeIMRAcc || [];
    const totalNegative = negativeBalanceAccs.length + negativeIMRAcc.length;
    const mismatchedEOD = eodResult?.mismatchedEOD || [];

    const mismatchedMs = mismatchedEOD.filter((m: any) => m.system === 'MS' || !m.system);
    const mismatchedCcp = mismatchedEOD.filter((m: any) => m.system === 'CCP');

    let telegramMsg = ` <b>[ĐỐI CHIẾU EOD SONG SONG MS & CCP - ${day}/${month}/${year}]</b>\n`;
    telegramMsg += `• Trạng thái: ${totalNegative === 0 && mismatchedEOD.length === 0 ? '✓ Khớp hoàn toàn & Không có tài khoản âm' : '<b>PHÁT HIỆN BẤT THƯỜNG</b>'}\n`;
    telegramMsg += `• Tài khoản âm số dư hiện tại: <b>${negativeBalanceAccs.length}</b>\n`;
    telegramMsg += `• Tài khoản âm ký quỹ khả dụng (IMR): <b>${negativeIMRAcc.length}</b>\n`;
    telegramMsg += `• Lệch công thức EOD M-System: <b>${mismatchedMs.length}</b>\n`;
    if (qltkgdCcpBuffer) {
      telegramMsg += `• Lệch công thức EOD CoreCCP: <b>${mismatchedCcp.length}</b>\n`;
    }

    await this.telegramService.sendMessage(telegramMsg).catch(() => {});

    return {
      eodResult,
      totals: {
        totalNegativeBalance: negativeBalanceAccs.length,
        totalNegativeIMR: negativeIMRAcc.length,
        totalMismatchedEOD: mismatchedEOD.length,
        totalMismatchedMs: mismatchedMs.length,
        totalMismatchedCcp: mismatchedCcp.length,
      },
    };
  }

  async runAutoCheckEodCcp(tradingDate: Date): Promise<any> {
    const fs = require('fs');
    const path = require('path');

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    // Quét thư mục Backup CCP
    const rawCcpBase = await this.settingsService.getSetting(
      'bot_backup_path_ccp',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
    );
    const ccpBackupBase = resolveStoragePathCrossPlatform(rawCcpBase);
    let ccpDailyPath = path.join(ccpBackupBase, subFolder);

    // Fallback: Nếu ccpDailyPath chưa có, kiểm tra thư mục tương đối backupCCP
    if (!fs.existsSync(ccpDailyPath)) {
      const localBackup = path.join(process.cwd(), 'backupCCP');
      const localDaily = path.join(localBackup, subFolder);
      if (fs.existsSync(localDaily)) {
        ccpDailyPath = localDaily;
      } else if (fs.existsSync(localBackup)) {
        ccpDailyPath = localBackup;
      }
    }

    if (!fs.existsSync(ccpDailyPath)) {
      throw new Error(`Thư mục Backup CCP không tồn tại: ${ccpDailyPath}. Vui lòng tải báo cáo CCP trước.`);
    }

    const qltkgdCcpFile = this.findLatestFile(ccpDailyPath, /qltkgd|qltttkgd/i);
    const eodCcpFile = this.findLatestFile(ccpDailyPath, /eod/i);
    const ttttCcpFile = this.findLatestFile(ccpDailyPath, /tttt/i);
    const nrCcpFile = this.findLatestFile(ccpDailyPath, /nr/i);

    if (!qltkgdCcpFile || !fs.existsSync(qltkgdCcpFile)) {
      throw new Error(`Không tìm thấy file QLTTTKGD trong thư mục ${ccpDailyPath}`);
    }
    if (!eodCcpFile || !fs.existsSync(eodCcpFile)) {
      throw new Error(`Không tìm thấy file EOD trong thư mục ${ccpDailyPath}`);
    }

    const qltkgdCcpBuffer = fs.readFileSync(qltkgdCcpFile);
    const eodCcpBuffer = fs.readFileSync(eodCcpFile);
    const ttttCcpBuffer = ttttCcpFile && fs.existsSync(ttttCcpFile) ? fs.readFileSync(ttttCcpFile) : undefined;

    // Chạy đối chiếu CCP qua hàm checkEODCCP chuyên sâu
    const ccpResult = await this.checkEODCCP({
      qltkgdCcp: qltkgdCcpBuffer,
      eodCcp: eodCcpBuffer,
      ttttCcp: ttttCcpBuffer,
      qltkgdCcpName: path.basename(qltkgdCcpFile),
      eodCcpName: path.basename(eodCcpFile),
      ttttCcpName: ttttCcpFile ? path.basename(ttttCcpFile) : undefined,
    });

    const mismatchedCcp = ccpResult.mismatchedEOD || [];
    const negativeBalanceAccs = ccpResult.negativeBalanceAccs || [];
    const negativeIMRAcc = ccpResult.negativeIMRAcc || [];

    // Đếm tổng số tài khoản trong EOD CCP
    let totalAccounts = 0;
    try {
      const eodWb = XLSX.read(eodCcpBuffer, { type: 'buffer' });
      const eodSheet = eodWb.Sheets[eodWb.SheetNames[0]];
      const eodRows: any[] = XLSX.utils.sheet_to_json(eodSheet, { header: 1 });
      totalAccounts = Math.max(0, eodRows.length - 1);
    } catch {}

    let telegramMsg = ` <b>[ĐỐI CHIẾU EOD CORECCP - ${day}/${month}/${year}]</b>\n`;
    telegramMsg += `• Trạng thái: ${mismatchedCcp.length === 0 ? '✓ Khớp hoàn toàn công thức EOD CCP' : '<b>PHÁT HIỆN BẤT THƯỜNG</b>'}\n`;
    telegramMsg += `• Tổng số TK CoreCCP: <b>${totalAccounts}</b>\n`;
    telegramMsg += `• Tài khoản lệch công thức: <b>${mismatchedCcp.length}</b>\n`;
    telegramMsg += `• Tài khoản âm ký quỹ (IMR): <b>${negativeIMRAcc.length}</b>\n`;

    await this.telegramService.sendMessage(telegramMsg).catch(() => {});

    return {
      totalAccounts,
      mismatchedEOD: mismatchedCcp,
      negativeBalanceAccs,
      negativeIMRAcc,
      filesUsed: {
        qltkgd: path.basename(qltkgdCcpFile),
        eod: path.basename(eodCcpFile),
        tttt: ttttCcpFile ? path.basename(ttttCcpFile) : null,
        nr: nrCcpFile ? path.basename(nrCcpFile) : null,
      },
    };
  }

  async runAutoCheckCQGSync(tradingDate: Date): Promise<any> {
    const fs = require('fs');
    const path = require('path');

    const msBackupBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    ));
    const cqgBackupBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
    ));

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);

    const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');
    const accountsBalancesPath =
      this.findLatestFile(cqgDailyPath, /Accounts_Balances/i) ||
      this.findLatestFile(msDailyPath, /Accounts_Balances/i);

    if (!fs.existsSync(qltkgdPath))
      throw new Error(`Thiếu file QLTKGD.xlsx tại ${qltkgdPath}`);
    if (!accountsBalancesPath)
      throw new Error('Không tìm thấy file Accounts_Balances.xlsx từ CQG');

    let usdRate = 25220;
    try {
      this.logger.log('Đang tự động đồng bộ tỷ giá USD từ M-System...');
      usdRate = await this.syncUsdRateFromMSystem();
    } catch (err) {
      this.logger.warn(
        `Không thể đồng bộ tỷ giá USD tự động (sẽ sử dụng tỷ giá cấu hình): ${err.message}`,
      );
      const usdRateStr = await this.settingsService.getSetting(
        'usd_exchange_rate',
        '25920',
      );
      usdRate = parseFloat(usdRateStr) || 25920;
    }

    // Chạy check EOD CQG (Balance Reconciliation) - Hoàn toàn không phụ thuộc file eod.csv
    const cqgResult = await this.checkEODCQG(
      {
        qltkgd: fs.readFileSync(qltkgdPath),
        accountsBalances: fs.readFileSync(accountsBalancesPath),
      },
      usdRate,
    );

    const totalMismatched = cqgResult ? cqgResult.length : 0;
    let telegramMsg = ` <b>[ĐỐI CHIẾU ĐỒNG BỘ SỐ DƯ CQG - ${day}/${month}/${year}]</b>\n`;
    telegramMsg += `• Trạng thái: ${totalMismatched === 0 ? '✓ Khớp hoàn toàn giữa MS và CQG' : '<b>PHÁT HIỆN LỆCH SỐ DƯ</b>'}\n`;
    telegramMsg += `• Số tài khoản lệch số dư CQG (> $100): <b>${totalMismatched}</b>\n`;

    await this.telegramService.sendMessage(telegramMsg).catch(() => {});

    return {
      cqgResult,
      totals: {
        totalMismatchedCQG: totalMismatched,
      },
    };
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
      'chrome.exe',
    );

    if (fs.existsSync(bundledPath)) {
      this.logger.log(`Using bundled Chrome binary at: ${bundledPath}`);
      return bundledPath;
    }

    this.logger.warn(
      `Bundled Chrome binary not found at ${bundledPath}. Falling back to default playwright launch.`,
    );
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

    const credentialsRaw = await this.settingsService.getSetting(
      'bot_credentials_msystem',
      '',
    );
    if (credentialsRaw) {
      try {
        const credentials = JSON.parse(decrypt(credentialsRaw));
        if (credentials.url) msUrl = credentials.url;
        if (credentials.username) msUser = credentials.username;
        if (credentials.password) msPass = credentials.password;
        if (credentials.pin) msPin = credentials.pin;
      } catch (err) {
        this.logger.warn(
          'Không thể giải mã cấu hình M-System từ DB, dùng biến môi trường.',
        );
      }
    }

    if (!msUser || !msPass || !msPin) {
      throw new Error(
        'Cấu hình tài khoản M-System không đầy đủ (username, password, pin). Vui lòng cấu hình qua Admin UI hoặc file .env',
      );
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
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    try {
      this.logger.log(`Đi tới trang M-System: ${msUrl}...`);
      await page.goto(msUrl);
      await page.waitForTimeout(2000);

      this.logger.log('Nhập tài khoản và mật khẩu...');
      await page.waitForSelector('input[name="username"]', {
        state: 'visible',
      });
      await page.fill('input[name="username"]', msUser);
      await page.fill('input[name="password"]', msPass);
      await page.waitForTimeout(500);

      this.logger.log('Nhấn nút Đăng nhập...');
      await page.click('button.btn-primary');
      await page.waitForTimeout(2000);

      this.logger.log('Đang đợi bảng nhập mã PIN ảo hiển thị...');
      let pinSelectorVisible = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        pinSelectorVisible = await page
          .locator('div.pincode')
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (pinSelectorVisible) break;
        this.logger.warn(
          `Chưa hiển thị bảng PIN (lần thử ${attempt}), thử click lại nút Đăng nhập...`,
        );
        await page.click('button.btn-primary').catch(() => { });
        await page.waitForTimeout(2000);
      }

      await page.waitForSelector('div.pincode', {
        state: 'visible',
        timeout: 10000,
      });
      this.logger.log('Đang tự động click mã PIN ảo...');
      const pinDigits = msPin.split('');
      for (const digit of pinDigits) {
        const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
        await page.waitForSelector(digitSelector, { state: 'visible' });
        await page.click(digitSelector);
        await page.waitForTimeout(500);
      }

      this.logger.log('Xác thực đăng nhập...');
      await page
        .waitForURL(/.*dashboard.*/, { timeout: 15000 })
        .catch(() => { });
      await page.waitForTimeout(3000);
      this.logger.log(
        '🎉 Đăng nhập M-System thành công! Đang chuyển hướng tới trang tỷ giá...',
      );

      const exchangeRateUrl = `${msUrl.split('#')[0]}#/currencyManagement/exchangeRate`;
      await page.goto(exchangeRateUrl);
      await page.waitForTimeout(5000); // Đợi bảng tải dữ liệu

      // Trích xuất toàn bộ bảng tỷ giá quy đổi
      const rates = await page.evaluate(() => {
        const result: Record<string, number> = {};
        // 1. Thử tìm theo cấu trúc ag-Grid (M-System dùng ag-Grid)
        const agRows = Array.from(document.querySelectorAll('[role="row"]'));
        for (const row of agRows) {
          const baseCell = row.querySelector('[col-id="monetaryBase"]');
          const counterCell = row.querySelector('[col-id="counterCurrency"]');
          const rateCell = row.querySelector('[col-id="exchangeRate"]');

          if (baseCell && counterCell && rateCell) {
            const baseVal = (baseCell.textContent || '').trim().toUpperCase();
            const counterVal = (counterCell.textContent || '').trim().toUpperCase();
            const rateStr = (rateCell.textContent || '').trim().replace(/,/g, '');
            const rateVal = parseFloat(rateStr);
            if (counterVal === 'VND' && !isNaN(rateVal) && rateVal > 0) {
              result[baseVal] = rateVal;
            }
          }
        }
        if (Object.keys(result).length > 0) return result;

        // 2. Fallback sang cấu trúc table HTML thông thường
        const rows = Array.from(document.querySelectorAll('tr'));
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 4) {
            const baseCurrency = (
              cells[1].innerText ||
              cells[1].textContent ||
              ''
            ).trim().toUpperCase();
            const quoteCurrency = (
              cells[2].innerText ||
              cells[2].textContent ||
              ''
            ).trim().toUpperCase();
            const rateStr = (
              cells[3].innerText ||
              cells[3].textContent ||
              ''
            ).trim().replace(/,/g, '');
            const rateVal = parseFloat(rateStr);
            if (quoteCurrency === 'VND' && !isNaN(rateVal) && rateVal > 0) {
              result[baseCurrency] = rateVal;
            }
          }
        }
        return result;
      });

      const usdRate = rates['USD'] || 0;
      if (usdRate <= 0) {
        throw new Error(
          'Không tìm thấy dòng tỷ giá USD/VND trong bảng quản lý tỷ giá.',
        );
      }

      this.logger.log(
        `Tìm thấy tỷ giá từ M-System: USD=${usdRate}, MYR=${rates['MYR'] || 'N/A'}, RMB=${rates['RMB'] || 'N/A'}, JPY=${rates['JPY'] || 'N/A'}. Đang cập nhật hệ thống...`,
      );

      await this.settingsService.setSetting(
        'usd_exchange_rate',
        usdRate.toString(),
      );
      if (rates['MYR']) {
        await this.settingsService.setSetting('myr_exchange_rate', rates['MYR'].toString());
      }
      if (rates['JPY']) {
        await this.settingsService.setSetting('jpy_exchange_rate', rates['JPY'].toString());
      }
      if (rates['RMB']) {
        await this.settingsService.setSetting('rmb_exchange_rate', rates['RMB'].toString());
      }
      await this.settingsService.setSetting('exchange_rates_last_synced', new Date().toISOString());

      return usdRate;
    } finally {
      await browser.close();
    }
  }

  async syncAllExchangeRatesFromMSystem(): Promise<Record<string, number>> {
    await this.syncUsdRateFromMSystem();
    const rates = await this.getCurrentExchangeRates();
    return {
      USD: rates.usdGain,
      MYR: rates.myrGain,
      JPY: rates.jpyGain,
      RMB: rates.rmbGain,
    };
  }

  async getCurrentExchangeRates(): Promise<{
    usdLoss: number;
    usdGain: number;
    myrLoss: number;
    myrGain: number;
    jpyLoss: number;
    jpyGain: number;
    rmbLoss: number;
    rmbGain: number;
  }> {
    const usdStr = await this.settingsService.getSetting('usd_exchange_rate', '25920');
    const myrStr = await this.settingsService.getSetting('myr_exchange_rate', '6383');
    const jpyStr = await this.settingsService.getSetting('jpy_exchange_rate', '170');
    const rmbStr = await this.settingsService.getSetting('rmb_exchange_rate', '3871');

    const usd = parseFloat(usdStr) || 25920;
    const myr = parseFloat(myrStr) || 6383;
    const jpy = parseFloat(jpyStr) || 170;
    const rmb = parseFloat(rmbStr) || 3871;

    return {
      usdLoss: usd,
      usdGain: usd,
      myrLoss: myr,
      myrGain: myr,
      jpyLoss: jpy,
      jpyGain: jpy,
      rmbLoss: rmb,
      rmbGain: rmb,
    };
  }

  async getCurrentUsdRate(): Promise<number> {
    const usdRateStr = await this.settingsService.getSetting(
      'usd_exchange_rate',
      '25920',
    );
    return parseFloat(usdRateStr) || 25920;
  }

  async saveUsdRate(rate: number): Promise<void> {
    const current = await this.getCurrentUsdRate();
    if (current !== rate) {
      this.logger.log(
        `Tỷ giá mới (${rate}) khác tỷ giá hiện tại (${current}). Đang cập nhật vào cấu hình...`,
      );
      await this.settingsService.setSetting(
        'usd_exchange_rate',
        rate.toString(),
      );
    }
  }

  /**
   * Tổng hợp dữ liệu hiển thị toàn diện cho Màn hình Trading Operation Console
   * Gom dữ liệu mới nhất từ bot_jobs (CHECK_KLGD, CHECK_PRE_EOD, SCAN_NEGATIVE_MARGIN)
   */
  async getConsoleSummary(dateStr?: string): Promise<any> {
    const today = new Date();
    let targetDate = dateStr;
    if (!targetDate) {
      const vnTime = new Date(today.getTime() + 7 * 3600 * 1000);
      targetDate = vnTime.toISOString().split('T')[0];
    }

    const parts = targetDate.split('-');
    const [y, m, d] = parts.length === 3 ? parts : ['', '', ''];
    const slashDate = parts.length === 3 ? `${d}/${m}/${y}` : targetDate;

    // 1. Tìm ca trực: Nếu người dùng chọn xem ngày cụ thể -> chỉ tìm theo ngày đó; Nếu mặc định -> ưu tiên ca ACTIVE
    let shiftLog = null;
    let taskKlgd = null;
    let taskPreEod = null;
    if (this.shiftLogModel) {
      const shiftQuery = dateStr
        ? {
            $or: [
              { shiftDate: targetDate },
              { shiftDate: slashDate },
            ],
          }
        : {
            $or: [
              { status: 'ACTIVE' },
              { shiftDate: targetDate },
              { shiftDate: slashDate },
            ],
          };

      shiftLog = await this.shiftLogModel
        .findOne(shiftQuery)
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      if (shiftLog && shiftLog.details) {
        const { subTask: subKlgd, parentTask: parentKlgd } = findBotTasksInShift(
          shiftLog.details,
          'CHECK_KLGD',
        );
        taskKlgd = subKlgd || parentKlgd;

        const { subTask: subPreEod, parentTask: parentPreEod } = findBotTasksInShift(
          shiftLog.details,
          'CHECK_PRE_EOD',
        );
        taskPreEod = subPreEod || parentPreEod;
      }
    }

    // 2. Lấy 4 job mới nhất từ collection bot_jobs (Bao gồm cả CHECK_CQG_SYNC độc lập)
    let klgdJob: any = null;
    let preEodJob: any = null;
    let marginJob: any = null;
    let cqgSyncJob: any = null;
    let ccpDownloadJob: any = null;
    let ccpCheckJob: any = null;

    if (this.botJobModel) {
      [klgdJob, preEodJob, marginJob, cqgSyncJob, ccpDownloadJob, ccpCheckJob] = await Promise.all([
        this.botJobModel
          .findOne({ jobType: 'CHECK_KLGD' })
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
        this.botJobModel
          .findOne({ jobType: 'CHECK_PRE_EOD' })
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
        this.botJobModel
          .findOne({
            jobType: {
              $in: [
                'SCAN_NEGATIVE_MARGIN',
                'CHECK_MARGIN_DECISION',
                'CHECK_EOD_MM',
              ],
            },
          })
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
        this.botJobModel
          .findOne({ jobType: 'CHECK_CQG_SYNC' })
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
        this.botJobModel
          .findOne({ jobType: 'DOWNLOAD_CCP_REPORT' })
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
        this.botJobModel
          .findOne({ jobType: 'CHECK_EOD_CCP' })
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
      ]);
    }

    // 3. Xử lý Payload KLGD
    const klgdPayload = klgdJob?.payload || {};
    const klgdResult = klgdPayload.result || {};
    const klgdTotals = klgdResult.totals || {
      totalDSGD: 0,
      totalFR: 0,
      differ: 0,
      totalACM: 0,
      totalNano: 0,
      differACM: 0,
      totalTTM: 0,
      totalTTM_MS: 0,
      totalOP: 0,
      totalTTM_CQG: 0,
      totalACM_TTM: 0,
      totalTTM_ACM: 0,
      differTTM: 0,
      totalTTTT: 0,
      totalTTTT_MS: 0,
      totalPS: 0,
      totalPS_CQG: 0,
      totalACM_TTTT: 0,
      totalTTTT_ACM: 0,
      differTTTT: 0,
    };

    // 4. Xử lý Payload Pre-EOD
    const preEodPayload = preEodJob?.payload || {};
    const preEodResult = preEodPayload.result || {};
    const preEodTotals = preEodResult.totals || {
      totalACM_MS: 0,
      totalACM_Straits: 0,
      differACM: 0,
      totalCQG_MS: 0,
      totalCQG_FR: 0,
      differCQG: 0,
    };

    // 5. Xử lý Payload Margin
    const marginPayload = marginJob?.payload || {};
    const marginResult = marginPayload.result || {};

    const rawNegativeIMR: string[] =
      marginResult.negativeIMRAcc && marginResult.negativeIMRAcc.length > 0
        ? marginResult.negativeIMRAcc
        : marginResult.eodResult?.negativeIMRAcc && marginResult.eodResult.negativeIMRAcc.length > 0
          ? marginResult.eodResult.negativeIMRAcc
          : preEodResult.eodResult?.negativeIMRAcc || [];

    const rawNegativeBalance: string[] =
      marginResult.negativeBalanceAccs && marginResult.negativeBalanceAccs.length > 0
        ? marginResult.negativeBalanceAccs
        : marginResult.eodResult?.negativeBalanceAccs && marginResult.eodResult.negativeBalanceAccs.length > 0
          ? marginResult.eodResult.negativeBalanceAccs
          : preEodResult.eodResult?.negativeBalanceAccs || [];

    // 6. Tính toán đếm ngược chu kỳ 60 phút
    const frequencyMinutes = taskKlgd?.frequencyMinutesSnapshot || 60;
    const lastCheckedTime =
      taskKlgd?.checkedAt || taskKlgd?.updatedAt || klgdJob?.createdAt;
    let nextScanInSeconds = 0;
    if (lastCheckedTime) {
      const elapsedSeconds = Math.floor(
        (Date.now() - new Date(lastCheckedTime).getTime()) / 1000,
      );
      const totalFrequencySeconds = frequencyMinutes * 60;
      nextScanInSeconds = Math.max(0, totalFrequencySeconds - elapsedSeconds);
    } else {
      nextScanInSeconds = frequencyMinutes * 60;
    }

    // 7. Quét thư mục và file CCP của ngày đang chọn
    const rawCcpBase = await this.settingsService.getSetting(
      'bot_backup_path_ccp',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
    );
    const ccpBackupBase = resolveStoragePathCrossPlatform(rawCcpBase);
    const subFolder = path.join(y, `T${m}.${y}`, `${d}.${m}`);
    let ccpDailyPath = path.join(ccpBackupBase, subFolder);
    if (!fs.existsSync(ccpDailyPath)) {
      const localBackup = path.join(process.cwd(), 'backupCCP');
      const localDaily = path.join(localBackup, subFolder);
      if (fs.existsSync(localDaily)) {
        ccpDailyPath = localDaily;
      } else if (fs.existsSync(localBackup)) {
        ccpDailyPath = localBackup;
      }
    }
    const ccpFilesPresent = {
      qltkgd: false,
      qltkgdName: '',
      qltkgdSize: 0,
      eod: false,
      eodName: '',
      eodSize: 0,
      nr: false,
      nrName: '',
      nrSize: 0,
      tttt: false,
      ttttName: '',
      ttttSize: 0,
    };

    if (fs.existsSync(ccpDailyPath)) {
      const qltkgdFile = this.findLatestFile(ccpDailyPath, /qltkgd|qltttkgd/i);
      const eodFile = this.findLatestFile(ccpDailyPath, /eod/i);
      const nrFile = this.findLatestFile(ccpDailyPath, /nr/i);
      const ttttFile = this.findLatestFile(ccpDailyPath, /tttt/i);

      if (qltkgdFile && fs.existsSync(qltkgdFile)) {
        try {
          const stat = fs.statSync(qltkgdFile);
          ccpFilesPresent.qltkgd = true;
          ccpFilesPresent.qltkgdName = path.basename(qltkgdFile);
          ccpFilesPresent.qltkgdSize = stat.size;
        } catch {}
      }
      if (eodFile && fs.existsSync(eodFile)) {
        try {
          const stat = fs.statSync(eodFile);
          ccpFilesPresent.eod = true;
          ccpFilesPresent.eodName = path.basename(eodFile);
          ccpFilesPresent.eodSize = stat.size;
        } catch {}
      }
      if (nrFile && fs.existsSync(nrFile)) {
        try {
          const stat = fs.statSync(nrFile);
          ccpFilesPresent.nr = true;
          ccpFilesPresent.nrName = path.basename(nrFile);
          ccpFilesPresent.nrSize = stat.size;
        } catch {}
      }
      if (ttttFile && fs.existsSync(ttttFile)) {
        try {
          const stat = fs.statSync(ttttFile);
          ccpFilesPresent.tttt = true;
          ccpFilesPresent.ttttName = path.basename(ttttFile);
          ccpFilesPresent.ttttSize = stat.size;
        } catch {}
      }
    }

    const ccpCheckResult = ccpCheckJob?.payload?.result || {};
    const ccpMismatchedAccounts = ccpCheckResult?.mismatchedEOD || [];

    return {
      success: true,
      date: targetDate,
      serverTime: new Date().toISOString(),
      shiftInfo: {
        shiftLogId: shiftLog?._id?.toString(),
        shiftDate: shiftLog?.shiftDate || slashDate,
        shiftName: shiftLog?.shiftSlotSnapshot?.name || 'Ca Trực Đang Hoạt Động',
        status: shiftLog?.status || 'UNKNOWN',
        taskKlgdStatus: taskKlgd?.status || 'PENDING',
        taskPreEodStatus: taskPreEod?.status || 'PENDING',
        frequencyMinutes,
        lastCheckedAt: lastCheckedTime
          ? new Date(lastCheckedTime).toISOString()
          : null,
        nextScanInSeconds,
      },
      botStatus: {
        isOnline: true,
        klgdJobStatus: klgdJob?.status || 'IDLE',
        preEodJobStatus: preEodJob?.status || 'IDLE',
      },
      klgd: {
        jobId: klgdJob?._id?.toString(),
        executedAt: klgdJob?.createdAt
          ? new Date(klgdJob.createdAt).toISOString()
          : null,
        status: klgdJob?.status || 'IDLE',
        error: klgdJob?.error || null,
        logs: klgdJob?.logs || [],
        isWaitingFiles: !!klgdResult.isWaitingFiles,
        waitingMessage: klgdResult.message,
        totals: klgdTotals,
        mismatchedTradesCount:
          klgdResult.mismatchedTradesTotal ||
          (klgdResult.mismatchedTrades || []).length,
        mismatchedTradesTotal:
          klgdResult.mismatchedTradesTotal ||
          (klgdResult.mismatchedTrades || []).length,
        mismatchedTrades: klgdResult.mismatchedTrades || [],
        mismatchedTTMCount: (klgdResult.mismatchedTTM || []).length,
        mismatchedTTM: klgdResult.mismatchedTTM || [],
        mismatchedTTTTCount: (klgdResult.mismatchedTTTT || []).length,
        mismatchedTTTT: klgdResult.mismatchedTTTT || [],
        sessionStart: klgdResult.sessionStart,
        checkTime: klgdResult.checkTime,
      },
      preEod: {
        jobId: preEodJob?._id?.toString(),
        executedAt: preEodJob?.createdAt
          ? new Date(preEodJob.createdAt).toISOString()
          : null,
        status: preEodJob?.status || 'IDLE',
        error: preEodJob?.error || null,
        logs: preEodJob?.logs || [],
        isWaitingFiles: !!preEodResult.isWaitingFiles,
        passed: preEodResult.passed !== false,
        totals: preEodTotals,
        mismatchedTradesCount:
          preEodResult.mismatchedTradesTotal ||
          (preEodResult.mismatchedTrades || []).length,
        mismatchedTradesTotal:
          preEodResult.mismatchedTradesTotal ||
          (preEodResult.mismatchedTrades || []).length,
        mismatchedTrades: preEodResult.mismatchedTrades || [],
        mismatchedPositionsCount:
          preEodResult.mismatchedPositionsTotal ||
          (preEodResult.mismatchedPositions || []).length,
        mismatchedPositionsTotal:
          preEodResult.mismatchedPositionsTotal ||
          (preEodResult.mismatchedPositions || []).length,
        mismatchedPositions: preEodResult.mismatchedPositions || [],
        mismatchedEODCount: (
          marginResult.eodResult?.mismatchedEOD ||
          marginResult.mismatchedEOD ||
          preEodResult.eodResult?.mismatchedEOD ||
          preEodResult.mismatchedEOD ||
          []
        ).length,
        mismatchedEOD:
          marginResult.eodResult?.mismatchedEOD ||
          marginResult.mismatchedEOD ||
          preEodResult.eodResult?.mismatchedEOD ||
          preEodResult.mismatchedEOD ||
          [],
        cqgResultCount: (
          cqgSyncJob?.payload?.result?.cqgResult ||
          marginResult.cqgResult ||
          preEodResult.cqgResult ||
          []
        ).length,
        cqgResult:
          cqgSyncJob?.payload?.result?.cqgResult ||
          marginResult.cqgResult ||
          preEodResult.cqgResult ||
          [],
      },
      negativeMargin: {
        jobId: marginJob?._id?.toString() || preEodJob?._id?.toString(),
        executedAt: (marginJob?.createdAt || preEodJob?.createdAt)
          ? new Date(marginJob?.createdAt || preEodJob?.createdAt).toISOString()
          : null,
        negativeIMRAccCount: rawNegativeIMR.length,
        negativeIMRAcc: rawNegativeIMR,
        negativeBalanceCount: rawNegativeBalance.length,
        negativeBalanceAccs: rawNegativeBalance,
      },
      ccpSummary: {
        downloadJob: {
          jobId: ccpDownloadJob?._id?.toString(),
          status: ccpDownloadJob?.status || 'IDLE',
          logs: ccpDownloadJob?.logs || [],
          executedAt: ccpDownloadJob?.createdAt
            ? new Date(ccpDownloadJob.createdAt).toISOString()
            : null,
        },
        checkJob: {
          jobId: ccpCheckJob?._id?.toString(),
          status: ccpCheckJob?.status || 'IDLE',
          logs: ccpCheckJob?.logs || [],
          executedAt: ccpCheckJob?.createdAt
            ? new Date(ccpCheckJob.createdAt).toISOString()
            : null,
        },
        filesPresent: ccpFilesPresent,
        folderPath: ccpDailyPath,
        totals: {
          totalAccounts: ccpCheckResult?.totalAccounts || 0,
          totalNegative:
            (ccpCheckResult?.negativeBalanceAccs?.length || 0) +
            (ccpCheckResult?.negativeIMRAcc?.length || 0),
          totalMismatched: ccpMismatchedAccounts.length,
        },
        mismatchedAccounts: ccpMismatchedAccounts,
        negativeBalanceAccs: ccpCheckResult?.negativeBalanceAccs || [],
        negativeIMRAcc: ccpCheckResult?.negativeIMRAcc || [],
      },
    };
  }

  /**
   * Kích hoạt chạy lại đối chiếu ngay lập tức (Phá vỡ Cooldown 60 phút)
   */
  async triggerConsoleRun(
    dateStr?: string,
    jobType: string = 'CHECK_KLGD',
    options?: {
      checkKlgd?: boolean;
      checkTtm?: boolean;
      checkTttt?: boolean;
    },
  ): Promise<any> {
    if (!this.shiftLogModel || !this.botJobQueueService || !this.shiftsService) {
      throw new Error('Các phân hệ bot queue hoặc shift log chưa sẵn sàng');
    }

    let targetDate = dateStr;
    if (!targetDate) {
      const today = new Date();
      const vnTime = new Date(today.getTime() + 7 * 60 * 60 * 1000);
      targetDate = vnTime.toISOString().split('T')[0];
    }

    const parts = targetDate.split('-');
    const [y, m, d] = parts.length === 3 ? parts : ['', '', ''];
    const slashDate = parts.length === 3 ? `${d}/${m}/${y}` : targetDate;

    // Tìm ca trực: Nếu người dùng chọn ngày cụ thể -> tìm đúng ca của ngày đó; Nếu mặc định -> ưu tiên ca ACTIVE
    const shiftQuery = dateStr
      ? {
          $or: [
            { shiftDate: targetDate, status: { $in: ['ACTIVE', 'PENDING'] } },
            { shiftDate: slashDate, status: { $in: ['ACTIVE', 'PENDING'] } },
            { shiftDate: targetDate },
            { shiftDate: slashDate },
          ],
        }
      : {
          $or: [
            { status: 'ACTIVE' },
            { shiftDate: targetDate, status: { $in: ['ACTIVE', 'PENDING'] } },
            { shiftDate: slashDate, status: { $in: ['ACTIVE', 'PENDING'] } },
            { shiftDate: targetDate },
            { shiftDate: slashDate },
          ],
        };

    const targetShift = await this.shiftLogModel
      .findOne(shiftQuery)
      .sort({ createdAt: -1 })
      .exec();

    const targetJobType = (jobType === 'CHECK_CQG_SYNC')
      ? 'CHECK_CQG_SYNC'
      : (jobType === 'CHECK_EOD_CCP')
        ? 'CHECK_EOD_CCP'
        : (jobType === 'SCAN_NEGATIVE_MARGIN' || jobType === 'CHECK_EOD_MM')
          ? 'CHECK_EOD_MM'
          : (jobType || 'CHECK_KLGD');

    const { subTask, parentTask } = findBotTasksInShift(
      targetShift?.details || [],
      targetJobType,
    );

    const targetTaskId =
      subTask?.taskId ||
      parentTask?.taskId ||
      BOT_TASK_REGISTRY[targetJobType]?.subTaskIdPattern ||
      'TASK_CHECK_KLGD_s1';

    const systemUser = {
      id: '000000000000000000000000',
      fullName: 'Maker (Thao tác nhanh Console)',
      username: 'maker_console',
      role: 'ADMIN',
    };

    // 1. Nếu có ca trực, reset trạng thái task về PENDING (cả task con và task cha)
    if (targetShift) {
      try {
        if (subTask) {
          await this.shiftsService.updateTaskStatus(
            targetShift._id.toString(),
            subTask.taskId,
            'PENDING',
            systemUser,
            `[Maker] Kích hoạt chạy lại ${targetJobType} từ Trading Operation Console`,
            true,
          );
        }
        if (parentTask && parentTask.taskId !== subTask?.taskId) {
          await this.shiftsService.updateTaskStatus(
            targetShift._id.toString(),
            parentTask.taskId,
            'PENDING',
            systemUser,
            `[Maker] Kích hoạt chạy lại ${targetJobType} từ Trading Operation Console`,
            true,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `Không thể cập nhật trạng thái task trong ca trực: ${err.message}`,
        );
      }
    }

    // 2. Enqueue job trực tiếp vào Bot Job Queue
    const job = await this.botJobQueueService.enqueue(targetJobType, {
      taskId: targetTaskId,
      shiftLogId: targetShift ? targetShift._id.toString() : null,
      sessionDay: targetShift?.shiftDate || targetDate,
      options,
    });

    return {
      success: true,
      message: `Đã kích hoạt job ${targetJobType} thành công! Hệ thống đang tiến hành đối chiếu.`,
      jobId: job?._id?.toString(),
    };
  }

  /**
   * Kiểm tra ký quỹ TKGD (IMR 4 nhóm vi phạm)
   * Port 1:1 chuẩn xác từ C# BackupService.CheckIMR() & FIleUtils.GetIMRData()
   */
  async checkImr(sessionDateStr?: string) {
    const tradingDate = sessionDateStr ? new Date(sessionDateStr) : new Date();
    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const formattedDate = `${day}/${month}/${year}`;

    const msBackupBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    ));
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const msDailyPath = path.join(msBackupBase, subFolder);

    const ttmPath = this.findLatestFile(msDailyPath, /^TTM.*\.xlsx$/i) || path.join(msDailyPath, 'TTM.xlsx');
    const dslckPath = this.findLatestFile(msDailyPath, /^DSLCK.*\.xlsx$/i) || path.join(msDailyPath, 'DSLCK.xlsx');
    const qltkgdPath = this.findLatestFile(msDailyPath, /^QLTKGD.*\.xlsx$/i) || path.join(msDailyPath, 'QLTKGD.xlsx');

    const filesFound = {
      ttm: fs.existsSync(ttmPath),
      dslck: fs.existsSync(dslckPath),
      qltkgd: fs.existsSync(qltkgdPath),
    };

    if (!filesFound.qltkgd) {
      return {
        sessionDate: formattedDate,
        success: false,
        message: `Không tìm thấy file QLTKGD.xlsx tại ${msDailyPath}. Vui lòng chạy Backup MS trước.`,
        filesFound,
        summary: { group1Count: 0, group2Count: 0, group3Count: 0, group4Count: 0 },
        results: { group1: [], group2: [], group3: [], group4: [] },
      };
    }

    // 1. Đọc danh sách tài khoản có TTM
    const ttmSet = new Set<string>();
    if (filesFound.ttm) {
      try {
        const wb = XLSX.readFile(ttmPath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length > 1) {
          const headerRow = rows[0].map((c) => String(c || '').trim().toLowerCase());
          const accIdx = headerRow.findIndex((c) => c === 'mã tkgd' || c.includes('mã tk') || c.includes('account'));
          if (accIdx !== -1) {
            for (let r = 1; r < rows.length; r++) {
              const acc = String(rows[r]?.[accIdx] || '').trim();
              if (acc) ttmSet.add(acc);
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi đọc file TTM.xlsx: ${err.message}`);
      }
    }

    // 2. Đọc danh sách tài khoản có lệnh chờ khớp (DSLCK)
    const dslckSet = new Set<string>();
    if (filesFound.dslck) {
      try {
        const wb = XLSX.readFile(dslckPath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length > 1) {
          const headerRow = rows[0].map((c) => String(c || '').trim().toLowerCase());
          const accIdx = headerRow.findIndex((c) => c === 'mã tkgd' || c.includes('mã tk') || c.includes('account'));
          if (accIdx !== -1) {
            for (let r = 1; r < rows.length; r++) {
              const acc = String(rows[r]?.[accIdx] || '').trim();
              if (acc) dslckSet.add(acc);
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi đọc file DSLCK.xlsx: ${err.message}`);
      }
    }

    // 3. Đọc dữ liệu QLTKGD và phân loại 4 nhóm
    const group1: string[] = [];
    const group2: string[] = [];
    const group3: string[] = [];
    const group4: string[] = [];

    try {
      const wb = XLSX.readFile(qltkgdPath);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length > 1) {
        const headerRow = rows[0].map((c) => String(c || '').trim().toLowerCase());
        const maTKGDIdx = headerRow.findIndex((c) => c === 'mã tkgd' || c.includes('mã tk'));
        const laiLoFuturesIdx = headerRow.findIndex((c) => c.includes('lãi lỗ dự kiến futures'));
        const laiLoOptionsIdx = headerRow.findIndex((c) => c.includes('lãi lỗ dự kiến options'));
        const kyQuyTamTinhIdx = headerRow.findIndex((c) => c.includes('ký quỹ ban đầu yêu cầu tạm tính') || c.includes('kqyctt') || c.includes('kqtt'));
        const kyQuyYeuCauIdx = headerRow.findIndex((c) => c.includes('ký quỹ ban đầu yêu cầu') && !c.includes('tạm tính'));
        const kyQuyKhaDungIdx = headerRow.findIndex((c) => c.includes('ký quỹ khả dụng') && !c.includes('tạm tính'));
        const kyQuyKhaDungTamTinhIdx = headerRow.findIndex((c) => c.includes('ký quỹ khả dụng tạm tính') || c.includes('kqkdtt'));

        const parseNum = (val: any): number => {
          if (val === undefined || val === null) return 0;
          if (typeof val === 'number') return val;
          const s = String(val).replace(/,/g, '').trim();
          const n = parseFloat(s);
          return isNaN(n) ? 0 : n;
        };

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const maTKGD = String(row[maTKGDIdx] || '').trim();
          if (!maTKGD) continue;

          const laiLoFutures = parseNum(row[laiLoFuturesIdx]);
          const laiLoOptions = parseNum(row[laiLoOptionsIdx]);
          const kyQuyTamTinh = parseNum(row[kyQuyTamTinhIdx]);
          const kyQuyYeuCau = parseNum(row[kyQuyYeuCauIdx]);
          const kyQuyKhaDung = parseNum(row[kyQuyKhaDungIdx]);
          const kyQuyKhaDungTamTinh = parseNum(row[kyQuyKhaDungTamTinhIdx]);

          // Nhóm 1: Có lãi lỗ dự kiến nhưng không có TTM
          if ((laiLoFutures !== 0 || laiLoOptions !== 0) && !ttmSet.has(maTKGD)) {
            group1.push(maTKGD);
          }

          // Nhóm 2: Không có TTM và lệnh chờ nhưng có KQTT
          if (kyQuyTamTinh !== 0 && !ttmSet.has(maTKGD) && !dslckSet.has(maTKGD)) {
            group2.push(maTKGD);
          }

          // Nhóm 3: TKGD có TTM, không có lệnh chờ nhưng KQYCTT != KQYC
          if (kyQuyTamTinh !== kyQuyYeuCau && ttmSet.has(maTKGD) && !dslckSet.has(maTKGD)) {
            group3.push(maTKGD);
          }

          // Nhóm 4: TK không có lệnh chờ nhưng KQKĐTT != KQKĐ
          if (kyQuyKhaDung !== kyQuyKhaDungTamTinh && !dslckSet.has(maTKGD)) {
            group4.push(maTKGD);
          }
        }
      }

      return {
        sessionDate: formattedDate,
        success: true,
        filesFound,
        summary: {
          group1Count: group1.length,
          group2Count: group2.length,
          group3Count: group3.length,
          group4Count: group4.length,
        },
        results: {
          group1,
          group2,
          group3,
          group4,
        },
      };
    } catch (err: any) {
      this.logger.error(`Lỗi khi phân tích QLTKGD.xlsx: ${err.message}`, err.stack);
      return {
        sessionDate: formattedDate,
        success: false,
        message: `Lỗi khi đọc file QLTKGD.xlsx: ${err.message}`,
        filesFound,
        summary: { group1Count: 0, group2Count: 0, group3Count: 0, group4Count: 0 },
        results: { group1: [], group2: [], group3: [], group4: [] },
      };
    }
  }

  /**
   * Tải riêng 3 file CoreCCP (DSGD, TTM, TTTT) và bóc tách lấy ra các chỉ số KLGD, TTM, TTTT hiện tại.
   * Chỉ chạy độc lập cho CoreCCP mà không ảnh hưởng tới luồng M-System, CQG hay ACM.
   */
  async downloadAndExtractCcpMetrics(dateStr?: string): Promise<{
    success: boolean;
    tradingDate: string;
    metrics: {
      klgd: number;
      ttm: number;
      tttt: number;
    };
    files: {
      dsgd?: string;
      ttm?: string;
      tttt?: string;
    };
    error?: string;
  }> {
    if (!this.ccpCeDownloaderService) {
      throw new Error('CcpCeDownloaderService chưa sẵn sàng trong hệ thống');
    }

    let tradingDate = new Date();
    if (dateStr) {
      if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        tradingDate = new Date(`${y}-${m}-${d}`);
      } else if (dateStr.includes('-')) {
        tradingDate = new Date(dateStr);
      }
    }

    const day = String(tradingDate.getDate()).padStart(2, '0');
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const year = tradingDate.getFullYear().toString();
    const formattedDate = `${day}/${month}/${year}`;

    // Lấy thông tin đăng nhập CoreCCP từ settings DB
    const credRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
    if (!credRaw) {
      throw new Error('Chưa cấu hình tài khoản CoreCCP (bot_credentials_ccp) trong System Settings');
    }

    let creds: any;
    try {
      creds = JSON.parse(decrypt(credRaw));
    } catch {
      creds = JSON.parse(credRaw);
    }

    const rawCcpBase = await this.settingsService.getSetting(
      'bot_backup_path_ccp',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
    );
    const ccpBackupBase = resolveStoragePathCrossPlatform(rawCcpBase);
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    let ccpDailyPath = path.join(ccpBackupBase, subFolder);

    try {
      if (!fs.existsSync(ccpDailyPath)) {
        fs.mkdirSync(ccpDailyPath, { recursive: true });
      }
    } catch {
      ccpDailyPath = path.join(process.cwd(), 'backupCCP', subFolder);
      if (!fs.existsSync(ccpDailyPath)) {
        fs.mkdirSync(ccpDailyPath, { recursive: true });
      }
    }

    this.logger.log(`[CCP Metrics] Bắt đầu tải riêng 3 file CoreCCP ngày ${formattedDate} vào: ${ccpDailyPath}`);

    return this.ccpCeDownloaderService.downloadAndExtractKlgdMetrics({
      systemUrl: creds.url,
      username: creds.username,
      password: creds.password,
      tradingDate: formattedDate,
      outputDir: ccpDailyPath,
      options: { headless: true },
    });
  }
}


