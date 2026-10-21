import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { MarginExcelParser } from '../parsers';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { WorkingCalendarService } from '../../working-calendar/working-calendar.service';
import {
  resolveStoragePathCrossPlatform,
} from '../../../shared';

@Injectable()
export class MsEodReconService {
  private readonly logger = new Logger(MsEodReconService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    @Optional()
    private readonly workingCalendarService?: WorkingCalendarService,
  ) {}

  /**
   * Tính ngày phiên giao dịch T-1 có kiểm tra Lịch Giao Dịch & Nghỉ Lễ/Tết (Working Calendar).
   */
  public async getPreviousTradingSession(
    tradingDate: Date,
    holidays: string[] = [],
  ): Promise<Date> {
    const targetDate = new Date(tradingDate);
    targetDate.setDate(targetDate.getDate() - 1);

    for (let i = 0; i < 15; i++) {
      const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
      if (!isWeekend) {
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        const ymd = `${y}-${m}-${d}`;

        let isHoliday = holidays.includes(ymd);
        if (!isHoliday && this.workingCalendarService) {
          try {
            const cal = await this.workingCalendarService.validateDate(ymd);
            isHoliday = Boolean(cal?.isHoliday || cal?.isTradingDay === false);
          } catch (err: any) {
            this.logger.warn(`Không thể tra cứu working calendar cho ngày ${targetDate.toISOString()}: ${err.message}.`);
          }
        }
        if (!isHoliday) {
          break;
        }
      }
      targetDate.setDate(targetDate.getDate() - 1);
    }
    return targetDate;
  }

