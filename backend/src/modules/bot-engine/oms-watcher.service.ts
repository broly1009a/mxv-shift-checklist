import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright-core';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { decrypt } from './utils/crypto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class OmsWatcherService {
  private readonly logger = new Logger(OmsWatcherService.name);
  private isChecking = false;

  constructor(private readonly settingsService: SystemSettingsService) { }

  isRunning(): boolean {
    return this.isChecking;
  }

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
      'chrome.exe',
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
        mm: {
          totalOrders: number;
          activeAccounts: string[];
          status: string;
          success: boolean;
        };
      };
      ce: {
        eod: { status: string; time: string; date: string; success: boolean };
        mm: {
          totalOrders: number;
          activeAccounts: string[];
          status: string;
          success: boolean;
        };
      };
    };
  } | null> {
    if (this.isChecking) {
      this.logger.warn('OMS status check is already running. Skipping.');
      return null;
    }
    this.isChecking = true;
    try {
      const isSimulation = process.env.SIMULATE_BOT_CHECKS === 'true';
      if (isSimulation) {
        const vnTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
        const todayStr = `${String(vnTime.getDate()).padStart(2, '0')}/${String(vnTime.getMonth() + 1).padStart(2, '0')}/${vnTime.getFullYear()}`;
        return {
          success: true,
          message:
            '✅ [Simulation] Đã hoàn thành EOD & lệnh MM trên cả hai hệ thống CCP và CE.',
          data: {
            ccp: {
              eod: {
                status: 'COMPLETED',
                time: '05:30:00',
                date: todayStr,
                success: true,
              },
              mm: {
                totalOrders: 12,
                activeAccounts: ['699C555555M', '605C000204M'],
                status: 'OK',
                success: true,
              },
            },
            ce: {
              eod: {
                status: 'COMPLETED',
                time: '05:30:00',
                date: todayStr,
                success: true,
              },
              mm: {
                totalOrders: 8,
                activeAccounts: ['699C555555M'],
                status: 'OK',
                success: true,
              },
            },
          },
        };
      }

      // 1. Get credentials for CCP & CE
      const ccpRaw = await this.settingsService.getSetting(
        'bot_credentials_ccp',
        '',
      );
      const ceRaw = await this.settingsService.getSetting(
        'bot_credentials_ce',
        '',
      );

      if (!ccpRaw || !ceRaw) {
        this.logger.warn('Chưa cấu hình tài khoản đăng nhập CCP hoặc CE.');
        return {
          success: false,
          message:
            'Lỗi: Chưa cấu hình đầy đủ tài khoản đăng nhập CCP và CE trong cài đặt hệ thống.',
          data: {
            ccp: {
              eod: { status: 'UNKNOWN', time: '', date: '', success: false },
              mm: {
                totalOrders: 0,
                activeAccounts: [],
                status: 'N/A',
                success: false,
              },
            },
            ce: {
              eod: { status: 'UNKNOWN', time: '', date: '', success: false },
              mm: {
                totalOrders: 0,
                activeAccounts: [],
                status: 'N/A',
                success: false,
              },
            },
          },
        };
      }

      let ccpCreds: any;
      let ceCreds: any;
      try {
        ccpCreds = JSON.parse(decrypt(ccpRaw));
        ceCreds = JSON.parse(decrypt(ceRaw));
      } catch (err: any) {
        this.logger.error(
          `Không thể giải mã cấu hình tài khoản CCP/CE: ${err.message}`,
        );
        return {
          success: false,
          message: `Lỗi giải mã cấu hình tài khoản: ${err.message}`,
          data: {
            ccp: {
              eod: { status: 'ERROR', time: '', date: '', success: false },
              mm: {
                totalOrders: 0,
                activeAccounts: [],
                status: 'N/A',
                success: false,
              },
            },
            ce: {
              eod: { status: 'ERROR', time: '', date: '', success: false },
              mm: {
                totalOrders: 0,
                activeAccounts: [],
                status: 'N/A',
                success: false,
              },
            },
          },
        };
      }

      let ccpUrl = ccpCreds.url || 'https://uat-coreccp.mxv.com.vn';
      ccpUrl = ccpUrl.replace(/\/login\/?$/, '').replace(/\/$/, '');
      let ceUrl = ceCreds.url || 'https://uat-coreexchange.mxv.com.vn';
      ceUrl = ceUrl.replace(/\/login\/?$/, '').replace(/\/$/, '');

      // 2. Launch Browser
      const executablePath = this.getChromeExecutablePath();
      const isHeadless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
      const launchOptions: any = {
        headless: isHeadless,
        slowMo: isHeadless ? undefined : 1000,
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
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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
          mm: {
            totalOrders: 0,
            activeAccounts: [] as string[],
            status: 'PENDING',
            success: false,
          },
        },
        ce: {
          eod: { status: 'PENDING', time: '', date: '', success: false },
          mm: {
            totalOrders: 0,
            activeAccounts: [] as string[],
            status: 'PENDING',
            success: false,
          },
        },
      };

      try {
        // Calculate real-world calendar date (VN time UTC+7) to match MM orders
        const now = new Date();
        const targetTimezoneOffset = -420; // Asia/Ho_Chi_Minh is UTC+7
        const systemTimezoneOffset = now.getTimezoneOffset();
        const vnTime = new Date(
          now.getTime() +
          (systemTimezoneOffset - targetTimezoneOffset) * 60 * 1000,
        );
        const realTodayStr = `${String(vnTime.getDate()).padStart(2, '0')}/${String(vnTime.getMonth() + 1).padStart(2, '0')}/${vnTime.getFullYear()}`;

        // Calculate real-world calendar targetStr (T-1)
        const realTMinus1 = new Date(vnTime);
        realTMinus1.setDate(realTMinus1.getDate() - 1);
        if (realTMinus1.getDay() === 0) {
          realTMinus1.setDate(realTMinus1.getDate() - 1);
        }
        const realTargetStr = `${String(realTMinus1.getDate()).padStart(2, '0')}/${String(realTMinus1.getMonth() + 1).padStart(2, '0')}/${realTMinus1.getFullYear()}`;

        // --- CHECK CORE CCP ---
        this.logger.log(`Navigating to CCP: ${ccpUrl}...`);
        await page.goto(`${ccpUrl}/login`);
        await this.loginSystem(page, ccpCreds.username, ccpCreds.password);

        // Check EOD CCP
        this.logger.log('Checking EOD on CCP...');
        await page.goto(`${ccpUrl}/EOD/EODPROCESS`);

        // Reconcile date from page header
        const ccpHeaderDate = await this.getHeaderDate(page);
        this.logger.log(`CCP Header Date: "${ccpHeaderDate}" | Real Today: "${realTodayStr}" | Real Target: "${realTargetStr}"`);

        if (ccpHeaderDate && ccpHeaderDate !== realTodayStr) {
          this.logger.warn(`CCP system date (${ccpHeaderDate}) has not rolled over to today (${realTodayStr}). Failing EOD and MM checks.`);
          resultData.ccp.eod = {
            status: 'Chưa chạy',
            time: '-',
            date: ccpHeaderDate,
            success: false,
          };
          resultData.ccp.mm = {
            totalOrders: 0,
            activeAccounts: [],
            status: 'NO_ORDERS_TODAY',
            success: false,
          };
        } else {
          const { todayStr: ccpTodayStr, targetStr: ccpTargetStr } =
            this.calculateDatesFromHeader(ccpHeaderDate || realTodayStr);

          // Try checking the main page first
          let ccpEodResult = await this.checkMainPageEod(page, false, ccpTodayStr, ccpTargetStr);

          // If main page check is not successful or not found, try the "Lịch sử EOD" tab as fallback
          if (!ccpEodResult || !ccpEodResult.success) {
            const ccpTab = page.getByText('Lịch sử EOD').first();
            const tabExists = await ccpTab.isVisible().catch(() => false);
            if (tabExists) {
              this.logger.log('Main page EOD check on CCP was not successful/completed. Clicking "Lịch sử EOD" tab...');
              await ccpTab.click({ force: true }).catch(() => {});
              const historyResult = await this.scrapeEodHistory(page, false, ccpTodayStr, ccpTargetStr);
              if (historyResult.success || !ccpEodResult) {
                ccpEodResult = historyResult;
              }
            }
          }
          resultData.ccp.eod = ccpEodResult || (await this.scrapeEodHistory(page, false, ccpTodayStr, ccpTargetStr));

          // Check MM CCP
          this.logger.log('Checking MM orders history on CCP...');
          await page.goto(`${ccpUrl}/ORDERS/ORDERMATCH_DETAIL_MM`);
          resultData.ccp.mm = await this.scrapeMmOrders(page, false, realTodayStr);
        }

        // --- CHECK CORE CE ---
        this.logger.log(`Navigating to CE: ${ceUrl}...`);
        await page.goto(`${ceUrl}/login`);
        await this.loginSystem(page, ceCreds.username, ceCreds.password);

        // Check EOD CE
        this.logger.log('Checking EOD on CE...');
        await page.goto(`${ceUrl}/EOD/EODPROCESS`);

        // Reconcile date from page header
        const ceHeaderDate = await this.getHeaderDate(page);
        this.logger.log(`CE Header Date: "${ceHeaderDate}" | Real Today: "${realTodayStr}" | Real Target: "${realTargetStr}"`);

        if (ceHeaderDate && ceHeaderDate !== realTodayStr) {
          this.logger.warn(`CE system date (${ceHeaderDate}) has not rolled over to today (${realTodayStr}). Failing EOD and MM checks.`);
          resultData.ce.eod = {
            status: 'Chưa chạy',
            time: '-',
            date: ceHeaderDate,
            success: false,
          };
          resultData.ce.mm = {
            totalOrders: 0,
            activeAccounts: [],
            status: 'NO_ORDERS',
            success: false,
          };
        } else {
          const { todayStr: ceTodayStr, targetStr: ceTargetStr } =
            this.calculateDatesFromHeader(ceHeaderDate || realTodayStr);

          // Try checking the main page first
          let ceEodResult = await this.checkMainPageEod(page, true, ceTodayStr, ceTargetStr);

          // If main page check is not successful or not found, try the "Lịch sử EOD" tab as fallback
          if (!ceEodResult || !ceEodResult.success) {
            const ceTab = page.getByText('Lịch sử EOD').first();
            const tabExists = await ceTab.isVisible().catch(() => false);
            if (tabExists) {
              this.logger.log('Main page EOD check on CE was not successful/completed. Clicking "Lịch sử EOD" tab...');
              await ceTab.click({ force: true }).catch(() => {});
              const historyResult = await this.scrapeEodHistory(page, true, ceTodayStr, ceTargetStr);
              if (historyResult.success || !ceEodResult) {
                ceEodResult = historyResult;
              }
            }
          }
          resultData.ce.eod = ceEodResult || (await this.scrapeEodHistory(page, true, ceTodayStr, ceTargetStr));

          // Check MM CE
          this.logger.log('Checking MM orders history on CE...');
          await page.goto(`${ceUrl}/ORDERS/ORDERMATCH_DETAIL`);
          resultData.ce.mm = await this.scrapeMmOrders(page, true, realTodayStr);
        }

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
        await browser.close().catch(() => { });
        return {
          success: false,
          message: `Lỗi tự động hóa Playwright: ${err.message}`,
          data: resultData,
        };
      }
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Helper to login to VNCLEAR standard login page.
   */
  private async loginSystem(
    page: Page,
    user: string,
    pass: string,
  ): Promise<void> {
    try {
      // Look for login fields specifically
      const userInputSelector =
        'input#username, input[type="text"], input[name="username"]';
      const passInputSelector =
        'input#password, input[type="password"], input[name="password"]';
      const submitBtnSelector =
        'button.submit-button, button[type="submit"], button.btn-primary';

      await page.waitForSelector(userInputSelector, {
        state: 'visible',
        timeout: 10000,
      });
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
        page.waitForURL(
          (url) => url.pathname.toUpperCase().includes('/DASHBOARD'),
          { timeout: 15000 },
        ),
        ...successIndicators.map((sel) =>
          page.waitForSelector(sel, { state: 'visible', timeout: 15000 }),
        ),
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
  private async scrapeEodHistory(
    page: Page,
    isCe: boolean,
    todayStr: string,
    targetStr: string,
  ): Promise<{ status: string; time: string; date: string; success: boolean }> {
    try {
      // Wait for table to load
      await page.waitForSelector('table tbody tr', {
        state: 'visible',
        timeout: 15000,
      });
      await page.waitForTimeout(1000); // UI stabilization

      // Scrape rows with column-id attributes
      const rows = await page.$$eval('table tbody tr', (trs) => {
        return trs.map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td'));
          const rowData: Record<string, string> = {};
          cells.forEach((cell) => {
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

        // EOD runs on current day or previous trading day T-1
        const isCompleted =
          status.includes('Đã hoàn thành') ||
          status.toLowerCase().includes('completed') ||
          status.toLowerCase().includes('success');
        const runsTodayOrT1 =
          startTime.includes(todayStr) ||
          endTime.includes(todayStr) ||
          sysDate === todayStr ||
          startTime.includes(targetStr) ||
          endTime.includes(targetStr) ||
          sysDate === targetStr;

        return {
          status,
          time: startTime || endTime,
          date: sysDate || todayStr,
          success: isCompleted && runsTodayOrT1,
        };
      }

      return { status: 'NOT_FOUND', time: '', date: todayStr, success: false };
    } catch (err: any) {
      this.logger.error(`Lỗi khi đọc bảng EOD: ${err.message}`);
      return {
        status: `ERROR: ${err.message}`,
        time: '',
        date: '',
        success: false,
      };
    }
  }

  /**
   * Helper to check EOD status directly on the main EODPROCESS page.
   */
  private async checkMainPageEod(
    page: Page,
    isCe: boolean,
    todayStr: string,
    targetStr: string,
  ): Promise<{ status: string; time: string; date: string; success: boolean } | null> {
    try {
      // 1. Wait for table tbody tr to load
      await page.waitForSelector('table tbody tr', {
        state: 'visible',
        timeout: 5000,
      });
      await page.waitForTimeout(500);

      // 2. Extract date from page content
      const bodyText = await page.innerText('body');
      const dateMatch = bodyText.match(
        /ngày\s+(?:giao\s+dịch|phiên\s+eod):\s*(\d{2}\/\d{2}\/\d{4})/i,
      );
      let dateFromScreen = '';
      if (dateMatch) {
        dateFromScreen = dateMatch[1];
      }

      if (!dateFromScreen) {
        this.logger.warn(
          `Không thể trích xuất ngày EOD từ giao diện trang chính (isCe: ${isCe}).`,
        );
        return null;
      }

      // 3. Scrape table rows mapping columns
      const rows = await page.$$eval('table tbody tr', (trs) => {
        return trs.map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td'));
          const rowData: Record<string, string> = {};
          if (cells[1]) rowData['jobName'] = cells[1].innerText.trim();
          if (cells[2]) rowData['status'] = cells[2].innerText.trim();
          if (cells[4]) rowData['endTime'] = cells[4].innerText.trim();

          cells.forEach((cell) => {
            const colId = cell.getAttribute('data-column-id');
            if (colId) {
              rowData[colId] = cell.innerText.trim();
            }
          });
          return rowData;
        });
      });

      if (rows.length === 0) {
        return null;
      }

      // Find the last row (final step)
      const lastRow = rows[rows.length - 1];
      const jobName = lastRow['jobName'] || lastRow['WORK_NAME'] || '';
      const status = lastRow['status'] || lastRow['STATUS_DESC'] || '';
      const endTime = lastRow['endTime'] || lastRow['END_TIME'] || '';

      const isFinalStep =
        jobName.toLowerCase().includes('thành công') ||
        jobName.toLowerCase().includes('hoàn thành batch') ||
        jobName.toLowerCase().includes('hoàn thành');

      if (!isFinalStep) {
        this.logger.warn(
          `Dòng cuối cùng không khớp với bước EOD cuối cùng: "${jobName}" (isCe: ${isCe}).`,
        );
        return null;
      }

      const isCompleted =
        status.includes('Đã hoàn thành') ||
        status.includes('Thành công') ||
        status.toLowerCase().includes('completed') ||
        status.toLowerCase().includes('success');

      const runsTodayOrT1 =
        dateFromScreen === todayStr || dateFromScreen === targetStr;

      const success = isCompleted && runsTodayOrT1;
      this.logger.log(
        `[MainPage EOD] isCe: ${isCe}, date: ${dateFromScreen}, status: "${status}", success: ${success}`,
      );

      return {
        status,
        time: endTime || '',
        date: dateFromScreen,
        success,
      };
    } catch (err: any) {
      this.logger.debug(
        `Không thể kiểm tra EOD trực tiếp trên trang chính (isCe: ${isCe}): ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Helper to get header date (top right) in DD/MM/YYYY format.
   */
  private async getHeaderDate(page: Page): Promise<string> {
    try {
      const debugInfo = await page.evaluate(() => {
        const found: any[] = [];
        const elements = Array.from(document.querySelectorAll('*'));
        for (const el of elements) {
          const htmlEl = el as HTMLElement;
          // Check if it is a leaf node to avoid parent containers
          if (htmlEl.children.length === 0) {
            const text = (htmlEl.innerText || htmlEl.textContent || '').trim();
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
              const rect = htmlEl.getBoundingClientRect();
              found.push({
                text,
                top: rect.top,
                right: rect.right,
                tagName: htmlEl.tagName,
              });
            }
          }
        }
        return found;
      });

      this.logger.log(`Header Date candidates found: ${JSON.stringify(debugInfo)}`);

      // Find the candidate in the top right area
      for (const item of debugInfo) {
        if (item.top < 100 && item.right > 800) {
          return item.text;
        }
      }

      // Fallback to first found date at top if any
      for (const item of debugInfo) {
        if (item.top < 100) {
          return item.text;
        }
      }

      return '';
    } catch (err: any) {
      this.logger.warn(`Failed to extract header date: ${err.message}`);
      return '';
    }
  }

  /**
   * Helper to calculate todayStr and targetStr based on headerDate.
   */
  private calculateDatesFromHeader(headerDate: string): {
    todayStr: string;
    targetStr: string;
  } {
    try {
      if (!headerDate || !/^\d{2}\/\d{2}\/\d{4}$/.test(headerDate)) {
        throw new Error('Invalid header date format');
      }

      const parts = headerDate.split('/');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const headerTime = new Date(year, month, day);

      const todayStr = headerDate;

      // Calculate T-1 date:
      const tMinus1 = new Date(headerTime);
      tMinus1.setDate(tMinus1.getDate() - 1);
      if (tMinus1.getDay() === 0) {
        // Sunday -> roll back to Saturday
        tMinus1.setDate(tMinus1.getDate() - 1);
      }
      const targetStr = `${String(tMinus1.getDate()).padStart(2, '0')}/${String(tMinus1.getMonth() + 1).padStart(2, '0')}/${tMinus1.getFullYear()}`;

      return { todayStr, targetStr };
    } catch (err: any) {
      this.logger.debug(
        `Failed to parse header date "${headerDate}", falling back to server time: ${err.message}`,
      );
      // Fallback to server local time logic
      const now = new Date();
      const targetTimezoneOffset = -420; // UTC+7
      const systemTimezoneOffset = now.getTimezoneOffset();
      const vnTime = new Date(
        now.getTime() +
        (systemTimezoneOffset - targetTimezoneOffset) * 60 * 1000,
      );
      const todayStr = `${String(vnTime.getDate()).padStart(2, '0')}/${String(vnTime.getMonth() + 1).padStart(2, '0')}/${vnTime.getFullYear()}`;
      const tMinus1 = new Date(vnTime);
      tMinus1.setDate(tMinus1.getDate() - 1);
      if (tMinus1.getDay() === 0) {
        tMinus1.setDate(tMinus1.getDate() - 1);
      }
      const targetStr = `${String(tMinus1.getDate()).padStart(2, '0')}/${String(tMinus1.getMonth() + 1).padStart(2, '0')}/${tMinus1.getFullYear()}`;
      return { todayStr, targetStr };
    }
  }

  /**
   * Helper to scrape MM orders.
   */
  private async scrapeMmOrders(
    page: Page,
    isCe: boolean,
    todayStr: string,
  ): Promise<{
    totalOrders: number;
    activeAccounts: string[];
    status: string;
    success: boolean;
  }> {
    try {
      // Look for orders table or a "No data" message
      const noDataElement = await page
        .locator(
          'xpath=//*[contains(text(), "Không có dữ liệu") or contains(text(), "No data")]',
        )
        .isVisible()
        .catch(() => false);
      if (noDataElement) {
        return {
          totalOrders: 0,
          activeAccounts: [],
          status: 'NO_ORDERS',
          success: false,
        };
      }

      // Wait for table to load
      await page
        .waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 })
        .catch(() => { });
      await page.waitForTimeout(1000);

      // Scrape rows with column-id attributes
      const rows = await page.$$eval('table tbody tr', (trs) => {
        return trs.map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td'));
          const rowData: Record<string, string> = {};
          cells.forEach((cell) => {
            const colId = cell.getAttribute('data-column-id');
            if (colId) {
              rowData[colId] = cell.innerText.trim();
            }
          });
          return rowData;
        });
      });

      this.logger.log(
        `Found ${rows.length} rows in MM trades table (isCe: ${isCe}).`,
      );

      // Check if rows are actually valid data
      if (
        rows.length === 0 ||
        (rows.length === 1 && Object.keys(rows[0]).length < 3)
      ) {
        return {
          totalOrders: 0,
          activeAccounts: [],
          status: 'NO_ORDERS',
          success: false,
        };
      }

      const activeAccounts = new Set<string>();
      let todayOrdersCount = 0;

      for (const row of rows) {
        const sessionDate = row['SESSION_DATE'] || row['TXDATE'] || '';
        const matchTime = row['MATCHTIME'] || row['TRANSACTTIME'] || '';

        // Match date is today
        const matchesDate =
          sessionDate.includes(todayStr) ||
          matchTime.includes(todayStr);

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
      return {
        totalOrders: 0,
        activeAccounts: [],
        status: `ERROR: ${err.message}`,
        success: false,
      };
    }
  }

  /**
   * Helper to test login connection for CCP or CE.
   */
  async testConnection(
    type: 'ccp' | 'ce',
  ): Promise<{ success: boolean; message: string }> {
    const isSimulation = process.env.SIMULATE_BOT_CHECKS === 'true';
    if (isSimulation) {
      return {
        success: true,
        message: `[Simulation] Kiểm tra kết nối đăng nhập cổng ${type.toUpperCase()} thành công!`,
      };
    }

    const key = type === 'ccp' ? 'bot_credentials_ccp' : 'bot_credentials_ce';
    const rawCreds = await this.settingsService.getSetting(key, '');
    if (!rawCreds) {
      throw new Error(
        `Chưa cấu hình thông tin đăng nhập cho ${type.toUpperCase()}`,
      );
    }

    let creds: any;
    try {
      creds = JSON.parse(decrypt(rawCreds));
    } catch (err: any) {
      throw new Error(
        `Lỗi giải mã tài khoản ${type.toUpperCase()}: ${err.message}`,
      );
    }

    let targetUrl =
      creds.url ||
      (type === 'ccp'
        ? 'https://uat-coreccp.mxv.com.vn'
        : 'https://uat-coreexchange.mxv.com.vn');
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

      this.logger.log(
        `Navigating to ${type.toUpperCase()} for connection test: ${targetUrl}/login`,
      );
      await page.goto(`${targetUrl}/login`);
      await this.loginSystem(page, creds.username, creds.password);
      await browser.close();
      return {
        success: true,
        message: `Kết nối thử nghiệm ${type.toUpperCase()} thành công!`,
      };
    } catch (err: any) {
      await browser.close().catch(() => { });
      throw new Error(
        `Kết nối thử nghiệm ${type.toUpperCase()} thất bại: ${err.message}`,
      );
    }
  }
}
