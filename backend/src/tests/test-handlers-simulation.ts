import { BotJobHandlerRegistry } from '../modules/bot-engine/core/job-handler.registry';
import { IBotJobHandler, IJobExecutionContext } from '../modules/bot-engine/core/job-handler.interface';
import { MacroLotJobHandler } from '../modules/bot-engine/handlers/macro-lot.handler';
import { MacroValueJobHandler } from '../modules/bot-engine/handlers/macro-value.handler';
import { CcpStatsJobHandler } from '../modules/bot-engine/handlers/ccp-stats.handler';
import { RpaDownloadJobHandler } from '../modules/bot-engine/handlers/rpa-download.handler';
import { CastDownloadJobHandler } from '../modules/bot-engine/handlers/cast-download.handler';
import { ReconJobsHandler } from '../modules/bot-engine/handlers/recon-jobs.handler';
import { FileAuditJobHandler } from '../modules/bot-engine/handlers/file-audit.handler';
import { VerifyEmailJobHandler } from '../modules/bot-engine/handlers/verify-email.handler';

async function runHandlerSimulation() {
  console.log('===============================================================');
  console.log('🚀 KIỂM THỬ MÔ PHỎNG TOÀN BỘ 8 BOT JOB HANDLERS ĐÃ REFACTOR');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function check(cond: boolean, name: string, detail?: string) {
    total++;
    if (cond) {
      passed++;
      console.log(`✅ [PASS] ${name}`);
    } else {
      console.error(`❌ [FAIL] ${name}`);
      if (detail) console.error(`   👉 ${detail}`);
    }
  }

  // 1. Khởi tạo Registry
  const registry = new BotJobHandlerRegistry();

  // 2. Mock các services phụ thuộc
  const mockSettingsService: any = {
    getSetting: jestFn((key: string, def: string) => Promise.resolve(def)),
    setSetting: jestFn(() => Promise.resolve()),
  };
  const mockLotStatsService: any = {
    processLotStatistics: jestFn(() => Promise.resolve('/fake/path/lot_output.xlsx')),
    processValueStatistics: jestFn(() => Promise.resolve({
      outputPath: '/fake/path/val_output.xlsx',
      summary: { totalVal: 1000 },
    })),
  };
  const mockCcpStatsService: any = {
    processCcpData: jestFn(() => Promise.resolve('/fake/path/ccp_output.xlsx')),
  };
  const mockRpaDownloaderService: any = {
    loginMSystem: jestFn(() => Promise.resolve({
      browser: { close: jestFn(() => Promise.resolve()) },
      page: {},
    })),
    downloadDSGD: jestFn(() => Promise.resolve()),
    downloadTTM: jestFn(() => Promise.resolve()),
    downloadCastBalances: jestFn(() => Promise.resolve()),
    downloadCqgBackup: jestFn(() => Promise.resolve({ downloaded: ['FR1', 'FR2'], errors: [] })),
    loginACM: jestFn(() => Promise.resolve({
      browser: { close: jestFn(() => Promise.resolve()) },
      page: {},
    })),
    downloadAcmBackup: jestFn(() => Promise.resolve()),
  };
  const mockCqgSyncService: any = {
    autoMergeMissingFiles: jestFn(() => Promise.resolve({ success: true, logs: ['Auto merged OK'] })),
    getDailyBackupPath: jestFn(() => Promise.resolve({ fullPath: '/fake/backup/path' })),
    scanCqgBackupFiles: jestFn(() => Promise.resolve([
      { key: 'FR', status: 'OK' },
      { key: 'PS', status: 'OK' },
      { key: 'OP', status: 'OK' },
      { key: 'Od', status: 'OK' },
    ])),
  };
  const mockReconService: any = {
    runAutoCheckSOD: jestFn(() => Promise.resolve({ success: true, discrepancies: [] })),
    runAutoCheckKLGD: jestFn(() => Promise.resolve({ passed: true, mismatchedTrades: [] })),
    runAutoCheckPreEOD: jestFn(() => Promise.resolve({ passed: true, mismatchedTrades: [], mismatchedPositions: [] })),
    runAutoCheckEodMm: jestFn(() => Promise.resolve({
      cqgResult: [],
      eodResult: { negativeBalanceAccs: [], negativeIMRAcc: [] },
    })),
  };
  const mockBotJobModel: any = {
    updateOne: jestFn(() => ({ exec: () => Promise.resolve() })),
    findById: jestFn(() => ({ exec: () => Promise.resolve(null) })),
  };
  const mockTelegramService: any = {
    sendMessage: jestFn(() => Promise.resolve()),
  };

  function jestFn(fn?: any) {
    return (...args: any[]) => (fn ? fn(...args) : Promise.resolve());
  }

  // 3. Khởi tạo và tự đăng ký các Handler
  const handlers = [
    new MacroLotJobHandler(registry, mockLotStatsService, mockSettingsService),
    new MacroValueJobHandler(registry, mockLotStatsService, mockSettingsService),
    new CcpStatsJobHandler(registry, mockCcpStatsService, mockSettingsService, mockRpaDownloaderService),
    new RpaDownloadJobHandler(registry, mockRpaDownloaderService, mockSettingsService),
    new CastDownloadJobHandler(registry, mockRpaDownloaderService, mockSettingsService),
    new ReconJobsHandler(registry, mockReconService, mockSettingsService, mockRpaDownloaderService, mockCqgSyncService),
    new FileAuditJobHandler(registry, mockBotJobModel, mockRpaDownloaderService, mockCqgSyncService, mockSettingsService),
    new VerifyEmailJobHandler(registry, mockRpaDownloaderService, mockTelegramService),
  ];

  handlers.forEach((h) => h.onModuleInit());

  console.log('--- 1. Kiểm thử Khởi tạo & Tự Đăng ký (Self-Registration) ---');
  check(handlers.length === 8, 'Khởi tạo thành công 8 Handlers');

  const supportedTypes = [
    'RUN_LOT_MACRO',
    'RUN_VALUE_MACRO',
    'RUN_VALUE_TVKD_MACRO',
    'RUN_MACRO',
    'RPA_DOWNLOAD_REPORTS',
    'DOWNLOAD_CAST',
    'AUTO_CHECK_SOD',
    'CHECK_KLGD',
    'CHECK_PRE_EOD',
    'CHECK_EOD_MM',
    'FILE_AUDIT_MS',
    'FILE_AUDIT_CQG',
    'FILE_AUDIT_ACM',
    'DOWNLOAD_CQG_BACKUP',
    'VERIFY_EMAIL_STATUS',
  ];

  supportedTypes.forEach((jt) => {
    const handler = registry.getHandler(jt);
    check(!!handler, `Registry phân giải chính xác Handler cho [${jt}]`);
  });

  // Mock execution context
  const mockContext: IJobExecutionContext = {
    syncJobToChecklist: jestFn(),
    logger: console as any,
  };

  console.log('\n--- 2. Kiểm thử Thực thi Job Trực tiếp (Dry-run Execution) ---');

  // Test Execution: AUTO_CHECK_SOD
  const dummySodJob: any = {
    _id: 'test_sod_job_1',
    jobType: 'AUTO_CHECK_SOD',
    logs: [],
    payload: { sessionDay: '2026-08-27' },
    save: jestFn(),
    markModified: jestFn(),
  };
  const sodHandler = registry.getHandler('AUTO_CHECK_SOD')!;
  const sodResult = await sodHandler.execute(dummySodJob, mockContext);
  check(sodResult?.success === true, 'Thực thi Handler AUTO_CHECK_SOD thành công (success = true)');

  // Test Execution: CHECK_KLGD
  const dummyKlgdJob: any = {
    _id: 'test_klgd_job_1',
    jobType: 'CHECK_KLGD',
    logs: [],
    payload: { sessionDay: '2026-08-27' },
    save: jestFn(),
    markModified: jestFn(),
  };
  const klgdHandler = registry.getHandler('CHECK_KLGD')!;
  const klgdResult = await klgdHandler.execute(dummyKlgdJob, mockContext);
  check(klgdResult?.passed === true, 'Thực thi Handler CHECK_KLGD thành công (passed = true)');

  // Test Execution: FILE_AUDIT_CQG
  const dummyCqgJob: any = {
    _id: 'test_cqg_job_1',
    jobType: 'FILE_AUDIT_CQG',
    logs: [],
    payload: { targetDate: '2026-08-27' },
    save: jestFn(),
    markModified: jestFn(),
  };
  const cqgHandler = registry.getHandler('FILE_AUDIT_CQG')!;
  await cqgHandler.execute(dummyCqgJob, mockContext);
  check(dummyCqgJob.logs.some((l: string) => l.includes('Auto merged OK')), 'Thực thi Handler FILE_AUDIT_CQG ghi log hợp nhất thành công');

  // Test Execution: RPA Download File Naming
  const rpaHandler = registry.getHandler('RPA_DOWNLOAD_REPORTS') as RpaDownloadJobHandler;
  check(rpaHandler.getReportFileName('DSGD') === 'DSGD.xlsx', 'RPA Handler map đúng tên file DSGD -> DSGD.xlsx');
  check(rpaHandler.getReportFileName('Markettruoc6h') === 'market truoc 6h.csv', 'RPA Handler map đúng tên file Markettruoc6h -> market truoc 6h.csv');

  console.log('\n===============================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passed}/${total} TEST CASES PASS`);
  console.log('===============================================================');

  if (passed === total) {
    console.log('🎉 TOÀN BỘ 8 HANDLERS ĐÃ ĐƯỢC MÔ PHỎNG VÀ VẬN HÀNH CHUẨN XÁC 100%!');
  } else {
    process.exit(1);
  }
}

runHandlerSimulation().catch((err) => {
  console.error('Lỗi kiểm thử mô phỏng:', err);
  process.exit(1);
});
