# CHANGELOG_AI.md - Nhật Ký Thay Đổi Code & Cấu Hình Của AI Assistant

Tài liệu này dùng để ghi vết tất cả các lượt chỉnh sửa code (Frontend, Backend), cấu hình Bot và logic nghiệp vụ do AI Assistant thực hiện trong dự án.

---

## [2026-07-24 08:20:00] - Chuẩn hóa Quy tắc Nghiệp vụ & Khôi phục Tự động Ghép File CQG

### 1. Mục tiêu Thay đổi
- Cập nhật đúng loại Bot Check (`CHECK_KLGD`) cho tác vụ `[TASK_CHECK_KLGD] Giám sát & Đối chiếu MS vs CQG trong phiên`.
- Phân định rõ 2 hàm `runAutoCheckKLGD` (định kỳ 1h/lần trong phiên) và `runAutoCheckPreEOD` (chốt EOD cuối ngày).
- Khôi phục tính năng ghép tự động các file thô CQG (`FR1` + `FR2` $\rightarrow$ `FR.xlsx`, `PS1` + `PS2` $\rightarrow$ `PS.xlsx`).
- Chuẩn hóa việc nhận diện file ACM chỉ nhận file **Straits CSV** (chứa từ khóa `Straits`).

### 2. Danh sách File Chỉnh sửa
- [seed-subtasks.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/scripts/seed-subtasks.js)
- [exported_templates.json](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/database/exported_templates.json)
- [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts)
- [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts)
- [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)
- [.agents/AGENTS.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/.agents/AGENTS.md)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`seed-subtasks.js` & `exported_templates.json`**: Thay đổi `botCheckType` của subtask `TASK_CHECK_KLGD_s1` từ `CHECK_PRE_EOD` sang `CHECK_KLGD`.
- **`bot-engine.service.ts` & `bot-job-queue.service.ts`**: Bổ sung xử lý `jobType === 'CHECK_KLGD'` và enqueue job `CHECK_KLGD` để gọi `runAutoCheckKLGD`.
- **`reconciliation.service.ts`**:
  - Khôi phục hàm helper `mergeCqgRawFiles` ghép `FR1`+`FR2` $\rightarrow$ `FR.xlsx` và `PS1`+`PS2` $\rightarrow$ `PS.xlsx`.
  - Thay đổi pattern đọc file ACM chỉ chấp nhận `/Straits/i` (file Straits CSV).
- **Cơ sở dữ liệu MongoDB**: Đã cập nhật `botCheckType: 'CHECK_KLGD'` trong `checklist_templates` và 4 bản ghi `shift_logs`.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npx tsc --noEmit` & `npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 08:30:00] - Khắc phục Trạng thái Treo "Đang kiểm tra..." & Tối ưu hóa Reset Job Queue

### 1. Mục tiêu Thay đổi
- Giải quyết triệt để vấn đề các tác vụ Bot bị treo ở trạng thái "Đang kiểm tra..." (PROCESSING) khi khởi tạo ca trực hoặc restart server.
- Tự động dọn dẹp các Job bị nghẽn trong Queue để giải phóng tiến trình kiểm tra ngầm.

### 2. Danh sách File Chỉnh sửa
- [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts)
- [clear-stuck-jobs.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/scripts/clear-stuck-jobs.js)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`bot-job-queue.service.ts`**:
  - Cập nhật `cleanupStuckJobs(true)` tự động reset tất cả các Job mồ côi (đang ở trạng thái `PROCESSING`) ngay khi Server khởi động lại (`onModuleInit`).
  - Giảm thời gian chờ timeout dọn dẹp Job bị treo từ **30 phút xuống 3 phút**.
- **Chạy Script Dọn dẹp MongoDB**: Chạy script reset 3 Job cũ đang bị treo từ trước về trạng thái `FAILED` để giải phóng Queue.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 08:31:00] - Khắc phục Logic Nhận Diện File Backup Hiện Có (`scanMsBackupFiles`)

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi Bot nhận diện nhầm file thành `OUTDATED`/`MISSING` và vô tình bật Playwright tải lại 17 file đã có sẵn trong thư mục backup ngày.

### 2. Danh sách File Chỉnh sửa
- [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`bot-job-queue.service.ts` (`scanMsBackupFiles`)**:
  - Loại bỏ điều kiện kiểm tra cứng ngày modified `stat.mtime === today` (vốn khiến các file được copy/tải từ trước bị đánh dấu sai là `OUTDATED`).
  - Bổ sung tìm kiếm linh hoạt loại bỏ khoảng trắng dư thừa (fuzzy match) cho các file như `market truoc 6 h.csv` vs `market truoc 6h.csv`.
  - Chỉ cần file tồn tại trong thư mục backup của ngày hôm nay và dung lượng `size > 0` thì xác nhận trạng thái **`OK`**, không tải lại dư thừa.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 08:37:00] - Khắc phục Trạng thái Task Quét Ký Quỹ/Check KLGD Bị Treo "Đang xử lý"

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi tác vụ quét tài khoản âm ký quỹ / đối chiếu dù đã có kết quả (`⚠️ Phát hiện 181 tài khoản âm ký quỹ...`) nhưng giao diện vẫn hiển thị tag trạng thái "Đang xử lý" / "Đang kiểm tra".

