import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../../checklist-hub/queue/job-handler.interface';
import { BotJobHandlerRegistry } from '../../checklist-hub/queue/job-handler.registry';
import { BotJob } from '../../../schemas/bot-job.schema';
import { RpaScraperService } from '../scrapers/rpa-scraper.service';
import { IngressService } from '../ingress.service';
import { AcmEtpAdapter } from '../adapters/acm-etp.adapter';
import { CqgMergerService } from '../../trading-ops/services/merger/cqg-merger.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  parseJobPayload,
  resolveBotTargetDate,
  resolveDailySubfolder,
  getMsBackupBase,
  getAcmBackupBase,
} from '../../../shared/helpers/file-path.helper';
import {
  REQUIRED_MS_FILES,
  REQUIRED_CCP_FILES,
  REQUIRED_CE_FILES,
  ACM_REPORT_CONFIGS,
  isAcmReportRequested,
} from '../../../shared/constants/required-files.constant';

export {
  REQUIRED_MS_FILES,
  REQUIRED_CCP_FILES,
  REQUIRED_CE_FILES,
  ACM_REPORT_CONFIGS,
  isAcmReportRequested,
};

@Injectable()
export class FileAuditJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(FileAuditJobHandler.name);
  readonly jobTypes = [
    'FILE_AUDIT_MS',
    'FILE_AUDIT_CQG',
    'FILE_AUDIT_ACM',
    'FILE_AUDIT_CCP',
    'FILE_AUDIT_CE',
    'DOWNLOAD_CQG_BACKUP',
  ];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    private readonly rpaDownloaderService: RpaScraperService,
    private readonly cqgMergerService: CqgMergerService,
    private readonly settingsService: SystemSettingsService,
    @Optional() private readonly ingressService?: IngressService,
    @Optional() private readonly acmEtpAdapter?: AcmEtpAdapter,
  ) { }

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    switch (job.jobType) {
      case 'FILE_AUDIT_MS':
        return this.handleFileAuditMsJob(job);
      case 'FILE_AUDIT_CQG':
        return this.handleFileAuditCqgJob(job);
      case 'FILE_AUDIT_ACM':
        return this.handleFileAuditAcmJob(job, context);
      case 'FILE_AUDIT_CCP':
        return this.handleFileAuditCcpJob(job);
      case 'FILE_AUDIT_CE':
        return this.handleFileAuditCeJob(job);
      case 'DOWNLOAD_CQG_BACKUP':
        return this.handleDownloadCqgBackupJob(job);
      default:
        throw new Error(`FileAuditJobHandler không hỗ trợ jobType: ${job.jobType}`);
    }
  }

  public async scanMsBackupFiles(
    backupPath: string,
    targetDate: Date = new Date(),
  ): Promise<
    Array<{
      key: string;
      filename: string;
      status: 'OK' | 'MISSING' | 'OUTDATED';
      lastModified?: Date;
    }>
  > {
    const existingFiles = fs.existsSync(backupPath)
      ? fs.readdirSync(backupPath)
      : [];

    return REQUIRED_MS_FILES.map(({ key, filename, patterns }) => {
      const exactPath = path.join(backupPath, filename);
      if (fs.existsSync(exactPath)) {
        const stat = fs.statSync(exactPath);
        return {
          key,
          filename,
          status: stat.size > 0 ? ('OK' as const) : ('MISSING' as const),
          lastModified: stat.mtime,
        };
      }

      const normalizedTarget = filename.toLowerCase().replace(/\s+/g, '');
      const matchedFile = existingFiles.find(
        (f) =>
          f.toLowerCase().replace(/\s+/g, '') === normalizedTarget ||
          (patterns && patterns.some((p) => p.test(f))),
      );

      if (matchedFile) {
        const matchedPath = path.join(backupPath, matchedFile);
        const stat = fs.statSync(matchedPath);
        return {
          key,
          filename: matchedFile,
          status: stat.size > 0 ? ('OK' as const) : ('MISSING' as const),
          lastModified: stat.mtime,
        };
      }

      return { key, filename, status: 'MISSING' as const };
    });
  }

  public async scanCcpBackupFiles(
    backupPath: string,
    targetDate: Date = new Date(),
  ): Promise<
    Array<{
      key: string;
      name: string;
      filename: string;
      actualFile?: string;
      status: 'OK' | 'MISSING' | 'EMPTY';
      size?: number;
      lastModified?: Date;
    }>
  > {
    const existingFiles = fs.existsSync(backupPath)
      ? fs.readdirSync(backupPath)
      : [];

    return REQUIRED_CCP_FILES.map(({ key, name, filename, patterns }) => {
      // 1. Kiểm tra exact filename (.csv, .xlsx, hoặc {code}.csv)
      const exactOrig = path.join(backupPath, filename);
      const exactCsv = path.join(backupPath, filename.replace(/\.xlsx$/i, '.csv'));
      const exactXlsx = path.join(backupPath, filename.replace(/\.csv$/i, '.xlsx'));
      const exactCodeCsv = path.join(backupPath, `${key}.csv`);
      const exactCodeXlsx = path.join(backupPath, `${key}.xlsx`);

      let chosenPath = '';
      let chosenName = '';

      if (fs.existsSync(exactOrig)) {
        chosenPath = exactOrig;
        chosenName = filename;
      } else if (fs.existsSync(exactCsv)) {
        chosenPath = exactCsv;
        chosenName = path.basename(exactCsv);
      } else if (fs.existsSync(exactXlsx)) {
        chosenPath = exactXlsx;
        chosenName = path.basename(exactXlsx);
      } else if (fs.existsSync(exactCodeCsv)) {
        chosenPath = exactCodeCsv;
        chosenName = path.basename(exactCodeCsv);
      } else if (fs.existsSync(exactCodeXlsx)) {
        chosenPath = exactCodeXlsx;
        chosenName = path.basename(exactCodeXlsx);
      } else {
        // 2. Quét pattern trong danh sách existingFiles
        const matched = existingFiles.find((f) => {
          if (f.startsWith('~$')) return false;
          return patterns.some((p) => p.test(f));
        });
        if (matched) {
          chosenPath = path.join(backupPath, matched);
          chosenName = matched;
        }
      }

      if (chosenPath && fs.existsSync(chosenPath)) {
        const stat = fs.statSync(chosenPath);
        return {
          key,
          name,
          filename,
          actualFile: chosenName,
          status: stat.size > 100 ? ('OK' as const) : ('EMPTY' as const),
          size: stat.size,
          lastModified: stat.mtime,
        };
      }

      return {
        key,
        name,
        filename,
        status: 'MISSING' as const,
        size: 0,
      };
    });
  }

  public async scanCeBackupFiles(
    backupPath: string,
    targetDate: Date = new Date(),
  ): Promise<
    Array<{
      key: string;
      name: string;
      filename: string;
      actualFile?: string;
      status: 'OK' | 'MISSING' | 'EMPTY';
      size?: number;
      lastModified?: Date;
    }>
  > {
    const existingFiles = fs.existsSync(backupPath)
      ? fs.readdirSync(backupPath)
      : [];

    return REQUIRED_CE_FILES.map(({ key, name, filename, patterns }) => {
      const exactOrig = path.join(backupPath, filename);
      const exactCsv = path.join(backupPath, filename.replace(/\.xlsx$/i, '.csv'));
      const exactXls = path.join(backupPath, filename.replace(/\.xlsx$/i, '.xls'));
      const exactCodeCsv = path.join(backupPath, `${key}.csv`);
      const exactCodeXlsx = path.join(backupPath, `${key}.xlsx`);

      let chosenPath = '';
      let chosenName = '';

      if (fs.existsSync(exactOrig)) {
        chosenPath = exactOrig;
        chosenName = filename;
      } else if (fs.existsSync(exactXls)) {
        chosenPath = exactXls;
        chosenName = path.basename(exactXls);
      } else if (fs.existsSync(exactCsv)) {
        chosenPath = exactCsv;
        chosenName = path.basename(exactCsv);
      } else if (fs.existsSync(exactCodeCsv)) {
        chosenPath = exactCodeCsv;
        chosenName = path.basename(exactCodeCsv);
      } else if (fs.existsSync(exactCodeXlsx)) {
        chosenPath = exactCodeXlsx;
        chosenName = path.basename(exactCodeXlsx);
      } else if (key === 'HD') {
        const contracts = existingFiles.filter((f) => {
          if (f.startsWith('~$')) return false;
          return patterns.some((p) => p.test(f));
        });
        if (contracts.length > 0) {
          chosenPath = path.join(backupPath, contracts[0]);
          chosenName = contracts.length === 1
            ? contracts[0]
            : `${contracts[0]} (+${contracts.length - 1} HĐ khác)`;
        }
      } else {
        const matched = existingFiles.find((f) => {
          if (f.startsWith('~$')) return false;
          return patterns.some((p) => p.test(f));
        });
        if (matched) {
          chosenPath = path.join(backupPath, matched);
          chosenName = matched;
        }
      }

      if (chosenPath && fs.existsSync(chosenPath)) {
        const stat = fs.statSync(chosenPath);
        return {
          key,
          name,
          filename,
          actualFile: chosenName,
          status: stat.size > 100 ? ('OK' as const) : ('EMPTY' as const),
          size: stat.size,
          lastModified: stat.mtime,
        };
      }

      return {
        key,
        name,
        filename,
        status: 'MISSING' as const,
        size: 0,
      };
    });
  }

  public async scanAcmBackupFiles(
    backupPath: string,
    targetDate: Date = new Date(),
  ): Promise<
    Array<{
      key: string;
      filename: string;
      status: 'OK' | 'MISSING' | 'OUTDATED';
      lastModified?: Date;
    }>
  > {
    const today = new Date(targetDate);
    today.setHours(0, 0, 0, 0);

    const filesToCheck = [
      { key: 'ORDER', filename: 'Order.xlsx', alt: 'Order.xls' },
      { key: 'FILL', filename: 'Fill.xlsx', alt: 'Fill.xls' },
    ];

    const results: Array<{
      key: string;
      filename: string;
      status: 'OK' | 'MISSING' | 'OUTDATED';
      lastModified?: Date;
    }> = [];

    for (const fileItem of filesToCheck) {
      let chosenFile = fileItem.filename;
      let filePath = path.join(backupPath, fileItem.filename);
      if (!fs.existsSync(filePath) && fileItem.alt) {
        const altPath = path.join(backupPath, fileItem.alt);
        if (fs.existsSync(altPath)) {
          filePath = altPath;
          chosenFile = fileItem.alt;
        }
      }

      if (!fs.existsSync(filePath)) {
        results.push({
          key: fileItem.key,
          filename: fileItem.filename,
          status: 'MISSING' as const,
        });
        continue;
      }

      const stat = fs.statSync(filePath);
      const isOk = stat.size > 0;

      results.push({
        key: fileItem.key,
        filename: chosenFile,
        status: isOk ? ('OK' as const) : ('MISSING' as const),
        lastModified: stat.mtime,
      });
    }

    if (fs.existsSync(backupPath)) {
      const files = fs.readdirSync(backupPath);
      const year = today.getFullYear().toString();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const ddmmyyyy = `${day}${month}${year}`;
      const yyyy_mm_dd = `${year}-${month}-${day}`;

      const csvFile = files.find((f) =>
        f.toLowerCase().endsWith(`_${ddmmyyyy}.csv`.toLowerCase()),
      );
      if (csvFile) {
        const stat = fs.statSync(path.join(backupPath, csvFile));
        results.push({
          key: 'SFTP_CSV',
          filename: csvFile,
          status: 'OK' as const,
          lastModified: stat.mtime,
        });
      } else {
        results.push({
          key: 'SFTP_CSV',
          filename: `*_${ddmmyyyy}.csv`,
          status: 'MISSING' as const,
        });
      }

      const xlsFile = files.find(
        (f) =>
          f.toLowerCase().startsWith(`${yyyy_mm_dd}_`.toLowerCase()) &&
          f.toLowerCase().endsWith('.xls'),
      );
      if (xlsFile) {
        const stat = fs.statSync(path.join(backupPath, xlsFile));
        results.push({
          key: 'SFTP_XLS',
          filename: xlsFile,
          status: 'OK' as const,
          lastModified: stat.mtime,
        });
      } else {
        results.push({
          key: 'SFTP_XLS',
          filename: `${yyyy_mm_dd}_*.xls`,
          status: 'MISSING' as const,
        });
      }
    } else {
      const year = today.getFullYear().toString();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const ddmmyyyy = `${day}${month}${year}`;
      const yyyy_mm_dd = `${year}-${month}-${day}`;

      results.push({
        key: 'SFTP_CSV',
        filename: `*_${ddmmyyyy}.csv`,
        status: 'MISSING' as const,
      });
      results.push({
        key: 'SFTP_XLS',
        filename: `${yyyy_mm_dd}_*.xls`,
        status: 'MISSING' as const,
      });
    }

    return results;
  }

  private async handleFileAuditMsJob(job: any) {
    const payload = parseJobPayload(job);
    const { dateObj: targetDate } = resolveBotTargetDate(payload);

    const msBackupBase = payload.backupPath || (await getMsBackupBase(this.settingsService));
    const { fullPath: dailyPath } = resolveDailySubfolder(msBackupBase, targetDate);

    if (!fs.existsSync(dailyPath)) {
      fs.mkdirSync(dailyPath, { recursive: true });
    }

    const backupPath = dailyPath;
    job.logs.push(`[${new Date().toISOString()}] Thư mục backup: ${backupPath}`);
    await job.save();

    const scanResults = await this.scanMsBackupFiles(backupPath, targetDate);
    const missingOrOutdated = scanResults.filter((r) => r.status !== 'OK');
    const okCount = scanResults.length - missingOrOutdated.length;

    job.logs.push(
      `[${new Date().toISOString()}] Kết quả scan: ${okCount}/${scanResults.length} file đầy đủ.`,
    );

    if (missingOrOutdated.length === 0) {
      job.logs.push(
        `[${new Date().toISOString()}]  Tất cả ${scanResults.length} file đã có đầy đủ. Không cần tải thêm.`,
      );
      await job.save();
      return;
    }

    const missingList = missingOrOutdated
      .map((r) => `${r.filename}(${r.status})`)
      .join(', ');
    job.logs.push(
      `[${new Date().toISOString()}]  Thiếu/cũ ${missingOrOutdated.length} file: ${missingList}. Đang tải bổ sung...`,
    );
    await job.save();

    const globalMode = await this.settingsService.getSetting('ingress_mode', process.env.INGRESS_MODE || 'PLAYWRIGHT');
    const ingressModeMs = await this.settingsService.getSetting('ingress_mode_ms', process.env.INGRESS_MODE_MS || globalMode);

    let stillMissing = [...missingOrOutdated];

    // NẾU CẤU HÌNH REST_API: Thử tải bổ sung các file qua Direct REST API trước
    if (ingressModeMs === 'REST_API' && this.ingressService) {
      job.logs.push(`[${new Date().toISOString()}] [M-System] Kích hoạt Direct REST API Mode để tải bổ sung các file thiếu...`);
      await job.save();
      try {
        const missingKeys = missingOrOutdated.map((m) => m.key).filter((k) => k !== 'Markettruoc6h');
        if (missingKeys.length > 0) {
          const apiRes = await this.ingressService.download('MS', {
            targetDirectory: backupPath,
            reportCodes: missingKeys,
          });
          job.logs.push(`[${new Date().toISOString()}] [Direct REST API] Đã tải ${apiRes.files.length} file M-System qua API.`);
          await job.save();
        }
      } catch (apiErr: any) {
        job.logs.push(`[${new Date().toISOString()}] [Direct REST API WARN] Tải qua API gặp sự cố (${apiErr.message}), chuẩn bị fallback sang Playwright...`);
        await job.save();
      }

      // Quét lại thư mục để kiểm tra
      const interimScan = await this.scanMsBackupFiles(backupPath, targetDate);
      stillMissing = interimScan.filter((r) => r.status !== 'OK');
      if (stillMissing.length === 0) {
        job.logs.push(`[${new Date().toISOString()}] Tất cả ${interimScan.length} file M-System đã được tải đầy đủ qua REST API.`);
        await job.save();
        return;
      }
    }

    job.logs.push(`[${new Date().toISOString()}] Đang khởi động Playwright để tải ${stillMissing.length} file M-System còn lại...`);
    await job.save();

    const { browser, page } = await this.rpaDownloaderService.loginMSystem(backupPath);
    const failedFiles: string[] = [];

    try {
      for (const item of stillMissing) {
        const destFile = path.join(backupPath, item.filename);
        job.logs.push(
          `[${new Date().toISOString()}] Đang tải bổ sung: ${item.filename}...`,
        );
        await job.save();

        try {
          const downloaded = await this.rpaDownloaderService.downloadByTarget(
            page,
            item.key,
            destFile,
          );
          if (downloaded) {
            job.logs.push(
              `[${new Date().toISOString()}]  Tải thành công: ${item.filename}`,
            );
          } else {
            job.logs.push(
              `[${new Date().toISOString()}]  Không có method tải tự động cho: ${item.filename}. Cần tải thủ công.`,
            );
            failedFiles.push(`${item.filename} (Chưa hỗ trợ tải tự động)`);
          }
        } catch (dlErr: any) {
          job.logs.push(
            `[${new Date().toISOString()}]  Lỗi khi tải ${item.filename}: ${dlErr.message}`,
          );
          failedFiles.push(`${item.filename} (${dlErr.message})`);
        }
        await job.save();
        await page.waitForTimeout(5000).catch(() => { });
      }

      if (failedFiles.length > 0) {
        throw new Error(
          `Thiếu/Lỗi tải bổ sung ${failedFiles.length} file M-System: ${failedFiles.join('; ')}`,
        );
      }
    } finally {
      this.logger.log('Closing Playwright browser after file audit recovery.');
      await browser.close().catch((err) => {
        this.logger.error(`Error closing browser: ${err.message}`);
      });
    }

    const finalScan = await this.scanMsBackupFiles(backupPath, targetDate);
    const hasMissing = finalScan.some((r) => r.status !== 'OK');
    const currentPayload = parseJobPayload(job);
    job.payload = {
      ...currentPayload,
      result: {
        isWaitingFiles: hasMissing,
        scanResults: finalScan,
      },
    };
    await this.botJobModel
      .updateOne({ _id: job._id }, { $set: { payload: job.payload } })
      .exec();

    if (hasMissing) {
      const missingKeys = finalScan
        .filter((r) => r.status !== 'OK')
        .map((r) => `${r.key} (${r.filename})`)
        .join(', ');
      throw new Error(
        `Kiểm tra file backup MS thất bại: Thiếu hoặc chưa cập nhật các file [${missingKeys}]`,
      );
    }
  }

  private async handleFileAuditCqgJob(job: any) {
    const payload = parseJobPayload(job);
    const { dateObj: targetDate } = resolveBotTargetDate(payload);
    const { fullPath } = await this.cqgMergerService.getDailyBackupPath(targetDate);

    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu kiểm tra file backup CQG tại thư mục: ${fullPath}`,
    );
    await job.save();

    const result = await this.cqgMergerService.autoMergeMissingFiles(targetDate);
    for (const logLine of result.logs) {
      job.logs.push(`[${new Date().toISOString()}] ${logLine}`);
    }
    await job.save();

    if (!result.success) {
      const errorDetails = result.logs
        .filter(
          (l) =>
            l.includes('') ||
            l.includes('Lỗi') ||
            l.includes('Thiếu') ||
            l.includes('thất bại'),
        )
        .join(' | ');
      throw new Error(
        `Ghép file CQG thất bại: ${errorDetails || 'Thiếu file nguồn CQG hoặc sai định dạng.'}`,
      );
    }

    const finalScan = await this.cqgMergerService.scanCqgBackupFiles(targetDate);
    const requiredConsolidated = ['FR', 'OP', 'Od', 'PS'];
    const hasMissingConsolidated = finalScan.some(
      (r) => requiredConsolidated.includes(r.key) && r.status !== 'OK',
    );
    job.payload = {
      ...payload,
      result: {
        isWaitingFiles: hasMissingConsolidated,
        audit: finalScan,
      },
    };
    await this.botJobModel
      .updateOne({ _id: job._id }, { $set: { payload: job.payload } })
      .exec();

    if (hasMissingConsolidated) {
      const missingKeys = finalScan
        .filter((r) => requiredConsolidated.includes(r.key) && r.status !== 'OK')
        .map((r) => r.key)
        .join(', ');
      throw new Error(
        `Kiểm tra & ghép file CQG thất bại: Chưa có đủ các file gộp bắt buộc [${missingKeys}]`,
      );
    }
  }

  private async handleDownloadCqgBackupJob(job: any) {
    const payload = parseJobPayload(job);
    const { dateObj: targetDate } = resolveBotTargetDate(payload);

    const defaultReports = {
      FR1: true,
      PS1: true,
      OP1: true,
      OD1: true,
      FR2: true,
      PS2: true,
      OP2: true,
      OD2: true,
      // AS: true, // Tạm comment: CQG không có widget AS thực tế, tránh sleep 2s và sinh file ảo
    };
    const reports: Partial<
      Record<
        'FR1' | 'PS1' | 'OP1' | 'OD1' | 'FR2' | 'PS2' | 'OP2' | 'OD2' | 'AS',
        boolean
      >
    > = payload.reports || defaultReports;

    const { fullPath } = await this.cqgMergerService.getDailyBackupPath(targetDate);

    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu tải file CQG từ web tới: ${fullPath}`,
    );
    job.logs.push(
      `[${new Date().toISOString()}] File cần tải: ${Object.entries(reports)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', ')}`,
    );
    await job.save();

    const { errors, downloaded } = await this.rpaDownloaderService.downloadCqgBackup(
      reports,
      fullPath,
    );

    for (const d of downloaded) {
      job.logs.push(`[${new Date().toISOString()}]  Đã tải thành công: ${d}`);
    }
    for (const e of errors) {
      job.logs.push(`[${new Date().toISOString()}]  Lỗi tải: ${e}`);
    }
    await job.save();

    if (downloaded.length === 0 && errors.length > 0) {
      throw new Error(
        `Tải file CQG từ web thất bại: ${errors.join('; ')}`,
      );
    }

    if (!payload.skipMerge) {
      job.logs.push(
        `[${new Date().toISOString()}] Tiến hành tự động ghép nối file thô CQG sau khi tải...`,
      );
      await job.save();

      const mergeResult = await this.cqgMergerService.autoMergeMissingFiles(targetDate);
      for (const logLine of mergeResult.logs) {
        job.logs.push(`[${new Date().toISOString()}] ${logLine}`);
      }
      await job.save();

      if (!mergeResult.success) {
        throw new Error(
          `Ghép nối file CQG sau tải thất bại: ${mergeResult.logs.filter((l) => l.includes('')).join('; ')}`,
        );
      }
    }
  }

  private createJobLogger(job: any): (msg: string) => Promise<void> {
    let saveQueue = Promise.resolve();
    return async (msg: string) => {
      const logEntry = `[${new Date().toISOString()}] ${msg}`;
      job.logs.push(logEntry);

      saveQueue = saveQueue.then(async () => {
        try {
          await this.botJobModel
            .updateOne({ _id: job._id }, { $push: { logs: logEntry } })
            .exec();
        } catch (dbErr: any) {
          this.logger.error(`Lỗi khi lưu log thời gian thực: ${dbErr.message}`);
        }
      });
      await saveQueue;
    };
  }

  private async downloadAcmWebReports(
    dailyPath: string,
    targetDate: Date,
    reportCodes: string[],
    logAndSave: (msg: string) => Promise<void>,
  ): Promise<void> {
    const globalMode = await this.settingsService.getSetting('ingress_mode', process.env.INGRESS_MODE || 'PLAYWRIGHT');
    const ingressModeAcm = await this.settingsService.getSetting(
      'ingress_mode_acm',
      process.env.INGRESS_MODE_ACM || globalMode,
    );

    let apiDownloaded = false;
    if (ingressModeAcm === 'REST_API' && (this.acmEtpAdapter || this.ingressService)) {
      await logAndSave(
        `[ACM Direct API] Kích hoạt tải ${reportCodes.join(' & ')} qua Direct REST API (Không mở Chromium)...`,
      );
      try {
        const client = this.acmEtpAdapter || this.ingressService;
        await client?.download('ACM', {
          targetDirectory: dailyPath,
          targetDate: targetDate.toISOString(),
          reportCodes,
        });

        const intermediateScan = await this.scanAcmBackupFiles(dailyPath, targetDate);
        apiDownloaded = intermediateScan
          .filter((r) => reportCodes.includes(r.key))
          .every((r) => r.status === 'OK');

        if (apiDownloaded) {
          await logAndSave(`[ACM Direct API] Hoàn tất tải báo cáo Web (${reportCodes.join('/')}) qua Direct REST API.`);
        }
      } catch (apiErr: any) {
        await logAndSave(`[ACM Direct API] Lỗi Direct REST API: ${apiErr.message}. Fallback sang Playwright...`);
      }
    }

    if (!apiDownloaded) {
      await logAndSave(
        `Đang đăng nhập Playwright tải bổ sung báo cáo Web (${reportCodes.join('/')}) (Gemini AI tự động giải Captcha)...`,
      );
      const { browser, page } = await this.rpaDownloaderService.loginACM(
        dailyPath,
        undefined,
        logAndSave,
      );
      try {
        await this.rpaDownloaderService.downloadAcmBackup(page, dailyPath, logAndSave);
      } finally {
        await browser.close().catch(() => {});
      }
    }
  }

  private async downloadAcmSftpReports(
    dailyPath: string,
    targetDate: Date,
    logAndSave: (msg: string) => Promise<void>,
  ): Promise<void> {
    await logAndSave(`Thiếu file SFTP. Đang tiến hành kết nối SFTP Server để tải bổ sung...`);
    try {
      await this.rpaDownloaderService.downloadAcmSftpBackup(
        dailyPath,
        targetDate,
        logAndSave,
      );
      await logAndSave(`Hoàn tất đồng bộ file từ SFTP.`);
    } catch (err: any) {
      await logAndSave(`Cảnh báo lỗi đồng bộ SFTP: ${err.message}`);
    }
  }

  private async handleFileAuditAcmJob(job: any, context: IJobExecutionContext) {
    const payload = parseJobPayload(job);
    const { dateObj: targetDate } = resolveBotTargetDate(payload);
    const acmBackupBase = await getAcmBackupBase(this.settingsService);
    const { fullPath: dailyPath } = resolveDailySubfolder(acmBackupBase, targetDate);

    if (!fs.existsSync(dailyPath)) {
      fs.mkdirSync(dailyPath, { recursive: true });
    }

    const logAndSave = this.createJobLogger(job);
    await logAndSave(`Bắt đầu kiểm tra file backup ACM tại thư mục: ${dailyPath}`);

    const requestedReports: string[] | undefined =
      Array.isArray(payload.reports) && payload.reports.length > 0
        ? payload.reports.map((r: any) => String(r).toUpperCase().trim())
        : undefined;

    const initialScan = await this.scanAcmBackupFiles(dailyPath, targetDate);
    const missing = initialScan.filter((r) => r.status !== 'OK' && isAcmReportRequested(r.key, requestedReports));

    if (missing.length === 0) {
      await logAndSave(
        `Tất cả báo cáo ACM theo yêu cầu [${requestedReports ? requestedReports.join(', ') : 'Web & SFTP'}] đã đầy đủ. Không cần tải thêm.`,
      );
      return;
    }

    // 1. Phân nhánh tải Web (ORDER / FILL)
    const missingWebKeys = missing
      .filter((r) => ACM_REPORT_CONFIGS[r.key]?.group === 'WEB')
      .map((r) => r.key);
    if (missingWebKeys.length > 0) {
      await this.downloadAcmWebReports(dailyPath, targetDate, missingWebKeys, logAndSave);
    }

    // 2. Phân nhánh tải SFTP (Straits CSV / XLS)
    const hasSftpMissing = missing.some((r) => ACM_REPORT_CONFIGS[r.key]?.group === 'SFTP');
    if (hasSftpMissing) {
      await this.downloadAcmSftpReports(dailyPath, targetDate, logAndSave);
    }

    // 3. Quét kiểm tra kết quả sau tải
    const finalScan = await this.scanAcmBackupFiles(dailyPath, targetDate);
    const remainingMissing = finalScan.filter(
      (r) => r.status !== 'OK' && isAcmReportRequested(r.key, requestedReports),
    );

    const remainingWeb = remainingMissing.filter((r) => ACM_REPORT_CONFIGS[r.key]?.group === 'WEB');
    const remainingSftp = remainingMissing.filter((r) => ACM_REPORT_CONFIGS[r.key]?.group === 'SFTP');

    const isWebRequested = !requestedReports || requestedReports.some((r) => ['ORDER', 'FILL', 'TRADE', 'WEB', 'ETP', 'FULL', 'ALL', 'BACKUP'].includes(r));
    const isSftpRequested = !requestedReports || requestedReports.some((r) => ['SFTP', 'SFTP_CSV', 'SFTP_XLS', 'STRAITS', 'FULL', 'ALL', 'BACKUP'].includes(r));

    job.payload = {
      ...payload,
      result: {
        isWaitingFiles: isWebRequested ? remainingWeb.length > 0 : false,
        scanResults: finalScan,
        webReportsOk: remainingWeb.length === 0,
        sftpOk: remainingSftp.length === 0,
      },
    };
    await this.botJobModel
      .updateOne({ _id: job._id }, { $set: { payload: job.payload } })
      .exec();

    // NGUYÊN TẮC NGHIỆP VỤ: Web (Order & Fill) bắt buộc, SFTP chỉ cảnh báo
    if (isWebRequested && remainingWeb.length > 0) {
      const missingWebStr = remainingWeb.map((r) => `${r.key} (${r.filename})`).join(', ');
      throw new Error(`Kiểm tra file backup ACM thất bại: Thiếu báo cáo Web bắt buộc [${missingWebStr}]`);
    }

    if (isSftpRequested && remainingSftp.length > 0) {
      const missingSftpStr = remainingSftp.map((r) => `${r.key} (${r.filename})`).join(', ');
      await logAndSave(
        `[Cảnh báo SFTP] Báo cáo Web ETP đã đầy đủ (Job Hoàn Tất Thành Công), nhưng chưa có đủ file SFTP [${missingSftpStr}]. Ca trực có thể đồng bộ bổ sung file SFTP sau khi sàn chốt phiên.`,
      );
    } else {
      await logAndSave(`Toàn bộ báo cáo ACM theo yêu cầu [${requestedReports ? requestedReports.join(', ') : 'Web & SFTP'}] đã đồng bộ đầy đủ.`);
    }
  }

  private async handleFileAuditCcpJob(job: any) {
    const payload = parseJobPayload(job);
    const { dateObj: targetDate } = resolveBotTargetDate(payload);
    const ccpBackupBase =
      payload.backupPath ||
      (await this.settingsService.getSetting(
        'bot_backup_path_ccp',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP',
      ));
    const { fullPath: dailyPath } = resolveDailySubfolder(ccpBackupBase, targetDate);

    if (!fs.existsSync(dailyPath)) {
      fs.mkdirSync(dailyPath, { recursive: true });
    }

    job.logs.push(`[${new Date().toISOString()}] Thư mục backup CCP: ${dailyPath}`);
    await job.save();

    const scanResults = await this.scanCcpBackupFiles(dailyPath, targetDate);
    const missing = scanResults.filter((r) => r.status === 'MISSING');
    const empty = scanResults.filter((r) => r.status === 'EMPTY');
    const okCount = scanResults.filter((r) => r.status === 'OK').length;

    job.logs.push(
      `[${new Date().toISOString()}] Kết quả scan CCP: ${okCount}/${scanResults.length} file đầy đủ (Thiếu: ${missing.length}, Trống: ${empty.length}).`,
    );

    const hasMissing = missing.length > 0;
    const currentPayload = parseJobPayload(job);
    job.payload = {
      ...currentPayload,
      result: {
        isWaitingFiles: hasMissing,
        scanResults,
      },
    };
    await this.botJobModel
      .updateOne({ _id: job._id }, { $set: { payload: job.payload } })
      .exec();

    if (hasMissing) {
      const missingList = missing.map((r) => r.filename).join(', ');
      throw new Error(`Kiểm tra file backup CCP: Còn thiếu ${missing.length} file [${missingList}]`);
    }
  }

  private async handleFileAuditCeJob(job: any) {
    const payload = parseJobPayload(job);
    const { dateObj: targetDate } = resolveBotTargetDate(payload);
    const ceBackupBase =
      payload.backupPath ||
      (await this.settingsService.getSetting(
        'bot_backup_path_ce',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CE\\Futures',
      ));
    const { fullPath: dailyPath } = resolveDailySubfolder(ceBackupBase, targetDate);

    if (!fs.existsSync(dailyPath)) {
      fs.mkdirSync(dailyPath, { recursive: true });
    }

    job.logs.push(`[${new Date().toISOString()}] Thư mục backup CE: ${dailyPath}`);
    await job.save();

    const scanResults = await this.scanCeBackupFiles(dailyPath, targetDate);
    const missing = scanResults.filter((r) => r.status === 'MISSING');
    const empty = scanResults.filter((r) => r.status === 'EMPTY');
    const okCount = scanResults.filter((r) => r.status === 'OK').length;

    job.logs.push(
      `[${new Date().toISOString()}] Kết quả scan CE: ${okCount}/${scanResults.length} file đầy đủ (Thiếu: ${missing.length}, Trống: ${empty.length}).`,
    );

    const hasMissing = missing.length > 0;
    const currentPayload = parseJobPayload(job);
    job.payload = {
      ...currentPayload,
      result: {
        isWaitingFiles: hasMissing,
        scanResults,
      },
    };
    await this.botJobModel
      .updateOne({ _id: job._id }, { $set: { payload: job.payload } })
      .exec();

    if (hasMissing) {
      const missingList = missing.map((r) => r.filename).join(', ');
      throw new Error(`Kiểm tra file backup CE: Còn thiếu ${missing.length} file [${missingList}]`);
    }
  }
}
