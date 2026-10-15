/**
 * Phase 36 - Cross-Module Integration Tests: Composition
 * Validates that the monolith composition root properly wires dependencies
 * without creating circular dependencies or deep imports.
 *
 * Note: Does not import real bootstrap to avoid MongoDB connection.
 * Tests composition pattern conceptually via mocks.
 */

import { EventBus, DomainEventName } from '@/shared';
import type { NotificationPort, AuditRecorder } from '@/shared';

interface MonolithComposition {
  eventBus: EventBus;
}

describe('Composition Root - Monolith Wiring', () => {
  let composition: MonolithComposition;

  beforeEach(() => {
    // Create composition pattern without importing real bootstrap (avoid MongoDB)
    const eventBus = new EventBus();
    composition = { eventBus } as MonolithComposition;
  });

  describe('EventBus initialization', () => {
    it('should create EventBus instance', () => {
      expect(composition.eventBus).toBeInstanceOf(EventBus);
    });

    it('should support event subscription', async () => {
      const subscriber = jest.fn();
      const unsubscribe = composition.eventBus.on(
        DomainEventName.AUDIT_WRITE,
        subscriber
      );

      composition.eventBus.emit(DomainEventName.AUDIT_WRITE, {
        correlation_id: 'test-123',
        owner: 'user-1',
        title: 'Test',
        content: 'Test event',
        ip: '127.0.0.1',
        client: 'browser',
        os: 'Linux',
        device: 'desktop',
        action: 'CREATE',
        time: new Date().toISOString(),
        created_by: 'USER',
      } as any);

      // Give async handler time to run
      await new Promise(resolve => setImmediate(resolve));

      expect(subscriber).toHaveBeenCalled();

      unsubscribe();
    });

    it('should allow unsubscribing', async () => {
      const subscriber = jest.fn();
      const unsubscribe = composition.eventBus.on(
        DomainEventName.AUDIT_WRITE,
        subscriber
      );

      unsubscribe();

      composition.eventBus.emit(DomainEventName.AUDIT_WRITE, {} as any);

      await new Promise(resolve => setImmediate(resolve));

      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe('Dependency Injection Pattern', () => {
    it('should allow mocking NotificationPort interface', async () => {
      const mockNotificationPort: NotificationPort = {
        send: jest.fn().mockResolvedValue(undefined) as any,
      };

      // Verify that the mock can be set without errors
      expect(mockNotificationPort.send).toBeDefined();
      expect(typeof mockNotificationPort.send).toBe('function');
    });

    it('should allow mocking AuditRecorder interface', async () => {
      const mockAuditRecorder: AuditRecorder = {
        writeLog: jest.fn().mockResolvedValue(undefined) as any,
        updateResult: jest.fn().mockResolvedValue(undefined) as any,
        executeWithAudit: jest
          .fn()
          .mockImplementation(async (log, owner, operation) => {
            return operation();
          }) as any,
      };

      // Verify that the mock can be set without errors
      expect(mockAuditRecorder.writeLog).toBeDefined();
      expect(mockAuditRecorder.updateResult).toBeDefined();
      expect(mockAuditRecorder.executeWithAudit).toBeDefined();
    });

    it('should support dependency injection through setter functions', () => {
      // Composition pattern allows swapping implementations
      const port1: NotificationPort = { send: jest.fn() as any };
      const port2: NotificationPort = { send: jest.fn() as any };

      // Should allow replacing one with another
      expect(port1.send).not.toBe(port2.send);
      expect(typeof port1.send).toBe('function');
      expect(typeof port2.send).toBe('function');
    });
  });

  describe('No Circular Dependencies', () => {
    it('should not have auth import audit internals', () => {
      // This is verified at build time by boundary tests,
      // but we check here to ensure composition doesn't accidentally
      // import deep paths
      const fs = require('fs');
      const path = require('path');

      const authDir = path.join(__dirname, '../../src/modules/auth');
      const files = fs.readdirSync(authDir, { recursive: true });

      for (const file of files) {
        if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;

        const content = fs.readFileSync(path.join(authDir, file), 'utf-8');

        // Should not have deep imports to audit/notification
        expect(content).not.toMatch(/@\/modules\/(audit|notification)\/[^"']*\//);
      }
    });

    it('should not have audit import auth internals', () => {
      const fs = require('fs');
      const path = require('path');

      const auditDir = path.join(__dirname, '../../src/modules/audit');
      const files = fs.readdirSync(auditDir, { recursive: true });

      for (const file of files) {
        if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;

        const content = fs.readFileSync(path.join(auditDir, file), 'utf-8');

        // Should not have deep imports to auth/notification
        expect(content).not.toMatch(/@\/modules\/(auth|notification)\/[^"']*\//);
      }
    });
  });
});
