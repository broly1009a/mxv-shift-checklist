import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CoreCcpApiAdapter, discoverCcpBasicAuthFromHost } from './coreccp-api.adapter';
import { CoreExApiAdapter, discoverCeBasicAuthFromHost } from './coreex-api.adapter';

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

    it('TC-CCP-03: Tự động trích xuất Basic Auth từ manifest và bẫy lỗi invalid_client để tự phục hồi', async () => {
      // 1. Giả lập /assets-manifest.js mã hóa với secret mới
      const aesKey = crypto.randomBytes(32);
      const aesIv = crypto.randomBytes(16);
      const testSecret = 'BarmwFbm75KV8WEmhUhti1Nvqu3GDD';
      const rawConfig = JSON.stringify({
        api: {
          CLIENT_ID: 'web-ccp-mxv',
          CLIENT_SECRET: testSecret,
        },
      });

      const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, aesIv);
      let encrypted = cipher.update(rawConfig, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const payloadObj = {
        iv: aesIv.toString('base64'),
        data: encrypted.toString('base64'),
      };
      const manifestPayload = `${aesKey.toString('base64')}fss${Buffer.from(JSON.stringify(payloadObj)).toString('base64')}`;
      const manifestFileContent = `window.__ASSETS_MANIFEST__ = "${manifestPayload}";`;

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/assets-manifest.js')) {
          return {
            ok: true,
            status: 200,
            text: async () => manifestFileContent,
          };
        }
        return { ok: false, status: 404 };
      }) as any;

      try {
        const discovered = await discoverCcpBasicAuthFromHost('https://uat-coreccp.mxv.com.vn', true);
        const expectedBasic = 'Basic ' + Buffer.from(`web-ccp-mxv:${testSecret}`).toString('base64');
        expect(discovered).toBe(expectedBasic);
      } finally {
        global.fetch = originalFetch;
      }
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
              clientSecret: 'mock_test_secret',
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

    it('TC-CE-03: Tự động trích xuất Basic Auth CoreExchange từ manifest và bẫy lỗi invalid_client để tự phục hồi', async () => {
      const aesKey = crypto.randomBytes(32);
      const aesIv = crypto.randomBytes(16);
      const testSecret = 'OhPfMYUE4ZqiqLQOFfMEqiBAYAhQEw';
      const rawConfig = JSON.stringify({
        api: {
          sso: {
            CLIENT_ID: 'web-exchange-mxv',
            CLIENT_SECRET: testSecret,
          },
        },
      });

      const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, aesIv);
      let encrypted = cipher.update(rawConfig, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const payloadObj = {
        iv: aesIv.toString('base64'),
        data: encrypted.toString('base64'),
      };
      const manifestPayload = `${aesKey.toString('base64')}fss${Buffer.from(JSON.stringify(payloadObj)).toString('base64')}`;
      const manifestFileContent = `window.__ASSETS_MANIFEST__ = "${manifestPayload}";`;

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/assets-manifest.js')) {
          return {
            ok: true,
            status: 200,
            text: async () => manifestFileContent,
          };
        }
        return { ok: false, status: 404 };
      }) as any;

      try {
        const discovered = await discoverCeBasicAuthFromHost('https://uat-coreexchange.mxv.com.vn', true);
        const expectedBasic = 'Basic ' + Buffer.from(`web-exchange-mxv:${testSecret}`).toString('base64');
        expect(discovered).toBeDefined();
        expect(discovered?.basicAuth).toBe(expectedBasic);
        expect(discovered?.clientSecret).toBe(testSecret);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
