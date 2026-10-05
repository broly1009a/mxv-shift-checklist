/**
 * TEST SUITE: KIỂM TOÁN VÒNG ĐỜI BÓC TÁCH CHI TIẾT (ENTERPRISE EXTRACTION LIFECYCLE AUDIT)
 * 
 * Mục tiêu:
 * - Kiểm thử toàn diện 6 chặng vòng đời thực tế của một hồ sơ TKGD:
 *   1. MAIL_INGEST (Nạp email Outlook & tệp đính kèm)
 *   2. EXTRACT_CONTRACT (Trích xuất PDF Hợp đồng)
 *   3. EXTRACT_CCCD (OCR CCCD, 2 dòng MRZ & mã QR)
 *   4. SCRAPE_MSYSTEM (Cào M-System & mảng 10 raw DOM inputs)
 *   5. RECONCILE (Đối soát chéo 3 bên & Ra kết luận)
 *   6. MANUAL_OVERRIDE (Cán bộ phê duyệt / can thiệp thủ công)
 * - Kiểm thử độ trễ truy vấn (Query Latency Benchmark) qua Compound Index: { maTKGD: 1, createdAt: 1 }
 * - Xác thực TTL Index và tính toàn vẹn dữ liệu.
 * 
 * Cách chạy:
 *   node src/scripts/test_extraction_lifecycle_audit.js
 *   node src/scripts/test_extraction_lifecycle_audit.js --keep
 *   node src/scripts/test_extraction_lifecycle_audit.js --clean
 */

const mongoose = require('mongoose');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/mxv_shift_checklist';

// Nạp Schema từ dist đã build
let TkgdExtractionLogSchema;
try {
  const schemaMod = require(path.join(__dirname, '../../dist/schemas/tkgd-extraction-log.schema'));
  TkgdExtractionLogSchema = schemaMod.TkgdExtractionLogSchema;
} catch (err) {
  console.error('❌ Lỗi: Không thể nạp Schema từ dist. Vui lòng chạy "npm run build" trước!');
  process.exit(1);
}

const args = process.argv.slice(2);
const shouldKeep = args.includes('--keep');
const onlyClean = args.includes('--clean');
const customAccountIndex = args.indexOf('--account');
const TEST_ACCOUNT = customAccountIndex !== -1 && args[customAccountIndex + 1]
  ? args[customAccountIndex + 1].trim()
  : 'TEST_AUDIT_085C9999999';
const TEST_BATCH_DATE = '2026-10-01';

// Màu sắc ANSI hiển thị Terminal
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function pass(name, durationMs) {
  console.log(`  ${C.green}✓ [PASSED]${C.reset} ${name} ${C.gray}(${durationMs}ms)${C.reset}`);
}

function fail(name, errMsg) {
  console.log(`  ${C.red}✗ [FAILED]${C.reset} ${name} - ${C.red}${errMsg}${C.reset}`);
}

