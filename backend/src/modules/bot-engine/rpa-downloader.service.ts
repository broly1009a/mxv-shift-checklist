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
        await page.screenshot({ path: path.join(debugDir, `market-csv-page-${ts}.png`), fullPage: true }).catch(() => {});
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
        } catch {}
      }
    }

    if (result.size === 0) {
      // Fallback: save debug screenshot for manual analysis
      const debugDir = path.join(process.cwd(), 'temp', 'debug');
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      await page.screenshot({ path: path.join(debugDir, `cqg-qss-${ts}.png`), fullPage: true }).catch(() => {});
      const html = await page.content().catch(() => '');
      fs.writeFileSync(path.join(debugDir, `cqg-qss-${ts}.html`), html, 'utf8');
      this.logger.warn(`Không đọc được giá từ CQG QSS. Debug screenshot lưu tại temp/debug/cqg-qss-${ts}.png`);
    }

    return result;
  }
}
