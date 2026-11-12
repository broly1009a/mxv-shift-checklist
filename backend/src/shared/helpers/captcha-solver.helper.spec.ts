import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CaptchaSolverHelper } from './captcha-solver.helper';

describe('CaptchaSolverHelper (Production Model Priority, Persistence & Cooldown)', () => {
  let tmpDir: string;
  let cacheFilePath: string;
  const originalFetch = global.fetch;

  beforeEach(() => {
    CaptchaSolverHelper.resetStateForTesting();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'captcha-solver-test-'));
    cacheFilePath = path.join(tmpDir, 'captcha_last_model.txt');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    CaptchaSolverHelper.resetStateForTesting();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('ưu tiên stable flash-lite (Tier 0) trước flash GA (Tier 1) và đẩy omni/preview xuống cuối (Tier 4)', () => {
    const input = [
      'gemini-omni-flash-preview',
      'gemini-omni-1.2-flash',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
    ];

    const ranked = CaptchaSolverHelper.prioritizeModels(input);

    expect(ranked[0]).toBe('gemini-3.5-flash-lite');
    expect(ranked[1]).toBe('gemini-2.5-flash-lite');
    expect(ranked.indexOf('gemini-3.8-flash')).toBeLessThan(
      ranked.indexOf('gemini-omni-flash-preview'),
    );
    expect(ranked.slice(-2)).toEqual(
      expect.arrayContaining(['gemini-omni-flash-preview', 'gemini-omni-1.2-flash']),
    );
  });

  it('lưu model thành công xuống đĩa và tái sử dụng ngay sau khi reset RAM (giả lập PM2 restart)', async () => {
    const calledModels: string[] = [];
    global.fetch = jest.fn(async (url: any) => {
      const m = String(url).match(/models\/([^:]+):generateContent/);
      if (m) calledModels.push(m[1]);
      if (m && m[1] === 'gemini-3.8-flash') {
        return new Response(JSON.stringify({ error: { code: 503 } }), { status: 503 });
      }
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'EPQNA' }] } }] }),
        { status: 200 },
      );
    }) as any;

    const first = await CaptchaSolverHelper.solve(Buffer.from('fake-img'), {
      apiKey: 'test-key',
      models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'],
      cacheFilePath,
    });

    expect(first).toBe('EPQNA');
    expect(fs.readFileSync(cacheFilePath, 'utf8').trim()).toBe('gemini-3.5-flash-lite');

    // Giả lập PM2 restart (xóa sạch RAM state)
    CaptchaSolverHelper.resetStateForTesting();
    calledModels.length = 0;

    const second = await CaptchaSolverHelper.solve(Buffer.from('fake-img'), {
      apiKey: 'test-key',
      models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'],
      cacheFilePath,
    });

    expect(second).toBe('EPQNA');
    expect(calledModels).toEqual(['gemini-3.5-flash-lite']);
  });

  it('đưa model trả HTTP 429/503 vào cooldown và bỏ qua ở lần gọi kế tiếp', async () => {
    const calledModels: string[] = [];
    global.fetch = jest.fn(async (url: any) => {
      const m = String(url).match(/models\/([^:]+):generateContent/);
      const model = m ? m[1] : '';
      calledModels.push(model);

      if (model === 'gemini-3.8-flash') {
        return new Response('overloaded', { status: 503 });
      }
      if (model === 'gemini-3.7-flash') {
        return new Response('quota exceeded', { status: 429 });
      }
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ATKQH' }] } }] }),
        { status: 200 },
      );
    }) as any;

    const solved1 = await CaptchaSolverHelper.solve(Buffer.from('img1'), {
      apiKey: 'test-key',
      models: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'],
      cacheFilePath,
    });

    expect(solved1).toBe('ATKQH');
    expect(calledModels).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash']);
    expect(CaptchaSolverHelper.isModelInCooldown('gemini-3.8-flash')).toBe(true);
    expect(CaptchaSolverHelper.isModelInCooldown('gemini-3.7-flash')).toBe(true);

    // Giả lập gọi lại với model mới nhưng vẫn kèm 2 model lỗi trong list: 2 model cooldown phải bị bỏ qua
    calledModels.length = 0;
    const solved2 = await CaptchaSolverHelper.solve(Buffer.from('img2'), {
      apiKey: 'test-key',
      models: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'],
      cacheFilePath,
    });

    expect(solved2).toBe('ATKQH');
    expect(calledModels).toEqual(['gemini-3.5-flash']);
  });

  it('không chèn lastGoodModel nằm ngoài danh sách options.models khi caller truyền models tường minh', async () => {
    fs.writeFileSync(cacheFilePath, 'gemini-2.5-flash-lite', 'utf8');
    const calledModels: string[] = [];
    global.fetch = jest.fn(async (url: any) => {
      const m = String(url).match(/models\/([^:]+):generateContent/);
      if (m) calledModels.push(m[1]);
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ZXCVB' }] } }] }),
        { status: 200 },
      );
    }) as any;

    const solved = await CaptchaSolverHelper.solve(Buffer.from('img3'), {
      apiKey: 'test-key',
      models: ['gemini-3.5-flash'],
      cacheFilePath,
    });

    expect(solved).toBe('ZXCVB');
    expect(calledModels).toEqual(['gemini-3.5-flash']);
  });
});
