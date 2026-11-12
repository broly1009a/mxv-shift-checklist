/**
 * job-domains.constant.ts
 *
 * PHÂN HỆ TÀI NGUYÊN TÁC VỤ BOT (JOB RESOURCE DOMAIN DEFINITIONS)
 * Kiến trúc Clean Architecture - Modular Monolith V2.
 * Nguồn chân lý duy nhất (Single Source of Truth) để phân tách các miền tài nguyên độc lập.
 *
 * Quy tắc Vàng:
 * 1. CÙNG PHÂN HỆ: Phải chạy tuần tự (Sequential) để bảo vệ tài khoản, session và tránh xung đột khóa file.
 * 2. KHÁC PHÂN HỆ: Cho phép chạy song song (Parallel) 100% để tối ưu hóa thời gian ca trực.
 */

export enum JobResourceDomain {
  MS = 'MS',         // Phân hệ M-System (RPA Download, File Audit MS, Check EOD MS)
  CQG = 'CQG',       // Phân hệ CQG Cloud (Tải song song 2 TK CQG, Ghép file thô)
  CAST = 'CAST',     // Phân hệ CQG CAST (Web Portal ASP: Tải báo cáo số dư AS / Accounts_Balances)
  CCP = 'CCP',       // Phân hệ CoreCCP VNCLEAR (Tải 25 file CCP, Check EOD CCP)
  CE = 'CE',         // Phân hệ CE Clearing (Tải báo cáo CE, Thống kê Lot/Giá trị CE)
  ACM = 'ACM',       // Phân hệ ACM Straits SFTP (Kéo file Straits CSV tự doanh)
  EMAIL = 'EMAIL',   // Phân hệ Email Gateway (Bóc tách email, xác thực email)
  RECON = 'RECON',   // Phân hệ Đối Soát / Tính Toán In-Memory (KLGD, DSGD Before EOD, Margin, Macro)
  DEFAULT = 'DEFAULT'// Nhóm mặc định độc lập
}

/**
 * Ánh xạ chuẩn từ jobType hoặc botCheckType sang JobResourceDomain (O(1) Data-driven Mapping).
 */
const JOB_TYPE_TO_DOMAIN_MAP: Record<string, JobResourceDomain> = {
  // 1. Phân hệ M-System (Bao gồm cả jobType thực thi lẫn botCheckType trên Template CSDL)
  DOWNLOAD_MS: JobResourceDomain.MS,
  RPA_DOWNLOAD_REPORTS: JobResourceDomain.MS,
  RPA_DOWNLOAD: JobResourceDomain.MS,
  FILE_AUDIT_MS: JobResourceDomain.MS,
  CHECK_EOD_MS: JobResourceDomain.MS,
  CHECK_EOD: JobResourceDomain.MS,

  // 2. Phân hệ CQG Cloud (2 Tài khoản khớp lệnh)
  DOWNLOAD_CQG: JobResourceDomain.CQG,
  DOWNLOAD_CQG_BACKUP: JobResourceDomain.CQG,
  FILE_AUDIT_CQG: JobResourceDomain.CQG,

  // 3. Phân hệ CQG CAST (Web Portal ASP Báo cáo số dư)
  DOWNLOAD_CAST: JobResourceDomain.CAST,
  RPA_DOWNLOAD_CAST: JobResourceDomain.CAST,
  CHECK_CQG_SYNC: JobResourceDomain.CAST,
  CQG_SYNC: JobResourceDomain.CAST,

  // 4. Phân hệ CoreCCP (VNCLEAR)
  DOWNLOAD_CCP: JobResourceDomain.CCP,
  DOWNLOAD_CCP_REPORT: JobResourceDomain.CCP,
  RPA_DOWNLOAD_CCP_PHASE1: JobResourceDomain.CCP,
  FILE_AUDIT_CCP: JobResourceDomain.CCP,
  CHECK_EOD_CCP: JobResourceDomain.CCP,
  CCP_LOT_STATS: JobResourceDomain.CCP,
  CCP_VALUE_STATS: JobResourceDomain.CCP,
  CCP_EOD_RECON: JobResourceDomain.CCP,
  CHECK_CCP_STATISTICS: JobResourceDomain.CCP,
  CHECK_CCP_VALUE: JobResourceDomain.CCP,

  // 5. Phân hệ CoreEX
  DOWNLOAD_CE: JobResourceDomain.CE,
  DOWNLOAD_CE_REPORT: JobResourceDomain.CE,
  RPA_DOWNLOAD_CE: JobResourceDomain.CE,
  CE_LOT_STATS: JobResourceDomain.CE,
  CE_VALUE_STATS: JobResourceDomain.CE,
  RUN_MACRO_CE: JobResourceDomain.CE,

  // 6. Phân hệ ACM (Straits Financial)
  DOWNLOAD_ACM: JobResourceDomain.ACM,
  FILE_AUDIT_ACM: JobResourceDomain.ACM,

  // 7. Phân hệ Email
  VERIFY_EMAIL: JobResourceDomain.EMAIL,
  VERIFY_EMAIL_STATUS: JobResourceDomain.EMAIL,
  EMAIL_PARSER: JobResourceDomain.EMAIL,
  EMAIL_PARSE: JobResourceDomain.EMAIL,
  EMAIL_STATUS_CHECK: JobResourceDomain.EMAIL,

  // 8. Phân hệ Đối Soát In-Memory (Chạy tính toán dữ liệu)
  CHECK_KLGD: JobResourceDomain.RECON,
  CHECK_DSGD_BEFORE_EOD: JobResourceDomain.RECON,
  SCAN_NEGATIVE_MARGIN: JobResourceDomain.RECON,
  RUN_MACRO: JobResourceDomain.RECON,
  RUN_LOT_MACRO: JobResourceDomain.RECON,
  RUN_VALUE_MACRO: JobResourceDomain.RECON,
  RUN_LOT_TVKD_MACRO: JobResourceDomain.RECON,
  RUN_VALUE_TVKD_MACRO: JobResourceDomain.RECON,
  CREATE_GTT_FILE: JobResourceDomain.RECON,
  CHECK_GTT: JobResourceDomain.RECON,
  CHECK_GTT_CE_CCP: JobResourceDomain.RECON,
  CHECK_GTT_LEGACY: JobResourceDomain.RECON,
  CHECK_MARGIN_DECISION: JobResourceDomain.RECON,
  GENERATE_IMPORT_GTT_FILE: JobResourceDomain.RECON,
};

