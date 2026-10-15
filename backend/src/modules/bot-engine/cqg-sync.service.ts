import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { resolveDailySubfolder, resolveStoragePathCrossPlatform } from './helpers/bot-path.helper';
import { CqgMergerService } from '../trading-ops/services/cqg-merger.service';

export interface CqgAuditResult {
  key: string;
  filename: string;
  type: 'RAW' | 'CONSOLIDATED' | 'MANUAL';
  status: 'OK' | 'MISSING' | 'OUTDATED';
  lastModified?: Date;
}

export const REQUIRED_CQG_FILES = [
  { key: 'FR1', filename: 'FR1.xlsx', type: 'RAW' as const },
  { key: 'FR2', filename: 'FR2.xlsx', type: 'RAW' as const },
  { key: 'OD1', filename: 'OD1.xlsx', type: 'RAW' as const },
  { key: 'OD2', filename: 'OD2.xlsx', type: 'RAW' as const },
  { key: 'OP1', filename: 'OP1.xlsx', type: 'RAW' as const },
  { key: 'OP2', filename: 'OP2.xlsx', type: 'RAW' as const },
  { key: 'PS1', filename: 'PS1.xlsx', type: 'RAW' as const },
  { key: 'PS2', filename: 'PS2.xlsx', type: 'RAW' as const },
  { key: 'FR', filename: 'FR.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'Od', filename: 'Od.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'OP', filename: 'OP.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'PS', filename: 'PS.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'AS', filename: 'AS.xlsx', type: 'MANUAL' as const },
];

@Injectable()
export class CqgSyncService {
  private readonly logger = new Logger(CqgSyncService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    @Optional()
    private readonly cqgMergerService?: CqgMergerService,
  ) { }

