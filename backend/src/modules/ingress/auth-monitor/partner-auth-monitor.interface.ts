/**
 * partner-auth-monitor.interface.ts
 *
 * Định nghĩa các kiểu dữ liệu, Enums và Contracts cho hệ thống giám sát
 * tần suất đăng nhập và yêu cầu của 5 phân hệ đối tác: CORECCP, COREEX, MS, CQG, ACM.
 * Tuân thủ quy chuẩn Zero-Hardcoding & Clean Architecture.
 */

export type PartnerSubsystem = 'CORECCP' | 'COREEX' | 'MS' | 'CQG' | 'ACM';

export type PartnerEventType =
  | 'LOGIN'
  | 'REFRESH_TOKEN'
  | 'API_REQUEST'
  | 'SFTP_CONNECT'
  | 'CIRCUIT_BREAKER';

export interface IPartnerTelemetryEvent {
  partner: PartnerSubsystem;
  eventType: PartnerEventType;
  success: boolean;
  statusCode?: number;
  durationMs: number;
  account?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface IPartnerThresholds {
  maxLoginsPerMinute: number;
  consecutiveFailures: number;
  maxRpm: number;
}

export interface IPartnerMonitorConfig {
  enabled: boolean;
  recipients: string[];
  cooldownMinutes: number;
  thresholds: Record<PartnerSubsystem, IPartnerThresholds>;
}

export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface IPartnerHealthSummary {
  partner: PartnerSubsystem;
  health: HealthStatus;
  activeToken: boolean;
  tokenExpiresAt?: Date | null;
  rpm: number;
  loginsLastMinute: number;
  consecutiveFailures: number;
  successRate: number; // Tỷ lệ % (0 - 100)
  totalRequestsLastHour: number;
  lastSeenAt: Date | null;
  lastError?: string;
  configuredAccount?: string; // Tài khoản bot được lưu cấu hình trong CSDL
  totalRequestsToday?: number; // Tổng số yêu cầu trong ngày theo bộ lọc
  totalLoginsToday?: number; // Tổng số lượt đăng nhập trong ngày theo bộ lọc
  failedRequestsToday?: number; // Số lượt lỗi trong ngày theo bộ lọc
}

