import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  IIngressPort,
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
  IngressFileDetail,
  decrypt,
} from '../../../shared';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

export interface IMsCredentials {
  baseUrl?: string;
  adminUrl?: string;
  username?: string;
  password?: string;
  pin?: string;
}

export interface IMsSession {
  token: string;
  tokenType: string;
  userId: string;
  username: string;
  fullName: string;
  email?: string;
  expiresAt: string;
  expiresEpoch: number;
  updatedAt: string;
}

export interface IMsReportDef {
  key: string;
  name: string;
  fileName: string;
  group: string;
  endpoint: string;
  method: 'GET' | 'POST';
  ext: 'xlsx' | 'csv';
  queryParams?: Record<string, string>;
  description?: string;
}

/**
 * DANH MỤC 18 BÁO CÁO M-SYSTEM CHUẨN XÁC 100% (GROUND TRUTH AUDITED)
 */
export const MS_REPORTS_REGISTRY: Record<string, IMsReportDef> = {
  // 1. NHẬT KÝ THAO TÁC HỆ THỐNG
  'NKTTHT': {
    key: 'NKTTHT',
    name: 'Nhật ký thao tác hệ thống',
    fileName: 'NKTTHT.xlsx',
    group: 'QL Hệ thống',
    endpoint: '/approval/admin/activities/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { sort_by: 'desc(datetime)' },
    description: 'Nhật ký thao tác của người dùng trên toàn hệ thống M-System',
  },

  // 2. DANH SÁCH TÀI KHOẢN GIAO DỊCH
  'DSTKGD-Futures': {
    key: 'DSTKGD-Futures',
    name: 'Danh sách TKGD Futures',
    fileName: 'DSTKGD-Futures.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'subInvestorType[eq]': 'NULL' },
    description: 'Danh sách tài khoản giao dịch Futures thông thường',
  },
  'DSTKGD-Spread': {
    key: 'DSTKGD-Spread',
    name: 'Danh sách TKGD Spread',
    fileName: 'DSTKGD-Spread.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'subInvestorType[eq]': 'S' },
    description: 'Danh sách tài khoản giao dịch Spreads',
  },
  'DSTKGD-LME': {
    key: 'DSTKGD-LME',
    name: 'Danh sách TKGD LME',
    fileName: 'DSTKGD-LME.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'subInvestorType[eq]': 'LME' },
    description: 'Danh sách tài khoản giao dịch LME',
  },
  'DSTKGD-ACM': {
    key: 'DSTKGD-ACM',
    name: 'Danh sách TKGD ACM',
    fileName: 'DSTKGD-ACM.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'subInvestorType[eq]': 'ACM' },
    description: 'Danh sách tài khoản giao dịch ACM',
  },

  // 3. THIẾT LẬP KÝ QUỸ & NỘP RÚT TIỀN
  'TLQHSKQ': {
    key: 'TLQHSKQ',
    name: 'Thiết lập quan hệ số ký quỹ',
    fileName: 'TLQHSKQ.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/margin-ratio-multiplier/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { sort_by: 'desc(createdDate)' },
    description: 'Bảng thiết lập hệ số ký quỹ và tỷ lệ ký quỹ theo tài khoản',
  },
  'NR': {
    key: 'NR',
    name: 'Danh sách nộp rút tiền',
    fileName: 'NR.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/marginTransactionHistory/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Lịch sử giao dịch tiền, nộp rút tiền ký quỹ tài khoản',
  },
  'DSTrader': {
    key: 'DSTrader',
    name: 'Danh sách Trader',
    fileName: 'DSTrader.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/traders/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { sort_by: 'desc(createdDate)' },
    description: 'Danh sách quản lý Trader trên hệ thống',
  },

  // 4. SỔ LỆNH & KHỚP LỆNH
  'DSLDK': {
    key: 'DSLDK',
    name: 'Danh sách lệnh đã khớp',
    fileName: 'DSLDK.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/order/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'status[in]': 'PARTIALLY_FILLED,FILLED' },
    description: 'Danh sách lệnh giao dịch đã khớp một phần hoặc toàn bộ',
  },
  'DSLCK': {
    key: 'DSLCK',
    name: 'Danh sách lệnh chờ khớp',
    fileName: 'DSLCK.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/order/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'status[in]': 'WORKING' },
    description: 'Danh sách lệnh giao dịch đang chờ khớp trên sàn',
  },
  'DSLH': {
    key: 'DSLH',
    name: 'Danh sách lệnh hủy',
    fileName: 'DSLH.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/order/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'status[in]': 'CANCELLED' },
    description: 'Danh sách lệnh giao dịch đã bị hủy',
  },
  'DSLK': {
    key: 'DSLK',
    name: 'Danh sách lệnh khác',
    fileName: 'DSLK.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/order/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Danh sách lệnh giao dịch khác',
  },
  'DSGD': {
    key: 'DSGD',
    name: 'Danh sách giao dịch',
    fileName: 'DSGD.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/transaction/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Khớp lệnh chi tiết toàn sàn trong phiên',
  },

  // 5. TRẠNG THÁI VỊ THẾ & TẤT TOÁN
  'TTM': {
    key: 'TTM',
    name: 'Trạng thái mở',
    fileName: 'TTM.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/position/admin/open/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Trạng thái vị thế mở của toàn bộ tài khoản nhà đầu tư',
  },
  'TTTT': {
    key: 'TTTT',
    name: 'Trạng thái tất toán',
    fileName: 'TTTT.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/position/admin/settle/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Trạng thái tất toán vị thế và lãi lỗ thực tế trong phiên',
  },
  'TTCDH': {
    key: 'TTCDH',
    name: 'Trạng thái tất toán chờ đáo hạn LME',
    fileName: 'TTCDH.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/position/admin/settleLME/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Trạng thái tất toán chờ đáo hạn các hợp đồng LME',
  },

  // 6. QUẢN LÝ KÝ QUỸ & TÀI KHOẢN ÂM
  'DSQLKQ': {
    key: 'DSQLKQ',
    name: 'Danh sách quản lý ký quỹ',
    fileName: 'DSQLKQ.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/margin/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { limit: '20', offset: '0' },
    description: 'Danh sách quản lý ký quỹ tài khoản',
  },
  'QLTKGD': {
    key: 'QLTKGD',
    name: 'Quản lý tài khoản giao dịch',
    fileName: 'QLTKGD.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/margin/admin/status/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Quản lý trạng thái ký quỹ tài khoản giao dịch',
  },
  'QLTKGD âm KQ': {
    key: 'QLTKGD âm KQ',
    name: 'Quản lý TKGD âm ký quỹ',
    fileName: 'QLTKGD_am_KQ.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/margin/admin/status/negative/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Danh sách tài khoản giao dịch rơi vào tình trạng âm ký quỹ',
  },
};

