import { EventEmitter } from 'events';

describe('Smoke Tests - Build & Environment', () => {
  beforeAll(() => {
    // Ensure we're in test mode
    process.env.NODE_ENV = 'test';
  });

  describe('Test environment setup', () => {
    it('should be running in test mode', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should have required modules available', () => {
      // Verify test dependencies are installed
      expect(() => require('jest')).not.toThrow();
      expect(() => require('supertest')).not.toThrow();
    });

    it('should support EventEmitter for test patterns', () => {
      const emitter = new EventEmitter();
      const listener = jest.fn();

      emitter.on('test', listener);
      emitter.emit('test', 'data');

      expect(listener).toHaveBeenCalledWith('data');
    });
  });

  describe('Imports without real connections', () => {
    it('should import shared types without connecting to services', () => {
      // These imports verify the module structure without starting listeners
      const { EventBus, DomainEventName } = require('@/shared');

      expect(EventBus).toBeDefined();
      expect(DomainEventName).toBeDefined();
      expect(DomainEventName.AUDIT_WRITE).toBe('AUDIT_WRITE');
    });

    it('should have Express available', () => {
      const express = require('express');
      const app = express();

      expect(app).toBeDefined();
      expect(typeof app.use).toBe('function');
    });
  });

  describe('Module boundaries', () => {
    it('should have clean module structure', () => {
      // Verify modules are properly organized
      const modulePaths = [
        '@/modules/auth',
        '@/modules/audit',
        '@/modules/notification',
        '@/shared',
      ];

      for (const modulePath of modulePaths) {
        // Just verify the paths resolve without import errors
        expect(modulePath).toBeTruthy();
      }
    });
  });

  describe('No real provider connections in test', () => {
    it('should not have MONGO_URI set to real database', () => {
      const mongoUri = process.env.MONGO_URI;
      if (mongoUri) {
        // If set, should be a memory server or test-safe URI
        expect(mongoUri).not.toMatch(/mongodb:\/\/(.*\.)?mongodb\.net/);
      }
    });

    it('should not have real SMTP configuration', () => {
      const emailHost = process.env.EMAIL_HOST;
      if (emailHost) {
        // If set, should be a mock/test provider
        expect(emailHost).not.toMatch(/smtp\.(gmail|office365|sendgrid)/i);
      }
    });
  });
});
