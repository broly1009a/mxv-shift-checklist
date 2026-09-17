import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { ReconciliationService } from '../../reconciliation/reconciliation.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { RpaDownloaderService } from '../rpa-downloader.service';
import { CqgSyncService } from '../cqg-sync.service';
import { CcpCeDownloaderService, CcpReportConfig, DEFAULT_CCP_REPORTS } from '../ccp-ce-downloader.service';
import { parseJobPayload, resolveStoragePathCrossPlatform, resolveBotTargetDate } from '../helpers/bot-path.helper';
import { decrypt } from '../utils/crypto';

@Injectable()
export class ReconJobsHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(ReconJobsHandler.name);
  readonly jobTypes = ['AUTO_CHECK_SOD', 'CHECK_KLGD', 'CHECK_PRE_EOD', 'CHECK_EOD_MM', 'CHECK_EOD_CCP', 'CHECK_CQG_SYNC'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    @Inject(forwardRef(() => ReconciliationService))
    private readonly reconciliationService: ReconciliationService,
    private readonly settingsService: SystemSettingsService,
    private readonly rpaDownloaderService: RpaDownloaderService,
    private readonly cqgSyncService: CqgSyncService,
    @Inject(forwardRef(() => CcpCeDownloaderService))
    private readonly ccpCeDownloaderService: CcpCeDownloaderService,
  ) { }

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    switch (job.jobType) {
      case 'AUTO_CHECK_SOD':
        return this.handleAutoCheckSodJob(job);
      case 'CHECK_KLGD':
        return this.handleCheckKlgdJob(job);
      case 'CHECK_PRE_EOD':
        return this.handleCheckPreEodJob(job);
      case 'CHECK_EOD_MM':
        return this.handleCheckEodMmJob(job);
      case 'CHECK_EOD_CCP':
        return this.handleCheckEodCcpJob(job);
      case 'CHECK_CQG_SYNC':
        return this.handleCheckCqgSyncJob(job);
      default:
        throw new Error(`ReconJobsHandler không hỗ trợ jobType: ${job.jobType}`);
    }
  }

  private async handleAutoCheckSodJob(job: any) {
    const payload = parseJobPayload(job);
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu kiểm tra đối chiếu SOD tự động ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckSOD(targetDate);
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu SOD.`);
      job.logs.push(
        `[${new Date().toISOString()}] Kết quả: ${result.success ? 'KHỚP' : 'LỆCH'}`,
      );

      payload.result = result;
      job.payload = payload;
      await job.save();

      if (!result.success) {
        if (result.discrepancies && result.discrepancies.length > 0) {
          job.logs.push(
            `[${new Date().toISOString()}] Danh sách tài khoản lệch số dư:`,
          );
          result.discrepancies.forEach((d: any) => {
            job.logs.push(
              `- [SOD] TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)} (Chênh lệch: $${d.differ.toFixed(2)})`,
            );
          });
        }
        await job.save();
        throw new Error(
          `Phát hiện chênh lệch số dư tài khoản (> $100) giữa M-System và CQG CAST. Vui lòng kiểm tra báo cáo.`,
        );
      }
      return result;
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu SOD tự động: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }

  private async handleCheckKlgdJob(job: any) {
    const payload = parseJobPayload(job);
    let targetDate: Date;
    if (payload.sessionDay || payload.targetDate) {
      const resolved = resolveBotTargetDate(payload);
      targetDate = resolved.dateObj;
    } else {
      // Overnight session logic:
      // Trong phiên MXV, phiên giao dịch mở lúc ~06:30/07:00 sáng và kéo dài xuyên đêm tới 05:00/06:00 sáng hôm sau.
      // Nếu job chạy trong khoảng 00:00 - 06:30 sáng (giờ VN), phiên giao dịch thực tế vẫn là phiên của ngày T-1.
      const nowVnStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
      const nowVN = new Date(nowVnStr);
      const currentHour = nowVN.getHours();
      const currentMin = nowVN.getMinutes();
      targetDate = new Date(nowVN);
      targetDate.setHours(0, 0, 0, 0);
      if (currentHour < 6 || (currentHour === 6 && currentMin < 30)) {
        targetDate.setDate(targetDate.getDate() - 1);
      }
      while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
        targetDate.setDate(targetDate.getDate() - 1);
      }
    }
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(`Bắt đầu chạy đối chiếu khớp lệnh định kỳ trong phiên ngày ${dateStr}...`);
    await job.save();

    const options = {
      checkKlgd: payload.options?.checkKlgd ?? true,
      checkTtm: payload.options?.checkTtm ?? true,
      checkTttt: payload.options?.checkTttt ?? true,
    };

    const defaultMsPath = path.join(process.cwd(), 'data', 'backup', 'ms', 'futures');
    const defaultCqgPath = path.join(process.cwd(), 'data', 'backup', 'cqg', 'futures');
    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      defaultMsPath,
    );
    const cqgBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      defaultCqgPath,
    );
    const acmBackupBase = (
      await this.settingsService.getSetting('bot_backup_path_acm', '')
    ) || path.join(path.dirname(msBackupBase), 'ACM');
    // CCP base path: Ưu tiên lấy từ bot_credentials_ccp.outputDir -> bot_backup_path_ccp -> default
    let ccpOutputDirFromCreds = '';
    const credCcpRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
    if (credCcpRaw) {
      try {
        const credsParsed = JSON.parse(decrypt(credCcpRaw));
        if (credsParsed && credsParsed.outputDir) {
          ccpOutputDirFromCreds = String(credsParsed.outputDir).trim();
        }
      } catch { }
    }
    const defaultCcpPath = path.join(process.cwd(), 'data', 'backup', 'ccp', 'futures');
    const ccpBackupBase = resolveStoragePathCrossPlatform(
      ccpOutputDirFromCreds ||
      (await this.settingsService.getSetting('bot_backup_path_ccp', '')) ||
      defaultCcpPath,
    );

    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);
    const acmDailyPath = path.join(acmBackupBase, subFolder);
    const ccpDailyPath = path.join(ccpBackupBase, subFolder);

    for (const dir of [msDailyPath, cqgDailyPath, acmDailyPath, ccpDailyPath]) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      } catch (err: any) {
        this.logger.warn(`Không thể tạo thư mục ${dir}: ${err.message}`);
      }
    }

    log(' Khởi động quy trình Đồng bộ 2 Pha (Barrier Synchronization) tải tươi từ MS, CQG, ACM và CoreCCP đồng thời...');
    await job.save();

    const errors: string[] = [];

    // Cờ kiểm soát rào cản nghiêm ngặt:
    // true = Bắt buộc cả 4 nguồn sẵn sàng mới xuất file; false = Cho phép dùng file cũ nếu 1 bên lỗi
    const REQUIRE_ALL_SOURCES_FRESH = true;

    let triggerBarrierResolve: () => void = () => { };
    let triggerBarrierReject: (reason: any) => void = () => { };
    let barrierTriggered = false;
    let barrierAnnounced = false;
    let barrierAborted = false;
    let abortReason = '';

    const barrierTriggerPromise = new Promise<void>((resolve, reject) => {
      triggerBarrierResolve = () => {
        if (!barrierTriggered && !barrierAborted) {
          barrierTriggered = true;
          resolve();
        }
      };
      triggerBarrierReject = (reason: any) => {
        if (!barrierTriggered) {
          barrierAborted = true;
          reject(reason);
        }
      };
    });

    const readyState = {
      ms: false,
      acm: false,
      ccp: false,
      cqg: false,
    };

    const checkAllReadyAndTrigger = () => {
      if (barrierAborted) return;
      if (readyState.ms && readyState.acm && readyState.ccp && readyState.cqg) {
        if (!barrierAnnounced) {
          barrierAnnounced = true;
          log(' Tất cả 4 nguồn (MS, CQG, ACM, CoreCCP) đều đã vào vị trí! KÍCH HOẠT XUẤT FILE ĐỒNG THỜI.');
        }
        triggerBarrierResolve();
      }
    };

    const abortBarrierIfStrict = (source: string, errorMsg: string) => {
      if (REQUIRE_ALL_SOURCES_FRESH && !barrierTriggered && !barrierAborted) {
        barrierAborted = true;
        abortReason = `Nguồn [${source}] gặp sự cố: ${errorMsg}`;
        log(` DỪNG RÀO CẢN ĐỒNG BỘ: ${abortReason}. Đã dừng quy trình để bảo vệ tính toàn vẹn số liệu và tránh báo lệch giả.`);
        triggerBarrierReject(new Error(abortReason));
      }
    };

    // ── 1. WORKER M-SYSTEM ───────────────────────────────────────────────────
    const runWorkerMs = async () => {
      if (
        options.checkKlgd === false &&
        options.checkTtm === false &&
        options.checkTttt === false
      ) {
        log('MS ⏭️ Bỏ qua M-System theo tùy chọn.');
        readyState.ms = true;
        checkAllReadyAndTrigger();
        return;
      }

      log('MS  [Pha 1] Khởi chạy trình duyệt và đăng nhập M-System...');
      let browser: any = null;
      let page: any = null;
      try {
        const msSession = await this.rpaDownloaderService.loginMSystem(msDailyPath);
        browser = msSession.browser;
        page = msSession.page;

        if (options.checkKlgd !== false) {
          log('MS  Điều hướng đến màn hình DSGD...');
          await page.click("xpath=//a[text()='QL giao dịch']");
          await page.waitForTimeout(1000);
          await page.click("xpath=//a[text()='Danh sách giao dịch']");
          await page.waitForTimeout(2000);
        }

        readyState.ms = true;
        log('MS  Đã sẵn sàng tại màn hình DSGD. Đang chờ rào cản đồng bộ...');
        checkAllReadyAndTrigger();

        // Chờ tín hiệu rào cản kích hoạt tải Pha 2
        await barrierTriggerPromise;

        if (options.checkKlgd !== false) {
          log('MS  [Pha 2] Kích hoạt xuất DSGD.xlsx...');
          const [dl] = await Promise.all([
            page.waitForEvent('download', { timeout: 45000 }),
            page.click("xpath=//i[contains(@class, 'fa-file-csv')]", { timeout: 15000 }),
          ]);

          await this.rpaDownloaderService.saveAndValidateDownload(
            dl,
            path.join(msDailyPath, 'DSGD.xlsx'),
            'DSGD',
          );
          log('MS  Tải DSGD.xlsx thành công.');
        }

        if (options.checkTtm !== false) {
          log('MS → Tải bổ sung TTM.xlsx...');
          await this.rpaDownloaderService.downloadTTM(
            page,
            path.join(msDailyPath, 'TTM.xlsx'),
          );
          log('MS  Tải TTM.xlsx thành công.');
        }

        if (options.checkTttt !== false) {
          log('MS → Tải bổ sung TTTT.xlsx...');
          await this.rpaDownloaderService.downloadTTTT(
            page,
            path.join(msDailyPath, 'TTTT.xlsx'),
          );
          log('MS  Tải TTTT.xlsx thành công.');
        }
      } catch (err: any) {
        errors.push(`MS: ${err.message}`);
        log(`MS  Lỗi: ${err.message}`);
        abortBarrierIfStrict('M-System', err.message);
      } finally {
        if (!barrierAborted) {
          readyState.ms = true;
          checkAllReadyAndTrigger();
        }
        if (browser) await browser.close().catch(() => { });
        log('MS  Đã đóng trình duyệt M-System.');
      }
    };

    // ── 2. WORKER ACM (STRAITS NANO) ─────────────────────────────────────────
    const runWorkerAcm = async () => {
      if (options.checkKlgd === false) {
        log('ACM ⏭️ Bỏ qua ACM theo tùy chọn.');
        readyState.acm = true;
        checkAllReadyAndTrigger();
        return;
      }

      log('ACM  [Pha 1] Khởi chạy trình duyệt và đăng nhập ACM (giải Captcha)...');
      const jobLogFn = (msg: string) => log(`ACM: ${msg}`);
      let browser: any = null;
      let page: any = null;
      try {
        const acmSession = await this.rpaDownloaderService.loginACM(
          acmDailyPath,
          undefined,
          jobLogFn,
        );
        browser = acmSession.browser;
        page = acmSession.page;

        const credentialsRaw = await this.settingsService.getSetting(
          'bot_credentials_acm',
          '',
        );
        let creds: any = {};
        try {
          if (credentialsRaw) creds = JSON.parse(decrypt(credentialsRaw));
        } catch { }

        let baseUrl = page.url().split('#')[0];
        if (!baseUrl || !baseUrl.startsWith('http')) {
          baseUrl = (creds.url || '').split('#')[0];
        }
        try {
          const urlObj = new URL(baseUrl);
          if (!urlObj.pathname.includes('/exchange/index.html') && baseUrl.includes('/exchange')) {
            baseUrl = `${urlObj.origin}/exchange/index.html`;
          }
        } catch { }

        const fillUrl = creds.fillUrl || `${baseUrl}#/business-tetptrade`;
        const orderUrl = creds.orderUrl || `${baseUrl}#/business-tetporder`;

        log(`ACM  Điều hướng đến màn hình Fill: ${fillUrl}...`);
        await page.goto(fillUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
          await page.goto(fillUrl).catch(() => { });
        });
        await page.waitForTimeout(3000).catch(() => { });

        const exportBtnSelector =
          '.el-button--info:has-text("Export"), button:has-text("Export"), button:has-text("Download")';
        await page.waitForSelector(exportBtnSelector, { state: 'visible', timeout: 15000 }).catch(() => { });

        readyState.acm = true;
        log('ACM  Đã sẵn sàng tại màn hình Fill. Đang chờ rào cản đồng bộ...');
        checkAllReadyAndTrigger();

        // Chờ tín hiệu rào cản kích hoạt tải Pha 2
        await barrierTriggerPromise;

        log('ACM  [Pha 2] Kích hoạt xuất báo cáo Fill (Straits.csv)...');
        const btn = page.locator(exportBtnSelector).first();
        const isVisible = await btn.isVisible().catch(() => false);
        const straitsFile = path.join(acmDailyPath, 'Straits.csv');
        const fillFile = path.join(acmDailyPath, 'Fill.xlsx');

        if (isVisible) {
          const dlPromise = page.waitForEvent('download', { timeout: 35000 });
          await btn.click();
          const dl = await dlPromise;
          await dl.saveAs(straitsFile);
          // Tạo bản sao Fill.xlsx để tương thích hoàn toàn các parser cũ
          try {
            fs.copyFileSync(straitsFile, fillFile);
          } catch { }
          log('ACM  Tải Straits.csv (Fill) thành công.');
        } else {
          // Fallback tải chuẩn
          await this.rpaDownloaderService.downloadAcmReport(page, fillFile, fillUrl, jobLogFn);
          try {
            if (fs.existsSync(fillFile)) fs.copyFileSync(fillFile, straitsFile);
          } catch { }
          log('ACM  Tải báo cáo Fill qua fallback thành công.');
        }

        // Tải bổ sung Order nếu cần
        try {
          await this.rpaDownloaderService.downloadAcmReport(
            page,
            path.join(acmDailyPath, 'Order.xlsx'),
            orderUrl,
            jobLogFn,
          );
          log('ACM  Tải Order.xlsx thành công.');
        } catch (orderErr: any) {
          log(`ACM  Không thể tải Order.xlsx: ${orderErr.message}`);
        }
      } catch (err: any) {
        errors.push(`ACM: ${err.message}`);
        log(`ACM  Lỗi: ${err.message}`);
        abortBarrierIfStrict('Straits ACM', err.message);
      } finally {
        if (!barrierAborted) {
          readyState.acm = true;
          checkAllReadyAndTrigger();
        }
        if (browser) await browser.close().catch(() => { });
        log('ACM  Đã đóng trình duyệt ACM.');
      }
    };

    // ── 3. WORKER CORECCP (VNCLEAR) ──────────────────────────────────────────
    const runWorkerCcp = async () => {
      const credRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
      if (!credRaw) {
        log('CCP ⏭️ Chưa cấu hình tài khoản CoreCCP. Bỏ qua.');
        readyState.ccp = true;
        checkAllReadyAndTrigger();
        return;
      }
      let creds: any = {};
      try {
        creds = JSON.parse(decrypt(credRaw));
      } catch {
        log('CCP  Không thể giải mã cấu hình CoreCCP.');
        readyState.ccp = true;
        checkAllReadyAndTrigger();
        return;
      }
      if (!creds.url || !creds.username || !creds.password) {
        log('CCP ⏭️ Cấu hình CoreCCP thiếu url/username/password. Bỏ qua.');
        readyState.ccp = true;
        checkAllReadyAndTrigger();
        return;
      }

      log('CCP  [Pha 1] Khởi chạy trình duyệt và đăng nhập CoreCCP...');
      const dateFormatted = `${day}/${month}/${year}`;
      let ccpSession: any = null;
      try {
        ccpSession = await this.ccpCeDownloaderService.prepareKlgdSession({
          systemUrl: creds.url,
          username: creds.username,
          password: creds.password,
          tradingDate: dateFormatted,
          outputDir: ccpDailyPath,
          options: {
            headless: true,
            overwriteExisting: true,
          },
          logCallback: (msg: string) => log(`CCP: ${msg}`),
        });

        readyState.ccp = true;
        log('CCP  Đã sẵn sàng tại màn hình DSGD. Đang chờ rào cản đồng bộ...');
        checkAllReadyAndTrigger();

        // Chờ tín hiệu rào cản kích hoạt tải Pha 2
        await barrierTriggerPromise;

        log('CCP  [Pha 2] Kích hoạt xuất báo cáo DSGD CoreCCP...');
        const dsgdFile = await ccpSession.triggerExportDsgd();
        log(`CCP  Tải DSGD hoàn tất: ${dsgdFile || 'Không có dữ liệu'}`);

        // Tải các báo cáo bổ sung (TTM, TTTT) và bóc tách
        await ccpSession.downloadRemainingAndExtract(dsgdFile || undefined);
        log('CCP  Tải toàn bộ báo cáo CoreCCP hoàn tất.');
      } catch (err: any) {
        errors.push(`CCP: ${err.message}`);
        log(`CCP  Lỗi: ${err.message}`);
        abortBarrierIfStrict('CoreCCP', err.message);
      } finally {
        if (!barrierAborted) {
          readyState.ccp = true;
          checkAllReadyAndTrigger();
        }
        if (ccpSession) await ccpSession.close().catch(() => { });
        log('CCP  Đã đóng trình duyệt CoreCCP.');
      }
    };

    // ── 4. WORKER CQG (CQG1 & CQG2) ──────────────────────────────────────────
    const runWorkerCqg = async () => {
      if (
        options.checkKlgd === false &&
        options.checkTtm === false &&
        options.checkTttt === false
      ) {
        log('CQG ⏭️ Bỏ qua CQG theo tùy chọn.');
        readyState.cqg = true;
        checkAllReadyAndTrigger();
        return;
      }

      try {
        const filesToDownload: {
          FR1?: boolean;
          FR2?: boolean;
          OP1?: boolean;
          OP2?: boolean;
          PS1?: boolean;
          PS2?: boolean;
          OD1?: boolean;
          OD2?: boolean;
        } = {};
        if (options.checkKlgd !== false) {
          filesToDownload.FR1 = true;
          filesToDownload.FR2 = true;
        }
        if (options.checkTtm !== false) {
          filesToDownload.OP1 = true;
          filesToDownload.OP2 = true;
        }
        if (options.checkTttt !== false) {
          filesToDownload.PS1 = true;
          filesToDownload.PS2 = true;
        }

        log(`CQG  [Pha 1] Khởi chạy phiên CQG và chuẩn bị tải: ${Object.keys(filesToDownload).join(', ')}...`);

        const onReadyBarrier = async () => {
          readyState.cqg = true;
          log('CQG  CQG1 đã đăng nhập và sẵn sàng xuất FR1. Chờ rào cản đồng bộ...');
          checkAllReadyAndTrigger();
          await barrierTriggerPromise;
          log('CQG  [Pha 2] Kích hoạt xuất FR1.xlsx...');
        };

        const result = await this.rpaDownloaderService.downloadCqgBackup(
          filesToDownload,
          cqgDailyPath,
          onReadyBarrier,
        );

        if (result.downloaded.length > 0) {
          log(`CQG  Đã tải: ${result.downloaded.join(', ')}.`);
        }
        if (result.errors.length > 0) {
          errors.push(...result.errors.map((e) => `CQG: ${e}`));
          log(`CQG  Lỗi: ${result.errors.join(' | ')}`);
        }

        const keysToMerge: Array<'FR' | 'OP' | 'PS'> = [];
        if (options.checkKlgd !== false) keysToMerge.push('FR');
        if (options.checkTtm !== false) keysToMerge.push('OP');
        if (options.checkTttt !== false) keysToMerge.push('PS');

        log(`CQG → Ghép nối các file thô (${keysToMerge.join(', ')})...`);
        const mergeResult = await this.cqgSyncService.autoMergeMissingFiles(
          targetDate,
          keysToMerge,
          true,
        );
        for (const l of mergeResult.logs) {
          log(`CQG Merge: ${l}`);
        }
        if (!mergeResult.success) {
          errors.push(
            `CQG Merge: ${mergeResult.logs.filter((l) => l.includes('')).join(' | ')}`,
          );
        } else {
          log('CQG  Ghép file CQG hoàn tất.');
        }
      } catch (err: any) {
        errors.push(`CQG: ${err.message}`);
        log(`CQG  Lỗi: ${err.message}`);
        abortBarrierIfStrict('CQG', err.message);
      } finally {
        if (!barrierAborted) {
          readyState.cqg = true;
          checkAllReadyAndTrigger();
        }
        log('CQG  Đã hoàn tất và đóng trình duyệt CQG.');
      }
    };

    // ── BỘ ĐIỀU KHIỂN RÀO CẢN ĐỒNG BỘ ────────────────────────────────────────
    const startBarrierController = async () => {
      const waitStart = Date.now();
      const maxWaitMs = 70000; // Tối đa 70 giây cho các bên đăng nhập và vào vị trí (CQG cần ~55-60s)
      while (Date.now() - waitStart < maxWaitMs) {
        if (barrierAborted) return;
        if (readyState.ms && readyState.acm && readyState.ccp && readyState.cqg) {
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!barrierTriggered && !barrierAborted) {
        log(' Đạt ngưỡng timeout rào cản (70s). Kích hoạt xuất dữ liệu cho các nguồn đã sẵn sàng...');
        triggerBarrierResolve();
      }
    };

    // Chạy song song cả 4 Worker và Bộ điều khiển rào cản
    await Promise.allSettled([
      runWorkerMs(),
      runWorkerAcm(),
      runWorkerCcp(),
      runWorkerCqg(),
      startBarrierController(),
    ]);
    await job.save();

    if (barrierAborted) {
      log(` QUY TRÌNH ĐỐI SOÁT TẠM DỪNG: ${abortReason}. Không thực hiện so khớp để bảo vệ tính toàn vẹn số liệu.`);
      payload.result = {
        passed: false,
        isAborted: true,
        error: abortReason,
        message: `[StrictBarrier] Tạm dừng đối chiếu do thiếu dữ liệu tươi: ${abortReason}`,
      };
      await job.save();
      throw new Error(`[PARTNER_SERVICE_UNAVAILABLE] ${abortReason}`);
    }

    // ── MA TRẬN KIỂM TRA FILE CỐT LÕI (MANDATORY CORE FILES GATE) ───────────
    if (options.checkKlgd !== false) {
      const coreErrors = errors.filter(
        (e) =>
          e.includes('CQG1') ||
          e.includes('CQG2') ||
          e.includes('FR1') ||
          e.includes('FR2') ||
          e.includes('DSGD') ||
          e.includes('Straits') ||
          e.includes('ACM'),
      );
      if (coreErrors.length > 0) {
        const errorMsg = `Thiếu file dữ liệu cốt lõi do lỗi tải/đăng nhập: ${coreErrors.join(' | ')}. Dừng đối chiếu để bảo vệ tính toàn vẹn số liệu và tránh báo lệch giả.`;
        log(` DỪNG ĐỐI SOÁT: ${errorMsg}`);
        payload.result = {
          passed: false,
          isAborted: true,
          error: errorMsg,
          message: `[MandatoryCoreFilesMissing] ${errorMsg}`,
        };
        await job.save();
        throw new Error(`[PARTNER_SERVICE_UNAVAILABLE] ${errorMsg}`);
      }
    }

    if (errors.length > 0) {
      log(` Có ${errors.length} lỗi/cảnh báo bổ trợ (non-blocking), tiếp tục đối chiếu với dữ liệu sẵn có...`);
    } else {
      log(' Hoàn tất quy trình tải dữ liệu đồng bộ tươi từ các nguồn.');
    }

    try {
      const result = await this.reconciliationService.runAutoCheckKLGD(targetDate, options);
      if (result.sessionStart && result.checkTime) {
        const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const endStr = new Date(result.checkTime).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        log(`Khoảng thời gian lọc: từ ${startStr} đến ${endStr}`);
      }
      if (result.isWaitingFiles) {
        log(result.message || '[Đang chờ dữ liệu] Đang chờ cập nhật đầy đủ file đối chiếu.');
      } else {
        log('Hoàn thành đối chiếu khớp lệnh định kỳ trong phiên.');
        log(`Kết quả: ${result.passed ? 'KHỚP' : 'LỆCH'}`);
      }

      const LOG_THRESHOLD = 50;
      const MAX_PREVIEW = 30;
      const mismatchedAll = result.mismatchedTrades ?? [];
      if (mismatchedAll.length > LOG_THRESHOLD) {
        payload.result = {
          ...result,
          mismatchedTrades: mismatchedAll.slice(0, MAX_PREVIEW),
          mismatchedTradesTotal: mismatchedAll.length,
          isPreviewOnly: true,
        };
      } else {
        payload.result = result;
      }
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      if (!result.passed) {
        if (mismatchedAll.length > 0) {
          if (mismatchedAll.length > LOG_THRESHOLD) {
            const preview = mismatchedAll.slice(0, MAX_PREVIEW)
              .map((t: any) => `[${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}: ${t.reason}`)
              .join(' | ');
            log(
              ` Phát hiện ${mismatchedAll.length} lệch KLGD (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết đầy đủ xem file CSV đính kèm email. ` +
              `Preview ${MAX_PREVIEW} đầu tiên: ${preview}`,
            );
          } else {
            log('Chi tiết chênh lệch khớp lệnh:');
            mismatchedAll.forEach((t: any) => {
              job.logs.push(
                `- [${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}, Giá ${t.giaKhop}, Qty ${t.klGiaoDich}: ${t.reason}`,
              );
            });
          }
        }
        log('Hoàn thành đối chiếu: Phát hiện chênh lệch khớp lệnh (LỆCH). Đã cập nhật kết quả đối soát.');
        await job.save();
      }

      this.appendOvernightLog(dateStr, result, job.logs);
      return result;
    } catch (err: any) {
      log(`Lỗi đối chiếu khớp lệnh tự động: ${err.message}`);
      await job.save();
      this.appendOvernightLog(dateStr, null, job.logs, err.message);
      throw err;
    }
  }

  private appendOvernightLog(
    targetDateStr: string,
    result: any,
    logs: string[],
    error?: string,
  ) {
    try {
      const nowStr = new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      const logFiles = [
        path.join(process.cwd(), 'check_klgd_overnight_log.txt'),
        path.join(path.dirname(process.cwd()), 'check_klgd_overnight_log.txt'),
      ];

      const lines: string[] = [];
      lines.push('================================================================================');
      lines.push(`⏰ THỜI ĐIỂM CHẠY: ${nowStr} (Ngày phiên: ${targetDateStr})`);
      lines.push('================================================================================');

      if (error) {
        lines.push(` TRẠNG THÁI: LỖI THỰC THI - ${error}`);
      } else if (result) {
        const status = result.passed ? ' KHỚP HOÀN TOÀN' : ' CÓ CHÊNH LỆCH';
        lines.push(` KẾT QUẢ TỔNG QUÁT: ${status}`);
        lines.push('');
        lines.push('--- BẢNG TỔNG HỢP SỐ LIỆU ---');
        lines.push(
          `• KLGD: MS = ${result.totalDSGD ?? 0} | CQG = ${result.totalFR ?? 0} | ACM = ${result.totalACM ?? 0} | Nano = ${result.totalNano ?? 0} | Lệch CQG = ${result.differ ?? 0} | Lệch ACM = ${result.differACM ?? 0}`,
        );
        lines.push(
          `• TTM : MS = ${result.totalTTM ?? 0} | CQG = ${result.totalOP ?? 0} | ACM = ${result.totalTtmAcm ?? 0}`,
        );
        lines.push(
          `• TTTT: MS = ${result.totalTTTT ?? 0} | CQG = ${result.totalPS ?? 0} | ACM = ${result.totalTtttAcm ?? 0}`,
        );
        lines.push('');

        if (result.mismatchedTrades && result.mismatchedTrades.length > 0) {
          lines.push(` Danh sách chênh lệch khớp lệnh (${result.mismatchedTrades.length} lệnh):`);
          result.mismatchedTrades.slice(0, 20).forEach((t: any, idx: number) => {
            lines.push(
              `   ${idx + 1}. [${t.source}] TK ${t.maTKGD} | HĐ ${t.maHD} | Giá ${t.giaKhop} | Qty ${t.klGiaoDich}: ${t.reason}`,
            );
          });
          if (result.mismatchedTrades.length > 20) {
            lines.push(`   ... và còn ${result.mismatchedTrades.length - 20} lệnh khác.`);
          }
          lines.push('');
        }

        if (result.mismatchedTTTT && result.mismatchedTTTT.length > 0) {
          lines.push(` Chênh lệch Tất toán TTTT (${result.mismatchedTTTT.length} tài khoản):`);
          result.mismatchedTTTT.slice(0, 10).forEach((m: any, idx: number) => {
            lines.push(
              `   ${idx + 1}. TK ${m.maTKGD}: MS = ${m.ttttValue} vs CQG = ${m.psValue} (Lệch: ${m.differ})`,
            );
          });
          lines.push('');
        }
      }

      lines.push('--- NHẬT KÝ TIẾN TRÌNH BOT ---');
      logs.forEach((l) => lines.push(`[LOG] ${l}`));
      lines.push('\n');

      const content = lines.join('\n');
      for (const f of logFiles) {
        try {
          fs.appendFileSync(f, content, 'utf8');
        } catch { }
      }
    } catch (e: any) {
      this.logger.error(`Không thể ghi log overnight: ${e.message}`);
    }
  }

  private async handleCheckPreEodJob(job: any) {
    const payload = parseJobPayload(job);
    let targetDate: Date;
    let dateStr: string;
    if (payload.sessionDay || payload.targetDate) {
      const resolved = resolveBotTargetDate(payload);
      targetDate = resolved.dateObj;
      dateStr = resolved.dateStr;
    } else {
      const localNow = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
      targetDate = new Date(Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate()
      ));
      targetDate.setUTCHours(0, 0, 0, 0);
      dateStr = targetDate.toISOString().split('T')[0];
    }
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy đối chiếu Pre-EOD tự động ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckPreEOD(targetDate);
      if (result.sessionStart && result.checkTime) {
        const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const endStr = new Date(result.checkTime).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        job.logs.push(
          `[${new Date().toISOString()}] Khoảng thời gian lọc: từ ${startStr} đến ${endStr}`,
        );
      }
      if (result.isWaitingFiles) {
        job.logs.push(`[${new Date().toISOString()}] ${result.message}`);
      } else {
        job.logs.push(
          `[${new Date().toISOString()}] Hoàn thành đối chiếu Pre-EOD.`,
        );
        job.logs.push(
          `[${new Date().toISOString()}] Kết quả: ${result.passed ? 'KHỚP' : 'LỆCH'}`,
        );
      }

      const LOG_THRESHOLD = 50;
      const MAX_PREVIEW = 30;
      const mismatchedTradesAll = result.mismatchedTrades ?? [];
      const mismatchedPositionsAll = result.mismatchedPositions ?? [];
      const needTruncate = mismatchedTradesAll.length > LOG_THRESHOLD || mismatchedPositionsAll.length > LOG_THRESHOLD;
      if (needTruncate) {
        payload.result = {
          ...result,
          mismatchedTrades: mismatchedTradesAll.slice(0, MAX_PREVIEW),
          mismatchedTradesTotal: mismatchedTradesAll.length,
          mismatchedPositions: mismatchedPositionsAll.slice(0, MAX_PREVIEW),
          mismatchedPositionsTotal: mismatchedPositionsAll.length,
          isPreviewOnly: true,
        };
      } else {
        payload.result = result;
      }
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      if (!result.passed) {
        if (mismatchedTradesAll.length > 0) {
          if (mismatchedTradesAll.length > LOG_THRESHOLD) {
            const preview = mismatchedTradesAll.slice(0, MAX_PREVIEW)
              .map((t: any) => `[${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}: ${t.reason}`)
              .join(' | ');
            job.logs.push(
              `[${new Date().toISOString()}]  Phát hiện ${mismatchedTradesAll.length} lệch KLGD (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết xem CSV email. Preview: ${preview}`,
            );
          } else {
            job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch khớp lệnh:`);
            mismatchedTradesAll.forEach((t: any) => {
              job.logs.push(
                `- [${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}, Giá ${t.giaKhop}, Qty ${t.klGiaoDich}: ${t.reason}`,
              );
            });
          }
        }
        if (mismatchedPositionsAll.length > 0) {
          if (mismatchedPositionsAll.length > LOG_THRESHOLD) {
            const preview = mismatchedPositionsAll.slice(0, MAX_PREVIEW)
              .map((p: any) => `TK ${p.account}, HĐ ${p.symbol}: MS ${p.msPosition} vs CQG ${p.cqgPosition}`)
              .join(' | ');
            job.logs.push(
              `[${new Date().toISOString()}]  Phát hiện ${mismatchedPositionsAll.length} lệch vị thế Net (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết xem CSV email. Preview: ${preview}`,
            );
          } else {
            job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch vị thế Net:`);
            mismatchedPositionsAll.forEach((p: any) => {
              job.logs.push(
                `- TK ${p.account}, HĐ ${p.symbol}: MS ${p.msPosition} vs CQG ${p.cqgPosition} (Chênh lệch: ${p.differ})`,
              );
            });
          }
        }
        job.logs.push(
          `[${new Date().toISOString()}] Hoàn thành đối chiếu: Phát hiện chênh lệch Pre-EOD (LỆCH). Đã lưu kết quả.`,
        );
        await job.save();
      }
      return result;
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu Pre-EOD tự động: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }

  private async handleCheckEodMmJob(job: any) {
    const payload = parseJobPayload(job);
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy đối chiếu EOD M-System ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckEodMm(targetDate);
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu EOD M-System.`);

      const MAX_PREVIEW = 30;
      const mismatchedEodAll = result.eodResult?.mismatchedEOD ?? [];
      payload.result = result;
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      const totalNegative =
        (result.eodResult?.negativeBalanceAccs?.length || 0) +
        (result.eodResult?.negativeIMRAcc?.length || 0);
      const totalMismatchedEod = mismatchedEodAll.length;

      if (totalNegative > 0 || totalMismatchedEod > 0) {
        if (mismatchedEodAll.length > 0) {
          job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch công thức EOD (QLTKGD vs EOD.csv):`);
          mismatchedEodAll.slice(0, MAX_PREVIEW).forEach((d: any) => {
            const sysTag = d.system ? `[${d.system}]` : '[MS]';
            job.logs.push(
              `- ${sysTag} TK ${d.maTKGD}: Tính toán ${d.calculatedBalance} vs EOD ${d.eodBalance} (Lệch: ${d.differ})`,
            );
          });
        }
        await job.save();
        throw new Error(
          `Phát hiện bất thường EOD MS: ${totalNegative} tài khoản âm margin/số dư, ${totalMismatchedEod} tài khoản lệch công thức EOD.`,
        );
      }
      return result;
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu EOD tự động: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }

  private async handleCheckEodCcpJob(job: any) {
    const payload = parseJobPayload(job);
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy đối chiếu EOD CoreCCP ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckEodCcp(targetDate);
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu EOD CoreCCP.`);

      const MAX_PREVIEW = 50;
      const mismatchedEodAll = result.mismatchedEOD ?? [];
      payload.result = result;
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      const totalNegative =
        (result.negativeBalanceAccs?.length || 0) +
        (result.negativeIMRAcc?.length || 0);
      const totalMismatchedEod = mismatchedEodAll.length;

      job.logs.push(
        `[${new Date().toISOString()}] Kết quả: ${result.totalAccounts || 0} tài khoản CoreCCP. ` +
        `Khớp hoàn toàn: ${(result.totalAccounts || 0) - totalMismatchedEod} TK. ` +
        `Lệch: ${totalMismatchedEod} TK. Âm ký quỹ: ${totalNegative} TK.`,
      );

      if (mismatchedEodAll.length > 0) {
        job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch công thức EOD CoreCCP:`);
        mismatchedEodAll.slice(0, MAX_PREVIEW).forEach((d: any) => {
          job.logs.push(
            `- [CCP] TK ${d.maTKGD}: Tính toán ${d.calculatedBalance} vs EOD ${d.eodBalance} (Lệch: ${d.differ})`,
          );
        });
      }
      await job.save();

      if (totalNegative > 0 || totalMismatchedEod > 0) {
        throw new Error(
          `Phát hiện bất thường EOD CoreCCP: ${totalNegative} tài khoản âm margin/số dư, ${totalMismatchedEod} tài khoản lệch công thức EOD.`,
        );
      }
      return result;
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu EOD CoreCCP: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }

  private async handleCheckCqgSyncJob(job: any) {
    const payload = parseJobPayload(job);
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy đối chiếu đồng bộ số dư CQG ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckCQGSync(targetDate);
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu đồng bộ số dư CQG.`);

      const LOG_THRESHOLD = 50;
      const MAX_PREVIEW = 30;
      const cqgResultAll = result.cqgResult ?? [];
      if (cqgResultAll.length > LOG_THRESHOLD) {
        payload.result = {
          ...result,
          cqgResult: cqgResultAll.slice(0, MAX_PREVIEW),
          cqgResultTotal: cqgResultAll.length,
          isPreviewOnly: true,
        };
      } else {
        payload.result = result;
      }
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      const totalMismatched = cqgResultAll.length;

      if (totalMismatched > 0) {
        if (cqgResultAll.length > LOG_THRESHOLD) {
          const preview = cqgResultAll.slice(0, MAX_PREVIEW)
            .map((d: any) => `TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)}`)
            .join(' | ');
          job.logs.push(
            `[${new Date().toISOString()}]  Phát hiện ${cqgResultAll.length} TK lệch số dư CQG (vượt ngưỡng ${LOG_THRESHOLD}). ` +
            `Chi tiết xem CSV email. Preview: ${preview}`,
          );
        } else {
          job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch số dư CQG:`);
          cqgResultAll.forEach((d: any) => {
            job.logs.push(
              `- TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)} (Chênh lệch: $${d.differ.toFixed(2)})`,
            );
          });
        }
        await job.save();
        throw new Error(
          `Phát hiện lệch số dư CQG: ${totalMismatched} tài khoản lệch vượt ngưỡng $100.`,
        );
      }
      return result;
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu số dư CQG: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }
}
