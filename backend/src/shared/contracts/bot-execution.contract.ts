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

export type TaskExecutionStatus = 'SUCCESS' | 'FAILED' | 'WARNING' | 'WAITING';

export interface TaskExecutionContext {
  taskId: string;
  shiftId?: string;
  botCheckType: string; // Khả năng nghiệp vụ chuẩn hóa (CHECK_KLGD, CHECK_DSGD_BEFORE_EOD, CHECK_MARGIN, CCP_LOT_STATS,...)
  targetDate?: string;  // YYYY-MM-DD hoặc DD/MM/YYYY
  parameters?: Record<string, any>;
  triggeredBy?: string; // Tên người bấm nút hoặc 'SYSTEM_SCHEDULER'
  job?: any;            // Tham chiếu BotJob document nếu chạy qua hàng đợi
  onLog?: (message: string) => void; // Callback ghi log thời gian thực
}

export interface TaskExecutionResult {
  status: TaskExecutionStatus;
  summary: string;
  passed?: boolean;                     // Kết quả đạt hay không đạt
  isWaitingFiles?: boolean;             // Cờ đánh dấu hệ thống đang thiếu tệp đối chiếu
  metrics?: Record<string, any>;        // Các chỉ số tóm tắt (ví dụ: totalMatches: 150, mismatchedCount: 0)
  domainLogRefId?: string;              // ID tham chiếu tới bản ghi chi tiết trong collection riêng (trading_recon_logs, ccp_clearing_logs)
  details?: Record<string, any>;        // Dữ liệu đối chiếu chi tiết (mismatchedTrades, mismatchedPositions, passed, v.v.)
  logs?: string[];                      // Danh sách các log chi tiết trong quá trình thực thi
  error?: string;
  durationMs?: number;
  executedAt: Date;
}
