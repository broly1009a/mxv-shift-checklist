import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
  RECON_PIPELINE_PORT,
} from '../../../shared';
import type { IReconPipelinePort } from '../../../shared';
import { KlgdReconService } from '../services/klgd-recon.service';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';

@Injectable()
export class KlgdReconWorker implements IBotWorker {
  private readonly logger = new Logger(KlgdReconWorker.name);

  readonly capabilityType = 'CHECK_KLGD';
  readonly displayName = 'Đối Chiếu KLGD Trong Phiên (MS vs CQG vs ACM)';

  constructor(
    private readonly klgdReconService: KlgdReconService,
    @Optional()
    @InjectModel(TradingReconLog.name)
    private readonly reconLogModel?: Model<TradingReconLog>,
    @Optional()
    @Inject(RECON_PIPELINE_PORT)
    private readonly reconPipeline?: IReconPipelinePort,
  ) {}

  canHandle(capabilityType: string): boolean {
    return capabilityType === this.capabilityType;
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[KlgdReconWorker] Tiếp nhận thực thi CHECK_KLGD cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const targetDate = context.targetDate ? new Date(context.targetDate) : new Date();

      let res: any;
      // ── BƯỚC 1: NẾU CÓ PIPELINE TẢI DỮ LIỆU TƯƠI TỰ ĐỘNG (PLAYWRIGHT MS, CQG, ACM, CCP) ──
      if (this.reconPipeline && context.parameters?.skipDownload !== true) {
        this.logger.log(`[KlgdReconWorker] Kích hoạt luồng Ingress tải dữ liệu tươi từ M-System, CQG, ACM, CCP trước khi đối soát...`);
        const jobToRun = (context as any).job || context.parameters?.job || {
          _id: context.taskId,
          jobType: 'CHECK_KLGD',
          logs: [],
          payload: {
            taskId: context.taskId,
            shiftLogId: context.shiftId,
            targetDate: context.targetDate,
            sessionDay: context.targetDate,
            options: context.parameters?.options || context.parameters,
          },
          save: async () => {},
          markModified: () => {},
        };
        res = await this.reconPipeline.handleCheckKlgdJob(jobToRun);
      } else {
        // Fallback: Quét file trực tiếp từ ổ đĩa (cho Unit tests hoặc chế độ Offline)
        res = await this.klgdReconService.runAutoCheckKLGD(targetDate, {
          cutoffTime: context.parameters?.cutoffTime ? new Date(context.parameters.cutoffTime) : undefined,
          customDataDir: context.parameters?.dataDir,
        });
      }

      // ── BƯỚC 1: XỬ LÝ TRƯỜNG HỢP ĐANG CHỜ FILE (FAIL-SAFE / ZERO FALSE-POSITIVE) ──
      if (res.isWaitingFiles) {
        this.logger.warn(`[KlgdReconWorker] ${res.message || 'Đang chờ cập nhật file đối chiếu.'}`);
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: res.message || '[Đang chờ dữ liệu] Thư mục backup đang chờ cập nhật đầy đủ file đối chiếu.',
          metrics: {
            totalDSGD: 0,
            totalFR: 0,
            totalACM: 0,
            totalNano: 0,
            differ: 0,
            differACM: 0,
            mismatchedTradesCount: 0,
            mismatchedTTMCount: 0,
            mismatchedTTTTCount: 0,
          },
          details: res,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      // ── BƯỚC 2: ĐỐI SOÁT KHI ĐÃ CÓ ĐỦ DỮ LIỆU THỰC TẾ ──
      const hasDiscrepancy = !res.passed;
      const status = hasDiscrepancy ? 'WARNING' : 'SUCCESS';
      const summary = res.passed
        ? `Khớp 100% (DSGD: ${res.totals.totalDSGD}, FR: ${res.totals.totalFR}, Nano: ${res.totals.totalNano})`
        : `Phát hiện lệch: Lệch CQG=${res.totals.differ}, Lệch ACM=${res.totals.differACM}, Lệch khớp lệnh=${res.mismatchedTrades.length}`;

      let domainLogRefId: string | undefined;

      // Lưu log chi tiết vào collection độc lập trading_recon_logs
      if (this.reconLogModel) {
        try {
          const logRecord = await this.reconLogModel.create({
            reconType: 'KLGD',
            tradingDate: targetDate.toISOString().split('T')[0],
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed: res.passed,
            totals: res.totals,
            mismatchedTrades: res.mismatchedTrades,
            mismatchedPositions: [],
            cutoffTime: context.parameters?.cutoffTime ? new Date(context.parameters.cutoffTime) : undefined,
          });
          domainLogRefId = (logRecord as any)?._id?.toString();
        } catch (dbErr: any) {
          this.logger.warn(`[KlgdReconWorker] Lỗi lưu TradingReconLog: ${dbErr.message}`);
        }
      }

      return {
        status,
        summary,
        isWaitingFiles: false,
        metrics: {
          totalDSGD: res.totals.totalDSGD,
          totalFR: res.totals.totalFR,
          totalACM: res.totals.totalACM,
          totalNano: res.totals.totalNano,
          differ: res.totals.differ,
          differACM: res.totals.differACM,
          totalCCP_DSGD: res.totals.totalCCP_DSGD,
          totalCCP_TTM: res.totals.totalCCP_TTM,
          totalCCP_TTTT: res.totals.totalCCP_TTTT,
          differCCP_KLGD: res.totals.differCCP_KLGD,
          differCCP_TTM: res.totals.differCCP_TTM,
          differCCP_TTTT: res.totals.differCCP_TTTT,
          mismatchedTradesCount: res.mismatchedTrades.length,
          mismatchedTTMCount: res.mismatchedTTM.length,
          mismatchedTTTTCount: res.mismatchedTTTT?.length || 0,
        },
        domainLogRefId,
        details: res,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[KlgdReconWorker] Lỗi thực thi CHECK_KLGD: ${err.message}`);
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
