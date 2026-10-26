import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftsModule } from '../shifts/shifts.module';
import { BotEngineService } from './bot-engine.service';
import {
  EmailWatcherService,
  OmsWatcherService,
} from './watchers';
import { BotJobQueueService } from './bot-job-queue.service';
import {
  BotJobsController,
  BotIngressController,
  BotConfigController,
  BotGttController,
  BotMacroController,
  AgentController,
} from './controllers';
import { SchedulerService } from './scheduler.service';
import { AgentHeartbeatService } from './services/agent-heartbeat.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarginChangeRequestsModule } from '../margin-change-requests/margin-change-requests.module';
import { MarginCheckerModule } from '../margin-checker/margin-checker.module';
import { SystemLogsModule } from '../system-logs/system-logs.module';

// Core Job Strategy Pattern Handlers & Registry
import { BotJobHandlerRegistry } from './core/job-handler.registry';
import { RpaDownloadJobHandler } from './handlers/rpa-download.handler';
import { CastDownloadJobHandler } from './handlers/cast-download.handler';
import { FileAuditJobHandler } from './handlers/file-audit.handler';
import { VerifyEmailJobHandler } from './handlers/verify-email.handler';
import { CcpCeDownloadJobHandler } from './handlers/ccp-ce-download.handler';
import { ChecklistHubModule } from '../checklist-hub/checklist-hub.module';
import { IngressModule } from '../ingress/ingress.module';
import { TradingOpsModule } from '../trading-ops/trading-ops.module';

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
    // Core Ingress & Audit Handlers
    BotJobHandlerRegistry,
    RpaDownloadJobHandler,
    CastDownloadJobHandler,
    FileAuditJobHandler,
    VerifyEmailJobHandler,
    CcpCeDownloadJobHandler,

    // Services
    EmailWatcherService,
    BotJobQueueService,
    BotEngineService,
    SchedulerService,
    OmsWatcherService,
    AgentHeartbeatService,
  ],
  controllers: [
    BotJobsController,
    BotIngressController,
    BotConfigController,
    BotGttController,
    BotMacroController,
    AgentController,
  ],
  exports: [
    BotJobHandlerRegistry,
    BotJobQueueService,
    BotEngineService,
    EmailWatcherService,
    SchedulerService,
    OmsWatcherService,
    FileAuditJobHandler,
  ],
})
export class BotEngineModule {}
