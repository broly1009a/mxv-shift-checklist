import { requestJson } from './client';
import { API_ENDPOINTS } from './endpoints';

export const dashboardApi = {
  /**
   * Lấy trạng thái hệ thống tổng thể (System Status)
   */
  async getSystemStatus(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.SYSTEM_STATUS,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy tóm tắt thống kê theo ngày (Summary)
   */
  async getSummary(date: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.SUMMARY(date),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy danh sách hoạt động gần nhất (Activity stream)
   */
  async getActivity(date: string, limit = 10, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.ACTIVITY(date, limit),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Đếm số lượng thông báo chưa đọc
   */
  async getUnreadCount(
    date: string,
    lastReadTime: string,
    lastClearedTime: string,
    token?: string | null,
  ): Promise<{ count: number }> {
    return requestJson<{ count: number }>(
      API_ENDPOINTS.DASHBOARD.UNREAD_COUNT(date, lastReadTime, lastClearedTime),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy danh sách jobs theo ngày và trạng thái
   */
  async getJobs(
    arg1?: string | { date?: string; status?: string },
    arg2?: string | null,
    arg3?: string | null,
  ): Promise<any> {
    let date: string | undefined;
    let status: string | undefined;
    let token: string | null | undefined;
    if (typeof arg1 === 'object' && arg1 !== null) {
      date = arg1.date;
      status = arg1.status;
      token = arg2;
    } else {
      date = arg1;
      status = arg2 ?? undefined;
      token = arg3;
    }
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.JOBS(date, status),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Khởi tạo ca trực mới
   */
  async initializeShift(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.INITIALIZE_SHIFT,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  /**
   * Tự động sinh danh sách công việc ca trực
   */
  async generateJobs(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.GENERATE_JOBS,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  /**
   * Lấy danh sách yêu cầu thay đổi ký quỹ
   */
  async getMarginChangeRequests(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.MARGIN_CHANGE_REQUESTS,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Quét quyết định thay đổi ký quỹ
   */
  async scanMarginDecision(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.MARGIN_CHANGE_SCAN_DECISION,
      { method: 'POST' },
      token,
    );
  },

  /**
   * Tạo yêu cầu thay đổi ký quỹ mới
   */
  async createMarginChangeRequest(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.MARGIN_CHANGE_REQUESTS,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  /**
   * Phê duyệt yêu cầu thay đổi ký quỹ
   */
  async approveMarginChangeRequest(id: string, payload?: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.MARGIN_CHANGE_APPROVE(id),
      { method: 'PATCH', body: payload ? JSON.stringify(payload) : undefined },
      token,
    );
  },

  /**
   * Từ chối yêu cầu thay đổi ký quỹ
   */
  async rejectMarginChangeRequest(id: string, payload?: any, token?: string | null): Promise<any> {
    const body = typeof payload === 'string' ? { reason: payload } : payload;
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.MARGIN_CHANGE_REJECT(id),
      { method: 'PATCH', body: body ? JSON.stringify(body) : undefined },
      token,
    );
  },

  /**
   * Lấy danh sách sự cố đang chờ xử lý
   */
  async getPendingIncidents(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.DASHBOARD.PENDING_INCIDENTS,
      { method: 'GET' },
      token,
    );
  },
};
