import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
} from '../../../shared';
import { MarginCheckerService } from '../services/margin-checker.service';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';

@Injectable()
export class NegativeMarginWorker implements IBotWorker {
  private readonly logger = new Logger(NegativeMarginWorker.name);

  readonly capabilityType = 'CHECK_NEGATIVE_MARGIN';
  readonly displayName = 'Quét Tài Khoản Âm Ký Quỹ (Post-EOD)';

  constructor(
    private readonly marginCheckerService: MarginCheckerService,
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
      `[NegativeMarginWorker] Tiếp nhận thực thi CHECK_NEGATIVE_MARGIN cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const filePath =
        context.parameters?.filePath ||
        path.join(process.cwd(), 'data', 'backup', 'eod.csv');

      const negativeAccounts = await this.marginCheckerService.scanNegativeMarginAccounts(filePath);
      const count = negativeAccounts.length;
      const status = count > 0 ? 'WARNING' : 'SUCCESS';
      const summary =
        count === 0
          ? 'Không phát hiện tài khoản nào bị âm ký quỹ.'
          : `Cảnh báo: Phát hiện ${count} tài khoản âm ký quỹ cần xử lý.`;

      let domainLogRefId: string | undefined;

      if (this.reconLogModel) {
        try {
          const targetDateStr = context.targetDate || new Date().toISOString().split('T')[0];
          const logRecord = await this.reconLogModel.create({
            reconType: 'NEGATIVE_MARGIN',
            tradingDate: targetDateStr,
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed: count === 0,
            totals: { negativeCount: count },
            negativeMarginAccounts: negativeAccounts,
          });
          domainLogRefId = logRecord._id.toString();
        } catch (dbErr: any) {
          this.logger.warn(`[NegativeMarginWorker] Lỗi lưu TradingReconLog: ${dbErr.message}`);
        }
      }

      return {
        status,
        summary,
        metrics: {
          negativeCount: count,
          accounts: negativeAccounts.slice(0, 10).map((a) => a.account),
        },
        domainLogRefId,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[NegativeMarginWorker] Lỗi thực thi CHECK_NEGATIVE_MARGIN: ${err.message}`);
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
