import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotJobQueueService } from './bot-job-queue.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { ShiftLog } from '../../schemas/shift-log.schema';

interface SchedulerTaskConfig {
  id: string;
  name: string;
  enabled: boolean;
  time: string; // "HH:MM" format
  jobType: string;
  payload?: Record<string, any>;
}

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private lastRunMap = new Map<string, string>(); // Keep track of last run date for each task (e.g. task_id -> "YYYY-MM-DD")

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly jobQueueService: BotJobQueueService,
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
  ) {}

  async onModuleInit() {
    this.logger.log('Dynamic Scheduler Service initialized.');
    // Seed default scheduler config if not present
    await this.seedDefaultConfig();
  }

  private async seedDefaultConfig() {
    const existing = await this.settingsService.getSetting('bot_scheduler_config', '');
    if (!existing) {
      const defaults: SchedulerTaskConfig[] = [
        {
          id: 'DOWNLOAD_CAST',
          name: 'Tải báo cáo CQG CAST Balances',
          enabled: true,
          time: '07:00',
          jobType: 'DOWNLOAD_CAST',
        },
        {
          id: 'AUTO_CHECK_SOD',
          name: 'Đối chiếu số dư đầu ngày (SOD)',
          enabled: true,
          time: '07:05',
          jobType: 'AUTO_CHECK_SOD',
        },
        {
          id: 'RPA_DOWNLOAD_MS',
          name: 'Tải báo cáo đối chiếu đầu ngày M-System',
          enabled: true,
          time: '04:30',
          jobType: 'RPA_DOWNLOAD_REPORTS',
          payload: {
            targets: ['NKTTHT', 'DSTKGD-Futures', 'DSTKGD-Spread', 'DSTKGD-LME', 'DSTKGD-ACM', 'QLTKGD', 'NR', 'DSGD', 'TTTT']
          }
        },
        {
          id: 'CHECK_PRE_EOD',
          name: 'Kiểm tra tiền EOD (Pre-EOD Check)',
          enabled: false,
          time: '16:30',
          jobType: 'CHECK_PRE_EOD',
        },
        {
          id: 'CHECK_EOD_MM',
          name: 'Đối chiếu số liệu EOD & Market Maker (checkEOD, checkMM)',
          enabled: false,
          time: '18:00',
          jobType: 'CHECK_EOD_MM',
        }
      ];
      await this.settingsService.setSetting('bot_scheduler_config', JSON.stringify(defaults, null, 2));
      this.logger.log('Seeded default bot scheduler configurations.');
    } else {
      try {
        const tasks: SchedulerTaskConfig[] = JSON.parse(existing);
        let updated = false;

        if (Array.isArray(tasks)) {
          const rpaTaskIdx = tasks.findIndex(t => t.id === 'RPA_DOWNLOAD_MS');
          if (rpaTaskIdx === -1) {
            tasks.push({
              id: 'RPA_DOWNLOAD_MS',
              name: 'Tải báo cáo đối chiếu đầu ngày M-System',
              enabled: true,
              time: '04:30',
              jobType: 'RPA_DOWNLOAD_REPORTS',
              payload: {
                targets: ['NKTTHT', 'DSTKGD-Futures', 'DSTKGD-Spread', 'DSTKGD-LME', 'DSTKGD-ACM', 'QLTKGD', 'NR', 'DSGD', 'TTTT']
              }
            });
            updated = true;
          } else {
            const rpaTask = tasks[rpaTaskIdx];
            if (rpaTask.time !== '04:30') {
              rpaTask.time = '04:30';
              updated = true;
            }
            if (!rpaTask.payload) {
              rpaTask.payload = { targets: [] };
            }
            if (!rpaTask.payload.targets) {
              rpaTask.payload.targets = [];
            }
            const expectedTargets = ['NKTTHT', 'DSTKGD-Futures', 'DSTKGD-Spread', 'DSTKGD-LME', 'DSTKGD-ACM', 'QLTKGD', 'NR', 'DSGD', 'TTTT'];
            for (const tgt of expectedTargets) {
              if (!rpaTask.payload.targets.includes(tgt)) {
                rpaTask.payload.targets.push(tgt);
                updated = true;
              }
            }
          }

          if (!tasks.some(t => t.id === 'CHECK_PRE_EOD')) {
            tasks.push({
              id: 'CHECK_PRE_EOD',
              name: 'Kiểm tra tiền EOD (Pre-EOD Check)',
              enabled: false,
              time: '16:30',
              jobType: 'CHECK_PRE_EOD',
            });
            updated = true;
          }
          if (!tasks.some(t => t.id === 'CHECK_EOD_MM')) {
            tasks.push({
              id: 'CHECK_EOD_MM',
              name: 'Đối chiếu số liệu EOD & Market Maker (checkEOD, checkMM)',
              enabled: false,
              time: '18:00',
              jobType: 'CHECK_EOD_MM',
            });
            updated = true;
          }

          if (updated) {
            await this.settingsService.setSetting('bot_scheduler_config', JSON.stringify(tasks, null, 2));
            this.logger.log('Appended missing tasks/updates to existing scheduler configurations.');
          }
        }
      } catch (err) {
        this.logger.error('Failed to parse existing bot_scheduler_config for seeding update:', err);
      }
    }
  }

  /**
   * Run every 1 minute to check and trigger scheduled tasks.
   */
  @Cron('* * * * *', {
    name: 'dynamic-bot-scheduler',
    timeZone: 'Asia/Saigon',
  })
  async checkSchedule() {
    const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000); // Vietnam time (GMT+7)
    const todayStr = nowVN.toISOString().split('T')[0];
    const currentHourStr = String(nowVN.getUTCHours()).padStart(2, '0');
    const currentMinStr = String(nowVN.getUTCMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHourStr}:${currentMinStr}`;

    const configRaw = await this.settingsService.getSetting('bot_scheduler_config', '[]');
    let tasks: SchedulerTaskConfig[] = [];
    try {
      tasks = JSON.parse(configRaw);
    } catch (err) {
      this.logger.error('Failed to parse bot_scheduler_config from DB:', err);
      return;
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return;
    }

    // Find active shift log to link tasks
    const activeShift = await this.shiftLogModel.findOne({ status: 'PENDING' }).exec();

    for (const task of tasks) {
      if (!task.enabled) continue;

      // Check if time matches
      if (task.time !== currentTimeStr) continue;

      // Check if already run today to prevent duplicates
      const lastRunDate = this.lastRunMap.get(task.id);
      if (lastRunDate === todayStr) continue;

      this.logger.log(`Scheduled task "${task.name}" (${task.id}) triggered at ${task.time}.`);

      // Prepare payload and look for matching checklist task to link
      const jobPayload: Record<string, any> = {
        ...(task.payload || {}),
        sessionDay: todayStr,
      };

      if (activeShift) {
        // Map scheduler task id/jobType to botCheckTypeSnapshot
        let checkTypeToFind = '';
        if (task.jobType === 'DOWNLOAD_CAST') {
          checkTypeToFind = 'RPA_DOWNLOAD_CAST';
        } else if (task.jobType === 'AUTO_CHECK_SOD') {
          checkTypeToFind = 'AUTO_CHECK_SOD';
        } else if (task.jobType === 'RPA_DOWNLOAD_REPORTS') {
          checkTypeToFind = 'RPA_DOWNLOAD';
        } else {
          checkTypeToFind = task.jobType;
        }

        if (checkTypeToFind) {
          const matchedTask = activeShift.details.find(t => t.botCheckTypeSnapshot === checkTypeToFind && !t.isChecked);
          if (matchedTask) {
            jobPayload.taskId = matchedTask.taskId;
            jobPayload.shiftLogId = activeShift._id.toString();
            this.logger.log(`Linked scheduled job ${task.jobType} to checklist task ${matchedTask.taskId} in shift ${activeShift._id}.`);
          }
        }
      }

      try {
        await this.jobQueueService.enqueue(task.jobType, jobPayload);
        this.lastRunMap.set(task.id, todayStr);
        this.logger.log(`Enqueued job ${task.jobType} successfully.`);
      } catch (err: any) {
        this.logger.error(`Failed to enqueue job for scheduled task ${task.id}: ${err.message}`);
      }
    }
  }
}
