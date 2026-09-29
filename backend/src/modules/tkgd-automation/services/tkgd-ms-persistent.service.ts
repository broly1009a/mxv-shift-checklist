import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { chromium, BrowserContext, Page, Browser } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../../schemas/tkgd-user-config.schema';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../../schemas/clean-account-record.schema';
import { scrapeInvestorDetailFromMSystem } from '../../bot-engine/helpers/msystem-scraper.helper';
import { getTkgdAttachmentDirectory } from '../../bot-engine/helpers/tkgd-reconcile-exporter.helper';
import { decrypt } from '../../bot-engine/utils/crypto';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

/**
 * Kết quả cào dữ liệu M-System cho 1 tài khoản
 */
export interface MsScrapeResult {
  maTKGD: string;
  tenTKGD?: string;
  hoVaTen?: string;
  soCMND_HoChieu?: string;
  ngaySinh?: string | Date;
  rawNgaySinh?: string;
  ngayCap?: string | Date;
  rawNgayCap?: string;
  noiCap?: string;
  gioiTinh?: string;
  ngayThamGia?: string | Date;
  loaiHinhTaiKhoan?: string;
  diaChi?: string;
  trangThai?: string;
  chuKy?: string;
  cccdMatTruocLocalPath?: string;
  cccdMatSauLocalPath?: string;
  chuKyLocalPath?: string;
  isFoundOnMS: boolean;
}

/**
 * Trạng thái của Persistent Session
 */
export type SessionState = 'COLD' | 'INITIALIZING' | 'READY' | 'SCRAPING' | 'RE_LOGGING_IN' | 'ERROR';

