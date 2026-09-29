# MXV ACCOUNT OPENING RECONCILER
### Dịch Vụ Đối Soát & Thẩm Định Hồ Sơ Mở Tài Khoản Giao Dịch Thời Gian Thực
**Sở Giao Dịch Hàng Hóa Việt Nam (Mercantile Exchange of Vietnam - MXV)**

---

## 1. GIỚI THIỆU TỔNG QUAN

`mxv-account-opening-reconciler` là hệ thống dịch vụ độc lập (Standalone Microservice) chuyên trách việc:
1. **Tiếp nhận Email mở TKGD thời gian thực (Event Stream)** từ hòm thư của các Thành viên Kinh doanh (TVKD).
2. **Bóc tách tự động dữ liệu 3 nguồn**:
   - Nội dung Email & Hợp đồng mở tài khoản (PDF Text Layer).
   - Thẩm định Căn cước công dân (OCR CCCD 2 mặt, giải mã MRZ ICAO Doc 9303 Part 5, phát hiện phôi giả mạo).
   - Tra cứu dữ liệu Nhà đầu tư trên hệ thống Core M-System qua trình duyệt mở sẵn 24/7 (Persistent Session Pool).
3. **Đối soát chéo 3 bên (Tri-Party Reconciliation)** theo 5 tiêu chí tất định (Họ tên, CCCD, Ngày sinh, Mã TK, CCCD trên M-System).
4. **Đẩy kết quả đối soát tức thì (7 – 8 giây)** lên Dashboard Cán bộ ca trực và hỗ trợ xuất báo cáo Excel đối soát đa sheet.

---

## 2. THƯ MỤC TÀI LIỆU NGHIỆP VỤ & KỸ THUẬT (DOCS INDEX)

Toàn bộ 16 tài liệu nghiên cứu, thiết kế, quy chuẩn và căn cứ pháp lý được lưu trữ tập trung tại thư mục [`docs/`](./docs/):

### Nhóm 1: Chiến Lược Hạ Tầng Mới & Chuẩn Hóa Quy Trình (Bản Mới Nhất)
* 📄 [CHUAN_HOA_FORMAT_EMAIL_VA_QUY_TRINH_TKGD.md](./docs/CHUAN_HOA_FORMAT_EMAIL_VA_QUY_TRINH_TKGD.md): **Quy chuẩn 1 format email gửi đến duy nhất** cho toàn bộ TVKD, xóa bỏ hoàn toàn code phỏng đoán.
* 📄 [KIEN_TRUC_TKGD_STANDALONE_REALTIME_STREAM_VA_MS_PERSISTENT.md](./docs/KIEN_TRUC_TKGD_STANDALONE_REALTIME_STREAM_VA_MS_PERSISTENT.md): Đặc tả kiến trúc **M-System Persistent Session (1.09s)** & Pipeline Realtime 7 giây.
* 📄 [DANH_MUC_DONG_GOI_MA_NGUON_TKGD_STANDALONE.md](./docs/DANH_MUC_DONG_GOI_MA_NGUON_TKGD_STANDALONE.md): Bản đồ đóng gói chi tiết 39 file mã nguồn của hệ thống.
* 📄 [SO_TAY_CAP_NHAT_MA_NGUON_TKGD_FORMAT_CHUAN.md](./docs/SO_TAY_CAP_NHAT_MA_NGUON_TKGD_FORMAT_CHUAN.md): Sổ tay hướng dẫn dev refactor mã nguồn theo format email chuẩn mới.

### Nhóm 2: Thẩm Định Pháp Lý & Chống Gian Lận Căn Cước (KYC/Fraud Prevention)
* 🛡️ [QUY_TAC_NHAN_DIEN_CCCD_GIA_MAO.md](./docs/QUY_TAC_NHAN_DIEN_CCCD_GIA_MAO.md): Căn cứ pháp lý (Luật Căn cước 26/2023, NĐ 137/2015, TT 59/2021 Bộ Công An), **giải mã MRZ 3 dòng ICAO Doc 9303** và ma trận phát hiện phôi giả mạo.

