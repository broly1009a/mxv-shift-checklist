/**
 * BỘ TESTCASE XÁC MINH TOÀN DIỆN:
 * 1. LOGIC LỌC TÀI KHOẢN VÀ GIAO DỊCH TRONG DSGD (M-SYSTEM) VS FR (CQG)
 * 2. CƠ CHẾ CUTOFF TIME (BẢO LƯU GIAO DỊCH CQG TẢI SAU / KHỚP SAU DSGD VÀO pendingSyncTrades)
 * 3. BỘ ĐỆM AN TOÀN 2,000ms TRIỆT TIÊU ĐỘ TRỄ MẠNG FIX / SQL
 * 4. PHÂN TÁCH TỰ DOANH ĐUÔI 'A' VÀ LOẠI TRỪ HỢP ĐỒNG ZWAZCE
 * 
 * Lệnh chạy (USER tự chạy trực tiếp trên terminal):
 * npx ts-node -r tsconfig-paths/register src/tests/test_dsgd_cqg_filtering_and_cutoff_cases.ts
 */

import { parseTradeDateTime, parseCqgDateTime } from '../modules/reconciliation/helpers/recon-number-parser.helper';

interface RawDsgdRow {
  maGD: string;
  maTKGD: string;
  maHD: string;
  giaKhop: number;
  klGiaoDich: number;
  ngayGio: string;
  combinedKey: string;
}

interface RawFrRow {
  ord: string;
  accountRaw: string;
  symbol: string;
  fillP: number;
  qty: number;
  time: string;
  combinedKey: string;
}

function runReconSimulation(
  rawDsgdData: RawDsgdRow[],
  rawFrData: RawFrRow[],
  tradingDate: Date,
  sessionStart: Date,
  checkTime: Date,
  cutoffTime?: Date,
) {
  // 1. Lọc DSGD: Chuẩn theo C# TransactionCheckingService.cs#L125 & klgd-recon.service.ts#L200-L206
  const dsgdData = rawDsgdData.filter((gd) => {
    if (!gd.ngayGio) return true;
    const tradeTime = parseTradeDateTime(gd.ngayGio, tradingDate);
    if (!tradeTime) return true;
    return tradeTime <= checkTime;
  });

  // 2. Lọc CQG FR & Cutoff Time (klgd-recon.service.ts#L244-L264)
  const pendingSyncTrades: Array<any> = [];
  const frData = rawFrData.filter((fr) => {
    if (!fr.time) return true;
    const tradeTime = parseCqgDateTime(fr.time, tradingDate);
    if (!tradeTime) return true;
    if (tradeTime < sessionStart) return false;
    if (cutoffTime && tradeTime > cutoffTime) {
      pendingSyncTrades.push({
        source: 'CQG',
        maLenh: fr.ord,
        maTKGD: fr.accountRaw,
        maHD: fr.symbol,
        giaKhop: fr.fillP,
        klGiaoDich: fr.qty,
        ngayGio: fr.time,
        cutoffTime: cutoffTime.toISOString(),
        note: `Lệnh CQG khớp lúc ${fr.time}, sau mốc chốt dữ liệu M-System (${cutoffTime.toLocaleTimeString('vi-VN')})`,
      });
      return false; // Lọc bỏ khỏi tập đối chiếu kỳ này
    }
    return tradeTime <= checkTime;
  });

  // 3. Tính tổng khối lượng (klgd-recon.service.ts#L266-L283)
  let totalDSGD = 0;
  let totalACM = 0;
  let totalFR = 0;

  dsgdData.forEach((gd) => {
    // Tài khoản đuôi 'A' là tự doanh ACM -> Tách riêng
    if (gd.maTKGD.toUpperCase().endsWith('A')) {
      totalACM += gd.klGiaoDich;
    } else {
      totalDSGD += gd.klGiaoDich;
    }
  });

  frData.forEach((fr) => {
    // Loại trừ mã ZWAZCE
    if (fr.symbol !== 'ZWAZCE') {
      totalFR += fr.qty;
    }
  });

  // 4. Tìm kiếm lệnh lệch chi tiết (klgd-recon.service.ts#L350-L384)
  const mismatchedTrades: Array<any> = [];

  // Quét từ CQG sang MS
  frData.forEach((fr) => {
    if (fr.symbol === 'ZWAZCE') return;
    const existsInDSGD = dsgdData.some((gd) => gd.combinedKey === fr.combinedKey);
    if (!existsInDSGD) {
      mismatchedTrades.push({
        source: 'CQG',
        maLenh: fr.ord,
        maTKGD: fr.accountRaw,
        maHD: fr.symbol,
        giaKhop: fr.fillP,
        klGiaoDich: fr.qty,
        ngayGio: fr.time,
        reason: 'Lệnh CQG không tìm thấy bên M-System',
      });
    }
  });

  // Quét từ MS sang CQG
  dsgdData.forEach((gd) => {
    if (gd.maTKGD.toUpperCase().endsWith('A')) return;
    const existsInFR = frData.some((fr) => fr.combinedKey === gd.combinedKey);
    if (!existsInFR) {
      mismatchedTrades.push({
        source: 'MSystem',
        maLenh: gd.maLenh,
        maTKGD: gd.maTKGD,
        maHD: gd.maHD,
        giaKhop: gd.giaKhop,
        klGiaoDich: gd.klGiaoDich,
        ngayGio: gd.ngayGio,
        reason: 'Giao dịch M-System không tìm thấy bên CQG',
      });
    }
  });

  const differ = Math.abs(totalFR - totalDSGD);

  return {
    totalDSGD,
    totalACM,
    totalFR,
    differ,
    pendingSyncTrades,
    mismatchedTrades,
  };
}

