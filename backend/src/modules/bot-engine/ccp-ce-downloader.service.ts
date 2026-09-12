/**
 * ccp-ce-downloader.service.ts
 *
 * NestJS service port của Python ReportEngine (cpp-ce-downloader/services/report_engine.py).
 * Tải các báo cáo từ hệ thống VNCLEAR CoreCCP & CoreEX thông qua Playwright.
 *
 * Tuân thủ AGENTS.md Mục 8: Zero Hardcoding — mọi URL, credentials đều đọc từ DB.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, BrowserContext, Page, Download } from 'playwright-core';

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces & Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CcpReportConfig {
  /** Mã báo cáo ngắn: NR, DSL, DSGD, TTTT, LSGTT */
  code: string;
  /** Tên đầy đủ hiển thị trong log */
  name: string;
  /** Tên menu cha trên sidebar */
  parentMenu: string;
  /** Tên menu con cần click */
  childMenu: string;
  /** Tab cần chuyển sang (ví dụ TTTT: "Lịch sử tất toán") */
  tabName?: string;
  /** URL trực tiếp đã học — dùng để điều hướng nhanh; rỗng = phải click menu */
  cachedUrl?: string;
  /** Bật/tắt báo cáo này trong lần chạy */
  enabled: boolean;
}

export interface DateInterval {
  /** dd/mm/yyyy */
  startStr: string;
  /** dd/mm/yyyy */
  endStr: string;
  /** Nhãn tháng dạng mmyy, ví dụ: "0726" */
  mmyy: string;
}

export interface CcpFilterOptions {
  exchange?: string;
  memberCode?: string;
  acctNo?: string;
}

export interface CcpDownloadOptions extends CcpFilterOptions {
  headless?: boolean;
  overwriteExisting?: boolean;
  downloadTimeoutMs?: number;
  autoSplitOnTimeout?: boolean;
}

