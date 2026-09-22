import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { RpaDownloaderService } from '../rpa-downloader.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { parseJobPayload, getMsBackupBase } from '../helpers/bot-path.helper';

@Injectable()
export class RpaDownloadJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(RpaDownloadJobHandler.name);
  readonly jobTypes = ['RPA_DOWNLOAD_REPORTS'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly rpaDownloaderService: RpaDownloaderService,
    private readonly settingsService: SystemSettingsService,
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

    const { browser, page } =
      await this.rpaDownloaderService.loginMSystem(tempDir);

    const backupMsBase =
      payload.backupPathMs ||
      (await getMsBackupBase(this.settingsService));

    let destFolder: string | null = null;
    if (backupMsBase) {
      const targetDate = sessionDay ? new Date(sessionDay) : new Date();
      const year = targetDate.getFullYear().toString();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      const subFolder = path.join(
        year,
        `T${month}.${year}`,
        `${day}.${month}`,
      );
      destFolder = path.join(backupMsBase, subFolder);
      if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder, { recursive: true });
      }
      job.logs.push(
        `[${new Date().toISOString()}] Target Backup MS folder: ${destFolder}`,
      );
      await job.save();
    }

    const successfulTargets: string[] = [];
    const failedTargets: Array<{ target: string; error: string }> = [];

    try {
      for (const target of targets) {
        const filename = this.getReportFileName(target);
        const destFile = path.join(tempDir, filename);
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

      if (failedTargets.length > 0) {
        const failedSummary = failedTargets
          .map((f) => `${f.target} (${f.error})`)
          .join('; ');
        if (successfulTargets.length === 0) {
          throw new Error(
            `Tải toàn bộ ${targets.length} báo cáo thất bại: ${failedSummary}`,
          );
        }
        job.logs.push(
          `[${new Date().toISOString()}] Hoàn tất ${successfulTargets.length}/${targets.length} báo cáo MS. Có ${failedTargets.length} báo cáo gặp sự cố: ${failedSummary}`,
        );
        await job.save();
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
