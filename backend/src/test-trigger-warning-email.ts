import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';

async function run() {
  console.log('🚀 Khởi tạo NestJS Application Context cho kịch bản Test Cảnh Báo Email...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const settingsService = app.get(SystemSettingsService);

  try {
    console.log('📡 Đang đọc thông tin cấu hình M365 từ Database...');
    const clientId = (await settingsService.getSetting('m365_client_id', '')) || process.env.MICROSOFT_CLIENT_ID || '';
    const tenantId = (await settingsService.getSetting('m365_tenant_id', '')) || process.env.MICROSOFT_TENANT_ID || 'common';
    const clientSecret = (await settingsService.getSetting('m365_client_secret', '')) || process.env.MICROSOFT_CLIENT_SECRET || '';
    const originalRefreshToken = await settingsService.getSetting('m365_refresh_token', '');
    const watcherEmail = (await settingsService.getSetting('m365_watcher_email', '')) || process.env.MICROSOFT_WATCHER_EMAIL || '';

    if (!originalRefreshToken) {
      throw new Error('Không tìm thấy Refresh Token trong Database! Hãy chạy cấu hình lại trước.');
    }

    // Reset throttle để đảm bảo email được gửi đi ngay lập tức
    console.log('🧹 Đang xóa vết gửi lỗi cũ (Reset Throttle) để ép gửi email lập tức...');
    await settingsService.setSetting('m365_token_error_sent_at', '1970-01-01T00:00:00.000Z');

    // Cố ý phá hỏng Refresh Token bằng cách thêm hậu tố lỗi
    const corruptedRefreshToken = originalRefreshToken + '_invalid_corrupted_123';
    console.log('🧨 Đang giả lập Refresh Token HỎNG:');
    console.log(` - Token thật (độ dài): ${originalRefreshToken.length} ký tự`);
    console.log(` - Token hỏng giả lập (độ dài): ${corruptedRefreshToken.length} ký tự`);

    console.log('🔑 Đang gửi yêu cầu xác thực bằng Token HỎNG lên Microsoft...');
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', corruptedRefreshToken);
    params.append('scope', 'https://graph.microsoft.com/.default');

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    console.log(`📡 Phản hồi từ Microsoft: HTTP ${tokenRes.status}`);
    const errText = await tokenRes.text();

    if (!tokenRes.ok) {
      console.log('❌ Xác thực thất bại đúng như kịch bản!');
      const errorMsg = `Xác thực bằng Refresh Token thất bại (HTTP ${tokenRes.status}): ${errText}`;
      
      console.log('📧 Đang tiến hành gửi Email Cảnh báo Sự cố...');
      // Gọi trực tiếp hàm gửi cảnh báo
      await settingsService.sendM365TokenExpiredAlert(errorMsg);
      console.log('✅ ĐÃ GỬI EMAIL CẢNH BÁO THÀNH CÔNG!');
    } else {
      console.log('⚠️ Cảnh báo: Microsoft vẫn chấp nhận token này? Kịch bản test thất bại.');
    }

  } catch (err: any) {
    console.error('\n❌ LỖI TRONG QUÁ TRÌNH CHẠY TEST:');
    console.error(err.message);
  } finally {
    await app.close();
    console.log('\n⌛ Đã đóng NestJS Application Context.');
  }
}

run().catch((err) => {
  console.error('Lỗi nghiêm trọng:', err);
  process.exit(1);
});
