/**
 * test_login_acm.js - Script kiểm thử xác thực ACM ETP & Kiểm tra Token
 * Chạy: node scripts/test_login_acm.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG = {
  baseUrl: process.env.ACM_BASE_URL || 'https://acm-etp.acmmex.com',
  username: process.env.ACM_USERNAME || 'MXVRO',
  password: process.env.ACM_PASSWORD || "BT'$2=09_1Vm46$S",
  outputSessionPath: path.resolve(__dirname, '../acm_session.json'),
  captchaImagePath: path.resolve(__dirname, '../temp_acm_captcha.gif'),
};

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setFromHeaders(headers) {
    let raw = [];
    if (typeof headers.getSetCookie === 'function') {
      raw = headers.getSetCookie();
    } else if (headers.raw && typeof headers.raw === 'function') {
      raw = headers.raw()['set-cookie'] || [];
    } else if (typeof headers.get === 'function') {
      const single = headers.get('set-cookie');
      if (single) raw = [single];
    }

    raw.forEach((str) => {
      const parts = str.split(';');
      const [nameVal] = parts;
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx > 0) {
        const k = nameVal.substring(0, eqIdx).trim();
        const v = nameVal.substring(eqIdx + 1).trim();
        this.cookies.set(k, v);
      }
    });
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

async function solveCaptcha(imagePath) {
  console.log('\n------------------------------------------------------');
  console.log('[ACM CAPTCHA] Ảnh Captcha đã được tải về tại:');
  console.log(`📂 ${imagePath}`);
  console.log('👉 Hãy mở ảnh hoặc xem trực tiếp để nhập mã 5 ký tự.');
  console.log('------------------------------------------------------');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('⌨️  Nhập mã Captcha hiển thị trên ảnh: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('======================================================');
  console.log('🔐 BẮT ĐẦU KIỂM THỬ XÁC THỰC HỆ THỐNG ACM ETP');
  console.log(`   Host: [${CONFIG.baseUrl}] | User: [${CONFIG.username}]`);
  console.log('======================================================\n');

  // Kiểm tra cache session trước
  if (fs.existsSync(CONFIG.outputSessionPath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CONFIG.outputSessionPath, 'utf8'));
      if (cached && cached.token) {
        console.log(`🔍 Tìm thấy session cache (Token: ${cached.token.slice(0, 8)}...). Đang kiểm tra hiệu lực...`);
        const navRes = await fetch(`${CONFIG.baseUrl}/exchange/sys/menu/nav`, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'token': cached.token,
            'Cookie': cached.cookies || '',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        const navData = await navRes.json().catch(() => null);
        if (navData && navData.code === 0) {
          console.log('✅ Session cache vẫn còn hiệu lực 100%! Bỏ qua bước giải captcha.\n');
          return cached;
        }
        console.log('⚠️ Session cache đã hết hạn. Đang tiến hành đăng nhập mới...');
      }
    } catch {}
  }

  const jar = new CookieJar();
  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  console.log('[1/5] Khởi tạo phiên & hứng Cookie Sticky từ AWS ALB...');
  const initRes = await fetch(`${CONFIG.baseUrl}/exchange/index.html`, {
    headers: { ...commonHeaders, 'Upgrade-Insecure-Requests': '1' },
  });
  if (!initRes.ok) throw new Error(`HTTP ${initRes.status} khi truy cập /exchange/index.html`);
  jar.setFromHeaders(initRes.headers);
  console.log('   -> Khởi tạo phiên thành công!');

  console.log('[2/5] Tự sinh Client UUID (UUID v4)...');
  const uuid = crypto.randomUUID();
  console.log(`   -> Generated UUID: ${uuid}`);

  console.log('[3/5] Tải ảnh Captcha từ Backend...');
  const captchaUrl = `${CONFIG.baseUrl}/exchange/captcha?uuid=${uuid}`;
  const captchaRes = await fetch(captchaUrl, {
    headers: {
      ...commonHeaders,
      'Referer': `${CONFIG.baseUrl}/exchange/index.html`,
      'Cookie': jar.getCookieHeader(),
    },
  });
  if (!captchaRes.ok) throw new Error(`HTTP ${captchaRes.status} khi tải ảnh captcha`);
  jar.setFromHeaders(captchaRes.headers);

  const captchaBuffer = Buffer.from(await captchaRes.arrayBuffer());
  fs.writeFileSync(CONFIG.captchaImagePath, captchaBuffer);
  console.log(`   -> Đã tải ảnh captcha (${captchaBuffer.length} bytes)`);

  console.log('[4/5] Giải mã Captcha...');
  const captchaCode = await solveCaptcha(CONFIG.captchaImagePath);
  if (!captchaCode) throw new Error('Mã Captcha không được để trống!');

  console.log('[5/5] Gửi payload đăng nhập POST /exchange/login...');
  const loginRes = await fetch(`${CONFIG.baseUrl}/exchange/login`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/json;charset=UTF-8',
      'Accept': 'application/json, text/plain, */*',
      'Origin': CONFIG.baseUrl,
      'Referer': `${CONFIG.baseUrl}/exchange/index.html`,
      'Cookie': jar.getCookieHeader(),
    },
    body: JSON.stringify({
      username: CONFIG.username,
      password: CONFIG.password,
      uuid,
      captcha: captchaCode,
    }),
  });

  jar.setFromHeaders(loginRes.headers);
  const loginResult = await loginRes.json();
  if (loginResult.code !== 0) {
    throw new Error(`Đăng nhập thất bại (Code ${loginResult.code}): ${loginResult.msg}`);
  }

  const token = loginResult.data && loginResult.data.token;
  jar.cookies.set('token', token);
  jar.cookies.set('language', 'en');

  const sessionData = {
    username: CONFIG.username,
    token,
    cookies: jar.getCookieHeader(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CONFIG.outputSessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
  console.log('\n======================================================');
  console.log('🎉 ĐĂNG NHẬP THÀNH CÔNG HỆ THỐNG ACM ETP!');
  console.log(`🔑 Token: ${token}`);
  console.log(`💾 Đã lưu session vào: ${CONFIG.outputSessionPath}`);
  console.log('======================================================\n');

  try {
    if (fs.existsSync(CONFIG.captchaImagePath)) fs.unlinkSync(CONFIG.captchaImagePath);
  } catch {}

  return sessionData;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\n❌ LỖI:', err.message);
    process.exit(1);
  });
}
