import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { ShiftsService } from '../shifts/shifts.service';
import { EmailWatcherService } from './email-watcher.service';
import { FileWatcherService } from './file-watcher.service';
import { ApiWatcherService } from './api-watcher.service';

@Injectable()
export class BotEngineService {
  private readonly logger = new Logger(BotEngineService.name);
  private isProcessing = false;

  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    private readonly shiftsService: ShiftsService,
    private readonly emailWatcherService: EmailWatcherService,
    private readonly fileWatcherService: FileWatcherService,
    private readonly apiWatcherService: ApiWatcherService,
  ) {}

  /**
   * Run every 1 minute to check active shift checklists.
   */
  @Cron('* * * * *', {
    name: 'automated-bot-checklist-runner',
    timeZone: 'Asia/Saigon',
  })
  async handleBotChecks() {
    if (this.isProcessing) {
      this.logger.warn('Bot check loop is already running. Skipping this tick.');
      return;
    }

    this.isProcessing = true;
    this.logger.debug('Starting automated checklist bot runner check...');

    try {
      // 1. Fetch active shift logs
      const activeLogs = await this.shiftLogModel
        .find({ status: 'PENDING' })
        .exec();

      if (activeLogs.length === 0) {
        return;
      }

      const systemUser = {
        id: '000000000000000000000000',
        fullName: 'Hệ thống tự động (Bot)',
        username: 'system_bot',
        role: 'ADMIN',
      };

      for (const log of activeLogs) {
        for (const task of log.details) {
          // Check only bot-driven tasks that are not yet resolved (PASSED, SKIPPED)
          const needsCheck = task.isBotCheckSnapshot && (task.status === 'PENDING' || task.status === 'WAITING');
          if (!needsCheck) {
            continue;
          }

          // 2. Enforce Dependency ordering (maker-checker sequential pipeline)
          if (task.dependsOnTaskIdsSnapshot && task.dependsOnTaskIdsSnapshot.length > 0) {
            const hasUnmetDeps = task.dependsOnTaskIdsSnapshot.some(depId => {
              const depTask = log.details.find(t => t.taskId === depId);
              return depTask && !depTask.isChecked;
            });
            if (hasUnmetDeps) {
              this.logger.debug(`[Bot] Task [${task.taskId}] has unmet dependencies. Skipping check.`);
              continue;
            }
          }

          // 3. Enforce Trigger Time
          const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000); // Vietnam time (GMT+7)
          if (task.botTriggerTimeSnapshot) {
            const [trigH, trigM] = task.botTriggerTimeSnapshot.split(':').map(Number);
            const currH = nowVN.getUTCHours();
            const currM = nowVN.getUTCMinutes();

            if (currH < trigH || (currH === trigH && currM < trigM)) {
              // Not yet time to run
              continue;
            }
          }

          // 4. Update task state to WAITING if it was PENDING
          if (task.status === 'PENDING') {
            this.logger.log(`[Bot] Transitioning Task [${task.taskId}] to WAITING state.`);
            await this.shiftsService.updateTaskStatus(
              log._id.toString(),
              task.taskId,
              'WAITING',
              systemUser,
              'Hệ thống đang bắt đầu quét kiểm tra tự động...'
            );
            // Refresh local task variable status
            task.status = 'WAITING';
          }

          // 5. Delegate the check to the corresponding handler
          let checkResult = { success: false, message: 'Loại kiểm tra không được hỗ trợ.' };

          const checkType = task.botCheckTypeSnapshot || 'EMAIL_PARSE';
          const target = task.botCheckTargetSnapshot || '';
          const condition = task.botSuccessConditionSnapshot || '';

          this.logger.debug(`[Bot] Checking Task [${task.taskId}] via ${checkType}. Target: "${target}"`);

          if (checkType === 'EMAIL_PARSE') {
            checkResult = await this.emailWatcherService.checkEmailTask(target, condition);
          } else if (checkType === 'FILE_EXISTS') {
            // Fallback to target if fileLocation is not set
            const filePath = task.fileLocationSnapshot || target;
            checkResult = await this.fileWatcherService.checkFileTask(filePath, condition);
          } else if (checkType === 'API_STATUS') {
            checkResult = await this.apiWatcherService.checkApiTask(target, condition);
          }

          // 6. Handle verification outcomes
          if (checkResult.success) {
            this.logger.log(`[Bot] Task [${task.taskId}] check PASSED: ${checkResult.message}`);
            await this.shiftsService.updateTaskStatus(
              log._id.toString(),
              task.taskId,
              'PASSED',
              systemUser,
              checkResult.message
            );
          } else {
            // Check for SLA deadline breach
            let isOverdue = false;
            if (task.slaDeadlineSnapshot) {
              if (task.slaDeadlineSnapshot.includes(':')) {
                const [slaH, slaM] = task.slaDeadlineSnapshot.split(':').map(Number);
                const currH = nowVN.getUTCHours();
                const currM = nowVN.getUTCMinutes();
                isOverdue = currH > slaH || (currH === slaH && currM >= slaM);
              } else {
                // Relative SLA (minutes from trigger time)
                const trigger = task.botTriggerTimeSnapshot || '00:00';
                const [trigH, trigM] = trigger.split(':').map(Number);
                const triggerDate = new Date(nowVN);
                triggerDate.setUTCHours(trigH, trigM, 0, 0);

                const durationMinutes = parseInt(task.slaDeadlineSnapshot, 10) || 15;
                const overdueTime = triggerDate.getTime() + durationMinutes * 60 * 1000;
                isOverdue = nowVN.getTime() >= overdueTime;
              }
            }

            if (isOverdue) {
              this.logger.warn(`[Bot] Task [${task.taskId}] failed and breached SLA. Transitioning to FAILED state.`);
              await this.shiftsService.updateTaskStatus(
                log._id.toString(),
                task.taskId,
                'FAILED',
                systemUser,
                `[BOT TRỄ SLA] Kiểm tra tự động thất bại: ${checkResult.message}`
              );
            } else {
              // Update status note with retry logs
              const formattedTime = nowVN.toISOString().replace('T', ' ').substring(0, 19);
              await this.shiftsService.updateTaskStatus(
                log._id.toString(),
                task.taskId,
                'WAITING',
                systemUser,
                `[Quét tự động lúc ${formattedTime}]: ${checkResult.message}`
              );
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error executing bot checklist loop: ${err.message}`, err.stack);
    } finally {
      this.isProcessing = false;
    }
  }
}
