import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import * as path from 'path';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { LotStatisticsService } from '../../trading-ops/services/lot-statistics.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { CcpLotWorker } from '../../trading-ops/workers/ccp-lot.worker';
import {
  parseJobPayload,
  getMsBackupBase,
  getCqgBackupBase,
  resolveStoragePathCrossPlatform,
} from '../helpers/bot-path.helper';

@Injectable()
export class MacroLotJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(MacroLotJobHandler.name);
  readonly jobTypes = ['RUN_LOT_MACRO'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly settingsService: SystemSettingsService,
    @Optional()
    private readonly lotStatisticsService?: LotStatisticsService,
    @Optional()
    private readonly ccpLotWorker?: CcpLotWorker,
  ) { }

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const payload = parseJobPayload(job);
    const targetDateStr = payload.targetDate; // Định dạng YYYY-MM-DD
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate (YYYY-MM-DD) trong payload.');
    }

    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise
        .then(() => job.save())
        .catch((err) => {
          this.logger.error(
            `Error saving bot job in handleRunLotMacroJob: ${err.message}`,
          );
        });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    const targetDate = new Date(targetDateStr);
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');

    log(`[Macro Thống kê Số Lốt] Bắt đầu chạy tính toán [Thống kê số lốt giao dịch V2] cho ngày: ${targetDateStr}`);
    await safeSave();

    try {
      const backupMs = resolveStoragePathCrossPlatform(
        payload.backupPathMs || (await getMsBackupBase(this.settingsService)),
      );
      const backupCqg = resolveStoragePathCrossPlatform(
        payload.backupPathCqg || (await getCqgBackupBase(this.settingsService)),
      );

      const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
      const folderPathMs = path.join(backupMs, subFolder);
      const folderPathCqg = path.join(backupCqg, subFolder);

      log(`Thư mục MS: ${folderPathMs}`);
      log(`Thư mục CQG: ${folderPathCqg}`);
      await safeSave();

      let workerRes: any = null;
      if (this.ccpLotWorker) {
        log(`[CcpLotWorker V2] Đang kích hoạt phân tích & thống kê số Lot...`);
        workerRes = await this.ccpLotWorker.execute({
          taskId: payload.taskId || `MACRO_LOT_${job._id}`,
          botCheckType: 'CCP_LOT_STATS',
          shiftId: payload.shiftLogId,
          targetDate: targetDateStr,
          parameters: { folderPath: folderPathMs },
        });
        log(`[CcpLotWorker V2] ${workerRes.summary}`);
      } else if (this.lotStatisticsService) {
        const stats = this.lotStatisticsService.runAutoLotStatistics(folderPathMs);
        workerRes = {
          status: stats.passed ? 'SUCCESS' : 'WARNING',
          summary: `Thống kê Lot: DSGD=${stats.summary.dsgdTotal}, FR=${stats.summary.frTotal}, Lệch KLGD=${stats.summary.differKlgd}`,
          metrics: stats.summary,
        };
        log(`[LotStatisticsService V2] ${workerRes.summary}`);
      }

      await safeSave();
      return workerRes || { success: true };
    } catch (err: any) {
      log(` Lỗi chạy thống kê số lot: ${err.message}`);
      await safeSave();
      throw err;
    }
  }
}