/**
 * Nhận diện Phân hệ Tài nguyên của một tác vụ dựa trên jobType hoặc capability key.
 * Tra cứu O(1) Data-driven 100% từ bảng map chuẩn.
 * TUYỆT ĐỐI KHÔNG dùng fallback suy đoán chuỗi string (Zero Speculative Guessing).
 */
export function resolveJobResourceDomain(jobType: string): JobResourceDomain {
  if (!jobType) return JobResourceDomain.DEFAULT;
  const upper = jobType.toUpperCase().trim();
  return JOB_TYPE_TO_DOMAIN_MAP[upper] ?? JobResourceDomain.DEFAULT;
}

/**
 * Danh sách Phân Hệ Tài Nguyên Bắt Buộc (Required Domains) mà một tác vụ cần chiếm giữ.
 * - Đa số tác vụ chỉ cần 1 phân hệ duy nhất (MS, CQG, CCP, CE...).
 * - Riêng CHECK_KLGD tự động cào file tươi từ cả M-System và CQG Cloud nên giữ [MS, CQG, RECON].
 * - Riêng CHECK_CQG_SYNC tải tươi file từ CAST và M-System nên giữ [CAST, MS].
 */
export function getRequiredJobDomains(jobType: string): JobResourceDomain[] {
  if (!jobType) return [JobResourceDomain.DEFAULT];
  const upper = jobType.toUpperCase().trim();

  // Tác vụ Đối Chiếu Khớp Lệnh Trong Phiên: Cần tải file tươi từ MS và CQG Cloud
  if (upper === 'CHECK_KLGD') {
    return [JobResourceDomain.MS, JobResourceDomain.CQG, JobResourceDomain.RECON];
  }

  // Tác vụ Đối Chiếu Số Dư: Cần tải file tươi từ CAST và MS
  if (upper === 'CHECK_CQG_SYNC' || upper === 'CQG_SYNC') {
    return [JobResourceDomain.CAST, JobResourceDomain.MS];
  }

  return [resolveJobResourceDomain(upper)];
}

/**
 * Danh mục Ánh xạ Song song Giữa Tên Chuẩn Hóa Duy Nhất (DOWNLOAD_*) và các Tên Cũ (Legacy).
 * Phục vụ tương thích ngược 100% cho CSDL MongoDB, Frontend polling và Autonomous Scheduler.
 */
