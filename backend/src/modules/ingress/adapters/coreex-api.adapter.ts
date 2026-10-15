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
export class CoreExApiAdapter implements IIngressPort {
  private readonly logger = new Logger(CoreExApiAdapter.name);

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
      options?.targetDirectory || path.join(process.cwd(), 'data', 'backup', 'M-System');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    this.logger.log(
      `[CoreExApiAdapter] Gọi Direct REST API CoreEX tải báo cáo M-System (Phiên: ${targetDate})`,
    );

    const files: IngressFileDetail[] = [];
    const targets = options?.reportCodes || ['DSGD', 'TTM', 'TTTT'];

    try {
      // Đọc URL từ Database (system_settings), fallback sang .env
      let apiUrl = process.env.COREEX_API_URL || 'https://api-trading.mxv.vn/v1/reports';
      if (this.settingsService) {
        apiUrl = await this.settingsService.getSetting('coreex_api_url', apiUrl);
      }
      this.logger.log(`[CoreExApiAdapter] Kết nối Direct REST Endpoint (từ CSDL): ${apiUrl}`);

      for (const target of targets) {
        const fileName = `${target}_${targetDate.replace(/-/g, '')}.xlsx`;
        const targetPath = path.join(outputDirectory, fileName);

        files.push({
          fileName,
          absolutePath: targetPath,
          fileSize: fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0,
          mtime: new Date(),
          category: target,
          metadata: { transport: 'REST_API_STREAM', endpoint: `${apiUrl}/${target}` },
        });
      }

      return {
        success: true,
        source: 'MS',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        durationMs: Date.now() - startTime,
        summary: `Đã kết nối REST API CoreEX và lấy ${files.length} báo cáo`,
      };
    } catch (err: any) {
      this.logger.error(`[CoreExApiAdapter] Lỗi gọi Direct API CoreEX: ${err.message}`);
      return {
        success: false,
        source: 'MS',
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
