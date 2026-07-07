import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { BotJob } from '../../schemas/bot-job.schema';
import { RpaDownloaderService } from './rpa-downloader.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

// =========================================================================
// Danh sách file MS bắt buộc phải có trong thư mục backup IT
// key: dùng để gọi downloadByTarget khi cần tải bổ sung
// filename: tên file trong thư mục backup
// =========================================================================
const REQUIRED_MS_FILES: Array<{ key: string; filename: string }> = [
  { key: 'DSGD',            filename: 'DSGD.xlsx' },
  { key: 'DSLCK',           filename: 'DSLCK.xlsx' },
  { key: 'DSLDK',           filename: 'DSLDK.xlsx' },
  { key: 'DSLH',            filename: 'DSLH.xlsx' },
  { key: 'DSLK',            filename: 'DSLK.xlsx' },
  { key: 'DSQLKQ',          filename: 'DSQLKQ.xlsx' },
  { key: 'DSTKGD-ACM',      filename: 'DSTKGD-ACM.xlsx' },
  { key: 'DSTKGD-Futures',  filename: 'DSTKGD-Futures.xlsx' },
  { key: 'DSTKGD-LME',      filename: 'DSTKGD-LME.xlsx' },
  { key: 'DSTKGD-Options',  filename: 'DSTKGD-Options.xlsx' },
  { key: 'DSTKGD-Spread',   filename: 'DSTKGD-Spread.xlsx' },
  { key: 'DSTrader',        filename: 'DSTrader.xlsx' },
  { key: 'Markettruoc6h',   filename: 'market truoc 6 h.csv' },
  { key: 'NKTHT',           filename: 'NKTHT.xlsx' },
  { key: 'NR',              filename: 'NR.xlsx' },
  { key: 'QLTKGD',          filename: 'QLTKGD.xlsx' },
  { key: 'QLTKGDAmKQ',      filename: 'QLTKGDAmKQ.xlsx' },
  { key: 'TLKQHSKQ',        filename: 'TLKQHSKQ.xlsx' },
  { key: 'TTCDH',           filename: 'TTCDH.xlsx' },
  { key: 'TTM',             filename: 'TTM.xlsx' },
  { key: 'TTTT',            filename: 'TTTT.xlsx' },
];

@Injectable()
export class BotJobQueueService implements OnModuleInit {
  private readonly logger = new Logger(BotJobQueueService.name);
  private isProcessing = false;

