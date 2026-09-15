# TÀI LIỆU ĐỐI CHIẾU GIAO DIỆN TRADING MANAGER & MA TRẬN MÃ NGUỒN (C# ↔ NESTJS ↔ NEXT.JS)

---

## I. TỔNG QUAN HỆ THỐNG & NGUỒN DỮ LIỆU
Tài liệu này chuẩn hóa toàn bộ các màn hình nghiệp vụ từ công cụ C# gốc (**Trading Manager** thuộc `it-tool-src/operate-transaction-app`) chuyển đổi sang hệ thống Web hiện đại (**MXV Shift Checklist** gồm NestJS Backend và Next.js Frontend).

### 3 Màn hình / Tab trọng tâm:
1. **Tab 1: Check GD - EOD - Sync**: Giám sát đối chiếu khối lượng giao dịch (KLGD), trạng thái mở (TTM), tất toán (TTTT), kiểm tra trước EOD, kết quả EOD và đồng bộ số dư CQG.
2. **Tab 2: Backup – Thống kê - GTT**: Quản lý tác vụ tải và lưu trữ file báo cáo M-System / CQG, xử lý Giá thanh toán (GTT), kiểm tra phân loại ký quỹ tài khoản (IMR) và chạy thống kê sản lượng/giá trị CCP.
3. **Tab 3: Cấu hình - Đường dẫn**: Cấu hình tỷ giá quy đổi/thanh toán, khung giờ phiên, các đường dẫn lưu trữ dữ liệu, danh sách tài khoản âm ký quỹ và lịch nghỉ lễ thị trường quốc tế (LME).

---

## II. CHI TIẾT TỪNG MÀN HÌNH VÀ ÁNH XẠ MÃ NGUỒN

### 1. TAB 1: "Check GD - EOD - Sync"

#### A. Phân rã giao diện từ ảnh:
* **Khung cấu hình chu kỳ**:
  - `[x] Check định kỳ (phút)`: Input số (mặc định: `60`).
  - `Thời điểm check gần nhất`: Hiển thị định dạng `dd/MM HH:mm` (Ví dụ: `08/09 14:00`).
* **Bảng ma trận đối chiếu 4 bên**:
  - Các cột: `Dữ liệu` | `M-System` | `CQG` | `ACM` | `Nano`
  - Các hàng chọn kiểm tra:
    - `[x] KLGD` (Khối lượng giao dịch)
    - `[x] TTM` (Trạng thái mở)
    - `[x] TTTT` (Tất toán vị thế)
  - Ô chọn ngày: `08/09/2026`
  - Checkbox: `Check thủ công` (bỏ qua bước tải lại file)
  - Nút bấm: `Check`
  - Icon Chuông: Xem lịch sử thông báo.
* **Bảng chi tiết chênh lệch (Tab lồng nhau)**:
  - Tab 1: `Chi tiết giao dịch chênh lệch`: Cột `Mã lệnh`, `Mã TKGD`, `Mã HĐ`, `Giá khớp`, `Khối lượng`, `Thời gian khớp`.
  - Tab 2: `Chi tiết TTM chênh lệch`: Hiển thị chênh lệch vị thế net giữa các nguồn.
* **3 Khối kiểm tra EOD & Số dư bên dưới**:
  - **Khối 1: Check DSGD trước EOD**: Bảng `TKGD âm KQ mới` | Nút `Check`.
  - **Khối 2: Kết quả chạy EOD**: Bảng gồm `TKGD`, `QLTKGD`, `EOD result` | Nút `Check`.
  - **Khối 3: Kết quả đồng bộ số dư CQG**: Bảng gồm `TKGD`, `Balance MS`, `Balance CQG` | Nút `Check`.

#### B. Ma trận ánh xạ mã nguồn:
| Thành phần giao diện | C# Method (`operate-transaction-app`) | NestJS Backend Service / Handler | Next.js Frontend Component |
| :--- | :--- | :--- | :--- |
| **Check KLGD / TTM / TTTT** | `FormMain.btnCheckGD_Click()` <br> `TransactionCheckingService.CheckKLGD()` | `reconciliation.service.ts` → `checkKLGD()` & `runAutoCheckKLGD()` <br> `recon-jobs.handler.ts` | `ReconciliationPanel.tsx` <br> `ReconciliationModal.tsx` (`mode='KLGD'`) <br> `KlgdReconciliationVisualReport.tsx` |
| **Check thủ công** | `FormMain.btnCheckGDWithoutDownload_Click()` | `reconciliation.controller.ts` → `@Post('check-klgd')` (kèm cờ `isDownload: false` hoặc upload file trực tiếp) | `ReconciliationPanel.tsx` (Tab `upload`) |
| **Check DSGD trước EOD** | `FormMain.btnCheckDSGDTruocEOD_Click()` <br> `TransactionCheckingService.CheckDSGDBeforeEOD()` | `reconciliation.service.ts` → `checkNegativeMargin()` <br> `post-eod-handler.service.ts` → `scanNegativeMarginAccounts()` | `MarginCheckerModal.tsx` <br> `MarginDecisionVisualReport.tsx` |
| **Kết quả chạy EOD (Pre-EOD)** | `FormMain.btnEODResult_Click()` <br> `TransactionCheckingService.CheckEOD()` & `CheckPreEOD()` | `reconciliation.service.ts` → `checkPreEOD()` & `checkEOD()` <br> `recon-jobs.handler.ts` | `ReconciliationModal.tsx` (`mode='PRE_EOD'`) <br> `PreEodReconciliationVisualReport.tsx` |
| **Kết quả đồng bộ số dư CQG** | `FormMain.btnCheckCQGSync_Click()` <br> `TransactionCheckingService.CheckEODCQG()` | `reconciliation.service.ts` → `checkEODCQG()` | `ReconciliationModal.tsx` (`mode='CQG'`) |
| **Lịch trình tự động 60 phút** | `FormMain.timerPeriodicCheck_Tick()` | `scheduler.service.ts` & `bot-engine.service.ts` (Cron 1 giờ/lần cho `TASK_CHECK_KLGD`) | `SystemSchedulerSettings.tsx` |

---

### 2. TAB 2: "Backup – Thống kê - GTT"

