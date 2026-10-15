import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
} from '../../../shared';
import { ValueStatisticsService } from '../services/value-statistics.service';
import { CcpClearingLog } from '../schemas/ccp-clearing-log.schema';

@Injectable()
export class CcpValueWorker implements IBotWorker {
  private readonly logger = new Logger(CcpValueWorker.name);

  readonly capabilityType = 'CCP_VALUE_STATS';
  readonly displayName = 'Thống Kê Giá Trị Giao Dịch Bù Trừ CCP';

  constructor(
    private readonly valueStatisticsService: ValueStatisticsService,
    @Optional()
    @InjectModel(CcpClearingLog.name)
    private readonly ccpLogModel?: Model<CcpClearingLog>,
  ) {}

  canHandle(capabilityType: string): boolean {
    return (
      capabilityType === this.capabilityType ||
      capabilityType === 'CHECK_CCP_VALUE' ||
      capabilityType === 'MACRO_VALUE'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[CcpValueWorker] Tiếp nhận thực thi ${this.capabilityType} cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const res = await this.valueStatisticsService.runAutoValueStatistics(
        context.targetDate,
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
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      const status = res.passed ? 'SUCCESS' : 'WARNING';
      const formattedTotalValue = (res.totalValueVnd / 1e9).toFixed(2);
      const summary = res.passed
        ? `Thống kê Giá trị CCP thành công: Tổng ${res.totalLots} lots, tương đương ${formattedTotalValue} tỷ VND.`
        : `Thống kê Giá trị CCP hoàn thành với cảnh báo: Tổng ${res.totalLots} lots, Giá trị ${formattedTotalValue} tỷ VND (cần kiểm tra file đầu vào).`;

      let domainLogRefId: string | undefined;

      if (this.ccpLogModel) {
        try {
          const targetDateStr = context.targetDate || res.sessionDate;
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

      return {
        status,
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
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[CcpValueWorker] Lỗi thực thi thống kê Giá trị CCP: ${err.message}`);
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
