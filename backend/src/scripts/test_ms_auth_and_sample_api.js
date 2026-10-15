/**
 * test_ms_auth_and_sample_api.js
 * Kiểm tra xác thực API M-System và test tải file mẫu qua REST API
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: process.env.MS_BASE_URL || 'https://api-dev.newgen.dev',
  adminUrl: process.env.MS_ADMIN_URL || 'https://admin-dev.msystem.newgen.dev',
  username: process.env.MS_USERNAME || 'mxvhieptruong',
  password: process.env.MS_PASSWORD || 'Taovipko0!',
  pin: process.env.MS_PIN || '269696',
};

async function loginMS() {
  console.log(`🔐 Đang đăng nhập M-System API: ${CONFIG.baseUrl}...`);
  console.log(`   User: ${CONFIG.username}`);

  const commonHeaders = {
    'accept': 'application/json',
    'accept-language': 'en-US,en;q=0.9',
    'origin': CONFIG.adminUrl,
    'referer': `${CONFIG.adminUrl}/`,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  // Bước 1: Login password
  const loginRes = await fetch(`${CONFIG.baseUrl}/am/admin/users/login`, {
    method: 'POST',
    headers: { ...commonHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ username: CONFIG.username, password: CONFIG.password }),
  });

  const loginData = await loginRes.json().catch(() => null);
  if (!loginRes.ok || loginData?.status !== 'ok' || !loginData?.data?.user) {
    throw new Error(`Bước 1 thất bại: ${loginData?.errMsg || loginData?.message || loginRes.status}`);
  }

  const userId = loginData.data.user.id || loginData.data.user._id;
  const tempToken = loginData.data.user.accessToken;

  // Bước 2: Verify PIN
  const pinRes = await fetch(`${CONFIG.baseUrl}/am/admin/users/verifyPin/${userId}`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'content-type': 'application/json',
      'authorization': `Bearer ${tempToken}`,
    },
    body: JSON.stringify({ pin: String(CONFIG.pin) }),
  });

  const pinData = await pinRes.json().catch(() => null);
  if (!pinRes.ok || pinData?.status !== 'ok' || !pinData?.data?.user) {
    throw new Error(`Bước 2 (PIN) thất bại: ${pinData?.errMsg || pinData?.message || pinRes.status}`);
  }

  const token = pinData.data.user.accessToken;
  console.log(`✅ Đăng nhập M-System thành công! Bearer Token: ${token.slice(0, 30)}...`);
  return token;
}

async function testDownloadSample(token) {
  console.log('\n📥 Đang test tải file DSTKGD-Futures qua API cURL của USER...');
  const url = `${CONFIG.baseUrl}/am/admin/investors/excel?subInvestorType%5Beq%5D=NULL`;
  
  const startTime = Date.now();
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'authorization': `Bearer ${token}`,
      'origin': CONFIG.adminUrl,
      'referer': `${CONFIG.adminUrl}/`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const duration = Date.now() - startTime;
  console.log(`   Response Status: ${res.status} ${res.statusText}`);
  console.log(`   Content-Type:    ${res.headers.get('content-type')}`);
  console.log(`   Content-Disposition: ${res.headers.get('content-disposition')}`);

  if (res.ok) {
    const buffer = Buffer.from(await res.arrayBuffer());
    console.log(`✅ Tải thành công file nhị phân! Dung lượng: ${(buffer.length / 1024).toFixed(1)} KB (Thời gian: ${duration}ms)`);
    const outPath = path.resolve(__dirname, 'output', 'DSTKGD_Futures_API_test.xlsx');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buffer);
    console.log(`💾 Đã lưu file kiểm chứng tại: ${outPath}`);
    return true;
  } else {
    const text = await res.text();
    console.error(`❌ Lỗi tải file:`, text.slice(0, 300));
    return false;
  }
}

(async () => {
  try {
    const token = await loginMS();
    await testDownloadSample(token);
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
  }
})();
