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
} from '../../../shared';

import { SystemSettingsService } from '../../system-settings/system-settings.service';

export interface ICcpSession {
  accessToken: string;
  sessionCookie: string;
  userId?: number;
  username: string;
  expiresAt: number;
}

export interface ICcpReportMapping {
  key: string;
  fileName: string;
  searchCode: string;
  route: string;
  description: string;
  filterPayload?: Record<string, any>;
}

/**
 * Danh mục các báo cáo CoreCCP thông dụng hỗ trợ Direct API
 */
export const CORECCP_API_REPORTS: Record<string, ICcpReportMapping> = {
  // ── 1. NHÓM LỆNH THƯỜNG (/ORDERS/ORDERBOOK) ────────────────────────────────
  DSL_CCP: {
    key: 'DSL_CCP',
    fileName: 'DSL CCP.xlsx',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    description: 'Danh sách toàn bộ lệnh giao dịch thông thường',
  },
  DSLDK_CCP: {
    key: 'DSLDK_CCP',
    fileName: 'DSLDK CCP.xlsx',
    searchCode: 'ORDERBOOK_FILLED',
    route: '/ORDERS/ORDERBOOK',
    description: 'Danh sách lệnh thường đã khớp',
  },
  DSLCK_CCP: {
    key: 'DSLCK_CCP',
    fileName: 'DSLCK CCP.xlsx',
    searchCode: 'ORDERBOOK_WORKING',
    route: '/ORDERS/ORDERBOOK',
    description: 'Danh sách lệnh thường chờ khớp',
  },
  DSLDH_CCP: {
    key: 'DSLDH_CCP',
    fileName: 'DSLDH CCP.xlsx',
    searchCode: 'ORDERBOOK_CANCELLED',
    route: '/ORDERS/ORDERBOOK',
    description: 'Danh sách lệnh thường đã hủy',
  },
  DSGD_CCP: {
    key: 'DSGD_CCP',
    fileName: 'DSGD CCP.xlsx',
    searchCode: 'ORDERMATCH_DETAIL',
    route: '/ORDERS/ORDERMATCH_DETAIL',
    description: 'Khớp lệnh chi tiết toàn sàn (DSGD)',
  },

  // ── 2. NHÓM LỆNH MARKET MAKER (/ORDERS/ORDERBOOK_MM) ───────────────────────
  DSL_MM_CCP: {
    key: 'DSL_MM_CCP',
    fileName: 'DSL MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Danh sách lệnh Market Maker (Tất cả)',
  },
  DSLDK_MM_CCP: {
    key: 'DSLDK_MM_CCP',
    fileName: 'DSLDK MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM_FILLED',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Danh sách lệnh Market Maker đã khớp',
  },
  DSLCK_MM_CCP: {
    key: 'DSLCK_MM_CCP',
    fileName: 'DSLCK MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM_WORKING',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Danh sách lệnh Market Maker chờ khớp',
  },
  DSLDH_MM_CCP: {
    key: 'DSLDH_MM_CCP',
    fileName: 'DSLDH MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM_CANCELLED',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Danh sách lệnh Market Maker đã hủy',
  },
  DSGD_MM_CCP: {
    key: 'DSGD_MM_CCP',
    fileName: 'DSGD MM CCP.xlsx',
    searchCode: 'ORDERBOOK_ALL_MM',
    route: '/ORDERS/ORDERBOOK_ALL_MM',
    description: 'Chi tiết khớp lệnh Market Maker',
  },

  // ── 3. NHÓM VỊ THẾ & LÃI LỖ ───────────────────────────────────────────────
  TTM_PRE1620: {
    key: 'TTM_PRE1620',
    fileName: 'TTM truoc 4h20.xlsx',
    searchCode: 'OPEN_POSITION_PRE1620',
    route: '/ORDERS/OPEN_POSITION',
    description: 'Trạng thái mở trước 16h20',
  },
  TTM_CCP: {
    key: 'TTM_CCP',
    fileName: 'TTM CCP.xlsx',
    searchCode: 'OPEN_POSITION',
    route: '/ORDERS/OPEN_POSITION',
    description: 'Trạng thái mở toàn sàn chốt cuối ngày (EOD)',
  },
  TTTT: {
    key: 'TTTT',
    fileName: 'TTTT.xlsx',
    searchCode: 'PNL_EXECUTED',
    route: '/ORDERS/PNL_EXECUTED',
    description: 'Trạng thái tất toán vị thế và lãi lỗ thực hiện',
  },

  // ── 4. NHÓM RỦI RO & KÝ QUỸ ───────────────────────────────────────────────
  QLTT_TKGD_PRE1620: {
    key: 'QLTT_TKGD_PRE1620',
    fileName: 'QL TT TKGD truoc 4h20.xlsx',
    searchCode: 'ACCTMARGIN_ALL_PRE1620',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'Quản lý trạng thái TKGD trước 16h20',
  },
  QL_TT_TKGD: {
    key: 'QL_TT_TKGD',
    fileName: 'QL TT TKGD.xlsx',
    searchCode: 'ACCTMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'Quản lý trạng thái ký quỹ TKGD cuối ngày (EOD)',
  },
  QLTT_TVKD: {
    key: 'QLTT_TVKD',
    fileName: 'QL TT TVKD.xlsx',
    searchCode: 'BROKERMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'Quản lý trạng thái ký quỹ TVKD cuối ngày',
  },
  DSQLKQ_TKGD: {
    key: 'DSQLKQ_TKGD',
    fileName: 'DSQLKQ TKGD.xlsx',
    searchCode: 'ACCTMARGIN_POS',
    route: '/RISKMNG/ACCTMARGIN_POS',
    description: 'Danh sách quản lý ký quỹ tài khoản giao dịch',
  },
  DSQLKQ_TVKD: {
    key: 'DSQLKQ_TVKD',
    fileName: 'DSQLKQ TVKD.xlsx',
    searchCode: 'BROKER_MARGIN_MNG',
    route: '/RISKMNG/MARGIN_MNG',
    description: 'Danh sách quản lý ký quỹ thành viên kinh doanh',
  },

  // ── 5. NHÓM TIỀN & TÀI KHOẢN ──────────────────────────────────────────────
  NR: {
    key: 'NR',
    fileName: 'NR.xlsx',
    searchCode: 'CASHTRANFER_HIST',
    route: '/CASHTRANFER/CASHTRANFER_HIST',
    description: 'Lịch sử nộp rút tiền CoreCCP',
  },
  DSTKGD_ACM: {
    key: 'DSTKGD_ACM',
    fileName: 'DSTKGD ACM.xlsx',
    searchCode: 'ACCOUNTS_INFO',
    route: '/ACCOUNTMNG/ACCOUNTS_INFO',
    description: 'Danh sách tài khoản giao dịch toàn hệ thống',
  },

  // ── 6. NHÓM HÀNG HÓA, HỢP ĐỒNG & GIÁ ──────────────────────────────────────
  GTT_CCP: {
    key: 'GTT_CCP',
    fileName: 'GTT CCP.xlsx',
    searchCode: 'SETTLEMENT',
    route: '/PRODUCT/SETTLEMENT',
    description: 'Giá thanh toán hàng ngày toàn bộ hợp đồng',
  },
  HH: {
    key: 'HH',
    fileName: 'HH.xlsx',
    searchCode: 'COMMODITY',
    route: '/PRODUCT/COMMODITY',
    description: 'Danh mục mặt hàng và quy cách giao dịch hàng hóa',
  },
  HD_CP2CO: {
    key: 'HD_CP2CO',
    fileName: 'HĐ CP2CO.xlsx',
    searchCode: 'CONTRACT_CP2CO',
    route: '/PRODUCT/COMMODITY',
    description: 'Hợp đồng Đồng Nano ACM (CP2CO)',
  },
  HD_PL1NY: {
    key: 'HD_PL1NY',
    fileName: 'HĐ PL1NY.xlsx',
    searchCode: 'CONTRACT_PL1NY',
    route: '/PRODUCT/COMMODITY',
    description: 'Hợp đồng Bạch kim Nano ACM (PL1NY)',
  },
  HD_SI5CO: {
    key: 'HD_SI5CO',
    fileName: 'HĐ SI5CO.xlsx',
    searchCode: 'CONTRACT_SI5CO',
    route: '/PRODUCT/COMMODITY',
    description: 'Hợp đồng Bạc Nano ACM (SI5CO)',
  },
  TYGIA: {
    key: 'TYGIA',
    fileName: 'Tỷ giá CCP.xlsx',
    searchCode: 'CURRENCYEXCHANGERATE',
    route: '/SYSCONFIGMNG/CURRENCYEXCHANGERATE',
    description: 'Tỷ giá nguyên tệ CoreCCP',
  },
  EOD: {
    key: 'EOD',
    fileName: 'EOD.xlsx',
    searchCode: 'ACCTMARGIN_HIST',
    route: '/EOD/ACCTMARGIN_HIST',
    description: 'Kết quả EOD Vận hành',
  },

  // ── Legacy Aliases ────────────────────────────────────────────────────────
  GTT: {
    key: 'GTT',
    fileName: 'GTT CCP.xlsx',
    searchCode: 'SETTLEMENT',
    route: '/PRODUCT/SETTLEMENT',
    description: 'Giá thanh toán hàng ngày toàn bộ hợp đồng (Alias)',
  },
  DSGD: {
    key: 'DSGD',
    fileName: 'DSGD CCP.xlsx',
    searchCode: 'ORDERMATCH_DETAIL',
    route: '/ORDERS/ORDERMATCH_DETAIL',
    description: 'Khớp lệnh chi tiết toàn sàn (Alias)',
  },
  TTM: {
    key: 'TTM',
    fileName: 'TTM CCP.xlsx',
    searchCode: 'OPEN_POSITION',
    route: '/ORDERS/OPEN_POSITION',
    description: 'Trạng thái mở toàn sàn chốt cuối ngày (Alias)',
  },
  DSL: {
    key: 'DSL',
    fileName: 'DSL CCP.xlsx',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    description: 'Danh sách lệnh thường (Alias)',
  },
  DSLDK: {
    key: 'DSLDK',
    fileName: 'DSLDK CCP.xlsx',
    searchCode: 'ORDERBOOK_FILLED',
    route: '/ORDERS/ORDERBOOK',
    description: 'Danh sách lệnh thường đã khớp (Alias)',
  },
  DSLCK: {
    key: 'DSLCK',
    fileName: 'DSLCK CCP.xlsx',
    searchCode: 'ORDERBOOK_WORKING',
    route: '/ORDERS/ORDERBOOK',
    description: 'Danh sách lệnh thường chờ khớp (Alias)',
  },
  DSLDH: {
    key: 'DSLDH',
    fileName: 'DSLDH CCP.xlsx',
    searchCode: 'ORDERBOOK_CANCELLED',
    route: '/ORDERS/ORDERBOOK',
    description: 'Danh sách lệnh thường đã hủy (Alias)',
  },
  DSL_MM: {
    key: 'DSL_MM',
    fileName: 'DSL MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Danh sách lệnh Market Maker (Alias)',
  },
  DSLDK_MM: {
    key: 'DSLDK_MM',
    fileName: 'DSLDK MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM_FILLED',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Danh sách lệnh Market Maker đã khớp (Alias)',
  },
  DSLCK_MM: {
    key: 'DSLCK_MM',
    fileName: 'DSLCK MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM_WORKING',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Danh sách lệnh Market Maker chờ khớp (Alias)',
  },
  DSLDH_MM: {
    key: 'DSLDH_MM',
    fileName: 'DSLDH MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM_CANCELLED',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Danh sách lệnh Market Maker đã hủy (Alias)',
  },
  DSGD_MM: {
    key: 'DSGD_MM',
    fileName: 'DSGD MM CCP.xlsx',
    searchCode: 'ORDERBOOK_ALL_MM',
    route: '/ORDERS/ORDERBOOK_ALL_MM',
    description: 'Chi tiết khớp lệnh Market Maker (Alias)',
  },
  QLTTTKGD_PRE1620: {
    key: 'QLTTTKGD_PRE1620',
    fileName: 'QL TT TKGD truoc 4h20.xlsx',
    searchCode: 'ACCTMARGIN_ALL_PRE1620',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'Quản lý trạng thái TKGD trước 16h20 (Alias)',
  },
  QLTTTKGD: {
    key: 'QLTTTKGD',
    fileName: 'QL TT TKGD.xlsx',
    searchCode: 'ACCTMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'Quản lý trạng thái ký quỹ TKGD (Alias)',
  },
  QLTTTVKD: {
    key: 'QLTTTVKD',
    fileName: 'QL TT TVKD.xlsx',
    searchCode: 'BROKERMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'Quản lý trạng thái ký quỹ TVKD (Alias)',
  },
  DSTKGD: {
    key: 'DSTKGD',
    fileName: 'DSTKGD ACM.xlsx',
    searchCode: 'ACCOUNTS_INFO',
    route: '/ACCOUNTMNG/ACCOUNTS_INFO',
    description: 'Danh sách tài khoản giao dịch (Alias)',
  },
  TTTT_CCP: {
    key: 'TTTT_CCP',
    fileName: 'TTTT CCP.xlsx',
    searchCode: 'PNL_EXECUTED',
    route: '/ORDERS/PNL_EXECUTED',
    description: 'Trạng thái tất toán vị thế và lãi lỗ thực hiện (Alias)',
  },
};

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
  ): Promise<{ rows: any[]; totalCount: number }> {
    const endpoint = `/ccp/inquiry/maintain/${searchCode}/search/${searchCode}`;
    const payload = {
      searchcode: searchCode,
      search: filterPayload.search || {},
      filter: filterPayload.filter || {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 200000 },
    };

    const res = await this.makeJsonPost(session, baseUrl, endpoint, payload, refererRoute);
    if (res.status === 200 && res.data && res.data.success) {
      const rows = res.data.data || [];
      const totalCount = res.data.page?.totalCount || rows.length;
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
   */
  private async convertJsonToExcel(rows: any[], sheetName: string, targetFilePath: string): Promise<void> {
    const dir = path.dirname(targetFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName || 'Sheet1');

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
      fgColor: { argb: 'FFE0E0E0' },
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

    const CANONICAL_CORECCP_KEYS = [
      'DSL_CCP', 'DSLDK_CCP', 'DSLCK_CCP', 'DSLDH_CCP', 'DSGD_CCP',
      'DSL_MM_CCP', 'DSLDK_MM_CCP', 'DSLCK_MM_CCP', 'DSLDH_MM_CCP', 'DSGD_MM_CCP',
      'TTM_PRE1620', 'TTM_CCP', 'TTTT',
      'QLTT_TKGD_PRE1620', 'QL_TT_TKGD', 'QLTT_TVKD', 'DSQLKQ_TKGD', 'DSQLKQ_TVKD',
      'NR', 'DSTKGD_ACM', 'GTT_CCP', 'HH', 'TYGIA',
      'HD_CP2CO', 'HD_PL1NY', 'HD_SI5CO',
    ];

    let targets: string[] = [];
    if (isFullRequested) {
      targets = CANONICAL_CORECCP_KEYS;
    } else if (options?.reportCodes && options.reportCodes.length > 0) {
      targets = options.reportCodes.flatMap((code) => {
        if (code === 'HD' || code === 'HD_ALL') {
          return Object.keys(CORECCP_API_REPORTS).filter((k) => k.startsWith('HD_'));
        }
        return [code];
      });
    } else if (options?.reportType) {
      targets = [options.reportType];
    } else {
      targets = ['GTT_CCP', 'DSGD_CCP', 'TTM_CCP', 'TTTT', 'QL_TT_TKGD'];
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

      for (const target of targets) {
        let reportDef = CORECCP_API_REPORTS[target];
        if (!reportDef) {
          const upper = target.toUpperCase();
          const cleanTarget = upper.replace(/[\s_-]/g, '');
          reportDef = Object.values(CORECCP_API_REPORTS).find((r) => {
            const cleanKey = r.key.toUpperCase().replace(/[\s_-]/g, '');
            const cleanSearch = r.searchCode.toUpperCase().replace(/[\s_-]/g, '');
            const cleanFile = r.fileName.toUpperCase().replace(/[\s_-]/g, '');
            return (
              cleanKey === cleanTarget ||
              cleanSearch === cleanTarget ||
              cleanFile.includes(cleanTarget) ||
              (cleanTarget === 'CLMATCH' && r.searchCode === 'ORDERMATCH_DETAIL')
            );
          });
        }
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
          const isServerExport =
            reportDef.searchCode === 'ORDERMATCH_DETAIL' ||
            reportDef.key === 'DSGD_CCP' ||
            reportDef.key === 'DSGD' ||
            reportDef.searchCode === 'ORDERBOOK_ALL_MM' ||
            reportDef.searchCode === 'OPEN_POSITION' ||
            reportDef.key === 'TTM_CCP' ||
            reportDef.key === 'TTM' ||
            reportDef.searchCode === 'PNL_EXECUTED' ||
            reportDef.key === 'TTTT' ||
            reportDef.key === 'TTTT_CCP';

          if (isServerExport) {
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

            // Đồng bộ thêm định dạng tên chuẩn ngày cho KlgdReconService
            const cleanDate = targetDate.includes('-')
              ? targetDate.split('-').reverse().join('.')
              : targetDate;

            if (reportDef.key === 'DSGD_CCP' || reportDef.key === 'DSGD') {
              const aliasPath = path.join(outputDirectory, `DSGD_${cleanDate}.xlsx`);
              if (aliasPath !== targetPath) {
                fs.writeFileSync(aliasPath, buffer);
              }
            } else if (reportDef.key === 'TTM_CCP' || reportDef.key === 'TTM' || reportDef.searchCode === 'OPEN_POSITION') {
              const aliasPath = path.join(outputDirectory, `TTM_${cleanDate}.xlsx`);
              if (aliasPath !== targetPath) {
                fs.writeFileSync(aliasPath, buffer);
              }
            } else if (reportDef.key === 'TTTT' || reportDef.key === 'TTTT_CCP' || reportDef.searchCode === 'PNL_EXECUTED') {
              const aliasPath = path.join(outputDirectory, `TTTT_${cleanDate}.xlsx`);
              if (aliasPath !== targetPath) {
                fs.writeFileSync(aliasPath, buffer);
              }
            }

            const stat = fs.statSync(targetPath);
            files.push({
              fileName: outFileName,
              absolutePath: targetPath,
              fileSize: stat.size,
              mtime: stat.mtime,
              category: 'CCP',
              metadata: {
                transport: 'SERVER_SIDE_EXPORT_WEBSOCKET',
                searchCode: reportDef.searchCode,
                fileSize: stat.size,
              },
            });
            this.logger.log(`[CoreCcpApiAdapter] ✅ Tải thành công ${outFileName} qua Server Export (${stat.size} bytes)`);
          } else {
            // KIỂU 1: Tra cứu JSON
            const searchResult = await this.searchFullJson(
              session,
              reportDef.searchCode,
              baseUrl,
              reportDef.route,
              reportDef.filterPayload || {},
            );

            await this.convertJsonToExcel(searchResult.rows, reportDef.searchCode, targetPath);

            const stat = fs.statSync(targetPath);
            files.push({
              fileName: outFileName,
              absolutePath: targetPath,
              fileSize: stat.size,
              mtime: stat.mtime,
              category: 'CCP',
              metadata: {
                transport: 'DIRECT_JSON_SEARCH_EXCEL',
                searchCode: reportDef.searchCode,
                rowCount: searchResult.totalCount,
              },
            });
            this.logger.log(`[CoreCcpApiAdapter] ✅ Xuất thành công ${outFileName} (${searchResult.totalCount} dòng, ${stat.size} bytes)`);
          }
        } catch (searchErr: any) {
          this.logger.error(`[CoreCcpApiAdapter] Lỗi gọi API cho ${reportDef.key}: ${searchErr.message}`);
          errors.push(`${reportDef.key}: ${searchErr.message}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(`[CoreCcpApiAdapter] Tải báo cáo CoreCCP thất bại: ${errors.join('; ')}`);
      }

      return {
        success: true,
        source: 'CCP',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        durationMs: Date.now() - startTime,
        summary: `Đã tải thành công ${files.length} báo cáo CoreCCP qua Direct REST API`,
      };
    } catch (err: any) {
      this.logger.error(`[CoreCcpApiAdapter] Thất bại khi tải báo cáo CoreCCP: ${err.message}`);
      return {
        success: false,
        source: 'CCP',
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
      const session = await this.getValidSession();
      return !!session && !!session.accessToken;
    } catch {
      return false;
    }
  }
}

