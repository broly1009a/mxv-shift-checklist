import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { MarginExcelParser } from '../parsers';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { WorkingCalendarService } from '../../working-calendar/working-calendar.service';
import {
  resolveStoragePathCrossPlatform,
  resolveCqgFile,
} from '../../../shared';
import {
  parseDSGD,
  parseFR,
  parseStraitsCsv,
  parseTTTTForRecon,
  parsePSForRecon,
  findLatestFile,
} from '../helpers/trading-math.helper';

export interface PreEodReconResult {
  passed: boolean;
  isWaitingFiles?: boolean;
  message?: string;
  totals: {
    totalACM_MS: number;
    totalACM_Straits: number;
    differACM: number;
    totalCQG_MS: number;
    totalCQG_FR: number;
    differCQG: number;
    totalTTTT_MS?: number;
    totalPS_CQG?: number;
    differPositions?: number;
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
  tradingDate: Date;
  targetDate: Date;
  summaryMessage?: string;
}

@Injectable()
export class PreEodReconService {
  private readonly logger = new Logger(PreEodReconService.name);

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

  /**
   * Thực hiện đối chiếu 3 bên chốt phiên Pre-EOD: M-System vs CQG vs ACM Straits
   */
  async checkPreEOD(
    files: {
      dsgd: Buffer;
      acmTrades: Buffer;
      cqgFr: Buffer;
      tttt?: Buffer;
      cqgPs?: Buffer;
    },
    acmTradesName: string,
    tradingDate: Date,
    holidays: string[] = [],
  ): Promise<PreEodReconResult> {
    // 1. Tính toán ngày T-1 (lùi ngày làm việc, bỏ qua Thứ Bảy & Chủ Nhật và Lễ/Tết)
    const targetDate = await this.getPreviousTradingSession(tradingDate, holidays);

    const dayStr = String(targetDate.getDate()).padStart(2, '0');
    const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yearStr = targetDate.getFullYear().toString();
    const expectedDateStr = `${dayStr}${monthStr}${yearStr}`;

    // Kiểm tra tên file ACM Straits đúng ngày T-1 nếu tên file có chứa ngày
    const hasExplicitDate = /\d{6,8}/.test(acmTradesName || '');
    if (acmTradesName && hasExplicitDate && !acmTradesName.includes(expectedDateStr)) {
      this.logger.warn(
        `File ACM Trades (${acmTradesName}) chứa ngày khác ngày T-1 (${dayStr}/${monthStr}/${yearStr}).`,
      );
    }

    // 2. Parse M-System DSGD
    const dsgdData = parseDSGD(files.dsgd);
    let totalACM_MS = 0;
    let totalCQG_MS = 0;
    dsgdData.forEach((gd) => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) {
        totalACM_MS += gd.klGiaoDich;
      } else {
        totalCQG_MS += gd.klGiaoDich;
      }
    });

    // 3. Parse ACM Straits CSV
    let acmStraitsData = { totalVolume: 0 };
    try {
      acmStraitsData = parseStraitsCsv(files.acmTrades);
    } catch (acmErr: any) {
      this.logger.warn(`Lỗi parse Straits CSV: ${acmErr.message}`);
    }
    const totalACM_Straits = acmStraitsData.totalVolume || 0;
    const differACM = Math.abs(totalACM_MS - totalACM_Straits);

    // 4. Parse CQG FR
    const rawFrData = parseFR(files.cqgFr, tradingDate, holidays);
    const seenCqgOrders = new Set<string>();
    const frData: any[] = [];
    let cqgDupCount = 0;
    for (const fr of rawFrData) {
      if (!fr.ord) {
        frData.push(fr);
        continue;
      }
      if (seenCqgOrders.has(fr.ord)) {
        cqgDupCount++;
        continue;
      }
      seenCqgOrders.add(fr.ord);
      frData.push(fr);
    }
    if (cqgDupCount > 0) {
      this.logger.log(
        `[Pre-EOD] Đã tự động khử trùng ${cqgDupCount} lệnh CQG trùng lặp giữa 2 tài khoản CQG theo Ord #.`,
      );
    }
    let totalCQG_FR = 0;
    frData.forEach((fr) => {
      if (fr.symbol !== 'ZWAZCE') {
        totalCQG_FR += fr.qty;
      }
    });
    const differCQG = Math.abs(totalCQG_MS - totalCQG_FR);

