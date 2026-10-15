process.env.NODE_ENV = 'test';
process.env.JWT_KEY = 'test_jwt_key';

const mockSessionValidate = jest.fn();
const mockRedisGet = jest.fn();

jest.mock('@mss/common', () => {
  return {
    ...jest.requireActual('@mss/common'),
    redisConnector: {
      getClient: () => ({
        get: mockRedisGet,
      })
    }
  };
});

jest.mock('@svl/share', () => {
  return {
    ...jest.requireActual('@svl/share'),
    Session: {
      ...jest.requireActual('@svl/share').Session,
      userSession: {
        ...jest.requireActual('@svl/share').Session.userSession,
        validate: mockSessionValidate,
      }
    }
  };
});

import { requireAuth } from '../../src/middlewares/requireAuth';
import { requireRole, Identity } from '@svl/share';
import jwt from 'jsonwebtoken';

describe('requireAuth Middleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 if missing authorization header', async () => {
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('should return 401 on invalid token', async () => {
    req.headers['authorization'] = 'Bearer invalid-token';
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
  });

  it('should return 401 if session is invalid', async () => {
    const validToken = jwt.sign({ id: 'user1' }, 'test_jwt_key');
    req.headers['authorization'] = `Bearer ${validToken}`;
    
    mockSessionValidate.mockResolvedValue(false);

    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SESSION_INVALID' }));
  });

  it('should set req.user, req.token and headers["x-user"] on success', async () => {
    const payload = { id: 'user1', session: 'sess123' };
    const validToken = jwt.sign(payload, 'test_jwt_key');
    req.headers['authorization'] = `Bearer ${validToken}`;
    
    mockSessionValidate.mockResolvedValue(true);

    await requireAuth(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 'user1' });
    expect(req.token).toBe(validToken);
    expect(JSON.parse(req.headers['x-user'])).toMatchObject({ id: 'user1' });
  });

  it('should reject public token for protected-session validation', async () => {
    const validToken = jwt.sign({ type: 'public', fp: 'some-fp' }, 'test_jwt_key', { expiresIn: '60s' });
    req.headers['authorization'] = `Bearer ${validToken}`;
    
    mockSessionValidate.mockResolvedValue(false);

    await requireAuth(req, res, next);
    
    expect(mockSessionValidate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'public', fp: 'some-fp' })
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SESSION_INVALID' }));
    expect(next).not.toHaveBeenCalled();
    expect(req.headers['x-user']).toBeUndefined();
  });

  describe('Integration with requireRole', () => {
    it('should allow requireRole to authorize request after requireAuth populates x-user', async () => {
      const payload = { id: 'user1', session: 'sess123' };
      const validToken = jwt.sign(payload, 'test_jwt_key');
      req.headers['authorization'] = `Bearer ${validToken}`;
      mockSessionValidate.mockResolvedValue(true);

      await requireAuth(req, res, next);
      
      // Mock Redis to return the role for the user
      mockRedisGet.mockResolvedValue(JSON.stringify({ userRoles: ['ADMIN_ROLE'] }));
      
      // The permission we are requiring
      const roleMiddleware = requireRole(['ADMIN_ROLE'] as any);
      
      const roleNext = jest.fn();
      await roleMiddleware(req, res, roleNext);

      // We expect the request to be authorized
      expect(roleNext).toHaveBeenCalled();
      
      // We expect that Redis get was called with the correct key
      expect(mockRedisGet).toHaveBeenCalledWith('auth:session-user1');
    });
  });
});
