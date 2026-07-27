import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  NotificationChannel,
  NotificationChannelSchema,
} from '../../schemas/notification-channel.schema';
import {
  NotificationRule,
  NotificationRuleSchema,
} from '../../schemas/notification-rule.schema';
import {
  NotificationLog,
  NotificationLogSchema,
} from '../../schemas/notification-log.schema';
import { NotificationsService } from './notifications.service';
import { TeamsNotifierService } from './teams-notifier.service';
import { NotificationsController } from './notifications.controller';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationChannel.name, schema: NotificationChannelSchema },
      { name: NotificationRule.name, schema: NotificationRuleSchema },
      { name: NotificationLog.name, schema: NotificationLogSchema },
    ]),
    SystemSettingsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, TeamsNotifierService],
  exports: [NotificationsService, TeamsNotifierService],
})
export class NotificationsModule {}
