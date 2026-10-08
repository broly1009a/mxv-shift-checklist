# TÀI LIỆU THIẾT KẾ CHUYỂN ĐỔI SONG SONG & BÓC TÁCH COMPONENT TRADING MANAGER
## KIẾN TRÚC "PARALLEL RUN" BẢO TOÀN MÃ NGUỒN & HƯỚNG DẪN TẠO MÀN HÌNH ĐỘC LẬP (UX/UI)

---

## I. NGUYÊN TẮC CỐT LÕI: CHIẾN LƯỢC CHUYỂN ĐỔI SONG SONG (PARALLEL RUN)

### 1. Triết lý "Bảo toàn thực tế - Không gián đoạn ca trực"
Hệ thống **Trading Manager** hiện tại đang là công cụ tác nghiệp hàng ngày của các ca trực vận hành Sở Giao Dịch Hàng Hóa Việt Nam (MXV). Mọi rủi ro gián đoạn, lỗi giao diện hay treo tiến trình đều ảnh hưởng trực tiếp đến nghiệp vụ giám sát thị trường.

Do đó, quá trình chuyển đổi bắt buộc tuân thủ nguyên tắc **Strangler Fig / Parallel Run**:
1. **Bảo tồn 100% trang hiện tại (`/trading-manager`)**:
   - Giữ nguyên toàn bộ cấu trúc file, component, routes và state của trang `/trading-manager`.
   - Nhân viên ca trực vẫn sử dụng bình thường như một kênh vận hành chính hoặc kênh dự phòng (Fallback) đáng tin cậy.
2. **Khởi tạo các Route trang mới độc lập**:
   - Xây dựng các trang mới trên Next.js App Router (`/operations/...`, `/vnclear/...`, `/monitoring/...`).
   - "Bốc" (Import & Re-export) các component nghiệp vụ đã được module hóa sẵn sang trang mới, mở rộng không gian hiển thị (Full Width/Height), tối ưu hóa thẩm mỹ mà **không phải viết lại logic xử lý hay gọi lại API backend khác đi**.
3. **Cơ chế đối chiếu song song 1:1 cho Người dùng duyệt**:
   - Người dùng (Operator, Team Lead, Admin) có thể mở song song 2 màn hình trên 2 tab trình duyệt để so sánh:
     - *Tab 1: Màn hình cũ (`/trading-manager`)*
     - *Tab 2: Màn hình mới (ví dụ `/operations/reconciliation`)*
   - Khi chạy đối soát, số liệu ma trận, số lệnh lệch và trạng thái Job giữa 2 bên phải đồng nhất 100%. Khi người dùng hoàn toàn hài lòng về UX/UI mới, hệ thống mới chính thức chuyển đổi hoàn toàn.

---

## II. MA TRẬN 5 PHÂN HỆ MỚI & BẢN ĐỒ TÁCH ROUTE

