import { Logger } from '@nestjs/common';

export interface CqgLockAcquisition {
  allowed: boolean;
  reason?: string;
  release: () => void;
}

/**
 * CQG Circuit Breaker & Safety Gate
 * Bảo vệ tài khoản giao dịch CQG tuyệt đối khỏi nguy cơ bị khóa do đăng nhập dồn dập:
 * 1. Concurrency Mutex: Ngăn 2 tiến trình cùng mở và đăng nhập vào một tài khoản CQG cùng thời điểm.
 * 2. Mandatory Cooldown: Giãn cách tối thiểu 120 giây (2 phút) giữa 2 lần đăng nhập của cùng một tài khoản.
 * 3. Sliding-Window Rate Limit: Giới hạn tối đa 8 lần đăng nhập trong vòng 1 giờ cho mỗi tài khoản.
 */
export class CqgSafetyGate {
  private static readonly logger = new Logger('CqgSafetyGate');

  // Cấu hình an toàn
  public static readonly MIN_COOLDOWN_MS = 120_000; // 2 phút cooldown giữa 2 lần đăng nhập
  public static readonly MAX_LOGINS_PER_HOUR = 8; // Tối đa 8 lần / giờ / tài khoản
  public static readonly WINDOW_MS = 3_600_000; // Cửa sổ trượt 1 giờ

  // Trạng thái khóa đồng thời (theo username)
  private static readonly activeAccounts = new Set<string>();

  // Lịch sử đăng nhập theo username: username -> [timestamps]
  private static readonly loginHistory = new Map<string, number[]>();

  // Thời điểm đăng nhập gần nhất theo username: username -> timestamp
  private static readonly lastLoginMap = new Map<string, number>();

  /**
   * Chuẩn hóa tên tài khoản để định danh khóa
   */
  private static normalizeAccount(account: string): string {
    return (account || 'default').trim().toLowerCase();
  }

  /**
   * Kiểm tra xem tài khoản có được phép đăng nhập tại thời điểm hiện tại hay không
   */
  public static canLogin(
    account: string,
    options?: { force?: boolean },
  ): { allowed: boolean; reason?: string } {
    const key = this.normalizeAccount(account);
    const now = Date.now();

    // 1. Kiểm tra Concurrency Mutex
    if (this.activeAccounts.has(key)) {
      const reason = `[CQG_CIRCUIT_BREAKER] Tài khoản CQG (${account}) đang có một phiên trình duyệt đăng nhập hoạt động. Từ chối đăng nhập đồng thời để chống xung đột kick phiên.`;
      this.logger.warn(reason);
      return { allowed: false, reason };
    }

    // 2. Kiểm tra Cooldown tối thiểu
    const lastLogin = this.lastLoginMap.get(key) || 0;
    const timeSinceLast = now - lastLogin;
    if (!options?.force && timeSinceLast < this.MIN_COOLDOWN_MS) {
      const remainingSec = Math.ceil((this.MIN_COOLDOWN_MS - timeSinceLast) / 1000);
      const reason = `[CQG_CIRCUIT_BREAKER] Giãn cách bảo vệ tài khoản CQG (${account}) đang kích hoạt. Lần đăng nhập gần nhất cách đây ${Math.floor(timeSinceLast / 1000)}s. Bắt buộc chờ thêm ${remainingSec}s để tránh sàn gắn cờ spam.`;
      this.logger.warn(reason);
      return { allowed: false, reason };
    }

    // 3. Kiểm tra Sliding-Window Rate Limit trong 1 giờ qua
    const history = (this.loginHistory.get(key) || []).filter(
      (ts) => now - ts < this.WINDOW_MS,
    );
    this.loginHistory.set(key, history);

    if (!options?.force && history.length >= this.MAX_LOGINS_PER_HOUR) {
      const reason = `[CQG_CIRCUIT_BREAKER] Tài khoản CQG (${account}) đã đạt ngưỡng an toàn tối đa (${history.length}/${this.MAX_LOGINS_PER_HOUR} lần đăng nhập trong 60 phút qua). Tạm dừng đăng nhập tự động để bảo vệ tài khoản không bị khóa.`;
      this.logger.error(reason);
      return { allowed: false, reason };
    }

    return { allowed: true };
  }

  /**
   * Xin quyền khóa an toàn trước khi mở trình duyệt và submit form CQG.
   * Nếu không đủ điều kiện an toàn, phương thức ném ra ngoại lệ [CQG_CIRCUIT_BREAKER].
   * Trả về callback `release()` để giải phóng khóa trong khối `finally`.
   */
  public static acquire(
    account: string,
    source: string = 'Unknown',
    options?: { force?: boolean },
  ): () => void {
    const key = this.normalizeAccount(account);
    const check = this.canLogin(account, options);

    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const now = Date.now();
    this.activeAccounts.add(key);
    this.lastLoginMap.set(key, now);

    const history = this.loginHistory.get(key) || [];
    history.push(now);
    this.loginHistory.set(key, history);

    this.logger.log(
      `[CQG_CIRCUIT_BREAKER] Đã cấp quyền đăng nhập CQG cho [${account}] từ nguồn [${source}]. (Số lần trong 1h: ${history.length}/${this.MAX_LOGINS_PER_HOUR})`,
    );

    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.activeAccounts.delete(key);
        this.logger.log(`[CQG_CIRCUIT_BREAKER] Đã giải phóng phiên đăng nhập CQG cho [${account}].`);
      }
    };
  }

  /**
   * Lấy thông tin trạng thái hoạt động của Circuit Breaker phục vụ giám sát và chẩn đoán
   */
  public static getStatus() {
    const now = Date.now();
    const accounts: Record<string, any> = {};

    const allKeys = new Set([
      ...this.activeAccounts,
      ...this.lastLoginMap.keys(),
      ...this.loginHistory.keys(),
    ]);

    for (const key of allKeys) {
      const lastLogin = this.lastLoginMap.get(key) || 0;
      const timeSinceLast = now - lastLogin;
      const remainingCooldownSec = Math.max(
        0,
        Math.ceil((this.MIN_COOLDOWN_MS - timeSinceLast) / 1000),
      );
      const history = (this.loginHistory.get(key) || []).filter(
        (ts) => now - ts < this.WINDOW_MS,
      );

      accounts[key] = {
        isActive: this.activeAccounts.has(key),
        lastLogin: lastLogin ? new Date(lastLogin).toISOString() : null,
        remainingCooldownSec,
        loginsInPastHour: history.length,
        maxLoginsPerHour: this.MAX_LOGINS_PER_HOUR,
      };
    }

    return {
      cooldownMs: this.MIN_COOLDOWN_MS,
      maxLoginsPerHour: this.MAX_LOGINS_PER_HOUR,
      accounts,
    };
  }
}
