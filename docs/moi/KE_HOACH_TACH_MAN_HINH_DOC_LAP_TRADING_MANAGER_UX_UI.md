# KẾ HOẠCH TÁCH CÁC MÀN HÌNH ĐỘC LẬP TỪ TRADING MANAGER (UX/UI & ARCHITECTURE)
## Tái Thiết Kế Trải Nghiệm Người Dùng (UX/UI) & Kiến Trúc Điều Hướng Cho Hệ Thống Giám Sát Vận Hành MXV

---

## 1. BỐI CẢNH & HIỆN TRẠNG (PROBLEM STATEMENT)

### 1.1. Hiện trạng "Monolithic Page" tại `/trading-manager`
Trang **Trading Manager** (`/trading-manager` hoặc `/admin/trading-manager`) ban đầu được xây dựng để gom 1:1 các chức năng từ ứng dụng Windows Forms C# cũ (`operate-transaction-app`). Hiện tại, trang này đang nhồi nhét **toàn bộ 5 phân hệ nghiệp vụ khổng lồ** vào một giao diện tab đơn lẻ:
1. **Tab 1: Check GD – EOD – Sync**: Giám sát khớp lệnh trong phiên (`CHECK_KLGD`), đối chiếu Pre-EOD 3 bên (`CHECK_PRE_EOD`), đối chiếu EOD Market Maker (`CHECK_EOD_MM`), và quét ký quỹ âm (`SCAN_NEGATIVE_MARGIN`).
2. **Tab 2: Backup – Thống kê – GTT**: Quản lý tải 14 báo cáo M-System, 9 báo cáo CQG, chạy Macro số lô (`RUN_LOT_MACRO`), Macro giá trị (`RUN_VALUE_MACRO`), và đối soát chênh lệch giá thanh toán GTT (`CHECK_GTT`).
3. **Tab 3: Cấu hình – Đường dẫn**: Cấu hình tỷ giá đa tiền tệ M-System & CoreCCP, giờ phiên, cùng 12 đường dẫn thư mục hạ tầng máy chủ.
4. **Tab 4: Báo Cáo & Đối Chiếu CoreCCP**: Tải 25 báo cáo VNCLEAR, đối soát EOD CoreCCP, thống kê Lot & Giá trị giao dịch CoreCCP theo 2 chế độ User vs Expert.
5. **Tab 5: Hàng đợi & Logs Robot**: Giám sát hàng đợi Job, can thiệp khẩn cấp (Cancel/Retry), và terminal stream logs Playwright.

### 1.2. Những điểm nghẽn nghiêm trọng khi "Nhét hết vào một trang"
| Điểm nghẽn | Hệ quả thực tế |
| :--- | :--- |
| **Quá tải nhận thức (Cognitive Overload)** | Nhân viên ca trực chỉ cần làm nhiệm vụ đối soát khớp lệnh trong ca nhưng phải tải trang chứa hàng trăm nút bấm, cấu hình tỷ giá, Macro và hàng đợi robot, rất dễ bấm nhầm nút nguy hiểm. |
| **Tải trang nặng & Rò rỉ tài nguyên** | Trang phải duy trì đồng thời: Socket.IO realtime, 2 polling intervals (8s cho Job Queue, 30s cho Matrix), hàng chục modal con và hàng ngàn dòng code giao diện. |
| **Bất cập trong phân quyền (RBAC)** | Không thể phân quyền chi tiết: Nhân viên trực ca vận hành (Operator) chỉ được xem và bấm chạy đối chiếu, trong khi việc sửa đường dẫn máy chủ hay sửa tỷ giá hạch toán bắt buộc phải là quyền của Admin/IT. |
| **Xung đột lộ trình phát triển VNCLEAR** | Hệ thống VNCLEAR CoreCCP & CoreEX là nền tảng giao dịch tương lai của MXV. Việc đặt VNCLEAR thành một Tab con phụ thuộc trong màn hình cũ của M-System là sai lệch về mặt định vị kiến trúc. |

---

