# Ngữ cảnh Đối chiếu Dữ liệu Tự động (Cập nhật: 04/07/2026)

Tài liệu này lưu trữ toàn bộ tiến độ, cấu trúc code hiện tại và các đầu việc cần làm tiếp theo vào Thứ 2 (06/07/2026) liên quan đến module **Kiểm thử đối chiếu dữ liệu tự động (Reconciliation)**.

---

## 1. Trạng thái hiện tại
Chúng ta đã phát triển xong cả backend và frontend cho tính năng **Kiểm thử đối chiếu dữ liệu** (gồm KLGD, EOD, CQG) với 2 chế độ chạy:
1. **Chạy kiểm thử bằng file mẫu local (đang hoạt động tốt):** Đọc các file trực tiếp từ thư mục BackupMS của tool mẫu trên máy.
2. **Tải lên và chạy kiểm thử bằng file thủ công (Mới bổ sung và đang hoạt động tốt):** Cho phép chọn các file từ máy tính cá nhân để upload và chạy đối chiếu ngay lập tức qua API `/reconciliation/test-upload` mà không cần bot hay thư mục local.
3. **🤖 Bot tự động tải & Đối chiếu (đang ở trạng thái chờ xác nhận URL):** Bot tự động đăng nhập M-System và tải file về đối chiếu.

---

## 2. Chi tiết các file đã sửa đổi

### Backend (`/backend`)
*   **[rpa-downloader.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/rpa-downloader.service.ts)**:
    *   Thêm hàm helper `gotoAndDownload(...)` để điều hướng trực tiếp bằng URL thay vì click menu (để tránh lỗi giao diện và tăng tốc độ tải).
    *   Tăng thời gian timeout chờ tải file (`waitForEvent('download')`) từ **30 giây lên 90 giây** nhằm phục vụ các báo cáo số lượng dòng lớn.
    *   Cập nhật `downloadQLTTTKGD` và `downloadTTTT` sử dụng `gotoAndDownload` để trực tiếp tải báo cáo.
    *   Thêm pipeline tải file tổng hợp: `downloadReconciliationFiles()`.
*   **[reconciliation.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.controller.ts)**:
    *   `GET /reconciliation/sample-dates`: Quét và trả về danh sách các thư mục ngày mẫu từ BackupMS.
    *   `POST /reconciliation/run-test-local`: Chạy cả 3 bài test đối chiếu dữ liệu (KLGD, EOD, CQG) sử dụng các file trong thư mục ngày mẫu được chọn.
    *   `POST /reconciliation/test-upload`: Endpoint nhận file multipart/form-data trực tiếp từ Client để chạy kiểm thử đối chiếu dữ liệu (KLGD, EOD, CQG) theo yêu cầu.
    *   `POST /reconciliation/run-auto`: Trực tiếp kích hoạt Bot RPA để tải file từ M-System và chạy đối chiếu EOD.
*   **[reconciliation.module.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/reconciliation/reconciliation.module.ts)**: Import `BotEngineModule` để sử dụng `RpaDownloaderService`.

### Frontend (`/frontend`)
*   **[admin/bot-config/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/page.tsx)**:
    *   Thêm giao diện quản lý ở dưới cùng: **"Kiểm Thử Đối Chiếu Dữ Liệu"**.
    *   Thêm hệ thống tab: **"📂 Chạy từ file mẫu local"** (BackupMS) và **"📤 Upload file thủ công"** (chọn file từ máy).
    *   Tự động map kết quả từ API test-upload lên khung hiển thị đối chiếu trực quan (giao dịch lệch, tài khoản lệch số dư, v.v.).

---

## 3. Nhiệm vụ cần làm vào Thứ 2 (06/07/2026)

### Xác nhận và cập nhật URL M-System
Hiện tại, đường dẫn trực tiếp (Hash route) của M-System trong `rpa-downloader.service.ts` đang được cấu hình chờ như sau:

1.  **Hàm `downloadQLTTTKGD` (Tải file báo cáo Quản lý tài khoản ký quỹ):**
    *   **Vị trí dòng:** Khoảng dòng `436`
    *   **Đường dẫn chờ hiện tại:** `#/clientManagement/investorManagement`
    *   **Cần làm:** Xác nhận xem đường dẫn này trên M-System thực tế có chính xác là `https://msadmin.mxv.com.vn/#/clientManagement/investorManagement` hay không. Nếu khác, hãy cập nhật lại tham số truyền vào hàm `gotoAndDownload`.

2.  **Hàm `downloadTTTT` (Tải file báo cáo Trạng thái tất toán):**
    *   **Vị trí dòng:** Khoảng dòng `538`
    *   **Đường dẫn chờ hiện tại:** `#/orderManagement/transactionList`
    *   **Cần làm:** Xác nhận xem đường dẫn trên M-System thực tế có chính xác là `https://msadmin.mxv.com.vn/#/orderManagement/transactionList` hay không. Nếu khác, hãy cập nhật lại.

3.  **Hàm `downloadEODCsv` (Tải file eod.csv):**
    *   Đang quét tự động qua mảng `eodPaths` gồm:
        *   `#/systemManagement/eodResult`
        *   `#/systemManagement/eod`
        *   `#/eodManagement/eodResult`
    *   **Cần làm:** Xác nhận đường dẫn thực tế của trang kết quả EOD trên M-System và cập nhật vào code nếu cần.

---

## 4. Hướng dẫn tiếp tục phiên làm việc mới
Vào đầu phiên làm việc mới, hãy gửi yêu cầu cho AI:
> *"Hãy đọc file `reconciliation_context.md` ở thư mục gốc của dự án để nắm bắt tiến độ module Đối chiếu tự động và giúp tôi kiểm tra/sửa lại các đường dẫn URL của M-System."*
