import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { chromium } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../../schemas/tkgd-user-config.schema';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../../schemas/clean-account-record.schema';
import { TkgdExtractionLog, TkgdExtractionLogDocument } from '../../../schemas/tkgd-extraction-log.schema';
import { scrapeInvestorDetailFromMSystem } from '../../engine-helpers/msystem-scraper.helper';
import { getTkgdAttachmentDirectory } from '../../engine-helpers/tkgd-reconcile-exporter.helper';
import { decrypt } from '../../engine-helpers/crypto';
import { evaluateRecordReconciliationRule } from '../../engine-helpers/tkgd-reconcile-rules.helper';

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
    @InjectModel(TkgdExtractionLog.name) private readonly extractionLogModel: Model<TkgdExtractionLogDocument>,
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
    options?: {
      investorCode?: string;
      investorCodes?: string[];
      downloadImages?: boolean;
      batchDate?: string;
      mode?: 'REALTIME' | 'HEALING';
      limit?: number;
      maTVKD?: string;
    },
  ) {
    let query: any;
    let sortBy: any = { createdAt: -1, batchDate: -1 };
    let limitCount = options?.limit || 50;

    if (options?.investorCode) {
      query = { $or: [{ maTKGD: options.investorCode }, { maTKGDBase: options.investorCode }] };
      limitCount = 1;
    } else if (options?.investorCodes?.length) {
      query = { $or: [{ maTKGD: { $in: options.investorCodes } }, { maTKGDBase: { $in: options.investorCodes } }] };
      limitCount = options.investorCodes.length;
    } else if (options?.mode === 'HEALING') {
      // LUỒNG B: HEALING QUEUE — Quét lại các hồ sơ LECH/CAN_KIEM_TRA cũ đã có MS data
      query = {
        'ketLuan.trangThai': { $in: ['LECH', 'CAN_KIEM_TRA'] },
        // 'ms.isFoundOnMS': true,
        'ms.hoVaTen': { $exists: true, $ne: '' },
        'manualReview.isOverridden': { $ne: true },
      };
      if (options?.maTVKD) {
        query.maTVKD = options.maTVKD;
      }
      sortBy = { 'ketLuan.reconciledAt': 1, createdAt: 1 };
      limitCount = options?.limit || 20;
    } else {
      // LUỒNG A: REALTIME / FRESH MAILS (Mặc định)
      // Ưu tiên cao nhất cho hồ sơ mới nhận từ mail chưa có dữ liệu M-System
      query = {
        'ketLuan.trangThai': { $in: ['CHUA_XU_LY', 'LECH', 'CAN_KIEM_TRA'] },
        // 'ms.isFoundOnMS': { $ne: true },
        'ms.hoVaTen': { $in: [null, ''] },
        $or: [
          { 'ms.crawledAt': { $exists: false } },
          { 'ms.crawledAt': null },
          { 'ms.crawlAttempts': { $lt: 3 }, 'ms.crawledAt': { $lt: new Date(Date.now() - 30 * 60 * 1000) } },
        ],
      };
      if (options?.maTVKD) {
        query.maTVKD = options.maTVKD;
      }
      sortBy = { createdAt: -1, batchDate: -1 };
      limitCount = options?.limit || 50;
    }

    if (options?.batchDate) {
      query.batchDate = options.batchDate;
    }

    const records = await this.cleanRecordModel.find(query).sort(sortBy).limit(limitCount);
    if (!records || records.length === 0) {
      this.logger.log(`[TKGD-MS] Không có hồ sơ nào cần cào M-System (Mode: ${options?.mode || 'REALTIME'})`);
      return { success: true, processedCount: 0, results: [], message: 'Không có hồ sơ nào cần cào M-System' };
    }

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

        // Tự động đối soát và thẩm định kết luận ngay lập tức với dữ liệu vừa cào
        const updatedRecordData = {
          ...(typeof (record as any).toObject === 'function' ? (record as any).toObject() : record),
          ms: scraped,
        };
        const evalOutcome = evaluateRecordReconciliationRule(updatedRecordData);

        const attempts = ((record.ms as any)?.crawlAttempts || 0) + 1;
        const existingMs = (record.ms as any)?.toObject
          ? (record.ms as any).toObject()
          : ((record as any).ms || {});
        delete (existingMs as any).$__;
        delete (existingMs as any)._doc;
        delete (existingMs as any).$isDocument;

        const finalMs = {
          ...existingMs,
          ...scraped,
          crawledAt: new Date(),
          crawlAttempts: attempts,
        };

        const updateSet: any = {
          ms: finalMs,
          'ketLuan.trangThai': evalOutcome.finalStatus,
          'ketLuan.danhSachLoi': evalOutcome.finalErrors,
          'ketLuan.reconciledAt': new Date(),
        };

        if (attempts >= 3 && ['LECH', 'CAN_KIEM_TRA'].includes(evalOutcome.finalStatus)) {
          updateSet['ketLuan.needsManualReview'] = true;
        }

        try {
          const updateRes = await this.cleanRecordModel.updateOne(
            { _id: record._id },
            {
              $set: updateSet,
            },
          );
          this.logger.log(`[TKGD-MS] Đã lưu MS vào DB cho ${code}: hoVaTen="${scraped.hoVaTen || '---'}", cccd="${scraped.soCMND_HoChieu || '---'}", modifiedCount=${updateRes.modifiedCount}`);

          // Ghi vết vào bảng log riêng tkgd_extraction_logs để truy vết đầy đủ (Non-blocking)
          this.extractionLogModel.create({
            maTKGD: code,
            batchDate: record.batchDate || options?.batchDate,
            stage: 'SCRAPE_MSYSTEM',
            title: `Cào M-System: ${scraped.hoVaTen || scraped.tenTKGD || 'Không tìm thấy'} (${scraped.tenThanhVien || '---'})`,
            details: `Trạng thái: ${scraped.trangThai || '---'}, CMT: ${scraped.soCMND_HoChieu || '---'}, Ngày sinh: ${scraped.rawNgaySinh || '---'}, TVKD: ${scraped.tenThanhVien || '---'}`,
            status: scraped.hoVaTen || scraped.soCMND_HoChieu ? 'SUCCESS' : 'WARNING',
            extractedData: {
              tenThanhVien: scraped.tenThanhVien,
              tenMoiGioi: scraped.tenMoiGioi,
              tenTKGD: scraped.tenTKGD,
              hoVaTen: scraped.hoVaTen,
              soCMND_HoChieu: scraped.soCMND_HoChieu,
              ngaySinh: scraped.rawNgaySinh,
              ngayCap: scraped.rawNgayCap,
              noiCap: scraped.noiCap,
              diaChi: scraped.diaChi,
              trangThai: scraped.trangThai,
              chuKy: scraped.chuKy,
              evalStatus: evalOutcome.finalStatus,
              evalErrors: evalOutcome.finalErrors,
            },
            rawInputsLog: scraped.rawInputsLog || [],
            performer: 'MS_CRAWLER',
          }).catch((logErr: any) => {
            this.logger.warn(`[TKGD-LOG] Không thể lưu extraction log cho ${code}: ${logErr.message}`);
          });
        } catch (dbErr: any) {
          this.logger.error(`[TKGD-MS-ERROR] Lỗi khi lưu MS vào DB cho ${code}: ${dbErr.message}`, dbErr.stack);
        }
        results.push({ code, hoVaTen: scraped.hoVaTen, cccd: scraped.soCMND_HoChieu, status: evalOutcome.finalStatus });
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