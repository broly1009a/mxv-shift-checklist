# 📌 BẢNG THEO DÕI TIẾN ĐỘ & HƯỚNG DẪN KIỂM THỬ TỪNG MODULE
## HỆ THỐNG TỰ ĐỘNG BÓC TÁCH MAIL & ĐỐI SOÁT M-SYSTEM (MXV)

> **Nguyên tắc triển khai:**
> - **Làm đến đâu clear đến đấy:** Mỗi module khi hoàn thành đều có file mã nguồn, file schema, và **Script test chạy độc lập** để kiểm chứng ngay lập tức.
> - **Dữ liệu thật:** Kiểm tra dữ liệu được lưu trực tiếp vào MongoDB Atlas (`raw_account_mails` và `clean_account_records`) và màn hình thật của M-System.
> - **Ghi vết chi tiết:** Cập nhật trạng thái PASS/FAIL và nhật ký thực thi ngay tại tài liệu này.

---

## BẢNG TỔNG QUAN CÁC MODULE

| Module | Tên Module | Trạng Thái | Script Kiểm Thử Độc Lập | Kết Quả Xác Nhận |
| :---: | :--- | :---: | :--- | :--- |
| **M1** | **Đọc Mail & Lưu MongoDB (Raw + Clean NoiDungMail)** | 🟩 **HOÀN THÀNH** | `npx ts-node src/scripts/test_tkgd_module1_mail_mongo.ts` |  **PASS 100% (Atlas DB)** |
| **M2** | **RPA M-System Cào Chi Tiết TKGD & Lưu Khối `MS`** | 🟩 **SẴN SÀNG TEST** | `npx ts-node src/scripts/test_tkgd_module2_ms_scrape.ts --headed --code 001C0008386-A` |  User tự test trên terminal |
| **M3** | **Đối Soát Chéo & Xuất File Chuẩn `Auto Data mail.xlsm`** | 🟩 **SẴN SÀNG TEST** | `npx ts-node src/scripts/test_tkgd_module3_export_excel.ts` |  User tự test trên terminal |
| **ALL**| **Pipeline Tự Động Hóa Tổng Thể (End-to-End)** | 🟩 **SẴN SÀNG TEST** | `npx ts-node src/scripts/run_tkgd_pipeline.ts --headed` |  User tự test trên terminal |
| **M4** | **OCR CCCD & PDF Hợp Đồng (Giai đoạn 2)** | ⚪ *Dự phòng* | `python src/cccd_ocr.py` |  Đã test model Gemini Vision |



---

## 1. MODULE 1: ĐỌC MAIL & LƯU VÀO MONGODB

### Mục tiêu cần đạt được:
1. Đọc nội dung email yêu cầu mở TKGD (từ thư mục sample hoặc trực tiếp qua Microsoft Graph API).
2. Lưu nguyên vẹn vào Collection: **`raw_account_mails`** (để audit log & lưu vết).
3. Bóc tách thông tin có cấu trúc:
   - Mã TK Futures (`003C...`)
   - Mã TK ACM (`003C...-A`)
   - Tên tài khoản (`Ngô Đức Hải`)
   - Mã TVKD (`003`)
   - Cờ yêu cầu mở ACM
4. Lưu dữ liệu sạch vào Collection: **`clean_account_records`** (khối `noiDungMail` tương ứng với sheet `NoiDungMail` trong file Excel).

### Các file thành phần:
* Schema Mongoose:
  - `backend/src/schemas/raw-account-mail.schema.ts`
  - `backend/src/schemas/clean-account-record.schema.ts`
* Helper bóc tách:
  - `backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts`
* Script chạy test:
  - `backend/src/scripts/test_tkgd_module1_mail_mongo.ts`

### Cách thức kiểm thử (Dành cho User):
```powershell
cd "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\backend"
npx ts-node src/scripts/test_tkgd_module1_mail_mongo.ts
```
* **Kỳ vọng:**
  - Console in thông báo: Đã lưu thành công `RawAccountMail` và `CleanAccountRecord` vào MongoDB.
  - Script tự động query lại từ MongoDB và hiển thị bảng dữ liệu sạch vừa lưu để đối chiếu với email gốc.

---

## 2. MODULE 2: RPA M-SYSTEM CÀO CHI TIẾT & ENRICH KHỐI `MS`

