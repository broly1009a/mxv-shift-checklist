import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { CcpCeScraperService, CcpReportConfig, DEFAULT_CCP_REPORTS, DEFAULT_CE_REPORTS } from '../../ingress/scrapers/ccp-ce-scraper.service';
import { IngressService } from '../../ingress/ingress.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { decrypt } from '../utils/crypto';
import {
  parseJobPayload,
  resolveStoragePathCrossPlatform,
  resolveTradingSessionDate,
  resolveDailySubfolder,
} from '../helpers/bot-path.helper';

/**
 * CcpCeDownloadJobHandler — Xử lý Job tải báo cáo từ VNCLEAR CoreCCP / CoreEX.
 *
 * Trigger qua BotJob với jobType: 'DOWNLOAD_CCP_REPORT' hoặc 'DOWNLOAD_CE_REPORT'.
 * Hỗ trợ chuyển đổi 100% sang Direct REST API qua IngressService khi bật cờ:
 *   - ingress_mode_ccp = 'REST_API'
 *   - ingress_mode_ce = 'REST_API'
 */
@Injectable()
export class CcpCeDownloadJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(CcpCeDownloadJobHandler.name);

  readonly jobTypes = ['DOWNLOAD_CCP_REPORT', 'DOWNLOAD_CE_REPORT'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly ccpCeDownloaderService: CcpCeScraperService,
    private readonly settingsService: SystemSettingsService,
    @Optional()
    private readonly ingressService?: IngressService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const { jobType } = job;
    const isCcp = jobType === 'DOWNLOAD_CCP_REPORT';
    const sourceKey = isCcp ? 'CCP' : 'CORE_EX';
    const credKey = isCcp ? 'bot_credentials_ccp' : 'bot_credentials_ce';
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
      `${logPrefix} [${systemLabel}] Bắt đầu tải báo cáo: ${startDate} → ${endDate}`,
    );
    job.logs.push(
      `${logPrefix} [${systemLabel}] [${isTradingCheck ? 'TradingCheck - Đối soát' : 'Backup ca trực'}] Thư mục lưu: ${outputDir}`,
    );
    await job.save();

    // ─── KIỂM TRA CHẾ ĐỘ DIRECT REST API TỪ CẤU HÌNH CSDL ─────────────────
    const globalMode = await this.settingsService.getSetting('ingress_mode', process.env.INGRESS_MODE || 'PLAYWRIGHT');
    const specificModeKey = isCcp ? 'ingress_mode_ccp' : 'ingress_mode_ce';
    const ingressMode = await this.settingsService.getSetting(
      specificModeKey,
      process.env[specificModeKey.toUpperCase()] || globalMode,
    );

    if (ingressMode === 'REST_API' && this.ingressService) {
      this.logger.log(`[CcpCeDownloadJobHandler] Kích hoạt Direct REST API Mode cho ${systemLabel} (Cờ: ${specificModeKey}=REST_API), bỏ qua Chromium!`);
      job.logs.push(`${logPrefix} [${systemLabel}] Kích hoạt Direct REST API Mode (Không mở Chromium)...`);
      await job.save();

      const reportCodes = reports && reports.length > 0 ? reports : ['FULL'];
      const ingressRes = await this.ingressService.download(sourceKey, {
        targetDirectory: outputDir,
        reportCodes,
        targetDate: startDate,
        isFullBackup: reportCodes.includes('FULL') || reportCodes.includes('ALL'),
      });

      for (const f of ingressRes.files) {
        job.logs.push(`${logPrefix} [API Downloaded] ${f.fileName} (${(f.fileSize / 1024).toFixed(1)} KB)`);
      }

      job.logs.push(`${logPrefix} [${systemLabel}] Hoàn tất tải ${ingressRes.files.length} báo cáo qua Direct REST API (${ingressRes.durationMs}ms)`);
      job.status = ingressRes.success ? 'COMPLETED' : 'FAILED';
      if (ingressRes.error) job.error = ingressRes.error;
      await job.save();

      return {
        success: ingressRes.success,
        downloadedCount: ingressRes.files.length,
        outputDir,
        mode: 'DIRECT_REST_API',
      };
    }

    // ─── PLAYWRIGHT FALLBACK NẾU CHƯA BẬT REST_API ──────────────────────────
    const credRaw = await this.settingsService.getSetting(credKey, '');
    let creds: any = {};
    if (credRaw) {
      try {
        creds = JSON.parse(decrypt(credRaw));
      } catch {}
    }

    let success = false;
    try {
      success = await this.ccpCeDownloaderService.run(
        {
          username: creds.username || 'hieptruong',
          password: creds.password || 'Taovipko0!',
          systemUrl: creds.url || '',
          startDate,
          endDate,
          reports: reports as any,
          outputDir,
        },
        (msg: string) => {
          job.logs.push(`[${new Date().toISOString()}] ${msg}`);
        },
      );
    } catch (err: any) {
      job.logs.push(`[${new Date().toISOString()}] Lỗi cào Playwright: ${err.message}`);
      job.error = err.message;
      job.status = 'FAILED';
      await job.save();
      throw err;
    }

    job.status = success ? 'COMPLETED' : 'FAILED';
    await job.save();
    return { success, outputDir, mode: 'PLAYWRIGHT' };
  }
}
