/**
 * [V2] DsgdBeforeEodService — Thuộc phân hệ trading-ops (Modular Monolith V2)
 *
 * Ground Truth: reconciliation/services/dsgd-before-eod.service.ts (314 dòng, V1)
 * Ngày di dời: 14/10/2026
 * Task: 3.6 trong KE_HOACH_TONG_CHUYEN_DOI_MODULAR_MONOLITH_ATOMIC_TASKS.md
 *
 * Logic bắt buộc bảo tồn nguyên trạng (KHÔNG được tự ý thay đổi):
 *  1. Lọc tài khoản ACM: acc.endsWith('A') — Đặc thù nghiệp vụ MXV
 *  2. Làm tròn 4 chữ số thập phân (Math.round(x * 10000) / 10000)
 *  3. Ngưỡng chênh lệch: differTotal <= 0.0001 && differACM <= 0.0001
 *     (Chuẩn C# TransactionCheckingService.cs#L452-L466)
 *  4. Nhận diện file ACM: /straits/i — KHÔNG mở rộng thêm pattern
 *  5. Tìm file DSGD snapshot: DSGD{timeSuffix}.xlsx → DSGD*.xlsx mới nhất
 *  6. Tính ngày T-1: while (getDay() === 0 || getDay() === 6) — bỏ qua T7+CN
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { WorkingCalendarService } from '../../working-calendar/working-calendar.service';
import {
  getMsBackupBase,
  getAcmBackupBase,
} from '../../../shared';
import {
  parseDSGD,
  parseStraitsCsv,
} from '../helpers/trading-math.helper';

export interface CheckDSGDBeforeEODResult {
  passed: boolean;
  totalOriginal: number;
  totalTemp: number;
  totalACMMS: number;
  totalACMSFTP: number;
  differTotal: number;
  differACM: number;
  messages: string[];
  sessionDate: string;
  timeSuffix?: string;
  isSnapshotMissing?: boolean;
  warning?: string;
  filesFound?: {
    dsgdOriginal?: string;
    dsgdTemp?: string;
    acmTrades?: string;
  };
}

@Injectable()
export class DsgdBeforeEodService {
  private readonly logger = new Logger('[V2-DsgdBeforeEod]');

  constructor(
    private readonly settingsService: SystemSettingsService,
    @Optional()
    private readonly workingCalendarService?: WorkingCalendarService,
  ) {}

  /**
   * Tính ngày phiên T-1 (bỏ qua Thứ Bảy và Chủ Nhật).
   * [Ground Truth: dsgd-before-eod.service.ts V1 #L47-L69]
   */
  public calculatePreviousSessionDate(inputDate?: Date | string): {
    dateObj: Date;
    day: string;
    month: string;
    year: string;
    dateFormatted: string; // dd/MM/yyyy
  } {
    const d = inputDate ? new Date(inputDate) : new Date();
    d.setDate(d.getDate() - 1);
    //  LOGIC BẮT BUỘC: Bỏ qua Thứ Bảy (6) và Chủ Nhật (0)
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() - 1);
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear().toString();
    return {
      dateObj: d,
      day,
      month,
      year,
      dateFormatted: `${day}/${month}/${year}`,
    };
  }

  /**
   * Tính ngày phiên giao dịch T-1 có kiểm tra Lịch Giao Dịch & Nghỉ Lễ/Tết (Working Calendar).
   * Lặp lùi ngày và kiểm tra qua WorkingCalendarService để bỏ qua Thứ Bảy, Chủ Nhật và các ngày nghỉ Lễ/Tết.
   * [Ground Truth: KE_HOACH_CHI_TIET_KHAC_PHUC_4_LO_HONG_DU_LIEU_VA_VAN_HANH.md Phase 3]
   */
  public async getPreviousTradingSession(inputDate?: Date | string): Promise<{
    dateObj: Date;
    day: string;
    month: string;
    year: string;
    dateFormatted: string;
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
    return {
      dateObj: d,
      day,
      month,
      year,
      dateFormatted: `${day}/${month}/${year}`,
    };
  }

  /**
   * Đối chiếu dữ liệu từ Buffers (dùng cho API Upload thủ công multipart/form-data).
   * [Ground Truth: dsgd-before-eod.service.ts V1 #L74-L164]
   */
  public checkDSGDBeforeEODFromBuffers(
    files: {
      dsgdOriginal: Buffer;
      dsgdTemp?: Buffer;
      acmTrades?: Buffer;
    },
    options?: {
      timeSuffix?: string;
      sessionDate?: string;
    },
  ): CheckDSGDBeforeEODResult {
    if (!files.dsgdOriginal) {
      throw new Error('Thiếu file M-System DSGD.xlsx gốc');
    }

    // 1. Parse DSGD gốc
    const dsgdOriginalData = parseDSGD(files.dsgdOriginal);
    let totalOriginal = 0;
    for (const gd of dsgdOriginalData) {
      totalOriginal += Number(gd.klGiaoDich) || 0;
    }

    // 2. Kiểm tra bắt buộc có file DSGD snapshot trước EOD (Ngăn chặn so sánh file gốc với chính nó)
    if (!files.dsgdTemp || files.dsgdTemp.length === 0) {
      let totalACMMS = 0;
      for (const gd of dsgdOriginalData) {
        const kl = Number(gd.klGiaoDich) || 0;
        const acc = String(gd.maTKGD || '').trim().toUpperCase();
        if (acc.endsWith('A')) {
          totalACMMS += kl;
        }
      }

      let totalACMSFTP = totalACMMS;
      if (files.acmTrades && files.acmTrades.length > 0) {
        const straitsResult = parseStraitsCsv(files.acmTrades);
        totalACMSFTP = Number(straitsResult?.totalVolume) || 0;
      }

      totalOriginal = Math.round(totalOriginal * 10000) / 10000;
      totalACMMS = Math.round(totalACMMS * 10000) / 10000;
      totalACMSFTP = Math.round(totalACMSFTP * 10000) / 10000;
      const differACM = Math.round(Math.abs(totalACMMS - totalACMSFTP) * 10000) / 10000;

      return {
        passed: false,
        isSnapshotMissing: true,
        totalOriginal,
        totalTemp: 0,
        totalACMMS,
        totalACMSFTP,
        differTotal: totalOriginal,
        differACM,
        messages: [
          'LỖI: Không có file snapshot DSGD (dsgdTemp/dsgdSnapshot).',
          'Hệ thống bảo vệ dữ liệu đã chặn hành vi so sánh file gốc với chính nó để giả mạo chênh lệch 0 lot!',
        ],
        warning: 'Thiếu file snapshot DSGD trước EOD.',
        sessionDate: options?.sessionDate || '',
        timeSuffix: options?.timeSuffix || '',
      };
    }

    // 3. Parse DSGD snapshot
    let totalTemp = 0;
    let totalACMMS = 0;
    const dsgdTempData = parseDSGD(files.dsgdTemp);
    for (const gd of dsgdTempData) {
      const kl = Number(gd.klGiaoDich) || 0;
      totalTemp += kl;
      const acc = String(gd.maTKGD || '').trim().toUpperCase();
      //  LOGIC BẮT BUỘC: Lọc tài khoản ACM theo hậu tố 'A' — Đặc thù MXV
      if (acc.endsWith('A')) {
        totalACMMS += kl;
      }
    }

    // 3. Parse ACM Straits CSV (nếu có)
    let totalACMSFTP = totalACMMS;
    if (files.acmTrades && files.acmTrades.length > 0) {
      const straitsResult = parseStraitsCsv(files.acmTrades);
      totalACMSFTP = Number(straitsResult?.totalVolume) || 0;
    }

    //  LOGIC BẮT BUỘC: Làm tròn 4 chữ số thập phân tránh floating point error
    totalOriginal = Math.round(totalOriginal * 10000) / 10000;
    totalTemp = Math.round(totalTemp * 10000) / 10000;
    totalACMMS = Math.round(totalACMMS * 10000) / 10000;
    totalACMSFTP = Math.round(totalACMSFTP * 10000) / 10000;

    const differTotal = Math.round(Math.abs(totalOriginal - totalTemp) * 10000) / 10000;
    const differACM = Math.round(Math.abs(totalACMMS - totalACMSFTP) * 10000) / 10000;

    // 4. Sinh danh sách thông báo chuẩn theo C# TransactionCheckingService.cs#L452-L466
    const messages: string[] = [];
    if (differTotal > 0.0001) {
      messages.push(`Khối lượng giao dịch chênh lệch ${differTotal} lot`);
    }
    if (differACM > 0.0001) {
      messages.push(`Khối lượng giao dịch ACM chênh lệch ${differACM} lot`);
    }
    if (messages.length === 0) {
      messages.push('Không có chênh lệch khối lượng giao dịch');
    }

    //  NGƯỠNG BẮT BUỘC: 0.0001 — chuẩn C# TransactionCheckingService.cs#L452-L466
    const passed = differTotal <= 0.0001 && differACM <= 0.0001;

    return {
      passed,
      totalOriginal,
      totalTemp,
      totalACMMS,
      totalACMSFTP,
      differTotal,
      differACM,
      messages,
      sessionDate: options?.sessionDate || '',
      timeSuffix: options?.timeSuffix || '',
    };
  }

  /**
   * Tự động quét file từ thư mục Backup trên Server và chạy đối chiếu.
   * [Ground Truth: dsgd-before-eod.service.ts V1 #L169-L312]
   */
  public async runAutoCheckDSGDBeforeEOD(options?: {
    tradingDate?: Date | string;
    timeSuffix?: string;
    triggerDownload?: boolean;
    exactDate?: boolean;
    customMsDir?: string;
    customAcmDir?: string;
  }): Promise<CheckDSGDBeforeEODResult> {
    let day: string;
    let month: string;
    let year: string;
    let dateFormatted: string;

    if (options?.exactDate && options?.tradingDate) {
      const d = options.tradingDate instanceof Date ? options.tradingDate : new Date(options.tradingDate);
      day = String(d.getDate()).padStart(2, '0');
      month = String(d.getMonth() + 1).padStart(2, '0');
      year = d.getFullYear().toString();
      dateFormatted = `${day}/${month}/${year}`;
    } else {
      const prev = await this.getPreviousTradingSession(options?.tradingDate);
      day = prev.day;
      month = prev.month;
      year = prev.year;
      dateFormatted = prev.dateFormatted;
    }

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeSuffix = options?.timeSuffix || `${hours}h${minutes}`;

    this.logger.log(
      `Bắt đầu kiểm tra trước EOD cho phiên: ${dateFormatted}, timeSuffix: ${timeSuffix}`,
    );

    // 1. Xác định đường dẫn thư mục Backup MS và ACM
    const msBackupBase = options?.customMsDir || (await getMsBackupBase(this.settingsService));
    let dailyMsDir = path.join(msBackupBase, year, `T${month}.${year}`, `${day}.${month}`);

    if (!fs.existsSync(path.join(dailyMsDir, 'DSGD.xlsx'))) {
      const mShareBase = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures';
      const mShareDir = path.join(mShareBase, year, `T${month}.${year}`, `${day}.${month}`);
      if (fs.existsSync(path.join(mShareDir, 'DSGD.xlsx'))) {
        dailyMsDir = mShareDir;
      }
    }

    const acmBackupBase = options?.customAcmDir || (await getAcmBackupBase(this.settingsService));
    let dailyAcmDir = path.join(acmBackupBase, year, `T${month}.${year}`, `${day}.${month}`);

    if (!fs.existsSync(dailyAcmDir)) {
      const mAcmBase = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup ACM\\Futures';
      const mAcmDir = path.join(mAcmBase, year, `T${month}.${year}`, `${day}.${month}`);
      if (fs.existsSync(mAcmDir)) {
        dailyAcmDir = mAcmDir;
      }
    }

    // NOTE: triggerDownload sẽ được xử lý bởi BotDispatcherService trong Pha 5.
    // V2 chỉ đọc file đã có sẵn trên thư mục Backup.
    if (options?.triggerDownload) {
      this.logger.warn(
        `triggerDownload=true nhưng V2 DsgdBeforeEodService không tự kích hoạt Bot RPA. ` +
        `Hãy dùng BotDispatcherService để kích hoạt job tải file trước khi gọi hàm này.`,
      );
    }

    // 2. Tìm file DSGD.xlsx gốc
    const dsgdOriginalPath = path.join(dailyMsDir, 'DSGD.xlsx');
    if (!fs.existsSync(dsgdOriginalPath)) {
      throw new Error(
        `Không tìm thấy file DSGD.xlsx gốc tại: ${dsgdOriginalPath}. Vui lòng kiểm tra lại thư mục backup.`,
      );
    }
    const dsgdOriginalBuffer = fs.readFileSync(dsgdOriginalPath);

    // 3. Tìm file DSGD snapshot (DSGD{timeSuffix}.xlsx hoặc file DSGD*.xlsx mới nhất ngoài DSGD.xlsx)
    let dsgdTempPath = path.join(dailyMsDir, `DSGD${timeSuffix}.xlsx`);
    let dsgdTempBuffer: Buffer | undefined;

    if (fs.existsSync(dsgdTempPath)) {
      dsgdTempBuffer = fs.readFileSync(dsgdTempPath);
    } else {
      //  LOGIC BẮT BUỘC: Tìm file DSGD snapshot
      // Quét trong dailyMsDir và thư mục TradingCheck tương ứng (chuẩn cấu trúc lưu file của C# IT Tool)
      const searchDirs: string[] = [];
      if (fs.existsSync(dailyMsDir)) searchDirs.push(dailyMsDir);
      const tradingCheckDir = dailyMsDir.replace(/[\\/]Backup MS[\\/]/i, path.sep + 'TradingCheck' + path.sep);
      if (fs.existsSync(tradingCheckDir) && !searchDirs.includes(tradingCheckDir)) {
        searchDirs.push(tradingCheckDir);
      }

      const candidates: Array<{ name: string; path: string; mtime: number }> = [];
      for (const dir of searchDirs) {
        try {
          const filesInDir = fs.readdirSync(dir);
          for (const f of filesInDir) {
            if (/^DSGD.+\.xlsx$/i.test(f) && !f.startsWith('~$') && f.toLowerCase() !== 'dsgd.xlsx') {
              const full = path.join(dir, f);
              candidates.push({ name: f, path: full, mtime: fs.statSync(full).mtimeMs });
            }
          }
        } catch {}
      }

      let matchedCandidate: { name: string; path: string; mtime: number } | undefined;
      if (options?.timeSuffix) {
        const cleanSuffix = options.timeSuffix.replace(/[^a-zA-Z0-9]/g, '');
        matchedCandidate = candidates.find((c) => {
          const cleanName = c.name.replace(/[^a-zA-Z0-9]/g, '');
          return cleanName.includes(cleanSuffix);
        });
      }

      if (!matchedCandidate && candidates.length > 0) {
        candidates.sort((a, b) => b.mtime - a.mtime);
        matchedCandidate = candidates[0];
      }

      if (matchedCandidate) {
        dsgdTempPath = matchedCandidate.path;
        dsgdTempBuffer = fs.readFileSync(dsgdTempPath);
        this.logger.log(`Sử dụng file DSGD snapshot: ${matchedCandidate.name} (${matchedCandidate.path})`);
      } else {
        this.logger.error(
          `[BẢO VỆ DỮ LIỆU] Không tìm thấy bất kỳ file snapshot DSGD nào (hậu tố: "${timeSuffix || 'mới nhất'}") trong các thư mục đối soát: ${searchDirs.join(', ')}. Từ chối so sánh với file gốc!`,
        );

        // Tính toán số liệu file gốc để người dùng nắm được khối lượng đã ghi nhận
        const dsgdOriginalData = parseDSGD(dsgdOriginalBuffer);
        let totalOriginal = 0;
        let totalACMMS = 0;
        for (const gd of dsgdOriginalData) {
          const kl = Number(gd.klGiaoDich) || 0;
          totalOriginal += kl;
          const acc = String(gd.maTKGD || '').trim().toUpperCase();
          if (acc.endsWith('A')) {
            totalACMMS += kl;
          }
        }

        // Tìm file ACM Straits CSV nếu có
        let acmTradesBuffer: Buffer | undefined;
        let foundAcmPath: string | undefined;

        if (fs.existsSync(dailyAcmDir)) {
          const acmFiles = fs.readdirSync(dailyAcmDir);
          const expectedAcmFile = `EOD FO trades_PT Straits Financial Indonesia - 10017890000_${day}${month}${year}.csv`;
          const directAcmPath = path.join(dailyAcmDir, expectedAcmFile);

          if (fs.existsSync(directAcmPath)) {
            foundAcmPath = directAcmPath;
            acmTradesBuffer = fs.readFileSync(directAcmPath);
          } else {
            const matched =
              acmFiles.find(
                (f) =>
                  /straits/i.test(f) &&
                  f.includes(`${day}${month}${year}`) &&
                  f.endsWith('.csv'),
              ) || acmFiles.find((f) => /straits/i.test(f) && f.endsWith('.csv'));

            if (matched) {
              foundAcmPath = path.join(dailyAcmDir, matched);
              acmTradesBuffer = fs.readFileSync(foundAcmPath);
            }
          }
        }

        let totalACMSFTP = totalACMMS;
        if (acmTradesBuffer && acmTradesBuffer.length > 0) {
          const straitsResult = parseStraitsCsv(acmTradesBuffer);
          totalACMSFTP = Number(straitsResult?.totalVolume) || 0;
        }

        totalOriginal = Math.round(totalOriginal * 10000) / 10000;
        totalACMMS = Math.round(totalACMMS * 10000) / 10000;
        totalACMSFTP = Math.round(totalACMSFTP * 10000) / 10000;
        const differACM = Math.round(Math.abs(totalACMMS - totalACMSFTP) * 10000) / 10000;

        return {
          passed: false,
          isSnapshotMissing: true,
          totalOriginal,
          totalTemp: 0,
          totalACMMS,
          totalACMSFTP,
          differTotal: totalOriginal,
          differACM,
          messages: [
            `LỖI: Không tìm thấy file snapshot DSGD${options?.timeSuffix ? ' ' + options.timeSuffix : ''}.xlsx trong thư mục đối soát.`,
            'Hệ thống bảo vệ dữ liệu đã chặn hành vi so sánh file gốc với chính nó để giả mạo chênh lệch 0 lot. Vui lòng tải snapshot phiên chiều trước EOD!',
          ],
          warning: `Không tìm thấy file snapshot DSGD${options?.timeSuffix ? ' ' + options.timeSuffix : ''}.xlsx.`,
          sessionDate: dateFormatted,
          timeSuffix,
          filesFound: {
            dsgdOriginal: dsgdOriginalPath,
            dsgdTemp: undefined,
            acmTrades: foundAcmPath,
          },
        };
      }
    }

    // 4. Tìm file ACM Straits CSV
    let acmTradesBuffer: Buffer | undefined;
    let foundAcmPath: string | undefined;

    if (fs.existsSync(dailyAcmDir)) {
      const acmFiles = fs.readdirSync(dailyAcmDir);
      //  LOGIC BẮT BUỘC: Nhận diện file ACM Straits — pattern /straits/i KHÔNG mở rộng
      const expectedAcmFile = `EOD FO trades_PT Straits Financial Indonesia - 10017890000_${day}${month}${year}.csv`;
      const directAcmPath = path.join(dailyAcmDir, expectedAcmFile);

      if (fs.existsSync(directAcmPath)) {
        foundAcmPath = directAcmPath;
        acmTradesBuffer = fs.readFileSync(directAcmPath);
      } else {
        const matched =
          acmFiles.find(
            (f) =>
              /straits/i.test(f) &&
              f.includes(`${day}${month}${year}`) &&
              f.endsWith('.csv'),
          ) || acmFiles.find((f) => /straits/i.test(f) && f.endsWith('.csv')); // Fallback 1 cấp

        if (matched) {
          foundAcmPath = path.join(dailyAcmDir, matched);
          acmTradesBuffer = fs.readFileSync(foundAcmPath);
        }
      }
    }

    if (!acmTradesBuffer) {
      this.logger.warn(
        `Không tìm thấy file ACM Straits CSV trong: ${dailyAcmDir}. Bỏ qua đối chiếu ACM hoặc coi như khớp nếu không có giao dịch.`,
      );
    }

    // 5. Tính toán kết quả
    const result = this.checkDSGDBeforeEODFromBuffers(
      {
        dsgdOriginal: dsgdOriginalBuffer,
        dsgdTemp: dsgdTempBuffer,
        acmTrades: acmTradesBuffer,
      },
      {
        sessionDate: dateFormatted,
        timeSuffix,
      },
    );

    result.filesFound = {
      dsgdOriginal: dsgdOriginalPath,
      dsgdTemp: dsgdTempPath,
      acmTrades: foundAcmPath,
    };

    return result;
  }
}
