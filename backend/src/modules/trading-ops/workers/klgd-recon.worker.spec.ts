import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { KlgdReconWorker } from './klgd-recon.worker';
import { KlgdReconService } from '../services/recon/klgd-recon.service';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';
import { RECON_PIPELINE_PORT } from '../../../shared';

describe('KlgdReconWorker (Task 7 Fail-Fast & Pre-Flight)', () => {
  let worker: KlgdReconWorker;

  const mockKlgdReconService = {
    runAutoCheckKLGD: jest.fn(),
  };

  const mockReconPipeline = {
    handleCheckKlgdJob: jest.fn(),
  };

  const mockReconLogModel = {
    create: jest.fn().mockResolvedValue({ _id: 'mock-log-id' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KlgdReconWorker,
        { provide: KlgdReconService, useValue: mockKlgdReconService },
        { provide: getModelToken(TradingReconLog.name), useValue: mockReconLogModel },
        { provide: RECON_PIPELINE_PORT, useValue: mockReconPipeline },
      ],
    }).compile();

    worker = module.get<KlgdReconWorker>(KlgdReconWorker);
  });

  it('TC-KLGD-01: Chuyển trạng thái ABORTED khi Ingress ném [PARTNER_SERVICE_UNAVAILABLE] (Fail-Fast)', async () => {
    mockReconPipeline.handleCheckKlgdJob.mockRejectedValue(
      new Error('[PARTNER_SERVICE_UNAVAILABLE] Nguồn [MS] gặp sự cố: Pre-flight failed'),
    );

    const context: any = {
      taskId: 'TASK_TEST_01',
      shiftId: 'SHIFT_01',
      targetDate: new Date('2026-11-10'),
      parameters: { skipDownload: false },
    };

    const result = await worker.execute(context);

    expect(result.status).toBe('ABORTED');
    expect(result.summary).toContain('[Tạm dừng bảo vệ]');
    expect(result.error).toContain('[PARTNER_SERVICE_UNAVAILABLE]');
  });

  it('TC-KLGD-02: Xử lý trạng thái WAITING khi đang chờ file', async () => {
    mockReconPipeline.handleCheckKlgdJob.mockResolvedValue({
      isWaitingFiles: true,
      message: 'Chờ file DSGD và FR',
    });

    const context: any = {
      taskId: 'TASK_TEST_02',
      shiftId: 'SHIFT_01',
      targetDate: new Date('2026-11-10'),
    };

    const result = await worker.execute(context);

    expect(result.status).toBe('WAITING');
    expect(result.isWaitingFiles).toBe(true);
  });

  it('TC-KLGD-03: Trả về SUCCESS khi đối chiếu khớp 100%', async () => {
    mockReconPipeline.handleCheckKlgdJob.mockResolvedValue({
      passed: true,
      totals: { totalDSGD: 100, totalFR: 100, totalACM: 0, totalNano: 0, differ: 0, differACM: 0 },
      mismatchedTrades: [],
      mismatchedTTM: [],
    });

    const context: any = {
      taskId: 'TASK_TEST_03',
      shiftId: 'SHIFT_01',
      targetDate: new Date('2026-11-10'),
    };

    const result = await worker.execute(context);

    expect(result.status).toBe('SUCCESS');
    expect(result.summary).toContain('Khớp 100%');
    expect(mockReconLogModel.create).toHaveBeenCalled();
  });
});
