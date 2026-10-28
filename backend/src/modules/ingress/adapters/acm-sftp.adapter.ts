import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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

    let targetDateObj: Date;
    const rawTargetDate = (options as any)?.targetDate;
    if (rawTargetDate instanceof Date) {
      targetDateObj = rawTargetDate;
    } else if (typeof rawTargetDate === 'string' && rawTargetDate) {
      const parts = rawTargetDate.split('T')[0].replace(/\//g, '-').replace(/\./g, '-').split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          targetDateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          targetDateObj = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
      } else {
        targetDateObj = new Date(rawTargetDate);
      }
    } else {
      targetDateObj = new Date();
    }

    const year = targetDateObj.getFullYear().toString();
    const month = String(targetDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(targetDateObj.getDate()).padStart(2, '0');
    const ddmmyyyy = `${day}${month}${year}`; // 27102026
    const yyyy_mm_dd = `${year}-${month}-${day}`; // 2026-10-27
    const csvSuffix = `_${ddmmyyyy}.csv`;
    const xlsPrefix = `${yyyy_mm_dd}_`;

    const creds = await this.getSftpCredentials();
    this.logger.log(`[AcmSftpAdapter] Bắt đầu tải file SFTP ACM từ ${creds.host}:${creds.port} (Phiên: ${yyyy_mm_dd}, Thư mục remote: ${creds.remoteDir})`);

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

                // Lọc các file phù hợp BẮT BUỘC khớp đúng ngày phiên T (ddmmyyyy & yyyy_mm_dd)
                const candidateFiles = (list || []).filter((item) => {
                  const name = item.filename;
                  if (!name) return false;
                  const isCsvMatch =
                    (name.toLowerCase().endsWith(csvSuffix.toLowerCase()) ||
                      (name.toLowerCase().includes('straits') &&
                        name.includes(ddmmyyyy) &&
                        name.toLowerCase().endsWith('.csv'))) &&
                    !name.toLowerCase().includes('fill') &&
                    !name.toLowerCase().includes('order');
                  const isXlsMatch =
                    name.toLowerCase().startsWith(xlsPrefix.toLowerCase()) &&
                    name.toLowerCase().endsWith('.xls');
                  return isCsvMatch || isXlsMatch;
                });

                if (candidateFiles.length === 0) {
                  this.logger.log(
                    `[AcmSftpAdapter] Chưa tìm thấy file Straits CSV (*_${ddmmyyyy}.csv) hoặc XLS (${yyyy_mm_dd}_*.xls) thuộc phiên ${yyyy_mm_dd} trên SFTP Server (Sàn chưa chốt/upload phiên này). Bỏ qua không tải file T-1.`,
                  );
                  clearTimeout(timeoutTimer);
                  conn.end();
                  return resolve();
                }

                if (!fs.existsSync(outputDirectory)) {
                  fs.mkdirSync(outputDirectory, { recursive: true });
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

                    const stat = fs.statSync(localPath);
                    const isCsv = item.filename.toLowerCase().endsWith('.csv');
                    files.push({
                      fileName: item.filename,
                      absolutePath: localPath,
                      fileSize: stat.size,
                      mtime: stat.mtime,
                      category: 'ACM',
                      metadata: {
                        transport: 'SFTP_SSH2_CLIENT',
                        host: creds.host,
                        fileType: isCsv ? 'STRAITS_CSV' : 'ACCOUNT_XLS',
                      },
                    });

                    // Chỉ tạo alias Straits_<ddmmyyyy>.csv nếu file tải về đúng ngày ddmmyyyy của phiên T
                    if (
                      item.filename.toLowerCase().includes('straits') &&
                      isCsv &&
                      item.filename.includes(ddmmyyyy)
                    ) {
                      const aliasPath = path.join(outputDirectory, `Straits_${ddmmyyyy}.csv`);
                      if (aliasPath !== localPath && !fs.existsSync(aliasPath)) {
                        try {
                          fs.copyFileSync(localPath, aliasPath);
                          const aliasStat = fs.statSync(aliasPath);
                          files.push({
                            fileName: `Straits_${ddmmyyyy}.csv`,
                            absolutePath: aliasPath,
                            fileSize: aliasStat.size,
                            mtime: aliasStat.mtime,
                            category: 'ACM',
                            metadata: {
                              transport: 'SFTP_SSH2_CLIENT',
                              host: creds.host,
                              fileType: 'STRAITS_CSV',
                            },
                          });
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

    const totalDurationMs = Date.now() - startTime;
    if (files.length === 0) {
      const msg = `[AcmSftpAdapter] Chưa có file Straits CSV/XLS thuộc phiên ${yyyy_mm_dd} trên máy chủ SFTP ${creds.host}:${creds.port} (Sàn chưa chốt/upload phiên này). Đã bỏ qua, không tải file T-1.`;
      this.logger.log(msg);
      return {
        success: true,
        source: 'ACM',
        outputDirectory,
        files: [],
        downloadedAt: new Date(),
        durationMs: totalDurationMs,
        summary: msg,
      };
    }

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
