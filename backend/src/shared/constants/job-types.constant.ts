/**
 * job-types.constant.ts
 *
 * Danh mục chuẩn hóa các loại Job Type trong hệ thống Bot Engine & Checklist Hub.
 * Nguồn chân lý duy nhất (Single Source of Truth) để tránh trùng lặp code và lệch pha giữa các module.
 */

/**
 * Danh sách các Job Type thuộc nhóm Đối Soát / Thẩm Định (Audit & Verification Jobs).
 *
 * Nghiệp vụ MXV:
 * 1. Khi người trực ca chủ động tích hoàn thành thủ công một tác vụ (isChecked = true),
 *    hệ thống sẽ tự động hủy (CANCELLED) các Job PENDING thuộc nhóm này để bot không ghi đè kết quả của người trực.
 * 2. Khi ca trực đã hoàn tất (COMPLETED), Queue Guard sẽ tự động hủy các Job thuộc nhóm này nếu được bốc lên.
 */
export const AUDIT_JOB_TYPES = [
  'CHECK_KLGD',
  'CHECK_DSGD_BEFORE_EOD',
  'CHECK_EOD_MS',
  'CHECK_CQG_SYNC',
  'FILE_AUDIT_ACM',
  'FILE_AUDIT_CQG',
  'FILE_AUDIT_MS',
  'AUTO_CHECK_SOD',
  'RUN_MACRO',
  'RUN_LOT_MACRO',
  'RUN_VALUE_MACRO',
] as const;

export type AuditJobType = (typeof AUDIT_JOB_TYPES)[number];

/**
 * Kiểm tra xem một jobType có thuộc nhóm Audit/Đối soát hay không.
 */
export function isAuditJobType(jobType: string): boolean {
  return (AUDIT_JOB_TYPES as readonly string[]).includes(jobType);
}
