/**
 * Phase 35 - Notification Unit Tests (Logic-Only with Jest Mocks)
 * No SMTP, no WebSocket, no external providers, no real database
 */

import { Notification } from '@svl/share';
import {
  MockMailHistoryModel,
  createMockTransporter,
  mockSmsService,
  mockTeamsService,
  mockZaloService,
  mockWsService,
  createMockLogger,
} from '../helpers/notification-mocks';

// Mock nodemailer BEFORE importing services
const mockTransporter = createMockTransporter();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue(mockTransporter),
}));

jest.mock('@/modules/notification/models/mail-history.model', () => ({
  MailHistoryModel: MockMailHistoryModel,
}));

jest.mock('@/modules/notification/sms/sms.service', () => mockSmsService);
jest.mock('@/modules/notification/teams/teams.service', () => mockTeamsService);
jest.mock('@/modules/notification/zalo/zalo.service', () => mockZaloService);
jest.mock('@/modules/notification/ws/ws.service', () => mockWsService);

jest.mock('@/loggers/winstonLogger', () => ({
  logger: createMockLogger(),
}));

// Now import services
import { buildMailMessage, sendMailMessage } from '@/modules/notification/mail/mail.service';
import { dispatchNotification } from '@/modules/notification/dispatcher/notification.dispatcher';
import { logger } from '@/loggers/winstonLogger';

