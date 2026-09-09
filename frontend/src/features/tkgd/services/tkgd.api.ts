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

  async runReconcile(token?: string | null, userEmail?: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/run`, {
      method: 'POST',
      headers: getHeaders(token, userEmail),
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
};

