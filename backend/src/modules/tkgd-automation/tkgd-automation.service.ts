import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../schemas/tkgd-user-config.schema';
import { RawAccountMail, RawAccountMailDocument } from '../../schemas/raw-account-mail.schema';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../schemas/clean-account-record.schema';
import { encrypt, decrypt } from '../bot-engine/utils/crypto';
import { chromium } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';
import { scrapeInvestorDetailFromMSystem } from '../bot-engine/helpers/msystem-scraper.helper';
import {
  reconcileAndExportToExcel,
  ReconcileSummary,
  getTkgdOutputDirectory,
  getTkgdAttachmentDirectory,
} from '../bot-engine/helpers/tkgd-reconcile-exporter.helper';
import { parseAccountOpeningEmailBody } from '../bot-engine/helpers/tkgd-mail-parser.helper';

function findBrowserExecutable(): string {
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
  return 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
}

@Injectable()
export class TkgdAutomationService {
  private readonly logger = new Logger(TkgdAutomationService.name);

  constructor(
    @InjectModel(TkgdUserConfig.name) private userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(RawAccountMail.name) private rawMailModel: Model<RawAccountMailDocument>,
    @InjectModel(CleanAccountRecord.name) private cleanRecordModel: Model<CleanAccountRecordDocument>,
  ) {}


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
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(25000);
      await page.goto('https://msadmin.mxv.com.vn/#/login', { waitUntil: 'load' });
      await page.waitForTimeout(1500);

      await page.fill('input[type="text"], input[name="username"]', username);
      await page.fill('input[type="password"], input[name="password"]', password);
      await page.click('button[type="submit"], button.btn-primary');
      await page.waitForTimeout(2000);

