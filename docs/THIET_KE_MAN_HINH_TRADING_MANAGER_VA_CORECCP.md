# TÀI LIỆU THIẾT KẾ MÀN HÌNH & HƯỚNG DẪN VẬN HÀNH NGHIỆP VỤ
## TRADING MANAGER — BÀN GIÁM SÁT ĐỐI SOÁT NGHIỆP VỤ (M-SYSTEM VS CQG & CORECCP)

---

## 1. TỔNG QUAN KIẾN TRÚC MÀN HÌNH (HIGH-LEVEL ARCHITECTURE)

Màn hình **Trading Manager** (`/trading-manager`) là trung tâm điều hành tập trung dành cho Nhân sự Vận hành Ca trực (Shift Operator) và Quản trị viên (Admin) của Sở Giao Dịch Hàng Hóa Việt Nam (MXV). 

Màn hình được thiết kế nhằm mục tiêu:
1. **Thay thế hoàn toàn ứng dụng Desktop C# cũ** (`operate-transaction-app`).
2. **Loại bỏ phụ thuộc vào macro VBA Excel thủ công**, chuyển đổi 100% sang xử lý tự động trên nền tảng Web + NestJS Backend.
3. **Giám sát thời gian thực toàn bộ chu trình phiên giao dịch**: Từ khớp lệnh trong phiên, chốt phiên Pre-EOD, kiểm tra đồng bộ số dư CQG/MS, quét ký quỹ âm, đến bóc tách báo cáo thanh toán bù trừ CoreCCP (VNCLEAR).

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        TRADING MANAGER — BÀN GIÁM SÁT ĐỐI SOÁT NGHIỆP VỤ                               │
├──────────────────────────┬──────────────────────────┬──────────────────────────┬───────────────────────┤
│  1. Check GD – EOD – Sync │ 2. Backup – Thống kê – GTT│ 3. Cấu hình – Đường dẫn  │ 4. Báo Cáo & CoreCCP  │
├──────────────────────────┴──────────────────────────┴──────────────────────────┴───────────────────────┤
│                                                                                                        │
│  [Tab 1: Trong phiên & Pre-EOD]     [Tab 2: Backup & GTT]      [Tab 3: Hạ tầng SFTP]    [Tab 4: VNCLEAR]│
│  - Đối chiếu KLGD (1h/lần)          - Backup 14 BC M-System    - Đường dẫn ổ đĩa backup - Đối soát EOD 4 TP│
│  - Pre-EOD 3 bên (MS-CQG-Straits)   - Backup 9 BC CQG          - Thư mục import/export  - Thống kê Lot/GTGD│
│  - Check EOD M-System               - Bảng đối chiếu GTT       - Cấu hình SFTP Client   - Kiểm tra 4 lệnh   │
│  - Check CQG Sync (Lệch > $100)     - Quét Ký quỹ IMR 4 nhóm   - Tham số đồng bộ        - Ghi file lũy kế  │
│                                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CHI TIẾT CẤU TRÚC 4 TAB CHỨC NĂNG

### TAB 1: CHECK GD – EOD – SYNC (GIÁM SÁT ĐỐI CHIẾU TRONG PHIÊN)

Tab này phục vụ trực tiếp cho các mốc thời gian trong ca trực:

| Tên chức năng | Tương tác UI | Tần suất / Mốc ca | Công thức / Tiêu chí nghiệm thu |
| :--- | :--- | :--- | :--- |
| **Check KLGD Trong Phiên** | Nút `[Kiểm tra KLGD]` | Định kỳ 60 phút/lần | So khớp số lot khớp lệnh giữa M-System (`DSGD`) và CQG (`FR.xlsx`). Lệch = 0 lot là ĐẠT. |
| **Check Pre-EOD 3 Bên** | Nút `[Kiểm tra Pre-EOD]` | Cuối phiên (trước EOD) | Đối chiếu 3 nguồn: M-System vs CQG vs Straits CSV (ACM). Tự động gộp file thô FR1+FR2, PS1+PS2. |
| **Check EOD M-System** | Nút `[Kiểm tra EOD MS]` | Sau khi MS chạy EOD | Đối chiếu số dư `QLTKGD` vs `eod.csv`. Ngưỡng lệch cho phép: < 1,000 VND. Tự quy đổi USD/JPY/MYR. |
| **Check CQG Sync** | Nút `[Kiểm tra CQG Sync]` | Sau phiên EOD | So khớp số dư ký quỹ CQG và MS: `(soDu + choDaoHan - laiLo) / tyGia`. Cảnh báo nếu lệch > $100. |
| **Bảng Lệch Giao Dịch Live** | 2 tab: Khớp lệnh / TTM | Tự động cập nhật | Liệt kê chi tiết từng lệnh lệch (Mã TK, Hợp đồng, Chiều Mua/Bán, Số lot, Giá). |

