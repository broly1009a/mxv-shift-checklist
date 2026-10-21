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
   * Ghi trực tiếp Số Lot CE vào file lũy kế (hỗ trợ cờ forceOverwrite và exportDraft)
   */
  async runLotStatistics(
    date: string,
    token?: string | null,
    options?: { forceOverwrite?: boolean; exportDraft?: boolean },
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CE_CLEARING.LOT_RUN,
      {
        method: 'POST',
        body: JSON.stringify({
          date,
          forceOverwrite: options?.forceOverwrite,
          exportDraft: options?.exportDraft,
        }),
      },
      token,
    );
  },

  /**
   * Ghi trực tiếp GTGD CE vào file lũy kế (hỗ trợ cờ forceOverwrite và exportDraft)
   */
  async runValueStatistics(
    date: string,
    token?: string | null,
    options?: { forceOverwrite?: boolean; exportDraft?: boolean },
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CE_CLEARING.VALUE_RUN,
      {
        method: 'POST',
        body: JSON.stringify({
          date,
          forceOverwrite: options?.forceOverwrite,
          exportDraft: options?.exportDraft,
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
};
