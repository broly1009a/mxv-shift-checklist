import { Module } from '@nestjs/common';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
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

@Module({
  imports: [SystemSettingsModule],
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
    // Facade Service
    IngressService,
  ],
  exports: [
    IngressService,
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
  ],
})
export class IngressModule {}
