import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ReconIngressPipelineService } from './recon-ingress-pipeline.service';

describe('ReconIngressPipelineService (Pre-flight Guard 45s & Decoupled Barrier Timer)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-pipeline-test-'));
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  });

  afterEach(() => {
    jest.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  const buildSettingsMock = (overrides: Record<string, string> = {}) => {
    const map: Record<string, string> = {
      bot_backup_path_ms: path.join(tmpDir, 'ms'),
      bot_backup_path_cqg: path.join(tmpDir, 'cqg'),
      bot_backup_path_acm: path.join(tmpDir, 'acm'),
      bot_backup_path_ccp: path.join(tmpDir, 'ccp'),
      recon_folder_check_path: path.join(tmpDir, 'TradingCheck'),
      ingress_mode: 'REST_API',
      ingress_mode_ms: 'REST_API',
      ingress_mode_acm: 'REST_API',
      ingress_mode_ccp: 'REST_API',
      ...overrides,
    };
    return {
      getSetting: jest.fn(async (key: string, def = '') => (key in map ? map[key] : def)),
    } as any;
  };

  it('TC-PIPE-01: Cho phép ACM hoàn tất Pre-flight ở giây 23 (vượt 15s cũ) trong ngưỡng mặc định 45s và giữ nguyên ngân sách 70s cho CQG sau Pre-flight', async () => {
    const settingsService = buildSettingsMock();
    const logs: string[] = [];

    const ingressService: any = {
      checkHealth: jest.fn(async (source: string) => {
        if (source === 'ACM') {
          // Giả lập ca thực tế 22.86s trên VPS
          await new Promise((r) => setTimeout(r, 23000));
        }
        return true;
      }),
      download: jest.fn(async (source: string) => {
        const mapFile: Record<string, string> = {
          MS: 'DSGD.xlsx',
          ACM: 'Fill.xls',
          CCP: 'DSGD CCP.xlsx',
        };
        return { success: true, files: [{ fileName: mapFile[source] || 'ok.xlsx' }] };
      }),
    };

    const rpaScraperService: any = {
      downloadCqgBackup: jest.fn(async (_files, _dir, onReady1, onReady2, _log, notifyPair) => {
        // CQG mất 35s sau khi Pre-flight xong mới vào màn hình FR1/FR2
        // (Tổng thời gian từ t=0 là 23s + 35s = 58s; nhưng nếu Pre-flight 40s + 35s = 75s > 70s cũ!)
        await new Promise((r) => setTimeout(r, 35000));
        await Promise.all([onReady1(), onReady2()]);
        if (notifyPair) notifyPair('FR');
        return { downloaded: ['FR1.xlsx', 'FR2.xlsx'], errors: [] };
      }),
    };

    const service = new ReconIngressPipelineService(
      settingsService,
      rpaScraperService,
      undefined,
      ingressService,
    );

    const runPromise = service.downloadSessionData({
      targetDate: new Date('2026-11-11T00:00:00Z'),
      dateStr: '2026-11-11',
      year: '2026',
      month: '11',
      day: '11',
      subFolder: path.join('2026', 'T11.2026', '11.11'),
      options: { checkKlgd: true, checkTtm: false, checkTttt: false },
      log: (m) => logs.push(m),
    });

    await jest.advanceTimersByTimeAsync(75000);
    const res = await runPromise;

    expect(res.isAborted).toBeFalsy();
    expect(res.success).toBe(true);
    expect(rpaScraperService.downloadCqgBackup).toHaveBeenCalledTimes(1);
    expect(logs.some((l) => l.includes('[CQG_ABORT_PREFLIGHT]'))).toBe(false);
    expect(logs.some((l) => l.includes('Hết thời gian chờ CQG chuẩn bị'))).toBe(false);
    expect(logs.some((l) => l.includes('BẮT ĐẦU ĐỒNG LOẠT XUẤT BÁO CÁO'))).toBe(true);
  });

  it('TC-PIPE-02: Nếu Pre-flight mất 40s và CQG mất 45s (tổng 85s > 70s cũ), CQG vẫn không bị cắt barrier sớm vì đồng hồ 70s chỉ đếm sau Pre-flight', async () => {
    const settingsService = buildSettingsMock();
    const logs: string[] = [];

    const ingressService: any = {
      checkHealth: jest.fn(async (source: string) => {
        if (source === 'ACM') {
          await new Promise((r) => setTimeout(r, 40000));
        }
        return true;
      }),
      download: jest.fn(async () => ({ success: true, files: [{ fileName: 'ok.xlsx' }] })),
    };

    const rpaScraperService: any = {
      downloadCqgBackup: jest.fn(async (_files, _dir, onReady1, onReady2, _log, notifyPair) => {
        await new Promise((r) => setTimeout(r, 45000));
        await Promise.all([onReady1(), onReady2()]);
        if (notifyPair) notifyPair('FR');
        return { downloaded: ['FR1.xlsx', 'FR2.xlsx'], errors: [] };
      }),
    };

    const service = new ReconIngressPipelineService(
      settingsService,
      rpaScraperService,
      undefined,
      ingressService,
    );

    const runPromise = service.downloadSessionData({
      targetDate: new Date('2026-11-11T00:00:00Z'),
      dateStr: '2026-11-11',
      year: '2026',
      month: '11',
      day: '11',
      subFolder: path.join('2026', 'T11.2026', '11.11'),
      options: { checkKlgd: true, checkTtm: false, checkTttt: false },
      log: (m) => logs.push(m),
    });

    await jest.advanceTimersByTimeAsync(100000);
    const res = await runPromise;

    expect(res.success).toBe(true);
    expect(logs.some((l) => l.includes('Hết thời gian chờ CQG chuẩn bị'))).toBe(false);
    expect(logs.some((l) => l.includes('BẮT ĐẦU ĐỒNG LOẠT XUẤT BÁO CÁO'))).toBe(true);
  });

  it('TC-PIPE-03: Nếu đối tác treo vượt quá recon_cqg_preflight_timeout_ms (45s), CQG Pre-flight Guard hủy fail-fast đúng thông số cấu hình và không mở Chrome', async () => {
    const settingsService = buildSettingsMock({ recon_cqg_preflight_timeout_ms: '45000' });
    const logs: string[] = [];

    const ingressService: any = {
      checkHealth: jest.fn(async (source: string) => {
        if (source === 'ACM') {
          // Treo 60s > 45s
          await new Promise((r) => setTimeout(r, 60000));
        }
        return true;
      }),
      download: jest.fn(async () => ({ success: true, files: [{ fileName: 'ok.xlsx' }] })),
    };

    const rpaScraperService: any = {
      downloadCqgBackup: jest.fn(),
    };

    const service = new ReconIngressPipelineService(
      settingsService,
      rpaScraperService,
      undefined,
      ingressService,
    );

    const runPromise = service.downloadSessionData({
      targetDate: new Date('2026-11-11T00:00:00Z'),
      dateStr: '2026-11-11',
      year: '2026',
      month: '11',
      day: '11',
      subFolder: path.join('2026', 'T11.2026', '11.11'),
      options: { checkKlgd: true, checkTtm: false, checkTttt: false },
      log: (m) => logs.push(m),
    });

    await jest.advanceTimersByTimeAsync(65000);
    const res = await runPromise;

    expect(res.success).toBe(false);
    expect(res.isAborted).toBe(true);
    expect(res.abortReason).toContain('[CQG_ABORT_PREFLIGHT]');
    expect(res.abortReason).toContain('sau 45s Pre-flight: ACM');
    expect(rpaScraperService.downloadCqgBackup).not.toHaveBeenCalled();
  });
});

