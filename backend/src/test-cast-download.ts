import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

const USERNAME = process.env.CAST_USER || '';
const PASSWORD = process.env.CAST_PASS || '';
const LOGIN_URL = 'https://www.cqgtrader.com/CAST/Logon/Logon.asp';

const DEBUG_DIR = path.join(__dirname, '../temp/debug/cast');
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

function log(msg: string) {
  const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
  console.log(`[${time}] ${msg}`);
}

// IE Mock Script to make modern browsers behave like IE11
const IE_MOCK_SCRIPT = `
  // Mock localeinfoproviderObj (IE ActiveX COM object)
  Object.defineProperty(window, 'localeinfoproviderObj', {
    value: {
      ShortDateFormat:   'MM/dd/yyyy',
      TimeFormat:        'hh:mm:ss tt',
      DecimalPoint:      '.',
      ThousandSeparator: ',',
      DigitsGrouping:    '3;0',
      DigitsAfterDecimal: 2
    },
    writable: true,
    configurable: true
  });

  // Mock window.event (IE-specific global event object)
  if (typeof window.event === 'undefined') {
    Object.defineProperty(window, 'event', {
      get: function() { return { keyCode: 0 }; },
      configurable: true
    });
  }

  // Override document.getElementById to emulate IE's behavior of matching 'name' when 'id' is not found
  const originalGetElementById = document.getElementById;
  document.getElementById = function(id) {
    let el = originalGetElementById.call(document, id);
    if (!el) {
      const elements = document.getElementsByName(id);
      if (elements.length > 0) {
        el = elements[0];
      }
    }
    return el;
  };
`;

async function main() {
  console.log('============================================================');
  console.log('🚀 TEST ĐĂNG NHẬP CQG CAST');
  console.log(`👤 User: ${USERNAME || '(chưa cung cấp)'}`);
  console.log('============================================================');

  if (!USERNAME || !PASSWORD) {
    console.error('❌ Thiếu CAST_USER hoặc CAST_PASS trong biến môi trường!');
    return;
  }

  // Khởi chạy trình duyệt Edge có giao diện
  const msEdgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const launchOptions: any = {
    headless: false,
    args: ['--start-maximized']
  };

  if (fs.existsSync(msEdgePath)) {
    launchOptions.executablePath = msEdgePath;
    log('✅ Sử dụng trình duyệt Microsoft Edge');
  } else {
    log('⚠️ Không tìm thấy Edge, sử dụng Chromium mặc định');
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko', // Giả lập User-Agent của IE11
  });

  // Đăng ký Mock Script
  await context.addInitScript({ content: IE_MOCK_SCRIPT });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    log('⚡ Mở trang đăng nhập CAST...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    log('⚡ Điền thông tin đăng nhập...');
    await page.locator('#userNameInput').fill(USERNAME);
    await page.locator('#passwordInput').fill(PASSWORD);

    log('⚡ Gọi doLogon() trực tiếp để đăng nhập...');
    await page.waitForFunction(() => typeof (window as any).doLogon === 'function');
    await page.evaluate(() => {
      (window as any).doLogon();
    });

    log('⚡ Chờ đăng nhập và chuyển hướng...');
    await page.waitForURL('**/CastMain.asp', { timeout: 30000 });
    log('🎉 ĐĂNG NHẬP THÀNH CÔNG!');
    
    // Chụp màn hình thành công
    const successPath = path.join(DEBUG_DIR, 'login-success.png');
    await page.screenshot({ path: successPath });
    log(`📸 Đã chụp ảnh màn hình thành công lưu tại: ${successPath}`);

    log('⏳ Giữ trình duyệt mở trong 2 phút để bạn kiểm tra...');
    await page.waitForTimeout(120000);

  } catch (error: any) {
    log(`❌ Lỗi trong quá trình chạy: ${error.message}`);
    const errorPath = path.join(DEBUG_DIR, 'login-error.png');
    await page.screenshot({ path: errorPath }).catch(() => {});
    log(`📸 Đã chụp ảnh lỗi lưu tại: ${errorPath}`);
    await page.waitForTimeout(10000);
  } finally {
    await browser.close();
    log('👋 Đã đóng trình duyệt.');
  }
}

main().catch(console.error);