## 2. BẢN ĐỒ KIẾN TRÚC ĐIỀU HƯỚNG MỚI (NEW INFORMATION ARCHITECTURE)

Hệ thống sẽ chuyển đổi mô hình từ **1 Trang Monolithic** thành **5 Phân Hệ / Màn Hình Độc Lập** được phân bổ theo đúng vai trò người dùng (Role-Based Personas) và định tuyến qua Sidebar Menu chuẩn:

```
MXV PORTAL SIDEBAR NAVIGATION
├── 1. CA TRỰC & VẬN HÀNH (OPERATIONS)
│   ├── Bảng Điều Khiển Ca Trực (/dashboard)
│   ├── Checklist Vận Hành (/shifts/checklist)
│   └── 🔴 [MÀN HÌNH MỚI 1] Giám Sát & Đối Soát Giao Dịch (/operations/reconciliation)
│
├── 2. BÁO CÁO & XỬ LÝ DỮ LIỆU (DATA & REPORTS)
│   ├── 🔴 [MÀN HÌNH MỚI 2] Báo Cáo Vận Hành, Macro & GTT (/data/operations-reports)
│   └── 🔴 [MÀN HÌNH MỚI 3] Phân Hệ VNCLEAR CoreCCP & CoreEX (/vnclear/clearing-hub)
│
├── 3. HẠ TẦNG & ROBOT ENGINE (ENGINEERING & AUTOMATION)
│   ├── 🔴 [MÀN HÌNH MỚI 4] Trung Tâm Giám Sát Robot & Hàng Đợi Job (/monitoring/bot-jobs)
│   └── Cấu Hình Bot RPA (/admin/bot-config)
│
└── 4. QUẢN TRỊ HỆ THỐNG (SYSTEM ADMIN)
    ├── Quản Lý Người Dùng & Phân Quyền (/admin/users)
    └── 🔴 [MÀN HÌNH MỚI 5] Cấu Hình Tỷ Giá & Hạ Tầng Lưu Trữ (/admin/trading-settings)
```

---

## 3. THIẾT KẾ CHI TIẾT 5 MÀN HÌNH CHỨC NĂNG ĐỘC LẬP

### 3.1. Màn hình 1: Giám Sát & Đối Soát Giao Dịch (`/operations/reconciliation`)
- **Tên hiển thị trên Menu**: `Giám Sát & Đối Soát Giao Dịch`
- **Đối tượng sử dụng**: Nhân sự Vận hành Ca trực (Shift Operator), Trưởng ca (Shift Leader).
- **Quyền hạn truy cập (`Permissions`)**: `ACCESS_AUTO_SHIFT` hoặc `MANAGE_SHIFTS`.
- **Thành phần giao diện (UI Components)**:
  1. **Top Bar Vận Hành Tinh Gọn**:
     - Bộ chọn Ngày phiên giao dịch (Mặc định tự động nhận diện ca đêm $T-1$).
     - Badge trạng thái: `Online | Khớp 100%` (Xanh) hoặc `Lệch X lot` (Đỏ nhấp nháy).
     - Master Switch Bật/Tắt chế độ tự động chạy định kỳ trong ca (`bot_auto_recon_enabled`).
     - Nút `[Chạy Đối Chiếu Ngay]` và Nút `[Dừng Khẩn Cấp Bot]`.
  2. **Ma Trận Đối Soát Thời Gian Thực (Matrix Board)**:
     - Thẻ 1: Khối lượng giao dịch (KLGD) — M-System vs CQG vs ACM.
     - Thẻ 2: Trạng thái mở (TTM) — Vị thế mở qua các tài khoản.
     - Thẻ 3: Trạng thái tất toán (TTTT) — Lot thanh toán & đóng lệnh.
  3. **Bảng Báo Động Lệch Lệnh (Live Discrepancy Alert)**:
     - Chỉ xuất hiện nổi bật khi có chênh lệch: Hiển thị danh sách từng lệnh lệch (Mã TK, Hợp đồng, Giá, Khối lượng, Bên thiếu/Bên thừa).
  4. **Khu Vực Chốt Ca Cuối Ngày (Pre-EOD & EOD Panel)**:
     - Nút `[Chạy Pre-EOD 3 Bên]` (Khớp lệnh + Vị thế Net Position).
     - Nút `[Kiểm Tra EOD & Quét Ký Quỹ Âm]`.
     - Nút `[Kiểm Tra Nhanh DSGD Trước EOD]` (API `check-dsgd-before-eod` mới bổ sung).

