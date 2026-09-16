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
import { CcpExcelParser } from '../reconciliation/parsers';

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
    cachedUrl: '/CASHTRANFER/CASHTRANFER_HIST',
    enabled: true,
  },
  {
    code: 'DSL',
    name: 'Danh sách lệnh',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Danh sách lệnh',
    cachedUrl: '/ORDERS/ORDERBOOK',
    enabled: true,
  },
  {
    code: 'DSGD',
    name: 'Danh sách giao dịch',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Danh sách giao dịch',
    cachedUrl: '/ORDERS/ORDERMATCH_DETAIL',
    enabled: true,
  },
  {
    code: 'TTTT',
    name: 'Trạng thái tất toán',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Trạng thái tất toán',
    tabName: 'Lịch sử tất toán',
    cachedUrl: '/ORDERS/PNL_EXECUTED',
    enabled: true,
  },
  {
    code: 'TTM',
    name: 'Trạng thái mở',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Trạng thái mở',
    cachedUrl: '/ORDERS/OPEN_POSITION',
    enabled: true,
  },
  {
    code: 'LSGTT',
    name: 'Lịch sử giá thanh toán',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý lịch sử giá thanh toán',
    cachedUrl: '/PRODUCT/SETTLEMENT_HIST',
    enabled: true,
  },
];

