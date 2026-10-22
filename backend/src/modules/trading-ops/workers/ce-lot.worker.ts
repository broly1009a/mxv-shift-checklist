import { Injectable, Logger } from '@nestjs/common';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
  TaskExecutionStatus,
} from '../../../shared';
import { CeLotStatisticsService } from '../services/ce-lot-statistics.service';

/**
 * CeLotWorker: Worker chuyên trách Thống Kê Số Lot & Giá Trị Giao Dịch CoreEX (ACM Nano).
 * Hỗ trợ các capabilities: CE_STATISTICS, RUN_MACRO_CE, CE_LOT_STATS, CE_VALUE_STATS.
 */
@Injectable()
export class CeLotWorker implements IBotWorker {
  private readonly logger = new Logger(CeLotWorker.name);

  readonly capabilityType = 'CE_STATISTICS';
  readonly displayName = 'Thống Kê Số Lot & GTGD CoreEX (ACM Nano)';

  constructor(
    private readonly ceLotStatisticsService: CeLotStatisticsService,
  ) {}

  canHandle(capabilityType: string): boolean {
    const norm = (capabilityType || '').toUpperCase().trim();
    return (
      norm === this.capabilityType ||
      norm === 'RUN_MACRO_CE' ||
      norm === 'CE_LOT_STATS' ||
      norm === 'CE_VALUE_STATS' ||
      norm === 'CE_LOT' ||
      norm === 'CE' ||
      norm === 'COREEX'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const norm = (context.botCheckType || '').toUpperCase().trim();
    const targetDateStr = context.targetDate || new Date().toISOString().split('T')[0];
    const user = context.triggeredBy ? { username: context.triggeredBy } : undefined;

    this.logger.log(
      `[CeLotWorker] Bắt đầu thực thi ${norm || this.capabilityType} cho ngày ${targetDateStr} (Task: ${context.taskId || 'N/A'}, Ca: ${context.shiftId || 'N/A'})`,
    );

    const logs: string[] = [];
    const handleLog = (msg: string) => {
      const line = msg.startsWith('[') ? msg : `[${new Date().toISOString()}] ${msg}`;
      logs.push(line);
      if (typeof context.onLog === 'function') {
        context.onLog(line);
      }
    };

    handleLog(`[CeLotWorker] Bắt đầu tổng hợp thống kê CoreEX ngày ${targetDateStr}...`);

    try {
      let lotResult: any;
      let valueResult: any;

      if (norm === 'CE_VALUE_STATS') {
        valueResult = await this.ceLotStatisticsService.runValueStatisticsDirect(
          targetDateStr,
          { forceOverwrite: context.parameters?.forceOverwrite, exportDraft: false },
          user,
        );
      } else if (norm === 'CE_LOT_STATS') {
        lotResult = await this.ceLotStatisticsService.runLotStatisticsDirect(
          targetDateStr,
          { forceOverwrite: context.parameters?.forceOverwrite, exportDraft: false },
          user,
        );
      } else {
        // Mặc định chạy cả Lot và Value cho Macro CE (CE_STATISTICS / RUN_MACRO_CE)
        lotResult = await this.ceLotStatisticsService.runLotStatisticsDirect(
          targetDateStr,
          { forceOverwrite: context.parameters?.forceOverwrite, exportDraft: false },
          user,
        );
        valueResult = await this.ceLotStatisticsService.runValueStatisticsDirect(
          targetDateStr,
          { forceOverwrite: context.parameters?.forceOverwrite, exportDraft: false },
          user,
        );
      }

      if (lotResult?.logs && Array.isArray(lotResult.logs)) {
        lotResult.logs.forEach((l: string) => handleLog(l));
      }
      if (valueResult?.logs && Array.isArray(valueResult.logs)) {
        valueResult.logs.forEach((l: string) => handleLog(l));
      }

      const hasError = (lotResult && !lotResult.success) || (valueResult && !valueResult.success);
      const status: TaskExecutionStatus = hasError ? 'WARNING' : 'SUCCESS';

      const summaryParts: string[] = [];
      if (lotResult) summaryParts.push(lotResult.message || 'Ghi sổ Lot CE hoàn tất');
      if (valueResult) summaryParts.push(valueResult.message || 'Ghi sổ GTGD CE hoàn tất');
      const summary = summaryParts.join(' | ') || `Thống kê CE ngày ${targetDateStr} hoàn thành.`;

      return {
        status,
        passed: !hasError,
        summary,
        metrics: {
          lotResult: lotResult ? { success: lotResult.success, message: lotResult.message } : undefined,
          valueResult: valueResult ? { success: valueResult.success, message: valueResult.message } : undefined,
        },
        details: { lotResult, valueResult },
        logs,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[CeLotWorker] Lỗi thực thi thống kê CE: ${err.message}`, err.stack);
      return {
        status: 'FAILED',
        passed: false,
        summary: `Thất bại thống kê CE: ${err.message}`,
        error: err.message,
        logs,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    }
  }
}
