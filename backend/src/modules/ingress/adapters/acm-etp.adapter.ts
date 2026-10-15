import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  IIngressPort,
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
  IngressFileDetail,
  decrypt,
} from '../../../shared';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

/**
 * CookieJar helper chuẩn HTTP bẫy sticky cookie AWS ALB
 */
export class CookieJar {
  private cookies = new Map<string, string>();

  constructor(initialCookies?: string) {
    if (initialCookies) this.setFromCookieString(initialCookies);
  }

  public setFromHeaders(headers: any): void {
    let raw: string[] = [];
    if (headers && typeof headers.getSetCookie === 'function') {
      raw = headers.getSetCookie();
    } else if (headers && typeof headers.raw === 'function') {
      raw = headers.raw()['set-cookie'] || [];
    } else if (headers && typeof headers.get === 'function') {
      const single = headers.get('set-cookie');
      if (single) raw = [single];
    }

    raw.forEach((str) => {
      const parts = str.split(';');
      const [nameVal] = parts;
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx > 0) {
        const k = nameVal.substring(0, eqIdx).trim();
        const v = nameVal.substring(eqIdx + 1).trim();
        this.cookies.set(k, v);
      }
    });
  }

  public setFromCookieString(cookieString: string): void {
    if (!cookieString) return;
    const items = cookieString.split(';');
    for (const item of items) {
      const eqIdx = item.indexOf('=');
      if (eqIdx > 0) {
        const k = item.substring(0, eqIdx).trim();
        const v = item.substring(eqIdx + 1).trim();
        if (k) this.cookies.set(k, v);
      }
    }
  }

  public getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

export interface IAcmEtpSession {
  token: string;
  username: string;
  cookies: string;
  updatedAt: string;
}

@Injectable()
export class AcmEtpAdapter implements IIngressPort {
  private readonly logger = new Logger(AcmEtpAdapter.name);
  private readonly defaultBaseUrl = 'https://acm-etp.acmmex.com';
  private cachedSession: IAcmEtpSession | null = null;
  private readonly sessionCachePath = path.join(process.cwd(), 'temp', 'acm_session.json');

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {
    this.loadSessionFromCache();
  }

  private loadSessionFromCache(): void {
    try {
      if (fs.existsSync(this.sessionCachePath)) {
        const raw = fs.readFileSync(this.sessionCachePath, 'utf8');
        this.cachedSession = JSON.parse(raw);
      }
    } catch {
      this.cachedSession = null;
    }
  }

  private saveSessionToCache(session: IAcmEtpSession): void {
    try {
      const dir = path.dirname(this.sessionCachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.sessionCachePath, JSON.stringify(session, null, 2), 'utf8');
      this.cachedSession = session;
    } catch (err: any) {
      this.logger.warn(`Không thể ghi cache session ACM: ${err.message}`);
    }
  }

