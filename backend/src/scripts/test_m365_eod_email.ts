import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';

async function diagnoseM365EODEmail() {
  console.log('================================================================');
  console.log(' CHẨN ĐOÁN KẾT NỐI M365 GRAPH API & QUÉT EMAIL EOD M-SYSTEM');
  console.log('================================================================\n');

  // 1. Kết nối MongoDB để lấy credentials mới nhất từ SystemSettings
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error(' [LỖI] MONGODB_URI không tìm thấy trong .env');
    return;
  }

  console.log('1. Đang kết nối MongoDB...');
  await mongoose.connect(mongoUri);
  console.log(' Đã kết nối MongoDB thành công.');

  const db = mongoose.connection.db;
  if (!db) {
    console.error(' [LỖI] Không thể truy cập MongoDB database.');
    return;
  }

  // Đọc settings từ collection systemsettings
  const settingsCol = db.collection('systemsettings');
  const getSetting = async (key: string, defaultVal: string = '') => {
    const doc = await settingsCol.findOne({ key });
    return doc?.value || defaultVal;
  };

  const clientId = (await getSetting('m365_client_id')) || process.env.MICROSOFT_CLIENT_ID || '';
  const clientSecret = (await getSetting('m365_client_secret')) || process.env.MICROSOFT_CLIENT_SECRET || '';
  const tenantId = (await getSetting('m365_tenant_id')) || process.env.MICROSOFT_TENANT_ID || '';
  const watcherEmail = (await getSetting('m365_watcher_email')) || process.env.MICROSOFT_WATCHER_EMAIL || '';
  const refreshToken = (await getSetting('m365_refresh_token')) || process.env.MICROSOFT_REFRESH_TOKEN || '';
  const tokenRenewedAt = await getSetting('m365_token_renewed_at');

  console.log('\n2. THÔNG TIN CẤU HÌNH M365:');
  console.log(`- Tenant ID:       ${tenantId ? tenantId.slice(0, 8) + '...' : '(Trống)'}`);
  console.log(`- Client ID:       ${clientId ? clientId.slice(0, 8) + '...' : '(Trống)'}`);
  console.log(`- Client Secret:   ${clientSecret ? '****** (Đã cấu hình)' : '(Trống)'}`);
  console.log(`- Watcher Email:   ${watcherEmail || '(Trống)'}`);
  console.log(`- Refresh Token:   ${refreshToken ? `${refreshToken.slice(0, 15)}... (${refreshToken.length} ký tự)` : '(Trống)'}`);
  console.log(`- Token Renewed:   ${tokenRenewedAt || 'Chưa có thông tin'}`);

  if (!refreshToken) {
    console.error('\n [LỖI NGHIÊM TRỌNG] Không tìm thấy m365_refresh_token trong Database lẫn file .env!');
    console.error('--> Người dùng cần phải đăng nhập lại SSO M365 trên giao diện Web để cấp lại Refresh Token.');
    await mongoose.disconnect();
    return;
  }

  // 3. Thử lấy Access Token bằng Refresh Token
  console.log('\n3. KIỂM TRA HIỆU LỰC REFRESH TOKEN (Đổi Access Token từ Microsoft)...');
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);
  params.append('scope', 'https://graph.microsoft.com/.default');

  let accessToken = '';
  try {
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      console.error(`\n [LỖI XÁC THỰC OUTLOOK - HTTP ${tokenRes.status}]`);
      console.error(`Chi tiết lỗi từ Microsoft: ${tokenText}`);
      if (tokenText.includes('invalid_grant') || tokenText.includes('AADSTS700084') || tokenText.includes('AADSTS700082')) {
        console.error('\n NGUYÊN NHÂN: REFRESH TOKEN OUTLOOK ĐÃ HẾT HẠN HOẶC BỊ THU HỒI!');
        console.error('Khắc phục: Cần đăng nhập lại Microsoft Outlook trên giao diện Web (/admin/bot-config hoặc SSO) để nhận Refresh Token mới.');
      }
      await mongoose.disconnect();
      return;
    }

    const tokenData = JSON.parse(tokenText);
    accessToken = tokenData.access_token;
    console.log(' THÀNH CÔNG: Refresh Token còn sống! Đã cấp Access Token mới.');
    if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
      console.log(' Đã nhận Refresh Token mới xoay vòng (Token Rotation).');
    }
  } catch (err: any) {
    console.error(`\n Lỗi kết nối máy chủ Microsoft: ${err.message}`);
    await mongoose.disconnect();
    return;
  }

  // 4. Kiểm tra Endpoint Graph API (/me vs /users/{email})
  console.log('\n4. KIỂM TRA QUYỀN TRUY CẬP GRAPH API:');
  
  // Endpoint A: /me/messages
  let meSuccess = false;
  let meEmails: any[] = [];
  try {
    const meUrl = 'https://graph.microsoft.com/v1.0/me/messages?$top=5&$select=subject,sender,receivedDateTime';
    const res = await fetch(meUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) {
      const data = await res.json();
      meEmails = data.value || [];
      meSuccess = true;
      console.log(` Endpoint /me/messages: THÀNH CÔNG (HTTP 200). Đọc được ${meEmails.length} email.`);
    } else {
      console.log(` Endpoint /me/messages: THẤT BẠI (HTTP ${res.status}: ${res.statusText})`);
    }
  } catch (e: any) {
    console.log(` Endpoint /me/messages: Lỗi ${e.message}`);
  }

  // Endpoint B: /users/{watcherEmail}/messages
  let usersSuccess = false;
  try {
    const usersUrl = `https://graph.microsoft.com/v1.0/users/${watcherEmail}/messages?$top=5&$select=subject,sender,receivedDateTime`;
    const res = await fetch(usersUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) {
      usersSuccess = true;
      console.log(` Endpoint /users/${watcherEmail}/messages: THÀNH CÔNG (HTTP 200).`);
    } else {
      console.log(` Endpoint /users/${watcherEmail}/messages: THẤT BẠI (HTTP ${res.status}: ${res.statusText})`);
      console.log(`   --> Chú ý: Delegated Token không có quyền Directory.Read.All sẽ bị 403 Forbidden tại đây!`);
    }
  } catch (e: any) {
    console.log(` Endpoint /users/${watcherEmail}/messages: Lỗi ${e.message}`);
  }

  // 5. Quét tìm email EOD trong hòm thư (Tìm kiếm rộng trong 7 ngày qua)
  console.log('\n5. QUÉT TÌM EMAIL EOD TRONG HÒM THƯ (Cửa sổ 7 ngày qua):');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const baseGraphUrl = meSuccess ? 'https://graph.microsoft.com/v1.0/me/messages' : `https://graph.microsoft.com/v1.0/users/${watcherEmail}/messages`;
  
  // Lấy top 50 email gần nhất
  const queryUrl = `${baseGraphUrl}?$filter=receivedDateTime ge ${sevenDaysAgo}&$select=id,subject,sender,receivedDateTime,hasAttachments,bodyPreview&$top=50&$orderby=receivedDateTime desc`;
  
  try {
    const searchRes = await fetch(queryUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!searchRes.ok) {
      console.error(`\n [LỖI] Không thể quét danh sách email: HTTP ${searchRes.status} ${searchRes.statusText}`);
      await mongoose.disconnect();
      return;
    }

    const searchData = await searchRes.json();
    const allEmails = searchData.value || [];
    console.log(`Đã tải ${allEmails.length} email gần nhất từ ${sevenDaysAgo.slice(0, 10)}.`);

    // Lọc các email liên quan đến EOD hoặc M-System
    const candidateEmails = allEmails.filter((em: any) => {
      const sub = (em.subject || '').toLowerCase();
      const sdr = (em.sender?.emailAddress?.address || '').toLowerCase();
      const sdrName = (em.sender?.emailAddress?.name || '').toLowerCase();
      return sub.includes('eod') || sub.includes('m-system') || sdr.includes('m-system') || sdrName.includes('m-system');
    });

    console.log(`\n==> TÌM THẤY ${candidateEmails.length} EMAIL CÓ LIÊN QUAN ĐẾN EOD / M-SYSTEM:`);

    for (let i = 0; i < candidateEmails.length; i++) {
      const em = candidateEmails[i];
      const fromAddr = em.sender?.emailAddress?.address || 'N/A';
      const fromName = em.sender?.emailAddress?.name || 'N/A';
      console.log(`\n--- [Email #${i + 1}] ---`);
      console.log(`ID:           ${em.id}`);
      console.log(`Thời gian:    ${em.receivedDateTime}`);
      console.log(`Người gửi:    "${fromName}" <${fromAddr}>`);
      console.log(`Tiêu đề:      "${em.subject}"`);
      console.log(`Có đính kèm:  ${em.hasAttachments ? 'CÓ (True)' : 'KHÔNG'}`);
      console.log(`Xem trước:    ${(em.bodyPreview || '').slice(0, 150)}...`);

      // Kiểm tra file đính kèm nếu có
      if (em.hasAttachments) {
        const attachUrl = meSuccess 
          ? `https://graph.microsoft.com/v1.0/me/messages/${em.id}/attachments`
          : `https://graph.microsoft.com/v1.0/users/${watcherEmail}/messages/${em.id}/attachments`;
        const attachRes = await fetch(attachUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (attachRes.ok) {
          const attachData = await attachRes.json();
          const files = attachData.value || [];
          console.log(`Tệp đính kèm (${files.length}):`);
          files.forEach((f: any) => {
            console.log(`   - Tên file: "${f.name}", Kích thước: ${f.size} bytes, Loại: ${f['@odata.type']}`);
          });
        } else {
          console.log(`   Lỗi tải thông tin đính kèm: HTTP ${attachRes.status}`);
        }
      }

      // ĐỐI CHIẾU VỚI CẤU HÌNH CỦA USER:
      const targetConfig = {
        subject: "MXV M-System - Thông báo kết quả chạy EOD hệ thống",
        sender: "it.support@mxv.vn"
      };

      console.log('\n   [KIỂM THỬ KHỚP ĐIỀU KIỆN BOT]');
      const subMatch = em.subject.toLowerCase().includes(targetConfig.subject.toLowerCase());
      const sdrMatch = fromAddr.toLowerCase() === targetConfig.sender.toLowerCase();
      console.log(`   - Khớp Tiêu đề ("${targetConfig.subject}"): ${subMatch ? 'KHỚP' : 'KHÔNG KHỚP'}`);
      console.log(`   - Khớp Người gửi ("${targetConfig.sender}"):   ${sdrMatch ? 'KHỚP' : `KHÔNG KHỚP (Thực tế là "${fromAddr}")`}`);
      
      if (subMatch && sdrMatch) {
        console.log(`   ==> KẾT LUẬN: EMAIL NÀY SẼ ĐƯỢC BOT CHẤP NHẬN 100%!`);
      } else {
        console.log(`   ==> KẾT LUẬN: BOT SẼ BỎ QUA VÌ KHÔNG KHỚP ĐIỀU KIỆN LỌC!`);
      }
    }

    if (candidateEmails.length === 0) {
      console.log('\n [CẢNH BÁO] Không tìm thấy bất kỳ email nào chứa từ khóa "EOD" hoặc "M-System" trong 7 ngày qua!');
      console.log(`Vui lòng kiểm tra lại xem hòm thư "${watcherEmail}" có thực sự nhận được email EOD không.`);
    }

  } catch (err: any) {
    console.error(`\n Lỗi quét email: ${err.message}`);
  } finally {
    await mongoose.disconnect();
    console.log('\n================================================================');
    console.log(' HOÀN THÀNH CHẨN ĐOÁN.');
    console.log('================================================================');
  }
}

diagnoseM365EODEmail().catch(console.error);