### Mục tiêu cần đạt được:
1. Sử dụng Playwright tự động đăng nhập M-System (bằng credentials và bàn phím ảo PIN trong cài đặt).
2. Mở trực tiếp URL chi tiết: `https://msadmin.mxv.com.vn/#/clientManagement/investorManagement/{maTKGD}`.
3. Cào toàn bộ dữ liệu tab **THÔNG TIN**:
   - Họ và tên, Tên TKGD
   - Số CMT / Hộ chiếu (CCCD 12 số)
   - Ngày sinh, Ngày cấp, Nơi cấp
   - Địa chỉ thường trú
   - Trạng thái tài khoản (*Hoạt động*, *Chờ duyệt*)
4. Tìm record tương ứng trong MongoDB (`clean_account_records`) và cập nhật khối **`ms`** (tương ứng Sheet `MS` trong Excel).

### Các file thành phần:
* Bổ sung vào `backend/src/modules/bot-engine/rpa-downloader.service.ts`: hàm `scrapeInvestorDetail()`.
* Script chạy test:
  - `backend/src/scripts/test_tkgd_module2_ms_scrape.ts`

### Cách thức kiểm thử (Dành cho User):
```powershell
npx ts-node src/scripts/test_tkgd_module2_ms_scrape.ts --code 003C2333888
```
* **Kỳ vọng:**
  - Trình duyệt Playwright tự động mở, đăng nhập MS, điều hướng vào đúng trang chi tiết của mã TK.
  - Cào thành công các trường thông tin cá nhân.
  - MongoDB cập nhật khối `ms` của record, in kết quả ra màn hình.

---

## 3. MODULE 3: ĐỐI SOÁT & XUẤT EXCEL CHUẨN TEMPLATE `Auto Data mail.xlsm`

### Mục tiêu cần đạt được:
1. Đọc dữ liệu từ MongoDB (`clean_account_records`).
2. Chạy hàm so khớp logic (Reconciliation Engine):
   - So khớp Tên Mail vs Tên M-System.
   - Kiểm tra mã Futures vs mã ACM.
   - Đánh giá: `KHỚP HOÀN TOÀN` / `LỆCH TÊN` / `CHƯA TẠO TIỂU KHOẢN ACM` / `CHƯA TẠO TRÊN MS`.
3. Ghi dữ liệu vào file Excel:
   - Đổ đúng Sheet `NoiDungMail`
   - Đổ đúng Sheet `MS`
   - Tô màu trực quan kết quả đối soát.

### Script chạy test:
```powershell
npx ts-node src/scripts/test_tkgd_module3_export_excel.ts
```
* **Kỳ vọng:**
  - Sinh ra file `output/Auto_Data_Mail_Export_[YYYYMMDD].xlsm` (hoặc `.xlsx`).
  - Mở file kiểm tra 2 sheet `NoiDungMail` và `MS` có đầy đủ số liệu và cột so sánh.

---

## NHẬT KÝ THỰC THI (EXECUTION LOG)

| Thời Gian | Module | Nội Dung Thực Hiện | Trạng Thái | Người Xác Nhận |
| :---: | :---: | :--- | :---: | :---: |
| 03/09/2026 16:12 | M1 | Đọc 2 mail mẫu (Ngô Đức Hải, Nguyễn Anh Khoa), bóc tách và lưu thành công vào MongoDB Atlas cả 2 collection `raw_account_mails` và `clean_account_records`. Query kiểm chứng PASS 100%. | 🟩 **HOÀN THÀNH** | AI Assistant |
| 03/09/2026 16:25 | M2 | Hoàn thiện helper `msystem-scraper.helper.ts` với selector DOM thực tế từ USER, sửa điều hướng SPA Hash Router, bổ sung cờ `--headed` và `slowMo: 400ms`. Script sẵn sàng: `test_tkgd_module2_ms_scrape.ts`. | 🟩 **SẴN SÀNG TEST** | AI Assistant |
| 03/09/2026 16:32 | M3 | Hoàn thành helper `tkgd-reconcile-exporter.helper.ts` và script `test_tkgd_module3_export_excel.ts` đọc template `Auto Data mail.xlsm`, đối soát chéo và xuất file Excel có tô màu Khớp (Xanh) / Lệch (Đỏ). | 🟩 **SẴN SÀNG TEST** | AI Assistant |
| 03/09/2026 16:33 | ALL | Xây dựng Pipeline Runner `run_tkgd_pipeline.ts` kết nối liền mạch từ Mail -> M-System -> Xuất Excel đối soát hoàn chỉnh. | 🟩 **SẴN SÀNG TEST** | AI Assistant |


