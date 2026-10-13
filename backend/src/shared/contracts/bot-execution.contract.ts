/**
 * Bot Execution Contract
 * Định nghĩa ngữ cảnh thực thi (Context) và kết quả (Result) chuẩn cho mọi Worker nghiệp vụ.
 *
 * NGUYÊN TẮC BẤT BIẾN:
 * 1. Worker chỉ tính toán nghiệp vụ chuyên ngành và trả về TaskExecutionResult.
 * 2. Worker TUYỆT ĐỐI KHÔNG chứa logic cập nhật Database ca trực (ShiftLog) - Việc này do Checklist Hub Dispatcher đảm nhiệm.
 * 3. Mọi dữ liệu chi tiết chuyên sâu (bảng kê so khớp lệnh, diff breakdown, log API thô) phải được lưu vào collection
 *    riêng của domain và trả về domainLogRefId. Ca trực chỉ lưu tóm tắt (summary/metrics) để tránh quá tải BSON 16MB.
 */

export type TaskExecutionStatus = 'SUCCESS' | 'FAILED' | 'WARNING';

export interface TaskExecutionContext {
  taskId: string;
  shiftId?: string;
  botCheckType: string; // Khả năng nghiệp vụ chuẩn hóa (CHECK_KLGD, CHECK_PRE_EOD, CHECK_MARGIN, CCP_LOT_STATS,...)
  targetDate?: string;  // YYYY-MM-DD hoặc DD/MM/YYYY
  parameters?: Record<string, any>;
  triggeredBy?: string; // Tên người bấm nút hoặc 'SYSTEM_SCHEDULER'
}

export interface TaskExecutionResult {
  status: TaskExecutionStatus;
  summary: string;
  metrics?: Record<string, any>;        // Các chỉ số tóm tắt (ví dụ: totalMatches: 150, mismatchedCount: 0)
  domainLogRefId?: string;              // ID tham chiếu tới bản ghi chi tiết trong collection riêng (trading_recon_logs, ccp_clearing_logs)
  error?: string;
  durationMs?: number;
  executedAt: Date;
}
