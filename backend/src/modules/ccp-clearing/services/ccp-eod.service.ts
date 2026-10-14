import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { ValueStatisticsService } from './value-statistics.service';
import { TelegramService } from '../../telegram/telegram.service';
import {
  findHeaderIndex,
  findLatestFile,
  getCcpBackupBasePath,
  resolveCcpDailyPath,
  resolveTradingCheckCcpDailyPath,
} from '../../reconciliation/helpers/recon-number-parser.helper';

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
  ) {}

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
    const qltkgdWorkbook = XLSX.read(files.qltkgdCcp, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet) {
      throw new Error('Không tìm thấy sheet nào trong file QLTTTKGD CCP');
    }
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 }) as any[][];
    if (qltkgdRows.length < 2) throw new Error('File QLTTTKGD CCP rỗng');

    const qltkgdHeader = qltkgdRows[0].map((h) => String(h || '').trim());
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
    const soDuTKKQHienTaiIdx = findHeaderIndex(
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
      const eodWorkbook = XLSX.read(files.eodCcp, { type: 'buffer' });
      const eodSheet = eodWorkbook.Sheets[eodWorkbook.SheetNames[0]];
      if (eodSheet) {
        const eodRows = XLSX.utils.sheet_to_json(eodSheet, { header: 1 }) as any[][];
        if (eodRows.length >= 2) {
          const eodHeader = eodRows[0].map((h) => String(h || '').trim());
          const investorCodeIdx = findHeaderIndex(eodHeader, 'InvestorCode', [
            'Investor Code',
            'investor_code',
            'Mã TKGD',
            'Mã tài khoản',
            'Mã tiểu khoản',
            'Số tiểu khoản',
            'Account',
            'Account Number',
          ]);
          const eodBalanceIdx = findHeaderIndex(eodHeader, 'eodBalance', [
            'EOD Balance',
            'EODBalance',
            'eod_balance',
            'Số dư cuối ngày',
            'Số dư EOD',
            'End Balance',
            'Ending Balance',
            'Balance',
          ]);

          const initialRequiredMarginIdx = findHeaderIndex(eodHeader, 'InitialRequiredMargin', [
            'Initial Required Margin',
            'initial_required_margin',
            'Ký quỹ ban đầu',
            'KQ ban đầu yêu cầu',
            'Ký quỹ ban đầu yêu cầu',
          ]);
          const availableMarginIdx = findHeaderIndex(eodHeader, 'AvailableMargin', [
            'Available Margin',
            'available_margin',
            'Ký quỹ khả dụng',
          ]);
          const netMarginIdx = findHeaderIndex(eodHeader, 'NetMargin', [
            'Net Margin',
            'net_margin',
            'Ký quỹ ròng',
            'Giá trị ròng ký quỹ',
          ]);
          const additionalMarginIdx = findHeaderIndex(eodHeader, 'AdditionalMargin', [
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
   */
  async runAutoCheckEodCcp(tradingDate: Date): Promise<CcpAutoEodResult> {
    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const checkDailyPath = resolveTradingCheckCcpDailyPath(subFolder, rawCcpBase);
    const backupDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    // Ưu tiên đọc từ thư mục kiểm tra riêng (TradingCheck/CCP), nếu chưa có mới fallback sang Backup ca trực
    const ccpDailyPath =
      fs.existsSync(checkDailyPath) && fs.readdirSync(checkDailyPath).length > 0
        ? checkDailyPath
        : backupDailyPath;

    if (!fs.existsSync(ccpDailyPath)) {
      throw new Error(
        `Thư mục dữ liệu CoreCCP không tồn tại: ${checkDailyPath} (hoặc ${backupDailyPath}). Vui lòng tải báo cáo trước.`,
      );
    }

    // 1. Tìm file QLTTTKGD cuối ngày (ưu tiên file chính thức, loại trừ các file tạm giữa ngày như 'truoc 4h20', 'truoc 16h20')
    let qltkgdCcpFile = findLatestFile(
      ccpDailyPath,
      /^(?!.*truoc.*4h20|.*truoc.*16h20).*ql[\s_]*t+[\s_]*t*k?gd/i,
    );
    if (!qltkgdCcpFile) {
      qltkgdCcpFile = findLatestFile(ccpDailyPath, /ql[\s_]*t+[\s_]*t*k?gd|ql.*tt.*tkgd/i);
    }

    const eodCcpFile = findLatestFile(ccpDailyPath, /eod/i);
    const ttttCcpFile = findLatestFile(ccpDailyPath, /tttt/i);
    const nrCcpFile = findLatestFile(ccpDailyPath, /nr/i);

    if (!qltkgdCcpFile || !fs.existsSync(qltkgdCcpFile)) {
      throw new Error(`Không tìm thấy file QLTTTKGD trong thư mục ${ccpDailyPath}`);
    }
    if (!eodCcpFile || !fs.existsSync(eodCcpFile)) {
      throw new Error(`Không tìm thấy file EOD trong thư mục ${ccpDailyPath}`);
    }

    const qltkgdCcpBuffer = fs.readFileSync(qltkgdCcpFile);
    const eodCcpBuffer = fs.readFileSync(eodCcpFile);
    const ttttCcpBuffer = ttttCcpFile && fs.existsSync(ttttCcpFile) ? fs.readFileSync(ttttCcpFile) : undefined;

    // Strict Date Assertion: Xác thực ngày phiên trong file EOD.xlsx
    try {
      const eodWb = XLSX.read(eodCcpBuffer, { type: 'buffer' });
      const eodSheet = eodWb.Sheets[eodWb.SheetNames[0]];
      const eodRows = XLSX.utils.sheet_to_json(eodSheet, { header: 1 }) as any[][];
      if (eodRows.length >= 2) {
        const header = eodRows[0].map((h: any) => String(h || '').trim());
        const dateIdx = header.findIndex((h: string) => /ngày|date/i.test(h));
        if (dateIdx !== -1 && eodRows[1] && eodRows[1][dateIdx]) {
          const fileDateStr = String(eodRows[1][dateIdx]).trim();
          const expectedDmy = `${day}/${month}/${year}`;
          const expectedYmd = `${year}-${month}-${day}`;
          if (!fileDateStr.includes(expectedDmy) && !fileDateStr.includes(expectedYmd)) {
            throw new Error(
              `File EOD.xlsx hiện tại là dữ liệu của ngày cũ (${fileDateStr}), CoreCCP chưa xuất kết quả chốt sổ EOD của ngày ${expectedDmy}. Vui lòng chạy đối chiếu sau khi kết thúc phiên giao dịch.`,
            );
          }
        }
      }
    } catch (e: any) {
      if (e.message && e.message.includes('chưa xuất kết quả chốt sổ EOD')) {
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
      let telegramMsg = ` <b>[ĐỐI CHIẾU EOD CORECCP - ${day}/${month}/${year}]</b>\n`;
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
      filesUsed: {
        qltkgd: path.basename(qltkgdCcpFile),
        eod: path.basename(eodCcpFile),
        tttt: ttttCcpFile ? path.basename(ttttCcpFile) : null,
        nr: nrCcpFile ? path.basename(nrCcpFile) : null,
      },
    };
  }
}
