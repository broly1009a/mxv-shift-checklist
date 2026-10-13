import { Module } from '@nestjs/common';
import { IngressService } from './ingress.service';
import { MSystemScraperService } from './scrapers/ms-scraper.service';
import { MSystemTabScraperService } from './scrapers/ms-tab-scraper.service';
import { CqgScraperService } from './scrapers/cqg-scraper.service';
import { AcmScraperService } from './scrapers/acm-scraper.service';
import { CcpScraperService } from './scrapers/ccp-scraper.service';
import { CoreExApiAdapter } from './adapters/coreex-api.adapter';
import { CoreCcpApiAdapter } from './adapters/coreccp-api.adapter';
import { AcmSftpAdapter } from './adapters/acm-sftp.adapter';

@Module({
  providers: [
    // Playwright Scrapers
    MSystemScraperService,
    MSystemTabScraperService,
    CqgScraperService,
    AcmScraperService,
    CcpScraperService,
    // Native REST/SFTP Adapters (Playwright Sunsetting Bridge)
    CoreExApiAdapter,
    CoreCcpApiAdapter,
    AcmSftpAdapter,
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
    CoreExApiAdapter,
    CoreCcpApiAdapter,
    AcmSftpAdapter,
  ],
})
export class IngressModule {}
