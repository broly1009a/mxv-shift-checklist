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
import { CcpAccumulatorService } from '../services/ccp-accumulator.service';

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
    @Optional()
    private readonly ccpAccumulatorService?: CcpAccumulatorService,
  ) {}

  canHandle(capabilityType: string): boolean {
    return (
      capabilityType === this.capabilityType ||
      capabilityType === 'CHECK_CCP_STATISTICS' ||
      capabilityType === 'RUN_LOT_MACRO' ||
      capabilityType === 'MACRO_LOT'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[CcpLotWorker] Tiếp nhận thực thi ${this.capabilityType} cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const res = this.lotStatisticsService.runAutoLotStatistics(context.parameters?.folderPath);

      // Fail-Safe: Khi chưa có dữ liệu giao dịch hoặc thiếu file
      const hasNoData = res.summary.dsgdTotal === 0 && res.summary.frTotal === 0;
      if (hasNoData) {
        this.logger.warn(`[CcpLotWorker] Chưa có dữ liệu giao dịch hoặc đang thiếu file đối chiếu số lot (DSGD/FR/TTM).`);
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: '[Đang chờ dữ liệu] Thư mục backup đang chờ cập nhật đầy đủ file đối chiếu số Lot (DSGD, FR, TTM...).',
          metrics: res.summary,
          details: res,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      const status = res.passed ? 'SUCCESS' : 'WARNING';
      const summary = res.passed
        ? `Thống kê Lot CCP thành công: Tổng DSGD = ${res.summary.dsgdTotal} lots, Khớp 100% với CQG FR.`
        : `Thống kê Lot CCP phát hiện chênh lệch: Lệch KLGD = ${res.summary.differKlgd}, Lệch TTM = ${res.summary.differTtm}, Lệch TTTT = ${res.summary.differTttt}`;

      let domainLogRefId: string | undefined;

      const targetDateStr = context.targetDate || new Date().toISOString().split('T')[0];

      if (this.ccpLogModel) {
        try {
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

      // Kế thừa luồng Master Excel Accumulation: Tự động ghi vào file Excel năm & sinh Sheet tháng mới bằng Python
      if (this.ccpAccumulatorService && res.passed) {
        try {
          const writeResults = await this.ccpAccumulatorService.writeLotStatsToAccumulator({
            targetDate: targetDateStr,
            summary: res.summary,
            byProduct: res.byProduct,
            byTvkd: res.byTvkd,
            customTargetRoot: context.parameters?.targetRoot || context.parameters?.folderPath,
          });
          const clonedCount = writeResults.filter((w) => w.clonedNewMonthSheet).length;
          if (clonedCount > 0) {
            this.logger.log(`[CcpLotWorker] Đã tự động sinh ${clonedCount} Sheet tháng mới qua Python openpyxl.`);
          }
        } catch (accErr: any) {
          this.logger.warn(`[CcpLotWorker] Cảnh báo ghi file Excel lũy kế: ${accErr.message}`);
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
