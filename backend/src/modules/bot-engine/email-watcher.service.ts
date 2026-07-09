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
  async checkEmailTask(target: string, condition: string): Promise<{ success: boolean; message: string }> {
    // 1. Resolve Target parameters (e.g. Subject, Sender)
    let filterSubject = '';
    let filterSender = '';
    try {
      const parsedTarget = JSON.parse(target);
      filterSubject = parsedTarget.subject || '';
      filterSender = parsedTarget.sender || '';
    } catch {
      filterSubject = target; // Fallback to raw string
    }

    // 2. Fetch MS Graph API credentials from settings (with environment fallback)
    const clientId = (await this.settingsService.getSetting('m365_client_id', '')) || process.env.MICROSOFT_CLIENT_ID || '';
    const clientSecret = (await this.settingsService.getSetting('m365_client_secret', '')) || process.env.MICROSOFT_CLIENT_SECRET || '';
    const tenantId = (await this.settingsService.getSetting('m365_tenant_id', '')) || process.env.MICROSOFT_TENANT_ID || '';
    const watcherEmail = (await this.settingsService.getSetting('m365_watcher_email', '')) || process.env.MICROSOFT_WATCHER_EMAIL || '';

    const isSimulation = !clientId || !clientSecret || !tenantId || !watcherEmail || process.env.SIMULATE_BOT_CHECKS === 'true';

    if (isSimulation) {
      this.logger.debug(`[Simulation] Checking mock email for Subject: "${filterSubject}", Sender: "${filterSender}"`);
      return this.checkMockEmail(filterSubject, filterSender, condition);
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

      const tokenData = await tokenRes.json() as any;
      const accessToken = tokenData.access_token;

      // 4. Query messages from user's mailbox received in the last 12 hours
      const timeLimit = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const filter = `receivedDateTime ge ${timeLimit}`;
      const select = 'subject,sender,bodyPreview,body';
      const url = `https://graph.microsoft.com/v1.0/users/${watcherEmail}/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=30`;

      const mailRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!mailRes.ok) {
        throw new Error(`Graph API query failed: ${mailRes.statusText}`);
      }

      const mailData = await mailRes.json() as any;
      const emails = mailData.value || [];

      // 5. Scan emails for subject, sender, and success condition
      // 5. Scan emails for subject, sender, and success condition
      for (const email of emails) {
        const subjectMatch = !filterSubject || email.subject.toLowerCase().includes(filterSubject.toLowerCase());
        const senderMatch = !filterSender || email.sender?.emailAddress?.address.toLowerCase() === filterSender.toLowerCase();

        if (subjectMatch && senderMatch) {
          const bodyContent = (email.body?.content || email.bodyPreview || '').toLowerCase();
          const conditionMatch = !condition || bodyContent.includes(condition.toLowerCase());

          if (conditionMatch) {
            let downloadMsg = '';
            const rawDownloadDir = await this.settingsService.getSetting('m365_download_directory', '');
            if (rawDownloadDir) {
              const downloadDir = this.formatDownloadDir(rawDownloadDir);
              try {
                const downloaded = await this.downloadAttachments(accessToken, watcherEmail, email.id, downloadDir);
                if (downloaded.length > 0) {
                  downloadMsg = `. Đã tải ${downloaded.length} file đính kèm về ${downloadDir}: ${downloaded.map(p => path.basename(p)).join(', ')}`;
                } else {
                  downloadMsg = `. Không tìm thấy file đính kèm nào để tải.`;
                }
              } catch (dlErr: any) {
                downloadMsg = `. Lỗi khi tải file đính kèm: ${dlErr.message}`;
                this.logger.error(`Error downloading attachments for email ${email.id}: ${dlErr.message}`);
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

    const data = await res.json() as any;
    const attachments = data.value || [];
    const downloadedFiles: string[] = [];

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    for (const attachment of attachments) {
      if (attachment['@odata.type'] === '#microsoft.graph.fileAttachment' && attachment.contentBytes) {
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
  private async checkMockEmail(subject: string, sender: string, condition: string): Promise<{ success: boolean; message: string }> {
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
        }
      ];
      fs.writeFileSync(mockFilePath, JSON.stringify(defaultMock, null, 2), 'utf8');
    }

    try {
      const mockData = JSON.parse(fs.readFileSync(mockFilePath, 'utf8'));
      for (const email of mockData) {
        const subjectMatch = !subject || email.subject.toLowerCase().includes(subject.toLowerCase());
        const senderMatch = !sender || email.sender.toLowerCase() === sender.toLowerCase();

        if (subjectMatch && senderMatch) {
          const bodyContent = (email.body || '').toLowerCase();
          const conditionMatch = !condition || bodyContent.includes(condition.toLowerCase());

          if (conditionMatch) {
            let downloadMsg = '';
            const rawDownloadDir = await this.settingsService.getSetting('m365_download_directory', '');
            if (rawDownloadDir) {
              const downloadDir = this.formatDownloadDir(rawDownloadDir);
              if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
              }

              // Create simulated files depending on the type of email
              let fileName = '';
              let fileContent = '';
              if (email.subject.toLowerCase().includes('eod') || email.subject.toLowerCase().includes('đối chiếu')) {
                fileName = `EOD_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                fileContent = 'Mock Excel EOD Content\nAccount,InitialMargin\nTK001,-50000\nTK002,150000\nTK003,-12000\nTK004,-450000';
              } else {
                fileName = `Job_Snapshot_${new Date().toISOString().split('T')[0]}.txt`;
                fileContent = 'Job Snapshot SUCCESS\nAll databases are backup ready.';
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
}
