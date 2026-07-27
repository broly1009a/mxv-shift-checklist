import { Injectable, Logger } from '@nestjs/common';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailWatcherService {
  private readonly logger = new Logger(EmailWatcherService.name);

  constructor(private readonly settingsService: SystemSettingsService) {}

  /**
   * Check if email condition is met for a given task configuration.
   */
  async checkEmailTask(
    target: string,
    condition: string,
  ): Promise<{ success: boolean; message: string }> {
    // 1. Resolve Target parameters (e.g. Subject, Sender, and optional custom downloadDir)
    let filterSubject = '';
    let filterSender = '';
    let customDownloadDir = '';
    try {
      const parsedTarget = JSON.parse(target);
      filterSubject = parsedTarget.subject || '';
      filterSender = parsedTarget.sender || '';
      customDownloadDir = parsedTarget.downloadDir || '';
    } catch {
      filterSubject = target; // Fallback to raw string
    }

    // 2. Fetch MS Graph API credentials from settings (with environment fallback)
    const clientId =
      (await this.settingsService.getSetting('m365_client_id', '')) ||
      process.env.MICROSOFT_CLIENT_ID ||
      '';
    const clientSecret =
      (await this.settingsService.getSetting('m365_client_secret', '')) ||
      process.env.MICROSOFT_CLIENT_SECRET ||
      '';
    const tenantId =
      (await this.settingsService.getSetting('m365_tenant_id', '')) ||
      process.env.MICROSOFT_TENANT_ID ||
      '';
    const watcherEmail =
      (await this.settingsService.getSetting('m365_watcher_email', '')) ||
      process.env.MICROSOFT_WATCHER_EMAIL ||
      '';

    const isSimulation =
      !clientId ||
      !clientSecret ||
      !tenantId ||
      !watcherEmail ||
      process.env.SIMULATE_BOT_CHECKS === 'true';

    if (isSimulation) {
      this.logger.debug(
        `[Simulation] Checking mock email for Subject: "${filterSubject}", Sender: "${filterSender}"`,
      );
      return this.checkMockEmail(
        filterSubject,
        filterSender,
        condition,
        customDownloadDir,
      );
    }

    try {
      // 3. Authenticate with Microsoft OAuth2
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('scope', 'https://graph.microsoft.com/.default');
      params.append('client_secret', clientSecret);
      params.append('grant_type', 'client_credentials');

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (!tokenRes.ok) {
        throw new Error(`Auth failed: ${tokenRes.statusText}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // 4. Query messages from user's mailbox received in the last 12 hours
      const timeLimit = new Date(
        Date.now() - 12 * 60 * 60 * 1000,
      ).toISOString();
      const filter = `receivedDateTime ge ${timeLimit}`;
      const select = 'subject,sender,bodyPreview,body';
      const url = `https://graph.microsoft.com/v1.0/users/${watcherEmail}/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=30`;

      const mailRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!mailRes.ok) {
        throw new Error(`Graph API query failed: ${mailRes.statusText}`);
      }

      const mailData = await mailRes.json();
      const emails = mailData.value || [];

      // 5. Scan emails for subject, sender, and success condition
      for (const email of emails) {
        const subjectMatch =
          !filterSubject ||
          email.subject.toLowerCase().includes(filterSubject.toLowerCase());
        const senderMatch =
          !filterSender ||
          email.sender?.emailAddress?.address.toLowerCase() ===
            filterSender.toLowerCase();

        if (subjectMatch && senderMatch) {
          const bodyContent = (
            email.body?.content ||
            email.bodyPreview ||
            ''
          ).toLowerCase();
          const conditionMatch =
            !condition || bodyContent.includes(condition.toLowerCase());

          if (conditionMatch) {
            let downloadMsg = '';
            const rawDownloadDir =
              customDownloadDir ||
              (await this.settingsService.getSetting(
                'm365_download_directory',
                '',
              ));
            if (rawDownloadDir) {
              const downloadDir = this.formatDownloadDir(rawDownloadDir);
              try {
                const downloaded = await this.downloadAttachments(
                  accessToken,
                  watcherEmail,
                  email.id,
                  downloadDir,
                );
                if (downloaded.length > 0) {
                  downloadMsg = `. Đã tải ${downloaded.length} file đính kèm về ${downloadDir}: ${downloaded.map((p) => path.basename(p)).join(', ')}`;
                } else {
                  downloadMsg = `. Không tìm thấy file đính kèm nào để tải.`;
                }
              } catch (dlErr: any) {
                downloadMsg = `. Lỗi khi tải file đính kèm: ${dlErr.message}`;
                this.logger.error(
                  `Error downloading attachments for email ${email.id}: ${dlErr.message}`,
                );
              }
            }

            return {
              success: true,
              message: `Tìm thấy email khớp: Subject: "${email.subject}", Sender: "${email.sender?.emailAddress?.address}"${downloadMsg}`,
            };
          }
        }
      }

      return {
        success: false,
        message: `Không tìm thấy email nào khớp với tiêu chí trong 12 giờ qua.`,
      };
    } catch (error: any) {
      this.logger.error(`Error in EmailWatcherService: ${error.message}`);
      return {
        success: false,
        message: `Lỗi kết nối Microsoft Graph API: ${error.message}. Đang chạy chế độ mô phỏng fallback...`,
      };
    }
  }

  /**
   * Helper to download attachments from MS Graph API.
   */
  async downloadAttachments(
    accessToken: string,
    watcherEmail: string,
    messageId: string,
    downloadDir: string,
  ): Promise<string[]> {
    const url = `https://graph.microsoft.com/v1.0/users/${watcherEmail}/messages/${messageId}/attachments`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch attachments: ${res.statusText}`);
    }

    const data = await res.json();
    const attachments = data.value || [];
    const downloadedFiles: string[] = [];

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    for (const attachment of attachments) {
      if (
        attachment['@odata.type'] === '#microsoft.graph.fileAttachment' &&
        attachment.contentBytes
      ) {
        const filePath = path.join(downloadDir, attachment.name);
        const buffer = Buffer.from(attachment.contentBytes, 'base64');
        fs.writeFileSync(filePath, buffer);
        downloadedFiles.push(filePath);
        this.logger.log(`Tải file đính kèm thành công: ${filePath}`);
      }
    }

    return downloadedFiles;
  }

  /**
   * Formats dynamic placeholders in download folder path.
   */
  private formatDownloadDir(rawDir: string): string {
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000); // Vietnam time (GMT+7)
    const yyyy = today.getUTCFullYear().toString();
    const mm = (today.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = today.getUTCDate().toString().padStart(2, '0');

    return rawDir
      .replace(/\${YYYY}/g, yyyy)
      .replace(/\${MM}/g, mm)
      .replace(/\${DD}/g, dd)
      .replace(/\${yyyy}/g, yyyy)
      .replace(/\${mm}/g, mm)
      .replace(/\${dd}/g, dd);
  }

  /**
   * Helper to check mock email from mock data file.
   */
  private async checkMockEmail(
    subject: string,
    sender: string,
    condition: string,
    customDownloadDir?: string,
  ): Promise<{ success: boolean; message: string }> {
    const mockFilePath = path.join(__dirname, 'mock-emails.json');
    if (!fs.existsSync(mockFilePath)) {
      // Create empty mock file if it doesn't exist
      const defaultMock = [
        {
          id: '1',
          sender: 'anhdao@mxv.vn',
          subject: 'Job Snapshot - THÀNH CÔNG',
          body: 'Job Snapshot completed successfully on production database.',
          receivedDateTime: new Date().toISOString(),
        },
        {
          id: '2',
          sender: 'backoffice@mxv.vn',
          subject: 'Báo cáo chênh lệch KLGD CQG vs M-System',
          body: 'Kết quả đối chiếu khớp lệnh: SUCCESS. Không phát hiện chênh lệch.',
          receivedDateTime: new Date().toISOString(),
        },
      ];
      fs.writeFileSync(
        mockFilePath,
        JSON.stringify(defaultMock, null, 2),
        'utf8',
      );
    }

    try {
      const mockData = JSON.parse(fs.readFileSync(mockFilePath, 'utf8'));
      for (const email of mockData) {
        const subjectMatch =
          !subject ||
          email.subject.toLowerCase().includes(subject.toLowerCase());
        const senderMatch =
          !sender || email.sender.toLowerCase() === sender.toLowerCase();

        if (subjectMatch && senderMatch) {
          const bodyContent = (email.body || '').toLowerCase();
          const conditionMatch =
            !condition || bodyContent.includes(condition.toLowerCase());

          if (conditionMatch) {
            let downloadMsg = '';
            const rawDownloadDir =
              customDownloadDir ||
              (await this.settingsService.getSetting(
                'm365_download_directory',
                '',
              ));
            if (rawDownloadDir) {
              const downloadDir = this.formatDownloadDir(rawDownloadDir);
              if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
              }

              // Create simulated files depending on the type of email
              let fileName = '';
              let fileContent = '';
              if (
                email.subject.toLowerCase().includes('eod') ||
                email.subject.toLowerCase().includes('đối chiếu')
              ) {
                fileName = `EOD_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                fileContent =
                  'Mock Excel EOD Content\nAccount,InitialMargin\nTK001,-50000\nTK002,150000\nTK003,-12000\nTK004,-450000';
              } else {
                fileName = `Job_Snapshot_${new Date().toISOString().split('T')[0]}.txt`;
                fileContent =
                  'Job Snapshot SUCCESS\nAll databases are backup ready.';
              }

              const filePath = path.join(downloadDir, fileName);
              fs.writeFileSync(filePath, fileContent, 'utf8');
              downloadMsg = `. [Mô Phỏng] Đã sinh file đính kèm: ${fileName} tại ${downloadDir}`;
            }

            return {
              success: true,
              message: `[Mô Phỏng] Tìm thấy email: "${email.subject}" từ "${email.sender}"${downloadMsg}`,
            };
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to parse mock emails file: ${err.message}`);
    }

    return {
      success: false,
      message: `[Mô Phỏng] Không tìm thấy mock email khớp cho: Subject "${subject}" từ "${sender}"`,
    };
  }

  /**
   * Fetch the latest matching email from MS Graph API or Mock Emails
   */
  async getLatestEmail(
    subject: string,
    sender: string,
  ): Promise<{ subject: string; sender: string; body: string } | null> {
    const clientId =
      (await this.settingsService.getSetting('m365_client_id', '')) ||
      process.env.MICROSOFT_CLIENT_ID ||
      '';
    const clientSecret =
      (await this.settingsService.getSetting('m365_client_secret', '')) ||
      process.env.MICROSOFT_CLIENT_SECRET ||
      '';
    const tenantId =
      (await this.settingsService.getSetting('m365_tenant_id', '')) ||
      process.env.MICROSOFT_TENANT_ID ||
      '';
    const watcherEmail =
      (await this.settingsService.getSetting('m365_watcher_email', '')) ||
      process.env.MICROSOFT_WATCHER_EMAIL ||
      '';

    const isSimulation =
      !clientId ||
      !clientSecret ||
      !tenantId ||
      !watcherEmail ||
      process.env.SIMULATE_BOT_CHECKS === 'true';

    if (isSimulation) {
      const mockFilePath = path.join(__dirname, 'mock-emails.json');
      if (fs.existsSync(mockFilePath)) {
        try {
          const mockData = JSON.parse(fs.readFileSync(mockFilePath, 'utf8'));
          for (const email of mockData) {
            const subjectMatch =
              !subject ||
              email.subject.toLowerCase().includes(subject.toLowerCase());
            const senderMatch =
              !sender || email.sender.toLowerCase() === sender.toLowerCase();
            if (subjectMatch && senderMatch) {
              return {
                subject: email.subject,
                sender: email.sender,
                body: email.body || '',
              };
            }
          }
        } catch (err: any) {
          this.logger.error(`Error reading mock emails: ${err.message}`);
        }
      }
      return null;
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('scope', 'https://graph.microsoft.com/.default');
      params.append('client_secret', clientSecret);
      params.append('grant_type', 'client_credentials');

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (!tokenRes.ok) {
        throw new Error(`Auth failed: ${tokenRes.statusText}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      const timeLimit = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      const filter = `receivedDateTime ge ${timeLimit}`;
      const select = 'subject,sender,body';
      const url = `https://graph.microsoft.com/v1.0/users/${watcherEmail}/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=10`;

      const mailRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!mailRes.ok) {
        throw new Error(`Graph API query failed: ${mailRes.statusText}`);
      }

      const mailData = await mailRes.json();
      const emails = mailData.value || [];

      for (const email of emails) {
        const subjectMatch =
          !subject ||
          email.subject.toLowerCase().includes(subject.toLowerCase());
        const senderMatch =
          !sender ||
          email.sender?.emailAddress?.address.toLowerCase() ===
            sender.toLowerCase();

        if (subjectMatch && senderMatch) {
          return {
            subject: email.subject,
            sender: email.sender?.emailAddress?.address || '',
            body: email.body?.content || email.bodyPreview || '',
          };
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in getLatestEmail: ${err.message}`);
    }
    return null;
  }

  /**
   * NEW DELEGATED MECHANISM: Check if email condition is met using a Delegated Refresh Token.
   * This is used for UAT testing without requiring IT to grant tenant-wide Application permissions.
   */
  async checkEmailTaskDelegated(
    target: string,
    condition: string,
  ): Promise<{ success: boolean; message: string }> {
    // 1. Resolve Target parameters
    let filterSubject = '';
    let filterSender = '';
    let customDownloadDir = '';
    try {
      const parsedTarget = JSON.parse(target);
      filterSubject = parsedTarget.subject || '';
      filterSender = parsedTarget.sender || '';
      customDownloadDir = parsedTarget.downloadDir || '';
    } catch {
      filterSubject = target;
    }

    // 2. Fetch credentials
    const clientId =
      (await this.settingsService.getSetting('m365_client_id', '')) ||
      process.env.MICROSOFT_CLIENT_ID ||
      '';
    const clientSecret =
      (await this.settingsService.getSetting('m365_client_secret', '')) ||
      process.env.MICROSOFT_CLIENT_SECRET ||
      '';
    const tenantId =
      (await this.settingsService.getSetting('m365_tenant_id', '')) ||
      process.env.MICROSOFT_TENANT_ID ||
      '';
    const watcherEmail =
      (await this.settingsService.getSetting('m365_watcher_email', '')) ||
      process.env.MICROSOFT_WATCHER_EMAIL ||
      '';

    const isSimulation =
      !clientId ||
      !clientSecret ||
      !tenantId ||
      !watcherEmail ||
      process.env.SIMULATE_BOT_CHECKS === 'true';

    if (isSimulation) {
      this.logger.debug(
        `[Simulation-Delegated] Checking mock email for Subject: "${filterSubject}", Sender: "${filterSender}"`,
      );
      return this.checkMockEmail(
        filterSubject,
        filterSender,
        condition,
        customDownloadDir,
      );
    }

    try {
      // 3. Get Delegated Access Token using Refresh Token
      const accessToken = await this.getAccessTokenDelegated(clientId, clientSecret, tenantId);

      // 4. Query messages from user's mailbox received in the last 12 hours
      const timeLimit = new Date(
        Date.now() - 12 * 60 * 60 * 1000,
      ).toISOString();
      const filter = `receivedDateTime ge ${timeLimit}`;
      const select = 'subject,sender,bodyPreview,body';
      const url = `https://graph.microsoft.com/v1.0/users/${watcherEmail}/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=30`;

      const mailRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!mailRes.ok) {
        throw new Error(`Graph API query failed: ${mailRes.statusText}`);
      }

      const mailData = await mailRes.json();
      const emails = mailData.value || [];

      // 5. Scan emails for subject, sender, and success condition
      for (const email of emails) {
        const subjectMatch =
          !filterSubject ||
          email.subject.toLowerCase().includes(filterSubject.toLowerCase());
        const senderMatch =
          !filterSender ||
          email.sender?.emailAddress?.address.toLowerCase() ===
            filterSender.toLowerCase();

        if (subjectMatch && senderMatch) {
          const bodyContent: string = (
            email.body?.content ||
            email.bodyPreview ||
            ''
          ).toLowerCase();

          const lines = bodyContent.split('\n');
          let conditionMet = false;
          let matchedSnippet = '';

          if (condition.startsWith('body_contains:')) {
            const keyword = condition.replace('body_contains:', '').trim().toLowerCase();
            conditionMet = bodyContent.includes(keyword);
            if (conditionMet) {
              matchedSnippet = `Nội dung thư chứa từ khóa "${keyword}"`;
            }
          } else if (condition.startsWith('body_regex:')) {
            const regexStr = condition.replace('body_regex:', '').trim();
            const regex = new RegExp(regexStr, 'i');
            conditionMet = regex.test(bodyContent);
            if (conditionMet) {
              matchedSnippet = `Nội dung thư khớp biểu thức chính quy: /${regexStr}/`;
            }
          } else if (condition.startsWith('body_line_match:')) {
            const matchStr = condition.replace('body_line_match:', '').trim().toLowerCase();
            const matchingLine = lines.find((line) => line.toLowerCase().includes(matchStr));
            if (matchingLine) {
              conditionMet = true;
              matchedSnippet = `Dòng khớp: "${matchingLine.trim()}"`;
            }
          }

          if (conditionMet) {
            // Downloader attachments
            await this.downloadAttachments(email.id, watcherEmail, accessToken, customDownloadDir);
            return {
              success: true,
              message: `Đã tìm thấy email khớp: "${email.subject}". ${matchedSnippet}`,
            };
          }
        }
      }

      return {
        success: false,
        message: `Đã quét hòm thư nhưng không tìm thấy email nào khớp tiêu đề "${filterSubject}" và người gửi "${filterSender}" đáp ứng điều kiện: "${condition}"`,
      };
    } catch (err: any) {
      this.logger.error(`Error in checkEmailTaskDelegated: ${err.message}`);
      return {
        success: false,
        message: `Lỗi kết nối kiểm tra email (Delegated): ${err.message}`,
      };
    }
  }

  /**
   * Helper to retrieve Microsoft Graph Access Token using Refresh Token flow.
   * Auto-rotates and saves the new refresh token to the database settings.
   */
  private async getAccessTokenDelegated(
    clientId: string,
    clientSecret: string,
    tenantId: string,
  ): Promise<string> {
    const refreshToken =
      (await this.settingsService.getSetting('m365_refresh_token', '')) ||
      process.env.MICROSOFT_REFRESH_TOKEN ||
      '';

    if (!refreshToken) {
      throw new Error("Không tìm thấy m365_refresh_token trong Database hoặc MICROSOFT_REFRESH_TOKEN trong file .env!");
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('scope', 'https://graph.microsoft.com/.default');

    this.logger.debug(`[M365-DELEGATED] Requesting new access token with Refresh Token...`);
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      const errorMsg = `Xác thực bằng Refresh Token thất bại (HTTP ${tokenRes.status}): ${errText}`;
      
      // If 400/401, it is a permanent credentials invalidation (expired or revoked token)
      if (tokenRes.status === 400 || tokenRes.status === 401) {
        await this.settingsService.sendM365TokenExpiredAlert(errorMsg);
      }
      
      throw new Error(errorMsg);
    }

    const tokenData = await tokenRes.json();
    if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
      this.logger.log(`[M365-DELEGATED] Tự động cập nhật Refresh Token mới vào Database.`);
      await this.settingsService.setSetting('m365_refresh_token', tokenData.refresh_token);
      await this.settingsService.setSetting('m365_token_renewed_at', new Date().toISOString());
      await this.settingsService.setSetting('m365_token_error_sent_at', '1970-01-01T00:00:00.000Z'); // Clear warning throttle timestamp on success
    }
    return tokenData.access_token;
  }
}
