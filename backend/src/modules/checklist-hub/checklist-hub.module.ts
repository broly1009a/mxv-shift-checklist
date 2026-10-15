import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { TradingOpsModule } from '../trading-ops/trading-ops.module';
import { BotDispatcherService } from './dispatcher/bot-dispatcher.service';
import { ShiftLifecycleService } from './services/shift-lifecycle.service';
import { EmailWatcherWorker } from './workers/email-watcher.worker';
import { CalendarSyncWorker } from './workers/calendar-sync.worker';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BotJob.name, schema: BotJobSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
    ]),
    TradingOpsModule,
  ],
  providers: [
    BotDispatcherService,
    ShiftLifecycleService,
    EmailWatcherWorker,
    CalendarSyncWorker,
  ],
  exports: [
    BotDispatcherService,
    ShiftLifecycleService,
    EmailWatcherWorker,
    CalendarSyncWorker,
  ],
})
export class ChecklistHubModule {}