export interface CcpRunOptions {
  systemUrl: string;
  username: string;
  password: string;
  startDate: string;
  endDate: string;
  outputDir: string;
  reports?: CcpReportConfig[];
  options?: CcpDownloadOptions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Báo cáo mặc định — chỉ định nghĩa NĂNG LỰC (capabilities), không hardcode URL DB
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CCP_REPORTS: CcpReportConfig[] = [
  {
    code: 'EOD',
    name: 'Kết quả EOD',
    parentMenu: 'Vận hành',
    childMenu: 'Kết quả EOD',
    cachedUrl: '/EOD/ACCTMARGIN_HIST',
    enabled: true,
  },
  {
    code: 'QLTTTKGD',
    name: 'Quản lý trạng thái TKGD',
    parentMenu: 'Quản lý rủi ro',
    childMenu: 'Quản lý trạng thái TKGD',
    tabName: 'Danh sách trạng thái TKGD',
    cachedUrl: '/RISKMNG/ACCTMARGIN_ALL',
    enabled: true,
  },
  {
    code: 'NR',
    name: 'Lịch sử nộp rút tiền',
    parentMenu: 'Quản lý tiền',
    childMenu: 'Lịch sử nộp rút tiền',
    cachedUrl: '',
    enabled: true,
  },
  {
    code: 'DSL',
    name: 'Lịch sử lệnh',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Lịch sử lệnh',
    cachedUrl: '',
    enabled: true,
  },
  {
    code: 'DSGD',
    name: 'Lịch sử giao dịch',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Lịch sử giao dịch',
    cachedUrl: '',
    enabled: true,
  },
  {
    code: 'TTTT',
    name: 'Trạng thái tất toán',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Trạng thái tất toán',
    tabName: 'Lịch sử tất toán',
    cachedUrl: '',
    enabled: true,
  },
  {
    code: 'LSGTT',
    name: 'Lịch sử giá thanh toán',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý lịch sử giá thanh toán',
    cachedUrl: '',
    enabled: true,
  },
];

export const DEFAULT_CE_REPORTS: CcpReportConfig[] = [
  {
    code: 'DSL',
    name: 'Lịch sử lệnh (CE)',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Lịch sử lệnh',
    cachedUrl: '',
    enabled: true,
  },
  {
    code: 'DSGD',
    name: 'Lịch sử giao dịch (CE)',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Lịch sử giao dịch',
    cachedUrl: '',
    enabled: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Date Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Chuyển dd/mm/yyyy hoặc yyyy-mm-dd → Date object */
function parseDmY(s: string): Date {
  if (!s) return new Date();
  if (s.includes('-')) {
    const parts = s.split('-').map(Number);
    if (parts[0] > 1000) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  if (s.includes('/')) {
    const parts = s.split('/').map(Number);
    if (parts[0] > 1000) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(s);
}

/** Format Date → dd/mm/yyyy */
function formatDmY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Sinh danh sách các khoảng ngày theo tháng trong khoảng startDate → endDate */
export function generateMonthlyIntervals(startDate: string, endDate: string): DateInterval[] {
  const intervals: DateInterval[] = [];
  const start = parseDmY(startDate);
  const end = parseDmY(endDate);

  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const monthStart = new Date(Math.max(cur.getTime(), start.getTime()));
    const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const monthEnd = new Date(Math.min(lastDay.getTime(), end.getTime()));

    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const yy = String(cur.getFullYear()).slice(-2);

    intervals.push({
      startStr: formatDmY(monthStart),
      endStr: formatDmY(monthEnd),
      mmyy: `${mm}${yy}`,
    });

    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return intervals;
}

/**
 * Chia đôi khoảng ngày. Trả về null nếu là 1 ngày đơn.
 */
export function splitInterval(
  startStr: string,
  endStr: string,
): [DateInterval, DateInterval] | null {
  const start = parseDmY(startStr);
  const end = parseDmY(endStr);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays < 1) return null;

  const midMs = start.getTime() + Math.floor(diffDays / 2) * 86_400_000;
  const mid = new Date(midMs);
  const midPlus1 = new Date(midMs + 86_400_000);

  const buildInterval = (s: Date, e: Date): DateInterval => {
    const mm = String(s.getMonth() + 1).padStart(2, '0');
    const yy = String(s.getFullYear()).slice(-2);
    return { startStr: formatDmY(s), endStr: formatDmY(e), mmyy: `${mm}${yy}` };
  };

  return [buildInterval(start, mid), buildInterval(midPlus1, end)];
}

/** Merge nhiều file CSV: giữ header dòng 1 của file đầu, bỏ header các file tiếp theo */
export function mergeCsvFiles(srcPaths: string[], destPath: string): boolean {
  try {
    let headerWritten = false;
    const out = fs.createWriteStream(destPath, { encoding: 'utf8' });
    for (const src of srcPaths) {
      if (!fs.existsSync(src) || fs.statSync(src).size === 0) continue;
      const content = fs.readFileSync(src, 'utf8');
      const lines = content.split('\n');
      if (!headerWritten) {
        out.write(content);
        headerWritten = true;
      } else {
        // Bỏ dòng header (dòng 0) của các file sau
        out.write('\n' + lines.slice(1).join('\n'));
      }
    }
    out.end();
    return fs.existsSync(destPath) && fs.statSync(destPath).size > 0;
  } catch (e) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CcpCeDownloaderService {
  private readonly logger = new Logger(CcpCeDownloaderService.name);

  /**
   * Retrieves the Chrome/Chromium executable path. Searches local bundled Chrome first, then Edge/Chrome installed on system.
   */
  private getChromeExecutablePath(): string | null {
    if (process.platform === 'win32') {
      const candidates = [
        path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
        path.join(process.cwd(), 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          this.logger.log(`Using Chrome/Edge binary at: ${p}`);
          return p;
        }
      }
    }
    return null;
  }

  // ── Private log helper (ghi vào Logger + callback ngoài nếu có) ──────────
  private log(msg: string, logCallback?: (m: string) => void): void {
    this.logger.log(msg);
    if (logCallback) logCallback(msg);
  }

  /**
   * Ghép cachedUrl tương đối với domain của hệ thống đang kết nối
   */
  resolveReportUrl(cachedUrl: string, systemUrl: string): string {
    if (!cachedUrl) return '';
    if (cachedUrl.startsWith('http://') || cachedUrl.startsWith('https://')) {
      return cachedUrl;
    }
    try {
      let base = systemUrl;
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = 'https://' + base;
      }
      const origin = new URL(base).origin;
      return `${origin}${cachedUrl.startsWith('/') ? '' : '/'}${cachedUrl}`;
    } catch {
      return '';
    }
  }

  /** Nhận diện hệ thống CoreEX dựa trên URL */
  isCoreExSystem(systemUrl: string): boolean {
    return systemUrl.toLowerCase().includes('coreexchange');
  }

  // ── AUTHENTICATION ────────────────────────────────────────────────────────

  /**
   * Đăng nhập vào CoreCCP / CoreEX.
   * Sau khi thành công, page.url() sẽ không còn chứa "/login".
   */
  async loginVnclear(
    page: Page,
    systemUrl: string,
    username: string,
    password: string,
    logCb?: (m: string) => void,
  ): Promise<void> {
    this.log(`Dang nhap '${username}' vao ${systemUrl} ...`, logCb);
    await page.goto(systemUrl, { waitUntil: 'networkidle', timeout: 30_000 });

    await page.fill(
      "input[name='username'], input[placeholder*='ten dang nhap'], input[placeholder*='đăng nhập'], input[type='text']",
      username,
    );
    await page.fill(
      "input[name='password'], input[placeholder*='mat khau'], input[placeholder*='mật khẩu'], input[type='password']",
      password,
    );
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    await page.waitForTimeout(1_000);

    if (page.url().toLowerCase().includes('/login')) {
      const errLoc = page.locator(
        "//*[contains(@class,'MuiAlert-message') or contains(text(),'không chính xác') or contains(text(),'khóa')]",
      );
      let errText = 'Ten dang nhap hoac mat khau khong dung.';
      try {
        if (await errLoc.first().isVisible({ timeout: 1_500 })) {
          errText = (await errLoc.first().textContent()) ?? errText;
        }
      } catch {}
      throw new Error(`Dang nhap that bai: ${errText.trim()}`);
    }
    this.log('Dang nhap thanh cong.', logCb);
  }

  // ── SIDEBAR ───────────────────────────────────────────────────────────────

  /** Đảm bảo sidebar đã được mở rộng */
  private async ensureSidebarExpanded(page: Page): Promise<void> {
    try {
      const toggleBtn = page.locator(
        "button[aria-label*='menu'], button[aria-label*='sidebar'], .MuiDrawer-root button[aria-label]",
      );
      if (await toggleBtn.first().isVisible({ timeout: 1_500 })) {
        await toggleBtn.first().click();
        await page.waitForTimeout(500);
      }
    } catch {}
  }

  // ── TABLE LOADING ─────────────────────────────────────────────────────────

  /**
   * Chờ bảng dữ liệu load xong (không còn spinner/skeleton).
   * Ổn định 2 tick 300ms liên tiếp mới return.
   */
  private async waitForTableLoadingComplete(
    page: Page,
    maxTimeoutMs = 60_000,
  ): Promise<boolean> {
    const spinnerSel =
      '.MuiCircularProgress-root, .MuiLinearProgress-root, .MuiBackdrop-root[aria-hidden="false"], [role=progressbar], .MuiSkeleton-root';
    await page.waitForTimeout(800);

    const deadline = Date.now() + maxTimeoutMs;
    let stableCount = 0;
    while (Date.now() < deadline) {
      const spinners = await page.locator(spinnerSel).count();
      if (spinners === 0) {
        stableCount++;
        if (stableCount >= 2) return true;
      } else {
        stableCount = 0;
      }
      await page.waitForTimeout(300);
    }
    return false;
  }

  // ── NAVIGATION ────────────────────────────────────────────────────────────

  /**
   * Điều hướng đến trang báo cáo.
   * Ưu tiên 1: cachedUrl (direct navigation).
   * Ưu tiên 2: Click menu sidebar.
   * Trả về URL thực tế sau khi điều hướng (để cập nhật cachedUrl cho lần sau).
   */
  async navigateToReport(
    page: Page,
    report: CcpReportConfig,
    systemUrl: string,
    logCb?: (m: string) => void,
  ): Promise<string> {
    // Thử direct URL
    const targetUrl = this.resolveReportUrl(report.cachedUrl || '', systemUrl);
    if (targetUrl) {
      try {
        this.log(`[Nav] Direct URL den trang bao cao: ${targetUrl}`, logCb);
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 20_000 });
        await this.waitForTableLoadingComplete(page, 15_000);
        const currentUrl = page.url();
        if (!currentUrl.toLowerCase().includes('/login')) {
          this.log(`[Nav] Direct URL thanh cong: ${currentUrl}`, logCb);
          return currentUrl;
        }
      } catch {
        this.log(`[Nav] Direct URL that bai, chuyen sang click menu...`, logCb);
      }
    }

    // Click menu sidebar
    try {
      await this.ensureSidebarExpanded(page);

      // Click parent menu
      const parentItem = page.locator(
        `//li[contains(.,'${report.parentMenu}')] | //*[contains(text(),'${report.parentMenu}')]`,
      );
      if (await parentItem.first().isVisible({ timeout: 4_000 })) {
        await parentItem.first().click({ timeout: 8_000 });
        await page.waitForTimeout(400);
      }

      // Click child menu
      const childItem = page.locator(
        `//li[contains(.,'${report.childMenu}')] | //*[contains(text(),'${report.childMenu}')]`,
      );
      await childItem.first().click({ timeout: 8_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      await this.waitForTableLoadingComplete(page, 20_000);

      const learnedUrl = page.url();
      this.log(`[Nav] Menu click thanh cong -> URL: ${learnedUrl}`, logCb);
      return learnedUrl;
    } catch (e: any) {
      this.log(`[Nav] Loi dieu huong den ${report.childMenu}: ${e?.message}`, logCb);
      return page.url();
    }
  }

  // ── FILTERING ─────────────────────────────────────────────────────────────

  /**
   * Đặt bộ lọc ngày và các filter nghiệp vụ, rồi nhấn Tìm kiếm.
   * Xử lý đặc biệt: TTTT (click tab), DSGD (xóa "Ngày hệ thống").
   */
  async setDateRangeAndSearch(
    page: Page,
    report: CcpReportConfig,
    startDate: string,
    endDate: string,
    filters: CcpFilterOptions = {},
    logCb?: (m: string) => void,
  ): Promise<void> {
    // ── Nếu báo cáo có tabName (TTTT): click tab trước ────────────────────
    if (report.tabName) {
      try {
        const tab = page.locator(`//*[contains(text(),'${report.tabName}')]`);
        if (await tab.first().isVisible({ timeout: 3_000 })) {
          await tab.first().click();
          await page.waitForTimeout(600);
          this.log(`[Filter] Da click tab: ${report.tabName}`, logCb);
        }
      } catch {}
    }

    // ── DSGD: Xóa ô "Ngày hệ thống" nếu có ──────────────────────────────
    if (report.code === 'DSGD') {
      try {
        const sysDateInput = page.locator(
          "//label[contains(text(),'Ngày hệ thống')]/..//input | //label[contains(text(),'Ngay he thong')]/..//input",
        );
        if (await sysDateInput.first().isVisible({ timeout: 2_000 })) {
          await sysDateInput.first().click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await page.keyboard.press('Tab');
          this.log('[Filter] Da xoa o Ngay he thong (DSGD)', logCb);
        }
      } catch {}
    }

    // ── Điền DatePicker: "Từ ngày" và "Đến ngày" (Bỏ qua với QLTTTKGD vì là snapshot thời gian thực) ─
    if (report.code !== 'QLTTTKGD') {
      await this.fillDatePicker(page, startDate, endDate, logCb);
    }

    // ── Bật bộ lọc nếu chưa hiển thị ────────────────────────────────────
    if (filters.memberCode || filters.acctNo || filters.exchange) {
      const headerInputCount = await page
        .locator('thead input, thead .MuiInputBase-input')
        .count();
      if (headerInputCount === 0) {
        try {
          const filterToggle = page.locator(
            "//button[contains(@aria-label,'bộ lọc') or contains(@aria-label,'filter') or contains(@title,'bộ lọc')]",
          );
          if (await filterToggle.first().isVisible({ timeout: 2_000 })) {
            await filterToggle.first().click();
            await page.waitForTimeout(500);
          }
        } catch {}
      }
    }

    // ── Filter Mã thành viên ──────────────────────────────────────────────
    if (filters.memberCode) {
      await this.fillFilter(
        page,
        ['Mã thành viên', 'Ma thanh vien'],
        filters.memberCode,
        logCb,
      );
    }

    // ── Filter Số tiểu khoản / Mã TKGD ───────────────────────────────────
    if (filters.acctNo) {
      await this.fillFilter(
        page,
        ['Số tiểu khoản', 'So tieu khoan', 'Mã TKGD', 'Ma TKGD'],
        filters.acctNo,
        logCb,
      );
    }

    // ── Click Tìm kiếm ────────────────────────────────────────────────────
    try {
      const searchBtn = page.locator(
        "//button[contains(text(),'Tìm kiếm') or contains(text(),'Tim kiem') or contains(text(),'Search')]",
      );
      await searchBtn.first().click({ timeout: 5_000 });
      this.log(`[Filter] Da click Tim kiem: ${startDate} -> ${endDate}`, logCb);
    } catch {
      this.log('[Filter] Khong tim thay nut Tim kiem, bo qua...', logCb);
    }

    await this.waitForTableLoadingComplete(page, 60_000);
  }

  /** Điền ngày vào DatePicker MUI */
  private async fillDatePicker(
    page: Page,
    startDate: string,
    endDate: string,
    logCb?: (m: string) => void,
  ): Promise<void> {
    // Tìm các DatePicker input theo label (loại bỏ hidden/aria-hidden)
    const fromLabel = page.locator(
      "//label[contains(text(),'Từ') or contains(text(),'From')]/..//input:not([type='hidden']):not([aria-hidden='true']):not([tabindex='-1']) | //input[contains(@placeholder,'Từ')]:not([type='hidden']):not([aria-hidden='true'])",
    );
    const toLabel = page.locator(
      "//label[contains(text(),'Đến') or contains(text(),'To')]/..//input:not([type='hidden']):not([aria-hidden='true']):not([tabindex='-1']) | //input[contains(@placeholder,'Đến')]:not([type='hidden']):not([aria-hidden='true'])",
    );

    const fillInput = async (loc: ReturnType<Page['locator']>, val: string): Promise<boolean> => {
      try {
        if (await loc.first().isVisible({ timeout: 2_000 })) {
          await loc.first().click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await loc.first().type(val, { delay: 40 });
          await page.keyboard.press('Tab');
          return true;
        }
      } catch {}
      return false;
    };

    const fromOk = await fillInput(fromLabel, startDate);
    const toOk = await fillInput(toLabel, endDate);

    if (!fromOk || !toOk) {
      // Fallback: dùng index của tất cả picker inputs visible
      try {
        const allPickers = page.locator(
          '.MuiPickersTextField-root input:not([type="hidden"]):not([aria-hidden="true"]):not([tabindex="-1"]), .MuiDatePicker-root input:not([type="hidden"]):not([aria-hidden="true"]):not([tabindex="-1"])',
        );
        const cnt = await allPickers.count();
        if (cnt >= 2) {
          const fromIdx = cnt >= 3 ? 1 : 0;
          const toIdx = cnt >= 3 ? 2 : 1;
          await allPickers.nth(fromIdx).click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await allPickers.nth(fromIdx).type(startDate, { delay: 40 });
          await page.keyboard.press('Tab');
          await allPickers.nth(toIdx).click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await allPickers.nth(toIdx).type(endDate, { delay: 40 });
          await page.keyboard.press('Tab');
        }
      } catch (e: any) {
        this.log(`[Filter] Fallback DatePicker loi: ${e?.message}`, logCb);
      }
    }
  }

  /** Điền filter vào ô Top Form hoặc Column Header MRT */
  private async fillFilter(
    page: Page,
    labels: string[],
    value: string,
    logCb?: (m: string) => void,
  ): Promise<void> {
    // Thử Top Form trước
    for (const lbl of labels) {
      try {
        const inp = page.locator(`//label[contains(text(),'${lbl}')]/..//input`);
        if (await inp.first().isVisible({ timeout: 1_500 })) {
          await inp.first().fill(value);
          this.log(`[Filter] Top Form "${lbl}" = "${value}"`, logCb);
          return;
        }
      } catch {}
    }
    // Fallback: Column Header filter (MRT)
    for (const lbl of labels) {
      try {
        const inp = page.locator(
          `//th[contains(.,'${lbl}')]//input | //th[contains(.,'${lbl}')]//.MuiInputBase-input`,
        );
        if (await inp.first().isVisible({ timeout: 1_500 })) {
          await inp.first().fill(value);
          this.log(`[Filter] Column Header "${lbl}" = "${value}"`, logCb);
          return;
        }
      } catch {}
    }
  }

  // ── EXPORT ────────────────────────────────────────────────────────────────

  /**
   * Kích hoạt nút xuất file và bắt sự kiện download.
   * Trả về: Download object | 'NO_DATA' | null
   *
   * Phương án 1: Hover → dropdown "Xuất tất cả"
   * Phương án 2: Double-click nút "Kết xuất"
   */
  async triggerExportDownload(
    page: Page,
    timeoutMs = 120_000,
    logCb?: (m: string) => void,
  ): Promise<Download | 'NO_DATA' | null> {
    const exportBtnSel =
      "//button[contains(text(),'Kết xuất') or contains(text(),'Ket xuat') or contains(text(),'Export') or contains(@aria-label,'export')]";
    const noDataSel =
      "//*[contains(@class,'notistack-Snackbar') or contains(@class,'MuiAlert-message')][contains(text(),'dữ liệu') or contains(text(),'Không') or contains(text(),'khong')]";

    // Kiểm tra fast-skip: bảng không có dữ liệu
    try {
      const emptyTable = page.locator(
        "//*[contains(text(),'Không có dữ liệu') or contains(text(),'No data') or contains(text(),'Khong co du lieu')]",
      );
      if (await emptyTable.first().isVisible({ timeout: 1_500 })) {
        this.log('[Export] Bang khong co du lieu — bo qua.', logCb);
        return 'NO_DATA';
      }
    } catch {}

    // Phương án 1: Hover → "Xuất tất cả"
    try {
      const exportBtn = page.locator(exportBtnSel).first();
      await exportBtn.hover({ timeout: 5_000 });
      await page.waitForTimeout(400);

      const exportAll = page.locator(
        "//li[contains(text(),'Xuất tất cả') or contains(text(),'Xuat tat ca') or contains(text(),'Export all')]",
      );
      if (await exportAll.first().isVisible({ timeout: 1_500 })) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: timeoutMs }),
          exportAll.first().click(),
        ]);

        // Kiểm tra toast NO_DATA ngay sau click
        await page.waitForTimeout(400);
        try {
          const toastNoData = page.locator(noDataSel);
          if (await toastNoData.first().isVisible({ timeout: 400 })) {
            this.log('[Export] Toast NO_DATA bat sau khi click Xuat tat ca.', logCb);
            return 'NO_DATA';
          }
        } catch {}

        this.log('[Export] Download bat dau (Xuat tat ca).', logCb);
        return download;
      }
    } catch {}

