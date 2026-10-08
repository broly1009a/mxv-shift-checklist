# TÀI LIỆU THIẾT KẾ CHI TIẾT: NÂNG CẤP GIAO DIỆN CHẾ ĐỘ KÉP (USER MODE vs EXPERT MODE) CHO PHÂN HỆ CORECCP

> **Dự án**: MXV Shift Checklist & Trading Manager  
> **Phân hệ**: Báo Cáo & Đối Chiếu CoreCCP (VNCLEAR)  
> **Tài liệu**: Thiết kế UI/UX & Kiến trúc Chuyển đổi Giao diện phục vụ Bàn giao Vận hành  
> **Ngày lập**: 23/09/2026  
> **Tác giả**: AI Assistant & Lead IT Engineer  

---

## 1. BỐI CẢNH & ĐẶT VẤN ĐỀ

### 1.1. Hiện trạng thực tế
Trong giai đoạn phát triển và kiểm thử nội bộ (Dev/Test), hai màn hình con của phân hệ CoreCCP:
1. **Sub-tab 1**: `Đối Soát Ký Quỹ & EOD` ([CoreCcpBackupSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CoreCcpBackupSection.tsx))
2. **Sub-tab 2**: `Thống Kê Số Lot & GTGD CoreCCP` ([CcpLotStatisticsSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx))

được xây dựng với mục tiêu phục vụ **kỹ sư IT vừa làm vừa test thực nghiệm**:
- Phơi bày toàn bộ các nút kích hoạt đơn lẻ (Tải file, Quét thư mục, Check đối chiếu, Xem Log Modal, Đổi thư mục mount...).
- Bảng chọn 25 checkbox báo cáo VNCLEAR Maker chiếm tới 50% diện tích màn hình.
- Hiển thị nguyên văn các đường dẫn kỹ thuật dài ngoằng của Linux (`/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T09.2026/23.09`).
- Nhiều nút thao tác cùng tồn tại song song gây nhiễu luồng tư duy ("Tự động quét", "Quét lại", "Tải thủ công", "Tổng hợp từ thư mục backup"...).

### 1.2. Thách thức trong ngày bàn giao cho User (Trực ca Vận hành)
- **Quá tải thông tin (Cognitive Overload)**: Trực ca vận hành không phải là lập trình viên. Khi nhìn vào 25 ô checkbox, các đường dẫn Linux mount, và hàng loạt nút bấm kỹ thuật, họ sẽ bối rối: *"Hôm nay tôi phải tích những ô nào? Bấm nhầm nút tải có làm hỏng dữ liệu không? Quy trình chuẩn từ bước 1 đến bước 2 là gì?"*.
- **Nhầm lẫn nghiêm trọng về phạm vi dữ liệu do nhãn cũ (ACM vs Toàn Sàn)**:
  * Do ở Phase 1 ban đầu, hệ thống ưu tiên phát triển cho sản phẩm Nano ACM nên nhiều nhãn giao diện cũ còn giữ từ khóa ACM (ví dụ: `"Tổng Số Lot ACM (DSGD)"`, `"File Lũy Kế ACM Excel"`, `"Tổng Hợp Vào Sổ Lũy Kế ACM"`).
  * **Thực tế kỹ thuật hiện tại (Phase 2 & Phase 3)**: Khi ấn **"Tổng Hợp Từ Thư Mục Backup"**, hệ thống đã tổng hợp **TẤT CẢ**: Cả **Số Lot** và cả **Giá Trị Giao Dịch (GTGD)** của **TOÀN BỘ 5 PHÂN HỆ** (ACM Nano, Tiêu chuẩn Thường, Spread, LME, Options) và tự động ghi vào **10 file Excel lũy kế** tương ứng. Nhãn text cũ gây hiểu lầm nghiêm trọng cho trực ca rằng hệ thống "chỉ làm mỗi ACM".
- **Rủi ro xóa code ngày bàn giao**: Nếu xóa bỏ các nút và thành phần kỹ thuật này đi, hệ thống đối mặt với nguy cơ:
  1. **Mất code / gãy logic**: Nhiều state, hàm kích hoạt test script, và cơ chế chọn tải báo cáo tùy biến (chọn 2 file đợt 16h20 vs 23 file EOD) sẽ bị mất.
  2. **Mất khả năng Debug khi có sự cố**: Khi sàn CoreCCP thay đổi cấu trúc hoặc bot tải lỗi, IT sẽ mất đi công cụ kiểm tra trực quan từng file trên giao diện.

