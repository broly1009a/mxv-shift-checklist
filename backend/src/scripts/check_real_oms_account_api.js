/**
 * Script kiểm chứng trực tiếp phản hồi API OMS_ACCOUNT từ CoreCCP
 * Chạy lệnh: node backend/src/scripts/check_real_oms_account_api.js
 */
const path = require('path');
const fs = require('fs');

const envCandidates = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env'),
  path.join(process.cwd(), 'backend', '.env'),
  path.join(process.cwd(), '.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}
const mongoose = require('mongoose');
const crypto = require('crypto');

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  setFromHeaders(headers) {
    if (!headers) return;
    const setCookieHeaders = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : (headers['set-cookie'] || []);
    const rawCookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    rawCookies.forEach(str => {
      if (!str) return;
      const parts = str.split(';');
      const nameVal = parts[0];
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx !== -1) this.cookies.set(nameVal.substring(0, eqIdx).trim(), nameVal.substring(eqIdx + 1).trim());
    });
  }
  getCookieHeader() {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  getSessionCookie() {
    return this.cookies.get('SESSION') ? `SESSION=${this.cookies.get('SESSION')}` : this.getCookieHeader();
  }
}

function decrypt(encryptedText, secretKeyStr) {
  const parts = encryptedText.split(':');
  const secretKey = crypto.createHash('sha256').update(secretKeyStr).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, Buffer.from(parts[0], 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(parts[1], 'hex')), decipher.final()]).toString('utf8');
}

