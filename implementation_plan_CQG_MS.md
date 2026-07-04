# Kế hoạch tự động hóa đối chiếu giá thanh toán CQG và M-System (Không dùng Excel Macro)

Tài liệu này phác thảo phương án kỹ thuật và kế hoạch triển khai chi tiết cho việc tự động hóa quy trình đối chiếu giá thanh toán (GTT) giữa hệ thống CQG Desktop và M-System (MS) của MXV.

## 1. Hiện trạng và Mục tiêu
* **Hiện trạng**: 
  1. Nhân viên vận hành mở CQG Desktop, tạo Quote Spreadsheet (QSS) và sao chép 130 mã hợp đồng vào (chia làm 2 tab do giới hạn 100 mã/tab).
  2. Thêm cột S (Settlement Price).
  3. Đăng nhập M-System và tải file CSV bảng giá (`market.csv`).
  4. Mở file Excel Macro (`Marco Ghep file.xlsm`) để thực hiện chép dữ liệu CQG, khớp VLOOKUP với M-System để tìm ra chênh lệch.
* **Mục tiêu**: Tự động hóa 100% bằng Playwright RPA + Node.js Backend. Loại bỏ hoàn toàn Excel Macro và thực hiện đối chiếu trực tiếp trên máy chủ. Kết quả đối chiếu sẽ được hiển thị trực tiếp trên Web Checklist và gửi thông báo qua Telegram.

---

## 2. Giải pháp Kỹ thuật

### A. Đối chiếu CQG (Đã hoàn thiện Core Test)
* **Kịch bản tự động**:
  1. Đăng nhập CQG Desktop qua URL `https://m.cqg.com/cqg/desktop/logon?ref=forced`.
  2. Chia danh sách 130 mã làm 2 batch (Tab 1: 100 mã, Tab 2: 30 mã).
  3. Đối với mỗi Tab:
     * Click nút `+` → Chọn widget `Quote Spreadsheet`.
     * Click `New list` → Nhập danh sách mã cách nhau bằng dấu phẩy → Ấn `OK`.
     * Click chuột phải vào thanh tiêu đề → Chọn `Add columns...` → Tìm kiếm `Settlement` trong dialog → Chọn cột `S` (Last settlement price) → Click `Add + Close`.
  4. **Thu thập dữ liệu (Scraping)**:
     * Dùng Playwright `page.evaluate()` truy cập DOM của AG-Grid.
     * Ánh xạ các hàng ở cột Symbol (`.ag-pinned-left-cols-container`) và cột Settlement Price (`.ag-center-cols-container`) qua thuộc tính `row-id` chung của hàng.
     * Xử lý cuộn ảo (virtual scrolling) bằng cách cuộn cột xuống từng bước 300px để load đầy đủ 100 mã vào DOM.
     * Cắt tỉa ký tự thừa trong Symbol (chỉ giữ lại mã chính, ví dụ: `ALIZ26` thay vì tên đầy đủ).
  5. **Đầu ra**: Lưu dữ liệu thu được dưới dạng file **JSON** (ví dụ `cqg-settlement.json`) trong thư mục tạm `temp/debug/cqg-qss-test/`.
     ```json
     [
       { "symbol": "ALIQ26", "price": 3323.5 },
       { "symbol": "ALIU26", "price": 3260.25 }
     ]
     ```

### B. Thu thập dữ liệu M-System
* **Kịch bản tự động**:
  1. Đăng nhập M-System thông qua Playwright (đã viết sẵn logic xử lý bàn phím PIN ảo trong `test-ms-login.ts`).
  2. Điều hướng thẳng tới trang Bảng giá: `https://msadmin.mxv.com.vn/#/orderManagement/orderCreating`.
  3. **Lấy dữ liệu**:
     * **Cách 1 (Bắt API)**: Lắng nghe event `page.on('response')` để bắt gói tin JSON danh sách giá trực tiếp từ hệ thống M-System. Đây là cách tối ưu nhất vì không phụ thuộc UI và cho dữ liệu JSON sạch ngay lập tức.
     * **Cách 2 (Tải file CSV)**: Click nút tải file CSV trên trang và lưu thành file `market.csv` vào thư mục tạm.
  4. **Đầu ra**: Trích xuất dữ liệu thành danh sách JSON chuẩn hóa:
     ```json
     [
       { "symbol": "ALIQ26", "price": 3323.5 },
       { "symbol": "ALIU26", "price": 3260.25 }
     ]
     ```

### C. Logic đối chiếu trong Node.js (Thay thế Excel Macro)
Không cần cài đặt Microsoft Excel hay chạy Macro phức tạp. Backend Node.js sẽ chạy một tác vụ so khớp bộ nhớ:
1. Đọc danh sách CQG JSON và MS JSON.
2. Tạo một Map ánh xạ từ `Symbol` sang `Price` của từng hệ thống.
3. So sánh từng mã hợp đồng:
   * Nếu khớp hoàn toàn: Đánh dấu trạng thái **SUCCESS** (Khớp giá).
   * Nếu lệch giá (ví dụ chênh lệch > 0): Đánh dấu trạng thái **MISMATCH** (Lệch giá) và tính số tiền chênh lệch.
   * Nếu thiếu mã ở một trong hai hệ thống: Đánh dấu trạng thái **MISSING**.
4. **Lưu trữ & Báo cáo**:
   * Cập nhật kết quả vào database của Web Checklist.
   * Nếu có lỗi hoặc lệch giá, tự động gửi cảnh báo chi tiết qua Telegram (sử dụng `TelegramService` của hệ thống).
   * Tùy chọn: Dùng thư viện `exceljs` để tạo file Excel báo cáo định dạng đẹp để người dùng tải về nếu cần lưu trữ.

---

## 3. Kế hoạch Triển khai
1. **Bước 1: Chạy thử kiểm tra trích xuất CQG**
   * Chạy lệnh `npm.cmd run test:cqg-qss` để kiểm thử toàn bộ quá trình: Login CQG → Tạo 2 tab QSS → Thêm cột S → Tự động cuộn ảo và trích xuất dữ liệu lưu thành `cqg-settlement.json`.
2. **Bước 2: Xây dựng script kiểm thử M-System**
   * Viết script test đăng nhập M-System, đi tới trang `orderCreating` và trích xuất bảng giá (ưu tiên API Interceptor hoặc tải file CSV).
3. **Bước 3: Tích hợp và Viết logic đối chiếu**
   * Tích hợp hai luồng trên vào `GttCheckerService` hoặc `RpaDownloaderService`.
   * Viết hàm so khớp JSON và xuất báo cáo kết quả lên Web Dashboard.

---

## 4. Kịch bản chạy thử nghiệm CQG
Bạn có thể chạy thử luồng lấy dữ liệu CQG mới bằng lệnh dưới đây trong Git Bash:
```bash
CQG_URL="https://m.cqg.com/cqg/desktop/logon?ref=forced" CQG_USER="mxvprice" CQG_PASS='M#x!v@202502' npm.cmd run test:cqg-qss
```
Sau khi chạy xong, hãy kiểm tra file dữ liệu trích xuất được lưu tại:
`backend/temp/debug/cqg-qss-test/cqg-settlement.json`
