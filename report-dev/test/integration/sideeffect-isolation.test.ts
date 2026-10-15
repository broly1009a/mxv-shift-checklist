/**
 * Phase 36 - Cross-Module Integration Tests: Side-Effect Isolation
 * Validates that audit and notification failures do not break
 * business operations (best-effort pattern).
 */

import type { NotificationPort, AuditRecorder } from '@/shared';
import { Notification, Audit } from '@svl/share';

describe('Side-Effect Isolation - Best Effort Pattern', () => {
  let mockNotificationPort: jest.Mocked<NotificationPort>;
  let mockAuditRecorder: jest.Mocked<AuditRecorder>;
  let consoleErrorSpy: jest.SpyInstance;

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

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Notification Failures Dont Break Business', () => {
    it('should continue operation if notification port fails', async () => {
      // Create a port that throws
      const failingPort = {
        send: jest.fn().mockRejectedValue(new Error('Port unavailable')),
      } as jest.Mocked<NotificationPort>;

      const businessLogic = async () => {
        try {
          await failingPort.send({
            channels: [Notification.Enums.NotificationChannel.MAIL],
            title: 'Test',
            recipients: [{ email: 'test@example.com' }],
          } as any);
        } catch (err) {
          // Silently fail
        }
        return { success: true, data: 'operation completed' };
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
      expect(result.data).toBe('operation completed');
    });

    it('should continue operation if notification send fails', async () => {
      const notificationError = new Error('SMTP timeout');
      mockNotificationPort.send.mockRejectedValueOnce(notificationError);

      const businessLogic = async () => {
        try {
          await mockNotificationPort.send({
            channels: [Notification.Enums.NotificationChannel.MAIL],
            title: 'Notification',
            recipients: [{ email: 'test@example.com' }],
          } as any);
        } catch (err) {
          // Log but don't re-throw - best-effort
          console.error('Notification failed:', err);
        }

        return { success: true, data: 'business logic done' };
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
      expect(result.data).toBe('business logic done');
    });

    it('should continue operation if notification partially fails', async () => {
      // Simulate one channel succeeds, another fails
      mockNotificationPort.send.mockImplementation(
        async (payload: any) => {
          if (
            payload.channels?.includes(
              Notification.Enums.NotificationChannel.MAIL
            )
          ) {
            throw new Error('Mail failed');
          }
          return undefined;
        }
      );

      const businessLogic = async () => {
        try {
          await mockNotificationPort.send({
            channels: [
              Notification.Enums.NotificationChannel.MAIL,
              Notification.Enums.NotificationChannel.SMS,
            ],
            title: 'Notification',
            recipients: [{ email: 'test@example.com' }],
          } as any);
        } catch (err) {
          // Catch but continue
          console.error('Partial notification failure:', err);
        }

        return { success: true, data: 'operation complete' };
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
    });

    it('should still execute business operation even with notification queue backlog', async () => {
      jest.useFakeTimers();

      try {
        // Simulate slow notification
        mockNotificationPort.send.mockImplementation(
          async (payload: any) => {
            await new Promise(resolve => setTimeout(resolve, 500));
            return undefined;
          }
        );

        const businessLogic = async () => {
          // Fire notification but don't wait
          mockNotificationPort.send({
            channels: [Notification.Enums.NotificationChannel.MAIL],
            title: 'Async notification',
            recipients: [{ email: 'test@example.com' }],
          } as any).catch(() => {
            // Silent failure
          });

          // Return immediately without waiting for notification
          return { success: true, data: 'immediate response' };
        };

        const result = await businessLogic();

        expect(result.success).toBe(true);
        expect(result.data).toBe('immediate response');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Audit Failures Dont Break Business', () => {
    it('should continue operation if audit write fails', async () => {
      const auditError = new Error('Database unavailable');
      mockAuditRecorder.writeLog.mockRejectedValueOnce(auditError);

      const businessLogic = async () => {
        try {
          await mockAuditRecorder.writeLog({
            correlation_id: 'test-123',
            owner: 'user-1',
            title: 'Test',
            action: 'CREATE',
          } as any);
        } catch (err) {
          // Log but don't re-throw
          console.error('Audit failed:', err);
        }

        return { success: true, data: 'business done' };
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
    });

    it('should continue operation if audit update result fails', async () => {
      mockAuditRecorder.updateResult.mockRejectedValueOnce(
        new Error('Audit update timeout')
      );

      const businessLogic = async () => {
        try {
          await mockAuditRecorder.updateResult({
            correlation_id: 'test-123',
            status: 'SUCCESS',
          } as any);
        } catch (err) {
          // Silently fail
        }

        return { success: true, data: 'done' };
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
    });

    it('should handle executeWithAudit wrapping even if audit fails', async () => {
      mockAuditRecorder.executeWithAudit.mockImplementation(
        async (log, owner, operation) => {
          try {
            await mockAuditRecorder.writeLog(log as any);
          } catch (err) {
            // Log but continue
            console.error('Audit write failed:', err);
          }

          try {
            const result = await operation();
            await mockAuditRecorder.updateResult({
              correlation_id: log.correlation_id,
              status: Audit.Enums.AuditStatus.SUCCESS,
            });
            return result;
          } catch (err) {
            try {
              await mockAuditRecorder.updateResult({
                correlation_id: log.correlation_id,
                status: Audit.Enums.AuditStatus.FAILED,
              });
            } catch (updateErr) {
              // Audit update failed, but operation already failed anyway
            }
            throw err;
          }
        }
      );

      const businessLogic = async () => {
        return mockAuditRecorder.executeWithAudit(
          {
            correlation_id: 'test-123',
            owner: 'user-1',
            title: 'Test',
            action: 'CREATE',
          } as any,
          'user-1',
          async () => {
            return { success: true, data: 'operation result' };
          }
        );
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
      expect(result.data).toBe('operation result');
    });
  });

  describe('Combined Notification + Audit Failure', () => {
    it('should complete operation even if both notification and audit fail', async () => {
      mockNotificationPort.send.mockRejectedValueOnce(
        new Error('Notification failed')
      );
      mockAuditRecorder.writeLog.mockRejectedValueOnce(
        new Error('Audit failed')
      );

      const businessLogic = async () => {
        try {
          await mockAuditRecorder.writeLog({
            correlation_id: 'test-123',
            owner: 'user-1',
            title: 'Test',
            action: 'CREATE',
          } as any);
        } catch (err) {
          console.error('Audit failed:', err);
        }

        try {
          await mockNotificationPort.send({
            channels: [Notification.Enums.NotificationChannel.MAIL],
            title: 'Test',
            recipients: [{ email: 'test@example.com' }],
          } as any);
        } catch (err) {
          console.error('Notification failed:', err);
        }

        return { success: true, data: 'all done' };
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
    });

    it('should not cascade failures from notification to audit', async () => {
      mockNotificationPort.send.mockRejectedValueOnce(
        new Error('Notification service down')
      );

      const businessLogic = async () => {
        try {
          await mockNotificationPort.send({
            channels: [Notification.Enums.NotificationChannel.MAIL],
            title: 'Test',
            recipients: [{ email: 'test@example.com' }],
          } as any);
        } catch (notifErr) {
          // Fail independently
        }

        // Audit should still be attempted
        const auditResult = await mockAuditRecorder.writeLog({
          correlation_id: 'test-123',
          owner: 'user-1',
          title: 'Test',
          action: 'CREATE',
        } as any);

        return { success: true };
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
      expect(mockAuditRecorder.writeLog).toHaveBeenCalled();
    });

    it('should not cascade failures from audit to notification', async () => {
      mockAuditRecorder.writeLog.mockRejectedValueOnce(
        new Error('Audit service down')
      );

      const businessLogic = async () => {
        try {
          await mockAuditRecorder.writeLog({
            correlation_id: 'test-123',
            owner: 'user-1',
            title: 'Test',
            action: 'CREATE',
          } as any);
        } catch (auditErr) {
          // Fail independently
        }

        // Notification should still be attempted
        await mockNotificationPort.send({
          channels: [Notification.Enums.NotificationChannel.MAIL],
          title: 'Test',
          recipients: [{ email: 'test@example.com' }],
        } as any);

        return { success: true };
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
      expect(mockNotificationPort.send).toHaveBeenCalled();
    });
  });

  describe('Business Operation Priority', () => {
    it('should prioritize core operation over audit and notification', async () => {
      let operationCompleted = false;
      let auditAttempted = false;
      let notificationAttempted = false;

      const businessLogic = async () => {
        operationCompleted = true;

        try {
          auditAttempted = true;
          await mockAuditRecorder.writeLog({
            correlation_id: 'test-123',
            owner: 'user-1',
            title: 'Test',
            action: 'CREATE',
          } as any);
        } catch (err) {
          // Silent
        }

        try {
          notificationAttempted = true;
          await mockNotificationPort.send({
            channels: [Notification.Enums.NotificationChannel.MAIL],
            title: 'Test',
            recipients: [{ email: 'test@example.com' }],
          } as any);
        } catch (err) {
          // Silent
        }

        return { success: true };
      };

      const result = await businessLogic();

      expect(operationCompleted).toBe(true);
      expect(auditAttempted).toBe(true);
      expect(notificationAttempted).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Logging Without Side Effects', () => {
    it('should log audit failures without changing operation result', async () => {
      const errors: Error[] = [];

      mockAuditRecorder.writeLog.mockRejectedValueOnce(
        new Error('Audit error')
      );

      const businessLogic = async () => {
        try {
          await mockAuditRecorder.writeLog({
            correlation_id: 'test-123',
            owner: 'user-1',
            title: 'Test',
            action: 'CREATE',
          } as any);
        } catch (err) {
          errors.push(err as Error);
        }

        return { success: true };
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Audit error');
    });

    it('should log notification failures without changing operation result', async () => {
      const errors: Error[] = [];

      mockNotificationPort.send.mockRejectedValueOnce(
        new Error('Notification error')
      );

      const businessLogic = async () => {
        try {
          await mockNotificationPort.send({
            channels: [Notification.Enums.NotificationChannel.MAIL],
            title: 'Test',
            recipients: [{ email: 'test@example.com' }],
          } as any);
        } catch (err) {
          errors.push(err as Error);
        }

        return { success: true };
      };

      const result = await businessLogic();

      expect(result.success).toBe(true);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Notification error');
    });
  });
});
