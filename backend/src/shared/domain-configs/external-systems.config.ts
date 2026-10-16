/**
 * ============================================================================
 * CẤU HÌNH DOMAIN & URL CÁC HỆ THỐNG NGOẠI BỘ (EXTERNAL SYSTEMS CONFIG)
 * ============================================================================
 * 
 * Lưu ý quan trọng:
 * - Tài khoản & Mật khẩu được lưu trữ BẢO MẬT TRONG CSDL (MongoDB),
 *   mã hóa AES-256 qua giao diện Quản trị Bot (https://10.0.0.26/admin/bot-config).
 * - File này CHỈ chứa: Domain/URL mặc định, Port SFTP và quy tắc kết nối.
 *   Khi cần đổi domain mặc định của bất kỳ hệ thống nào, bạn chỉ cần sửa tại đây.
 */

export const EXTERNAL_SYSTEMS_CONFIG = {
  // 1. M-System (Vendor Newgen)
  msystem: {
    adminUrl: process.env.MS_ADMIN_URL || 'https://msadmin.mxv.com.vn',
    apiUrl: process.env.MS_BASE_URL || 'https://msapi.mxv.com.vn',
    resolveApiUrl(adminUrl: string): string {
      if (!adminUrl) return this.apiUrl;
      const clean = adminUrl.split('#')[0].replace(/\/+$/, '');
      if (clean.includes('msadmin.')) return clean.replace('msadmin.', 'msapi.');
      if (clean.includes('admin-dev.')) return 'https://api-dev.newgen.dev';
      return clean;
    },
  },

  // 2. ACM Web ETP & Straits Financial SFTP
  acm: {
    baseUrl: process.env.ACM_BASE_URL || 'https://acm-etp.acmmex.com',
    sftpHost: process.env.ACM_SFTP_HOST || 'sftp.mxv.com.vn',
    sftpPort: Number(process.env.ACM_SFTP_PORT || 2231),
    sftpRemoteDir: process.env.ACM_SFTP_REMOTE_DIR || '/data/',
  },

  // 3. CoreCCP (Clearing & Settlement)
  coreccp: {
    baseUrl: process.env.CORECCP_BASE_URL || 'https://coreccp.mxv.com.vn',
    connectKey: 'fsscssiam2021',
  },

  // 4. Core Exchange (CoreEX)
  coreex: {
    baseUrl: process.env.COREEXCHANGE_BASE_URL || 'https://coreexchange.mxv.com.vn',
    clientId: process.env.COREEXCHANGE_CLIENT_ID || 'web-exchange-mxv',
  },

  // 5. CQG Web Desktop
  cqg: {
    tradeUrl: process.env.CQG_URL_TRADE || 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
    priceUrl: process.env.CQG_URL_PRICE || 'https://mdemo.cqg.com/cqg/desktop/logon?ref=forced',
  },

  // 6. AI Captcha Solver (Google Gemini)
  aiCaptcha: {
    timeoutMs: 8000,
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
    ],
  },
};

// Aliases cho từng phân hệ để các Adapter tiện import trực tiếp
export const EXTERNAL_SYSTEM_MSYSTEM = EXTERNAL_SYSTEMS_CONFIG.msystem;
export const EXTERNAL_SYSTEM_ACM = EXTERNAL_SYSTEMS_CONFIG.acm;
export const EXTERNAL_SYSTEM_CORECCP = EXTERNAL_SYSTEMS_CONFIG.coreccp;
export const EXTERNAL_SYSTEM_COREEX = EXTERNAL_SYSTEMS_CONFIG.coreex;
export const EXTERNAL_SYSTEM_CQG = EXTERNAL_SYSTEMS_CONFIG.cqg;
export const EXTERNAL_SYSTEM_AI_CAPTCHA = EXTERNAL_SYSTEMS_CONFIG.aiCaptcha;