---

### 3.2. Màn hình 2: Báo Cáo Vận Hành, Macro & GTT (`/data/operations-reports`)
- **Tên hiển thị trên Menu**: `Báo Cáo, Macro & GTT`
- **Đối tượng sử dụng**: Nhân viên tổng hợp số liệu, Chuyên viên Thanh toán & Vận hành.
- **Quyền hạn truy cập (`Permissions`)**: `ACCESS_AUTO_SHIFT`.
- **Thành phần giao diện (UI Components)**:
  1. **Phân hệ 1: Quản lý File Báo Cáo Backup (Audit Hub)**:
     - Danh mục 14 báo cáo M-System (`NKTTHT`, `DSTKGD`, `TTM`, `TTTT`, `NR`...): Hiển thị trạng thái đèn xanh/đỏ (Đã có / Thiếu file).
     - Danh mục báo cáo CQG (`FR`, `PS`, `OP`, `OD`): Trạng thái gộp tự động từ tài khoản 1 và 2.
     - Báo cáo SFTP ACM (Straits).
     - Nút bấm: `[Kiểm Tra Toàn Bộ Thư Mục]` và `[Tải Bổ Sung File Thiếu Bằng Robot]`.
  2. **Phân hệ 2: Công Cụ Macro Thống Kê (Statistics Engine)**:
     - Khối chạy Macro Lô (`Lot Macro`): Chọn ngày, chọn phạm vi MXV / TVKD $\rightarrow$ Bấm chạy và tải trực tiếp file kết quả Excel.
     - Khối chạy Macro Giá Trị (`Value Macro`): Tự động quy đổi tỷ giá thanh toán ra VND và tải file báo cáo.
  3. **Phân hệ 3: Kiểm Tra Chênh Lệch Giá Thanh Toán GTT (GTT Reconciler)**:
     - Upload hoặc chọn ngày phiên để so khớp file GTT M-System vs Giá thanh toán các sở CME, ICE.
     - Bảng hiển thị các hợp đồng bị lệch giá (sai số $> 0.001$).
     - Nút `[Xuất File Điều Chỉnh Giá]` để import cập nhật lại M-System.

---

### 3.3. Màn hình 3: Phân Hệ VNCLEAR CoreCCP & CoreEX (`/vnclear/clearing-hub`)
- **Tên hiển thị trên Menu**: `Phân Hệ VNCLEAR (CoreCCP & CoreEX)`
- **Đối tượng sử dụng**: Chuyên viên Bù trừ Thanh toán VNCLEAR, Quản trị viên Kỹ thuật.
- **Quyền hạn truy cập (`Permissions`)**: `ACCESS_AUTO_SHIFT` hoặc `MANAGE_SYSTEM_SETTINGS`.
- **Thành phần giao diện (UI Components)**:
  1. **Thanh Chuyển Đổi Chế Độ Kép (Dual-View Switcher)**:
     - **Chế độ USER (Vận hành thường nhật)**: Tinh gọn, chỉ hiển thị tóm tắt tình trạng đủ/thiếu của 25 file báo cáo VNCLEAR và kết quả đối soát số dư/ký quỹ EOD.
     - **Chế độ EXPERT (Kỹ thuật chuyên sâu)**: Mở rộng đầy đủ 6 nhóm báo cáo, chi tiết từng tham số API, phân tích phân loại lệnh và log bóc tách.
  2. **Phân hệ Đối Soát EOD CoreCCP**:
     - Nút `[Tải Báo Cáo CoreCCP Tự Động]` (Robot Playwright).
     - Đối soát Ký quỹ ban đầu IMR, Quỹ bù trừ, Tiền lãi lỗ qua đêm.
     - Danh sách cảnh báo tài khoản vi phạm ngưỡng ký quỹ hoặc ký quỹ âm trên CoreCCP.
  3. **Phân hệ Thống Kê Lot & Giá Trị Giao Dịch CoreCCP**:
     - Phân tích chi tiết khối lượng từ file `DSGD CCP.xlsx`.
     - Phân loại rõ ràng: Khối lượng thường, Lệnh Market Maker, Khớp lệnh chéo, Tự doanh.
  4. **Phân hệ Sàn Giao Dịch Mới CoreEX (CE)**:
     - Giám sát đồng bộ và tải các báo cáo khớp lệnh từ CoreEX.

