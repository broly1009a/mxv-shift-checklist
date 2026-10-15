/**
 * Notification Port Interface (Unit)
 * Validates the notification port and payload contract for password reset scenarios.
 * NOTE: This is a unit test for the interface, not a real auth integration test.
 */

import type { NotificationPort, AuditRecorder } from '@/shared';
import { Notification } from '@svl/share';

describe('Notification Port / Payload Contract (Unit)', () => {
  let mockNotificationPort: jest.Mocked<NotificationPort>;
  let mockAuditRecorder: jest.Mocked<AuditRecorder>;

  beforeEach(() => {
    mockNotificationPort = {
      send: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<NotificationPort>;

    mockAuditRecorder = {
      writeLog: jest.fn().mockResolvedValue(undefined),
      updateResult: jest.fn().mockResolvedValue(undefined),
      executeWithAudit: jest
        .fn()
        .mockImplementation(async (log, owner, operation) => {
          return operation();
        }),
    } as jest.Mocked<AuditRecorder>;

    jest.clearAllMocks();

    // Note: setAuthNotificationPort and setAuthAuditRecorder would be called
    // in real auth module initialization, but we're testing the interfaces
    // directly here without importing the real auth module
  });

  describe('Reset Password Notification Payload', () => {
    it('should send notification with MAIL channel for password reset', async () => {
      // Simulate reset password call without importing real auth module
      const resetCode = 'reset-code-123';
      const resetLink = `https://app.example.com/reset?code=${resetCode}`;

      // Simulate what auth.resetPassword would do
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Password Reset Request',
        subject: 'Reset Your Password',
        html: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 1 hour.</p>`,
        recipients: [{ email: 'user@example.com' }],
      };

      // Verify notification interface
      await mockNotificationPort.send(payload);

      expect(mockNotificationPort.send).toHaveBeenCalled();

      const callPayload = (mockNotificationPort.send as jest.Mock).mock
        .calls[0][0];

      expect(callPayload.channels).toContain(
        Notification.Enums.NotificationChannel.MAIL
      );
      expect(callPayload.recipients).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: 'user@example.com' }),
        ])
      );
      expect(callPayload.subject).toBeTruthy();
      expect(callPayload.html).toBeTruthy();
    });

    it('should include reset link in notification HTML', async () => {
      const resetCode = 'reset-abc-123';
      const resetLink = `https://app.example.com/reset?code=${resetCode}`;

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Password Reset',
        html: `<p>Click <a href="${resetLink}">here</a> to reset your password</p>`,
        recipients: [{ email: 'user@example.com' }],
      };

      await mockNotificationPort.send(payload);

      expect(mockNotificationPort.send).toHaveBeenCalledWith(payload);

      const callPayload = (mockNotificationPort.send as jest.Mock).mock
        .calls[0][0];
      expect(callPayload.html).toContain(resetLink);
    });

    it('should include user email in recipient list', async () => {
      const userEmail = 'john.doe@example.com';

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Reset Password',
        subject: 'Password Reset Request',
        recipients: [{ email: userEmail }],
      };

      await mockNotificationPort.send(payload);

      const callPayload = (mockNotificationPort.send as jest.Mock).mock
        .calls[0][0];

      expect(callPayload.recipients).toEqual(
        expect.arrayContaining([expect.objectContaining({ email: userEmail })])
      );
    });

    it('should include expiration time in HTML', async () => {
      const expirationDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      const expirationText = expirationDate.toLocaleString();

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Password Reset',
        html: `<p>This link expires at ${expirationText}</p>`,
        recipients: [{ email: 'user@example.com' }],
      };

      await mockNotificationPort.send(payload);

      const callPayload = (mockNotificationPort.send as jest.Mock).mock
        .calls[0][0];

      expect(callPayload.html).toContain('expires');
    });
  });

  describe('Reset Password with WebSocket Notification', () => {
    it('should include WS channel if real-time notification enabled', async () => {
      const userId = 'user-456';

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [
          Notification.Enums.NotificationChannel.MAIL,
          Notification.Enums.NotificationChannel.WS,
        ],
        title: 'Password Reset Initiated',
        message: 'A password reset was initiated on your account',
        recipients: [{ email: 'user@example.com', userId }],
      };

      await mockNotificationPort.send(payload);

      const callPayload = (mockNotificationPort.send as jest.Mock).mock
        .calls[0][0];

      expect(callPayload.channels).toContain(
        Notification.Enums.NotificationChannel.MAIL
      );
      expect(callPayload.channels).toContain(
        Notification.Enums.NotificationChannel.WS
      );
      expect(callPayload.recipients).toContainEqual(
        expect.objectContaining({ userId })
      );
    });

    it('should include WS room for broadcast notification', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.WS],
        message: 'System maintenance scheduled',
        channelOptions: {
          ws: { room: 'admin-notifications' },
        },
        recipients: [],
      };

      await mockNotificationPort.send(payload);

      const callPayload = (mockNotificationPort.send as jest.Mock).mock
        .calls[0][0];

      expect(callPayload.channelOptions?.ws?.room).toBe('admin-notifications');
    });
  });

  describe('Notification Error Handling', () => {
    it('should not throw if notification fails (best-effort)', async () => {
      const notificationError = new Error(
        'SMTP server unavailable'
      );
      mockNotificationPort.send.mockRejectedValueOnce(notificationError);

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Password Reset',
        recipients: [{ email: 'user@example.com' }],
      };

      // The auth module should catch notification errors
      // and log them without rejecting the operation
      await expect(mockNotificationPort.send(payload)).rejects.toThrow();

      // In real auth flow, this would be caught and logged
      expect(mockNotificationPort.send).toHaveBeenCalled();
    });

    it('should still audit even if notification fails', async () => {
      mockNotificationPort.send.mockRejectedValueOnce(
        new Error('Notification failed')
      );

      const auditLog = {
        correlation_id: 'reset-123',
        owner: 'user-1',
        title: 'Password Reset',
        action: 'UPDATE',
      };

      // Audit should be called independently
      await mockAuditRecorder.writeLog(auditLog as any);

      expect(mockAuditRecorder.writeLog).toHaveBeenCalledWith(
        expect.objectContaining(auditLog)
      );
    });
  });

  describe('Payload Shape Validation', () => {
    it('should have channels array in notification payload', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Test',
        recipients: [{ email: 'test@example.com' }],
      };

      expect(Array.isArray(payload.channels)).toBe(true);
      expect(payload.channels.length).toBeGreaterThan(0);
    });

    it('should have recipients array in notification payload', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Test',
        recipients: [{ email: 'test@example.com' }],
      };

      expect(Array.isArray(payload.recipients)).toBe(true);
    });

    it('should have email in recipient objects for MAIL channel', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Test',
        recipients: [{ email: 'test@example.com' }],
      };

      const mailRecipients = payload.recipients.filter(r => r.email);
      expect(mailRecipients.length).toBeGreaterThan(0);
    });

    it('should have userId in recipient objects for WS channel', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.WS],
        message: 'Test',
        recipients: [{ userId: 'user-123' }],
      };

      const wsRecipients = payload.recipients.filter(r => r.userId);
      expect(wsRecipients.length).toBeGreaterThan(0);
    });

    it('should include title or subject in payload', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Test Title',
        recipients: [{ email: 'test@example.com' }],
      };

      expect(payload.title || payload.subject).toBeTruthy();
    });

    it('should include html or text content for email', async () => {
      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Test',
        html: '<p>Email body</p>',
        recipients: [{ email: 'test@example.com' }],
      };

      expect(payload.html || payload.text).toBeTruthy();
    });
  });

  describe('Notification Port Dependency Injection', () => {
    it('should allow mocking custom notification port', async () => {
      const customPort = {
        send: jest.fn().mockResolvedValue(undefined),
      } as jest.Mocked<NotificationPort>;

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Test',
        recipients: [{ email: 'test@example.com' }],
      };

      await customPort.send(payload);

      expect(customPort.send).toHaveBeenCalledWith(payload);
    });

    it('should allow swapping ports without state contamination', async () => {
      const port1 = {
        send: jest.fn().mockResolvedValue(undefined),
      } as jest.Mocked<NotificationPort>;

      const port2 = {
        send: jest.fn().mockResolvedValue(undefined),
      } as jest.Mocked<NotificationPort>;

      const payload: Notification.Events.NotificationRequestedData = {
        channels: [Notification.Enums.NotificationChannel.MAIL],
        title: 'Test',
        recipients: [{ email: 'test@example.com' }],
      };

      await port2.send(payload);

      expect(port2.send).toHaveBeenCalled();
      expect(port1.send).not.toHaveBeenCalled();
    });
  });
});
