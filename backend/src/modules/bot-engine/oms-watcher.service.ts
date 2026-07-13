import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright-core';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { decrypt } from './utils/crypto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class OmsWatcherService {
  private readonly logger = new Logger(OmsWatcherService.name);

  constructor(private readonly settingsService: SystemSettingsService) {}

  /**
   * Retrieves the Chrome executable path. Searches local repo first, then falls back to environment or default playwright.
   */
  private getChromeExecutablePath(): string | null {
    if (process.platform !== 'win32') {
      return null;
    }
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
      this.logger.log(`Using bundled Chrome binary for OMS: ${bundledPath}`);
      return bundledPath;
    }
    return null;
  }

  /**
   * Performs EOD and MM checks on both CCP and CE systems.
   */
  async checkOmsStatus(): Promise<{
    success: boolean;
    message: string;
    data: {
      ccp: {
        eod: { status: string; time: string; date: string; success: boolean };
        mm: { totalOrders: number; activeAccounts: string[]; status: string; success: boolean };
      };
      ce: {
        eod: { status: string; time: string; date: string; success: boolean };
        mm: { totalOrders: number; activeAccounts: string[]; status: string; success: boolean };
      };
    };
  } | null> {
    const isSimulation = process.env.SIMULATE_BOT_CHECKS === 'true';
    if (isSimulation) {
      const vnTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const todayStr = `${String(vnTime.getDate()).padStart(2, '0')}/${String(vnTime.getMonth() + 1).padStart(2, '0')}/${vnTime.getFullYear()}`;
      return {
        success: true,
        message: '✅ [Simulation] Đã hoàn thành EOD & lệnh MM trên cả hai hệ thống CCP và CE.',
        data: {
          ccp: {
            eod: { status: 'COMPLETED', time: '05:30:00', date: todayStr, success: true },
            mm: { totalOrders: 12, activeAccounts: ['699C555555M', '605C000204M'], status: 'OK', success: true }
          },
          ce: {
            eod: { status: 'COMPLETED', time: '05:30:00', date: todayStr, success: true },
            mm: { totalOrders: 8, activeAccounts: ['699C555555M'], status: 'OK', success: true }
          }
        }
      };
    }

    // 1. Get credentials for CCP & CE
    const ccpRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
    const ceRaw = await this.settingsService.getSetting('bot_credentials_ce', '');

    if (!ccpRaw || !ceRaw) {
      this.logger.warn('Chưa cấu hình tài khoản đăng nhập CCP hoặc CE.');
      return {
        success: false,
        message: 'Lỗi: Chưa cấu hình đầy đủ tài khoản đăng nhập CCP và CE trong cài đặt hệ thống.',
        data: {
          ccp: { eod: { status: 'UNKNOWN', time: '', date: '', success: false }, mm: { totalOrders: 0, activeAccounts: [], status: 'N/A', success: false } },
          ce: { eod: { status: 'UNKNOWN', time: '', date: '', success: false }, mm: { totalOrders: 0, activeAccounts: [], status: 'N/A', success: false } },
        }
      };
    }

    let ccpCreds: any;
    let ceCreds: any;
    try {
      ccpCreds = JSON.parse(decrypt(ccpRaw));
      ceCreds = JSON.parse(decrypt(ceRaw));
    } catch (err: any) {
      this.logger.error(`Không thể giải mã cấu hình tài khoản CCP/CE: ${err.message}`);
      return {
        success: false,
        message: `Lỗi giải mã cấu hình tài khoản: ${err.message}`,
        data: {
          ccp: { eod: { status: 'ERROR', time: '', date: '', success: false }, mm: { totalOrders: 0, activeAccounts: [], status: 'N/A', success: false } },
          ce: { eod: { status: 'ERROR', time: '', date: '', success: false }, mm: { totalOrders: 0, activeAccounts: [], status: 'N/A', success: false } },
        }
      };
    }

    const ccpUrl = ccpCreds.url || 'https://uat-coreccp.mxv.com.vn';
    const ceUrl = ceCreds.url || 'https://uat-coreexchange.mxv.com.vn';

    // 2. Launch Browser
    const executablePath = this.getChromeExecutablePath();
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--window-size=1280,800',
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    this.logger.log('Starting Playwright session for OMS status checks...');
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    // Anti-bot hide webdriver flag
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    page.setDefaultTimeout(30000);

    const resultData = {
      ccp: {
        eod: { status: 'PENDING', time: '', date: '', success: false },
        mm: { totalOrders: 0, activeAccounts: [] as string[], status: 'PENDING', success: false },
      },
      ce: {
        eod: { status: 'PENDING', time: '', date: '', success: false },
        mm: { totalOrders: 0, activeAccounts: [] as string[], status: 'PENDING', success: false },
      },
    };

    try {
      // --- CHECK CORE CCP ---
      this.logger.log(`Navigating to CCP: ${ccpUrl}...`);
      await page.goto(`${ccpUrl}/login`);
      await this.loginSystem(page, ccpCreds.username, ccpCreds.password);

      // Check EOD CCP
      this.logger.log('Checking EOD history on CCP...');
      await page.goto(`${ccpUrl}/EOD/EODSYSTEM`);
      resultData.ccp.eod = await this.scrapeEodHistory(page, false);

      // Check MM CCP
      this.logger.log('Checking MM orders history on CCP...');
      await page.goto(`${ccpUrl}/ORDERS/ORDERMATCH_DETAIL_MM`);
      resultData.ccp.mm = await this.scrapeMmOrders(page, false);

      // --- CHECK CORE CE ---
      this.logger.log(`Navigating to CE: ${ceUrl}...`);
      await page.goto(`${ceUrl}/login`);
      await this.loginSystem(page, ceCreds.username, ceCreds.password);

      // Check EOD CE
      this.logger.log('Checking EOD history on CE...');
      await page.goto(`${ceUrl}/EOD/EODSYSTEM`);
      resultData.ce.eod = await this.scrapeEodHistory(page, true);

      // Check MM CE
      this.logger.log('Checking MM orders history on CE...');
      await page.goto(`${ceUrl}/ORDERS/ORDERMATCH_DETAIL`);
      resultData.ce.mm = await this.scrapeMmOrders(page, true);

      await browser.close();

      const ccpEodOk = resultData.ccp.eod.success;
      const ccpMmOk = resultData.ccp.mm.success;
      const ceEodOk = resultData.ce.eod.success;
      const ceMmOk = resultData.ce.mm.success;

      const overallSuccess = ccpEodOk && ccpMmOk && ceEodOk && ceMmOk;
      let message = 'Kiểm tra OMS thành công.';
      if (overallSuccess) {
        message = `✅ Đã hoàn thành EOD & lệnh MM trên cả hai hệ thống CCP và CE.`;
      } else {
        const failures: string[] = [];
        if (!ccpEodOk) failures.push('EOD CCP chưa xong');
        if (!ccpMmOk) failures.push('Lệnh MM CCP chưa lên');
        if (!ceEodOk) failures.push('EOD CE chưa xong');
        if (!ceMmOk) failures.push('Lệnh MM CE chưa lên');
        message = `⚠️ Kiểm tra OMS phát hiện chưa hoàn tất: ${failures.join(', ')}`;
      }

      return {
        success: overallSuccess,
        message,
        data: resultData,
      };

    } catch (err: any) {
      this.logger.error(`Lỗi trong quá trình check OMS: ${err.message}`);
      await browser.close().catch(() => {});
      return {
        success: false,
        message: `Lỗi tự động hóa Playwright: ${err.message}`,
        data: resultData,
      };
    }
  }

  /**
   * Helper to login to VNCLEAR standard login page.
   */
  private async loginSystem(page: Page, user: string, pass: string): Promise<void> {
    try {
      // Look for login fields specifically
      const userInputSelector = 'input#username, input[type="text"], input[name="username"]';
      const passInputSelector = 'input#password, input[type="password"], input[name="password"]';
      const submitBtnSelector = 'button.submit-button, button[type="submit"], button.btn-primary';

      await page.waitForSelector(userInputSelector, { state: 'visible', timeout: 10000 });
      await page.fill(userInputSelector, user);
      await page.fill(passInputSelector, pass);
      await page.waitForTimeout(500);
      await page.click(submitBtnSelector);

      // Verify successful login (wait for /DASHBOARD URL redirect or any success selector indicator)
      const successIndicators = [
        'xpath=//*[contains(text(), "Xin chào")]',
        'xpath=//*[contains(text(), "Đăng xuất")]',
        'div.main-container',
        'a[href*="logout" i]',
        'button:has-text("Đăng xuất")',
      ];
      
      await Promise.any([
        page.waitForURL(url => url.pathname.toUpperCase().includes('/DASHBOARD'), { timeout: 15000 }),
        ...successIndicators.map(sel => page.waitForSelector(sel, { state: 'visible', timeout: 15000 }))
      ]);
      this.logger.log('Logged in successfully and verified dashboard access.');
    } catch (err: any) {
      this.logger.error(`Đăng nhập thất bại: ${err.message}`);
      throw new Error(`Đăng nhập cổng thông tin thất bại: ${err.message}`);
    }
  }

  /**
   * Helper to scrape EOD History table.
   */
  private async scrapeEodHistory(page: Page, isCe: boolean): Promise<{ status: string; time: string; date: string; success: boolean }> {
    try {
      // Wait for table to load
      await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 15000 });
      await page.waitForTimeout(1000); // UI stabilization

      // Get system date in DD/MM/YYYY format (Vietnam time)
      const vnTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const todayStr = `${String(vnTime.getDate()).padStart(2, '0')}/${String(vnTime.getMonth() + 1).padStart(2, '0')}/${vnTime.getFullYear()}`;

      // Scrape rows with column-id attributes
      const rows = await page.$$eval('table tbody tr', (trs) => {
        return trs.map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td'));
          const rowData: Record<string, string> = {};
          cells.forEach(cell => {
            const colId = cell.getAttribute('data-column-id');
            if (colId) {
              rowData[colId] = cell.innerText.trim();
            }
          });
          return rowData;
        });
      });

      this.logger.log(`Found ${rows.length} rows in EOD history table.`);

      if (rows.length > 0) {
        const firstRow = rows[0];
        const sysDate = isCe ? firstRow['CURRDATE'] : firstRow['TXDATE'];
        const status = firstRow['STATUS_DESC'] || '';
        const startTime = firstRow['START_TIME'] || '';
        const endTime = firstRow['END_TIME'] || '';

        // EOD runs on current day or matches target date
        const isCompleted = status.includes('Đã hoàn thành') || status.toLowerCase().includes('completed') || status.toLowerCase().includes('success');
        const runsToday = startTime.includes(todayStr) || endTime.includes(todayStr) || sysDate === todayStr;

        return {
          status,
          time: startTime || endTime,
          date: sysDate || todayStr,
          success: isCompleted && runsToday,
        };
      }

      return { status: 'NOT_FOUND', time: '', date: todayStr, success: false };
    } catch (err: any) {
      this.logger.error(`Lỗi khi đọc bảng EOD: ${err.message}`);
      return { status: `ERROR: ${err.message}`, time: '', date: '', success: false };
    }
  }

  /**
   * Helper to scrape MM orders.
   */
  private async scrapeMmOrders(page: Page, isCe: boolean): Promise<{ totalOrders: number; activeAccounts: string[]; status: string; success: boolean }> {
    try {
      // Look for orders table or a "No data" message
      const noDataElement = await page.locator('xpath=//*[contains(text(), "Không có dữ liệu") or contains(text(), "No data")]').isVisible().catch(() => false);
      if (noDataElement) {
        return { totalOrders: 0, activeAccounts: [], status: 'NO_ORDERS', success: false };
      }

      // Wait for table to load
      await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);

      // Scrape rows with column-id attributes
      const rows = await page.$$eval('table tbody tr', (trs) => {
        return trs.map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td'));
          const rowData: Record<string, string> = {};
          cells.forEach(cell => {
            const colId = cell.getAttribute('data-column-id');
            if (colId) {
              rowData[colId] = cell.innerText.trim();
            }
          });
          return rowData;
        });
      });

      this.logger.log(`Found ${rows.length} rows in MM trades table (isCe: ${isCe}).`);

      // Check if rows are actually valid data
      if (rows.length === 0 || (rows.length === 1 && Object.keys(rows[0]).length < 3)) {
        return { totalOrders: 0, activeAccounts: [], status: 'NO_ORDERS', success: false };
      }

      const vnTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const todayStr = `${String(vnTime.getDate()).padStart(2, '0')}/${String(vnTime.getMonth() + 1).padStart(2, '0')}/${vnTime.getFullYear()}`;

      const activeAccounts = new Set<string>();
      let todayOrdersCount = 0;

      for (const row of rows) {
        const sessionDate = row['SESSION_DATE'] || row['TXDATE'] || '';
        const matchTime = row['MATCHTIME'] || row['TRANSACTTIME'] || '';

        // Match date is today
        const matchesDate = sessionDate.includes(todayStr) || matchTime.includes(todayStr);

        if (matchesDate) {
          if (isCe) {
            const accBuy = row['ACCTNO_BUY'] || '';
            const accSell = row['ACCTNO_SELL'] || '';
            const buyIsMm = accBuy.endsWith('-M');
            const sellIsMm = accSell.endsWith('-M');

            if (buyIsMm || sellIsMm) {
              todayOrdersCount++;
              if (buyIsMm) activeAccounts.add(accBuy);
              if (sellIsMm) activeAccounts.add(accSell);
            }
          } else {
            const acc = row['AFACCTNO'] || '';
            if (acc.endsWith('-M')) {
              todayOrdersCount++;
              activeAccounts.add(acc);
            }
          }
        }
      }

      const uniqueAccounts = Array.from(activeAccounts);
      const success = todayOrdersCount > 0;

      return {
        totalOrders: todayOrdersCount,
        activeAccounts: uniqueAccounts,
        status: success ? 'OK' : 'NO_ORDERS_TODAY',
        success,
      };
    } catch (err: any) {
      this.logger.error(`Lỗi khi đọc bảng lệnh MM: ${err.message}`);
      return { totalOrders: 0, activeAccounts: [], status: `ERROR: ${err.message}`, success: false };
    }
  }

  /**
   * Helper to test login connection for CCP or CE.
   */
  async testConnection(type: 'ccp' | 'ce'): Promise<{ success: boolean; message: string }> {
    const isSimulation = process.env.SIMULATE_BOT_CHECKS === 'true';
    if (isSimulation) {
      return { success: true, message: `[Simulation] Kiểm tra kết nối đăng nhập cổng ${type.toUpperCase()} thành công!` };
    }

    const key = type === 'ccp' ? 'bot_credentials_ccp' : 'bot_credentials_ce';
    const rawCreds = await this.settingsService.getSetting(key, '');
    if (!rawCreds) {
      throw new Error(`Chưa cấu hình thông tin đăng nhập cho ${type.toUpperCase()}`);
    }

    let creds: any;
    try {
      creds = JSON.parse(decrypt(rawCreds));
    } catch (err: any) {
      throw new Error(`Lỗi giải mã tài khoản ${type.toUpperCase()}: ${err.message}`);
    }

    let targetUrl = creds.url || (type === 'ccp' ? 'https://uat-coreccp.mxv.com.vn' : 'https://uat-coreexchange.mxv.com.vn');
    targetUrl = targetUrl.replace(/\/login\/?$/, '').replace(/\/$/, '');

    const executablePath = this.getChromeExecutablePath();
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--window-size=1280,800',
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    const browser = await chromium.launch(launchOptions);
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      page.setDefaultTimeout(30000);

      this.logger.log(`Navigating to ${type.toUpperCase()} for connection test: ${targetUrl}/login`);
      await page.goto(`${targetUrl}/login`);
      await this.loginSystem(page, creds.username, creds.password);
      await browser.close();
      return { success: true, message: `Kết nối thử nghiệm ${type.toUpperCase()} thành công!` };
    } catch (err: any) {
      await browser.close().catch(() => {});
      throw new Error(`Kết nối thử nghiệm ${type.toUpperCase()} thất bại: ${err.message}`);
    }
  }
}
