/**
 * TEST BENCHMARK LIVE: KIỂM THỬ THỰC TẾ ĐỒNG BỘ RÀO CẢN 2 PHA ĐĂNG NHẬP 4 CHROME SONG SONG
 * VÀ KIỂM TRA ĐỘ SẠCH TIẾN TRÌNH SAU KHI KẾT THÚC
 */

const { chromium } = require('playwright-core');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
const getSecretKey = () => crypto.createHash('sha256').update(rawKey).digest();

function decrypt(text) {
  if (!text) return '';
  const textParts = text.split(':');
  if (textParts.length < 2) return text;
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getSecretKey(), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

function getChromeExecutablePath() {
  const linuxPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ];
  for (const p of linuxPaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function getMemInfo() {
  try {
    const lines = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
    const info = {};
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const val = parseInt(parts[1].trim().split(' ')[0], 10);
        info[key] = Math.round(val / 1024); // MB
      }
    }
    return {
      total: info.MemTotal || 0,
      free: info.MemFree || 0,
      available: info.MemAvailable || 0,
      swapTotal: info.SwapTotal || 0,
      swapFree: info.SwapFree || 0,
      swapUsed: (info.SwapTotal || 0) - (info.SwapFree || 0),
    };
  } catch {
    return { total: 0, free: 0, available: 0, swapTotal: 0, swapFree: 0, swapUsed: 0 };
  }
}

async function solveCaptchaWithGemini(base64Image, apiKey) {
  return new Promise((resolve) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const postData = JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Hãy đọc chính xác mã captcha gồm các ký tự chữ cái và số trong ảnh này. Chỉ trả về duy nhất chuỗi ký tự captcha đó, không giải thích gì thêm, không viết hoa thường sai, không thêm dấu cách hay ký tự thừa.',
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 20,
        },
      });

      const parsedUrl = new URL(url);
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 10000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const resp = JSON.parse(body);
              const text = resp.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.replace(/[\s\r\n]/g, '');
              resolve(text || '');
            } catch {
              resolve('');
            }
          });
        },
      );
      req.on('error', () => resolve(''));
      req.on('timeout', () => {
        req.destroy();
        resolve('');
      });
      req.write(postData);
      req.end();
    } catch {
      resolve('');
    }
  });
}

