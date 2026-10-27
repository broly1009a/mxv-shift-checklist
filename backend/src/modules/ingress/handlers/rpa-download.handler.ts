import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../../checklist-hub/queue/job-handler.interface';
import { BotJobHandlerRegistry } from '../../checklist-hub/queue/job-handler.registry';
import { IngressService } from '../ingress.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  parseJobPayload,
  getMsBackupBase,
  resolveStoragePathCrossPlatform,
  resolveTradingSessionDate,
  resolveDailySubfolder,
} from '../../../shared/helpers/file-path.helper';

/**
 * RpaDownloadJobHandler — Điều phối Job tải báo cáo từ M-System.
 *
 * Trigger qua BotJob với jobType: 'RPA_DOWNLOAD_REPORTS'.
 * Hoàn toàn Data-driven và ủy quyền 100% cho IngressService (fail-fast, zero silent swallow, zero fallback).
 */
@Injectable()
export class RpaDownloadJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(RpaDownloadJobHandler.name);
  readonly jobTypes = ['RPA_DOWNLOAD_REPORTS'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly settingsService: SystemSettingsService,
    private readonly ingressService: IngressService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  /**
   * Helper ánh xạ mã báo cáo sang tên file chuẩn (phục vụ test & backwards compatibility).
   */
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
    const logPrefix = `[${new Date().toISOString()}]`;
    job.logs = job.logs || [];

    const payload = parseJobPayload(job);
    const targets: string[] = payload.targets || [
      'NKTTHT',
      'NR',
      'QLTKGD',
      'DSGD',
    ];
    const sessionDay: string = payload.sessionDay;

    job.logs.push(
      `${logPrefix} [M-System] Danh sách báo cáo cần tải: ${targets.join(', ')}`,
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

    let destFolder = path.join(process.cwd(), 'temp', 'reports', job._id?.toString() || 'ms');
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
    }

    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    job.logs.push(
      `${logPrefix} [M-System] [${isTradingCheck ? 'TradingCheck (Đối soát)' : 'Backup MS'}] Thư mục lưu: ${destFolder} (Phiên: ${resolvedDateStr})`,
    );
    await job.save();

    this.logger.log(`[RpaDownloadJobHandler] Điều phối IngressService tải ${targets.length} báo cáo M-System về ${destFolder}`);

    const ingressRes = await this.ingressService.download('MS', {
      targetDirectory: destFolder,
      reportCodes: targets,
      targetDate: resolvedDateStr,
    });

    const successfulTargets: string[] = [];
    for (const f of ingressRes.files) {
      successfulTargets.push(f.category || f.fileName);
      const sizeKb = f.fileSize ? (f.fileSize / 1024).toFixed(1) : '0';
      job.logs.push(`${logPrefix} [M-System OK] ${f.fileName} (${sizeKb} KB)`);
    }

    if (!ingressRes.success || ingressRes.files.length === 0) {
      const errorMsg = ingressRes.error || `Không thể tải báo cáo M-System nào cho phiên ${resolvedDateStr}.`;
      this.logger.error(`[RpaDownloadJobHandler] Tải báo cáo M-System thất bại: ${errorMsg}`);
      job.logs.push(`${logPrefix} [M-System] [LỖI] Tải thất bại: ${errorMsg}`);
      job.error = errorMsg;
      job.status = 'FAILED';
      await job.save();
      throw new Error(`[M-System] Tải báo cáo thất bại: ${errorMsg}`);
    }

    job.logs.push(
      `${logPrefix} [M-System] Hoàn tất tải ${ingressRes.files.length}/${targets.length} báo cáo thành công (${ingressRes.durationMs}ms)`,
    );
    job.status = 'COMPLETED';
    await job.save();

    return {
      success: true,
      successfulTargets,
      downloadedCount: ingressRes.files.length,
      destFolder,
      durationMs: ingressRes.durationMs,
    };
  }
}
