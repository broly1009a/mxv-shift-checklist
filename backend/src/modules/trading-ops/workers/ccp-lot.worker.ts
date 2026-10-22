import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
  TaskExecutionStatus,
} from '../../../shared';
import { LotStatisticsService } from '../services/lot-statistics.service';
import { CcpLotStatisticsService } from '../services/ccp-lot-statistics.service';
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
    private readonly ccpLotStatisticsService?: CcpLotStatisticsService,
    @Optional()
    @InjectModel(CcpClearingLog.name)
    private readonly ccpLogModel?: Model<CcpClearingLog>,
    @Optional()
    private readonly ccpAccumulatorService?: CcpAccumulatorService,
  ) {}

  canHandle(capabilityType: string): boolean {
    const norm = (capabilityType || '').toUpperCase().trim();
    return (
      norm === this.capabilityType ||
      norm === 'RUN_MACRO' ||
      norm === 'CCP_STATISTICS' ||
      norm === 'CHECK_CCP_STATISTICS' ||
      norm === 'RUN_LOT_MACRO' ||
      norm === 'MACRO_LOT' ||
      norm === 'CCP_LOT' ||
      norm === 'CORECCP'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const norm = (context.botCheckType || '').toUpperCase().trim();
    const targetDateStr = context.targetDate || new Date().toISOString().split('T')[0];
    const user = context.triggeredBy ? { username: context.triggeredBy } : undefined;

    this.logger.log(
      `[CcpLotWorker] Tiếp nhận thực thi ${norm || this.capabilityType} cho Task: ${context.taskId || 'N/A'}, Ca: ${context.shiftId || 'N/A'} (Ngày: ${targetDateStr})`,
    );

    const logs: string[] = [];
    const handleLog = (msg: string) => {
      const line = msg.startsWith('[') ? msg : `[${new Date().toISOString()}] ${msg}`;
      logs.push(line);
      if (typeof context.onLog === 'function') {
        context.onLog(line);
      }
    };

    handleLog(`[CcpLotWorker] Khởi chạy tác vụ ${norm || this.capabilityType} ngày ${targetDateStr}...`);

    try {
      // 1. Nếu là RUN_MACRO hoặc CCP_STATISTICS: Chạy Full Macro (cả Lot và Value)
      if ((norm === 'RUN_MACRO' || norm === 'CCP_STATISTICS' || norm === 'CORECCP') && this.ccpLotStatisticsService) {
        const macroRes = await this.ccpLotStatisticsService.runFullMacroStatisticsDirect(targetDateStr, user);
        if (macroRes.logs && Array.isArray(macroRes.logs)) {
          macroRes.logs.forEach((l) => handleLog(l));
        }

        const status: TaskExecutionStatus = macroRes.success ? 'SUCCESS' : 'WARNING';
        return {
          status,
          passed: macroRes.success,
          summary: macroRes.message,
          metrics: {
            totalSoLot: macroRes.result?.totalSoLot,
            totalGiaTri: macroRes.result?.totalGiaTri,
            lotUpdated: macroRes.lotUpdated,
            gtgdUpdated: macroRes.gtgdUpdated,
            errorsCount: macroRes.errors?.length || 0,
          },
          details: macroRes.result,
          logs,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      // 2. Nếu là RUN_LOT_MACRO hoặc chạy trực tiếp ghi sổ Lot
      if (this.ccpLotStatisticsService && (norm === 'RUN_LOT_MACRO' || norm === 'MACRO_LOT' || context.parameters?.writeDirect)) {
        const lotDirectRes = await this.ccpLotStatisticsService.runLotStatisticsDirect(targetDateStr, user);
        if (lotDirectRes.logs && Array.isArray(lotDirectRes.logs)) {
          lotDirectRes.logs.forEach((l) => handleLog(l));
        }

        const status: TaskExecutionStatus = lotDirectRes.success ? 'SUCCESS' : 'WARNING';
        return {
          status,
          passed: lotDirectRes.success,
          summary: lotDirectRes.message,
          metrics: {
            totalSoLot: lotDirectRes.result?.totalSoLot,
            lotUpdated: lotDirectRes.lotUpdated,
            errorsCount: lotDirectRes.errors?.length || 0,
          },
          details: lotDirectRes.result,
          logs,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      // 3. Fallback: Luồng đối soát bộ nhớ chuẩn LotStatisticsService
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
          logs,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      const status: TaskExecutionStatus = res.passed ? 'SUCCESS' : 'WARNING';
      const summary = res.passed
        ? `Thống kê Lot CCP thành công: Tổng DSGD = ${res.summary.dsgdTotal} lots, Khớp 100% với CQG FR.`
        : `Thống kê Lot CCP phát hiện chênh lệch: Lệch KLGD = ${res.summary.differKlgd}, Lệch TTM = ${res.summary.differTtm}, Lệch TTTT = ${res.summary.differTttt}`;

      let domainLogRefId: string | undefined;

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

      // Kế thừa luồng Master Excel Accumulation Python nếu có
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
            handleLog(`[CcpLotWorker] Đã tự động sinh ${clonedCount} Sheet tháng mới.`);
          }
        } catch (accErr: any) {
          this.logger.warn(`[CcpLotWorker] Cảnh báo ghi file Excel lũy kế: ${accErr.message}`);
        }
      }

      return {
        status,
        passed: res.passed,
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
        logs,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[CcpLotWorker] Lỗi thực thi thống kê Lot CCP: ${err.message}`);
      return {
        status: 'FAILED',
        passed: false,
        summary: `Thất bại: ${err.message}`,
        error: err.message,
        logs,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    }
  }
}