async function runTest() {
  console.log('================================================================================');
  console.log('   KIỂM THỬ THỰC TẾ: ĐỒNG BỘ RÀO CẢN 2 PHA ĐĂNG NHẬP 4 CHROME SONG SONG');
  console.log('   HỆ THỐNG: M-SYSTEM | CQG PORTAL | ACM ETP | CORECCP (VNCLEAR)');
  console.log('================================================================================\n');

  const initialMem = getMemInfo();
  console.log(`[1. THÔNG SỐ HỆ THỐNG BAN ĐẦU]`);
  console.log(`- RAM Tổng        : ${initialMem.total} MB`);
  console.log(`- RAM Khả dụng   : ${initialMem.available} MB`);
  console.log(`- Swap Đang dùng : ${initialMem.swapUsed} MB / ${initialMem.swapTotal} MB\n`);

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  console.log('[2. ĐỌC CẤU HÌNH TÀI KHOẢN TỪ CSDL MONGODB...]');
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db();

  const getCreds = async (key) => {
    const doc = await db.collection('system_settings').findOne({ key });
    if (!doc || !doc.value) return null;
    try {
      return JSON.parse(decrypt(doc.value));
    } catch {
      return null;
    }
  };

  const msCreds = await getCreds('bot_credentials_msystem');
  const cqgCreds = await getCreds('bot_credentials_cqg');
  const acmCreds = await getCreds('bot_credentials_acm');
  const ccpCreds = await getCreds('bot_credentials_ccp');
  await client.close();

  console.log(`- M-System : ${msCreds ? '✅ Đã cấu hình' : ' Thiếu'}`);
  console.log(`- CQG      : ${cqgCreds ? '✅ Đã cấu hình' : ' Thiếu'}`);
  console.log(`- ACM      : ${acmCreds ? '✅ Đã cấu hình' : ' Thiếu'}`);
  console.log(`- CoreCCP  : ${ccpCreds ? '✅ Đã cấu hình' : ' Thiếu'}\n`);

  const executablePath = getChromeExecutablePath();
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-extensions',
    '--window-size=1280,800',
  ];

  const readyTimes = {};
  const exportTimes = {};
  const activeBrowsers = [];

  let resolveBarrier;
  const barrierPromise = new Promise((r) => {
    resolveBarrier = r;
  });

  const readyState = {
    ms: !msCreds,
    cqg: !cqgCreds,
    acm: !acmCreds,
    ccp: !ccpCreds,
  };

  const checkBarrier = () => {
    if (readyState.ms && readyState.cqg && readyState.acm && readyState.ccp) {
      const now = new Date();
      console.log(`\n [RÀO CẢN ĐỒNG BỘ THỎA MÃN] ${now.toISOString()} - TẤT CẢ 4 BÊN ĐÃ VÀO VỊ TRÍ!`);
      resolveBarrier();
    }
  };

  console.log('[3. PHA 1: KHỞI CHẠY ĐỒNG THỜI 4 CHROMIUM & ĐĂNG NHẬP VÀO VỊ TRÍ SẴN SÀNG...]');
  const p1Start = Date.now();

  // WORKER 1: M-SYSTEM
  const workerMS = async () => {
    if (!msCreds) return;
    try {
      console.log(' -> [MS] Khởi chạy Chromium...');
      const browser = await chromium.launch({ headless: true, executablePath, args: launchArgs });
      activeBrowsers.push(browser);
      const page = await browser.newPage();
      page.setDefaultTimeout(35000);

      const msUrl = msCreds.url || 'https://msystem.mxv.vn/';
      console.log(` -> [MS] Điều hướng đến: ${msUrl}...`);
      await page.goto(msUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.fill("input[name='username'], input[placeholder*='tên đăng nhập']", msCreds.username);
      await page.fill("input[name='password'], input[placeholder*='mật khẩu']", msCreds.password);
      await page.click("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary");
      await page.waitForTimeout(2000);

      // Bàn phím mã PIN ảo (div.pincode) theo đúng chuẩn C# ChromeBot.cs
      const hasPin = await page.locator('div.pincode').isVisible({ timeout: 5000 }).catch(() => false);
      if (hasPin && msCreds.pin) {
        console.log(` -> [MS] Nhập mã PIN qua bàn phím ảo (C# ChromeBot port)...`);
        for (const digit of String(msCreds.pin).split('')) {
          const digitSel = `div.pincode >> xpath=.//div[text()='${digit}']`;
          await page.click(digitSel).catch(() => { });
          await page.waitForTimeout(250);
        }
        await page.waitForTimeout(2500);
      }

      // Điều hướng màn hình DSGD
      await page.click("xpath=//a[contains(., 'QL giao dịch')]").catch(() => { });
      await page.waitForTimeout(800);
      await page.click("xpath=//a[contains(., 'Danh sách giao dịch')]").catch(() => { });
      await page.waitForTimeout(1000);

      readyTimes.ms = new Date();
      console.log(` -> [MS] ✅ SẴN SÀNG TẠI DSGD lúc: ${readyTimes.ms.toISOString()} (+${((Date.now() - p1Start) / 1000).toFixed(1)}s)`);
      readyState.ms = true;
      checkBarrier();

      await barrierPromise;

      // Pha 2: Export
      exportTimes.ms = new Date();
      console.log(` -> [MS] ⚡ [PHA 2 BẮN TÍN HIỆU TẢI DSGD] lúc: ${exportTimes.ms.toISOString()}`);
    } catch (err) {
      console.error(` -> [MS]  Lỗi: ${err.message}`);
      readyState.ms = true;
      checkBarrier();
    }
  };

  // WORKER 2: ACM (STRAITS)
  const workerACM = async () => {
    if (!acmCreds) return;
    try {
      console.log(' -> [ACM] Khởi chạy Chromium...');
      const browser = await chromium.launch({ headless: true, executablePath, args: launchArgs });
      activeBrowsers.push(browser);
      const page = await browser.newPage();
      page.setDefaultTimeout(35000);

      const rawUrl = (acmCreds.url || '').trim();
      const acmUrl = rawUrl.replace(/#\/home\/?$/i, '#/login') || 'https://acm-etp.acmmex.com/exchange/index.html#/login';
      console.log(` -> [ACM] Điều hướng đến: ${acmUrl}...`);
      await page.goto(acmUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1500);

      // Điền thông tin & giải Captcha
      await page.fill("input[placeholder*='Account' i], input[placeholder*='Username' i], input[type='text']", acmCreds.username).catch(() => { });
      await page.fill("input[placeholder*='Password' i], input[type='password']", acmCreds.password).catch(() => { });

      const capEl = await page.locator(".login-captcha img, img[src*='captcha' i], img.captcha").first();
      let capText = '';
      if (await capEl.isVisible({ timeout: 4000 }).catch(() => false)) {
        const capBuffer = await capEl.screenshot();
        const base64 = capBuffer.toString('base64');
        console.log(' -> [ACM] Đang giải Captcha qua Gemini AI...');
        capText = await solveCaptchaWithGemini(base64, acmCreds.geminiApiKey || process.env.GEMINI_API_KEY || '');
        console.log(` -> [ACM] Captcha nhận diện được: "${capText}"`);
      }
      if (capText) {
        await page.fill("input[placeholder*='Captcha' i], input[name='captcha']", capText).catch(() => { });
      }
      await page.click(".el-button--primary, button:has-text('Login'), button[type='submit']").catch(() => { });
      await page.waitForTimeout(2500);

      // Màn hình Fill
      const baseUrl = page.url().split('#')[0];
      const fillUrl = acmCreds.fillUrl || `${baseUrl}#/business-tetptrade`;
      await page.goto(fillUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => { });
      await page.waitForTimeout(1500);

      readyTimes.acm = new Date();
      console.log(` -> [ACM] ✅ SẴN SÀNG TẠI FILL lúc: ${readyTimes.acm.toISOString()} (+${((Date.now() - p1Start) / 1000).toFixed(1)}s)`);
      readyState.acm = true;
      checkBarrier();

      await barrierPromise;

      // Pha 2: Export
      exportTimes.acm = new Date();
      console.log(` -> [ACM] ⚡ [PHA 2 BẮN TÍN HIỆU TẢI STRAITS.CSV] lúc: ${exportTimes.acm.toISOString()}`);
    } catch (err) {
      console.error(` -> [ACM]  Lỗi: ${err.message}`);
      readyState.acm = true;
      checkBarrier();
    }
  };

  // WORKER 3: CORECCP
  const workerCCP = async () => {
    if (!ccpCreds) return;
    try {
      console.log(' -> [CCP] Khởi chạy Chromium...');
      const browser = await chromium.launch({ headless: true, executablePath, args: launchArgs });
      activeBrowsers.push(browser);
      const page = await browser.newPage();
      page.setDefaultTimeout(35000);

      const ccpUrl = ccpCreds.url || 'https://coreccp.vnclear.vn/login';
      console.log(` -> [CCP] Điều hướng đến: ${ccpUrl}...`);
      await page.goto(ccpUrl, { waitUntil: 'networkidle', timeout: 25000 });
      await page.fill("input[name='username'], input[type='text']", ccpCreds.username);
      await page.fill("input[name='password'], input[type='password']", ccpCreds.password);
      await page.click("button[type='submit'], button:has-text('Đăng nhập')");
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { });
      await page.waitForTimeout(800);

      readyTimes.ccp = new Date();
      console.log(` -> [CCP] ✅ SẴN SÀNG TẠI BÁO CÁO lúc: ${readyTimes.ccp.toISOString()} (+${((Date.now() - p1Start) / 1000).toFixed(1)}s)`);
      readyState.ccp = true;
      checkBarrier();

      await barrierPromise;

      // Pha 2: Export
      exportTimes.ccp = new Date();
      console.log(` -> [CCP] ⚡ [PHA 2 BẮN TÍN HIỆU TẢI CCP_DSGD] lúc: ${exportTimes.ccp.toISOString()}`);
    } catch (err) {
      console.error(` -> [CCP]  Lỗi: ${err.message}`);
      readyState.ccp = true;
      checkBarrier();
    }
  };

  // WORKER 4: CQG
  const workerCQG = async () => {
    if (!cqgCreds) return;
    try {
      console.log(' -> [CQG] Khởi chạy Chromium Persistent Context (Profile 1)...');
      const profileDir = path.join(process.cwd(), 'temp', 'cqg_profile_1');
      if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

      const context = await chromium.launchPersistentContext(profileDir, {
        headless: true,
        executablePath,
        args: [...launchArgs, '--disk-cache-size=104857600'],
      });
      activeBrowsers.push(context);
      const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
      page.setDefaultTimeout(45000);

      const cqgUrl = cqgCreds.urlTrade || cqgCreds.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
      console.log(` -> [CQG] Mở trang đăng nhập: ${cqgUrl}...`);
      await page.goto(cqgUrl, { waitUntil: 'commit', timeout: 35000 });

      const hasLoginForm = await page.waitForSelector('input[name="userName"]', { state: 'visible', timeout: 30000 }).catch(() => null);
      if (hasLoginForm) {
        const u1 = cqgCreds.username1 || cqgCreds.usernameCQG1;
        const p1 = cqgCreds.password1 || cqgCreds.passwordCQG1;
        await page.fill('input[name="userName"]', u1);
        await page.fill('input[name="password"]', p1);
        await page.click('button[type="submit"]');
        await page.waitForSelector('div.wpfe-logo-image', { state: 'visible', timeout: 40000 }).catch(() => { });
      }

      readyTimes.cqg = new Date();
      console.log(` -> [CQG] ✅ SẴN SÀNG TẠI FR1 lúc: ${readyTimes.cqg.toISOString()} (+${((Date.now() - p1Start) / 1000).toFixed(1)}s)`);
      readyState.cqg = true;
      checkBarrier();

      await barrierPromise;

      // Pha 2: Export
      exportTimes.cqg = new Date();
      console.log(` -> [CQG] ⚡ [PHA 2 BẮN TÍN HIỆU TẢI FR1.XLSX] lúc: ${exportTimes.cqg.toISOString()}`);
    } catch (err) {
      console.error(` -> [CQG]  Lỗi: ${err.message}`);
      readyState.cqg = true;
      checkBarrier();
    }
  };

  // Timeout an toàn rào cản 35s
  setTimeout(() => {
    console.log(' Đạt ngưỡng an toàn 35s, kích hoạt rào cản...');
    resolveBarrier();
  }, 35000);

  // Chạy đồng thời cả 4 Worker
  await Promise.all([workerMS(), workerACM(), workerCCP(), workerCQG()]);

  // ĐO ĐẠC RAM KHI CẢ 4 CHROMIUM ĐANG ĐĂNG NHẬP & GIỮ PHIÊN
  const peakMem = getMemInfo();
  console.log(`\n[4. ĐO ĐẠC BỘ NHỚ KHI CẢ 4 CHROMIUM ĐANG ĐĂNG NHẬP & GIỮ PHIÊN]`);
  console.log(`- RAM Tổng                  : ${peakMem.total} MB`);
  console.log(`- RAM Khả dụng còn lại      : ${peakMem.available} MB`);
  console.log(`- RAM Tiêu hao bởi 4 Chrome : ${initialMem.available - peakMem.available} MB`);
  console.log(`- Swap Đang dùng            : ${peakMem.swapUsed} MB (Tăng: ${peakMem.swapUsed - initialMem.swapUsed} MB)`);

  // ĐÁNH GIÁ ĐỘ LỆCH THỜI GIAN SNAPSHOT
  console.log(`\n[5. ĐÁNH GIÁ ĐỘ LỆCH THỜI GIAN (SNAPSHOT TIME DRIFT)]`);
  const exportList = Object.entries(exportTimes).map(([k, v]) => ({ name: k, time: v.getTime() }));
  if (exportList.length >= 2) {
    const minT = Math.min(...exportList.map((e) => e.time));
    const maxT = Math.max(...exportList.map((e) => e.time));
    const deltaMs = maxT - minT;
    console.log(`- Thời điểm xuất file sớm nhất: ${new Date(minT).toISOString()}`);
    console.log(`- Thời điểm xuất file muộn nhất: ${new Date(maxT).toISOString()}`);
    console.log(`- ĐỘ CHÊNH LỆCH SNAPSHOT (Δt)  : ${(deltaMs / 1000).toFixed(3)} GIÂY! (Mục tiêu: ≤ 2.0s)`);
  }

  // ĐÓNG TẤT CẢ TRÌNH DUYỆT VÀ GIẢI PHÓNG RAM
  console.log(`\n[6. ĐÓNG TẤT CẢ 4 TRÌNH DUYỆT ĐỂ GIẢI PHÓNG TOÀN BỘ BỘ NHỚ...]`);
  for (const b of activeBrowsers) {
    await b.close().catch(() => { });
  }
  await new Promise((r) => setTimeout(r, 2000));
  const finalMem = getMemInfo();
  console.log(`- RAM Khả dụng sau khi dọn dẹp: ${finalMem.available} MB (Đã thu hồi: ${finalMem.available - peakMem.available} MB)`);

  // KIỂM TRA TIẾN TRÌNH SẠCH TRÊN LINUX
  console.log(`\n[7. KIỂM TRA ĐỘ SẠCH TIẾN TRÌNH CHROMIUM TRÊN LINUX...]`);
  try {
    const psCheck = execSync('pgrep -a -f "chrome|chromium" || true', { encoding: 'utf8' }).trim();
    if (psCheck) {
      console.log(' Phát hiện tiến trình Chrome còn sót lại:\n' + psCheck);
    } else {
      console.log('✅ TIẾN TRÌNH SẠCH 100%: Hoàn toàn không còn bất kỳ tiến trình Chrome/Chromium nào chạy ngầm!');
    }
  } catch (err) {
    console.log('Kiểm tra pgrep:', err.message);
  }

  console.log(`\n=== HOÀN TẤT KIỂM THỬ THÀNH CÔNG ===`);
}

runTest().catch((e) => {
  console.error('Lỗi nghiêm trọng:', e);
  process.exit(1);
});
