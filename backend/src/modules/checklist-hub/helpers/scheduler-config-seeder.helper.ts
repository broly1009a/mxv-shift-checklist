import { Logger } from '@nestjs/common';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

export interface SchedulerTaskConfig {
  id: string;
  name: string;
  enabled: boolean;
  time: string; // "HH:MM" format
  jobType: string;
  payload?: Record<string, any>;
}

export interface LoggerLike {
  log: (message: any, ...optionalParams: any[]) => void;
  error: (message: any, ...optionalParams: any[]) => void;
  warn?: (message: any, ...optionalParams: any[]) => void;
  debug?: (message: any, ...optionalParams: any[]) => void;
}

/**
 * Seed và đồng bộ cấu hình mặc định cho Bot Scheduler (Trading Manager & Checklist Hub)
 * Tuân thủ quy chuẩn Zero-Hardcoding (AGENTS.md Rule 7) & Fail-Fast (Rule 4):
 * - Giờ chạy tác vụ đọc 100% động từ CSDL SystemSettings (bot_backup_time, bot_stat_time...).
 * - Tuyệt đối không phỏng đoán hay hardcode các giá trị fallback giờ ('04:00', '05:00', '06:30'...).
 * - Nếu CSDL chưa cấu hình giờ, để trống và cảnh báo để Quản trị viên thiết lập trên giao diện Web.
 * - Bảo tồn 100% cấu hình người dùng đã thiết lập, chỉ bổ sung các tác vụ hoặc tham số còn thiếu.
 */
