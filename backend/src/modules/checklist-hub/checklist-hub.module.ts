import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { TradingOpsModule } from '../trading-ops/trading-ops.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { BotEngineModule } from '../bot-engine/bot-engine.module';
import { BotDispatcherService } from './dispatcher/bot-dispatcher.service';
import { ShiftLifecycleService } from './services/shift-lifecycle.service';
import { ShiftScannerService } from './scheduler/shift-scanner.service';
import { EmailWatcherWorker } from './workers/email-watcher.worker';
import { CalendarSyncWorker } from './workers/calendar-sync.worker';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BotJob.name, schema: BotJobSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
    ]),
    TradingOpsModule,
    ShiftsModule,
    forwardRef(() => BotEngineModule),
  ],
  providers: [
    BotDispatcherService,
    ShiftLifecycleService,
    ShiftScannerService,
    EmailWatcherWorker,
    CalendarSyncWorker,
  ],
  exports: [
    BotDispatcherService,
    ShiftLifecycleService,
    ShiftScannerService,
    EmailWatcherWorker,
    CalendarSyncWorker,
  ],
})
export class ChecklistHubModule {}
