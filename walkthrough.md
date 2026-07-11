# Walkthrough - Tích Hợp CQG CAST & SOD Reconciliation

Quy trình tự động hóa đối chiếu số dư đầu ngày (SOD) và tải báo cáo CQG CAST đã được tích hợp thành công vào backend job queue, engine checklist ca trực và giao diện quản lý Admin UI.

## Các Thay Đổi Đã Thực Hiện

### 1. Backend

*   **`ReconciliationService` (`reconciliation.service.ts`)**:
    *   Tích hợp `SystemSettingsService` và `TelegramService`.
    *   Xây dựng helper `findLatestFile(dir, pattern)` để tìm file Excel mới nhất tải về tự động.
    *   Xây dựng hàm nghiệp vụ `runAutoCheckSOD()` để tự động đọc file `QLTKGD.xlsx` (M-System) và `Accounts_Balances.xlsx` (CQG), tiến hành đối chiếu số dư, lưu kết quả và gửi thông báo Telegram.
*   **`BotJobQueueService` (`bot-job-queue.service.ts`)**:
    *   Bổ sung 2 job handlers mới: `DOWNLOAD_CAST` và `AUTO_CHECK_SOD`.
    *   Gọi `RpaDownloaderService.downloadCastBalances()` để tải báo cáo CQG CAST qua Playwright.
    *   Gọi `ReconciliationService.runAutoCheckSOD()` để chạy đối chiếu và cập nhật trạng thái checklist task.
*   **`BotEngineService` (`bot-engine.service.ts`)**:
    *   Tự động enqueue các job tương ứng khi checklist ca trực có task `RPA_DOWNLOAD_CAST` hoặc `AUTO_CHECK_SOD` đến giờ cấu hình (`botTriggerTimeSnapshot`).
*   **`SchedulerService` [NEW] (`scheduler.service.ts`)**:
    *   Lập lịch chạy ngầm bằng `@Cron` mỗi phút một lần.
    *   Đọc cấu hình JSON từ DB (`bot_scheduler_config`).
    *   Tự động đưa job `DOWNLOAD_CAST` và `AUTO_CHECK_SOD` vào hàng đợi khi đúng giờ cấu hình và tự động liên kết với task chưa hoàn thành trong ca trực đang hoạt động (PENDING).
*   **`BotEngineController` (`bot-engine.controller.ts`)**:
    *   Mở rộng endpoint cấu hình `GET /config` và `POST /config` để hỗ trợ load/save cấu hình lập lịch `schedulerConfig`.
    *   Mở rộng endpoint kích hoạt thủ công `POST /trigger/:shiftLogId/:taskId` để enqueue chính xác job `DOWNLOAD_CAST` hoặc `AUTO_CHECK_SOD` thay vì chỉ `RPA_DOWNLOAD_REPORTS`.
*   **`BotEngineModule` (`bot-engine.module.ts`)**:
    *   Khai báo và exports `SchedulerService`.

### 2. Frontend

*   **Admin Bot Config Page (`frontend/src/app/admin/bot-config/page.tsx`)**:
    *   Tích hợp load/save cấu hình `schedulerConfig` từ backend.
    *   Bổ sung panel giao diện **Lập Lịch Tự Động (Scheduler)** bằng ngôn ngữ thiết kế glassmorphic, hỗ trợ cấu hình giờ chạy (`time`) và nút kích hoạt (`enabled`) cho từng tác vụ check ngầm.

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
2.  **Tạo ca trực**:
    *   Tạo một ca trực mới có checklist chứa 2 tác vụ có Check Type là `RPA_DOWNLOAD_CAST` và `AUTO_CHECK_SOD`.
3.  **Kích hoạt & Theo dõi**:
    *   Chờ đến giờ cấu hình hoặc bấm nút **Kích hoạt chạy Bot (Robot Run)** thủ công trên Checklist UI.
    *   Theo dõi logs hiển thị trong panel **Bot Jobs** tại giao diện `/admin/bot-config`.
    *   Xác nhận file `Accounts_Balances.xlsx` được tải về thư mục `temp/cast-downloads/`.
    *   Xác nhận tin nhắn thông báo Telegram gửi về nhóm vận hành với thông tin đối chiếu số dư đầu ngày (SOD).
