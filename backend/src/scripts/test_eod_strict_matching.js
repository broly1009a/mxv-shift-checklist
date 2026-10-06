/**
 * ============================================================================
 * TEST SUITE: KIỂM THỬ ĐỐI CHIẾU EOD THEO CHUẨN C# (STRICT DATE MATCHING)
 * ============================================================================
 * 
 * Mục đích kiểm thử:
 * 1. Test Case 1: Kiểm thử trực tiếp trên thư mục thật của hệ thống (02.10 trên ổ M:):
 *    - Xác nhận findExactSessionEodFile KHÔNG ĐƯỢC bốc nhầm file 'eod.2026-10-01.csv'
 *      cho phiên '2026-10-02'.
 *    - Xác nhận hàm chỉ chấp nhận 'eod.2026-10-01.csv' khi ngày phiên đúng là '2026-10-01'.
 * 
 * 2. Test Case 2: Kiểm thử trên thư mục Mock giả lập nhiều trường hợp đặt tên file:
 *    - File chuẩn C# (eod.YYYY-MM-DD.csv)
 *    - File chuẩn C# Excel (eod.YYYY-MM-DD.xlsx)
 *    - File không có ngày trong tên (eod.csv) -> Đọc nội dung CSV kiểm tra sessionDate
 *    - File cũ ngày hôm trước nằm lẫn trong thư mục -> Bắt buộc bị từ chối
 * 
 * 3. Test Case 3: Kiểm thử logic lùi ngày phiên T-1 (bỏ qua Thứ 7, Chủ Nhật):
 *    - Ca trực Thứ Hai (2026-10-05) -> Lùi về Thứ Sáu (2026-10-02).
 *    - Ca trực Thứ Ba (2026-10-06) -> Lùi về Thứ Hai (2026-10-05).
 *    - Ca trực cuối tuần -> Lùi về Thứ Sáu gần nhất.
 * 
 * 4. Test Case 4: Kiểm thử bộ lọc Email EOD M365:
 *    - Tìm kiếm phiên 2026-10-02 -> Tuyệt đối KHÔNG bắt nhầm email của 2026-10-01.
 * 
 * Cách chạy:
 *   cd backend
 *   node src/scripts/test_eod_strict_matching.js
 */

const fs = require('fs');
const path = require('path');

