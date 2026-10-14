import { requestJson, requestFormData, downloadBlob } from './client';
import { API_ENDPOINTS } from './endpoints';

export const tradingReportApi = {
  /**
   * Lấy danh sách tỷ giá trading report
   */
  async getExchangeRates(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_REPORT.EXCHANGE_RATES,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Thêm mới tỷ giá trading report
   */
  async createExchangeRate(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_REPORT.EXCHANGE_RATES,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Cập nhật tỷ giá trading report
   */
  async updateExchangeRate(id: string, payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_REPORT.EXCHANGE_RATE_DETAIL(id),
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Xóa tỷ giá trading report
   */
  async deleteExchangeRate(id: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_REPORT.EXCHANGE_RATE_DETAIL(id),
      { method: 'DELETE' },
      token,
    );
  },

  /**
   * Import tỷ giá từ file Excel
   */
  async importExchangeRates(formData: FormData, token?: string | null): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.TRADING_REPORT.IMPORT_EXCHANGE_RATES,
      formData,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Lấy cấu hình trading report
   */
  async getConfig(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_REPORT.CONFIG,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lưu cấu hình trading report
   */
  async saveConfig(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.TRADING_REPORT.CONFIG,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Xử lý và tải báo cáo tháng (Excel)
   */
  async processMonth(formData: FormData, filename: string, token?: string | null): Promise<void> {
    return downloadBlob(
      API_ENDPOINTS.TRADING_REPORT.PROCESS_MONTH,
      filename,
      {
        method: 'POST',
        body: formData,
      },
      token,
    );
  },

  /**
   * Xử lý và tải báo cáo quý (Excel)
   */
  async processQuarter(formData: FormData, filename: string, token?: string | null): Promise<void> {
    return downloadBlob(
      API_ENDPOINTS.TRADING_REPORT.PROCESS_QUARTER,
      filename,
      {
        method: 'POST',
        body: formData,
      },
      token,
    );
  },

  /**
   * Xử lý và tải báo cáo TTTT (Excel)
   */
  async processTttt(formData: FormData, filename: string, token?: string | null): Promise<void> {
    return downloadBlob(
      API_ENDPOINTS.TRADING_REPORT.PROCESS_TTTT,
      filename,
      {
        method: 'POST',
        body: formData,
      },
      token,
    );
  },
};
