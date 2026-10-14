import { requestJson, requestFormData } from './client';
import { API_ENDPOINTS } from './endpoints';

export const ccpStatisticsLegacyApi = {
  /**
   * Lấy cấu hình công cụ thống kê CCP cũ
   */
  async getConfig(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_STATISTICS.CONFIG,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lưu cấu hình công cụ thống kê CCP cũ
   */
  async saveConfig(config: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CCP_STATISTICS.CONFIG,
      {
        method: 'POST',
        body: JSON.stringify(config),
      },
      token,
    );
  },

  /**
   * Xử lý thống kê CCP cũ
   */
  async process(formData: FormData, token?: string | null): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.CCP_STATISTICS.PROCESS,
      formData,
      { method: 'POST' },
      token,
    );
  },
};
