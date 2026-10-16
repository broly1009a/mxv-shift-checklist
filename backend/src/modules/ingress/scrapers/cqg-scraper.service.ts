import { Injectable, Logger, Optional } from '@nestjs/common';
import { Browser, Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserLauncherHelper } from '../helpers/browser-launcher.helper';
import { decrypt } from '../../../shared';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

export interface ICqgLoginCredentials {
  url?: string;
  username: string;
  password?: string;
}

export interface ICqgParallelDownloadResult {
  success: boolean;
  files: Array<{ name: string; path: string; size: number; mtime: Date }>;
  durationMs: number;
  timeDeltaSeconds: number; // Chênh lệch thời gian tạo file giữa TK 1 và TK 2
}

@Injectable()
export class CqgScraperService {
  private readonly logger = new Logger(CqgScraperService.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  /**
   * Lấy cấu hình đăng nhập CQG từ MongoDB system_settings (bot_credentials_cqg) hoặc .env
   */
  public async getCqgCredentials(): Promise<{
    url: string;
    account1: ICqgLoginCredentials;
    account2: ICqgLoginCredentials;
  }> {
    let url = process.env.CQG_URL || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
    let username1 = process.env.CQG1_USERNAME || '';
    let password1 = process.env.CQG1_PASSWORD || '';
    let username2 = process.env.CQG2_USERNAME || '';
    let password2 = process.env.CQG2_PASSWORD || '';

    if (this.settingsService) {
      const raw = await this.settingsService.getSetting('bot_credentials_cqg', '');
      if (raw) {
        try {
          const creds = JSON.parse(decrypt(raw));
          if (creds.urlTrade || creds.url) url = creds.urlTrade || creds.url;
          if (creds.username1 || creds.usernameCQG1) username1 = creds.username1 || creds.usernameCQG1;
          if (creds.password1 || creds.passwordCQG1) password1 = creds.password1 || creds.passwordCQG1;
          if (creds.username2 || creds.usernameCQG2) username2 = creds.username2 || creds.usernameCQG2;
          if (creds.password2 || creds.passwordCQG2) password2 = creds.password2 || creds.passwordCQG2;
        } catch (err: any) {
          this.logger.warn(`[CQG] Lỗi giải mã bot_credentials_cqg: ${err.message}`);
        }
      }
    }

    return {
      url,
      account1: { url, username: username1, password: password1 },
      account2: { url, username: username2, password: password2 },
    };
  }

  /**
   * Đóng/Xóa các popup notification thông báo của CQG nếu đang nổi trên màn hình
   */
  async dismissCqgNotifications(page: Page): Promise<void> {
    try {
      const closeBtn = page.locator(
        "//wpfe-multi-snack-bar-container//wpfe-dialog-close-button//button | //button[contains(@class,'wpfe-dialog-close-button-button')]",
      );
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click({ timeout: 1500, force: true }).catch(() => {});
      }
      await page
        .evaluate(() => {
          document.querySelectorAll('wpfe-multi-snack-bar-container, .wpfe-notification').forEach((el) => el.remove());
        })
        .catch(() => {});
    } catch {}
  }

