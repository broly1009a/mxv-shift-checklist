import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'ssh2';
import {
  IIngressPort,
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
  IngressFileDetail,
  decrypt,
  EXTERNAL_SYSTEM_ACM,
} from '../../../shared';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

@Injectable()
export class AcmSftpAdapter implements IIngressPort {
  private readonly logger = new Logger(AcmSftpAdapter.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  private async getSftpCredentials() {
    let host = process.env.ACM_SFTP_HOST || EXTERNAL_SYSTEM_ACM.sftpHost;
    let port = parseInt(process.env.ACM_SFTP_PORT || String(EXTERNAL_SYSTEM_ACM.sftpPort), 10);
    let username = process.env.ACM_SFTP_USER || '';
    let password = process.env.ACM_SFTP_PASS || '';
    let remoteDir = process.env.ACM_SFTP_REMOTE_DIR || EXTERNAL_SYSTEM_ACM.sftpRemoteDir;

    if (this.settingsService) {
      const rawCred = await this.settingsService.getSetting('bot_credentials_acm_sftp', '');
      if (rawCred) {
        try {
          const decrypted = JSON.parse(decrypt(rawCred));
          if (decrypted.host) host = decrypted.host;
          if (decrypted.port) port = parseInt(decrypted.port, 10);
          if (decrypted.username) username = decrypted.username;
          if (decrypted.password) password = decrypted.password;
          if (decrypted.remoteDir) remoteDir = decrypted.remoteDir;
        } catch {}
      }

      // Cũng kiểm tra bot_credentials_acm (nơi ConnectionSettings.tsx lưu thông tin SFTP)
      const rawAcm = await this.settingsService.getSetting('bot_credentials_acm', '');
      if (rawAcm) {
        try {
          const decryptedAcm = JSON.parse(decrypt(rawAcm));
          if (decryptedAcm.sftpHost) host = decryptedAcm.sftpHost;
          if (decryptedAcm.sftpPort) port = parseInt(decryptedAcm.sftpPort, 10);
          if (decryptedAcm.sftpUsername) username = decryptedAcm.sftpUsername;
          if (decryptedAcm.sftpPassword) password = decryptedAcm.sftpPassword;
          if (decryptedAcm.sftpRemoteDir) remoteDir = decryptedAcm.sftpRemoteDir;
        } catch {}
      }
    }

    return { host, port, username, password, remoteDir };
  }

  /**
   * Kiểm tra kết nối nhanh tới máy chủ SFTP (Pre-flight check)
   */
  public async testConnection(): Promise<boolean> {
    const creds = await this.getSftpCredentials();
    if (!creds.host) {
      throw new Error('Chưa cấu hình SFTP host cho ACM');
    }
    if (!creds.password) {
      throw new Error('Chưa cấu hình mật khẩu SFTP cho ACM (Vui lòng điền SFTP Password tại Quản trị Bot)');
    }
    return new Promise<boolean>((resolve, reject) => {
      const conn = new Client();
      const timeoutTimer = setTimeout(() => {
        conn.end();
        reject(new Error(`SFTP connection timeout sau 4000ms tới ${creds.host}:${creds.port}`));
      }, 4000);

      conn.on('ready', () => {
        clearTimeout(timeoutTimer);
        conn.end();
        resolve(true);
      });
      conn.on('error', (err) => {
        clearTimeout(timeoutTimer);
        conn.end();
        reject(err);
      });
      conn.connect({
        host: creds.host,
        port: creds.port,
        username: creds.username,
        password: creds.password,
        readyTimeout: 4000,
      });
    });
  }

  /**
   * Tải file Straits CSV và báo cáo XLS qua giao thức SFTP trực tiếp
   */
  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const targetDateStr = options?.targetDate || new Date().toISOString().split('T')[0];
    const outputDirectory =
      options?.targetDirectory || path.join(process.cwd(), 'data', 'backup', 'ACM');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const cleanDateHyphen = targetDateStr.split('T')[0]; // YYYY-MM-DD
    const [year, month, day] = cleanDateHyphen.split('-');
    const ddmmyyyy = `${day}${month}${year}`; // 19102026
    const yyyy_mm_dd = `${year}-${month}-${day}`;
    const csvSuffix = `_${ddmmyyyy}.csv`;
    const xlsPrefix = `${yyyy_mm_dd}_`;

    const creds = await this.getSftpCredentials();
    this.logger.log(`[AcmSftpAdapter] Bắt đầu tải file SFTP ACM từ ${creds.host}:${creds.port} (Phiên: ${targetDateStr}, Thư mục remote: ${creds.remoteDir})`);

    const files: IngressFileDetail[] = [];
    let sftpSuccess = false;

    if (creds.password && creds.host) {
      try {
        await new Promise<void>((resolve, reject) => {
          const conn = new Client();
          const timeoutTimer = setTimeout(() => {
            conn.end();
            reject(new Error(`SFTP connection timeout sau 8000ms tới ${creds.host}:${creds.port}`));
          }, 8000);

          conn.on('ready', () => {
            conn.sftp((err, sftp) => {
              if (err) {
                clearTimeout(timeoutTimer);
                conn.end();
                return reject(err);
              }

              sftp.readdir(creds.remoteDir, async (readdirErr, list) => {
                if (readdirErr) {
                  clearTimeout(timeoutTimer);
                  conn.end();
                  return reject(readdirErr);
                }

                // Lọc các file phù hợp: File CSV (*_<ddmmyyyy>.csv hoặc chứa 'straits') và File XLS (<yyyy-mm-dd>_*.xls)
                const candidateFiles = (list || []).filter((item) => {
                  const name = item.filename;
                  if (!name) return false;
                  const isCsvMatch =
                    name.toLowerCase().endsWith(csvSuffix.toLowerCase()) ||
                    (name.toLowerCase().includes('straits') &&
                      name.toLowerCase().endsWith('.csv') &&
                      !name.toLowerCase().includes('fill') &&
                      !name.toLowerCase().includes('order'));
                  const isXlsMatch =
                    name.toLowerCase().startsWith(xlsPrefix.toLowerCase()) &&
                    name.toLowerCase().endsWith('.xls');
                  return isCsvMatch || isXlsMatch;
                });

                if (candidateFiles.length === 0) {
                  clearTimeout(timeoutTimer);
                  conn.end();
                  return reject(new Error(`Không tìm thấy file Straits CSV (*_${ddmmyyyy}.csv) hoặc XLS (${yyyy_mm_dd}_*.xls) trong thư mục SFTP ${creds.remoteDir}`));
                }

                try {
                  for (const item of candidateFiles) {
                    const remotePath = path.posix.join(creds.remoteDir, item.filename);
                    const localPath = path.join(outputDirectory, item.filename);

                    await new Promise<void>((getRes, getRej) => {
                      sftp.fastGet(remotePath, localPath, (getErr) => {
                        if (getErr) return getRej(getErr);
                        getRes();
                      });
                    });

                    // Nếu là file Straits CSV có tên dài, tạo thêm alias Straits_<ddmmyyyy>.csv để tương thích tuyệt đối
                    if (item.filename.toLowerCase().includes('straits') && item.filename.toLowerCase().endsWith('.csv')) {
                      const aliasPath = path.join(outputDirectory, `Straits_${ddmmyyyy}.csv`);
                      if (aliasPath !== localPath && !fs.existsSync(aliasPath)) {
                        try {
                          fs.copyFileSync(localPath, aliasPath);
                        } catch {}
                      }
                    }
                  }

                  sftpSuccess = true;
                  clearTimeout(timeoutTimer);
                  conn.end();
                  resolve();
                } catch (dlErr) {
                  clearTimeout(timeoutTimer);
                  conn.end();
                  reject(dlErr);
                }
              });
            });
          });

          conn.on('error', (connErr) => {
            clearTimeout(timeoutTimer);
            reject(connErr);
          });

          conn.connect({
            host: creds.host,
            port: creds.port,
            username: creds.username,
            password: creds.password,
            readyTimeout: 7000,
          });
        });
      } catch (connErr: any) {
        this.logger.warn(`[AcmSftpAdapter] Kết nối SFTP trực tiếp gặp lỗi: ${connErr.message}`);
      }
    }

    // Quét lại thư mục local để thu thập các file đã tải
    if (fs.existsSync(outputDirectory)) {
      const localFiles = fs.readdirSync(outputDirectory);
      for (const fn of localFiles) {
        const isTargetCsv =
          fn.toLowerCase().endsWith(csvSuffix.toLowerCase()) ||
          fn.toLowerCase() === `straits_${ddmmyyyy}.csv`.toLowerCase();
        const isTargetXls =
          fn.toLowerCase().startsWith(xlsPrefix.toLowerCase()) && fn.toLowerCase().endsWith('.xls');

        if (isTargetCsv || isTargetXls) {
          const absPath = path.join(outputDirectory, fn);
          const stat = fs.statSync(absPath);
          files.push({
            fileName: fn,
            absolutePath: absPath,
            fileSize: stat.size,
            mtime: stat.mtime,
            category: 'ACM',
            metadata: {
              transport: 'SFTP_SSH2_CLIENT',
              host: creds.host,
              fileType: isTargetCsv ? 'STRAITS_CSV' : 'ACCOUNT_XLS',
            },
          });
        }
      }
    }

    if (!sftpSuccess && files.length === 0) {
      throw new Error(
        `Không thể kết nối hoặc không tìm thấy file Straits CSV/XLS trên máy chủ SFTP ${creds.host}:${creds.port} (Thư mục: ${creds.remoteDir}, Phiên: ${cleanDateHyphen}).`,
      );
    }

    const totalDurationMs = Date.now() - startTime;
    this.logger.log(`[AcmSftpAdapter] Tải hoàn tất ${files.length} file SFTP ACM tại: ${outputDirectory}`);

    return {
      success: files.length > 0,
      source: 'ACM',
      outputDirectory,
      files,
      downloadedAt: new Date(),
      durationMs: totalDurationMs,
      summary: `Đã hoàn tất tải ${files.length} file ACM qua giao thức SFTP trực tiếp`,
    };
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }
}
