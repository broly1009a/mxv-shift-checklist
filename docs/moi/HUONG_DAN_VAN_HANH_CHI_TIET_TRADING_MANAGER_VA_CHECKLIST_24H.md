# SỔ TAY HƯỚNG DẪN VẬN HÀNH CHI TIẾT
## HỆ THỐNG GIÁM SÁT GIAO DỊCH (TRADING MANAGER) & CA TRỰC TỰ ĐỘNG (CHECKLIST) 24/7
**Mercantile Exchange of Vietnam (MXV) - IT Operation Platform**

---

### PHẦN I: TỔNG QUAN KIẾN TRÚC VẬN HÀNH 24/7

Hệ thống được thiết kế theo mô hình **Độc lập hai tầng (Decoupled Two-Tier Architecture)**:
1. **Tầng 1 - Mission Control Engine (`/trading-manager`)**:
   - Hoạt động độc lập 24/5 liên tục xuyên suốt từ 05:00 Thứ Hai đến 06:30 Thứ Bảy.
   - Chạy nền tác vụ đối chiếu khớp lệnh 3 bên (`CHECK_KLGD`: M-System vs CQG vs ACM) theo chu kỳ cấu hình (`60 phút`, `30 phút`, `15 phút`).
   - Tự động tạm nghỉ cuối tuần bằng cơ chế **Market Weekend Guard** khi thị trường hàng hóa quốc tế đóng cửa.
   - Không bị ngắt quãng, không phụ thuộc vào trạng thái mở hay đóng của bất kỳ ca trực nào.

2. **Tầng 2 - Ca trực & Bàn giao (`/checklist`)**:
   - Được Scheduler tự động sinh lúc **00:01 sáng hàng ngày** gồm 3 ca trực: Ca Sáng, Ca Chiều, Ca Tối.
   - Sử dụng cơ chế **Link-to-Latest**: Tác vụ đối chiếu trong phiên (`CHECK_KLGD`) trong ca trực **không tự sinh tiến trình cào dữ liệu mới**, mà tự động lấy kết quả đối chiếu gần nhất từ Tầng 1 (trong vòng 60 phút) để chuyển trạng thái `PASSED` trong **0.05 giây**.
   - Phục vụ bằng chứng lịch sử bàn giao ca, tính tỷ lệ hoàn thành checklist và xuất báo cáo email `[MXV SHIFT HANDOVER]`.

---

### PHẦN II: HƯỚNG DẪN VẬN HÀNH TRADING MANAGER (`/trading-manager`)

#### 1. Tab "Đối Chiếu Khớp Lệnh Trong Phiên (KLGD)"
*Màn hình hiển thị kết quả kiểm tra khớp lệnh 3 bên theo thời gian thực.*

- **Bật/Tắt chế độ tự động chạy định kỳ**:
  - **Master Switch**: Nhấn nút `Tự động quét: BẬT / TẮT` (góc trên bên phải).
    - Khi **BẬT (Màu xanh)**: Backend Scheduler sẽ tự động kích hoạt luồng đối chiếu ngầm theo chu kỳ.
    - Khi **TẮT (Màu đỏ)**: Dừng toàn bộ các lượt quét tự động.
  - **Tần suất quét**:
    - Chọn tại dropdown **"Check định kỳ"**:
      - `60 phút (Tiêu chuẩn)`: Khuyến nghị dùng trong điều kiện thị trường giao dịch bình thường.
      - `30 phút (Cao điểm)`: Sử dụng trong các khung giờ cao điểm (19:30 - 23:00 hoặc trước khi giao phiên Mỹ).
      - `15 phút (Biến động mạnh)`: Sử dụng khi thị trường có tin tức lớn (báo cáo WASDE, CPI, FED) có khối lượng giao dịch đột biến.
- **Thực hiện quét tức thời bằng tay (Manual Run)**:
  - Nhấn nút **`Chạy Đối Chiếu Ngay`** bất kỳ lúc nào để kích hoạt lượt quét ngay lập tức. Kết quả sẽ cập nhật lên bảng số liệu sau 10-25 giây.
- **Xử lý khi phát hiện chênh lệch (Discrepancy)**:
  - Nếu kết quả trả về `LỆCH` (Màu vàng/cam):
    - Kiểm tra bảng chi tiết lệnh lệch: Cột `Nguồn lệch` (MS, CQG hoặc ACM), `Mã TKGD`, `Mã Hợp Đồng`, `Khối lượng`.
    - Tải file kiểm tra tại thư mục: `TradingCheck/Futures/<Ngày>/`.

---

#### 2. Tab "Sao Lưu & Thống Kê (Backup & Statistics)"
*Màn hình quản lý các tác vụ Batch tự động theo mốc thời gian cố định và chạy thủ công.*

- **Hiển thị lịch tự động từ Ca trực (Locked Display Inputs & Tooltip)**:
  - **`Thời điểm backup`**:
    - Hiển thị ô khóa chỉ đọc có icon Ổ Khóa (`04:30 🔒`).
    - Tự động lấy giờ kích hoạt từ Task Backup trong Ca trực đang mở (`/api/v1/shifts/active`).
    - Khi di chuột vào (Hover), xuất hiện Tooltip giải thích: *"Lịch tự động theo Ca trực: lúc 04:30. Để thay đổi giờ, vui lòng điều chỉnh tại Template Ca Trực."*
    - Nếu ca trực chưa cấu hình task này: Ô hiển thị `--:--` (mờ) kèm Tooltip hướng dẫn: *"Ca trực hiện tại chưa có lịch tự động cho tác vụ này. Bạn có thể nhấn nút [Backup MS] bên dưới để chạy thủ công bất cứ lúc nào."*
  - **`Thời điểm tạo thống kê`**:
    - Hiển thị ô khóa chỉ đọc có icon Ổ Khóa (`06:30 🔒`).
    - Tự động lấy giờ kích hoạt từ Task Macro trong Ca trực đang mở.
    - Khi di chuột vào (Hover), xuất hiện Tooltip tương tự chỉ dẫn nguồn gốc từ Ca trực.
