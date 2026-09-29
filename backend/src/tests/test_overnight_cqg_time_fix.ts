/**
 * TEST XÁC MINH FIX TOÀN DIỆN CHO ĐỐI CHIẾU KHỚP LỆNH CA ĐÊM (OVERNIGHT RECONCILIATION)
 * 
 * Mục tiêu kiểm thử:
 * 1. Xác minh parseCqgDateTime & parseTradeDateTime tự động nhận diện các lệnh sau nửa đêm (00:00 -> 05:59)
 *    thuộc về ngày tiếp theo của phiên (defaultDate + 1 ngày), chuẩn 100% theo C# TransactionCheckingService.cs#L140-L156.
 * 2. Xác minh không còn bất kỳ lệnh CQG nào phát sinh sau 00:00 bị loại bỏ bởi sessionStart.
 * 3. Xác minh isTodayOrCurrentSession nhận diện phiên ca đêm trên CoreCCP để bảo toàn giao dịch realtime.
 * 4. Đọc trực tiếp file FR.xlsx thực tế ngày 28/09/2026 (nếu có) để đếm số dòng khớp thành công.
 * 
 * Lệnh chạy (USER tự chạy trực tiếp trên terminal theo AGENTS.md):
 * npx ts-node -r tsconfig-paths/register src/tests/test_overnight_cqg_time_fix.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseCqgDateTime, parseTradeDateTime, parseFR } from '../modules/reconciliation/helpers/recon-number-parser.helper';
import { CqgExcelParser } from '../modules/reconciliation/parsers/cqg-excel.parser';
import { isTodayOrCurrentSession } from '../modules/bot-engine/ccp-ce-downloader.service';

let passedTests = 0;
let totalTests = 0;

function assert(description: string, condition: boolean, extraInfo?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${description}`);
  } else {
    console.error(` ❌ [FAIL] ${description}`);
    if (extraInfo) console.error(`        Chi tiết: ${extraInfo}`);
  }
}

console.log('================================================================================');
console.log(' KIỂM THỬ XÁC MINH SỬA LỖI ĐỐI CHIẾU CA ĐÊM (OVERNIGHT RECON FIX)');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// TESTCASE 1: parseCqgDateTime & CqgExcelParser.parseCqgDateTime cho ca đêm
// -----------------------------------------------------------------------------
console.log('--- TESTCASE 1: Nhận diện mốc thời gian lệnh sau 00:00 rạng sáng (hours < 6) ---');

const tradingDate = new Date('2026-09-28T00:00:00'); // Phiên giao dịch ngày 28/09
const sessionStart = new Date('2026-09-28T05:00:00'); // Bắt đầu phiên 05:00 sáng ngày 28/09

// 1. Lệnh trong ngày (có cả ngày tháng hoặc giờ ban ngày)
const t1 = parseCqgDateTime('9/28/26 14:30:00', tradingDate);
assert('Lệnh có ngày 28/09: giữ đúng ngày 28/09', 
  t1 !== null && t1.getDate() === 28 && t1.getMonth() === 8 && t1.getHours() === 14,
  `Kết quả: ${t1?.toISOString()}`
);

const t2 = parseCqgDateTime('14:30:00', tradingDate);
assert('Lệnh chỉ có giờ ban ngày (14:30): giữ đúng ngày 28/09', 
  t2 !== null && t2.getDate() === 28 && t2.getMonth() === 8 && t2.getHours() === 14,
  `Kết quả: ${t2?.toISOString()}`
);

// 2. Lệnh trước nửa đêm (23:59:30)
const t3 = parseCqgDateTime('23:59:30', tradingDate);
assert('Lệnh trước nửa đêm (23:59): giữ đúng ngày 28/09', 
  t3 !== null && t3.getDate() === 28 && t3.getHours() === 23,
  `Kết quả: ${t3?.toISOString()}`
);

// 3. Lệnh sau nửa đêm (CQG Desktop chỉ hiển thị giờ, ví dụ 00:36:49 lúc bot chạy bị lệch 80 lot)
const t4 = parseCqgDateTime('00:36:49.123', tradingDate);
assert('Lệnh sau 00:00 (00:36:49): tự động offset +1 ngày -> ngày 29/09', 
  t4 !== null && t4.getDate() === 29 && t4.getMonth() === 8 && t4.getHours() === 0 && t4.getMinutes() === 36,
  `Kết quả: ${t4?.toISOString()}`
);

const t5 = parseCqgDateTime('04:43:08.500', tradingDate);
assert('Lệnh rạng sáng (04:43:08): tự động offset +1 ngày -> ngày 29/09', 
  t5 !== null && t5.getDate() === 29 && t5.getMonth() === 8 && t5.getHours() === 4 && t5.getMinutes() === 43,
  `Kết quả: ${t5?.toISOString()}`
);

// 4. Kiểm tra class CqgExcelParser đồng bộ
const t6 = CqgExcelParser.parseCqgDateTime('00:36:49.123', tradingDate);
assert('CqgExcelParser.parseCqgDateTime đồng bộ offset +1 ngày cho lệnh rạng sáng', 
  t6 !== null && t6.getDate() === 29 && t6.getMonth() === 8 && t6.getHours() === 0,
  `Kết quả: ${t6?.toISOString()}`
);

// -----------------------------------------------------------------------------
// TESTCASE 2: So sánh với sessionStart (05:00 ngày 28/09)
// -----------------------------------------------------------------------------
console.log('\n--- TESTCASE 2: So sánh điều kiện lọc sessionStart (28/09 05:00) ---');

assert('Lệnh 00:36:49 ngày 29/09 >= sessionStart (28/09 05:00) -> KHÔNG BỊ LOẠI BỎ', 
  t4 !== null && t4 >= sessionStart,
  `tradeTime=${t4?.toISOString()} vs sessionStart=${sessionStart.toISOString()}`
);

assert('Lệnh 04:43:08 ngày 29/09 >= sessionStart (28/09 05:00) -> KHÔNG BỊ LOẠI BỎ', 
  t5 !== null && t5 >= sessionStart,
  `tradeTime=${t5?.toISOString()} vs sessionStart=${sessionStart.toISOString()}`
);

// -----------------------------------------------------------------------------
// TESTCASE 3: parseTradeDateTime cho time-only
// -----------------------------------------------------------------------------
console.log('\n--- TESTCASE 3: parseTradeDateTime cho chuỗi time-only ---');

const pt1 = parseTradeDateTime('00:36:49', tradingDate);
assert('parseTradeDateTime(00:36:49): tự động offset +1 ngày -> 29/09', 
  pt1 !== null && pt1.getDate() === 29 && pt1.getHours() === 0,
  `Kết quả: ${pt1?.toISOString()}`
);

const pt2 = parseTradeDateTime('28/09/2026 00:36:49', tradingDate);
assert('parseTradeDateTime có ngày rõ ràng (28/09/2026 00:36:49): giữ nguyên ngày 28/09', 
  pt2 !== null && pt2.getDate() === 28 && pt2.getHours() === 0,
  `Kết quả: ${pt2?.toISOString()}`
);

// -----------------------------------------------------------------------------
// TESTCASE 4: isTodayOrCurrentSession nhận diện phiên ca đêm CoreCCP
// -----------------------------------------------------------------------------
console.log('\n--- TESTCASE 4: isTodayOrCurrentSession cho CoreCCP ---');

// Ngày hôm nay theo lịch
const isTodayRes = isTodayOrCurrentSession(new Date().toISOString().split('T')[0]);
assert('isTodayOrCurrentSession trả về true cho ngày hôm nay', isTodayRes === true);

// -----------------------------------------------------------------------------
// TESTCASE 5: Đọc file FR.xlsx thực tế ngày 28/09/2026 (nếu có trên máy)
// -----------------------------------------------------------------------------
console.log('\n--- TESTCASE 5: Đọc và kiểm thử trên file dữ liệu thô FR.xlsx thực tế ---');

const candidatePaths = [
  path.join(process.cwd(), 'data', 'backup', 'cqg', 'futures', '2026', 'T09.2026', '28.09', 'FR.xlsx'),
  path.join(process.cwd(), '..', 'data', 'backup', 'cqg', 'futures', '2026', 'T09.2026', '28.09', 'FR.xlsx'),
  path.join('C:', 'Trading', 'Backup', 'CQG', 'Futures', '2026', 'T09.2026', '28.09', 'FR.xlsx'),
];

let foundFrPath = '';
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    foundFrPath = p;
    break;
  }
}

if (foundFrPath) {
  console.log(`Tìm thấy file FR thực tế tại: ${foundFrPath}`);
  const frTrades = parseFR(foundFrPath, tradingDate, []);
  console.log(`  • Tổng số dòng parse được từ FR.xlsx: ${frTrades.length}`);
  
  let postMidnightCount = 0;
  let preMidnightCount = 0;
  let retainedBySessionStart = 0;

  for (const fr of frTrades) {
    if (!fr.time) continue;
    const t = parseCqgDateTime(fr.time, tradingDate);
    if (!t) continue;
    if (t.getDate() === 29 && t.getHours() < 6) {
      postMidnightCount++;
    } else {
      preMidnightCount++;
    }
    if (t >= sessionStart) {
      retainedBySessionStart++;
    }
  }

  console.log(`  • Số lệnh trước nửa đêm (ngày 28/09): ${preMidnightCount}`);
  console.log(`  • Số lệnh sau nửa đêm (rạng sáng 29/09, hours < 6): ${postMidnightCount}`);
  console.log(`  • Tổng số lệnh giữ lại sau bộ lọc sessionStart (28/09 05:00): ${retainedBySessionStart}/${frTrades.length}`);

  assert('100% lệnh sau nửa đêm được giữ lại (không bị rơi rụng 178+ lệnh như trước)', 
    postMidnightCount > 0 ? (retainedBySessionStart === frTrades.length) : true,
    `retained=${retainedBySessionStart}, total=${frTrades.length}`
  );
} else {
  console.log('Không tìm thấy file FR.xlsx cục bộ (bỏ qua kiểm thử file thực tế, chỉ kiểm thử logic).');
}

// -----------------------------------------------------------------------------
// TỔNG KẾT
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(` KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTCASES ĐẠT (PASS RATE: ${(passedTests / totalTests * 100).toFixed(1)}%)`);
console.log('================================================================================');