### Nhóm 3: Thiết Kế Kiến Trúc & Công Cụ Kỹ Thuật (Architecture & Tools)
* 🛠️ [DANH_MUC_DONG_GOI_FE_TKGD_STANDALONE.md](./docs/DANH_MUC_DONG_GOI_FE_TKGD_STANDALONE.md): **Đặc tả kiểm toán 26 file (12.562 dòng code) phân tách Frontend thành dịch vụ UI độc lập** (`mxv-account-opening-reconciler-ui` Port 3006).
* 🛠️ [THIET_KE_CHINH_SUA_TINH_GON_UX_TKGD.md](./docs/THIET_KE_CHINH_SUA_TINH_GON_UX_TKGD.md): **Chuẩn hóa Microcopy & tinh gọn UX ca trực**, tối giản các nút máy móc thành 1 nút `[Check]` và `[Check lại]`.
* 🛠️ [THIET_KE_TOOL_KY_THUAT_RE_EVALUATE_TKGD.md](./docs/THIET_KE_TOOL_KY_THUAT_RE_EVALUATE_TKGD.md): Thiết kế công cụ tái thẩm định E2E (Dev Remediation Tool) & Live Logs.
* 🛠️ [THIET_KE_KIEN_TRUC_MODULE_SCAN_TKGD.md](./docs/THIET_KE_KIEN_TRUC_MODULE_SCAN_TKGD.md): Kiến trúc module bóc tách và đối soát.
* 🛠️ [THIET_KE_TAI_KIEN_TRUC_MODULAR_TKGD.md](./docs/THIET_KE_TAI_KIEN_TRUC_MODULAR_TKGD.md): Thiết kế phân rã modular cho các helper nghiệp vụ.
* 🛠️ [THIET_KE_DASHBOARD_THONG_KE_DOI_SOAT_TKGD.md](./docs/THIET_KE_DASHBOARD_THONG_KE_DOI_SOAT_TKGD.md): Thiết kế UI Dashboard thống kê cho ca trực.
* 🛠️ [THIET_KE_CHECKBOX_E2E_VA_DATA_PROVENANCE_TOOLTIP.md](./docs/THIET_KE_CHECKBOX_E2E_VA_DATA_PROVENANCE_TOOLTIP.md): Thiết kế bảng đối chiếu 3 bên kèm tooltip nguồn gốc `(i)`.

### Nhóm 4: Báo Cáo Đánh Giá & Bàn Giao (Audit & Handover)
* 📊 [BAO_CAO_DANH_GIA_LOGIC_TKGD_VA_KHUYEN_NGHI.md](./docs/BAO_CAO_DANH_GIA_LOGIC_TKGD_VA_KHUYEN_NGHI.md): Đánh giá hiện trạng logic đối soát.
* 📊 [CHAM_DIEM_LOGIC_TKGD.md](./docs/CHAM_DIEM_LOGIC_TKGD.md): Bảng chấm điểm kỹ thuật từng hàm bóc tách.
* 📋 [CONTEXT_HANDOVER_TKGD.md](./docs/CONTEXT_HANDOVER_TKGD.md): Ngữ cảnh bàn giao kỹ thuật toàn diện.

---

## 3. CẤU TRÚC MÃ NGUỒN (SOURCE TREE)

```text
mxv-account-opening-reconciler/
├── package.json               # Cấu hình dependencies độc lập
├── tsconfig.json              # TypeScript configuration
├── nest-cli.json              # NestJS CLI config (tự build assets .py)
├── .env.example               # Mẫu cấu hình môi trường
├── ecosystem.config.js        # Cấu hình quản lý tiến trình PM2
├── requirements.txt           # Thư viện Python OCR (pytesseract, opencv, pypdf)
├── docs/                      # 16 tài liệu đặc tả nghiệp vụ & kỹ thuật
├── src/
│   ├── main.ts                # Entrypoint khởi chạy server trên port 3005
│   ├── app.module.ts          # Root Module kết nối CSDL MongoDB
│   ├── schemas/               # 5 Mongoose Schemas (CleanRecord, RawMail, UserConfig, ActivityLog, SystemSetting)
│   ├── modules/
│   │   ├── tkgd-automation/   # Controller (20+ APIs), Service điều phối, Ingest, Excel, Remediation
│   │   ├── engine-helpers/    # 7 Helpers (Mail parser, MS scraper, PDF extractor, Reconcile rules, Crypto)
│   │   └── system-settings/   # Module quản lý cấu hình hệ thống độc lập
│   ├── python/                # Python Worker OCR CCCD 2 mặt & PDF Text Layer
│   └── scripts/
│       ├── test_tkgd_persistent_ms_realtime.js  # Script benchmark Hot Query MS (1.09s)
│       ├── tkgd_case_inspector.js               # CLI Inspector kiểm tra hồ sơ
│       └── check_parallel_dual_run.js           # Công cụ kiểm toán song song chống miss
```

---

## 4. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG

### 4.1 Khởi chạy chế độ Phát triển (Development)
```bash
# Cài đặt thư viện Node.js & Python:
npm install
pip install -r requirements.txt

# Khởi chạy server:
npm run start:dev
# -> Server lắng nghe tại: http://localhost:3005
```

### 4.2 Khởi chạy chế độ Production (PM2 trên Ubuntu)
```bash
npm run build
pm2 start ecosystem.config.js
```

### 4.3 Kiểm tra tình trạng chạy song song (Chống Miss dữ liệu)
```bash
node src/scripts/check_parallel_dual_run.js --date YYYY-MM-DD
```
