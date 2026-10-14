import { requestJson } from './client';
import { API_ENDPOINTS } from './endpoints';

export interface LoginResponse {
  access_token: string;
  user: any;
}

export const authApi = {
  /**
   * Đăng nhập thông thường bằng tài khoản nội bộ
   */
  async login(username: string, pass: string): Promise<LoginResponse> {
    return requestJson<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ username, password: pass }),
    });
  },

  /**
   * Đăng nhập SSO (Active Directory / Email)
   */
  async loginSSO(email: string, fullName: string): Promise<LoginResponse> {
    return requestJson<LoginResponse>(API_ENDPOINTS.AUTH.SSO, {
      method: 'POST',
      body: JSON.stringify({ email, fullName }),
    });
  },

  /**
   * Cập nhật thông tin profile / cài đặt người dùng
   */
  async updateProfile(
    payload: { fullName?: string; password?: string; settings?: Record<string, any>; [key: string]: any },
    token?: string | null,
  ): Promise<any> {
    return requestJson<any>(
      API_ENDPOINTS.AUTH.PROFILE,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      token,
    );
  },
  /**
   * Đổi mã code OAuth M365 lấy access token
   */
  async exchangeToken(code: string): Promise<LoginResponse> {
    return requestJson<LoginResponse>(API_ENDPOINTS.AUTH.EXCHANGE_TOKEN, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },
};
