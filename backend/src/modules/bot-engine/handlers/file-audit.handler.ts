import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { BotJob } from '../../../schemas/bot-job.schema';
import { RpaDownloaderService } from '../rpa-downloader.service';
import { CqgSyncService } from '../cqg-sync.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  parseJobPayload,
  resolveBotTargetDate,
  resolveDailySubfolder,
  getMsBackupBase,
  getAcmBackupBase,
} from '../helpers/bot-path.helper';

export const REQUIRED_MS_FILES: Array<{ key: string; filename: string }> = [
  { key: 'DSGD', filename: 'DSGD.xlsx' },
  { key: 'DSLCK', filename: 'DSLCK.xlsx' },
  { key: 'DSLDK', filename: 'DSLDK.xlsx' },
  { key: 'DSLH', filename: 'DSLH.xlsx' },
  { key: 'DSLK', filename: 'DSLK.xlsx' },
  { key: 'DSQLKQ', filename: 'DSQLKQ.xlsx' },
  { key: 'DSTKGD-ACM', filename: 'DSTKGD-ACM.xlsx' },
  { key: 'DSTKGD-Futures', filename: 'DSTKGD-Futures.xlsx' },
  { key: 'DSTKGD-LME', filename: 'DSTKGD-LME.xlsx' },
  { key: 'DSTKGD-Spread', filename: 'DSTKGD-Spread.xlsx' },
  { key: 'DSTrader', filename: 'DSTrader.xlsx' },
  { key: 'Markettruoc6h', filename: 'market truoc 6 h.csv' },
  { key: 'NKTHT', filename: 'NKTHT.xlsx' },
  { key: 'NR', filename: 'NR.xlsx' },
  { key: 'QLTKGD', filename: 'QLTKGD.xlsx' },
  { key: 'QLTKGDAmKQ', filename: 'QLTKGDAmKQ.xlsx' },
  { key: 'TLKQHSKQ', filename: 'TLKQHSKQ.xlsx' },
  { key: 'TTCDH', filename: 'TTCDH.xlsx' },
  { key: 'TTM', filename: 'TTM.xlsx' },
  { key: 'TTTT', filename: 'TTTT.xlsx' },
];

