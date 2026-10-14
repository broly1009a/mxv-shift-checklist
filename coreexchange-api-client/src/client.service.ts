/**
 * client.service.ts
 * Facade hợp nhất điều phối toàn bộ các hoạt động Ingress dữ liệu từ Core Exchange (CE)
 */

import * as path from 'path';
import { CoreExchangeAuthService } from './auth.service';
import { CoreExchangeRestClient } from './rest.client';
import {
  CORE_EXCHANGE_REPORTS_REGISTRY,
  CoreExchangeExportMechanism,
  ICoreExchangeAuthSession,
  ICoreExchangeCredentials,
  ICoreExchangeDownloadResult,
  ICoreExchangePageQuery,
  ICoreExchangeReportDef,
} from './types';

export class CoreExchangeClient {
  public readonly auth: CoreExchangeAuthService;
  public readonly rest: CoreExchangeRestClient;
  private readonly credentials: ICoreExchangeCredentials;

  constructor(credentials: ICoreExchangeCredentials = {}, sessionFilePath?: string) {
    this.credentials = credentials;
    this.auth = new CoreExchangeAuthService(sessionFilePath);
    this.rest = new CoreExchangeRestClient(credentials.baseUrl);
  }

  /**
   * Lấy phiên làm việc hợp lệ (Tự động tái sử dụng session cache nếu còn hiệu lực)
   */
  public async getValidSession(): Promise<ICoreExchangeAuthSession> {
    return this.auth.getValidSession(this.credentials);
  }

  /**
   * Lấy danh mục tất cả báo cáo được hỗ trợ trong Registry
   */
  public getReportsRegistry(): Record<string, ICoreExchangeReportDef> {
    return CORE_EXCHANGE_REPORTS_REGISTRY;
  }

  /**
   * Tải một báo cáo theo key trong Registry (ví dụ: 'DSL', 'DSGD', 'DSLCK'...)
   */
  public async downloadReport(
    reportKey: string,
    targetFilePath?: string,
    query: ICoreExchangePageQuery = {}
  ): Promise<ICoreExchangeDownloadResult> {
    const reportDef = CORE_EXCHANGE_REPORTS_REGISTRY[reportKey];
    if (!reportDef) {
      return {
        key: reportKey,
        name: reportKey,
        fileName: `${reportKey}.xlsx`,
        mechanism: CoreExchangeExportMechanism.DIRECT_JSON_SEARCH,
        status: 'FAILED',
        error: `Không tìm thấy định nghĩa báo cáo cho key [${reportKey}] trong CORE_EXCHANGE_REPORTS_REGISTRY`,
      };
    }

    const resolvedPath =
      targetFilePath || path.resolve(process.cwd(), 'output', reportDef.fileName);

    try {
      const session = await this.getValidSession();

      // Kiểm tra nếu là cơ chế tải file nhị phân trực tiếp
      if (reportDef.mechanism === CoreExchangeExportMechanism.DIRECT_BINARY_EXPORT) {
        const res = await this.rest.downloadBinaryFile(
          session,
          reportDef.route,
          resolvedPath
        );
        return {
          key: reportDef.key,
          name: reportDef.name,
          fileName: res.filename,
          filePath: res.filePath,
          sizeBytes: res.sizeBytes,
          durationMs: res.durationMs,
          mechanism: reportDef.mechanism,
          status: 'SUCCESS',
        };
      }

      // Cơ chế DIRECT_JSON_SEARCH: Gọi search dữ liệu và xuất sang file Excel
      const searchEndpoint = `/exchange/api/v1/${reportDef.searchCode || reportDef.key.toLowerCase()}/search`;
      const searchResult = await this.rest.searchData(session, searchEndpoint, query).catch(() => {
        // Fallback sang endpoint tổng hợp nếu endpoint cụ thể chưa mở
        return { rows: [], totalCount: 0, raw: null };
      });

      const exportRes = await this.rest.exportJsonToExcel(
        searchResult.rows,
        reportDef,
        resolvedPath
      );

      return {
        key: reportDef.key,
        name: reportDef.name,
        fileName: exportRes.filename,
        filePath: exportRes.filePath,
        sizeBytes: exportRes.sizeBytes,
        durationMs: exportRes.durationMs,
        mechanism: reportDef.mechanism,
        status: 'SUCCESS',
      };
    } catch (err: any) {
      return {
        key: reportDef.key,
        name: reportDef.name,
        fileName: reportDef.fileName,
        mechanism: reportDef.mechanism,
        status: 'FAILED',
        error: err.message,
      };
    }
  }

  /**
   * Tải Sổ lệnh tổng hợp CE (DSL)
   */
  public async downloadOrders(
    targetFilePath?: string,
    query?: ICoreExchangePageQuery
  ): Promise<ICoreExchangeDownloadResult> {
    return this.downloadReport('DSL', targetFilePath, query);
  }

  /**
   * Tải Danh sách giao dịch CE (DSGD)
   */
  public async downloadTrades(
    targetFilePath?: string,
    query?: ICoreExchangePageQuery
  ): Promise<ICoreExchangeDownloadResult> {
    return this.downloadReport('DSGD', targetFilePath, query);
  }

  /**
   * Tải hàng loạt toàn bộ báo cáo CE về một thư mục
   */
  public async downloadAllReports(
    targetDir: string = path.resolve(process.cwd(), 'output')
  ): Promise<ICoreExchangeDownloadResult[]> {
    const keys = Object.keys(CORE_EXCHANGE_REPORTS_REGISTRY);
    const results: ICoreExchangeDownloadResult[] = [];

    for (const key of keys) {
      const def = CORE_EXCHANGE_REPORTS_REGISTRY[key];
      const targetPath = path.join(targetDir, def.fileName);
      const res = await this.downloadReport(key, targetPath);
      results.push(res);
    }

    return results;
  }
}
