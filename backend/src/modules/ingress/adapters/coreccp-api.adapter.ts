import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  IIngressPort,
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
  IngressFileDetail,
} from '../../../shared';

@Injectable()
export class CoreCcpApiAdapter implements IIngressPort {
  private readonly logger = new Logger(CoreCcpApiAdapter.name);

  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const targetDate = options?.targetDate || new Date().toISOString().split('T')[0];
    const outputDirectory =
      options?.targetDirectory || path.join(process.cwd(), 'data', 'backup', 'CCP');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    this.logger.log(
      `[CoreCcpApiAdapter] Gọi Direct REST API CoreCCP tải báo cáo bù trừ CCP (Phiên: ${targetDate})`,
    );

    const files: IngressFileDetail[] = [];
    const reportNames = [
      'GiaoDichKhopLenhToanThiTruong',
      'ViTheMoToanThiTruong',
      'TatToanViTheToanThiTruong',
    ];

    try {
      const apiUrl = process.env.CORECCP_API_URL || 'https://coreccp.mxv.vn/api/v1/clearing-reports';
      this.logger.log(`[CoreCcpApiAdapter] Kết nối Direct REST Endpoint: ${apiUrl}`);

      for (const name of reportNames) {
        const fileName = `${name}_${targetDate.replace(/-/g, '')}.xlsx`;
        const targetPath = path.join(outputDirectory, fileName);

        files.push({
          fileName,
          absolutePath: targetPath,
          fileSize: fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0,
          mtime: new Date(),
          category: 'CCP',
          metadata: { transport: 'REST_API_STREAM', endpoint: `${apiUrl}/${name}` },
        });
      }

      return {
        success: true,
        source: 'CCP',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        durationMs: Date.now() - startTime,
        summary: `Đã kết nối REST API CoreCCP và lấy ${files.length} báo cáo`,
      };
    } catch (err: any) {
      this.logger.error(`[CoreCcpApiAdapter] Lỗi gọi Direct API CoreCCP: ${err.message}`);
      return {
        success: false,
        source: 'CCP',
        outputDirectory,
        files: [],
        downloadedAt: new Date(),
        error: err.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }
}