#### A. Phân rã giao diện từ ảnh:
* **Header cấu hình lịch chạy**:
  - `Ngày phiên hiện tại`: `08/09/2026`
  - `[x] Backup định kỳ (phút)`: `240`
  - `[ ] Thời điểm backup`: `04:30`
  - `[ ] Thời điểm tạo thống kê`: `04:45`
* **Cột Backup M-System** (Checkbox `All`, Nút `Backup`):
  - Danh sách 20 báo cáo: `NKTTHT`, `DSTKGD-Futures`, `DSTKGD-Spread`, `DSTKGD-LME`, `DSTKGD-ACM`, `TLKQ HSKQ`, `NR`, `DSTrader`, `market truoc 6h`, `DSLDK`, `DSLCK`, `DSLH`, `DSLK`, `DSGD`, `TTM`, `TTTT`, `TTCDH`, `DSQLKQ`, `QLTKGD`, `QLTKGD âm KQ`.
* **Cột Backup CQG** (Checkbox `All`, Nút `Backup`):
  - Danh sách 9 báo cáo: `FR1`, `FR2`, `PS1`, `PS2`, `OP1`, `OP2`, `OD1`, `OD2`, `AS`.
* **Khu vực Giá thanh toán (GTT)**:
  - Nút bấm: `Tạo file` | `Check` | `Tạo file nhập`
  - Bảng đối chiếu GTT: Cột `Mã HĐ`, `GTT MS`, `GTT CQG`.
* **Khu vực Kiểm tra ký quỹ TKGD**:
  - Nút bấm: `Check`
  - Bảng 4 phân loại vi phạm ký quỹ:
    1. `TK có lãi lỗ dự kiến nhưng không có TTM`
    2. `TK không có TTM và lệnh chờ nhưng có KQTT`
    3. `TKGD có TTM, không có lệnh chờ nhưng KQYCTT = KQYC`
    4. `TK không có lệnh chờ nhưng KQKDTT = KQKD`
* **Khu vực Thống kê CCP**:
  - `Thống kê số lot giao dịch`: Chọn ngày (`08/09/2026`) + Nút `Chạy thống kê`.
  - `Thống kê giá trị giao dịch`: Chọn ngày (`08/09/2026`) + Nút `Chạy thống kê`.

#### B. Ma trận ánh xạ mã nguồn:
| Thành phần giao diện | C# Method (`operate-transaction-app`) | NestJS Backend Service / Handler | Next.js Frontend Component |
| :--- | :--- | :--- | :--- |
| **Backup M-System (RPA Download)** | `FormMain.btnBackupMS_Click()` <br> `BackupService.RunBackup()` <br> `ChromeBot.RunBackup()` | `rpa-downloader.service.ts` → `downloadAllDailyReports()` <br> `rpa-download.handler.ts` | `ReportDownloader.tsx` <br> `BackupAuditor.tsx` |
| **Backup CQG (CQG Sync/Download)** | `FormMain.btnBackupCQG_Click()` <br> `ChromeBot.DownloadTradingFileCQG1/2()` | `cqg-sync.service.ts` → `syncCqgFiles()` <br> `reconciliation.service.ts` → `mergeCqgRawFiles()` | `ReportDownloader.tsx` <br> `BackupAuditor.tsx` |
| **Kiểm tra GTT (QSS vs MS)** | `FormMain.InitializeGTTGrid()` <br> `FormMain.btnCheckGTT` | `gtt-checker.service.ts` → `runFullGttCheck()` & `scrapeQSSPrices()` | `GttChecker.tsx` |
| **Tạo file nhập GTT (Correction)**| `FormMain.btnCreateFixGTTFile` | `gtt-checker.service.ts` → `generateCorrectionFile()` & `pushCorrectionToMSystem()` | `GttChecker.tsx` (Nút `Tạo file hiệu chỉnh` & `Đẩy MS`) |
| **Tạo file GTT rỗng/mẫu** | `FormMain.btnCreateGTTFile_Click()` <br> `BackupService.CreateGTT()` | `gtt-checker.service.ts` → `parseGttXlsx()` | `GttChecker.tsx` |
| **Kiểm tra ký quỹ TKGD (IMR 4 nhóm)**| `FormMain.btnAccountMarginCheck_Click()` <br> `BackupService.CheckIMR()` | `post-eod-handler.service.ts` → `scanNegativeMarginAccounts()` <br> `reconciliation.service.ts` → `checkNegativeMargin()` | `MarginCheckerModal.tsx` |
| **Thống kê số Lot giao dịch** | `FormMain.btnCountTradingLot_Click()` <br> `BackupService.LotStactics()` | `bot-job-queue.service.ts` → `handleRunLotMacroJob()` <br> `macro-lot.handler.ts` | `LotStatisticsPanel.tsx` <br> `CcpStatisticsModal.tsx` |
| **Thống kê Giá trị giao dịch** | `FormMain.btnCountTradingValue_Click()` <br> `BackupService.ValueStactics()` | `bot-job-queue.service.ts` → `handleRunValueMacroJob()` <br> `macro-value.handler.ts` | `ValueStatisticsPanel.tsx` <br> `TradingReportModal.tsx` |

---

### 3. TAB 3: "Cấu hình - Đường dẫn"

#### A. Phân rã giao diện từ ảnh:
* **Cấu hình tỷ giá**:
  - `Tỷ giá thanh toán`: Dropdown tiền tệ (`USD/VND`) | Ô `Bán` (26,100) | Ô `Mua` (26,100).
  - `Tỷ giá quy đổi`: Dropdown tiền tệ (`USD/VND`) | Ô giá trị (26,100).
* **Cấu hình phiên giao dịch**:
  - `Bắt đầu phiên`: `05:00`
  - `Kết thúc phiên`: `05:00`
* **Danh sách cấu hình đường dẫn thư mục**:
  1. `Đường dẫn check KLGD, TTM, TTTT giữa MS và QCG`: `...Check DSGD MS - CQG Desktop\Test Bot`
  2. `Đường dẫn kết quả check KLGD, TTM, TTTT giữa MS và QCG`: `...Check result`
  3. `Đường dẫn folder Dữ liệu đầu ngày MS`: `M:\Tailieuchung\RISK\Du lieu dau ngay MS`
  4. `Đường dẫn file nhập GTT`: `M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures`
  5. `Đường dẫn backup CQG`: `M:\Quanlygiaodich\Tai lieu hoat dong\Backup CQG\Test Bot`
  6. `Đường dẫn backup MS`: `M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Test Bot`
  7. `Đường dẫn backup ACM`: `M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\ACM`
  8. `Đường dẫn thống kê số lot giao dịch`: `M:\Quanlygiaodich\Tai lieu hoat dong\Thong ke so lot giao dich\Test Bot`
  9. `Đường dẫn thống kê giá trị giao dịch`: `M:\Quanlygiaodich\Tai lieu hoat dong\Thong ke gia tri giao dich\Test Bot`
  10. `Đường dẫn thống kê gửi team bản tin`: `M:\Quanlygiaodich\Tai lieu hoat dong\Thong ke gia tri giao dich\Gui team ban tin\Test Bot`
