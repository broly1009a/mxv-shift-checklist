import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
} from '../../../shared';
import { CcpEodService } from '../services/ccp-eod.service';
import { CcpClearingLog } from '../schemas/ccp-clearing-log.schema';

@Injectable()
export class CcpEodWorker implements IBotWorker {
  private readonly logger = new Logger(CcpEodWorker.name);

  readonly capabilityType = 'CCP_EOD_RECON';
  readonly displayName = 'Đối Chiếu Chốt Sổ EOD CoreCCP';

  constructor(
    private readonly ccpEodService: CcpEodService,
    @Optional()
    @InjectModel(CcpClearingLog.name)
    private readonly ccpLogModel?: Model<CcpClearingLog>,
  ) {}

  canHandle(capabilityType: string): boolean {
    return (
      capabilityType === this.capabilityType ||
      capabilityType === 'CHECK_EOD_CCP'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[CcpEodWorker] Tiếp nhận thực thi ${this.capabilityType} cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    const job = (context as any).job || context.parameters?.job;
    const executionLogs: string[] = [];

    const handleLog = (msg: string) => {
      const line = msg.startsWith('[') ? msg : `[${new Date().toISOString()}] ${msg}`;
      executionLogs.push(line);
      if (job && Array.isArray(job.logs)) {
        job.logs.push(line);
      }
      if (typeof context.onLog === 'function') {
        context.onLog(line);
      }
    };

    handleLog(
      `[CcpEodWorker] Tiếp nhận thực thi ${this.displayName} cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const targetDate = context.targetDate
        ? new Date(context.targetDate)
        : new Date();

      const res = await this.ccpEodService.runAutoCheckEodCcp(targetDate, {
        onLog: handleLog,
      });

      const passed =
        res.mismatchedEOD.length === 0 && res.negativeIMRAcc.length === 0;
      const status = passed ? 'SUCCESS' : 'WARNING';

      const summary = passed
        ? `Đối chiếu EOD CoreCCP thành công: Khớp 100% trên ${res.totalAccounts} tài khoản.`
        : `Đối chiếu EOD CoreCCP có cảnh báo: ${res.mismatchedEOD.length} TK lệch công thức, ${res.negativeIMRAcc.length} TK âm ký quỹ (IMR).`;

      let domainLogRefId: string | undefined;

      if (this.ccpLogModel) {
        try {
          const dateStr = targetDate.toISOString().split('T')[0];
          const logRecord = await this.ccpLogModel.create({
            tradingDate: dateStr,
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed,
            summary: {
              totalAccounts: res.totalAccounts,
              mismatchedCount: res.mismatchedEOD.length,
              negativeIMRCount: res.negativeIMRAcc.length,
              negativeBalanceCount: res.negativeBalanceAccs.length,
              filesUsed: res.filesUsed,
            },
            byProduct: [],
            byTvkd: [],
            validations: res.mismatchedEOD.map((item) => ({
              field: item.maTKGD,
              expected: item.calculatedBalance,
              actual: item.eodBalance,
              passed: false,
            })),
          });
          domainLogRefId = (logRecord as any)?._id?.toString();
        } catch (dbErr: any) {
          this.logger.warn(`[CcpEodWorker] Lỗi lưu CcpClearingLog: ${dbErr.message}`);
        }
      }

      return {
        status,
        summary,
        logs: executionLogs,
        metrics: {
          totalAccounts: res.totalAccounts,
          mismatchedCount: res.mismatchedEOD.length,
          negativeIMRCount: res.negativeIMRAcc.length,
          negativeBalanceCount: res.negativeBalanceAccs.length,
          filesUsed: res.filesUsed,
          mismatchedSample: res.mismatchedEOD.slice(0, 10),
        },
        domainLogRefId,
        details: res,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[CcpEodWorker] Lỗi thực thi đối chiếu EOD CCP: ${err.message}`);
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
