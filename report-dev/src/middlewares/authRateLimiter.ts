import { Request, Response, NextFunction } from 'express';
import { rateLimit, type RateLimitRequestHandler, ipKeyGenerator } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { redisConnector } from '@mss/common';

const limiterMiddleware: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    if (req.ip) {
      return ipKeyGenerator(req.ip);
    }
    return 'anonymous';
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again later',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: 900
    });
  },
  store: new RedisStore({
    sendCommand: (...args: string[]) => {
      const client = redisConnector.getClient();
      return client.call(args[0], ...args.slice(1)) as Promise<RedisReply>;
    },
    prefix: 'rl:auth:'
  })
});

export function authRateLimiter(req: Request, res: Response, next: NextFunction): void {
  limiterMiddleware(req, res, next);
}