@Injectable()
export class MsApiAdapter implements IIngressPort {
  private readonly logger = new Logger(MsApiAdapter.name);
  private currentSession: IMsSession | null = null;
  private readonly defaultBaseUrl = 'https://api-dev.newgen.dev';
  private readonly defaultAdminUrl = 'https://admin-dev.msystem.newgen.dev';
  private readonly sessionCachePath = path.resolve(process.cwd(), 'temp', 'ms_session.json');

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  /**
   * Giải mã Payload JWT để kiểm tra thời hạn
   */
  private decodeJwt(token: string): { expEpoch: number; expiresAt: string; isExpired: boolean; remainingMinutes: number } | null {
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

  private isSessionValid(session: IMsSession): boolean {
    const jwt = this.decodeJwt(session.token);
    if (!jwt || jwt.isExpired) return false;
    return jwt.remainingMinutes >= 5;
  }

  private loadSessionFromFile(): IMsSession | null {
    if (!fs.existsSync(this.sessionCachePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.sessionCachePath, 'utf8'));
    } catch {
      return null;
    }
  }

  private saveSessionToFile(session: IMsSession): void {
    try {
      fs.mkdirSync(path.dirname(this.sessionCachePath), { recursive: true });
      fs.writeFileSync(this.sessionCachePath, JSON.stringify(session, null, 2), 'utf8');
    } catch {}
  }

  /**
   * Lấy credentials M-System từ MongoDB hoặc biến môi trường
   */
  public async getCredentials(): Promise<IMsCredentials> {
    let baseUrl = process.env.MS_BASE_URL || this.defaultBaseUrl;
    let adminUrl = process.env.MS_ADMIN_URL || this.defaultAdminUrl;
    let username = process.env.MS_USERNAME || 'mxvhieptruong';
    let password = process.env.MS_PASSWORD || 'Taovipko0!';
    let pin = process.env.MS_PIN || '269696';

    if (this.settingsService) {
      const rawCred = await this.settingsService.getSetting('bot_credentials_msystem', '');
      if (rawCred) {
        try {
          const decrypted = JSON.parse(decrypt(rawCred));
          if (decrypted.url) {
            // Trường url có thể là admin url hoặc api url
            if (decrypted.url.includes('api')) {
              baseUrl = decrypted.url;
            } else {
              adminUrl = decrypted.url;
            }
          }
          if (decrypted.username) username = decrypted.username;
          if (decrypted.password) password = decrypted.password;
          if (decrypted.pin) pin = decrypted.pin;
        } catch (err: any) {
          this.logger.warn(`[MsApiAdapter] Không thể giải mã bot_credentials_msystem: ${err.message}`);
        }
      }
    }

    return { baseUrl, adminUrl, username, password, pin };
  }

