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
  oauthCode?: string;
  clientId?: string;
  updatedAt: string;
}

export interface ICoreExchangeReportMapping {
  key: string;
  name: string;
  fileName: string;
  route: string;
  searchCode: string;
  description: string;
  subTab?: string;
}

/**
 * Danh mục báo cáo Core Exchange chuẩn hóa
 */
export const CORE_EXCHANGE_REPORTS_REGISTRY: Record<string, ICoreExchangeReportMapping> = {
  GTT: {
    key: 'GTT',
    name: 'Giá thanh toán ACM',
    fileName: 'GTT ACM.xlsx',
    route: '/PRODUCT/SETTLEMENT',
    searchCode: 'SETTLEMENT_ACM',
    description: 'Bảng giá thanh toán (Settlement Price) phục vụ EOD tính PnL',
  },
  HH: {
    key: 'HH',
    name: 'Hàng hóa ACM',
    fileName: 'HH ACM.xlsx',
    route: '/PRODUCT/COMMODITY',
    searchCode: 'COMMODITY_ACM',
    description: 'Danh mục hàng hóa và thông số hợp đồng giao dịch liên thông',
  },
  DSGD: {
    key: 'DSGD',
    name: 'Danh sách giao dịch CE',
    fileName: 'DSGD ACM CE.xlsx',
    route: '/ORDERS/ORDERMATCH_DETAIL_ACM',
    searchCode: 'ORDERMATCH_DETAIL_ACM',
    description: 'Chi tiết toàn bộ các giao dịch khớp lệnh liên thông ACM trong phiên',
  },
  DSL: {
    key: 'DSL',
    name: 'Sổ lệnh tổng hợp CE',
    fileName: 'DSL ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ALL_ACM',
    searchCode: 'ORDERBOOK_ALL_ACM',
    description: 'Lịch sử toàn bộ sổ lệnh liên thông ACM trên sàn Core Exchange',
  },
  DSLCK: {
    key: 'DSLCK',
    name: 'Lệnh chờ khớp CE',
    fileName: 'DSLCK ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ACM',
    searchCode: 'ORDERBOOK_ACM_WORKING',
    description: 'Danh sách các lệnh đang ở trạng thái chờ khớp (Working/Pending)',
  },
  DSLDK: {
    key: 'DSLDK',
    name: 'Lệnh đã khớp CE',
    fileName: 'DSLDK ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ACM',
    searchCode: 'ORDERBOOK_ACM_FILLED',
    description: 'Danh sách các lệnh đã được khớp (Filled)',
  },
  DSLH: {
    key: 'DSLH',
    name: 'Lệnh hủy CE',
    fileName: 'DSLH ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ACM',
    searchCode: 'ORDERBOOK_ACM_CANCELLED',
    description: 'Danh sách các lệnh đã bị hủy (Cancelled)',
  },
  SESSION_INFO: {
    key: 'SESSION_INFO',
    name: 'Thông tin phiên trong ngày',
    fileName: 'SESSION_INFO.xlsx',
    route: '/SESSIONMNG/SESSION_INFO',
    searchCode: 'SESSION_INFO',
    description: 'Trạng thái phiên giao dịch trong ngày của từng mặt hàng',
  },
  HD: {
    key: 'HD',
    name: 'Hợp đồng chi tiết CE',
    fileName: 'HĐ ACM.xlsx',
    route: '/PRODUCT/COMMODITY',
    searchCode: 'CONTRACT_ACM',
    description: 'Hợp đồng chi tiết các mặt hàng liên thông trên sàn Core Exchange',
  },
};

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

  /**
   * Kiểm tra tính hợp lệ của session cookie bằng cách truy cập /dashboard
   */
  public async verifySession(baseUrl: string, sessionCookie: string): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: {
          Cookie: sessionCookie,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        redirect: 'manual',
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Đăng nhập Core Exchange: Bẫy CSRF -> POST /login -> Bắt SESSION Cookie -> OAuth2 Authorize
   */
  public async getValidSession(): Promise<ICoreExchangeAuthSession> {
    let baseUrl = process.env.COREEXCHANGE_BASE_URL || this.defaultBaseUrl;
    let username = process.env.COREEXCHANGE_USERNAME || '';
    let password = process.env.COREEXCHANGE_PASSWORD || '';
    let clientId = process.env.COREEXCHANGE_CLIENT_ID || this.defaultClientId;


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
        } catch {}
      }
    }

    // 1. Kiểm tra session cache nếu còn hiệu lực
    if (this.cachedSession && this.cachedSession.sessionCookie) {
      const isValid = await this.verifySession(baseUrl, this.cachedSession.sessionCookie);
      if (isValid) {
        this.logger.log(`[CoreExApiAdapter] Tái sử dụng session CoreExchange hợp lệ cho user: ${this.cachedSession.username}`);
        return this.cachedSession;
      }
      this.logger.warn('[CoreExApiAdapter] Session CoreExchange cache đã hết hạn, bắt đầu đăng nhập lại...');
    }

    const jar = new CookieJar();
    const commonHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'vi,en;q=0.9',
    };

    // BƯỚC 1: Truy cập /login và bẫy _csrf token
    this.logger.log(`[CoreExApiAdapter] Truy cập ${baseUrl}/login để bẫy _csrf token...`);
    const loginPageRes = await fetch(`${baseUrl}/login`, {
      headers: { ...commonHeaders, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'manual',
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

    // BƯỚC 2: Gửi POST /login với _csrf token
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
        Referer: `${baseUrl}/login`,
      },
      body: bodyParams.toString(),
      redirect: 'manual',
    });

    jar.setFromHeaders(postLoginRes.headers);
    const loc = postLoginRes.headers.get('location');

    if (postLoginRes.status !== 302 || !loc || loc.includes('error')) {
      throw new Error(`Đăng nhập Core Exchange thất bại! HTTP Status: ${postLoginRes.status}, Location: ${loc || 'none'}`);
    }

    const sessionCookie = jar.getSessionCookie();

    // BƯỚC 3: Gọi OAuth2 Authorize để lấy Authorization Code
    const redirectUri = `${baseUrl}/validate_code`;
    const authUrl = `${baseUrl}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile`;

    const authRes = await fetch(authUrl, {
      headers: { ...commonHeaders, Cookie: jar.getCookieHeader() },
      redirect: 'manual',
    });
    jar.setFromHeaders(authRes.headers);

    const authLoc = authRes.headers.get('location');
    let oauthCode: string | undefined;
    if (authLoc && authLoc.includes('code=')) {
      const urlObj = new URL(authLoc.startsWith('http') ? authLoc : `${baseUrl}${authLoc}`);
      oauthCode = urlObj.searchParams.get('code') || undefined;
    }

    // BƯỚC 4: Verify lại phiên làm việc
    await this.verifySession(baseUrl, sessionCookie);

    const sessionData: ICoreExchangeAuthSession = {
      baseUrl,
      username,
      sessionCookie,
      oauthCode,
      clientId,
      updatedAt: new Date().toISOString(),
    };

    this.saveSessionToCache(sessionData);
    this.logger.log(`[CoreExApiAdapter] Đăng nhập CoreExchange thành công cho user: ${username}`);
    return sessionData;
  }

  /**
   * Gọi REST Search API lấy dữ liệu bảng
   */
  public async searchData(
    session: ICoreExchangeAuthSession,
    endpoint: string,
    query: Record<string, any> = {},
  ): Promise<{ rows: any[]; totalCount: number }> {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${session.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      Cookie: session.sessionCookie,
      Referer: `${session.baseUrl}/DASHBOARD`,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    }).catch(async () => {
      return fetch(fullUrl, { method: 'GET', headers });
    });

    if (!res.ok) {
      throw new Error(`Gọi API Core Exchange [${endpoint}] thất bại! HTTP: ${res.status}`);
    }

    const data: any = await res.json().catch(() => null);
    if (!data) return { rows: [], totalCount: 0 };

    const rows = data.data || data.list || data.rows || (Array.isArray(data) ? data : []);
    const totalCount = data.totalCount || data.total || (data.page && data.page.totalCount) || rows.length;

    return { rows, totalCount };
  }

  /**
   * Xuất danh sách bản ghi JSON ra file Excel (.xlsx) chuẩn Enterprise
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
      header: key,
      key,
      width: Math.max(key.length + 4, 15),
    }));

    rows.forEach(row => worksheet.addRow(row));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0FE' },
    };

    await workbook.xlsx.writeFile(targetFilePath);
  }

  /**
   * Cổng Ingress Port: Tải các báo cáo Core Exchange qua Direct Search & Excel Export
   */
  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const targetDate = options?.targetDate || new Date().toISOString().split('T')[0];
    const outputDirectory =
      options?.targetDirectory || path.join(process.cwd(), 'data', 'backup', 'CoreExchange');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const isFullRequested =
      options?.isFullBackup ||
      options?.reportCodes?.some((c) => ['FULL', 'ALL', 'BACKUP', 'CE_FULL'].includes(c.toUpperCase()));

    let targets: string[] = [];
    if (isFullRequested) {
      targets = Object.keys(CORE_EXCHANGE_REPORTS_REGISTRY);
      this.logger.log(`[CoreExApiAdapter] Kích hoạt FULL BACKUP cho CoreExchange: tải toàn bộ ${targets.length} báo cáo.`);
    } else if (options?.reportCodes && options.reportCodes.length > 0) {
      targets = options.reportCodes;
    } else {
      targets = ['GTT', 'HH', 'DSGD', 'DSL'];
    }

    this.logger.log(`[CoreExApiAdapter] Bắt đầu tải ${targets.length} báo cáo CoreExchange (Phiên: ${targetDate}) vào: ${outputDirectory}`);

    const files: IngressFileDetail[] = [];
    const errors: string[] = [];

    try {
      const session = await this.getValidSession();

      for (const target of targets) {
        const reportDef = CORE_EXCHANGE_REPORTS_REGISTRY[target];
        if (!reportDef) {
          this.logger.warn(`[CoreExApiAdapter] Bỏ qua báo cáo chưa cấu hình mapping: ${target}`);
          continue;
        }

        const outFileName = reportDef.fileName;
        const targetPath = path.join(outputDirectory, outFileName);

        this.logger.log(`[CoreExApiAdapter] Đang tải ${reportDef.name} (${reportDef.route})...`);
        try {
          const searchResult = await this.searchData(session, reportDef.route, {
            targetDate,
            pageSize: 200000,
          });

          await this.convertJsonToExcel(searchResult.rows, reportDef, targetPath);

          const stat = fs.statSync(targetPath);
          files.push({
            fileName: outFileName,
            absolutePath: targetPath,
            fileSize: stat.size,
            mtime: stat.mtime,
            category: 'CORE_EX',
            metadata: {
              transport: 'CORE_EXCHANGE_SEARCH_EXCEL',
              route: reportDef.route,
              rowCount: searchResult.totalCount,
            },
          });

          this.logger.log(`[CoreExApiAdapter] Đã xuất thành công ${outFileName} (${searchResult.totalCount} dòng, ${stat.size} bytes)`);
        } catch (searchErr: any) {
          this.logger.error(`[CoreExApiAdapter] Lỗi gọi API cho ${reportDef.name}: ${searchErr.message}`);
          errors.push(`${reportDef.name}: ${searchErr.message}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(`[CoreExApiAdapter] Tải báo cáo CoreExchange thất bại: ${errors.join('; ')}`);
      }

      return {
        success: true,
        source: 'CORE_EX',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        durationMs: Date.now() - startTime,
        summary: `Đã tải thành công ${files.length} báo cáo CoreExchange qua Direct API`,
      };
    } catch (err: any) {
      this.logger.error(`[CoreExApiAdapter] Lỗi gọi Direct API CoreExchange: ${err.message}`);
      return {
        success: false,
        source: 'CORE_EX',
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
      let baseUrl = process.env.COREEXCHANGE_BASE_URL || this.defaultBaseUrl;
      if (this.settingsService) {
        baseUrl = await this.settingsService.getSetting('coreex_base_url', baseUrl);
      }
      const res = await fetch(`${baseUrl}/login`, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }
}
