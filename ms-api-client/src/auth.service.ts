/**
 * ms-auth.service.ts
 * Quản lý xác thực 2 bước (Password + PIN) và Token JWT cho hệ thống M-System (Vendor Newgen)
 */

import * as fs from 'fs';
import * as path from 'path';
import { IMsCredentials, IMsSession } from './types';

export class MsAuthService {
  private currentSession: IMsSession | null = null;
  private readonly defaultBaseUrl = 'https://api-dev.newgen.dev';
  private readonly defaultAdminUrl = 'https://admin-dev.msystem.newgen.dev';

  constructor(private readonly sessionFilePath?: string) {}

  /**
   * Giải mã Payload của JWT để trích xuất thời hạn hết hạn (exp)
   */
  public decodeJwt(token: string): { expEpoch: number; expiresAt: string; isExpired: boolean; remainingMinutes: number } | null {
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

  /**
   * Lấy Bearer Token hợp lệ (tự động dùng cache hoặc đăng nhập lại nếu hết hạn)
   */
  public async getValidToken(credentials: IMsCredentials = {}): Promise<string> {
    // 1. Kiểm tra session trong RAM
    if (this.currentSession && this.isSessionValid(this.currentSession)) {
      return this.currentSession.token;
    }

    // 2. Kiểm tra session trong file lưu trữ
    const fileSession = this.loadSessionFromFile();
    if (fileSession && this.isSessionValid(fileSession)) {
      this.currentSession = fileSession;
      return fileSession.token;
    }

    // 3. Nếu không có hoặc đã hết hạn, thực hiện đăng nhập mới
    const newSession = await this.login(credentials);
    this.currentSession = newSession;
    this.saveSessionToFile(newSession);
    return newSession.token;
  }

  /**
   * Kiểm tra xem Session còn hạn ít nhất 5 phút không
   */
  private isSessionValid(session: IMsSession): boolean {
    const jwt = this.decodeJwt(session.token);
    if (!jwt || jwt.isExpired) return false;
    return jwt.remainingMinutes >= 5;
  }

  /**
   * Quy trình Đăng nhập 2 bước của M-System
   */
  public async login(credentials: IMsCredentials = {}): Promise<IMsSession> {
    const baseUrl = credentials.baseUrl || process.env.MS_BASE_URL || this.defaultBaseUrl;
    const adminUrl = credentials.adminUrl || process.env.MS_ADMIN_URL || this.defaultAdminUrl;
    const username = credentials.username || process.env.MS_USERNAME || 'mxvhieptruong';
    const password = credentials.password || process.env.MS_PASSWORD || 'Taovipko0!';
    const pin = credentials.pin || process.env.MS_PIN || '269696';

    const commonHeaders: Record<string, string> = {
      'accept': 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      'origin': adminUrl,
      'referer': `${adminUrl}/`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // ─── BƯỚC 1: Đăng nhập mật khẩu ──────────────────────────────────────────
    const loginRes = await fetch(`${baseUrl}/am/admin/users/login`, {
      method: 'POST',
      headers: { ...commonHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const loginData = await loginRes.json().catch(() => null) as any;
    if (!loginRes.ok || loginData?.status !== 'ok' || !loginData?.data?.user) {
      throw new Error(`Đăng nhập Bước 1 (Password) thất bại: ${loginData?.errMsg || loginData?.message || loginRes.status}`);
    }

    const userStep1 = loginData.data.user;
    const userId = userStep1.id || userStep1._id;
    const tempToken = userStep1.accessToken;

    if (!userId || !tempToken) {
      throw new Error('Không nhận được userId hoặc accessToken tạm từ phản hồi Bước 1');
    }

    // ─── BƯỚC 2: Xác thực mã PIN bảo mật ────────────────────────────────────
    const pinRes = await fetch(`${baseUrl}/am/admin/users/verifyPin/${userId}`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'content-type': 'application/json',
        'authorization': `Bearer ${tempToken}`,
      },
      body: JSON.stringify({ pin: String(pin) }),
    });

    const pinData = await pinRes.json().catch(() => null) as any;
    if (!pinRes.ok || pinData?.status !== 'ok' || !pinData?.data?.user) {
      throw new Error(`Đăng nhập Bước 2 (PIN) thất bại: ${pinData?.errMsg || pinData?.message || pinRes.status}`);
    }

    const finalUser = pinData.data.user;
    const finalToken = finalUser.accessToken;

    if (!finalToken) {
      throw new Error('Không nhận được Bearer Token chính thức sau Bước 2 verify PIN');
    }

    const jwtInfo = this.decodeJwt(finalToken);

    const session: IMsSession = {
      token: finalToken,
      tokenType: 'Bearer',
      userId: finalUser.id || userId,
      username: finalUser.username || username,
      fullName: finalUser.fullName || username,
      email: finalUser.email || '',
      expiresAt: jwtInfo?.expiresAt || '',
      expiresEpoch: jwtInfo?.expEpoch || 0,
      updatedAt: new Date().toISOString(),
    };

    return session;
  }

  private loadSessionFromFile(): IMsSession | null {
    const filePath = this.sessionFilePath || path.resolve(__dirname, '../ms_session.json');
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return null;
    }
  }

  private saveSessionToFile(session: IMsSession): void {
    const filePath = this.sessionFilePath || path.resolve(__dirname, '../ms_session.json');
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
    } catch {}
  }
}
