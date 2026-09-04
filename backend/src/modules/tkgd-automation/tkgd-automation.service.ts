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
import { reconcileAndExportToExcel, ReconcileSummary } from '../bot-engine/helpers/tkgd-reconcile-exporter.helper';

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
}