```
BẢN ĐỒ 5 MÀN HÌNH ĐỘC LẬP ĐƯỢC BÓC TÁCH
├── 1. MÀN HÌNH ĐỐI SOÁT GIAO DỊCH (INTRADAY & PRE-EOD)
│   ├── Route mới: /operations/reconciliation
│   ├── Component cốt lõi: LegacyReconSection.tsx + LegacyPreEodDiffSection.tsx
│   └── Đối tượng: Nhân viên ca trực giám sát khớp lệnh, TTM, TTTT và chốt Pre-EOD
│
├── 2. MÀN HÌNH CHECK & CHẠY EOD (EOD OPERATIONS)
│   ├── Route mới: /operations/eod-settlement
│   ├── Component cốt lõi: LegacyCheckEodSection.tsx (Tách từ Recon + Backup)
│   └── Đối tượng: Trưởng ca chốt phiên cuối ngày, kiểm tra số dư EOD, âm KQ, IMR, CQG Sync
│
├── 3. MÀN HÌNH BÁO CÁO BACKUP, MACRO & GTT
│   ├── Route mới: /data/operations-reports
│   ├── Component cốt lõi: LegacyBackupThongKeSection.tsx + LegacyGttCheckerSection.tsx + CeAcmBackupSection.tsx
│   └── Đối tượng: Chuyên viên dữ liệu chạy Macro số lô/giá trị, audit file backup MS/CQG và đối soát GTT
│
├── 4. PHÂN HỆ VNCLEAR (CORECCP & COREEX)
│   ├── Route mới: /vnclear/clearing-hub
│   ├── Component cốt lõi: CoreCcpBackupSection.tsx + CcpLotStatisticsSection.tsx
│   └── Đối tượng: Chuyên viên Bù trừ Thanh toán VNCLEAR (25 báo cáo, đối soát EOD, thống kê Lot/GTGD)
│
├── 5. TRUNG TÂM GIÁM SÁT ROBOT & LOGS (ĐƯA RA SIDEBAR)
│   ├── Route mới: /monitoring/bot-jobs
│   ├── Component cốt lõi: TradingManagerJobQueueSection.tsx + Terminal Stream Logs
│   └── Đối tượng: Toàn bộ nhân viên & IT giám sát tiến trình Playwright, can thiệp Hủy/Retry
│
└── 6. CẤU HÌNH TỶ GIÁ & ĐƯỜNG DẪN HẠ TẦNG (ADMIN ONLY)
    ├── Route mới: /admin/trading-settings
    ├── Component cốt lõi: MsConfigSection.tsx + OmsConfigSection.tsx + SmartPathInput.tsx
    └── Đối tượng: Quản trị viên IT (Phân quyền RBAC nghiêm ngặt: MANAGE_SYSTEM_SETTINGS)
```

---

## III. TỔNG HỢP CHI TIẾT TỪNG COMPONENT ĐỂ BÓC TÁCH SANG TRANG MỚI

### 1. Phân hệ Đối Soát Giao Dịch (`/operations/reconciliation`)

#### Component `LegacyReconSection.tsx`
- **Đường dẫn hiện tại**: [frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx)
- **Props cần truyền vào**:
  ```typescript
  interface StandaloneReconProps {
    token: string | null;
    selectedDate: string;
    onSelectDate?: (date: string) => void;
    onStatusChange?: (status: { isDiffer: boolean; totalDifferLots: number; klgdStatus: string }) => void;
  }
  ```
- **Chức năng nghiệp vụ chi tiết**:
  1. **Ma trận đối soát 3 dòng x 4 cột**:
     - Dòng 1: `KLGD` (M-System vs CQG vs ACM Straits vs Nano vs Differ).
     - Dòng 2: `TTM` (Trạng thái mở MS vs CQG vs Differ).
     - Dòng 3: `TTTT` (Trạng thái tất toán MS vs CQG vs Differ).
  2. **Bộ điều khiển trung tâm (Header Controls)**:
     - Master Switch: Tự động đối chiếu trong ca (`bot_auto_recon_enabled`).
     - Chu kỳ chạy tự động: 15 phút, 30 phút, 60 phút kèm đồng hồ đếm ngược.
     - Nút `[▶ Check thủ công]` và nút `[🛑 Dừng khẩn cấp Bot]`.
     - Phân trang lịch sử các lượt chạy cũ (`selectedRunJobId`).
  3. **Box Chi tiết giao dịch chênh lệch**:
     - Hiển thị danh sách các lệnh bị lệch giữa M-System và CQG.
     - Bóc tách chi tiết: Mã lệnh, Mã TK, Hợp đồng, Giá khớp, Khối lượng, Thời gian, Nguồn thừa/thiếu, Lý do lệch.
