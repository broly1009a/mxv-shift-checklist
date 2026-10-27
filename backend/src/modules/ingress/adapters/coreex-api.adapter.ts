import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import {
  IIngressPort,
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
  IngressFileDetail,
  decrypt,
  EXTERNAL_SYSTEM_COREEX,
  ICoreExchangeReportMapping,
  CANONICAL_COREEX_API_KEYS,
  resolveCoreExchangeReport,
  resolveVnclearColumnHeader,
} from '../../../shared';

import { SystemSettingsService } from '../../system-settings/system-settings.service';

/**
 * CookieJar helper chuẩn HTTP bẫy Session Cookie của Core Exchange
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

  public getSessionCookie(): string {
    const sessionVal = this.cookies.get('SESSION');
    return sessionVal ? `SESSION=${sessionVal}` : this.getCookieHeader();
  }
}

export interface ICoreExchangeAuthSession {
  baseUrl: string;
  username: string;
  sessionCookie: string;
  accessToken?: string;
  oauthCode?: string;
  clientId?: string;
  userId?: number;
  expiresAt?: number;
  updatedAt: string;
}

/**
 * Tính ngày giao dịch trước đó (T-1), tự động nhảy qua Thứ Bảy và Chủ Nhật
 * @param inputDate Chuỗi YYYY-MM-DD hoặc Date
 * @returns Chuỗi YYYY-MM-DD của ngày giao dịch T-1
 */
