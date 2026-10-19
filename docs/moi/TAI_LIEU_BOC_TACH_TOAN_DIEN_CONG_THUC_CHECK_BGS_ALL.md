# TÀI LIỆU BÓC TÁCH TOÀN DIỆN CÔNG THỨC & LOGIC NGHIỆP VỤ FILE `Check BGS All.xlsm`
**Phòng Quản lý Giao dịch & Ban Giám Sát - Sở Giao dịch Hàng hóa Việt Nam (MXV)**

---

## 1. TỔNG QUAN HỆ THỐNG VÀ FILE BÁO CÁO

- **Tên File Gốc**: `Check BGS All.xlsm`
- **Đường Dẫn Trong Dự Án**: [backend/src/modules/trading-ops/excels/Check BGS All.xlsm](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/excels/Check%20BGS%20All.xlsm)
- **Dung Lượng**: ~5.98 MB | **Tổng Số Sheet**: 10 sheets | **Tổng Số VBA Modules**: 2 module nghiệp vụ
- **Mục Đích Nghiệp Vụ Cốt Lõi**:
  Bảng tính đối soát song song và tổng hợp báo cáo thời gian thực (Real-time & EOD) giữa 2 phân hệ lõi:
  1. **M-System (MS)**: Hệ thống giao dịch khớp lệnh truyền thống của MXV kết nối CQG & LME.
  2. **CoreCCP (CCP)**: Hệ thống bù trừ thanh toán trung tâm thế hệ mới của MXV.
  Bảng tính tự động gom dữ liệu, phân kỳ theo 4 chu kỳ phiên (Đầu phiên, Phiên Á, Phiên Âu, Phiên Mỹ), đếm số tài khoản duy nhất giao dịch (TKGD), tính khối lượng khớp (KLGD), thống kê trạng thái mở (TTM) kèm lãi lỗ dự kiến (Unrealized PnL), thống kê trạng thái tất toán (TTTT) kèm lãi lỗ thực tế (Realized PnL).

### Danh Mục 10 Sheets Trong File:
| STT | Tên Sheet | Số Dòng (MaxRow) | Số Cột (MaxCol) | Vai Trò Nghiệp Vụ |
| :---: | :--- | :---: | :---: | :--- |
| **1** | **`Tổng hợp KLGD`** | 34 | 25 | **Dashboard BGS/BGĐ**: Khối lượng 4 phiên, số TKGD, mẫu tin nhắn báo cáo. |
| **2** | **`Thống kê TTM`** | 46 | 20 | **Thống Kê Vị Thế Mở**: Tổng vị thế mở, % Mua / % Bán, Lãi lỗ dự kiến (VND). |
| **3** | **`Thống kê TTTT`** | 46 | 13 | **Thống Kê Tất Toán**: Khối lượng tất toán, Lãi lỗ thực tế (VND), Ngày mở nhiều nhất. |
| **4** | **`DSGD MS`** | 17,793 | 42 | **Dữ Liệu Thô Khớp Lệnh MS**: 29 cột thô + 13 cột helper phân tách logic. |
| **5** | **`DSGD CCP`** | 4,000 | 39 | **Dữ Liệu Thô Khớp Lệnh CCP**: 27 cột thô + 12 cột helper phân tách logic. |
| **6** | **`TTM MS`** | 10,638 | 27 | **Dữ Liệu Thô Trạng Thái Mở MS**: 26 cột thô + 1 cột helper tách mã hàng. |
| **7** | **`TTM CCP`** | 4,848 | 25 | **Dữ Liệu Thô Trạng Thái Mở CCP**: 24 cột thô + 1 cột helper tách mã hàng. |
| **8** | **`TTTT MS`** | 20,556 | 38 | **Dữ Liệu Thô Tất Toán MS**: 28 cột thô + 10 cột helper ngày vào lệnh. |
| **9** | **`TTTT CCP`** | 5,000 | 40 | **Dữ Liệu Thô Tất Toán CCP**: 30 cột thô + 10 cột helper ngày vào lệnh. |
| **10** | **`Mã HH`** | 215 | 3 | **Từ Điển Danh Mục Master**: Ánh xạ mã hợp đồng thô sang mã hàng & tên tiếng Việt. |

---

## 2. BÓC TÁCH TUẦN TỰ SHEET 1: `Tổng hợp KLGD` (DASHBOARD BÁO CÁO BGS)

Sheet này là đầu mối thông tin cung cấp các số liệu cho Ban Giám Đốc và Ban Giám Sát.

