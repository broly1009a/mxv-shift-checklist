import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  IIngressPort,
  IngressSourceType,
  IngressDownloadOptions,
  IngressDownloadResult,
  IngressFileDetail,
} from '../../../shared';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { decrypt } from '../../bot-engine/utils/crypto';

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
 * DANH MỤC CÁC ENDPOINT TẢI BÁO CÁO M-SYSTEM CHUẨN XÁC 100% (GROUND TRUTH AUDITED TỪ NETWORK THỰC TẾ)
 */
export const MS_REPORTS_REGISTRY: Record<string, IMsReportDef> = {
  // ─── 1. NHẬT KÝ THAO TÁC HỆ THỐNG ─────────────────────────────────────────
  NKTTHT: {
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

  // ─── 2. DANH SÁCH TÀI KHOẢN GIAO DỊCH (FUTURES / SPREAD / LME / ACM) ───────
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

  // ─── 3. THIẾT LẬP KÝ QUỸ, NỘP RÚT TIỀN & TRADER ────────────────────────────
  TLQHSKQ: {
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
  NR: {
    key: 'NR',
    name: 'Danh sách nộp rút tiền',
    fileName: 'NR.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/marginTransactionHistory/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Lịch sử giao dịch tiền, nộp rút tiền ký quỹ tài khoản',
  },
  DSTrader: {
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

  // ─── 4. SỔ LỆNH & KHỚP LỆNH ────────────────────────────────────────────────
  DSLDK: {
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
  DSLCK: {
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
  DSLH: {
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
  DSLK: {
    key: 'DSLK',
    name: 'Danh sách lệnh khác',
    fileName: 'DSLK.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/order/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Danh sách lệnh giao dịch khác',
  },
  DSGD: {
    key: 'DSGD',
    name: 'Danh sách giao dịch',
    fileName: 'DSGD.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/transaction/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Khớp lệnh chi tiết toàn sàn trong phiên',
  },

  // ─── 5. TRẠNG THÁI VỊ THẾ & TẤT TOÁN ───────────────────────────────────────
  TTM: {
    key: 'TTM',
    name: 'Trạng thái mở',
    fileName: 'TTM.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/position/admin/open/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Trạng thái vị thế mở của toàn bộ tài khoản nhà đầu tư',
  },
  TTTT: {
    key: 'TTTT',
    name: 'Trạng thái tất toán',
    fileName: 'TTTT.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/position/admin/settle/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Trạng thái tất toán vị thế và lãi lỗ thực tế trong phiên',
  },
  TTCDH: {
    key: 'TTCDH',
    name: 'Trạng thái tất toán chờ đáo hạn LME',
    fileName: 'TTCDH.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/position/admin/settleLME/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Trạng thái tất toán chờ đáo hạn các hợp đồng LME',
  },

  // ─── 6. QUẢN LÝ KÝ QUỸ & TÀI KHOẢN ÂM ─────────────────────────────────────
  DSQLKQ: {
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
  QLTKGD: {
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

  private cachedToken: string | null = null;
  private tokenExpiresEpoch = 0;
  private readonly sessionFilePath = path.join(process.cwd(), 'temp', 'ms_session.json');

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  /**
   * Giải mã Payload JWT để trích xuất thời hạn hết hạn
   */
  private decodeJwt(token: string): { expEpoch: number; isExpired: boolean; remainingMinutes: number } | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;

    try {
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);
      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp || 0;
      const isExpired = exp < now;
      const remainingMinutes = Math.max(0, Math.floor((exp - now) / 60));

      return {
        expEpoch: exp,
        isExpired,
        remainingMinutes,
      };
    } catch {
      return null;
    }
  }

  /**
   * Đọc cấu hình thông tin đăng nhập M-System từ CSDL MongoDB hoặc .env
   */
  private async getCredentials(): Promise<{
    baseUrl: string;
    adminUrl: string;
    username: string;
    password: string;
    pin: string;
  }> {
    let username = process.env.MS_USERNAME || '';
    let password = process.env.MS_PASSWORD || '';
    let pin = process.env.MS_PIN || '269696';
    let baseUrl = process.env.MS_BASE_URL || 'https://api-dev.newgen.dev';
    let adminUrl = process.env.MS_ADMIN_URL || 'https://admin-dev.msystem.newgen.dev';

    if (this.settingsService) {
      try {
        const raw = await this.settingsService.getSetting('bot_credentials_msystem', '');
        if (raw) {
          const decrypted = decrypt(raw);
          const parsed = JSON.parse(decrypted);
          if (parsed.username) username = parsed.username;
          if (parsed.password) password = parsed.password;
          if (parsed.pin) pin = parsed.pin;
          if (parsed.baseUrl) baseUrl = parsed.baseUrl;
          if (parsed.adminUrl) adminUrl = parsed.adminUrl;
        }

        // Đọc thêm URL cấu hình riêng nếu có
        baseUrl = await this.settingsService.getSetting('ms_api_url', baseUrl);
        adminUrl = await this.settingsService.getSetting('ms_admin_url', adminUrl);
      } catch (err: any) {
        this.logger.warn(`Không thể giải mã cấu hình bot_credentials_msystem từ CSDL: ${err.message}`);
      }
    }

    if (!username || !password) {
      throw new Error(
        'Thiếu thông tin đăng nhập M-System (username, password). Vui lòng cấu hình bot_credentials_msystem trong CSDL hoặc biến môi trường.',
      );
    }

    return { baseUrl, adminUrl, username, password, pin };
  }

  /**
   * Lấy Bearer Token hợp lệ (tự động dùng cache RAM / file hoặc xác thực 2 bước qua API)
   */
  public async getValidSession(): Promise<{ token: string; baseUrl: string; adminUrl: string }> {
    const creds = await this.getCredentials();
    const nowEpoch = Math.floor(Date.now() / 1000);

    // 1. Kiểm tra cache trong RAM (yêu cầu còn hạn ít nhất 5 phút)
    if (this.cachedToken && this.tokenExpiresEpoch - nowEpoch >= 300) {
      return { token: this.cachedToken, baseUrl: creds.baseUrl, adminUrl: creds.adminUrl };
    }

    // 2. Kiểm tra cache trong file lưu trữ tạm
    try {
      if (fs.existsSync(this.sessionFilePath)) {
        const fileContent = fs.readFileSync(this.sessionFilePath, 'utf8');
        const session = JSON.parse(fileContent);
        if (session.token && session.expiresEpoch && session.expiresEpoch - nowEpoch >= 300) {
          this.cachedToken = session.token;
          this.tokenExpiresEpoch = session.expiresEpoch;
          this.logger.log('[MsApiAdapter] Tái sử dụng session M-System hợp lệ từ cache file');
          return { token: this.cachedToken, baseUrl: creds.baseUrl, adminUrl: creds.adminUrl };
        }
      }
    } catch {
      // Bỏ qua lỗi đọc file, tiếp tục đăng nhập mới
    }

    // 3. Thực hiện Đăng nhập 2 bước (Password + PIN)
    this.logger.log(`[MsApiAdapter] Bắt đầu xác thực 2 bước M-System Backend API: ${creds.baseUrl}`);
    const commonHeaders: Record<string, string> = {
      accept: 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      origin: creds.adminUrl,
      referer: `${creds.adminUrl}/`,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // ── Bước 1: Login Password ──
    const loginRes = await fetch(`${creds.baseUrl}/am/admin/users/login`, {
      method: 'POST',
      headers: { ...commonHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password }),
    });

    const loginData = (await loginRes.json().catch(() => null)) as any;
    if (!loginRes.ok || loginData?.status !== 'ok' || !loginData?.data?.user) {
      const errMsg = loginData?.errMsg || loginData?.message || `HTTP ${loginRes.status}`;
      throw new Error(`[MsApiAdapter] Đăng nhập M-System Bước 1 (Password) thất bại: ${errMsg}`);
    }

    const userStep1 = loginData.data.user;
    const userId = userStep1.id || userStep1._id;
    const tempToken = userStep1.accessToken;

    if (!userId || !tempToken) {
      throw new Error('[MsApiAdapter] Không nhận được userId hoặc accessToken tạm từ phản hồi Bước 1');
    }

    // ── Bước 2: Verify PIN ──
    const pinRes = await fetch(`${creds.baseUrl}/am/admin/users/verifyPin/${userId}`, {
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
      const errMsg = pinData?.errMsg || pinData?.message || `HTTP ${pinRes.status}`;
      throw new Error(`[MsApiAdapter] Đăng nhập M-System Bước 2 (PIN) thất bại: ${errMsg}`);
    }

    const finalToken = pinData.data.user.accessToken;
    if (!finalToken) {
      throw new Error('[MsApiAdapter] Không nhận được Bearer Token chính thức sau Bước 2 verify PIN');
    }

    const jwtInfo = this.decodeJwt(finalToken);
    this.cachedToken = finalToken;
    this.tokenExpiresEpoch = jwtInfo?.expEpoch || nowEpoch + 3600;

    // Lưu session ra file tạm
    try {
      fs.mkdirSync(path.dirname(this.sessionFilePath), { recursive: true });
      fs.writeFileSync(
        this.sessionFilePath,
        JSON.stringify(
          {
            token: finalToken,
            expiresEpoch: this.tokenExpiresEpoch,
            updatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    } catch (err: any) {
      this.logger.warn(`Không thể lưu cache session ra file: ${err.message}`);
    }

    this.logger.log(`[MsApiAdapter] Xác thực 2 bước M-System thành công. Token hiệu lực trong ${jwtInfo?.remainingMinutes ?? 60} phút`);
    return { token: finalToken, baseUrl: creds.baseUrl, adminUrl: creds.adminUrl };
  }

  /**
   * Tải các báo cáo M-System trực tiếp qua REST API (Chuẩn Hexagonal Port)
   */
  async download(
    source: IngressSourceType,
    options?: IngressDownloadOptions,
  ): Promise<IngressDownloadResult> {
    const startTime = Date.now();
    const outputDirectory =
      options?.targetDirectory || path.join(process.cwd(), 'data', 'backup', 'M-System');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const files: IngressFileDetail[] = [];
    const targets =
      options?.reportCodes && options.reportCodes.length > 0
        ? options.reportCodes
        : ['TTM', 'TTTT', 'DSGD'];

    this.logger.log(
      `[MsApiAdapter] Bắt đầu tải ${targets.length} báo cáo M-System qua Direct REST API: [${targets.join(', ')}]`,
    );

    try {
      const { token, baseUrl, adminUrl } = await this.getValidSession();

      for (const target of targets) {
        // Tìm định nghĩa báo cáo trong Registry (chuẩn hóa tên)
        const reportDef =
          MS_REPORTS_REGISTRY[target] ||
          Object.values(MS_REPORTS_REGISTRY).find(
            (r) => r.key.toLowerCase() === target.toLowerCase() || r.fileName.toLowerCase() === target.toLowerCase(),
          );

        if (!reportDef) {
          this.logger.warn(`[MsApiAdapter] Không tìm thấy định nghĩa endpoint cho báo cáo: "${target}". Bỏ qua.`);
          continue;
        }

        const repStartTime = Date.now();
        let fullUrl = `${baseUrl}${reportDef.endpoint}`;

        if (reportDef.queryParams && Object.keys(reportDef.queryParams).length > 0) {
          const qStr = Object.keys(reportDef.queryParams)
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(reportDef.queryParams![k])}`)
            .join('&');
          fullUrl += fullUrl.includes('?') ? `&${qStr}` : `?${qStr}`;
        }

        this.logger.log(`[MsApiAdapter] Đang tải "${reportDef.name}" (${reportDef.fileName}) từ: ${fullUrl}`);

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
          throw new Error(
            `Tải báo cáo [${reportDef.name}] thất bại (HTTP ${res.status}): ${errText.slice(0, 200)}`,
          );
        }

        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const repDurationMs = Date.now() - repStartTime;

        // Lưu file vào thư mục đích (Tên file chuẩn theo downstream expectation: TTM.xlsx, TTTT.xlsx, DSGD.xlsx...)
        const targetPath = path.join(outputDirectory, reportDef.fileName);
        fs.writeFileSync(targetPath, buffer);

        const fileSize = buffer.length;
        this.logger.log(
          `[MsApiAdapter]  Đã tải thành công "${reportDef.fileName}" (${fileSize} bytes, ${repDurationMs}ms)`,
        );

        files.push({
          fileName: reportDef.fileName,
          absolutePath: targetPath,
          fileSize,
          mtime: new Date(),
          category: reportDef.key,
          metadata: {
            transport: 'REST_API_STREAM',
            endpoint: reportDef.endpoint,
            durationMs: repDurationMs,
          },
        });
      }

      const totalDurationMs = Date.now() - startTime;
      return {
        success: files.length > 0,
        source: 'MS',
        outputDirectory,
        files,
        downloadedAt: new Date(),
        durationMs: totalDurationMs,
        summary: `Tải thành công ${files.length}/${targets.length} báo cáo M-System qua Direct REST API`,
      };
    } catch (err: any) {
      this.logger.error(`[MsApiAdapter] Lỗi Direct REST API M-System: ${err.message}`);
      return {
        success: false,
        source: 'MS',
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
      return !!session.token;
    } catch {
      return false;
    }
  }
}
