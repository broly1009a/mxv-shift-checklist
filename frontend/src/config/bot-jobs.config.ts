/**
 * bot-jobs.config.ts
 *
 * NGUỒN CHÂN LÝ DUY NHẤT (SINGLE SOURCE OF TRUTH) CHO BOT JOBS Ở FRONTEND
 * Chuẩn hóa đối chiếu 100% với backend: bot-task-registry.ts và job-domains.constant.ts.
 * Tránh phân mảnh và trùng lặp code giữa các component.
 */

export const JOB_TYPE_LABELS: Record<string, string> = {
  // ── 1. ĐỐI SOÁT & TÍNH TOÁN DỮ LIỆU (RECONCILIATION) ───────────────────────
  CHECK_KLGD: 'Đối Chiếu Khớp Lệnh Trong Phiên',
  CHECK_DSGD_BEFORE_EOD: 'Đối Chiếu DSGD Trước EOD',
  CHECK_EOD_MS: 'Đối Chiếu EOD M-System',
  CHECK_EOD: 'Đối Chiếu EOD M-System',
  CHECK_CQG_SYNC: 'Đối Chiếu Số Dư CQG',
  CQG_SYNC: 'Đối Chiếu Số Dư CQG',
  SCAN_NEGATIVE_MARGIN: 'Quét Ký Quỹ Âm MM',
  AUTO_CHECK_SOD: 'Kiểm Tra Đầu Ngày SOD',

  // ── 2. TẢI BÁO CÁO TỪ CÁC HỆ THỐNG / CRAWLER (INGRESS) ──────────────────────
  DOWNLOAD_CQG_BACKUP: 'Tải Báo Cáo CQG',
  DOWNLOAD_CQG: 'Tải Báo Cáo CQG',
  RPA_DOWNLOAD_REPORTS: 'Tải Báo Cáo M-System',
  DOWNLOAD_CCP_REPORT: 'Tải Báo Cáo CoreCCP',
  DOWNLOAD_CE_REPORT: 'Tải Báo Cáo CoreEX',
  CHECK_EOD_CCP: 'Đối Chiếu EOD CoreCCP',
  DOWNLOAD_CAST: 'Tải Báo Cáo Phí CAST',
  DOWNLOAD_ACM: 'Tải Báo Cáo Tự Doanh ACM',

  // ── 3. KIỂM TRA THỦ CÔNG & GHÉP FILE THÔ (FILE AUDIT) ──────────────────────
  FILE_AUDIT_MS: 'Kiểm Tra & Tải Bổ Sung MS',
  FILE_AUDIT_CQG: 'Kiểm Tra & Ghép File CQG',
  FILE_AUDIT_CCP: 'Kiểm Tra & Tải Bổ Sung CoreCCP',
  FILE_AUDIT_ACM: 'Tải Báo Cáo Tự Doanh ACM',

  // ── 4. THỐNG KÊ SỐ LOT & GIÁ TRỊ GIAO DỊCH (MACRO) ─────────────────────────
  RUN_LOT_MACRO: 'Chạy Excel Macro Số Lot',
  RUN_VALUE_MACRO: 'Chạy Excel Macro Giá Trị',
  RUN_MACRO: 'Chạy Excel Macro Tổng Hợp',
  RUN_LOT_TVKD_MACRO: 'Thống Kê Số Lot TVKD',
  RUN_VALUE_TVKD_MACRO: 'Thống Kê Giá Trị TVKD',
  CCP_LOT_STATS: 'Thống Kê Số Lot CoreCCP',
  CCP_VALUE_STATS: 'Thống Kê Giá Trị CoreCCP',

  // ── 5. GIÁ THANH TOÁN (GTT) ────────────────────────────────────────────────
  CREATE_GTT_FILE: 'Tạo File Giá Thanh Toán',
  CHECK_GTT: 'Đối Chiếu Giá Thanh Toán',
  GENERATE_IMPORT_GTT_FILE: 'Tạo File Nhập Giá Thanh Toán',
  CHECK_GTT_CE_CCP: 'Đối Soát Giá Thanh Toán CE vs CCP',
  CHECK_GTT_LEGACY: 'Đối Chiếu Giá Thanh Toán MS vs CQG',

  // ── 6. XÁC THỰC EMAIL ──────────────────────────────────────────────────────
  VERIFY_EMAIL: 'Quét & Bóc Tách Email',
  EMAIL_PARSER: 'Quét & Bóc Tách Email',
  EMAIL_PARSE: 'Quét & Bóc Tách Email',
};

/**
 * Trả về nhãn nghiệp vụ tiếng Việt chuẩn hóa của một jobType
 */
export function getJobLabel(jobType: string): string {
  if (!jobType) return '';
  return JOB_TYPE_LABELS[jobType] || jobType;
}

/**
 * Danh sách các Job Type thuộc phạm vi Trading Manager & Bot Console
 */
export const TRADING_JOB_TYPES: readonly string[] = [
  'CHECK_KLGD',
  'CHECK_DSGD_BEFORE_EOD',
  'CHECK_EOD_MS',
  'CHECK_EOD',
  'CHECK_CQG_SYNC',
  'SCAN_NEGATIVE_MARGIN',
  'DOWNLOAD_CCP_REPORT',
  'DOWNLOAD_CE_REPORT',
  'CHECK_EOD_CCP',
  'RUN_LOT_MACRO',
  'RUN_VALUE_MACRO',
  'RUN_MACRO',
  'RUN_LOT_TVKD_MACRO',
  'RUN_VALUE_TVKD_MACRO',
  'AUTO_CHECK_SOD',
  'DOWNLOAD_CAST',
  'DOWNLOAD_CQG_BACKUP',
  'RPA_DOWNLOAD_REPORTS',
  'FILE_AUDIT_MS',
  'FILE_AUDIT_CQG',
  'FILE_AUDIT_CCP',
  'FILE_AUDIT_ACM',
  'CREATE_GTT_FILE',
  'CHECK_GTT',
  'GENERATE_IMPORT_GTT_FILE',
  'VERIFY_EMAIL',
  'EMAIL_PARSER',
  'EMAIL_PARSE',
] as const;

/**
 * Chuỗi query comma-separated sẵn sàng cho API call
 */
export const TRADING_JOB_TYPES_STRING = TRADING_JOB_TYPES.join(',');

