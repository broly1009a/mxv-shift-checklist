import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { chromium } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../../schemas/tkgd-user-config.schema';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../../schemas/clean-account-record.schema';
import { scrapeInvestorDetailFromMSystem } from '../../engine-helpers/msystem-scraper.helper';
import { getTkgdAttachmentDirectory } from '../../engine-helpers/tkgd-reconcile-exporter.helper';
import { decrypt } from '../../engine-helpers/crypto';

function findBrowserExecutable(): string | undefined {
  const candidates = process.platform === 'linux'
    ? ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']
    : [
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

@Injectable()
export class TkgdMsCrawlerService {
  private readonly logger = new Logger(TkgdMsCrawlerService.name);

  constructor(
    @InjectModel(TkgdUserConfig.name) private readonly userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(CleanAccountRecord.name) private readonly cleanRecordModel: Model<CleanAccountRecordDocument>,
  ) {}

  async testMSystemConnection(
    userEmail: string,
    testCreds?: { username?: string; password?: string; pin?: string },
  ) {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    const username = testCreds?.username || config?.msystem?.username;
    const password = testCreds?.password || (config?.msystem?.passwordEncrypted
      ? decrypt(config.msystem.passwordEncrypted)
      : '');

    if (!username || !password) {
      return { success: false, message: 'Thiếu thông tin tài khoản hoặc mật khẩu M-System!' };
    }

    const pin = testCreds?.pin || (config?.msystem?.pinEncrypted ? decrypt(config.msystem.pinEncrypted) : '');

    const executablePath = findBrowserExecutable();
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.goto('https://msadmin.mxv.com.vn/#/login', { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(1000);
      await page.waitForSelector("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", { state: 'visible', timeout: 15000 });
      await page.fill("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", username);
      await page.fill("input[name='password'], input[placeholder*='mật khẩu'], input[type='password']", password);
      await page.waitForTimeout(500);

      // Bấm nút Đăng nhập
      await page.click("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary");
      await page.waitForTimeout(2000);

      // Nhập PIN (chuẩn 100% test_ms_headless_download.js)
      const pinPad = page.locator('div.pincode');
      const hasPinPad = await pinPad.isVisible({ timeout: 4000 }).catch(() => false);
      if (hasPinPad && pin) {
        for (const digit of String(pin).split('')) {
          await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
          await page.waitForTimeout(250);
        }
        await page.waitForTimeout(2000);
      }

      await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => {});
      const loginFailed = page.url().includes('/login');
      return { success: !loginFailed, message: !loginFailed ? 'Kết nối M-System thành công.' : 'Đăng nhập M-System thất bại.' };
    } finally {
      await browser.close();
    }
  }


  async syncMSystemAccounts(
    userEmail: string,
    options?: { investorCode?: string; investorCodes?: string[]; downloadImages?: boolean; batchDate?: string },
  ) {
    const query: any = options?.investorCode
      ? { $or: [{ maTKGD: options.investorCode }, { maTKGDBase: options.investorCode }] }
      : options?.investorCodes?.length
        ? { $or: [{ maTKGD: { $in: options.investorCodes } }, { maTKGDBase: { $in: options.investorCodes } }] }
        : { 'ketLuan.trangThai': { $in: ['CHUA_XU_LY', 'LECH', 'CAN_KIEM_TRA'] } };
    if (options?.batchDate) query.batchDate = options.batchDate;

    const records = await this.cleanRecordModel.find(query).limit(100);
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    const executablePath = findBrowserExecutable();
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    const credentials = config?.msystem;
    try {
      if (!credentials?.username || !credentials.passwordEncrypted) {
        throw new Error('Chưa cấu hình tài khoản M-System cho user.');
      }
      await page.goto('https://msadmin.mxv.com.vn/#/login', { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(1000);
      await page.waitForSelector("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", { state: 'visible', timeout: 15000 });
      await page.fill("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", credentials.username);
      await page.fill("input[name='password'], input[placeholder*='mật khẩu'], input[type='password']", decrypt(credentials.passwordEncrypted));
      await page.waitForTimeout(500);

      // Bấm nút Đăng nhập
      await page.click("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary");
      await page.waitForTimeout(2000);

      // Nhập PIN (chuẩn 100% test_ms_headless_download.js)
      const pin = credentials.pinEncrypted ? decrypt(credentials.pinEncrypted) : '';
      const pinPad = page.locator('div.pincode');
      const hasPinPad = await pinPad.isVisible({ timeout: 4000 }).catch(() => false);
      if (hasPinPad && pin) {
        this.logger.log(`[TKGD-MS] Phát hiện bàn phím PIN ảo -> Đang nhập mã PIN (${pin.length} số)...`);
        for (const digit of String(pin).split('')) {
          await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
          await page.waitForTimeout(250);
        }
        await page.waitForTimeout(2000);
      }

      // Chờ URL chuyển sang Dashboard sau khi đăng nhập xong
      await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => {});

      // Fail-Fast: nếu vẫn còn ở trang login → dừng ngay, không quét dữ liệu rỗng
      if (page.url().includes('/login')) {
        const errorMsg = await page.locator('text=/sai|lỗi|invalid|error/i').first().textContent().catch(() => '');
        throw new Error(`Đăng nhập M-System thất bại! URL vẫn ở trang Login. ${errorMsg ? `(${errorMsg.trim()})` : 'Vui lòng kiểm tra lại tài khoản, mật khẩu hoặc mã PIN.'}`);
      }


      const results: any[] = [];
      for (const record of records) {
        const code = record.maTKGDBase || record.maTKGD || '';
        if (!code) continue;
        const saveDir = options?.downloadImages === false
          ? undefined
          : getTkgdAttachmentDirectory(config?.documentProcessing?.attachmentSavePath, options?.batchDate || record.batchDate, code);
        const scraped = await scrapeInvestorDetailFromMSystem(page, code, 'https://msadmin.mxv.com.vn', saveDir);
        await this.cleanRecordModel.updateOne({ _id: record._id }, { $set: { ms: scraped } });
        results.push({ code, isFoundOnMS: scraped.isFoundOnMS });
      }
      return { success: true, processedCount: results.length, results };
    } finally {
      await browser.close();
    }
  }

  async bulkSyncMSystem(accountCodes: string[], userEmail: string) {
    return this.syncMSystemAccounts(userEmail, { investorCodes: accountCodes });
  }
}