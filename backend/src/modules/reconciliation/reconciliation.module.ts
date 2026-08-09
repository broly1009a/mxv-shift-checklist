import { Module, forwardRef } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { ShiftsModule } from '../shifts/shifts.module';
import { BotEngineModule } from '../bot-engine/bot-engine.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { MarginCheckerModule } from '../margin-checker/margin-checker.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ShiftsModule,
    forwardRef(() => BotEngineModule),
    SystemSettingsModule,
    MarginCheckerModule,
    NotificationsModule,
    AuthModule,
  ],
  providers: [ReconciliationService],
  controllers: [ReconciliationController],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
