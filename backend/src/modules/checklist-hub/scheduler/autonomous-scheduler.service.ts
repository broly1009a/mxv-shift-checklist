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
import { expandJobTypeAliases, isReconMasterSwitchJob } from '../../../shared';

import { SchedulerTaskConfig } from '../helpers/scheduler-config-seeder.helper';

export type { SchedulerTaskConfig };
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
    this.logger.log(
      'Dynamic Scheduler Service initialized (Auto-Seeding bot_scheduler_config is DISABLED for operational safety).',
    );
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
    const sessionStartSetting = await this.settingsService.getSetting('session_start_time');
    if (!sessionStartSetting) {
      this.logger.warn('[AutonomousScheduler] Chưa cấu hình session_start_time trong CSDL, tạm dừng chu kỳ.');
      return;
    }
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

    // 6. Kiểm tra thời điểm hoàn tất gần nhất (tính cả COMPLETED, WAITING, FAILED, CANCELLED)
    const lastJob = await this.jobQueueService.getLatestCompletedJobByType('CHECK_KLGD');
    if (lastJob) {
      const lastRunTime = lastJob.createdAt || lastJob.updatedAt || lastJob.completedAt;
      if (lastRunTime) {
        const elapsedMinutes = (Date.now() - new Date(lastRunTime).getTime()) / 60000;
        if (elapsedMinutes < intervalMinutes - 0.5) {
          return; // Chưa tới chu kỳ tiếp theo
        }
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
    const sessionStartSetting = await this.settingsService.getSetting('session_start_time');
    if (!sessionStartSetting) {
      this.logger.warn('[AutonomousScheduler] Chưa cấu hình session_start_time trong CSDL, tạm dừng chu kỳ backup.');
      return;
    }
    if (isMarketWeekendClosed(new Date(), { sessionStartStr: sessionStartSetting })) {
      return;
    }

    // 4. Kiểm tra tần suất (phút) - mặc định 60 phút
    const freqSetting = await this.settingsService.getSetting(
      'bot_backup_periodic_minutes',
      '60',
    );
    const intervalMinutes = Math.max(5, parseInt(freqSetting, 10) || 60);

    // 5. Tránh xung đột: Nếu đang có Job PENDING hoặc PROCESSING của MS, CQG, CoreCCP, CoreEX hoặc ACM thì bỏ qua
    const hasActiveMs =
      (await this.jobQueueService.hasActiveJobByType('RPA_DOWNLOAD_REPORTS')) ||
      (await this.jobQueueService.hasActiveJobByType('FILE_AUDIT_MS'));
    const hasActiveCqg =
      (await this.jobQueueService.hasActiveJobByType('DOWNLOAD_CQG_BACKUP')) ||
      (await this.jobQueueService.hasActiveJobByType('FILE_AUDIT_CQG'));
    const hasActiveCcp = await this.jobQueueService.hasActiveJobByType('DOWNLOAD_CCP_REPORT');
    const hasActiveCe = await this.jobQueueService.hasActiveJobByType('DOWNLOAD_CE_REPORT');
    const hasActiveAcm = await this.jobQueueService.hasActiveJobByType('FILE_AUDIT_ACM');
    if (hasActiveMs || hasActiveCqg || hasActiveCcp || hasActiveCe || hasActiveAcm) {
      return;
    }

    // 6. Kiểm tra thời điểm hoàn tất gần nhất của toàn bộ tiến trình backup (MS, CQG, CCP, CE, ACM)
    const backupJobs = await Promise.all([
      this.jobQueueService.getLatestCompletedJobByType('RPA_DOWNLOAD_REPORTS'),
      this.jobQueueService.getLatestCompletedJobByType('DOWNLOAD_CQG_BACKUP'),
      this.jobQueueService.getLatestCompletedJobByType('FILE_AUDIT_MS'),
      this.jobQueueService.getLatestCompletedJobByType('DOWNLOAD_CCP_REPORT'),
      this.jobQueueService.getLatestCompletedJobByType('DOWNLOAD_CE_REPORT'),
      this.jobQueueService.getLatestCompletedJobByType('FILE_AUDIT_ACM'),
    ]);

    const latestTimestamp = backupJobs.reduce((max, j) => {
      if (!j) return max;
      const t = new Date(j.completedAt || j.updatedAt || j.createdAt).getTime();
      return t > max ? t : max;
    }, 0);

    if (latestTimestamp > 0) {
      const elapsedMinutes = (Date.now() - latestTimestamp) / 60000;
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
      `[Autonomous-Backup] Kích hoạt tải file backup định kỳ độc lập Trading Manager (chu kỳ ${intervalMinutes}m, session: ${sessionDayStr}).`,
    );

    // Xác định danh sách target báo cáo M-System từ cấu hình hệ thống (bot_scheduler_config) hoặc danh mục chuẩn
    let msTargets = [
      'NKTTHT',
      'DSTKGD-Futures',
      'DSTKGD-Spread',
      'DSTKGD-LME',
      'DSTKGD-ACM',
      'QLTKGD',
      'NR',
      'DSGD',
      'TTTT',
    ];
    try {
      const configRaw = await this.settingsService.getSetting('bot_scheduler_config', '[]');
      const tasks: SchedulerTaskConfig[] = JSON.parse(configRaw);
      const msTask = tasks.find((t) => t.id === 'RPA_DOWNLOAD_MS' || t.jobType === 'RPA_DOWNLOAD_REPORTS');
      if (msTask?.payload?.targets && Array.isArray(msTask.payload.targets) && msTask.payload.targets.length > 0) {
        msTargets = msTask.payload.targets;
      }
    } catch {
      // Giữ default core targets
    }

    try {
      // 1. M-System: Tải báo cáo trực tiếp từ sàn qua RPA_DOWNLOAD_REPORTS
      await this.jobQueueService.enqueue('DOWNLOAD_MS', {
        targets: msTargets,
        targetDate: sessionDayStr,
        sessionDay: sessionDayStr,
        maxAttempts: 1,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });

      // 2. CQG: Tải báo cáo thô từ web và tự động ghép nối qua DOWNLOAD_CQG_BACKUP
      await this.jobQueueService.enqueue('DOWNLOAD_CQG', {
        targetDate: sessionDayStr,
        sessionDay: sessionDayStr,
        reports: {
          FR1: true,
          PS1: true,
          OP1: true,
          OD1: true,
          FR2: true,
          PS2: true,
          OP2: true,
          OD2: true,
          AS: true,
        },
        maxAttempts: 1,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });

      // 3. CoreCCP: Tự động tải Full CoreCCP
      await this.jobQueueService.enqueue('DOWNLOAD_CCP', {
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

      // 4. CoreEX: Tự động tải Full CoreEX
      await this.jobQueueService.enqueue('DOWNLOAD_CE', {
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

      // 5. ACM: Tự động tải báo cáo ACM (Web ETP & SFTP Straits) với cờ forceDownload: true
      const acmBackupBase = await getAcmBackupBase(this.settingsService);
      await this.jobQueueService.enqueue('FILE_AUDIT_ACM', {
        backupPath: acmBackupBase,
        targetDate: sessionDayStr,
        sessionDay: sessionDayStr,
        forceDownload: true,
        maxAttempts: 1,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });
    } catch (err: any) {
      this.logger.error(
        `[Autonomous-Backup] Lỗi enqueue Job tải backup định kỳ: ${err.message}`,
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
    // Check Master Switches:
    // - bot_auto_backup_enabled: kiểm soát tải backup & chạy thống kê
    // - bot_auto_recon_enabled: kiểm soát các tác vụ đối chiếu (CHECK_CQG_SYNC, CHECK_DSGD_BEFORE_EOD, CHECK_EOD_MS, ...)
    const [autoBackupSetting, autoReconSetting] = await Promise.all([
      this.settingsService.getSetting('bot_auto_backup_enabled', 'true'),
      this.settingsService.getSetting('bot_auto_recon_enabled', 'true'),
    ]);

    if (autoBackupSetting === 'false' && autoReconSetting === 'false') {
      this.logger.debug(
        'Dynamic bot scheduler is paused by user switches (bot_auto_backup_enabled=false & bot_auto_recon_enabled=false).',
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

    // Đọc các cấu hình thời điểm vận hành động từ system_settings (Tab Backup & Thống kê)
    const [backupTime, backupTimeEnabled, statTime, statTimeEnabled] = await Promise.all([
      this.settingsService.getSetting('bot_backup_time'),
      this.settingsService.getSetting('bot_backup_time_enabled', 'true'),
      this.settingsService.getSetting('bot_stat_time'),
      this.settingsService.getSetting('bot_stat_time_enabled', 'true'),
    ]);

    if (!backupTime) {
      this.logger.warn(
        '[AutonomousScheduler] Chưa cấu hình bot_backup_time trong CSDL SystemSettings. Vui lòng thiết lập mốc giờ sao lưu trên giao diện Quản trị.',
      );
    }
    if (!statTime) {
      this.logger.warn(
        '[AutonomousScheduler] Chưa cấu hình bot_stat_time trong CSDL SystemSettings. Vui lòng thiết lập mốc giờ chạy thống kê trên giao diện Quản trị.',
      );
    }

    // 1. Đồng bộ giờ backup động cho các tác vụ backup ĐANG CÓ TRONG CSDL (KHÔNG tự động seed thêm tác vụ nếu chưa được cấu hình)
    if (backupTime && /^\d{2}:\d{2}$/.test(backupTime)) {
      const rpaTask = tasks.find((t) => t.id === 'RPA_DOWNLOAD_MS' || t.jobType === 'DOWNLOAD_MS' || t.jobType === 'RPA_DOWNLOAD_REPORTS');
      if (rpaTask) {
        rpaTask.time = backupTime;
        if (backupTimeEnabled === 'false') rpaTask.enabled = false;
      }
      const cqgTask = tasks.find((t) => t.id === 'DOWNLOAD_CQG_BACKUP' || t.jobType === 'DOWNLOAD_CQG' || t.jobType === 'DOWNLOAD_CQG_BACKUP');
      if (cqgTask) {
        cqgTask.time = backupTime;
        if (backupTimeEnabled === 'false') cqgTask.enabled = false;
      }

      const ccpTask = tasks.find((t) => t.id === 'RPA_DOWNLOAD_CCP_PHASE1' || t.jobType === 'DOWNLOAD_CCP' || t.jobType === 'DOWNLOAD_CCP_REPORT');
      if (ccpTask) {
        ccpTask.time = backupTime;
        if (backupTimeEnabled === 'false') ccpTask.enabled = false;
        ccpTask.payload = { ...(ccpTask.payload || {}), reports: ['FULL'] };
      }

      const ceTask = tasks.find((t) => t.id === 'RPA_DOWNLOAD_CE' || t.jobType === 'DOWNLOAD_CE' || t.jobType === 'DOWNLOAD_CE_REPORT');
      if (ceTask) {
        ceTask.time = backupTime;
        if (backupTimeEnabled === 'false') ceTask.enabled = false;
        ceTask.payload = { ...(ceTask.payload || {}), reports: ['FULL'] };
      }

      const acmTask = tasks.find((t) => t.id === 'RPA_DOWNLOAD_ACM' || t.jobType === 'DOWNLOAD_ACM' || t.jobType === 'FILE_AUDIT_ACM');
      if (acmTask) {
        acmTask.time = backupTime;
        if (backupTimeEnabled === 'false') acmTask.enabled = false;
      }
    }

    // 2. Đồng bộ giờ thống kê động cho tác vụ thống kê ĐANG CÓ TRONG CSDL (KHÔNG tự động seed thêm)
    if (statTime && /^\d{2}:\d{2}$/.test(statTime)) {
      const statTasks = tasks.filter((t) => t.id === 'AUTO_GENERATE_STATISTICS' || t.jobType === 'RUN_LOT_MACRO' || t.jobType === 'RUN_VALUE_MACRO' || t.jobType === 'RUN_MACRO_CE');
      for (const statTask of statTasks) {
        statTask.time = statTime;
        if (statTimeEnabled === 'false') statTask.enabled = false;
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

      // Enforce per-capability master switch (Auto Recon vs Auto Backup/Statistics)
      const isReconTask = isReconMasterSwitchJob(task.jobType);
      if (isReconTask && autoReconSetting === 'false') {
        this.logger.debug(
          `Scheduled reconciliation task "${task.name}" (${task.jobType}) skipped because bot_auto_recon_enabled=false.`,
        );
        continue;
      }
      if (!isReconTask && autoBackupSetting === 'false') {
        this.logger.debug(
          `Scheduled backup/statistics task "${task.name}" (${task.jobType}) skipped because bot_auto_backup_enabled=false.`,
        );
        continue;
      }

      this.logger.log(
        `Scheduled task "${task.name}" (${task.id}) triggered at ${task.time}.`,
      );

      // Prepare payload and look for matching checklist task to link
      const sessionStartSetting = await this.settingsService.getSetting('session_start_time');
      if (!sessionStartSetting) {
        this.logger.warn(
          `[Scheduler] Bỏ qua task "${task.name}" (${task.id}) lúc ${task.time} do chưa cấu hình session_start_time trong CSDL.`,
        );
        continue;
      }

      // Market Weekend Guard: Không kích hoạt các task sao lưu / báo cáo thị trường khi cuối tuần đóng cửa
      if (isMarketWeekendClosed(new Date(), { sessionStartStr: sessionStartSetting })) {
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
        // Map scheduler task id/jobType to botCheckTypeSnapshot using expandJobTypeAliases
        const candidateTypes = expandJobTypeAliases([task.jobType]);
        const matchedTask = activeShift.details.find(
          (t) => candidateTypes.includes(t.botCheckTypeSnapshot || '') && !t.isChecked,
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
