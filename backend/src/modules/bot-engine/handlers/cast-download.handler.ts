import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { RpaDownloaderService } from '../rpa-downloader.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { parseJobPayload, getCqgBackupBase } from '../helpers/bot-path.helper';

@Injectable()
export class CastDownloadJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(CastDownloadJobHandler.name);
  readonly jobTypes = ['DOWNLOAD_CAST'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly rpaDownloaderService: RpaDownloaderService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');
    if (!fs.existsSync(castDownloadsDir)) {
      fs.mkdirSync(castDownloadsDir, { recursive: true });
    }

    const payload = parseJobPayload(job);
    const dateStr = new Date(Date.now() + 7 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '');
    const filename = `Accounts_Balances_${dateStr}_${Date.now()}.xlsx`;
    const destFile = path.join(castDownloadsDir, filename);

    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy bot RPA CQG CAST để tải báo cáo số dư...`,
    );
    job.logs.push(
      `[${new Date().toISOString()}] Đường dẫn lưu file dự kiến: ${destFile}`,
    );
    await job.save();

    try {
      await this.rpaDownloaderService.downloadCastBalances(destFile);
      job.logs.push(
        `[${new Date().toISOString()}] Đã tải thành công file CAST về: ${destFile}`,
      );

      payload.downloadedFile = destFile;
      job.payload = payload;
      await job.save();

      const baseBackupPath =
        payload.backupPath ||
        (await getCqgBackupBase(this.settingsService));

      if (baseBackupPath) {
        const targetDateStr = payload.targetDate;
        const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();

        const year = targetDate.getFullYear().toString();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const subFolder = path.join(
          year,
          `T${month}.${year}`,
          `${day}.${month}`,
        );

        const customBackupPath = path.join(baseBackupPath, subFolder);

        job.logs.push(
          `[${new Date().toISOString()}] Đang copy và đổi tên file sang thư mục backup: ${customBackupPath}`,
        );
        await job.save();

        if (!fs.existsSync(customBackupPath)) {
          fs.mkdirSync(customBackupPath, { recursive: true });
        }

        const targetBackupFile = path.join(
          customBackupPath,
          'Accounts_Balances.xlsx',
        );
        fs.copyFileSync(destFile, targetBackupFile);

        job.logs.push(
          `[${new Date().toISOString()}] ✅ Đã copy và đổi tên thành công: ${targetBackupFile}`,
        );
        await job.save();
      }
      return { downloadedFile: destFile };
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi trong quá trình chạy RPA CQG CAST: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }
}