- **Cải tiến UX/UI khi đưa sang trang mới**:
  - Đổi màu số liệu mặc định sang **100% màu trắng (`#ffffff`)**, chỉ bôi đỏ cảnh báo (`#ef4444`) khi phát hiện ô có độ lệch (`differ > 0`).
  - Mở rộng Box "Chi tiết chênh lệch" lên chiều cao toàn màn hình (`min-height: 480px` hoặc `calc(100vh - 420px)`), nhân viên không còn phải cuộn chuột trong khung nhỏ 220px.
  - Xóa bỏ các nút bấm thừa: Nút `Hôm nay`, nút `Check`, nút `Âm báo` (không ổn định). Đưa Switch Tự động lên đặt cạnh ô nhập chu kỳ phút.
- **API Backend được gọi**:
  - `GET /api/v1/reconciliation/console-summary?date={date}`
  - `POST /api/v1/reconciliation/trigger-console-run`
  - `POST /api/v1/bot-engine/jobs/{id}/cancel`
  - `POST /api/v1/system-settings` (Lưu trạng thái Master Switch)

---

### 2. Phân hệ Check & Chạy EOD (`/operations/eod-settlement`)

#### Component `LegacyCheckEodSection.tsx` *(Tách từ Recon & Backup)*
- **Bao gồm các component con**:
  1. `LegacyPreEodDiffSection.tsx`: Đối chiếu Pre-EOD 3 bên (Khớp lệnh `DSGD vs FR`, Tự doanh `DSGD vs Straits`, và Vị thế Net Position `TTTT vs PS`).
  2. `CheckDsgdBeforeEodModal.tsx` *(Mới)*: Kiểm tra nhanh phát sinh lệnh DSGD trước giờ EOD (API `check-dsgd-before-eod`).
  3. Khung quét **Tài khoản âm ký quỹ mới** và **Kết quả chạy EOD** (QLTKGD vs eod.csv theo tỷ giá).
  4. Khung **Đồng bộ số dư CQG (CQG Sync)**: Lọc các tài khoản chênh lệch tiền mặt $> $100.
  5. Khung **Kiểm tra Ký quỹ TKGD (IMR 4 nhóm cảnh báo)**:
     - Nhóm 1: Có lãi lỗ dự kiến nhưng không có TTM.
     - Nhóm 2: Không có TTM nhưng có KQYC.
     - Nhóm 3: KQYCTT <> KQYC.
     - Nhóm 4: KQKDTT <> KQKD.
- **Cải tiến UX/UI khi đưa sang trang mới**:
  - Thiết kế dạng quy trình chốt phiên theo các bước tuần tự (Step-by-step EOD Wizard):
    - *Bước 1: Chạy Pre-EOD 3 bên & Check DSGD snapshot*.
    - *Bước 2: Tải file EOD từ mail Outlook và đối chiếu số dư*.
    - *Bước 3: Quét ký quỹ âm & Đối soát đồng bộ số dư CQG*.
    - *Bước 4: Xác nhận hoàn tất chốt ngày và ghi chú vào Checklist ca trực*.
- **API Backend được gọi**:
  - `POST /api/v1/reconciliation/upload-pre-eod`
  - `POST /api/v1/reconciliation/check-dsgd-before-eod`
  - `POST /api/v1/reconciliation/upload-eod`
  - `POST /api/v1/reconciliation/negative-margin`
  - `POST /api/v1/reconciliation/check-imr`
  - `POST /api/v1/bot-engine/fetch-eod-email`

---

### 3. Phân hệ Báo Cáo Vận Hành, Macro & GTT (`/data/operations-reports`)

