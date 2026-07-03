import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { decrypt } from './utils/crypto';

@Injectable()
export class RpaDownloaderService {
  private readonly logger = new Logger(RpaDownloaderService.name);

  constructor(private readonly settingsService: SystemSettingsService) {}

  /**
   * Retrieves the Chrome executable path. Searches local repo first, then falls back to environment or default playwright.
   */
  private getChromeExecutablePath(): string | null {
    // Relative to backend working directory: ../it-tool-src/operate-transaction-app/Chrome/chrome-win/chrome.exe
    const bundledPath = path.join(
      process.cwd(),
      '..',
      'it-tool-src',
      'operate-transaction-app',
      'Chrome',
      'chrome-win',
      'chrome.exe'
    );

    if (fs.existsSync(bundledPath)) {
      this.logger.log(`Using bundled Chrome binary at: ${bundledPath}`);
      return bundledPath;
    }

    this.logger.warn(`Bundled Chrome binary not found at ${bundledPath}. Falling back to default playwright launch.`);
    return null;
  }

  /**
   * Launches browser and logs in to M-System. Returns the browser and authenticated page.
   */
  async loginMSystem(downloadDir: string): Promise<{ browser: Browser; page: Page }> {
    // 1. Fetch credentials
    const credentialsRaw = await this.settingsService.getSetting('bot_credentials_msystem', '');
    if (!credentialsRaw) {
      throw new Error('Chưa cấu hình tài khoản M-System trong cài đặt hệ thống.');
    }

    let credentials: any;
    try {
      credentials = JSON.parse(decrypt(credentialsRaw));
    } catch (err) {
      throw new Error('Không thể giải mã cấu hình tài khoản M-System. Vui lòng cấu hình lại.');
    }

    const msystemUrl = credentials.url || 'https://msystem.mxv.vn/';
    const { username, password, pin } = credentials;

    if (!username || !password || !pin) {
      throw new Error('Thông tin đăng nhập M-System (username, password, pin) không đầy đủ.');
    }

    // 2. Launch Browser
    const executablePath = this.getChromeExecutablePath();
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    this.logger.log('Starting Playwright browser session...');
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000); // 30s timeout

