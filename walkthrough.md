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

---

## Cập Nhật Mới: Tự Động Hóa Xác Minh OMS (EOD & MM) & Chống Spam Lệnh Chạy

### 1. Sửa Logic Ngày Kiểm Tra T-1 (Ngày Giao Dịch Gần Nhất)
*   **Bù trừ múi giờ hệ thống (Timezone Offset Shift)**: Khắc phục lỗi cộng lệch múi giờ trên các máy chủ cục bộ chạy múi giờ Việt Nam (`GMT+7`) bằng cách lấy offset thực tế `getTimezoneOffset()` để tính toán. Đảm bảo bot luôn xác định chuẩn xác ngày hôm nay (`13/07/2026`) và ngày T-1 (`11/07/2026` - thứ Bảy sau khi lùi qua ngày Chủ Nhật).
*   **Mở rộng phạm vi đối khớp**: Cả chức năng kiểm tra EOD và kiểm tra lệnh Market Maker (MM) đều được điều chỉnh để chấp nhận dữ liệu khớp thuộc ngày hôm nay **hoặc** ngày T-1. Từ đó loại bỏ hoàn toàn các lỗi cảnh báo giả lập khi các hệ thống chạy EOD lệch giờ.

### 2. Ngăn Chặn Rung/Spam Nút Rerun ("Chạy lại kiểm tra (RPA)")
*   **Backend Concurrency Lock**:
    *   Thêm cờ hiệu trạng thái `isChecking` trong `OmsWatcherService` để theo dõi tiến trình chạy Playwright.
    *   Trong `BotEngineController`, chặn các yêu cầu trigger thủ công mới bằng cách ném ra ngoại lệ `HttpStatus.CONFLICT` (409) với thông điệp: *"Hệ thống đang chạy một phiên kiểm tra OMS khác. Vui lòng đợi."* nếu dịch vụ đang bận.
*   **Frontend Error Propagation**:
    *   Cập nhật hàm `handleTriggerCheck` trong `OmsStatusModal.tsx` để đọc chính xác thông điệp lỗi dạng JSON từ API trả về.
    *   Hiển thị thông báo chi tiết qua `toast.error(err.message)` khi user cố tình spam nút hoặc khi hệ thống đang xử lý tác vụ nền bận.

---

## Cập Nhật Mới: Tích Hợp Giao Diện Xem và Copy Template Tin Nhắn Đáo Hạn Hợp Đồng Thủ Công (QLGD)

Để hỗ trợ bộ phận QLGD dễ dàng thực hiện gửi thông báo thủ công tới các thành viên có vị thế đáo hạn trước khi chuyển đổi hoàn toàn sang hệ thống tự động, chúng tôi đã phát triển giao diện hiển thị và sao chép nhanh các template tin nhắn được sinh ra từ quy trình đối chiếu đáo hạn.

### 1. Backend

*   **`teams-notifier.service.ts`**:
    *   Bên cạnh việc xuất file text `teams_manual_messages.txt`, service nay tự động xuất thêm file dữ liệu cấu trúc JSON `teams_manual_messages.json` lưu trữ tại thư mục `/temp/downloads` và thư mục đối chiếu theo ngày `/temp/reconciliation/${YYYY-MM-DD}/`.
    *   Dữ liệu JSON bao gồm các thông tin chi tiết: mã thành viên, tài khoản, mã hợp đồng, tên hợp đồng, vị thế/lệnh chờ, hạn tất toán và nội dung tin nhắn mẫu được format chuẩn.
*   **`reconciliation.controller.ts`**:
    *   Thêm endpoint `GET /reconciliation/maturity-manual-messages?shiftLogId={id}`.
    *   Endpoint này tự động tìm kiếm ca trực theo `shiftLogId` để lấy ngày làm việc thực tế, định dạng ngày và trả về nội dung của cả hai file: file text thô (`textContent`) và file JSON đã phân tích cấu trúc (`jsonContent`). Có hỗ trợ fallback sang thư mục downloads nếu thư mục ngày chưa kịp khởi tạo dữ liệu.

### 2. Frontend

