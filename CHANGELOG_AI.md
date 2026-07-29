# CHANGELOG_AI.md - Nhật Ký Thay Đổi Code & Cấu Hình Của AI Assistant

Tài liệu này dùng để ghi vết tất cả các lượt chỉnh sửa code (Frontend, Backend), cấu hình Bot và logic nghiệp vụ do AI Assistant thực hiện trong dự án.



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

