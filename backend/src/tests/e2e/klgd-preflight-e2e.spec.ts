import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BotJobQueueService } from '../../modules/checklist-hub/queue/bot-job-queue.service';
import { BotJobHandlerRegistry } from '../../modules/checklist-hub/queue/job-handler.registry';
import { DomainLockManagerService } from '../../modules/checklist-hub/queue/domain-lock-manager.service';
import { BotDispatcherService } from '../../modules/checklist-hub/dispatcher/bot-dispatcher.service';
import { ShiftScannerService } from '../../modules/checklist-hub/scheduler/shift-scanner.service';
import { KlgdReconWorker } from '../../modules/trading-ops/workers/klgd-recon.worker';
import { ReconPipelineService } from '../../modules/trading-ops/services/pipeline/recon-pipeline.service';
import { ReconIngressPipelineService } from '../../modules/ingress/services/recon-ingress-pipeline.service';
import { IngressService } from '../../modules/ingress/ingress.service';
import { AcmEtpAdapter } from '../../modules/ingress/adapters/acm-etp.adapter';
import { CaptchaSolverHelper } from '../../shared/helpers/captcha-solver.helper';
import { encrypt } from '../../shared';

/**
 * Full End-to-End Integration Test cho luồng vận hành CHECK_KLGD:
 * BotJobQueueService -> BotDispatcherService -> KlgdReconWorker -> ReconPipelineService
 * -> ReconIngressPipelineService -> IngressService -> AcmEtpAdapter -> CaptchaSolverHelper
 * -> syncJobToChecklist + ShiftScannerService.
 *
 * Chỉ mock HTTP fetch (Google Gemini / ACM Portal), Playwright Chrome (CQG) và Mongoose DB store.
 */
