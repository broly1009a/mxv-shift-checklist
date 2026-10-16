/**
 * test_quick_api.js - Kiểm thử nhanh Node.js không cần build
 * Chạy: node scripts/test_quick_api.js
 */

const path = require('path');
const fs = require('fs');

const CONFIG = {
  baseUrl: process.env.MS_BASE_URL || 'https://api-dev.newgen.dev',
  adminUrl: process.env.MS_ADMIN_URL || 'https://admin-dev.msystem.newgen.dev',
  username: process.env.MS_USERNAME || 'mxvhieptruong',
  password: process.env.MS_PASSWORD || 'Taovipko0!',
  pin: process.env.MS_PIN || '269696',
};

const TEST_REPORTS = [
  {
    key: 'DSTKGD-Futures',
    name: 'Danh sách TKGD Futures',
    endpoint: '/am/admin/investors/excel?subInvestorType%5Beq%5D%3DNULL',
    expectedFileName: 'DSTKGD_Futures.xlsx',
  },
  {
    key: 'DSTKGD-Spread',
    name: 'Danh sách TKGD Spread',
    endpoint: '/am/admin/investors/excel?subInvestorType%5Beq%5D%3DS',
    expectedFileName: 'DSTKGD_Spread.xlsx',
  },
  {
    key: 'NKTTHT',
    name: 'Nhật ký thao tác hệ thống',
    endpoint: '/approval/admin/activities/excel?sort_by%3Ddesc(datetime)',
    expectedFileName: 'NKTTHT.xlsx',
  },
];

async function login() {
  console.log(`🔐 [1/2] Đang xác thực M-System Newgen API: ${CONFIG.baseUrl}...`);
  const commonHeaders = {
    'accept': 'application/json',
    'origin': CONFIG.adminUrl,
    'referer': `${CONFIG.adminUrl}/`,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  // Bước 1: Login password
  const step1 = await fetch(`${CONFIG.baseUrl}/am/admin/users/login`, {
    method: 'POST',
    headers: { ...commonHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ username: CONFIG.username, password: CONFIG.password }),
  });
  const data1 = await step1.json().catch(() => null);
  if (!step1.ok || data1?.status !== 'ok') {
    throw new Error(`Bước 1 thất bại: ${data1?.message || step1.status}`);
  }

  const userId = data1.data.user.id || data1.data.user._id;
  const tempToken = data1.data.user.accessToken;

  // Bước 2: Verify PIN
  const step2 = await fetch(`${CONFIG.baseUrl}/am/admin/users/verifyPin/${userId}`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'content-type': 'application/json',
      'authorization': `Bearer ${tempToken}`,
    },
    body: JSON.stringify({ pin: String(CONFIG.pin) }),
  });
  const data2 = await step2.json().catch(() => null);
  if (!step2.ok || data2?.status !== 'ok') {
    throw new Error(`Bước 2 (PIN) thất bại: ${data2?.message || step2.status}`);
  }

  const token = data2.data.user.accessToken;
  console.log(` Xác thực thành công! Bearer Token: ${token.slice(0, 35)}...`);
  return token;
}

async function downloadReport(token, rep, outDir) {
  const fullUrl = `${CONFIG.baseUrl}${rep.endpoint}`;
  const startTime = Date.now();

  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'authorization': `Bearer ${token}`,
      'origin': CONFIG.adminUrl,
      'referer': `${CONFIG.adminUrl}/`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  const durationMs = Date.now() - startTime;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(outDir, rep.expectedFileName);
  fs.writeFileSync(filePath, buffer);

  return {
    filePath,
    sizeBytes: buffer.length,
    durationMs,
  };
}

(async () => {
  console.log('========================================================================');
  console.log('   🚀 KIỂM THỬ NHANH TẢI BÁO CÁO M-SYSTEM QUA REST API TRỰC TIẾP      ');
  console.log('========================================================================\n');

  try {
    const token = await login();
    const outDir = path.resolve(__dirname, '../output');
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`\n📥 [2/2] Bắt đầu tải ${TEST_REPORTS.length} báo cáo mẫu qua REST API:`);
    console.log(`   Thư mục lưu: ${outDir}\n`);

    for (const rep of TEST_REPORTS) {
      process.stdout.write(`   ⏳ Đang tải [${rep.name}]... `);
      try {
        const info = await downloadReport(token, rep, outDir);
        console.log(` OK! ${(info.sizeBytes / 1024).toFixed(1)} KB | ${info.durationMs}ms`);
      } catch (err) {
        console.log(`❌ Lỗi: ${err.message}`);
      }
    }

    console.log('\n🎉 HOÀN TẤT THỬ NGHIỆM! File đã tải thành công tại thư mục output/.');
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
  }
})();
