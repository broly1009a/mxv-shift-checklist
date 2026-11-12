import { AcmEtpAdapter } from './acm-etp.adapter';

describe('AcmEtpAdapter (Single-Flight Login Mutex & Dynamic BaseUrl)', () => {
  const originalFetch = global.fetch;
  const origUser = process.env.ACM_USERNAME;
  const origPass = process.env.ACM_PASSWORD;

  afterEach(() => {
    global.fetch = originalFetch;
    if (origUser === undefined) delete process.env.ACM_USERNAME;
    else process.env.ACM_USERNAME = origUser;
    if (origPass === undefined) delete process.env.ACM_PASSWORD;
    else process.env.ACM_PASSWORD = origPass;
    jest.restoreAllMocks();
  });

  it('TC-ACM-01: Dùng chung activeLoginPromise cho 2 caller đồng thời và không bị verifyToken cũ xóa đè session mới', async () => {
    const settingsService: any = {
      getSetting: jest.fn(async (key: string, def = '') => {
        if (key === 'acm_base_url') return 'https://custom-acm.example.com';
        return def;
      }),
    };
    process.env.ACM_USERNAME = 'test_user';
    process.env.ACM_PASSWORD = 'test_password';

    const adapter = new AcmEtpAdapter(settingsService);
    (adapter as any).cachedSession = {
      token: 'stale-token-1',
      username: 'test_user',
      cookies: 'JSESSIONID=old',
      updatedAt: new Date().toISOString(),
    };
    (adapter as any).saveSessionToCache = jest.fn((s: any) => {
      (adapter as any).cachedSession = s;
    });

    let resolveVerifyA: ((val: boolean) => void) | null = null;
    let resolveVerifyB: ((val: boolean) => void) | null = null;
    let verifyCount = 0;
    jest.spyOn(adapter, 'verifyToken').mockImplementation(async () => {
      verifyCount++;
      if (verifyCount === 1) {
        return await new Promise<boolean>((r) => {
          resolveVerifyA = r;
        });
      }
      return await new Promise<boolean>((r) => {
        resolveVerifyB = r;
      });
    });

    let loginPostCalls = 0;
    global.fetch = jest.fn(async (url: any) => {
      const u = String(url);
      if (u.includes('/exchange/index.html')) {
        return new Response('<html></html>', { status: 200 });
      }
      if (u.includes('/exchange/captcha')) {
        return new Response(Buffer.from(''), { status: 200 });
      }
      if (u.includes('/exchange/login')) {
        loginPostCalls++;
        return new Response(
          JSON.stringify({ code: 0, data: { token: `fresh-token-${loginPostCalls}` } }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as any;

    const pA = adapter.getValidSession();
    const pB = adapter.getValidSession();
    // Chờ cả 2 caller đều vượt qua resolveAcmConfig và vào verifyToken đồng thời với stale-token-1
    await new Promise((r) => setTimeout(r, 10));
    expect(verifyCount).toBe(2);

    // Caller A phát hiện token stale và login xong trước
    resolveVerifyA!(false);
    const sessionA = await pA;
    expect(sessionA.token).toBe('fresh-token-1');

    // Caller B mới xong verifyToken chậm hơn sau đó -> phải giữ nguyên fresh-token-1, không login lại
    resolveVerifyB!(false);
    const sessionB = await pB;

    expect(sessionB.token).toBe('fresh-token-1');
    expect(loginPostCalls).toBe(1);
  });

  it('TC-ACM-02: checkHealth() sử dụng đúng URL từ SystemSettingsService thay vì hardcode default', async () => {
    const settingsService: any = {
      getSetting: jest.fn(async (key: string, def = '') => {
        if (key === 'acm_base_url') return 'https://acm-db-configured.mxv.test/sub/path';
        return def;
      }),
    };

    const requestedUrls: string[] = [];
    global.fetch = jest.fn(async (url: any) => {
      requestedUrls.push(String(url));
      return new Response('', { status: 200 });
    }) as any;

    const adapter = new AcmEtpAdapter(settingsService);
    const ok = await adapter.checkHealth();

    expect(ok).toBe(true);
    expect(requestedUrls[0]).toBe('https://acm-db-configured.mxv.test/exchange/index.html');
  });
});
