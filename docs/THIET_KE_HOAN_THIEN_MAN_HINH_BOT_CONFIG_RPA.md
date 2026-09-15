# TÀI LIỆU THIẾT KẾ HOÀN THIỆN MÀN HÌNH CẤU HÌNH HỆ THỐNG RPA & ROBOT
## HỆ THỐNG GIÁM SÁT CA TRỰC MXV — ĐIỀU HÀNH TỰ ĐỘNG HÓA & PIPELINE DỮ LIỆU
**Mã màn hình**: `/admin/bot-config`  
**Đối tượng sử dụng**: Quản trị viên hệ thống (Admin), Trưởng ca vận hành (Shift Leader), Kỹ sư vận hành IT/QLGD (Ops Engineer).  
**Ngày cập nhật**: 14/09/2026  
**Trạng thái**: Bản thiết kế hoàn thiện (Architecture & UI/UX Specification)

---

## 1. BỐI CẢNH & MỤC TIÊU THIẾT KẾ (EXECUTIVE SUMMARY)

### 1.1. Hiện trạng & Điểm nghẽn thực tế
Hiện tại, màn hình `/admin/bot-config` đang quản lý 9 tab chức năng rời rạc. Khi vận hành ca trực hàng ngày, chuyên viên IT/QLGD gặp phải các khó khăn sau:
1. **Thiếu liên kết ngày phiên (`sessionDate`)**: Người dùng phải nhập ngày thủ công ở nhiều tab khác nhau; tab "Yêu cầu Tải báo cáo" (`ReportDownloader`) tải theo ngày hiện tại mà chưa cho phép chọn ngày phiên giao dịch (`selectedDate`).
2. **Chưa có Ma trận Sẵn sàng của File (File Readiness Matrix)**: Người vận hành không biết được thư mục ngày `YYYY/TMM.YYYY/DD.MM` đã có đủ 4 file CCP (`DSGD`, `TTM`, `TTTT`, `Tỷ giá`) hay các file CQG (`OD`, `FR`, `PS`, `OP`) hay chưa. Muốn kiểm tra phải mở Remote Desktop hoặc Windows Explorer của máy chủ.
3. **Phải thực hiện nhiều thao tác thủ công nối tiếp**: Tải báo cáo bằng tay $\rightarrow$ Vào thư mục kiểm tra $\rightarrow$ Sang tab Thống kê bấm chạy $\rightarrow$ Sang tab Đối chiếu bấm chạy.
4. **Hardcode đường dẫn và ngày tháng cũ**: Một số tab con (như `LotStatisticsPanel`, `ValueStatisticsPanel`) vẫn còn chứa các đường dẫn mẫu và mảng ngày trừ của tháng 07/2026, vi phạm nguyên tắc Dynamic Architecture theo `AGENTS.md`.

