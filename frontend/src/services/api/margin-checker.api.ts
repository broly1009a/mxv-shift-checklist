import { requestJson, requestFormData } from './client';
import { API_ENDPOINTS } from './endpoints';

export const marginCheckerApi = {
  /**
   * Lấy cấu hình kiểm tra ký quỹ
   */
  async getConfig(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.MARGIN_CHECKER.CONFIG,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lưu cấu hình kiểm tra ký quỹ
   */
  async saveConfig(config: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.MARGIN_CHECKER.CONFIG,
      {
        method: 'POST',
        body: JSON.stringify(config),
      },
      token,
    );
  },

  /**
   * Chạy kiểm tra ký quỹ lệnh mở (Check Margin)
   */
  async checkMargin(formData: FormData, token?: string | null): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.MARGIN_CHECKER.CHECK_MARGIN,
      formData,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Chạy kiểm tra thay đổi ký quỹ từ Sở (Check Change)
   */
  async checkChange(formData: FormData, token?: string | null): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.MARGIN_CHECKER.CHECK_CHANGE,
      formData,
      { method: 'POST' },
      token,
    );
  },
};