  /**
   * Đợi các spinner loading của CQG biến mất
   */
  async waitForCqgNotLoading(page: Page, timeoutMs = 30000): Promise<void> {
    try {
      const spinnerSelectors = [
        '.wpfe-pre-bootstrap-loading-spinner-container',
        '.wpfe-app-loading-image',
      ];
      for (const sel of spinnerSelectors) {
        const els = page.locator(sel);
        const count = await els.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
          await els.nth(i).waitFor({ state: 'detached', timeout: timeoutMs }).catch(() => {});
        }
      }
    } catch {}
  }

  /**
   * Đợi Dashboard CQG hiển thị, tự động xử lý xung đột phiên (Session Takeover / Force Logon)
   * Kế thừa từ test_cqg_tab_downloads_fast.js đã được kiểm chứng thực tế
   */
  async waitForCqgDashboardLogo(
    page: Page,
    username: string,
    timeoutMs: number = 120000,
  ): Promise<void> {
    const waitLogoStart = Date.now();
    this.logger.log(`[CQG] Chờ logo Dashboard CQG hoặc xử lý tranh chấp phiên cho ${username}...`);

    while (Date.now() - waitLogoStart < timeoutMs) {
      // 1. Kiểm tra Dashboard Logo hoặc Menu "Ho"
      const logoVisible = await page.locator('div.wpfe-logo-image').isVisible().catch(() => false);
      const homeVisible = await page.locator("//div[text()='Ho']").isVisible().catch(() => false);
      if (logoVisible || homeVisible) {
        this.logger.log(`[CQG] Dashboard đã hiển thị thành công cho ${username}!`);
        return;
      }

      await this.dismissCqgNotifications(page);

      // 2. Nếu form login vẫn còn hiện sau khi click submit -> Bấm lại hoặc nhấn Enter
      const isLoginStillVisible = await page
        .locator('input[name="password"]')
        .isVisible({ timeout: 150 })
        .catch(() => false);
      if (isLoginStillVisible) {
        const submitBtn = page.locator('button[type="submit"], button:has-text("Log on")');
        const submitText = await submitBtn.first().innerText().catch(() => '');
        if (submitText.includes('Log on')) {
          await submitBtn.first().click({ force: true }).catch(() => {});
          await page.keyboard.press('Enter').catch(() => {});
          await page.waitForTimeout(1500);
        }
      }

      // 3. Xử lý tranh chấp phiên (Session Takeover / Kicking Existing Session)
      const takeoverBtn = page.locator(
        'button:has-text("Logoff"), button:has-text("Log off"), button:has-text("Disconnect"), button:has-text("Continue"), button:has-text("Yes"), button:has-text("OK"), button:has-text("Force"), button:has-text("Take over"), button:has-text("Logon here"), div[role="dialog"] button.btn-primary, .modal-dialog button.btn-primary, .wpfe-dialog button.btn-primary, .wpfe-message-box button',
      );
      if (await takeoverBtn.first().isVisible({ timeout: 250 }).catch(() => false)) {
        const btnText = await takeoverBtn.first().innerText().catch(() => '');
        this.logger.warn(`[CQG] Phát hiện popup xung đột phiên ("${btnText}"). Bấm chiếm quyền phiên cho ${username}...`);
        await takeoverBtn.first().click().catch(() => {});
        await page.waitForTimeout(1000);
      }

      await page.waitForTimeout(300);
    }

    throw new Error(`Timeout ${timeoutMs}ms chờ logo dashboard sau khi đăng nhập CQG (${username}).`);
  }

  /**
   * Đăng nhập 1 tài khoản CQG
   */
  async loginAccount(
    credentials: ICqgLoginCredentials,
    options?: { downloadDir?: string },
  ): Promise<{ browser: Browser; page: Page }> {
    const { username, password } = credentials;
    if (!username || !password) {
      throw new Error('Chưa cấu hình tài khoản CQG (username, password).');
    }

    const cqgUrl = credentials.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
    const { browser, page } = await BrowserLauncherHelper.launchBrowser();

    page.on('console', (msg) => {
      this.logger.debug(`[CQG Console] [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      this.logger.error(`[CQG PageError] ${err.message}`, err.stack);
    });

    try {
      this.logger.log(`Điều hướng tới CQG: ${cqgUrl} (${username})...`);
      try {
        await page.goto(cqgUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (navErr: any) {
        this.logger.warn(`[CQG] Tải trang lần 1 bị chậm (${navErr.message}), tự động reload trang...`);
        await page
          .reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
          .catch(() => page.goto(cqgUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }));
      }

      let hasLoginForm = await page
        .waitForSelector('input[name="userName"]', { state: 'visible', timeout: 15000 })
        .catch(() => null);

      if (!hasLoginForm) {
        this.logger.log('[CQG] Form login chưa hiển thị, tự động reload lại trang...');
        await page
          .reload({ waitUntil: 'domcontentloaded', timeout: 25000 })
          .catch(() => page.goto(cqgUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }));
        await page.waitForSelector('input[name="userName"]', { state: 'visible', timeout: 30000 });
      }

      await page.fill('input[name="userName"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');

      await this.waitForCqgDashboardLogo(page, username, 120000);
      return { browser, page };
    } catch (err: any) {
      this.logger.error(`Đăng nhập CQG thất bại (${username}): ${err.message}`);
      await browser.close().catch(() => {});
      throw err;
    }
  }

  /**
   * Tải một widget với cơ chế CHỌN ALL ACCOUNTS & CHỜ THÔNG MINH
   * Chuẩn hóa từ test_cqg_tab_downloads_fast.js:
   * 1. Menu Ho -> 2. Nút (+) Add Widget -> 3. Search -> 4. Select Widget
   * 5. Bắt buộc chọn All accounts -> 6. Dynamic Wait WebSocket
   * 7. Menu 3 chấm (Kiểm tra opacity/pointer-events) -> Download file
   * 8. Đóng tab widget dọn dẹp layout
   */
  async downloadWidget(
    page: Page,
    searchTerm: string,
    tabLabel: string,
    downloadText: string,
    destFile: string,
  ): Promise<void> {
    const widgetStart = Date.now();
    await this.dismissCqgNotifications(page);
    await page.keyboard.press('Escape').catch(() => {});

    this.logger.log(`[CQG] Mở widget "${searchTerm}" và chọn All accounts...`);

    // Bước 1: Bấm menu Ho
    const homeMenu = page.locator("//div[text()='Ho']").first();
    await homeMenu.waitFor({ state: 'visible', timeout: 10000 });
    await homeMenu.click();
    await page.waitForTimeout(400);

    // Bước 2: Bấm nút dấu cộng (+) add widget
    let plusIcon = page
      .locator("wpfe-widget-tab-control[data-help-id='g1.w431'] .wpfe-add-widget-btn")
      .first();
    if ((await plusIcon.count().catch(() => 0)) === 0) {
      plusIcon = page
        .locator("div.wpfe-page-layout-tab-panel[style*='top: 0px'] .wpfe-add-widget-btn")
        .first();
    }
    if ((await plusIcon.count().catch(() => 0)) === 0) {
      plusIcon = page.locator("//div[contains(@class, 'wpfe-add-widget-btn')]").first();
    }
    await plusIcon.waitFor({ state: 'visible', timeout: 10000 });
    await plusIcon.click();
    await page.waitForTimeout(400);

    // Bước 3: Tìm kiếm widget
    const searchField = page.locator("//input[@placeholder='Search...']").first();
    await searchField.waitFor({ state: 'visible', timeout: 10000 });
    await searchField.fill(searchTerm);
    await page.waitForTimeout(400);

    // Bước 4: Chọn widget từ danh sách gợi ý
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
    await widgetItem.waitFor({ state: 'visible', timeout: 10000 });
    await widgetItem.click();
    await page.waitForTimeout(800);

    // Bước 5: BẮT BUỘC CHỌN ALL ACCOUNTS CHO TAB VỪA MỞ
    const scopedBtn = page
      .locator(
        `//div[contains(@class, 'wpfe-tab-header-active')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//button[contains(@class, 'wpfe-widget-account-selector-button')]`,
      )
      .locator('visible=true')
      .first();

    const targetAccountBtn =
      (await scopedBtn.count().catch(() => 0)) > 0
        ? scopedBtn
        : page.locator('button.wpfe-widget-account-selector-button:visible').first();

    const hasAccountBtn = await targetAccountBtn
      .waitFor({ state: 'visible', timeout: 4000 })
      .then(() => true)
      .catch(() => false);

    if (hasAccountBtn) {
      const currentAccountText = await targetAccountBtn.innerText().catch(() => '');
      this.logger.debug(`[CQG] Nút tài khoản hiện tại: "${currentAccountText.trim()}"`);

      if (!currentAccountText.includes('All')) {
        this.logger.log(`[CQG] Đang đổi sang All accounts cho tab ${tabLabel}...`);
        await targetAccountBtn.click();
        await page.waitForTimeout(600);

        const allAccountsItem = page
          .locator(
            "//div[contains(@class, 'wpfe-account-selector-item-list-item') and .//span[text()='All accounts']]",
          )
          .first();
        await allAccountsItem.waitFor({ state: 'visible', timeout: 8000 });
        await allAccountsItem.click();
        await page.waitForTimeout(400);

        const okBtn = page.locator("//div[text()='OK']").first();
        await okBtn.waitFor({ state: 'visible', timeout: 8000 });
        await okBtn.click();
        await page.waitForTimeout(800);
        this.logger.log(`[CQG] Đã chọn All accounts thành công cho ${tabLabel}!`);
      } else {
        this.logger.log(`[CQG] Tab ${tabLabel} đã chọn sẵn All accounts.`);
      }
    } else {
      this.logger.debug(`[CQG] Không phát hiện nút đổi tài khoản (hoặc đã nhận mặc định All).`);
    }

    // Bước 6: Dynamic Wait - Chờ dữ liệu bảng đồng bộ xong qua WebSocket
    this.logger.log(`[CQG] Chờ WebSocket nạp dữ liệu cho ${tabLabel}: All...`);
    await this.waitForCqgNotLoading(page, 16000);

    const widgetSpinnerSelector =
      "wpfe-widget-tab-control:has(.wpfe-tab-header-active) mat-spinner, wpfe-widget-tab-control:has(.wpfe-tab-header-active) .mat-mdc-progress-spinner, wpfe-widget-tab-control:has(.wpfe-tab-header-active) .wpfe-loading-spinner";
    const startWait = Date.now();
    while (Date.now() - startWait < 16000) {
      const hasSpinner = await page.locator(widgetSpinnerSelector).first().isVisible().catch(() => false);
      if (!hasSpinner && Date.now() - startWait >= 3000) {
        break;
      }
      await page.waitForTimeout(400);
    }
    this.logger.log(`[CQG] Bảng "${tabLabel}" đã sẵn sàng dữ liệu sau ${((Date.now() - startWait) / 1000).toFixed(1)}s.`);

    // Bước 7: Mở menu 3 chấm của chính tab vừa mở và tải file
    const ellipsisXPath =
      `//wpfe-widget-tab-control[@data-help-id='g1.w431']//mat-icon[@data-mat-icon-name='ellipsis-v']` +
      ' | ' +
      `//span[contains(text(), '${tabLabel}: All')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//mat-icon[@data-mat-icon-name='ellipsis-v']` +
      ' | ' +
      `//div[contains(@class, 'wpfe-tab-header-active')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//mat-icon[@data-mat-icon-name='ellipsis-v']`;
    const downloadBtnXPath = `//div[contains(text(), "${downloadText}")]`;

    let downloaded = false;
    const destFolder = path.dirname(destFile);
    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

    for (let attempt = 1; attempt <= 8; attempt++) {
      this.logger.log(`[CQG] Mở menu 3 chấm (lần ${attempt}/8)...`);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(400);

      const ellipsisButton = page.locator(ellipsisXPath).first();
      await ellipsisButton.waitFor({ state: 'visible', timeout: 5000 });
      await ellipsisButton.click();
      await page.waitForTimeout(800);

      const downloadBtn = page.locator(downloadBtnXPath).first();
      const isVisible = await downloadBtn
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false);

      let isClickable = false;
      if (isVisible) {
        isClickable = await downloadBtn
          .evaluate((el) => {
            const item = el.closest('button, [role="menuitem"], .gpc-button, .mat-mdc-menu-item') || el;
            const hasDisabledAttr = item.hasAttribute('disabled') || item.getAttribute('aria-disabled') === 'true';
            const hasDisabledClass =
              item.classList.contains('disabled') ||
              item.classList.contains('mat-mdc-menu-item-disabled') ||
              item.classList.contains('gpc-button-disabled');
            const style = window.getComputedStyle(item);
            const isOpaque = parseFloat(style.opacity || '1') >= 0.7;
            const hasPointerEvents = style.pointerEvents !== 'none';
            return !hasDisabledAttr && !hasDisabledClass && isOpaque && hasPointerEvents;
          })
          .catch(() => false);
      }

      if (isClickable) {
        this.logger.log(`[CQG] Nút "${downloadText}" sẵn sàng 100%! Bấm tải...`);
        try {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 30000 }),
            downloadBtn.click({ timeout: 5000 }),
          ]);

          // Snapshot file cũ nếu đã tồn tại
          if (fs.existsSync(destFile)) {
            try {
              const dir = path.dirname(destFile);
              const ext = path.extname(destFile);
              const name = path.basename(destFile, ext);
              const d = new Date();
              const pad = (n: number) => String(n).padStart(2, '0');
              const timestamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
              const snapshotPath = path.join(dir, `${name}_bak_${timestamp}${ext}`);
              fs.copyFileSync(destFile, snapshotPath);
            } catch {}
          }

          await download.saveAs(destFile);
          const fileSizeKb = (fs.statSync(destFile).size / 1024).toFixed(1);
          this.logger.log(`[CQG] Đã lưu file thành công: ${path.basename(destFile)} (${fileSizeKb} KB)`);
          downloaded = true;
          break;
        } catch (dlErr: any) {
          this.logger.warn(`[CQG] Bấm nút nhưng chưa kích hoạt tải (${dlErr.message}). Thử lại...`);
          if (page.isClosed()) break;
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(1000);
        }
      } else {
        this.logger.log(`[CQG] Nút "${downloadText}" đang mờ/loading. Đóng menu chờ 1.5s...`);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(1500);
      }
    }

    // Bước 8: Đóng tab vừa tạo để bảo toàn layout
    try {
      if (!page.isClosed()) {
        await page.keyboard.press('Escape').catch(() => {});
        const closeBtn = page
          .locator(
            `//div[contains(@class, 'wpfe-tab-header-active')]//button[contains(@class, 'wpfe-widget-tab-header-close-button')]`,
          )
          .first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => {});
          this.logger.log(`[CQG] Đã đóng tab widget: ${tabLabel}`);
          await page.waitForTimeout(400);
        }
      }
    } catch {}

    if (!downloaded) {
      throw new Error(`Không thể tải ${path.basename(destFile)} qua CQG Desktop Web.`);
    }

    const widgetDurationSec = ((Date.now() - widgetStart) / 1000).toFixed(1);
    this.logger.log(`[CQG] Hoàn tất ${path.basename(destFile)} trong: ${widgetDurationSec}s`);
  }

  async downloadFR(page: Page, destFile: string): Promise<void> {
    await this.downloadWidget(page, 'Fills', 'Fills', "Download today's fills in view", destFile);
  }

  async downloadPS(page: Page, destFile: string): Promise<void> {
    await this.downloadWidget(page, 'P&S', 'P&S', 'Download Purchase and sales in view', destFile);
  }

  async downloadOP(page: Page, destFile: string): Promise<void> {
    await this.downloadWidget(page, 'Pos', 'Pos', 'Download open positions in view', destFile);
  }

  async downloadOD(page: Page, destFile: string): Promise<void> {
    await this.downloadWidget(page, 'Orders', 'Orders', 'Download orders in view', destFile);
  }

  async downloadAS(page: Page, destFile: string): Promise<void> {
    this.logger.log('[CQG] Tải báo cáo AS (Account Summary / Balances)...');
    await page.waitForTimeout(2000);
  }

  /**
   * Đăng xuất giải phóng session trên máy chủ CQG
   * Chuẩn hóa từ test_cqg_tab_downloads_fast.js: xử lý mở sidebar nếu thu gọn và xác nhận dialog
   */
  async logout(page: Page): Promise<void> {
    try {
      this.logger.log('[CQG] Đang thực hiện Log off để giải phóng phiên làm việc...');
      await page.keyboard.press('Escape').catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);

      const logoutIconSelectors = [
        "//mat-icon[@data-mat-icon-name='sign-out']",
        "//mat-icon[contains(@class, 'sign-out')]",
        "//div[contains(@class, 'wpfe-desktop-sidebar-toolbar-item')]//mat-icon[@data-mat-icon-name='sign-out']",
        "//button[contains(@aria-label, 'Sign out') or contains(@aria-label, 'Log off')]",
      ];
      const logoutIcon = page.locator(logoutIconSelectors.join(' | ')).first();
      let isVisible = await logoutIcon.isVisible({ timeout: 2000 }).catch(() => false);

      if (!isVisible) {
        const collapseIcon = page
          .locator(
            "//*[contains(@class, 'gpc-icon wpfe-desktop-sidebar-toolbar-item-header-icon gpc-icon-size-big gpc-icon-name-wpfe-chevron-up')]",
          )
          .first();
        if (await collapseIcon.isVisible({ timeout: 1500 }).catch(() => false)) {
          await collapseIcon.click().catch(() => {});
          await page.waitForTimeout(500);
        }
        isVisible = await logoutIcon.isVisible({ timeout: 2000 }).catch(() => false);
      }

      if (isVisible) {
        await logoutIcon.click({ timeout: 3000 });
        await page.waitForTimeout(500);

        const logoffMenuItem = page
          .locator(
            "//div[contains(@class, 'wpfe-dropdown-menu-item-text-content') and (text()='Log off' or text()='Log out' or text()='Đăng xuất')] | //span[text()='Log off' or text()='Log out']",
          )
          .first();
        if (await logoffMenuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await logoffMenuItem.click({ timeout: 3000 });
          await page.waitForTimeout(500);
        }

        const dialogConfirmBtn = page
          .locator(
            "wpfe-confirmation-dialog button.wpfe-confirm, wpfe-confirmation-dialog button:has-text('Log off'), //wpfe-confirmation-dialog//button[contains(@class, 'wpfe-confirm')]",
          )
          .first();

        if (await dialogConfirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await dialogConfirmBtn.click({ force: true, timeout: 3000 }).catch(() => {});
        }
        this.logger.log('[CQG] Đã hoàn tất Log off thành công.');
      }
    } catch (err: any) {
      this.logger.warn(`[CQG] Bỏ qua lỗi logoff: ${err.message}`);
    }
  }

  /**
   * Tải đồng thời song song các cặp file thô từ 2 tài khoản CQG1 và CQG2 (FR1+FR2, PS1+PS2, OP1+OP2, OD1+OD2)
   * Tự động trích xuất tài khoản từ CSDL nếu không truyền vào.
   * Hỗ trợ cờ reportsToDownload để chỉ tải báo cáo cần thiết (ví dụ: chỉ tải FR cho trong phiên, tải cả 4 cho cuối ngày).
   */
  async downloadParallelAllRawFiles(
    outputDir: string,
    account1?: ICqgLoginCredentials,
    account2?: ICqgLoginCredentials,
    reportsToDownload?: string[],
  ): Promise<ICqgParallelDownloadResult> {
    const startTime = Date.now();
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Tự động resolve credentials từ CSDL nếu chưa có
    let acc1 = account1;
    let acc2 = account2;
    if (!acc1?.username || !acc2?.username) {
      const resolved = await this.getCqgCredentials();
      if (!acc1?.username) acc1 = resolved.account1;
      if (!acc2?.username) acc2 = resolved.account2;
    }

    if (!acc1?.username || !acc1?.password || !acc2?.username || !acc2?.password) {
      throw new Error('Chưa cấu hình đầy đủ tài khoản CQG1 và CQG2 trong CSDL (bot_credentials_cqg) hoặc .env.');
    }

    // Xác định các cặp báo cáo cần tải:
    // Mặc định tải cả 4 cặp (FR, PS, OP, OD)
    // Nếu reportsToDownload được truyền (ví dụ: ['FR']), chỉ tải báo cáo chỉ định
    const shouldDownload = (code: string) => {
      if (!reportsToDownload || reportsToDownload.length === 0) return true;
      return reportsToDownload.some((r) => r.toUpperCase() === code || r.toUpperCase().includes(code));
    };

    this.logger.log(
      `Bắt đầu khởi chạy song song 2 trình duyệt CQG1 (${acc1.username}) và CQG2 (${acc2.username})...`,
    );
    const [session1, session2] = await Promise.all([
      this.loginAccount(acc1),
      this.loginAccount(acc2),
    ]);

    const files: Array<{ name: string; path: string; size: number; mtime: Date }> = [];
    let deltaSeconds = 0;

    try {
      this.logger.log('Cả 2 tài khoản CQG đã sẵn sàng! Kích hoạt tải song song các file thô...');

      // 1. Tải FR1 & FR2 song song (Khớp lệnh)
      if (shouldDownload('FR')) {
        const fr1Path = path.join(outputDir, 'FR1.xlsx');
        const fr2Path = path.join(outputDir, 'FR2.xlsx');
        await Promise.all([
          this.downloadFR(session1.page, fr1Path),
          this.downloadFR(session2.page, fr2Path),
        ]);
        const s1 = fs.statSync(fr1Path);
        const s2 = fs.statSync(fr2Path);
        files.push({ name: 'FR1.xlsx', path: fr1Path, size: s1.size, mtime: s1.mtime });
        files.push({ name: 'FR2.xlsx', path: fr2Path, size: s2.size, mtime: s2.mtime });
        deltaSeconds = Math.abs(s1.mtimeMs - s2.mtimeMs) / 1000;
      }

      // 2. Tải PS1 & PS2 song song (Tất toán & Vị thế ròng)
      if (shouldDownload('PS')) {
        const ps1Path = path.join(outputDir, 'PS1.xlsx');
        const ps2Path = path.join(outputDir, 'PS2.xlsx');
        await Promise.all([
          this.downloadPS(session1.page, ps1Path),
          this.downloadPS(session2.page, ps2Path),
        ]);
        const s1 = fs.statSync(ps1Path);
        const s2 = fs.statSync(ps2Path);
        files.push({ name: 'PS1.xlsx', path: ps1Path, size: s1.size, mtime: s1.mtime });
        files.push({ name: 'PS2.xlsx', path: ps2Path, size: s2.size, mtime: s2.mtime });
      }

      // 3. Tải OP1 & OP2 song song (Trạng thái mở)
      if (shouldDownload('OP')) {
        const op1Path = path.join(outputDir, 'OP1.xlsx');
        const op2Path = path.join(outputDir, 'OP2.xlsx');
        await Promise.all([
          this.downloadOP(session1.page, op1Path),
          this.downloadOP(session2.page, op2Path),
        ]);
        const s1 = fs.statSync(op1Path);
        const s2 = fs.statSync(op2Path);
        files.push({ name: 'OP1.xlsx', path: op1Path, size: s1.size, mtime: s1.mtime });
        files.push({ name: 'OP2.xlsx', path: op2Path, size: s2.size, mtime: s2.mtime });
      }

      // 4. Tải OD1 & OD2 song song (Sổ lệnh)
      if (shouldDownload('OD')) {
        const od1Path = path.join(outputDir, 'OD1.xlsx');
        const od2Path = path.join(outputDir, 'OD2.xlsx');
        await Promise.all([
          this.downloadOD(session1.page, od1Path),
          this.downloadOD(session2.page, od2Path),
        ]);
        const s1 = fs.statSync(od1Path);
        const s2 = fs.statSync(od2Path);
        files.push({ name: 'OD1.xlsx', path: od1Path, size: s1.size, mtime: s1.mtime });
        files.push({ name: 'OD2.xlsx', path: od2Path, size: s2.size, mtime: s2.mtime });
      }

      this.logger.log(
        `Hoàn tất tải song song ${files.length} file thô CQG! Chênh lệch mtime FR: ${deltaSeconds.toFixed(2)}s`,
      );

      return {
        success: true,
        durationMs: Date.now() - startTime,
        timeDeltaSeconds: deltaSeconds,
        files,
      };
    } finally {
      await Promise.all([
        this.logout(session1.page).catch(() => {}),
        this.logout(session2.page).catch(() => {}),
      ]);
      await Promise.all([
        session1.browser.close().catch(() => {}),
        session2.browser.close().catch(() => {}),
      ]);
    }
  }
}
