import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
} from '../../../shared';
import { PreEodReconService } from '../services/pre-eod-recon.service';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';

@Injectable()
export class PreEodReconWorker implements IBotWorker {
  private readonly logger = new Logger(PreEodReconWorker.name);

  readonly capabilityType = 'CHECK_PRE_EOD';
  readonly displayName = 'Đối Chiếu Chốt 3 Bên Cuối Ngày (Pre-EOD)';

  constructor(
    private readonly preEodReconService: PreEodReconService,
    @Optional()
    @InjectModel(TradingReconLog.name)
    private readonly reconLogModel?: Model<TradingReconLog>,
  ) {}

  canHandle(capabilityType: string): boolean {
    return capabilityType === this.capabilityType;
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[PreEodReconWorker] Tiếp nhận thực thi CHECK_PRE_EOD cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const targetDate = context.targetDate ? new Date(context.targetDate) : new Date();
      const res = await this.preEodReconService.runAutoCheckPreEOD(
        targetDate,
        context.parameters?.dataDir,
      );

      const status = res.passed ? 'SUCCESS' : 'WARNING';
      const summary = res.passed
        ? `Pre-EOD Khớp 100% (CQG: ${res.totals.totalCQG_FR}, ACM: ${res.totals.totalACM_Straits})`
        : `Phát hiện lệch Pre-EOD: Lệch CQG=${res.totals.differCQG}, Lệch ACM=${res.totals.differACM}, Lệch lệnh=${res.mismatchedTrades.length}, Lệch vị thế=${res.mismatchedPositions.length}`;

      let domainLogRefId: string | undefined;

      if (this.reconLogModel) {
        try {
          const logRecord = await this.reconLogModel.create({
            reconType: 'PRE_EOD',
            tradingDate: targetDate.toISOString().split('T')[0],
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed: res.passed,
            totals: res.totals,
            mismatchedTrades: res.mismatchedTrades,
            mismatchedPositions: res.mismatchedPositions,
          });
          domainLogRefId = (logRecord as any)?._id?.toString();
        } catch (dbErr: any) {
          this.logger.warn(`[PreEodReconWorker] Lỗi lưu TradingReconLog: ${dbErr.message}`);
        }
      }

      return {
        status,
        summary,
        metrics: {
          totalACM_MS: res.totals.totalACM_MS,
          totalACM_Straits: res.totals.totalACM_Straits,
          differACM: res.totals.differACM,
          totalCQG_MS: res.totals.totalCQG_MS,
          totalCQG_FR: res.totals.totalCQG_FR,
          differCQG: res.totals.differCQG,
          mismatchedTradesCount: res.mismatchedTrades.length,
          mismatchedPositionsCount: res.mismatchedPositions.length,
        },
        domainLogRefId,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[PreEodReconWorker] Lỗi thực thi CHECK_PRE_EOD: ${err.message}`);
      return {
        status: 'FAILED',
        summary: `Thất bại: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    }
  }
}
