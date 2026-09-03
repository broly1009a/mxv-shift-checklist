import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';
import { SystemSettingSchema } from '../schemas/system-setting.schema';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  console.log('='.repeat(70));
  console.log('📬 KIỂM TRA KẾT NỐI MICROSOFT 365 GRAPH API & QUÉT EMAIL OUTLOOK');
  console.log('='.repeat(70));

  // 1. Kết nối MongoDB
  console.log('\n[1] Đang kết nối tới MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Kết nối MongoDB thành công!');

  const SettingModel = mongoose.model('SystemSetting', SystemSettingSchema);

  // 2. Đọc cấu hình Microsoft 365
  console.log('\n[2] Đang nạp cấu hình OAuth M365 từ Database...');
  const getSetting = async (key: string, def: string = '') => {
    const doc = await SettingModel.findOne({ key }).lean();
    return (doc as any)?.value || def;
  };

  const clientId = (await getSetting('m365_client_id')) || process.env.MICROSOFT_CLIENT_ID || '';
  const tenantId = (await getSetting('m365_tenant_id')) || process.env.MICROSOFT_TENANT_ID || 'common';
  const clientSecret = (await getSetting('m365_client_secret')) || process.env.MICROSOFT_CLIENT_SECRET || '';
  const refreshToken = (await getSetting('m365_refresh_token')) || process.env.MICROSOFT_REFRESH_TOKEN || '';
  const watcherEmail = (await getSetting('m365_watcher_email')) || process.env.MICROSOFT_WATCHER_EMAIL || '';

  console.log(`  - Client ID:        ${clientId ? clientId.slice(0, 8) + '...' : '(Chưa cấu hình)'}`);
  console.log(`  - Tenant ID:        ${tenantId ? tenantId.slice(0, 8) + '...' : 'common'}`);
  console.log(`  - Watcher Email:    ${watcherEmail || '(Chưa cấu hình)'}`);
  console.log(`  - Client Secret:    ${clientSecret ? '✅ Đã có' : '❌ Chưa có'}`);
  console.log(`  - Refresh Token:    ${refreshToken ? '✅ Đã có trong DB' : '❌ Chưa có'}`);

  if (!refreshToken) {
    console.log('\n❌ Lỗi: Không tìm thấy Refresh Token M365 trong Database (key: m365_refresh_token).');
    console.log('👉 Vui lòng vào trang Web Admin -> Quản lý Bot / Cấu hình M365 để đăng nhập cấp quyền Microsoft.');
    await mongoose.disconnect();
    return;
  }

  // 3. Đổi Refresh Token lấy Access Token mới
  console.log('\n[3] Đang gửi yêu cầu đổi Access Token từ Microsoft Identity Platform...');
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);
  params.append('scope', 'https://graph.microsoft.com/.default offline_access');

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error(`\n❌ Đổi Access Token thất bại (HTTP ${tokenRes.status}): ${errText}`);
    await mongoose.disconnect();
    return;
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  console.log('✅ Lấy Access Token thành công (Hết hạn sau:', tokenData.expires_in, 'giây)!');

  // Lưu refresh token mới nếu Microsoft cấp mới
  if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
    console.log('🔄 Đang cập nhật Refresh Token mới vào Database...');
    await SettingModel.updateOne(
      { key: 'm365_refresh_token' },
      { $set: { value: tokenData.refresh_token } },
      { upsert: true },
    );
  }

  // 4. Gọi Microsoft Graph API lấy danh sách email gần nhất
  console.log('\n[4] Đang quét các email mới nhất từ hộp thư Microsoft 365...');
  // Thử endpoint theo watcherEmail hoặc me
  const graphBaseUrl = watcherEmail
    ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(watcherEmail)}/messages`
    : `https://graph.microsoft.com/v1.0/me/messages`;

  const messagesUrl = `${graphBaseUrl}?$top=30&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments,bodyPreview`;
  console.log(`  🌐 Graph Endpoint: ${messagesUrl}`);

  const msgRes = await fetch(messagesUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!msgRes.ok) {
    const errText = await msgRes.text();
    console.error(`\n❌ Không lấy được danh sách thư (HTTP ${msgRes.status}): ${errText}`);
    await mongoose.disconnect();
    return;
  }

  const msgData = await msgRes.json();
  const messages: any[] = msgData.value || [];
  console.log(`✅ Quét thành công! Tìm thấy tổng cộng ${messages.length} email gần nhất trong hộp thư.`);

  // 5. Lọc các email liên quan đến Yêu cầu mở TKGD
  console.log('\n' + '='.repeat(70));
  console.log('📋 KẾT QUẢ TÌM KIẾM EMAIL LIÊN QUAN ĐẾN "MỞ TKGD" / "TKGD":');
  console.log('='.repeat(70));

  const tkgdMessages = messages.filter((m) => {
    const subj = (m.subject || '').toLowerCase();
    return (
      subj.includes('tkgd') ||
      subj.includes('mở tk') ||
      subj.includes('tài khoản giao dịch') ||
      subj.includes('yeu cau mo')
    );
  });

  if (tkgdMessages.length > 0) {
    console.log(`\n🎉 Tìm thấy ${tkgdMessages.length} email liên quan đến mở TKGD:\n`);
    for (let idx = 0; idx < tkgdMessages.length; idx++) {
      const m = tkgdMessages[idx];
      const fromSender = `${m.from?.emailAddress?.name || ''} <${m.from?.emailAddress?.address || ''}>`;
      console.log(`[${idx + 1}] Tiêu đề: ${m.subject}`);
      console.log(`    - Người gửi:    ${fromSender}`);
      console.log(`    - Thời gian:    ${m.receivedDateTime}`);
      console.log(`    - Đính kèm file:${m.hasAttachments ? 'Có (Yes)' : 'Không (No)'}`);
      console.log(`    - Trích đoạn:   ${(m.bodyPreview || '').slice(0, 100)}...`);
      console.log(`    - Message ID:   ${m.id}`);

      // Nếu có file đính kèm, lấy danh sách tên file đính kèm
      if (m.hasAttachments) {
        const attachUrl = watcherEmail
          ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(watcherEmail)}/messages/${m.id}/attachments?$select=id,name,contentType,size`
          : `https://graph.microsoft.com/v1.0/me/messages/${m.id}/attachments?$select=id,name,contentType,size`;

        const attachRes = await fetch(attachUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (attachRes.ok) {
          const attachData = await attachRes.json();
          const fileNames = (attachData.value || []).map((a: any) => `${a.name} (${(a.size / 1024).toFixed(1)} KB)`);
          console.log(`    - Danh sách file: ${fileNames.join(', ')}`);
        }
      }
      console.log('-'.repeat(50));
    }
  } else {
    console.log('\n⚠️ Không thấy email nào chứa từ khóa "mở TKGD" trong 30 thư gần nhất.');
    console.log('📌 Top 5 email mới nhất trong hộp thư:');
    messages.slice(0, 5).forEach((m, i) => {
      console.log(`  [${i + 1}] ${m.subject} (Từ: ${m.from?.emailAddress?.address} lúc ${m.receivedDateTime})`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎯 KẾT LUẬN: TOKEN OUTLOOK HOẠT ĐỘNG HOÀN TOÀN BÌNH THƯỜNG!');
  console.log('='.repeat(70));

  await mongoose.disconnect();
}

main().catch(console.error);