  /**
   * Retrieves the configured CQG backup base folder and resolves the daily subfolder.
   * Path format: baseDir\YYYY\TMM.YYYY\DD.MM
   */
  async getDailyBackupPath(
    targetDate: Date = new Date(),
  ): Promise<{ baseDir: string; fullPath: string }> {
    const rawBaseDir = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      'M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
    );
    const baseDir = resolveStoragePathCrossPlatform(rawBaseDir);
    const { fullPath } = resolveDailySubfolder(baseDir, targetDate);
    return { baseDir, fullPath };
  }

  /**
   * Scans the daily backup folder and returns the status of required files.
   */
  async scanCqgBackupFiles(
    targetDate: Date = new Date(),
    customDir?: string,
  ): Promise<CqgAuditResult[]> {
    let fullPath = customDir;
    if (!fullPath) {
      const backupPathRes = await this.getDailyBackupPath(targetDate);
      fullPath = backupPathRes.fullPath;
      if (!fs.existsSync(fullPath)) {
        // Fallback: Kiểm tra thư mục TradingCheck trong phiên nếu thư mục Backup CQG chưa tồn tại
        const baseDir = resolveStoragePathCrossPlatform(backupPathRes.baseDir);
        const year = targetDate.getFullYear().toString();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
        const tradingCheckBase = baseDir
          .replace(/Backup CQG[\\/]Futures/i, 'TradingCheck/Futures/CQG')
          .replace(/Backup CQG/i, 'TradingCheck/CQG');
        const tradingCheckFullPath = path.join(tradingCheckBase, subFolder);
        if (fs.existsSync(tradingCheckFullPath)) {
          fullPath = tradingCheckFullPath;
        }
      }
    }
    const todayStr = targetDate.toDateString();
    const results: CqgAuditResult[] = [];

    // Scan CQG files
    for (const f of REQUIRED_CQG_FILES) {
      const filePath = path.join(fullPath, f.filename);
      if (!fs.existsSync(fullPath) || !fs.existsSync(filePath)) {
        results.push({
          key: f.key,
          filename: f.filename,
          type: f.type,
          status: 'MISSING',
        });
      } else {
        const stat = fs.statSync(filePath);
        const fileDateStr = new Date(stat.mtime).toDateString();
        const isToday = fileDateStr === todayStr;
        results.push({
          key: f.key,
          filename: f.filename,
          type: f.type,
          status: isToday ? 'OK' : 'OUTDATED',
          lastModified: stat.mtime,
        });
      }
    }

    // Scan M-System TTTT.xlsx file
    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      '',
    );
    const tradingCheckBase =
      (await this.settingsService.getSetting('bot_trading_check_path', '')) ||
      msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck');
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    let msFilePath = '';
    const possiblePaths = [
      path.join(tradingCheckBase, subFolder, 'TTTT.xlsx'),
      path.join(tradingCheckBase, subFolder, 'TTM.xlsx'),
      path.join(msBackupBase, subFolder, 'TTTT.xlsx'),
      path.join(msBackupBase, 'TTTT.xlsx'),
      path.join(msBackupBase, subFolder, 'TTM.xlsx'),
      path.join(msBackupBase, 'TTM.xlsx'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        msFilePath = p;
        break;
      }
    }

    if (msFilePath) {
      const stat = fs.statSync(msFilePath);
      const fileDateStr = new Date(stat.mtime).toDateString();
      const isToday = fileDateStr === todayStr;
      results.push({
        key: 'MS_TTTT',
        filename: `TTTT.xlsx (M-System - ${path.basename(msFilePath)})`,
        type: 'RAW',
        status: isToday ? 'OK' : 'OUTDATED',
        lastModified: stat.mtime,
      });
    } else {
      results.push({
        key: 'MS_TTTT',
        filename: 'TTTT.xlsx (M-System)',
        type: 'RAW',
        status: 'MISSING',
      });
    }

    return results;
  }

  /**
   * Merges all missing/outdated consolidated CQG reports from their raw counterparts.
   */
  async autoMergeMissingFiles(
    targetDate: Date = new Date(),
    keysToMerge?: Array<'FR' | 'OP' | 'Od' | 'PS'>,
    forceRemerge: boolean = false,
    customDir?: string,
  ): Promise<{ success: boolean; logs: string[] }> {
    const logs: string[] = [];
    let fullPath = customDir;
    if (!fullPath) {
      const backupPathRes = await this.getDailyBackupPath(targetDate);
      fullPath = backupPathRes.fullPath;
      if (!fs.existsSync(fullPath)) {
        // Fallback: Kiểm tra thư mục TradingCheck trong phiên nếu thư mục Backup CQG chưa tồn tại
        const baseDir = resolveStoragePathCrossPlatform(backupPathRes.baseDir);
        const year = targetDate.getFullYear().toString();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
        const tradingCheckBase = baseDir
          .replace(/Backup CQG[\\/]Futures/i, 'TradingCheck/Futures/CQG')
          .replace(/Backup CQG/i, 'TradingCheck/CQG');
        const tradingCheckFullPath = path.join(tradingCheckBase, subFolder);
        if (fs.existsSync(tradingCheckFullPath)) {
          fullPath = tradingCheckFullPath;
        }
      }
    }

    if (!fs.existsSync(fullPath)) {
      try {
        fs.mkdirSync(fullPath, { recursive: true });
      } catch (mkdirErr: any) {
        const errorMsg = `Thư mục backup CQG cho ngày ${targetDate.toLocaleDateString('vi-VN')} không tồn tại và không thể tạo: ${fullPath}`;
        this.logger.error(errorMsg);
        return { success: false, logs: [errorMsg] };
      }
    }

    const audit = await this.scanCqgBackupFiles(targetDate, fullPath);
    logs.push(
      `Bắt đầu chạy quy trình tự động ghép file tại thư mục: ${fullPath} (forceRemerge=${forceRemerge})`,
    );

    // Resolve M-System backup path for PS reconciliation
    // M-System backup path is typically configured in settings
    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      '',
    );
    const tradingCheckBase =
      (await this.settingsService.getSetting('bot_trading_check_path', '')) ||
      msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck');

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    // Try finding TTTT.xlsx first (realized PnL), then TTM.xlsx (open positions), supporting both nested and flat paths
    let ttmPath = '';
    const possiblePaths = [
      path.join(tradingCheckBase, subFolder, 'TTTT.xlsx'),
      path.join(tradingCheckBase, subFolder, 'TTM.xlsx'),
      path.join(msBackupBase, subFolder, 'TTTT.xlsx'),
      path.join(msBackupBase, 'TTTT.xlsx'),
      path.join(msBackupBase, subFolder, 'TTM.xlsx'),
      path.join(msBackupBase, 'TTM.xlsx'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        ttmPath = p;
        break;
      }
    }

    if (!ttmPath) {
      ttmPath = path.join(tradingCheckBase, subFolder, 'TTTT.xlsx');
    }
    this.logger.log(`Sử dụng file MS để đối chiếu PS: ${ttmPath}`);

    let hasMergeError = false;
    const runMerge = async (
      name: string,
      mergeFn: () => any,
      rawKeys: string[],
    ) => {
      const missingRaw = rawKeys.filter((k) => {
        const item = audit.find((a) => a.key === k);
        return !item || item.status === 'MISSING';
      });

      if (missingRaw.length > 0) {
        if (name === 'FR') {
          const msg = ` Không ghép file FR.xlsx vì thiếu file nguồn: ${missingRaw.join(', ')}. Cần đủ cả FR1 và FR2 để tránh mất dữ liệu giao dịch.`;
          this.logger.warn(msg);
          logs.push(msg);
          hasMergeError = true;
          return;
        }
        if (missingRaw.length === rawKeys.length) {
          const msg = ` Bỏ qua ghép ${name}.xlsx vì thiếu toàn bộ file nguồn: ${missingRaw.join(', ')}`;
          this.logger.warn(msg);
          logs.push(msg);
          return;
        }
      }

      try {
        logs.push(`Đang ghép file ${name}.xlsx...`);
        await mergeFn();
        logs.push(` Ghép file ${name}.xlsx thành công.`);
      } catch (err: any) {
        hasMergeError = true;
        const msg = ` Lỗi khi ghép file ${name}.xlsx: ${err.message}`;
        this.logger.error(msg, err.stack);
        logs.push(msg);
      }
    };

    const shouldMerge = (targetKey: string, rawKeys: string[]): boolean => {
      if (forceRemerge) return true;
      const mergedItem = audit.find((a) => a.key === targetKey);
      if (!mergedItem || mergedItem.status !== 'OK' || !mergedItem.lastModified) return true;

      const targetPath = path.join(fullPath, `${targetKey}.xlsx`);
      if (fs.existsSync(targetPath)) {
        try {
          const stats = fs.statSync(targetPath);
          if (stats.size < 2500) return true; // File rỗng/hỏng (<2.5KB) -> Bắt buộc ghép lại
        } catch { }
      }

      // Kiểm tra xem có file raw nào mới hơn file đã ghép không
      for (const rawKey of rawKeys) {
        const rawItem = audit.find((a) => a.key === rawKey);
        if (
          rawItem &&
          rawItem.status !== 'MISSING' &&
          rawItem.lastModified &&
          new Date(rawItem.lastModified).getTime() > new Date(mergedItem.lastModified).getTime()
        ) {
          return true;
        }
      }
      return false;
    };

    // 1. Merge FR.xlsx
    if (!keysToMerge || keysToMerge.includes('FR')) {
      if (shouldMerge('FR', ['FR1', 'FR2'])) {
        await runMerge(
          'FR',
          () =>
            this.mergeFR(
              path.join(fullPath, 'FR1.xlsx'),
              path.join(fullPath, 'FR2.xlsx'),
              path.join(fullPath, 'FR.xlsx'),
            ),
          ['FR1', 'FR2'],
        );
      } else {
        logs.push(`FR.xlsx đã tồn tại và cập nhật hôm nay.`);
      }
    }

    // 2. Merge OP.xlsx
    if (!keysToMerge || keysToMerge.includes('OP')) {
      if (shouldMerge('OP', ['OP1', 'OP2'])) {
        await runMerge(
          'OP',
          () =>
            this.mergeOP(
              path.join(fullPath, 'OP1.xlsx'),
              path.join(fullPath, 'OP2.xlsx'),
              path.join(fullPath, 'OP.xlsx'),
            ),
          ['OP1', 'OP2'],
        );
      } else {
        logs.push(`OP.xlsx đã tồn tại và cập nhật hôm nay.`);
      }
    }

    // 3. Merge Od.xlsx (OD1 and OD2)
    if (!keysToMerge || keysToMerge.includes('Od')) {
      if (shouldMerge('Od', ['OD1', 'OD2'])) {
        await runMerge(
          'Od',
          () =>
            this.mergeOD(
              path.join(fullPath, 'OD1.xlsx'),
              path.join(fullPath, 'OD2.xlsx'),
              path.join(fullPath, 'Od.xlsx'),
            ),
          ['OD1', 'OD2'],
        );
      } else {
        logs.push(`Od.xlsx đã tồn tại và cập nhật hôm nay.`);
      }
    }

    // 4. Merge PS.xlsx
    if (!keysToMerge || keysToMerge.includes('PS')) {
      if (shouldMerge('PS', ['PS1', 'PS2'])) {
        await runMerge(
          'PS',
          () =>
            this.mergePS(
              path.join(fullPath, 'PS1.xlsx'),
              path.join(fullPath, 'PS2.xlsx'),
              path.join(fullPath, 'PS.xlsx'),
              ttmPath,
            ),
          ['PS1', 'PS2'],
        );
      } else {
        logs.push(`PS.xlsx đã tồn tại và cập nhật hôm nay.`);
      }
    }

    logs.push('Hoàn tất quy trình kiểm tra và tự động ghép file.');
    return { success: !hasMergeError, logs };
  }

  /**
   * Logic: Merge FR1.xlsx and FR2.xlsx.
   * Copies A2:H of FR1 (headers + data excluding last 2 rows footer).
   * Copies A3:H of FR2 (excluding headers and footer).
   */
  private mergeFR(src1: string, src2: string, dest: string) {
    if (this.cqgMergerService) {
      return this.cqgMergerService.mergeFR(src1, src2, dest);
    }
    throw new Error('CqgMergerService V2 is not available to merge FR.');
  }

  /**
   * Logic: Merge OP1.xlsx and OP2.xlsx.
   * Copies A2:M of OP1 (including header).
   * Copies A3:M of OP2.
   */
  private mergeOP(src1: string, src2: string, dest: string) {
    if (this.cqgMergerService) {
      return this.cqgMergerService.mergeOP(src1, src2, dest);
    }
    throw new Error('CqgMergerService V2 is not available to merge OP.');
  }

  /**
   * Logic: Merge OD1.xlsx and OD2.xlsx.
   * Copies A3:Q of OD1.
   * Copies A4:Q of OD2, appending at row lr1 - 3 (overwriting last rows of OD1).
   */
  private mergeOD(src1: string, src2: string, dest: string) {
    if (this.cqgMergerService) {
      return this.cqgMergerService.mergeOD(src1, src2, dest);
    }
    throw new Error('CqgMergerService V2 is not available to merge OD.');
  }

  /**
   * Logic: Merge PS1.xlsx and PS2.xlsx, and construct reconciliation sheets.
   */
  private mergePS(src1: string, src2: string, dest: string, ttmPath: string) {
    if (this.cqgMergerService) {
      return this.cqgMergerService.mergePS(src1, src2, dest, ttmPath);
    }
    throw new Error('CqgMergerService V2 is not available to merge PS.');
  }

}
