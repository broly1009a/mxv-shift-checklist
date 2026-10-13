import { Injectable, Logger } from '@nestjs/common';
import { Browser, Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserLauncherHelper } from '../helpers/browser-launcher.helper';

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
          document.querySelectorAll('wpfe-multi-snack-bar-container').forEach((el) => el.remove());
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
   * Đợi Logo CQG xuất hiện xác nhận đăng nhập thành công và xử lý xung đột phiên (Session Conflict)
   */
  async waitForCqgDashboardLogo(
    page: Page,
    username: string,
    timeoutMs: number = 60000,
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`[CQG] Chờ logo CQG hoặc xử lý phiên đăng nhập trùng cho ${username}...`);

    while (Date.now() - startTime < timeoutMs) {
      // 1. Kiểm tra tranh chấp phiên đăng nhập khác (Kicking existing session)
      const conflictMsg = page.locator(
        "xpath=//div[contains(text(), 'already logged on') or contains(text(), 'Session active') or contains(text(), 'Another session') or contains(text(), 'đang hoạt động')]",
      );
      if (await conflictMsg.isVisible({ timeout: 1000 }).catch(() => false)) {
        this.logger.warn(`[CQG] Phát hiện xung đột phiên cho ${username}! Tự động chọn 'Logon here'...`);
        const logonHereBtn = page.locator(
          "xpath=//button[contains(., 'Logon here') or contains(., 'Đăng nhập tại đây') or contains(., 'Continue') or contains(., 'Force')]",
        );
        if (await logonHereBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await logonHereBtn.click({ force: true });
          await page.waitForTimeout(3000);
        }
      }

      // 2. Kiểm tra Logo Dashboard xuất hiện
      const logoSelector =
        "xpath=//div[contains(@class, 'wpfe-app-header-logo')] | //img[contains(@class, 'logo')] | //div[text()='Ho']";
      const logo = page.locator(logoSelector).first();
      if (await logo.isVisible({ timeout: 1000 }).catch(() => false)) {
        this.logger.log(`[CQG] Dashboard đã hiển thị thành công cho ${username}!`);
        return;
      }

      await page.waitForTimeout(1000);
    }
    throw new Error(`Timeout ${timeoutMs}ms: Không thấy Dashboard CQG sau khi đăng nhập (${username}).`);
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

      await this.waitForCqgDashboardLogo(page, username, 60000);
      return { browser, page };
    } catch (err: any) {
      this.logger.error(`Đăng nhập CQG thất bại (${username}): ${err.message}`);
      await browser.close().catch(() => {});
      throw err;
    }
  }

  /**
   * Thao tác mở widget và tải file theo chuẩn C# IT Tool
   */
  async downloadWidget(
    page: Page,
    searchTerm: string,
    tabLabel: string,
    downloadText: string,
    destFile: string,
  ): Promise<void> {
    await this.waitForCqgNotLoading(page, 15000);
    await this.dismissCqgNotifications(page);
    await page.keyboard.press('Escape').catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});

    let downloaded = false;
    try {
      this.logger.log(`[CQG] Mở widget "${searchTerm}"...`);

      // Bước 1: Bấm menu Ho
      const homeMenu = page.locator("//div[text()='Ho']").first();
      await homeMenu.waitFor({ state: 'visible', timeout: 10000 });
      await homeMenu.click();
      await page.waitForTimeout(1000);

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
      await page.waitForTimeout(1000);

      // Bước 3: Tìm kiếm widget
      const searchField = page.locator("//input[@placeholder='Search...']").first();
      await searchField.waitFor({ state: 'visible', timeout: 10000 });
      await searchField.fill(searchTerm);
      await page.waitForTimeout(1000);

      // Bước 4: Chọn widget
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
      await page.waitForTimeout(1000);

      // Bước 5: Tìm nút ba chấm và xuất file
      const destFolder = path.dirname(destFile);
      if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

      for (let attempt = 1; attempt <= 10; attempt++) {
        const threeDotsBtn = page.locator(
          "//wpfe-widget-tab-control[not(@data-help-id='g3.w0')]//button[contains(@class,'wpfe-widget-tab-control-overflow-menu-btn')] | //button[contains(@class,'wpfe-widget-tab-control-overflow-menu-btn')]",
        ).first();

        if (await threeDotsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await threeDotsBtn.click({ force: true });
          await page.waitForTimeout(1000);

          const downloadBtn = page.locator(
            `//span[contains(text(), '${downloadText}')] | //button[contains(., '${downloadText}')]`,
          ).first();

          if (await downloadBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
            await downloadBtn.click();
            const download = await downloadPromise;
            await download.saveAs(destFile);
            this.logger.log(`[CQG] Đã lưu file thành công: ${destFile}`);
            downloaded = true;
            break;
          }
          await page.keyboard.press('Escape').catch(() => {});
        }
        await page.waitForTimeout(2000);
      }

      // Đóng widget tab vừa mở
      await page.keyboard.press('Escape').catch(() => {});
      const closeBtn = page.locator(
        `//wpfe-widget-tab-control[not(@data-help-id='g3.w0')]//div[contains(@class, 'wpfe-tab-header-active')]//button[contains(@class, 'wpfe-widget-tab-header-close-button')]`,
      ).first();
      if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => {});
      }
    } catch (err: any) {
      this.logger.error(`[CQG] Lỗi khi tải widget ${searchTerm}: ${err.message}`);
      throw err;
    }

    if (!downloaded) {
      throw new Error(`Tải ${path.basename(destFile)} thất bại (không bắt được file).`);
    }
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
   */
  async logout(page: Page): Promise<void> {
    try {
      this.logger.log('[CQG] Đang thực hiện Log off giải phóng phiên làm việc...');
      await page.keyboard.press('Escape').catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      const logoutIcon = page.locator("//mat-icon[@data-mat-icon-name='sign-out']").first();
      if (await logoutIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutIcon.click();
        await page.waitForTimeout(1000);
      }
    } catch {}
  }

  /**
   * Tải đồng thời song song 4 cặp file thô từ 2 tài khoản CQG1 và CQG2 (FR1+FR2, PS1+PS2, OP1+OP2, OD1+OD2)
   */
  async downloadParallelAllRawFiles(
    outputDir: string,
    account1: ICqgLoginCredentials,
    account2: ICqgLoginCredentials,
  ): Promise<ICqgParallelDownloadResult> {
    const startTime = Date.now();
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    this.logger.log('Bắt đầu khởi chạy song song 2 trình duyệt CQG1 và CQG2...');
    const [session1, session2] = await Promise.all([
      this.loginAccount(account1),
      this.loginAccount(account2),
    ]);

    try {
      this.logger.log('Cả 2 tài khoản CQG đã sẵn sàng! Kích hoạt tải song song 4 cặp file thô...');

      // 1. Tải FR1 & FR2 song song
      const fr1Path = path.join(outputDir, 'FR1.xlsx');
      const fr2Path = path.join(outputDir, 'FR2.xlsx');
      await Promise.all([
        this.downloadFR(session1.page, fr1Path),
        this.downloadFR(session2.page, fr2Path),
      ]);

      // 2. Tải PS1 & PS2 song song
      const ps1Path = path.join(outputDir, 'PS1.xlsx');
      const ps2Path = path.join(outputDir, 'PS2.xlsx');
      await Promise.all([
        this.downloadPS(session1.page, ps1Path),
        this.downloadPS(session2.page, ps2Path),
      ]);

      // 3. Tải OP1 & OP2 song song
      const op1Path = path.join(outputDir, 'OP1.xlsx');
      const op2Path = path.join(outputDir, 'OP2.xlsx');
      await Promise.all([
        this.downloadOP(session1.page, op1Path),
        this.downloadOP(session2.page, op2Path),
      ]);

      // 4. Tải OD1 & OD2 song song
      const od1Path = path.join(outputDir, 'OD1.xlsx');
      const od2Path = path.join(outputDir, 'OD2.xlsx');
      await Promise.all([
        this.downloadOD(session1.page, od1Path),
        this.downloadOD(session2.page, od2Path),
      ]);

      // Tính toán chênh lệch thời gian tạo file giữa FR1 và FR2
      const stat1 = fs.statSync(fr1Path);
      const stat2 = fs.statSync(fr2Path);
      const deltaSeconds = Math.abs(stat1.mtimeMs - stat2.mtimeMs) / 1000;

      this.logger.log(
        `Hoàn tất tải song song 8 file thô CQG! Chênh lệch mtime giữa 2 TK: ${deltaSeconds.toFixed(2)}s`,
      );

      return {
        success: true,
        durationMs: Date.now() - startTime,
        timeDeltaSeconds: deltaSeconds,
        files: [
          { name: 'FR1.xlsx', path: fr1Path, size: stat1.size, mtime: stat1.mtime },
          { name: 'FR2.xlsx', path: fr2Path, size: stat2.size, mtime: stat2.mtime },
          { name: 'PS1.xlsx', path: ps1Path, size: fs.statSync(ps1Path).size, mtime: fs.statSync(ps1Path).mtime },
          { name: 'PS2.xlsx', path: ps2Path, size: fs.statSync(ps2Path).size, mtime: fs.statSync(ps2Path).mtime },
          { name: 'OP1.xlsx', path: op1Path, size: fs.statSync(op1Path).size, mtime: fs.statSync(op1Path).mtime },
          { name: 'OP2.xlsx', path: op2Path, size: fs.statSync(op2Path).size, mtime: fs.statSync(op2Path).mtime },
          { name: 'OD1.xlsx', path: od1Path, size: fs.statSync(od1Path).size, mtime: fs.statSync(od1Path).mtime },
          { name: 'OD2.xlsx', path: od2Path, size: fs.statSync(od2Path).size, mtime: fs.statSync(od2Path).mtime },
        ],
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
