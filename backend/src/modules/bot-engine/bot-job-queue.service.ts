import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotJob } from '../../schemas/bot-job.schema';
import { BotJobHandlerRegistry } from './core/job-handler.registry';
import { IJobExecutionContext } from './core/job-handler.interface';
import { ShiftsService } from '../shifts/shifts.service';
import { ShiftsGateway } from '../shifts/shifts.gateway';
import { MarginCheckerService } from '../margin-checker/margin-checker.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { FileAuditJobHandler } from './handlers/file-audit.handler';
import {
  parseJobPayload,
  getMsBackupBase,
  getCqgBackupBase,
  getAcmBackupBase,
} from './helpers/bot-path.helper';

@Injectable()
export class BotJobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotJobQueueService.name);
  private isProcessing = false;
  private queueInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;
  private healthInterval: NodeJS.Timeout;
  private wasAgentOnlineMap = new Map<string, boolean>();

  constructor(
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    private readonly registry: BotJobHandlerRegistry,
    private readonly fileAuditHandler: FileAuditJobHandler,
    private readonly shiftsService: ShiftsService,
    private readonly shiftsGateway: ShiftsGateway,
    private readonly marginCheckerService: MarginCheckerService,
    private readonly settingsService: SystemSettingsService,
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
      'Background BotJob queue worker initialized (polling every 10s with Handler Strategy Pattern).',
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
    const statuses = AgentController.agentStatuses;
    if (!statuses) return;

    for (const [hostname, status] of statuses.entries()) {
      const diffMs = Date.now() - status.lastSeen.getTime();
      const isOnline = diffMs < 180000; // 3 minutes timeout
      const wasOnline = this.wasAgentOnlineMap.get(hostname) || false;

      if (!isOnline && wasOnline) {
        this.wasAgentOnlineMap.set(hostname, false);
        this.logger.warn(`Agent ${hostname} offline alert. Sending email...`);
        await this.sendConnectionAlertEmail(status, false);
        statuses.delete(hostname);
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
      });

      const subject = isOnline
        ? `[THÔNG BÁO ONLINE] RPA Agent ${status.hostname} đã kết nối lại`
        : `[CẢNH BÁO MẤT KẾT NỐI] RPA Agent ${status.hostname} đã ngắt kết nối`;

      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: ${isOnline ? '#28a745' : '#dc3545'};">
            ${isOnline ? '🟢 RPA Agent Online' : '🔴 RPA Agent Offline Alert'}
          </h2>
          <p>Hệ thống ghi nhận trạng thái kết nối của RPA Agent:</p>
          <ul>
            <li><strong>Hostname:</strong> ${status.hostname}</li>
            <li><strong>Hệ điều hành / Platform:</strong> ${status.platform}</li>
            <li><strong>Lần cuối gửi tín hiệu (Last Seen):</strong> ${new Date(status.lastSeen).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</li>
            <li><strong>Trạng thái hiện tại:</strong> <span style="font-weight: bold; color: ${isOnline ? '#28a745' : '#dc3545'};">${isOnline ? 'ONLINE' : 'OFFLINE (Quá 3 phút không có heartbeat)'}</span></li>
          </ul>
          <p>Vui lòng kiểm tra lại dịch vụ chạy ngầm trên máy trạm Windows nếu agent bị ngắt kết nối đột ngột.</p>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #777;">Email tự động từ hệ thống MXV Shift Checklist Bot Engine.</p>
        </div>
      `;

      await transporter.sendMail({
        from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
        to: mailSettings.email,
        subject,
        html,
      });

      this.logger.log(`Connection alert email sent to: ${mailSettings.email.join(', ')}`);
    } catch (err: any) {
      this.logger.error(`Failed to send connection alert email: ${err.message}`);
    }
  }

  /**
   * Đưa một job mới vào hàng đợi PENDING.
   */
  public async enqueue(
    jobType: string,
    payload: Record<string, any> = {},
    maxAttempts: number = 3,
  ): Promise<BotJob> {
    const job = new this.botJobModel({
      jobType,
      payload,
      maxAttempts,
      status: 'PENDING',
      attempts: 0,
      logs: [`[${new Date().toISOString()}] Job enqueued.`],
    });
    const saved = await job.save();
    await this.syncJobToChecklist(saved, 'PENDING');
    return saved;
  }

  /**
   * Chạy trực tiếp một job cụ thể qua CLI hoặc Agent.
   */
  public async executeJobDirectly(job: any): Promise<void> {
    const handler = this.registry.getHandler(job.jobType);
    if (!handler) {
      throw new Error(`Loại job không được hỗ trợ bởi bất kỳ Handler nào: ${job.jobType}`);
    }

    const context: IJobExecutionContext = {
      syncJobToChecklist: this.syncJobToChecklist.bind(this),
      logger: this.logger,
    };

    await handler.execute(job, context);
  }

  private async processQueue() {
    if (this.isProcessing) {
      return;
    }

    const jobFilter = { status: 'PENDING' };
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
      `Processing job ${job.jobType} (ID: ${job._id}, Attempt: ${job.attempts}) via Registry`,
    );

    const context: IJobExecutionContext = {
      syncJobToChecklist: this.syncJobToChecklist.bind(this),
      logger: this.logger,
    };

    try {
      const handler = this.registry.getHandler(job.jobType);
      if (!handler) {
        throw new Error(`Loại job không được hỗ trợ: ${job.jobType}`);
      }

      await handler.execute(job, context);

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

  /**
   * Đồng bộ trạng thái BotJob sang Checklist ca trực và phát WebSocket event.
   */
  public async syncJobToChecklist(
    job: any,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'AWAITING_CAPTCHA',
    error?: string,
  ) {
    const payload = parseJobPayload(job);
    const { shiftLogId, taskId } = payload;

    job.status = status;
    const now = new Date();
    if (status === 'COMPLETED') {
      job.completedAt = now;
    } else if (status === 'FAILED') {
      job.failedAt = now;
      job.error = error;
    }

    await this.botJobModel
      .updateOne(
        { _id: job._id },
        {
          $set: {
            status: job.status,
            completedAt: job.completedAt,
            failedAt: job.failedAt,
            attempts: job.attempts,
            logs: job.logs,
            payload: job.payload,
          },
        },
      )
      .exec();

    if (shiftLogId && taskId) {
      try {
        const systemUser = {
          id: '000000000000000000000000',
          fullName: 'Hệ thống tự động (Bot)',
          username: 'system_bot',
          role: 'ADMIN',
        };

        if (status === 'PROCESSING') {
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'IN_PROGRESS',
            systemUser,
            `Bot đang xử lý (Lần thử ${job.attempts}/${job.maxAttempts})...`,
            true,
          );
        } else if (status === 'COMPLETED') {
          let message = 'Bot đã hoàn thành kiểm tra tự động thành công.';
          if (
            [
              'RUN_MACRO',
              'RUN_LOT_MACRO',
              'RUN_VALUE_MACRO',
              'FILE_AUDIT_ACM',
              'FILE_AUDIT_CQG',
              'FILE_AUDIT_MS',
              'AUTO_CHECK_SOD',
              'CHECK_PRE_EOD',
              'CHECK_EOD_MM',
              'CHECK_KLGD',
            ].includes(job.jobType)
          ) {
            const checkData = {
              type: job.jobType,
              jobId: job._id.toString(),
              status: 'COMPLETED',
              completedAt: job.completedAt,
              data: {
                totalCount: payload?.totalCount ?? 0,
                failedCount: 0,
                failedList: '',
                timestamp: new Date().toISOString(),
              },
            };
            message = JSON.stringify(checkData);
          } else if (payload.totalCount !== undefined) {
            message = `Đã xác minh ${payload.totalCount} email: 0 lỗi.`;
          }

          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'PASSED',
            systemUser,
            message,
            true,
          );
        } else if (status === 'FAILED') {
          let message = error || 'Lỗi không xác định khi chạy bot.';
          if (payload?.totalCount !== undefined) {
            message = `Đã xác minh ${payload.totalCount} email: Phát hiện ${payload.failedCount} lỗi. Danh sách: ${payload.failedList}`;
          } else if (
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
          ) {
            const checkData = {
              type: job.jobType,
              jobId: job._id.toString(),
              status: 'FAILED',
              failedAt: job.failedAt,
              error: message,
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

    // Phát sự kiện Realtime WebSocket qua ShiftsGateway
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
      });

      const payload = parseJobPayload(job);
      const subject = `[CẢNH BÁO VẬN HÀNH BOT] Tác vụ ${job.jobType} thất bại sau ${job.maxAttempts} lần thử`;
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #dc3545;">⚠️ Cảnh Báo Tác Vụ Bot Thất Bại Vĩnh Viễn</h2>
          <p>Hệ thống MXV Shift Checklist ghi nhận một tác vụ tự động đã thất bại sau khi vượt quá số lần thử tối đa:</p>
          <ul>
            <li><strong>Mã Job:</strong> ${job._id}</li>
            <li><strong>Loại Tác Vụ (Job Type):</strong> <span style="color: #0056b3; font-weight: bold;">${job.jobType}</span></li>
            <li><strong>Số lần thử:</strong> ${job.attempts}/${job.maxAttempts}</li>
            <li><strong>Ngày ca trực (Session Day / Target Date):</strong> ${payload.targetDate || payload.sessionDay || 'N/A'}</li>
            <li><strong>Mã ca trực (Shift Log ID):</strong> ${payload.shiftLogId || 'N/A'}</li>
            <li><strong>Mã công việc (Task ID):</strong> ${payload.taskId || 'N/A'}</li>
            <li><strong>Thời gian thất bại:</strong> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</li>
          </ul>
          <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 12px; margin: 15px 0;">
            <strong>Chi tiết lỗi cuối cùng:</strong>
            <p style="margin: 5px 0 0 0; font-family: monospace; color: #721c24;">${errorMsg}</p>
          </div>
          <p>Vui lòng đăng nhập vào hệ thống để kiểm tra chi tiết nhật ký (logs) và can thiệp xử lý thủ công.</p>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #777;">Email tự động từ hệ thống MXV Shift Checklist Bot Engine.</p>
        </div>
      `;

      await transporter.sendMail({
        from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
        to: mailSettings.email,
        subject,
        html,
      });

      this.logger.log(`Operational failure alert email sent to: ${mailSettings.email.join(', ')}`);
    } catch (err: any) {
      this.logger.error(`Failed to send operational failure alert email: ${err.message}`);
    }
  }

  async submitCaptcha(jobId: string, captchaText: string): Promise<void> {
    const resolver = this.fileAuditHandler.captchaResolvers.get(jobId);
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
    this.fileAuditHandler.captchaResolvers.delete(jobId);
  }

  async cleanupStuckJobs(isStartup: boolean = false): Promise<void> {
    const thresholdMs = 15 * 60 * 1000;
    const now = Date.now();

    const stuckJobs = await this.botJobModel
      .find({
        status: { $in: ['PROCESSING', 'AWAITING_CAPTCHA'] },
      })
      .exec();

    if (stuckJobs.length === 0) return;

    for (const job of stuckJobs) {
      const updatedAtMs = job.updatedAt ? job.updatedAt.getTime() : 0;
      const isStuckTimeout = now - updatedAtMs > thresholdMs;

      if (isStartup || isStuckTimeout) {
        const reason = isStartup
          ? 'Server khởi động lại (Reset stuck job)'
          : 'Hết thời gian xử lý (Timeout 15 phút)';

        this.logger.warn(`Dọn dẹp Job bị treo ${job._id} (${job.jobType}): ${reason}`);
        job.logs.push(`[${new Date().toISOString()}] Tự động dọn dẹp job bị treo: ${reason}`);

        if (job.attempts < job.maxAttempts) {
          await this.syncJobToChecklist(job, 'PENDING', reason);
        } else {
          await this.syncJobToChecklist(job, 'FAILED', reason);
        }
      }
    }
  }

  // Delegated audit methods for backward compatibility with Controller
  async scanMsBackupFiles(backupPath: string, targetDate: Date = new Date()) {
    return this.fileAuditHandler.scanMsBackupFiles(backupPath, targetDate);
  }

  async scanAcmBackupFiles(backupPath: string, targetDate: Date = new Date()) {
    return this.fileAuditHandler.scanAcmBackupFiles(backupPath, targetDate);
  }

  async getJobForTask(
    taskId: string,
    shiftLogId?: string,
  ): Promise<BotJob | null> {
    const query: Record<string, any> = { 'payload.taskId': taskId };
    if (shiftLogId) {
      query['payload.shiftLogId'] = shiftLogId;
    }
    return this.botJobModel.findOne(query).sort({ createdAt: -1 }).exec();
  }

  async getJobById(id: string): Promise<BotJob | null> {
    return this.botJobModel.findById(id).exec();
  }

  async getMsBackupBase(): Promise<string> {
    return getMsBackupBase(this.settingsService);
  }

  async getCqgBackupBase(): Promise<string> {
    return getCqgBackupBase(this.settingsService);
  }

  async getAcmBackupBase(): Promise<string> {
    return getAcmBackupBase(this.settingsService);
  }
}

