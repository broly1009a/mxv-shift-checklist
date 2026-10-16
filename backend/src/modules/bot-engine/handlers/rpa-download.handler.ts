import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { RpaScraperService } from '../../ingress/scrapers/rpa-scraper.service';
import { IngressService } from '../../ingress/ingress.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  parseJobPayload,
  getMsBackupBase,
  resolveStoragePathCrossPlatform,
  resolveTradingSessionDate,
  resolveDailySubfolder,
} from '../helpers/bot-path.helper';

@Injectable()
export class RpaDownloadJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(RpaDownloadJobHandler.name);
  readonly jobTypes = ['RPA_DOWNLOAD_REPORTS'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly rpaDownloaderService: RpaScraperService,
    private readonly settingsService: SystemSettingsService,
    @Optional()
    private readonly ingressService?: IngressService,
  ) { }

  onModuleInit() {
    this.registry.register(this);
  }

  public getReportFileName(target: string): string {
    switch (target) {
      case 'NKTTHT':
      case 'NKTHT':
        return 'NKTTHT.xlsx';
      case 'DSTKGD-Futures':
        return 'DSTKGD-Futures.xlsx';
      case 'DSTKGD-Spread':
        return 'DSTKGD-Spread.xlsx';
      case 'DSTKGD-LME':
        return 'DSTKGD-LME.xlsx';
      case 'DSTKGD-ACM':
        return 'DSTKGD-ACM.xlsx';
      case 'QLTKGD':
      case 'QLTTTKGD':
        return 'QLTKGD.xlsx';
      case 'QLTKGDAmKQ':
      case 'QLTKGD âm KQ':
      case 'QLTTTKGDAmKQ':
        return 'QLTKGDAmKQ.xlsx';
      case 'TLKQHSKQ':
      case 'TLQHSKQ':
        return 'TLKQHSKQ.xlsx';
      case 'NR':
        return 'NR.xlsx';
      case 'DSTrader':
        return 'DSTrader.xlsx';
      case 'Markettruoc6h':
      case 'market truoc 6h':
      case 'market truoc 6 h':
        return 'market truoc 6h.csv';
      case 'DSLDK':
        return 'DSLDK.xlsx';
      case 'DSLCK':
        return 'DSLCK.xlsx';
      case 'DSLH':
        return 'DSLH.xlsx';
      case 'DSLK':
        return 'DSLK.xlsx';
      case 'DSGD':
        return 'DSGD.xlsx';
      case 'TTM':
        return 'TTM.xlsx';
      case 'TTTT':
        return 'TTTT.xlsx';
      case 'TTCDH':
        return 'TTCDH.xlsx';
      case 'DSQLKQ':
        return 'DSQLKQ.xlsx';
      default:
        return `${target}.xlsx`;
    }
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const tempDir = path.join(
      process.cwd(),
      'temp',
      'reports',
      job._id.toString(),
    );
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const payload = parseJobPayload(job);
    const targets: string[] = payload.targets || [
      'NKTTHT',
      'NR',
      'QLTKGD',
      'DSGD',
    ];
    const sessionDay: string = payload.sessionDay;

    job.logs.push(
      `[${new Date().toISOString()}] Reports to download: ${targets.join(', ')}`,
    );
    await job.save();

    const isTradingCheck = payload.isTradingCheck === true || payload.purpose === 'CHECK';
    let rawBackupMs = payload.outputDir || payload.backupPathMs;
    if (!rawBackupMs) {
      const msBackupBase = await getMsBackupBase(this.settingsService);
      rawBackupMs = isTradingCheck
        ? (await this.settingsService.getSetting('bot_trading_check_path', '')) ||
          msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck')
        : msBackupBase;
    }
    const backupMsBase = resolveStoragePathCrossPlatform(rawBackupMs);

    let destFolder: string | null = null;
    let resolvedDateStr = new Date().toISOString().split('T')[0];
    if (backupMsBase) {
      const sessionStartStr = await this.settingsService.getSetting(
        'session_start_time',
        '05:00',
      );
      const { dateObj: targetDate, dateStr } = resolveTradingSessionDate(
        sessionDay || payload.targetDate,
        { sessionStartStr },
      );
      resolvedDateStr = dateStr;
      const { fullPath } = resolveDailySubfolder(backupMsBase, targetDate);
      destFolder = fullPath;
      if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder, { recursive: true });
      }
      job.logs.push(
        `[${new Date().toISOString()}] Target ${isTradingCheck ? 'TradingCheck (Đối soát)' : 'Backup MS'} folder: ${destFolder} (Session: ${resolvedDateStr})`,
      );
      await job.save();
    }

    const successfulTargets: string[] = [];
    const failedTargets: Array<{ target: string; error: string }> = [];

    // KIỂM TRA CHẾ ĐỘ DIRECT REST API TỪ CẤU HÌNH CSDL
    const globalMode = await this.settingsService.getSetting('ingress_mode', process.env.INGRESS_MODE || 'PLAYWRIGHT');
    const ingressModeMs = await this.settingsService.getSetting('ingress_mode_ms', process.env.INGRESS_MODE_MS || globalMode);

    if (ingressModeMs === 'REST_API' && this.ingressService) {
      this.logger.log(`[RpaDownloadJobHandler] Kích hoạt Direct REST API Mode cho M-System (Cờ: ingress_mode_ms=REST_API). Bỏ qua mở Chromium!`);
      job.logs.push(`[${new Date().toISOString()}] Kích hoạt Direct REST API Mode cho M-System (MsApiAdapter), không mở trình duyệt...`);
      await job.save();

      const targetDir = destFolder || tempDir;
      try {
        const ingressRes = await this.ingressService.download('MS', {
          targetDirectory: targetDir,
          reportCodes: targets,
          targetDate: resolvedDateStr,
        });

        for (const f of ingressRes.files) {
          successfulTargets.push(f.category || f.fileName);
          job.logs.push(`[${new Date().toISOString()}] [Direct API OK] ${f.fileName} (${(f.fileSize / 1024).toFixed(1)} KB)`);
        }

        job.logs.push(`[${new Date().toISOString()}] Hoàn tất tải ${ingressRes.files.length}/${targets.length} báo cáo M-System qua Direct REST API (${ingressRes.durationMs}ms)`);
        job.status = ingressRes.success ? 'COMPLETED' : 'FAILED';
        if (ingressRes.error) job.error = ingressRes.error;
        await job.save();

        return {
          successfulTargets,
          failedTargets,
          destFolder: targetDir,
          mode: 'DIRECT_REST_API',
        };
      } catch (apiErr: any) {
        this.logger.error(`[RpaDownloadJobHandler] Lỗi Direct REST API (${apiErr.message}), fallback về Playwright...`);
        job.logs.push(`[${new Date().toISOString()}] [WARN] Direct REST API lỗi (${apiErr.message}), kích hoạt Playwright fallback...`);
        await job.save();
      }
    }

    const { browser, page } =
      await this.rpaDownloaderService.loginMSystem(tempDir);

    try {
      for (const target of targets) {
        const filename = this.getReportFileName(target);
        const destFile = path.join(tempDir, filename);
        const finalBackupFile = destFolder ? path.join(destFolder, filename) : null;

        // Skip check: Nếu file đã tồn tại hợp lệ trong thư mục Backup MS (ví dụ từ attempt trước), bỏ qua để tiết kiệm thời gian
        if (finalBackupFile && fs.existsSync(finalBackupFile)) {
          const stats = fs.statSync(finalBackupFile);
          if (stats.size > 100) {
            this.logger.log(
              `[SKIP] Báo cáo ${target} (${filename}) đã tồn tại trong thư mục Backup (${(stats.size / 1024).toFixed(1)} KB), bỏ qua không tải lại.`,
            );
            job.logs.push(
              `[${new Date().toISOString()}] Báo cáo ${target} (${filename}) đã có trong Backup (${(stats.size / 1024).toFixed(1)} KB), bỏ qua.`,
            );
            successfulTargets.push(target);
            await job.save();
            continue;
          }
        }

        job.logs.push(
          `[${new Date().toISOString()}] Downloading report: ${target} (as ${filename})...`,
        );
        await job.save();

        try {
          switch (target) {
            case 'NKTTHT':
            case 'NKTHT':
              await this.rpaDownloaderService.downloadNKTTHT(page, destFile);
              break;
            case 'DSTKGD-Futures':
              await this.rpaDownloaderService.downloadDSTKGDFutures(
                page,
                destFile,
              );
              break;
            case 'DSTKGD-Spread':
              await this.rpaDownloaderService.downloadDSTKGDSpread(
                page,
                destFile,
              );
              break;
            case 'DSTKGD-LME':
              await this.rpaDownloaderService.downloadDSTKGDLME(page, destFile);
              break;
            case 'DSTKGD-ACM':
              await this.rpaDownloaderService.downloadDSTKGDACM(page, destFile);
              break;
            case 'QLTKGD':
            case 'QLTTTKGD':
              await this.rpaDownloaderService.downloadQLTTTKGD(page, destFile);
              break;
            case 'QLTKGDAmKQ':
            case 'QLTKGD âm KQ':
            case 'QLTTTKGDAmKQ':
              await this.rpaDownloaderService.downloadQLTTTKGDAmKQ(
                page,
                destFile,
              );
              break;
            case 'TLKQHSKQ':
            case 'TLQHSKQ':
              await this.rpaDownloaderService.downloadTLKQHSKQ(page, destFile);
              break;
            case 'NR':
              await this.rpaDownloaderService.downloadNR(page, destFile);
              break;
            case 'DSTrader':
              await this.rpaDownloaderService.downloadDSTrader(page, destFile);
              break;
            case 'Markettruoc6h':
            case 'market truoc 6h':
            case 'market truoc 6 h':
              await this.rpaDownloaderService.downloadMarkettruoc6h(
                page,
                destFile,
              );
              break;
            case 'DSLDK':
              await this.rpaDownloaderService.downloadDSLDK(page, destFile);
              break;
            case 'DSLCK':
              await this.rpaDownloaderService.downloadDSLCK(page, destFile);
              break;
            case 'DSLH':
              await this.rpaDownloaderService.downloadDSLH(page, destFile);
              break;
            case 'DSLK':
              await this.rpaDownloaderService.downloadDSLK(page, destFile);
              break;
            case 'DSGD':
              await this.rpaDownloaderService.downloadDSGD(
                page,
                destFile,
                sessionDay,
              );
              break;
            case 'TTM':
              await this.rpaDownloaderService.downloadTTM(page, destFile);
              break;
            case 'TTTT':
              await this.rpaDownloaderService.downloadTTTT(page, destFile);
              break;
            case 'TTCDH':
              await this.rpaDownloaderService.downloadTTCDH(page, destFile);
              break;
            case 'DSQLKQ':
              await this.rpaDownloaderService.downloadDSQLKQ(page, destFile);
              break;
            default:
              this.logger.warn(`Unknown download target skipped: ${target}`);
              job.logs.push(
                `[${new Date().toISOString()}] Warning: Unknown download target skipped: ${target}`,
              );
              continue;
          }

          if (fs.existsSync(destFile)) {
            successfulTargets.push(target);
            job.logs.push(
              `[${new Date().toISOString()}] Downloaded report: ${target} successfully.`,
            );

            // Immediate Copy on Success: Lưu ngay vào thư mục Backup MS
            if (destFolder) {
              const finalBackupFile = path.join(destFolder, filename);
              fs.copyFileSync(destFile, finalBackupFile);
              job.logs.push(
                `[${new Date().toISOString()}] Copied ${filename} to ${finalBackupFile}`,
              );
            }

            // Giãn cách nhẹ 1.5s giữa các báo cáo để tránh API Gateway 429 Too Many Requests
            await page.waitForTimeout(1500);
          } else {
            throw new Error(`File ${filename} không tồn tại sau khi tải!`);
          }
        } catch (targetErr: any) {
          this.logger.error(
            `Error downloading target ${target}: ${targetErr.message}`,
          );
          failedTargets.push({ target, error: targetErr.message });
          job.logs.push(
            `[${new Date().toISOString()}] ERROR downloading ${target}: ${targetErr.message}`,
          );
        }

        await job.save();
      }

      // VÒNG TẢI BỔ SUNG (FAST RETRY): Nếu có báo cáo tạm thời bị nghẽn mạng/gián đoạn, tự động quay lại tải nốt
      if (failedTargets.length > 0) {
        this.logger.log(
          `Có ${failedTargets.length} báo cáo chưa hoàn tất. Tạm nghỉ 3 giây để hệ thống ổn định và tự động tải bổ sung...`,
        );
        job.logs.push(
          `[${new Date().toISOString()}] Có ${failedTargets.length} báo cáo chưa tải xong. Tạm nghỉ 3 giây và tự động tải lại bổ sung...`,
        );
        await job.save();
        await page.waitForTimeout(3000);

        const retryQueue = [...failedTargets];
        for (const item of retryQueue) {
          const filename = this.getReportFileName(item.target);
          const destFile = path.join(tempDir, filename);

          try {
            this.logger.log(`[Tải bổ sung] Đang tải lại: ${item.target}...`);
            job.logs.push(
              `[${new Date().toISOString()}] [Tải bổ sung] Đang tải lại báo cáo: ${item.target}...`,
            );
            await job.save();

            await this.rpaDownloaderService.downloadByTarget(
              page,
              item.target,
              destFile,
              sessionDay,
            );

            if (fs.existsSync(destFile)) {
              if (destFolder) {
                const finalBackupFile = path.join(destFolder, filename);
                fs.copyFileSync(destFile, finalBackupFile);
                job.logs.push(
                  `[${new Date().toISOString()}] [Tải bổ sung] Đã lưu thành công ${filename} vào thư mục Backup.`,
                );
              }
              successfulTargets.push(item.target);
              const idx = failedTargets.findIndex((f) => f.target === item.target);
              if (idx !== -1) failedTargets.splice(idx, 1);
              this.logger.log(`[Tải bổ sung] Báo cáo ${item.target} đã tải thành công!`);
            }
          } catch (retryErr: any) {
            this.logger.warn(
              `[Tải bổ sung] Báo cáo ${item.target} vẫn chưa tải được: ${retryErr.message}`,
            );
            job.logs.push(
              `[${new Date().toISOString()}] [Tải bổ sung] Báo cáo ${item.target} vẫn chưa tải được: ${retryErr.message}`,
            );
          }
          await page.waitForTimeout(1500);
          await job.save();
        }
      }

      if (failedTargets.length > 0) {
        const failedSummary = failedTargets
          .map((f) => `${f.target} (${f.error})`)
          .join('; ');
        job.logs.push(
          `[${new Date().toISOString()}] Hoàn tất ${successfulTargets.length}/${targets.length} báo cáo MS. Có ${failedTargets.length} báo cáo gặp sự cố: ${failedSummary}`,
        );
        await job.save();
        throw new Error(
          `Có ${failedTargets.length}/${targets.length} báo cáo MS tải thất bại: ${failedSummary}`,
        );
      } else {
        job.logs.push(
          `[${new Date().toISOString()}] Hoàn tất thành công toàn bộ ${successfulTargets.length}/${targets.length} báo cáo MS về thư mục Backup!`,
        );
        await job.save();
      }

      return { tempDir, successfulTargets, failedTargets };
    } finally {
      this.logger.log('Closing Playwright browser context.');
      await browser.close().catch((err) => {
        this.logger.error(`Error closing browser: ${err.message}`);
      });
    }
  }
}
