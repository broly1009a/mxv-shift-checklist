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