### 1.3. Mục tiêu thiết kế
Thiết kế kiến trúc **Chế độ Kép (Dual-View Architecture)** kết hợp **Chuẩn Hóa Nhãn Nghiệp Vụ Toàn Diện**:
- **Chuẩn hóa nhãn đúng bản chất nghiệp vụ**: Thay thế toàn bộ nhãn cũ mang tính bộ phận ("ACM") thành nhãn đúng phạm vi thực tế (**"Toàn Sàn / Tất Cả Phân Hệ CoreCCP VNCLEAR"**).
- **Chế độ Vận Hành (User Mode - Mặc định)**: Tinh gọn tối đa, giao diện sạch đẹp, chuẩn hóa quy trình thành **1-Click Action** hoặc **2 bước rõ ràng**, hiển thị rõ ràng cả 2 chỉ số cốt lõi: **Tổng Số Lot** & **Tổng Giá Trị Giao Dịch** của toàn thị trường.
- **Chế độ Kỹ Thuật (Expert / IT Mode)**: Bảo toàn 100% nguyên vẹn toàn bộ giao diện, nút bấm, bảng chọn 25 checkbox, cấu hình chi tiết 10 file lũy kế, modal log và đường dẫn mount chi tiết như hiện tại.
- **Chuyển đổi tức thì (Seamless Toggle)**: Cho phép chuyển qua lại giữa 2 chế độ bằng một nút gạt tinh tế ở góc màn hình mà không cần tải lại trang.

---

## 2. NGUYÊN TẮC THIẾT KẾ & BẢO TOÀN HỆ THỐNG

1. **Nguyên tắc "Zero Code Deletion" (Không xóa bất kỳ logic hay hàm xử lý nào)**:
   - Giữ nguyên 100% các hàm: `handleTriggerCcpDownload`, `handleTriggerCcpCheck`, `selectedReports`, `handleRunLotStatistics`, `handleSyncExchangeRate`...
   - Toàn bộ component và JSX hiện tại được đóng gói trọn vẹn vào khối `Expert Mode`.
2. **Nguyên tắc "State Persistence" (Lưu trữ trạng thái hiển thị)**:
   - Sử dụng `localStorage.getItem('core_ccp_view_mode')` để ghi nhớ chế độ người dùng lựa chọn (`USER` hoặc `EXPERT`).
   - Mặc định lần đầu truy cập luôn là `USER` mode.
3. **Nguyên tắc "Action-Oriented Hierarchy" (Tập trung vào Hành động Nghiệp vụ)**:
   - Nhân viên vận hành chỉ cần trả lời 2 câu hỏi:
     1. *Dữ liệu đã đủ để chạy chưa?* $\rightarrow$ Thể hiện bằng thẻ trạng thái Xanh / Vàng.
     2. *Kết quả có khớp không?* $\rightarrow$ Thể hiện bằng thẻ kết quả Khớp 100% / Lệch bao nhiêu tài khoản.

---

## 3. THIẾT KẾ CHI TIẾT MÀN HÌNH 1: ĐỐI SOÁT KÝ QUỸ & EOD (SUB-TAB 1)

### 3.1. Phân tích So sánh Thành phần (Before vs After)

