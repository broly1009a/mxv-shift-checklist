/**
 * test_cccd_fraud_detection.ts
 * TEST SCRIPT KIỂM ĐỊNH TỰ ĐỘNG CÁC QUY TẮC PHÁT HIỆN CCCD GIẢ MẠO
 *
 * Kiểm thử:
 * 1. Unit test trực tiếp CCCDValidator (Rule 01 MRZ, Rule 02 Ngày cấp tương lai, Rule 03 Mã định danh 63 tỉnh/thành & Giới tính)
 * 2. Benchmark trên 14 hồ sơ thực tế của TVKD 003 đã ghi nhận:
 *    - Hoàng Kim Công (003C2311200): Phôi Photoshop không có MRZ mặt sau
 *    - Nguyễn Triệu Hưng (003C1684184): Ngày cấp tương lai 2027
 *    - Trương Huy Hoàng (003C1669379): Ngày cấp tương lai 2032
 *    - Nguyên Hoàng Mai (003C0094629): Ngày cấp tương lai 2032
 *    - Huỳnh Thị Kim Ngân (003C9052476): Ngày cấp 3030
 *    - Nguyễn Văn Thịnh (085C0947827): CCCD thật vật lý có MRZ đầy đủ
 * 3. Kiểm thử tích hợp qua evaluateRecordReconciliationRule()
 *
 * Hướng dẫn chạy:
 * npx ts-node src/scripts/test_cccd_fraud_detection.ts
 */

import { CCCDValidator, VIETNAM_PROVINCE_CODES } from '../modules/bot-engine/helpers/cccd-validator.helper';
import { evaluateRecordReconciliationRule } from '../modules/bot-engine/helpers/tkgd-reconcile-rules.helper';

console.log('================================================================');
console.log('🧪 BẮT ĐẦU KIỂM THỬ BỘ QUY TẮC PHÁT HIỆN CCCD GIẢ MẠO (BỘ CÔNG AN)');
console.log('================================================================\n');

// ─── TEST SUITE 1: KIỂM ĐỊNH CẤU TRÚC SỐ CCCD 12 SỐ (RULE 03) ───
console.log('--- TEST SUITE 1: Rule 03 - Cấu trúc 12 số định danh cá nhân ---');

const testCasesRule3 = [
  {
    name: 'CCCD Hợp lệ (Hà Nội, Nam sinh 1995)',
    id: '001095012345',
    gender: 'Nam',
    birthYear: 1995,
    expectedValid: true,
  },
  {
    name: 'CCCD Hợp lệ (TP.HCM, Nữ sinh 2002)',
    id: '079302008899',
    gender: 'Nữ',
    birthYear: 2002,
    expectedValid: true,
  },
  {
    name: 'CCCD Sai mã tỉnh (Mã 003 không tồn tại trong danh mục 63 tỉnh)',
    id: '003095012345',
    gender: 'Nam',
    birthYear: 1995,
    expectedValid: false,
    expectedFlag: 'INVALID_PROVINCE_CODE_003',
  },
  {
    name: 'CCCD Sai giới tính (Mã số 0 là Nam nhưng khai Nữ)',
    id: '001095012345',
    gender: 'Nữ',
    birthYear: 1995,
    expectedValid: false,
    expectedFlag: 'GENDER_MISMATCH_WITH_ID_CODE',
  },
  {
    name: 'CCCD Sai năm sinh (Sinh năm 1990 nhưng số CCCD ghi đuôi 95)',
    id: '001095012345',
    gender: 'Nam',
    birthYear: 1990,
    expectedValid: false,
    expectedFlag: 'BIRTH_YEAR_MISMATCH_WITH_ID_CODE',
  },
];

