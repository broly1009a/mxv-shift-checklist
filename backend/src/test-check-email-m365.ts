import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';

async function run() {
  console.log('🚀 Khởi tạo NestJS Application Context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const settingsService = app.get(SystemSettingsService);

  try {
    console.log('📡 Đang đọc thông tin cấu hình M365 từ Database...');
    const clientId = (await settingsService.getSetting('m365_client_id', '')) || process.env.MICROSOFT_CLIENT_ID || '';
    const tenantId = (await settingsService.getSetting('m365_tenant_id', '')) || process.env.MICROSOFT_TENANT_ID || 'common';
    const clientSecret = (await settingsService.getSetting('m365_client_secret', '')) || process.env.MICROSOFT_CLIENT_SECRET || '';
    const refreshToken = await settingsService.getSetting('m365_refresh_token', '');
    const watcherEmail = (await settingsService.getSetting('m365_watcher_email', '')) || process.env.MICROSOFT_WATCHER_EMAIL || '';

    console.log(` - Client ID: ${clientId}`);
    console.log(` - Tenant ID: ${tenantId}`);
    console.log(` - Watcher Email: ${watcherEmail}`);
    console.log(` - Has Client Secret: ${!!clientSecret}`);
    console.log(` - Has Refresh Token: ${!!refreshToken}`);

    if (!refreshToken) {
      throw new Error('Không tìm thấy Refresh Token của Bot trong Database!');
    }

    console.log('🔑 Đang lấy Access Token mới từ Microsoft...');
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('scope', 'https://graph.microsoft.com/.default');

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Lấy Access Token thất bại (HTTP ${tokenRes.status}): ${text}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Lấy Access Token thành công!');

    const searchSubject = "MXV M-System - Thông báo kết quả Job Snapshot dữ liệu";
    const targetSender = "minhle@mxv.vn";

    // Query messages in mailbox
    console.log(`\n🔍 Đang tìm kiếm thư với tiêu đề bắt đầu bằng: "${searchSubject}"...`);
    const query = `https://graph.microsoft.com/v1.0/users/${watcherEmail}/messages?$filter=startsWith(subject,'${encodeURIComponent(searchSubject)}')&$top=30`;
    
    const messagesRes = await fetch(query, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'outlook.body-content-type="text"'
      }
    });

    if (!messagesRes.ok) {
      const text = await messagesRes.text();
      throw new Error(`Graph API thất bại (HTTP ${messagesRes.status}): ${text}`);
    }

    const messagesData = await messagesRes.json();
    const messages = messagesData.value || [];
    console.log(`🔎 Tìm thấy ${messages.length} thư có tiêu đề khớp mẫu.`);

    let found = false;
    for (const msg of messages) {
      const fromAddress = msg.from?.emailAddress?.address || '';
      const subject = msg.subject || '';
      const bodyContent = msg.body?.content || '';

      const isSenderMatch = fromAddress.toLowerCase() === targetSender.toLowerCase();
      const isBodyContentMatch = bodyContent.includes('Hệ thống MXV M-System thông báo');

      if (isSenderMatch) {
        found = true;
        console.log('\n======================================================================');
        console.log('⭐️⭐️⭐️ ĐÃ TÌM THẤY THƯ KHỚP YÊU CẦU! ⭐️⭐️⭐️');
        console.log('======================================================================');
        console.log(`Tiêu đề (Subject): ${subject}`);
        console.log(`Người gửi (Sender): ${msg.from?.emailAddress?.name} <${fromAddress}>`);
        console.log(`Thời gian nhận (Received): ${msg.receivedDateTime}`);
        console.log(`Nội dung thư khớp kiểm tra chứa 'Hệ thống MXV M-System thông báo'? ${isBodyContentMatch ? 'CÓ' : 'KHÔNG'}`);
        console.log('\nNội dung chi tiết thư (Full Body Content):');
        console.log('----------------------------------------------------------------------');
        console.log(bodyContent.trim());
        console.log('----------------------------------------------------------------------');
      }
    }

    if (!found) {
      console.log('\n❌ Không tìm thấy thư nào từ người gửi "minhle@mxv.vn" khớp với các tiêu chí tìm kiếm.');
    }

  } catch (err: any) {
    console.error('\n❌ LỖI TRONG QUÁ TRÌNH CHẠY:');
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