    // Lắng nghe console và lỗi từ trình duyệt để dễ dàng debug
    page.on('console', (msg) => {
      this.logger.debug(`[Browser Console] [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      this.logger.error(`[Browser PageError] ${err.message}`, err.stack);
    });

    try {
      this.logger.log(`Navigating to M-System at ${msystemUrl}...`);
      await page.goto(msystemUrl);

      // 3. Fill Login form
      this.logger.log('Filling username and password...');
      await page.waitForSelector('input[name="username"]', { state: 'visible' });
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button.btn-primary');

      // 4. Handle PIN modal
      this.logger.log('Waiting for PIN code keypad modal...');
      await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 });

      // Click each pin digit
      const pinDigits = pin.split('');
      for (const digit of pinDigits) {
        this.logger.log(`Clicking PIN digit: ${digit}`);
        // Find digit element inside the pincode modal
        const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
        await page.waitForSelector(digitSelector, { state: 'visible' });
        await page.click(digitSelector);
        await page.waitForTimeout(500); // Small delay between keypad presses
      }

      // 5. Verify Successful Login
      this.logger.log('Verifying login success...');
      await page.waitForSelector('xpath=.//div[contains(text(),"Ngày phiên hiện tại:")]', {
        state: 'visible',
        timeout: 15000,
      });

      this.logger.log('Login M-System SUCCESSFUL.');
      return { browser, page };
    } catch (err: any) {
      this.logger.error(`Đăng nhập MSystem thất bại: ${err.message}`);
      
      // Ghi nhận file log và ảnh chụp lỗi để debug
      try {
        const debugDir = path.join(process.cwd(), 'temp', 'debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const txtPath = path.join(debugDir, `error-login-${timestamp}.txt`);
        const pngPath = path.join(debugDir, `error-screenshot-${timestamp}.png`);
        const htmlPath = path.join(debugDir, `error-page-${timestamp}.html`);

        const logContent = `Time: ${new Date().toISOString()}\nURL: ${msystemUrl}\nUsername: ${username}\nError: ${err.message}\nStack: ${err.stack}\n`;
        fs.writeFileSync(txtPath, logContent, 'utf8');

        if (page && !page.isClosed()) {
          await page.screenshot({ path: pngPath, fullPage: true }).catch(() => {});
          const html = await page.content().catch(() => '');
          if (html) {
            fs.writeFileSync(htmlPath, html, 'utf8');
          }
        }
        this.logger.warn(`Đã lưu log lỗi và ảnh chụp màn hình debug tại: ${debugDir}`);
      } catch (logErr: any) {
        this.logger.error(`Không thể tạo file log lỗi debug: ${logErr.message}`);
      }

      await browser.close();
      throw err;
    }
  }

  /**
   * Launches browser and logs in to CQG. Returns the browser and authenticated page.
   */
  async loginCQG(downloadDir: string): Promise<{ browser: Browser; page: Page }> {
    // 1. Fetch credentials
    const credentialsRaw = await this.settingsService.getSetting('bot_credentials_cqg', '');
    if (!credentialsRaw) {
      throw new Error('Chưa cấu hình tài khoản CQG trong cài đặt hệ thống.');
    }

    let credentials: any;
    try {
      credentials = JSON.parse(decrypt(credentialsRaw));
    } catch (err) {
      throw new Error('Không thể giải mã cấu hình tài khoản CQG. Vui lòng cấu hình lại.');
    }

    const cqgUrl = credentials.url || 'https://desktop.cqg.com/cqg/desktop/logon?ref=forced';
    const { username, password } = credentials;

    if (!username || !password) {
      throw new Error('Thông tin đăng nhập CQG (username, password) không đầy đủ.');
    }

    // 2. Launch Browser
    const executablePath = this.getChromeExecutablePath();
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    this.logger.log('Starting Playwright browser session for CQG...');
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000); // 30s default timeout

    // Lắng nghe console và lỗi từ trình duyệt để dễ dàng debug
    page.on('console', (msg) => {
      this.logger.debug(`[CQG Browser Console] [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      this.logger.error(`[CQG Browser PageError] ${err.message}`, err.stack);
    });

    try {
      this.logger.log(`Navigating to CQG at ${cqgUrl}...`);
      await page.goto(cqgUrl);

      // 3. Fill Login form
      this.logger.log('Filling CQG username and password...');
      await page.waitForSelector('input[name="userName"]', { state: 'visible', timeout: 20000 });
      await page.fill('input[name="userName"]', username);
      await page.fill('input[name="password"]', password);
      
      // Click Login button
      this.logger.log('Clicking CQG login button...');
      await page.click('button[type="submit"]');

      // 4. Verify Successful Login (wait for the logo)
      this.logger.log('Waiting for CQG dashboard logo...');
      await page.waitForSelector('div.wpfe-logo-image', {
        state: 'visible',
        timeout: 60000,
      });

      this.logger.log('Login CQG SUCCESSFUL.');
      return { browser, page };
    } catch (err: any) {
      this.logger.error(`Đăng nhập CQG thất bại: ${err.message}`);
      
      // Ghi nhận file log và ảnh chụp lỗi để debug
      try {
        const debugDir = path.join(process.cwd(), 'temp', 'debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const txtPath = path.join(debugDir, `error-login-cqg-${timestamp}.txt`);
        const pngPath = path.join(debugDir, `error-screenshot-cqg-${timestamp}.png`);
        const htmlPath = path.join(debugDir, `error-page-cqg-${timestamp}.html`);

        const logContent = `Time: ${new Date().toISOString()}\nURL: ${cqgUrl}\nUsername: ${username}\nError: ${err.message}\nStack: ${err.stack}\n`;
        fs.writeFileSync(txtPath, logContent, 'utf8');

        if (page && !page.isClosed()) {
          await page.screenshot({ path: pngPath, fullPage: true }).catch(() => {});
          const html = await page.content().catch(() => '');
          if (html) {
            fs.writeFileSync(htmlPath, html, 'utf8');
          }
        }
        this.logger.warn(`Đã lưu log lỗi CQG và ảnh chụp màn hình debug tại: ${debugDir}`);
      } catch (logErr: any) {
        this.logger.error(`Không thể tạo file log lỗi debug CQG: ${logErr.message}`);
      }

      await browser.close();
      throw err;
    }
  }


  /**
   * Helper to perform navigation and trigger a file download
   */
  private async navigateAndDownload(
    page: Page,
    menuSteps: string[],
    downloadPath: string,
    optionalTabSelector?: string
  ): Promise<void> {
    try {
      this.logger.log(`Navigating menu: ${menuSteps.join(' -> ')}`);
      
      // Click sequential menus
      for (const menu of menuSteps) {
        const selector = `xpath=//a[text()='${menu}']`;
        await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
        await page.click(selector);
        await page.waitForTimeout(1000); // Stabilize UI
      }

      // Click optional tabs (e.g., Spreads, LME, ACM)
      if (optionalTabSelector) {
        this.logger.log(`Clicking optional sub-tab: ${optionalTabSelector}`);
        const tabSelector = `xpath=//a[text()='${optionalTabSelector}']`;
        await page.waitForSelector(tabSelector, { state: 'visible', timeout: 10000 });
        await page.click(tabSelector);
        await page.waitForTimeout(2000);
      }

      // Wait for CSV download button
      const csvButtonSelector = `xpath=//i[contains(@class, 'fa-file-csv')]`;
      await page.waitForSelector(csvButtonSelector, { state: 'visible', timeout: 15000 });

      // Start waiting for download event before clicking
      const downloadPromise = page.waitForEvent('download');
      
      this.logger.log('Clicking CSV/Excel download icon...');
      await page.click(csvButtonSelector);
      
      const download = await downloadPromise;
      
      // Save downloaded file to target directory
      await download.saveAs(downloadPath);
      this.logger.log(`Saved report successfully to: ${downloadPath}`);

      // Optional: click parent menu again to collapse/reset menu state
      if (menuSteps.length > 0) {
        const topMenuSelector = `xpath=//a[text()='${menuSteps[0]}']`;
        await page.click(topMenuSelector).catch(() => {});
        await page.waitForTimeout(1000);
      }
    } catch (err: any) {
      this.logger.error(`Lỗi khi tải báo cáo: ${err.message}`);
      throw err;
    }
  }

  // Individual download wrappers mapping to C# methods

  async downloadNKTTHT(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL hệ thống', 'Thông tin chung', 'Nhật ký thao tác hệ thống'], destFile);
  }

  async downloadDSTKGDFutures(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'], destFile);
  }

  async downloadDSTKGDSpread(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'], destFile, 'Spreads');
  }

  async downloadDSTKGDLME(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'], destFile, 'LME');
  }

  async downloadDSTKGDACM(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'], destFile, 'ACM');
  }

  async downloadQLTTTKGD(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'QL TT TKGD'], destFile);
  }