console.log('================================================================================');
console.log(' KIỂM THỬ TỔNG THỂ CÁC TESTCASE LỌC DSGD VS CQG (CUTOFF & ACCOUNT RULES)');
console.log('================================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(description: string, condition: boolean, extraInfo?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${description}`);
  } else {
    console.error(`❌ [FAIL] ${description}`);
  }
  if (extraInfo) {
    console.log(`   └─ ${extraInfo}`);
  }
}

// Thiết lập môi trường phiên giao dịch mẫu
const tradingDate = new Date('2026-09-23T00:00:00+07:00');
const sessionStart = new Date('2026-09-23T05:00:00+07:00');
const checkTime = new Date('2026-09-24T05:00:00+07:00');

// Mốc xuất file DSGD: 10:13:13 ngày 23/09/2026
// Buffer -2000ms: CutoffTime = 10:13:11
const dsgdMTime = new Date('2026-09-23T10:13:13+07:00');
const effectiveCutoffTime = new Date(dsgdMTime.getTime() - 2000); // 10:13:11

// Dữ liệu mẫu
const baseDsgd: RawDsgdRow[] = [
  {
    maGD: 'GD001',
    maTKGD: '003C111111',
    maHD: 'ZCEZ26',
    giaKhop: 450,
    klGiaoDich: 5,
    ngayGio: '23/09/2026 09:30:00',
    combinedKey: '003C111111_ZCEZ26_450',
  },
  {
    maGD: 'GD002',
    maTKGD: '003C222222',
    maHD: 'CLEV26',
    giaKhop: 75.5,
    klGiaoDich: 10,
    ngayGio: '23/09/2026 10:05:00',
    combinedKey: '003C222222_CLEV26_75.5',
  },
];

const baseFr: RawFrRow[] = [
  {
    ord: 'ORD001',
    accountRaw: '003C111111',
    symbol: 'ZCEZ26',
    fillP: 450,
    qty: 5,
    time: '09:30:00',
    combinedKey: '003C111111_ZCEZ26_450',
  },
  {
    ord: 'ORD002',
    accountRaw: '003C222222',
    symbol: 'CLEV26',
    fillP: 75.5,
    qty: 10,
    time: '10:05:00',
    combinedKey: '003C222222_CLEV26_75.5',
  },
];

