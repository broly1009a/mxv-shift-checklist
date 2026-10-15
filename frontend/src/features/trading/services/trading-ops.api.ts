import { requestJson } from './api-client';
import {
  ConsoleSummaryData,
  TriggerConsoleRunParams,
  TriggerRunResponse,
  TradingReconLogItem,
} from '../types/trading.types';

export const tradingOpsApi = {
  /**
   * Lấy tổng hợp dữ liệu màn hình Giám sát đối chiếu (KLGD, TTM, TTTT, Pre-EOD, Runs)
   */
  async getConsoleSummary(
    date?: string,
    jobId?: string | null,
    token?: string | null,
  ): Promise<ConsoleSummaryData> {
    return requestJson<ConsoleSummaryData>(
      '/api/v1/trading-ops/console-summary',
      {
        method: 'GET',
        params: {
          date,
          jobId: jobId || undefined,
        },
      },
      token,
    );
  },

  /**
   * Kích hoạt quét đối chiếu ngay lập tức (bỏ qua cooldown)
   */
  async triggerConsoleRun(
    params: TriggerConsoleRunParams,
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      '/api/v1/trading-ops/trigger-console-run',
      {
        method: 'POST',
        body: JSON.stringify({
          date: params.date,
          jobType: params.jobType || 'CHECK_KLGD',
          bypassCooldown: params.bypassCooldown !== false,
          options: params.options || {
            checkKlgd: true,
            checkTtm: true,
            checkTttt: true,
          },
        }),
      },
      token,
    );
  },

  /**
   * Truy vấn danh sách Nhật ký Đối soát (Trading Recon Logs) theo ngày từ Modular V2
   */
  async getReconLogs(
    tradingDate: string,
    token?: string | null,
  ): Promise<{ success: boolean; count: number; data: TradingReconLogItem[] }> {
    return requestJson<{ success: boolean; count: number; data: TradingReconLogItem[] }>(
      `/api/v1/trading-ops/recon-logs/by-date/${encodeURIComponent(tradingDate)}`,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy chi tiết một bản ghi Nhật ký Đối soát theo ID từ Modular V2
   */
  async getReconLogById(
    id: string,
    token?: string | null,
  ): Promise<{ success: boolean; data: TradingReconLogItem }> {
    return requestJson<{ success: boolean; data: TradingReconLogItem }>(
      `/api/v1/trading-ops/recon-logs/${encodeURIComponent(id)}`,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Kiểm tra tự động DSGD trước EOD (Tương đương CheckDSGDBeforeEOD tool C#)
   */
  async checkDsgdBeforeEod(
    params: {
      tradingDate?: string;
      timeSuffix?: string;
      triggerDownload?: boolean;
      shiftLogId?: string;
      taskId?: string;
    },
    token?: string | null,
  ): Promise<{ success: boolean; message: string; result: any }> {
    return requestJson<{ success: boolean; message: string; result: any }>(
      '/api/v1/trading-ops/check-dsgd-before-eod',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
      token,
    );
  },

  /**
   * Kiểm tra 4 nhóm vi phạm IMR (Ký quỹ khả dụng)
   */
  async checkImr(
    sessionDate?: string,
    token?: string | null,
  ): Promise<{ success: boolean; result?: any; message?: string }> {
    return requestJson<{ success: boolean; result?: any; message?: string }>(
      '/api/v1/trading-ops/check-imr',
      {
        method: 'POST',
        body: JSON.stringify({ sessionDate }),
      },
      token,
    );
  },
};
