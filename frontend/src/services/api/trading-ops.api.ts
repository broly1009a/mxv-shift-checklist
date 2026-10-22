import { requestJson, requestFormData } from './client';
import { API_ENDPOINTS } from './endpoints';

export interface ConsoleSummaryResponse {
  date: string;
  files: any[];
  reconciliations: any[];
  summary: any;
  cqgSync: any;
  eodResult: any;
  negativeMargin: any;
  gttStatus: any;
  acmBackup: any;
  ccpBackup: any;
  eodRun?: any;
  dsgdBeforeEod?: any;
  shiftInfo?: any;
  klgd?: any;
  [key: string]: any;
}

import { TriggerRunResponse } from './ingress.api';

export interface ReconLogSummary {
  _id: string;
  runId: string;
  sessionDate: string;
  reconType: 'KLGD' | 'DSGD_BEFORE_EOD' | 'EOD' | 'NEGATIVE_MARGIN';
  source: 'MANUAL_UI' | 'AUTO_BOT' | 'API';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'MATCHED' | 'DISCREPANCY';
  totalTransactionsMs: number;
  totalTransactionsCqg: number;
  matchedCount: number;
  unmatchedCount: number;
  diffAmountTotal: number;
  executionTimeMs: number;
  createdAt: string;
}

export interface ConsoleSummaryParams {
  date?: string;
  jobId?: string | null;
}

