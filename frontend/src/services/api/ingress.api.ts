import { requestJson, requestFormData } from './client';
import { API_ENDPOINTS } from './endpoints';

export interface TriggerRunResponse {
  success: boolean;
  message?: string;
  jobId?: string;
  isReused?: boolean;
}

export interface BackupAuditFileItem {
  name: string;
  size: number;
  expectedSize?: number;
  status: 'valid' | 'missing' | 'empty' | 'warning';
  note?: string;
}

export interface BackupAuditResult {
  source: 'MSYSTEM' | 'CQG' | 'ACM' | 'CCP';
  sessionDate: string;
  isComplete: boolean;
  totalFiles: number;
  validFiles: number;
  missingFiles: number;
  files: BackupAuditFileItem[];
  auditedAt: string;
}

export const ingressApi = {
  /**
   * Kích hoạt bot tải báo cáo M-System (20 báo cáo)
   */
  async triggerMsDownload(
    options: any = {},
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      API_ENDPOINTS.INGRESS.TRIGGER_MS,
      {
        method: 'POST',
        body: JSON.stringify(options),
      },
      token,
    );
  },

  /**
   * Kích hoạt bot tải báo cáo CQG (FR, PS, OP, OD song song 2 TK)
   */
  async triggerCqgDownload(
    options: any = {},
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      API_ENDPOINTS.INGRESS.TRIGGER_CQG,
      {
        method: 'POST',
        body: JSON.stringify(options),
      },
      token,
    );
  },

  /**
   * Kích hoạt bot tải báo cáo ACM Straits CSV
   */
  async triggerAcmDownload(
    options: any = {},
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      API_ENDPOINTS.INGRESS.TRIGGER_ACM,
      {
        method: 'POST',
        body: JSON.stringify(options),
      },
      token,
    );
  },

  /**
   * Kích hoạt bot tải báo cáo CoreCCP (25 file)
   */
  async triggerCcpDownload(
    options: any = {},
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      API_ENDPOINTS.INGRESS.TRIGGER_CCP,
      {
        method: 'POST',
        body: JSON.stringify(options),
      },
      token,
    );
  },

  /**
   * Thẩm định (audit) tệp tin Backup M-System
   */
  async auditMsBackup(sessionDate?: string, token?: string | null): Promise<BackupAuditResult> {
    return requestJson<BackupAuditResult>(
      API_ENDPOINTS.INGRESS.AUDIT_MS,
      {
        method: 'POST',
        body: JSON.stringify({ sessionDate }),
      },
      token,
    );
  },

  /**
   * Thẩm định (audit) tệp tin Backup CQG
   */
  async auditCqgBackup(sessionDate?: string, token?: string | null): Promise<BackupAuditResult> {
    return requestJson<BackupAuditResult>(
      API_ENDPOINTS.INGRESS.AUDIT_CQG,
      {
        method: 'POST',
        body: JSON.stringify({ sessionDate }),
      },
      token,
    );
  },

  /**
   * Thẩm định (audit) tệp tin Backup ACM Straits
   */
  async auditAcmBackup(
    params?: string | { targetDate?: string; sessionDate?: string },
    token?: string | null,
  ): Promise<any> {
    const body = typeof params === 'string' ? { sessionDate: params, targetDate: params } : (params || {});
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.AUDIT_ACM,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      token,
    );
  },

  /**
   * Thẩm định (audit) tệp tin Backup CCP
   */
  async auditCcpBackup(
    params?: string | { targetDate?: string; sessionDate?: string },
    token?: string | null,
  ): Promise<any> {
    const body = typeof params === 'string' ? { sessionDate: params, targetDate: params } : (params || {});
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.AUDIT_CCP,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      token,
    );
  },

  /**
   * Quét hòm thư Outlook M365 và tải file EOD
   */
  async fetchEodEmail(
    targetDate: string,
    token?: string | null,
  ): Promise<{ success: boolean; message?: string }> {
    return requestJson<{ success: boolean; message?: string }>(
      API_ENDPOINTS.INGRESS.FETCH_EOD_EMAIL,
      {
        method: 'POST',
        body: JSON.stringify({ targetDate }),
      },
      token,
    );
  },
  /**
   * Kích hoạt bot tải báo cáo CoreEX (CE)
   */
  async triggerCeDownload(
    payload: any,
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      API_ENDPOINTS.INGRESS.TRIGGER_CE,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Thẩm định (audit) tệp tin Backup CoreEX (CE)
   */
  async auditCeBackup(
    targetDate?: string,
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.AUDIT_CE,
      {
        method: 'POST',
        body: JSON.stringify({ targetDate }),
      },
      token,
    );
  },

  /**
   * Lấy trạng thái Agent Bot (Chrome, Puppeteer, Task Scheduler)
   */
  async getAgentStatus(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.AGENT_STATUS,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy cấu hình Bot Engine & Scheduler
   */
  async getBotConfig(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.BOT_CONFIG,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lưu cấu hình Bot Engine & Scheduler
   */
  async saveBotConfig(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.BOT_CONFIG,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Kiểm tra kết nối M-System
   */
  async testConnectionMs(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.TEST_CONNECTION_MS,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Kiểm tra kết nối CQG Tổng hợp
   */
  async testConnectionCqg(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.TEST_CONNECTION_CQG,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Kiểm tra kết nối CQG TK1
   */
  async testConnectionCqg1(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.TEST_CONNECTION_CQG1,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Kiểm tra kết nối CQG TK3
   */
  async testConnectionCqg3(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.TEST_CONNECTION_CQG3,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Kiểm tra kết nối ACM
   */
  async testConnectionAcm(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.TEST_CONNECTION_ACM,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Kiểm tra kết nối CCP
   */
  async testConnectionCcp(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.TEST_CONNECTION_CCP,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Kiểm tra kết nối CE
   */
  async testConnectionCe(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.TEST_CONNECTION_CE,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Tải lên các tệp báo cáo hằng ngày vào thư mục bot
   */
  async uploadDailyFiles(formData: FormData, token?: string | null): Promise<any> {
    return requestFormData<any>(
      API_ENDPOINTS.INGRESS.UPLOAD_DAILY_FILES,
      formData,
      token,
    );
  },

  /**
   * Lấy ma trận trạng thái sẵn sàng của các tệp tin theo ngày
   */
  async getReadinessMatrix(date: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.INGRESS.READINESS_MATRIX(date),
      { method: 'GET' },
      token,
    );
  },
};