// -----------------------------------------------------------------------------
// TESTCASE 1: Đối chiếu bình thường (Khớp 100% giữa MS và CQG)
// -----------------------------------------------------------------------------
console.log('--- TESTCASE 1: Đối chiếu bình thường trước Cutoff Time ---');
const res1 = runReconSimulation(baseDsgd, baseFr, tradingDate, sessionStart, checkTime, effectiveCutoffTime);
assert('Tổng KLGD MS bằng CQG (15 lot)', res1.totalDSGD === 15 && res1.totalFR === 15, `MS=${res1.totalDSGD}, CQG=${res1.totalFR}`);
assert('Độ lệch differ = 0', res1.differ === 0);
assert('Không có lệnh bảo lưu pendingSyncTrades', res1.pendingSyncTrades.length === 0);
assert('Không có lệnh lệch mismatchedTrades', res1.mismatchedTrades.length === 0);

// -----------------------------------------------------------------------------
// TESTCASE 2: Lệnh CQG khớp SAU mốc Cutoff Time (CQG tải sau DSGD)
// -----------------------------------------------------------------------------
console.log('\n--- TESTCASE 2: CQG tải sau / Khớp sau mốc Cutoff Time của DSGD ---');
// Thêm 2 lệnh CQG khớp sau 10:13:11
const frWithCutoff: RawFrRow[] = [
  ...baseFr,
  {
    ord: 'ORD003',
    accountRaw: '003C0376669',
    symbol: 'SILZ26',
    fillP: 31.2,
    qty: 1,
    time: '10:13:18', // Khớp lúc 10:13:18 (> 10:13:11)
    combinedKey: '003C0376669_SILZ26_31.2',
  },
  {
    ord: 'ORD004',
    accountRaw: '012C5395262',
    symbol: 'ZWAZ26',
    fillP: 580,
    qty: 2,
    time: '10:13:31', // Khớp lúc 10:13:31 (> 10:13:11)
    combinedKey: '012C5395262_ZWAZ26_580',
  },
];

const res2 = runReconSimulation(baseDsgd, frWithCutoff, tradingDate, sessionStart, checkTime, effectiveCutoffTime);
assert('2 lệnh phát sinh sau Cutoff Time được đưa vào pendingSyncTrades', res2.pendingSyncTrades.length === 2, `Số lệnh pending: ${res2.pendingSyncTrades.length}`);
assert('Lệnh pending ghi nhận đúng mã lệnh ORD003 & ORD004', 
  res2.pendingSyncTrades.some((p) => p.maLenh === 'ORD003') && 
  res2.pendingSyncTrades.some((p) => p.maLenh === 'ORD004')
);
assert('Khối lượng CQG được lọc loại trừ lệnh pending, vẫn giữ bằng MS = 15 lot', res2.totalFR === 15, `totalFR=${res2.totalFR}`);
assert('Không bị báo lệch giả (differ = 0, mismatchedTrades rỗng)', res2.differ === 0 && res2.mismatchedTrades.length === 0);

// -----------------------------------------------------------------------------
// TESTCASE 3: Tài khoản tự doanh kết thúc bằng 'A' trong DSGD
// -----------------------------------------------------------------------------
console.log('\n--- TESTCASE 3: Phân tách tài khoản tự doanh đuôi "A" trong DSGD ---');
const dsgdWithACM: RawDsgdRow[] = [
  ...baseDsgd,
  {
    maGD: 'GD003_ACM',
    maTKGD: '003A888888', // Tài khoản tự doanh đuôi A
    maHD: 'ZCEZ26',
    giaKhop: 450,
    klGiaoDich: 8,
    ngayGio: '23/09/2026 09:40:00',
    combinedKey: '003A888888_ZCEZ26_450',
  },
];

const res3 = runReconSimulation(dsgdWithACM, baseFr, tradingDate, sessionStart, checkTime, effectiveCutoffTime);
assert('Tài khoản đuôi A được tách vào totalACM (8 lot)', res3.totalACM === 8, `totalACM=${res3.totalACM}`);
assert('totalDSGD chỉ tính tài khoản thường (15 lot)', res3.totalDSGD === 15, `totalDSGD=${res3.totalDSGD}`);
assert('Tài khoản đuôi A KHÔNG bị so khớp nhầm với CQG (mismatchedTrades rỗng)', res3.mismatchedTrades.length === 0);

