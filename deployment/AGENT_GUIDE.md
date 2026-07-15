# 📋 Hướng Dẫn Vận Hành & Kết Nối: MXV RPA Agent (Desktop App)

Tài liệu này hướng dẫn cách cài đặt, cấu hình, kết nối và vận hành ứng dụng **MXV RPA Agent** giao diện đồ họa (PyQt6 System Tray) trên Windows, liên kết trực tiếp với Core Server Linux.

---

## 1. Tổng Quan Kiến Trúc Kết Nối Hybrid

Hệ thống vận hành theo cơ chế **Hybrid (Lai)** để tối ưu thế mạnh của từng nền tảng:
- **Core Server (Linux):** Quản lý cơ sở dữ liệu MongoDB, Lập lịch (Scheduler), API điều phối và Web UI Checklist.
- **RPA Agent (Windows Desktop App):** Chạy trên Windows để tương tác trực tiếp với **Excel COM APIs (chạy VBA Macros)** và thực thi các tác vụ Playwright/WinSCP cục bộ thông qua cơ chế ủy quyền CLI.

```
                  ┌────────────────────────────────────────┐
                  │          Linux Core Server             │
                  │   - API: /api/v1/bot-engine/agent-status │
                  │   - Job Queue Database (MongoDB)       │
                  └───────────────────┬────────────────────┘
                                      ▲
                        HTTP Heartbeats & Polling
                        (Mã hóa JWT + Phiên động)
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       Windows MXV RPA Agent            │
                  │   - System Tray Icon (Chạy ẩn)         │
                  │   - Settings UI & Realtime Logs Window │
                  └───────────────────┬────────────────────┘
                                      │
                         Giám sát & Ủy quyền CLI
                                      ▼
                  ┌────────────────────────────────────────┐
                  │          Local Execution               │
                  │   - Excel Macro (Số lot, giá trị...)    │
                  │   - NestJS CLI (Playwright / WinSCP)   │
                  └────────────────────────────────────────┘
```

---

## 2. Giao Giao Diện & Tính Năng Trên Desktop App

Ứng dụng chạy trực tiếp dưới **Khay hệ thống (System Tray)** của Windows với icon MXV có vòng tròn hiển thị trạng thái động:
- **Màu Xanh lá:** Agent đang Online, kết nối ổn định với Server.
- **Màu Cam:** Agent đang trong quá trình xử lý Job.
- **Màu Đỏ:** Mất kết nối hoặc sai thông tin API Key / URL.

Khi **chuột phải vào icon**, menu công cụ nhanh xuất hiện:
- **`⚙ Cấu hình`**: Mở cửa sổ cấu hình kết nối và đường dẫn.
- **`📋 Xem Log`**: Xem log chạy thời gian thực với màu sắc phân biệt mức độ log (INFO, WARN, ERROR).
- **`🌐 Cập nhật v...`**: Nút cập nhật nhanh tự động xuất hiện khi Server phát hành phiên bản mới.
- **`▶ Khởi động / Dừng Polling`**: Tạm dừng hoặc kích hoạt lại việc nhận job.
- **`❌ Thoát`**: Đóng hoàn toàn Agent.

---

## 3. Hướng Dẫn Cấu Hình & Kết Nối (Từng Bước)

### Bước 3.1: Cài đặt thông số trên Agent Windows
Mở Menu chuột phải dưới Tray Icon → Chọn **`⚙ Cấu hình`**.

#### 1. Tab `🔗 Kết nối` (Connection Settings)
- **Backend URL:** Nhập địa chỉ IP và Port của Linux Server.
  - *Ví dụ:* `http://192.168.1.100` (Nếu chạy production) hoặc `http://localhost:3001` (Test local).
- **API Key:** Nhập mã khóa bí mật đã khai báo trên Server (`RPA_AGENT_API_KEY` trong docker-compose).
- **Polling interval:** Tần suất kiểm tra job mới (khuyến nghị `5 giây`).
- **Heartbeat interval:** Tần suất gửi tín hiệu sống liveness (khuyến nghị `30 giây`).
- Click nút **`🔍 Kiểm tra kết nối`** để kiểm thử tức thì. Giao diện sẽ hiển thị báo kết nối thành công hoặc mã lỗi HTTP cụ thể.

