import { Injectable, Logger, Optional } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { RpaScraperService } from '../scrapers/rpa-scraper.service';
import { CcpCeScraperService } from '../scrapers/ccp-ce-scraper.service';
import { IngressService } from '../ingress.service';
import { resolveStoragePathCrossPlatform, decrypt } from '../../../shared';

export interface ReconIngressPipelineOptions {
  targetDate: Date;
  dateStr: string;
  year: string;
  month: string;
  day: string;
  subFolder: string;
  options: {
    checkKlgd?: boolean;
    checkTtm?: boolean;
    checkTttt?: boolean;
  };
  log?: (msg: string) => void;
}

export interface ReconIngressPaths {
  msDailyPath: string;
  cqgDailyPath: string;
  acmDailyPath: string;
  ccpDailyPath: string;
}

export interface ReconIngressResult {
  success: boolean;
  paths: ReconIngressPaths;
  downloadedFiles: string[];
  errors: string[];
  isAborted?: boolean;
  abortReason?: string;
}

/**
 * Phân hệ Ingress: Bộ điều phối tải dữ liệu đa nguồn (MS, CQG, ACM, CCP) phục vụ Đối soát trong phiên
 * Chuyển giao hoàn toàn từ luồng cũ trong recon-jobs.handler.ts sang chuẩn Ingress Architecture V2.
 * Hỗ trợ Barrier Synchronization 70s-120s, Direct REST API / SFTP và Playwright RPA fallback.
 */
@Injectable()
export class ReconIngressPipelineService {
  private readonly logger = new Logger(ReconIngressPipelineService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly rpaScraperService: RpaScraperService,
    @Optional()
    private readonly ccpCeScraperService?: CcpCeScraperService,
    @Optional()
    private readonly ingressService?: IngressService,
  ) {}

