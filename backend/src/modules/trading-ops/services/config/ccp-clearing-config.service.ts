import { Injectable, Logger, Optional } from '@nestjs/common';
import * as path from 'path';
import { ICcpClearingConfig } from '../../../../shared';
import { SystemSettingsService } from '../../../system-settings/system-settings.service';

@Injectable()
export class CcpClearingConfigService {
  private readonly logger = new Logger(CcpClearingConfigService.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  async getConfig(): Promise<ICcpClearingConfig> {
    const defaultDataDir = path.join(process.cwd(), 'data', 'backup', 'CCP');
    let ccpCreds: any = {};

    if (this.settingsService) {
      try {
        const ccpRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
        if (ccpRaw) ccpCreds = JSON.parse(ccpRaw);
      } catch (err: any) {
        this.logger.debug(`[CcpClearingConfig] Không thể parse bot_credentials_ccp: ${err.message}`);
      }
    }

    return {
      coreCcp: {
        baseUrl: ccpCreds.url || process.env.CORE_CCP_API_URL || 'https://coreccp.mxv.vn',
        username: ccpCreds.username || process.env.CORE_CCP_USER || '',
        password: ccpCreds.password || process.env.CORE_CCP_PASSWORD || '',
        storageDir: process.env.CCP_BACKUP_DIR || defaultDataDir,
        macroExportDir: path.join(defaultDataDir, 'Export'),
      },
      defaultUsdVndRate: Number(process.env.USD_VND_RATE || 0),
    };
  }
}