  async downloadQLTTTKGDAmKQ(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'QL TKGD âm ký quỹ'], destFile);
  }

  async downloadTLKQHSKQ(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'TLKQ HSKQ'], destFile);
  }

  async downloadNR(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'Lịch sử giao dịch tiền TKGD'], destFile);
  }

  async downloadDSTrader(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL khách hàng', 'QL Trader', 'Danh sách Trader'], destFile);
  }

  async downloadMarkettruoc6h(page: Page, destFile: string) {
    try {
      this.logger.log('Navigating to QL giao dịch -> Bảng giá');
      await page.click("xpath=//a[text()='QL giao dịch']");
      await page.waitForTimeout(1000);
      await page.click("xpath=//a[text()='Bảng giá']");
      await page.waitForTimeout(2000);

      // Special check: if fa-file-csv button not found directly, click plus icon first
      const csvBtn = page.locator("xpath=//i[contains(@class, 'fa-file-csv')]");
      const isVisible = await csvBtn.isVisible().catch(() => false);

      if (!isVisible) {
        this.logger.log('CSV icon not directly visible, clicking plus button first...');
        await page.click("xpath=//i[contains(@class, 'fas fa-plus')]");
        await page.waitForTimeout(2000);
      }

      const downloadPromise = page.waitForEvent('download');
      await page.click("xpath=//i[contains(@class, 'fa-file-csv')]");
      const download = await downloadPromise;
      await download.saveAs(destFile);

      await page.click("xpath=//a[text()='QL giao dịch']").catch(() => {});
      this.logger.log(`Markettruoc6h downloaded successfully to: ${destFile}`);
    } catch (err: any) {
      throw new Error(`Tải Markettruoc6h.xlsx thất bại: ${err.message}`);
    }
  }

  async downloadDSLDK(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL giao dịch', 'Danh sách lệnh', 'Lệnh đã khớp'], destFile);
  }

  async downloadDSLCK(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL giao dịch', 'Danh sách lệnh', 'Lệnh chờ khớp'], destFile);
  }

  async downloadDSLH(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL giao dịch', 'Danh sách lệnh', 'Lệnh đã hủy'], destFile);
  }

  async downloadDSLK(page: Page, destFile: string) {
    await this.navigateAndDownload(page, ['QL giao dịch', 'Danh sách lệnh', 'Lệnh khác'], destFile);
  }

  async downloadDSGD(page: Page, destFile: string, sessionDay?: string) {
    try {
      this.logger.log('Navigating to QL giao dịch -> Danh sách giao dịch');
      await page.click("xpath=//a[text()='QL giao dịch']");
      await page.waitForTimeout(1000);
      await page.click("xpath=//a[text()='Danh sách giao dịch']");
      await page.waitForTimeout(3000);

      // If specific session day requested, input date values by removing readonly attributes
      if (sessionDay) {
        this.logger.log(`Configuring session date query for: ${sessionDay}`);
        await page.evaluate(() => {
          const startInput = document.querySelector("input[placeholder='Ngày bắt đầu']");
          const endInput = document.querySelector("input[placeholder='Ngày kết thúc']");
          if (startInput) startInput.removeAttribute('readonly');
          if (endInput) endInput.removeAttribute('readonly');
        });

        await page.fill("input[placeholder='Ngày bắt đầu']", sessionDay);
        await page.fill("input[placeholder='Ngày kết thúc']", sessionDay);
        await page.press("input[placeholder='Ngày kết thúc']", 'Enter');
        await page.waitForTimeout(3000);
      }

      const downloadPromise = page.waitForEvent('download');
      await page.click("xpath=//i[contains(@class, 'fa-file-csv')]");
      const download = await downloadPromise;
      await download.saveAs(destFile);

      await page.click("xpath=//a[text()='QL giao dịch']").catch(() => {});
      this.logger.log(`DSGD downloaded successfully to: ${destFile}`);
    } catch (err: any) {
      throw new Error(`Tải DSGD.xlsx thất bại: ${err.message}`);
    }
  }
}
