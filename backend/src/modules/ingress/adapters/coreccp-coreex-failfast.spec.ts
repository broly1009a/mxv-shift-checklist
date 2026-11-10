import * as fs from 'fs';
import * as path from 'path';
import { CoreCcpApiAdapter } from './coreccp-api.adapter';
import { CoreExApiAdapter } from './coreex-api.adapter';

describe('CoreCCP & CoreExchange Ingress Adapters (Zero-Hardcode & Fail-Fast Gates)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('CoreCcpApiAdapter', () => {
    it('TC-CCP-01: Ném lỗi Fail-Fast rõ ràng khi không có cấu hình URL CoreCCP (Chống hardcode)', async () => {
      delete process.env.CORECCP_BASE_URL;
      const mockSettingsService: any = {
        getSetting: jest.fn().mockImplementation((key: string, defVal: any) => {
          if (key === 'coreccp_base_url') return '';
          if (key === 'bot_credentials_ccp') return '';
          return defVal;
        }),
      };

      const adapter = new CoreCcpApiAdapter(mockSettingsService);
      // Xóa cache nếu có
      adapter.clearSessionCache();

      await expect(adapter.getValidSession(true)).rejects.toThrow(
        /Không tìm thấy cấu hình URL CoreCCP trong bot_credentials_ccp hoặc biến môi trường/i,
      );
    });

    it('TC-CCP-02: Tái sử dụng session cache từ file khi chưa hết hạn', async () => {
      const mockSettingsService: any = {
        getSetting: jest.fn().mockImplementation((key: string, defVal: any) => {
          if (key === 'coreccp_base_url') return 'https://coreccp.vnclear.vn';
          if (key === 'bot_credentials_ccp') {
            return JSON.stringify({
              url: 'https://coreccp.vnclear.vn',
              username: 'bot_ccp_user',
              password: 'SecretPassword',
            });
          }
          return defVal;
        }),
      };

      const adapter = new CoreCcpApiAdapter(mockSettingsService);
      const cacheDir = path.join(process.cwd(), 'temp');
      const cachePath = path.join(cacheDir, 'coreccp_session.json');

      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const validSession = {
        accessToken: 'mock_valid_ccp_token_123',
        sessionCookie: 'SESSION=mock_session_456',
        userId: 99,
        username: 'bot_ccp_user',
        expiresAt: Date.now() + 3600 * 1000, // Còn hạn 1 giờ
        baseUrl: 'https://coreccp.vnclear.vn',
      };
      fs.writeFileSync(cachePath, JSON.stringify(validSession), 'utf8');

      // Tải lại adapter từ cache
      const freshAdapter = new CoreCcpApiAdapter(mockSettingsService);
      const session = await freshAdapter.getValidSession(false);

      expect(session).toBeDefined();
      expect(session.accessToken).toBe('mock_valid_ccp_token_123');
      expect(session.username).toBe('bot_ccp_user');

      // Dọn dẹp cache test
      freshAdapter.clearSessionCache();
    });
  });

  describe('CoreExApiAdapter', () => {
    it('TC-CE-01: Ném lỗi Fail-Fast rõ ràng khi không có cấu hình URL CoreExchange', async () => {
      delete process.env.COREEXCHANGE_BASE_URL;
      const mockSettingsService: any = {
        getSetting: jest.fn().mockImplementation((key: string, defVal: any) => {
          if (key === 'coreex_base_url') return '';
          if (key === 'bot_credentials_ce') return '';
          return defVal;
        }),
      };

      const adapter = new CoreExApiAdapter(mockSettingsService);
      adapter.clearSessionCache();

      await expect(adapter.getValidSession(true)).rejects.toThrow(
        /Không tìm thấy cấu hình URL CoreExchange trong bot_credentials_ce hoặc biến môi trường/i,
      );
    });

    it('TC-CE-02: Bắt lỗi chuyển hướng /change-password và ném tiền tố [PARTNER_SERVICE_UNAVAILABLE] kích hoạt Cooldown', async () => {
      const mockSettingsService: any = {
        getSetting: jest.fn().mockImplementation((key: string, defVal: any) => {
          if (key === 'coreex_base_url') return 'https://coreexchange.mxv.com.vn';
          if (key === 'bot_credentials_ce') {
            return JSON.stringify({
              url: 'https://coreexchange.mxv.com.vn',
              username: 'anhdao',
              password: 'ExpiringPassword123',
            });
          }
          return defVal;
        }),
      };

      const adapter = new CoreExApiAdapter(mockSettingsService);
      adapter.clearSessionCache();

      // Mock fetch: Bẫy CSRF thành công -> POST /login trả về 302 chuyển hướng /change-password
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: any, options: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/oauth2/authorize')) {
          return {
            status: 302,
            headers: new Headers({
              location: 'https://coreexchange.mxv.com.vn/login',
              'set-cookie': 'SESSION=test_session_id; Path=/',
            }),
          };
        }
        if (options?.method === 'POST' && urlStr.includes('/login')) {
          return {
            status: 302,
            headers: new Headers({
              location: 'https://coreexchange.mxv.com.vn/change-password',
              'set-cookie': 'SESSION=test_session_id; Path=/',
            }),
          };
        }
        if (urlStr.includes('/login')) {
          return {
            status: 200,
            headers: new Headers(),
            text: async () => '<input type="hidden" name="_csrf" value="mock_csrf_token" />',
          };
        }
        return {
          status: 404,
          headers: new Headers(),
        };
      }) as any;

      try {
        await expect(adapter.getValidSession(true)).rejects.toThrow(
          /\[PARTNER_SERVICE_UNAVAILABLE\].*\/change-password/,
        );
      } finally {
        global.fetch = originalFetch;
        adapter.clearSessionCache();
      }
    });
  });
});
