import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import { decrypt } from '../modules/bot-engine/utils/crypto';
import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

async function runCQGLoginTest() {
  console.log('----------------------------------------------------');
  console.log('🚀 KHỞI CHẠY TỰ ĐỘNG ĐĂNG NHẬP CQG DESKTOP (HEADFUL MODE)');
  console.log('----------------------------------------------------');

  // 1. Boot NestJS context to load config from database
  console.log('Đang kết nối cơ sở dữ liệu...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const settingsService = app.get(SystemSettingsService);

  let username = process.env.CQG_USER;
  let password = process.env.CQG_PASS;
  let cqgUrl =
    process.env.CQG_URL || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';

  if (!username || !password) {
    console.log(
      'Không tìm thấy tài khoản trong biến môi trường. Đang đọc từ CSDL...',
    );
    const credentialsRaw = await settingsService.getSetting(
      'bot_credentials_cqg',
      '',
    );
    if (credentialsRaw) {
      try {
        const credentials = JSON.parse(decrypt(credentialsRaw));
        username = credentials.username;
        password = credentials.password;
        cqgUrl = credentials.url || cqgUrl;
      } catch (err) {
        console.error('❌ Lỗi giải mã thông tin tài khoản CQG từ CSDL.');
      }
    }
  }

  if (!username || !password) {
    console.log('\n❌ THẤT BẠI: Chưa cấu hình thông tin tài khoản CQG!');
    console.log('Bạn có thể cấu hình bằng 2 cách:');
    console.log(
      'Cách 1: Lưu cấu hình trên giao diện Web Admin tại địa chỉ /admin/bot-config',
    );
    console.log('Cách 2: Chạy lệnh bằng cách truyền biến môi trường, ví dụ:');
    console.log(
      '   $env:CQG_USER="ten_dang_nhap"; $env:CQG_PASS="mat_khau"; npm.cmd run test:cqg-login',
    );
    console.log('----------------------------------------------------');
    await app.close();
    process.exit(1);
  }

  console.log(`Tài khoản phát hiện: ${username}`);
  console.log(`URL đăng nhập: ${cqgUrl}`);
  console.log('Đang chuẩn bị trình duyệt...');

  // Find bundled chrome path if exists
  const bundledPath = path.join(
    process.cwd(),
    '..',
    'it-tool-src',
    'operate-transaction-app',
    'Chrome',
    'chrome-win',
    'chrome.exe',
  );

  const launchOptions: any = {
    headless: false, // SHOW THE BROWSER SO USER CAN SEE IT
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };

  if (fs.existsSync(bundledPath)) {
    console.log(`Phát hiện Chrome tích hợp tại: ${bundledPath}`);
    launchOptions.executablePath = bundledPath;
  } else {
    console.log(
      'Không tìm thấy Chrome tích hợp. Sử dụng trình duyệt mặc định của hệ thống.',
    );
  }

  // Launch browser
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // Lắng nghe logs trình duyệt
  page.on('console', (msg) => {
    console.log(`[Browser Console] [${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.error(`[Browser PageError] ${err.message}`);
  });

  try {
    console.log(`Đi tới trang đăng nhập: ${cqgUrl}...`);
    await page.goto(cqgUrl);

    console.log('Nhập tài khoản và mật khẩu...');
    await page.waitForSelector('input[name="userName"]', {
      state: 'visible',
      timeout: 20000,
    });
    await page.fill('input[name="userName"]', username);
    await page.fill('input[name="password"]', password);

    console.log('Nhấn nút Đăng nhập...');
    await page.click('button[type="submit"]');

    console.log('Đang đợi CQG dashboard logo hiển thị...');
    await page.waitForSelector('div.wpfe-logo-image', {
      state: 'visible',
      timeout: 60000,
    });

    console.log('\n🎉 ĐĂNG NHẬP CQG THÀNH CÔNG RỰC RỠ!');
    console.log(
      'Trình duyệt sẽ hiển thị trong 15 giây để bạn kiểm tra trước khi tự đóng...',
    );
    await page.waitForTimeout(15000);
  } catch (err: any) {
    console.error(
      '\n❌ Xảy ra lỗi trong quá trình tự động đăng nhập CQG:',
      err.message,
    );
    try {
      const debugDir = path.join(process.cwd(), 'temp', 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const txtPath = path.join(
        debugDir,
        `error-login-cqg-cli-${timestamp}.txt`,
      );
      const pngPath = path.join(
        debugDir,
        `error-screenshot-cqg-cli-${timestamp}.png`,
      );
      const htmlPath = path.join(
        debugDir,
        `error-page-cqg-cli-${timestamp}.html`,
      );

      const logContent = `Time: ${new Date().toISOString()}\nURL: ${cqgUrl}\nUsername: ${username}\nError: ${err.message}\nStack: ${err.stack}\n`;
      fs.writeFileSync(txtPath, logContent, 'utf8');

      if (page && !page.isClosed()) {
        await page
          .screenshot({ path: pngPath, fullPage: true })
          .catch(() => { });
        const html = await page.content().catch(() => '');
        if (html) {
          fs.writeFileSync(htmlPath, html, 'utf8');
        }
      }
      console.log(
        `⚠️ Đã ghi nhận log lỗi và chụp màn hình debug tại: ${debugDir}`,
      );
    } catch (logErr: any) {
      console.error('❌ Không thể lưu debug artifacts:', logErr.message);
    }
  } finally {
    console.log('Đang đóng trình duyệt...');
    await browser.close();
    console.log('Đang ngắt kết nối database...');
    await app.close();
    console.log('Hoàn tất kiểm thử!');
  }
}

runCQGLoginTest().catch((err) => {
  console.error('❌ Lỗi thực thi kiểm thử đăng nhập CQG:', err);
  process.exit(1);
});