  /**
   * Kiểm tra token hiện tại còn sống không
   */
  public async verifyToken(baseUrl: string, token: string, cookies: string): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/exchange/sys/menu/nav`, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          token,
          Cookie: cookies,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (!res.ok) return false;
      const data: any = await res.json();
      return data && data.code === 0;
    } catch {
      return false;
    }
  }

  /**
   * Xác thực và lấy Session hợp lệ của ACM ETP
   */
  public async getValidSession(): Promise<IAcmEtpSession> {
    let baseUrl = process.env.ACM_BASE_URL || this.defaultBaseUrl;
    let username = process.env.ACM_USERNAME || 'MXVRO';
    let password = process.env.ACM_PASSWORD || 'M@xv1234';

    if (this.settingsService) {
      baseUrl = await this.settingsService.getSetting('acm_base_url', baseUrl);
      const rawCred = await this.settingsService.getSetting('bot_credentials_acm', '');
      if (rawCred) {
        try {
          const decrypted = JSON.parse(decrypt(rawCred));
          if (decrypted.url) baseUrl = decrypted.url;
          if (decrypted.username) username = decrypted.username;
          if (decrypted.password) password = decrypted.password;
        } catch {}
      }
    }

    // 1. Tái sử dụng session cache nếu còn hiệu lực
    if (this.cachedSession && this.cachedSession.token) {
      const isValid = await this.verifyToken(baseUrl, this.cachedSession.token, this.cachedSession.cookies);
      if (isValid) {
        this.logger.log(`[AcmEtpAdapter] Tái sử dụng session ACM ETP hợp lệ cho user: ${this.cachedSession.username}`);
        return this.cachedSession;
      }
      this.logger.warn('[AcmEtpAdapter] Session ACM ETP cache đã hết hạn, bắt đầu đăng nhập lại...');
    }

    // 2. Khởi tạo cookie jar và hứng sticky session từ ALB
    const jar = new CookieJar();
    const initRes = await fetch(`${baseUrl}/exchange/index.html`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    jar.setFromHeaders(initRes.headers);

    // 3. Tự sinh Client UUID v4 và tải ảnh Captcha
    const clientUuid = crypto.randomUUID();
    const captchaUrl = `${baseUrl}/exchange/captcha?uuid=${clientUuid}`;
    const capRes = await fetch(captchaUrl, {
      headers: {
        Cookie: jar.getCookieHeader(),
        Referer: `${baseUrl}/exchange/index.html`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    jar.setFromHeaders(capRes.headers);

    // Lưu ảnh Captcha ra đĩa nếu cần can thiệp giải mã
    const capBuffer = Buffer.from(await capRes.arrayBuffer());
    const capPath = path.join(process.cwd(), 'temp', 'acm_captcha.png');
    try {
      const dir = path.dirname(capPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(capPath, capBuffer);
    } catch {}

    const captchaCode = process.env.ACM_CAPTCHA_FIXED || '12345';

    // 4. Gửi POST /exchange/login
    const loginRes = await fetch(`${baseUrl}/exchange/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Cookie: jar.getCookieHeader(),
        Referer: `${baseUrl}/exchange/index.html`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        username,
        password,
        uuid: clientUuid,
        captcha: captchaCode,
      }),
    });

    jar.setFromHeaders(loginRes.headers);
    const loginData: any = await loginRes.json().catch(() => null);

    if (!loginRes.ok || loginData?.code !== 0 || !loginData?.token) {
      throw new Error(`Đăng nhập ACM ETP thất bại: ${loginData?.msg || loginRes.statusText}`);
    }

    const session: IAcmEtpSession = {
      token: loginData.token,
      username,
      cookies: jar.getCookieHeader(),
      updatedAt: new Date().toISOString(),
    };

    this.saveSessionToCache(session);
    this.logger.log(`[AcmEtpAdapter] Đăng nhập ACM ETP thành công, token: ${session.token.substring(0, 8)}...`);
    return session;
  }

  /**
   * Cổng Ingress Port: Tải báo cáo ETP Orders & Trades
   */
  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const outputDirectory =
      options?.targetDirectory || path.join(process.cwd(), 'data', 'ingress', 'acm');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const targetDate = options?.targetDate || new Date().toISOString().split('T')[0];
    const targets = options?.reportCodes && options.reportCodes.length > 0
      ? options.reportCodes
      : ['ACM_ETP_ORDERS', 'ACM_ETP_TRADES'];

    const files: IngressFileDetail[] = [];

    try {
      const session = await this.getValidSession();
      const baseUrl = process.env.ACM_BASE_URL || this.defaultBaseUrl;

      for (const target of targets) {
        let endpoint = '';
        let outputFileName = '';

        if (target === 'ACM_ETP_ORDERS' || target === 'ORDERS') {
          endpoint = '/exchange/business/tetporder/export';
          outputFileName = `ACM_ETP_ORDERS_${targetDate.replace(/-/g, '')}.xlsx`;
        } else if (target === 'ACM_ETP_TRADES' || target === 'TRADES') {
          endpoint = '/exchange/business/tetptrade/export';
          outputFileName = `ACM_ETP_TRADES_${targetDate.replace(/-/g, '')}.xlsx`;
        } else {
          continue;
        }

        const fullUrl = `${baseUrl}${endpoint}?token=${encodeURIComponent(session.token)}`;
        const res = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
            Cookie: session.cookies,
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!res.ok) {
          throw new Error(`Lỗi tải báo cáo ${target}: HTTP ${res.status} ${res.statusText}`);
        }

        const buf = Buffer.from(await res.arrayBuffer());
        const filePath = path.join(outputDirectory, outputFileName);
        fs.writeFileSync(filePath, buf);

        const stat = fs.statSync(filePath);
        files.push({
          fileName: outputFileName,
          absolutePath: filePath,
          fileSize: stat.size,
          mtime: stat.mtime,
          category: 'ACM',
          metadata: { transport: 'REST_API_STREAM', endpoint },
        });

        this.logger.log(`[AcmEtpAdapter] Đã tải thành công ${outputFileName} (${stat.size} bytes)`);
      }

      return {
        success: true,
        source: 'ACM',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        durationMs: Date.now() - startTime,
        summary: `Đã tải thành công ${files.length} báo cáo ACM ETP qua REST API`,
      };
    } catch (err: any) {
      this.logger.error(`[AcmEtpAdapter] Thất bại khi tải báo cáo ACM ETP: ${err.message}`);
      return {
        success: false,
        source: 'ACM',
        outputDirectory,
        files: [],
        downloadedAt: new Date(),
        error: err.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const baseUrl = process.env.ACM_BASE_URL || this.defaultBaseUrl;
      const res = await fetch(`${baseUrl}/exchange/index.html`, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }
}
