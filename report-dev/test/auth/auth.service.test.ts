process.env.NODE_ENV = 'test';
process.env.JWT_KEY = 'test_jwt_key';
process.env.MONGO_URI = 'mongodb://localhost:27017/test';

// Mock mongoose to prevent real DB connections
jest.mock('mongoose', () => {
  return {
    ...jest.requireActual('mongoose'),
    createConnection: jest.fn().mockReturnValue({
      model: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
    })
  };
});

// Mock user model
const mockUserModel = {
  findOne: jest.fn(),
  findById: jest.fn(),
};
jest.mock('../../src/modules/auth/models/user.model', () => ({
  __esModule: true,
  default: mockUserModel
}));

// Mock groupRole model
const mockGroupRoleModel = {
  find: jest.fn(),
};
jest.mock('../../src/modules/auth/models/groupRole.model', () => ({
  __esModule: true,
  default: mockGroupRoleModel
}));

// Mock redis
const mockAuthDB = {
  get: jest.fn(),
  set: jest.fn(),
};
const mockCacheDB = {
  get: jest.fn(),
  set: jest.fn(),
  incrWithExpire: jest.fn(),
  refreshTTL: jest.fn(),
};
jest.mock('../../src/modules/auth/utils/redis.util', () => ({
  authDB: mockAuthDB,
  cacheDB: mockCacheDB
}));

// Mock @mss/common
const mockPassword = {
  compare: jest.fn(),
};
jest.mock('@mss/common', () => {
  return {
    ...jest.requireActual('@mss/common'),
    Password: mockPassword,
    generateHash: jest.fn().mockReturnValue('mocked-hash'),
    HashAppSignature: jest.fn().mockReturnValue('mocked-fp-hash'),
  };
});