let passCount1 = 0;
for (const tc of testCasesRule3) {
  const res = CCCDValidator.validateCCCDNumber(tc.id, tc.gender, tc.birthYear);
  const isMatch = res.isValid === tc.expectedValid;
  if (isMatch) {
    passCount1++;
    console.log(`  ✅ [PASS] ${tc.name} -> Kết quả: ${res.severity} (${res.provinceName || 'Mã tỉnh ảo'})`);
  } else {
    console.error(`  ❌ [FAIL] ${tc.name} -> Nhận được:`, res);
  }
}
console.log(`=> Kết quả Suite 1: ${passCount1}/${testCasesRule3.length} tests đạt yêu cầu.\n`);

// ─── TEST SUITE 2: KIỂM ĐỊNH NGÀY CẤP (RULE 02) ───
console.log('--- TEST SUITE 2: Rule 02 - Tính hợp lý ngày cấp (Chặn ngày tương lai) ---');

const testCasesRule2 = [
  {
    name: 'Ngày cấp hợp lệ trong quá khứ (2022-05-10)',
    date: new Date('2022-05-10'),
    expectedValid: true,
  },
  {
    name: 'Ngày cấp tương lai 2027 (Ca thực tế TVKD 003 - 003C1684184)',
    date: new Date('2027-09-16'),
    expectedValid: false,
  },
  {
    name: 'Ngày cấp tương lai 2032 (Ca thực tế TVKD 003 - 003C1669379)',
    date: new Date('2032-09-22'),
    expectedValid: false,
  },
  {
    name: 'Ngày cấp bịa đặt năm 3030 (Ca thực tế TVKD 003 - 003C9052476)',
    date: new Date('3030-10-29'),
    expectedValid: false,
  },
];

let passCount2 = 0;
for (const tc of testCasesRule2) {
  const res = CCCDValidator.validateIssueDate(tc.date);
  const isMatch = res.isValid === tc.expectedValid;
  if (isMatch) {
    passCount2++;
    console.log(`  ✅ [PASS] ${tc.name} -> Kết quả: ${res.isValid ? 'HỢP LỆ' : `CHẶN CRITICAL (${res.reason})`}`);
  } else {
    console.error(`  ❌ [FAIL] ${tc.name} -> Nhận được:`, res);
  }
}
console.log(`=> Kết quả Suite 2: ${passCount2}/${testCasesRule2.length} tests đạt yêu cầu.\n`);

// ─── TEST SUITE 3: KIỂM ĐỊNH DẢI MRZ MẶT SAU (RULE 01) ───
console.log('--- TEST SUITE 3: Rule 01 - Kiểm tra dải MRZ ICAO mặt sau ---');

const testCasesRule1 = [
  {
    name: 'Mặt sau CCCD THẬT (Có dải IDVNM... và ký tự chevrons <<)',
    text: `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
           Nơi thường trú: Bắc Ninh
           CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI
           IDVNM0760005219027076000521<<2
           7604245M3604247VNM<<<<<<<<<<<6
           NGUYEN<<VAN<THINH<<<<<<<<<<<<`,
    expectedFake: false,
  },
  {
    name: 'Mặt sau CCCD GIẢ (Hoàng Kim Công 003C2311200 - Trống trắng vùng đáy, không có MRZ)',
    text: `Nơi cư trú / Place of residence: Thôn 8 Tuy Đức, Lâm Đồng
           Nơi đăng ký khai sinh: Phùng Nguyên, Phú Thọ
           Ngày, tháng, năm cấp / Date of issue: 29/08/2025
           BỘ CÔNG AN / MINISTRY OF PUBLIC SECURITY`,
    expectedFake: true,
  },
];

let passCount3 = 0;
for (const tc of testCasesRule1) {
  const res = CCCDValidator.validateMRZ(tc.text);
  const isMatch = res.isCriticalFake === tc.expectedFake;
  if (isMatch) {
    passCount3++;
    console.log(`  ✅ [PASS] ${tc.name} -> Kết luận: ${res.isCriticalFake ? `🔴 PHÁT HIỆN GIẢ MẠO (${res.reason})` : '✅ ĐẦY ĐỦ MRZ'}`);
  } else {
    console.error(`  ❌ [FAIL] ${tc.name} -> Nhận được:`, res);
  }
}
console.log(`=> Kết quả Suite 3: ${passCount3}/${testCasesRule1.length} tests đạt yêu cầu.\n`);

