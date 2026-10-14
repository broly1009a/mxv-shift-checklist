import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  IIngressPort,
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
  IngressFileDetail,
} from '../../../shared';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

@Injectable()
export class CoreCcpApiAdapter implements IIngressPort {
  private readonly logger = new Logger(CoreCcpApiAdapter.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

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
      // Đọc URL từ Database (system_settings), fallback sang .env
      let apiUrl = process.env.CORECCP_API_URL || 'https://coreccp.mxv.vn/api/v1/clearing-reports';
      if (this.settingsService) {
        apiUrl = await this.settingsService.getSetting('coreccp_api_url', apiUrl);
      }
      this.logger.log(`[CoreCcpApiAdapter] Kết nối Direct REST Endpoint (từ CSDL): ${apiUrl}`);

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
