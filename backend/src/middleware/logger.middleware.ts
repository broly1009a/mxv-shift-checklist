import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length') || '0';
      const duration = Date.now() - startTime;

      // Bỏ qua các API polling/heartbeat định kỳ thành công để tránh làm phình ổ cứng PM2 log
      const isPeriodicPolling =
        method === 'GET' &&
        (originalUrl.includes('/dashboard/system-status') ||
          originalUrl.includes('/dashboard/summary') ||
          originalUrl.includes('/bot-engine/agent-status') ||
          originalUrl.includes('/bot-engine/jobs'));

      if (isPeriodicPolling && (statusCode === 200 || statusCode === 304)) {
        return;
      }

      const logMessage = `${method} ${originalUrl} ${statusCode} - ${contentLength} bytes - ${userAgent} ${ip} - ${duration}ms`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
