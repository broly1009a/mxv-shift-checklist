import jwt from 'jsonwebtoken';
import { Identity } from '@svl/share';
import type { NotificationPort, AuditRecorder } from '@/shared';

/** In-memory Redis mock database */
class MockRedisAdapter {
  private store = new Map<string, any>();

  async get<T = any>(key: string): Promise<T | null> {
    const val = this.store.get(key);
    return val === undefined ? null : val;
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  async setDebounce(key: string, value: any, _ttl: number): Promise<void> {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async scanAllKeys(pattern: string): Promise<string[]> {
    return Array.from(this.store.keys()).filter(k => k.includes(pattern));
  }

  async incrWithExpire(key: string, _ttlSeconds: number): Promise<number> {
    const current = this.store.get(key) || 0;
    const next = current + 1;
    this.store.set(key, next);
    return next;
  }

  async refreshTTL(_key: string, _ttlSeconds: number): Promise<void> {
    // No-op for mock
  }

  clear() {
    this.store.clear();
  }
}

export const mockAuthDB = new MockRedisAdapter();
export const mockCacheDB = new MockRedisAdapter();

/** Mock Mongoose user document with minimal interface */
export class MockUserDoc {
  _id = new Date().getTime().toString();
  username: string;
  email: string;
  password: string;
  PIN: string;
  fullname: string;
  phoneNumber: string;
  createdBy: string;
  role: string[];
  groupRole: any[];
  numLoginFail: number = 0;
  lastLoginAt?: number;
  requireChangePassword: boolean = false;
  requirePIN: boolean = true;
  type: Identity.Enums.UserType = Identity.Enums.UserType.USER;
  status: Identity.Enums.UserStatus = Identity.Enums.UserStatus.ACTIVE;
  department?: any;
  avatar?: string;
  lastModifiedBy?: string;
  note?: string;
  joinDepartmentTime?: number;
  createdAt = new Date();
  updatedAt = new Date();

  constructor(props?: Partial<MockUserDoc>) {
    Object.assign(this, props);
  }

  async save() {
    // Simulate password/PIN hashing that happens in pre-save hook
    // For testing, we just return self
    return this;
  }

  populate(path: string, select?: string): this {
    // For testing, return self to support chaining
    if (path === 'department') {
      this.department = { code: 'DEPT01', name: 'Department', status: 'ACTIVE' };
    }
    return this;
  }

  lean(): this {
    return this;
  }

  toJSON() {
    return { ...this };
  }
}

/** Mock Mongoose GroupRole document */
export class MockGroupRoleDoc {
  _id = new Date().getTime().toString();
  name: string;
  description?: string;
  role: string[];
  status: Identity.Enums.GroupRoleStatus = Identity.Enums.GroupRoleStatus.ACTIVE;
  createdBy: string;
  lastModifiedBy?: string;
  createdAt = new Date();
  updatedAt = new Date();

  constructor(props?: Partial<MockGroupRoleDoc>) {
    Object.assign(this, props);
  }

  async save() {
    return this;
  }

  lean() {
    return this;
  }
}

/** Mock UserModel - static methods only */
export class MockUserModel {
  static _users = new Map<string, MockUserDoc>();
  static _nextId = 1;

  static async findOne(filter: any) {
    for (const user of this._users.values()) {
      if (filter.username && user.username === filter.username) {
        return user;
      }
    }
    return null;
  }

  static async findById(id: string) {
    return this._users.get(id) || null;
  }

  static async create(data: any) {
    const user = new MockUserDoc(data);
    this._users.set(user._id, user);
    return user;
  }

  static async deleteMany() {
    this._users.clear();
  }

  static clear() {
    this._users.clear();
    this._nextId = 1;
  }
}

/** Mock GroupRoleModel - static methods only */
export class MockGroupRoleModel {
  static _roles = new Map<string, MockGroupRoleDoc>();

  static async find(filter: any) {
    const results: MockGroupRoleDoc[] = [];
    for (const role of this._roles.values()) {
      if (filter.status && role.status !== filter.status) continue;
      if (filter._id?.$in) {
        const ids = filter._id.$in;
        if (!ids.some((id: any) => id.toString && id.toString() === role._id)) {
          continue;
        }
      }
      results.push(role);
    }
    return results;
  }

  static async deleteMany() {
    this._roles.clear();
  }

  static clear() {
    this._roles.clear();
  }

  static addRole(role: MockGroupRoleDoc) {
    this._roles.set(role._id, role);
  }
}

/** Notification port collector mock */
export function createMockNotificationPort(): NotificationPort & { _notifications: any[] } {
  const notifications: any[] = [];
  return {
    send: async (data) => {
      notifications.push(data);
    },
    _notifications: notifications,
  } as any;
}

/** Audit recorder collector mock */
export function createMockAuditRecorder(): AuditRecorder & { _logs: any[] } {
  const logs: any[] = [];
  return {
    writeLog: async (log) => {
      logs.push({ type: 'write', log });
    },
    updateResult: async (correlationId, status) => {
      logs.push({ type: 'update', correlationId, status });
    },
    executeWithAudit: async <T>(
      log: any,
      owner: string,
      operation: () => Promise<T>
    ): Promise<T> => {
      logs.push({ type: 'audit', log, owner });
      return operation();
    },
    _logs: logs,
  } as any;
}

export function generateTestJwt(payload?: any, expiresIn?: string) {
  const defaults = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    session: 'test-session-hash',
    verifyPIN: false,
    type: Identity.Enums.UserType.USER,
  };

  const data = { ...defaults, ...payload };
  return jwt.sign(data, process.env.JWT_KEY as string, { expiresIn });
}
