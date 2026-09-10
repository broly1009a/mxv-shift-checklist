# TÀI LIỆU KỊCH BẢN KIỂM THỬ CORE LOGIC HỆ THỐNG ĐỐI SOÁT GIAO DỊCH
## (MXV Trading Operation Console & Reconciliation Arbiter Test Cases)

- **Dự án**: MXV Shift Checklist - Phân hệ Trading Operation & Reconciliation
- **Mục tiêu**: Kiểm thử độc lập & thẩm định chuyên sâu toàn bộ Core Logic tính toán số lot, lọc mốc thời gian phiên, chốt vị thế ròng và nhận diện rủi ro ký quỹ thay thế hoàn toàn Tool C# Desktop.
- **Tiêu chuẩn chất lượng**: **Zero-Defect ($\Delta = 0$)** — Tuyệt đối không chấp nhận bất kỳ sai số nào về số lot hoặc trạng thái tài khoản.
- **Tài liệu tham chiếu**: [TAI_LIEU_DOI_CHIEU_MAN_HINH_TRADING_MANAGER.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/docs/TAI_LIEU_DOI_CHIEU_MAN_HINH_TRADING_MANAGER.md)

---

## I. MA TRẬN PHỦ KIỂM THỬ (TEST COVERAGE MATRIX)

| Mã TC | Tên Kịch Bản Kiểm Thử | Vấn đề / Bẫy Kỹ thuật Kiểm thử | Tiêu chí Nghiệm thu ($\Delta = 0$) |
| :--- | :--- | :--- | :--- |
| **TC-01** | Ghép cặp File thô CQG (`FR1` + `FR2`) | Bảo toàn nguyên vẹn số lot, không làm tròn, không drop dòng | $TotalLot_{FR} = TotalLot_{FR1} + TotalLot_{FR2}$ |
| **TC-02** | Bóc tách File Straits CSV (ACM) | Xử lý triệt để ký tự nhị phân **UTF-8 BOM** (`\ufeff`) và dấu chấm phẩy (`;`) | Đọc đủ $100\%$ số dòng, parse đúng cột `Account`, `Quantity` |
| **TC-03** | Lọc mốc giờ bắt đầu phiên (05:00 sáng) | Loại bỏ các lệnh khớp sau nửa đêm thuộc phiên T-1 tràn sang | Chỉ tổng hợp các lệnh có $DateTime \ge 05:00:00$ |
| **TC-04** | Bắt chênh lệch vị thế ròng Pre-EOD | So khớp vị thế ròng M-System (`TTTT`) vs CQG (`PS`) theo từng tài khoản | Phát hiện chính xác tài khoản lệch và số lot chênh lệch |
| **TC-05** | Quét rủi ro Ký quỹ Âm (Scrambled Columns) | Thứ tự cột trong `QLTKGD.xlsx` bị đảo lộn ngẫu nhiên | Header Matching tìm đúng cột Ký quỹ & Số dư, bắt đúng 100% TK vi phạm |
| **TC-06** | Tích hợp Web Console & Bypass Cooldown | API Aggregation & Nút bấm chạy kiểm tra tức thì | Trả dữ liệu JSON tổng hợp, bypass thành công cooldown 60 phút |

---

## II. CHI TIẾT TỪNG KỊCH BẢN KIỂM THỬ (TEST SPECIFICATIONS)

### 1. Kịch bản TC-01: Ghép Cặp File Thô CQG (`FR1` + `FR2` $\rightarrow$ `FR.xlsx`)
* **Mục tiêu**: Đảm bảo khi bot tải về 2 file giao dịch khớp lệnh từ 2 tài khoản CQG riêng biệt, engine ghép nối thành công thành 1 file duy nhất mà không làm mất bất kỳ giao dịch nào.
* **Dữ liệu đầu vào (Synthetic Dataset)**:
  * **File `FR1.xlsx`**:
    * Số lượng: 10 dòng giao dịch.
    * Mã hàng hóa: `ZCEZ26` (Ngô).
    * Khối lượng mỗi lệnh: 5 lot $\rightarrow$ **Tổng `FR1` = 50 lot**.
  * **File `FR2.xlsx`**:
    * Số lượng: 15 dòng giao dịch.
    * Mã hàng hóa: `ZLEZ26` (Dầu đậu tương).
    * Khối lượng: 10 dòng x 4 lot (40 lot) + 5 dòng x 8 lot (40 lot) $\rightarrow$ **Tổng `FR2` = 80 lot**.
