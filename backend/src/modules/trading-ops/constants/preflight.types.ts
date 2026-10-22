export interface PreflightFileSpec {
  id: string;
  name: string;
  role: string;
  patterns: (RegExp | string)[];
  required: boolean;
  sourceCategory: 'CCP' | 'CE' | 'MS' | 'CQG' | 'COMMON';
  enabled?: boolean; // Cho phép tắt kiểm tra riêng tệp này nếu không còn dùng tới
}

export interface PreflightAccumulatorSpec {
  key: string;
  label: string;
  settingKey: string; // Tên key lưu trong MongoDB system_settings
  defaultPattern: string; // Đường dẫn mẫu chứa biến ${YYYY}
  checkOverwriteRule?: 'DATE_IN_SHEET' | 'FILE_EXISTS' | 'MONTHLY_FILE' | 'NONE';
  group?: 'LOT' | 'VALUE' | 'RECON' | 'EOD' | 'ALL';
  enabled?: boolean; // Cho phép tắt kiểm tra đường dẫn này nếu không dùng tới
}

export interface TradingOpsTaskPreflightDefinition {
  taskKey: string;
  jobType?: string; // Khớp với BOT_TASK_REGISTRY nếu là tác vụ bot
  botCheckType?: string;
  displayName: string;
  description: string;
  category: 'STATISTICS' | 'RECONCILIATION' | 'SESSION_OPEN' | 'POST_EOD' | 'INGRESS';
  /**
   * Cờ bật/tắt tập trung:
   * true = BẬT kiểm tra trước khi chạy (ON).
   * false = TẮT (OFF) - Khi tác vụ này không dùng tới nữa hoặc tạm ngưng thì off được.
   */
  enabled: boolean;
  /**
   * Key cấu hình động trong MongoDB (nếu có) để Quản trị viên có thể bật/tắt (toggle) runtime
   * mà không cần phải sửa code.
   */
  toggleSettingKey?: string;
  inputFiles: PreflightFileSpec[];
  accumulators?: PreflightAccumulatorSpec[];
  extraChecks?: ('USD_EXCHANGE_RATE' | 'RAW_CQG_PAIR_MERGE' | 'SETTLEMENT_PRICE')[];
}
