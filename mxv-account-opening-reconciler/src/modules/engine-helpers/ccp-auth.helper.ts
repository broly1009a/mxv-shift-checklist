/**
 * ============================================================================
 * ccp-auth.helper.ts
 * ============================================================================
 * Helper xử lý xác thực & tương tác Playwright với CoreCCP (VNCLEAR).
 * Phục vụ nghiệp vụ đối soát tài khoản và thẩm định tiểu khoản (-A) trên CoreCCP.
 *
 * Nguyên tắc áp dụng:
 * 1. Fail-Fast & Zero-Silent-Swallow: Bắt buộc assert URL hoặc Toast lỗi khi đăng nhập.
 * 2. Enterprise Resiliency: Tự động loại bỏ backdrop MuiBackdrop nếu che khuất giao diện.
 * 3. Đa môi trường: Tự động tìm kiếm Chrome/Edge trên cả Windows và Linux.
 */

import { Page } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CcpLoginOptions {
  systemUrl: string;
  username: string;
  password: string;
  timeoutMs?: number;
}

export interface CcpLoginResult {
  success: boolean;
  message: string;
  currentUrl: string;
  durationMs: number;
  cookies?: any[];
}

/**
 * Tìm kiếm đường dẫn thực thi Google Chrome hoặc Microsoft Edge khả dụng
 */
export function findBrowserExecutable(): string | undefined {
  if (process.platform === 'linux') {
    const linuxCandidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ];
    return linuxCandidates.find((c) => fs.existsSync(c));
  }

  // Windows candidates
  const winCandidates = [
    path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
    path.join(process.cwd(), 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return winCandidates.find((c) => fs.existsSync(c));
}

/**
 * Giải mã mật khẩu bot CCP (Hỗ trợ cả khóa ENCRYPTION_KEY và salt cố định mxv_secret_salt_fixed)
 */
export function decryptCcpCredentials(encryptedText: string): string {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return encryptedText;

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');

  // Thử 1: Giải mã bằng mxv_secret_salt_fixed (chuẩn bot_credentials CCP)
  try {
    const fixedKey = crypto.createHash('sha256').update('mxv_secret_salt_fixed').digest();
    const decipher1 = crypto.createDecipheriv('aes-256-cbc', fixedKey, iv);
    let decrypted1 = decipher1.update(encrypted);
    decrypted1 = Buffer.concat([decrypted1, decipher1.final()]);
    return decrypted1.toString('utf8');
  } catch {
    // Fallback thử 2: Giải mã bằng ENCRYPTION_KEY từ biến môi trường
    try {
      const envKey = crypto
        .createHash('sha256')
        .update(process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!')
        .digest();
      const decipher2 = crypto.createDecipheriv('aes-256-cbc', envKey, iv);
      let decrypted2 = decipher2.update(encrypted);
      decrypted2 = Buffer.concat([decrypted2, decipher2.final()]);
      return decrypted2.toString('utf8');
    } catch {
      return encryptedText;
    }
  }
}

/**
 * Tự động tắt Backdrop mờ (MuiBackdrop) nếu đang che giao diện
 */
export async function dismissModalBackdrop(page: Page): Promise<void> {
  try {
    const backdrop = page
      .locator("xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]")
      .first();
    if (await backdrop.isVisible({ timeout: 400 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
    }
  } catch {
    // Bỏ qua lỗi nhẹ khi dismiss backdrop
  }
}

/**
 * Đợi quá trình tải dữ liệu bảng (MUI Spinner / ProgressBar) hoàn tất
 */
export async function waitForTableLoadingComplete(page: Page, maxTimeoutMs: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  await page.waitForTimeout(500);

  const spinnerSel =
    "xpath=//*[contains(@class, 'MuiCircularProgress-root') or contains(@class, 'MuiLinearProgress-root') or contains(@class, 'MuiBackdrop-root') or @role='progressbar' or contains(@id, 'mrt-progress') or contains(@class, 'MuiSkeleton-root')]";
  let stableCount = 0;

  while (Date.now() - startTime < maxTimeoutMs) {
    try {
      const noData = page
        .locator(
          "xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')] | //*[text()='Không có dữ liệu']",
        )
        .first();
      if (await noData.isVisible({ timeout: 150 }).catch(() => false)) return true;
    } catch {}

    const spinners = await page.locator(spinnerSel).all();
    let visible = 0;
    for (const s of spinners) {
      try {
        if (await s.isVisible()) visible++;
      } catch {}
    }

    if (visible === 0) {
      stableCount++;
      if (stableCount >= 2) return true;
    } else {
      stableCount = 0;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

/**
 * Đăng nhập vào CoreCCP bằng Playwright Page
 *
 * @param page Playwright Page
 * @param options Cấu hình đăng nhập
 * @returns CcpLoginResult
 */
export async function loginCoreCCP(page: Page, options: CcpLoginOptions): Promise<CcpLoginResult> {
  const startTs = Date.now();
  const { systemUrl, username, password, timeoutMs = 30000 } = options;

  if (!username || !password) {
    throw new Error('Thiếu thông tin đăng nhập CoreCCP (username hoặc password rỗng)!');
  }

  // 1. Điều hướng tới màn hình Login
  await page.goto(systemUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForTimeout(800);

  // 2. Điền username
  const usernameSelector = "input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']";
  await page.waitForSelector(usernameSelector, { state: 'visible', timeout: 15000 });
  await page.fill(usernameSelector, username);

  // 3. Điền password
  const passwordSelector = "input[name='password'], input[placeholder*='mật khẩu'], input[type='password']";
  await page.waitForSelector(passwordSelector, { state: 'visible', timeout: 10000 });
  await page.fill(passwordSelector, password);
  await page.waitForTimeout(300);

  // 4. Click nút Đăng nhập
  const submitBtnSelector = "button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary";
  await page.click(submitBtnSelector);

  // 5. Chờ phản hồi hệ thống (Chờ thoát khỏi URL /login hoặc xuất hiện Dashboard)
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
  await page.waitForTimeout(1000);

  // 6. Quy tắc Fail-Fast: Kiểm tra xem có bị kẹt lại trang /login hay không
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    // Tìm thông báo lỗi từ Material-UI Toast hoặc Form validation
    const errorText = await page
      .locator(
        "xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message') or contains(@role, 'alert') or contains(@class, 'MuiFormHelperText-root')] | //*[contains(text(), 'sai') or contains(text(), 'lỗi') or contains(text(), 'không đúng')]",
      )
      .first()
      .textContent()
      .catch(() => '');

    const cleanErr = errorText ? errorText.trim() : 'Tài khoản hoặc mật khẩu không chính xác';
    throw new Error(`Đăng nhập CoreCCP thất bại! URL vẫn ở trang Login. Lỗi: ${cleanErr}`);
  }

  // 7. Giải phóng backdrop nếu có
  await dismissModalBackdrop(page);

  const durationMs = Date.now() - startTs;
  const cookies = await page.context().cookies();

  return {
    success: true,
    message: 'Đăng nhập CoreCCP thành công!',
    currentUrl,
    durationMs,
    cookies,
  };
}
