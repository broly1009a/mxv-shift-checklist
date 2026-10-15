/**
 * ccp-ce-downloader.service.ts (Facade V2)
 *
 * Facade mỏng chuyển tiếp toàn bộ yêu cầu tải báo cáo CoreCCP & CoreEX
 * sang CcpCeScraperService thuộc phân hệ IngressModule (Modular Monolith V2).
 *
 * Bản gốc V1 đầy đủ (2.951 dòng) được lưu trữ an toàn tại:
 * backend/src/legacy/archive/ccp-ce-downloader.service.v1.ts
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  CcpCeScraperService,
  CcpReportConfig,
  CcpDownloadOptions,
  CcpRunOptions,
  DEFAULT_CCP_REPORTS,
  DEFAULT_CE_REPORTS,
  DateInterval,
  CcpFilterOptions,
  getTodayVnDate,
  generateMonthlyIntervals,
  splitInterval,
  mergeCsvFiles,
} from '../ingress/scrapers/ccp-ce-scraper.service';
import { IngressService } from '../ingress/ingress.service';

export type {
  CcpReportConfig,
  CcpDownloadOptions,
  CcpRunOptions,
  DateInterval,
  CcpFilterOptions,
};

export {
  DEFAULT_CCP_REPORTS,
  DEFAULT_CE_REPORTS,
  getTodayVnDate,
  generateMonthlyIntervals,
  splitInterval,
  mergeCsvFiles,
  CcpCeScraperService,
};

@Injectable()
export class CcpCeDownloaderService extends CcpCeScraperService {
  private readonly facadeLogger = new Logger(CcpCeDownloaderService.name);

  constructor(
    @Optional()
    ingressService?: IngressService,
  ) {
    super(ingressService);
  }
}
