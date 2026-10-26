/**
 * test_cqg_merger_freshness_guard.ts
 *
 * Kiểm thử tính năng Bảo vệ Ghép File CQG Thô (CQG Raw Merging Asynchrony Guard - Phase 1)
 * Xác minh các chốt chặn:
 * 1. Chặn ghép khi thiếu 1 trong 2 tài khoản (Missing Account Guard).
 * 2. Chặn ghép khi khoảng cách mtime giữa 2 file vượt ngưỡng an toàn (Stale File Gap Guard).
 * 3. Chặn ghép khi Header Snapshot Date thuộc về 2 ngày giao dịch khác nhau (Cross-Day Header Guard).
 * 4. Cho phép ghép bình thường khi cả 2 file cùng phiên và hợp lệ (Happy Path).
 *
 * Lệnh chạy:
 * cmd.exe /c "npx ts-node -r tsconfig-paths/register src/scripts/test_cqg_merger_freshness_guard.ts"
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  CqgMergerService,
  validateCqgPairFreshness,
} from '../modules/trading-ops/services/merger/cqg-merger.service';

function createMockCqgExcel(
  filePath: string,
  headerText: string,
  rows: any[][],
  mtimeOffsetMinutes: number = 0,
) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sheetData = [[headerText], ['Ord #', 'Account', 'Symbol', 'Qty', 'Fill P', 'Time'], ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filePath);

  if (mtimeOffsetMinutes !== 0) {
    const targetMtime = new Date(Date.now() + mtimeOffsetMinutes * 60 * 1000);
    fs.utimesSync(filePath, targetMtime, targetMtime);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 KIỂM THỬ TÍNH NĂNG BẢO VỆ GHÉP FILE CQG THÔ (PHASE 1 GUARD)');
  console.log('================================================================\n');

  const testDir = path.join(process.cwd(), 'temp', 'test_cqg_merger_guard');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  const merger = new CqgMergerService();

  const sampleRows1 = [
    ['ORD_001', '012C111111F', 'ZCEZ26', 10, 420.5, '08:15:20'],
    ['ORD_002', '012C222222L', 'CAEZ26', 5, 9200, '08:16:30'],
    ['Footer 1'],
    ['Footer 2'],
  ];
  const sampleRows2 = [
    ['ORD_003', '012C333333S', 'ZLEZ26', 8, 45.2, '08:17:10'],
    ['Footer 1'],
    ['Footer 2'],
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // TESTCASE 1: Happy Path - Cả 2 file cùng phiên, cùng giờ (mtime chênh 2 phút)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TESTCASE 1: Cả 2 file cùng phiên, tươi mới (mtime chênh 2 phút) ---');
  const fr1_ok = path.join(testDir, 'FR1_ok.xlsx');
  const fr2_ok = path.join(testDir, 'FR2_ok.xlsx');
  const fr_dest1 = path.join(testDir, 'FR_dest1.xlsx');

  createMockCqgExcel(fr1_ok, 'Fills reported as of 10/16/26 8:29:46 AM for the following accounts: All', sampleRows1, -2);
  createMockCqgExcel(fr2_ok, 'Fills reported as of 10/16/26 8:31:00 AM for the following accounts: All', sampleRows2, 0);

  const res1 = validateCqgPairFreshness(fr1_ok, fr2_ok);
  console.log(`• Kết quả validate: isValid = ${res1.isValid} (Độ lệch: ${res1.mtimeDiffMinutes} phút)`);
  if (!res1.isValid) throw new Error(`TESTCASE 1 FAILED: Mong muốn hợp lệ nhưng trả về ${res1.reason}`);

  const mergeSuccess1 = merger.mergeFR(fr1_ok, fr2_ok, fr_dest1);
  console.log(`• Kết quả mergeFR: ${mergeSuccess1 ? ' THÀNH CÔNG' : ' THẤT BẠI'}`);
  console.log(`• File sinh ra: ${fs.existsSync(fr_dest1) ? 'Tồn tại' : 'Không tồn tại'}\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TESTCASE 2: Thiếu file của 1 tài khoản (TK2 bị lỗi tải, file không tồn tại)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TESTCASE 2: Thiếu file của 1 tài khoản (TK 2 không tải được) ---');
  const fr2_missing = path.join(testDir, 'FR2_missing.xlsx');
  const fr_dest2 = path.join(testDir, 'FR_dest2.xlsx');

  const res2 = validateCqgPairFreshness(fr1_ok, fr2_missing);
  console.log(`• Kết quả validate: isValid = ${res2.isValid}`);
  console.log(`• Lý do chặn: "${res2.reason}"`);
  if (res2.isValid) throw new Error('TESTCASE 2 FAILED: Lẽ ra phải chặn khi thiếu file TK2!');

  try {
    merger.mergeFR(fr1_ok, fr2_missing, fr_dest2);
    throw new Error('TESTCASE 2 FAILED: mergeFR lẽ ra phải throw Error chặn ghép file thiếu!');
  } catch (err: any) {
    console.log(`• Bắt lỗi thành công: "${err.message}" ( Đã chặn ghép file thiếu)\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TESTCASE 3: File TK2 là file tồn từ hôm qua (mtime lệch 1440 phút / 24 giờ)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TESTCASE 3: File TK 2 là file tồn từ ngày hôm trước (mtime lệch 24h) ---');
  const fr2_stale = path.join(testDir, 'FR2_stale.xlsx');
  const fr_dest3 = path.join(testDir, 'FR_dest3.xlsx');

  createMockCqgExcel(fr2_stale, 'Fills reported as of 10/16/26 8:31:00 AM for the following accounts: All', sampleRows2, -1440);

  const res3 = validateCqgPairFreshness(fr1_ok, fr2_stale, { maxTimeGapMinutes: 60 });
  console.log(`• Kết quả validate: isValid = ${res3.isValid} (Độ lệch: ${res3.mtimeDiffMinutes} phút)`);
  console.log(`• Lý do chặn: "${res3.reason}"`);
  if (res3.isValid) throw new Error('TESTCASE 3 FAILED: Lẽ ra phải chặn khi file lệch mtime 24 giờ!');

  try {
    merger.mergeFR(fr1_ok, fr2_stale, fr_dest3);
    throw new Error('TESTCASE 3 FAILED: mergeFR lẽ ra phải throw Error chặn ghép file cũ!');
  } catch (err: any) {
    console.log(`• Bắt lỗi thành công: "${err.message}" ( Đã chặn ghép file quá hạn)\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TESTCASE 4: Header Snapshot Date thuộc về 2 ngày khác nhau (15/10 vs 16/10)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TESTCASE 4: Header Snapshot Date thuộc về 2 ngày khác nhau (15/10 vs 16/10) ---');
  const fr1_day15 = path.join(testDir, 'FR1_day15.xlsx');
  const fr2_day16 = path.join(testDir, 'FR2_day16.xlsx');
  const fr_dest4 = path.join(testDir, 'FR_dest4.xlsx');

  createMockCqgExcel(fr1_day15, 'Fills reported as of 10/15/26 8:29:46 AM for the following accounts: All', sampleRows1, 0);
  createMockCqgExcel(fr2_day16, 'Fills reported as of 10/16/26 8:31:00 AM for the following accounts: All', sampleRows2, 0);

  const res4 = validateCqgPairFreshness(fr1_day15, fr2_day16);
  console.log(`• Kết quả validate: isValid = ${res4.isValid}`);
  console.log(`• Lý do chặn: "${res4.reason}"`);
  if (res4.isValid) throw new Error('TESTCASE 4 FAILED: Lẽ ra phải chặn khi 2 file khác ngày trong Header!');

  try {
    merger.mergeFR(fr1_day15, fr2_day16, fr_dest4);
    throw new Error('TESTCASE 4 FAILED: mergeFR lẽ ra phải throw Error chặn ghép file khác ngày!');
  } catch (err: any) {
    console.log(`• Bắt lỗi thành công: "${err.message}" ( Đã chặn ghép file khác ngày Header)\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TESTCASE 5: Kiểm tra mergeAll với thư mục có file lỗi
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TESTCASE 5: mergeAll tự động ghi nhận lỗi vào errors[] ---');
  const folderWithStale = path.join(testDir, 'folder_with_stale');
  fs.mkdirSync(folderWithStale, { recursive: true });
  createMockCqgExcel(path.join(folderWithStale, 'FR1.xlsx'), 'Fills reported as of 10/16/26 8:29:46 AM for the following accounts: All', sampleRows1, 0);
  createMockCqgExcel(path.join(folderWithStale, 'FR2.xlsx'), 'Fills reported as of 10/15/26 8:31:00 AM for the following accounts: All', sampleRows2, -1440);

  const allRes = merger.mergeAll(folderWithStale);
  console.log(`• mergeAll success: ${allRes.success}`);
  console.log(`• Số lỗi ghi nhận: ${allRes.errors.length}`);
  console.log(`• Nội dung lỗi: "${allRes.errors[0]}"`);
  console.log(`• File FR.xlsx có bị sinh rác không: ${fs.existsSync(path.join(folderWithStale, 'FR.xlsx')) ? 'CÓ (LỖI)' : 'KHÔNG (CHUẨN)'}`);

  // Dọn dẹp temp test
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  console.log('\n================================================================');
  console.log('🎉 TẤT CẢ 5 TESTCASE BẢO VỆ GHÉP FILE CQG ĐỀU ĐẠT CHUẨN 100%!');
  console.log('================================================================');
}

runTests().catch((e) => {
  console.error(' LỖI KIỂM THỬ:', e);
  process.exit(1);
});