| Thành phần UI | Chế độ Kỹ thuật (Hiện tại - Expert Mode) | Chế độ Vận hành Mới (User Mode) | Lý do tinh gọn |
| :--- | :--- | :--- | :--- |
| **Thanh Tiêu đề & Nút bấm** | 3 nút: "Tải Báo Cáo CoreCCP", "Kiểm Tra Đối Chiếu CCP", "Log Modal" | Chỉ 1 nút chính: **"Chạy Đối Soát EOD CoreCCP"** (Kèm nút phụ "Tải file tự động" nếu thiếu file) | Trực ca không cần quan tâm Log Modal; gom 2 nút chạy thành 1 quy trình tuần tự. |
| **Bảng 25 Checkbox Báo cáo** | Chiếm 50% màn hình, hiển thị 25 ô checkbox chọn từng file | **ẨN HOÀN TOÀN** (Được chuyển vào Expert Mode) | Trực ca không chọn file thủ công. Hệ thống tự động chọn bộ 4 file chuẩn hoặc 25 file backup. |
| **Khối Trạng thái File Backup** | 4 thẻ hình chữ nhật to với badge "CHƯA CÓ" màu đỏ | Gom thành **Thanh trạng thái 4 tệp gọn gàng** (QLTTKGD, EOD, NR, TTTT) với icon tích xanh khi đủ file | Tiết kiệm 60% diện tích, trực quan, không gây cảm giác cảnh báo giả khi chưa tới giờ lấy file. |
| **4 Thẻ Thống kê KPI** | Tổng TK (0), File sẵn sàng (1/4), TK âm (0), Lệch EOD (0) | Giữ lại nhưng tái cấu trúc màu sắc và thứ tự: **Tình trạng Số dư EOD**, **Tài khoản Âm Ký Quỹ**, **Tổng số TK** | Đưa các chỉ số rủi ro quan trọng nhất lên đầu mắt người xem. |
| **Bảng Kết quả Đối chiếu** | Bảng chi tiết chênh lệch | Hiển thị Banner lớn **"Số Dư Khớp Hoàn Toàn 100%"** nếu không lệch; chỉ bung bảng chi tiết khi có lệch $\ge 1,000$ đ | Giúp trực ca an tâm ký chốt ca ngay lập tức mà không phải đọc bảng rỗng. |

### 3.2. Sơ đồ Bố cục Giao diện User Mode (Sub-tab 1)

```
+-------------------------------------------------------------------------------------------------------+
|  [VNCLEAR] ĐỐI SOÁT SỐ DƯ & KÝ QUỸ CORECCP cuối ngày (EOD)             [ Chế độ: VẬN HÀNH | Kỹ thuật ]|
|  Tự động đối chiếu số dư tài khoản QLTKGD CoreCCP với báo cáo EOD Balance của M-System.               |
+-------------------------------------------------------------------------------------------------------+
|                                                                                                       |
|  [ THẺ KPI 1: TÌNH TRẠNG SỐ DƯ ]    [ THẺ KPI 2: ÂM KÝ QUỸ (IMR) ]    [ THẺ KPI 3: TIẾN TRÌNH FILE ]  |
|  KHỚP HOÀN TOÀN 100%                 AN TOÀN (0 TÀI KHOẢN)             ĐÃ CÓ ĐỦ 4/4 TỆP BÁO CÁO        |
|  Không phát sinh chênh lệch EOD      Không có tài khoản âm ký quỹ      QLTTKGD, EOD, NR, TTTT          |
|                                                                                                       |
+-------------------------------------------------------------------------------------------------------+
|  QUY TRÌNH THỰC HIỆN CA TRỰC:                                                                         |
|                                                                                                       |
|  [ Bước 1: Kiểm tra tệp ]               [ Bước 2: Đối chiếu số dư ]                                   |
|  (v) QLTTKGD  (v) EOD                   [  ▶  CHẠY ĐỐI SOÁT EOD CORECCP  ]  (Nút xanh dương lớn)      |
|  (v) NR       (v) TTTT                                                                                |
|  [ Tải lại 4 tệp ] (nếu cần)            Trạng thái: Đã hoàn tất lúc 17:05:20                          |
+-------------------------------------------------------------------------------------------------------+
|  KẾT QUẢ ĐỐI SOÁT CHI TIẾT:                                                                           |
|                                                                                                       |
|  [ BANNER XANH LÁ: TẤT CẢ SỐ DƯ ĐỀU KHỚP 100% VỚI CÔNG THỨC CHUẨN ]                                   |
|  (Nếu có tài khoản lệch -> Tự động bung Bảng danh sách tài khoản kèm số tiền lệch để xử lý)           |
+-------------------------------------------------------------------------------------------------------+
```

---

## 4. THIẾT KẾ CHI TIẾT MÀN HÌNH 2: THỐNG KÊ SỐ LOT & GTGD (SUB-TAB 2)

### 4.1. Bản Chất Kỹ Thuật & Phạm Vi Dữ Liệu Thực Tế (Kiểm Chứng Mã Nguồn)

