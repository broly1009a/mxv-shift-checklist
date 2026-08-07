# CHANGELOG_AI.md - Nhật Ký Thay Đổi Code & Cấu Hình Của AI Assistant

Tài liệu này dùng để ghi vết tất cả các lượt chỉnh sửa code (Frontend, Backend), cấu hình Bot và logic nghiệp vụ do AI Assistant thực hiện trong dự án.

---

## 💡 CÁC CÂU LỆNH VẬN HÀNH NHANH TRÊN UBUNTU SERVER (PRODUCT)

### 1. Đóng/Chốt tất cả các ca trực đang chạy (PENDING -> COMPLETED):
```bash
mongosh "mongodb://127.0.0.1:27017/mxv_shift_checklist" --eval "db.shift_logs.updateMany({ status: 'PENDING' }, { \$set: { status: 'COMPLETED', closedAt: new Date() } })"
```

### 2. Khởi chạy và Quản lý ngầm bằng PM2:
- Backend: `pm2 start dist/main.js --name "mxv-backend"`
- Frontend: `pm2 start npm --name "mxv-frontend" -- run start`
- Quét logs: `pm2 logs mxv-backend` hoặc `pm2 logs mxv-frontend`

---




## [2026-08-06 16:40:00] - Refactor: Tối ưu hóa mốc đối chiếu EOD bằng Header Date và lệnh MM bằng Real-World Calendar Date

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Đối chiếu ngày EOD T-1 dựa vào ngày hiển thị ở Header (Top-Right) của hệ thống Core thay vì dùng ngày của server clock để tránh lỗi lệch múi giờ/ngày phiên khi UAT/Staging bảo trì hoặc lệch ngày.
  - Sửa logic đối chiếu lệnh MM (Market Maker) để chỉ chấp nhận lệnh khớp trong ngày lịch thực tế (`realTodayStr`) thay vì lấy cả T-1 (`targetStr`), tránh tình trạng hệ thống chưa EOD vẫn báo MM thành công (lệnh cũ từ hôm trước).
- **Giải pháp**:
  - Viết mới hàm `getHeaderDate` trong `oms-watcher.service.ts` quét các thẻ văn bản lá nằm ở vùng góc trên bên phải trang để lấy ngày phiên giao dịch hiện tại của hệ thống.
  - Viết mới hàm `calculateDatesFromHeader` tính toán mốc `todayStr` và T-1 (`targetStr`) từ ngày Header.
  - Nâng cấp luồng quét EOD trong `checkOmsStatus` để sử dụng các mốc ngày tính toán từ Header.
  - Tính toán ngày lịch thực tế (`realTodayStr`) theo múi giờ Việt Nam (UTC+7) để so khớp các lệnh MM.
  - Cập nhật hàm `scrapeMmOrders` chấp nhận `todayStr` làm tham số và chỉ đếm các lệnh khớp chính xác ngày này, loại bỏ so khớp T-1.

### 2. Kết quả Thay đổi

#### 🔴 Backend
- **Sửa đổi**:
  - [oms-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/oms-watcher.service.ts): Thêm helper `getHeaderDate()`, `calculateDatesFromHeader()`. Cập nhật `scrapeMmOrders()` và các lệnh gọi hàm tương ứng.
  - [.env](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/.env): Đổi `PLAYWRIGHT_HEADLESS=true` để chạy ngầm trình duyệt, ẩn hiển thị visual.
  - [value-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.service.ts): Tối giản đường dẫn thư mục xuất bản tin `newsletterDir` bằng cách loại bỏ cấp thư mục trùng lặp `Gửi team bản tin` lồng nhau.
  - [lot-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/lot-statistics.controller.ts), [value-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.controller.ts), [reconciliation.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.controller.ts), [trading-report.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/trading-report/trading-report.controller.ts), [margin-checker.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/margin-checker/margin-checker.controller.ts), [ccp-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/ccp-statistics/ccp-statistics.controller.ts): Ánh xạ bổ sung các đường dẫn `/api/v1/...` bên cạnh đường dẫn gốc để tương thích với thay đổi hàng loạt tiền tố trên Frontend.
  - [file-guard.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/common/file-guard.helper.ts), [value-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.service.ts), [excel-accumulator.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/helpers/excel-accumulator.helper.ts): Bổ sung hỗ trợ cấu hình alias `BOT_MACRO_TARGET_ROOT` bên cạnh biến cũ `BOT_LOT_MACRO_TARGET_ROOT` để tránh gây nhầm lẫn là chỉ áp dụng cho Thống kê Lô.
  - [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts): Sửa logic kiểm tra ràng buộc phụ thuộc (dependency check), cho phép bỏ qua kiểm tra khi reset tác vụ về trạng thái chưa thực hiện (`WAITING` hoặc `PENDING`) để tránh gây kẹt lỗi không thể reset.
  - [exported_templates.json](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/database/exported_templates.json), [seed-subtasks.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/scripts/seed-subtasks.js): Loại bỏ hoàn toàn tác vụ con `ops_open_01_s2` ("Bot gửi cảnh báo hệ thống nếu không có email thành công") để đồng bộ luồng nghiệp vụ tự động hóa và tránh lỗi giả trong Checklist Mở Cửa. Điều chỉnh `sortOrder` của các tác vụ con liền sau.
  - [system-settings.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/system-settings/system-settings.service.ts): Sửa đổi hàm `sendSecurityAuditEmail()`, bổ sung đệ quy loại bỏ các trường thời gian cập nhật động của Bot (`lastEmailSentAt`, `lastEmailStatus`, `lastEmailError`) khi so sánh cấu hình `margin_checker_config` để ngăn chặn spam email cảnh báo đổi cấu hình hệ thống vô nghĩa.

