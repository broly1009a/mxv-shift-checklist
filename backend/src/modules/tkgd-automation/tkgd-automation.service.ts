import { Injectable, Logger, Optional } from '@nestjs/common';
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
} from '../bot-engine/helpers/tkgd-reconcile-exporter.helper';
import { parseAccountOpeningEmailBody, htmlToPlainText } from '../bot-engine/helpers/tkgd-mail-parser.helper';
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
    const d = new Date(yyyy, mm, dd);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? undefined : d;
}

function formatDateStr(d?: Date | string | null): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeDateStr(d: string | undefined | null): string {
  if (!d) return '';
  const s = d.trim().replace(/-/g, '/');
  const parts = s.split('/');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }
  return s;
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

@Injectable()
export class TkgdAutomationService {
  private readonly logger = new Logger(TkgdAutomationService.name);

  constructor(
    @InjectModel(TkgdUserConfig.name) private userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(RawAccountMail.name) private rawMailModel: Model<RawAccountMailDocument>,
    @InjectModel(CleanAccountRecord.name) private cleanRecordModel: Model<CleanAccountRecordDocument>,
    @Optional() private readonly settingsService?: SystemSettingsService,
  ) {}

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
        await page.click('button[type="submit"], button.btn-primary').catch(() => {});
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

        if (r.ketLuan?.trangThai === 'KHOP' && existing.ketLuan?.trangThai !== 'LECH') {
          existing.ketLuan = r.ketLuan;
        } else if (r.ketLuan?.trangThai === 'KHOP_TEXT' && (!existing.ketLuan?.trangThai || existing.ketLuan?.trangThai === 'CHUA_XU_LY')) {
          existing.ketLuan = r.ketLuan;
        }
      }
    }

    let groupedList = Array.from(groupedMap.values());

    // Áp dụng bộ lọc
    if (filter === 'KHOP') {
      groupedList = groupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP');
    } else if (filter === 'KHOP_TEXT') {
      groupedList = groupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP_TEXT');
    } else if (filter === 'LECH') {
      groupedList = groupedList.filter(
        (g) => g.ketLuan?.trangThai && g.ketLuan?.trangThai !== 'KHOP' && g.ketLuan?.trangThai !== 'KHOP_TEXT' && g.ketLuan?.trangThai !== 'CHUA_XU_LY',
      );
    } else if (['FUTURES', 'ACM', 'LME', 'SPREAD'].includes(filter || '')) {
      groupedList = groupedList.filter((g) => g.accountTypes?.includes(filter));
    }

    const total = groupedList.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const items = groupedList.slice(skip, skip + limit);

    return { items, total, page, pageSize: limit, totalPages };
  }

  /**
   * Kích hoạt chạy đối soát chéo, cập nhật trạng thái vào MongoDB và xuất file Excel
   */
  async runReconciliation(userEmail: string) {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    const records = await this.cleanRecordModel.find().sort({ createdAt: -1 }).limit(100);

    const summary: ReconcileSummary = await reconcileAndExportToExcel(records, {
      outputPath: config?.storage?.windowsPath
        ? `${config.storage.windowsPath}\\Auto_Data_mail_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`
        : undefined,
    });

    // Cập nhật trạng thái đối soát trực tiếp vào MongoDB cho từng bản ghi
    const now = new Date();
    for (const record of records) {
      const ms: any = record.ms || {};
      const mail: any = record.noiDungMail || {};
      const targetAccountCode = (record.maTKGD || ms.maTKGD || mail.maTKGD_Futures || mail.maTKGD_ACM || '').trim();
      const baseCode = (record.maTKGDBase || mail.maTKGD_Futures || targetAccountCode.split('-')[0] || '').trim();
      const cleanPersonName = (n: string) => {
        if (!n) return '';
        let s = n.trim().replace(/\s+(TVKD|đã đính kèm|đề nghị|cam kết|kính gửi).*$/i, '').trim();
        s = s.replace(/[;,.\-]+$/, '').trim();
        return s.toLowerCase().replace(/\s+/g, ' ');
      };
      const mailName = cleanPersonName(mail.tenTaiKhoan);
      const msName = cleanPersonName(ms.hoVaTen || ms.tenTKGD);

      const mailCccd = (record.hopDong?.soCanCuoc || record.canCuoc?.soCanCuoc || record.phuLuc?.soCanCuoc || '').trim();
      const msCccd = (ms.soCMND_HoChieu || ms.cccdOcr_soCanCuoc || '').trim();

      let isMatched = true;
      const errors: string[] = [];

      if (!ms.isFoundOnMS) {
        isMatched = false;
        errors.push('Tài khoản chưa được tạo trên M-System');
      } else {
        const msCode = (ms.maTKGD || '').trim();
        const isSubAccount = targetAccountCode.includes('-A') || targetAccountCode.includes('-L') || targetAccountCode.includes('-S');
        if (isSubAccount) {
          // Với tiểu khoản (-A, -L, -S), M-System lưu theo mã NĐT cơ sở (baseCode)
          const msBaseCode = msCode.split('-')[0].toUpperCase();
          if (baseCode && msBaseCode && baseCode.toUpperCase() !== msBaseCode) {
            isMatched = false;
            errors.push(`Lệch mã cơ sở (Yêu cầu: ${baseCode} != MS: ${msCode})`);
          }
        } else {
          if (baseCode && msCode && !msCode.startsWith(baseCode)) {
            isMatched = false;
            errors.push(`Lệch mã TKGD (Yêu cầu: ${baseCode} != MS: ${msCode})`);
          }
        }

        if (mailName && msName && mailName !== msName) {
          isMatched = false;
          errors.push(`Lệch họ tên (Mail: ${mail.tenTaiKhoan} != MS: ${ms.hoVaTen})`);
        }

        if (mailCccd && msCccd && mailCccd !== msCccd) {
          isMatched = false;
          errors.push(`Lệch số CCCD (HĐ: ${mailCccd} != MS: ${msCccd})`);
        }

        // 4. Đối chiếu Ngày sinh (HĐ vs CCCD vs MS)
        const hdDob = record.hopDong?.rawNgaySinh || (record.hopDong?.ngaySinh ? formatDateStr(record.hopDong.ngaySinh) : '');
        const cccdDob = record.canCuoc?.ngaySinh ? formatDateStr(record.canCuoc.ngaySinh) : '';
        if (hdDob && cccdDob && normalizeDateStr(hdDob) !== normalizeDateStr(cccdDob)) {
          isMatched = false;
          errors.push(`Lệch ngày sinh (HĐ: ${hdDob} != CCCD: ${cccdDob})`);
        }

        // 5. Đối chiếu Ngày cấp (HĐ vs CCCD vs MS)
        const hdIssue = record.hopDong?.rawNgayCap || (record.hopDong?.ngayCap ? formatDateStr(record.hopDong.ngayCap) : '');
        const cccdIssue = record.canCuoc?.ngayCap ? formatDateStr(record.canCuoc.ngayCap) : '';
        if (hdIssue && cccdIssue && normalizeDateStr(hdIssue) !== normalizeDateStr(cccdIssue)) {
          isMatched = false;
          errors.push(`Lệch ngày cấp (HĐ: ${hdIssue} != CCCD: ${cccdIssue})`);
        }

        // 6. Đối chiếu Giới tính (HĐ vs CCCD)
        const hdSex = record.hopDong?.rawGioiTinh || record.hopDong?.gioiTinh;
        const cccdSex = record.canCuoc?.gioiTinh;
        if (hdSex && cccdSex && !isGenderMatch(hdSex, cccdSex)) {
          isMatched = false;
          errors.push(`Lệch giới tính (HĐ: ${hdSex} != CCCD: ${cccdSex})`);
        }
      }

      // 7. Kiểm tra lỗi định dạng trên Hợp đồng (YYYY-MM-DD, female/male)
      if (record.hopDong?.dinhDangLoi && Array.isArray(record.hopDong.dinhDangLoi) && record.hopDong.dinhDangLoi.length > 0) {
        isMatched = false;
        errors.push(...record.hopDong.dinhDangLoi);
      }

      // 8. Kiểm tra cảnh báo chất lượng ảnh CCCD (mất góc, lẹm viền, cắt chữ)
      if (record.canCuoc?.canhBaoChatLuong && Array.isArray(record.canCuoc.canhBaoChatLuong) && record.canCuoc.canhBaoChatLuong.length > 0) {
        isMatched = false;
        errors.push(...record.canCuoc.canhBaoChatLuong);
      }

      let finalStatus = 'LECH';
      if (isMatched && errors.length === 0) {
        if (mailCccd && msCccd && mailCccd === msCccd) {
          finalStatus = 'KHOP';
        } else if (!mailCccd) {
          // Khớp Mã + Tên, nhưng chưa có CCCD từ tệp đính kèm (hoặc chạy chế độ Nhanh Text)
          finalStatus = 'KHOP_TEXT';
        } else {
          finalStatus = 'KHOP';
        }
      }

      await this.cleanRecordModel.updateOne(
        { _id: record._id },
        {
          $set: {
            'ketLuan.trangThai': finalStatus,
            'ketLuan.danhSachLoi': errors,
            'ketLuan.reconciledAt': now,
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
                    if (a.contentBytes) {
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
                              if (a.contentBytes) {
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
            if (['content.md', 'sender.md', 'subject.md'].includes(lower)) continue;
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
      const parsed = parseAccountOpeningEmailBody(mail.bodyRawText);
      const baseCode = parsed.maTKGDFutures || (parsed.maTKGDACM ? parsed.maTKGDACM.replace(/-A$/i, '') : null);
      if (!baseCode) continue;

      const targetAccountCode = parsed.maTKGDFutures || parsed.maTKGDACM || baseCode;

      // Trích xuất Hợp đồng, Phụ lục, CCCD từ tệp đính kèm (nếu có)
      let hopDongData: any = undefined;
      let phuLucData: any = undefined;
      let cccdData: any = undefined;

      if (mail.attachments && mail.attachments.length > 0) {
        const tempAccDir = path.join(process.cwd(), 'data', 'temp_tkgd_attachments', baseCode);
        if (!fs.existsSync(tempAccDir)) fs.mkdirSync(tempAccDir, { recursive: true });

        let hopDongPath: string | undefined = undefined;
        let phuLucPath: string | undefined = undefined;
        let cccdFrontPath: string | undefined = undefined;
        let cccdBackPath: string | undefined = undefined;

        for (const att of mail.attachments) {
          const nameLower = (att.name || '').toLowerCase();
          let targetFilePath = att.filePath;

          if (att.contentBytes) {
            targetFilePath = path.join(tempAccDir, att.name);
            fs.writeFileSync(targetFilePath, Buffer.from(att.contentBytes, 'base64'));
          }

          if (targetFilePath && fs.existsSync(targetFilePath)) {
            if (nameLower.endsWith('.pdf')) {
              if (nameLower.includes('pl01') || nameLower.includes('phuluc') || nameLower.includes('-pl')) {
                phuLucPath = targetFilePath;
              } else if (nameLower.includes('mxv') || nameLower.includes('hopdong') || nameLower.includes('hd') || !hopDongPath) {
                hopDongPath = targetFilePath;
              }
            } else if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.png')) {
              if (nameLower.includes('truoc') || nameLower.includes('front') || nameLower.includes('mat1')) {
                cccdFrontPath = targetFilePath;
              } else if (nameLower.includes('sau') || nameLower.includes('back') || nameLower.includes('mat2')) {
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
                hoVaTen: pythonRes.hopDong.hoTen || parsed.tenTK,
                soCanCuoc: pythonRes.hopDong.soCCCD,
                ngaySinh: parseDate(pythonRes.hopDong.ngaySinh),
                rawNgaySinh: pythonRes.hopDong.rawNgaySinh,
                ngayCap: parseDate(pythonRes.hopDong.ngayCap),
                rawNgayCap: pythonRes.hopDong.rawNgayCap,
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
                hoVaTen: pythonRes.phuLuc.tenKH || parsed.tenTK,
                chuKy: pythonRes.phuLuc.hasSignature ? 'Đã ký' : 'Chưa ký',
              };
            }

            if (pythonRes.canCuoc && (pythonRes.canCuoc.soCCCD || pythonRes.canCuoc.hoTen || pythonRes.canCuoc.ngaySinh || (pythonRes.canCuoc.canhBaoChatLuong && pythonRes.canCuoc.canhBaoChatLuong.length > 0))) {
              cccdData = {
                hoVaTen: pythonRes.canCuoc.hoTen || hopDongData?.hoVaTen || parsed.tenTK,
                soCanCuoc: pythonRes.canCuoc.soCCCD || hopDongData?.soCanCuoc,
                ngaySinh: parseDate(pythonRes.canCuoc.ngaySinh) || hopDongData?.ngaySinh,
                ngayCap: parseDate(pythonRes.canCuoc.ngayCap) || hopDongData?.ngayCap,
                gioiTinh: pythonRes.canCuoc.gioiTinh || hopDongData?.gioiTinh,
                diaChiThuongTru: pythonRes.canCuoc.diaChi,
                canhBaoChatLuong: pythonRes.canCuoc.canhBaoChatLuong || [],
                ocrConfidence: pythonRes.canCuoc.source || 'OCR',
              };
            }
          }
        } catch (pyErr: any) {
          this.logger.warn(`[PYTHON-EXTRACT] Fallback sang TS cho ${baseCode}: ${pyErr.message}`);
        }

        // Fallback TypeScript nếu Python chưa trả về hopDongData
        if (!hopDongData && !phuLucData) {
          for (const att of mail.attachments) {
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
                  phuLucData.maTKGD = parsed.maTKGDACM || `${baseCode}-A`;
                  phuLucData.hoVaTen = parsed.tenTK || phuLucData.hoVaTen;
                }
              } else if (nameLower.includes('mxv') || nameLower.includes('hopdong') || nameLower.includes('hd') || !hopDongData) {
                hopDongData = await extractHopDongPdf(fileBuffer, att.name);
                if (hopDongData) {
                  hopDongData.maTKGD = parsed.maTKGDFutures || baseCode;
                  hopDongData.hoVaTen = parsed.tenTK || hopDongData.hoVaTen;
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
            maTKGD: parsed.maTKGDFutures || baseCode,
            hoVaTen: parsed.tenTK || phuLucData.hoVaTen,
            soCanCuoc: phuLucData.soCanCuoc,
            ngayCap: phuLucData.ngayCap,
            noiCap: phuLucData.noiCap,
            ngayKyHD: phuLucData.ngayKyHD,
            loaiHinhTaiKhoan: 'Cá nhân',
            chuKy: 'Đã ký',
          };
        }
      }

      if (hopDongData && !cccdData && (hopDongData.soCanCuoc || hopDongData.ngaySinh || hopDongData.ngayCap)) {
        cccdData = {
          hoVaTen: hopDongData.hoVaTen || parsed.tenTK,
          soCanCuoc: hopDongData.soCanCuoc,
          ngaySinh: hopDongData.ngaySinh,
          ngayCap: hopDongData.ngayCap,
          noiCap: hopDongData.noiCap,
        };
      }

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

      const existingRecord = await this.cleanRecordModel.findOne({
        $or: [
          { maTKGDBase: baseCode },
          { maTKGD: targetAccountCode },
          { 'noiDungMail.maTKGD_Futures': baseCode },
        ],
      });

      const noiDungMailData = {
        maTKGD_Futures: parsed.maTKGDFutures || baseCode,
        maTKGD_ACM: parsed.maTKGDACM || (parsed.hasACMRequest ? `${baseCode}-A` : undefined),
        maTKGD_LME: parsed.maTKGDLME || undefined,
        maTKGD_Spread: parsed.maTKGDSpread || undefined,
        tenTaiKhoan: parsed.tenTK || '',
        hasACMRequest: parsed.hasACMRequest,
        hasLMERequest: parsed.hasLMERequest,
        hasSpreadRequest: parsed.hasSpreadRequest,
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
          maTVKD: parsed.maTVKD || baseCode.substring(0, 3),
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

    const shouldDownloadImages = options?.downloadImages || config?.documentProcessing?.autoSaveMSystemImages || false;
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
        await page.click('button.btn-primary, button[type="submit"]').catch(() => {});
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
      await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => {});

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
                  ngayCap: scraped.ngayCap,
                  noiCap: scraped.noiCap,
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
            await pages[0].screenshot({ path: pngPath, fullPage: true, timeout: 5000 }).catch(() => {});
            const html = await pages[0].content().catch(() => '');
            if (html) fs.writeFileSync(htmlPath, html, 'utf8');
          }
        }
        this.logger.warn(`[TKGD-MS] Đã lưu log và ảnh chụp lỗi debug tại: ${debugDir}`);
      } catch {}
      throw err;
    } finally {
      await browser.close().catch(() => {});
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

    // 2. Cào M-System & Tự động đối soát
    const msResult = await this.syncMSystemAccounts(userEmail, {
      downloadImages: options?.downloadImages,
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
    const query: any = {};
    if (batchDate) query.batchDate = batchDate;

    const totalCount = await this.cleanRecordModel.countDocuments(query);
    const pendingMsCount = await this.cleanRecordModel.countDocuments({
      ...query,
      $or: [
        { 'ms.isFoundOnMS': { $ne: true } },
        { ms: null },
      ],
    });
    const matchedCount = await this.cleanRecordModel.countDocuments({
      ...query,
      'ketLuan.trangThai': 'KHOP',
    });
    const mismatchedCount = await this.cleanRecordModel.countDocuments({
      ...query,
      'ketLuan.trangThai': 'LECH',
    });

    return {
      totalCount,
      pendingMsCount,
      matchedCount,
      mismatchedCount,
    };
  }

  /**
   * Lấy đường dẫn file Excel xuất mới nhất
   */
  async getLatestExcelFilePath(userEmail: string): Promise<string | null> {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    const dir = config?.storage?.windowsPath || getTkgdOutputDirectory();
    if (!fs.existsSync(dir)) return null;

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('Auto_Data_mail_') && (f.endsWith('.xlsx') || f.endsWith('.xlsm')))
      .map((f) => ({
        name: f,
        fullPath: path.join(dir, f),
        mtime: fs.statSync(path.join(dir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return files.length > 0 ? files[0].fullPath : null;
  }
}
