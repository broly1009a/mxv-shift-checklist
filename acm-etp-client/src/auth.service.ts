/**
 * auth.service.ts
 * Module Xác thực ACM ETP (Vendor ACM Mex)
 * Xử lý AWS ALB Sticky Cookie Jar + Tự sinh Client UUID v4 + Giải mã Captcha + Quản lý Token Session
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { CookieJar } from './cookie-jar';
import { IAcmCredentials, IAcmSession, CaptchaSolverHook } from './types';

export class AcmAuthService {
  private readonly defaultBaseUrl = 'https://acm-etp.acmmex.com';
  private sessionFilePath: string;
  private cachedSession: IAcmSession | null = null;
  private captchaSolver: CaptchaSolverHook | null = null;

  constructor(sessionFilePath?: string, captchaSolver?: CaptchaSolverHook) {
    this.sessionFilePath =
      sessionFilePath || path.resolve(process.cwd(), 'acm_session.json');
    this.captchaSolver = captchaSolver || null;
    this.loadSessionFromDisk();
  }

  /**
   * Đăng ký custom solver cho captcha (ví dụ: AI OCR hoặc service bên ngoài)
   */
  public setCaptchaSolver(solver: CaptchaSolverHook): void {
    this.captchaSolver = solver;
  }

  /**
   * Đọc cache session từ đĩa
   */
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

  /**
   * Lưu session vào đĩa
   */
  private saveSessionToDisk(session: IAcmSession): void {
    try {
      const dir = path.dirname(this.sessionFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.sessionFilePath,
        JSON.stringify(session, null, 2),
        'utf8'
      );
      this.cachedSession = session;
    } catch (err: any) {
      console.warn(`[AcmAuthService] Không thể lưu session vào đĩa: ${err.message}`);
    }
  }

  /**
   * Kiểm tra Token hiện tại còn hợp lệ không qua /exchange/sys/menu/nav
   */
  public async verifyToken(baseUrl: string, token: string, cookies: string): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/exchange/sys/menu/nav`, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'token': token,
          'Cookie': cookies,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!res.ok) return false;
      const data: any = await res.json();
      return data && data.code === 0;
    } catch {
      return false;
    }
  }

  /**
   * Mặc định giải mã Captcha qua Terminal prompt nếu không có custom solver
   */
  private async defaultSolveCaptcha(
    _imageBuffer: Buffer,
    imagePath: string
  ): Promise<string> {
    console.log(`\n------------------------------------------------------`);
    console.log(`[ACM ETP CAPTCHA PROMPT] Ảnh Captcha đã được tải về:`);
    console.log(`📂 ${imagePath}`);
    console.log(`👉 Hãy mở file ảnh hoặc xem trực tiếp để nhập mã 5 ký tự.`);
    console.log(`------------------------------------------------------`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('⌨️  Nhập mã Captcha (5 ký tự): ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Thực hiện quy trình đăng nhập hoàn chỉnh
   */
  public async login(
    creds: IAcmCredentials = {},
    forceReLogin: boolean = false
  ): Promise<IAcmSession> {
    const baseUrl = creds.baseUrl || process.env.ACM_BASE_URL || this.defaultBaseUrl;
    const username = creds.username || process.env.ACM_USERNAME || 'MXVRO';
    const password = creds.password || process.env.ACM_PASSWORD || "BT'$2=09_1Vm46$S";

    // 1. Kiểm tra session cache nếu chưa yêu cầu đăng nhập lại
    if (!forceReLogin && this.cachedSession && this.cachedSession.token) {
      const isValid = await this.verifyToken(
        baseUrl,
        this.cachedSession.token,
        this.cachedSession.cookies
      );
      if (isValid) {
        return this.cachedSession;
      }
    }

    const jar = new CookieJar();
    const commonHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Ch-Ua': '"Chromium";v="120", "Not A?Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
    };

    // BƯỚC 1: Khởi tạo phiên & hứng Cookie Sticky từ AWS ALB
    const initRes = await fetch(`${baseUrl}/exchange/index.html`, {
      headers: {
        ...commonHeaders,
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!initRes.ok) {
      throw new Error(
        `Truy cập ACM /exchange/index.html thất bại! HTTP Status: ${initRes.status}`
      );
    }
    jar.setFromHeaders(initRes.headers);

    // BƯỚC 2: Tự sinh Client UUID (UUID v4)
    const uuid = crypto.randomUUID();

    // BƯỚC 3: Tải ảnh Captcha
    const captchaUrl = `${baseUrl}/exchange/captcha?uuid=${uuid}`;
    const captchaRes = await fetch(captchaUrl, {
      headers: {
        ...commonHeaders,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': `${baseUrl}/exchange/index.html`,
        'Cookie': jar.getCookieHeader(),
      },
    });

    if (!captchaRes.ok) {
      throw new Error(`Tải ảnh captcha ACM thất bại! HTTP Status: ${captchaRes.status}`);
    }

    jar.setFromHeaders(captchaRes.headers);
    const captchaBuffer = Buffer.from(await captchaRes.arrayBuffer());
    const tempCaptchaDir = path.dirname(this.sessionFilePath);
    const tempCaptchaPath = path.join(tempCaptchaDir, 'temp_acm_captcha.gif');
    fs.writeFileSync(tempCaptchaPath, captchaBuffer);

    // BƯỚC 4: Giải mã Captcha
    let captchaCode = '';
    if (this.captchaSolver) {
      captchaCode = await this.captchaSolver(captchaBuffer, tempCaptchaPath);
    } else {
      captchaCode = await this.defaultSolveCaptcha(captchaBuffer, tempCaptchaPath);
    }

    if (!captchaCode) {
      throw new Error('Mã Captcha ACM không được để trống!');
    }

    // BƯỚC 5: Gửi Request Đăng Nhập POST /exchange/login
    const loginPayload = {
      username,
      password,
      uuid,
      captcha: captchaCode,
    };

    const loginRes = await fetch(`${baseUrl}/exchange/login`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/json;charset=UTF-8',
        'Accept': 'application/json, text/plain, */*',
        'Origin': baseUrl,
        'Referer': `${baseUrl}/exchange/index.html`,
        'Cookie': jar.getCookieHeader(),
      },
      body: JSON.stringify(loginPayload),
    });

    jar.setFromHeaders(loginRes.headers);
    const loginResult: any = await loginRes.json();

    if (loginResult.code !== 0) {
      throw new Error(
        `Đăng nhập ACM ETP thất bại (Code ${loginResult.code}): ${loginResult.msg || 'Sai captcha hoặc mật khẩu'}`
      );
    }

    const token = loginResult.data && loginResult.data.token;
    if (!token) {
      throw new Error(
        `Không tìm thấy token trong dữ liệu phản hồi từ ACM! Data: ${JSON.stringify(loginResult)}`
      );
    }

    // Lưu token vào CookieJar
    jar.set('token', token);
    jar.set('language', 'en');

    const sessionData: IAcmSession = {
      username,
      token,
      cookies: jar.getCookieHeader(),
      updatedAt: new Date().toISOString(),
    };

    this.saveSessionToDisk(sessionData);

    // Dọn dẹp ảnh captcha tạm thời
    try {
      if (fs.existsSync(tempCaptchaPath)) {
        fs.unlinkSync(tempCaptchaPath);
      }
    } catch {}

    return sessionData;
  }

  /**
   * Lấy session hợp lệ (tự tái sử dụng session cache nếu còn hạn)
   */
  public async getValidSession(creds?: IAcmCredentials): Promise<IAcmSession> {
    return this.login(creds, false);
  }
}
