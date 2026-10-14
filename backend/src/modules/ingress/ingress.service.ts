import { Injectable, Logger, Optional } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import {
  IIngressPort,
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
  IngressFileDetail,
} from '../../shared';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { MSystemScraperService } from './scrapers/ms-scraper.service';
import { MSystemTabScraperService } from './scrapers/ms-tab-scraper.service';
import { CqgScraperService } from './scrapers/cqg-scraper.service';
import { AcmScraperService } from './scrapers/acm-scraper.service';
import { CcpScraperService } from './scrapers/ccp-scraper.service';
import { CoreExApiAdapter } from './adapters/coreex-api.adapter';
import { CoreCcpApiAdapter } from './adapters/coreccp-api.adapter';
import { AcmSftpAdapter } from './adapters/acm-sftp.adapter';

@Injectable()
export class IngressService implements IIngressPort {
  private readonly logger = new Logger(IngressService.name);

  constructor(
    private readonly msCoreScraper: MSystemScraperService,
    private readonly msTabScraper: MSystemTabScraperService,
    private readonly cqgScraper: CqgScraperService,
    private readonly acmScraper: AcmScraperService,
    private readonly ccpScraper: CcpScraperService,
    private readonly coreExApiAdapter: CoreExApiAdapter,
    private readonly coreCcpApiAdapter: CoreCcpApiAdapter,
    private readonly acmSftpAdapter: AcmSftpAdapter,
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  /**
   * Cổng thống nhất kéo dữ liệu cho toàn bộ hệ thống MXV Modular Monolith
   */
  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const outputDirectory =
      options?.targetDirectory || path.join(process.cwd(), 'data', 'ingress', source.toLowerCase());

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const files: IngressFileDetail[] = [];

    // Cấu hình Động từ CSDL: Ưu tiên đọc key 'ingress_mode' từ bảng system_settings
    let ingressMode = 'PLAYWRIGHT';
    if (this.settingsService) {
      ingressMode = await this.settingsService.getSetting(
        'ingress_mode',
        process.env.INGRESS_MODE || 'PLAYWRIGHT',
      );
    } else {
      ingressMode = process.env.INGRESS_MODE || 'PLAYWRIGHT';
    }

    // Feature Flag: Tắt Playwright và chuyển trực tiếp sang REST/SFTP API khi ingressMode = 'REST_API'
    if (ingressMode === 'REST_API') {
      this.logger.log(
        `[IngressService] Kích hoạt Direct API Mode từ CSDL cho nguồn "${source}" (Bỏ qua Playwright, không cần restart server)`,
      );
      if (source === 'MS' || source === 'CORE_EX') {
        return this.coreExApiAdapter.download('MS', { ...options, targetDirectory: outputDirectory });
      } else if (source === 'CCP' || source === 'CORE_CCP') {
        return this.coreCcpApiAdapter.download('CCP', { ...options, targetDirectory: outputDirectory });
      } else if (source === 'ACM') {
        return this.acmSftpAdapter.download('ACM', { ...options, targetDirectory: outputDirectory });
      }
    }

    this.logger.log(
      `[IngressService] Tiếp nhận yêu cầu kéo dữ liệu từ nguồn: "${source}" (Chế độ CSDL: ${ingressMode}), lưu tại: "${outputDirectory}"`,
    );

    switch (source) {
      case 'MS':
      case 'CORE_EX': {
        const msCreds = {
          username: process.env.MS_USERNAME || '',
          password: process.env.MS_PASSWORD || '',
          pin: process.env.MS_PIN || '',
        };
        const { browser, page } = await this.msCoreScraper.login(msCreds, {
          downloadDir: outputDirectory,
        });

        try {
          const targets =
            options?.reportCodes && options.reportCodes.length > 0
              ? options.reportCodes
              : ['TTM', 'TTTT', 'DSGD'];
          for (const target of targets) {
            const destPath = path.join(outputDirectory, `${target}.xlsx`);
            await this.msTabScraper.downloadByTarget(page, target, destPath);
            if (fs.existsSync(destPath)) {
              const stat = fs.statSync(destPath);
              files.push({
                fileName: path.basename(destPath),
                absolutePath: destPath,
                fileSize: stat.size,
                mtime: stat.mtime,
                category: 'MS',
              });
            }
          }
        } finally {
          await browser.close().catch(() => {});
        }
        break;
      }

      case 'CQG': {
        const account1 = {
          username: process.env.CQG1_USERNAME || '',
          password: process.env.CQG1_PASSWORD || '',
        };
        const account2 = {
          username: process.env.CQG2_USERNAME || '',
          password: process.env.CQG2_PASSWORD || '',
        };

        const result = await this.cqgScraper.downloadParallelAllRawFiles(
          outputDirectory,
          account1,
          account2,
        );

        for (const f of result.files) {
          files.push({
            fileName: f.name,
            absolutePath: f.path,
            fileSize: f.size,
            mtime: f.mtime,
            category: 'CQG',
          });
        }
        break;
      }

      case 'ACM': {
        const sftpOptions = {
          host: process.env.ACM_SFTP_HOST || 'sftp.mxv.com.vn',
          port: parseInt(process.env.ACM_SFTP_PORT || '2231', 10),
          username: process.env.ACM_SFTP_USER || '',
          password: process.env.ACM_SFTP_PASS || '',
          remoteDir: '/data/',
          localDir: outputDirectory,
        };

        const res = await this.acmScraper.downloadStraits(sftpOptions);
        files.push({
          fileName: res.fileName,
          absolutePath: res.filePath,
          fileSize: res.fileSize,
          mtime: new Date(),
          category: 'ACM',
        });
        break;
      }

      case 'CCP':
      case 'CORE_CCP': {
        const ccpCreds = {
          username: process.env.CCP_USERNAME || '',
          password: process.env.CCP_PASSWORD || '',
        };
        const ccpResults = await this.ccpScraper.downloadAll25Reports(outputDirectory, ccpCreds);
        for (const cf of ccpResults) {
          files.push({
            fileName: cf.fileName,
            absolutePath: cf.path,
            fileSize: cf.size,
            mtime: new Date(),
            category: 'CCP',
          });
        }
        break;
      }

      default:
        throw new Error(`[IngressService] Nguồn dữ liệu không được hỗ trợ: ${source}`);
    }

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `[IngressService] Kéo dữ liệu từ "${source}" hoàn tất. Đã lưu ${files.length} files (${durationMs}ms)`,
    );

    return {
      source,
      outputDirectory,
      success: files.length > 0,
      files,
      downloadedAt: new Date(),
      durationMs,
      summary: `Tải thành công ${files.length} file từ ${source}`,
    };
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }
}
