/**
 * client.service.ts
 * Facade hợp nhất điều phối toàn bộ các hoạt động Ingress dữ liệu từ ACM ETP API
 */

import * as path from 'path';
import { AcmAuthService } from './auth.service';
import { AcmRestClient } from './rest.client';
import {
  ACM_ETP_REPORTS_REGISTRY,
  CaptchaSolverHook,
  IAcmCredentials,
  IAcmDownloadResult,
  IAcmPageQuery,
  IAcmReportDef,
  IAcmSession,
} from './types';

export class AcmEtpClient {
  private readonly authService: AcmAuthService;
  private readonly restClient: AcmRestClient;
  private readonly credentials: IAcmCredentials;

  constructor(
    credentials: IAcmCredentials = {},
    sessionFilePath?: string,
    captchaSolver?: CaptchaSolverHook
  ) {
    this.credentials = credentials;
    this.authService = new AcmAuthService(sessionFilePath, captchaSolver);
    this.restClient = new AcmRestClient(credentials.baseUrl);
  }

  /**
   * Đăng ký custom solver cho Captcha
   */
  public setCaptchaSolver(solver: CaptchaSolverHook): void {
    this.authService.setCaptchaSolver(solver);
  }

  /**
   * Lấy phiên làm việc hợp lệ (Tự động tái sử dụng session cache nếu còn hiệu lực)
   */
  public async getValidSession(): Promise<IAcmSession> {
    return this.authService.getValidSession(this.credentials);
  }

  /**
   * Lấy danh mục tất cả báo cáo được hỗ trợ trong Registry
   */
  public getReportsRegistry(): Record<string, IAcmReportDef> {
    return ACM_ETP_REPORTS_REGISTRY;
  }

  /**
   * Tải một báo cáo theo key trong Registry (ví dụ: 'ACM_ETP_ORDERS', 'ACM_ETP_TRADES')
   */
  public async downloadReport(
    reportKey: string,
    targetFilePath?: string,
    overrideQueryParams?: Record<string, string>
  ): Promise<IAcmDownloadResult> {
    const reportDef = ACM_ETP_REPORTS_REGISTRY[reportKey];
    if (!reportDef) {
      return {
        key: reportKey,
        name: reportKey,
        fileName: `${reportKey}.xlsx`,
        status: 'FAILED',
        error: `Không tìm thấy định nghĩa báo cáo cho key [${reportKey}] trong ACM_ETP_REPORTS_REGISTRY`,
      };
    }

    try {
      const session = await this.getValidSession();
      const res = await this.restClient.downloadReportFile(
        session,
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
   * Tải riêng file Sổ lệnh ETP (ACM_ETP_ORDERS)
   */
  public async downloadOrders(
    targetFilePath?: string,
    filters?: Record<string, string>
  ): Promise<IAcmDownloadResult> {
    return this.downloadReport('ACM_ETP_ORDERS', targetFilePath, filters);
  }

  /**
   * Tải riêng file Khớp lệnh ETP (ACM_ETP_TRADES)
   */
  public async downloadTrades(
    targetFilePath?: string,
    filters?: Record<string, string>
  ): Promise<IAcmDownloadResult> {
    return this.downloadReport('ACM_ETP_TRADES', targetFilePath, filters);
  }

  /**
   * Tải hàng loạt toàn bộ báo cáo về một thư mục
   */
  public async downloadAllReports(
    targetDir: string = path.resolve(process.cwd(), 'output')
  ): Promise<IAcmDownloadResult[]> {
    const keys = Object.keys(ACM_ETP_REPORTS_REGISTRY);
    const results: IAcmDownloadResult[] = [];

    for (const key of keys) {
      const def = ACM_ETP_REPORTS_REGISTRY[key];
      const targetPath = path.join(targetDir, def.fileName);
      const res = await this.downloadReport(key, targetPath);
      results.push(res);
    }

    return results;
  }

  /**
   * Truy vấn danh sách sổ lệnh ETP (JSON Pagination)
   */
  public async getPagedOrders(query: IAcmPageQuery = {}) {
    const session = await this.getValidSession();
    return this.restClient.fetchPagedData(
      session,
      '/exchange/business/tetporder/page',
      query
    );
  }

  /**
   * Truy vấn danh sách khớp lệnh ETP (JSON Pagination)
   */
  public async getPagedTrades(query: IAcmPageQuery = {}) {
    const session = await this.getValidSession();
    return this.restClient.fetchPagedData(
      session,
      '/exchange/business/tetptrade/page',
      query
    );
  }
}
