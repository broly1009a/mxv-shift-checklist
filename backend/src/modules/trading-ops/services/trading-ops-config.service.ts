import { Injectable, Logger, Optional } from '@nestjs/common';
import * as path from 'path';
import { ITradingOpsConfig } from '../../../shared';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

@Injectable()
export class TradingOpsConfigService {
  private readonly logger = new Logger(TradingOpsConfigService.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  async getConfig(): Promise<ITradingOpsConfig> {
    const defaultDataDir = path.join(process.cwd(), 'data', 'backup');

    let msystemCreds: any = {};
    let cqgCreds: any = {};
    let acmCreds: any = {};

    if (this.settingsService) {
      try {
        const msRaw = await this.settingsService.getSetting('bot_credentials_msystem', '');
        if (msRaw) msystemCreds = JSON.parse(msRaw);
      } catch (err: any) {
        this.logger.debug(`[TradingOpsConfig] Không thể parse bot_credentials_msystem: ${err.message}`);
      }

      try {
        const cqgRaw = await this.settingsService.getSetting('bot_credentials_cqg', '');
        if (cqgRaw) cqgCreds = JSON.parse(cqgRaw);
      } catch (err: any) {
        this.logger.debug(`[TradingOpsConfig] Không thể parse bot_credentials_cqg: ${err.message}`);
      }

      try {
        const acmRaw = await this.settingsService.getSetting('bot_credentials_acm', '');
        if (acmRaw) acmCreds = JSON.parse(acmRaw);
      } catch (err: any) {
        this.logger.debug(`[TradingOpsConfig] Không thể parse bot_credentials_acm: ${err.message}`);
      }
    }

    return {
      msystem: {
        baseUrl: msystemCreds.url || process.env.MS_BASE_URL || 'https://msystem.mxv.vn/',
        username: msystemCreds.username || process.env.MS_BOT_USER || '',
        password: msystemCreds.password || process.env.MS_BOT_PASSWORD || '',
        storageDir: process.env.MS_BACKUP_DIR || path.join(defaultDataDir, 'M-System'),
      },
      cqg: {
        baseUrl: cqgCreds.url || process.env.CQG_BASE_URL || 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
        accounts: [
          {
            accountId: 'CQG1',
            username: cqgCreds.username1 || process.env.CQG_ACCOUNT_1 || '',
            subfix: '',
          },
          {
            accountId: 'CQG2',
            username: cqgCreds.username2 || process.env.CQG_ACCOUNT_2 || '',
            subfix: '',
          },
        ],
        storageDir: process.env.CQG_BACKUP_DIR || path.join(defaultDataDir, 'CQG'),
        mergedDir: path.join(defaultDataDir, 'CQG', 'Merged'),
      },
      acm: {
        sftpHost: acmCreds.host || process.env.ACM_SFTP_HOST,
        sftpPort: Number(acmCreds.port || process.env.ACM_SFTP_PORT || 22),
        sftpUsername: acmCreds.username || process.env.ACM_SFTP_USER,
        sftpPassword: acmCreds.password || process.env.ACM_SFTP_PASSWORD,
        localDir: process.env.ACM_BACKUP_DIR || path.join(defaultDataDir, 'ACM'),
      },
      workingCalendarCheck: true,
    };
  }
}
