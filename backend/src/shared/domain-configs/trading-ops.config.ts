/**
 * Trading Ops Configuration Interface
 * Phân vùng độc lập cấu hình cho Khối Quản lý Giao dịch (QLGD).
 * Ngăn chặn triệt để nguy cơ tranh chấp tài nguyên, tài khoản và đường dẫn lưu trữ file với các khối khác.
 */

export interface IMSystemConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  storageDir: string;
}

export interface ICqgAccountConfig {
  accountId: string;          // CQG1, CQG2,...
  username?: string;
  password?: string;
  subfix?: string;            // Hậu tố gắn vào tên tài khoản ('', '-L', '-S')
}

export interface ICqgConfig {
  baseUrl: string;
  accounts: ICqgAccountConfig[];
  storageDir: string;
  mergedDir: string;          // Thư mục chứa các file gộp chuẩn (FR.xlsx, PS.xlsx, OP.xlsx, Od.xlsx)
}

export interface IAcmConfig {
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  sftpPassword?: string;
  remoteDir?: string;
  localDir: string;           // Thư mục lưu file Straits CSV
  webUrl?: string;
}

export interface ITradingOpsConfig {
  msystem: IMSystemConfig;
  cqg: ICqgConfig;
  acm: IAcmConfig;
  workingCalendarCheck: boolean;
}