async function run() {
  console.log('=== KIỂM CHỨNG TRỰC TIẾP API OMS_ACCOUNT CORECCP ===\n');

  // 1. Kết nối MongoDB nạp credentials
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv_shift_checklist';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;

  const credDoc = await db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
  const urlDoc = await db.collection('system_settings').findOne({ key: 'coreccp_base_url' });

  if (!credDoc || !credDoc.value) {
    console.error('❌ Không tìm thấy bot_credentials_ccp trong system_settings!');
    process.exit(1);
  }

  const encKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const decrypted = JSON.parse(decrypt(credDoc.value, encKey));
  const rawBaseUrl = (urlDoc?.value || decrypted.url || 'https://coreccp.vnclear.vn').replace(/\/+$/, '');
  const baseUrl = new URL(rawBaseUrl).origin;
  const username = decrypted.username;
  const password = decrypted.password;

  console.log(`1. Thông tin kết nối CoreCCP:`);
  console.log(`   - Base URL : ${baseUrl}`);
  console.log(`   - Username : ${username}`);

  // 2. OAuth2 Login
  const jar = new CookieJar();
  const authUrl = `${baseUrl}/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=${encodeURIComponent(baseUrl + '/validate_code')}&scope=openid%20profile`;
  const initRes = await fetch(authUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
  jar.setFromHeaders(initRes.headers);

  let loc = initRes.headers.get('location');
  const loginPageRes = await fetch(loc.startsWith('http') ? loc : `${baseUrl}${loc}`, { headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
  jar.setFromHeaders(loginPageRes.headers);
  const html = await loginPageRes.text();
  const csrfMatch = html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/i);
  const csrf = csrfMatch ? csrfMatch[1] : '';

  const loginBody = new URLSearchParams({ _csrf: csrf, username, password, page: 'login_ccp' });
  const postLogin = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.getCookieHeader() },
    body: loginBody.toString(),
    redirect: 'manual',
  });
  jar.setFromHeaders(postLogin.headers);

  let nextUrl = postLogin.headers.get('location');
  let authCode = null;
  while (nextUrl) {
    const u = new URL(nextUrl.startsWith('http') ? nextUrl : `${baseUrl}${nextUrl}`);
    if (u.searchParams.has('code')) {
      authCode = u.searchParams.get('code');
      break;
    }
    const hop = await fetch(u.toString(), { headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
    jar.setFromHeaders(hop.headers);
    nextUrl = hop.headers.get('location');
  }

  const CCP_UAT_BASIC_AUTH = 'Basic d2ViLWNjcC1teHY6VWtXVDU2eHZCa1pPcmt6M21UWTZ0empmdWhuMkdU';
  const CCP_PROD_BASIC_AUTH = 'Basic d2ViLWNjcC1teHY6d1NBbmNpNkpzN3AxWTd2eVdiZjVZajBVc3J5Yjdy';
  const basicAuth = (baseUrl.toLowerCase().includes('vnclear.vn')) ? CCP_PROD_BASIC_AUTH : CCP_UAT_BASIC_AUTH;

  const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuth,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.getCookieHeader(),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: `${baseUrl}/validate_code`,
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const sessionCookie = jar.getSessionCookie();

  console.log(`   -> Đăng nhập OAuth2 CoreCCP thành công!\n`);

  // 3. GỌI API OMS_ACCOUNT VỚI pageSize: 9999
  console.log(`2. Gửi request POST /ccp/inquiry/OMS_ACM với payload: { searchcode: 'OMS_ACCOUNT', page: 1, pageSize: 200000 }...`);
  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/ccp/inquiry/OMS_ACM`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      connectkey: 'fsscssiam2021',
      Cookie: sessionCookie,
      Authorization: `Bearer ${accessToken}`,
      Origin: baseUrl,
      Referer: `${baseUrl}/MONITOR_OMS/MONITOR_OMS_ACM`,
    },
    body: JSON.stringify({
      searchcode: 'OMS_ACCOUNT',
      search: {},
      page: 1,
      pageSize: 200000,
    }),
  });

  const duration = Date.now() - t0;
  console.log(`   -> HTTP Status: ${res.status} (${duration}ms)`);

  const resJson = await res.json();

  // 4. BÓC TÁCH CHI TIẾT
  console.log('\n3. KẾT QUẢ TRẢ VỀ TỪ CORECCP:');
  console.log('   - resJson.code      :', resJson.code);
  console.log('   - resJson.success   :', resJson.success);
  console.log('   - resJson.payload.page : ', JSON.stringify(resJson.payload?.page || resJson.page));
  console.log('   - resJson.payload.typeObject:', resJson.payload?.typeObject);

  const rawData = resJson.payload?.data || resJson.data || [];
  console.log(`   - resJson.payload.data (Kiểu dữ liệu: ${Array.isArray(rawData) ? 'ARRAY' : typeof rawData})`);
  console.log(`   - ĐỘ DÀI MẢNG data.length : ${Array.isArray(rawData) ? rawData.length : 'N/A'}`);

  if (Array.isArray(rawData) && rawData.length > 0) {
    let countActiveMargin = 0;
    let countZeroMargin = 0;
    for (const a of rawData) {
      const rma = parseFloat(a.rma) || 0;
      const rmo = parseFloat(a.rmo) || 0;
      const imCash = parseFloat(a.imCash) || 0;
      if (rma > 0 || rmo > 0 || imCash > 0) {
        countActiveMargin++;
      } else {
        countZeroMargin++;
      }
    }

    console.log(`\n4. PHÂN TÍCH NỘI DUNG MẢNG DATA (${rawData.length} TÀI KHOẢN):`);
    console.log(`   - Số TK có ký quỹ/tiền phát sinh (RMA > 0 hoặc RMO > 0 hoặc IM_CASH > 0) : ${countActiveMargin}`);
    console.log(`   - Số TK rỗng hoàn toàn (RMA = 0, RMO = 0, IM_CASH = 0)                   : ${countZeroMargin}`);
    console.log('\n   - Mẫu 3 tài khoản đầu tiên:');
    rawData.slice(0, 3).forEach((a, idx) => {
      console.log(`     ${idx + 1}. TK: ${a.accountId || a.dmaAccount} | TVKD: ${a.memberCode} | RMA: ${a.rma} | RMO: ${a.rmo} | Tiền KQ: ${a.imCash}`);
    });
  }

  await mongoose.disconnect();
  console.log('\n=== HOÀN TẤT KIỂM CHỨNG ===');
}

run().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
