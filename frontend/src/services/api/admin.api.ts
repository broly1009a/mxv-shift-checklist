import { requestJson } from './client';
import { API_ENDPOINTS } from './endpoints';

export const adminApi = {
  /**
   * Đọc toàn bộ cấu hình hệ thống
   */
  async getSystemSettings(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.SYSTEM_SETTINGS,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Đọc một mục cấu hình theo key
   */
  async getSystemSetting(key: string, token?: string | null): Promise<{ key: string; value: string }> {
    return requestJson<{ key: string; value: string }>(
      API_ENDPOINTS.ADMIN.SYSTEM_SETTING_DETAIL(key),
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lưu hoặc cập nhật một mục cấu hình
   */
  async saveSystemSetting(
    keyOrPayload: string | { key: string; value: string },
    valueOrToken?: string | null,
    maybeToken?: string | null,
  ): Promise<{ success: boolean }> {
    let key: string;
    let value: string;
    let token: string | null | undefined;

    if (typeof keyOrPayload === 'object' && keyOrPayload !== null) {
      key = keyOrPayload.key;
      value = keyOrPayload.value;
      token = valueOrToken;
    } else {
      key = keyOrPayload;
      value = valueOrToken as string;
      token = maybeToken;
    }

    return requestJson<{ success: boolean }>(
      API_ENDPOINTS.ADMIN.SYSTEM_SETTINGS,
      {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      },
      token,
    );
  },

  /**
   * Kiểm tra tính hợp lệ của đường dẫn lưu trữ trên máy chủ
   */
  async verifyStoragePath(
    pathOrParams: string | { path: string; targetType?: string },
    token?: string | null,
  ): Promise<any> {
    const body = typeof pathOrParams === 'string' ? { path: pathOrParams } : pathOrParams;
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.VERIFY_STORAGE_PATH,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      token,
    );
  },

  // ─── USERS ──────────────────────────────────────────────────────────────────
  async getUsers(params?: Record<string, any>, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.USERS,
      { method: 'GET', params },
      token,
    );
  },

  async createUser(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.USERS,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  async updateUser(id: string, payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.USER_DETAIL(id),
      { method: 'PUT', body: JSON.stringify(payload) },
      token,
    );
  },

  async deleteUser(id: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.USER_DETAIL(id),
      { method: 'DELETE' },
      token,
    );
  },

  // ─── DEPARTMENTS ────────────────────────────────────────────────────────────
  async getDepartments(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.DEPARTMENTS,
      { method: 'GET' },
      token,
    );
  },

  async createDepartment(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.DEPARTMENTS,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  async updateDepartment(id: string, payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.DEPARTMENT_DETAIL(id),
      { method: 'PUT', body: JSON.stringify(payload) },
      token,
    );
  },

  async deleteDepartment(id: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.DEPARTMENT_DETAIL(id),
      { method: 'DELETE' },
      token,
    );
  },

  // ─── SHIFT SLOTS ────────────────────────────────────────────────────────────
  async getShiftSlots(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.SHIFT_SLOTS,
      { method: 'GET' },
      token,
    );
  },

  async createShiftSlot(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.SHIFT_SLOTS,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  async updateShiftSlot(id: string, payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.SHIFT_SLOT_DETAIL(id),
      { method: 'PUT', body: JSON.stringify(payload) },
      token,
    );
  },

  async deleteShiftSlot(id: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.SHIFT_SLOT_DETAIL(id),
      { method: 'DELETE' },
      token,
    );
  },

  // ─── TEMPLATES ──────────────────────────────────────────────────────────────
  async getTemplates(
    paramsOrDeptId?: Record<string, any> | string | null,
    token?: string | null,
  ): Promise<any> {
    const params = typeof paramsOrDeptId === 'string'
      ? { departmentId: paramsOrDeptId }
      : paramsOrDeptId || undefined;
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.TEMPLATES,
      { method: 'GET', params },
      token,
    );
  },

  async createTemplate(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.TEMPLATES,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  async updateTemplate(id: string, payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.TEMPLATE_DETAIL(id),
      { method: 'PUT', body: JSON.stringify(payload) },
      token,
    );
  },

  async deleteTemplate(id: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.TEMPLATE_DETAIL(id),
      { method: 'DELETE' },
      token,
    );
  },

  // ─── PERMISSIONS & ROLES ────────────────────────────────────────────────────
  async getPermissions(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.PERMISSIONS,
      { method: 'GET' },
      token,
    );
  },

  async getRoles(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.ROLES,
      { method: 'GET' },
      token,
    );
  },

  async updateRolePermissions(code: string, permissions: string[], token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.ROLE_PERMISSIONS(code),
      { method: 'PUT', body: JSON.stringify({ permissions }) },
      token,
    );
  },

  async getRoleAuditLogs(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.ROLE_AUDIT_LOGS,
      { method: 'GET' },
      token,
    );
  },

  // ─── NOTIFICATIONS ──────────────────────────────────────────────────────────
  async getNotificationChannels(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.NOTIFICATION_CHANNELS,
      { method: 'GET' },
      token,
    );
  },

  async createNotificationChannel(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.NOTIFICATION_CHANNELS,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  async updateNotificationChannel(id: string, payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.NOTIFICATION_CHANNEL_DETAIL(id),
      { method: 'PUT', body: JSON.stringify(payload) },
      token,
    );
  },

  async deleteNotificationChannel(id: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.NOTIFICATION_CHANNEL_DETAIL(id),
      { method: 'DELETE' },
      token,
    );
  },

  async getNotificationRules(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.NOTIFICATION_RULES,
      { method: 'GET' },
      token,
    );
  },

  async createNotificationRule(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.NOTIFICATION_RULES,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  async updateNotificationRule(id: string, payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.NOTIFICATION_RULE_DETAIL(id),
      { method: 'PUT', body: JSON.stringify(payload) },
      token,
    );
  },

  async deleteNotificationRule(id: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.NOTIFICATION_RULE_DETAIL(id),
      { method: 'DELETE' },
      token,
    );
  },

  async getNotificationLogs(limit = 50, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.NOTIFICATION_LOGS,
      { method: 'GET', params: { limit } },
      token,
    );
  },

  async testNotification(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.NOTIFICATION_TEST,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  // ─── WORKING CALENDAR ───────────────────────────────────────────────────────
  async getWorkingCalendar(token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.WORKING_CALENDAR,
      { method: 'GET' },
      token,
    );
  },

  async saveWorkingCalendar(payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.WORKING_CALENDAR,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  async updateWorkingCalendar(date: string, payload: any, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.WORKING_CALENDAR_DETAIL(date),
      { method: 'PUT', body: JSON.stringify(payload) },
      token,
    );
  },

  async deleteWorkingCalendar(date: string, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.WORKING_CALENDAR_DETAIL(date),
      { method: 'DELETE' },
      token,
    );
  },

  // ─── UPLOAD BACKUP ──────────────────────────────────────────────────────────
  async uploadBackup(formData: FormData, token?: string | null): Promise<any> {
    const { requestFormData } = await import('./client');
    return requestFormData<any>(
      API_ENDPOINTS.ADMIN.UPLOAD_BACKUP,
      formData,
      {},
      token,
    );
  },

  // ─── ACTIVITY LOGS ──────────────────────────────────────────────────────────
  async getActivityLogs(params?: Record<string, any>, token?: string | null): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.ADMIN.ACTIVITY_LOGS,
      { method: 'GET', params },
      token,
    );
  },
};