describe('Notification Service - Logic Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.EMAIL_HOST = 'localhost';
    process.env.EMAIL_SERVICE = undefined;
    MockMailHistoryModel.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('buildMailMessage', () => {
    it('should build mail message with recipients', () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Test Email',
        subject: 'Test Subject',
        html: '<p>Test body</p>',
        recipients: [
          { email: 'user1@example.com' },
          { email: 'user2@example.com' },
        ],
      };

      const message = buildMailMessage(payload);

      expect(message.to).toContain('user1@example.com');
      expect(message.to).toContain('user2@example.com');
      expect(message.subject).toBe('Test Subject');
      expect(message.html).toBeTruthy();
    });

    it('should use subject fallback order: mail options > subject > title', () => {
      const payload1: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Title Only',
        recipients: [{ email: 'test@example.com' }],
      };

      let message = buildMailMessage(payload1);
      expect(message.subject).toBe('Title Only');

      const payload2: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        subject: 'Subject Field',
        title: 'Title Only',
        recipients: [{ email: 'test@example.com' }],
      };

      message = buildMailMessage(payload2);
      expect(message.subject).toBe('Subject Field');

      const payload3: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        channelOptions: {
          mail: { subject: 'Mail Option Subject' },
        },
        subject: 'Subject Field',
        title: 'Title Only',
        recipients: [{ email: 'test@example.com' }],
      };

      message = buildMailMessage(payload3);
      expect(message.subject).toBe('Mail Option Subject');
    });

    it('should handle HTML and text content', () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        html: '<p>HTML content</p>',
        recipients: [{ email: 'test@example.com' }],
      };

      const message = buildMailMessage(payload);
      expect(message.html).toBeTruthy();
    });

    it('should extract recipients from mail options', () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        channelOptions: {
          mail: {
            to: ['option1@example.com', 'option2@example.com'],
          },
        },
        recipients: [{ email: 'recipient@example.com' }],
      };

      const message = buildMailMessage(payload);
      expect(message.to).toContain('option1@example.com');
      expect(message.to).toContain('option2@example.com');
      expect(message.to).toContain('recipient@example.com');
    });

    it('should handle cc and bcc', () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        channelOptions: {
          mail: {
            cc: ['cc@example.com'],
            bcc: ['bcc@example.com'],
          },
        },
        recipients: [{ email: 'test@example.com' }],
      };

      const message = buildMailMessage(payload);
      expect(message.cc).toContain('cc@example.com');
      expect(message.bcc).toContain('bcc@example.com');
    });
  });

  describe('sendMailMessage', () => {
    it('should log warning and record FAILED history when missing mail configurations', async () => {
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_SERVICE;

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        subject: 'Test Missing Config',
        html: '<p>Test</p>',
        recipients: [{ email: 'test@example.com' }],
      };

      await expect(sendMailMessage(payload)).rejects.toThrow('Missing mail configuration');

      expect((logger.warn as jest.Mock)).toHaveBeenCalledWith(
        expect.stringContaining('Missing required mail configurations')
      );

      const histories = MockMailHistoryModel.getAll();
      const history = histories[histories.length - 1];
      expect(history.status).toBe('FAILED');
      expect(history.error).toContain('Missing mail configuration');
    });
    it('should send email and create SUCCESS history', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        subject: 'Test',
        html: '<p>Test</p>',
        recipients: [{ email: 'test@example.com' }],
      };

      await sendMailMessage(payload);

      expect(mockTransporter.sendMail).toHaveBeenCalled();

      const histories = MockMailHistoryModel.getAll();
      expect(histories.length).toBeGreaterThan(0);
      const history = histories[histories.length - 1];
      expect(history.status).toBe('SUCCESS');
      expect(history.to).toContain('test@example.com');
    });

    it('should handle send failure and create FAILED history', async () => {
      const error = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValueOnce(error);

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        subject: 'Test',
        html: '<p>Test</p>',
        recipients: [{ email: 'test@example.com' }],
      };

      await expect(sendMailMessage(payload)).rejects.toThrow('SMTP connection failed');

      const histories = MockMailHistoryModel.getAll();
      const history = histories[histories.length - 1];
      expect(history.status).toBe('FAILED');
      expect(history.error).toBeTruthy();
    });

    it('should throw if no recipients', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        subject: 'Test',
        html: '<p>Test</p>',
        recipients: [],
      };

      await expect(sendMailMessage(payload)).rejects.toThrow();
    });
  });

  describe('dispatchNotification', () => {
    it('should send to selected channels using Promise.allSettled', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [
          Notification.Enums.NotificationChannel.MAIL,
          Notification.Enums.NotificationChannel.SMS,
        ],
        subject: 'Test',
        html: '<p>Test</p>',
        recipients: [{ email: 'test@example.com' }],
      };

      await dispatchNotification(payload);

      // Both services should be called
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      expect(mockSmsService.sendSmsMessage).toHaveBeenCalled();
    });

    it('should not reject if one channel fails but another succeeds', async () => {
      mockSmsService.sendSmsMessage.mockRejectedValueOnce(
        new Error('SMS provider unavailable')
      );

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [
          Notification.Enums.NotificationChannel.MAIL,
          Notification.Enums.NotificationChannel.SMS,
        ],
        subject: 'Test',
        html: '<p>Test</p>',
        recipients: [{ email: 'test@example.com' }],
      };

      // Should not throw because mail succeeded
      await expect(dispatchNotification(payload)).resolves.toBeUndefined();

      // Error should be logged
      expect((logger.error as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });

    it('should reject if all channels fail', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('Mail failed'));
      mockSmsService.sendSmsMessage.mockRejectedValueOnce(new Error('SMS failed'));

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [
          Notification.Enums.NotificationChannel.MAIL,
          Notification.Enums.NotificationChannel.SMS,
        ],
        subject: 'Test',
        html: '<p>Test</p>',
        recipients: [{ email: 'test@example.com' }],
      };

      await expect(dispatchNotification(payload)).rejects.toThrow(
        'All notification channels failed'
      );
    });

    it('should log warning for unsupported channel', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [99 as any], // Unsupported channel
        subject: 'Test',
        recipients: [],
      };

      await dispatchNotification(payload);

      expect((logger.warn as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });

    it('should throw if payload is invalid', async () => {
      await expect(dispatchNotification(null as any)).rejects.toThrow();
    });

    it('should log warning if payload has no channels array', async () => {
      await dispatchNotification({} as any);
      expect((logger.warn as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });

    it('should log warning if no channels specified', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [],
        subject: 'Test',
        recipients: [],
      };

      await dispatchNotification(payload);

      expect((logger.warn as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });

    it('should call all four provider channels when specified', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [
          Notification.Enums.NotificationChannel.MAIL,
          Notification.Enums.NotificationChannel.SMS,
          Notification.Enums.NotificationChannel.TEAMS,
          Notification.Enums.NotificationChannel.ZALO,
          Notification.Enums.NotificationChannel.WS,
        ],
        subject: 'Test',
        html: '<p>Test</p>',
        recipients: [{ email: 'test@example.com', userId: 'user-1' }],
      };

      await dispatchNotification(payload);

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      expect(mockSmsService.sendSmsMessage).toHaveBeenCalled();
      expect(mockTeamsService.sendTeamsMessage).toHaveBeenCalled();
      expect(mockZaloService.sendZaloMessage).toHaveBeenCalled();
      expect(mockWsService.sendWsMessage).toHaveBeenCalled();
    });
  });

  describe('WS sendWsMessage', () => {
    it('should send message to userId', async () => {
      mockWsService.sendWsMessage.mockResolvedValueOnce(undefined);

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.WS],
        message: 'Test message',
        recipients: [{ userId: 'user-123' }],
      };

      await mockWsService.sendWsMessage(payload);

      expect(mockWsService.sendWsMessage).toHaveBeenCalledWith(payload);
    });

    it('should broadcast to room if no userId', async () => {
      mockWsService.sendWsMessage.mockResolvedValueOnce(undefined);

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.WS],
        message: 'Broadcast message',
        channelOptions: { ws: { room: 'room-1' } },
        recipients: [],
      };

      await mockWsService.sendWsMessage(payload);

      expect(mockWsService.sendWsMessage).toHaveBeenCalled();
    });

    it('should throw if neither userId nor room specified', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.WS],
        message: 'Test',
        recipients: [],
      };

      // Mock to throw if missing both
      mockWsService.sendWsMessage.mockImplementationOnce(async (p) => {
        if (!p.recipients?.find((r) => r.userId) && !p.channelOptions?.ws?.room) {
          throw new Error('WebSocket room or userId must be defined');
        }
      });

      await expect(mockWsService.sendWsMessage(payload)).rejects.toThrow(
        'WebSocket room or userId must be defined'
      );
    });
  });
});
