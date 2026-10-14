import { requestJson, requestFormData, downloadBlob } from './client';
import { API_ENDPOINTS } from './endpoints';
import {
  ShiftLog,
  AuditLog,
  Incident,
  CloseShiftPayload,
  AddTaskPayload,
  UpdateItemStatusPayload,
  ResolveIncidentPayload,
  GlobalSearchResult,
} from './types/checklist.types';


export * from './types/checklist.types';

export interface BotJobItem {
  _id: string;
  jobType: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string;
  progress?: number;
  payload?: any;
  result?: any;
  error?: string;
  logs?: any[];
  [key: string]: any;
  createdAt: string;
  updatedAt: string;
}

export const checklistHubApi = {
  /**
   * Lấy danh sách ca trực đang hoạt động (Active shifts)
   */
  async getActiveShifts(deptId?: string | null, token?: string | null): Promise<ShiftLog[]> {
    const params = deptId ? { departmentId: deptId } : undefined;
    return requestJson<ShiftLog[]>(
      API_ENDPOINTS.CHECKLIST_HUB.ACTIVE_SHIFTS,
      { params },
      token,
    );
  },

  /**
   * Lấy chi tiết một ca trực theo ID
   */
  async getShiftDetail(id: string, token?: string | null): Promise<ShiftLog> {
    return requestJson<ShiftLog>(
      API_ENDPOINTS.CHECKLIST_HUB.SHIFT_DETAIL(id),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy nhật ký thao tác (Audit logs) của ca trực
   */
  async getShiftAuditLogs(id: string, token?: string | null): Promise<AuditLog[]> {
    return requestJson<AuditLog[]>(
      API_ENDPOINTS.CHECKLIST_HUB.SHIFT_AUDIT(id),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Đóng ca trực
   */
  async closeShift(payload: CloseShiftPayload | any, token?: string | null): Promise<ShiftLog> {
    return requestJson<ShiftLog>(
      API_ENDPOINTS.CHECKLIST_HUB.SHIFT_CLOSE,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },


  /**
   * Thêm tác vụ thủ công vào ca trực
   */
  async addTask(shiftId: string, payload: AddTaskPayload | any, token?: string | null): Promise<ShiftLog> {
    return requestJson<ShiftLog>(
      API_ENDPOINTS.CHECKLIST_HUB.SHIFT_ADD_TASK(shiftId),
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Cập nhật trạng thái một mục kiểm tra trong ca
   */
  async updateItemStatus(payload: UpdateItemStatusPayload | any, token?: string | null): Promise<ShiftLog> {
    return requestJson<ShiftLog>(
      API_ENDPOINTS.CHECKLIST_HUB.SHIFT_UPDATE_STATUS,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Tìm kiếm ca trực toàn cục
   */
  async searchShifts(query: string, token?: string | null): Promise<GlobalSearchResult> {
    return requestJson<GlobalSearchResult>(
      API_ENDPOINTS.CHECKLIST_HUB.SHIFT_SEARCH(query),
      { method: 'GET' },
      token,
    );
  },


  /**
   * Lấy danh sách sự cố của ca trực
   */
  async getIncidents(shiftId: string, token?: string | null): Promise<Incident[]> {
    return requestJson<Incident[]>(
      API_ENDPOINTS.CHECKLIST_HUB.INCIDENTS(shiftId),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Xử lý đóng / giải quyết sự cố
   */
  async resolveIncident(incidentId: string, payload: ResolveIncidentPayload | any, token?: string | null): Promise<Incident> {
    return requestJson<Incident>(
      API_ENDPOINTS.CHECKLIST_HUB.INCIDENT_RESOLVE(incidentId),
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token,
    );
  },


  /**
   * Xuất báo cáo sự cố (Excel/Word)
   */
  async exportIncident(incidentId: string, filename = 'incident_report.docx', token?: string | null): Promise<void> {
    return downloadBlob(
      API_ENDPOINTS.CHECKLIST_HUB.INCIDENT_EXPORT(incidentId),
      filename,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy danh sách tác vụ Bot (Jobs)
   */
  async getJobs(
    params: { jobTypes?: string; shiftLogId?: string; taskId?: string; limit?: number; [key: string]: any } = {},
    token?: string | null,
  ): Promise<BotJobItem[]> {
    return requestJson<BotJobItem[]>(
      API_ENDPOINTS.CHECKLIST_HUB.JOBS,
      { params },
      token,
    );
  },

  /**
   * Lấy chi tiết tác vụ Bot theo ID
   */
  async getJobDetail(jobId: string, token?: string | null): Promise<BotJobItem> {
    return requestJson<BotJobItem>(
      API_ENDPOINTS.CHECKLIST_HUB.JOB_DETAIL(jobId),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Hủy tác vụ Bot đang chờ hoặc đang chạy
   */
  async cancelJob(
    jobId: string,
    reasonOrToken?: string | null,
    token?: string | null,
  ): Promise<{ success: boolean; message?: string }> {
    let actualReason = 'Hủy thủ công';
    let actualToken = token;
    if (token === undefined) {
      actualToken = reasonOrToken;
    } else {
      if (reasonOrToken) actualReason = reasonOrToken;
    }

    return requestJson<{ success: boolean; message?: string }>(
      API_ENDPOINTS.CHECKLIST_HUB.JOB_CANCEL(jobId),
      {
        method: 'POST',
        body: JSON.stringify({ reason: actualReason }),
      },
      actualToken,
    );
  },

  /**
   * Gửi mã CAPTCHA giải thủ công cho bot
   */
  async submitCaptcha(jobId: string, captchaText: string, token?: string | null): Promise<{ success: boolean }> {
    return requestJson<{ success: boolean }>(
      API_ENDPOINTS.CHECKLIST_HUB.JOB_CAPTCHA(jobId),
      {
        method: 'POST',
        body: JSON.stringify({ captcha: captchaText, captchaText }),
      },
      token,
    );
  },

  /**
   * Tải tệp kết quả ZIP của bot
   */
  async downloadJobZip(jobId: string, filename = 'bot_artifacts.zip', token?: string | null): Promise<void> {
    return downloadBlob(
      API_ENDPOINTS.CHECKLIST_HUB.JOB_DOWNLOAD_ZIP(jobId),
      filename,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Kích hoạt bot kiểm tra Email xác nhận
   */
  async triggerEmail(shiftId: string, taskId: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.TRIGGER_EMAIL(shiftId, taskId),
      { method: 'POST' },
      token,
    );
  },

  /**
   * Kích hoạt bot kiểm tra OMS
   */
  async triggerOms(shiftId: string, taskId: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.TRIGGER_OMS(shiftId, taskId),
      { method: 'POST' },
      token,
    );
  },

  /**
   * Lấy báo cáo GTT
   */
  async getGttReport(date?: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.GTT_REPORT(date),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Kích hoạt kiểm tra GTT
   */
  async runGttCheck(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.GTT_CHECK,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Upload tệp GTT
   */
  async uploadGttFile(payload: { base64: string; filename?: string } | FormData, token?: string | null): Promise<any> {
    if (payload instanceof FormData) {
      return requestFormData<any>(API_ENDPOINTS.CHECKLIST_HUB.GTT_UPLOAD, payload, token);
    }
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.GTT_UPLOAD,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Upload tệp Market CSV
   */
  async uploadMarketCsv(payload: { base64: string; filename?: string } | FormData, token?: string | null): Promise<any> {
    if (payload instanceof FormData) {
      return requestFormData<any>(API_ENDPOINTS.CHECKLIST_HUB.GTT_MARKET_CSV_UPLOAD, payload, token);
    }
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.GTT_MARKET_CSV_UPLOAD,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Upload tệp Commodity
   */
  async uploadCommodity(payload: { base64: string; filename?: string } | FormData, token?: string | null): Promise<any> {
    if (payload instanceof FormData) {
      return requestFormData<any>(API_ENDPOINTS.CHECKLIST_HUB.GTT_COMMODITY_UPLOAD, payload, token);
    }
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.GTT_COMMODITY_UPLOAD,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Đẩy dữ liệu điều chỉnh GTT sang M-System
   */
  async pushGttToMs(payload: any = {}, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.GTT_PUSH_TO_MS,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Xuất file điều chỉnh GTT
   */
  async exportGttCorrection(type: string = 'settlement', filename = 'gtt_correction.xlsx', token?: string | null): Promise<void> {
    return downloadBlob(
      API_ENDPOINTS.CHECKLIST_HUB.GTT_EXPORT_CORRECTION(type),
      filename,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy báo cáo đối soát GTT giữa CE và CCP
   */
  async getCeCcpGttReport(date?: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.CE_CCP_GTT_REPORT(date),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Kích hoạt đối soát GTT CE vs CCP
   */
  async runCeCcpGttCheck(
    payload: { targetDate?: string; filterOpen?: boolean; async?: boolean },
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.RUN_CE_CCP_GTT_CHECK,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Xuất file Excel báo cáo/điều chỉnh GTT CE-CCP
   */
  async exportCeCcpGtt(
    type: 'report' | 'correction',
    filename?: string,
    token?: string | null,
  ): Promise<void> {
    const defaultName =
      type === 'correction' ? 'Dieu_Chinh_GTT_CE_CCP.xlsx' : 'Bao_Cao_CheckGTT_CE_CCP.xlsx';
    return downloadBlob(
      API_ENDPOINTS.CHECKLIST_HUB.EXPORT_CE_CCP_GTT(type),
      filename || defaultName,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Khởi tạo ca trực thủ công từ template
   */
  async initializeShift(
    payload: { templateId: string; shiftDate?: string },
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.SHIFT_INITIALIZE,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Kích hoạt sinh ca tự động theo lịch (Shift jobs generation)
   */
  async generateShiftJobs(
    payload: { date: string },
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.SHIFT_JOBS_GENERATE,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  /**
   * Lấy lịch sử ca trực (Shift History) với bộ lọc và phân trang
   */
  async getShiftHistory(
    params?: Record<string, any>,
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.CHECKLIST_HUB.SHIFT_HISTORY,
      { method: 'GET', params },
      token,
    );
  },
};