describe('FULL E2E: CHECK_KLGD Pipeline (Pre-flight, Captcha Persistence, Decoupled Barrier & ABORTED Sync)', () => {
  let tmpDir: string;
  const originalFetch = global.fetch;
  const origCaptchaCache = (CaptchaSolverHelper as any).DEFAULT_MODEL_CACHE_FILE;

  const delayWithAbort = (ms: number, signal?: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new DOMException('The operation was aborted due to timeout', 'AbortError'));
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('The operation was aborted due to timeout', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klgd-e2e-full-'));
    CaptchaSolverHelper.resetStateForTesting();
    (CaptchaSolverHelper as any).DEFAULT_MODEL_CACHE_FILE = path.join(
      tmpDir,
      'captcha_last_model.txt',
    );
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
      }, ms);
      return controller.signal;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    CaptchaSolverHelper.resetStateForTesting();
    (CaptchaSolverHelper as any).DEFAULT_MODEL_CACHE_FILE = origCaptchaCache;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function createFullE2EHarness(options?: {
    cqgDelayAfterPreflightMs?: number;
    acmGeminiDelayMs?: number;
    acmPreFlightHangMs?: number;
    settingsOverrides?: Record<string, string>;
    reconPassed?: boolean;
  }) {
    const jobsStore = new Map<string, any>();
    const shiftLogState: any = {
      _id: 'SHIFT_PROD_01',
      status: 'IN_PROGRESS',
      details: [
        {
          taskId: 'TASK_KLGD_01',
          isChecked: false,
          status: 'PENDING',
          botCheckTypeSnapshot: 'CHECK_KLGD',
        },
      ],
    };

    const settingsMap: Record<string, string> = {
      session_start_time: '05:00',
      gemini_api_key: 'test-gemini-key',
      acm_base_url: 'https://acm-etp.mxv.test',
      bot_credentials_acm: encrypt(
        JSON.stringify({
          url: 'https://acm-etp.mxv.test',
          username: 'MXVRO_TEST',
          password: 'secret_password',
        }),
      ),
      bot_backup_path_ms: path.join(tmpDir, 'backup', 'ms'),
      bot_backup_path_cqg: path.join(tmpDir, 'backup', 'cqg'),
      bot_backup_path_acm: path.join(tmpDir, 'backup', 'acm'),
      bot_backup_path_ccp: path.join(tmpDir, 'backup', 'ccp'),
      recon_folder_check_path: path.join(tmpDir, 'TradingCheck'),
      ingress_mode: 'REST_API',
      ingress_mode_ms: 'REST_API',
      ingress_mode_acm: 'REST_API',
      ingress_mode_ccp: 'REST_API',
      ...(options?.settingsOverrides || {}),
    };

    const settingsService: any = {
      getSetting: jest.fn(async (key: string, def = '') =>
        key in settingsMap ? settingsMap[key] : def,
      ),
    };

    const shiftsService: any = {
      findShiftLogRaw: jest.fn(async () => shiftLogState),
      updateTaskStatus: jest.fn(
        async (_sid: string, tid: string, status: string, _user: any, note: string) => {
          const t = shiftLogState.details.find((d: any) => d.taskId === tid);
          if (t) {
            t.status = status;
            t.note = note;
          }
          return true;
        },
      ),
    };

    const emittedWsEvents: Array<{ type: string; payload: any }> = [];
    const shiftsGateway: any = {
      emitEvent: jest.fn((eventType: string, _id: string, _d: any, _s: any, _dt: string, data: any) => {
        emittedWsEvents.push({ type: eventType, payload: data });
      }),
      emitJobStatusUpdated: jest.fn((_jobId: string, data: any) => {
        emittedWsEvents.push({ type: 'job-status-updated', payload: data });
      }),
      emitJobLogUpdated: jest.fn(),
    };

    const systemLogs: any[] = [];
    const systemLogsService: any = {
      logEvent: jest.fn(async (ev: any) => {
        systemLogs.push(ev);
        return true;
      }),
    };

    const botJobModel: any = {
      find: jest.fn(() => ({
        sort: jest.fn(() => ({
          limit: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([]) })),
          exec: jest.fn().mockResolvedValue([]),
        })),
      })),
      findById: jest.fn((id: any) => {
        const key = String(id);
        const getDoc = () => {
          const doc = jobsStore.get(key);
          if (!doc) return null;
          return {
            ...doc,
            toObject: function () {
              return { ...this, payload: this.payload };
            },
          };
        };
        const queryObj: any = {
          select: jest.fn(() => queryObj),
          lean: jest.fn(() => queryObj),
          exec: jest.fn(async () => {
            const res = getDoc();
            return res;
          }),
        };
        (queryObj as any).then = (resolve: any, reject: any) =>
          getDoc() ? Promise.resolve(getDoc()).then(resolve, reject) : Promise.resolve(null).then(resolve, reject);
        return queryObj;
      }),
      updateOne: jest.fn((filter: any, update: any) => ({
        exec: jest.fn(async () => {
          const key = String(filter._id);
          const doc = jobsStore.get(key) || { _id: key };
          if (update.$set) Object.assign(doc, update.$set);
          jobsStore.set(key, doc);
          return { modifiedCount: 1 };
        }),
      })),
    };

    // 1. REAL AcmEtpAdapter (cô lập sessionCachePath về tmpDir)
    const acmEtpAdapter = new AcmEtpAdapter(settingsService);
    (acmEtpAdapter as any).sessionCachePath = path.join(tmpDir, 'acm_session.json');

    // 2. Mocked MS & CCP adapters (ghi file thật ra disk để Data Integrity Gate kiểm chứng)
    const msApiAdapter: any = {
      getValidToken: jest.fn().mockResolvedValue({ token: 'ms-tok', baseUrl: 'https://ms.test' }),
      download: jest.fn(async (_src: string, opts: any) => {
        const fname = `${opts.reportType || 'DSGD'}.xlsx`;
        const fpath = path.join(opts.targetDirectory, fname);
        fs.mkdirSync(opts.targetDirectory, { recursive: true });
        fs.writeFileSync(fpath, 'mock-ms-xlsx');
        return {
          success: true,
          files: [{ fileName: fname, absolutePath: fpath, fileSize: 12 }],
        };
      }),
    };

    const coreCcpApiAdapter: any = {
      getValidSession: jest.fn().mockResolvedValue({ accessToken: 'ccp-tok' }),
      download: jest.fn(async (_src: string, opts: any) => {
        const code = opts.reportCodes?.[0] || 'DSGD_CCP';
        const fname = `${code}.xlsx`;
        const fpath = path.join(opts.targetDirectory, fname);
        fs.mkdirSync(opts.targetDirectory, { recursive: true });
        fs.writeFileSync(fpath, 'mock-ccp-xlsx');
        return {
          success: true,
          files: [{ fileName: fname, absolutePath: fpath, fileSize: 13 }],
        };
      }),
    };

    const rpaScraperService: any = {
      downloadCqgBackup: jest.fn(
        async (filesToDownload: any, destDir: string, onReady1: any, onReady2: any, _log: any, notifyPair: any) => {
          if (options?.cqgDelayAfterPreflightMs) {
            await new Promise((r) => setTimeout(r, options.cqgDelayAfterPreflightMs));
          }
          await Promise.all([onReady1(), onReady2()]);
          fs.mkdirSync(destDir, { recursive: true });
          const downloaded: string[] = [];
          for (const key of Object.keys(filesToDownload)) {
            if (filesToDownload[key]) {
              const fname = `${key}.xlsx`;
              fs.writeFileSync(path.join(destDir, fname), 'mock-cqg-xlsx');
              downloaded.push(fname);
            }
          }
          if (notifyPair) {
            notifyPair('FR');
            notifyPair('OP');
            notifyPair('PS');
          }
          return { downloaded, errors: [] };
        },
      ),
    };

    // 3. REAL IngressService
    const ingressService = new IngressService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      coreCcpApiAdapter,
      { testConnection: jest.fn() } as any,
      acmEtpAdapter,
      msApiAdapter,
      settingsService,
    );

    // 4. REAL ReconIngressPipelineService
    const ingressPipelineService = new ReconIngressPipelineService(
      settingsService,
      rpaScraperService,
      undefined,
      ingressService,
    );

    // 5. Mock KlgdReconService & CqgMergerService (Domain Recon)
    const klgdReconService: any = {
      runAutoCheckKLGD: jest.fn(async () => ({
        passed: options?.reconPassed ?? true,
        totals: {
          totalDSGD: 5500,
          totalFR: 5500,
          totalACM: 2900,
          totalNano: 2900,
          differ: 0,
          differACM: 0,
          totalCCP_DSGD: 5500,
          totalCCP_TTM: 100,
          totalCCP_TTTT: 200,
          differCCP_KLGD: 0,
          differCCP_TTM: 0,
          differCCP_TTTT: 0,
        },
        mismatchedTrades: [],
        mismatchedTTM: [],
        mismatchedTTTT: [],
      })),
    };

    const cqgMergerService: any = {
      mergeFR: jest.fn(),
      mergeOP: jest.fn(),
      mergePS: jest.fn(),
    };

    // 6. REAL ReconPipelineService -> KlgdReconWorker -> BotDispatcherService -> BotJobQueueService -> ShiftScannerService
    const reconPipelineService = new ReconPipelineService(
      settingsService,
      ingressPipelineService,
      klgdReconService,
      undefined,
      cqgMergerService,
    );

    const reconLogModel: any = {
      create: jest.fn().mockResolvedValue({ _id: 'RECON_LOG_001' }),
    };

    const klgdReconWorker = new KlgdReconWorker(
      klgdReconService,
      reconLogModel,
      reconPipelineService,
    );

    const botDispatcher = new BotDispatcherService(botJobModel);
    botDispatcher.registerWorker(klgdReconWorker);

    const domainLockManager = new DomainLockManagerService();
    const botJobQueueService = new BotJobQueueService(
      botJobModel,
      new BotJobHandlerRegistry(),
      shiftsService,
      shiftsGateway,
      settingsService,
      systemLogsService,
      domainLockManager,
      botDispatcher,
    );

    const shiftScannerService = new ShiftScannerService(
      {} as any,
      botJobModel,
      shiftsService,
      settingsService,
      botDispatcher,
      botJobQueueService,
    );

    // Helper tạo Job document
    const createJob = (id: string) => {
      const job: any = {
        _id: id,
        jobType: 'CHECK_KLGD',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        logs: [],
        createdAt: new Date(),
        payload: {
          shiftLogId: 'SHIFT_PROD_01',
          taskId: 'TASK_KLGD_01',
          botCheckType: 'CHECK_KLGD',
          targetDate: '2026-11-11',
        },
        markModified: jest.fn(),
        save: jest.fn(async function () {
          jobsStore.set(id, { ...this });
          return this;
        }),
        toObject: function () {
          return { ...this, payload: this.payload };
        },
      };
      jobsStore.set(id, job);
      return job;
    };

    // Mock HTTP fetch cho Gemini API + ACM ETP Portal
    const geminiModelsCalled: string[] = [];
    let acmLoginCalls = 0;
    let activeToken = 'initial-stale-token';

    const installFetchMock = (
      mode: 'VPS_INCIDENT_23S' | 'VPS_RETRY_38S' | 'HANG_OVER_45S' | 'FAST_CONCURRENT',
    ) => {
      let failedLoginCount = 0;
      global.fetch = jest.fn(async (url: any, init?: any) => {
        const u = String(url);

        if (u.includes('/v1beta/models?')) {
          return new Response(
            JSON.stringify({
              models: [
                { name: 'models/gemini-omni-flash-preview', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
              ],
            }),
            { status: 200 },
          );
        }

        if (u.includes(':generateContent')) {
          const m = u.match(/models\/([^:]+):generateContent/);
          const model = m ? m[1] : '';
          geminiModelsCalled.push(model);

          if (mode === 'HANG_OVER_45S') {
            await delayWithAbort(60000, init?.signal);
            return new Response('timeout', { status: 504 });
          }

          if (mode === 'VPS_INCIDENT_23S') {
            if (model === 'gemini-3.5-flash-lite') {
              await delayWithAbort(10000, init?.signal); // chạm AbortSignal.timeout(8000) sau 8s
              return new Response('late', { status: 200 });
            }
            await delayWithAbort(6000, init?.signal);
            return new Response(
              JSON.stringify({ candidates: [{ content: { parts: [{ text: 'EPQNA' }] } }] }),
              { status: 200 },
            );
          }

          if (mode === 'VPS_RETRY_38S') {
            if (failedLoginCount === 0) {
              if (model === 'gemini-3.5-flash-lite') {
                await delayWithAbort(10000, init?.signal); // chạm timeout 8s ở attempt 1
              }
              await delayWithAbort(4000, init?.signal);
              return new Response(
                JSON.stringify({ candidates: [{ content: { parts: [{ text: 'WRONG1' }] } }] }),
                { status: 200 },
              );
            }
            await delayWithAbort(7000, init?.signal);
            return new Response(
              JSON.stringify({ candidates: [{ content: { parts: [{ text: 'RIGHT2' }] } }] }),
              { status: 200 },
            );
          }

          await delayWithAbort(options?.acmGeminiDelayMs || 500, init?.signal);
          return new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: 'EPQNA' }] } }] }),
            { status: 200 },
          );
        }

        if (u.includes('/exchange/sys/menu/nav')) {
          const hdrTok = init?.headers?.token;
          if (hdrTok && hdrTok === activeToken && activeToken !== 'initial-stale-token') {
            return new Response(JSON.stringify({ code: 0 }), { status: 200 });
          }
          if (mode === 'VPS_INCIDENT_23S' || mode === 'VPS_RETRY_38S') {
            await delayWithAbort(9000, init?.signal);
          }
          return new Response(JSON.stringify({ code: 401, msg: 'invalid token' }), { status: 200 });
        }

        if (u.includes('/exchange/index.html')) {
          if (mode === 'HANG_OVER_45S') {
            await delayWithAbort(16000, init?.signal); // chạm AbortSignal.timeout(15000) x 3 attempts = 45s+
          }
          return new Response('<html></html>', { status: 200 });
        }
        if (u.includes('/exchange/captcha')) {
          return new Response(Buffer.from('fake-gif-captcha'), { status: 200 });
        }
        if (u.includes('/exchange/login')) {
          const bodyObj = init?.body ? JSON.parse(init.body) : {};
          if (bodyObj.captcha === 'WRONG1') {
            failedLoginCount++;
            return new Response(JSON.stringify({ code: 10007, msg: 'Incorrect verification code' }), {
              status: 200,
            });
          }
          acmLoginCalls++;
          activeToken = `acm-live-token-${acmLoginCalls}`;
          return new Response(JSON.stringify({ code: 0, data: { token: activeToken } }), {
            status: 200,
          });
        }
        if (
          u.includes('/exchange/business/tetptrade/export') ||
          u.includes('/exchange/business/tetporder/export')
        ) {
          return new Response(Buffer.from('mock-acm-xls-binary'), {
            status: 200,
            headers: { 'Content-Type': 'application/vnd.ms-excel' },
          });
        }
        return new Response('not found', { status: 404 });
      }) as any;
    };

    return {
      botJobQueueService,
      shiftScannerService,
      acmEtpAdapter,
      rpaScraperService,
      klgdReconService,
      jobsStore,
      shiftLogState,
      emittedWsEvents,
      systemLogs,
      createJob,
      installFetchMock,
      getGeminiModelsCalled: () => geminiModelsCalled,
      getAcmLoginCalls: () => acmLoginCalls,
    };
  }

  it('E2E-01: Tái hiện ca sự cố 23s ACM -> CQG không bị abort ở 15s, đối chiếu PASS toàn trình, rồi PM2 restart vẫn nhớ model thành công', async () => {
    const h = createFullE2EHarness({ cqgDelayAfterPreflightMs: 15000 });
    h.installFetchMock('VPS_INCIDENT_23S');

    const job1 = h.createJob('6af4a744f4ee477a282eab95');
    const p1 = (h.botJobQueueService as any).executeJobInPool(job1, 'RECON', ['MS', 'CQG', 'RECON']);

    await jest.advanceTimersByTimeAsync(60000);
    await p1;

    expect(job1.status).toBe('COMPLETED');
    expect(job1.error).toBeUndefined();
    expect(h.shiftLogState.details[0].status).toBe('PASSED');
    expect(h.rpaScraperService.downloadCqgBackup).toHaveBeenCalledTimes(1);
    expect(h.klgdReconService.runAutoCheckKLGD).toHaveBeenCalledTimes(1);
    expect(h.getGeminiModelsCalled()[0]).toBe('gemini-3.5-flash-lite');
    expect(h.systemLogs.some((l) => l.eventType === 'BOT_JOB_COMPLETED')).toBe(true);

    // Giả lập PM2 restart (xóa RAM state) -> model thắng vẫn được lưu trên đĩa
    CaptchaSolverHelper.resetStateForTesting();
    const persisted = fs.readFileSync(path.join(tmpDir, 'captcha_last_model.txt'), 'utf8').trim();
    expect(persisted).toBe('gemini-3.8-flash');
  });

  it('E2E-02: ACM retry nhiều lần (~30s) + CQG mở Chrome mất 50s (tổng ~80s > 70s cũ) vẫn chạy đối chiếu COMPLETED trọn vẹn nhờ tách đồng hồ Barrier', async () => {
    const h = createFullE2EHarness({ cqgDelayAfterPreflightMs: 50000 });
    h.installFetchMock('VPS_RETRY_38S');

    const job = h.createJob('6af3149c944cca36ec66ec21');
    const p = (h.botJobQueueService as any).executeJobInPool(job, 'RECON', ['MS', 'CQG', 'RECON']);

    await jest.advanceTimersByTimeAsync(110000);
    await p;

    expect(job.status).toBe('COMPLETED');
    expect(h.getAcmLoginCalls()).toBe(1);
    expect(h.rpaScraperService.downloadCqgBackup).toHaveBeenCalledTimes(1);
    expect(h.klgdReconService.runAutoCheckKLGD).toHaveBeenCalledTimes(1);
    expect(job.logs.some((l: string) => l.includes('Hết thời gian chờ CQG chuẩn bị'))).toBe(false);
    expect(h.shiftLogState.details[0].status).toBe('PASSED');
  });

  it('E2E-03: Khi ACM treo > 45s -> CQG Pre-flight Guard hủy an toàn, BotJobQueue + ShiftScanner đồng bộ ABORTED/NEEDS_ATTENTION (không ghi nhầm COMPLETED)', async () => {
    const h = createFullE2EHarness({ acmPreFlightHangMs: 60000 });
    h.installFetchMock('HANG_OVER_45S');

    const job = h.createJob('E2E_ABORTED_45S_JOB');
    const p = (h.botJobQueueService as any).executeJobInPool(job, 'RECON', ['MS', 'CQG', 'RECON']);

    await jest.advanceTimersByTimeAsync(75000);
    await p;

    expect(h.rpaScraperService.downloadCqgBackup).not.toHaveBeenCalled();
    expect(h.klgdReconService.runAutoCheckKLGD).not.toHaveBeenCalled();
    expect(job.status).toBe('ABORTED');
    expect(job.error).toContain('[CQG_ABORT_PREFLIGHT]');
    expect(job.error).toContain('sau 45s Pre-flight: ACM');

    const saved = h.jobsStore.get('E2E_ABORTED_45S_JOB');
    expect(saved.status).toBe('ABORTED');
    expect(saved.error).toContain('[CQG_ABORT_PREFLIGHT]');

    const lastWs = h.emittedWsEvents.filter((e) => e.type === 'job-status-updated').at(-1);
    expect(lastWs?.payload.status).toBe('ABORTED');
    expect(h.systemLogs.some((l) => l.eventType === 'BOT_JOB_COMPLETED')).toBe(false);

    expect(h.shiftLogState.details[0].status).toBe('NEEDS_ATTENTION');
    h.shiftLogState.details[0].status = 'WAITING';
    console.log('saved job status before sync:', saved.status, 'jobId:', 'E2E_ABORTED_45S_JOB');
    await h.shiftScannerService.syncJobResultToShift(
      'SHIFT_PROD_01',
      'TASK_KLGD_01',
      'E2E_ABORTED_45S_JOB',
      { id: 'bot', username: 'system_bot' },
    );
    console.log('shift task status after sync:', h.shiftLogState.details[0].status);
    expect(h.shiftLogState.details[0].status).toBe('NEEDS_ATTENTION');
  });

  it('E2E-04: Concurrent ACM Pre-flight + Backup Download lúc hết hạn session chỉ login đúng 1 lần (activeLoginPromise mutex)', async () => {
    const h = createFullE2EHarness({ acmGeminiDelayMs: 500, cqgDelayAfterPreflightMs: 500 });
    h.installFetchMock('FAST_CONCURRENT');

    const job = h.createJob('E2E_CONCURRENT_ACM_JOB');
    const pRecon = (h.botJobQueueService as any).executeJobInPool(job, 'RECON', ['MS', 'CQG', 'RECON']);
    const pBackup = h.acmEtpAdapter.download('ACM', {
      targetDate: '2026-11-11',
      targetDirectory: path.join(tmpDir, 'concurrent-backup'),
      reportCodes: ['ORDER', 'FILL'],
    });

    await jest.advanceTimersByTimeAsync(15000);
    const [, backupRes] = await Promise.all([pRecon, pBackup]);

    expect(job.status).toBe('COMPLETED');
    expect(backupRes.success).toBe(true);
    expect(h.getAcmLoginCalls()).toBe(1);
  });
});