// ── Helper: Tìm đường dẫn Chrome/Chromium trên hệ thống ────────────────────────
function findBrowserExecutable(): string | undefined {
  if (process.platform === 'linux') {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
    return undefined;
  }

  const possiblePaths = [
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/**
 * TkgdMsPersistentService — Duy trì 1 phiên Chromium mở sẵn 24/7 (Persistent Session Pool)
 *
 * Thay vì mở/đóng Browser mỗi lần cào M-System (mất 16–18s cold start),
 * service này giữ 1 BrowserContext cố định với `userDataDir` trên đĩa,
 * tự động heartbeat mỗi 3 phút và re-login khi phiên hết hạn.
 *
 * Consumer gọi `scrapeAccount(code)` và nhận dữ liệu trong ~1.5–2.0 giây.
 */
@Injectable()
export class TkgdMsPersistentService implements OnModuleDestroy {
  private readonly logger = new Logger(TkgdMsPersistentService.name);

  // ── State ──────────────────────────────────────────────────────────────────
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionState: SessionState = 'COLD';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastSuccessfulScrapeAt = 0;
  private initPromise: Promise<void> | null = null;

  // ── Cấu hình ──────────────────────────────────────────────────────────────
  private readonly MS_BASE_URL = 'https://msadmin.mxv.com.vn';
  private readonly HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 phút
  private readonly PROFILE_DIR = path.join(process.cwd(), 'data', 'ms_persistent_profile');

  constructor(
    @InjectModel(TkgdUserConfig.name)
    private readonly userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(CleanAccountRecord.name)
    private readonly cleanRecordModel: Model<CleanAccountRecordDocument>,
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) { }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Lấy trạng thái hiện tại của phiên Persistent
   */
  getSessionState(): SessionState {
    return this.sessionState;
  }

  /**
   * Khởi tạo phiên trình duyệt Persistent (idempotent — gọi nhiều lần an toàn)
   * @param userEmail Email của user để lấy credentials
   */
  async initialize(userEmail: string): Promise<void> {
    // Nếu đang khởi tạo, chờ promise hiện tại
    if (this.initPromise) {
      return this.initPromise;
    }

    // Nếu đã READY, kiểm tra nhanh page còn sống không
    if (this.sessionState === 'READY' && this.page && !this.page.isClosed()) {
      return;
    }

    this.initPromise = this.doInitialize(userEmail);
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Cào dữ liệu 1 tài khoản cụ thể trên M-System (Hot Query ~1.5–2.0s)
   * @param code Mã tài khoản NĐT (ví dụ: "003C1399395")
   * @param userEmail Email user (để lấy config lưu ảnh)
   * @param options Tùy chọn tải ảnh, ngày batch
   */
  async scrapeAccount(
    code: string,
    userEmail: string,
    options?: { downloadImages?: boolean; batchDate?: string },
  ): Promise<MsScrapeResult> {
    const startTime = Date.now();

    // Đảm bảo phiên đang sẵn sàng
    await this.initialize(userEmail);

    if (!this.page || this.page.isClosed()) {
      throw new Error('[MS-PERSISTENT] Page không khả dụng sau khi khởi tạo.');
    }

    this.sessionState = 'SCRAPING';

    try {
      // Kiểm tra phiên còn hợp lệ trước khi cào
      await this.ensureLoggedIn(userEmail);

      // Xác định thư mục lưu ảnh
      let saveImagesDir: string | undefined;
      if (options?.downloadImages !== false) {
        const config = await this.userConfigModel.findOne({ userEmail }).lean();
        const todayStr = options?.batchDate || new Date().toISOString().slice(0, 10);
        saveImagesDir = getTkgdAttachmentDirectory(
          config?.documentProcessing?.attachmentSavePath,
          todayStr,
          code,
        );
      }

      // Gọi hàm scrape chuẩn (dùng page đang mở sẵn)
      const scraped = await scrapeInvestorDetailFromMSystem(
        this.page,
        code,
        this.MS_BASE_URL,
        saveImagesDir,
      );

      this.lastSuccessfulScrapeAt = Date.now();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`[MS-PERSISTENT] Cào thành công ${code} trong ${duration}s (Hot Query)`);

      return {
        maTKGD: scraped.maTKGD || code,
        tenTKGD: scraped.tenTKGD,
        hoVaTen: scraped.hoVaTen,
        soCMND_HoChieu: scraped.soCMND_HoChieu,
        ngaySinh: scraped.ngaySinh,
        rawNgaySinh: scraped.rawNgaySinh,
        ngayCap: scraped.ngayCap,
        rawNgayCap: scraped.rawNgayCap,
        noiCap: scraped.noiCap,
        gioiTinh: scraped.gioiTinh,
        ngayThamGia: scraped.ngayThamGia,
        loaiHinhTaiKhoan: scraped.loaiHinhTaiKhoan,
        diaChi: scraped.diaChi,
        trangThai: scraped.trangThai,
        chuKy: scraped.chuKy,
        cccdMatTruocLocalPath: scraped.cccdMatTruocLocalPath,
        cccdMatSauLocalPath: scraped.cccdMatSauLocalPath,
        chuKyLocalPath: scraped.chuKyLocalPath,
        isFoundOnMS: scraped.isFoundOnMS,
      };
    } catch (err: any) {
      // Nếu lỗi liên quan navigation / target closed → thử re-login 1 lần rồi retry
      if (
        err.message?.includes('Navigation') ||
        err.message?.includes('Target closed') ||
        err.message?.includes('frame was detached')
      ) {
        this.logger.warn(`[MS-PERSISTENT] Phiên bị đứt (${err.message}), thử re-login và retry...`);
        try {
          await this.performFullLogin(userEmail);
          const scraped = await scrapeInvestorDetailFromMSystem(
            this.page!,
            code,
            this.MS_BASE_URL,
            undefined,
          );
          this.lastSuccessfulScrapeAt = Date.now();
          return { ...scraped, isFoundOnMS: scraped.isFoundOnMS } as MsScrapeResult;
        } catch (retryErr: any) {
          this.logger.error(`[MS-PERSISTENT] Retry sau re-login cũng thất bại: ${retryErr.message}`);
          return { maTKGD: code, isFoundOnMS: false };
        }
      }

      this.logger.error(`[MS-PERSISTENT] Lỗi cào ${code}: ${err.message}`);
      return { maTKGD: code, isFoundOnMS: false };
    } finally {
      this.sessionState = 'READY';
    }
  }

  /**
   * Lưu kết quả cào MS vào MongoDB cho 1 tài khoản
   */
  async saveScrapeResultToDB(code: string, msData: MsScrapeResult): Promise<void> {
    await this.cleanRecordModel.updateMany(
      {
        $or: [
          { maTKGDBase: code },
          { maTKGD: new RegExp(`^${code}`, 'i') },
          { 'noiDungMail.maTKGD_Futures': code },
        ],
      },
      { $set: { ms: msData } },
    );
  }

  /**
   * Kiểm tra kết nối M-System (dùng cho nút "Test" trên giao diện)
   */
  async testConnection(userEmail: string, testCreds?: { username?: string; password?: string; pin?: string }) {
    let username = testCreds?.username;
    let password = testCreds?.password;
    let pin = testCreds?.pin;

    if (!username || !password) {
      const creds = await this.resolveCredentials(userEmail);
      username = username || creds.username;
      password = password || creds.password;
      pin = pin || creds.pin;
    }

    if (!username || !password) {
      return { success: false, message: 'Thiếu thông tin tài khoản hoặc mật khẩu M-System!' };
    }

    const executablePath = findBrowserExecutable();
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    });

    try {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
      page.setDefaultTimeout(25000);
      await page.goto(`${this.MS_BASE_URL}/#/login`, { waitUntil: 'load' });
      await page.waitForTimeout(1500);

      await page.fill('input[type="text"], input[name="username"]', username);
      await page.fill('input[type="password"], input[name="password"]', password);
      await page.click('button[type="submit"], button.btn-primary');
      await page.waitForTimeout(2000);

      let isPinVisible = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        isPinVisible = await page.locator('div.pincode').isVisible({ timeout: 4000 }).catch(() => false);
        if (isPinVisible) break;
        await page.click('button[type="submit"], button.btn-primary').catch(() => { });
        await page.waitForTimeout(2000);
      }

      if (isPinVisible && pin) {
        await this.enterPin(page, pin);
        await page.waitForTimeout(3000);
      }

      const currentUrl = page.url();
      if (currentUrl.includes('dashboard') || currentUrl.includes('clientManagement')) {
        return { success: true, message: `Đăng nhập M-System thành công với tài khoản "${username}"!` };
      }

      const errorText = await page.locator('.ant-alert-error, .invalid-feedback, .ant-message-error')
        .innerText().catch(() => '');
      return {
        success: false,
        message: `Đăng nhập không thành công. ${errorText || 'Vui lòng kiểm tra lại mật khẩu hoặc mã PIN.'}`,
      };
    } catch (err: any) {
      return { success: false, message: `Lỗi kết nối M-System: ${err.message}` };
    } finally {
      await browser.close().catch(() => { });
    }
  }

  /**
   * Trả về Page object hiện tại (cho consumer nâng cao cần thao tác trực tiếp)
   */
  getActivePage(): Page | null {
    if (this.page && !this.page.isClosed()) return this.page;
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════

  async onModuleDestroy() {
    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    this.logger.log('[MS-PERSISTENT] Đang đóng phiên Persistent Browser...');
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => { });
      this.browser = null;
      this.context = null;
      this.page = null;
    }
    this.sessionState = 'COLD';
    this.logger.log('[MS-PERSISTENT] Đã đóng phiên thành công.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE: KHỞI TẠO & ĐĂNG NHẬP
  // ══════════════════════════════════════════════════════════════════════════

  private async doInitialize(userEmail: string): Promise<void> {
    this.sessionState = 'INITIALIZING';
    this.logger.log('[MS-PERSISTENT] Khởi tạo Persistent Browser Session...');

    try {
      // Tạo thư mục profile nếu chưa có
      if (!fs.existsSync(this.PROFILE_DIR)) {
        fs.mkdirSync(this.PROFILE_DIR, { recursive: true });
      }

      const executablePath = findBrowserExecutable();

      // Sử dụng PersistentContext: Cookie, Session Storage và Cache được lưu trên đĩa
      // Khi server restart, mở lại trình duyệt có thể vào thẳng Dashboard mà không cần gõ lại PIN
      this.browser = await chromium.launch({
        ...(executablePath ? { executablePath } : {}),
        headless: process.env.HEADLESS_BOT !== 'false' && process.env.PLAYWRIGHT_HEADLESS !== 'false',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-extensions',
          '--disable-gpu',
          '--window-size=1280,800',
        ],
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });

      this.page = await this.context.newPage();

      // Anti-bot
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
      this.page.setDefaultTimeout(35000);

      this.page.on('console', (msg) =>
        this.logger.debug(`[MS-PERSISTENT Console] [${msg.type()}] ${msg.text()}`),
      );
      this.page.on('pageerror', (err) =>
        this.logger.error(`[MS-PERSISTENT PageError] ${err.message}`, err.stack),
      );

      // Đăng nhập lần đầu
      await this.performFullLogin(userEmail);

      // Bật heartbeat: Mỗi 3 phút kiểm tra phiên còn sống không
      this.startHeartbeat(userEmail);

      this.sessionState = 'READY';
      this.logger.log('[MS-PERSISTENT] Phiên Persistent đã sẵn sàng (READY). Heartbeat đang chạy.');
    } catch (err: any) {
      this.sessionState = 'ERROR';
      this.logger.error(`[MS-PERSISTENT] Lỗi khởi tạo: ${err.message}`);
      // Dọn dẹp nếu lỗi
      await this.browser?.close().catch(() => { });
      this.browser = null;
      this.context = null;
      this.page = null;
      throw err;
    }
  }

  /**
   * Đăng nhập đầy đủ: Mở trang login → Nhập username/password → Gõ PIN
   */
  private async performFullLogin(userEmail: string): Promise<void> {
    if (!this.page || this.page.isClosed()) {
      throw new Error('[MS-PERSISTENT] Không thể đăng nhập: Page chưa khởi tạo.');
    }

    this.sessionState = 'RE_LOGGING_IN';
    const { username, password, pin } = await this.resolveCredentials(userEmail);

    if (!username || !password) {
      throw new Error('Chưa cấu hình thông tin tài khoản M-System hoặc mật khẩu trong Tab Cài Đặt (hoặc trong Bot Credentials của hệ thống)!');
    }

    this.logger.log(`[MS-PERSISTENT] Đăng nhập M-System với tài khoản ${username}...`);
    await this.page.goto(`${this.MS_BASE_URL}/#/login`, { waitUntil: 'load' });
    await this.page.waitForTimeout(1500);

    await this.page.waitForSelector('input[name="username"], input[type="text"]', { state: 'visible', timeout: 15000 });
    await this.page.fill('input[name="username"], input[type="text"]', username);
    await this.page.fill('input[name="password"], input[type="password"]', password);
    await this.page.waitForTimeout(500);
    await this.page.click('button.btn-primary, button[type="submit"]');

    // Chờ bảng PIN ảo (retry 3 lần)
    let pinModalVisible = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      pinModalVisible = await this.page.locator('div.pincode').isVisible({ timeout: 5000 }).catch(() => false);
      if (pinModalVisible) break;

      const loginError = await this.checkForLoginErrors(this.page);
      if (loginError) {
        throw new Error(`Đăng nhập M-System thất bại: ${loginError}`);
      }

      this.logger.warn(`[MS-PERSISTENT] Chưa thấy bảng PIN (thử lần ${attempt}), click lại...`);
      await this.page.click('button.btn-primary, button[type="submit"]').catch(() => { });
      await this.page.waitForTimeout(2000);
    }

    if (!pinModalVisible) {
      const loginError = await this.checkForLoginErrors(this.page);
      if (loginError) {
        throw new Error(`Đăng nhập M-System thất bại: ${loginError}`);
      }
      throw new Error('Đăng nhập M-System thất bại: Không thấy bảng mã PIN ảo (div.pincode) xuất hiện sau 3 lần thử.');
    }

    if (pin) {
      await this.enterPin(this.page, pin);
      await this.page.waitForTimeout(2500);
    }

    // Xác minh đăng nhập thành công
    await this.page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => { });
    this.logger.log('[MS-PERSISTENT] Đăng nhập M-System thành công!');
    this.sessionState = 'READY';
  }

  /**
   * Kiểm tra phiên còn hợp lệ (gọi trước mỗi lần cào)
   */
  private async ensureLoggedIn(userEmail: string): Promise<void> {
    if (!this.page || this.page.isClosed()) {
      await this.doInitialize(userEmail);
      return;
    }

    try {
      // Kiểm tra nhanh: Có đang ở trang login không?
      const isLoginPage = await this.page.locator('input[name="username"], input[type="password"]')
        .isVisible({ timeout: 2000 }).catch(() => false);

      if (isLoginPage) {
        this.logger.warn('[MS-PERSISTENT] Phiên hết hạn, tự động re-login...');
        await this.performFullLogin(userEmail);
      }
    } catch {
      // Nếu page bị đứt kết nối, khởi tạo lại từ đầu
      this.logger.warn('[MS-PERSISTENT] Page không phản hồi, khởi tạo lại browser...');
      await this.shutdown();
      await this.doInitialize(userEmail);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE: HEARTBEAT
  // ══════════════════════════════════════════════════════════════════════════

  private startHeartbeat(userEmail: string): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(async () => {
      if (this.sessionState === 'SCRAPING' || this.sessionState === 'RE_LOGGING_IN') {
        return; // Không ping khi đang bận
      }

      try {
        if (!this.page || this.page.isClosed()) {
          this.logger.warn('[MS-PERSISTENT] Page đã đóng, đang khởi tạo lại...');
          await this.doInitialize(userEmail);
          return;
        }

        // Kiểm tra trang login
        const isLoginPage = await this.page.locator('input[name="username"], input[type="password"]')
          .isVisible({ timeout: 2000 }).catch(() => false);

        if (isLoginPage) {
          this.logger.warn('[MS-PERSISTENT] Heartbeat: Phiên hết hạn → Re-login...');
          await this.performFullLogin(userEmail);
        } else {
          // Ping nhẹ giữ session sống (Keep-Alive)
          await this.page.evaluate(() => fetch('/api/keep-alive').catch(() => { })).catch(() => { });
          this.logger.debug('[MS-PERSISTENT] Heartbeat OK — Phiên vẫn sống.');
        }
      } catch (err: any) {
        this.logger.warn(`[MS-PERSISTENT] Heartbeat lỗi: ${err.message}`);
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE: HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Giải mã credentials M-System: Ưu tiên config cá nhân → fallback sang Bot Credentials hệ thống
   */
  private async resolveCredentials(userEmail: string): Promise<{ username: string; password: string; pin: string }> {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    let username = config?.msystem?.username || '';
    let password = config?.msystem?.passwordEncrypted ? decrypt(config.msystem.passwordEncrypted) : '';
    let pin = config?.msystem?.pinEncrypted ? decrypt(config.msystem.pinEncrypted) : '';

    // Fallback: Kế thừa từ cấu hình hệ thống (Bot Credentials)
    if ((!username || !password) && this.settingsService) {
      try {
        const credentialsRaw = await this.settingsService.getSetting('bot_credentials_msystem', '');
        if (credentialsRaw) {
          const creds = JSON.parse(decrypt(credentialsRaw));
          username = username || creds.username || '';
          password = password || creds.password || '';
          pin = pin || creds.pin || '';
          this.logger.log(`[MS-PERSISTENT] Kế thừa credentials từ Bot Credentials hệ thống (${username})`);
        }
      } catch (err: any) {
        this.logger.warn(`[MS-PERSISTENT] Không thể giải mã credentials từ SystemSettings: ${err.message}`);
      }
    }

    return { username, password, pin };
  }

  /**
   * Nhập mã PIN ảo vào bảng pincode M-System
   */
  private async enterPin(page: Page, pin: string): Promise<void> {
    for (const digit of String(pin)) {
      const checklistDigitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
      const genericBtn = page.locator('.pincode .keyboard .button')
        .filter({ hasText: new RegExp(`^\\s*${digit}\\s*$`) }).first();

      const hasChecklistBtn = await page.locator(checklistDigitSelector)
        .isVisible({ timeout: 1000 }).catch(() => false);

      if (hasChecklistBtn) {
        await page.click(checklistDigitSelector);
      } else if (await genericBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await genericBtn.click();
      }
      await page.waitForTimeout(400);
    }
  }

  /**
   * Quét thông báo lỗi Ant Design / Bootstrap trên trang đăng nhập M-System
   */
  private async checkForLoginErrors(page: Page): Promise<string | null> {
    try {
      // 1. Ant Design notification
      const noticeDesc = page.locator('.ant-notification-notice-description, .ant-notification-notice-message');
      const count = await noticeDesc.count().catch(() => 0);
      if (count > 0) {
        const textList: string[] = [];
        for (let i = 0; i < count; i++) {
          const text = await noticeDesc.nth(i).innerText().catch(() => '');
          if (text.trim()) textList.push(text.trim());
        }
        if (textList.length > 0) return `Thông báo hệ thống: ${textList.join(' | ')}`;
      }

      // 2. Ant Design message alert
      const msgContent = page.locator('.ant-message-custom-content, .ant-message');
      const msgCount = await msgContent.count().catch(() => 0);
      if (msgCount > 0) {
        const textList: string[] = [];
        for (let i = 0; i < msgCount; i++) {
          const text = await msgContent.nth(i).innerText().catch(() => '');
          if (text.trim()) textList.push(text.trim());
        }
        if (textList.length > 0) return `Thông báo từ web: ${textList.join(' | ')}`;
      }

      // 3. Inline form explain errors
      const formExplain = page.locator('.ant-form-item-explain-error');
      const explainCount = await formExplain.count().catch(() => 0);
      if (explainCount > 0) {
        const textList: string[] = [];
        for (let i = 0; i < explainCount; i++) {
          const text = await formExplain.nth(i).innerText().catch(() => '');
          if (text.trim()) textList.push(text.trim());
        }
        if (textList.length > 0) return `Lỗi form: ${textList.join(' | ')}`;
      }

      // 4. General alert
      const generalAlerts = page.locator('.alert-danger, .error-message, #error-msg, .ant-alert-message');
      const genAlertCount = await generalAlerts.count().catch(() => 0);
      if (genAlertCount > 0) {
        const text = await generalAlerts.first().innerText().catch(() => '');
        if (text.trim()) return `Lỗi: ${text.trim()}`;
      }

      return null;
    } catch {
      return null;
    }
  }
}
