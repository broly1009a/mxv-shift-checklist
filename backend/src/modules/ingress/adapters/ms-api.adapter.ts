import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  IIngressPort,
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
  IngressFileDetail,
  decrypt,
  EXTERNAL_SYSTEM_MSYSTEM,
  IMsReportDef,
  CANONICAL_MS_KEYS,
  MS_REPORTS_REGISTRY,
  resolveMsReport,
} from '../../../shared';
import { SystemSettingsService } from '../../system-settings/system-settings.service';


export interface IMsCredentials {
  baseUrl?: string;
  adminUrl?: string;
  username?: string;
  password?: string;
  pin?: string;
}

export interface IMsSession {
  token: string;
  tokenType: string;
  userId: string;
  username: string;
  fullName: string;
  email?: string;
  expiresAt: string;
  expiresEpoch: number;
  updatedAt: string;
}

@Injectable()
export class MsApiAdapter implements IIngressPort {
  private readonly logger = new Logger(MsApiAdapter.name);
  private currentSession: IMsSession | null = null;
  private readonly defaultBaseUrl = EXTERNAL_SYSTEM_MSYSTEM.apiUrl;
  private readonly defaultAdminUrl = EXTERNAL_SYSTEM_MSYSTEM.adminUrl;
  private readonly sessionCachePath = path.resolve(process.cwd(), 'temp', 'ms_session.json');

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}


  /**
   * Giải mã Payload JWT để kiểm tra thời hạn
   */
  private decodeJwt(token: string): { expEpoch: number; expiresAt: string; isExpired: boolean; remainingMinutes: number } | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);
      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp || 0;
      const isExpired = exp < now;
      const diffSec = exp - now;
      const remainingMinutes = Math.max(0, Math.floor(diffSec / 60));
      return {
        expEpoch: exp,
        expiresAt: exp ? new Date(exp * 1000).toLocaleString('vi-VN') : 'N/A',
        isExpired,
        remainingMinutes,
      };
    } catch {
      return null;
    }
  }

  private isSessionValid(session: IMsSession): boolean {
    const jwt = this.decodeJwt(session.token);
    if (!jwt || jwt.isExpired) return false;
    return jwt.remainingMinutes >= 5;
  }

  private loadSessionFromFile(): IMsSession | null {
    if (!fs.existsSync(this.sessionCachePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.sessionCachePath, 'utf8'));
    } catch {
      return null;
    }
  }

  private saveSessionToFile(session: IMsSession): void {
    try {
      fs.mkdirSync(path.dirname(this.sessionCachePath), { recursive: true });
      fs.writeFileSync(this.sessionCachePath, JSON.stringify(session, null, 2), 'utf8');
    } catch {}
  }

  /**
   * Lấy credentials M-System từ MongoDB hoặc biến môi trường
   */
  public async getCredentials(): Promise<IMsCredentials> {
    let baseUrl = process.env.MS_BASE_URL || this.defaultBaseUrl;
    let adminUrl = process.env.MS_ADMIN_URL || this.defaultAdminUrl;
    let username = process.env.MS_USERNAME || '';
    let password = process.env.MS_PASSWORD || '';
    let pin = process.env.MS_PIN || '';

    if (this.settingsService) {
      const rawCred = await this.settingsService.getSetting('bot_credentials_msystem', '');
      if (rawCred) {
        try {
          const decrypted = JSON.parse(decrypt(rawCred));
          if (decrypted.url) {
            try {
              const u = new URL(decrypted.url.split('#')[0]);
              adminUrl = u.origin;
              baseUrl = EXTERNAL_SYSTEM_MSYSTEM.resolveApiUrl(adminUrl);
            } catch {
              adminUrl = decrypted.url.split('#')[0];
              baseUrl = EXTERNAL_SYSTEM_MSYSTEM.resolveApiUrl(adminUrl);
            }
          }
          if (decrypted.apiUrl) baseUrl = decrypted.apiUrl;
          if (decrypted.baseUrl) baseUrl = decrypted.baseUrl;
          if (decrypted.username) username = decrypted.username;
          if (decrypted.password) password = decrypted.password;
          if (decrypted.pin) pin = decrypted.pin;
        } catch (err: any) {
          this.logger.warn(`[MsApiAdapter] Không thể giải mã bot_credentials_msystem: ${err.message}`);
        }
      }
    }


    try {
      const uAdmin = new URL(adminUrl);
      adminUrl = uAdmin.origin;
    } catch {}
    try {
      const uBase = new URL(baseUrl);
      baseUrl = uBase.origin;
    } catch {}

    return { baseUrl, adminUrl, username, password, pin };
  }

  /**
   * Xóa sạch cache phiên đăng nhập (RAM + File) khi token bị vô hiệu hóa
   */
  public clearSession(): void {
    this.currentSession = null;
    try {
      if (fs.existsSync(this.sessionCachePath)) {
        fs.unlinkSync(this.sessionCachePath);
      }
    } catch {}
  }

  /**
   * Lấy Bearer Token hợp lệ (Tự động tái sử dụng session cache nếu còn hạn >= 5 phút, hoặc forceRefresh)
   */
  public async getValidToken(forceRefresh = false): Promise<{ token: string; baseUrl: string; adminUrl: string }> {
    const creds = await this.getCredentials();
    const baseUrl = creds.baseUrl || this.defaultBaseUrl;
    const adminUrl = creds.adminUrl || this.defaultAdminUrl;

    if (!forceRefresh) {
      // 1. Kiểm tra RAM cache
      if (this.currentSession && this.isSessionValid(this.currentSession)) {
        return { token: this.currentSession.token, baseUrl, adminUrl };
      }

      // 2. Kiểm tra File cache
      const fileSession = this.loadSessionFromFile();
      if (fileSession && this.isSessionValid(fileSession)) {
        this.currentSession = fileSession;
        return { token: fileSession.token, baseUrl, adminUrl };
      }
    } else {
      this.clearSession();
    }

    // 3. Tiến hành đăng nhập 2 bước Password + PIN
    this.logger.log(`[MsApiAdapter] Bắt đầu đăng nhập 2 bước vào M-System Newgen API cho user: ${creds.username}...`);
    const commonHeaders: Record<string, string> = {
      accept: 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      origin: adminUrl,
      referer: `${adminUrl}/`,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // BƯỚC 1: Đăng nhập mật khẩu
    const loginRes = await fetch(`${baseUrl}/am/admin/users/login`, {
      method: 'POST',
      headers: { ...commonHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password }),
    });

    const loginData = (await loginRes.json().catch(() => null)) as any;
    if (!loginRes.ok || loginData?.status !== 'ok' || !loginData?.data?.user) {
      throw new Error(
        `Đăng nhập M-System Bước 1 thất bại: ${loginData?.errMsg || loginData?.message || loginRes.status}`,
      );
    }

    const userStep1 = loginData.data.user;
    const userId = userStep1.id || userStep1._id;
    const tempToken = userStep1.accessToken;

    if (!userId || !tempToken) {
      throw new Error('Không nhận được userId hoặc accessToken tạm từ M-System Bước 1');
    }

    // BƯỚC 2: Xác thực mã PIN
    const pinRes = await fetch(`${baseUrl}/am/admin/users/verifyPin/${userId}`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'content-type': 'application/json',
        authorization: `Bearer ${tempToken}`,
      },
      body: JSON.stringify({ pin: String(creds.pin) }),
    });

    const pinData = (await pinRes.json().catch(() => null)) as any;
    if (!pinRes.ok || pinData?.status !== 'ok' || !pinData?.data?.user) {
      throw new Error(
        `Xác thực M-System PIN Bước 2 thất bại: ${pinData?.errMsg || pinData?.message || pinRes.status}`,
      );
    }

    const finalUser = pinData.data.user;
    const finalToken = finalUser.accessToken;
    if (!finalToken) {
      throw new Error('Không nhận được Bearer Token chính thức sau Bước 2 verify PIN');
    }

    const jwtInfo = this.decodeJwt(finalToken);
    const newSession: IMsSession = {
      token: finalToken,
      tokenType: 'Bearer',
      userId: finalUser.id || userId,
      username: finalUser.username || creds.username || '',
      fullName: finalUser.fullName || creds.username || '',
      email: finalUser.email || '',
      expiresAt: jwtInfo?.expiresAt || '',
      expiresEpoch: jwtInfo?.expEpoch || 0,
      updatedAt: new Date().toISOString(),
    };

    this.currentSession = newSession;
    this.saveSessionToFile(newSession);
    this.logger.log(`[MsApiAdapter] Đăng nhập 2 bước M-System thành công! Token có hiệu lực đến: ${jwtInfo?.expiresAt}`);

    return { token: finalToken, baseUrl, adminUrl };
  }

  /**
   * Kiểm tra tình trạng kết nối và hiệu lực phiên làm việc với M-System
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const { token, baseUrl, adminUrl } = await this.getValidToken();
      // Gửi 1 request kiểm tra nhẹ để đảm bảo token thực tế còn được M-System chấp nhận
      const pingUrl = `${baseUrl}/am/admin/investors/excel?limit=1`;
      const res = await fetch(pingUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json, text/plain, */*',
          authorization: `Bearer ${token}`,
          origin: adminUrl,
          referer: `${adminUrl}/`,
        },
      });
      if (res.status === 401) {
        this.logger.warn('[MsApiAdapter] Token cached nhận HTTP 401 khi test. Tự động làm mới phiên...');
        await this.getValidToken(true);
      }
      return true;
    } catch (err: any) {
      this.logger.warn(`[MsApiAdapter] checkHealth gặp sự cố: ${err.message}. Tự động làm mới phiên...`);
      await this.getValidToken(true);
      return true;
    }
  }

  /**
   * Tải 1 file báo cáo từ Newgen API
   */
  private async downloadSingleReport(
    token: string,
    baseUrl: string,
    adminUrl: string,
    reportDef: IMsReportDef,
    targetDir: string,
  ): Promise<IngressFileDetail> {
    const startTime = Date.now();
    let fullUrl = `${baseUrl}${reportDef.endpoint}`;

    if (reportDef.queryParams) {
      const qStr = Object.entries(reportDef.queryParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      fullUrl += fullUrl.includes('?') ? `&${qStr}` : `?${qStr}`;
    }

    const res = await fetch(fullUrl, {
      method: reportDef.method,
      headers: {
        accept: 'application/json, text/plain, */*',
        authorization: `Bearer ${token}`,
        origin: adminUrl,
        referer: `${adminUrl}/`,
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`Tải báo cáo [${reportDef.name}] thất bại (HTTP ${res.status}): ${errText.slice(0, 200)}`);
      (err as any).status = res.status;
      throw err;
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const targetPath = path.join(targetDir, reportDef.fileName);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, buffer);

    const durationMs = Date.now() - startTime;
    this.logger.log(`[MsApiAdapter] Đã tải [${reportDef.name}]: ${reportDef.fileName} (${buffer.length} bytes, ${durationMs}ms)`);

    return {
      fileName: reportDef.fileName,
      absolutePath: targetPath,
      fileSize: buffer.length,
      mtime: new Date(),
      category: reportDef.key,
      metadata: {
        durationMs,
        transport: 'REST_API_STREAM',
      },
    };
  }

  /**
   * Cổng Ingress Port thực thi tải dữ liệu từ M-System qua Direct REST API
   */
  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const outputDirectory =
      options?.targetDirectory || options?.outputDir || path.join(process.cwd(), 'data', 'ingress', 'ms');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    let session = await this.getValidToken();
    let token = session.token;
    let baseUrl = session.baseUrl;
    let adminUrl = session.adminUrl;

    // Xác định danh sách báo cáo cần tải:
    // Hỗ trợ FULL / ALL / BACKUP để tải trọn gói toàn bộ 18 báo cáo M-System
    const isFullRequested =
      options?.isFullBackup ||
      options?.reportCodes?.some((c) => ['FULL', 'ALL', 'BACKUP', 'MS_FULL'].includes(c.toUpperCase()));

    let targetKeys: string[] = [];
    if (isFullRequested) {
      targetKeys = [...CANONICAL_MS_KEYS];
      this.logger.log(`[MsApiAdapter] Kích hoạt chế độ FULL BACKUP cho M-System: tải toàn bộ ${targetKeys.length} báo cáo.`);
    } else if (options?.reportType) {
      targetKeys.push(options.reportType.trim());
    } else if (options?.reportCodes && options.reportCodes.length > 0) {
      // Chuẩn hóa và bung các alias báo cáo
      for (const rawKey of options.reportCodes) {
        const k = rawKey.trim();
        const upper = k.toUpperCase();
        if (upper === 'DSTKGD') {
          targetKeys.push('DSTKGD-Futures', 'DSTKGD-Spread', 'DSTKGD-LME', 'DSTKGD-ACM');
        } else if (upper === 'TLKQHSKQ' || upper === 'TLQHSKQ') {
          targetKeys.push('TLKQHSKQ');
        } else if (upper === 'QLTTTKGD') {
          targetKeys.push('QLTKGD');
        } else if (upper === 'QLTKGDAMKQ' || upper === 'QLTTTKGDAMKQ' || upper === 'QLTKGD_AM_KQ' || upper === 'QLTKGD ÂM KQ') {
          targetKeys.push('QLTKGDAmKQ');
        } else if (upper === 'NKTHT') {
          targetKeys.push('NKTTHT');
        } else {
          targetKeys.push(k);
        }
      }
    } else {
      // Mặc định đối chiếu trong phiên: 3 báo cáo cốt lõi
      targetKeys = ['TTM', 'TTTT', 'DSGD'];
    }

    // Loại bỏ trùng lặp
    targetKeys = Array.from(new Set(targetKeys));

    const files: IngressFileDetail[] = [];
    const errors: string[] = [];

    for (const key of targetKeys) {
      const reportDef = resolveMsReport(key);
      if (!reportDef) {
        this.logger.warn(`[MsApiAdapter] Không tìm thấy định nghĩa cho mã báo cáo: ${key}`);
        continue;
      }

      try {
        const fileDetail = await this.downloadSingleReport(token, baseUrl, adminUrl, reportDef, outputDirectory);
        files.push(fileDetail);
      } catch (err: any) {
        const is401 =
          err?.status === 401 ||
          err?.message?.includes('401') ||
          err?.message?.toLowerCase().includes('invalid accesstoken');

        if (is401) {
          this.logger.warn(`[MsApiAdapter] Token hết hạn hoặc không hợp lệ (HTTP 401) khi tải ${reportDef.fileName}. Tự động làm mới phiên 2 bước và tải lại...`);
          try {
            const fresh = await this.getValidToken(true);
            token = fresh.token;
            baseUrl = fresh.baseUrl;
            adminUrl = fresh.adminUrl;
            const fileDetail = await this.downloadSingleReport(token, baseUrl, adminUrl, reportDef, outputDirectory);
            files.push(fileDetail);
            continue;
          } catch (retryErr: any) {
            this.logger.error(`[MsApiAdapter] Tải lại file ${reportDef.fileName} sau khi làm mới phiên thất bại: ${retryErr.message}`);
            errors.push(`${reportDef.fileName}: ${retryErr.message}`);
            continue;
          }
        }

        this.logger.error(`[MsApiAdapter] Lỗi tải file ${reportDef.fileName}: ${err.message}`);
        errors.push(`${reportDef.fileName}: ${err.message}`);
      }
    }

    const totalDurationMs = Date.now() - startTime;
    return {
      source: 'MS',
      success: files.length > 0 && errors.length === 0,
      outputDirectory,
      files,
      downloadedAt: new Date(),
      durationMs: totalDurationMs,
      summary: `Tải thành công ${files.length}/${targetKeys.length} báo cáo M-System qua Direct REST API`,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }
}
