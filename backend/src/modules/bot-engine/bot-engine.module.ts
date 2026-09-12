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
import { AgentController } from './bot-agent.controller';
import { CqgSyncService } from './cqg-sync.service';
import { PostEodHandlerService } from './post-eod-handler.service';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { SchedulerService } from './scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { LotStatisticsModule } from '../lot-statistics/lot-statistics.module';
import { CcpStatisticsModule } from '../ccp-statistics/ccp-statistics.module';
import { OmsWatcherService } from './oms-watcher.service';
import { CcpCeDownloaderService } from './ccp-ce-downloader.service';
import { MarginChangeRequestsModule } from '../margin-change-requests/margin-change-requests.module';
import { MarginCheckerModule } from '../margin-checker/margin-checker.module';
import { SystemLogsModule } from '../system-logs/system-logs.module';

// Core Job Strategy Pattern Handlers & Registry
import { BotJobHandlerRegistry } from './core/job-handler.registry';
import { MacroLotJobHandler } from './handlers/macro-lot.handler';
import { MacroValueJobHandler } from './handlers/macro-value.handler';
import { CcpStatsJobHandler } from './handlers/ccp-stats.handler';
import { RpaDownloadJobHandler } from './handlers/rpa-download.handler';
import { CastDownloadJobHandler } from './handlers/cast-download.handler';
import { ReconJobsHandler } from './handlers/recon-jobs.handler';
import { FileAuditJobHandler } from './handlers/file-audit.handler';
import { VerifyEmailJobHandler } from './handlers/verify-email.handler';
import { CcpCeDownloadJobHandler } from './handlers/ccp-ce-download.handler';

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
    MarginCheckerModule,
    SystemLogsModule,
  ],
  providers: [
    // Core Registry & Handlers
    BotJobHandlerRegistry,
    MacroLotJobHandler,
    MacroValueJobHandler,
    CcpStatsJobHandler,
    RpaDownloadJobHandler,
    CastDownloadJobHandler,
    ReconJobsHandler,
    FileAuditJobHandler,
    VerifyEmailJobHandler,
    CcpCeDownloadJobHandler,

    // Services
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
    CcpCeDownloaderService,
  ],
  controllers: [BotEngineController, AgentController],
  exports: [
    BotJobHandlerRegistry,
    BotJobQueueService,
    BotEngineService,
    EmailWatcherService,
    RpaDownloaderService,
    GttCheckerService,
    CqgSyncService,
    PostEodHandlerService,
    SchedulerService,
    OmsWatcherService,
    CcpCeDownloaderService,
    FileAuditJobHandler,
  ],
})
export class BotEngineModule {}