- **Nút Master Switch**:
  - Nút `Tự động Backup: BẬT`: Master switch bật/tắt toàn bộ tiến trình hẹn giờ. Nếu bấm dừng, tất cả các tác vụ batch tự động tải backup & thống kê sẽ tạm ngưng.
- **Kích hoạt thủ công tức thời (Manual Run)**:
  - `[Backup MS]`: Kích hoạt cào lại dữ liệu M-System ngay lập tức.
  - `[Backup CQG]`: Kích hoạt tải lại dữ liệu CQG ngay lập tức.
  - `[Chạy Macro Lot]` & `[Chạy Macro Giá Trị]`: Kích hoạt tính toán lại thống kê mà không cần chờ đến mốc giờ hẹn.

---

### PHẦN III: HƯỚNG DẪN VẬN HÀNH CA TRỰC CHECKLIST (`/checklist`)

#### 1. Quy trình làm việc hàng ngày của Nhân viên trực ca
1. **Đầu ca**:
   - Truy cập `/checklist`, chọn ca trực tương ứng trong ngày (Ca Sáng, Ca Chiều, hoặc Ca Tối).
   - Nhấn **`Bắt đầu ca`** (chuyển trạng thái sang `IN_PROGRESS`).
2. **Trong ca**:
   - Nhân viên thực hiện các tác vụ thủ công (như kiểm tra hệ thống điều hòa, điện UPS, camera...).
   - Đối với các tác vụ chạy Bot:
     - **Tác vụ `CHECK_KLGD` (Đối chiếu khớp lệnh trong phiên)**:
       - Bot tự động quét ngầm mỗi phút.
       - Khi quét tới `CHECK_KLGD`, bot tự động nhận diện kết quả mới nhất vừa chạy từ Trading Manager trong 60 phút gần đây và tự động đánh dấu `PASSED` (Tích xanh) trong 0.05 giây.
       - Nhân viên có thể bấm vào tác vụ để xem bảng chi tiết số liệu đối chiếu 3 bên.
3. **Cuối ca & Bàn giao**:
   - Kiểm tra các tác vụ đã hoàn tất 100%.
   - Nhấn **`Chốt ca & Bàn giao`**: Hệ thống tự động tổng hợp tỷ lệ hoàn thành, đính kèm kết quả đối chiếu và gửi email `[MXV SHIFT HANDOVER]` tới ban điều hành.

---

### PHẦN IV: QUY TẮC CẤU HÌNH TEMPLATE CA TRỰC (DÀNH CHO ADMIN)

Khi Quản trị viên (Admin) tạo mới hoặc chỉnh sửa Template ca trực trên web:
- **Tác vụ `CHECK_KLGD`**:
  - **Loại Bot (`botCheckType`)**: Chọn **`Đối Chiếu Khớp Lệnh Trong Phiên (CHECK_KLGD)`**.
  - **Tần suất chạy (`frequencyMinutes`)**: Đặt `60` (phút).
  - **Mã Task ID (`taskId`)**: Có thể đặt bất kỳ mã nào (ví dụ: `task_check_klgd_s1`, `sub_recon_01`, UUID tự sinh...). Code backend giải quyết động 100% qua `botCheckType`, không bao giờ hardcode mã task.
- **Tuyệt đối không cần xóa tác vụ này khỏi Template**:
  - Giữ lại tác vụ `CHECK_KLGD` trong Template là hoàn toàn chính xác để ca trực có đầy đủ lịch sử kiểm tra và hiển thị tỷ lệ % hoàn thành trong email bàn giao ca.

---

### PHẦN V: XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

| Tình huống sự cố | Nguyên nhân | Biện pháp xử lý |
| :--- | :--- | :--- |
| **Trading Manager không tự chạy theo chu kỳ 60 phút** | Master Switch `Tự động quét` đang TẮT, hoặc đang là cuối tuần (Market Weekend Guard). | 1. Bật nút `Tự động quét: BẬT`.<br>2. Kiểm tra nếu là Thứ Bảy/Chủ Nhật thì bot tự nghỉ cho đến 05:00 sáng Thứ Hai. |
| **Checklist ca trực báo "Đang chờ file đối chiếu..."** | Chưa có file đối chiếu được tải về thư mục `TradingCheck/`. | Nhấn nút `Chạy Đối Chiếu Ngay` tại Trading Manager để bot tải và đối chiếu tức thời. |
| **Hai ca trực chuyển giao nhưng số liệu khớp lệnh vẫn giữ nguyên** | Ca sau tự động kế thừa kết quả gần nhất của ca trước (trong vòng 60 phút). | Đây là tính năng chuẩn (Link-to-Latest). Khi hết 60 phút, hệ thống sẽ tự động cập nhật mốc đối chiếu mới. |
| **Tài khoản crawler M-System bị đăng xuất** | Phiên đăng nhập web M-System bị hết hạn timeout. | Bot RPA Playwright tự động thực hiện đăng nhập lại khi chạy lượt tiếp theo. |
