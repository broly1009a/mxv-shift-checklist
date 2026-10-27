import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { RpaScraperService } from '../scrapers/rpa-scraper.service';
import { OmsWatcherService } from '../../trading-ops/services/oms/oms-watcher.service';
import { AgentController } from './ingress-agent.controller';
import { encrypt, decrypt } from '../../../shared/helpers/crypto';

@Controller(['api/v1/ingress', 'api/v1/bot-engine'])
@UseGuards(JwtAuthGuard)
export class IngressConfigController {
  private readonly logger = new Logger(IngressConfigController.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly rpaService: RpaScraperService,
    private readonly omsWatcherService: OmsWatcherService,
  ) {}

  /**
   * Retrieves bot configurations, URLs, and masked credentials.
   */
  @Get('config')
  async getConfig() {
    const msystemRaw = await this.settingsService.getSetting(
      'bot_credentials_msystem',
      '',
    );
    const cqgRaw = await this.settingsService.getSetting(
      'bot_credentials_cqg',
      '',
    );
    const acmRaw = await this.settingsService.getSetting(
      'bot_credentials_acm',
      '',
    );
    const castRaw = await this.settingsService.getSetting(
      'bot_credentials_cast',
      '',
    );
    const ccpRaw = await this.settingsService.getSetting(
      'bot_credentials_ccp',
      '',
    );
    const ceRaw = await this.settingsService.getSetting(
      'bot_credentials_ce',
      '',
    );

    let msystem = {
      url: '',
      username: '',
      password: '',
      pin: '',
    };
    let cqg = {
      url: 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
      urlPrice: 'https://mdemo.cqg.com/cqg/desktop/logon?ref=forced',
      urlTrade: 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
      username: '',     // CQG Price (mxvprice) - chỉ xem giá
      password: '',
      username1: '',    // CQG1 Trade - tải FR1/PS1/OP1/OD1
      password1: '',
      username2: '',    // CQG3 Trade - tải FR2/PS2/OP2/OD2
      password2: '',
    };
    let acm = {
      url: '',
      orderUrl: '',
      fillUrl: '',
      username: '',
      password: '',
      geminiApiKey: '',
      downloadUrl: '',
      downloadBtnSelector: '',
      sftpHost: '',
      sftpPort: '2231',
      sftpUsername: '',
      sftpPassword: '',
      sftpRemoteDir: '',
      sftpFileExtensions: '',
    };
    let cast = {
      url: '',
      username: '',
      password: '',
    };
    let ccp = {
      url: '',
      username: '',
      password: '',
      outputDir: 'backupCCP',
    };
    let ce = {
      url: '',
      username: '',
      password: '',
      outputDir: 'backupCE',
    };

    if (msystemRaw) {
      try {
        const decrypted = JSON.parse(decrypt(msystemRaw));
        msystem = {
          url: decrypted.url || '',
          username: decrypted.username || '',
          password: decrypted.password ? '********' : '',
          pin: decrypted.pin ? '****' : '',
        };
      } catch (err) {}
    }

    if (cqgRaw) {
      try {
        const decrypted = JSON.parse(decrypt(cqgRaw));
        cqg = {
          url: decrypted.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
          urlPrice: decrypted.urlPrice || decrypted.url || 'https://mdemo.cqg.com/cqg/desktop/logon?ref=forced',
          urlTrade: decrypted.urlTrade || decrypted.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
          username:  decrypted.username  || '',            // CQG Price (mxvprice)
          password:  decrypted.password  ? '********' : '',
          username1: decrypted.username1 || '',            // CQG1 Trade
          password1: decrypted.password1 ? '********' : '',
          username2: decrypted.username2 || decrypted.usernameCQG2 || '', // CQG3 Trade
          password2: decrypted.password2 || decrypted.passwordCQG2 ? '********' : '',
        };
      } catch (err) {}
    }

    if (acmRaw) {
      try {
        const decrypted = JSON.parse(decrypt(acmRaw));
        acm = {
          url: decrypted.url || '',
          orderUrl: decrypted.orderUrl || '',
          fillUrl: decrypted.fillUrl || '',
          username: decrypted.username || '',
          password: decrypted.password ? '********' : '',
          geminiApiKey: decrypted.geminiApiKey ? '********' : '',
          downloadUrl: decrypted.downloadUrl || '',
          downloadBtnSelector: decrypted.downloadBtnSelector || '',
          sftpHost: decrypted.sftpHost || '',
          sftpPort: decrypted.sftpPort || '2231',
          sftpUsername: decrypted.sftpUsername || '',
          sftpPassword: decrypted.sftpPassword ? '********' : '',
          sftpRemoteDir: decrypted.sftpRemoteDir || '/data/',
          sftpFileExtensions: decrypted.sftpFileExtensions || 'dump,log',
        };
      } catch (err) {}
    }

    if (castRaw) {
      try {
        const decrypted = JSON.parse(decrypt(castRaw));
        cast = {
          url:
            decrypted.url || '',
          username: decrypted.username || '',
          password: decrypted.password ? '********' : '',
        };
      } catch (err) {}
    }

    if (ccpRaw) {
      try {
        const decrypted = JSON.parse(decrypt(ccpRaw));
        ccp = {
          url: decrypted.url || '',
          username: decrypted.username || '',
          password: decrypted.password ? '********' : '',
          outputDir: decrypted.outputDir || 'backupCCP',
        };
      } catch (err) {}
    }

    if (ceRaw) {
      try {
        const decrypted = JSON.parse(decrypt(ceRaw));
        ce = {
          url: decrypted.url || '',
          username: decrypted.username || '',
          password: decrypted.password ? '********' : '',
          outputDir: decrypted.outputDir || 'backupCE',
        };
      } catch (err) {}
    }

    const schedulerConfigRaw = await this.settingsService.getSetting(
      'bot_scheduler_config',
      '[]',
    );
    let schedulerConfig = [];
    try {
      schedulerConfig = JSON.parse(schedulerConfigRaw);
    } catch (e) {}

    const sessionStartTime = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    const usdExchangeRateStr = await this.settingsService.getSetting(
      'usd_exchange_rate',
      '',
    );
    const usdExchangeRate = parseFloat(usdExchangeRateStr) || 0;

    const botAutoRecoveryEnabled = (await this.settingsService.getSetting(
      'bot_auto_recovery_enabled',
      'true',
    )) !== 'false';

    // Load M365 configs
    const m365ClientId = (await this.settingsService.getSetting('m365_client_id', '')) || process.env.MICROSOFT_CLIENT_ID || '';
    const m365TenantId = (await this.settingsService.getSetting('m365_tenant_id', '')) || process.env.MICROSOFT_TENANT_ID || '';
    const m365WatcherEmail = (await this.settingsService.getSetting('m365_watcher_email', '')) || process.env.MICROSOFT_WATCHER_EMAIL || '';
    const m365ClientSecret = (await this.settingsService.getSetting('m365_client_secret', '')) || process.env.MICROSOFT_CLIENT_SECRET || '';
    const m365RefreshToken = (await this.settingsService.getSetting('m365_refresh_token', '')) || process.env.MICROSOFT_REFRESH_TOKEN || '';
    const m365TokenRenewedAt = await this.settingsService.getSetting('m365_token_renewed_at', '') || '';

    const m365 = {
      clientId: m365ClientId,
      tenantId: m365TenantId,
      watcherEmail: m365WatcherEmail,
      clientSecret: m365ClientSecret ? '********' : '',
      refreshToken: m365RefreshToken ? '********' : '',
      tokenRenewedAt: m365TokenRenewedAt,
    };

    const ingressModeMs = await this.settingsService.getSetting('ingress_mode_ms', 'REST_API');
    const ingressModeCcp = await this.settingsService.getSetting('ingress_mode_ccp', 'REST_API');
    const ingressModeCe = await this.settingsService.getSetting('ingress_mode_ce', 'REST_API');
    const ingressModeAcm = await this.settingsService.getSetting('ingress_mode_acm', 'REST_API');
    const ingressMode = await this.settingsService.getSetting('ingress_mode', 'REST_API');

    return {
      msystem,
      cqg,
      acm,
      cast,
      ccp,
      cpp: ccp,
      ce,
      m365,
      schedulerConfig,
      sessionStartTime,
      usdExchangeRate,
      botAutoRecoveryEnabled,
      ingressModeMs,
      ingressModeCcp,
      ingressModeCe,
      ingressModeAcm,
      ingressMode,
    };
  }

