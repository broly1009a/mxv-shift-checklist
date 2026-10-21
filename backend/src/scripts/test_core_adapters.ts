/**
 * test_core_adapters.ts
 * 
 * Script kiểm thử chuyên biệt để kiểm tra tính năng tải báo cáo của:
 *  1. CoreCcpApiAdapter (phân hệ Bù trừ & Ký quỹ CoreCCP - VNCLEAR)
 *  2. CoreExApiAdapter  (phân hệ Sàn liên thông Core Exchange - CoreEX)
 * 
 * Hướng dẫn chạy:
 *   cd backend
 *   npx ts-node src/scripts/test_core_adapters.ts
 * 
 * Các cờ tùy chọn (CLI Flags):
 *   --adapter=all|ccp|ce         (Mặc định: all - kiểm tra cả 2)
 *   --date=YYYY-MM-DD            (Mặc định: Ngày hôm nay hoặc phiên hiện tại)
 *   --out=/path/to/folder        (Mặc định: ./temp/test_adapters_output)
 *   --full                       (Tải toàn bộ danh mục báo cáo thay vì mẫu)
 *   --reports=CODE1,CODE2        (Chỉ định danh sách mã báo cáo cụ thể)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { CoreCcpApiAdapter } from '../modules/ingress/adapters/coreccp-api.adapter';
import { CoreExApiAdapter } from '../modules/ingress/adapters/coreex-api.adapter';
import { IngressDownloadResult, IngressFileDetail, decrypt } from '../shared';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// ── 1. ĐỌC THAM SỐ DÒNG LỆNH (CLI ARGS) ──────────────────────────────────────
function parseCliArgs(): {
  adapter: 'all' | 'ccp' | 'ce';
  targetDate: string;
  outputDir: string;
  isFullBackup: boolean;
  customReports?: string[];
} {
  const args = process.argv.slice(2);
  let adapter: 'all' | 'ccp' | 'ce' = 'all';
  let targetDate = new Date().toISOString().split('T')[0];
  let outputDir = path.join(process.cwd(), 'temp', 'test_adapters_output');
  let isFullBackup = false;
  let customReports: string[] | undefined = undefined;

  for (const arg of args) {
    if (arg.startsWith('--adapter=')) {
      const val = arg.split('=')[1].toLowerCase();
      if (val === 'ccp' || val === 'ce' || val === 'all') {
        adapter = val;
      }
    } else if (arg.startsWith('--date=')) {
      targetDate = arg.split('=')[1].trim();
    } else if (arg.startsWith('--out=')) {
      outputDir = path.resolve(arg.split('=')[1].trim());
    } else if (arg === '--full') {
      isFullBackup = true;
    } else if (arg.startsWith('--reports=')) {
      customReports = arg
        .split('=')[1]
        .split(',')
        .map((r) => r.trim().toUpperCase())
        .filter(Boolean);
    }
  }

  return { adapter, targetDate, outputDir, isFullBackup, customReports };
}

// ── 2. KHỞI TẠO ADAPTERS (STANDALONE MONGOOSE BOOTSTRAP SIÊU TỐC) ─────────────
async function bootstrapAdapters(): Promise<{
  ccpAdapter: CoreCcpApiAdapter;
  coreExAdapter: CoreExApiAdapter;
  cleanup: () => Promise<void>;
}> {
  const mongoUri =
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  let dbConnected = false;
  const cachedSettings: Record<string, string> = {};

  try {
    console.log('[Setup] Đang kết nối MongoDB để nạp cấu hình & tài khoản bảo mật...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    dbConnected = true;
    const settingsColl = mongoose.connection.collection('system_settings');
    const docs = await settingsColl.find({}).toArray();
    for (const doc of docs) {
      if (doc.key && typeof doc.value === 'string') {
        cachedSettings[doc.key] = doc.value;
      }
    }
    console.log(`[Setup] Đã nạp thành công ${Object.keys(cachedSettings).length} cấu hình từ MongoDB system_settings.`);
  } catch (dbErr: any) {
    console.warn(`[Setup] Không thể kết nối MongoDB (${dbErr.message}). Sẽ tự động lấy cấu hình từ biến môi trường .env.`);
  }

  const mockSettingsService: any = {
    getSetting: async (key: string, defaultValue = '') => {
      if (cachedSettings[key] !== undefined) return cachedSettings[key];
      return defaultValue;
    },
  };

  const ccpAdapter = new CoreCcpApiAdapter(mockSettingsService);
  const coreExAdapter = new CoreExApiAdapter(mockSettingsService);

  return {
    ccpAdapter,
    coreExAdapter,
    cleanup: async () => {
      if (dbConnected && mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    },
  };
}

// ── 3. HÀM KIỂM TRA ĐẶC ĐIỂM FILE EXCEL TRÊN ĐĨA ─────────────────────────────
async function inspectExcelFile(filePath: string): Promise<{
  exists: boolean;
  sizeBytes: number;
  rowCount: number;
  colCount: number;
  sheetName: string;
  sampleHeaders: string[];
}> {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      sizeBytes: 0,
      rowCount: 0,
      colCount: 0,
      sheetName: 'NOT_FOUND',
      sampleHeaders: [],
    };
  }

  const stat = fs.statSync(filePath);
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        exists: true,
        sizeBytes: stat.size,
        rowCount: 0,
        colCount: 0,
        sheetName: 'EMPTY_WORKBOOK',
        sampleHeaders: [],
      };
    }

    const rowCount = worksheet.rowCount;
    const colCount = worksheet.columnCount;
    const firstRow = worksheet.getRow(1);
    const sampleHeaders: string[] = [];

    firstRow.eachCell((cell, colNumber) => {
      if (colNumber <= 8) {
        sampleHeaders.push(String(cell.value || '').trim());
      }
    });

    return {
      exists: true,
      sizeBytes: stat.size,
      rowCount,
      colCount,
      sheetName: worksheet.name,
      sampleHeaders,
    };
  } catch (err: any) {
    return {
      exists: true,
      sizeBytes: stat.size,
      rowCount: -1,
      colCount: -1,
      sheetName: `ERROR_PARSING: ${err.message}`,
      sampleHeaders: [],
    };
  }
}

// ── 4. CHẠY KIỂM THỬ CORECCP API ADAPTER ──────────────────────────────────────
async function testCoreCcp(
  adapter: CoreCcpApiAdapter,
  targetDate: string,
  baseOutputDir: string,
  isFullBackup: boolean,
  customReports?: string[],
): Promise<{
  success: boolean;
  durationMs: number;
  files: Array<{ name: string; size: number; rows: number; path: string }>;
  error?: string;
}> {
  console.log('\n================================================================================');
  console.log(`[TEST 1] TIẾN HÀNH TEST CORECCP API ADAPTER (BÙ TRỪ & KÝ QUỸ)`);
  console.log(`  - Ngày phiên: ${targetDate}`);
  console.log(`  - Chế độ: ${isFullBackup ? 'FULL BACKUP (Toàn bộ 12 báo cáo)' : 'CHỌN LỌC'}`);
  console.log('================================================================================');

  const ccpOutputDir = path.join(baseOutputDir, 'CCP', targetDate);
  if (!fs.existsSync(ccpOutputDir)) fs.mkdirSync(ccpOutputDir, { recursive: true });

  const defaultCcpReports = ['DSGD_CCP', 'TTM_CCP', 'QL_TT_TKGD', 'GTT_CCP', 'HH'];
  const reportCodes = isFullBackup
    ? ['FULL']
    : customReports && customReports.length > 0
    ? customReports
    : defaultCcpReports;

  console.log(`[CoreCCP] Danh sách báo cáo yêu cầu: [${reportCodes.join(', ')}]`);
  console.log(`[CoreCCP] Thư mục lưu đích: ${ccpOutputDir}`);

  const t0 = Date.now();
  try {
    // 1. Kiểm tra xác thực lấy Session
    console.log('[CoreCCP] Bước 1: Kiểm tra xác thực OAuth2 & lấy Bearer Session...');
    const session = await adapter.getValidSession();
    console.log(`[CoreCCP]   => Đăng nhập thành công! User: ${session.username}, Token hiệu lực đến: ${new Date(session.expiresAt).toLocaleTimeString('vi-VN')}`);

    // 2. Kích hoạt hàm download cốt lõi
    console.log('[CoreCCP] Bước 2: Kích hoạt download()...');
    const result: IngressDownloadResult = await adapter.download('CCP', {
      targetDate,
      outputDir: ccpOutputDir,
      reportCodes,
      isFullBackup,
    });

    const durationMs = Date.now() - t0;
    console.log(`[CoreCCP]   => Kết quả trả về: success=${result.success}, số file=${result.files.length} (${durationMs}ms)`);
    if (result.error) {
      console.warn(`[CoreCCP]   => Cảnh báo lỗi: ${result.error}`);
    }

    // 3. Kiểm tra tính toàn vẹn của các file thực tế trên đĩa
    console.log('[CoreCCP] Bước 3: Kiểm tra cấu trúc các file Excel trên đĩa...');
    const filesDetail: Array<{ name: string; size: number; rows: number; path: string }> = [];

    for (const f of result.files) {
      const inspect = await inspectExcelFile(f.absolutePath);
      console.log(
        `  + [${f.fileName}]: ${f.fileSize || inspect.sizeBytes} bytes | Sheet: "${inspect.sheetName}" | ${inspect.rowCount} dòng x ${inspect.colCount} cột`,
      );
      if (inspect.sampleHeaders.length > 0) {
        console.log(`    Tiêu đề mẫu: [${inspect.sampleHeaders.slice(0, 4).join(', ')}...]`);
      }
      filesDetail.push({
        name: f.fileName,
        size: inspect.sizeBytes,
        rows: inspect.rowCount,
        path: f.absolutePath,
      });
    }

    return {
      success: result.success && filesDetail.length > 0,
      durationMs,
      files: filesDetail,
      error: result.error,
    };
  } catch (err: any) {
    const durationMs = Date.now() - t0;
    console.error(`[CoreCCP] Thất bại khi thực thi: ${err.message}`);
    return {
      success: false,
      durationMs,
      files: [],
      error: err.message,
    };
  }
}

// ── 5. CHẠY KIỂM THỬ COREEX API ADAPTER ───────────────────────────────────────
async function testCoreEx(
  adapter: CoreExApiAdapter,
  targetDate: string,
  baseOutputDir: string,
  isFullBackup: boolean,
  customReports?: string[],
): Promise<{
  success: boolean;
  durationMs: number;
  files: Array<{ name: string; size: number; rows: number; path: string }>;
  error?: string;
}> {
  console.log('\n================================================================================');
  console.log(`[TEST 2] TIẾN HÀNH TEST COREEX API ADAPTER (SÀN LIÊN THÔNG CORE EXCHANGE)`);
  console.log(`  - Ngày phiên: ${targetDate}`);
  console.log(`  - Chế độ: ${isFullBackup ? 'FULL BACKUP (Toàn bộ báo cáo)' : 'CHỌN LỌC'}`);
  console.log('================================================================================');

  const ceOutputDir = path.join(baseOutputDir, 'CoreExchange', targetDate);
  if (!fs.existsSync(ceOutputDir)) fs.mkdirSync(ceOutputDir, { recursive: true });

  const defaultCeReports = ['DSGD', 'DSL', 'GTT', 'HH', 'SESSION_INFO'];
  const reportCodes = isFullBackup
    ? ['FULL']
    : customReports && customReports.length > 0
    ? customReports
    : defaultCeReports;

  console.log(`[CoreEX] Danh sách báo cáo yêu cầu: [${reportCodes.join(', ')}]`);
  console.log(`[CoreEX] Thư mục lưu đích: ${ceOutputDir}`);

  const t0 = Date.now();
  try {
    // 1. Kiểm tra sức khỏe kết nối CoreEX
    console.log('[CoreEX] Bước 1: Kiểm tra kết nối sàn CoreEX (checkHealth)...');
    const isHealthy = await adapter.checkHealth();
    console.log(`[CoreEX]   => Kết nối HTTP /login: ${isHealthy ? 'KHẢ DỤNG (OK)' : 'KHÔNG PHẢN HỒI (Cần kiểm tra mạng / URL)'}`);

    // 2. Kiểm tra xác thực lấy Session Cookie
    console.log('[CoreEX] Bước 2: Kiểm tra xác thực CSRF + OAuth2 & lấy Session Cookie...');
    const session = await adapter.getValidSession();
    console.log(`[CoreEX]   => Đăng nhập thành công! User: ${session.username}, Session Cookie: ${session.sessionCookie ? 'CÓ (SESSION=...)' : 'KHÔNG'}`);

    // 3. Kích hoạt hàm download cốt lõi
    console.log('[CoreEX] Bước 3: Kích hoạt download()...');
    const result: IngressDownloadResult = await adapter.download('CORE_EX', {
      targetDate,
      outputDir: ceOutputDir,
      reportCodes,
      isFullBackup,
    });

    const durationMs = Date.now() - t0;
    console.log(`[CoreEX]   => Kết quả trả về: success=${result.success}, số file=${result.files.length} (${durationMs}ms)`);
    if (result.error) {
      console.warn(`[CoreEX]   => Cảnh báo lỗi: ${result.error}`);
    }

    // 4. Kiểm tra tính toàn vẹn của các file thực tế trên đĩa
    console.log('[CoreEX] Bước 4: Kiểm tra cấu trúc các file Excel trên đĩa...');
    const filesDetail: Array<{ name: string; size: number; rows: number; path: string }> = [];

    for (const f of result.files) {
      const inspect = await inspectExcelFile(f.absolutePath);
      console.log(
        `  + [${f.fileName}]: ${f.fileSize || inspect.sizeBytes} bytes | Sheet: "${inspect.sheetName}" | ${inspect.rowCount} dòng x ${inspect.colCount} cột`,
      );
      if (inspect.sampleHeaders.length > 0) {
        console.log(`    Tiêu đề mẫu: [${inspect.sampleHeaders.slice(0, 4).join(', ')}...]`);
      }
      filesDetail.push({
        name: f.fileName,
        size: inspect.sizeBytes,
        rows: inspect.rowCount,
        path: f.absolutePath,
      });
    }

    return {
      success: result.success && filesDetail.length > 0,
      durationMs,
      files: filesDetail,
      error: result.error,
    };
  } catch (err: any) {
    const durationMs = Date.now() - t0;
    console.error(`[CoreEX] Thất bại khi thực thi: ${err.message}`);
    return {
      success: false,
      durationMs,
      files: [],
      error: err.message,
    };
  }
}

// ── 6. HÀM MAIN ĐIỀU PHỐI VÀ TỔNG HỢP KẾT QUẢ ───────────────────────────────
async function main() {
  const { adapter, targetDate, outputDir, isFullBackup, customReports } = parseCliArgs();

  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       SUITE KIỂM THỬ TỰ ĐỘNG CORE INGRESS ADAPTERS: CORECCP & COREEX           ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`- Mục tiêu kiểm tra : ${adapter.toUpperCase()}`);
  console.log(`- Ngày phiên        : ${targetDate}`);
  console.log(`- Thư mục xuất file : ${outputDir}`);
  console.log(`- Chế độ sao lưu    : ${isFullBackup ? 'FULL BACKUP' : 'TIÊU CHUẨN'}`);

  const { ccpAdapter, coreExAdapter, cleanup } = await bootstrapAdapters();

  let ccpRes: any = null;
  let ceRes: any = null;

  try {
    if (adapter === 'all' || adapter === 'ccp') {
      ccpRes = await testCoreCcp(ccpAdapter, targetDate, outputDir, isFullBackup, customReports);
    }

    if (adapter === 'all' || adapter === 'ce') {
      ceRes = await testCoreEx(coreExAdapter, targetDate, outputDir, isFullBackup, customReports);
    }
  } finally {
    await cleanup();
  }

  // BẢNG TỔNG KẾT
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          BẢNG TỔNG HỢP KẾT QUẢ KIỂM THỬ                         ║');
  console.log('╠══════════════════╦══════════════╦════════════════╦══════════════╦══════════════╣');
  console.log('║ Adapter          ║ Trạng thái   ║ Số file tải về ║ Thời gian    ║ Ghi chú      ║');
  console.log('╠══════════════════╬══════════════╬════════════════╬══════════════╬══════════════╣');

  if (ccpRes) {
    const stt = ccpRes.success ? 'THÀNH CÔNG' : 'THẤT BẠI';
    const note = ccpRes.error ? ccpRes.error.substring(0, 30) : 'Tải & Ghi Excel OK';
    console.log(
      `║ CoreCcpApiAdapter║ ${stt.padEnd(12)} ║ ${(ccpRes.files.length + ' file').padEnd(14)} ║ ${(ccpRes.durationMs + 'ms').padEnd(12)} ║ ${note.padEnd(12)} ║`,
    );
  }

  if (ceRes) {
    const stt = ceRes.success ? 'THÀNH CÔNG' : 'THẤT BẠI';
    const note = ceRes.error ? ceRes.error.substring(0, 30) : 'Tải & Ghi Excel OK';
    console.log(
      `║ CoreExApiAdapter ║ ${stt.padEnd(12)} ║ ${(ceRes.files.length + ' file').padEnd(14)} ║ ${(ceRes.durationMs + 'ms').padEnd(12)} ║ ${note.padEnd(12)} ║`,
    );
  }
  console.log('╚══════════════════╩══════════════╩════════════════╩══════════════╩══════════════╝\n');

  const allPassed = (!ccpRes || ccpRes.success) && (!ceRes || ceRes.success);
  if (allPassed) {
    console.log('🎉 TẤT CẢ CÁC BỘ TẢI DỮ LIỆU ĐÃ VƯỢT QUA KIỂM THỬ!');
    process.exit(0);
  } else {
    console.error(' CÓ BỘ TẢI DỮ LIỆU BỊ LỖI. VUI LÒNG KIỂM TRA LẠI LOG TRÊN.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
