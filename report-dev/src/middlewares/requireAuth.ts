import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { Session, type Identity } from '@svl/share';

declare module 'express-serve-static-core' {
  interface Request {
    user?: Identity.UserPayload;
    token?: string;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawAuth = req.headers['authorization'];
    
    if (!rawAuth || Array.isArray(rawAuth)) {
      res.status(401).json({ success: false, error: 'Authentication required', code: 'UNAUTHORIZED' });
      return;
    }

    const authHeader = rawAuth.trim();
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      res.status(401).json({ success: false, error: 'Authentication required', code: 'UNAUTHORIZED' });
      return;
    }

    const token = parts[1];

    const jwtKey = process.env.JWT_KEY;
    if (!jwtKey) {
      res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
      return;
    }

    let payload: string | jwt.JwtPayload;
    try {
      payload = jwt.verify(token, jwtKey);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
        return;
      }
      res.status(401).json({ success: false, error: 'Invalid token', code: 'INVALID_TOKEN' });
      return;
    }

    if (typeof payload !== 'object' || payload === null) {
      res.status(401).json({ success: false, error: 'Invalid token', code: 'INVALID_TOKEN' });
      return;
    }

    const isValidSession = await Session.userSession.validate(payload);
    if (!isValidSession) {
      res.status(401).json({ success: false, error: 'Session expired or invalid', code: 'SESSION_INVALID' });
      return;
    }

    req.headers['x-user'] = JSON.stringify(payload);
    req.user = payload as Identity.UserPayload;
    req.token = token;

    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Authentication error', code: 'AUTH_ERROR' });
  }
}
