import { BotJobQueueService } from './bot-job-queue.service';

describe('BotJobQueueService (BotDispatcher V2 ABORTED State Handling)', () => {
  const buildMocks = (shiftDetails: any[] = [{ taskId: 'TASK_KLGD_01', isChecked: false }]) => {
    const updateOneExec = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const botJobModel: any = {
      updateOne: jest.fn(() => ({ exec: updateOneExec })),
      findById: jest.fn(() => ({
        select: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({ status: 'PROCESSING' }) })),
      })),
    };
    const registry: any = { getHandler: jest.fn() };
    const shiftsService: any = {
      findShiftLogRaw: jest.fn().mockResolvedValue({
        _id: 'SHIFT_01',
        status: 'IN_PROGRESS',
        details: shiftDetails,
      }),
      updateTaskStatus: jest.fn().mockResolvedValue(true),
    };
    const shiftsGateway: any = {
      emitEvent: jest.fn(),
      emitJobStatusUpdated: jest.fn(),
      emitJobLogUpdated: jest.fn(),
    };
    const settingsService: any = { getSetting: jest.fn().mockResolvedValue('') };
    const systemLogsService: any = {
      logEvent: jest.fn().mockResolvedValue(true),
    };
    const domainLockManager: any = {
      tryAcquire: jest.fn(),
      release: jest.fn(),
      isGlobalLimitReached: jest.fn().mockReturnValue(true),
    };
    const botDispatcher: any = {
      hasWorker: jest.fn().mockReturnValue(true),
      dispatch: jest.fn(),
    };

    const service = new BotJobQueueService(
      botJobModel,
      registry,
      shiftsService,
      shiftsGateway,
      settingsService,
      systemLogsService,
      domainLockManager,
      botDispatcher,
    );

    return {
      service,
      botJobModel,
      updateOneExec,
      shiftsService,
      shiftsGateway,
      systemLogsService,
      domainLockManager,
      botDispatcher,
    };
  };

  it('TC-QUEUE-01: Ghi status=ABORTED, lưu job.error, chuyển checklist sang NEEDS_ATTENTION và KHÔNG bắn BOT_JOB_COMPLETED khi Worker trả ABORTED', async () => {
    const {
      service,
      botJobModel,
      shiftsService,
      shiftsGateway,
      systemLogsService,
      botDispatcher,
    } = buildMocks();

    const abortError =
      '[PARTNER_SERVICE_UNAVAILABLE] Nguồn [CQG Pre-flight Guard] gặp sự cố: [CQG_ABORT_PREFLIGHT]';
    botDispatcher.dispatch.mockResolvedValue({
      status: 'ABORTED',
      summary: `[Tạm dừng bảo vệ]: ${abortError}`,
      error: abortError,
      logs: ['line1'],
    });

    const job: any = {
      _id: { toString: () => '6af4a744f4ee477a282eab95' },
      jobType: 'CHECK_KLGD',
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 3,
      logs: [],
      payload: { shiftLogId: 'SHIFT_01', taskId: 'TASK_KLGD_01', targetDate: '2026-11-11' },
      save: jest.fn().mockResolvedValue(true),
      toObject: function () {
        return { payload: this.payload };
      },
    };

    await (service as any).executeJobInPool(job, 'RECON', ['RECON']);

    expect(job.status).toBe('ABORTED');
    expect(job.error).toBe(abortError);
    expect(job.save).toHaveBeenCalledTimes(1);

    const lastUpdateCall = botJobModel.updateOne.mock.calls.at(-1);
    expect(lastUpdateCall[1].$set.status).toBe('ABORTED');
    expect(lastUpdateCall[1].$set.error).toBe(abortError);

    expect(shiftsService.updateTaskStatus).toHaveBeenLastCalledWith(
      'SHIFT_01',
      'TASK_KLGD_01',
      'NEEDS_ATTENTION',
      expect.objectContaining({ username: 'system_bot' }),
      expect.stringContaining('"status":"ABORTED"'),
      true,
    );

    const lastWsPayload = shiftsGateway.emitJobStatusUpdated.mock.calls.at(-1)[1];
    expect(lastWsPayload.status).toBe('ABORTED');
    expect(lastWsPayload.error).toBe(abortError);

    expect(systemLogsService.logEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'BOT_JOB_COMPLETED' }),
    );
  });

  it('TC-QUEUE-02: Ghi status=COMPLETED, xóa error về null và bắn BOT_JOB_COMPLETED khi Worker trả SUCCESS', async () => {
    const { service, botJobModel, systemLogsService, botDispatcher } = buildMocks();

    botDispatcher.dispatch.mockResolvedValue({
      status: 'SUCCESS',
      summary: 'Đối chiếu khớp 100%',
      metrics: { totalDSGD: 100, totalFR: 100 },
      logs: [],
    });

    const job: any = {
      _id: { toString: () => '6af510bcf4ee477a282eadc0' },
      jobType: 'CHECK_KLGD',
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 3,
      error: 'old transient error',
      logs: [],
      payload: { shiftLogId: 'SHIFT_01', taskId: 'TASK_KLGD_01', targetDate: '2026-11-12' },
      save: jest.fn().mockResolvedValue(true),
      toObject: function () {
        return { payload: this.payload };
      },
    };

    await (service as any).executeJobInPool(job, 'RECON', ['RECON']);

    expect(job.status).toBe('COMPLETED');
    expect(job.error).toBeUndefined();
    const lastUpdateCall = botJobModel.updateOne.mock.calls.at(-1);
    expect(lastUpdateCall[1].$set.status).toBe('COMPLETED');
    expect(lastUpdateCall[1].$set.error).toBeNull();
    expect(systemLogsService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'BOT_JOB_COMPLETED', status: 'SUCCESS' }),
    );
  });
});
