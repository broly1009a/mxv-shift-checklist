# ĐÁNH GIÁ TÀI NGUYÊN CPU/RAM & KIẾN TRÚC DEPLOYMENT

Tài liệu này đánh giá mức độ tiêu thụ tài nguyên (CPU/RAM) của hệ thống bot tự động và đưa ra khuyến nghị về việc sử dụng các công nghệ hỗ trợ như Redis, RabbitMQ khi deploy lên UAT/Production.

---

## 1. Phân Tích Tiêu Thụ Tài Nguyên (CPU / RAM)

Hệ thống được chia thành 3 phần chính với đặc tính tài nguyên như sau:

| Thành phần | Đặc tính hoạt động | RAM tiêu thụ | CPU tiêu thụ |
| :--- | :--- | :--- | :--- |
| **Backend & Scheduler** (NestJS) | Chạy ngầm 24/7. Mỗi phút quét DB một lần so sánh giờ Việt Nam. | **~100MB - 150MB** | Gần như **0%** |
| **Database** (MongoDB) | Lưu trữ checklist, logs và trạng thái hàng đợi job. | **~150MB - 300MB** (Tùy lượng data) | **1% - 3%** |
| **Bot Trình Duyệt Ngầm** (Playwright / Headless Chromium) | Chỉ kích hoạt khi đến giờ hẹn hoặc click chạy thủ công. Đóng hoàn toàn sau khi tải xong file (thường chạy trong 1-3 phút). | **~250MB - 500MB** per instance | **15% - 40%** của 1 CPU Core (khi tải trang & xử lý click) |

> [!NOTE]
> Do cơ chế hàng đợi **BotJobQueue** được thiết kế chạy **tuần tự (Concurrency = 1)** (chỉ xử lý 1 job tại một thời điểm), hệ thống sẽ không bị hiện tượng nhiều trình duyệt Playwright mở cùng lúc làm treo CPU/RAM.

---

## 2. Có Cần Thêm Redis hay RabbitMQ Không?

**TRẢ LỜI: KHÔNG CẦN THIẾT.** 

Nên tiếp tục sử dụng kiến trúc hàng đợi lưu trữ trực tiếp trên **MongoDB** (`BotJobQueue` hiện tại) vì các lý do sau:

1. **Tần suất job cực kỳ thấp**: Hệ thống chỉ chạy đối chiếu vài lần một ngày (sáng, chiều, tối) theo ca trực. Số lượng job phát sinh tối đa chỉ khoảng 10-20 job/ngày. Redis hay RabbitMQ chỉ thực sự cần thiết khi hệ thống có hàng nghìn job phát sinh mỗi giây.
2. **Đơn giản hóa hạ tầng (Keep It Simple)**: Deploy thêm Redis/RabbitMQ đòi hỏi phải cấu hình, giám sát và bảo trì thêm dịch vụ. Sử dụng MongoDB sẵn có giúp việc triển khai (Docker Compose) cực kỳ gọn nhẹ.
3. **Quản lý trạng thái và Logs dễ dàng**: Trạng thái job (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`) và nhật ký chi tiết (`logs`) được lưu trực tiếp vào MongoDB, giúp Frontend Admin UI dễ dàng query hiển thị real-time cho người dùng mà không cần đồng bộ từ Redis sang DB.

---

## 3. Khuyến Nghị Cấu Hình Máy Chủ Deploy

Để chạy ổn định cả ứng dụng (Frontend, Backend, MongoDB và Bot Playwright ngầm), cấu hình máy chủ khuyến nghị như sau:

### Cấu hình Tối thiểu (Minimum):
*   **CPU**: 2 Cores
*   **RAM**: 2 GB
*   **Disk**: 20 GB SSD (Để lưu trữ các file báo cáo đối chiếu Excel tải về hàng ngày)

### Cấu hình Khuyến nghị (Recommended):
*   **CPU**: 4 Cores
*   **RAM**: 4 GB hoặc 8 GB (Nếu chạy chung với các hệ thống IT Tool khác)
*   **Disk**: 50 GB SSD

---

## 4. Lưu ý quan trọng khi Deploy Docker (Linux)
Nếu deploy hệ thống bằng Docker container trên hệ điều hành Linux (Ubuntu/CentOS), image chạy backend cần phải được cài đặt đầy đủ các thư viện hỗ trợ chạy Playwright Chromium (fonts, thư viện đồ họa hệ thống). 
*   Nên sử dụng base image Node hỗ trợ Playwright (ví dụ: `mcr.microsoft.com/playwright:v1.49.0-noble` hoặc cài đặt thông qua lệnh `npx playwright install-deps` trong Dockerfile).