  /**
   * Updates M-System and CQG credentials (encrypted in DB).
   */
  @Post('config')
  async saveConfig(@Body() body: any) {
    const {
      msystem,
      cqg,
      acm,
      cast,
      ccp,
      cpp,
      ce,
      m365,
      schedulerConfig,
      sessionStartTime,
      usdExchangeRate,
      botAutoRecoveryEnabled,
      ingressModeMs,
      ingressModeCcp,
      ingressModeCe,
      ingressModeAcm,
      ingressMode,
    } = body;
    const targetCcp = ccp || cpp;

    if (ingressModeMs !== undefined) {
      await this.settingsService.setSetting('ingress_mode_ms', ingressModeMs);
    }
    if (ingressModeCcp !== undefined) {
      await this.settingsService.setSetting('ingress_mode_ccp', ingressModeCcp);
    }
    if (ingressModeCe !== undefined) {
      await this.settingsService.setSetting('ingress_mode_ce', ingressModeCe);
    }
    if (ingressModeAcm !== undefined) {
      await this.settingsService.setSetting('ingress_mode_acm', ingressModeAcm);
    }
    if (ingressMode !== undefined) {
      await this.settingsService.setSetting('ingress_mode', ingressMode);
    }

    if (schedulerConfig) {
      await this.settingsService.setSetting(
        'bot_scheduler_config',
        JSON.stringify(schedulerConfig, null, 2),
      );
    }

    if (sessionStartTime) {
      await this.settingsService.setSetting(
        'session_start_time',
        sessionStartTime,
      );
    }

    if (usdExchangeRate !== undefined) {
      await this.settingsService.setSetting(
        'usd_exchange_rate',
        usdExchangeRate.toString(),
      );
    }

    if (botAutoRecoveryEnabled !== undefined) {
      await this.settingsService.setSetting(
        'bot_auto_recovery_enabled',
        botAutoRecoveryEnabled ? 'true' : 'false',
      );
    }

    if (msystem) {
      const msystemRaw = await this.settingsService.getSetting(
        'bot_credentials_msystem',
        '',
      );
      let currentMsystem: any = {};
      if (msystemRaw) {
        try {
          currentMsystem = JSON.parse(decrypt(msystemRaw));
        } catch (err) {}
      }

      const mergedMsystem = {
        url: msystem.url || currentMsystem.url || '',
        username:
          msystem.username !== undefined
            ? msystem.username
            : currentMsystem.username,
        password:
          msystem.password && msystem.password !== '********'
            ? msystem.password
            : currentMsystem.password,
        pin:
          msystem.pin && msystem.pin !== '****'
            ? msystem.pin
            : currentMsystem.pin,
      };

      await this.settingsService.setSetting(
        'bot_credentials_msystem',
        encrypt(JSON.stringify(mergedMsystem)),
      );
    }

    if (cqg) {
      const cqgRaw = await this.settingsService.getSetting(
        'bot_credentials_cqg',
        '',
      );
      let currentCqg: any = {};
      if (cqgRaw) {
        try {
          currentCqg = JSON.parse(decrypt(cqgRaw));
        } catch (err) {}
      }

      const mergedCqg = {
        url: cqg.urlTrade || cqg.url || currentCqg.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
        urlPrice: cqg.urlPrice !== undefined ? cqg.urlPrice : (currentCqg.urlPrice || currentCqg.url || 'https://mdemo.cqg.com/cqg/desktop/logon?ref=forced'),
        urlTrade: cqg.urlTrade !== undefined ? cqg.urlTrade : (currentCqg.urlTrade || currentCqg.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced'),
        // CQG Price (mxvprice) — chỉ xem giá, không tải file
        username: cqg.username !== undefined ? cqg.username : currentCqg.username,
        password: cqg.password && cqg.password !== '********' ? cqg.password : currentCqg.password,
        // CQG1 Trade — tải FR1/PS1/OP1/OD1
        username1: cqg.username1 !== undefined ? cqg.username1 : currentCqg.username1,
        password1: cqg.password1 && cqg.password1 !== '********' ? cqg.password1 : currentCqg.password1,
        // CQG3 Trade — tải FR2/PS2/OP2/OD2
        username2: cqg.username2 !== undefined ? cqg.username2 : currentCqg.username2,
        password2: cqg.password2 && cqg.password2 !== '********' ? cqg.password2 : currentCqg.password2,
      };

      await this.settingsService.setSetting(
        'bot_credentials_cqg',
        encrypt(JSON.stringify(mergedCqg)),
      );
    }

    if (acm) {
      const acmRaw = await this.settingsService.getSetting(
        'bot_credentials_acm',
        '',
      );
      let currentAcm: any = {};
      if (acmRaw) {
        try {
          currentAcm = JSON.parse(decrypt(acmRaw));
        } catch (err) {}
      }

      const mergedAcm = {
        url: acm.url !== undefined ? acm.url.trim() : (currentAcm.url || ''),
        orderUrl: acm.orderUrl !== undefined ? acm.orderUrl.trim() : (currentAcm.orderUrl || ''),
        fillUrl: acm.fillUrl !== undefined ? acm.fillUrl.trim() : (currentAcm.fillUrl || ''),
        username:
          acm.username !== undefined ? acm.username : currentAcm.username,
        password:
          acm.password && acm.password !== '********'
            ? acm.password
            : currentAcm.password,
        geminiApiKey:
          acm.geminiApiKey && acm.geminiApiKey !== '********'
            ? acm.geminiApiKey
            : currentAcm.geminiApiKey,
        downloadUrl:
          acm.downloadUrl !== undefined
            ? acm.downloadUrl
            : currentAcm.downloadUrl,
        downloadBtnSelector:
          acm.downloadBtnSelector !== undefined
            ? acm.downloadBtnSelector
            : currentAcm.downloadBtnSelector,
        sftpHost:
          acm.sftpHost !== undefined ? acm.sftpHost : currentAcm.sftpHost,
        sftpPort:
          acm.sftpPort !== undefined ? acm.sftpPort : currentAcm.sftpPort,
        sftpUsername:
          acm.sftpUsername !== undefined
            ? acm.sftpUsername
            : currentAcm.sftpUsername,
        sftpPassword:
          acm.sftpPassword && acm.sftpPassword !== '********'
            ? acm.sftpPassword
            : currentAcm.sftpPassword,
        sftpRemoteDir:
          acm.sftpRemoteDir !== undefined
            ? acm.sftpRemoteDir
            : currentAcm.sftpRemoteDir,
        sftpFileExtensions:
          acm.sftpFileExtensions !== undefined
            ? acm.sftpFileExtensions
            : currentAcm.sftpFileExtensions,
      };

      await this.settingsService.setSetting(
        'bot_credentials_acm',
        encrypt(JSON.stringify(mergedAcm)),
      );
    }

    if (cast) {
      const castRaw = await this.settingsService.getSetting(
        'bot_credentials_cast',
        '',
      );
      let currentCast: any = {};
      if (castRaw) {
        try {
          currentCast = JSON.parse(decrypt(castRaw));
        } catch (err) {}
      }

      const mergedCast = {
        url:
          cast.url ||
          currentCast.url ||
          '',
        username:
          cast.username !== undefined ? cast.username : currentCast.username,
        password:
          cast.password && cast.password !== '********'
            ? cast.password
            : currentCast.password,
      };

      await this.settingsService.setSetting(
        'bot_credentials_cast',
        encrypt(JSON.stringify(mergedCast)),
      );
    }

    if (targetCcp) {
      const ccpRaw = await this.settingsService.getSetting(
        'bot_credentials_ccp',
        '',
      );
      let currentCcp: any = {};
      if (ccpRaw) {
        try {
          currentCcp = JSON.parse(decrypt(ccpRaw));
        } catch (err) {}
      }

      const mergedCcp = {
        url: targetCcp.url || currentCcp.url || '',
        username:
          targetCcp.username !== undefined
            ? targetCcp.username
            : currentCcp.username,
        password:
          targetCcp.password && targetCcp.password !== '********'
            ? targetCcp.password
            : currentCcp.password,
        outputDir:
          targetCcp.outputDir !== undefined
            ? targetCcp.outputDir
            : (currentCcp.outputDir || 'backupCCP'),
      };

      await this.settingsService.setSetting(
        'bot_credentials_ccp',
        encrypt(JSON.stringify(mergedCcp)),
      );

      if (mergedCcp.outputDir) {
        await this.settingsService.setSetting(
          'bot_backup_path_ccp',
          mergedCcp.outputDir,
        );
      }
    }

    if (ce) {
      const ceRaw = await this.settingsService.getSetting(
        'bot_credentials_ce',
        '',
      );
      let currentCe: any = {};
      if (ceRaw) {
        try {
          currentCe = JSON.parse(decrypt(ceRaw));
        } catch (err) {}
      }

      const mergedCe = {
        url: ce.url || currentCe.url || '',
        username: ce.username !== undefined ? ce.username : currentCe.username,
        password:
          ce.password && ce.password !== '********'
            ? ce.password
            : currentCe.password,
        outputDir:
          ce.outputDir !== undefined
            ? ce.outputDir
            : (currentCe.outputDir || 'backupCE'),
      };

      await this.settingsService.setSetting(
        'bot_credentials_ce',
        encrypt(JSON.stringify(mergedCe)),
      );

      if (mergedCe.outputDir) {
        await this.settingsService.setSetting(
          'bot_backup_path_ce',
          mergedCe.outputDir,
        );
      }
    }

    if (m365) {
      if (m365.clientId !== undefined) {
        await this.settingsService.setSetting('m365_client_id', m365.clientId.trim());
      }
      if (m365.tenantId !== undefined) {
        await this.settingsService.setSetting('m365_tenant_id', m365.tenantId.trim());
      }
      if (m365.watcherEmail !== undefined) {
        await this.settingsService.setSetting('m365_watcher_email', m365.watcherEmail.trim());
      }
      if (m365.clientSecret && m365.clientSecret !== '********') {
        await this.settingsService.setSetting('m365_client_secret', m365.clientSecret);
      }
      if (m365.refreshToken && m365.refreshToken !== '********') {
        await this.settingsService.setSetting('m365_refresh_token', m365.refreshToken);
      }
    }

    return {
      success: true,
      message: 'Cấu hình tài khoản robot đã được cập nhật thành công.',
    };
  }

  /**
   * Performs an instant headless trial login to M-System to verify configurations.
   */
  @Post('test-connection')
  async testConnection() {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      const { browser } = await this.rpaService.loginMSystem(tempDir);
      await browser.close();
      return {
        success: true,
        message:
          'Kết nối thử nghiệm thành công! Robot đăng nhập M-System và vượt mã PIN ảo hoàn tất.',
      };
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Performs an instant headless trial login to CQG to verify configurations.
   * Uses the CQG Price account (mxvprice) — NOT the trade accounts.
   */
  @Post('test-connection-cqg')
  async testConnectionCQG() {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection-cqg');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      const { browser } = await this.rpaService.loginCQG(tempDir);
      await browser.close();
      return {
        success: true,
        message:
          'Kết nối thử nghiệm CQG Price (mxvprice) thành công! Robot đăng nhập CQG hoàn tất.',
      };
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm CQG Price thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Performs an instant headless trial login to CQG using CQG1 Trade credentials (username1/password1).
   * Used to verify trade account that downloads FR1, PS1, OP1, OD1.
   */
  @Post('test-connection-cqg1')
  async testConnectionCQG1() {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection-cqg1');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      const { browser } = await this.rpaService.loginCQGTrade(tempDir, 'cqg1');
      await browser.close();
      return {
        success: true,
        message:
          'Kết nối thử nghiệm CQG1 Trade thành công! Tài khoản có thể dùng để tải FR1/PS1/OP1/OD1.',
      };
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm CQG1 Trade thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Performs an instant headless trial login to CQG using CQG3 Trade credentials (username2/password2).
   * Used to verify trade account that downloads FR2, PS2, OP2, OD2.
   */
  @Post('test-connection-cqg3')
  async testConnectionCQG3() {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection-cqg3');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      const { browser } = await this.rpaService.loginCQGTrade(tempDir, 'cqg3');
      await browser.close();
      return {
        success: true,
        message:
          'Kết nối thử nghiệm CQG3 Trade thành công! Tài khoản có thể dùng để tải FR2/PS2/OP2/OD2.',
      };
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm CQG3 Trade thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Performs an instant headless trial login to ACM to verify configurations.
   */
  @Post('test-connection-acm')
  async testConnectionACM() {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection-acm');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      const { browser } = await this.rpaService.loginACM(tempDir);
      await browser.close();
      return {
        success: true,
        message:
          'Kết nối thử nghiệm ACM thành công! Robot đăng nhập ACM và vượt mã captcha hoàn tất.',
      };
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm ACM thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Performs an instant trial login and download to verify CQG CAST configuration.
   */
  @Post('test-connection-cast')
  async testConnectionCast() {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection-cast');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const testFile = path.join(tempDir, `test_cast_${Date.now()}.xlsx`);

    try {
      await this.rpaService.downloadCastBalances(testFile);
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
      return {
        success: true,
        message:
          'Kết nối thử nghiệm CQG CAST thành công! Robot đăng nhập và tải file thử nghiệm hoàn tất.',
      };
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm CQG CAST thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Performs an instant trial login to CCP to verify credentials.
   */
  @Post('test-connection-ccp')
  async testConnectionCCP() {
    try {
      return await this.omsWatcherService.testConnection('ccp');
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm CCP thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Performs an instant trial login to CE to verify credentials.
   */
  @Post('test-connection-ce')
  async testConnectionCE() {
    try {
      return await this.omsWatcherService.testConnection('ce');
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm CE thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Lấy trạng thái liveness của Agent cho Admin Web UI.
   */
  @Get('agent-status')
  async getAgentStatus() {
    const statuses = Array.from(AgentController.agentStatuses.values());
    const activeAgents = statuses.filter(
      (s) => Date.now() - s.lastSeen.getTime() < 180_000,
    );
    const online = activeAgents.length > 0;
    if (!online) {
      return { online: false, hostname: '', platform: '', agents: [] };
    }
    const hostname = activeAgents.map((a) => a.hostname).join(', ');
    const platform = activeAgents.map((a) => a.platform).join(', ');
    const lastSeen = activeAgents.sort(
      (a, b) => b.lastSeen.getTime() - a.lastSeen.getTime(),
    )[0].lastSeen;
    const diffMs = Date.now() - lastSeen.getTime();
    return {
      online: true,
      hostname,
      platform,
      lastSeen,
      lastSeenMs: diffMs,
      agents: activeAgents,
    };
  }
}