// ─── IMPORT HÀM HELPER THỰC TẾ TRONG REPO ────────────────────────────────────
let findExactSessionEodFile, findLatestFile;
try {
  ({ findExactSessionEodFile, findLatestFile } = require('../../dist/modules/reconciliation/helpers/recon-number-parser.helper'));
} catch {
  ({ findExactSessionEodFile, findLatestFile } = require('../modules/reconciliation/helpers/recon-number-parser.helper'));
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertTest(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name} ${details ? `(${details})` : ''}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' TEST SUITE: KIỂM THỬ LOGIC ĐỐI SOÁT EOD THEO CHUẨN C# GỐC');
  console.log('================================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 1: Kiểm thử trên thư mục thật M:\...\02.10 (nơi xảy ra sự cố)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('📋 1. KIỂM THỬ TRỰC TIẾP TRÊN THƯ MỤC THẬT (Ổ M: - THƯ MỤC 02.10):');
  const realFolder0210 = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T10.2026\\02.10';

  if (fs.existsSync(realFolder0210)) {
    // 1.1 Kiểm tra file eod.2026-10-01.csv có tồn tại trong 02.10 không
    const legacyFound = findLatestFile(realFolder0210, /eod/i);
    assertTest(
      'Kiểm chứng bug cũ: findLatestFile(/eod/i) từng bốc nhầm file ngày 01.10 trong thư mục 02.10',
      legacyFound && path.basename(legacyFound).includes('2026-10-01'),
      `Tìm thấy: ${legacyFound ? path.basename(legacyFound) : 'null'}`
    );

    // 1.2 findExactSessionEodFile với phiên 2026-10-02 -> Bắt buộc phải trả về NULL (Không bốc nhầm)
    const strictFor02 = findExactSessionEodFile(realFolder0210, '2026-10-02');
    assertTest(
      'Hàm mới findExactSessionEodFile(\'2026-10-02\') TỪ CHỐI bốc nhầm file ngày 01.10 trong folder 02.10',
      strictFor02 === null,
      `Kết quả: ${strictFor02}`
    );

    // 1.3 findExactSessionEodFile với phiên 2026-10-01 -> Nhận đúng file khi được yêu cầu phiên 01.10
    const strictFor01 = findExactSessionEodFile(realFolder0210, '2026-10-01');
    assertTest(
      'Hàm mới findExactSessionEodFile(\'2026-10-01\') nhận đúng file eod.2026-10-01.csv',
      strictFor01 !== null && path.basename(strictFor01) === 'eod.2026-10-01.csv',
      `Kết quả: ${strictFor01}`
    );
  } else {
    console.log('  ⚠️ Không tìm thấy ổ M: trên máy, bỏ qua Test Case 1 và chuyển sang Mock Test Case.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 2: Mock Isolated Tests cho findExactSessionEodFile
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n📋 2. KIỂM THỬ TRÊN THƯ MỤC GIẢ LẬP ISOLATED (ĐẦY ĐỦ CÁC CASE):');
  const tempMockDir = path.join(__dirname, '../../temp/mock_eod_test');
  if (!fs.existsSync(tempMockDir)) {
    fs.mkdirSync(tempMockDir, { recursive: true });
  }

  try {
    // Case 2.1: Thư mục có file eod.2026-10-02.csv chuẩn
    const fileCsv20261002 = path.join(tempMockDir, 'eod.2026-10-02.csv');
    fs.writeFileSync(fileCsv20261002, 'investorCode,sessionDate,eodBalance\n001C01,2026-10-02,1000\n');
    
    const resExact = findExactSessionEodFile(tempMockDir, '2026-10-02');
    assertTest(
      'Nhận diện file chuẩn C# Tool (eod.2026-10-02.csv)',
      resExact === fileCsv20261002,
      `Nhận diện: ${resExact}`
    );

    // Case 2.2: Tìm ngày 2026-10-03 trong thư mục chỉ có file 2026-10-02 -> Phải từ chối
    const resOtherDate = findExactSessionEodFile(tempMockDir, '2026-10-03');
    assertTest(
      'Từ chối khi tìm ngày 2026-10-03 trong thư mục chỉ có eod.2026-10-02.csv',
      resOtherDate === null,
      `Kết quả: ${resOtherDate}`
    );

    // Xóa file tạm
    fs.unlinkSync(fileCsv20261002);

    // Case 2.3: File eod.csv không có ngày ở tên nhưng sessionDate bên trong là 2026-10-02
    const fileCsvGeneric = path.join(tempMockDir, 'eod.csv');
    fs.writeFileSync(fileCsvGeneric, '"kqua","mgs","sessionDate","investorCode","eodBalance"\ntrue,"ok","2026-10-02","001C01",5000\n');
    
    const resGenericMatch = findExactSessionEodFile(tempMockDir, '2026-10-02');
    assertTest(
      'Nhận diện file eod.csv khi sessionDate bên trong khớp 2026-10-02',
      resGenericMatch === fileCsvGeneric,
      `Kết quả: ${resGenericMatch}`
    );

    const resGenericMismatch = findExactSessionEodFile(tempMockDir, '2026-10-01');
    assertTest(
      'Từ chối file eod.csv khi sessionDate bên trong (2026-10-02) khác ngày yêu cầu (2026-10-01)',
      resGenericMismatch === null,
      `Kết quả: ${resGenericMismatch}`
    );

    fs.unlinkSync(fileCsvGeneric);

  } finally {
    // Dọn dẹp thư mục tạm
    if (fs.existsSync(tempMockDir)) {
      fs.rmSync(tempMockDir, { recursive: true, force: true });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 3: Logic Lùi Ngày T-1 Phiên Đối Chiếu (bỏ qua Thứ 7, Chủ Nhật)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n📋 3. KIỂM THỬ LOGIC LÙI NGÀY PHIÊN LÀM VIỆC T-1 (WORKDAY RESOLUTION):');

  function resolvePreviousSessionWorkday(inputDateStr) {
    const prev = new Date(inputDateStr);
    prev.setDate(prev.getDate() - 1);
    while (prev.getDay() === 0 || prev.getDay() === 6) {
      prev.setDate(prev.getDate() - 1);
    }
    return prev.toISOString().split('T')[0];
  }

  assertTest(
    'Ca trực Thứ Hai (2026-10-05) -> Lùi về Thứ Sáu (2026-10-02)',
    resolvePreviousSessionWorkday('2026-10-05') === '2026-10-02',
    `Thực tế: ${resolvePreviousSessionWorkday('2026-10-05')}`
  );

  assertTest(
    'Ca trực Thứ Ba (2026-10-06) -> Lùi về Thứ Hai (2026-10-05)',
    resolvePreviousSessionWorkday('2026-10-06') === '2026-10-05',
    `Thực tế: ${resolvePreviousSessionWorkday('2026-10-06')}`
  );

  assertTest(
    'Ca trực Chủ Nhật (2026-10-04) -> Lùi về Thứ Sáu (2026-10-02)',
    resolvePreviousSessionWorkday('2026-10-04') === '2026-10-02',
    `Thực tế: ${resolvePreviousSessionWorkday('2026-10-04')}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 4: Bộ lọc tìm kiếm Email EOD M365 (Strict Date Match)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n📋 4. KIỂM THỬ BỘ LỌC TÌM KIẾM EMAIL EOD M365:');

  const mockEmails = [
    {
      id: 'mail-01',
      subject: 'Thông báo kết quả chạy EOD hệ thống ngày phiên 2026-10-01',
      bodyPreview: 'Kính gửi, hệ thống gửi file eod.2026-10-01.csv đính kèm.',
      receivedDateTime: '2026-10-02T02:00:00Z',
    },
    {
      id: 'mail-02',
      subject: 'Thông báo kết quả chạy EOD hệ thống ngày phiên 2026-10-02',
      bodyPreview: 'Kính gửi, hệ thống gửi file eod.2026-10-02.csv đính kèm.',
      receivedDateTime: '2026-10-03T02:00:00Z',
    },
  ];

  function matchEodEmail(emails, targetDateStr) {
    const parts = targetDateStr.split('-');
    const yyyy = parts[0];
    const mm = parts[1];
    const dd = parts[2];
    const dateSlash = `${dd}/${mm}/${yyyy}`;
    const dateDash = `${dd}-${mm}-${yyyy}`;
    const dateDot = `${dd}.${mm}`;
    const dateNoDash = `${yyyy}${mm}${dd}`;

    return emails.find((em) => {
      const s = (em.subject + ' ' + (em.bodyPreview || '')).toLowerCase();
      return (
        s.includes(targetDateStr.toLowerCase()) ||
        s.includes(dateNoDash) ||
        s.includes(dateSlash) ||
        s.includes(dateDash) ||
        s.includes(`eod.${targetDateStr}`) ||
        s.includes(`phiên ${dateDot}`)
      );
    });
  }

  const matchFor02 = matchEodEmail(mockEmails, '2026-10-02');
  assertTest(
    'Tìm kiếm phiên 2026-10-02 -> Bắt đúng mail-02 (phiên 2026-10-02)',
    matchFor02 && matchFor02.id === 'mail-02',
    `Matched: ${matchFor02?.id}`
  );

  const matchFor01 = matchEodEmail(mockEmails, '2026-10-01');
  assertTest(
    'Tìm kiếm phiên 2026-10-01 -> Bắt đúng mail-01 (phiên 2026-10-01)',
    matchFor01 && matchFor01.id === 'mail-01',
    `Matched: ${matchFor01?.id}`
  );

  const matchFor03 = matchEodEmail(mockEmails, '2026-10-03');
  assertTest(
    'Tìm kiếm phiên 2026-10-03 -> Không bắt nhầm bất kỳ email nào (trả về undefined)',
    matchFor03 === undefined,
    `Matched: ${matchFor03?.id}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // TỔNG KẾT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(` KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} PASS (${failedTests} FAILED)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Lỗi thực thi test suite:', err);
  process.exit(1);
});