    // 5. Tìm kiếm chênh lệch khớp lệnh 2 chiều (CombinedKey)
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

    // Chiều 1: CQG FR -> M-System DSGD
    frData.forEach((fr) => {
      if (fr.symbol === 'ZWAZCE') return;
      const existsInDSGD = dsgdData.some((gd) => gd.combinedKey === fr.combinedKey);
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

    // Chiều 2: M-System DSGD -> CQG FR
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

    // 6. Đối chiếu vị thế tất toán (TTTT M-System vs PS CQG)
    const mismatchedPositions: Array<{
      account: string;
      symbol: string;
      msPosition: number;
      cqgPosition: number;
      differ: number;
    }> = [];

    let totalTTTT_MS = 0;
    let totalPS_CQG = 0;

    if (files.tttt && files.cqgPs) {
      const msPositions = parseTTTTForRecon(files.tttt);
      const cqgPositions = parsePSForRecon(files.cqgPs, tradingDate, holidays);

      const msPosMap = new Map<string, number>();
      msPositions.forEach((p) => {
        const key = `${p.account}__${p.symbol}`.toUpperCase();
        msPosMap.set(key, (msPosMap.get(key) || 0) + p.position);
        totalTTTT_MS += p.position;
      });

      const cqgPosMap = new Map<string, number>();
      cqgPositions.forEach((p) => {
        const key = `${p.account}__${p.symbol}`.toUpperCase();
        cqgPosMap.set(key, (cqgPosMap.get(key) || 0) + p.position);
        totalPS_CQG += p.position;
      });

      const allKeys = Array.from(new Set([...msPosMap.keys(), ...cqgPosMap.keys()]));
      for (const k of allKeys) {
        const msPos = msPosMap.get(k) || 0;
        const cqgPos = cqgPosMap.get(k) || 0;
        const diff = Math.abs(msPos - cqgPos);
        if (diff > 0.0001) {
          const [acc, sym] = k.split('__');
          mismatchedPositions.push({
            account: acc,
            symbol: sym,
            msPosition: msPos,
            cqgPosition: cqgPos,
            differ: diff,
          });
        }
      }
    }

    const passed =
      differACM === 0 &&
      differCQG === 0 &&
      mismatchedTrades.length === 0 &&
      mismatchedPositions.length === 0;

    return {
      passed,
      totals: {
        totalACM_MS,
        totalACM_Straits,
        differACM,
        totalCQG_MS,
        totalCQG_FR,
        differCQG,
        totalTTTT_MS: files.tttt ? totalTTTT_MS : undefined,
        totalPS_CQG: files.cqgPs ? totalPS_CQG : undefined,
        differPositions:
          files.tttt && files.cqgPs ? Math.abs(totalTTTT_MS - totalPS_CQG) : undefined,
      },
      mismatchedTrades,
      mismatchedPositions,
      tradingDate,
      targetDate,
      summaryMessage: passed
        ? 'Đối chiếu Pre-EOD 3 bên KHỚP 100%'
        : `Phát hiện chênh lệch: Lệch CQG=${differCQG}, Lệch ACM=${differACM}, Lệch khớp lệnh=${mismatchedTrades.length}, Lệch vị thế=${mismatchedPositions.length}`,
    };
  }

  /**
   * Tự động quét file và đối chiếu Pre-EOD theo thư mục hoặc cấu hình hệ thống
   */
  async runAutoCheckPreEOD(
    tradingDate: Date,
    dataDir?: string,
  ): Promise<PreEodReconResult> {
    // 1. Xác định phiên T-1 (lùi ngày làm việc, bỏ qua Thứ 7, Chủ Nhật và Lễ/Tết)
    const targetDate = await this.getPreviousTradingSession(tradingDate);
    targetDate.setHours(0, 0, 0, 0);

    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_ms',
        '',
      ),
    );
    const cqgBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_cqg',
        '',
      ),
    );
    const acmBackupBase = resolveStoragePathCrossPlatform(
      (await this.settingsService.getSetting('bot_backup_path_acm', '')) ||
        msBackupBase.replace(
          /Backup MS[\\/]Futures/i,
          (match) => (match.includes('/') ? 'Backup MS/ACM' : 'Backup MS\\ACM'),
        ),
    );

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = dataDir || path.join(msBackupBase, subFolder);
    const cqgDailyPath = dataDir || path.join(cqgBackupBase, subFolder);
    const acmDailyPath = dataDir || path.join(acmBackupBase, subFolder);

    const dsgdPath = path.join(msDailyPath, 'DSGD.xlsx');
    const ttttPath = path.join(msDailyPath, 'TTTT.xlsx');

    const acmTradesPath = findLatestFile(acmDailyPath, /Straits/i);

    const cqgFrPath = resolveCqgFile(cqgDailyPath, 'FR', this.logger);
    const cqgPsPath = resolveCqgFile(cqgDailyPath, 'PS', this.logger);

    const missingFiles: string[] = [];
    if (!fs.existsSync(dsgdPath)) missingFiles.push(`DSGD.xlsx`);
    if (!fs.existsSync(ttttPath)) missingFiles.push(`TTTT.xlsx`);
    if (!acmTradesPath) missingFiles.push(`ACM Trades (Straits.csv)`);
    if (!cqgFrPath) missingFiles.push(`CQG FR`);
    if (!cqgPsPath) missingFiles.push(`CQG Positions/PS`);

    if (missingFiles.length > 0) {
      return {
        passed: true,
        isWaitingFiles: true,
        tradingDate,
        targetDate,
        message: `[Đang chờ dữ liệu] Thư mục backup phiên T-1 ngày ${day}.${month}.${year} đang chờ cập nhật đầy đủ file đối chiếu (Đang thiếu: ${missingFiles.join(', ')}). Bot sẽ tự động kiểm tra lại ở chu kỳ tiếp theo.`,
        totals: {
          totalACM_MS: 0,
          totalACM_Straits: 0,
          differACM: 0,
          totalCQG_MS: 0,
          totalCQG_FR: 0,
          differCQG: 0,
        },
        mismatchedTrades: [],
        mismatchedPositions: [],
      };
    }

    const lmeHolidaysStr = await this.settingsService.getSetting(
      'lme_holiday_replacements',
      '[]',
    );
    let lmeHolidays: any[] = [];
    try {
      lmeHolidays = JSON.parse(lmeHolidaysStr) || [];
    } catch {}

    const files = {
      dsgd: fs.readFileSync(dsgdPath),
      acmTrades: fs.readFileSync(acmTradesPath!),
      cqgFr: fs.readFileSync(cqgFrPath!),
      tttt: fs.readFileSync(ttttPath),
      cqgPs: fs.readFileSync(cqgPsPath!),
    };

    return this.checkPreEOD(
      files,
      path.basename(acmTradesPath!),
      tradingDate,
      lmeHolidays,
    );
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

  public buildPreEodEmailHtml(
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
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px;">STT</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Nguồn</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Mã Lệnh</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Số TK</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Hợp Đồng</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Giá</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Khối Lượng</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Lý Do</th>
                  </tr>
                </thead>
                <tbody>
                  ${tradesRows}
                </tbody>
              </table>

              <h3>3. Chi Tiết Lệch Vị Thế (Nếu Có)</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px;">STT</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Tài Khoản</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Mã Hàng Hóa</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Vị Thế MS</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Vị Thế CQG</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Chênh Lệch</th>
                  </tr>
                </thead>
                <tbody>
                  ${positionsRows}
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

