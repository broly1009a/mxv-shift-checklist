import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
} from '../../../shared';
import { LotStatisticsService } from '../services/lot-statistics.service';
import { CcpClearingLog } from '../schemas/ccp-clearing-log.schema';

@Injectable()
export class CcpLotWorker implements IBotWorker {
  private readonly logger = new Logger(CcpLotWorker.name);

  readonly capabilityType = 'CCP_LOT_STATS';
  readonly displayName = 'Thống Kê Khối Lượng Lot Bù Trừ CCP';

  constructor(
    private readonly lotStatisticsService: LotStatisticsService,
    @Optional()
    @InjectModel(CcpClearingLog.name)
    private readonly ccpLogModel?: Model<CcpClearingLog>,
  ) {}

  canHandle(capabilityType: string): boolean {
    return capabilityType === this.capabilityType || capabilityType === 'CHECK_CCP_STATISTICS';
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[CcpLotWorker] Tiếp nhận thực thi ${this.capabilityType} cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const res = this.lotStatisticsService.runAutoLotStatistics(context.parameters?.folderPath);

      const status = res.passed ? 'SUCCESS' : 'WARNING';
      const summary = res.passed
        ? `Thống kê Lot CCP thành công: Tổng DSGD = ${res.summary.dsgdTotal} lots, Khớp 100% với CQG FR.`
        : `Thống kê Lot CCP phát hiện chênh lệch: Lệch KLGD = ${res.summary.differKlgd}, Lệch TTM = ${res.summary.differTtm}, Lệch TTTT = ${res.summary.differTttt}`;

      let domainLogRefId: string | undefined;

      if (this.ccpLogModel) {
        try {
          const targetDateStr = context.targetDate || new Date().toISOString().split('T')[0];
          const logRecord = await this.ccpLogModel.create({
            tradingDate: targetDateStr,
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed: res.passed,
            summary: res.summary,
            byProduct: res.byProduct,
            byTvkd: res.byTvkd,
          });
          domainLogRefId = (logRecord as any)?._id?.toString();
        } catch (dbErr: any) {
          this.logger.warn(`[CcpLotWorker] Lỗi lưu CcpClearingLog: ${dbErr.message}`);
        }
      }

      return {
        status,
        summary,
        metrics: {
          dsgdTotal: res.summary.dsgdTotal,
          frTotal: res.summary.frTotal,
          ttmTotal: res.summary.ttmTotal,
          opTotal: res.summary.opTotal,
          ttttTotal: res.summary.ttttTotal,
          psTotal: res.summary.psTotal,
          acmTotal: res.summary.acmTotal,
          differKlgd: res.summary.differKlgd,
          differTtm: res.summary.differTtm,
          differTttt: res.summary.differTttt,
          topProducts: res.byProduct.slice(0, 5).map((p) => ({ maSP: p.maSP, total: p.total })),
          topTvkd: res.byTvkd.slice(0, 5).map((t) => ({ tvkd: t.tvkd, total: t.total })),
        },
        domainLogRefId,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[CcpLotWorker] Lỗi thực thi thống kê Lot CCP: ${err.message}`);
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
