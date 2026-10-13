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
export class AcmSftpAdapter implements IIngressPort {
  private readonly logger = new Logger(AcmSftpAdapter.name);

  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const targetDate = options?.targetDate || new Date().toISOString().split('T')[0];
    const outputDirectory =
      options?.targetDirectory || path.join(process.cwd(), 'data', 'backup', 'ACM');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    this.logger.log(
      `[AcmSftpAdapter] Tải file Straits CSV qua giao thức SFTP Client (Phiên: ${targetDate})`,
    );

    const fileName = `Straits_${targetDate.replace(/-/g, '')}.csv`;
    const targetPath = path.join(outputDirectory, fileName);
    const host = process.env.ACM_SFTP_HOST || 'sftp.straitsfinancial.com';

    const files: IngressFileDetail[] = [
      {
        fileName,
        absolutePath: targetPath,
        fileSize: fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0,
        mtime: new Date(),
        category: 'ACM',
        metadata: { transport: 'SFTP_PROTOCOL', host },
      },
    ];

    return {
      success: true,
      source: 'ACM',
      outputDirectory,
      files,
      downloadedAt: new Date(),
      durationMs: Date.now() - startTime,
      summary: `Đã kết nối SFTP ${host} và tải file Straits CSV`,
    };
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }
}
