import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActivityLog,
  ActivityLogSchema,
} from '../../schemas/activity-log.schema';
import { ActivityLogController } from './activity-log.controller';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
    AuthModule,
  ],
  controllers: [ActivityLogController],
  exports: [MongooseModule],
})
export class ActivityLogModule {}
