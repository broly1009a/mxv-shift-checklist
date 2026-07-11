# HƯỚNG DẪN KIỂM THỬ BỘ LẬP LỊCH TỰ ĐỘNG (DYNAMIC SCHEDULER SERVICE)

Bộ lập lịch tự động (**SchedulerService**) hoạt động ngầm để quét giờ chạy của các tác vụ cấu hình trong DB, tự động đối chiếu múi giờ Việt Nam (GMT+7) độc lập với giờ server vật lý, tìm các task tương ứng của ca trực hiện tại và đẩy job chạy vào hàng đợi `BotJobQueue`.

Dưới đây là hai phương pháp để kiểm thử tính năng này: tự động bằng script test và thủ công qua giao diện.

---

## CÁCH 1: Chạy kịch bản kiểm thử tự động (Khuyên Dùng)

Chúng tôi đã viết sẵn một kịch bản test tích hợp tự động độc lập tại `backend/src/test-dynamic-scheduler.ts` và đăng ký lệnh chạy trong `package.json`.

### 1. Cách chạy:
Mở terminal tại thư mục `backend` và chạy lệnh sau:
```powershell
npm run test:scheduler
```

### 2. Kịch bản tự động sẽ kiểm thử các nội dung:
1. **Kiểm tra Smart Seeding**: Xác minh cấu hình mặc định (`bot_scheduler_config`) được nạp thành công vào database và in ra thông số cấu hình.
2. **Kiểm tra tính chính xác của múi giờ (GMT+7)**: Tự động tính toán giờ Việt Nam hiện tại để làm mốc chạy.
3. **Kiểm tra tự động khớp & đẩy Job**:
   * Khởi tạo ca trực giả lập (`PENDING`) với task tự động đối chiếu số dư (`AUTO_CHECK_SOD`).
   * Thay đổi cấu hình DB cho task đó chạy đúng vào **giờ hiện tại**.
   * Chạy Scheduler để quét tự động.
   * Xác minh xem Job có được đưa vào hàng đợi `bot_jobs` hay không, và kiểm tra xem Job có được liên kết chính xác với **ShiftLog ID** và **Task ID** tương ứng hay không.
4. **Kiểm tra chống chạy trùng lặp**: Gọi scheduler chạy lại lần nữa trong cùng một phút và xác nhận hệ thống chặn không cho đẩy job trùng lặp (dựa trên `lastRunMap` và ngày chạy).
5. **Dọn dẹp**: Tự động khôi phục cấu hình DB ban đầu và xóa sạch dữ liệu test sau khi hoàn tất.

---

## CÁCH 2: Kiểm thử thủ công trên Giao diện Web (UAT / Local)

Để kiểm thử thực tế hoạt động của Scheduler trên môi trường chạy thực tế:

### Bước 1: Chuẩn bị ca trực chứa task tự động
1. Đăng nhập với tài khoản Admin, đi tới trang quản lý Mẫu Checklist.
2. Đảm bảo mẫu checklist của bạn có các task cấu hình bot tự động, ví dụ:
   * Tên task: `[RPA] Tải báo cáo CQG CAST Balances`
   * Check Type: `RPA_DOWNLOAD_CAST`
3. Tạo một ca trực mới từ mẫu này (Trạng thái ca trực phải là `PENDING`).

### Bước 2: Cấu hình giờ kích hoạt Scheduler
1. Truy cập trang **Admin Dashboard** -> mục **Cấu hình Bot (Bot Config)** `/admin/bot-config`.
2. Cuộn xuống phần **Lập Lịch Tự Động (Scheduler)**.
3. Tìm tác vụ `Tải báo cáo CQG CAST Balances` (Mã Job: `DOWNLOAD_CAST`).
4. Click tick chọn **Kích hoạt** (Enabled).
5. Điều chỉnh **Giờ chạy** lớn hơn thời gian hiện tại của bạn khoảng **1 đến 2 phút** (Ví dụ: hiện tại là 17:45 thì chỉnh thành 17:46 hoặc 17:47).
6. Nhấn nút **Lưu Cấu Hình** ở góc dưới.

### Bước 3: Quan sát và Xác minh
1. **Theo dõi logs trong Admin UI**: Mở tab quản lý Job chạy ngầm hoặc kiểm tra logs của backend.
2. Chờ đến đúng giờ cấu hình:
   * **Kết quả 1**: Scheduler sẽ tự động log thông tin đã kích hoạt tác vụ và liên kết thành công với task tương ứng trong ca trực.
   * **Kết quả 2**: Một job mới sẽ xuất hiện trong danh sách **Bot Jobs** ở trạng thái `PENDING` -> `PROCESSING` -> chạy tự động Playwright để tải file.
   * **Kết quả 3**: Checkbox của task đó trong ca trực sẽ tự động chuyển màu hoặc cập nhật logs tiến trình.
