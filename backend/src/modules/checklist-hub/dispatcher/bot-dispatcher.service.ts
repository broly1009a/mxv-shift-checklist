import { Injectable, Logger, OnModuleInit, Optional, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
} from '../../../shared';
import { BotJob } from '../../../schemas/bot-job.schema';
import { KlgdReconWorker } from '../../trading-ops/workers/klgd-recon.worker';
import { PreEodReconWorker } from '../../trading-ops/workers/pre-eod-recon.worker';
import { NegativeMarginWorker } from '../../trading-ops/workers/negative-margin.worker';
import { CcpLotWorker } from '../../ccp-clearing/workers/ccp-lot.worker';

@Injectable()
export class BotDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(BotDispatcherService.name);
  private readonly workers = new Map<string, IBotWorker>();
  private readonly instanceId =
    process.env.INSTANCE_ID || `inst_${process.pid}_${Math.random().toString(36).slice(2, 7)}`;

  constructor(
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    @Optional() private readonly klgdWorker?: KlgdReconWorker,
    @Optional() private readonly preEodWorker?: PreEodReconWorker,
    @Optional() private readonly negativeMarginWorker?: NegativeMarginWorker,
    @Optional() private readonly ccpLotWorker?: CcpLotWorker,
  ) {}

  onModuleInit() {
    if (this.klgdWorker) this.registerWorker(this.klgdWorker);
    if (this.preEodWorker) this.registerWorker(this.preEodWorker);
    if (this.negativeMarginWorker) this.registerWorker(this.negativeMarginWorker);
    if (this.ccpLotWorker) this.registerWorker(this.ccpLotWorker);

    this.logger.log(
      `[BotDispatcherService] Khởi tạo Dispatcher thành công trên Instance [${this.instanceId}]. Đã đăng ký ${this.workers.size} Workers.`,
    );
  }

  /**
   * Đăng ký Worker mới vào Registry năng lực động (Dynamic Capability Registry)
   */
  registerWorker(worker: IBotWorker): void {
    this.workers.set(worker.capabilityType, worker);
    this.logger.log(
      `[BotDispatcherService] Đã đăng ký Worker cho năng lực: "${worker.capabilityType}" (${worker.displayName})`,
    );
  }

  /**
   * Điều phối thực thi tác vụ theo loại năng lực nghiệp vụ (Zero Hardcoded Task ID)
   */
  async dispatch(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const { botCheckType } = context;
    const worker = this.workers.get(botCheckType);

    if (!worker) {
      throw new Error(
        `[BotDispatcherService] Không tìm thấy Worker nào hỗ trợ năng lực: "${botCheckType}". Danh sách năng lực khả dụng: [${Array.from(this.workers.keys()).join(', ')}]`,
      );
    }

    this.logger.log(
      `[BotDispatcherService] Điều phối tác vụ [${context.taskId}] tới Worker [${worker.displayName}] (Năng lực: ${botCheckType})`,
    );

    return worker.execute(context);
  }

  /**
   * Cơ chế chiếm khóa nguyên tử MongoDB (Atomic Lock via findOneAndUpdate)
   * Cho phép chạy song song đa instance (Horizontal Multi-Instance Concurrency) mà không bị tranh chấp Job.
   */
  async acquireAndProcessNextJob(): Promise<{ jobId: string; status: string } | null> {
    // Chiếm quyền khóa job ở trạng thái PENDING một cách nguyên tử
    const job = await this.botJobModel.findOneAndUpdate(
      { status: 'PENDING' },
      {
        $set: {
          status: 'PROCESSING',
          lockedBy: this.instanceId,
          lockedAt: new Date(),
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, new: true },
    );

    if (!job) {
      return null;
    }

    const payload = job.toObject?.()?.payload || (job as any).payload || {};
    const botCheckType = payload.botCheckType || job.jobType;
    const taskId = payload.taskId || 'DYNAMIC_TASK';

    const context: TaskExecutionContext = {
      taskId,
      shiftId: payload.shiftLogId,
      botCheckType,
      targetDate: payload.targetDate,
      parameters: payload,
      triggeredBy: payload.triggeredBy || 'SYSTEM_DISPATCHER',
    };

    try {
      const result = await this.dispatch(context);

      const isSuccess = result.status !== 'FAILED';
      await this.botJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: isSuccess ? 'COMPLETED' : 'FAILED',
            completedAt: new Date(),
            'payload.result': result.metrics,
            'payload.summary': result.summary,
            'payload.domainLogRefId': result.domainLogRefId,
            error: result.error,
          },
          $push: {
            logs: `[${new Date().toISOString()}] Instance [${this.instanceId}] hoàn tất: ${result.summary}`,
          },
        },
      );

      return {
        jobId: job._id.toString(),
        status: isSuccess ? 'COMPLETED' : 'FAILED',
      };
    } catch (dispatchErr: any) {
      this.logger.error(
        `[BotDispatcherService] Thất bại khi thực thi Job ${job._id} (${botCheckType}): ${dispatchErr.message}`,
      );

      await this.botJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'FAILED',
            error: dispatchErr.message,
            failedAt: new Date(),
          },
          $push: {
            logs: `[${new Date().toISOString()}] Instance [${this.instanceId}] lỗi: ${dispatchErr.message}`,
          },
        },
      );

      return {
        jobId: job._id.toString(),
        status: 'FAILED',
      };
    }
  }
}