export const DEFAULT_CE_REPORTS: CcpReportConfig[] = [
  {
    code: 'DSL',
    name: 'Lịch sử lệnh (CE)',
    parentMenu: 'Quản lý sổ lệnh',
    childMenu: 'Lịch sử lệnh',
    cachedUrl: '/ORDERS/ORDERBOOK_ALL',
    enabled: true,
  },
  {
    code: 'DSGD',
    name: 'Lịch sử giao dịch (CE)',
    parentMenu: 'Quản lý sổ lệnh',
    childMenu: 'Lịch sử giao dịch',
    cachedUrl: '/ORDERS/ORDERMATCH_ALL',
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
      } catch { }
      throw new Error(`Dang nhap that bai: ${errText.trim()}`);
    }
    this.log('Dang nhap thanh cong.', logCb);
  }

  // ── BACKDROP & SIDEBAR ────────────────────────────────────────────────────

  /**
   * Đóng các popup backdrop MUI che phủ giao diện nếu có.
   * Port 1:1 từ BasePage.dismiss_modal_backdrop (base_page.py:L13-21).
   */
  private async dismissModalBackdrop(page: Page): Promise<void> {
    try {
      const backdrop = page
        .locator(
          "xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]",
        )
        .first();
      if (await backdrop.isVisible({ timeout: 500 })) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    } catch { }
  }

  /**
   * Đảm bảo sidebar đã được mở rộng.
   * Port 1:1 từ BasePage.ensure_sidebar_expanded (base_page.py:L23-43).
   */
  private async ensureSidebarExpanded(page: Page): Promise<void> {
    await this.dismissModalBackdrop(page);
    try {
      const sidebarText = page
        .locator("xpath=//span[text()='Trang chủ'] | //input[contains(@placeholder, 'Tìm kiếm')]")
        .first();
      if (await sidebarText.isVisible({ timeout: 1_000 })) return;

      const toggleBtn = page
        .locator(
          "xpath=//div[contains(@class, 'mui-1rihtzt')] | //div[contains(@class, 'mui-12t1bub')] | //svg[@data-testid='ChevronRightIcon'] | //button[contains(@aria-label, 'open drawer') or contains(@aria-label, 'Mở rộng')]",
        )
        .first();
      if (await toggleBtn.isVisible({ timeout: 1_500 })) {
        await toggleBtn.click({ force: true });
        await page.waitForTimeout(1_000);
      }
    } catch { }
  }

  // ── TABLE LOADING ─────────────────────────────────────────────────────────

  /**
   * Chờ bảng dữ liệu load xong (không còn spinner/skeleton).
   * Ổn định 2 tick 300ms liên tiếp mới return.
   * Port 1:1 từ BaseReportPage.wait_for_table_loading_complete (base_report_page.py:L10-58).
   */
  private async waitForTableLoadingComplete(
    page: Page,
    maxTimeoutMs = 60_000,
  ): Promise<boolean> {
    const spinnerSel =
      "xpath=//*[contains(@class, 'MuiCircularProgress-root') " +
      "or contains(@class, 'MuiLinearProgress-root') " +
      "or contains(@class, 'MuiBackdrop-root') " +
      "or @role='progressbar' " +
      "or contains(@id, 'mrt-progress') " +
      "or contains(@class, 'MuiSkeleton-root')]";

    await page.waitForTimeout(800);

    const startTime = Date.now();
    const maxSec = maxTimeoutMs / 1000.0;
    let stableCount = 0;

    while ((Date.now() - startTime) / 1000.0 < maxSec) {
      // Kiểm tra sớm nếu bảng đã hiện chữ "Không có dữ liệu" -> dừng chờ ngay lập tức
      try {
        const noData = page.locator(
          "xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')] | //*[text()='Không có dữ liệu']",
        ).first();
        if (await noData.isVisible({ timeout: 150 })) {
          return true;
        }
      } catch { }

      // Đếm spinner THỰC SỰ HIỂN THỊ (is_visible)
      const spinners = await page.locator(spinnerSel).all();
      let visibleCount = 0;
      for (const s of spinners) {
        try {
          if (await s.isVisible()) visibleCount++;
        } catch { }
      }

      if (visibleCount === 0) {
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
   * Port 1:1 từ CoreCCPPage.navigate_to_report (core_ccp_page.py:L35-128).
   * Ưu tiên 1: cachedUrl (direct navigation).
   * Ưu tiên 2: Click menu sidebar có danh sách ứng viên (candidates).
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
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15_000 });
        await page.waitForTimeout(1000);
        await this.dismissModalBackdrop(page);

        const checkElem = page.locator(
          "xpath=//button[contains(., 'Tìm kiếm')] | //button[contains(., 'Kết xuất')] | //input[contains(@class, 'MuiPickersInputBase-input')]",
        ).first();
        if (await checkElem.isVisible({ timeout: 3_000 })) {
          return targetUrl;
        } else {
          this.log(`[Nav] Direct URL chua hien bang, fallback sang click Menu...`, logCb);
        }
      } catch {
        this.log(`[Nav] Direct URL that bai, chuyen sang click menu...`, logCb);
      }
    }

    // Click menu sidebar (Chuẩn Candidates từ core_ccp_page.py:L60-125)
    try {
      await this.ensureSidebarExpanded(page);

      const parentCandidates = [report.parentMenu];
      if (report.parentMenu === 'Quản lý tiền' || report.parentMenu === 'Nộp rút tiền') {
        parentCandidates.push('Quản lý tiền', 'Nộp rút tiền');
      }

      let parentElem: ReturnType<Page['locator']> | null = null;
      for (const pCand of parentCandidates) {
        if (!pCand) continue;
        const elem = page.locator(`xpath=//span[text()='${pCand}'] | //span[contains(text(), '${pCand}')]`).first();
        if (await elem.isVisible({ timeout: 1_500 })) {
          parentElem = elem;
          break;
        }
      }

      if (parentElem) {
        await parentElem.click({ force: true });
        await page.waitForTimeout(800);
      }

      const childCandidates = [report.childMenu];
      if (report.childMenu === 'Lịch sử nộp rút tiền' || report.childMenu === 'Lịch sử Nộp/ Rút tiền') {
        childCandidates.push('Lịch sử nộp rút tiền', 'Lịch sử Nộp/ Rút tiền');
      } else if (report.childMenu === 'Lịch sử lệnh' || report.childMenu === 'Danh sách lệnh') {
        childCandidates.push('Lịch sử lệnh', 'Danh sách lệnh');
      } else if (report.childMenu === 'Danh sách giao dịch' || report.childMenu === 'Lịch sử giao dịch') {
        childCandidates.push('Danh sách giao dịch', 'Danh sách giao dịch MM', 'Lịch sử giao dịch');
      } else if (report.childMenu === 'Trạng thái mở' || report.childMenu === 'Vị thế mở') {
        childCandidates.push('Trạng thái mở', 'Vị thế mở', 'Danh sách trạng thái mở');
      }

      let childElem: ReturnType<Page['locator']> | null = null;
      for (const cand of childCandidates) {
        if (!cand) continue;
        const elem = page.locator(`xpath=//span[text()='${cand}'] | //span[contains(text(), '${cand}')]`).first();
        if (await elem.isVisible({ timeout: 1_500 })) {
          childElem = elem;
          break;
        }
      }

      if (childElem) {
        await childElem.click({ force: true });
        await page.waitForTimeout(2000);
      } else if (parentElem) {
        await parentElem.click({ force: true });
        await page.waitForTimeout(800);
        for (const cand of childCandidates) {
          if (!cand) continue;
          const elem = page.locator(`xpath=//span[text()='${cand}'] | //span[contains(text(), '${cand}')]`).first();
          if (await elem.isVisible({ timeout: 1_500 })) {
            await elem.click({ force: true });
            await page.waitForTimeout(2000);
            break;
          }
        }
      }

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
   * Port 1:1 từ BaseReportPage.set_date_range_and_search (base_report_page.py:L59-231).
   * Xử lý đặc biệt: TTTT (click tab), DSGD (xóa "Ngày hệ thống").
   * Trả về 'NO_DATA' nếu bảng hiển thị "Không có dữ liệu" ngay sau khi tìm kiếm.
   */
  async setDateRangeAndSearch(
    page: Page,
    report: CcpReportConfig,
    startDate: string,
    endDate: string,
    filters: CcpFilterOptions = {},
    logCb?: (m: string) => void,
  ): Promise<'OK' | 'EMPTY_TABLE'> {
    await this.dismissModalBackdrop(page);

    // ── Nếu báo cáo có tabName hoặc là TTTT: click tab trước ────────────────
    const url = page.url();
    if (url.includes('PNL_EXECUTED') || report.tabName || report.code === 'TTTT') {
      try {
        const historyTab = page.locator("xpath=//*[self::button or self::div or self::span][contains(text(), 'Lịch sử tất toán')]").first();
        if (await historyTab.isVisible({ timeout: 2_000 })) {
          await historyTab.click({ force: true });
          await page.waitForTimeout(1500);
          this.log(`[Filter] Da click tab: Lich su tat toan`, logCb);
        }
      } catch { }
    }

    // ── DSGD: Xóa ô "Ngày hệ thống" nếu có ──────────────────────────────
    if (report.code === 'DSGD') {
      try {
        const sysDateInput = page.locator(
          "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Ngày hệ thống')]]//input" +
          " | //label[contains(text(), 'Ngày hệ thống')]/following-sibling::div//input",
        ).first();
        if (await sysDateInput.isVisible({ timeout: 1_000 })) {
          await sysDateInput.click({ force: true });
          await page.waitForTimeout(150);
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(150);
          await page.keyboard.press('Tab');
          this.log('[Filter] Da xoa o Ngay he thong (DSGD)', logCb);
        }
      } catch { }
    }

    // ── Điền DatePicker: "Từ ngày" và "Đến ngày" (Chuẩn count >= 3 từ Python) ─
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
        } catch { }
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
        "xpath=//button[contains(., 'Tìm kiếm') or contains(., 'Search')]",
      ).first();
      if (await searchBtn.isVisible({ timeout: 2_000 })) {
        await searchBtn.click({ force: true });
        this.log(`[Filter] Da click Tim kiem: ${startDate} -> ${endDate}`, logCb);
        await this.waitForTableLoadingComplete(page, 60_000);
        await this.dismissModalBackdrop(page);
      }
    } catch {
      this.log('[Filter] Khong tim thay nut Tim kiem, bo qua...', logCb);
    }

    // ── Kiểm tra bảng rỗng sau Tìm kiếm: bỏ qua lọc cột con nhưng vẫn tiếp tục kết xuất tải file
    try {
      const noDataInTable = page.locator(
        "xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')]",
      ).first();
      if (await noDataInTable.isVisible({ timeout: 600 })) {
        this.log('[Filter] Bang bao cao tra ve "Khong co du lieu" -> Bo qua loc cot va chuyen sang ket xuat tai file.', logCb);
        return 'EMPTY_TABLE';
      }
    } catch { }

    return 'OK';
  }

  /**
   * Điền ngày vào DatePicker MUI.
   * Port 1:1 từ BaseReportPage.set_date_range_and_search (base_report_page.py:L88-142).
   */
  private async fillDatePicker(
    page: Page,
    startDate: string,
    endDate: string,
    logCb?: (m: string) => void,
  ): Promise<void> {
    try {
      const pickerInputs = page.locator(
        "xpath=//div[contains(@class, 'MuiPickersInputBase-root') or contains(@class, 'MuiPickersOutlinedInput-root') or @role='group']//input | //input[contains(@class, 'MuiPickersInputBase-input')]",
      );
      const count = await pickerInputs.count();

      let fromInp: ReturnType<Page['locator']> | null = null;
      let toInp: ReturnType<Page['locator']> | null = null;

      const fromByLabel = page.locator(
        "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Từ') or contains(text(), '(Từ)')]]//input | //label[contains(text(), 'Từ') or contains(text(), '(Từ)')]/following-sibling::div//input",
      ).first();
      const toByLabel = page.locator(
        "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Đến') or contains(text(), '(Đến)')]]//input | //label[contains(text(), 'Đến') or contains(text(), '(Đến)')]/following-sibling::div//input",
      ).first();

      if (await fromByLabel.isVisible({ timeout: 800 }).catch(() => false)) fromInp = fromByLabel;
      if (await toByLabel.isVisible({ timeout: 800 }).catch(() => false)) toInp = toByLabel;

      if (count >= 3) {
        if (!fromInp) fromInp = pickerInputs.nth(1);
        if (!toInp) toInp = pickerInputs.nth(2);
      } else if (count === 2) {
        if (!fromInp) fromInp = pickerInputs.nth(0);
        if (!toInp) toInp = pickerInputs.nth(1);
      }

      if (fromInp && toInp) {
        this.log(`[Filter] Dien DatePicker: ${startDate} -> ${endDate}`, logCb);
        await fromInp.click({ force: true });
        await page.waitForTimeout(200);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(150);
        await page.keyboard.type(startDate, { delay: 40 });
        await page.waitForTimeout(200);
        await page.keyboard.press('Tab');

        await toInp.click({ force: true });
        await page.waitForTimeout(200);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(150);
        await page.keyboard.type(endDate, { delay: 40 });
        await page.waitForTimeout(200);
        await page.keyboard.press('Tab');
      }
    } catch (e: any) {
      this.log(`[Filter] Loi dien DatePicker: ${e?.message}`, logCb);
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
      } catch { }
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
      } catch { }
    }
  }

  // ── EXPORT ────────────────────────────────────────────────────────────────

  /**
   * Kích hoạt nút xuất file và bắt sự kiện download.
   * Port 1:1 từ BaseReportPage.trigger_export_download (base_report_page.py:L324-429).
   * Trả về: Download object | 'NO_DATA' | null
   */
  async triggerExportDownload(
    page: Page,
    timeoutMs = 120_000,
    isTableEmpty = false,
    logCb?: (m: string) => void,
  ): Promise<Download | 'NO_DATA' | null> {
    await this.dismissModalBackdrop(page);
    await this.waitForTableLoadingComplete(page, 30_000);

    // Nếu bảng 0 bản ghi: Nếu sàn cho xuất thì file mẫu (4KB) chỉ mất 2-3s; nếu sàn chặn, chỉ chờ tối đa 6s thay vì 60s/120s!
    const effectiveTimeoutMs = isTableEmpty ? 6_000 : timeoutMs;

    // Tìm nút 'Kết xuất' (Vẫn thực hiện kết xuất ngay cả khi bảng 0 dòng để lưu file mẫu/tiêu đề)
    let exportBtn = page.locator(
      "xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Xuất Excel') or contains(., 'Export')]" +
      " | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]",
    ).first();

    if (!(await exportBtn.isVisible({ timeout: 2_000 }).catch(() => false))) {
      exportBtn = page.locator("xpath=//button[.//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']]").first();
    }

    if (!(await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      this.log("   [Export] Khong tim thay nut 'Ket xuat'", logCb);
      return null;
    }

    let downloadObj: Download | null = null;

    const triggerExportWithToastCheck = async (
      actionFn: () => Promise<void>,
    ): Promise<Download | 'NO_DATA' | null> => {
      const downloadPromise = page.waitForEvent('download', { timeout: effectiveTimeoutMs })
        .then((d) => { downloadObj = d; return d; })
        .catch(() => null);

      await actionFn();

      // Quét Toast song song bằng XPath contains(., ...)
      const startTime = Date.now();
      while (Date.now() - startTime < effectiveTimeoutMs) {
        if (downloadObj) return downloadObj;

        try {
          const toastLocator = page.locator(
            "xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message') or contains(@class, 'Toastify') or contains(@role, 'alert') or contains(@class, 'MuiSnackbar-root')]" +
            "[contains(., 'Không có dữ liệu') or contains(., 'không có dữ liệu') or contains(., 'No data') or contains(., 'No records')]",
          ).first();

          if (await toastLocator.isVisible({ timeout: 150 })) {
            const text = (await toastLocator.textContent()) || '';
            this.log(`  [Toast Notification] "${text.trim()}" -> Hệ thống xác nhận không có dữ liệu để xuất!`, logCb);
            return 'NO_DATA';
          }
        } catch { }

        await page.waitForTimeout(200);
      }

      const res = await downloadPromise;
      if (res) return res;
      if (isTableEmpty) {
        this.log('  [Export] Khong co file tai ve sau 6s tren bang rong -> Coi nhu Khong co du lieu.', logCb);
        return 'NO_DATA';
      }
      return null;
    };

    // Phương án 1: Di chuột (Hover) -> "Xuất tất cả" (Python base_report_page.py:L375-406)
    try {
      await exportBtn.hover({ timeout: 5_000, force: true });
      await page.waitForTimeout(400);

      const exportAllOption = page.locator(
        "xpath=//li[contains(text(), 'Xuất tất cả')] | //*[self::li or self::div or self::span][text()='Xuất tất cả']" +
        " | //*[self::li or self::div or self::span or self::p][contains(text(), 'Export all')]",
      ).first();

      if (await exportAllOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const res = await triggerExportWithToastCheck(() => exportAllOption.click({ force: true }));
        await this.dismissModalBackdrop(page);
        return res;
      }
    } catch { }

    // Phương án 2: Double-click nút Kết xuất (Python base_report_page.py:L407-425)
    try {
      const res = await triggerExportWithToastCheck(() => exportBtn.dblclick({ force: true }));
      await this.dismissModalBackdrop(page);
      return res;
    } catch { }

    await this.dismissModalBackdrop(page);
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
    const searchRes = await this.setDateRangeAndSearch(
      page,
      report,
      interval.startStr,
      interval.endStr,
      { exchange: opts.exchange, memberCode: opts.memberCode, acctNo: opts.acctNo },
      logCb,
    );
    const isTableEmpty = searchRes === 'EMPTY_TABLE';

    try {
      const result = await this.triggerExportDownload(page, opts.downloadTimeoutMs, isTableEmpty, logCb);
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
      } catch { }
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

    const searchRes = await this.setDateRangeAndSearch(
      page,
      report,
      startStr,
      endStr,
      { exchange: opts.exchange, memberCode: opts.memberCode, acctNo: opts.acctNo },
      logCb,
    );
    const isTableEmpty = searchRes === 'EMPTY_TABLE';

    // Retry 2 lần với Progressive Timeout (Vẫn xuất file để lấy file mẫu ngay cả khi 0 dòng)
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
        const result = await this.triggerExportDownload(page, currentTimeout, isTableEmpty, logCb);
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
                } catch { }
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
      const searchRes = await this.setDateRangeAndSearch(page, eodReport, tradingDate, tradingDate, {}, logCb);
      const isTableEmpty = searchRes === 'EMPTY_TABLE';

      const downloadResult = await this.triggerExportDownload(page, opts.downloadTimeoutMs, isTableEmpty, logCb);
      if (downloadResult === 'NO_DATA') {
        this.log(`[EOD] Ngay ${tradingDate} khong co du lieu EOD.`, logCb);
        return { success: false, error: 'NO_DATA' };
      }
      if (downloadResult) {
        await downloadResult.saveAs(destPath);
        try {
          fs.copyFileSync(destPath, defaultDestPath);
        } catch { }
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
      const searchRes = await this.setDateRangeAndSearch(page, qlReport, '', '', {}, logCb);
      const isTableEmpty = searchRes === 'EMPTY_TABLE';

      const downloadResult = await this.triggerExportDownload(page, opts.downloadTimeoutMs, isTableEmpty, logCb);
      if (downloadResult === 'NO_DATA') {
        this.log(`[QLTTTKGD] Khong co du lieu trang thai TKGD.`, logCb);
        return { success: false, error: 'NO_DATA' };
      }
      if (downloadResult) {
        await downloadResult.saveAs(defaultDestPath);
        try {
          fs.copyFileSync(defaultDestPath, csvDestPath);
        } catch { }
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

  /**
   * Tải riêng 3 báo cáo CoreCCP phục vụ CheckKLGD (DSGD, TTM, TTTT) trong 1 phiên duy nhất,
   * lưu file vào outputDir và bóc tách trực tiếp số liệu:
   * - klgd: Tổng số lot khớp (DSGD)
   * - ttm: Tổng số vị thế mở Mua + Bán (TTM - /ORDERS/OPEN_POSITION)
   * - tttt: Tổng số lot tất toán Bán (TTTT)
   */
  async downloadAndExtractKlgdMetrics(params: {
    systemUrl: string;
    username: string;
    password: string;
    tradingDate: string; // dd/mm/yyyy
    outputDir: string;
    options?: CcpDownloadOptions;
    logCallback?: (m: string) => void;
  }): Promise<{
    success: boolean;
    tradingDate: string;
    metrics: {
      klgd: number;
      ttm: number;
      tttt: number;
    };
    files: {
      dsgd?: string;
      ttm?: string;
      tttt?: string;
    };
    error?: string;
  }> {
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

    const cleanDate = tradingDate.replace(/\//g, '.');
    const dsgdDestPath = path.join(outputDir, `DSGD_${cleanDate}.xlsx`);
    const ttmDestPath = path.join(outputDir, `TTM_${cleanDate}.xlsx`);
    const ttttDestPath = path.join(outputDir, `TTTT_${cleanDate}.xlsx`);

    const resultFiles: { dsgd?: string; ttm?: string; tttt?: string } = {};
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

      this.log(`[CCP KLGD] Đăng nhập CoreCCP: ${systemUrl}...`, logCb);
      await this.loginVnclear(page, systemUrl, username, password, logCb);

      const targetReports: CcpReportConfig[] = [
        {
          code: 'DSGD',
          name: 'Danh sách giao dịch',
          parentMenu: 'Lệnh và vị thế',
          childMenu: 'Danh sách giao dịch',
          cachedUrl: '/ORDERS/ORDERMATCH_DETAIL',
          enabled: true,
        },
        {
          code: 'TTM',
          name: 'Trạng thái mở',
          parentMenu: 'Lệnh và vị thế',
          childMenu: 'Trạng thái mở',
          cachedUrl: '/ORDERS/OPEN_POSITION',
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
      ];

      for (const rep of targetReports) {
        this.log(`[CCP KLGD] Đang tải báo cáo ${rep.name} (${rep.code})...`, logCb);
        try {
          await this.navigateToReport(page, rep, systemUrl, logCb);
          const searchRes = await this.setDateRangeAndSearch(page, rep, tradingDate, tradingDate, {}, logCb);
          const isTableEmpty = searchRes === 'EMPTY_TABLE';

          const dl = await this.triggerExportDownload(page, opts.downloadTimeoutMs, isTableEmpty, logCb);
          if (dl && dl !== 'NO_DATA') {
            let targetDest = dsgdDestPath;
            if (rep.code === 'TTM') targetDest = ttmDestPath;
            if (rep.code === 'TTTT') targetDest = ttttDestPath;

            await dl.saveAs(targetDest);
            if (rep.code === 'DSGD') resultFiles.dsgd = targetDest;
            if (rep.code === 'TTM') resultFiles.ttm = targetDest;
            if (rep.code === 'TTTT') resultFiles.tttt = targetDest;
            this.log(`[CCP KLGD] Tải thành công ${rep.code}: ${targetDest}`, logCb);
          } else {
            this.log(`[CCP KLGD] Báo cáo ${rep.code} không có dữ liệu để xuất hoặc bảng rỗng.`, logCb);
          }
        } catch (err: any) {
          this.log(`[CCP KLGD] Cảnh báo khi tải ${rep.code}: ${err.message}`, logCb);
        }
      }
    } catch (err: any) {
      this.log(`[CCP KLGD] Lỗi phiên duyệt web CoreCCP: ${err.message}`, logCb);
      return {
        success: false,
        tradingDate,
        metrics: { klgd: 0, ttm: 0, tttt: 0 },
        files: resultFiles,
        error: err.message,
      };
    } finally {
      await context?.close();
      await browser?.close();
    }

    // Parse các file đã tải để lấy ra 3 chỉ số KLGD, TTM, TTTT
    let klgd = 0;
    let ttm = 0;
    let tttt = 0;

    if (resultFiles.dsgd && fs.existsSync(resultFiles.dsgd)) {
      try {
        const parsed = CcpExcelParser.parseDSGD(fs.readFileSync(resultFiles.dsgd), tradingDate);
        klgd = parsed.totalKhop || 0;
      } catch (e: any) {
        this.log(`[CCP KLGD] Lỗi bóc tách DSGD: ${e.message}`, logCb);
      }
    }
    if (resultFiles.ttm && fs.existsSync(resultFiles.ttm)) {
      try {
        const parsed = CcpExcelParser.parseTTM(fs.readFileSync(resultFiles.ttm), tradingDate);
        ttm = parsed.totalTTM || 0;
      } catch (e: any) {
        this.log(`[CCP KLGD] Lỗi bóc tách TTM: ${e.message}`, logCb);
      }
    }
    if (resultFiles.tttt && fs.existsSync(resultFiles.tttt)) {
      try {
        const parsed = CcpExcelParser.parseTTTT(fs.readFileSync(resultFiles.tttt), tradingDate);
        tttt = parsed.totalTTTT || 0;
      } catch (e: any) {
        this.log(`[CCP KLGD] Lỗi bóc tách TTTT: ${e.message}`, logCb);
      }
    }

    this.log(`[CCP KLGD]  Hoàn tất bóc tách CoreCCP: KLGD=${klgd}, TTM=${ttm}, TTTT=${tttt}`, logCb);
    return {
      success: true,
      tradingDate,
      metrics: { klgd, ttm, tttt },
      files: resultFiles,
    };
  }

  /**
   * Khởi tạo phiên trình duyệt CoreCCP phục vụ quy trình Đồng bộ 2 Pha:
   * Pha 1: Mở browser, login Vnclear, điều hướng sẵn vào màn hình DSGD và lọc ngày giao dịch.
   * Cung cấp triggerExportDsgd() để kích hoạt click xuất file cùng lúc với các nguồn khác tại Pha 2.
   */
  async prepareKlgdSession(params: {
    systemUrl: string;
    username: string;
    password: string;
    tradingDate: string; // dd/mm/yyyy
    outputDir: string;
    options?: CcpDownloadOptions;
    logCallback?: (m: string) => void;
  }): Promise<{
    triggerExportDsgd: () => Promise<string | null>;
    downloadRemainingAndExtract: (downloadedDsgdPath?: string) => Promise<{
      success: boolean;
      tradingDate: string;
      metrics: { klgd: number; ttm: number; tttt: number };
      files: { dsgd?: string; ttm?: string; tttt?: string };
      error?: string;
    }>;
    close: () => Promise<void>;
  }> {
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

    const cleanDate = tradingDate.replace(/\//g, '.');
    const dsgdDestPath = path.join(outputDir, `DSGD_${cleanDate}.xlsx`);
    const ttmDestPath = path.join(outputDir, `TTM_${cleanDate}.xlsx`);
    const ttttDestPath = path.join(outputDir, `TTTT_${cleanDate}.xlsx`);

    const resultFiles: { dsgd?: string; ttm?: string; tttt?: string } = {};
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let isTableEmpty = false;

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
    page = await context.newPage();

    this.log(`[CCP KLGD] Đăng nhập CoreCCP: ${systemUrl}...`, logCb);
    await this.loginVnclear(page, systemUrl, username, password, logCb);

    const repDSGD: CcpReportConfig = {
      code: 'DSGD',
      name: 'Danh sách giao dịch',
      parentMenu: 'Lệnh và vị thế',
      childMenu: 'Danh sách giao dịch',
      cachedUrl: '/ORDERS/ORDERMATCH_DETAIL',
      enabled: true,
    };

    this.log(`[CCP KLGD] Điều hướng đến màn hình DSGD và cấu hình ngày ${tradingDate}...`, logCb);
    await this.navigateToReport(page, repDSGD, systemUrl, logCb);
    const searchRes = await this.setDateRangeAndSearch(page, repDSGD, tradingDate, tradingDate, {}, logCb);
    isTableEmpty = searchRes === 'EMPTY_TABLE';
    this.log(`[CCP KLGD] Sẵn sàng tại màn hình xuất DSGD. Đang chờ rào cản đồng bộ...`, logCb);

    const triggerExportDsgd = async (): Promise<string | null> => {
      if (!page || page.isClosed()) return null;
      try {
        this.log(`[CCP KLGD] Kích hoạt xuất báo cáo DSGD...`, logCb);
        const dl = await this.triggerExportDownload(page, opts.downloadTimeoutMs, isTableEmpty, logCb);
        if (dl && dl !== 'NO_DATA') {
          await dl.saveAs(dsgdDestPath);
          resultFiles.dsgd = dsgdDestPath;
          this.log(`[CCP KLGD] Tải thành công DSGD: ${dsgdDestPath}`, logCb);
          return dsgdDestPath;
        }
        return null;
      } catch (err: any) {
        this.log(`[CCP KLGD] Cảnh báo khi xuất DSGD: ${err.message}`, logCb);
        return null;
      }
    };

    const downloadRemainingAndExtract = async (downloadedDsgdPath?: string) => {
      if (downloadedDsgdPath) resultFiles.dsgd = downloadedDsgdPath;
      if (page && !page.isClosed()) {
        const remainingReports: CcpReportConfig[] = [
          {
            code: 'TTM',
            name: 'Trạng thái mở',
            parentMenu: 'Lệnh và vị thế',
            childMenu: 'Trạng thái mở',
            cachedUrl: '/ORDERS/OPEN_POSITION',
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
        ];

        for (const rep of remainingReports) {
          try {
            this.log(`[CCP KLGD] Đang tải báo cáo bổ sung ${rep.name} (${rep.code})...`, logCb);
            await this.navigateToReport(page, rep, systemUrl, logCb);
            const sRes = await this.setDateRangeAndSearch(page, rep, tradingDate, tradingDate, {}, logCb);
            const emptyTbl = sRes === 'EMPTY_TABLE';
            const dl = await this.triggerExportDownload(page, opts.downloadTimeoutMs, emptyTbl, logCb);
            if (dl && dl !== 'NO_DATA') {
              const targetDest = rep.code === 'TTM' ? ttmDestPath : ttttDestPath;
              await dl.saveAs(targetDest);
              if (rep.code === 'TTM') resultFiles.ttm = targetDest;
              if (rep.code === 'TTTT') resultFiles.tttt = targetDest;
              this.log(`[CCP KLGD] Tải thành công ${rep.code}: ${targetDest}`, logCb);
            }
          } catch (err: any) {
            this.log(`[CCP KLGD] Cảnh báo khi tải ${rep.code}: ${err.message}`, logCb);
          }
        }
      }

      await context?.close().catch(() => { });
      await browser?.close().catch(() => { });

      let klgd = 0;
      let ttm = 0;
      let tttt = 0;

      if (resultFiles.dsgd && fs.existsSync(resultFiles.dsgd)) {
        try {
          const parsed = CcpExcelParser.parseDSGD(fs.readFileSync(resultFiles.dsgd), tradingDate);
          klgd = parsed.totalKhop || 0;
        } catch (e: any) {
          this.log(`[CCP KLGD] Lỗi bóc tách DSGD: ${e.message}`, logCb);
        }
      }
      if (resultFiles.ttm && fs.existsSync(resultFiles.ttm)) {
        try {
          const parsed = CcpExcelParser.parseTTM(fs.readFileSync(resultFiles.ttm), tradingDate);
          ttm = parsed.totalTTM || 0;
        } catch (e: any) {
          this.log(`[CCP KLGD] Lỗi bóc tách TTM: ${e.message}`, logCb);
        }
      }
      if (resultFiles.tttt && fs.existsSync(resultFiles.tttt)) {
        try {
          const parsed = CcpExcelParser.parseTTTT(fs.readFileSync(resultFiles.tttt), tradingDate);
          tttt = parsed.totalTTTT || 0;
        } catch (e: any) {
          this.log(`[CCP KLGD] Lỗi bóc tách TTTT: ${e.message}`, logCb);
        }
      }

      this.log(`[CCP KLGD]  Hoàn tất bóc tách CoreCCP: KLGD=${klgd}, TTM=${ttm}, TTTT=${tttt}`, logCb);
      return {
        success: true,
        tradingDate,
        metrics: { klgd, ttm, tttt },
        files: resultFiles,
      };
    };

    const close = async () => {
      await context?.close().catch(() => { });
      await browser?.close().catch(() => { });
    };

    return {
      triggerExportDsgd,
      downloadRemainingAndExtract,
      close,
    };
  }
}
