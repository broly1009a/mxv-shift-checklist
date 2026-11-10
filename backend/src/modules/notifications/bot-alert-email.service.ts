/**
 * bot-alert-email.service.ts
 *
 * Dịch vụ chuyên trách gửi Email cảnh báo vận hành Bot & Trạng thái Agent.
 * Thuộc phân hệ NotificationsModule theo chuẩn Single Responsibility Principle (SRP).
 * Đọc cấu hình SMTP động từ CSDL / Biến môi trường — TUYỆT ĐỐI KHÔNG GÁN CỨNG MẬT KHẨU.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export interface IAgentStatusInfo {
  hostname: string;
  platform: string;
  lastSeen: Date;
}

@Injectable()
export class BotAlertEmailService {
  private readonly logger = new Logger(BotAlertEmailService.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  /**
   * Lấy cấu hình SMTP động từ SystemSettings hoặc biến môi trường .env.
   */
  private async getSmtpConfig(): Promise<{
    enabled: boolean;
    recipients: string[];
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      senderEmail: string;
      senderName: string;
    };
  }> {
    let mailSettings = {
      isSendWarning: true,
      email: ['it.support@mxv.vn'],
    };
    let smtpConfig: any = {};

    if (this.settingsService) {
      try {
        const configStr = await this.settingsService.getSetting(
          'margin_checker_config',
          '{}',
        );
        const parsed = JSON.parse(configStr);
        if (parsed.opFailureAlert) {
          mailSettings = { ...mailSettings, ...parsed.opFailureAlert };
        }
        if (parsed.smtp) {
          smtpConfig = parsed.smtp;
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc cấu hình SMTP từ settings: ${err.message}`);
      }
    }

    const host = smtpConfig.host || process.env.SMTP_HOST || 'smtp.office365.com';
    const port = Number(smtpConfig.port || process.env.SMTP_PORT || 587);
    const user = smtpConfig.user || process.env.SMTP_USER || 'it.support@mxv.vn';
    const pass = smtpConfig.pass || process.env.SMTP_PASS || '';
    const senderEmail = smtpConfig.senderEmail || process.env.SMTP_SENDER_EMAIL || user;
    const senderName = smtpConfig.senderName || process.env.SMTP_SENDER_NAME || 'MXV IT Support';

    return {
      enabled: mailSettings.isSendWarning,
      recipients: mailSettings.email,
      smtp: {
        host,
        port,
        secure: port === 465,
        user,
        pass,
        senderEmail,
        senderName,
      },
    };
  }

  /**
   * Gửi Email cảnh báo khi một Bot Job bị thất bại sau khi hết số lần retry.
   */
  async sendOperationalFailureAlert(job: any, errorMsg: string): Promise<void> {
    try {
      const { enabled, recipients, smtp } = await this.getSmtpConfig();
      if (!enabled) return;

      if (!smtp.pass) {
        this.logger.warn(
          `[BotAlertEmail] Không tìm thấy mật khẩu SMTP (chưa cấu hình trong CSDL hoặc .env). Bỏ qua gửi email cảnh báo.`,
        );
        return;
      }

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false,
        },
      });

      const payload = job.payload || {};
      const subject = `[CẢNH BÁO VẬN HÀNH BOT] Tác vụ ${job.jobType} thất bại sau ${job.maxAttempts} lần thử`;
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #dc3545;"> Cảnh Báo Tác Vụ Bot Thất Bại Vĩnh Viễn</h2>
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
        to: recipients,
        subject,
        html,
      });

      this.logger.log(`Operational failure alert email sent to: ${recipients.join(', ')}`);
    } catch (err: any) {
      this.logger.error(`Failed to send operational failure alert email: ${err.message}`);
    }
  }

  /**
   * Gửi Email cảnh báo khi RPA Agent thay đổi trạng thái kết nối (Online / Offline).
   */
  async sendConnectionAlertEmail(
    status: IAgentStatusInfo,
    isOnline: boolean,
  ): Promise<void> {
    try {
      const { enabled, recipients, smtp } = await this.getSmtpConfig();
      if (!enabled) return;

      if (!smtp.pass) {
        this.logger.warn(
          `[BotAlertEmail] Không tìm thấy mật khẩu SMTP. Bỏ qua gửi email trạng thái Agent.`,
        );
        return;
      }

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
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
            ${isOnline ? '🟢 RPA Agent Online' : ' RPA Agent Offline Alert'}
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
        to: recipients,
        subject,
        html,
      });

      this.logger.log(`Connection alert email sent to: ${recipients.join(', ')}`);
    } catch (err: any) {
      this.logger.error(`Failed to send connection alert email: ${err.message}`);
    }
  }

  /**
   * Gửi Email cảnh báo khi một phân hệ đối tác vượt ngưỡng tần suất hoặc lỗi liên tiếp.
   * Áp dụng kèm thông tin dập bão email (suppressed count) và cooldown.
   */
  async sendPartnerAuthAlert(params: {
    partner: string;
    violationType: 'CONSECUTIVE_FAILURES' | 'RATE_LIMIT_EXCEEDED' | 'CIRCUIT_BREAKER';
    details: string;
    consecutiveFailures?: number;
    rpm?: number;
    suppressedCount?: number;
    cooldownMinutes?: number;
    customRecipients?: string[];
  }): Promise<void> {
    try {
      const { enabled, recipients: defaultRecipients, smtp } = await this.getSmtpConfig();
      if (!enabled) return;

      const recipients = params.customRecipients && params.customRecipients.length > 0
        ? params.customRecipients
        : defaultRecipients;

      if (!smtp.pass) {
        this.logger.warn(
          `[BotAlertEmail] Không tìm thấy mật khẩu SMTP. Bỏ qua gửi email cảnh báo đối tác ${params.partner}.`,
        );
        return;
      }

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false,
        },
      });

      const violationTitles: Record<string, string> = {
        CONSECUTIVE_FAILURES: 'Lỗi Đăng Nhập / Kết Nối Liên Tiếp Vượt Ngưỡng',
        RATE_LIMIT_EXCEEDED: 'Tần Suất Request (RPM / Login Storm) Vượt Ngưỡng Cho Phép',
        CIRCUIT_BREAKER: 'Ngắt Mạch Khẩn Cấp (Circuit Breaker Tripped)',
      };

      const title = violationTitles[params.violationType] || 'Cảnh Báo Bất Thường Đối Tác';
      const subject = `[CẢNH BÁO AN TOÀN PHÂN HỆ ${params.partner}] ${title}`;

      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 8px;">
            ⚠️ Cảnh Báo An Toàn Xác Thực & Tần Suất Đối Tác
          </h2>
          <p>Hệ thống giám sát tự động <strong>Partner Auth & Rate-Limit Monitor</strong> phát hiện dấu hiệu bất thường từ phân hệ <strong>${params.partner}</strong>:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 8px; border: 1px solid #dee2e6; width: 35%;"><strong>Phân hệ Đối tác:</strong></td>
              <td style="padding: 8px; border: 1px solid #dee2e6;"><span style="color: #0056b3; font-weight: bold;">${params.partner}</span></td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #dee2e6;"><strong>Loại vi phạm:</strong></td>
              <td style="padding: 8px; border: 1px solid #dee2e6; color: #dc3545; font-weight: bold;">${title}</td>
            </tr>
            ${params.consecutiveFailures !== undefined ? `
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 8px; border: 1px solid #dee2e6;"><strong>Số lần lỗi liên tiếp:</strong></td>
              <td style="padding: 8px; border: 1px solid #dee2e6;">${params.consecutiveFailures} lần</td>
            </tr>` : ''}
            ${params.rpm !== undefined ? `
            <tr>
              <td style="padding: 8px; border: 1px solid #dee2e6;"><strong>Tần suất hiện tại (RPM):</strong></td>
              <td style="padding: 8px; border: 1px solid #dee2e6;">${params.rpm} requests/phút</td>
            </tr>` : ''}
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 8px; border: 1px solid #dee2e6;"><strong>Thời gian ghi nhận:</strong></td>
              <td style="padding: 8px; border: 1px solid #dee2e6;">${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #dee2e6;"><strong>Cơ chế dập bão (Cooldown):</strong></td>
              <td style="padding: 8px; border: 1px solid #dee2e6;">Kích hoạt cooldown <strong>${params.cooldownMinutes || 15} phút</strong>${params.suppressedCount ? ` (Đã dập tắt ${params.suppressedCount} thông báo trùng lặp)` : ''}</td>
            </tr>
          </table>
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 15px 0;">
            <strong>Chi tiết sự kiện:</strong>
            <p style="margin: 5px 0 0 0; font-family: monospace; color: #856404;">${params.details}</p>
          </div>
          <p>Đề nghị cán bộ IT Vận hành kiểm tra ngay trạng thái tài khoản, mật khẩu hoặc kết nối mạng của phân hệ nêu trên.</p>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #777;">Email tự động từ hệ thống Giám sát Đối tác MXV Shift Checklist & Trading Manager.</p>
        </div>
      `;

      await transporter.sendMail({
        from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
        to: recipients,
        subject,
        html,
      });

      this.logger.log(`Partner auth alert email sent for ${params.partner} to: ${recipients.join(', ')}`);
    } catch (err: any) {
      this.logger.error(`Failed to send partner auth alert email for ${params.partner}: ${err.message}`);
    }
  }
}
