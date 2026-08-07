import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarginCheckerService } from './margin-checker.service';
import { MarginCheckerController } from './margin-checker.controller';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationRule, NotificationRuleSchema } from '../../schemas/notification-rule.schema';
import { NotificationChannel, NotificationChannelSchema } from '../../schemas/notification-channel.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationRule.name, schema: NotificationRuleSchema },
      { name: NotificationChannel.name, schema: NotificationChannelSchema },
    ]),
    forwardRef(() => ShiftsModule),
    AuthModule,
  ],
  providers: [MarginCheckerService],
  controllers: [MarginCheckerController],
  exports: [MarginCheckerService],
})
export class MarginCheckerModule {}