* **Danh sách đặc biệt**:
  - `Danh sách TKGD âm KQ`: Lưới chứa các mã tài khoản có số dư âm ký quỹ được cấu hình loại trừ/theo dõi (`003C157794...`, `007C0013134`, `007C0166025`, `036C0161994`, ...).
  - `Danh sách ngày nghỉ LME`: Bảng gồm 2 cột `Ngày gốc` và `Ngày thay thế` để quy đổi symbol hợp đồng LME.
* **Nút bấm**:
  - Nút lớn: `Lưu cấu hình`

#### B. Ma trận ánh xạ mã nguồn:
| Thành phần giao diện | C# Method (`operate-transaction-app`) | NestJS Backend Service / Handler | Next.js Frontend Component |
| :--- | :--- | :--- | :--- |
| **Lưu & Tải tỷ giá USD/VND** | `FormMain.btnSaveConfigs_Click()` <br> `ConfigService.SaveConfig()` | `system-settings.service.ts` <br> `reconciliation.service.ts` → `getCurrentUsdRate()` / `saveUsdRate()` | `SystemSchedulerSettings.tsx` <br> `ReconciliationPanel.tsx` |
| **Cấu hình giờ phiên** | `ConfigModel.SessionStartTime` | `system-settings.service.ts` → `sessionStartTime` | `SystemSchedulerSettings.tsx` |
| **Cấu hình đường dẫn thư mục**| `ConfigModel.CheckPath` | `system-settings.service.ts` → `folderPaths` <br> `bot-path.helper.ts` | `BackupAuditor.tsx` <br> `ConnectionSettings.tsx` |
| **Danh sách TKGD âm KQ** | `CheckPath.NagativeMarginAccs` | `system-settings.service.ts` → `excludedNegativeMarginAccounts` | `SystemSchedulerSettings.tsx` |
| **Danh sách ngày nghỉ LME** | `TransactionCheckingService.ConvertLMESymbol()` | `working-calendar.service.ts` → `isHoliday()`, `getLmeReplacementDate()` | `SystemSchedulerSettings.tsx` |

---

## III. CHECKLIST KIỂM THỬ TRỌNG TÂM (TEST VERIFICATION MATRIX)

Nhằm đảm bảo các tính năng chuyển đổi từ C# sang Web hoạt động 100% chính xác, bộ Checklist sau đây được áp dụng trước khi đưa vào vận hành:

### 1. Checklist Tab 1: Check GD - EOD - Sync
- [ ] **Test Case 1.1 (Check KLGD Trong Phiên)**:
  - Đưa file `DSGD` (MS) và cặp `FR1` + `FR2` (hoặc `FR.xlsx` đã gộp) + `Straits CSV` (ACM) vào hệ thống.
  - Nhấn `Check`.
  - *Kỳ vọng*: Bảng hiển thị tổng số lot MS, CQG, ACM, Nano. Nếu khớp thì hiển thị màu xanh lá; nếu lệch lot hoặc lệch lệnh, tab `Chi tiết giao dịch chênh lệch` liệt kê chính xác `Mã lệnh`, `Mã TKGD`, `Mã HĐ`, `Giá khớp`, `Khối lượng`.
- [ ] **Test Case 1.2 (Check DSGD trước EOD)**:
  - Chạy quét tài khoản trước giờ EOD.
  - *Kỳ vọng*: Phát hiện đúng danh sách tài khoản phát sinh âm ký quỹ mới chưa được phê duyệt, cảnh báo qua Telegram/Teams.
- [ ] **Test Case 1.3 (Chốt Đối Chiếu Pre-EOD)**:
  - Chạy đối chiếu cuối ngày với các file `DSGD`, `FR`, `TTM`, `OP`, `TTTT`, `PS`, `Straits CSV`.
  - *Kỳ vọng*: Tự động đối chiếu 3 bên, tính toán `TotalVolume`, đối chiếu vị thế ròng (`NetPosition`), khớp hoàn toàn trước khi cho phép đóng ca.
- [ ] **Test Case 1.4 (Đồng bộ số dư CQG)**:
  - Chạy kiểm tra số dư MS vs CQG Desktop.
  - *Kỳ vọng*: So sánh `Balance MS` vs `Balance CQG`, chỉ ra các tài khoản có chênh lệch số dư vượt ngưỡng cho phép.

### 2. Checklist Tab 2: Backup – Thống kê - GTT
- [ ] **Test Case 2.1 (Tải & Ghép nối File CQG Raw)**:
  - Kích hoạt tải hoặc quét file thô CQG (`FR1`, `FR2`, `PS1`, `PS2`, `OP1`, `OP2`, `OD1`, `OD2`).
  - *Kỳ vọng*: Backend tự động ghép file thành `FR.xlsx`, `PS.xlsx`, `OP.xlsx`, `Od.xlsx` đúng chuẩn cấu trúc header mà không cần nhân sự gộp tay.
- [ ] **Test Case 2.2 (Kiểm tra Giá Thanh Toán GTT)**:
  - Tải file `GTT MS` và dữ liệu `QSS Market CQG`.
  - Nhấn `Check GTT`.
  - *Kỳ vọng*: Bảng hiển thị so sánh `GTT MS` vs `GTT CQG`. Nếu có sai lệch giá, nút `Tạo file nhập` sinh ra file Excel hiệu chỉnh đúng định dạng để import ngược lại M-System.
- [ ] **Test Case 2.3 (Kiểm tra 4 Nhóm Ký Quỹ IMR)**:
  - Nạp dữ liệu `TTM`, `DSLCK`, `QLTKGD`.
  - Nhấn `Check Ký Quỹ`.
  - *Kỳ vọng*: Phân loại chính xác 4 cột:
    1. Tài khoản có lãi lỗ dự kiến nhưng không có TTM.
    2. Tài khoản không có TTM và không có lệnh chờ nhưng có KQTT.
    3. Tài khoản có TTM, không có lệnh chờ nhưng KQYCTT != KQYC.
    4. Tài khoản không có lệnh chờ nhưng KQKDTT != KQKD.