  /**
   * Lấy Bearer Token hợp lệ (Tự động tái sử dụng session cache nếu còn hạn >= 5 phút)
   */
  public async getValidToken(): Promise<{ token: string; baseUrl: string; adminUrl: string }> {
    const creds = await this.getCredentials();
    const baseUrl = creds.baseUrl || this.defaultBaseUrl;
    const adminUrl = creds.adminUrl || this.defaultAdminUrl;

    // 1. Kiểm tra RAM cache
    if (this.currentSession && this.isSessionValid(this.currentSession)) {
      return { token: this.currentSession.token, baseUrl, adminUrl };
    }

    // 2. Kiểm tra File cache
    const fileSession = this.loadSessionFromFile();
    if (fileSession && this.isSessionValid(fileSession)) {
      this.currentSession = fileSession;
      return { token: fileSession.token, baseUrl, adminUrl };
    }

    // 3. Tiến hành đăng nhập 2 bước Password + PIN
    this.logger.log(`[MsApiAdapter] Bắt đầu đăng nhập 2 bước vào M-System Newgen API cho user: ${creds.username}...`);
    const commonHeaders: Record<string, string> = {
      accept: 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      origin: adminUrl,
      referer: `${adminUrl}/`,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // BƯỚC 1: Đăng nhập mật khẩu
    const loginRes = await fetch(`${baseUrl}/am/admin/users/login`, {
      method: 'POST',
      headers: { ...commonHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password }),
    });

    const loginData = (await loginRes.json().catch(() => null)) as any;
    if (!loginRes.ok || loginData?.status !== 'ok' || !loginData?.data?.user) {
      throw new Error(
        `Đăng nhập M-System Bước 1 thất bại: ${loginData?.errMsg || loginData?.message || loginRes.status}`,
      );
    }

    const userStep1 = loginData.data.user;
    const userId = userStep1.id || userStep1._id;
    const tempToken = userStep1.accessToken;

    if (!userId || !tempToken) {
      throw new Error('Không nhận được userId hoặc accessToken tạm từ M-System Bước 1');
    }

    // BƯỚC 2: Xác thực mã PIN
    const pinRes = await fetch(`${baseUrl}/am/admin/users/verifyPin/${userId}`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'content-type': 'application/json',
        authorization: `Bearer ${tempToken}`,
      },
      body: JSON.stringify({ pin: String(creds.pin) }),
    });

    const pinData = (await pinRes.json().catch(() => null)) as any;
    if (!pinRes.ok || pinData?.status !== 'ok' || !pinData?.data?.user) {
      throw new Error(
        `Xác thực M-System PIN Bước 2 thất bại: ${pinData?.errMsg || pinData?.message || pinRes.status}`,
      );
    }

    const finalUser = pinData.data.user;
    const finalToken = finalUser.accessToken;
    if (!finalToken) {
      throw new Error('Không nhận được Bearer Token chính thức sau Bước 2 verify PIN');
    }

    const jwtInfo = this.decodeJwt(finalToken);
    const newSession: IMsSession = {
      token: finalToken,
      tokenType: 'Bearer',
      userId: finalUser.id || userId,
      username: finalUser.username || creds.username || '',
      fullName: finalUser.fullName || creds.username || '',
      email: finalUser.email || '',
      expiresAt: jwtInfo?.expiresAt || '',
      expiresEpoch: jwtInfo?.expEpoch || 0,
      updatedAt: new Date().toISOString(),
    };

    this.currentSession = newSession;
    this.saveSessionToFile(newSession);
    this.logger.log(`[MsApiAdapter] Đăng nhập 2 bước M-System thành công! Token có hiệu lực đến: ${jwtInfo?.expiresAt}`);

    return { token: finalToken, baseUrl, adminUrl };
  }

  /**
   * Tải 1 file báo cáo từ Newgen API
   */
  private async downloadSingleReport(
    token: string,
    baseUrl: string,
    adminUrl: string,
    reportDef: IMsReportDef,
    targetDir: string,
  ): Promise<IngressFileDetail> {
    const startTime = Date.now();
    let fullUrl = `${baseUrl}${reportDef.endpoint}`;

    if (reportDef.queryParams) {
      const qStr = Object.entries(reportDef.queryParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      fullUrl += fullUrl.includes('?') ? `&${qStr}` : `?${qStr}`;
    }

    const res = await fetch(fullUrl, {
      method: reportDef.method,
      headers: {
        accept: 'application/json, text/plain, */*',
        authorization: `Bearer ${token}`,
        origin: adminUrl,
        referer: `${adminUrl}/`,
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Tải báo cáo [${reportDef.name}] thất bại (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const targetPath = path.join(targetDir, reportDef.fileName);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, buffer);

    const durationMs = Date.now() - startTime;
    this.logger.log(`[MsApiAdapter] Đã tải [${reportDef.name}]: ${reportDef.fileName} (${buffer.length} bytes, ${durationMs}ms)`);

    return {
      fileName: reportDef.fileName,
      absolutePath: targetPath,
      fileSize: buffer.length,
      mtime: new Date(),
      category: reportDef.key,
      metadata: {
        durationMs,
        transport: 'REST_API_STREAM',
      },
    };
  }

  /**
   * Cổng Ingress Port thực thi tải dữ liệu từ M-System qua Direct REST API
   */
  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const outputDirectory =
      options?.targetDirectory || path.join(process.cwd(), 'data', 'ingress', 'ms');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const { token, baseUrl, adminUrl } = await this.getValidToken();

    // Xác định danh sách báo cáo cần tải:
    // Hỗ trợ FULL / ALL / BACKUP để tải trọn gói toàn bộ 18 báo cáo M-System
    const isFullRequested =
      options?.isFullBackup ||
      options?.reportCodes?.some((c) => ['FULL', 'ALL', 'BACKUP', 'MS_FULL'].includes(c.toUpperCase()));

    let targetKeys: string[] = [];
    if (isFullRequested) {
      targetKeys = Object.keys(MS_REPORTS_REGISTRY);
      this.logger.log(`[MsApiAdapter] Kích hoạt chế độ FULL BACKUP cho M-System: tải toàn bộ ${targetKeys.length} báo cáo.`);
    } else if (options?.reportCodes && options.reportCodes.length > 0) {
      // Chuẩn hóa và bung các alias báo cáo
      for (const rawKey of options.reportCodes) {
        const k = rawKey.trim();
        const upper = k.toUpperCase();
        if (upper === 'DSTKGD') {
          targetKeys.push('DSTKGD-Futures', 'DSTKGD-Spread', 'DSTKGD-LME', 'DSTKGD-ACM');
        } else if (upper === 'TLKQHSKQ') {
          targetKeys.push('TLQHSKQ');
        } else if (upper === 'QLTTTKGD') {
          targetKeys.push('QLTKGD');
        } else if (upper === 'QLTKGDAMKQ' || upper === 'QLTTTKGDAMKQ' || upper === 'QLTKGD_AM_KQ') {
          targetKeys.push('QLTKGD âm KQ');
        } else if (upper === 'NKTHT') {
          targetKeys.push('NKTTHT');
        } else {
          targetKeys.push(k);
        }
      }
    } else {
      // Mặc định đối chiếu trong phiên: 3 báo cáo cốt lõi
      targetKeys = ['TTM', 'TTTT', 'DSGD'];
    }

    // Loại bỏ trùng lặp
    targetKeys = Array.from(new Set(targetKeys));

    const files: IngressFileDetail[] = [];
    const errors: string[] = [];

    for (const key of targetKeys) {
      // Chuẩn hóa key
      let reportDef = MS_REPORTS_REGISTRY[key];
      if (!reportDef) {
        // Tìm gần đúng theo key hoặc fileName
        const found = Object.values(MS_REPORTS_REGISTRY).find(
          (r) =>
            r.key.toLowerCase() === key.toLowerCase() ||
            r.fileName.toLowerCase() === key.toLowerCase() ||
            r.name.toLowerCase() === key.toLowerCase(),
        );
        if (found) reportDef = found;
      }

      if (!reportDef) {
        this.logger.warn(`[MsApiAdapter] Không tìm thấy định nghĩa cho mã báo cáo: ${key}`);
        continue;
      }

      try {
        const fileDetail = await this.downloadSingleReport(token, baseUrl, adminUrl, reportDef, outputDirectory);
        files.push(fileDetail);
      } catch (err: any) {
        this.logger.error(`[MsApiAdapter] Lỗi tải file ${reportDef.fileName}: ${err.message}`);
        errors.push(`${reportDef.fileName}: ${err.message}`);
      }
    }

    const totalDurationMs = Date.now() - startTime;
    return {
      source: 'MS',
      success: files.length > 0 && errors.length === 0,
      outputDirectory,
      files,
      downloadedAt: new Date(),
      durationMs: totalDurationMs,
      summary: `Tải thành công ${files.length}/${targetKeys.length} báo cáo M-System qua Direct REST API`,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }
}