export async function seedBotSchedulerConfig(
  settingsService: SystemSettingsService,
  logger?: LoggerLike,
): Promise<void> {
  const backupTime = (await settingsService.getSetting('bot_backup_time')).trim();
  const statTime = (await settingsService.getSetting('bot_stat_time')).trim();
  const existing = await settingsService.getSetting('bot_scheduler_config', '');

  if (!existing) {
    if (!backupTime) {
      logger?.warn(
        '[SchedulerConfigSeeder] Chưa cấu hình bot_backup_time trong CSDL SystemSettings. Các tác vụ sao lưu cần được người dùng cấu hình mốc giờ trên giao diện Quản trị.',
      );
    }
    if (!statTime) {
      logger?.warn(
        '[SchedulerConfigSeeder] Chưa cấu hình bot_stat_time trong CSDL SystemSettings. Tác vụ thống kê cần được người dùng cấu hình mốc giờ trên giao diện Quản trị.',
      );
    }

    const defaults: SchedulerTaskConfig[] = [
      {
        id: 'RPA_DOWNLOAD_MS',
        name: 'Tải báo cáo đối chiếu đầu ngày M-System',
        enabled: true,
        time: backupTime,
        jobType: 'RPA_DOWNLOAD_REPORTS',
        payload: {
          targets: [
            'NKTTHT',
            'DSTKGD-Futures',
            'DSTKGD-Spread',
            'DSTKGD-LME',
            'DSTKGD-ACM',
            'QLTKGD',
            'NR',
            'DSGD',
            'TTTT',
          ],
        },
      },
      {
        id: 'DOWNLOAD_CQG_BACKUP',
        name: 'Tải file sao lưu CQG (Orders, Positions, Trades)',
        enabled: true,
        time: backupTime,
        jobType: 'DOWNLOAD_CQG_BACKUP',
      },
      {
        id: 'AUTO_GENERATE_STATISTICS',
        name: 'Tự động tạo báo cáo thống kê số lot & GTGD',
        enabled: true,
        time: statTime,
        jobType: 'RUN_LOT_MACRO',
      },
      {
        id: 'DOWNLOAD_CAST',
        name: 'Tải báo cáo CQG CAST Balances',
        enabled: true,
        time: '',
        jobType: 'DOWNLOAD_CAST',
      },
      {
        id: 'AUTO_CHECK_SOD',
        name: 'Đối chiếu số dư đầu ngày (SOD)',
        enabled: true,
        time: '',
        jobType: 'AUTO_CHECK_SOD',
      },
      {
        id: 'RPA_DOWNLOAD_CCP_PHASE1',
        name: 'Tự động tải Full báo cáo CoreCCP (VNCLEAR)',
        enabled: true,
        time: backupTime,
        jobType: 'DOWNLOAD_CCP_REPORT',
        payload: { reports: ['FULL'] },
      },
      {
        id: 'CHECK_DSGD_BEFORE_EOD',
        name: 'Đối chiếu DSGD trước EOD',
        enabled: false,
        time: '',
        jobType: 'CHECK_DSGD_BEFORE_EOD',
      },
      {
        id: 'CHECK_EOD_MS',
        name: 'Đối chiếu số liệu EOD & Market Maker (checkEOD, checkMM)',
        enabled: false,
        time: '',
        jobType: 'CHECK_EOD_MS',
      },
      {
        id: 'RPA_DOWNLOAD_CE',
        name: 'Tự động tải Full báo cáo CoreEX (Liên thông)',
        enabled: true,
        time: backupTime,
        jobType: 'DOWNLOAD_CE_REPORT',
        payload: { reports: ['FULL'] },
      },
      {
        id: 'RPA_DOWNLOAD_ACM',
        name: 'Tự động tải & kiểm tra file backup ACM (Web & SFTP)',
        enabled: true,
        time: backupTime,
        jobType: 'FILE_AUDIT_ACM',
      },
    ];
    await settingsService.setSetting('bot_scheduler_config', JSON.stringify(defaults, null, 2));
    logger?.log('Seeded default bot scheduler configurations.');
  } else {
    try {
      const tasks: SchedulerTaskConfig[] = JSON.parse(existing);
      let updated = false;

      if (Array.isArray(tasks)) {
        const rpaTaskIdx = tasks.findIndex((t) => t.id === 'RPA_DOWNLOAD_MS');
        if (rpaTaskIdx === -1) {
          tasks.push({
            id: 'RPA_DOWNLOAD_MS',
            name: 'Tải báo cáo đối chiếu đầu ngày M-System',
            enabled: true,
            time: backupTime,
            jobType: 'RPA_DOWNLOAD_REPORTS',
            payload: {
              targets: [
                'NKTTHT',
                'DSTKGD-Futures',
                'DSTKGD-Spread',
                'DSTKGD-LME',
                'DSTKGD-ACM',
                'QLTKGD',
                'NR',
                'DSGD',
                'TTTT',
              ],
            },
          });
          updated = true;
        } else {
          const rpaTask = tasks[rpaTaskIdx];
          // BẢO TỒN CẤU HÌNH NGƯỜI DÙNG: Không ghi đè giờ tải nếu đã có cấu hình
          if (!rpaTask.time && backupTime) {
            rpaTask.time = backupTime;
            updated = true;
          }
          if (!rpaTask.payload) {
            rpaTask.payload = { targets: [] };
          }
          if (!rpaTask.payload.targets) {
            rpaTask.payload.targets = [];
          }
          const expectedTargets = [
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
          for (const tgt of expectedTargets) {
            if (!rpaTask.payload.targets.includes(tgt)) {
              rpaTask.payload.targets.push(tgt);
              updated = true;
            }
          }
        }

        const existingCqg = tasks.find((t) => t.id === 'DOWNLOAD_CQG_BACKUP');
        if (!existingCqg) {
          tasks.push({
            id: 'DOWNLOAD_CQG_BACKUP',
            name: 'Tải file sao lưu CQG (Orders, Positions, Trades)',
            enabled: true,
            time: backupTime,
            jobType: 'DOWNLOAD_CQG_BACKUP',
          });
          updated = true;
        } else if (!existingCqg.time && backupTime) {
          existingCqg.time = backupTime;
          updated = true;
        }

        const existingStat = tasks.find((t) => t.id === 'AUTO_GENERATE_STATISTICS');
        if (!existingStat) {
          tasks.push({
            id: 'AUTO_GENERATE_STATISTICS',
            name: 'Tự động tạo báo cáo thống kê số lot & GTGD',
            enabled: true,
            time: statTime,
            jobType: 'RUN_LOT_MACRO',
          });
          updated = true;
        } else if (!existingStat.time && statTime) {
          existingStat.time = statTime;
          updated = true;
        }

        if (!tasks.some((t) => t.id === 'DOWNLOAD_CAST')) {
          tasks.push({
            id: 'DOWNLOAD_CAST',
            name: 'Tải báo cáo CQG CAST Balances',
            enabled: true,
            time: '',
            jobType: 'DOWNLOAD_CAST',
          });
          updated = true;
        }

        if (!tasks.some((t) => t.id === 'AUTO_CHECK_SOD')) {
          tasks.push({
            id: 'AUTO_CHECK_SOD',
            name: 'Đối chiếu số dư đầu ngày (SOD)',
            enabled: true,
            time: '',
            jobType: 'AUTO_CHECK_SOD',
          });
          updated = true;
        }

        if (!tasks.some((t) => t.id === 'RPA_DOWNLOAD_CCP_PHASE1')) {
          tasks.push({
            id: 'RPA_DOWNLOAD_CCP_PHASE1',
            name: 'Tải báo cáo CoreCCP Phase 1 (NR, TTTT, DSL, DSGD)',
            enabled: true,
            time: backupTime,
            jobType: 'DOWNLOAD_CCP_REPORT',
          });
          updated = true;
        }

        if (!tasks.some((t) => t.id === 'CHECK_DSGD_BEFORE_EOD')) {
          tasks.push({
            id: 'CHECK_DSGD_BEFORE_EOD',
            name: 'Kiểm tra tiền EOD (Dsgd-Before-EOD Check)',
            enabled: false,
            time: '',
            jobType: 'CHECK_DSGD_BEFORE_EOD',
          });
          updated = true;
        }

        if (!tasks.some((t) => t.id === 'CHECK_EOD_MS')) {
          tasks.push({
            id: 'CHECK_EOD_MS',
            name: 'Đối chiếu số liệu EOD & Market Maker (checkEOD, checkMM)',
            enabled: false,
            time: '',
            jobType: 'CHECK_EOD_MS',
          });
          updated = true;
        }

        if (!tasks.some((t) => t.id === 'RPA_DOWNLOAD_CE')) {
          tasks.push({
            id: 'RPA_DOWNLOAD_CE',
            name: 'Tải báo cáo CoreEX (VNCLEAR)',
            enabled: false,
            time: backupTime,
            jobType: 'DOWNLOAD_CE_REPORT',
          });
          updated = true;
        }

        if (!tasks.some((t) => t.id === 'RPA_DOWNLOAD_ACM' || t.jobType === 'FILE_AUDIT_ACM')) {
          tasks.push({
            id: 'RPA_DOWNLOAD_ACM',
            name: 'Tự động tải & kiểm tra file backup ACM (Web & SFTP)',
            enabled: true,
            time: backupTime,
            jobType: 'FILE_AUDIT_ACM',
          });
          updated = true;
        }

        if (updated) {
          await settingsService.setSetting('bot_scheduler_config', JSON.stringify(tasks, null, 2));
          logger?.log('Appended missing tasks/updates to existing scheduler configurations.');
        }
      }
    } catch (err) {
      logger?.error('Failed to parse existing bot_scheduler_config for seeding update:', err);
    }
  }
}