### 2.1. Công thức Xác định Ngày Giao Dịch & Mùa (Daylight Saving Time - Giờ Mùa Hè/Đông)
- **Tọa độ**: Ô `Y1`
- **Công thức Excel Gốc**:
```excel
=INT(NOW() - IF(AND(NOW()>=DATE(YEAR(NOW()),3,1)+14-WEEKDAY(DATE(YEAR(NOW()),3,1),2)+2/24, NOW()<DATE(YEAR(NOW()),11,1)+7-WEEKDAY(DATE(YEAR(NOW()),11,1),2)+2/24), 5/24, 6/24))
```
- **Giải Thích Logic Toán Học**:
  - Sở giao dịch Mỹ (CME, ICE US) áp dụng Daylight Saving Time (DST):
    - **Bắt đầu giờ Mùa Hè**: Chủ nhật thứ 2 của tháng 3 (lúc 02:00 sáng). Công thức Excel: `DATE(YEAR(NOW()),3,1) + 14 - WEEKDAY(DATE(YEAR(NOW()),3,1), 2) + 2/24`.
    - **Bắt đầu giờ Mùa Đông**: Chủ nhật đầu tiên của tháng 11 (lúc 02:00 sáng). Công thức Excel: `DATE(YEAR(NOW()),11,1) + 7 - WEEKDAY(DATE(YEAR(NOW()),11,1), 2) + 2/24`.
  - **Quy tắc phiên**:
    - Nếu là **Giờ Mùa Hè**: Phiên giao dịch quốc tế bắt đầu từ **05:00:00 sáng Việt Nam** $\rightarrow$ trừ đi offset `5/24` ngày.
    - Nếu là **Giờ Mùa Đông**: Phiên giao dịch quốc tế bắt đầu từ **06:00:00 sáng Việt Nam** $\rightarrow$ trừ đi offset `6/24` ngày.
  - Hàm `INT(...)` lấy phần nguyên của ngày để xác định chính xác **Ngày Phiên Giao Dịch Hiện Tại (Trading Date)**.

---

### 2.2. Bảng Ma Trận 4 Chu Kỳ Phiên x 2 Nền Tảng (Dải `B1:E9`)
Bảng này đối soát khối lượng khớp (Lot) và số tài khoản có phát sinh giao dịch (TKGD) lũy kế qua từng mốc:

| Dòng | Nền tảng (`Col B`) | Chu kỳ phiên (`Col C`) | Công thức Khối Lượng Giao Dịch (Lot) (`Col D`) | Công thức Đếm Số TKGD Duy Nhất (`Col E`) |
| :---: | :---: | :---: | :--- | :--- |
| **Row 2** | `ACM` | `Đầu phiên` | `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AJ:AJ, B2, 'DSGD MS'!AG:AG, C2) + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AG:AG, B2, 'DSGD CCP'!AE:AE, C2)` | *Mảng LET (đếm UNIQUE TK trong Đầu phiên)* |
| **Row 3** | `ACM` | `Hết phiên Á` | `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AJ:AJ, B3, 'DSGD MS'!AG:AG, C3) + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AG:AG, B3, 'DSGD CCP'!AE:AE, C3) + D2` | *Mảng LET (đếm UNIQUE TK lũy kế Đầu phiên + Phiên Á)* |
| **Row 4** | `ACM` | `Hết phiên Âu` | `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AJ:AJ, B4, 'DSGD MS'!AG:AG, C4) + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AG:AG, B4, 'DSGD CCP'!AE:AE, C4) + D3` | *Mảng LET (đếm UNIQUE TK lũy kế Đầu phiên + Á + Âu)* |
| **Row 5** | `ACM` | `Hết phiên Mỹ` | `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AJ:AJ, B5, 'DSGD MS'!AG:AG, C5) + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AG:AG, B5, 'DSGD CCP'!AE:AE, C5) + D4` | *Mảng LET (đếm UNIQUE TK lũy kế toàn phiên)* |
| **Row 6** | `CQG` | `Đầu phiên` | `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AJ:AJ, B6, 'DSGD MS'!AG:AG, C6) + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AG:AG, B6, 'DSGD CCP'!AE:AE, C6)` | *Mảng LET (đếm UNIQUE TK trong Đầu phiên)* |
| **Row 7** | `CQG` | `Hết phiên Á` | `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AJ:AJ, B7, 'DSGD MS'!AG:AG, C7) + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AG:AG, B7, 'DSGD CCP'!AE:AE, C7) + D6` | *Mảng LET (đếm UNIQUE TK lũy kế Đầu phiên + Phiên Á)* |
| **Row 8** | `CQG` | `Hết phiên Âu` | `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AJ:AJ, B8, 'DSGD MS'!AG:AG, C8) + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AG:AG, B8, 'DSGD CCP'!AE:AE, C8) + D7` | *Mảng LET (đếm UNIQUE TK lũy kế Đầu phiên + Á + Âu)* |
| **Row 9** | `CQG` | `Hết phiên Mỹ` | `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AJ:AJ, B9, 'DSGD MS'!AG:AG, C9) + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AG:AG, B9, 'DSGD CCP'!AE:AE, C9) + D8` | *Mảng LET (đếm UNIQUE TK lũy kế toàn phiên)* |

