/**
 * bot-job-queue.service.ts
 *
 * Dịch vụ Quản lý Hàng đợi Tác vụ Bot (Bot Job Queue Service).
 * Đặt tại modules/checklist-hub/queue/ theo chuẩn Kiến trúc Modular Monolith V2.
 * Tuân thủ nghiêm ngặt nguyên lý Đơn trách nhiệm (Single Responsibility Principle - SRP):
 *  1. Quản lý hàng đợi Job (Enqueue, Atomic Deduplication Guard).
 *  2. Điều phối thực thi (ProcessQueue, Atomic Locks, Dispatch to V2 Dispatcher / V1 Registry).
 *  3. Đồng bộ trạng thái (SyncJobToChecklist, WebSocket Events, ShiftLog update).
 *  4. Quản lý vòng đời Job (Cancel, Cleanup Stuck Jobs, Query Job Status).
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotDispatcherService } from '../dispatcher/bot-dispatcher.service';
import { BotJob } from '../../../schemas/bot-job.schema';
import { BotJobHandlerRegistry } from './job-handler.registry';
import { IJobExecutionContext } from './job-handler.interface';
import { ShiftsService } from '../../shifts/shifts.service';
import { ShiftsGateway } from '../../shifts/shifts.gateway';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { SystemLogsService } from '../../system-logs/system-logs.service';
import { parseJobPayload } from '../../../shared/helpers/file-path.helper';
import { BotJobDedupHelper } from '../helpers/bot-job-dedup.helper';
import { isAuditJobType } from '../../../shared';
import { BotAlertEmailService } from '../../notifications/bot-alert-email.service';

interface IActiveJobContext {
  jobId: string;
  abortController: AbortController;
  cleanups: (() => Promise<void> | void)[];
  startedAt?: Date;
}

@Injectable()
export class BotJobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotJobQueueService.name);
  private isProcessing = false;
  private activeJobs = new Map<string, IActiveJobContext>();
  private queueInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    private readonly registry: BotJobHandlerRegistry,
    private readonly shiftsService: ShiftsService,
    private readonly shiftsGateway: ShiftsGateway,
    private readonly settingsService: SystemSettingsService,
    private readonly systemLogsService: SystemLogsService,
    @Optional()
    @Inject(forwardRef(() => BotDispatcherService))
    private readonly botDispatcher?: BotDispatcherService,
    @Optional()
    private readonly botAlertEmailService?: BotAlertEmailService,
  ) {}

  onModuleInit() {
    // Dọn dẹp các Job bị treo ở trạng thái PROCESSING khi khởi động server
    this.cleanupStuckJobs(true).catch((err) => {
      this.logger.error(
        `Lỗi khi dọn dẹp các Job bị treo lúc khởi động: ${err.message}`,
      );
    });

    // Khởi chạy vòng lặp worker ngầm mỗi 10 giây
    this.queueInterval = setInterval(() => {
      this.processQueue().catch((err) => {
        this.logger.error(
          `Error in background queue loop: ${err.message}`,
          err.stack,
        );
      });
    }, 10000);

    // Chạy dọn dẹp định kỳ mỗi 5 phút một lần
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupStuckJobs().catch((err) => {
          this.logger.error(
            `Lỗi khi dọn dẹp định kỳ các Job bị treo: ${err.message}`,
          );
        });
      },
      5 * 60 * 1000,
    );

    this.logger.log(
      'Background BotJob queue worker initialized (polling every 10s with Handler Strategy Pattern).',
    );
  }

  onModuleDestroy() {
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.logger.log('Background BotJob queue worker stopped.');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ENQUEUE (ĐƯA JOB VÀO HÀNG ĐỢI KÈM ATOMIC DEDUPLICATION GUARD)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Đưa một job mới vào hàng đợi PENDING (có tích hợp Deduplication Guard).
   */
  public async enqueue(
    jobType: string,
    payload: Record<string, any> = {},
    maxAttempts: number = 3,
    options?: { bypassDedup?: boolean },
  ): Promise<BotJob> {
    if (!options?.bypassDedup) {
      const dedup = await BotJobDedupHelper.checkJobConflict(
        this.botJobModel,
        jobType,
        payload,
      );
      if (!dedup.canEnqueue && dedup.activeJob) {
        this.logger.warn(`[DEDUP-GUARD] ${dedup.reason}`);
        const reusedJob = dedup.activeJob;
        (reusedJob as any).isReused = true;
        (reusedJob as any).dedupReason = dedup.reason;
        return reusedJob as BotJob;
      }
    }

    const job = new this.botJobModel({
      jobType,
      payload,
      maxAttempts,
      status: 'PENDING',
      attempts: 0,
      logs: [`[${new Date().toISOString()}] Job enqueued.`],
    });
    const saved = await job.save();
    await this.syncJobToChecklist(saved, 'PENDING');
    (saved as any).isReused = false;
    return saved;
  }

  /**
   * Chạy trực tiếp một job cụ thể qua CLI hoặc Agent.
   */
  public async executeJobDirectly(job: any): Promise<void> {
    const handler = this.registry.getHandler(job.jobType);
    if (!handler) {
      throw new Error(`Loại job không được hỗ trợ bởi bất kỳ Handler nào: ${job.jobType}`);
    }

    const context: IJobExecutionContext = {
      syncJobToChecklist: this.syncJobToChecklist.bind(this),
      logger: this.logger,
    };

    await handler.execute(job, context);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PROCESS QUEUE (ĐIỀU PHỐI VÀ THỰC THI TÁC VỤ TRONG HÀNG ĐỢI)
  // ─────────────────────────────────────────────────────────────────────────────

  private async processQueue() {
    // Tự động phục hồi cờ isProcessing nếu không có Job nào đang thực sự chạy trong RAM
    if (this.isProcessing && this.activeJobs.size === 0) {
      this.logger.warn('[QUEUE] Cờ isProcessing bị kẹt khi không có Job active -> Tự động giải phóng.');
      this.isProcessing = false;
    }

    if (this.isProcessing) {
      return;
    }

    // Nâng cấp Atomic Lock qua findOneAndUpdate: An toàn tuyệt đối khi chạy đa instance song song
    const instanceId = process.env.INSTANCE_ID || `inst_${process.pid}`;
    const job: any = await this.botJobModel.findOneAndUpdate(
      { status: 'PENDING' },
      {
        $set: {
          status: 'PROCESSING',
          lockedBy: instanceId,
          lockedAt: new Date(),
        },
      },
      { sort: { createdAt: 1 }, returnDocument: 'after' } as any,
    );
    if (!job) {
      return;
    }

    this.isProcessing = true;

    // Chốt chặn Queue Guard: Kiểm tra xem ca trực đã COMPLETED hoặc tác vụ kiểm tra đã được hoàn thành thủ công chưa
    const payload = parseJobPayload(job);
    const { shiftLogId, taskId } = payload;

    if (shiftLogId) {
      try {
        const rawShiftLog = await this.shiftsService.findShiftLogRaw(shiftLogId);
        if (rawShiftLog) {
          if (rawShiftLog.status === 'COMPLETED') {
            job.status = 'CANCELLED';
            job.completedAt = new Date();
            job.error = 'Đã hủy tự động do ca trực đã chốt (COMPLETED).';
            job.logs.push(
              `[${new Date().toISOString()}] Bỏ qua thực thi: Ca trực ${shiftLogId} đã chốt (COMPLETED).`,
            );
            await this.botJobModel.updateOne(
              { _id: job._id },
              {
                $set: {
                  status: 'CANCELLED',
                  completedAt: job.completedAt,
                  error: job.error,
                  logs: job.logs,
                },
              },
            );
            this.logger.log(
              `[QUEUE_GUARD] Đã hủy Job ${job.jobType} (${job._id}) do ca trực ${shiftLogId} đã chốt.`,
            );
            this.shiftsGateway.emitJobStatusUpdated(job._id.toString(), {
              status: 'CANCELLED',
              jobType: job.jobType,
              shiftLogId,
              taskId,
              error: job.error,
              logs: job.logs,
            });
            this.isProcessing = false;
            return;
          }

          if (taskId) {
            const task = (rawShiftLog.details || []).find((d: any) => d.taskId === taskId);
            const isAuditJob = isAuditJobType(job.jobType);
            if (task && task.isChecked && isAuditJob) {
              job.status = 'CANCELLED';
              job.completedAt = new Date();
              job.error = 'Đã hủy tự động do tác vụ đã được thẩm định hoàn thành trước đó.';
              job.logs.push(
                `[${new Date().toISOString()}] Bỏ qua thực thi: Tác vụ [${taskId}] đã được tích hoàn thành thủ công.`,
              );
              await this.botJobModel.updateOne(
                { _id: job._id },
                {
                  $set: {
                    status: 'CANCELLED',
                    completedAt: job.completedAt,
                    error: job.error,
                    logs: job.logs,
                  },
                },
              );
              this.logger.log(
                `[QUEUE_GUARD] Đã hủy Job ${job.jobType} (${job._id}) do tác vụ [${taskId}] đã tích hoàn thành.`,
              );
              this.shiftsGateway.emitJobStatusUpdated(job._id.toString(), {
                status: 'CANCELLED',
                jobType: job.jobType,
                shiftLogId,
                taskId,
                error: job.error,
                logs: job.logs,
              });
              this.isProcessing = false;
              return;
            }
          }
        }
      } catch (guardErr: any) {
        this.logger.warn(`[QUEUE_GUARD] Lỗi kiểm tra ca trực: ${guardErr.message}`);
      }
    }

    job.attempts += 1;
    const startTime = new Date().toISOString();
    job.logs.push(
      `[${startTime}] Starting attempt ${job.attempts}/${job.maxAttempts}...`,
    );
    await this.syncJobToChecklist(job, 'PROCESSING');

    this.logger.log(
      `Processing job ${job.jobType} (ID: ${job._id}, Attempt: ${job.attempts}) via Registry`,
    );

    const abortController = new AbortController();
    const cleanups: (() => Promise<void> | void)[] = [];

    this.activeJobs.set(job._id.toString(), {
      jobId: job._id.toString(),
      abortController,
      cleanups,
      startedAt: new Date(),
    });

    const context: IJobExecutionContext = {
      syncJobToChecklist: this.syncJobToChecklist.bind(this),
      logger: this.logger,
      abortSignal: abortController.signal,
      registerCleanup: (cleanupFn) => cleanups.push(cleanupFn),
    };

    try {
      const contextPayload = parseJobPayload(job);
      const capabilityKey = contextPayload.botCheckType || job.jobType;

      // Tự động flush log định kỳ ra MongoDB mỗi 1.5s cho bất kỳ Job nào đang chạy
      let lastFlushedLength = job.logs?.length || 0;
      const logFlushTimer = setInterval(async () => {
        if (job.logs && job.logs.length > lastFlushedLength) {
          lastFlushedLength = job.logs.length;
          try {
            await this.botJobModel.updateOne(
              { _id: job._id },
              { $set: { logs: job.logs } },
            );
            this.shiftsGateway.emitJobLogUpdated(
              job._id.toString(),
              job.logs,
              'PROCESSING',
            );
          } catch {
            // Chạy nền an toàn: Bỏ qua lỗi tạm thời, không làm gián đoạn Job
          }
        }
      }, 1500);

      try {
        // ── ƯU TIÊN SỐ 1: BÀN GIAO CHO BOT DISPATCHER V2 (STRANGLER FIG PATTERN) ──
        if (this.botDispatcher && this.botDispatcher.hasWorker(capabilityKey)) {
          this.logger.log(
            `[BotJobQueue] Điều phối ưu tiên sang BotDispatcherService V2 cho năng lực: "${capabilityKey}" (Job: ${job.jobType}, ID: ${job._id})...`,
          );
          const taskContext = {
            taskId: contextPayload.taskId || `JOB_${job._id}`,
            botCheckType: capabilityKey,
            shiftId: contextPayload.shiftLogId,
            targetDate: contextPayload.targetDate || contextPayload.sessionDay,
            parameters: {
              ...contextPayload,
              job,
            },
            job,
            onLog: (line: string) => {
              const logLine = line.startsWith('[')
                ? line
                : `[${new Date().toISOString()}] ${line}`;
              if (!job.logs.includes(logLine)) {
                job.logs.push(logLine);
              }
            },
          };
          const dispatchRes = await this.botDispatcher.dispatch(taskContext);
          if (dispatchRes.logs && Array.isArray(dispatchRes.logs)) {
            for (const l of dispatchRes.logs) {
              if (!job.logs.includes(l)) {
                job.logs.push(l);
              }
            }
          }
          job.logs.push(
            `[${new Date().toISOString()}] [BotDispatcher V2] ${dispatchRes.summary}`,
          );
          const isWaiting = dispatchRes.status === 'WAITING' || !!dispatchRes.isWaitingFiles;
          const enrichedResult = {
            ...(dispatchRes.metrics || {}),
            ...(dispatchRes.details || {}),
            status: dispatchRes.status,
            summary: dispatchRes.summary,
            passed: dispatchRes.status === 'SUCCESS',
            isWaitingFiles: isWaiting,
            message: dispatchRes.summary,
          };
          job.payload = { ...contextPayload, result: enrichedResult };

          let finalStatus = 'COMPLETED';
          if (dispatchRes.status === 'FAILED') {
            const errorMsg =
              dispatchRes.error ||
              dispatchRes.summary ||
              'Thất bại không rõ nguyên nhân từ BotDispatcher V2';
            throw new Error(errorMsg);
          } else if (isWaiting) {
            finalStatus = 'WAITING';
          }
          await job.save();

          const freshJob = await this.botJobModel.findById(job._id).select('status').exec();
          if (freshJob?.status === 'CANCELLED') {
            this.logger.log(`[QUEUE] Job ${job.jobType} (${job._id}) đã bị hủy giữa chừng.`);
            return;
          }

          await this.syncJobToChecklist(job, finalStatus as any);
          this.logger.log(
            `Job ${job.jobType} (ID: ${job._id}) hoàn thành (${finalStatus}) qua BotDispatcher V2.`,
          );
          return;
        }

        // ── ƯU TIÊN SỐ 2: THỰC THI QUA V1 HANDLER REGISTRY ──
        const handler = this.registry.getHandler(job.jobType);
        if (!handler) {
          throw new Error(`Loại job không được hỗ trợ: ${job.jobType}`);
        }

        await handler.execute(job, context);
      } finally {
        clearInterval(logFlushTimer);
      }

      const freshJob = await this.botJobModel.findById(job._id).select('status').exec();
      if (freshJob?.status === 'CANCELLED') {
        this.logger.log(`[QUEUE] Job ${job.jobType} (${job._id}) đã bị hủy giữa chừng, bỏ qua cập nhật COMPLETED.`);
        return;
      }

      await this.syncJobToChecklist(job, 'COMPLETED');
      this.logger.log(
        `Job ${job.jobType} (ID: ${job._id}) completed successfully.`,
      );
    } catch (err: any) {
      const freshJob = await this.botJobModel.findById(job._id).select('status').exec();
      if (freshJob?.status === 'CANCELLED') {
        this.logger.log(`[QUEUE] Job ${job.jobType} (${job._id}) đã bị hủy trong quá trình chạy, bỏ qua retry/failure.`);
        return;
      }

      const errorMsg = err.message || 'Lỗi không xác định';
      this.logger.error(
        `Job ${job.jobType} (ID: ${job._id}) failed: ${errorMsg}`,
      );

      job.logs.push(
        `[${new Date().toISOString()}] Attempt ${job.attempts} failed: ${errorMsg}`,
      );

      const isPartnerUnavailable = errorMsg.includes('[PARTNER_SERVICE_UNAVAILABLE]');

      if (job.attempts < job.maxAttempts) {
        await this.syncJobToChecklist(job, 'PENDING', errorMsg);
      } else {
        if (isPartnerUnavailable) {
          // Gán nhãn ABORTED (Tạm dừng do lỗi sàn ngoài) thay vì FAILED (Lỗi hệ thống)
          await this.syncJobToChecklist(job, 'ABORTED', errorMsg);
          this.logger.warn(
            `Job ${job.jobType} (ID: ${job._id}) tạm dừng (ABORTED) do đối tác không khả dụng sau ${job.attempts} lần thử: ${errorMsg}`,
          );
        } else {
          await this.sendOperationalFailureAlert(job, errorMsg).catch(
            (emailErr) => {
              this.logger.error(
                `Lỗi khi gọi sendOperationalFailureAlert: ${emailErr.message}`,
              );
            },
          );
          await this.syncJobToChecklist(job, 'FAILED', errorMsg);
          await this.logFailureToSystemLog(job, errorMsg).catch((logErr) => {
            this.logger.error(`Lỗi ghi SystemLog thất bại: ${logErr.message}`);
          });
        }
      }
    } finally {
      this.activeJobs.delete(job._id.toString());
      this.isProcessing = false;
      if (typeof global !== 'undefined' && (global as any).gc) {
        try {
          (global as any).gc();
        } catch {}
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. CANCEL JOB (HỦY / DỪNG KHẨN CẤP MỘT JOB)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Hủy hoặc Dừng khẩn cấp một Job bất kỳ (PENDING hoặc PROCESSING)
   */
  public async cancelJob(jobId: string, reason?: string): Promise<any> {
    const job = await this.botJobModel.findById(jobId).exec();
    if (!job) {
      throw new NotFoundException(`Không tìm thấy Job với ID: ${jobId}`);
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
      throw new BadRequestException(`Không thể hủy tác vụ đã ở trạng thái kết thúc (${job.status}).`);
    }

    const cancelReason = reason || 'Đã hủy thủ công bởi Quản trị viên';
    const timestamp = new Date().toISOString();
    const cancelLog = `[${timestamp}] Tác vụ đã bị HỦY / DỪNG THỦ CÔNG bởi Admin. Lý do: ${cancelReason}`;

    // 1. Trường hợp Job PENDING: Hủy ngay trong DB
    if (job.status === 'PENDING') {
      job.status = 'CANCELLED';
      job.completedAt = new Date();
      job.error = cancelReason;
      job.logs.push(cancelLog);
      await this.botJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'CANCELLED',
            completedAt: job.completedAt,
            error: job.error,
            logs: job.logs,
          },
        },
      );
      await this.syncJobToChecklist(job, 'CANCELLED', cancelReason);
      if (this.activeJobs.size === 0) {
        this.isProcessing = false;
      }
      this.logger.log(`[JOB_CANCEL] Đã hủy job PENDING: ${jobId}`);
      return { success: true, message: 'Đã hủy tác vụ đang chờ trong hàng đợi.', job };
    }

    // 2. Trường hợp Job PROCESSING: Kích hoạt abort & cleanup
    const activeCtx = this.activeJobs.get(jobId);
    if (activeCtx) {
      this.logger.log(`[JOB_CANCEL] Đang kích hoạt Abort & Cleanup cho job đang chạy: ${jobId}...`);
      try {
        activeCtx.abortController.abort();
      } catch (abortErr: any) {
        this.logger.warn(`[JOB_CANCEL] Lỗi khi gọi abort(): ${abortErr.message}`);
      }

      for (const cleanup of activeCtx.cleanups) {
        try {
          await cleanup();
        } catch (cleanupErr: any) {
          this.logger.warn(`[JOB_CANCEL] Lỗi trong cleanup handler: ${cleanupErr.message}`);
        }
      }
      this.activeJobs.delete(jobId);
    }

    job.status = 'CANCELLED';
    job.completedAt = new Date();
    job.error = cancelReason;
    job.logs.push(cancelLog);

    await this.botJobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'CANCELLED',
          completedAt: job.completedAt,
          error: job.error,
          logs: job.logs,
        },
      },
    );

    await this.syncJobToChecklist(job, 'CANCELLED', cancelReason);
    this.isProcessing = false;
    this.logger.log(`[JOB_CANCEL] Đã dừng khẩn cấp job ${jobId} thành công.`);
    return { success: true, message: 'Đã dừng khẩn cấp tác vụ thành công.', job };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CLEANUP STUCK JOBS (DỌN DẸP CÁC JOB BỊ TREO / ZOMBIE)
  // ─────────────────────────────────────────────────────────────────────────────

  async cleanupStuckJobs(isStartup: boolean = false): Promise<void> {
    const thresholdMs = 15 * 60 * 1000;
    const now = Date.now();
    const currentInstanceId = process.env.INSTANCE_ID || `inst_${process.pid}`;

    const query: any = {
      status: { $in: ['PROCESSING', 'AWAITING_CAPTCHA'] },
    };
    if (isStartup) {
      query.$or = [
        { lockedBy: currentInstanceId },
        { lockedAt: { $lt: new Date(now - thresholdMs) } },
        { updatedAt: { $lt: new Date(now - thresholdMs) } },
      ];
    } else {
      query.$or = [
        { lockedAt: { $lt: new Date(now - thresholdMs) } },
        { updatedAt: { $lt: new Date(now - thresholdMs) } },
      ];
    }

    const stuckJobs = await this.botJobModel.find(query).exec();
    if (stuckJobs.length === 0) return;

    this.logger.warn(
      `Phát hiện ${stuckJobs.length} Job bị treo hoặc timeout. Đang tiến hành dọn dẹp...`,
    );

    for (const job of stuckJobs) {
      if (job.status === 'PROCESSING') {
        const activeCtx = this.activeJobs.get(job._id.toString());
        if (activeCtx) {
          try {
            activeCtx.abortController.abort();
          } catch {}
          for (const cleanup of activeCtx.cleanups) {
            try {
              await cleanup();
            } catch {}
          }
          this.activeJobs.delete(job._id.toString());
        }
      }

      const reason = `Tự động dọn dẹp do Job bị treo quá 15 phút (lockedAt: ${job.lockedAt || job.updatedAt})`;
      job.logs.push(`[${new Date().toISOString()}] ${reason}`);
      job.status = job.attempts < job.maxAttempts ? 'PENDING' : 'FAILED';
      job.lockedBy = undefined;
      job.lockedAt = undefined;

      await this.botJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: job.status,
            lockedBy: null,
            lockedAt: null,
            logs: job.logs,
          },
        },
      );

      if (job.attempts < job.maxAttempts) {
        await this.syncJobToChecklist(job, 'PENDING', reason);
      } else {
        await this.syncJobToChecklist(job, 'FAILED', reason);
      }
    }

    if (this.activeJobs.size === 0) {
      this.isProcessing = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. SYNC JOB TO CHECKLIST & WEBSOCKET BROADCASTING
  // ─────────────────────────────────────────────────────────────────────────────

  private async logFailureToSystemLog(job: any, errorMsg: string) {
    const payload = parseJobPayload(job);
    const dateStr = payload.sessionDay || new Date().toISOString().split('T')[0];
    const message = `[Bot Đối Soát] Thất bại tác vụ ${job.jobType}: ${errorMsg}`;

    await this.systemLogsService.logEvent({
      eventType: 'BOT_JOB_FAILED',
      source: 'SYSTEM',
      status: 'FAILED',
      message,
      metadata: {
        jobId: job._id?.toString(),
        jobType: job.jobType,
        attempts: job.attempts,
        error: errorMsg,
      },
    });

    this.shiftsGateway.emitEvent(
      'DASHBOARD_UPDATED',
      payload.shiftLogId || null,
      null,
      null,
      dateStr,
      {
        type: 'BOT_FAILED',
        message,
        jobId: job._id?.toString(),
        jobType: job.jobType,
      },
    );
  }

  /**
   * Gửi cảnh báo lỗi vận hành Job thất bại (ủy quyền qua BotAlertEmailService).
   */
  async sendOperationalFailureAlert(job: any, errorMsg: string): Promise<void> {
    if (this.botAlertEmailService) {
      await this.botAlertEmailService.sendOperationalFailureAlert(job, errorMsg);
    }
  }

  /**
   * Đồng bộ trạng thái BotJob sang Checklist ca trực và phát WebSocket event.
   */
  public async syncJobToChecklist(
    job: any,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'AWAITING_CAPTCHA' | 'CANCELLED' | 'ABORTED' | 'WAITING',
    error?: string,
  ) {
    const payload = parseJobPayload(job);
    const { shiftLogId, taskId } = payload;

    job.status = status;
    const now = new Date();
    if (status === 'COMPLETED') {
      job.completedAt = now;
    } else if (status === 'FAILED') {
      job.failedAt = now;
      job.error = error;
    } else if (status === 'CANCELLED' || status === 'ABORTED') {
      job.completedAt = now;
      job.error = error;
    } else if (status === 'PENDING') {
      job.lockedBy = null;
      job.lockedAt = null;
      if (error) {
        job.error = error;
      }
    }

    await this.botJobModel
      .updateOne(
        { _id: job._id },
        {
          $set: {
            status: job.status,
            completedAt: job.completedAt,
            failedAt: job.failedAt,
            attempts: job.attempts,
            logs: job.logs,
            payload: job.payload,
            lockedBy: job.lockedBy ?? null,
            lockedAt: job.lockedAt ?? null,
          },
        },
      )
      .exec();

    if (shiftLogId && taskId) {
      try {
        const rawShiftLog = await this.shiftsService.findShiftLogRaw(shiftLogId);
        if (!rawShiftLog) {
          this.logger.warn(
            `[SYNC_GUARD] Bỏ qua cập nhật Checklist cho Job ${job._id} vì không tìm thấy ca trực [${shiftLogId}].`,
          );
          return;
        }

        const taskExists = (rawShiftLog.details || []).some(
          (d: any) => d.taskId === taskId,
        );
        if (!taskExists) {
          this.logger.warn(
            `[SYNC_GUARD] Bỏ qua cập nhật Checklist cho Job ${job._id} vì tác vụ [${taskId}] không thuộc ca trực [${shiftLogId}].`,
          );
          return;
        }

        if (rawShiftLog.status === 'COMPLETED') {
          this.logger.log(
            `[SYNC_GUARD] Bỏ qua cập nhật Checklist cho Job ${job._id} vì ca trực ${shiftLogId} đã chốt.`,
          );
          return;
        }

        const systemUser = {
          id: '000000000000000000000000',
          fullName: 'Hệ thống tự động (Bot)',
          username: 'system_bot',
          role: 'ADMIN',
        };

        if (status === 'PROCESSING') {
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'IN_PROGRESS',
            systemUser,
            `Bot đang xử lý (Lần thử ${job.attempts}/${job.maxAttempts})...`,
            true,
          );
        } else if (status === 'WAITING') {
          const noteMsg = payload?.result?.summary || '[Đang chờ dữ liệu] Thư mục backup đang chờ cập nhật đầy đủ file đối chiếu.';
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'PENDING',
            systemUser,
            noteMsg,
            true,
          );
        } else if (status === 'PENDING') {
          const isPartner = error && error.includes('[PARTNER_SERVICE_UNAVAILABLE]');
          const cleanError = error ? error.replace(/\[PARTNER_SERVICE_UNAVAILABLE\]\s*/g, '') : '';
          const retryMsg = error
            ? isPartner
                ? `[Tạm dừng chờ thử lại] Sàn/Dịch vụ đối tác tạm thời chưa phản hồi (Lần ${job.attempts}/${job.maxAttempts}). Bot sẽ tự động thử lại... (${cleanError.substring(0, 100)})`
                : `[Chờ thử lại] Gặp sự cố lần ${job.attempts}/${job.maxAttempts}: ${cleanError.substring(0, 100)}. Sẽ tự động thử lại...`
            : `Đang chờ thực thi tự động (Lần thử ${job.attempts}/${job.maxAttempts})...`;
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'PENDING',
            systemUser,
            retryMsg,
            true,
          );
        } else if (status === 'COMPLETED') {
          let message = 'Bot đã hoàn thành kiểm tra tự động thành công.';
          if (isAuditJobType(job.jobType)) {
            const checkData = {
              type: job.jobType,
              jobId: job._id.toString(),
              status: 'COMPLETED',
              completedAt: job.completedAt,
              result: payload?.result,
              data: {
                totalCount: payload?.totalCount ?? 0,
                failedCount: 0,
                failedList: '',
                timestamp: new Date().toISOString(),
              },
            };
            message = JSON.stringify(checkData);
          } else if (payload.totalCount !== undefined) {
            message = `Đã xác minh ${payload.totalCount} email: 0 lỗi.`;
          }

          let taskStatus: 'PASSED' | 'NEEDS_ATTENTION' | 'PENDING' = 'PASSED';
          if (
            isAuditJobType(job.jobType) ||
            [
              'CCP_LOT_STATS',
              'CCP_VALUE_STATS',
              'CCP_EOD_RECON',
              'CHECK_CCP_STATISTICS',
              'CHECK_CCP_VALUE',
              'CHECK_EOD_CCP',
              'CHECK_NEGATIVE_MARGIN',
            ].includes(job.jobType)
          ) {
            if (payload?.result?.isWaitingFiles || payload?.result?.status === 'WAITING') {
              taskStatus = 'PENDING';
            } else if (
              payload?.result?.status === 'WARNING' ||
              payload?.result?.passed === false
            ) {
              taskStatus = 'NEEDS_ATTENTION';
            } else {
              taskStatus = 'PASSED';
            }
          }

          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            taskStatus,
            systemUser,
            message,
            true,
          );

          // Đồng bộ kết quả lên Task Cha nếu taskId hiện tại là task con
          if (rawShiftLog?.details) {
            const currentSubTask = rawShiftLog.details.find(
              (d: any) => d.taskId === taskId,
            );
            const parentId = currentSubTask?.parentTaskIdSnapshot;
            if (parentId && parentId !== taskId) {
              await this.shiftsService
                .updateTaskStatus(
                  shiftLogId,
                  parentId,
                  taskStatus,
                  systemUser,
                  message,
                  true,
                )
                .catch((e: any) =>
                  this.logger.warn(
                    `Không thể đồng bộ kết quả lên task cha ${parentId}: ${e.message}`,
                  ),
                );
            }
          }
        } else if (status === 'FAILED' || status === 'ABORTED') {
          // Human Override Guard: Nếu ca trực đã chốt hoặc tác vụ đã được người dùng duyệt hoàn thành,
          // bot tuyệt đối không ghi đè trạng thái FAILED/ABORTED!
          if (rawShiftLog) {
            const existingTask = (rawShiftLog.details || []).find(
              (d: any) => d.taskId === taskId,
            );
            const isHumanChecked =
              existingTask &&
              existingTask.isChecked &&
              existingTask.updatedBy &&
              existingTask.updatedBy.toString() !== '000000000000000000000000';

            if (isHumanChecked) {
              this.logger.warn(
                `[HUMAN_OVERRIDE] Tác vụ [${taskId}] đã được nhân viên xác nhận hoàn thành trước đó. Bỏ qua ghi đè từ Bot.`,
              );
              return;
            }
          }

          let message = error || (status === 'ABORTED' ? 'Tạm dừng do dịch vụ đối tác không khả dụng.' : 'Lỗi không xác định khi chạy bot.');
          if (payload?.totalCount !== undefined) {
            message = `Đã xác minh ${payload.totalCount} email: Phát hiện ${payload.failedCount} lỗi. Danh sách: ${payload.failedList}`;
          } else if (isAuditJobType(job.jobType)) {
            const checkData = {
              type: job.jobType,
              jobId: job._id.toString(),
              status: status,
              failedAt: job.failedAt || job.completedAt,
              error: message,
              data: {
                totalCount: 0,
                failedCount: 0,
                failedList: '',
                timestamp: new Date().toISOString(),
              },
            };
            message = JSON.stringify(checkData);
          }

          const targetTaskStatus = status === 'ABORTED' ? 'NEEDS_ATTENTION' : 'FAILED';
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            targetTaskStatus,
            systemUser,
            isAuditJobType(job.jobType)
              ? message
              : message.includes('SLA')
                ? message
                : status === 'ABORTED'
                  ? `Tạm dừng đối soát do sàn ngoài: ${message}`
                  : `Kiểm tra tự động thất bại: ${message}`,
            true,
          );
        }
      } catch (err: any) {
        this.logger.error(
          `Lỗi cập nhật trạng thái checklist cho Job ${job._id}: ${err.message}`,
        );
      }
    }

    // Phát sự kiện Realtime WebSocket qua ShiftsGateway
    try {
      const targetDate =
        payload.targetDate ||
        payload.sessionDay ||
        new Date().toISOString().split('T')[0];
      this.shiftsGateway.emitEvent(
        'DASHBOARD_UPDATED',
        job._id.toString(),
        null,
        null,
        targetDate,
        {
          jobId: job._id.toString(),
          status,
          jobType: job.jobType,
          shiftLogId,
          taskId,
        },
      );
      this.shiftsGateway.emitJobStatusUpdated(job._id.toString(), {
        status,
        jobType: job.jobType,
        shiftLogId,
        taskId,
        result: payload?.result,
        error: job.error,
        logs: job.logs,
      });
      this.logger.log(
        `Emitted dashboard-updated & job-status-updated WS event for job ${job._id} (${status})`,
      );
    } catch (err: any) {
      this.logger.error(`Lỗi phát sự kiện Realtime WebSocket: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. QUERY METHODS (TRA CỨU JOB THEO TASK / ID / LOẠI)
  // ─────────────────────────────────────────────────────────────────────────────

  async getJobForTask(
    taskId: string,
    shiftLogId?: string,
  ): Promise<BotJob | null> {
    const query: Record<string, any> = { 'payload.taskId': taskId };
    if (shiftLogId) {
      query['payload.shiftLogId'] = shiftLogId;
    }
    return this.botJobModel.findOne(query).sort({ createdAt: -1 }).exec();
  }

  async getLatestCompletedJobByType(
    jobType: string,
    withinMinutes?: number,
  ): Promise<BotJob | null> {
    const query: Record<string, any> = {
      jobType,
      status: { $in: ['COMPLETED', 'WAITING', 'FAILED', 'CANCELLED'] },
    };
    if (withinMinutes && withinMinutes > 0) {
      const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);
      query.$or = [
        { completedAt: { $gte: cutoff } },
        { updatedAt: { $gte: cutoff } },
      ];
    }
    return this.botJobModel
      .findOne(query)
      .sort({ updatedAt: -1, completedAt: -1, createdAt: -1 })
      .exec();
  }

  async hasActiveJobByType(jobType: string): Promise<boolean> {
    const count = await this.botJobModel.countDocuments({
      jobType,
      status: { $in: ['PENDING', 'PROCESSING'] },
    });
    return count > 0;
  }

  async getJobById(id: string): Promise<BotJob | null> {
    return this.botJobModel.findById(id).exec();
  }
}
