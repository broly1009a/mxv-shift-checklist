/**
 * KIỂM THỬ ĐỘC LẬP: LOGIC ĐỐI SOÁT TÀI KHOẢN ÂM KÝ QUỸ (MS & CCP) THEO QUY TẮC "3 THÔI"
 * File: backend/src/scripts/test_negative_margin_unit.js
 * 
 * Lệnh chạy:
 *   cd backend
 *   node src/scripts/test_negative_margin_unit.js
 */

const {
  reconcileNegativeMarginList,
  normalizeMonitoredNegativeAccounts,
} = require('../../dist/modules/trading-ops/helpers/negative-margin-sync.helper');

console.log('================================================================================');
console.log('       KIỂM THỬ NGHIỆP VỤ ĐỐI SOÁT TÀI KHOẢN ÂM KÝ QUỸ (QUY TẮC 3 THÔI)');
console.log('================================================================================\n');

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`   [PASS] ${testName}`);
    if (details) console.log(`     └─ ${details}`);
    totalPassed++;
  } else {
    console.error(`   [FAIL] ${testName}`);
    if (details) console.error(`     └─ ${details}`);
    totalFailed++;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: TƯƠNG THÍCH NGƯỢC VỚI DỮ LIỆU CŨ DẠNG STRING[]
// -----------------------------------------------------------------------------
console.log('▶ TEST 1: Chuẩn hóa dữ liệu cũ (Backward Compatibility)');
{
  const legacyStrings = ['088C000001', '088c000002', '  088C000003  '];
  const normalized = normalizeMonitoredNegativeAccounts(legacyStrings, 'MS');
  
  assert(normalized.length === 3, 'Chuyển đổi đủ 3 tài khoản từ mảng string');
  assert(normalized[0].account === '088C000001', 'Mã tài khoản chuẩn hóa in hoa');
  assert(normalized[1].account === '088C000002', 'Mã tài khoản thường chuyển thành in hoa');
  assert(normalized[2].account === '088C000003', 'Cắt tỉa khoảng trắng chuẩn xác');
  assert(normalized[0].system === 'MS', 'Gán đúng hệ thống mặc định MS');
  assert(normalized[0].negativeType === 'MANUAL', 'Gán loại âm mặc định MANUAL');
  assert(normalized[0].currentBalance === null, 'Số dư phải là null (N/A) - Zero Fabricated Data');
  assert(normalized[0].availableMargin === null, 'Ký quỹ khả dụng phải là null (N/A)');
  assert(normalized[0].additionalMargin === null, 'Mức bổ sung ký quỹ phải là null (N/A)');
  assert(normalized[0].recordedSessionDate === null, 'Phiên ghi nhận phải là null (N/A) chứ không gán new Date()');
}

// -----------------------------------------------------------------------------
// TEST 2: QUY TẮC "3 THÔI" TRÊN PHÂN HỆ M-SYSTEM
// -----------------------------------------------------------------------------
console.log('\n▶ TEST 2: Quy tắc 3 Thôi trên M-System (MS)');
{
  // Giả lập danh sách đang lưu trong CSDL:
  // - TK 088C111111: Đang theo dõi từ trước
  // - TK 088C222222: Đang theo dõi từ trước nhưng hôm nay đã nộp tiền
  const savedDb = [
    {
      account: '088C111111',
      negativeType: 'IMR_DEFICIT',
      currentBalance: 50000000,
      availableMargin: -10000000,
      additionalMargin: 10000000,
      initialRequiredMargin: 60000000,
      recordedSessionDate: '2026-10-29',
      system: 'MS',
    },
    {
      account: '088C222222',
      negativeType: 'BALANCE_DEFICIT',
      currentBalance: -5000000,
      availableMargin: -5000000,
      additionalMargin: 5000000,
      initialRequiredMargin: 0,
      recordedSessionDate: '2026-10-29',
      system: 'MS',
    },
  ];

  // Kết quả quét phiên hôm nay (2026-10-30):
  // - 088C111111: Vẫn âm tiếp, số tiền nợ tăng lên (-15tr)
  // - 088C222222: Không còn xuất hiện trong danh sách âm (đã nộp tiền)
  // - 088C333333: Tài khoản MỚI phát sinh âm hôm nay
  const currentScanMap = new Map();
  currentScanMap.set('088C111111', {
    account: '088C111111',
    negativeType: 'IMR_DEFICIT',
    currentBalance: 50000000,
    availableMargin: -15000000,
    additionalMargin: 15000000,
    initialRequiredMargin: 65000000,
    system: 'MS',
  });
  currentScanMap.set('088C333333', {
    account: '088C333333',
    negativeType: 'BOTH',
    currentBalance: -2000000,
    availableMargin: -8000000,
    additionalMargin: 8000000,
    initialRequiredMargin: 6000000,
    system: 'MS',
  });

  const syncResult = reconcileNegativeMarginList({
    savedAccounts: savedDb,
    currentNegativeMap: currentScanMap,
    sessionDateStr: '2026-10-30',
    systemType: 'MS',
  });

  assert(syncResult.newNegativeAccounts.length === 1, 'Quy tắc 1: Phát hiện đúng 1 TK mới phát sinh');
  assert(syncResult.newNegativeAccounts[0].account === '088C333333', 'Quy tắc 1: TK mới là 088C333333');
  assert(syncResult.newNegativeAccounts[0].recordedSessionDate === '2026-10-30', 'Quy tắc 1: Ghi nhận đúng ngày phiên mới');

  assert(syncResult.persistentAccounts.length === 1, 'Quy tắc 2: Giữ lại đúng 1 TK đã có sẵn và vẫn âm');
  assert(syncResult.persistentAccounts[0].account === '088C111111', 'Quy tắc 2: TK đã có sẵn là 088C111111');
  assert(syncResult.persistentAccounts[0].availableMargin === -15000000, 'Quy tắc 2: Cập nhật số dư/ký quỹ mới nhất (-15tr)');
  assert(syncResult.persistentAccounts[0].recordedSessionDate === '2026-10-29', 'Quy tắc 2: Giữ nguyên ngày phiên phát sinh cũ (2026-10-29)');

  assert(syncResult.resolvedAccounts.length === 1, 'Quy tắc 3: Tự động gỡ bỏ đúng 1 TK đã nạp tiền/hết âm');
  assert(syncResult.resolvedAccounts[0] === '088C222222', 'Quy tắc 3: TK được gỡ bỏ là 088C222222');

  assert(syncResult.updatedSavedList.length === 2, 'Tổng danh sách lưu CSDL cập nhật thành 2 tài khoản (088C111111 & 088C333333)');
}

// -----------------------------------------------------------------------------
// TEST 3: QUY TẮC "3 THÔI" TRÊN PHÂN HỆ CORECCP (CCP)
// -----------------------------------------------------------------------------
console.log('\n▶ TEST 3: Quy tắc 3 Thôi trên CoreCCP (CCP)');
{
  const savedCcpDb = [
    {
      account: '088C999999',
      negativeType: 'IMR_DEFICIT',
      currentBalance: 1000000,
      availableMargin: -2000000,
      additionalMargin: 2000000,
      initialRequiredMargin: 3000000,
      recordedSessionDate: '2026-10-28',
      system: 'CCP',
    },
  ];

  // Phiên hôm nay không có tài khoản nào âm (088C999999 đã nộp tiền)
  const emptyScanMap = new Map();

  const ccpSyncResult = reconcileNegativeMarginList({
    savedAccounts: savedCcpDb,
    currentNegativeMap: emptyScanMap,
    sessionDateStr: '2026-10-30',
    systemType: 'CCP',
  });

  assert(ccpSyncResult.newNegativeAccounts.length === 0, 'CCP: Không có tài khoản mới phát sinh');
  assert(ccpSyncResult.resolvedAccounts.length === 1, 'CCP: Tài khoản 088C999999 đã nạp tiền -> Tự động gỡ bỏ');
  assert(ccpSyncResult.updatedSavedList.length === 0, 'CCP: Danh sách theo dõi CCP sạch sẽ (0 tài khoản)');
}

console.log('\n================================================================================');
console.log(`KẾT QUẢ KIỂM THỬ: ${totalPassed} PASSED / ${totalFailed} FAILED`);
console.log('================================================================================\n');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