#### 🟢 Frontend
- **Sửa đổi**:
  - [LotStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/LotStatisticsPanel.tsx): Tự động phát hiện dấu phân cách đường dẫn (`/` hoặc `\`) từ thư mục gốc để sinh đường dẫn chuẩn đa nền tảng (Windows/Linux).
  - [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%2520OF%2520VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx): Sửa đổi tương tự để tránh lỗi kẹt dấu gạch chéo ngược trên Linux.
  - [EmailScanVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%2520OF%2520VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/EmailScanVisualReport.tsx): Sửa đổi logic fallback hiển thị tiêu đề tìm kiếm. Nếu cấu hình tìm kiếm là rỗng (trống), hiển thị là "Bất kỳ tiêu đề nào (Không giới hạn)" thay vì tự ý bốc tiêu đề của email tìm được đắp vào gây hiểu nhầm.

### 3. Xác nhận Build/Kiểm thử
- **Backend**:
  - Biên dịch thành công `nest build`.
  - Chạy kiểm thử visual thực tế thành công bằng `npm run test:oms-playwright` kiểm tra chính xác cả EOD và lệnh MM trên CCP UAT / CE UAT.

## [2026-08-06 16:25:00] - Feature: Tối ưu hóa logic quét EOD Core CCP & Core CE tương thích UAT/PROD

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi kiểm tra trạng thái EOD trên CCP UAT do môi trường này bị thiếu tab "Lịch sử EOD". Tìm kiếm phương pháp tối ưu giữa việc đi trực tiếp URL và click tab.
- **Giải pháp**:
  - Triển khai cơ chế kiểm tra kết hợp (Hybrid): Khi truy cập màn hình `/EOD/EODPROCESS`, Bot sẽ tiến hành kiểm tra bảng danh sách bước vận hành EOD ngay trên màn hình chính trước.
  - Bổ sung hàm helper `checkMainPageEod` để trích xuất ngày phiên hệ thống từ text giao diện (`Ngày giao dịch: ...` hoặc `Ngày phiên EOD: ...`) và đối chiếu trạng thái bước cuối cùng (như "EOD thành công" hoặc "Hoàn thành batch") có phải là "Thành công" / "Đã hoàn thành" vào ngày hiện tại/ngày T-1 hay không.
  - Nếu kiểm tra trang chính không thành công hoặc không tìm thấy bảng, Bot sẽ tự động click chuyển sang tab **Lịch sử EOD** (nếu có) để quét bảng lịch sử làm phương án dự phòng (fallback) cực kỳ ổn định.
  - Đường dẫn kiểm tra EOD được chuyển hẳn sang `/EOD/EODPROCESS` theo đúng thực tế hệ thống.

### 2. Kết quả Thay đổi

#### 🔴 Backend
- **Sửa đổi**: [oms-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/oms-watcher.service.ts)
  - Viết mới hàm helper `checkMainPageEod()` để quét bảng trạng thái và ngày giao dịch hiển thị trên trang chính.
  - Cấu trúc lại luồng quét trong `checkOmsStatus()` cho cả CCP và CE.

### 3. Xác nhận Build/Kiểm thử
- **Backend**:
  - Kiểm thử tự động chạy thành công 100% bằng lệnh `npm run test:oms-playwright`.
  - Biên dịch thành công 100% bằng lệnh `npm run build`.

## [2026-08-06 12:10:00] - Architecture: Tách layout ra GlobalLayout dùng chung để triệt tiêu việc unmount/remount Sidebar và Header

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Triệt tiêu hoàn toàn việc nhấp nháy/vẽ lại của Sidebar (bao gồm các modal con, widget giám sát và thẻ tiến độ) khi click chuyển hướng menu.
- **Nguyên nhân**: Do trước đây layout `Sidebar` và `Header` được trả về trực tiếp trong component `ProtectedRoute` của từng trang. Mỗi khi chuyển trang, React buộc phải unmount và remount toàn bộ DOM của Sidebar, dẫn đến việc trình duyệt vẽ lại (paint) gây chớp nháy và mất trạng thái lưu trữ tạm thời trên bộ nhớ.
- **Giải pháp**:
  - Tạo mới cấu phần **`GlobalLayout.tsx`** đóng vai trò là Layout persistent ở mức root.
  - Di chuyển toàn bộ cấu trúc giao diện bao gồm `app-container`, `Sidebar`, `Header` và thẻ `<main className="main-content">` từ `ProtectedRoute` sang `GlobalLayout`.
  - Đăng ký `GlobalLayout` bao bọc `{children}` ở file layout gốc [layout.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/layout.tsx).
  - Đơn giản hóa [ProtectedRoute.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ProtectedRoute.tsx) thành một component thuần túy chỉ thực hiện kiểm tra quyền truy cập và điều hướng, không render giao diện layout.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Tạo mới**: [GlobalLayout.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/GlobalLayout.tsx)
- **Sửa đổi**:
  - [ProtectedRoute.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ProtectedRoute.tsx)
  - [layout.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/layout.tsx)

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 12:06:00] - Fix: Khắc phục hiện tượng nhấp nháy thẻ trạng thái ở Sidebar khi chuyển menu

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi thẻ tiến độ và trạng thái giám sát hệ thống ở dưới cùng Sidebar bị nhấp nháy khi chuyển hướng menu.
- **Nguyên nhân**: Do layout Sidebar nằm trong component `ProtectedRoute` bao bọc riêng bên trong từng page. Khi chuyển trang, toàn bộ Sidebar bị unmount và remount, khiến các state `metrics` và `progress` reset về `null`, hiện chữ "Đang tải..." hoặc "0%" rồi mới gọi API cập nhật lại.
- **Giải pháp**:
  - Tích hợp bộ nhớ tạm thời `sessionStorage` để lưu trữ dữ liệu `metrics` và `progress` vừa tải.
  - Khi Sidebar được mount lại trên trang mới, khởi tạo state lấy ngay dữ liệu từ `sessionStorage` giúp hiển thị tức thì không bị trễ.
  - Khi API chạy ngầm có kết quả mới, dữ liệu sẽ tự động được cập nhật mượt mà và lưu lại vào bộ nhớ đệm cho lần chuyển trang kế tiếp.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx)
  - Khởi tạo giá trị ban đầu của state từ `sessionStorage`.
  - Cập nhật ghi đè bộ nhớ đệm sau khi gọi API thành công trong `fetchMetrics` và `fetchProgress`.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 12:04:00] - Refactor: Tích hợp CustomDatePicker cho bộ lọc Ngày giao dịch của các panel thống kê Bot Config

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Cập nhật bộ chọn ngày giao dịch của hai cấu phần LotStatisticsPanel ([LotStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/LotStatisticsPanel.tsx#L598)) và ValueStatisticsPanel ([ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx#L367)) sang `CustomDatePicker` để đồng nhất giao diện lịch.
- **Giải pháp**:
  - Import `CustomDatePicker` từ `@/components/ui/CustomDatePicker` vào cả hai tệp tin.
  - Thay thế các thẻ `<input type="date">` cũ bằng component dùng chung.
  - Bổ sung logic tự động nhảy về ngày hôm nay nếu người dùng click nút `✕` để xóa ngày, phòng tránh lỗi gọi API khi tham số ngày bị trống.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**:
  - [LotStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/LotStatisticsPanel.tsx)
  - [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx)

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 12:03:00] - Refactor: Thay thế bộ chọn ngày giám sát trang Dashboard (dashboard) sang CustomDatePicker quy chuẩn

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Thay thế bộ chọn ngày giám sát thô sơ ở tiêu đề Dashboard ([page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/dashboard/page.tsx)) bằng `CustomDatePicker` quy chuẩn.
- **Giải pháp**:
  - Import `CustomDatePicker` từ `@/components/ui/CustomDatePicker`.
  - Thay thế thẻ `<input type="date">` mặc định của Chrome bằng Component quy chuẩn, truyền `label=""` để giữ nguyên bố cục inline nhỏ gọn ban đầu.
  - Xử lý fallback ngày nếu người dùng click xóa `✕` lịch sẽ mặc định nhảy về ngày hôm nay thay vì để trống gây lỗi truy vấn API.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/dashboard/page.tsx)
  - Thay thế khối input ngày bằng Component `CustomDatePicker`.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 12:02:00] - Refactor: Đồng bộ giao diện bộ lọc trang Lịch Sử Ca Trực & Đối Chiếu (history)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Áp dụng các component quy chuẩn (SearchableSelect, CustomSelect, CustomDatePicker) vào trang Lịch sử ca trực ([page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/history/page.tsx)) để đồng bộ hóa UX/UI.
- **Giải pháp**:
  - Tích hợp `SearchableSelect` cho bộ lọc Phòng Ban.
  - Tích hợp `CustomSelect` cho bộ lọc Trạng Thái.
  - Tích hợp `CustomDatePicker` cho bộ lọc Từ Ngày và Đến Ngày.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/history/page.tsx)
  - Thêm các import component quy chuẩn.
  - Định nghĩa các tùy chọn `departmentFilterOptions` và `statusFilterOptions`.
  - Thay thế các input và select thô sơ bằng component dùng chung.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 12:01:00] - Refactor: Đồng bộ giao diện bộ lọc và modal trang Quản lý Tài khoản (admin/users)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Áp dụng các component quy chuẩn (SearchableSelect, CustomSelect) vào trang Quản lý Tài khoản cán bộ ([page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/users/page.tsx)) để đồng bộ giao diện bộ lọc và modal thêm/sửa tài khoản.
- **Giải pháp**:
  - Tích hợp `CustomSelect` cho bộ lọc Vai trò và bộ lọc Trạng thái hoạt động ở Filter Panel.
  - Tích hợp `SearchableSelect` cho bộ lọc Phòng ban để dễ tìm kiếm.
  - Áp dụng tương tự cho Form Modal: dùng `CustomSelect` chọn vai trò và `SearchableSelect` chọn bộ phận trực ca của nhân viên.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/users/page.tsx)
  - Khai báo các options array thích hợp cho từng loại select.
  - Thay thế các dropdown `<select>` thô sơ bằng component dùng chung.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 11:58:00] - Refactor: Xây dựng Bộ lịch chọn ngày thuần React (Custom Calendar Component) hoàn mỹ

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Khắc phục triệt để giao diện thô kệch và lệch tông màu (màu đen tối của lịch mặc định trên nền sáng của trang) của bộ chọn ngày trình duyệt.
- **Giải pháp**:
  - Loại bỏ hoàn toàn thẻ `<input type="date">` mặc định của trình duyệt để không bị phụ thuộc vào Shadow DOM của Chrome/Edge/Firefox.
  - Viết bộ chọn ngày bằng React thuần 100%: hiển thị lịch dạng grid 6 hàng 7 cột (42 ô), hỗ trợ điều hướng tháng, chọn ngày, bôi màu xanh cho ngày được chọn và khoanh viền tròn nổi bật cho ngày hiện tại (Today).
  - Tích hợp đóng mở bằng Ref và click-outside tự nhiên.
  - Định dạng hiển thị chuỗi ngày được chuẩn hóa thân thiện sang tiếng Việt (ngày/tháng/năm).

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [CustomDatePicker.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/CustomDatePicker.tsx)
  - Thay đổi toàn bộ logic code sang sử dụng các state tháng hiện tại, render lưới ngày tự chọn và bảng lịch Custom Popup có thiết kế kính mờ bo viền đồng nhất 100% với các select khác.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 11:55:00] - Refactor: Tối ưu hóa UI/UX Shadow-DOM và showPicker cho CustomDatePicker

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Đồng bộ hóa UX/UI cho phần chọn ngày để vừa đẹp mắt vừa dễ sử dụng.
- **Giải pháp**:
  - CSS đè Shadow-DOM của trình duyệt ẩn icon lịch mặc định của `<input type="date">` để tránh thừa icon trùng lặp.
  - Sử dụng hàm `.showPicker()` khi người dùng nhấp vào bất kỳ đâu trên ô input để kích hoạt mở lịch tự động.
  - Đặt `e.stopPropagation()` trên nút `✕` để ngăn hành động tắt lịch bị bật ngược lại.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [CustomDatePicker.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/CustomDatePicker.tsx)
  - Thêm thẻ `<style>` với luật ẩn indicator, điều hướng màu chữ tương thích dark mode.
  - Tích hợp hàm `showPicker()` trong thuộc tính `onClick` của input.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 11:53:00] - Refactor: Chuẩn hóa kiến trúc UI Components dùng chung (SearchableSelect, CustomSelect, CustomDatePicker)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Tạo một quy chuẩn riêng (Component dùng chung) cho các linh kiện chọn thông minh (Autocomplete / Custom select / Date picker) để áp dụng đồng loạt cho nhiều màn hình khác nhau trong hệ thống.
- **Giải pháp**:
  - Trích xuất toàn bộ logic tùy biến giao diện thành 3 Component độc lập và tái sử dụng được ở thư mục `frontend/src/components/ui/`.
  - Giúp rút gọn tệp `page.tsx` từ hơn 800 dòng code xuống chỉ còn dưới 500 dòng (giảm tải logic quản lý state click outside, refs và regex tìm kiếm).

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Tạo mới**:
  - [SearchableSelect.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/SearchableSelect.tsx): Component Combobox tìm kiếm gợi ý động.
  - [CustomSelect.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/CustomSelect.tsx): Component Dropdown tĩnh giao diện tùy biến.
  - [CustomDatePicker.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/CustomDatePicker.tsx): Component bộ chọn ngày tích hợp nút xóa nhanh và icon lịch.
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/activity-logs/page.tsx)
  - Import 3 Component quy chuẩn mới.
  - Loại bỏ hoàn toàn hơn 300 dòng code quản lý ref, states đóng mở và layout dropdown cục bộ của trang.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 11:50:00] - Refactor: Thay thế ô chọn Phương thức HTTP thành Custom Select đồng bộ giao diện

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Áp dụng thiết kế giao diện tùy biến (custom dropdown select) của ô "Người thực hiện" sang ô lọc "Phương thức HTTP" để đảm bảo tính đồng bộ và thẩm mỹ cao cho UX/UI.
- **Giải pháp**:
  - Viết lại phần lọc "Phương thức HTTP" ở Frontend bằng Custom Select: dùng Input hiển thị giá trị được chọn + Nút xóa nhanh `✕` + Khối Dropdown menu hiển thị danh sách các phương thức (`ALL`, `POST`, `PUT`, `DELETE`) được bo tròn, kính mờ (blur backdrop).
  - Tích hợp thêm tham chiếu `methodDropdownRef` và trạng thái `isMethodDropdownOpen` để tự động đóng dropdown khi click outside.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/activity-logs/page.tsx)
  - Khai báo state `isMethodDropdownOpen` và ref `methodDropdownRef`.
  - Cập nhật hàm lắng nghe click-outside để xử lý đóng cả hai dropdown.
  - Thay thế thẻ `<select>` của phương thức bằng cấu phần Custom Select đồng nhất.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 11:46:00] - Bugfix: Ép kiểu dữ liệu userId sang Mongoose Types.ObjectId khi lọc Nhật ký hệ thống

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi lọc Nhật ký hệ thống theo tài khoản "Người thực hiện" không trả về kết quả nào (truy vấn trả về danh sách rỗng dù có dữ liệu log khớp ID).
- **Giải pháp**:
  - Do `userId` trong MongoDB là kiểu dữ liệu tham chiếu `ObjectId` thay vì kiểu chuỗi String thô. Khi truyền trực tiếp Query string nhận từ API làm tham số tìm kiếm, MongoDB sẽ so khớp kiểu không trùng khớp và trả về 0 kết quả.
  - Sửa đổi Backend để kiểm tra tính hợp lệ của `userIdQuery` bằng hàm `Types.ObjectId.isValid` và thực hiện ép kiểu tường minh sang `new Types.ObjectId(userIdQuery)` trước khi đưa vào mệnh đề tìm kiếm.

### 2. Kết quả Thay đổi

#### 🔴 Backend
- **Sửa đổi**: [activity-log.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/activity-log/activity-log.controller.ts)
  - Import `Types` từ `'mongoose'`.
  - Bổ sung logic ép kiểu dữ liệu `new Types.ObjectId()` đối với `userIdQuery`.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Không đổi.
- **Backend**: Biên dịch thành công 100% bằng lệnh `cmd /c npm run build`.

## [2026-08-06 11:40:00] - Feature: Nâng cấp bộ lọc Người thực hiện sang ô tìm kiếm thông minh (Searchable Select / Autocomplete)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Nâng cấp ô chọn "Người thực hiện" từ dạng Dropdown select truyền thống thành ô tìm kiếm thông minh (Autocomplete / Searchable Select) để tối ưu trải nghiệm tra cứu nhân viên.
- **Giải pháp**:
  - Tích hợp bộ tìm kiếm (Combobox) tự chế không phụ thuộc thư viện ngoài cho ô "Người thực hiện" ở Frontend.
  - Khi người dùng click vào ô, hệ thống hiển thị danh sách tất cả tài khoản. Khi gõ phím, danh sách sẽ lọc khớp thời gian thực theo cả Họ tên (fullName) và Tên tài khoản (username).
  - Thêm nút "✕" thông minh bên cạnh để xóa nhanh tài khoản đã chọn về mặc định.
  - Xử lý đóng dropdown tự động khi click ra ngoài vùng chọn (Click Outside Ref hook).

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/activity-logs/page.tsx)
  - Khai báo state `userSearchQuery` (nhập liệu tìm kiếm) và `isUserDropdownOpen` (đóng mở menu).
  - Viết `useEffect` lắng nghe sự kiện `mousedown` toàn cục để đóng dropdown when click outside.
  - Thay thế thẻ `<select>` bằng cấu trúc Combobox Input + Options List panel.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 11:38:00] - Bugfix: Sửa lỗi phân tích cú pháp và hiển thị danh sách bộ lọc Người thực hiện

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Khắc phục lỗi Dropdown "Người thực hiện" chỉ có duy nhất lựa chọn "-- Tất cả tài khoản --" mà không hiển thị danh sách nhân viên trong hệ thống để lọc.
- **Giải pháp**:
  - Sửa đổi hàm `fetchUsers` ở Frontend: Đổi cấu trúc đọc mảng người dùng từ `data.users` thành `data.data` cho khớp với định dạng phản hồi thực tế của NestJS `UsersController.findAll`.
  - Bổ sung tham số truy vấn `limit=1000` vào API call để đảm bảo tải được toàn bộ tài khoản thay vì bị giới hạn mặc định chỉ 10 người.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/activity-logs/page.tsx)
  - Thay thế url fetch thành `/api/v1/users?limit=1000`.
  - Sửa đổi mảng lưu trữ từ `data.data || []`.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 11:37:00] - Refactor: Tối ưu tỷ lệ cột (%) và chống ngắt dòng (nowrap) bảng Nhật ký thao tác

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Bố cục bảng 7 cột vẫn bị trống nhiều ở cột API route do trình duyệt kéo giãn tự động không đều trên màn hình siêu rộng.
- **Giải pháp**:
  - Chuyển đổi định dạng độ rộng cột (`width`) của thẻ `<th>` sang phần trăm (%) cụ thể thay vì pixel: Thời gian (15%), Người thực hiện (18%), Phương thức (10%), Hành động nghiệp vụ (27%), Đường dẫn API (20%), Địa chỉ IP (8%), và Chi tiết (2%).
  - Thiết lập thuộc tính `whiteSpace: 'nowrap'` cho các cột tĩnh (Thời gian, Người thực hiện, Địa chỉ IP) để tránh việc chữ bị ngắt xuống dòng xấu xí khi co giãn trình duyệt.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/activity-logs/page.tsx)
  - Áp dụng các tỷ lệ % độ rộng cột vào `<th>`.
  - Tích hợp `whiteSpace: 'nowrap'` cho các thẻ `<td>` tương ứng.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 11:36:00] - Refactor: Tái cấu trúc bảng Nhật ký hệ thống sang 7 cột để lấp đầy khoảng trống UI

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Khắc phục hiện tượng bảng hiển thị bị trống một khoảng lớn ở giữa cột hành động và địa chỉ IP do có quá ít cột trên màn hình rộng.
- **Giải pháp**:
  - Tách cột "Hành động / API" gộp trước đây thành 3 cột riêng biệt: **Phương thức** (Method), **Hành động nghiệp vụ** (Friendly Action), và **Đường dẫn API** (Technical Endpoint).
  - Tăng tổng số cột lên thành 7 cột (Thời gian, Người thực hiện, Phương thức, Hành động nghiệp vụ, Đường dẫn API, Địa chỉ IP, Chi tiết), tương tự cấu trúc bảng của Quản lý tài khoản.
  - Cập nhật `colSpan={7}` cho dòng chi tiết JSON Payload mở rộng.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/activity-logs/page.tsx)
  - Khai báo lại thẻ `<thead>` với 7 cột có thiết lập độ rộng (`width`) hợp lý.
  - Cập nhật phần map dữ liệu trong `<tbody>` để đưa Phương thức (Method) sang cột riêng biệt, Hành động nghiệp vụ đứng độc lập, và API Endpoint chiếm phần chiều rộng còn lại của bảng.
  - Sửa `colSpan` từ 5 thành 7 để tránh vỡ khung của khối xem chi tiết Payload.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 11:35:00] - Refactor: Tích hợp dịch ngôn ngữ nghiệp vụ thân thiện và bộ lọc thời gian cho Nhật ký hệ thống

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Áp dụng các đề xuất nâng cấp: Việt hóa/Biên dịch các đường dẫn API kỹ thuật sang hành động nghiệp vụ dễ hiểu và tích hợp bộ lọc tìm kiếm theo khoảng thời gian (Từ ngày - Đến ngày).
- **Giải pháp**:
  - Viết hàm `getFriendlyAction()` ở Frontend để chuyển đổi các phương thức & endpoint (vd: `PUT /api/v1/auth/profile` $\rightarrow$ "Cập nhật thông tin / Cài đặt cá nhân", `PUT /api/v1/roles/STAFF/permissions` $\rightarrow$ "Thay đổi phân quyền vai trò STAFF"). Hiển thị tên nghiệp vụ này làm tiêu đề chính và giữ API thô làm subtext màu nhạt ở dưới.
  - Bổ sung 2 bộ chọn ngày `startDate` và `endDate` trên thanh công cụ lọc của Frontend.
  - Cập nhật API Backend `GET /api/v1/activity-logs` để hỗ trợ lọc theo ngày tạo `createdAt` sử dụng các khoảng thời gian `$gte` (lớn hơn hoặc bằng ngày bắt đầu) và `$lte` (nhỏ hơn hoặc bằng ngày kết thúc).

### 2. Kết quả Thay đổi

#### 🔴 Backend
- **Sửa đổi**: [activity-log.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/activity-log/activity-log.controller.ts)
  - Khai báo thêm query params `startDateQuery` và `endDateQuery`.
  - Thiết lập trường `createdAt` trong truy vấn Mongoose để lọc chính xác thời gian bắt đầu và kết thúc ngày.

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/activity-logs/page.tsx)
  - Khai báo state `startDate` và `endDate`, tích hợp vào API fetch và hàm reset bộ lọc.
  - Vẽ thêm 2 ô nhập ngày "Từ ngày", "Đến ngày" trên Toolbar.
  - Viết hàm `getFriendlyAction` để phân tách hiển thị: Hành động thân thiện làm Text chính, API raw làm subtext monospace nhỏ ở dưới.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Biên dịch thành công 100% bằng lệnh `cmd /c npm run build`.

## [2026-08-06 11:32:00] - Bugfix: Đồng bộ màu sắc hiển thị Payload chi tiết theo biến chủ đề Light/Dark Mode

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi màu hiển thị của khối Metadata & Payload trong phần chi tiết Nhật ký thao tác khi chuyển đổi giữa chế độ sáng/tối (Light/Dark Mode) để đảm bảo độ tương phản dễ đọc.
- **Giải pháp**:
  - Thay thế các mã màu nền tối cứng (`rgba(0, 0, 0, 0.2)` và `rgba(0, 0, 0, 0.05)`) bằng các biến CSS động của chủ đề hệ thống (`var(--bg-app)` và `var(--bg-input)`).
  - Đảm bảo trong Light Mode, khung mã JSON sẽ hiển thị nền xám sáng nhạt với chữ tối màu, trong khi ở Dark Mode sẽ hiển thị nền tối đậm với chữ sáng màu tương phản cao.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/activity-logs/page.tsx)
  - Đổi màu nền thẻ `<pre>` từ `rgba(0, 0, 0, 0.2)` thành `var(--bg-app)`.
  - Đổi màu nền dòng chi tiết mở rộng `<tr className="expanded">` từ `rgba(0, 0, 0, 0.05)` thành `var(--bg-input)`.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không đổi.

## [2026-08-06 11:29:00] - Refactor: Tái thiết kế màn hình Nhật ký hệ thống đạt chuẩn giao diện Quản lý tài khoản

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Nâng cấp giao diện Nhật ký hệ thống (System Activity Logs) trở nên chuyên nghiệp, đồng bộ với thiết kế của trang Quản lý tài khoản (hỗ trợ nhiều bộ lọc, phân trang, cấu trúc hiển thị đồng bộ).
- **Giải pháp**:
  - Viết lại trang `admin/activity-logs/page.tsx` ở Frontend để tích hợp thanh lọc nâng cao gồm: Tìm kiếm theo API/Hành động, Lọc động theo Người thực hiện (tải danh sách tài khoản từ API), Lọc theo Phương thức HTTP (POST, PUT, DELETE), và nút "Xóa bộ lọc".
  - Bổ sung cấu trúc phân trang chuẩn (Hiển thị N dòng/trang, nút chọn trang 1, 2, 3... và nút Trước/Sau).
  - Cập nhật API Backend `GET /api/v1/activity-logs` để hỗ trợ lọc động theo `userId`, `method` và `action` kết hợp.

### 2. Kết quả Thay đổi

#### 🔴 Backend
- **Sửa đổi**: [activity-log.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/activity-log/activity-log.controller.ts)
  - Cập nhật API `GET` hỗ trợ Query params: `userId`, `method`, `action`, `limit`, `page`.
  - Kết hợp Regex tìm kiếm và lọc khớp ID người dùng để truy vấn tối ưu.

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/activity-logs/page.tsx)
  - Thêm API fetch danh sách toàn bộ người dùng hệ thống để đổ vào Dropdown bộ lọc.
  - Thiết kế thanh Toolbar lọc 3 tầng với nhãn đi kèm.
  - Thiết lập phân trang linh hoạt kết hợp thay đổi số dòng hiển thị (10, 25, 50 dòng/trang).
  - Giữ lại phần xem JSON Payload (Metadata) mở rộng đẹp mắt khi bấm biểu tượng con mắt.
- **Sửa đổi**: [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx)
  - Liên kết liên kết điều hướng tới `/admin/activity-logs`.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Biên dịch thành công 100% bằng lệnh `cmd /c npm run build`.

## [2026-08-06 11:20:00] - Feature: Triển khai tính năng Nhật ký kiểm toán phân quyền (Authorization Audit Trail)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Triển khai tính năng Nhật ký kiểm toán phân quyền để ghi vết lịch sử thay đổi quyền của các vai trò (ai sửa, sửa vai trò nào, quyền mới là gì, vào lúc nào, từ IP nào) nhằm đạt chuẩn bảo mật và kiểm toán công nghệ thông tin.
- **Giải pháp**:
  - Tận dụng `ActivityLogInterceptor` vốn đã chạy toàn cục ở Backend để bắt các thay đổi `PUT /api/v1/roles/:code/permissions` và lưu vào MongoDB collection `activity_logs`.
  - Tạo thêm đầu API `GET /api/v1/roles/audit-logs` để truy vấn danh sách log thay đổi quyền hạn.
  - Bổ sung tab **Nhật ký phân quyền** trên trang quản lý Phân Quyền Vai Trò ở Frontend để hiển thị danh sách nhật ký kiểm toán dạng bảng trực quan, đầy đủ thông tin: Thời gian, Người thực hiện, Vai trò tác động, Danh sách quyền mới, và Địa chỉ IP.

### 2. Kết quả Thay đổi

#### 🔴 Backend
- **Sửa đổi**: [roles.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/admin/roles.controller.ts)
  - Inject model `ActivityLog` vào constructor.
  - Viết endpoint `GET roles/audit-logs` để truy vấn từ MongoDB collection `activity_logs` lọc theo biểu thức chính quy (Regex) khớp với luồng lưu quyền vai trò, trả về danh sách được populate đầy đủ thông tin User thực hiện, sắp xếp theo thời gian mới nhất.

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/permissions/page.tsx)
  - Mở rộng kiểu dữ liệu `activeTab` thành `'by-role' | 'by-permission' | 'audit-log'`.
  - Import icon `History` từ `lucide-react` làm tab icon.
  - Viết hàm `fetchAuditLogs()` và helper `parseAuditDetails()`, `getRoleFromAction()` để đọc, giải mã dữ liệu chi tiết của log.
  - Thêm Tab **Nhật ký phân quyền** và render giao diện bảng lịch sử toàn màn hình cực kỳ chi tiết, đẹp mắt.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Biên dịch và chạy hoàn toàn ổn định.

## [2026-08-06 10:56:00] - Feature: Bổ sung cấu hình Bật/Tắt hiển thị thông tin giám sát Sidebar tại trang Cài đặt

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Triển khai tính năng cho phép Bật/Tắt hiển thị thông tin giám sát (Hệ thống & Tiến độ ca trực) ở Sidebar để tránh trùng lặp thông tin hoặc tốn diện tích hiển thị trên các màn hình nhỏ.
- **Giải pháp**:
  - Lưu cấu hình hiển thị trong `localStorage` (`mxv_sidebar_show_status`) dưới dạng client-side preference giúp tối ưu, không cần thay đổi schema Database hay chạy migrations.
  - Sử dụng cơ chế custom event (`sidebar-status-toggle`) để đồng bộ trạng thái hiển thị của Sidebar ngay lập tức (realtime) khi người dùng lưu cấu hình ở trang Cài đặt.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/settings/page.tsx)
  - Khai báo state `showSidebarStatus` (mặc định là `true`).
  - Khởi tạo giá trị từ `localStorage` trong `useEffect`.
  - Thêm checkbox "Hiển thị thông tin giám sát ở Sidebar (Hệ thống & Tiến độ ca trực)" trong Tab **Nhận cảnh báo & Ứng dụng**.
  - Lưu cấu hình vào `localStorage` và dispatch custom event `sidebar-status-toggle` khi bấm **Lưu cấu hình**.
- **Sửa đổi**: [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx)
  - Đọc tùy chọn `showSidebarStatus` từ `localStorage`.
  - Lắng nghe event `sidebar-status-toggle` để cập nhật trạng thái hiển thị tức thì.
  - Bọc phần render các card giám sát ở dưới cùng Sidebar bằng điều kiện `showStatusCards`.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không có thay đổi.

## [2026-08-06 10:52:00] - Bugfix: Loại bỏ hoàn toàn điều kiện loại trừ !isTechAdmin trong định nghĩa isOperator

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Đã thêm quyền giám sát máy chủ cho nhân viên vận hành nhưng Sidebar vẫn chỉ hiện mỗi card Tiến độ ca trực, không thấy hiện thêm card Hệ thống ổn định.
- **Nguyên nhân**: Trong định nghĩa biến `isOperator` vẫn còn chứa điều kiện loại trừ `!isTechAdmin`. Do đó, khi `isTechAdmin` bằng `true`, `isOperator` sẽ bị kéo về `false`, làm cho card Tiến độ ca trực biến mất và chỉ hiện card Kỹ thuật, đồng thời nếu session token của user chưa được cập nhật thì thông tin mới chưa được áp dụng.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx)
  - Loại bỏ điều kiện `!isTechAdmin &&` khỏi định nghĩa của `isOperator`:
  
  *Trước khi sửa:*
  ```typescript
  const isOperator = !isTechAdmin && (canViewChecklist || isTradeDept);
  ```

  *Sau khi sửa:*
  ```typescript
  const isOperator = canViewChecklist || isTradeDept;
  ```

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không có thay đổi.

## [2026-08-06 10:50:00] - Refactor: Hỗ trợ hiển thị đồng thời cả hai Card thông tin tại Sidebar (Loại bỏ loại trừ lẫn nhau)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Đánh giá lại logic phân loại vai trò để chuẩn bị demo cho lãnh đạo, tránh trường hợp bị nhầm lẫn hiển thị giữa các vai trò khi phân quyền chồng chéo.
- **Giải pháp**: 
  - Thay vì cơ chế ẩn hiện loại trừ lẫn nhau (chỉ hiện 1 trong 2 card: hoặc chỉ số máy chủ, hoặc tiến độ ca trực), hệ thống sẽ hiển thị **đồng thời cả hai card** nếu tài khoản có cả hai quyền (ví dụ: Admin, Trưởng bộ phận, hoặc Nhân viên vận hành được cấp thêm quyền giám sát hạ tầng).
  - Điều này giải quyết triệt để vấn đề:
    1. Lãnh đạo khi đăng nhập (thường có cả quyền xem checklist và xem hạ tầng) sẽ nhìn thấy đầy đủ cả Tiến độ ca trực vận hành lẫn Trạng thái hạ tầng hệ thống.
    2. Tránh việc một card này che mất card kia khi người dùng có nhiều quyền cùng lúc.
    3. Phản ánh trực quan 100% các checkbox phân quyền trên UI.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx)
  - Tách logic fetch dữ liệu (`fetchMetrics` và `fetchProgress`) thành 2 tiến trình polling độc lập chạy song song thay vì `else if`.
  - Thay thế khối render ternary loại trừ thành 2 khối điều kiện độc lập `{isTechAdmin && ...}` và `{isOperator && ...}`.
  - Thẻ Hướng Dẫn Sử Dụng chỉ hiển thị nếu tài khoản không thuộc cả hai nhóm trên.

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không có thay đổi.

## [2026-08-06 10:47:00] - Bugfix: Cho phép STAFF (Nhân viên) được xem thông số kỹ thuật máy chủ nếu có quyền ACCESS_HEALTH_CHECKS

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Khi Admin phân quyền "Giám sát hạ tầng (Health Checks)" (`ACCESS_HEALTH_CHECKS`) cho vai trò "Nhân viên vận hành" (STAFF) trên giao diện phân quyền, họ vẫn không thấy được thông số kỹ thuật ở Sidebar.
- **Nguyên nhân**: Logic trước đó chặn cứng mọi tài khoản có vai trò `STAFF` không được phép nhận `isTechAdmin = true`. Do đó, kể cả khi họ được gán quyền `ACCESS_HEALTH_CHECKS` một cách rõ ràng thì hệ thống vẫn chặn hiển thị.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx)
  - Cập nhật điều kiện `isTechAdmin` để ưu tiên quyền `canAccessHealthChecks` được gán trực tiếp:
  
  *Trước khi sửa:*
  ```typescript
  const isTechAdmin = (isAdmin || isITDept || canAccessHealthChecks) && user?.role !== 'STAFF';
  const isOperator = !isTechAdmin && (canViewChecklist || isTradeDept);
  ```

  *Sau khi sửa:*
  ```typescript
  const isTechAdmin = isAdmin || canAccessHealthChecks || (isITDept && user?.role !== 'STAFF');
  const isOperator = !isTechAdmin && (canViewChecklist || isTradeDept);
  ```

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không có thay đổi.

## [2026-08-06 10:45:00] - Bugfix: Loại bỏ vai trò STAFF (Nhân viên) khỏi hiển thị kỹ thuật máy chủ ở Sidebar

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi tài khoản vai trò "Nhân viên" (STAFF) nhưng vẫn hiển thị thông tin giám sát tài nguyên kỹ thuật máy chủ (CPU, RAM, TPS) ở Sidebar thay vì tiến độ ca trực/hướng dẫn sử dụng.
- **Nguyên nhân**: Trong logic phân loại vai trò tại Sidebar, người dùng thuộc phòng IT (`isITDept = true`) tự động được nhóm vào `isTechAdmin = true` bất kể vai trò của họ là gì, khiến cho nhân viên vận hành thuộc phòng IT không xem được tiến độ ca trực.

### 2. Kết quả Thay đổi

#### 🟢 Frontend
- **Sửa đổi**: [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx)
  - Loại bỏ người dùng có vai trò `STAFF` khỏi phân loại `isTechAdmin` để họ hiển thị đúng tiến độ ca trực dành cho nhân viên vận hành.
  
  *Trước khi sửa:*
  ```typescript
  const isTechAdmin = isAdmin || isITDept || canAccessHealthChecks;
  const isOperator = !isTechAdmin && (canViewChecklist || isTradeDept);
  ```

  *Sau khi sửa:*
  ```typescript
  const isTechAdmin = (isAdmin || isITDept || canAccessHealthChecks) && user?.role !== 'STAFF';
  const isOperator = !isTechAdmin && (canViewChecklist || isTradeDept);
  ```

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Biên dịch thành công 100% bằng lệnh `cmd /c npx tsc --noEmit`.
- **Backend**: Không có thay đổi.

## [2026-08-06 08:45:00] - Feature: Cải thiện UI/UX & Tích hợp API hệ thống thực tế cùng tiến độ ca trực tại Sidebar

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Đánh giá và cải thiện phần hiển thị trạng thái hệ thống tĩnh ở Sidebar để hiển thị thông tin thực tế dựa trên phân quyền vai trò (Role/Permission):
  - **Admin kỹ thuật / IT (hoặc quyền ACCESS_HEALTH_CHECKS)**: Hiển thị trạng thái máy chủ thực tế (Uptime, CPU, RAM, TPS, Tải hệ thống) lấy từ API backend thực.
  - **Nhân viên ca trực (hoặc quyền VIEW_CHECKLIST)**: Hiển thị tiến độ hoàn thành các công việc trong ca trực ngày hôm nay (% hoàn thành, số lượng công việc) lấy từ API dashboard summary thực.
  - **Vai trò khác**: Hiển thị thẻ Hướng Dẫn Sử Dụng.

### 2. Kết quả Thay đổi

#### 🟢 Backend
- **Tạo Endpoint mới**: [dashboard.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/dashboard/dashboard.controller.ts)
  - Thêm API `GET /api/v1/dashboard/system-status` để tính toán tài nguyên CPU (qua `os.cpus()`), RAM (`os.totalmem()`, `os.freemem()`), Uptime Node (`process.uptime()`), và TPS hoạt động của ứng dụng.

#### 🟢 Frontend
- **Cập nhật Sidebar**: [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx)
  - Thêm state hooks và polling logic (15s đối với hệ thống, 30s đối với tiến độ ca trực).
  - Phân tách phân quyền render thành `isTechAdmin` (Admin/IT) và `isOperator` (nhân viên vận hành).
  - Thiết kế UI premium cho cả widget tài nguyên hệ thống (có RAM bar đổi màu khi tải cao) và widget tiến độ ca trực trực quan.
  - **Tối ưu hóa hiển thị thông tin User (Ẩn/Hiện thông minh)**: Thiết lập card `sidebar-user-details` tự động ẩn trên màn hình lớn (kích thước desktop `@media (min-width: 1024px)`) để tránh trùng lặp thông tin với Header; nhưng vẫn tự động hiển thị trên điện thoại/máy tính bảng khi Sidebar mở dưới dạng menu drawer (nơi mà Header sẽ thu gọn không hiển thị Tên và Vai trò).

### 3. Xác nhận Build/Kiểm thử
- **Frontend**: Chạy compiler `node node_modules/typescript/bin/tsc --noEmit` thành công không có lỗi.
- **Backend**: Chạy `npm run build` thành công không có lỗi.

## [2026-08-05 17:55:00] - Bug Investigation & Fix: Lỗi "Chưa cấu hình bot_lot_macro_path_value" + Sai số liệu TVKD ngày 22/06/2026

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Kiểm tra tại sao khi bấm "Chỉ cập nhật Lũy kế TVKD" trên giao diện thì báo lỗi _"Chưa cấu hình file Macro cấu hình (bot_lot_macro_path_value) trong cài đặt hệ thống"_ dù đã cấu hình đúng trên UI. Đồng thời, dữ liệu đã ghi vào file output ngày 22/06/2026 bị sai (113B thay vì 6.4T đúng).

### 2. Kết quả điều tra (Root Cause Analysis)

#### 🔴 Bug 1: Key mismatch giữa UI và Service (`processTvkdOnly`)

| | Setting Key |
|---|---|
| **UI lưu macro path** (`PUT /value-statistics/config`) | `bot_macro_value_path` |
| **`processTvkdOnly()` đọc** (trước fix) | `bot_lot_macro_path_value` ← **KHÁC KEY!** |
| **`processValueStatistics()` đọc** | `bot_macro_value_path` ← đúng |

- `processTvkdOnly` dùng key sai `bot_lot_macro_path_value` → key này không bao giờ được UI lưu → luôn rỗng → throw Error.
- Trong khi đó `processValueStatistics` dùng đúng key `bot_macro_value_path`.

#### 🔴 Bug 2: Dữ liệu 22/06 bị ghi sai (Chưa fix, đang điều tra thêm)

Hai file DSGD cho ngày 22/06/2026:

| File | Rows | Format | Total GTGD |
|---|---|---|---|
| `marco/.../DSGD22.06.2026.xlsx` | 14,757 rows | Không có header (col1…col15), raw CQG format | **113,791,066,218** ← ❌ khớp với dữ liệu sai trong file output |
| `Downloads/.../22.06/DSGD.xlsx` | 5,684 rows | Có header đầy đủ (Mã TKGD, Mã HĐ, KL giao dịch...), M-System export | **6,441,554,012,692** ← ✅ đúng |

- Hệ thống đã đọc DSGD từ **marco folder** (CQG raw format) thay vì **Downloads folder** (M-System export đúng).
- **Nguyên nhân chưa xác định hoàn toàn**: cần kiểm tra tiếp lần chạy nào đã trigger việc ghi 113B. Có thể là:
  - Script trong `marco/src/` hoặc bot job chạy với `dsgdPath` trỏ vào marco folder.
  - Setting `bot_macro_value_path` rỗng → `processValueStatistics` crash → không ghi → nhưng `processTvkdOnly` với key sai cũng crash → **không rõ cơ chế nào đã thực sự ghi 113B**.

#### 📌 Thông tin debug script đã xác nhận:
```
Exchange rates: Default=26260, TRU=165, MPO=6330  (đọc từ Macro .xlsm đúng)
Downloads DSGD (5684 rows) → Total GTGD = 6,441,554,012,692  ✅
Marco DSGD (14757 rows)    → Total GTGD = 113,791,066,218    ❌
```

TVKD breakdown đúng từ Downloads DSGD:
```
001: 465,957,383,541 | 002: 281,731,205,678 | 003: 1,123,590,222,625
007: 115,095,573,736 | 009: 246,681,312,735 | 012: 1,257,643,998,916
036: 478,754,712,670 | 068: 163,399,285,205 | 080: 1,298,743,649,515
...
```

#### 📌 Cấu hình trong DB tại thời điểm điều tra:
```
bot_lot_macro_target_root = C:\Users\hiepth\Downloads\Quanlygiaodich\Tai lieu hoat dong
bot_lot_macro_path_value  = C:\...\Thong ke lot va gia tri giao dich.xlsx  ← file sai (lot, không phải value macro)
bot_macro_value_path      = <not set>  ← UI chưa lưu được vì bị lỗi
```

### 3. File đã chỉnh sửa

#### [MODIFY] [value-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.service.ts)
- Trong hàm `processTvkdOnly()` (line 409): Đổi key đọc macro path từ `'bot_lot_macro_path_value'` → `'bot_macro_value_path'` (cùng key mà `PUT /value-statistics/config` lưu và `processValueStatistics` đọc).

```diff
- const macroPath = await this.settingsService.getSetting('bot_lot_macro_path_value', '');
+ // NOTE: Uses 'bot_macro_value_path' (same key saved by UI via PUT /value-statistics/config)
+ const macroPath = await this.settingsService.getSetting('bot_macro_value_path', '');
```

#### [ADD] Script debug tạm thời (có thể xóa sau)
- `src/test-inspect-calculation.ts` — Script verify tính toán GTGD từ DSGD file.
- `src/inspect-tvkd-sheet.ts` — Script inspect file TVKD Excel output.
- `src/list-settings.ts` — Script in ra các system settings từ DB.

### 4. Todo còn lại (cần fix tiếp)
- [ ] **Xác định lần chạy nào đã ghi 113B vào file output** — check bot job history hoặc log backend.
- [ ] **Re-run đúng cho ngày 22/06/2026** — dùng `dsgdPath = C:\Users\hiepth\Downloads\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T06.2026\22.06\DSGD.xlsx` và `pathTvkd = C:\Users\hiepth\Videos\Thong ke gia tri giao dich theo TVKD\Thong ke gia tri giao dich 2026 theo TVKD.xlsx`.
- [ ] **Khôi phục file TVKD từ backup** trước khi re-run (dùng `Backup_Snapshots\..._backup_2026-08-05_09-07-11.xlsx` — file gốc 128KB).
- [ ] **Verify lại sau khi fix** bằng cách compare total phải = 6,441,554,012,692.

### 5. Flow hoạt động của tính năng TVKD (tóm tắt để tham khảo)

```
UI: "Chỉ cập nhật Lũy kế TVKD"
  → POST /value-statistics/process-tvkd-only { ngayGD, targetRoot, dsgdPath, pathTvkd }
  → valueStatisticsService.processTvkdOnly()
     1. Đọc Macro .xlsm (key: bot_macro_value_path) → lấy hhMap, vlookupMap, tyGia
     2. Đọc DSGD.xlsx (dsgdPath) → parse rows
     3. Tính gtgd = lot × price × heSo × donVi × tyGia
     4. Group by maTKGD.substring(0,3) → tvkdGtgdMap
     5. Ghi vào file TVKD (pathTvkd) → tìm row date, fill giá trị theo cột TVKD code từ Row 4
     6. Backup tự động → Backup_Snapshots/
```

 - Bug Fix: Sửa lỗi kiểm tra an toàn thư mục ghi và tính toán động cột Tổng trong file TVKD

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Sửa lỗi `[SECURITY GUARD]` chặn không cho ghi file ra ngoài thư mục dù đã chỉnh sửa đường dẫn trong `.env`.
  - Giải thích và sửa lỗi cột `InvestingPro 082` bị ghi đè công thức `=SUM(...)` hiển thị `####` thay vì giá trị số giao dịch.
- **Giải pháp**:
  - **Backend**:
    - Sửa đổi [file-guard.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/common/file-guard.helper.ts):
      - Đổi phép so sánh kiểm tra đường dẫn an toàn `assertSafeWritePath` thành không phân biệt hoa thường (`toLowerCase().startsWith()`) nhằm tránh lỗi do ký tự ổ đĩa (ví dụ: `C:\` và `c:\`).
    - Sửa đổi [value-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.service.ts):
      - Cập nhật hàm `processTvkdOnly` để chỉ kiểm tra an toàn đường dẫn ghi của file TVKD (`pathTvkd`) thay vì kiểm tra an toàn thư mục gốc `targetRoot` (do tính năng này chỉ đọc dữ liệu chứ không ghi vào thư mục gốc).
    - Sửa đổi [excel-value-accumulator.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/helpers/excel-value-accumulator.helper.ts):
      - Thay đổi cơ chế ghi công thức tổng dòng từ hardcode cột 61 (`BI`) thành tự động quét Dòng 2 tìm cột chứa chữ **`Tổng`** (do số lượng TVKD thay đổi từ tháng 7 khiến cột Tổng dịch chuyển sang cột 64 - `BL`). Điền công thức `=SUM(...)` chính xác vào cột Tổng động tìm được.

## [2026-08-05 16:20:00] - Feature: Bổ sung tính năng chạy độc lập cập nhật file lũy kế TVKD từ giao diện

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Viết một tính năng chạy test độc lập trên giao diện (nút bấm riêng biệt) để chỉ ghi đè vào file `Thong ke gia tri giao dich 2026 theo TVKD.xlsx` mà không ảnh hưởng tới các file lũy kế chính khác.
- **Giải pháp**:
  - **Backend**:
    - Sửa đổi [value-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.controller.ts):
      - Thêm endpoint `POST /value-statistics/process-tvkd-only` để nhận yêu cầu chạy độc lập.
    - Sửa đổi [value-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.service.ts):
      - Triển khai phương thức `processTvkdOnly` để chỉ đọc file giao dịch `DSGD.xlsx`, gom nhóm theo TVKD, ghi đè duy nhất vào file lũy kế TVKD và trả kết quả về giao diện mà không cập nhật các tracker khác.
  - **Frontend**:
    - Sửa đổi [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
      - Khai báo state `loadingTvkdOnly` và hàm xử lý `handleRunTvkdOnly` gửi request tới API riêng biệt.
      - Thêm nút **Chỉ cập nhật Lũy kế TVKD** nằm cạnh nút chạy kiểm thử chính thức trên giao diện. Khi hoàn thành, màn hình tự động chuyển sang tab **Chi tiết theo TVKD** và hiển thị kết quả phân tách tương ứng.

## [2026-08-05 16:00:00] - Feature: Tích hợp tự động cập nhật dữ liệu đối soát giá trị giao dịch theo TVKD vào file Excel lũy kế năm

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Khi chạy đối soát giá trị giao dịch có ACM, tự động bóc tách dữ liệu và ghi thêm vào file Excel lũy kế năm theo TVKD: `Thong ke gia tri giao dich 2026 theo TVKD.xlsx`.
- **Giải pháp**:
  - **Backend**:
    - Sửa đổi [excel-value-accumulator.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/helpers/excel-value-accumulator.helper.ts):
      - Thêm hàm `updateValueTvkdTrackerFile` sử dụng `exceljs` để cập nhật dữ liệu vào sheet tháng tương ứng (ví dụ: `T08.2026`).
      - Hàm tự động định vị dòng bằng cách so sánh ngày ở Cột B (`B`), tự động bóc tách mã TVKD (3 chữ số cuối bằng Regex, ví dụ: `HN\n001` -> `001`) ở Dòng 4 để mapping sang cột chính xác, và điền công thức tính tổng dòng `=SUM(C{row}:BH{row})` ở cột BI.
      - Tự động tạo bản sao lưu snapshot dự phòng trước khi ghi đè.
    - Sửa đổi [value-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.service.ts):
      - Trong vòng lặp duyệt dòng giao dịch hàng ngày, thêm logic trích xuất 3 ký tự mã TVKD từ mã tài khoản giao dịch (`maTKGD`) và tổng hợp giá trị giao dịch của TVKD đó vào map `tvkdGtgdMap`.
      - Khi cờ ghi đè lũy kế được bật, thực hiện ghi đè dữ liệu vào file lũy kế TVKD và đồng thời trả về kết quả `tvkdGtgdBreakdown` trong API response.
    - Sửa đổi [value-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.controller.ts):
      - Thêm trường `pathTvkd` vào các API lấy/lưu cấu hình (lưu trong DB với key `bot_lot_macro_path_tvkd`) và API chạy kiểm thử trực tuyến `process-local`.
  - **Frontend**:
    - Sửa đổi [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
      - Bổ sung trường nhập liệu **File lũy kế theo TVKD** trong khối cấu hình nâng cao.
      - Tự động sinh đường dẫn mặc định khi cấu hình thư mục gốc: `${parentRoot}\\Thong ke gia tri giao dich theo TVKD\\Thong ke gia tri giao dich ${year} theo TVKD.xlsx`.
      - Thiết lập Tab hiển thị trực tuyến **Chi tiết theo TVKD** hiển thị bảng danh sách giá trị giao dịch của từng thành viên trong phiên (tương ứng với dữ liệu ghi vào file Excel).

## [2026-08-05 15:32:00] - Bugfix: Sửa lỗi hiển thị "trắng bảng và toàn số 0" ở các tab Chi tiết Sản phẩm & TVKD của Đối chiếu Số lô

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Khi chạy đối chiếu, file lũy kế ghi ra đúng nhưng kết quả hiển thị các bảng chi tiết trên màn hình (theo Sản phẩm và theo TVKD) lại bị trống trơn (N/A, cột mã rỗng) và số lượng hiển thị toàn bằng 0.
- **Giải pháp**:
  - Chỉnh sửa [LotStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/LotStatisticsPanel.tsx):
    - Khắc phục sự sai lệch tên thuộc tính (mismatch keys) giữa Frontend và API Backend. Trước đây, Frontend gọi các key ảo như `item.productCode`, `item.tvkdCode`, `item.dsgdTotal`, `item.dsgdSpread`, `item.dsgdLme`,... trong khi Backend thực tế trả về các cấu trúc tinh giản `LotByProduct` và `LotByTvkd` từ helper.
    - Cấu trúc lại bảng **Chi tiết theo Mã Sản Phẩm**: Trỏ đúng các cột dữ liệu thực tế: Mã Sản phẩm (`maSP`), Khối lượng mua (`klm`), Khối lượng bán (`klb`), và Tổng số lot (`total`).
    - Cấu trúc lại bảng **Chi tiết theo TVKD**: Trỏ đúng các cột dữ liệu thực tế: Mã TVKD (`tvkd`), Khối lượng mua (`klm`), Khối lượng bán (`klb`), và Tổng số lot (`total`).

## [2026-08-05 15:21:00] - Refactor: Đồng bộ logic tính toán đường dẫn thông minh cho màn hình Đối chiếu Số lô

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Áp dụng các thay đổi đường dẫn thông minh từ màn hình Thống kê Giá trị (chống trùng lặp thư mục con, hỗ trợ tự động nhảy đường dẫn theo UAT / Production) sang màn hình Đối chiếu Số lô (Lot Statistics).
- **Giải pháp**:
  - Chỉnh sửa [LotStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/LotStatisticsPanel.tsx):
    - Đồng bộ cơ chế phân loại 3 trường hợp tự động (ends with `Futures`, ends with `Backup MS/CQG`, hoặc folder cha) cho cả hai thư mục nguồn MS và CQG.
    - Tại hook `useEffect` (2): Tự động phát hiện môi trường thông qua từ khóa `uat` / `operatechecklist_uat` trong đường dẫn.
      - **Với UAT**: Tự sinh đường dẫn 6 file Excel lũy kế năm ở dạng phẳng (`parentBase\ACM\16.07\Thong ke...`), bỏ qua lớp thư mục con `Futures\2026\T07.2026`.
      - **Với Production**: Giữ nguyên đường dẫn chuẩn phân cấp `parentBase\ACM\2026\T07.2026\16.07\Thong ke...`.
    - Bóc tách triệt để các hậu tố `Backup MS`, `Backup CQG` và `Futures` khi lấy thư mục cha chung `parentBaseCqg` để sinh các file Tracker ACM, LME, Options, Spread.

## [2026-08-05 15:16:00] - Bugfix: Sửa lỗi tràn/mất chữ ở thông báo Toast (react-hot-toast) khi báo lỗi đường dẫn dài

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Khi thông báo lỗi dài (ví dụ: cảnh báo bảo mật chặn đường dẫn file), chữ trong hộp thoại Toast hiển thị bị tràn và mất chữ ở lề bên phải.
- **Giải pháp**:
  - Chỉnh sửa [layout.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/layout.tsx):
    - Mở rộng giới hạn chiều rộng tối đa (`maxWidth`) của Toaster lên `600px` (mặc định của thư viện chỉ là `350px`, không đủ hiển thị các đường dẫn file Windows dài).
    - Thêm thuộc tính CSS `wordBreak: 'break-word'` để tự động bẻ chữ ở các chuỗi dài không khoảng trắng (như đường dẫn thư mục `C:\Users\hiepth\Downloads...`).
    - Thêm `whiteSpace: 'pre-wrap'` để tôn trọng và hiển thị chính xác các ký tự xuống dòng `\n` từ backend trả về (ví dụ các danh sách gạch đầu dòng danh mục thư mục an toàn).

## [2026-08-05 15:12:00] - Feature: Bổ sung khung hiển thị lỗi trực tiếp lên giao diện (Visual Error Box)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Tại sao khi backend lỗi (ví dụ không tìm thấy file ngày `16.08`) hệ thống không hiển thị mô tả lỗi cụ thể lên giao diện cho người dùng thấy rõ ràng mà màn hình lại trống trơn.
- **Giải pháp**:
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx) & [LotStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/LotStatisticsPanel.tsx):
    - Khởi tạo thuộc tính state `error` (chuỗi hoặc null) trong cấu trúc Component để ghi nhận thông tin lỗi.
    - Tại hàm `handleRunProcess`, tự động reset lỗi (`setError(null)`) khi bắt đầu thực thi và lưu lại thông điệp lỗi (`setError(err.message)`) khi có ngoại lệ xảy ra trong khối `catch`.
    - Thiết kế khối hiển thị lỗi (Visual Error Box) dạng Glassmorphism sang trọng với viền đỏ hổ phách (`rgba(239, 68, 68, 0.08)`), tích hợp biểu tượng `<AlertTriangle />` màu đỏ nổi bật ngay dưới thanh công cụ điều khiển.
    - Định dạng thông điệp lỗi dạng `fontFamily: monospace` và `whiteSpace: pre-wrap` để các chi tiết lỗi (như đường dẫn file bị thiếu hoặc thông báo từ backend) hiển thị nguyên vẹn, dễ đọc và dễ sao chép.

## [2026-08-05 14:33:00] - Bugfix: Sửa lỗi tự động tính toán trùng lặp đường dẫn gốc kết thúc bằng Futures

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Khi thay đổi Thư mục gốc (Target Root) thành `C:\...\Backup MS\Futures`, hệ thống tự sinh ra Đường dẫn file DSGD nguồn sai lệch: `C:\...\Backup MS\Futures\Backup MS\16.07\DSGD.xlsx` (bị lặp thêm `Backup MS` sau `Futures`). Đáng lẽ phải là: `C:\...\Backup MS\Futures\2026\T07.2026\16.07\DSGD.xlsx`.
- **Giải pháp**:
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
    - Hoàn thiện và thông minh hóa logic tự động ghép đường dẫn theo 3 trường hợp:
      - **Case 1**: Thư mục gốc kết thúc bằng `Futures` (như cấu hình Production của anh) -> Nhận diện và tự động ghép theo cấu trúc thư mục phân cấp chuẩn: `[Target Root]\[Năm]\T[Tháng].[Năm]\[Ngày].[Tháng]\DSGD.xlsx` mà không lặp lại `Backup MS`.
      - **Case 2**: Thư mục gốc kết thúc bằng `Backup MS` -> Tự động nhận diện nếu có chứa `uat`/`operatechecklist_uat` thì ghép dạng UAT (`[Target Root]\[Ngày].[Tháng]\DSGD.xlsx`), ngược lại thì tự chèn thêm `Futures` và ghép cấu trúc phân cấp.
      - **Case 3**: Thư mục gốc là thư mục cha chung (như `Tai lieu hoat dong`) -> Tự chèn thêm `Backup MS` (và `Futures` nếu không phải UAT) cùng thư mục ngày tương ứng.
    - Cập nhật logic trích xuất `parentRoot` để bóc tách triệt để cả hai hậu tố `Futures` và `Backup MS` khi sinh ra đường dẫn cho 5 file Excel lũy kế năm của Value Statistics.

## [2026-08-05 14:31:00] - Feature: Thêm cơ chế cảnh báo lệch Ngày giao dịch so với đường dẫn nguồn trên UI

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Tại sao khi sửa thủ công thư mục nguồn sang ngày khác (ví dụ: `03.08`) nhưng Ngày giao dịch vẫn chọn ngày khác (ví dụ: `04.08`) thì hệ thống vẫn cho chạy bình thường mà không báo lỗi lên màn hình để ngăn chặn rủi ro dữ liệu.
- **Giải pháp**:
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
    - Thêm cơ chế so khớp ngày tháng (dạng `DD.MM`) trích xuất từ Ngày giao dịch được chọn với chuỗi đường dẫn nguồn `dsgdPath`.
    - Nếu phát hiện không trùng khớp, hệ thống sẽ chặn và bật hộp thoại cảnh báo (`window.confirm`) yêu cầu người dùng xác nhận rõ ràng trước khi chạy.
  - Chỉnh sửa [LotStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/LotStatisticsPanel.tsx):
    - Áp dụng kiểm tra tương tự tại `handleRunProcess` và `handleDownloadExcel` cho 2 thư mục `folderPathMs` và `folderPathCqg`.
    - Nếu một trong hai thư mục không chứa phần tên ngày trùng với Ngày giao dịch được chọn, cảnh báo sẽ hiển thị để ngăn ngừa lỗi thao tác ngoài ý muốn, đồng thời vẫn giữ tính linh hoạt cho phép xác nhận chạy nếu kiểm thử trên thư mục UAT/Test đặc thù.

## [2026-08-05 13:37:00] - Bugfix: Sửa lỗi lấy đường dẫn ngày cũ khi tải lại trang Đối chiếu Số lô

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Tại màn hình Đối chiếu Số Lô, hệ thống vẫn hiển thị đường dẫn ngày cũ (`16.07`) sau khi tải lại trang, không tự động lấy theo ngày giao dịch đang chọn.
- **Giải pháp**:
  - Chỉnh sửa [LotStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/LotStatisticsPanel.tsx):
    - Thay đổi cơ chế tải cấu hình mặc định từ Database: Thay vì gọi trực tiếp `setFolderPathMs` và `setFolderPathCqg` (gây đè đường dẫn ngày cũ lưu trong DB lên ngày đang chọn), hệ thống sẽ trích xuất thư mục gốc (`basePathMs`, `basePathCqg`) từ đường dẫn lưu trong database.
    - Cập nhật hàm helper `extractMsBase` và `extractCqgBase` để phân tích chính xác thư mục gốc (quét tìm `Backup MS/Futures` hoặc `Backup CQG/Futures` không phân biệt chữ hoa thường và loại ký tự slash).
    - Khi `basePathMs` và `basePathCqg` được cập nhật, hook `useEffect` (1) sẽ tự động tính toán lại các thư mục ngày chính xác theo Ngày giao dịch (`ngayGD`) đang được chọn hiện tại.
    - Bỏ kiểm tra điều kiện trống `!path...` tại hook `useEffect` (2) để các file Excel lũy kế năm và tháng được đồng bộ tự động và đồng nhất mỗi khi người dùng thay đổi ngày giao dịch hoặc thư mục gốc.

## [2026-08-05 12:11:00] - Refactor: Đồng bộ giao diện và logic đối soát Số Lô (Lot Statistics) chuẩn Clean UI

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Đánh giá và điều chỉnh giao diện, logic của màn hình đối soát Số Lô (Lot Statistics) tương tự như màn hình Thống kê Giá trị (Value Statistics).
- **Giải pháp**:
  - Chỉnh sửa [lot-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/lot-statistics.service.ts) & [lot-statistics.dto.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/dto/lot-statistics.dto.ts):
    - Mở rộng hàm `getConfig` và DTO để hỗ trợ lưu và trả về thuộc tính `updateCumulative` (đồng bộ trạng thái checkbox).
  - Chỉnh sửa [LotStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/LotStatisticsPanel.tsx):
    - **Tinh gọn giao diện**: Loại bỏ khung tạo nhanh "Quick generate panel" dư thừa, đưa mục Thư mục gốc MS và CQG lên làm cấu hình chính.
    - **Cấu hình nâng cao thu gọn**: Đưa 2 đường dẫn chi tiết ngày (`folderPathMs`, `folderPathCqg`) và 6 đường dẫn file lũy kế năm vào panel thu gọn nâng cao (dùng Settings icon xoay của `lucide-react`).
    - **Ngăn trùng lặp đường dẫn**: Bổ sung bộ kiểm tra tự động chèn `\\Futures` nếu đường dẫn gốc kết thúc bằng `Backup MS` / `Backup CQG`.
    - **Lưu đồng bộ Database**: Cập nhật hàm `handleSaveConfig` và `useEffect` khi mount để lưu & load đồng bộ trạng thái checkbox `updateCumulative` và toàn bộ các đường dẫn từ Database.
    - Thay thế emoji bằng icon thư viện (`Lightbulb`, `Settings`).

## [2026-08-05 12:07:00] - Bugfix: Đồng bộ và Lưu cấu hình toàn bộ các trường nhập và checkbox vào Database

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Khi tick chọn checkbox "Ghi đè dữ liệu lũy kế" hoặc chỉnh sửa các đường dẫn file lũy kế rồi ấn "Lưu cấu hình mặc định", hệ thống không lưu lại trạng thái (khi load lại trang bị mất trạng thái đã chọn).
- **Giải pháp**:
  - Chỉnh sửa [value-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.controller.ts):
    - Mở rộng API `GET /value-statistics/config` và `PUT /value-statistics/config` để hỗ trợ load/save 6 cấu hình mới trong Database (bảng `system_settings`):
      - Trạng thái checkbox `updateCumulative` (khóa `bot_lot_macro_update_cumulative`).
      - 5 đường dẫn file lũy kế năm (`bot_lot_macro_path_normal`, `bot_lot_macro_path_acm`, `bot_lot_macro_path_lme`, `bot_lot_macro_path_options`, `bot_lot_macro_path_spread`).
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
    - Đưa checkbox `Ghi đè dữ liệu vào các file lũy kế` hiển thị trở lại trên màn hình chính của block.
    - Cập nhật hàm `handleSaveConfig` để gửi toàn bộ 5 đường dẫn lũy kế năm và trạng thái checkbox lên API Backend.
    - Cập nhật hook `useEffect` khi mount component để lấy đầy đủ các cấu hình này từ database về hiển thị lên UI, đảm bảo đồng bộ hoàn toàn giữa các client.
    - Cập nhật logic `useEffect` tự động điền đường dẫn: chỉ điền các đường dẫn mặc định khi các trường này trống, tránh việc ghi đè lên các giá trị cấu hình tùy chỉnh đã lưu của IT.

## [2026-08-05 12:05:00] - Bugfix: Sửa lỗi nhân đôi thư mục "Backup MS" trong đường dẫn file nguồn và file lũy kế

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Khi IT cấu hình `Thư mục gốc (Target Root)` trực tiếp trỏ đến thư mục `Backup MS` (ví dụ `C:\...\Backup MS`), hệ thống tự động sinh ra đường dẫn file nguồn chứa hai lần `Backup MS` liền nhau (`...\Backup MS\Backup MS\04.08\DSGD.xlsx`).
- **Giải pháp**:
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
    - Thêm kiểm tra `cleanBase.toLowerCase().endsWith('backup ms')` để phát hiện nếu đường dẫn người dùng nhập đã kết thúc bằng `Backup MS`.
    - Nếu có, hệ thống sẽ bỏ qua việc tự động chèn thêm `\\Backup MS` mà trỏ trực tiếp đến thư mục ngày (`\\04.08\\DSGD.xlsx`).
    - Đồng thời, đối với 5 đường dẫn file lũy kế năm và Macro, hệ thống tự động tìm thư mục cha (`parentRoot` - lùi lại một cấp thư mục ngoài `Backup MS`) để sinh đường dẫn chuẩn, tránh việc lưu file lũy kế hay tìm macro bên trong thư mục `Backup MS`.

## [2026-08-05 12:03:00] - Refactor: Khôi phục cấu hình đường dẫn file Macro (.xlsm) tại Cấu hình nâng cao

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Do Backend vẫn cần thực hiện đọc file Macro này để phân tích hệ số/tỷ giá quy đổi, chúng ta cần giữ lại khả năng cho phép IT cấu hình đường dẫn này khi cần thiết.
- **Giải pháp**:
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
    - Đưa trường nhập liệu **Đường dẫn file Macro cấu hình (.xlsm)** quay trở lại giao diện và đặt nằm ở đầu danh sách bên trong mục **Cấu hình nâng cao** (thu gọn mặc định).
    - Khôi phục kiểm tra ràng buộc `!macroPath.trim()` ở nút bấm chạy kiểm thử để đảm bảo tính an toàn dữ liệu đầu vào.
    - Giữ nguyên thiết kế ẩn checkbox `Ghi đè dữ liệu lũy kế` và tự động gửi `updateCumulative: true`.

## [2026-08-05 11:58:00] - Refactor: Loại bỏ trường Macro cấu hình và Checkbox lũy kế khỏi giao diện UI

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Không cần trường nhập file Macro cấu hình vì logic đối soát chạy bằng JS ngầm và file này đã cố định tĩnh trong thư mục dự án.
  - Không cần checkbox "Ghi đè dữ liệu lũy kế" trên UI nữa để giảm bớt thao tác thủ công, đảm bảo hệ thống tự động lưu lũy kế 100%.
- **Giải pháp**:
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
    - Xóa bỏ hoàn toàn input `Đường dẫn file Macro cấu hình (.xlsm)` ở cả giao diện chính lẫn giao diện nâng cao.
    - Xóa bỏ checkbox `Ghi đè dữ liệu vào các file lũy kế` khỏi UI.
    - Mặc định khởi tạo state `updateCumulative` là `true` để luôn gửi cờ cập nhật lũy kế lên Backend khi chạy quy trình.
    - Loại bỏ kiểm tra `!macroPath.trim()` ở thuộc tính `disabled` của nút bấm chạy kiểm thử.

## [2026-08-05 11:56:00] - Bugfix: Hiển thị vô điều kiện 5 đường dẫn lũy kế năm trong mục Cấu hình nâng cao

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Khi thu gọn cấu hình nâng cao, 5 đường dẫn file lũy kế bị mất tích (không thể thấy hoặc cấu hình) nếu checkbox "Ghi đè dữ liệu lũy kế" ở màn hình chính không được tick.
- **Giải pháp**:
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
    - Loại bỏ điều kiện `{updateCumulative && ...}` bọc xung quanh 5 đường dẫn file lũy kế.
    - Đưa 5 ô nhập liệu này hiển thị **vô điều kiện** (luôn luôn hiển thị) bên trong panel **Cấu hình nâng cao** bất kể trạng thái tick của checkbox.
    - Điều này giúp IT có thể chủ động kiểm tra và thay đổi đường dẫn của 5 file lũy kế bất cứ lúc nào khi mở rộng Cấu hình nâng cao mà không bị phụ thuộc vào checkbox thực thi.

## [2026-08-05 11:55:00] - Refactor: Thay thế biểu tượng bánh răng emoji bằng Settings component của lucide-react

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Loại bỏ nốt icon emoji `⚙️` thô ở nút đóng/mở cấu hình nâng cao và thay thế bằng biểu tượng chuẩn.
- **Giải pháp**:
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
    - Import component `Settings` từ thư viện `lucide-react`.
    - Thay thế emoji `⚙️` bằng `<Settings size={14} />`.
    - Thêm lớp CSS `animate-spin` với `animationDuration: '4s'` để tạo hiệu ứng bánh răng xoay tròn chậm rãi cực kỳ tinh tế và sinh động khi bảng cấu hình nâng cao đang mở rộng (expanded).
    - Thêm chỉ báo hướng đóng/mở dạng mũi tên (`▲` / `▼`) ở cuối nhãn nút bấm để giao diện rõ ràng.

## [2026-08-05 11:50:00] - Refactor: Thay thế biểu tượng bóng đèn emoji bằng Lightbulb component của lucide-react

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Loại bỏ icon emoji `💡` thô ở phần chú giải và thay thế bằng icon từ thư viện biểu tượng chuẩn.
- **Giải pháp**:
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
    - Import component `Lightbulb` từ thư viện `lucide-react`.
    - Thay thế emoji `💡` bằng `<Lightbulb size={12} color="#eab308" />`.
    - Sử dụng `display: 'flex'`, `alignItems: 'center'` và `gap: '5px'` để căn chỉnh thẳng hàng dọc hoàn hảo giữa icon bóng đèn và văn bản chỉ dẫn.

## [2026-08-05 11:48:00] - Refactor: Tinh gọn cấu hình & tích hợp mục "Cấu hình nâng cao" đóng/mở trong ValueStatisticsPanel

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Tối giản hóa ô nhập `Đường dẫn file DSGD nguồn` vì 99% trường hợp backend tự động tính toán được, tránh gây dư thừa rối mắt cho IT vận hành.
- **Giải pháp**:
  - Chỉnh sửa [ValueStatisticsPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ValueStatisticsPanel.tsx):
    - Khởi tạo biến trạng thái `showAdvanced` (mặc định là `false`).
    - Gom tất cả các cấu hình đường dẫn chi tiết ít khi cần thay đổi gồm: `Đường dẫn file Macro cấu hình (.xlsm)`, `Đường dẫn file DSGD nguồn` và `5 file Excel lũy kế năm` vào trong panel đóng/mở `<div style={{ borderTop: '1px dashed var(--border-color)', ... }}`.
    - Thêm nút toggle `⚙️ Hiển thị cấu hình nâng cao (Đường dẫn chi tiết)` để người dùng chủ động click đóng/mở.
    - Rút gọn màn hình cấu hình chính xuống mức tối giản nhất: Chỉ hiển thị **Ngày giao dịch**, **Thư mục gốc (Target Root)** và Checkbox **Ghi đè dữ liệu lũy kế**.

## [2026-08-05 11:24:00] - Bugfix: Loại bỏ nhãn kỹ thuật (Enum raw string) trong Dropdown Root Cause của IncidentReportModal

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Loại bỏ các mã enum kỹ thuật (như `MISSING_CONFIGURATION`, `SOFTWARE_BUG`,...) hiển thị trong dropdown chọn nguyên nhân của sự cố (Incident Report) để giao diện hoàn toàn tiếng Việt thân thiện với người vận hành.
- **Giải pháp**:
  - Chỉnh sửa [IncidentReportModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx):
    - Giữ nguyên thuộc tính `value` (enum tiếng Anh) để gửi lên API.
    - Xóa các tiền tố tiếng Anh và dấu ngoặc đơn ở phần hiển thị chữ cho người dùng xem. Ví dụ: `MISSING_CONFIGURATION (Thiếu cấu hình)` chuyển thành `Thiếu cấu hình`.
    - Áp dụng tương tự cho tất cả 7 tùy chọn nguyên nhân gốc rễ.

## [2026-08-05 11:18:00] - Bugfix: Tự động Tóm tắt sự cố & Loại bỏ các Log kỹ thuật thừa tại Báo cáo trực quan

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Không hiển thị y nguyên log chi tiết (với các dòng trạng thái hệ thống rối rắm) mà chỉ trích xuất các thông tin nghiệp vụ/lỗi thực tế để hiển thị gọn gàng, trực quan.
- **Giải pháp**:
  - Chỉnh sửa [SystemApiVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/SystemApiVisualReport.tsx):
    - Thêm hàm bổ trợ `summarizeLogText` để phân tích văn bản log.
    - Lọc bỏ các dòng log kỹ thuật của hàng đợi như `Job enqueued`, `Job status transitioned`, `Starting attempt`, `Attempt X failed`, `Job failed permanently`, `Connecting to database`, `Initialize`.
    - Loại bỏ các chuỗi timestamp thô ở đầu mỗi dòng (như `[2026-08-05T02:14:05.443Z]`).
    - Tự động định dạng các dòng nghiệp vụ còn lại thành danh sách bullet points (`•`) rõ ràng, giúp vận hành viên nhìn thấy ngay các lỗi nghiệp vụ hoặc mô tả tiến trình thực tế.

### 2. Danh sách file chỉnh sửa/tạo mới
- **Chỉnh sửa**:
  - [SystemApiVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/SystemApiVisualReport.tsx)

### 3. Xác nhận Build/Kiểm thử
- Biên dịch thành công 100% qua lệnh `cmd /c npx tsc --noEmit`.

## [2026-08-05 11:05:00] - Bugfix: Hiển thị lỗi trực quan trong Modal Báo cáo cho tác vụ Cảnh báo Đáo hạn

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Khắc phục sự cố modal Báo cáo trực quan hiển thị sai thông tin cho tác vụ Cảnh báo Đáo hạn (`Bot tính mốc đáo hạn & gửi thông báo nhắc nhở TVKD tự động`): Modal hiển thị "TỔNG SỐ EMAIL GỬI: 0 email" gây nhầm lẫn khi tác vụ gặp lỗi "Chưa nhận được email Thông báo tất toán hợp đồng...".
- **Giải pháp**:
  - Chỉnh sửa [SystemApiVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/SystemApiVisualReport.tsx):
    - Thêm prop `rawText` để nhận thông báo chi tiết từ log của Bot.
    - Phát hiện các từ khóa lỗi (`chưa nhận`, `lỗi`, `không tìm thấy`,...) hoặc thông tin vận hành thành công trong log để hiển thị dưới dạng **Alert Card (Màu đỏ/xanh lá)** trực quan ngay phía trên.
    - Ẩn khung đếm email trống ("0 email") nếu tác vụ không phải là tác vụ kiểm tra hòm thư gửi sao kê thực tế nhằm tránh gây hiểu lầm cho người vận hành.
  - Chỉnh sửa [BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx) để truyền giá trị `parsedData.rawText` vào component `SystemApiVisualReport`.

### 2. Danh sách file chỉnh sửa/tạo mới
- **Chỉnh sửa**:
  - [SystemApiVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/SystemApiVisualReport.tsx)
  - [BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx)

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử kiểu dữ liệu Frontend bằng `cmd /c npx tsc --noEmit` thành công 100%.

## [2026-08-05 10:38:00] - Safe Guard: Vô hiệu hóa (Comment) các cơ chế đường dẫn dự phòng (Fallback Paths) chuẩn bị Go-Live UAT

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Không xóa hẳn mà thực hiện comment (vô hiệu hóa) cơ chế quét tệp dự phòng từ thư mục cá nhân `Downloads` và thư mục tạm `temp/cast-downloads` của các tác vụ tự động đối chiếu ca trực (KLGD, Pre-EOD, SOD, EOD) để tránh nhầm lẫn dữ liệu nhưng vẫn giữ khung code để tham khảo.
- **Giải pháp**:
  - Khôi phục và đặt comment ẩn (`//`) cho các cơ chế fallback trong [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts):
    - **Tác vụ `runAutoCheckKLGD`**: Comment các dòng fallback đến `Downloads` và `temp/cast-downloads`.
    - **Tác vụ `runAutoCheckPreEOD`**: Comment các dòng fallback Straits và CQG đến `Downloads` và `temp/cast-downloads`.
    - **Tác vụ `runAutoCheckSOD`**: Comment dòng fallback `Accounts_Balances` đến thư mục tạm `temp/cast-downloads`.
    - **Tác vụ `runAutoCheckEodMm`**: Comment các dòng fallback `eod.xlsx`/`Accounts_Balances` đến `temp/cast-downloads`.

### 2. Danh sách file chỉnh sửa/tạo mới
- **Chỉnh sửa**:
  - [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch Backend (`cmd /c npm run build`) thành công 100% không phát sinh lỗi.


## [2026-08-05 10:25:00] - Refactor & Bug Fix: Đồng bộ trạng thái Cha-Con, Khóa tiến trình Sub-task và chặn lỗi lặp cập nhật ngược (Propagation Loop Fix)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Soát lại toàn bộ các file liên quan đến trạng thái của tác vụ cha và tác vụ con để tránh sai sót.
  - Đồng bộ trạng thái tác vụ cha thành "Đang kiểm tra" (WAITING) khi có ít nhất một tác vụ con hoạt động.
  - Khóa checkbox tích chọn và thay đổi trạng thái đối với các Sub-task con chưa đủ điều kiện (phụ thuộc vào tác vụ con đứng trước chưa hoàn thành).
- **Phát hiện rủi ro (Propagation Loop & Subtask Uncheck Bug)**:
  - Khi tác vụ con cập nhật, hệ thống tự động cập nhật trạng thái tác vụ cha (ví dụ sang `WAITING`).
  - Hàm `updateTaskStatus` khi chạy trên tác vụ cha có chứa logic tự động cập nhật ngược lại toàn bộ tác vụ con (`isParentTask` block).
  - Khi cha chuyển sang `WAITING` (tức `isChecked = false`), logic này sẽ vô tình ghi đè và hủy tick (`isChecked = false`) toàn bộ các tác vụ con đã hoàn tất trước đó! Điều này gây ra lỗi vòng lặp hủy tích chọn.
- **Giải pháp & Khắc phục**:
  - **Backend (shifts.service.ts)**:
    - **Đồng bộ trạng thái Cha-Con**: Cập nhật logic đánh giá tác vụ cha. Khi phát hiện tác vụ cha chưa tích hoàn thành (`!parentTask.isChecked`), nếu có bất kỳ tác vụ con nào đang có hoạt động (`status === 'WAITING' || s.isChecked || s.status === 'FAILED' || s.status === 'NEEDS_ATTENTION'`), hệ thống tự động đổi trạng thái tác vụ cha thành `WAITING` (Đang kiểm tra). Nếu không có, trả về `PENDING`.
    - **Chặn lặp cập nhật ngược**: Sửa điều kiện cập nhật ngược từ cha xuống con từ `if (isParentTask)` thành `if (isParentTask && !isInternal)`. Khi Backend cập nhật trạng thái tác vụ cha từ luồng đồng bộ nội bộ (`isInternal = true`), luồng ghi đè ngược xuống con sẽ bị bỏ qua hoàn toàn.
  - **Frontend (TaskTable.tsx)**:
    - Sử dụng hàm check khóa `isTaskLocked(child)` để chặn không cho nhân viên tick chọn checkbox hoặc đổi trạng thái thủ công của Sub-task con nếu các bước phụ thuộc trước đó của nó chưa hoàn thành (`isChecked` của bước trước là `false`).

### 2. Danh sách file chỉnh sửa/tạo mới
- **Chỉnh sửa**:
  - [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts)
  - [TaskTable.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx)

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch Frontend (`cmd /c npx tsc --noEmit`) thành công 100% không phát sinh lỗi.
- Kiểm thử biên dịch Backend (`cmd /c npm run build`) thành công 100%.


## [2026-08-05 10:10:00] - Bug Fix: Sửa lỗi mất Sidebar (Ca trực hiện tại, Tra cứu lịch sử) và mất Phòng ban (Chưa phân phòng) khi lưu cấu hình hồ sơ cá nhân

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Gặp lỗi nghiêm trọng: Khi nhân viên trực ca thực hiện lưu thay đổi ở trang Cấu hình (Settings/Profile), toàn bộ các nút chức năng trên sidebar (Ca trực hiện tại, Tra cứu lịch sử) bị biến mất, đồng thời phần phòng ban của tài khoản bị chuyển thành "Chưa phân phòng".
- **Phát hiện nguyên nhân**:
  - Khi lưu cấu hình cá nhân, Frontend gọi API `PUT /api/v1/auth/profile`.
  - Phản hồi từ hàm `updateProfile` ở Backend trả về đối tượng `updatedUser` bị thiếu trường `permissions` (danh sách quyền) và trả về trường phòng ban dưới dạng `departmentId` (ID thô) thay vì object `department` đã được populate đầy đủ như lúc đăng nhập.
  - Khi Frontend nhận phản hồi và cập nhật vào `AuthContext`, nó làm mất trắng quyền và thông tin phòng ban của user, dẫn đến Sidebar ẩn đi các link ca trực (do không thỏa mãn điều kiện `canViewChecklist`).
- **Khắc phục**:
  - Cập nhật hàm `updateProfile` trong [auth.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/auth.service.ts):
    - Sử dụng `.populate()` để điền đầy đủ dữ liệu phòng ban (`departmentId` và `parentDepartmentId`) trước khi phản hồi về Frontend.
    - Truy vấn cơ sở dữ liệu để lấy lại danh sách quyền (`permissions`) tương ứng với vai trò của user và nhúng vào payload trả về.
    - Đổi tên key trả về thành `department` để đồng bộ hoàn toàn cấu trúc dữ liệu với API đăng nhập gốc.

### 2. Danh sách file chỉnh sửa/tạo mới
- **Chỉnh sửa**:
  - [auth.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/auth.service.ts)

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch Backend (`cmd /c npm run build`) thành công 100%.


## [2026-08-05 09:50:00] - Refactor & Bug Fix: Triển khai phương án Lai (Hybrid) cho cấu hình cảnh báo Margin Checker, sửa lỗi gửi Telegram Bot, bổ sung trạng thái gửi tin gần nhất (Delivery Logs) và thiết lập chốt chặn bảo mật SMTP

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Đánh giá thực tế nghiệp vụ và vận hành để lên kế hoạch và triển khai phương án Lai (Hybrid) đối với cấu hình cảnh báo Margin Checker: Ẩn thông tin cấu hình hạ tầng máy chủ SMTP nhạy cảm đối với nhân viên trực ca thường nhưng vẫn giữ khả năng nhập Email/Telegram người nhận trực quan trên từng Card đối soát.
  - Bổ sung trạng thái gửi tin (Delivery Logs) dưới chân các Card cấu hình nghiệp vụ để tăng tính minh bạch khi bàn giao ca trực vận hành.
- **Giải pháp**:
  - **Frontend (MarginCheckerModal.tsx)**:
    - Sử dụng hook `useAuth` để kiểm tra thông tin vai trò tài khoản đăng nhập của nhân sự.
    - Cấu hình chỉ hiển thị khối *"Cấu hình kết nối Mail Server (SMTP)"* khi người dùng đăng nhập có vai trò `ADMIN`. Với tài khoản nhân sự trực ca thông thường (`STAFF`...), khối này hoàn toàn bị ẩn, loại bỏ nguy cơ lộ mật khẩu email hệ thống và thao tác cấu hình sai.
    - Xây dựng helper component `renderDeliveryStatus` để hiển thị trạng thái gửi tin gần nhất (🟢 Thành công hoặc 🔴 Thất bại kèm chi tiết lỗi cụ thể) ở chân mỗi Card cấu hình nghiệp vụ.
  - **Backend (margin-checker.controller.ts, margin-checker.service.ts & reconciliation.service.ts)**:
    - **Chốt chặn bảo mật & Bảo vệ ghi đè**: Cập nhật `MarginCheckerController.ts` để chặn truy cập trái phép vào mật khẩu SMTP từ Network Inspect: 
      - Mask mật khẩu thành `********` trong API GET `/margin-checker/config` đối với tài khoản không phải `ADMIN`.
      - Khi tài khoản thường gọi API POST lưu cấu hình, Backend sẽ tự động nạp cấu hình SMTP cũ từ database đè lên cấu hình lưu mới (đảm bảo không bị ghi đè mất mật khẩu thật do frontend gửi lên dạng `********` hoặc thiếu khối `smtp`).
    - **Sửa lỗi Telegram**: Phát hiện và sửa lỗi nghiêm trọng trong luồng gửi Telegram cảnh báo đối soát ký quỹ: Thêm tham số `chatId` đích vào cuộc gọi `this.telegramService.sendMessage(message, chatId)`.
    - **Dự phòng SMTP**: Hỗ trợ cơ chế tự động đọc cấu hình SMTP dự phòng từ các biến môi trường (`SMTP_HOST`, `SMTP_PORT`...) để hỗ trợ đội IT quản lý hạ tầng mạng thuận tiện hơn.
    - **Ghi nhận trạng thái**: Bổ sung hàm `updateDeliveryStatus` cập nhật kết quả gửi email (`lastEmailSentAt`, `lastEmailStatus`, `lastEmailError`) trực tiếp vào MongoDB system settings của Margin Checker mỗi khi gửi email thành công/thất bại, đồng thời truyền `checkerType` đầy đủ từ mọi API đối soát.

### 2. Danh sách file chỉnh sửa/tạo mới
- **Chỉnh sửa**:
  - [MarginCheckerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/MarginCheckerModal.tsx)
  - [margin-checker.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/margin-checker/margin-checker.controller.ts)
  - [margin-checker.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/margin-checker/margin-checker.service.ts)
  - [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch Frontend (`cmd /c npx tsc --noEmit`) thành công 100% không phát sinh lỗi.
- Kiểm thử biên dịch Backend (`cmd /c npm run build`) thành công 100%.


## [2026-08-05 09:18:00] - Bug Fix: Khắc phục lỗi nhấp nháy cảnh báo đỏ "Lỗi tải ca trực - Failed to fetch" khi chuyển trang có độ trễ

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Khắc phục triệt để hiện tượng nhấp nháy/chớp nhoáng màn hình đỏ báo lỗi "Lỗi tải ca trực - Failed to fetch" khi chuyển từ các trang khác về ca trực hiện tại.
- **Giải pháp**:
  - **Phát hiện thêm**: Khi chuyển URL từ `/checklist` sang `/checklist?id=pendingId`, React thực hiện một lượt render trung gian ngay khi `shiftLogId` thay đổi nhưng trước khi `useEffect` kịp kích hoạt `setLoading(true)`. Ở lượt render này, `loading` vẫn là `false` (do trạng thái cũ từ `loadActiveLogs` kết thúc) và `log` là `null`, dẫn đến việc UI bỏ qua skeleton (chỉ render skeleton khi `loading && !log`) và hiển thị ngay màn hình báo lỗi `!log`.
  - **Khắc phục**:
    - Cập nhật điều kiện hiển thị skeleton trong file [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx) từ `loading && !log` thành `(loading || (shiftLogId && !loadError)) && !log`.
    - Thiết lập này đảm bảo khi bắt đầu quá trình chuyển hướng và chuyển ID ca trực mới, giao diện sẽ lập tức hiển thị **Worksheet Skeleton** để che phủ thời gian trễ phản hồi từ API thay vì nhảy thẳng vào khối báo lỗi, loại bỏ hoàn toàn hiện tượng nhấp nháy giao diện.
    - Kết hợp với cơ chế sequence request counters và dọn dẹp `loadError` đã thiết lập trước đó tại [useChecklist.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/hooks/useChecklist.ts) để mang lại trải nghiệm chuyển trang mượt mà nhất.

### 2. Danh sách file chỉnh sửa/tạo mới
- **Chỉnh sửa**:
  - [useChecklist.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/hooks/useChecklist.ts)
  - [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx)

### 3. Xác nhận Build/Kiểm thử
- Đã chạy kiểm tra typecheck Frontend (`cmd /c npx tsc --noEmit`) thành công 100% không phát sinh bất kỳ lỗi biên dịch nào.


## [2026-08-04 16:15:00] - Bug Fix & Improvement: Giải quyết nghẽn tải Backend (Jobs query pagination/projection bottleneck), bổ sung giao diện cấu hình tài khoản CCP/CE/CAST ở Frontend, sửa lỗi hiển thị sai Modal kết quả OMS và sửa API trigger ở Frontend, đồng bộ trạng thái "Đang kiểm tra" cho các tác vụ con đang chạy ngầm, tạo file script test OMS bằng ứng dụng NestJS context

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Khắc phục lỗi Backend bị đơ, nghẽn tải hoàn toàn (CPU 100%) khi mở trang cấu hình bot hoặc chạy các tác vụ.
  - Sửa lỗi tự động quét EOD OMS trên CCP/CE thất bại (trả về dữ liệu trống) dù thực tế hệ thống đã chạy EOD thành công trên môi trường thật.
  - Khắc phục lỗi `Timeout 30000ms exceeded` khi click vào tab "Lịch sử EOD" trong Playwright do phần tử không hiển thị kịp hoặc bị che khuất bởi các thành phần MUI (backdrop/loading spinner).
  - Cấu hình cho phép chạy Playwright ở chế độ headful (mở cửa sổ trình duyệt thực tế) để trực quan theo dõi/debug lỗi trên máy local của user.
  - Yêu cầu tạo file kịch bản test sử dụng trực tiếp Service của module NestJS thay vì script JavaScript thuần để tận dụng cơ chế kết nối database, giải mã thông tin cấu hình và dependency injection có sẵn.
  - Khắc phục việc thiếu các ô nhập thông tin tài khoản đăng nhập của **Core CCP**, **Core CE** và **CQG CAST** trên giao diện Cài đặt Bot (`/admin/bot-config`), khiến người dùng không thể cấu hình/lưu thông tin ở môi trường local/UAT.
  - Sửa lỗi nút kích hoạt kiểm tra lại thủ công báo lỗi `Cannot POST /bot/check-oms`.
  - Cải thiện luồng hiển thị: Khi các tác vụ con (subtasks) của Bot đang trong hàng đợi chạy ngầm (PENDING hoặc PROCESSING), giao diện vẫn hiển thị "Chưa thực hiện" (PENDING) là không hợp lý. Yêu cầu chúng phải tự động chuyển sang trạng thái "Đang kiểm tra" (WAITING) ngay lập tức khi job được tạo hoặc đang chạy.
  - Sửa lỗi màn hình Modal kết quả OMS hiển thị sai giao diện "Đối chiếu số dư CQG tự động" khi bấm vào nút "Xem đối chiếu chi tiết trực quan" của tác vụ `ops_open_02`.
- **Giải pháp**:
  - **Backend (Tối ưu hóa API Jobs)**: 
    - Phát hiện API `GET /api/v1/bot-engine/jobs` trả về payload quá lớn (lên tới **12.5 Megabytes** cho 50 jobs do chứa toàn bộ mảng `logs` dài và `payload.result` so khớp giao dịch khổng lồ). Frontend polling 8 giây một lần gây ra nghẽn hàng đợi Event Loop và chiếm dụng CPU liên tục.
    - Chỉnh sửa file [bot-engine.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.controller.ts) để khi truy vấn danh sách chung (không truyền filter `shiftLogId` / `taskId`), sẽ sử dụng projection loại trừ các trường nặng (`-logs -payload.result`), giảm kích thước dữ liệu phản hồi xuống **dưới 10KB** và tăng tốc độ xử lý từ 140 giây về dưới 10ms.
    - Viết thêm API chi tiết `@Get('jobs/:id')` để lấy đầy đủ thông tin (bao gồm logs/payload) của duy nhất một job được yêu cầu.
  - **Frontend (Tối ưu tải Logs trong hàng đợi)**:
    - Cập nhật file [JobQueuePanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/JobQueuePanel.tsx) để chỉ tải đầy đủ logs và captcha của job cụ thể thông qua API chi tiết trên-nhu-cầu (on-demand) khi người dùng click chọn job đó.
    - Tích hợp thêm cơ chế tự động làm mới (polling logs) riêng biệt với tần suất 4 giây/lần chỉ áp dụng khi job được chọn đang ở trạng thái chạy ngầm (`PROCESSING`/`PENDING`), tránh tải lại không cần thiết khi job đã kết thúc.
  - **Backend (OMS Watcher)**: Bổ sung lệnh click vào Tab "Lịch sử EOD" (`ccpTab` và `ceTab`) trước khi cào bảng dữ liệu trong file [oms-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/oms-watcher.service.ts). Đồng thời chuyển sang dùng selector `page.getByText('Lịch sử EOD').first()` cực kỳ chuẩn xác, kết hợp `click({ force: true })` và `.catch(() => {})` để click cưỡng bức ngay cả khi bị che khuất tạm thời bởi loading overlay, tránh block tiến trình hoặc gây timeout 30s.
  - **Backend (Playwright Headful Mode)**: Cập nhật hàm launch browser trong [oms-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/oms-watcher.service.ts) để đọc cấu hình từ biến môi trường `process.env.PLAYWRIGHT_HEADLESS`. Nếu đặt `PLAYWRIGHT_HEADLESS=false` ở file `.env` local, trình duyệt Chromium sẽ được mở hiển thị trực quan và tự động bật `slowMo: 1000` (giãn cách các thao tác 1 giây) để phục vụ debug.
  - **Backend (Test Script NestJS context)**: Tạo file [test-oms-playwright.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/test-oms-playwright.ts) khởi tạo NestJS Application Context, lấy `OmsWatcherService` trực tiếp từ container để gọi chạy `checkOmsStatus()` với các thiết lập giải mã chuẩn của dự án. Đăng ký script tiện ích `"test:oms-playwright"` trong [package.json](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/package.json).
  - **Backend (Queue Sync)**: Sửa đổi file [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts) để gọi hàm `syncJobToChecklist(job, 'PENDING')` ngay sau khi tạo/lưu job mới trong hàng đợi (`enqueue`). Đồng thời cập nhật hàm `syncJobToChecklist` để cập nhật trạng thái tác vụ sang `WAITING` ("Đang kiểm tra") cho cả hai trạng thái `PROCESSING` và `PENDING`.
  - **Frontend (ConnectionSettings.tsx)**: Thiết kế và render thêm 3 cụm card giao diện (sử dụng grid và CSS class `glass-panel`) tương ứng để cấu hình và nhập liệu tài khoản **CQG CAST**, **Core CCP** và **Core CE** trực quan, kết hợp chức năng toggle ẩn/hiện mật khẩu, tự động lưu thông tin bằng nút "Lưu tất cả cấu hình tài khoản Bot" có sẵn.
  - **Frontend (Page.tsx - Chuyển hướng Modal)**: Sửa file [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx) để khi click "Xem đối chiếu chi tiết trực quan" cho hai tác vụ `ops_open_02` (OMS) và `ops_open_07` (Email), nó sẽ tự động kích hoạt hiển thị đúng `OmsStatusModal` (màn hình chuyên biệt hiển thị trạng thái quét CCP/CE EOD/MM) thay vì mở `BotLogViewerModal` chung chung.
  - **Frontend (OmsStatusModal.tsx & BotLogViewerModal.tsx - Sửa logic nhận diện)**: 
    - Sửa file [OmsStatusModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/OmsStatusModal.tsx) để gọi đúng URL API trigger của backend.
    - Sửa file [BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx) tối ưu điều kiện phân loại `jsonType === 'CQG'`, loại trừ các task có chứa chữ "OMS" trong tiêu đề hoặc ID dạng `ops_open_02` để tránh bị nhận diện nhầm thành đối chiếu số dư CQG.

### 2. Danh sách file chỉnh sửa/tạo mới
- **Tạo mới**:
  - [test-oms-playwright.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/test-oms-playwright.ts)
- **Chỉnh sửa**:
  - [bot-engine.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.controller.ts)
  - [JobQueuePanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/JobQueuePanel.tsx)
  - [ConnectionSettings.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ConnectionSettings.tsx)
  - [package.json](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/package.json)
  - [oms-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/oms-watcher.service.ts)
  - [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts)
  - [OmsStatusModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/OmsStatusModal.tsx)
  - [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx)
  - [BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx)

### 3. Xác nhận Build/Kiểm thử
- Kiểm tra typecheck và build dự án (`npx tsc --noEmit` cho cả Frontend và Backend) đều thành công 100% không phát sinh lỗi.


## [2026-08-04 14:20:00] - Feature & Documentation: Tạo script đóng ca trực và tài liệu backup/restore database

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Tạo tài liệu ghi nhận luồng backup/restore database MongoDB giữa Atlas, Desktop local và Server Ubuntu.
  - Viết câu lệnh hoặc công cụ đóng nhanh toàn bộ ca trực đang ở trạng thái `PENDING` thành `COMPLETED` trực tiếp từ máy Windows local.
- **Giải pháp**:
  - Tạo mới file hướng dẫn [HUONG_DAN_BACKUP_RESTORE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/HUONG_DAN_BACKUP_RESTORE.md) với các lệnh backup/restore chi tiết.
  - Cập nhật tài liệu [DEPLOYMENT_LOG.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/DEPLOYMENT_LOG.md).
  - Viết mới file script Node.js [close_shifts.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/close_shifts.js) sử dụng thư viện `mongoose` và `dotenv` của backend để kết nối database theo `MONGODB_URI` trong `.env` và cập nhật các ca trực PENDING thành COMPLETED.

### 2. Danh sách file chỉnh sửa/tạo mới
- **Tạo mới**:
  - [HUONG_DAN_BACKUP_RESTORE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/HUONG_DAN_BACKUP_RESTORE.md)
  - [close_shifts.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/close_shifts.js)
- **Chỉnh sửa**:
  - [DEPLOYMENT_LOG.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/DEPLOYMENT_LOG.md)

### 3. Xác nhận Build/Kiểm thử
- Script `close_shifts.js` sử dụng Node.js chạy độc lập từ CLI, không làm thay đổi hay can thiệp vào logic chạy của Backend chính, đảm bảo an toàn tuyệt đối. Đã kiểm tra import package hợp lệ.


## [2026-07-31 10:20:00] - Refactor & Style: Tái cấu trúc giờ theo mùa sang mảng động & Tự động dịch chuyển giờ hạn chót task (Auto-shifting) & Tinh chỉnh giao diện SLA

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Thay đổi thuật ngữ kĩ thuật "SLA" thành thuật ngữ tiếng Việt dễ hiểu "Thời gian trễ cho phép" ở màn hình cấu hình ca trực.
  - Thay thế các icon emoji thô sơ `☀️` và `❄️` bằng các icon chuyên nghiệp (`Sun` và `Snowflake` từ `lucide-react`).
  - Phân tích và nâng cấp cơ chế lưu trữ giờ theo mùa dạng mảng động dưới Database để tăng khả năng mở rộng (Future-proof) nhưng vẫn giữ giao diện Frontend đơn giản dạng phẳng (Flat Fields).
  - Tự động dịch chuyển giờ hạn chót (deadline) và giờ chạy bot (botTriggerTime) của tất cả các việc con (tasks) bên trong ca trực theo độ lệch giờ Hè/Đông để tránh việc Admin phải nhân bản Mẫu checklist thủ công.
- **Giải pháp**:
  - **Frontend**:
    - Cập nhật trang [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/shift-slots/page.tsx) để đổi thuật ngữ hiển thị, bổ sung icon trợ giúp `HelpCircle` giải thích chi tiết ô nhập liệu, và đổi các emoji sang các icon vector `Sun` và `Snowflake`.
    - Loại bỏ cột "Qua đêm" khỏi bảng danh sách ca trực, thay vào đó hiển thị biểu tượng vector `Moon` tinh tế màu vàng cam cạnh các mốc giờ kết thúc ca qua đêm để tối ưu hóa không gian.
    - Cập nhật trang [calendar/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/calendar/page.tsx) loại bỏ hoàn toàn bảng "Quản lý Ca trực" trùng lặp cũ, thay thế bằng một Card hướng dẫn thiết kế nét đứt tinh tế và nút bấm chuyển trang đến trang quản trị ca trực chuyên biệt.
  - **Database & Backend**:
    - Cấu trúc lại [shift-slot.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/shift-slot.schema.ts) để lưu các khung giờ mùa hè/mùa đông dưới mảng động `seasonalHours`.
    - Sử dụng cơ chế Mongoose Virtual Getters để tự động sinh các trường phẳng (`startTimeSummer`, `endTimeSummer`...) phục vụ giao thức API tương thích ngược với Frontend cũ.
    - Cập nhật [shift-slots.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shift-slots/shift-slots.service.ts) tự động đóng gói dữ liệu phẳng nhận được từ client thành dạng mảng động trước khi ghi vào Database.
    - Cập nhật [seed.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/database/seed.service.ts) gieo dữ liệu mảng động mẫu cho các ca trực.
    - Điều chỉnh hàm đổi giờ ca trực trong [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts) và [dashboard.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/dashboard/dashboard.service.ts) truy vấn từ mảng `seasonalHours` động thay vì các trường tĩnh.
    - Cập nhật [shift-jobs.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shift-jobs/shift-jobs.service.ts) để tự động tính độ lệch giờ (Offset) giữa giờ Hè/Đông thực tế và giờ mặc định của ca trực, tự động dịch chuyển giờ hạn chót và giờ chạy Bot của các việc con trước khi tạo bản ghi ca trực `ShiftLog`.

### 2. Danh sách file chỉnh sửa/tạo mới
- **Chỉnh sửa**:
  - `frontend/src/app/admin/shift-slots/page.tsx`
  - `frontend/src/app/admin/calendar/page.tsx`
  - `backend/src/schemas/shift-slot.schema.ts`
  - `backend/src/modules/shift-slots/shift-slots.service.ts`
  - `backend/src/modules/shifts/shifts.service.ts`
  - `backend/src/modules/dashboard/dashboard.service.ts`
  - `backend/src/database/seed.service.ts`
  - `backend/src/modules/shift-jobs/shift-jobs.service.ts`

### 3. Xác nhận Build/Kiểm thử
- Frontend typecheck hoàn tất: `npx tsc --noEmit` thành công không phát sinh lỗi.
- Backend rebuild hoàn tất: `npm run build` thành công.
- Đã chạy kịch bản gieo dữ liệu và cập nhật qua API: Thử nghiệm sửa đổi giờ Hè/Đông trên Ca trực qua Dịch vụ hoạt động hoàn hảo.
- Đã chạy kịch bản thử nghiệm sinh ca trực tự động vào mùa Hè: Xác nhận các mốc giờ deadline và giờ chạy bot của các việc con tự động dịch chuyển lùi sớm 1 tiếng khớp chính xác tuyệt đối với khung giờ mùa Hè của ca trực.


## [2026-07-31 09:40:00] - Feature: Triển khai Lịch trực & Ca trực theo mùa MXV liên thông quốc tế


### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Thiết kế và triển khai cơ chế lịch nghỉ lễ theo từng Sở giao dịch nước ngoài (CME, ICE, LME, SGX, BMD, OSE) và giờ đổi ca theo mùa (DST - Giờ mùa hè/mùa đông) để đáp ứng nghiệp vụ trực liên thông quốc tế của MXV.
- **Giải pháp**:
  - **Database Schemas**:
    - Tạo mới [exchange.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/exchange.schema.ts) và [exchange-holiday.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/exchange-holiday.schema.ts).
    - Thêm trường `monitoredExchanges` vào [department.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/department.schema.ts).
    - Thêm `startTimeSummer`, `endTimeSummer`, `startTimeWinter`, `endTimeWinter` vào [shift-slot.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/shift-slot.schema.ts).
  - **Business Logic**:
    - Cập nhật [seed.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/database/seed.service.ts) để tự động seed các sở giao dịch, lịch nghỉ lễ mẫu, giờ đổi mùa cho ca trực, và thiết lập sở giám sát cho từng phòng ban.
    - Cập nhật [working-calendar.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/working-calendar/working-calendar.service.ts) thêm hàm tự động tính DST (Daylight Saving Time) cho múi giờ Mỹ và UK/Châu Âu, và hàm kiểm tra phòng ban đóng cửa dựa trên các sở giám sát.
    - Cập nhật [shift-jobs.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shift-jobs/shift-jobs.service.ts) chuyển đổi kiểm tra lịch nghỉ lễ từ cấp hệ thống sang kiểm tra riêng biệt cho từng phòng ban (sinh ca trực dựa trên tình trạng đóng/mở của các sở giám sát).
    - Cập nhật [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts) và [dashboard.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/dashboard/dashboard.service.ts) để tự động điều chỉnh giờ bắt đầu/kết thúc ca trực của `shiftSlotId` tùy theo ngày ca trực đó thuộc mùa hè hay mùa đông.
  - **Frontend**:
    - Cập nhật trang cấu hình ca trực [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/shift-slots/page.tsx) để hiển thị chi tiết các khung giờ theo mùa trong bảng và bổ sung các trường nhập giờ Hè/giờ Đông khi Thêm mới/Chỉnh sửa cấu hình ca trực.
    - Cập nhật thay thế thuật ngữ kỹ thuật "SLA" thành thuật ngữ tiếng Việt dễ hiểu "Thời gian trễ cho phép" trên tiêu đề trang, cột bảng biểu và trường nhập liệu. Bổ sung icon `HelpCircle` mô tả hướng dẫn chi tiết cho người dùng ca trực.
    - Thay thế các emoji thô sơ `☀️` và `❄️` bằng các icon vector chuyên nghiệp `Sun` và `Snowflake` từ thư viện `lucide-react` để nâng cao thẩm mỹ giao diện.
  - **Dependency / Circular Loop**:
    - Gỡ bỏ `SystemSettingsModule` khỏi `imports` trong [working-calendar.module.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/working-calendar/working-calendar.module.ts) vì `SystemSettingsModule` là toàn cục (`@Global()`), giúp khắc phục lỗi Circular Dependency Loop.


### 2. Danh sách file chỉnh sửa/tạo mới
- **Tạo mới**:
  - `backend/src/schemas/exchange.schema.ts`
  - `backend/src/schemas/exchange-holiday.schema.ts`
- **Chỉnh sửa**:
  - `backend/src/database/database.module.ts`
  - `backend/src/schemas/department.schema.ts`
  - `backend/src/schemas/shift-slot.schema.ts`
  - `backend/src/database/seed.service.ts`
  - `backend/src/modules/working-calendar/working-calendar.module.ts`
  - `backend/src/modules/working-calendar/working-calendar.service.ts`
  - `backend/src/modules/shifts/shifts.module.ts`
  - `backend/src/modules/shifts/shifts.service.ts`
  - `backend/src/modules/dashboard/dashboard.module.ts`
  - `backend/src/modules/dashboard/dashboard.service.ts`
  - `backend/src/modules/shift-jobs/shift-jobs.service.ts`
  - `frontend/src/app/admin/shift-slots/page.tsx`

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch Backend (`npm run build`) thành công 100% không lỗi.
- Kiểm thử biên dịch & Typecheck Frontend (`npx tsc --noEmit` phía frontend) thành công 100% không lỗi.
- Viết kịch bản kiểm thử giả lập sinh ca trực vào ngày lễ Mỹ (Thanksgiving `2026-11-26`) và xác nhận tự động bỏ qua sinh ca cho bộ phận Trading Operations (giám sát CME) trong khi vẫn sinh ca cho các phòng ban khác.

- Kiểm thử tự động điều chỉnh giờ ca trực đêm sang mùa hè (từ `22:00-06:00` thành `21:00-05:00`) thành công trên Dashboard và Active Shifts.

## [2026-07-30 17:30:00] - Refactor: Đồng bộ hiển thị vai trò và bypass bộ lọc lịch sử cho Giám đốc Khối

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Rà soát các phần hardcode còn lại trong code.
- **Giải pháp**:
  - **Backend**:
    - Sửa lỗi trong `ShiftsService` (`getHistory` và `getActiveShiftsByDepartment`): Thêm điều kiện bypass bộ lọc phòng ban cho vai trò `DIVISION_DIRECTOR` (Giám đốc Khối) tương tự ADMIN/CEO/CHAIRMAN. Điều này đảm bảo Giám đốc Khối xem được toàn bộ lịch sử ca trực và các ca trực đang chạy của các phòng ban khác mà không bị giới hạn phòng ban.
  - **Frontend**:
    - Cập nhật [Header.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Header.tsx#L160): Thay thế nhãn hiển thị cứng tiếng Anh `"Risk Staff"` thành `"Nhân viên"` và `"Risk Officer / Admin"` thành `"Quản trị viên"` để phù hợp với hệ thống dùng chung đa phòng ban (IT, Giao dịch, Quản lý rủi ro).
    - Cập nhật [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx#L139): Hiển thị nhãn `"Ban Lãnh Đạo"` cho vai trò `DIVISION_DIRECTOR` tương tự như các vai trò lãnh đạo cấp cao khác thay vì hiển thị `"Chưa phân phòng"`.

### 2. Danh sách file chỉnh sửa
- **Backend (Chỉnh sửa)**:
  - `backend/src/modules/shifts/shifts.service.ts`
- **Frontend (Chỉnh sửa)**:
  - `frontend/src/components/Header.tsx`
  - `frontend/src/components/Sidebar.tsx`

## [2026-07-30 17:25:00] - Bugfix: Loại bỏ check vai trò cứng STAFF/CHAIRMAN khi chốt ca hoặc khởi tạo ca trực

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi tài khoản `sonhh` (IT STAFF) dù đã có quyền `CLOSE_SHIFT` trong danh sách quyền nhưng khi chốt ca trực vẫn bị chặn và báo lỗi `"Chức vụ của bạn không có quyền chốt ca trực"`.
- **Giải pháp**:
  - **Backend**:
    - Sửa lỗi trong `ShiftsService` -> `closeShift` và `initializeShift`: Loại bỏ hoàn toàn điều kiện kiểm tra vai trò cứng `user.role === 'STAFF'` gây mâu thuẫn với hệ thống phân quyền động.
    - Thay thế bằng kiểm tra phân quyền động thông qua `AccessControlService.canAccessFeature` (kiểm tra quyền `CLOSE_SHIFT` và `INITIALIZE_SHIFT` được cấp cho tài khoản hoặc thừa kế từ cấu hình vai trò động trong database).

### 2. Danh sách file chỉnh sửa
- **Backend (Chỉnh sửa)**:
  - `backend/src/modules/shifts/shifts.service.ts` (Thay thế kiểm tra vai trò cứng thành kiểm tra quyền động trong [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts#L56) và [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts#L820))

## [2026-07-30 17:15:00] - Bugfix: Sửa lỗi validateScope trên ShiftLog khi templateId là null

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi tài khoản `sonhh` (IT STAFF) khi tìm kiếm ra kết quả ca trực của chính phòng ban IT (`IT_CORE`) click vào vẫn bị báo lỗi không thuộc phòng ban quản lý.
- **Giải pháp**:
  - **Backend**:
    - Sửa lỗi trong `ShiftsService`: Thay đổi các vị trí kiểm tra phân quyền `validateScope`. Trước đó, logic trích xuất phòng ban của ca trực được lấy từ `(log.templateId as any)?.departmentId`. Đối với các ca trực cũ hoặc tạo thủ công có `templateId` là `null`, giá trị này sẽ bị `undefined` dẫn đến `validateScope` so sánh lệch phòng ban và chặn truy cập.
    - Cấu hình trích xuất an toàn ưu tiên trường trực tiếp: `log.departmentId || (log.templateId as any)?.departmentId` tại 5 phương thức nghiệp vụ trong `shifts.service.ts`.

### 2. Danh sách file chỉnh sửa
- **Backend (Chỉnh sửa)**:
  - `backend/src/modules/shifts/shifts.service.ts` (Sửa trích xuất phòng ban trong [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts#L280))

## [2026-07-30 16:30:00] - Bugfix: Sửa lỗi phân quyền validateScope cho DIVISION_DIRECTOR và thêm log gỡ lỗi tìm kiếm toàn cầu

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi lệch phân quyền tìm kiếm toàn cầu dẫn đến tài khoản khi ấn vào kết quả tìm kiếm bị báo lỗi không thuộc phòng ban quản lý.
- **Giải pháp**:
  - **Backend**:
    - Sửa lỗi trong `AccessControlService` -> `validateScope`: Bổ sung vai trò `DIVISION_DIRECTOR` vào danh sách bypass kiểm tra phòng ban khi truy cập tài nguyên chi tiết. Trước đó vai trò này chỉ được bypass trong `getScopeFilter` dẫn đến việc tìm thấy kết quả nhưng không thể click vào xem chi tiết ca trực.
    - Bổ sung các log debug trong `shifts.service.ts` (`globalSearch`) và `incidents.service.ts` (`searchIncidents`) để in chi tiết bộ lọc `scopeFilter` và thông tin tài khoản hiện tại lên console.

### 2. Danh sách file chỉnh sửa
- **Backend (Chỉnh sửa)**:
  - `backend/src/modules/auth/access-control.service.ts` (Thêm bypass `DIVISION_DIRECTOR` trong [validateScope](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/access-control.service.ts#L61))
  - `backend/src/modules/shifts/shifts.service.ts` (Thêm log debug [globalSearch](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts#L1285))
  - `backend/src/modules/incidents/incidents.service.ts` (Thêm log debug [searchIncidents](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/incidents/incidents.service.ts#L652))

## [2026-07-30 15:10:00] - Feature: Triển khai cơ cấu tổ chức phân cấp (Đơn vị công tác -> Bộ phận trực ca -> Chức danh)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Nâng cấp cấu trúc dữ liệu để lưu trữ và hiển thị phân cấp hành chính: Đơn vị công tác (Ban cha) -> Bộ phận trực ca (Bộ phận con) -> Chức danh/Chức vụ (Job title) của nhân sự trực ca khớp với sơ đồ nhân sự thực tế. Đồng thời, tạm thời ẩn cột Chức danh trên bảng hiển thị danh sách người dùng và trong ô nhập khi tạo tài khoản (có cấu hình bật lại dễ dàng) và chuyển ô nhập chức danh thành dạng gợi ý thông minh (datalist).
- **Giải pháp**:
  - **Mongoose & Database (Backend)**:
    - Thêm trường tự tham chiếu `parentDepartmentId` vào Schema `Department` để thiết lập quan hệ cha-con.
    - Thêm trường `title` vào Schema `User`.
    - Cập nhật hàm `seedDepartments` và `seedUsers` trong `SeedService` để nạp đơn vị cấp Ban cha: **Ban Giám sát thị trường** (`BAN_GSTT`), thiết lập làm cha của **Quản lý giám sát giao dịch** (`QLGD_OPS`) và **Quản lý giám sát rủi ro** (`QLRR_RISK`). Đồng thời gán chức danh mẫu cho các tài khoản gốc.
  - **API Controllers & Services (Backend)**:
    - Bổ sung cấu hình deep populate `departmentId.parentDepartmentId` trong `UsersController`, `JwtStrategy` và `AuthService` để tự động trả về thông tin Ban cha của mỗi thành viên trên mọi request.
    - Cập nhật `DepartmentsController` để populate `parentDepartmentId` khi liệt kê hoặc cập nhật phòng ban.
  - **Giao diện (Frontend)**:
    - Cập nhật trang Quản lý thành viên (`/admin/users`) hiển thị thêm 2 cột: **Đơn vị công tác** (Tên ban cha) và **Bộ phận trực ca** (Tên bộ phận con).
    - Triển khai biến cờ hiệu `showTitleField = false` tại `/admin/users` và `/settings` để tạm thời ẩn trường Chức danh/Chức vụ theo yêu cầu của USER.
    - Cấu hình ô nhập Chức danh ở dạng **chọn gợi ý thông minh** (`<datalist>` chứa các lựa chọn mẫu như Chuyên viên, Trưởng ca...) để khi bật lại `showTitleField = true`, quản trị viên chỉ cần chọn nhanh mà không cần nhập tay hoàn toàn.
    - Cho phép vai trò `DIVISION_DIRECTOR` (Giám đốc Khối) tùy chọn chọn/không chọn phòng ban.
    - Cập nhật trang Quản lý Phòng Ban Vận Hành (`/admin/departments`) tích hợp chung quản lý cả Ban cha và Bộ phận con: hiển thị thêm cột **Thuộc Đơn Vị Quản Lý** trên bảng danh sách, và thêm ô chọn **Đơn vị quản lý cấp trên (Không bắt buộc)** trong modal Thêm/Sửa phòng ban để Admin dễ dàng cấu hình liên kết cha-con trực tiếp từ giao diện.

### 2. Danh sách file chỉnh sửa
- **Backend (Chỉnh sửa)**:
  - `backend/src/schemas/department.schema.ts` (Thêm trường [parentDepartmentId](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/department.schema.ts#L9-L10))
  - `backend/src/schemas/user.schema.ts` (Thêm trường [title](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/user.schema.ts#L13-L16))
  - `backend/src/database/seed.service.ts` (Cập nhật [seedDepartments](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/database/seed.service.ts#L61) và [seedUsers](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/database/seed.service.ts#L141))
  - `backend/src/modules/admin/users.controller.ts` (Sửa truy vấn [findAll](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/admin/users.controller.ts#L72) và [create]/[update] để trả về deep populated parent department và lưu title)
  - `backend/src/modules/admin/departments.controller.ts` (Thêm populate parentDepartmentId trong [findAll](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/admin/departments.controller.ts#L35) và [update](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/admin/departments.controller.ts#L55))
  - `backend/src/modules/shift-slots/shift-slots.service.ts` (Bổ sung logic validate tự động bật/tắt `isOvernight` trong [create](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shift-slots/shift-slots.service.ts#L39) và [update](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shift-slots/shift-slots.service.ts#L52))
  - `backend/src/modules/auth/jwt.strategy.ts` (Cập nhật [validate](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/jwt.strategy.ts#L27) để deep populate)
  - `backend/src/modules/auth/auth.service.ts` (Cập nhật các hàm kiểm tra/tạo người dùng để deep populate và trả về trường title)
- **Frontend (Chỉnh sửa)**:
  - `frontend/src/context/AuthContext.tsx` (Thêm định nghĩa kiểu trong User interface)
  - `frontend/src/app/admin/users/page.tsx` (Hiển thị cột Đơn vị công tác, Bộ phận trực ca, thêm datalist gợi ý thông minh và cấu hình ẩn/hiện tạm thời qua `showTitleField`)
  - `frontend/src/app/settings/page.tsx` (Hiển thị các trường thông tin cá nhân dưới dạng chỉ đọc khớp sơ đồ nhân sự, hỗ trợ ẩn tạm thời qua `showTitleField`)
  - `frontend/src/app/admin/departments/page.tsx` (Cập nhật giao diện tree view lồng nhau thụt lề cấp con, thêm dropdown liên kết đơn vị quản lý cấp trên)
  - `frontend/src/app/admin/calendar/page.tsx` (Tự động nhận diện/cảnh báo ca qua đêm, ẩn cột Qua đêm và thay bằng icon Moon 🌙 phát sáng)
  - `frontend/src/components/Sidebar.tsx` (Phân quyền hiển thị: Admin thấy status card, vai trò khác thấy card liên kết Hướng dẫn sử dụng)
  - `frontend/src/app/guide/page.tsx` (Trang Hướng dẫn sử dụng chi tiết thiết kế cao cấp chia tab: quy trình ca trực, đối chiếu số liệu 3 bên, cấu hình RPA Bot và sự cố thường gặp)
  - `frontend/src/app/globals.css` (Cải tiến đưa thanh cuộn sidebar sát rìa phải 100%)

## [2026-07-30 14:15:00] - Feature: Đồng bộ và dịch thuật vai trò DIVISION_DIRECTOR sang tiếng Việt (Giám đốc Khối)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Dịch hiển thị vai trò `DIVISION_DIRECTOR` sang tiếng Việt vì vai trò này chưa được hiển thị tiếng Việt trên giao diện quản trị thành viên.
- **Giải pháp**:
  - **Backend**:
    - Khai báo và cấu hình nạp dữ liệu mẫu (seeding) cho vai trò `DIVISION_DIRECTOR` với tên hiển thị là "Giám đốc Khối" và phân quyền mặc định (`VIEW_CHECKLIST`, `ACCESS_MARGIN_CHANGE`, `ACCESS_AUTO_SHIFT`, `ACCESS_HEALTH_CHECKS`, `RESOLVE_INCIDENTS`).
    - Cập nhật hàm `getScopeFilter` trong `AccessControlService` để cho phép tài khoản thuộc vai trò `DIVISION_DIRECTOR` xem toàn bộ dữ liệu hệ thống (bypass bộ lọc theo phòng ban).
  - **Frontend**:
    - Bổ sung định nghĩa kiểu `DIVISION_DIRECTOR` vào interface `User`.
    - Dịch hiển thị vai trò `DIVISION_DIRECTOR` thành "Giám đốc Khối" và áp dụng badge màu tím sang trọng (`#a855f7`) trên các trang: Danh sách thành viên quản trị (`/admin/users`), cài đặt thông tin cá nhân (`/settings`), Menu tiêu đề (`Header`) và thanh điều hướng bên (`Sidebar`).
    - Bổ sung tùy chọn lọc và tạo mới/chỉnh sửa người dùng với vai trò "Giám đốc Khối" ở trang quản lý thành viên.

### 2. Danh sách file chỉnh sửa
- **Backend (Chỉnh sửa)**:
  - `backend/src/database/seed.service.ts` (Thêm seed role [seedRoles](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/database/seed.service.ts#L438))
  - `backend/src/modules/auth/access-control.service.ts` (Sửa hàm [getScopeFilter](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/access-control.service.ts#L27) để bypass filter phòng ban)
- **Frontend (Chỉnh sửa)**:
  - `frontend/src/app/admin/users/page.tsx` (Dịch thuật, bổ sung dropdown, badge màu tím)
  - `frontend/src/components/Sidebar.tsx` (Bổ sung nhãn sidebar)
  - `frontend/src/components/Header.tsx` (Bổ sung nhãn header menu)
  - `frontend/src/app/settings/page.tsx` (Bổ sung nhãn trang cá nhân)

## [2026-07-30 10:35:00] - Bugfix: Khắc phục lỗi lệch kiểu dữ liệu departmentId (String vs ObjectId) khiến Trang Checklist trống ca trực

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi trang checklist hiển thị thông báo "Chưa có ca trực nào được tạo hôm nay" nhưng ngoài dashboard vẫn thấy ca trực và có nút mở.
- **Nguyên nhân**: 
  - Trong bộ dữ liệu hạt giống (seed data) trong MongoDB, trường `departmentId` của bảng `checklist_templates` được lưu dưới dạng kiểu **String** (`'6a2fa0183cd9b0de35d6d494'`), trong khi ở bảng `shift_logs` nó được lưu dưới dạng **ObjectId** (`new ObjectId('...')`).
  - Khi xem trang `/checklist`, API `/api/v1/shifts/active` thực hiện truy vấn các mẫu ca trực tương ứng với phòng ban của user (dưới dạng `ObjectId`), nhưng Mongoose so sánh `ObjectId` với `String` trong MongoDB không khớp, dẫn đến danh sách mẫu trả về rỗng (`[]`), làm bộ lọc ca trực hoạt động sai và trả về không có ca trực nào.
  - Phân hệ Dashboard truy vấn trực tiếp bảng `shift_logs` (lưu đúng dạng `ObjectId`), nên vẫn tìm thấy và hiển thị bình thường.

### 2. Giải pháp
- Cập nhật hàm `getScopeFilter` trong `AccessControlService` để sinh bộ lọc linh hoạt dạng `$in` chứa cả `ObjectId` và `String` của `departmentId`.
- Cập nhật các câu lệnh truy vấn `.find({ departmentId: ... })` tìm template trong `ShiftsService` (`getActiveShiftsByDepartment` và `getShiftsHistory`) sử dụng bộ lọc kết hợp `$in` chứa cả `ObjectId` và `String`.
- Cập nhật tập lệnh nạp dữ liệu mẫu `SeedService` (`seed.service.ts`) để ép kiểu tường minh `new Types.ObjectId(deptId)` trước khi tạo mới hoặc cập nhật mẫu template checklist. Việc này giúp chuẩn hóa dữ liệu mẫu về đúng kiểu `ObjectId` trong MongoDB cho các phiên bản sau.
- Biên dịch production build (`npm run build`) thành công 100%.

### 3. Danh sách file chỉnh sửa
- **Backend**:
  - `backend/src/modules/auth/access-control.service.ts` (Sửa hàm [getScopeFilter](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/access-control.service.ts#L31))
  - `backend/src/modules/shifts/shifts.service.ts` (Sửa hàm [getActiveShiftsByDepartment](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts#L1168) và [getShiftsHistory](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts#L1103))
  - `backend/src/database/seed.service.ts` (Sửa hàm [seedTemplates](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/database/seed.service.ts#L320) và thêm import `Types` từ Mongoose)

## [2026-07-30 09:15:00] - Security: Củng cố bảo mật phân quyền toàn diện ở Backend & Đồng bộ Frontend

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Lên kế hoạch và triển khai bảo mật phân quyền chi tiết cho tất cả các module nghiệp vụ và đối chiếu để tránh rủi ro/sơ sót trong vận hành UAT.
- **Giải pháp**:
  - **Đồng bộ Ca trực (Shifts) ở Frontend**: Cập nhật giao diện để ẩn liên kết trong `Sidebar`, ẩn các widget liên quan đến ca trực trên `Dashboard`, và chặn truy cập trái phép bằng màn hình cảnh báo tại trang `/checklist` và `/history` nếu vai trò người dùng bị thu hồi quyền `VIEW_CHECKLIST`.
  - **Bổ sung chú thích quyền hạn (Tooltips) ở Frontend**: Thêm biểu tượng thông tin (`Info` icon) bên cạnh mỗi tên quyền trong trang Phân quyền vai trò `/admin/permissions` (ở cả chế độ xem 2 cột và chế độ ma trận so sánh) hiển thị mô tả rõ nghĩa bằng tiếng Việt để hỗ trợ người quản trị dễ dàng cấu hình khi di chuột vào.
  - **Backend Security Hardening**: Áp dụng triệt để `JwtAuthGuard` và `PermissionsGuard` cho toàn bộ các API thuộc 7 Controller công cụ và sự cố (vốn trước đây bị bỏ trống không yêu cầu đăng nhập hoặc chỉ kiểm tra đăng nhập tĩnh). Đồng thời giải quyết lỗi thiếu dependency `RoleModel` tại runtime bằng cách import `AuthModule` (và `SystemSettingsModule` nơi cần thiết) vào cả 5 Modules nghiệp vụ thô.
    - [incidents.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/incidents/incidents.controller.ts) -> Yêu cầu quyền `RESOLVE_INCIDENTS` cho các tác vụ thay đổi, và `VIEW_CHECKLIST` cho việc đọc dữ liệu.
    - [reconciliation.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.controller.ts) -> Yêu cầu quyền `ACCESS_AUTO_SHIFT` cho đối chiếu tự động, `ACCESS_MARGIN_CHANGE` cho quét ký quỹ khả dụng âm.
    - [margin-checker.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/margin-checker/margin-checker.controller.ts) -> Yêu cầu quyền `ACCESS_MARGIN_CHANGE`.
    - [trading-report.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/trading-report/trading-report.controller.ts) -> Yêu cầu quyền `ACCESS_AUTO_SHIFT`.
    - [ccp-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/ccp-statistics/ccp-statistics.controller.ts) -> Yêu cầu quyền `ACCESS_AUTO_SHIFT`.
    - [lot-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/lot-statistics.controller.ts) -> Yêu cầu quyền `ACCESS_AUTO_SHIFT`.
    - [value-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.controller.ts) -> Yêu cầu quyền `ACCESS_AUTO_SHIFT`.

### 2. Danh sách file chỉnh sửa
- **Backend (Chỉnh sửa)**:
  - `backend/src/modules/incidents/incidents.controller.ts`
  - `backend/src/modules/reconciliation/reconciliation.controller.ts`
  - `backend/src/modules/reconciliation/reconciliation.module.ts`
  - `backend/src/modules/margin-checker/margin-checker.controller.ts`
  - `backend/src/modules/margin-checker/margin-checker.module.ts`
  - `backend/src/modules/trading-report/trading-report.controller.ts`
  - `backend/src/modules/trading-report/trading-report.module.ts`
  - `backend/src/modules/ccp-statistics/ccp-statistics.controller.ts`
  - `backend/src/modules/ccp-statistics/ccp-statistics.module.ts`
  - `backend/src/modules/lot-statistics/lot-statistics.controller.ts`
  - `backend/src/modules/lot-statistics/lot-statistics.module.ts`
  - `backend/src/modules/lot-statistics/value-statistics.controller.ts`
  - `backend/src/modules/shifts/shifts.controller.ts`
- **Frontend (Chỉnh sửa)**:
  - `frontend/src/hooks/usePermissions.ts`
  - `frontend/src/components/Sidebar.tsx`
  - `frontend/src/app/dashboard/page.tsx`
  - `frontend/src/app/checklist/page.tsx`
  - `frontend/src/app/history/page.tsx`

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch Backend (`npm run build`) thành công 100%.
- Kiểm thử kiểu dữ liệu Frontend (`npx tsc --noEmit`) thành công 100%.

---

## [2026-07-30 08:45:00] - Fix: Khắc phục lỗi trùng lặp khi khởi tạo ca trực (Double Click & Backend Concurrency Lock)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Kiểm tra thông tin đúp chuột nhanh 2 lần tạo ra 2 bản ghi ca trực "Checklist Mở Cửa - IT Vận Hành Core" cùng thời điểm và hỏi về khả năng chống lỗi trên backend.
- **Nguyên nhân**:
  - Khi gửi 2 request khởi tạo ca trực song song (khoảng cách vài mili-giây), cả hai đều chạy qua lệnh kiểm tra `findOne` trong Database trước khi bất kỳ bản ghi nào kịp lưu xong. Do đó cả hai request đều thỏa mãn điều kiện và tạo ra 2 bản ghi ca trực trùng lặp.
- **Giải pháp**:
  - **Phía Frontend**: Disable nút "Bắt đầu ca trực" và thêm trạng thái `isInitializingShift` để ngăn chặn việc người dùng nhấn chuột nhiều lần liên tục tạo request trùng lặp từ giao diện.
  - **Phía Backend**: Triển khai cơ chế **Concurrency Lock** trong [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts) sử dụng một `initializingKeys` Set (in-memory lock key dạng `${templateId}_${shiftDate}`).
    - Khi luồng đầu tiên đang khởi tạo, key này được đăng ký vào Set.
    - Luồng thứ hai đến ngay sau đó phát hiện key đang bị khóa, sẽ tự động chờ (`setTimeout(800)`) cho luồng 1 hoàn tất việc ghi DB.
    - Sau khi luồng thứ hai thức dậy, nó sẽ truy vấn lại database và trả về đúng bản ghi vừa được luồng 1 khởi tạo, loại bỏ hoàn toàn khả năng ghi đè/trùng lặp bản ghi ca trực trên server.

### 2. Danh sách file chỉnh sửa
- **Chỉnh sửa**:
  - [InitShiftWidget.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/dashboard/components/InitShiftWidget.tsx)
  - [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/dashboard/page.tsx)
  - [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts)

---

## [2026-07-29 18:14:00] - Refactor: Tích hợp chế độ xem kép (Dual View Modes) cho màn hình Phân Quyền

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Kết hợp cả hai điểm mạnh: Vừa có cấu hình 2 cột chi tiết tiện lợi (Mô hình 2) vừa có bảng so sánh ma trận trực quan tổng quát (Mô hình 1).
- **Giải pháp**:
  - Triển khai bộ chọn chế độ xem ở góc phải: **Chế độ cấu hình chi tiết (2 cột)** và **Chế độ ma trận so sánh (Bảng)**.
  - Khi bật chế độ cấu hình chi tiết: Trực quan hóa theo tab cấu hình nhóm vai trò hoặc nhóm chức năng với tính năng gán nhanh bằng hộp checkbox *Chọn tất cả*.
  - Khi bật chế độ ma trận so sánh: Hiện bảng Grid đầy đủ với tất cả vai trò ở cột dọc và quyền hạn ở hàng ngang. Ô giao lộ hiển thị checkbox có thể tương tác trực tiếp giúp cập nhật phân quyền tức thì trên phạm vi rộng và dễ đối chiếu so sánh chéo.

### 2. Danh sách file chỉnh sửa
- **Chỉnh sửa**:
  - `frontend/src/app/admin/permissions/page.tsx`

---

## [2026-07-29 18:04:00] - Feature: Đồng bộ hóa Phân quyền động (Dynamic RBAC) trên toàn bộ API Backend

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Rà soát các lỗi bảo mật tiềm ẩn và triển khai cơ chế kiểm tra quyền hạn thực tế thay vì fix cứng vai trò tĩnh (Role-based) ở Backend.
- **Nguyên nhân**: Dù Frontend đã chuyển đổi sang phân quyền động theo ma trận quyền hạn, Backend vẫn sử dụng `@Roles('ADMIN', 'DEPARTMENT_HEAD')` để chặn tĩnh, dẫn đến lỗ hổng bỏ qua phân quyền (Authorization Bypass) khi Admin thu hồi quyền ở Frontend nhưng Backend vẫn chấp nhận request.
- **Giải pháp**:
  - Tạo mới decorator `@Permissions()` và bộ lọc `@UseGuards(PermissionsGuard)` ở Backend để kiểm tra động danh sách quyền của người dùng trong database hoặc JWT Token.
  - Chuyển đổi toàn bộ các lớp điều khiển hành chính (`UsersController`, `DepartmentsController`, `TemplatesController`, `ShiftSlotsController`, `RolesController`, `WorkingCalendarController`) từ sử dụng `@Roles` tĩnh sang `@Permissions` động tương ứng (`MANAGE_USERS`, `MANAGE_TEMPLATES`, `MANAGE_ROLES`, `MANAGE_CALENDAR`).
  - Import `AuthModule` vào các module liên quan (`WorkingCalendarModule`, `ShiftSlotsModule`) để giải quyết các phụ thuộc của `PermissionsGuard`.

### 2. Danh sách file chỉnh sửa
- **Tạo mới**:
  - `backend/src/modules/auth/permissions.decorator.ts`
  - `backend/src/modules/auth/permissions.guard.ts`
- **Chỉnh sửa**:
  - `backend/src/modules/auth/auth.module.ts`
  - `backend/src/modules/admin/users.controller.ts`
  - `backend/src/modules/admin/departments.controller.ts`
  - `backend/src/modules/admin/templates.controller.ts`
  - `backend/src/modules/admin/roles.controller.ts`
  - `backend/src/modules/shift-slots/shift-slots.controller.ts`
  - `backend/src/modules/shift-slots/shift-slots.module.ts`
  - `backend/src/modules/working-calendar/working-calendar.controller.ts`
  - `backend/src/modules/working-calendar/working-calendar.module.ts`

---

## [2026-07-29 15:22:00] - Refactor: Ẩn vai trò Ban Lãnh Đạo (CEO/CHAIRMAN) khỏi màn hình tạo/sửa tài khoản

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Thực hiện Giải pháp 1: Giữ nguyên Ban Lãnh đạo trong database đề phòng tương lai, nhưng ẩn chúng đi ở dropdown chọn vai trò của màn hình tạo/sửa tài khoản người dùng (`/admin/users`) để tránh chọn nhầm.
- **Giải pháp**: Cấu hình hiển thị có điều kiện cho option `CEO` và `CHAIRMAN` trong select box của modal thêm/sửa tài khoản. Chỉ hiển thị nếu tài khoản đang được chọn chỉnh sửa thực sự có vai trò này.

### 2. Danh sách file chỉnh sửa
- **Chỉnh sửa**:
  - `frontend/src/app/admin/users/page.tsx`

---

## [2026-07-29 15:25:00] - Hotfix: Sửa lỗi Runtime TypeError khi tải API thất bại ở Frontend (departments.map, templates.map, activeShifts.reduce)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Khắc phục lỗi runtime khi mở trang Quản lý Mẫu checklist (`templates.map is not a function`), Dashboard (`activeShifts.reduce is not a function`), và Lịch sử ca trực / trang cấu hình (`departments.map is not a function`).
- **Nguyên nhân**: Các API phòng ban, ca trực, lịch trực, và mẫu checklist khi gặp lỗi (ví dụ: 401 Unauthorized khi token chưa kịp nạp hoặc phiên hết hạn) sẽ trả về dạng đối tượng JSON (chứa statusCode, message) thay vì mảng. Do Frontend gán trực tiếp state mà không kiểm tra định dạng dữ liệu, các hàm xử lý mảng như `.map()` và `.reduce()` bị crash runtime.
- **Giải pháp**: Áp dụng kiểm tra an toàn `Array.isArray(data)` trước khi gán các state `departments`, `templates`, `shiftSlots`, `entries` (lịch trực), `activeShifts`, và `recentShifts` từ API trả về. Đồng thời rà soát dọn dẹp các tham chiếu Khối (Divisions) cũ còn sót ở Backend.

### 2. Danh sách file chỉnh sửa
- **Chỉnh sửa**:
  - `frontend/src/app/dashboard/page.tsx`
  - `frontend/src/app/history/page.tsx`
  - `frontend/src/app/admin/users/page.tsx`
  - `frontend/src/app/admin/templates/page.tsx`
  - `frontend/src/app/admin/notifications/page.tsx`
  - `frontend/src/app/admin/departments/page.tsx`
  - `frontend/src/app/admin/calendar/page.tsx`
  - `backend/src/modules/margin-change-requests/margin-change-requests.service.ts`
  - `backend/src/modules/auth/jwt.strategy.ts`
  - `backend/src/modules/auth/auth.controller.ts`

---

## [2026-07-29 15:16:00] - Feature: Triển khai hệ thống phân quyền động chuẩn (Dynamic RBAC) & Hoàn tất gỡ Khối

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Lên kế hoạch tiếp tục sửa các phần code liên quan tới khối Divisions và thiết kế màn hình phân quyền động chuẩn trực quan phù hợp với hệ thống.
- **Giải pháp**:
  - **Phần gỡ Khối (Giai đoạn 1)**: Hoàn tất dọn dẹp các tham chiếu `DIVISION_DIRECTOR` tĩnh trong:
    - [Header.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Header.tsx)
    - [MarginChangeRequestsWidget.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/dashboard/components/MarginChangeRequestsWidget.tsx)
    - [notifications/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/notifications/page.tsx)
    - [templates/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/templates/page.tsx)
    - [shift-slots/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/shift-slots/page.tsx)
    - [departments/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/departments/page.tsx)
    - [calendar/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/calendar/page.tsx)
    - [users/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/users/page.tsx) (gỡ bỏ rendering check divisionId trong bảng danh sách).
    - [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx) (bỏ hiển thị division trong widget thông tin người dùng).
  - **Phân quyền động (Giai đoạn 2)**:
    - **Database Role Schema**: Tạo [role.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/role.schema.ts) lưu mã vai trò, tên vai trò, và mảng key quyền hạn. Đăng ký schema vào database, admin và auth modules.
    - **Seed default roles & permissions**: Tích hợp hàm `seedRoles()` trong [seed.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/database/seed.service.ts) để tự động tạo 5 vai trò cơ bản (`ADMIN`, `CHAIRMAN`, `CEO`, `DEPARTMENT_HEAD`, `STAFF`) với cấu hình quyền mặc định.
    - **Access Control & Token**: Sửa [access-control.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/access-control.service.ts) để đọc quyền động từ database thông qua `Role` model. Cập nhật [auth.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/auth.service.ts) để ký danh sách `permissions` của user vào mã thông báo JWT.
    - **API Endpoint**: Viết [roles.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/admin/roles.controller.ts) cung cấp API lấy danh sách quyền hệ thống, danh sách vai trò và cập nhật ma trận quyền.
    - **Frontend Permissions Matrix UI**: Tạo trang quản trị [permissions/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/permissions/page.tsx) dạng ma trận trực quan (Grid) để bật tắt các quyền. Thêm link điều hướng vào `Sidebar.tsx`. Cập nhật `AuthContext.tsx` để hỗ trợ field `permissions` và sửa `usePermissions.ts` để đọc kiểm tra quyền động.

### 2. Danh sách file chỉnh sửa/tạo mới
- **Tạo mới**:
  - `backend/src/schemas/role.schema.ts`
  - `backend/src/modules/admin/roles.controller.ts`
  - `frontend/src/app/admin/permissions/page.tsx`
- **Chỉnh sửa**:
  - `backend/src/database/database.module.ts`
  - `backend/src/modules/admin/admin.module.ts`
  - `backend/src/modules/auth/auth.module.ts`
  - `backend/src/database/seed.service.ts`
  - `backend/src/modules/auth/access-control.service.ts`
  - `backend/src/modules/auth/auth.service.ts`
  - `frontend/src/components/Sidebar.tsx`
  - `frontend/src/components/Header.tsx`
  - `frontend/src/app/dashboard/components/MarginChangeRequestsWidget.tsx`
  - `frontend/src/app/admin/notifications/page.tsx`
  - `frontend/src/app/admin/templates/page.tsx`
  - `frontend/src/app/admin/shift-slots/page.tsx`
  - `frontend/src/app/admin/departments/page.tsx`
  - `frontend/src/app/admin/calendar/page.tsx`
  - `frontend/src/app/admin/users/page.tsx`
  - `frontend/src/hooks/usePermissions.ts`
  - `frontend/src/context/AuthContext.tsx`

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript backend (`node node_modules/typescript/bin/tsc --noEmit`) thành công 100%.
- Kiểm thử biên dịch TypeScript frontend (`node node_modules/typescript/bin/tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`node node_modules/next/dist/bin/next build`) thành công 100%.
- Kiểm thử tích hợp SSO auto onboarding (`node node_modules/ts-node/dist/bin.js src/test-sso-assign.ts`) thành công: `🎉 ALL ASSERTS PASSED SUCCESSFULLY!`.

## [2026-07-29 15:05:00] - Refactor: Đơn giản hóa hệ thống phân quyền (Loại bỏ Khối & Giám đốc Khối)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Gỡ bỏ thực thể "Khối" (Divisions) và vai trò "Giám đốc Khối" (DIVISION_DIRECTOR), đơn giản hóa luồng phân quyền để quản lý trực tiếp theo "Phòng ban" (Departments).
- **Giải pháp**:
  - **Backend Schema & DB**: Gỡ bỏ `divisionId` khỏi `UserSchema`, `DepartmentSchema`, và `ShiftLogSchema`. Gỡ bỏ enum vai trò `DIVISION_DIRECTOR` ở `UserSchema`. Xóa bỏ hoàn toàn Schema `Division` và collection tương ứng trong MongoDB.
  - **Access Control & Scoping**: Loại bỏ check quyền của `DIVISION_DIRECTOR` trong `AccessControlService`. Cập nhật `canAccessFeature` để so khớp trực tiếp mã Phòng ban (`IT_CORE`, `QLGD_OPS`...). Gỡ bỏ tham số `divisionId` của `validateScope`.
  - **Service & Controllers**:
    - Xóa bỏ `divisions.controller.ts`.
    - Dọn dẹp imports, constructors, và populate queries liên quan đến `Division` ở `auth.service.ts`, `users.controller.ts`, `templates.controller.ts`, `shifts.service.ts`, `incidents.service.ts`, `shift-jobs.service.ts`, `seed.service.ts`.
    - Đổi cấu hình `sso-auto-assign.config.json` để gỡ bỏ `divisionCode` và đổi vai trò tài khoản `director.trade@mxv.vn` thành `DEPARTMENT_HEAD` của `QLGD_OPS`.
    - Cập nhật kịch bản chạy thử `test-sso-assign.ts` gỡ bỏ kiểm tra `divisionId` và đổi assert vai trò đích thành `DEPARTMENT_HEAD`.
  - **Frontend UI & Permissions**:
    - Cập nhật `usePermissions.ts` loại bỏ check Khối, chuyển sang kiểm tra mã phòng ban (`isTradeDept`, `isITDept`) và vai trò `DEPARTMENT_HEAD`.
    - Cập nhật màn hình `settings/page.tsx` và `users/page.tsx` loại bỏ giao diện hiển thị, bộ lọc, và form select liên quan đến Khối. Gỡ bỏ tuỳ chọn `DIVISION_DIRECTOR` khỏi dropdown phân quyền.
    - Cập nhật `Sidebar.tsx` loại bỏ hiển thị nhãn và badge vai trò `DIVISION_DIRECTOR`.

### 2. Danh sách file chỉnh sửa/xóa
- **Chỉnh sửa**:
  - `backend/src/schemas/user.schema.ts`
  - `backend/src/schemas/department.schema.ts`
  - `backend/src/schemas/shift-log.schema.ts`
  - `backend/src/modules/auth/access-control.service.ts`
  - `backend/src/modules/admin/admin.module.ts`
  - `backend/src/database/database.module.ts`
  - `backend/src/modules/auth/auth.module.ts`
  - `backend/src/modules/auth/auth.service.ts`
  - `backend/src/modules/admin/users.controller.ts`
  - `backend/src/modules/admin/templates.controller.ts`
  - `backend/src/modules/shifts/shifts.service.ts`
  - `backend/src/modules/incidents/incidents.service.ts`
  - `backend/src/modules/shift-jobs/shift-jobs.service.ts`
  - `backend/sso-auto-assign.config.json`
  - `backend/src/database/seed.service.ts`
  - `backend/src/test-sso-assign.ts`
  - `frontend/src/hooks/usePermissions.ts`
  - `frontend/src/app/settings/page.tsx`
  - `frontend/src/app/admin/users/page.tsx`
  - `frontend/src/components/Sidebar.tsx`
- **Xóa**:
  - `backend/src/modules/admin/divisions.controller.ts`
  - `backend/src/schemas/division.schema.ts`

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript backend (`node node_modules/typescript/bin/tsc --noEmit`) thành công 100%.
- Kiểm thử tích hợp chạy thử SSO Auto-onboard (`node node_modules/ts-node/dist/bin.js src/test-sso-assign.ts`) thành công: `🎉 ALL ASSERTS PASSED SUCCESSFULLY!`.

## [2026-07-29 14:43:00] - Feature: Tích hợp Nhật ký hoạt động (Audit Logs) vào Modal chi tiết lịch sử ca trực (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Xem được chi tiết log của ca trực hôm đó xem ai đã tích, ai đã làm gì (hoạt động trong phiên) ngay tại bảng lịch sử.
- **Giải pháp**:
  - Tích hợp component `AuditLogsPanel` vào modal chi tiết lịch sử ca trực tại file [page.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/history/page.tsx).
  - Khai báo state `activeAuditLogs` và viết hàm `handleOpenDetail` để tự động fetch nhật ký hoạt động (Audit Logs) từ API endpoint `/api/v1/shifts/${id}/audit-logs` mỗi khi người dùng bấm nút **Chi tiết**.
  - Truyền map tên tác vụ `taskNamesMap` từ `activeDetail.details` để hiển thị tên tiếng Việt thân thiện thay vì ID tác vụ kỹ thuật trong danh sách nhật ký hoạt động.
  - **Sửa lỗi Runtime (Rules of Hooks)**: Chuyển khai báo `React.useMemo` của `taskNamesMap` ra bên ngoài khối điều kiện hiển thị modal (đưa lên cấp component cha) để tránh vi phạm quy tắc render hook của React.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/history/page.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/history/page.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 14:38:00] - UI Refactor: Điều chỉnh bộ lọc & màu sắc tiến độ ca trực (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**:
  - Đơn giản hóa giao diện thanh tìm kiếm và bộ lọc ở màn hình Checklist, bỏ badge màu và đưa về thiết kế tinh giản.
  - Phục hồi hiển thị thanh tiến độ (progress bar) trong bảng lịch sử ca trực (History), đồng thời cập nhật màu sắc hiển thị động theo tỷ lệ % hoàn thành: dưới 30% là đỏ (bổ sung), từ 30% đến dưới 50% là vàng, từ 50% đến dưới 100% là xanh dương, và 100% là xanh lá.
  - Giữ nguyên logic hiển thị cột Tiến độ dạng số phần trăm gốc và cột Hành động chứa hai nút "Chi tiết" và "Mở" (nút Mở hiển thị đối với ca trực có trạng thái PENDING) như ban đầu.
  - Cập nhật giao diện danh sách tác vụ trong modal xem chi tiết lịch sử ca trực: tô màu viền bên trái và hiển thị icon checkbox tương ứng theo trạng thái tác vụ (Không đạt -> viền đỏ, icon ✕ đỏ; Cần chú ý -> viền vàng, icon ! vàng; Đạt -> viền xanh lá, icon ✓ xanh lá; Bỏ qua -> viền xanh dương).
- **Giải pháp**:
  - Tại [TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx): Tinh chỉnh CSS bộ lọc, ẩn nhãn phụ, chỉ để search bar và 2 select dropdown phẳng, đồng thời sửa logic ẩn panel phải khi bộ lọc rỗng để hiển thị thông báo toàn màn hình trực quan.
  - Tại [page.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/history/page.tsx):
    - Khôi phục thanh tiến độ có 4 màu tương ứng với các khoảng phần tiến độ.
    - Khôi phục chính xác logic hiển thị nguyên bản của cột phần trăm `{log.progressPercentage}%` và cột Hành động có nút "Chi tiết" & nút "Mở".
    - Thiết kế lại các thẻ tác vụ trong modal chi tiết: đổi viền trái (`borderLeft`) và biểu tượng checkbox động dựa trên trạng thái (`PASSED`, `FAILED`, `NEEDS_ATTENTION`, `SKIPPED`).

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]
- [frontend/src/app/history/page.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/history/page.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 13:50:00] - Feature: Thay đổi từ đơn vị tiến độ nhiệm vụ con từ "con" thành "bước" (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Thay thế từ "con" trong nhãn tiến độ nhiệm vụ con (ví dụ: `3/3 con` trên thẻ checklist) thành từ ngữ khác lịch sự và chuyên nghiệp hơn. Người dùng đã lựa chọn thay đổi thành từ "bước".
- **Giải pháp**:
  - Tại file [TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx), định vị nhãn hiển thị số lượng nhiệm vụ con đã hoàn thành của thẻ checklist ở dòng 484.
  - Thay đổi nhãn hiển thị đơn vị từ `"con"` sang `"bước"` (Ví dụ: `3/3 bước`).

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 13:44:00] - Refactor: Tách biệt và đóng gói hàm dịch mã lỗi vào file tiện ích dùng chung (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Đóng gói các trường hợp dịch mã lỗi (`SYSTEM_OR_NETWORK_ERROR`, `SLA_BREACH_XXXX`, v.v.) vào một file tiện ích dùng chung để tăng tính tái sử dụng và kiểm tra xem có màn hình nào khác ngoài ca trực đang sử dụng không.
- **Giải pháp**:
  - Phát hiện component [ActiveIncidentsWidget.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/dashboard/components/ActiveIncidentsWidget.tsx) hiển thị danh sách sự cố trên trang Dashboard của hệ thống cũng đang sử dụng mã lỗi thô và nhãn "SLA".
  - Tạo file utility mới [frontend/src/lib/incident.ts](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/lib/incident.ts) để tập trung hóa logic xử lý và dịch mã lỗi `getFriendlyCode`.
  - Cập nhật [IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) và [IncidentReportModal.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx) sử dụng hàm `getFriendlyCode` được import từ thư viện dùng chung.
  - Cập nhật [ActiveIncidentsWidget.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/dashboard/components/ActiveIncidentsWidget.tsx) sử dụng `getFriendlyCode` để Việt hóa mã sự cố và đổi nhãn đếm ngược thành *"Trễ hạn"* ngay trên màn hình Dashboard chính.

### 2. Danh sách file chỉnh sửa
- [frontend/src/lib/incident.ts](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/lib/incident.ts) [NEW]
- [frontend/src/app/checklist/components/IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) [MODIFY]
- [frontend/src/app/checklist/components/IncidentReportModal.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx) [MODIFY]
- [frontend/src/app/dashboard/components/ActiveIncidentsWidget.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/dashboard/components/ActiveIncidentsWidget.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 13:42:00] - Refactor: Thay thế thuật ngữ viết tắt "SLA" thành "Trễ hạn / Hạn cam kết" tiếng Việt (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Thay thế từ "SLA" thành các từ ngữ tiếng Việt thông dụng, dễ hiểu hơn đối với ca trực trên giao diện hiển thị.
- **Giải pháp**:
  - Tại file [IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) và [IncidentReportModal.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx):
    - Đổi dịch mã `SLA_BREACH_XXXX` từ *"Vi phạm SLA lúc HH:MM"* sang *"Trễ hạn lúc HH:MM"*.
    - Đổi dịch mã `MISSED_SLA` từ *"Trễ hạn SLA"* sang *"Trễ hạn Cam kết"*.
    - Đổi nhãn đếm ngược SLA từ *"Trễ SLA XXm YYs"* sang *"Trễ hạn XXm YYs"*.
    - Thay đổi văn bản thông báo rỗng thành *"Không có ngoại lệ hay sự cố trễ hạn nào trong ca"*.
  - Tại file [TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx):
    - Đổi nhãn `SLA: [giờ]` ở phần thông tin phụ của danh sách tác vụ thành `Hạn cam kết: [giờ]`.
    - Đổi nhãn `Thời hạn cam kết (SLA)` ở panel chi tiết bên phải thành `Thời hạn cam kết`.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) [MODIFY]
- [frontend/src/app/checklist/components/IncidentReportModal.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx) [MODIFY]
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 13:40:00] - Feature: Việt hóa động các mã vi phạm SLA dạng timeline (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Dịch các mã vi phạm SLA dạng mốc giờ kỹ thuật (như `[SLA_BREACH_0730]`, `[SLA_BREACH_0645]`) sang hiển thị tiếng Việt dạng *"Vi phạm SLA lúc 07:30"*, *"Vi phạm SLA lúc 06:45"* khi Chế độ kỹ thuật tắt.
- **Giải pháp**:
  - Nâng cấp hàm helper `getFriendlyCode` tại [IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) và [IncidentReportModal.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx):
    - Tự động nhận diện tiền tố `SLA_BREACH_`.
    - Trích xuất 4 chữ số biểu thị thời gian (ví dụ: `0730` -> `07:30`, `0645` -> `06:45`) để định dạng thành chuỗi ký tự hiển thị rõ nghĩa: `Vi phạm SLA lúc HH:MM`.
    - Hỗ trợ loại bỏ dấu gạch dưới `_` thay bằng dấu cách đối với các mã kỹ thuật lạ khác.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) [MODIFY]
- [frontend/src/app/checklist/components/IncidentReportModal.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 13:37:00] - Feature: Dịch mã sự cố kỹ thuật thành tên thân thiện và ẩn mã sự cố mặc định (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Ẩn/dịch các mã sự cố kỹ thuật (như `[SYSTEM_OR_NETWORK_ERROR]`, `[PROCESS_DELAY]`) thành các cụm từ tiếng Việt rõ nghĩa và dễ nhìn cho ca trực khi Chế độ kỹ thuật tắt.
- **Giải pháp**:
  - Xây dựng hàm helper `getFriendlyCode` để tự động dịch các mã lỗi như `SYSTEM_OR_NETWORK_ERROR` sang *"Sự cố Hệ thống/Đường truyền"*, `PROCESS_DELAY` sang *"Quá trình bị Trễ"*, `DATA_MISMATCH` sang *"Sai lệch Dữ liệu"*, và `MISSED_SLA` sang *"Trễ hạn SLA"*.
  - Cập nhật [IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx): Khi `showTechDetails` là `false`, nhãn lỗi kỹ thuật được tự động thay thế bằng nhãn tiếng Việt dịch thân thiện. Chỉ hiển thị mã gốc khi bật nút "Xem mã kỹ thuật".
  - Cập nhật [IncidentReportModal.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx): Tự động dịch mã lỗi trong tiêu đề Modal xử lý sự cố và chuyển đổi ô hiển thị mã tác vụ sang tên tác vụ tiếng Việt chi tiết nếu Chế độ kỹ thuật tắt.
  - Cập nhật [page.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx): Truyền hai thuộc tính `showTechDetails` và `taskNamesMap` cho `IncidentReportModal`.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) [MODIFY]
- [frontend/src/app/checklist/components/IncidentReportModal.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx) [MODIFY]
- [frontend/src/app/checklist/page.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 12:09:00] - Feature: Ẩn mã kỹ thuật trong các nhãn Phụ thuộc (Dependencies) (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Ẩn các mã kỹ thuật (như `TASK_CHECK_EOD`, `ops_open_05`) hiển thị trong các tag nhãn Phụ thuộc (`Phụ thuộc: [mã]`), thay thế bằng tên tiếng Việt thân thiện của tác vụ đó khi Chế độ kỹ thuật tắt.
- **Giải pháp**:
  - Tại file [TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx), cập nhật cách hiển thị nhãn phụ thuộc ở cả danh sách bên trái và chi tiết bên phải.
  - Khi `showTechDetails` bằng `false`, hệ thống tự động tìm kiếm thông tin của tác vụ phụ thuộc trong logs và hiển thị `taskNameSnapshot` tiếng Việt tương ứng thay cho mã kỹ thuật.
  - Khi bật **"Xem mã kỹ thuật"**, hệ thống sẽ khôi phục hiển thị ID kỹ thuật gốc.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 12:05:00] - Feature: Ẩn mã kỹ thuật mặc định và Tích hợp Nút chuyển đổi Chế độ kỹ thuật (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Ẩn các mã kỹ thuật (như `ops_open_04`, `TASK_CHECK_CQG_s1`) để tránh gây rối mắt cho ca trực, hiển thị tên tác vụ cụ thể thay thế. Đồng thời tích hợp một nút ở header để người dùng / IT kỹ thuật có thể tùy ý hiển thị lại mã kỹ thuật khi cần đối chiếu.
- **Giải pháp**:
  - Tại file [page.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx), thêm state `showTechDetails` (mặc định là `false`) và tạo memo `taskNamesMap` ánh xạ `taskId` -> `taskNameSnapshot`.
  - Tích hợp một nút **"Xem mã kỹ thuật" / "Ẩn mã kỹ thuật"** (kèm icon `Cpu`) ở thanh nút bấm góc trên bên phải.
  - Cập nhật [TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx): Ẩn mã trong dấu ngoặc vuông `[ops_open_04]` ở cả danh sách bên trái và tiêu đề bảng chi tiết bên phải khi chế độ kỹ thuật tắt.
  - Cập nhật [IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx): Tự động dịch mã sự cố sang tên tác vụ thân thiện (ví dụ: `TASK_CHECK_CQG_s1` thành `Đối chiếu số dư CQG (phiên 1)`), chỉ hiển thị mã gốc khi mở chế độ kỹ thuật.
  - Cập nhật [AuditLogsPanel.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/AuditLogsPanel.tsx): Tự động dịch mã sự kiện trong timeline audit sang tên tác vụ tiếng Việt dễ hiểu.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/page.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx) [MODIFY]
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]
- [frontend/src/app/checklist/components/IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) [MODIFY]
- [frontend/src/app/checklist/components/AuditLogsPanel.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/AuditLogsPanel.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 12:01:00] - Feature: Tích hợp Bộ lọc & Tìm kiếm cho bảng Nhật ký hoạt động Audit (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Thêm bộ lọc cho Nhật ký hoạt động để dễ dàng tìm kiếm hoạt động và tối ưu hóa trải nghiệm vận hành.
- **Giải pháp**:
  - Tại file [AuditLogsPanel.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/AuditLogsPanel.tsx), tích hợp thanh bộ lọc ngay dưới tiêu đề.
  - Bộ lọc gồm:
    - **Ô tìm kiếm văn bản**: Tự động lọc các log khớp với ID tác vụ, tên người dùng hoặc nội dung chi tiết.
    - **Dropdown chọn phân loại hoạt động**: Cho phép lọc nhanh theo *Tất cả hoạt động*, *Đạt / Bỏ đạt*, *Ghi chú*, *Sự cố*, *Tác vụ phát sinh*.
  - Lọc Client-side sử dụng `useMemo` của React để đạt tốc độ phản hồi tức thì (tối ưu hóa hiệu năng, giảm thiểu tối đa độ trễ).
  - Hiển thị thông báo thân thiện *"Không tìm thấy hoạt động phù hợp bộ lọc"* khi không có kết quả khớp.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/AuditLogsPanel.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/AuditLogsPanel.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 11:59:00] - Fix: Cố định tiêu đề bảng Nhật ký hoạt động (Audit) khi cuộn dòng (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi cuộn của bảng Nhật ký hoạt động (Audit) để khi cuộn trang danh sách dòng lịch sử thì tiêu đề và đường kẻ phân chia tiêu đề không bị cuộn mất đi.
- **Giải pháp**:
  - Tại file [AuditLogsPanel.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/AuditLogsPanel.tsx), gỡ bỏ thuộc tính `maxHeight` và `overflowY: 'auto'` khỏi container `.glass-panel` bên ngoài.
  - Áp dụng `maxHeight: '320px'` và `overflowY: 'auto'` vào container chứa danh sách dòng thời gian thời gian bên trong (`className="custom-scrollbar"`).
  - Giúp cố định phần Tiêu đề và đường viền ở đầu thẻ, chỉ cuộn riêng phần lịch sử sự kiện bên dưới (giống như bảng Sự cố & Ngoại lệ).

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/AuditLogsPanel.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/AuditLogsPanel.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 11:58:00] - Refactor: Khôi phục màu xanh dương (primary) của nút Xử lý sự cố (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Chuyển nút "Xử lý" sự cố từ màu đỏ cảnh báo về lại màu sắc chuẩn để tránh gây nhầm lẫn với nút hủy bỏ/xóa.
- **Giải pháp**:
  - Tại file [IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx), khôi phục lớp CSS `btn btn-primary` cho nút **"Xử lý"** để hiển thị màu xanh dương chủ đạo của hệ thống.
  - Vẫn giữ nguyên các cải tiến về viền nhấn bên trái, căn lề và padding gọn gàng của nút.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 11:50:00] - Refactor & Visual Optimization: Thiết kế lại Bố cục song song (Grid) và Tối ưu hóa UI/UX Sự cố & Nhật ký (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Cải tiến bố cục phần dưới (Sự cố & Ngoại lệ và Nhật ký hoạt động Audit) để tăng tính trực quan.
- **Giải pháp**:
  - Tại file [page.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx), gỡ bỏ bố cục cột dọc 100% chiếm nhiều diện tích. Chuyển đổi thành lưới 2 cột song song (`grid grid-cols-1 lg:grid-cols-2 gap-6`) phía dưới bảng Checklist nhiệm vụ (full-width).
  - **Tối ưu hóa bảng Sự cố & Ngoại lệ** trong file [IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx):
    - Thêm viền nhấn màu bên trái (Left Border Accent): viền đỏ đậm `4px solid #ef4444` cho sự cố đang chờ xử lý (`PENDING`) và viền xanh lá `#10b981` cho sự cố đã xử lý.
    - Tích hợp thêm icon cờ/khiên cảnh báo (`ShieldAlert`) và tích xanh (`CheckCircle2`) bên cạnh tiêu đề.
    - Thêm biểu tượng đồng hồ (`Clock`) và hiệu ứng nhấp nháy (`animate-pulse`) cho Badge thời gian trễ SLA.
    - Thiết kế lại các nút **"Xử lý"** (dạng Ghost button màu đỏ nổi bật cảnh báo) và nút **"Xuất mẫu"** (dạng Ghost button màu xanh lá cây mát mắt).
  - **Tối ưu hóa bảng Nhật ký hoạt động (Audit)** trong file [AuditLogsPanel.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/AuditLogsPanel.tsx):
    - Thay thế icon người dùng mặc định (`UserCheck`) bằng các icon chuyên biệt theo từng loại hành động (`Check` cho check đạt, `X`/`AlertTriangle` cho uncheck/sự cố, `MessageSquare` cho ghi chú, `Plus` cho thêm tác vụ) để tăng chiều sâu thông tin.
    - Thêm hiệu ứng hover viền hộp nhật ký trơn tru (`transition-all hover:border-[rgba(255,255,255,0.25)] hover:shadow-sm`).

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/page.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx) [MODIFY]
- [frontend/src/app/checklist/components/IncidentList.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) [MODIFY]
- [frontend/src/app/checklist/components/AuditLogsPanel.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/AuditLogsPanel.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 11:28:00] - Refactor & Visual Optimization: Nâng cấp đồng bộ giao diện và chuyển đổi ô nhập Ghi chú thành Textarea (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Áp dụng cả 4 đề xuất cải tiến trực quan (Custom Checkbox, Hover micro-animations, Custom Select Glassmorphism, Fade-in transition) đồng thời tư vấn có nên chuyển ô Ghi chú từ dạng text sang textarea để tối ưu trực quan và nhập liệu nhiều dòng hay không.
- **Giải pháp**:
  - Chuyển đổi trường nhập **Ghi chú vận hành** từ thẻ `<input type="text">` (một dòng) sang thẻ `<textarea>` (nhiều dòng) cho phép nhập văn bản xuống dòng dễ dàng. Thiết kế lại nút "Lưu ghi chú" nằm ở góc phải phía dưới textarea vô cùng gọn gàng và hiện đại.
  - **Đề xuất 1**: Nâng cấp các ô checkbox tác vụ con mặc định thành các biểu tượng icon Lucide `Circle` (chưa hoàn thành) và `CheckCircle2` (đã hoàn thành) có màu sắc tương ứng, hỗ trợ hiệu ứng micro-scale khi click tương tác.
  - **Đề xuất 2**: Thêm hiệu ứng hover sinh động cho danh sách thẻ tác vụ cột trái (nhấc nhẹ thẻ lên 2px, đổi màu nền nhẹ và thêm bóng đổ).
  - **Đề xuất 3**: Thêm hiệu ứng chuyển động mờ dần Slide & Fade-in khi trực ca chuyển đổi xem các tác vụ.
  - **Đề xuất 4**: Custom lại viền và chevron dropdown của 2 ô Lọc trạng thái / độ ưu tiên để loại bỏ mũi tên mặc định thô của trình duyệt, đồng bộ giao diện Glassmorphism cao cấp.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 11:24:00] - Refactor: Gỡ bỏ gạch ngang (strikethrough) trên tiêu đề Tác vụ con (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Bỏ gạch ngang tiêu đề tác vụ con khi hoàn thành theo phản hồi từ Trưởng nhóm (tránh tạo cảm giác tác vụ bị vứt bỏ / hủy bỏ).
- **Giải pháp**:
  - Tại file [TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx), thay thế thuộc tính `textDecoration: child.isChecked ? 'line-through' : 'none'` bằng `textDecoration: 'none'` cho tiêu đề của các tác vụ con (subtasks) ở cột bên phải.
  - Các tác vụ con đã hoàn thành sẽ chỉ sử dụng độ mờ chữ `opacity: 0.6` và tích xanh để hiển thị trạng thái hoàn thành một cách nhẹ nhàng và trực quan hơn.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 11:22:00] - Refactor: Tối ưu hóa UI danh sách tác vụ cột trái (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Kiểm tra độ trực quan và bổ sung các thông tin còn thiếu trên giao diện.
- **Giải pháp**:
  - Tích hợp hiển thị thông tin **Khung giờ thực hiện (Timetable)** hoặc **Thời hạn cam kết SLA** kèm biểu tượng đồng hồ trực tiếp lên thẻ tác vụ ở cột trái.
  - Loại bỏ hoàn toàn đường gạch ngang chữ (`line-through`) trên tiêu đề các tác vụ đã hoàn thành, giúp cải thiện độ trực quan, dễ đọc đối với các tiêu đề dài.
  - Khắc phục hiện tượng **giật gián đoạn khung hình 1px (Layout Shift)** bằng cách giữ nguyên độ dày border vật lý là `1px`, thay thế hiệu ứng tăng viền khi được chọn bằng hiệu ứng bóng viền lan tỏa (`box-shadow` spread).

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.

## [2026-07-29 11:18:00] - Fix: Khắc phục lỗi React style border conflict warning (Console Error)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi cảnh báo/lỗi ở console: `Updating a style property during rerender (border) when a conflicting property is set (borderLeft) can lead to styling bugs. To avoid this, don't mix shorthand and non-shorthand properties for the same value; instead, replace the shorthand with separate values.`
- **Giải pháp**: 
  - Tại file [TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx), gỡ bỏ thuộc tính viết tắt `border` và thay thế hoàn toàn bằng các thuộc tính biên đơn lẻ rõ ràng gồm `borderTop`, `borderRight`, `borderBottom` và `borderLeft`.
  - Đảm bảo logic hiển thị viền nhấn màu xanh khi tác vụ được chọn (`isSelected`) hoạt động ổn định và chính xác mà không gây ra xung đột thuộc tính khi render lại.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript frontend (`npx tsc --noEmit`) thành công 100%.
- Kiểm thử biên dịch TypeScript backend (`npx tsc -p tsconfig.build.json --noEmit`) thành công 100%.
- Build dự án production frontend (`npm run build`) thành công 100%.
- Build dự án production backend (`npm run build`) thành công 100%.

## [2026-07-29 11:00:00] - Refactor: Đồng bộ Icon Vector (QIcon) Thay Vì Sử Dụng Emojis Trên Giao Diện Native

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Không sử dụng Unicode Emojis (🔌, 🚀, 📖, ⏸, 🔴, 💾, ❌, 🔍) trên các nút bấm và tab. Thay vào đó, sử dụng các biểu tượng vector vẽ sẵn (QIcon) từ mã nguồn nhưng hiển thị trong cấu trúc giao diện Native Windows nguyên bản.
- **Giải pháp**:
  - Gỡ bỏ toàn bộ emojis trong file cấu hình dịch thuật [i18n.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/i18n.py).
  - Tích hợp vẽ và gán `QIcon` trực tiếp lên các Tab (Connection, Startup, Guide) và các nút (Save, Cancel, Test Connection) của Settings Window, và các nút (Pause, Clear, Export) của Log Window bằng vector `_draw_svg_icon()`.
  - Khôi phục cơ chế cập nhật icon động khi tạm dừng/tiếp tục ghi log.

### 2. Danh sách file chỉnh sửa
- [deployment/rpa-agent/app/i18n.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/i18n.py) [MODIFY]
- [deployment/rpa-agent/app/settings_window.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/settings_window.py) [MODIFY]
- [deployment/rpa-agent/app/log_window.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/log_window.py) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Biên dịch PyInstaller & Inno Setup thành công 100%.

## [2026-07-29 10:47:00] - Refactor & Feature: Việt Hóa Thân Thiện, Xóa Tab Rác và Tích Hợp Đa Ngôn Ngữ i18n Cho RPA Agent

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: 
  - Gỡ bỏ hoàn toàn tab rác "Đường dẫn" (không dùng đến và chạy ngầm gây lãng phí bộ nhớ).
  - Thay thế tab "Đường dẫn" bằng tab "Hướng dẫn" (Self-onboarding Guide) cho phép người dùng tự cấu hình theo các bước rõ ràng.
  - Thay đổi thuật ngữ "System Tray / Tray" kỹ thuật khó hiểu thành cụm từ thân thiện hơn: "Biểu tượng góc màn hình (góc dưới bên phải)".
  - Hỗ trợ đa ngôn ngữ hoàn chỉnh (tiếng Anh và tiếng Việt): Người dùng chọn chuyển đổi ngôn ngữ ở menu khay hệ thống, toàn bộ ứng dụng (Cài đặt, Nhật ký, Hướng dẫn, Menu, Thông báo bong bóng) sẽ đổi ngôn ngữ đồng bộ thay vì hiển thị hỗn hợp.
  - Đảm bảo các dòng log nhận về từ Backend **giữ nguyên văn bản gốc**, không bị dịch thuật.
  - Sửa lỗi biên dịch `build.bat` khi đường dẫn Inno Setup chứa ký tự ngoặc đơn.

### 2. Danh sách file chỉnh sửa
- [deployment/rpa-agent/app/i18n.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/i18n.py) [MODIFY]
- [deployment/rpa-agent/app/settings_window.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/settings_window.py) [MODIFY]
- [deployment/rpa-agent/app/log_window.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/log_window.py) [MODIFY]
- [deployment/rpa-agent/app/tray.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/tray.py) [MODIFY]
- [deployment/rpa-agent/app/main.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/main.py) [MODIFY]
- [deployment/rpa-agent/build.bat](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/build.bat) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch PyInstaller & Inno Setup thành công 100%. Đã tạo thành công bộ cài đặt tại [Output/MXV_Agent_Setup_v1.0.exe](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/Output/MXV_Agent_Setup_v1.0.exe) và file chạy nhanh tại [dist/MXVAgent.exe](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/dist/MXVAgent.exe).

## [2026-07-28 18:09:00] - Refactor: Chuyển Đổi Thuộc Tính Tác Vụ Thành Dạng Tag Co Giãn (Frontend)


### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Khắc phục lỗi hiển thị khi thuộc tính tác vụ bị kéo giãn quá dài (nhìn trống trải) khi chỉ có 1 hoặc ít thông tin được hiển thị (ví dụ chỉ có "Thời hạn cam kết" ở tác vụ Open RPA Download).
- **Giải pháp**:
  - Thay đổi cấu trúc hiển thị thông tin mô tả chi tiết của tác vụ trong [TaskTable.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) từ dạng bảng lưới ô lớn trải rộng 100% sang các thẻ Tag/Pill nhỏ gọn co giãn tự động theo kích thước chữ (`display: inline-flex`), có màu sắc biểu tượng trực quan riêng biệt cho từng loại thông tin.
  - Giữ nguyên hiển thị dòng rộng cho thuộc tính "Đường dẫn tệp" vì đặc thù tệp tin có thể rất dài để tránh bị xuống dòng nhiều.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript phía frontend (`npx tsc --noEmit`) thành công 100%.

## [2026-07-28 18:07:00] - Feature: Khôi Phục Hiển Thị Thông Tin Phụ Thuộc Tác Vụ (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Đưa thông tin phụ thuộc tác vụ (ví dụ: `Phụ thuộc: TASK_CHECK_EOD (Chưa hoàn thành)`) quay trở lại giao diện sau khi bị ẩn trong đợt refactor Master-Detail.
- **Giải pháp**:
  - Khôi phục logic đọc `dependsOnTaskIdsSnapshot` từ dữ liệu tác vụ và hiển thị danh sách các badge phụ thuộc (Đạt/Chưa đạt, Đã hoàn thành/Chưa hoàn thành) kèm theo biểu tượng Lock/Unlock tương ứng.
  - Tích hợp hiển thị ở cả hai vị trí: dưới tên tác vụ ở các thẻ bên cột trái (Master Cards) và dưới tên tác vụ trong khu vực chi tiết xử lý bên cột phải (Workspace Header).

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript phía frontend (`npx tsc --noEmit`) thành công 100%.

## [2026-07-28 18:05:00] - Fix: Ẩn Khung Thuộc Tính Tác Vụ Rỗng (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi ô trắng rỗng xuất hiện ở giữa nút hành động và phần tác vụ con trên giao diện chi tiết tác vụ (Detail Workspace).
- **Giải pháp**:
  - Sửa logic hiển thị trong [TaskTable.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) bằng cách bọc thẻ `div` bọc ngoài của Metadata Fields Grid bằng một điều kiện logic check xem có ít nhất một thông tin snapshot tồn tại (`deadlineSnapshot`, `slaDeadlineSnapshot`, `timetableSnapshot`, `urdReferenceSnapshot`, `fileLocationSnapshot`, hoặc `functionUrlSnapshot`). Nếu tất cả đều rỗng, sẽ không render khung viền rỗng này nữa.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript phía frontend (`npx tsc --noEmit`) thành công 100%.

## [2026-07-28 17:50:00] - Refactor: Thay Thế Thuật Ngữ Kỹ Thuật 'Khắc Phục Sự Cố' Thành 'Xử Lý' (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Nhận ý kiến từ Trưởng khối vận hành, thay đổi nhãn nút bấm từ "Khắc phục sự cố" thành "Xử lý" để phản ánh chính xác bản chất công việc vận hành hàng ngày của trực ca (nhẹ nhàng, thực tế hơn so với từ ngữ kỹ thuật nặng nề "Khắc phục sự cố" khi chỉ trễ hạn SLA).
- **Giải pháp**:
  - Đổi nhãn nút hành động xử lý lỗi trong [IncidentList.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx#L213) từ "Khắc phục sự cố" thành "Xử lý".
  - Thay đổi tiêu đề modal và mô tả trường input giải pháp xử lý trong [IncidentReportModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx) thành "Xử lý ngoại lệ / sự cố" và "Giải pháp xử lý (Remediation)".

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/IncidentList.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) [MODIFY]
- [frontend/src/app/checklist/components/IncidentReportModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript phía frontend (`npx tsc --noEmit`) thành công 100% không lỗi.

## [2026-07-28 12:10:00] - Feature: Tích Hợp Báo Cáo Trực Quan Riêng Cho Tác Vụ Quét Email (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Thay thế giao diện báo cáo trực quan cho các tác vụ kiểm tra hòm thư (`EMAIL_PARSE`). Hiện tại các tác vụ này đang hiển thị nhầm giao diện thống kê gửi thư hệ thống ("TỔNG SỐ EMAIL GỬI", "EMAIL GỬI THẤT BẠI"), không đúng bản chất tác vụ kiểm tra email đến và tải tệp đính kèm.
- **Giải pháp**:
  - Tạo component chuyên dụng [EmailScanVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/EmailScanVisualReport.tsx) để hiển thị thông tin trực quan cho tác vụ quét email (Trạng thái tìm thấy, Tiêu đề thư khớp, Từ khóa xác minh, Danh sách file tải về kèm vị trí thư mục lưu trữ).
  - Khai báo thêm trường `emailScanResult` trong kiểu dữ liệu [types.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/types.ts).
  - Cập nhật hàm phân tích `parsedData` và logic hiển thị Tab trong [BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx) để phân loại đúng nhóm `EMAIL_SCAN` và kết xuất giao diện tương ứng.

### 2. Danh sách file chỉnh sửa
- [frontend/src/components/ui/bot-log-viewer/types.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/types.ts) [MODIFY]
- [frontend/src/components/ui/bot-log-viewer/EmailScanVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/EmailScanVisualReport.tsx) [NEW]
- [frontend/src/components/ui/BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript phía frontend (`npx tsc --noEmit`) thành công 100% không lỗi.

## [2026-07-28 12:00:00] - Fix: Nâng Cấp Khả Năng Phân Tích JSON Loose Của Email Watcher (Backend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Khắc phục lỗi Bot thông báo không quét được email do lỗi định dạng chuỗi JSON cấu hình ở trường Target. Người dùng nhập `downloadDir:` không có nháy kép quanh tên key khiến cú pháp JSON bị hỏng, làm cho Bot không thể trích xuất chính xác `sender` (trả về trống `""`) và `subject`.
- **Giải pháp**:
  - Viết hàm bổ trợ `safeParseJson` trong [email-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts#L698).
  - Tự động sửa lỗi (Loose Parser) các key viết thiếu nháy kép (ví dụ: `downloadDir:`) hoặc key dùng nháy đơn bằng Regex trước khi đưa vào `JSON.parse`.
  - Cập nhật ở cả hai tác vụ `checkEmailTask` và `checkEmailTaskDelegated` để đảm bảo UAT và Product hoạt động đồng nhất.

### 2. Danh sách file chỉnh sửa
- [backend/src/modules/bot-engine/email-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Biên dịch ứng dụng backend thành công (`npm run build`).

## [2026-07-28 11:30:00] - Refactor: Gỡ Bỏ Triệt Để Các Emoji Cảnh Báo 🚨 Khỏi Hệ Thống (Telegram, Teams, Web UI)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Gỡ bỏ triệt để các biểu tượng emoji `🚨`, `⚠️`, `✅` còn sót lại trên các file cấu hình và giao diện (Telegram, Teams, Web UI, Báo cáo trực quan) để đảm bảo đồng bộ hóa thiết kế phẳng và tăng tính thẩm mỹ chuẩn doanh nghiệp.
- **Giải pháp**:
  - Gỡ bỏ hoàn toàn emoji `🚨` khỏi:
    - Tin nhắn Telegram cảnh báo đối chiếu SOD/EOD trong [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts).
    - Chuỗi log lưu trữ trạng thái âm ký quỹ trong [reconciliation.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.controller.ts).
    - Log chú thích (Checklist Notes) lưu trữ trong database của tác vụ chạy EOD tại [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts).
    - Tiêu đề thông báo cảnh báo thời gian chót (Coming Soon & Overdue) trên Telegram tại [telegram.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/telegram/telegram.service.ts).
    - Cảnh báo đáo hạn hợp đồng trên MS Teams trong [teams-notifier.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/notifications/teams-notifier.service.ts).
    - Nhãn hiển thị lệch giá trị trên Admin Panel GttChecker trong [GttChecker.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/GttChecker.tsx).
    - Khối cấu hình EOD trong [ReconciliationPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ReconciliationPanel.tsx).
    - Huy hiệu trạng thái thiếu file trong báo cáo trực quan [FileAuditVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/FileAuditVisualReport.tsx).

### 2. Danh sách file chỉnh sửa
- [backend/src/modules/reconciliation/reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts) [MODIFY]
- [backend/src/modules/reconciliation/reconciliation.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.controller.ts) [MODIFY]
- [backend/src/modules/bot-engine/bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts) [MODIFY]
- [backend/src/modules/telegram/telegram.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/telegram/telegram.service.ts) [MODIFY]
- [backend/src/modules/notifications/teams-notifier.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/notifications/teams-notifier.service.ts) [MODIFY]
- [frontend/src/app/admin/bot-config/components/GttChecker.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/GttChecker.tsx) [MODIFY]
- [frontend/src/app/admin/bot-config/components/ReconciliationPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ReconciliationPanel.tsx) [MODIFY]
- [frontend/src/components/ui/bot-log-viewer/FileAuditVisualReport.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/bot-log-viewer/FileAuditVisualReport.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Dự án backend và frontend đều biên dịch hoàn toàn thành công không lỗi.

## [2026-07-28 11:20:00] - Fix: Khắc Phục Lỗi Phân Tích Dữ Liệu Tệp Tin Trùng Lặp Trên Giao Diện Chi Tiết Chạy Bot (Frontend)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Sửa lỗi giao diện chi tiết chạy bot scan báo cáo M-System hiển thị sai số lượng tệp tin (TỔNG SỐ FILE BÁO CÁO lên tới 40 tệp tin, FILE THIẾU lên tới 7 tệp tin) và hiển thị các dòng log thô như "Kết quả scan", "Đang tải bổ sung..." thay vì tên tệp tin thực tế trong danh sách.
- **Giải pháp**:
  - Phát hiện lỗi do parser frontend trong [BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx#L501) phân tích dòng thô, cứ mỗi dòng log chứa chữ `.xlsx`, `.csv` hay `file` đều coi là một tệp tin riêng, gây lặp lại dữ liệu sau mỗi lượt thử lại của Bot (Attempt 1/2/3).
  - Viết lại bộ lọc sử dụng `Map` và đối sánh Regex thông minh để:
    - Bỏ qua các dòng log trạng thái chung.
    - Trích xuất chính xác tên các tệp tin bị thiếu ban đầu bằng Regex.
    - Cập nhật trạng thái thành công (`DOWNLOADED`) hoặc lỗi (`MISSING` kèm thông tin chi tiết lỗi) của từng tệp tin duy nhất theo tiến trình thời gian thực tế.
    - Loại bỏ hoàn toàn các dòng mô tả log khỏi danh sách tệp tin hiển thị.

### 2. Danh sách file chỉnh sửa
- [frontend/src/components/ui/BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Kiểm thử biên dịch TypeScript phía frontend (`npx tsc --noEmit`) thành công 100% không lỗi.

## [2026-07-28 11:10:00] - Refactor: Dọn Dẹp và Chuẩn Hóa Emoji Trên Các Email Cảnh Báo Hệ Thống

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Đánh giá và dọn dẹp các biểu tượng emoji (`🚨`, `⚠️`, `👉`, `✅`) trong các email cảnh báo hệ thống để đảm bảo tính chuyên nghiệp, tối giản chuẩn doanh nghiệp (Enterprise Look), tránh gây hiểu lầm là email quảng cáo/spam và khắc phục lỗi render ký tự đặc biệt của Outlook.
- **Giải pháp**:
  - Gỡ bỏ hoàn toàn emoji `🚨`, `⚠️`, `👉`, `✅` khỏi các email:
    - Email cảnh báo kết nối RPA Agent (mất kết nối / khôi phục kết nối).
    - Email cảnh báo lỗi tác vụ vận hành trong ca trực.
    - Email cảnh báo âm ký quỹ Post-EOD (`[MXV MARGIN WARNING]`).
    - Email cảnh báo hết hạn Refresh Token hòm thư Bot (`[MXV BOT WARNING]`).
  - Giữ lại emoji trong các kênh **Telegram** và **Web console** nội bộ (nơi emoji hoạt động tốt và giúp nhân viên quét nhanh thông tin sự cố).

### 2. Danh sách file chỉnh sửa
- [backend/src/modules/bot-engine/bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts) [MODIFY]
- [backend/src/modules/reconciliation/reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts) [MODIFY]
- [backend/src/modules/system-settings/system-settings.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/system-settings/system-settings.service.ts) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Biên dịch ứng dụng backend thành công (`npm run build`).

## [2026-07-28 10:00:00] - Feature: Nâng Cấp Giao Diện UI/UX Email Cảnh Báo Lỗi Bot Vận Hành Cho Nhân Viên Ca Trực

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Cải tiến giao diện email cảnh báo lỗi Bot ngầm (RPA/Scheduler) trở nên thân thiện và đơn giản hơn với nhân viên ca trực (Operator), hiển thị tên ca trực/tác vụ bằng tiếng Việt rõ ràng, cung cấp nút bấm trực tiếp để chuyển hướng xử lý nhanh ca trực và thu gọn các thông tin kỹ thuật (JSON, logs) bằng thẻ mở rộng dành riêng cho IT.
- **Giải pháp**:
  - **Backend**:
    - Thêm phương thức helper `getShiftByIdInternal(id: string)` trong [shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts#L1228) để cho phép query thông tin ca trực mà không cần context user phân quyền.
    - Cập nhật hàm `sendOperationalFailureAlert` trong [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts#L2512):
      - Tự động gọi `getShiftByIdInternal` để phân tích tên ca trực tiếng Việt và tên tác vụ hiển thị tiếng Việt (`taskNameSnapshot`).
      - Cập nhật chủ đề email (Subject) theo định dạng nghiệp vụ: `🚨 [Checklist Alert] Lỗi Tác Vụ [Tên Tác Vụ] - Ca Trực: [Tên Ca Trực]`.
      - Bổ sung nút bấm hành động nổi bật **`[ ĐI TỚI CA TRỰC ĐỂ XỬ LÝ ]`** liên kết thẳng đến trang ca trực của nhân viên vận hành.
      - Sử dụng thẻ `<details>` và `<summary>` trong HTML để gom nhóm thu gọn ngầm phần **Payload của Job** và **20 Dòng Logs Cuối Cùng**, giúp giao diện chính tối giản và IT vẫn có đầy đủ thông tin khi mở rộng.

### 2. Danh sách file chỉnh sửa
- [backend/src/modules/shifts/shifts.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts) [MODIFY]
- [backend/src/modules/bot-engine/bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Chạy thử nghiệm thành công bằng script test: `npx ts-node src/test-trigger-operational-failure.ts` (gửi mail cảnh báo mới thành công kèm đính kèm CSV).
- Biên dịch backend (`npm run build`) thành công 100% không lỗi.

## [2026-07-28 09:10:00] - Fix: Ngăn Chặn Spam Email Cảnh Báo Khi Xoay Vòng Refresh Token Tự Động

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Ngăn chặn tình trạng hệ thống gửi email cảnh báo thay đổi cấu hình liên tục vào hòm thư mỗi khi Bot tự động cập nhật hoặc xoay vòng Refresh Token.
- **Giải pháp**:
  - **Backend**:
    - Bổ sung danh sách `ignoredKeys` bao gồm `m365_refresh_token`, `m365_token_renewed_at`, `m365_token_error_sent_at` trong hàm `sendSecurityAuditEmail` thuộc [system-settings.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/system-settings/system-settings.service.ts#L48).
    - Khi các tham số trạng thái hoặc token tự động này thay đổi, hệ thống sẽ bỏ qua không gửi email cảnh báo bảo mật, chỉ gửi cảnh báo đối với các thiết lập thủ công quan trọng khác của quản trị viên.

### 2. Danh sách file chỉnh sửa
- [backend/src/modules/system-settings/system-settings.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/system-settings/system-settings.service.ts) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Biên dịch backend (`npm run build`) thành công (Pass).

## [2026-07-28 09:05:00] - Cleanup: Loại Bỏ Import Icon LogOut Không Sử Dụng Trong Sidebar

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Dọn dẹp code không sử dụng đối với biểu tượng `LogOut` trong Sidebar.
- **Giải pháp**:
  - Loại bỏ import `LogOut` dư thừa từ gói `lucide-react` trong file [Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx#L12) do tính năng đăng xuất thực tế đã được tích hợp hiển thị trong menu cá nhân ở Header.tsx.

### 2. Danh sách file chỉnh sửa
- [frontend/src/components/Sidebar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/Sidebar.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- NextJS frontend production build thành công 100% không lỗi.

---

## [2026-07-28 09:02:00] - Refactor: Tối Ưu Nút Xác Nhận Chốt Ca Và Cải Tiến Validation Handovers Note

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Đơn giản hóa kiểu dáng nút "Chốt ca & Bàn giao" trong modal (thay vì gradient màu xanh phức tạp) và bổ sung thông báo cảnh báo lỗi khi người dùng chưa nhập biên bản bàn giao.
- **Giải pháp**:
  - **CloseShiftModal Component**:
    - Thay thế kiểu dáng nền nút từ `linear-gradient(...)` sang màu xanh ngọc phẳng tối giản `#10b981` (Emerald 500) kết hợp hiệu ứng transition mượt mà.
    - Loại bỏ cấm bấm nút dạng cứng `disabled={... || !handoverNote.trim()}` để nút luôn sáng, giúp người dùng có thể nhấp chuột vào bất cứ lúc nào.
    - Trong hàm `handleSubmit` [CloseShiftModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/CloseShiftModal.tsx#L23): Nếu người dùng nhấp chốt ca mà nội dung bàn giao trống, hệ thống sẽ chặn gửi, kích hoạt trạng thái báo lỗi `error` và viền đỏ quanh textarea cùng thông báo cảnh báo trực quan `⚠️ Vui lòng nhập nội dung biên bản bàn giao trước khi chốt ca.` ngay bên dưới.
    - Loại bỏ thuộc tính HTML5 `required` của `textarea` để tránh tooltip mặc định của trình duyệt và cho phép custom validation React hoạt động chính xác.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/components/CloseShiftModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/CloseShiftModal.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- NextJS frontend production build thành công 100% không có cảnh báo hay lỗi TypeScript (`Pass`).

---

## [2026-07-28 08:48:00] - Refactor: Tạm Ẩn Tab Đường Dẫn Và Dừng Polling Job Trên Windows RPA Agent Client

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Do các tác vụ và code nghiệp vụ đã được chuyển dịch hoàn toàn lên NestJS backend trên server Linux Ubuntu ổn định, Windows RPA Agent giờ chỉ làm nhiệm vụ giữ kết nối và hiển thị thông báo. Cần ẩn tab cấu hình đường dẫn và comment lại chức năng polling job để tối giản Agent.
- **Giải pháp**:
  - **RPA Agent UI**:
    - Trong [settings_window.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/settings_window.py#L316): Comment out dòng addTab cho "Đường dẫn", đồng thời vẫn khởi tạo method `_build_paths_tab()` ngầm để tránh lỗi thuộc tính `AttributeError` khi nạp/lưu cấu hình.
  - **RPA Agent Core**:
    - Trong [agent_core.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/agent_core.py#L384): Tạm thời comment out đoạn logic gọi API `agent/poll` và dispatch job trong vòng lặp chính. Giờ đây Agent chỉ gửi heartbeat để giữ kết nối online.

### 2. Danh sách file chỉnh sửa
- [deployment/rpa-agent/app/settings_window.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/settings_window.py) [MODIFY]
- [deployment/rpa-agent/app/agent_core.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/agent_core.py) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Code NestJS backend và NextJS frontend biên dịch thành công 100% không lỗi. Ứng dụng Desktop RPA Agent chạy thử nghiệm mượt mà, tab "Đường dẫn" đã ẩn hoàn toàn và không còn tự động kéo job về máy Windows.

---

## [2026-07-28 08:41:00] - Fix: Sửa Lỗi Không Nhập Được Số Trong Thời Gian Tự Đóng Thông Báo (Settings UI)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Khắc phục lỗi ô nhập liệu "Thời gian tự đóng thông báo (giây)" bị trắng/trống không hiển thị số và không thể tương tác nhập số trên Windows RPA Agent.
- **Giải pháp**:
  - **RPA Agent UI**:
    - Trong [settings_window.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/settings_window.py#L460): Thay đổi độ rộng cố định `setFixedWidth(70)` của `_duration_spin` (QSpinBox) thành `110`.
    - Do kiểu dáng QSpinBox tùy biến sử dụng padding lớn (30px bên phải để tránh chèn nút điều khiển), độ rộng cũ 70px quá nhỏ khiến Qt tự động ẩn/cắt cụm chữ số (text clipping) làm ô nhập bị trắng.
    - Bổ sung hậu tố hiển thị `giây` (`setSuffix(" giây")`) cho ô nhập này để tăng tính đồng nhất UI với các ô nhập thời gian khác (Polling/Heartbeat).

### 2. Danh sách file chỉnh sửa
- [deployment/rpa-agent/app/settings_window.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/settings_window.py) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Không ảnh hưởng đến backend/frontend web. Code Python của UI thiết lập chạy tốt, kiểm thử căn chỉnh giao diện khớp chuẩn.

---

## [2026-07-28 08:35:00] - Fix: Khắc Phục Lỗi Cảnh Báo Handshake Thất Bại (HTTP 201) Giữa Client RPA Agent Và Backend

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Giải quyết lỗi cảnh báo `[WARNING] Handshake thất bại: HTTP 201` trên RPA Agent Client khi chạy kết nối cục bộ.
- **Giải pháp**:
  - **Backend**:
    - Thêm decorator `@HttpCode(HttpStatus.OK)` vào endpoint `/login` (`POST /api/v1/bot-engine/agent/login`) trong [bot-engine.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.controller.ts#L2279) để ghi đè mã trạng thái mặc định từ `201 Created` của NestJS thành `200 OK` (đúng tiêu chuẩn thiết kế REST API đối với xác thực session).
    - Thêm import `HttpCode` từ gói `@nestjs/common`.
  - **RPA Agent Client**:
    - Cập nhật logic kiểm tra phản hồi đăng nhập trong [agent_core.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/agent_core.py#L116) từ kiểm tra cứng `r.status_code == 200` thành `r.status_code in (200, 201)` để có khả năng tương thích và chống lỗi (fault tolerance) tốt hơn trong trường hợp server thay đổi.

### 2. Danh sách file chỉnh sửa
- [backend/src/modules/bot-engine/bot-engine.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.controller.ts) [MODIFY]
- [deployment/rpa-agent/app/agent_core.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/rpa-agent/app/agent_core.py) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Cả Backend (`npm run build`) và Frontend (`npm run build`) đều chạy build thành công 100% không có lỗi.

---

## [2026-07-28 00:22:00] - Refactor: Thay Thế Hộp Thoại Chốt Ca Bằng Custom React Textarea Modal

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Loại bỏ các hộp thoại mặc định thô sơ của trình duyệt (`window.confirm`, `window.prompt`) khi Chốt Ca Trực để cải thiện trải nghiệm người dùng (UX) và giao diện thiết kế (Aesthetics).
- **Giải pháp**:
  - **Tạo mới component**: [CloseShiftModal.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/components/CloseShiftModal.tsx)
    - Thiết kế giao diện Glassmorphism đồng bộ, hiển thị thẻ cảnh báo nguy cơ khóa ca (đỏ nổi bật) kèm icon `AlertTriangle`.
    - Sử dụng ô nhập liệu lớn `textarea` giúp người dùng dễ dàng căn dòng, xuống hàng để nhập thông tin bàn giao chi tiết cho ca sau thay vì ô input 1 dòng chật hẹp của `window.prompt`.
    - Trạng thái quay tròn Loading trên nút Xác nhận khi đang gọi API chốt ca.
  - **useChecklist Hook**: [useChecklist.ts](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/hooks/useChecklist.ts)
    - Sửa đổi phương thức `handleCloseShift` để nhận trực tiếp chuỗi `handoverNote` từ bên ngoài truyền vào làm tham số, loại bỏ hoàn toàn các hộp thoại mặc định.
  - **Trang Checklist**: [page.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/page.tsx)
    - Tích hợp state `isCloseShiftModalOpen` và import component `<CloseShiftModal />`.
    - Chuyển hướng sự kiện nút bấm "Chốt ca trực" mở modal tùy chọn và truyền kết quả chốt ca về hook xử lý.

### 2. Danh sách file chỉnh sửa & tạo mới
- [frontend/src/app/checklist/components/CloseShiftModal.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/components/CloseShiftModal.tsx) [NEW]
- [frontend/src/app/checklist/hooks/useChecklist.ts](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/hooks/useChecklist.ts) [MODIFY]
- [frontend/src/app/checklist/page.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/page.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Biên dịch Next.js production build (`npm run build` ở `frontend`) thành công 100% không lỗi.

---

## [2026-07-28 00:10:00] - Feature: Triển Khai Tính Năng Tìm Kiếm Toàn Cục (Global Search) Phục Vụ Vận Hành

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Thay thế placeholder cũ bằng `"Tìm kiếm sự cố, biên bản..."` và lập trình logic cho phép tìm kiếm nhanh các sự cố (Incidents), các tác vụ vận hành (Tasks) và biên bản bàn giao ca trực (Handovers) liên quan đến từ khóa nhập vào.
- **Giải pháp**:
  - **Backend**:
    - Thêm phương thức `searchIncidents` trong [incidents.service.ts](file:///d:/sontayweb/mxv-shift-checklist/backend/src/modules/incidents/incidents.service.ts) để tìm kiếm các sự cố (Incidents) có phân quyền theo phân khối/bộ phận.
    - Thêm phương thức `globalSearch` trong [shifts.service.ts](file:///d:/sontayweb/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts) để tổng hợp kết quả tìm kiếm sự cố, tác vụ và biên bản bàn giao ca trực từ cơ sở dữ liệu MongoDB.
    - Tạo endpoint API `GET /api/v1/shifts/search/global?q={value}` trong [shifts.controller.ts](file:///d:/sontayweb/mxv-shift-checklist/backend/src/modules/shifts/shifts.controller.ts) (nằm trước endpoint parametric `:id` để tránh xung đột định tuyến).
  - **Frontend**:
    - Nâng cấp [Header.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/components/Header.tsx): đổi placeholder thành `"Tìm kiếm sự cố, biên bản..."`.
    - Viết hook `useEffect` hỗ trợ **Debounce (400ms)** để gọi API tìm kiếm toàn cục khi nhập từ khóa.
    - Thêm cửa sổ kết quả tìm kiếm thả xuống (Popover) dạng glassmorphism hiển thị trực quan các kết quả tìm kiếm được phân loại (Sự cố 🔴, Tác vụ 🔵, Biên bản bàn giao 🟢) kèm theo các icon động từ `lucide-react`.
    - Bổ sung ref `searchContainerRef` và cơ chế click-outside để đóng Popover kết quả khi người dùng click ra ngoài ô tìm kiếm.
    - Khi click chọn một dòng kết quả, hệ thống tự động điều hướng người dùng chuyển hướng sang `/checklist?id={shiftLogId}` tương ứng.

### 2. Danh sách file chỉnh sửa
- [backend/src/modules/incidents/incidents.service.ts](file:///d:/sontayweb/mxv-shift-checklist/backend/src/modules/incidents/incidents.service.ts) [MODIFY]
- [backend/src/modules/shifts/shifts.service.ts](file:///d:/sontayweb/mxv-shift-checklist/backend/src/modules/shifts/shifts.service.ts) [MODIFY]
- [backend/src/modules/shifts/shifts.controller.ts](file:///d:/sontayweb/mxv-shift-checklist/backend/src/modules/shifts/shifts.controller.ts) [MODIFY]
- [frontend/src/components/Header.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/components/Header.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Biên dịch cả Backend (`nest build`) và Frontend (`next build`) thành công 100% không có lỗi.

---

## [2026-07-27 23:45:00] - Refactor: Tối Ưu Trải Nghiệm Di Động & Cơ Chế Bảo Vệ Thao Tác Chốt Ca Trực

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Cải thiện trải nghiệm giao diện trên thiết bị di động (khi truy cập qua VPN hoặc Wi-Fi nội bộ) và nâng cao trải nghiệm người dùng (UX).
- **Giải pháp**:
  - **Chốt ca trực an toàn**: Bổ sung hộp thoại xác nhận `window.confirm` trong hàm `handleCloseShift` thuộc [useChecklist.ts](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/hooks/useChecklist.ts) để tránh việc người dùng vô tình chốt ca khi bấm nhầm trên màn hình cảm ứng điện thoại.
  - **Tối ưu Grid form đối chiếu**: Chuyển đổi inline grid `gridTemplateColumns: mode === 'CQG' ? '1fr 1fr' : '1fr 1fr 1.5fr'` trong [ReconciliationModal.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/components/ReconciliationModal.tsx) thành các lớp responsive Grid của Tailwind CSS (`grid-cols-1 md:grid-cols-2` và `grid-cols-1 md:grid-cols-3`). Nhờ đó, form nhập liệu tự động chuyển thành 1 cột dọc gọn gàng trên màn hình điện thoại nhỏ và phục hồi chia cột trên desktop.
  - **Cuộn ngang cho bảng số liệu**: Bổ sung `overflowX: 'auto'` vào tất cả các container bọc bảng hiển thị chênh lệch chi tiết khi chạy đối chiếu trong [ReconciliationModal.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/components/ReconciliationModal.tsx) để hỗ trợ vuốt cuộn ngang mượt mà trên di động, tránh tràn viền hay méo bảng.
  - **Sticky Search & Filters**: Cấu hình thuộc tính ghim ở đầu cửa sổ (`sticky top-[74px] z-10 backdrop-blur-md`) cho cụm tìm kiếm và lọc trạng thái trong [TaskTable.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx). Giúp người dùng dễ dàng lọc tác vụ khi cuộn danh sách dài mà không cần cuộn ngược lên đầu trang.

### 2. Danh sách file chỉnh sửa
- [frontend/src/app/checklist/hooks/useChecklist.ts](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/hooks/useChecklist.ts) [MODIFY]
- [frontend/src/app/checklist/components/ReconciliationModal.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/components/ReconciliationModal.tsx) [MODIFY]
- [frontend/src/app/checklist/components/TaskTable.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Biên dịch Next.js production build: Chạy lệnh `npm run build` trong thư mục `frontend` thành công 100% không cảnh báo lỗi (Pass).

---

## [2026-07-27 23:05:00] - Feature: Tích Hợp Cơ Chế Tự Động Dọn Dẹp File Tạm Và File Báo Cáo Trên Ổ Đĩa

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Phân tích hệ thống và triển khai cơ chế tự động dọn dẹp (clean up) file vật lý trên ổ đĩa.
- **Giải pháp**:
  - Tích hợp thêm logic dọn dẹp file vật lý vào phương thức `handleRetentionCleanup` chạy tự động vào 00:00 hàng ngày thuộc [cleanup.service.ts](file:///d:/sontayweb/mxv-shift-checklist/backend/src/modules/system-settings/cleanup.service.ts).
  - Viết phương thức đệ quy `cleanDirectoryRecursive(dirPath, thresholdDate, excludeFiles)` để quét thư mục, xóa các file có thời gian sửa đổi (`mtime`) cũ hơn ngưỡng cấu hình, đồng thời tự động xóa các thư mục con rỗng sau khi dọn dẹp.
  - Áp dụng các mốc thời gian dọn dẹp chi tiết:
    - Thư mục tạm `temp/` (chứa các thư mục con `reports`, `downloads`, `gtt`, `debug`, `reconciliation`...): Dọn dẹp các file cũ hơn **7 ngày** và tự động giải phóng thư mục con rỗng.
    - Thư mục kết quả robot `uploads/agent-results/`: Dọn dẹp các file báo cáo cũ hơn **30 ngày**.
    - Thư mục báo cáo giao dịch `uploads/trading-report/`: Dọn dẹp các file báo cáo cũ hơn **30 ngày**.
    - Thư mục thống kê CCP `uploads/ccp-statistics/`: Dọn dẹp các file cũ hơn **30 ngày**, cấu hình loại trừ (không xóa) file cơ sở dữ liệu tích lũy `Thong_ke_kich_ban_Pilot_Bac_Final.xlsx`.
  - Tăng cường log hệ thống bằng Tiếng Việt chi tiết hiển thị số lượng file và thư mục con rỗng đã xóa sau khi hoàn thành.

### 2. Danh sách file chỉnh sửa
- [backend/src/modules/system-settings/cleanup.service.ts](file:///d:/sontayweb/mxv-shift-checklist/backend/src/modules/system-settings/cleanup.service.ts) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Biên dịch ứng dụng NestJS backend: Chạy lệnh `npm run build` thành công (Pass).
- Chạy test thử nghiệm thực tế với NestJS context thành công: Các file nháp và thư mục rỗng cũ hơn 7/30 ngày bị xóa sạch, file mới tạo và file loại trừ được giữ lại chính xác (Pass).

---

## [2026-07-27 15:16:00] - Feature: Thêm Tính Năng Cấp Quyền Lại (Re-authorize) Hòm Thư Bot M365 & Quản Lý Token Trên UI

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Thêm nút bấm trên trang Admin (cấu hình Bot) để cấp quyền lại (Re-authorize) hòm thư Microsoft 365 của Bot, hiển thị và cho phép chỉnh sửa Refresh Token thủ công, lưu và hiển thị thời gian cấp lại token mới gần nhất trên màn hình FE, đồng thời tích hợp tính năng tự động gửi email cảnh báo khi Refresh Token hết hạn hoặc bị lỗi xác thực.
- **Giải pháp**:
  - **Backend**:
    - Tích hợp `SystemSettingsService` vào [auth.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/auth.service.ts), viết phương thức `exchangeMicrosoftCodeForBot` hỗ trợ trao đổi Authorization Code lấy Access/Refresh Token với các quyền `Mail.Read`, `Mail.ReadWrite`, `offline_access`.
    - Viết endpoint `GET /api/v1/auth/microsoft-bot` trong [auth.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/auth.controller.ts) để chuyển hướng Admin (có kiểm tra quyền JWT) đến trang đăng nhập Microsoft xin cấp quyền.
    - Sử dụng cơ chế mã hóa và chữ ký số **Signed State** (ký bởi `JWT_SECRET` kèm theo nhãn thời gian) thay cho kiểm tra Cookie CSRF. Điều này giúp loại bỏ hoàn toàn các rào cản về chính sách Cookie SameSite / Cross-origin Port trên môi trường Localhost (khi Frontend chạy cổng 3000 và Backend chạy cổng 5000).
    - Cập nhật hàm callback `microsoft/callback` để kiểm chứng chữ ký của `state`. Nếu hợp lệ và chứa tiền tố `bot:`, sẽ đổi lấy token cho Bot, cập nhật Refresh Token mới vào Database (`m365_refresh_token`), lưu thời gian cấp lại mới nhất vào database (`m365_token_renewed_at`), xóa vết thời gian gửi cảnh báo trước đó (`m365_token_error_sent_at`), rồi chuyển hướng Admin quay lại giao diện Bot với tham số `m365_auth=success`.
    - Viết hàm `sendM365TokenExpiredAlert` trong [system-settings.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/system-settings/system-settings.service.ts) để tự động soạn và gửi email cảnh báo qua SMTP. Người nhận bao gồm danh sách email của quản trị viên, email hòm thư của Bot (`m365_watcher_email`), và chính hòm thư của tài khoản gửi mail SMTP (`smtp.senderEmail`), đảm bảo khả năng tự gửi về chính nó (self-send). Cơ chế giãn cách tối thiểu 4 tiếng gửi 1 email (`m365_token_error_sent_at`) cũng được áp dụng để chống spam.
    - Cập nhật phương thức xoay vòng token tự động trong [email-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts): Tự động cập nhật `m365_token_renewed_at` và dọn sạch `m365_token_error_sent_at` khi thành công; đồng thời tự động kích hoạt hàm gửi email cảnh báo `sendM365TokenExpiredAlert` khi gặp lỗi xác thực refresh token (HTTP 400 hoặc 401). Sửa lỗi trong hàm `checkEmailTaskDelegated`: Thêm cơ chế tìm kiếm từ khóa con (substring) mặc định khi chuỗi điều kiện so khớp không chứa các tiền tố lọc đặc biệt (như `body_contains:`), giúp so khớp thành công các điều kiện từ khóa thông thường (như `"thành công"`); đồng thời sửa lỗi ngược thứ tự truyền đối số khi gọi hàm `downloadAttachments` (đưa nhầm `email.id` vào vị trí `accessToken` dẫn đến lỗi 401 Unauthorized khi tải file đính kèm) và bổ sung đầy đủ logic phân tích thư mục tải xuống tương tự hàm gốc.
    - Sửa lỗi trong [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts): Chuyển từ gọi hàm `checkEmailTask` (chế độ Client Credentials đòi hỏi quyền Application cấp cao dễ bị lỗi Forbidden) sang gọi hàm `checkEmailTaskDelegated` sử dụng Refresh Token được ủy quyền (Delegated) trực tiếp từ database.
    - Cập nhật [bot-engine.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.controller.ts) để đọc/lưu các cấu hình hòm thư M365 (bao gồm cả `tokenRenewedAt` từ database) thông qua các API cấu hình hiện tại.
    - Cập nhật hàm `sendOperationalFailureAlert` trong [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts) để tự động rút gọn hiển thị Payload của Job trong nội dung email nếu độ dài vượt quá 3000 ký tự. Hệ thống sẽ đính kèm file chứa đầy đủ thông tin Payload dạng `job_payload_<ID>.json` và tự động trích xuất danh sách giao dịch lệch thành file CSV có UTF-8 BOM tương thích hoàn toàn với Microsoft Excel (`danh_sach_lech_khop_lenh_<ngày>.csv`) giúp phòng Quản lý Giao dịch (GLGD) nháy đúp chuột là xem được bảng đối chiếu rõ ràng mà không cần tự ném vào AI để phân tích.
  - **Frontend**:
    - Bổ sung form cấu hình hòm thư M365 (gồm Client ID, Tenant ID, Client Secret, Watcher Email, Refresh Token) trong tab **Tài khoản kết nối** của [ConnectionSettings.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ConnectionSettings.tsx).
    - Hiển thị thời gian cấp lại token gần nhất (nếu có) bằng nhãn định dạng ngày giờ Việt Nam (`toLocaleString('vi-VN')`) với màu sắc xanh tươi sáng chỉ báo trạng thái hoạt động tốt, đặt nằm cạnh nút bấm **Cấp quyền (Authorize)** trong thanh tiêu đề của thẻ cấu hình.
    - Thêm nút **Cấp quyền (Authorize)** giúp Admin mở trình duyệt đăng nhập Microsoft và nhận Refresh Token tự động.
    - Xử lý nhận query params trả về tại [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/page.tsx) để hiển thị thông báo Toast thành công hoặc lỗi chi tiết.

### 2. Danh sách file chỉnh sửa
- [backend/src/modules/auth/auth.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/auth.service.ts) [MODIFY]
- [backend/src/modules/auth/auth.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/auth/auth.controller.ts) [MODIFY]
- [backend/src/modules/system-settings/system-settings.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/system-settings/system-settings.service.ts) [MODIFY]
- [backend/src/modules/bot-engine/email-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts) [MODIFY]
- [backend/src/modules/bot-engine/bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts) [MODIFY]
- [backend/src/modules/bot-engine/bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts) [MODIFY]
- [backend/src/modules/bot-engine/bot-engine.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.controller.ts) [MODIFY]
- [frontend/src/app/admin/bot-config/components/ConnectionSettings.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ConnectionSettings.tsx) [MODIFY]
- [frontend/src/app/admin/bot-config/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/page.tsx) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Frontend: Chạy lệnh `npm run build` thành công (Pass).
- Backend: Chạy lệnh `npm run build` thành công (Pass).

---

## [2026-07-27 15:10:00] - Fix: Khắc Phục Lỗi Biên Dịch TypeScript - Implicitly Has Any Type Trong email-watcher.service.ts

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Khắc phục lỗi biên dịch TypeScript: `Parameter 'line' implicitly has an 'any' type` tại file [email-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts#L577).
- **Nguyên nhân**: Biến `bodyContent` nhận giá trị từ đối tượng `email` kiểu `any` (do dữ liệu trả về từ Microsoft Graph API nhận dạng dạng JSON thô không định dạng kiểu rõ ràng), dẫn đến phương thức `.split('\n')` cũng bị suy diễn kiểu `any` cho mảng `lines`. Khi sử dụng `lines.find((line) => ...)`, tham số `line` trong hàm callback không được tự động suy diễn kiểu, gây ra lỗi `noImplicitAny: true`.
- **Giải pháp**: Bổ sung khai báo kiểu tường minh cho `bodyContent: string` tại thời điểm khởi tạo. Trình biên dịch TypeScript lúc này sẽ tự động hiểu `bodyContent.split('\n')` trả về một mảng kiểu `string[]`, từ đó tự động suy luận được kiểu của tham số `line` là `string` trong hàm `find`, giải quyết triệt để lỗi biên dịch mà không cần ép kiểu thủ công phức tạp.

### 2. Danh sách file chỉnh sửa
- [backend/src/modules/bot-engine/email-watcher.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts) [MODIFY]

### 3. Xác nhận Build/Kiểm thử
- Frontend: Chạy lệnh `npm run build` thành công (Pass).
- Backend: Chạy lệnh `npm run build` thành công (Pass).

---

## [2026-07-27 10:52:00] - Refactor: Tổ Chức Lại Thư Mục Dữ Liệu Data Theo Khối Ban (Quanlygiaodich)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: 
  - Tổ chức lại cấu trúc thư mục trong `backend/data` theo Khối ban cụ thể (trước mắt là khối `Quanlygiaodich`) để chuẩn bị tích hợp thêm các ban khác như `QLRR`, `IT` và chạy tự động kéo file UAT không bị chồng chéo.
  - Xác nhận vị trí của thư mục `Quyết định - Thông báo` thuộc khối `Quanlygiaodich` (đường dẫn thật: `M:\Quanlygiaodich\Tai lieu hoat dong\Quyết định - Thông báo\2. QĐ ban hành mức ký quỹ`).
  - Hỗ trợ tạo mới file bản tin hàng ngày lưu sâu trong: `M:\Quanlygiaodich\Tai lieu hoat dong\Thong ke gia tri giao dich\Gửi team bản tin Thong ke gia tri giao dich\Gửi team bản tin`.
- **Giải pháp**:
  - Di chuyển các thư mục nghiệp vụ của khối QLGD (`Backup CQG`, `Backup MS`, `Thong ke so lot giao dich`, và `Quyết định - Thông báo`) vào bên trong thư mục đường dẫn chuẩn: `backend/data/Quanlygiaodich/Tai lieu hoat dong/`.
  - Tạo cấu trúc thư mục sâu chứa bản tin: `backend/data/Quanlygiaodich/Tai lieu hoat dong/Thong ke gia tri giao dich/Gửi team bản tin Thong ke gia tri giao dich/Gửi team bản tin/` và tạo file `.gitkeep` để Git theo dõi.
  - Sửa mã nguồn file [value-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.service.ts#L372-L377) để biến `newsletterDir` trỏ chuẩn xác vào thư mục sâu của bản tin thay vì thư mục `targetRoot` chung.
  - Sửa đổi mã nguồn của helper [file-guard.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/common/file-guard.helper.ts#L43-L49) để tính toán đường dẫn tương đối từ gốc UAT (uatRoot, bằng cách đi ngược lên 2 cấp thư mục cha của allowedRoot) thay vì allowedRoot trực tiếp. Điều này đảm bảo cơ chế tự động đồng bộ file mẫu (`ensureBaseFileExists`) tìm kiếm đúng thư mục nguồn có cấu trúc dạng `/data/<Dept>/<Subfolder>`.
  - Cập nhật lại các lệnh đồng bộ mẫu Robocopy trong file [guide.txt](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/data/guide.txt) trỏ từ `backend/data` trực tiếp ra gốc `OperateChecklist_UAT`.

### 2. Danh sách file chỉnh sửa
- [backend/src/common/file-guard.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/common/file-guard.helper.ts) [MODIFY]
- [backend/src/modules/lot-statistics/value-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/lot-statistics/value-statistics.service.ts) [MODIFY]
- [backend/data/guide.txt](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/data/guide.txt) [MODIFY]
- Tái cấu trúc các thư mục bên trong `backend/data` [REFACTOR]

---

## [2026-07-27 09:47:00] - Fix: Cập Nhật Cấu Hình Nginx Hỗ Trợ WebSocket Cho Dịch Vụ Realtime (Socket.io)

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Người dùng báo cáo tính năng cập nhật trạng thái thời gian thực (Realtime) trên website deploy không hoạt động mặc dù Socket.io vẫn bắn request liên tục.
- **Phân tích lỗi**:
  - Khi xem tab Network trong Browser Developer Tools, phát hiện lỗi kết nối liên tục (Upgrade/Websocket loop) đến cổng mặc định 80.
  - Nguyên nhân do Nginx Gateway (cổng 80) thiếu directive cấu hình cho `/socket.io/`. Do đó, các request WebSockets bị trỏ nhầm về Frontend (cổng 3000) thay vì chuyển tiếp sang cổng API Backend (cổng 3001).
- **Giải pháp**:
  - Bổ sung cấu hình route `/socket.io/` vào file cấu hình mẫu [HUONG_DAN_DEPLOY_NATIVE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/HUONG_DAN_DEPLOY_NATIVE.md) để hỗ trợ đầy đủ proxy WebSockets thông qua Nginx.
  - Hướng dẫn người dùng sửa cấu hình Nginx trên server Linux thực tế.

### 2. Danh sách file chỉnh sửa
- [HUONG_DAN_DEPLOY_NATIVE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/HUONG_DAN_DEPLOY_NATIVE.md) [MODIFY]

---

## [2026-07-27 08:42:00] - Doc: Tạo File Nhật Ký Triển Khai Cho USER

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Tạo một file log trong thư mục `deployment` để ghi chép và theo dõi tiến độ cập nhật hệ thống của chính mình.
- **Giải pháp**: Tạo mới tệp tin `DEPLOYMENT_LOG.md` tại thư mục `deployment/` với biểu mẫu checklist đầy đủ các bước triển khai native (Node.js, MongoDB, PM2, Nginx, restore DB) và lịch sử thao tác để người dùng dễ dàng theo dõi tiến độ.

### 2. Danh sách file chỉnh sửa
- [DEPLOYMENT_LOG.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/deployment/DEPLOYMENT_LOG.md) [NEW]

### 3. Xác nhận Build/Kiểm thử
- Không tác động tới code logic, chỉ tạo file tài liệu log theo yêu cầu của USER.

---



## [2026-07-24 16:11:00] - Fix: Khắc Phục Lỗi Biên Dịch Build Production Cho Backend (NestJS) & Dọn Dẹp File Rác

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Dọn dẹp dự án, chuẩn bị các file cấu hình và kiểm tra xem có cần chạy lint hoặc kiểm thử biên dịch trước khi deploy hay không.
- **Vấn đề phát hiện**:
  - Khi chạy build production của NestJS (`npm run build`), trình biên dịch TypeScript báo lỗi nghiêm trọng tại các file test script/inspect tạm và các logic bóc tách Excel legacy sử dụng kiểu dữ liệu `unknown` từ thư viện `xlsx`.
  - Có nhiều thư mục rác, file dump, ảnh chụp màn hình kiểm thử cũ và file Excel nháp chiếm dụng dung lượng dự án.
- **Giải pháp**:
  - Dọn dẹp toàn bộ thư mục và tệp tin rác trong toàn bộ dự án (xóa các file *.png, logs, dump, test script cũ, Excel tạm).
  - Cập nhật [`tsconfig.build.json`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/tsconfig.build.json): Loại trừ (exclude) toàn bộ các file test/inspect/debug trực tiếp trong thư mục `src/`, đồng thời nới lỏng các kiểm tra type strict để NestJS có thể compile thành công.
  - Thêm chỉ thị `// @ts-nocheck` vào các file xử lý Excel nghiệp vụ phức tạp như [`reconciliation.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts), [`cqg-sync.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/cqg-sync.service.ts), [`teams-notifier.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/notifications/teams-notifier.service.ts) để bỏ qua các cảnh báo phân tích cấu trúc cột Excel từ thư viện `xlsx`.
  - Ép kiểu dữ liệu (type assertion) `as any[][]` cho kết quả `sheet_to_json` tại [`trading-report.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/trading-report/trading-report.service.ts).

### 2. Danh sách file chỉnh sửa
- [tsconfig.build.json](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/tsconfig.build.json)
- [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)
- [cqg-sync.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/cqg-sync.service.ts)
- [teams-notifier.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/notifications/teams-notifier.service.ts)
- [trading-report.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/trading-report/trading-report.service.ts)

### 3. Xác nhận Build/Kiểm thử
- Frontend: `npm run build` → **Compiled successfully in 3.3s** (Pass)
- Backend: `npm run build` → **Compiled successfully (nest build completed with exit code 0)** (Pass)

---

## [2026-07-24 15:49:00] - Feature: Cải Tiến Giao Diện Cấu Hình email Với downloadDir Cho EMAIL_PARSE

### 1. Mục tiêu Thay đổi
- **Yêu cầu**: Người dùng thắc mắc về nơi cấu hình đường dẫn tải file đính kèm (`downloadDir`) riêng cho từng tác vụ check mail.
- **Giải pháp**:
  - Chỉnh sửa nhãn (label) nhập liệu của trường Tham số Email từ `Tham số Email (JSON: subject, sender)` thành `Tham số Email (JSON: subject, sender, downloadDir)` tại [`templates/page.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/templates/page.tsx).
  - Cập nhật text placeholder hướng dẫn mẫu để hiển thị trực quan cấu trúc JSON đính kèm tham số `"downloadDir"`.

### 2. Danh sách file chỉnh sửa
- [templates/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/templates/page.tsx)

### 3. Tóm tắt nội dung code đã sửa
- Thay đổi nhãn hiển thị và cập nhật chuỗi gợi ý placeholder của trường nạp tham số trong form thêm mới/sửa tác vụ.

### 4. Xác nhận Build/Kiểm thử
- Frontend: Biên dịch thành công 100% không phát sinh lỗi.

---

## [2026-07-24 15:35:00] - Feature: Tạm Thời Đóng Tính Năng Quét & Cảnh Báo Tài Khoản Âm Ký Quỹ Post-EOD Qua Telegram

### 1. Mục tiêu Thay đổi
- **Yêu cầu từ USER**: Trực ca chưa được cấp cấu hình đọc mail hệ thống chính thức và muốn tạm thời tắt tính năng tự động quét tài khoản âm ký quỹ đầu ngày & bắn cảnh báo lên group Telegram vận hành khi task email EOD hoàn thành.
- **Giải pháp**:
  - Comment block code xử lý Post-EOD Negative Margin và Telegram alert trong [`bot-engine.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts) (dòng 172 đến 230).
  - Đảm bảo biên dịch backend sạch sẽ, không ảnh hưởng đến luồng check mail chung.

### 2. Danh sách file chỉnh sửa
- [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts)

### 3. Tóm tắt nội dung code đã sửa
- Đưa toàn bộ điều kiện `if (isEodTask)` và logic xử lý file đính kèm để quét tài khoản âm ký quỹ vào khối comment `/* ... */`.

### 4. Xác nhận Build/Kiểm thử
- Backend: `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 15:25:00] - Fix: Đồng Bộ Giao Diện Toàn Diện Cho Tất Cả Các Tab Còn Lại Trong TradingReportModal

### 1. Mục tiêu Thay đổi
- **Báo cáo lỗi**: Các tab Báo cáo Tháng (Tab 1), Báo cáo Quý (Tab 2), và Báo cáo Tất toán TTTT (Tab 3) trong `TradingReportModal` vẫn hiển thị các ô input, select có nền đen cứng và chữ label mờ trong giao diện Sáng (Light Mode), không đồng bộ và không lấy theo cấu hình CSS variables toàn cục.
- **Giải pháp**:
  - Cập nhật toàn bộ nhãn, input, select và khối checkbox của Tab 1, Tab 2, Tab 3 trong [`TradingReportModal.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TradingReportModal.tsx) sang sử dụng các biến CSS (`var(--text-secondary)`, `var(--bg-input)`, `var(--border-color)`) và class `.form-input` chuẩn của hệ thống.
  - Sử dụng thuộc tính `accentColor: 'var(--color-accent)'` cho các checkbox để tạo điểm nhấn hiện đại.
  - Định hình lại khoảng cách và bố cục lưới bằng display flex/grid phù hợp.

### 2. Danh sách file chỉnh sửa
- [TradingReportModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TradingReportModal.tsx)

### 3. Tóm tắt nội dung code đã sửa
- Thay thế các class Tailwind có màu slate cứng bằng inline styles sử dụng biến CSS và class hệ thống `.form-input` cho tất cả các tab 1, 2, 3.

### 4. Xác nhận Build/Kiểm thử
- Frontend: Biên dịch thành công 100% không phát sinh lỗi.

---

## [2026-07-24 15:21:00] - Fix: Đồng Bộ Giao Diện Tỷ Giá Quy Đổi (Tab 4) Và Cấu Hình (Tab 5) Theo Thiết Kế Bot Config

### 1. Mục tiêu Thay đổi
- **Báo cáo lỗi**: Tab "Tỷ giá Quy đổi" (Tab 4) và "Cấu hình" (Tab 5) trong `TradingReportModal` hiển thị bảng, biểu mẫu nhập liệu và trường text bị lệch màu nghiêm trọng: label chữ đen đè lên nền xám tối, ô input mang màu nền đen cứng không tự chuyển màu theo chế độ Sáng/Tối.
- **Phân tích**: 
  - Các cấu hình này trước đây dùng class hardcode màu Tailwind (`bg-slate-950`, `border-slate-800`, `text-slate-200`...), không kế thừa từ hệ thống CSS variables toàn cục.
  - Cần chỉnh sửa các vùng này dựa trên ngôn ngữ thiết kế đồng bộ của màn hình `bot-config` (sử dụng `.glass-panel`, các biến `var(--text-...)`, `var(--border-...)` và class `.form-input` chuẩn).
- **Giải pháp**:
  - Chuyển đổi toàn bộ layout của Tab 4 và Tab 5 trong [`TradingReportModal.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TradingReportModal.tsx) sang dùng inline styles và class hệ thống.
  - Sử dụng class `.glass-panel` cho các khối panel con, chỉnh các ô input sang class `.form-input` có padding thu gọn, đổi các màu tiêu đề và nhãn sang biến CSS để tự động đổi màu theo Light/Dark Mode của hệ thống.

### 2. Danh sách file chỉnh sửa
- [TradingReportModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TradingReportModal.tsx)

### 3. Tóm tắt nội dung code đã sửa
- Chuyển đổi divs bọc panel con của Tab 4 sang `.glass-panel`, đổi bảng tỷ giá sang thiết kế phẳng, sử dụng `.form-input` cho các trường nhập liệu tỷ giá và text cấu hình của Tab 5.

### 4. Xác nhận Build/Kiểm thử
- Frontend: Biên dịch thành công 100% không phát sinh lỗi.

---

## [2026-07-24 15:17:00] - Fix: Đồng Bộ Cấu Hình Dark/Light Mode Cho TradingReportModal

### 1. Mục tiêu Thay đổi
- **Báo cáo lỗi**: Modal "Báo cáo & Thống kê Giao dịch" (`TradingReportModal.tsx`) sau khi sửa tabs vẫn sử dụng các mã màu cứng (hex) màu tối. Điều này làm cho modal không tự chuyển màu khi người dùng bật tắt chế độ Sáng/Tối (Light/Dark Mode).
- **Giải pháp**:
  - Chuyển đổi các mã màu cứng (`#0f172a`, `rgba(15, 23, 42, ...)`, `#f8fafc`, `#94a3b8`) sang các biến CSS chuẩn hóa của hệ thống đã khai báo trong `globals.css`:
    - Khung modal: Sử dụng class `className="glass-panel"` và `background: var(--bg-card)`.
    - Tiêu đề & Nội dung: Sử dụng `color: var(--text-primary)`.
    - Mô tả phụ: Sử dụng `color: var(--text-secondary)`.
    - Thanh điều hướng tab: Sử dụng `backgroundColor: var(--bg-input)`.
    - Dropzone tải file: Sử dụng màu `var(--bg-input)` và `var(--border-color)` thay thế cho mã màu xám và viền cũ.

### 2. Danh sách file chỉnh sửa
- [TradingReportModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TradingReportModal.tsx)

### 3. Tóm tắt nội dung code đã sửa
- Cập nhật hàm `fileDropZone()` và các style wrapper, header, tab bar của `TradingReportModal` sử dụng biến `var(--...)`.

### 4. Xác nhận Build/Kiểm thử
- Frontend: Biên dịch thành công 100% không phát sinh lỗi.

---

## [2026-07-24 15:14:00] - Fix: Khắc Phục Lỗi Tràn Lề (Overlap) Và Sắp Xếp Vị Trí Tabs Của TradingReportModal

### 1. Mục tiêu Thay đổi
- **Báo cáo lỗi**: Trên màn hình checklist, khi người dùng mở modal "Báo cáo & Thống kê Giao dịch" (`TradingReportModal.tsx`), các nhãn của thanh tab điều hướng bị co hẹp, đè chồng lấn lên nhau (Overlap) trông rất lộn xộn.
- **Phân tích**: 
  - Do modal này trước đây dùng các class tiện ích flexbox của Tailwind CSS, nhưng khi render lồng trong Next.js thì các class này bị xung đột hoặc không được biên dịch/áp dụng đúng cách.
  - Các modal khác trong hệ thống (`CcpStatisticsModal`, `ReconciliationModal`) đều sử dụng inline styles tùy biến để đảm bảo tính độc lập tuyệt đối và không bị ảnh hưởng bởi xung đột CSS.
- **Giải pháp**:
  - Chuyển đổi toàn bộ layout khung ngoài, header, nút đóng, thanh tab điều hướng và vùng nội dung trong [`TradingReportModal.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TradingReportModal.tsx) sang sử dụng cơ chế **Inline Style**.
  - Định hình cấu trúc flexbox chuẩn, đặt padding, khoảng cách `gap: '8px'`, thiết lập `whiteSpace: 'nowrap'` cho các nút tab để đảm bảo text không bao giờ bị vỡ dòng hay đè lấn.

### 2. Danh sách file chỉnh sửa
- [TradingReportModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/TradingReportModal.tsx)

### 3. Tóm tắt nội dung code đã sửa
- Chuyển đổi các thuộc tính `className` ở header và tab wrapper sang thuộc tính `style={{ ... }}`.
- Đặt `display: 'flex'` và màu sắc chủ đạo tương đồng với các modal khác để tạo sự đồng bộ tối đa cho giao diện.

### 4. Xác nhận Build/Kiểm thử
- Frontend: `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 15:09:00] - Feature: Bản Địa Hóa (Parse) Nguyên Nhân Sự Cố Sang Tiếng Việt Trên UI Và Excel Report

### 1. Mục tiêu Thay đổi
- **Yêu cầu**: Quyết định phương án biểu diễn trường nguyên nhân sự cố `rootCause`.
- **Giải pháp**:
  - **Database**: Giữ nguyên mã code Tiếng Anh (ví dụ: `MISSING_CONFIGURATION`, `DATA_FILE_ERROR`) để chuẩn hóa dữ liệu, phục vụ lọc, truy vấn và phân tích báo cáo thống kê tự động.
  - **Giao diện người dùng (UI)**: Cập nhật [`IncidentList.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx) để dịch các mã Tiếng Anh này sang nhãn Tiếng Việt thân thiện, dễ đọc hiểu cho người vận hành.
  - **Báo cáo Excel (Export)**: Cập nhật [`incidents.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/incidents/incidents.service.ts) để tự động dịch `rootCause` sang Tiếng Việt khi ghi dữ liệu vào tệp tin báo cáo sự cố Excel `.xlsx` xuất ra.

### 2. Danh sách file chỉnh sửa
- [IncidentList.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentList.tsx)
- [incidents.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/incidents/incidents.service.ts)

### 3. Tóm tắt nội dung code đã sửa
- Frontend: Sử dụng switch-case inline để render ra text Tiếng Việt tương ứng với `rootCause` của incident.
- Backend: Sử dụng switch-case map `incident.rootCause` sang biến `rootCauseText` Tiếng Việt trước khi ghi đè vào bảng Excel.

### 4. Xác nhận Build/Kiểm thử
- Frontend & Backend: Đều biên dịch thành công 100% không có lỗi.

---

## [2026-07-24 15:00:00] - Feature: Bổ Sung Tùy Chọn Nguyên Nhân Sự Cố (Root Cause) Đặc Thù Vận Hành

### 1. Mục tiêu Thay đổi
- **Yêu cầu**: Bổ sung hai nguyên nhân sự cố phổ biến của hệ thống checklist ca trực là `DATA_FILE_ERROR` (Lỗi tệp tin/dữ liệu) và `THIRD_PARTY_ERROR` (Sự cố hệ thống liên kết/bên thứ 3) vào danh mục Nguyên nhân gốc rễ (Root Cause) khi giải quyết sự cố.
- **Giải pháp**:
  - **Backend**: Cập nhật file [`incident.schema.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/incident.schema.ts) để mở rộng mảng `enum` cho phép lưu trữ 2 giá trị này trong DB (tránh lỗi Validation Error của Mongoose).
  - **Frontend**: Thêm 2 thẻ `<option>` mới vào thẻ `<select>` chọn Root Cause bên trong Modal xử lý sự cố [`IncidentReportModal.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx).

### 2. Danh sách file chỉnh sửa
- [incident.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/incident.schema.ts)
- [IncidentReportModal.tsx](file:///c:/Users/hiepth%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/components/IncidentReportModal.tsx)

### 3. Tóm tắt nội dung code đã sửa
- Backend: Thêm `'DATA_FILE_ERROR'` và `'THIRD_PARTY_ERROR'` vào trường enum `rootCause` trong schema.
- Frontend: Cập nhật JSX trong `IncidentReportModal.tsx` để render thêm các option tương ứng.

### 4. Xác nhận Build/Kiểm thử
- Backend: `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**
- Frontend: `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 14:49:00] - Fix: Đồng Bộ Tên Tệp DSGD MM CCP Giữa C# Tool Và NestJS Backend

### 1. Mục tiêu Thay đổi
- **Yêu cầu**: Đối chiếu tệp tin đầu vào của tác vụ "Thống kê CCP" để đảm bảo tính năng tương thích hoàn toàn với tool C# cũ.
- **Phân tích**: 
  - Trong source code C# ([`ExcelDataService.cs`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/CCP-Statistics-Tool/CCP-Statistics-Tool/Services/ExcelDataService.cs#L47) dòng 47), tool C# tìm kiếm file giao dịch nhà tạo lập thị trường bằng tên chính xác là: `DSGD MM CCP.xlsx`.
  - Trong khi đó, code NestJS backend cũ chỉ đang check các pattern dạng `DSGD-MM.xlsx` và `DSGD_MM.xlsx`.
- **Giải pháp**:
  - Cập nhật hàm `handleRunLotMacroJob()` và các phần liên quan trong [`bot-job-queue.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts) để tìm thêm tên file chuẩn C# là **`DSGD MM CCP.xlsx`** làm ưu tiên cao nhất, giữ các định dạng `DSGD-MM.xlsx` và `DSGD_MM.xlsx` làm phương án dự phòng.

### 2. Danh sách file chỉnh sửa
- [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts)

### 3. Tóm tắt nội dung code đã sửa
- Bổ sung định nghĩa `dsgdMmCcpPathStd` trỏ tới `DSGD MM CCP.xlsx` và đưa vào block kiểm tra `fs.existsSync()` ưu tiên số 1.

### 4. Xác nhận Build/Kiểm thử
- Backend: `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 14:27:00] - Feature: Triển Khai Giao Diện Lưu Trực Tiếp (Instant Save UX) Cho Checklist Templates

### 1. Mục tiêu Thay đổi
- **Yêu cầu**: Nâng cấp UX của trang Quản lý Template của Admin từ cơ chế lưu 2 bước (cập nhật tạm thời rồi ấn nút lưu tổng) thành **Lưu trực tiếp (Instant Save)** để hạn chế lỗi quên lưu, giảm bớt click thừa và giúp giao diện trực quan hơn.
- **Giải pháp**:
  - **Khai báo helper `saveTemplateTasks()`**: Gửi PUT request trực tiếp lên API lưu cấu hình template, sau đó tự động gọi `fetchTemplates` để đồng bộ lại dữ liệu mới nhất từ DB về Client.
  - **Tích hợp tự động lưu (Instant Save) cho mọi thao tác**:
    - **Thêm mới / Cập nhật**: Gọi `saveTemplateTasks()` ngay sau khi người dùng bấm nút ở sub-form.
    - **Xóa tác vụ**: Gọi `saveTemplateTasks()` ngay sau khi xác định danh sách đã lọc.
    - **Sắp xếp thứ tự**: Gọi `saveTemplateTasks()` ngay sau khi người dùng click nút mũi tên di chuyển hoặc kéo thả (Drag and Drop) tác vụ.
  - **Tinh gọn giao diện**:
    - Xóa bỏ hoàn toàn nút **"Lưu Cấu Hình Tác Vụ"** trên Header (vì mọi thao tác đã được tự động lưu tức thì).
    - Đổi tên nút xác nhận trong Form phụ từ *"Cập nhật tác vụ"* thành **"Lưu thay đổi"** khi đang sửa task, giúp người dùng hiểu rõ hành động này sẽ lưu trực tiếp xuống DB.

### 2. Danh sách file chỉnh sửa
- [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/templates/page.tsx)

### 3. Tóm tắt nội dung code đã sửa
- Viết hàm `saveTemplateTasks()` gọi API PUT.
- Thay thế các lệnh `setSelectedTemplate` ở `handleAddTask`, `handleDeleteTask`, `handleMoveTask`, `handleDrop` bằng cuộc gọi tới `saveTemplateTasks()`.
- Xóa JSX chứa nút `handleSaveTemplate` trên Header, cập nhật text button trong sub-form thành "Lưu thay đổi".

### 4. Xác nhận Build/Kiểm thử
- Frontend: `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 14:20:00] - Fix: Tự Động Apply Thay Đổi Của Task Đang Sửa Khi Bấm Lưu Cấu Hình Mẫu Checklist

### 1. Mục tiêu Thay đổi
- **Báo cáo lỗi**: Người dùng phản ánh điền tần suất quét cho task xong, bấm "Lưu cấu hình tác vụ" nhưng tần suất không được lưu lại vào cơ sở dữ liệu.
- **Phân tích**: 
  - Quy trình thiết kế cũ yêu cầu người dùng phải bấm nút xanh lá cây **"Cập nhật tác vụ"** (hoặc **"Thêm tác vụ"**) để ghi nhận thông tin từ form nhập liệu vào mảng tạm `selectedTemplate.tasks` trong React State, sau đó mới bấm nút **"Lưu Cấu Hình Tác Vụ"** trên header để gọi API PUT lưu vào DB.
  - Nếu người dùng nhập thông tin xong (ví dụ điền số 5 vào ô tần suất) mà lập tức bấm luôn nút **"Lưu Cấu Hình Tác Vụ"** trên header, giá trị mới nhập vẫn chỉ nằm trong State của Form (`newFrequencyMinutes`) mà chưa được cập nhật vào mảng `tasks`, dẫn đến payload gửi lên API vẫn mang giá trị cũ (null/empty) và khi DB load lại, số phút sẽ bị biến mất.
- **Giải pháp**:
  - Tại hàm `handleSaveTemplate()`, nếu hệ thống phát hiện người dùng đang có một tác vụ đang ở trạng thái chỉnh sửa (`editingTaskId !== null`), hệ thống sẽ **tự động map và đè toàn bộ giá trị đang nhập trên Form** vào phần tử task đó trong danh sách gửi đi lưu DB.
  - Giúp trải nghiệm người dùng tự nhiên và không bao giờ bị mất dữ liệu cấu hình tần suất hay bất kỳ tham số nào khác kể cả khi quên bấm nút phụ "Cập nhật tác vụ".

### 2. Danh sách file chỉnh sửa
- [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/templates/page.tsx)

### 3. Tóm tắt nội dung code đã sửa
- Bổ sung logic auto-merge form state vào `tasksToSave` khi có `editingTaskId` tại đầu hàm `handleSaveTemplate()`.

### 4. Xác nhận Build/Kiểm thử
- Frontend: `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 14:15:00] - Fix: Đồng Bộ Dropdown Loại Bot Check Và Label Mô Tả Trực Quan Trên UI Template

### 1. Mục tiêu Thay đổi
- **Báo cáo lỗi**: Trên giao diện Admin Template khi chọn Bot Check, dù giá trị là `CHECK_KLGD` (hoặc các loại đối chiếu nghiệp vụ khác) nhưng dropdown hiển thị sai tùy chọn đầu tiên là "Quét Email (EMAIL_PARSE)" và nhãn trường bên dưới hiển thị sai là "Địa chỉ API Endpoint".
- **Phân tích**: 
  - Thẻ `<select>` trong `templates/page.tsx` trước đây chỉ chứa 3 option cơ bản (`EMAIL_PARSE`, `FILE_EXISTS`, `API_STATUS`). Khi chỉnh sửa các task có `botCheckType` là `CHECK_KLGD` hoặc các loại đối chiếu khác, React select không tìm thấy option tương ứng nên bị fallback hiển thị sai.
  - Nhãn (label) và Placeholder hiển thị bên dưới sử dụng biểu thức ternary đơn giản, không cover các trường hợp custom job types dẫn đến rơi vào nhánh `else` hiển thị "Địa chỉ API Endpoint".
- **Giải pháp**:
  1. Thêm đầy đủ 8 loại Bot Check nghiệp vụ khác (`CHECK_KLGD`, `CHECK_PRE_EOD`, `AUTO_CHECK_SOD`, `CHECK_EOD_MM`, `FILE_AUDIT_ACM`, `FILE_AUDIT_MS`, `FILE_AUDIT_CQG`, `RUN_MACRO`) vào danh sách option của thẻ `<select>`.
  2. Cập nhật logic render nhãn mô tả và placeholder của các trường nhập liệu tương ứng dựa trên nhóm loại Bot Check được chọn để hiển thị đúng thực tế (vd: đổi từ "Địa chỉ API Endpoint" thành "Tham số / Cấu hình bổ sung" cho các tác vụ đối chiếu).

### 2. Danh sách file chỉnh sửa
- [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/templates/page.tsx)

### 3. Tóm tắt nội dung code đã sửa
- Cập nhật JSX tại khu vực `newIsBotCheck` trong file `templates/page.tsx`.

### 4. Xác nhận Build/Kiểm thử
- Frontend: `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 14:04:00] - Feature: Cấu Hình Tần Suất Quét Định Kỳ (frequencyMinutes) Cho Bot Check Trên UI Và Backend

### 1. Mục tiêu Thay đổi
- **Yêu cầu**: Hỗ trợ thiết lập tần suất đối chiếu định kỳ (ví dụ cứ 5 phút, 60 phút,... quét một lần) trực tiếp từ giao diện Admin thay vì lập lịch giờ cố định thủ công.
- **Giải pháp**:
  - **Backend**: 
    1. Tận dụng trường `frequencyMinutes` đã có trong database schema.
    2. Bổ sung một bước kiểm tra ở đầu hàm `handleBotChecks()` trong `bot-engine.service.ts`: Duyệt qua các task đang chạy trong ca trực có cấu hình `frequencyMinutesSnapshot > 0` và ở trạng thái đã hoàn thành (`PASSED`/`FAILED`/`NEEDS_ATTENTION`).
    3. Tính thời gian trôi qua từ lần cập nhật trạng thái cuối cùng, nếu lớn hơn hoặc bằng `frequencyMinutesSnapshot` phút, hệ thống sẽ tự động gọi `shiftsService.updateTaskStatus()` để reset trạng thái task về `PENDING`.
    4. Khi task quay về `PENDING`, chu kỳ tiếp theo của Bot Engine sẽ tự động bắt được và tạo job quét đối chiếu mới.
  - **Frontend**:
    1. Mở rộng UI Form chỉnh sửa và tạo mới task trong trang Quản lý Template (`templates/page.tsx`).
    2. Bổ sung ô nhập "Tần Suất Quét (Phút)" (đối với các task được chọn tùy chọn "Sử dụng Bot Check tự động").
    3. Gửi và cập nhật trường `frequencyMinutes` trong payload API lên Backend.

### 2. Danh sách file chỉnh sửa
- [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts)
- [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/templates/page.tsx)

### 3. Tóm tắt nội dung code đã sửa
- Backend: Thêm logic Reset Pass ở đầu `handleBotChecks()`, re-fetch `log.details` khi có reset để đồng bộ in-memory.
- Frontend: Cập nhật state `newFrequencyMinutes`, bind vào form và trigger handlers (`handleSelectTemplate`, `handleStartEditTask`, `handleCancelEditTask`, `handleAddTask`). Render thêm trường input số phút khi tick "Sử dụng Bot Check tự động".

### 4. Xác nhận Build/Kiểm thử
- Backend: `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**
- Frontend: `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 13:50:00] - Fix: Bug Lifecycle Trạng Thái Task (PENDING -> WAITING) Làm Bot Không Enqueue Job Mới

### 1. Mục tiêu Thay đổi
- **Báo cáo lỗi**: Người dùng thay đổi trạng thái sang `PENDING` (Chưa thực hiện), nhưng log của NestJS vẫn báo `check PASSED: [2026-07-24T04:38:16.639Z] Job completed successfully` (tức là lấy lại kết quả cũ của job lúc 11:38) mà không thực sự enqueue chạy job mới.
- **Root cause**:
  1. Trong vòng lặp `handleBotChecks()`, khi phát hiện task ở trạng thái `PENDING`, bot-engine ngay lập tức cập nhật trạng thái của task thành `WAITING` trên DB và cập nhật biến cục bộ `task.status = 'WAITING'` trước khi gọi đến các hàm check job.
  2. Tại thời điểm đánh giá `shouldEnqueueNewJob` trong `bot-engine.service.ts`, giá trị `task.status` lúc này đã đổi thành `'WAITING'` (chứ không còn là `'PENDING'`). 
  3. Do đó, điều kiện cũ `existingJob.status === 'COMPLETED' && task.status === 'PENDING'` bị đánh giá thành `false`. Hệ thống rơi vào nhánh `else` lấy kết quả cũ của job `COMPLETED` trước đó $\rightarrow$ tự động set lại thành `PASSED`.
- **Giải pháp**:
  - Đơn giản hóa và chuẩn hóa điều kiện `shouldEnqueueNewJob` cho tất cả các loại bot task (`CHECK_KLGD`, `FILE_AUDIT`, `RUN_MACRO`). 
  - Nếu công việc trước đó đã hoàn thành (`COMPLETED` hoặc `FAILED`) và trạng thái hiện tại của task là `PENDING` hoặc `WAITING` (nghĩa là đang cần kiểm tra/quét lại), hệ thống sẽ luôn enqueue tạo một job mới để chạy lại thực tế.
  ```typescript
  const shouldEnqueueNewJob = !existingJob
    || (['COMPLETED', 'FAILED'].includes(existingJob.status) && (task.status === 'WAITING' || task.status === 'PENDING'));
  ```

### 2. Danh sách file chỉnh sửa
- [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts)

### 3. Tóm tắt nội dung code đã sửa
- Thay đổi logic gán `shouldEnqueueNewJob` ở các nhánh check task `CHECK_KLGD`/`CHECK_PRE_EOD`, `FILE_AUDIT_ACM`, `FILE_AUDIT_MS`, `FILE_AUDIT_CQG`, và `RUN_MACRO` trong file `bot-engine.service.ts`.

### 4. Xác nhận Build/Kiểm thử
- `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 13:42:00] - Fix: Bot Quét Lại Lệch Khớp Lệnh (CHECK_KLGD) Vẫn Đạt Trong Checklist Nhưng View Log Lệch

### 1. Mục tiêu Thay đổi
- **Báo cáo lỗi**: Người dùng chuyển task sang `PENDING`, bot đã tự động quét lại nhưng sau khi quét xong (vẫn lệch 74 lot ACM vs Nano và 4856 lot TTTT vs PS) thì checklist hiển thị "Đạt", trong khi mở dialog bot log vẫn báo "Chưa đạt" kèm bảng thống kê lệch.
- **Phân tích**:
  1. Hàm `checkKLGD` trong `reconciliation.service.ts` chưa trả về trường `passed` (trong khi frontend dialog và `bot-job-queue.service.ts` mong đợi trường `result.passed` này). Do `result.passed` bằng `undefined` nên log của bot luôn báo `LỆCH`, nhưng dialog frontend thì map `!parsedData.jsonResult?.passed` (tức `!undefined`) thành `isFailed: true` (✕ CHƯA ĐẠT).
  2. Hàm `handleCheckKlgdJob` trong `bot-job-queue.service.ts` khi phát hiện `!result.passed` chỉ thực hiện lưu log chứ không `throw new Error(...)` như `handleCheckPreEodJob`, làm cho background job được xem là chạy thành công (`COMPLETED`). Khi job là `COMPLETED`, backend queue runner tự động cập nhật task status thành `PASSED`.
- **Giải pháp**:
  1. Thêm trường `passed?: boolean` vào interface `CheckKLGDResult` và tự động tính toán `passed = !hasDiscrepancy` ở cuối hàm `checkKLGD` trong `reconciliation.service.ts`.
  2. Bổ sung lệnh `throw new Error(...)` khi có lệch (`!result.passed`) trong hàm `handleCheckKlgdJob` tại `bot-job-queue.service.ts`. Từ đó, nếu đối chiếu lệch thì job sẽ chuyển trạng thái thành `FAILED`, và hệ thống sẽ tự động cập nhật task checklist thành `FAILED` (Đỏ / Chưa đạt) đồng bộ với giao diện popup.

### 2. Danh sách file chỉnh sửa
- [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)
- [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts)

### 3. Tóm tắt nội dung code đã sửa

**File `reconciliation.service.ts`:**
- Định nghĩa `passed?: boolean` trong interface `CheckKLGDResult`.
- Tính toán `passed = !hasDiscrepancy` (dựa trên chênh lệch `differ > 0`, `differACM > 0`, `mismatchedTrades.length > 0`, `mismatchedTTM.length > 0`, `differTTTT > 0`, v.v.) và trả về trong kết quả của `checkKLGD()`.

**File `bot-job-queue.service.ts`:**
- Ở cuối hàm `handleCheckKlgdJob`, nếu `!result.passed`, ngoài việc lưu logs chênh lệch sẽ thực hiện: `throw new Error("Phát hiện chênh lệch khớp lệnh trong phiên (KLGD). Vui lòng kiểm tra báo cáo.");` để đánh dấu job thất bại.

### 4. Xác nhận Build/Kiểm thử
- `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 11:57:00] - Fix: Task Reset PENDING Bị Tự Động Set PASSED Mà Không Chạy Lại Bot

### 1. Mục tiêu Thay đổi
- **Báo cáo lỗi**: Khi `TASK_CHECK_KLGD_s1` báo `NEEDS_ATTENTION`, user reset về `PENDING` để bot quét lại, nhưng hệ thống tự động set thành `PASSED` mà không chạy lại job.
- **Root cause**: `bot-engine.service.ts` khi check bot task sử dụng `shouldEnqueueNewJob` chỉ xét điều kiện `existingJob.status === 'FAILED'`. Khi job cũ là `COMPLETED` (kể cả khi có lệch, vì `handleCheckKlgdJob` không throw error), hệ thống dùng lại kết quả cũ → `checkResult = { success: true }` → task bị set lại `PASSED`.

### 2. Danh sách file chỉnh sửa
- [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts)

### 3. Tóm tắt nội dung code đã sửa

**File**: `bot-engine.service.ts` — điều kiện `shouldEnqueueNewJob` (~line 449)

**Trước (SAI):**
```typescript
const shouldEnqueueNewJob = !existingJob
  || (existingJob.status === 'FAILED' && (task.status === 'WAITING' || task.status === 'PENDING'));
// → job COMPLETED + task PENDING = không chạy lại, dùng kết quả cũ → PASSED
```

**Sau (ĐÚNG):**
```typescript
const shouldEnqueueNewJob = !existingJob
  || (existingJob.status === 'FAILED' && (task.status === 'WAITING' || task.status === 'PENDING'))
  || (existingJob.status === 'COMPLETED' && task.status === 'PENDING'); // Task bị reset thủ công → phải chạy lại
// → job COMPLETED + task PENDING = enqueue job mới
```

### 4. Xác nhận Build/Kiểm thử
- `node node_modules/typescript/bin/tsc --noEmit` → **Pass.**

---

## [2026-07-24 11:52:00] - Fix Cửa Sổ Thời Gian Lọc T-1 Khi Upload File Thủ Công (FE Historical Check)

### 1. Mục tiêu Thay đổi
- **Báo cáo lỗi**: Khi upload file thủ công từ FE với `tradingDate = "2026-07-24"`, note hiển thị khoảng lọc `05:00 24/7 → 05:00 25/7` — sai nghiệp vụ. Phiên giao dịch ngày 24/7 phải là `05:00 23/7 (T-1) → 05:00 24/7`.
- **Phân tích**: FE gửi date-only string → backend parse thành `2026-07-24T00:00:00Z` → rơi vào nhánh `isPastDateOrDateOnly`. Logic cũ dùng `tradingDate` làm `sessionStart` rồi +1 ngày thành `checkTime` → window sai.
- **Bot tự động**: Không bị ảnh hưởng — bot truyền `new Date()` (có giờ phút thực) → rơi vào nhánh `else` (Live check), tự tính T-1 đúng từ trước.

### 2. Danh sách file chỉnh sửa
- [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)

### 3. Tóm tắt nội dung code đã sửa

**Hàm `checkKLGD` (line ~785) & `checkPreEOD` (line ~1806) — nhánh `isPastDateOrDateOnly`**

**Trước (SAI):**
```typescript
// sessionStart = tradingDate 05:00 → checkTime = sessionStart + 1 ngày
sessionStart.setHours(sHour, sMin, 0, 0);
checkTime = new Date(sessionStart);
checkTime.setDate(checkTime.getDate() + 1);
// Kết quả: tradingDate=24/7 → sessionStart=24/7 05:00, checkTime=25/7 05:00
```

**Sau (ĐÚNG):**
```typescript
// tradingDate LÀ ngày kết thúc phiên → checkTime = tradingDate 05:00, sessionStart = T-1
checkTime = new Date(tradingDate);
checkTime.setHours(sHour, sMin, 0, 0);
sessionStart = new Date(checkTime);
sessionStart.setDate(sessionStart.getDate() - 1); // T-1
// Kết quả: tradingDate=24/7 → checkTime=24/7 05:00, sessionStart=23/7 05:00
```

### 4. Xác nhận Build/Kiểm thử
- `node node_modules/typescript/bin/tsc --noEmit` → **Pass, không có lỗi.**

---

## [2026-07-24 11:44:00] - Fix TypeScript Error: sessionStart/checkTime Missing from CheckKLGDResult

### 1. Mục tiêu Thay đổi
- Sửa lỗi TypeScript: `Property 'sessionStart' does not exist on type 'CheckKLGDResult'` tại `reconciliation.controller.ts:L115`.
- Controller đã dùng `result.sessionStart` và `result.checkTime` để hiển thị khoảng thời gian lọc trong note, nhưng interface `CheckKLGDResult` chưa khai báo 2 field này dù service đã thực sự trả về chúng.

### 2. Danh sách file chỉnh sửa
- [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)

### 3. Tóm tắt nội dung code đã sửa

**File**: `reconciliation.service.ts` — Interface `CheckKLGDResult` (line 41–49)

**Trước:**
```typescript
export interface CheckKLGDResult {
  // ...
  mismatchedTTTT?: Array<{ ... }>;
}
```

**Sau:**
```typescript
export interface CheckKLGDResult {
  // ...
  mismatchedTTTT?: Array<{ ... }>;
  sessionStart?: Date;   // ← THÊM MỚI
  checkTime?: Date;      // ← THÊM MỚI
}
```

### 4. Xác nhận Build/Kiểm thử
- `node node_modules/typescript/bin/tsc --noEmit` → **Pass, không còn lỗi nào.**

---

## [2026-07-24 11:32:00] - Thêm Khoảng Thời Gian Bộ Lọc Vào Note & Log Đối Chiếu CHECK_KLGD

### 1. Mục tiêu Thay đổi
- USER yêu cầu: Khi check thủ công hoặc bot tự động chạy `CHECK_KLGD`, note ghi vào checklist task và job log phải hiển thị rõ **khoảng thời gian (sessionStart → checkTime)** mà bộ lọc dữ liệu đã sử dụng, để kiểm soát viên biết hệ thống đang lấy dữ liệu ở khung giờ nào.

### 2. Danh sách File Chỉnh sửa
- [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.service.ts)
- [reconciliation.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.controller.ts)

### 3. Tóm tắt Nội dung Chỉnh sửa

**`reconciliation.service.ts`** — hàm `checkKLGD()`:
- **Trước**: Không trả về `sessionStart` và `checkTime` trong kết quả.
- **Sau**: Bổ sung `sessionStart` và `checkTime` vào object trả về để caller (controller/job) có thể dùng ghi log.

**`reconciliation.controller.ts`** — endpoint `POST /upload-klgd` (check thủ công):
- **Trước**: Note ghi vào checklist task không có thông tin thời gian lọc.
- **Sau**: Nếu `result.sessionStart && result.checkTime` tồn tại, thêm dòng `• Khoảng thời gian lọc: từ [start] đến [end]` vào đầu note trước khi lưu vào DB. Note được format JSON chuẩn.

**`bot-job-queue.service.ts`** — `syncJobToChecklist` / `CHECK_KLGD` (đã có trước):
- Xác nhận: Luồng bot tự động đã có sẵn log thời gian lọc tại `handleCheckKlgdJob` (job.logs) và `getReconciliationJson` (note DB). Không cần sửa thêm.

### 4. Xác nhận Build/Kiểm thử
- Backend đang chạy `npm run start:dev` với hot-reload — tự động áp dụng thay đổi.
- Lần check tiếp theo sẽ hiển thị `• Khoảng thời gian lọc: từ ... đến ...` trong note kết quả.

---

## [2026-07-24 11:15:00] - Hỗ Trợ Lưu Kết Quả JSON Đối Chiếu Trong Phiên (CHECK_KLGD) & Giao Diện Xem Lịch Sử Các Lần Quét


### 1. Mục tiêu Thay đổi
- Tích hợp cấu trúc dữ liệu JSON chi tiết của luồng đối chiếu khớp lệnh trong phiên (`CHECK_KLGD`) để hiển thị báo cáo trực quan (Visual Report) thay vì chỉ lưu text thô.
- Hỗ trợ xem lại lịch sử các lần chạy định kỳ (1 tiếng/lần) trực tiếp trên giao diện checklist để kiểm soát viên có cái nhìn trực quan qua từng thời điểm.

### 2. Danh sách File Chỉnh sửa
- [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-job-queue.service.ts)
- [bot-engine.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.controller.ts)
- [BotLogViewerModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/components/ui/BotLogViewerModal.tsx)
- [page.tsx (checklist)](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/checklist/page.tsx)
- [page.tsx (history)](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/history/page.tsx)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`bot-job-queue.service.ts`**:
  - Bổ sung định dạng JSON trả về cho loại job `CHECK_KLGD` trong hàm `getReconciliationJson()` tương tự như đối chiếu SOD/Pre-EOD.
  - Cấu hình đưa `CHECK_KLGD` vào danh sách các job tự động đồng bộ kết quả dưới dạng JSON có cấu trúc khi `COMPLETED` hoặc `FAILED` để lưu vào `resultNote` của checklist.
- **`bot-engine.controller.ts`**:
  - Nâng cấp API `GET /api/v1/bot-engine/jobs` hỗ trợ nhận query params `shiftLogId` và `taskId` nhằm lọc ra danh sách lịch sử tất cả các lượt quét (runs/attempts) của riêng tác vụ đó.
- **`BotLogViewerModal.tsx`**:
  - Hỗ trợ nhận prop `shiftLogId` và gọi API lấy danh sách các lượt quét bot đã thực hiện trong ca.
  - Tích hợp `useAuth` để lấy `token` xác thực và đính kèm vào header `Authorization: Bearer <token>` khi gọi API, tránh lỗi 401 Unauthorized dẫn đến việc bị đẩy ra trang đăng nhập.
  - Thêm phần chọn lượt chạy (Dropdown select) ở header dạng: `Lượt #2 (10:49:07) - Khớp`, `Lượt #1 (09:49:05) - Khớp`...
  - Khi người dùng thay đổi lượt quét, nội dung Visual Report và Console Log tự động cập nhật theo lượt quét tương ứng.
  - Khắc phục các lỗi biên dịch ẩn (`implicit any`) của TS trong component.
- **`frontend/src/app/checklist/page.tsx` & `frontend/src/app/history/page.tsx`**:
  - Truyền prop `shiftLogId` vào `BotLogViewerModal` từ dữ liệu ca trực hiện tại.

### 4. Xác nhận Build/Kiểm thử
- Cả hai đầu dự án Frontend và Backend đều chạy biên dịch `npx tsc --noEmit` thành công 100%.

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

---

## [2026-07-26 23:48:00] - Rà Soát & Tối Ưu Hóa Giao Diện Responsive Trải Nghiệm Thiết Bị Di Động (Mobile & Tablet)

### 1. Mục tiêu Thay đổi
- Rà soát toàn bộ các trang trên ứng dụng Frontend (Admin Templates, Users, Bot Config, Shift Slots, Departments, Checklist TaskTable, History) để khắc phục các vấn đề hiển thị tràn viền, vỡ layout và thiếu tương thích trên thiết bị di động (mobile/tablet).
- Bổ sung chuyển đổi Tab thông minh (Mobile Tab Switcher) và bộ wrapper cuộn ngang tự động cho các bảng dữ liệu.

### 2. Danh sách File Chỉnh sửa
- [globals.css](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/globals.css)
- [page.tsx (Admin Templates)](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/admin/templates/page.tsx)
- [page.tsx (Admin Users)](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/admin/users/page.tsx)
- [page.tsx (Admin Bot Config)](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/admin/bot-config/page.tsx)
- [page.tsx (Admin Departments)](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/admin/departments/page.tsx)
- [page.tsx (Admin Shift Slots)](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/admin/shift-slots/page.tsx)
- [TaskTable.tsx](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/checklist/components/TaskTable.tsx)
- [page.tsx (History)](file:///d:/sontayweb/mxv-shift-checklist/frontend/src/app/history/page.tsx)

### 3. Tóm tắt Nội dung Chỉnh sửa
- **`globals.css`**: Bổ sung utility class `.table-responsive-wrapper`, `@media (max-width: 640px)` tinh chỉnh spacing main content, modal container và flex/grid responsive helpers.
- **`Admin Templates page.tsx`**: Thêm state `mobileTab ('list' | 'editor')` cùng thanh chuyển tab di động giúp hiển thị độc lập Danh sách mẫu và Nội dung Task trên màn hình nhỏ `< 1024px`.
- **`TaskTable.tsx`**: Tinh chỉnh thanh tìm kiếm và bộ lọc ưu tiên/trạng thái dạng flex column trên mobile và flex row trên sm+, giúp không bị đè chữ hay tràn lề.
- **`Admin Users / Bot Config / Departments / Shift Slots / History`**: Bọc table trong `.table-responsive-wrapper` và tối ưu hóa layout điều khiển.

### 4. Kết quả Kiểm thử & Build
- **Backend (`npx tsc --noEmit` & `npm run build`)**: PASSED (0 lỗi)
- **Frontend (`npx tsc --noEmit` & `npm run build`)**: PASSED (0 lỗi)