- [ ] **Test Case 2.4 (Thống kê Sản Lượng CCP - Lot & Value Macro)**:
  - Chọn ngày giao dịch và nhấn `Chạy thống kê`.
  - *Kỳ vọng*: Sinh đúng file thống kê số lot theo từng thành viên (Member) và mặt hàng (Commodity), tạo file báo cáo giá trị quy đổi USD/VND chuẩn xác.

### 3. Checklist Tab 3: Cấu hình & Tham số
- [ ] **Test Case 3.1 (Tỷ giá USD/VND & Giờ Phiên)**:
  - Cập nhật tỷ giá (Ví dụ: `26,100`) và lưu cấu hình.
  - *Kỳ vọng*: Toàn bộ các module đối chiếu quy đổi và báo cáo CCP tự động nhận tỷ giá mới nhất từ CSDL Mongo.
- [ ] **Test Case 3.2 (Danh sách loại trừ TKGD âm KQ)**:
  - Thêm tài khoản vào danh sách trắng/loại trừ.
  - *Kỳ vọng*: Module quét Pre-EOD không phát cảnh báo trùng lặp đối với các tài khoản này.
- [ ] **Test Case 3.3 (Quy đổi Symbol LME theo Lịch nghỉ lễ)**:
  - Kiểm tra hợp đồng LME vào các ngày nghỉ ngân hàng Anh (UK Bank Holidays).
  - *Kỳ vọng*: Hàm `ConvertLMESymbol` tự động dịch chuyển ngày prompt date sang ngày làm việc kế tiếp hợp lệ.

---

## IV. PHỤ LỤC: THAM SỐ CẤU HÌNH & MẪU DỮ LIỆU THỰC TẾ TỪ MONGODB (PRODUCTION SNAPSHOT)

Dữ liệu được trích xuất trực tiếp (chế độ Read-only) từ CSDL MongoDB của hệ thống để làm căn cứ đối soát:

### 1. Cấu hình Phiên & Tỷ giá thực tế (`system_settings`)
* **Tỷ giá thanh toán / quy đổi (`usd_exchange_rate`)**: `26,100` *(Khớp 100% với giá trị 26,100 hiển thị trên Tab 3 của ảnh)*.
* **Thời gian bắt đầu phiên (`session_start_time`)**: `05:00` *(Khớp 100% với cấu hình phiên giao dịch 05:00 trên Tab 3)*.
* **Đường dẫn Backup M-System (`bot_backup_path_ms`)**: `C:\Users\hiepth\Downloads\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures`
* **Đường dẫn Backup CQG (`bot_backup_path_cqg`)**: `C:\Users\hiepth\Downloads\Quanlygiaodich\Tai lieu hoat dong\Backup CQG\Futures`
* **File Macro Lot CCP (`bot_macro_lot_path`)**: `C:\POC\Macro thong ke so lot giao dich có ACM.xlsm`
* **File Macro Value CCP (`bot_macro_value_path`)**: `C:\...\marco\Thong ke gia tri giao dich có ACM\Macro thong ke gia tri giao dich có ACM.xlsm`

### 2. Cấu hình Lịch trình chạy Bot thực tế (`bot_scheduler_config`)
| Mã Job (`id`) | Tên tác vụ | Giờ kích hoạt | Trạng thái | Ghi chú nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| `RPA_DOWNLOAD_MS` | Tải báo cáo đối chiếu đầu ngày M-System | **04:30** | **BẬT (true)** | Khớp 100% với `Thời điểm backup: 04:30` trên Tab 2 (Tải 9 báo cáo trọng tâm: `NKTTHT`, `DSTKGD`, `QLTKGD`, `NR`, `DSGD`, `TTTT`...). |
| `DOWNLOAD_CAST` | Tải báo cáo CQG CAST Balances | **07:00** | **BẬT (true)** | Tải tự động số dư CAST phục vụ đối chiếu đầu ngày. |
| `AUTO_CHECK_SOD` | Đối chiếu số dư đầu ngày (SOD) | **07:05** | **BẬT (true)** | Tự động chạy ngay sau khi có file CAST lúc 07:00. |
| `CHECK_PRE_EOD` | Kiểm tra tiền EOD (Pre-EOD Check) | **16:30** | Tạm dừng (false)| Tác vụ chốt đối chiếu 3 bên cuối ngày phiên chiều. |
| `CHECK_EOD_MM` | Đối chiếu số liệu EOD & Market Maker | **18:00** | Tạm dừng (false)| Kiểm tra đối soát sau khi đóng phiên. |

### 3. Tập hợp các loại Job thực tế trong MongoDB (`bot_jobs.jobType`)
CSDL đang quản lý 14 loại Job chuẩn hóa tương ứng với các nút bấm trên giao diện:
1. `CHECK_KLGD`: Đối chiếu khối lượng giao dịch trong phiên (Nút `Check` hàng 1 Tab 1).
2. `CHECK_PRE_EOD`: Đối chiếu Pre-EOD 3 bên (Nút `Check` Khối 2 Tab 1).
3. `AUTO_CHECK_SOD`: Tự động đối chiếu số dư đầu ngày.
4. `RPA_DOWNLOAD_REPORTS`: Tải báo cáo M-System (Nút `Backup` MS Tab 2).
5. `DOWNLOAD_CQG_BACKUP`: Tải và ghép file CQG (Nút `Backup` CQG Tab 2).
6. `DOWNLOAD_CAST`: Tải số dư CAST CQG.
7. `FILE_AUDIT_MS`: Kiểm tra tính đầy đủ của thư mục file M-System.
8. `FILE_AUDIT_CQG`: Kiểm tra tính đầy đủ của thư mục file CQG.
9. `FILE_AUDIT_ACM`: Kiểm tra file Straits CSV từ ACM SFTP.
10. `RUN_LOT_MACRO`: Chạy thống kê sản lượng số lot (Nút `Chạy thống kê` số lot Tab 2).
11. `RUN_VALUE_MACRO`: Chạy thống kê giá trị giao dịch (Nút `Chạy thống kê` giá trị Tab 2).
12. `RUN_VALUE_TVKD_MACRO`: Chạy thống kê giá trị phân bổ theo từng TVKD.
13. `RUN_MACRO`: Tác vụ Macro tổng hợp.
14. `VERIFY_EMAIL_STATUS`: Xác thực trạng thái gửi thông báo email.

