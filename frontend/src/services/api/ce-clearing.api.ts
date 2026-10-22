import { requestJson } from './client';
import { API_ENDPOINTS } from './endpoints';

export const ceClearingApi = {
  /**
   * Quét thư mục backup CoreEX theo ngày phiên
   */
  async scanDailyLot(date: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CE_CLEARING.LOT_SCAN(date),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Tính toán thống kê Số Lot và GTGD CE
   */
  async processDailyLot(date: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CE_CLEARING.LOT_PROCESS,
      {
        method: 'POST',
        body: JSON.stringify({ date }),
      },
      token,
    );
  },

  /**
   * Ghi trực tiếp Số Lot CE vào file lũy kế (hỗ trợ cờ forceOverwrite, exportDraft, async)
   */
  async runLotStatistics(
    date: string,
    token?: string | null,
    options?: { forceOverwrite?: boolean; exportDraft?: boolean; async?: boolean },
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CE_CLEARING.LOT_RUN,
      {
        method: 'POST',
        body: JSON.stringify({
          date,
          forceOverwrite: options?.forceOverwrite,
          exportDraft: options?.exportDraft,
          async: options?.async,
        }),
      },
      token,
    );
  },

  /**
   * Ghi trực tiếp GTGD CE vào file lũy kế (hỗ trợ cờ forceOverwrite, exportDraft, async)
   */
  async runValueStatistics(
    date: string,
    token?: string | null,
    options?: { forceOverwrite?: boolean; exportDraft?: boolean; async?: boolean },
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CE_CLEARING.VALUE_RUN,
      {
        method: 'POST',
        body: JSON.stringify({
          date,
          forceOverwrite: options?.forceOverwrite,
          exportDraft: options?.exportDraft,
          async: options?.async,
        }),
      },
      token,
    );
  },

  /**
   * Chạy Macro CoreEX toàn diện (Lot + GTGD)
   */
  async runMacroStatistics(
    date: string,
    token?: string | null,
    options?: { forceOverwrite?: boolean; async?: boolean },
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CE_CLEARING.MACRO_RUN,
      {
        method: 'POST',
        body: JSON.stringify({
          date,
          forceOverwrite: options?.forceOverwrite,
          async: options?.async,
        }),
      },
      token,
    );
  },

  /**
   * Tải file bản nháp Draft từ server về máy người dùng
   */
  async downloadDraftFile(filename: string, token?: string | null): Promise<void> {
    const url = API_ENDPOINTS.CE_CLEARING.DRAFT_DOWNLOAD(filename);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Tải file bản nháp thất bại (${res.status}): ${res.statusText}`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Lấy cấu hình đường dẫn thống kê CE
   */
  async getLotConfig(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CE_CLEARING.CONFIG,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lưu cấu hình đường dẫn thống kê CE
   */
  async saveLotConfig(config: Record<string, any>, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CE_CLEARING.CONFIG,
      {
        method: 'PUT',
        body: JSON.stringify(config),
      },
      token,
    );
  },

  /**
   * Lấy danh sách lịch sử thực thi thống kê CoreEX gần nhất
   */
  async getLotRunHistory(
    params?: { date?: string; limit?: number },
    token?: string | null,
  ): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const endpoint = API_ENDPOINTS.CE_CLEARING.RUN_HISTORY(qs);
    return requestJson<any[]>(endpoint, { method: 'GET' }, token);
  },

  /**
   * Lấy bản ghi chạy gần nhất cho một ngày phiên hoặc tra cứu active job theo jobId
   */
  async getLatestLotRun(
    date?: string,
    jobId?: string,
    token?: string | null,
  ): Promise<any | null> {
    const endpoint = API_ENDPOINTS.CE_CLEARING.LATEST_RUN(date, jobId);
    return requestJson<any | null>(endpoint, { method: 'GET' }, token);
  },

  /**
   * Kiểm tra thông tin các file sẽ chạy và tính hợp lý của đường dẫn lưu file (CoreEX)
   */
  async inspectPreFlight(
    date: string,
    type: 'LOT' | 'VALUE' | 'ALL' = 'ALL',
    token?: string | null,
  ): Promise<any> {
    const endpoint = API_ENDPOINTS.CE_CLEARING.PREFLIGHT(date, type);
    return requestJson<any>(endpoint, { method: 'GET' }, token);
  },
};

