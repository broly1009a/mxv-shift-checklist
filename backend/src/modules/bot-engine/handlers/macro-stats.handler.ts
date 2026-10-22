import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { CcpLotStatisticsService } from '../../trading-ops/services/ccp-lot-statistics.service';
import { CeLotStatisticsService } from '../../trading-ops/services/ce-lot-statistics.service';
import { parseJobPayload } from '../helpers/bot-path.helper';

/**
 * Handler quản lý các tác vụ Thống kê Lot, Giá Trị & Macro (CCP & CE) trong BotJobQueue.
 * Hỗ trợ:
 *  - RUN_MACRO / CCP_STATISTICS: Macro toàn diện CoreCCP (Lot + GTGD)
 *  - RUN_LOT_MACRO / CCP_LOT_STATS: Thống kê số Lot CoreCCP
 *  - RUN_VALUE_MACRO / CCP_VALUE_STATS: Thống kê Giá trị giao dịch CoreCCP
 *  - RUN_MACRO_CE / CE_STATISTICS: Macro toàn diện CoreEX (ACM Nano)
 */
@Injectable()
export class MacroStatsJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(MacroStatsJobHandler.name);

  readonly jobTypes = [
    'RUN_MACRO',
    'CCP_STATISTICS',
    'RUN_LOT_MACRO',
    'CCP_LOT_STATS',
    'RUN_VALUE_MACRO',
    'CCP_VALUE_STATS',
    'RUN_MACRO_CE',
    'CE_STATISTICS',
    'CE_LOT_STATS',
    'CE_VALUE_STATS',
  ];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly ccpLotStatisticsService: CcpLotStatisticsService,
    private readonly ceLotStatisticsService: CeLotStatisticsService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const payload = parseJobPayload(job);
    const jobType = job.jobType;
    const targetDateStr = payload.targetDate || payload.sessionDay || new Date().toISOString().split('T')[0];
    const user = payload.userId ? { id: payload.userId, username: payload.username || 'SYSTEM' } : undefined;

    this.logger.log(`[MacroStatsJobHandler] Tiếp nhận xử lý Job ${jobType} ngày ${targetDateStr} (ID: ${job._id})`);
    job.logs.push(`[${new Date().toISOString()}] [MacroStats] Bắt đầu thực thi ${jobType} cho ngày ${targetDateStr}...`);
    await job.save();

    let result: any;

    if (jobType === 'RUN_MACRO' || jobType === 'CCP_STATISTICS') {
      result = await this.ccpLotStatisticsService.runFullMacroStatisticsDirect(targetDateStr, user);
    } else if (jobType === 'RUN_LOT_MACRO' || jobType === 'CCP_LOT_STATS') {
      result = await this.ccpLotStatisticsService.runLotStatisticsDirect(targetDateStr, user);
    } else if (jobType === 'RUN_VALUE_MACRO' || jobType === 'CCP_VALUE_STATS') {
      result = await this.ccpLotStatisticsService.runValueStatisticsDirect(targetDateStr, user);
    } else if (jobType === 'RUN_MACRO_CE' || jobType === 'CE_STATISTICS') {
      const lotRes = await this.ceLotStatisticsService.runLotStatisticsDirect(targetDateStr, { forceOverwrite: payload.forceOverwrite }, user);
      const valRes = await this.ceLotStatisticsService.runValueStatisticsDirect(targetDateStr, { forceOverwrite: payload.forceOverwrite }, user);
      result = {
        success: lotRes.success && valRes.success,
        message: `${lotRes.message || ''} | ${valRes.message || ''}`,
        lotResult: lotRes,
        valueResult: valRes,
        logs: [...(lotRes.logs || []), ...(valRes.logs || [])],
      };
    } else if (jobType === 'CE_LOT_STATS') {
      result = await this.ceLotStatisticsService.runLotStatisticsDirect(targetDateStr, { forceOverwrite: payload.forceOverwrite }, user);
    } else if (jobType === 'CE_VALUE_STATS') {
      result = await this.ceLotStatisticsService.runValueStatisticsDirect(targetDateStr, { forceOverwrite: payload.forceOverwrite }, user);
    }

    if (result?.logs && Array.isArray(result.logs)) {
      result.logs.forEach((l: string) => {
        const line = l.startsWith('[') ? l : `[${new Date().toISOString()}] ${l}`;
        if (!job.logs.includes(line)) job.logs.push(line);
      });
    }

    payload.result = result;
    job.payload = payload;
    await job.save();

    const isPassed = result?.success !== false;
    const checklistStatus = isPassed ? 'PASSED' : 'NEEDS_ATTENTION';

    if (payload.shiftLogId) {
      await context.syncJobToChecklist(job, checklistStatus);
    }

    return result;
  }
}
