import { Page, Download } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';

export interface TabNavigationOptions {
  optionalTabSelector?: string;
  expectedTargetKey?: string;
  expectedHashPattern?: RegExp | string;
  customTimeoutMs?: number;
  snapshotPath?: string;
  logger?: {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * Danh mục Regex kiểm tra tên file gốc tải về từ M-System
 * Tương đương cơ chế WaitForFileAndMoveByPattern trong C# FileUtils.cs
 */
export const MS_REPORT_FILE_PATTERNS: Record<string, RegExp> = {
  TTTT: /^trang-thai-tat-toan.*\.xlsx$/i,
  TTM: /^trang-thai-mo.*\.xlsx$/i,
  TTCDH: /^trang-thai-tat-toan.*\.xlsx$/i,
  DSQLKQ: /^danh-sach-quan-ly-ky-quy.*\.xlsx$/i,
  DSGD: /^danh-sach-giao-dich.*\.xlsx$/i,
  DSLDK: /^danh-sach-lenh.*\.xlsx$/i,
  DSLCK: /^danh-sach-lenh.*\.xlsx$/i,
  DSLH: /^danh-sach-lenh.*\.xlsx$/i,
  DSLK: /^danh-sach-lenh.*\.xlsx$/i,
  Markettruoc6h: /^market.*\.csv$/i,
  'DSTKGD-Futures': /^danh_sach_TKGD.*\.xlsx$/i,
  'DSTKGD-Spread': /^danh_sach_TKGD.*\.xlsx$/i,
  'DSTKGD-LME': /^danh_sach_TKGD.*\.xlsx$/i,
  'DSTKGD-ACM': /^danh_sach_TKGD.*\.xlsx$/i,
  QLTKGD: /^danh-sach-quan-ly-trang-thai-tkgd.*\.xlsx$/i,
  QLTTTKGD: /^danh-sach-quan-ly-trang-thai-tkgd.*\.xlsx$/i,
  QLTKGDAmKQ: /^danh-sach-quan-ly-tt-tkgd-am-ky-quy.*\.xlsx$/i,
  TLKQHSKQ: /^TLKQ_HSKQ.*\.xlsx$/i,
  NR: /^DS_lich_su_GD_tien_TKGD.*\.xlsx$/i,
  DSTrader: /^danh_sach_Trader.*\.xlsx$/i,
  NKTTHT: /^nhat_ky_thao_tac.*\.xlsx$/i,
};

/**
 * Selector phổ biến cho nút xuất file Excel / CSV trên M-System (Angular UI)
 */
export const MS_EXPORT_BUTTON_SELECTORS = [
  'button.ladda-button:has(i.fa-file-excel)',
  'button:has(i.fa-file-excel)',
  'button.ladda-button:has(i.fa-file-csv)',
  'button:has(i.fa-file-csv)',
  'button.btn-info',
  'i.fa-file-excel',
  'i.fa-file-csv',
  "button:has-text('Xuất file')",
  "button:has-text('Xuất Excel')",
  "button[title*='Export' i]",
].join(', ');

export class MSystemTabNavigatorHelper {
  /**
   * Chuyển tab con bên trong trang M-System (ví dụ: Tab 'Trạng thái tất toán chờ đáo hạn LME', Tab 'Spreads', 'LME', 'ACM')
   */
  static async switchSubTab(
    page: Page,
    tabName: string,
    options?: {
      timeout?: number;
      snapshotPath?: string;
      logger?: { log: (msg: string) => void; warn: (msg: string) => void };
    },
  ): Promise<boolean> {
    const timeout = options?.timeout ?? 15000;
    const logger = options?.logger ?? console;

    logger.log(`[TabNavigator] Đang tìm và chuyển sang tab: "${tabName}"...`);

    const tabSelector = `xpath=//*[self::a or self::button or self::li or self::div or self::span][normalize-space(text())='${tabName}' or contains(text(), '${tabName}')]`;

    try {
      const tabLocator = page.locator(tabSelector).first();
      await tabLocator.waitFor({ state: 'visible', timeout });

      // Kiểm tra nếu tab đã active sẵn (có class active hoặc aria-selected="true")
      const isActive = await tabLocator.evaluate((el) => {
        const parentLi = el.closest('li') || el.closest('div.nav-item') || el;
        return (
          parentLi.classList.contains('active') ||
          el.classList.contains('active') ||
          el.getAttribute('aria-selected') === 'true'
        );
      }).catch(() => false);

      if (isActive) {
        logger.log(`[TabNavigator] Tab "${tabName}" đã active sẵn. Bỏ qua click.`);
      } else {
        await tabLocator.click({ force: true });
        logger.log(`[TabNavigator] Đã click chọn tab "${tabName}".`);
      }

      // Đợi Angular tải xong dữ liệu bảng và tắt loading spinner nếu có
      await page.waitForTimeout(2000);
      await page
        .waitForSelector(
          '.ladda-loading, div.spinner, div.loading, div.block-ui-overlay',
          { state: 'detached', timeout: 5000 },
        )
        .catch(() => { });

      if (options?.snapshotPath) {
        const dir = path.dirname(options.snapshotPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: options.snapshotPath, fullPage: false }).catch(() => { });
        logger.log(`[TabNavigator] Đã chụp snapshot tab: ${options.snapshotPath}`);
      }

      return true;
    } catch (err: any) {
      logger.warn(`[TabNavigator] Không thể chuyển tab "${tabName}": ${err.message}`);
      return false;
    }
  }

  /**
   * Lưu và thẩm định tên file download từ M-System khớp Regex chuẩn nghiệp vụ
   */
  static async saveAndValidateDownload(
    download: Download,
    downloadPath: string,
    expectedTargetKey?: string,
    logger?: { log: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void },
  ): Promise<string> {
    const log = logger ?? console;
    const suggested = download.suggestedFilename();
    log.log(`[TabNavigator] M-System trả về file gốc: "${suggested}"`);

    if (expectedTargetKey) {
      const expectedPattern = MS_REPORT_FILE_PATTERNS[expectedTargetKey];
      if (expectedPattern) {
        if (!expectedPattern.test(suggested)) {
          const errMsg =
            `[CẢNH BÁO BẢO MẬT & SAI LỆCH DỮ LIỆU] Tải nhầm file trên M-System! ` +
            `Kỳ vọng định dạng "${expectedPattern.source}" cho loại báo cáo "${expectedTargetKey}", ` +
            `nhưng trình duyệt nhận được file: "${suggested}". ` +
            `Hủy lưu để bảo vệ tính toàn vẹn dữ liệu đối soát.`;
          log.error(errMsg);
          throw new Error(errMsg);
        }
        log.log(
          `[TabNavigator]  Xác thực hợp lệ file "${suggested}" khớp mẫu kỳ vọng của "${expectedTargetKey}".`,
        );
      }
    }

    const targetDir = path.dirname(downloadPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Đảm bảo xóa file đích cũ nếu đã tồn tại
    if (fs.existsSync(downloadPath)) {
      try {
        fs.unlinkSync(downloadPath);
      } catch (delErr: any) {
        log.warn(`[TabNavigator] Không thể xóa file cũ trước khi ghi đè: ${delErr.message}`);
      }
    }

    await download.saveAs(downloadPath);
    const fileSize = fs.existsSync(downloadPath) ? fs.statSync(downloadPath).size : 0;
    log.log(
      `[TabNavigator] Đã lưu file thành công: ${downloadPath} (${(fileSize / 1024).toFixed(2)} KB)`,
    );
    return suggested;
  }

  /**
   * Kích hoạt tải file từ nút xuất Excel/CSV trên giao diện trang hiện tại
   */
  static async clickExportAndDownload(
    page: Page,
    downloadPath: string,
    expectedTargetKey?: string,
    options?: {
      customTimeoutMs?: number;
      logger?: { log: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
    },
  ): Promise<string> {
    const timeout = options?.customTimeoutMs ?? 90000;
    const log = options?.logger ?? console;

    // Tự động kiểm tra và click nút "Tìm kiếm" nếu màn hình yêu cầu kích hoạt truy vấn trước khi vẽ bảng
    const searchSelector =
      "button:has-text('Tìm kiếm'), button:has(i.fa-search), button.btn-primary:has-text('Tìm kiếm'), button[type='submit']:has-text('Tìm kiếm')";
    const searchBtn = page.locator(searchSelector).first();
    const isSearchVisible = await searchBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (isSearchVisible) {
      log.log('[TabNavigator] Phát hiện nút "Tìm kiếm", kích hoạt click để tải dữ liệu bảng...');
      await searchBtn.click({ force: true }).catch(() => { });
      await page.waitForTimeout(2000);
      await page
        .waitForSelector(
          '.ladda-loading, div.spinner, div.loading, div.block-ui-overlay',
          { state: 'detached', timeout: 6000 },
        )
        .catch(() => { });
    }

    await page.waitForSelector(MS_EXPORT_BUTTON_SELECTORS, {
      state: 'visible',
      timeout: 30000,
    });

    log.log(`[TabNavigator] Đang chờ sự kiện download (timeout: ${timeout}ms)...`);
    const downloadPromise = page.waitForEvent('download', { timeout });

    log.log('[TabNavigator] Bấm nút xuất file Excel/CSV...');
    await page.locator(MS_EXPORT_BUTTON_SELECTORS).first().click({ force: true });

    const download = await downloadPromise;
    return await this.saveAndValidateDownload(download, downloadPath, expectedTargetKey, log);
  }

  /**
   * Điều hướng toàn trình: Menu Sidebar -> Đợi URL -> Chọn Sub-tab -> Bấm Tải -> Xác thực File
   */
  static async navigateMenuAndDownload(
    page: Page,
    menuSteps: string[],
    downloadPath: string,
    options?: TabNavigationOptions,
  ): Promise<string> {
    const log = options?.logger ?? console;
    log.log(`[TabNavigator] Bắt đầu điều hướng: ${menuSteps.join(' -> ')}`);

    // 1. Click từng menu trong chuỗi menuSteps
    // Giới hạn tìm kiếm trong Sidebar (aside, .sidebar, nav.sidebar-nav, app-sidebar) để tránh bắt nhầm text trong bảng dữ liệu
    const sidebarPrefix = `xpath=(//aside | //nav[contains(@class, 'sidebar')] | //*[@class and contains(@class, 'sidebar')] | //app-sidebar)`;

    for (let i = 0; i < menuSteps.length; i++) {
      const menu = menuSteps[i];
      const scopedSelector = `${sidebarPrefix}//*[self::a or self::span or self::li or self::div][normalize-space(text())='${menu}' or contains(text(), '${menu}')]`;
      const fallbackSelector = `xpath=//*[self::a or self::span or self::li or self::div][normalize-space(text())='${menu}' or contains(text(), '${menu}')]`;

      // Kiểm tra nếu là menu cha cấp trên: chỉ bỏ qua click nếu menu con cấp tiếp theo ĐÃ hiển thị sẵn trên sidebar
      if (i < menuSteps.length - 1) {
        const nextMenu = menuSteps[i + 1];
        const nextScopedSelector = `${sidebarPrefix}//*[self::a or self::span or self::li or self::div][normalize-space(text())='${nextMenu}' or contains(text(), '${nextMenu}')]`;
        const isNextVisible = await page
          .locator(nextScopedSelector)
          .first()
          .isVisible()
          .catch(() => false);

        if (isNextVisible) {
          log.log(
            `[TabNavigator] Menu con kế tiếp "${nextMenu}" đã hiển thị sẵn trên Sidebar. Bỏ qua click "${menu}".`,
          );
          continue;
        }
      }

      // Ưu tiên selector trong Sidebar, fallback sang selector chung nếu cấu trúc DOM khác biệt
      let activeSelector = scopedSelector;
      const isScopedVisible = await page
        .locator(scopedSelector)
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (!isScopedVisible) {
        activeSelector = fallbackSelector;
      }

      await page.waitForSelector(activeSelector, { state: 'visible', timeout: 15000 });
      await page.click(activeSelector, { force: true });
      await page.waitForTimeout(1000);
    }

    // 2. Đợi URL hash thay đổi theo mẫu dự kiến (Fail-Fast: không nuốt lỗi để tránh xuất file sai trang)
    if (options?.expectedHashPattern) {
      log.log(`[TabNavigator] Đợi URL hash khớp mẫu: ${options.expectedHashPattern}`);
      await page.waitForURL(options.expectedHashPattern, { timeout: 15000 });
    }

    // 3. Nếu có chỉ định sub-tab (ví dụ: Chờ đáo hạn LME, Spreads, ACM)
    if (options?.optionalTabSelector) {
      await this.switchSubTab(page, options.optionalTabSelector, {
        timeout: 15000,
        snapshotPath: options.snapshotPath,
        logger: log,
      });
    } else {
      // Nếu không có sub-tab nhưng có yêu cầu chụp snapshot trang
      await page.waitForTimeout(2000);
      if (options?.snapshotPath) {
        const dir = path.dirname(options.snapshotPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: options.snapshotPath, fullPage: false }).catch(() => { });
        log.log(`[TabNavigator] Đã chụp snapshot: ${options.snapshotPath}`);
      }
    }

    // 4. Kích hoạt xuất file và xác thực định dạng file trả về
    const suggestedName = await this.clickExportAndDownload(
      page,
      downloadPath,
      options?.expectedTargetKey,
      {
        customTimeoutMs: options?.customTimeoutMs,
        logger: log,
      },
    );

    return suggestedName;
  }
}
