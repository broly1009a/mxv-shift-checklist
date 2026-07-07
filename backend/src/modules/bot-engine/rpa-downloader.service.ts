import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { decrypt } from './utils/crypto';

@Injectable()
export class RpaDownloaderService {
  private readonly logger = new Logger(RpaDownloaderService.name);

  constructor(private readonly settingsService: SystemSettingsService) { }

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
      // Playwright 1.49+: headless:true tự động dùng New Headless Chrome
      // (headless:'new' đã bị xóa khỏi API, không còn dùng được)
      // New Headless: không cần màn hình (chạy được trên server) + khó bị anti-bot hơn old headless
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // ẩn flag automation
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--window-size=1280,800',
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    this.logger.log('Starting Playwright browser session...');
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    // Anti-bot: Ẩn navigator.webdriver (dấu hiệu rõ ràng nhất cho anti-bot)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
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
      await page.waitForTimeout(500);
      await page.click('button.btn-primary');

      // 4. Handle PIN modal
      this.logger.log('Waiting for PIN code keypad modal...');
      let pinSelectorVisible = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        pinSelectorVisible = await page.locator('div.pincode').isVisible({ timeout: 5000 }).catch(() => false);
        if (pinSelectorVisible) break;
        this.logger.warn(`Chưa hiển thị bảng PIN (lần thử ${attempt}), thử click lại nút Đăng nhập...`);
        await page.click('button.btn-primary').catch(() => { });
        await page.waitForTimeout(2000);
      }

      await page.waitForSelector('div.pincode', { state: 'visible', timeout: 10000 });

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
          await page.screenshot({ path: pngPath, fullPage: true }).catch(() => { });
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

    const cqgUrl = credentials.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
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
          await page.screenshot({ path: pngPath, fullPage: true }).catch(() => { });
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


  private async gotoAndDownload(
    page: Page,
    hashPath: string,
    downloadPath: string,
    optionalTabSelector?: string,
    customTimeoutMs: number = 90000
  ): Promise<void> {
    try {
      const baseUrl = page.url().split('#')[0];
      const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const targetUrl = `${normalizedBaseUrl}${hashPath}`;
      this.logger.log(`Direct navigation to: ${targetUrl}`);
      await page.goto(targetUrl);
      await page.waitForTimeout(3000); // Wait for UI stabilization

      // Click optional tabs if provided
      if (optionalTabSelector) {
        this.logger.log(`Clicking optional tab: ${optionalTabSelector}`);
        const tabSelector = `xpath=//a[text()='${optionalTabSelector}' or normalize-space(text())='${optionalTabSelector}']`;
        await page.waitForSelector(tabSelector, { state: 'visible', timeout: 15000 });
        await page.click(tabSelector);
        await page.waitForTimeout(3000); // Wait for tab data loading
      }

      // Wait for CSV download button
      const csvButtonSelector = `button.ladda-button:has(i.fa-file-csv), i.fa-file-csv, button:has(.fa-file-csv)`;
      await page.waitForSelector(csvButtonSelector, { state: 'visible', timeout: 30000 });

      // Start waiting for download event before clicking
      this.logger.log(`Starting download waiting with timeout: ${customTimeoutMs}ms...`);
      const downloadPromise = page.waitForEvent('download', { timeout: customTimeoutMs });

      this.logger.log('Clicking CSV/Excel download icon/button...');
      // Click the first matching visible button
      await page.locator(csvButtonSelector).first().click();

      const download = await downloadPromise;
      await download.saveAs(downloadPath);
      this.logger.log(`Saved report successfully to: ${downloadPath}`);
    } catch (err: any) {
      this.logger.error(`Lỗi khi tải trực tiếp báo cáo (${hashPath}): ${err.message}`);
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

      // Click sequential menus intelligently
      for (let i = 0; i < menuSteps.length; i++) {
        const menu = menuSteps[i];
        const selector = `xpath=//a[text()='${menu}' or normalize-space(text())='${menu}']`;

        // Nếu không phải mục cuối cùng (tức là dropdown parent), kiểm tra xem nó đã mở sẵn chưa
        if (i < menuSteps.length - 1) {
          const isAlreadyOpen = await page.locator(selector).evaluate((el) => {
            const parentLi = el.closest('li');
            return parentLi ? (parentLi.classList.contains('open') || parentLi.classList.contains('show')) : false;
          }).catch(() => false);

          if (isAlreadyOpen) {
            this.logger.log(`Menu cha "${menu}" đã mở sẵn (có class open/show). Bỏ qua click.`);
            continue;
          }
        }

        await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
        await page.click(selector, { force: true });
        await page.waitForTimeout(1000); // Stabilize UI
      }

      // Click optional tabs (e.g., Spreads, LME, ACM)
      if (optionalTabSelector) {
        this.logger.log(`Clicking optional sub-tab: ${optionalTabSelector}`);
        const tabSelector = `xpath=//a[text()='${optionalTabSelector}']`;
        await page.waitForSelector(tabSelector, { state: 'visible', timeout: 10000 });
        await page.click(tabSelector, { force: true });
        await page.waitForTimeout(2000);
      }

      // Wait for CSV download button
      const csvButtonSelector = `button.ladda-button:has(i.fa-file-csv), i.fa-file-csv, button:has(.fa-file-csv)`;
      await page.waitForSelector(csvButtonSelector, { state: 'visible', timeout: 45000 });

      // Start waiting for download event before clicking (increased to 90 seconds for heavy reports)
      const downloadPromise = page.waitForEvent('download', { timeout: 90000 });

      this.logger.log('Clicking CSV/Excel download icon...');
      await page.locator(csvButtonSelector).first().click({ force: true });

      const download = await downloadPromise;

      // Save downloaded file to target directory
      await download.saveAs(downloadPath);
      this.logger.log(`Saved report successfully to: ${downloadPath}`);

      // Optional: click parent menu again to collapse/reset menu state
      if (menuSteps.length > 0) {
        const topMenuSelector = `xpath=//a[text()='${menuSteps[0]}']`;
        await page.click(topMenuSelector, { force: true }).catch(() => { });
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
    await this.gotoAndDownload(page, '#/clientManagement/investorManagement', destFile, 'Spreads');
  }

  async downloadDSTKGDLME(page: Page, destFile: string) {
    await this.gotoAndDownload(page, '#/clientManagement/investorManagement', destFile, 'LME');
  }

  async downloadDSTKGDACM(page: Page, destFile: string) {
    await this.gotoAndDownload(page, '#/clientManagement/investorManagement', destFile, 'ACM');
  }

  async downloadQLTTTKGD(page: Page, destFile: string) {
    await this.gotoAndDownload(page, '#/clientManagement/marginStatusManagement', destFile, undefined, 180000);
  }

  async downloadDSQLKQ(page: Page, destFile: string) {
    await this.gotoAndDownload(page, '#/positionManagement/marginList', destFile);
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

      await page.click("xpath=//a[text()='QL giao dịch']").catch(() => { });
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

      await page.click("xpath=//a[text()='QL giao dịch']").catch(() => { });
      this.logger.log(`DSGD downloaded successfully to: ${destFile}`);
    } catch (err: any) {
      throw new Error(`Tải DSGD.xlsx thất bại: ${err.message}`);
    }
  }

  async downloadTTTT(page: Page, destFile: string) {
    await this.gotoAndDownload(page, '#/orderManagement/transactionList', destFile);
  }

  async downloadDSTKGDOptions(page: Page, destFile: string) {
    // TODO: Xác nhận lại tên menu chính xác trên M-System cho tab Options
    await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'], destFile, 'Options');
  }

  async downloadTTCDH(page: Page, destFile: string) {
    // TODO: Xác nhận lại đường dẫn menu hoặc hash route cho TTCDH trên M-System
    await this.navigateAndDownload(page, ['QL giao dịch', 'Tổng hợp', 'TTCDH'], destFile);
  }

  /**
   * Unified dispatcher: tải 1 file theo target key.
   * Dùng bởi FILE_AUDIT_MS job để tải bổ sung file thiếu.
   * @returns true nếu tải được, false nếu target không có method
   */
  async downloadByTarget(page: Page, target: string, destFile: string, sessionDay?: string): Promise<boolean> {
    switch (target) {
      case 'NKTTHT':
      case 'NKTHT':
        await this.downloadNKTTHT(page, destFile);
        break;
      case 'DSTKGD-Futures':
        await this.downloadDSTKGDFutures(page, destFile);
        break;
      case 'DSTKGD-Spread':
        await this.downloadDSTKGDSpread(page, destFile);
        break;
      case 'DSTKGD-LME':
        await this.downloadDSTKGDLME(page, destFile);
        break;
      case 'DSTKGD-ACM':
        await this.downloadDSTKGDACM(page, destFile);
        break;
      case 'DSTKGD-Options':
        await this.downloadDSTKGDOptions(page, destFile);
        break;
      case 'QLTKGD':
      case 'QLTTTKGD':
        await this.downloadQLTTTKGD(page, destFile);
        break;
      case 'QLTKGDAmKQ':
        await this.downloadQLTTTKGDAmKQ(page, destFile);
        break;
      case 'TLKQHSKQ':
        await this.downloadTLKQHSKQ(page, destFile);
        break;
      case 'NR':
        await this.downloadNR(page, destFile);
        break;
      case 'DSTrader':
        await this.downloadDSTrader(page, destFile);
        break;
      case 'Markettruoc6h':
        await this.downloadMarkettruoc6h(page, destFile);
        break;
      case 'DSLDK':
        await this.downloadDSLDK(page, destFile);
        break;
      case 'DSLCK':
        await this.downloadDSLCK(page, destFile);
        break;
      case 'DSLH':
        await this.downloadDSLH(page, destFile);
        break;
      case 'DSLK':
        await this.downloadDSLK(page, destFile);
        break;
      case 'DSGD':
        await this.downloadDSGD(page, destFile, sessionDay);
        break;
      case 'DSQLKQ':
        await this.downloadDSQLKQ(page, destFile);
        break;
      case 'TTM':
        await this.downloadTTM(page, destFile);
        break;
      case 'TTTT':
        await this.downloadTTTT(page, destFile);
        break;
      case 'TTCDH':
        await this.downloadTTCDH(page, destFile);
        break;
      default:
        this.logger.warn(`downloadByTarget: Không có phương thức tải cho target "${target}". Bỏ qua.`);
        return false;
    }
    return true;
  }

  async downloadTTM(page: Page, destFile: string) {
    try {
      const baseUrl = page.url().split('#')[0];
      await page.goto(`${baseUrl}#/positionManagement/openPositionInfo`);
      await page.waitForTimeout(3000);

      const possibleSelectors = [
        "xpath=//i[contains(@class, 'fa-file-excel')]",
        "xpath=//i[contains(@class, 'fa-file-csv')]",
        "xpath=//button[contains(@title, 'Export')]",
      ];

      for (const sel of possibleSelectors) {
        if (await page.locator(sel).isVisible().catch(() => false)) {
          const downloadPromise = page.waitForEvent('download');
          await page.click(sel);
          const download = await downloadPromise;
          await download.saveAs(destFile);
          this.logger.log(`TTM (Trạng thái mở) downloaded to: ${destFile}`);
          return;
        }
      }
      throw new Error('Không tìm thấy nút tải Excel/CSV trên trang Trạng thái mở');
    } catch (err: any) {
      this.logger.error(`Tải TTM (Trạng thái mở) thất bại: ${err.message}`);
      throw err;
    }
  }

  /**
   * Download eod.csv from M-System.
   * Path: QL hệ thống -> Kết quả EOD (xuất file kết quả sau khi EOD thành công)
   */
  async downloadEODCsv(page: Page, destFile: string) {
    try {
      this.logger.log('Navigating to QL hệ thống -> Kết quả EOD...');

      // Try direct navigation to EOD result page via hash routing
      const currentUrl = page.url();
      const baseUrl = currentUrl.split('#')[0];

      // Common M-System EOD result paths
      const eodPaths = [
        '#/systemManagement/eodResult',
        '#/systemManagement/eod',
        '#/eodManagement/eodResult',
      ];

      let downloaded = false;
      for (const hashPath of eodPaths) {
        try {
          await page.goto(`${baseUrl}${hashPath}`);
          await page.waitForTimeout(2000);

          const csvBtn = page.locator("xpath=//i[contains(@class, 'fa-file-csv')]");
          if (await csvBtn.isVisible().catch(() => false)) {
            const downloadPromise = page.waitForEvent('download');
            await csvBtn.click();
            const download = await downloadPromise;
            await download.saveAs(destFile);
            this.logger.log(`eod.csv downloaded to: ${destFile}`);
            downloaded = true;
            break;
          }
        } catch { }
      }

      if (!downloaded) {
        // Fallback: try menu navigation QL hệ thống
        await page.click("xpath=//a[text()='QL hệ thống']").catch(() => { });
        await page.waitForTimeout(1000);

        const eodMenuSelectors = [
          "xpath=//a[contains(text(),'EOD')]",
          "xpath=//a[contains(text(),'Kết quả EOD')]",
          "xpath=//a[contains(text(),'End of Day')]",
        ];
        for (const sel of eodMenuSelectors) {
          if (await page.locator(sel).isVisible().catch(() => false)) {
            await page.click(sel);
            await page.waitForTimeout(2000);
            const csvBtn = page.locator("xpath=//i[contains(@class, 'fa-file-csv')]");
            if (await csvBtn.isVisible().catch(() => false)) {
              const downloadPromise = page.waitForEvent('download');
              await csvBtn.click();
              const download = await downloadPromise;
              await download.saveAs(destFile);
              this.logger.log(`eod.csv downloaded (fallback) to: ${destFile}`);
              downloaded = true;
              break;
            }
          }
        }
      }

      if (!downloaded) {
        const debugDir = path.join(process.cwd(), 'temp', 'debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot({ path: path.join(debugDir, `eod-csv-debug-${ts}.png`), fullPage: true }).catch(() => { });
        throw new Error('Không tìm thấy nút tải EOD CSV. Đã lưu debug screenshot tại temp/debug/.');
      }
    } catch (err: any) {
      throw new Error(`Tải eod.csv thất bại: ${err.message}`);
    }
  }

  /**
   * Full pipeline: Login M-System, download QLTKGD + TTTT + EOD files,
   * save to temp/reconciliation/<date>/ directory. Returns file paths.
   */
  async downloadReconciliationFiles(targetDate?: string): Promise<{
    qltkgdPath: string;
    ttttPath: string;
    eodPath: string;
    downloadDir: string;
  }> {
    const dateStr = targetDate || new Date().toISOString().split('T')[0];
    const downloadDir = path.join(process.cwd(), 'temp', 'reconciliation', dateStr);
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const qltkgdPath = path.join(downloadDir, 'QLTKGD.xlsx');
    const ttttPath = path.join(downloadDir, 'TTTT.xlsx');
    const eodPath = path.join(downloadDir, `eod.${dateStr}.csv`);

    this.logger.log(`Starting reconciliation file download for date: ${dateStr}`);
    this.logger.log(`Target directory: ${downloadDir}`);

    const { browser, page } = await this.loginMSystem(downloadDir);

    try {
      // 1. Download QLTKGD.xlsx (QL khách hàng -> QL TKGD -> QL TT TKGD)
      this.logger.log('Step 1/3: Downloading QLTKGD.xlsx...');
      await this.downloadQLTTTKGD(page, qltkgdPath);

      // 2. Download TTTT.xlsx (QL giao dịch -> Danh sách giao dịch)
      this.logger.log('Step 2/3: Downloading TTTT.xlsx...');
      await this.downloadTTTT(page, ttttPath);

      // 3. Download eod.csv (QL hệ thống -> Kết quả EOD)
      this.logger.log('Step 3/3: Downloading eod.csv...');
      await this.downloadEODCsv(page, eodPath);

      this.logger.log('All reconciliation files downloaded successfully!');
    } finally {
      await browser.close();
    }

    return { qltkgdPath, ttttPath, eodPath, downloadDir };
  }

  // =========================================================================
  // GTT CHECK METHODS
  // =========================================================================

  /**
   * Download market.csv (Bảng giá) from M-System orderCreating page.
   * Returns the browser so the caller can close it.
   * The CSV is saved to: <downloadDir>/market.csv
   *
   * NOTE: Selector debug guide - if download fails, check:
   *   1. Is the download button a CSV icon? Look for: i.fa-file-csv, button[title*='csv'], a[href*='.csv']
   *   2. Run `npm.cmd run test:ms-login` with headless:false and navigate to orderCreating manually.
   */
  async downloadMarketCsv(downloadDir: string): Promise<{ browser: Browser; filePath: string }> {
    const { browser, page } = await this.loginMSystem(downloadDir);

    try {
      this.logger.log('Navigating to orderCreating page for market.csv download...');

      // Navigate to the bảng giá / order creating page
      // Try direct hash navigation first
      const currentUrl = page.url();
      const baseUrl = currentUrl.split('#')[0];
      await page.goto(`${baseUrl}#/orderManagement/orderCreating`);
      await page.waitForTimeout(3000);

      // Try to find CSV download button (common patterns in M-System)
      const possibleCsvSelectors = [
        "xpath=//i[contains(@class, 'fa-file-csv')]",
        "xpath=//button[contains(@title, 'CSV')]",
        "xpath=//button[contains(@title, 'csv')]",
        "xpath=//a[contains(@href, '.csv')]",
        "xpath=//button[contains(text(), 'CSV')]",
        "xpath=//i[contains(@class, 'fa-download')]",
      ];

      let csvBtnFound = false;
      for (const sel of possibleCsvSelectors) {
        const btn = page.locator(sel);
        if (await btn.isVisible().catch(() => false)) {
          this.logger.log(`Found CSV download button with selector: ${sel}`);
          const savePath = path.join(downloadDir, 'market.csv');
          const downloadPromise = page.waitForEvent('download');
          await btn.click();
          const download = await downloadPromise;
          await download.saveAs(savePath);
          this.logger.log(`market.csv downloaded to: ${savePath}`);
          csvBtnFound = true;
          return { browser, filePath: savePath };
        }
      }

      if (!csvBtnFound) {
        // Save debug info for selector analysis
        const debugDir = path.join(process.cwd(), 'temp', 'debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot({ path: path.join(debugDir, `market-csv-page-${ts}.png`), fullPage: true }).catch(() => { });
        const html = await page.content().catch(() => '');
        fs.writeFileSync(path.join(debugDir, `market-csv-page-${ts}.html`), html, 'utf8');
        throw new Error('Không tìm thấy nút tải CSV trên trang Bảng giá. Đã lưu debug screenshot tại temp/debug/.');
      }

      return { browser, filePath: '' };
    } catch (err: any) {
      await browser.close();
      throw new Error(`downloadMarketCsv thất bại: ${err.message}`);
    }
  }

  /**
   * Login to CQG as mxvprice, open Quote Spreadsheet, search symbol list,
   * and scrape the Settlement Price (column S) for each contract.
   *
   * Returns a Map<symbol, settlementPrice>
   *
   * NOTE: This method handles the CQG 100-symbol limit by batching into groups.
   * Settlement price column: based on the CQG Quote Spreadsheet screenshot,
   * the 'S' column represents Settlement price.
   */
  async fetchCQGSettlementPrices(symbols: string[]): Promise<Map<string, number>> {
    if (!symbols || symbols.length === 0) {
      return new Map();
    }

    const tempDir = path.join(process.cwd(), 'temp', 'gtt');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const { browser, page } = await this.loginCQG(tempDir);
    const result = new Map<string, number>();

    try {
      // CQG limits 100 symbols per Quote Spreadsheet list, batch accordingly
      const BATCH_SIZE = 95; // Leave some margin
      const batches: string[][] = [];
      for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
        batches.push(symbols.slice(i, i + BATCH_SIZE));
      }

      this.logger.log(`Fetching GTT from CQG for ${symbols.length} symbols in ${batches.length} batch(es)...`);

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        this.logger.log(`Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} symbols)...`);

        // Open a new Quote Spreadsheet tab
        await this.openCQGQuoteSpreadsheet(page);

        // Add symbols to the new list
        await this.addSymbolsToCQGList(page, batch);

        // Read settlement prices from the spreadsheet
        const batchResult = await this.readCQGSettlementColumn(page, batch);
        for (const [sym, price] of batchResult) {
          result.set(sym, price);
        }

        this.logger.log(`Batch ${batchIdx + 1} done. Got ${batchResult.size} prices.`);
      }
    } finally {
      await browser.close();
    }

    this.logger.log(`CQG GTT fetch complete. Total prices obtained: ${result.size}`);
    return result;
  }

  /**
   * Open a new Quote Spreadsheet tab in CQG Desktop.
   * Steps: Click "+" top right → Quotes → Quote Spreadsheet
   */
  private async openCQGQuoteSpreadsheet(page: Page): Promise<void> {
    this.logger.log('Opening new CQG Quote Spreadsheet tab...');

    // Click the "+" (Add tab) button at the top right
    await page.waitForSelector('button.wpfe-desktop-toolbar-add-tab, [class*="add-tab"], [title*="Add"]', {
      state: 'visible',
      timeout: 15000,
    });
    await page.click('button.wpfe-desktop-toolbar-add-tab, [class*="add-tab"], [title*="Add"]');
    await page.waitForTimeout(1000);

    // Click "Quotes" in the left panel of the "Add tab" dialog
    const quotesSelector = 'text=Quotes';
    await page.waitForSelector(quotesSelector, { state: 'visible', timeout: 10000 });
    await page.click(quotesSelector);
    await page.waitForTimeout(500);

    // Click "Quote Spreadsheet" in the right panel
    const qssSelector = 'text=Quote spreadsheet';
    await page.waitForSelector(qssSelector, { state: 'visible', timeout: 10000 });
    await page.click(qssSelector);
    await page.waitForTimeout(2000);

    this.logger.log('Quote Spreadsheet tab opened.');
  }

  /**
   * In the newly opened Quote Spreadsheet, click "New List" and add symbols.
   */
  private async addSymbolsToCQGList(page: Page, symbols: string[]): Promise<void> {
    this.logger.log(`Adding ${symbols.length} symbols to CQG Quote Spreadsheet list...`);

    // Click "New list..." button or "Open a list" button
    const newListBtn = page.locator('button:has-text("New list"), button:has-text("New List")');
    if (await newListBtn.isVisible().catch(() => false)) {
      await newListBtn.click();
      await page.waitForTimeout(1000);
    }

    // The search symbol input field
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="symbol"], input[placeholder*="Symbol"]');
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });

    // Type symbols comma-separated (CQG accepts comma-separated list)
    const symbolStr = symbols.join(', ');
    this.logger.log(`Entering symbol list: ${symbolStr.substring(0, 100)}...`);
    await searchInput.fill(symbolStr);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000); // Wait for symbols to load

    this.logger.log('Symbols entered and submitted.');
  }

  /**
   * Read the settlement price ('S' column) from CQG Quote Spreadsheet rows.
   * Returns Map<symbol, settlementPrice>
   */
  private async readCQGSettlementColumn(page: Page, expectedSymbols: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    this.logger.log('Reading settlement prices from CQG Quote Spreadsheet...');

    // Wait for the data rows to be populated
    await page.waitForTimeout(5000); // Give CQG time to load prices

    // Try to read row data from the quote spreadsheet table
    // CQG Quote Spreadsheet rows typically have cells with symbol and price data
    const rows = await page.$$('tr[class*="row"], div[class*="row"][class*="quote"]').catch(() => []);

    if (rows.length > 0) {
      for (const row of rows) {
        try {
          // Each row: Symbol cell + Settlement cell
          const cells = await row.$$('td, div[class*="cell"]');
          if (cells.length < 2) continue;

          const symbolText = (await cells[0].textContent() || '').trim().toUpperCase();
          // Settlement price is typically the last or specific index column
          // Based on CQG screenshot: columns are Symbol, T, B, A, ΔT, S
          // S column = index 5 (0-based)
          const settlementIdx = Math.min(5, cells.length - 1);
          const settlementText = (await cells[settlementIdx].textContent() || '').trim().replace(/,/g, '');
          const price = parseFloat(settlementText);

          if (symbolText && !isNaN(price) && price > 0) {
            result.set(symbolText, price);
          }
        } catch { }
      }
    }

    if (result.size === 0) {
      // Fallback: save debug screenshot for manual analysis
      const debugDir = path.join(process.cwd(), 'temp', 'debug');
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      await page.screenshot({ path: path.join(debugDir, `cqg-qss-${ts}.png`), fullPage: true }).catch(() => { });
      const html = await page.content().catch(() => '');
      fs.writeFileSync(path.join(debugDir, `cqg-qss-${ts}.html`), html, 'utf8');
      this.logger.warn(`Không đọc được giá từ CQG QSS. Debug screenshot lưu tại temp/debug/cqg-qss-${ts}.png`);
    }

    return result;
  }
}