Trước khi chuẩn hóa giao diện, cần làm rõ **bản chất xử lý thực tế của hệ thống** (đã được kiểm chứng 100% qua code backend [ccp-lot-statistics.service.ts#L372-L585](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts#L372-L585)):

1. **Tổng hợp cả 2 Chỉ số Trọng yếu**:
   - **Số Lot giao dịch** (`totalSoLot`): Khối lượng hợp đồng khớp trong ngày của toàn bộ các phân hệ.
   - **Giá trị giao dịch quy đổi VND** (`totalGiaTri`): Tính toán theo hệ số nhân hợp đồng và ma trận tỷ giá ngày (`tyGiaUsed`).
   - Kèm trạng thái vị thế mở **TTM** (`ttmMua`, `ttmBan`), tất toán **TTTT** (`kltt`, lãi/lỗ VND), và thẩm định **4 loại lệnh** (`MKT, LMT, STP, STL`).
2. **Bao quát toàn bộ 5 Phân Hệ (Toàn Sàn, Không chỉ riêng ACM)**:
   - `acm`: Hàng hóa Nano ACM (`SI5CO`, `PL1NY`, `CP2CO`...).
   - `normal`: Hàng hóa tiêu chuẩn (Standard Futures).
   - `spread`: Hợp đồng chênh lệch giá (Spread).
   - `lme`: Kim loại sàn LME.
   - `options`: Hợp đồng quyền chọn.
   - `bacThoi`: Tài khoản Bạc thỏi (-M) được tách riêng lưu audit standby.
3. **Ghi đồng bộ vào 10 File Excel Lũy Kế**:
   - Nhóm ACM: File Số Lot ACM (`pathAcmLot`) & GTGD ACM (`pathAcmGtgd`).
   - Nhóm Lot phân hệ: Lot Thường (`pathNormalLot`), Spread (`pathSpreadLot`), LME (`pathLmeLot`), Options (`pathOptionsLot`).
   - Nhóm GTGD phân hệ: GTGD Thường (`pathGtgdNormal`), Spread (`pathGtgdSpread`), LME (`pathGtgdLme`), Options (`pathGtgdOptions`).
   - Nhóm DSGD Raw: File DSGD lũy kế tháng (`pathDsgdCumulative`).
   - Có cơ chế **Zero-Lot Bypass** tự động bỏ qua các phân hệ không có giao dịch trong ngày để tránh ghi đè số 0 làm hỏng công thức file Excel.

---

### 4.2. Chuẩn Hóa Nhãn Giao Diện (UI Text Normalization)

Loại bỏ toàn bộ các nhãn cũ mang tính lịch sử (chỉ nhắc đến ACM) để phản ánh đúng bản chất toàn sàn:
- **Tiêu đề phân hệ**: Đổi từ `Thống Kê Số Lot & GTGD ACM` $\rightarrow$ **`Thống Kê Số Lot & Giá Trị Giao Dịch CoreCCP (VNCLEAR)`**.
- **Card KPI 1**: Đổi từ `Tổng Số Lot ACM (DSGD)` $\rightarrow$ **`Tổng Số Lot Toàn Thị Trường`** (kèm badge breakdown 5 phân hệ).
- **Hộp cấu hình**: Đổi từ `Cấu Hình Đường Dẫn File Lũy Kế ACM Excel` $\rightarrow$ **`Cấu Hình Đường Dẫn 10 File Lũy Kế Excel CoreCCP`**.
- **Nút hành động**: Đổi từ `Tổng Hợp Vào Sổ Lũy Kế ACM` $\rightarrow$ **`Tổng Hợp Dữ Liệu Ngày (Lot & GTGD Toàn Sàn)`**.
- **Nhật ký**: Đổi từ `Nhật Ký Ghi File Lũy Kế ACM` $\rightarrow$ **`Nhật Ký Ghi Các File Lũy Kế Excel CoreCCP`**.

---

### 4.3. Phân tích So sánh Thành phần (Before vs After)

| Thành phần UI | Chế độ Kỹ thuật (Hiện tại - Expert Mode) | Chế độ Vận hành Mới (User Mode) | Lý do tinh gọn & Nâng cấp |
| :--- | :--- | :--- | :--- |
| **Thanh Toolbar Nguồn Dữ Liệu** | 3 nút tab con: Tự động quét, Tải file thủ công, Lấy tỷ giá mới nhất | **Tự động 100%**: Mặc định dùng "Tự động quét thư mục ngày" | 99% ca trực dùng thư mục ngày tự động, không bắt user chọn qua lại giữa 3 chế độ. |
| **Đường Dẫn Mount Linux Thô** | Dòng chữ dài `/mnt/qlgd-it/... [Sửa / Đổi Thư Mục]` | Thay bằng **Tag trạng thái thư mục ngắn gọn**: `Thư mục ngày: 23/09 (Sẵn sàng)` | Trực ca không cần thấy cấu trúc thư mục Linux phức tạp. |
| **Hàng 4 Thẻ File Ngày** | 4 thẻ lớn chiếm diện tích | Gom thành cụm **4 File Indicator nhỏ gọn**: DSGD (v), TTM (v), TTTT (v), Tỷ giá (26,000 đ) | Giữ nguyên trạng thái nhận diện file nhưng tiết kiệm 70% diện tích. |
| **Quy trình Hành động Chính** | Nhiều nút rời rạc: "Hướng Dẫn & Công Thức", "Đường Dẫn File Lũy Kế", "Tổng Hợp Từ Thư Mục Backup", "Ghi Vào Các File Lũy Kế" | **2 Bước Rõ Ràng (Hoặc 1-Click Nổi Bật)**:<br>1. `[ ▶ TỔNG HỢP LOT & GTGD NGÀY ]`<br>2. `[ 💾 GHI VÀO 10 FILE EXCEL LŨY KẾ ]` | Tách bạch bước kiểm tra số liệu trước khi chốt ghi vào sổ Excel kế toán. |
| **Thẻ Thống kê KPI** | Rải rác, nhãn cũ ghi "ACM" | **Bộ 4 Thẻ KPI Chuẩn Doanh Nghiệp**:<br>1. **Tổng Số Lot Toàn Sàn** (kèm chi tiết 5 phân hệ)<br>2. **Tổng Giá Trị Giao Dịch (VND)**<br>3. **Vị Thế TTM / TTTT & Đủ 4 Loại Lệnh**<br>4. **Trạng Thái Ghi 10 File Excel Lũy Kế** | Hiển thị đầy đủ bức tranh thị trường cho Trực ca & Lãnh đạo duyệt ca. |
| **Bảng Kết quả Chi tiết** | Bảng TVKD kèm bộ lọc phức tạp | Giữ bảng TVKD với **chế độ xem 2 tab**: Theo Thành Viên (TVKD) và Theo Phân Hệ Hàng Hóa (ACM, Standard, Spread, LME, Options) | Giúp đối chiếu nhanh cả theo đơn vị giao dịch và theo nhóm sản phẩm. |

---

### 4.4. Sơ đồ Bố cục Giao diện User Mode (Sub-tab 2)

```
+-----------------------------------------------------------------------------------------------------------------------+
|  [VNCLEAR] THỐNG KÊ SỐ LOT & GIÁ TRỊ GIAO DỊCH CORECCP (TOÀN SÀN)                       [ Chế độ: VẬN HÀNH | Kỹ thuật ]|
|  Tự động tổng hợp toàn bộ giao dịch (ACM, Thường, Spread, LME, Options) và cập nhật 10 sổ lũy kế Excel.              |
+-----------------------------------------------------------------------------------------------------------------------+
|  NGUỒN DỮ LIỆU PHIÊN: [ 23/09/2026 ]  •  Thư mục: Backup CCP/Futures/2026/T09.2026/23.09 (Sẵn sàng)                   |
|                                                                                                                       |
|  [v] DSGD (11.4 KB)     [v] TTM (20.6 KB)     [v] TTTT (9.5 KB)     [v] Tỷ giá: 1 USD = 26,000 đ                      |
|                                                                                                                       |
|  QUY TRÌNH XỬ LÝ CA TRỰC:                                                                                             |
|  [ Bước 1: ▶ TỔNG HỢP LOT & GTGD ] (Xanh lá)   ──▶   [ Bước 2: 💾 GHI VÀO 10 FILE LŨY KẾ EXCEL ] (Xanh dương)         |
+-----------------------------------------------------------------------------------------------------------------------+
|                                                                                                                       |
|  [ TỔNG SỐ LOT TOÀN SÀN ]       [ TỔNG GIÁ TRỊ GIAO DỊCH ]       [ VỊ THẾ & 4 LOẠI LỆNH ]      [ TRẠNG THÁI GHI SỔ ]  |
|  1,425 Lot                      385,420,000,000 VND              TTM: 520 Mua | 480 Bán        ĐÃ GHI ĐỦ 10/10 FILE   |
|  • Thường: 950   • ACM: 320     Tỷ giá: 1 USD = 26,000 đ         TTTT: 425 Lot (Lãi 120 tr)    Cập nhật lúc 17:15:00  |
|  • Spread: 110   • LME: 45      Phân bổ 35 TVKD                  (v) ĐỦ 4 LOẠI LỆNH CHUẨN      Zero-Lot Bypass: Bật   |
|                                                                                                                       |
+-----------------------------------------------------------------------------------------------------------------------+
|  XEM CHI TIẾT:  [ (•) Theo Thành Viên Kinh Doanh (TVKD) ]    [ ( ) Theo Phân Hệ Sản Phẩm / Hàng Hóa ]                 |
|                                                                                                                       |
|  [ Ô tìm kiếm TVKD / Mã TV ]                                                       [ Xuất Excel Báo Cáo ]             |
|  +--------+----------------------+----------+---------------------+-------------+-------------+---------------------+ |
|  | Mã TV  | Tên Thành Viên       |  Số Lot  |  Giá Trị GD (VND)   |  TTM (Mua)  |  TTM (Bán)  |  4 Loại Lệnh        | |
|  +--------+----------------------+----------+---------------------+-------------+-------------+---------------------+ |
|  | 001    | CÔNG TY GIAO DỊCH A  |      320 |     85,200,000,000  |         110 |          90 | (v) Đủ 4 loại       | |
|  | 003    | CÔNG TY GIAO DỊCH B  |      215 |     58,100,000,000  |          80 |          75 | (v) Đủ 4 loại       | |
|  +--------+----------------------+----------+---------------------+-------------+-------------+---------------------+ |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

## 5. THIẾT KẾ KỸ THUẬT & CƠ CHẾ CHUYỂN ĐỔI CHẾ ĐỘ (TOGGLE SWITCH)

### 5.1. Vị trí & Giao diện Nút chuyển đổi (View Mode Switch)
Nút chuyển đổi được đặt cố định ở góc trên bên phải của Header phân hệ CoreCCP (ngay cạnh các nút điều hướng), sử dụng thiết kế dạng **Segmented Button**:

```tsx
<div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-input)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
  <button
    type="button"
    onClick={() => setViewMode('USER')}
    style={{
      padding: '5px 12px',
      fontSize: '0.76rem',
      fontWeight: 700,
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: viewMode === 'USER' ? '#10b981' : 'transparent',
      color: viewMode === 'USER' ? '#ffffff' : 'var(--text-secondary)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}
  >
    <UserCheck size={13} />
    <span>Vận Hành</span>
  </button>

  <button
    type="button"
    onClick={() => setViewMode('EXPERT')}
    style={{
      padding: '5px 12px',
      fontSize: '0.76rem',
      fontWeight: 700,
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: viewMode === 'EXPERT' ? '#3b82f6' : 'transparent',
      color: viewMode === 'EXPERT' ? '#ffffff' : 'var(--text-secondary)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}
  >
    <Wrench size={13} />
    <span>Kỹ Thuật (IT)</span>
  </button>
</div>
```

### 5.2. Nguyên lý Hoạt động Kỹ thuật (Architecture)
1. **Quản lý State ở Top Level**:
   ```typescript
   const [viewMode, setViewMode] = useState<'USER' | 'EXPERT'>(() => {
     if (typeof window !== 'undefined') {
       return (localStorage.getItem('core_ccp_view_mode') as 'USER' | 'EXPERT') || 'USER';
     }
     return 'USER';
   });

   const handleToggleViewMode = (mode: 'USER' | 'EXPERT') => {
     setViewMode(mode);
     if (typeof window !== 'undefined') {
       localStorage.setItem('core_ccp_view_mode', mode);
     }
   };
   ```
2. **Cấu trúc Điều kiện Render (Conditional Rendering)**:
   - Trong `CoreCcpBackupSection.tsx`:
     ```tsx
     {viewMode === 'USER' ? (
       <CoreCcpUserEodView {...props} onSwitchToExpert={() => handleToggleViewMode('EXPERT')} />
     ) : (
       <CoreCcpExpertEodView {...props} /> // Giữ nguyên 100% code hiện tại
     )}
     ```
   - Trong `CcpLotStatisticsSection.tsx`:
     ```tsx
     {viewMode === 'USER' ? (
       <CcpLotUserView {...props} onSwitchToExpert={() => handleToggleViewMode('EXPERT')} />
     ) : (
       <CcpLotExpertView {...props} /> // Giữ nguyên 100% code hiện tại
     )}
     ```

---

## 6. DANH SÁCH FILE VÀ KẾ HOẠCH TRIỂN KHAI

### 6.1. Danh sách file tác động
1. **Frontend Components**:
   - [CoreCcpBackupSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CoreCcpBackupSection.tsx): Bổ sung `viewMode` state, nút chuyển đổi chế độ và giao diện `User Mode` cho Sub-tab 1. Toàn bộ code cũ được bảo lưu 100% trong nhánh `EXPERT`.
   - [CcpLotStatisticsSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx): Tích hợp giao diện `User Mode` tinh gọn cho Sub-tab 2 (tóm tắt KPI, ẩn mount Linux, 1-Click Action). Toàn bộ code cũ được bảo lưu 100% trong nhánh `EXPERT`.
2. **Backend Services**:
   - **HOÀN TOÀN KHÔNG SỬA ĐỔI GÌ Ở BACKEND**: Toàn bộ API endpoint, logic tính toán, ghi file Excel lũy kế và đối soát giữ nguyên 100%, đảm bảo **Zero Backend Regression Risk**.

### 6.2. Kế hoạch Thực hiện Từng Bước
- **Bước 1**: Tạo các sub-component `User Mode` sạch sẽ, sử dụng chung state và function với component cha.
- **Bước 2**: Đóng gói phần JSX hiện tại vào nhánh `EXPERT` mà không thay đổi bất kỳ dòng logic nào.
- **Bước 3**: Kiểm tra chuyển đổi qua lại giữa 2 chế độ (`USER` $\leftrightarrow$ `EXPERT`), đảm bảo dữ liệu hiển thị đồng bộ 100%.
- **Bước 4**: Chạy `npx tsc --noEmit` ở Frontend và `npm run build` ở Backend đảm bảo không có lỗi biên dịch.
- **Bước 5**: Triển khai lên Ubuntu Server `10.0.0.26` và cập nhật nhật ký bàn giao.

---

## 7. BÀI TEST NGHIỆM THU (ACCEPTANCE CRITERIA)

| Tiêu chí | Kỳ vọng đạt được |
| :--- | :--- |
| **Chuẩn Hóa Nhãn Text & Báo Cáo** | Toàn bộ nhãn text hiển thị đúng bản chất **"Toàn Thị Trường / CoreCCP VNCLEAR"** (Số Lot & GTGD của cả 5 phân hệ), không còn gây hiểu nhầm chỉ xử lý mỗi ACM. |
| **Giao diện Mặc định (User Mode)** | Nhân viên trực ca mở màn hình ra: Giao diện sạch sẽ, không thấy 25 checkbox, không thấy đường dẫn Linux, chỉ thấy trạng thái sẵn sàng và nút bấm lớn để chạy. |
| **Tính Bảo toàn (Expert Mode)** | Khi bấm chuyển sang `Kỹ Thuật`: Toàn bộ 25 checkbox, log modal, selector chi tiết và các nút test của IT xuất hiện lại 100% như cũ. |
| **Tính Thống nhất Dữ liệu** | Chạy ở chế độ User hay Expert đều gọi chung 1 hàm logic, kết quả tính số lot, GTGD và đối soát EOD hoàn toàn giống nhau 100%. |
| **Ghi 10 File Lũy Kế Excel** | Khi kích hoạt ghi file, hệ thống ghi đầy đủ các phân hệ có giao dịch, áp dụng Zero-Lot Bypass tự động bỏ qua phân hệ 0 lot mà không gây lỗi. |
| **Lưu trạng thái** | F5 tải lại trang: Trình duyệt tự nhớ chế độ người dùng đã chọn trước đó (`localStorage`). |
| **Build & Lint** | `npx.cmd tsc --noEmit` đạt Exit Code 0, không có warning hay lỗi TypeScript. |