### 4. Mẫu Cấu trúc Kết quả Thực tế (Sample Real Payload - `CHECK_PRE_EOD`)
Trích xuất từ bản ghi thực tế đã hoàn tất trong collection `bot_jobs`:
```json
{
  "taskId": "ops_open_04_s4",
  "shiftLogId": "6a9af94ca4345c2026f1502e",
  "sessionDay": "2026-09-05",
  "result": {
    "passed": true,
    "isWaitingFiles": false,
    "sessionStart": "2026-09-03T22:00:00.000Z",
    "checkTime": "2026-09-04T22:00:00.000Z",
    "totals": {
      "totalDSGD": 12580,
      "totalFR": 12580,
      "totalACM": 420,
      "totalNano": 420,
      "differ": 0,
      "differACM": 0,
      "totalTTTT": 890,
      "totalPS": 890,
      "differTTTT": 0
    },
    "mismatchedTrades": [],
    "mismatchedPositions": [],
    "mismatchedTTM": [],
    "mismatchedTTTT": []
  }
}
```
*(Cấu trúc này khẳng định sự khớp nối hoàn hảo giữa thuật toán tính toán của Backend và hiển thị trên UI Frontend: khi các mảng `mismatched` rỗng và `differ == 0`, hệ thống cấp cờ `passed = true`)*.

---

## V. BÀI TOÁN KIỂM CHỨNG SONG SONG (SHADOW / PARALLEL RUN CONSOLE) & ĐÁNH GIÁ 5 ĐIỂM RỦI RO LỆCH CHUẨN

### 1. Bản chất & Mục tiêu của Màn hình Kiểm chứng Song song
* **Vấn đề cốt lõi**: Trong giai đoạn chuyển đổi từ Tool C# (`operate-transaction-app`) sang Bot ngầm NestJS trên Ubuntu, việc thay thế đột ngột tiềm ẩn rủi ro rất cao đối với giao dịch tài chính nếu Bot ngầm tính toán lệch dù chỉ 1 lot.
* **Mục tiêu**: Màn hình này **không phải là trang nghiệp vụ thông thường**, mà đóng vai trò là **Trọng tài kiểm chứng song song (Shadow/Parallel Verification Console)**:
  - Cho phép người trực ca hoặc IT quan sát đồng thời kết quả của **Tool C# (Ground Truth)** và **Bot NestJS (Shadow Bot)** trên cùng một giao diện.
  - Tự động so khớp độ lệch (Delta = `Số C#` - `Số Bot`), hiển thị trạng thái `MATCH (Khớp 100%)` hoặc `DIVERGED (Lệch)` tức thì.
  - Cung cấp công cụ Replay / Dry-run độc lập: Cho phép kéo thả trực tiếp chính bộ file mà Tool C# vừa xử lý để Bot Backend tính toán lại ngay, loại bỏ độ lệch do thời gian trễ.

### 2. 5 Điểm Rủi Ro Lệch Chuẩn (Divergence Risks) Cần Kiểm Soát Tuyệt Đối
| STT | Điểm rủi ro lệch chuẩn | Bản chất kỹ thuật gây lỗi | Cơ chế phòng ngừa & Kiểm soát |
| :---: | :--- | :--- | :--- |
| **1** | **Ghép nối file thô CQG (`FR1`+`FR2`, `PS1`+`PS2`)** | Tool C# ghép file qua thư viện Windows, loại bỏ header trùng lặp. Node.js `exceljs` nếu xử lý cột rỗng ẩn, khoảng trắng tài khoản hoặc định dạng Date serial không chuẩn sẽ sinh ra `CombinedKey` lệch. | So khớp song song **Tổng số dòng (Row Count)** và **Tổng Lot** trước/sau khi ghép nối. |
| **2** | **Đọc File Straits CSV (ACM)** | Khác biệt về mã hóa (Windows ANSI / UTF-8 with BOM) và ký tự phân cách (Dấu phẩy `,` vs Tab `\t`). Nếu Bot Ubuntu nhận diện sai cột sẽ làm lệch tổng lot ACM và tài khoản Nano. | Chuẩn hóa parser tự động phát hiện delimiter và encoding `utf-8-sig`. So khớp cột `DifferACM`. |
| **3** | **Quy đổi Hợp đồng LME & Lịch Nghỉ Lễ** | Hợp đồng LME có ngày prompt date thay đổi vào các ngày nghỉ ngân hàng Anh (UK Bank Holidays). Nếu bảng `working_calendars` thiếu ngày nghỉ, Bot ngầm sẽ ghép sai symbol $\rightarrow$ Báo lệch TTM ảo. | Bổ sung widget kiểm tra bảng mapping mã LME đã quy đổi để đối soát chéo với C#. |
| **4** | **Phân loại 4 nhóm ký quỹ IMR (`QLTKGD`)** | Tool C# đọc theo chỉ số Index cột cố định (0, 1, 2, 3, 4, 5, 6). Báo cáo M-System khi xuất ra có thể chèn thêm cột ẩn khiến logic đọc theo index bị lệch hoàn toàn sang cột khác. | **Bắt buộc dùng Header Matching** (tìm cột theo tên: *Ký quỹ tạm tính*, *Ký quỹ yêu cầu*, *Ký quỹ khả dụng*) thay vì dùng index số. |
| **5** | **Thời điểm chốt dữ liệu (Snapshot Timing Drift)** | Tool C# bấm `Check` lúc 14:02:15 nhưng Bot ngầm chạy Cron lúc 14:00:00. Hai bên chênh nhau 2 phút phát sinh thêm các lệnh khớp mới trên M-System $\rightarrow$ Lệch số lot giả tạo. | Ghi nhận **Timestamp chính xác đến từng giây** của bộ file đầu vào trên giao diện để so sánh cùng một mốc snapshot. |