#### 2. Tab `📁 Đường dẫn` (Paths Settings)
- **Thư mục Backend NestJS:** Đường dẫn đến thư mục chứa mã nguồn backend (để chạy ủy quyền Playwright/WinSCP).
  - *Ví dụ:* `D:\sontayweb\mxv-shift-checklist`
- **Macro Số Lot / Macro Giá Trị:** Browse đến đúng file `.xlsm` trên máy.
- **Thư mục Backup MS / ACM:** Browse đến các thư mục chứa dữ liệu đầu vào.

#### 3. Tab `🚀 Khởi động` (Startup Settings)
- Tích chọn **`Tự chạy Agent khi Windows khởi động`** để kích hoạt chế độ tự khởi chạy (ghi trực tiếp vào Registry của Windows `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
- Tích chọn **`Khởi động ở chế độ tối giản`** để khi khởi chạy, Agent sẽ ẩn ngay xuống tray icon thay vì bật cửa sổ chính lên làm phiền màn hình.

Click **`💾 Lưu & Áp dụng`** để ghi cấu hình vào file `config.json` và khởi chạy tức thì.

---

## 4. Quản Lý Trạng Thái Từ Web Admin Portal

Admin có thể trực tiếp giám sát liveness của Agent ngay trên giao diện Web mà không cần truy cập máy Windows:

1. Đăng nhập vào Web Checklist với tài khoản **Admin**.
2. Truy cập menu **Bot Configuration** (`/admin/bot-config`).
3. Nhìn lên góc trên cùng bên phải Header, hệ thống hiển thị badge trạng thái động:
   - **`● Agent: Online (Hostname: ...) [OS: Windows]`** (Chấm xanh nhấp nháy): Agent đang kết nối trực tiếp ổn định.
   - **`● Agent: Offline`** (Chấm đỏ): Agent đã tắt hoặc mất kết nối mạng quá 60 giây.

---

## 5. Cơ Chế Ủy Quyền Job Playwright & WinSCP

Khi Admin kích hoạt các job như `Tải báo cáo ACM` hoặc `Đồng bộ SFTP WinSCP` từ Web UI:
1. Web Server đưa job vào hàng đợi MongoDB.
2. Agent Windows kéo (poll) job về.
3. Nhận diện đây là job CLI, Agent tự động gọi file script `backend/src/scripts/run-job-cli.ts` (hoặc bản build JS `dist/scripts/run-job-cli.js`) trong thư mục **Backend NestJS** cục bộ đã cấu hình.
4. Quá trình Playwright/WinSCP sẽ chạy ngầm ngay trên máy Windows. Toàn bộ log console (stdout) của NestJS sẽ được Agent bắt trực tiếp và gửi ngược lên Web UI để Admin theo dõi thời gian thực.
5. Khi tiến trình CLI kết thúc, Agent gửi gói tin hoàn thành/thất bại lên Server để giải phóng hàng đợi.

---

## 6. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Triệu chứng | Nguyên nhân | Cách khắc phục |
|-------------|-------------|----------------|
| **Đèn Tray Icon màu đỏ, báo Offline trên Web** | Sai URL hoặc API Key không khớp | 1. Mở Cấu hình trên Tray Icon, kiểm tra lại IP/Port và API Key.<br>2. Nhấp nút "Kiểm tra kết nối" để xem thông báo lỗi chi tiết. |
| **Email cảnh báo gửi về `it.support@mxv.vn`** | Máy Windows bị mất mạng hoặc tắt nguồn quá 3 phút | Khởi động lại máy Windows hoặc mở lại ứng dụng Agent. Email "Phục hồi trạng thái" sẽ tự động được gửi khi kết nối lại thành công. |
| **Lỗi "Không tìm thấy WinSCP.com"** | Chưa cài WinSCP hoặc cài ở thư mục lạ | Cấu hình cài đặt `bot_winscp_path` trong Database SystemSettings để khai báo chính xác đường dẫn đến file `WinSCP.com` của bạn. |
| **Excel Macro báo lỗi COM** | Tiến trình Excel cũ bị treo, chiếm quyền file | Agent đã tích hợp sẵn tính năng tự động tắt toàn bộ tiến trình `EXCEL.EXE` ngầm (Excel Sweeper) khi khởi động hoặc chạy job. Hãy đảm bảo bạn không khóa file macro thủ công. |
