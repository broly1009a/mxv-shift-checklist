# BÁO CÁO TIẾN ĐỘ & LỘ TRÌNH PHÁT TRIỂN HỆ THỐNG BOT RECONCILIATION

Báo cáo chi tiết về các hạng mục đã hoàn thành và danh sách các hạng mục cần bổ sung/phát triển nốt dựa trên kế hoạch tích hợp đối chiếu CQG & M-System (`finalintergentation.md`).

---

## I. NHỮNG GÌ ĐÃ HOÀN THÀNH (ĐẠT ~85%)

### 1. Cơ chế Tác vụ liên kết Cha - Con (Parent-Child Task Dependency)
*   **Thiết kế Schema**: Thêm trường `parentTaskId` (trong Mẫu Template) và `parentTaskIdSnapshot` (trong Nhật ký ca trực - ShiftLog) để xây dựng cấu trúc cây tác vụ.
*   **Lan truyền trạng thái tự động (Status Propagation)**: 
    *   Khi toàn bộ các tác vụ con được hoàn thành (trạng thái `PASSED`), tác vụ cha tự động chuyển sang trạng thái `PASSED` và tick xanh trên giao diện.
    *   Khi có bất kỳ tác vụ con nào bị hủy hoàn thành (quay lại `PENDING`), tác vụ cha tự động bị hủy hoàn thành theo.
*   **Kiểm soát nghiệp vụ (Safety Guard)**: Chặn nhân viên trực ca tự click check/uncheck thủ công tác vụ cha từ giao diện, hiển thị thông báo lỗi yêu cầu phải hoàn thành hết các tác vụ con trước.
*   **Script Kiểm thử**: Viết file kiểm thử tự động `backend/src/test-parent-child-tasks.ts` chạy trực tiếp trên database test. Có thể chạy lệnh:
    ```bash
    npm run test:parent-child
    ```

### 2. Bộ Lập lịch Chạy ngầm Động (Dynamic Scheduler Service)
*   **SchedulerService (`scheduler.service.ts`)**: Chạy ngầm định kỳ mỗi phút (`@Cron('* * * * *')`).
*   **Múi giờ Độc lập**: Tự động chuyển đổi thời gian server sang Giờ Việt Nam (GMT+7) để so sánh thời gian chạy chính xác, tránh lệch giờ khi deploy lên Docker/Cloud.
*   **Tự động Seed dữ liệu (Smart Seeding)**: Tự động khởi tạo cấu hình giờ chạy mặc định trong cơ sở dữ liệu (`bot_scheduler_config`) nếu chưa có, và tự động cập nhật thêm các task mới nếu phát hiện thiếu mà không làm ảnh hưởng đến cấu hình cũ của người dùng.
*   **Liên kết ca trực**: Tự động tìm ca trực đang mở (`PENDING`), map đúng task chưa hoàn thành và đẩy job chạy vào hàng đợi `BotJobQueue` khi đúng giờ cấu hình.

### 3. Tích hợp CQG CAST & Đối chiếu SOD vào Hàng đợi (BotJobQueue)
*   **Job `DOWNLOAD_CAST`**: Đăng ký handler điều phối Playwright đăng nhập cổng CQG CAST và tải báo cáo số dư đầu ngày `Accounts_Balances.xlsx`.
*   **Job `AUTO_CHECK_SOD`**: Đăng ký handler tự động tìm file `QLTKGD.xlsx` (M-System) và `Accounts_Balances.xlsx` mới nhất, thực hiện đối chiếu chênh lệch số dư đầu ngày, lưu kết quả đối chiếu và gửi tin nhắn cảnh báo Telegram tự động.
*   **Chống chạy trùng lặp**: Hệ thống tự kiểm tra nếu có Job cùng loại và cùng Task ID đang chờ xử lý (`PENDING` hoặc `PROCESSING`) thì sẽ tái sử dụng, không đẩy trùng job gây tốn tài nguyên.

### 4. Admin UI & Cấu hình
*   **UI Lập lịch (Scheduler)**: Thêm panel **Lập Lịch Tự Động (Scheduler)** trên trang `/admin/bot-config` sử dụng thiết kế glassmorphic hiện đại.
*   **Tính năng tương tác**: Cho phép Admin bật/tắt (Kích hoạt) và đổi giờ chạy (`HH:MM`) của từng tác vụ, lưu cấu hình xuống DB một cách bảo mật.
*   **Build & Compile**: Cả Backend (NestJS) và Frontend (Next.js) đều đã biên dịch thành công (`npm run build` đạt Exit code: 0) không có bất kỳ lỗi cú pháp hay TypeScript nào.

---

## II. NHỮNG GÌ CẦN BỔ SUNG & PHÁT TRIỂN NỐT (ROADMAP)

Dưới đây là các đầu việc cần làm để đóng gói hoàn thiện hệ thống trước khi đưa lên UAT/Production:

### 1. Bổ sung Handler cho các Job EOD và Pre-EOD
*   **Hiện trạng**: Các task `CHECK_PRE_EOD` và `CHECK_EOD_MM` đã được seed vào lập lịch trong DB và Scheduler có thể kích hoạt đúng giờ. Tuy nhiên, trong `processQueue()` của `BotJobQueueService` **chưa khai báo** code xử lý cho hai loại job này. Nếu đến giờ chạy, job sẽ bị văng lỗi `Loại job không được hỗ trợ`.
*   **Giải pháp cần làm**:
    1.  Khai báo thêm `else if (job.jobType === 'CHECK_PRE_EOD')` và gọi hàm xử lý tương ứng (ví dụ quét file báo cáo tiền trước giờ đóng cửa).
    2.  Khai báo thêm `else if (job.jobType === 'CHECK_EOD_MM')` và gọi hàm xử lý đối chiếu cuối ngày & Market Maker.
    3.  Cập nhật trạng thái checklist task sau khi hoàn thành tương tự như SOD.

### 2. Tích hợp Email Alert sau mỗi check tự động (Nếu cần thiết)
*   **Hiện trạng**: Hệ thống hiện tại đang gửi tin nhắn cảnh báo qua Telegram cực kỳ tức thời. Trong bản kế hoạch `finalintergentation.md` có ghi nhận hạng mục gửi email kết quả.
*   **Giải pháp cần làm**:
    *   Tận dụng module gửi mail có sẵn của IT Tool (nếu đã có cấu hình SMTP) để gửi kết quả đối chiếu chi tiết dạng bảng (HTML) về hòm thư của phòng vận hành.

### 3. Cấu hình credentials thực tế và Chạy thử E2E trên UAT
*   **Hiện trạng**: Các bot Playwright đang chạy giả lập hoặc sử dụng cấu hình cục bộ.
*   **Giải pháp cần làm**:
    *   Cấu hình thông tin tài khoản thật (CQG CAST, M-System, ACM) trên giao diện Admin Bot Config của môi trường UAT.
    *   Theo dõi tiến trình chạy thực tế của các background jobs trên Dashboard để kiểm tra độ ổn định của Playwright khi đối phó với mạng thực tế, độ trễ và các yếu tố ngoại cảnh.
