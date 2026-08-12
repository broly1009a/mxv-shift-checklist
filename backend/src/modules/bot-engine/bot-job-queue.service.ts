import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
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
import { MarginCheckerService } from '../margin-checker/margin-checker.service';
import * as XLSX from 'xlsx';

// =========================================================================
// Danh sách file MS bắt buộc phải có trong thư mục backup IT
// key: dùng để gọi downloadByTarget khi cần tải bổ sung
// filename: tên file trong thư mục backup
// =========================================================================
const REQUIRED_MS_FILES: Array<{ key: string; filename: string }> = [
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
export class BotJobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotJobQueueService.name);
  private isProcessing = false;
  private readonly captchaResolvers = new Map<
    string,
    (captcha: string) => void
  >();
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
    private readonly marginCheckerService: MarginCheckerService,
  ) {}

  onModuleInit() {
    // Dọn dẹp các Job bị treo ở trạng thái PROCESSING khi khởi động server
    this.cleanupStuckJobs(true).catch((err) => {
      this.logger.error(
        `Lỗi khi dọn dẹp các Job bị treo lúc khởi động: ${err.message}`,
      );
    });

    // Khởi chạy vòng lặp worker ngầm mỗi 10 giây
    this.queueInterval = setInterval(() => {
      this.processQueue().catch((err) => {
        this.logger.error(
          `Error in background queue loop: ${err.message}`,
          err.stack,
        );
      });
    }, 10000);

    // Chạy dọn dẹp định kỳ mỗi 5 phút một lần
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupStuckJobs().catch((err) => {
          this.logger.error(
            `Lỗi khi dọn dẹp định kỳ các Job bị treo: ${err.message}`,
          );
        });
      },
      5 * 60 * 1000,
    );

    // Kiểm tra kết nối của Agent mỗi 60 giây
    this.healthInterval = setInterval(() => {
      this.checkAgentConnectionHealth().catch((err) => {
        this.logger.error(`Lỗi khi kiểm tra kết nối Agent: ${err.message}`);
      });
    }, 60000);

    this.logger.log(
      'Background BotJob queue worker initialized (polling every 10s).',
    );
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

  private async sendConnectionAlertEmail(
    status: { hostname: string; platform: string; lastSeen: Date },
    isOnline: boolean,
  ) {
    try {
      const config = await this.marginCheckerService.loadConfig();
      const mailSettings = config.opFailureAlert || {
        isSendWarning: true,
        email: ['it.support@mxv.vn'],
      };
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
        ? `[MXV RPA AGENT] Kết Nối Đã Được Phục Hồi: ${status.hostname}`
        : `[MXV RPA AGENT] Cảnh Báo Mất Kết Nối: ${status.hostname}`;

      const htmlBody = isOnline
        ? `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid #2e7d32;">
              <div style="padding: 20px;">
                <h2 style="color: #2e7d32; margin-top: 0;">Khôi Phục Kết Nối RPA Agent</h2>
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
                <h2 style="color: #c62828; margin-top: 0;">Cảnh Báo Mất Kết Nối RPA Agent</h2>
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

      this.logger.log(
        `Đã gửi email cảnh báo trạng thái Agent (${isOnline ? 'Online' : 'Offline'}) thành công.`,
      );
    } catch (err: any) {
      this.logger.error(
        `Không thể gửi email cảnh báo trạng thái Agent: ${err.message}`,
      );
    }
  }

  /**
   * Enqueues a new background job.
   */
  async enqueue(
    jobType: string,
    payload: Record<string, any> = {},
  ): Promise<BotJob> {
    // If a job of the same type and payload (e.g. same taskId) is already pending or processing, reuse/return it
    if (payload.taskId) {
      const existing = await this.botJobModel
        .findOne({
          jobType,
          status: { $in: ['PENDING', 'PROCESSING'] },
          'payload.taskId': payload.taskId,
        })
        .exec();

      if (existing) {
        this.logger.log(
          `Job of type ${jobType} for task ${payload.taskId} already exists in queue. Status: ${existing.status}`,
        );
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

    if (payload.shiftLogId && payload.taskId) {
      try {
        await this.syncJobToChecklist(job, 'PENDING');
      } catch (err: any) {
        this.logger.error(`Failed to sync enqueued job to checklist: ${err.message}`);
      }
    }

    return job;
  }

  /**
   * Gets job status for a given checklist task and shift log.
   */
  async getJobForTask(
    taskId: string,
    shiftLogId: string,
  ): Promise<BotJob | null> {
    return this.botJobModel
      .findOne({
        'payload.taskId': taskId,
        'payload.shiftLogId': shiftLogId,
      })
      .sort({ createdAt: -1 })
      .exec();
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

    // ── Remote-mode: skip Windows-only jobs (Đã comment lại vì chạy 100% trên Ubuntu) ───────────────────
    /*
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
    */

    // Chạy tất cả các job PENDING trực tiếp trên local (Ubuntu)
    const jobFilter = { status: 'PENDING' };

    // Fetch next PENDING job
    const job = await this.botJobModel
      .findOne(jobFilter)
      .sort({ createdAt: 1 })
      .exec();
    if (!job) {
      return;
    }

    this.isProcessing = true;
    job.attempts += 1;
    const startTime = new Date().toISOString();
    job.logs.push(
      `[${startTime}] Starting attempt ${job.attempts}/${job.maxAttempts}...`,
    );
    await this.syncJobToChecklist(job, 'PROCESSING');

    this.logger.log(
      `Processing job ${job.jobType} (ID: ${job._id}, Attempt: ${job.attempts})`,
    );

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
      } else if (job.jobType === 'RUN_VALUE_TVKD_MACRO') {
        await this.handleRunValueTvkdMacroJob(job);
      } else if (job.jobType === 'RUN_MACRO') {
        await this.handleRunMacroJob(job);
      } else if (job.jobType === 'DOWNLOAD_CQG_BACKUP') {
        await this.handleDownloadCqgBackupJob(job);
      } else {
        throw new Error(`Loại job không được hỗ trợ: ${job.jobType}`);
      }

      await this.syncJobToChecklist(job, 'COMPLETED');
      this.logger.log(
        `Job ${job.jobType} (ID: ${job._id}) completed successfully.`,
      );
    } catch (err: any) {
      const errorMsg = err.message || 'Lỗi không xác định';
      this.logger.error(
        `Job ${job.jobType} (ID: ${job._id}) failed: ${errorMsg}`,
      );

      job.logs.push(
        `[${new Date().toISOString()}] Attempt ${job.attempts} failed: ${errorMsg}`,
      );

      if (job.attempts < job.maxAttempts) {
        await this.syncJobToChecklist(job, 'PENDING', errorMsg);
      } else {
        // Gửi email cảnh báo lỗi vận hành khi job thất bại vĩnh viễn trước khi sync status sang FAILED
        await this.sendOperationalFailureAlert(job, errorMsg).catch(
          (emailErr) => {
            this.logger.error(
              `Lỗi khi gọi sendOperationalFailureAlert: ${emailErr.message}`,
            );
          },
        );
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
    const tempDir = path.join(
      process.cwd(),
      'temp',
      'reports',
      job._id.toString(),
    );
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    const targets: string[] = payload.targets || [
      'NKTTHT',
      'NR',
      'QLTKGD',
      'DSGD',
    ];
    const sessionDay: string = payload.sessionDay;

    job.logs.push(
      `[${new Date().toISOString()}] Reports to download: ${targets.join(', ')}`,
    );
    await job.save();

    // 2. Perform Login
    const { browser, page } =
      await this.rpaDownloaderService.loginMSystem(tempDir);

    try {
      // 3. Process each download sequential
      for (const target of targets) {
        const filename = this.getReportFileName(target);
        const destFile = path.join(tempDir, filename);
        job.logs.push(
          `[${new Date().toISOString()}] Downloading report: ${target} (as ${filename})...`,
        );
        await job.save();

        switch (target) {
          case 'NKTTHT':
            await this.rpaDownloaderService.downloadNKTTHT(page, destFile);
            break;
          case 'DSTKGD-Futures':
            await this.rpaDownloaderService.downloadDSTKGDFutures(
              page,
              destFile,
            );
            break;
          case 'DSTKGD-Spread':
            await this.rpaDownloaderService.downloadDSTKGDSpread(
              page,
              destFile,
            );
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
            await this.rpaDownloaderService.downloadQLTTTKGDAmKQ(
              page,
              destFile,
            );
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
            await this.rpaDownloaderService.downloadMarkettruoc6h(
              page,
              destFile,
            );
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
            await this.rpaDownloaderService.downloadDSGD(
              page,
              destFile,
              sessionDay,
            );
            break;
          case 'TTM':
            await this.rpaDownloaderService.downloadTTM(page, destFile);
            break;
          case 'TTTT':
            await this.rpaDownloaderService.downloadTTTT(page, destFile);
            break;
          default:
            this.logger.warn(`Unknown download target skipped: ${target}`);
            job.logs.push(
              `[${new Date().toISOString()}] Warning: Unknown download target skipped: ${target}`,
            );
        }

        job.logs.push(
          `[${new Date().toISOString()}] Downloaded report: ${target} successfully.`,
        );
        await job.save();
      }

      // Copy downloaded reports to Backup MS folder if configured
      const backupMsBase =
        payload.backupPathMs ||
        (await this.settingsService.getSetting(
          'bot_backup_path_ms',
          process.env.DEFAULT_BACKUP_PATH_MS ||
            'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
        ));

      if (backupMsBase) {
        const targetDate = sessionDay ? new Date(sessionDay) : new Date();
        const year = targetDate.getFullYear().toString();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const subFolder = path.join(
          year,
          `T${month}.${year}`,
          `${day}.${month}`,
        );
        const destFolder = path.join(backupMsBase, subFolder);

        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true });
        }

        job.logs.push(
          `[${new Date().toISOString()}] Copying downloaded reports to Backup MS folder: ${destFolder}`,
        );
        for (const target of targets) {
          const filename = this.getReportFileName(target);
          const srcFile = path.join(tempDir, filename);
          if (fs.existsSync(srcFile)) {
            const destFile = path.join(destFolder, filename);
            fs.copyFileSync(srcFile, destFile);
            job.logs.push(
              `[${new Date().toISOString()}] ✅ Copied ${filename} to ${destFile}`,
            );
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
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    const { taskId, shiftLogId, sessionDay } = payload;

    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy RPA xác minh email sao kê...`,
    );
    await job.save();

    const tempDir = path.join(
      process.cwd(),
      'temp',
      'email-verify',
      shiftLogId || 'default',
    );
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      job.logs.push(
        `[${new Date().toISOString()}] Đang đăng nhập và tải báo cáo gửi email từ M-System Admin...`,
      );
      await job.save();

      const filePath =
        await this.rpaDownloaderService.downloadEmailHistoryReport(
          tempDir,
          sessionDay,
        );
      job.logs.push(
        `[${new Date().toISOString()}] Đã tải file lịch sử gửi email thành công: ${path.basename(filePath)}`,
      );
      await job.save();

      job.logs.push(
        `[${new Date().toISOString()}] Đang phân tích file báo cáo...`,
      );
      await job.save();

      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      let checkDateStr = new Date(Date.now() + 7 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
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

      job.logs.push(
        `[${new Date().toISOString()}] Ngày cần kiểm tra: ${checkDateStr}`,
      );
      await job.save();

      const matchingRows = data.filter((r: any) => {
        const title = String(r['Tiêu đề'] || '').toLowerCase();
        const sendDate = String(r['Ngày gửi'] || '');
        const matchesTitle =
          title.includes('sao kê') || title.includes('sao ke');
        const matchesDate = sendDate.includes(checkDateStr);
        return matchesTitle && matchesDate;
      });

      job.logs.push(
        `[${new Date().toISOString()}] Tìm thấy ${matchingRows.length} email sao kê trong ngày ${checkDateStr}`,
      );
      await job.save();

      if (matchingRows.length === 0) {
        throw new Error(
          `Không tìm thấy bản ghi gửi email sao kê nào trong ngày ${checkDateStr}. Vui lòng kiểm tra đã gửi thủ công trên M-System chưa.`,
        );
      }

      const failedRows = matchingRows.filter((r: any) => {
        const status = String(r['Trạng thái'] || '').toLowerCase();
        return (
          status.includes('thất bại') ||
          status.includes('fail') ||
          status === 'false' ||
          !status
        );
      });

      if (failedRows.length > 0) {
        const failedDetails = failedRows
          .map((r: any) => `${r['Email/SĐT']} (${r['Tiêu đề']})`)
          .join(', ');
        job.logs.push(
          `[${new Date().toISOString()}] Phát hiện ${failedRows.length} email gửi thất bại: ${failedDetails}`,
        );

        job.payload = {
          ...payload,
          totalCount: matchingRows.length,
          failedCount: failedRows.length,
          failedList: failedDetails.substring(0, 1000),
        };
        job.markModified('payload');
        await job.save();

        const alertMsg =
          `⚠️ <b>[CẢNH BÁO LỖI GỬI EMAIL SAO KÊ]</b>\n` +
          `Hệ thống phát hiện lỗi gửi email sao kê giao dịch ngày <b>${checkDateStr}</b>:\n\n` +
          `• Tổng số email: <b>${matchingRows.length}</b>\n` +
          `• Số lượng lỗi: <b>${failedRows.length}</b>\n\n` +
          `<b>Chi tiết lỗi:</b>\n` +
          failedRows
            .slice(0, 10)
            .map(
              (r: any) =>
                `• <code>${r['Email/SĐT']}</code> - <i>${r['Tiêu đề']}</i>`,
            )
            .join('\n') +
          (failedRows.length > 10
            ? `\n... và ${failedRows.length - 10} email khác.`
            : '') +
          `\n\n` +
          `Đề nghị bộ phận trực ca kiểm tra lại cấu hình hoặc liên hệ đối tác để gửi lại sao kê!`;

        await this.telegramService.sendMessage(alertMsg).catch((err) => {
          this.logger.error(`Lỗi gửi thông báo Telegram: ${err.message}`);
        });
      } else {
        job.logs.push(
          `[${new Date().toISOString()}] Toàn bộ ${matchingRows.length} email sao kê đã được gửi thành công.`,
        );
        job.payload = {
          ...payload,
          totalCount: matchingRows.length,
          failedCount: 0,
        };
        job.markModified('payload');
        await job.save();
      }
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi khi chạy job: ${err.message}`,
      );
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
  async scanMsBackupFiles(
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

      // Fuzzy check for minor spacing/naming variations (e.g. market truoc 6 h.csv vs market truoc 6h.csv)
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

  /**
   * FILE_AUDIT_MS job handler:
   * 1. Scan backup dir for missing files
   * 2. If any missing → login M-System → download only missing files
   */
  private async handleFileAuditMsJob(job: BotJob) {
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    const targetDateStr = payload.targetDate;
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();

    const msBackupBase =
      payload.backupPath ||
      (await this.settingsService.getSetting(
        'bot_backup_path_ms',
        'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
      ));

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const dailyPath = path.join(msBackupBase, subFolder);

    if (!fs.existsSync(dailyPath)) {
      fs.mkdirSync(dailyPath, { recursive: true });
    }

    const backupPath = dailyPath;

    job.logs.push(
      `[${new Date().toISOString()}] Thư mục backup: ${backupPath}`,
    );
    await job.save();

    // 1. Scan
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

    // 2. Login M-System chỉ khi có file cần tải
    const { browser, page } =
      await this.rpaDownloaderService.loginMSystem(backupPath);

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

        // Tránh lỗi 429 Too Many Requests từ phía server bằng cách giãn cách giữa các lần tải 5 giây
        await page.waitForTimeout(5000).catch(() => {});
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
    const currentPayload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
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

  /**
   * FILE_AUDIT_CQG job handler:
   * Runs the CqgSyncService autoMergeMissingFiles to scan and consolidate CQG backup files.
   */
  private async handleFileAuditCqgJob(job: BotJob) {
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    const targetDate = payload.targetDate
      ? new Date(payload.targetDate)
      : new Date();
    const { fullPath } =
      await this.cqgSyncService.getDailyBackupPath(targetDate);

    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu kiểm tra file backup CQG tại thư mục: ${fullPath}`,
    );
    await job.save();

    // Run auto merge
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
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    const targetDate = payload.targetDate
      ? new Date(payload.targetDate)
      : new Date();

    // Xác định danh sách file cần tải (mặc định: tất cả)
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

    // Resolve thư mục backup CQG theo ngày
    const { fullPath } =
      await this.cqgSyncService.getDailyBackupPath(targetDate);

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

    // Gọi downloadCqgBackup
    const { errors, downloaded } =
      await this.rpaDownloaderService.downloadCqgBackup(reports, fullPath);

    for (const f of downloaded) {
      job.logs.push(`[${new Date().toISOString()}] ✅ Đã tải: ${f}`);
    }
    for (const e of errors) {
      job.logs.push(`[${new Date().toISOString()}] ⚠️ ${e}`);
    }
    await job.save();

    if (downloaded.length === 0) {
      throw new Error(
        `Không tải được file nào từ CQG. Lỗi: ${errors.join(' | ')}`,
      );
    }

    // Trigger merge (tương tự FILE_AUDIT_CQG) trừ khi skipMerge = true
    if (!payload.skipMerge) {
      job.logs.push(`[${new Date().toISOString()}] Bắt đầu merge file CQG...`);
      await job.save();

      const mergeResult =
        await this.cqgSyncService.autoMergeMissingFiles(targetDate);
      for (const logLine of mergeResult.logs) {
        job.logs.push(`[${new Date().toISOString()}] ${logLine}`);
      }
      await job.save();

      if (!mergeResult.success) {
        const errDetails = mergeResult.logs
          .filter(
            (l) => l.includes('❌') || l.includes('Lỗi') || l.includes('Thiếu'),
          )
          .join(' | ');
        throw new Error(
          `Tải CQG thành công nhưng merge thất bại: ${errDetails}`,
        );
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

      const stuckJobs = await this.botJobModel
        .find({
          status: { $in: ['PROCESSING', 'AWAITING_CAPTCHA'] },
          updatedAt: { $lt: timeoutThreshold },
        })
        .exec();

      if (stuckJobs.length > 0) {
        this.logger.log(
          `Phát hiện ${stuckJobs.length} Job bị treo hoặc dở dang. Đang tự động reset...`,
        );
        for (const job of stuckJobs) {
          job.status = 'FAILED';
          job.logs.push(
            `[${new Date().toISOString()}] Job tự động chuyển sang FAILED do bị treo quá 3 phút hoặc Server khởi động lại.`,
          );
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
  public async syncJobToChecklist(
    job: BotJob,
    status: string,
    errorMsg?: string,
  ): Promise<void> {
    job.status = status;

    // Đảm bảo cập nhật log tương ứng với trạng thái
    const nowStr = new Date().toISOString();
    if (status === 'PROCESSING') {
      job.logs.push(`[${nowStr}] Job status transitioned to PROCESSING.`);
    } else if (status === 'COMPLETED') {
      job.logs.push(`[${nowStr}] Job completed successfully.`);
    } else if (status === 'FAILED') {
      job.logs.push(
        `[${nowStr}] Job failed permanently: ${errorMsg || 'Lỗi không xác định'}`,
      );
    } else if (status === 'PENDING') {
      job.logs.push(
        `[${nowStr}] Job status transitioned to PENDING (requeued for retry).`,
      );
    } else if (status === 'AWAITING_CAPTCHA') {
      job.logs.push(`[${nowStr}] Job status transitioned to AWAITING_CAPTCHA.`);
    }

    await job.save();

    const jobObj = job.toObject();
    const payload = jobObj.payload || {};
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

        const getReconciliationJson = (
          jobType: string,
          payload: any,
          success: boolean,
        ): string | null => {
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
              executedAt: new Date().toISOString(),
            });
          }

          if (jobType === 'CHECK_KLGD') {
            let note = `[ĐỐI CHIẾU KLGD]\n`;
            note += runInfo;
            if (result.sessionStart && result.checkTime) {
              const startStr = new Date(result.sessionStart).toLocaleString(
                'vi-VN',
                { timeZone: 'Asia/Ho_Chi_Minh' },
              );
              const endStr = new Date(result.checkTime).toLocaleString(
                'vi-VN',
                { timeZone: 'Asia/Ho_Chi_Minh' },
              );
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
            } else if (result.isWaitingFiles) {
              note += `⚠️ ${result.message || 'Đang chờ cập nhật file đối chiếu...'}\n`;
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
              executedAt: new Date().toISOString(),
            });
          }

          if (jobType === 'CHECK_PRE_EOD') {
            let note = `[ĐỐI CHIẾU TRƯỚC EOD]\n`;
            note += runInfo;
            if (result.sessionStart && result.checkTime) {
              const startStr = new Date(result.sessionStart).toLocaleString(
                'vi-VN',
                { timeZone: 'Asia/Ho_Chi_Minh' },
              );
              const endStr = new Date(result.checkTime).toLocaleString(
                'vi-VN',
                { timeZone: 'Asia/Ho_Chi_Minh' },
              );
              note += `• Khoảng thời gian lọc: từ ${startStr} đến ${endStr}\n`;
            }
            if (result.isWaitingFiles) {
              note += `⚠️ ${result.message || 'Đang chờ cập nhật file đối chiếu...'}\n`;
            } else {
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
            }
            return JSON.stringify({
              success,
              message: note,
              result,
              type: 'PRE_EOD',
              attempts: job.attempts || 1,
              maxAttempts: job.maxAttempts || 3,
              executedAt: new Date().toISOString(),
            });
          }

          if (jobType === 'CHECK_EOD_MM') {
            const eodResult = result.eodResult || {};
            const cqgResult = result.cqgResult || [];
            const negativeBalanceAccsCount =
              eodResult.negativeBalanceAccs?.length || 0;
            const negativeIMRAccCount = eodResult.negativeIMRAcc?.length || 0;

            let note = `[ĐỐI CHIẾU SỐ DƯ EOD (LỌC TK ÂM KÝ QUỸ)]\n`;
            note += runInfo;
            note += `• Số tài khoản âm số dư hiện tại (QLTKGD): ${negativeBalanceAccsCount}\n`;
            note += `• Số tài khoản âm ký quỹ khả dụng (EOD): ${negativeIMRAccCount}\n`;

            if (negativeBalanceAccsCount > 0) {
              note += `• Tài khoản âm số dư hiện tại: ${eodResult.negativeBalanceAccs?.join(', ')}\n`;
            }
            if (negativeIMRAccCount > 0) {
              note += `• Tài khoản âm ký quỹ khả dụng: ${eodResult.negativeIMRAcc.join(', ')}\n`;
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
                cqgResult: cqgResult,
              },
              type: 'EOD',
              attempts: job.attempts || 1,
              maxAttempts: job.maxAttempts || 3,
              executedAt: new Date().toISOString(),
            });
          }

          return null;
        };

        if (status === 'PROCESSING' || status === 'PENDING') {
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'WAITING',
            systemUser,
            'Hệ thống đang thực hiện tác vụ tự động...',
            true,
          );
        } else if (status === 'COMPLETED') {
          let message = 'Tác vụ tự động hoàn thành thành công.';
          if (job.jobType === 'RPA_DOWNLOAD_REPORTS') {
            const targets = payload.targets || [];
            message = `RPA tải báo cáo thành công: ${targets.join(', ')}`;
          } else if (job.jobType === 'DOWNLOAD_CAST') {
            message = 'Tải báo cáo CQG CAST Balances thành công.';
          } else if (
            [
              'AUTO_CHECK_SOD',
              'CHECK_PRE_EOD',
              'CHECK_EOD_MM',
              'CHECK_KLGD',
            ].includes(job.jobType)
          ) {
            const isWaitingFiles = payload?.result?.isWaitingFiles;
            const jsonMsg = getReconciliationJson(job.jobType, payload, !isWaitingFiles);
            if (jsonMsg) {
              message = jsonMsg;
            } else if (job.jobType === 'AUTO_CHECK_SOD') {
              message = 'Đối chiếu số dư đầu ngày SOD khớp hoàn toàn.';
            } else {
              message = 'Đối chiếu tự động hoàn thành thành công.';
            }
          } else if (
            [
              'FILE_AUDIT_ACM',
              'FILE_AUDIT_CQG',
              'FILE_AUDIT_MS',
              'RUN_MACRO',
              'RUN_LOT_MACRO',
              'RUN_VALUE_MACRO',
            ].includes(job.jobType)
          ) {
            message = job.logs.join('\n');
          } else if (job.jobType === 'VERIFY_EMAIL_STATUS') {
            const failedCount = payload.failedCount || 0;
            const totalCount = payload.totalCount || 0;
            const failedList = payload.failedList || '';
            const checkData = {
              success: failedCount === 0,
              message:
                failedCount === 0
                  ? `Tất cả email sao kê đã được gửi thành công (${totalCount} email).`
                  : `Phát hiện ${failedCount} email gửi thất bại trên tổng số ${totalCount} email.`,
              data: {
                totalCount,
                failedCount,
                failedList,
                timestamp: new Date().toISOString(),
              },
            };
            message = JSON.stringify(checkData);
          }

          const isWaitingFiles = payload?.result?.isWaitingFiles;
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            isWaitingFiles ? 'WAITING' : 'PASSED',
            systemUser,
            message,
            true,
          );
        } else if (status === 'FAILED') {
          const lastLog =
            job.logs[job.logs.length - 1] || errorMsg || 'Lỗi không xác định';
          let message = lastLog;

          if (
            [
              'AUTO_CHECK_SOD',
              'CHECK_PRE_EOD',
              'CHECK_EOD_MM',
              'CHECK_KLGD',
            ].includes(job.jobType)
          ) {
            const jsonMsg = getReconciliationJson(job.jobType, payload, false);
            if (jsonMsg) {
              message = jsonMsg;
            } else {
              message = job.logs.join('\n');
            }
          } else if (
            [
              'FILE_AUDIT_ACM',
              'FILE_AUDIT_CQG',
              'FILE_AUDIT_MS',
              'RUN_MACRO',
              'RUN_LOT_MACRO',
              'RUN_VALUE_MACRO',
            ].includes(job.jobType)
          ) {
            message = job.logs.join('\n');
          } else if (job.jobType === 'VERIFY_EMAIL_STATUS') {
            const checkData = {
              success: false,
              message: `RPA xác minh email thất bại: ${lastLog}`,
              data: {
                totalCount: 0,
                failedCount: 0,
                failedList: '',
                timestamp: new Date().toISOString(),
              },
            };
            message = JSON.stringify(checkData);
          }

          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'FAILED',
            systemUser,
            [
              'FILE_AUDIT_ACM',
              'FILE_AUDIT_CQG',
              'FILE_AUDIT_MS',
              'AUTO_CHECK_SOD',
              'CHECK_PRE_EOD',
              'CHECK_EOD_MM',
              'CHECK_KLGD',
              'RUN_MACRO',
              'RUN_LOT_MACRO',
              'RUN_VALUE_MACRO',
            ].includes(job.jobType)
              ? message
              : message.includes('SLA')
                ? message
                : `Kiểm tra tự động thất bại: ${message}`,
            true,
          );
        }
      } catch (err: any) {
        this.logger.error(
          `Lỗi cập nhật trạng thái checklist cho Job ${job._id}: ${err.message}`,
        );
      }
    }

    // 2. Phát sự kiện Realtime WebSocket qua ShiftsGateway
    try {
      const targetDate =
        payload.targetDate ||
        payload.sessionDay ||
        new Date().toISOString().split('T')[0];
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
        },
      );
      this.logger.log(
        `Emitted dashboard-updated WS event for job ${job._id} (${status})`,
      );
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
      throw new Error(
        'Không tìm thấy phiên giải Captcha hợp lệ hoặc đã hết hạn.',
      );
    }

    const job = await this.botJobModel.findById(jobId).exec();
    if (job) {
      job.logs.push(
        `[${new Date().toISOString()}] Đã nhận mã Captcha từ người dùng: "${captchaText}". Tiếp tục đăng nhập...`,
      );
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
      acmBackupBase =
        acmBackupBase.substring(0, acmBackupBase.length - 'Futures'.length) +
        'ACM';
    } else if (acmBackupBase.endsWith('Futures\\')) {
      acmBackupBase =
        acmBackupBase.substring(0, acmBackupBase.length - 'Futures\\'.length) +
        'ACM';
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
  async scanAcmBackupFiles(
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

    // 1. Quét 2 file Excel từ Web
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

    // 2. Quét các file SFTP (CSV và XLS) trong ngày hôm nay
    if (fs.existsSync(backupPath)) {
      const files = fs.readdirSync(backupPath);
      const year = today.getFullYear().toString();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const ddmmyyyy = `${day}${month}${year}`;
      const yyyy_mm_dd = `${year}-${month}-${day}`;

      // Check CSV: *_${ddmmyyyy}.csv
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

      // Check XLS: ${yyyy_mm_dd}_*.xls
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

  /**
   * Xử lý Job FILE_AUDIT_ACM.
   */
  private async handleFileAuditAcmJob(job: BotJob) {
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
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

    // 1. Tải báo cáo từ Web ACM nếu thiếu
    const webMissing = missingOrOutdated.some(
      (r) => r.key === 'ORDER' || r.key === 'FILL',
    );
    if (webMissing) {
      await logAndSave(
        `⚠️ Thiếu báo cáo Web (Order/Fill). Đang tiến hành đăng nhập và tải bổ sung...`,
      );

      // callback để đẩy Captcha lên UI nếu tự động giải bằng Gemini thất bại
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

          const currentPayload =
            job.payload instanceof Map
              ? Object.fromEntries(job.payload)
              : job.payload || {};
          job.payload = {
            ...currentPayload,
            captchaImage: base64Img,
          };

          logAndSave(
            `⚠️ Phát hiện Captcha. Đang chờ người dùng gõ mã xác nhận từ giao diện Web Checklist.`,
          )
            .then(() => this.syncJobToChecklist(job, 'AWAITING_CAPTCHA'))
            .then(() => {
              this.captchaResolvers.set(
                job._id.toString(),
                (captcha: string) => {
                  clearTimeout(timeoutId);
                  resolve(captcha);
                },
              );
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
        await this.rpaDownloaderService.downloadAcmBackup(
          page,
          dailyPath,
          logAndSave,
        );
        await logAndSave(
          `✅ Tải thành công báo cáo tự doanh (Order & Fill) từ ACM.`,
        );
      } finally {
        this.logger.log('Closing Playwright browser after ACM audit.');
        await browser.close().catch((err) => {
          this.logger.error(`Error closing browser: ${err.message}`);
        });
      }
    }

    // 2. Đồng bộ file dump/log từ SFTP nếu thiếu
    const sftpMissing = missingOrOutdated.some(
      (r) => r.key === 'SFTP_CSV' || r.key === 'SFTP_XLS',
    );
    if (sftpMissing) {
      await logAndSave(`⚠️ Thiếu file từ SFTP. Đang chạy đồng bộ SFTP...`);
      try {
        await this.rpaDownloaderService.downloadAcmSftpBackup(
          dailyPath,
          targetDate,
          logAndSave,
        );
        await logAndSave(`✅ Hoàn tất đồng bộ file từ SFTP.`);
      } catch (err: any) {
        await logAndSave(`⚠️ Cảnh báo lỗi đồng bộ SFTP: ${err.message}`);

        // Kiểm tra xem báo cáo Web đã tồn tại đầy đủ chưa
        const currentScan = await this.scanAcmBackupFiles(
          dailyPath,
          targetDate,
        );
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
    const currentPayload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
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

  /**
   * Xử lý Job RUN_LOT_MACRO: Gọi script Python điều phối Excel headlessly.
   */
  private async handleRunLotMacroJob(job: BotJob) {
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    const targetDateStr = payload.targetDate; // Định dạng YYYY-MM-DD
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate (YYYY-MM-DD) trong payload.');
    }

    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise
        .then(() => job.save())
        .catch((err) => {
          this.logger.error(
            `Error saving bot job in handleRunLotMacroJob: ${err.message}`,
          );
        });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    const targetDate = new Date(targetDateStr);
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');

    log(`[Macro Thống kê Số Lốt] Bắt đầu chạy tính toán [Thống kê số lốt giao dịch có ACM] cho ngày: ${targetDateStr}`);
    log(`[Macro Thống kê Số Lốt] Báo cáo đầu ra sẽ cập nhật vào các tệp cumulative: Thong ke so lot giao dich ${year} 2.xlsx, Thong ke so lot giao dich ACM/LME/Options...`);
    await safeSave();

    try {

      const backupMs =
        payload.backupPathMs ||
        (await this.settingsService.getSetting(
          'bot_backup_path_ms',
          process.env.DEFAULT_BACKUP_PATH_MS ||
            'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
        ));
      const backupCqg =
        payload.backupPathCqg ||
        (await this.settingsService.getSetting(
          'bot_backup_path_cqg',
          process.env.DEFAULT_BACKUP_PATH_CQG ||
            'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
        ));

      const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
      const folderPathMs = path.join(backupMs, subFolder);
      const folderPathCqg = path.join(backupCqg, subFolder);

      log(`Thư mục MS: ${folderPathMs}`);
      log(`Thư mục CQG: ${folderPathCqg}`);
      await safeSave();

      const files = this.lotStatisticsService.loadFilesFromDirectories(
        folderPathMs,
        folderPathCqg,
      );
      log(`Nạp file thành công. Tiến hành chạy tính toán số lot...`);
      await safeSave();

      const lotConfig = await this.lotStatisticsService.getConfig();
      const filterLmeKyHan = lotConfig.defaultLmeKyHan || 'M26';

      const lastPartCqgIdx = backupCqg.lastIndexOf('\\');
      const parentBaseCqg =
        lastPartCqgIdx > 0 ? backupCqg.substring(0, lastPartCqgIdx) : backupCqg;

      const pathDsgdCumulative =
        lotConfig.defaultPathDsgdCumulative ||
        `${folderPathMs}\\DSGD T${month}.${year}.xlsx`;
      const pathNormal =
        lotConfig.defaultPathNormal ||
        `${folderPathCqg}\\Thong ke so lot giao dich ${year} 2.xlsx`;
      const pathAcm =
        lotConfig.defaultPathAcm ||
        `${parentBaseCqg}\\ACM\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich ACM ${year} 2.xlsx`;
      const pathLme =
        lotConfig.defaultPathLme ||
        `${parentBaseCqg}\\LME\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich LME ${year}.xlsx`;
      const pathOptions =
        lotConfig.defaultPathOptions ||
        `${parentBaseCqg}\\Options\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich Options ${year}.xlsx`;
      const pathSpread =
        lotConfig.defaultPathSpread ||
        `${parentBaseCqg}\\Spread\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich Spread ${year}.xlsx`;

      log(`[NestJS Thống kê Số Lốt] Chi tiết các đường dẫn tệp tin xử lý:`);
      log(`   - File DSGD Tuần/Tháng (Cumulative): ${pathDsgdCumulative}`);
      log(`   - File Thống kê số lốt (Normal): ${pathNormal}`);
      log(`   - File Thống kê số lốt ACM: ${pathAcm}`);
      log(`   - File Thống kê số lốt LME: ${pathLme}`);
      log(`   - File Thống kê số lốt Options: ${pathOptions}`);
      log(`   - File Thống kê số lốt Spread: ${pathSpread}`);
      await safeSave();

      const parseDateArray = (input: any) => {
        if (!input) return [];
        if (Array.isArray(input)) return input;
        try {
          const parsed = JSON.parse(input);
          return Array.isArray(parsed) ? parsed : [input];
        } catch {
          if (typeof input === 'string') {
            return input
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
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
        updateCumulative:
          payload.updateCumulative === true ||
          payload.updateCumulative === 'true',
        pathDsgdCumulative,
        pathNormal,
        pathAcm,
        pathLme,
        pathOptions,
        pathSpread,
      };

      const result = await this.lotStatisticsService.processLotStatistics(
        files,
        processParams,
      );
      log(`✅ Chạy tính toán thống kê số lot thành công.`);
      log(
        `Kết quả: DSGD Product: ${result.summary.dsgdProduct}, FR Product: ${result.summary.frProduct}`,
      );

      const allPassed = result.validations.every((v: any) => v.passed);
      if (allPassed) {
        log(`✅ Tất cả các kiểm tra đối chiếu (Validation) đều khớp.`);
      } else {
        log(`⚠️ Phát hiện chênh lệch đối chiếu:`);
        for (const val of result.validations) {
          if (!val.passed) {
            log(
              `   - ${val.field}: mong đợi ${val.expected}, thực tế ${val.actual}`,
            );
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
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    const targetDateStr = payload.targetDate; // Định dạng YYYY-MM-DD
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate (YYYY-MM-DD) trong payload.');
    }

    // Chaining save calls to prevent Mongoose ParallelSaveError
    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise
        .then(() => job.save())
        .catch((err) => {
          this.logger.error(
            `Error saving bot job in handleRunValueMacroJob: ${err.message}`,
          );
        });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(
      `[Macro Thống kê Giá Trị] Bắt đầu chạy tính toán [Thống kê giá trị giao dịch có ACM] cho ngày: ${targetDateStr}`,
    );
    log(
      `[Macro Thống kê Giá Trị] Kết quả sẽ được ghi vào thư mục: Thong ke gia tri giao dich theo TVKD`,
    );
    await safeSave();

    try {
      const targetDate = new Date(targetDateStr);
      const year = targetDate.getFullYear();
      const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(targetDate.getDate()).padStart(2, '0');

      const targetRoot =
        payload.targetRoot ||
        (await this.settingsService.getSetting(
          'bot_lot_macro_target_root',
          'M:\\Quanlygiaodich\\Tai lieu hoat dong',
        ));
      
      // Ghi chú: targetRoot đã trỏ tới thư mục ...\ Backup MS\Futures
      // KHÔNG append thêm 'Backup MS', 'Futures' để tránh duplicate path.
      const dsgdPath =
        payload.dsgdPath ||
        path.join(
          targetRoot,
          String(year),
          `T${monthStr}.${year}`,
          `${dayStr}.${monthStr}`,
          'DSGD.xlsx',
        );

      const pathNormal =
        payload.pathNormal ||
        (await this.settingsService.getSetting('bot_lot_macro_path_normal')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich',
          `Thong ke gia tri giao dich ${year}.xlsx`,
        );
      // pathSpread dùng setting riêng nếu cấu hình, fallback về Videos folder chuẩn
      const pathSpread =
        payload.pathSpread ||
        (await this.settingsService.getSetting('bot_lot_macro_path_spread')) ||
        path.join(
          'C:\\Users\\hiepth\\Videos\\Marco thong ke gia tri',
          `Thong ke gia tri giao dich Spread ${year}.xlsx`,
        );
      const pathLme =
        payload.pathLme ||
        (await this.settingsService.getSetting('bot_lot_macro_path_lme')) ||
        path.join(
          targetRoot,
          'Backup CQG',
          'LME',
          String(year),
          `Thong ke gia tri giao dich LME ${year}.xlsx`,
        );
      const pathOptions =
        payload.pathOptions ||
        (await this.settingsService.getSetting('bot_lot_macro_path_options')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich',
          `Thong ke gia tri giao dich Options ${year}.xlsx`,
        );
      const pathAcm =
        payload.pathAcm ||
        (await this.settingsService.getSetting('bot_lot_macro_path_acm')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich',
          `Thong ke gia tri giao dich ACM ${year}.xlsx`,
        );
      const pathTvkd =
        payload.pathTvkd ||
        (await this.settingsService.getSetting('bot_lot_macro_path_tvkd')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich theo TVKD',
          `Thong ke gia tri giao dich ${year} theo TVKD.xlsx`,
        );

      const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
        ? path.join(
            process.cwd(),
            'marco',
            'Thong ke gia tri giao dich có ACM',
            'Macro thong ke gia tri giao dich có ACM.xlsm',
          )
        : path.join(
            process.cwd(),
            '..',
            'marco',
            'Thong ke gia tri giao dich có ACM',
            'Macro thong ke gia tri giao dich có ACM.xlsm',
          );
      const macroPath =
        payload.macroPath ||
        (await this.settingsService.getSetting(
          'bot_macro_value_path',
          defaultMacroPath,
        ));

      log(`[NestJS Thống kê Giá Trị] Chi tiết các đường dẫn tệp tin xử lý:`);
      log(`   - Tệp bản đồ cấu hình (Excel): ${macroPath}`);
      log(`   - Thư mục gốc dữ liệu (Target Root): ${targetRoot}`);
      log(`   - File DSGD đầu vào: ${dsgdPath}`);
      log(`   - File Thống kê giá trị (Normal): ${pathNormal}`);
      log(`   - File Thống kê giá trị Spread: ${pathSpread}`);
      log(`   - File Thống kê giá trị LME: ${pathLme}`);
      log(`   - File Thống kê giá trị Options: ${pathOptions}`);
      log(`   - File Thống kê giá trị ACM: ${pathAcm}`);
      log(`   - File Thống kê giá trị theo TVKD: ${pathTvkd}`);
      await safeSave();

      const result = await this.valueStatisticsService.processValueStatistics(
        targetDate,
        {
          ...payload,
          // Truyền các path đã tính đúng để value-statistics.service.ts
          // dùng payload?.dsgdPath (logic có sẵn) thay vì tự build lại
          dsgdPath,
          targetRoot,
          pathNormal,
          pathSpread,
          pathLme,
          pathOptions,
          pathAcm,
          pathTvkd,
          macroPath,
        },
      );
      log(`✅ Chạy tính toán thống kê giá trị thành công.`);
      log(
        `Tỷ giá mặc định: ${result.tyGiaDefault}, TRU: ${result.tyGiaTru}, MPO: ${result.tyGiaMpo}`,
      );
      log(
        `Tổng số dòng giao dịch Normal: ${result.normalCount}, Spread: ${result.spreadCount}`,
      );
      await safeSave();
    } catch (err: any) {
      log(`❌ Lỗi chạy thống kê giá trị giao dịch: ${err.message}`);
      await safeSave();
      throw err;
    }
  }

  /**
   * Xử lý Job RUN_VALUE_TVKD_MACRO: Sử dụng ValueStatisticsService để chạy tính toán TVKD-only.
   */
  private async handleRunValueTvkdMacroJob(job: BotJob) {
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    const targetDateStr = payload.targetDate; // Định dạng YYYY-MM-DD
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate (YYYY-MM-DD) trong payload.');
    }

    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise
        .then(() => job.save())
        .catch((err) => {
          this.logger.error(
            `Error saving bot job in handleRunValueTvkdMacroJob: ${err.message}`,
          );
        });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(
      `[Macro Thống kê TVKD Lũy Kế] Bắt đầu chạy tính toán [TVKD lũy kế] cho ngày: ${targetDateStr}`,
    );
    await safeSave();

    try {
      const targetDate = new Date(targetDateStr);
      const year = targetDate.getFullYear();
      const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(targetDate.getDate()).padStart(2, '0');

      const targetRoot =
        payload.targetRoot ||
        (await this.settingsService.getSetting(
          'bot_lot_macro_target_root',
          'M:\\Quanlygiaodich\\Tai lieu hoat dong',
        ));
      
      const dsgdPath =
        payload.dsgdPath ||
        path.join(
          targetRoot,
          String(year),
          `T${monthStr}.${year}`,
          `${dayStr}.${monthStr}`,
          'DSGD.xlsx',
        );

      const pathTvkd =
        payload.pathTvkd ||
        (await this.settingsService.getSetting('bot_lot_macro_path_tvkd')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich theo TVKD',
          `Thong ke gia tri giao dich ${year} theo TVKD.xlsx`,
        );

      log(`[NestJS Thống kê TVKD Lũy Kế] Chi tiết các đường dẫn tệp tin xử lý:`);
      log(`   - Thư mục gốc dữ liệu (Target Root): ${targetRoot}`);
      log(`   - File DSGD đầu vào: ${dsgdPath}`);
      log(`   - File Thống kê giá trị theo TVKD: ${pathTvkd}`);
      await safeSave();

      const result = await this.valueStatisticsService.processTvkdOnly(
        targetDate,
        {
          targetRoot,
          dsgdPath,
          pathTvkd,
        },
      );
      log(`✅ Chạy tính toán thống kê TVKD lũy kế thành công.`);
      await safeSave();
    } catch (err: any) {
      log(`❌ Lỗi chạy thống kê TVKD lũy kế: ${err.message}`);
      await safeSave();
      throw err;
    }
  }

  private async handleDownloadCastJob(job: BotJob) {
    const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');
    if (!fs.existsSync(castDownloadsDir)) {
      fs.mkdirSync(castDownloadsDir, { recursive: true });
    }

    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    const dateStr = new Date(Date.now() + 7 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '');
    const filename = `Accounts_Balances_${dateStr}_${Date.now()}.xlsx`;
    const destFile = path.join(castDownloadsDir, filename);

    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy bot RPA CQG CAST để tải báo cáo số dư...`,
    );
    job.logs.push(
      `[${new Date().toISOString()}] Đường dẫn lưu file dự kiến: ${destFile}`,
    );
    await job.save();

    try {
      await this.rpaDownloaderService.downloadCastBalances(destFile);
      job.logs.push(
        `[${new Date().toISOString()}] Đã tải thành công file CAST về: ${destFile}`,
      );

      payload.downloadedFile = destFile;
      job.payload = payload;
      await job.save();

      // Check if custom backup path is provided or configured in settings to copy and rename the file
      const baseBackupPath =
        payload.backupPath ||
        (await this.settingsService.getSetting(
          'bot_backup_path_cqg',
          process.env.DEFAULT_BACKUP_PATH_CQG ||
            'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
        ));

      if (baseBackupPath) {
        // Lấy ngày cần chạy (mặc định là ngày hôm nay nếu không truyền targetDate)
        const targetDateStr = payload.targetDate;
        const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();

        const year = targetDate.getFullYear().toString();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const subFolder = path.join(
          year,
          `T${month}.${year}`,
          `${day}.${month}`,
        );

        // Ghép thêm thư mục ngày vào đường dẫn backup gốc
        const customBackupPath = path.join(baseBackupPath, subFolder);

        job.logs.push(
          `[${new Date().toISOString()}] Đang copy và đổi tên file sang thư mục backup: ${customBackupPath}`,
        );
        await job.save();

        if (!fs.existsSync(customBackupPath)) {
          fs.mkdirSync(customBackupPath, { recursive: true });
        }

        const targetBackupFile = path.join(
          customBackupPath,
          'Accounts_Balances.xlsx',
        );
        fs.copyFileSync(destFile, targetBackupFile);

        job.logs.push(
          `[${new Date().toISOString()}] ✅ Đã copy và đổi tên thành công: ${targetBackupFile}`,
        );
        await job.save();
      }
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi trong quá trình chạy RPA CQG CAST: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }

  private async handleAutoCheckSodJob(job: BotJob) {
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};

    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu kiểm tra đối chiếu SOD tự động ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result =
        await this.reconciliationService.runAutoCheckSOD(targetDate);
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu SOD.`);
      job.logs.push(
        `[${new Date().toISOString()}] Kết quả: ${result.success ? 'KHỚP' : 'LỆCH'}`,
      );

      payload.result = result;
      job.payload = payload;
      await job.save();

      if (!result.success) {
        if (result.discrepancies && result.discrepancies.length > 0) {
          job.logs.push(
            `[${new Date().toISOString()}] Danh sách tài khoản lệch số dư:`,
          );
          result.discrepancies.forEach((d: any) => {
            job.logs.push(
              `- [SOD] TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)} (Chênh lệch: $${d.differ.toFixed(2)})`,
            );
          });
        }
        await job.save();
        throw new Error(
          `Phát hiện chênh lệch số dư tài khoản (> $100) giữa M-System và CQG CAST. Vui lòng kiểm tra báo cáo.`,
        );
      }
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu SOD tự động: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }

  private async handleCheckKlgdJob(job: BotJob) {
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(`Bắt đầu chạy đối chiếu khớp lệnh định kỳ trong phiên ngày ${dateStr}...`);
    await job.save();

    // ── Bước 1: Xác định thư mục backup từ cấu hình DB ─────────────────────
    // Đường dẫn được lấy từ Settings DB (bot_backup_path_ms, bot_backup_path_cqg).
    // Fallback cross-platform: thư mục 'backup' trong thư mục data của app.
    const defaultMsPath = path.join(process.cwd(), 'data', 'backup', 'ms', 'futures');
    const defaultCqgPath = path.join(process.cwd(), 'data', 'backup', 'cqg', 'futures');
    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      defaultMsPath,
    );
    const cqgBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      defaultCqgPath,
    );
    // ACM nằm trong thư mục cha của Futures, chỉ khác tên folder cuối:
    // Ví dụ: .../Backup MS/Futures → .../Backup MS/ACM
    // path.dirname() lấy thư mục cha → cross-platform Windows/Ubuntu
    const acmBackupBase = path.join(path.dirname(msBackupBase), 'ACM');


    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);
    const acmDailyPath = path.join(acmBackupBase, subFolder);

    for (const dir of [msDailyPath, cqgDailyPath, acmDailyPath]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    // ── Bước 2: Tải dữ liệu tươi đồng thời từ cả 3 nguồn ───────────────────
    // Giống hệt C# Tool: mỗi lần CHECK_KLGD đều tải mới hoàn toàn.
    log('Bắt đầu tải dữ liệu tươi từ MS, CQG và ACM song song...');
    await job.save();

    const errors: string[] = [];

    // --- MS: DSGD + TTM (sequential trong 1 session) ---
    const downloadMs = async () => {
      log('MS → Đăng nhập M-System...');
      const { browser, page } = await this.rpaDownloaderService.loginMSystem(msDailyPath);
      try {
        log('MS → Đang tải DSGD.xlsx (Danh sách giao dịch)...');
        await this.rpaDownloaderService.downloadDSGD(
          page,
          path.join(msDailyPath, 'DSGD.xlsx'),
        );
        log('MS ✅ Tải DSGD.xlsx thành công.');

        log('MS → Đang tải TTM.xlsx (Trạng thái mở)...');
        await this.rpaDownloaderService.downloadTTM(
          page,
          path.join(msDailyPath, 'TTM.xlsx'),
        );
        log('MS ✅ Tải TTM.xlsx thành công.');
      } catch (err: any) {
        errors.push(`MS: ${err.message}`);
        log(`MS ❌ Lỗi tải file MS: ${err.message}`);
      } finally {
        await browser.close().catch(() => {});
      }
    };

    // --- CQG: FR1 + FR2 → merge thành FR.xlsx (2 session song song) ---
    const downloadCqg = async () => {
      log('CQG → Tải FR1 + FR2 từ 2 tài khoản CQG...');
      const result = await this.rpaDownloaderService.downloadCqgBackup(
        { FR1: true, FR2: true },
        cqgDailyPath,
      );
      if (result.downloaded.length > 0) {
        log(`CQG ✅ Đã tải: ${result.downloaded.join(', ')}.`);
      }
      if (result.errors.length > 0) {
        errors.push(...result.errors.map((e) => `CQG: ${e}`));
        log(`CQG ⚠️ Lỗi: ${result.errors.join(' | ')}`);
      }
      // Merge FR1+FR2 → FR.xlsx
      log('CQG → Merge FR1+FR2 → FR.xlsx...');
      const mergeResult = await this.cqgSyncService.autoMergeMissingFiles(targetDate);
      for (const l of mergeResult.logs) {
        log(`CQG Merge: ${l}`);
      }
      if (!mergeResult.success) {
        errors.push(`CQG Merge: ${mergeResult.logs.filter(l => l.includes('❌')).join(' | ')}`);
      } else {
        log('CQG ✅ Merge FR.xlsx thành công.');
      }
    };

    // --- ACM: Fill.xlsx (Nano trades) ---
    const downloadAcm = async () => {
      log('ACM → Đăng nhập ACM để tải báo cáo Fill (Nano trades)...');
      const jobLogFn = (msg: string) => log(`ACM: ${msg}`);
      const { browser, page } = await this.rpaDownloaderService.loginACM(
        acmDailyPath,
        undefined,
        jobLogFn,
      );
      try {
        await this.rpaDownloaderService.downloadAcmBackup(page, acmDailyPath, jobLogFn);
        log('ACM ✅ Tải báo cáo Fill/Order thành công.');
      } catch (err: any) {
        errors.push(`ACM: ${err.message}`);
        log(`ACM ❌ Lỗi tải file ACM: ${err.message}`);
      } finally {
        await browser.close().catch(() => {});
      }
    };

    // Chạy MS → CQG → ACM tuần tự để tránh nhiều Chrome instance chạy cùng lúc.
    // C# Tool chạy song song vì là desktop app riêng lẻ; NestJS server chia sẻ tài nguyên
    // với các process khác nên chạy tuần tự an toàn hơn.
    log('1/3 - Đang tải dữ liệu từ M-System (DSGD, TTM)...');
    await downloadMs();
    await job.save();

    log('2/3 - Đang tải dữ liệu từ CQG (FR1, FR2)...');
    await downloadCqg();
    await job.save();

    log('3/3 - Đang tải dữ liệu từ ACM (Fill, Order)...');
    await downloadAcm();
    await job.save();


    if (errors.length > 0) {
      log(`⚠️ Có ${errors.length} lỗi khi tải file, tiếp tục đối chiếu với dữ liệu có sẵn...`);
    } else {
      log('✅ Tải dữ liệu tươi hoàn tất từ tất cả 3 nguồn (MS, CQG, ACM).');
    }

    // ── Bước 3: Đối chiếu với file vừa tải ──────────────────────────────────
    try {
      const result = await this.reconciliationService.runAutoCheckKLGD(targetDate);
      if (result.sessionStart && result.checkTime) {
        const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const endStr = new Date(result.checkTime).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        log(`Khoảng thời gian lọc: từ ${startStr} đến ${endStr}`);
      }
      if (result.isWaitingFiles) {
        log(result.message);
      } else {
        log('Hoàn thành đối chiếu khớp lệnh định kỳ trong phiên.');
        log(`Kết quả: ${result.passed ? 'KHỚP' : 'LỆCH'}`);
      }
      // Ngưỡng cắt bớt log: chỉ rút gọn khi số lượng lệch vượt quá giới hạn.
      // Dưới ngưỡng: lưu đầy đủ từng dòng như cũ → trải nghiệm không thay đổi.
      // Trên ngưỡng: chỉ lưu tóm tắt + preview để tránh document bloat.
      const LOG_THRESHOLD = 50;
      const MAX_PREVIEW = 30;
      const mismatchedAll = result.mismatchedTrades ?? [];
      if (mismatchedAll.length > LOG_THRESHOLD) {
        // Vượt ngưỡng: cắt bớt payload, ghi 1 dòng tóm tắt
        payload.result = {
          ...result,
          mismatchedTrades: mismatchedAll.slice(0, MAX_PREVIEW),
          mismatchedTradesTotal: mismatchedAll.length,
          isPreviewOnly: true,
        };
      } else {
        // Bình thường: lưu nguyên đầy đủ
        payload.result = result;
      }
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      if (!result.passed) {
        if (mismatchedAll.length > 0) {
          if (mismatchedAll.length > LOG_THRESHOLD) {
            // Vượt ngưỡng: ghi 1 dòng tóm tắt + preview ngắn
            const preview = mismatchedAll.slice(0, MAX_PREVIEW)
              .map((t: any) => `[${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}: ${t.reason}`)
              .join(' | ');
            log(
              `⚠️ Phát hiện ${mismatchedAll.length} lệch KLGD (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết đầy đủ xem file CSV đính kèm email. ` +
              `Preview ${MAX_PREVIEW} đầu tiên: ${preview}`,
            );
          } else {
            // Dưới ngưỡng: ghi từng dòng như cũ
            log('Chi tiết chênh lệch khớp lệnh:');
            mismatchedAll.forEach((t: any) => {
              job.logs.push(
                `- [${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}, Giá ${t.giaKhop}, Qty ${t.klGiaoDich}: ${t.reason}`,
              );
            });
          }
        }
        await job.save();
        throw new Error(
          `Phát hiện chênh lệch khớp lệnh trong phiên (KLGD). Vui lòng kiểm tra báo cáo.`,
        );
      }
    } catch (err: any) {
      log(`Lỗi đối chiếu khớp lệnh tự động: ${err.message}`);
      await job.save();
      throw err;
    }
  }


  private async handleCheckPreEodJob(job: BotJob) {
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    let targetDate: Date;
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      const localNow = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
      targetDate = new Date(Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate()
      ));
    }
    // Ensure targetDate is always UTC midnight (date-only) to trigger historical full session checks in checkPreEOD
    targetDate.setUTCHours(0, 0, 0, 0);
    const dateStr = payload.sessionDay || targetDate.toISOString().split('T')[0];
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy đối chiếu Pre-EOD tự động ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result =
        await this.reconciliationService.runAutoCheckPreEOD(targetDate);
      if (result.sessionStart && result.checkTime) {
        const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const endStr = new Date(result.checkTime).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        job.logs.push(
          `[${new Date().toISOString()}] Khoảng thời gian lọc: từ ${startStr} đến ${endStr}`,
        );
      }
      if (result.isWaitingFiles) {
        job.logs.push(`[${new Date().toISOString()}] ${result.message}`);
      } else {
        job.logs.push(
          `[${new Date().toISOString()}] Hoàn thành đối chiếu Pre-EOD.`,
        );
        job.logs.push(
          `[${new Date().toISOString()}] Kết quả: ${result.passed ? 'KHỚP' : 'LỆCH'}`,
        );
      }
      // Ngưỡng cắt bớp log: chỉ rút gọn khi số lượng lệch vượt quá giới hạn.
      const LOG_THRESHOLD = 50;
      const MAX_PREVIEW = 30;
      const mismatchedTradesAll = result.mismatchedTrades ?? [];
      const mismatchedPositionsAll = result.mismatchedPositions ?? [];
      const needTruncate = mismatchedTradesAll.length > LOG_THRESHOLD || mismatchedPositionsAll.length > LOG_THRESHOLD;
      if (needTruncate) {
        payload.result = {
          ...result,
          mismatchedTrades: mismatchedTradesAll.slice(0, MAX_PREVIEW),
          mismatchedTradesTotal: mismatchedTradesAll.length,
          mismatchedPositions: mismatchedPositionsAll.slice(0, MAX_PREVIEW),
          mismatchedPositionsTotal: mismatchedPositionsAll.length,
          isPreviewOnly: true,
        };
      } else {
        payload.result = result;
      }
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      if (!result.passed) {
        if (mismatchedTradesAll.length > 0) {
          if (mismatchedTradesAll.length > LOG_THRESHOLD) {
            const preview = mismatchedTradesAll.slice(0, MAX_PREVIEW)
              .map((t: any) => `[${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}: ${t.reason}`)
              .join(' | ');
            job.logs.push(
              `[${new Date().toISOString()}] ⚠️ Phát hiện ${mismatchedTradesAll.length} lệch KLGD (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết xem CSV email. Preview: ${preview}`,
            );
          } else {
            job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch khớp lệnh:`);
            mismatchedTradesAll.forEach((t: any) => {
              job.logs.push(
                `- [${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}, Giá ${t.giaKhop}, Qty ${t.klGiaoDich}: ${t.reason}`,
              );
            });
          }
        }
        if (mismatchedPositionsAll.length > 0) {
          if (mismatchedPositionsAll.length > LOG_THRESHOLD) {
            const preview = mismatchedPositionsAll.slice(0, MAX_PREVIEW)
              .map((p: any) => `TK ${p.account}, HĐ ${p.symbol}: MS ${p.msPosition} vs CQG ${p.cqgPosition}`)
              .join(' | ');
            job.logs.push(
              `[${new Date().toISOString()}] ⚠️ Phát hiện ${mismatchedPositionsAll.length} lệch vị thế Net (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết xem CSV email. Preview: ${preview}`,
            );
          } else {
            job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch vị thế Net:`);
            mismatchedPositionsAll.forEach((p: any) => {
              job.logs.push(
                `- TK ${p.account}, HĐ ${p.symbol}: MS ${p.msPosition} vs CQG ${p.cqgPosition} (Chênh lệch: ${p.differ})`,
              );
            });
          }
        }
        await job.save();
        throw new Error(
          `Phát hiện chênh lệch khớp lệnh hoặc vị thế cuối ngày (Pre-EOD). Vui lòng kiểm tra báo cáo.`,
        );
      }
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu Pre-EOD tự động: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }

  private async handleCheckEodMmJob(job: BotJob) {
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy đối chiếu EOD tự động ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result =
        await this.reconciliationService.runAutoCheckEodMm(targetDate);
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu EOD.`);

      // Ngưỡng cắt bớp log: chỉ rút gọn khi số lượng lệch vượt quá giới hạn.
      const LOG_THRESHOLD = 50;
      const MAX_PREVIEW = 30;
      const cqgResultAll = result.cqgResult ?? [];
      if (cqgResultAll.length > LOG_THRESHOLD) {
        payload.result = {
          ...result,
          cqgResult: cqgResultAll.slice(0, MAX_PREVIEW),
          cqgResultTotal: cqgResultAll.length,
          isPreviewOnly: true,
        };
      } else {
        payload.result = result;
      }
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      const totalNegative =
        result.eodResult.negativeBalanceAccs.length +
        result.eodResult.negativeIMRAcc.length;
      const totalMismatched = cqgResultAll.length;
      if (totalNegative > 0 || totalMismatched > 0) {
        if (cqgResultAll.length > 0) {
          if (cqgResultAll.length > LOG_THRESHOLD) {
            const preview = cqgResultAll.slice(0, MAX_PREVIEW)
              .map((d: any) => `TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)}`)
              .join(' | ');
            job.logs.push(
              `[${new Date().toISOString()}] ⚠️ Phát hiện ${cqgResultAll.length} TK lệch số dư EOD (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết xem CSV email. Preview: ${preview}`,
            );
          } else {
            job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch số dư CQG EOD:`);
            cqgResultAll.forEach((d: any) => {
              job.logs.push(
                `- [EOD] TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)} (Chênh lệch: $${d.differ.toFixed(2)})`,
              );
            });
          }
        }
        await job.save();
        throw new Error(
          `Phát hiện bất thường EOD: ${totalNegative} tài khoản âm margin/số dư, ${totalMismatched} tài khoản lệch số dư EOD CQG.`,
        );
      }
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu EOD tự động: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }

  private async sendOperationalFailureAlert(job: BotJob, errorMsg: string) {
    try {
      const config = await this.marginCheckerService.loadConfig();
      const mailSettings = config.opFailureAlert || {
        isSendWarning: true,
        email: ['it.support@mxv.vn'],
      };
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
        greetingTimeout: 10000, // 10s
        socketTimeout: 15000, // 15s
      });

      const rawPayload = job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};

      let shiftTitle = '';
      let taskName = '';
      if (rawPayload.shiftLogId) {
        try {
          const shiftLog = await this.shiftsService.getShiftByIdInternal(rawPayload.shiftLogId);
          if (shiftLog) {
            shiftTitle = (shiftLog.templateId as any)?.title || '';
            if (rawPayload.taskId && Array.isArray(shiftLog.details)) {
              const task = (shiftLog.details as any[]).find(t => t.taskId === rawPayload.taskId);
              if (task) {
                taskName = task.taskNameSnapshot || '';
              }
            }
          }
        } catch (err: any) {
          this.logger.error(`Error resolving shift log details for email: ${err.message}`);
        }
      }

      const payloadStr = JSON.stringify(rawPayload, null, 2);
      const lastLogs = job.logs.slice(-20).join('\n');
      
      let displayPayload = payloadStr;
      const mailAttachments: any[] = [];
      
      if (payloadStr.length > 3000) {
        displayPayload = payloadStr.substring(0, 3000) + '\n\n... [NỘI DUNG PAYLOAD QUÁ DÀI - ĐÃ ĐƯỢC RÚT GỌN ĐỂ TRÁNH QUÁ TẢI EMAIL. CHI TIẾT ĐẦY ĐỦ XEM TRONG FILE ĐÍNH KÈM]';
        mailAttachments.push({
          filename: `job_payload_${job._id}.json`,
          content: Buffer.from(payloadStr, 'utf-8'),
        });
      }

      // If it contains mismatched trades list, generate a clean CSV file so the GLGD team can open it directly in Microsoft Excel
      const mismatchedTrades = rawPayload?.result?.mismatchedTrades || [];
      if (Array.isArray(mismatchedTrades) && mismatchedTrades.length > 0) {
        const targetDateStr = rawPayload.sessionDay || rawPayload.targetDate || new Date().toISOString().split('T')[0];
        
        const convertMismatchedTradesToCsv = (trades: any[]): string => {
          const headers = ['Nguồn', 'Mã lệnh', 'Mã TKGD', 'Mã HD', 'Giá khớp', 'KL giao dịch', 'Ngày giờ', 'Lý do lệch'];
          const rows = trades.map(t => [
            t.source || '',
            t.maLenh || '',
            t.maTKGD || '',
            t.maHD || '',
            t.giaKhop !== undefined ? t.giaKhop : '',
            t.klGiaoDich !== undefined ? t.klGiaoDich : '',
            t.ngayGio || '',
            t.reason || ''
          ]);
          const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
          ].join('\r\n');
          return '\ufeff' + csvContent; // UTF-8 BOM
        };

        const csvContent = convertMismatchedTradesToCsv(mismatchedTrades);
        mailAttachments.push({
          filename: `danh_sach_lech_khop_lenh_${targetDateStr}.csv`,
          content: Buffer.from(csvContent, 'utf-8'),
        });
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const actionLink = rawPayload.shiftLogId
        ? `${frontendUrl}/checklist?id=${rawPayload.shiftLogId}`
        : `${frontendUrl}`;

      const subject = `[Checklist Alert] Lỗi Tác Vụ ${taskName || job.jobType} - Ca Trực: ${shiftTitle || 'Vận Hành'}`;
      const htmlBody = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
            <div style="max-width: 800px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid #c62828;">
              <div style="padding: 25px;">
                <h2 style="color: #c62828; margin-top: 0; display: flex; align-items: center; gap: 8px;">
                  Cảnh Báo Lỗi Tác Vụ Bot Vận Hành
                </h2>
                <p style="font-size: 15px; color: #4b5563;">Hệ thống phát hiện một tác vụ trong ca trực đã thất bại sau khi thử lại tối đa <b>${job.maxAttempts} lần</b>.</p>
                
                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                      <td style="padding: 10px 0; font-weight: bold; color: #374151; width: 180px;">Ca trực</td>
                      <td style="padding: 10px 0; color: #111827; font-weight: bold;">${shiftTitle || 'Chưa xác định'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                      <td style="padding: 10px 0; font-weight: bold; color: #374151;">Tác vụ bị lỗi</td>
                      <td style="padding: 10px 0; color: #c62828; font-weight: bold;">${taskName || job.jobType} <span style="font-weight: normal; color: #6b7280; font-size: 12px;">(${rawPayload.taskId || 'Không rõ ID'})</span></td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                      <td style="padding: 10px 0; font-weight: bold; color: #374151;">Lượt thử lại</td>
                      <td style="padding: 10px 0; color: #111827;">${job.attempts}/${job.maxAttempts}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; font-weight: bold; color: #374151;">Thời gian sự cố</td>
                      <td style="padding: 10px 0; color: #111827;">${new Date().toLocaleString('vi-VN')}</td>
                    </tr>
                  </table>
                </div>

                <div style="background-color: #ffebee; border-left: 4px solid #c62828; padding: 15px; margin-bottom: 25px; border-radius: 4px; color: #c62828;">
                  <strong style="font-size: 15px;">Chi tiết lỗi hệ thống:</strong><br/>
                  <pre style="font-family: monospace; white-space: pre-wrap; margin: 8px 0 0 0; font-size: 13px;">${errorMsg}</pre>
                </div>

                <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 25px; border-radius: 4px; color: #1e3a8a;">
                  <strong>Hướng xử lý đề xuất:</strong> Bạn vui lòng click vào nút bên dưới để đi tới giao diện ca trực, tiến hành kiểm tra hoặc xử lý thủ công tác vụ này.
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${actionLink}" style="background-color: #c62828; color: #ffffff; text-decoration: none; padding: 14px 28px; font-weight: bold; border-radius: 6px; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(198,40,40,0.2); transition: background-color 0.2s;">
                    ĐI TỚI CA TRỰC ĐỂ XỬ LÝ
                  </a>
                </div>
              </div>
              <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
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
        attachments: mailAttachments,
      });


      this.logger.log(
        `Đã gửi email cảnh báo lỗi vận hành cho job ${job.jobType} thành công.`,
      );
    } catch (err: any) {
      this.logger.error(
        `Không thể gửi email cảnh báo lỗi vận hành cho job ${job.jobType}: ${err.message}`,
      );
    }
  }

  private async handleRunMacroJob(job: BotJob) {
    const payload =
      job.payload instanceof Map
        ? Object.fromEntries(job.payload)
        : job.payload || {};
    const targetDateStr = payload.targetDate || payload.sessionDay;
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate/sessionDay trong payload.');
    }

    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise
        .then(() => job.save())
        .catch((err) => {
          this.logger.error(
            `Error saving bot job in handleRunMacroJob: ${err.message}`,
          );
        });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(
      `[Báo cáo CCP Bạc Thỏi] Bắt đầu chạy tính toán [Macro Thống kê Số Lô & Giá Trị Giao Dịch CCP] cho ngày: ${targetDateStr}`,
    );
    log(
      `[Báo cáo CCP Bạc Thỏi] Lưu ý: Đây là báo cáo dành riêng cho Pilot Bạc Thỏi (đầu ra Thong_ke_kich_ban_Pilot_Bac_Final.xlsx), biệt lập với Macro Số Lốt hoặc Macro Giá Trị.`,
    );
    await safeSave();

    try {
      const targetDate = new Date(targetDateStr);
      const year = targetDate.getFullYear().toString();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');

      const backupMs =
        payload.backupPathMs ||
        (await this.settingsService.getSetting(
          'bot_backup_path_ms',
          'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
        ));

      const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
      const dailyPath = path.join(backupMs, subFolder);

      log(`Thư mục MS Daily: ${dailyPath}`);
      await safeSave();

      if (!fs.existsSync(dailyPath)) {
        throw new Error(
          `Thư mục backup ngày ${targetDateStr} không tồn tại: ${dailyPath}`,
        );
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
        log(`Chưa có file DSGD MM CCP trong thư mục backup. Tiến hành đăng nhập Core CCP để tải tự động...`);
        await safeSave();
        try {
          const downloadSuccess = await this.rpaDownloaderService.downloadDsgdMmCcp(dsgdMmCcpPathStd);
          if (downloadSuccess && fs.existsSync(dsgdMmCcpPathStd)) {
            dsgdMmCcpBuffer = fs.readFileSync(dsgdMmCcpPathStd);
            log(`✅ Tự động tải file DSGD MM CCP thành công và nạp vào dữ liệu tính toán.`);
          } else {
            throw new Error('Tải tệp tin không thành công không rõ lý do.');
          }
        } catch (err: any) {
          log(`⚠️ Không tải được DSGD MM CCP tự động: ${err.message}`);
          dsgdMmCcpBuffer = this.createEmptyDsgdBuffer();
          log(
            `File DSGD MM CCP riêng biệt vắng mặt (không bắt buộc). Khởi tạo buffer trống.`,
          );
        }
      }

      const dstkgdPath = path.join(dailyPath, 'DSTKGD-Futures.xlsx');
      const dstkgdPathFallback = path.join(dailyPath, 'DSTKGD.xlsx');
      const nrPath = path.join(dailyPath, 'NR.xlsx');
      const ttmPath = path.join(dailyPath, 'TTM.xlsx');
      const ttttPath = path.join(dailyPath, 'TTTT.xlsx');

      // Verification
      if (!fs.existsSync(dsgdCcpPath)) {
        throw new Error(
          `Thiếu file giao dịch CCP (DSGD.xlsx) tại: ${dailyPath}`,
        );
      }
      const finalDstkgdPath = fs.existsSync(dstkgdPath)
        ? dstkgdPath
        : fs.existsSync(dstkgdPathFallback)
          ? dstkgdPathFallback
          : null;
      if (!finalDstkgdPath) {
        throw new Error(
          `Thiếu file danh sách tài khoản giao dịch (DSTKGD-Futures.xlsx hoặc DSTKGD.xlsx) tại: ${dailyPath}`,
        );
      }
      if (!fs.existsSync(nrPath)) {
        throw new Error(`Thiếu file nộp rút (NR.xlsx) tại: ${dailyPath}`);
      }
      if (!fs.existsSync(ttmPath)) {
        throw new Error(
          `Thiếu file trạng thái mở (TTM.xlsx) tại: ${dailyPath}`,
        );
      }
      if (!fs.existsSync(ttttPath)) {
        throw new Error(
          `Thiếu file trạng thái tất toán (TTTT.xlsx) tại: ${dailyPath}`,
        );
      }

      log(`[Báo cáo CCP Bạc Thỏi] Chi tiết 6 tệp tin dữ liệu đầu vào nạp vào bộ nhớ:`);
      log(`   - File giao dịch CCP: ${dsgdCcpPath}`);
      log(`   - File giao dịch MM CCP: ${dsgdMmCcpPathStd}`);
      log(`   - File danh sách tài khoản: ${finalDstkgdPath}`);
      log(`   - File nộp rút: ${nrPath}`);
      log(`   - File trạng thái mở: ${ttmPath}`);
      log(`   - File trạng thái tất toán: ${ttttPath}`);
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

      const ccpPathSetting = await this.settingsService.getSetting('bot_macro_ccp_path', '');
      const defaultOutputPath = path.join(
        process.cwd(),
        'uploads',
        'ccp-statistics',
        'Thong_ke_kich_ban_Pilot_Bac_Final.xlsx',
      );
      const targetOutputPath = ccpPathSetting || defaultOutputPath;

      log(`[Báo cáo CCP Bạc Thỏi] Bắt đầu xử lý dữ liệu báo cáo CCP qua CcpStatisticsService...`);
      log(`[Báo cáo CCP Bạc Thỏi] Đường dẫn tệp tin đầu ra kết quả (Output): ${targetOutputPath}`);
      await safeSave();

      const outputPath = await this.ccpStatisticsService.processCcpData(
        files,
        targetDate,
        targetOutputPath,
      );

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
      'STT',
      'Mã lệnh',
      'Mã giao dịch',
      'Mã TKGD',
      'Tên TKGD',
      'Mã HĐ',
      'Tên HĐ',
      'Hình thức lệnh',
      'Loại lệnh',
      'Phương thức ghép',
      'Chiều mua bán',
      'KL đặt lệnh',
      'KL giao dịch',
      'Giá khớp',
      'Giá giới hạn',
      'Giá dừng',
      'Phí quyền chọn (USD)',
      'Phí quyền chọn (VND)',
      'Phí giao dịch',
      'Người đặt lệnh',
      'Ngày giờ đặt lệnh',
      'Ngày giờ thực hiện',
      'Mã TVKD',
      'Tên TVKD',
      'Mã MG',
      'Tên MG',
      'Mã CTV',
      'Tên CTV',
      'Nhóm hàng hoá',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
