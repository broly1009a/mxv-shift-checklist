import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as ExcelJS from 'exceljs';
import {
  IIngressPort,
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
  IngressFileDetail,
  decrypt,
  EXTERNAL_SYSTEM_CORECCP,
  ICcpReportMapping,
  CORECCP_API_REPORTS,
  CANONICAL_CORECCP_API_KEYS,
  CORECCP_DERIVED_RULES,
  resolveCoreCcpReport,
  resolveVnclearColumnHeader,
} from '../../../shared';

import { SystemSettingsService } from '../../system-settings/system-settings.service';

export interface ICcpSession {
  accessToken: string;
  sessionCookie: string;
  userId?: number;
  username: string;
  expiresAt: number;
}

export class CookieJar {
  private cookies = new Map<string, string>();

  setFromHeaders(headers: Headers | any): void {
    let raw: string[] = [];
    if (typeof headers.getSetCookie === 'function') {
      raw = headers.getSetCookie();
    } else if (headers.raw && typeof headers.raw === 'function') {
      raw = headers.raw()['set-cookie'] || [];
    } else {
      const single = typeof headers.get === 'function' ? headers.get('set-cookie') : null;
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

  getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  getSessionCookie(): string {
    const session = this.cookies.get('SESSION');
    return session ? `SESSION=${session}` : this.getCookieHeader();
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  set(name: string, value: string): void {
    this.cookies.set(name, value);
  }
}

export const CCP_UAT_BASIC_AUTH =
  'Basic d2ViLWNjcC1teHY6VWtXVDU2eHZCa1pPcmt6M21UWTZ0empmdWhuMkdU';
export const CCP_PROD_BASIC_AUTH =
  'Basic d2ViLWNjcC1teHY6d1NBbmNpNkpzN3AxWTd2eVdiZjVZajBVc3J5Yjdy';

export function resolveCcpBasicAuth(baseUrl?: string): string {
  const clean = (baseUrl || '').toLowerCase();
  return clean.includes('coreccp.vnclear.vn') || clean.includes('vnclear.vn')
    ? CCP_PROD_BASIC_AUTH
    : CCP_UAT_BASIC_AUTH;
}

@Injectable()
export class CoreCcpApiAdapter implements IIngressPort {
  private readonly logger = new Logger(CoreCcpApiAdapter.name);
  private readonly defaultBaseUrl = EXTERNAL_SYSTEM_CORECCP.baseUrl;
  private cachedSession: ICcpSession | null = null;
  private readonly sessionCachePath = path.join(process.cwd(), 'temp', 'coreccp_session.json');

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

  private saveSessionToCache(session: ICcpSession): void {
    try {
      const dir = path.dirname(this.sessionCachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.sessionCachePath, JSON.stringify(session, null, 2), 'utf8');
      this.cachedSession = session;
    } catch (err: any) {
      this.logger.warn(`Không thể lưu cache session CoreCCP: ${err.message}`);
    }
  }

  private decodeJwt(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  /**
   * Đăng nhập CoreCCP qua OAuth2 Authorization Code Grant 4 bước và lấy Bearer Token
   */
  public async getValidSession(): Promise<ICcpSession> {
    if (this.cachedSession && this.cachedSession.expiresAt - Date.now() > 5 * 60 * 1000) {
      return this.cachedSession;
    }

    let baseUrl = process.env.CORECCP_BASE_URL || this.defaultBaseUrl;
    let username = process.env.CORECCP_USERNAME || '';
    let password = process.env.CORECCP_PASSWORD || '';

    if (this.settingsService) {
      baseUrl = await this.settingsService.getSetting('coreccp_base_url', baseUrl);
      const rawCred = await this.settingsService.getSetting('bot_credentials_ccp', '');
      if (rawCred) {
        try {
          const decrypted = JSON.parse(decrypt(rawCred));
          if (decrypted.url) baseUrl = decrypted.url;
          if (decrypted.username) username = decrypted.username;
          if (decrypted.password) password = decrypted.password;
        } catch {}
      }
    }

    try {
      const parsedUrl = new URL(baseUrl);
      baseUrl = parsedUrl.origin;
    } catch {
      baseUrl = this.defaultBaseUrl;
    }

    this.logger.log(`[CoreCcpApiAdapter] Thực hiện xác thực OAuth2 CoreCCP (${baseUrl}) cho user: ${username}`);

    const loginRes = await this.performOAuth2Login(baseUrl, username, password);
    const expiresAt = loginRes.expiresAt || Date.now() + 7200 * 1000;

    const session: ICcpSession = {
      accessToken: loginRes.accessToken,
      sessionCookie: loginRes.sessionCookie,
      userId: loginRes.userId,
      username,
      expiresAt,
    };

    this.saveSessionToCache(session);
    this.logger.log(
      `[CoreCcpApiAdapter] ✅ Xác thực CoreCCP thành công: userId=${session.userId}, token hiệu lực đến: ${new Date(expiresAt).toLocaleTimeString('vi-VN')}`,
    );
    return session;
  }

  /**
   * Quy trình xác thực OAuth2 Authorization Code 4 bước (mxv-account-opening standard)
   */
  private async performOAuth2Login(
    baseUrl: string,
    username: string,
    password: string,
  ): Promise<{ accessToken: string; sessionCookie: string; userId?: number; expiresAt: number }> {
    if (!username || !password) {
      throw new Error('Chưa cấu hình tài khoản CoreCCP (username hoặc password rỗng)!');
    }

    const jar = new CookieJar();
    const redirectUri = `${baseUrl}/validate_code`;
    const basicAuth = resolveCcpBasicAuth(baseUrl);
    const authUrl = `${baseUrl}/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&scope=openid%20profile`;

    // BƯỚC 1: Khởi tạo và bẫy _csrf token
    const initRes = await fetch(authUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreCCP-Ingress/1.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    jar.setFromHeaders(initRes.headers);

    let loginUrl = initRes.headers.get('location');
    let html = '';
    if (loginUrl) {
      if (!loginUrl.startsWith('http')) loginUrl = `${baseUrl}${loginUrl}`;
      const loginRes = await fetch(loginUrl, {
        headers: { Cookie: jar.getCookieHeader(), 'User-Agent': 'Mozilla/5.0' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      });
      jar.setFromHeaders(loginRes.headers);
      html = await loginRes.text();
    } else {
      html = await initRes.text();
    }

    const csrfMatch =
      html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/i) ||
      html.match(/value=["']([^"']+)["']\s+name=["']_csrf["']/i);
    if (!csrfMatch) {
      throw new Error('Không bẫy được _csrf token từ form đăng nhập CoreCCP!');
    }
    const csrf = csrfMatch[1];

    // BƯỚC 2: Submit POST /login form
    const bodyParams = new URLSearchParams();
    bodyParams.append('_csrf', csrf);
    bodyParams.append('username', username);
    bodyParams.append('password', password);
    bodyParams.append('page', 'login_ccp');

    const postLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: jar.getCookieHeader(),
        Origin: baseUrl,
        Referer: `${baseUrl}/login`,
      },
      body: bodyParams.toString(),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    jar.setFromHeaders(postLoginRes.headers);
    const loc = postLoginRes.headers.get('location');
    if (postLoginRes.status !== 302 || !loc || loc.includes('error')) {
      throw new Error(`Đăng nhập CoreCCP thất bại: URL chuyển về ${loc || postLoginRes.status}`);
    }

    // BƯỚC 3: Theo dõi chuỗi redirect bắt OAuth2 Code
    let code: string | null = null;
    let nextUrl: string | null = loc;
    let hops = 0;
    while (nextUrl && hops < 10) {
      hops++;
      const fullUrl = nextUrl.startsWith('http') ? nextUrl : `${baseUrl}${nextUrl}`;
      const urlObj = new URL(fullUrl);
      if (urlObj.searchParams.has('code')) {
        code = urlObj.searchParams.get('code');
        break;
      }
      const hopRes = await fetch(fullUrl, {
        method: 'GET',
        headers: { Cookie: jar.getCookieHeader() },
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      jar.setFromHeaders(hopRes.headers);
      nextUrl = hopRes.headers.get('location');
    }

    if (!code) {
      throw new Error('Không bắt được OAuth2 Code từ chuỗi điều hướng CoreCCP!');
    }

    // BƯỚC 4: POST /oauth2/token đổi lấy Token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: jar.getCookieHeader(),
        Origin: baseUrl,
      },
      body: tokenParams.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(`Đổi Access Token CoreCCP thất bại: ${JSON.stringify(tokenData)}`);
    }

    const jwt = this.decodeJwt(tokenData.access_token);
    const userId = Number(jwt?.user_id || 6);
    const expiresIn = Number(tokenData.expires_in) || 10800;
    const expiresAt = Date.now() + expiresIn * 1000;

    return {
      accessToken: tokenData.access_token,
      sessionCookie: jar.getSessionCookie(),
      userId,
      expiresAt,
    };
  }

  private getWebSocketClass(): any {
    if (typeof (globalThis as any).WebSocket !== 'undefined') {
      return (globalThis as any).WebSocket;
    }
    try {
      return require('ws');
    } catch {
      try {
        return require('socket.io/node_modules/engine.io/node_modules/ws');
      } catch {
        throw new Error('Không tìm thấy thư viện WebSocket (yêu cầu Node 22+ hoặc gói ws)');
      }
    }
  }

  /**
   * Lắng nghe WebSocket NotiSocket Engine.IO v4 bắt chính xác reportId sau khi Server hoàn tất xuất file
   * Áp dụng cơ chế Subscribe-Before-Export: Chỉ phát lệnh tạo file khi socket đã mở và đã subscribe phòng REPORT.
   */
  private waitForReportIdViaSocket(
    session: ICcpSession,
    baseUrl: string,
    fekey: string,
    timeoutMs = 50000,
    onSubscribed?: () => Promise<void>,
    searchCode?: string,
  ): Promise<string | number> {
    return new Promise(async (resolve, reject) => {
      const parsed = new URL(baseUrl);
      let wsTicket = 'ticket_default';
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
        const ticketJson = await ticketRes.json();
        if (ticketJson.payload?.[0]) wsTicket = ticketJson.payload[0];
      } catch {}

      const userId = session.userId || 6;
      const wsUrl = `wss://${parsed.hostname}/notisocket/socket.io/?ticket=${wsTicket}&userId=${userId}&EIO=4&transport=websocket`;

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
   * KIỂU 2: Gửi lệnh tạo file Excel trên Server CoreCCP (/ccp/export/create)
   */
  private async createExportJob(
    session: ICcpSession,
    searchCode: string,
    fekey: string,
    baseUrl: string,
    refererRoute = '',
    filterPayload: Record<string, any> = {},
  ): Promise<void> {
    const res = await fetch(`${baseUrl}/ccp/export/create`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Authorization: `Bearer ${session.accessToken}`,
        connectkey: EXTERNAL_SYSTEM_CORECCP.connectKey,
        'Content-Type': 'application/json',
        Cookie: session.sessionCookie,
        Origin: baseUrl,
        Referer: `${baseUrl}${refererRoute || '/'}`,
      },
      body: JSON.stringify({
        searchcode: searchCode,
        search: filterPayload.search || {},
        filter: filterPayload.filter || {},
        orderBy: {},
        page: { pageIndex: 1, pageSize: 20 },
        exptype: 'XLSX',
        fekey,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (!res.ok || (data && data.success === false)) {
      throw new Error(`Export Create ${searchCode} thất bại (${res.status}): ${JSON.stringify(data)}`);
    }
  }

  /**
   * KIỂU 2: Tải file Excel nhị phân nguyên bản trực tiếp từ Server (/ccp/report/download/{id})
   */
  private async downloadReportBinary(
    session: ICcpSession,
    reportId: string | number,
    baseUrl: string,
    refererRoute = '',
  ): Promise<Buffer> {
    const res = await fetch(`${baseUrl}/ccp/report/download/${reportId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        connectkey: EXTERNAL_SYSTEM_CORECCP.connectKey,
        Cookie: session.sessionCookie,
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
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
   * KIỂU 2 TOÀN TRÌNH: Kết nối WebSocket + Kích hoạt Export + Bắt reportId + Tải file Excel nhị phân
   */
  private async downloadServerExport(
    session: ICcpSession,
    searchCode: string,
    baseUrl: string,
    refererRoute: string,
    filterPayload: Record<string, any>,
    targetPath: string,
  ): Promise<Buffer> {
    const fekey = `${searchCode}_${Date.now()}`;
    this.logger.log(
      `[CoreCcpApiAdapter] Khởi động WebSocket NotiSocket chờ xuất ${searchCode} (fekey=${fekey})...`,
    );

    const reportId = await this.waitForReportIdViaSocket(
      session,
      baseUrl,
      fekey,
      50000,
      async () => {
        this.logger.log(
          `[CoreCcpApiAdapter] NotiSocket đã Subscribe sẵn sàng phòng REPORT. Đang kích hoạt tạo export ${searchCode}...`,
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

    this.logger.log(`[CoreCcpApiAdapter] Bắt được reportId=${reportId}, đang tải file nhị phân...`);
    const buffer = await this.downloadReportBinary(session, reportId, baseUrl, refererRoute);

    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetPath, buffer);
    return buffer;
  }

  /**
   * KIỂU 1: Gọi Direct REST Search API với pageSize 200,000 lấy toàn bộ dữ liệu bảng
   */
  public async searchFullJson(
    session: ICcpSession,
    searchCode: string,
    baseUrl: string,
    refererRoute = '',
    filterPayload: Record<string, any> = {},
    parentSearchCode?: string,
  ): Promise<{ rows: any[]; totalCount: number }> {
    const parentCode = parentSearchCode || (searchCode === 'INSTRUMENTS' ? 'COMMODITY' : searchCode);
    const endpoint = `/ccp/inquiry/maintain/${parentCode}/search/${searchCode}`;
    const searchObj = filterPayload.search
      ? filterPayload.search
      : (filterPayload.KEYVAL ? { KEYVAL: filterPayload.KEYVAL } : {});
    const payload = {
      searchcode: searchCode,
      search: searchObj,
      filter: filterPayload.filter || {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 200000 },
    };

    const res = await this.makeJsonPost(session, baseUrl, endpoint, payload, refererRoute);
    if (res.status === 200 && res.data && (res.data.success || res.data.code === '0')) {
      const rows = res.data.data || res.data.payload?.data || [];
      const totalCount = res.data.page?.totalCount || res.data.payload?.page?.totalCount || rows.length;
      return { rows, totalCount };
    }
    throw new Error(`Search API ${searchCode} thất bại (${res.status}): ${JSON.stringify(res.data)}`);
  }

  private makeJsonPost(
    session: ICcpSession,
    baseUrl: string,
    endpoint: string,
    payload: any,
    refererRoute: string,
  ): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(baseUrl);
      const postData = JSON.stringify(payload);

      const req = https.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          Accept: 'application/json, text/plain, */*',
          Authorization: `Bearer ${session.accessToken}`,
          connectkey: EXTERNAL_SYSTEM_CORECCP.connectKey,
          Cookie: `SESSION=${session.sessionCookie}`,
          Origin: baseUrl,
          Referer: `${baseUrl}${refererRoute || '/'}`,
        },
        timeout: 30000,
      }, (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ status: res.statusCode || 200, data });
          } catch {
            resolve({ status: res.statusCode || 200, data: body });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout khi gọi ${endpoint}`));
      });
      req.write(postData);
      req.end();
    });
  }

  /**
   * Xuất mảng dữ liệu JSON ra file Excel .xlsx chuẩn bằng ExcelJS
   * Tự động ánh xạ tiêu đề tiếng Việt chuẩn từ schemas
   */
  private async convertJsonToExcel(rows: any[], searchCodeOrSheetName: string, targetFilePath: string): Promise<void> {
    const dir = path.dirname(targetFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(searchCodeOrSheetName || 'Sheet1');

    if (rows.length === 0) {
      worksheet.addRow(['(Không có dữ liệu phát sinh trong phiên)']);
      await workbook.xlsx.writeFile(targetFilePath);
      return;
    }

    const headers = Object.keys(rows[0]);
    worksheet.columns = headers.map(key => ({
      header: resolveVnclearColumnHeader(searchCodeOrSheetName, key),
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

  /**
   * Cổng Ingress Port: Tải các báo cáo CoreCCP qua Direct Search / Export API
   */
  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const outputDirectory =
      options?.outputDir ||
      options?.targetDirectory ||
      path.join(process.cwd(), 'data', 'backup', 'CCP');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const targetDate = options?.targetDate || new Date().toISOString().split('T')[0];
    const isFullRequested =
      options?.isFullBackup ||
      options?.reportCodes?.some((c) => ['FULL', 'ALL', 'BACKUP', 'CCP_25'].includes(c.toUpperCase()));

    let targets: string[] = [];
    if (isFullRequested) {
      targets = [...CANONICAL_CORECCP_API_KEYS];
    } else if (options?.reportCodes && options.reportCodes.length > 0) {
      targets = options.reportCodes.flatMap((code) => {
        if (code === 'HD' || code === 'HD_ALL' || code.startsWith('HD_')) {
          return ['HH'];
        }
        const resolved = resolveCoreCcpReport(code);
        if (resolved?.isDerived && resolved.derivedFrom) {
          return [resolved.derivedFrom];
        }
        return [resolved?.key || code];
      });
      // Loại bỏ key trùng lặp
      targets = Array.from(new Set(targets));
    } else if (options?.reportType) {
      const resolved = resolveCoreCcpReport(options.reportType);
      targets = [resolved?.derivedFrom || resolved?.key || options.reportType];
    } else {
      targets = ['GTT_CCP', 'DSGD_CCP', 'TTM_CCP', 'TTTT', 'QL_TT_TKGD', 'HH'];
    }

    this.logger.log(`[CoreCcpApiAdapter] Bắt đầu tải ${targets.length} báo cáo CoreCCP (Phiên: ${targetDate}) vào: ${outputDirectory}`);

    const files: IngressFileDetail[] = [];
    const errors: string[] = [];

    try {
      const session = await this.getValidSession();
      let baseUrl = process.env.CORECCP_BASE_URL || this.defaultBaseUrl;
      if (this.settingsService) {
        baseUrl = await this.settingsService.getSetting('coreccp_base_url', baseUrl);
      }
      try {
        const parsedUrl = new URL(baseUrl);
        baseUrl = parsedUrl.origin;
      } catch {}

      const cleanDate = targetDate.includes('-')
        ? targetDate.split('-').reverse().join('.')
        : targetDate;

      const addDerivedFile = (sourceFilePath: string, destFileName: string, category = 'CCP') => {
        const destPath = path.join(outputDirectory, destFileName);
        if (fs.existsSync(sourceFilePath) && destPath !== sourceFilePath) {
          fs.copyFileSync(sourceFilePath, destPath);
          const stat = fs.statSync(destPath);
          files.push({
            fileName: destFileName,
            absolutePath: destPath,
            fileSize: stat.size,
            mtime: stat.mtime,
            category,
            metadata: { transport: 'DERIVED_EXPORT', source: path.basename(sourceFilePath) },
          });
          this.logger.log(`[CoreCcpApiAdapter] 📄 Tự động tạo bản sao phái sinh: ${destFileName} (${stat.size} bytes)`);
        }
      };

      for (const target of targets) {
        const reportDef = resolveCoreCcpReport(target);
        if (!reportDef) {
          this.logger.warn(`[CoreCcpApiAdapter] Bỏ qua báo cáo chưa được cấu hình mapping: ${target}`);
          continue;
        }

        const outFileName = reportDef.fileName.includes(targetDate.replace(/-/g, ''))
          ? reportDef.fileName
          : reportDef.fileName;
        const targetPath = path.join(outputDirectory, outFileName);

        this.logger.log(`[CoreCcpApiAdapter] Đang tải ${reportDef.key} (${reportDef.searchCode})...`);
        try {
          let downloadSuccess = false;
          let searchResult: { rows: any[]; totalCount: number } | null = null;

          // Thử xuất Server Export nếu searchCode hỗ trợ và không bị cấm
          const isServerExportEligible =
            reportDef.searchCode === 'ORDERMATCH_DETAIL' ||
            reportDef.key === 'DSGD_CCP' ||
            reportDef.key === 'DSGD' ||
            reportDef.searchCode === 'OPEN_POSITION' ||
            reportDef.key === 'TTM_CCP' ||
            reportDef.searchCode === 'PNL_EXECUTED' ||
            reportDef.key === 'TTTT';

          if (isServerExportEligible) {
            try {
              this.logger.log(
                `[CoreCcpApiAdapter] 🚀 [Kiểu 2: Server Export + WebSocket] Kích hoạt xuất ${reportDef.key} (${reportDef.searchCode})...`,
              );
              const buffer = await this.downloadServerExport(
                session,
                reportDef.searchCode,
                baseUrl,
                reportDef.route,
                reportDef.filterPayload || {},
                targetPath,
              );
              downloadSuccess = true;
            } catch (wsErr: any) {
              this.logger.warn(
                `[CoreCcpApiAdapter] Server Export WebSocket gặp sự cố (${wsErr.message}), tự động fallback sang Direct JSON Search...`,
              );
            }
          }

          // Fallback sang Direct JSON Search + ExcelJS nếu Server Export không chạy hoặc không dùng
          if (!downloadSuccess) {
            searchResult = await this.searchFullJson(
              session,
              reportDef.searchCode,
              baseUrl,
              reportDef.route,
              reportDef.filterPayload || {},
            );

            await this.convertJsonToExcel(searchResult.rows, reportDef.searchCode, targetPath);
            downloadSuccess = true;
          }

          if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            files.push({
              fileName: outFileName,
              absolutePath: targetPath,
              fileSize: stat.size,
              mtime: stat.mtime,
              category: 'CCP',
              metadata: {
                transport: 'DIRECT_REST_API',
                searchCode: reportDef.searchCode,
                fileSize: stat.size,
              },
            });
            this.logger.log(`[CoreCcpApiAdapter] ✅ Tải thành công ${outFileName} (${stat.size} bytes)`);

            // ── TỰ ĐỘNG TRÍCH XUẤT TOÀN BỘ HỢP ĐỒNG (INSTRUMENTS) THEO TỪNG MÃ HÀNG HÓA THỰC TẾ ──
            if (reportDef.key === 'HH' && searchResult && Array.isArray(searchResult.rows)) {
              for (const comm of searchResult.rows) {
                const uacode = (comm.UACODE || comm.uacode || comm.SYMBOL || comm.commodityCode || '').trim();
                if (!uacode) continue;

                const hdFileName = `HĐ ${uacode}.xlsx`;
                const hdPath = path.join(outputDirectory, hdFileName);
                try {
                  this.logger.log(`[CoreCcpApiAdapter] Đang tải chi tiết hợp đồng cho hàng hóa ${uacode} (SearchCode: INSTRUMENTS)...`);
                  const contractResult = await this.searchFullJson(
                    session,
                    'INSTRUMENTS',
                    baseUrl,
                    reportDef.route,
                    { KEYVAL: uacode },
                    'COMMODITY',
                  );

                  await this.convertJsonToExcel(contractResult.rows, 'INSTRUMENTS', hdPath);

                  const hdStat = fs.statSync(hdPath);
                  files.push({
                    fileName: hdFileName,
                    absolutePath: hdPath,
                    fileSize: hdStat.size,
                    mtime: hdStat.mtime,
                    category: 'CCP',
                    metadata: {
                      transport: 'DIRECT_REST_API',
                      searchCode: 'INSTRUMENTS',
                      commodityCode: uacode,
                      fileSize: hdStat.size,
                      rowCount: contractResult.totalCount,
                    },
                  });
                  this.logger.log(`[CoreCcpApiAdapter] ✅ Đã xuất hợp đồng động ${hdFileName} (${contractResult.totalCount} dòng, ${hdStat.size} bytes)`);
                } catch (hdErr: any) {
                  this.logger.error(`[CoreCcpApiAdapter] Lỗi tải hợp đồng cho hàng hóa ${uacode}: ${hdErr.message}`);
                  errors.push(`HĐ ${uacode}: ${hdErr.message}`);
                }
              }
            }

            // Tự động sinh các file phái sinh đồng bộ cho toàn ca trực dựa theo cấu hình CORECCP_DERIVED_RULES
            const derivedRules = CORECCP_DERIVED_RULES[reportDef.key] || [];
            for (const rule of derivedRules) {
              const destName = rule.isDated
                ? rule.targetFileName.replace('{date}', cleanDate)
                : rule.targetFileName;
              addDerivedFile(targetPath, destName);
            }
          }
        } catch (searchErr: any) {
          this.logger.error(`[CoreCcpApiAdapter] Lỗi gọi API cho ${reportDef.key}: ${searchErr.message}`);
          errors.push(`${reportDef.key}: ${searchErr.message}`);
        }
      }

      const isSuccess = files.length > 0;
      return {
        success: isSuccess,
        source: 'CCP',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        durationMs: Date.now() - startTime,
        summary: `Đã tải thành công ${files.length} báo cáo CoreCCP qua Direct REST API`,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      };
    } catch (err: any) {
      this.logger.error(`[CoreCcpApiAdapter] Thất bại khi tải báo cáo CoreCCP: ${err.message}`);
      return {
        success: files.length > 0,
        source: 'CCP',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        error: err.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const session = await this.getValidSession();
      return !!session && !!session.accessToken;
    } catch {
      return false;
    }
  }
}

