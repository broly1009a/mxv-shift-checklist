/**
 * ============================================================================
 * tkgd-ccp-crawler.service.ts
 * ============================================================================
 * Service xử lý đăng nhập & cào dữ liệu kiểm tra tiểu khoản (-A) từ CoreCCP (VNCLEAR).
 *
 * Chức năng chính:
 * 1. Quản lý phiên đăng nhập Playwright an toàn với CoreCCP.
 * 2. Lấy & giải mã thông tin đăng nhập tự động từ DB (bot_credentials / system_settings / .env).
 * 3. Kiểm tra kết nối đăng nhập (testCcpConnection).
 * 4. Thẩm định sự tồn tại và trạng thái của tiểu khoản (-A) trên màn hình Danh sách TKGD CoreCCP (/ACCOUNTMNG/ACCOUNTS_INFO).
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../../schemas/tkgd-user-config.schema';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../../schemas/clean-account-record.schema';
import { TkgdExtractionLog, TkgdExtractionLogDocument } from '../../../schemas/tkgd-extraction-log.schema';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  findBrowserExecutable,
  loginCoreCCP,
  dismissModalBackdrop,
  waitForTableLoadingComplete,
  decryptCcpCredentials,
  CcpLoginResult,
} from '../../engine-helpers/ccp-auth.helper';

export interface CcpCredentials {
  systemUrl: string;
  username: string;
  password: string;
}

export interface CcpSubAccountCheckResult {
  subAccountCode: string;
  isFoundOnCCP: boolean;
  accountStatus?: string;
  accountName?: string;
  memberCode?: string;
  details?: Record<string, any>;
  message: string;
  checkDurationMs: number;
}

@Injectable()
export class TkgdCcpCrawlerService {
  private readonly logger = new Logger(TkgdCcpCrawlerService.name);

  constructor(
    @InjectModel(TkgdUserConfig.name) private readonly userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(CleanAccountRecord.name) private readonly cleanRecordModel: Model<CleanAccountRecordDocument>,
    @InjectModel(TkgdExtractionLog.name) private readonly extractionLogModel: Model<TkgdExtractionLogDocument>,
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  /**
   * Lấy cấu hình đăng nhập CoreCCP từ các nguồn theo thứ tự ưu tiên:
   * 1. Collection bot_credentials ({ botType: 'CCP' })
   * 2. Bảng system_settings (key: 'bot_credentials_ccp')
   * 3. Biến môi trường (.env: CCP_URL, CCP_USERNAME, CCP_PASSWORD)
   */
  async getCcpCredentials(): Promise<CcpCredentials> {
    // 1. Thử đọc từ collection bot_credentials
    try {
      const row = await this.mongoConnection.db?.collection('bot_credentials').findOne({ botType: 'CCP' });
      if (row && row.credentialsEncrypted) {
        const decryptedJson = decryptCcpCredentials(row.credentialsEncrypted);
        const parsed = JSON.parse(decryptedJson);
        if (parsed.username && parsed.password) {
          return {
            systemUrl: parsed.url || process.env.CCP_URL || 'https://uat-coreccp.mxv.com.vn/login',
            username: parsed.username,
            password: parsed.password,
          };
        }
      }
    } catch (err: any) {
      this.logger.warn(`[TKGD-CCP] Không thể đọc credentials từ bot_credentials: ${err.message}`);
    }

    // 2. Thử đọc từ system_settings
    try {
      const settingRaw = await this.systemSettingsService.getSetting('bot_credentials_ccp', '');
      if (settingRaw) {
        const parsed = JSON.parse(settingRaw);
        if (parsed.username && parsed.password) {
          return {
            systemUrl: parsed.url || 'https://uat-coreccp.mxv.com.vn/login',
            username: parsed.username,
            password: parsed.password,
          };
        }
      }
    } catch {}

    // 3. Fallback sang biến môi trường
    const envUrl = process.env.CCP_URL || 'https://uat-coreccp.mxv.com.vn/login';
    const envUser = process.env.CCP_USERNAME || 'hieptruong';
    const envPass = process.env.CCP_PASSWORD || 'Taovipko0!';

    return {
      systemUrl: envUrl,
      username: envUser,
      password: envPass,
    };
  }

  /**
   * Kiểm tra kết nối đăng nhập CoreCCP (Test Connection)
   */
  async testCcpConnection(customCreds?: Partial<CcpCredentials>): Promise<CcpLoginResult> {
    const creds = await this.getCcpCredentials();
    const systemUrl = customCreds?.systemUrl || creds.systemUrl;
    const username = customCreds?.username || creds.username;
    const password = customCreds?.password || creds.password;

    this.logger.log(`[TKGD-CCP] Bắt đầu test đăng nhập CoreCCP: user=${username}, url=${systemUrl}`);

    const executablePath = findBrowserExecutable();
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(35000);

      const result = await loginCoreCCP(page, {
        systemUrl,
        username,
        password,
        timeoutMs: 30000,
      });

      this.logger.log(`[TKGD-CCP] Test đăng nhập thành công sau ${result.durationMs}ms: ${result.currentUrl}`);
      return result;
    } catch (err: any) {
      this.logger.error(`[TKGD-CCP] Test đăng nhập thất bại: ${err.message}`);
      return {
        success: false,
        message: err.message,
        currentUrl: '',
        durationMs: 0,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Khởi tạo phiên làm việc có đăng nhập sẵn vào CoreCCP
   */
  async createAuthenticatedSession(headless: boolean = true): Promise<{
    browser: Browser;
    context: BrowserContext;
    page: Page;
    baseUrl: string;
  }> {
    const creds = await this.getCcpCredentials();
    const executablePath = findBrowserExecutable();

    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      acceptDownloads: true,
    });

    const page = await context.newPage();
    page.setDefaultTimeout(35000);

    const loginRes = await loginCoreCCP(page, {
      systemUrl: creds.systemUrl,
      username: creds.username,
      password: creds.password,
    });

    if (!loginRes.success) {
      await browser.close();
      throw new Error(`Khởi tạo phiên CCP thất bại: ${loginRes.message}`);
    }

    const baseUrl = new URL(creds.systemUrl).origin;
    return { browser, context, page, baseUrl };
  }

  /**
   * Thẩm định sự tồn tại của tiểu khoản (-A) trong CoreCCP (Màn hình Danh sách TKGD)
   *
   * @param subAccountCode Mã tiểu khoản cần kiểm tra (ví dụ: '003C2886699-A')
   * @param existingPage Trang Playwright đã đăng nhập (nếu muốn tái sử dụng phiên)
   */
  async verifySubAccountInCCP(
    subAccountCode: string,
    existingPage?: Page,
  ): Promise<CcpSubAccountCheckResult> {
    const startTs = Date.now();
    const targetCode = subAccountCode.trim().toUpperCase();
    this.logger.log(`[TKGD-CCP] Bắt đầu thẩm định tiểu khoản [${targetCode}] trên CoreCCP...`);

    let page = existingPage;
    let browserToClose: Browser | null = null;
    let baseUrl: string = 'https://uat-coreccp.mxv.com.vn';

    if (!page) {
      const session = await this.createAuthenticatedSession(true);
      page = session.page;
      baseUrl = session.baseUrl;
      browserToClose = session.browser;
    } else {
      baseUrl = new URL(page.url()).origin;
    }

    try {
      const accountsUrl = `${baseUrl}/ACCOUNTMNG/ACCOUNTS_INFO`;
      this.logger.log(`[TKGD-CCP] Điều hướng tới Danh sách TKGD: ${accountsUrl}`);
      await page.goto(accountsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(800);
      await dismissModalBackdrop(page);
      await waitForTableLoadingComplete(page, 20000);

      // Thử tìm kiếm ô Filter hoặc Search trên bảng dữ liệu
      const searchInput = page
        .locator(
          "xpath=//input[contains(@placeholder, 'Tìm kiếm') or contains(@placeholder, 'Search') or @aria-label='Search' or contains(@placeholder, 'Mã TKGD')]",
        )
        .first();

      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill(targetCode);
        await searchInput.press('Enter');
        await page.waitForTimeout(1000);
        await waitForTableLoadingComplete(page, 15000);
      }

      // Kiểm tra dòng khớp mã tiểu khoản trong bảng
      const rowLocator = page.locator(`xpath=//tbody//tr[contains(., '${targetCode}')]`).first();
      const isFound = await rowLocator.isVisible({ timeout: 3000 }).catch(() => false);

      const durationMs = Date.now() - startTs;

      if (isFound) {
        const rowText = (await rowLocator.textContent().catch(() => '')) || '';
        this.logger.log(`[TKGD-CCP] Tìm thấy tiểu khoản [${targetCode}] trên CoreCCP: "${rowText.slice(0, 100)}..."`);

        // Ghi log vào bảng tkgd_extraction_logs
        await this.extractionLogModel.create({
          maTKGD: targetCode,
          stage: 'SCRAPE_CORECCP',
          title: `Kiểm tra CoreCCP: Tìm thấy tiểu khoản ${targetCode}`,
          details: `Tìm thấy trên màn hình Danh sách TKGD (/ACCOUNTMNG/ACCOUNTS_INFO). Dòng dữ liệu: ${rowText.slice(0, 200)}`,
          status: 'SUCCESS',
        }).catch(() => {});

        return {
          subAccountCode: targetCode,
          isFoundOnCCP: true,
          details: { rowSnippet: rowText },
          message: `Tiểu khoản ${targetCode} đã tồn tại trên CoreCCP.`,
          checkDurationMs: durationMs,
        };
      } else {
        this.logger.warn(`[TKGD-CCP] KHÔNG tìm thấy tiểu khoản [${targetCode}] trên CoreCCP!`);

        await this.extractionLogModel.create({
          maTKGD: targetCode,
          stage: 'SCRAPE_CORECCP',
          title: `Kiểm tra CoreCCP: Không tìm thấy ${targetCode}`,
          details: `Không tìm thấy bản ghi khớp mã trên màn hình Danh sách TKGD (/ACCOUNTMNG/ACCOUNTS_INFO).`,
          status: 'WARNING',
        }).catch(() => {});

        return {
          subAccountCode: targetCode,
          isFoundOnCCP: false,
          message: `Không tìm thấy tiểu khoản ${targetCode} trên CoreCCP.`,
          checkDurationMs: durationMs,
        };
      }
    } catch (err: any) {
      this.logger.error(`[TKGD-CCP] Lỗi khi thẩm định tiểu khoản [${targetCode}]: ${err.message}`);
      return {
        subAccountCode: targetCode,
        isFoundOnCCP: false,
        message: `Lỗi kiểm tra CoreCCP: ${err.message}`,
        checkDurationMs: Date.now() - startTs,
      };
    } finally {
      if (browserToClose) {
        await browserToClose.close();
      }
    }
  }
}