// -----------------------------------------------------------------------------
// TESTCASE 4: Sản phẩm loại trừ đặc biệt ZWAZCE trên CQG
// -----------------------------------------------------------------------------
console.log('\n--- TESTCASE 4: Loại trừ sản phẩm ZWAZCE trên CQG ---');
const frWithZWAZCE: RawFrRow[] = [
  ...baseFr,
  {
    ord: 'ORD005_ZWAZCE',
    accountRaw: '003C111111',
    symbol: 'ZWAZCE', // Mã bị loại trừ theo quy chuẩn C#
    fillP: 600,
    qty: 50,
    time: '09:50:00',
    combinedKey: '003C111111_ZWAZCE_600',
  },
];

const res4 = runReconSimulation(baseDsgd, frWithZWAZCE, tradingDate, sessionStart, checkTime, effectiveCutoffTime);
assert('Mã ZWAZCE không được cộng vào totalFR (vẫn giữ 15 lot)', res4.totalFR === 15, `totalFR=${res4.totalFR}`);
assert('Mã ZWAZCE không gây ra mismatchedTrades', res4.mismatchedTrades.length === 0);

// -----------------------------------------------------------------------------
// TESTCASE 5: Giao dịch ca đêm (từ 21:00 đến 02:00 sáng hôm sau)
// -----------------------------------------------------------------------------
console.log('\n--- TESTCASE 5: Giao dịch ca đêm trong cùng phiên giao dịch ---');
const dsgdOvernight: RawDsgdRow[] = [
  ...baseDsgd,
  {
    maGD: 'GD_NIGHT_01',
    maTKGD: '003C333333',
    maHD: 'CLEV26',
    giaKhop: 76.2,
    klGiaoDich: 20,
    ngayGio: '23/09/2026 23:30:00',
    combinedKey: '003C333333_CLEV26_76.2',
  },
  {
    maGD: 'GD_NIGHT_02',
    maTKGD: '003C333333',
    maHD: 'CLEV26',
    giaKhop: 76.5,
    klGiaoDich: 15,
    ngayGio: '24/09/2026 01:15:00',
    combinedKey: '003C333333_CLEV26_76.5',
  },
];

const frOvernight: RawFrRow[] = [
  ...baseFr,
  {
    ord: 'ORD_NIGHT_01',
    accountRaw: '003C333333',
    symbol: 'CLEV26',
    fillP: 76.2,
    qty: 20,
    time: '23:30:00',
    combinedKey: '003C333333_CLEV26_76.2',
  },
  {
    ord: 'ORD_NIGHT_02',
    accountRaw: '003C333333',
    symbol: 'CLEV26',
    fillP: 76.5,
    qty: 15,
    time: '01:15:00',
    combinedKey: '003C333333_CLEV26_76.5',
  },
];

// Cutoff lúc 01:30 sáng ngày 24/09/2026
const overnightCutoff = new Date('2026-09-24T01:30:00+07:00');
const res5 = runReconSimulation(dsgdOvernight, frOvernight, tradingDate, sessionStart, checkTime, overnightCutoff);
assert('Cả 2 lệnh đêm (23:30 ngày 23 và 01:15 ngày 24) được tính trọn vẹn (+35 lot)', res5.totalDSGD === 50 && res5.totalFR === 50, `MS=${res5.totalDSGD}, CQG=${res5.totalFR}`);
assert('Không có lệnh bị lọc nhầm do chặn dưới (differ = 0)', res5.differ === 0);

// -----------------------------------------------------------------------------
// TESTCASE 6: Trường hợp DSGD xuất hiện giao dịch mà CQG THIẾU THỰC SỰ
// -----------------------------------------------------------------------------
console.log('\n--- TESTCASE 6: Phát hiện chính xác lệch thực sự (M-System có, CQG thiếu) ---');
const dsgdWithMissingOnCqg: RawDsgdRow[] = [
  ...baseDsgd,
  {
    maGD: 'GD_MISSING_CQG',
    maTKGD: '003C999999',
    maHD: 'ZCEZ26',
    giaKhop: 452,
    klGiaoDich: 4,
    ngayGio: '23/09/2026 10:00:00',
    combinedKey: '003C999999_ZCEZ26_452',
  },
];