  async runAutoCheckSOD(tradingDate: Date): Promise<any> {
    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_ms',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
      ),
    );

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');

    if (!fs.existsSync(qltkgdPath)) {
      throw new Error(`Không tìm thấy file QLTKGD.xlsx tại: ${qltkgdPath}`);
    }

    return {
      success: true,
      tradingDate,
      qltkgdPath,
    };
  }

  async runAutoCheckEodMs(tradingDate: Date): Promise<any> {
    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_ms',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
      ),
    );

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');

    if (!fs.existsSync(qltkgdPath)) {
      throw new Error(`Thiếu file QLTKGD.xlsx tại ${qltkgdPath}`);
    }

    let eodPath = path.join(msDailyPath, `eod.${dateStr}.csv`);
    if (!fs.existsSync(eodPath)) {
      if (fs.existsSync(msDailyPath)) {
        const files = fs.readdirSync(msDailyPath);
        const matched = files.find((f) => /^eod.*\.csv$/i.test(f));
        if (matched) {
          eodPath = path.join(msDailyPath, matched);
        }
      }
    }

    if (!fs.existsSync(eodPath)) {
      throw new Error(`Thiếu file EOD CSV (eod.${dateStr}.csv) tại ${msDailyPath}`);
    }

    const ttttPath = path.join(msDailyPath, 'TTTT.xlsx');
    const files: {
      qltkgd: Buffer;
      eod: Buffer;
      tttt?: Buffer;
      qltkgdName: string;
      eodName: string;
      ttttName?: string;
    } = {
      qltkgd: fs.readFileSync(qltkgdPath),
      eod: fs.readFileSync(eodPath),
      qltkgdName: 'QLTKGD.xlsx',
      eodName: path.basename(eodPath),
    };

    if (fs.existsSync(ttttPath)) {
      files.tttt = fs.readFileSync(ttttPath);
      files.ttttName = 'TTTT.xlsx';
    }

    const eodResult = await this.checkEOD(files);

    return {
      success: true,
      tradingDate,
      msDailyPath,
      qltkgdPath,
      eodPath,
      ttttPath: fs.existsSync(ttttPath) ? ttttPath : null,
      eodResult,
      negativeIMRAcc: eodResult.negativeIMRAcc,
      negativeBalanceAccs: eodResult.negativeBalanceAccs,
      mismatchedEOD: eodResult.mismatchedEOD,
    };
  }

  public buildDsgdBeforeEodEmailHtml(
    passed: boolean,
    totals: any,
    _mismatchedTrades?: any[],
    _mismatchedPositions?: any[],
  ): string {
    const statusColor = passed ? '#2e7d32' : '#c62828';
    const statusText = passed ? 'KHỚP HOÀN TOÀN' : 'CÓ CHÊNH LỆCH';
    const orig = totals.totalOriginal ?? totals.totalCQG_MS ?? 0;
    const temp = totals.totalTemp ?? totals.totalCQG_FR ?? 0;
    const diffTotal = totals.differTotal ?? totals.differCQG ?? 0;
    const acmMs = totals.totalACMMS ?? totals.totalACM_MS ?? 0;
    const acmSftp = totals.totalACMSFTP ?? totals.totalACM_Straits ?? 0;
    const diffAcm = totals.differACM ?? 0;

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
          <div style="max-width: 800px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid ${statusColor};">
            <div style="padding: 20px;">
              <h2 style="color: ${statusColor}; margin-top: 0;">Báo Cáo Kiểm Tra DSGD Trước EOD</h2>
              <p>Hệ thống vừa thực hiện kiểm tra đối chiếu trước EOD (CheckDSGDBeforeEOD) tự động.</p>
              
              <div style="background-color: ${passed ? '#e8f5e9' : '#ffebee'}; border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <span style="font-weight: bold; color: ${statusColor};">Kết quả: ${statusText}</span>
              </div>

              <h3>Tổng Hợp Khối Lượng Giao Dịch</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Hạng mục đối chiếu</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">DSGD Gốc / M-System</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">DSGD Snapshot / Straits CSV</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Khối lượng toàn thị trường (DSGD gốc vs Snapshot)</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${orig.toLocaleString()} lot</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${temp.toLocaleString()} lot</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: ${diffTotal > 0 ? '#c62828' : '#2e7d32'};">${diffTotal.toLocaleString()} lot</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Khối lượng tự doanh ACM (MS vs Straits CSV)</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${acmMs.toLocaleString()} lot</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${acmSftp.toLocaleString()} lot</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: ${diffAcm > 0 ? '#c62828' : '#2e7d32'};">${diffAcm.toLocaleString()} lot</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Đối chiếu công thức số dư EOD cuối ngày (hỗ trợ song song cả MS và CCP)
   * Chuẩn 100% C# Tool (TransactionCheckingService.cs#CheckEOD & FileUtils.cs#GetEODResult).
   */
  async checkEOD(files: {
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
  }): Promise<{
    negativeIMRAcc: string[];
    negativeBalanceAccs: string[];
    mismatchedEOD: Array<{
      system?: 'MS' | 'CCP';
      maTKGD: string;
      calculatedBalance: number;
      eodBalance: number;
      differ: number;
    }>;
  }> {
    const negativeBalanceAccs: string[] = [];
    const negativeIMRAcc: string[] = [];
    const mismatchedEOD: Array<{
      system?: 'MS' | 'CCP';
      maTKGD: string;
      calculatedBalance: number;
      eodBalance: number;
      differ: number;
    }> = [];

    // 1. Thu thập tỷ giá Mua / Bán từ cấu hình hệ thống (hoặc REST API M-System)
    let rateBuyUSD = 25400;
    let rateSellUSD = 25400;
    let rateBuyJPY = 165;
    let rateSellJPY = 165;
    let rateBuyMYR = 5700;
    let rateSellMYR = 5700;

    if (this.settingsService) {
      try {
        const paymentRatesRaw = await this.settingsService.getSetting('ms_payment_rates', '');
        if (paymentRatesRaw) {
          const pr = JSON.parse(paymentRatesRaw);
          if (pr['USD/VND']) {
            rateBuyUSD = Number(pr['USD/VND'].buy) || rateBuyUSD;
            rateSellUSD = Number(pr['USD/VND'].sell) || rateSellUSD;
          }
          if (pr['JPY/VND']) {
            rateBuyJPY = Number(pr['JPY/VND'].buy) || rateBuyJPY;
            rateSellJPY = Number(pr['JPY/VND'].sell) || rateSellJPY;
          }
          if (pr['MYR/VND']) {
            rateBuyMYR = Number(pr['MYR/VND'].buy) || rateBuyMYR;
            rateSellMYR = Number(pr['MYR/VND'].sell) || rateSellMYR;
          }
        } else {
          const usdBuyStr = await this.settingsService.getSetting('usd_settlement_rate_buy', '');
          const usdSellStr = await this.settingsService.getSetting('usd_settlement_rate_sell', '');
          const usdRateStr = await this.settingsService.getSetting('usd_exchange_rate', '25400');
          const jpyRateStr = await this.settingsService.getSetting('jpy_exchange_rate', '165');
          const myrRateStr = await this.settingsService.getSetting('myr_exchange_rate', '5700');

          const baseUsd = parseFloat(usdRateStr) || 25400;
          rateBuyUSD = parseFloat(usdBuyStr) || baseUsd;
          rateSellUSD = parseFloat(usdSellStr) || baseUsd;
          rateBuyJPY = parseFloat(jpyRateStr) || 165;
          rateSellJPY = parseFloat(jpyRateStr) || 165;
          rateBuyMYR = parseFloat(myrRateStr) || 5700;
          rateSellMYR = parseFloat(myrRateStr) || 5700;
        }
      } catch (e: any) {
        this.logger.warn(`Lỗi đọc tỷ giá thanh toán cho CheckEOD: ${e?.message}`);
      }
    }

    // 2. Xử lý M-System EOD (chuẩn C# Tool)
    if (files.qltkgd && files.eod) {
      const qltkgdRes = MarginExcelParser.parseQltkgd(files.qltkgd, { fileName: files.qltkgdName });
      negativeBalanceAccs.push(...qltkgdRes.negativeBalanceAccs);

      const eodRes = MarginExcelParser.parseEodMargin(files.eod, { fileName: files.eodName });
      negativeIMRAcc.push(...eodRes.negativeIMRAcc);

      const ttttPnlMap = files.tttt ? MarginExcelParser.parseTttt(files.tttt) : new Map();

      for (const record of qltkgdRes.records) {
        const maTKGD = record.maTKGD;
        const soDuDauNgay = record.soDuTKKQDauNgay || 0;
        const nopRut = record.nopRutTrongPhien || 0;
        const phiGD = record.phiGiaoDich || 0;
        const phiQC = record.phiQuyenChon || 0;
        const phiDVTT = record.phiDVThanhToan || 0;

        const pnl = ttttPnlMap.get(maTKGD) || { usd: 0, jpy: 0, myr: 0 };
        const laiLoUSD = pnl.usd || 0;
        const laiLoJPY = pnl.jpy || 0;
        const laiLoMYR = pnl.myr || 0;

        // Quy tắc áp tỷ giá Mua / Bán chuẩn C# (TransactionCheckingService.cs#L509-L526):
        // Nếu Lãi lỗ + Phí < 0 -> áp tỷ giá Mua (PaymentExchangeRate1)
        // Nếu >= 0 -> áp tỷ giá Bán (PaymentExchangeRate2)
        const tyGiaUSD = phiQC + laiLoUSD < 0 ? rateBuyUSD : rateSellUSD;
        const tyGiaJPY = laiLoJPY < 0 ? rateBuyJPY : rateSellJPY;
        const tyGiaMYR = laiLoMYR < 0 ? rateBuyMYR : rateSellMYR;

        // Công thức số dư dự kiến chuẩn 100% C# (TransactionCheckingService.cs#L528-L534):
        // result = soDuTKKQDauNgay + nopRutTrongPhien - phiGiaoDich - phiDVThanhToan
        //        + (phiQuyenChon + laiLoUSD) * tyGiaUSD + laiLoJPY * tyGiaJPY + laiLoMYR * tyGiaMYR
        const result =
          soDuDauNgay +
          nopRut -
          phiGD -
          phiDVTT +
          (phiQC + laiLoUSD) * tyGiaUSD +
          laiLoJPY * tyGiaJPY +
          laiLoMYR * tyGiaMYR;

        const eodBalance = eodRes.eodBalanceMap.get(maTKGD);
        if (eodBalance !== undefined) {
          const differ = Math.abs(eodBalance - result);
          // Ngưỡng so lệch C# là 1.000 VNĐ (TransactionCheckingService.cs#L544):
          if (differ >= 1000) {
            mismatchedEOD.push({
              system: 'MS',
              maTKGD,
              calculatedBalance: Math.round(result * 100) / 100,
              eodBalance: Math.round(eodBalance * 100) / 100,
              differ: Math.round(differ * 100) / 100,
            });
          }
        }
      }
    } else {
      if (files.qltkgd) {
        const qltkgdRes = MarginExcelParser.parseQltkgd(files.qltkgd, { fileName: files.qltkgdName });
        negativeBalanceAccs.push(...qltkgdRes.negativeBalanceAccs);
      }
      if (files.eod) {
        const eodRes = MarginExcelParser.parseEodMargin(files.eod, { fileName: files.eodName });
        negativeIMRAcc.push(...eodRes.negativeIMRAcc);
      }
    }

    // 3. Xử lý CCP EOD (nếu có file CCP truyền vào)
    if (files.qltkgdCcp) {
      const qltkgdRes = MarginExcelParser.parseQltkgd(files.qltkgdCcp, { fileName: files.qltkgdCcpName });
      negativeBalanceAccs.push(...qltkgdRes.negativeBalanceAccs);
    }
    if (files.eodCcp) {
      const eodRes = MarginExcelParser.parseEodMargin(files.eodCcp, { fileName: files.eodCcpName });
      negativeIMRAcc.push(...eodRes.negativeIMRAcc);
    }

    return {
      negativeIMRAcc: Array.from(new Set(negativeIMRAcc)),
      negativeBalanceAccs: Array.from(new Set(negativeBalanceAccs)),
      mismatchedEOD,
    };
  }
}