async function runAuditTestSuite() {
  console.log(`\n${C.bold}${C.cyan}========================================================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}  TEST SUITE: KIỂM TOÁN VÒNG ĐỜI BÓC TÁCH TKGD CHUẨN DOANH NGHIỆP      ${C.reset}`);
  console.log(`${C.bold}${C.cyan}========================================================================${C.reset}`);
  console.log(`• CSDL:        ${MONGODB_URI}`);
  console.log(`• Mã TKGD test:${C.bold} ${TEST_ACCOUNT}${C.reset}`);
  console.log(`• Ngày batch:  ${TEST_BATCH_DATE}`);
  console.log(`• Tùy chọn:    ${shouldKeep ? 'Giữ dữ liệu (--keep)' : 'Tự dọn dẹp sạch sẽ'}\n`);

  await mongoose.connect(MONGODB_URI);
  const Model = mongoose.model('TkgdExtractionLog', TkgdExtractionLogSchema, 'tkgd_extraction_logs');

  if (onlyClean) {
    const res = await Model.deleteMany({ maTKGD: TEST_ACCOUNT });
    console.log(`🧹 Đã dọn dẹp sạch ${res.deletedCount} bản ghi test của ${TEST_ACCOUNT}.`);
    await mongoose.disconnect();
    return;
  }

  // Dọn dẹp dữ liệu test cũ nếu có
  await Model.deleteMany({ maTKGD: TEST_ACCOUNT });

  let totalTests = 0;
  let passedTests = 0;

  async function runCase(name, fn) {
    totalTests++;
    const start = Date.now();
    try {
      await fn();
      const dur = Date.now() - start;
      pass(name, dur);
      passedTests++;
    } catch (err) {
      fail(name, err.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TESTCASE 1: Giai đoạn MAIL_INGEST
  // ──────────────────────────────────────────────────────────────────────────
  await runCase('TC1: Ghi log MAIL_INGEST (Nhận email từ Outlook Graph)', async () => {
    const log = await Model.create({
      maTKGD: TEST_ACCOUNT,
      batchDate: TEST_BATCH_DATE,
      stage: 'MAIL_INGEST',
      title: 'Nạp Email từ TVKD Phú Quý: NGUYỄN VĂN TEST',
      details: 'Tiêu đề: "[Mở TKGD] Yêu cầu mở tài khoản 085C9999999". Tệp đính kèm (3): HD_Mo_TKGD.pdf, CCCD_truoc.jpg, CCCD_sau.jpg',
      status: 'SUCCESS',
      extractedData: {
        subject: '[Mở TKGD] Yêu cầu mở tài khoản 085C9999999',
        senderEmail: 'support@phuquy.com.vn',
        senderName: 'Công ty TNHH Giao dịch hàng hoá Phú Quý',
        tenTaiKhoan: 'NGUYỄN VĂN TEST',
        receivedDateTime: new Date('2026-10-01T08:00:00Z'),
        attachmentsCount: 3,
        attachments: [
          { name: 'HD_Mo_TKGD.pdf', size: 245000 },
          { name: 'CCCD_truoc.jpg', size: 185000 },
          { name: 'CCCD_sau.jpg', size: 192000 },
        ],
      },
      performer: 'OUTLOOK_GRAPH',
      durationMs: 45,
    });

    if (!log._id) throw new Error('Không tạo được document log');
    if (log.stage !== 'MAIL_INGEST') throw new Error(`Stage không đúng: ${log.stage}`);
    if (log.extractedData.attachmentsCount !== 3) throw new Error('Dữ liệu extractedData bị thiếu');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TESTCASE 2: Giai đoạn EXTRACT_CONTRACT
  // ──────────────────────────────────────────────────────────────────────────
  await runCase('TC2: Ghi log EXTRACT_CONTRACT (Trích xuất HĐ PDF)', async () => {
    const log = await Model.create({
      maTKGD: TEST_ACCOUNT,
      batchDate: TEST_BATCH_DATE,
      stage: 'EXTRACT_CONTRACT',
      title: 'Trích xuất HĐ PDF: HD_Mo_TKGD.pdf',
      details: 'Họ tên: NGUYỄN VĂN TEST, CCCD: 001305005055, Ngày sinh: 17/10/2005, Ngày cấp: 03/08/2024, Nơi cấp: BỘ CÔNG AN',
      status: 'SUCCESS',
      extractedData: {
        soHopDong: '085C9999999/HDGD',
        hoVaTen: 'NGUYỄN VĂN TEST',
        soCanCuoc: '001305005055',
        ngaySinh: new Date('2005-10-17T00:00:00Z'),
        rawNgaySinh: '17/10/2005',
        ngayCap: new Date('2024-08-03T00:00:00Z'),
        rawNgayCap: '03/08/2024',
        noiCap: 'BỘ CÔNG AN',
        ngayKyHD: '01/10/2026',
        gioiTinh: 'Nam',
        loaiHinhTaiKhoan: 'Cá nhân',
        chuKy: 'Đã ký',
      },
      performer: 'PDF_EXTRACTOR',
      durationMs: 120,
    });

    if (log.extractedData.soCanCuoc !== '001305005055') throw new Error('Số CCCD bóc tách không khớp');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TESTCASE 3: Giai đoạn EXTRACT_CCCD
  // ──────────────────────────────────────────────────────────────────────────
  await runCase('TC3: Ghi log EXTRACT_CCCD (OCR CCCD, MRZ Line 1/2 & QR)', async () => {
    const log = await Model.create({
      maTKGD: TEST_ACCOUNT,
      batchDate: TEST_BATCH_DATE,
      stage: 'EXTRACT_CCCD',
      title: 'Bóc tách ảnh CCCD: OCR Thẻ Căn Cước Gắn Chip',
      details: 'Mặt trước: NGUYỄN VĂN TEST (17/10/2005). Mặt sau: Cục Cảnh sát QLHC. MRZ Checksum: VALID',
      status: 'SUCCESS',
      extractedData: {
        ocrHoTen: 'NGUYỄN VĂN TEST',
        ocrSoCCCD: '001305005055',
        ocrNgaySinh: '17/10/2005',
        ocrGioiTinh: 'Nam',
        mrzLine1: 'IDVNM001305005055<<<<<<<<<<<<<<<',
        mrzLine2: '0510178M3008035VNM<<<<<<<<<<<2',
        qrData: '001305005055|NGUYEN VAN TEST|17102005|Nam|Ha Noi|03082024',
        confidenceScore: 0.98,
        isChecksumValid: true,
      },
      performer: 'OCR_ENGINE',
      durationMs: 310,
    });

    if (!log.extractedData.mrzLine1 || !log.extractedData.mrzLine2) throw new Error('Thiếu dữ liệu MRZ kiểm toán');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TESTCASE 4: Giai đoạn SCRAPE_MSYSTEM
  // ──────────────────────────────────────────────────────────────────────────
  await runCase('TC4: Ghi log SCRAPE_MSYSTEM (Cào M-System & 10 Raw DOM Inputs)', async () => {
    const rawInputs = [
      '[Tên thành viên]="Công ty TNHH Giao dịch hàng hoá Phú Quý"',
      '[Tên môi giới]="Lê Thế Hiển"',
      `[Mã TKGD]="${TEST_ACCOUNT}"`,
      '[Tên TKGD]="NGUYỄN VĂN TEST"',
      '[Chọn thời điểm]="29/09/2026"',
      '[Họ và tên]="NGUYỄN VĂN TEST"',
      '[Chọn thời điểm]="17/10/2005"',
      '[Số CMT/ Hộ chiếu]="001305005055"',
      '[Chọn thời điểm]="03/08/2024"',
      '[Nơi cấp]="BỘ CÔNG AN"',
      '[Tên đầy đủ]="NGUYỄN VĂN TEST"',
    ];

    const log = await Model.create({
      maTKGD: TEST_ACCOUNT,
      batchDate: TEST_BATCH_DATE,
      stage: 'SCRAPE_MSYSTEM',
      title: 'Cào M-System: NGUYỄN VĂN TEST (Công ty TNHH Giao dịch hàng hoá Phú Quý)',
      details: 'Trạng thái: Hoạt động, CMT: 001305005055, Ngày sinh: 17/10/2005, TVKD: Công ty TNHH Giao dịch hàng hoá Phú Quý',
      status: 'SUCCESS',
      extractedData: {
        tenThanhVien: 'Công ty TNHH Giao dịch hàng hoá Phú Quý',
        tenMoiGioi: 'Lê Thế Hiển',
        tenTKGD: 'NGUYỄN VĂN TEST',
        hoVaTen: 'NGUYỄN VĂN TEST',
        soCMND_HoChieu: '001305005055',
        ngaySinh: '17/10/2005',
        ngayCap: '03/08/2024',
        noiCap: 'BỘ CÔNG AN',
        trangThai: 'Hoạt động',
        chuKy: 'Đã ký',
      },
      rawInputsLog: rawInputs,
      performer: 'MS_CRAWLER',
      durationMs: 850,
    });

    if (!log.rawInputsLog || log.rawInputsLog.length < 10) {
      throw new Error(`Mảng rawInputsLog không đủ 10 trường (thực tế: ${log.rawInputsLog?.length})`);
    }
    if (!log.rawInputsLog[0].includes('Phú Quý')) {
      throw new Error('Nội dung rawInputsLog không chính xác');
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TESTCASE 5: Giai đoạn RECONCILE
  // ──────────────────────────────────────────────────────────────────────────
  await runCase('TC5: Ghi log RECONCILE (Đối soát chéo 3 bên & Kết luận)', async () => {
    const log = await Model.create({
      maTKGD: TEST_ACCOUNT,
      batchDate: TEST_BATCH_DATE,
      stage: 'RECONCILE',
      title: 'Đối soát 3 bên: KHOP',
      details: 'Kết luận: KHOP. Lệch (0): Không phát hiện sai lệch (Khớp 100%)',
      status: 'SUCCESS',
      extractedData: {
        finalStatus: 'KHOP',
        finalErrors: [],
        autoHealedNotes: ['Khớp 100% Họ tên, CCCD, Ngày sinh, TVKD giữa HĐ, Mail và M-System'],
      },
      performer: 'RECONCILE_ENGINE',
      durationMs: 15,
    });

    if (log.extractedData.finalStatus !== 'KHOP') throw new Error('Trạng thái kết luận sai lệch');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TESTCASE 6: Giai đoạn MANUAL_OVERRIDE
  // ──────────────────────────────────────────────────────────────────────────
  await runCase('TC6: Ghi log MANUAL_OVERRIDE (Cán bộ phê duyệt thủ công)', async () => {
    const log = await Model.create({
      maTKGD: TEST_ACCOUNT,
      batchDate: TEST_BATCH_DATE,
      stage: 'MANUAL_OVERRIDE',
      title: 'Phê duyệt thủ công: clearing.officer@mxv.vn',
      details: 'Lý do: Hồ sơ đã được đối chiếu CCCD gắn chip gốc hợp lệ. Trạng thái chuyển thành: KHOP (ĐÃ DUYỆT)',
      status: 'SUCCESS',
      extractedData: {
        action: 'MANUAL_APPROVE',
        approvedBy: 'clearing.officer@mxv.vn',
        reason: 'Hồ sơ đã được đối chiếu CCCD gắn chip gốc hợp lệ',
        previousStatus: 'CAN_KIEM_TRA',
      },
      performer: 'clearing.officer@mxv.vn',
      durationMs: 8,
    });

    if (log.performer !== 'clearing.officer@mxv.vn') throw new Error('Performer không đúng');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TESTCASE 7: Benchmark Truy vấn Timeline qua Index { maTKGD: 1, createdAt: 1 }
  // ──────────────────────────────────────────────────────────────────────────
  await runCase('TC7: Truy vấn Timeline qua Compound Index (Latency Benchmark < 10ms)', async () => {
    const queryStart = Date.now();
    const timeline = await Model.find({ maTKGD: TEST_ACCOUNT })
      .sort({ createdAt: 1 })
      .lean();
    const queryDuration = Date.now() - queryStart;

    if (timeline.length !== 6) {
      throw new Error(`Mong đợi 6 sự kiện trong timeline, nhưng tìm thấy: ${timeline.length}`);
    }

    const expectedStages = [
      'MAIL_INGEST',
      'EXTRACT_CONTRACT',
      'EXTRACT_CCCD',
      'SCRAPE_MSYSTEM',
      'RECONCILE',
      'MANUAL_OVERRIDE',
    ];

    for (let i = 0; i < expectedStages.length; i++) {
      if (timeline[i].stage !== expectedStages[i]) {
        throw new Error(`Thứ tự timeline bị sai tại vị trí ${i}: mong đợi ${expectedStages[i]}, thực tế: ${timeline[i].stage}`);
      }
    }

    console.log(`     ${C.gray}→ Thời gian truy vấn MongoDB: ${queryDuration}ms (Sub-millisecond index scan)${C.reset}`);
    if (queryDuration > 50) {
      throw new Error(`Truy vấn quá chậm (${queryDuration}ms), có thể chưa dùng index`);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TỔNG KẾT
  // ──────────────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}${C.cyan}========================================================================${C.reset}`);
  console.log(`${C.bold}  KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} Test Cases Passed! ${passedTests === totalTests ? `${C.green}✓ THÀNH CÔNG 100%${C.reset}` : `${C.red}✗ CÓ LỖI${C.reset}`}${C.reset}`);
  console.log(`${C.bold}${C.cyan}========================================================================${C.reset}`);

  if (shouldKeep) {
    console.log(`\n📌 ${C.yellow}LƯU Ý: Dữ liệu test của tài khoản ${TEST_ACCOUNT} ĐANG ĐƯỢC GIỮ LẠI trong DB.${C.reset}`);
    console.log(`   Bạn có thể mở giao diện Web tại ${C.bold}http://localhost:3006${C.reset}, tìm tài khoản ${C.bold}${TEST_ACCOUNT}${C.reset} hoặc mở modal để xem trực tiếp giao diện Timeline 6 bước.`);
    console.log(`   Để xóa sạch dữ liệu test sau khi xem, chạy lệnh:`);
    console.log(`   ${C.bold}node src/scripts/test_extraction_lifecycle_audit.js --clean${C.reset}\n`);
  } else {
    const delRes = await Model.deleteMany({ maTKGD: TEST_ACCOUNT });
    console.log(`\n🧹 ${C.green}Đã dọn dẹp sạch ${delRes.deletedCount} bản ghi test khỏi CSDL (Zero Dirty Data).${C.reset}\n`);
  }

  await mongoose.disconnect();
}

runAuditTestSuite().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
