import { requestJson, requestFormData, downloadBlob } from './client';
import { API_ENDPOINTS } from './endpoints';

export interface CcpClearingLogSummary {
  _id: string;
  runId: string;
  sessionDate: string;
  clearingType: 'LOT_STATISTICS' | 'VALUE_STATISTICS' | 'MARGIN_RECON' | 'DEPOSIT_WITHDRAWAL';
  source: 'MANUAL_UI' | 'AUTO_BOT' | 'API';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalAccountsProcessed: number;
  totalVolumeLots: number;
  totalValueVnd: number;
  totalFeeVnd: number;
  discrepanciesCount: number;
  executionTimeMs: number;
  createdAt: string;
}

export const ccpClearingApi = {
  /**
   * Lấy lịch sử log thanh toán bù trừ CCP theo ngày
   */
  async getLogs(
    sessionDate: string,
    token?: string | null,
  ): Promise<{ success: boolean; data: CcpClearingLogSummary[] }> {
    return requestJson<{ success: boolean; data: CcpClearingLogSummary[] }>(
      API_ENDPOINTS.CCP_CLEARING.LOGS(sessionDate),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy chi tiết kết quả thanh toán bù trừ CCP
   */
  async getLogDetail(
    logId: string,
    token?: string | null,
  ): Promise<{ success: boolean; data: any }> {
    return requestJson<{ success: boolean; data: any }>(
      API_ENDPOINTS.CCP_CLEARING.LOG_DETAIL(logId),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy danh sách tỷ giá hối đoái CCP
   */
  async getExchangeRates(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.EXCHANGE_RATES,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Đồng bộ tỷ giá hối đoái CCP tự động
   */
  async syncExchangeRates(token?: string | null): Promise<{ success: boolean; message?: string }> {
    return requestJson<{ success: boolean; message?: string }>(
      API_ENDPOINTS.CCP_CLEARING.SYNC_EXCHANGE_RATES,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Lấy tỷ giá USD gần nhất
   */
  async getUsdRate(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.USD_RATE,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Đồng bộ tỷ giá USD
   */
  async syncUsdRate(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.SYNC_USD_RATE,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Tải bảng số liệu CCP
   */
  async downloadCcpMetrics(filename = 'ccp_metrics.xlsx', token?: string | null): Promise<void> {
    return downloadBlob(
      API_ENDPOINTS.CCP_CLEARING.DOWNLOAD_CCP_METRICS,
      filename,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy cấu hình thống kê Lot/Value
   */
  async getLotConfig(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_CONFIG,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lưu cấu hình thống kê Lot/Value
   */
  async saveLotConfig(config: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_CONFIG,
      {
        method: 'POST',
        body: JSON.stringify(config),
      },
      token,
    );
  },

  /**
   * Quét dữ liệu giao dịch CCP theo ngày
   */
  async scanDailyLot(date: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_SCAN(date),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Đồng bộ tỷ giá cho công cụ Lot CCP
   */
  async syncExchangeRateLot(
    bodyOrToken?: { date?: string } | string | null,
    token?: string | null,
  ): Promise<any> {
    const actualBody = typeof bodyOrToken === 'object' && bodyOrToken !== null ? bodyOrToken : undefined;
    const actualToken = typeof bodyOrToken === 'string' ? bodyOrToken : token;

    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.SYNC_EXCHANGE_RATE_LOT,
      {
        method: 'POST',
        body: actualBody ? JSON.stringify(actualBody) : undefined,
      },
      actualToken,
    );
  },

  /**
   * Tải lên bảng tỷ giá (Excel) cho công cụ Lot CCP
   */
  async uploadTygia(formData: FormData, token?: string | null): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_UPLOAD_TYGIA,
      formData,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Tính toán thống kê Lot từ FormData upload
   */
  async processLotStatistics(formData: FormData, token?: string | null): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_STATISTICS,
      formData,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Lấy thông tin thống kê Lot hiện tại
   */
  async getLotStatistics(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_STATISTICS,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Ghi dữ liệu lũy kế vào Excel (write accumulator)
   */
  async writeAccumulator(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_ACCUMULATOR,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Xử lý thống kê Lot ngày
   */
  async processDailyLot(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_PROCESS,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Chạy thống kê Lot
   */
  async runLot(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_RUN,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Chạy thống kê Giá trị giao dịch (Value)
   */
  async runValue(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.VALUE_RUN,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Chạy Macro CoreCCP toàn diện (Tất cả 11 file Số Lot + GTGD)
   */
  async runMacro(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      '/api/v1/ccp-statistics/lot-statistics/run-macro',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Lấy danh sách lịch sử thực thi thống kê CoreCCP gần nhất
   */
  async getLotRunHistory(
    params?: { date?: string; limit?: number },
    token?: string | null,
  ): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const endpoint = `/api/v1/ccp-statistics/lot-statistics/run-history${qs ? `?${qs}` : ''}`;
    return requestJson<any[]>(endpoint, { method: 'GET' }, token);
  },

  /**
   * Lấy bản ghi chạy gần nhất cho một ngày phiên
   */
  async getLatestLotRun(
    date?: string,
    token?: string | null,
  ): Promise<any | null> {
    const endpoint = `/api/v1/ccp-statistics/lot-statistics/latest-run${date ? `?date=${encodeURIComponent(date)}` : ''}`;
    return requestJson<any | null>(endpoint, { method: 'GET' }, token);
  },

  /**
   * Kiểm tra thông tin các file sẽ chạy và tính hợp lý của đường dẫn lưu file (CoreCCP)
   */
  async inspectLotPreFlight(
    date: string,
    type: 'LOT' | 'VALUE' | 'ALL' = 'ALL',
    token?: string | null,
  ): Promise<any> {
    const endpoint = `/api/v1/ccp-statistics/lot-statistics/preflight?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`;
    return requestJson<any>(endpoint, { method: 'GET' }, token);
  },

  /**
   * Kích hoạt Thống kê CoreCCP theo Khoảng Thời Gian (Ad-hoc Range)
   */
  async runAdHocRange(
    payload: {
      fromDate: string;
      toDate: string;
      scope?: 'ACM_ONLY' | 'ALL_PHASE2' | 'ALL';
      downloadFresh?: boolean;
      localDsgdFilePath?: string;
    },
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_RUN_ADHOC_RANGE,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Lấy danh sách các tệp báo cáo đột xuất đã sinh
   */
  async getAdHocReports(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_ADHOC_REPORTS,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Kích hoạt Macro Thống kê Khối lượng (Lot Macro)
   */
  async triggerLotMacro(
    bodyOrToken?: { targetDate?: string } | string | null,
    token?: string | null,
  ): Promise<{ success: boolean; message?: string; jobId?: string }> {
    const actualBody = typeof bodyOrToken === 'object' && bodyOrToken !== null ? bodyOrToken : undefined;
    const actualToken = typeof bodyOrToken === 'string' ? bodyOrToken : token;

    return requestJson<{ success: boolean; message?: string; jobId?: string }>(
      API_ENDPOINTS.CCP_CLEARING.TRIGGER_LOT_MACRO,
      {
        method: 'POST',
        body: actualBody ? JSON.stringify(actualBody) : undefined,
      },
      actualToken,
    );
  },

  /**
   * Kích hoạt Macro Thống kê Giá trị (Value Macro)
   */
  async triggerValueMacro(
    bodyOrToken?: { targetDate?: string } | string | null,
    token?: string | null,
  ): Promise<{ success: boolean; message?: string; jobId?: string }> {
    const actualBody = typeof bodyOrToken === 'object' && bodyOrToken !== null ? bodyOrToken : undefined;
    const actualToken = typeof bodyOrToken === 'string' ? bodyOrToken : token;

    return requestJson<{ success: boolean; message?: string; jobId?: string }>(
      API_ENDPOINTS.CCP_CLEARING.TRIGGER_VALUE_MACRO,
      {
        method: 'POST',
        body: actualBody ? JSON.stringify(actualBody) : undefined,
      },
      actualToken,
    );
  },

  /**
   * Lấy cấu hình thống kê Giá trị
   */
  async getValueConfig(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.VALUE_CONFIG,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lưu cấu hình thống kê Giá trị
   */
  async saveValueConfig(config: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.VALUE_CONFIG,
      {
        method: 'PUT',
        body: JSON.stringify(config),
      },
      token,
    );
  },

  /**
   * Xử lý thống kê Giá trị từ thư mục local
   */
  async processValueLocal(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.VALUE_PROCESS_LOCAL,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Xử lý thống kê TVKD lũy kế
   */
  async processValueTvkdOnly(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.VALUE_PROCESS_TVKD_ONLY,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Lấy cấu hình thống kê Lot
   */
  async getLotStatsConfig(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_STATS_CONFIG,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lưu cấu hình thống kê Lot
   */
  async saveLotStatsConfig(config: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_STATS_CONFIG,
      {
        method: 'PUT',
        body: JSON.stringify(config),
      },
      token,
    );
  },

  /**
   * Xử lý thống kê Lot từ form upload
   */
  async processLotStats(formData: FormData, token?: string | null): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_STATS_PROCESS,
      formData,
      token,
    );
  },

  /**
   * Xử lý thống kê Lot từ thư mục local
   */
  async processLotStatsLocal(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_CLEARING.LOT_STATS_PROCESS_LOCAL,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Tải tệp kết quả thống kê Lot từ form upload
   */
  async downloadLotStats(formData: FormData, filename = 'lot_statistics.xlsx', token?: string | null): Promise<void> {
    return downloadBlob(
      API_ENDPOINTS.CCP_CLEARING.LOT_STATS_PROCESS_DOWNLOAD,
      filename,
      {
        method: 'POST',
        body: formData,
      },
      token,
    );
  },

  /**
   * Tải tệp kết quả thống kê Lot từ thư mục local
   */
  async downloadLotStatsLocal(payload: any, filename = 'lot_statistics.xlsx', token?: string | null): Promise<void> {
    return downloadBlob(
      API_ENDPOINTS.CCP_CLEARING.LOT_STATS_PROCESS_LOCAL_DOWNLOAD,
      filename,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },
};