---

### TAB 2: BACKUP – THỐNG KÊ – GTT (1:1 VỚI WINFORMS C# CŨ)

Tái hiện hoàn chỉnh bố cục và hành vi của màn hình C# `FormMain.cs`:

1. **Khối Header Vận Hành**:
   - Chọn Ngày phiên hiện tại (`selectedDate`).
   - Cấu hình Backup định kỳ: Checkbox bật/tắt + số phút lặp lại (mặc định 240 phút).
   - Thời điểm Backup tự động (mặc định `04:30`).
   - Thời điểm chạy Thống kê tự động (mặc định `04:45`).
2. **Khối Báo Cáo M-System (14 loại báo cáo)**:
   - Cột 1: `NKTTHT`, `DSTKGD-Futures`, `DSTKGD-Spread`, `DSTKGD-LME`, `DSTKGD-ACM`, `TLQHSKQ`, `DSTrader`.
   - Cột 2: `DSLDK`, `DSLCK`, `DSLH`, `DSLK`, `DSGD`, `TTM`, `TTTT`.
   - Cột 3: `TTCDH`, `DSQLKQ`, `QLTKGD`, `QLTKGD âm KQ`, `NR`, `market truoc 6h`.
   - Checkbox `All` + Nút `[Backup MS]` (kết nối bot Playwright RPA).
3. **Khối Báo Cáo CQG (9 loại báo cáo)**:
   - Các cặp file thô: `FR1`, `FR2`, `PS1`, `PS2`, `OP1`, `OP2`, `OD1`, `OD2`, `AS`.
   - Checkbox `All` + Nút `[Backup CQG]`.
4. **Khối Giá Thanh Toán (GTT)**:
   - Nút `[Tạo file GTT]`: Tải giá thị trường từ M-System dựa trên các mã hợp đồng duy nhất trong `TTM`.
   - Nút `[Check GTT]`: Bật đối chiếu chênh lệch giá thanh toán giữa MS và CQG.
   - Nút `[Tạo file nhập GTT]`: Xuất file Excel định dạng chuẩn để import ngược vào M-System khi phát hiện sai lệch.
5. **Khối Kiểm Tra Ký Quỹ TKGD (Check IMR - 4 Nhóm Điều Kiện)**:
   - *Nhóm 1*: Tài khoản có Lãi/Lỗ dự kiến nhưng không có vị thế mở TTM.
   - *Nhóm 2*: Tài khoản không có TTM và không có lệnh chờ nhưng Ký quỹ tạm tính $\neq 0$.
   - *Nhóm 3*: Tài khoản có TTM, không có lệnh chờ nhưng Ký quỹ yêu cầu tạm tính $\neq$ Ký quỹ yêu cầu thực tế.
   - *Nhóm 4*: Tài khoản không có lệnh chờ nhưng Ký quỹ khả dụng tạm tính = Ký quỹ khả dụng thực tế.

---

### TAB 3: CẤU HÌNH – ĐƯỜNG DẪN (SYSTEM & INFRASTRUCTURE PATHS)

