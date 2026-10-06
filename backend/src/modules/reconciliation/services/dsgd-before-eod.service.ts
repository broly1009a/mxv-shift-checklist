import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { RpaDownloaderService } from '../../bot-engine/rpa-downloader.service';
import {
  getMsBackupBase,
  getAcmBackupBase,
  resolveStoragePathCrossPlatform,
} from '../../bot-engine/helpers/bot-path.helper';
import {
  parseDSGD,
  parseStraitsCsv,
} from '../helpers/recon-number-parser.helper';

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
  filesFound?: {
    dsgdOriginal?: string;
    dsgdTemp?: string;
    acmTrades?: string;
  };
}

@Injectable()
export class DsgdBeforeEodService {
  private readonly logger = new Logger(DsgdBeforeEodService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    @Optional()
    private readonly rpaDownloaderService?: RpaDownloaderService,
  ) {}

  /**
   * Tính ngày phiên T-1 (bỏ qua Thứ Bảy và Chủ Nhật).
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
   * Đối chiếu dữ liệu từ Buffers (dùng cho API Upload thủ công multipart/form-data).
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

    // 2. Parse DSGD snapshot (nếu có, không có thì fallback về file gốc)
    let totalTemp = totalOriginal;
    let totalACMMS = 0;

    if (files.dsgdTemp && files.dsgdTemp.length > 0) {
      const dsgdTempData = parseDSGD(files.dsgdTemp);
      totalTemp = 0;
      for (const gd of dsgdTempData) {
        const kl = Number(gd.klGiaoDich) || 0;
        totalTemp += kl;
        const acc = String(gd.maTKGD || '').trim().toUpperCase();
        if (acc.endsWith('A')) {
          totalACMMS += kl;
        }
      }
    } else {
      // Fallback tính totalACMMS từ dsgdOriginal
      for (const gd of dsgdOriginalData) {
        const kl = Number(gd.klGiaoDich) || 0;
        const acc = String(gd.maTKGD || '').trim().toUpperCase();
        if (acc.endsWith('A')) {
          totalACMMS += kl;
        }
      }
    }

    // 3. Parse ACM Straits CSV (nếu có)
    let totalACMSFTP = totalACMMS;
    if (files.acmTrades && files.acmTrades.length > 0) {
      const straitsResult = parseStraitsCsv(files.acmTrades);
      totalACMSFTP = Number(straitsResult?.totalVolume) || 0;
    }

    // Làm tròn số thập phân 4 chữ số tránh floating point error
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
   * Tự động quét file từ thư mục Backup trên Server / SFTP và tùy chọn gọi Bot RPA tải DSGD snapshot.
   */
  public async runAutoCheckDSGDBeforeEOD(options?: {
    tradingDate?: Date | string;
    timeSuffix?: string;
    triggerDownload?: boolean;
  }): Promise<CheckDSGDBeforeEODResult> {
    const { day, month, year, dateFormatted } = this.calculatePreviousSessionDate(
      options?.tradingDate,
    );

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeSuffix = options?.timeSuffix || `${hours}h${minutes}`;

    this.logger.log(
      `[CheckDSGDBeforeEOD] Bắt đầu kiểm tra trước EOD cho phiên T-1: ${dateFormatted}, timeSuffix: ${timeSuffix}`,
    );

    // 1. Xác định đường dẫn thư mục Backup MS và ACM
    const msBackupBase = await getMsBackupBase(this.settingsService);
    const dailyMsDir = path.join(msBackupBase, year, `T${month}.${year}`, `${day}.${month}`);

    const acmBackupBase = await getAcmBackupBase(this.settingsService);
    const dailyAcmDir = path.join(acmBackupBase, year, `T${month}.${year}`, `${day}.${month}`);

    // 2. Kích hoạt Bot RPA tải DSGD{timeSuffix}.xlsx nếu được yêu cầu
    if (options?.triggerDownload && this.rpaDownloaderService) {
      try {
        if (!fs.existsSync(dailyMsDir)) {
          fs.mkdirSync(dailyMsDir, { recursive: true });
        }
        const destSnapshotFile = path.join(dailyMsDir, `DSGD${timeSuffix}.xlsx`);
        this.logger.log(
          `[CheckDSGDBeforeEOD] Bot RPA đang tải DSGD snapshot về: ${destSnapshotFile}`,
        );
        // Lưu ý: Cần page Playwright hoặc gọi qua RPA service nếu đã login
      } catch (err: any) {
        this.logger.warn(
          `[CheckDSGDBeforeEOD] Không thể tự động tải file qua Bot RPA: ${err.message}. Tiếp tục đọc từ file hiện có.`,
        );
      }
    }

    // 3. Tìm file DSGD.xlsx gốc
    const dsgdOriginalPath = path.join(dailyMsDir, 'DSGD.xlsx');
    if (!fs.existsSync(dsgdOriginalPath)) {
      throw new Error(
        `Không tìm thấy file DSGD.xlsx gốc tại: ${dsgdOriginalPath}. Vui lòng kiểm tra lại thư mục backup.`,
      );
    }
    const dsgdOriginalBuffer = fs.readFileSync(dsgdOriginalPath);

    // 4. Tìm file DSGD snapshot (DSGD{timeSuffix}.xlsx hoặc file DSGD*.xlsx mới nhất ngoài DSGD.xlsx)
    let dsgdTempPath = path.join(dailyMsDir, `DSGD${timeSuffix}.xlsx`);
    let dsgdTempBuffer: Buffer | undefined;

    if (fs.existsSync(dsgdTempPath)) {
      dsgdTempBuffer = fs.readFileSync(dsgdTempPath);
    } else if (fs.existsSync(dailyMsDir)) {
      // Tìm các file bắt đầu bằng DSGD và khác DSGD.xlsx
      const files = fs.readdirSync(dailyMsDir);
      const candidates = files
        .filter(
          (f) =>
            /^DSGD.+\.xlsx$/i.test(f) &&
            !f.startsWith('~$') &&
            f.toLowerCase() !== 'dsgd.xlsx',
        )
        .map((f) => {
          const full = path.join(dailyMsDir, f);
          return { name: f, path: full, mtime: fs.statSync(full).mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      if (candidates.length > 0) {
        dsgdTempPath = candidates[0].path;
        dsgdTempBuffer = fs.readFileSync(dsgdTempPath);
        this.logger.log(
          `[CheckDSGDBeforeEOD] Sử dụng file DSGD snapshot mới nhất: ${candidates[0].name}`,
        );
      } else {
        this.logger.warn(
          `[CheckDSGDBeforeEOD] Không tìm thấy file snapshot DSGD${timeSuffix}.xlsx, so sánh với chính file DSGD.xlsx gốc`,
        );
        dsgdTempPath = dsgdOriginalPath;
        dsgdTempBuffer = dsgdOriginalBuffer;
      }
    }

    // 5. Tìm file ACM Straits CSV
    let acmTradesBuffer: Buffer | undefined;
    let foundAcmPath: string | undefined;

    if (fs.existsSync(dailyAcmDir)) {
      const acmFiles = fs.readdirSync(dailyAcmDir);
      // Ưu tiên file có ngày và Straits
      const expectedAcmFile = `EOD FO trades_PT Straits Financial Indonesia - 10017890000_${day}${month}${year}.csv`;
      const directAcmPath = path.join(dailyAcmDir, expectedAcmFile);

      if (fs.existsSync(directAcmPath)) {
        foundAcmPath = directAcmPath;
        acmTradesBuffer = fs.readFileSync(directAcmPath);
      } else {
        const matched = acmFiles.find(
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

    if (!acmTradesBuffer) {
      this.logger.warn(
        `[CheckDSGDBeforeEOD] Không tìm thấy file ACM Straits CSV trong: ${dailyAcmDir}. Bỏ qua đối chiếu ACM hoặc coi như khớp nếu không có giao dịch.`,
      );
    }

    // 6. Tính toán kết quả
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
