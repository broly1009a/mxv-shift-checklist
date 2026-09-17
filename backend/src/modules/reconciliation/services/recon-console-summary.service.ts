import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { chromium } from 'playwright-core';
import { BotJob } from '../../../schemas/bot-job.schema';
import { ShiftLog } from '../../../schemas/shift-log.schema';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { ShiftsService } from '../../shifts/shifts.service';
import { BotJobQueueService } from '../../bot-engine/bot-job-queue.service';
import { CcpCeDownloaderService } from '../../bot-engine/ccp-ce-downloader.service';
import { TelegramService } from '../../telegram/telegram.service';
import { findBotTasksInShift } from '../../bot-engine/constants/bot-task-registry';
import { resolveStoragePathCrossPlatform } from '../../bot-engine/helpers/bot-path.helper';
import { decrypt } from '../../bot-engine/utils/crypto';
import {
  findHeaderIndex,
  findLatestFile,
  getCcpBackupBasePath,
  resolveCcpDailyPath,
} from '../helpers/recon-number-parser.helper';

@Injectable()
export class ReconConsoleSummaryService {
  private readonly logger = new Logger(ReconConsoleSummaryService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly telegramService: TelegramService,
    @Optional() @InjectModel(BotJob.name)
    private readonly botJobModel?: Model<BotJob>,
    @Optional() @InjectModel(ShiftLog.name)
    private readonly shiftLogModel?: Model<ShiftLog>,
    @Optional() @Inject(forwardRef(() => BotJobQueueService))
    private readonly botJobQueueService?: BotJobQueueService,
    @Optional() @Inject(forwardRef(() => ShiftsService))
    private readonly shiftsService?: ShiftsService,
    @Optional() @Inject(forwardRef(() => CcpCeDownloaderService))
    private readonly ccpCeDownloaderService?: CcpCeDownloaderService,
  ) {}

  /**
   * Helper to retrieve Chrome executable path.
   */
  private getChromeExecutablePath(): string | null {
    const bundledPath = path.join(
      process.cwd(),
      '..',
      'it-tool-src',
      'operate-transaction-app',
      'Chrome',
      'chrome-win',
      'chrome.exe',
    );

    if (fs.existsSync(bundledPath)) {
      this.logger.log(`Using bundled Chrome binary at: ${bundledPath}`);
      return bundledPath;
    }

    this.logger.warn(
      `Bundled Chrome binary not found at ${bundledPath}. Falling back to default playwright launch.`,
    );
    return null;
  }

  /**
   * Tự động đăng nhập M-System và đồng bộ tỷ giá USD/VND hiện tại
   */
  async syncUsdRateFromMSystem(): Promise<number> {
    this.logger.log('Khởi động bot đồng bộ tỷ giá USD từ M-System...');

    let msUrl = 'https://msadmin.mxv.com.vn/';
    let msUser = process.env.MS_USER || '';
    let msPass = process.env.MS_PASSWORD || '';
    let msPin = process.env.MS_PIN || '';

    const credentialsRaw = await this.settingsService.getSetting(
      'bot_credentials_msystem',
      '',
    );
    if (credentialsRaw) {
      try {
        const credentials = JSON.parse(decrypt(credentialsRaw));
        if (credentials.url) msUrl = credentials.url;
        if (credentials.username) msUser = credentials.username;
        if (credentials.password) msPass = credentials.password;
        if (credentials.pin) msPin = credentials.pin;
      } catch {
        this.logger.warn(
          'Không thể giải mã cấu hình M-System từ DB, dùng biến môi trường.',
        );
      }
    }

    if (!msUser || !msPass || !msPin) {
      throw new Error(
        'Cấu hình tài khoản M-System không đầy đủ (username, password, pin). Vui lòng cấu hình qua Admin UI hoặc file .env',
      );
    }

    const chromePath = this.getChromeExecutablePath();
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    if (chromePath) {
      launchOptions.executablePath = chromePath;
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    try {
      this.logger.log(`Đi tới trang M-System: ${msUrl}...`);
      await page.goto(msUrl);
      await page.waitForTimeout(2000);

      this.logger.log('Nhập tài khoản và mật khẩu...');
      await page.waitForSelector('input[name="username"]', {
        state: 'visible',
      });
      await page.fill('input[name="username"]', msUser);
      await page.fill('input[name="password"]', msPass);
      await page.waitForTimeout(500);

      this.logger.log('Nhấn nút Đăng nhập...');
      await page.click('button.btn-primary');
      await page.waitForTimeout(2000);

      this.logger.log('Đang đợi bảng nhập mã PIN ảo hiển thị...');
      let pinSelectorVisible = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        pinSelectorVisible = await page
          .locator('div.pincode')
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (pinSelectorVisible) break;
        this.logger.warn(
          `Chưa hiển thị bảng PIN (lần thử ${attempt}), thử click lại nút Đăng nhập...`,
        );
        await page.click('button.btn-primary').catch(() => {});
        await page.waitForTimeout(2000);
      }

      await page.waitForSelector('div.pincode', {
        state: 'visible',
        timeout: 10000,
      });
      this.logger.log('Đang tự động click mã PIN ảo...');
      const pinDigits = msPin.split('');
      for (const digit of pinDigits) {
        const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
        await page.waitForSelector(digitSelector, { state: 'visible' });
        await page.click(digitSelector);
        await page.waitForTimeout(500);
      }

      this.logger.log('Xác thực đăng nhập...');
      await page
        .waitForURL(/.*dashboard.*/, { timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(3000);
      this.logger.log(
        '🎉 Đăng nhập M-System thành công! Đang chuyển hướng tới trang tỷ giá...',
      );

      const exchangeRateUrl = `${msUrl.split('#')[0]}#/currencyManagement/exchangeRate`;
      await page.goto(exchangeRateUrl);
      await page.waitForTimeout(5000); // Đợi bảng tải dữ liệu

      // Trích xuất toàn bộ bảng tỷ giá quy đổi
      const rates = await page.evaluate(() => {
        const result: Record<string, number> = {};
        // 1. Thử tìm theo cấu trúc ag-Grid (M-System dùng ag-Grid)
        const agRows = Array.from(document.querySelectorAll('[role="row"]'));
        for (const row of agRows) {
          const baseCell = row.querySelector('[col-id="monetaryBase"]');
          const counterCell = row.querySelector('[col-id="counterCurrency"]');
          const rateCell = row.querySelector('[col-id="exchangeRate"]');

          if (baseCell && counterCell && rateCell) {
            const baseVal = (baseCell.textContent || '').trim().toUpperCase();
            const counterVal = (counterCell.textContent || '').trim().toUpperCase();
            const rateStr = (rateCell.textContent || '').trim().replace(/,/g, '');
            const rateVal = parseFloat(rateStr);
            if (counterVal === 'VND' && !isNaN(rateVal) && rateVal > 0) {
              result[baseVal] = rateVal;
            }
          }
        }
        if (Object.keys(result).length > 0) return result;

        // 2. Fallback sang cấu trúc table HTML thông thường
        const rows = Array.from(document.querySelectorAll('tr'));
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 4) {
            const baseCurrency = (
              cells[1].innerText ||
              cells[1].textContent ||
              ''
            ).trim().toUpperCase();
            const quoteCurrency = (
              cells[2].innerText ||
              cells[2].textContent ||
              ''
            ).trim().toUpperCase();
            const rateStr = (
              cells[3].innerText ||
              cells[3].textContent ||
              ''
            ).trim().replace(/,/g, '');
            const rateVal = parseFloat(rateStr);
            if (quoteCurrency === 'VND' && !isNaN(rateVal) && rateVal > 0) {
              result[baseCurrency] = rateVal;
            }
          }
        }
        return result;
      });

      const usdRate = rates['USD'] || 0;
      if (usdRate <= 0) {
        throw new Error(
          'Không tìm thấy dòng tỷ giá USD/VND trong bảng quản lý tỷ giá.',
        );
      }

      this.logger.log(
        `Tìm thấy tỷ giá từ M-System: USD=${usdRate}, MYR=${rates['MYR'] || 'N/A'}, RMB=${rates['RMB'] || 'N/A'}, JPY=${rates['JPY'] || 'N/A'}. Đang cập nhật hệ thống...`,
      );

      await this.settingsService.setSetting(
        'usd_exchange_rate',
        usdRate.toString(),
      );
      if (rates['MYR']) {
        await this.settingsService.setSetting('myr_exchange_rate', rates['MYR'].toString());
      }
      if (rates['JPY']) {
        await this.settingsService.setSetting('jpy_exchange_rate', rates['JPY'].toString());
      }
      if (rates['RMB']) {
        await this.settingsService.setSetting('rmb_exchange_rate', rates['RMB'].toString());
      }
      await this.settingsService.setSetting('exchange_rates_last_synced', new Date().toISOString());

      return usdRate;
    } finally {
      await browser.close();
    }
  }

