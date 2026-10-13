/**
 * CCP Clearing Configuration Interface
 * Phân vùng độc lập cấu hình cho Khối Bù trừ CCP.
 */

export interface ICoreCcpConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  storageDir: string;         // Thư mục lưu 25 file báo cáo CCP
  macroExportDir: string;     // Thư mục xuất báo cáo thống kê Lot & Giá trị CCP
}

export interface ICcpClearingConfig {
  coreCcp: ICoreCcpConfig;
  defaultUsdVndRate?: number;
}
