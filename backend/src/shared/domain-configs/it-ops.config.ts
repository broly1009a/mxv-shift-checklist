/**
 * IT Ops Configuration Interface
 * Phân vùng độc lập cấu hình cho Khối Vận hành IT & Sao lưu hệ thống.
 */

export interface IBackupConfig {
  baseBackupDir: string;
  archiveDir: string;
  retentionDays: number;
}

export interface IItOpsConfig {
  backup: IBackupConfig;
  headlessDefault: boolean;
  maxParallelBrowsers: number;
}
