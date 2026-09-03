import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../schemas/tkgd-user-config.schema';
import { RawAccountMail, RawAccountMailDocument } from '../../schemas/raw-account-mail.schema';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../schemas/clean-account-record.schema';
import { SystemSetting } from '../../schemas/system-setting.schema';
import { encrypt, decrypt } from '../bot-engine/utils/crypto';
import { chromium } from 'playwright-core';
import * as fs from 'fs';
import { scrapeInvestorDetailFromMSystem } from '../bot-engine/helpers/msystem-scraper.helper';
import { reconcileAndExportToExcel, ReconcileSummary } from '../bot-engine/helpers/tkgd-reconcile-exporter.helper';

function findBrowserExecutable(): string {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

@Injectable()
export class TkgdAutomationService {
  private readonly logger = new Logger(TkgdAutomationService.name);

  constructor(
    @InjectModel(TkgdUserConfig.name) private userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(RawAccountMail.name) private rawMailModel: Model<RawAccountMailDocument>,
    @InjectModel(CleanAccountRecord.name) private cleanRecordModel: Model<CleanAccountRecordDocument>,
    @InjectModel(SystemSetting.name) private systemSettingModel: Model<SystemSetting>,
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
      },
      storage: {
        windowsPath: config.storage?.windowsPath || 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD',
        linuxPath: config.storage?.linuxPath || '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
      },
      preferences: {
        autoHighlightExcel: config.preferences?.autoHighlightExcel ?? true,
        saveToAtlas: config.preferences?.saveToAtlas ?? true,
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
    if (dto.outlook?.refreshToken) {
      config.outlook.refreshToken = dto.outlook.refreshToken;
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

    await config.save();
    this.logger.log(`Đã lưu cấu hình TKGD cho user: ${userEmail}`);
    return { success: true, message: 'Đã lưu cấu hình thành công!' };
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
        for (const digit of String(pin)) {
          const digitEl = page.locator(`div.pincode >> xpath=.//div[text()='${digit}']`).first();
          if (await digitEl.isVisible({ timeout: 2000 }).catch(() => false)) {
            await digitEl.click();
            await page.waitForTimeout(250);
          }
        }
        const confirmBtn = page.locator('.ant-modal button:has-text("Xác nhận")').first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(2000);
        }
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
   * Lấy danh sách hồ sơ đối soát từ clean_account_records
   */
  async getRecords(limit: number = 20, skip: number = 0, filter?: string) {
    const query: any = {};
    if (filter === 'KHOP') {
      query['ketLuan.trangThai'] = 'KHOP';
    } else if (filter === 'LECH') {
      query['ketLuan.trangThai'] = { $ne: 'KHOP' };
    } else if (['FUTURES', 'ACM', 'LME', 'SPREAD'].includes(filter || '')) {
      query['accountType'] = filter;
    }


    const [items, total] = await Promise.all([
      this.cleanRecordModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.cleanRecordModel.countDocuments(query),
    ]);

    return { items, total };
  }

  /**
   * Kích hoạt chạy đối soát chéo và xuất file Excel
   */
  async runReconciliation(userEmail: string) {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    const records = await this.cleanRecordModel.find().sort({ createdAt: -1 }).limit(50);

    const summary: ReconcileSummary = await reconcileAndExportToExcel(records, {
      outputPath: config?.storage?.windowsPath
        ? `${config.storage.windowsPath}\\Auto_Data_mail_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`
        : undefined,
    });

    return {
      success: true,
      summary,
    };
  }
}