Cho phép Quản trị viên thay đổi trực tiếp cấu hình lúc đang chạy (Runtime Config):
- **Đường dẫn Backup M-System**: Ví dụ `D:\Trading\Backup\MS\`
- **Đường dẫn Backup CQG**: Ví dụ `D:\Trading\Backup\CQG\`
- **Đường dẫn SFTP Client & Host**: Cấu hình tài khoản SFTP nhận file Straits ACM tự động.
- **Ngưỡng cảnh báo độ lệch**: Ngưỡng chênh lệch tiền tệ (VND/USD) trước khi kích hoạt còi báo động (Sound Beeper).

---

### TAB 4: BÁO CÁO & ĐỐI CHIẾU CORECCP (VNCLEAR)
*(Phân hệ mới thay thế toàn diện macro VBA và quản lý tài khoản bù trừ CoreCCP)*

Gồm 2 Sub-tab độc lập:

#### Sub-tab 4.1: Đối Soát Ký Quỹ & EOD (VNCLEAR)
- **Tải báo cáo CoreCCP tự động**: Kích hoạt bot tải 4 file từ web VNCLEAR (`QLTTTKGD`, `EOD`, `NR`, `TTTT`).
- **KPI Tổng Hợp**: Tổng số tài khoản CCP, Số file sẵn sàng (x/4), Số tài khoản âm ký quỹ, Số tài khoản lệch EOD.
- **Công thức đối chiếu 4 thành phần**:
  $$\text{Số dư EOD tính toán} = \text{Số dư đầu ngày (QLTTTKGD)} + \text{Nộp/Rút ròng (NR)} + \text{Lãi/Lỗ thực tế (TTTT)} - \text{Phí giao dịch}$$
- Bảng hiển thị chi tiết các tài khoản lệch và mã chênh lệch màu đỏ.

#### Sub-tab 4.2: Thống Kê Số Lot & GTGD CCP (Thay Thế Macro Excel)
Đây là tính năng trọng tâm chuyển đổi từ VBA sang Web:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  SUB-TAB 4.2: THỐNG KÊ SỐ LOT & GIÁ TRỊ GIAO DỊCH CORECCP (THAY THẾ MACRO)                             │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                        │
│  [1. Chọn Ngày GD]    [2. File DSGD (*)]    [3. File TTM]    [4. File TTTT]    [5. File Tỷ Giá]        │
│   2026-06-14           DSGD_14.6.xlsx        TTM_14.06.xlsx   TTTT_14.06.xlsx   Tỷ giá_14.06.xlsx      │
│                                                                                                        │
│  [ ▶ TỔNG HỢP SỐ LOT & GTGD ]             [ 💾 GHI VÀO FILE LŨY KẾ ACM ]     [ ⚙️ Đường Dẫn Lũy Kế ]   │
│                                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  KPI CARDS:                                                                                            │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┬─────────────────────────────┐  │
│  │ TỔNG SỐ LOT ACM     │ TỔNG GIÁ TRỊ GD      │ VỊ THẾ MỞ (TTM)      │ KIỂM TRA 4 LOẠI LỆNH        │  │
│  │ 2 Lot                │ 336.441.600 đ        │ Mua: 0 | Bán: 1      │ ⚠️ 1 TVKD THIẾU LỆNH        │  │
│  └──────────────────────┴──────────────────────┴──────────────────────┴─────────────────────────────┘  │
│                                                                                                        │
│  CHẾ ĐỘ XEM: [Chi Tiết Theo TVKD (60+)]  |  [Phân Bổ Theo Hàng Hóa (SI5CO, CP2CO, PL1NY)]              │
│                                                                                                        │
│  BẢNG DỮ LIỆU CHI TIẾT:                                                                                │
│  ┌────────┬──────────────┬────────┬────────────────┬─────────┬─────────┬──────┬─────────────────────┐  │
│  │ TVKD   │ Tên TV       │ Số Lot │ GTGD (VND)     │ TTM Mua │ TTM Bán │ KLTT │ 4 Loại Lệnh         │  │
│  ├────────┼──────────────┼────────┼────────────────┼─────────┼─────────┼──────┼─────────────────────┤  │
│  │ 041    │ TVKD 041     │ 2      │ 336.441.600 đ  │ 0       │ 1       │ 2    │ [THIẾU: LMT/STP/STL]│  │
│  └────────┴──────────────┴────────┴────────────────┴─────────┴─────────┴──────┴─────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. QUY TRÌNH VẬN HÀNH 4 BƯỚC CHO USER (STEP-BY-STEP WORKFLOW)

### Bước 1: Chuẩn bị tệp dữ liệu
- Nhân sự ca trực truy cập thư mục backup hoặc nhận file từ hệ thống CoreCCP:
  - Bắt buộc: File Khớp lệnh `DSGD_*.xlsx` (hoặc `.csv`).
  - Tùy chọn (để tổng hợp đủ chỉ số): File Trạng thái mở `TTM_*.xlsx`, File Tất toán `TTTT_*.xlsx`, và File `Tỷ giá_*.xlsx`.
- *Lưu ý*: Nếu không có file tỷ giá, hệ thống sẽ tự động dùng tỷ giá mặc định từ cấu hình API.

### Bước 2: Tải file lên giao diện & Kiểm tra tính toán
1. Mở màn hình `/trading-manager` $\rightarrow$ Chọn Tab **"Báo Cáo & Đối Chiếu CoreCCP"** $\rightarrow$ Chọn Sub-tab **"2. Thống Kê Số Lot & GTGD (Thay Thế Macro)"**.
2. Chọn Ngày phiên giao dịch tương ứng.
3. Kéo thả hoặc click chọn từng file vào 4 ô picker tương ứng.
4. Bấm nút **`[Tổng Hợp Số Lot & GTGD]`**.
5. Trong vòng **< 50ms**, kết quả sẽ hiển thị tức thì trên các KPI cards và bảng dữ liệu.

### Bước 3: Thẩm định Đúng/Sai & Kiểm tra 4 Loại Lệnh
1. **Quan sát Card "Kiểm Tra 4 Loại Lệnh"**:
   - Nếu hiển thị **`ĐỦ 4 LOẠI LỆNH`** (màu xanh lá): Tất cả các TVKD có giao dịch đều đã phát sinh đầy đủ `MKT`, `LMT`, `STP`, `STL`.
   - Nếu hiển thị **`x TVKD THIẾU LỆNH`** (màu đỏ): Bật checkbox *"Thiếu loại lệnh"* ở thanh công cụ để lọc ra danh sách thành viên và xem chi tiết loại lệnh còn thiếu.
2. **Kiểm tra Phân Bổ Hàng Hóa**:
   - Chuyển sang nút *"Phân Bổ Theo Hàng Hóa"* để đối chiếu số lot và giá trị của từng mã `SI5CO` (Bạc Nano), `CP2CO` (Đồng Nano), `PL1NY` (Bạch kim Nano).

### Bước 4: Ghi kết quả vào File Lũy Kế Năm (ACM Accumulator)
1. Bấm nút **`[Ghi Vào File Lũy Kế ACM]`**.
2. Hệ thống sẽ:
   - Tự động tạo bản sao lưu an toàn tại thư mục `Backup_Snapshots/` (tránh rủi ro ghi đè hỏng file).
   - Tự động nhận diện sheet tháng (ví dụ `T06.2026`) hoặc tự clone sheet mới nếu sang tháng mới.
   - Điền số liệu khớp lệnh vào đúng các cột: Cột 6-8 (Khối CCP), Cột 11-67 (Khối từng TVKD), Cột 70-72 (Khối Hàng hóa).
   - Ghi cộng dồn giá trị vào file lũy kế GTGD tháng.
3. Quan sát khung log màu xanh xuất hiện bên dưới nút bấm để xác nhận thông báo hoàn tất.

---

## 4. BẢNG QUY CÁCH HÀNG HÓA & CÔNG THỨC TOÁN HỌC

Hệ thống tính toán Giá Trị Giao Dịch theo công thức chuẩn đã được kiểm chứng chéo với file macro cũ:

$$\mathbf{\text{GTGD (VND)}} = \text{Khối Lượng Khớp (Lot)} \times \text{Giá Khớp Trung Bình} \times \mathbf{\text{Hệ Số Quy Đổi}} \times \mathbf{\text{Tỷ Giá USD}}$$

| Mã Hợp Đồng Mẫu | 5 Ký Tự Đầu (Mã HH) | Tên Hàng Hóa | Hệ Số Quy Cách | Đơn Vị Ngoại Tệ | Tỷ Giá Áp Dụng | Ví dụ Tính Toán (Giá = 6.49 USD, 1 Lot) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `CP2COZ26` | **`CP2CO`** | Đồng Nano | **1,000** | USD / lbs | Tỷ giá USD ngày | $1 \times 6.49 \times 1,000 \times 25,920 = \mathbf{168,220,800\text{ đ}}$ |
| `SI5COZ26` | **`SI5CO`** | Bạc Nano | **100** | USD / oz | Tỷ giá USD ngày | $1 \times 30.50 \times 100 \times 25,920 = \mathbf{79,056,000\text{ đ}}$ |
| `PL1NYZ26` | **`PL1NY`** | Bạch Kim Nano | **5** | USD / oz | Tỷ giá USD ngày | $1 \times 980.0 \times 5 \times 25,920 = \mathbf{127,008,000\text{ đ}}$ |

---

## 5. CÁC TÌNH HUỐNG NGOẠI LỆ & CÁCH XỬ LÝ (TROUBLESHOOTING)

| Hiện tượng | Nguyên nhân | Hướng xử lý |
| :--- | :--- | :--- |
| **Báo lỗi "Thiếu tệp DSGD CoreCCP"** | Chưa chọn file DSGD | File DSGD là file bắt buộc duy nhất. Hãy chọn tệp có tên dạng `DSGD_*.xlsx` trước khi bấm Tổng hợp. |
| **TVKD hiển thị tag `[THIẾU: LMT/STP/STL]`** | Thành viên trong phiên chỉ đặt 1-2 loại lệnh | Đây là cảnh báo nghiệp vụ thông thường, thông báo cho nhân sự ca trực biết thành viên chưa đặt đủ 4 loại lệnh theo quy chế giám sát. |
| **Báo lỗi "File lũy kế không tồn tại" khi bấm Ghi** | Đường dẫn cấu hình chưa trỏ tới file Excel thực tế | Bấm nút *"Đường Dẫn File Lũy Kế"*, kiểm tra lại đường dẫn ổ mạng `M:\...\Thong ke so lot giao dich ACM 2025.xlsx` và lưu lại. |
| **Tỷ giá hiển thị mặc định 25,920** | Không tải lên file `Tỷ giá_*.xlsx` | Nếu không có file tỷ giá riêng, hệ thống tự động sử dụng tỷ giá cấu hình chuẩn trong hệ thống để bảo đảm tiến độ ca trực. |