#### Chi Tiết Công Thức Mảng Đếm Số TKGD Duy Nhất Tại Cột E (Ví dụ ô `E3` - Hết phiên Á):
```excel
=LET(
  moc, LOWER(TRIM(C3)),
  sgd_val, LOWER(TRIM(B3)),

  ms_tk, 'DSGD MS'!$D$2:$D$20000,
  ms_sgd, LOWER(TRIM('DSGD MS'!$AJ$2:$AJ$20000)),
  ms_tg, LOWER(TRIM('DSGD MS'!$AG$2:$AG$20000)),

  ccp_tk, 'DSGD CCP'!$F$2:$F$5000,
  ccp_sgd, LOWER(TRIM('DSGD CCP'!$AG$2:$AG$5000)),
  ccp_tg, LOWER(TRIM('DSGD CCP'!$AE$2:$AE$5000)),

  cond_MS, (ms_sgd = sgd_val) * (ms_tk <> "") * SWITCH(moc,
    "đầu phiên", (ms_tg = "đầu phiên"),
    "hết phiên á", (ms_tg = "đầu phiên") + (ms_tg = "hết phiên á"),
    "hết phiên âu", (ms_tg = "đầu phiên") + (ms_tg = "hết phiên á") + (ms_tg = "hết phiên âu"),
    "hết phiên mỹ", (ms_tg = "đầu phiên") + (ms_tg = "hết phiên á") + (ms_tg = "hết phiên âu") + (ms_tg = "hết phiên mỹ"),
    (ms_tg = moc)
  ),

  cond_CCP, (ccp_sgd = sgd_val) * (ccp_tk <> "") * SWITCH(moc,
    "đầu phiên", (ccp_tg = "đầu phiên"),
    "hết phiên á", (ccp_tg = "đầu phiên") + (ccp_tg = "hết phiên á"),
    "hết phiên âu", (ccp_tg = "đầu phiên") + (ccp_tg = "hết phiên á") + (ccp_tg = "hết phiên âu"),
    "hết phiên mỹ", (ccp_tg = "đầu phiên") + (ccp_tg = "hết phiên á") + (ccp_tg = "hết phiên âu") + (ccp_tg = "hết phiên mỹ"),
    (ccp_tg = moc)
  ),

  IFERROR(ROWS(UNIQUE(FILTER(ms_tk, cond_MS))), 0) + IFERROR(ROWS(UNIQUE(FILTER(ccp_tk, cond_CCP))), 0)
)
```
- **Ý nghĩa**: Gom toàn bộ tài khoản khớp lệnh của MS (`Col D`) và CCP (`Col F`), lọc theo Nền tảng (ACM hay CQG), lọc theo thời gian lũy kế, dùng hàm `UNIQUE` loại bỏ các tài khoản trùng lặp và tính tổng số tài khoản phát sinh giao dịch.

---

### 2.3. Mẫu Tin Nhắn Báo Cáo Ban Giám Sát Tự Động (Dải `G1:H9`)
- **Mốc 16:00:00 (Hết phiên Á - Cell `H2`)**:
  - Số TKGD: `H7 = E3 + E7` (Số TK ACM hết Á + Số TK CQG hết Á)
  - Mẫu câu:
    ```excel
    ="Em xin phép báo cáo các anh khối lượng giao dịch tính tới 16:00 phiên "&TEXT($Y$1, "dd/mm/yyyy")&" ạ. Tổng khối lượng giao dịch đạt "&TEXT(SUM(D3,D7), "#,##0")&" lot, với Futures là "&TEXT(D7, "#,##0")&" lot và ACM là "&TEXT(D3, "#,##0")&" lot. "&CHAR(10)&"Tới thời điểm này có có "&TEXT(H7, "#,##0")&" tài khoản phát sinh giao dịch ạ."
    ```
- **Mốc 23:00:00 (Hết phiên Âu - Cell `H3`)**:
  - Số TKGD: `H8 = E4 + E8` (Số TK ACM hết Âu + Số TK CQG hết Âu)
  - Mẫu câu:
    ```excel
    ="Em xin phép báo cáo các anh khối lượng giao dịch tính tới 23:00 phiên "&TEXT($Y$1, "dd/mm/yyyy")&" ạ. Tổng khối lượng giao dịch đạt "&TEXT(SUM(D4,D8), "#,##0")&" lot, với Futures là "&TEXT(D8, "#,##0")&" lot và ACM là "&TEXT(D4, "#,##0")&" lot. "&CHAR(10)&"Tới thời điểm này có có "&TEXT(H8, "#,##0")&" tài khoản phát sinh giao dịch ạ."
    ```
- **Mốc Kết Phiên (Cell `H4`)**:
  - Số TKGD Kết phiên: `H9 = 'DSGD MS'!AN1 + 'DSGD CCP'!AK1` (Tổng số tài khoản unique toàn phiên từ 2 sheet thô)
  - Mẫu câu:
    ```excel
    ="Em xin phép báo cáo các anh khối lượng giao dịch phiên "&TEXT($Y$1, "dd/mm/yyyy")&" ạ. Tổng khối lượng giao dịch đạt "&TEXT(SUM(D5,D9), "#,##0")&" lot, với Futures là "&TEXT(D9, "#,##0")&" lot và ACM là "&TEXT(D5, "#,##0")&" lot. "&CHAR(10)&"Trong phiên có "&TEXT(H9, "#,##0")&" tài khoản phát sinh giao dịch ạ."
    ```

