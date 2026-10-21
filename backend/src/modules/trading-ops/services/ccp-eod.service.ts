import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { MarginExcelParser } from '../parsers';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { ValueStatisticsService } from './value-statistics.service';
import { TelegramService } from '../../telegram/telegram.service';
import { WorkingCalendarService } from '../../working-calendar/working-calendar.service';
import {
  findHeaderIndex,
  findLatestFile,
  getCcpBackupBasePath,
  resolveCcpDailyPath,
  resolveTradingCheckCcpDailyPath,
} from '../../../shared';

export interface EODMismatchedItem {
  system?: 'MS' | 'CCP';
  maTKGD: string;
  calculatedBalance: number;
  eodBalance: number;
  differ: number;
}

export interface CcpEodCheckResult {
  negativeIMRAcc: string[];
  negativeBalanceAccs: string[];
  mismatchedEOD: EODMismatchedItem[];
}

export interface CcpAutoEodResult {
  totalAccounts: number;
  mismatchedEOD: EODMismatchedItem[];
  negativeBalanceAccs: string[];
  negativeIMRAcc: string[];
  sessionInfo?: {
    shiftSessionDate: string;
    eodSessionDate: string;
  };
  filesUsed: {
    qltkgd: string;
    eod: string;
    tttt: string | null;
    nr: string | null;
  };
}

@Injectable()
export class CcpEodService {
  private readonly logger = new Logger(CcpEodService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly valueStatisticsService: ValueStatisticsService,
    @Optional()
    private readonly telegramService?: TelegramService,
    @Optional()
    private readonly workingCalendarService?: WorkingCalendarService,
  ) {}

