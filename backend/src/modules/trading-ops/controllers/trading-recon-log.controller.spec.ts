import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { TradingReconLogController } from './trading-recon-log.controller';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('TradingReconLogController (Unit Tests & Security Gate)', () => {
  let controller: TradingReconLogController;
  let mockReconLogModel: any;

  beforeEach(async () => {
    mockReconLogModel = {
      findById: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradingReconLogController],
      providers: [
        {
          provide: getModelToken(TradingReconLog.name),
          useValue: mockReconLogModel,
        },
      ],
    }).compile();

    controller = module.get<TradingReconLogController>(TradingReconLogController);
  });

  describe('Security Audit & Guard Metadata', () => {
    it('TC-SEC-01: Phải có JwtAuthGuard bảo vệ trên cấp độ Controller (Chặn IP lạ truy cập)', () => {
      const guards = Reflect.getMetadata('__guards__', TradingReconLogController);
      expect(guards).toBeDefined();
      expect(Array.isArray(guards)).toBe(true);
      const hasJwtGuard = guards.some((g: any) => g === JwtAuthGuard || g.name === 'JwtAuthGuard');
      expect(hasJwtGuard).toBe(true);
    });
  });

  describe('getById()', () => {
    it('TC-LOG-01: Trả về chi tiết bản ghi đối soát khi tìm thấy ID hợp lệ', async () => {
      const mockLog = {
        _id: 'recon_log_123',
        tradingDate: '2026-11-10',
        checkType: 'CHECK_KLGD',
        summary: { totalMismatch: 0 },
      };

      mockReconLogModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockLog),
        }),
      });

      const result = await controller.getById('recon_log_123');
      expect(result).toEqual({
        success: true,
        data: mockLog,
      });
      expect(mockReconLogModel.findById).toHaveBeenCalledWith('recon_log_123');
    });

    it('TC-LOG-02: Ném lỗi NotFoundException khi ID không tồn tại trong hệ thống', async () => {
      mockReconLogModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(controller.getById('non_existent_id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getByDate()', () => {
    it('TC-LOG-03: Trả về danh sách các bản ghi đối soát theo ngày sắp xếp mới nhất trước', async () => {
      const mockLogs = [
        { _id: 'log_1', tradingDate: '2026-11-10', createdAt: new Date() },
        { _id: 'log_2', tradingDate: '2026-11-10', createdAt: new Date(Date.now() - 3600000) },
      ];

      mockReconLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });

      const result = await controller.getByDate('2026-11-10');
      expect(result).toEqual({
        success: true,
        count: 2,
        data: mockLogs,
      });
      expect(mockReconLogModel.find).toHaveBeenCalledWith({ tradingDate: '2026-11-10' });
    });
  });
});