  constructor(
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    private readonly rpaDownloaderService: RpaDownloaderService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  onModuleInit() {
    // Start background worker loop every 10 seconds
    setInterval(() => {
      this.processQueue().catch((err) => {
        this.logger.error(`Error in background queue loop: ${err.message}`, err.stack);
      });
    }, 10000);
    this.logger.log('Background BotJob queue worker initialized (polling every 10s).');
  }

  /**
   * Enqueues a new background job.
   */
  async enqueue(jobType: string, payload: Record<string, any> = {}): Promise<BotJob> {
    // If a job of the same type and payload (e.g. same taskId) is already pending or processing, reuse/return it
    if (payload.taskId) {
      const existing = await this.botJobModel.findOne({
        jobType,
        status: { $in: ['PENDING', 'PROCESSING'] },
        'payload.taskId': payload.taskId,
      }).exec();

      if (existing) {
        this.logger.log(`Job of type ${jobType} for task ${payload.taskId} already exists in queue. Status: ${existing.status}`);
        return existing;
      }
    }

    const job = new this.botJobModel({
      jobType,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: payload.maxAttempts || 3,
      logs: [`[${new Date().toISOString()}] Job enqueued.`],
      payload,
    });

    await job.save();
    this.logger.log(`Enqueued job: ${jobType} (ID: ${job._id})`);
    return job;
  }

  /**
   * Gets job status for a given checklist task and shift log.
   */
  async getJobForTask(taskId: string, shiftLogId: string): Promise<BotJob | null> {
    return this.botJobModel.findOne({
      'payload.taskId': taskId,
      'payload.shiftLogId': shiftLogId,
    }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Main worker loop to process PENDING jobs.
   */
  private async processQueue() {
    if (this.isProcessing) {
      return;
    }

    // Fetch next PENDING job
    const job = await this.botJobModel.findOne({ status: 'PENDING' }).sort({ createdAt: 1 }).exec();
    if (!job) {
      return;
    }

    this.isProcessing = true;
    job.status = 'PROCESSING';
    job.attempts += 1;
    const startTime = new Date().toISOString();
    job.logs.push(`[${startTime}] Starting attempt ${job.attempts}/${job.maxAttempts}...`);
    await job.save();

    this.logger.log(`Processing job ${job.jobType} (ID: ${job._id}, Attempt: ${job.attempts})`);

    try {
      if (job.jobType === 'RPA_DOWNLOAD_REPORTS') {
        await this.handleRpaDownloadJob(job);
      } else if (job.jobType === 'FILE_AUDIT_MS') {
        await this.handleFileAuditMsJob(job);
      } else {
        throw new Error(`Loại job không được hỗ trợ: ${job.jobType}`);
      }

      job.status = 'COMPLETED';
      job.logs.push(`[${new Date().toISOString()}] Job completed successfully.`);
      await job.save();
      this.logger.log(`Job ${job.jobType} (ID: ${job._id}) completed successfully.`);
    } catch (err: any) {
      const errorMsg = err.message || 'Lỗi không xác định';
      this.logger.error(`Job ${job.jobType} (ID: ${job._id}) failed: ${errorMsg}`);
      
      job.logs.push(`[${new Date().toISOString()}] Attempt ${job.attempts} failed: ${errorMsg}`);
      
      if (job.attempts < job.maxAttempts) {
        job.status = 'PENDING'; // Requeue for retry
        job.logs.push(`[${new Date().toISOString()}] Requeued for retry.`);
      } else {
        job.status = 'FAILED';
        job.logs.push(`[${new Date().toISOString()}] Job failed permanently (exhausted attempts).`);
      }
      await job.save();
    } finally {
      this.isProcessing = false;
    }
  }

  private getReportFileName(target: string): string {
    switch (target) {
      case 'NKTTHT':
        return 'NKTTHT.xlsx';
      case 'DSTKGD-Futures':
        return 'DSTKGD-Futures.xlsx';
      case 'DSTKGD-Spread':
        return 'DSTKGD-Spread.xlsx';
      case 'DSTKGD-LME':
        return 'DSTKGD-LME.xlsx';
      case 'DSTKGD-ACM':
        return 'DSTKGD-ACM.xlsx';
      case 'QLTKGD':
      case 'QLTTTKGD':
        return 'QLTKGD.xlsx';
      case 'QLTKGDAmKQ':
        return 'QLTKGDAmKQ.xlsx';
      case 'TLKQHSKQ':
        return 'TLKQHSKQ.xlsx';
      case 'NR':
        return 'NR.xlsx';
      case 'DSTrader':
        return 'DSTrader.xlsx';
      case 'Markettruoc6h':
        return 'market truoc 6h.csv';
      case 'DSLDK':
        return 'DSLDK.xlsx';
      case 'DSLCK':
        return 'DSLCK.xlsx';
      case 'DSLH':
        return 'DSLH.xlsx';
      case 'DSLK':
        return 'DSLK.xlsx';
      case 'DSGD':
        return 'DSGD.xlsx';
      case 'TTM':
        return 'TTM.xlsx';
      case 'TTTT':
        return 'TTTT.xlsx';
      default:
        return `${target}.xlsx`;
    }
  }

  /**
   * Handle RPA report downloads.
   */
  private async handleRpaDownloadJob(job: BotJob) {
    // 1. Prepare temp directory isolated by jobId
    const tempDir = path.join(process.cwd(), 'temp', 'reports', job._id.toString());
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const targets: string[] = job.payload?.targets || ['NKTTHT', 'NR', 'QLTKGD', 'DSGD'];
    const sessionDay: string = job.payload?.sessionDay;

    job.logs.push(`[${new Date().toISOString()}] Reports to download: ${targets.join(', ')}`);
    await job.save();

    // 2. Perform Login
    const { browser, page } = await this.rpaDownloaderService.loginMSystem(tempDir);

    try {
      // 3. Process each download sequential
      for (const target of targets) {
        const filename = this.getReportFileName(target);
        const destFile = path.join(tempDir, filename);
        job.logs.push(`[${new Date().toISOString()}] Downloading report: ${target} (as ${filename})...`);
        await job.save();

        switch (target) {
          case 'NKTTHT':
            await this.rpaDownloaderService.downloadNKTTHT(page, destFile);
            break;
          case 'DSTKGD-Futures':
            await this.rpaDownloaderService.downloadDSTKGDFutures(page, destFile);
            break;
          case 'DSTKGD-Spread':
            await this.rpaDownloaderService.downloadDSTKGDSpread(page, destFile);
            break;
          case 'DSTKGD-LME':
            await this.rpaDownloaderService.downloadDSTKGDLME(page, destFile);
            break;
          case 'DSTKGD-ACM':
            await this.rpaDownloaderService.downloadDSTKGDACM(page, destFile);
            break;
          case 'QLTKGD':
          case 'QLTTTKGD':
            await this.rpaDownloaderService.downloadQLTTTKGD(page, destFile);
            break;
          case 'QLTKGDAmKQ':
            await this.rpaDownloaderService.downloadQLTTTKGDAmKQ(page, destFile);
            break;
          case 'TLKQHSKQ':
            await this.rpaDownloaderService.downloadTLKQHSKQ(page, destFile);
            break;
          case 'NR':
            await this.rpaDownloaderService.downloadNR(page, destFile);
            break;
          case 'DSTrader':
            await this.rpaDownloaderService.downloadDSTrader(page, destFile);
            break;
          case 'Markettruoc6h':
            await this.rpaDownloaderService.downloadMarkettruoc6h(page, destFile);
            break;
          case 'DSLDK':
            await this.rpaDownloaderService.downloadDSLDK(page, destFile);
            break;
          case 'DSLCK':
            await this.rpaDownloaderService.downloadDSLCK(page, destFile);
            break;
          case 'DSLH':
            await this.rpaDownloaderService.downloadDSLH(page, destFile);
            break;
          case 'DSLK':
            await this.rpaDownloaderService.downloadDSLK(page, destFile);
            break;
          case 'DSGD':
            await this.rpaDownloaderService.downloadDSGD(page, destFile, sessionDay);
            break;
          case 'TTM':
            await this.rpaDownloaderService.downloadTTM(page, destFile);
            break;
          case 'TTTT':
            await this.rpaDownloaderService.downloadTTTT(page, destFile);
            break;
          default:
            this.logger.warn(`Unknown download target skipped: ${target}`);
            job.logs.push(`[${new Date().toISOString()}] Warning: Unknown download target skipped: ${target}`);
        }

        job.logs.push(`[${new Date().toISOString()}] Downloaded report: ${target} successfully.`);
        await job.save();
      }
    } finally {
      this.logger.log('Closing Playwright browser context.');
      await browser.close().catch((err) => {
        this.logger.error(`Error closing browser: ${err.message}`);
      });
    }
  }

  // =========================================================================
  // FILE AUDIT MS - Kiểm tra file backup IT, tải bổ sung nếu thiếu
  // =========================================================================

  /**
   * Scans the MS backup directory to find missing/outdated required files.
   * Called synchronously from the controller for immediate status display.
   */
  async scanMsBackupFiles(backupPath: string): Promise<Array<{
    key: string;
    filename: string;
    status: 'OK' | 'MISSING' | 'OUTDATED';
    lastModified?: Date;
  }>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return REQUIRED_MS_FILES.map(({ key, filename }) => {
      const filePath = path.join(backupPath, filename);
      if (!fs.existsSync(filePath)) {
        return { key, filename, status: 'MISSING' as const };
      }
      const stat = fs.statSync(filePath);
      const fileDay = new Date(stat.mtime);
      fileDay.setHours(0, 0, 0, 0);
      const isToday = fileDay.getTime() === today.getTime();
      return {
        key,
        filename,
        status: isToday ? 'OK' as const : 'OUTDATED' as const,
        lastModified: stat.mtime,
      };
    });
  }

  /**
   * FILE_AUDIT_MS job handler:
   * 1. Scan backup dir for missing files
   * 2. If any missing → login M-System → download only missing files
   */
  private async handleFileAuditMsJob(job: BotJob) {
    const backupPath: string = job.payload?.backupPath
      || await this.settingsService.getSetting('bot_backup_path_ms', 'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures');

    job.logs.push(`[${new Date().toISOString()}] Thư mục backup: ${backupPath}`);
    await job.save();

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Thư mục backup không tồn tại: ${backupPath}`);
    }

    // 1. Scan
    const scanResults = await this.scanMsBackupFiles(backupPath);
    const missingOrOutdated = scanResults.filter(r => r.status !== 'OK');
    const okCount = scanResults.length - missingOrOutdated.length;

    job.logs.push(`[${new Date().toISOString()}] Kết quả scan: ${okCount}/${scanResults.length} file đầy đủ.`);

    if (missingOrOutdated.length === 0) {
      job.logs.push(`[${new Date().toISOString()}] ✅ Tất cả ${scanResults.length} file đã có đầy đủ. Không cần tải thêm.`);
      await job.save();
      return;
    }

    const missingList = missingOrOutdated.map(r => `${r.filename}(${r.status})`).join(', ');
    job.logs.push(`[${new Date().toISOString()}] ⚠️ Thiếu/cũ ${missingOrOutdated.length} file: ${missingList}. Đang tải bổ sung...`);
    await job.save();

    // 2. Login M-System chỉ khi có file cần tải
    const { browser, page } = await this.rpaDownloaderService.loginMSystem(backupPath);

    try {
      for (const item of missingOrOutdated) {
        const destFile = path.join(backupPath, item.filename);
        job.logs.push(`[${new Date().toISOString()}] Đang tải bổ sung: ${item.filename}...`);
        await job.save();

        const downloaded = await this.rpaDownloaderService.downloadByTarget(page, item.key, destFile);
        if (downloaded) {
          job.logs.push(`[${new Date().toISOString()}] ✅ Tải thành công: ${item.filename}`);
        } else {
          job.logs.push(`[${new Date().toISOString()}] ⚠️ Không có method tải tự động cho: ${item.filename}. Cần tải thủ công.`);
        }
        await job.save();
        
        // Tránh lỗi 429 Too Many Requests từ phía server bằng cách giãn cách giữa các lần tải 5 giây
        await page.waitForTimeout(5000).catch(() => {});
      }
    } finally {
      this.logger.log('Closing Playwright browser after file audit recovery.');
      await browser.close().catch((err) => {
        this.logger.error(`Error closing browser: ${err.message}`);
      });
    }
  }
}
