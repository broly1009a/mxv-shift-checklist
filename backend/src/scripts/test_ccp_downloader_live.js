/**
 * TEST SCRIPT: TẢI BÁO CÁO TRỰC TIẾP TỪ CORECCP (PLAYWRIGHT LIVE TEST)
 * Sử dụng trực tiếp service NestJS CcpCeDownloaderService đã port.
 *
 * Cách chạy:
 *   # 1. Chạy có giao diện trình duyệt (Khuyên dùng để quan sát thao tác Bot):
 *   node backend/src/scripts/test_ccp_downloader_live.js --headed
 *
 *   # 2. Chạy ngầm (headless):
 *   node backend/src/scripts/test_ccp_downloader_live.js
 *
 *   # 3. Tùy chọn truyền tài khoản trực tiếp qua cờ dòng lệnh (nếu DB chưa cấu hình):
 *   node backend/src/scripts/test_ccp_downloader_live.js --headed --url "https://uat-coreccp.mxv.com.vn/login" --user "hieptruong" --pass "Taovipko0!" --report "NR"
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Helper giải mã config AES-256 từ DB
const crypto = require('crypto');
function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf-8');
  const iv = Buffer.from(process.env.ENCRYPTION_IV || '1234567890123456', 'utf-8');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(ciphertext, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

// Đọc tham số dòng lệnh
const args = process.argv.slice(2);
const isHeaded = args.includes('--headed');
const reportArg = args.find((a, i) => args[i - 1] === '--report') || 'NR';

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

async function getCredentialsFromDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv-shift-checklist';
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    const SystemSetting = mongoose.model(
      'SystemSetting',
      new mongoose.Schema({ key: String, value: String }, { collection: 'system_settings' })
    );
    const setting = await SystemSetting.findOne({ key: 'bot_credentials_ccp' });
    if (setting && setting.value) {
      const dec = JSON.parse(decrypt(setting.value));
      return dec;
    }
  } catch (err) {
    // Không kết nối được MongoDB hoặc chưa có collection
  } finally {
    try { await mongoose.disconnect(); } catch (e) {}
  }
  return null;
}

async function main() {
  console.log('\n========================================================================');
  console.log('   KIỂM THỬ THỰC TẾ: TẢI BÁO CÁO TỪ CORECCP (PLAYWRIGHT ROBOT)');
  console.log('========================================================================\n');

  // 1. Xác định thông tin đăng nhập
  console.log('[1/4] Đang lấy cấu hình CoreCCP...');
  const dbCreds = await getCredentialsFromDB();

  const systemUrl = getArgValue('--url') || dbCreds?.url || 'https://uat-coreccp.mxv.com.vn/login';
  const username = getArgValue('--user') || dbCreds?.username || 'hieptruong';
  const password = getArgValue('--pass') || dbCreds?.password || 'Taovipko0!';
  const outputDir = path.resolve(__dirname, '../../test_output_ccp');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`  • URL:        ${systemUrl}`);
  console.log(`  • Username:   ${username}`);
  console.log(`  • Password:   ${password ? '********' : '(Trống)'}`);
  console.log(`  • Chế độ:     ${isHeaded ? 'Có giao diện (--headed)' : 'Chạy ngầm (headless)'}`);
  console.log(`  • Thư mục lưu: ${outputDir}`);
  console.log(`  • Mã báo cáo: ${reportArg}\n`);

  // 2. Nạp Service từ bản build dist
  console.log('[2/4] Khởi tạo CcpCeDownloaderService...');
  const {
    CcpCeDownloaderService,
    DEFAULT_CCP_REPORTS
  } = require('../../dist/modules/bot-engine/ccp-ce-downloader.service');

  const downloader = new CcpCeDownloaderService();

  // Chọn báo cáo kiểm thử
  const targetReport = DEFAULT_CCP_REPORTS.find((r) => r.code === reportArg) || {
    code: 'NR',
    name: 'Lịch sử nộp rút tiền',
    parentMenu: 'Nộp rút tiền',
    childMenu: 'Lịch sử Nộp/ Rút tiền',
    systemType: 'CORE_CCP',
    enabled: true,
  };

  console.log(`  ✓ Đã chọn cấu hình báo cáo: [${targetReport.code}] ${targetReport.name}`);
  console.log(`    Menu: "${targetReport.parentMenu}" -> "${targetReport.childMenu}"\n`);

  // 3. Thiết lập khoảng ngày tải thử (3 ngày gần nhất)
  console.log('[3/4] Chuẩn bị khoảng thời gian tải...');
  const now = new Date();
  const past3Days = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const formatDdMmYyyy = (d) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const startDateStr = formatDdMmYyyy(past3Days);
  const endDateStr = formatDdMmYyyy(now);

  console.log(`  • Khoảng ngày: ${startDateStr} → ${endDateStr}\n`);

  // 4. Kích hoạt Bot chạy
  console.log('[4/4] Bắt đầu kích hoạt Chromium Bot...');
  console.log('------------------------------------------------------------------------');

  const startTime = Date.now();
  try {
    await downloader.run({
      systemUrl,
      username,
      password,
      startDate: startDateStr,
      endDate: endDateStr,
      outputDir,
      reports: [targetReport],
      options: {
        headless: !isHeaded,
        overwriteExisting: true,
        downloadTimeoutMs: 60000,
        autoSplitOnTimeout: true,
      },
      logCallback: (msg) => {
        console.log(`[BOT LOG] ${msg}`);
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('------------------------------------------------------------------------');
    console.log(`\n🎉 HOÀN THÀNH TẢI BÁO CÁO TRONG ${duration} GIÂY!`);

    // Kiểm tra file kết quả
    const files = fs.readdirSync(outputDir);
    console.log(`\nCác file có trong thư mục kết quả (${outputDir}):`);
    if (files.length === 0) {
      console.log('  (Chưa có file nào - kiểm tra xem khoảng ngày có phát sinh dữ liệu không)');
    } else {
      files.forEach((f) => {
        const full = path.join(outputDir, f);
        const stats = fs.statSync(full);
        console.log(`  ✓ ${f} (${(stats.size / 1024).toFixed(1)} KB)`);
      });
    }
    console.log('\n========================================================================\n');
  } catch (err) {
    console.error('\n❌ GẶP SỰ CỐ KHI TẢI BÁO CÁO:', err.message);
    console.log('\nKhắc phục sự cố:');
    console.log('1. Đảm bảo tài khoản đăng nhập đúng mật khẩu và có quyền truy cập CoreCCP.');
    console.log('2. Nếu trang web UAT đổi URL, hãy truyền: --url "<URL_MỚI>"');
    console.log('3. Chạy với cờ --headed để xem trực tiếp trình duyệt bị vướng ở bước nào.');
  }
}

main().catch(console.error);