  async syncAllExchangeRatesFromMSystem(): Promise<Record<string, number>> {
    await this.syncUsdRateFromMSystem();
    const rates = await this.getCurrentExchangeRates();
    return {
      USD: rates.usdGain,
      MYR: rates.myrGain,
      JPY: rates.jpyGain,
      RMB: rates.rmbGain,
    };
  }

  async getCurrentExchangeRates(): Promise<{
    usdLoss: number;
    usdGain: number;
    myrLoss: number;
    myrGain: number;
    jpyLoss: number;
    jpyGain: number;
    rmbLoss: number;
    rmbGain: number;
  }> {
    const usdStr = await this.settingsService.getSetting('usd_exchange_rate', '25920');
    const myrStr = await this.settingsService.getSetting('myr_exchange_rate', '6383');
    const jpyStr = await this.settingsService.getSetting('jpy_exchange_rate', '170');
    const rmbStr = await this.settingsService.getSetting('rmb_exchange_rate', '3871');

    const usd = parseFloat(usdStr) || 25920;
    const myr = parseFloat(myrStr) || 6383;
    const jpy = parseFloat(jpyStr) || 170;
    const rmb = parseFloat(rmbStr) || 3871;

    return {
      usdLoss: usd,
      usdGain: usd,
      myrLoss: myr,
      myrGain: myr,
      jpyLoss: jpy,
      jpyGain: jpy,
      rmbLoss: rmb,
      rmbGain: rmb,
    };
  }

  async getCurrentUsdRate(): Promise<number> {
    const usdRateStr = await this.settingsService.getSetting(
      'usd_exchange_rate',
      '25920',
    );
    return parseFloat(usdRateStr) || 25920;
  }

  async saveUsdRate(rate: number): Promise<void> {
    const current = await this.getCurrentUsdRate();
    if (current !== rate) {
      this.logger.log(
        `Tỷ giá mới (${rate}) khác tỷ giá hiện tại (${current}). Đang cập nhật vào cấu hình...`,
      );
      await this.settingsService.setSetting(
        'usd_exchange_rate',
        rate.toString(),
      );
    }
  }

