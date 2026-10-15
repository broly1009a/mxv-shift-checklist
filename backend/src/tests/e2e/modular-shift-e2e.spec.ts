import { BotDispatcherService } from '../../modules/checklist-hub/dispatcher/bot-dispatcher.service';
import { IBotWorker, TaskExecutionContext, TaskExecutionResult } from '../../shared';

describe('Modular Monolith V2 End-to-End Shift Lifecycle Simulation (Toàn Trình Ca Trực 24h)', () => {
  // Mock DB Store
  const mockDomainLogs: Array<{ id: string; domain: string; data: any }> = [];
  let logIdCounter = 1;

  // 1. Tạo Dummy KLGD Worker
  const klgdWorker: IBotWorker = {
    capabilityType: 'CHECK_KLGD',
    displayName: 'KLGD Worker V2',
    canHandle: (c) => c === 'CHECK_KLGD',
    execute: async (ctx: TaskExecutionContext): Promise<TaskExecutionResult> => {
      const logId = `TRADING_LOG_${logIdCounter++}`;
      mockDomainLogs.push({
        id: logId,
        domain: 'trading_recon_logs',
        data: {
          reconType: 'KLGD',
          taskId: ctx.taskId,
          shiftId: ctx.shiftId,
          mismatchedTrades: [{ maTKGD: '001C123456', differ: 0 }],
        },
      });

      return {
        status: 'SUCCESS',
        summary: 'Đối chiếu KLGD khớp 100% (DSGD: 1500, FR: 1500, Straits: 0)',
        metrics: { totalDSGD: 1500, totalFR: 1500, differ: 0 },
        domainLogRefId: logId,
        durationMs: 120,
        executedAt: new Date(),
      };
    },
  };

  // 2. Tạo Dummy Pre-EOD Worker
  const preEodWorker: IBotWorker = {
    capabilityType: 'CHECK_PRE_EOD',
    displayName: 'Pre-EOD Worker V2',
    canHandle: (c) => c === 'CHECK_PRE_EOD',
    execute: async (ctx: TaskExecutionContext): Promise<TaskExecutionResult> => {
      const logId = `TRADING_LOG_${logIdCounter++}`;
      mockDomainLogs.push({
        id: logId,
        domain: 'trading_recon_logs',
        data: {
          reconType: 'PRE_EOD',
          taskId: ctx.taskId,
          shiftId: ctx.shiftId,
          totals: { differCQG: 0, differACM: 0 },
        },
      });

      return {
        status: 'SUCCESS',
        summary: 'Chốt đối chiếu 3 bên Pre-EOD khớp 100%',
        metrics: { differCQG: 0, differACM: 0 },
        domainLogRefId: logId,
        durationMs: 250,
        executedAt: new Date(),
      };
    },
  };

  // 3. Tạo Dummy CCP Clearing Worker
  const ccpWorker: IBotWorker = {
    capabilityType: 'CCP_LOT_STATS',
    displayName: 'CCP Lot Clearing Worker V2',
    canHandle: (c) => c === 'CCP_LOT_STATS',
    execute: async (ctx: TaskExecutionContext): Promise<TaskExecutionResult> => {
      const logId = `CCP_LOG_${logIdCounter++}`;
      mockDomainLogs.push({
        id: logId,
        domain: 'ccp_clearing_logs',
        data: {
          taskId: ctx.taskId,
          shiftId: ctx.shiftId,
          byProduct: [{ maSP: 'TBR', klm: 50, klb: 50 }],
        },
      });

      return {
        status: 'SUCCESS',
        summary: 'Thống kê bù trừ CCP thành công: Tổng DSGD = 3200 lots',
        metrics: { dsgdTotal: 3200, differKlgd: 0 },
        domainLogRefId: logId,
        durationMs: 310,
        executedAt: new Date(),
      };
    },
  };

  it('Thực thi toàn trình 1 ca trực hoàn chỉnh: Điều phối tuần tự 3 nghiệp vụ tài chính và lưu log độc lập', async () => {
    // Mock Queue Collection
    const mockJobs: any[] = [];
    const mockJobCollection = {
      findOneAndUpdate: async (filter: any, update: any) => {
        const match = mockJobs.find((j) => j.status === 'PENDING');
        if (!match) return null;
        Object.assign(match, update.$set);
        return { ...match, toObject: () => ({ ...match }) };
      },
      updateOne: async (filter: any, update: any) => {
        const match = mockJobs.find((j) => j._id === filter._id);
        if (match && update.$set) {
          Object.assign(match, update.$set);
        }
        return { modifiedCount: 1 };
      },
    };

    const dispatcher = new BotDispatcherService(mockJobCollection as any);
    dispatcher.registerWorker(klgdWorker);
    dispatcher.registerWorker(preEodWorker);
    dispatcher.registerWorker(ccpWorker);

    const shiftLogId = 'SHIFT_20261013_CA_NGAY';

    // Đẩy 3 tasks vào ca trực
    mockJobs.push(
      {
        _id: 'JOB_01',
        jobType: 'CHECK_KLGD',
        status: 'PENDING',
        payload: { shiftLogId, taskId: 'TASK_KLGD_01', botCheckType: 'CHECK_KLGD' },
      },
      {
        _id: 'JOB_02',
        jobType: 'CHECK_PRE_EOD',
        status: 'PENDING',
        payload: { shiftLogId, taskId: 'TASK_PREEOD_01', botCheckType: 'CHECK_PRE_EOD' },
      },
      {
        _id: 'JOB_03',
        jobType: 'CCP_LOT_STATS',
        status: 'PENDING',
        payload: { shiftLogId, taskId: 'TASK_CCP_01', botCheckType: 'CCP_LOT_STATS' },
      },
    );

    // Xử lý Job 1: KLGD
    const res1 = await dispatcher.acquireAndProcessNextJob();
    expect(res1).not.toBeNull();
    expect(res1?.status).toBe('COMPLETED');

    // Xử lý Job 2: Pre-EOD
    const res2 = await dispatcher.acquireAndProcessNextJob();
    expect(res2).not.toBeNull();
    expect(res2?.status).toBe('COMPLETED');

    // Xử lý Job 3: CCP Clearing
    const res3 = await dispatcher.acquireAndProcessNextJob();
    expect(res3).not.toBeNull();
    expect(res3?.status).toBe('COMPLETED');

    // Không còn job nào pending
    const res4 = await dispatcher.acquireAndProcessNextJob();
    expect(res4).toBeNull();

    // Kiểm tra kết quả trong Domain Logs độc lập
    expect(mockDomainLogs.length).toBe(3);
    const tradingLogs = mockDomainLogs.filter((l) => l.domain === 'trading_recon_logs');
    const ccpLogs = mockDomainLogs.filter((l) => l.domain === 'ccp_clearing_logs');

    expect(tradingLogs.length).toBe(2);
    expect(ccpLogs.length).toBe(1);

    // Xác nhận tính toàn vẹn của kết quả
    expect(mockJobs[0]['payload.result']?.totalDSGD).toBe(1500);
    expect(mockJobs[0]['payload.domainLogRefId']).toBe('TRADING_LOG_1');

    expect(mockJobs[1]['payload.result']?.differCQG).toBe(0);
    expect(mockJobs[1]['payload.domainLogRefId']).toBe('TRADING_LOG_2');

    expect(mockJobs[2]['payload.result']?.dsgdTotal).toBe(3200);
    expect(mockJobs[2]['payload.domainLogRefId']).toBe('CCP_LOG_3');
  });
});
