/**
 * ============================================================================
 * CRAWLER SERVICE - PLAYWRIGHT HEADLESS FALLBACK ADAPTER
 * ============================================================================
 * Dành cho Kiểu 3 (Modal Hợp đồng Nano CP2CO, PL1NY, SI5CO và TTTT History)
 * hoặc làm fallback khi API có sự thay đổi.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { ICcpCredentials } from './types';

let playwright: any;
try {
  playwright = require('playwright-core');
} catch {
  try {
    playwright = require('C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-cqg-download-investigation\\backend\\node_modules\\playwright-core');
  } catch {}
}

export class CoreCcpCrawlerService {
  async exportNanoContractModal(
    contractCode: string,
    targetFilePath: string,
    credentials: ICcpCredentials,
  ): Promise<void> {
    if (!playwright) throw new Error('Chưa cài đặt playwright-core');

    const ccpUrl = (credentials.url || 'https://uat-coreccp.mxv.com.vn').replace(/\/+$/, '');
    const { browser, page } = await this.launchHeadlessBrowser();

    try {
      await this.login(page, ccpUrl, credentials.username, credentials.password || 'Taovipko0!');
      await page.goto(`${ccpUrl}/PRODUCT/COMMODITY`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1000);

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

      if (!targetRow) throw new Error(`Không tìm thấy mã hợp đồng ${contractCode}`);

      const viewBtn = targetRow.locator("xpath=.//td[@data-column-id='actions']//button[@aria-label='Xem']").first();
      await viewBtn.click({ force: true });
      await page.waitForTimeout(1000);

      const contractTab = page.locator("xpath=//button[@id='tab-1' or contains(., 'Thông tin hợp đồng')]").first();
      if (await contractTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await contractTab.click({ force: true });
        await page.waitForTimeout(800);
      }

      const modalExportBtn = page.locator("xpath=//div[contains(@class, 'MuiDialog-container')]//button[contains(., 'Kết xuất')]").first();
      const dir = path.dirname(targetFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 25000 }),
        modalExportBtn.click({ force: true }),
      ]);

      await download.saveAs(targetFilePath);
    } finally {
      await browser.close();
    }
  }

  async exportPnlExecutedHistory(
    targetFilePath: string,
    credentials: ICcpCredentials,
  ): Promise<void> {
    if (!playwright) throw new Error('Chưa cài đặt playwright-core');

    const ccpUrl = (credentials.url || 'https://uat-coreccp.mxv.com.vn').replace(/\/+$/, '');
    const { browser, page } = await this.launchHeadlessBrowser();

    try {
      await this.login(page, ccpUrl, credentials.username, credentials.password || 'Taovipko0!');
      await page.goto(`${ccpUrl}/ORDERS/PNL_EXECUTED`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1000);

      const histTab = page.locator("xpath=//button[@role='tab' and contains(., 'Lịch sử tất toán')]").first();
      if (await histTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await histTab.click({ force: true });
        await page.waitForTimeout(1000);
      }

      const exportBtn = page.locator("xpath=//button[contains(., 'Kết xuất')]").first();
      const dir = path.dirname(targetFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 25000 }),
        exportBtn.click({ force: true }),
      ]);

      await download.saveAs(targetFilePath);
    } finally {
      await browser.close();
    }
  }

  private async launchHeadlessBrowser() {
    const { chromium } = playwright;
    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ];
    let execPath: string | undefined;
    for (const p of candidates) {
      if (fs.existsSync(p)) { execPath = p; break; }
    }

    const browser = await chromium.launch({
      headless: true,
      executablePath: execPath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    return { browser, page };
  }

  private async login(page: any, url: string, user: string, pass: string): Promise<void> {
    await page.goto(`${url}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.fill("input[name='username'], input[type='text']", user);
    await page.fill("input[name='password'], input[type='password']", pass);
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");
    await page.waitForTimeout(2500);
  }
}
