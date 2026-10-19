import { Injectable, Logger } from '@nestjs/common';
import { Browser, Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserLauncherHelper } from '../helpers/browser-launcher.helper';
import {
  MSystemTabNavigatorHelper,
  MS_EXPORT_BUTTON_SELECTORS,
  MS_SPECIFIC_EXPORT_BUTTON_SELECTORS,
} from '../helpers/msystem-tab-navigator.helper';

export interface IMSystemCredentials {
  url?: string;
  username: string;
  password?: string;
  pin?: string;
}

@Injectable()
export class MSystemScraperService {
  private readonly logger = new Logger(MSystemScraperService.name);

  /**
   * Helper kiểm tra thông báo lỗi Ant Design hoặc Bootstrap trên giao diện M-System
   */
  private async checkForLoginErrors(page: Page): Promise<string | null> {
    try {
      const noticeDesc = page.locator(
        '.ant-notification-notice-description, .ant-notification-notice-message',
      );
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
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Đăng nhập toàn trình M-System qua giao diện Web: Nhập user/pass -> Bấm nút -> Nhập bàn phím ảo PIN
   */
  async login(
    credentials: IMSystemCredentials,
    options?: { downloadDir?: string; overrideUrl?: string },
  ): Promise<{ browser: Browser; page: Page }> {
    const { username, password, pin } = credentials;
    if (!username || !password || !pin) {
      throw new Error('Thông tin đăng nhập M-System (username, password, pin) không đầy đủ.');
    }

    const msystemUrl = options?.overrideUrl || credentials.url || '';
    const { browser, page } = await BrowserLauncherHelper.launchBrowser();

    page.on('console', (msg) => {
      this.logger.debug(`[MSystem Console] [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      this.logger.error(`[MSystem PageError] ${err.message}`, err.stack);
    });

    try {
      this.logger.log(`Điều hướng tới M-System: ${msystemUrl}...`);
      await page.goto(msystemUrl);

      this.logger.log('Nhập thông tin username và password...');
      await page.waitForSelector('input[name="username"]', { state: 'visible' });
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      await page.waitForTimeout(500);
      await page.click('button.btn-primary');

      this.logger.log('Đang chờ bảng nhập mã PIN ảo (div.pincode)...');
      let pinSelectorVisible = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        pinSelectorVisible = await page
          .locator('div.pincode')
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (pinSelectorVisible) break;

        const loginError = await this.checkForLoginErrors(page);
        if (loginError) {
          throw new Error(`Đăng nhập thất bại: ${loginError}`);
        }

        this.logger.warn(`Chưa hiển thị bảng PIN (lần ${attempt}), click lại nút Đăng nhập...`);
        await page.click('button.btn-primary').catch(() => {});
        await page.waitForTimeout(2000);
      }

      if (!pinSelectorVisible) {
        throw new Error(
          'Đăng nhập thất bại: Không thấy bảng mã PIN (div.pincode). M-System phản hồi chậm (>20s) hoặc sai mật khẩu.',
        );
      }

      await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 });

      // Nhập từng chữ số PIN trên bàn phím ảo
      const pinDigits = pin.split('');
      for (const digit of pinDigits) {
        const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
        await page.waitForSelector(digitSelector, { state: 'visible' });
        await page.click(digitSelector);
        await page.waitForTimeout(500);
      }

      this.logger.log('Xác thực đăng nhập M-System...');
      if (options?.overrideUrl) {
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => {});
      } else {
        const hasSessionHeader = await page
          .waitForSelector('xpath=.//div[contains(text(),"Ngày phiên hiện tại:")]', {
            state: 'visible',
            timeout: 15000,
          })
          .catch(() => null);

        if (!hasSessionHeader) {
          const curUrl = page.url();
          const isAwayFromLogin = !curUrl.includes('/login');
          const hasNav = await page
            .locator('.sidebar, .navbar, .header, div.ant-layout, #root')
            .first()
            .isVisible()
            .catch(() => false);

          if (!isAwayFromLogin && !hasNav) {
            const errNotice = await this.checkForLoginErrors(page);
            throw new Error(
              `Đăng nhập M-System không thành công: ${errNotice || 'Không tìm thấy trang chủ sau khi nhập PIN'}`,
            );
          }
          this.logger.log(`Xác thực phiên M-System qua URL/Navbar fallback thành công (URL: ${curUrl})`);
        }
      }

      this.logger.log('Đăng nhập M-System THÀNH CÔNG.');
      return { browser, page };
    } catch (err: any) {
      this.logger.error(`Đăng nhập M-System thất bại: ${err.message}`);
      throw err;
    }
  }

  /**
   * Tự động kiểm tra và đăng nhập lại nếu phiên bị đá về màn hình login (AWS ALB session reset)
   */
  async ensureLoggedIn(page: Page, credentials: IMSystemCredentials): Promise<boolean> {
    const isLoginPage = page.url().includes('/login') || (await page.$('input[name="username"]'));
    if (isLoginPage) {
      this.logger.warn('[MSystem] Phát hiện phiên bị đá về trang đăng nhập. Tự động đăng nhập lại...');
      const { username, password, pin } = credentials;
      if (!username || !password || !pin) return false;

      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button.btn-primary');
      await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 });

      for (const digit of pin.split('')) {
        await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(2000);
      return true;
    }
    return false;
  }

  /**
   * Tải trực tiếp báo cáo qua URL Hash và fallback sang Sidebar Menu
   */
  private async gotoAndDownload(
    page: Page,
    hashPath: string,
    downloadPath: string,
    expectedTargetKey?: string,
    customTimeoutMs: number = 90000,
  ): Promise<void> {
    const baseUrl = page.url().split('#')[0];
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const targetUrl = `${normalizedBaseUrl}${hashPath}`;
    this.logger.log(`Điều hướng trực tiếp: ${targetUrl}`);
    await page.goto(targetUrl);

    const rawHash = hashPath.replace('#', '');
    await page
      .waitForFunction(
        (h) => window.location.hash.toLowerCase().includes(h.toLowerCase()),
        rawHash,
        { timeout: 8000 },
      )
      .catch(() => {});
    await page.waitForTimeout(2500);

    // Kích hoạt click Tìm kiếm nếu cần
    const searchSelector =
      "button:has-text('Tìm kiếm'), button:has(i.fa-search), button.btn-primary:has-text('Tìm kiếm'), button[type='submit']:has-text('Tìm kiếm')";
    const searchBtn = page.locator(searchSelector).first();
    const isSearchVisible = await searchBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (isSearchVisible) {
      await searchBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    await page.waitForSelector(MS_EXPORT_BUTTON_SELECTORS, {
      state: 'visible',
      timeout: 30000,
    });

    const downloadPromise = page.waitForEvent('download', { timeout: customTimeoutMs });
    const specificExportBtn = page.locator(MS_SPECIFIC_EXPORT_BUTTON_SELECTORS).first();
    const hasSpecific = await specificExportBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasSpecific) {
      await specificExportBtn.click({ force: true });
    } else {
      await page.locator(MS_EXPORT_BUTTON_SELECTORS).first().click({ force: true });
    }

    const download = await downloadPromise;
    await MSystemTabNavigatorHelper.saveAndValidateDownload(
      download,
      downloadPath,
      expectedTargetKey,
      this.logger,
    );
  }

  /**
   * Tải báo cáo TTM (Trạng thái mở)
   */
  async downloadTTM(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/positionManagement/openPositionInfo',
        destFile,
        'TTM',
        90000,
      );
      this.logger.log(`TTM tải thành công trực tiếp: ${destFile}`);
    } catch (err: any) {
      this.logger.warn(`gotoAndDownload TTM gặp sự cố (${err.message}), fallback Sidebar...`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL trạng thái', 'Trạng thái mở'],
        destFile,
        {
          expectedTargetKey: 'TTM',
          expectedHashPattern: /openPositionInfo/,
          logger: this.logger,
        },
      );
      this.logger.log(`TTM tải thành công qua Sidebar fallback: ${destFile}`);
    }
  }

  /**
   * Tải báo cáo TTTT (Trạng thái tất toán)
   */
  async downloadTTTT(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/positionManagement/closePositionInfo',
        destFile,
        'TTTT',
        90000,
      );
      this.logger.log(`TTTT tải thành công trực tiếp: ${destFile}`);
    } catch (err: any) {
      this.logger.warn(`gotoAndDownload TTTT gặp sự cố (${err.message}), fallback Sidebar...`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL trạng thái', 'Trạng thái tất toán'],
        destFile,
        {
          expectedTargetKey: 'TTTT',
          expectedHashPattern: /closePositionInfo/,
          logger: this.logger,
        },
      );
      this.logger.log(`TTTT tải thành công qua Sidebar fallback: ${destFile}`);
    }
  }

  /**
   * Tải báo cáo DSGD (Danh sách giao dịch)
   */
  async downloadDSGD(page: Page, destFile: string, sessionDay?: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/tradeManagement/tradeList',
        destFile,
        'DSGD',
        90000,
      );
      this.logger.log(`DSGD tải thành công trực tiếp: ${destFile}`);
    } catch (err: any) {
      this.logger.warn(`gotoAndDownload DSGD gặp sự cố (${err.message}), fallback Sidebar...`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL giao dịch', 'Danh sách giao dịch'],
        destFile,
        {
          expectedTargetKey: 'DSGD',
          expectedHashPattern: /tradeList/,
          logger: this.logger,
        },
      );
      this.logger.log(`DSGD tải thành công qua Sidebar fallback: ${destFile}`);
    }
  }
}
