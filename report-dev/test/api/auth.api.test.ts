process.env.NODE_ENV = 'test';
process.env.JWT_KEY = 'test_jwt_key';
process.env.SERVICE_NAME = 'test_service';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';

// (mongoose mock removed because we mock MongoConnector directly below)

const mockUserModel = {
  findOne: jest.fn(),
  findById: jest.fn(),
};
jest.mock('../../src/modules/auth/models/user.model', () => ({
  __esModule: true,
  default: mockUserModel
}));

const mockGroupRoleModel = {
  find: jest.fn(),
};
jest.mock('../../src/modules/auth/models/groupRole.model', () => ({
  __esModule: true,
  default: mockGroupRoleModel
}));

// Mock Redis / session fully
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
jest.mock('@mss/common', () => {
  return {
    ...jest.requireActual('@mss/common'),
    redisConnector: {
      getClient: () => ({
        get: mockRedisGet,
        set: mockRedisSet,
        call: jest.fn().mockImplementation((command, ...args) => {
          if (command === 'SCRIPT') {
            return Promise.resolve('mock-sha');
          }
          if (command === 'EVALSHA') {
            return Promise.resolve([1, 900000]);
          }
          if (command === 'DEL' || command === 'DECR') {
            return Promise.resolve(1);
          }
          return Promise.resolve();
        }),
      }),
      connect: jest.fn(),
    },
    MongoConnector: class {
      db: any;
      constructor() {
        this.db = {
          model: jest.fn().mockReturnValue({}),
          close: jest.fn(),
          on: jest.fn(),
          asPromise: jest.fn().mockResolvedValue(true),
        };
      }
    }
  };
});

const mockAuthDBGet = jest.fn();
const mockAuthDBSet = jest.fn();
const mockCacheDBGet = jest.fn();
const mockCacheDBSet = jest.fn();
jest.mock('../../src/modules/auth/utils/redis.util', () => ({
  authDB: {
    get: mockAuthDBGet,
    set: mockAuthDBSet,
  },
  cacheDB: {
    get: mockCacheDBGet,
    set: mockCacheDBSet,
    incrWithExpire: jest.fn().mockResolvedValue(1),
  }
}));

import request from 'supertest';
import { app } from '../../src/app';
import jwt from 'jsonwebtoken';

describe('API Integration Tests (Express App Boundary)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when accessing a protected route without Bearer token', async () => {
    const res = await request(app).put('/api/auth/reset-password/user1');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 403 when accessing a protected route without required permission', async () => {
    // Generate valid token
    const token = jwt.sign({ id: 'user1', session: 'sess123' }, 'test_jwt_key');
    
    // Mock the session validation in Redis (from @svl/share userSession.validate)
    // requireAuth uses userSession.validate which does redis get 'auth:session-user1'
    mockRedisGet.mockResolvedValueOnce(JSON.stringify({ 
      id: 'user1',
      session: 'sess123',
      userRoles: ['SOME_OTHER_ROLE'] // Lacks PASSWORD_RESET permission
    }));

    // mock for getRole call inside requireRole
    mockRedisGet.mockResolvedValueOnce(JSON.stringify({ 
      userRoles: ['SOME_OTHER_ROLE'] 
    }));

    const res = await request(app)
      .put('/api/auth/reset-password/user1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should correctly pass authRateLimiter on public routes', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // The authRateLimiter relies on RedisStore which is mocked via redisConnector.call
    // So the request should pass the limiter and hit the login validation logic.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'password' });

    // Assuming our mockUserModel.findOne returns nothing, it will be 400 or throw
    // The important part is that we didn't get a 429 Too Many Requests
    expect(res.status).not.toBe(429);
    
    // Assert no unexpected console errors occurred (e.g. rate-limit-redis async init errors)
    expect(consoleSpy).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});
