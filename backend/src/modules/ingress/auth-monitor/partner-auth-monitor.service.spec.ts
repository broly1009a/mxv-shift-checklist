/**
 * partner-auth-monitor.service.spec.ts
 *
 * Kiểm thử đơn vị cho PartnerAuthMonitorService:
 * - Ghi nhận sự kiện non-blocking (O(1))
 * - Phát hiện bão request (Rate-limit exceeded) & chuỗi lỗi liên tiếp
 * - Dập bão Email với cơ chế Cooldown
 * - Cấu hình động Zero-Hardcoding
 */

import { PartnerAuthMonitorService } from './partner-auth-monitor.service';
import { IPartnerTelemetryEvent } from './partner-auth-monitor.interface';

describe('PartnerAuthMonitorService (Telemetry & Alert Monitor)', () => {
  let service: PartnerAuthMonitorService;
  let mockModel: any;
  let mockSettings: any;
  let mockEmailAlert: any;

  beforeEach(() => {
    mockModel = {
      insertMany: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    mockSettings = {
      getSetting: jest.fn().mockResolvedValue(''),
      setSetting: jest.fn().mockResolvedValue(true),
    };

    mockEmailAlert = {
      sendPartnerAuthAlert: jest.fn().mockResolvedValue(undefined),
    };

    service = new PartnerAuthMonitorService(
      mockModel,
      mockSettings,
      mockEmailAlert,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('1. Non-blocking In-Memory Buffer', () => {
    it('phải ghi nhận sự kiện vào bộ nhớ đệm và tính toán health summary tức thì', async () => {
      const event: IPartnerTelemetryEvent = {
        partner: 'CORECCP',
        eventType: 'API_REQUEST',
        success: true,
        durationMs: 120,
      };

      service.recordEvent(event);
      const summaries = await service.getHealthSummaries();
      const ccpSummary = summaries.find((s) => s.partner === 'CORECCP');

      expect(ccpSummary).toBeDefined();
      expect(ccpSummary?.rpm).toBe(1);
      expect(ccpSummary?.health).toBe('HEALTHY');
      expect(ccpSummary?.consecutiveFailures).toBe(0);
      expect(ccpSummary?.successRate).toBe(100);
    });
  });

  describe('2. Storm Detection & Consecutive Failures', () => {
    it('phải chuyển trạng thái sang WARNING và CRITICAL khi có lỗi liên tiếp', async () => {
      // 1 lần lỗi -> WARNING
      service.recordEvent({
        partner: 'MS',
        eventType: 'LOGIN',
        success: false,
        durationMs: 250,
        errorMessage: 'Invalid password',
      });

      let summaries = await service.getHealthSummaries();
      let msSummary = summaries.find((s) => s.partner === 'MS');
      expect(msSummary?.consecutiveFailures).toBe(1);
      expect(msSummary?.health).toBe('WARNING');

      // 3 lần lỗi liên tiếp -> CRITICAL
      service.recordEvent({
        partner: 'MS',
        eventType: 'LOGIN',
        success: false,
        durationMs: 200,
        errorMessage: 'Invalid PIN',
      });
      service.recordEvent({
        partner: 'MS',
        eventType: 'LOGIN',
        success: false,
        durationMs: 210,
        errorMessage: 'Account locked',
      });

      summaries = await service.getHealthSummaries();
      msSummary = summaries.find((s) => s.partner === 'MS');
      expect(msSummary?.consecutiveFailures).toBe(3);
      expect(msSummary?.health).toBe('CRITICAL');
    });
  });

  describe('3. Email Storm Suppression & Cooldown', () => {
    it('chỉ gửi 1 email đầu tiên khi lỗi và dập tắt các email lặp lại trong Cooldown', async () => {
      // Ghi nhận 3 lỗi liên tiếp để kích hoạt ngưỡng
      service.recordEvent({ partner: 'CQG', eventType: 'LOGIN', success: false, durationMs: 100, errorMessage: 'Err 1' });
      service.recordEvent({ partner: 'CQG', eventType: 'LOGIN', success: false, durationMs: 100, errorMessage: 'Err 2' });

      // Đợi setImmediate xử lý evaluateThresholds
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockEmailAlert.sendPartnerAuthAlert).toHaveBeenCalledTimes(1);

      // Ghi nhận thêm 5 lỗi liên tiếp trong thời gian Cooldown
      for (let i = 0; i < 5; i++) {
        service.recordEvent({ partner: 'CQG', eventType: 'LOGIN', success: false, durationMs: 100, errorMessage: `Err repeat ${i}` });
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Vẫn chỉ gọi 1 lần (đã dập tắt 5 lần lặp lại)
      expect(mockEmailAlert.sendPartnerAuthAlert).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Dynamic Configuration (Zero-Hardcoding)', () => {
    it('phải đọc cấu hình từ SystemSettings và cho phép cập nhật', async () => {
      mockSettings.getSetting.mockResolvedValueOnce(
        JSON.stringify({
          cooldownMinutes: 30,
          recipients: ['admin@mxv.vn'],
        }),
      );

      const config = await service.getConfig();
      expect(config.cooldownMinutes).toBe(30);
      expect(config.recipients).toEqual(['admin@mxv.vn']);

      await service.updateConfig({ cooldownMinutes: 45 });
      expect(mockSettings.setSetting).toHaveBeenCalledWith(
        'partner_auth_monitor_config',
        expect.stringContaining('"cooldownMinutes":45'),
      );
    });
  });
});
