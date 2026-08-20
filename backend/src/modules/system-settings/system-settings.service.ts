import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSetting } from '../../schemas/system-setting.schema';

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  constructor(
    @InjectModel(SystemSetting.name)
    private readonly systemSettingModel: Model<SystemSetting>,
  ) {}

  async onModuleInit() {
    try {
      const val = await this.getSetting('bot_auto_recovery_enabled', 'true');
      process.env.BOT_AUTO_RECOVERY_ENABLED = val;
      console.log(`[BOOT] Auto-Recovery settings: ${process.env.BOT_AUTO_RECOVERY_ENABLED}`);
    } catch (err: any) {
      console.error('Failed to load bot_auto_recovery_enabled setting during boot:', err?.message);
    }
  }

  async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    const setting = await this.systemSettingModel.findOne({ key }).exec();
    return setting ? setting.value : defaultValue;
  }

  async setSetting(key: string, value: string): Promise<SystemSetting> {
    let setting = await this.systemSettingModel.findOne({ key }).exec();
    const oldValue = setting ? setting.value : '';

    let saved: SystemSetting;
    if (setting) {
      setting.value = value;
      saved = await setting.save();
    } else {
      setting = new this.systemSettingModel({ key, value });
      saved = await setting.save();
    }

    if (key === 'bot_auto_recovery_enabled') {
      process.env.BOT_AUTO_RECOVERY_ENABLED = value;
      console.log(`[SYSTEM SETTINGS] Reactively updated BOT_AUTO_RECOVERY_ENABLED = ${value}`);
    }

    if (oldValue !== value) {
      this.sendSecurityAuditEmail(key, oldValue, value).catch((err) => {
        console.error(`Lỗi gửi email audit log: ${err.message}`);
      });
    }

    return saved;
  }

  private async sendSecurityAuditEmail(
    key: string,
    oldValue: string,
    newValue: string,
  ) {
    try {
      if (oldValue === newValue) return;

      // Bỏ qua gửi email cảnh báo đối với các tham số tự động thay đổi bởi Bot để tránh spam hòm thư
      const ignoredKeys = [
        'm365_refresh_token',
        'm365_token_renewed_at',
        'm365_token_error_sent_at',
      ];
      if (ignoredKeys.includes(key)) {
        return;
      }

      // Nếu chỉ thay đổi timestamp gửi mail động thì bỏ qua không báo cấu hình thay đổi
      if (key === 'margin_checker_config') {
        try {
          const oldObj = JSON.parse(oldValue);
          const newObj = JSON.parse(newValue);
          const oldSanitized = sanitizeConfig(oldObj);
          const newSanitized = sanitizeConfig(newObj);
          if (JSON.stringify(oldSanitized) === JSON.stringify(newSanitized)) {
            return;
          }
        } catch (e) {
          // Bỏ qua lỗi parse JSON và chạy so sánh text bình thường
        }
      }

      const configStr = await this.getSetting('margin_checker_config', '{}');
      const config = JSON.parse(configStr);
      const mailSettings = config.securityAudit || {
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

      const subject = `⚠️ [MXV SECURITY AUDIT] Cảnh báo Thay đổi Cấu hình Hệ thống Quan trọng`;

      let oldDisplay = oldValue;
      let newDisplay = newValue;
      try {
        if (oldValue.startsWith('{') || oldValue.startsWith('[')) {
          oldDisplay = JSON.stringify(JSON.parse(oldValue), null, 2);
        }
        if (newValue.startsWith('{') || newValue.startsWith('[')) {
          newDisplay = JSON.stringify(JSON.parse(newValue), null, 2);
        }
      } catch {}

      const htmlBody = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
            <div style="max-width: 800px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid #d97706;">
              <div style="padding: 20px;">
                <h2 style="color: #d97706; margin-top: 0;">⚠️ Cảnh Báo Thay Đổi Cấu Hình Hệ Thống</h2>
                <p>Hệ thống ghi nhận một thay đổi cấu hình quan trọng vừa được thực hiện.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 180px; background-color: #f8f9fa;">Tham số thay đổi</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #1e3a8a;">${key}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f8f9fa;">Thời gian</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString('vi-VN')}</td>
                  </tr>
                </table>

                <div style="margin-bottom: 20px;">
                  <h3>Cấu hình CŨ:</h3>
                  <pre style="background-color: #f1f5f9; padding: 15px; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-size: 13px; max-height: 250px; overflow-y: auto; white-space: pre-wrap;">${oldDisplay || '(Rỗng)'}</pre>
                </div>

                <div style="margin-bottom: 20px;">
                  <h3>Cấu hình MỚI:</h3>
                  <pre style="background-color: #ecfdf5; padding: 15px; border: 1px solid #a7f3d0; border-radius: 4px; font-family: monospace; font-size: 13px; max-height: 250px; overflow-y: auto; white-space: pre-wrap;">${newDisplay || '(Rỗng)'}</pre>
                </div>
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
    } catch (err: any) {
      console.error(
        `Không thể gửi email audit thay đổi cấu hình: ${err.message}`,
      );
    }
  }

  async sendM365TokenExpiredAlert(errorMsg: string): Promise<void> {
    try {
      // Throttle: check when the last warning email was sent
      const lastSentStr = await this.getSetting('m365_token_error_sent_at', '');
      if (lastSentStr) {
        const lastSent = new Date(lastSentStr).getTime();
        const now = Date.now();
        // Send at most once every 4 hours (14400000 ms)
        if (now - lastSent < 14400000) {
          return;
        }
      }

      const configStr = await this.getSetting('margin_checker_config', '{}');
      const config = JSON.parse(configStr);
      
      const mailSettings = config.securityAudit || {
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

      const subject = `[MXV BOT WARNING] Cảnh báo: Refresh Token Đọc Email Của Bot Đã Hết Hạn / Bị Thu Hồi`;
      
      const htmlBody = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid #dc2626;">
              <div style="padding: 20px;">
                <h2 style="color: #dc2626; margin-top: 0;">Cảnh báo: Mất Kết Nối Hòm Thư Bot (Graph API)</h2>
                <p>Kính gửi Bộ phận Vận hành,</p>
                <p>Hệ thống phát hiện lỗi nghiêm trọng khi cố gắng làm mới (refresh) mã Access Token cho hòm thư Bot đọc email:</p>
                
                <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 4px;">
                  <strong style="color: #991b1b;">Chi tiết lỗi từ Microsoft:</strong>
                  <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace; margin: 5px 0 0 0; color: #7f1d1d;">${errorMsg}</pre>
                </div>
                
                <p><b>Hậu quả:</b> Robot sẽ <b>không thể tự động quét và tải xuống</b> các báo cáo khớp lệnh/vị thế (Straits, CQG, v.v.) qua email cho đến khi sự cố được khắc phục.</p>
                
                <p><b>Hướng dẫn khắc phục:</b></p>
                <ol>
                  <li>Truy cập vào Trang Quản trị Hệ thống (Admin Panel) -> Tab <b>Cấu hình hệ thống RPA & Robot</b>.</li>
                  <li>Tìm phần <b>Cấu hình Đọc Email (M365 / Graph API)</b>.</li>
                  <li>Nhấn nút <b>Cấp quyền (Authorize)</b> bên phải tiêu đề để thực hiện đăng nhập và cấp lại quyền đọc email cho Bot, hoặc nhập thủ công Refresh Token hợp lệ mới vào ô cấu hình.</li>
                </ol>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                <p style="font-size: 0.85rem; color: #6b7280; margin: 0;">Lưu ý: Đây là thư cảnh báo tự động từ hệ thống giám sát MXV Shift Checklist.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const recipientEmails = [...mailSettings.email];
      const watcherEmail = (await this.getSetting('m365_watcher_email', '')) || process.env.MICROSOFT_WATCHER_EMAIL || '';
      if (watcherEmail && !recipientEmails.includes(watcherEmail)) {
        recipientEmails.push(watcherEmail);
      }
      if (smtp.senderEmail && !recipientEmails.includes(smtp.senderEmail)) {
        recipientEmails.push(smtp.senderEmail);
      }

      await transporter.sendMail({
        from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
        to: recipientEmails.join(', '),
        subject,
        html: htmlBody,
      });

      // Update sent warning timestamp in database settings to throttle future alerts
      await this.setSetting('m365_token_error_sent_at', new Date().toISOString());
      console.log(`[M365-BOT] Đã gửi cảnh báo lỗi Refresh Token hết hạn qua email tới ${recipientEmails.join(', ')}`);
    } catch (err: any) {
      console.error(`Lỗi khi gửi email cảnh báo lỗi Token Bot: ${err.message}`);
    }
  }

  async findAll(): Promise<SystemSetting[]> {
    return this.systemSettingModel.find().exec();
  }
}

/**
 * Đệ quy loại bỏ các trường thời gian động để so sánh cấu hình tĩnh
 */
function sanitizeConfig(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeConfig);
  
  const copy = { ...obj };
  const keysToIgnore = ['lastEmailSentAt', 'lastEmailStatus', 'lastEmailError'];
  for (const k of keysToIgnore) {
    delete copy[k];
  }
  for (const k of Object.keys(copy)) {
    copy[k] = sanitizeConfig(copy[k]);
  }
  return copy;
}