* **Các bước thực hiện**:
  1. Khởi tạo `FR1.xlsx` và `FR2.xlsx` trong môi trường kiểm thử.
  2. Gọi hàm `worker.merge_cqg_files(f1, f2, f_out)`.
  3. Mở file kết quả `FR.xlsx` bằng Pandas để đếm số dòng và cộng tổng cột số lượng.
* **Kết quả kỳ vọng**:
  * Tổng số dòng trong `FR.xlsx`: Đúng $25$ dòng ($10 + 15$).
  * Tổng số lot trong `FR.xlsx`: Đúng $130$ lot ($50 + 80$).
  * Độ lệch $\Delta_{Lot} = 0$.

---

### 2. Kịch bản TC-02: Bóc Tách File Straits CSV (UTF-8 BOM & Delimiter `;`)
* **Mục tiêu**: Khắc phục triệt để lỗi kinh điển của các hệ thống cũ khi đọc file từ Straits Financial do file chứa byte order mark ẩn `\ufeff` và phân tách bằng `;` thay vì `,`.
* **Dữ liệu đầu vào (Synthetic Dataset)**:
  * File `Straits_sample.csv` nhúng trực tiếp byte nhị phân `\ufeff`:
    ```csv
    Account;Quantity;Price;Trade Date
    003C999001;12;45.20;2026-09-09
    003C999002;18;46.10;2026-09-09
    003C999003;5;45.80;2026-09-09
    ```
* **Các bước thực hiện**:
  1. Ghi file với chuẩn encoding `utf-8-sig`.
  2. Gọi hàm `worker.parse_straits_csv(csv_path)`.
* **Kết quả kỳ vọng**:
  * Tự động nhận diện delimiter là `;`.
  * Bỏ qua BOM, tên cột `Account` không bị dính ký tự lạ `\ufeffAccount`.
  * Đọc được chính xác $3$ dòng giao dịch.
  * Tổng số lot bóc tách: Đúng $35.0$ lot ($12 + 18 + 5$).

---

### 3. Kịch bản TC-03: Lọc Mốc Giờ Bắt Đầu Phiên (05:00 Sáng) Trong Khối Lượng Giao Dịch
* **Mục tiêu**: Đảm bảo các lệnh khớp trong khoảng 00:00 - 04:59 (thuộc phiên giao dịch của ngày trước T-1 do thị trường Mỹ mở xuyên đêm) không bị tính gộp nhầm vào phiên ngày T.
* **Dữ liệu đầu vào (Synthetic Dataset)**:
  * **File `DSGD.xlsx` (M-System)**: Gồm 5 lệnh khớp trong ngày:
    * `03:30:00`: 4 lot $\rightarrow$ *Trước 05:00 (Phải loại trừ)*
    * `04:55:00`: 6 lot $\rightarrow$ *Trước 05:00 (Phải loại trừ)*
    * `05:01:00`: 10 lot $\rightarrow$ *Sau 05:00 (Hợp lệ)*
    * `08:30:00`: 10 lot $\rightarrow$ *Sau 05:00 (Hợp lệ)*
    * `10:15:00`: 10 lot $\rightarrow$ *Sau 05:00 (Hợp lệ)*
    * *(Tổng thô trong file: 40 lot, nhưng số lot hợp lệ trong phiên = 30 lot)*.
  * **File `FR.xlsx` (CQG)**: 3 lệnh khớp từ 05:00 trở đi, tổng cộng 30 lot.
* **Các bước thực hiện**:
  1. Cấu hình tham số `sessionStart: "05:00"`.
  2. Gọi hàm `worker.reconcile_klgd(payload)`.
* **Kết quả kỳ vọng**:
  * `totalDSGD` sau khi lọc: Đúng $30$ lot (loại bỏ hoàn toàn 10 lot trước 05:00).
  * `totalFR`: Đúng $30$ lot.
  * `differ`: $0$ lot.
  * Trạng thái `passed`: `True` (Khớp tuyệt đối).

---

### 4. Kịch bản TC-04: Bắt Chênh Lệch Vị Thế Ròng Pre-EOD (M-System vs CQG)
* **Mục tiêu**: Kiểm tra khả năng phát hiện lệch vị thế ròng (Net Position) chi tiết theo từng mã hợp đồng và từng tài khoản trước giờ chốt sổ EOD.
* **Dữ liệu đầu vào (Synthetic Dataset)**:
  * **File `TTTT.xlsx` (M-System)**:
    * Tài khoản `003C8888` - Hợp đồng `ZCEZ26`: 15 lot.
    * Tài khoản `003C9999` - Hợp đồng `ZLEZ26`: **20 lot**.
  * **File `PS.xlsx` (CQG)**:
    * Tài khoản `003C8888` - Hợp đồng `ZCEZ26`: 15 lot *(Khớp)*.
    * Tài khoản `003C9999` - Hợp đồng `ZLEZ26`: **18 lot** *(Lệch 2 lot)*.