#### Component `LegacyBackupThongKeSection.tsx` & Các Phân Hệ Con
- **Đường dẫn hiện tại**: [frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx)
- **Bao gồm các khối chức năng con**:
  1. **Ma trận Báo cáo M-System (14 file)**:
     - `NKTTHT`, `DSTKGD-Futures`, `DSTKGD-Spread`, `DSTKGD-LME`, `DSTKGD-ACM`, `TLKQHSKQ`, `DSTrader`, `DSLDK`, `DSLCK`, `DSLH`, `DSLK`, `DSGD`, `TTM`, `TTTT`.
     - Kiểm tra trạng thái tồn tại thực tế trên ổ đĩa, nút tải riêng từng file qua Bot RPA.
  2. **Ma trận Báo cáo CQG (4 file)**:
     - `FR`, `PS`, `OP`, `OD`. Tự động nhận diện và ghép các cặp file thô tài khoản 1 và 2 (`FR1+FR2`).
  3. **Bộ công cụ Macro Thống Kê**:
     - Chạy Macro Số Lô (`RUN_LOT_MACRO`) cho MXV & TVKD.
     - Chạy Macro Giá Trị Giao Dịch (`RUN_VALUE_MACRO`) quy đổi VND.
     - Bộ chọn ngày chạy lại Macro (`Session Date Picker`) để chạy lại số liệu ngày cũ trong thư mục backup.
  4. **Component Kiểm Tra Giá Thanh Toán GTT (`LegacyGttCheckerSection.tsx`)**:
     - Upload và đối soát giá GTT M-System vs GTT Thị trường quốc tế CME/ICE.
     - Bảng chi tiết hợp đồng lệch giá $> 0.001$. Nút xuất file Excel điều chỉnh giá để import vào M-System.
  5. **Component Báo Cáo Sàn CE & ACM SFTP (`CeAcmBackupSection.tsx`)**:
     - Quản lý tải và kiểm tra báo cáo sàn CoreEX (CE) và file CSV từ SFTP của Straits (ACM).
- **Cải tiến UX/UI khi đưa sang trang mới**:
  - Loại bỏ hoàn toàn Cột Backup CoreCCP khỏi trang này (chuyển hẳn sang phân hệ VNCLEAR).
  - Sửa lỗi hiển thị ô nhập giờ `backupTime` (`06:00`) và `statTime` (`06:30`) lên chiều rộng `125px` rõ ràng, không bị che khuất số.
  - Tự động lưu file vào đúng thư mục ngày phiên làm việc hiện tại (`sessionDate`), tránh tình trạng lưu đè sang ngày khác.
- **API Backend được gọi**:
  - `POST /api/v1/bot-engine/audit-ms-backup`
  - `POST /api/v1/bot-engine/trigger-download`
  - `POST /api/v1/bot-engine/trigger-lot-macro`
  - `POST /api/v1/bot-engine/trigger-value-macro`
  - `POST /api/v1/bot-engine/run-gtt-check`
  - `GET /api/v1/bot-engine/gtt-report/export-correction`

---

### 4. Phân hệ VNCLEAR CoreCCP & CoreEX (`/vnclear/clearing-hub`)

#### Component `CoreCcpBackupSection.tsx` & `CcpLotStatisticsSection.tsx`
- **Đường dẫn hiện tại**: [frontend/src/app/trading-manager/components/core-ccp/CoreCcpBackupSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CoreCcpBackupSection.tsx)
- **Chức năng nghiệp vụ chi tiết**:
  1. **Bộ chuyển đổi Chế độ kép (Dual-View)**:
     - **Chế độ USER (Vận hành thường nhật)**: Thẻ trạng thái trực quan tóm tắt đủ/thiếu 25 file và kết quả chốt số dư/ký quỹ EOD.
     - **Chế độ EXPERT (Kỹ thuật chuyên sâu)**: Hiển thị đầy đủ 6 nhóm báo cáo, chi tiết từng tham số crawler và log bóc tách.
  2. **Ma trận 25 Báo cáo VNCLEAR Maker**:
     - *Nhóm 1 (Sổ lệnh thường - 5 file)*: `DSL`, `DSLDK`, `DSLCK`, `DSLDH`, `DSGD`.
     - *Nhóm 2 (Sổ lệnh MM - 5 file)*: `DSL_MM`, `DSLDK_MM`, `DSLCK_MM`, `DSLDH_MM`, `DSGD_MM`.
     - *Nhóm 3 (Vị thế & Lãi lỗ - 3 file)*: `TTM trước 4h20`, `TTM CCP`, `TTTT`.
     - *Nhóm 4 (Rủi ro & Ký quỹ - 6 file)*: `QLTTTKGD trước 4h20`, `QLTTTKGD`, `EOD.csv`, `QLTTTVKD`, `DSQLKQ_TKGD`, `DSQLKQ_TVKD`.
     - *Nhóm 5 (Nộp rút & Tài khoản - 2 file)*: `NR`, `DSTKGD ACM`.
     - *Nhóm 6 (Hàng hóa & Giá - 3 file)*: `HH`, `HĐ *`, `GTT CCP`.
  3. **Đối Soát Kết Quả EOD CoreCCP**:
     - Tính toán chênh lệch số dư tiền mặt, tiền hạch toán lãi lỗ và ký quỹ IMR.
     - Bảng tài khoản âm ký quỹ CoreCCP.
  4. **Thống Kê Số Lot & Giá Trị Giao Dịch CCP (`CcpLotStatisticsSection.tsx`)**:
     - Phân tích số liệu từ `DSGD CCP.xlsx`.
     - Báo cáo số lot và giá trị theo Thành viên kinh doanh (TVKD) và Mã hàng hóa.
     - Phân loại 4 nhóm giao dịch: Lệnh thường, Lệnh Market Maker, Khớp chéo, Tự doanh.
