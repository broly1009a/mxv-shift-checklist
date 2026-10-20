/**
 * Trading Domain Types & Interfaces
 * Chuẩn hóa toàn bộ cấu trúc dữ liệu cho phân hệ Trading Operations, CCP Clearing và Robot Automation.
 */

export interface ReconTotals {
  totalMS: number;
  totalCQG: number;
  differ: number;
  totalACM?: number;
  totalACM_MS?: number;
  totalACM_Straits?: number;
  differACM?: number;
}

export interface MismatchedTrade {
  maTKGD: string;
  maHD: string;
  giaKhop: number;
  klGiaoDich: number;
  source: 'MS' | 'CQG' | 'ACM' | string;
  reason: string;
}

export interface MismatchedPosition {
  account: string;
  symbol: string;
  msPosition: number;
  cqgPosition: number;
  differ: number;
}

export interface MismatchedTTM {
  maTKGD: string;
  ttmValue: number;
  opValue: number;
  differ: number;
}

export interface MismatchedTTTT {
  maTKGD: string;
  ttttValue: number;
  psValue: number;
  differ: number;
}

export interface ReconRunHistoryItem {
  id: string;
  label: string;
  time: string;
  status: 'PASSED' | 'NEEDS_ATTENTION' | 'FAILED' | 'PROCESSING' | string;
  isLatest?: boolean;
}

export interface ConsoleSummaryData {
  shiftInfo?: {
    shiftLogId?: string;
    shiftName?: string;
    shiftDate?: string;
    lastCheckedAt?: string;
    nextScanInSeconds?: number;
    autoReconActive?: boolean;
    systemStatus?: 'ONLINE' | 'OFFLINE' | 'WARNING';
  };
  klgd?: {
    status?: string;
    executedAt?: string;
    jobId?: string;
    totals?: ReconTotals;
    mismatchedTrades?: MismatchedTrade[];
    mismatchedTTM?: MismatchedTTM[];
    mismatchedTTTT?: MismatchedTTTT[];
  };
  dsgdBeforeEod?: {
    status?: string;
    executedAt?: string;
    jobId?: string;
    totals?: ReconTotals;
    mismatchedTrades?: MismatchedTrade[];
    mismatchedPositions?: MismatchedPosition[];
  };
  runs?: ReconRunHistoryItem[];
  currentJobId?: string;
}

export interface TriggerConsoleRunParams {
  date?: string;
  jobType?: 'CHECK_KLGD' | 'CHECK_DSGD_BEFORE_EOD' | 'CHECK_CQG_SYNC' | string;
  bypassCooldown?: boolean;
  options?: {
    checkKlgd?: boolean;
    checkTtm?: boolean;
    checkTttt?: boolean;
  };
}

export interface TriggerRunResponse {
  success: boolean;
  message?: string;
  jobId?: string;
  isReused?: boolean;
}

export interface TradingReconLogItem {
  _id: string;
  tradingDate: string;
  reconType: 'CHECK_KLGD' | 'CHECK_DSGD_BEFORE_EOD' | 'CHECK_CQG_SYNC' | 'SCAN_NEGATIVE_MARGIN' | string;
  status: 'PASSED' | 'FAILED' | 'NEEDS_ATTENTION' | 'ERROR';
  sourceFiles?: Array<{ name: string; size?: number; path?: string }>;
  metrics?: Record<string, any>;
  mismatchesCount: number;
  executionTimeMs?: number;
  errorDetails?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CcpClearingLogItem {
  _id: string;
  tradingDate: string;
  clearingType: 'LOT_STATISTICS' | 'VALUE_STATISTICS' | 'MACRO_ALL' | string;
  status: 'PASSED' | 'FAILED' | 'ERROR';
  sourceFiles?: Array<{ name: string; size?: number; path?: string }>;
  metrics?: Record<string, any>;
  executionTimeMs?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ExchangeRatesData {
  success: boolean;
  rates?: Record<string, number>;
  rate?: number;
  updatedAt?: string;
}

export interface BotJobItem {
  _id: string;
  jobType: string;
  status: 'PENDING' | 'PROCESSING' | 'AWAITING_CAPTCHA' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress?: number;
  logs?: string[];
  error?: string;
  payload?: any;
  result?: any;
  createdAt: string;
  updatedAt?: string;
}

export interface BackupAuditResult {
  success: boolean;
  source: 'MS' | 'CQG' | 'ACM' | 'CCP' | string;
  date: string;
  files: Array<{
    name: string;
    status: 'VALID' | 'MISSING' | 'CORRUPTED';
    sizeBytes?: number;
    path?: string;
  }>;
  missingCount: number;
  totalExpected: number;
}