* **Các bước thực hiện**:
  1. Nạp `TTTT.xlsx` và `PS.xlsx` vào `payload`.
  2. Gọi hàm `worker.reconcile_pre_eod(payload)`.
* **Kết quả kỳ vọng**:
  * Trạng thái `passed`: `False`.
  * Danh sách `mismatchedPositions`: Bắt đúng chính xác duy nhất $1$ tài khoản vi phạm là `003C9999`.
  * Chi tiết sai lệch: `differ` = $2$ lot.

---

### 5. Kịch bản TC-05: Quét Rủi Ro IMR Khi Xáo Trộn Thứ Tự Cột (`QLTKGD.xlsx`)
* **Mục tiêu**: Đảm bảo thuật toán Header Column Matching tự động thích ứng khi định dạng xuất Excel của M-System bị xáo trộn vị trí cột, không bị đọc nhầm số liệu giữa cột Tiền và cột Ký quỹ.
* **Dữ liệu đầu vào (Synthetic Dataset)**:
  * File `QLTKGD.xlsx` có thứ tự cột bị đảo lộn hoàn toàn:
    * Cột 1: `Ghi chú` (Text)
    * Cột 2: `KÝ QUỸ KHẢ DỤNG` (Số thực)
    * Cột 3: `SỐ DƯ HIỆN TẠI` (Số thực)
    * Cột 4: `SỐ TKGD` (Mã tài khoản)
    * Cột 5: `Trạng thái` (Text)
  * Dữ liệu các dòng:
    * Dòng 1 (`003C001`): Ký quỹ +150M, Số dư +50M $\rightarrow$ Bình thường.
    * Dòng 2 (`003C002_AM_IMR`): Ký quỹ **-25,000,000**, Số dư +10M $\rightarrow$ **Vi phạm Âm IMR**.
    * Dòng 3 (`003C003_AM_TIEN`): Ký quỹ +80M, Số dư **-12,000,000** $\rightarrow$ **Vi phạm Âm Tiền**.
* **Các bước thực hiện**:
  1. Gọi hàm `worker.scan_negative_margin(payload)`.
* **Kết quả kỳ vọng**:
  * `negativeIMRAcc`: Bắt đúng chính xác `003C002_AM_IMR` (Số lượng: 1).
  * `negativeBalanceAccs`: Bắt đúng chính xác `003C003_AM_TIEN` (Số lượng: 1).
  * Thuật toán không bị crash hoặc nhận nhầm giá trị giữa hai cột.

---

### 6. Kịch bản TC-06: Tích Hợp Web Console & Trigger Bypass Cooldown
* **Mục tiêu**: Xác thực API tổng hợp số liệu thời gian thực và khả năng can thiệp chủ động của Maker trên giao diện Web.
* **Điều kiện kiểm thử**: Backend NestJS đang chạy tại cổng 3001.
* **Các bước thực hiện**:
  1. Gửi request `GET /api/v1/reconciliation/console-summary`.
  2. Gửi request `POST /api/v1/reconciliation/trigger-console-run` với `{ "bypassCooldown": true }`.
* **Kết quả kỳ vọng**:
  * Endpoint `console-summary` trả về status 200 kèm cấu trúc: `{ klgd, preEod, marginRisk, nextRunCountdown }`.
  * Endpoint `trigger-console-run` kích hoạt job mới ngay lập tức mà không bị từ chối bởi cơ chế cooldown 60 phút.

---

## III. HƯỚNG DẪN THỰC THI & TỰ ĐỘNG GHI KẾT QUẢ REVIEW

Để USER chủ động thực thi và có ngay biên bản kết quả chi tiết để review, script kiểm thử đã được tích hợp bộ ghi log Markdown tự động.

### Lệnh chạy kiểm thử trên Terminal:
```bash
# Di chuyển vào thư mục backend
cd backend

# Chạy test suite và tự động xuất biên bản nghiệm thu Markdown
python src/scripts/test_recon_engine.py
```

### File kết quả tự động ghi nhận sau khi chạy:
Sau khi lệnh hoàn thành, kết quả đo lường chi tiết sẽ được tự động cập nhật vào:
👉 **`backend/docs/TEST_REPORT_RECON_CORE.md`**

Mọi chỉ số về thời gian chạy (milliseconds), chi tiết số lot, các tài khoản chênh lệch và dấu kiểm `PASSED [OK]` sẽ được lưu trữ đầy đủ để phục vụ công tác đối chiếu và lưu vết kiểm toán.