- **API Backend được gọi**:
  - `POST /api/v1/bot-engine/trigger-ccp-download`
  - `POST /api/v1/reconciliation/upload-eod`
  - `POST /api/v1/ccp-statistics/process`
  - `POST /api/v1/ccp-statistics/lot-statistics/run-lot`
  - `POST /api/v1/ccp-statistics/lot-statistics/run-value`

---

### 5. Trung Tâm Giám Sát Robot & Logs (`/monitoring/bot-jobs`)

#### Component `TradingManagerJobQueueSection.tsx`
- **Đường dẫn hiện tại**: [frontend/src/app/trading-manager/components/job-queue/TradingManagerJobQueueSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/job-queue/TradingManagerJobQueueSection.tsx)
- **Chức năng nghiệp vụ chi tiết**:
  1. **Đưa thành Menu Cột Trái độc lập (`Sidebar.tsx`)**:
     - Không còn nằm ẩn dưới tab của Trading Manager; nhân viên ở bất kỳ trang nào cũng có thể click vào xem tiến trình bot.
     - Badge số lượng Job đang chạy (`PROCESSING`) nhấp nháy đỏ trên Sidebar khi có worker hoạt động.
  2. **Bộ lọc Hàng đợi Đa năng**:
     - Lọc trạng thái: `PROCESSING`, `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `AWAITING_CAPTCHA`.
     - Lọc theo loại tác vụ: `CHECK_KLGD`, `CHECK_PRE_EOD`, `DOWNLOAD_CCP_REPORT`, `RUN_MACRO`...
     - Tìm kiếm chính xác theo `Job ID` hoặc khoảng ngày.
  3. **Bảng Điều Khiển Tác Vụ & Can Thiệp Khẩn Cấp**:
     - Xem tiến độ, thời gian bắt đầu, số lần thử (`attempt/maxAttempts`).
     - Nút `[Hủy Job (Cancel)]`, `[Thử lại (Retry)]`, và `[Tải gói kết quả ZIP]`.
  4. **Cửa Sổ Terminal Stream Logs Realtime**:
     - Xem trực tiếp dòng chảy log của Playwright Crawler, download file và parsing Excel.
- **API Backend được gọi**:
  - `GET /api/v1/bot-engine/jobs?jobTypes={types}&limit={limit}`
  - `POST /api/v1/bot-engine/jobs/{id}/cancel`
  - `GET /api/v1/bot-engine/jobs/{id}/download-zip`

---

### 6. Trung Tâm Cấu Hình Tỷ Giá & Lưu Trữ (`/admin/trading-settings`)

#### Component `TradingManagerConfigSection.tsx` & `SmartPathInput.tsx`
- **Đường dẫn hiện tại**: [frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx)
- **Tách thành 2 Component con**:
  1. `MsConfigSection.tsx`: Cấu hình tỷ giá USD mua/bán/hạch toán M-System, giờ mở/đóng phiên, và 10 thư mục hạ tầng MS/CQG. Nút `[Đồng bộ tỷ giá M-System]`.
  2. `OmsConfigSection.tsx`: Cấu hình Ma trận tỷ giá đa tiền tệ động CoreCCP (USD, EUR, JPY, MYR, VND...), thông số bot VNCLEAR, và thư mục Backup CoreCCP/CE. Nút `[Đồng bộ tỷ giá CoreCCP]`.
  3. `SmartPathInput.tsx`: Kiểm tra xác thực thời gian thực tính tồn tại của đường dẫn thư mục trên Server trước khi cho phép lưu cấu hình.
- **Phân quyền bảo mật**:
  - Bắt buộc quyền `MANAGE_SYSTEM_SETTINGS`. Người dùng không có quyền quản trị sẽ bị chặn truy cập.
- **API Backend được gọi**:
  - `GET /api/v1/system-settings`
  - `POST /api/v1/system-settings`
  - `POST /api/v1/reconciliation/sync-usd-rate`
  - `POST /api/v1/reconciliation/sync-exchange-rates`
  - `POST /api/v1/system-settings/verify-storage-path`

---

## IV. BẢN HƯỚNG DẪN MẪU: CÁCH YÊU CẦU TẠO MỘT TRANG MỚI

Khi bạn muốn triển khai bất kỳ màn hình nào, bạn chỉ cần ra chỉ đạo ngắn gọn theo cú pháp chuẩn sau:

> **Cú pháp yêu cầu mẫu cho User**:
> *"Giúp tôi tạo màn hình độc lập `[TÊN_MÀN_HÌNH]` tại đường dẫn `[ĐƯỜNG_DẪN_ROUTE]` bằng cách bốc component `[TÊN_COMPONENT]` sang, giữ nguyên trang cũ để đối chiếu song song."*

### Ví dụ cụ thể:

1. **Yêu cầu tạo màn hình Đối soát giao dịch**:
   > *"Giúp tôi tạo màn hình độc lập **Giám Sát Đối Soát Giao Dịch** tại route `/operations/reconciliation` bằng cách bốc component `LegacyReconSection.tsx` sang. Mở rộng chiều cao Box chênh lệch lên 480px, đổi màu số liệu sang màu trắng (chỉ đỏ khi lệch) và thêm link vào Sidebar."*

2. **Yêu cầu tạo màn hình Báo cáo VNCLEAR CoreCCP**:
   > *"Giúp tôi tạo màn hình độc lập **Phân Hệ VNCLEAR** tại route `/vnclear/clearing-hub` bằng cách bốc `CoreCcpBackupSection.tsx` và `CcpLotStatisticsSection.tsx` sang, giữ nguyên chế độ kép User/Expert và thêm link vào Sidebar."*

3. **Yêu cầu đưa Hàng đợi & Logs ra Sidebar**:
   > *"Giúp tôi đưa **Hàng đợi & Logs** ra Menu Sidebar chính tại route `/monitoring/bot-jobs` bằng cách bốc `TradingManagerJobQueueSection.tsx` sang và thêm badge đếm Job đang chạy trên Sidebar."*

---

## V. TỔNG KẾT & CAM KẾT CHẤT LƯỢNG

1. **Bảo tồn mã nguồn**: Không có bất kỳ dòng code logic nào của ca trực bị xóa bỏ hay làm sai lệch.
2. **Kiểm thử liên tục**: Mỗi khi tạo trang mới, toàn bộ hệ thống luôn được kiểm tra biên dịch bằng `npx tsc --noEmit` & `npm run build` để đảm bảo 100% không phát sinh lỗi.
3. **Trải nghiệm vượt trội**: Người dùng có thể thẩm định song song giữa giao diện cũ và mới một cách trực quan, minh bạch và chủ động quyết định thời điểm chuyển giao chính thức.
