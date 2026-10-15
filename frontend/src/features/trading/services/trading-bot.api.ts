import { requestJson } from './api-client';
import {
  BotJobItem,
  BackupAuditResult,
  TriggerRunResponse,
} from '../types/trading.types';

export const tradingBotApi = {
  /**
   * Lấy danh sách jobs trong hàng đợi bot
   */
  async getJobs(
    params: { jobTypes?: string; limit?: number; status?: string },
    token?: string | null,
  ): Promise<BotJobItem[]> {
    return requestJson<BotJobItem[]>(
      '/api/v1/bot-engine/jobs',
      {
        method: 'GET',
        params: {
          jobTypes: params.jobTypes,
          limit: params.limit,
          status: params.status,
        },
      },
      token,
    );
  },

  /**
   * Truy vấn trạng thái chi tiết của một Job cụ thể
   */
  async getJobById(jobId: string, token?: string | null): Promise<BotJobItem> {
    return requestJson<BotJobItem>(
      `/api/v1/bot-engine/jobs/${encodeURIComponent(jobId)}`,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Huỷ / dừng khẩn cấp một Job đang thực thi
   */
  async cancelJob(
    jobId: string,
    token?: string | null,
  ): Promise<{ success: boolean; message: string }> {
    return requestJson<{ success: boolean; message: string }>(
      `/api/v1/bot-engine/jobs/${encodeURIComponent(jobId)}/cancel`,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Kích hoạt bot RPA M-System tải báo cáo
   */
  async triggerMsDownload(
    options: { sessionDate?: string; reports?: string[] },
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      '/api/v1/bot-engine/trigger-download',
      {
        method: 'POST',
        body: JSON.stringify(options),
      },
      token,
    );
  },

  /**
   * Kích hoạt bot tải báo cáo CQG (song song 2 tài khoản)
   */
  async triggerCqgDownload(
    options: { sessionDate?: string; accounts?: string[] },
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      '/api/v1/bot-engine/trigger-cqg-download',
      {
        method: 'POST',
        body: JSON.stringify(options),
      },
      token,
    );
  },

  /**
   * Kích hoạt bot tải báo cáo ACM Straits Financial (SFTP)
   */
  async triggerAcmDownload(
    options: { sessionDate?: string },
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      '/api/v1/bot-engine/trigger-acm-download',
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
    options: { sessionDate?: string },
    token?: string | null,
  ): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      '/api/v1/bot-engine/trigger-ccp-download',
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
  async auditMsBackup(
    sessionDate?: string,
    token?: string | null,
  ): Promise<BackupAuditResult> {
    return requestJson<BackupAuditResult>(
      '/api/v1/bot-engine/audit-ms-backup',
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
  async auditCqgBackup(
    sessionDate?: string,
    token?: string | null,
  ): Promise<BackupAuditResult> {
    return requestJson<BackupAuditResult>(
      '/api/v1/bot-engine/audit-cqg-backup',
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
    sessionDate?: string,
    token?: string | null,
  ): Promise<BackupAuditResult> {
    return requestJson<BackupAuditResult>(
      '/api/v1/bot-engine/audit-acm-backup',
      {
        method: 'POST',
        body: JSON.stringify({ sessionDate }),
      },
      token,
    );
  },

  /**
   * Thẩm định (audit) tệp tin Backup CCP
   */
  async auditCcpBackup(
    sessionDate?: string,
    token?: string | null,
  ): Promise<BackupAuditResult> {
    return requestJson<BackupAuditResult>(
      '/api/v1/bot-engine/audit-ccp-backup',
      {
        method: 'POST',
        body: JSON.stringify({ sessionDate }),
      },
      token,
    );
  },

  /**
   * Lưu cấu hình hệ thống
   */
  async saveSystemSetting(
    key: string,
    value: string,
    token?: string | null,
  ): Promise<{ success: boolean }> {
    return requestJson<{ success: boolean }>(
      '/api/v1/system-settings',
      {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      },
      token,
    );
  },

  /**
   * Đọc cấu hình hệ thống
   */
  async getSystemSettings(token?: string | null): Promise<Record<string, any>> {
    return requestJson<Record<string, any>>(
      '/api/v1/system-settings',
      { method: 'GET' },
      token,
    );
  },
};