  /**
   * Phân giải 4 thư mục dữ liệu kiểm tra giao dịch trong phiên (TradingCheck)
   * Chuẩn C# Tool FormMain.cs#L494 / ChromeBot.cs#L867
   */
  async resolveTradingCheckPaths(targetDate: Date): Promise<ReconIngressPaths> {
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const defaultMsPath = path.join(process.cwd(), 'data', 'backup', 'ms', 'futures');
    const defaultCqgPath = path.join(process.cwd(), 'data', 'backup', 'cqg', 'futures');
    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting('bot_backup_path_ms', defaultMsPath),
    );
    const cqgBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting('bot_backup_path_cqg', defaultCqgPath),
    );
    const acmBackupBase = resolveStoragePathCrossPlatform(
      (await this.settingsService.getSetting('bot_backup_path_acm', '')) ||
        path.join(path.dirname(msBackupBase), 'ACM'),
    );

    let ccpOutputDirFromCreds = '';
    const credCcpRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
    if (credCcpRaw) {
      try {
        const credsParsed = JSON.parse(decrypt(credCcpRaw));
        if (credsParsed && credsParsed.outputDir) {
          ccpOutputDirFromCreds = String(credsParsed.outputDir).trim();
        }
      } catch {}
    }
    const defaultCcpPath = path.join(process.cwd(), 'data', 'backup', 'ccp', 'futures');
    const ccpBackupBase = resolveStoragePathCrossPlatform(
      ccpOutputDirFromCreds ||
      (await this.settingsService.getSetting('bot_backup_path_ccp', '')) ||
      defaultCcpPath,
    );

    const tradingCheckBase = resolveStoragePathCrossPlatform(
      (await this.settingsService.getSetting('bot_trading_check_path', '')) ||
        msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck'),
    );

    const msDailyPath = path.join(tradingCheckBase, subFolder);
    const cqgDailyPath = path.join(
      cqgBackupBase.replace(/Backup CQG[\\/]Futures/i, 'TradingCheck/Futures/CQG').replace(/Backup CQG/i, 'TradingCheck/CQG'),
      subFolder,
    );
    const acmDailyPath = path.join(
      acmBackupBase.replace(/Backup MS[\\/]ACM/i, 'TradingCheck/ACM').replace(/Backup ACM/i, 'TradingCheck/ACM'),
      subFolder,
    );
    const ccpDailyPath = path.join(
      ccpBackupBase.replace(/Backup CCP/i, 'TradingCheck/CCP'),
      subFolder,
    );

    for (const dir of [msDailyPath, cqgDailyPath, acmDailyPath, ccpDailyPath]) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      } catch (err: any) {
        this.logger.warn(`Không thể tạo thư mục ${dir}: ${err.message}`);
      }
    }

    return { msDailyPath, cqgDailyPath, acmDailyPath, ccpDailyPath };
  }

  /**
   * Kích hoạt luồng tải dữ liệu đồng thời 4 bên với rào cản đồng bộ thời gian (Barrier Synchronization)
   */
  async downloadSessionData(params: ReconIngressPipelineOptions): Promise<ReconIngressResult> {
    const { dateStr, options } = params;
    const log = params.log || ((msg: string) => this.logger.log(msg));

    log(`[ReconIngressPipeline] Chuẩn bị và đồng bộ tải dữ liệu từ các hệ thống (M-System, CQG, ACM, CoreCCP) phiên ${dateStr}...`);

    const paths = await this.resolveTradingCheckPaths(params.targetDate);
    const { msDailyPath, cqgDailyPath, acmDailyPath, ccpDailyPath } = paths;

    const errors: string[] = [];
    const downloadedFiles: string[] = [];

    const REQUIRE_ALL_SOURCES_FRESH = true;
    let triggerBarrierResolve: () => void = () => {};
    let triggerBarrierReject: (reason: any) => void = () => {};
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
      cqg1: false,
      cqg2: false,
    };

    const BARRIER_TIMEOUT_MS = 120_000;
    const barrierTimer = setTimeout(() => {
      if (!barrierTriggered && !barrierAborted) {
        abortBarrierIfStrict('ĐỒNG BỘ NGUỒN', 'Hết thời gian chờ các hệ thống cùng sẵn sàng (120s timeout)');
      }
    }, BARRIER_TIMEOUT_MS);

    const checkAllReadyAndTrigger = () => {
      if (barrierAborted) return;
      if (
        readyState.ms &&
        readyState.acm &&
        readyState.ccp &&
        readyState.cqg1 &&
        readyState.cqg2
      ) {
        clearTimeout(barrierTimer);
        if (!barrierAnnounced) {
          barrierAnnounced = true;
          log(' Tất cả các hệ thống (M-System, ACM, CoreCCP, CQG1, CQG2) đã sẵn sàng! BẮT ĐẦU ĐỒNG LOẠT XUẤT BÁO CÁO.');
        }
        triggerBarrierResolve();
      }
    };

    const abortBarrierIfStrict = (source: string, errorMsg: string) => {
      clearTimeout(barrierTimer);
      if (REQUIRE_ALL_SOURCES_FRESH && !barrierTriggered && !barrierAborted) {
        barrierAborted = true;
        abortReason = `Nguồn [${source}] gặp sự cố: ${errorMsg}`;
        log(` TẠM DỪNG TIẾN TRÌNH: ${abortReason}. Hệ thống tạm dừng để tránh so khớp sai lệch khi chưa đủ dữ liệu các bên.`);
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
        log('MS  Bỏ qua M-System theo tùy chọn.');
        readyState.ms = true;
        checkAllReadyAndTrigger();
        return;
      }

      const ingressModeMs = await this.settingsService.getSetting(
        'ingress_mode_ms',
        await this.settingsService.getSetting('ingress_mode', 'REST_API'),
      );

      if (this.ingressService && (ingressModeMs === 'REST_API' || ingressModeMs === 'API')) {
        log('MS [Direct REST API] Khởi động pre-flight kiểm tra phiên xác thực M-System...');
        let preflightSuccess = false;
        try {
          if (this.ingressService.checkHealth) {
            await this.ingressService.checkHealth('MS');
          }
          preflightSuccess = true;
          log('MS [Direct REST API] Pre-flight thành công (Phiên xác thực hợp lệ).');
        } catch (pfErr: any) {
          log(`MS  Pre-flight Direct REST API thất bại (${pfErr.message}). Không mở trình duyệt tự động theo cấu hình REST_API.`);
          errors.push(`MS Direct REST API Pre-flight: ${pfErr.message}`);
          abortBarrierIfStrict('MS Direct REST API Pre-flight', pfErr.message);
          return;
        }

        if (preflightSuccess) {
          readyState.ms = true;
          log('MS [Direct REST API] Đã sẵn sàng kết nối API. Đang chờ CQG và các bên cùng vào vị trí...');
          checkAllReadyAndTrigger();

          try {
            await barrierTriggerPromise;
            log('MS [Direct REST API] Rào cản đã mở! Kích hoạt tải dữ liệu trực tiếp đồng thời...');

            const msTasks: Promise<void>[] = [];

            if (options.checkKlgd !== false) {
              msTasks.push((async () => {
                const dsgdRes = await this.ingressService!.download('MS', {
                  targetDate: dateStr,
                  outputDir: msDailyPath,
                  reportType: 'DSGD',
                });
                if (!dsgdRes || !dsgdRes.success || !dsgdRes.files || dsgdRes.files.length === 0) {
                  throw new Error(
                    `Direct API M-System không tải được file DSGD.xlsx (${dsgdRes?.error || 'Không có file trả về'}). Dừng để bảo vệ tính toàn vẹn dữ liệu.`,
                  );
                }
                const names = (dsgdRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)).join(', ');
                downloadedFiles.push(...(dsgdRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)));
                log(`MS Tải DSGD.xlsx qua Direct API hoàn tất: ${names}`);
              })());
            }

            if (options.checkTtm !== false) {
              msTasks.push((async () => {
                const ttmRes = await this.ingressService!.download('MS', {
                  targetDate: dateStr,
                  outputDir: msDailyPath,
                  reportType: 'TTM',
                });
                if (!ttmRes || !ttmRes.success || !ttmRes.files || ttmRes.files.length === 0) {
                  throw new Error(
                    `Direct API M-System không tải được file TTM.xlsx (${ttmRes?.error || 'Không có file trả về'}). Dừng để bảo vệ tính toàn vẹn dữ liệu.`,
                  );
                }
                const names = (ttmRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)).join(', ');
                downloadedFiles.push(...(ttmRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)));
                log(`MS Tải TTM.xlsx qua Direct API hoàn tất: ${names}`);
              })());
            }

            if (options.checkTttt !== false) {
              msTasks.push((async () => {
                const ttttRes = await this.ingressService!.download('MS', {
                  targetDate: dateStr,
                  outputDir: msDailyPath,
                  reportType: 'TTTT',
                });
                if (!ttttRes || !ttttRes.success || !ttttRes.files || ttttRes.files.length === 0) {
                  throw new Error(
                    `Direct API M-System không tải được file TTTT.xlsx (${ttttRes?.error || 'Không có file trả về'}). Dừng để bảo vệ tính toàn vẹn dữ liệu.`,
                  );
                }
                const names = (ttttRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)).join(', ');
                downloadedFiles.push(...(ttttRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)));
                log(`MS Tải TTTT.xlsx qua Direct API hoàn tất: ${names}`);
              })());
            }

            await Promise.all(msTasks);
            log('MS Đã sẵn sàng dữ liệu đầy đủ qua Direct API đồng bộ thời gian với CQG.');
            return;
          } catch (apiErr: any) {
            log(`MS  Direct API gặp sự cố sau rào cản (${apiErr.message}). Ghi nhận lỗi đối soát...`);
            errors.push(`MS Direct API: ${apiErr.message}`);
            abortBarrierIfStrict('M-System API', apiErr.message);
            return;
          }
        }
      }

      log('MS  [Bước 1: Chuẩn bị] Đang mở trình duyệt và đăng nhập M-System...');
      let browser: any = null;
      let page: any = null;
      try {
        const msSession = await this.rpaScraperService.loginMSystem(msDailyPath);
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
        log('MS  Đã mở màn hình Danh sách giao dịch. Đang chờ các hệ thống khác cùng sẵn sàng...');
        checkAllReadyAndTrigger();

        await barrierTriggerPromise;

        if (options.checkKlgd !== false) {
          log('MS  [Bước 2: Xuất dữ liệu] Đang tải file DSGD.xlsx...');
          // ── CHUẨN 100% THEO TOOL C# (ChromeBot.cs dòng 2375 - 2380) ──────────────
          await page.waitForTimeout(3000);
          const exportIcon = page.locator("xpath=//i[contains(@class, 'fa-file-csv')]").first();
          await exportIcon.waitFor({ state: 'visible', timeout: 10000 });

          const [dl] = await Promise.all([
            page.waitForEvent('download', { timeout: 45000 }),
            exportIcon.click({ timeout: 15000 }),
          ]);

          const dsgdTarget = path.join(msDailyPath, 'DSGD.xlsx');
          await this.rpaScraperService.saveAndValidateDownload(dl, dsgdTarget, 'DSGD');
          downloadedFiles.push('DSGD.xlsx');
          log('MS  Tải DSGD.xlsx thành công.');
        }

        if (options.checkTtm !== false) {
          try {
            log('MS → Tải bổ sung TTM.xlsx...');
            await page.waitForTimeout(2000);
            await this.rpaScraperService.downloadTTM(page, path.join(msDailyPath, 'TTM.xlsx'));
            downloadedFiles.push('TTM.xlsx');
            log('MS  Tải TTM.xlsx thành công.');
          } catch (ttmErr: any) {
            log(`MS  Lỗi tải TTM: ${ttmErr.message}`);
            errors.push(`MS TTM: ${ttmErr.message}`);
          }
        }

        if (options.checkTttt !== false) {
          try {
            log('MS → Tải bổ sung TTTT.xlsx...');
            await page.waitForTimeout(2000);
            await this.rpaScraperService.downloadTTTT(page, path.join(msDailyPath, 'TTTT.xlsx'));
            downloadedFiles.push('TTTT.xlsx');
            log('MS  Tải TTTT.xlsx thành công.');
          } catch (ttttErr: any) {
            log(`MS  Lỗi tải TTTT: ${ttttErr.message}`);
            errors.push(`MS TTTT: ${ttttErr.message}`);
          }
        }
      } catch (err: any) {
        errors.push(`MS DSGD: ${err.message}`);
        log(`MS  Lỗi: ${err.message}`);
        abortBarrierIfStrict('M-System', err.message);
      } finally {
        if (!barrierAborted) {
          readyState.ms = true;
          checkAllReadyAndTrigger();
        }
        if (browser) await browser.close().catch(() => {});
        log('MS  Đã đóng trình duyệt M-System.');
      }
    };

    // ── 2. WORKER ACM (STRAITS NANO) ─────────────────────────────────────────
    const runWorkerAcm = async () => {
      if (options.checkKlgd === false) {
        log('ACM  Bỏ qua ACM theo tùy chọn.');
        readyState.acm = true;
        checkAllReadyAndTrigger();
        return;
      }

      const ingressModeAcm = await this.settingsService.getSetting(
        'ingress_mode_acm',
        await this.settingsService.getSetting('ingress_mode', 'REST_API'),
      );

      if (this.ingressService && (ingressModeAcm === 'REST_API' || ingressModeAcm === 'API')) {
        log('ACM [Direct ETP REST API] Khởi động pre-flight kiểm tra phiên xác thực ACM Web ETP...');
        let preflightSuccess = false;
        try {
          if (this.ingressService.checkHealth) {
            await this.ingressService.checkHealth('ACM');
          }
          preflightSuccess = true;
          log('ACM [Direct ETP REST API] Pre-flight thành công (Phiên xác thực ACM Web ETP sẵn sàng).');
        } catch (pfErr: any) {
          log(`ACM  Pre-flight Direct REST API ACM thất bại (${pfErr.message}). Không mở trình duyệt tự động theo cấu hình REST_API.`);
          errors.push(`ACM Direct REST API Pre-flight: ${pfErr.message}`);
          abortBarrierIfStrict('ACM Direct REST API Pre-flight', pfErr.message);
          return;
        }

        if (preflightSuccess) {
          readyState.acm = true;
          log('ACM [Direct ETP REST API] Đã sẵn sàng kết nối. Đang chờ CQG và các bên cùng vào vị trí...');
          checkAllReadyAndTrigger();

          try {
            await barrierTriggerPromise;
            log('ACM [Direct ETP REST API] Rào cản đã mở! Kích hoạt tải báo cáo Khớp lệnh (Fill.xlsx) từ ACM Web ETP qua REST API...');

            const acmRes = await this.ingressService.download('ACM', {
              targetDate: dateStr,
              outputDir: acmDailyPath,
              reportCodes: ['FILL'],
              mode: 'REST_API',
            });
            const downloadedNames = (acmRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)).join(', ');
            downloadedFiles.push(...(acmRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)));
            log(`ACM Tải Fill.xlsx qua Direct ETP REST API hoàn tất: ${downloadedNames}`);
            log('ACM Đã sẵn sàng dữ liệu Fill.xlsx qua Direct REST API đồng bộ thời gian với CQG.');
            return;
          } catch (acmApiErr: any) {
            log(`ACM  Direct REST API gặp sự cố sau rào cản (${acmApiErr.message}). Ghi nhận lỗi đối soát...`);
            errors.push(`ACM Direct REST API: ${acmApiErr.message}`);
            abortBarrierIfStrict('ACM ETP REST API', acmApiErr.message);
            return;
          }
        }
      } else if (this.ingressService && ingressModeAcm === 'SFTP') {
        log('ACM [Direct SFTP Ingress] Khởi động pre-flight kiểm tra kết nối SFTP...');
        let preflightSuccess = false;
        try {
          if (this.ingressService.checkHealth) {
            await this.ingressService.checkHealth('ACM');
          }
          preflightSuccess = true;
          log('ACM [Direct SFTP] Pre-flight thành công (Cấu hình SFTP sẵn sàng).');
        } catch (pfErr: any) {
          log(`ACM  Pre-flight Direct SFTP thất bại (${pfErr.message}). Không mở trình duyệt tự động theo cấu hình SFTP.`);
          errors.push(`ACM Direct SFTP Pre-flight: ${pfErr.message}`);
          abortBarrierIfStrict('ACM Direct SFTP Pre-flight', pfErr.message);
          return;
        }

        if (preflightSuccess) {
          readyState.acm = true;
          log('ACM [Direct SFTP] Đã sẵn sàng kết nối. Đang chờ CQG và các bên cùng vào vị trí...');
          checkAllReadyAndTrigger();

          try {
            await barrierTriggerPromise;
            log('ACM [Direct SFTP] Rào cản đã mở! Kích hoạt tải Straits.csv từ SFTP...');

            const acmRes = await this.ingressService.download('ACM', {
              targetDate: dateStr,
              outputDir: acmDailyPath,
              reportCodes: ['STRAITS_CSV'],
              mode: 'SFTP',
            });
            const downloadedNames = (acmRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)).join(', ');
            downloadedFiles.push(...(acmRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)));
            log(`ACM Tải Straits.csv qua Direct SFTP hoàn tất: ${downloadedNames}`);
            log('ACM Đã sẵn sàng dữ liệu Straits.csv qua Direct SFTP đồng bộ thời gian với CQG.');
            return;
          } catch (acmApiErr: any) {
            log(`ACM  Direct SFTP gặp sự cố sau rào cản (${acmApiErr.message}). Ghi nhận lỗi đối soát...`);
            errors.push(`ACM Direct SFTP: ${acmApiErr.message}`);
            abortBarrierIfStrict('Straits ACM SFTP', acmApiErr.message);
            return;
          }
        }
      }

      log('ACM  [Bước 1: Chuẩn bị] Đang mở trình duyệt và đăng nhập ACM (giải Captcha)...');
      const jobLogFn = (msg: string) => log(`ACM: ${msg}`);
      let browser: any = null;
      let page: any = null;
      try {
        const acmSession = await this.rpaScraperService.loginACM(acmDailyPath, undefined, jobLogFn);
        browser = acmSession.browser;
        page = acmSession.page;

        const credentialsRaw = await this.settingsService.getSetting('bot_credentials_acm', '');
        let creds: any = {};
        try {
          if (credentialsRaw) creds = JSON.parse(decrypt(credentialsRaw));
        } catch {}

        let baseUrl = page.url().split('#')[0];
        if (!baseUrl || !baseUrl.startsWith('http')) {
          baseUrl = (creds.url || '').split('#')[0];
        }
        try {
          const urlObj = new URL(baseUrl);
          if (!urlObj.pathname.includes('/exchange/index.html') && baseUrl.includes('/exchange')) {
            baseUrl = `${urlObj.origin}/exchange/index.html`;
          }
        } catch {}

        const fillUrl = creds.fillUrl || `${baseUrl}#/business-tetptrade`;

        log(`ACM  Điều hướng đến màn hình Fill: ${fillUrl}...`);
        await page.goto(fillUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
          await page.goto(fillUrl).catch(() => {});
        });
        await page.waitForTimeout(3000).catch(() => {});

        const exportBtnSelector =
          '.el-button--info:has-text("Export"), button:has-text("Export"), button:has-text("Download")';
        await page.waitForSelector(exportBtnSelector, { state: 'visible', timeout: 15000 }).catch(() => {});

        readyState.acm = true;
        log('ACM  Đã mở màn hình Khớp lệnh (Fill). Đang chờ các hệ thống khác cùng sẵn sàng...');
        checkAllReadyAndTrigger();

        await barrierTriggerPromise;

        log('ACM  [Bước 2: Xuất dữ liệu] Đang tải file khớp lệnh Fill.xlsx...');
        const btn = page.locator(exportBtnSelector).first();
        const isVisible = await btn.isVisible().catch(() => false);
        const fillFile = path.join(acmDailyPath, 'Fill.xlsx');

        if (isVisible) {
          const dlPromise = page.waitForEvent('download', { timeout: 35000 });
          await btn.click();
          const dl = await dlPromise;
          await dl.saveAs(fillFile);
          downloadedFiles.push('Fill.xlsx');
          log('ACM  Tải Fill.xlsx thành công.');
        } else {
          await this.rpaScraperService.downloadAcmReport(page, fillFile, fillUrl, jobLogFn);
          downloadedFiles.push('Fill.xlsx');
          log('ACM  Tải báo cáo Fill.xlsx qua fallback thành công.');
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
        if (browser) await browser.close().catch(() => {});
        log('ACM  Đã đóng trình duyệt ACM.');
      }
    };

    // ── 3. WORKER CORECCP (VNCLEAR) ──────────────────────────────────────────
    const runWorkerCcp = async () => {
      const ingressModeCcp = await this.settingsService.getSetting(
        'ingress_mode_ccp',
        await this.settingsService.getSetting('ingress_mode', 'REST_API'),
      );

      if (this.ingressService && (ingressModeCcp === 'REST_API' || ingressModeCcp === 'API')) {
        log('CCP [Direct REST API] Khởi động pre-flight kiểm tra phiên xác thực CoreCCP...');
        let preflightSuccess = false;
        try {
          if (this.ingressService.checkHealth) {
            await this.ingressService.checkHealth('CCP');
          }
          preflightSuccess = true;
          log('CCP [Direct REST API] Pre-flight thành công (Phiên xác thực CoreCCP hợp lệ).');
        } catch (pfErr: any) {
          log(`CCP  Pre-flight Direct API CoreCCP thất bại (${pfErr.message}). Không mở trình duyệt tự động theo cấu hình REST_API.`);
          errors.push(`CoreCCP Direct API Pre-flight: ${pfErr.message}`);
          abortBarrierIfStrict('CoreCCP Direct API Pre-flight', pfErr.message);
          return;
        }

        if (preflightSuccess) {
          readyState.ccp = true;
          log('CCP [Direct REST API] Đã sẵn sàng kết nối API. Đang chờ CQG và các bên cùng vào vị trí...');
          checkAllReadyAndTrigger();

          try {
            await barrierTriggerPromise;
            log('CCP [Direct REST API] Rào cản đã mở! Kích hoạt tải báo cáo CoreCCP đồng thời...');

            const ccpRes = await this.ingressService.download('CCP', {
              targetDate: dateStr,
              outputDir: ccpDailyPath,
              reportType: 'CL_MATCH',
              reportCodes: ['DSGD_CCP', 'TTM_CCP', 'TTTT'],
              mode: 'REST_API',
            });
            if (!ccpRes || !ccpRes.success || !ccpRes.files || ccpRes.files.length === 0) {
              throw new Error(`Direct API CoreCCP không tải được file nào (${ccpRes?.error || '0 files returned'})`);
            }
            const ccpFilesList = (ccpRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)).join(', ');
            downloadedFiles.push(...(ccpRes.files || []).map((f: any) => (typeof f === 'string' ? f : f.fileName || f.name)));
            log(`CCP Tải báo cáo CoreCCP qua Direct API hoàn tất: ${ccpFilesList}`);
            log('CCP Đã sẵn sàng dữ liệu CoreCCP qua Direct API đồng bộ thời gian với CQG.');
            return;
          } catch (ccpApiErr: any) {
            log(`CCP  Direct API CoreCCP gặp sự cố sau rào cản (${ccpApiErr.message}). Ghi nhận lỗi đối soát...`);
            errors.push(`CCP Direct API: ${ccpApiErr.message}`);
            abortBarrierIfStrict('CoreCCP API', ccpApiErr.message);
            return;
          }
        }
      }

      const ccpService = this.ccpCeScraperService;
      if (!ccpService) {
        log('CCP  Dịch vụ CcpCeScraperService chưa được khởi tạo. Bỏ qua.');
        readyState.ccp = true;
        checkAllReadyAndTrigger();
        return;
      }

      const credRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
      if (!credRaw) {
        log('CCP  Chưa cấu hình tài khoản CoreCCP. Bỏ qua.');
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
        log('CCP  Cấu hình CoreCCP thiếu url/username/password. Bỏ qua.');
        readyState.ccp = true;
        checkAllReadyAndTrigger();
        return;
      }

      log('CCP  [Bước 1: Chuẩn bị] Đang mở trình duyệt và đăng nhập CoreCCP...');
      const dateFormatted = `${params.day}/${params.month}/${params.year}`;
      let ccpSession: any = null;
      try {
        ccpSession = await ccpService.prepareKlgdSession({
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
        log('CCP  Đã mở màn hình Danh sách giao dịch. Đang chờ các hệ thống khác cùng sẵn sàng...');
        checkAllReadyAndTrigger();

        await barrierTriggerPromise;

        log('CCP  [Bước 2: Xuất dữ liệu] Đang tải file DSGD từ CoreCCP...');
        const dsgdFile = await ccpSession.triggerExportDsgd();
        if (dsgdFile) downloadedFiles.push(path.basename(dsgdFile));
        log(`CCP  Tải DSGD hoàn tất: ${dsgdFile || 'Không có dữ liệu'}`);

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
        if (ccpSession) await ccpSession.close().catch(() => {});
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
        log('CQG  Bỏ qua CQG theo tùy chọn.');
        readyState.cqg1 = true;
        readyState.cqg2 = true;
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

        log(`CQG  [Bước 1: Chuẩn bị] Mở đồng thời 2 tài khoản CQG1 & CQG2 chuẩn bị tải: ${Object.keys(filesToDownload).join(', ')}...`);

        const onReadyBarrierCqg1 = async () => {
          readyState.cqg1 = true;
          log('CQG1  Đã vào màn hình FR1. Đang chờ các hệ thống khác cùng sẵn sàng...');
          checkAllReadyAndTrigger();
          await barrierTriggerPromise;
          log('CQG1  [Bước 2: Xuất dữ liệu] Đang tải file khớp lệnh FR1.xlsx...');
        };

        const onReadyBarrierCqg2 = async () => {
          readyState.cqg2 = true;
          log('CQG2  Đã vào màn hình FR2. Đang chờ các hệ thống khác cùng sẵn sàng...');
          checkAllReadyAndTrigger();
          await barrierTriggerPromise;
          log('CQG2  [Bước 2: Xuất dữ liệu] Đang tải file khớp lệnh FR2.xlsx...');
        };

        const cqgTimeoutMs = 240000;
        const cqgPromise = this.rpaScraperService.downloadCqgBackup(
          filesToDownload,
          cqgDailyPath,
          onReadyBarrierCqg1,
          onReadyBarrierCqg2,
        );
        const timeoutPromise = new Promise<{ errors: string[]; downloaded: string[] }>((_, reject) =>
          setTimeout(() => reject(new Error('Hết thời gian chờ tối đa (4 phút) khi mở trình duyệt và tải file từ CQG.')), cqgTimeoutMs),
        );
        const result = await Promise.race([cqgPromise, timeoutPromise]);

        if (result.downloaded.length > 0) {
          downloadedFiles.push(...result.downloaded);
          log(`CQG  Đã tải: ${result.downloaded.join(', ')}.`);
        }
        if (result.errors.length > 0) {
          errors.push(...result.errors.map((e) => `CQG: ${e}`));
          log(`CQG  Lỗi: ${result.errors.join(' | ')}`);
        }
      } catch (err: any) {
        errors.push(`CQG: ${err.message}`);
        log(`CQG  Lỗi: ${err.message}`);
        abortBarrierIfStrict('CQG', err.message);
      } finally {
        if (!barrierAborted) {
          readyState.cqg1 = true;
          readyState.cqg2 = true;
          checkAllReadyAndTrigger();
        }
        log('CQG  Đã hoàn tất và đóng trình duyệt CQG.');
      }
    };

    // ── BỘ ĐIỀU KHIỂN ĐỒNG BỘ ─────────────────────────────────────────────────
    const startBarrierController = async () => {
      const waitStart = Date.now();
      const maxWaitMs = 70000;
      while (Date.now() - waitStart < maxWaitMs) {
        if (barrierAborted) return;
        if (
          readyState.ms &&
          readyState.acm &&
          readyState.ccp &&
          readyState.cqg1 &&
          readyState.cqg2
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!barrierTriggered && !barrierAborted) {
        log(' Hết thời gian chờ chuẩn bị (70s). Bắt đầu xuất file từ các hệ thống đã sẵn sàng...');
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

    if (barrierAborted) {
      log(` QUY TRÌNH ĐỐI SOÁT TẠM DỪNG: ${abortReason}. Hệ thống không thực hiện so khớp khi chưa đủ dữ liệu.`);
      return {
        success: false,
        paths,
        downloadedFiles,
        errors,
        isAborted: true,
        abortReason,
      };
    }

    // ── MA TRẬN KIỂM SOÁT TOÀN VẸN DỮ LIỆU ĐỐI SOÁT (FAIL-FAST DATA INTEGRITY GATE) ──
    if (errors.length > 0) {
      const blockingErrors: string[] = [];

      for (const errStr of errors) {
        if (options.checkKlgd !== false) {
          if (
            errStr.includes('MS') ||
            errStr.includes('DSGD') ||
            errStr.includes('ACM') ||
            errStr.includes('Straits') ||
            errStr.includes('CQG') ||
            errStr.includes('FR') ||
            (errStr.includes('CCP') && !errStr.includes('TTM') && !errStr.includes('TTTT'))
          ) {
            blockingErrors.push(errStr);
            continue;
          }
        }
        if (options.checkTtm !== false) {
          if (errStr.includes('TTM') || errStr.includes('OP')) {
            blockingErrors.push(errStr);
            continue;
          }
        }
        if (options.checkTttt !== false) {
          if (errStr.includes('TTTT') || errStr.includes('PS')) {
            blockingErrors.push(errStr);
            continue;
          }
        }
        blockingErrors.push(errStr);
      }

      if (blockingErrors.length > 0) {
        const errorMsg = `Thiếu dữ liệu đồng bộ tươi do lỗi từ hệ thống: ${blockingErrors.join(' | ')}. Dừng đối chiếu để bảo vệ tính toàn vẹn số liệu và kích hoạt cơ chế chạy lại (Retry).`;
        log(` DỪNG ĐỐI SOÁT (FAIL-FAST): ${errorMsg}`);
        return {
          success: false,
          paths,
          downloadedFiles,
          errors,
          isAborted: true,
          abortReason: errorMsg,
        };
      }
    }

    log(' Hoàn tất quy trình tải dữ liệu đồng bộ tươi từ các nguồn.');
    return {
      success: true,
      paths,
      downloadedFiles,
      errors,
    };
  }
}