// ─── TEST SUITE 4: TÍCH HỢP EVALUATE RECORD RECONCILIATION RULE ───
console.log('--- TEST SUITE 4: Kiểm thử tích hợp toàn diện vào evaluateRecordReconciliationRule() ---');

// Record 1: Hồ sơ sạch, thật 100%
const mockCleanRecord = {
  maTKGD: '085C0947827',
  noiDungMail: { tenTaiKhoan: 'NGUYỄN VĂN THỊNH' },
  hopDong: {
    hoVaTen: 'NGUYỄN VĂN THỊNH',
    soCanCuoc: '027076000521',
    ngaySinh: new Date('1976-04-24'),
    ngayCap: new Date('2023-04-19'),
    gioiTinh: 'Nam',
  },
  canCuoc: {
    hoVaTen: 'NGUYỄN VĂN THỊNH',
    soCanCuoc: '027076000521',
    ngaySinh: new Date('1976-04-24'),
    ngayCap: new Date('2023-04-19'),
    gioiTinh: 'Nam',
    rawOcrText: 'IDVNM0760005219027076000521<<2 NGUYEN<<VAN<THINH<<<<<<<<<<<<',
  },
  ms: {
    isFoundOnMS: true,
    maTKGD: '085C0947827',
    hoVaTen: 'NGUYỄN VĂN THỊNH',
    soCMND_HoChieu: '027076000521',
    ngaySinh: new Date('1976-04-24'),
    ngayCap: new Date('2023-04-19'),
    gioiTinh: 'Nam',
  },
};

const resClean = evaluateRecordReconciliationRule(mockCleanRecord);
console.log(`  Test 4.1 - Hồ sơ sạch hợp lệ:`);
console.log(`    Trạng thái: ${resClean.finalStatus} (Kỳ vọng: KHOP)`);
console.log(`    Lỗi: ${resClean.finalErrors.length === 0 ? 'Không có' : resClean.finalErrors.join(', ')}`);

// Record 2: Hồ sơ có CCCD bịa ngày cấp tương lai 2027
const mockFutureIssueRecord = {
  ...mockCleanRecord,
  maTKGD: '003C1684184',
  hopDong: { ...mockCleanRecord.hopDong, ngayCap: new Date('2027-09-16') },
  canCuoc: { ...mockCleanRecord.canCuoc, ngayCap: new Date('2027-09-16') },
};

const resFuture = evaluateRecordReconciliationRule(mockFutureIssueRecord);
console.log(`\n  Test 4.2 - Hồ sơ ngày cấp tương lai (2027):`);
console.log(`    Trạng thái: ${resFuture.finalStatus} (Kỳ vọng: LECH)`);
console.log(`    Lỗi bắt được: ${resFuture.finalErrors.filter(e => e.includes('tương lai')).join(', ')}`);

// Record 3: Hồ sơ phôi Photoshop không có MRZ mặt sau
const mockNoMrzRecord = {
  ...mockCleanRecord,
  maTKGD: '003C2311200',
  canCuoc: {
    ...mockCleanRecord.canCuoc,
    rawOcrText: 'Nơi cư trú: Thôn 8 Lâm Đồng. Ngày cấp 29/08/2025. BỘ CÔNG AN',
  },
};

const resNoMrz = evaluateRecordReconciliationRule(mockNoMrzRecord);
console.log(`\n  Test 4.3 - Hồ sơ phôi Photoshop thiếu dải MRZ mặt sau:`);
console.log(`    Trạng thái: ${resNoMrz.finalStatus} (Kỳ vọng: LECH)`);
console.log(`    Lỗi bắt được: ${resNoMrz.finalErrors.filter(e => e.includes('MRZ') || e.includes('phôi')).join(', ')}`);

console.log('\n================================================================');
console.log('🎉 TẤT CẢ CÁC MODULE KIỂM THỬ ĐÃ HOÀN TẤT!');
console.log('================================================================');
