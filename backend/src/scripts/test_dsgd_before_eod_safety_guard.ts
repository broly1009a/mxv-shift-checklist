/**
 * test_dsgd_before_eod_safety_guard.ts
 *
 * Kiểm thử tính năng Bảo vệ Đối Chiếu DSGD Trước EOD (Phase 2 - Lỗ hổng 4: Ghi đè file & Báo thành công ảo)
 *
 * Các kịch bản kiểm chứng:
 * 1. Chặn đối chiếu ảo khi thiếu buffer dsgdTemp (Fail-fast, isSnapshotMissing=true).
 * 2. Chặn đối chiếu ảo khi buffer dsgdTemp rỗng (Buffer.alloc(0)).
 * 3. Cho phép đối chiếu bình thường khi có cả file gốc và file snapshot hợp lệ (Happy path buffer).
 * 4. Chặn đối chiếu tự động trên đĩa/thư mục khi không có file snapshot nào khớp timeSuffix (Fail-fast disk).
 * 5. Cho phép đối chiếu tự động trên đĩa khi có file snapshot hợp lệ (Happy path disk).
 *
 * Lệnh chạy:
 * cmd.exe /c "npx ts-node -r tsconfig-paths/register src/scripts/test_dsgd_before_eod_safety_guard.ts"
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  DsgdBeforeEodService,
} from '../modules/trading-ops/services/dsgd-before-eod.service';

function createMockDsgdExcel(filePath: string, records: Array<{ maTKGD: string; klGiaoDich: number; maHD: string }>) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sheetData = [
    ['BÁO CÁO DANH SÁCH GIAO DỊCH'],
    ['STT', 'Mã TV', 'Mã TKGD', 'Tên khách hàng', 'Mã HĐ', 'Mua/Bán', 'KL giao dịch', 'Giá khớp', 'Thời gian'],
    ...records.map((r, idx) => [
      idx + 1,
      '012',
      r.maTKGD,
      'Khách hàng test',
      r.maHD,
      'Mua',
      r.klGiaoDich,
      1200,
      '14:20:00',
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'DSGD');
  XLSX.writeFile(wb, filePath);
}

function createMockDsgdBuffer(records: Array<{ maTKGD: string; klGiaoDich: number; maHD: string }>): Buffer {
  const sheetData = [
    ['BÁO CÁO DANH SÁCH GIAO DỊCH'],
    ['STT', 'Mã TV', 'Mã TKGD', 'Tên khách hàng', 'Mã HĐ', 'Mua/Bán', 'KL giao dịch', 'Giá khớp', 'Thời gian'],
    ...records.map((r, idx) => [
      idx + 1,
      '012',
      r.maTKGD,
      'Khách hàng test',
      r.maHD,
      'Mua',
      r.klGiaoDich,
      1200,
      '14:20:00',
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'DSGD');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 KIỂM THỬ BẢO VỆ ĐỐI CHIẾU DSGD TRƯỚC EOD (PHASE 2 DATA GUARD)');
  console.log('================================================================\n');

  const mockSettingsService: any = {
    getSetting: async (key: string, def: string) => def,
  };
  const service = new DsgdBeforeEodService(mockSettingsService);

  const originalRecords = [
    { maTKGD: '012C111111', klGiaoDich: 10, maHD: 'ZCEZ26' },
    { maTKGD: '012C222222A', klGiaoDich: 5, maHD: 'CAEZ26' },
  ];
  const originalBuffer = createMockDsgdBuffer(originalRecords);

  const snapshotRecordsMatching = [
    { maTKGD: '012C111111', klGiaoDich: 10, maHD: 'ZCEZ26' },
    { maTKGD: '012C222222A', klGiaoDich: 5, maHD: 'CAEZ26' },
  ];
  const snapshotBufferMatching = createMockDsgdBuffer(snapshotRecordsMatching);

  let passedCount = 0;
  let failedCount = 0;

  // --- TEST CASE 1: Happy Path (Cả 2 buffer đầy đủ) ---
  console.log('Test Case 1: Đối chiếu hợp lệ khi có đủ file gốc và snapshot...');
  try {
    const res1 = service.checkDSGDBeforeEODFromBuffers({
      dsgdOriginal: originalBuffer,
      dsgdTemp: snapshotBufferMatching,
    });
    if (res1.passed && !res1.isSnapshotMissing && res1.differTotal === 0) {
      console.log('   PASSED: Kết quả passed=true, differTotal=0, isSnapshotMissing=false');
      passedCount++;
    } else {
      console.error('   FAILED: Kỳ vọng passed=true nhưng nhận:', res1);
      failedCount++;
    }
  } catch (err: any) {
    console.error('   FAILED:', err.message);
    failedCount++;
  }

  // --- TEST CASE 2: Chặn khi thiếu buffer dsgdTemp (Trước đây bị gán dsgdTempBuffer = dsgdOriginalBuffer) ---
  console.log('\nTest Case 2: Chặn đối chiếu ảo khi thiếu buffer dsgdTemp...');
  try {
    const res2 = service.checkDSGDBeforeEODFromBuffers({
      dsgdOriginal: originalBuffer,
      dsgdTemp: undefined,
    });
    if (!res2.passed && res2.isSnapshotMissing === true) {
      console.log('   PASSED: Đã chặn thành công! passed=false, isSnapshotMissing=true');
      console.log(`    Thông báo: "${res2.messages[0]}"`);
      passedCount++;
    } else {
      console.error('   FAILED: Hệ thống vẫn cho passed ảo khi thiếu snapshot!', res2);
      failedCount++;
    }
  } catch (err: any) {
    console.error('   FAILED:', err.message);
    failedCount++;
  }

  // --- TEST CASE 3: Chặn khi buffer dsgdTemp rỗng (length === 0) ---
  console.log('\nTest Case 3: Chặn đối chiếu ảo khi buffer dsgdTemp rỗng...');
  try {
    const res3 = service.checkDSGDBeforeEODFromBuffers({
      dsgdOriginal: originalBuffer,
      dsgdTemp: Buffer.alloc(0),
    });
    if (!res3.passed && res3.isSnapshotMissing === true) {
      console.log('   PASSED: Đã chặn thành công khi buffer rỗng!');
      passedCount++;
    } else {
      console.error('   FAILED: Kỳ vọng passed=false khi buffer rỗng nhưng nhận:', res3);
      failedCount++;
    }
  } catch (err: any) {
    console.error('   FAILED:', err.message);
    failedCount++;
  }

  // --- TEST CASE 4: Quét đĩa tự động khi thư mục CHỈ CÓ DSGD.xlsx (Không có file snapshot) ---
  console.log('\nTest Case 4: Quét thư mục tự động khi thiếu file snapshot...');
  const testDirDisk = path.join(process.cwd(), 'temp', 'test_dsgd_guard');
  if (fs.existsSync(testDirDisk)) {
    fs.rmSync(testDirDisk, { recursive: true, force: true });
  }
  fs.mkdirSync(testDirDisk, { recursive: true });

  const sessionDate = '2026-10-16';
  const parts = sessionDate.split('-');
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  const dayDir = path.join(testDirDisk, y, `T${m}.${y}`, `${d}.${m}`);
  fs.mkdirSync(dayDir, { recursive: true });

  // Chỉ tạo DSGD.xlsx gốc
  createMockDsgdExcel(path.join(dayDir, 'DSGD.xlsx'), originalRecords);

  try {
    const res4 = await service.runAutoCheckDSGDBeforeEOD({
      tradingDate: sessionDate,
      exactDate: true,
      timeSuffix: '17h00',
      customMsDir: testDirDisk,
    });

    if (!res4.passed && res4.isSnapshotMissing === true && res4.filesFound?.dsgdTemp === undefined) {
      console.log('   PASSED: Đã từ chối so sánh với file gốc! passed=false, isSnapshotMissing=true');
      console.log(`    Thông báo: "${res4.messages[0]}"`);
      passedCount++;
    } else {
      console.error('   FAILED: Hệ thống đã tự ý so sánh với file gốc để báo thành công ảo!', res4);
      failedCount++;
    }
  } catch (err: any) {
    console.error('   FAILED:', err.message);
    failedCount++;
  }

  // --- TEST CASE 5: Quét đĩa tự động khi CÓ file snapshot DSGD17h00.xlsx ---
  console.log('\nTest Case 5: Quét thư mục tự động khi CÓ file snapshot hợp lệ...');
  createMockDsgdExcel(path.join(dayDir, 'DSGD17h00.xlsx'), snapshotRecordsMatching);

  try {
    const res5 = await service.runAutoCheckDSGDBeforeEOD({
      tradingDate: sessionDate,
      exactDate: true,
      timeSuffix: '17h00',
      customMsDir: testDirDisk,
    });

    if (res5.passed && !res5.isSnapshotMissing && res5.filesFound?.dsgdTemp?.includes('DSGD17h00.xlsx')) {
      console.log('   PASSED: Đã nhận diện đúng snapshot DSGD17h00.xlsx và đối chiếu thành công!');
      passedCount++;
    } else {
      console.error('   FAILED: Kỳ vọng passed=true với file snapshot hợp lệ:', res5);
      failedCount++;
    }
  } catch (err: any) {
    console.error('   FAILED:', err.message);
    failedCount++;
  }

  // Dọn dẹp thư mục tạm
  try {
    if (fs.existsSync(testDirDisk)) {
      fs.rmSync(testDirDisk, { recursive: true, force: true });
    }
  } catch {}

  console.log('\n================================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ: ${passedCount}/5 PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Lỗi ngoại lệ khi chạy test:', err);
  process.exit(1);
});
