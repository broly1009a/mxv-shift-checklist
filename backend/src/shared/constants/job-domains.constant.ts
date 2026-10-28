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
  CCP = 'CCP',       // Phân hệ CoreCCP VNCLEAR (Tải 25 file CCP, Báo cáo phí CAST, Check EOD CCP)
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
  // 1. Phân hệ M-System
  RPA_DOWNLOAD_REPORTS: JobResourceDomain.MS,
  FILE_AUDIT_MS: JobResourceDomain.MS,
  CHECK_EOD_MS: JobResourceDomain.MS,
  CHECK_EOD: JobResourceDomain.MS,

  // 2. Phân hệ CQG
  DOWNLOAD_CQG: JobResourceDomain.CQG,
  DOWNLOAD_CQG_BACKUP: JobResourceDomain.CQG,
  FILE_AUDIT_CQG: JobResourceDomain.CQG,
  CHECK_CQG_SYNC: JobResourceDomain.CQG,

  // 3. Phân hệ CoreCCP
  DOWNLOAD_CCP_REPORT: JobResourceDomain.CCP,
  FILE_AUDIT_CCP: JobResourceDomain.CCP,
  DOWNLOAD_CAST: JobResourceDomain.CCP,
  CHECK_EOD_CCP: JobResourceDomain.CCP,
  CCP_LOT_STATS: JobResourceDomain.CCP,
  CCP_VALUE_STATS: JobResourceDomain.CCP,
  CCP_EOD_RECON: JobResourceDomain.CCP,
  CHECK_CCP_STATISTICS: JobResourceDomain.CCP,
  CHECK_CCP_VALUE: JobResourceDomain.CCP,

  // 4. Phân hệ CE
  DOWNLOAD_CE_REPORT: JobResourceDomain.CE,
  CE_LOT_STATS: JobResourceDomain.CE,
  CE_VALUE_STATS: JobResourceDomain.CE,

  // 5. Phân hệ ACM (Straits Financial)
  DOWNLOAD_ACM: JobResourceDomain.ACM,
  FILE_AUDIT_ACM: JobResourceDomain.ACM,

  // 6. Phân hệ Email
  VERIFY_EMAIL: JobResourceDomain.EMAIL,
  EMAIL_PARSER: JobResourceDomain.EMAIL,
  EMAIL_PARSE: JobResourceDomain.EMAIL,

  // 7. Phân hệ Đối Soát In-Memory (Chạy tính toán dữ liệu)
  CHECK_KLGD: JobResourceDomain.RECON,
  CHECK_DSGD_BEFORE_EOD: JobResourceDomain.RECON,
  SCAN_NEGATIVE_MARGIN: JobResourceDomain.RECON,
  AUTO_CHECK_SOD: JobResourceDomain.RECON,
  RUN_MACRO: JobResourceDomain.RECON,
  RUN_LOT_MACRO: JobResourceDomain.RECON,
  RUN_VALUE_MACRO: JobResourceDomain.RECON,
  RUN_LOT_TVKD_MACRO: JobResourceDomain.RECON,
  RUN_VALUE_TVKD_MACRO: JobResourceDomain.RECON,
  CREATE_GTT_FILE: JobResourceDomain.RECON,
  CHECK_GTT: JobResourceDomain.RECON,
  GENERATE_IMPORT_GTT_FILE: JobResourceDomain.RECON,
};

/**
 * Nhận diện Phân hệ Tài nguyên của một tác vụ dựa trên jobType hoặc capability key.
 */
export function resolveJobResourceDomain(jobType: string): JobResourceDomain {
  if (!jobType) return JobResourceDomain.DEFAULT;
  const upper = jobType.toUpperCase().trim();

  // Tra cứu bảng map O(1)
  if (JOB_TYPE_TO_DOMAIN_MAP[upper]) {
    return JOB_TYPE_TO_DOMAIN_MAP[upper];
  }

  // Fallback thông minh theo tiền tố / từ khóa
  if (upper.includes('CQG')) return JobResourceDomain.CQG;
  if (upper.includes('CE')) return JobResourceDomain.CE;
  if (upper.includes('CCP') || upper.includes('CAST')) return JobResourceDomain.CCP;
  if (upper.includes('ACM') || upper.includes('STRAITS')) return JobResourceDomain.ACM;
  if (upper.includes('EMAIL') || upper.includes('MAIL')) return JobResourceDomain.EMAIL;
  if (upper.includes('MS') || upper.includes('RPA')) return JobResourceDomain.MS;
  if (upper.includes('RECON') || upper.includes('MACRO') || upper.includes('EOD')) {
    return JobResourceDomain.RECON;
  }

  return JobResourceDomain.DEFAULT;
}
