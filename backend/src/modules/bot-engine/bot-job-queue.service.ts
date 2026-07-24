import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { BotJob } from '../../schemas/bot-job.schema';
import { RpaDownloaderService } from './rpa-downloader.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { CqgSyncService } from './cqg-sync.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { TelegramService } from '../telegram/telegram.service';
import { ValueStatisticsService } from '../lot-statistics/value-statistics.service';
import { LotStatisticsService } from '../lot-statistics/lot-statistics.service';
import { ShiftsService } from '../shifts/shifts.service';
import { ShiftsGateway } from '../shifts/shifts.gateway';
import { CcpStatisticsService } from '../ccp-statistics/ccp-statistics.service';
import * as XLSX from 'xlsx';

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
export class BotJobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotJobQueueService.name);
  private isProcessing = false;
  private readonly captchaResolvers = new Map<string, (captcha: string) => void>();
  private queueInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;
  private healthInterval: NodeJS.Timeout;
  private wasAgentOnlineMap = new Map<string, boolean>();

  constructor(
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    private readonly rpaDownloaderService: RpaDownloaderService,
    private readonly settingsService: SystemSettingsService,
    private readonly cqgSyncService: CqgSyncService,
    @Inject(forwardRef(() => ReconciliationService))
    private readonly reconciliationService: ReconciliationService,
    private readonly telegramService: TelegramService,
    private readonly valueStatisticsService: ValueStatisticsService,
    private readonly lotStatisticsService: LotStatisticsService,
    private readonly shiftsService: ShiftsService,
    private readonly shiftsGateway: ShiftsGateway,
    private readonly ccpStatisticsService: CcpStatisticsService,
  ) {}

  onModuleInit() {
    // Dọn dẹp các Job bị treo ở trạng thái PROCESSING khi khởi động server
    this.cleanupStuckJobs(true).catch((err) => {
      this.logger.error(`Lỗi khi dọn dẹp các Job bị treo lúc khởi động: ${err.message}`);
    });

    // Khởi chạy vòng lặp worker ngầm mỗi 10 giây
    this.queueInterval = setInterval(() => {
      this.processQueue().catch((err) => {
        this.logger.error(`Error in background queue loop: ${err.message}`, err.stack);
      });
    }, 10000);

    // Chạy dọn dẹp định kỳ mỗi 5 phút một lần
    this.cleanupInterval = setInterval(() => {
      this.cleanupStuckJobs().catch((err) => {
        this.logger.error(`Lỗi khi dọn dẹp định kỳ các Job bị treo: ${err.message}`);
      });
    }, 5 * 60 * 1000);

    // Kiểm tra kết nối của Agent mỗi 60 giây
    this.healthInterval = setInterval(() => {
      this.checkAgentConnectionHealth().catch((err) => {
        this.logger.error(`Lỗi khi kiểm tra kết nối Agent: ${err.message}`);
      });
    }, 60000);

    this.logger.log('Background BotJob queue worker initialized (polling every 10s).');
  }

  onModuleDestroy() {
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }
    this.logger.log('Background BotJob queue worker stopped.');
  }

  private async checkAgentConnectionHealth() {
    const { AgentController } = require('./bot-engine.controller');
    const statuses = AgentController.agentStatuses; // Map<string, { hostname, platform, lastSeen }>
    if (!statuses) return;

    for (const [hostname, status] of statuses.entries()) {
      const diffMs = Date.now() - status.lastSeen.getTime();
      const isOnline = diffMs < 180000; // 3 minutes timeout
      const wasOnline = this.wasAgentOnlineMap.get(hostname) || false;

      if (!isOnline && wasOnline) {
        this.wasAgentOnlineMap.set(hostname, false);
        this.logger.warn(`Agent ${hostname} offline alert. Sending email...`);
        await this.sendConnectionAlertEmail(status, false);
        statuses.delete(hostname); // clean up offline agent
      } else if (isOnline && !wasOnline) {
        this.wasAgentOnlineMap.set(hostname, true);
        this.logger.log(`Agent ${hostname} online info. Sending email...`);
        await this.sendConnectionAlertEmail(status, true);
      }
    }
  }

  private async sendConnectionAlertEmail(status: { hostname: string; platform: string; lastSeen: Date }, isOnline: boolean) {
    try {
      const configStr = await this.settingsService.getSetting('margin_checker_config', '{}');
      const config = JSON.parse(configStr);
      const mailSettings = config.opFailureAlert || { isSendWarning: true, email: ['it.support@mxv.vn'] };
      if (!mailSettings.isSendWarning) return;

      const smtp = config.smtp || {
        host: 'smtp.office365.com',
        port: 587,
        user: 'it.support@mxv.vn',
        pass: 'OFmng239',
        senderEmail: 'it.support@mxv.vn',
        senderName: 'MXV IT Support',
      };

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const subject = isOnline
        ? `✅ [MXV RPA AGENT] Kết Nối Đã Được Phục Hồi: ${status.hostname}`
        : `🚨 [MXV RPA AGENT] Cảnh Báo Mất Kết Nối: ${status.hostname}`;

      const htmlBody = isOnline
        ? `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid #2e7d32;">
              <div style="padding: 20px;">
                <h2 style="color: #2e7d32; margin-top: 0;">✅ Khôi Phục Kết Nối RPA Agent</h2>
                <p>Ứng dụng MXV RPA Agent trên máy <b>${status.hostname}</b> (${status.platform}) đã kết nối lại thành công với hệ thống.</p>
                <p><b>Thời gian khôi phục:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
              </div>
            </div>
          </body>
        </html>
        `
        : `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid #c62828;">
              <div style="padding: 20px;">
                <h2 style="color: #c62828; margin-top: 0;">🚨 Cảnh Báo Mất Kết Nối RPA Agent</h2>
                <p>Hệ thống phát hiện ứng dụng MXV RPA Agent trên máy <b>${status.hostname}</b> (${status.platform}) đã mất kết nối quá 3 phút!</p>
                <p><b>Lần cuối nhìn thấy hoạt động:</b> ${status.lastSeen.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
                <p style="color: #c62828; font-weight: bold;">Đề nghị bộ phận IT check lại máy tính hoặc restart ứng dụng Agent.</p>
              </div>
            </div>
          </body>
        </html>
        `;

      await transporter.sendMail({
        from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
        to: mailSettings.email.join(', '),
        subject,
        html: htmlBody,
      });

      this.logger.log(`Đã gửi email cảnh báo trạng thái Agent (${isOnline ? 'Online' : 'Offline'}) thành công.`);
    } catch (err: any) {
      this.logger.error(`Không thể gửi email cảnh báo trạng thái Agent: ${err.message}`);
    }
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
   * In RPA_AGENT_MODE=remote, Windows-only jobs are left PENDING for the
   * Windows RPA Agent to poll and execute. Only pure-compute jobs (reconciliation)
   * are handled directly on the Linux server.
   */
  /**
   * Chạy trực tiếp một job cụ thể qua CLI hoặc Agent.
   */
  public async executeJobDirectly(job: any): Promise<void> {
    if (job.jobType === 'RPA_DOWNLOAD_REPORTS') {
      await this.handleRpaDownloadJob(job);
    } else if (job.jobType === 'DOWNLOAD_CAST') {
      await this.handleDownloadCastJob(job);
    } else if (job.jobType === 'VERIFY_EMAIL_STATUS') {
      await this.handleVerifyEmailStatusJob(job);
    } else if (job.jobType === 'AUTO_CHECK_SOD') {
      await this.handleAutoCheckSodJob(job);
    } else if (job.jobType === 'CHECK_KLGD') {
      await this.handleCheckKlgdJob(job);
    } else if (job.jobType === 'CHECK_PRE_EOD') {
      await this.handleCheckPreEodJob(job);
    } else if (job.jobType === 'CHECK_EOD_MM') {
      await this.handleCheckEodMmJob(job);
    } else if (job.jobType === 'FILE_AUDIT_MS') {
      await this.handleFileAuditMsJob(job);
    } else if (job.jobType === 'FILE_AUDIT_CQG') {
      await this.handleFileAuditCqgJob(job);
    } else if (job.jobType === 'FILE_AUDIT_ACM') {
      await this.handleFileAuditAcmJob(job);
    } else if (job.jobType === 'RUN_LOT_MACRO') {
      await this.handleRunLotMacroJob(job);
    } else if (job.jobType === 'RUN_VALUE_MACRO') {
      await this.handleRunValueMacroJob(job);
    } else if (job.jobType === 'DOWNLOAD_CQG_BACKUP') {
      await this.handleDownloadCqgBackupJob(job);
    } else {
      throw new Error(`Loại job không được hỗ trợ: ${job.jobType}`);
    }
  }

  private async processQueue() {
    if (this.isProcessing) {
      return;
    }

    // ── Remote-mode: skip Windows-only jobs ──────────────────────────────────
    const isRemoteMode = process.env.RPA_AGENT_MODE === 'remote';
    const WINDOWS_ONLY_JOB_TYPES = [
      'RUN_LOT_MACRO',
      'RUN_VALUE_MACRO',
      'RUN_MACRO',
      'RPA_DOWNLOAD_REPORTS',
      'DOWNLOAD_CAST',
      'DOWNLOAD_CQG_BACKUP',
      'FILE_AUDIT_MS',
      'FILE_AUDIT_CQG',
      'FILE_AUDIT_ACM',
    ];

    // Build the query filter based on mode
    const jobFilter = isRemoteMode
      ? { status: 'PENDING', jobType: { $nin: WINDOWS_ONLY_JOB_TYPES } }
      : { status: 'PENDING' };

    // Fetch next PENDING job
    const job = await this.botJobModel.findOne(jobFilter).sort({ createdAt: 1 }).exec();
    if (!job) {
      return;
    }

    this.isProcessing = true;
    job.attempts += 1;
    const startTime = new Date().toISOString();
    job.logs.push(`[${startTime}] Starting attempt ${job.attempts}/${job.maxAttempts}...`);
    await this.syncJobToChecklist(job, 'PROCESSING');

    this.logger.log(`Processing job ${job.jobType} (ID: ${job._id}, Attempt: ${job.attempts})`);

    try {
      if (job.jobType === 'RPA_DOWNLOAD_REPORTS') {
        await this.handleRpaDownloadJob(job);
      } else if (job.jobType === 'DOWNLOAD_CAST') {
        await this.handleDownloadCastJob(job);
      } else if (job.jobType === 'VERIFY_EMAIL_STATUS') {
        await this.handleVerifyEmailStatusJob(job);
      } else if (job.jobType === 'AUTO_CHECK_SOD') {
        await this.handleAutoCheckSodJob(job);
      } else if (job.jobType === 'CHECK_KLGD') {
        await this.handleCheckKlgdJob(job);
      } else if (job.jobType === 'CHECK_PRE_EOD') {
        await this.handleCheckPreEodJob(job);
      } else if (job.jobType === 'CHECK_EOD_MM') {
        await this.handleCheckEodMmJob(job);
      } else if (job.jobType === 'FILE_AUDIT_MS') {
        await this.handleFileAuditMsJob(job);
      } else if (job.jobType === 'FILE_AUDIT_CQG') {
        await this.handleFileAuditCqgJob(job);
      } else if (job.jobType === 'FILE_AUDIT_ACM') {
        await this.handleFileAuditAcmJob(job);
      } else if (job.jobType === 'RUN_LOT_MACRO') {
        await this.handleRunLotMacroJob(job);
      } else if (job.jobType === 'RUN_VALUE_MACRO') {
        await this.handleRunValueMacroJob(job);
      } else if (job.jobType === 'RUN_MACRO') {
        await this.handleRunMacroJob(job);
      } else if (job.jobType === 'DOWNLOAD_CQG_BACKUP') {
        await this.handleDownloadCqgBackupJob(job);
      } else {
        throw new Error(`Loại job không được hỗ trợ: ${job.jobType}`);
      }

      await this.syncJobToChecklist(job, 'COMPLETED');
      this.logger.log(`Job ${job.jobType} (ID: ${job._id}) completed successfully.`);
    } catch (err: any) {
      const errorMsg = err.message || 'Lỗi không xác định';
      this.logger.error(`Job ${job.jobType} (ID: ${job._id}) failed: ${errorMsg}`);
      
      job.logs.push(`[${new Date().toISOString()}] Attempt ${job.attempts} failed: ${errorMsg}`);
      
      if (job.attempts < job.maxAttempts) {
        await this.syncJobToChecklist(job, 'PENDING', errorMsg);
      } else {
        // Gửi email cảnh báo lỗi vận hành khi job thất bại vĩnh viễn trước khi sync status sang FAILED
        await this.sendOperationalFailureAlert(job, errorMsg).catch((emailErr) => {
          this.logger.error(`Lỗi khi gọi sendOperationalFailureAlert: ${emailErr.message}`);
        });
        await this.syncJobToChecklist(job, 'FAILED', errorMsg);
      }
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

      // Copy downloaded reports to Backup MS folder if configured
      const backupMsBase = payload.backupPathMs
        || await this.settingsService.getSetting(
          'bot_backup_path_ms',
          process.env.DEFAULT_BACKUP_PATH_MS || 'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures'
        );

      if (backupMsBase) {
        const targetDate = sessionDay ? new Date(sessionDay) : new Date();
        const year = targetDate.getFullYear().toString();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
        const destFolder = path.join(backupMsBase, subFolder);

        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true });
        }

        job.logs.push(`[${new Date().toISOString()}] Copying downloaded reports to Backup MS folder: ${destFolder}`);
        for (const target of targets) {
          const filename = this.getReportFileName(target);
          const srcFile = path.join(tempDir, filename);
          if (fs.existsSync(srcFile)) {
            const destFile = path.join(destFolder, filename);
            fs.copyFileSync(srcFile, destFile);
            job.logs.push(`[${new Date().toISOString()}] ✅ Copied ${filename} to ${destFile}`);
          }
        }
        await job.save();
      }
    } finally {
      this.logger.log('Closing Playwright browser context.');
      await browser.close().catch((err) => {
        this.logger.error(`Error closing browser: ${err.message}`);
      });
    }
  }

  /**
   * Handle verification of M-System email history status.
   */
  private async handleVerifyEmailStatusJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const { taskId, shiftLogId, sessionDay } = payload;
    
    job.logs.push(`[${new Date().toISOString()}] Bắt đầu chạy RPA xác minh email sao kê...`);
    await job.save();

    const tempDir = path.join(process.cwd(), 'temp', 'email-verify', shiftLogId || 'default');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      job.logs.push(`[${new Date().toISOString()}] Đang đăng nhập và tải báo cáo gửi email từ M-System Admin...`);
      await job.save();

      const filePath = await this.rpaDownloaderService.downloadEmailHistoryReport(tempDir, sessionDay);
      job.logs.push(`[${new Date().toISOString()}] Đã tải file lịch sử gửi email thành công: ${path.basename(filePath)}`);
      await job.save();

      job.logs.push(`[${new Date().toISOString()}] Đang phân tích file báo cáo...`);
      await job.save();

      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      let checkDateStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (sessionDay && sessionDay.includes('-')) {
        const parts = sessionDay.split('-');
        if (parts.length === 3) {
          checkDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      } else {
        const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
        const dd = String(todayVN.getUTCDate()).padStart(2, '0');
        const mm = String(todayVN.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = todayVN.getUTCFullYear().toString();
        checkDateStr = `${dd}-${mm}-${yyyy}`;
      }

      job.logs.push(`[${new Date().toISOString()}] Ngày cần kiểm tra: ${checkDateStr}`);
      await job.save();

      const matchingRows = data.filter((r: any) => {
        const title = String(r['Tiêu đề'] || '').toLowerCase();
        const sendDate = String(r['Ngày gửi'] || '');
        const matchesTitle = title.includes('sao kê') || title.includes('sao ke');
        const matchesDate = sendDate.includes(checkDateStr);
        return matchesTitle && matchesDate;
      });

      job.logs.push(`[${new Date().toISOString()}] Tìm thấy ${matchingRows.length} email sao kê trong ngày ${checkDateStr}`);
      await job.save();

      if (matchingRows.length === 0) {
        throw new Error(`Không tìm thấy bản ghi gửi email sao kê nào trong ngày ${checkDateStr}. Vui lòng kiểm tra đã gửi thủ công trên M-System chưa.`);
      }

      const failedRows = matchingRows.filter((r: any) => {
        const status = String(r['Trạng thái'] || '').toLowerCase();
        return status.includes('thất bại') || status.includes('fail') || status === 'false' || !status;
      });

      if (failedRows.length > 0) {
        const failedDetails = failedRows.map((r: any) => `${r['Email/SĐT']} (${r['Tiêu đề']})`).join(', ');
        job.logs.push(`[${new Date().toISOString()}] Phát hiện ${failedRows.length} email gửi thất bại: ${failedDetails}`);
        
        job.payload = {
          ...payload,
          totalCount: matchingRows.length,
          failedCount: failedRows.length,
          failedList: failedDetails.substring(0, 1000),
        };
        job.markModified('payload');
        await job.save();

        const alertMsg = `⚠️ <b>[CẢNH BÁO LỖI GỬI EMAIL SAO KÊ]</b>\n` +
          `Hệ thống phát hiện lỗi gửi email sao kê giao dịch ngày <b>${checkDateStr}</b>:\n\n` +
          `• Tổng số email: <b>${matchingRows.length}</b>\n` +
          `• Số lượng lỗi: <b>${failedRows.length}</b>\n\n` +
          `<b>Chi tiết lỗi:</b>\n` +
          failedRows.slice(0, 10).map((r: any) => `• <code>${r['Email/SĐT']}</code> - <i>${r['Tiêu đề']}</i>`).join('\n') +
          (failedRows.length > 10 ? `\n... và ${failedRows.length - 10} email khác.` : '') + `\n\n` +
          `Đề nghị bộ phận trực ca kiểm tra lại cấu hình hoặc liên hệ đối tác để gửi lại sao kê!`;
        
        await this.telegramService.sendMessage(alertMsg).catch((err) => {
          this.logger.error(`Lỗi gửi thông báo Telegram: ${err.message}`);
        });
      } else {
        job.logs.push(`[${new Date().toISOString()}] Toàn bộ ${matchingRows.length} email sao kê đã được gửi thành công.`);
        job.payload = {
          ...payload,
          totalCount: matchingRows.length,
          failedCount: 0,
        };
        job.markModified('payload');
        await job.save();
      }

    } catch (err: any) {
      job.logs.push(`[${new Date().toISOString()}] Lỗi khi chạy job: ${err.message}`);
      await job.save();
      throw err;
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
    const existingFiles = fs.existsSync(backupPath) ? fs.readdirSync(backupPath) : [];

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

      // Fuzzy check for minor spacing/naming variations (e.g. market truoc 6 h.csv vs market truoc 6h.csv)
      const normalizedTarget = filename.toLowerCase().replace(/\s+/g, '');
      const matchedFile = existingFiles.find(f => f.toLowerCase().replace(/\s+/g, '') === normalizedTarget);

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

    const failedFiles: string[] = [];
    try {
      for (const item of missingOrOutdated) {
        const destFile = path.join(backupPath, item.filename);
        job.logs.push(`[${new Date().toISOString()}] Đang tải bổ sung: ${item.filename}...`);
        await job.save();

        try {
          const downloaded = await this.rpaDownloaderService.downloadByTarget(page, item.key, destFile);
          if (downloaded) {
            job.logs.push(`[${new Date().toISOString()}] ✅ Tải thành công: ${item.filename}`);
          } else {
            job.logs.push(`[${new Date().toISOString()}] ⚠️ Không có method tải tự động cho: ${item.filename}. Cần tải thủ công.`);
            failedFiles.push(`${item.filename} (Chưa hỗ trợ tải tự động)`);
          }
        } catch (dlErr: any) {
          job.logs.push(`[${new Date().toISOString()}] ❌ Lỗi khi tải ${item.filename}: ${dlErr.message}`);
          failedFiles.push(`${item.filename} (${dlErr.message})`);
        }
        await job.save();
        
        // Tránh lỗi 429 Too Many Requests từ phía server bằng cách giãn cách giữa các lần tải 5 giây
        await page.waitForTimeout(5000).catch(() => {});
      }

      if (failedFiles.length > 0) {
        throw new Error(`Thiếu/Lỗi tải bổ sung ${failedFiles.length} file M-System: ${failedFiles.join('; ')}`);
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
      const errorDetails = result.logs
        .filter((l) => l.includes('❌') || l.includes('Lỗi') || l.includes('Thiếu') || l.includes('thất bại'))
        .join(' | ');
      throw new Error(`Ghép file CQG thất bại: ${errorDetails || 'Thiếu file nguồn CQG hoặc sai định dạng.'}`);
    }
  }

  /**
   * DOWNLOAD_CQG_BACKUP job handler:
   * Đăng nhập CQG web (account 1 và/hoặc account 2), tải FR/PS/OP/OD về thư mục backup
   * rồi trigger merge (autoMergeMissingFiles) như FILE_AUDIT_CQG thông thường.
   *
   * Payload:
   *   targetDate?: string (ISO date, mặc định = hôm nay)
   *   reports?: { FR1, PS1, OP1, OD1, FR2, PS2, OP2, OD2 } — mặc định tải tất cả
   *   skipMerge?: boolean — nếu true, bỏ qua bước merge sau khi tải
   */
  private async handleDownloadCqgBackupJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const targetDate = payload.targetDate ? new Date(payload.targetDate) : new Date();

    // Xác định danh sách file cần tải (mặc định: tất cả)
    const defaultReports = { FR1: true, PS1: true, OP1: true, OD1: true, FR2: true, PS2: true, OP2: true, OD2: true, AS: true };
    const reports: Partial<Record<'FR1' | 'PS1' | 'OP1' | 'OD1' | 'FR2' | 'PS2' | 'OP2' | 'OD2' | 'AS', boolean>> =
      payload.reports || defaultReports;

    // Resolve thư mục backup CQG theo ngày
    const { fullPath } = await this.cqgSyncService.getDailyBackupPath(targetDate);

    job.logs.push(`[${new Date().toISOString()}] Bắt đầu tải file CQG từ web tới: ${fullPath}`);
    job.logs.push(`[${new Date().toISOString()}] File cần tải: ${Object.entries(reports).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
    await job.save();

    // Gọi downloadCqgBackup
    const { errors, downloaded } = await this.rpaDownloaderService.downloadCqgBackup(reports, fullPath);

    for (const f of downloaded) {
      job.logs.push(`[${new Date().toISOString()}] ✅ Đã tải: ${f}`);
    }
    for (const e of errors) {
      job.logs.push(`[${new Date().toISOString()}] ⚠️ ${e}`);
    }
    await job.save();

    if (downloaded.length === 0) {
      throw new Error(`Không tải được file nào từ CQG. Lỗi: ${errors.join(' | ')}`);
    }

    // Trigger merge (tương tự FILE_AUDIT_CQG) trừ khi skipMerge = true
    if (!payload.skipMerge) {
      job.logs.push(`[${new Date().toISOString()}] Bắt đầu merge file CQG...`);
      await job.save();

      const mergeResult = await this.cqgSyncService.autoMergeMissingFiles(targetDate);
      for (const logLine of mergeResult.logs) {
        job.logs.push(`[${new Date().toISOString()}] ${logLine}`);
      }
      await job.save();

      if (!mergeResult.success) {
        const errDetails = mergeResult.logs
          .filter((l) => l.includes('❌') || l.includes('Lỗi') || l.includes('Thiếu'))
          .join(' | ');
        throw new Error(`Tải CQG thành công nhưng merge thất bại: ${errDetails}`);
      }
    }
  }

  /**
   * Tự động quét và dọn dẹp các Job bị treo ở trạng thái PROCESSING quá 30 phút.
   * Chuyển chúng thành trạng thái FAILED kèm log giải thích.
   */
  private async cleanupStuckJobs(forceAllOnStartup = false): Promise<void> {
    try {
      const timeoutThreshold = forceAllOnStartup 
        ? new Date() 
        : new Date(Date.now() - 3 * 60 * 1000); // 3 minutes timeout

      const stuckJobs = await this.botJobModel.find({
        status: { $in: ['PROCESSING', 'AWAITING_CAPTCHA'] },
        updatedAt: { $lt: timeoutThreshold },
      }).exec();

      if (stuckJobs.length > 0) {
        this.logger.log(`Phát hiện ${stuckJobs.length} Job bị treo hoặc dở dang. Đang tự động reset...`);
        for (const job of stuckJobs) {
          job.status = 'FAILED';
          job.logs.push(`[${new Date().toISOString()}] Job tự động chuyển sang FAILED do bị treo quá 3 phút hoặc Server khởi động lại.`);
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
   * Đồng bộ hóa trạng thái Job với Checklist Task và phát sự kiện Realtime qua WebSockets.
   */
  public async syncJobToChecklist(job: BotJob, status: string, errorMsg?: string): Promise<void> {
    job.status = status as any;
    
    // Đảm bảo cập nhật log tương ứng với trạng thái
    const nowStr = new Date().toISOString();
    if (status === 'PROCESSING') {
      job.logs.push(`[${nowStr}] Job status transitioned to PROCESSING.`);
    } else if (status === 'COMPLETED') {
      job.logs.push(`[${nowStr}] Job completed successfully.`);
    } else if (status === 'FAILED') {
      job.logs.push(`[${nowStr}] Job failed permanently: ${errorMsg || 'Lỗi không xác định'}`);
    } else if (status === 'PENDING') {
      job.logs.push(`[${nowStr}] Job status transitioned to PENDING (requeued for retry).`);
    } else if (status === 'AWAITING_CAPTCHA') {
      job.logs.push(`[${nowStr}] Job status transitioned to AWAITING_CAPTCHA.`);
    }

    await job.save();

    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const shiftLogId = payload.shiftLogId;
    const taskId = payload.taskId;

    // 1. Cập nhật trạng thái Checklist Task tương ứng trong ShiftLog
    if (shiftLogId && taskId) {
      try {
        const systemUser = {
          id: '000000000000000000000000',
          fullName: 'Hệ thống tự động (Bot)',
          username: 'system_bot',
          role: 'ADMIN',
        };

        const getReconciliationJson = (jobType: string, payload: any, success: boolean): string | null => {
          const result = payload?.result;
          if (!result) return null;
          const runInfo = `• Lượt quét: Lượt #${job.attempts || 1}/${job.maxAttempts || 3} (Lúc ${new Date().toLocaleTimeString('vi-VN')})\n`;

          if (jobType === 'AUTO_CHECK_SOD') {
            let note = `[ĐỐI CHIẾU SỐ DƯ CQG TỰ ĐỘNG]\n`;
            note += runInfo;
            const discrepancies = result.discrepancies || [];
            note += `• Số tài khoản chênh lệch (> 100 USD): ${discrepancies.length}\n`;
            if (discrepancies.length > 0) {
              note += `⚠️ Danh sách tài khoản lệch:\n`;
              discrepancies.slice(0, 10).forEach((r: any) => {
                note += `  - TK ${r.maTKGD}: MS $${r.calculatedBalance} vs CQG $${r.cqgBalance} (Chênh lệch: $${r.differ?.toFixed(2)})\n`;
              });
              if (discrepancies.length > 10) {
                note += `  ... và ${discrepancies.length - 10} tài khoản khác.\n`;
              }
            } else {
              note += `✓ Số dư khớp hoàn toàn giữa M-System và CQG.\n`;
            }
            return JSON.stringify({
              success,
              message: note,
              result: discrepancies,
              type: 'CQG',
              usdRate: result.usdRate,
              attempts: job.attempts || 1,
              maxAttempts: job.maxAttempts || 3,
              executedAt: new Date().toISOString()
            });
          }

          if (jobType === 'CHECK_KLGD') {
            let note = `[ĐỐI CHIẾU KLGD]\n`;
            note += runInfo;
            if (result.sessionStart && result.checkTime) {
              const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
              const endStr = new Date(result.checkTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
              note += `• Khoảng thời gian lọc: từ ${startStr} đến ${endStr}\n`;
            }
            note += `• Tổng lot M-System: ${result.totals?.totalDSGD || 0} lot\n`;
            note += `• Tổng lot CQG: ${result.totals?.totalFR || 0} lot (Chênh lệch: ${result.totals?.differ || 0} lot)\n`;
            note += `• Tổng lot ACM: ${result.totals?.totalACM || 0} lot\n`;
            note += `• Tổng lot Nano: ${result.totals?.totalNano || 0} lot (Chênh lệch: ${result.totals?.differACM || 0} lot)\n`;
            note += `• Tất toán M-System (TTTT): ${result.totals?.totalTTTT || 0} lot\n`;
            note += `• Tổng PS CQG (S Value): ${result.totals?.totalPS || 0} lot (Chênh lệch: ${result.totals?.differTTTT || 0} lot)\n`;

            const mismatchedTrades = result.mismatchedTrades || [];
            if (mismatchedTrades.length > 0) {
              note += `⚠️ Phát hiện ${mismatchedTrades.length} giao dịch lệch chi tiết:\n`;
              mismatchedTrades.slice(0, 10).forEach((t: any) => {
                note += `  - [${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}, Giá ${t.giaKhop}, Qty ${t.klGiaoDich}: ${t.reason}\n`;
              });
            } else {
              note += `✓ Dữ liệu khớp hoàn toàn.\n`;
            }

            return JSON.stringify({
              success,
              message: note,
              result,
              type: 'KLGD',
              attempts: job.attempts || 1,
              maxAttempts: job.maxAttempts || 3,
              executedAt: new Date().toISOString()
            });
          }

          if (jobType === 'CHECK_PRE_EOD') {
            let note = `[ĐỐI CHIẾU TRƯỚC EOD]\n`;
            note += runInfo;
            if (result.sessionStart && result.checkTime) {
              const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
              const endStr = new Date(result.checkTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
              note += `• Khoảng thời gian lọc: từ ${startStr} đến ${endStr}\n`;
            }
            const totals = result.totals || {};
            note += `• Khớp lệnh tự doanh (MS vs Straits): ${totals.totalACM_MS || 0} vs ${totals.totalACM_Straits || 0} lot (Chênh lệch: ${totals.differACM || 0} lot)\n`;
            note += `• Khớp lệnh thường (MS vs CQG): ${totals.totalCQG_MS || 0} vs ${totals.totalCQG_FR || 0} lot (Chênh lệch: ${totals.differCQG || 0} lot)\n`;
            
            const mismatchedPositions = result.mismatchedPositions || [];
            note += `• Chênh lệch vị thế net position (MS vs CQG): ${mismatchedPositions.length} tài khoản\n`;

            const mismatchedTrades = result.mismatchedTrades || [];
            if (mismatchedTrades.length > 0) {
              note += `⚠️ Phát hiện ${mismatchedTrades.length} giao dịch bị lệch chi tiết:\n`;
              mismatchedTrades.slice(0, 10).forEach((m: any) => {
                note += `  - [${m.source}] TK ${m.maTKGD}, HĐ ${m.maHD}, Giá ${m.giaKhop}, Qty ${m.klGiaoDich}: ${m.reason}\n`;
              });
              if (mismatchedTrades.length > 10) {
                note += `  - ... và ${mismatchedTrades.length - 10} giao dịch khác.\n`;
              }
            } else {
              note += `✓ Không có lệch chi tiết khớp lệnh.\n`;
            }

            if (mismatchedPositions.length > 0) {
              note += `⚠️ Phát hiện ${mismatchedPositions.length} chênh lệch vị thế ròng (net position) chi tiết:\n`;
              mismatchedPositions.slice(0, 10).forEach((m: any) => {
                note += `  - TK ${m.account}, HĐ ${m.symbol}: MS ${m.msPosition} vs CQG ${m.cqgPosition} (Chênh lệch: ${m.differ})\n`;
              });
              if (mismatchedPositions.length > 10) {
                note += `  - ... và ${mismatchedPositions.length - 10} chênh lệch khác.\n`;
              }
            }
            return JSON.stringify({
              success,
              message: note,
              result,
              type: 'PRE_EOD',
              attempts: job.attempts || 1,
              maxAttempts: job.maxAttempts || 3,
              executedAt: new Date().toISOString()
            });
          }

          if (jobType === 'CHECK_EOD_MM') {
            const eodResult = result.eodResult || {};
            const cqgResult = result.cqgResult || [];
            const negativeBalanceAccsCount = eodResult.negativeBalanceAccs?.length || 0;
            const negativeIMRAccCount = eodResult.negativeIMRAcc?.length || 0;
            
            let note = `[ĐỐI CHIẾU SỐ DƯ EOD (LỌC TK ÂM KÝ QUỸ)]\n`;
            note += runInfo;
            note += `• Số tài khoản âm số dư hiện tại (QLTKGD): ${negativeBalanceAccsCount}\n`;
            note += `• Số tài khoản âm ký quỹ khả dụng (EOD): ${negativeIMRAccCount}\n`;

            if (negativeBalanceAccsCount > 0) {
              note += `🚨 Tài khoản âm số dư hiện tại: ${eodResult.negativeBalanceAccs?.join(', ')}\n`;
            }
            if (negativeIMRAccCount > 0) {
              note += `🚨 Tài khoản âm ký quỹ khả dụng: ${eodResult.negativeIMRAcc.join(', ')}\n`;
            }
            if (negativeBalanceAccsCount === 0 && negativeIMRAccCount === 0) {
              note += `✓ Không phát hiện tài khoản âm số dư / âm ký quỹ.\n`;
            }

            note += `\n[ĐỐI CHIẾU SỐ DƯ CQG TỰ ĐỘNG]\n`;
            note += `• Số tài khoản chênh lệch (> 100 USD): ${cqgResult.length}\n`;
            if (cqgResult.length > 0) {
              note += `⚠️ Danh sách tài khoản lệch:\n`;
              cqgResult.slice(0, 10).forEach((r: any) => {
                note += `  - TK ${r.maTKGD}: MS $${r.calculatedBalance} vs CQG $${r.cqgBalance} (Chênh lệch: $${r.differ?.toFixed(2)})\n`;
              });
              if (cqgResult.length > 10) {
                note += `  ... và ${cqgResult.length - 10} tài khoản khác.\n`;
              }
            } else {
              note += `✓ Số dư khớp hoàn toàn giữa M-System và CQG.\n`;
            }
            return JSON.stringify({
              success,
              message: note,
              result: {
                negativeBalanceAccs: eodResult.negativeBalanceAccs || [],
                negativeIMRAcc: eodResult.negativeIMRAcc || [],
                cqgResult: cqgResult
              },
              type: 'EOD',
              attempts: job.attempts || 1,
              maxAttempts: job.maxAttempts || 3,
              executedAt: new Date().toISOString()
            });
          }

          return null;
        };

        if (status === 'PROCESSING') {
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'WAITING',
            systemUser,
            'Hệ thống đang thực hiện tác vụ tự động...',
            true
          );
        } else if (status === 'COMPLETED') {
          let message = 'Tác vụ tự động hoàn thành thành công.';
          if (job.jobType === 'RPA_DOWNLOAD_REPORTS') {
            const targets = payload.targets || [];
            message = `RPA tải báo cáo thành công: ${targets.join(', ')}`;
          } else if (job.jobType === 'DOWNLOAD_CAST') {
            message = 'Tải báo cáo CQG CAST Balances thành công.';
          } else if (['AUTO_CHECK_SOD', 'CHECK_PRE_EOD', 'CHECK_EOD_MM', 'CHECK_KLGD'].includes(job.jobType)) {
            const jsonMsg = getReconciliationJson(job.jobType, payload, true);
            if (jsonMsg) {
              message = jsonMsg;
            } else if (job.jobType === 'AUTO_CHECK_SOD') {
              message = 'Đối chiếu số dư đầu ngày SOD khớp hoàn toàn.';
            } else {
              message = 'Đối chiếu tự động hoàn thành thành công.';
            }
          } else if (['FILE_AUDIT_ACM', 'FILE_AUDIT_CQG', 'FILE_AUDIT_MS', 'RUN_MACRO', 'RUN_LOT_MACRO', 'RUN_VALUE_MACRO'].includes(job.jobType)) {
            message = job.logs.join('\n');
          } else if (job.jobType === 'VERIFY_EMAIL_STATUS') {
            const failedCount = payload.failedCount || 0;
            const totalCount = payload.totalCount || 0;
            const failedList = payload.failedList || '';
            const checkData = {
              success: failedCount === 0,
              message: failedCount === 0
                ? `Tất cả email sao kê đã được gửi thành công (${totalCount} email).`
                : `Phát hiện ${failedCount} email gửi thất bại trên tổng số ${totalCount} email.`,
              data: { totalCount, failedCount, failedList, timestamp: new Date().toISOString() }
            };
            message = JSON.stringify(checkData);
          }

          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'PASSED',
            systemUser,
            message,
            true
          );
        } else if (status === 'FAILED') {
          const lastLog = job.logs[job.logs.length - 1] || errorMsg || 'Lỗi không xác định';
          let message = lastLog;

          if (['AUTO_CHECK_SOD', 'CHECK_PRE_EOD', 'CHECK_EOD_MM', 'CHECK_KLGD'].includes(job.jobType)) {
            const jsonMsg = getReconciliationJson(job.jobType, payload, false);
            if (jsonMsg) {
              message = jsonMsg;
            } else {
              message = job.logs.join('\n');
            }
          } else if (['FILE_AUDIT_ACM', 'FILE_AUDIT_CQG', 'FILE_AUDIT_MS', 'RUN_MACRO', 'RUN_LOT_MACRO', 'RUN_VALUE_MACRO'].includes(job.jobType)) {
            message = job.logs.join('\n');
          } else if (job.jobType === 'VERIFY_EMAIL_STATUS') {
            const checkData = {
              success: false,
              message: `RPA xác minh email thất bại: ${lastLog}`,
              data: { totalCount: 0, failedCount: 0, failedList: '', timestamp: new Date().toISOString() }
            };
            message = JSON.stringify(checkData);
          }

          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'FAILED',
            systemUser,
            ['FILE_AUDIT_ACM', 'FILE_AUDIT_CQG', 'FILE_AUDIT_MS', 'AUTO_CHECK_SOD', 'CHECK_PRE_EOD', 'CHECK_EOD_MM', 'CHECK_KLGD', 'RUN_MACRO', 'RUN_LOT_MACRO', 'RUN_VALUE_MACRO'].includes(job.jobType)
              ? message
              : (message.includes('SLA') ? message : `Kiểm tra tự động thất bại: ${message}`),
            true
          );
        }
      } catch (err: any) {
        this.logger.error(`Lỗi cập nhật trạng thái checklist cho Job ${job._id}: ${err.message}`);
      }
    }

    // 2. Phát sự kiện Realtime WebSocket qua ShiftsGateway
    try {
      const targetDate = payload.targetDate || payload.sessionDay || new Date().toISOString().split('T')[0];
      this.shiftsGateway.emitEvent(
        'DASHBOARD_UPDATED',
        job._id.toString(),
        null,
        null,
        targetDate,
        {
          jobId: job._id.toString(),
          status,
          jobType: job.jobType,
          shiftLogId,
          taskId,
        }
      );
      this.logger.log(`Emitted dashboard-updated WS event for job ${job._id} (${status})`);
    } catch (err: any) {
      this.logger.error(`Lỗi phát sự kiện Realtime WebSocket: ${err.message}`);
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
      job.logs.push(`[${new Date().toISOString()}] Đã nhận mã Captcha từ người dùng: "${captchaText}". Tiếp tục đăng nhập...`);
      await this.syncJobToChecklist(job, 'PROCESSING');
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
    const targetDateStr = payload.targetDate || payload.sessionDay;
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

    let saveQueue = Promise.resolve();
    const logAndSave = async (msg: string) => {
      const logEntry = `[${new Date().toISOString()}] ${msg}`;
      job.logs.push(logEntry);
      
      saveQueue = saveQueue.then(async () => {
        try {
          await this.botJobModel.updateOne(
            { _id: job._id },
            { $push: { logs: logEntry } }
          ).exec();
        } catch (dbErr: any) {
          this.logger.error(`Lỗi khi lưu log thời gian thực: ${dbErr.message}`);
        }
      });
      await saveQueue;
    };

    await logAndSave(`Bắt đầu kiểm tra file backup ACM tại thư mục: ${dailyPath}`);

    const scanResults = await this.scanAcmBackupFiles(dailyPath, targetDate);
    const missingOrOutdated = scanResults.filter(r => r.status !== 'OK');

    if (missingOrOutdated.length === 0) {
      await logAndSave(`✅ Tất cả báo cáo ACM (Web & SFTP) đã đầy đủ. Không cần tải thêm.`);
      return;
    }

    // 1. Tải báo cáo từ Web ACM nếu thiếu
    const webMissing = missingOrOutdated.some(r => r.key === 'ORDER' || r.key === 'FILL');
    if (webMissing) {
      await logAndSave(`⚠️ Thiếu báo cáo Web (Order/Fill). Đang tiến hành đăng nhập và tải bổ sung...`);

      // callback để đẩy Captcha lên UI nếu tự động giải bằng Gemini thất bại
      const getCaptchaFromUI = (base64Img: string): Promise<string> => {
        return new Promise<string>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            this.captchaResolvers.delete(job._id.toString());
            reject(new Error('Hết thời gian chờ người dùng nhập Captcha (5 phút).'));
          }, 5 * 60 * 1000);

          const currentPayload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
          job.payload = {
            ...currentPayload,
            captchaImage: base64Img,
          };
          
          logAndSave(`⚠️ Phát hiện Captcha. Đang chờ người dùng gõ mã xác nhận từ giao diện Web Checklist.`)
            .then(() => this.syncJobToChecklist(job, 'AWAITING_CAPTCHA'))
            .then(() => {
              this.captchaResolvers.set(job._id.toString(), (captcha: string) => {
                clearTimeout(timeoutId);
                resolve(captcha);
              });
            })
            .catch((err) => {
              clearTimeout(timeoutId);
              reject(err);
            });
        });
      };

      const { browser, page } = await this.rpaDownloaderService.loginACM(
        dailyPath,
        getCaptchaFromUI,
        logAndSave,
      );

      try {
        await this.rpaDownloaderService.downloadAcmBackup(page, dailyPath, logAndSave);
        await logAndSave(`✅ Tải thành công báo cáo tự doanh (Order & Fill) từ ACM.`);
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
      await logAndSave(`⚠️ Thiếu file từ SFTP. Đang chạy đồng bộ SFTP...`);
      try {
        await this.rpaDownloaderService.downloadAcmSftpBackup(dailyPath, targetDate, logAndSave);
        await logAndSave(`✅ Hoàn tất đồng bộ file từ SFTP.`);
      } catch (err: any) {
        await logAndSave(`⚠️ Cảnh báo lỗi đồng bộ SFTP: ${err.message}`);
        
        // Kiểm tra xem báo cáo Web đã tồn tại đầy đủ chưa
        const currentScan = await this.scanAcmBackupFiles(dailyPath, targetDate);
        const webReportsOk = currentScan
          .filter(r => r.key === 'ORDER' || r.key === 'FILL')
          .every(r => r.status === 'OK');
        
        if (webReportsOk) {
          await logAndSave(`ℹ️ Báo cáo Web (Order/Fill) đã đầy đủ. Chấp nhận lỗi SFTP và hoàn tất job với cảnh báo.`);
        } else {
          await logAndSave(`❌ Lỗi đồng bộ SFTP và Báo cáo Web cũng không đầy đủ. Thất bại job.`);
          throw err;
        }
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

    log(`Bắt đầu chạy thống kê số lot native cho ngày: ${targetDateStr}`);
    await safeSave();

    try {
      const targetDate = new Date(targetDateStr);
      const year = targetDate.getFullYear().toString();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');

      const backupMs = payload.backupPathMs
        || await this.settingsService.getSetting(
          'bot_backup_path_ms',
          process.env.DEFAULT_BACKUP_PATH_MS || 'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures'
        );
      const backupCqg = payload.backupPathCqg
        || await this.settingsService.getSetting(
          'bot_backup_path_cqg',
          process.env.DEFAULT_BACKUP_PATH_CQG || 'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures'
        );

      const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
      const folderPathMs = path.join(backupMs, subFolder);
      const folderPathCqg = path.join(backupCqg, subFolder);

      log(`Thư mục MS: ${folderPathMs}`);
      log(`Thư mục CQG: ${folderPathCqg}`);
      await safeSave();

      const files = this.lotStatisticsService.loadFilesFromDirectories(folderPathMs, folderPathCqg);
      log(`Nạp file thành công. Tiến hành chạy tính toán số lot...`);
      await safeSave();

      const lotConfig = await this.lotStatisticsService.getConfig();
      const filterLmeKyHan = lotConfig.defaultLmeKyHan || 'M26';

      const lastPartCqgIdx = backupCqg.lastIndexOf('\\');
      const parentBaseCqg = lastPartCqgIdx > 0 ? backupCqg.substring(0, lastPartCqgIdx) : backupCqg;

      const pathDsgdCumulative = lotConfig.defaultPathDsgdCumulative || `${folderPathMs}\\DSGD T${month}.${year}.xlsx`;
      const pathNormal = lotConfig.defaultPathNormal || `${folderPathCqg}\\Thong ke so lot giao dich ${year} 2.xlsx`;
      const pathAcm = lotConfig.defaultPathAcm || `${parentBaseCqg}\\ACM\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich ACM ${year} 2.xlsx`;
      const pathLme = lotConfig.defaultPathLme || `${parentBaseCqg}\\LME\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich LME ${year}.xlsx`;
      const pathOptions = lotConfig.defaultPathOptions || `${parentBaseCqg}\\Options\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich Options ${year}.xlsx`;
      const pathSpread = lotConfig.defaultPathSpread || `${parentBaseCqg}\\Spread\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich Spread ${year}.xlsx`;

      const parseDateArray = (input: any) => {
        if (!input) return [];
        if (Array.isArray(input)) return input;
        try {
          const parsed = JSON.parse(input);
          return Array.isArray(parsed) ? parsed : [input];
        } catch {
          if (typeof input === 'string') {
            return input.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
          return [];
        }
      };

      const processParams = {
        ngayGD: targetDateStr,
        truDates: parseDateArray(payload.truDates),
        fefDates: parseDateArray(payload.fefDates),
        zftDates: parseDateArray(payload.zftDates),
        filterLmeKyHan,
        deadline: payload.deadline ? parseFloat(payload.deadline) : undefined,
        updateCumulative: payload.updateCumulative === true || payload.updateCumulative === 'true',
        pathDsgdCumulative,
        pathNormal,
        pathAcm,
        pathLme,
        pathOptions,
        pathSpread,
      };

      const result = await this.lotStatisticsService.processLotStatistics(files, processParams);
      log(`✅ Chạy tính toán thống kê số lot thành công.`);
      log(`Kết quả: DSGD Product: ${result.summary.dsgdProduct}, FR Product: ${result.summary.frProduct}`);
      
      const allPassed = result.validations.every((v: any) => v.passed);
      if (allPassed) {
        log(`✅ Tất cả các kiểm tra đối chiếu (Validation) đều khớp.`);
      } else {
        log(`⚠️ Phát hiện chênh lệch đối chiếu:`);
        for (const val of result.validations) {
          if (!val.passed) {
            log(`   - ${val.field}: mong đợi ${val.expected}, thực tế ${val.actual}`);
          }
        }
      }

      await safeSave();
    } catch (err: any) {
      log(`❌ Lỗi chạy thống kê số lot: ${err.message}`);
      await safeSave();
      throw err;
    }
  }


  /**
   * Xử lý Job RUN_VALUE_MACRO: Sử dụng ValueStatisticsService để chạy tính toán native.
   */
  private async handleRunValueMacroJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const targetDateStr = payload.targetDate; // Định dạng YYYY-MM-DD
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate (YYYY-MM-DD) trong payload.');
    }

    // Chaining save calls to prevent Mongoose ParallelSaveError
    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise.then(() => job.save()).catch((err) => {
        this.logger.error(`Error saving bot job in handleRunValueMacroJob: ${err.message}`);
      });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(`Bắt đầu chạy thống kê giá trị giao dịch native cho ngày: ${targetDateStr}`);
    await safeSave();

    try {
      const targetDate = new Date(targetDateStr);
      const result = await this.valueStatisticsService.processValueStatistics(targetDate, payload);
      log(`✅ Chạy tính toán thống kê giá trị thành công.`);
      log(`Tỷ giá mặc định: ${result.tyGiaDefault}, TRU: ${result.tyGiaTru}, MPO: ${result.tyGiaMpo}`);
      log(`Tổng số dòng giao dịch Normal: ${result.normalCount}, Spread: ${result.spreadCount}`);
      await safeSave();
    } catch (err: any) {
      log(`❌ Lỗi chạy thống kê giá trị giao dịch: ${err.message}`);
      await safeSave();
      throw err;
    }
  }

  private async handleDownloadCastJob(job: BotJob) {
    const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');
    if (!fs.existsSync(castDownloadsDir)) {
      fs.mkdirSync(castDownloadsDir, { recursive: true });
    }

    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const dateStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '');
    const filename = `Accounts_Balances_${dateStr}_${Date.now()}.xlsx`;
    const destFile = path.join(castDownloadsDir, filename);

    job.logs.push(`[${new Date().toISOString()}] Bắt đầu chạy bot RPA CQG CAST để tải báo cáo số dư...`);
    job.logs.push(`[${new Date().toISOString()}] Đường dẫn lưu file dự kiến: ${destFile}`);
    await job.save();

    try {
      await this.rpaDownloaderService.downloadCastBalances(destFile);
      job.logs.push(`[${new Date().toISOString()}] Đã tải thành công file CAST về: ${destFile}`);
      
      payload.downloadedFile = destFile;
      job.payload = payload;
      await job.save();

      // Check if custom backup path is provided or configured in settings to copy and rename the file
      let baseBackupPath = payload.backupPath
        || await this.settingsService.getSetting(
          'bot_backup_path_cqg',
          process.env.DEFAULT_BACKUP_PATH_CQG || 'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures'
        );

      if (baseBackupPath) {
        // Lấy ngày cần chạy (mặc định là ngày hôm nay nếu không truyền targetDate)
        const targetDateStr = payload.targetDate;
        const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();

        const year = targetDate.getFullYear().toString();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
        
        // Ghép thêm thư mục ngày vào đường dẫn backup gốc
        const customBackupPath = path.join(baseBackupPath, subFolder);

        job.logs.push(`[${new Date().toISOString()}] Đang copy và đổi tên file sang thư mục backup: ${customBackupPath}`);
        await job.save();
        
        if (!fs.existsSync(customBackupPath)) {
          fs.mkdirSync(customBackupPath, { recursive: true });
        }
        
        const targetBackupFile = path.join(customBackupPath, 'Accounts_Balances.xlsx');
        fs.copyFileSync(destFile, targetBackupFile);
        
        job.logs.push(`[${new Date().toISOString()}] ✅ Đã copy và đổi tên thành công: ${targetBackupFile}`);
        await job.save();
      }
    } catch (err: any) {
      job.logs.push(`[${new Date().toISOString()}] Lỗi trong quá trình chạy RPA CQG CAST: ${err.message}`);
      await job.save();
      throw err;
    }
  }

  private async handleAutoCheckSodJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(`[${new Date().toISOString()}] Bắt đầu kiểm tra đối chiếu SOD tự động ngày ${dateStr}...`);
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckSOD(targetDate);
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu SOD.`);
      job.logs.push(`[${new Date().toISOString()}] Kết quả: ${result.success ? 'KHỚP' : 'LỆCH'}`);
      
      payload.result = result;
      job.payload = payload;
      await job.save();
      
      if (!result.success) {
        if (result.discrepancies && result.discrepancies.length > 0) {
          job.logs.push(`[${new Date().toISOString()}] Danh sách tài khoản lệch số dư:`);
          result.discrepancies.forEach((d: any) => {
            job.logs.push(`- [SOD] TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)} (Chênh lệch: $${d.differ.toFixed(2)})`);
          });
        }
        await job.save();
        throw new Error(`Phát hiện chênh lệch số dư tài khoản (> $100) giữa M-System và CQG CAST. Vui lòng kiểm tra báo cáo.`);
      }
    } catch (err: any) {
      job.logs.push(`[${new Date().toISOString()}] Lỗi đối chiếu SOD tự động: ${err.message}`);
      await job.save();
      throw err;
    }
  }

  private async handleCheckKlgdJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(`[${new Date().toISOString()}] Bắt đầu chạy đối chiếu khớp lệnh định kỳ trong phiên ngày ${dateStr}...`);
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckKLGD(targetDate);
      if (result.sessionStart && result.checkTime) {
        const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const endStr = new Date(result.checkTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        job.logs.push(`[${new Date().toISOString()}] Khoảng thời gian lọc: từ ${startStr} đến ${endStr}`);
      }
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu khớp lệnh định kỳ trong phiên.`);
      job.logs.push(`[${new Date().toISOString()}] Kết quả: ${result.passed ? 'KHỚP' : 'LỆCH'}`);
      payload.result = result;
      job.payload = payload;
      await job.save();

      if (!result.passed) {
        if (result.mismatchedTrades && result.mismatchedTrades.length > 0) {
          job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch khớp lệnh:`);
          result.mismatchedTrades.forEach((t: any) => {
            job.logs.push(`- [${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}, Giá ${t.giaKhop}, Qty ${t.klGiaoDich}: ${t.reason}`);
          });
        }
        await job.save();
        throw new Error(`Phát hiện chênh lệch khớp lệnh trong phiên (KLGD). Vui lòng kiểm tra báo cáo.`);
      }
    } catch (err: any) {
      job.logs.push(`[${new Date().toISOString()}] Lỗi đối chiếu khớp lệnh tự động: ${err.message}`);
      await job.save();
      throw err;
    }
  }

  private async handleCheckPreEodJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(`[${new Date().toISOString()}] Bắt đầu chạy đối chiếu Pre-EOD tự động ngày ${dateStr}...`);
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckPreEOD(targetDate);
      if (result.sessionStart && result.checkTime) {
        const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const endStr = new Date(result.checkTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        job.logs.push(`[${new Date().toISOString()}] Khoảng thời gian lọc: từ ${startStr} đến ${endStr}`);
      }
      if (result.isWaitingFiles) {
        job.logs.push(`[${new Date().toISOString()}] ${result.message}`);
      } else {
        job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu Pre-EOD.`);
        job.logs.push(`[${new Date().toISOString()}] Kết quả: ${result.passed ? 'KHỚP' : 'LỆCH'}`);
      }
      payload.result = result;
      job.payload = payload;
      await job.save();

      if (!result.passed) {
        if (result.mismatchedTrades && result.mismatchedTrades.length > 0) {
          job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch khớp lệnh:`);
          result.mismatchedTrades.forEach((t: any) => {
            job.logs.push(`- [${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}, Giá ${t.giaKhop}, Qty ${t.klGiaoDich}: ${t.reason}`);
          });
        }
        if (result.mismatchedPositions && result.mismatchedPositions.length > 0) {
          job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch vị thế Net:`);
          result.mismatchedPositions.forEach((p: any) => {
            job.logs.push(`- TK ${p.account}, HĐ ${p.symbol}: MS ${p.msPosition} vs CQG ${p.cqgPosition} (Chênh lệch: ${p.differ})`);
          });
        }
        await job.save();
        throw new Error(`Phát hiện chênh lệch khớp lệnh hoặc vị thế cuối ngày (Pre-EOD). Vui lòng kiểm tra báo cáo.`);
      }
    } catch (err: any) {
      job.logs.push(`[${new Date().toISOString()}] Lỗi đối chiếu Pre-EOD tự động: ${err.message}`);
      await job.save();
      throw err;
    }
  }

  private async handleCheckEodMmJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(`[${new Date().toISOString()}] Bắt đầu chạy đối chiếu EOD tự động ngày ${dateStr}...`);
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckEodMm(targetDate);
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu EOD.`);
      payload.result = result;
      job.payload = payload;
      await job.save();

      const totalNegative = result.eodResult.negativeBalanceAccs.length + result.eodResult.negativeIMRAcc.length;
      const totalMismatched = result.cqgResult.length;
      if (totalNegative > 0 || totalMismatched > 0) {
        if (result.cqgResult && result.cqgResult.length > 0) {
          job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch số dư CQG EOD:`);
          result.cqgResult.forEach((d: any) => {
            job.logs.push(`- [EOD] TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)} (Chênh lệch: $${d.differ.toFixed(2)})`);
          });
        }
        await job.save();
        throw new Error(`Phát hiện bất thường EOD: ${totalNegative} tài khoản âm margin/số dư, ${totalMismatched} tài khoản lệch số dư EOD CQG.`);
      }
    } catch (err: any) {
      job.logs.push(`[${new Date().toISOString()}] Lỗi đối chiếu EOD tự động: ${err.message}`);
      await job.save();
      throw err;
    }
  }

  private async sendOperationalFailureAlert(job: BotJob, errorMsg: string) {
    try {
      const configStr = await this.settingsService.getSetting('margin_checker_config', '{}');
      const config = JSON.parse(configStr);
      const mailSettings = config.opFailureAlert || { isSendWarning: true, email: ['it.support@mxv.vn'] };
      if (!mailSettings.isSendWarning) return;

      const smtp = config.smtp || {
        host: 'smtp.office365.com',
        port: 587,
        user: 'it.support@mxv.vn',
        pass: 'OFmng239',
        senderEmail: 'it.support@mxv.vn',
        senderName: 'MXV IT Support',
      };

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000, // 10s
        greetingTimeout: 10000,   // 10s
        socketTimeout: 15000,     // 15s
      });

      const payloadStr = JSON.stringify(job.payload instanceof Map ? Object.fromEntries(job.payload) : job.payload, null, 2);
      const lastLogs = job.logs.slice(-20).join('\n');

      const subject = `🚨 [MXV BOT FAILURE ALERT] Lỗi Vận Hành Bot Ngầm: ${job.jobType}`;
      const htmlBody = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
            <div style="max-width: 800px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid #c62828;">
              <div style="padding: 20px;">
                <h2 style="color: #c62828; margin-top: 0;">🚨 Cảnh Báo Lỗi Vận Hành Bot Ngầm (RPA/Scheduler)</h2>
                <p>Một background job của hệ thống đã thất bại vĩnh viễn sau khi thử lại tối đa <b>${job.maxAttempts} lần</b>.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 150px; background-color: #f8f9fa;">Mã Job (ID)</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${job._id}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f8f9fa;">Loại Job</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #c62828;">${job.jobType}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f8f9fa;">Số lượt thử</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${job.attempts}/${job.maxAttempts}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f8f9fa;">Thời gian tạo</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${job.createdAt || new Date()}</td>
                  </tr>
                </table>

                <div style="background-color: #ffebee; border-left: 4px solid #c62828; padding: 15px; margin-bottom: 20px; border-radius: 4px; color: #c62828;">
                  <strong>Chi tiết lỗi:</strong><br/>
                  <span style="font-family: monospace; white-space: pre-wrap;">${errorMsg}</span>
                </div>

                <h3>Payload của Job</h3>
                <pre style="background-color: #f8f9fa; padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px; overflow-x: auto;">${payloadStr}</pre>

                <h3>20 Dòng Logs Cuối Cùng của Job</h3>
                <pre style="background-color: #212121; color: #fff; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap;">${lastLogs}</pre>
              </div>
              <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd;">
                Đây là email tự động từ hệ thống MXV Shift Checklist.
              </div>
            </div>
          </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
        to: mailSettings.email.join(', '),
        subject,
        html: htmlBody,
      });

      this.logger.log(`Đã gửi email cảnh báo lỗi vận hành cho job ${job.jobType} thành công.`);
    } catch (err: any) {
      this.logger.error(`Không thể gửi email cảnh báo lỗi vận hành cho job ${job.jobType}: ${err.message}`);
    }
  }

  private async handleRunMacroJob(job: BotJob) {
    const payload = job.payload instanceof Map ? Object.fromEntries(job.payload) : (job.payload || {});
    const targetDateStr = payload.targetDate || payload.sessionDay;
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate/sessionDay trong payload.');
    }

    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise.then(() => job.save()).catch((err) => {
        this.logger.error(`Error saving bot job in handleRunMacroJob: ${err.message}`);
      });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(`Bắt đầu chạy macro thống kê số lô & giá trị giao dịch CCP cho ngày: ${targetDateStr}`);
    await safeSave();

    try {
      const targetDate = new Date(targetDateStr);
      const year = targetDate.getFullYear().toString();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');

      const backupMs = payload.backupPathMs
        || await this.settingsService.getSetting(
          'bot_backup_path_ms',
          'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures'
        );

      const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
      const dailyPath = path.join(backupMs, subFolder);

      log(`Thư mục MS Daily: ${dailyPath}`);
      await safeSave();

      if (!fs.existsSync(dailyPath)) {
        throw new Error(`Thư mục backup ngày ${targetDateStr} không tồn tại: ${dailyPath}`);
      }

      // Resolve 6 files
      const dsgdCcpPath = path.join(dailyPath, 'DSGD.xlsx');
      let dsgdMmCcpBuffer: Buffer;
      const dsgdMmCcpPathStd = path.join(dailyPath, 'DSGD MM CCP.xlsx');
      const dsgdMmCcpPath = path.join(dailyPath, 'DSGD-MM.xlsx');
      const dsgdMmCcpPath2 = path.join(dailyPath, 'DSGD_MM.xlsx');

      if (fs.existsSync(dsgdMmCcpPathStd)) {
        dsgdMmCcpBuffer = fs.readFileSync(dsgdMmCcpPathStd);
        log(`Tìm thấy file DSGD MM CCP tại: ${dsgdMmCcpPathStd}`);
      } else if (fs.existsSync(dsgdMmCcpPath)) {
        dsgdMmCcpBuffer = fs.readFileSync(dsgdMmCcpPath);
        log(`Tìm thấy file DSGD MM CCP tại: ${dsgdMmCcpPath}`);
      } else if (fs.existsSync(dsgdMmCcpPath2)) {
        dsgdMmCcpBuffer = fs.readFileSync(dsgdMmCcpPath2);
        log(`Tìm thấy file DSGD MM CCP tại: ${dsgdMmCcpPath2}`);
      } else {
        dsgdMmCcpBuffer = this.createEmptyDsgdBuffer();
        log(`Không tìm thấy file DSGD MM CCP riêng biệt. Khởi tạo buffer trống.`);
      }

      const dstkgdPath = path.join(dailyPath, 'DSTKGD-Futures.xlsx');
      const dstkgdPathFallback = path.join(dailyPath, 'DSTKGD.xlsx');
      const nrPath = path.join(dailyPath, 'NR.xlsx');
      const ttmPath = path.join(dailyPath, 'TTM.xlsx');
      const ttttPath = path.join(dailyPath, 'TTTT.xlsx');

      // Verification
      if (!fs.existsSync(dsgdCcpPath)) {
        throw new Error(`Thiếu file giao dịch CCP (DSGD.xlsx) tại: ${dailyPath}`);
      }
      const finalDstkgdPath = fs.existsSync(dstkgdPath) ? dstkgdPath : (fs.existsSync(dstkgdPathFallback) ? dstkgdPathFallback : null);
      if (!finalDstkgdPath) {
        throw new Error(`Thiếu file danh sách tài khoản giao dịch (DSTKGD-Futures.xlsx hoặc DSTKGD.xlsx) tại: ${dailyPath}`);
      }
      if (!fs.existsSync(nrPath)) {
        throw new Error(`Thiếu file nộp rút (NR.xlsx) tại: ${dailyPath}`);
      }
      if (!fs.existsSync(ttmPath)) {
        throw new Error(`Thiếu file trạng thái mở (TTM.xlsx) tại: ${dailyPath}`);
      }
      if (!fs.existsSync(ttttPath)) {
        throw new Error(`Thiếu file trạng thái tất toán (TTTT.xlsx) tại: ${dailyPath}`);
      }

      log(`Tất cả 6 file báo cáo đã được nạp thành công.`);
      await safeSave();

      const files = {
        dsgdCcp: fs.readFileSync(dsgdCcpPath),
        dsgdMmCcp: dsgdMmCcpBuffer,
        dstkgd: fs.readFileSync(finalDstkgdPath),
        nr: fs.readFileSync(nrPath),
        ttm: fs.readFileSync(ttmPath),
        tttt: fs.readFileSync(ttttPath),
      };

      log(`Bắt đầu xử lý dữ liệu báo cáo CCP qua CcpStatisticsService...`);
      await safeSave();

      const outputPath = await this.ccpStatisticsService.processCcpData(files, targetDate);

      log(`✅ Chạy báo cáo CCP thành công. File kết quả: ${outputPath}`);
      await safeSave();
    } catch (err: any) {
      log(`❌ Lỗi chạy báo cáo thống kê CCP: ${err.message}`);
      await safeSave();
      throw err;
    }
  }

  private createEmptyDsgdBuffer(): Buffer {
    const headers = [
      'STT', 'Mã lệnh', 'Mã giao dịch', 'Mã TKGD', 'Tên TKGD',
      'Mã HĐ', 'Tên HĐ', 'Hình thức lệnh', 'Loại lệnh', 'Phương thức ghép',
      'Chiều mua bán', 'KL đặt lệnh', 'KL giao dịch', 'Giá khớp', 'Giá giới hạn',
      'Giá dừng', 'Phí quyền chọn (USD)', 'Phí quyền chọn (VND)', 'Phí giao dịch',
      'Người đặt lệnh', 'Ngày giờ đặt lệnh', 'Ngày giờ thực hiện', 'Mã TVKD',
      'Tên TVKD', 'Mã MG', 'Tên MG', 'Mã CTV', 'Tên CTV', 'Nhóm hàng hoá'
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
