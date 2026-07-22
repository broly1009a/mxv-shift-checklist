import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
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
    if (process.platform !== 'win32') {
      return null;
    }
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
   * Helper to scan page for Ant Design or Bootstrap/custom login errors.
   */
  private async checkForLoginErrors(page: Page): Promise<string | null> {
    try {
      // 1. Check Ant Design notification message
      const noticeDesc = page.locator('.ant-notification-notice-description, .ant-notification-notice-message');
      const count = await noticeDesc.count().catch(() => 0);
      if (count > 0) {
        const textList: string[] = [];
        for (let i = 0; i < count; i++) {
          const text = await noticeDesc.nth(i).innerText().catch(() => '');
          if (text.trim()) textList.push(text.trim());
        }
        if (textList.length > 0) {
          return `Thông báo lỗi hệ thống: ${textList.join(' | ')}`;
        }
      }

      // 2. Check Ant Design message alert
      const msgContent = page.locator('.ant-message-custom-content, .ant-message');
      const msgCount = await msgContent.count().catch(() => 0);
      if (msgCount > 0) {
        const textList: string[] = [];
        for (let i = 0; i < msgCount; i++) {
          const text = await msgContent.nth(i).innerText().catch(() => '');
          if (text.trim()) textList.push(text.trim());
        }
        if (textList.length > 0) {
          return `Thông báo từ trang web: ${textList.join(' | ')}`;
        }
      }

      // 3. Check inline form explain errors (username/password validation)
      const formExplain = page.locator('.ant-form-item-explain-error');
      const explainCount = await formExplain.count().catch(() => 0);
      if (explainCount > 0) {
        const textList: string[] = [];
        for (let i = 0; i < explainCount; i++) {
          const text = await formExplain.nth(i).innerText().catch(() => '');
          if (text.trim()) textList.push(text.trim());
        }
        if (textList.length > 0) {
          return `Lỗi nhập liệu form: ${textList.join(' | ')}`;
        }
      }

      // 4. General alert components
      const alerts = page.locator('.ant-alert-message, .ant-alert-description');
      const alertCount = await alerts.count().catch(() => 0);
      if (alertCount > 0) {
        const textList: string[] = [];
        for (let i = 0; i < alertCount; i++) {
          const text = await alerts.nth(i).innerText().catch(() => '');
          if (text.trim()) textList.push(text.trim());
        }
        if (textList.length > 0) {
          return `Cảnh báo: ${textList.join(' | ')}`;
        }
      }

      // 5. Bootstrap/General login error alert
      const generalAlerts = page.locator('.alert-danger, .error-message, #error-msg');
      const genAlertCount = await generalAlerts.count().catch(() => 0);
      if (genAlertCount > 0) {
        const text = await generalAlerts.first().innerText().catch(() => '');
        if (text.trim()) {
          return `Lỗi đăng nhập: ${text.trim()}`;
        }
      }

      return null;
    } catch (e: any) {
      this.logger.error(`Lỗi khi quét thông tin lỗi đăng nhập trên trang: ${e.message}`);
      return null;
    }
  }

  /**
   * Launches browser and logs in to M-System. Returns the browser and authenticated page.
   */
  async loginMSystem(downloadDir: string, overrideUrl?: string): Promise<{ browser: Browser; page: Page }> {
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

    const msystemUrl = overrideUrl || credentials.url || 'https://msystem.mxv.vn/';
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
      headless: process.env.HEADLESS_BOT !== 'false',
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

        const loginError = await this.checkForLoginErrors(page);
        if (loginError) {
          throw new Error(`Đăng nhập thất bại. ${loginError}`);
        }

        this.logger.warn(`Chưa hiển thị bảng PIN (lần thử ${attempt}), thử click lại nút Đăng nhập...`);
        await page.click('button.btn-primary').catch(() => { });
        await page.waitForTimeout(2000);
      }

      if (!pinSelectorVisible) {
        const loginError = await this.checkForLoginErrors(page);
        if (loginError) {
          throw new Error(`Đăng nhập M-System thất bại: ${loginError}`);
        }
        throw new Error('Đăng nhập thất bại: Không thấy bảng mã PIN (div.pincode) xuất hiện. Nguyên nhân có thể do M-System phản hồi chậm (>20s), sai tài khoản/mật khẩu hoặc mạng bị tắc nghẽn.');
      }

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
      if (overrideUrl) {
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => {});
      } else {
        await page.waitForSelector('xpath=.//div[contains(text(),"Ngày phiên hiện tại:")]', {
          state: 'visible',
          timeout: 15000,
        });
      }

      this.logger.log('Login M-System SUCCESSFUL.');
      return { browser, page };
    } catch (err: any) {
      this.logger.error(`Đăng nhập MSystem thất bại: ${err.message}`);

      let extractedError = '';
      try {
        if (page && !page.isClosed()) {
          const loginErr = await this.checkForLoginErrors(page);
          if (loginErr) extractedError = ` | Chi tiết từ web: ${loginErr}`;
        }
      } catch {}

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

        const logContent = `Time: ${new Date().toISOString()}\nURL: ${msystemUrl}\nUsername: ${username}\nError: ${err.message}${extractedError}\nStack: ${err.stack}\n`;
        fs.writeFileSync(txtPath, logContent, 'utf8');

        if (page && !page.isClosed()) {
          await page.screenshot({ path: pngPath, fullPage: true, timeout: 5000 }).catch(() => { });
          const html = await page.content().catch(() => '');
          if (html) {
            fs.writeFileSync(htmlPath, html, 'utf8');
          }
        }
        this.logger.warn(`Đã lưu log lỗi và ảnh chụp màn hình debug tại: ${debugDir}`);
      } catch (logErr: any) {
        this.logger.error(`Không thể tạo file log lỗi debug: ${logErr.message}`);
      }

      try {
        await browser.close();
      } catch {}
      throw new Error(`${err.message}${extractedError}`);
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
    try {
      await this.gotoAndDownload(page, '#/systemManagement/auditLog', destFile);
    } catch (err) {
      this.logger.warn(`gotoAndDownload hash navigation failed for NKTTHT, falling back to navigateAndDownload: ${err}`);
      await this.navigateAndDownload(page, ['QL hệ thống', 'Thông tin chung', 'Nhật ký thao tác hệ thống'], destFile);
    }
  }

  async downloadDSTKGDFutures(page: Page, destFile: string) {
    try {
      await this.gotoAndDownload(page, '#/clientManagement/investorManagement', destFile);
    } catch (err) {
      this.logger.warn(`gotoAndDownload hash navigation failed for DSTKGDFutures, falling back to navigateAndDownload: ${err}`);
      await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'], destFile);
    }
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
    try {
      await this.gotoAndDownload(page, '#/clientManagement/transactionHistory', destFile);
    } catch (err) {
      this.logger.warn(`gotoAndDownload hash navigation failed for NR, falling back to navigateAndDownload: ${err}`);
      await this.navigateAndDownload(page, ['QL khách hàng', 'QL TKGD', 'Lịch sử giao dịch tiền TKGD'], destFile);
    }
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
   * Navigates to M-System Admin automaticEmailSMSConfig, selects 'Danh sách gửi EMAIL' tab,
   * clicks Export Excel, and returns the downloaded file path.
   */
  async downloadEmailHistoryReport(downloadDir: string, targetDate?: string): Promise<string> {
    const adminUrl = 'https://msadmin.mxv.com.vn/';
    const { browser, page } = await this.loginMSystem(downloadDir, adminUrl);

    try {
      this.logger.log('Navigating to automaticEmailSMSConfig page...');
      await page.goto('https://msadmin.mxv.com.vn/#/systemManagement/automaticEmailSMSConfig');
      await page.waitForTimeout(3000);

      this.logger.log('Selecting Tab: Danh sách gửi EMAIL...');
      const tabSelector = page.locator('.ant-tabs-tab-btn').filter({ hasText: /Danh sách gửi EMAIL/i }).first();
      await tabSelector.waitFor({ state: 'visible', timeout: 10000 });
      await tabSelector.click();
      await page.waitForTimeout(3000);

      /*
      // NOTE: Tạm thời đóng phần tự động lọc ngày (RangePicker) để đồng bộ với các tác vụ khác.
      // Do nghiệp vụ rất ít khi quên đóng ca (hoặc có gửi bù thì đối soát thủ công).
      // Khi cần mở lại đối chiếu lịch sử ca cũ tự động, chỉ cần uncomment đoạn code dưới đây.
      if (targetDate) {
        this.logger.log(`Checking if date filtering is needed for targetDate: ${targetDate}`);
        let formattedDate = '';
        if (targetDate.includes('-')) {
          const parts = targetDate.split('-');
          if (parts.length === 3) {
            formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }

        if (formattedDate) {
          this.logger.log(`Filtering by date: ${formattedDate}`);
          
          const startInput = page.locator('.ant-tabs-tabpane-active input[placeholder="Ngày bắt đầu"]').first();
          const endInput = page.locator('.ant-tabs-tabpane-active input[placeholder="Ngày kết thúc"]').first();

          if (await startInput.isVisible().catch(() => false) && await endInput.isVisible().catch(() => false)) {
            this.logger.log('Detected Ant Design RangePicker (Ngày bắt đầu -> Ngày kết thúc)');
            
            this.logger.log(`Filling Start Date: ${formattedDate}`);
            await startInput.click().catch(() => {});
            await page.keyboard.press('Control+A').catch(() => {});
            await page.keyboard.press('Backspace').catch(() => {});
            await page.keyboard.type(formattedDate).catch(() => {});
            await page.keyboard.press('Enter').catch(() => {});
            await page.waitForTimeout(500);

            this.logger.log(`Filling End Date: ${formattedDate}`);
            await endInput.click().catch(() => {});
            await page.keyboard.press('Control+A').catch(() => {});
            await page.keyboard.press('Backspace').catch(() => {});
            await page.keyboard.type(formattedDate).catch(() => {});
            await page.keyboard.press('Enter').catch(() => {});
            await page.keyboard.press('Escape').catch(() => {});
            
            this.logger.log('Waiting 3s for filter query to reload table...');
            await page.waitForTimeout(3000);
          } else {
            const dateInputs = page.locator('.ant-tabs-tabpane-active .ant-picker input, .ant-tabs-tabpane-active .ant-calendar-picker input');
            const inputCount = await dateInputs.count().catch(() => 0);

            if (inputCount > 0) {
              for (let i = 0; i < inputCount; i++) {
                const input = dateInputs.nth(i);
                if (await input.isVisible().catch(() => false)) {
                  await input.click().catch(() => {});
                  await page.keyboard.press('Control+A').catch(() => {});
                  await page.keyboard.press('Backspace').catch(() => {});
                  await page.keyboard.type(formattedDate).catch(() => {});
                  await page.keyboard.press('Enter').catch(() => {});
                  await page.waitForTimeout(500);
                }
              }

              const searchBtn = page.locator('.ant-tabs-tabpane-active button').filter({ hasText: /Tìm kiếm|Tìm|Search/i }).first();
              if (await searchBtn.isVisible().catch(() => false)) {
                this.logger.log('Clicking Search button...');
                await searchBtn.click();
                await page.waitForTimeout(3000);
              }
            } else {
              this.logger.log('No date inputs found in the active tab pane.');
            }
          }
        }
      }
      */

      this.logger.log('Locating Export button...');
      const possibleExportSelectors = [
        "button:has(i.fa-file-csv)",
        "button.btn-ghost-primary:has(i.fa-file-csv)",
        "button.ladda-button:has(i.fa-file-csv)",
        "xpath=//button[contains(., 'Xuất excel')]",
        "xpath=//button[contains(., 'Xuất file')]",
        "xpath=//button[contains(., 'Xuất')]",
        "xpath=//button[contains(., 'Export')]",
        "button.ant-btn-primary:has-text('Xuất')",
        "button:has-text('Xuất')",
        "button:has-text('Export')"
      ];

      let exportBtn = null;
      for (const sel of possibleExportSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible().catch(() => false)) {
          exportBtn = btn;
          this.logger.log(`Found Export button with selector: ${sel}`);
          break;
        }
      }

      if (!exportBtn) {
        const panelBtn = page.locator('.ant-tabs-tabpane-active button').first();
        if (await panelBtn.isVisible().catch(() => false)) {
          exportBtn = panelBtn;
          this.logger.log('Found fallback button in active tab panel.');
        }
      }

      if (!exportBtn) {
        throw new Error('Không tìm thấy nút Xuất Excel trên màn hình Danh sách gửi EMAIL.');
      }

      this.logger.log('Clicking Export button and waiting for download...');
      const filePath = path.join(downloadDir, `lich-su-gui-email-sms-${Date.now()}.xlsx`);
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        exportBtn.click()
      ]);

      await download.saveAs(filePath);
      this.logger.log(`Downloaded email history report to: ${filePath}`);
      return filePath;
    } catch (err: any) {
      this.logger.error(`Lỗi tải báo cáo lịch sử email: ${err.message}`);
      try {
        const debugDir = path.join(process.cwd(), 'temp', 'debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot({ path: path.join(debugDir, `email-history-err-${ts}.png`), fullPage: true }).catch(() => {});
        const html = await page.content().catch(() => '');
        fs.writeFileSync(path.join(debugDir, `email-history-err-${ts}.html`), html, 'utf8');
      } catch (logErr) {}
      throw err;
    } finally {
      await browser.close();
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

  /**
   * Giải quyết Captcha dạng hình ảnh sử dụng Google Gemini 1.5 Flash API.
   * Chạy nhanh, chính xác cao và hoàn toàn miễn phí dưới ngưỡng 15 RPM.
   */
  async solveCaptchaWithGemini(base64Image: string, apiKey: string, jobLogs: string[] = []): Promise<string> {
    const log = (msg: string) => {
      this.logger.log(msg);
      jobLogs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log('Đang gửi ảnh Captcha lên Gemini API (gemini-flash-latest)...');
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Read the characters in this image. It is a captcha code. Output ONLY the raw characters (case-sensitive, no spaces, no punctuation, no bold, no explanation). Example output: EBGPG',
                  },
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const solvedCode = text ? text.replace(/\s/g, '') : '';
      log(`Nhận diện Captcha từ Gemini thành công: "${solvedCode}"`);
      return solvedCode;
    } catch (err: any) {
      log(`Lỗi khi gọi Gemini API: ${err.message}`);
      throw err;
    }
  }

  /**
   * Khởi chạy trình duyệt và đăng nhập vào ACM.
   * Tự động giải captcha bằng Gemini API. Nếu lỗi, có cơ chế fallback nhập tay qua giao diện.
   */
  async loginACM(
    downloadDir: string,
    getCaptchaFromUI?: (base64Img: string) => Promise<string>,
    jobLogs: string[] = [],
  ): Promise<{ browser: Browser; page: Page }> {
    const log = (msg: string) => {
      this.logger.log(msg);
      jobLogs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    // 1. Lấy thông tin đăng nhập
    const credentialsRaw = await this.settingsService.getSetting('bot_credentials_acm', '');
    if (!credentialsRaw) {
      throw new Error('Chưa cấu hình tài khoản ACM trong cài đặt hệ thống.');
    }

    let credentials: any;
    try {
      credentials = JSON.parse(decrypt(credentialsRaw));
    } catch (err) {
      throw new Error('Không thể giải mã cấu hình tài khoản ACM. Vui lòng cấu hình lại.');
    }

    const acmUrl = credentials.url || 'https://acm.etp.alphaliongroup.com/exchange/index.html#/login';
    const { username, password, geminiApiKey } = credentials;

    if (!username || !password) {
      throw new Error('Thông tin đăng nhập ACM (username, password) không đầy đủ.');
    }

    // 2. Khởi tạo trình duyệt
    const executablePath = this.getChromeExecutablePath();
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--window-size=1280,800',
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    log('Khởi tạo phiên trình duyệt Playwright...');
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    page.setDefaultTimeout(30000);

    try {
      log(`Truy cập trang đăng nhập ACM: ${acmUrl}`);
      await page.goto(acmUrl);
      await page.waitForTimeout(2000);

      // Định nghĩa các selector tìm kiếm thông minh
      const usernameSelectors = [
        'input[placeholder="Username"]',
        'input[name="username"]',
        'input[placeholder*="user" i]',
        'input[placeholder*="tài khoản" i]',
        'input[type="text"]',
      ];
      const passwordSelectors = [
        'input[placeholder="Password"]',
        'input[name="password"]',
        'input[type="password"]',
        'input[placeholder*="pass" i]',
        'input[placeholder*="mật khẩu" i]',
      ];
      const captchaInputSelectors = [
        'input[placeholder="Captcha"]',
        'input[name="captcha"]',
        'input[placeholder*="captcha" i]',
        'input[placeholder*="mã xác nhận" i]',
        'input[placeholder*="mã bảo mật" i]',
      ];
      const captchaImgSelectors = [
        '.login-captcha img',
        'img[src*="captcha" i]',
        'img[src*="code" i]',
        'img.captcha',
        'img#captcha-img',
        'img#captcha',
      ];
      const loginBtnSelectors = [
        '.el-button--primary',
        'button:has-text("Login")',
        'button[type="submit"]',
        'button:has-text("Đăng nhập")',
        'input[type="submit"]',
        'input.btn-primary',
      ];

      // Hàm tìm selector visible
      const findSelector = async (selectors: string[]): Promise<string> => {
        for (const sel of selectors) {
          const isVis = await page.locator(sel).first().isVisible().catch(() => false);
          if (isVis) return sel;
        }
        return selectors[0];
      };

      const userSel = await findSelector(usernameSelectors);
      const passSel = await findSelector(passwordSelectors);
      const capInputSel = await findSelector(captchaInputSelectors);
      const capImgSel = await findSelector(captchaImgSelectors);
      const btnSel = await findSelector(loginBtnSelectors);

      log(`Điền thông tin tài khoản: ${username}`);
      await page.fill(userSel, username);
      await page.fill(passSel, password);

      // Vòng lặp giải captcha (tối đa 4 lần thử reload)
      const maxCaptchaAttempts = 4;
      for (let attempt = 1; attempt <= maxCaptchaAttempts; attempt++) {
        log(`[Lần thử đăng nhập ${attempt}/${maxCaptchaAttempts}] Bắt đầu xử lý Captcha...`);

        // Đợi ảnh captcha hiển thị
        await page.waitForSelector(capImgSel, { state: 'visible', timeout: 10000 });
        const captchaElement = page.locator(capImgSel).first();

        // Chụp ảnh thẻ captcha dưới dạng base64
        const imgBuffer = await captchaElement.screenshot({ type: 'png' });
        const base64Image = imgBuffer.toString('base64');

        let captchaText = '';
        if (geminiApiKey && geminiApiKey.trim() !== '') {
          try {
            captchaText = await this.solveCaptchaWithGemini(base64Image, geminiApiKey, jobLogs);
          } catch (err: any) {
            log(`Giải tự động bằng Gemini lỗi: ${err.message}. Chuyển sang cơ chế dự phòng...`);
          }
        }

        // Dự phòng: đẩy lên giao diện checklist bắt gõ tay
        if (!captchaText && getCaptchaFromUI) {
          log('Chuyển sang luồng nhập tay (Human-in-the-loop). Đang chờ người dùng nhập mã từ UI...');
          captchaText = await getCaptchaFromUI(base64Image);
        }

        if (!captchaText) {
          throw new Error('Không giải được Captcha (cả Gemini và nhập tay đều không có kết quả).');
        }

        log(`Nhập mã Captcha: "${captchaText}"`);
        await page.fill(capInputSel, captchaText);
        await page.waitForTimeout(500);

        log('Bấm nút đăng nhập...');
        await page.click(btnSel);
        await page.waitForTimeout(3000);

        // Kiểm tra xem đăng nhập thành công chưa bằng cách check sự biến mất của ô login hoặc xuất hiện trang dashboard
        const isStillOnLogin = await page.locator(userSel).isVisible().catch(() => false);
        if (!isStillOnLogin) {
          log('Đăng nhập ACM thành công!');
          return { browser, page };
        }

        // Lấy thông báo lỗi nếu còn ở màn hình login
        const errorText = await page
          .evaluate(() => {
            const errEl = document.querySelector(
              '.alert-danger, .error-message, .alert, span.error, div[style*="red"]',
            );
            return errEl ? errEl.textContent?.trim() : '';
          })
          .catch(() => '');

        log(`Đăng nhập thất bại. Thông báo lỗi: "${errorText || 'Sai mã captcha hoặc thông tin tài khoản'}"`);

        if (attempt === maxCaptchaAttempts) {
          throw new Error(
            `Đăng nhập ACM thất bại sau ${maxCaptchaAttempts} lần thử. Lỗi: ${errorText || 'Sai mã captcha'}`,
          );
        }

        // Reload captcha ảnh
        log('Đang tải lại mã Captcha mới để giải lại...');
        await captchaElement.click().catch(() => {});
        await page.waitForTimeout(1500);
      }

      throw new Error('Không thể đăng nhập ACM.');
    } catch (err: any) {
      log(`Lỗi đăng nhập ACM: ${err.message}`);
      await browser.close().catch(() => {});
      throw err;
    }
  }

  /**
   * Tải các file báo cáo tự doanh (Order & Fill) từ ACM về thư mục hàng ngày.
   */
  async downloadAcmBackup(page: Page, dailyPath: string, jobLogs: string[] = []): Promise<void> {
    const log = (msg: string) => {
      this.logger.log(msg);
      jobLogs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    const orderFile = path.join(dailyPath, 'Order.xlsx');
    const fillFile = path.join(dailyPath, 'Fill.xlsx');

    log('Bắt đầu tải Báo cáo Order...');
    await this.downloadAcmReport(
      page,
      orderFile,
      'https://acm.etp.alphaliongroup.com/exchange/index.html#/business-tetporder',
      jobLogs,
    );

    log('Bắt đầu tải Báo cáo Fill (Trade)...');
    await this.downloadAcmReport(
      page,
      fillFile,
      'https://acm.etp.alphaliongroup.com/exchange/index.html#/business-tetptrade',
      jobLogs,
    );
  }

  /**
   * Helper tải một báo cáo ACM cụ thể từ URL.
   */
  async downloadAcmReport(
    page: Page,
    destFile: string,
    url: string,
    jobLogs: string[] = [],
  ): Promise<void> {
    const log = (msg: string) => {
      this.logger.log(msg);
      jobLogs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(`Điều hướng đến trang tải báo cáo: ${url}`);
    await page.goto(url);
    await page.waitForTimeout(3000); // Đợi tải dữ liệu ban đầu

    const exportBtnSelector =
      '.el-button--info:has-text("Export"), button:has-text("Export"), button:has-text("Download")';
    log(`Đang tìm kiếm nút Export bằng selector: "${exportBtnSelector}"...`);

    // Đợi selector xuất hiện
    await page.waitForSelector(exportBtnSelector, { state: 'visible', timeout: 15000 }).catch(() => {});

    const btn = page.locator(exportBtnSelector).first();
    const isVisible = await btn.isVisible().catch(() => false);

    if (!isVisible) {
      log(`Không tìm thấy nút Export tại URL: ${url}. Thử tìm nút thay thế...`);
      const fallbackBtn = page
        .locator(
          'button:has-text("Nano"), a:has-text("Nano"), button:has-text("Tải"), a:has-text("Tải"), button:has-text("Export"), a:has-text("Export")',
        )
        .first();
      const fallbackVis = await fallbackBtn.isVisible().catch(() => false);
      if (fallbackVis) {
        log('Tìm thấy nút tải thay thế, click...');
        const downloadPromise = page.waitForEvent('download');
        await fallbackBtn.click();
        const download = await downloadPromise;
        await download.saveAs(destFile);
        log(`Tải file thành công: ${destFile}`);
        return;
      }
      throw new Error(`Không tìm thấy nút Export hoặc Download tại trang ${url}`);
    }

    log('Kích hoạt click xuất file báo cáo...');
    const downloadPromise = page.waitForEvent('download');
    await btn.click();
    const download = await downloadPromise;
    await download.saveAs(destFile);
    log(`Tải và lưu file thành công: ${destFile}`);
  }

  /**
   * Đồng bộ các file dump/log từ SFTP sử dụng thư viện ssh2 (Chạy đa nền tảng Windows/Linux).
   */
  async downloadAcmSftpBackup(dailyPath: string, targetDate: Date, jobLogs: string[] = []): Promise<void> {
    const log = (msg: string) => {
      this.logger.log(msg);
      jobLogs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    const credentialsRaw = await this.settingsService.getSetting('bot_credentials_acm', '');
    let credentials: any = {};
    if (credentialsRaw) {
      try {
        credentials = JSON.parse(decrypt(credentialsRaw));
      } catch (err) {}
    }

    const sftpHost = credentials.sftpHost || 'sftp.mxv.com.vn';
    const sftpPort = parseInt(credentials.sftpPort || '2231', 10);
    const sftpUsername = credentials.sftpUsername || 'testuser';
    const sftpPassword = credentials.sftpPassword || 'Test@2o26';
    const sftpRemoteDir = credentials.sftpRemoteDir || '/data/';

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const ddmmyyyy = `${day}${month}${year}`;
    const yyyy_mm_dd = `${year}-${month}-${day}`;

    // Tải file CSV kết thúc bằng _ddmmyyyy.csv và file XLS bắt đầu bằng yyyy-mm-dd_
    const csvSuffix = `_${ddmmyyyy}.csv`;
    const xlsPrefix = `${yyyy_mm_dd}_`;

    log(`Kết nối SFTP tới sftp://${sftpUsername}@${sftpHost}:${sftpPort}...`);

    const { Client } = require('ssh2');
    const conn = new Client();

    return new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        log('Kết nối SSH thành công. Đang mở subsystem SFTP...');
        conn.sftp((err: any, sftp: any) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          log(`Đọc thư mục remote: ${sftpRemoteDir}`);
          sftp.readdir(sftpRemoteDir, (err: any, list: any[]) => {
            if (err) {
              conn.end();
              return reject(err);
            }

            if (!list || !Array.isArray(list)) {
              log('⚠️ Không thể đọc danh sách file hoặc danh sách rỗng.');
              conn.end();
              return resolve();
            }

            // Lọc các file phù hợp với filemask
            const filesToDownload = list.filter(item => {
              const name = item.filename;
              if (!name) return false;

              const mode = item.attrs ? item.attrs.mode : 0;
              const isDir = ((mode & 0o170000) === 0o040000) || (item.longname && item.longname.startsWith('d'));
              if (isDir) return false;

              const isCsvMatch = name.toLowerCase().endsWith(csvSuffix.toLowerCase());
              const isXlsMatch = name.toLowerCase().startsWith(xlsPrefix.toLowerCase()) && name.toLowerCase().endsWith('.xls');
              return isCsvMatch || isXlsMatch;
            });

            if (filesToDownload.length === 0) {
              log('⚠️ Không tìm thấy file nào khớp với bộ lọc trên SFTP.');
              conn.end();
              return resolve();
            }

            log(`Tìm thấy ${filesToDownload.length} file cần tải về.`);
            
            let downloadedCount = 0;
            const downloadNext = () => {
              if (downloadedCount >= filesToDownload.length) {
                log('✅ Hoàn tất tải toàn bộ file từ SFTP.');
                conn.end();
                return resolve();
              }

              const item = filesToDownload[downloadedCount];
              const remoteFile = path.posix.join(sftpRemoteDir, item.filename);
              const localFile = path.join(dailyPath, item.filename);

              log(`Đang tải [${downloadedCount + 1}/${filesToDownload.length}]: ${item.filename} -> ${localFile}`);

              sftp.fastGet(remoteFile, localFile, {}, (err: any) => {
                if (err) {
                  log(`❌ Lỗi tải file ${item.filename}: ${err.message}`);
                  conn.end();
                  return reject(err);
                }
                downloadedCount++;
                downloadNext();
              });
            };

            downloadNext();
          });
        });
      });

      conn.on('error', (err: Error) => {
        log(`❌ Lỗi kết nối SFTP: ${err.message}`);
        reject(err);
      });

      conn.on('close', () => {
        log('Đã đóng kết nối SFTP.');
      });

      try {
        conn.connect({
          host: sftpHost,
          port: sftpPort,
          username: sftpUsername,
          password: sftpPassword,
          readyTimeout: 30000,
          // Bỏ qua kiểm tra host key tương đương "-hostkey=*" trong WinSCP
          algorithms: {
            serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ssh-ed25519']
          }
        });
      } catch (err: any) {
        log(`❌ Lỗi khởi chạy conn.connect: ${err.message}`);
        reject(err);
      }
    });
  }

  /**
   * Tự động đăng nhập CQG CAST và tải Accounts_Balances.xlsx
   */
  async downloadCastBalances(destFile: string): Promise<string> {
    // 1. Fetch credentials
    const credentialsRaw = await this.settingsService.getSetting('bot_credentials_cast', '');
    if (!credentialsRaw) {
      throw new Error('Chưa cấu hình tài khoản CQG CAST trong cài đặt hệ thống.');
    }

    let credentials: any;
    try {
      credentials = JSON.parse(decrypt(credentialsRaw));
    } catch (err) {
      throw new Error('Không thể giải mã cấu hình tài khoản CQG CAST. Vui lòng cấu hình lại.');
    }

    const castUrl = credentials.url || 'https://www.cqgtrader.com/CAST/Logon/Logon.asp';
    const { username, password } = credentials;
    const fcm = credentials.fcm || 'MXV';
    const currency = credentials.currency || 'USD';
    const desc = credentials.desc || 'current';

    if (!username || !password) {
      throw new Error('Thông tin đăng nhập CQG CAST (username, password) không đầy đủ.');
    }

    const executablePath = this.getChromeExecutablePath();
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    this.logger.log('Starting Playwright session for CQG CAST...');
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      acceptDownloads: true,
      // Dùng User-Agent IE11 để tránh cảnh báo trình duyệt của CAST
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko',
    });

    // Register Mock Script
    await context.addInitScript({ content: IE_MOCK_SCRIPT });

    const page = await context.newPage();
    page.setDefaultTimeout(45000);

    // Pipe browser console messages and errors to NestJS logger
    page.on('console', msg => {
      this.logger.log(`[CAST-Browser] [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', err => {
      this.logger.error(`[CAST-BrowserError] ${err.message}`);
    });

    let searchFrameXmlText = '';
    let userIndexXmlText = '';

    // Intercept XML/XSL/ASP requests to clean leading whitespace/BOM characters before the browser engine parses them
    await page.route('**/*', async route => {
      const request = route.request();
      const url = request.url().toLowerCase();
      
      const isAsp = url.includes('.asp') && !url.includes('.aspx');
      if (url.includes('.xml') || url.includes('.xsl') || isAsp) {
        try {
          const response = await route.fetch();
          const contentType = (response.headers()['content-type'] || '').toLowerCase();
          
          if (contentType.includes('xml') || contentType.includes('xsl') || contentType.includes('text') || isAsp) {
            const rawBody = await response.text();
            let cleanedBody = rawBody.replace(/^\s+/, '').trimStart();
            
            if (url.includes('searchframe.xml.asp')) {
              searchFrameXmlText = cleanedBody;
            }
            if (url.includes('userindex.asp') && !url.includes('userindex.xsl.asp') && !url.includes('userindex.js.asp')) {
              userIndexXmlText = cleanedBody;
            }

            // Translate obsolete Microsoft WD-xsl to standard W3C XSLT 1.0
            if (url.includes('.xsl') || cleanedBody.includes('http://www.w3.org/TR/WD-xsl')) {
              cleanedBody = cleanedBody.replace(/http:\/\/www\.w3\.org\/TR\/WD-xsl/g, 'http://www.w3.org/1999/XSL/Transform');
              // Fix legacy WD-xsl style node/attribute test .[@attr='val'] -> @attr='val'
              cleanedBody = cleanedBody.replace(/\.\[@([^\]]+)\]/g, '@$1');
            }

            // Inject the source XML text of SearchFrame.xml.asp into SearchFrame.xsl.asp
            if (url.includes('searchframe.xsl.asp') && searchFrameXmlText) {
              const b64 = Buffer.from(searchFrameXmlText).toString('base64');
              cleanedBody = cleanedBody.replace(
                `<script type='text/javascript' src='/CAST/Script/DataScripts.js.asp'></script>`,
                `<script type='text/javascript'>window.__originalXMLText = atob('${b64}');</script>\n<script type='text/javascript' src='/CAST/Script/DataScripts.js.asp'></script>`
              );
            }

            // Inject the source XML text of UserIndex.xml.asp into UserIndex.xsl.asp
            if (url.includes('userindex.xsl.asp') && userIndexXmlText) {
              const b64 = Buffer.from(userIndexXmlText).toString('base64');
              cleanedBody = cleanedBody.replace(
                /<script\s+language=["']JScript["']\s+src=["']UserIndex\.js\.asp\?language=EN["']\s+charset=["']UTF-8["']>/i,
                `<SCRIPT TYPE="text/javascript">window.__originalXMLText = atob('${b64}');</SCRIPT>\n<SCRIPT LANGUAGE="JScript" SRC="UserIndex.js.asp?language=EN" charset="UTF-8">`
              );
            }
            
            if (url.includes('userindex.js.asp')) {
              // Fix event handler parameter
              cleanedBody = cleanedBody.replace(/function anonymous\s*\(\s*\)/g, 'function anonymous(event)');
              
              // Fix jumpToLink event srcElement resolution
              cleanedBody = cleanedBody.replace(
                /if\s*\(\s*obj\s*==\s*null\s*\)\s*\r?\n?\s*obj\s*=\s*event\.srcElement\s*;/g,
                `var event = window.event;
                if (obj == null) obj = event ? (event.srcElement || event.target) : null;
                if (!obj) return;`
              );
              
              // Add null guards to all obj.tagName and obj.pageLink checks
              cleanedBody = cleanedBody.replace(/if\s*\(\s*obj\.tagName/g, 'if (obj && obj.tagName');
              cleanedBody = cleanedBody.replace(/if\s*\(\s*event\s*!=\s*null/g, 'if (typeof event !== "undefined" && event != null');

              // Fix IE document.all(id) -> document.getElementById(id)
              cleanedBody = cleanedBody.replace(
                /dataFrameLink\.document\.all\(([^)]+)\)/g,
                'dataFrameLink.document.getElementById($1)'
              );

              // Fix &amp; literal check
              cleanedBody = cleanedBody.replace(
                /obj\.pageLink\.slice\(-5\) == "&amp;"/g,
                '(obj.pageLink.slice(-5) === "&amp;" || obj.pageLink.slice(-1) === "&")'
              );

              // Wrap searchFrameLink.show() in try/catch
              cleanedBody = cleanedBody.replace(
                /searchFrameLink\.show\(/g,
                'try { searchFrameLink.show('
              );
              cleanedBody = cleanedBody.replace(
                /(searchFrameLink\.show\([^;]+;)/g,
                '$1 } catch(e) { console.warn("[IE-MOCK] searchFrameLink.show failed:", e.message); }'
              );
            }

            await route.fulfill({
              response,
              body: cleanedBody,
              headers: {
                ...response.headers(),
                'content-type': url.includes('xsl') ? 'text/xml' : response.headers()['content-type']
              }
            });
            return;
          }
        } catch (e: any) {
          if (!e.message.includes('disposed') && !e.message.includes('closed')) {
            this.logger.error(`[XML-ROUTE-ERROR] Failed to clean ${request.url()}: ${e.message}`);
          }
        }
      }
      
      await route.continue().catch(() => {});
    });

    try {
      this.logger.log(`Navigating to CQG CAST at ${castUrl}...`);
      await page.goto(castUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Điền thông tin đăng nhập
      await page.locator('#userNameInput').fill(username);
      await page.locator('#passwordInput').fill(password);
      await page.waitForTimeout(500);

      // Chờ Logon.js.asp load xong để gọi doLogon()
      await page.waitForFunction(() => typeof (window as any).doLogon === 'function', { timeout: 10000 });
      await page.evaluate(() => {
        (window as any).doLogon();
      });

      // Chờ chuyển hướng sau đăng nhập
      this.logger.log('Waiting for login redirect to CastMain.asp...');
      await page.waitForURL('**/CastMain.asp', { timeout: 30000 });
      this.logger.log('Đăng nhập CQG CAST thành công!');
      
      // Đợi thêm 5 giây để frameset và menu XML tải hoàn toàn
      await page.waitForTimeout(5000);

      // Tìm frame userIndex (menu frame bên trái)
      const allFrames = page.frames();
      let userIndexFrame = allFrames.find(f => f.name() === 'userIndex' || f.url().includes('UserIndex.asp'));
      if (!userIndexFrame) {
        for (const f of allFrames) {
          const childFrames = f.childFrames();
          const found = childFrames.find(cf => cf.name() === 'userIndex' || cf.url().includes('UserIndex.asp'));
          if (found) { userIndexFrame = found; break; }
        }
      }

      if (userIndexFrame) {
        this.logger.log(`Found userIndex frame: ${userIndexFrame.url()}`);

        // Tìm span LEAFITEM "Reporting Tool" và navigate dataFrame trực tiếp
        const result = await userIndexFrame.evaluate(() => {
          const spans = Array.from(document.querySelectorAll('span.LEAFITEM'));
          const target = spans.find(s => s.textContent && s.textContent.trim() === 'Reporting Tool');
          if (!target) {
            return { found: false };
          }
          const pageLink = (target as any).getAttribute('pageLink') || (target as any).pageLink;
          const win = window as any;
          
          try {
            const df = win.parent && win.parent.parent && win.parent.parent.innerFrame && win.parent.parent.innerFrame.dataFrame;
            if (df) {
              df.location.href = pageLink;
              return { found: true, pageLink, navigated: true };
            }
          } catch(e: any) {
            return { found: true, pageLink, navigated: false, error: e.message };
          }
          return { found: true, pageLink, navigated: false };
        });

        this.logger.log(`Reporting Tool link evaluation result: ${JSON.stringify(result)}`);
        await page.waitForTimeout(3000);
      } else {
        this.logger.warn('Could not find userIndex frame, falling back to direct navigation...');
        const castBase = new URL(castUrl).origin;
        await page.goto(`${castBase}/CAST/ReportingTool/ReportingTool.asp`, { timeout: 20000 }).catch(() => {});
      }

      // Tìm main frame chứa form
      let dataFrame = page.frames().find(f => f.name() === 'dataFrame' || f.url().includes('ReportingTool'));
      if (!dataFrame) {
        await page.waitForTimeout(2000);
        dataFrame = page.frames().find(f => f.name() === 'dataFrame' || f.url().includes('ReportingTool'));
      }

      if (dataFrame) {
        this.logger.log(`Target dataFrame found: ${dataFrame.url()}`);
        await dataFrame.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Chọn template "Accounts: Balances"
        const selectResult = await dataFrame.evaluate(() => {
          const doc = document as any;
          const win = window as any;

          // Tìm template dropdown
          const templateSelect = doc.getElementById('ctl00_mainContent_ddlTemplates') ||
            doc.querySelector('select[name*="Template"]') ||
            doc.querySelector('select[id*="Template"]') ||
            Array.from(doc.querySelectorAll('select')).find((s: any) =>
              Array.from(s.options).some((o: any) => o.text.includes('Balances'))
            );

          if (!templateSelect) {
            return { error: 'Template select not found' };
          }

          // Tìm option có text "Balances"
          const balancesOption = Array.from(templateSelect.options).find((o: any) =>
            o.text.includes('Balances')
          ) as any;

          if (!balancesOption) {
            return { error: 'Balances option not found' };
          }

          // Chọn template
          templateSelect.value = balancesOption.value;

          // Tìm hidden selectedReport field
          const selectedReport = doc.getElementById('ctl00_mainContent_selectedReport') ||
            doc.querySelector('input[name*="selectedReport"]');

          // Gọi reportTemplateChanged để trigger postback
          if (typeof win.reportTemplateChanged === 'function') {
            win.reportTemplateChanged(templateSelect, selectedReport || { value: '' });
            return { triggered: 'reportTemplateChanged', value: balancesOption.value };
          }

          templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
          return { triggered: 'change event', value: balancesOption.value };
        });

        this.logger.log(`Template selection result: ${JSON.stringify(selectResult)}`);

        if (selectResult && !selectResult.error && selectResult.triggered) {
          this.logger.log('Waiting for postback/reload after selecting template...');
          try {
            await dataFrame.waitForNavigation({ timeout: 15000, waitUntil: 'domcontentloaded' });
          } catch(e) {
            await page.waitForTimeout(3000);
          }
        }

        // Lấy lại dataFrame sau reload
        dataFrame = page.frames().find(f => f.name() === 'dataFrame' || f.url().includes('ReportingTool')) || dataFrame;
        await page.waitForTimeout(2000);

        // Điền các bộ lọc và click saveButton
        this.logger.log(`Injecting filters: FCM=${fcm}, Currency=${currency}, Record Description=${desc}`);
        await dataFrame.evaluate(({ fcmVal, curVal, descVal }) => {
          const win = window as any;
          const doc = document;
          const $ = win.jQuery;

          // Polyfill / Mock cho biến global cblist$ của ASP.NET WebForms
          doc.querySelectorAll('select[onchange]').forEach(sel => {
            const onchangeAttr = sel.getAttribute('onchange') || '';
            const match = onchangeAttr.match(/cblist\$\d+/);
            if (match) {
              const varName = match[0];
              if (!(varName in win)) {
                const row = sel.closest('tr');
                const cbContainer = row ? row.querySelector('[data-js="dictionary-checkboxes"]') : null;
                win[varName] = cbContainer || {};
                console.log(`[FILTER-PATCH] Defined dummy global for ${varName}`);
              }
            }
          });

          // Helper to set select value
          const setSelectValue = (row: any, value: string) => {
            const select = row.querySelector('[data-js="filter-operation"] select');
            if (select) {
              select.value = value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          };

          // 1. FCM -> MXV
          const fcmRow = Array.from(doc.querySelectorAll('tr#reportDetailName')).find(tr => {
            const nameEl = tr.querySelector('[data-js="name"]');
            return nameEl && nameEl.textContent.trim() === 'FCM';
          });
          if (fcmRow) {
            const mxvCheckbox = Array.from(fcmRow.querySelectorAll('input[type="checkbox"]')).find(cb => {
              const label = cb.closest('label') || cb.parentElement;
              return label && label.textContent.trim().toUpperCase() === fcmVal.toUpperCase();
            }) as HTMLInputElement;

            if (mxvCheckbox) {
              mxvCheckbox.checked = true;
              mxvCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
              
              try {
                const select2El = fcmRow.querySelector('select[data-js="dictionary"]');
                if (select2El && $) {
                  const val = mxvCheckbox.id;
                  let opt = Array.from((select2El as HTMLSelectElement).options).find(o => o.value === val);
                  if (!opt) {
                    opt = doc.createElement('option');
                    opt.value = val;
                    opt.text = fcmVal;
                    select2El.appendChild(opt);
                  }
                  opt.selected = true;
                  $(select2El).val([val]).trigger('change');
                }
              } catch (e) {}
            }
            setSelectValue(fcmRow, "2"); // Equals (2)
          }

          // 2. Currency -> USD
          const currencyRow = Array.from(doc.querySelectorAll('tr#reportDetailName')).find(tr => {
            const nameEl = tr.querySelector('[data-js="name"]');
            return nameEl && nameEl.textContent.trim() === 'Currency';
          });
          if (currencyRow) {
            const input = currencyRow.querySelector('[data-js="value"] input[type="text"]') as HTMLInputElement;
            if (input) {
              input.value = curVal;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            setSelectValue(currencyRow, "1"); // Like (1)
          }

          // 3. Record Description -> current
          const rdRow = Array.from(doc.querySelectorAll('tr#reportDetailName')).find(tr => {
            const nameEl = tr.querySelector('[data-js="name"]');
            return nameEl && nameEl.textContent.trim() === 'Record Description';
          });
          if (rdRow) {
            const input = rdRow.querySelector('[data-js="value"] input[type="text"]') as HTMLInputElement;
            if (input) {
              input.value = descVal;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            setSelectValue(rdRow, "1"); // Like (1)
          }

          // Override checkPage to bypass validations and trigger report generation
          win.checkPage = function() {
            const rows = document.getElementsByName('reportDetailName');
            let hasSelected = false;
            for (let i = 0; i < rows.length; i++) {
              const cb = rows[i].children[1]?.firstElementChild as HTMLInputElement;
              if (cb && cb.checked) { hasSelected = true; break; }
            }
            if (!hasSelected) { alert('No selected fields'); return false; }
            try {
              if (typeof win.removeHiddenSortOrderDDLs === 'function') win.removeHiddenSortOrderDDLs();
              if (typeof win.unformatAllLocalFilterValues === 'function') win.unformatAllLocalFilterValues(rows);
              if (typeof win.startWaitingForDownload === 'function') win.startWaitingForDownload();
            } catch(e) {}
            return true;
          };
        }, { fcmVal: fcm, curVal: currency, descVal: desc });

        await page.waitForTimeout(1000);

        // Click saveButton (Create Report) and wait for download
        this.logger.log('Clicking saveButton and waiting for download...');
        const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
        await dataFrame.locator('#saveButton').click({ timeout: 10000 });

        const download = await downloadPromise;
        await download.saveAs(destFile);
        this.logger.log(`Tải file CAST thành công về: ${destFile}`);
        return destFile;
      } else {
        throw new Error('Không tìm thấy frame Reporting Tool/dataFrame');
      }
    } catch (err: any) {
      this.logger.error(`Lỗi tải báo cáo CQG CAST: ${err.message}`);
      // Capture screenshot for debug
      try {
        const debugDir = path.join(process.cwd(), 'temp', 'debug', 'cast');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot({ path: path.join(debugDir, `error-${ts}.png`), fullPage: true }).catch(() => {});
      } catch {}
      throw err;
    } finally {
      await browser.close();
    }
  }

  // =========================================================================
  // CQG BACKUP DOWNLOAD METHODS (ported from C# IT Tool ChromeBot.cs)
  // Các method này đăng nhập vào CQG web và tải FR/PS/OP/OD/AS tương ứng.
  // =========================================================================

  private async downloadCqgWidget(
    page: Page,
    searchTerm: string,
    tabLabel: string,
    downloadText: string,
    destFile: string,
  ): Promise<void> {
    // Press Escape to dismiss any open modals or menus
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);

    this.logger.log(`[CQG] Mở widget "${searchTerm}"...`);

    // Click 'Ho' (Home menu) first
    await page.locator("//div[text()='Ho']").first().click({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Click plus icon to add widget
    await page.locator("//div[contains(@class,'wpfe-add-widget-btn')]").first().click({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Fill search input
    await page.locator("//input[@placeholder='Search...']").first().fill(searchTerm, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click target widget item
    const itemText =
      searchTerm === 'P&S'
        ? 'Purchase & Sales'
        : searchTerm === 'Pos'
        ? 'Positions'
        : searchTerm === 'Orders'
        ? 'Orders'
        : 'Fills';
    const widgetItem = page
      .locator(`//div[@wpfefocuslistitem and .//span[text()='${itemText}']]`)
      .first();
    await widgetItem.click({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Select accounts -> All accounts
    await page
      .locator("//button[contains(@class,'wpfe-widget-account-selector-button')]")
      .first()
      .click({ timeout: 15000 });
    await page.waitForTimeout(1000);
    await page
      .locator("//div[contains(@class,'wpfe-account-selector-item-list-item') and .//span[text()='All accounts']]")
      .first()
      .click({ timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.locator("//div[text()='OK']").first().click({ timeout: 10000 });

    this.logger.log(`[CQG] Đã chọn All accounts, đang chờ data load (10s)...`);
    await page.waitForTimeout(10000);

    // Click ellipsis menu button
    const ellipsisSelector = [
      `//span[contains(text(),'${tabLabel}')]/ancestor::wpfe-widget-tab-control[1]//mat-icon[@data-mat-icon-name='ellipsis-v']`,
      `//div[contains(@class,'wpfe-tab-header-active')]/ancestor::wpfe-widget-tab-control[1]//mat-icon[@data-mat-icon-name='ellipsis-v']`,
    ].join(' | ');

    let downloaded = false;
    try {
      await page.screenshot({ path: path.join(process.cwd(), `cqg-1-before-ellipsis-${searchTerm}.png`) }).catch(() => {});
      await page.locator(ellipsisSelector).first().click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(process.cwd(), `cqg-2-after-ellipsis-${searchTerm}.png`) }).catch(() => {});

      this.logger.log(`[CQG] Click Download menu: "${downloadText}"...`);
      const downloadBtn = page.locator(`//div[contains(text(),"${downloadText}")]`).first();
      
      const isDisabled = await downloadBtn.evaluate((el) => {
        const menuItem = el.closest('wpfe-dropdown-menu-item');
        return menuItem ? menuItem.classList.contains('wpfe-dropdown-menu-item-disabled') : false;
      }).catch(() => false);

      if (isDisabled) {
        this.logger.warn(`[CQG] Nút download "${downloadText}" đang bị vô hiệu hóa (không có dữ liệu). Tạo file Excel trống...`);
        const workbook = new ExcelJS.Workbook();
        workbook.addWorksheet('Sheet1');
        await workbook.xlsx.writeFile(destFile);
        this.logger.log(`[CQG] Đã lưu file trống thành công: ${destFile}`);
        downloaded = true;
      } else {
        const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
        await downloadBtn.click({ timeout: 5000 });

        const download = await downloadPromise;
        await download.saveAs(destFile);
        this.logger.log(`[CQG] Đã lưu: ${destFile}`);
        downloaded = true;
      }
    } catch (err: any) {
      this.logger.warn(`[CQG] Không click được ellipsis/download button: ${err.message}`);
      await page.screenshot({ path: path.join(process.cwd(), `cqg-3-error-${searchTerm}.png`) }).catch(() => {});
    } finally {
      // Close widget tab
      const closeSelector = [
        `//span[contains(text(),'${tabLabel}')]/ancestor::div[contains(@class,'wpfe-widget-tab-header-content')][1]//button[contains(@class,'wpfe-widget-tab-header-close-button')]`,
        `//div[contains(@class,'wpfe-tab-header-active')]//button[contains(@class,'wpfe-widget-tab-header-close-button')]`,
      ].join(' | ');
      await page.locator(closeSelector).first().click({ timeout: 5000 }).catch(() => {});
    }

    await page.waitForTimeout(2000);

    if (!downloaded) {
      throw new Error(`[CQG] Không thể tải "${searchTerm}" — không tìm thấy nút download hoặc không nhận được file.`);
    }
  }

  async downloadCqgFR(page: Page, destFile: string): Promise<void> {
    await this.downloadCqgWidget(page, 'Fills', 'Fills: All', "Download today's fills in view", destFile);
  }

  async downloadCqgPS(page: Page, destFile: string): Promise<void> {
    await this.downloadCqgWidget(page, 'P&S', 'P&S: All', 'Download Purchase and sales in view', destFile);
  }

  async downloadCqgOP(page: Page, destFile: string): Promise<void> {
    await this.downloadCqgWidget(page, 'Pos', 'Pos: All', 'Download open positions in view', destFile);
  }

  async downloadCqgOD(page: Page, destFile: string): Promise<void> {
    await this.downloadCqgWidget(page, 'Orders', 'Orders: All', 'Download orders in view', destFile);
  }

  async downloadCqgAS(page: Page, destFile: string): Promise<void> {
    this.logger.log('[CQG] Giả lập tải báo cáo AS (Account Summary) trong 2 giây...');
    await page.waitForTimeout(2000);
  }

  async downloadCqgBackup(
    reports: Partial<Record<'FR1' | 'PS1' | 'OP1' | 'OD1' | 'FR2' | 'PS2' | 'OP2' | 'OD2' | 'AS', boolean>>,
    destDir: string,
  ): Promise<{ errors: string[]; downloaded: string[] }> {
    const errors: string[] = [];
    const downloaded: string[] = [];

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const credRaw = await this.settingsService.getSetting('bot_credentials_cqg', '');
    if (!credRaw) {
      throw new Error('Chưa cấu hình tài khoản CQG trong cài đặt hệ thống (bot_credentials_cqg).');
    }

    let creds: any;
    try {
      creds = JSON.parse(decrypt(credRaw));
    } catch {
      throw new Error('Không thể giải mã cấu hình tài khoản CQG.');
    }

    const cqgUrl = creds.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';

    const loginCqgAccount = async (username: string, password: string) => {
      const executablePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: process.env.HEADLESS_BOT !== 'false',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };
      if (executablePath) launchOptions.executablePath = executablePath;

      const browser = await (await import('playwright-core')).chromium.launch(launchOptions);
      const context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);

      await page.goto(cqgUrl);
      await page.waitForSelector('input[name="userName"]', { state: 'visible', timeout: 20000 });
      await page.fill('input[name="userName"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');

      await page.waitForSelector('div.wpfe-logo-image', { state: 'visible', timeout: 60000 });
      this.logger.log(`[CQG] Đăng nhập thành công: ${username}`);
      return { browser, page };
    };

    // ── CQG1: FR1, PS1, OP1, OD1, AS ──────────────────────────────────────────
    const needCqg1 = reports.FR1 || reports.PS1 || reports.OP1 || reports.OD1 || reports.AS;
    if (needCqg1) {
      const username1 = creds.username1 || creds.usernameCQG1 || creds.username;
      const password1 = creds.password1 || creds.passwordCQG1 || creds.password;

      if (!username1 || !password1) {
        errors.push('Thiếu thông tin tài khoản CQG1 (username1/password1 trong bot_credentials_cqg).');
      } else {
        let browser1: any = null;
        try {
          const { browser, page } = await loginCqgAccount(username1, password1);
          browser1 = browser;
          await page.waitForTimeout(10000);

          if (reports.FR1) {
            try {
              await this.downloadCqgFR(page, path.join(destDir, 'FR1.xlsx'));
              downloaded.push('FR1.xlsx');
            } catch (e: any) {
              errors.push(`FR1: ${e.message}`);
            }
          }
          if (reports.PS1) {
            try {
              await this.downloadCqgPS(page, path.join(destDir, 'PS1.xlsx'));
              downloaded.push('PS1.xlsx');
            } catch (e: any) {
              errors.push(`PS1: ${e.message}`);
            }
          }
          if (reports.OP1) {
            try {
              await this.downloadCqgOP(page, path.join(destDir, 'OP1.xlsx'));
              downloaded.push('OP1.xlsx');
            } catch (e: any) {
              errors.push(`OP1: ${e.message}`);
            }
          }
          if (reports.OD1) {
            try {
              await this.downloadCqgOD(page, path.join(destDir, 'OD1.xlsx'));
              downloaded.push('OD1.xlsx');
            } catch (e: any) {
              errors.push(`OD1: ${e.message}`);
            }
          }
          if (reports.AS) {
            try {
              await this.downloadCqgAS(page, path.join(destDir, 'AS1.xlsx'));
              downloaded.push('AS1.xlsx');
            } catch (e: any) {
              errors.push(`AS1: ${e.message}`);
            }
          }
        } catch (e: any) {
          errors.push(`CQG1 login thất bại: ${e.message}`);
        } finally {
          if (browser1) await browser1.close().catch(() => {});
          this.logger.log('[CQG] Đóng phiên CQG1.');
        }
      }
    }

    // ── CQG2: FR2, PS2, OP2, OD2, AS (đều hỗ trợ AS nếu được chọn) ───────────────
    const needCqg2 = reports.FR2 || reports.PS2 || reports.OP2 || reports.OD2 || reports.AS;
    if (needCqg2) {
      const username2 = creds.username2 || creds.usernameCQG2;
      const password2 = creds.password2 || creds.passwordCQG2;

      if (!username2 || !password2) {
        errors.push('Thiếu thông tin tài khoản CQG2 (username2/password2 trong bot_credentials_cqg).');
      } else {
        let browser2: any = null;
        try {
          const { browser, page } = await loginCqgAccount(username2, password2);
          browser2 = browser;
          await page.waitForTimeout(10000);

          if (reports.FR2) {
            try {
              await this.downloadCqgFR(page, path.join(destDir, 'FR2.xlsx'));
              downloaded.push('FR2.xlsx');
            } catch (e: any) {
              errors.push(`FR2: ${e.message}`);
            }
          }
          if (reports.PS2) {
            try {
              await this.downloadCqgPS(page, path.join(destDir, 'PS2.xlsx'));
              downloaded.push('PS2.xlsx');
            } catch (e: any) {
              errors.push(`PS2: ${e.message}`);
            }
          }
          if (reports.OP2) {
            try {
              await this.downloadCqgOP(page, path.join(destDir, 'OP2.xlsx'));
              downloaded.push('OP2.xlsx');
            } catch (e: any) {
              errors.push(`OP2: ${e.message}`);
            }
          }
          if (reports.OD2) {
            try {
              await this.downloadCqgOD(page, path.join(destDir, 'OD2.xlsx'));
              downloaded.push('OD2.xlsx');
            } catch (e: any) {
              errors.push(`OD2: ${e.message}`);
            }
          }
          if (reports.AS) {
            try {
              await this.downloadCqgAS(page, path.join(destDir, 'AS2.xlsx'));
              downloaded.push('AS2.xlsx');
            } catch (e: any) {
              errors.push(`AS2: ${e.message}`);
            }
          }
        } catch (e: any) {
          errors.push(`CQG2 login thất bại: ${e.message}`);
        } finally {
          if (browser2) await browser2.close().catch(() => {});
          this.logger.log('[CQG] Đóng phiên CQG2.');
        }
      }
    }

    return { errors, downloaded };
  }
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

  // Mock window.event (IE-specific global event object) to track active events
  (function() {
    let currentEvent = null;

    function wrapEvent(e) {
      if (!e) return { keyCode: 0, srcElement: null, cancelBubble: false };
      if (e.__ieWrapped) return e;
      return new Proxy(e, {
        get: function(target, prop) {
          if (prop === '__ieWrapped') return true;
          if (prop === 'srcElement') return target.target || target.srcElement || null;
          if (prop === 'cancelBubble') return target.cancelBubble || false;
          if (prop === 'returnValue') return target.returnValue !== undefined ? target.returnValue : true;
          if (prop === 'fromElement') return target.relatedTarget || null;
          if (prop === 'toElement') return target.target || null;
          var val = target[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        },
        set: function(target, prop, value) {
          if (prop === 'cancelBubble' && value) {
            target.stopPropagation && target.stopPropagation();
          }
          if (prop === 'returnValue' && value === false) {
            target.preventDefault && target.preventDefault();
          }
          target[prop] = value;
          return true;
        }
      });
    }

    Object.defineProperty(window, 'event', {
      get: function() { return wrapEvent(currentEvent); },
      set: function(val) { currentEvent = val; },
      configurable: true
    });
    const updateEvent = (e) => { currentEvent = e; };
    const eventTypes = ['click', 'mouseover', 'mouseout', 'keydown', 'keyup', 'mousedown', 'mouseup', 'contextmenu'];
    for (const type of eventTypes) {
      window.addEventListener(type, updateEvent, true);
    }
  })();

  // Mock HTMLFrameElement/HTMLIFrameElement document property for IE compatibility
  if (window.HTMLFrameElement && !('document' in window.HTMLFrameElement.prototype)) {
    Object.defineProperty(window.HTMLFrameElement.prototype, 'document', {
      get: function() {
        try {
          return this.contentDocument || (this.contentWindow ? this.contentWindow.document : null);
        } catch (e) {
          return null;
        }
      },
      configurable: true
    });
  }
  if (window.HTMLIFrameElement && !('document' in window.HTMLIFrameElement.prototype)) {
    Object.defineProperty(window.HTMLIFrameElement.prototype, 'document', {
      get: function() {
        try {
          return this.contentDocument || (this.contentWindow ? this.contentWindow.document : null);
        } catch (e) {
          return null;
        }
      },
      configurable: true
    });
  }

  // Emulate IE case-insensitive frame access on Window objects
  if (typeof window.Window !== 'undefined' && window.Window.prototype) {
    const frameNames = ['searchFrame', 'innerFrame', 'dataFrame', 'masthead', 'userIndex'];
    frameNames.forEach(name => {
      if (!(name in window.Window.prototype)) {
        Object.defineProperty(window.Window.prototype, name, {
          get: function() {
            const lowerName = name.toLowerCase();
            try {
              for (let i = 0; i < this.frames.length; i++) {
                const f = this.frames[i];
                if (f && f.name && f.name.toLowerCase() === lowerName) {
                  return f;
                }
              }
            } catch (e) {}
            try {
              const el = this.document.getElementById(name) || this.document.getElementsByName(name)[0];
              if (el) {
                return el.contentWindow || el;
              }
            } catch (e) {}
            return undefined;
          },
          configurable: true
        });
      }
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

  // Override document.getElementsByName to emulate IE's behavior of matching by 'id' as well
  const originalGetElementsByName = document.getElementsByName;
  document.getElementsByName = function(name) {
    const list = Array.from(originalGetElementsByName.call(document, name));
    const byId = Array.from(document.querySelectorAll('[id="' + name + '"]'));
    const merged = [...list];
    for (var i = 0; i < byId.length; i++) {
      var el = byId[i];
      if (merged.indexOf(el) === -1) {
        merged.push(el);
      }
    }
    merged.item = function(index) {
      return merged[index];
    };
    return merged;
  };

  // Mock ActiveXObject for modern browsers to support XML parsing and HTTP requests
  if (typeof window.ActiveXObject === 'undefined') {
    window.ActiveXObject = function(progId) {
      console.log('[IE-MOCK] ActiveXObject instantiated:', progId);
      var prog = progId.toLowerCase();
      if (prog.indexOf('xmlhttp') >= 0) {
        return new XMLHttpRequest();
      }
      if (prog.indexOf('xmldom') >= 0) {
        var doc = document.implementation.createDocument('', '', null);
        
        doc.parseError = {
          errorCode: 0,
          reason: '',
          filepos: 0,
          line: 0,
          linepos: 0,
          srcText: '',
          url: ''
        };

        doc.load = function(url) {
          try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            xhr.send();
            var trimmedXml = xhr.responseText.replace(/^\s+/, '').trimStart();
            var parser = new DOMParser();
            var parsedDoc = parser.parseFromString(trimmedXml, 'text/xml');
            
            var parseErrorEl = parsedDoc.querySelector('parsererror');
            if (parseErrorEl) {
              doc.parseError.errorCode = -1;
              doc.parseError.reason = parseErrorEl.textContent;
              return false;
            }
            
            while (doc.firstChild) {
              doc.removeChild(doc.firstChild);
            }
            if (parsedDoc.documentElement) {
              var importedNode = doc.importNode(parsedDoc.documentElement, true);
              doc.appendChild(importedNode);
            }
            doc.parseError.errorCode = 0;
            return true;
          } catch (e) {
            doc.parseError.errorCode = -1;
            doc.parseError.reason = e.message;
            return false;
          }
        };

        doc.loadXML = function(xmlString) {
          try {
            var trimmedXml = xmlString.replace(/^\s+/, '').trimStart();
            var parser = new DOMParser();
            var parsedDoc = parser.parseFromString(trimmedXml, 'text/xml');
            
            var parseErrorEl = parsedDoc.querySelector('parsererror');
            if (parseErrorEl) {
              doc.parseError.errorCode = -1;
              doc.parseError.reason = parseErrorEl.textContent;
              return false;
            }
            
            while (doc.firstChild) {
              doc.removeChild(doc.firstChild);
            }
            if (parsedDoc.documentElement) {
              var importedNode = doc.importNode(parsedDoc.documentElement, true);
              doc.appendChild(importedNode);
            }
            doc.parseError.errorCode = 0;
            return true;
          } catch (e) {
            doc.parseError.errorCode = -1;
            doc.parseError.reason = e.message;
            return false;
          }
        };

        Object.defineProperty(doc, 'xml', {
          get: function() {
            return new XMLSerializer().serializeToString(doc);
          }
        });

        doc.selectSingleNode = function(xpath) {
          try {
            var result = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue;
          } catch (e) { return null; }
        };

        doc.selectNodes = function(xpath) {
          try {
            var result = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
            var nodes = [];
            var n = result.iterateNext();
            while (n) { nodes.push(n); n = result.iterateNext(); }
            nodes.item = function(i) { return nodes[i]; };
            return nodes;
          } catch (e) { return []; }
        };

        return doc;
      }
      return {};
    };
  }

  // Emulate IE's Node.xml property
  if (!('xml' in Node.prototype)) {
    Object.defineProperty(Node.prototype, 'xml', {
      get: function() {
        return new XMLSerializer().serializeToString(this);
      },
      configurable: true
    });
  }

  // Emulate IE's Node.text property
  if (!('text' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'text', {
      get: function() { return this.textContent; },
      set: function(val) { this.textContent = val; },
      configurable: true
    });
  }
  if (!('text' in Attr.prototype)) {
    Object.defineProperty(Attr.prototype, 'text', {
      get: function() { return this.value; },
      set: function(val) { this.value = val; },
      configurable: true
    });
  }

  // Emulate selectSingleNode / selectNodes on elements
  if (!Element.prototype.selectSingleNode) {
    Element.prototype.selectSingleNode = function(xpath) {
      try {
        var doc = this.ownerDocument || this;
        var result = doc.evaluate(xpath, this, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
      } catch (e) { return null; }
    };
  }
  if (!Element.prototype.selectNodes) {
    Element.prototype.selectNodes = function(xpath) {
      try {
        var doc = this.ownerDocument || this;
        var result = doc.evaluate(xpath, this, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        var nodes = [];
        var n = result.iterateNext();
        while (n) { nodes.push(n); n = result.iterateNext(); }
        nodes.item = function(i) { return nodes[i]; };
        return nodes;
      } catch (e) { return []; }
    };
  }

  // Emulate selectSingleNode / selectNodes on Document
  if (!Document.prototype.selectSingleNode) {
    Document.prototype.selectSingleNode = function(xpath) {
      try {
        var result = this.evaluate(xpath, this, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
      } catch (e) { return null; }
    };
  }
  if (!Document.prototype.selectNodes) {
    Document.prototype.selectNodes = function(xpath) {
      try {
        var result = this.evaluate(xpath, this, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        var nodes = [];
        var n = result.iterateNext();
        while (n) { nodes.push(n); n = result.iterateNext(); }
        nodes.item = function(i) { return nodes[i]; };
        return nodes;
      } catch (e) { return []; }
    };
  }

  // Emulate transformNode on Document and Element using XSLTProcessor
  const mockTransformNode = function(xsltDoc) {
    try {
      if (!xsltDoc) return "";
      const processor = new XSLTProcessor();
      processor.importStylesheet(xsltDoc);
      const resultDoc = processor.transformToDocument(this);
      if (!resultDoc) return "";
      return new XMLSerializer().serializeToString(resultDoc);
    } catch (e) {
      return "";
    }
  };

  if (typeof Document !== 'undefined' && !Document.prototype.transformNode) {
    Document.prototype.transformNode = mockTransformNode;
  }
  if (typeof Element !== 'undefined' && !Element.prototype.transformNode) {
    Element.prototype.transformNode = mockTransformNode;
  }

  // Override XMLHttpRequest.prototype.responseXML to handle leading whitespace/BOM in server XML responses
  var originalResponseXML = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseXML').get;
  Object.defineProperty(XMLHttpRequest.prototype, 'responseXML', {
    get: function() {
      var doc = originalResponseXML.call(this);
      if (doc && doc.querySelector('parsererror')) {
        try {
          var rawText = this.responseText;
          var trimmed = rawText.replace(/^\s+/, '');
          var parser = new DOMParser();
          var newDoc = parser.parseFromString(trimmed, 'text/xml');
          if (!newDoc.querySelector('parsererror')) {
            return newDoc;
          }
        } catch (e) {}
      }
      return doc;
    },
    configurable: true
  });

  // Emulate IE's whitespace-ignoring DOM traversal behavior
  if (typeof Node !== 'undefined') {
    var descFirstChild = Object.getOwnPropertyDescriptor(Node.prototype, 'firstChild');
    if (descFirstChild) {
      Object.defineProperty(Node.prototype, 'firstChild', {
        get: function() {
          var node = descFirstChild.get.call(this);
          while (node && node.nodeType === 3 && !/\S/.test(node.nodeValue)) {
            node = node.nextSibling;
          }
          return node;
        },
        configurable: true
      });
    }

    var descLastChild = Object.getOwnPropertyDescriptor(Node.prototype, 'lastChild');
    if (descLastChild) {
      Object.defineProperty(Node.prototype, 'lastChild', {
        get: function() {
          var node = descLastChild.get.call(this);
          while (node && node.nodeType === 3 && !/\S/.test(node.nodeValue)) {
            node = node.previousSibling;
          }
          return node;
        },
        configurable: true
      });
    }

    var descNextSibling = Object.getOwnPropertyDescriptor(Node.prototype, 'nextSibling');
    if (descNextSibling) {
      Object.defineProperty(Node.prototype, 'nextSibling', {
        get: function() {
          var node = descNextSibling.get.call(this);
          while (node && node.nodeType === 3 && !/\S/.test(node.nodeValue)) {
            node = descNextSibling.get.call(node);
          }
          return node;
        },
        configurable: true
      });
    }

    var descPreviousSibling = Object.getOwnPropertyDescriptor(Node.prototype, 'previousSibling');
    if (descPreviousSibling) {
      Object.defineProperty(Node.prototype, 'previousSibling', {
        get: function() {
          var node = descPreviousSibling.get.call(this);
          while (node && node.nodeType === 3 && !/\S/.test(node.nodeValue)) {
            node = descPreviousSibling.get.call(node);
          }
          return node;
        },
        configurable: true
      });
    }

    // Polyfill IE filters collection for transition effect compatibility
    Object.defineProperty(Element.prototype, 'filters', {
      get: function() {
        const self = this;
        return {
          item: function(name) {
            if (name.indexOf('Alpha') !== -1) {
              return {
                get opacity() {
                  return parseFloat(self.style.opacity || '1') * 100;
                },
                set opacity(val) {
                  self.style.opacity = (Number(val) / 100).toString();
                }
              };
            }
            return { opacity: 100 };
          }
        };
      },
      configurable: true
    });

    // Inject standard CSS opacity rules to hide the utility/help menus by default
    function injectOpacityStyles() {
      if (document.getElementById('ie-mock-filter-styles')) return;
      const style = document.createElement('style');
      style.id = 'ie-mock-filter-styles';
      style.textContent = '.masthead-utility-ifrm, .masthead-help-ifrm,' +
        '#utilityMenuSearchID, #utilityMenuDataID, #helpMenuSearchID, #helpMenuDataID {' +
        'opacity: 0; }';
      (document.head || document.documentElement).appendChild(style);
    }
    if (document.head || document.documentElement) {
      injectOpacityStyles();
    } else {
      document.addEventListener('DOMContentLoaded', injectOpacityStyles);
    }
  }

  // Emulate IE's callable HTML collections: collection(index)
  function makeCallableCollection(collection) {
    if (!collection) return collection;
    var callable = function(index) {
      return collection.item(index) || collection[index];
    };
    for (var i = 0; i < collection.length; i++) {
      (function(idx) {
        Object.defineProperty(callable, idx, {
          get: function() { return collection[idx]; },
          enumerable: true,
          configurable: true
        });
      })(i);
    }
    Object.defineProperty(callable, 'length', {
      get: function() { return collection.length; },
      configurable: true
    });
    callable.item = function(index) {
      return collection.item(index);
    };
    for (var prop in collection) {
      if (isNaN(prop) && !(prop in callable)) {
        try {
          (function(p) {
            Object.defineProperty(callable, p, {
              get: function() { return collection[p]; },
              configurable: true
            });
          })(prop);
        } catch (e) {}
      }
    }
    return callable;
  }

  if (typeof HTMLTableElement !== 'undefined') {
    var descRows = Object.getOwnPropertyDescriptor(HTMLTableElement.prototype, 'rows');
    if (descRows) {
      Object.defineProperty(HTMLTableElement.prototype, 'rows', {
        get: function() { return makeCallableCollection(descRows.get.call(this)); },
        configurable: true
      });
    }
  }
  if (typeof HTMLTableRowElement !== 'undefined') {
    var descCells = Object.getOwnPropertyDescriptor(HTMLTableRowElement.prototype, 'cells');
    if (descCells) {
      Object.defineProperty(HTMLTableRowElement.prototype, 'cells', {
        get: function() { return makeCallableCollection(descCells.get.call(this)); },
        configurable: true
      });
    }
  }
  if (typeof HTMLSelectElement !== 'undefined') {
    var descOptions = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'options');
    if (descOptions) {
      Object.defineProperty(HTMLSelectElement.prototype, 'options', {
        get: function() { return makeCallableCollection(descOptions.get.call(this)); },
        configurable: true
      });
    }
  }
  if (typeof Element !== 'undefined') {
    const ieCustomAttrs = ['pageLink', 'iscentraldb', 'selectedids', 'hiddenfieldid', 'columntype', 'selectedReport'];
    ieCustomAttrs.forEach(function(attr) {
      if (!(attr in Element.prototype)) {
        Object.defineProperty(Element.prototype, attr, {
          get: function() {
            return this.getAttribute(attr) || undefined;
          },
          set: function(val) {
            this.setAttribute(attr, val);
          },
          configurable: true
        });
      }
    });
  }
`;