    // Phương án 2: Double-click nút Kết xuất
    try {
      const exportBtn = page.locator(exportBtnSel).first();
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: timeoutMs }),
        exportBtn.dblclick({ timeout: 5_000 }),
      ]);

      await page.waitForTimeout(400);
      try {
        const toastNoData = page.locator(noDataSel);
        if (await toastNoData.first().isVisible({ timeout: 400 })) {
          return 'NO_DATA';
        }
      } catch {}

      this.log('[Export] Download bat dau (Double-click).', logCb);
      return download;
    } catch {}

    this.log('[Export] Khong the kich hoat xuat file.', logCb);
    return null;
  }

  // ── CORE DOWNLOAD SINGLE INTERVAL ────────────────────────────────────────

  /** Tải 1 khoảng ngày cụ thể, lưu vào destPath. Trả về true nếu thành công. */
  private async downloadSingleInterval(
    page: Page,
    report: CcpReportConfig,
    systemUrl: string,
    interval: DateInterval,
    destPath: string,
    opts: Required<CcpDownloadOptions>,
    logCb?: (m: string) => void,
  ): Promise<boolean> {
    await this.navigateToReport(page, report, systemUrl, logCb);
    await this.setDateRangeAndSearch(
      page,
      report,
      interval.startStr,
      interval.endStr,
      { exchange: opts.exchange, memberCode: opts.memberCode, acctNo: opts.acctNo },
      logCb,
    );

    try {
      const result = await this.triggerExportDownload(page, opts.downloadTimeoutMs, logCb);
      if (result === 'NO_DATA') {
        this.log(
          `  [Info] Khoang ${interval.startStr} -> ${interval.endStr} khong co du lieu.`,
          logCb,
        );
        return true;
      }
      if (result) {
        await result.saveAs(destPath);
        return fs.existsSync(destPath) && fs.statSync(destPath).size > 0;
      }
    } catch (e: any) {
      this.log(`  [Warn] Loi tai khoang ${interval.startStr} -> ${interval.endStr}: ${e?.message}`, logCb);
    }
    return false;
  }

  // ── SAFETY NET: ADAPTIVE SPLIT ────────────────────────────────────────────

  /**
   * Đệ quy chia đôi khoảng ngày khi timeout, merge lại.
   * depth tối đa = 4. Single day → retry 5 lần với backoff.
   */
  async downloadWithAdaptiveSplit(
    page: Page,
    report: CcpReportConfig,
    systemUrl: string,
    interval: DateInterval,
    targetFolder: string,
    extraSuffix: string,
    opts: Required<CcpDownloadOptions>,
    depth = 1,
    finalDestPath?: string,
    logCb?: (m: string) => void,
  ): Promise<boolean> {
    const { startStr, endStr } = interval;
    const code = report.code;

    const parts = splitInterval(startStr, endStr);

    // Single day — persistent retry với backoff
    if (!parts) {
      const subFile = path.join(
        targetFolder,
        `temp_${code}_${startStr.replace(/\//g, '')}_${endStr.replace(/\//g, '')}${extraSuffix}.csv`,
      );
      this.log(`\n  [Single Day Retry] ${startStr} — kich hoat 5 lan thu lai...`, logCb);
      const backoffs = [0, 15, 30, 45, 45];
      for (let attempt = 1; attempt <= 5; attempt++) {
        if (attempt > 1) {
          this.log(
            `  [Thu lai ${attempt}/5] Nghi ${backoffs[attempt - 1]}s...`,
            logCb,
          );
          await new Promise((r) => setTimeout(r, backoffs[attempt - 1] * 1_000));
        }
        const ok = await this.downloadSingleInterval(
          page,
          report,
          systemUrl,
          interval,
          subFile,
          opts,
          logCb,
        );
        if (ok) return true;
      }
      // Ghi vào MISSING_DATES.txt
      const missingLog = path.join(targetFolder, 'MISSING_DATES.txt');
      try {
        fs.appendFileSync(
          missingLog,
          `[${new Date().toISOString()}] Bao cao ${code} | Ngay ${startStr}: Thu 5 lan that bai.\n`,
          'utf8',
        );
      } catch {}
      return false;
    }

    const [part1, part2] = parts;
    this.log(
      `\n  [Safety Net Lv${depth}] Tach: ${startStr} -> ${endStr} thanh 2 nua: ${part1.startStr}-${part1.endStr} | ${part2.startStr}-${part2.endStr}`,
      logCb,
    );

    if (!finalDestPath) {
      const sTag = startStr.replace(/\//g, '');
      const eTag = endStr.replace(/\//g, '');
      finalDestPath =
        depth === 1
          ? path.join(targetFolder, `${code}${interval.mmyy}${extraSuffix}.csv`)
          : path.join(targetFolder, `temp_merged_${code}_${sTag}_${eTag}${extraSuffix}.csv`);
    }

    const subFiles: string[] = [];
    for (const [idx, sub] of [part1, part2].entries()) {
      const sTag = sub.startStr.replace(/\//g, '');
      const eTag = sub.endStr.replace(/\//g, '');
      const subFile = path.join(
        targetFolder,
        `temp_${code}_${sTag}_${eTag}${extraSuffix}.csv`,
      );
      this.log(`\n  [Safety Net Lv${depth}.${idx + 1}] Tai khoang nho: ${sub.startStr} -> ${sub.endStr}...`, logCb);

      let ok = await this.downloadSingleInterval(page, report, systemUrl, sub, subFile, opts, logCb);
      if (!ok && depth < 4) {
        const mergedSub = path.join(
          targetFolder,
          `temp_merged_${code}_${sTag}_${eTag}${extraSuffix}.csv`,
        );
        ok = await this.downloadWithAdaptiveSplit(
          page,
          report,
          systemUrl,
          sub,
          targetFolder,
          extraSuffix,
          opts,
          depth + 1,
          mergedSub,
          logCb,
        );
        if (ok && fs.existsSync(mergedSub) && fs.statSync(mergedSub).size > 0) {
          subFiles.push(mergedSub);
          continue;
        }
      }
      if (fs.existsSync(subFile) && fs.statSync(subFile).size > 0) {
        subFiles.push(subFile);
      }
    }

    if (subFiles.length > 0) {
      this.log(`\n  [Merge Lv${depth}] Hop nhat ${subFiles.length} file nho...`, logCb);
      const ok = mergeCsvFiles(subFiles, finalDestPath);
      if (ok) {
        const sz = fs.statSync(finalDestPath).size;
        this.log(`  [Thanh cong Merge Lv${depth}] ${finalDestPath} (${sz.toLocaleString()} bytes)`, logCb);
        return true;
      }
    } else {
      this.log(`  [Info] Khoang ${startStr} -> ${endStr} khong co du lieu.`, logCb);
      return true;
    }
    return false;
  }

  // ── DOWNLOAD SINGLE REPORT (monthly) ─────────────────────────────────────

  async downloadReport(
    page: Page,
    report: CcpReportConfig,
    systemUrl: string,
    interval: DateInterval,
    outputDir: string,
    opts: Required<CcpDownloadOptions>,
    logCb?: (m: string) => void,
  ): Promise<boolean> {
    const code = report.code;
    const { startStr, endStr, mmyy } = interval;

    // Suffix cho tên file
    let extraSuffix = '';
    if (opts.exchange && !['tất cả', 'all', ''].includes(opts.exchange.trim().toLowerCase())) {
      extraSuffix += `_${opts.exchange.trim().toUpperCase()}`;
    }
    if (opts.memberCode) extraSuffix += `_TV${opts.memberCode.trim()}`;
    if (opts.acctNo) extraSuffix += `_TK${opts.acctNo.trim()}`;

    // Nếu là thư mục ca trực hàng ngày (kết thúc bằng ngày tháng DD.MM hoặc trong thư mục Backup CCP/CE):
    // Lưu phẳng trực tiếp thành CODE.csv trong outputDir, KHÔNG tạo thư mục con lồng nhau tránh trùng lặp dữ liệu
    const isDailyShiftFolder = /\d{2}\.\d{2}$/.test(outputDir.trim()) || outputDir.includes('Backup CCP') || outputDir.includes('Backup CE');
    const targetFolder = isDailyShiftFolder ? outputDir : path.join(outputDir, code);
    fs.mkdirSync(targetFolder, { recursive: true });

    const fileName = isDailyShiftFolder ? `${code}.csv` : `${code}${mmyy}${extraSuffix}.csv`;
    const destPath = path.join(targetFolder, fileName);

    // Kiểm tra file đã tồn tại
    if (!opts.overwriteExisting && fs.existsSync(destPath)) {
      const sz = fs.statSync(destPath).size;
      if (sz > 100) {
        this.log(`  [Bo qua] ${fileName} da ton tai & hop le (${sz.toLocaleString()} bytes).`, logCb);
        return true;
      }
      this.log(`  [Warn] ${fileName} bi hong/rong (${sz} bytes). Tai lai...`, logCb);
      fs.unlinkSync(destPath);
    } else if (opts.overwriteExisting && fs.existsSync(destPath)) {
      this.log(`  [Ghi de] Tien hanh tai moi file ${fileName}...`, logCb);
      fs.unlinkSync(destPath);
    }

    this.log(`\n  [Dang tai] ${report.name} (${code}) | Thang ${mmyy} (${startStr} -> ${endStr})...`, logCb);

    // Điều hướng + cập nhật cachedUrl
    const learnedUrl = await this.navigateToReport(page, report, systemUrl, logCb);
    report.cachedUrl = learnedUrl;

    await this.setDateRangeAndSearch(
      page,
      report,
      startStr,
      endStr,
      { exchange: opts.exchange, memberCode: opts.memberCode, acctNo: opts.acctNo },
      logCb,
    );

    // Retry 2 lần với Progressive Timeout
    for (let attempt = 1; attempt <= 2; attempt++) {
      const currentTimeout = opts.downloadTimeoutMs * attempt;
      if (attempt > 1) {
        this.log(
          `  [Thu lai ${attempt}/2] Kich hoat lai xuat file ${fileName} (timeout ${currentTimeout / 1000}s)...`,
          logCb,
        );
        await new Promise((r) => setTimeout(r, 2_000));
      }

      try {
        const result = await this.triggerExportDownload(page, currentTimeout, logCb);
        if (result === 'NO_DATA') {
          this.log(`  [Info] ${fileName} khong co du lieu.`, logCb);
          return true;
        }
        if (result) {
          await result.saveAs(destPath);
          if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
            const sz = fs.statSync(destPath).size;
            this.log(`  [Thanh cong] Da luu: ${destPath} (${sz.toLocaleString()} bytes)`, logCb);

            // Dọn dẹp thư mục con thừa nếu trước đó từng tạo ra
            if (isDailyShiftFolder) {
              const legacySubFolder = path.join(outputDir, code);
              if (fs.existsSync(legacySubFolder) && legacySubFolder !== outputDir) {
                try {
                  fs.rmSync(legacySubFolder, { recursive: true, force: true });
                } catch {}
              }
            }
            return true;
          }
          this.log(`  [Warn] File ${fileName} sau khi luu bi rong.`, logCb);
        }
      } catch (e: any) {
        this.log(`  [Warn] Loi xuat file ${fileName} (lan ${attempt}): ${e?.message}`, logCb);
      }
    }

    // Safety Net: chia nhỏ khoảng ngày
    if (opts.autoSplitOnTimeout) {
      this.log(`\n  [Safety Net] Khoang ${startStr} -> ${endStr} het gio — Kich hoat chia nho...`, logCb);
      return this.downloadWithAdaptiveSplit(
        page,
        report,
        systemUrl,
        interval,
        targetFolder,
        extraSuffix,
        opts,
        1,
        undefined,
        logCb,
      );
    }

    return false;
  }

  // ── ORCHESTRATOR ──────────────────────────────────────────────────────────

  /**
   * Chạy toàn bộ tiến trình tải báo cáo CCP hoặc CE.
   * Đây là entry point dùng từ controller hoặc bot job.
   */
  async run(runOpts: CcpRunOptions, logCb?: (m: string) => void): Promise<boolean> {
    const {
      systemUrl,
      username,
      password,
      startDate,
      endDate,
      outputDir,
    } = runOpts;

    const opts: Required<CcpDownloadOptions> = {
      headless: runOpts.options?.headless ?? true,
      overwriteExisting: runOpts.options?.overwriteExisting ?? false,
      downloadTimeoutMs: runOpts.options?.downloadTimeoutMs ?? 120_000,
      autoSplitOnTimeout: runOpts.options?.autoSplitOnTimeout ?? true,
      exchange: runOpts.options?.exchange ?? '',
      memberCode: runOpts.options?.memberCode ?? '',
      acctNo: runOpts.options?.acctNo ?? '',
    };

    const reportsToRun = (runOpts.reports ?? (this.isCoreExSystem(systemUrl) ? DEFAULT_CE_REPORTS : DEFAULT_CCP_REPORTS))
      .filter((r) => r.enabled);

    const intervals = generateMonthlyIntervals(startDate, endDate);

    this.log('='.repeat(60), logCb);
    this.log(`BAT DAU TAI BAO CAO VNCLEAR (${this.isCoreExSystem(systemUrl) ? 'CoreEX' : 'CoreCCP'})`, logCb);
    this.log(`He thong: ${systemUrl}`, logCb);
    this.log(`Khoang: ${startDate} -> ${endDate} (${intervals.length} thang)`, logCb);
    this.log(`Thu muc luu: ${outputDir}`, logCb);
    this.log('='.repeat(60), logCb);

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      const chromePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: opts.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-infobars'],
      };
      if (chromePath) {
        launchOptions.executablePath = chromePath;
      }
      browser = await chromium.launch(launchOptions);
      context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1366, height: 768 },
      });
      const page = await context.newPage();

      // Đăng nhập
      await this.loginVnclear(page, systemUrl, username, password, logCb);

      // Mở sidebar
      await this.ensureSidebarExpanded(page);

      // Vòng lặp tải từng loại báo cáo
      for (const report of reportsToRun) {
        this.log(`\n>>> BAO CAO: ${report.name.toUpperCase()} (${report.code}) <<<`, logCb);
        for (const interval of intervals) {
          await this.downloadReport(page, report, systemUrl, interval, outputDir, opts, logCb);
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      this.log('\nHOAN THANH TOAN BO TIEN TRINH TAI BAO CAO!', logCb);
      return true;
    } catch (e: any) {
      this.log(`[Error] Loi nghiem trong trong qua trinh chay: ${e?.message}`, logCb);
      this.logger.error(e);
      return false;
    } finally {
      await context?.close();
      await browser?.close();
    }
  }

  /**
   * Tải riêng file Kết quả EOD từ CoreCCP (/EOD/ACCTMARGIN_HIST).
   * Lưu trực tiếp thành eod_ccp.csv (hoặc theo ngày) trong thư mục chỉ định.
   */
  async downloadEodCcp(params: {
    systemUrl: string;
    username: string;
    password: string;
    tradingDate: string; // DD/MM/YYYY
    outputDir: string;
    options?: CcpDownloadOptions;
    logCallback?: (m: string) => void;
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const {
      systemUrl,
      username,
      password,
      tradingDate,
      outputDir,
      options: runOpts = {},
      logCallback: logCb,
    } = params;

    const opts: Required<CcpDownloadOptions> = {
      headless: runOpts.headless ?? false,
      overwriteExisting: runOpts.overwriteExisting ?? true,
      exchange: runOpts.exchange ?? '',
      memberCode: runOpts.memberCode ?? '',
      acctNo: runOpts.acctNo ?? '',
      downloadTimeoutMs: runOpts.downloadTimeoutMs ?? 60_000,
      autoSplitOnTimeout: false,
    };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const cleanDate = tradingDate.replace(/\//g, '');
    const destPath = path.join(outputDir, `eod_ccp_${cleanDate}.csv`);
    const defaultDestPath = path.join(outputDir, 'eod_ccp.csv');

    this.log(`[EOD] Bat dau tai Ket qua EOD CCP ngay ${tradingDate}...`, logCb);

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      const chromePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: opts.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-infobars'],
      };
      if (chromePath) launchOptions.executablePath = chromePath;

      browser = await chromium.launch(launchOptions);
      context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1366, height: 768 },
      });
      const page = await context.newPage();

      await this.loginVnclear(page, systemUrl, username, password, logCb);

      const eodReport: CcpReportConfig = {
        code: 'EOD',
        name: 'Kết quả EOD',
        parentMenu: 'Vận hành',
        childMenu: 'Kết quả EOD',
        cachedUrl: '/EOD/ACCTMARGIN_HIST',
        enabled: true,
      };

      await this.navigateToReport(page, eodReport, systemUrl, logCb);
      await this.setDateRangeAndSearch(page, eodReport, tradingDate, tradingDate, {}, logCb);

      const downloadResult = await this.triggerExportDownload(page, opts.downloadTimeoutMs, logCb);
      if (downloadResult === 'NO_DATA') {
        this.log(`[EOD] Ngay ${tradingDate} khong co du lieu EOD.`, logCb);
        return { success: false, error: 'NO_DATA' };
      }
      if (downloadResult) {
        await downloadResult.saveAs(destPath);
        try {
          fs.copyFileSync(destPath, defaultDestPath);
        } catch {}
        const sz = fs.statSync(destPath).size;
        this.log(`[EOD] Da tai thanh cong Ket qua EOD: ${destPath} (${sz.toLocaleString()} bytes)`, logCb);
        return { success: true, filePath: destPath };
      }
      return { success: false, error: 'Download failed' };
    } catch (err: any) {
      this.log(`[EOD] Loi khi tai Ket qua EOD: ${err?.message}`, logCb);
      return { success: false, error: err?.message };
    } finally {
      await context?.close();
      await browser?.close();
    }
  }

  /**
   * Tải riêng file QLTTTKGD từ CoreCCP (/RISKMNG/ACCTMARGIN_ALL).
   * Báo cáo này là trạng thái snapshot tài khoản thời gian thực (trước 05:00), không cần chọn ngày.
   * Tự động lưu thành QLTTTKGD_CCP.xlsx trong thư mục chỉ định.
   */
  async downloadQltkgdCcp(params: {
    systemUrl: string;
    username: string;
    password: string;
    outputDir: string;
    options?: CcpDownloadOptions;
    logCallback?: (m: string) => void;
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const {
      systemUrl,
      username,
      password,
      outputDir,
      options: runOpts = {},
      logCallback: logCb,
    } = params;

    const opts: Required<CcpDownloadOptions> = {
      headless: runOpts.headless ?? false,
      overwriteExisting: runOpts.overwriteExisting ?? true,
      exchange: runOpts.exchange ?? '',
      memberCode: runOpts.memberCode ?? '',
      acctNo: runOpts.acctNo ?? '',
      downloadTimeoutMs: runOpts.downloadTimeoutMs ?? 60_000,
      autoSplitOnTimeout: false,
    };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const defaultDestPath = path.join(outputDir, 'QLTTTKGD_CCP.xlsx');
    const csvDestPath = path.join(outputDir, 'QLTTTKGD_CCP.csv');

    this.log(`[QLTTTKGD] Bat dau tai Trang thai TKGD CCP (QLTTTKGD)...`, logCb);

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      const chromePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: opts.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-infobars'],
      };
      if (chromePath) launchOptions.executablePath = chromePath;

      browser = await chromium.launch(launchOptions);
      context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1366, height: 768 },
      });
      const page = await context.newPage();

      await this.loginVnclear(page, systemUrl, username, password, logCb);

      const qlReport: CcpReportConfig = {
        code: 'QLTTTKGD',
        name: 'Quản lý trạng thái TKGD',
        parentMenu: 'Quản lý rủi ro',
        childMenu: 'Quản lý trạng thái TKGD',
        tabName: 'Danh sách trạng thái TKGD',
        cachedUrl: '/RISKMNG/ACCTMARGIN_ALL',
        enabled: true,
      };

      await this.navigateToReport(page, qlReport, systemUrl, logCb);
      await this.setDateRangeAndSearch(page, qlReport, '', '', {}, logCb);

      const downloadResult = await this.triggerExportDownload(page, opts.downloadTimeoutMs, logCb);
      if (downloadResult === 'NO_DATA') {
        this.log(`[QLTTTKGD] Khong co du lieu trang thai TKGD.`, logCb);
        return { success: false, error: 'NO_DATA' };
      }
      if (downloadResult) {
        await downloadResult.saveAs(defaultDestPath);
        try {
          fs.copyFileSync(defaultDestPath, csvDestPath);
        } catch {}
        const sz = fs.statSync(defaultDestPath).size;
        this.log(`[QLTTTKGD] Da tai thanh cong QLTTTKGD CCP: ${defaultDestPath} (${sz.toLocaleString()} bytes)`, logCb);
        return { success: true, filePath: defaultDestPath };
      }
      return { success: false, error: 'Download failed' };
    } catch (err: any) {
      this.log(`[QLTTTKGD] Loi khi tai QLTTTKGD: ${err?.message}`, logCb);
      return { success: false, error: err?.message };
    } finally {
      await context?.close();
      await browser?.close();
    }
  }
}
