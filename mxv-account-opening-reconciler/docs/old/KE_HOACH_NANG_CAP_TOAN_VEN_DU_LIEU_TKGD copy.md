# Kế Hoạch Nâng Cấp Mã Nguồn Đảm Bảo Tính Toàn Vẹn Dữ Liệu Đối Soát TKGD

Tài liệu này tổng hợp toàn bộ các điểm cải tiến và loại bỏ các logic fallback tiềm ẩn rủi ro sai lệch dữ liệu, nhằm đưa hệ thống đối soát hồ sơ mở TKGD đạt chuẩn **Toàn vẹn Dữ liệu (Data Integrity) & Tuân thủ Kiểm toán (Audit Compliance)** của Sở Giao dịch Hàng hóa Việt Nam (MXV).

---

## 1. Các Vấn Đề Cần Giải Quyết (Problem Statements)

1. **`Ngày ký HĐ` bị miss nhiều trên hệ thống**:
   - Python worker (`tkgd_extractor_worker.py`) chưa hề có logic trích xuất `ngayKyHD` từ file Hợp đồng PDF.
   - Hệ thống trước đó fallback sang `ms.ngayThamGia`. Khi M-System chưa nhập ngày tham gia thì cột ngày ký bị trống hoàn toàn.
   - Đã thống nhất: **Tuyệt đối KHÔNG lấy ngày nhận email (`receivedDateTime`) làm ngày ký HĐ** vì vi phạm bản chất pháp lý của hợp đồng.

2. **Rủi ro "Nhiễm chéo dữ liệu" trong 3 Sheet Excel đối chiếu**:
   - Helper xuất Excel (`tkgd-reconcile-exporter.helper.ts`) đang dùng `hd.soCanCuoc || ms.soCMND_HoChieu` và `cccd.soCanCuoc || ms.soCMND_HoChieu`.
   - Làm mất đi tính độc lập của 3 Sheet (`HopDong`, `Cancuoc`, `MS`), khiến kiểm toán viên không phát hiện được trường hợp bản giấy bị khuyết thông tin.

3. **Suy đoán Nơi cấp (`noiCap`) theo năm cấp**:
   - Python worker đang tự động gán `BỘ CÔNG AN` nếu năm $\ge 2024$ hoặc `Cục Cảnh sát...` nếu năm $\ge 2021$ khi ảnh mờ không đọc được nơi cấp.
   - Tiềm ẩn nguy cơ sai lệch với các trường hợp CMND cũ hoặc cấp đổi tại địa phương.

4. **Logic kiểm tra thiếu CCCD chưa tường minh để phản hồi TVKD**:
   - Điều kiện `if (targetCccd && msCccd && targetCccd !== msCccd)` chỉ bắt lỗi khi cả 2 bên cùng có số.
   - Khi hồ sơ đính kèm thực sự khuyết số CCCD, hệ thống chưa sinh ra câu thông báo lỗi rõ ràng để Cán bộ trực ca phản hồi cho TVKD.

---

## 2. Chi Tiết Kế Hoạch Thay Đổi (Proposed Changes)

### Component 1: Python Extractor Worker (`tkgd_extractor_worker.py`)

#### [MODIFY] [`backend/src/scripts/python/tkgd_extractor_worker.py`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/scripts/python/tkgd_extractor_worker.py)
* **Bổ sung trường `ngayKyHD` vào kết quả `extract_pdf_contract`**:
  * Trích xuất ngày ký mở đầu: `(?:Hôm nay|Hôm nay,)?\s*ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})` (hỗ trợ nhiều khoảng trắng, tab, dấu chấm).
  * Trích xuất chân trang: `(?:Hà Nội|Hồ Chí Minh|TP\.?\s*HCM|Đà Nẵng|Cần Thơ|[A-ZÀ-Ỹa-zà-ỹ\s]+),\s*ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})`.
  * Trích xuất nhãn trường: `(?:Ngày\s*ký|Ký\s*ngày|Ngày\s*thực\s*hiện)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})`.
  * Trả về `ngayKyHD` chuẩn định dạng `DD/MM/YYYY`.
