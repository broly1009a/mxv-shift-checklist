import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { ShiftsModule } from '../shifts/shifts.module';
import { BotEngineModule } from '../bot-engine/bot-engine.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { MarginCheckerModule } from '../margin-checker/margin-checker.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import {
  KlgdReconService,
  PreEodReconService,
  CcpReconService,
  CqgSyncReconService,
  ReconConsoleSummaryService,
} from './services';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BotJob.name, schema: BotJobSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
    ]),
    ShiftsModule,
    forwardRef(() => BotEngineModule),
    SystemSettingsModule,
    MarginCheckerModule,
    NotificationsModule,
    AuthModule,
  ],
  providers: [
    KlgdReconService,
    PreEodReconService,
    CcpReconService,
    CqgSyncReconService,
    ReconConsoleSummaryService,
    ReconciliationService,
  ],
  controllers: [ReconciliationController],
  exports: [
    KlgdReconService,
    PreEodReconService,
    CcpReconService,
    CqgSyncReconService,
    ReconConsoleSummaryService,
    ReconciliationService,
  ],
})
export class ReconciliationModule {}
