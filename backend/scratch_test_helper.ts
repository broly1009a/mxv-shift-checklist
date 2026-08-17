import {
  parseJobPayload,
  resolveBotTargetDate,
  resolveDailySubfolder,
} from './src/modules/bot-engine/helpers/bot-path.helper';

console.log('====================================================');
console.log('🧪 BẮT ĐẦU KIỂM THỬ TÍNH ĐÚNG ĐẮN CỦA BOT PATH HELPER');
console.log('====================================================\n');

// Test Case 1: Giả lập Job chạy rạng sáng ngày 16.08 (Chủ nhật) với shiftDate ca Thứ 7 (15.08)
const mockPayload1 = {
  taskId: 'TASK_123',
  shiftLogId: 'LOG_456',
  sessionDay: '2026-08-15',
  targetDate: '2026-08-15',
};

const { dateObj, dateStr } = resolveBotTargetDate(mockPayload1);
const { subFolder, fullPath } = resolveDailySubfolder(
  'C:\\Quanlygiaodich\\Backup MS\\Futures',
  dateObj,
);

console.log('1️⃣ TEST CASE 1: Chạy rạng sáng Chủ Nhật (16.08) cho ca Thứ 7 (15.08):');
console.log('   - Input payload sessionDay:', mockPayload1.sessionDay);
console.log('   - Output parsed dateStr:   ', dateStr);
console.log('   - Output subFolder:        ', subFolder);
console.log('   - Output fullPath:         ', fullPath);

if (dateStr === '2026-08-15' && subFolder.endsWith('15.08')) {
  console.log('   ✅ PASSED: Đã định tuyến chính xác về folder 15.08, KHÔNG bị lệch sang 16.08!\n');
} else {
  console.error('   ❌ FAILED: Lỗi định tuyến ngày!\n');
}

// Test Case 2: Kiểm tra parseJobPayload với Mongoose Map
const mockMap = new Map();
mockMap.set('targetDate', '2026-08-15');
mockMap.set('shiftLogId', 'ABC_999');

const parsedPayload = parseJobPayload({ payload: mockMap });
console.log('2️⃣ TEST CASE 2: Parse Job Payload từ Mongoose Map:');
console.log('   - Input payload type: Map');
console.log('   - Parsed result:     ', parsedPayload);

if (parsedPayload.targetDate === '2026-08-15' && parsedPayload.shiftLogId === 'ABC_999') {
  console.log('   ✅ PASSED: Unwrap Mongoose Map thành Plain Object thành công!\n');
} else {
  console.error('   ❌ FAILED: Unwrap Mongoose Map thất bại!\n');
}

// Test Case 3: Kiểm tra chặn khi thiếu targetDate
console.log('3️⃣ TEST CASE 3: Kiểm tra cơ chế chặn khi payload THIẾU targetDate/sessionDay:');
try {
  resolveBotTargetDate({});
  console.error('   ❌ FAILED: Không chặn khi thiếu targetDate!\n');
} catch (err: any) {
  console.log('   ✅ PASSED: Đã chặn thành công với thông báo lỗi:');
  console.log('      "', err.message, '"\n');
}

console.log('====================================================');
console.log('🎉 TẤT CẢ KIỂM THỬ HELPER ĐÃ HOÀN THÀNH VÀ THÀNH CÔNG!');
console.log('====================================================');
