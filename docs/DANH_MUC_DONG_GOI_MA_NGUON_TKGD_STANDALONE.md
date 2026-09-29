# BẢN ĐỒ ĐÓNG GÓI MÃ NGUỒN TÁCH HẠ TẦNG HỆ THỐNG TKGD ĐỘC LẬP
*(MXV ACCOUNT OPENING RECONCILER — SOURCE CODE PACKAGING MANIFEST)*

> **Mục đích tài liệu**: Tổng hợp toàn bộ danh mục file, folder, dependencies và cấu hình môi trường của hệ thống Đối Soát Mở TKGD. Khi được cấp hạ tầng máy chủ/VM mới, Bạn chỉ cần bốc đúng danh mục này sang repo mới (`mxv-account-opening-reconciler`) là hệ thống có thể chạy độc lập 100%, không bị sót bất kỳ logic hay thư viện nào.

---

## MỤC LỤC
1. [Cấu Trúc Thư Mục Dự Án Độc Lập Mới](#1-cấu-trúc-thư-mục-dự-án-độc-lập-mới)
2. [Chi Tiết Ánh Xạ Toàn Bộ File Mã Nguồn (Source Code Mapping)](#2-chi-tiết-ánh-xạ-toàn-bộ-file-mã-nguồn-source-code-mapping)
3. [Danh Mục Thư Viện Cần Cài Đặt (Dependencies)](#3-danh-mục-thư-viện-cần-cài-đặt-dependencies)
4. [Tệp Biến Môi Trường Mẫu (.env.example)](#4-tệp-biến-môi-trường-mẫu-envexample)
5. [Kịch Bản Khởi Chạy Tự Động Trên Ubuntu Mới (PM2 / Docker)](#5-kịch-bản-khởi-chạy-tự-động-trên-ubuntu-mới-pm2--docker)

---

## 1. CẤU TRÚC THƯ MỤC DỰ ÁN ĐỘC LẬP MỚI

Khi khởi tạo dự án mới (`mxv-account-opening-reconciler`), cấu trúc thư mục chuẩn mực sẽ như sau:

```text
mxv-account-opening-reconciler/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── tkgd-automation/       <-- Toàn bộ Controllers & Services TKGD
│   │   │   └── engine-helpers/        <-- Toàn bộ Helpers: Mail, OCR, PDF, MS, Reconcile
│   │   ├── schemas/                   <-- Mongoose Schemas (MongoDB)
│   │   └── scripts/
│   │       ├── python/                <-- Python Worker OCR & Text Layer PDF
│   │       └── test_benchmark/        <-- Scripts kiểm thử Realtime & CLI Inspector
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── frontend/                          <-- (Giao diện Ca Trực Web độc lập hoặc nhúng)
│   ├── src/
│   │   ├── features/tkgd/             <-- Components, Modals, Hooks, Types, APIs
│   │   └── components/tkgd/           <-- TkgdConfigPanel.tsx (Cài đặt)
│   └── package.json
│
└── docs/                              <-- Bộ 5 tài liệu đặc tả chuẩn hóa & kiến trúc
```

---

## 2. CHI TIẾT ÁNH XẠ TOÀN BỘ FILE MÃ NGUỒN (SOURCE CODE MAPPING)

Dưới đây là danh sách đường dẫn tuyệt đối của tất cả các file trong repo hiện tại cần copy sang hệ thống mới:

### 2.1 Khối Backend Core (Controllers & Services)
| STT | File Nguồn Hiện Tại | Trách Nhiệm & Vai Trò Trong Hệ Thống Mới |
| :---: | :--- | :--- |
| **1** | [backend/src/modules/tkgd-automation/tkgd-automation.module.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/tkgd-automation.module.ts) | Module đăng ký các Controller và Provider của TKGD. |
| **2** | [backend/src/modules/tkgd-automation/tkgd-automation.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/tkgd-automation.controller.ts) | 20+ REST API endpoints: Nạp mail, Cào MS, Đối soát, Xuất Excel, Tái thẩm định, Stream log, Analytics. |
| **3** | [backend/src/modules/tkgd-automation/tkgd-automation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/tkgd-automation.service.ts) | Service điều phối trung tâm toàn bộ chu trình bóc tách, đối soát, chụp snapshot vết dữ liệu. |
| **4** | [backend/src/modules/tkgd-automation/services/tkgd-mail-ingest.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/services/tkgd-mail-ingest.service.ts) | Kết nối Microsoft Graph API, tải tệp đính kèm và lưu vào `raw_account_mails`. |
| **5** | [backend/src/modules/tkgd-automation/services/tkgd-config.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/services/tkgd-config.service.ts) | Quản lý cấu hình user, mã hóa / giải mã AES mật khẩu M-System và mã PIN ảo. |
| **6** | [backend/src/modules/tkgd-automation/services/tkgd-dev-remediation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/services/tkgd-dev-remediation.service.ts) | Bộ máy tái xử lý hồi tố E2E (Hỗ trợ chạy lại danh sách tài khoản theo yêu cầu). |
| **7** | [backend/src/modules/tkgd-automation/services/tkgd-excel-export.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/services/tkgd-excel-export.service.ts) | Sinh file Excel đối soát đa sheet chuyên nghiệp (`Auto_Data_mail_*.xlsx`). |
| **8** | [backend/src/modules/tkgd-automation/services/tkgd-progress.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/services/tkgd-progress.service.ts) | Quản lý tiến độ thời gian thực của tác vụ nền. |
| **9** | [backend/src/modules/tkgd-automation/services/tkgd-reconcile-core.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/services/tkgd-reconcile-core.service.ts) | Lõi thẩm định đối soát chéo và cập nhật kết luận vào DB. |

---

### 2.2 Khối Engine & Helpers Nghiệp Vụ Cốt Lõi
*(Nằm tại `backend/src/modules/bot-engine/helpers/`)*:

| STT | File Nguồn Hiện Tại | Vai Trò Kỹ Thuật |
| :---: | :--- | :--- |
| **10** | [tkgd-mail-parser.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts) | Phân tích cú pháp Subject email, bóc tách Key-Value body, nhận diện và phân loại file đính kèm. |
| **11** | [msystem-scraper.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/msystem-scraper.helper.ts) | RPA Playwright: Cào thông tin chi tiết NĐT, tải ảnh CCCD/chữ ký từ M-System. |
| **12** | [tkgd-doc-extractor.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-doc-extractor.helper.ts) | Bóc tách text layer PDF hợp đồng và phụ lục PL01 qua `pdf-parse`. |
| **13** | [tkgd-reconcile-rules.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts) | Bộ quy tắc đối soát 5 tiêu chí tất định (Họ tên, CCCD, Ngày sinh, Mã TKGD, CCCD trên MS). |
| **14** | [tkgd-reconcile-exporter.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-reconcile-exporter.helper.ts) | Định dạng cell màu, kẻ viền và đổ dữ liệu ra file Excel mẫu MXV. |
| **15** | [tkgd-cccd-fraud-detector.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-cccd-fraud-detector.helper.ts) | Bộ lọc nhận diện CCCD giả mạo / cắt ghép bất thường. |
| **16** | [crypto.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/utils/crypto.ts) | Hàm mã hóa AES-256-CBC bảo vệ mật khẩu và PIN M-System trong DB. |

---

### 2.3 Khối Schemas CSDL (Mongoose Models)
*(Nằm tại `backend/src/schemas/`)*:

| STT | File Nguồn Hiện Tại | Tên Collection MongoDB | Mục Đích Lưu Trữ |
| :---: | :--- | :--- | :--- |
| **17** | [clean-account-record.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/schemas/clean-account-record.schema.ts) | `clean_account_records` | **Bảng CSDL cốt lõi**: Lưu toàn bộ hồ sơ đối soát 3 bên, kết luận Khớp/Lệch, snapshot vết. |
| **18** | [raw-account-mail.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/schemas/raw-account-mail.schema.ts) | `raw_account_mails` | Lưu trữ email thô, header, body HTML và danh mục tệp đính kèm. |
| **19** | [tkgd-user-config.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/schemas/tkgd-user-config.schema.ts) | `tkgd_user_configs` | Cấu hình tài khoản cá nhân: user/pass/pin M-System, Refresh Token Outlook, đường dẫn lưu file. |
| **20** | [tkgd-activity-log.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/schemas/tkgd-activity-log.schema.ts) | `tkgd_activity_logs` | Lưu vết kiểm toán (Audit Log) cho từng hành động của ca trực. |
| **21** | [system-setting.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/schemas/system-setting.schema.ts) | `system_settings` | Lưu trữ bot credentials và cờ bật/tắt tự động toàn hệ thống. |

---

### 2.4 Khối Python OCR Worker
*(Nằm tại `backend/src/scripts/python/`)*:

| STT | File Nguồn Hiện Tại | Chức Năng |
| :---: | :--- | :--- |
| **22** | [tkgd_extractor_worker.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/scripts/python/tkgd_extractor_worker.py) | **Worker Python OCR**: Xử lý ảnh CCCD mặt trước (Họ tên, CCCD), giải mã MRZ ICAO dòng 2 kiểm tra dòng 1 mặt sau, trích xuất text PDF. |
| **23** | [recon_data_worker.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/scripts/python/recon_data_worker.py) | Worker dự phòng hỗ trợ bóc tách dữ liệu đối soát. |

---

### 2.5 Khối Scripts Vận Hành & Benchmark Tools
*(Nằm tại `backend/src/scripts/`)*:

| STT | File Nguồn Hiện Tại | Lệnh Chạy & Mục Đích |
| :---: | :--- | :--- |
| **24** | [test_tkgd_persistent_ms_realtime.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/scripts/test_tkgd_persistent_ms_realtime.js) | `node test_tkgd_persistent_ms_realtime.js --headed`<br>Đo lường Benchmark tốc độ Hot Query M-System mở sẵn (1.09s). |
| **25** | [tkgd_case_inspector.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/scripts/tkgd_case_inspector.js) | `node tkgd_case_inspector.js --inspect <MÃ>`<br>Công cụ CLI kiểm tra chi tiết 1 hồ sơ bất kỳ. |
| **26** | [_deploy_update_all.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/scripts/_deploy_update_all.js) | Script tự động đồng bộ code và reload PM2 lên máy chủ Ubuntu. |

---

### 2.6 Khối Frontend (Giao Diện Ca Trực & Cấu Hình)
*(Nằm tại `frontend/src/features/tkgd/` và `frontend/src/components/tkgd/`)*:

| STT | File Nguồn Hiện Tại | Chức Năng Trên Giao Diện |
| :---: | :--- | :--- |
| **27** | [TkgdDashboard.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/components/TkgdDashboard.tsx) | Trang Dashboard chính của Ca trực (Top Bar, Thống kê, Bảng hồ sơ). |
| **28** | [TkgdRecordsTable.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/components/TkgdRecordsTable.tsx) | Bảng hiển thị danh sách hồ sơ đối soát, cột Checkbox đa chọn, Badge màu Khớp/Lệch. |
| **29** | [TkgdActionToolbar.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/components/TkgdActionToolbar.tsx) | Thanh công cụ thao tác: Quét mail, Cào MS, Đối soát, Xuất Excel, Nút khắc phục Dev. |
| **30** | [TkgdConfigPanel.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/components/tkgd/TkgdConfigPanel.tsx) | Modal cấu hình: Tài khoản M-System, Outlook OAuth, Đường dẫn đĩa, Bật/Tắt Auto Pipeline 24/7. |
| **31** | [TkgdInspectionModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/components/modal/TkgdInspectionModal.tsx) | Modal kiểm tra chi tiết hồ sơ: Duyệt tay, Tái thẩm định, Chuyển tab. |
| **32** | [TabDataComparison.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/components/modal/TabDataComparison.tsx) | Bảng đối chiếu 3 bên (HĐ - CCCD - MS) kèm Tooltip `(i)` tra cứu nguồn gốc dữ liệu. |
| **33** | [TabAttachmentsViewer.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/components/modal/TabAttachmentsViewer.tsx) | Trình xem và phóng to ảnh CCCD 2 mặt, hợp đồng PDF, chữ ký. |
| **34** | [TkgdDevRemediationModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/components/modal/TkgdDevRemediationModal.tsx) | Hộp đen Live Logs khắc phục bug và đối chiếu Before vs After cho kỹ thuật. |
| **35** | [TkgdAuditLogsModal.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/components/modal/TkgdAuditLogsModal.tsx) | Modal tra cứu nhật ký tác vụ độc lập của phòng TTBT. |
| **36** | [useTkgdActions.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/hooks/useTkgdActions.ts) | React Hook xử lý gọi API pipeline, polling tiến độ, hiển thị toast. |
| **37** | [useTkgdData.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/hooks/useTkgdData.ts) | React Hook quản lý state danh sách hồ sơ, bộ lọc ngày, phân trang. |
| **38** | [tkgd.api.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/services/tkgd.api.ts) | Tầng kết nối REST API client với tiền tố `/api/v1/tkgd-automation`. |
| **39** | [tkgd.types.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/types/tkgd.types.ts) | TypeScript Interfaces & Types của toàn bộ thực thể hồ sơ, trạng thái. |

---

## 3. DANH MỤC THƯ VIỆN CẦN CÀI ĐẶT (DEPENDENCIES)

Khi triển khai máy chủ mới, chỉ cần chạy 2 lệnh cài đặt thư viện chuẩn:

### 3.1 Thư viện Node.js (`package.json`)
```bash
npm install @nestjs/common @nestjs/core @nestjs/mongoose mongoose \
  playwright-core exceljs pdf-parse nodemailer \
  @microsoft/microsoft-graph-client dotenv lucide-react
```

### 3.2 Thư viện Python (`requirements.txt`)
```text
pytesseract>=0.3.10
opencv-python-headless>=4.8.0
numpy>=1.24.0
Pillow>=10.0.0
pypdf>=3.17.0
```

---

## 4. TỆP BIẾN MÔI TRƯỜNG MẪU (.env.example)

```env
# Port chạy dịch vụ độc lập
PORT=3005

# Kết nối CSDL MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/mxv_tkgd_standalone?retryWrites=true&w=majority

# Cấu hình M-System Persistent Bot
MS_URL=https://msadmin.mxv.com.vn/
MS_USERNAME=mxvsupport
MS_PASSWORD=YourPasswordHere
MS_PIN=123456

# Cấu hình Microsoft Graph API (Outlook Streaming)
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=common

# Đường dẫn lưu trữ tệp đính kèm trên đĩa máy chủ Ubuntu
ATTACHMENT_STORAGE_PATH=/data/tkgd_attachments
```

---

## 5. KỊCH BẢN KHỞI CHẠY TỰ ĐỘNG TRÊN UBUNTU MỚI (PM2)

Trong file `ecosystem.config.js` trên hạ tầng mới:

```javascript
module.exports = {
  apps: [
    {
      name: 'tkgd-realtime-api',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
    },
    {
      name: 'tkgd-ms-persistent-daemon',
      script: 'dist/scripts/ms_persistent_daemon.js',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

---

> **TỔNG KẾT**: Bảng danh mục trên bao gồm **toàn bộ 39 file mã nguồn trọng yếu** cấu thành nên hệ thống Đối Soát TKGD hoàn chỉnh. Bất kỳ khi nào Bạn được cấp hạ tầng mới, chỉ cần mang trọn vẹn bộ file này sang là hệ thống sẽ khởi chạy mượt mà ngay lập tức!
