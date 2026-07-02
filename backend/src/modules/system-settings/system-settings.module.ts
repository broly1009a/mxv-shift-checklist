import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SystemSetting,
  SystemSettingSchema,
} from '../../schemas/system-setting.schema';
import {
  ActivityLog,
  ActivityLogSchema,
} from '../../schemas/activity-log.schema';
import {
  NotificationLog,
  NotificationLogSchema,
} from '../../schemas/notification-log.schema';
import {
  SystemLog,
  SystemLogSchema,
} from '../../schemas/system-log.schema';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';
import { CleanupService } from './cleanup.service';
import { ShiftsModule } from '../shifts/shifts.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemSetting.name, schema: SystemSettingSchema },
      { name: ActivityLog.name, schema: ActivityLogSchema },
      { name: NotificationLog.name, schema: NotificationLogSchema },
      { name: SystemLog.name, schema: SystemLogSchema },
    ]),
    ShiftsModule,
  ],
  providers: [SystemSettingsService, CleanupService],
  controllers: [SystemSettingsController],
  exports: [SystemSettingsService, CleanupService],
})
export class SystemSettingsModule {}
