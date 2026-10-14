/**
 * ============================================================================
 * CLIENT SERVICE - CORECCP INGRESS FACADE ENGINE
 * ============================================================================
 * Lớp điều phối trung tâm: Tự động phân luồng Kiểu 1, Kiểu 2, Kiểu 3
 * và hỗ trợ tải hàng loạt 25 Báo cáo Maker với Concurrency Control.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CcpExportMechanism,
  CORECCP_25_MAKER_REPORTS,
  ICcpBatchDownloadProgress,
  ICcpDownloadResult,
  ICcpReportDef,
  IDownloadOptions,
} from './types';
import { CoreCcpAuthService } from './auth.service';
import { CoreCcpSocketClient } from './socket.client';
import { CoreCcpRestClient } from './rest.client';
import { CoreCcpCrawlerService } from './crawler.service';

export class CoreCcpClient {
  public readonly auth: CoreCcpAuthService;
  public readonly socket: CoreCcpSocketClient;
  public readonly rest: CoreCcpRestClient;
  public readonly crawler: CoreCcpCrawlerService;

  constructor() {
    this.auth = new CoreCcpAuthService();
    this.socket = new CoreCcpSocketClient();
    this.rest = new CoreCcpRestClient();
    this.crawler = new CoreCcpCrawlerService();
  }

  /**
   * Tải một báo cáo bất kỳ (nhận diện theo key, fileName, hoặc searchCode)
   */
  async downloadReport(
    reportKeyOrDef: string | ICcpReportDef,
    options: IDownloadOptions = {},
  ): Promise<ICcpDownloadResult> {
    const startTime = Date.now();
    const reportDef = typeof reportKeyOrDef === 'string'
      ? this.findReportDef(reportKeyOrDef)
      : reportKeyOrDef;

    if (!reportDef) {
      throw new Error(`Không tìm thấy định nghĩa báo cáo cho: "${reportKeyOrDef}"`);
    }

    const outputDir = options.outputDirectory || path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const targetFilePath = path.join(outputDir, reportDef.fileName);

    const creds = options.credentials || { username: 'hieptruong' };
    const baseUrl = creds.url || 'https://uat-coreccp.mxv.com.vn';

    try {
      let buffer: Buffer | undefined;

      switch (reportDef.mechanism) {
        // KIỂU 1: Direct JSON Search -> Convert Excel
        case CcpExportMechanism.DIRECT_JSON_SEARCH: {
          const session = await this.auth.getValidSession(creds);
          const { rows } = await this.rest.searchFullJson(
            session,
            reportDef.searchCode!,
            baseUrl,
            reportDef.route,
            reportDef.filterPayload,
          );
          await this.rest.convertJsonToExcel(rows, reportDef.key, targetFilePath);
          buffer = fs.readFileSync(targetFilePath);
          break;
        }

        // KIỂU 2: Asynchronous Server Export -> Socket.IO bắt reportId -> Download XLSX
        case CcpExportMechanism.SERVER_SIDE_EXPORT: {
          const session = await this.auth.getValidSession(creds);
          await this.socket.connect(session, baseUrl);

          const fekey = `${reportDef.searchCode}_${Date.now()}`;
          const notiPromise = this.socket.waitForExportCompletion(fekey, 30000);

          await this.rest.createExportJob(
            session,
            reportDef.searchCode!,
            fekey,
            baseUrl,
            reportDef.route,
            reportDef.filterPayload,
          );

          const noti = await notiPromise;
          buffer = await this.rest.downloadReportBinary(session, noti.reportId, baseUrl, reportDef.route);
          fs.writeFileSync(targetFilePath, buffer);
          break;
        }

        // KIỂU 3: Modal UI Extraction
        case CcpExportMechanism.MODAL_DOM_EXTRACTION: {
          if (reportDef.contractCode) {
            await this.crawler.exportNanoContractModal(reportDef.contractCode, targetFilePath, creds);
          } else if (reportDef.key === 'TTTT') {
            await this.crawler.exportPnlExecutedHistory(targetFilePath, creds);
          }
          if (fs.existsSync(targetFilePath)) buffer = fs.readFileSync(targetFilePath);
          break;
        }
      }

      const fileSizeBytes = buffer ? buffer.length : (fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : 0);
      return {
        success: true,
        fileName: reportDef.fileName,
        filePath: targetFilePath,
        buffer,
        fileSizeBytes,
        mechanism: reportDef.mechanism,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        fileName: reportDef.fileName,
        fileSizeBytes: 0,
        mechanism: reportDef.mechanism,
        durationMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  /**
   * Tải trọn gói toàn bộ 25 Báo cáo Maker với Concurrency Control
   */
  async downloadAll25MakerReports(options: IDownloadOptions = {}): Promise<ICcpBatchDownloadProgress> {
    const reports = CORECCP_25_MAKER_REPORTS;
    const concurrency = options.concurrency || 3;

    const progress: ICcpBatchDownloadProgress = {
      total: reports.length,
      completed: 0,
      failed: 0,
      results: [],
    };

    for (let i = 0; i < reports.length; i += concurrency) {
      const chunk = reports.slice(i, i + concurrency);
      const promises = chunk.map(rpt =>
        this.downloadReport(rpt, options).then(res => {
          if (res.success) progress.completed++;
          else progress.failed++;
          progress.results.push(res);
          if (options.onProgress) options.onProgress(progress);
          return res;
        }),
      );
      await Promise.all(promises);
      await new Promise(r => setTimeout(r, 200));
    }

    return progress;
  }

  findReportDef(keyOrFileName: string): ICcpReportDef | undefined {
    return CORECCP_25_MAKER_REPORTS.find(
      r =>
        r.key.toLowerCase() === keyOrFileName.toLowerCase() ||
        r.fileName.toLowerCase() === keyOrFileName.toLowerCase() ||
        r.searchCode?.toLowerCase() === keyOrFileName.toLowerCase(),
    );
  }
}
