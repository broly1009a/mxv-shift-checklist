/**
 * auth.service.ts
 * Module Xác thực Core Exchange (CE)
 * Quy trình: Bẫy _csrf -> POST /login -> Bắt Session Cookie -> OAuth2 Authorize Code -> Verify Dashboard
 */

import * as fs from 'fs';
import * as path from 'path';
import { CookieJar } from './cookie-jar';
import { ICoreExchangeAuthSession, ICoreExchangeCredentials } from './types';

export class CoreExchangeAuthService {
  private readonly defaultBaseUrl = 'https://uat-coreexchange.mxv.com.vn';
  private readonly defaultClientId = 'web-exchange-mxv';
  private sessionFilePath: string;
  private cachedSession: ICoreExchangeAuthSession | null = null;

  constructor(sessionFilePath?: string) {
    this.sessionFilePath =
      sessionFilePath || path.resolve(process.cwd(), 'coreexchange_session.json');
    this.loadSessionFromDisk();
  }

  private loadSessionFromDisk(): void {
    try {
      if (fs.existsSync(this.sessionFilePath)) {
        const raw = fs.readFileSync(this.sessionFilePath, 'utf8');
        this.cachedSession = JSON.parse(raw);
      }
    } catch {
      this.cachedSession = null;
    }
  }

  private saveSessionToDisk(session: ICoreExchangeAuthSession): void {
    try {
      const dir = path.dirname(this.sessionFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.sessionFilePath, JSON.stringify(session, null, 2), 'utf8');
      this.cachedSession = session;
    } catch (err: any) {
      console.warn(`[CoreExchangeAuthService] Không thể lưu session ra đĩa: ${err.message}`);
    }
  }

  /**
   * Kiểm tra tính hợp lệ của Session Cookie bằng cách gọi /dashboard
   */
  public async verifySession(baseUrl: string, sessionCookie: string): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: {
          'Cookie': sessionCookie,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        redirect: 'manual',
      });

      // Nếu trả về 200 OK -> Session hợp lệ
      // Nếu 302 Found về /login -> Session đã hết hạn
      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Thực hiện quy trình đăng nhập đầy đủ
   */
  public async login(
    creds: ICoreExchangeCredentials = {},
    forceReLogin: boolean = false
  ): Promise<ICoreExchangeAuthSession> {
    const baseUrl = creds.baseUrl || process.env.COREEXCHANGE_BASE_URL || this.defaultBaseUrl;
    const username = creds.username || process.env.COREEXCHANGE_USERNAME || 'hieptruong';
    const password = creds.password || process.env.COREEXCHANGE_PASSWORD || 'Taovipko0!';
    const clientId = creds.clientId || this.defaultClientId;
    const redirectUri = creds.redirectUri || `${baseUrl}/validate_code`;

    // 1. Kiểm tra session cache nếu chưa yêu cầu đăng nhập lại
    if (!forceReLogin && this.cachedSession && this.cachedSession.sessionCookie) {
      const isValid = await this.verifySession(baseUrl, this.cachedSession.sessionCookie);
      if (isValid) {
        return this.cachedSession;
      }
    }

    const jar = new CookieJar();
    const commonHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      'Accept-Language': 'vi,en;q=0.9',
      'Sec-Ch-Ua': '"Chromium";v="120", "Not A?Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
    };

    // BƯỚC 1: Truy cập /login và bẫy _csrf token
    const loginPageRes = await fetch(`${baseUrl}/login`, {
      headers: {
        ...commonHeaders,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
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

    // BƯỚC 2: Gửi thông tin xác thực tài khoản POST /login
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
        'Cookie': jar.getCookieHeader(),
        'Origin': baseUrl,
        'Referer': `${baseUrl}/login`,
      },
      body: bodyParams.toString(),
      redirect: 'manual',
    });

    jar.setFromHeaders(postLoginRes.headers);
    const loc = postLoginRes.headers.get('location');

    if (postLoginRes.status !== 302 || !loc || loc.includes('error')) {
      throw new Error(
        `Đăng nhập Core Exchange thất bại! HTTP Status: ${postLoginRes.status}. Location: ${loc || 'none'}`
      );
    }

    const sessionCookie = jar.getSessionCookie();

    // BƯỚC 3: Gọi OAuth2 Authorize để lấy Authorization Code (Client: web-exchange-mxv)
    let oauthCode: string | undefined;
    const authUrl = `${baseUrl}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=openid%20profile`;

    const authRes = await fetch(authUrl, {
      headers: {
        ...commonHeaders,
        'Cookie': jar.getCookieHeader(),
      },
      redirect: 'manual',
    });

    jar.setFromHeaders(authRes.headers);
    const authLoc = authRes.headers.get('location');

    if (authLoc && authLoc.includes('code=')) {
      const urlObj = new URL(authLoc.startsWith('http') ? authLoc : `${baseUrl}${authLoc}`);
      oauthCode = urlObj.searchParams.get('code') || undefined;
    }

    // BƯỚC 4: Verify truy cập phiên làm việc
    await this.verifySession(baseUrl, sessionCookie);

    // BƯỚC 5: Lưu dữ liệu phiên làm việc
    const sessionData: ICoreExchangeAuthSession = {
      baseUrl,
      username,
      sessionCookie,
      oauthCode,
      clientId,
      updatedAt: new Date().toISOString(),
    };

    this.saveSessionToDisk(sessionData);
    return sessionData;
  }

  /**
   * Lấy phiên làm việc hợp lệ (Tự động tái sử dụng session cache nếu còn hiệu lực)
   */
  public async getValidSession(creds?: ICoreExchangeCredentials): Promise<ICoreExchangeAuthSession> {
    return this.login(creds, false);
  }
}