export const tradingOpsApi = {
  /**
   * Lấy tổng hợp trạng thái đối soát cho Dashboard Console (Hỗ trợ cả Options Object lẫn string date)
   */
  async getConsoleSummary(
    paramsOrDate?: string | ConsoleSummaryParams,
    jobId?: string | null,
    token?: string | null,
  ): Promise<ConsoleSummaryResponse> {
    const isObject = typeof paramsOrDate === 'object' && paramsOrDate !== null;
    const dateStr = isObject ? paramsOrDate.date : paramsOrDate;
    const actualJobId = isObject ? paramsOrDate.jobId : jobId;
    const actualToken = isObject ? (typeof jobId === 'string' ? jobId : token) : token;

    return requestJson<ConsoleSummaryResponse>(
      API_ENDPOINTS.TRADING_OPS.CONSOLE_SUMMARY,
      {
        params: {
          ...(dateStr ? { date: dateStr } : {}),
          ...(actualJobId ? { jobId: actualJobId } : {}),
        },
      },
      actualToken,
    );
  },

  /**
   * Kích hoạt đối soát thủ công hoặc điều phối bot
   */
  async triggerRun(
    typeOrPayload: string | { type?: string; jobType?: string; sessionDate?: string; date?: string; [key: string]: any },
    sessionDateOrToken?: string | null,
    options: Record<string, any> = {},
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    if (typeof typeOrPayload === 'object' && typeOrPayload !== null) {
      const type = typeOrPayload.type || typeOrPayload.jobType || 'CHECK_KLGD';
      const sessionDate = typeOrPayload.sessionDate || typeOrPayload.date || '';
      const actualToken = typeof sessionDateOrToken === 'string' ? sessionDateOrToken : token;
      return requestJson<TriggerRunResponse>(
        API_ENDPOINTS.TRADING_OPS.TRIGGER_RUN,
        {
          method: 'POST',
          body: JSON.stringify({
            bypassCooldown: true,
            ...typeOrPayload,
            type,
            jobType: type,
            sessionDate,
            date: sessionDate,
          }),
        },
        actualToken,
      );
    }
    const type = typeOrPayload;
    const sessionDate = typeof sessionDateOrToken === 'string' ? sessionDateOrToken : '';
    return requestJson<TriggerRunResponse>(
      API_ENDPOINTS.TRADING_OPS.TRIGGER_RUN,
      {
        method: 'POST',
        body: JSON.stringify({
          type,
          jobType: type,
          sessionDate,
          date: sessionDate,
          bypassCooldown: true,
          options,
          ...options,
        }),
      },
      token,
    );
  },

  /**
   * Lấy lịch sử log đối soát theo ngày
   */
  async getReconLogs(
    sessionDate: string,
    token?: string | null,
  ): Promise<{ success: boolean; data: ReconLogSummary[] }> {
    return requestJson<{ success: boolean; data: ReconLogSummary[] }>(
      API_ENDPOINTS.TRADING_OPS.RECON_LOGS(sessionDate),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy chi tiết kết quả đối soát theo ID
   */
  async getReconLogDetail(
    logId: string,
    token?: string | null,
  ): Promise<{ success: boolean; data: any }> {
    return requestJson<{ success: boolean; data: any }>(
      API_ENDPOINTS.TRADING_OPS.RECON_LOG_DETAIL(logId),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Kiểm tra DSGD trước giờ EOD
   */
  async checkDsgdBeforeEod(
    params: {
      sessionDate?: string;
      tradingDate?: string;
      timeSuffix?: string;
      exactDate?: boolean;
      triggerDownload?: boolean;
      autoRemind?: boolean;
    },
    token?: string | null,
  ): Promise<{ success: boolean; result?: any; message?: string }> {
    return requestJson<{ success: boolean; result?: any; message?: string }>(
      API_ENDPOINTS.TRADING_OPS.DSGD_BEFORE_EOD,
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
      API_ENDPOINTS.TRADING_OPS.CHECK_IMR,
      {
        method: 'POST',
        body: JSON.stringify({ sessionDate }),
      },
      token,
    );
  },

  /**
   * Tải tệp đối soát KLGD lên hệ thống (FormData)
   */
  async uploadKlgd(
    formData: FormData,
    token?: string | null,
  ): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.TRADING_OPS.UPLOAD_KLGD,
      formData,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Tải tệp đối soát Dsgd-Before-EOD lên hệ thống (FormData)
   */
  async uploadDsgdBeforeEod(
    formData: FormData,
    token?: string | null,
  ): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.TRADING_OPS.UPLOAD_DSGD_BEFORE_EOD,
      formData,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Tải tệp đối soát EOD lên hệ thống (FormData)
   */
  async uploadEod(
    formData: FormData,
    token?: string | null,
  ): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.TRADING_OPS.UPLOAD_EOD,
      formData,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Lấy tin nhắn cảnh báo đáo hạn hợp đồng
   */
  async getMaturityMessages(
    shiftLogId: string,
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_OPS.MATURITY_MESSAGES(shiftLogId),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Kiểm tra âm ký quỹ
   */
  async checkNegativeMargin(
    sessionDate?: string,
    token?: string | null,
    options?: { system?: string; scope?: string },
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    return requestJson<{ success: boolean; message?: string; data?: any }>(
      API_ENDPOINTS.TRADING_OPS.CHECK_NEGATIVE_MARGIN,
      {
        method: 'POST',
        body: JSON.stringify({ sessionDate, ...options }),
      },
      token,
    );
  },

  /**
   * Kiểm tra số dư EOD CoreCCP vs CoreEX
   */
  async checkEodRun(
    sessionDate?: string,
    token?: string | null,
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    return requestJson<{ success: boolean; message?: string; data?: any }>(
      API_ENDPOINTS.TRADING_OPS.CHECK_EOD_RUN,
      {
        method: 'POST',
        body: JSON.stringify({ sessionDate }),
      },
      token,
    );
  },

  /**
   * Kích hoạt đối soát Dsgd-Before-EOD CoreCCP ↔ CoreEX
   */
  async runCheckDsgdBeforeEod(
    sessionDate?: string,
    token?: string | null,
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    return requestJson<{ success: boolean; message?: string; data?: any }>(
      API_ENDPOINTS.TRADING_OPS.RUN_CHECK_DSGD_BEFORE_EOD,
      {
        method: 'POST',
        body: JSON.stringify({ sessionDate }),
      },
      token,
    );
  },

  /**
   * Lấy danh sách ngày mẫu đối chiếu
   */
  async getSampleDates(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_OPS.SAMPLE_DATES,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy tỷ giá USD hiện tại
   */
  async getUsdRate(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_OPS.USD_RATE,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Đồng bộ tỷ giá USD từ M-System
   */
  async syncUsdRate(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_OPS.SYNC_USD_RATE,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Đồng bộ toàn bộ tỷ giá đa tiền tệ từ M-System (Quy đổi & Thanh toán) qua Direct REST API
   */
  async syncMsExchangeRates(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_OPS.SYNC_MS_EXCHANGE_RATES,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Chạy kiểm thử đối chiếu từ thư mục mẫu nội bộ
   */
  async runTestLocal(
    payload: { samplePath: string; usdRate: number },
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_OPS.RUN_TEST_LOCAL,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Kích hoạt bot đối chiếu tự động
   */
  async runAuto(
    payload: { usdRate: number },
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_OPS.RUN_AUTO,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Tải tệp thủ công lên và kiểm thử đối chiếu
   */
  async testUpload(
    formData: FormData,
    token?: string | null,
  ): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.TRADING_OPS.TEST_UPLOAD,
      formData,
      token,
    );
  },

  /**
   * Kiểm tra thông tin các file sẽ chạy và kiểm tra đường dẫn lưu file tập trung
   * Dùng cho tất cả tác vụ Trading Ops (CE, CCP, KLGD, EOD, Margin...)
   */
  async inspectPreFlight(
    taskKey: string,
    date: string,
    scope: string = 'ALL',
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_OPS.PREFLIGHT(taskKey, date, scope),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy danh mục các tác vụ có hỗ trợ Pre-flight check
   */
  async getPreflightTasks(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_OPS.PREFLIGHT_TASKS,
      { method: 'GET' },
      token,
    );
  },
};
