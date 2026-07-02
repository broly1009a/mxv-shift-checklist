# Kế hoạch triển khai: Di chuyển Bộ Công cụ IT WinForms sang Web Checklist (Phased & Modular Migration)

Tài liệu này chi tiết hóa kế hoạch và lộ trình triển khai dịch chuyển 4 công cụ WinForms của Khối Vận hành Giao dịch (VHGD) sang hệ thống NestJS (Backend) và Next.js (Frontend) tập trung.

---

## User Review Required

> [!IMPORTANT]
> **Các quyết định thiết kế cốt lõi cần phê duyệt:**
> 1. **Cách thức chạy RPA**: Hiện tại công cụ cũ sử dụng Selenium chạy trên máy Local của IT. Khi đưa lên Web, chúng ta sẽ chạy Playwright (hoặc Puppeteer) dưới nền (Headless) trên Server. Có cần phân tách một Server chuyên biệt chạy RPA để tránh ảnh hưởng tới hiệu năng Backend Web chính không?
> 2. **Lưu trữ Cấu hình & Tỷ giá EOD**: Tỷ giá giao dịch hàng ngày (USD, MYR, JPY) để tính toán EOD sẽ được lấy từ API tỷ giá của hệ thống hay cho phép người dùng nhập trực tiếp từ giao diện Cài đặt chung?

---

## Open Questions

> [!WARNING]
> 1. **Ngày nghỉ giao dịch LME (LMEDayoff)**: Danh sách này có thay đổi thường niên. Chúng ta nên thiết kế giao diện Admin để quản lý danh sách này hay lấy trực tiếp từ Module lịch làm việc (`WorkingCalendar`) hiện có?
> 2. **Cơ chế gửi Email Cảnh báo**: Các mẫu email HTML gửi đi khi phát hiện lệch/ký quỹ yếu sẽ dùng máy chủ SMTP của MXV cấu hình động trong `config.json` cũ hay sử dụng chung dịch vụ Email/SMS tập trung đã có của Backend Web?

---

## Proposed Changes

Chúng ta gom nhóm các chức năng thành 4 phân kỳ triển khai độc lập để giảm thiểu rủi ro:

### Phân kỳ 1: Đối soát Giao dịch & Quản lý Rủi ro (operate-transaction-app & margin-checker)

#### 1. Đối chiếu Số dư EOD (`CheckEOD`)
- **Mô tả:** Đọc file báo cáo tài khoản ký quỹ (`QLTKGD.xlsx`), tính toán lại số dư thực tế theo công thức bù trừ tỷ giá lãi/lỗ và so khớp với báo cáo kế toán.
- **Backend:** Thêm phương thức `checkEOD` trong `ReconciliationService` áp dụng logic tỷ giá động (lãi dùng tỷ giá mua, lỗ dùng tỷ giá bán).
- **Frontend:** Cung cấp ô nhập tỷ giá thủ công (nếu cần) và hiển thị danh sách tài khoản bị lệch số dư EOD.

#### 2. Đối chiếu số dư CQG EOD (`CheckEODCQG`)
- **Mô tả:** So sánh số dư quy đổi (USD) giữa M-System và CQG.
- **Backend:** Triển khai phương thức quy đổi số dư tài khoản từ VND sang USD và đối soát chênh lệch > 100 USD.

#### 3. Giám sát Ký quỹ khả dụng (`margin-checker`)
- **Mô tả:** Thay thế tính năng giám sát tài khoản vi phạm tỷ lệ ký quỹ rủi ro.
- **Backend:** Viết công cụ thông dịch công thức rủi ro động từ cấu hình JSON và quét dữ liệu định kỳ để gửi Email cảnh báo vi phạm.

---

### Phân kỳ 2: Thanh toán & Thống kê CCP (CCP-Statistics-Tool)

#### 1. Gom nhóm & Đối chiếu tiền Nộp rút (NR)
- **Mô tả:** Đọc dữ liệu nộp rút, gom nhóm theo Thành viên và đối chiếu chênh lệch dòng tiền thực tế ngân hàng.
- **Backend:** Viết Service gom nhóm dữ liệu lớn dạng stream sử dụng `xlsx` để xử lý mượt mà, tránh nghẽn bộ nhớ.
- **Frontend:** Thiết kế Dashboard thống kê nộp rút và xuất báo cáo CCP.

---

### Phân kỳ 3: Báo cáo Định kỳ & Quy đổi (trading-report-app)

#### 1. Báo cáo Tăng trưởng Tháng/Quý
- **Mô tả:** Gom nhóm sản lượng giao dịch theo tháng/quý và tìm ngày giao dịch kỷ lục (Peak/Valley).
- **Backend:** Triển khai API phân tích lịch sử số liệu để tính toán so sánh (T so với T-1).

---

### Phân kỳ 4: Tự động hóa RPA (Headless Playwright)

#### 1. Viết script tự động đăng nhập vượt mã PIN ảo
- **Backend:** Xây dựng module RPA trong `BotEngineService` giả lập thao tác click tọa độ nút bấm PIN ảo khi đăng nhập M-System.
- **Automation:** Đăng ký các cron-job chạy ngầm tự tải file Excel về thư mục `/reports/temp` và gọi thẳng API đối soát tự động khi đến giờ bàn giao ca.

---

## Verification Plan

### Automated Tests
- Kiểm thử đơn vị (Unit Test) cho hàm quy đổi tỷ giá lãi/lỗ đảm bảo tính toán khớp từng đồng với Excel gốc.
- Chạy kiểm thử tự động so sánh kết quả xuất Excel đối chiếu giữa web mới và tool C# với cùng 1 bộ dữ liệu đầu vào.

### Manual Verification
- Vận hành song song hệ thống Web và bộ công cụ WinForms cũ trong 2 tuần tiếp theo trước khi thực hiện ngắt kết nối các desktop tool.
