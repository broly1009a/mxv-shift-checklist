/**
 * ms-client.service.ts
 * Facade hợp nhất điều phối toàn bộ các hoạt động Ingress dữ liệu từ M-System API
 */

import * as path from 'path';
import { MsAuthService } from './auth.service';
import { MsRestClient } from './rest.client';
import {
  IMsCredentials,
  IMsDownloadResult,
  IMsReportDef,
  MS_REPORTS_REGISTRY,
} from './types';

export class MsClient {
  private readonly authService: MsAuthService;
  private readonly restClient: MsRestClient;
  private readonly credentials: IMsCredentials;

  constructor(credentials: IMsCredentials = {}, sessionFilePath?: string) {
    this.credentials = credentials;
    this.authService = new MsAuthService(sessionFilePath);
    this.restClient = new MsRestClient(credentials.baseUrl, credentials.adminUrl);
  }

  /**
   * Lấy Bearer Token hợp lệ
   */
  public async getValidToken(): Promise<string> {
    return this.authService.getValidToken(this.credentials);
  }

  /**
   * Lấy danh mục tất cả báo cáo được hỗ trợ
   */
  public getReportsRegistry(): Record<string, IMsReportDef> {
    return MS_REPORTS_REGISTRY;
  }

  /**
   * Tải một báo cáo theo key (ví dụ: 'DSTKGD-Futures', 'NKTTHT', 'DSTKGD-Spread'...)
   */
  public async downloadReport(
    reportKey: string,
    targetFilePath?: string,
    overrideQueryParams?: Record<string, string>
  ): Promise<IMsDownloadResult> {
    const reportDef = MS_REPORTS_REGISTRY[reportKey];
    if (!reportDef) {
      return {
        key: reportKey,
        name: reportKey,
        fileName: `${reportKey}.xlsx`,
        status: 'FAILED',
        error: `Không tìm thấy định nghĩa báo cáo cho key [${reportKey}] trong MS_REPORTS_REGISTRY`,
      };
    }

    try {
      const token = await this.getValidToken();
      const res = await this.restClient.downloadReportFile(
        token,
        reportDef,
        targetFilePath,
        overrideQueryParams
      );

      return {
        key: reportDef.key,
        name: reportDef.name,
        fileName: res.filename,
        filePath: res.filePath,
        sizeBytes: res.sizeBytes,
        durationMs: res.durationMs,
        status: 'SUCCESS',
      };
    } catch (err: any) {
      return {
        key: reportDef.key,
        name: reportDef.name,
        fileName: reportDef.fileName,
        status: 'FAILED',
        error: err.message,
      };
    }
  }

  /**
   * Tải hàng loạt toàn bộ báo cáo về một thư mục
   */
  public async downloadAllReports(
    targetDir: string = path.resolve(process.cwd(), 'output'),
    keysToDownload?: string[]
  ): Promise<IMsDownloadResult[]> {
    const keys = keysToDownload || Object.keys(MS_REPORTS_REGISTRY);
    const results: IMsDownloadResult[] = [];

    for (const key of keys) {
      const def = MS_REPORTS_REGISTRY[key];
      if (!def) continue;

      const targetPath = path.join(targetDir, def.fileName);
      const res = await this.downloadReport(key, targetPath);
      results.push(res);
    }

    return results;
  }
}
