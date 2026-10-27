import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { ActivityLog, ActivityLogSchema } from '../../schemas/activity-log.schema';
import { TradingOpsModule } from '../trading-ops/trading-ops.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { SystemLogsModule } from '../system-logs/system-logs.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BotDispatcherService } from './dispatcher/bot-dispatcher.service';
import { ShiftLifecycleService } from './services/shift-lifecycle.service';
import { ShiftScannerService } from './scheduler/shift-scanner.service';
import { ShiftOverdueSweeperWorker } from './scheduler/shift-overdue-sweeper.worker';
import { AutonomousSchedulerService } from './scheduler/autonomous-scheduler.service';
import { EmailWatcherWorker } from './workers/email-watcher.worker';
import { CalendarSyncWorker } from './workers/calendar-sync.worker';
import { BotJobQueueService } from './queue/bot-job-queue.service';
import { BotJobHandlerRegistry } from './queue/job-handler.registry';
import { ChecklistBotJobsController } from './controllers/checklist-bot-jobs.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BotJob.name, schema: BotJobSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
    forwardRef(() => TradingOpsModule),
    ShiftsModule,
    SystemLogsModule,
    SystemSettingsModule,
    NotificationsModule,
  ],
  controllers: [
    ChecklistBotJobsController,
  ],
  providers: [
    BotDispatcherService,
    BotJobQueueService,
    BotJobHandlerRegistry,
    ShiftLifecycleService,
    ShiftScannerService,
    AutonomousSchedulerService,
    ShiftOverdueSweeperWorker,
    EmailWatcherWorker,
    CalendarSyncWorker,
  ],
  exports: [
    BotDispatcherService,
    BotJobQueueService,
    BotJobHandlerRegistry,
    ShiftLifecycleService,
    ShiftScannerService,
    AutonomousSchedulerService,
    ShiftOverdueSweeperWorker,
    EmailWatcherWorker,
    CalendarSyncWorker,
  ],
})
export class ChecklistHubModule {}
