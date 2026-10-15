/**
 * ============================================================================
 * AUTH SERVICE - CORECCP SESSION & TOKEN MANAGER
 * ============================================================================
 * Hoàn toàn độc lập (Zero-framework), chạy được trên cả NestJS, Express, Script.
 * ============================================================================
 */

import * as https from 'https';
import { ICcpAuthSession, ICcpCredentials } from './types';

export class CoreCcpAuthService {
  private currentSession: ICcpAuthSession | null = null;

  /**
   * Đăng nhập CoreCCP và lấy Bearer Token cùng Session Cookie
   */
  async authenticate(credentials: ICcpCredentials): Promise<ICcpAuthSession> {
    if (this.currentSession && this.isSessionValid(this.currentSession)) {
      return this.currentSession;
    }

    const ccpUrl = (credentials.url || 'https://uat-coreccp.mxv.com.vn').replace(/\/+$/, '');
    const username = credentials.username || 'hieptruong';
    const password = credentials.password || 'Taovipko0!';

    const loginResult = await this.performHttpLogin(ccpUrl, username, password);
    const jwtPayload = this.decodeJwtPayload(loginResult.accessToken);
    const userId = Number(jwtPayload?.user_id || 71);
    const expiresAt = (jwtPayload?.exp || Math.floor(Date.now() / 1000) + 7200) * 1000;

    this.currentSession = {
      accessToken: loginResult.accessToken,
      sessionCookie: loginResult.sessionCookie,
      userId,
      username,
      expiresAt,
      rawJwtPayload: jwtPayload,
    };

    return this.currentSession;
  }

  async getValidSession(credentials?: ICcpCredentials): Promise<ICcpAuthSession> {
    if (this.currentSession && this.isSessionValid(this.currentSession)) {
      return this.currentSession;
    }
    return this.authenticate(credentials || { username: 'hieptruong' });
  }

  setSession(session: ICcpAuthSession): void {
    this.currentSession = session;
  }

  private isSessionValid(session: ICcpAuthSession): boolean {
    return session.expiresAt - Date.now() > 5 * 60 * 1000;
  }

  private decodeJwtPayload(token: string): any {
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

  private performHttpLogin(
    baseUrl: string,
    username: string,
    password: string,
  ): Promise<{ accessToken: string; sessionCookie: string }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(baseUrl);
      const postData = JSON.stringify({ username, password });

      const req = https.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: '/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Accept': 'application/json, text/plain, */*',
          'connectkey': 'fsscssiam2021',
          'x-devicetype': 'WEB',
          'x-lang': 'vi',
          'Origin': baseUrl,
          'Referer': `${baseUrl}/login`,
        },
        timeout: 10000,
      }, (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          const rawCookies = res.headers['set-cookie'] || [];
          let sessionCookie = '';
          for (const c of rawCookies) {
            const match = c.match(/SESSION=([^;]+)/i);
            if (match) {
              sessionCookie = match[1];
              break;
            }
          }

          try {
            const json = JSON.parse(body);
            const accessToken = json.token || json.accessToken || json.data?.token || json.data?.accessToken;
            if (accessToken) return resolve({ accessToken, sessionCookie });
            if (res.statusCode !== 200) {
              return reject(new Error(`Login HTTP ${res.statusCode}: ${json.message || body}`));
            }
            resolve({ accessToken: '', sessionCookie });
          } catch {
            if (res.statusCode === 200 || res.statusCode === 302) {
              resolve({ accessToken: '', sessionCookie });
            } else {
              reject(new Error(`Login trả về lỗi ${res.statusCode}: ${body.substring(0, 100)}`));
            }
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout khi đăng nhập CoreCCP'));
      });

      req.write(postData);
      req.end();
    });
  }
}
