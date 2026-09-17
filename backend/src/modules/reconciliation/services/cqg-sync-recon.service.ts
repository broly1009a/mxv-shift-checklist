import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { TelegramService } from '../../telegram/telegram.service';
import { MarginCheckerService } from '../../margin-checker/margin-checker.service';
import { resolveStoragePathCrossPlatform } from '../../bot-engine/helpers/bot-path.helper';
import {
  findHeaderIndex,
  parseCqgNumber,
  findLatestFile,
} from '../helpers/recon-number-parser.helper';
import { ReconConsoleSummaryService } from './recon-console-summary.service';

@Injectable()
export class CqgSyncReconService {
  private readonly logger = new Logger(CqgSyncReconService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly telegramService: TelegramService,
    private readonly marginCheckerService: MarginCheckerService,
    @Optional()
    @Inject(forwardRef(() => ReconConsoleSummaryService))
    private readonly reconConsoleSummaryService?: ReconConsoleSummaryService,
  ) {}

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
      if (this.reconConsoleSummaryService) {
        effectiveRate = await this.reconConsoleSummaryService.getCurrentUsdRate();
      } else {
        const usdRateStr = await this.settingsService.getSetting(
          'usd_exchange_rate',
          '25920',
        );
        effectiveRate = parseFloat(usdRateStr) || 25920;
      }
    }
    // 1. Parse QLTKGD.xlsx
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
    const laiLoChoDaoHanIdx = findHeaderIndex(
      qltkgdHeader,
      'Lãi lỗ thực tế chờ đáo hạn',
      [
        'Chờ đáo hạn',
        'Cho dao han',
        'Lai lo cho dao han',
        'Lãi lỗ chờ đáo hạn',
      ],
    );
    const laiLoThucTeFuturesVNDIdx = findHeaderIndex(
      qltkgdHeader,
      'Lãi lỗ thực tế Futures (VND)',
      [
        'Lãi lỗ thực tế Futures',
        'Lãi lỗ Futures',
        'Lai lo thuc te Futures',
        'Lai lo Futures',
      ],
    );
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
      const row: any = qltkgdRows[i];
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
    const asRows = XLSX.utils.sheet_to_json(asSheet, { header: 1 }) as any[][];
    if (asRows.length < 2) throw new Error('File Accounts_Balances.xlsx rỗng');

    const asHeader = asRows[0].map((h: any) => String(h || '').trim());
    const accountNumberIdx = findHeaderIndex(asHeader, 'Account Number', [
      'Account',
      'Tài khoản',
      'Mã TKGD',
      'Tai khoan',
    ]);
    const endCashBalanceIdx = findHeaderIndex(
      asHeader,
      'End Cash Balance',
      ['Cash Balance', 'Balance', 'Số dư', 'Số dư cuối ngày', 'So du'],
    );
    const recordDescriptionIdx = findHeaderIndex(
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
      const row: any = asRows[i];
      if (!row || row.length === 0) continue;

      const recordDescription =
        recordDescriptionIdx !== -1
          ? String(row[recordDescriptionIdx] || '').trim()
          : '';
      if (!recordDescription.startsWith('Current-day')) {
        continue;
      }

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
          effectiveRate,
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
        `${qltkgdName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${qltkgdHeader.slice(0, 15).join(', ')}...]`,
      );
    }

    const negativeBalanceAccs: string[] = [];
    const negativeRows: any[][] = [qltkgdRows[0]]; // Include the header as the first row

    for (let i = 1; i < qltkgdRows.length; i++) {
      const row: any = qltkgdRows[i];
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

          if (investorCodeIdx !== -1) {
            for (let i = 1; i < eodRows.length; i++) {
              const row: any = eodRows[i];
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

  async runAutoCheckCQGSync(tradingDate: Date): Promise<any> {
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
      findLatestFile(cqgDailyPath, /Accounts_Balances/i) ||
      findLatestFile(msDailyPath, /Accounts_Balances/i);

    if (!fs.existsSync(qltkgdPath))
      throw new Error(`Thiếu file QLTKGD.xlsx tại ${qltkgdPath}`);
    if (!accountsBalancesPath)
      throw new Error('Không tìm thấy file Accounts_Balances.xlsx từ CQG');

    let usdRate = 25220;
    try {
      this.logger.log('Đang tự động đồng bộ tỷ giá USD từ M-System...');
      if (this.reconConsoleSummaryService) {
        usdRate = await this.reconConsoleSummaryService.syncUsdRateFromMSystem();
      } else {
        const usdRateStr = await this.settingsService.getSetting(
          'usd_exchange_rate',
          '25920',
        );
        usdRate = parseFloat(usdRateStr) || 25920;
      }
    } catch (err: any) {
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
}
