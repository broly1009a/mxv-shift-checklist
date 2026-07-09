import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { BotJob } from '../../schemas/bot-job.schema';
import { RpaDownloaderService } from './rpa-downloader.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { CqgSyncService } from './cqg-sync.service';

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
  private readonly captchaResolvers = new Map<string, (captcha: string) => void>();

  constructor(
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    private readonly rpaDownloaderService: RpaDownloaderService,
    private readonly settingsService: SystemSettingsService,
    private readonly cqgSyncService: CqgSyncService,
  ) {}

  onModuleInit() {
    // Dọn dẹp các Job bị treo ở trạng thái PROCESSING khi khởi động server
    this.cleanupStuckJobs().catch((err) => {
      this.logger.error(`Lỗi khi dọn dẹp các Job bị treo lúc khởi động: ${err.message}`);
    });

    // Khởi chạy vòng lặp worker ngầm mỗi 10 giây
    setInterval(() => {
      this.processQueue().catch((err) => {
        this.logger.error(`Error in background queue loop: ${err.message}`, err.stack);
      });
    }, 10000);

    // Chạy dọn dẹp định kỳ mỗi 5 phút một lần
    setInterval(() => {
      this.cleanupStuckJobs().catch((err) => {
        this.logger.error(`Lỗi khi dọn dẹp định kỳ các Job bị treo: ${err.message}`);
      });
    }, 5 * 60 * 1000);

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
      } else if (job.jobType === 'FILE_AUDIT_CQG') {
        await this.handleFileAuditCqgJob(job);
      } else if (job.jobType === 'FILE_AUDIT_ACM') {
        await this.handleFileAuditAcmJob(job);
      } else if (job.jobType === 'RUN_LOT_MACRO') {
        await this.handleRunLotMacroJob(job);
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

    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const targets: string[] = payload.targets || ['NKTTHT', 'NR', 'QLTKGD', 'DSGD'];
    const sessionDay: string = payload.sessionDay;

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
  async scanMsBackupFiles(backupPath: string, targetDate: Date = new Date()): Promise<Array<{
    key: string;
    filename: string;
    status: 'OK' | 'MISSING' | 'OUTDATED';
    lastModified?: Date;
  }>> {
    const today = new Date(targetDate);
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
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const targetDateStr = payload.targetDate;
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();

    const msBackupBase = payload.backupPath
      || await this.settingsService.getSetting('bot_backup_path_ms', 'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures');

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const dailyPath = path.join(msBackupBase, subFolder);

    if (!fs.existsSync(dailyPath)) {
      fs.mkdirSync(dailyPath, { recursive: true });
    }

    const backupPath = dailyPath;

    job.logs.push(`[${new Date().toISOString()}] Thư mục backup: ${backupPath}`);
    await job.save();

    // 1. Scan
    const scanResults = await this.scanMsBackupFiles(backupPath, targetDate);
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

  /**
   * FILE_AUDIT_CQG job handler:
   * Runs the CqgSyncService autoMergeMissingFiles to scan and consolidate CQG backup files.
   */
  private async handleFileAuditCqgJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const targetDate = payload.targetDate ? new Date(payload.targetDate) : new Date();
    const { fullPath } = await this.cqgSyncService.getDailyBackupPath(targetDate);

    job.logs.push(`[${new Date().toISOString()}] Bắt đầu kiểm tra file backup CQG tại thư mục: ${fullPath}`);
    await job.save();

    // Run auto merge
    const result = await this.cqgSyncService.autoMergeMissingFiles(targetDate);
    for (const logLine of result.logs) {
      job.logs.push(`[${new Date().toISOString()}] ${logLine}`);
    }
    await job.save();

    if (!result.success) {
      throw new Error('Có lỗi xảy ra trong quá trình tự động ghép file CQG.');
    }
  }

  /**
   * Tự động quét và dọn dẹp các Job bị treo ở trạng thái PROCESSING quá 30 phút.
   * Chuyển chúng thành trạng thái FAILED kèm log giải thích.
   */
  private async cleanupStuckJobs(): Promise<void> {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const stuckJobs = await this.botJobModel.find({
        status: { $in: ['PROCESSING', 'AWAITING_CAPTCHA'] },
        updatedAt: { $lt: thirtyMinutesAgo },
      }).exec();

      if (stuckJobs.length > 0) {
        this.logger.log(`Phát hiện ${stuckJobs.length} Job bị treo hoặc chờ Captcha. Đang tự động dọn dẹp...`);
        for (const job of stuckJobs) {
          job.status = 'FAILED';
          job.logs.push(`[${new Date().toISOString()}] Job tự động chuyển sang thất bại do bị treo quá hạn hoặc Server khởi động lại.`);
          await job.save();
          this.captchaResolvers.delete(job._id.toString());
        }
        this.logger.log(`Đã dọn dẹp xong ${stuckJobs.length} Job bị treo.`);
      }
    } catch (err: any) {
      this.logger.error(`Lỗi khi dọn dẹp các Job bị treo: ${err.message}`);
    }
  }

  /**
   * Cung cấp mã Captcha cho một Job đang chờ xử lý từ xa.
   */
  async submitCaptcha(jobId: string, captchaText: string): Promise<void> {
    const resolver = this.captchaResolvers.get(jobId);
    if (!resolver) {
      throw new Error('Không tìm thấy phiên giải Captcha hợp lệ hoặc đã hết hạn.');
    }

    const job = await this.botJobModel.findById(jobId).exec();
    if (job) {
      job.status = 'PROCESSING';
      job.logs.push(`[${new Date().toISOString()}] Đã nhận mã Captcha từ người dùng: "${captchaText}". Tiếp tục đăng nhập...`);
      await job.save();
    }

    resolver(captchaText);
    this.captchaResolvers.delete(jobId);
  }

  /**
   * Lấy đường dẫn gốc của thư mục backup ACM bằng cách phân tích từ đường dẫn Backup MS (Futures).
   */
  async getAcmBackupBase(): Promise<string> {
    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );

    let acmBackupBase = msBackupBase;
    if (acmBackupBase.endsWith('Futures')) {
      acmBackupBase = acmBackupBase.substring(0, acmBackupBase.length - 'Futures'.length) + 'ACM';
    } else if (acmBackupBase.endsWith('Futures\\')) {
      acmBackupBase = acmBackupBase.substring(0, acmBackupBase.length - 'Futures\\'.length) + 'ACM';
    } else {
      acmBackupBase = path.join(acmBackupBase, 'ACM');
    }
    return acmBackupBase;
  }

  /**
   * Quét thư mục backup ACM xem đã có file Order.xlsx và Fill.xlsx chưa.
   */
  /**
   * Quét thư mục backup ACM xem đã có file Order.xlsx và Fill.xlsx và các file SFTP (dump, log) chưa.
   */
  async scanAcmBackupFiles(backupPath: string, targetDate: Date = new Date()): Promise<Array<{
    key: string;
    filename: string;
    status: 'OK' | 'MISSING' | 'OUTDATED';
    lastModified?: Date;
  }>> {
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

    // 1. Quét 2 file Excel từ Web
    for (const fileItem of filesToCheck) {
      const filePath = path.join(backupPath, fileItem.filename);
      if (!fs.existsSync(filePath)) {
        results.push({ key: fileItem.key, filename: fileItem.filename, status: 'MISSING' as const });
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

    // 2. Quét các file SFTP (CSV và XLS) trong ngày hôm nay
    if (fs.existsSync(backupPath)) {
      const files = fs.readdirSync(backupPath);
      const year = today.getFullYear().toString();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const ddmmyyyy = `${day}${month}${year}`;
      const yyyy_mm_dd = `${year}-${month}-${day}`;

      // Check CSV: *_${ddmmyyyy}.csv
      const csvFile = files.find(f => f.toLowerCase().endsWith(`_${ddmmyyyy}.csv`.toLowerCase()));
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

      // Check XLS: ${yyyy_mm_dd}_*.xls
      const xlsFile = files.find(f => f.toLowerCase().startsWith(`${yyyy_mm_dd}_`.toLowerCase()) && f.toLowerCase().endsWith('.xls'));
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

      results.push({ key: 'SFTP_CSV', filename: `*_${ddmmyyyy}.csv`, status: 'MISSING' as const });
      results.push({ key: 'SFTP_XLS', filename: `${yyyy_mm_dd}_*.xls`, status: 'MISSING' as const });
    }

    return results;
  }

  /**
   * Xử lý Job FILE_AUDIT_ACM.
   */
  private async handleFileAuditAcmJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const targetDateStr = payload.targetDate;
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();

    const acmBackupBase = await this.getAcmBackupBase();

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const dailyPath = path.join(acmBackupBase, subFolder);

    if (!fs.existsSync(dailyPath)) {
      fs.mkdirSync(dailyPath, { recursive: true });
    }

    job.logs.push(`[${new Date().toISOString()}] Bắt đầu kiểm tra file backup ACM tại thư mục: ${dailyPath}`);
    await job.save();

    const scanResults = await this.scanAcmBackupFiles(dailyPath, targetDate);
    const missingOrOutdated = scanResults.filter(r => r.status !== 'OK');

    if (missingOrOutdated.length === 0) {
      job.logs.push(`[${new Date().toISOString()}] ✅ Tất cả báo cáo ACM (Web & SFTP) đã đầy đủ. Không cần tải thêm.`);
      await job.save();
      return;
    }

    // 1. Tải báo cáo từ Web ACM nếu thiếu
    const webMissing = missingOrOutdated.some(r => r.key === 'ORDER' || r.key === 'FILL');
    if (webMissing) {
      job.logs.push(`[${new Date().toISOString()}] ⚠️ Thiếu báo cáo Web (Order/Fill). Đang tiến hành đăng nhập và tải bổ sung...`);
      await job.save();

      // callback để đẩy Captcha lên UI nếu tự động giải bằng Gemini thất bại
      const getCaptchaFromUI = (base64Img: string): Promise<string> => {
        return new Promise<string>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            this.captchaResolvers.delete(job._id.toString());
            reject(new Error('Hết thời gian chờ người dùng nhập Captcha (5 phút).'));
          }, 5 * 60 * 1000);

          job.status = 'AWAITING_CAPTCHA';
          const currentPayload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
          job.payload = {
            ...currentPayload,
            captchaImage: base64Img,
          };
          job.logs.push(`[${new Date().toISOString()}] ⚠️ Phát hiện Captcha. Đang chờ người dùng gõ mã xác nhận từ giao diện Web Checklist.`);
          job.save().then(() => {
            this.captchaResolvers.set(job._id.toString(), (captcha: string) => {
              clearTimeout(timeoutId);
              resolve(captcha);
            });
          }).catch((err) => {
            clearTimeout(timeoutId);
            reject(err);
          });
        });
      };

      const { browser, page } = await this.rpaDownloaderService.loginACM(
        dailyPath,
        getCaptchaFromUI,
        job.logs,
      );

      try {
        await this.rpaDownloaderService.downloadAcmBackup(page, dailyPath, job.logs);
        job.logs.push(`[${new Date().toISOString()}] ✅ Tải thành công báo cáo tự doanh (Order & Fill) từ ACM.`);
        await job.save();
      } finally {
        this.logger.log('Closing Playwright browser after ACM audit.');
        await browser.close().catch((err) => {
          this.logger.error(`Error closing browser: ${err.message}`);
        });
      }
    }

    // 2. Đồng bộ file dump/log từ SFTP nếu thiếu
    const sftpMissing = missingOrOutdated.some(r => r.key === 'SFTP_CSV' || r.key === 'SFTP_XLS');
    if (sftpMissing) {
      job.logs.push(`[${new Date().toISOString()}] ⚠️ Thiếu file từ SFTP. Đang chạy đồng bộ WinSCP...`);
      await job.save();
      try {
        await this.rpaDownloaderService.downloadAcmSftpBackup(dailyPath, targetDate, job.logs);
        job.logs.push(`[${new Date().toISOString()}] ✅ Hoàn tất đồng bộ file từ SFTP.`);
        await job.save();
      } catch (err: any) {
        job.logs.push(`[${new Date().toISOString()}] ❌ Lỗi đồng bộ SFTP: ${err.message}`);
        await job.save();
        throw err;
      }
    }
  }

  /**
   * Xử lý Job RUN_LOT_MACRO: Gọi script Python điều phối Excel headlessly.
   */
  private async handleRunLotMacroJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const targetDateStr = payload.targetDate; // Định dạng YYYY-MM-DD
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate (YYYY-MM-DD) trong payload.');
    }

    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(process.cwd(), 'marco', 'Thong ke so lot giao dich có ACM', 'Macro thong ke so lot giao dich có ACM.xlsm')
      : path.join(process.cwd(), '..', 'marco', 'Thong ke so lot giao dich có ACM', 'Macro thong ke so lot giao dich có ACM.xlsm');

    const macroPath = payload.macroPath
      || await this.settingsService.getSetting(
        'bot_macro_lot_path',
        defaultMacroPath
      );
    const backupMs = payload.backupPathMs
      || await this.settingsService.getSetting(
        'bot_backup_path_ms',
        'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures'
      );
    const backupCqg = payload.backupPathCqg
      || await this.settingsService.getSetting(
        'bot_backup_path_cqg',
        'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures'
      );
    const targetRoot = payload.targetRoot
      || await this.settingsService.getSetting(
        'bot_lot_macro_target_root',
        'M:\\Quanlygiaodich\\Tai lieu hoat dong'
      );
    const pythonExe = await this.settingsService.getSetting(
      'bot_python_path',
      'python'
    );

    const scriptPath = path.join('C:', 'POC', 'scripts', 'run_lot_macro.py');


    // Chaining save calls to prevent Mongoose ParallelSaveError
    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise.then(() => job.save()).catch((err) => {
        this.logger.error(`Error saving bot job in handleRunLotMacroJob: ${err.message}`);
      });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(`Bắt đầu chạy Macro thống kê số lot cho ngày: ${targetDateStr}`);
    log(`Python Executable: ${pythonExe}`);
    log(`Script Python: ${scriptPath}`);
    log(`File Macro Excel: ${macroPath}`);

    await safeSave();

    const { spawn } = require('child_process');
    const child = spawn(pythonExe, [
      scriptPath,
      macroPath,
    ]);

    let finalJsonStr = '';

    const savePayloadField = (key: string, val: any) => {
      if (job.payload instanceof Map) {
        job.payload.set(key, val);
      } else {
        if (!job.payload) job.payload = {};
        job.payload[key] = val;
      }
    };

    return new Promise<void>((resolve, reject) => {
      child.stdout.on('data', (data: any) => {
        const text = data.toString('utf8');
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              finalJsonStr = trimmed;
            } else if (trimmed.startsWith('[VBA WARNING]')) {
              log(`⚠️ ${trimmed}`);
              const warningText = trimmed.substring('[VBA WARNING]'.length).trim();
              
              let currentWarnings = [];
              if (job.payload instanceof Map) {
                currentWarnings = job.payload.get('warnings') || [];
              } else {
                currentWarnings = job.payload?.warnings || [];
              }
              if (!currentWarnings.includes(warningText)) {
                currentWarnings.push(warningText);
                savePayloadField('warnings', currentWarnings);
              }
            } else if (trimmed.startsWith('[VBA RUNTIME ERROR]')) {
              log(`❌ ${trimmed}`);
            } else {
              log(`  > ${trimmed}`);
            }
          }
        }
        safeSave();
      });

      child.stderr.on('data', (data: any) => {
        const text = data.toString('utf8');
        log(`  > [Stderr] ${text.trim()}`);
        safeSave();
      });

      child.on('close', async (code: number | null) => {

        // Wait for any pending logs to finish saving to the database
        await savePromise;
        
        if (code === 0) {
          if (finalJsonStr) {
            try {
              const parsed = JSON.parse(finalJsonStr);
              if (parsed.success) {
                log('✅ Macro hoàn tất thành công.');
                if (parsed.warnings && parsed.warnings.length > 0) {
                  savePayloadField('warnings', parsed.warnings);
                }
                await safeSave();
                resolve();
              } else {
                reject(new Error(parsed.error || 'Lỗi không xác định từ Script Python'));
              }
            } catch (err: any) {
              reject(new Error(`Không thể phân tích kết quả JSON từ script: ${err.message}`));
            }
          } else {
            resolve();
          }
        } else {
          reject(new Error(`Script Python kết thúc với mã lỗi: ${code}`));
        }
      });

      child.on('error', async (err: Error) => {
        await savePromise;
        reject(err);
      });
    });
  }
}