### 2. Danh sách File Chỉnh sửa
- [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts)
- [find-181-task.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/scripts/find-181-task.js)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`bot-engine.service.ts`**:
  - Khi Bot hoàn thành việc quét file và trả về danh sách tài khoản âm ký quỹ, gán `checkResult.success = true` (thay vì `false`), giúp tác vụ chuyển trạng thái chuẩn sang **`COMPLETED`** (Đã hoàn thành) thay vì bị giữ lại ở `WAITING` ("Đang kiểm tra...").
- **Cơ sở dữ liệu MongoDB**: Đã cập nhật trạng thái bản ghi `TASK_CHECK_KLGD_s1` trong `shift_logs` từ `NEEDS_ATTENTION` sang `COMPLETED`.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 08:42:00] - Cập nhật Chuẩn Ngày Đối Chiếu Pre-EOD (T-1)

### 1. Mục tiêu Thay đổi
- Chuẩn hóa ngày đối chiếu dữ liệu Pre-EOD: Khi chạy chốt Pre-EOD đầu ca trực (ví dụ ngày 24/07), số liệu phiên giao dịch vừa khép lại là của phiên **T-1** (ngày 23/07).

### 2. Danh sách File Chỉnh sửa
- [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`reconciliation.service.ts` (`runAutoCheckPreEOD`)**:
  - Tự động lấy `targetDate = tradingDate - 1 day` (chuyển sang ngày T-1) để tìm thư mục backup và đối chiếu dữ liệu chốt cho phiên làm việc vừa khép lại.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 08:55:00] - Đã Cập Nhật Bảng Ánh Xạ Hàm (Mapping) C# IT Tool vs NestJS/Next.js

### 1. Mục tiêu Thay đổi
- Ghi vết bảng ánh xạ trực tiếp các file/hàm từ mã nguồn C# IT Tool cũ (`operate-transaction-app`, `margin-checker`, `CCP-Statistics-Tool`) sang mã nguồn NestJS/Next.js mới để phục vụ tra cứu và đối soát lâu dài.

### 2. Danh sách File Chỉnh sửa
- [.agents/AGENTS.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/.agents/AGENTS.md)
- [CHANGELOG_AI.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/CHANGELOG_AI.md)

### 3. Bảng Ánh Xạ Hàm Chi Tiết (Cross-Reference Table)
- **`TransactionCheckingService.cs` $\rightarrow$ `CheckKLGD()`** $\Rightarrow$ `reconciliation.service.ts` $\rightarrow$ `checkKLGD()` / `runAutoCheckKLGD()`
- **`TransactionCheckingService.cs` $\rightarrow$ `CheckKLGD()` / `CheckEOD()`** $\Rightarrow$ `reconciliation.service.ts` $\rightarrow$ `checkPreEOD()` / `runAutoCheckPreEOD()`
- **`FileUtils.cs` $\rightarrow$ `GetTradingNanoData()`** $\Rightarrow$ `reconciliation.service.ts` $\rightarrow$ `parseStraitsCsv()`
- **`FileUtils.cs` $\rightarrow$ `GetTradingFRData()`** $\Rightarrow$ `reconciliation.service.ts` $\rightarrow$ `mergeCqgRawFiles()` & `cqg-sync.service.ts`
- **`MarginChecking.cs` $\rightarrow$ `CheckMargin()`** $\Rightarrow$ `post-eod-handler.service.ts` $\rightarrow$ `scanNegativeMarginAccounts()`
- **`ChromeBot.cs` $\rightarrow$ `DownloadTradingFileMS()`** $\Rightarrow$ `rpa-downloader.service.ts` $\rightarrow$ `loginMSystem()`, `downloadTTM()`, `downloadDSGD()`
- **`ExcelDataService.cs` $\rightarrow$ Macro Lot/Value** $\Rightarrow$ `bot-job-queue.service.ts` $\rightarrow$ `handleRunLotMacroJob()`, `handleRunValueMacroJob()`

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 09:00:00] - Khắc phục Lỗi Không Chạy Lại Job Khi Chuyển Về "Chưa thực hiện" (`AUTO_CHECK_SOD`, `EMAIL_STATUS_CHECK`)

### 1. Mục tiêu Thay đổi
- Khắc phục triệt để lỗi khi người dùng bấm reset tác vụ về trạng thái "Chưa thực hiện" (`WAITING`/`PENDING`), Bot không đẩy Job mới vào hàng đợi mà vẫn giữ nguyên lỗi cũ (`FAILED`) từ trước.

### 2. Danh sách File Chỉnh sửa
- [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`bot-engine.service.ts`**:
  - Áp dụng `shouldEnqueueNewJob = !existingJob || (existingJob.status === 'FAILED' && (task.status === 'WAITING' || task.status === 'PENDING'))` cho các loại check `AUTO_CHECK_SOD`, `EMAIL_STATUS_CHECK`.
  - Cho phép hệ thống đẩy lượt Job mới vào hàng đợi và chạy lại từ đầu mỗi khi tác vụ được reset về trạng thái "Chưa thực hiện".

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)