---

### 2.4. Bảng Phân Tích Mặt Hàng Trọng Điểm & Loại Hình (Dải `B22:D34`)
- **Mặt Hàng Tiêu Điểm**:
  - **`PLE`** (Bạch kim CQG): `=SUMIFS('DSGD MS'!M:M, 'DSGD MS'!AH:AH, "PLE")`
  - **`SIE`** (Bạc CQG): `=SUMIFS('DSGD MS'!M:M, 'DSGD MS'!AH:AH, "SIE")`
  - **`CPE`** (Đồng CQG): `=SUMIFS('DSGD MS'!M:M, 'DSGD MS'!AH:AH, "CPE")`
  - **`LRC`** (LRC Robusta CQG): `=SUMIFS('DSGD MS'!M:M, 'DSGD MS'!AH:AH, "LRC")`
  - **`SI5CO`** (Bạc Nano ACM): `=SUMIFS('DSGD MS'!M:M, 'DSGD MS'!AH:AH, "SI5CO") + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AF:AF, "SI5CO")`
  - **`PL1NY`** (Bạch kim Nano ACM): `=SUMIFS('DSGD MS'!M:M, 'DSGD MS'!AH:AH, "PL1NY") + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AF:AF, "PL1NY")`
  - **`CP2CO`** (Đồng Nano ACM): `=SUMIFS('DSGD MS'!M:M, 'DSGD MS'!AH:AH, "CP2CO") + SUMIFS('DSGD CCP'!AH:AH, 'DSGD CCP'!AF:AF, "CP2CO")`
- **Loại Hình Giao Dịch**:
  - **`L`** (LME): `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AI:AI, "L")`
  - **`S`** (Spreads): `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AI:AI, "S")`
  - **`O`** (Options): `=SUMIFS('DSGD MS'!AK:AK, 'DSGD MS'!AI:AI, "O")`

---

## 3. BÓC TÁCH TUẦN TỰ SHEET 2: `Thống kê TTM` (VỊ THẾ MỞ & PnL DỰ KIẾN)

Bảng này chứa dữ liệu vị thế mở của **44 mặt hàng phái sinh**, tính tỷ lệ áp đảo Mua/Bán và Lãi lỗ dự kiến (Unrealized PnL).

### 3.1. Cấu Trúc Bảng Tổng Thể (`Table3`: Dải `A2:H46`)
- `A2:A46`: Số thứ tự (1 đến 44).
- `B2:B46`: Mã Hàng Hóa chuẩn (`SI5CO`, `ZCE`, `ZWA`, `SBE`, `LRC`, `ZSE`, `ZLE`, `ZME`, `PL1NY`, `CP2CO`, `SIL`, `MHG`, `KWE`, `XW`, `XC`, `KCE`, `XB`, `CTE`, `FEF`, `MZM`, `MZC`, `PLE`, `CCE`, `CPE`, `ZFT`, `MZL`, `MZW`, `ALI`, `MZS`, `SIE`, `MPO`, `AHD`, `MQC`, `TRU`, `MQI`, `SND`, `QW`, `ZDS`, `CAD`, `SSR`, `SSC`, `LHC`, `NID`, `PBD`).
- **`C3` (P/L unrealized - Lãi lỗ dự kiến)**:
  ```excel
  =SUMIFS('TTM MS'!S:S, 'TTM MS'!AA:AA, B3, 'TTM MS'!H:H, "<>*A") + SUMIFS('TTM CCP'!O:O, 'TTM CCP'!Y:Y, B3)
  ```
  > [!IMPORTANT]
  > **Quy Tắc Lọc Cực Kỳ Quan Trọng Trong File Gốc**: Trên sheet `TTM MS`, điều kiện `'TTM MS'!H:H, "<>*A"` loại trừ các tài khoản kết thúc bằng chữ cái `"A"` (tức tài khoản giao dịch Straits/ACM). Các tài khoản ACM không tính PnL dự kiến tại cột này.
- **`D3` (Tổng Vị Thế Mở - TTM)**:
  ```excel
  =SUMIFS('TTM MS'!N:N, 'TTM MS'!AA:AA, B3, 'TTM MS'!H:H, "<>*A") 
   + SUMIFS('TTM MS'!O:O, 'TTM MS'!AA:AA, B3, 'TTM MS'!H:H, "<>*A") 
   + SUMIFS('TTM CCP'!I:I, 'TTM CCP'!Y:Y, B3) 
   + SUMIFS('TTM CCP'!J:J, 'TTM CCP'!Y:Y, B3)
  ```
- **`E3` (TTM Mua)**:
  `=SUMIFS('TTM MS'!N:N, 'TTM MS'!AA:AA, B3, 'TTM MS'!H:H, "<>*A") + SUMIFS('TTM CCP'!I:I, 'TTM CCP'!Y:Y, B3)`
- **`F3` (TTM Bán)**:
  `=SUMIFS('TTM MS'!O:O, 'TTM MS'!AA:AA, B3, 'TTM MS'!H:H, "<>*A") + SUMIFS('TTM CCP'!J:J, 'TTM CCP'!Y:Y, B3)`
