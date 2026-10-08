# TỔNG HỢP TOÀN DIỆN LUỒNG VẬN HÀNH TỰ ĐỘNG HÓA TRADING MANAGER
## CẨM NANG GO-LIVE VẬN HÀNH KHÔNG ĐỂ SÓT THÔNG TIN

> **Mã tài liệu**: `MXV-SOP-TRADING-MANAGER-AUTO-2026-V1.0`  
> **Ngày lập**: 08/10/2026  
> **Người lập**: Antigravity (AI Assistant)  
> **Phạm vi áp dụng**: Màn hình Trading Manager (`/trading-manager`), Bot Engine (`bot-engine`), Scheduler (`scheduler.service`), Đối soát 4 bên & Tải dữ liệu RPA  
> **Mục tiêu**: Cung cấp toàn bộ thông tin chi tiết, timeline 24h, ma trận cờ cấu hình, chốt chặn an toàn và checklist từng bước để sẵn sàng bật tự động vận hành hôm nay.

---

## MỤC LỤC
1. [Kiến Trúc Tổng Thể & 2 Phân Hệ Độc Lập](#1-kiến-trúc-tổng-thể--2-phân-hệ-độc-lập)
2. [Bộ Cờ Master Switch & Cơ Chế Kích Hoạt Tự Động](#2-bộ-cờ-master-switch--cơ-chế-kích-hoạt-tự-động)
3. [Timeline Chi Tiết 24h Của Phiên Giao Dịch](#3-timeline-chi-tiết-24h-của-phiên-giao-dịch)
4. [Ma Trận Các Tác Vụ Tự Động (Jobs Matrix)](#4-ma-trận-các-tác-vụ-tự-động-jobs-matrix)
5. [Cấu Trúc Lưu Trữ Thư Mục & Cơ Chế Bảo Toàn Dữ Liệu](#5-cấu-trúc-lưu-trữ-thư-mục--cơ-chế-bảo-toàn-dữ-liệu)
6. [Danh Mục Tài Khoản & Thông Số Cấu Hình Cần Kiểm Tra](#6-danh-mục-tài-khoản--thông-số-cấu-hình-cần-kiểm-tra)
7. [Checklist Các Bước Bật Vận Hành Tự Động Hôm Nay](#7-checklist-các-bước-bật-vận-hành-tự-động-hôm-nay)

---

## 1. KIẾN TRÚC TỔNG THỂ & 2 PHÂN HỆ ĐỘC LẬP

Hệ thống Trading Manager được phân tách thành **2 trang vận hành chuyên biệt** kèm **1 màn hình dùng chung trung tâm**:

```
                              ┌─────────────────────────────────────────────────────────┐
                              │            TRADING MANAGER OPERATION HUB                │
                              └────────────────────────────┬────────────────────────────┘
                                                           │
                      ┌────────────────────────────────────┴────────────────────────────────────┐
                      ▼                                                                         ▼
     ┌──────────────────────────────────┐                                      ┌──────────────────────────────────┐
     │  PHÂN HỆ 1: M-SYSTEM & CQG       │                                      │  PHÂN HỆ 2: CORECCP & COREEX     │
     │  URL: `/trading-manager/ms-cqg`  │                                      │  URL: `/trading-manager/ccp-ce`  │
     └────────────────┬─────────────────┘                                      └────────────────┬─────────────────┘
                      │                                                                         │
                      │  Tab 1: Check GD - EOD - Sync                                           │  Tab 1: Check KLGD 4 Bên (Shared)
                      │  Tab 2: Backup - Thống Kê - GTT                                         │  Tab 2: CoreCCP Backup & EOD
                      │                                                                         │  Tab 3: CoreEX Backup
                      │                                                                         │  Tab 4: Tỷ Giá Đa Nguyên Tệ
                      └────────────────────────────────────┬────────────────────────────────────┘
                                                           │
                                                           ▼
                                      ┌─────────────────────────────────────────┐
                                      │ MÀN HÌNH CHUNG: CHECK KLGD (4 BÊN)      │
                                      │ M-System ↔ CQG ↔ Straits ACM ↔ CoreCCP  │
                                      └─────────────────────────────────────────┘
```

---

## 2. BỘ CỜ MASTER SWITCH & CƠ CHẾ KÍCH HOẠT TỰ ĐỘNG

Hệ thống điều khiển tự động thông qua **2 công tắc trung tâm (Circuit Breaker)** lưu trong bảng `system_settings`:

| Tên Cờ Cấu Hình (`key`) | Giá Trị Hiện Tại | Giá Trị Cần Bật | Ý Nghĩa Nghiệp Vụ | Tác Vụ Bị Chi Phối |
| :--- | :---: | :---: | :--- | :--- |
| **`bot_auto_recon_enabled`** | `false` | **`true`** | **Công tắc Đối chiếu trong phiên**:<br>Kích hoạt bot chạy định kỳ đối chiếu khớp lệnh. | `CHECK_KLGD` (chu kỳ 60 phút/lần) |
| **`bot_auto_backup_enabled`** | `false` | **`true`** | **Công tắc Lịch biểu theo giờ**:<br>Kích hoạt bot tải báo cáo, đồng bộ số dư, chạy macro. | `RPA_DOWNLOAD_MS`<br>`DOWNLOAD_CQG`<br>`DOWNLOAD_CAST`<br>`AUTO_CHECK_SOD`<br>`RUN_LOT_MACRO` |
| **`bot_periodic_check_frequency`** | `60` | `60` (hoặc `30`) | **Tần suất quét trong phiên** (phút). | Chu kỳ lặp lại của `CHECK_KLGD`. |

> **Quy tắc an toàn**:
> - Khi tắt cờ (`false`), các tiến trình chạy ngầm dừng sinh Job.
> - **Các nút bấm thủ công trên giao diện UI vẫn hoạt động 100% bình thường** (Manual Override).

---

## 3. TIMELINE CHI TIẾT 24H CỦA PHIÊN GIAO DỊCH

```mermaid
timeline
    title LỊCH TRÌNH 24H TỰ ĐỘNG HÓA TRADING MANAGER
    04:30 - 05:00 : RPA M-System tải 10 báo cáo đầu ngày
                  : Tự động Snapshot file cũ nếu đã tồn tại
    05:00 : Mở phiên giao dịch mới (session_start_time = 05:00)
    06:00 - 07:05 : Tải 9 file thô CQG (FR1, PS1, OP1, OD1, FR2, PS2, OP2, OD2, AS)
                  : Auto-Merge CQG (FR1+FR2 -> FR, PS1+PS2 -> PS)
                  : Tải số dư CQG CAST (07:00)
                  : Đối chiếu số dư đầu ngày SOD (07:05)
                  : Chạy Macro thống kê Lot & GTGD (06:30)
    07:00 - 22:00 : Chu kỳ 60 phút/lần: Bot CHECK_KLGD (4 bên)
                  : Lưu file vào TradingCheck/Futures/ (không đè Backup)
                  : Cảnh báo chuông & Telegram nếu lệch lệnh
    16:15 - 16:30 : Tải CoreCCP Đợt 1 (QL TT TKGD & TTM trước 16h20)
    22:00 - Pre-EOD : Đối chiếu Pre-EOD 3 bên (MS vs CQG vs Straits ACM)
                    : Auto-Merge CQG phiên T-1
                    : Cảnh báo chênh lệch khối lượng trước khi khóa sổ
    Sau chốt EOD : Tải CoreCCP Đợt 2 (23 báo cáo VNCLEAR)
                 : Tải CoreEX (10 báo cáo)
                 : Đối soát 4 thành phần số dư EOD CCP
                 : Thống kê Lot & Giá trị CCP (per TVKD)
                 : Quét tài khoản âm ký quỹ (SCAN_NEGATIVE_MARGIN)
```

---

## 4. MA TRẬN CÁC TÁC VỤ TỰ ĐỘNG (JOBS MATRIX)

### 🏢 Phân Hệ 1: M-System & CQG (`/trading-manager/ms-cqg`)

| STT | Tên Tác Vụ | Loại Job (`jobType`) | Giờ Chạy / Tần Suất | Thư Mục Đầu Ra | Mô Tả & Điều Kiện |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Check KLGD Trong Phiên** | `CHECK_KLGD` | 60 phút/lần (`07:00 - 22:00`) | `TradingCheck/Futures/` | So khớp 4 bên (MS vs CQG vs ACM vs CCP). Bật chuông & Telegram nếu lệch. |
| **2** | **Tải Báo Cáo Đầu Ngày MS** | `RPA_DOWNLOAD_REPORTS` | `04:30` hàng ngày | `Backup MS/Futures/` | Tải 10 báo cáo MS (NKTTHT, DSTKGD, QLTKGD...). Tự động snapshot trước khi đè. |
| **3** | **Tải Báo Cáo CQG** | `DOWNLOAD_CQG_BACKUP` | `06:00` hàng ngày | `Backup CQG/Futures/` | Tải 9 file thô từ 2 tài khoản CQG Trading Desk qua Playwright. |
| **4** | **Auto-Merge CQG** | `AUTO_MERGE_CQG` | `06:15` (hoặc sau tải CQG) | `Backup CQG/Futures/` | Ghép `FR1+FR2 -> FR.xlsx`, `PS1+PS2 -> PS.xlsx`, `OP1+OP2 -> OP`, `OD1+OD2 -> Od`. |
| **5** | **Tải Số Dư CQG CAST** | `DOWNLOAD_CAST` | `07:00` hàng ngày | `Backup CAST/` | Tải file số dư tài khoản CQG CAST Balances. |
| **6** | **Đối Chiếu Đầu Ngày (SOD)** | `AUTO_CHECK_SOD` | `07:05` hàng ngày | `Email Report` | Đối chiếu số dư tiền mặt đầu ngày MS vs CQG CAST. Gửi mail thông báo. |
| **7** | **Chạy Macro Lot & Value** | `RUN_LOT_MACRO`<br>`RUN_VALUE_MACRO` | `06:30` hàng ngày | `Thong ke so lot/` | Kích hoạt Excel headless chạy Macro thống kê số lot và giá trị GD. |
| **8** | **Đối Chiếu Pre-EOD 3 Bên** | `CHECK_PRE_EOD` | Cuối phiên (trước EOD) | `Email Report` | Đối chiếu khớp lệnh T-1 và vị thế ròng giữa MS, CQG gộp và Straits ACM. |
| **9** | **Quét Ký Quỹ Âm EOD** | `SCAN_NEGATIVE_MARGIN` | Sau giờ EOD MS | `Email Warning` | So sánh QLTKGD vs file EOD, phát hiện tài khoản phát sinh âm ký quỹ. |

---

### 🏛️ Phân Hệ 2: CoreCCP & CoreEX (`/trading-manager/ccp-ce`)

| STT | Tên Tác Vụ | Loại Job (`jobType`) | Giờ Chạy / Tần Suất | Thư Mục Đầu Ra | Mô Tả & Điều Kiện |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **10** | **Tải CoreCCP Đợt 1** | `RPA_DOWNLOAD_CCP_PHASE1` | `16:15` hàng ngày | `Backup CCP/Futures/` | Tải 2 file: Quản lý TT TKGD & TTM trước mốc chốt 16h20. |
| **11** | **Tải CoreCCP Đợt 2 (EOD)** | `RPA_DOWNLOAD_CCP_EOD` | Sau chốt EOD CCP | `Backup CCP/Futures/` | Tải trọn bộ 23 báo cáo VNCLEAR Maker của sàn bù trừ CCP. |
| **12** | **Đối Chiếu EOD CoreCCP** | `CHECK_EOD_CCP` | Sau khi đủ 23 file CCP | `DB / Báo Cáo` | Đối soát 4 thành phần số dư (Tiền mặt, Ký quỹ, Lãi lỗ MTM, Phí) & Quỹ bù trừ. |
| **13** | **Thống Kê Lot CCP** | `CALCULATE_CCP_LOT_STATS` | `18:30` hàng ngày | `Thong ke ccp/output/` | Bóc tách file DSGD CCP lũy kế theo 4 nhóm lệnh, từng TVKD & mặt hàng. |
| **14** | **Tải Báo Cáo CoreEX (CE)** | `RPA_DOWNLOAD_CE` | `19:30` hàng ngày | `Backup CE/Futures/` | Tải 10 báo cáo sàn CoreEX (Sổ lệnh, GTT, Danh mục Hàng hóa...). |
| **15** | **Đồng Bộ Tỷ Giá CoreCCP** | `SYNC_CCP_EXCHANGE_RATES` | Định kỳ đầu ngày | `system_settings` | Cập nhật ma trận đa nguyên tệ (USD, EUR, JPY, GBP, MYR...) từ file GTT/CCP. |

---

## 5. CẤU TRÚC LƯU TRỮ THƯ MỤC & CƠ CHẾ BẢO TOÀN DỮ LIỆU

### 5.1. Phân Tách 2 Nhóm Thư Mục Độc Lập
Theo đúng kiến trúc chuẩn từ C# Tool (`FormMain.cs#L494` & `ChromeBot.cs#L867`):

1. **Nhóm Thư Mục BACKUP Chính Thức (Chỉ dành cho các tác vụ Sao lưu)**:
   - M-System: `/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/YYYY/Tmm.YYYY/dd.mm/`
   - CQG: `/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures/YYYY/Tmm.YYYY/dd.mm/`
   - ACM: `/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/YYYY/Tmm.YYYY/dd.mm/`
   - CoreCCP: `/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/YYYY/Tmm.YYYY/dd.mm/`
   - CoreEX: `/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CE/Futures/YYYY/Tmm.YYYY/dd.mm/`

2. **Nhóm Thư Mục KIỂM TRA TRONG PHIÊN (TradingCheckPath)**:
   - Đường dẫn: `/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/YYYY/Tmm.YYYY/dd.mm/`
   - Toàn bộ file tải phục vụ `CHECK_KLGD` định kỳ mỗi 60 phút được lưu vào đây.
   - **Thư mục Backup chính thức được bảo toàn 100%, không bị bất kỳ tác vụ kiểm tra nào ghi đè**.

### 5.2. Cơ Chế Snapshot-Before-Overwrite (Không Bao Giờ Mất File)
- Bất kỳ khi nào một file chuẩn bị ghi đè lên file đã tồn tại:
  Hệ thống tự động sao chép file cũ thành bản lưu trữ:
  `${TênFile}_bak_${YYYYMMDD_HHmmss}.${PhầnMởRộng}`
  *(Ví dụ: `DSGD_bak_20261008_113700.xlsx`)*.
- Sau khi đã bảo lưu an toàn bản cũ $\rightarrow$ Mới ghi đè file mới.

---

## 6. DANH MỤC TÀI KHOẢN & THÔNG SỐ CẤU HÌNH CẦN KIỂM TRA

Trước khi bật tự động, Admin cần rà soát các thông số trong CSDL `system_settings`:

### 6.1. Tài Khoản Bot RPA
| Key Cấu Hình | Hệ Thống | Trạng Thái Cần Thiết |
| :--- | :--- | :--- |
| `bot_credentials_msystem` | M-System | Đã mã hóa AES: Có đủ `username`, `password`, `pin`, `url`. |
| `bot_credentials_cqg` | CQG Gateway | Có đủ tài khoản 1 (`username`, `password`) và tài khoản 2 (`username2`, `password2`). |
| `bot_credentials_ccp` | CoreCCP | Có đủ `username`, `password`, `urlLogin`. |
| `bot_credentials_acm` | ACM Portal | Có đủ thông tin Web Portal & SFTP. |

### 6.2. Đường Dẫn Vận Hành
| Key Cấu Hình | Giá Trị Chuẩn Trên Ubuntu (`10.0.0.26`) |
| :--- | :--- |
| `bot_backup_path_ms` | `M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures` |
| `bot_backup_path_cqg` | `M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CQG\Futures` |
| `bot_backup_path_acm` | `M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup ACM\Futures` |
| `bot_backup_path_ccp` | `M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CCP\Futures` |
| `bot_backup_path_ce` | `M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CE\Futures` |
| `bot_trading_check_path` | `M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\TradingCheck\Futures` |

---

## 7. CHECKLIST CÁC BƯỚC BẬT VẬN HÀNH TỰ ĐỘNG HÔM NAY

Thực hiện tuần tự 5 bước sau để đưa hệ thống vào trạng thái tự động hoàn toàn:

### Bước 1: Kiểm Tra Trạng Thái Dịch Vụ Máy Chủ
Đảm bảo các tiến trình PM2 đang `online` trên server `10.0.0.26`:
- `mxv-backend` (PID đang chạy, không bị restart lặp).
- `mxv-frontend` (Port 3000 online).
- `mock-sftp` (Port 2231 online nếu cần test SFTP).

### Bước 2: Bật Master Switch Đối Chiếu Trong Phiên (`bot_auto_recon_enabled`)
- Truy cập giao diện `/trading-manager/ms-cqg`.
- Tại Tab 1 (*Check GD - EOD - Sync*): Bật công tắc **"Tự động đối chiếu trong phiên"** sang màu xanh (`ON`).
- *Hoặc cập nhật trực tiếp qua API*:
  ```http
  POST /api/v1/system-settings
  { "key": "bot_auto_recon_enabled", "value": "true" }
  ```

### Bước 3: Bật Master Switch Tải Backup & Lịch Biểu (`bot_auto_backup_enabled`)
- Tại Tab 2 (*Backup - Thống Kê - GTT*): Bật công tắc **"Tự động tải báo cáo theo giờ"** sang màu xanh (`ON`).
- *Hoặc cập nhật trực tiếp qua API*:
  ```http
  POST /api/v1/system-settings
  { "key": "bot_auto_backup_enabled", "value": "true" }
  ```

### Bước 4: Kiểm Tra Ca Trực Hiện Tại (Shift Log)
- Để nhịp đập `@Cron` quét và sinh Job: Ca trực phiên hôm nay phải ở trạng thái **`PENDING`** (Đang mở).
- Nếu chưa có ca trực mở: Bấm mở ca trực mới trên giao diện Checklist (`/checklist`) hoặc tạo ca trực tự động.

### Bước 5: Giám Sát Nhịp Chạy Đầu Tiên (First Run Observation)
- Quan sát đồng hồ đếm ngược trên giao diện Trading Manager đếm về `00:00`.
- Kiểm tra danh sách Job trong hàng đợi (`bot_jobs`):
  - Job `CHECK_KLGD` xuất hiện với trạng thái `PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `COMPLETED`.
  - Kiểm tra thư mục `/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/08.10/`: Các file `DSGD.xlsx`, `TTM.xlsx`, `TTTT.xlsx` xuất hiện.
  - Kiểm tra thư mục `/mnt/qlgd-it/.../Backup MS/.../08.10/`: **Không bị thay đổi timestamp**, được bảo toàn 100%.

---

> **Ghi chú khẩn cấp (Emergency Fallback)**:  
> Nếu trong phiên phát sinh sự cố mạng hoặc cổng portal đối tác bị lỗi, chỉ cần gạt tắt 2 công tắc Master Switch về `OFF` (`false`). Hệ thống sẽ lập tức dừng toàn bộ các bot chạy ngầm mà không gây ảnh hưởng đến dữ liệu ca trực. Ca trực có thể tiếp tục thao tác bằng tay thông qua các nút bấm trên giao diện.
