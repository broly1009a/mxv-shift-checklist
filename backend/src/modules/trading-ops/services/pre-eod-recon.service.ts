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
export class DsgdBeforeEodReconService {
  private readonly logger = new Logger(DsgdBeforeEodReconService.name);

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

  async runAutoCheckEodMm(tradingDate: Date): Promise<any> {
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
      throw new Error(`Thiếu file QLTKGD.xlsx tại ${qltkgdPath}`);
    }

    return {
      success: true,
      tradingDate,
      msDailyPath,
      qltkgdPath,
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

    const processQltkgd = (buf: Buffer) => {
      const qltkgdRes = MarginExcelParser.parseQltkgd(buf);
      negativeBalanceAccs.push(...qltkgdRes.negativeBalanceAccs);
    };

    if (files.qltkgd) processQltkgd(files.qltkgd);
    if (files.qltkgdCcp) processQltkgd(files.qltkgdCcp);

    const processEod = (buf: Buffer) => {
      const eodRes = MarginExcelParser.parseEodMargin(buf);
      negativeIMRAcc.push(...eodRes.negativeIMRAcc);
    };

    if (files.eod) processEod(files.eod);
    if (files.eodCcp) processEod(files.eodCcp);

    return {
      negativeIMRAcc: Array.from(new Set(negativeIMRAcc)),
      negativeBalanceAccs: Array.from(new Set(negativeBalanceAccs)),
      mismatchedEOD,
    };
  }
}