  /**
   * Tổng hợp dữ liệu hiển thị toàn diện cho Màn hình Trading Operation Console
   * Gom dữ liệu mới nhất từ bot_jobs (CHECK_KLGD, CHECK_PRE_EOD, SCAN_NEGATIVE_MARGIN)
   */
  async getConsoleSummary(dateStr?: string, jobId?: string): Promise<any> {
    const today = new Date();
    let targetDate = dateStr;
    if (!targetDate) {
      const vnTime = new Date(today.getTime() + 7 * 3600 * 1000);
      targetDate = vnTime.toISOString().split('T')[0];
    }

    const parts = targetDate.split('-');
    const [y, m, d] = parts.length === 3 ? parts : ['', '', ''];
    const slashDate = parts.length === 3 ? `${d}/${m}/${y}` : targetDate;

    // 1. Tìm ca trực: Quét tất cả ca của ngày đang chọn, ưu tiên ca đang MỞ (ACTIVE hoặc PENDING)
    let shiftLog: any = null;
    let taskKlgd: any = null;
    let taskPreEod: any = null;
    if (this.shiftLogModel) {
      const shiftsForDay = await this.shiftLogModel
        .find({
          $or: [
            { shiftDate: targetDate },
            { shiftDate: slashDate },
          ],
        })
        .populate('shiftSlotId')
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      const openShifts = shiftsForDay.filter(
        (s: any) => s.status === 'ACTIVE' || s.status === 'PENDING',
      );

      // Tính giờ hiện tại (GMT+7) để ưu tiên ca khớp khung giờ nhất
      const now = new Date();
      const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const nowMinutes = vnTime.getUTCHours() * 60 + vnTime.getUTCMinutes();

      const isShiftCoveringNow = (shift: any): boolean => {
        const slot = shift.shiftSlotId;
        if (!slot || !slot.startTime || !slot.endTime) return false;
        const [sH, sM] = String(slot.startTime).split(':').map(Number);
        const startMin = sH * 60 + sM;
        const [eH, eM] = String(slot.endTime).split(':').map(Number);
        const endMin = eH * 60 + eM;

        if (slot.isOvernight || startMin > endMin) {
          return nowMinutes >= startMin || nowMinutes <= endMin;
        }
        return nowMinutes >= startMin && nowMinutes <= endMin;
      };

      // Ưu tiên ca đang mở (nếu nhiều ca mở cùng lúc, ưu tiên ca bao phủ khung giờ hiện tại)
      if (openShifts.length > 0) {
        shiftLog = openShifts.find(isShiftCoveringNow) || openShifts[0];
      } else if (shiftsForDay.length > 0) {
        shiftLog = shiftsForDay[0];
      } else if (!dateStr) {
        shiftLog = await this.shiftLogModel
          .findOne({ status: { $in: ['ACTIVE', 'PENDING'] } })
          .populate('shiftSlotId')
          .sort({ createdAt: -1 })
          .lean()
          .exec();
      }

      // Tìm task KLGD và Pre-EOD:
      // 1. Ưu tiên tìm trong ca hiện tại (shiftLog)
      if (shiftLog && shiftLog.details) {
        const { subTask: subKlgd, parentTask: parentKlgd } = findBotTasksInShift(
          shiftLog.details,
          'CHECK_KLGD',
        );
        taskKlgd = subKlgd || parentKlgd;

        const { subTask: subPreEod, parentTask: parentPreEod } = findBotTasksInShift(
          shiftLog.details,
          'CHECK_PRE_EOD',
        );
        taskPreEod = subPreEod || parentPreEod;
      }

      // 2. Nếu ca hiện tại không chứa task tương ứng, tìm trong các ca khác của ngày đó
      if (!taskKlgd) {
        for (const s of shiftsForDay) {
          const { subTask, parentTask } = findBotTasksInShift(s.details || [], 'CHECK_KLGD');
          if (subTask || parentTask) {
            taskKlgd = subTask || parentTask;
            break;
          }
        }
      }
      if (!taskPreEod) {
        for (const s of shiftsForDay) {
          const { subTask, parentTask } = findBotTasksInShift(s.details || [], 'CHECK_PRE_EOD');
          if (subTask || parentTask) {
            taskPreEod = subTask || parentTask;
            break;
          }
        }
      }
    }

    // 2. Lấy 4 job mới nhất từ collection bot_jobs (Bao gồm cả CHECK_CQG_SYNC độc lập)
    let klgdJob: any = null;
    let preEodJob: any = null;
    let marginJob: any = null;
    let cqgSyncJob: any = null;
    let ccpDownloadJob: any = null;
    let ccpCheckJob: any = null;

    let runs: any[] = [];

    if (this.botJobModel) {
      const klgdPromise = jobId
        ? this.botJobModel.findById(jobId).lean().exec()
        : this.botJobModel.findOne({ jobType: 'CHECK_KLGD' }).sort({ createdAt: -1 }).lean().exec();

      const dayStartVN = new Date(`${targetDate}T00:00:00.000+07:00`);
      const dayEndVN = new Date(`${targetDate}T23:59:59.999+07:00`);
      const dayStartUTC = new Date(`${targetDate}T00:00:00.000Z`);
      const dayEndUTC = new Date(`${targetDate}T23:59:59.999Z`);
      const minDate = new Date(Math.min(dayStartVN.getTime(), dayStartUTC.getTime()));
      const maxDate = new Date(Math.max(dayEndVN.getTime(), dayEndUTC.getTime()));

      const pastRunsPromise = this.botJobModel
        .find({
          jobType: { $in: ['CHECK_KLGD', 'CHECK_PRE_EOD'] },
          $or: [
            { createdAt: { $gte: minDate, $lte: maxDate } },
            { 'payload.targetDate': { $in: [targetDate, slashDate] } },
            { 'payload.sessionDay': { $in: [targetDate, slashDate] } },
            { 'payload.shiftDate': { $in: [targetDate, slashDate] } },
            { 'payload.date': { $in: [targetDate, slashDate] } },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec();

      const [loadedKlgd, loadedPreEod, loadedMargin, loadedCqgSync, loadedCcpDl, loadedCcpCheck, loadedPastRuns] =
        await Promise.all([
          klgdPromise,
          this.botJobModel.findOne({ jobType: 'CHECK_PRE_EOD' }).sort({ createdAt: -1 }).lean().exec(),
          this.botJobModel
            .findOne({
              jobType: {
                $in: ['SCAN_NEGATIVE_MARGIN', 'CHECK_MARGIN_DECISION', 'CHECK_EOD_MM'],
              },
            })
            .sort({ createdAt: -1 })
            .lean()
            .exec(),
          this.botJobModel.findOne({ jobType: 'CHECK_CQG_SYNC' }).sort({ createdAt: -1 }).lean().exec(),
          this.botJobModel.findOne({ jobType: 'DOWNLOAD_CCP_REPORT' }).sort({ createdAt: -1 }).lean().exec(),
          this.botJobModel.findOne({ jobType: 'CHECK_EOD_CCP' }).sort({ createdAt: -1 }).lean().exec(),
          pastRunsPromise,
        ]);

      klgdJob = loadedKlgd;
      preEodJob = loadedPreEod;
      marginJob = loadedMargin;
      cqgSyncJob = loadedCqgSync;
      ccpDownloadJob = loadedCcpDl;
      ccpCheckJob = loadedCcpCheck;

      if (Array.isArray(loadedPastRuns)) {
        runs = loadedPastRuns.map((j: any) => {
          const payload = j.payload
            ? typeof j.payload.toObject === 'function'
              ? j.payload.toObject()
              : j.payload
            : {};
          const res = payload.result || {};
          const totals = res.totals || {};
          const created = new Date(j.createdAt);
          const vnDate = new Date(created.getTime() + 7 * 3600 * 1000);
          const timeStr = `${String(vnDate.getUTCHours()).padStart(2, '0')}:${String(vnDate.getUTCMinutes()).padStart(2, '0')}`;
          const dateStrFormatted = `${String(vnDate.getUTCDate()).padStart(2, '0')}/${String(vnDate.getUTCMonth() + 1).padStart(2, '0')}`;
          const differ = totals.differ || 0;
          const differACM = totals.differACM || 0;
          const hasDiscrepancy = differ !== 0 || differACM !== 0;

          return {
            id: String(j._id || j.jobId),
            jobId: String(j._id || j.jobId),
            time: timeStr,
            label: `${dateStrFormatted} ${timeStr}`,
            createdAt: j.createdAt,
            status: j.status,
            hasDiscrepancy,
            totals: {
              dsgd: totals.totalDSGD || 0,
              fr: totals.totalFR || 0,
              acm: totals.totalACM || 0,
              nano: totals.totalNano || 0,
              ccp: totals.totalCCP_DSGD || 0,
            },
          };
        });
      }

      // Đảm bảo klgdJob hiện tại luôn có trong runs nếu chưa có
      if (klgdJob && !runs.some((r) => r.id === String(klgdJob._id || klgdJob.jobId))) {
        const payload = klgdJob.payload
          ? typeof klgdJob.payload.toObject === 'function'
            ? klgdJob.payload.toObject()
            : klgdJob.payload
          : {};
        const res = payload.result || {};
        const totals = res.totals || {};
        const created = new Date(klgdJob.createdAt || Date.now());
        const vnDate = new Date(created.getTime() + 7 * 3600 * 1000);
        const timeStr = `${String(vnDate.getUTCHours()).padStart(2, '0')}:${String(vnDate.getUTCMinutes()).padStart(2, '0')}`;
        const dateStrFormatted = `${String(vnDate.getUTCDate()).padStart(2, '0')}/${String(vnDate.getUTCMonth() + 1).padStart(2, '0')}`;
        const differ = totals.differ || 0;
        const differACM = totals.differACM || 0;
        const hasDiscrepancy = differ !== 0 || differACM !== 0;

        runs.unshift({
          id: String(klgdJob._id || klgdJob.jobId),
          jobId: String(klgdJob._id || klgdJob.jobId),
          time: timeStr,
          label: `${dateStrFormatted} ${timeStr}`,
          createdAt: klgdJob.createdAt || new Date(),
          status: klgdJob.status || 'COMPLETED',
          hasDiscrepancy,
          totals: {
            dsgd: totals.totalDSGD || 0,
            fr: totals.totalFR || 0,
            acm: totals.totalACM || 0,
            nano: totals.totalNano || 0,
            ccp: totals.totalCCP_DSGD || 0,
          },
        });
      }
    }

    // 3. Xử lý Payload KLGD
    const klgdPayload = klgdJob?.payload || {};
    const klgdResult = klgdPayload.result || {};
    const klgdTotals = klgdResult.totals || {
      totalDSGD: 0,
      totalFR: 0,
      differ: 0,
      totalACM: 0,
      totalNano: 0,
      differACM: 0,
      totalTTM: 0,
      totalTTM_MS: 0,
      totalOP: 0,
      totalTTM_CQG: 0,
      totalACM_TTM: 0,
      totalTTM_ACM: 0,
      differTTM: 0,
      totalTTTT: 0,
      totalTTTT_MS: 0,
      totalPS: 0,
      totalPS_CQG: 0,
      totalACM_TTTT: 0,
      totalTTTT_ACM: 0,
      differTTTT: 0,
    };

    // 4. Xử lý Payload Pre-EOD
    const preEodPayload = preEodJob?.payload || {};
    const preEodResult = preEodPayload.result || {};
    const preEodTotals = preEodResult.totals || {
      totalACM_MS: 0,
      totalACM_Straits: 0,
      differACM: 0,
      totalCQG_MS: 0,
      totalCQG_FR: 0,
      differCQG: 0,
    };

    // 5. Xử lý Payload Margin
    const marginPayload = marginJob?.payload || {};
    const marginResult = marginPayload.result || {};

    const rawNegativeIMR: string[] =
      marginResult.negativeIMRAcc && marginResult.negativeIMRAcc.length > 0
        ? marginResult.negativeIMRAcc
        : marginResult.eodResult?.negativeIMRAcc && marginResult.eodResult.negativeIMRAcc.length > 0
          ? marginResult.eodResult.negativeIMRAcc
          : preEodResult.eodResult?.negativeIMRAcc || [];

    const rawNegativeBalance: string[] =
      marginResult.negativeBalanceAccs && marginResult.negativeBalanceAccs.length > 0
        ? marginResult.negativeBalanceAccs
        : marginResult.eodResult?.negativeBalanceAccs && marginResult.eodResult.negativeBalanceAccs.length > 0
          ? marginResult.eodResult.negativeBalanceAccs
          : preEodResult.eodResult?.negativeBalanceAccs || [];

    // 6. Tính toán đếm ngược chu kỳ 60 phút
    const frequencyMinutes = taskKlgd?.frequencyMinutesSnapshot || 60;
    const lastCheckedTime =
      taskKlgd?.checkedAt || taskKlgd?.updatedAt || klgdJob?.createdAt;
    let nextScanInSeconds = 0;
    if (lastCheckedTime) {
      const elapsedSeconds = Math.floor(
        (Date.now() - new Date(lastCheckedTime).getTime()) / 1000,
      );
      const totalFrequencySeconds = frequencyMinutes * 60;
      nextScanInSeconds = Math.max(0, totalFrequencySeconds - elapsedSeconds);
    } else {
      nextScanInSeconds = frequencyMinutes * 60;
    }

    // 7. Quét thư mục và file CCP của ngày đang chọn
    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const subFolder = path.join(y, `T${m}.${y}`, `${d}.${m}`);
    const ccpDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);
    const ccpFilesPresent = {
      qltkgd: false,
      qltkgdName: '',
      qltkgdSize: 0,
      eod: false,
      eodName: '',
      eodSize: 0,
      nr: false,
      nrName: '',
      nrSize: 0,
      tttt: false,
      ttttName: '',
      ttttSize: 0,
    };

    if (fs.existsSync(ccpDailyPath)) {
      const qltkgdFile = findLatestFile(ccpDailyPath, /qltkgd|qltttkgd/i);
      const eodFile = findLatestFile(ccpDailyPath, /eod/i);
      const nrFile = findLatestFile(ccpDailyPath, /nr/i);
      const ttttFile = findLatestFile(ccpDailyPath, /tttt/i);

      if (qltkgdFile && fs.existsSync(qltkgdFile)) {
        try {
          const stat = fs.statSync(qltkgdFile);
          ccpFilesPresent.qltkgd = true;
          ccpFilesPresent.qltkgdName = path.basename(qltkgdFile);
          ccpFilesPresent.qltkgdSize = stat.size;
        } catch {}
      }
      if (eodFile && fs.existsSync(eodFile)) {
        try {
          const stat = fs.statSync(eodFile);
          ccpFilesPresent.eod = true;
          ccpFilesPresent.eodName = path.basename(eodFile);
          ccpFilesPresent.eodSize = stat.size;
        } catch {}
      }
      if (nrFile && fs.existsSync(nrFile)) {
        try {
          const stat = fs.statSync(nrFile);
          ccpFilesPresent.nr = true;
          ccpFilesPresent.nrName = path.basename(nrFile);
          ccpFilesPresent.nrSize = stat.size;
        } catch {}
      }
      if (ttttFile && fs.existsSync(ttttFile)) {
        try {
          const stat = fs.statSync(ttttFile);
          ccpFilesPresent.tttt = true;
          ccpFilesPresent.ttttName = path.basename(ttttFile);
          ccpFilesPresent.ttttSize = stat.size;
        } catch {}
      }
    }

    const ccpCheckResult = ccpCheckJob?.payload?.result || {};
    const ccpMismatchedAccounts = ccpCheckResult?.mismatchedEOD || [];

    const latestRunId = runs.length > 0 ? runs[0].id : null;
    const isViewingHistorical = !!(jobId && latestRunId && jobId !== latestRunId);

    return {
      date: targetDate,
      selectedJobId: jobId || latestRunId,
      isViewingHistorical,
      currentShift: {
        id: shiftLog?._id?.toString() || null,
        name: shiftLog?.shiftSlotId?.slotName || 'Chưa mở ca trực',
        type: shiftLog?.shiftSlotId?.slotType || 'UNKNOWN',
        status: shiftLog?.status || 'OFF',
        startTime: shiftLog?.shiftSlotId?.startTime || '07:00',
        endTime: shiftLog?.shiftSlotId?.endTime || '15:00',
      },
      runs,
      schedule: {
        frequencyMinutes,
        nextScanInSeconds,
        lastExecutedAt: lastCheckedTime
          ? new Date(lastCheckedTime).toISOString()
          : null,
      },
      intraday: {
        jobId: klgdJob?._id?.toString() || null,
        status: klgdJob?.status || (taskKlgd ? taskKlgd.status : 'IDLE'),
        executedAt: klgdJob?.createdAt
          ? new Date(klgdJob.createdAt).toISOString()
          : null,
        msVolume: klgdTotals.totalDSGD,
        cqgVolume: klgdTotals.totalFR,
        acmVolume: klgdTotals.totalACM,
        nanoVolume: klgdTotals.totalNano,
        differ: klgdTotals.differ,
        differACM: klgdTotals.differACM,
        totalTTM: klgdTotals.totalTTM,
        totalTTM_MS: klgdTotals.totalTTM_MS,
        totalOP: klgdTotals.totalOP,
        totalTTM_CQG: klgdTotals.totalTTM_CQG,
        totalACM_TTM: klgdTotals.totalACM_TTM,
        totalTTM_ACM: klgdTotals.totalTTM_ACM,
        differTTM: klgdTotals.differTTM,
        totalTTTT: klgdTotals.totalTTTT,
        totalTTTT_MS: klgdTotals.totalTTTT_MS,
        totalPS: klgdTotals.totalPS,
        totalPS_CQG: klgdTotals.totalPS_CQG,
        totalACM_TTTT: klgdTotals.totalACM_TTTT,
        totalTTTT_ACM: klgdTotals.totalTTTT_ACM,
        differTTTT: klgdTotals.differTTTT,
        mismatchedTradesCount: (klgdResult.mismatchedTrades || []).length,
        mismatchedTrades: klgdResult.mismatchedTrades || [],
        mismatchedTTM: klgdResult.mismatchedTTM || [],
        mismatchedTTTT: klgdResult.mismatchedTTTT || [],
      },
      preEod: {
        jobId: preEodJob?._id?.toString() || null,
        status: preEodJob?.status || (taskPreEod ? taskPreEod.status : 'IDLE'),
        executedAt: preEodJob?.createdAt
          ? new Date(preEodJob.createdAt).toISOString()
          : null,
        acm: {
          msVolume: preEodTotals.totalACM_MS,
          straitsVolume: preEodTotals.totalACM_Straits,
          differ: preEodTotals.differACM,
        },
        cqg: {
          msVolume: preEodTotals.totalCQG_MS,
          cqgVolume: preEodTotals.totalCQG_FR,
          differ: preEodTotals.differCQG,
        },
        mismatchedTradesCount: (preEodResult.mismatchedTrades || []).length,
        mismatchedTrades: preEodResult.mismatchedTrades || [],
        mismatchedPositionsCount: (preEodResult.mismatchedPositions || []).length,
        mismatchedPositions: preEodResult.mismatchedPositions || [],
        mismatchedEODCount: (
          marginResult.eodResult?.mismatchedEOD ||
          marginResult.mismatchedEOD ||
          preEodResult.eodResult?.mismatchedEOD ||
          preEodResult.mismatchedEOD ||
          []
        ).length,
        mismatchedEOD:
          marginResult.eodResult?.mismatchedEOD ||
          marginResult.mismatchedEOD ||
          preEodResult.eodResult?.mismatchedEOD ||
          preEodResult.mismatchedEOD ||
          [],
        cqgResultCount: (
          cqgSyncJob?.payload?.result?.cqgResult ||
          marginResult.cqgResult ||
          preEodResult.cqgResult ||
          []
        ).length,
        cqgResult:
          cqgSyncJob?.payload?.result?.cqgResult ||
          marginResult.cqgResult ||
          preEodResult.cqgResult ||
          [],
      },
      negativeMargin: {
        jobId: marginJob?._id?.toString() || preEodJob?._id?.toString(),
        executedAt: (marginJob?.createdAt || preEodJob?.createdAt)
          ? new Date(marginJob?.createdAt || preEodJob?.createdAt).toISOString()
          : null,
        negativeIMRAccCount: rawNegativeIMR.length,
        negativeIMRAcc: rawNegativeIMR,
        negativeBalanceCount: rawNegativeBalance.length,
        negativeBalanceAccs: rawNegativeBalance,
      },
      ccpSummary: {
        downloadJob: {
          jobId: ccpDownloadJob?._id?.toString(),
          status: ccpDownloadJob?.status || 'IDLE',
          logs: ccpDownloadJob?.logs || [],
          executedAt: ccpDownloadJob?.createdAt
            ? new Date(ccpDownloadJob.createdAt).toISOString()
            : null,
        },
        checkJob: {
          jobId: ccpCheckJob?._id?.toString(),
          status: ccpCheckJob?.status || 'IDLE',
          logs: ccpCheckJob?.logs || [],
          executedAt: ccpCheckJob?.createdAt
            ? new Date(ccpCheckJob.createdAt).toISOString()
            : null,
        },
        filesPresent: ccpFilesPresent,
        folderPath: ccpDailyPath,
        totals: {
          totalAccounts: ccpCheckResult?.totalAccounts || 0,
          totalNegative:
            (ccpCheckResult?.negativeBalanceAccs?.length || 0) +
            (ccpCheckResult?.negativeIMRAcc?.length || 0),
          totalMismatched: ccpMismatchedAccounts.length,
        },
        mismatchedAccounts: ccpMismatchedAccounts,
        negativeBalanceAccs: ccpCheckResult?.negativeBalanceAccs || [],
        negativeIMRAcc: ccpCheckResult?.negativeIMRAcc || [],
      },
    };
  }

  /**
   * Kích hoạt chạy lại đối chiếu ngay lập tức (Phá vỡ Cooldown 60 phút)
   */
  async triggerConsoleRun(
    dateStr?: string,
    jobType: string = 'CHECK_KLGD',
    options?: {
      checkKlgd?: boolean;
      checkTtm?: boolean;
      checkTttt?: boolean;
    },
  ): Promise<any> {
    if (!this.shiftLogModel || !this.botJobQueueService || !this.shiftsService) {
      throw new Error('Các phân hệ bot queue hoặc shift log chưa sẵn sàng');
    }

    let targetDate = dateStr;
    if (!targetDate) {
      const today = new Date();
      const vnTime = new Date(today.getTime() + 7 * 60 * 60 * 1000);
      targetDate = vnTime.toISOString().split('T')[0];
    }

    const parts = targetDate.split('-');
    const [y, m, d] = parts.length === 3 ? parts : ['', '', ''];
    const slashDate = parts.length === 3 ? `${d}/${m}/${y}` : targetDate;

    const targetJobType = (jobType === 'CHECK_CQG_SYNC')
      ? 'CHECK_CQG_SYNC'
      : (jobType === 'CHECK_EOD_CCP')
        ? 'CHECK_EOD_CCP'
        : (jobType === 'SCAN_NEGATIVE_MARGIN' || jobType === 'CHECK_EOD_MM')
          ? 'CHECK_EOD_MM'
          : (jobType || 'CHECK_KLGD');

    // 1. Quét tất cả các ca trực của ngày targetDate / slashDate
    const shiftsForDay = await this.shiftLogModel
      .find({
        $or: [
          { shiftDate: targetDate },
          { shiftDate: slashDate },
        ],
      })
      .populate('shiftSlotId')
      .sort({ createdAt: -1 })
      .exec();

    // 2. Lọc các ca đang MỞ (ACTIVE hoặc PENDING)
    const openShifts = shiftsForDay.filter(
      (s: any) => s.status === 'ACTIVE' || s.status === 'PENDING',
    );

    // Tính thời gian hiện tại theo phút (Giờ VN - GMT+7)
    const now = new Date();
    const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const nowMinutes = vnTime.getUTCHours() * 60 + vnTime.getUTCMinutes();

    const isShiftCoveringNow = (shift: any): boolean => {
      const slot = shift.shiftSlotId;
      if (!slot || !slot.startTime || !slot.endTime) return false;
      const [sH, sM] = String(slot.startTime).split(':').map(Number);
      const startMin = sH * 60 + sM;
      const [eH, eM] = String(slot.endTime).split(':').map(Number);
      const endMin = eH * 60 + eM;

      if (slot.isOvernight || startMin > endMin) {
        return nowMinutes >= startMin || nowMinutes <= endMin;
      }
      return nowMinutes >= startMin && nowMinutes <= endMin;
    };

    let targetShift: any = null;
    let subTask: any = null;
    let parentTask: any = null;

    // TẦNG 1: Ưu tiên ca đang MỞ
    if (openShifts.length > 0) {
      // 1.1 Tìm ca mở có chứa tác vụ targetJobType
      const candidateShifts = openShifts.filter((s: any) => {
        const found = findBotTasksInShift(s.details || [], targetJobType);
        return !!(found.subTask || found.parentTask);
      });

      if (candidateShifts.length === 1) {
        targetShift = candidateShifts[0];
      } else if (candidateShifts.length > 1) {
        // Nhiều ca mở chứa task: ưu tiên ca trùng khung giờ hiện tại
        targetShift = candidateShifts.find(isShiftCoveringNow) || candidateShifts[0];
      } else {
        // Không có ca mở nào chứa task: lấy ca mở trùng khung giờ hiện tại hoặc ca mở mới nhất
        targetShift = openShifts.find(isShiftCoveringNow) || openShifts[0];
      }

      if (targetShift) {
        const found = findBotTasksInShift(targetShift.details || [], targetJobType);
        subTask = found.subTask;
        parentTask = found.parentTask;
      }
    }

    // TẦNG 2: Nếu KHÔNG CÓ ca nào mở (toàn bộ ca của ngày đã COMPLETED):
    // Người dùng chạy đối chiếu hồi tố ngoài ca hoặc xem lại
    // -> Chạy ở chế độ Standalone (shiftLogId = null) để Queue Guard không hủy nhầm!
    if (!targetShift && shiftsForDay.length > 0) {
      const closedShiftWithTask = shiftsForDay.find((s: any) => {
        const found = findBotTasksInShift(s.details || [], targetJobType);
        return !!(found.subTask || found.parentTask);
      });
      if (closedShiftWithTask) {
        const found = findBotTasksInShift(closedShiftWithTask.details || [], targetJobType);
        subTask = found.subTask;
        parentTask = found.parentTask;
      }
    }

    const targetTaskId =
      subTask?.taskId ||
      parentTask?.taskId ||
      'TASK_CHECK_KLGD_s1';

    const systemUser = {
      id: '000000000000000000000000',
      fullName: 'Maker (Thao tác nhanh Console)',
      username: 'maker_console',
      role: 'ADMIN',
    };

    // 1. Nếu có ca trực, reset trạng thái task về PENDING (cả task con và task cha)
    if (targetShift) {
      try {
        if (subTask) {
          await this.shiftsService.updateTaskStatus(
            targetShift._id.toString(),
            subTask.taskId,
            'PENDING',
            systemUser,
            `[Maker] Kích hoạt chạy lại ${targetJobType} từ Trading Operation Console`,
            true,
          );
        }
        if (parentTask && parentTask.taskId !== subTask?.taskId) {
          await this.shiftsService.updateTaskStatus(
            targetShift._id.toString(),
            parentTask.taskId,
            'PENDING',
            systemUser,
            `[Maker] Kích hoạt chạy lại ${targetJobType} từ Trading Operation Console`,
            true,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `Không thể cập nhật trạng thái task trong ca trực: ${err.message}`,
        );
      }
    }

    // 2. Enqueue job trực tiếp vào Bot Job Queue
    const job = await this.botJobQueueService.enqueue(targetJobType, {
      taskId: targetTaskId,
      shiftLogId: targetShift ? targetShift._id.toString() : null,
      sessionDay: targetShift?.shiftDate || targetDate,
      options,
    });

    return {
      success: true,
      message: `Đã kích hoạt job ${targetJobType} thành công! Hệ thống đang tiến hành đối chiếu.`,
      jobId: job?._id?.toString(),
    };
  }

  /**
   * Kiểm tra ký quỹ TKGD (IMR 4 nhóm vi phạm)
   * Port 1:1 chuẩn xác từ C# BackupService.CheckIMR() & FIleUtils.GetIMRData()
   */
  async checkImr(sessionDateStr?: string) {
    const tradingDate = sessionDateStr ? new Date(sessionDateStr) : new Date();
    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const formattedDate = `${day}/${month}/${year}`;

    const msBackupBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    ));
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const msDailyPath = path.join(msBackupBase, subFolder);

    const ttmPath = findLatestFile(msDailyPath, /^TTM.*\.xlsx$/i) || path.join(msDailyPath, 'TTM.xlsx');
    const dslckPath = findLatestFile(msDailyPath, /^DSLCK.*\.xlsx$/i) || path.join(msDailyPath, 'DSLCK.xlsx');
    const qltkgdPath = findLatestFile(msDailyPath, /^QLTKGD.*\.xlsx$/i) || path.join(msDailyPath, 'QLTKGD.xlsx');

    const filesFound = {
      ttm: fs.existsSync(ttmPath),
      dslck: fs.existsSync(dslckPath),
      qltkgd: fs.existsSync(qltkgdPath),
    };

    if (!filesFound.qltkgd) {
      return {
        sessionDate: formattedDate,
        success: false,
        message: `Không tìm thấy file QLTKGD.xlsx tại ${msDailyPath}. Vui lòng chạy Backup MS trước.`,
        filesFound,
        summary: { group1Count: 0, group2Count: 0, group3Count: 0, group4Count: 0 },
        results: { group1: [], group2: [], group3: [], group4: [] },
      };
    }

    // 1. Đọc danh sách tài khoản có TTM
    const ttmSet = new Set<string>();
    if (filesFound.ttm) {
      try {
        const wb = XLSX.readFile(ttmPath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length > 1) {
          const headerRow = rows[0].map((c) => String(c || '').trim().toLowerCase());
          const accIdx = headerRow.findIndex((c) => c === 'mã tkgd' || c.includes('mã tk') || c.includes('account'));
          if (accIdx !== -1) {
            for (let r = 1; r < rows.length; r++) {
              const acc = String(rows[r]?.[accIdx] || '').trim();
              if (acc) ttmSet.add(acc);
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi đọc file TTM.xlsx: ${err.message}`);
      }
    }

    // 2. Đọc danh sách tài khoản có lệnh chờ khớp (DSLCK)
    const dslckSet = new Set<string>();
    if (filesFound.dslck) {
      try {
        const wb = XLSX.readFile(dslckPath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length > 1) {
          const headerRow = rows[0].map((c) => String(c || '').trim().toLowerCase());
          const accIdx = headerRow.findIndex((c) => c === 'mã tkgd' || c.includes('mã tk') || c.includes('account'));
          if (accIdx !== -1) {
            for (let r = 1; r < rows.length; r++) {
              const acc = String(rows[r]?.[accIdx] || '').trim();
              if (acc) dslckSet.add(acc);
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi đọc file DSLCK.xlsx: ${err.message}`);
      }
    }

    // 3. Đọc dữ liệu QLTKGD và phân loại 4 nhóm
    const group1: string[] = [];
    const group2: string[] = [];
    const group3: string[] = [];
    const group4: string[] = [];

    try {
      const wb = XLSX.readFile(qltkgdPath);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length > 1) {
        const headerRow = rows[0].map((c) => String(c || '').trim().toLowerCase());
        const maTKGDIdx = headerRow.findIndex((c) => c === 'mã tkgd' || c.includes('mã tk'));
        const laiLoFuturesIdx = headerRow.findIndex((c) => c.includes('lãi lỗ dự kiến futures'));
        const laiLoOptionsIdx = headerRow.findIndex((c) => c.includes('lãi lỗ dự kiến options'));
        const kyQuyTamTinhIdx = headerRow.findIndex((c) => c.includes('ký quỹ ban đầu yêu cầu tạm tính') || c.includes('kqyctt') || c.includes('kqtt'));
        const kyQuyYeuCauIdx = headerRow.findIndex((c) => c.includes('ký quỹ ban đầu yêu cầu') && !c.includes('tạm tính'));
        const kyQuyKhaDungIdx = headerRow.findIndex((c) => c.includes('ký quỹ khả dụng') && !c.includes('tạm tính'));
        const kyQuyKhaDungTamTinhIdx = headerRow.findIndex((c) => c.includes('ký quỹ khả dụng tạm tính') || c.includes('kqkdtt'));

        const parseNum = (val: any): number => {
          if (val === undefined || val === null) return 0;
          if (typeof val === 'number') return val;
          const s = String(val).replace(/,/g, '').trim();
          const n = parseFloat(s);
          return isNaN(n) ? 0 : n;
        };

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const maTKGD = String(row[maTKGDIdx] || '').trim();
          if (!maTKGD) continue;

          const laiLoFutures = parseNum(row[laiLoFuturesIdx]);
          const laiLoOptions = parseNum(row[laiLoOptionsIdx]);
          const kyQuyTamTinh = parseNum(row[kyQuyTamTinhIdx]);
          const kyQuyYeuCau = parseNum(row[kyQuyYeuCauIdx]);
          const kyQuyKhaDung = parseNum(row[kyQuyKhaDungIdx]);
          const kyQuyKhaDungTamTinh = parseNum(row[kyQuyKhaDungTamTinhIdx]);

          // Nhóm 1: Có lãi lỗ dự kiến nhưng không có TTM
          if ((laiLoFutures !== 0 || laiLoOptions !== 0) && !ttmSet.has(maTKGD)) {
            group1.push(maTKGD);
          }

          // Nhóm 2: Không có TTM và lệnh chờ nhưng có KQTT
          if (kyQuyTamTinh !== 0 && !ttmSet.has(maTKGD) && !dslckSet.has(maTKGD)) {
            group2.push(maTKGD);
          }

          // Nhóm 3: TKGD có TTM, không có lệnh chờ nhưng KQYCTT != KQYC
          if (kyQuyTamTinh !== kyQuyYeuCau && ttmSet.has(maTKGD) && !dslckSet.has(maTKGD)) {
            group3.push(maTKGD);
          }

          // Nhóm 4: TK không có lệnh chờ nhưng KQKĐTT != KQKĐ
          if (kyQuyKhaDung !== kyQuyKhaDungTamTinh && !dslckSet.has(maTKGD)) {
            group4.push(maTKGD);
          }
        }
      }

      return {
        sessionDate: formattedDate,
        success: true,
        filesFound,
        summary: {
          group1Count: group1.length,
          group2Count: group2.length,
          group3Count: group3.length,
          group4Count: group4.length,
        },
        results: {
          group1,
          group2,
          group3,
          group4,
        },
      };
    } catch (err: any) {
      this.logger.error(`Lỗi khi phân tích QLTKGD.xlsx: ${err.message}`, err.stack);
      return {
        sessionDate: formattedDate,
        success: false,
        message: `Lỗi khi đọc file QLTKGD.xlsx: ${err.message}`,
        filesFound,
        summary: { group1Count: 0, group2Count: 0, group3Count: 0, group4Count: 0 },
        results: { group1: [], group2: [], group3: [], group4: [] },
      };
    }
  }

  /**
   * Tải riêng 3 file CoreCCP (DSGD, TTM, TTTT) và bóc tách lấy ra các chỉ số KLGD, TTM, TTTT hiện tại.
   * Chỉ chạy độc lập cho CoreCCP mà không ảnh hưởng tới luồng M-System, CQG hay ACM.
   */
  async downloadAndExtractCcpMetrics(dateStr?: string): Promise<{
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
    if (!this.ccpCeDownloaderService) {
      throw new Error('CcpCeDownloaderService chưa sẵn sàng trong hệ thống');
    }

    let tradingDate = new Date();
    if (dateStr) {
      if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        tradingDate = new Date(`${y}-${m}-${d}`);
      } else if (dateStr.includes('-')) {
        tradingDate = new Date(dateStr);
      }
    }

    const day = String(tradingDate.getDate()).padStart(2, '0');
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const year = tradingDate.getFullYear().toString();
    const formattedDate = `${day}/${month}/${year}`;

    // Lấy thông tin đăng nhập CoreCCP từ settings DB
    const credRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
    if (!credRaw) {
      throw new Error('Chưa cấu hình tài khoản CoreCCP (bot_credentials_ccp) trong System Settings');
    }

    let creds: any;
    try {
      creds = JSON.parse(decrypt(credRaw));
    } catch {
      creds = JSON.parse(credRaw);
    }

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    let ccpDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    try {
      if (!fs.existsSync(ccpDailyPath)) {
        fs.mkdirSync(ccpDailyPath, { recursive: true });
      }
    } catch {
      ccpDailyPath = path.join(process.cwd(), 'data', 'backup', 'ccp', 'futures', subFolder);
      if (!fs.existsSync(ccpDailyPath)) {
        fs.mkdirSync(ccpDailyPath, { recursive: true });
      }
    }

    this.logger.log(`[CCP Metrics] Bắt đầu tải riêng 3 file CoreCCP ngày ${formattedDate} vào: ${ccpDailyPath}`);

    return this.ccpCeDownloaderService.downloadAndExtractKlgdMetrics({
      systemUrl: creds.url,
      username: creds.username,
      password: creds.password,
      tradingDate: formattedDate,
      outputDir: ccpDailyPath,
      options: { headless: true },
    });
  }
}