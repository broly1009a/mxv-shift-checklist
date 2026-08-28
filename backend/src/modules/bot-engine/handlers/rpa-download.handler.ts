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
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  public getReportFileName(target: string): string {
    switch (target) {
      case 'NKTTHT':
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
        return 'QLTKGDAmKQ.xlsx';
      case 'TLKQHSKQ':
        return 'TLKQHSKQ.xlsx';
      case 'NR':
        return 'NR.xlsx';
      case 'DSTrader':
        return 'DSTrader.xlsx';
      case 'Markettruoc6h':
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

    try {
      for (const target of targets) {
        const filename = this.getReportFileName(target);
        const destFile = path.join(tempDir, filename);
        job.logs.push(
          `[${new Date().toISOString()}] Downloading report: ${target} (as ${filename})...`,
        );
        await job.save();

        switch (target) {
          case 'NKTTHT':
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
            await this.rpaDownloaderService.downloadQLTTTKGDAmKQ(
              page,
              destFile,
            );
            break;
          case 'TLKQHSKQ':
            await this.rpaDownloaderService.downloadTLKQHSKQ(page, destFile);
            break;
          case 'NR':
            await this.rpaDownloaderService.downloadNR(page, destFile);
            break;
          case 'DSTrader':
            await this.rpaDownloaderService.downloadDSTrader(page, destFile);
            break;
          case 'Markettruoc6h':
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
          default:
            this.logger.warn(`Unknown download target skipped: ${target}`);
            job.logs.push(
              `[${new Date().toISOString()}] Warning: Unknown download target skipped: ${target}`,
            );
        }

        job.logs.push(
          `[${new Date().toISOString()}] Downloaded report: ${target} successfully.`,
        );
        await job.save();
      }

      const backupMsBase =
        payload.backupPathMs ||
        (await getMsBackupBase(this.settingsService));

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
        const destFolder = path.join(backupMsBase, subFolder);

        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true });
        }

        job.logs.push(
          `[${new Date().toISOString()}] Copying downloaded reports to Backup MS folder: ${destFolder}`,
        );
        for (const target of targets) {
          const filename = this.getReportFileName(target);
          const srcFile = path.join(tempDir, filename);
          if (fs.existsSync(srcFile)) {
            const destFile = path.join(destFolder, filename);
            fs.copyFileSync(srcFile, destFile);
            job.logs.push(
              `[${new Date().toISOString()}] ✅ Copied ${filename} to ${destFile}`,
            );
          }
        }
        await job.save();
      }
      return { tempDir };
    } finally {
      this.logger.log('Closing Playwright browser context.');
      await browser.close().catch((err) => {
        this.logger.error(`Error closing browser: ${err.message}`);
      });
    }
  }
}
