/**
 * ============================================================================
 * CORECCP-AUTH.SERVICE.TS
 * ============================================================================
 * Dịch vụ xác thực và quản lý phiên làm việc CoreCCP API (Bearer JWT, SESSION cookie).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import { ICcpAuthSession, ICcpCredentials } from './coreccp.types';

@Injectable()
export class CoreCcpAuthService {
  private readonly logger = new Logger(CoreCcpAuthService.name);
  private currentSession: ICcpAuthSession | null = null;

  /**
   * Đăng nhập CoreCCP và lấy Bearer Token cùng Session Cookie
   */
  async authenticate(credentials: ICcpCredentials): Promise<ICcpAuthSession> {
    // 1. Kiểm tra session hiện tại nếu còn hiệu lực (trước 5 phút hết hạn)
    if (this.currentSession && this.isSessionValid(this.currentSession)) {
      this.logger.debug(`[Auth] Tái sử dụng phiên làm việc hiện tại (User: ${this.currentSession.username})`);
      return this.currentSession;
    }

    const ccpUrl = (credentials.url || process.env.CORECCP_URL || 'https://uat-coreccp.mxv.com.vn').replace(/\/+$/, '');
    const username = credentials.username || process.env.CORECCP_USERNAME || 'hieptruong';
    const password = credentials.password || process.env.CORECCP_PASSWORD || 'Taovipko0!';

    this.logger.log(`[Auth] Đang xác thực với CoreCCP (${ccpUrl}) cho tài khoản: ${username}...`);

    try {
      // 2. Gọi HTTP POST /login
      const loginResult = await this.performHttpLogin(ccpUrl, username, password);
      
      const jwtPayload = this.decodeJwtPayload(loginResult.accessToken);
      const userId = jwtPayload?.user_id || 71;
      const expiresAt = (jwtPayload?.exp || Math.floor(Date.now() / 1000) + 7200) * 1000;

      this.currentSession = {
        accessToken: loginResult.accessToken,
        sessionCookie: loginResult.sessionCookie,
        userId: Number(userId),
        username,
        expiresAt,
        rawJwtPayload: jwtPayload,
      };

      this.logger.log(`[Auth] ✓ Đăng nhập thành công! User ID: ${userId}, Hết hạn lúc: ${new Date(expiresAt).toLocaleTimeString()}`);
      return this.currentSession;
    } catch (err: any) {
      this.logger.error(`[Auth] ✗ Đăng nhập CoreCCP thất bại: ${err.message}`);
      throw err;
    }
  }

  /**
   * Lấy phiên xác thực hiện tại, nếu chưa có sẽ tự đăng nhập
   */
  async getValidSession(credentials?: ICcpCredentials): Promise<ICcpAuthSession> {
    if (this.currentSession && this.isSessionValid(this.currentSession)) {
      return this.currentSession;
    }
    return this.authenticate(credentials || { username: 'hieptruong' });
  }

  /**
   * Cập nhật phiên thủ công (Dùng khi lấy được token từ Browser hoặc Script test)
   */
  setSession(session: ICcpAuthSession): void {
    this.currentSession = session;
  }

  /**
   * Kiểm tra phiên có còn hiệu lực không
   */
  private isSessionValid(session: ICcpAuthSession): boolean {
    const now = Date.now();
    // Còn hạn ít nhất 5 phút
    return session.expiresAt - now > 5 * 60 * 1000;
  }

  /**
   * Giải mã payload của JWT (Base64Url decode)
   */
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

  /**
   * Thực hiện gọi POST /login với native HTTPS request
   */
  private performHttpLogin(
    baseUrl: string,
    username: string,
    password: string,
  ): Promise<{ accessToken: string; sessionCookie: string }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(baseUrl);
      const postData = JSON.stringify({ username, password });

      const options: https.RequestOptions = {
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
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          // Bóc tách Cookie SESSION từ Set-Cookie headers
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
            // CoreCCP trả về token qua json.token hoặc json.accessToken hoặc json.data.token
            const accessToken = json.token || json.accessToken || json.data?.token || json.data?.accessToken;
            if (accessToken) {
              return resolve({ accessToken, sessionCookie });
            }
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

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout khi đăng nhập CoreCCP'));
      });

      req.write(postData);
      req.end();
    });
  }
}
