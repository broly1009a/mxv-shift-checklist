import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationChannel, NotificationChannelSchema } from '../../schemas/notification-channel.schema';
import { NotificationRule, NotificationRuleSchema } from '../../schemas/notification-rule.schema';
import { NotificationLog, NotificationLogSchema } from '../../schemas/notification-log.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationChannel.name, schema: NotificationChannelSchema },
      { name: NotificationRule.name, schema: NotificationRuleSchema },
      { name: NotificationLog.name, schema: NotificationLogSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
