# Walkthrough - Tích Hợp CQG CAST & SOD Reconciliation

Quy trình tự động hóa đối chiếu số dư đầu ngày (SOD) và tải báo cáo CQG CAST đã được tích hợp thành công vào backend job queue, engine checklist ca trực và giao diện quản lý Admin UI.

## Các Thay Đổi Đã Thực Hiện

### 1. Backend

*   **`RpaDownloaderService` (`rpa-downloader.service.ts`)**:
    *   Cập nhật hàm `downloadCastBalances` để kế thừa toàn bộ logic mô phỏng IE11 và ActiveX từ file test (`test-cast-download.ts`).
    *   Sử dụng route-interception để lọc sạch whitespace/BOM từ XML/XSL/ASP phản hồi từ máy chủ nhằm tránh lỗi parser của Chrome.
    *   Tự động điền các bộ lọc: FCM (Equals "MXV"), Currency (Like "USD"), Record Description (Like "current") thông qua evaluate JS để đảm bảo độ tin cậy của Select2 và form events.
*   **`BotJobQueueService` (`bot-job-queue.service.ts`)**:
    *   Cập nhật `handleDownloadCastJob` để trích xuất tham số `backupPath` từ job payload.
    *   Sau khi bot tải file thành công, nếu có `backupPath`, hệ thống sẽ tự động tạo thư mục (nếu chưa có), copy file báo cáo đã tải và đổi tên thành `Accounts_Balances.xlsx` tại thư mục backup chỉ định.
*   **`BotEngineController` (`bot-engine.controller.ts`)**:
    *   Cập nhật endpoint `POST /api/v1/bot-engine/trigger-cast-download` để nhận `backupPath` từ request body và đưa vào payload của job `DOWNLOAD_CAST`.

### 2. Frontend

*   **Admin Bot Config Page (`frontend/src/app/admin/bot-config/page.tsx`)**:
    *   Thêm state `backupPathCast` được đồng bộ mặc định với đường dẫn backup MS khi tải trang cấu hình.
    *   Thêm trường nhập liệu đường dẫn thư mục backup MS và nút bấm **"Tải Báo Cáo & Đổi Tên"** thủ công trực tiếp trong panel **Tài Khoản CQG CAST**.
    *   Khi bấm nút, client sẽ trigger endpoint backend để enqueue job tải và lưu trữ trực tiếp vào thư mục backup được chỉ định.

---

## Kết Quả Kiểm Thử & Xác Minh

### 1. Build & Compile Verification
Cả 2 workspace đã được build thành công không lỗi:
*   **Backend Build**: Thành công (Exit code: 0).
*   **Frontend Build**: Thành công (Exit code: 0).

### 2. Manual Verification Plan (UAT / Production)

Để kiểm thử quy trình này trên môi trường UAT:
1.  **Cấu hình credentials**:
    *   Đăng nhập tài khoản Admin, truy cập `/admin/bot-config`.
    *   Nhập thông tin tài khoản tại mục **Tài Khoản CQG CAST** (Username, Password, FCM, Currency, Record Description).
    *   Bật các tác vụ trong mục **Lập Lịch Tự Động (Scheduler)** và chỉnh giờ chạy gần thời điểm hiện tại để test.
    *   Nhấn **Lưu Cấu Hình Credentials** để lưu.
2.  **Chạy thủ công qua UI**:
    *   Kiểm tra trường nhập **Thư mục Backup MS để lưu file (Accounts_Balances.xlsx)** trong panel **Tài Khoản CQG CAST**.
    *   Nhấn nút **Tải Báo Cáo & Đổi Tên**.
    *   Theo dõi logs trong danh sách công việc ở panel bên phải.
    *   Xác nhận file `Accounts_Balances.xlsx` xuất hiện tại thư mục đích và nội dung chính xác.