import { login, verifyPIN, getPublicToken, changePasswordUser, changePINUser, setAuthNotificationPort } from '../../src/modules/auth/services/auth.service';
import jwt from 'jsonwebtoken';
import { Identity, Session, Audit } from '@svl/share';

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should increment numLoginFail on wrong password and throw error', async () => {
      const mockUser = {
        _id: 'user1',
        username: 'test',
        password: 'hashed-password',
        status: Identity.Enums.UserStatus.ACTIVE,
        numLoginFail: 0,
        save: jest.fn().mockResolvedValue(true)
      };
      
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser)
      });
      mockPassword.compare.mockResolvedValue(false);

      await expect(login({ username: 'test', password: 'wrong' })).rejects.toThrow('Sai tên đăng nhập hoặc mật khẩu');
      
      expect(mockUser.numLoginFail).toBe(1);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should reject when numLoginFail >= 5', async () => {
      const mockUser = {
        _id: 'user1',
        username: 'test',
        password: 'hashed-password',
        status: Identity.Enums.UserStatus.ACTIVE,
        numLoginFail: 5,
      };
      
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser)
      });

      await expect(login({ username: 'test', password: 'password' }))
        .rejects.toThrow('Đăng nhập sai quá nhiều lần. Vui lòng liên hệ User để làm mới Mật khẩu/Mã PIN');
    });

    it('should merge roles from user.role and groupRole.role, sign JWT, and write session', async () => {
      const mockUser = {
        _id: 'user1',
        username: 'test',
        email: 'test@example.com',
        password: 'hashed-password',
        status: Identity.Enums.UserStatus.ACTIVE,
        numLoginFail: 0,
        role: ['USER_ROLE_1'],
        groupRole: ['group1'],
        type: 'INTERNAL',
        save: jest.fn().mockResolvedValue(true)
      };
      
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser)
      });
      mockPassword.compare.mockResolvedValue(true);
      
      mockGroupRoleModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: 'group1', role: ['GROUP_ROLE_1', 'GROUP_ROLE_2'] }
        ])
      });

      mockAuthDB.get.mockResolvedValue(null); 
      
      const jwtSignSpy = jest.spyOn(jwt, 'sign');
      
      const result = await login({ username: 'test', password: 'password' });

      expect(result.userRoles).toEqual(expect.arrayContaining(['GROUP_ROLE_1', 'GROUP_ROLE_2', 'USER_ROLE_1']));
      
      expect(jwtSignSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user1',
          username: 'test',
          session: 'mocked-hash',
          verifyPIN: false
        }),
        'test_jwt_key'
      );
      
      expect(mockAuthDB.set).toHaveBeenCalledWith(
        'session-user1',
        expect.objectContaining({
          id: 'user1',
          username: 'test',
          session: 'mocked-hash',
          userRoles: expect.arrayContaining(['GROUP_ROLE_1', 'GROUP_ROLE_2', 'USER_ROLE_1'])
        })
      );
    });

    it('should generate an audit log for successful login', async () => {
      const mockUser = {
        _id: 'user1',
        username: 'test',
        email: 'test@example.com',
        password: 'hashed-password',
        status: Identity.Enums.UserStatus.ACTIVE,
        numLoginFail: 0,
        role: ['USER_ROLE_1'],
        groupRole: [],
        type: 'INTERNAL',
        save: jest.fn().mockResolvedValue(true)
      };
      
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser)
      });
      mockPassword.compare.mockResolvedValue(true);
      mockGroupRoleModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      mockAuthDB.get.mockResolvedValue(null); 
      
      const mockAuditRecorder = {
        writeLog: jest.fn(),
        updateResult: jest.fn(),
        executeWithAudit: jest.fn().mockImplementation((log, owner, op) => op())
      };
      
      const { setAuthAuditRecorder } = require('../../src/modules/auth/services/auth.service');
      setAuthAuditRecorder(mockAuditRecorder);

      await login({ username: 'test', password: 'password' });

      expect(mockAuditRecorder.executeWithAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: Audit.Enums.AuditAction.LOGIN,
          title: `Đăng nhập user test`,
          attach_data: {
            raw: { userId: 'user1', username: 'test' },
            metadata: {}
          }
        }),
        'user1',
        expect.any(Function),
        expect.any(Number) // AuditCreatedBy.USER
      );
      
      // Reset back to noop
      setAuthAuditRecorder(undefined);
    });
  });

  describe('verifyPIN', () => {
    it('should fail with expired PIN (simulated by cacheUser.loginTime timeout)', async () => {
      const mockUser = {
        _id: 'user1',
        username: 'test',
        PIN: 'hashed-pin',
        numLoginFail: 0,
        save: jest.fn().mockResolvedValue(true)
      };
      
      mockUserModel.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser)
      });
      mockPassword.compare.mockResolvedValue(true);

      mockAuthDB.get.mockResolvedValue({
        loginTime: Date.now() - 3 * 60 * 1000,
        session: 'old-hash'
      });

      await expect(verifyPIN('user1', { PIN: '123456' }))
        .rejects.toThrow('Phiên đăng nhập hết hạn. Vui lòng thử lại');
        
      expect(mockUser.numLoginFail).toBe(1);
    });

    it('should update verify token on valid PIN', async () => {
      const mockUser: any = {
        _id: 'user1',
        username: 'test',
        PIN: 'hashed-pin',
        numLoginFail: 2,
        role: [],
        groupRole: [],
        save: jest.fn().mockResolvedValue(true),
        department: { code: 'D1' }
      };
      
      mockUserModel.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser)
      });
      mockPassword.compare.mockResolvedValue(true);

      const loginTime = Date.now() - 1000;
      mockAuthDB.get.mockResolvedValue({
        loginTime,
        session: 'active-session-hash'
      });

      mockGroupRoleModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      });

      const jwtSignSpy = jest.spyOn(jwt, 'sign');
      
      await verifyPIN('user1', { PIN: '123456' });

      expect(mockUser.numLoginFail).toBe(0);
      expect(mockUser.lastLoginAt).toBe(loginTime);
      expect(mockUser.save).toHaveBeenCalled();

      expect(jwtSignSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user1',
          verifyPIN: true,
          departmentCode: 'D1'
        }),
        'test_jwt_key'
      );
    });
  });

  describe('getPublicToken', () => {
    it('should rate-limit key by IP/fingerprint and issue public token', async () => {
      mockCacheDB.incrWithExpire.mockResolvedValueOnce(1); 
      mockCacheDB.incrWithExpire.mockResolvedValueOnce(1);
      
      const jwtSignSpy = jest.spyOn(jwt, 'sign');
      
      const result = await getPublicToken('fp123', '127.0.0.1');

      expect(mockCacheDB.incrWithExpire).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1'), expect.any(Number));
      expect(mockCacheDB.incrWithExpire).toHaveBeenCalledWith(expect.stringContaining('mocked-fp-hash'), expect.any(Number));
      
      expect(jwtSignSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'public'
        }),
        'test_jwt_key',
        expect.any(Object)
      );
      expect(result).toBeDefined();
    });
    
    it('should reject if IP exceeds rate limit', async () => {
      mockCacheDB.incrWithExpire.mockResolvedValueOnce(999); 
      
      await expect(getPublicToken('fp123', '127.0.0.1')).rejects.toThrow('Too many requests. Please try again later.');
    });
  });
  describe('changePasswordUser', () => {
    let mockSendNotification: jest.Mock;

    beforeEach(() => {
      mockSendNotification = jest.fn().mockResolvedValue(undefined);
      setAuthNotificationPort({ send: mockSendNotification });
      jest.spyOn(Session.userSession, 'clearAllLoginSessions').mockResolvedValue(true as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should change password, clear sessions, and send WS notification', async () => {
      const mockUser = {
        _id: 'user1',
        password: 'old-hashed',
        requireChangePassword: true,
        save: jest.fn().mockResolvedValue(true)
      };
      mockUserModel.findById.mockReturnValue(mockUser);
      mockPassword.compare.mockResolvedValue(true);

      const result = await changePasswordUser('user1', { oldPassword: 'old', newPassword: 'new' }, 'modifier');

      expect(mockUser.password).toBe('new');
      expect(mockUser.requireChangePassword).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
      expect(Session.userSession.clearAllLoginSessions).toHaveBeenCalledWith('user1');
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ['ws'],
          recipients: [{ userId: 'user1' }]
        })
      );
    });

    it('should ignore notification failure and still succeed', async () => {
      const mockUser = {
        _id: 'user1',
        password: 'old-hashed',
        requireChangePassword: true,
        save: jest.fn().mockResolvedValue(true)
      };
      mockUserModel.findById.mockReturnValue(mockUser);
      mockPassword.compare.mockResolvedValue(true);
      
      mockSendNotification.mockRejectedValue(new Error('Notification failed'));

      await expect(changePasswordUser('user1', { oldPassword: 'old', newPassword: 'new' }, 'modifier')).resolves.toBeDefined();
    });
  });

  describe('changePINUser', () => {
    let mockSendNotification: jest.Mock;

    beforeEach(() => {
      mockSendNotification = jest.fn().mockResolvedValue(undefined);
      setAuthNotificationPort({ send: mockSendNotification });
      jest.spyOn(Session.userSession, 'clearAllLoginSessions').mockResolvedValue(true as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should change PIN, clear sessions, and send WS notification', async () => {
      const mockUser = {
        _id: 'user1',
        password: 'old-hashed',
        PIN: 'old-pin',
        save: jest.fn().mockResolvedValue(true)
      };
      mockUserModel.findById.mockReturnValue(mockUser);
      mockPassword.compare.mockResolvedValue(true);

      const result = await changePINUser('user1', { password: 'old', newPIN: 'new' });

      expect(mockUser.PIN).toBe('new');
      expect(mockUser.save).toHaveBeenCalled();
      expect(Session.userSession.clearAllLoginSessions).toHaveBeenCalledWith('user1');
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ['ws'],
          recipients: [{ userId: 'user1' }]
        })
      );
    });

    it('should ignore notification failure and still succeed', async () => {
      const mockUser = {
        _id: 'user1',
        password: 'old-hashed',
        save: jest.fn().mockResolvedValue(true)
      };
      mockUserModel.findById.mockReturnValue(mockUser);
      mockPassword.compare.mockResolvedValue(true);
      
      mockSendNotification.mockRejectedValue(new Error('Notification failed'));

      await expect(changePINUser('user1', { password: 'old', newPIN: 'new' })).resolves.toBeDefined();
    });
  });
});
