/**
 * test_ingress_ms_api.js
 * Script kiểm thử độc lập cho MsApiAdapter (Chặng 4: M-System Direct REST API)
 * 
 * Cách chạy:
 *   cd backend
 *   node src/scripts/test_ingress_ms_api.js
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Format mã hóa không hợp lệ (thiếu IV)');
  }
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

async function runTest() {
  console.log('========================================================================');
  console.log('   KIỂM THỬ ĐỘC LẬP: MS-API ADAPTER (M-SYSTEM 2-STEP PIN REST API)      ');
  console.log('========================================================================\n');

  // 1. Lấy thông tin đăng nhập từ MongoDB hoặc .env
  let username = process.env.MS_USERNAME || '';
  let password = process.env.MS_PASSWORD || '';
  let pin = process.env.MS_PIN || '269696';
  let baseUrl = process.env.MS_BASE_URL || 'https://api-dev.newgen.dev';
  let adminUrl = process.env.MS_ADMIN_URL || 'https://admin-dev.msystem.newgen.dev';

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv-checklist';
  try {
    console.log(`1. Đang kết nối MongoDB (${uri.split('@').pop()})...`);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    const db = mongoose.connection.db;
    const setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });
    if (setting && setting.value) {
      const decrypted = decrypt(setting.value);
      const creds = JSON.parse(decrypted);
      if (creds.username) username = creds.username;
      if (creds.password) password = creds.password;
      if (creds.pin) pin = creds.pin;
      if (creds.baseUrl) baseUrl = creds.baseUrl;
      if (creds.adminUrl) adminUrl = creds.adminUrl;
      console.log('   Tìm thấy cấu hình bot_credentials_msystem trong Database.');
    } else {
      console.log('   Không tìm thấy bot_credentials_msystem trong DB, dùng fallback từ .env.');
    }
  } catch (err) {
    console.log(`   [Bỏ qua DB] Không thể kết nối DB (${err.message}). Dùng biến môi trường / fallback.`);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log(`\n2. Cấu hình kiểm thử:`);
  console.log(`   - Base URL : ${baseUrl}`);
  console.log(`   - Admin URL: ${adminUrl}`);
  console.log(`   - Username : ${username}`);
  console.log(`   - PIN      : ${pin ? '******' : 'Chưa cấu hình'}\n`);

  if (!username || !password) {
    console.error(' Lỗi: Thiếu username hoặc password để đăng nhập M-System!');
    process.exit(1);
  }

  // 2. Thực hiện đăng nhập 2 bước
  console.log('3. Bắt đầu quy trình xác thực 2 bước (Password + PIN):');
  const commonHeaders = {
    accept: 'application/json',
    'accept-language': 'en-US,en;q=0.9',
    origin: adminUrl,
    referer: `${adminUrl}/`,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const t0 = Date.now();
  // Bước 1: Login password
  console.log('   - [Bước 1] Gửi yêu cầu đăng nhập mật khẩu...');
  const loginRes = await fetch(`${baseUrl}/am/admin/users/login`, {
    method: 'POST',
    headers: { ...commonHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const loginData = await loginRes.json().catch(() => null);
  if (!loginRes.ok || loginData?.status !== 'ok' || !loginData?.data?.user) {
    console.error('    Đăng nhập Bước 1 thất bại:', loginData?.message || loginRes.status);
    process.exit(1);
  }

  const userStep1 = loginData.data.user;
  const userId = userStep1.id || userStep1._id;
  const tempToken = userStep1.accessToken;
  console.log(`     Bước 1 thành công! UserId: ${userId}, Temp Token: ${tempToken.slice(0, 20)}...`);

  // Bước 2: Verify PIN
  console.log('   - [Bước 2] Xác thực mã PIN bảo mật...');
  const pinRes = await fetch(`${baseUrl}/am/admin/users/verifyPin/${userId}`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'content-type': 'application/json',
      authorization: `Bearer ${tempToken}`,
    },
    body: JSON.stringify({ pin: String(pin) }),
  });

  const pinData = await pinRes.json().catch(() => null);
  if (!pinRes.ok || pinData?.status !== 'ok' || !pinData?.data?.user) {
    console.error('    Đăng nhập Bước 2 (PIN) thất bại:', pinData?.message || pinRes.status);
    process.exit(1);
  }

  const finalToken = pinData.data.user.accessToken;
  const authDurationMs = Date.now() - t0;
  console.log(`     Bước 2 thành công! Đã cấp Bearer Token (${authDurationMs}ms)`);
  console.log(`     Token: ${finalToken.slice(0, 35)}...\n`);

  // 3. Tải 3 báo cáo cốt lõi của ca trực
  const outputDir = path.join(process.cwd(), 'temp', 'test_ingress_ms_output');
  fs.mkdirSync(outputDir, { recursive: true });

  const reports = [
    { key: 'TTM', name: 'Trạng thái mở', endpoint: '/position/admin/open/excel', file: 'TTM.xlsx' },
    { key: 'TTTT', name: 'Trạng thái tất toán', endpoint: '/position/admin/settle/excel', file: 'TTTT.xlsx' },
    { key: 'DSGD', name: 'Danh sách giao dịch', endpoint: '/transaction/admin/list/excel', file: 'DSGD.xlsx' },
  ];

  console.log(`4. Bắt đầu tải ${reports.length} báo cáo cốt lõi về: ${outputDir}`);
  for (const rep of reports) {
    const repStart = Date.now();
    const fullUrl = `${baseUrl}${rep.endpoint}`;
    console.log(`   - Đang tải "${rep.name}" từ: ${rep.endpoint}...`);

    const res = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
        authorization: `Bearer ${finalToken}`,
        origin: adminUrl,
        referer: `${adminUrl}/`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      console.error(`      Lỗi HTTP ${res.status}: ${await res.text()}`);
      continue;
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const repDuration = Date.now() - repStart;

    const savePath = path.join(outputDir, rep.file);
    fs.writeFileSync(savePath, buffer);

    console.log(`      Đã lưu: ${rep.file} (${buffer.length} bytes, ${repDuration}ms)`);

    // Thẩm định nhanh cấu trúc file Excel bằng ExcelJS
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(savePath);
      const ws = wb.worksheets[0];
      const rowCount = ws ? ws.rowCount : 0;
      const headers = [];
      if (ws && rowCount > 0) {
        ws.getRow(1).eachCell((cell) => headers.push(String(cell.value || '')));
      }
      console.log(`      -> Thẩm định: Sheet "${ws?.name}", ${rowCount} dòng, ${headers.length} cột: [${headers.slice(0, 5).join(', ')}...]`);
    } catch (e) {
      console.log(`      -> Thẩm định Excel: Không thể đọc workbook (${e.message})`);
    }
  }

  console.log('\n========================================================================');
  console.log('   KIỂM THỬ HOÀN TẤT THÀNH CÔNG!                                        ');
  console.log('========================================================================');
}

runTest().catch((err) => {
  console.error('\n Lỗi thực thi kiểm thử:', err.message);
  process.exit(1);
});
