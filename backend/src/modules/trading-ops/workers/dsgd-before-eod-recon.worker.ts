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
import { MsEodReconService } from '../services/ms-eod-recon.service';
import { DsgdBeforeEodService } from '../services/dsgd-before-eod.service';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';

@Injectable()
export class DsgdBeforeEodReconWorker implements IBotWorker {
  private readonly logger = new Logger(DsgdBeforeEodReconWorker.name);

  readonly capabilityType = 'CHECK_DSGD_BEFORE_EOD';
  readonly displayName = 'Đối Chiếu DSGD Trước EOD';

  constructor(
    @Optional()
    private readonly msEodReconService?: MsEodReconService,
    @Optional()
    private readonly dsgdBeforeEodService?: DsgdBeforeEodService,
    @Optional()
    @InjectModel(TradingReconLog.name)
    private readonly reconLogModel?: Model<TradingReconLog>,
    @Optional()
    @Inject(RECON_PIPELINE_PORT)
    private readonly reconPipeline?: IReconPipelinePort,
  ) {}

  canHandle(capabilityType: string): boolean {
    return capabilityType === 'CHECK_DSGD_BEFORE_EOD' || capabilityType === 'CHECK_DSGD_BEFORE_EOD';
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[DsgdBeforeEodReconWorker] Tiếp nhận thực thi CHECK_DSGD_BEFORE_EOD cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const targetDate = context.targetDate ? new Date(context.targetDate) : new Date();

      let res: any;
      if (this.reconPipeline && context.parameters?.skipDownload !== true) {
        this.logger.log(`[DsgdBeforeEodReconWorker] Kích hoạt luồng Ingress tải dữ liệu tươi Dsgd-Before-EOD trước khi đối soát...`);
        const jobToRun = (context as any).job || context.parameters?.job || {
          _id: context.taskId,
          jobType: 'CHECK_DSGD_BEFORE_EOD',
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
        res = await this.reconPipeline.handleCheckDsgdBeforeEodJob(jobToRun);
      } else {
        const dsgdResult = this.dsgdBeforeEodService
          ? await this.dsgdBeforeEodService.runAutoCheckDSGDBeforeEOD({ tradingDate: targetDate })
          : null;
        res = {
          passed: dsgdResult ? dsgdResult.passed : true,
          isWaitingFiles: Boolean(dsgdResult?.isSnapshotMissing),
          message: dsgdResult ? dsgdResult.messages.join(' | ') : '',
          totals: {
            totalOriginal: dsgdResult?.totalOriginal ?? 0,
            totalTemp: dsgdResult?.totalTemp ?? 0,
            differTotal: dsgdResult?.differTotal ?? 0,
            totalACMMS: dsgdResult?.totalACMMS ?? 0,
            totalACMSFTP: dsgdResult?.totalACMSFTP ?? 0,
            differACM: dsgdResult?.differACM ?? 0,
          },
          tradingDate: targetDate,
          summaryMessage: dsgdResult ? dsgdResult.messages.join(' | ') : '',
          dsgdBeforeEod: dsgdResult,
        };
      }

      // ── BƯỚC 1: XỬ LÝ TRƯỜNG HỢP CHỜ FILE DSGD-BEFORE-EOD (FAIL-SAFE / ZERO FALSE-POSITIVE) ──
      if (res.isWaitingFiles) {
        this.logger.warn(`[DsgdBeforeEodReconWorker] ${res.message || 'Đang chờ cập nhật file Dsgd-Before-EOD.'}`);
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: res.message || '[Đang chờ dữ liệu Dsgd-Before-EOD] Đang chờ cập nhật đầy đủ file đối chiếu cuối ngày.',
          metrics: {
            totalOriginal: 0,
            totalTemp: 0,
            differTotal: 0,
            totalACMMS: 0,
            totalACMSFTP: 0,
            differACM: 0,
          },
          details: res,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      // ── BƯỚC 2: ĐỐI SOÁT KHI ĐÃ CÓ ĐỦ DỮ LIỆU DSGD TRƯỚC EOD ──
      const totalOrig = res.totals?.totalOriginal ?? res.totals?.totalCQG_MS ?? res.dsgdBeforeEod?.totalOriginal ?? 0;
      const totalSnap = res.totals?.totalTemp ?? res.totals?.totalCQG_FR ?? res.dsgdBeforeEod?.totalTemp ?? 0;
      const diffTot = res.totals?.differTotal ?? res.totals?.differCQG ?? res.dsgdBeforeEod?.differTotal ?? 0;
      const acmMs = res.totals?.totalACMMS ?? res.totals?.totalACM_MS ?? res.dsgdBeforeEod?.totalACMMS ?? 0;
      const acmSftp = res.totals?.totalACMSFTP ?? res.totals?.totalACM_Straits ?? res.dsgdBeforeEod?.totalACMSFTP ?? 0;
      const diffAcm = res.totals?.differACM ?? res.dsgdBeforeEod?.differACM ?? 0;

      const status = res.passed ? 'SUCCESS' : 'WARNING';
      const summary = res.summaryMessage || (res.passed
        ? `Kiểm tra DSGD Trước EOD Khớp 100% (DSGD: ${totalOrig} lot, ACM: ${acmMs} lot)`
        : `Phát hiện chênh lệch Trước EOD: Lệch DSGD=${diffTot} lot, Lệch ACM=${diffAcm} lot`);

      let domainLogRefId: string | undefined;

      if (this.reconLogModel) {
        try {
          const logRecord = await this.reconLogModel.create({
            reconType: 'DSGD_BEFORE_EOD',
            tradingDate: targetDate.toISOString().split('T')[0],
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed: res.passed,
            totals: res.totals,
            dsgdBeforeEod: res.dsgdBeforeEod,
          });
          domainLogRefId = (logRecord as any)?._id?.toString();
        } catch (dbErr: any) {
          this.logger.warn(`[DsgdBeforeEodReconWorker] Lỗi lưu TradingReconLog: ${dbErr.message}`);
        }
      }

      return {
        status,
        summary,
        isWaitingFiles: false,
        metrics: {
          totalOriginal: totalOrig,
          totalTemp: totalSnap,
          differTotal: diffTot,
          totalACMMS: acmMs,
          totalACMSFTP: acmSftp,
          differACM: diffAcm,
        },
        domainLogRefId,
        details: res,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[DsgdBeforeEodReconWorker] Lỗi thực thi CHECK_DSGD_BEFORE_EOD: ${err.message}`);
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
