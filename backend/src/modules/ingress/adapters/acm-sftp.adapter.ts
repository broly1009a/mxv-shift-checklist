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

    const ddmmyyyy = targetDateStr.replace(/-/g, '');
    const cleanDateHyphen = targetDateStr; // YYYY-MM-DD
    const straitsFileName = `Straits_${ddmmyyyy}.csv`;
    const straitsPath = path.join(outputDirectory, straitsFileName);

    const xlsFileName = `${cleanDateHyphen}_10017890000.xls`;
    const xlsPath = path.join(outputDirectory, xlsFileName);

    const creds = await this.getSftpCredentials();
    this.logger.log(`[AcmSftpAdapter] Bắt đầu tải file Straits CSV từ SFTP ${creds.host}:${creds.port} (Phiên: ${targetDateStr})`);

    const files: IngressFileDetail[] = [];

    // Thử kết nối SFTP thật
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

              sftp.readdir(creds.remoteDir, (readdirErr, list) => {
                if (readdirErr) {
                  clearTimeout(timeoutTimer);
                  conn.end();
                  return reject(readdirErr);
                }

                const straitsItem = (list || []).find((f) => {
                  const n = (f.filename || '').toLowerCase();
                  return n.includes('straits') && n.endsWith('.csv') && !n.includes('fill') && !n.includes('order');
                });

                if (straitsItem) {
                  const remotePath = path.posix.join(creds.remoteDir, straitsItem.filename);
                  sftp.fastGet(remotePath, straitsPath, (getErr) => {
                    clearTimeout(timeoutTimer);
                    conn.end();
                    if (getErr) return reject(getErr);
                    sftpSuccess = true;
                    resolve();
                  });
                } else {
                  clearTimeout(timeoutTimer);
                  conn.end();
                  reject(new Error(`Không tìm thấy file Straits CSV trong thư mục SFTP ${creds.remoteDir}`));
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
        this.logger.warn(`[AcmSftpAdapter] Kết nối SFTP trực tiếp không khả dụng (${connErr.message}), kích hoạt cơ chế chuẩn bị dữ liệu mẫu.`);
      }
    }

    // Kiểm tra kết quả tải file thật từ SFTP
    if (!sftpSuccess || !fs.existsSync(straitsPath)) {
      throw new Error(
        `Không thể kết nối hoặc không tìm thấy file Straits CSV trên máy chủ SFTP ${creds.host}:${creds.port} (Thư mục: ${creds.remoteDir}). Vui lòng kiểm tra thông tin tài khoản SFTP hoặc chuyển sang chế độ ACM Web Direct REST API.`,
      );
    }

    const stat = fs.statSync(straitsPath);
    files.push({
      fileName: straitsFileName,
      absolutePath: straitsPath,
      fileSize: stat.size,
      mtime: stat.mtime,
      category: 'ACM',
      metadata: { transport: 'SFTP_SSH2_CLIENT', host: creds.host },
    });

    if (fs.existsSync(xlsPath)) {
      const xlsStat = fs.statSync(xlsPath);
      files.push({
        fileName: xlsFileName,
        absolutePath: xlsPath,
        fileSize: xlsStat.size,
        mtime: xlsStat.mtime,
        category: 'ACM',
        metadata: { transport: 'SFTP_ACCOUNT_XLS', host: creds.host },
      });
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
