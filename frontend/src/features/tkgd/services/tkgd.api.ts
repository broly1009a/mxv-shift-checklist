import { API_BASE_URL } from '@/context/AuthContext';
import { CleanRecord, TkgdStats, AccountManifest, TkgdProgressState, TkgdAutoPipelineStatus, RunPipelineOptions } from '../types/tkgd.types';

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

  async getStats(batchDate?: string, token?: string | null, userEmail?: string): Promise<TkgdStats> {
    const url = `${API_BASE_URL}/api/v1/tkgd/stats${batchDate ? `?batchDate=${encodeURIComponent(batchDate)}` : ''}`;
    const res = await fetch(url, { headers: getHeaders(token, userEmail) });
    if (!res.ok) {
      throw new Error('Không thể tải dữ liệu thống kê');
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

  async downloadExcelBlob(token?: string | null, userEmail?: string): Promise<Blob | null> {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/download-excel`, {
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
};