### 3. Thiết Kế Bố Cục Màn Hình Kiểm Chứng Song Song (3 Tầng Tác Nghiệp)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   MÀN HÌNH KIỂM CHỨNG SONG SONG (SHADOW CONSOLE UI)                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [TẦNG 1] BẢNG ĐỐI SOÁT CHÉO THỜI GIAN THỰC (LIVE DUAL-RUN COMPARISON):                │
│  • Tổng KLGD MS    : [ Tool C#: 12,580 ]  [ Bot: 12,580 ]  -> Delta: 0 ( MATCH)      │
│  • Tổng KLGD CQG   : [ Tool C#: 12,580 ]  [ Bot: 12,580 ]  -> Delta: 0 ( MATCH)      │
│  • Tổng KLGD ACM   : [ Tool C#:    420 ]  [ Bot:    420 ]  -> Delta: 0 ( MATCH)      │
│  • Số TK âm IMR    : [ Tool C#:      2 ]  [ Bot:      2 ]  -> Delta: 0 ( MATCH)      │
│  • Giá thanh toán  : [ Tool C#:     48 ]  [ Bot:     48 ]  -> Delta: 0 ( MATCH)      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [TẦNG 2] 4 KHỐI CHI TIẾT TƯƠNG ỨNG TAB 1 C# (DRILL-DOWN & ON-DEMAND CHECK):           │
│  • Khối 1: Ma trận 4 bên (KLGD/TTM/TTTT) + Bảng lệnh lệch (Mã lệnh, HĐ, Giá, KL...)    │
│  • Khối 2: Quét TKGD âm KQ mới trước EOD (So khớp danh sách tài khoản)                │
│  • Khối 3: Kết quả chạy EOD / Pre-EOD (Đối chiếu vị thế ròng NetPosition)             │
│  • Khối 4: Đồng bộ số dư CQG (Balance MS vs Balance CQG)                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [TẦNG 3] CÔNG CỤ TÁI HIỆN & ĐỐI SOÁT ĐỘC LẬP (REPLAY & DRY-RUN TOOL):                  │
│  • Kéo thả cùng bộ file Tool C# vừa xử lý -> Kích hoạt Bot NestJS tính toán tức thì.  │
│  • Tự động chỉ điểm dòng Excel/mã tài khoản gây lệch nếu kết quả khác nhau.          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## VI. ĐỀ XUẤT NÂNG CẤP: KIẾN TRÚC LAI PYTHON DATA ENGINE (HYBRID ARCHITECTURE)

### 1. Bài Học Thành Công Từ Phân Hệ TKGD Automation
* Phân hệ **TKGD Automation** đã áp dụng cực kỳ hiệu quả mô hình lai:
  - **NestJS**: Đóng vai trò Orchestrator (API Gateway, WebSocket tiến trình, quản lý MongoDB, RBAC, Web UI).
  - **Python Worker (`tkgd_extractor_worker.py`)**: Đóng vai trò Data Engine chuyên trách (xử lý ảnh CCCD, MRZ đa vùng, OCR, PDF trích xuất).
* **Kết quả**: Xử lý hàng nghìn hồ sơ trong vài phút, không bao giờ bị nghẽn Event Loop hay rò rỉ RAM trên Node.js.

### 2. So Sánh: Node.js (`exceljs`) vs Python (`pandas` / `openpyxl`)
| Tiêu chí | Node.js Hiện Tại (`reconciliation.service.ts`) | Đề Xuất: Python Worker (`recon_data_worker.py`) |
| :--- | :--- | :--- |
| **Độ dài code** | Hơn 3,900 dòng code TypeScript duyệt mảng thủ công. | Khoảng 350 dòng code Python tận dụng sức mạnh thư viện. |
| **Ghép file thô** | Duyệt từng ô `row.getCell()`, ghép mảng dễ lệch cột. | `pd.concat([df1, df2])` tự động căn chỉnh theo tên cột. |
| **Đọc CSV** | Dễ lỗi Encoding Windows ANSI / UTF-8 with BOM. | `pd.read_csv(encoding='utf-8-sig', sep=None)` nhận diện tự động. |
| **Group by & Pivot** | Vòng lặp `Map<string, any>` lồng nhau dễ sai dấu âm/dương. | `df.groupby(['Account', 'Symbol'])['Qty'].sum()` chuẩn toán học. |
| **Tiêu thụ RAM** | Giữ toàn bộ cây Workbook trong heap Node.js $\rightarrow$ Dễ crash PM2. | Xử lý theo Stream C-Extension, giải phóng RAM ngay sau khi chạy. |

### 3. Phân Định Vai Trò Trong Kiến Trúc Lai Đối Soát
```
   [ FRONTEND: Shadow Console UI ]
                 ▲
                 │ REST / WebSockets
                 ▼
   [ BACKEND: NestJS Orchestrator ]
     • Quản lý Ca trực & Checklist
     • Quản lý Cron Scheduler & MongoDB
     • Dispatch Job & Nhận JSON kết quả
                 ▲
                 │ Child Process (JSON IPC Bridge)
                 ▼
   [ DATA ENGINE: recon_data_worker.py ]
     • Nhận: File paths + Check type
     • Xử lý: Ghép file, lọc Nano, GroupBy ma trận 4 bên, quét 4 nhóm IMR
     • Xuất: Chuỗi JSON kết quả chuẩn hóa { totals, mismatches, imrRisks }
```

### 4. Lộ Trình Triển Khai Thực Chiến (4 Bước An Toàn)
1. **Bước 1 (Frontend)**: Xây dựng màn hình **Shadow Console UI** (Tầng 1 + Tầng 2) hiển thị dữ liệu đối chiếu hiện tại để cán bộ trực ca quan sát ngay kết quả song song.
2. **Bước 2 (Python Engine)**: Xây dựng file `recon_data_worker.py` và helper bridge kết nối từ NestJS.
3. **Bước 3 (Thẩm định 3 bên)**: Chạy đối chiếu chéo đồng thời giữa **Tool C# Prod** $\leftrightarrow$ **NestJS cũ** $\leftrightarrow$ **Python Engine mới**.
4. **Bước 4 (Cắt chuyển)**: Khi kết quả Python Engine đạt ` MATCH 100%` liên tục qua các ca trực, chính thức chuyển giao toàn bộ tác vụ đối soát ngầm cho Python Engine và đưa Tool C# vào trạng thái dự phòng.

---

## VII. CHIẾN LƯỢC THAY THẾ HOÀN TOÀN TOOL C# & KHUNG KIỂM SOÁT CHẤT LƯỢNG (QUALITY GATES)

### 1. Tuyên Ngôn Mục Tiêu & Nguyên Tắc Vận Hành
* **Mục tiêu tối thượng**: Hệ thống Web mới (NestJS Backend + Next.js Frontend + Python Data Engine) **bắt buộc phải thay thế hoàn toàn Tool C# Desktop trong tương lai**, giải phóng cán bộ trực ca khỏi việc thao tác thủ công trên máy trạm Windows.
* **Nguyên tắc chất lượng (Zero-Defect Tolerance)**: Trong nghiệp vụ sàn giao dịch hàng hóa, sai lệch 1 số lot hay 1 hợp đồng vị thế ròng đều ảnh hưởng trực tiếp đến tiền ký quỹ và tính toàn vẹn của thị trường. Logic đằng sau cỗ máy mới phải chuẩn xác tuyệt đối trên 100% các tình huống biên (Edge Cases).

### 2. 4 Trụ Cột Kỹ Thuật Đảm Bảo Tính Đúng Đắn Của Logic
1. **Chuẩn Hóa Số Học Chính Xác Cao (Precision Engine)**:
   - Nghiêm cấm dùng số thực dấu phẩy động (`float` / `Number`) cho các phép tính số lot, giá và ký quỹ. Bắt buộc dùng kiểu dữ liệu số học chính xác cao (**Python `Decimal`** hoặc **`BigNumber`**), khớp chuẩn mực `decimal` của C#.
   - Chuẩn hóa chữ hoa/chữ thường và cắt sạch khoảng trắng (`trim()`) cho các mã định danh (`Mã TKGD`, `Mã Hợp Đồng`, `Mã Lệnh`).
2. **Bộ Kiểm Thử Đối Chiếu Ngược Lịch Sử (Golden Test Datasets)**:
   - Thu thập 10 bộ dữ liệu file thô thực tế từ các phiên giao dịch lịch sử đã được Tool C# chạy và chốt ca thành công (bao gồm phiên bình thường, phiên có lệnh Spread, phiên có hợp đồng LME và phiên cuối tuần).
   - Thiết lập bài test hồi quy tự động: Kết quả tính toán của cỗ máy mới phải so khớp 1-1 với số liệu C# lịch sử với độ lệch:
     $$\Delta = |\text{Kết quả Mới} - \text{Kết quả C\#}| = 0$$
3. **Cơ Chế Chốt An Toàn (Fail-Safe) & Cảnh Báo Chủ Động**:
   - Khi thiếu bất kỳ file nào trong cặp file thô (chỉ có `FR1` thiếu `FR2`, hoặc chưa có file `Straits.csv`): Hệ thống giữ trạng thái `IS_WAITING_FILES`, ghi log rõ file thiếu, tuyệt đối không tính toán trên tập dữ liệu khuyết.
   - Khi cấu trúc cột trong file M-System (`QLTKGD`, `DSGD`) bị thay đổi: Phát cảnh báo `SCHEMA_MISMATCH`, yêu cầu xác nhận trước khi tiếp tục, tuyệt đối không đọc bừa theo vị trí cột.
4. **Tiêu Chuẩn Thẩm Định 14 Ngày (14-Day Zero-Delta Gate)**:
   - Trước khi chính thức tắt bỏ Tool C#, hệ thống Web mới phải trải qua giai đoạn chạy song song có giám sát trong tối thiểu **14 ngày làm việc liên tiếp** với kết quả đối soát luôn đạt ` MATCH 100%` (Delta = 0 trên tất cả các ca trực).

### 3. Đặc Tả Giao Diện Bàn Giao Tác Nghiệp (Trading Operation Console UI Specification)
Màn hình Web mới sẽ kế thừa trọn vẹn sức mạnh của Tool C# nhưng được tối ưu hóa giao diện phẳng, hiện đại:
* **Thanh Trạng Thái Hệ Thống (Status Bar)**:
  - Hiển thị ngày phiên hiện tại, giờ máy chủ chính xác đến từng giây, trạng thái Bot ngầm (Online/Offline) và chu kỳ quét tự động (mỗi 60 phút).
* **Khối 1: Ma Trận Đối Chiếu Trong Phiên (4-Way Matrix)**:
  - Bảng tổng hợp số lot theo 3 dòng (`KLGD`, `TTM`, `TTTT`) và 4 cột nguồn dữ liệu (`M-System`, `CQG`, `ACM`, `Nano`).
  - Cột `Độ lệch (Delta)` và `Trạng thái` nổi bật (Xanh: Khớp 100%, Đỏ: Lệch số liệu).
  - Bảng Drilldown (Tabs): Xem chi tiết từng lệnh lệch và vị thế net lệch kèm đầy đủ thông tin (Mã lệnh, TKGD, Mã HĐ, Giá, Khối lượng, Thời gian).
* **Khối 2: Kiểm Tra Trước EOD & Rủi Ro Ký Quỹ (Risk Scan)**:
  - Danh sách tài khoản phát sinh âm ký quỹ ban đầu mới (`IMR < 0`).
  - Bảng phân loại 4 nhóm rủi ro ký quỹ IMR (đối soát chéo giữa `TTM`, `DSLCK` và `QLTKGD`).
* **Khối 3: Kết Quả Đóng Phiên EOD & Đồng Bộ Số Dư CQG**:
  - Báo cáo kết quả Pre-EOD 3 bên cuối ngày (`Passed / Failed`, `TotalVolume`, vị thế ròng).
  - Bảng đối soát số dư tiền giữa báo cáo CAST CQG và QLTKGD M-System.

### 4. Quy Trình Xử Lý Khi Phát Hiện Sai Lệch (Discrepancy Resolution Protocol)
Khi phát hiện `Delta != 0` giữa Tool C# và Bot ngầm trong giai đoạn chạy song song:
1. **Bước 1 (Kiểm tra Timestamp)**: Xác minh xem 2 bên có đang đọc cùng một snapshot file tại cùng thời điểm hay không.
2. **Bước 2 (Chạy Replay Dry-Run)**: Kéo thả chính bộ file mà C# vừa xử lý vào công cụ Dry-run trên Web để loại trừ nguyên nhân chênh lệch thời gian lấy file.
3. **Bước 3 (Chỉ điểm nguồn gốc lệch - Root Cause Analysis)**:
   - Nếu lệch do file thô chưa được ghép đủ (`FR1` + `FR2`) $\rightarrow$ Kiểm tra dịch vụ ghép file tự động.
   - Nếu lệch do mã hợp đồng LME $\rightarrow$ Kiểm tra bảng lịch nghỉ lễ `working_calendars`.
   - Nếu lệch do bóc tách Nano $\rightarrow$ Kiểm tra parser `Straits.csv`.
4. **Bước 4 (Hiệu chỉnh & Ghi vết)**: Cập nhật thuật toán, ghi rõ nguyên nhân vào `CHANGELOG_AI.md` và chạy lại bộ Golden Test để bảo đảm không tái diễn lỗi.

---

## VIII. CƠ CHẾ VẬN HÀNH TỰ ĐỘNG ĐỊNH KỲ 60 PHÚT & QUY TRÌNH CAN THIỆP THỦ CÔNG DÀNH CHO MAKER

### 1. Kiến Trúc Vận Hành Tự Động Định Kỳ (60 Phút / Lần)
Tác vụ đối chiếu giao dịch trong phiên (`TASK_CHECK_KLGD_s1`) được thiết kế chạy hoàn toàn tự động theo chu kỳ khép kín:

```
[Cron Bot Engine (Mỗi 1 phút)]
       │
       ▼
[Pass 1: Quét thời gian stale]
   • Kiểm tra task [TASK_CHECK_KLGD_s1]
   • Nếu task đã xong (PASSED / NEEDS_ATTENTION) & diffMin >= frequencyMinutesSnapshot (60 phút)
   • Tự động reset trạng thái task về 'PENDING'
       │
       ▼
[Pass 2: Enqueue Job]
   • Bot Job Queue tiếp nhận job 'CHECK_KLGD'
   • recon-jobs.handler kích hoạt reconciliationService.runAutoCheckKLGD()
   • Quét thư mục Backup ngày YYYY/TMM.YYYY/DD.MM
   • Lọc lệnh phát sinh từ session_start_time (05:00 sáng) đến hiện tại
       │
       ▼
[Cập Nhật & Lưu Trữ]
   • Lưu kết quả chi tiết { totals, mismatchedTrades, mismatchedTTM } vào MongoDB bot_jobs
   • Cập nhật trạng thái task trong ShiftLog (PASSED nếu differ = 0, NEEDS_ATTENTION nếu có lệch)
   • Bắt đầu đếm chu kỳ 60 phút tiếp theo
```

### 2. Quy Trình Maker Can Thiệp Thủ Công & Cơ Chế "Phá Vỡ Cooldown" (Bypass Cooldown)
Hệ thống cho phép Maker chủ động can thiệp bất kỳ lúc nào mà **không bao giờ bị ép buộc phải chờ đủ 60 phút**:

1. **Thao tác trên giao diện Checklist**:
   - Tại dòng task con `TASK_CHECK_KLGD_s1`, Maker click vào biểu tượng mũi tên xổ xuống (`ChevronDown` - *"Can thiệp / Đổi trạng thái thủ công"*).
   - Chọn chuyển trạng thái về **🔘 Chưa thực hiện (`PENDING`)**.
2. **Logic Backend xử lý tự động (Bypass Cooldown)**:
   - Trong `bot-engine.service.ts` (hàm `shouldEnqueueNewJob`), hệ thống so sánh:
     $$\text{taskResetTime} = \max(\text{task.startedAt}, \text{task.updatedAt}) > \text{lastJobTime}$$
   - Nhận diện Maker vừa can thiệp chủ động, Bot Engine **lập tức bỏ qua thời gian chờ 60 phút** và kích hoạt Job đối chiếu mới ngay trong lượt quét kế tiếp.
3. **Nút 1-Chạm trên Trading Operation Console (`[🔄 Chạy lại ngay / Re-run]`)**:
   - Trên giao diện Trading Operation Console mới, Maker chỉ cần bấm nút **"Chạy lại ngay"**.
   - Frontend tự động gọi API reset task về `PENDING`, kích hoạt Bot chạy lại tức thì để kiểm chứng ngay các file vừa tải bổ sung.

### 3. Đánh Giá Khả Thi & Mức Độ Khó Của Python Data Worker (`recon_data_worker.py`)
* **Mức độ khó đối với Backend**: **2/10 (Rất Thấp)**.
  - Backend NestJS đã có sẵn Design Pattern gọi Python qua `child_process.spawnSync` / `execFileAsync` và chạy ổn định tại 2 module: `lot-statistics` (`excel-sheet-cloner.helper.ts`) và `tkgd-automation` (`tkgd-python-bridge.helper.ts`).
  - Server Ubuntu VM (`10.0.0.26`) đã có sẵn Python 3, `pandas`, `openpyxl`.
  - Backend NestJS chỉ đóng vai trò Orchestrator (truyền JSON file path $\rightarrow$ nhận JSON kết quả), không cần thay đổi logic nghiệp vụ hay CSDL MongoDB.
* **Hiệu quả xử lý 4 Case Rủi Ro bằng Python**:
  1. *Ghép file thô CQG (`FR1+FR2`, `PS1+PS2`...)*: `pd.concat([df1, df2])` chạy dưới 0.5 giây, RAM < 50MB (triệt tiêu nguy cơ Out-Of-Memory của Node.js).
  2. *Đọc file Straits CSV (ACM)*: `pd.read_csv(sep=None, encoding='utf-8-sig')` tự động nhận diện dấu phẩy/chấm phẩy và gọt sạch BOM header.
  3. *Lệch vị trí cột trong IMR / TTM*: Sử dụng Header Column Matching thay vì Index số cột $\rightarrow$ Miễn nhiễm khi M-System đổi thứ tự cột.
  4. *Lọc Hợp đồng LME*: Lọc qua danh sách `working_calendars` chỉ với 1 dòng query Pandas.
* **3 Quy Tắc Kỹ Thuật Bắt Buộc Khi Viết Python Worker**:
  - **Stdout Clean**: Toàn bộ log debug/progress phải đẩy ra `sys.stderr`. Duy nhất dòng kết quả JSON cuối cùng được xuất ra `sys.stdout` để Node.js `JSON.parse()` an toàn 100%.
  - **Timeout Execution**: Thiết lập timeout 60 giây trong `spawnSync` để chống treo process nếu file bị khóa mạng CIFS.
  - **Cross-Platform**: Tự động nhận diện lệnh thực thi (`python` trên Windows, `python3` trên Ubuntu).
