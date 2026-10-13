import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright-core';
import {
  MSystemTabNavigatorHelper,
  MS_EXPORT_BUTTON_SELECTORS,
  MS_SPECIFIC_EXPORT_BUTTON_SELECTORS,
} from '../helpers/msystem-tab-navigator.helper';
import { MSystemScraperService } from './ms-scraper.service';

@Injectable()
export class MSystemTabScraperService {
  private readonly logger = new Logger(MSystemTabScraperService.name);

  constructor(private readonly msCoreScraper: MSystemScraperService) {}

  /**
   * Helper điều hướng URL hash và kích hoạt tải báo cáo tab
   */
  private async gotoAndDownload(
    page: Page,
    hashPath: string,
    downloadPath: string,
    optionalTabSelector?: string,
    customTimeoutMs: number = 90000,
    expectedTargetKey?: string,
  ): Promise<void> {
    try {
      const baseUrl = page.url().split('#')[0];
      const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const targetUrl = `${normalizedBaseUrl}${hashPath}`;
      this.logger.log(`Direct navigation: ${targetUrl}`);
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

      if (optionalTabSelector) {
        await MSystemTabNavigatorHelper.switchSubTab(page, optionalTabSelector, {
          timeout: 15000,
          logger: this.logger,
        });
      }

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
      this.logger.log(`Saved report successfully to: ${downloadPath}`);
    } catch (err: any) {
      this.logger.error(`Lỗi khi tải báo cáo (${hashPath}): ${err.message}`);
      throw err;
    }
  }

