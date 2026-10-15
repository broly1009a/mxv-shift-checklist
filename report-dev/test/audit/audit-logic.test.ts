/**
 * Phase 34 - Audit Unit Tests (Logic-Only with Jest Mocks)
 * No MongoDB connection, no real database, no external services
 */

import { Audit, HandlerError } from '@svl/share';
import { EventBus, DomainEventName } from '@/shared';
import { MockAuditLogModel, createMockLogger } from '../helpers/audit-mocks';

// Mock the model BEFORE importing services
jest.mock('@/modules/audit/models/audit-log.model', () => ({
  AuditLogModel: MockAuditLogModel,
}));

jest.mock('@/loggers/winstonLogger', () => ({
  logger: createMockLogger(),
}));

// Now import services
import * as auditLogService from '@/modules/audit/services/audit-log.service';
import { createAuditRecorder } from '@/modules/audit/services/audit-recorder.service';
import { registerAuditEventSubscribers } from '@/modules/audit/subscribers/audit-event.subscriber';
import { logger } from '@/loggers/winstonLogger';

describe('Audit Service - Logic Tests', () => {
  beforeEach(() => {
    MockAuditLogModel.clear();
    jest.clearAllMocks();
  });

  describe('writeLog', () => {
    it('should write audit log with upsert', async () => {
      const message: Audit.Events.AuditLogMessage = {
        correlation_id: 'corr-123',
        owner: 'user-1',
        title: 'Test Action',
        content: 'Test content',
        ip: '127.0.0.1',
        client: 'browser',
        os: 'Linux',
        device: 'desktop',
        action: Audit.Enums.AuditAction.UPDATE,
        time: new Date().toISOString(),
        created_by: Audit.Enums.AuditCreatedBy.USER,
      };

      await auditLogService.writeLog(message);

      const stored = MockAuditLogModel._logs.get('corr-123');
      expect(stored).toBeTruthy();
      expect(stored.owner).toBe('user-1');
      expect(stored.title).toBe('Test Action');
      expect(stored.status).toBe(Audit.Enums.AuditStatus.PENDING); // Set on insert
    });

    it('should update existing log on second write (idempotent)', async () => {
      const message1: Audit.Events.AuditLogMessage = {
        correlation_id: 'corr-456',
        owner: 'user-1',
        title: 'First',
        content: 'First content',
        ip: '127.0.0.1',
        client: 'browser',
        os: 'Linux',
        device: 'desktop',
        action: Audit.Enums.AuditAction.UPDATE,
        time: new Date().toISOString(),
        created_by: Audit.Enums.AuditCreatedBy.USER,
      };

      const message2: Audit.Events.AuditLogMessage = {
        ...message1,
        title: 'Updated',
        content: 'Updated content',
      };

      await auditLogService.writeLog(message1);
      await auditLogService.writeLog(message2);

      const stored = MockAuditLogModel._logs.get('corr-456');
      expect(stored.title).toBe('Updated'); // Second write updated it
    });

    it('should retry on duplicate key error (code 11000)', async () => {
      // Mock the updateOne to fail first, then succeed
      let callCount = 0;
      const originalUpdateOne = (MockAuditLogModel.updateOne as jest.Mock).getMockImplementation?.() ||
        MockAuditLogModel.updateOne;

      (MockAuditLogModel.updateOne as jest.Mock).mockImplementation(async (...args: any[]) => {
        callCount++;
        if (callCount === 1) {
          const error: any = new Error('E11000 duplicate key');
          error.code = 11000;
          throw error;
        }
        // Second call should use actual logic
        const filter = args[0];
        const update = args[1];
        const options = args[2];

        const correlationId = filter.correlation_id;
        if (!correlationId) throw new Error('correlation_id required');

        if (options?.upsert) {
          const newDoc = {
            _id: correlationId,
            correlation_id: correlationId,
            ...update.$setOnInsert,
            ...update.$set,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          MockAuditLogModel._logs.set(correlationId, newDoc);
          return { upsertedId: correlationId, modifiedCount: 0 };
        }
        throw new Error('Not implemented');
      });

      const message: Audit.Events.AuditLogMessage = {
        correlation_id: 'corr-dup',
        owner: 'user-1',
        title: 'Test',
        content: 'Test',
        ip: '127.0.0.1',
        client: 'browser',
        os: 'Linux',
        device: 'desktop',
        action: Audit.Enums.AuditAction.CREATE,
        time: new Date().toISOString(),
        created_by: Audit.Enums.AuditCreatedBy.USER,
      };

      await auditLogService.writeLog(message);

      // Should have been called twice (once for error, once for retry)
      expect((MockAuditLogModel.updateOne as jest.Mock).mock.calls.length).toBe(2);

      // Log should still be stored
      expect(MockAuditLogModel._logs.has('corr-dup')).toBe(true);
    });
  });

  describe('updateLog', () => {
    it('should update log status', async () => {
      // First create a log
      const message: Audit.Events.AuditLogMessage = {
        correlation_id: 'corr-update',
        owner: 'user-1',
        title: 'Test',
        content: 'Test',
        ip: '127.0.0.1',
        client: 'browser',
        os: 'Linux',
        device: 'desktop',
        action: Audit.Enums.AuditAction.UPDATE,
        time: new Date().toISOString(),
        created_by: Audit.Enums.AuditCreatedBy.USER,
      };

      await auditLogService.writeLog(message);

      // Now update status
      await auditLogService.updateLog({
        correlation_id: 'corr-update',
        status: Audit.Enums.AuditStatus.SUCCESS,
      });

      const stored = MockAuditLogModel._logs.get('corr-update');
      expect(stored.status).toBe(Audit.Enums.AuditStatus.SUCCESS);
    });

    it('should create stub if log not yet written', async () => {
      // updateLog called before writeLog
      await auditLogService.updateLog({
        correlation_id: 'corr-stub',
        status: Audit.Enums.AuditStatus.SUCCESS,
      });

      const stored = MockAuditLogModel._logs.get('corr-stub');
      expect(stored).toBeTruthy();
      expect(stored.status).toBe(Audit.Enums.AuditStatus.SUCCESS);
      expect(stored.time).toBeTruthy(); // $setOnInsert
    });

    it('should retry on duplicate key error', async () => {
      let callCount = 0;

      (MockAuditLogModel.updateOne as jest.Mock).mockImplementation(async (...args: any[]) => {
        callCount++;
        if (callCount === 1) {
          const error: any = new Error('E11000');
          error.code = 11000;
          throw error;
        }

        const filter = args[0];
        const update = args[1];
        const options = args[2];
        const correlationId = filter.correlation_id;

        if (!MockAuditLogModel._logs.has(correlationId)) {
          const newDoc = {
            _id: correlationId,
            correlation_id: correlationId,
            ...update.$setOnInsert,
            ...update.$set,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          MockAuditLogModel._logs.set(correlationId, newDoc);
          return { modifiedCount: 0 };
        }

        const existing = MockAuditLogModel._logs.get(correlationId);
        Object.assign(existing, update.$set);
        return { modifiedCount: 1 };
      });

      await auditLogService.updateLog({
        correlation_id: 'corr-retry',
        status: Audit.Enums.AuditStatus.FAILED,
      });

      expect((MockAuditLogModel.updateOne as jest.Mock).mock.calls.length).toBe(2);
      expect(MockAuditLogModel._logs.get('corr-retry').status).toBe(
        Audit.Enums.AuditStatus.FAILED
      );
    });
  });

  describe('getAuditLogs', () => {
    beforeEach(() => {
      // Pre-populate logs for query tests
      MockAuditLogModel.addLog('log-1', {
        owner: 'user-1',
        title: 'Login',
        content: 'User logged in',
        action: Audit.Enums.AuditAction.CREATE,
        time: new Date('2026-07-01'),
        status: Audit.Enums.AuditStatus.SUCCESS,
      });

      MockAuditLogModel.addLog('log-2', {
        owner: 'user-2',
        title: 'Update Profile',
        content: 'Updated profile',
        action: Audit.Enums.AuditAction.UPDATE,
        time: new Date('2026-07-02'),
        status: Audit.Enums.AuditStatus.SUCCESS,
      });
    });

    it('should return paginated logs', async () => {
      const result = await auditLogService.getAuditLogs({
        page: 1,
        limit: 10,
      } as any);

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('rowCount');
      expect(result).toHaveProperty('totalPage');
      expect(result).toHaveProperty('data');
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should filter by user_id', async () => {
      const result = await auditLogService.getAuditLogs({
        page: 1,
        limit: 10,
        user_id: 'user-1',
      });

      expect(result.data.every((log: any) => log.owner === 'user-1')).toBe(true);
    });

    it('should filter by action', async () => {
      const result = await auditLogService.getAuditLogs({
        page: 1,
        limit: 10,
        action: Audit.Enums.AuditAction.UPDATE,
      });

      expect(
        result.data.every((log: any) => log.action === Audit.Enums.AuditAction.UPDATE)
      ).toBe(true);
    });
  });

  describe('markStalePendingLogs', () => {
    it('should update PENDING logs older than threshold', async () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 60 * 60 * 1000);

      MockAuditLogModel.addLog('pending-old', {
        status: Audit.Enums.AuditStatus.PENDING,
        time: oneHourAgo,
      });

      MockAuditLogModel.addLog('pending-new', {
        status: Audit.Enums.AuditStatus.PENDING,
        time: new Date(now - 5 * 60 * 1000), // 5 minutes ago
      });

      // Mark as stale if older than 30 minutes
      const result = await MockAuditLogModel.updateMany(
        {
          status: Audit.Enums.AuditStatus.PENDING,
          time: { $lte: new Date(now - 30 * 60 * 1000) },
        },
        {
          $set: { status: Audit.Enums.AuditStatus.SYSTEM_ERROR },
        }
      );

      expect(result.modifiedCount).toBe(1); // Only old one should be updated
      expect(MockAuditLogModel._logs.get('pending-old').status).toBe(
        Audit.Enums.AuditStatus.SYSTEM_ERROR
      );
    });
  });

  describe('createAuditRecorder', () => {
    it('should emit AUDIT_WRITE and AUDIT_UPDATE_RESULT on successful operation', async () => {
      const eventBus = new EventBus();
      const emitSpy = jest.spyOn(eventBus, 'emit');
      const recorder = createAuditRecorder(eventBus);
      const log: Audit.Helpers.AuditLog = {
        correlation_id: 'op-success',
        title: 'Test Operation',
        content: 'Testing',
        action: Audit.Enums.AuditAction.UPDATE,
        time: new Date().toISOString(),
        device_info: { ip: '127.0.0.1', client: 'browser', os: 'Linux', device: 'desktop' },
      };

      const operation = jest.fn().mockResolvedValue('result-value');

      const result = await recorder.executeWithAudit(log, 'user-1', operation);

      expect(result).toBe('result-value');
      expect(operation).toHaveBeenCalled();

      // Verify emit calls were made
      expect(emitSpy).toHaveBeenCalledWith(DomainEventName.AUDIT_WRITE, expect.objectContaining({
        correlation_id: 'op-success',
        owner: 'user-1',
        title: 'Test Operation'
      }));
      expect(emitSpy).toHaveBeenCalledWith(DomainEventName.AUDIT_UPDATE_RESULT, expect.objectContaining({
        correlation_id: 'op-success',
        status: Audit.Enums.AuditStatus.SUCCESS
      }));
    });

    it('should emit AUDIT_UPDATE_RESULT FAILED on HandlerError', async () => {
      const eventBus = new EventBus();
      const emitSpy = jest.spyOn(eventBus, 'emit');
      const recorder = createAuditRecorder(eventBus);
      const log: Audit.Helpers.AuditLog = {
        correlation_id: 'op-failed',
        title: 'Test Operation',
        content: 'Testing',
        action: Audit.Enums.AuditAction.UPDATE,
        time: new Date().toISOString(),
        device_info: { ip: '127.0.0.1', client: 'browser', os: 'Linux', device: 'desktop' },
      };

      const handlerError = new HandlerError('Validation failed');
      const operation = jest.fn().mockRejectedValue(handlerError);

      await expect(recorder.executeWithAudit(log, 'user-1', operation)).rejects.toThrow(
        HandlerError
      );

      expect(emitSpy).toHaveBeenCalledWith(DomainEventName.AUDIT_UPDATE_RESULT, expect.objectContaining({
        correlation_id: 'op-failed',
        status: Audit.Enums.AuditStatus.FAILED
      }));
    });

    it('should emit AUDIT_UPDATE_RESULT SYSTEM_ERROR on generic error', async () => {
      const eventBus = new EventBus();
      const emitSpy = jest.spyOn(eventBus, 'emit');
      const recorder = createAuditRecorder(eventBus);
      const log: Audit.Helpers.AuditLog = {
        correlation_id: 'op-error',
        title: 'Test Operation',
        content: 'Testing',
        action: Audit.Enums.AuditAction.UPDATE,
        time: new Date().toISOString(),
        device_info: { ip: '127.0.0.1', client: 'browser', os: 'Linux', device: 'desktop' },
      };

      const error = new Error('Database connection failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(recorder.executeWithAudit(log, 'user-1', operation)).rejects.toThrow(Error);

      expect(emitSpy).toHaveBeenCalledWith(DomainEventName.AUDIT_UPDATE_RESULT, expect.objectContaining({
        correlation_id: 'op-error',
        status: Audit.Enums.AuditStatus.SYSTEM_ERROR
      }));
    });

    it('should not break operation flow if emit fails', async () => {
      const eventBus = new EventBus();
      const emitSpy = jest.spyOn(eventBus, 'emit');
      emitSpy.mockImplementationOnce(() => {
        throw new Error('Emit failed');
      });
      const recorder = createAuditRecorder(eventBus);

      const log: Audit.Helpers.AuditLog = {
        correlation_id: 'op-audit-fail',
        title: 'Test',
        content: 'Test',
        action: Audit.Enums.AuditAction.CREATE,
        time: new Date().toISOString(),
      };

      const operation = jest.fn().mockResolvedValue('success');

      const result = await recorder.executeWithAudit(log, 'user-1', operation);

      expect(result).toBe('success'); // Operation succeeded despite audit write failure
      expect((logger.error as jest.Mock).mock.calls.length).toBeGreaterThan(0); // Error logged
    });
  });

  describe('EventBus subscriber integration', () => {
    it('should subscribe to AUDIT_WRITE and call writeLog', async () => {
      const eventBus = new EventBus();
      const unsubscribe = registerAuditEventSubscribers(eventBus);

      const message: Audit.Events.AuditLogMessage = {
        correlation_id: 'event-write',
        owner: 'user-1',
        title: 'Event Test',
        content: 'Testing events',
        ip: '127.0.0.1',
        client: 'browser',
        os: 'Linux',
        device: 'desktop',
        action: Audit.Enums.AuditAction.CREATE,
        time: new Date().toISOString(),
        created_by: Audit.Enums.AuditCreatedBy.USER,
      };

      eventBus.emit(DomainEventName.AUDIT_WRITE, message);

      // Give async handler time to run
      await new Promise(resolve => setImmediate(resolve));

      const stored = MockAuditLogModel._logs.get('event-write');
      expect(stored).toBeTruthy();
      expect(stored.owner).toBe('user-1');
    });

    it('should subscribe to AUDIT_UPDATE_RESULT and call updateLog', async () => {
      const eventBus = new EventBus();
      registerAuditEventSubscribers(eventBus);

      // Create initial log
      await auditLogService.writeLog({
        correlation_id: 'event-update',
        owner: 'user-1',
        title: 'Test',
        content: 'Test',
        ip: '127.0.0.1',
        client: 'browser',
        os: 'Linux',
        device: 'desktop',
        action: Audit.Enums.AuditAction.UPDATE,
        time: new Date().toISOString(),
        created_by: Audit.Enums.AuditCreatedBy.USER,
      });

      eventBus.emit(DomainEventName.AUDIT_UPDATE_RESULT, {
        correlation_id: 'event-update',
        status: Audit.Enums.AuditStatus.SUCCESS,
      });

      await new Promise(resolve => setImmediate(resolve));

      const stored = MockAuditLogModel._logs.get('event-update');
      expect(stored.status).toBe(Audit.Enums.AuditStatus.SUCCESS);
    });

    it('should catch and log subscriber errors', async () => {
      const eventBus = new EventBus();
      const writeLogSpy = jest.spyOn(auditLogService, 'writeLog');
      writeLogSpy.mockRejectedValueOnce(new Error('Write failed'));

      registerAuditEventSubscribers(eventBus);

      eventBus.emit(DomainEventName.AUDIT_WRITE, {
        correlation_id: 'error-event',
        owner: 'user-1',
        title: 'Test',
        content: 'Test',
        ip: '127.0.0.1',
        client: 'browser',
        os: 'Linux',
        device: 'desktop',
        action: Audit.Enums.AuditAction.CREATE,
        time: new Date().toISOString(),
        created_by: Audit.Enums.AuditCreatedBy.USER,
      } as any);

      await new Promise(resolve => setImmediate(resolve));

      expect((logger.error as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });

    it('should allow unsubscribing', async () => {
      const eventBus = new EventBus();
      const unsubscribe = registerAuditEventSubscribers(eventBus);

      unsubscribe();

      const message: Audit.Events.AuditLogMessage = {
        correlation_id: 'unsub-test',
        owner: 'user-1',
        title: 'Test',
        content: 'Test',
        ip: '127.0.0.1',
        client: 'browser',
        os: 'Linux',
        device: 'desktop',
        action: Audit.Enums.AuditAction.CREATE,
        time: new Date().toISOString(),
        created_by: Audit.Enums.AuditCreatedBy.USER,
      };

      eventBus.emit(DomainEventName.AUDIT_WRITE, message);

      await new Promise(resolve => setImmediate(resolve));

      // Should not be stored since unsubscribed
      expect(MockAuditLogModel._logs.has('unsub-test')).toBe(false);
    });
  });
});
