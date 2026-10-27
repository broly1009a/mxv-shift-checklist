import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { ShiftLog } from '../../../schemas/shift-log.schema';
import { BotJob } from '../../../schemas/bot-job.schema';
import { ShiftsService } from '../../shifts/shifts.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { BotDispatcherService } from '../dispatcher/bot-dispatcher.service';
import { BotJobQueueService } from '../queue/bot-job-queue.service';
import { isMarketWeekendClosed } from '../../../shared';

@Injectable()
export class ShiftScannerService {
  private readonly logger = new Logger(ShiftScannerService.name);
  private isProcessing = false;

  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    private readonly shiftsService: ShiftsService,
    private readonly settingsService: SystemSettingsService,
    private readonly botDispatcher: BotDispatcherService,
    @Optional()
    @Inject(forwardRef(() => BotJobQueueService))
    private readonly botJobQueueService?: BotJobQueueService,
  ) {}

  /**
   * Vòng lặp quét ca trực tự động mỗi phút (V2 Modular Monolith Shift Scanner)
   * Chạy song song và an toàn, bảo tồn 100% nghiệp vụ ca trực của MXV.
   */
  @Cron('* * * * *', {
    name: 'automated-shift-checklist-scanner',
    timeZone: 'Asia/Saigon',
  })
  async handleShiftScan() {
    if (this.isProcessing) {
      this.logger.warn(
        '[ShiftScanner] Vòng lặp trước chưa hoàn thành. Bỏ qua tick này để tránh chồng lấn.',
      );
      return;
    }

    this.isProcessing = true;

    try {
      // 1. Kiểm tra Master Switch: bot_auto_recon_enabled
      const autoReconSetting = await this.settingsService.getSetting(
        'bot_auto_recon_enabled',
        'true',
      );
      if (autoReconSetting === 'false') {
        this.logger.debug(
          '[ShiftScanner] Quét ca trực tự động đang tạm dừng bởi Master Switch (bot_auto_recon_enabled=false).',
        );
        return;
      }

      this.logger.debug('[ShiftScanner] Bắt đầu quét các ca trực đang hoạt động...');

      // 2. Lấy các ca trực PENDING trong cửa sổ vận hành (tối đa 36 giờ)
      const maxShiftAgeMs = 36 * 60 * 60 * 1000;
      const minShiftCreatedAt = new Date(Date.now() - maxShiftAgeMs);
      const activeLogs = await this.shiftLogModel
        .find({
          status: 'PENDING',
          createdAt: { $gte: minShiftCreatedAt },
        })
        .populate('shiftSlotId')
        .populate('templateId')
        .exec();

      if (activeLogs.length === 0) {
        return;
      }

      const systemUser = {
        id: '000000000000000000000000',
        fullName: 'Hệ thống tự động (Bot V2)',
        username: 'system_bot',
        role: 'ADMIN',
      };

      // 3. Pass 1: Xử lý Reset định kỳ theo tần suất (frequencyMinutesSnapshot)
      await this.handlePeriodicTaskResets(activeLogs, systemUser);

      const sessionStartSetting = await this.settingsService.getSetting(
        'session_start_time',
        '05:00',
      );

      // 4. Pass 2: Quét và kích hoạt các tác vụ đến giờ
      for (const log of activeLogs) {
        const isOvernight = this.isOvernightShift(log);
        for (const task of log.details || []) {
          const needsCheck =
            task.isBotCheckSnapshot &&
            (task.status === 'PENDING' || task.status === 'WAITING');
          if (!needsCheck) continue;

          // Market Weekend Guard: Không chạy kiểm tra khớp lệnh khi thị trường đóng cửa cuối tuần
          const isKlgdTask = task.botCheckTypeSnapshot === 'CHECK_KLGD';
          if (
            isKlgdTask &&
            isMarketWeekendClosed(new Date(), { sessionStartStr: sessionStartSetting })
          ) {
            continue;
          }

          // Kiểm tra phụ thuộc thứ tự tác vụ (Dependency Ordering)
          if (
            task.status === 'PENDING' &&
            task.dependsOnTaskIdsSnapshot &&
            task.dependsOnTaskIdsSnapshot.length > 0
          ) {
            const hasUnmetDeps = task.dependsOnTaskIdsSnapshot.some((depId: string) => {
              const depTask = (log.details || []).find((t: any) => t.taskId === depId);
              return depTask && !depTask.isChecked;
            });
            if (hasUnmetDeps) {
              this.logger.debug(
                `[ShiftScanner] Task [${task.taskId}] chưa hoàn thành các tác vụ phụ thuộc. Bỏ qua.`,
              );
              continue;
            }
          }

          // Kiểm tra giờ kích hoạt (Trigger Time, có nhận diện ca đêm qua ngày)
          if (task.status === 'PENDING' && task.botTriggerTimeSnapshot) {
            const targetTriggerDate = this.getTargetTriggerDateTime(
              log.shiftDate,
              task.botTriggerTimeSnapshot,
              isOvernight,
            );
            if (Date.now() < targetTriggerDate.getTime()) {
              continue; // Chưa tới giờ chạy
            }
          }

          // Chuyển trạng thái từ PENDING sang WAITING
          if (task.status === 'PENDING') {
            this.logger.log(
              `[ShiftScanner] Chuyển trạng thái Task [${task.taskId}] sang WAITING trong ca [${log._id}].`,
            );
            await this.shiftsService.updateTaskStatus(
              log._id.toString(),
              task.taskId,
              'WAITING',
              systemUser,
              'Hệ thống V2 đang bắt đầu quét kiểm tra tự động...',
              true,
            );
            task.status = 'WAITING';
          }

          const checkType = task.botCheckTypeSnapshot || 'CHECK_KLGD';

          // Tra cứu Job gần nhất của Task trong ca này
          const existingJob = await this.botJobModel
            .findOne({
              'payload.taskId': task.taskId,
              'payload.shiftLogId': log._id.toString(),
            })
            .sort({ createdAt: -1 })
            .exec();

          const shouldEnqueue = this.shouldEnqueueNewJob(task, existingJob);

          if (shouldEnqueue) {
            this.logger.log(
              `[ShiftScanner] Tạo Job mới cho Task [${task.taskId}] (${checkType}) trong ca [${log._id}].`,
            );

            // Tạo Job mới trong MongoDB
            const newJob = await this.botJobModel.create({
              jobType: checkType,
              status: 'PENDING',
              payload: {
                taskId: task.taskId,
                shiftLogId: log._id.toString(),
                sessionDay: log.shiftDate,
                targetDate: log.shiftDate,
                botCheckType: checkType,
                frequencyMinutes: task.frequencyMinutesSnapshot,
                triggeredBy: 'SHIFT_SCANNER_V2',
              },
              attempts: 0,
              logs: [
                `[${new Date().toISOString()}] ShiftScanner V2 enqueued job for Task [${task.taskId}]`,
              ],
            });

            // Nếu V2 Dispatcher có Worker chuyên trách, thực thi ngay lập tức qua V2!
            if (this.botDispatcher.hasWorker(checkType)) {
              await this.botDispatcher.acquireAndProcessNextJob();
              await this.syncJobResultToShift(
                log._id.toString(),
                task.taskId,
                newJob._id.toString(),
                systemUser,
              );
            } else if (this.botJobQueueService) {
              // Fallback an toàn cho các tác vụ legacy chưa chuyển đổi (RPA, Email, etc.)
              this.logger.debug(
                `[ShiftScanner] Năng lực [${checkType}] chưa có V2 Worker, ủy quyền xử lý cho Legacy Queue.`,
              );
            }
          } else if (existingJob) {
            // Đồng bộ trạng thái nếu Task đang WAITING nhưng Job đã hoàn tất trước đó
            if (
              task.status === 'WAITING' &&
              ['COMPLETED', 'FAILED'].includes(existingJob.status)
            ) {
              await this.syncJobResultToShift(
                log._id.toString(),
                task.taskId,
                existingJob._id.toString(),
                systemUser,
              );
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`[ShiftScanner] Lỗi trong vòng lặp quét ca trực: ${err.message}`, err.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Xử lý Reset định kỳ các tác vụ theo tần suất (frequencyMinutesSnapshot)
   */
  private async handlePeriodicTaskResets(activeLogs: any[], systemUser: any) {
    const periodicEnabledStr = await this.settingsService.getSetting(
      'bot_periodic_check_enabled',
      'true',
    );
    const isPeriodicEnabled = periodicEnabledStr !== 'false';
    const periodicFreqStr = await this.settingsService.getSetting(
      'bot_periodic_check_frequency',
      '',
    );
    const customFreqMin =
      periodicFreqStr &&
      !isNaN(parseInt(periodicFreqStr, 10)) &&
      parseInt(periodicFreqStr, 10) > 0
        ? parseInt(periodicFreqStr, 10)
        : null;

    const sessionStartSetting = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );

    for (const log of activeLogs) {
      let hasReset = false;
      for (const task of log.details || []) {
        if (
          task.isBotCheckSnapshot &&
          task.frequencyMinutesSnapshot &&
          task.frequencyMinutesSnapshot > 0
        ) {
          const isKlgdTask = task.botCheckTypeSnapshot === 'CHECK_KLGD';
          if (isKlgdTask) {
            if (!isPeriodicEnabled) continue;
            if (
              isMarketWeekendClosed(new Date(), { sessionStartStr: sessionStartSetting })
            )
              continue;
          }

          const effectiveFrequency =
            isKlgdTask && customFreqMin ? customFreqMin : task.frequencyMinutesSnapshot;

          const isResolved = ['PASSED', 'FAILED', 'NEEDS_ATTENTION'].includes(task.status);
          if (isResolved) {
            const lastCheckedTime =
              task.checkedAt || task.completedAt || task.failedAt || task.needsAttentionAt;
            if (lastCheckedTime) {
              const diffMs = Date.now() - new Date(lastCheckedTime).getTime();
              const diffMin = diffMs / (60 * 1000);
              if (diffMin >= effectiveFrequency) {
                this.logger.log(
                  `[ShiftScanner] Periodic reset cho Task [${task.taskId}] trong Ca [${log._id}] (Tần suất: ${effectiveFrequency}m, Quá hạn: ${Math.round(diffMin)}m).`,
                );
                await this.shiftsService.updateTaskStatus(
                  log._id.toString(),
                  task.taskId,
                  'PENDING',
                  systemUser,
                  `[Hệ thống tự động V2] Reset định kỳ ${effectiveFrequency} phút để quét lại.`,
                  true,
                );
                hasReset = true;
              }
            }
          }
        }
      }
      if (hasReset) {
        const updatedLog = await this.shiftLogModel.findById(log._id).exec();
        if (updatedLog) {
          log.details = updatedLog.details;
        }
      }
    }
  }

  /**
   * Đồng bộ kết quả thực thi của Job về trạng thái Task trong ca trực
   */
  private async syncJobResultToShift(
    shiftLogId: string,
    taskId: string,
    jobId: string,
    systemUser: any,
  ) {
    try {
      const job: any = await this.botJobModel.findById(jobId).lean().exec();
      if (!job) return;

      if (job.status === 'COMPLETED') {
        const res = job.payload?.result || {};
        const isWaiting = !!res.isWaitingFiles || res.status === 'WAITING';
        if (isWaiting) {
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'WAITING',
            systemUser,
            res.message || job.payload?.summary || 'Đang chờ file hệ thống...',
            true,
          );
        } else if (
          res.status === 'WARNING' ||
          res.status === 'NEEDS_ATTENTION' ||
          res.hasDiscrepancy ||
          (res.mismatchedTrades && res.mismatchedTrades.length > 0)
        ) {
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'NEEDS_ATTENTION',
            systemUser,
            job.payload?.summary || res.message || 'Phát hiện chênh lệch đối soát, ca trực cần lưu ý.',
            true,
          );
        } else {
          await this.shiftsService.updateTaskStatus(
            shiftLogId,
            taskId,
            'PASSED',
            systemUser,
            job.payload?.summary || res.message || 'Hệ thống tự động đối chiếu thành công.',
            true,
          );
        }
      } else if (job.status === 'FAILED') {
        await this.shiftsService.updateTaskStatus(
          shiftLogId,
          taskId,
          'FAILED',
          systemUser,
          job.error || 'Tiến trình tự động thất bại.',
          true,
        );
      }
    } catch (syncErr: any) {
      this.logger.error(
        `[ShiftScanner] Lỗi đồng bộ kết quả Job [${jobId}] về Task [${taskId}]: ${syncErr.message}`,
      );
    }
  }

  /**
   * Kiểm tra điều kiện cooldown chống lặp vô hạn khi thiếu file
   */
  public isWaitingFilesCooldownActive(
    existingJob: any,
    cooldownMinutes: number = 15,
  ): boolean {
    if (!existingJob || existingJob.status !== 'COMPLETED') {
      return false;
    }

    try {
      const jobObj =
        typeof existingJob.toObject === 'function' ? existingJob.toObject() : existingJob;
      const payload = jobObj.payload || {};
      const result = payload.result || {};

      if (!result.isWaitingFiles && result.status !== 'WAITING') {
        return false;
      }

      const lastRunTime =
        existingJob.completedAt || existingJob.updatedAt || existingJob.createdAt;
      if (!lastRunTime) {
        return false;
      }

      const elapsedMinutes = (Date.now() - new Date(lastRunTime).getTime()) / (60 * 1000);
      return elapsedMinutes < cooldownMinutes;
    } catch {
      return false;
    }
  }

  /**
   * Xác định xem có được phép đưa Job mới vào hàng đợi không (Bảo tồn 100% logic V1)
   */
  public shouldEnqueueNewJob(task: any, existingJob: any): boolean {
    if (!existingJob) {
      return true;
    }

    if (['COMPLETED', 'FAILED'].includes(existingJob.status)) {
      if (task.status === 'PENDING' || task.status === 'WAITING') {
        const cooldownMinutes =
          task.frequencyMinutesSnapshot && task.frequencyMinutesSnapshot > 0
            ? task.frequencyMinutesSnapshot
            : 15;

        // 1. Chống lặp vô hạn khi thiếu file
        if (this.isWaitingFilesCooldownActive(existingJob, cooldownMinutes)) {
          this.logger.debug(
            `[ShiftScanner] Cooldown kích hoạt cho Task [${task.taskId}] khi đang chờ file (cooldown: ${cooldownMinutes}m).`,
          );
          return false;
        }

        // 2. Bypass cooldown nếu người dùng chủ động reset task trên Web sau thời điểm Job chạy
        const taskStartedAt = task.startedAt ? new Date(task.startedAt).getTime() : 0;
        const taskUpdatedAt = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
        const taskResetTime = Math.max(taskStartedAt, taskUpdatedAt);
        const lastJobTime = existingJob.updatedAt
          ? new Date(existingJob.updatedAt).getTime()
          : new Date(existingJob.createdAt).getTime();

        if (taskResetTime > lastJobTime) {
          this.logger.debug(
            `[ShiftScanner] Task [${task.taskId}] được reset/bắt đầu sau Job cũ. Bỏ qua cooldown và kích hoạt ngay.`,
          );
          return true;
        }

        const lastRunTime = existingJob.updatedAt || existingJob.createdAt;
        const diffMs = Date.now() - new Date(lastRunTime).getTime();
        const diffMin = diffMs / (60 * 1000);

        if (diffMin >= cooldownMinutes) {
          return true;
        } else {
          this.logger.debug(
            `[ShiftScanner] Cooldown kích hoạt cho Task [${task.taskId}] (cooldown: ${cooldownMinutes}m, đã qua: ${Math.round(diffMin)}m).`,
          );
        }
      }
    }

    return false;
  }

  /**
   * Kiểm tra ca trực có phải là ca đêm qua ngày (overnight)
   */
  public isOvernightShift(log: any): boolean {
    const slot = log?.shiftSlotId as any;
    if (slot && typeof slot.isOvernight === 'boolean') {
      return slot.isOvernight;
    }
    if (slot?.startTime && slot?.endTime && slot.startTime > slot.endTime) {
      return true;
    }
    const template = log?.templateId as any;
    if (
      template?.shiftSlotId &&
      typeof template.shiftSlotId.isOvernight === 'boolean'
    ) {
      return template.shiftSlotId.isOvernight;
    }
    const title = (template?.title || '').toLowerCase();
    if (
      title.includes('ca 3') ||
      title.includes('đêm') ||
      title.includes('night')
    ) {
      return true;
    }
    return false;
  }

  /**
   * Tính toán thời điểm kích hoạt chính xác theo chuỗi HH:mm (GMT+7)
   */
  public getTargetTriggerDateTime(
    shiftDateStr: string,
    timeStr: string,
    isOvernight: boolean = false,
  ): Date {
    const [sY, sM, sD] = shiftDateStr.split('-').map(Number);
    const [trigH, trigM] = (timeStr || '00:00').split(':').map(Number);
    const dayOffset = isOvernight && trigH < 12 ? 1 : 0;
    return new Date(Date.UTC(sY, sM - 1, sD + dayOffset, trigH - 7, trigM, 0, 0));
  }
}
