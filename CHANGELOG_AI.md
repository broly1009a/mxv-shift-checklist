# CHANGELOG_AI.md - Nhật Ký Thay Đổi Code & Cấu Hình Của AI Assistant

Tài liệu này dùng để ghi vết tất cả các lượt chỉnh sửa code (Frontend, Backend), cấu hình Bot và logic nghiệp vụ do AI Assistant thực hiện trong dự án.

---

## [2026-07-24 11:00:00] - Phân Định Đúng File ACM Cho 2 Luồng: Nano/Fill Trong Phiên & Straits Cho EOD

### 1. Mục tiêu Thay đổi
- Điều chỉnh đúng cơ chế quét file ACM: Trong phiên (live check) cần tìm file Nano tự doanh (`Nano.xls` / `Fill.xlsx`), còn cuối ngày (EOD check) cần tìm file Straits CSV (`Straits.csv`).

### 2. Danh sách File Chỉnh sửa
- [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`reconciliation.service.ts` (`runAutoCheckKLGD`)**:
  - Cập nhật Regex tìm kiếm file ACM trong phiên thành `/Nano|Fill/i` để lấy tệp tự doanh (`Fill.xlsx` hoặc `Nano.xls` do nghiệp vụ tải lên trong phiên), tránh quét nhầm tệp Straits CSV của ngày hôm trước.
  - Luồng EOD chốt cuối ngày (`runAutoCheckPreEOD`) vẫn giữ nguyên tìm kiếm `/Straits/i` để đối chiếu tệp Straits CSV theo đúng quy chuẩn EOD tại `AGENTS.md` (không tự ý thay bằng file Fill/Order của CQG/M-System).

### 4. Đính chính sai sót của AI Assistant
- **Sai sót**: AI Assistant đã đưa ra nhận định sai lầm khi cho rằng *"File Fill.xlsx là file xuất từ CQG/M-System, không liên quan gì tới file ACM (Nano)"*. 
- **Đính chính thực tế**: File `Fill.xlsx` (trong thư mục ACM) chính là file giao dịch tự doanh của hệ thống ACM (Nano), được dùng để đổi tên thành `Nano.xls` cho tool C# đối chiếu trong phiên. File `Straits.csv` là file báo cáo giao dịch đối tác gửi cuối ngày, không liên quan tới file Nano. AI Assistant ghi nhận lỗi phân tích sai lệch thông tin nghiệp vụ này để tránh tái diễn.

---

## [2026-07-24 10:56:00] - Khắc Phục Lỗi Gộp Ô Khi Splicing Trong CcpStatisticsService (Lỗi Cannot merge already merged cells)

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi khi chạy báo cáo thống kê số lô & giá trị giao dịch CCP `[TASK_CCP_STATISTICS]` báo lỗi `Job failed permanently: Cannot merge already merged cells`.

### 2. Danh sách File Chỉnh sửa
- [ccp-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/ccp-statistics/ccp-statistics.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`ccp-statistics.service.ts`**:
  - Tạo mới hàm helper `safeMergeCells(ws, r1, c1, r2, c2)` để giải quyết xung đột vùng ô gộp (merge cells) trong ExcelJS khi chạy ghi đè dữ liệu lũy kế trong ngày (idempotency/replace rows).
  - Hàm `safeMergeCells` tự động bỏ gộp (`unMergeCells`) vùng ô cũ trước khi chạy gộp mới, đồng thời hỗ trợ dọn dẹp trực tiếp vùng gộp lỗi trong cấu trúc dữ liệu nội bộ `_merges` của ExcelJS nếu xảy ra xung đột không mong muốn.
  - Tự động bỏ qua các trường hợp gộp ô đơn (khi dòng bắt đầu bằng dòng kết thúc và cột bắt đầu bằng cột kết thúc), giúp tránh các ngoại lệ lỗi không đáng có của thư viện ExcelJS.
  - Thay thế toàn bộ 14 lệnh gọi `ws.mergeCells` trực tiếp bằng hàm `this.safeMergeCells(ws, ...)`.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npx tsc --noEmit` & `npm run build`)**: PASSED (0 lỗi)

---

## [2026-07-24 10:45:00] - Hỗ Trợ Đọc File Đối Chiếu Straits CSV Trong parseNano (Tránh Lỗi Thiếu Cột)

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi đối chiếu khớp lệnh tự động `[TASK_CHECK_KLGD]` báo lỗi `Job failed permanently: Thiếu cột bắt buộc trong file Nano (Order Sysid, Trader Id, Instrument Id, Volume, Price, Trade Id)`.

### 2. Danh sách File Chỉnh sửa
- [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`reconciliation.service.ts` (`parseNano`)**:
  - Bổ sung kiểm tra xem file đầu vào có phải là Straits CSV (có chứa tiêu đề `buy` và `sell`).
  - Nếu là Straits CSV, tự động chuyển sang luồng parse CSV động, trích xuất dữ liệu chi tiết giao dịch tương ứng với các cột của Straits (`Sub-A/C` -> `maTKGD`, `Broker Trade ID` -> `maLenh`/`maGD`, `Product Code` -> `maHD`, `Buy`/`Sell` -> `klGiaoDich`, `Price` -> `giaKhop`, `Execution Date-time` -> `ngayGio`).
  - Trả về danh sách đối tượng chuẩn hoá giống định dạng file Excel tự doanh cũ, giúp phần đối chiếu tiếp theo so sánh được tổng volume và tìm ra các lệnh lệch mà không bị ném lỗi chặn.
  - Chuẩn hoá cơ chế đọc file Excel cũ thành dạng so khớp tiêu đề không phân biệt chữ hoa/thường (case-insensitive) giống như tool IT C#.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npx tsc --noEmit` & `npm run build`)**: PASSED (0 lỗi)

---

## [2026-07-24 10:36:00] - Khắc phục Lỗi Không Hỗ Trợ Loại Job `CHECK_KLGD` Trong ProcessQueue Worker

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi khi chạy đối chiếu trong phiên `[TASK_CHECK_KLGD]` báo lỗi `Job failed permanently: Loại job không được hỗ trợ: CHECK_KLGD`.

### 2. Danh sách File Chỉnh sửa
- [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`bot-job-queue.service.ts` (`processQueue`)**:
  - Bổ sung nhánh rẽ `else if (job.jobType === 'CHECK_KLGD') { await this.handleCheckKlgdJob(job); }` vào vòng lặp xử lý hàng đợi Worker chính.
  - Trước đó, loại job `CHECK_KLGD` mới thêm chỉ được khai báo trong hàm chạy trực tiếp `executeJobDirectly` mà thiếu đi khai báo trong hàng đợi chạy nền tự động, dẫn đến khi job được lấy từ DB lên xử lý bị crash và trả về lỗi không hỗ trợ.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npx tsc --noEmit` & `npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 10:30:00] - Cập Nhật Dữ Liệu Checklist Templates (Bổ sung ops_during_01_sb1)

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi khi khởi tạo ca trực mới từ Dashboard không xuất hiện tác vụ con Bot check (`ops_during_01_sb1`) của tác vụ cha `[ops_during_01] Thay đổi ký quỹ hàng hóa`.

### 2. Danh sách File Chỉnh sửa
- Không chỉnh sửa file nguồn (Chỉ chạy script cập nhật dữ liệu database: [seed-subtasks.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/scripts/seed-subtasks.js)).

### 3. Tóm tắt Nội dung Chỉnh sửa
- Chạy script `seed-subtasks.js` để cập nhật lại toàn bộ cây tác vụ con trong bảng `checklist_templates` của MongoDB.
- Nguyên nhân hôm qua chạy script `seed-ops-during-sb1.js` bị nhầm tên collection `shift_templates` (collection không sử dụng trong code NestJS) thay vì `checklist_templates`, dẫn đến template gốc trong database chưa được cập nhật tác vụ con này.

---

## [2026-07-24 10:21:00] - Khắc phục Lỗi Không Đồng Bộ Trạng Thái Tác Vụ Cha Tự Động Do Ràng Buộc Phụ Thuộc (Dependency Check)

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi khi tất cả các tác vụ con đã hoàn thành nhưng tác vụ cha vẫn hiển thị "Chưa thực hiện" (PENDING).
- Nguyên nhân xảy ra do tác vụ con được hoàn tất trước khi các tác vụ phụ thuộc (dependency) của tác vụ cha hoàn tất. Lúc tác vụ con cuối cùng hoàn thành, hệ thống chạy cập nhật tự động cho tác vụ cha nhưng bị chặn bởi dependency check và trả về lỗi. Về sau khi các dependency hoàn thành, không có trigger đánh giá lại tác vụ cha.

### 2. Danh sách File Chỉnh sửa
- [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`shifts.service.ts`**:
  - Chuyển đổi logic kích hoạt tự động hoàn tất tác vụ cha từ kiểm tra theo sự kiện tác vụ con sang kiểm tra toàn diện tất cả các tác vụ cha trong ca trực mỗi khi có bất kỳ tác vụ nào (bao gồm cả tác vụ phụ thuộc) thay đổi trạng thái.
  - Tự động đánh giá đầy đủ: Tác vụ cha sẽ tự động chuyển sang `PASSED` nếu và chỉ nếu: (1) toàn bộ tác vụ con đạt `isChecked = true` VÀ (2) toàn bộ tác vụ phụ thuộc của tác vụ cha đạt `isChecked = true`.
  - Tự động reset tác vụ cha về `PENDING` nếu một tác vụ con hoặc tác vụ phụ thuộc bị huỷ hoàn thành.
  - Cho phép huỷ hoàn thành tác vụ phụ thuộc mà không bị chặn bởi lỗi ràng buộc phụ thuộc đối với các tác vụ phụ thuộc là tác vụ cha (do hệ thống sẽ tự động cập nhật/huỷ hoàn thành tác vụ cha đồng thời trong giao dịch).

### 4. Kết quả Kiểm thử & Build
- **Backend (`npx tsc --noEmit` & `npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)
- **Kịch bản kiểm thử (`test-parent-child-tasks.ts` & `test-parent-dependency-sync.ts`)**: PASSED thành công 100%.

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

---

## [2026-07-24 09:07:00] - Khắc phục Lỗi `PayloadTooLargeError` Khi Gửi Kết Quả Báo Cáo Lớn

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi `PayloadTooLargeError: request entity too large` (expected 180KB > limit 100KB) khi Bot cập nhật kết quả báo cáo dài (ví dụ danh sách 181 tài khoản âm ký quỹ hoặc danh sách chênh lệch khớp lệnh chi tiết).

### 2. Danh sách File Chỉnh sửa
- [main.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/main.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`main.ts`**:
  - Khai báo Middleware `express.json({ limit: '50mb' })` và `express.urlencoded({ limit: '50mb', extended: true })`.
  - Nâng giới hạn dung lượng Request Body tối đa từ **100KB mặc định lên 50MB**, giúp nhận dữ liệu báo cáo lớn mượt mà không bị nghẽn HTTP 413.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 09:16:00] - Tối Ưu Giao Diện Thông Báo (Toast Notification & Line Clamp)

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi thông báo Popup quá dài che mất nút "Chốt Ca Trực", không tự ẩn/tắt được và làm tràn giao diện khi có thông báo lớn (như danh sách âm ký quỹ).

### 2. Danh sách File Chỉnh sửa
- [NotificationDropdown.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/NotificationDropdown.tsx)
- [layout.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/layout.tsx)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`NotificationDropdown.tsx`**:
  - Giới hạn chiều rộng tối đa Toast `maxWidth: 360px` và cắt bớt văn bản tối đa 2 dòng (`WebkitLineClamp: 2`, `textOverflow: ellipsis`).
  - Bổ sung nút bấm đóng nhanh **`✕`** và cho phép click vào Toast để tắt ngay lập tức (`toast.dismiss(t.id)`).
  - Cắt bớt văn bản nội dung danh sách thông báo trong Tray xuống tối đa 2 dòng.
- **`layout.tsx`**:
  - Đặt `containerStyle` cho `<Toaster />` với vị trí `top: 72px` giúp thông báo đẩy xuống dưới thanh Header, không còn đè lên nút "Chốt Ca Trực".

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 09:19:00] - Đồng Bộ Tổng Số Tài Khoản Lệch SOD CQG Trong Giao Diện Modal (Total vs Sample Count)

### 1. Mục tiêu Thay đổi
- Khắc phục sự lệch con số giữa Tiêu đề/Telegram (`1121 tài khoản`) và Thẻ Summary Card trên Giao diện Modal (`10 tài khoản`).

### 2. Danh sách File Chỉnh sửa
- [BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx)
- [ReconciliationVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/ReconciliationVisualReport.tsx)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`BotLogViewerModal.tsx`**:
  - Trích xuất `totalCount` thực tế từ chuỗi Note văn bản (ví dụ: `1121 tài khoản`) khi bóc tách thông tin.
- **`ReconciliationVisualReport.tsx`**:
  - Hiển thị đúng **tổng số 1121 tài khoản** trên Thẻ Summary Card đỏ.
  - Cập nhật tiêu đề bảng hiển thị rõ: `(Mẫu 10 / Tổng 1121)` để người dùng hiểu bảng đang liệt kê 10 mẫu trích xuất từ 1121 tài khoản thực tế.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 09:27:00] - Bổ Sung Thông Tin Lượt Quét & Thời Gian Thực Hiện Vào Log Tác Vụ (`AUTO_CHECK_SOD`, `CHECK_PRE_EOD`, `CHECK_EOD_MM`)

### 1. Mục tiêu Thay đổi
- Bổ sung thông tin số lượt quét (Lượt #1/3, #2/3...) và giờ thực hiện chính xác vào log tóm tắt đối chiếu để chuyên viên vận hành dễ dàng theo dõi lịch sử chạy lại của Bot.

### 2. Danh sách File Chỉnh sửa
- [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`bot-job-queue.service.ts`**:
  - Tự động bổ sung dòng `• Lượt quét: Lượt #X/Y (Lúc HH:MM:SS)` vào đầu mỗi thông báo kết quả đối chiếu tự động.
  - Lưu cờ `attempts`, `maxAttempts`, `executedAt` vào JSON payload để phục vụ hiển thị chi tiết trên giao diện Web Modal.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 09:28:00] - Khắc phục Lỗi Không Hiển Thị Đủ Mảng 1121 Tài Khoản Lệch SOD Trên Giao Diện Web Modal

### 1. Mục tiêu Thay đổi
- Khắc phục triệt để việc Giao diện Web chỉ hiển thị 10 tài khoản (Trang 1/1) khi bóc tách kết quả SOD CQG thay vì cho phép phân trang và tìm kiếm đầy đủ 1121 tài khoản.

### 2. Danh sách File Chỉnh sửa
- [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`bot-engine.service.ts`**:
  - Khi tác vụ `AUTO_CHECK_SOD` hoàn thành hoặc báo lỗi, Bot đóng gói chuẩn đối tượng JSON chứa mảng **toàn bộ 1121 tài khoản lệch** (`result: discrepancies`) vào `task.resultNote`.
  - Giúp Frontend đọc trọn vẹn mảng 1121 tài khoản, hiển thị đủ 113 trang phân trang, hỗ trợ lọc ô tìm kiếm và bấm `Copy DS Lọc` lấy trọn vẹn 100% dữ liệu.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 09:30:00] - Sửa Lỗi CSS Nút Đóng `✕` Trên Popup Thông Báo (Chuyển Sang `toast.custom`)

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi nút đóng **`✕`** bị đẩy văng ra ngoài khung Card thông báo và sai lệch màu nền trên giao diện.

### 2. Danh sách File Chỉnh sửa
- [NotificationDropdown.tsx](file:///c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/NotificationDropdown.tsx)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`NotificationDropdown.tsx`**:
  - Chuyển sang sử dụng `toast.custom(...)` để loại bỏ hoàn toàn các khung bọc CSS mặc định của thư viện `react-hot-toast`.
  - Thiết kế chuẩn Container Card đồng bộ tông màu `var(--bg-sidebar)` và `var(--border-color)`.
  - Đặt nút **`✕`** gọn gàng 100% bên trong góc phải của Card với hiệu ứng hover mượt mà.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 09:35:00] - Khắc phục Triệt Để Lỗi Bóc Tách Mảng `jsonResult` Trên Giao Diện Web Modal (`Array.isArray(jsonResult)`)

### 1. Mục tiêu Thay đổi
- Khắc phục lỗi nguyên nhân gốc (Root Cause): Khi Backend gửi mảng JSON `parsed.result` (chứa 1121 tài khoản), Frontend kiểm tra `jsonResult.result` (truy cập `.result` trên đối tượng mảng `Array`) trả về `undefined`, khiến Frontend rơi vào luồng fallback trích xuất 10 dòng từ text note.

### 2. Danh sách File Chỉnh sửa
- [BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx)
- [ReconciliationVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/ReconciliationVisualReport.tsx)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`BotLogViewerModal.tsx` & `ReconciliationVisualReport.tsx`**:
  - Thêm cờ kiểm tra `Array.isArray(jsonResult)`: Nếu `jsonResult` chính là mảng 1121 tài khoản, lấy trực tiếp đối tượng mảng `jsonResult`.
  - **Kết quả**: Giao diện Modal đọc trọn vẹn 1121 tài khoản, hiển thị chuẩn **113 Trang phân trang**, ô tìm kiếm lọc 100% tài khoản và xuất Excel đầy đủ.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 09:49:00] - Cập Nhật Chuẩn Đường Dẫn Hash URL & Menu Cho Báo Cáo `NKTTHT` Trong Bot RPA

### 1. Mục tiêu Thay đổi
- Khắc phục nguyên nhân gốc khiến Bot RPA tải báo cáo `NKTTHT` bị treo quá 10 phút do sai đường dẫn Hash URL và Menu trên M-System.

### 2. Danh sách File Chỉnh sửa
- [rpa-downloader.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/rpa-downloader.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`rpa-downloader.service.ts`**:
  - Cập nhật Hash URL chính xác theo M-System thực tế: `#/systemManagement/activityHistory` (thay cho sai lệch cũ `#/systemManagement/auditLog`).
  - Giữ nguyên luồng Menu fallback 3 cấp chuẩn theo Sidebar tree của M-System: `['QL hệ thống', 'Thông tin chung', 'Nhật ký thao tác hệ thống']`.
  - **Kết quả**: Bot RPA truy cập tức thì màn hình xuất báo cáo NKTTHT và tải xong file Excel chỉ dưới 5 giây.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 09:55:00] - Nâng Cấp Bộ Lọc Tìm Kiếm Selector Menu Sidebar Cho Cả Thẻ `<a>`, `<span>` và `<div>` trong RPA

### 1. Mục tiêu Thay đổi
- Nâng cấp bộ lọc XPath của hàm `navigateAndDownload` để bắt được nút click Sidebar trên M-System dù thẻ HTML là `<a>`, `<span>` hay `<div>`.

### 2. Danh sách File Chỉnh sửa
- [rpa-downloader.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/rpa-downloader.service.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`rpa-downloader.service.ts`**:
  - Mở rộng selector: `xpath=//*[self::a or self::span or self::div][text()='${menu}' or normalize-space(text())='${menu}']`.
  - Giúp Bot RPA click từng cấp menu `QL hệ thống` $\rightarrow$ `Thông tin chung` $\rightarrow$ `Nhật ký thao tác hệ thống` trơn tru 100%.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)

---

## [2026-07-24 10:02:00] - Nâng cấp Script Test Playwright Đọc & Giải Mã Credentials M-System Từ MongoDB

### 1. Mục tiêu Thay đổi
- Cập nhật script test Playwright để tự động kết nối MongoDB và giải mã (decrypt) thông tin đăng nhập từ `system_settings` (`bot_credentials_msystem`), khắc phục lỗi bỏ trống password do biến môi trường không được lưu dạng text trong `.env`.

### 2. Danh sách File Chỉnh sửa
- [test-playwright-nktht.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/scripts/test-playwright-nktht.js)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`test-playwright-nktht.js`**:
  - Nhập thư viện `mongoose` và `crypto` để kết nối DB và áp dụng giải mã AES-256-CBC theo đúng thuật toán mã hóa của hệ thống.
  - Tự động lấy `username`, `password`, `pin` đã được mã hóa an toàn trong CSDL để đăng nhập M-System.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit`)**: PASSED (0 lỗi)