  /**
   * Tính ngày phiên giao dịch T-1 có kiểm tra Lịch Giao Dịch & Nghỉ Lễ/Tết (Working Calendar).
   */
  public async getPreviousTradingSession(inputDate?: Date | string): Promise<{
    dateObj: Date;
    day: string;
    month: string;
    year: string;
    dateFormatted: string;
    ymd: string;
  }> {
    const d = inputDate ? new Date(inputDate) : new Date();
    d.setDate(d.getDate() - 1);

    // Lặp lùi tối đa 15 ngày để tìm ngày giao dịch hợp lệ gần nhất (bao quát các kỳ nghỉ lễ/Tết dài ngày)
    for (let i = 0; i < 15; i++) {
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (!isWeekend) {
        let isHolidayOrNonTrading = false;
        if (this.workingCalendarService) {
          try {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dayStr = String(d.getDate()).padStart(2, '0');
            const ymd = `${y}-${m}-${dayStr}`;
            const cal = await this.workingCalendarService.validateDate(ymd);
            isHolidayOrNonTrading = Boolean(cal?.isHoliday || cal?.isTradingDay === false);
          } catch (err: any) {
            this.logger.warn(`Không thể tra cứu working calendar cho ngày ${d.toISOString()}: ${err.message}.`);
          }
        }
        if (!isHolidayOrNonTrading) {
          break; // Tìm thấy ngày phiên giao dịch hợp lệ gần nhất
        }
      }
      d.setDate(d.getDate() - 1);
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear().toString();
    const ymd = `${year}-${month}-${day}`;
    return {
      dateObj: d,
      day,
      month,
      year,
      dateFormatted: `${day}/${month}/${year}`,
      ymd,
    };
  }

  /**
   * Đối chiếu công thức EOD CoreCCP từ buffers
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
  ): Promise<CcpEodCheckResult> {
    const qltkgdRes = MarginExcelParser.parseQltkgd(files.qltkgdCcp, {
      fileName: files.qltkgdCcpName || 'QLTTTKGD_CCP.xlsx',
    });
    const negativeBalanceAccs: string[] = qltkgdRes.negativeBalanceAccs;

    const qltkgdWorkbook = XLSX.read(files.qltkgdCcp, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    const qltkgdRows = (qltkgdSheet ? XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 }) : []) as any[][];
    const qltkgdHeader = qltkgdRows.length > 0 ? qltkgdRows[0].map((h) => String(h || '').trim()) : [];
    const maTKGDIdx = findHeaderIndex(qltkgdHeader, 'Mã TKGD', [
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

    const negativeIMRAcc: string[] = [];
    const mismatchedEOD: EODMismatchedItem[] = [];

    const ttttFeeMap = new Map<string, number>();
    if (files.ttttCcp) {
      try {
        const ttttWorkbook = XLSX.read(files.ttttCcp, { type: 'buffer' });
        const ttttSheet = ttttWorkbook.Sheets[ttttWorkbook.SheetNames[0]];
        if (ttttSheet) {
          const ttttRows = XLSX.utils.sheet_to_json(ttttSheet, { header: 1 }) as any[][];
          if (ttttRows.length >= 2) {
            const ttttHeader = ttttRows[0].map((h) => String(h || '').trim());
            const ttttAccIdx = findHeaderIndex(ttttHeader, 'Mã TKGD', [
              'Mã tài khoản',
              'Mã tiểu khoản',
              'Số tiểu khoản',
              'Investor Code',
              'InvestorCode',
              'Account',
            ]);
            const ttttFeeIdx = findHeaderIndex(ttttHeader, 'Phí dịch vụ thanh toán', [
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

    if (files.eodCcp) {
      const eodRes = MarginExcelParser.parseEodMargin(files.eodCcp, {
          fileName: files.eodCcpName || 'EOD_CCP.xlsx',
        });
        const eodMap = eodRes.eodBalanceMap;
        negativeIMRAcc.push(...eodRes.negativeIMRAcc);

          if (eodMap.size > 0) {
            const dynamicRates = await this.valueStatisticsService.getCurrentExchangeRates();
            const effectiveRates = {
              usdLoss: exchangeRates?.usdLoss || dynamicRates.usdLoss,
              usdGain: exchangeRates?.usdGain || dynamicRates.usdGain,
              jpyLoss: exchangeRates?.jpyLoss || dynamicRates.jpyLoss,
              jpyGain: exchangeRates?.jpyGain || dynamicRates.jpyGain,
              myrLoss: exchangeRates?.myrLoss || dynamicRates.myrLoss,
              myrGain: exchangeRates?.myrGain || dynamicRates.myrGain,
            };

            const soDuDauNgayIdx = findHeaderIndex(qltkgdHeader, 'Số dư TKKQ đầu ngày', [
              'Số dư đầu ngày',
              'TKKQ đầu ngày',
              'Beginning Balance',
              'Start Balance',
            ]);
            const nopRutIdx = findHeaderIndex(qltkgdHeader, 'Nộp rút trong phiên', [
              'Nộp rút',
              'Net Deposit',
            ]);
            const phiGDIdx = findHeaderIndex(qltkgdHeader, 'Phí giao dịch', [
              'Phí GD',
              'Trade Fee',
            ]);
            const phiQCIdx = findHeaderIndex(qltkgdHeader, 'Phí quyền chọn', [
              'Phí QC',
              'Option Fee',
            ]);
            const laiLoVNDIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (VND)', [
              'Lãi lỗ thực tế (VND)',
              'Lãi lỗ Futures (VND)',
              'Lãi lỗ VND',
              'Lãi lỗ thực tế',
              'Realized PnL',
              'Lãi lỗ thực tế Future (VND)',
              'Lãi lỗ Future (VND)',
              'Lãi lỗ thực tế Future',
              'Lãi lỗ Future',
            ]);
            const laiLoUSDIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (USD)', [
              'Lãi lỗ USD',
              'Lãi/lỗ USD',
              'Lãi lỗ thực tế (USD)',
              'Lãi lỗ Futures (USD)',
              'Realized PnL USD',
              'Lãi lỗ thực tế Future (USD)',
              'Lãi lỗ Future (USD)',
            ]);
            const laiLoJPYIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ JPY', ['Lãi/lỗ JPY']);
            const laiLoMYRIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ MYR', ['Lãi/lỗ MYR']);
            const phiDVIdx = findHeaderIndex(qltkgdHeader, 'Phí dịch vụ thanh toán (VND)', [
              'Phí DV thanh toán',
              'Phí thanh toán',
              'Payment Fee',
              'Phí dịch vụ thanh toán',
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

    return {
      negativeIMRAcc,
      negativeBalanceAccs,
      mismatchedEOD,
    };
  }

  /**
   * Tự động quét file và chạy đối chiếu EOD CoreCCP
   * Mặc định tự động đối chiếu cho phiên T-1 (Working Day) nếu không có cờ isExplicitDate
   */
  async runAutoCheckEodCcp(
    tradingDate: Date,
    options?: { isExplicitDate?: boolean },
  ): Promise<CcpAutoEodResult> {
    let evalSession: {
      dateObj: Date;
      day: string;
      month: string;
      year: string;
      dateFormatted: string;
      ymd: string;
    };

    if (options?.isExplicitDate) {
      const d = tradingDate;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear().toString();
      evalSession = {
        dateObj: d,
        day,
        month,
        year,
        dateFormatted: `${day}/${month}/${year}`,
        ymd: `${year}-${month}-${day}`,
      };
    } else {
      evalSession = await this.getPreviousTradingSession(tradingDate);
    }

    const { day, month, year, dateFormatted, ymd } = evalSession;
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    this.logger.log(
      `[CcpEodService] 🚀 Thực thi đối chiếu EOD CoreCCP cho phiên chốt sổ T-1: ${dateFormatted} (Ngày ca trực: ${tradingDate.toISOString().split('T')[0]})`,
    );

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const checkDailyPath = resolveTradingCheckCcpDailyPath(subFolder, rawCcpBase);
    const backupDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    const candidateDirs = [checkDailyPath, backupDailyPath].filter(
      (d) => fs.existsSync(d) && fs.statSync(d).isDirectory(),
    );

    if (candidateDirs.length === 0) {
      throw new Error(
        `Thư mục dữ liệu phiên T-1 (${dateFormatted}) của CoreCCP không tồn tại: ${checkDailyPath} (hoặc ${backupDailyPath}). Vui lòng tải báo cáo trước.`,
      );
    }

    const findFileAcrossDirs = (regex: RegExp, preferBackup = false): string | null => {
      const dirs = preferBackup ? [backupDailyPath, checkDailyPath] : [checkDailyPath, backupDailyPath];
      for (const d of dirs) {
        if (fs.existsSync(d)) {
          const found = findLatestFile(d, regex);
          if (found && fs.existsSync(found)) return found;
        }
      }
      return null;
    };

    // 1. Tìm file QLTTTKGD cuối ngày (ưu tiên thư mục Backup ca trực chính thức)
    let qltkgdCcpFile = findFileAcrossDirs(
      /^(?!.*truoc.*4h20|.*truoc.*16h20).*ql[\s_]*t+[\s_]*t*k?gd/i,
      true,
    );
    if (!qltkgdCcpFile) {
      qltkgdCcpFile = findFileAcrossDirs(/ql[\s_]*t+[\s_]*t*k?gd|ql.*tt.*tkgd/i, true);
    }

    const eodCcpFile = findFileAcrossDirs(/eod/i, true);
    const ttttCcpFile = findFileAcrossDirs(/tttt/i);
    const nrCcpFile = findFileAcrossDirs(/nr/i);

    if (!qltkgdCcpFile || !fs.existsSync(qltkgdCcpFile)) {
      throw new Error(
        `Không tìm thấy file QLTTTKGD trong thư mục ${backupDailyPath} (hoặc ${checkDailyPath}) (Phiên T-1: ${dateFormatted})`,
      );
    }
    if (!eodCcpFile || !fs.existsSync(eodCcpFile)) {
      throw new Error(
        `Không tìm thấy file EOD trong thư mục ${backupDailyPath} (hoặc ${checkDailyPath}) (Phiên T-1: ${dateFormatted})`,
      );
    }

    const qltkgdCcpBuffer = fs.readFileSync(qltkgdCcpFile);
    const eodCcpBuffer = fs.readFileSync(eodCcpFile);
    const ttttCcpBuffer = ttttCcpFile && fs.existsSync(ttttCcpFile) ? fs.readFileSync(ttttCcpFile) : undefined;

    // Strict Date Assertion: Xác thực ngày phiên trong file EOD.xlsx khớp với ngày T-1
    try {
      const eodWb = XLSX.read(eodCcpBuffer, { type: 'buffer' });
      const eodSheet = eodWb.Sheets[eodWb.SheetNames[0]];
      const eodRows = XLSX.utils.sheet_to_json(eodSheet, { header: 1 }) as any[][];
      if (eodRows.length >= 2) {
        const header = eodRows[0].map((h: any) => String(h || '').trim());
        const dateIdx = header.findIndex((h: string) => /ngày|date/i.test(h));
        if (dateIdx !== -1 && eodRows[1] && eodRows[1][dateIdx]) {
          const fileDateStr = String(eodRows[1][dateIdx]).trim();
          const expectedDmy = dateFormatted;
          const expectedYmd = ymd;
          if (!fileDateStr.includes(expectedDmy) && !fileDateStr.includes(expectedYmd)) {
            throw new Error(
              `File EOD.xlsx hiện tại là dữ liệu của ngày (${fileDateStr}), không khớp với phiên chốt sổ T-1 (${expectedDmy}). Vui lòng tải báo cáo EOD của ngày ${expectedDmy}.`,
            );
          }
        }
      }
    } catch (e: any) {
      if (e.message && e.message.includes('không khớp với phiên chốt sổ T-1')) {
        throw e;
      }
    }

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

    let totalAccounts = 0;
    try {
      const eodWb = XLSX.read(eodCcpBuffer, { type: 'buffer' });
      const eodSheet = eodWb.Sheets[eodWb.SheetNames[0]];
      const eodRows: any[] = XLSX.utils.sheet_to_json(eodSheet, { header: 1 });
      totalAccounts = Math.max(0, eodRows.length - 1);
    } catch {}

    if (this.telegramService) {
      let telegramMsg = ` <b>[ĐỐI CHIẾU EOD CORECCP - PHIÊN T-1: ${dateFormatted}]</b>\n`;
      telegramMsg += `• Trạng thái: ${mismatchedCcp.length === 0 ? '✓ Khớp hoàn toàn công thức EOD CCP' : '<b>PHÁT HIỆN BẤT THƯỜNG</b>'}\n`;
      telegramMsg += `• Tổng số TK CoreCCP: <b>${totalAccounts}</b>\n`;
      telegramMsg += `• Tài khoản lệch công thức: <b>${mismatchedCcp.length}</b>\n`;
      telegramMsg += `• Tài khoản âm ký quỹ (IMR): <b>${negativeIMRAcc.length}</b>\n`;

      await this.telegramService.sendMessage(telegramMsg).catch(() => {});
    }

    return {
      totalAccounts,
      mismatchedEOD: mismatchedCcp,
      negativeBalanceAccs,
      negativeIMRAcc,
      sessionInfo: {
        shiftSessionDate: tradingDate.toISOString().split('T')[0],
        eodSessionDate: dateFormatted,
      },
      filesUsed: {
        qltkgd: path.basename(qltkgdCcpFile),
        eod: path.basename(eodCcpFile),
        tttt: ttttCcpFile ? path.basename(ttttCcpFile) : null,
        nr: nrCcpFile ? path.basename(nrCcpFile) : null,
      },
    };
  }
}
