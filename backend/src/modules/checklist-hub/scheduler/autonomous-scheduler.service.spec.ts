import {
  BOT_TASK_REGISTRY,
  isReconMasterSwitchJob,
} from '../../../shared';
import { AutonomousSchedulerService } from './autonomous-scheduler.service';

describe('AutonomousSchedulerService Master Switch Separation (bot_auto_recon_enabled vs bot_auto_backup_enabled)', () => {
  const fixedWeekdayUtc = new Date('2026-11-12T00:05:00.000Z'); // Thứ Năm 07:05:00 GMT+7

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedWeekdayUtc);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('phân loại chính xác 100% capability từ BOT_TASK_REGISTRY & alias hai chiều', () => {
    for (const def of Object.values(BOT_TASK_REGISTRY)) {
      if (
        def.category === 'RECONCILIATION' ||
        def.category === 'SESSION_OPEN' ||
        def.category === 'POST_EOD'
      ) {
        expect(isReconMasterSwitchJob(def.jobType)).toBe(true);
      } else if (def.category === 'STATISTICS' || def.category === 'INGRESS') {
        expect(isReconMasterSwitchJob(def.jobType)).toBe(false);
      }
    }

    // Kiểm tra các biến thể canonical + legacy của đối chiếu vs backup/thống kê
    expect(isReconMasterSwitchJob('CHECK_CQG_SYNC')).toBe(true);
    expect(isReconMasterSwitchJob('CQG_SYNC')).toBe(true);
    expect(isReconMasterSwitchJob('AUTO_CHECK_SOD')).toBe(true);
    expect(isReconMasterSwitchJob('CHECK_SOD')).toBe(true);
    expect(isReconMasterSwitchJob('CHECK_KLGD')).toBe(true);
    expect(isReconMasterSwitchJob('CHECK_DSGD_BEFORE_EOD')).toBe(true);
    expect(isReconMasterSwitchJob('CHECK_EOD_MS')).toBe(true);
    expect(isReconMasterSwitchJob('CHECK_EOD_CCP')).toBe(true);
    expect(isReconMasterSwitchJob('SCAN_NEGATIVE_MARGIN')).toBe(true);
    expect(isReconMasterSwitchJob('VERIFY_EMAIL_STATUS')).toBe(true);
    expect(isReconMasterSwitchJob('EMAIL_STATUS_CHECK')).toBe(true);

    expect(isReconMasterSwitchJob('DOWNLOAD_MS')).toBe(false);
    expect(isReconMasterSwitchJob('RPA_DOWNLOAD_REPORTS')).toBe(false);
    expect(isReconMasterSwitchJob('DOWNLOAD_CQG')).toBe(false);
    expect(isReconMasterSwitchJob('DOWNLOAD_CQG_BACKUP')).toBe(false);
    expect(isReconMasterSwitchJob('DOWNLOAD_CAST')).toBe(false);
    expect(isReconMasterSwitchJob('DOWNLOAD_CCP_REPORT')).toBe(false);
    expect(isReconMasterSwitchJob('DOWNLOAD_CE_REPORT')).toBe(false);
    expect(isReconMasterSwitchJob('FILE_AUDIT_ACM')).toBe(false);
    expect(isReconMasterSwitchJob('RUN_LOT_MACRO')).toBe(false);
    expect(isReconMasterSwitchJob('RUN_VALUE_MACRO')).toBe(false);
  });

  function createService(opts: {
    autoBackup: string;
    autoRecon: string;
    tasks?: Array<{
      id: string;
      name: string;
      time: string;
      enabled: boolean;
      jobType: string;
      payload?: Record<string, any>;
    }>;
    activeShift?: any;
  }) {
    const tasks = opts.tasks ?? [
      {
        id: 'task_cqg_sync_new',
        name: 'Đối Chiếu Số Dư CQG (SOD)',
        time: '07:05',
        enabled: true,
        jobType: 'CHECK_CQG_SYNC',
      },
      {
        id: 'AUTO_CHECK_SOD',
        name: 'Kiểm tra đầu ngày SOD (Legacy)',
        time: '07:05',
        enabled: true,
        jobType: 'AUTO_CHECK_SOD',
      },
      {
        id: 'task_dsgd_before_eod',
        name: 'Đối chiếu DSGD trước EOD',
        time: '07:05',
        enabled: true,
        jobType: 'CHECK_DSGD_BEFORE_EOD',
      },
      {
        id: 'task_download_ms',
        name: 'Tải báo cáo MS',
        time: '07:05',
        enabled: true,
        jobType: 'DOWNLOAD_MS',
      },
      {
        id: 'task_run_lot',
        name: 'Chạy Macro Lot CCP',
        time: '07:05',
        enabled: true,
        jobType: 'RUN_LOT_MACRO',
      },
    ];

    const settingsService = {
      getSetting: jest.fn(async (key: string, defaultVal?: string) => {
        if (key === 'bot_auto_backup_enabled') return opts.autoBackup;
        if (key === 'bot_auto_recon_enabled') return opts.autoRecon;
        if (key === 'bot_scheduler_config') return JSON.stringify(tasks);
        if (key === 'session_start_time') return '07:00';
        if (key === 'bot_backup_time') return opts.backupTime ?? '';
        if (key === 'bot_backup_time_enabled') return opts.backupTimeEnabled ?? 'true';
        if (key === 'bot_stat_time') return opts.statTime ?? '';
        if (key === 'bot_stat_time_enabled') return opts.statTimeEnabled ?? 'true';
        return defaultVal ?? '';
      }),
      setSetting: jest.fn(async () => undefined),
    };

    const jobQueueService = {
      enqueue: jest.fn(async (jobType: string, payload: Record<string, any>) => ({
        _id: `job_${jobType}`,
        jobType,
        payload,
      })),
    };

    const shiftLogModel = {
      findOne: jest.fn(() => ({
        exec: jest.fn(async () => opts.activeShift ?? null),
      })),
    };

    const service = new AutonomousSchedulerService(
      settingsService as any,
      jobQueueService as any,
      shiftLogModel as any,
    );

    return { service, settingsService, jobQueueService, shiftLogModel };
  }

  it('Tắt bot_auto_recon_enabled và bật bot_auto_backup_enabled: chặn toàn bộ tác vụ đối chiếu (kể cả legacy AUTO_CHECK_SOD) nhưng vẫn chạy backup & thống kê', async () => {
    const { service, jobQueueService } = createService({
      autoRecon: 'false',
      autoBackup: 'true',
    });

    await service.checkSchedule();

    const enqueuedTypes = jobQueueService.enqueue.mock.calls.map((c) => c[0]);
    expect(enqueuedTypes).not.toContain('CHECK_CQG_SYNC');
    expect(enqueuedTypes).not.toContain('AUTO_CHECK_SOD');
    expect(enqueuedTypes).not.toContain('CHECK_DSGD_BEFORE_EOD');
    expect(enqueuedTypes).toEqual(
      expect.arrayContaining(['DOWNLOAD_MS', 'RUN_LOT_MACRO', 'RUN_VALUE_MACRO']),
    );
  });

  it('Tắt bot_auto_backup_enabled và bật bot_auto_recon_enabled: chặn tải backup & macro nhưng vẫn chạy đối chiếu và liên kết đúng task CHECK_CQG_SYNC trong ca trực', async () => {
    const { service, jobQueueService } = createService({
      autoRecon: 'true',
      autoBackup: 'false',
      tasks: [
        {
          id: 'AUTO_CHECK_SOD',
          name: 'Legacy SOD Config',
          time: '07:05',
          enabled: true,
          jobType: 'AUTO_CHECK_SOD',
        },
        {
          id: 'task_download_ms',
          name: 'Tải báo cáo MS',
          time: '07:05',
          enabled: true,
          jobType: 'DOWNLOAD_MS',
        },
        {
          id: 'task_run_lot',
          name: 'Chạy Macro Lot CCP',
          time: '07:05',
          enabled: true,
          jobType: 'RUN_LOT_MACRO',
        },
      ],
      activeShift: {
        _id: 'shift_001',
        status: 'PENDING',
        details: [
          {
            taskId: 'dynamic_uuid_cqg_sync',
            botCheckTypeSnapshot: 'CHECK_CQG_SYNC',
            isChecked: false,
          },
        ],
      },
    });

    await service.checkSchedule();

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    const [jobType, payload] = jobQueueService.enqueue.mock.calls[0];
    expect(jobType).toBe('AUTO_CHECK_SOD');
    expect(payload.taskId).toBe('dynamic_uuid_cqg_sync');
    expect(payload.shiftLogId).toBe('shift_001');
    expect(payload.isStandalone).toBe(false);
  });

  it('Tắt cả bot_auto_backup_enabled và bot_auto_recon_enabled: thoát sớm mà không truy vấn lịch hay tạo job', async () => {
    const { service, settingsService, jobQueueService, shiftLogModel } =
      createService({
        autoRecon: 'false',
        autoBackup: 'false',
      });

    await service.checkSchedule();

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(shiftLogModel.findOne).not.toHaveBeenCalled();
    expect(settingsService.getSetting).toHaveBeenCalledTimes(2);
  });

  it('Bật cả hai switch: cho phép chạy cả tác vụ đối chiếu lẫn backup/thống kê đúng giờ', async () => {
    const { service, jobQueueService } = createService({
      autoRecon: 'true',
      autoBackup: 'true',
    });

    await service.checkSchedule();

    const enqueuedTypes = jobQueueService.enqueue.mock.calls.map((c) => c[0]);
    expect(enqueuedTypes).toEqual(
      expect.arrayContaining([
        'CHECK_CQG_SYNC',
        'AUTO_CHECK_SOD',
        'CHECK_DSGD_BEFORE_EOD',
        'DOWNLOAD_MS',
        'RUN_LOT_MACRO',
        'RUN_VALUE_MACRO',
      ]),
    );
  });

  it('Không tự ý ghi đè bật lại task mà Admin đã chủ động tắt trong bot_scheduler_config khi sync giờ backup', async () => {
    const customTasks = [
      {
        id: 'DOWNLOAD_CQG_BACKUP',
        name: 'Tải CQG Backup',
        time: '06:00',
        enabled: false, // Admin tắt thủ công
        jobType: 'DOWNLOAD_CQG',
      },
    ];

    const { service, jobQueueService } = createService({
      autoRecon: 'true',
      autoBackup: 'true',
      tasks: customTasks,
    } as any);

    await service.checkSchedule();

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(customTasks[0].enabled).toBe(false);
  });

  it('Bỏ qua task một cách an toàn và không làm crash cron khi chưa cấu hình session_start_time', async () => {
    const { service, settingsService, jobQueueService } = createService({
      autoRecon: 'true',
      autoBackup: 'true',
      tasks: [
        {
          id: 'task_cqg',
          name: 'Đối Chiếu Số Dư CQG',
          time: '07:05',
          enabled: true,
          jobType: 'CHECK_CQG_SYNC',
        },
      ],
    });

    // Giả lập chưa cấu hình session_start_time
    settingsService.getSetting.mockImplementation(async (key: string, def?: string) => {
      if (key === 'bot_auto_backup_enabled') return 'true';
      if (key === 'bot_auto_recon_enabled') return 'true';
      if (key === 'session_start_time') return '';
      if (key === 'bot_scheduler_config') {
        return JSON.stringify([
          {
            id: 'task_cqg',
            name: 'Đối Chiếu Số Dư CQG',
            time: '07:05',
            enabled: true,
            jobType: 'CHECK_CQG_SYNC',
          },
        ]);
      }
      return def ?? '';
    });

    await expect(service.checkSchedule()).resolves.not.toThrow();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });
});

