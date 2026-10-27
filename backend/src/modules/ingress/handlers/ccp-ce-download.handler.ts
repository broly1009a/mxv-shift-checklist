import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../../checklist-hub/queue/job-handler.interface';
import { BotJobHandlerRegistry } from '../../checklist-hub/queue/job-handler.registry';
import { IngressService } from '../ingress.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  parseJobPayload,
  resolveStoragePathCrossPlatform,
  resolveTradingSessionDate,
  resolveDailySubfolder,
} from '../../../shared/helpers/file-path.helper';

/**
 * CcpCeDownloadJobHandler — Điều phối Job tải báo cáo từ VNCLEAR CoreCCP / CoreEX.
 *
 * Trigger qua BotJob với jobType: 'DOWNLOAD_CCP_REPORT' hoặc 'DOWNLOAD_CE_REPORT'.
 * Hoàn toàn Data-driven và ủy quyền 100% cho IngressService (fail-fast, zero silent swallow, zero fallback).
 */
@Injectable()
export class CcpCeDownloadJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(CcpCeDownloadJobHandler.name);

  readonly jobTypes = ['DOWNLOAD_CCP_REPORT', 'DOWNLOAD_CE_REPORT'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly settingsService: SystemSettingsService,
    private readonly ingressService: IngressService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const { jobType } = job;
    const isCcp = jobType === 'DOWNLOAD_CCP_REPORT';
    const sourceKey = isCcp ? 'CCP' : 'CORE_EX';
    const systemLabel = isCcp ? 'CoreCCP' : 'CoreEX';

    const payload = parseJobPayload(job);
    const rawStart = payload.startDate || payload.sessionDay || new Date().toISOString().split('T')[0];
    const rawEnd = payload.endDate || payload.sessionDay || rawStart;

    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    const resolvedStart = resolveTradingSessionDate(rawStart, { sessionStartStr });
    const resolvedEnd = resolveTradingSessionDate(rawEnd, { sessionStartStr });
    const startDate: string = resolvedStart.dateStr;
    const endDate: string = resolvedEnd.dateStr;

    const isTradingCheck = payload.isTradingCheck === true || payload.purpose === 'CHECK';

    let baseDir: string = payload.outputDir;
    if (!baseDir) {
      const backupSettingKey = isCcp ? 'bot_backup_path_ccp' : 'bot_backup_path_ce';
      const defaultSettingPath = isCcp
        ? path.join(process.cwd(), 'data', 'backup', 'CCP')
        : path.join(process.cwd(), 'data', 'backup', 'CoreExchange');
      baseDir = await this.settingsService.getSetting(backupSettingKey, defaultSettingPath);
      if (isTradingCheck) {
        baseDir = baseDir.replace(/Backup CCP/i, 'TradingCheck/CCP').replace(/Backup CE/i, 'TradingCheck/CE');
      }
    }

    const { subFolder } = resolveDailySubfolder(baseDir, resolvedStart.dateObj);
    let rawOutputDir = baseDir;
    if (!/\d{2}\.\d{2}$/.test(rawOutputDir.trim())) {
      rawOutputDir = path.join(baseDir, subFolder);
    }
    const outputDir: string = resolveStoragePathCrossPlatform(rawOutputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const reports: string[] | undefined = payload.reports;

    const logPrefix = `[${new Date().toISOString()}]`;
    job.logs = job.logs || [];
    job.logs.push(
      `${logPrefix} [${systemLabel}] Bắt đầu điều phối tải báo cáo: ${startDate} → ${endDate}`,
    );
    job.logs.push(
      `${logPrefix} [${systemLabel}] [${isTradingCheck ? 'TradingCheck - Đối soát' : 'Backup ca trực'}] Thư mục lưu: ${outputDir}`,
    );
    await job.save();

    const reportCodes = reports && reports.length > 0 ? reports : ['FULL'];
    const isFullBackup = reportCodes.includes('FULL') || reportCodes.includes('ALL');

    this.logger.log(`[CcpCeDownloadJobHandler] Gửi yêu cầu tải ${reportCodes.length} báo cáo ${systemLabel} tới IngressService`);

    const ingressRes = await this.ingressService.download(sourceKey, {
      targetDirectory: outputDir,
      reportCodes,
      targetDate: startDate,
      isFullBackup,
    });

    for (const f of ingressRes.files) {
      const sizeKb = f.fileSize ? (f.fileSize / 1024).toFixed(1) : '0';
      job.logs.push(`${logPrefix} [Tải thành công] ${f.fileName} (${sizeKb} KB)`);
    }

    if (!ingressRes.success || ingressRes.files.length === 0) {
      const errorMsg = ingressRes.error || `Không tải được báo cáo nào từ ${systemLabel}.`;
      this.logger.error(`[CcpCeDownloadJobHandler] Lỗi tải báo cáo ${systemLabel}: ${errorMsg}`);
      job.logs.push(`${logPrefix} [${systemLabel}] [LỖI] Tải thất bại: ${errorMsg}`);
      job.error = errorMsg;
      job.status = 'FAILED';
      await job.save();
      throw new Error(`[${systemLabel}] Tải báo cáo thất bại: ${errorMsg}`);
    }

    job.logs.push(
      `${logPrefix} [${systemLabel}] Hoàn tất tải ${ingressRes.files.length} báo cáo thành công (${ingressRes.durationMs}ms)`,
    );
    job.status = 'COMPLETED';
    await job.save();

    return {
      success: true,
      downloadedCount: ingressRes.files.length,
      outputDir,
      files: ingressRes.files,
      durationMs: ingressRes.durationMs,
    };
  }
}
