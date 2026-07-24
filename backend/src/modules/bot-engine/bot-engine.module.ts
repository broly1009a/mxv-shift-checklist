import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftsModule } from '../shifts/shifts.module';
import { BotEngineService } from './bot-engine.service';
import { EmailWatcherService } from './email-watcher.service';
import { FileWatcherService } from './file-watcher.service';
import { ApiWatcherService } from './api-watcher.service';
import { RpaDownloaderService } from './rpa-downloader.service';
import { GttCheckerService } from './gtt-checker.service';
import { BotJobQueueService } from './bot-job-queue.service';
import { BotEngineController } from './bot-engine.controller';
import { AgentController } from './bot-engine.controller';
import { CqgSyncService } from './cqg-sync.service';
import { PostEodHandlerService } from './post-eod-handler.service';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { SchedulerService } from './scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { LotStatisticsModule } from '../lot-statistics/lot-statistics.module';
import { CcpStatisticsModule } from '../ccp-statistics/ccp-statistics.module';

import { OmsWatcherService } from './oms-watcher.service';

import { MarginChangeRequestsModule } from '../margin-change-requests/margin-change-requests.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: BotJob.name, schema: BotJobSchema },
    ]),
    ShiftsModule,
    forwardRef(() => ReconciliationModule),
    forwardRef(() => MarginChangeRequestsModule),
    NotificationsModule,
    LotStatisticsModule,
    CcpStatisticsModule,
  ],
  providers: [
    EmailWatcherService,
    FileWatcherService,
    ApiWatcherService,
    RpaDownloaderService,
    GttCheckerService,
    BotJobQueueService,
    CqgSyncService,
    PostEodHandlerService,
    BotEngineService,
    SchedulerService,
    OmsWatcherService,
  ],
  controllers: [
    BotEngineController,
    AgentController,
  ],
  exports: [
    BotEngineService,
    EmailWatcherService,
    BotJobQueueService,
    RpaDownloaderService,
    GttCheckerService,
    CqgSyncService,
    PostEodHandlerService,
    SchedulerService,
    OmsWatcherService,
  ],
})
export class BotEngineModule {}



