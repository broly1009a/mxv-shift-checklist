import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChecklistHubModule } from '../checklist-hub/checklist-hub.module';
import { TradingOpsModule } from '../trading-ops/trading-ops.module';

import { IngressService } from './ingress.service';
import { MSystemScraperService } from './scrapers/ms-scraper.service';
import { MSystemTabScraperService } from './scrapers/ms-tab-scraper.service';
import { CqgScraperService } from './scrapers/cqg-scraper.service';
import { AcmScraperService } from './scrapers/acm-scraper.service';
import { CcpScraperService } from './scrapers/ccp-scraper.service';
import { CcpCeScraperService } from './scrapers/ccp-ce-scraper.service';
import { RpaScraperService } from './scrapers/rpa-scraper.service';
import { CoreExApiAdapter } from './adapters/coreex-api.adapter';
import { CoreCcpApiAdapter } from './adapters/coreccp-api.adapter';
import { AcmSftpAdapter } from './adapters/acm-sftp.adapter';
import { AcmEtpAdapter } from './adapters/acm-etp.adapter';
import { MsApiAdapter } from './adapters/ms-api.adapter';
import { ReconIngressPipelineService } from './services/recon-ingress-pipeline.service';
import { AgentHeartbeatService } from './services/agent-heartbeat.service';
import { EmailWatcherService } from './services/email-watcher.service';

// Controllers
import { IngressDownloadController } from './controllers/ingress-download.controller';
import { IngressConfigController } from './controllers/ingress-config.controller';
import { AgentController } from './controllers/ingress-agent.controller';

// Handlers
import { RpaDownloadJobHandler } from './handlers/rpa-download.handler';
import { CastDownloadJobHandler } from './handlers/cast-download.handler';
import { CcpCeDownloadJobHandler } from './handlers/ccp-ce-download.handler';
import { FileAuditJobHandler } from './handlers/file-audit.handler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BotJob.name, schema: BotJobSchema },
    ]),
    SystemSettingsModule,
    NotificationsModule,
    ChecklistHubModule,
    forwardRef(() => TradingOpsModule),
  ],
  controllers: [
    IngressDownloadController,
    IngressConfigController,
    AgentController,
  ],
  providers: [
    // Playwright Scrapers
    MSystemScraperService,
    MSystemTabScraperService,
    CqgScraperService,
    AcmScraperService,
    CcpScraperService,
    CcpCeScraperService,
    RpaScraperService,
    // Native REST/SFTP Adapters (Playwright Sunsetting Bridge)
    CoreExApiAdapter,
    CoreCcpApiAdapter,
    AcmSftpAdapter,
    AcmEtpAdapter,
    MsApiAdapter,
    // Facade Service & Pipelines
    IngressService,
    ReconIngressPipelineService,
    AgentHeartbeatService,
    EmailWatcherService,
    // Handlers
    RpaDownloadJobHandler,
    CastDownloadJobHandler,
    CcpCeDownloadJobHandler,
    FileAuditJobHandler,
  ],
  exports: [
    IngressService,
    ReconIngressPipelineService,
    AgentHeartbeatService,
    EmailWatcherService,
    MSystemScraperService,
    MSystemTabScraperService,
    CqgScraperService,
    AcmScraperService,
    CcpScraperService,
    CcpCeScraperService,
    RpaScraperService,
    CoreExApiAdapter,
    CoreCcpApiAdapter,
    AcmSftpAdapter,
    AcmEtpAdapter,
    MsApiAdapter,
    FileAuditJobHandler,
  ],
})
export class IngressModule {}
