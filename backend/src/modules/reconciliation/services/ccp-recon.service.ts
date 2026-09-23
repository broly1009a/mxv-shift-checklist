import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { TelegramService } from '../../telegram/telegram.service';
import { MarginCheckerService } from '../../margin-checker/margin-checker.service';
import { TeamsNotifierService } from '../../notifications/teams-notifier.service';
import { EmailWatcherService } from '../../bot-engine/email-watcher.service';
import { CcpCeDownloaderService } from '../../bot-engine/ccp-ce-downloader.service';
import { decrypt } from '../../bot-engine/utils/crypto';
import {
  findHeaderIndex,
  findLatestFile,
  getCcpBackupBasePath,
  resolveCcpDailyPath,
} from '../helpers/recon-number-parser.helper';

export interface EODMismatchedItem {
  system?: 'MS' | 'CCP';
  maTKGD: string;
  calculatedBalance: number;
  eodBalance: number;
  differ: number;
}

@Injectable()
export class CcpReconService {
  private readonly logger = new Logger(CcpReconService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly telegramService: TelegramService,
    @Optional()
    @Inject(forwardRef(() => CcpCeDownloaderService))
    private readonly ccpCeDownloaderService?: CcpCeDownloaderService,
    @Optional()
    private readonly marginCheckerService?: MarginCheckerService,
    @Optional()
    @Inject(forwardRef(() => EmailWatcherService))
    private readonly emailWatcherService?: EmailWatcherService,
    @Optional()
    private readonly teamsNotifierService?: TeamsNotifierService,
  ) {}

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
    // 1. Ưu tiên đọc ma trận đa nguyên tệ ccp_exchange_rates_matrix
    let matrix: Record<string, any> = {};
    try {
      const matrixStr = await this.settingsService.getSetting('ccp_exchange_rates_matrix', '');
      if (matrixStr) matrix = JSON.parse(matrixStr);
    } catch {
      matrix = {};
    }

    // 2. Đọc các setting đơn lẻ riêng của CoreCCP (fallback về M-System nếu chưa cấu hình)
    const [
      ccpUsdStr, usdStr,
      ccpMyrStr, myrStr,
      ccpJpyStr, jpyStr,
      ccpRmbStr, rmbStr,
    ] = await Promise.all([
      this.settingsService.getSetting('ccp_usd_exchange_rate', ''),
      this.settingsService.getSetting('usd_exchange_rate', '26000'),
      this.settingsService.getSetting('ccp_myr_exchange_rate', ''),
      this.settingsService.getSetting('myr_exchange_rate', '6383'),
      this.settingsService.getSetting('ccp_jpy_exchange_rate', ''),
      this.settingsService.getSetting('jpy_exchange_rate', '170'),
      this.settingsService.getSetting('ccp_rmb_exchange_rate', ''),
      this.settingsService.getSetting('rmb_exchange_rate', '3871'),
    ]);

    const getRate = (code: string, ccpFallback: string, msFallback: string, defVal: number) => {
      const item = matrix[code];
      const conv = item?.conversionRate ? Number(item.conversionRate) : (parseFloat(ccpFallback) || parseFloat(msFallback) || defVal);
      const buy = item?.buyRate ? Number(item.buyRate) : conv;
      const sell = item?.sellRate ? Number(item.sellRate) : conv;
      return { buy, sell, conv };
    };

    const usd = getRate('USD', ccpUsdStr, usdStr, 26000);
    const myr = getRate('MYR', ccpMyrStr, myrStr, 6383);
    const jpy = getRate('JPY', ccpJpyStr, jpyStr, 170);
    const rmb = getRate('RMB', ccpRmbStr, rmbStr, 3871);

    return {
      usdLoss: usd.buy,
      usdGain: usd.sell,
      myrLoss: myr.buy,
      myrGain: myr.sell,
      jpyLoss: jpy.buy,
      jpyGain: jpy.sell,
      rmbLoss: rmb.buy,
      rmbGain: rmb.sell,
    };
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

