process.env.NODE_ENV = 'test';
process.env.SERVICE_NAME = 'test_service';
// We set MONGO_URI dynamically before requiring modules

import { MongoMemoryServer } from 'mongodb-memory-server';

describe('Audit DB Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let mongoConnector: any;
  let auditLogic: any;
  let AuditLogModel: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri();

    // Requires must happen AFTER MONGO_URI is set because MongoConnector connects synchronously on module load
    mongoConnector = require('../../src/mongo/mongoConnector').mongoConnector;
    auditLogic = require('../../src/modules/audit/services/audit-log.service');
    AuditLogModel = require('../../src/modules/audit/models/audit-log.model').AuditLogModel;

    // Wait for Mongoose to actually connect
    await mongoConnector.db.asPromise();
  });

  afterAll(async () => {
    if (mongoConnector) {
      await mongoConnector.db.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    if (AuditLogModel) {
      await AuditLogModel.deleteMany({});
    }
  });

  it('should write an audit log to the database and retrieve it', async () => {
    const mockMessage = {
      correlation_id: 'corr-123',
      owner: 'user1',
      time: new Date().toISOString(),
      title: 'Test Audit',
      content: 'This is a test audit log',
      action: 1, // AuditAction.CREATE or equivalent number (usually 1 or 0) - wait I will use require('@svl/share').Audit.Enums.AuditAction.CREATE
    };

    const AuditAction = require('@svl/share').Audit.Enums.AuditAction;
    mockMessage.action = AuditAction.CREATE;

    await auditLogic.writeLog(mockMessage, 'test-sender');

    // Verify it was written using Mongoose model directly
    const savedLog = await AuditLogModel.findOne({ correlation_id: 'corr-123' });
    expect(savedLog).toBeDefined();
    expect(savedLog.title).toBe('Test Audit');
    
    // Verify using getAuditLogDetail
    const detail = await auditLogic.getAuditLogDetail(savedLog._id.toString());
    expect(detail.correlation_id).toBe('corr-123');
    expect(detail.sender).toBe('test-sender');
  });

  it('should be idempotent and not create duplicates for the same correlation_id', async () => {
    const AuditAction = require('@svl/share').Audit.Enums.AuditAction;
    const mockMessage = {
      correlation_id: 'corr-dup-123',
      owner: 'user2',
      time: new Date().toISOString(),
      title: 'Duplicate Test',
      content: 'Testing idempotency',
      action: AuditAction.UPDATE,
    };

    // Write first time
    await auditLogic.writeLog(mockMessage, 'test-sender-1');
    
    // Write second time (simulate duplicate message delivery)
    await auditLogic.writeLog(
      { ...mockMessage, content: 'Updated content but same corr id' },
      'test-sender-2'
    );

    // Verify only one document exists
    const count = await AuditLogModel.countDocuments({ correlation_id: 'corr-dup-123' });
    expect(count).toBe(1);

    // Verify the document was updated with the latest upsert fields
    const doc = await AuditLogModel.findOne({ correlation_id: 'corr-dup-123' });
    expect(doc.content).toBe('Updated content but same corr id');
    expect(doc.sender).toBe('test-sender-2');
  });
});
