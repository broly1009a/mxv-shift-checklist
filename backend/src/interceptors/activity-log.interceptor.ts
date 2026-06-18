import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityLog } from '../schemas/activity-log.schema';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(
    @InjectModel(ActivityLog.name) private readonly activityLogModel: Model<ActivityLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, user, ip } = request;
    const userAgent = request.get('user-agent') || '';

    // Only log write operations (POST, PUT, DELETE)
    const isWriteOperation = ['POST', 'PUT', 'DELETE'].includes(method);

    return next.handle().pipe(
      tap(async (responseBody) => {
        // Only log if the request succeeded, user is authenticated, and it's a mutative request
        if (isWriteOperation && user) {
          try {
            const action = `${method} ${originalUrl}`;
            let details = '';
            
            // Customize details based on URL / Body
            if (method === 'POST' || method === 'PUT') {
              // Clone body and remove sensitive fields like password
              const bodyClone = { ...request.body };
              delete bodyClone.password;
              delete bodyClone.passwordConfirm;
              delete bodyClone.passwordHash;
              
              details = JSON.stringify({
                body: bodyClone,
                response: responseBody ? { id: responseBody._id || responseBody.id } : null
              });
            } else if (method === 'DELETE') {
              details = JSON.stringify({ params: request.params });
            }

            const log = new this.activityLogModel({
              userId: user._id || user.id,
              action,
              details,
              ipAddress: ip,
              userAgent,
            });
            await log.save();
          } catch (error) {
            console.error('Failed to save activity log:', error);
          }
        }
      }),
    );
  }
}
