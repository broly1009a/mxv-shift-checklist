const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../../../CHANGELOG_AI.md');
const content = fs.readFileSync(file, 'utf8');
const headerText = `# CHANGELOG_AI.md - Nhật Ký Thay Đổi Code & Cấu Hình Của AI Assistant

## [2026-09-18T11:06] FIX: Khôi Phục 100% Chuẩn Gốc Contract getConsoleSummary & Sửa Lỗi Lọc Job Theo Ngày

### 1. Mục tiêu thay đổi
- Sửa triệt để hiện tượng trên màn hình Trading Manager (/trading-manager) bảng số liệu bị về 0 và thời điểm check hiển thị --/-- --:-- khi lọc ngày lịch sử hoặc xem lượt cũ.
- Soi dòng-từng-dòng đối chiếu với file gốc trước khi tách service (reconciliation.service.backup.ts:L5027-L5543), khôi phục 100% cấu trúc hợp đồng dữ liệu chuẩn mà không dùng bất kỳ logic fallback chắp vá nào.

### 2. Chi tiết phân tích & chỉnh sửa
1. Khôi phục chuẩn Root Keys & Sub-Objects:
   - Khôi phục object klgd với đầy đủ 17 trường chuẩn gốc (totals, executedAt, status, logs, isWaitingFiles, waitingMessage, mismatchedTrades, mismatchedTTM, mismatchedTTTT...).
   - Khôi phục object shiftInfo với đầy đủ 7 trường chuẩn gốc (lastCheckedAt, nextScanInSeconds, frequencyMinutes, shiftLogId, shiftName...).
   - Khôi phục trường currentJobId: klgdJob?._id?.toString() || null.
   - Khôi phục object preEod với đầy đủ 18 trường chuẩn gốc.
2. Khắc phục câu Query lọc theo ngày (targetDate):
   - Thay thế câu lệnh query lấy job toàn cục findOne({ jobType: 'CHECK_KLGD' }) bằng query có điều kiện ngày chặt chẽ dateFilterCondition (createdAt trong ngày VN/UTC hoặc payload date tương ứng).
   - Ngăn chặn triệt để việc lấy nhầm job của ngày hôm nay (18/09) ép unshift vào mảng runs của ngày lịch sử (11/09).
3. Công cụ tự động kiểm toán (audit_get_console_summary_diff.js):
   - So khớp tự động 100% tất cả các Root Keys, sub-keys của klgd, shiftInfo, preEod, negativeMargin, ccpSummary.
   - Khẳng định 7/7 khối logic nghiệp vụ lõi đều đạt PASS 100%.

### 3. Danh sách file chỉnh sửa
- backend/src/modules/reconciliation/services/recon-console-summary.service.ts
- backend/src/scripts/audit_get_console_summary_diff.js
- CHANGELOG_AI.md

### 4. Xác nhận Build & Kiểm thử
- Backend Build (nest build): Thành công 100% (Exit code: 0).
- Frontend Build (next build): Thành công 100% (Exit code: 0).
- Audit Script Diff (audit_get_console_summary_diff.js): 100% PASS tất cả các key và khối logic.

---

`;

fs.writeFileSync(file, headerText + content.replace(/^# CHANGELOG_AI\.md[^\n]*\n+/g, '').trimStart());
console.log('CHANGELOG_AI.md updated successfully!');