---

### 3.4. Màn hình 4: Trung Tâm Giám Sát Robot & Hàng Đợi Job (`/monitoring/bot-jobs`)
- **Tên hiển thị trên Menu**: `Giám Sát Robot & Logs`
- **Đối tượng sử dụng**: Toàn bộ nhân viên ca trực, Quản trị viên Bot, IT Support.
- **Quyền hạn truy cập (`Permissions`)**: `ACCESS_AUTO_SHIFT`.
- **Thành phần giao diện (UI Components)**:
  1. **Bảng Thống Kê Trạng Thái Worker (Queue Health Overview)**:
     - Thống kê thời gian thực: Đang chạy (`PROCESSING`), Đang chờ (`PENDING`), Chờ Captcha (`AWAITING_CAPTCHA`), Thất bại (`FAILED`), Đã dừng (`CANCELLED`).
  2. **Bộ Lọc Đa Chiều Nâng Cao**:
     - Lọc theo loại nghiệp vụ: `CHECK_KLGD`, `CHECK_PRE_EOD`, `DOWNLOAD_CCP_REPORT`, `RUN_MACRO`...
     - Lọc theo khoảng ngày, lọc theo trạng thái, tìm kiếm theo `Job ID`.
  3. **Bảng Điều Khiển Tác Vụ**:
     - Hiển thị danh sách Job kèm tiến độ, thời gian bắt đầu, số lần thử (`attempt/maxAttempts`).
     - Thao tác can thiệp: Nút `[Hủy khẩn cấp / Dừng]`, Nút `[Chạy lại (Retry)]`, Nút `[Tải gói kết quả ZIP]`.
  4. **Cửa Sổ Terminal Stream Logs Thời Gian Thực**:
     - Tích hợp cửa sổ Console đen chữ xanh hiển thị log trực tiếp từ worker (hỗ trợ auto-scroll, copy log, tìm kiếm từ khóa log).

---

### 3.5. Màn hình 5: Cấu Hình Tỷ Giá & Hạ Tầng Lưu Trữ (`/admin/trading-settings`)
- **Tên hiển thị trên Menu**: `Cấu Hình Tỷ Giá & Đường Dẫn`
- **Đối tượng sử dụng**: Quản trị viên Hệ thống (System Admin), IT Lead.
- **Quyền hạn truy cập (`Permissions`)**: BẮT BUỘC `MANAGE_SYSTEM_SETTINGS`. *(Nhân viên vận hành thông thường bị chặn không cho truy cập)*.
- **Thành phần giao diện (UI Components)**:
  1. **Khối Quản Lý Tỷ Giá Đa Ngoại Tệ**:
     - **Tỷ giá M-System**: Tỷ giá USD mua/bán, USD hạch toán. Nút `[Đồng Bộ Tự Động Từ M-System]`.
     - **Ma trận tỷ giá CoreCCP**: Quản lý động danh mục tỷ giá quy đổi cho tất cả các loại tiền tệ (USD, JPY, MYR, EUR, VND...). Nút `[Đồng Bộ Tự Động Từ CoreCCP]`.
  2. **Khối Cấu Hình Khung Giờ Phiên (Session Hours)**:
     - Giờ mở phiên (05:00), Giờ đóng phiên (05:00 hôm sau).
  3. **Khối Quản Lý 12 Thư Mục Hạ Tầng (Storage Paths Manager)**:
     - Quản lý các đường dẫn ổ đĩa: `Backup MS`, `Backup CQG`, `Backup ACM`, `Backup CoreCCP`, `Backup CoreEX`, `Thư mục Macro`, `Thư mục GTT`...
     - Tích hợp bộ kiểm tra `SmartPathInput`: Tự động gửi request lên backend kiểm tra xem thư mục có thực sự tồn tại trên máy chủ Ubuntu/Windows không trước khi cho phép lưu.

