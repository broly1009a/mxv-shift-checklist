import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
  TaskExecutionStatus,
} from '../../../shared';
import { ValueStatisticsService } from '../services/value-statistics.service';
import { CcpLotStatisticsService } from '../services/ccp-lot-statistics.service';
import { CcpClearingLog } from '../schemas/ccp-clearing-log.schema';
import { CcpAccumulatorService } from '../services/ccp-accumulator.service';

@Injectable()
export class CcpValueWorker implements IBotWorker {
  private readonly logger = new Logger(CcpValueWorker.name);

  readonly capabilityType = 'CCP_VALUE_STATS';
  readonly displayName = 'Thống Kê Giá Trị Giao Dịch Bù Trừ CCP';

  constructor(
    private readonly valueStatisticsService: ValueStatisticsService,
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
      norm === 'CHECK_CCP_VALUE' ||
      norm === 'MACRO_VALUE' ||
      norm === 'RUN_VALUE_MACRO' ||
      norm === 'RUN_VALUE_TVKD_MACRO' ||
      norm === 'CCP_VALUE'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const norm = (context.botCheckType || '').toUpperCase().trim();
    const targetDateStr = context.targetDate || new Date().toISOString().split('T')[0];
    const user = context.triggeredBy ? { username: context.triggeredBy } : undefined;

    this.logger.log(
      `[CcpValueWorker] Tiếp nhận thực thi ${norm || this.capabilityType} cho Task: ${context.taskId || 'N/A'}, Ca: ${context.shiftId || 'N/A'} (Ngày: ${targetDateStr})`,
    );

    const logs: string[] = [];
    const handleLog = (msg: string) => {
      const line = msg.startsWith('[') ? msg : `[${new Date().toISOString()}] ${msg}`;
      logs.push(line);
      if (typeof context.onLog === 'function') {
        context.onLog(line);
      }
    };

    handleLog(`[CcpValueWorker] Khởi chạy tác vụ ${norm || this.capabilityType} ngày ${targetDateStr}...`);

    try {
      // 1. Nếu là RUN_VALUE_MACRO hoặc context yêu cầu ghi trực tiếp qua CcpLotStatisticsService
      if (this.ccpLotStatisticsService && (norm === 'RUN_VALUE_MACRO' || norm === 'MACRO_VALUE' || context.parameters?.writeDirect)) {
        const valueDirectRes = await this.ccpLotStatisticsService.runValueStatisticsDirect(targetDateStr, user);
        if (valueDirectRes.logs && Array.isArray(valueDirectRes.logs)) {
          valueDirectRes.logs.forEach((l) => handleLog(l));
        }

        const status: TaskExecutionStatus = valueDirectRes.success ? 'SUCCESS' : 'WARNING';
        return {
          status,
          passed: valueDirectRes.success,
          summary: valueDirectRes.message,
          metrics: {
            totalGiaTri: valueDirectRes.result?.totalGiaTri,
            totalSoLot: valueDirectRes.result?.totalSoLot,
            gtgdUpdated: valueDirectRes.gtgdUpdated,
            errorsCount: valueDirectRes.errors?.length || 0,
          },
          details: valueDirectRes.result,
          logs,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      // 2. Fallback: Luồng tính toán tự động qua ValueStatisticsService
      const res = await this.valueStatisticsService.runAutoValueStatistics(
        targetDateStr,
        context.parameters?.folderPath,
      );

      // Fail-Safe: Khi chưa có dữ liệu giao dịch hoặc thiếu file DSGD
      if (res.totalLots === 0) {
        this.logger.warn(`[CcpValueWorker] Chưa có dữ liệu giao dịch hoặc đang thiếu file DSGD.`);
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: '[Đang chờ dữ liệu] Thư mục backup đang chờ cập nhật file DSGD để tính giá trị giao dịch.',
          metrics: {
            totalLots: 0,
            totalValueVnd: 0,
            formattedTotalValueVnd: '0.00 tỷ VND',
          },
          details: res,
          logs,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      const status: TaskExecutionStatus = res.passed ? 'SUCCESS' : 'WARNING';
      const formattedTotalValue = (res.totalValueVnd / 1e9).toFixed(2);
      const summary = res.passed
        ? `Thống kê Giá trị CCP thành công: Tổng ${res.totalLots} lots, tương đương ${formattedTotalValue} tỷ VND.`
        : `Thống kê Giá trị CCP hoàn thành với cảnh báo: Tổng ${res.totalLots} lots, Giá trị ${formattedTotalValue} tỷ VND (cần kiểm tra file đầu vào).`;

      let domainLogRefId: string | undefined;

      if (this.ccpLogModel) {
        try {
          const logRecord = await this.ccpLogModel.create({
            tradingDate: targetDateStr,
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed: res.passed,
            summary: {
              totalLots: res.totalLots,
              totalValueVnd: res.totalValueVnd,
              formattedTotalValueVnd: `${formattedTotalValue} tỷ VND`,
              rates: res.rates,
            },
            byProduct: res.breakdownByProduct.map((p) => ({
              maSP: p.product,
              klm: p.lots,
              klb: 0,
              total: p.lots,
            })),
            byTvkd: [],
          });
          domainLogRefId = (logRecord as any)?._id?.toString();
        } catch (dbErr: any) {
          this.logger.warn(`[CcpValueWorker] Lỗi lưu CcpClearingLog: ${dbErr.message}`);
        }
      }

      // Kế thừa luồng Master Excel Accumulation Python nếu có
      if (this.ccpAccumulatorService && res.passed) {
        try {
          const writeResults = await this.ccpAccumulatorService.writeValueStatsToAccumulator({
            targetDate: targetDateStr,
            result: res,
            customTargetRoot: context.parameters?.targetRoot || context.parameters?.folderPath,
          });
          const clonedCount = writeResults.filter((w) => w.clonedNewMonthSheet).length;
          if (clonedCount > 0) {
            handleLog(`[CcpValueWorker] Đã tự động sinh ${clonedCount} Sheet tháng mới.`);
          }
        } catch (accErr: any) {
          this.logger.warn(`[CcpValueWorker] Cảnh báo ghi file Excel lũy kế: ${accErr.message}`);
        }
      }

      return {
        status,
        passed: res.passed,
        summary,
        metrics: {
          totalLots: res.totalLots,
          totalValueVnd: res.totalValueVnd,
          usdRate: res.rates.usdGain,
          jpyRate: res.rates.jpyGain,
          myrRate: res.rates.myrGain,
          rmbRate: res.rates.rmbGain,
          topProducts: res.breakdownByProduct.slice(0, 5),
        },
        domainLogRefId,
        logs,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[CcpValueWorker] Lỗi thực thi thống kê Giá trị CCP: ${err.message}`);
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
