/**
 * rpa-downloader.service.ts (Facade V2)
 *
 * Facade mỏng chuyển tiếp toàn bộ yêu cầu cào dữ liệu Playwright (M-System, CQG, ACM, CAST, CCP)
 * sang RpaScraperService thuộc phân hệ IngressModule (Modular Monolith V2).
 *
 * Bản gốc V1 đầy đủ (5.452 dòng) được lưu trữ an toàn tại:
 * backend/src/legacy/archive/rpa-downloader.service.v1.ts
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { IngressService } from '../ingress/ingress.service';
import { CcpScraperService } from '../ingress/scrapers/ccp-scraper.service';
import { RpaScraperService } from '../ingress/scrapers/rpa-scraper.service';

export { RpaScraperService };

@Injectable()
export class RpaDownloaderService extends RpaScraperService {
  private readonly facadeLogger = new Logger(RpaDownloaderService.name);

  constructor(
    settingsService: SystemSettingsService,
    @Optional()
    ingressService?: IngressService,
    @Optional()
    ccpScraper?: CcpScraperService,
  ) {
    super(settingsService, ingressService, ccpScraper);
  }
}
