import { Injectable, Logger } from '@nestjs/common';
import { Browser, Page } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserLauncherHelper } from '../helpers/browser-launcher.helper';

export interface ICcpLoginCredentials {
  url?: string;
  username: string;
  password?: string;
}

export interface ICcpReportDef {
  key: string;
  fileName: string;
  urlPath: string;
  phase?: 'pre1620' | 'eod' | 'all';
  tabSelector?: string;
  isCommodity?: boolean;
}

export const CCP_25_REPORTS: ICcpReportDef[] = [
  { key: 'DSL_CCP', fileName: 'DSL CCP.xlsx', urlPath: '/ORDERS/ORDER_DETAIL' },
  { key: 'DSLDK_CCP', fileName: 'DSLDK CCP.xlsx', urlPath: '/ORDERS/ORDERMATCH_DETAIL' },
  { key: 'DSLCK_CCP', fileName: 'DSLCK CCP.xlsx', urlPath: '/ORDERS/ORDERPENDING_DETAIL' },
  { key: 'DSLDH_CCP', fileName: 'DSLDH CCP.xlsx', urlPath: '/ORDERS/ORDERCANCEL_DETAIL' },
  { key: 'DSGD_CCP', fileName: 'DSGD CCP.xlsx', urlPath: '/ORDERS/ORDERMATCH_DETAIL' },
  { key: 'DSL_MM_CCP', fileName: 'DSL MM CCP.xlsx', urlPath: '/ORDERS/ORDER_DETAIL_MM' },
  { key: 'DSLDK_MM_CCP', fileName: 'DSLDK MM CCP.xlsx', urlPath: '/ORDERS/ORDERMATCH_DETAIL_MM' },
  { key: 'DSLCK_MM_CCP', fileName: 'DSLCK MM CCP.xlsx', urlPath: '/ORDERS/ORDERPENDING_DETAIL_MM' },
  { key: 'DSLDH_MM_CCP', fileName: 'DSLDH MM CCP.xlsx', urlPath: '/ORDERS/ORDERCANCEL_DETAIL_MM' },
  { key: 'DSGD_MM_CCP', fileName: 'DSGD MM CCP.xlsx', urlPath: '/ORDERS/ORDERMATCH_DETAIL_MM' },
  { key: 'TTM_PRE1620', fileName: 'TTM truoc 4h20.xlsx', urlPath: '/CLEARING/OPEN_POSITION', phase: 'pre1620' },
  { key: 'TTM_CCP', fileName: 'TTM CCP.xlsx', urlPath: '/CLEARING/OPEN_POSITION', phase: 'eod' },
  { key: 'TTTT', fileName: 'TTTT.xlsx', urlPath: '/CLEARING/CLOSE_POSITION' },
  { key: 'QLTT_TKGD_PRE1620', fileName: 'QL TT TKGD truoc 4h20.xlsx', urlPath: '/MARGIN/CLIENT_MARGIN_STATUS', phase: 'pre1620' },
  { key: 'QLTT_TKGD', fileName: 'QL TT TKGD.xlsx', urlPath: '/MARGIN/CLIENT_MARGIN_STATUS', phase: 'eod' },
  { key: 'QLTT_TVKD', fileName: 'QL TT TVKD.xlsx', urlPath: '/MARGIN/BROKER_MARGIN_STATUS' },
  { key: 'DSQLKQ_TKGD', fileName: 'DSQLKQ TKGD.xlsx', urlPath: '/MARGIN/CLIENT_MARGIN' },
  { key: 'DSQLKQ_TVKD', fileName: 'DSQLKQ TVKD.xlsx', urlPath: '/MARGIN/BROKER_MARGIN' },
  { key: 'NR', fileName: 'NR.xlsx', urlPath: '/DEPOSIT_WITHDRAWAL/MONEY_TRANSFER_HISTORY' },
  { key: 'DSTKGD_ACM', fileName: 'DSTKGD ACM.xlsx', urlPath: '/CLIENT/ACCOUNT_LIST' },
  { key: 'GTT_CCP', fileName: 'GTT CCP.xlsx', urlPath: '/CLEARING/SETTLEMENT_PRICE' },
  { key: 'HH', fileName: 'HH.xlsx', urlPath: '/COMMODITY/COMMODITY_LIST', isCommodity: true },
];

@Injectable()
export class CcpScraperService {
  private readonly logger = new Logger(CcpScraperService.name);