### 1.2. Mục tiêu của Màn hình sau khi Hoàn thiện
- **Tự động hóa End-to-End theo Ngày (Date-Centric Pipeline)**: Chỉ cần chọn Ngày phiên $\rightarrow$ Hệ thống tự động xác định đường dẫn thư mục `YYYY/TMM.YYYY/DD.MM`, tự động kiểm tra ma trận file, tự động tải thiếu hoặc cho phép kéo thả upload.
- **Cơ chế nạp file 3-trong-1 linh hoạt**:
  1. *Nguồn 1: Robot Playwright RPA* tự động đăng nhập M-System/CQG tải về server.
  2. *Nguồn 2: Thư mục chia sẻ mạng (`M:\` / Samba / NFS / Local)* tự động nhận diện file đã có sẵn do các bộ phận khác copy vào.
  3. *Nguồn 3: Upload bổ sung trực tiếp trên Web* (Kéo thả file `.xlsx`, `.csv`) khi hạ tầng mạng hoặc bot gặp sự cố.
- **Nút thực thi 1-Click ("Tải & Tự Động Xử Lý Toàn Diện")**: Tự động xếp hàng Job tải file $\rightarrow$ Khi tải xong tự động kích hoạt tính toán Thống kê Lot, Thống kê Giá trị và Đối chiếu phiên.
- **Giám sát thời gian thực & Giải quyết Captcha**: Tích hợp luồng giải captcha M-System trực quan ngay trên giao diện Web mà không cần truy cập server.

---

## 2. KIẾN TRÚC TỔNG THỂ MÀN HÌNH (HIGH-LEVEL UI ARCHITECTURE)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       CẤU HÌNH HỆ THỐNG RPA & ROBOT (/admin/bot-config)                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Top Bar]: 🟢 Agent Online (vps-trading-01 | Linux)   [📅 Ngày phiên: 14/09/2026 ▼]   [⚡ Pipeline: Tải & Chạy Thống Kê] [🔄 Làm mới]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Tabs]:                                                                                                                          │
│ 1. Trung tâm Tải & File Matrix (Mới) | 2. Thống kê Lot & Giá trị | 3. Đối chiếu & GTT | 4. Backup & Macro | 5. Kết nối | 6. Queue (2)│
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                                  │
│ ┌────────────────────────────────────────────────────────┐ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ 📁 MA TRẬN FILE NGÀY: 2026/T09.2026/14.09              │ │ 🤖 ĐIỀU KHIỂN ROBOT RPA TẢI BÁO CÁO                              │ │
│ │                                                        │ │                                                                  │ │
│ │ • M-System Reports (7/7 Sẵn sàng):                     │ │ [X] Tự động lưu vào: M:\Quanlygiaodich\...\2026\T09.2026\14.09   │ │
│ │   [✓] DSGD.xlsx (2.4 MB - 04:31)                       │ │ [X] Tải bộ báo cáo CoreCCP (DSGD, TTM, TTTT, Tỷ giá)            │ │
│ │   [✓] TTM.xlsx (1.1 MB - 04:31)                        │ │ [X] Tải bộ báo cáo Đối chiếu (NKTTHT, QLTKGD, NR, Markettruoc6h) │ │
│ │   [✓] TTTT.xlsx (850 KB - 04:32)                       │ │                                                                  │ │
│ │ • CQG Reports (4/4 Sẵn sàng):                          │ │ [📥 Bắt đầu Tải Báo Cáo]    [⚡ Tải & Tự Động Thống Kê CoreCCP]  │ │
│ │   [✓] FR1 + FR2 (Đã gộp FR.xlsx)                       │ │                                                                  │ │
│ │   [✓] PS1 + PS2 (Đã gộp PS.xlsx)                       │ │ ---------------------------------------------------------------- │ │
│ │ • CoreCCP Reference Files:                             │ │ 📤 KÉO THẢ UPLOAD BỔ SUNG FILE (NẾU MẠNG LỖI)                    │ │
│ │   [!] Thiếu file "Tỷ giá 14.09.2026.xlsx"              │ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │       -> [Nút Tải lên] hoặc [Bot Tải Tỷ giá VNCLEAR]   │ │ │ Kéo thả file .xlsx / .csv vào đây để nạp vào thư mục ngày    │ │ │
│ │                                                        │ │ └──────────────────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────┘ └──────────────────────────────────────────────────────────────────┘ │
│                                                                                                                                  │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ⚡ TIẾN TRÌNH & HÀNG ĐỢI JOBS GẦN NHẤT (JOB QUEUE STREAM)                                                                      │ │
│ │ [Job #66e4a] RPA_DOWNLOAD_REPORTS | Status: COMPLETED | 14/14 Files downloaded | Execution time: 42s                         │ │
│ │ [Job #66e4b] CORECCP_LOT_STATISTICS | Status: COMPLETED | 2 Lots | 336,441,600 VND | Output: ThongKe_14.09.2026.xlsx         │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CHI TIẾT CÁC PHÂN HỆ VÀ NÂNG CẤP HOÀN THIỆN

### 3.1. Header Toàn Cục: Date-Centric Context & Pipeline Action Bar
- **Bộ chọn ngày phiên giao dịch (`selectedDate`)**:
  - Tự động gán mặc định là **Ngày làm việc liền trước (Previous Workday)** hoặc ngày hiện tại nếu phiên đang mở.
  - Khi người dùng thay đổi ngày, toàn bộ các Tab con (File Matrix, Thống kê Lot, Thống kê Giá trị, Đối chiếu) tự động cập nhật ngữ cảnh đường dẫn thư mục `YYYY/TMM.YYYY/DD.MM`.
- **Thanh trạng thái Agent kết nối**:
  - Hiển thị badge xanh `Online` / đỏ `Offline` kèm tên máy chủ (`hostname`), hệ điều hành (`platform`), mức tải CPU/RAM.
- **Nút hành động nhanh "Pipeline Tải & Thống Kê"**:
  - 1 chạm kích hoạt liên hoàn: Enqueue RPA Download $\rightarrow$ Lắng nghe hoàn tất $\rightarrow$ Tự động Enqueue Thống kê CoreCCP Lot $\rightarrow$ Thông báo kết quả và bật nút tải file kết quả tổng hợp.

---

### 3.2. Tab 1: Trung Tâm Tải Báo Cáo & Ma Trận File Ngày (Report Downloader & File Matrix)
*Thay thế và nâng cấp component `ReportDownloader.tsx` hiện tại.*

#### A. Khối Ma trận File Ngày (Daily File Readiness Matrix)
Bảng kiểm tra trạng thái thời gian thực của thư mục `YYYY/TMM.YYYY/DD.MM`:
| Nhóm File | Tên File Quy Chuẩn | Nguồn Tải | Trạng Thái Nhận Diện | Hành Động |
| :--- | :--- | :--- | :--- | :--- |
| **CoreCCP / Thống Kê** | `DSGD.xlsx` | M-System | 🟢 Đã có (2.4 MB) | [Xem] [Tải về] |
| | `TTM.xlsx` | M-System | 🟢 Đã có (1.1 MB) | [Xem] [Tải về] |
| | `TTTT.xlsx` | M-System | 🟢 Đã có (850 KB) | [Xem] [Tải về] |
| | `Tỷ giá *.xlsx` | CoreCCP / SBV |  Chưa có | [Tải lên] [Cào web] |
| **CQG Raw & Merged** | `FR1.xlsx`, `FR2.xlsx` | CQG Cast | 🟢 Đã gộp `FR.xlsx` | [Chi tiết] |
| | `PS1.xlsx`, `PS2.xlsx` | CQG Cast | 🟢 Đã gộp `PS.xlsx` | [Chi tiết] |
| | `OP1.xlsx`, `OP2.xlsx` | CQG Cast | 🟢 Đã gộp `OP.xlsx` | [Chi tiết] |
| | `OD1.xlsx`, `OD2.xlsx` | CQG Cast | 🟢 Đã gộp `Od.xlsx` | [Chi tiết] |
| **Đối Soát & EOD** | `QLTKGD.xlsx` | M-System | 🟢 Đã có | [Xem] |
| | `NR.xlsx` | M-System | 🟢 Đã có | [Xem] |
| | `Straits.csv` | SFTP ACM | 🟢 Đã có | [Xem] |

#### B. Khối Điều Khiển Robot RPA Tải Báo Cáo
- Nhóm các gói tải nhanh bằng Preset:
  - **Gói CoreCCP**: Chọn nhanh `DSGD`, `TTM`, `TTTT`.
  - **Gói Đối Soát EOD**: Chọn nhanh `NKTTHT`, `QLTKGD`, `NR`, `TTTT`, `TLKQHSKQ`.
  - **Gói Quản Lý Lệnh**: Chọn nhanh `DSLK`, `DSLCK`, `DSLH`, `DSLDK`.
  - **Gói Toàn Bộ (Full Backup)**: Chọn toàn bộ 18 báo cáo.
- Nút bấm:
  - `[Khởi chạy RPA Tải Báo Cáo]`: Đưa job `RPA_DOWNLOAD_REPORTS` vào hàng đợi.
  - `[Tải Báo Cáo & Tự Động Thống Kê CoreCCP]`: Pipeline liên hoàn.

#### C. Khối Upload Bổ Sung File Trực Tiếp (Dropzone)
- Cho phép người dùng kéo thả file từ máy cá nhân lên.
- Backend tự động nhận diện tên file:
  - Nếu tên chứa `DSGD` $\rightarrow$ lưu thành `DSGD.xlsx` vào đúng thư mục `YYYY/TMM.YYYY/DD.MM`.
  - Nếu tên chứa `TTM` $\rightarrow$ lưu thành `TTM.xlsx`.
  - Nếu tên chứa `TTTT` $\rightarrow$ lưu thành `TTTT.xlsx`.
  - Nếu tên chứa `Tỷ giá` hoặc `Ty_gia` $\rightarrow$ lưu thành `Tỷ giá DD.MM.YYYY.xlsx`.
- Sau khi upload thành công, ma trận file tự động chuyển từ Đỏ sang Xanh mà không cần F5 trình duyệt.

---

### 3.3. Tab 2: Thống Kê Số Lot & Thống Kê Giá Trị (CoreCCP & Macro Engine)
*Hợp nhất và hiện đại hóa `LotStatisticsPanel.tsx` và `ValueStatisticsPanel.tsx`.*

#### A. Khắc phục triệt để các hạn chế hiện tại:
1. **Loại bỏ hoàn toàn đường dẫn tĩnh và mảng ngày hardcode**:
   - Chuyển `folderPathMs` và `folderPathCqg` sang cơ chế tính động:
     $$\text{destFolder} = \text{basePath} + \text{"/"} + YYYY + \text{"/T"} + MM.YYYY + \text{"/"} + DD.MM$$
   - Các danh sách ngày trừ (`truDates`, `fefDates`, `zftDates`) được tính toán động dựa trên lịch làm việc hoặc cho phép cấu hình qua UI popup, không hardcode `2026-07-03`.
2. **2 Chế độ Chạy linh hoạt**:
   - **Chế độ 1: Tự động từ thư mục Backup (Auto-Detect Folder)**: Quét trực tiếp file từ `YYYY/TMM.YYYY/DD.MM`. Hiển thị badge xanh xác nhận nếu 4 file đã sẵn sàng.
   - **Chế độ 2: Tải lên thủ công (Manual Upload)**: Dành cho môi trường dev/staging hoặc khi máy chủ không mount được ổ đĩa mạng `M:\`.
3. **Hiển thị Báo cáo Kết quả Trực quan**:
   - KPI Card: Tổng số Lot khớp, Tổng Giá trị Giao dịch (VND & USD), Số mã hợp đồng giao dịch, Số lượng lệnh theo loại (`NORMAL`, `SPREAD`, `LME`, `ACM`).
   - Bảng phân bổ chi tiết theo từng Hàng hóa / Kỳ hạn.
   - Nút `[Tải File Excel Thống Kê (.xlsx)]` xuất trực tiếp từ kết quả xử lý.
   - Checkbox `[Cập nhật vào file lũy kế năm]`: Tự động append dòng mới vào sổ cái lũy kế năm của MXV.

---

### 3.4. Tab 3: Backup Thư Mục & Đồng Bộ Hạ Tầng (Backup Auditor)
- Quản lý tập trung các cấu hình đường dẫn lưu trữ theo chuẩn `SystemSettings`:
  - Đường dẫn Backup M-System (mặc định: `M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures`).
  - Đường dẫn Backup CQG (mặc định: `M:\Quanlygiaodich\Tai lieu hoat dong\Backup CQG\Futures`).
  - Đường dẫn Backup ACM (mặc định: `C:\Quanlygiaodich\Tai lieu hoat dong\Backup ACM\Futures`).
  - Đường dẫn Quyết định Ký quỹ (mặc định: `M:\Quanlygiaodich\Tai lieu hoat dong\Quyết định - Thông báo\2. QĐ ban hành mức ký quỹ`).
- Tính năng **Kiểm Tra Tính Toàn Vẹn Thư Mục (Directory Health Audit)**:
  - Nút `[Kiểm tra thư mục hôm nay]`: Tự động rà soát xem thư mục `DD.MM` đã được tạo chưa, đã có đủ file đối chiếu chưa.
  - Tự động gộp file thô CQG nếu phát hiện `FR1` + `FR2` chưa gộp thành `FR.xlsx`.

---

### 3.5. Tab 4: Hàng Đợi Jobs, Xử Lý Captcha & Terminal Logs (Job Queue & Logs)
*Tối ưu hóa từ `JobQueuePanel.tsx`.*

1. **Giám sát thời gian thực (Live WebSocket / SSE polling)**:
   - Danh sách Jobs hiển thị rõ: ID, Loại tác vụ (`RPA_DOWNLOAD_REPORTS`, `CORECCP_LOT_STATISTICS`, `CHECK_KLGD`...), Thời điểm tạo, Thời gian chạy, Trạng thái (`QUEUED`, `PROCESSING`, `AWAITING_CAPTCHA`, `COMPLETED`, `FAILED`).
2. **Bộ giải quyết Captcha M-System trực tiếp trên Web**:
   - Khi Bot Playwright gặp Captcha, trạng thái chuyển sang `AWAITING_CAPTCHA`.
   - Hiển thị ảnh Captcha ngay trên màn hình kèm ô input nhập 4 ký tự và nút `[Gửi Captcha]`.
   - Sau khi gửi, Bot tự động điền vào form đăng nhập M-System và tiếp tục tải báo cáo.
3. **Trình xem Logs phong cách Terminal**:
   - Hộp console màu đen (`#0f172a`), font chữ Monospace, hiển thị từng dòng log chi tiết của Bot.
   - Nút `[Tải File ZIP Kết Quả]` tự động xuất hiện khi Job hoàn tất.

---

## 4. ĐẶC TẢ GIAO TIẾP DỮ LIỆU & API CONTRACTS

### 4.1. API Kiểm tra Ma trận File Ngày
- **Endpoint**: `GET /api/v1/bot-engine/files/readiness-matrix`
- **Query Params**: `?date=YYYY-MM-DD`
- **Response**:
```json
{
  "success": true,
  "date": "2026-09-14",
  "folderPath": "M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T09.2026\\14.09",
  "folderExists": true,
  "matrix": {
    "ccp": {
      "dsgd": { "exists": true, "filename": "DSGD.xlsx", "sizeBytes": 2481920, "updatedAt": "2026-09-14T04:31:00Z" },
      "ttm": { "exists": true, "filename": "TTM.xlsx", "sizeBytes": 1120300, "updatedAt": "2026-09-14T04:31:05Z" },
      "tttt": { "exists": true, "filename": "TTTT.xlsx", "sizeBytes": 870400, "updatedAt": "2026-09-14T04:32:10Z" },
      "tyGia": { "exists": false, "filename": null }
    },
    "cqg": {
      "fr": { "exists": true, "merged": true, "filename": "FR.xlsx" },
      "ps": { "exists": true, "merged": true, "filename": "PS.xlsx" },
      "op": { "exists": true, "merged": true, "filename": "OP.xlsx" },
      "od": { "exists": true, "merged": true, "filename": "Od.xlsx" }
    }
  },
  "isReadyForLotStatistics": false,
  "missingForLotStatistics": ["Tỷ giá"]
}
```

### 4.2. API Kích hoạt Pipeline Tải & Tự Động Thống Kê
- **Endpoint**: `POST /api/v1/bot-engine/trigger-pipeline`
- **Payload**:
```json
{
  "sessionDate": "2026-09-14",
  "actions": ["DOWNLOAD_M_SYSTEM", "DOWNLOAD_CQG", "AUTO_MERGE_CQG", "RUN_LOT_STATISTICS"],
  "targets": ["DSGD", "TTM", "TTTT", "QLTKGD", "NR"]
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Đã khởi tạo pipeline tự động hóa cho ngày 14/09/2026",
  "pipelineId": "pipe_66e4c01",
  "jobs": [
    { "jobType": "RPA_DOWNLOAD_REPORTS", "jobId": "job_01" },
    { "jobType": "CORECCP_LOT_STATISTICS", "jobId": "job_02", "dependsOn": "job_01" }
  ]
}
```

### 4.3. API Upload Bổ Sung File vào Thư Mục Ngày
- **Endpoint**: `POST /api/v1/bot-engine/files/upload-daily`
- **Form Data**:
  - `date`: `2026-09-14`
  - `targetType`: `DSGD` | `TTM` | `TTTT` | `EXCHANGE_RATE` | `AUTO_DETECT`
  - `file`: `Binary Multipart`
- **Xử lý**: Backend nhận diện file, lưu vào thư mục `YYYY/TMM.YYYY/DD.MM` với tên chuẩn hóa.

---

## 5. BẢNG SO SÁNH TRƯỚC VÀ SAU KHI HOÀN THIỆN

| Tiêu chí | Trước khi hoàn thiện | Sau khi hoàn thiện |
| :--- | :--- | :--- |
| **Quy trình chuẩn bị file** | Thủ công mở Windows Explorer, tìm từng file, copy từ máy trạm sang server hoặc upload từng file rời. | **Tự động 100%**: Bot tải về đúng cây thư mục `YYYY/TMM.YYYY/DD.MM`; hoặc tự động nhận diện file mạng; hỗ trợ kéo thả trực tiếp nếu thiếu. |
| **Kiểm tra file sẵn sàng** | Phải tự nhớ danh sách file cần thiết và kiểm tra thủ công. | **Ma trận trực quan (Readiness Matrix)**: Báo đèn xanh/đỏ từng file, thiếu file nào hiển thị nút xử lý ngay file đó. |
| **Thực thi thống kê & đối chiếu** | Phải chuyển qua lại giữa các tab khác nhau để bấm chạy từng phần. | **Pipeline 1-Click**: Bấm 1 nút hệ thống tự tải file $\rightarrow$ tự kiểm tra $\rightarrow$ tự tính toán thống kê và trả về kết quả. |
| **Xử lý Captcha M-System** | Người vận hành phải vào máy chủ/mở trình duyệt để gõ captcha. | **Nhập Captcha trên Web**: Hiển thị ảnh captcha ngay trên tab Hàng đợi, gõ mã và nhấn gửi trực tiếp. |
| **Tính linh hoạt hạ tầng** | Phụ thuộc đường dẫn ổ cứng tuyệt đối của Windows (`M:\...`), gãy khi chạy trên Linux/Docker. | **Đa nền tảng (Cross-Platform)**: Tự động phân giải đường dẫn giữa Windows (`M:\...`) và Linux (`/mnt/qlgd-it/...`), cấu hình động qua CSDL. |
| **Giao diện & Trải nghiệm (UI/UX)** | Dài dòng, nhiều tham số kỹ thuật phức tạp khó nhớ. | **Enterprise Look & Feel**: Gọn gàng, hiện đại, 100% icon SVG Lucide, không dùng emoji thô, màu sắc hài hòa. |

---

## 6. LỘ TRÌNH TRIỂN KHAI & TIÊU CHÍ KIỂM THỬ (ROADMAP & ACCEPTANCE)

### Giai đoạn 1: Chuẩn hóa Backend & API Ma trận File Ngày
- [x] Tạo helper lấy đường dẫn backup chuẩn (`getCcpBackupBase`, `getMsBackupBase`).
- [x] Triển khai API quét file ngày `scan-daily` và xử lý `process-daily` cho CoreCCP Lot Statistics.
- [ ] Bổ sung API `GET /api/v1/bot-engine/files/readiness-matrix` kiểm tra toàn bộ file ngày của cả M-System, CQG và CoreCCP.
- [ ] Bổ sung API `POST /api/v1/bot-engine/files/upload-daily` cho phép nạp file vào thư mục ngày từ giao diện web.

### Giai đoạn 2: Tối ưu hóa UI/UX Màn hình Bot Config
- [ ] Nâng cấp Header của `/admin/bot-config` với `sessionDate` toàn cục.
- [ ] Thay thế `ReportDownloader.tsx` bằng component hợp nhất **Trung tâm Tải & Ma trận File Ngày**.
- [ ] Tích hợp tính năng kéo thả upload bổ sung file ngay trên giao diện ma trận file.
- [ ] Kết nối nút bấm 1-Click Pipeline "Tải Báo Cáo & Tự Động Thống Kê".

### Giai đoạn 3: Kiểm thử Chấp nhận Người dùng (UAT)
- **Kịch bản 1 (Tự động hoàn toàn)**: Chọn ngày $\rightarrow$ Bấm Tải báo cáo $\rightarrow$ Bot tải đủ 4 file về thư mục ngày $\rightarrow$ Ma trận chuyển xanh $\rightarrow$ Tự chạy thống kê $\rightarrow$ Cho ra kết quả chính xác 100%.
- **Kịch bản 2 (Upload bổ sung)**: Giả lập thiếu file Tỷ giá $\rightarrow$ Kéo thả file `Tỷ giá 14.09.xlsx` vào dropzone $\rightarrow$ Ma trận nhận diện ngay lập tức $\rightarrow$ Bấm chạy thống kê thành công.
- **Kịch bản 3 (Chống hardcode)**: Đổi ngày phiên sang bất kỳ ngày nào trong năm $\rightarrow$ Hệ thống tự động trỏ đúng thư mục `YYYY/TMM.YYYY/DD.MM` mà không báo lỗi.
