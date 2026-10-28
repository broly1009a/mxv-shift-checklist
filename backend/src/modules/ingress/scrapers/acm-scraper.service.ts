import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Client } from 'ssh2';
import { Browser, Page } from 'playwright-core';
import { BrowserLauncherHelper } from '../helpers/browser-launcher.helper';
import { inspectAcmFileContent } from '../../../shared/helpers/acm-session-validator.helper';

export interface IAcmSftpConnectionOptions {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  remoteDir?: string;
  localDir: string;
  targetDate?: Date;
}

export interface IAcmWebOptions {
  url: string;
  username: string;
  password?: string;
  destFile: string;
}

export interface IAcmDownloadResult {
  success: boolean;
  method: 'SFTP' | 'WEB';
  filePath: string;
  fileName: string;
  fileSize: number;
}

@Injectable()
export class AcmScraperService {
  private readonly logger = new Logger(AcmScraperService.name);

  /**
   * Tải file Straits CSV qua cổng SFTP (Phương thức ưu tiên hàng đầu)
   *
   * QUY CHUẨN NGHIỆP VỤ (AGENTS.md):
   * - Duy nhất nhận diện file chuẩn Straits CSV (chứa từ khóa "Straits", ví dụ: Straits.csv, Straits_23072026.csv).
   * - Tuyệt đối KHÔNG nhận nhầm Fill.xlsx hay Order.xlsx.
   */
  async downloadStraitsViaSftp(
    options: IAcmSftpConnectionOptions,
  ): Promise<IAcmDownloadResult> {
    const {
      host,
      port = 2231,
      username,
      password,
      privateKey,
      remoteDir = '/data/',
      localDir,
      targetDate = new Date(),
    } = options;

    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const ddmmyyyy = `${day}${month}${year}`;

    this.logger.log(`[ACM SFTP] Đang kết nối tới sftp://${username}@${host}:${port}...`);
    const conn = new Client();

    return new Promise<IAcmDownloadResult>((resolve, reject) => {
      conn.on('ready', () => {
        this.logger.log('[ACM SFTP] Kết nối SSH thành công. Mở subsystem SFTP...');
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          this.logger.log(`[ACM SFTP] Đọc thư mục từ xa: ${remoteDir}`);
          sftp.readdir(remoteDir, (readdirErr, list) => {
            if (readdirErr) {
              conn.end();
              return reject(readdirErr);
            }

            if (!list || !Array.isArray(list)) {
              conn.end();
              return reject(new Error('Danh sách file remote từ SFTP rỗng.'));
            }

            // BỘ LỌC NGHIỆP VỤ BẮT BUỘC: Chỉ lấy file có chứa 'straits' và đuôi '.csv'
            const straitsCandidates = list.filter((item) => {
              const name = item.filename;
              if (!name) return false;

              const lowerName = name.toLowerCase();
              const isStraits = lowerName.includes('straits');
              const isCsv = lowerName.endsWith('.csv');

              // Nghiêm cấm nhận nhầm Fill / Order
              const isNotFillOrOrder =
                !lowerName.includes('fill') && !lowerName.includes('order');

              return isStraits && isCsv && isNotFillOrOrder;
            });

            if (straitsCandidates.length === 0) {
              conn.end();
              return reject(
                new Error(
                  `[ACM SFTP] Không tìm thấy bất kỳ file Straits CSV nào trong ${remoteDir}. Tuyệt đối không fallback sang Fill/Order.`,
                ),
              );
            }

            // BẮT BUỘC KHỚP ĐÚNG PHIÊN T (ddmmyyyy): Tuyệt đối KHÔNG fallback sang file T-1
            const targetFileItem = straitsCandidates.find((item) =>
              item.filename.toLowerCase().includes(ddmmyyyy),
            );
            if (!targetFileItem) {
              conn.end();
              return reject(
                new Error(
                  `[ACM SFTP] Chưa tìm thấy file Straits CSV của phiên ${ddmmyyyy} trên SFTP Server (Sàn chưa chốt/upload phiên này). Bỏ qua không tải file T-1.`,
                ),
              );
            }

            const chosenFileName = targetFileItem.filename;
            const remoteFilePath = path.posix.join(remoteDir, chosenFileName);
            const localFilePath = path.join(localDir, chosenFileName);

            this.logger.log(`[ACM SFTP] Bắt đầu tải file: ${chosenFileName} -> ${localFilePath}`);
            sftp.fastGet(remoteFilePath, localFilePath, {}, (dlErr) => {
              conn.end();
              if (dlErr) {
                return reject(dlErr);
              }

              const stat = fs.statSync(localFilePath);

              // Kiểm tra sâu nội dung file vừa tải (Deep Content Validation)
              const contentCheck = inspectAcmFileContent(localFilePath, targetDate || new Date());
              if (contentCheck.isDateDetermined && !contentCheck.isValidSession) {
                this.logger.warn(
                  `[ACM SFTP Content Guard] File ${chosenFileName} chứa dữ liệu phiên ${contentCheck.detectedDateStr}, không phải phiên T ${contentCheck.expectedDateStr} (${contentCheck.reason}). Đang xóa file để bảo vệ thư mục.`,
                );
                try {
                  fs.unlinkSync(localFilePath);
                } catch {}
                return reject(
                  new Error(
                    `[ACM SFTP Content Guard] File ${chosenFileName} chứa dữ liệu phiên ${contentCheck.detectedDateStr}, không phải phiên T ${contentCheck.expectedDateStr} (${contentCheck.reason}). Đã xóa bỏ file.`,
                  ),
                );
              }

              this.logger.log(
                `[ACM SFTP] Tải thành công Straits CSV: ${localFilePath} (${(stat.size / 1024).toFixed(2)} KB)`,
              );

              resolve({
                success: true,
                method: 'SFTP',
                filePath: localFilePath,
                fileName: chosenFileName,
                fileSize: stat.size,
              });
            });
          });
        });
      });

      conn.on('error', (connErr) => {
        this.logger.error(`[ACM SFTP] Lỗi kết nối SFTP: ${connErr.message}`);
        reject(connErr);
      });

      const connectConfig: any = { host, port, username };
      if (privateKey) {
        connectConfig.privateKey = privateKey;
      } else if (password) {
        connectConfig.password = password;
      }
      conn.connect(connectConfig);
    });
  }

  /**
   * Tải file Straits qua Web ETP (Phương thức dự phòng khi SFTP mất kết nối)
   */
  async downloadStraitsViaWeb(options: IAcmWebOptions): Promise<IAcmDownloadResult> {
    const { url, username, password, destFile } = options;
    this.logger.log(`[ACM Web] Khởi chạy trình duyệt cào dự phòng ACM Web tại ${url}...`);

    const { browser, page } = await BrowserLauncherHelper.launchBrowser();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Điền thông tin đăng nhập ACM Web
      if (username && password) {
        const userInput = page.locator('input[type="text"], input[name="username"]').first();
        const passInput = page.locator('input[type="password"], input[name="password"]').first();
        if (await userInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await userInput.fill(username);
          await passInput.fill(password);
          await page.click('button[type="submit"], button.el-button--primary');
          await page.waitForTimeout(3000);
        }
      }

      // Tìm nút xuất / Export Nano Straits
      const exportBtn = page
        .locator('.el-button--info:has-text("Export"), button:has-text("Export"), button:has-text("Download")')
        .first();
      await exportBtn.waitFor({ state: 'visible', timeout: 20000 });

      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
      await exportBtn.click({ force: true });
      const download = await downloadPromise;

      const suggestedName = download.suggestedFilename();
      if (!suggestedName.toLowerCase().includes('straits') && !suggestedName.toLowerCase().endsWith('.csv')) {
        throw new Error(
          `[ACM Web] File tải về "${suggestedName}" không phải định dạng Straits CSV hợp lệ.`,
        );
      }

      const destFolder = path.dirname(destFile);
      if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

      await download.saveAs(destFile);
      const stat = fs.statSync(destFile);

      return {
        success: true,
        method: 'WEB',
        filePath: destFile,
        fileName: path.basename(destFile),
        fileSize: stat.size,
      };
    } finally {
      await browser.close().catch(() => {});
    }
  }

  /**
   * Tự động điều phối tải Straits: Ưu tiên SFTP, tự động Fallback sang Web nếu SFTP gặp sự cố
   */
  async downloadStraits(
    sftpOptions: IAcmSftpConnectionOptions,
    webOptions?: IAcmWebOptions,
  ): Promise<IAcmDownloadResult> {
    try {
      return await this.downloadStraitsViaSftp(sftpOptions);
    } catch (sftpErr: any) {
      this.logger.warn(
        `[ACM] Tải qua SFTP thất bại (${sftpErr.message}). ${webOptions ? 'Chuyển sang fallback Web...' : 'Không có cấu hình Web fallback.'}`,
      );

      if (webOptions) {
        return await this.downloadStraitsViaWeb(webOptions);
      }
      throw sftpErr;
    }
  }
}