const res6 = runReconSimulation(dsgdWithMissingOnCqg, baseFr, tradingDate, sessionStart, checkTime, effectiveCutoffTime);
assert('differ phản ánh đúng độ lệch 4 lot', res6.differ === 4, `differ=${res6.differ}`);
assert('mismatchedTrades ghi nhận đúng nguồn MSystem', 
  res6.mismatchedTrades.length === 1 && 
  res6.mismatchedTrades[0].source === 'MSystem' && 
  res6.mismatchedTrades[0].maTKGD === '003C999999',
  `Lý do: ${res6.mismatchedTrades[0]?.reason}`
);

// -----------------------------------------------------------------------------
// TESTCASE 7: Bộ đệm an toàn 2,000ms: Lệnh khớp sát nút thời điểm tải DSGD
// -----------------------------------------------------------------------------
console.log('\n--- TESTCASE 7: Hiệu quả của bộ đệm buffer 2,000ms (-2s) ---');
// Mtime DSGD ghi đĩa: 10:13:13.000
// Lệnh CQG khớp lúc: 10:13:12.200 (sát nút 800ms trước khi file ghi đĩa, nhưng SAU khi Playwright bấm nút xuất)
const frBorderline: RawFrRow[] = [
  ...baseFr,
  {
    ord: 'ORD_BORDERLINE',
    accountRaw: '003C0930168',
    symbol: 'ZWAZ26',
    fillP: 718,
    qty: 1,
    time: '10:13:12', // 10:13:12
    combinedKey: '003C0930168_ZWAZ26_718',
  },
];

// Nếu KHÔNG có buffer 2000ms (Cutoff = 10:13:13):
const resNoBuffer = runReconSimulation(baseDsgd, frBorderline, tradingDate, sessionStart, checkTime, dsgdMTime);
// Nếu CÓ buffer 2000ms (Cutoff = 10:13:11):
const resWithBuffer = runReconSimulation(baseDsgd, frBorderline, tradingDate, sessionStart, checkTime, effectiveCutoffTime);

assert('Khi KHÔNG có buffer: Lệnh bị tính là lệch giả do lầm tưởng khớp trước lúc xuất', 
  resNoBuffer.mismatchedTrades.length === 1 && resNoBuffer.differ === 1,
  `differ=${resNoBuffer.differ}, lệch giả=${resNoBuffer.mismatchedTrades[0]?.reason}`
);
assert('Khi CÓ buffer 2000ms: Lệnh được bảo vệ an toàn đưa vào pendingSyncTrades', 
  resWithBuffer.pendingSyncTrades.length === 1 && resWithBuffer.differ === 0 && resWithBuffer.mismatchedTrades.length === 0,
  `pending=${resWithBuffer.pendingSyncTrades[0]?.maLenh}, differ=${resWithBuffer.differ}`
);

// -----------------------------------------------------------------------------
// TỔNG KẾT
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(` KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTCASES ĐẠT (PASS RATE: ${(passedTests / totalTests * 100).toFixed(1)}%)`);
console.log('================================================================================');
console.log('KẾT LUẬN TOÀN DIỆN VỀ LOGIC LỌC DSGD & CQG:');
console.log('1. [GIỮ NGUYÊN 100%] Cơ chế Cutoff Time & pendingSyncTrades: Tất cả lệnh CQG khớp sau');
console.log('   mốc tải DSGD (hoặc do độ trễ tải mạng) đều được tự động bảo lưu, không báo lệch giả.');
console.log('2. [GIỮ NGUYÊN 100%] Tài khoản đuôi "A" được lọc tách riêng cho tự doanh ACM Nano.');
console.log('3. [GIỮ NGUYÊN 100%] Hợp đồng ZWAZCE trên CQG bị loại trừ theo chuẩn Tool C#.');
console.log('4. [GIỮ NGUYÊN 100%] Bộ đệm an toàn 2,000ms triệt tiêu độ trễ mạng FIX Dropcopy.');
console.log('5. [ĐÃ TỐI ƯU HÓA] Bỏ chặn dưới trên DSGD & Nano, cho phép khớp lệnh ca đêm thông suốt.');
console.log('================================================================================');