export const JOB_TYPE_ALIASES: Record<string, string[]> = {
  DOWNLOAD_MS: ['DOWNLOAD_MS', 'RPA_DOWNLOAD_REPORTS', 'RPA_DOWNLOAD'],
  RPA_DOWNLOAD_REPORTS: ['DOWNLOAD_MS', 'RPA_DOWNLOAD_REPORTS', 'RPA_DOWNLOAD'],
  RPA_DOWNLOAD: ['DOWNLOAD_MS', 'RPA_DOWNLOAD_REPORTS', 'RPA_DOWNLOAD'],

  DOWNLOAD_CQG: ['DOWNLOAD_CQG', 'DOWNLOAD_CQG_BACKUP'],
  DOWNLOAD_CQG_BACKUP: ['DOWNLOAD_CQG', 'DOWNLOAD_CQG_BACKUP'],

  DOWNLOAD_CAST: ['DOWNLOAD_CAST', 'RPA_DOWNLOAD_CAST'],
  RPA_DOWNLOAD_CAST: ['DOWNLOAD_CAST', 'RPA_DOWNLOAD_CAST'],

  DOWNLOAD_CCP: ['DOWNLOAD_CCP', 'DOWNLOAD_CCP_REPORT', 'RPA_DOWNLOAD_CCP_PHASE1'],
  DOWNLOAD_CCP_REPORT: ['DOWNLOAD_CCP', 'DOWNLOAD_CCP_REPORT', 'RPA_DOWNLOAD_CCP_PHASE1'],
  RPA_DOWNLOAD_CCP_PHASE1: ['DOWNLOAD_CCP', 'DOWNLOAD_CCP_REPORT', 'RPA_DOWNLOAD_CCP_PHASE1'],

  DOWNLOAD_CE: ['DOWNLOAD_CE', 'DOWNLOAD_CE_REPORT', 'RPA_DOWNLOAD_CE'],
  DOWNLOAD_CE_REPORT: ['DOWNLOAD_CE', 'DOWNLOAD_CE_REPORT', 'RPA_DOWNLOAD_CE'],
  RPA_DOWNLOAD_CE: ['DOWNLOAD_CE', 'DOWNLOAD_CE_REPORT', 'RPA_DOWNLOAD_CE'],

  DOWNLOAD_ACM: ['DOWNLOAD_ACM', 'TRIGGER_ACM_DOWNLOAD', 'FILE_AUDIT_ACM'],
  TRIGGER_ACM_DOWNLOAD: ['DOWNLOAD_ACM', 'TRIGGER_ACM_DOWNLOAD', 'FILE_AUDIT_ACM'],
  FILE_AUDIT_ACM: ['DOWNLOAD_ACM', 'TRIGGER_ACM_DOWNLOAD', 'FILE_AUDIT_ACM'],

  CHECK_CQG_SYNC: ['CHECK_CQG_SYNC', 'CQG_SYNC'],
  CQG_SYNC: ['CHECK_CQG_SYNC', 'CQG_SYNC'],

  VERIFY_EMAIL_STATUS: ['VERIFY_EMAIL_STATUS', 'EMAIL_STATUS_CHECK', 'VERIFY_EMAIL'],
  EMAIL_STATUS_CHECK: ['VERIFY_EMAIL_STATUS', 'EMAIL_STATUS_CHECK', 'VERIFY_EMAIL'],
  VERIFY_EMAIL: ['VERIFY_EMAIL_STATUS', 'EMAIL_STATUS_CHECK', 'VERIFY_EMAIL'],
};

/**
 * Mở rộng danh sách jobType để tìm kiếm tất cả các alias tương đương.
 */
export function expandJobTypeAliases(types: string[]): string[] {
  const result = new Set<string>();
  for (const t of types) {
    if (!t) continue;
    const clean = t.trim();
    result.add(clean);
    const aliases = JOB_TYPE_ALIASES[clean] || JOB_TYPE_ALIASES[clean.toUpperCase()];
    if (aliases) {
      for (const a of aliases) result.add(a);
    }
  }
  return Array.from(result);
}

/**
 * Danh mục các Năng lực Tác vụ Đối chiếu (Reconciliation Capabilities) thuộc quyền kiểm soát
 * của Master Switch `bot_auto_recon_enabled`.
 * Các tác vụ tải backup, audit file backup & chạy thống kê thuộc quyền kiểm soát của `bot_auto_backup_enabled`.
 */
const BASE_RECON_MASTER_SWITCH_JOB_TYPES = [
  'CHECK_KLGD',
  'CHECK_DSGD_BEFORE_EOD',
  'CHECK_CQG_SYNC',
  'CQG_SYNC',
  'CHECK_EOD_MS',
  'EOD_MS',
  'CHECK_EOD',
  'CHECK_EOD_CCP',
  'CCP_EOD_RECON',
  'SCAN_NEGATIVE_MARGIN',
  'CHECK_NEGATIVE_MARGIN',
  'CHECK_MARGIN_DECISION',
  'CHECK_GTT',
  'CHECK_GTT_CE_CCP',
  'CHECK_GTT_LEGACY',
  'VERIFY_EMAIL_STATUS',
  'EMAIL_STATUS_CHECK',
] as const;

const RECON_MASTER_SWITCH_JOB_SET = new Set(
  expandJobTypeAliases([...BASE_RECON_MASTER_SWITCH_JOB_TYPES]).map((t) =>
    t.toUpperCase(),
  ),
);

/**
 * Kiểm tra một jobType có thuộc nhóm Tác vụ Đối chiếu (được kiểm soát bởi `bot_auto_recon_enabled`) hay không.
 * Ngược lại, các tác vụ Tải backup / File Audit / Thống kê Macro được kiểm soát bởi `bot_auto_backup_enabled`.
 */
export function isReconMasterSwitchJob(jobType: string): boolean {
  if (!jobType) return false;
  return RECON_MASTER_SWITCH_JOB_SET.has(jobType.trim().toUpperCase());
}