      // Kiểm tra xem có popup PIN không
      const pinModal = page.locator('div.pincode');
      const isPinVisible = await pinModal.isVisible({ timeout: 4000 }).catch(() => false);

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
        }
      }
    }

    let groupedList = Array.from(groupedMap.values());

    // Áp dụng bộ lọc
    if (filter === 'KHOP') {
      groupedList = groupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP');
    } else if (filter === 'LECH') {
      groupedList = groupedList.filter(
        (g) => g.ketLuan?.trangThai && g.ketLuan?.trangThai !== 'KHOP' && g.ketLuan?.trangThai !== 'CHUA_XU_LY',
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
      const mailName = (mail.tenTaiKhoan || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const msName = (ms.hoVaTen || ms.tenTKGD || '').trim().toLowerCase().replace(/\s+/g, ' ');

      let isMatched = true;
      const errors: string[] = [];

      if (!ms.isFoundOnMS) {
        isMatched = false;
        errors.push('Tài khoản chưa được tạo trên M-System');
      } else {
        const msCode = (ms.maTKGD || '').trim();
        const isSubAccount = targetAccountCode.includes('-A');
        if (isSubAccount) {
          if (targetAccountCode && msCode && targetAccountCode.toUpperCase() !== msCode.toUpperCase()) {
            isMatched = false;
            errors.push(`Lệch mã ACM (Yêu cầu: ${targetAccountCode} != MS: ${msCode})`);
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
      }

      await this.cleanRecordModel.updateOne(
        { _id: record._id },
        {
          $set: {
            'ketLuan.trangThai': isMatched ? 'KHOP' : 'LECH',
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
    if (config?.outlook?.refreshToken) {
      try {
        const tenantId = config.outlook.tenantId || process.env.MICROSOFT_TENANT_ID || 'common';
        const clientId = config.outlook.clientId || process.env.MICROSOFT_CLIENT_ID || '';
        const clientSecret = config.outlook.clientSecret || (await this.getRawClientSecret(userEmail)) || process.env.MICROSOFT_CLIENT_SECRET || '';

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

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;
          if (tokenData.refresh_token && tokenData.refresh_token !== config.outlook.refreshToken) {
            await this.userConfigModel.updateOne({ userEmail }, { 'outlook.refreshToken': tokenData.refresh_token });
          }

          const graphUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=contains(subject,'Yêu cầu mở TKGD')&$top=50&$orderby=receivedDateTime desc`;
          const messagesRes = await fetch(graphUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (messagesRes.ok) {
            const msgs = await messagesRes.json();
            for (const msg of msgs.value || []) {
              emailList.push({
                messageId: msg.id,
                subject: msg.subject || '',
                senderEmail: msg.sender?.emailAddress?.address || '',
                senderName: msg.sender?.emailAddress?.name || '',
                receivedDateTime: new Date(msg.receivedDateTime || Date.now()),
                bodyRawText: msg.body?.content?.replace(/<[^>]*>/g, ' ') || msg.bodyPreview || '',
                attachments: [],
              });
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi gọi Microsoft Graph API: ${err.message}. Chuyển sang nạp mẫu.`);
      }
    }

    // 2. Fallback: Nếu không có mail từ Graph API, nạp từ thư mục mẫu POC thực tế
    if (emailList.length === 0) {
      const candidates = [
        path.resolve(process.cwd(), '../POC/TKGD-Automation/inputs/mail-outlook'),
        path.resolve(__dirname, '../../../../POC/TKGD-Automation/inputs/mail-outlook'),
        path.resolve(__dirname, '../../../../../POC/TKGD-Automation/inputs/mail-outlook'),
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

          emailList.push({
            messageId: `sample_${dirName}_${todayStr.replace(/-/g, '')}`,
            subject,
            senderEmail,
            senderName: 'TVKD Gia Cát Lợi',
            receivedDateTime: new Date(),
            bodyRawText: bodyText,
            attachments: [],
          });
        }
      }
    }

    // 3. Bóc tách nội dung email và lưu vào MongoDB
    let processedCount = 0;
    for (const mail of emailList) {
      const parsed = parseAccountOpeningEmailBody(mail.bodyRawText);
      const baseCode = parsed.maTKGDFutures || (parsed.maTKGDACM ? parsed.maTKGDACM.replace(/-A$/i, '') : null);
      if (!baseCode) continue;

      const targetAccountCode = parsed.maTKGDFutures || parsed.maTKGDACM || baseCode;

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
            attachments: mail.attachments,
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
        await existingRecord.save();
      } else {
        await this.cleanRecordModel.create({
          batchDate: todayStr,
          maTVKD: parsed.maTVKD || baseCode.substring(0, 3),
          maTKGD: targetAccountCode,
          maTKGDBase: baseCode,
          noiDungMail: noiDungMailData as any,
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

    if (!username || !password) {
      throw new Error('Chưa cấu hình thông tin tài khoản M-System hoặc mật khẩu trong Tab Cài Đặt!');
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
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    let scrapedCount = 0;
    const todayStr = options?.batchDate || new Date().toISOString().slice(0, 10);

    try {
      const context = await browser.newContext({
        viewport: { width: 1600, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(35000);

      // Đăng nhập M-System
      await page.goto('https://msadmin.mxv.com.vn/#/login', { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      await page.fill('input[type="text"], input[name="username"]', username);
      await page.fill('input[type="password"], input[name="password"]', password);
      await page.click('button[type="submit"], button.btn-primary');
      await page.waitForTimeout(2000);

      // Bấm mã PIN ảo
      const pinModal = page.locator('div.pincode');
      if (await pinModal.isVisible({ timeout: 5000 }).catch(() => false) && pin) {
        for (const digit of String(pin)) {
          const btn = page.locator('.pincode .keyboard .button').filter({ hasText: new RegExp(`^\\s*${digit}\\s*$`) }).first();
          if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await btn.click();
            await page.waitForTimeout(300);
          }
        }
        await page.waitForTimeout(3000);
      }

      // Cào chi tiết từng tài khoản
      for (const code of codesToScrape) {
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
      }
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
