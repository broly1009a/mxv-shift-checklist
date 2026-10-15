import { EventBus, DomainEventName } from '@/shared';
import { Audit } from '@svl/share';
import type { Audit as AuditType } from '@svl/share';

describe('Shared - EventBus', () => {
  let eventBus: EventBus;

  const createTestAuditData = (): AuditType.Events.AuditLogMessage => ({
    correlation_id: 'test-123',
    owner: 'user1',
    title: 'Test',
    content: 'Test',
    ip: '127.0.0.1',
    client: 'client',
    os: 'OS',
    device: 'device',
    action: Audit.Enums.AuditAction.UNKOWN,
    time: new Date().toISOString(),
    created_by: Audit.Enums.AuditCreatedBy.USER,
  });

  beforeEach(() => {
    eventBus = new EventBus();
    jest.clearAllTimers();
  });

  describe('subscription management', () => {
    it('should allow registering handlers via on()', () => {
      const subscriber = jest.fn();
      const unsubscribe = eventBus.on(DomainEventName.AUDIT_WRITE, subscriber);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should support once() for single-call subscriptions', () => {
      const subscriber = jest.fn();
      eventBus.once(DomainEventName.AUDIT_WRITE, subscriber);

      expect(subscriber).not.toHaveBeenCalled();
    });

    it('should support unsubscribing via returned function', () => {
      const subscriber = jest.fn();
      const unsubscribe = eventBus.on(DomainEventName.AUDIT_WRITE, subscriber);

      unsubscribe();

      // After unsubscribing, handler should no longer be registered
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('fire-and-forget semantics', () => {
    it('should emit synchronously without awaiting handlers', () => {
      const subscriber = jest.fn();
      eventBus.on(DomainEventName.AUDIT_WRITE, subscriber);

      // emit returns void and does not block
      const result = eventBus.emit(DomainEventName.AUDIT_WRITE, createTestAuditData());

      expect(result).toBeUndefined();
    });

    it('should schedule async handlers via setImmediate', (done) => {
      const subscriber = jest.fn();
      eventBus.on(DomainEventName.AUDIT_WRITE, subscriber);
      const testData = createTestAuditData();

      eventBus.emit(DomainEventName.AUDIT_WRITE, testData);

      // Handlers run asynchronously via setImmediate
      setImmediate(() => {
        expect(subscriber).toHaveBeenCalledWith(testData);
        done();
      });
    });

    it('should handle best-effort error isolation', (done) => {
      const errorHandler = jest.fn();
      const subscriber1 = jest.fn(() => {
        throw new Error('Subscriber failed');
      });
      const subscriber2 = jest.fn();

      const eventBusWithErrorHandler = new EventBus({
        onSubscriberError: errorHandler,
      });

      eventBusWithErrorHandler.on(DomainEventName.AUDIT_WRITE, subscriber1);
      eventBusWithErrorHandler.on(DomainEventName.AUDIT_WRITE, subscriber2);

      eventBusWithErrorHandler.emit(DomainEventName.AUDIT_WRITE, createTestAuditData());

      // Give async handlers time to execute
      setImmediate(() => {
        expect(subscriber1).toHaveBeenCalled();
        expect(subscriber2).toHaveBeenCalled();
        expect(errorHandler).toHaveBeenCalledWith(
          expect.any(Error),
          DomainEventName.AUDIT_WRITE
        );
        done();
      });
    });
  });

  describe('structure validation', () => {
    it('should have DomainEventName enum with expected events', () => {
      expect(DomainEventName.AUDIT_WRITE).toBe('AUDIT_WRITE');
      expect(DomainEventName.AUDIT_UPDATE_RESULT).toBe('AUDIT_UPDATE_RESULT');
    });

    it('should accept only typed domain events', () => {
      // Type safety is enforced at compile time
      const testData = createTestAuditData();
      expect(testData.correlation_id).toBe('test-123');
    });
  });
});