* **Xóa bỏ logic suy đoán Nơi cấp (`noiCap`) theo năm**:
  * Chỉ lưu `noiCap` khi OCR thực sự đọc được text trên ảnh hoặc trên HĐ. Nếu không đọc được, giữ `None` (không tự đoán).

---

### Component 2: Backend Automation Service (`tkgd-automation.service.ts`)

#### [MODIFY] [`backend/src/modules/tkgd-automation/tkgd-automation.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/tkgd-automation/tkgd-automation.service.ts)
* **Map `ngayKyHD` vào `hopDongData`**:
  * `ngayKyHD: parseDate(pythonRes.hopDong.ngayKyHD)`.
  * Lưu trữ chuẩn xác vào MongoDB `CleanAccountRecord.hopDong.ngayKyHD`.
* **Chuẩn hóa điều kiện kiểm tra lỗi để sinh câu thông báo phản hồi TVKD**:
  * Nhận diện loại tài khoản:
    * Nếu là tiểu khoản (`-A`, `-L`, `-S`): Không bắt buộc ảnh CCCD trong mail, chỉ kiểm tra PL01 khớp tên và mã cơ sở.
    * Nếu là tài khoản cơ sở:
      * Kiểm tra thiếu CCCD đính kèm: `if (!targetCccd)` $\rightarrow$ Báo lỗi: `Hồ sơ thiếu CCCD (Ảnh CCCD không hợp lệ/mờ và HĐ không có số)`.
      * Kiểm tra thiếu CCCD trên MS: `if (ms.isFoundOnMS && !msCccd)` $\rightarrow$ Báo lỗi: `M-System chưa nhập số CCCD`.
      * Kiểm tra lệch số CCCD: `if (targetCccd && msCccd && targetCccd !== msCccd)` $\rightarrow$ Báo lỗi: `Lệch số CCCD (Hồ sơ: ${targetCccd} != MS: ${msCccd})`.

---

### Component 3: Excel Reconcile Exporter (`tkgd-reconcile-exporter.helper.ts`)

#### [MODIFY] [`backend/src/modules/bot-engine/helpers/tkgd-reconcile-exporter.helper.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/helpers/tkgd-reconcile-exporter.helper.ts)
* **Bảo vệ tính độc lập 100% của từng Sheet đối chiếu**:
  * **Sheet `HopDong`**: Chỉ ghi dữ liệu gốc bóc từ Hợp đồng (`hd.soCanCuoc`, `hd.ngaySinh`, `hd.ngayCap`, `hd.noiCap`, `hd.ngayKyHD`). Không lấy dữ liệu của MS đắp vào!
  * **Sheet `Cancuoc`**: Chỉ ghi dữ liệu gốc bóc từ ảnh CCCD (`cccd.soCanCuoc`, `cccd.ngaySinh`, `cccd.ngayCap`, `cccd.noiCap`). Nếu ảnh không đọc được và không có bảo chứng MD5, để trống ô.
  * **Sheet `MS`**: Chỉ ghi dữ liệu gốc cào từ M-System.
  * **Sheet `NoiDungMail`**: Xuất câu thông báo lỗi chi tiết ra Cột D (`Kết quả`) để Cán bộ trực ca copy phản hồi cho TVKD.

---

## 3. Kế Hoạch Kiểm Thử & Triển Khai (Verification & Deployment)

### Kiểm thử tự động
1. Chạy test Python worker trên file PDF mẫu (`NGO-DUC-HAI-mxv.pdf`, `NGUYEN-ANH-KHOA-mxv.pdf`) để xác nhận `ngayKyHD` bóc ra đúng `11/08/2026` và `24/07/2026`.
2. Kiểm tra TypeScript compile Backend (`nest build`).
3. Kiểm tra TypeScript compile Frontend (`npx tsc --noEmit`).

### Triển khai
1. Đồng bộ code lên Ubuntu VM `10.0.0.26`.
2. Restart PM2 processes (`mxv-backend` & `mxv-frontend`).
3. Cập nhật ghi vết vào `CHANGELOG_AI.md` và git commit.
