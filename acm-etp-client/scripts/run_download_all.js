/**
 * run_download_all.js - Tải toàn bộ báo cáo ACM ETP về máy qua REST API
 * Chạy: node scripts/run_download_all.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG = {
  baseUrl: process.env.ACM_BASE_URL || 'https://acm-etp.acmmex.com',
  username: process.env.ACM_USERNAME || 'MXVRO',
  password: process.env.ACM_PASSWORD || "BT'$2=09_1Vm46$S",
  outputSessionPath: path.resolve(__dirname, '../acm_session.json'),
  outputDir: path.resolve(__dirname, '../output'),
};

const REPORTS = [
  {
    key: 'ACM_ETP_ORDERS',
    name: 'Sổ lệnh ACM ETP',
    fileName: 'ACM_ETP_ORDERS.xlsx',
    exportEndpoint: '/exchange/business/tetporder/export',
    params: {
      brokerid: '',
      investorid: '',
      direction: '',
      comboffsetflag: '',
      instrumentid: '',
      orderstatus: '',
      tradingfirmid: '',
      orderref: '',
      ordersysid: '',
    },
  },
  {
    key: 'ACM_ETP_TRADES',
    name: 'Khớp lệnh ACM ETP (Giao dịch)',
    fileName: 'ACM_ETP_TRADES.xlsx',
    exportEndpoint: '/exchange/business/tetptrade/export',
    params: {
      brokerid: '',
      investorid: '',
      direction: '',
      offsetflag: '',
      instrumentid: '',
      startTradedate: '',
      endTradedate: '',
      minPrice: '',
      maxPrice: '',
    },
  },
];

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

  setFromCookieString(cookieString) {
    if (!cookieString) return;
    const items = cookieString.split(';');
    for (const item of items) {
      const eqIdx = item.indexOf('=');
      if (eqIdx > 0) {
        const k = item.substring(0, eqIdx).trim();
        const v = item.substring(eqIdx + 1).trim();
        if (k) this.cookies.set(k, v);
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

async function getSession() {
  const jar = new CookieJar();

  // 1. Kiểm tra session cache trước
  if (fs.existsSync(CONFIG.outputSessionPath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CONFIG.outputSessionPath, 'utf8'));
      if (cached && cached.token) {
        jar.setFromCookieString(cached.cookies || '');
        jar.cookies.set('token', cached.token);

        // Verify thử
        const verifyRes = await fetch(`${CONFIG.baseUrl}/exchange/sys/menu/nav`, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'token': cached.token,
            'Cookie': jar.getCookieHeader(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        const vData = await verifyRes.json().catch(() => null);
        if (vData && vData.code === 0) {
          console.log(` Session cache hợp lệ! Sử dụng Token: [${cached.token.slice(0, 10)}...]`);
          return { token: cached.token, cookies: jar.getCookieHeader() };
        }
      }
    } catch {}
  }

  // 2. Nếu chưa có hoặc hết hạn -> Đăng nhập
  console.log('🔄 Đang khởi tạo phiên và xác thực ACM ETP...');
  const initRes = await fetch(`${CONFIG.baseUrl}/exchange/index.html`, {
    headers: { 'Upgrade-Insecure-Requests': '1' },
  });
  jar.setFromHeaders(initRes.headers);

  const uuid = crypto.randomUUID();
  const captchaUrl = `${CONFIG.baseUrl}/exchange/captcha?uuid=${uuid}`;
  const captchaRes = await fetch(captchaUrl, {
    headers: {
      'Referer': `${CONFIG.baseUrl}/exchange/index.html`,
      'Cookie': jar.getCookieHeader(),
    },
  });
  jar.setFromHeaders(captchaRes.headers);

  const captchaBuffer = Buffer.from(await captchaRes.arrayBuffer());
  const tempCaptchaPath = path.resolve(__dirname, '../temp_acm_captcha.gif');
  fs.writeFileSync(tempCaptchaPath, captchaBuffer);

  console.log(`\n------------------------------------------------------`);
  console.log(`[CAPTCHA PROMPT] Ảnh Captcha đã được tải: ${tempCaptchaPath}`);
  console.log(`👉 Hãy mở ảnh hoặc xem trực tiếp để nhập mã 5 ký tự.`);
  console.log(`------------------------------------------------------`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const captchaCode = await new Promise((res) => {
    rl.question('⌨️  Nhập mã Captcha: ', (ans) => {
      rl.close();
      res(ans.trim());
    });
  });

  const loginRes = await fetch(`${CONFIG.baseUrl}/exchange/login`, {
    method: 'POST',
    headers: {
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
  try {
    if (fs.existsSync(tempCaptchaPath)) fs.unlinkSync(tempCaptchaPath);
  } catch {}

  return sessionData;
}

(async () => {
  try {
    console.log('========================================================================');
    console.log('   🚀 BẮT ĐẦU TẢI BÁO CÁO ACM ETP QUA REST API TRỰC TIẾP                ');
    console.log(`   Host: ${CONFIG.baseUrl}`);
    console.log('========================================================================\n');

    const session = await getSession();

    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    let successCount = 0;
    for (let i = 0; i < REPORTS.length; i++) {
      const rep = REPORTS[i];
      const start = Date.now();
      process.stdout.write(`[${i + 1}/${REPORTS.length}] Đang tải [${rep.name}]... `);

      const qParams = {
        token: session.token,
        ...rep.params,
      };

      const qStr = Object.keys(qParams)
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(qParams[k])}`)
        .join('&');

      const fullUrl = `${CONFIG.baseUrl}${rep.exportEndpoint}?${qStr}`;

      try {
        const res = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': session.cookies,
            'token': session.token,
            'Referer': `${CONFIG.baseUrl}/exchange/index.html`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const targetPath = path.join(CONFIG.outputDir, rep.fileName);
          fs.writeFileSync(targetPath, buffer);
          const dur = Date.now() - start;
          console.log(` OK! ${(buffer.length / 1024).toFixed(1)} KB | ${dur}ms`);
          successCount++;
        } else {
          console.log(`❌ HTTP ${res.status}`);
        }
      } catch (err) {
        console.log(`❌ Lỗi: ${err.message}`);
      }
    }

    console.log('\n========================================================================');
    console.log(`🎉 TỔNG KẾT: Hoàn thành ${successCount}/${REPORTS.length} báo cáo ACM ETP!`);
    console.log(`📁 Thư mục lưu file: ${CONFIG.outputDir}`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
  }
})();
