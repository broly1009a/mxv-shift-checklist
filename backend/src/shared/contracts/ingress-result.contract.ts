/**
 * Ingress Result Contract
 * Chuẩn hóa kết quả dữ liệu đầu vào (tải báo cáo từ Web/SFTP/API)
 * BẮT BUỘC mang theo outputDirectory và absolutePath để downstream services không tự đoán mò đường dẫn.
 */

export type IngressSourceType = 'MS' | 'CQG' | 'ACM' | 'CCP' | 'CORE_EX' | 'CORE_CCP';

export interface IngressFileDetail {
  fileName: string;
  absolutePath: string;
  fileSize?: number;
  mtime?: Date;
  category?: string; // Ví dụ: 'FR', 'PS', 'OP', 'OD', 'TTM', 'TTTT', 'DSGD', 'STRAITS'
  metadata?: Record<string, any>;
}

export interface IngressDownloadOptions {
  targetDate?: string;          // Định dạng YYYY-MM-DD hoặc DD/MM/YYYY
  targetDirectory?: string;     // Thư mục đích chỉ định (nếu có)
  outputDir?: string;           // Alias của targetDirectory
  reportType?: string;          // Loại báo cáo cụ thể (DSGD, TTM, TTTT, STRAITS_CSV,...)
  accountIds?: string[];        // Danh sách tài khoản (cho CQG1, CQG2,...)
  reportCodes?: string[];       // Mã báo cáo cần lấy (cho M-System hoặc CCP 25 files)
  timeoutMs?: number;           // Timeout tối đa
  forceRefresh?: boolean;       // Bỏ qua cache nếu đã tải
  isFullBackup?: boolean;       // Kích hoạt chế độ tải toàn bộ file backup của hệ thống
  mode?: 'REST_API' | 'SFTP' | 'PLAYWRIGHT' | string; // Chỉ định chế độ ingress tường minh (REST_API / SFTP / PLAYWRIGHT)
}

export interface IngressDownloadResult {
  success: boolean;
  source: IngressSourceType;
  outputDirectory: string;      // Thư mục chứa các file đã tải về
  files: IngressFileDetail[];    // Danh sách file chi tiết kèm đường dẫn tuyệt đối
  downloadedAt: Date;
  durationMs?: number;
  error?: string;
  summary?: string;
}
