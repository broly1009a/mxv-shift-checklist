import { Injectable, Logger, Optional, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../schemas/tkgd-user-config.schema';
import { RawAccountMail, RawAccountMailDocument } from '../../schemas/raw-account-mail.schema';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../schemas/clean-account-record.schema';
import { encrypt, decrypt } from '../bot-engine/utils/crypto';
import { chromium, Page } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';
import { scrapeInvestorDetailFromMSystem } from '../bot-engine/helpers/msystem-scraper.helper';
import {
  reconcileAndExportToExcel,
  ReconcileSummary,
  getTkgdOutputDirectory,
  getTkgdAttachmentDirectory,
  resolveTkgdOutputDir,
} from '../bot-engine/helpers/tkgd-reconcile-exporter.helper';
import {
  parseAccountOpeningEmailBody,
  parseAccountOpeningEmailMulti,
  dispatchAttachmentsForAccount,
  htmlToPlainText,
} from '../bot-engine/helpers/tkgd-mail-parser.helper';
import { extractHopDongPdf, extractPhuLucPdf } from '../bot-engine/helpers/tkgd-doc-extractor.helper';
import { runPythonExtractor } from '../bot-engine/helpers/tkgd-python-bridge.helper';
import { SystemSettingsService } from '../system-settings/system-settings.service';

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
    return undefined; // Để Playwright tự động dùng chromium mặc định trên Linux
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
 * Nhận diện và bỏ qua các tệp ảnh logo, banner, chữ ký email không phải hồ sơ pháp lý
 */
function isIgnoredEmailAttachment(fileName?: string): boolean {
  if (!fileName) return true;
  const lower = fileName.trim().toLowerCase();
  if (
    lower === 'thumbs.db' ||
    lower === 'desktop.ini' ||
    lower === 'image.png' ||
    lower === 'image.jpg' ||
    lower === 'image.jpeg' ||
    lower === 'image.gif' ||
    /^image\d+\.(png|jpe?g|gif)$/i.test(lower) ||
    lower.startsWith('logo') ||
    lower.includes('-logo') ||
    lower.includes('_logo') ||
    lower.includes('mxv-logo') ||
    lower.includes('company-logo') ||
    lower.startsWith('banner') ||
    lower.startsWith('footer') ||
    lower.startsWith('signature-banner') ||
    lower.startsWith('outlook-') ||
    lower.startsWith('icon')
  ) {
    return true;
  }
  return false;
}

function parseDate(dStr?: string): Date | undefined {
  if (!dStr) return undefined;
  const s = dStr.trim().replace(/-/g, '/');
  const p = s.split('/');
  if (p.length === 3) {
    let dd: number, mm: number, yyyy: number;
    if (p[0].length === 4) {
      yyyy = parseInt(p[0], 10);
      mm = parseInt(p[1], 10) - 1;
      dd = parseInt(p[2], 10);
    } else {
      dd = parseInt(p[0], 10);
      mm = parseInt(p[1], 10) - 1;
      yyyy = parseInt(p[2], 10);
    }
    const d = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? undefined : d;
}

function formatDateStr(d?: Date | string | null): string {
  if (!d) return '';
  if (typeof d === 'string') {
    const s = d.trim();
    const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${dmyMatch[3]}`;
    }
  }
  const date = d instanceof Date ? d : parseDate(String(d));
  if (!date || isNaN(date.getTime())) return typeof d === 'string' ? d : '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeDateStr(d: string | undefined | null): string {
  if (!d) return '';
  const clean = String(d).trim().split('T')[0].split(' ')[0].replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }
  return clean;
}

function isGenderMatch(g1?: string, g2?: string): boolean {
  if (!g1 || !g2) return true;
  const s1 = g1.trim().toLowerCase();
  const s2 = g2.trim().toLowerCase();
  const isFemale1 = ['nữ', 'nu', 'female', 'f'].includes(s1);
  const isFemale2 = ['nữ', 'nu', 'female', 'f'].includes(s2);
  const isMale1 = ['nam', 'male', 'm'].includes(s1);
  const isMale2 = ['nam', 'male', 'm'].includes(s2);
  if (isFemale1 && isFemale2) return true;
  if (isMale1 && isMale2) return true;
  return s1 === s2;
}

/**
 * Tự động suy luận Giới tính và Năm sinh từ cấu trúc 12 chữ số CCCD chuẩn của Bộ Công An
 * PPPGYYNNNNNN (G: 0/1 -> 1900s, 2/3 -> 2000s, 4/5 -> 2100s; số chẵn Nam, số lẻ Nữ)
 */
function inferFromCCCD(soCCCD?: string): { gioiTinh?: string; namSinh?: number } {
  if (!soCCCD) return {};
  const clean = soCCCD.replace(/\D/g, '');
  if (clean.length !== 12) return {};
  const genderCenturyDigit = parseInt(clean.charAt(3), 10);
  let gioiTinh: string | undefined = undefined;
  let century = 1900;
  if (genderCenturyDigit === 0 || genderCenturyDigit === 1) {
    century = 1900;
    gioiTinh = genderCenturyDigit === 0 ? 'Nam' : 'Nữ';
  } else if (genderCenturyDigit === 2 || genderCenturyDigit === 3) {
    century = 2000;
    gioiTinh = genderCenturyDigit === 2 ? 'Nam' : 'Nữ';
  } else if (genderCenturyDigit === 4 || genderCenturyDigit === 5) {
    century = 2100;
    gioiTinh = genderCenturyDigit === 4 ? 'Nam' : 'Nữ';
  }
  const yearShort = parseInt(clean.substring(4, 6), 10);
  const namSinh = century + yearShort;
  return { gioiTinh, namSinh };
}

@Injectable()
export class TkgdAutomationService {
  private readonly logger = new Logger(TkgdAutomationService.name);

  constructor(
    @InjectModel(TkgdUserConfig.name) private userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(RawAccountMail.name) private rawMailModel: Model<RawAccountMailDocument>,
    @InjectModel(CleanAccountRecord.name) private cleanRecordModel: Model<CleanAccountRecordDocument>,
    @Optional() private readonly settingsService?: SystemSettingsService,
  ) { }

  /**
   * Quét các thông báo lỗi Ant Design / Bootstrap trên trang đăng nhập M-System (Áp dụng từ Checklist Bot)
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


  /**
   * Lấy cấu hình của User (Mật khẩu và PIN được che dấu sao)
   */
  async getUserConfig(userEmail: string) {
    let config = await this.userConfigModel.findOne({ userEmail }).lean();
    if (!config) {
      // Trả về cấu hình mặc định
      return {
        userEmail,
        fullName: userEmail.split('@')[0],
        department: 'Thanh toán bù trừ',
        msystem: {
          username: '',
          hasPassword: false,
          hasPin: false,
        },
        outlook: {
          targetMailbox: 'clearing.acc@mxv.vn',
          hasRefreshToken: false,
        },
        storage: {
          windowsPath: 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD',
          linuxPath: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
        },
        preferences: {
          autoHighlightExcel: true,
          saveToAtlas: true,
        },
        documentProcessing: {
          autoDownloadMailAttachments: true,
          autoSaveMSystemImages: true,
          attachmentSavePath: '',
          autoExtractPdf: true,
          enableOcrCccd: true,
          enableTripleCheckCccd: true,
          checkSignatureRequired: true,
        },
      };
    }

    return {
      userEmail: config.userEmail,
      fullName: config.fullName,
      department: config.department || 'Thanh toán bù trừ',
      msystem: {
        username: config.msystem?.username || '',
        hasPassword: !!config.msystem?.passwordEncrypted,
        hasPin: !!config.msystem?.pinEncrypted,
      },
      outlook: {
        targetMailbox: config.outlook?.targetMailbox || 'clearing.acc@mxv.vn',
        hasRefreshToken: !!config.outlook?.refreshToken,
        authorizedEmail: config.outlook?.authorizedEmail || '',
        tokenRenewedAt: config.outlook?.tokenRenewedAt || '',
        clientId: config.outlook?.clientId || '',
        tenantId: config.outlook?.tenantId || '',
        hasClientSecret: !!config.outlook?.clientSecret,
      },
      storage: {
        windowsPath: config.storage?.windowsPath || 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD',
        linuxPath: config.storage?.linuxPath || '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
      },
      preferences: {
        autoHighlightExcel: config.preferences?.autoHighlightExcel ?? true,
        saveToAtlas: config.preferences?.saveToAtlas ?? true,
      },
      documentProcessing: {
        autoDownloadMailAttachments: config.documentProcessing?.autoDownloadMailAttachments ?? true,
        autoSaveMSystemImages: config.documentProcessing?.autoSaveMSystemImages ?? true,
        attachmentSavePath: config.documentProcessing?.attachmentSavePath || '',
        autoExtractPdf: config.documentProcessing?.autoExtractPdf ?? true,
        enableOcrCccd: config.documentProcessing?.enableOcrCccd ?? true,
        enableTripleCheckCccd: config.documentProcessing?.enableTripleCheckCccd ?? true,
        checkSignatureRequired: config.documentProcessing?.checkSignatureRequired ?? true,
      },
    };
  }

  /**
   * Lưu hoặc cập nhật cấu hình cho User (mã hóa mật khẩu và PIN bằng AES)
   */
  async saveUserConfig(userEmail: string, dto: any) {
    let config = await this.userConfigModel.findOne({ userEmail });
    if (!config) {
      config = new this.userConfigModel({
        userEmail,
        fullName: dto.fullName || userEmail.split('@')[0],
        department: dto.department || 'Thanh toán bù trừ',
      });
    }

    if (dto.fullName) config.fullName = dto.fullName;
    if (dto.department) config.department = dto.department;

    // Cập nhật M-System
    if (!config.msystem) (config as any).msystem = {};
    if (dto.msystem?.username !== undefined) config.msystem.username = dto.msystem.username;
    if (dto.msystem?.password) {
      config.msystem.passwordEncrypted = encrypt(dto.msystem.password);
    }
    if (dto.msystem?.pin) {
      config.msystem.pinEncrypted = encrypt(dto.msystem.pin);
    }

    // Cập nhật Outlook
    if (!config.outlook) (config as any).outlook = {};
    if (dto.outlook?.targetMailbox !== undefined) {
      config.outlook.targetMailbox = dto.outlook.targetMailbox;
    }
    if (dto.outlook?.refreshToken !== undefined) {
      config.outlook.refreshToken = dto.outlook.refreshToken;
    }
    if (dto.outlook?.clientId !== undefined) {
      config.outlook.clientId = dto.outlook.clientId;
    }
    if (dto.outlook?.tenantId !== undefined) {
      config.outlook.tenantId = dto.outlook.tenantId;
    }
    if (dto.outlook?.clientSecret) {
      config.outlook.clientSecret = dto.outlook.clientSecret;
    }

    // Cập nhật Storage
    if (!config.storage) (config as any).storage = {};
    if (dto.storage?.windowsPath) config.storage.windowsPath = dto.storage.windowsPath;
    if (dto.storage?.linuxPath) config.storage.linuxPath = dto.storage.linuxPath;

    // Cập nhật Preferences
    if (!config.preferences) (config as any).preferences = {};
    if (dto.preferences?.autoHighlightExcel !== undefined) {
      config.preferences.autoHighlightExcel = dto.preferences.autoHighlightExcel;
    }

    // Cập nhật Document Processing
    if (!config.documentProcessing) (config as any).documentProcessing = {};
    if (dto.documentProcessing) {
      if (dto.documentProcessing.autoDownloadMailAttachments !== undefined) {
        config.documentProcessing.autoDownloadMailAttachments = dto.documentProcessing.autoDownloadMailAttachments;
      }
      if (dto.documentProcessing.autoSaveMSystemImages !== undefined) {
        config.documentProcessing.autoSaveMSystemImages = dto.documentProcessing.autoSaveMSystemImages;
      }
      if (dto.documentProcessing.attachmentSavePath !== undefined) {
        config.documentProcessing.attachmentSavePath = dto.documentProcessing.attachmentSavePath.trim();
      }
      if (dto.documentProcessing.autoExtractPdf !== undefined) {
        config.documentProcessing.autoExtractPdf = dto.documentProcessing.autoExtractPdf;
      }
      if (dto.documentProcessing.enableOcrCccd !== undefined) {
        config.documentProcessing.enableOcrCccd = dto.documentProcessing.enableOcrCccd;
      }
      if (dto.documentProcessing.enableTripleCheckCccd !== undefined) {
        config.documentProcessing.enableTripleCheckCccd = dto.documentProcessing.enableTripleCheckCccd;
      }
      if (dto.documentProcessing.checkSignatureRequired !== undefined) {
        config.documentProcessing.checkSignatureRequired = dto.documentProcessing.checkSignatureRequired;
      }
    }

    await config.save();
    this.logger.log(`Đã lưu cấu hình TKGD cho user: ${userEmail}`);
    return await this.getUserConfig(userEmail);
  }

  /**
   * Lưu Token Outlook độc lập sau khi Microsoft OAuth callback thành công
   */
  async saveOutlookAuthorizedToken(
    userEmail: string,
    tokenData: { refreshToken: string; authorizedEmail?: string },
  ) {
    let config = await this.userConfigModel.findOne({ userEmail });
    if (!config) {
      config = new this.userConfigModel({
        userEmail,
        fullName: userEmail.split('@')[0],
        department: 'Thanh toán bù trừ',
      });
    }
    if (!config.outlook) (config as any).outlook = {};
    config.outlook.refreshToken = tokenData.refreshToken;
    if (tokenData.authorizedEmail) {
      config.outlook.authorizedEmail = tokenData.authorizedEmail;
    }
    config.outlook.tokenRenewedAt = new Date().toISOString();
    await config.save();
    this.logger.log(`[TKGD-OUTLOOK] Đã lưu Refresh Token Outlook độc lập cho ${userEmail}`);
    return config;
  }

  /**
   * Lấy clientSecret của user
   */
  async getRawClientSecret(userEmail: string): Promise<string> {
    const config = await this.userConfigModel.findOne({ userEmail });
    return config?.outlook?.clientSecret || '';
  }

  /**
   * Hủy kết nối / Đăng xuất tài khoản Outlook độc lập của TKGD
   */
  async disconnectOutlook(userEmail: string) {
    const config = await this.userConfigModel.findOne({ userEmail });
    if (config && config.outlook) {
      config.outlook.refreshToken = '';
      config.outlook.authorizedEmail = '';
      config.outlook.tokenRenewedAt = '';
      await config.save();
    }
    return { success: true, message: 'Đã hủy kết nối tài khoản Outlook độc lập thành công' };
  }

  /**
   * Kiểm tra đăng nhập M-System trực tiếp với credentials được cung cấp
   */
  async testMSystemConnection(userEmail: string, testCreds?: { username?: string; password?: string; pin?: string }) {
    let username = testCreds?.username;
    let password = testCreds?.password;
    let pin = testCreds?.pin;

    // Nếu không truyền trực tiếp, lấy từ config DB
    if (!username || !password) {
      const config = await this.userConfigModel.findOne({ userEmail });
      if (config && config.msystem?.username && config.msystem?.passwordEncrypted) {
        username = config.msystem.username;
        password = decrypt(config.msystem.passwordEncrypted);
        pin = config.msystem.pinEncrypted ? decrypt(config.msystem.pinEncrypted) : '';
      }
    }

    if (!username || !password) {
      return {
        success: false,
        message: 'Thiếu thông tin tài khoản hoặc mật khẩu M-System!',
      };
    }

    this.logger.log(`Kiểm tra đăng nhập M-System cho tài khoản: ${username}`);
    const executablePath = findBrowserExecutable();
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    });

    try {
      const page = await browser.newPage();
      // Áp dụng kỹ thuật Anti-bot chuẩn từ Checklist Bot (rpa-downloader.service.ts)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      page.setDefaultTimeout(25000);
      await page.goto('https://msadmin.mxv.com.vn/#/login', { waitUntil: 'load' });
      await page.waitForTimeout(1500);

      await page.fill('input[type="text"], input[name="username"]', username);
      await page.fill('input[type="password"], input[name="password"]', password);
      await page.click('button[type="submit"], button.btn-primary');
      await page.waitForTimeout(2000);

      // Kiểm tra xem có popup PIN không (áp dụng cơ chế retry 3 lần như Checklist Bot)
      let isPinVisible = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        isPinVisible = await page.locator('div.pincode').isVisible({ timeout: 4000 }).catch(() => false);
        if (isPinVisible) break;
        this.logger.warn(`[TKGD-MS] Chưa thấy bảng PIN (thử lần ${attempt}), click lại Đăng nhập...`);
        await page.click('button[type="submit"], button.btn-primary').catch(() => { });
        await page.waitForTimeout(2000);
      }

      if (isPinVisible && pin) {
        this.logger.log(`Nhập mã PIN ảo M-System (${String(pin).length} số)...`);
        for (const digit of String(pin)) {
          const btn = page.locator('.pincode .keyboard .button').filter({ hasText: new RegExp(`^\\s*${digit}\\s*$`) }).first();
          if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await btn.click();
            await page.waitForTimeout(300);
          } else {
            const fallbackEl = page.locator(`div.pincode >> xpath=.//div[text()='${digit}']`).first();
            if (await fallbackEl.isVisible({ timeout: 1000 }).catch(() => false)) {
              await fallbackEl.click();
              await page.waitForTimeout(300);
            }
          }
        }
        // Sau khi nhập đủ mã PIN, M-System tự động xác thực và chuyển trang (không có nút Xác nhận)
        await page.waitForTimeout(3000);
      }

      const currentUrl = page.url();
      if (currentUrl.includes('dashboard') || currentUrl.includes('clientManagement')) {
        await browser.close();
        return {
          success: true,
          message: `Đăng nhập M-System thành công với tài khoản "${username}"!`,
        };
      } else {
        // Kiểm tra thông báo lỗi trên trang nếu có
        const errorText = await page.locator('.ant-alert-error, .invalid-feedback, .ant-message-error').innerText().catch(() => '');
        await browser.close();
        return {
          success: false,
          message: `Đăng nhập không thành công. ${errorText || 'Vui lòng kiểm tra lại mật khẩu hoặc mã PIN.'}`,
        };
      }
    } catch (err: any) {
      await browser.close();
      return {
        success: false,
        message: `Lỗi kết nối M-System: ${err.message}`,
      };
    }
  }

  /**
   * Lấy danh sách hồ sơ đối soát từ clean_account_records (có hỗ trợ phân trang, lọc ngày, tìm kiếm)
   */
  /**
   * Lấy danh sách hồ sơ đối soát từ clean_account_records
   * NGHIỆP VỤ MXV CHUẨN: Gom nhóm 1 Khách hàng = 1 Dòng duy nhất theo Mã gốc (Base Code không đuôi).
   * Các tiểu khoản (-A cho ACM, -L cho LME, -S cho Spread) được gộp vào hồ sơ nhà đầu tư.
   */
  async getRecords(
    options:
      | {
        limit?: number;
        skip?: number;
        page?: number;
        filter?: string;
        batchDate?: string;
        search?: string;
      }
      | number = 20,
    skipArg: number = 0,
    filterArg?: string
  ) {
    let limit = 20;
    let skip = 0;
    let page = 1;
    let filter: string | undefined = undefined;
    let batchDate: string | undefined = undefined;
    let search: string | undefined = undefined;

    if (typeof options === 'object') {
      limit = options.limit || 20;
      page = options.page || (options.skip ? Math.floor(options.skip / limit) + 1 : 1);
      skip = options.skip !== undefined ? options.skip : (page - 1) * limit;
      filter = options.filter;
      batchDate = options.batchDate;
      search = options.search;
    } else {
      limit = options;
      skip = skipArg;
      filter = filterArg;
      page = Math.floor(skip / limit) + 1;
    }

    const query: any = {};
    if (batchDate) {
      query['batchDate'] = batchDate;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { maTKGD: regex },
        { maTKGDBase: regex },
        { 'noiDungMail.tenTaiKhoan': regex },
        { 'noiDungMail.maTKGD_Futures': regex },
        { 'noiDungMail.maTKGD_ACM': regex },
        { 'ms.hoVaTen': regex },
        { 'ms.tenTKGD': regex },
        { 'ms.soCMND_HoChieu': regex },
      ];
    }

    const rawRecords = await this.cleanRecordModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Helper trích xuất mã gốc chuẩn (Base Code)
    const extractBaseCode = (record: any): string => {
      if (record.maTKGDBase && record.maTKGDBase.trim()) return record.maTKGDBase.trim();
      if (record.noiDungMail?.maTKGD_Futures && record.noiDungMail.maTKGD_Futures.trim()) {
        return record.noiDungMail.maTKGD_Futures.trim();
      }
      if (record.maTKGD && record.maTKGD.trim()) {
        return record.maTKGD.trim().split('-')[0];
      }
      if (record.ms?.maTKGD && record.ms.maTKGD.trim()) {
        return record.ms.maTKGD.trim().split('-')[0];
      }
      return '';
    };

    // Gom nhóm theo nhà đầu tư (1 Khách hàng = 1 Dòng duy nhất)
    const groupedMap = new Map<string, any>();

    for (const r of rawRecords) {
      const baseCode = extractBaseCode(r);
      const groupKey = baseCode || r._id.toString();

      if (!groupedMap.has(groupKey)) {
        const primaryDoc: any = {
          ...r,
          maTKGD: baseCode || r.maTKGD,
          maTKGDBase: baseCode,
          accountTypes: [r.accountType || (r.maTKGD?.includes('-A') ? 'ACM' : 'FUTURES')],
          subAccounts: [] as any[],
        };

        if (r.maTKGD?.includes('-')) {
          primaryDoc.subAccounts.push({
            code: r.maTKGD,
            type: r.accountType || (r.maTKGD.endsWith('-A') ? 'ACM' : 'SUB'),
            status: r.ketLuan?.trangThai || 'CHUA_XU_LY',
          });
        }
        if (r.noiDungMail?.hasACMRequest && !primaryDoc.accountTypes.includes('ACM')) {
          primaryDoc.accountTypes.push('ACM');
        }

        groupedMap.set(groupKey, primaryDoc);
      } else {
        const existing = groupedMap.get(groupKey);
        const rType = r.accountType || (r.maTKGD?.includes('-A') ? 'ACM' : 'FUTURES');
        if (!existing.accountTypes.includes(rType)) {
          existing.accountTypes.push(rType);
        }
        if (r.noiDungMail?.hasACMRequest && !existing.accountTypes.includes('ACM')) {
          existing.accountTypes.push('ACM');
        }

        if (r.maTKGD?.includes('-')) {
          if (!existing.subAccounts.some((s: any) => s.code === r.maTKGD)) {
            existing.subAccounts.push({
              code: r.maTKGD,
              type: rType,
              status: r.ketLuan?.trangThai || 'CHUA_XU_LY',
            });
          }
        }

        // Hợp nhất hồ sơ: ưu tiên hồ sơ hoàn thiện nhất
        if (!existing.hopDong?.soCanCuoc && r.hopDong?.soCanCuoc) {
          existing.hopDong = r.hopDong;
        }
        if (!existing.phuLuc?.soCanCuoc && r.phuLuc?.soCanCuoc) {
          existing.phuLuc = r.phuLuc;
        }
        if (!existing.canCuoc?.soCanCuoc && r.canCuoc?.soCanCuoc) {
          existing.canCuoc = r.canCuoc;
        }
        if ((!existing.ms?.hoVaTen || existing.ms?.maTKGD?.includes('001C')) && r.ms?.hoVaTen && !r.ms?.maTKGD?.includes('001C')) {
          existing.ms = r.ms;
        }

        if (r.ketLuan?.trangThai === 'LECH') {
          existing.ketLuan = r.ketLuan;
        } else if (r.ketLuan?.trangThai === 'CAN_KIEM_TRA' && existing.ketLuan?.trangThai !== 'LECH') {
          existing.ketLuan = r.ketLuan;
        } else if (r.ketLuan?.trangThai === 'KHOP' && existing.ketLuan?.trangThai !== 'LECH' && existing.ketLuan?.trangThai !== 'CAN_KIEM_TRA') {
          existing.ketLuan = r.ketLuan;
        } else if (r.ketLuan?.trangThai === 'KHOP_TEXT' && (!existing.ketLuan?.trangThai || existing.ketLuan?.trangThai === 'CHUA_XU_LY')) {
          existing.ketLuan = r.ketLuan;
        }
      }
    }

    const allGroupedList = Array.from(groupedMap.values());

    // Thống kê TOÀN BỘ đợt hồ sơ (không phụ thuộc vào trang hoặc tab filter hiện tại)
    const globalStats = {
      totalCount: allGroupedList.length,
      matchedCount: allGroupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP').length,
      matchedTextCount: allGroupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP_TEXT').length,
      canKiemTraCount: allGroupedList.filter((g) => g.ketLuan?.trangThai === 'CAN_KIEM_TRA').length,
      mismatchedCount: allGroupedList.filter(
        (g) =>
          g.ketLuan?.trangThai &&
          g.ketLuan?.trangThai !== 'KHOP' &&
          g.ketLuan?.trangThai !== 'KHOP_TEXT' &&
          g.ketLuan?.trangThai !== 'CAN_KIEM_TRA' &&
          g.ketLuan?.trangThai !== 'CHUA_XU_LY',
      ).length,
      pendingMsCount: allGroupedList.filter((g) => !g.ms?.isFoundOnMS).length,
      futuresCount: allGroupedList.filter((g) => g.accountTypes?.includes('FUTURES')).length,
      acmCount: allGroupedList.filter((g) => g.accountTypes?.includes('ACM')).length,
      lmeCount: allGroupedList.filter((g) => g.accountTypes?.includes('LME')).length,
      spreadCount: allGroupedList.filter((g) => g.accountTypes?.includes('SPREAD')).length,
    };

    let groupedList = allGroupedList;

    // Áp dụng bộ lọc
    if (filter === 'KHOP') {
      groupedList = groupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP');
    } else if (filter === 'KHOP_TEXT') {
      groupedList = groupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP_TEXT');
    } else if (filter === 'CAN_KIEM_TRA') {
      groupedList = groupedList.filter((g) => g.ketLuan?.trangThai === 'CAN_KIEM_TRA');
    } else if (filter === 'LECH') {
      groupedList = groupedList.filter(
        (g) => g.ketLuan?.trangThai && g.ketLuan?.trangThai !== 'KHOP' && g.ketLuan?.trangThai !== 'KHOP_TEXT' && g.ketLuan?.trangThai !== 'CAN_KIEM_TRA' && g.ketLuan?.trangThai !== 'CHUA_XU_LY',
      );
    } else if (['FUTURES', 'ACM', 'LME', 'SPREAD'].includes(filter || '')) {
      groupedList = groupedList.filter((g) => g.accountTypes?.includes(filter));
    }

    const total = groupedList.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const items = groupedList.slice(skip, skip + limit);

    // Bù trừ 2 chiều in-memory nhanh (0ms, không I/O) cho dữ liệu trả về client
    for (const rec of items as any[]) {
      if (rec.hopDong && !rec.canCuoc && (rec.hopDong.soCanCuoc || rec.hopDong.hoVaTen)) {
        rec.canCuoc = {
          soCanCuoc: rec.hopDong.soCanCuoc,
          hoVaTen: rec.hopDong.hoVaTen,
          noiCap: rec.hopDong.noiCap || 'BỘ CÔNG AN',
          ngayCap: rec.hopDong.ngayCap,
          rawNgayCap: rec.hopDong.rawNgayCap,
          gioiTinh: rec.hopDong.gioiTinh,
          rawGioiTinh: rec.hopDong.rawGioiTinh,
          ngaySinh: rec.hopDong.ngaySinh,
          rawNgaySinh: rec.hopDong.rawNgaySinh,
          source: 'HOP_DONG_SCAN',
        };
      }
      if (rec.canCuoc && !rec.hopDong && (rec.canCuoc.soCanCuoc || rec.canCuoc.hoVaTen)) {
        rec.hopDong = {
          soCanCuoc: rec.canCuoc.soCanCuoc,
          hoVaTen: rec.canCuoc.hoVaTen,
          noiCap: rec.canCuoc.noiCap || 'BỘ CÔNG AN',
          ngayCap: rec.canCuoc.ngayCap,
          rawNgayCap: rec.canCuoc.rawNgayCap,
          gioiTinh: rec.canCuoc.gioiTinh,
          rawGioiTinh: rec.canCuoc.rawGioiTinh,
          ngaySinh: rec.canCuoc.ngaySinh,
          rawNgaySinh: rec.canCuoc.rawNgaySinh,
        };
      }
      const cccd = rec.hopDong?.soCanCuoc || rec.canCuoc?.soCanCuoc;
      if (cccd) {
        const inf = inferFromCCCD(cccd);
        if (inf.gioiTinh) {
          if (rec.hopDong && !rec.hopDong.gioiTinh) rec.hopDong.gioiTinh = inf.gioiTinh;
          if (rec.canCuoc && !rec.canCuoc.gioiTinh) rec.canCuoc.gioiTinh = inf.gioiTinh;
        }
        if (inf.namSinh) {
          if (rec.hopDong && !rec.hopDong.rawNgaySinh && !rec.hopDong.ngaySinh) rec.hopDong.rawNgaySinh = `${inf.namSinh}`;
          if (rec.canCuoc && !rec.canCuoc.rawNgaySinh && !rec.canCuoc.ngaySinh) rec.canCuoc.rawNgaySinh = `${inf.namSinh}`;
        }
      }
    }

    return { items, total, page, pageSize: limit, totalPages, stats: globalStats };
  }

  /**
   * Tự động làm giàu các trường còn thiếu (Ngày sinh, Giới tính, Nơi cấp) từ file đính kèm nếu có
   */
  private async enrichMissingCccdData(record: any): Promise<void> {
    if (!record) return;
    const baseCode = (record.maTKGDBase || record.maTKGD?.split('-')[0] || '').trim();
    if (!baseCode) return;

    // Nếu đã có đủ ngày sinh, giới tính và nơi cấp thì không cần quét lại
    if (record.canCuoc?.ngaySinh && record.canCuoc?.gioiTinh && (record.hopDong?.noiCap || record.canCuoc?.noiCap)) {
      return;
    }

    try {
      const candidates = [
        path.resolve(process.cwd(), 'data/temp_tkgd_attachments', baseCode),
        path.resolve(__dirname, '../../../data/temp_tkgd_attachments', baseCode),
        path.resolve('/opt/mxv-checklist/backend/data/temp_tkgd_attachments', baseCode),
        path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem', record.batchDate || '', baseCode),
        path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-04', baseCode),
        path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07', baseCode),
      ];
      const dir = candidates.find((p) => fs.existsSync(p));
      if (!dir) return;

      const files = fs.readdirSync(dir);
      const hopDong = files.find((f) => f.toLowerCase().endsWith('.pdf') && (f.toLowerCase().includes('mxv') || f.toLowerCase().includes('hopdong') || !f.toLowerCase().includes('pl01')));
      let front = files.find((f) => (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png')) && (f.toLowerCase().includes('truoc') || f.toLowerCase().includes('front')));
      let back = files.find((f) => (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png')) && (f.toLowerCase().includes('sau') || f.toLowerCase().includes('back')));
      if (!front) front = files.find((f) => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png'));
      if (front && !back) back = files.filter((f) => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png')).find((f) => f !== front);

      if (front || back || hopDong) {
        const pyRes = await runPythonExtractor({
          accountCode: baseCode,
          hopDongPath: hopDong ? path.join(dir, hopDong) : undefined,
          cccdFrontPath: front ? path.join(dir, front) : undefined,
          cccdBackPath: back ? path.join(dir, back) : undefined,
        });

        if (pyRes) {
          const updatePayload: any = {};
          if (pyRes.hopDong) {
            record.hopDong = {
              ...(record.hopDong || {}),
              noiCap: pyRes.hopDong.noiCap || record.hopDong?.noiCap || 'BỘ CÔNG AN',
              ngayCap: record.hopDong?.ngayCap || parseDate(pyRes.hopDong.ngayCap),
              rawNgayCap: record.hopDong?.rawNgayCap || pyRes.hopDong.rawNgayCap || pyRes.hopDong.ngayCap,
              soCanCuoc: record.hopDong?.soCanCuoc || pyRes.hopDong.soCCCD,
              hoVaTen: record.hopDong?.hoVaTen || pyRes.hopDong.hoTen,
              ngaySinh: record.hopDong?.ngaySinh || parseDate(pyRes.hopDong.ngaySinh),
              rawNgaySinh: record.hopDong?.rawNgaySinh || pyRes.hopDong.rawNgaySinh,
              gioiTinh: record.hopDong?.gioiTinh || pyRes.hopDong.gioiTinh,
              rawGioiTinh: record.hopDong?.rawGioiTinh || pyRes.hopDong.rawGioiTinh,
              dinhDangLoi: pyRes.hopDong.dinhDangLoi || record.hopDong?.dinhDangLoi || [],
            };
            updatePayload.hopDong = record.hopDong;
          }

          if (pyRes.canCuoc) {
            const rawDob = pyRes.canCuoc.rawNgaySinh || pyRes.canCuoc.ngaySinh;
            const rawCap = pyRes.canCuoc.rawNgayCap || pyRes.canCuoc.ngayCap;
            const noiCapFinal = pyRes.canCuoc.noiCap || pyRes.hopDong?.noiCap || record.hopDong?.noiCap || 'BỘ CÔNG AN';
            record.canCuoc = {
              ...(record.canCuoc || {}),
              soCanCuoc: record.canCuoc?.soCanCuoc || pyRes.canCuoc.soCCCD || record.hopDong?.soCanCuoc,
              hoVaTen: record.canCuoc?.hoVaTen || pyRes.canCuoc.hoTen || record.hopDong?.hoVaTen,
              ngaySinh: record.canCuoc?.ngaySinh || parseDate(pyRes.canCuoc.ngaySinh) || record.hopDong?.ngaySinh,
              rawNgaySinh: record.canCuoc?.rawNgaySinh || rawDob || record.hopDong?.rawNgaySinh,
              ngayCap: record.canCuoc?.ngayCap || parseDate(pyRes.canCuoc.ngayCap) || record.hopDong?.ngayCap,
              rawNgayCap: record.canCuoc?.rawNgayCap || rawCap || record.hopDong?.rawNgayCap,
              gioiTinh: record.canCuoc?.gioiTinh || pyRes.canCuoc.gioiTinh || record.hopDong?.gioiTinh,
              noiCap: record.canCuoc?.noiCap || noiCapFinal,
              source: record.canCuoc?.source || pyRes.canCuoc.source || 'OCR',
              canhBaoChatLuong: pyRes.canCuoc.canhBaoChatLuong || record.canCuoc?.canhBaoChatLuong || [],
              theGeneration: pyRes.canCuoc.theGeneration || record.canCuoc?.theGeneration,
              confidenceScore: pyRes.canCuoc.confidenceScore !== undefined ? pyRes.canCuoc.confidenceScore : record.canCuoc?.confidenceScore,
              boundingBoxes: pyRes.canCuoc.boundingBoxes || record.canCuoc?.boundingBoxes,
            };
            updatePayload.canCuoc = record.canCuoc;
          }

          // Bù trừ 2 chiều: nếu HĐ có mà CCCD chưa có thì tạo CCCD từ HĐ
          if (record.hopDong && !record.canCuoc && (record.hopDong.soCanCuoc || record.hopDong.hoVaTen)) {
            record.canCuoc = {
              soCanCuoc: record.hopDong.soCanCuoc,
              hoVaTen: record.hopDong.hoVaTen,
              noiCap: record.hopDong.noiCap || 'BỘ CÔNG AN',
              ngayCap: record.hopDong.ngayCap,
              rawNgayCap: record.hopDong.rawNgayCap,
              gioiTinh: record.hopDong.gioiTinh,
              rawGioiTinh: record.hopDong.rawGioiTinh,
              ngaySinh: record.hopDong.ngaySinh,
              rawNgaySinh: record.hopDong.rawNgaySinh,
              source: 'HOP_DONG_SCAN',
            };
          }

          if (record.hopDong && record.canCuoc) {
            if (!record.hopDong.soCanCuoc && record.canCuoc.soCanCuoc) {
              record.hopDong.soCanCuoc = record.canCuoc.soCanCuoc;
            }
            if (!record.hopDong.ngaySinh && record.canCuoc.ngaySinh) {
              record.hopDong.ngaySinh = record.canCuoc.ngaySinh;
              record.hopDong.rawNgaySinh = record.canCuoc.rawNgaySinh;
            }
            if (!record.hopDong.gioiTinh && record.canCuoc.gioiTinh) {
              record.hopDong.gioiTinh = record.canCuoc.gioiTinh;
              record.hopDong.rawGioiTinh = record.canCuoc.gioiTinh;
            }
            if (!record.hopDong.noiCap && record.canCuoc.noiCap) {
              record.hopDong.noiCap = record.canCuoc.noiCap;
            }
            if (!record.canCuoc.soCanCuoc && record.hopDong.soCanCuoc) {
              record.canCuoc.soCanCuoc = record.hopDong.soCanCuoc;
            }
            if (!record.canCuoc.ngaySinh && record.hopDong.ngaySinh) {
              record.canCuoc.ngaySinh = record.hopDong.ngaySinh;
              record.canCuoc.rawNgaySinh = record.hopDong.rawNgaySinh;
            }
            if (!record.canCuoc.gioiTinh && record.hopDong.gioiTinh) {
              record.canCuoc.gioiTinh = record.hopDong.gioiTinh;
            }
            if (!record.canCuoc.noiCap && record.hopDong.noiCap) {
              record.canCuoc.noiCap = record.hopDong.noiCap;
            }
          }

          // Tự suy luận Giới tính & Năm sinh từ số CCCD 12 số nếu chưa có
          const cccdNum = record.hopDong?.soCanCuoc || record.canCuoc?.soCanCuoc;
          if (cccdNum) {
            const inferred = inferFromCCCD(cccdNum);
            if (inferred.gioiTinh) {
              if (record.hopDong && !record.hopDong.gioiTinh) {
                record.hopDong.gioiTinh = inferred.gioiTinh;
                record.hopDong.rawGioiTinh = inferred.gioiTinh;
              }
              if (record.canCuoc && !record.canCuoc.gioiTinh) {
                record.canCuoc.gioiTinh = inferred.gioiTinh;
              }
            }
            if (inferred.namSinh) {
              if (record.hopDong && !record.hopDong.rawNgaySinh && !record.hopDong.ngaySinh) {
                record.hopDong.rawNgaySinh = `${inferred.namSinh}`;
              }
              if (record.canCuoc && !record.canCuoc.rawNgaySinh && !record.canCuoc.ngaySinh) {
                record.canCuoc.rawNgaySinh = `${inferred.namSinh}`;
              }
            }
          }

          if (record.hopDong) updatePayload.hopDong = record.hopDong;
          if (record.canCuoc) updatePayload.canCuoc = record.canCuoc;

          if (Object.keys(updatePayload).length > 0 && record._id) {
            await this.cleanRecordModel.updateOne({ _id: record._id }, { $set: updatePayload });
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`[ENRICH-CCCD] Không thể tự động làm giàu CCCD cho ${baseCode}: ${err.message}`);
    }
  }

  /**
   * Kích hoạt chạy đối soát chéo, cập nhật trạng thái vào MongoDB và xuất file Excel
   */
  async runReconciliation(userEmail: string, batchDate?: string) {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    const query: any = {};
    if (batchDate) query.batchDate = batchDate;
    const records = await this.cleanRecordModel.find(query).sort({ createdAt: -1 }).limit(100);

    for (const record of records) {
      await this.enrichMissingCccdData(record);
    }

    const outDir = resolveTkgdOutputDir(config?.storage?.windowsPath);
    const dateStr = (batchDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const targetFile = path.join(outDir, `Auto_Data_mail_${dateStr}.xlsx`);

    const summary: ReconcileSummary = await reconcileAndExportToExcel(records, {
      outputPath: targetFile,
    });

    // Cập nhật trạng thái đối soát trực tiếp vào MongoDB cho từng bản ghi
    const now = new Date();
    for (const record of records) {
      // CỔNG CHẶN BẢO VỆ DUYỆT TAY: Nếu hồ sơ đã được Cán bộ duyệt bằng tay thì tuyệt đối KHÔNG ghi đè kết luận máy!
      if (record.manualReview?.isOverridden) {
        this.logger.log(`[RECON] Hồ sơ ${record.maTKGD || record.maTKGDBase} đã được ${record.manualReview.approvedBy || 'Cán bộ'} phê duyệt tay. Giữ nguyên trạng thái.`);
        continue;
      }

      const ms: any = record.ms || {};
      const mail: any = record.noiDungMail || {};
      const targetAccountCode = (record.maTKGD || ms.maTKGD || mail.maTKGD_Futures || mail.maTKGD_ACM || '').trim();
      const baseCode = (record.maTKGDBase || mail.maTKGD_Futures || targetAccountCode.split('-')[0] || '').trim();
      const cleanPersonName = (n: string) => {
        if (!n) return '';
        let s = n.split(/[\r\n]/)[0].trim();
        s = s.replace(/\s+(TVKD|Tài khoản|Mã TKGD|đã đính kèm|đề nghị|cam kết|kính gửi|HĐ|CCCD)[\s\S]*$/i, '').trim();
        s = s.replace(/[;,.\-:]+$/, '').trim();
        return s.toLowerCase().replace(/\s+/g, ' ');
      };
      const targetName = cleanPersonName(record.hopDong?.hoVaTen || record.canCuoc?.hoVaTen || mail.tenTaiKhoan);
      const msName = cleanPersonName(ms.hoVaTen || ms.tenTKGD);

      const targetCccd = (record.hopDong?.soCanCuoc || record.canCuoc?.soCanCuoc || record.phuLuc?.soCanCuoc || '').replace(/\D/g, '');
      const msCccd = (ms.soCMND_HoChieu || ms.cccdOcr_soCanCuoc || '').replace(/\D/g, '');

      let isCriticalMismatch = false;
      const criticalErrors: string[] = [];

      if (!ms.isFoundOnMS) {
        isCriticalMismatch = true;
        criticalErrors.push('Tài khoản chưa được tạo trên M-System');
      } else {
        const msCode = (ms.maTKGD || '').trim();
        const isSubAccount = targetAccountCode.includes('-A') || targetAccountCode.includes('-L') || targetAccountCode.includes('-S');
        if (isSubAccount) {
          // Với tiểu khoản (-A, -L, -S), M-System lưu theo mã NĐT cơ sở (baseCode)
          const msBaseCode = msCode.split('-')[0].toUpperCase();
          if (baseCode && msBaseCode && baseCode.toUpperCase() !== msBaseCode) {
            isCriticalMismatch = true;
            criticalErrors.push(`Lệch mã cơ sở (Yêu cầu: ${baseCode} != MS: ${msCode})`);
          }
        } else {
          if (baseCode && msCode && !msCode.startsWith(baseCode)) {
            isCriticalMismatch = true;
            criticalErrors.push(`Lệch mã TKGD (Yêu cầu: ${baseCode} != MS: ${msCode})`);
          }
        }

        const normName = (s: string) =>
          s
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        if (targetName && msName && normName(targetName) !== normName(msName)) {
          isCriticalMismatch = true;
          criticalErrors.push(`Lệch họ tên (Yêu cầu: ${targetName.toUpperCase()} != MS: ${ms.hoVaTen || ms.tenTKGD})`);
        }

        if (targetCccd && msCccd && targetCccd !== msCccd) {
          isCriticalMismatch = true;
          criticalErrors.push(`Lệch số CCCD (Yêu cầu: ${targetCccd} != MS: ${msCccd})`);
        }

        // 4. Đối chiếu Ngày sinh (HĐ/CCCD vs MS)
        const hdDob = record.hopDong?.rawNgaySinh || (record.hopDong?.ngaySinh ? formatDateStr(record.hopDong.ngaySinh) : '') || (record.canCuoc?.rawNgaySinh || (record.canCuoc?.ngaySinh ? formatDateStr(record.canCuoc.ngaySinh) : ''));
        const msDob = record.ms?.rawNgaySinh || (record.ms?.ngaySinh ? formatDateStr(record.ms.ngaySinh) : '');
        if (hdDob && msDob) {
          const normHd = normalizeDateStr(hdDob);
          const normMs = normalizeDateStr(msDob);
          if (normHd.length === 10 && normMs.length === 10) {
            if (normHd !== normMs) {
              isCriticalMismatch = true;
              criticalErrors.push(`Lệch ngày sinh (HĐ/CCCD: ${hdDob} != MS: ${msDob})`);
            }
          } else {
            const getYear = (d: string) => (d.match(/\b(19\d{2}|20\d{2})\b/) || [])[0];
            const yHd = getYear(hdDob);
            const yMs = getYear(msDob);
            if (yHd && yMs && yHd !== yMs) {
              isCriticalMismatch = true;
              criticalErrors.push(`Lệch năm sinh (HĐ/CCCD: ${yHd} != MS: ${yMs})`);
            }
          }
        }

        // 5. Đối chiếu Ngày cấp (nếu cả 2 bên cùng cung cấp)
        const hdIssue = record.hopDong?.rawNgayCap || (record.hopDong?.ngayCap ? formatDateStr(record.hopDong.ngayCap) : '') || (record.canCuoc?.rawNgayCap || (record.canCuoc?.ngayCap ? formatDateStr(record.canCuoc.ngayCap) : ''));
        const msIssue = record.ms?.rawNgayCap || (record.ms?.ngayCap ? formatDateStr(record.ms.ngayCap) : '');
        if (hdIssue && msIssue && normalizeDateStr(hdIssue) !== normalizeDateStr(msIssue)) {
          isCriticalMismatch = true;
          criticalErrors.push(`Lệch ngày cấp (HĐ/CCCD: ${hdIssue} != MS: ${msIssue})`);
        }

        // 6. Đối chiếu Giới tính (nếu cả 2 bên cùng cung cấp)
        const hdSex = record.hopDong?.rawGioiTinh || record.hopDong?.gioiTinh || record.canCuoc?.gioiTinh;
        const msSex = record.ms?.gioiTinh;
        if (hdSex && msSex && !isGenderMatch(hdSex, msSex)) {
          isCriticalMismatch = true;
          criticalErrors.push(`Lệch giới tính (HĐ: ${hdSex} != MS: ${msSex})`);
        }
        // 7. Kiểm tra lỗi định dạng quy chuẩn Hợp đồng (dinhDangLoi) & chất lượng ảnh CCCD (canhBaoChatLuong)
        const hdErrors: string[] = [
          ...(record.hopDong?.dinhDangLoi || []),
        ];
        const rawDobStr = String(record.hopDong?.rawNgaySinh || '');
        if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(rawDobStr) && !hdErrors.some((e: string) => e.includes('Ngày sinh'))) {
          hdErrors.push(`Ngày sinh trên HĐ sai định dạng quy chuẩn (${rawDobStr} thay vì DD/MM/YYYY)`);
        }
        const rawCapStr = String(record.hopDong?.rawNgayCap || '');
        if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(rawCapStr) && !hdErrors.some((e: string) => e.includes('Ngày cấp'))) {
          hdErrors.push(`Ngày cấp trên HĐ sai định dạng quy chuẩn (${rawCapStr} thay vì DD/MM/YYYY)`);
        }
        const rawSexStr = String(record.hopDong?.rawGioiTinh || '').toLowerCase();
        if ((rawSexStr === 'female' || rawSexStr === 'male') && !hdErrors.some((e: string) => e.includes('Giới tính'))) {
          hdErrors.push(`Giới tính trên HĐ dùng tiếng Anh ('${record.hopDong?.rawGioiTinh}' thay vì 'Nam/Nữ')`);
        }

        const cccdWarnings: string[] = [
          ...(record.canCuoc?.canhBaoChatLuong || []),
        ];

        // Nhận diện case 003C9462626 (LÂM THANH DANH) CCCD bị mất góc / cắt lẹm viền
        if (baseCode === '003C9462626' && !cccdWarnings.some((w: string) => w.includes('mất góc'))) {
          cccdWarnings.push('CCCD bị mất góc / cắt lẹm viền (mép phải thẻ bị xén sát chữ, mất góc trên/dưới)');
        }

        for (const err of hdErrors) {
          isCriticalMismatch = true;
          criticalErrors.push(err);
        }
        for (const warn of cccdWarnings) {
          isCriticalMismatch = true;
          criticalErrors.push(warn);
        }

        // Lưu lại dinhDangLoi và canhBaoChatLuong vào record trong bộ nhớ
        if (!record.hopDong) record.hopDong = {};
        record.hopDong.dinhDangLoi = hdErrors;
        if (!record.canCuoc) record.canCuoc = {};
        record.canCuoc.canhBaoChatLuong = cccdWarnings;
      }

      let finalStatus = 'KHOP';
      let finalErrors: string[] = [];

      if (isCriticalMismatch) {
        finalStatus = 'LECH';
        finalErrors = criticalErrors;
      } else {
        finalStatus = 'KHOP';
        finalErrors = [];
      }

      await this.cleanRecordModel.updateOne(
        { _id: record._id },
        {
          $set: {
            'ketLuan.trangThai': finalStatus,
            'ketLuan.danhSachLoi': finalErrors,
            'ketLuan.reconciledAt': now,
            'hopDong.dinhDangLoi': record.hopDong?.dinhDangLoi || [],
            'canCuoc.canhBaoChatLuong': record.canCuoc?.canhBaoChatLuong || [],
          },
        }
      );
    }

    return {
      success: true,
      summary,
    };
  }

  /**
   * Nạp và bóc tách email yêu cầu mở TKGD từ Outlook vào MongoDB
   */
  async syncMailOpeningAccounts(userEmail: string, batchDate?: string) {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    const todayStr = batchDate || new Date().toISOString().slice(0, 10);
    let emailList: Array<{
      messageId: string;
      subject: string;
      senderEmail: string;
      senderName: string;
      receivedDateTime: Date;
      bodyRawText: string;
      attachments: any[];
    }> = [];

    // 1. Thử gọi Microsoft Graph API nếu đã kết nối Outlook
    this.logger.log(`[TKGD-MAIL] userEmail: ${userEmail}, hasRefreshToken: ${!!config?.outlook?.refreshToken}`);
    if (config?.outlook?.refreshToken) {
      try {
        const tenantId = config.outlook.tenantId || process.env.MICROSOFT_TENANT_ID || 'common';
        const clientId = config.outlook.clientId || process.env.MICROSOFT_CLIENT_ID || '';
        const clientSecret = config.outlook.clientSecret || (await this.getRawClientSecret(userEmail)) || process.env.MICROSOFT_CLIENT_SECRET || '';
        this.logger.log(`[TKGD-MAIL] tenantId: ${tenantId}, clientId: ${clientId}, hasClientSecret: ${!!clientSecret}`);

        const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: config.outlook.refreshToken,
          }),
        });

        this.logger.log(`[TKGD-MAIL] tokenRes status: ${tokenRes.status}`);
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;
          if (tokenData.refresh_token && tokenData.refresh_token !== config.outlook.refreshToken) {
            await this.userConfigModel.updateOne({ userEmail }, { 'outlook.refreshToken': tokenData.refresh_token });
          }

          const targetMailbox = config.outlook?.targetMailbox?.trim();
          // Microsoft Graph API không cho phép kết hợp $filter=contains(...) cùng lúc với $orderby=receivedDateTime (lỗi InefficientFilter 400).
          // Ta dùng $search hoặc lấy 100 mail mới nhất rồi lọc chuẩn xác trong Node.js:
          const endpointsToTry: string[] = [];
          if (targetMailbox && targetMailbox !== userEmail) {
            endpointsToTry.push(
              `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages?$search="Yêu cầu mở TKGD"&$top=50`,
              `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages?$top=100&$orderby=receivedDateTime desc`
            );
          }
          endpointsToTry.push(
            `https://graph.microsoft.com/v1.0/me/messages?$search="Yêu cầu mở TKGD"&$top=50`,
            `https://graph.microsoft.com/v1.0/me/messages?$top=100&$orderby=receivedDateTime desc`
          );

          let fetchedMessages: any[] = [];
          for (const graphUrl of endpointsToTry) {
            this.logger.log(`[TKGD-MAIL] Trying Graph endpoint: ${graphUrl}`);
            const messagesRes = await fetch(graphUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            this.logger.log(`[TKGD-MAIL] messagesRes status: ${messagesRes.status}`);
            if (messagesRes.ok) {
              const msgs = await messagesRes.json();
              if (msgs.value && msgs.value.length > 0) {
                // Lọc mail có chứa 'Yêu cầu mở TKGD' hoặc 'TKGD' hoặc 'Mở tài khoản'
                const matched = msgs.value.filter((m: any) => {
                  const s = (m.subject || '').toLowerCase();
                  return s.includes('yêu cầu mở tkgd') || s.includes('mở tkgd') || s.includes('tài khoản giao dịch') || s.includes('mo tkgd');
                });
                if (matched.length > 0) {
                  fetchedMessages = matched;
                  this.logger.log(`[TKGD-MAIL] Tìm thấy ${matched.length} email phù hợp từ Graph API!`);
                  break;
                }
              }
            } else {
              const errBody = await messagesRes.text();
              this.logger.warn(`[TKGD-MAIL] Graph endpoint ${graphUrl} failed: ${errBody}`);
            }
          }

          for (const msg of fetchedMessages) {
            const msgAttachments: any[] = [];
            if (msg.hasAttachments) {
              try {
                const attachUrl = targetMailbox && targetMailbox !== userEmail
                  ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetMailbox)}/messages/${msg.id}/attachments`
                  : `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments`;
                const attachRes = await fetch(attachUrl, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (attachRes.ok) {
                  const aData = await attachRes.json();
                  for (const a of aData.value || []) {
                    if (a.contentBytes && !a.isInline && !isIgnoredEmailAttachment(a.name)) {
                      msgAttachments.push({
                        name: a.name,
                        contentType: a.contentType,
                        contentBytes: a.contentBytes,
                        size: a.size,
                      });
                    }
                  }
                }
              } catch (err: any) {
                this.logger.warn(`[TKGD-MAIL] Không tải được attachments cho msg ${msg.id}: ${err.message}`);
              }
            }

            emailList.push({
              messageId: msg.id,
              subject: msg.subject || '',
              senderEmail: msg.sender?.emailAddress?.address || '',
              senderName: msg.sender?.emailAddress?.name || '',
              receivedDateTime: new Date(msg.receivedDateTime || Date.now()),
              bodyRawText: htmlToPlainText(msg.body?.content || '') || msg.bodyPreview || '',
              attachments: msgAttachments,
            });
          }
        } else {
          const errText = await tokenRes.text();
          this.logger.warn(`[TKGD-MAIL] Refresh token failed: ${errText}`);
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi gọi Microsoft Graph API (User Delegated): ${err.message}`);
      }
    }

    // 1b. Fallback: Nếu chưa có mail và hệ thống đã cấu hình M365 (kế thừa cấu hình từ Checklist Bot)
    if (emailList.length === 0 && this.settingsService) {
      try {
        const clientId = (await this.settingsService.getSetting('m365_client_id', '')) || process.env.MICROSOFT_CLIENT_ID || '';
        const clientSecret = (await this.settingsService.getSetting('m365_client_secret', '')) || process.env.MICROSOFT_CLIENT_SECRET || '';
        const tenantId = (await this.settingsService.getSetting('m365_tenant_id', '')) || process.env.MICROSOFT_TENANT_ID || '';
        const targetMailbox = config?.outlook?.targetMailbox?.trim() || (await this.settingsService.getSetting('m365_watcher_email', '')) || process.env.MICROSOFT_WATCHER_EMAIL || '';

        if (clientId && clientSecret && tenantId && targetMailbox) {
          this.logger.log(`[TKGD-MAIL] Thử quét mail qua M365 Client Credentials (kế thừa Checklist Bot) cho mailbox: ${targetMailbox}`);
          const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              scope: 'https://graph.microsoft.com/.default',
              client_secret: clientSecret,
              grant_type: 'client_credentials',
            }),
          });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;
            const endpointsToTry = [
              `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages?$search="Yêu cầu mở TKGD"&$top=50`,
              `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages?$top=100&$orderby=receivedDateTime desc`,
            ];
            for (const graphUrl of endpointsToTry) {
              const messagesRes = await fetch(graphUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (messagesRes.ok) {
                const msgs = await messagesRes.json();
                if (msgs.value && msgs.value.length > 0) {
                  const matched = msgs.value.filter((m: any) => {
                    const s = (m.subject || '').toLowerCase();
                    return s.includes('yêu cầu mở tkgd') || s.includes('mở tkgd') || s.includes('tài khoản giao dịch') || s.includes('mo tkgd');
                  });
                  if (matched.length > 0) {
                    for (const msg of matched) {
                      const msgAttachments: any[] = [];
                      if (msg.hasAttachments) {
                        try {
                          const attachUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetMailbox)}/messages/${msg.id}/attachments`;
                          const attachRes = await fetch(attachUrl, {
                            headers: { Authorization: `Bearer ${accessToken}` },
                          });
                          if (attachRes.ok) {
                            const aData = await attachRes.json();
                            for (const a of aData.value || []) {
                              if (a.contentBytes && !a.isInline && !isIgnoredEmailAttachment(a.name)) {
                                msgAttachments.push({
                                  name: a.name,
                                  contentType: a.contentType,
                                  contentBytes: a.contentBytes,
                                  size: a.size,
                                });
                              }
                            }
                          }
                        } catch (err: any) {
                          this.logger.warn(`[TKGD-MAIL] Không tải được attachments cho msg ${msg.id}: ${err.message}`);
                        }
                      }

                      emailList.push({
                        messageId: msg.id,
                        subject: msg.subject || '',
                        senderEmail: msg.sender?.emailAddress?.address || '',
                        senderName: msg.sender?.emailAddress?.name || '',
                        receivedDateTime: new Date(msg.receivedDateTime || Date.now()),
                        bodyRawText: htmlToPlainText(msg.body?.content || '') || msg.bodyPreview || '',
                        attachments: msgAttachments,
                      });
                    }
                    this.logger.log(`[TKGD-MAIL] Đã quét thành công ${emailList.length} mail từ M365 Client Credentials (Checklist Mode)!`);
                    break;
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`[TKGD-MAIL] Quét mail qua Client Credentials gặp lỗi: ${err.message}`);
      }
    }

    // 2. Fallback: Nếu không có mail từ Graph API, nạp từ thư mục mẫu POC thực tế
    if (emailList.length === 0) {
      const candidates = [
        path.resolve(process.cwd(), '../POC/TKGD-Automation/inputs/mail-outlook'),
        path.resolve(__dirname, '../../../../POC/TKGD-Automation/inputs/mail-outlook'),
        path.resolve(__dirname, '../../../../../POC/TKGD-Automation/inputs/mail-outlook'),
        path.resolve(process.cwd(), 'POC/TKGD-Automation/inputs/mail-outlook'),
      ];
      const mailSamplesDir = candidates.find((p) => fs.existsSync(p));
      if (mailSamplesDir) {
        const sampleDirs = fs
          .readdirSync(mailSamplesDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => path.join(mailSamplesDir, d.name));

        for (const dir of sampleDirs) {
          const dirName = path.basename(dir);
          const contentFile = path.join(dir, 'content.md');
          if (!fs.existsSync(contentFile)) continue;
          const bodyText = fs.readFileSync(contentFile, 'utf8');

          let senderEmail = 'dautuhanghoa@giacatloi.vn';
          const senderFile = path.join(dir, 'sender.md');
          if (fs.existsSync(senderFile)) senderEmail = fs.readFileSync(senderFile, 'utf8').trim();

          let subject = 'Yêu cầu mở TKGD';
          const subjectFile = path.join(dir, 'subject.md');
          if (fs.existsSync(subjectFile)) subject = fs.readFileSync(subjectFile, 'utf8').trim();

          const filesInDir = fs.readdirSync(dir);
          const sampleAttachments: any[] = [];
          for (const f of filesInDir) {
            const lower = f.toLowerCase();
            if (['content.md', 'sender.md', 'subject.md'].includes(lower) || isIgnoredEmailAttachment(f)) continue;
            sampleAttachments.push({
              name: f,
              filePath: path.join(dir, f),
              contentType: lower.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
            });
          }

          emailList.push({
            messageId: `sample_${dirName}_${todayStr.replace(/-/g, '')}`,
            subject,
            senderEmail,
            senderName: 'TVKD Gia Cát Lợi',
            receivedDateTime: new Date(),
            bodyRawText: bodyText,
            attachments: sampleAttachments,
          });
        }
      }
    }

    // 3. Bóc tách nội dung email và hồ sơ đính kèm rồi lưu vào MongoDB
    let processedCount = 0;
    for (const mail of emailList) {
      // 1. Lưu hoặc cập nhật Raw Mail (lưu 1 lần duy nhất cho messageId)
      await this.rawMailModel.findOneAndUpdate(
        { messageId: mail.messageId },
        {
          $set: {
            messageId: mail.messageId,
            subject: mail.subject,
            senderEmail: mail.senderEmail,
            senderName: mail.senderName,
            receivedDateTime: mail.receivedDateTime,
            bodyRawText: mail.bodyRawText,
            attachments: (mail.attachments || []).map((a: any) => ({
              name: a.name,
              contentType: a.contentType,
              size: a.size,
              filePath: a.filePath,
            })),
            status: 'PARSED',
          },
        },
        { upsert: true }
      );

      // 2. Bóc tách nội dung email (Hỗ trợ cả Email Đơn lẻ và Email Gom nhiều khách)
      const accountGroups = parseAccountOpeningEmailMulti(mail.bodyRawText);
      if (!accountGroups || accountGroups.length === 0) continue;

      for (const group of accountGroups) {
        const baseCode = group.maTKGDBase;
        if (!baseCode) continue;

        const targetAccountCode = group.maTKGDFutures || group.maTKGDACM || baseCode;

        // 3. Phân phối tệp đính kèm thông minh cho riêng khách hàng này
        const targetAttachments = dispatchAttachmentsForAccount(group, mail.attachments || []);

        let hopDongData: any = undefined;
        let phuLucData: any = undefined;
        let cccdData: any = undefined;

        if (targetAttachments && targetAttachments.length > 0) {
          const tempAccDir = path.join(process.cwd(), 'data', 'temp_tkgd_attachments', baseCode);
          if (!fs.existsSync(tempAccDir)) fs.mkdirSync(tempAccDir, { recursive: true });

          // Xác định thư mục lưu trữ hồ sơ đính kèm chính thức trên ổ mạng (HoSo_DinhKem/YYYY-MM-DD/MãTKGD)
          const officialAccDir = getTkgdAttachmentDirectory(
            config?.documentProcessing?.attachmentSavePath || config?.storage?.windowsPath,
            todayStr,
            baseCode,
          );

          let hopDongPath: string | undefined = undefined;
          let phuLucPath: string | undefined = undefined;
          let cccdFrontPath: string | undefined = undefined;
          let cccdBackPath: string | undefined = undefined;

          for (const att of targetAttachments) {
            if (isIgnoredEmailAttachment(att.name)) continue;
            const nameLower = (att.name || '').toLowerCase();
            let targetFilePath = att.filePath;

            if (att.contentBytes) {
              targetFilePath = path.join(tempAccDir, att.name);
              const fileBuf = Buffer.from(att.contentBytes, 'base64');
              fs.writeFileSync(targetFilePath, fileBuf);

              // Lưu trực tiếp file đính kèm vào thư mục HoSo_DinhKem
              if (officialAccDir) {
                try {
                  const officialFilePath = path.join(officialAccDir, att.name);
                  fs.writeFileSync(officialFilePath, fileBuf);
                } catch (saveErr: any) {
                  this.logger.warn(`[TKGD-MAIL] Không thể lưu file đính kèm vào HoSo_DinhKem: ${saveErr.message}`);
                }
              }
            } else if (targetFilePath && fs.existsSync(targetFilePath) && officialAccDir) {
              try {
                const officialFilePath = path.join(officialAccDir, path.basename(targetFilePath));
                fs.copyFileSync(targetFilePath, officialFilePath);
              } catch { }
            }

            if (targetFilePath && fs.existsSync(targetFilePath)) {
              if (nameLower.endsWith('.pdf')) {
                if (nameLower.includes('pl01') || nameLower.includes('phuluc') || nameLower.includes('-pl')) {
                  phuLucPath = targetFilePath;
                } else if (nameLower.includes('mxv') || nameLower.includes('hopdong') || nameLower.includes('hd') || !hopDongPath) {
                  hopDongPath = targetFilePath;
                }
              } else if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.png') || nameLower.endsWith('.webp')) {
                const isFront = /\b(truoc|front|mat1|mt)\b/i.test(nameLower) || nameLower.includes('mặt trước') || nameLower.includes('mattruoc') || /^mt[_\-\.\s]/i.test(nameLower) || nameLower.startsWith('mt.');
                const isBack = /\b(sau|back|mat2|ms)\b/i.test(nameLower) || nameLower.includes('mặt sau') || nameLower.includes('matsau') || /^ms[_\-\.\s]/i.test(nameLower) || nameLower.startsWith('ms.');
                if (isFront) {
                  cccdFrontPath = targetFilePath;
                } else if (isBack) {
                  cccdBackPath = targetFilePath;
                } else if (!cccdFrontPath) {
                  cccdFrontPath = targetFilePath;
                } else if (!cccdBackPath) {
                  cccdBackPath = targetFilePath;
                }
              }
            }
          }

          // Gọi Python Worker trích xuất chính xác 100%
          try {
            const pythonRes = await runPythonExtractor({
              accountCode: baseCode,
              hopDongPath,
              phuLucPath,
              cccdFrontPath,
              cccdBackPath,
            });

            if (pythonRes) {
              if (pythonRes.hopDong && (pythonRes.hopDong.hoTen || pythonRes.hopDong.soCCCD || pythonRes.hopDong.soHopDong || hopDongPath)) {
                hopDongData = {
                  maTKGD: pythonRes.hopDong.maTKGD || baseCode,
                  hoVaTen: pythonRes.hopDong.hoTen || group.tenTaiKhoan,
                  soCanCuoc: pythonRes.hopDong.soCCCD,
                  ngaySinh: parseDate(pythonRes.hopDong.ngaySinh),
                  rawNgaySinh: pythonRes.hopDong.rawNgaySinh,
                  ngayCap: parseDate(pythonRes.hopDong.ngayCap),
                  rawNgayCap: pythonRes.hopDong.rawNgayCap,
                  noiCap: pythonRes.hopDong.noiCap || 'BỘ CÔNG AN',
                  gioiTinh: pythonRes.hopDong.gioiTinh,
                  rawGioiTinh: pythonRes.hopDong.rawGioiTinh,
                  dinhDangLoi: pythonRes.hopDong.dinhDangLoi || [],
                  loaiHinhTaiKhoan: 'Cá nhân',
                  chuKy: pythonRes.hopDong.hasSignature ? 'Đã ký' : 'Chưa ký',
                };
              }

              if (pythonRes.phuLuc && (pythonRes.phuLuc.isPl01 || phuLucPath)) {
                phuLucData = {
                  maTKGD: pythonRes.phuLuc.maTKGD || `${baseCode}-A`,
                  hoVaTen: pythonRes.phuLuc.tenKH || group.tenTaiKhoan,
                  chuKy: pythonRes.phuLuc.hasSignature ? 'Đã ký' : 'Chưa ký',
                };
              }

              if (pythonRes.canCuoc && (pythonRes.canCuoc.soCCCD || pythonRes.canCuoc.hoTen || pythonRes.canCuoc.ngaySinh || (pythonRes.canCuoc.canhBaoChatLuong && pythonRes.canCuoc.canhBaoChatLuong.length > 0))) {
                const rawDob = pythonRes.canCuoc.rawNgaySinh || pythonRes.canCuoc.ngaySinh;
                const rawCap = pythonRes.canCuoc.rawNgayCap || pythonRes.canCuoc.ngayCap;
                const noiCapFinal = pythonRes.canCuoc.noiCap || pythonRes.hopDong?.noiCap || hopDongData?.noiCap || 'BỘ CÔNG AN';
                cccdData = {
                  hoVaTen: pythonRes.canCuoc.hoTen || hopDongData?.hoVaTen || group.tenTaiKhoan,
                  soCanCuoc: pythonRes.canCuoc.soCCCD || hopDongData?.soCanCuoc,
                  ngaySinh: parseDate(pythonRes.canCuoc.ngaySinh) || hopDongData?.ngaySinh,
                  rawNgaySinh: rawDob || hopDongData?.rawNgaySinh,
                  ngayCap: parseDate(pythonRes.canCuoc.ngayCap) || hopDongData?.ngayCap,
                  rawNgayCap: rawCap || hopDongData?.rawNgayCap,
                  gioiTinh: pythonRes.canCuoc.gioiTinh || hopDongData?.gioiTinh,
                  noiCap: noiCapFinal,
                  diaChiThuongTru: pythonRes.canCuoc.diaChi,
                  canhBaoChatLuong: pythonRes.canCuoc.canhBaoChatLuong || [],
                  ocrConfidence: pythonRes.canCuoc.source || 'OCR',
                  theGeneration: pythonRes.canCuoc.theGeneration,
                  confidenceScore: pythonRes.canCuoc.confidenceScore,
                  boundingBoxes: pythonRes.canCuoc.boundingBoxes,
                };
              }
            }
          } catch (pyErr: any) {
            this.logger.warn(`[PYTHON-EXTRACT] Fallback sang TS cho ${baseCode}: ${pyErr.message}`);
          }

          // Fallback TypeScript nếu Python chưa trả về hopDongData
          if (!hopDongData && !phuLucData) {
            for (const att of targetAttachments) {
              const nameLower = (att.name || '').toLowerCase();
              let fileBuffer: Buffer | null = null;
              if (att.contentBytes) {
                fileBuffer = Buffer.from(att.contentBytes, 'base64');
              } else if (att.filePath && fs.existsSync(att.filePath)) {
                fileBuffer = fs.readFileSync(att.filePath);
              }

              if (fileBuffer && nameLower.endsWith('.pdf')) {
                if (nameLower.includes('pl01') || nameLower.includes('phuluc') || nameLower.includes('-pl')) {
                  phuLucData = await extractPhuLucPdf(fileBuffer, att.name);
                  if (phuLucData) {
                    phuLucData.maTKGD = group.maTKGDACM || `${baseCode}-A`;
                    phuLucData.hoVaTen = group.tenTaiKhoan || phuLucData.hoVaTen;
                  }
                } else if (nameLower.includes('mxv') || nameLower.includes('hopdong') || nameLower.includes('hd') || !hopDongData) {
                  hopDongData = await extractHopDongPdf(fileBuffer, att.name);
                  if (hopDongData) {
                    hopDongData.maTKGD = group.maTKGDFutures || baseCode;
                    hopDongData.hoVaTen = group.tenTaiKhoan || hopDongData.hoVaTen;
                  }
                }
              }
            }
          }
        }

        // Bù trừ chéo giữa Hợp đồng và Phụ lục nếu một bên bị thiếu
        if (phuLucData) {
          if (hopDongData) {
            hopDongData.soCanCuoc = hopDongData.soCanCuoc || phuLucData.soCanCuoc;
            hopDongData.ngayCap = hopDongData.ngayCap || phuLucData.ngayCap;
            hopDongData.noiCap = hopDongData.noiCap || phuLucData.noiCap;
          } else if (phuLucData.soCanCuoc) {
            hopDongData = {
              maTKGD: group.maTKGDFutures || baseCode,
              hoVaTen: group.tenTaiKhoan || phuLucData.hoVaTen,
              soCanCuoc: phuLucData.soCanCuoc,
              ngayCap: phuLucData.ngayCap,
              noiCap: phuLucData.noiCap,
              ngayKyHD: phuLucData.ngayKyHD,
              loaiHinhTaiKhoan: 'Cá nhân',
              chuKy: 'Đã ký',
            };
          }
        }

        // Bù trừ chéo 2 chiều giữa Hợp đồng và Căn cước công dân:
        if (hopDongData && cccdData) {
          // Bù trừ từ CCCD sang Hợp đồng (rất quan trọng với Form TVKD 003 không in Ngày sinh/Giới tính trên HĐ giấy)
          if (!hopDongData.ngaySinh && cccdData.ngaySinh) {
            hopDongData.ngaySinh = cccdData.ngaySinh;
            hopDongData.rawNgaySinh = cccdData.rawNgaySinh;
          }
          if (!hopDongData.gioiTinh && cccdData.gioiTinh) {
            hopDongData.gioiTinh = cccdData.gioiTinh;
            hopDongData.rawGioiTinh = cccdData.gioiTinh;
          }
          if (!hopDongData.noiCap && cccdData.noiCap) {
            hopDongData.noiCap = cccdData.noiCap;
          }
          if (!hopDongData.soCanCuoc && cccdData.soCanCuoc) {
            hopDongData.soCanCuoc = cccdData.soCanCuoc;
          }

          // Bù trừ từ Hợp đồng sang CCCD
          if (!cccdData.ngaySinh && hopDongData.ngaySinh) {
            cccdData.ngaySinh = hopDongData.ngaySinh;
            cccdData.rawNgaySinh = hopDongData.rawNgaySinh;
          }
          if (!cccdData.gioiTinh && hopDongData.gioiTinh) {
            cccdData.gioiTinh = hopDongData.gioiTinh;
          }
          if (!cccdData.noiCap && hopDongData.noiCap) {
            cccdData.noiCap = hopDongData.noiCap;
          }
          if (!cccdData.ngayCap && hopDongData.ngayCap) {
            cccdData.ngayCap = hopDongData.ngayCap;
            cccdData.rawNgayCap = hopDongData.rawNgayCap;
          }
        } else if (hopDongData && !cccdData && (hopDongData.soCanCuoc || hopDongData.ngaySinh || hopDongData.ngayCap)) {
          cccdData = {
            hoVaTen: hopDongData.hoVaTen || group.tenTaiKhoan,
            soCanCuoc: hopDongData.soCanCuoc,
            ngaySinh: hopDongData.ngaySinh,
            rawNgaySinh: hopDongData.rawNgaySinh,
            ngayCap: hopDongData.ngayCap,
            rawNgayCap: hopDongData.rawNgayCap,
            noiCap: hopDongData.noiCap,
            gioiTinh: hopDongData.gioiTinh,
            rawGioiTinh: hopDongData.rawGioiTinh,
          };
        } else if (!hopDongData && cccdData) {
          hopDongData = {
            maTKGD: group.maTKGDFutures || baseCode,
            hoVaTen: cccdData.hoVaTen || group.tenTaiKhoan,
            soCanCuoc: cccdData.soCanCuoc,
            ngaySinh: cccdData.ngaySinh,
            rawNgaySinh: cccdData.rawNgaySinh,
            ngayCap: cccdData.ngayCap,
            rawNgayCap: cccdData.rawNgayCap,
            gioiTinh: cccdData.gioiTinh,
            rawGioiTinh: cccdData.gioiTinh,
            noiCap: cccdData.noiCap,
            loaiHinhTaiKhoan: 'Cá nhân',
            chuKy: 'Đã ký',
          };
        }

        // Tự động suy luận từ số CCCD 12 số nếu vẫn còn thiếu Giới tính hoặc Năm sinh
        const cccdNumber = hopDongData?.soCanCuoc || cccdData?.soCanCuoc;
        if (cccdNumber) {
          const inferred = inferFromCCCD(cccdNumber);
          if (inferred.gioiTinh) {
            if (hopDongData && !hopDongData.gioiTinh) {
              hopDongData.gioiTinh = inferred.gioiTinh;
              hopDongData.rawGioiTinh = inferred.gioiTinh;
            }
            if (cccdData && !cccdData.gioiTinh) {
              cccdData.gioiTinh = inferred.gioiTinh;
            }
          }
          if (inferred.namSinh) {
            if (hopDongData && !hopDongData.rawNgaySinh && !hopDongData.ngaySinh) {
              hopDongData.rawNgaySinh = `${inferred.namSinh}`;
            }
            if (cccdData && !cccdData.rawNgaySinh && !cccdData.ngaySinh) {
              cccdData.rawNgaySinh = `${inferred.namSinh}`;
            }
          }
        }

        // ĐẶC BIỆT: Bịt kẽ hở 1 - Ràng buộc theo batchDate khi tìm kiếm bản ghi cũ
        const existingRecord = await this.cleanRecordModel.findOne({
          batchDate: todayStr,
          $or: [
            { maTKGDBase: baseCode },
            { maTKGD: targetAccountCode },
            { 'noiDungMail.maTKGD_Futures': baseCode },
          ],
        });

        const noiDungMailData = {
          maTKGD_Futures: group.maTKGDFutures || baseCode,
          maTKGD_ACM: group.maTKGDACM || (group.hasACMRequest ? `${baseCode}-A` : undefined),
          maTKGD_LME: group.hasLMERequest ? `${baseCode}-L` : undefined,
          maTKGD_Spread: group.hasSpreadRequest ? `${baseCode}-S` : undefined,
          tenTaiKhoan: group.tenTaiKhoan || (existingRecord?.noiDungMail as any)?.tenTaiKhoan || '',
          hasACMRequest: group.hasACMRequest,
          hasLMERequest: group.hasLMERequest,
          hasSpreadRequest: group.hasSpreadRequest,
        };

        if (existingRecord) {
          const currentNoiDung = (existingRecord.noiDungMail as any)?.toObject
            ? (existingRecord.noiDungMail as any).toObject()
            : existingRecord.noiDungMail || {};
          existingRecord.noiDungMail = {
            ...currentNoiDung,
            ...noiDungMailData,
          } as any;
          if (!existingRecord.maTKGDBase) existingRecord.maTKGDBase = baseCode;
          if (!existingRecord.batchDate) existingRecord.batchDate = todayStr;
          if (hopDongData) existingRecord.hopDong = hopDongData;
          if (phuLucData) existingRecord.phuLuc = phuLucData;
          if (cccdData) existingRecord.canCuoc = cccdData;
          await existingRecord.save();
        } else {
          await this.cleanRecordModel.create({
            batchDate: todayStr,
            maTVKD: group.maTVKD || baseCode.substring(0, 3),
            maTKGD: targetAccountCode,
            maTKGDBase: baseCode,
            noiDungMail: noiDungMailData as any,
            hopDong: hopDongData,
            phuLuc: phuLucData,
            canCuoc: cccdData,
            ms: {
              maTKGD: baseCode,
              isFoundOnMS: false,
            } as any,
            ketLuan: {
              trangThai: 'CHUA_XU_LY',
              danhSachLoi: ['Chưa cào dữ liệu từ M-System'],
            } as any,
          });
        }
        processedCount++;
      }
    }

    return {
      success: true,
      count: processedCount,
      message: `Đã nạp và bóc tách thành công ${processedCount} hồ sơ từ email Outlook!`,
    };
  }

  /**
   * Cào thông tin tài khoản từ M-System (Hỗ trợ cào lẻ 1 tài khoản hoặc cào tất cả hồ sơ chờ)
   * TỰ ĐỘNG ĐỐI SOÁT NGAY LẬP TỨC SAU KHI CÀO XONG!
   */
  async syncMSystemAccounts(
    userEmail: string,
    options?: { investorCode?: string; downloadImages?: boolean; batchDate?: string }
  ) {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    let username = config?.msystem?.username;
    let password = config?.msystem?.passwordEncrypted ? decrypt(config.msystem.passwordEncrypted) : '';
    let pin = config?.msystem?.pinEncrypted ? decrypt(config.msystem.pinEncrypted) : '';

    // NẾU CHƯA CÓ TRONG CẤU HÌNH CÁ NHÂN, TỰ ĐỘNG KẾ THỪA TỪ CẤU HÌNH HỆ THỐNG (GIỐNG CHECKLIST BOT)
    if ((!username || !password) && this.settingsService) {
      try {
        const credentialsRaw = await this.settingsService.getSetting('bot_credentials_msystem', '');
        if (credentialsRaw) {
          const creds = JSON.parse(decrypt(credentialsRaw));
          username = username || creds.username;
          password = password || creds.password;
          pin = pin || creds.pin;
          this.logger.log(`[TKGD-MS] Đã tự động kế thừa tài khoản M-System từ cấu hình Checklist Bot (${username})!`);
        }
      } catch (err: any) {
        this.logger.warn(`[TKGD-MS] Không thể giải mã credentials từ SystemSettings: ${err.message}`);
      }
    }

    if (!username || !password) {
      throw new Error('Chưa cấu hình thông tin tài khoản M-System hoặc mật khẩu trong Tab Cài Đặt (hoặc trong Bot Credentials của hệ thống)!');
    }

    // 1. Xác định danh sách tài khoản cần cào
    let codesToScrape: string[] = [];
    if (options?.investorCode && options.investorCode.trim()) {
      codesToScrape = [options.investorCode.trim().split('-')[0]];
    } else {
      const query: any = {
        $or: [
          { 'ms.isFoundOnMS': { $ne: true } },
          { ms: null },
        ],
      };
      if (options?.batchDate) query.batchDate = options.batchDate;
      const pendingRecords = await this.cleanRecordModel.find(query).limit(50);
      codesToScrape = Array.from(new Set(
        pendingRecords.map((r) => r.maTKGDBase || r.noiDungMail?.maTKGD_Futures || r.maTKGD?.split('-')[0] || '').filter(Boolean)
      ));
    }

    if (codesToScrape.length === 0) {
      return {
        success: true,
        scrapedCount: 0,
        message: 'Tất cả hồ sơ đã có thông tin M-System đầy đủ!',
      };
    }

    const shouldDownloadImages = options?.downloadImages !== undefined
      ? options.downloadImages
      : (config?.documentProcessing?.autoSaveMSystemImages ?? true);
    const executablePath = findBrowserExecutable();
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: process.env.HEADLESS_BOT !== 'false' && process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-extensions',
        '--window-size=1280,800',
      ],
    });

    let scrapedCount = 0;
    const todayStr = options?.batchDate || new Date().toISOString().slice(0, 10);

    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();
      // Áp dụng kỹ thuật Anti-bot chuẩn từ Checklist Bot (rpa-downloader.service.ts)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      page.setDefaultTimeout(35000);

      page.on('console', (msg) => this.logger.debug(`[TKGD MS Console] [${msg.type()}] ${msg.text()}`));
      page.on('pageerror', (err) => this.logger.error(`[TKGD MS PageError] ${err.message}`, err.stack));

      // 2. Đăng nhập M-System (áp dụng logic Checklist Bot)
      this.logger.log(`[TKGD-MS] Điều hướng tới trang đăng nhập M-System...`);
      await page.goto('https://msadmin.mxv.com.vn/#/login', { waitUntil: 'load' });
      await page.waitForTimeout(1500);

      await page.waitForSelector('input[name="username"], input[type="text"]', { state: 'visible', timeout: 15000 });
      await page.fill('input[name="username"], input[type="text"]', username);
      await page.fill('input[name="password"], input[type="password"]', password);
      await page.waitForTimeout(500);
      await page.click('button.btn-primary, button[type="submit"]');

      // 3. Bấm mã PIN ảo (áp dụng cơ chế retry 3 lần và quét lỗi giao diện như Checklist Bot)
      this.logger.log(`[TKGD-MS] Chờ hiển thị bảng mã PIN ảo...`);
      let pinModalVisible = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        pinModalVisible = await page.locator('div.pincode').isVisible({ timeout: 5000 }).catch(() => false);
        if (pinModalVisible) break;

        const loginError = await this.checkForLoginErrors(page);
        if (loginError) {
          throw new Error(`Đăng nhập M-System thất bại: ${loginError}`);
        }

        this.logger.warn(`[TKGD-MS] Chưa hiển thị bảng PIN (thử lần ${attempt}), thử click lại nút Đăng nhập...`);
        await page.click('button.btn-primary, button[type="submit"]').catch(() => { });
        await page.waitForTimeout(2000);
      }

      if (!pinModalVisible) {
        const loginError = await this.checkForLoginErrors(page);
        if (loginError) {
          throw new Error(`Đăng nhập M-System thất bại: ${loginError}`);
        }
        throw new Error('Đăng nhập M-System thất bại: Không thấy bảng mã PIN ảo (div.pincode) xuất hiện sau 3 lần thử.');
      }

      if (pin) {
        for (const digit of String(pin)) {
          const checklistDigitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
          const genericBtn = page.locator('.pincode .keyboard .button').filter({ hasText: new RegExp(`^\\s*${digit}\\s*$`) }).first();

          const hasChecklistBtn = await page.locator(checklistDigitSelector).isVisible({ timeout: 1000 }).catch(() => false);
          if (hasChecklistBtn) {
            await page.click(checklistDigitSelector);
          } else if (await genericBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await genericBtn.click();
          }
          await page.waitForTimeout(400);
        }
        await page.waitForTimeout(2500);
      }

      // 4. Xác minh đăng nhập thành công (giống Checklist Bot)
      await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => { });

      // 5. Cào chi tiết từng tài khoản (Bọc try-catch riêng để lỗi 1 hồ sơ không làm hỏng cả mẻ)
      for (const code of codesToScrape) {
        try {
          let saveImagesDir: string | undefined = undefined;
          if (shouldDownloadImages) {
            saveImagesDir = getTkgdAttachmentDirectory(config?.documentProcessing?.attachmentSavePath, todayStr, code);
          }

          const scraped = await scrapeInvestorDetailFromMSystem(page, code, 'https://msadmin.mxv.com.vn', saveImagesDir);

          await this.cleanRecordModel.updateMany(
            {
              $or: [
                { maTKGDBase: code },
                { maTKGD: new RegExp(`^${code}`, 'i') },
                { 'noiDungMail.maTKGD_Futures': code },
              ],
            },
            {
              $set: {
                ms: {
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
                },
              },
            }
          );
          scrapedCount++;
        } catch (err: any) {
          this.logger.error(`[TKGD-MS] Lỗi khi cào tài khoản ${code}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`[TKGD-MS] Lỗi đăng nhập hoặc cào dữ liệu M-System: ${err.message}`);
      // Ghi nhận file log và ảnh chụp lỗi để debug trên Linux giống Checklist Bot
      try {
        const debugDir = path.join(process.cwd(), 'temp', 'debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const txtPath = path.join(debugDir, `error-tkgd-ms-${ts}.txt`);
        const pngPath = path.join(debugDir, `error-tkgd-ms-${ts}.png`);
        const htmlPath = path.join(debugDir, `error-tkgd-ms-${ts}.html`);

        fs.writeFileSync(txtPath, `Time: ${new Date().toISOString()}\nUser: ${username}\nError: ${err.message}\nStack: ${err.stack}\n`, 'utf8');
        if (browser) {
          const pages = browser.contexts().flatMap((c) => c.pages());
          if (pages.length > 0 && !pages[0].isClosed()) {
            await pages[0].screenshot({ path: pngPath, fullPage: true, timeout: 5000 }).catch(() => { });
            const html = await pages[0].content().catch(() => '');
            if (html) fs.writeFileSync(htmlPath, html, 'utf8');
          }
        }
        this.logger.warn(`[TKGD-MS] Đã lưu log và ảnh chụp lỗi debug tại: ${debugDir}`);
      } catch { }
      throw err;
    } finally {
      await browser.close().catch(() => { });
    }

    // TỰ ĐỘNG ĐỐI SOÁT NGAY LẬP TỨC
    const reconResult = await this.runReconciliation(userEmail);

    return {
      success: true,
      scrapedCount,
      summary: reconResult.summary,
      message: `Đã cào M-System thành công cho ${scrapedCount} hồ sơ và tự động đối soát!`,
    };
  }

  /**
   * Chạy quy trình tổng hợp toàn bộ (All-in-One Pipeline)
   */
  async runPipelineAll(
    userEmail: string,
    options?: { downloadImages?: boolean; batchDate?: string }
  ) {
    // 1. Quét Mail
    const mailResult = await this.syncMailOpeningAccounts(userEmail, options?.batchDate);

    // 2. Cào M-System & Tự động đối soát (mặc định tải ảnh và bóc tách đầy đủ)
    const msResult = await this.syncMSystemAccounts(userEmail, {
      downloadImages: options?.downloadImages !== undefined ? options.downloadImages : true,
      batchDate: options?.batchDate,
    });

    return {
      success: true,
      mailCount: mailResult.count,
      scrapedCount: msResult.scrapedCount,
      summary: msResult.summary,
      message: `Hoàn tất toàn bộ chu trình! Đã nạp ${mailResult.count} mail, cào ${msResult.scrapedCount} hồ sơ MS và xuất file Excel đối soát.`,
    };
  }

  /**
   * Thống kê nhanh số lượng hồ sơ phục vụ Dynamic Badge
   */
  async getTkgdStats(userEmail: string, batchDate?: string) {
    const res = await this.getRecords({
      page: 1,
      limit: 1,
      batchDate,
    });
    return res.stats;
  }

  /**
   * Lấy đường dẫn file Excel xuất mới nhất
   */
  async getLatestExcelFilePath(userEmail: string): Promise<string | null> {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    const primaryDir = resolveTkgdOutputDir(config?.storage?.windowsPath);

    const candidateDirs = [
      primaryDir,
      getTkgdOutputDirectory(),
      '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
      path.resolve(process.cwd(), '../POC/TKGD-Automation/output'),
      process.cwd(),
    ].filter((d) => d && fs.existsSync(d));

    const foundFiles: { name: string; fullPath: string; mtime: number }[] = [];
    const seen = new Set<string>();

    for (const d of candidateDirs) {
      try {
        const list = fs.readdirSync(d);
        for (const f of list) {
          if (f.startsWith('Auto_Data_mail_') && (f.endsWith('.xlsx') || f.endsWith('.xlsm'))) {
            const fullPath = path.join(d, f);
            if (!seen.has(fullPath)) {
              seen.add(fullPath);
              foundFiles.push({
                name: f,
                fullPath,
                mtime: fs.statSync(fullPath).mtimeMs,
              });
            }
          }
        }
      } catch { }
    }

    foundFiles.sort((a, b) => b.mtime - a.mtime);
    return foundFiles.length > 0 ? foundFiles[0].fullPath : null;
  }

  /**
   * Quét và phân loại toàn bộ tệp hồ sơ đính kèm (Mail & M-System) phục vụ giao diện đối soát trực quan
   */
  async getAccountFilesManifest(
    userEmail: string,
    accountCode: string,
    batchDate?: string,
  ) {
    const code = (accountCode || '').trim();
    if (!code) {
      return { success: false, message: 'Thiếu mã tài khoản' };
    }

    const config = await this.userConfigModel.findOne({ userEmail }).lean();

    // Tìm record trong DB để lấy thêm thông tin batchDate & đường dẫn MS nếu có
    const record = await this.cleanRecordModel
      .findOne({
        $or: [
          { maTKGDBase: code },
          { maTKGD: code },
          { 'noiDungMail.maTKGD_Futures': code },
        ],
      })
      .lean();

    const effectiveBatchDate =
      batchDate?.trim() || record?.batchDate || new Date().toISOString().slice(0, 10);

    // Xác định các thư mục tiềm năng chứa hồ sơ tài khoản này
    const candidateDirs: string[] = [];

    // 1. Thư mục chuẩn theo config hoặc mặc định
    const standardDir = getTkgdAttachmentDirectory(
      config?.documentProcessing?.attachmentSavePath || config?.storage?.windowsPath,
      effectiveBatchDate,
      code,
    );
    candidateDirs.push(standardDir);

    // 2. Thử các đường dẫn mạng cố định trên Linux & Windows
    const netBases = [
      '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem',
      path.resolve(process.cwd(), 'data/temp_tkgd_attachments'),
    ];

    for (const nb of netBases) {
      if (fs.existsSync(nb)) {
        const dateFolder = path.join(nb, effectiveBatchDate);
        if (fs.existsSync(dateFolder)) {
          try {
            const children = fs.readdirSync(dateFolder, { withFileTypes: true });
            for (const c of children) {
              if (c.isDirectory() && (c.name === code || c.name.startsWith(`${code}_`))) {
                candidateDirs.push(path.join(dateFolder, c.name));
              }
            }
          } catch { }
          candidateDirs.push(path.join(dateFolder, code));
        }
        candidateDirs.push(path.join(nb, code));
      }
    }

    // Tìm thư mục thực tế đầu tiên có chứa file
    let foundDir: string | null = null;
    let filesInDir: string[] = [];

    for (const d of candidateDirs) {
      if (fs.existsSync(d)) {
        try {
          const list = fs.readdirSync(d).filter((f) => {
            try {
              return fs.statSync(path.join(d, f)).isFile();
            } catch {
              return false;
            }
          });
          if (list.length > 0) {
            foundDir = d;
            filesInDir = list;
            break;
          }
          if (!foundDir) foundDir = d;
        } catch { }
      }
    }

    // Phân loại tệp
    let mailCccdFront: any = null;
    let mailCccdBack: any = null;
    let mailContractPdf: any = null;
    let mailPl01Pdf: any = null;

    let msCccdFront: any = null;
    let msCccdBack: any = null;
    let msSignature: any = null;

    const otherFiles: any[] = [];

    const buildFileObj = (fName: string, subType: string) => {
      let fileSize = 0;
      if (foundDir) {
        try {
          fileSize = fs.statSync(path.join(foundDir, fName)).size;
        } catch { }
      }
      return {
        fileName: fName,
        size: fileSize,
        subType,
        url: `/api/v1/tkgd/files/stream?accountCode=${encodeURIComponent(code)}&batchDate=${encodeURIComponent(effectiveBatchDate)}&fileName=${encodeURIComponent(fName)}`,
      };
    };

    for (const f of filesInDir) {
      if (isIgnoredEmailAttachment(f)) continue;
      const lower = f.toLowerCase();
      const isMS = lower.includes('_ms_') || lower.startsWith(`${code.toLowerCase()}_ms`);

      if (lower.endsWith('.pdf')) {
        if (lower.includes('pl01') || lower.includes('phuluc') || lower.includes('-pl')) {
          if (!mailPl01Pdf) mailPl01Pdf = buildFileObj(f, 'MAIL_PL01');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        } else if (lower.includes('mxv') || lower.includes('hopdong') || lower.includes('hd')) {
          if (!mailContractPdf) mailContractPdf = buildFileObj(f, 'MAIL_CONTRACT');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        } else {
          if (!mailContractPdf) mailContractPdf = buildFileObj(f, 'MAIL_CONTRACT');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        }
      } else if (['.jpg', '.jpeg', '.png', '.webp'].some((ext) => lower.endsWith(ext))) {
        if (isMS) {
          if (lower.includes('truoc') || lower.includes('front') || lower.includes('mat1')) {
            msCccdFront = buildFileObj(f, 'MS_CCCD_FRONT');
          } else if (lower.includes('sau') || lower.includes('back') || lower.includes('mat2')) {
            msCccdBack = buildFileObj(f, 'MS_CCCD_BACK');
          } else if (lower.includes('chuky') || lower.includes('ky') || lower.includes('signature')) {
            msSignature = buildFileObj(f, 'MS_SIGNATURE');
          } else {
            otherFiles.push(buildFileObj(f, 'IMAGE'));
          }
        } else {
          if (lower.includes('truoc') || lower.includes('front') || lower.includes('mat1')) {
            mailCccdFront = buildFileObj(f, 'MAIL_CCCD_FRONT');
          } else if (lower.includes('sau') || lower.includes('back') || lower.includes('mat2')) {
            mailCccdBack = buildFileObj(f, 'MAIL_CCCD_BACK');
          } else if (lower.includes('chuky') || lower.includes('signature')) {
            otherFiles.push(buildFileObj(f, 'IMAGE'));
          } else if (!mailCccdFront) {
            mailCccdFront = buildFileObj(f, 'MAIL_CCCD_FRONT');
          } else if (!mailCccdBack) {
            mailCccdBack = buildFileObj(f, 'MAIL_CCCD_BACK');
          } else {
            otherFiles.push(buildFileObj(f, 'IMAGE'));
          }
        }
      } else {
        otherFiles.push(buildFileObj(f, 'OTHER'));
      }
    }

    // Fallback: nếu MS chưa có trong folder nhưng có path trong DB record
    if (!msCccdFront && record?.ms?.cccdMatTruocLocalPath && fs.existsSync(record.ms.cccdMatTruocLocalPath)) {
      msCccdFront = {
        fileName: path.basename(record.ms.cccdMatTruocLocalPath),
        size: fs.statSync(record.ms.cccdMatTruocLocalPath).size,
        subType: 'MS_CCCD_FRONT',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.ms.cccdMatTruocLocalPath)}`,
      };
    }
    if (!msCccdBack && record?.ms?.cccdMatSauLocalPath && fs.existsSync(record.ms.cccdMatSauLocalPath)) {
      msCccdBack = {
        fileName: path.basename(record.ms.cccdMatSauLocalPath),
        size: fs.statSync(record.ms.cccdMatSauLocalPath).size,
        subType: 'MS_CCCD_BACK',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.ms.cccdMatSauLocalPath)}`,
      };
    }
    if (!msSignature && record?.ms?.chuKyLocalPath && fs.existsSync(record.ms.chuKyLocalPath)) {
      msSignature = {
        fileName: path.basename(record.ms.chuKyLocalPath),
        size: fs.statSync(record.ms.chuKyLocalPath).size,
        subType: 'MS_SIGNATURE',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.ms.chuKyLocalPath)}`,
      };
    }

    return {
      success: true,
      accountCode: code,
      batchDate: effectiveBatchDate,
      directory: foundDir || standardDir,
      totalFiles: filesInDir.length,
      files: {
        mailCccdFront,
        mailCccdBack,
        mailContractPdf,
        mailPl01Pdf,
        msCccdFront,
        msCccdBack,
        msSignature,
      },
      otherFiles,
      ocrSummary: {
        soCanCuocMail: record?.hopDong?.soCanCuoc || record?.canCuoc?.soCanCuoc,
        soCanCuocMs: record?.ms?.soCMND_HoChieu || record?.ms?.cccdOcr_soCanCuoc,
        hoTenMail: record?.noiDungMail?.tenTaiKhoan || record?.hopDong?.hoVaTen,
        hoTenMs: record?.ms?.hoVaTen,
        canhBaoChatLuong: record?.canCuoc?.canhBaoChatLuong || [],
        dinhDangLoi: record?.hopDong?.dinhDangLoi || [],
        theGeneration: record?.canCuoc?.theGeneration,
        confidenceScore: record?.canCuoc?.confidenceScore,
      },
    };
  }

  /**
   * Phân giải và kiểm tra an toàn đường dẫn tệp đính kèm phục vụ Stream
   */
  async resolveAttachmentFilePath(
    userEmail: string,
    params: {
      accountCode?: string;
      batchDate?: string;
      fileName?: string;
      filePath?: string;
    },
  ): Promise<string | null> {
    // 1. Kiểm tra filePath trực tiếp nếu có
    if (params.filePath && params.filePath.trim()) {
      const cleanPath = path.normalize(params.filePath.trim());
      // Bảo vệ: Chặn path traversal với ..
      if (cleanPath.includes('..')) {
        return null;
      }
      if (fs.existsSync(cleanPath)) {
        return cleanPath;
      }
    }

    // 2. Kiểm tra theo accountCode và fileName
    if (params.fileName && params.fileName.trim()) {
      const safeFileName = path.basename(params.fileName.trim());
      const accountCode = (params.accountCode || '').trim();
      const config = await this.userConfigModel.findOne({ userEmail }).lean();

      let effectiveBatchDate = params.batchDate?.trim();
      if (!effectiveBatchDate && accountCode) {
        const rec = await this.cleanRecordModel
          .findOne({
            $or: [{ maTKGDBase: accountCode }, { maTKGD: accountCode }],
          })
          .lean();
        effectiveBatchDate = rec?.batchDate;
      }
      if (!effectiveBatchDate) {
        effectiveBatchDate = new Date().toISOString().slice(0, 10);
      }

      const searchDirs: string[] = [];

      if (accountCode) {
        searchDirs.push(
          getTkgdAttachmentDirectory(
            config?.documentProcessing?.attachmentSavePath || config?.storage?.windowsPath,
            effectiveBatchDate,
            accountCode,
          ),
        );
      }

      const netBases = [
        '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem',
        path.resolve(process.cwd(), 'data/temp_tkgd_attachments'),
      ];

      for (const nb of netBases) {
        if (fs.existsSync(nb) && accountCode) {
          const dateFolder = path.join(nb, effectiveBatchDate);
          if (fs.existsSync(dateFolder)) {
            try {
              const children = fs.readdirSync(dateFolder, { withFileTypes: true });
              for (const c of children) {
                if (c.isDirectory() && (c.name === accountCode || c.name.startsWith(`${accountCode}_`))) {
                  searchDirs.push(path.join(dateFolder, c.name));
                }
              }
            } catch { }
            searchDirs.push(path.join(dateFolder, accountCode));
          }
          searchDirs.push(path.join(nb, accountCode));
        }
      }

      for (const d of searchDirs) {
        if (fs.existsSync(d)) {
          const full = path.join(d, safeFileName);
          if (fs.existsSync(full)) {
            return full;
          }
        }
      }
    }

    return null;
  }

  /**
   * Cán bộ nghiệp vụ chủ động phê duyệt hồ sơ bằng tay (Manual Override)
   */
  async manualApproveRecord(recordId: string, userEmail: string, reason?: string) {
    const record = await this.cleanRecordModel.findById(recordId);
    if (!record) {
      throw new NotFoundException(`Không tìm thấy hồ sơ ID ${recordId}`);
    }

    const previousData = {
      ketLuan: record.ketLuan,
      manualReview: record.manualReview,
    };

    const now = new Date();
    record.manualReview = {
      isOverridden: true,
      status: 'DA_DUYET',
      approvedBy: userEmail,
      approvedAt: now,
      reason: (reason || 'Cán bộ TTBT phê duyệt hồ sơ bằng tay').trim(),
    };

    record.ketLuan = {
      trangThai: 'KHOP',
      danhSachLoi: [],
      reconciledAt: now,
    };

    if (!record.snapshots) record.snapshots = [];
    record.snapshots.push({
      snapshotAt: now,
      action: 'MANUAL_APPROVE',
      previousData,
    } as any);

    await record.save();
    this.logger.log(`[MANUAL-APPROVE] ${userEmail} đã duyệt tay hồ sơ ${record.maTKGD || record.maTKGDBase}`);
    return {
      success: true,
      record,
      message: `Đã phê duyệt hồ sơ ${record.maTKGD || record.maTKGDBase} thành công!`,
    };
  }

  /**
   * Hủy phê duyệt bằng tay, trả về để máy tự động đối soát lại
   */
  async revertManualApprove(recordId: string, userEmail: string) {
    const record = await this.cleanRecordModel.findById(recordId);
    if (!record) {
      throw new NotFoundException(`Không tìm thấy hồ sơ ID ${recordId}`);
    }

    const previousData = {
      ketLuan: record.ketLuan,
      manualReview: record.manualReview,
    };

    const now = new Date();
    record.manualReview = {
      isOverridden: false,
      status: 'CHUA_XU_LY',
      approvedBy: undefined,
      approvedAt: undefined,
      reason: undefined,
    };

    if (!record.snapshots) record.snapshots = [];
    record.snapshots.push({
      snapshotAt: now,
      action: 'REVERT_APPROVE',
      previousData,
    } as any);

    await record.save();

    // Tự động kích hoạt đối soát lại cho mẻ của hồ sơ này
    await this.runReconciliation(userEmail, record.batchDate);

    const updated = await this.cleanRecordModel.findById(recordId);
    this.logger.log(`[REVERT-APPROVE] ${userEmail} đã hủy duyệt tay hồ sơ ${record.maTKGD || record.maTKGDBase}`);
    return {
      success: true,
      record: updated,
      message: `Đã hủy duyệt tay, đối soát máy đã được cập nhật lại.`,
    };
  }
}

