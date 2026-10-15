import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftsModule } from '../shifts/shifts.module';
import { BotEngineService } from './bot-engine.service';
import { EmailWatcherService } from './email-watcher.service';
import { FileWatcherService } from './file-watcher.service';
import { ApiWatcherService } from './api-watcher.service';
import { BotJobQueueService } from './bot-job-queue.service';
import { BotEngineController } from './bot-engine.controller';
import { AgentController } from './bot-agent.controller';
import { CqgSyncService } from './cqg-sync.service';
import { SchedulerService } from './scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { OmsWatcherService } from './oms-watcher.service';
import { MarginChangeRequestsModule } from '../margin-change-requests/margin-change-requests.module';
import { MarginCheckerModule } from '../margin-checker/margin-checker.module';
import { SystemLogsModule } from '../system-logs/system-logs.module';

// Core Job Strategy Pattern Handlers & Registry
import { BotJobHandlerRegistry } from './core/job-handler.registry';
import { RpaDownloadJobHandler } from './handlers/rpa-download.handler';
import { CastDownloadJobHandler } from './handlers/cast-download.handler';
import { ReconJobsHandler } from './handlers/recon-jobs.handler';
import { FileAuditJobHandler } from './handlers/file-audit.handler';
import { VerifyEmailJobHandler } from './handlers/verify-email.handler';
import { ChecklistHubModule } from '../checklist-hub/checklist-hub.module';
import { IngressModule } from '../ingress/ingress.module';
import { TradingOpsModule } from '../trading-ops/trading-ops.module';

import { RECON_PIPELINE_PORT } from '../../shared';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: BotJob.name, schema: BotJobSchema },
    ]),
    ShiftsModule,
    MarginChangeRequestsModule,
    NotificationsModule,
    MarginCheckerModule,
    SystemLogsModule,
    ChecklistHubModule,
    IngressModule,
    forwardRef(() => TradingOpsModule),
  ],
  providers: [
    // Core Registry & Handlers
    BotJobHandlerRegistry,
    RpaDownloadJobHandler,
    CastDownloadJobHandler,
    ReconJobsHandler,
    FileAuditJobHandler,
    VerifyEmailJobHandler,
    {
      provide: RECON_PIPELINE_PORT,
      useExisting: ReconJobsHandler,
    },

    // Services
    EmailWatcherService,
    FileWatcherService,
    ApiWatcherService,
    BotJobQueueService,
    CqgSyncService,
    BotEngineService,
    SchedulerService,
    OmsWatcherService,
  ],
  controllers: [BotEngineController, AgentController],
  exports: [
    BotJobHandlerRegistry,
    BotJobQueueService,
    BotEngineService,
    EmailWatcherService,
    CqgSyncService,
    SchedulerService,
    OmsWatcherService,
    FileAuditJobHandler,
    ReconJobsHandler,
    RECON_PIPELINE_PORT,
  ],
})
export class BotEngineModule {}
