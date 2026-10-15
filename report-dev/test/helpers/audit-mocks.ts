import { Audit } from '@svl/share';

/**
 * Mock AuditLogModel for testing without MongoDB connection
 */
export class MockAuditLogModel {
  static _logs = new Map<string, any>();

  static updateOne = jest.fn(async function(
    this: any,
    filter: any,
    update: any,
    options?: any
  ) {
    const correlationId = filter.correlation_id;
    if (!correlationId) throw new Error('correlation_id required');

    const existing = MockAuditLogModel._logs.get(correlationId);

    if (options?.upsert) {
      if (!existing) {
        // Insert with $setOnInsert values
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
      } else {
        // Update existing
        Object.assign(existing, update.$set);
        existing.updatedAt = new Date();
        MockAuditLogModel._logs.set(correlationId, existing);
        return { modifiedCount: 1 };
      }
    }

    if (!existing) throw new Error('Document not found');

    Object.assign(existing, update.$set);
    existing.updatedAt = new Date();
    return { modifiedCount: 1 };
  })

  static async updateMany(filter: any, update: any) {
    let count = 0;
    for (const [key, doc] of this._logs) {
      if (this._matches(doc, filter)) {
        Object.assign(doc, update.$set);
        doc.updatedAt = new Date();
        count++;
      }
    }
    return { modifiedCount: count };
  }

  static async countDocuments(filter: any = {}) {
    let count = 0;
    for (const doc of this._logs.values()) {
      if (this._matches(doc, filter)) count++;
    }
    return count;
  }

  static async aggregate(pipeline: any[]) {
    // Simplified aggregation mock: just return logs matching first $match stage
    let results = Array.from(this._logs.values());

    for (const stage of pipeline) {
      if (stage.$match) {
        results = results.filter(doc => this._matches(doc, stage.$match));
      }
      if (stage.$skip) {
        results = results.slice(stage.$skip);
      }
      if (stage.$limit) {
        results = results.slice(0, stage.$limit);
      }
    }

    return results;
  }

  private static _matches(doc: any, filter: any): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null) {
        // Handle $gte, $lte, $text, etc.
        if (value === Object(value)) {
          if ('$gte' in value && (doc[key] ?? 0) < value.$gte) return false;
          if ('$lte' in value && (doc[key] ?? 0) > value.$lte) return false;
          if ('$text' in value) {
            // Simple substring match
            const searchStr = ((value as any).$text?.$search ?? '').toLowerCase();
            const docStr = (doc.title + ' ' + doc.content).toLowerCase();
            if (!docStr.includes(searchStr)) return false;
          }
        }
      } else {
        if (doc[key] !== value) return false;
      }
    }
    return true;
  }

  static clear() {
    this._logs.clear();
  }

  static addLog(correlationId: string, data: any) {
    this._logs.set(correlationId, {
      _id: correlationId,
      correlation_id: correlationId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export function createMockLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
}
