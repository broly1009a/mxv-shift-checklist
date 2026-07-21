import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';
import { decrypt } from './modules/bot-engine/utils/crypto';
import { chromium, Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

interface SidebarItem {
  name: string;
  path: string[];
  expectedHash?: string;
}

const SIDEBAR_ITEMS_TO_TEST: SidebarItem[] = [
  // 1. Cài đặt chung & Dashboard
  { name: 'Cài đặt chung', path: ['Cài đặt chung'] },
  { name: 'Dashboard', path: ['Dashboard'] },

  // 2. QL hệ thống
  { name: 'QL hệ thống (Menu cha)', path: ['QL hệ thống'] },
  { name: 'Nhật ký thao tác hệ thống', path: ['QL hệ thống', 'Thông tin chung', 'Nhật ký thao tác hệ thống'], expectedHash: '#/systemManagement/auditLog' },

  // 3. QL người dùng
  { name: 'QL người dùng (Menu cha)', path: ['QL người dùng'] },

  // 4. QL khách hàng & các menu con
  { name: 'QL khách hàng -> QL TVKD', path: ['QL khách hàng', 'QL TVKD'] },
  { name: 'QL khách hàng -> QL MG', path: ['QL khách hàng', 'QL MG'] },
  { name: 'QL khách hàng -> QL CTV', path: ['QL khách hàng', 'QL CTV'] },
  { name: 'QL khách hàng -> QL TKGD -> Danh sách TKGD', path: ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'], expectedHash: '#/clientManagement/investorManagement' },
  { name: 'QL khách hàng -> QL TKGD -> QL TT TKGD', path: ['QL khách hàng', 'QL TKGD', 'QL TT TKGD'], expectedHash: '#/clientManagement/marginStatusManagement' },
  { name: 'QL khách hàng -> QL TKGD -> Nộp rút ký quỹ TKGD', path: ['QL khách hàng', 'QL TKGD', 'Nộp rút ký quỹ TKGD'] },
  { name: 'QL khách hàng -> QL TKGD -> Lịch sử giao dịch tiền TKGD', path: ['QL khách hàng', 'QL TKGD', 'Lịch sử giao dịch tiền TKGD'], expectedHash: '#/clientManagement/transactionHistory' },
  { name: 'QL khách hàng -> QL Trader -> Danh sách Trader', path: ['QL khách hàng', 'QL Trader', 'Danh sách Trader'] },

  // 5. QL tiền tệ & tỷ giá
  { name: 'QL tiền tệ & tỷ giá (Menu cha)', path: ['QL tiền tệ & tỷ giá'] },

  // 6. QL hàng hoá - hợp đồng
  { name: 'QL hàng hoá - hợp đồng (Menu cha)', path: ['QL hàng hoá - hợp đồng'] },

  // 7. QL giá
  { name: 'QL giá -> Bảng giá', path: ['QL giá', 'Bảng giá'] },

  // 8. QL giao dịch
  { name: 'QL giao dịch (Menu cha)', path: ['QL giao dịch'] },
  { name: 'QL vị thế -> Danh sách kết quả giao dịch', path: ['QL vị thế', 'Danh sách kết quả giao dịch'], expectedHash: '#/positionManagement/marginList' },
];

async function runSidebarClickTest() {
  console.log('====================================================================');
  console.log('🚀 SCRIPT KIỂM THỬ CLICK SIDEBAR M-SYSTEM TỰ ĐỘNG (PLAYWRIGHT)');
  console.log('====================================================================');

  const app = await NestFactory.createApplicationContext(AppModule);
  await new Promise((r) => setTimeout(r, 1500));
  const settingsService = app.get(SystemSettingsService);

  let username = process.env.MS_USER;
  let password = process.env.MS_PASS;
  let pin = process.env.MS_PIN;
  let msystemUrl = process.env.MS_URL || 'https://msystem.mxv.vn/';

  if (!username || !password || !pin) {
    let credentialsRaw = await settingsService.getSetting('bot_credentials_msystem', '');
    if (!credentialsRaw) {
      const mongoose = require('mongoose');
      const SettingModel = mongoose.model('SystemSetting');
      const doc = await SettingModel.findOne({ key: 'bot_credentials_msystem' });
      if (doc) credentialsRaw = doc.value;
    }
    if (credentialsRaw) {
      try {
        const credentials = JSON.parse(decrypt(credentialsRaw));
        username = credentials.username;
        password = credentials.password;
        pin = credentials.pin;
        msystemUrl = credentials.url || msystemUrl;
      } catch (err) {
        console.error('❌ Lỗi giải mã thông tin tài khoản M-System từ CSDL.');
      }
    }
  }

  if (!username || !password || !pin) {
    console.error('❌ Thất bại: Chưa cấu hình thông tin tài khoản M-System!');
    await app.close();
    process.exit(1);
  }

  console.log(`- Tài khoản: ${username}`);
  console.log(`- Target URL: ${msystemUrl}\n`);

  const bundledPath = path.join(
    process.cwd(),
    '..',
    'it-tool-src',
    'operate-transaction-app',
    'Chrome',
    'chrome-win',
    'chrome.exe'
  );

  const launchOptions: any = {
    headless: false, // Hiển thị màn hình trình duyệt
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };

  if (fs.existsSync(bundledPath)) {
    launchOptions.executablePath = bundledPath;
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const logLines: string[] = [];
  const appendLog = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  appendLog(`====================================================================`);
  appendLog(`BÁO CÁO KIỂM THỬ NAVIGATION CLICK SIDEBAR M-SYSTEM`);
  appendLog(`Thời gian thực thi: ${new Date().toLocaleString('vi-VN')}`);
  appendLog(`URL M-System: ${msystemUrl}`);
  appendLog(`Tài khoản: ${username}`);
  appendLog(`====================================================================\n`);

  try {
    // 1. Đăng nhập M-System
    appendLog('[STEP 1] Đang thực hiện đăng nhập M-System...');
    await page.goto(msystemUrl);
    await page.waitForSelector('input[name="username"]', { state: 'visible' });
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button.btn-primary');

    await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 });
    const pinDigits = pin.split('');
    for (const digit of pinDigits) {
      const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
      await page.waitForSelector(digitSelector, { state: 'visible' });
      await page.click(digitSelector);
      await page.waitForTimeout(400);
    }

    await page.waitForSelector('xpath=.//div[contains(text(),"Ngày phiên hiện tại:")]', {
      state: 'visible',
      timeout: 15000,
    });
    appendLog('✅ Đăng nhập M-System thành công!\n');

    // 2. Bắt đầu test click từng item trong sidebar
    appendLog('[STEP 2] Bắt đầu kiểm thử click lần lượt các mục Sidebar:\n');
    appendLog(
      sprintf('%-45s | %-10s | %-10s | %-45s | %-30s', 'TÊN MỤC MENU / ĐƯỜNG DẪN', 'KẾT QUẢ', 'THỜI GIAN', 'URL HASH HIỆN TẠI', 'GHI CHÚ')
    );
    appendLog('-'.repeat(150));

    let passCount = 0;
    let failCount = 0;

    for (const item of SIDEBAR_ITEMS_TO_TEST) {
      const startTime = Date.now();
      let isSuccess = false;
      let note = '';
      let currentUrl = '';

      try {
        // Thực hiện click chuỗi đường dẫn menu
        for (let i = 0; i < item.path.length; i++) {
          const menuText = item.path[i];
          const isLast = i === item.path.length - 1;

          // Thử nhiều Selector XPath khác nhau để click chữ trên sidebar
          const selectors = [
            `xpath=//a[span[normalize-space(text())='${menuText}']]`,
            `xpath=//a[contains(normalize-space(.), '${menuText}')]`,
            `xpath=//span[normalize-space(text())='${menuText}']`,
            `xpath=//a[text()='${menuText}']`,
          ];

          let clicked = false;
          for (const sel of selectors) {
            try {
              const el = page.locator(sel).first();
              if (await el.isVisible({ timeout: 2000 })) {
                // Kiểm tra xem menu cha đã mở sẵn chưa
                if (!isLast) {
                  const isOpen = await el.evaluate((node) => {
                    const li = node.closest('li');
                    return li ? (li.classList.contains('open') || li.classList.contains('show')) : false;
                  }).catch(() => false);
                  if (isOpen) {
                    clicked = true;
                    break;
                  }
                }

                await el.click({ force: true });
                await page.waitForTimeout(1000);
                clicked = true;
                break;
              }
            } catch (e) {
              // Thử selector tiếp theo
            }
          }

          if (!clicked) {
            throw new Error(`Không tìm thấy hoặc không thể click menu: "${menuText}"`);
          }
        }

        // Lấy Hash URL hiện tại
        await page.waitForTimeout(1000);
        currentUrl = page.url();
        const urlHash = currentUrl.includes('#') ? '#' + currentUrl.split('#')[1] : currentUrl;

        // Nếu có URL Hash kỳ vọng, đối chiếu xem khớp không
        if (item.expectedHash) {
          if (urlHash.toLowerCase().includes(item.expectedHash.toLowerCase())) {
            note = `Khớp Hash kỳ vọng (${item.expectedHash})`;
          } else {
            note = `CẢNH BÁO: Hash hiện tại (${urlHash}) chưa khớp kỳ vọng (${item.expectedHash})`;
          }
        } else {
          note = `Hash hiện tại: ${urlHash}`;
        }

        isSuccess = true;
        passCount++;
      } catch (err: any) {
        isSuccess = false;
        failCount++;
        note = `LỖI: ${err.message}`;
        currentUrl = page.url();
      }

      const duration = `${Date.now() - startTime}ms`;
      const statusStr = isSuccess ? '✅ SUCCESS' : '❌ FAILED';
      const hashStr = currentUrl.includes('#') ? '#' + currentUrl.split('#')[1] : 'N/A';

      appendLog(
        sprintf('%-45s | %-10s | %-10s | %-45s | %-30s', item.name, statusStr, duration, hashStr, note)
      );
    }

    appendLog('\n' + '='.repeat(150));
    appendLog(`📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ:`);
    appendLog(`- Tổng số mục menu đã test: ${SIDEBAR_ITEMS_TO_TEST.length}`);
    appendLog(`- Click thành công (SUCCESS): ${passCount}`);
    appendLog(`- Thất bại (FAILED): ${failCount}`);
    appendLog(`- Đánh giá khả thi: ${failCount === 0 ? '🟢 100% Khả thi (Cơ chế Click sidebar chạy rất tốt)' : '⚠️ Cần điều chỉnh một số Selector XPath hoặc chuyển hẳn sang Direct Hash URL'}`);
    appendLog('='.repeat(150));

  } catch (err: any) {
    appendLog(`\n❌ Lỗi nghiêm trọng khi thực thi test script: ${err.message}`);
  } finally {
    // 3. Ghi file báo cáo kết quả ra txt
    const reportDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    const reportFilePath = path.join(reportDir, 'ms_sidebar_test_results.txt');
    fs.writeFileSync(reportFilePath, logLines.join('\n'), 'utf8');

    appendLog(`\n📄 Báo cáo kiểm thử chi tiết đã được lưu thành công tại:`);
    appendLog(`👉 ${reportFilePath}\n`);

    console.log('Đang đóng trình duyệt và hoàn tất...');
    await browser.close();
    await app.close();
  }
}

function sprintf(format: string, ...args: any[]): string {
  let argIndex = 0;
  return format.replace(/%-?(\d+)s/g, (match, width) => {
    const isLeftAlign = match.startsWith('%-');
    const w = parseInt(width, 10);
    const val = String(args[argIndex++] || '');
    if (isLeftAlign) {
      return val.padEnd(w, ' ');
    } else {
      return val.padStart(w, ' ');
    }
  });
}

runSidebarClickTest().catch(err => {
  console.error('❌ Unhandled error in sidebar test script:', err);
  process.exit(1);
});
