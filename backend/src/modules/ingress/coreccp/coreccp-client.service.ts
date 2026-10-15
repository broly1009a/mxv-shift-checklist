/**
 * ============================================================================
 * CORECCP-CLIENT.SERVICE.TS
 * ============================================================================
 * DỊCH VỤ FACADE ĐIỀU PHỐI TRUNG TÂM (UNIFIED CORECCP CLIENT FACADE)
 * Tự động phân luồng Kiểu 1 (Direct JSON), Kiểu 2 (Asynchronous Export + Socket)
 * và Kiểu 3 (Modal Crawling) cho toàn bộ 25 Báo cáo Maker CoreCCP.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import {
  CcpExportMechanism,
  CORECCP_25_MAKER_REPORTS,
  ICcpAuthSession,
  ICcpBatchDownloadProgress,
  ICcpCredentials,
  ICcpDownloadResult,
  ICcpReportDef,
} from './coreccp.types';
import { CoreCcpAuthService } from './coreccp-auth.service';
import { CoreCcpSocketClient } from './coreccp-socket.client';
import { CoreCcpRestClient } from './coreccp-rest.client';
import { CoreCcpCrawlerService } from './coreccp-crawler.service';

export interface IDownloadOptions {
  outputDirectory?: string;
  credentials?: ICcpCredentials;
  concurrency?: number;
  onProgress?: (progress: ICcpBatchDownloadProgress) => void;
}

@Injectable()
export class CoreCcpClientService {
  private readonly logger = new Logger(CoreCcpClientService.name);

  constructor(
    private readonly authService: CoreCcpAuthService,
    private readonly socketClient: CoreCcpSocketClient,
    private readonly restClient: CoreCcpRestClient,
    private readonly crawlerService: CoreCcpCrawlerService,
  ) {}

  /**
   * Tải một báo cáo duy nhất theo mã định danh (reportKey hoặc fileName)
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

    const outputDir = options.outputDirectory || path.join(process.cwd(), 'data', 'backup', 'CCP');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const targetFilePath = path.join(outputDir, reportDef.fileName);

    const creds = options.credentials || { username: 'hieptruong' };
    const baseUrl = creds.url || 'https://uat-coreccp.mxv.com.vn';

    this.logger.log(`\n========================================================================`);
    this.logger.log(`[CoreCCP Client] Bắt đầu tải: ${reportDef.fileName} (${reportDef.mechanism})`);
    this.logger.log(`========================================================================`);

    try {
      let buffer: Buffer | undefined;

      // ─── PHÂN LUỒNG XỬ LÝ THEO CƠ CHẾ ───────────────────────────────────
      switch (reportDef.mechanism) {
        // KIỂU 1: Gọi REST Search API pageSize 200,000 -> Convert JSON sang Excel
        case CcpExportMechanism.DIRECT_JSON_SEARCH: {
          const session = await this.authService.getValidSession(creds);
          const { rows } = await this.restClient.searchFullJson(
            session,
            reportDef.searchCode!,
            baseUrl,
            reportDef.route,
            reportDef.filterPayload,
          );
          await this.restClient.convertJsonToExcel(
            rows,
            reportDef.key,
            targetFilePath,
            reportDef.searchCode || reportDef.key,
          );
          buffer = fs.readFileSync(targetFilePath);
          break;
        }

        // KIỂU 2: Kích hoạt Export Job -> Lắng nghe Socket.IO bắt reportId -> Download binary
        case CcpExportMechanism.SERVER_SIDE_EXPORT: {
          const session = await this.authService.getValidSession(creds);

          // 1. Đảm bảo Socket.IO đã kết nối
          await this.socketClient.connect(session, baseUrl);

          // 2. Sinh fekey duy nhất
          const fekey = `${reportDef.searchCode}_${Date.now()}`;

          // 3. Đăng ký Promise chờ NotiSocket phản hồi
          const notiPromise = this.socketClient.waitForExportCompletion(fekey, 30000);

          // 4. Kích hoạt POST /ccp/export/create
          await this.restClient.createExportJob(
            session,
            reportDef.searchCode!,
            fekey,
            baseUrl,
            reportDef.route,
            reportDef.filterPayload,
          );

          // 5. Chờ Socket.IO bắt reportId
          const noti = await notiPromise;
          this.logger.log(`[CoreCCP Client] 🎯 Đã đón được Socket Report ID: ${noti.reportId}`);

          // 6. Tải file nhị phân qua /ccp/report/download/{id}
          buffer = await this.restClient.downloadReportBinary(session, noti.reportId, baseUrl, reportDef.route);
          fs.writeFileSync(targetFilePath, buffer);
          break;
        }

        // KIỂU 3: Cào Modal Nano Contract hoặc Modal Lịch sử tất toán
        case CcpExportMechanism.MODAL_DOM_EXTRACTION: {
          if (reportDef.contractCode) {
            await this.crawlerService.exportNanoContractModal(reportDef.contractCode, targetFilePath, creds);
          } else if (reportDef.key === 'TTTT') {
            await this.crawlerService.exportPnlExecutedHistory(targetFilePath, creds);
          }
          if (fs.existsSync(targetFilePath)) {
            buffer = fs.readFileSync(targetFilePath);
          }
          break;
        }
      }

      const fileSizeBytes = buffer ? buffer.length : (fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : 0);
      const durationMs = Date.now() - startTime;

      this.logger.log(`[CoreCCP Client] ✓ Tải thành công [${reportDef.fileName}] (${(fileSizeBytes / 1024).toFixed(1)} KB) trong ${durationMs}ms`);

      return {
        success: true,
        fileName: reportDef.fileName,
        filePath: targetFilePath,
        buffer,
        fileSizeBytes,
        mechanism: reportDef.mechanism,
        durationMs,
      };
    } catch (err: any) {
      this.logger.error(`[CoreCCP Client] ✗ Tải thất bại [${reportDef.fileName}]: ${err.message}`);
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
   * TẢI TRỌN GÓI TOÀN BỘ 25 BÁO CÁO CỦA MAKER CORECCP
   * Có cơ chế kiểm soát số luồng đồng thời (Concurrency Control)
   */
  async downloadAll25MakerReports(options: IDownloadOptions = {}): Promise<ICcpBatchDownloadProgress> {
    const reports = CORECCP_25_MAKER_REPORTS;
    const concurrency = options.concurrency || 3; // Mặc định chạy 3 job song song để không quá tải Gateway
    this.logger.log(`\n========================================================================`);
    this.logger.log(`   TIẾN HÀNH THU THẬP TRỌN BỘ 25 FILE BÁO CÁO MAKER (CONCURRENCY: ${concurrency})`);
    this.logger.log(`========================================================================\n`);

    const progress: ICcpBatchDownloadProgress = {
      total: reports.length,
      completed: 0,
      failed: 0,
      results: [],
    };

    // Chia nhóm thực thi song song
    for (let i = 0; i < reports.length; i += concurrency) {
      const chunk = reports.slice(i, i + concurrency);
      this.logger.log(`--- Đang xử lý lô ${Math.floor(i / concurrency) + 1}/${Math.ceil(reports.length / concurrency)} (${chunk.map((r) => r.fileName).join(', ')}) ---`);

      const promises = chunk.map((rpt) =>
        this.downloadReport(rpt, options).then((res) => {
          if (res.success) {
            progress.completed++;
          } else {
            progress.failed++;
          }
          progress.results.push(res);
          if (options.onProgress) options.onProgress(progress);
          return res;
        }),
      );

      await Promise.all(promises);
      // Nghỉ nhẹ 200ms giữa các lô
      await new Promise((r) => setTimeout(r, 200));
    }

    this.logger.log(`\n========================================================================`);
    this.logger.log(`   HOÀN THÀNH TẢI 25 BÁO CÁO: THÀNH CÔNG ${progress.completed}/${progress.total} (THẤT BẠI: ${progress.failed})`);
    this.logger.log(`========================================================================\n`);

    return progress;
  }

  /**
   * Tra cứu định nghĩa báo cáo trong Registry
   */
  private findReportDef(keyOrFileName: string): ICcpReportDef | undefined {
    return CORECCP_25_MAKER_REPORTS.find(
      (r) =>
        r.key.toLowerCase() === keyOrFileName.toLowerCase() ||
        r.fileName.toLowerCase() === keyOrFileName.toLowerCase() ||
        r.searchCode?.toLowerCase() === keyOrFileName.toLowerCase(),
    );
  }
}