- **`G3` (% Mở Mua)**:
  `=IFERROR(Table3[[#This Row],[TTM Mua]] / Table3[[#This Row],[TTM]], "")`
- **`H3` (% Mở Bán)**:
  `=IFERROR(Table3[[#This Row],[TTM Bán]] / Table3[[#This Row],[TTM]], "")`

> [!NOTE]
> **Quy Chuẩn Nghiệp Vụ Chuẩn Hóa Vị Thế Mở (Cập nhật 19/10/2026)**:
> 1. **Nguyên Tắc Bỏ ACM Trên M-System (`'TTM MS'!H:H, "<>*A"`)**: 
>    - Đối với M-System (`TTM MS`), **loại bỏ 100% các tài khoản ACM (đuôi `*A`, ví dụ `001C...-A`)** cho cả Khối lượng Mua (Cột N), Khối lượng Bán (Cột O) và Lãi lỗ dự kiến (Cột S). Vị thế mở của nhóm ACM đã được quản lý tập trung và tính toán thông qua CoreCCP.
>    - Các tài khoản **Futures thông thường** trên M-System (không có đuôi `*A`) **vẫn được tính bình thường 100%** và cộng dồn với dữ liệu vị thế mở từ CoreCCP.
> 2. **Đối với CoreCCP (`TTM CCP`)**:
>    - Tích lũy toàn bộ Vị thế mở và Lãi lỗ dự kiến từ file `TTM CCP.xlsx`.
> 3. Mã nguồn đã được hiện thực chuẩn xác tại [qlgd-dashboard.service.ts#L812-L865](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/services/qlgd-dashboard.service.ts#L812-L865).

### 3.2. Bảng Báo Cáo Ban Giám Sát (`Table15`: Dải `K2:O21`)
- Tiêu đề: `="Lãi lỗ dự kiến thời điểm kết phiên "&TEXT($T$1,"dd/mm/yyyy")&""`
- Gồm 17 mặt hàng chủ lực: `ZWA, ZLE, ZCE, ZSE, ZME, KWE, KCE, SBE, LRC, CTE, SIE, SIL, CPE, MHG, PLE, SI5CO, PL1NY`.
- Dòng 21 tính tổng:
  - `L21 = SUM(Table15[Tổng lãi lỗ dự kiến])`
  - `M21 = SUM(Table15[Tổng vị thế mở])`

---

## 4. BÓC TÁCH TUẦN TỰ SHEET 3: `Thống kê TTTT` (TẤT TOÁN & PnL THỰC TẾ)

Bảng này phản ánh tình hình chốt vị thế tất toán trong phiên và lãi lỗ thực tế (Realized PnL) của khách hàng.

### 4.1. Cấu Trúc Bảng Tổng Thể (Dải `B2:E46`)
- **`C3` (Khối Lượng Tất Toán)**:
  ```excel
  =SUMIFS('TTTT MS'!P:P, 'TTTT MS'!AC:AC, B3) + SUMIFS('TTTT CCP'!I:I, 'TTTT CCP'!AE:AE, B3)
  ```
  - `TTTT MS!P:P`: Cột `KL Mua` tất toán trên MS.
  - `TTTT CCP!I:I`: Cột `Khối lượng mua` tất toán trên CCP.
- **`D3` (Lãi Lỗ Thực Tế - VND)**:
  ```excel
  =SUMIFS('TTTT MS'!U:U, 'TTTT MS'!AC:AC, B3) + SUMIFS('TTTT CCP'!E:E, 'TTTT CCP'!AE:AE, B3)
  ```
  - `TTTT MS!U:U`: Cột `Lãi lỗ thực tế (VND)` trên MS.
  - `TTTT CCP!E:E`: Cột `Lãi lỗ thực tế(VND)` trên CCP.
- **`E3` (Ngày Mở Nhiều Vị Thế Nhất - Peak Open Date)**:
  ```excel
  =_xlfn.LET(
      _xlpm.ccp_acc, 'TTTT CCP'!$AE$2:$AE$5000,
      _xlpm.ccp_date, 'TTTT CCP'!$AJ$2:$AJ$5000,
      _xlpm.ms_acc, 'TTTT MS'!$AC$2:$AC$5000,
      _xlpm.ms_date, 'TTTT MS'!$AH$2:$AH$5000,
      _xlpm.get_ccp, IF(COUNTIF(_xlpm.ccp_acc, B3)>0, INDEX(_xlpm.ccp_date, MATCH(MAX(COUNTIFS(_xlpm.ccp_acc, B3, _xlpm.ccp_date, _xlpm.ccp_date)), COUNTIFS(_xlpm.ccp_acc, B3, _xlpm.ccp_date, _xlpm.ccp_date), 0)), 0),
      _xlpm.get_ms, IF(COUNTIF(_xlpm.ms_acc, B3)>0, INDEX(_xlpm.ms_date, MATCH(MAX(COUNTIFS(_xlpm.ms_acc, B3, _xlpm.ms_date, _xlpm.ms_date)), COUNTIFS(_xlpm.ms_acc, B3, _xlpm.ms_date, _xlpm.ms_date), 0)), 0),
      _xlpm.min_date, IF(AND(_xlpm.get_ccp>0, _xlpm.get_ms>0), MIN(_xlpm.get_ccp, _xlpm.get_ms), IF(_xlpm.get_ccp>0, _xlpm.get_ccp, IF(_xlpm.get_ms>0, _xlpm.get_ms, 0))),
      IF(_xlpm.min_date=0, "", _xlpm.min_date)
  )
  ```
  - **Ý nghĩa**: Thuật toán tìm ngày (Mode) có tần suất mở vị thế lớn nhất trước khi được đóng trong ngày hôm nay.

### 4.2. Bảng Báo Cáo BGS Bên Phải (`J2:M20`)
- Gồm 17 mặt hàng chủ lực tương tự Sheet 2.
- Lấy giá trị thông qua hàm `VLOOKUP` sang bảng bên trái:
  - `K3`: `Lãi lỗ thực tế` (`=VLOOKUP(J3, B:E, 3, 0)`)
  - `L3`: `Tổng khối lượng tất toán` (`=VLOOKUP(J3, B:E, 2, 0)`)
  - `M3`: `Ngày mở nhiều vị thế nhất` (`=VLOOKUP(J3, B:E, 4, 0)`)

---

## 5. BÓC TÁCH CẤU TRÚC 6 SHEET DỮ LIỆU NGUỒN & CÁC CỘT HELPER

### 5.1. Sheet 4: `DSGD MS` (Khớp Lệnh M-System - 42 Cột)
- **Cột Thô Từ File Xuất (A:AC - 29 cột)**:
  - `D`: `Mã TKGD` (Tài khoản)
  - `F`: `Mã HĐ` (Hợp đồng)
  - `M`: `KL giao dịch` (Số lot)
  - `V`: `Ngày giờ thực hiện` (Định dạng `"DD/MM/YYYY HH:mm:ss"`)
- **Cột Bổ Trợ Tính Toán (Helper Columns - AD:AR)**:
  - **`AD` (Ngày khớp)**:
    `=IFERROR(DATE(MID(table1[[#This Row],[Ngày giờ thực hiện]],7,4), MID(table1[[#This Row],[Ngày giờ thực hiện]],4,2), LEFT(table1[[#This Row],[Ngày giờ thực hiện]],2)),"")`
  - **`AE` (Giờ khớp)**:
    `=IFERROR(TIME(MID(table1[[#This Row],[Ngày giờ thực hiện]],12,2), MID(table1[[#This Row],[Ngày giờ thực hiện]],15,2), MID(table1[[#This Row],[Ngày giờ thực hiện]],18,2)),"")`
  - **`AF` (Ngày giờ khớp chuẩn)**: `=IFERROR(table1[[#This Row],[Ngày khớp]] + table1[[#This Row],[Giờ khớp]], "")`
  - **`AP1` (Cờ Mùa)**: `=IF(OR(AD2<DATE(2026,3,9), AD2>DATE(2026,11,1)), "Đông", "Hè")`
  - **`AG` (Phiên Giao Dịch - 4 Chu Kỳ)**:
    ```excel
    =IFERROR(IF($AP$1="Hè", _xlfn.IFS(
      NgàyGiờKhớp < INT(NgàyGiờKhớp - TIME(5,0,0)) + TIME(8,0,0), "Đầu phiên",
      NgàyGiờKhớp <= INT(NgàyGiờKhớp - TIME(5,0,0)) + TIME(16,0,0), "Hết phiên Á",
      NgàyGiờKhớp <= INT(NgàyGiờKhớp - TIME(5,0,0)) + TIME(23,0,0), "Hết phiên Âu",
      NgàyGiờKhớp <= INT(NgàyGiờKhớp - TIME(5,0,0)) + 1 + TIME(4,0,0), "Hết phiên Mỹ"
    ), _xlfn.IFS(
      NgàyGiờKhớp < INT(NgàyGiờKhớp - TIME(6,0,0)) + TIME(8,0,0), "Đầu phiên",
      NgàyGiờKhớp <= INT(NgàyGiờKhớp - TIME(6,0,0)) + TIME(16,0,0), "Hết phiên Á",
      NgàyGiờKhớp <= INT(NgàyGiờKhớp - TIME(6,0,0)) + TIME(23,0,0), "Hết phiên Âu",
      NgàyGiờKhớp <= INT(NgàyGiờKhớp - TIME(6,0,0)) + 1 + TIME(5,0,0), "Hết phiên Mỹ"
    )), "")
    ```
  - **`AH` (Hàng hoá)**:
    `=IFERROR(VLOOKUP(IF(RIGHT(MãTK,1)="L", LEFT(MãHĐ,3), LEFT(MãHĐ, FIND("2", MãHĐ)-2)), 'Mã HH'!A:C, 2, 0), "")`
  - **`AI` (Loại hình)**:
    `=IF(RIGHT(MãTK,1)="L", "L", IF(RIGHT(MãTK,1)="S", "S", IF(MID(MãHĐ,2,1)=".", "O", "F")))`
  - **`AJ` (ACM?)**: `=IF(RIGHT(MãTK,1)="A", "ACM", "CQG")`
  - **`AK` (KLGD)**: `=table1[[#This Row],[KL giao dịch]]`
  - **`AN1` (Tổng số TKGD Kết phiên MS)**:
    `=IFERROR(SUMPRODUCT(1/COUNTIF(Số_TK_có_GD_trong_phiên_MS, Số_TK_có_GD_trong_phiên_MS)), 0)`

---

### 5.2. Sheet 5: `DSGD CCP` (Khớp Lệnh CoreCCP - 39 Cột)
- **Cột Thô Từ File Xuất (A:AA - 27 cột)**:
  - `F`: `Mã TKGD`
  - `G`: `Mã HĐ`
  - `K`: `KL khớp`
  - `AA`: `Thời gian khớp lệnh`
- **Cột Bổ Trợ Tính Toán (AB:AM)**:
  - **`AB` (Ngày khớp)**: `=IFERROR(DATE(MID(AA2,7,4), MID(AA2,4,2), LEFT(AA2,2)),"")`
  - **`AC` (Giờ khớp)**: `=IFERROR(TIME(MID(AA2,12,2), MID(AA2,15,2), MID(AA2,18,2)),"")`
  - **`AD` (Ngày giờ khớp chuẩn)**: `=IFERROR(AB2+AC2,"")`
  - **`AE` (Phiên)**: Logic 4 mốc thời gian y hệt MS.
  - **`AF` (Hàng hoá)**: `=LEFT(G2, 5)` (5 ký tự đầu mã hợp đồng CCP).
  - **`AG` (ACM?)**: `=IF(RIGHT(F2,1)="A", "ACM", "CQG")`
  - **`AH` (KLGD)**: `=K2`
  - **`AK1` (Tổng số TKGD Kết phiên CCP)**:
    `=IFERROR(SUMPRODUCT(1/COUNTIF(Số_TK_có_GD_trong_phiên_CCP, Số_TK_có_GD_trong_phiên_CCP)), 0)`

---

### 5.3. Sheet 6 & 7: `TTM MS` (27 Cột) & `TTM CCP` (25 Cột)
- **`TTM MS` Col `AA` (HH)**:
  ```excel
  =IFERROR(IF(MID(MãHĐ, 2, 1)=".", MID(MãHĐ, 3, 3), IF(LEN(MãHĐ)=9, LEFT(MãHĐ, 3), LEFT(MãHĐ, LEN(MãHĐ)-3))), "")
  ```
  - Nếu Option (dấu "." ở ký tự 2) $\rightarrow$ lấy 3 ký tự tiếp theo (`MID(MãHĐ, 3, 3)`).
  - Nếu độ dài 9 ký tự $\rightarrow$ lấy 3 ký tự đầu (`LEFT(MãHĐ, 3)`).
  - Còn lại $\rightarrow$ cắt bỏ 3 ký tự cuối (tháng và năm đáo hạn `Z26`) $\rightarrow$ `LEFT(MãHĐ, LEN-3)`.
- **`TTM CCP` Col `Y` (HH)**:
  `=LEFT(F2, 5)` (Lấy 5 ký tự đầu của Mã hợp đồng CCP).

---

### 5.4. Sheet 8 & 9: `TTTT MS` (38 Cột) & `TTTT CCP` (40 Cột)
- **`TTTT MS`**:
  - `AC` (Hàng hoá): `=IFERROR(IF(LEN(MãHĐ)=9, LEFT(MãHĐ,3), LEFT(MãHĐ, LEN(MãHĐ)-3)), "")`
  - `AD`, `AE`, `AF`: Ngày giờ vào lệnh.
  - **`AH` (Ngày phiên vào lệnh)**:
    ```excel
    =IFERROR(IF(NgàyGiờVàoLệnh - NgàyGiờ+5h < 0, WORKDAY(DATE(YEAR(VàoLệnh), MONTH(VàoLệnh), DAY(VàoLệnh)), -1), DATE(YEAR(VàoLệnh), MONTH(VàoLệnh), DAY(VàoLệnh))), "")
    ```
    - Nếu lệnh được mở trước 05:00 sáng $\rightarrow$ lùi 1 ngày làm việc (`WORKDAY(..., -1)`).
- **`TTTT CCP`**:
  - `AE` (Hàng hoá): `=LEFT(G2, 5)`
  - `AF`, `AG`, `AH`: Ngày giờ vào lệnh.
  - `AJ` (Ngày phiên vào lệnh): Logic lùi ngày làm việc mốc 05:00 sáng tương tự MS.

---

## 6. SHEET 10: `Mã HH` (BẢNG DANH MỤC MASTER 215 MÃ HÀNG HÓA)

Đã trích xuất hoàn chỉnh 214 bản ghi và lưu trữ trực tiếp tại file mã nguồn TypeScript:
[backend/src/modules/trading-ops/constants/bgs-commodity-catalog.constant.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/constants/bgs-commodity-catalog.constant.ts).

### Danh mục mẫu:
- **Nông sản**:
  - `ZLE` $\rightarrow$ `ZLE` (Dầu Đậu Tương)
  - `ZCE` $\rightarrow$ `ZCE` (Ngô), `C.ZCE` / `P.ZCE` (Quyền chọn mua/bán Ngô)
  - `ZSE` $\rightarrow$ `ZSE` (Đậu Tương)
  - `ZME` $\rightarrow$ `ZME` (Khô Đậu Tương)
  - `ZWA` $\rightarrow$ `ZWA` (Lúa mì Chi-ca-gô), `KWE` (Lúa mì KC HRW)
- **Kim loại**:
  - `PLE` $\rightarrow$ `PLE` (Bạch kim), `PL1NY` (Bạch kim Nano)
  - `SIE` $\rightarrow$ `SIE` (Bạc), `SI5CO` (Bạc Nano)
  - `CPE` $\rightarrow$ `CPE` (Đồng), `CP2CO` (Đồng Nano)
- **Nguyên liệu & Năng lượng**:
  - `LRC` $\rightarrow$ `LRC` (Cà phê Robusta London)
  - `KCE` $\rightarrow$ `KCE` (Cà phê Arabica New York)
  - `SBE` $\rightarrow$ `SBE` (Đường 11 New York)

---

## 7. BÓC TÁCH MÃ NGUỒN VBA MACRO (`Module2.bas` & `Module1.bas`)

### 7.1. `Module2.bas`: Macro `RunAllChecks()`
```vba
Public Sub RunAllChecks()
    Dim folderPath As String, missingFiles As String
    Dim jobs As Variant, job As Variant
    Dim wbSource As Workbook, wsTarget As Worksheet
    Dim lastRow As Long

    ' Mỗi phần tử: Array(tên file/sheet, cột cuối cần copy)
    jobs = Array(Array("DSGD MS", "AC"), Array("DSGD CCP", "AA"), _
                 Array("TTM MS", "Z"), Array("TTM CCP", "X"), _
                 Array("TTTT MS", "AB"), Array("TTTT CCP", "AD"))

    folderPath = "M:\Quanlygiaodich\Tai lieu hoat dong\M.System Truc\BC room Ban Giám sát\Data\"
    ...
```
- **Cơ Chế Hoạt Động**:
  1. Tự động đọc 6 file Excel được phòng trực tải về thư mục mạng `M:\...\Data\`:
     - `DSGD MS.xlsx` $\rightarrow$ Copy cột `A:AC` sang sheet `DSGD MS`
     - `DSGD CCP.xlsx` $\rightarrow$ Copy cột `A:AA` sang sheet `DSGD CCP`
     - `TTM MS.xlsx` $\rightarrow$ Copy cột `A:Z` sang sheet `TTM MS`
     - `TTM CCP.xlsx` $\rightarrow$ Copy cột `A:X` sang sheet `TTM CCP`
     - `TTTT MS.xlsx` $\rightarrow$ Copy cột `A:AB` sang sheet `TTTT MS`
     - `TTTT CCP.xlsx` $\rightarrow$ Copy cột `A:AD` sang sheet `TTTT CCP`
  2. Toàn bộ các cột còn lại trong workbook (cột AD trở đi của MS, cột AB trở đi của CCP...) giữ nguyên công thức tính toán tự động cập nhật ngay khi dữ liệu được paste vào!

---

## 8. BỘ QUY CHUẨN THUẬT TOÁN TYPESCRIPT CHO BACKEND MODULAR V2

Hệ thống Backend NestJS của MXV hoàn toàn có thể thay thế 100% file Excel này bằng service xử lý trong bộ nhớ:

```typescript
export interface SessionReconResult {
  sessionName: 'Đầu phiên' | 'Hết phiên Á' | 'Hết phiên Âu' | 'Hết phiên Mỹ';
  platform: 'ACM' | 'CQG';
  volumeLots: number;
  uniqueAccounts: number;
}

export function determineTradingSession(tradeTime: Date, isSummerTime: boolean): string {
  const hours = tradeTime.getHours();
  const minutes = tradeTime.getMinutes();
  const timeVal = hours + minutes / 60;
  
  const startHour = isSummerTime ? 5 : 6;
  const endUsHour = isSummerTime ? 4 : 5; // Ngày hôm sau

  if (timeVal >= startHour && timeVal < 8) return 'Đầu phiên';
  if (timeVal >= 8 && timeVal <= 16) return 'Hết phiên Á';
  if (timeVal > 16 && timeVal <= 23) return 'Hết phiên Âu';
  return 'Hết phiên Mỹ'; // 23h00 -> 04h00/05h00
}
```

---
*Tài liệu này là căn cứ Ground-Truth chính xác tuyệt đối phục vụ kiểm thử, viết parser và vận hành hệ thống Trading Manager MXV.*
