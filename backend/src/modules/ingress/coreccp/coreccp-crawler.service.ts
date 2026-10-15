/**
 * ============================================================================
 * CORECCP-CRAWLER.SERVICE.TS
 * ============================================================================
 * Playwright Headless Adapter chuyên biệt xử lý KIỂU 3 (Modal & DOM Extraction)
 * và đóng vai trò làm Fallback dự phòng khi API có sự thay đổi.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ICcpCredentials } from './coreccp.types';

let playwright: any;
try {
  playwright = require('playwright-core');
} catch {
  playwright = require('C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-cqg-download-investigation\\backend\\node_modules\\playwright-core');
}

@Injectable()
export class CoreCcpCrawlerService {
  private readonly logger = new Logger(CoreCcpCrawlerService.name);

  /**
   * Tải báo cáo chi tiết Hợp đồng Nano trong Modal (/PRODUCT/COMMODITY)
   */
  async exportNanoContractModal(
    contractCode: string,
    targetFilePath: string,
    credentials: ICcpCredentials,
  ): Promise<void> {
    this.logger.log(`[Crawler] Đang mở Modal Hợp đồng Nano cho mã: ${contractCode}...`);
    const ccpUrl = (credentials.url || 'https://uat-coreccp.mxv.com.vn').replace(/\/+$/, '');

    const { browser, page } = await this.launchHeadlessBrowser();

    try {
      // 1. Đăng nhập
      await this.login(page, ccpUrl, credentials.username, credentials.password || 'Taovipko0!');

      // 2. Mở trang hàng hóa
      await page.goto(`${ccpUrl}/PRODUCT/COMMODITY`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1000);

      // 3. Tìm dòng mã hợp đồng
      const rows = page.locator("xpath=//tbody[contains(@class, 'MuiTableBody-root')]//tr[@data-index]");
      const count = await rows.count();
      let targetRow = null;

      for (let i = 0; i < count; i++) {
        const r = rows.nth(i);
        const code = (await r.locator("xpath=.//td[@data-column-id='UACODE']").first().textContent().catch(() => ''))?.trim();
        if (code === contractCode) {
          targetRow = r;
          break;
        }
      }

      if (!targetRow) {
        throw new Error(`Không tìm thấy mã hợp đồng "${contractCode}" trên bảng Hàng hóa`);
      }

      // 4. Click nút Xem
      const viewBtn = targetRow.locator("xpath=.//td[@data-column-id='actions']//button[@aria-label='Xem']").first();
      await viewBtn.click({ force: true });
      await page.waitForTimeout(1000);

      // 5. Chọn Tab Thông tin hợp đồng
      const contractTab = page.locator("xpath=//button[@id='tab-1' or contains(., 'Thông tin hợp đồng')]").first();
      if (await contractTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await contractTab.click({ force: true });
        await page.waitForTimeout(800);
      }

      // 6. Bấm nút Kết xuất bên trong Modal & đón download event
      const modalExportBtn = page.locator("xpath=//div[contains(@class, 'MuiDialog-container')]//button[contains(., 'Kết xuất')]").first();
      if (!await modalExportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        throw new Error(`Không tìm thấy nút Kết xuất trong Modal hợp đồng ${contractCode}`);
      }

      const dir = path.dirname(targetFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 25000 }),
        modalExportBtn.click({ force: true }),
      ]);

      await download.saveAs(targetFilePath);
      this.logger.log(`[Crawler] ✓ Đã lưu thành công file Modal Hợp đồng: ${path.basename(targetFilePath)}`);
    } finally {
      await browser.close();
    }
  }

  /**
   * Tải báo cáo Lịch sử tất toán PNL Executed (/ORDERS/PNL_EXECUTED - Tab Lịch sử tất toán)
   */
  async exportPnlExecutedHistory(
    targetFilePath: string,
    credentials: ICcpCredentials,
  ): Promise<void> {
    this.logger.log('[Crawler] Đang cào báo cáo TTTT (Lịch sử tất toán PNL)...');
    const ccpUrl = (credentials.url || 'https://uat-coreccp.mxv.com.vn').replace(/\/+$/, '');
    const { browser, page } = await this.launchHeadlessBrowser();

    try {
      await this.login(page, ccpUrl, credentials.username, credentials.password || 'Taovipko0!');
      await page.goto(`${ccpUrl}/ORDERS/PNL_EXECUTED`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1000);

      // Chuyển sang Tab Lịch sử tất toán
      const histTab = page.locator("xpath=//button[@role='tab' and contains(., 'Lịch sử tất toán')]").first();
      if (await histTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await histTab.click({ force: true });
        await page.waitForTimeout(1000);
      }

      // Bấm nút Kết xuất
      const exportBtn = page.locator("xpath=//button[contains(., 'Kết xuất')]").first();
      const dir = path.dirname(targetFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 25000 }),
        exportBtn.click({ force: true }),
      ]);

      await download.saveAs(targetFilePath);
      this.logger.log(`[Crawler] ✓ Đã lưu thành công file TTTT: ${path.basename(targetFilePath)}`);
    } finally {
      await browser.close();
    }
  }

  /**
   * Khởi tạo Chromium Headless
   */
  private async launchHeadlessBrowser() {
    const { chromium } = playwright;
    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ];
    let execPath: string | undefined;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        execPath = p;
        break;
      }
    }

    const browser = await chromium.launch({
      headless: true,
      executablePath: execPath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    return { browser, page };
  }

  /**
   * Helper đăng nhập web CoreCCP
   */
  private async login(page: any, url: string, user: string, pass: string): Promise<void> {
    await page.goto(`${url}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.fill("input[name='username'], input[type='text']", user);
    await page.fill("input[name='password'], input[type='password']", pass);
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");
    await page.waitForTimeout(2500);
  }
}