  /**
   * Đăng nhập CoreCCP qua giao diện Web
   */
  async login(
    credentials: ICcpLoginCredentials,
  ): Promise<{ browser: Browser; page: Page; baseUrl: string }> {
    const { username, password } = credentials;
    if (!username || !password) {
      throw new Error('Chưa cấu hình thông tin đăng nhập CoreCCP (username, password).');
    }

    const ccpUrl = (credentials.url || 'https://coreccp.mxv.com.vn')
      .replace(/\/login\/?$/, '')
      .replace(/\/$/, '');

    const { browser, page } = await BrowserLauncherHelper.launchBrowser();

    page.on('console', (msg) => {
      this.logger.debug(`[CoreCCP Console] [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      this.logger.error(`[CoreCCP PageError] ${err.message}`, err.stack);
    });

    try {
      this.logger.log(`Điều hướng tới CoreCCP: ${ccpUrl}/login`);
      await page.goto(`${ccpUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const userInputSelector = 'input#username, input[type="text"], input[name="username"]';
      const passInputSelector = 'input#password, input[type="password"], input[name="password"]';
      const submitBtnSelector = 'button.submit-button, button[type="submit"], button.btn-primary';

      await page.waitForSelector(userInputSelector, { state: 'visible', timeout: 10000 });
      await page.fill(userInputSelector, username);
      await page.fill(passInputSelector, password);
      await page.waitForTimeout(500);
      await page.click(submitBtnSelector);

      const result = await Promise.race([
        page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 15000 }).then(() => 'success'),
        page.waitForSelector('text=Xin chào', { state: 'visible', timeout: 15000 }).then(() => 'success'),
        page.waitForSelector('.message-error', { state: 'visible', timeout: 15000 }).then(() => 'error'),
      ]);

      if (result === 'error') {
        const errorText = await page.locator('.message-error').innerText().catch(() => '');
        throw new Error(`Đăng nhập CoreCCP thất bại: "${errorText.trim()}"`);
      }

      this.logger.log('Đăng nhập CoreCCP THÀNH CÔNG.');
      return { browser, page, baseUrl: ccpUrl };
    } catch (err: any) {
      this.logger.error(`Đăng nhập CoreCCP thất bại: ${err.message}`);
      await browser.close().catch(() => {});
      throw err;
    }
  }

  /**
   * Tải một báo cáo cụ thể trên CoreCCP qua nút Kết xuất -> Xuất tất cả
   */
  async downloadReport(
    page: Page,
    reportUrl: string,
    destFile: string,
    timeoutMs = 30000,
  ): Promise<void> {
    this.logger.log(`[CoreCCP] Điều hướng tới: ${reportUrl}`);
    await page.goto(reportUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const exportBtn = page.locator('button:has-text("Kết xuất")').first();
    await exportBtn.waitFor({ state: 'visible', timeout: 15000 });

    const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs });

    let clicked = false;
    try {
      await exportBtn.hover().catch(() => {});
      await page.waitForTimeout(1000);

      const exportAllBtn = page.getByText('Xuất tất cả').first();
      let isVisible = await exportAllBtn.isVisible().catch(() => false);

      if (!isVisible) {
        await exportBtn.click().catch(() => {});
        await page.waitForTimeout(1000);
        isVisible = await exportAllBtn.isVisible().catch(() => false);
      }

      if (isVisible) {
        await exportAllBtn.click();
        clicked = true;
      }
    } catch {}

    if (!clicked) {
      await exportBtn.dblclick({ delay: 150 }).catch(async () => {
        await exportBtn.click();
      });
    }

    const download = await downloadPromise;
    const destDir = path.dirname(destFile);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    await download.saveAs(destFile);
    const stat = fs.statSync(destFile);
    this.logger.log(`[CoreCCP] Đã lưu file: ${path.basename(destFile)} (${(stat.size / 1024).toFixed(2)} KB)`);
  }

  /**
   * Tải riêng file DSGD MM CCP (Giao dịch MM phục vụ đối soát EOD)
   */
  async downloadDsgdMmCcp(destFile: string, credentials: ICcpLoginCredentials): Promise<boolean> {
    const { browser, page, baseUrl } = await this.login(credentials);
    try {
      const mmUrl = `${baseUrl}/ORDERS/ORDERMATCH_DETAIL_MM`;
      await this.downloadReport(page, mmUrl, destFile);
      return true;
    } finally {
      await browser.close().catch(() => {});
    }
  }

  /**
   * Tải trọn bộ danh mục 25 báo cáo CoreCCP
   */
  async downloadAll25Reports(
    outputDir: string,
    credentials: ICcpLoginCredentials,
    options?: { phase?: 'pre1620' | 'eod' | 'all' },
  ): Promise<Array<{ key: string; fileName: string; path: string; size: number }>> {
    const selectedPhase = options?.phase || 'all';
    const reportsToDownload = CCP_25_REPORTS.filter((rep) => {
      if (selectedPhase === 'all') return true;
      return !rep.phase || rep.phase === selectedPhase;
    });

    const { browser, page, baseUrl } = await this.login(credentials);
    const downloadedResults: Array<{ key: string; fileName: string; path: string; size: number }> = [];

    try {
      for (const rep of reportsToDownload) {
        const destFilePath = path.join(outputDir, rep.fileName);
        const reportUrl = `${baseUrl}${rep.urlPath}`;
        try {
          await this.downloadReport(page, reportUrl, destFilePath);
          const stat = fs.statSync(destFilePath);
          downloadedResults.push({
            key: rep.key,
            fileName: rep.fileName,
            path: destFilePath,
            size: stat.size,
          });
        } catch (repErr: any) {
          this.logger.error(`[CoreCCP] Không thể tải ${rep.fileName}: ${repErr.message}`);
        }
      }
      return downloadedResults;
    } finally {
      await browser.close().catch(() => {});
    }
  }
}