@Injectable()
export class FileAuditJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(FileAuditJobHandler.name);
  readonly jobTypes = [
    'FILE_AUDIT_MS',
    'FILE_AUDIT_CQG',
    'FILE_AUDIT_ACM',
    'DOWNLOAD_CQG_BACKUP',
  ];

  public readonly captchaResolvers = new Map<string, (captcha: string) => void>();

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    private readonly rpaDownloaderService: RpaDownloaderService,
    private readonly cqgSyncService: CqgSyncService,
    private readonly settingsService: SystemSettingsService,
  ) {}

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

    return REQUIRED_MS_FILES.map(({ key, filename }) => {
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
        (f) => f.toLowerCase().replace(/\s+/g, '') === normalizedTarget,
      );

      if (matchedFile) {
        const matchedPath = path.join(backupPath, matchedFile);
        const stat = fs.statSync(matchedPath);
        return {
          key,
          filename,
          status: stat.size > 0 ? ('OK' as const) : ('MISSING' as const),
          lastModified: stat.mtime,
        };
      }

      return { key, filename, status: 'MISSING' as const };
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
      { key: 'ORDER', filename: 'Order.xlsx' },
      { key: 'FILL', filename: 'Fill.xlsx' },
    ];

    const results: Array<{
      key: string;
      filename: string;
      status: 'OK' | 'MISSING' | 'OUTDATED';
      lastModified?: Date;
    }> = [];

    for (const fileItem of filesToCheck) {
      const filePath = path.join(backupPath, fileItem.filename);
      if (!fs.existsSync(filePath)) {
        results.push({
          key: fileItem.key,
          filename: fileItem.filename,
          status: 'MISSING' as const,
        });
        continue;
      }

      const stat = fs.statSync(filePath);
      const fileDay = new Date(stat.mtime);
      fileDay.setHours(0, 0, 0, 0);
      const isToday = fileDay.getTime() === today.getTime();

      results.push({
        key: fileItem.key,
        filename: fileItem.filename,
        status: isToday ? ('OK' as const) : ('OUTDATED' as const),
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
        `[${new Date().toISOString()}] ✅ Tất cả ${scanResults.length} file đã có đầy đủ. Không cần tải thêm.`,
      );
      await job.save();
      return;
    }

    const missingList = missingOrOutdated
      .map((r) => `${r.filename}(${r.status})`)
      .join(', ');
    job.logs.push(
      `[${new Date().toISOString()}] ⚠️ Thiếu/cũ ${missingOrOutdated.length} file: ${missingList}. Đang tải bổ sung...`,
    );
    await job.save();

    const { browser, page } = await this.rpaDownloaderService.loginMSystem(backupPath);
    const failedFiles: string[] = [];

    try {
      for (const item of missingOrOutdated) {
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
              `[${new Date().toISOString()}] ✅ Tải thành công: ${item.filename}`,
            );
          } else {
            job.logs.push(
              `[${new Date().toISOString()}] ⚠️ Không có method tải tự động cho: ${item.filename}. Cần tải thủ công.`,
            );
            failedFiles.push(`${item.filename} (Chưa hỗ trợ tải tự động)`);
          }
        } catch (dlErr: any) {
          job.logs.push(
            `[${new Date().toISOString()}] ❌ Lỗi khi tải ${item.filename}: ${dlErr.message}`,
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
    const { fullPath } = await this.cqgSyncService.getDailyBackupPath(targetDate);

    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu kiểm tra file backup CQG tại thư mục: ${fullPath}`,
    );
    await job.save();

    const result = await this.cqgSyncService.autoMergeMissingFiles(targetDate);
    for (const logLine of result.logs) {
      job.logs.push(`[${new Date().toISOString()}] ${logLine}`);
    }
    await job.save();

    if (!result.success) {
      const errorDetails = result.logs
        .filter(
          (l) =>
            l.includes('❌') ||
            l.includes('Lỗi') ||
            l.includes('Thiếu') ||
            l.includes('thất bại'),
        )
        .join(' | ');
      throw new Error(
        `Ghép file CQG thất bại: ${errorDetails || 'Thiếu file nguồn CQG hoặc sai định dạng.'}`,
      );
    }

    const finalScan = await this.cqgSyncService.scanCqgBackupFiles(targetDate);
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
      AS: true,
    };
    const reports: Partial<
      Record<
        'FR1' | 'PS1' | 'OP1' | 'OD1' | 'FR2' | 'PS2' | 'OP2' | 'OD2' | 'AS',
        boolean
      >
    > = payload.reports || defaultReports;

    const { fullPath } = await this.cqgSyncService.getDailyBackupPath(targetDate);

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
      job.logs.push(`[${new Date().toISOString()}] ✅ Đã tải thành công: ${d}`);
    }
    for (const e of errors) {
      job.logs.push(`[${new Date().toISOString()}] ❌ Lỗi tải: ${e}`);
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

      const mergeResult = await this.cqgSyncService.autoMergeMissingFiles(targetDate);
      for (const logLine of mergeResult.logs) {
        job.logs.push(`[${new Date().toISOString()}] ${logLine}`);
      }
      await job.save();

      if (!mergeResult.success) {
        throw new Error(
          `Ghép nối file CQG sau tải thất bại: ${mergeResult.logs.filter((l) => l.includes('❌')).join('; ')}`,
        );
      }
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

    let saveQueue = Promise.resolve();
    const logAndSave = async (msg: string) => {
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

    await logAndSave(
      `Bắt đầu kiểm tra file backup ACM tại thư mục: ${dailyPath}`,
    );

    const scanResults = await this.scanAcmBackupFiles(dailyPath, targetDate);
    const missingOrOutdated = scanResults.filter((r) => r.status !== 'OK');

    if (missingOrOutdated.length === 0) {
      await logAndSave(
        `✅ Tất cả báo cáo ACM (Web & SFTP) đã đầy đủ. Không cần tải thêm.`,
      );
      return;
    }

    const webMissing = missingOrOutdated.some(
      (r) => r.key === 'ORDER' || r.key === 'FILL',
    );
    if (webMissing) {
      await logAndSave(
        `⚠️ Thiếu báo cáo Web (Order/Fill). Đang tiến hành đăng nhập và tải bổ sung...`,
      );

      const getCaptchaFromUI = (base64Img: string): Promise<string> => {
        return new Promise<string>((resolve, reject) => {
          const timeoutId = setTimeout(
            () => {
              this.captchaResolvers.delete(job._id.toString());
              reject(
                new Error(
                  'Hết thời gian chờ người dùng nhập Captcha (5 phút).',
                ),
              );
            },
            5 * 60 * 1000,
          );

          const currentPayload = parseJobPayload(job);
          job.payload = {
            ...currentPayload,
            captchaImage: base64Img,
          };

          logAndSave(
            `⚠️ Phát hiện Captcha. Đang chờ người dùng gõ mã xác nhận từ giao diện Web Checklist.`,
          )
            .then(() => context.syncJobToChecklist(job, 'AWAITING_CAPTCHA'))
            .then(() => {
              this.captchaResolvers.set(job._id.toString(), (userCaptcha: string) => {
                clearTimeout(timeoutId);
                resolve(userCaptcha);
              });
            })
            .catch(reject);
        });
      };

      const { browser, page } = await this.rpaDownloaderService.loginACM(
        dailyPath,
        getCaptchaFromUI,
        logAndSave,
      );

      try {
        await this.rpaDownloaderService.downloadAcmBackup(page, dailyPath, logAndSave);
      } finally {
        await browser.close().catch(() => { });
      }
    }

    const sftpMissing = missingOrOutdated.some(
      (r) => r.key === 'SFTP_CSV' || r.key === 'SFTP_XLS',
    );
    if (sftpMissing) {
      await logAndSave(
        `⚠️ Thiếu file SFTP (CSV/XLS). Đang tiến hành kết nối SFTP Server để tải bổ sung...`,
      );
      try {
        await this.rpaDownloaderService.downloadAcmSftpBackup(
          dailyPath,
          targetDate,
          logAndSave,
        );
        await logAndSave(`✅ Hoàn tất đồng bộ file từ SFTP.`);
      } catch (err: any) {
        await logAndSave(`⚠️ Cảnh báo lỗi đồng bộ SFTP: ${err.message}`);

        const currentScan = await this.scanAcmBackupFiles(dailyPath, targetDate);
        const webReportsOk = currentScan
          .filter((r) => r.key === 'ORDER' || r.key === 'FILL')
          .every((r) => r.status === 'OK');

        if (webReportsOk) {
          await logAndSave(
            `ℹ️ Báo cáo Web (Order/Fill) đã đầy đủ. Chấp nhận lỗi SFTP và hoàn tất job với cảnh báo.`,
          );
        } else {
          await logAndSave(
            `❌ Lỗi đồng bộ SFTP và Báo cáo Web cũng không đầy đủ. Thất bại job.`,
          );
          throw err;
        }
      }
    }

    const finalScan = await this.scanAcmBackupFiles(dailyPath, targetDate);
    const hasMissingFiles = finalScan.some((r) => r.status !== 'OK');
    const currentPayload = parseJobPayload(job);
    job.payload = {
      ...currentPayload,
      result: {
        isWaitingFiles: hasMissingFiles,
        scanResults: finalScan,
      },
    };
    await this.botJobModel
      .updateOne({ _id: job._id }, { $set: { payload: job.payload } })
      .exec();

    if (hasMissingFiles) {
      const missingKeys = finalScan
        .filter((r) => r.status !== 'OK')
        .map((r) => `${r.key} (${r.filename})`)
        .join(', ');
      throw new Error(
        `Kiểm tra file backup ACM thất bại: Thiếu hoặc chưa cập nhật các file [${missingKeys}]`,
      );
    }
  }
}