*   **`MaturityTemplateModal.tsx`**:
    *   Tạo mới component Modal hiển thị danh sách các tin nhắn đáo hạn bằng phong cách thiết kế kính mờ (glassmorphism) và dark-mode hiện đại.
    *   **Tab "Mẫu Copy Nhanh (Thành viên)"**:
        *   Hiển thị danh sách các thẻ (card) tương ứng với từng thành viên và tài khoản.
        *   Tích hợp thanh tìm kiếm thông minh ở đầu trang giúp lọc nhanh danh sách theo mã thành viên, tài khoản hoặc mã hợp đồng.
        *   Nút **"Copy tin nhắn"** một chạm (One-click Copy) hỗ trợ sao chép nội dung tin nhắn và hiển thị hiệu ứng chuyển trạng thái màu xanh lá kèm chữ *"Đã copy!"* trong 2 giây.
    *   **Tab "Xem File Thô (Full Text)"**:
        *   Hiển thị toàn bộ tệp văn bản raw được xuất ra từ hệ thống đối chiếu.
        *   Nút **"Sao chép toàn bộ"** giúp copy nhanh tất cả nội dung trong một lần bấm.
    *   Nút **"Tải lại dữ liệu" (Refresh)** tích hợp ở header để QLGD cập nhật danh sách nóng trực tiếp khi tiến trình đối chiếu vừa chạy xong.
*   **`TaskTable.tsx`**:
    *   Thêm nút **"Mẫu tin nhắn"** tại cột hành động dành riêng cho tác vụ kiểm tra đáo hạn hợp đồng `ops_during_05` (Giám sát tất toán hợp đồng). Nút này sử dụng icon `Copy` và tông màu tím Indigo đặc trưng.
*   **`page.tsx`**:
    *   Tích hợp modal `MaturityTemplateModal` và liên kết với nút bấm mở từ `TaskTable`.

---

## Cập Nhật Mới: Tích Hợp Quy Trình Đối Chiếu Khớp Lệnh Thanh Toán (TTTT vs PS)

Quy trình đối chiếu Khớp Lệnh Thanh Toán (TTTT vs PS) đã được tích hợp thành công cả ở Backend và Frontend nhằm đạt được sự tương đồng hoàn toàn với công cụ C# cũ và tăng cường khả năng phát hiện lệch chi tiết theo từng tài khoản.

### 1. Backend

*   **`reconciliation.service.ts`**:
    *   Cập nhật hàm `checkKLGD` để nhận thêm file `tttt`, `ps1`, và `ps2`.
    *   Hỗ trợ phân tích dữ liệu file `TTTT.xlsx` lấy tổng khối lượng bán và file `PS1.xlsx`/`PS2.xlsx` lấy tổng cột `S` (S value).
    *   Tự động chuẩn hóa mã tài khoản (loại bỏ các hậu tố `F`, `L`, `S` của CQG hoặc chuyển thành `-L`/`-S` tương thích với M-System) đảm bảo đối chiếu khớp chính xác.
    *   Tự động loại bỏ các mã hàng hóa không thuộc diện đối chiếu như `TRU`, `ZFT`, `FEF`, `MPO` và các tài khoản ACM kết thúc bằng chữ `A`.
    *   Tính toán tổng Lot TTTT, tổng Lot PS, chênh lệch và xuất danh sách các tài khoản lệch chi tiết (`mismatchedTTTT`).
*   **`reconciliation.controller.ts`**:
    *   Mở rộng endpoint `/upload-klgd` để chấp nhận thêm 3 file: `tttt`, `ps1`, và `ps2`.
    *   Đồng bộ kết quả đối chiếu vào ghi chú log của ca trực. Nếu phát hiện chênh lệch TTTT vs PS, hệ thống sẽ tự động cập nhật trạng thái checklist thành `NEEDS_ATTENTION` kèm theo ghi chú chi tiết.

### 2. Frontend

*   **`ReconciliationModal.tsx`**:
    *   Bổ sung thêm 3 dropzone cho phép tải lên file **TTTT (M-System)**, **PS1 (CQG)** và **PS2 (CQG)** trong giao diện đối chiếu KLGD.
    *   Cập nhật giao diện kết quả hiển thị thông tin trực quan:
        *   Tổng lot tất toán M-System (TTTT) và Tổng lot PS CQG.
        *   Chênh lệch tổng số lot tất toán.
        *   Bảng chênh lệch chi tiết theo tài khoản gồm: Tài khoản, Tổng Lot TTTT M-System, Tổng Lot PS CQG, Chênh lệch.
    *   Tự động phát hiện chênh lệch và hiển thị trạng thái cảnh báo trực quan cho người trực.