---

## 4. KẾ HOẠCH TRIỂN KHAI TỪNG BƯỚC (MIGRATION ROADMAP)

Để đảm bảo quá trình chuyển đổi không làm gián đoạn ca trực thực tế đang vận hành của nhân viên, lộ trình được chia thành 3 giai đoạn:

```
GIAI ĐOẠN 1 (Bảo Toàn & Chuẩn Bị)
├── Giữ nguyên URL cũ /trading-manager hoạt động bình thường
├── Tái cấu trúc tách các component độc lập vào thư mục features/
└── Khởi tạo các Route mới trên App Router (/operations/reconciliation, /vnclear/clearing-hub...)
        │
        ▼
GIAI ĐOẠN 2 (Mở Song Song & Phân Quyền)
├── Đưa các màn hình mới lên Sidebar Navigation với phân quyền chuẩn RBAC
├── Đội ngũ Vận hành dùng thử nghiệm các màn hình độc lập
└── Ghi nhận phản hồi UX/UI và tinh chỉnh layout
        │
        ▼
GIAI ĐOẠN 3 (Chuyển Đổi Hoàn Toàn & Chuyển Trang Cũ Thành Hub)
├── Biến URL /trading-manager thành "Operations Command Hub" (Trang tổng quan dạng Dashboard với các lối tắt Quick Launch đến 5 màn hình)
└── Hoàn tất tách biệt, đóng gói hoàn chỉnh hệ thống
```

---

## 5. BẢN ĐỒ ĐỐI CHIẾU FILE CODE HIỆN TẠI VÀ TRANG MỚI

| Phân hệ mới | URL Route mới | File Component gốc hiện tại | File Component mới dự kiến |
| :--- | :--- | :--- | :--- |
| **1. Đối Soát Giao Dịch** | `/operations/reconciliation` | `LegacyReconSection.tsx` <br> `LegacyPreEodDiffSection.tsx` | `src/app/operations/reconciliation/page.tsx` <br> `src/features/reconciliation/...` |
| **2. Báo Cáo, Macro & GTT** | `/data/operations-reports` | `LegacyBackupThongKeSection.tsx` <br> `LegacyGttCheckerSection.tsx` <br> `CeAcmBackupSection.tsx` | `src/app/data/operations-reports/page.tsx` <br> `src/features/operations-reports/...` |
| **3. VNCLEAR CoreCCP & CE** | `/vnclear/clearing-hub` | `CoreCcpBackupSection.tsx` <br> `CcpLotStatisticsSection.tsx` | `src/app/vnclear/clearing-hub/page.tsx` <br> `src/features/vnclear/...` |
| **4. Hàng Đợi Robot & Logs** | `/monitoring/bot-jobs` | `TradingManagerJobQueueSection.tsx` <br> `TradingManagerLogModal.tsx` | `src/app/monitoring/bot-jobs/page.tsx` <br> `src/features/bot-monitor/...` |
| **5. Cấu Hình Tỷ Giá & Lưu Trữ** | `/admin/trading-settings` | `TradingManagerConfigSection.tsx` | `src/app/admin/trading-settings/page.tsx` <br> `src/features/trading-settings/...` |
| **Bàn Điều Hành Trung Tâm** | `/trading-manager` (Giữ nguyên) | `page.tsx` (hiện tại) | Trở thành **Command Hub** (Tổng quan trạng thái + Thẻ điều hướng tắt đến 5 màn hình trên) |
