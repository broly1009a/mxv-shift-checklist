import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotJobQueueService } from '../queue/bot-job-queue.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { ShiftLog } from '../../../schemas/shift-log.schema';
import {
  resolveTradingSessionDate,
  isMarketWeekendClosed,
  getAcmBackupBase,
} from '../../../shared/helpers/file-path.helper';

import {
  SchedulerTaskConfig,
  getRecommendedMarketCloseDownloadTime,
  seedBotSchedulerConfig,
} from '../helpers/scheduler-config-seeder.helper';

export type { SchedulerTaskConfig };
export { getRecommendedMarketCloseDownloadTime };

@Injectable()
export class AutonomousSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AutonomousSchedulerService.name);
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
    await seedBotSchedulerConfig(this.settingsService, this.logger);
  }

  /**
   * Autonomous Runner for Trading Manager: CHECK_KLGD
   * Chạy định kỳ độc lập 24/7 (mỗi 60p/30p/15p) không phụ thuộc vào trạng thái mở/đóng của ca trực.
   */
  @Cron('* * * * *', {
    name: 'autonomous-klgd-runner',
    timeZone: 'Asia/Saigon',
  })
  async handleAutonomousKlgdRun() {
    // 1. Kiểm tra Master Switch: bot_auto_recon_enabled
    const autoReconSetting = await this.settingsService.getSetting(
      'bot_auto_recon_enabled',
      'true',
    );
    if (autoReconSetting !== 'true') {
      return;
    }

    // 2. Kiểm tra cờ check định kỳ: bot_periodic_check_enabled
    const periodicEnabled = await this.settingsService.getSetting(
      'bot_periodic_check_enabled',
      'true',
    );
    if (periodicEnabled === 'false') {
      return;
    }

    // 3. Market Weekend Guard: Tạm dừng khi thị trường đóng cửa cuối tuần
    const sessionStartSetting = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    if (isMarketWeekendClosed(new Date(), { sessionStartStr: sessionStartSetting })) {
      return;
    }

    // 4. Kiểm tra tần suất (phút) - mặc định 60 phút
    const freqSetting = await this.settingsService.getSetting(
      'bot_periodic_check_frequency',
      '60',
    );
    const intervalMinutes = Math.max(5, parseInt(freqSetting, 10) || 60);

    // 5. Tránh xung đột: Nếu đang có Job PENDING hoặc PROCESSING của CHECK_KLGD thì bỏ qua
    const hasActiveJob = await this.jobQueueService.hasActiveJobByType('CHECK_KLGD');
    if (hasActiveJob) {
      return;
    }

    // 6. Kiểm tra thời điểm hoàn tất gần nhất
    const lastJob = await this.jobQueueService.getLatestCompletedJobByType('CHECK_KLGD');
    if (lastJob && lastJob.completedAt) {
      const elapsedMinutes = (Date.now() - new Date(lastJob.completedAt).getTime()) / 60000;
      if (elapsedMinutes < intervalMinutes) {
        return; // Chưa tới chu kỳ tiếp theo
      }
    }

    // 7. Xác định ngày phiên giao dịch hiện tại
    const resolvedSession = resolveTradingSessionDate(undefined, {
      sessionStartStr: sessionStartSetting,
    });
    const sessionDayStr = resolvedSession.dateStr;

    this.logger.log(
      `[Autonomous-KLGD] Kích hoạt chạy đối chiếu khớp lệnh độc lập Trading Manager (chu kỳ ${intervalMinutes}m, session: ${sessionDayStr}).`,
    );

    try {
      await this.jobQueueService.enqueue('CHECK_KLGD', {
        sessionDay: sessionDayStr,
        targetDate: sessionDayStr,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });
    } catch (err: any) {
      this.logger.error(
        `[Autonomous-KLGD] Lỗi enqueue Job CHECK_KLGD độc lập: ${err.message}`,
      );
    }
  }

  /**
   * Autonomous Runner for Trading Manager: Periodic File Audit (MS & CQG)
   * Chạy định kỳ độc lập 24/7 (mặc định 60p/lần) không phụ thuộc vào trạng thái mở/đóng của ca trực.
   */
  @Cron('* * * * *', {
    name: 'autonomous-backup-periodic-runner',
    timeZone: 'Asia/Saigon',
  })
  async handleAutonomousPeriodicBackupRun() {
    // 1. Kiểm tra Master Switch: bot_auto_backup_enabled
    const autoBackupSetting = await this.settingsService.getSetting(
      'bot_auto_backup_enabled',
      'true',
    );
    if (autoBackupSetting === 'false') {
      return;
    }

    // 2. Kiểm tra cờ backup định kỳ: bot_backup_periodic_enabled
    const periodicEnabled = await this.settingsService.getSetting(
      'bot_backup_periodic_enabled',
      'true',
    );
    if (periodicEnabled === 'false') {
      return;
    }

    // 3. Market Weekend Guard: Tạm dừng khi thị trường đóng cửa cuối tuần
    const sessionStartSetting = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    if (isMarketWeekendClosed(new Date(), { sessionStartStr: sessionStartSetting })) {
      return;
    }

    // 4. Kiểm tra tần suất (phút) - mặc định 60 phút
    const freqSetting = await this.settingsService.getSetting(
      'bot_backup_periodic_minutes',
      '60',
    );
    const intervalMinutes = Math.max(5, parseInt(freqSetting, 10) || 60);

    // 5. Tránh xung đột: Nếu đang có Job PENDING hoặc PROCESSING của FILE_AUDIT_MS, FILE_AUDIT_CQG, CoreCCP, CoreEX hoặc FILE_AUDIT_ACM thì bỏ qua
    const hasActiveMs = await this.jobQueueService.hasActiveJobByType('FILE_AUDIT_MS');
    const hasActiveCqg = await this.jobQueueService.hasActiveJobByType('FILE_AUDIT_CQG');
    const hasActiveCcp = await this.jobQueueService.hasActiveJobByType('DOWNLOAD_CCP_REPORT');
    const hasActiveCe = await this.jobQueueService.hasActiveJobByType('DOWNLOAD_CE_REPORT');
    const hasActiveAcm = await this.jobQueueService.hasActiveJobByType('FILE_AUDIT_ACM');
    if (hasActiveMs || hasActiveCqg || hasActiveCcp || hasActiveCe || hasActiveAcm) {
      return;
    }

    // 6. Kiểm tra thời điểm hoàn tất gần nhất của FILE_AUDIT_MS
    const lastMsJob = await this.jobQueueService.getLatestCompletedJobByType('FILE_AUDIT_MS');
    if (lastMsJob && lastMsJob.completedAt) {
      const elapsedMinutes = (Date.now() - new Date(lastMsJob.completedAt).getTime()) / 60000;
      if (elapsedMinutes < intervalMinutes) {
        return; // Chưa tới chu kỳ tiếp theo
      }
    }

    // 7. Xác định ngày phiên giao dịch hiện tại
    const resolvedSession = resolveTradingSessionDate(undefined, {
      sessionStartStr: sessionStartSetting,
    });
    const sessionDayStr = resolvedSession.dateStr;

    this.logger.log(
      `[Autonomous-Backup] Kích hoạt chạy audit file backup định kỳ độc lập Trading Manager (chu kỳ ${intervalMinutes}m, session: ${sessionDayStr}).`,
    );

    const backupPath = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      '',
    );

    try {
      await this.jobQueueService.enqueue('FILE_AUDIT_MS', {
        backupPath,
        targetDate: sessionDayStr,
        sessionDay: sessionDayStr,
        maxAttempts: 1,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });

      await this.jobQueueService.enqueue('FILE_AUDIT_CQG', {
        targetDate: sessionDayStr,
        sessionDay: sessionDayStr,
        maxAttempts: 1,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });

      // Tự động tải Full CoreCCP & CoreEX định kỳ độc lập tương tự MS & CQG
      await this.jobQueueService.enqueue('DOWNLOAD_CCP_REPORT', {
        startDate: sessionDayStr,
        endDate: sessionDayStr,
        sessionDay: sessionDayStr,
        targetDate: sessionDayStr,
        reports: ['FULL'],
        maxAttempts: 1,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });

      await this.jobQueueService.enqueue('DOWNLOAD_CE_REPORT', {
        startDate: sessionDayStr,
        endDate: sessionDayStr,
        sessionDay: sessionDayStr,
        targetDate: sessionDayStr,
        reports: ['FULL'],
        maxAttempts: 1,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });

      // Tự động kiểm tra và tải báo cáo ACM định kỳ độc lập
      const acmBackupBase = await getAcmBackupBase(this.settingsService);
      await this.jobQueueService.enqueue('FILE_AUDIT_ACM', {
        backupPath: acmBackupBase,
        targetDate: sessionDayStr,
        sessionDay: sessionDayStr,
        maxAttempts: 1,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });
    } catch (err: any) {
      this.logger.error(
        `[Autonomous-Backup] Lỗi enqueue Job FILE_AUDIT độc lập: ${err.message}`,
      );
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
    // Check Master Switch: bot_auto_backup_enabled
    const autoBackupSetting = await this.settingsService.getSetting(
      'bot_auto_backup_enabled',
      'true',
    );
    if (autoBackupSetting === 'false') {
      this.logger.debug(
        'Dynamic bot scheduler is paused by user switch (bot_auto_backup_enabled=false).',
      );
      return;
    }

    const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000); // Vietnam time (GMT+7)
    const todayStr = nowVN.toISOString().split('T')[0];
    const currentHourStr = String(nowVN.getUTCHours()).padStart(2, '0');
    const currentMinStr = String(nowVN.getUTCMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHourStr}:${currentMinStr}`;

    const configRaw = await this.settingsService.getSetting(
      'bot_scheduler_config',
      '[]',
    );
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

    const recommendedCloseTime = getRecommendedMarketCloseDownloadTime();
    // Đọc các cấu hình thời điểm vận hành động từ system_settings (Tab Backup & Thống kê)
    const [backupTime, backupTimeEnabled, statTime, statTimeEnabled] = await Promise.all([
      this.settingsService.getSetting('bot_backup_time', recommendedCloseTime),
      this.settingsService.getSetting('bot_backup_time_enabled', 'true'),
      this.settingsService.getSetting('bot_stat_time', '06:30'),
      this.settingsService.getSetting('bot_stat_time_enabled', 'true'),
    ]);

    // 1. Đồng bộ giờ backup động (RPA_DOWNLOAD_MS, DOWNLOAD_CQG_BACKUP, CoreCCP và CoreEX)
    if (backupTime && /^\d{2}:\d{2}$/.test(backupTime)) {
      const rpaTask = tasks.find((t) => t.id === 'RPA_DOWNLOAD_MS');
      if (rpaTask) {
        rpaTask.time = backupTime;
        rpaTask.enabled = backupTimeEnabled !== 'false';
      }
      const cqgTask = tasks.find((t) => t.id === 'DOWNLOAD_CQG_BACKUP');
      if (cqgTask) {
        cqgTask.time = backupTime;
        cqgTask.enabled = backupTimeEnabled !== 'false';
      }

      // Đồng bộ mốc giờ tải cho CoreCCP
      let ccpTask = tasks.find((t) => t.id === 'RPA_DOWNLOAD_CCP_PHASE1' || t.jobType === 'DOWNLOAD_CCP_REPORT');
      if (ccpTask) {
        ccpTask.time = backupTime;
        ccpTask.enabled = backupTimeEnabled !== 'false';
        ccpTask.payload = { ...(ccpTask.payload || {}), reports: ['FULL'] };
      } else {
        tasks.push({
          id: 'RPA_DOWNLOAD_CCP_PHASE1',
          name: 'Tự động tải Full báo cáo CoreCCP (VNCLEAR)',
          enabled: backupTimeEnabled !== 'false',
          time: backupTime,
          jobType: 'DOWNLOAD_CCP_REPORT',
          payload: { reports: ['FULL'] },
        });
      }

      // Đồng bộ mốc giờ tải cho CoreEX
      let ceTask = tasks.find((t) => t.id === 'RPA_DOWNLOAD_CE' || t.jobType === 'DOWNLOAD_CE_REPORT');
      if (ceTask) {
        ceTask.time = backupTime;
        ceTask.enabled = backupTimeEnabled !== 'false';
        ceTask.payload = { ...(ceTask.payload || {}), reports: ['FULL'] };
      } else {
        tasks.push({
          id: 'RPA_DOWNLOAD_CE',
          name: 'Tự động tải Full báo cáo CoreEX (Liên thông)',
          enabled: backupTimeEnabled !== 'false',
          time: backupTime,
          jobType: 'DOWNLOAD_CE_REPORT',
          payload: { reports: ['FULL'] },
        });
      }

      // Đồng bộ mốc giờ tải cho ACM
      let acmTask = tasks.find((t) => t.id === 'RPA_DOWNLOAD_ACM' || t.jobType === 'FILE_AUDIT_ACM');
      if (acmTask) {
        acmTask.time = backupTime;
        acmTask.enabled = backupTimeEnabled !== 'false';
      } else {
        tasks.push({
          id: 'RPA_DOWNLOAD_ACM',
          name: 'Tự động tải & kiểm tra file backup ACM (Web & SFTP)',
          enabled: backupTimeEnabled !== 'false',
          time: backupTime,
          jobType: 'FILE_AUDIT_ACM',
        });
      }
    }

    // 2. Đồng bộ giờ thống kê động (RUN_LOT_MACRO / RUN_VALUE_MACRO)
    if (statTime && /^\d{2}:\d{2}$/.test(statTime)) {
      let statTask = tasks.find((t) => t.id === 'AUTO_GENERATE_STATISTICS' || t.jobType === 'RUN_LOT_MACRO');
      if (statTask) {
        statTask.time = statTime;
        statTask.enabled = statTimeEnabled !== 'false';
      } else {
        tasks.push({
          id: 'AUTO_GENERATE_STATISTICS',
          name: 'Tự động tạo báo cáo thống kê số lot & GTGD',
          enabled: statTimeEnabled !== 'false',
          time: statTime,
          jobType: 'RUN_LOT_MACRO',
        });
      }
    }

    // Find active shift log to link tasks
    const activeShift = await this.shiftLogModel
      .findOne({ status: 'PENDING' })
      .exec();

    for (const task of tasks) {
      if (!task.enabled) continue;

      // Check if time matches
      if (task.time !== currentTimeStr) continue;

      // Check if already run today to prevent duplicates
      const lastRunDate = this.lastRunMap.get(task.id);
      if (lastRunDate === todayStr) continue;

      this.logger.log(
        `Scheduled task "${task.name}" (${task.id}) triggered at ${task.time}.`,
      );

      // Prepare payload and look for matching checklist task to link
      const sessionStartSetting = await this.settingsService.getSetting(
        'session_start_time',
        '05:00',
      );

      // Market Weekend Guard: Không kích hoạt các task sao lưu / báo cáo thị trường khi cuối tuần đóng cửa
      if (isMarketWeekendClosed(nowVN, { sessionStartStr: sessionStartSetting })) {
        this.logger.debug(
          `[Scheduler] Bỏ qua task "${task.name}" (${task.id}) lúc ${task.time} do thị trường đang đóng cửa cuối tuần.`,
        );
        continue;
      }

      const resolvedSession = resolveTradingSessionDate(undefined, {
        sessionStartStr: sessionStartSetting,
      });
      const sessionDayStr = resolvedSession.dateStr;

      const jobPayload: Record<string, any> = {
        ...(task.payload || {}),
        sessionDay: sessionDayStr,
        targetDate: sessionDayStr,
        startDate: sessionDayStr,
        endDate: sessionDayStr,
        isStandalone: !activeShift,
        shiftLogId: null,
        taskId: null,
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
          const matchedTask = activeShift.details.find(
            (t) => t.botCheckTypeSnapshot === checkTypeToFind && !t.isChecked,
          );
          if (matchedTask) {
            jobPayload.taskId = matchedTask.taskId;
            jobPayload.shiftLogId = activeShift._id.toString();
            jobPayload.isStandalone = false;
            this.logger.log(
              `Linked scheduled job ${task.jobType} to checklist task ${matchedTask.taskId} in shift ${activeShift._id}.`,
            );
          }
        }
      }

      try {
        await this.jobQueueService.enqueue(task.jobType, jobPayload);
        if (task.jobType === 'RUN_LOT_MACRO') {
          try {
            await this.jobQueueService.enqueue('RUN_VALUE_MACRO', { ...jobPayload });
            this.logger.log(`Also enqueued complementary job RUN_VALUE_MACRO.`);
          } catch (mErr: any) {
            this.logger.warn(`Complementary RUN_VALUE_MACRO failed: ${mErr.message}`);
          }
        }
        this.lastRunMap.set(task.id, todayStr);
        this.logger.log(`Enqueued job ${task.jobType} successfully.`);
      } catch (err: any) {
        this.logger.error(
          `Failed to enqueue job for scheduled task ${task.id}: ${err.message}`,
        );
      }
    }
  }
}
