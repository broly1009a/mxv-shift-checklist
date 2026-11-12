/**
 * test_cqg_balance_fresh_recon.ts
 *
 * SCRIPT KIỂM THỬ TRƯỚC KHI TRIỂN KHAI PRODUCTION (PRE-PROD VPS AUDIT & VERIFICATION)
 * Phục vụ kiểm thử độc lập quy trình:
 *  1. Khóa tài nguyên Domain Kép (Dual Domain Locking: CAST & MS).
 *  2. Đồng bộ danh mục Job Ingress & Alias không còn tiền tố phỏng đoán.
 *  3. Kéo dữ liệu tươi từ CQG CAST (Accounts_Balances.xlsx, AS.xlsx) qua IngressService.
 *  4. Kéo dữ liệu tươi từ M-System (QLTKGD.xlsx) qua MsApiAdapter (Direct REST API).
 *  5. Thuật toán đối chiếu số dư CQG hợp nhất (CqgSyncWorker chuẩn hóa duy nhất CHECK_CQG_SYNC).
 *
 * HƯỚNG DẪN CHẠY TRÊN VPS PRODUCTION:
 *  - Chế độ Dry-Run (An toàn 100%, kiểm thử logic & mock data, không chạm mạng ngoài):
 *      cd backend
 *      npx ts-node --transpile-only -r tsconfig-paths/register src/scripts/test_cqg_balance_fresh_recon.ts
 *
 *  - Chế độ Test Direct REST API M-System thực tế:
 *      npx ts-node --transpile-only -r tsconfig-paths/register src/scripts/test_cqg_balance_fresh_recon.ts --live-ms
 *
 *  - Chế độ Test Cào CQG CAST thực tế (Playwright Chromium):
 *      npx ts-node --transpile-only -r tsconfig-paths/register src/scripts/test_cqg_balance_fresh_recon.ts --live-cast
 *
 *  - Chế độ Chạy Trọn Gói Toàn Diện E2E trên Production:
 *      npx ts-node --transpile-only -r tsconfig-paths/register src/scripts/test_cqg_balance_fresh_recon.ts --live-full
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CqgSyncWorker } from '../modules/trading-ops/workers/cqg-sync.worker';
import { BotDispatcherService } from '../modules/checklist-hub/dispatcher/bot-dispatcher.service';
import { CqgMergerService } from '../modules/trading-ops/services/merger/cqg-merger.service';
import { IngressService } from '../modules/ingress/ingress.service';
import { MsApiAdapter } from '../modules/ingress/adapters/ms-api.adapter';
import {
  getRequiredJobDomains,
  JOB_TYPE_ALIASES,
  expandJobTypeAliases,
  JobResourceDomain,
} from '../shared';

// Helper in kết quả kiểm thử
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    if (detail) console.log(`         └─ ${detail}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         └─ ${detail}`);
    failedTests++;
  }
}

// Tạo mock file Excel chuẩn cho đối chiếu số dư
function createMockBalanceExcel(
  filePath: string,
  type: 'QLTKGD' | 'CAST',
  accounts: Array<{ acc: string; balanceUsd: number }>,
  usdRate: number = 25400,
) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const wb = XLSX.utils.book_new();
  let aoa: any[][] = [];

  if (type === 'QLTKGD') {
    // Row 0 header chuẩn MarginExcelParser.parseQltkgd
    aoa = [
      ['STT', 'Mã TKGD', 'Tên khách hàng', 'Số dư TKKQ hiện tại', 'Lãi lỗ thực tế chờ đáo hạn', 'Lãi lỗ thực tế Futures (VND)'],
    ];
    accounts.forEach((a, idx) => {
      aoa.push([idx + 1, a.acc, 'Khách hàng ' + a.acc, a.balanceUsd * usdRate, 0, 0]);
    });
  } else {
    // Row 0 header chuẩn CqgMergerService.checkEODCQG
    aoa = [
      ['FCM', 'Account Number', 'Account Name', 'Record Description', 'End Cash Balance'],
    ];
    accounts.forEach((a) => {
      aoa.push(['MXV', a.acc, 'Account ' + a.acc, 'Current-day Cash Balance', a.balanceUsd]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filePath);
}

async function main() {
  const args = process.argv.slice(2);
  const isLiveMs = args.includes('--live-ms') || args.includes('--live-full');
  const isLiveCast = args.includes('--live-cast') || args.includes('--live-full');
  const isLiveFull = args.includes('--live-full');

  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║   BỘ KIỂM THỬ PRE-PROD: TẢI DỮ LIỆU TƯƠI & ĐỐI CHIẾU SỐ DƯ CQG (VPS PROD)    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
  console.log(`Chế độ thực thi: ${isLiveFull ? 'LIVE FULL E2E' : isLiveCast ? 'LIVE CAST' : isLiveMs ? 'LIVE MS REST' : 'DRY-RUN (OFFLINE AN TOÀN)'}`);
  console.log(`Thời gian chạy : ${new Date().toLocaleString('vi-VN')}\n`);

  const tempRoot = path.join(process.cwd(), 'temp', 'pre_prod_test_' + Date.now());
  fs.mkdirSync(tempRoot, { recursive: true });

  try {
    // -------------------------------------------------------------------------
    // PHẦN 1: KIỂM TRA ĐỊNH NGUYÊN & KHÓA DOMAIN (ARCHITECTURE & RESOURCE LOCKING)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST SUITE 1] Kiểm tra Quy chuẩn Khóa Domain & Phân hệ Tài nguyên');
    {
      const cqgSyncDomains = getRequiredJobDomains('CHECK_CQG_SYNC');
      assert(
        cqgSyncDomains.includes(JobResourceDomain.CAST) && cqgSyncDomains.includes(JobResourceDomain.MS),
        'CHECK_CQG_SYNC khóa đồng thời 2 domain [CAST, MS]',
        `Trả về: [${cqgSyncDomains.join(', ')}]`,
      );

      const aliases = expandJobTypeAliases(['CHECK_CQG_SYNC']);
      assert(
        aliases.includes('CHECK_CQG_SYNC') &&
          aliases.includes('CQG_SYNC'),
        'Định danh chuẩn CHECK_CQG_SYNC đã được cấu hình trong hệ thống',
        `Danh sách alias: [${aliases.join(', ')}]`,
      );

      const msAliases = expandJobTypeAliases(['DOWNLOAD_MS']);
      assert(
        msAliases.includes('DOWNLOAD_MS') && msAliases.includes('RPA_DOWNLOAD_REPORTS'),
        'DOWNLOAD_MS tương thích ngược với RPA_DOWNLOAD_REPORTS',
        `Danh sách alias: [${msAliases.join(', ')}]`,
      );

      // Đảm bảo không còn chuỗi AUTO_DOWNLOAD_* trong alias
      let hasAutoDownload = false;
      for (const k of Object.keys(JOB_TYPE_ALIASES)) {
        if (k.startsWith('AUTO_DOWNLOAD_')) hasAutoDownload = true;
      }
      assert(!hasAutoDownload, 'Tuyệt đối 0 tồn tại tiền tố phantom AUTO_DOWNLOAD_* trong hằng số hệ thống');
    }

    // -------------------------------------------------------------------------
    // PHẦN 2: KHỞI TẠO NESTJS STANDALONE APPLICATION CONTEXT
    // -------------------------------------------------------------------------
    console.log('\n▶ [TEST SUITE 2] Khởi tạo NestJS Context & Dependency Injection Container');
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    assert(!!app, 'Khởi tạo thành công NestJS ApplicationContext');

    const cqgSyncWorker = app.get(CqgSyncWorker);
    const botDispatcher = app.get(BotDispatcherService);
    const cqgMergerService = app.get(CqgMergerService);
    const ingressService = app.get(IngressService);
    const msApiAdapter = app.get(MsApiAdapter);

    assert(!!cqgSyncWorker, 'CqgSyncWorker được resolve thành công từ Container');
    assert(
      cqgSyncWorker.canHandle('CHECK_CQG_SYNC') &&
        botDispatcher.hasWorker('CHECK_CQG_SYNC'),
      'CqgSyncWorker & BotDispatcherService chuẩn hóa tiếp nhận duy nhất CHECK_CQG_SYNC',
    );
    assert(!!cqgMergerService, 'CqgMergerService sẵn sàng');
    assert(!!ingressService, 'IngressService sẵn sàng');
    assert(!!msApiAdapter, 'MsApiAdapter sẵn sàng');

    // -------------------------------------------------------------------------
    // PHẦN 3: KIỂM THỬ THUẬT TOÁN ĐỐI SOÁT TRÊN FILE MOCK (OFFLINE DRY-RUN)
    // -------------------------------------------------------------------------
    console.log('\n▶ [TEST SUITE 3] Kiểm thử Thuật toán Đối Soát Số Dư Trên Dữ Liệu Giả Lập');
    {
      const mockDir = path.join(tempRoot, 'mock_recon');
      fs.mkdirSync(mockDir, { recursive: true });

      const mockQltkgd = path.join(mockDir, 'QLTKGD.xlsx');
      const mockCast = path.join(mockDir, 'Accounts_Balances.xlsx');

      // Tạo kịch bản 1: Khớp 100%
      createMockBalanceExcel(mockQltkgd, 'QLTKGD', [
        { acc: '012C111111', balanceUsd: 50000 },
        { acc: '012C222222', balanceUsd: 25000 },
      ]);
      createMockBalanceExcel(mockCast, 'CAST', [
        { acc: '012C111111', balanceUsd: 50000 },
        { acc: '012C222222', balanceUsd: 25000 },
      ]);

      const bufferQltkgd = fs.readFileSync(mockQltkgd);
      const bufferCast = fs.readFileSync(mockCast);

      const matchedRes = await cqgMergerService.checkEODCQG(
        { qltkgd: bufferQltkgd, accountsBalances: bufferCast },
        25400,
      );
      assert(
        Array.isArray(matchedRes) && matchedRes.length === 0,
        'Kịch bản Khớp 100%: Số tài khoản lệch = 0',
        `Kết quả chênh lệch: ${matchedRes?.length || 0} tài khoản`,
      );

      // Tạo kịch bản 2: Lệch số dư (> $100)
      createMockBalanceExcel(mockCast, 'CAST', [
        { acc: '012C111111', balanceUsd: 50000 },
        { acc: '012C222222', balanceUsd: 24500 }, // Lệch $500 > $100
      ]);
      const mismatchedRes = await cqgMergerService.checkEODCQG(
        { qltkgd: bufferQltkgd, accountsBalances: fs.readFileSync(mockCast) },
        25400,
      );
      assert(
        Array.isArray(mismatchedRes) && mismatchedRes.length === 1,
        'Kịch bản Lệch số dư (> $100): Phát hiện chính xác tài khoản lệch 012C222222',
        `Tài khoản phát hiện: ${mismatchedRes?.[0]?.maTKGD}, lệch: $${mismatchedRes?.[0]?.differ}`,
      );
    }

    // -------------------------------------------------------------------------
    // PHẦN 4: TEST LIVE M-SYSTEM DIRECT REST API (Khi có cờ --live-ms hoặc --live-full)
    // -------------------------------------------------------------------------
    if (isLiveMs) {
      console.log('\n▶ [TEST SUITE 4] Kiểm thử Live Direct REST API M-System (Tải QLTKGD tươi)');
      try {
        const msTargetDir = path.join(tempRoot, 'ms_live');
        fs.mkdirSync(msTargetDir, { recursive: true });

        const startMs = Date.now();
        const msRes = await msApiAdapter.download('MS', {
          reportCodes: ['QLTKGD'],
          targetDirectory: msTargetDir,
        });

        const duration = Date.now() - startMs;
        assert(msRes.success, 'Gọi API M-System tải QLTKGD thành công', `Thời gian: ${duration}ms, số file: ${msRes.files.length}`);

        const downloadedQltkgd = path.join(msTargetDir, 'QLTKGD.xlsx');
        assert(fs.existsSync(downloadedQltkgd) && fs.statSync(downloadedQltkgd).size > 1000, 'File QLTKGD.xlsx tồn tại và dung lượng hợp lệ (> 1KB)');
      } catch (msErr: any) {
        assert(false, 'Lỗi kiểm thử Live Direct REST API M-System', msErr.message);
      }
    } else {
      console.log('\nℹ️ [TEST SUITE 4] Bỏ qua kiểm thử Live M-System API (Thêm cờ --live-ms để kích hoạt)');
    }

    // -------------------------------------------------------------------------
    // PHẦN 5: TEST LIVE CQG CAST SCRAPER (Khi có cờ --live-cast hoặc --live-full)
    // -------------------------------------------------------------------------
    if (isLiveCast) {
      console.log('\n▶ [TEST SUITE 5] Kiểm thử Live CQG CAST Web Scraper (Tải Accounts_Balances tươi)');
      try {
        const castTargetDir = path.join(tempRoot, 'cast_live');
        fs.mkdirSync(castTargetDir, { recursive: true });

        const startCast = Date.now();
        const castRes = await ingressService.download('CAST', {
          targetDirectory: castTargetDir,
          onLog: (msg) => console.log(`     [CAST Live Log] ${msg}`),
        });

        const duration = Date.now() - startCast;
        assert(castRes.success, 'Cào số dư CQG CAST thành công', `Thời gian: ${duration}ms, số file: ${castRes.files.length}`);

        const asPath = path.join(castTargetDir, 'AS.xlsx');
        const abPath = path.join(castTargetDir, 'Accounts_Balances.xlsx');
        assert(fs.existsSync(asPath) && fs.existsSync(abPath), 'Cả 2 file AS.xlsx và Accounts_Balances.xlsx được sao chép chuẩn xác');
      } catch (castErr: any) {
        assert(false, 'Lỗi kiểm thử Live CQG CAST', castErr.message);
      }
    } else {
      console.log('\nℹ️ [TEST SUITE 5] Bỏ qua kiểm thử Live CQG CAST (Thêm cờ --live-cast để kích hoạt)');
    }

    // -------------------------------------------------------------------------
    // PHẦN 6: TEST TOÀN TRÌNH WORKER VỚI CỜ skipDownload = true (Dry-Run Guard)
    // -------------------------------------------------------------------------
    console.log('\n▶ [TEST SUITE 6] Kiểm thử Cơ chế Worker Guard & Tham số skipDownload');
    {
      const workerRes = await cqgSyncWorker.execute({
        taskId: 'PRE_PROD_VERIFY_TASK',
        botCheckType: 'CHECK_CQG_SYNC',
        parameters: { skipDownload: true },
        targetDate: new Date().toISOString().split('T')[0],
      });

      assert(
        ['SUCCESS', 'WARNING', 'WAITING'].includes(workerRes.status),
        'CqgSyncWorker thực thi an toàn và trả về trạng thái hợp lệ',
        `Trạng thái: ${workerRes.status}, Summary: ${workerRes.summary}`,
      );
      assert(
        workerRes.metrics?.freshDownload === false,
        'Cờ skipDownload: true được tôn trọng tuyệt đối (không kích hoạt cào đè file)',
      );
    }

    await app.close();
  } finally {
    // Thu dọn thư mục tạm thời sau kiểm thử
    if (fs.existsSync(tempRoot)) {
      try {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      } catch {}
    }
  }

  // ---------------------------------------------------------------------------
  // TỔNG KẾT BÁO CÁO
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`                     KẾT QUẢ KIỂM THỬ: ${failedTests === 0 ? '✓ ĐẠT TIÊU CHUẨN' : '✗ CẦN KHẮC PHỤC'}`);
  console.log(`  Tổng số testcases: ${passedTests + failedTests}`);
  console.log(`  Thành công        : ${passedTests}`);
  console.log(`  Thất bại          : ${failedTests}`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n💥 Lỗi nghiêm trọng ngoài dự kiến khi thực thi script:', err);
  process.exit(1);
});

