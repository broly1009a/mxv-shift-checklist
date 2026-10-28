/**
 * test_validate_ce_backup.ts
 * Script chạy kiểm thử tải thực tế phân hệ Core Exchange (CE) qua CoreExApiAdapter
 * và đếm chính xác số dòng, số cột, dung lượng thực tế trên đĩa để đối soát với bản thủ công 26.10.
 * 
 * Cách chạy:
 *   cd backend
 *   npx ts-node -r dotenv/config src/scripts/test_validate_ce_backup.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { CoreExApiAdapter } from '../modules/ingress/adapters/coreex-api.adapter';
import { decrypt } from '../shared';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function inspectFile(filePath: string): Promise<{ rowCount: number; colCount: number; sizeBytes: number; exists: boolean }> {
  if (!fs.existsSync(filePath)) {
    return { rowCount: 0, colCount: 0, sizeBytes: 0, exists: false };
  }
  const stat = fs.statSync(filePath);
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.worksheets[0];
    if (!ws) return { rowCount: 0, colCount: 0, sizeBytes: stat.size, exists: true };
    return {
      rowCount: Math.max(ws.rowCount - 1, 0), // Trừ dòng header
      colCount: ws.columnCount || 0,
      sizeBytes: stat.size,
      exists: true,
    };
  } catch {
    return { rowCount: 0, colCount: 0, sizeBytes: stat.size, exists: true };
  }
}

async function runCeValidation(): Promise<void> {
  console.log('='.repeat(95));
  console.log('KIỂM THỬ THỰC TẾ PHÂN HỆ BACKUP CORE EXCHANGE (CE) - ĐỐI SOÁT VỚI BẢN THỦ CÔNG 26.10');
  console.log('='.repeat(95));

  // 1. Nạp cấu hình từ MongoDB system_settings
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  console.log(`[1] Đang kết nối CSDL MongoDB để nạp credentials...`);
  
  const cachedSettings: Record<string, string> = {};
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    const docs = await mongoose.connection.collection('system_settings').find({}).toArray();
    for (const d of docs) {
      if (d.key && typeof d.value === 'string') cachedSettings[d.key] = d.value;
    }
    console.log(`✓ Đã nạp ${Object.keys(cachedSettings).length} cấu hình.`);
  } catch (err: any) {
    console.warn(`⚠️ Không thể kết nối MongoDB (${err.message}), sử dụng biến môi trường .env.`);
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }

  const mockSettingsService: any = {
    getSetting: async (key: string, defVal = '') => cachedSettings[key] ?? defVal,
  };

  const adapter = new CoreExApiAdapter(mockSettingsService);

  // 2. Kiểm tra sức khỏe kết nối sàn CE
  console.log('\n[2] Kiểm tra kết nối tới sàn Core Exchange...');
  const isHealthy = await adapter.checkHealth();
  console.log(`   => Trạng thái kết nối sàn CE: ${isHealthy ? '✅ KHẢ DỤNG (200 OK)' : '⚠️ KHÔNG PHẢN HỒI (Cần kiểm tra mạng / URL sàn)'}`);

  // 3. Chạy download cho ngày phiên hiện tại hoặc ngày truyền vào
  const targetDate = process.argv[2] || new Date().toISOString().split('T')[0];
  const outDir = path.resolve(process.cwd(), 'temp', 'validate_ce_backup', targetDate);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n[3] Kích hoạt CoreExApiAdapter.download() cho phiên: ${targetDate}`);
  console.log(`   => Thư mục xuất kiểm thử: ${outDir}`);

  const startTime = Date.now();
  const dlResult = await adapter.download('CORE_EX', {
    targetDate,
    targetDirectory: outDir,
    reportCodes: ['FULL', 'LSGD'],
    isFullBackup: true,
    onLog: (msg: string) => console.log(`   ${msg}`),
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[4] Kết quả tải về: success=${dlResult.success}, số file=${dlResult.files.length} (${durationSec}s)`);
  if (dlResult.error) console.error(`   ❌ Lỗi: ${dlResult.error}`);

  // 4. Bảng đối soát chi tiết thực tế trên đĩa so với bản Thủ công 26.10
  const BENCHMARKS: Record<string, { expectedRows: number; expectedKb: number; desc: string }> = {
    'DSTKGD ACM.xlsx': { expectedRows: 10185, expectedKb: 6540, desc: 'Danh sách tài khoản giao dịch' },
    'DSGD ACM CE.xlsx': { expectedRows: 1017, expectedKb: 102.3, desc: 'Khớp lệnh liên thông trong phiên' },
    'LSGD ACM CE.xlsx': { expectedRows: 1000, expectedKb: 90.0, desc: 'Lịch sử khớp lệnh liên thông (T-1)' },
    'DSLCK ACM CE.xlsx': { expectedRows: 240, expectedKb: 39.1, desc: 'Lệnh chờ khớp' },
    'GTT ACM.xlsx': { expectedRows: 12, expectedKb: 25.1, desc: 'Giá thanh toán Nano' },
    'TTM CE.xlsx': { expectedRows: 3163, expectedKb: 356.6, desc: 'Vị thế mở chi tiết (Trade-level)' },
    'DSLDK ACM CE.xlsx': { expectedRows: 1009, expectedKb: 151.2, desc: 'Lệnh đã khớp' },
    'DSLH ACM CE.xlsx': { expectedRows: 642, expectedKb: 96.7, desc: 'Lệnh hủy' },
    'DSL ACM CE.xlsx': { expectedRows: 1917, expectedKb: 283.8, desc: 'Sổ lệnh tổng hợp' },
    'HH ACM.xlsx': { expectedRows: 3, expectedKb: 19.6, desc: 'Danh mục hàng hóa Nano' },
    'HĐ CP2CO.xlsx': { expectedRows: 23, expectedKb: 36.9, desc: 'Hợp đồng Đồng Nano' },
    'HĐ PL1NY.xlsx': { expectedRows: 11, expectedKb: 27.1, desc: 'Hợp đồng Bạch Kim Nano' },
    'HĐ SI5CO.xlsx': { expectedRows: 13, expectedKb: 28.6, desc: 'Hợp đồng Bạc Nano' },
  };

  console.log('\n' + '='.repeat(105));
  console.log('BẢNG ĐỐI SOÁT THỰC TẾ TRÊN ĐĨA (TEST RUN) VS BẢN THỦ CÔNG (26.10 - CHECK)');
  console.log('='.repeat(105));
  console.log(
    `| ${'Tên File'.padEnd(20)} | ${'Thủ công (Chuẩn)'.padEnd(18)} | ${'Thực tế Test Run'.padEnd(20)} | ${'Dung lượng'.padEnd(12)} | ${'Đánh giá'.padEnd(14)} | ${'Mô tả'.padEnd(12)} |`
  );
  console.log('-'.repeat(105));

  for (const [fName, bench] of Object.entries(BENCHMARKS)) {
    const fPath = path.join(outDir, fName);
    const insp = await inspectFile(fPath);
    const expStr = `${bench.expectedRows.toLocaleString()} dòng`;
    const actualStr = insp.exists ? `${insp.rowCount.toLocaleString()} dòng` : '❌ Chưa có file';
    const sizeKbStr = insp.exists ? `${(insp.sizeBytes / 1024).toFixed(1)} KB` : '0 KB';

    let status = '⚠️ Lệch';
    if (!insp.exists) {
      status = '⛔ Thiếu file';
    } else if (insp.rowCount === 0 && bench.expectedRows > 0) {
      status = '⚠️ File rỗng';
    } else if (Math.abs(insp.rowCount - bench.expectedRows) <= 5) {
      status = '✅ Khớp chuẩn';
    } else if (insp.rowCount > 0) {
      status = '📊 Có dữ liệu';
    }

    console.log(
      `| ${fName.padEnd(20)} | ${expStr.padEnd(18)} | ${actualStr.padEnd(20)} | ${sizeKbStr.padEnd(12)} | ${status.padEnd(14)} | ${bench.desc.padEnd(12)} |`
    );
  }
  console.log('='.repeat(105));
  console.log(`\n📁 Toàn bộ file kết xuất thực tế nằm tại: ${outDir}\n`);
}

runCeValidation().catch(console.error);
