import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSetting } from '../../schemas/system-setting.schema';

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectModel(SystemSetting.name)
    private readonly systemSettingModel: Model<SystemSetting>,
  ) {}

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

    if (oldValue !== value) {
      this.sendSecurityAuditEmail(key, oldValue, value).catch((err) => {
        console.error(`Lỗi gửi email audit log: ${err.message}`);
      });
    }

    return saved;
  }

  private async sendSecurityAuditEmail(key: string, oldValue: string, newValue: string) {
    try {
      if (oldValue === newValue) return;

      const configStr = await this.getSetting('margin_checker_config', '{}');
      const config = JSON.parse(configStr);
      const mailSettings = config.securityAudit || { isSendWarning: true, email: ['it.support@mxv.vn'] };
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
      console.error(`Không thể gửi email audit thay đổi cấu hình: ${err.message}`);
    }
  }

  async findAll(): Promise<SystemSetting[]> {
    return this.systemSettingModel.find().exec();
  }
}
