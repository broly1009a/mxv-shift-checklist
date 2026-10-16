/**
 * test_login_ce.js - Script kiểm thử xác thực hệ thống Core Exchange (MXV)
 * Chạy: node scripts/test_login_ce.js
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: process.env.COREEXCHANGE_BASE_URL || 'https://coreexchange.mxv.com.vn',
  clientId: 'web-exchange-mxv',
  redirectUri: 'https://coreexchange.mxv.com.vn/validate_code',
  username: process.env.COREEXCHANGE_USERNAME || 'hieptruong',
  password: process.env.COREEXCHANGE_PASSWORD || 'Taovipko0!',
  outputSessionPath: path.resolve(__dirname, '../coreexchange_session.json'),
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

  getSessionCookie() {
    const session = this.cookies.get('SESSION');
    return session ? `SESSION=${session}` : this.getCookieHeader();
  }
}

async function loginCoreExchange() {
  const jar = new CookieJar();
  const commonHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Accept-Language': 'vi,en;q=0.9',
  };

  console.log('======================================================');
  console.log('🔐 BẮT ĐẦU QUY TRÌNH ĐĂNG NHẬP CORE EXCHANGE (MXV)');
  console.log(`   Host: [${CONFIG.baseUrl}] | User: [${CONFIG.username}]`);
  console.log('======================================================\n');

  // Kiểm tra cache session trước
  if (fs.existsSync(CONFIG.outputSessionPath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CONFIG.outputSessionPath, 'utf8'));
      if (cached && cached.sessionCookie) {
        console.log(`🔍 Tìm thấy session cache. Đang kiểm tra /dashboard...`);
        const verifyRes = await fetch(`${CONFIG.baseUrl}/dashboard`, {
          headers: { ...commonHeaders, 'Cookie': cached.sessionCookie },
          redirect: 'manual',
        });
        if (verifyRes.status === 200) {
          console.log(' Session cache vẫn còn hiệu lực 100%! Bỏ qua bước đăng nhập lại.\n');
          return cached;
        }
        console.log(' Session cache đã hết hạn. Đang tiến hành đăng nhập mới...');
      }
    } catch {}
  }

  // BƯỚC 1: Truy cập /login và bẫy _csrf token
  console.log('[1/5] Truy cập trang đăng nhập và bẫy _csrf token...');
  const loginPageRes = await fetch(`${CONFIG.baseUrl}/login`, {
    headers: {
      ...commonHeaders,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
  });

  jar.setFromHeaders(loginPageRes.headers);
  const html = await loginPageRes.text();

  const csrfMatch =
    html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/i) ||
    html.match(/value=["']([^"']+)["']\s+name=["']_csrf["']/i);

  if (!csrfMatch) {
    throw new Error('Không bẫy được _csrf token từ form HTML của Core Exchange!');
  }
  const csrf = csrfMatch[1];
  console.log(`   -> Bẫy thành công _csrf: [${csrf.substring(0, 16)}...]`);

  // BƯỚC 2: Gửi thông tin đăng nhập POST /login
  console.log('[2/5] Gửi thông tin xác thực tài khoản POST /login...');
  const bodyParams = new URLSearchParams();
  bodyParams.append('_csrf', csrf);
  bodyParams.append('username', CONFIG.username);
  bodyParams.append('password', CONFIG.password);
  bodyParams.append('page', 'login');

  const postLoginRes = await fetch(`${CONFIG.baseUrl}/login`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': jar.getCookieHeader(),
      'Origin': CONFIG.baseUrl,
      'Referer': `${CONFIG.baseUrl}/login`,
    },
    body: bodyParams.toString(),
    redirect: 'manual',
  });

  jar.setFromHeaders(postLoginRes.headers);
  const loc = postLoginRes.headers.get('location');

  if (postLoginRes.status !== 302 || !loc || loc.includes('error')) {
    throw new Error(
      `Đăng nhập Core Exchange thất bại! HTTP Status: ${postLoginRes.status}. Location: ${loc || 'none'}`
    );
  }
  console.log(`   -> Xác thực thành công (HTTP 302 Found). Điều hướng: ${loc}`);
  const sessionCookie = jar.getSessionCookie();

  // BƯỚC 3: Lấy OAuth2 Code
  console.log(`[3/5] Lấy OAuth2 Authorization Code qua client [${CONFIG.clientId}]...`);
  let oauthCode = null;
  const authUrl = `${CONFIG.baseUrl}/oauth2/authorize?client_id=${CONFIG.clientId}&response_type=code&redirect_uri=${encodeURIComponent(
    CONFIG.redirectUri
  )}&scope=openid%20profile`;

  const authRes = await fetch(authUrl, {
    headers: { ...commonHeaders, 'Cookie': jar.getCookieHeader() },
    redirect: 'manual',
  });

  jar.setFromHeaders(authRes.headers);
  const authLoc = authRes.headers.get('location');

  if (authLoc && authLoc.includes('code=')) {
    const urlObj = new URL(authLoc.startsWith('http') ? authLoc : `${CONFIG.baseUrl}${authLoc}`);
    oauthCode = urlObj.searchParams.get('code');
    console.log(`   -> Đã nhận OAuth2 Code: [${oauthCode.substring(0, 24)}...]`);
  }

  // BƯỚC 4: Verify Dashboard
  console.log('[4/5] Kiểm tra truy cập /dashboard...');
  const verifyRes = await fetch(`${CONFIG.baseUrl}/dashboard`, {
    headers: { ...commonHeaders, 'Cookie': sessionCookie },
    redirect: 'manual',
  });

  if (verifyRes.status === 200) {
    console.log('   -> Xác thực Session hợp lệ 100%! Truy cập /dashboard phản hồi HTTP 200.');
  }

  // BƯỚC 5: Lưu session
  console.log('[5/5] Lưu dữ liệu phiên...');
  const sessionData = {
    baseUrl: CONFIG.baseUrl,
    username: CONFIG.username,
    sessionCookie,
    oauthCode,
    clientId: CONFIG.clientId,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CONFIG.outputSessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
  console.log(`   -> Đã lưu session vào: ${CONFIG.outputSessionPath}`);

  console.log('\n======================================================');
  console.log('🎉 ĐĂNG NHẬP THÀNH CÔNG HỆ THỐNG CORE EXCHANGE!');
  console.log(`🍪 Session Cookie: ${sessionCookie}`);
  if (oauthCode) {
    console.log(`🔑 OAuth2 Code: ${oauthCode.substring(0, 30)}...`);
  }
  console.log('======================================================\n');

  return sessionData;
}

if (require.main === module) {
  loginCoreExchange().catch((err) => {
    console.error('\n❌ LỖI:', err.message);
    process.exit(1);
  });
}

module.exports = { loginCoreExchange };
