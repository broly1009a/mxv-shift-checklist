import { API_BASE_URL } from '@/context/AuthContext';
import {
  CleanRecord,
  TkgdStats,
  AccountManifest,
  TkgdProgressState,
  TkgdAutoPipelineStatus,
  RunPipelineOptions,
  TkgdAnalyticsSummary,
  TkgdShiftType,
  TkgdTimeRangeType,
  ExtractionLogItem,
} from '../types/tkgd.types';

function getHeaders(token?: string | null, userEmail?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'x-user-email': userEmail || 'hieptruong@mxv.vn',
  };
}

export const tkgdApi = {
  async getRecords(
    params: {
      page?: number;
      limit?: number;
      filter?: string;
      search?: string;
      batchDate?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      status?: string;
      moduleFilter?: string;
    },
    token?: string | null,
    userEmail?: string
  ): Promise<{ items: CleanRecord[]; total: number; totalPages: number; stats?: TkgdStats }> {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.limit) qs.append('limit', String(params.limit));
    if (params.filter && params.filter !== 'ALL') qs.append('filter', params.filter);
    if (params.search?.trim()) qs.append('search', params.search.trim());
    if (params.batchDate) qs.append('batchDate', params.batchDate);
    if (params.startDate) qs.append('startDate', params.startDate);
    if (params.endDate) qs.append('endDate', params.endDate);
    if (params.sortBy) qs.append('sortBy', params.sortBy);
    if (params.sortOrder) qs.append('sortOrder', params.sortOrder);
    if (params.status) qs.append('status', params.status);
    if (params.moduleFilter) qs.append('moduleFilter', params.moduleFilter);

    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/records?${qs.toString()}`, {
      headers: getHeaders(token, userEmail),
    });
    if (!res.ok) {
      throw new Error(`Lỗi tải danh sách hồ sơ (HTTP ${res.status})`);
    }
    return res.json();
  },

  async getStats(
    params?: string | { batchDate?: string; startDate?: string; endDate?: string },
    token?: string | null,
    userEmail?: string
  ): Promise<TkgdStats> {
    const qs = new URLSearchParams();
    if (typeof params === 'string') {
      if (params) qs.append('batchDate', params);
    } else if (params) {
      if (params.batchDate) qs.append('batchDate', params.batchDate);
      if (params.startDate) qs.append('startDate', params.startDate);
      if (params.endDate) qs.append('endDate', params.endDate);
    }
    const url = `${API_BASE_URL}/api/v1/tkgd/stats${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetch(url, { headers: getHeaders(token, userEmail) });
    if (!res.ok) {
      throw new Error('Không thể tải dữ liệu thống kê');
    }
    return res.json();
  },

  async getAnalyticsSummary(
    params: {
      batchDate?: string;
      shift?: TkgdShiftType;
      range?: TkgdTimeRangeType;
    },
    token?: string | null,
    userEmail?: string
  ): Promise<{ success: boolean; data: TkgdAnalyticsSummary }> {
    const qs = new URLSearchParams();
    if (params.batchDate) qs.append('batchDate', params.batchDate);
    if (params.shift) qs.append('shift', params.shift);
    if (params.range) qs.append('range', params.range);

    const url = `${API_BASE_URL}/api/v1/tkgd/analytics/summary?${qs.toString()}`;
    const res = await fetch(url, { headers: getHeaders(token, userEmail) });
    if (!res.ok) {
      throw new Error('Không thể tải báo cáo phân tích thống kê');
    }
    return res.json();
  },

  async syncMail(batchDate?: string, token?: string | null, userEmail?: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/sync-mail`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify({ batchDate }),
    });
    return res.json();
  },

  async syncMSystem(
    payload: { investorCode?: string; downloadImages?: boolean; batchDate?: string },
    token?: string | null,
    userEmail?: string
  ) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/sync-msystem`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async reparseAccount(
    payload: { recordId?: string; accountCode?: string; batchDate?: string },
    token?: string | null,
    userEmail?: string
  ) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/reparse-account`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async runPipelineAll(
    payload: RunPipelineOptions,
    token?: string | null,
    userEmail?: string
  ) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/run-pipeline-all`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async runReconcile(batchDate?: string, token?: string | null, userEmail?: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/run`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify({ batchDate }),
    });
    return res.json();
  },

  async downloadExcelBlob(
    token?: string | null,
    userEmail?: string,
    params?:
      | string
      | {
          batchDate?: string;
          startDate?: string;
          endDate?: string;
          filter?: string;
          search?: string;
        },
  ): Promise<Blob | null> {
    const qs = new URLSearchParams();
    if (typeof params === 'string') {
      if (params.trim()) qs.append('batchDate', params.trim());
    } else if (params) {
      if (params.batchDate?.trim()) qs.append('batchDate', params.batchDate.trim());
      if (params.startDate?.trim()) qs.append('startDate', params.startDate.trim());
      if (params.endDate?.trim()) qs.append('endDate', params.endDate.trim());
      if (params.filter && params.filter !== 'ALL') qs.append('filter', params.filter.trim());
      if (params.search?.trim()) qs.append('search', params.search.trim());
    }
    const url = `${API_BASE_URL}/api/v1/tkgd/download-excel${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'x-user-email': userEmail || 'hieptruong@mxv.vn',
      },
    });
    if (!res.ok) return null;
    return res.blob();
  },

  async getAccountManifest(
    accountCode: string,
    batchDate?: string,
    token?: string | null,
    userEmail?: string
  ): Promise<AccountManifest | null> {
    const url = `${API_BASE_URL}/api/v1/tkgd/files/manifest/${encodeURIComponent(accountCode)}${
      batchDate ? `?batchDate=${encodeURIComponent(batchDate)}` : ''
    }`;
    const res = await fetch(url, { headers: getHeaders(token, userEmail) });
    if (!res.ok) return null;
    return res.json();
  },

  async getAllExtractionLogs(
    params: {
      page?: number;
      limit?: number;
      stage?: string;
      status?: string;
      search?: string;
      batchDate?: string;
    },
    token?: string | null,
    userEmail?: string
  ): Promise<{ data: ExtractionLogItem[]; total: number; page: number; pages: number }> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', String(params.page));
    if (params.limit) q.append('limit', String(params.limit));
    if (params.stage && params.stage !== 'ALL') q.append('stage', params.stage);
    if (params.status && params.status !== 'ALL') q.append('status', params.status);
    if (params.search && params.search.trim()) q.append('search', params.search.trim());
    if (params.batchDate && params.batchDate.trim()) q.append('batchDate', params.batchDate.trim());

    const url = `${API_BASE_URL}/api/v1/tkgd/logs/extraction?${q.toString()}`;
    const res = await fetch(url, { headers: getHeaders(token, userEmail) });
    if (!res.ok) return { data: [], total: 0, page: 1, pages: 1 };
    return res.json();
  },

  async getExtractionLogs(
    accountCode: string,
    batchDate?: string,
    token?: string | null,
    userEmail?: string
  ): Promise<ExtractionLogItem[]> {
    const url = `${API_BASE_URL}/api/v1/tkgd/logs/extraction/${encodeURIComponent(accountCode)}${
      batchDate ? `?batchDate=${encodeURIComponent(batchDate)}` : ''
    }`;
    const res = await fetch(url, { headers: getHeaders(token, userEmail) });
    if (!res.ok) return [];
    return res.json();
  },

  async manualApprove(
    recordId: string,
    reason?: string,
    token?: string | null,
    userEmail?: string
  ) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/records/${encodeURIComponent(recordId)}/manual-approve`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể phê duyệt hồ sơ bằng tay');
    }
    return res.json();
  },

  async revertApprove(
    recordId: string,
    token?: string | null,
    userEmail?: string
  ) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/records/${encodeURIComponent(recordId)}/revert-approve`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể hủy phê duyệt');
    }
    return res.json();
  },

  async reEvaluateRecord(
    recordId: string,
    token?: string | null,
    userEmail?: string
  ) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/records/${encodeURIComponent(recordId)}/re-evaluate`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể tái thẩm định hồ sơ');
    }
    return res.json();
  },

  async getProgress(
    token?: string | null,
    userEmail?: string
  ): Promise<TkgdProgressState> {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/progress`, {
      headers: getHeaders(token, userEmail),
    });
    if (!res.ok) {
      return {
        isProcessing: false,
        taskType: 'IDLE',
        current: 0,
        total: 0,
        percent: 0,
        stage: '',
        updatedAt: Date.now(),
      };
    }
    return res.json();
  },

  async getAutoPipelineStatus(
    token?: string | null,
    userEmail?: string
  ): Promise<TkgdAutoPipelineStatus> {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/auto-pipeline/status`, {
      headers: getHeaders(token, userEmail),
    });
    if (!res.ok) {
      return {
        enabled: false,
        isRunning: false,
        lastRunTime: 0,
        lastProcessedCount: 0,
        intervalMinutes: 5,
        nextRunTime: 0,
      };
    }
    return res.json();
  },

  async toggleAutoPipeline(
    enabled?: boolean,
    token?: string | null,
    userEmail?: string
  ): Promise<{ success: boolean; enabled: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/auto-pipeline/toggle`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể chuyển đổi trạng thái Tự Động');
    }
    return res.json();
  },

  async runBackfill(
    params: { fromDate?: string; toDate?: string },
    token?: string | null,
    userEmail?: string
  ) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/auto-pipeline/backfill`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể kích hoạt quét vét lịch sử');
    }
    return res.json();
  },

  async getActivityLogs(
    params?: {
      page?: number;
      limit?: number;
      action?: string;
      status?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
    token?: string | null,
    userEmail?: string
  ): Promise<{ data: any[]; total: number; page: number; pages: number }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.append('page', String(params.page));
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.action && params.action !== 'ALL') qs.append('action', params.action);
    if (params?.status && params.status !== 'ALL') qs.append('status', params.status);
    if (params?.search) qs.append('search', params.search);
    if (params?.startDate) qs.append('startDate', params.startDate);
    if (params?.endDate) qs.append('endDate', params.endDate);

    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/logs?${qs.toString()}`, {
      headers: getHeaders(token, userEmail),
    });
    if (!res.ok) {
      throw new Error('Không thể tải nhật ký tác vụ TKGD');
    }
    return res.json();
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEV REMEDIATION (CÔNG CỤ KỸ THUẬT KHẮC PHỤC BUG)
  // ══════════════════════════════════════════════════════════════════════════

  async startDevRemediation(
    payload: {
      accountCodes?: string[];
      targetAllAnomalies?: boolean;
      options?: {
        crawlMSystem?: boolean;
        reparseOcr?: boolean;
        reconcileRules?: boolean;
        batchDate?: string;
      };
    },
    token?: string | null,
    userEmail?: string,
  ): Promise<{ sessionId: string }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/dev/remediate/start`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể khởi động phiên tái xử lý');
    }
    return res.json();
  },

  async getDevRemediationStatus(
    sessionId: string,
    token?: string | null,
    userEmail?: string,
  ) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/dev/remediate/status/${encodeURIComponent(sessionId)}`, {
      headers: getHeaders(token, userEmail),
    });
    if (!res.ok) {
      throw new Error('Không thể lấy trạng thái phiên tái xử lý');
    }
    return res.json();
  },

  async downloadAnomaliesExcel(batchDate?: string, token?: string | null, userEmail?: string) {
    const url = `${API_BASE_URL}/api/v1/tkgd/dev/export-anomalies${batchDate ? `?batchDate=${encodeURIComponent(batchDate)}` : ''}`;
    const res = await fetch(url, { headers: getHeaders(token, userEmail) });
    if (!res.ok) {
      throw new Error('Không thể xuất file danh sách tài khoản lỗi');
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `TKGD_Danh_Sach_Loi_${batchDate || 'All'}_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
  },

  async bulkReEvaluate(recordIds: string[], token?: string | null, userEmail?: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/bulk/re-evaluate`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify({ recordIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Lỗi tái thẩm định hàng loạt');
    }
    return res.json();
  },

  async bulkSyncMSystem(accountCodes: string[], token?: string | null, userEmail?: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/bulk/sync-msystem`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify({ accountCodes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Lỗi cào lại M-System hàng loạt');
    }
    return res.json();
  },

  async bulkReRunE2E(
    recordIds: string[],
    options?: { reparseOcr?: boolean; resyncMSystem?: boolean; reEvaluate?: boolean },
    token?: string | null,
    userEmail?: string,
  ) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/bulk/re-run-e2e`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
      body: JSON.stringify({ recordIds, options }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Lỗi chạy lại E2E hàng loạt');
    }
    return res.json();
  },
};


