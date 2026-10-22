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
  COREEX_DERIVED_RULES,
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

    const sessionData: ICoreExchangeAuthSession = {
      baseUrl,
      username,
      sessionCookie,
      accessToken,
      oauthCode,
      clientId,
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
      worksheet.addRow(['(Không có dữ liệu phát sinh trong phiên)']);
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

      for (const target of targets) {
        const reportDef = resolveCoreExchangeReport(target);
        if (!reportDef) {
          this.logger.warn(`[CoreExApiAdapter] Bỏ qua báo cáo chưa cấu hình mapping: ${target}`);
          continue;
        }

        const outFileName = reportDef.fileName;
        const targetPath = path.join(outputDirectory, outFileName);

        const isHistorical = Boolean(reportDef.isHistorical || reportDef.searchCode.includes('_ALL'));
        const effectiveDate = isHistorical ? getPreviousTradingDate(targetDate) : targetDate;

        if (isHistorical) {
          this.logger.log(
            `[CoreExApiAdapter] Báo cáo lịch sử [${reportDef.name}] (${reportDef.searchCode}) mặc định tải theo ngày T-1: ${effectiveDate} (ngày ca trực: ${targetDate})`,
          );
        }

        this.logger.log(`[CoreExApiAdapter] Đang tải ${reportDef.name} (SearchCode: ${reportDef.searchCode}, Ngày: ${effectiveDate})...`);
        try {
          const searchResult = await this.searchData(
            session,
            reportDef.searchCode,
            {
              targetDate: effectiveDate,
              search: reportDef.filterPayload || {},
              pageSize: 200000,
            },
            reportDef.parentSearchCode,
          );

          await this.convertJsonToExcel(searchResult.rows, reportDef, targetPath);

          const stat = fs.statSync(targetPath);
          files.push({
            fileName: outFileName,
            absolutePath: targetPath,
            fileSize: stat.size,
            mtime: stat.mtime,
            category: 'CORE_EX',
            metadata: {
              transport: 'CORE_EXCHANGE_REST_API',
              searchCode: reportDef.searchCode,
              rowCount: searchResult.totalCount,
            },
          });

          this.logger.log(`[CoreExApiAdapter] Đã xuất thành công ${outFileName} (${searchResult.totalCount} dòng, ${stat.size} bytes)`);

          // ── TỰ ĐỘNG TRÍCH XUẤT TOÀN BỘ HỢP ĐỒNG (INSTRUMENTS) THEO TỪNG MÃ HÀNG HÓA THỰC TẾ ──
          if (reportDef.key === 'HH' && Array.isArray(searchResult.rows)) {
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

          // Tự động tạo file phái sinh cho ca trực (COREEX_DERIVED_RULES)
          const derivedRules = COREEX_DERIVED_RULES[reportDef.key] || [];
          for (const rule of derivedRules) {
            const destPath = path.join(outputDirectory, rule.targetFileName);
            if (destPath === targetPath) continue;

            let derivedRows = searchResult.rows;
            let isFiltered = false;

            // Nếu là nhóm sổ lệnh DSL, lọc chính xác theo trạng thái lệnh
            if (reportDef.key === 'DSL' && Array.isArray(searchResult.rows) && searchResult.rows.length > 0) {
              if (rule.targetFileName.includes('DSLH')) {
                // Lệnh hủy (Cancelled)
                derivedRows = searchResult.rows.filter(
                  (r: any) => r.STATUS === 'DD' || r.EN_STATUS === 'Cancelled' || String(r.STATUS_DESC || '').toLowerCase().includes('hủy'),
                );
                isFiltered = true;
              } else if (rule.targetFileName.includes('DSLCK')) {
                // Lệnh chờ khớp (New / PendingNew)
                derivedRows = searchResult.rows.filter(
                  (r: any) => ['SS', 'BB'].includes(r.STATUS) || ['New', 'PendingNew'].includes(r.EN_STATUS) || String(r.STATUS_DESC || '').toLowerCase().includes('chờ'),
                );
                isFiltered = true;
              } else if (rule.targetFileName.includes('DSLDK')) {
                // Lệnh đã khớp (Filled)
                derivedRows = searchResult.rows.filter(
                  (r: any) => r.STATUS === 'TS' || r.EN_STATUS === 'Filled' || String(r.STATUS_DESC || '').toLowerCase().includes('khớp'),
                );
                isFiltered = true;
              }
            }

            if (isFiltered) {
              await this.convertJsonToExcel(derivedRows, { ...reportDef, name: rule.targetFileName.replace('.xlsx', '') }, destPath);
            } else if (fs.existsSync(targetPath)) {
              fs.copyFileSync(targetPath, destPath);
            }

            if (fs.existsSync(destPath)) {
              const dStat = fs.statSync(destPath);
              files.push({
                fileName: rule.targetFileName,
                absolutePath: destPath,
                fileSize: dStat.size,
                mtime: dStat.mtime,
                category: 'CORE_EX',
                metadata: { transport: 'DERIVED_EXPORT', source: outFileName, rowCount: derivedRows.length },
              });
              this.logger.log(`[CoreExApiAdapter] Tự động tạo bản sao phái sinh: ${rule.targetFileName} (${derivedRows.length} dòng, ${dStat.size} bytes)`);
            }
          }
        } catch (searchErr: any) {
          this.logger.error(`[CoreExApiAdapter] Lỗi gọi API cho ${reportDef.name}: ${searchErr.message}`);
          errors.push(`${reportDef.name}: ${searchErr.message}`);
        }
      }

      if (errors.length > 0 && files.length === 0) {
        throw new Error(`[CoreExApiAdapter] Tải báo cáo CoreExchange thất bại: ${errors.join('; ')}`);
      }

      return {
        success: files.length > 0,
        source: 'CORE_EX',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        durationMs: Date.now() - startTime,
        summary: `Đã tải thành công ${files.length}/${targets.length} báo cáo CoreExchange qua Direct API.${errors.length > 0 ? ` Lỗi (${errors.length}): ${errors.join('; ')}` : ''}`,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      };
    } catch (err: any) {
      this.logger.error(`[CoreExApiAdapter] Lỗi gọi Direct API CoreExchange: ${err.message}`);
      return {
        success: false,
        source: 'CORE_EX',
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