      const qltkgdHeader = qltkgdRows[0].map((h: any) => String(h || '').trim());
      const maTKGDIdx = findHeaderIndex(qltkgdHeader, 'Mã TKGD', [
        'Mã tài khoản',
        'Mã TK',
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
            const eodHeader = eodRows[0].map((h: any) => String(h || '').trim());
            const investorCodeIdx = findHeaderIndex(
              eodHeader,
              'InvestorCode',
              ['Investor Code', 'investor_code'],
            );
            const initialRequiredMarginIdx = findHeaderIndex(
              eodHeader,
              'InitialRequiredMargin',
              ['Initial Required Margin', 'initial_required_margin'],
            );
            const estimatedProfitVNDIdx = findHeaderIndex(
              eodHeader,
              'EstimatedProfitVND',
              ['Estimated Profit VND', 'estimated_profit_vnd'],
            );
            const optionsEstimatedProfitVNDIdx = findHeaderIndex(
              eodHeader,
              'OptionsEstimatedProfitVND',
              ['Options Estimated Profit VND', 'options_estimated_profit_vnd'],
            );
            const netMarginIdx = findHeaderIndex(eodHeader, 'NetMargin', [
              'Net Margin',
              'net_margin',
            ]);
            const availableMarginIdx = findHeaderIndex(
              eodHeader,
              'AvailableMargin',
              ['Available Margin', 'available_margin'],
            );
            const additionalMarginIdx = findHeaderIndex(
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

            const eodBalanceIdx = findHeaderIndex(eodHeader, 'eodBalance', [
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

            // Đối chiếu công thức QLTKGD vs EOD Balance MS (ngưỡng lệch >= 1000)
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

              const soDuDauNgayIdx = findHeaderIndex(qltkgdHeader, 'Số dư TKKQ đầu ngày', ['Số dư đầu ngày', 'TKKQ đầu ngày']);
              const nopRutIdx = findHeaderIndex(qltkgdHeader, 'Nộp rút trong phiên', ['Nộp rút']);
              const phiGDIdx = findHeaderIndex(qltkgdHeader, 'Phí giao dịch', ['Phí GD']);
              const phiQCIdx = findHeaderIndex(qltkgdHeader, 'Phí quyền chọn', ['Phí QC']);
              const laiLoVNDIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (VND)', ['Lãi lỗ thực tế (VND)', 'Lãi lỗ Futures (VND)', 'Lãi lỗ VND']);
              const laiLoUSDIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (USD)', ['Lãi lỗ USD', 'Lãi/lỗ USD', 'Lãi lỗ thực tế (USD)', 'Lãi lỗ Futures (USD)']);
              const laiLoJPYIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ JPY', ['Lãi/lỗ JPY']);
              const laiLoMYRIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ MYR', ['Lãi/lỗ MYR']);
              const phiDVIdx = findHeaderIndex(qltkgdHeader, 'Phí dịch vụ thanh toán (VND)', ['Phí DV thanh toán', 'Phí thanh toán', 'Payment Fee']);

              // Parse TTTT MS file nếu có để trích xuất phí DV thanh toán theo từng tài khoản
              const ttttFeeMap = new Map<string, number>();
              if (files.tttt) {
                try {
                  const ttttWorkbook = XLSX.read(files.tttt, { type: 'buffer' });
                  const ttttSheet = ttttWorkbook.Sheets[ttttWorkbook.SheetNames[0]];
                  if (ttttSheet) {
                    const ttttRows = XLSX.utils.sheet_to_json(ttttSheet, { header: 1 }) as any[][];
                    if (ttttRows.length >= 2) {
                      const ttttHeader = ttttRows[0].map((h: any) => String(h || '').trim());
                      const ttttAccIdx = findHeaderIndex(ttttHeader, 'Mã TKGD', [
                        'Mã tài khoản',
                        'Mã tiểu khoản',
                        'Số tiểu khoản',
                        'Investor Code',
                        'InvestorCode',
                        'Account',
                      ]);
                      const ttttFeeIdx = findHeaderIndex(ttttHeader, 'Phí dịch vụ thanh toán (VND)', [
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
      if (this.marginCheckerService) {
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
      }

      // Hook: check contract maturity notifications if tttt file is provided
      if (files.tttt && this.emailWatcherService && this.teamsNotifierService) {
        try {
          const email = await this.emailWatcherService.getLatestEmail(
            'Thông báo tất toán hợp đồng',
            'daonguyen@mxv.vn',
          );
          if (email) {
            const expiringContracts =
              this.teamsNotifierService.parseMaturityEmail(email.body);
            if (expiringContracts.length > 0 && files.qltkgd) {
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
            const dynamicRates = await this.getCurrentExchangeRates();
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
            ]);
            const laiLoUSDIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (USD)', [
              'Lãi lỗ USD',
              'Lãi/lỗ USD',
              'Lãi lỗ thực tế (USD)',
              'Lãi lỗ Futures (USD)',
              'Realized PnL USD',
            ]);
            const laiLoJPYIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ JPY', ['Lãi/lỗ JPY']);
            const laiLoMYRIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ MYR', ['Lãi/lỗ MYR']);
            const phiDVIdx = findHeaderIndex(qltkgdHeader, 'Phí dịch vụ thanh toán (VND)', [
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

  async runAutoCheckEodCcp(tradingDate: Date): Promise<any> {
    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const ccpDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    if (!fs.existsSync(ccpDailyPath)) {
      throw new Error(`Thư mục Backup CCP không tồn tại: ${ccpDailyPath}. Vui lòng tải báo cáo CCP trước.`);
    }

    const qltkgdCcpFile = findLatestFile(ccpDailyPath, /qltkgd|qltttkgd/i);
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

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    let ccpDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    try {
      if (!fs.existsSync(ccpDailyPath)) {
        fs.mkdirSync(ccpDailyPath, { recursive: true });
      }
    } catch {
      ccpDailyPath = path.join(process.cwd(), 'data', 'backup', 'ccp', 'futures', subFolder);
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