export function getPreviousTradingDate(inputDate?: string | Date): string {
  const d = inputDate ? new Date(inputDate) : new Date();
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 15; i++) {
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    if (!isWeekend) break;
    d.setDate(d.getDate() - 1);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

@Injectable()
export class CoreExApiAdapter implements IIngressPort {
  private readonly logger = new Logger(CoreExApiAdapter.name);
  private readonly defaultBaseUrl = EXTERNAL_SYSTEM_COREEX.baseUrl;
  private readonly defaultClientId = EXTERNAL_SYSTEM_COREEX.clientId;
  private cachedSession: ICoreExchangeAuthSession | null = null;
  private readonly sessionCachePath = path.join(process.cwd(), 'temp', 'coreexchange_session.json');

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

  private saveSessionToCache(session: ICoreExchangeAuthSession): void {
    try {
      const dir = path.dirname(this.sessionCachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.sessionCachePath, JSON.stringify(session, null, 2), 'utf8');
      this.cachedSession = session;
    } catch (err: any) {
      this.logger.warn(`Không thể lưu cache session CoreExchange: ${err.message}`);
    }
  }

  public clearSessionCache(): void {
    this.cachedSession = null;
    try {
      if (fs.existsSync(this.sessionCachePath)) {
        fs.unlinkSync(this.sessionCachePath);
      }
    } catch {}
  }

  private decodeJwt(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  /**
   * Kiểm tra tính hợp lệ của session bằng cách kiểm tra thời hạn JWT và probe API thực tế
   */
  public async verifySession(
    baseUrl: string,
    sessionOrCookie: ICoreExchangeAuthSession | string,
  ): Promise<boolean> {
    try {
      const session: Partial<ICoreExchangeAuthSession> =
        typeof sessionOrCookie === 'string'
          ? { baseUrl, sessionCookie: sessionOrCookie }
          : sessionOrCookie;

      if (!session.accessToken) return false;

      // 1. Kiểm tra thời hạn JWT (bắt buộc còn ít nhất 60 giây)
      const jwt = this.decodeJwt(session.accessToken);
      if (jwt && jwt.exp && jwt.exp * 1000 - Date.now() < 60 * 1000) {
        return false;
      }
      if (session.expiresAt && session.expiresAt - Date.now() < 60 * 1000) {
        return false;
      }

      // 2. Probe API thực tế tới CoreExchange (thay vì /dashboard trả HTML 200 tĩnh)
      const res = await fetch(`${baseUrl}/exchange/inquiry/maintain/COMMODITY_ACM/search/COMMODITY_ACM`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          connectkey: 'fsscssiam2021',
          'Content-Type': 'application/json',
          Cookie: session.sessionCookie || '',
          Origin: baseUrl,
          Referer: `${baseUrl}/DASHBOARD`,
          'x-devicetype': 'WEB',
          'x-lang': 'vi',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          searchcode: 'COMMODITY_ACM',
          search: {},
          filter: {},
          orderBy: {},
          page: { pageIndex: 1, pageSize: 1 },
        }),
        signal: AbortSignal.timeout(6000),
      });

      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Đăng nhập Core Exchange: Bẫy CSRF -> POST /login -> Bắt SESSION Cookie -> OAuth2 Token Exchange
   */
  public async getValidSession(forceRefresh: boolean = false): Promise<ICoreExchangeAuthSession> {
    let baseUrl = process.env.COREEXCHANGE_BASE_URL || this.defaultBaseUrl;
    let username = process.env.COREEXCHANGE_USERNAME || '';
    let password = process.env.COREEXCHANGE_PASSWORD || '';
    let clientId = process.env.COREEXCHANGE_CLIENT_ID || this.defaultClientId;
    let clientSecret = process.env.COREEXCHANGE_CLIENT_SECRET || '';

    if (this.settingsService) {
      baseUrl = await this.settingsService.getSetting('coreex_base_url', baseUrl);
      const rawCred = await this.settingsService.getSetting('bot_credentials_ce', '');
      if (rawCred) {
        try {
          const decrypted = JSON.parse(decrypt(rawCred));
          if (decrypted.url) baseUrl = decrypted.url;
          if (decrypted.username) username = decrypted.username;
          if (decrypted.password) password = decrypted.password;
          if (decrypted.clientId) clientId = decrypted.clientId;
          if (decrypted.clientSecret) clientSecret = decrypted.clientSecret;
        } catch {}
      }
    }

    if (!clientSecret) {
      clientSecret = baseUrl.includes('uat') ? 'jY3lgfDQQdJceOILsjKIxKLa0MQ7IU' : '865lhHVYOWQ93CicOirSZv4NR5JBe8';
    }

    try {
      const parsedUrl = new URL(baseUrl);
      baseUrl = parsedUrl.origin;
    } catch {
      baseUrl = this.defaultBaseUrl;
    }

    // 1. Kiểm tra session cache nếu còn hiệu lực (chưa hết hạn accessToken, buffer 5 phút)
    if (
      !forceRefresh &&
      this.cachedSession &&
      this.cachedSession.sessionCookie &&
      this.cachedSession.accessToken
    ) {
      let isExpired = false;
      if (this.cachedSession.expiresAt) {
        isExpired = this.cachedSession.expiresAt - Date.now() < 5 * 60 * 1000;
      } else {
        const jwt = this.decodeJwt(this.cachedSession.accessToken);
        if (jwt && jwt.exp) {
          isExpired = jwt.exp * 1000 - Date.now() < 5 * 60 * 1000;
        } else {
          isExpired = true;
        }
      }

      if (!isExpired) {
        const isValid = await this.verifySession(baseUrl, this.cachedSession);
        if (isValid) {
          const expTimeStr = this.cachedSession.expiresAt
            ? new Date(this.cachedSession.expiresAt).toLocaleTimeString('vi-VN')
            : 'còn hạn';
          this.logger.log(
            `[CoreExApiAdapter] Tái sử dụng session CoreExchange hợp lệ cho user: ${this.cachedSession.username} (Hạn đến: ${expTimeStr})`,
          );
          return this.cachedSession;
        }
      }
      this.logger.warn('[CoreExApiAdapter] Session CoreExchange cache đã hết hạn hoặc không hợp lệ, bắt đầu đăng nhập lại...');
    }

    const jar = new CookieJar();
    const commonHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'vi,en;q=0.9',
    };

    // BƯỚC 1: Khởi tạo phiên OAuth2 Authorize để lấy Session Cookie và URL trang Login
    const redirectUri = `${baseUrl}/validate_code`;
    const authUrl = `${baseUrl}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&scope=openid%20profile`;

    this.logger.log(`[CoreExApiAdapter] Khởi tạo phiên OAuth2: ${authUrl}`);
    const initRes = await fetch(authUrl, {
      headers: { ...commonHeaders, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreEX-Ingress/1.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    jar.setFromHeaders(initRes.headers);

    let loginUrl = initRes.headers.get('location') || `${baseUrl}/login`;
    if (!loginUrl.startsWith('http')) loginUrl = `${baseUrl}${loginUrl}`;

    // BƯỚC 2: Truy cập trang đăng nhập với Cookie SESSION bẫy từ Authorize để lấy _csrf token
    this.logger.log(`[CoreExApiAdapter] Truy cập ${loginUrl} để bẫy _csrf token...`);
    const loginPageRes = await fetch(loginUrl, {
      headers: { ...commonHeaders, Cookie: jar.getCookieHeader(), Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    jar.setFromHeaders(loginPageRes.headers);
    const html = await loginPageRes.text();

    const csrfMatch =
      html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/i) ||
      html.match(/value=["']([^"']+)["']\s+name=["']_csrf["']/i);

    if (!csrfMatch) {
      throw new Error('Không bẫy được _csrf token từ form HTML của Core Exchange!');
    }
    const csrf = csrfMatch[1];

    // BƯỚC 3: Gửi POST /login với _csrf token
    const bodyParams = new URLSearchParams();
    bodyParams.append('_csrf', csrf);
    bodyParams.append('username', username);
    bodyParams.append('password', password);
    bodyParams.append('page', 'login');

    const postLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: jar.getCookieHeader(),
        Origin: baseUrl,
        Referer: loginUrl,
      },
      body: bodyParams.toString(),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });

    jar.setFromHeaders(postLoginRes.headers);
    let nextUrl = postLoginRes.headers.get('location');

    if (postLoginRes.status !== 302 || !nextUrl || nextUrl.includes('error')) {
      throw new Error(`Đăng nhập Core Exchange thất bại! HTTP Status: ${postLoginRes.status}, Location: ${nextUrl || 'none'}`);
    }

    if (!nextUrl.startsWith('http')) nextUrl = `${baseUrl}${nextUrl}`;
    const continueRes = await fetch(nextUrl, {
      headers: { ...commonHeaders, Cookie: jar.getCookieHeader() },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    jar.setFromHeaders(continueRes.headers);

    let validateUrl = continueRes.headers.get('location');
    let oauthCode: string | undefined;
    if (validateUrl && validateUrl.includes('code=')) {
      const urlObj = new URL(validateUrl.startsWith('http') ? validateUrl : `${baseUrl}${validateUrl}`);
      oauthCode = urlObj.searchParams.get('code') || undefined;
    }

    const sessionCookie = jar.getSessionCookie();

    // BƯỚC 4: Đổi authorization code lấy Access Token OAuth2
    let accessToken = '';
    let expiresAt = Date.now() + 10800 * 1000;
    if (oauthCode) {
      try {
        const tokenParams = new URLSearchParams();
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('code', oauthCode);
        tokenParams.append('redirect_uri', redirectUri);

        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: sessionCookie,
          },
          body: tokenParams.toString(),
          signal: AbortSignal.timeout(15000),
        });
        if (tokenRes.ok) {
          const tokenJson: any = await tokenRes.json().catch(() => ({}));
          accessToken = tokenJson.access_token || '';
          const expiresIn = Number(tokenJson.expires_in) || 10800;
          expiresAt = Date.now() + expiresIn * 1000;
          this.logger.log(`[CoreExApiAdapter] Đổi OAuth2 Token thành công (Bearer length: ${accessToken.length}, hiệu lực: ${expiresIn}s)`);
        }
      } catch (tokenErr: any) {
        this.logger.warn(`[CoreExApiAdapter] Lỗi đổi token OAuth2: ${tokenErr.message}`);
      }
    }

    let userId = 9;
    if (accessToken) {
      const jwt = this.decodeJwt(accessToken);
      if (jwt) {
        userId = Number(jwt.user_id) || Number(jwt.sub) || 9;
      }
    }

    const sessionData: ICoreExchangeAuthSession = {
      baseUrl,
      username,
      sessionCookie,
      accessToken,
      oauthCode,
      clientId,
      userId,
      expiresAt,
      updatedAt: new Date().toISOString(),
    };

    // BƯỚC 5: Verify lại phiên làm việc
    await this.verifySession(baseUrl, sessionData);

    this.saveSessionToCache(sessionData);
    this.logger.log(`[CoreExApiAdapter] Đăng nhập CoreExchange thành công cho user: ${username}`);
    return sessionData;
  }

  /**
   * Gọi REST Search API lấy dữ liệu bảng chuẩn qua endpoint /exchange/inquiry/maintain/
   */
  public async searchData(
    session: ICoreExchangeAuthSession,
    searchCode: string,
    query: Record<string, any> = {},
    parentSearchCode?: string,
  ): Promise<{ rows: any[]; totalCount: number }> {
    const parentCode = parentSearchCode || searchCode;
    const endpoint = `/exchange/inquiry/maintain/${parentCode}/search/${searchCode}`;
    const fullUrl = `${session.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Cookie: session.sessionCookie,
      connectkey: 'fsscssiam2021',
      Origin: session.baseUrl,
      Referer: `${session.baseUrl}/DASHBOARD`,
      'x-devicetype': 'WEB',
      'x-lang': 'vi',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (session.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }

    let searchObj: Record<string, any> = query.search || {};
    if (query.targetDate && !searchObj.SESSION_DATE && searchCode.includes('ORDER')) {
      const dmy = query.targetDate.includes('-')
        ? query.targetDate.split('-').reverse().join('/')
        : query.targetDate;
      searchObj = { ...searchObj, SESSION_DATE: { from: dmy, to: dmy } };
    }

    const payload = {
      searchcode: searchCode,
      search: searchObj,
      filter: query.filter || {},
      orderBy: query.orderBy || {},
      page: { pageIndex: 1, pageSize: query.pageSize || 200000 },
    };

    let res = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    // Tự động hồi phục khi token bị 401: xóa cache, đăng nhập lại và thử lại request
    if (res.status === 401) {
      this.logger.warn(`[CoreExApiAdapter] Gọi API Core Exchange [${endpoint}] bị từ chối (HTTP 401). Tự động làm mới session và thử lại...`);
      this.clearSessionCache();
      const freshSession = await this.getValidSession(true);
      session.accessToken = freshSession.accessToken;
      session.sessionCookie = freshSession.sessionCookie;
      session.expiresAt = freshSession.expiresAt;
      headers.Cookie = freshSession.sessionCookie;
      if (freshSession.accessToken) {
        headers['Authorization'] = `Bearer ${freshSession.accessToken}`;
      }
      res = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
    }

    if (!res.ok) {
      throw new Error(`Gọi API Core Exchange [${endpoint}] thất bại! HTTP: ${res.status}`);
    }

    const data: any = await res.json().catch(() => null);
    if (!data) return { rows: [], totalCount: 0 };

    const rows = data.payload?.data || data.data || data.list || data.rows || (Array.isArray(data) ? data : []);
    const totalCount = data.payload?.page?.totalCount || data.page?.totalCount || data.totalCount || rows.length;

    return { rows, totalCount };
  }

  /**
   * Xuất danh sách bản ghi JSON ra file Excel (.xlsx) chuẩn Enterprise
   * Ánh xạ tiêu đề tiếng Việt chuẩn từ ag_grid_column_schemas.json
   */
  private async convertJsonToExcel(
    rows: any[],
    reportDef: ICoreExchangeReportMapping,
    targetFilePath: string,
  ): Promise<void> {
    const dir = path.dirname(targetFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(reportDef.name || 'Sheet1');

    if (rows.length === 0) {
      await workbook.xlsx.writeFile(targetFilePath);
      return;
    }

    const headers = Object.keys(rows[0]);
    worksheet.columns = headers.map(key => ({
      header: resolveVnclearColumnHeader(reportDef.searchCode, key),
      key,
      width: Math.max(key.length + 4, 15),
    }));

    rows.forEach(row => worksheet.addRow(row));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0FE' },
    };

    await workbook.xlsx.writeFile(targetFilePath);
  }

  private getWebSocketClass(): any {
    try {
      return require('ws');
    } catch {
      try {
        return require('socket.io/node_modules/engine.io/node_modules/ws');
      } catch {
        if (typeof (globalThis as any).WebSocket !== 'undefined') {
          return (globalThis as any).WebSocket;
        }
        throw new Error('Không tìm thấy thư viện WebSocket (yêu cầu gói ws)');
      }
    }
  }

  /**
   * KIỂU 2: Gửi lệnh tạo file Excel trên Server Core Exchange (/exchange/export/create)
   */
  private async createExportJob(
    session: ICoreExchangeAuthSession,
    searchCode: string,
    fekey: string,
    baseUrl: string,
    refererRoute = '',
    filterPayload: Record<string, any> = {},
  ): Promise<void> {
    const res = await fetch(`${baseUrl}/exchange/export/create`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Authorization: `Bearer ${session.accessToken}`,
        connectkey: 'fsscssiam2021',
        'Content-Type': 'application/json',
        Cookie: session.sessionCookie,
        Origin: baseUrl,
        Referer: `${baseUrl}${refererRoute || '/'}`,
      },
      body: JSON.stringify({
        searchcode: searchCode,
        search: filterPayload.search || {},
        filter: filterPayload.filter || {},
        orderBy: filterPayload.orderBy || {},
        page: { pageIndex: 1, pageSize: 20 },
        exptype: 'XLSX',
        fekey,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data: any = await res.json().catch(() => null);
    if (!res.ok || (data && data.success === false)) {
      throw new Error(`Export Create ${searchCode} thất bại (${res.status}): ${JSON.stringify(data)}`);
    }
  }

  /**
   * KIỂU 2: Tải file Excel nhị phân nguyên bản trực tiếp từ Server (/exchange/report/download/{id})
   */
  private async downloadReportBinary(
    session: ICoreExchangeAuthSession,
    reportId: string | number,
    baseUrl: string,
    refererRoute = '',
  ): Promise<Buffer> {
    const res = await fetch(`${baseUrl}/exchange/report/download/${reportId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        connectkey: 'fsscssiam2021',
        Cookie: session.sessionCookie,
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
        Origin: baseUrl,
        Referer: `${baseUrl}${refererRoute || '/'}`,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`Tải file download/${reportId} thất bại: HTTP ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  /**
   * Lắng nghe WebSocket NotiSocket Engine.IO v4 bắt chính xác reportId sau khi Server hoàn tất xuất file
   * Áp dụng cơ chế Subscribe-Before-Export: Chỉ phát lệnh tạo file khi socket đã mở và đã subscribe phòng REPORT.
   */
  private waitForReportIdViaSocket(
    session: ICoreExchangeAuthSession,
    baseUrl: string,
    fekey: string,
    timeoutMs = 50000,
    onSubscribed?: () => Promise<void>,
    searchCode?: string,
  ): Promise<string | number> {
    return new Promise(async (resolve, reject) => {
      const parsed = new URL(baseUrl);
      let wsTicket = '';
      let exportTriggered = false;
      let timer: any = null;
      let ws: any = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (ws) {
          try {
            ws.close();
          } catch {}
        }
      };

      try {
        const ticketRes = await fetch(`${baseUrl}/sso/api/v1/oauth/issue-ws-ticket`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Cookie: session.sessionCookie,
          },
          signal: AbortSignal.timeout(5000),
        });
        const ticketJson: any = await ticketRes.json().catch(() => ({}));
        if (ticketJson.payload?.[0]) wsTicket = ticketJson.payload[0];
      } catch (err: any) {
        this.logger.warn(`[CoreExApiAdapter] Không lấy được wsTicket: ${err.message}`);
      }

      const userId = session.userId || 9;
      const wsUrl = `wss://${parsed.hostname}/notisocket/socket.io/?ticket=${wsTicket}&userId=${userId}&EIO=4&transport=websocket`;
      this.logger.log(`[CoreExApiAdapter] wsTicket="${wsTicket}", userId=${userId}, wsUrl=${wsUrl}`);

      let WebSocketClass: any;
      try {
        WebSocketClass = this.getWebSocketClass();
      } catch (err: any) {
        return reject(err);
      }

      ws = new WebSocketClass(wsUrl, {
        headers: {
          Cookie: session.sessionCookie,
          Origin: baseUrl,
        },
        rejectUnauthorized: false,
      });

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout ${timeoutMs}ms chờ notification WebSocket cho fekey ${fekey}`));
      }, timeoutMs);

      ws.onmessage = async (event: any) => {
        const msg = event.data;
        if (typeof msg === 'string' && msg.startsWith('0')) {
          ws.send('40');
          return;
        }
        if (typeof msg === 'string' && msg.startsWith('40')) {
          // Handshake Engine.IO v4 thành công: Gửi bản tin SUBSCRIBE room REPORT
          ws.send(
            `42["SUBSCRIBE",{"action":"SUBSCRIBE","userID":${userId},"room":["NOTI","REPORT","SOCKET"]}]`,
          );

          // Cơ chế Subscribe-Before-Export: Kích hoạt tạo Export Job khi socket đã sẵn sàng phòng REPORT
          if (onSubscribed && !exportTriggered) {
            exportTriggered = true;
            try {
              await onSubscribed();
            } catch (createErr: any) {
              cleanup();
              return reject(createErr);
            }
          }
          return;
        }
        if (msg === '2') {
          ws.send('3');
          return;
        }
        if (typeof msg === 'string' && msg.startsWith('42')) {
          try {
            const jsonIdx = msg.indexOf('[');
            const [, evData] = JSON.parse(msg.substring(jsonIdx));
            const content = evData?.content || evData;
            const rId = content?.autoid || content?.reportId || content?.id || evData?.reportId;
            const rFekey = content?.fekey || content?.feKey || evData?.fekey;
            const rSearchCode = content?.searchcode || content?.searchCode;

            const isMatch =
              rFekey === fekey ||
              (rId && (!rFekey || (searchCode && rSearchCode === searchCode)));

            if (isMatch) {
              cleanup();
              resolve(rId);
            }
          } catch {}
        }
      };

      ws.onerror = (err: any) => {
        cleanup();
        reject(new Error(`WebSocket NotiSocket gặp sự cố: ${err.message || err}`));
      };
    });
  }

  /**
   * KIỂU 2 TOÀN TRÌNH: Kết nối WebSocket + Kích hoạt Export + Bắt reportId + Tải file Excel nhị phân nguyên bản
   */
  private async downloadServerExport(
    session: ICoreExchangeAuthSession,
    searchCode: string,
    baseUrl: string,
    refererRoute: string,
    filterPayload: Record<string, any>,
    targetPath: string,
  ): Promise<Buffer> {
    const fekey = `${searchCode}_${Date.now()}`;
    this.logger.log(
      `[CoreExApiAdapter] Khởi động WebSocket NotiSocket chờ xuất ${searchCode} (fekey=${fekey})...`,
    );

    const reportId = await this.waitForReportIdViaSocket(
      session,
      baseUrl,
      fekey,
      50000,
      async () => {
        this.logger.log(
          `[CoreExApiAdapter] NotiSocket đã Subscribe sẵn sàng phòng REPORT. Đang kích hoạt tạo export ${searchCode}...`,
        );
        await this.createExportJob(
          session,
          searchCode,
          fekey,
          baseUrl,
          refererRoute,
          filterPayload,
        );
      },
      searchCode,
    );

    this.logger.log(
      `[CoreExApiAdapter] Server hoàn tất xuất file ${searchCode} (reportId=${reportId}). Đang tải file nhị phân nguyên bản...`,
    );

    const buffer = await this.downloadReportBinary(session, reportId, baseUrl, refererRoute);
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetPath, buffer);
    return buffer;
  }

  /**
   * Cổng Ingress Port: Tải các báo cáo Core Exchange qua Direct REST API
   */
  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const targetDate = options?.targetDate || new Date().toISOString().split('T')[0];
    const outputDirectory =
      options?.outputDir ||
      options?.targetDirectory ||
      path.join(process.cwd(), 'data', 'backup', 'CoreExchange');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const isFullRequested =
      options?.isFullBackup ||
      options?.reportCodes?.some((c) => ['FULL', 'ALL', 'BACKUP', 'CE_FULL'].includes(c.toUpperCase()));

    let targets: string[] = [];
    if (isFullRequested) {
      targets = [...CANONICAL_COREEX_API_KEYS];
      this.logger.log(`[CoreExApiAdapter] Kích hoạt FULL BACKUP cho CoreExchange: tải toàn bộ ${targets.length} báo cáo chuẩn.`);
    } else if (options?.reportCodes && options.reportCodes.length > 0) {
      targets = options.reportCodes.flatMap((code) => {
        if (code === 'HD' || code === 'HD_ALL' || code.startsWith('HD_')) {
          return ['HH'];
        }
        return [code];
      });
      targets = Array.from(new Set(targets));
    } else {
      targets = ['GTT', 'HH', 'DSGD', 'DSL'];
    }

    this.logger.log(`[CoreExApiAdapter] Bắt đầu tải ${targets.length} báo cáo CoreExchange (Phiên: ${targetDate}) vào: ${outputDirectory}`);

    const files: IngressFileDetail[] = [];
    const errors: string[] = [];

    try {
      const session = await this.getValidSession();
      let baseUrl = process.env.COREEXCHANGE_BASE_URL || this.defaultBaseUrl;
      if (this.settingsService) {
        baseUrl = await this.settingsService.getSetting('coreex_base_url', baseUrl);
      }
      try {
        const parsedUrl = new URL(baseUrl);
        baseUrl = parsedUrl.origin;
      } catch {}

      // Chuẩn hóa ngày dd/MM/yyyy để truyền vào search.SESSION_DATE cho CoreEX
      let formattedDateForSearch = '';
      if (targetDate) {
        if (targetDate.includes('-')) {
          const [y, m, d] = targetDate.split('-');
          formattedDateForSearch = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        } else if (targetDate.includes('.')) {
          const [d, m, y] = targetDate.split('.');
          formattedDateForSearch = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        } else if (targetDate.includes('/')) {
          formattedDateForSearch = targetDate;
        }
      }

      for (const target of targets) {
        const reportDef = resolveCoreExchangeReport(target);
        if (!reportDef) {
          this.logger.warn(`[CoreExApiAdapter] Bỏ qua báo cáo chưa cấu hình mapping: ${target}`);
          continue;
        }

        const outFileName = reportDef.fileName;
        const targetPath = path.join(outputDirectory, outFileName);

        const isHistorical = Boolean(reportDef.isHistorical || reportDef.searchCode.includes('_ALL'));
        const effectiveHistoricalYmd = isHistorical ? getPreviousTradingDate(targetDate) : targetDate;
        let histDmy = '';
        if (isHistorical && formattedDateForSearch) {
          histDmy = this.calculatePreviousWorkdayDmy(formattedDateForSearch);
        }

        const logStarting = `[CoreEX API] Đang kết nối tải báo cáo ${reportDef.name} (${reportDef.searchCode})...`;
        this.logger.log(logStarting);
        if (options?.onLog) options.onLog(logStarting);

        try {
          let downloadSuccess = false;
          let usedServerExport = false;
          let searchResult: { rows: any[]; totalCount: number } | null = null;

          // Xây dựng effectiveFilterPayload động theo ngày giao dịch
          const effectiveFilterPayload: Record<string, any> = {
            ...(reportDef.filterPayload || {}),
            search: {
              ...(reportDef.filterPayload?.search || {}),
            },
            filter: {
              ...(reportDef.filterPayload?.filter || {}),
            },
          };

          // Tự động inject bộ lọc SESSION_DATE nếu là ORDERMATCH hoặc ORDERBOOK
          if (
            (reportDef.searchCode.includes('ORDERMATCH') || reportDef.searchCode.includes('ORDERBOOK')) &&
            !effectiveFilterPayload.search.SESSION_DATE
          ) {
            if (options?.targetDateRange?.fromDate && options?.targetDateRange?.toDate) {
              const formatDmy = (dStr: string) => {
                if (dStr.includes('-')) {
                  const [y, m, d] = dStr.split('-');
                  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
                } else if (dStr.includes('.')) {
                  const [d, m, y] = dStr.split('.');
                  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
                }
                return dStr;
              };
              const fromDmy = formatDmy(options.targetDateRange.fromDate);
              const toDmy = formatDmy(options.targetDateRange.toDate);
              effectiveFilterPayload.search.SESSION_DATE = {
                from: fromDmy,
                to: toDmy,
              };
              this.logger.log(
                `[CoreExApiAdapter] 📅 Tự động áp dụng bộ lọc SESSION_DATE dải ngày: ${fromDmy} -> ${toDmy} cho ${reportDef.searchCode}`,
              );
            } else if (formattedDateForSearch) {
              const sessionDateToUse = isHistorical && histDmy ? histDmy : formattedDateForSearch;
              effectiveFilterPayload.search.SESSION_DATE = {
                from: sessionDateToUse,
                to: sessionDateToUse,
              };
              this.logger.log(
                `[CoreExApiAdapter] 📅 Tự động áp dụng bộ lọc SESSION_DATE: ${sessionDateToUse} cho ${reportDef.searchCode}`,
              );
            }
          }

          // Thử xuất Server Export (Kiểu 2) cho các báo cáo có khối lượng giao dịch lớn
          const SERVER_EXPORT_CODES = new Set([
            'ORDERMATCH_DETAIL_ACM',
            'ORDERMATCH_ALL_ACM',
            'ORDERBOOK_ACM',
            'ORDERBOOK_ALL_ACM',
            'OPEN_POSITION',
          ]);
          const isServerExportEligible = SERVER_EXPORT_CODES.has(reportDef.searchCode);

          if (isServerExportEligible) {
            try {
              this.logger.log(
                `[CoreExApiAdapter] 🚀 [Kiểu 2: Server Export + WebSocket] Kích hoạt xuất ${reportDef.name} (${reportDef.searchCode})...`,
              );
              await this.downloadServerExport(
                session,
                reportDef.searchCode,
                session.baseUrl || baseUrl,
                reportDef.route || `/ORDERS/${reportDef.searchCode}`,
                effectiveFilterPayload,
                targetPath,
              );
              downloadSuccess = true;
              usedServerExport = true;
            } catch (wsErr: any) {
              this.logger.warn(
                `[CoreExApiAdapter] Server Export WebSocket gặp sự cố (${wsErr.message}), tự động fallback sang Direct JSON Search...`,
              );
            }
          }

          // Fallback sang Direct JSON Search + ExcelJS nếu Server Export không chạy hoặc không áp dụng
          if (!downloadSuccess) {
            searchResult = await this.searchData(
              session,
              reportDef.searchCode,
              {
                targetDate: isHistorical ? effectiveHistoricalYmd : targetDate,
                search: effectiveFilterPayload.search || {},
                pageSize: 200000,
              },
              reportDef.parentSearchCode,
            );

            await this.convertJsonToExcel(searchResult.rows, reportDef, targetPath);
            downloadSuccess = true;
          }

          if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            files.push({
              fileName: outFileName,
              absolutePath: targetPath,
              fileSize: stat.size,
              mtime: stat.mtime,
              category: 'CORE_EX',
              metadata: {
                transport: usedServerExport ? 'SERVER_EXPORT_WS' : 'DIRECT_REST_API',
                searchCode: reportDef.searchCode,
                fileSize: stat.size,
              },
            });
            const logSuccess = `[CoreEX API] ✓ Tải thành công ${outFileName} (${(stat.size / 1024).toFixed(1)} KB) qua ${usedServerExport ? 'Server Export (File gốc)' : 'Direct JSON'}`;
            this.logger.log(logSuccess);
            if (options?.onLog) options.onLog(logSuccess);

            // ── TỰ ĐỘNG TRÍCH XUẤT TOÀN BỘ HỢP ĐỒNG (INSTRUMENTS) THEO TỪNG MÃ HÀNG HÓA THỰC TẾ ──
            if (reportDef.key === 'HH' && searchResult && Array.isArray(searchResult.rows)) {
              const hdReportDef = resolveCoreExchangeReport('HD') || {
                key: 'HD',
                name: 'Hợp đồng chi tiết CE',
                fileName: 'HĐ *.xlsx',
                route: '/PRODUCT/COMMODITY_ACM',
                searchCode: 'INSTRUMENTS_ACM',
                parentSearchCode: 'COMMODITY_ACM',
                description: 'Hợp đồng chi tiết theo từng hàng hóa',
              };

              for (const comm of searchResult.rows) {
                const uacode = (comm.UACODE || comm.uacode || comm.SYMBOL || comm.commodityCode || '').trim();
                if (!uacode) continue;

                const hdFileName = `HĐ ${uacode}.xlsx`;
                const hdPath = path.join(outputDirectory, hdFileName);
                try {
                  this.logger.log(`[CoreExApiAdapter] Đang tải chi tiết hợp đồng cho hàng hóa ${uacode} (SearchCode: INSTRUMENTS_ACM)...`);
                  const contractResult = await this.searchData(
                    session,
                    'INSTRUMENTS_ACM',
                    {
                      targetDate,
                      search: { KEYVAL: uacode },
                      pageSize: 200000,
                    },
                    'COMMODITY_ACM',
                  );

                  await this.convertJsonToExcel(
                    contractResult.rows,
                    { ...hdReportDef, name: `Hợp đồng ${uacode}` },
                    hdPath,
                  );

                  const hdStat = fs.statSync(hdPath);
                  files.push({
                    fileName: hdFileName,
                    absolutePath: hdPath,
                    fileSize: hdStat.size,
                    mtime: hdStat.mtime,
                    category: 'CORE_EX',
                    metadata: {
                      transport: 'CORE_EXCHANGE_REST_API',
                      searchCode: 'INSTRUMENTS_ACM',
                      commodityCode: uacode,
                      rowCount: contractResult.totalCount,
                    },
                  });
                  this.logger.log(`[CoreExApiAdapter] Đã xuất hợp đồng động ${hdFileName} (${contractResult.totalCount} dòng, ${hdStat.size} bytes)`);
                } catch (hdErr: any) {
                  this.logger.error(`[CoreExApiAdapter] Lỗi tải hợp đồng cho hàng hóa ${uacode}: ${hdErr.message}`);
                  errors.push(`HĐ ${uacode}: ${hdErr.message}`);
                }
              }
            }
          }
        } catch (searchErr: any) {
          this.logger.error(`[CoreExApiAdapter] ❌ Lỗi gọi API cho ${reportDef.name}: ${searchErr.message}`);
          errors.push(`${reportDef.name}: ${searchErr.message}`);
        }
      }

      if (errors.length > 0) {
        const errorSummary = `Tải báo cáo CoreExchange thất bại (${errors.length}/${targets.length} lỗi): ${errors.join('; ')}`;
        this.logger.error(`[CoreExApiAdapter] ❌ ${errorSummary}`);
        throw new Error(errorSummary);
      }

      const downloadSummary = `[CoreEX API] ✓ Hoàn tất tải ${files.length} báo cáo CoreExchange (${((Date.now() - startTime) / 1000).toFixed(1)}s)`;
      this.logger.log(downloadSummary);
      if (options?.onLog) options.onLog(downloadSummary);

      return {
        success: files.length > 0,
        source: 'CORE_EX',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        durationMs: Date.now() - startTime,
        summary: `Đã tải thành công ${files.length}/${targets.length} báo cáo CoreExchange.`,
      };
    } catch (err: any) {
      this.logger.error(`[CoreExApiAdapter] ❌ Thất bại khi tải báo cáo CoreExchange: ${err.message}`);
      return {
        success: false,
        source: 'CORE_EX',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        error: err.message,
        durationMs: Date.now() - startTime,
        summary: `Thất bại khi tải báo cáo CoreExchange: ${err.message}`,
      };
    }
  }

  /**
   * Tính ngày phiên làm việc T-1 theo định dạng dd/MM/yyyy (tự động trừ Thứ Bảy / Chủ Nhật)
   */
  private calculatePreviousWorkdayDmy(dmy: string): string {
    try {
      const parts = dmy.split('/');
      if (parts.length < 3) return dmy;
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      dt.setDate(dt.getDate() - 1);
      if (dt.getDay() === 0) {
        dt.setDate(dt.getDate() - 2);
      } else if (dt.getDay() === 6) {
        dt.setDate(dt.getDate() - 1);
      }
      const prevD = String(dt.getDate()).padStart(2, '0');
      const prevM = String(dt.getMonth() + 1).padStart(2, '0');
      const prevY = dt.getFullYear();
      return `${prevD}/${prevM}/${prevY}`;
    } catch {
      return dmy;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      let baseUrl = process.env.COREEXCHANGE_BASE_URL || this.defaultBaseUrl;
      if (this.settingsService) {
        baseUrl = await this.settingsService.getSetting('coreex_base_url', baseUrl);
      }
      const res = await fetch(`${baseUrl}/login`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