  // 1. Nhật ký thao tác hệ thống (NKTTHT)
  async downloadNKTTHT(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/systemManagement/activityHistory',
        destFile,
        undefined,
        90000,
        'NKTTHT',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for NKTTHT, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL hệ thống', 'Thông tin chung', 'Nhật ký thao tác hệ thống'],
        destFile,
        { expectedTargetKey: 'NKTTHT', logger: this.logger },
      );
    }
  }

  // 2. Danh sách TKGD - Futures
  async downloadDSTKGDFutures(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/clientManagement/investorManagement',
        destFile,
        undefined,
        90000,
        'DSTKGD-Futures',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for DSTKGDFutures, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'],
        destFile,
        { expectedTargetKey: 'DSTKGD-Futures', logger: this.logger },
      );
    }
  }

  // 3. Danh sách TKGD - Spread
  async downloadDSTKGDSpread(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/clientManagement/investorManagement',
        destFile,
        'Spreads',
        90000,
        'DSTKGD-Spread',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for DSTKGD-Spread, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'],
        destFile,
        {
          optionalTabSelector: 'Spreads',
          expectedTargetKey: 'DSTKGD-Spread',
          expectedHashPattern: /investorManagement/,
          logger: this.logger,
        },
      );
    }
  }

  // 4. Danh sách TKGD - LME
  async downloadDSTKGDLME(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/clientManagement/investorManagement',
        destFile,
        'LME',
        90000,
        'DSTKGD-LME',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for DSTKGD-LME, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'],
        destFile,
        {
          optionalTabSelector: 'LME',
          expectedTargetKey: 'DSTKGD-LME',
          expectedHashPattern: /investorManagement/,
          logger: this.logger,
        },
      );
    }
  }

  // 5. Danh sách TKGD - ACM
  async downloadDSTKGDACM(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/clientManagement/investorManagement',
        destFile,
        'ACM',
        90000,
        'DSTKGD-ACM',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for DSTKGD-ACM, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'],
        destFile,
        {
          optionalTabSelector: 'ACM',
          expectedTargetKey: 'DSTKGD-ACM',
          expectedHashPattern: /investorManagement/,
          logger: this.logger,
        },
      );
    }
  }

  // 6. Quản lý trạng thái TKGD (QLTTTKGD)
  async downloadQLTTTKGD(page: Page, destFile: string): Promise<void> {
    await this.gotoAndDownload(
      page,
      '#/clientManagement/marginStatusManagement',
      destFile,
      undefined,
      180000,
      'QLTTTKGD',
    );
  }

  // 7. Danh sách quản lý ký quỹ (DSQLKQ)
  async downloadDSQLKQ(page: Page, destFile: string): Promise<void> {
    await this.gotoAndDownload(
      page,
      '#/positionManagement/marginList',
      destFile,
      undefined,
      90000,
      'DSQLKQ',
    );
  }

  // 8. QL TKGD âm ký quỹ (QLTTTKGDAmKQ)
  async downloadQLTTTKGDAmKQ(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/clientManagement/negativeMarginManagement',
        destFile,
        undefined,
        90000,
        'QLTKGDAmKQ',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for QLTKGDAmKQ, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL khách hàng', 'QL TKGD', 'QL TKGD âm ký quỹ'],
        destFile,
        { expectedTargetKey: 'QLTKGDAmKQ', logger: this.logger },
      );
    }
  }

  // 9. Tỷ lệ ký quỹ & Hệ số ký quỹ (TLKQHSKQ)
  async downloadTLKQHSKQ(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/clientManagement/marginRatioMultiplier',
        destFile,
        undefined,
        90000,
        'TLKQHSKQ',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for TLKQHSKQ, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL khách hàng', 'QL TKGD', 'TLKQ HSKQ'],
        destFile,
        {
          expectedTargetKey: 'TLKQHSKQ',
          expectedHashPattern: /marginRatioMultiplier/,
          logger: this.logger,
        },
      );
    }
  }

  // 10. Lịch sử giao dịch tiền TKGD (NR - Nạp rút)
  async downloadNR(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/clientManagement/marginMoneyTransHistory',
        destFile,
        undefined,
        90000,
        'NR',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for NR, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL khách hàng', 'QL TKGD', 'Lịch sử giao dịch tiền TKGD'],
        destFile,
        { expectedTargetKey: 'NR', logger: this.logger },
      );
    }
  }

  // 11. Danh sách Trader (DSTrader)
  async downloadDSTrader(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/clientManagement/traderManagement',
        destFile,
        undefined,
        90000,
        'DSTrader',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for DSTrader, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL khách hàng', 'QL Trader', 'Danh sách Trader'],
        destFile,
        { expectedTargetKey: 'DSTrader', logger: this.logger },
      );
    }
  }

  // 12. Bảng giá Market trước 6h (Markettruoc6h)
  async downloadMarkettruoc6h(page: Page, destFile: string): Promise<void> {
    try {
      this.logger.log('Navigating to Bảng giá (Markettruoc6h)...');
      const baseUrl = page.url().split('#')[0];
      const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      await page.goto(`${normalizedBaseUrl}#/orderManagement/orderCreating`);
      await page.waitForTimeout(3000);

      const csvBtn = page.locator("xpath=//i[contains(@class, 'fa-file-csv')]");
      const isVisible = await csvBtn.isVisible().catch(() => false);

      if (!isVisible) {
        this.logger.log('CSV icon not directly visible, clicking plus button first...');
        await page.click("xpath=//i[contains(@class, 'fas fa-plus')]").catch(() => {});
        await page.waitForTimeout(2000);
      }

      const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
      await page.click("xpath=//i[contains(@class, 'fa-file-csv')]");
      const download = await downloadPromise;
      await MSystemTabNavigatorHelper.saveAndValidateDownload(
        download,
        destFile,
        'Markettruoc6h',
        this.logger,
      );
      this.logger.log(`Markettruoc6h downloaded successfully to: ${destFile}`);
    } catch (err: any) {
      throw new Error(`Tải Markettruoc6h.xlsx thất bại: ${err.message}`);
    }
  }

  // 13. Lệnh đã khớp (DSLDK)
  async downloadDSLDK(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/orderManagement/orderList',
        destFile,
        'Lệnh đã khớp',
        90000,
        'DSLDK',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for DSLDK, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL giao dịch', 'Danh sách lệnh', 'Lệnh đã khớp'],
        destFile,
        { expectedTargetKey: 'DSLDK', logger: this.logger },
      );
    }
  }

  // 14. Lệnh chờ khớp (DSLCK)
  async downloadDSLCK(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/orderManagement/orderList',
        destFile,
        'Lệnh chờ khớp',
        90000,
        'DSLCK',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for DSLCK, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL giao dịch', 'Danh sách lệnh', 'Lệnh chờ khớp'],
        destFile,
        { expectedTargetKey: 'DSLCK', logger: this.logger },
      );
    }
  }

  // 15. Lệnh đã hủy (DSLH)
  async downloadDSLH(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/orderManagement/orderList',
        destFile,
        'Lệnh đã hủy',
        90000,
        'DSLH',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for DSLH, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL giao dịch', 'Danh sách lệnh', 'Lệnh đã hủy'],
        destFile,
        { expectedTargetKey: 'DSLH', logger: this.logger },
      );
    }
  }

  // 16. Lệnh khác (DSLK)
  async downloadDSLK(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/orderManagement/orderList',
        destFile,
        'Lệnh khác',
        90000,
        'DSLK',
      );
    } catch (err) {
      this.logger.warn(`gotoAndDownload failed for DSLLK, fallback sidebar: ${err}`);
      await MSystemTabNavigatorHelper.navigateMenuAndDownload(
        page,
        ['QL giao dịch', 'Danh sách lệnh', 'Lệnh khác'],
        destFile,
        { expectedTargetKey: 'DSLK', logger: this.logger },
      );
    }
  }

  // 17. Danh sách TKGD - Options
  async downloadDSTKGDOptions(page: Page, destFile: string): Promise<void> {
    await MSystemTabNavigatorHelper.navigateMenuAndDownload(
      page,
      ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'],
      destFile,
      {
        optionalTabSelector: 'Options',
        expectedTargetKey: 'DSTKGD-Spread',
        expectedHashPattern: /investorManagement/,
        logger: this.logger,
      },
    );
  }

  // 18. Trạng thái tất toán chờ đáo hạn LME (TTCDH)
  async downloadTTCDH(page: Page, destFile: string): Promise<void> {
    try {
      await this.gotoAndDownload(
        page,
        '#/positionManagement/finalPositionInfo',
        destFile,
        'Trạng thái tất toán chờ đáo hạn LME',
        90000,
        'TTCDH',
      );
      this.logger.log(`TTCDH downloaded successfully to: ${destFile}`);
    } catch (err: any) {
      this.logger.error(`Tải TTCDH thất bại: ${err.message}`);
      throw err;
    }
  }

  /**
   * Unified dispatcher: tải 1 file theo target key (dùng cho FILE_AUDIT_MS tải bù file thiếu)
   */
  async downloadByTarget(
    page: Page,
    target: string,
    destFile: string,
    sessionDay?: string,
  ): Promise<boolean> {
    switch (target) {
      case 'NKTTHT':
      case 'NKTHT':
        await this.downloadNKTTHT(page, destFile);
        break;
      case 'DSTKGD-Futures':
        await this.downloadDSTKGDFutures(page, destFile);
        break;
      case 'DSTKGD-Spread':
        await this.downloadDSTKGDSpread(page, destFile);
        break;
      case 'DSTKGD-LME':
        await this.downloadDSTKGDLME(page, destFile);
        break;
      case 'DSTKGD-ACM':
        await this.downloadDSTKGDACM(page, destFile);
        break;
      case 'QLTKGD':
      case 'QLTTTKGD':
        await this.downloadQLTTTKGD(page, destFile);
        break;
      case 'QLTKGDAmKQ':
        await this.downloadQLTTTKGDAmKQ(page, destFile);
        break;
      case 'TLKQHSKQ':
        await this.downloadTLKQHSKQ(page, destFile);
        break;
      case 'NR':
        await this.downloadNR(page, destFile);
        break;
      case 'DSTrader':
        await this.downloadDSTrader(page, destFile);
        break;
      case 'Markettruoc6h':
        await this.downloadMarkettruoc6h(page, destFile);
        break;
      case 'DSLDK':
        await this.downloadDSLDK(page, destFile);
        break;
      case 'DSLCK':
        await this.downloadDSLCK(page, destFile);
        break;
      case 'DSLH':
        await this.downloadDSLH(page, destFile);
        break;
      case 'DSLK':
        await this.downloadDSLK(page, destFile);
        break;
      case 'DSGD':
        await this.msCoreScraper.downloadDSGD(page, destFile, sessionDay);
        break;
      case 'DSQLKQ':
        await this.downloadDSQLKQ(page, destFile);
        break;
      case 'TTM':
        await this.msCoreScraper.downloadTTM(page, destFile);
        break;
      case 'TTTT':
        await this.msCoreScraper.downloadTTTT(page, destFile);
        break;
      case 'TTCDH':
        await this.downloadTTCDH(page, destFile);
        break;
      default:
        this.logger.warn(`downloadByTarget: Không có phương thức tải cho "${target}". Bỏ qua.`);
        return false;
    }
    return true;
  }
}
