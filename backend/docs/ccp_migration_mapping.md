# Tài Liệu Chuyển Đổi Thống Kê: MS → CCP

> **Mục tiêu**: Tổng hợp toàn bộ công thức và mapping cột dữ liệu cần thiết để chuyển hệ thống
> thống kê **Số Lot** và **Giá trị giao dịch** từ nguồn MS (M-System/CQG) sang báo cáo CCP (CoreCCP).

---

## 1. Tổng Quan Kiến Trúc Hiện Tại (MS-Based)

### 1.1 File nguồn hiện tại

| Báo cáo | File nguồn | Hệ thống | Vai trò |
|---|---|---|---|
| Thống kê Lot | `DSGD.xlsx` | MS | Danh sách giao dịch trong phiên (Futures/ACM) |
| Thống kê Lot | `FR.xlsx` (FR1+FR2) | CQG | Giao dịch khớp lệnh – cross-check với DSGD |
| Thống kê Lot | `TTM.xlsx` | MS | Trạng thái mở (vị thế mở EOD) |
| Thống kê Lot | `TTTT.xlsx` | MS | Trạng thái tất toán trong ngày |
| Thống kê Lot | `OP.xlsx` (OP1+OP2) | CQG | Open Position – cross-check với TTM |
| Thống kê Lot | `PS.xlsx` (PS1+PS2) | CQG | Net Position / EOD Settlement – cross-check với TTTT |
| Thống kê Giá trị | `DSGD.xlsx` | MS | Nguồn tính GTGD theo HH / TVKD |

### 1.2 Luồng xử lý hiện tại (lot-statistics.service.ts)

```
processLotStatistics()
 ├─ parseExcelBuffer(DSGD, FR, TTM, TTTT, OP, PS)
 ├─ classifyDsgd()   → dsgd / dsgdSpread / dsgdLme / dsgdOptions / dsgdAcm
 ├─ classifyFr()     → fr / frSpread / frLme / frOptions
 ├─ classifyTtm()    → ttm / ttmSpread / ttmLme / ttmOptions / ttmAcm
 ├─ classifyTttt()   → tttt / ttttSpread / ttttLme / ttttOptions / ttttAcm / lmeExpired
 ├─ classifyOp()     → op / opSpread / opLme / opOptions
 ├─ classifyPs()     → ps / psSpread / psLme / psOptions
 ├─ calcFrProduct()  → trừ TRU, FEF, ZFT, QO/QP/BM/MPO
 ├─ aggregate pivot: byProduct, byTvkd
 └─ Validation cross-check (MS vs CQG)
```

---

## 2. Cấu Trúc File CCP (nguồn mới)

### 2.1 Danh sách file CCP hiện có qua `ccp-statistics.service.ts`

| File CCP | Tên nội bộ | Mô tả |
|---|---|---|
| DSGD CCP | `dsgdCcp` | Danh sách GD của TVKD thường |
| DSGD MM CCP | `dsgdMmCcp` | Danh sách GD của TK Market Maker |
| DSTKGD | `dstkgd` | Danh sách tài khoản GD (dùng thống kê TK mở mới) |
| NR | `nr` | Nộp rút tiền |
| TTM | `ttm` | Trạng thái mở (CCP) |
| TTTT | `tttt` | Trạng thái tất toán (CCP) |

> **Lưu ý quan trọng**: CCP **không có file FR, OP, PS** riêng tương đương CQG.
> CCP tổng hợp luôn vào báo cáo DSGD, TTM, TTTT của chính nó.

---

## 3. Mapping Cột: MS DSGD → CCP DSGD

### 3.1 File MS DSGD (CQG format)

| Index cột | Tên header | Ý nghĩa | Dùng trong logic |
|---|---|---|---|
| col4 (D) | `Mã TKGD` | Mã tài khoản GD | Classify: Spread (-S), LME (-L), ACM (-A) |
| col6 (F) | `Mã HĐ` / `Mã Hợp Đồng` | Mã kỳ hạn hợp đồng | Identify Options (C./P.), identify commodity SP |
| col11 (K) | `Chiều mua bán` | BUY / SELL | Aggregate by product/TVKD |
| col13 (M) | `KL giao dịch` | Số lot giao dịch | SumLot – thống kê lot chính |
| col14 (N) | `Giá khớp` | Giá khớp lệnh | Tính GTGD = lot × giá × heSo × donVi × tyGia |

### 3.2 File CCP DSGD (dự kiến cột từ ccp-statistics.service.ts)

Dựa trên code `processGiaoDichSheet()` trong `ccp-statistics.service.ts`:

| Index cột | Ý nghĩa | Code mapping |
|---|---|---|
| `row[5]` | `Mã TKGD` | Nhận diện TK MM vs TVKD thường |
| `row[8]` | Loại lệnh (STP/STL/LMT/MKT) | Kiểm tra đủ 4 loại lệnh |
| `row[10]` | Số lot giao dịch | `soLot = sum(row[10])` |
| `row[13]` | Giá khớp | `giaTri = lot × gia × 1000` |
| `row[21]` | Mã thành viên (TVKD) | Grouping theo TVKD |

> **Lưu ý giá trị**: CCP tính `giaTri = KL × Giá × 1000` (đơn vị VND đã quy đổi).
> MS tính `GTGD = lot × price × heSo × donVi × tyGia` (cần tra vlookup HH + tỷ giá).

---

## 4. Mapping Cột: MS TTM → CCP TTM

### 4.1 MS TTM (CQG OP format)

| Index cột | Tên header | Ý nghĩa |
|---|---|---|
| col8 | `Mã TKGD` | Phân loại Spread/LME/ACM |
| col10 | `Loại HĐ` | Phân loại Options (C./P.) |
| col14 | `KLM` | Khối lượng Mua mở |
| col15 | `KLB` | Khối lượng Bán mở |

Công thức: `TTM_total = sum(KLM) + sum(KLB)`

### 4.2 CCP TTM

Dựa trên `processTtmSheet()` trong `ccp-statistics.service.ts`:

| Index cột | Ý nghĩa |
|---|---|
| `row[0]` | Mã thành viên (TVKD) – dùng để group |
| `row[3]` | Mã TKGD – nhận diện TK MM |
| `row[8]` | TTM Mua (KLM) |
| `row[9]` | TTM Bán (KLB) |
| `row[14]` | Lãi lỗ dự kiến |

Công thức: `TTM_total_per_TVKD = sum(row[8]) + sum(row[9])`

**→ Mapping tương đương: row[8]+row[9] (CCP) ≡ KLM+KLB (MS)**

---

## 5. Mapping Cột: MS TTTT → CCP TTTT

### 5.1 MS TTTT (CQG PS format)

| Index cột | Tên header | Ý nghĩa |
|---|---|---|
| col8 | `Mã TKGD` | Phân loại Spread/LME/ACM |
| col16 | `KL Mua` / `Số lô` | Khối lượng tất toán |

Công thức: `TTTT_total = sum(col16)`, `ttttLme = sum(lme_rows.col16) - lmeExpiredLot`

### 5.2 CCP TTTT

Dựa trên `processTtttSheet()` trong `ccp-statistics.service.ts`:

| Index cột | Ý nghĩa |
|---|---|
| `row[0]` | Mã thành viên (TVKD) – dùng để group |
| `row[3]` | Mã TKGD – nhận diện TK MM |
| `row[5]` | Lãi lỗ thực tế |
| `row[10]` | KLTT (Khối lượng tất toán) |

Công thức: `KLTT_per_TVKD = sum(row[10])`

**→ Mapping tương đương: row[10] (CCP) ≡ col16 (MS/PS)**

---

## 6. Mapping Cột: NR (Nộp Rút) – CCP Mới

MS **không có** file NR tương đương dùng trong thống kê lot. File này là **bổ sung mới** từ CCP.

| Index cột CCP NR | Ý nghĩa |
|---|---|
| `row[1]` | Mã thành viên (TVKD) |
| `row[3]` | Số TKGD |
| `row[5]` | Loại (Nộp / Rút) |
| `row[6]` | Giá trị (VND) |

---

## 7. Công Thức Thống Kê Lot: So Sánh MS vs CCP

### 7.1 Thống kê Số Lot Giao Dịch (DSGD)

**MS Logic (lot-statistics.service.ts)**:
```
dsgdTotal    = sum(DSGD.col13)               -- tất cả futures (trừ ACM)
dsgdSpread   = sum(DSGD.col13 where maTKGD ends -S)
dsgdLme      = sum(DSGD.col13 where maTKGD ends L)
dsgdOptions  = sum(DSGD.col13 where loaiHD starts C./P.)
dsgdProduct  = dsgdTotal - dsgdSpread - dsgdLme - dsgdOptions

frProduct    = frTotal - TRU - FEF - ZFT - QO/QP/BM/MPO - L - frSpread - frLme - frOptions - autoExcluded

Validation:  dsgdProduct == frProduct  ✓
             dsgdSpread  == frSpread   ✓
```

**CCP Logic (đề xuất)**:
```
-- Nguồn: DSGD CCP + DSGD MM CCP (merged)
-- Grouping theo maThanhVien (row[21]) hoặc maTKGD (row[5]) cho TK MM

ccpSoLot     = sum(row[10])   -- per TVKD
ccpGiaTri    = sum(row[10] × row[13] × 1000)   -- per TVKD

-- CCP KHÔNG phân loại Spread/LME/Options nếu file không chứa cột phân loại
-- Cần xác nhận: file CCP DSGD có cột Mã TKGD (row[5]) không kết thúc -S/-L?
```

> **GAP #1**: MS phân loại Spread/LME/Options qua suffix mã TKGD (`-S`/`L`).
> CCP cần xác nhận xem file DSGD CCP có cột mã TKGD tương tự không, hay chỉ có mã thành viên.

### 7.2 Thống kê Trạng Thái Mở (TTM)

**MS Logic**:
```
ttmTotal     = sum(KLM + KLB) where maTKGD NOT contains -A
ttmSpread    = sum(KLM + KLB) where maTKGD ends -S
ttmLme       = sum(KLM + KLB) where maTKGD ends L
ttmOptions   = sum(KLM + KLB) where loaiHD starts C./P.
ttmProduct   = ttmTotal - ttmSpread - ttmLme - ttmOptions
```

**CCP Logic (đề xuất)**:
```
-- Nguồn: file TTM CCP
ccpTtmMua    = sum(row[8])  per TVKD
ccpTtmBan    = sum(row[9])  per TVKD
ccpTtmTotal  = ccpTtmMua + ccpTtmBan  per TVKD
```

> **GAP #2**: CCP không phân loại Spread/LME/Options trong file TTM.
> Báo cáo CCP tổng hợp theo TVKD mà không phân tách các loại hợp đồng.

### 7.3 Thống kê Tất Toán (TTTT)

**MS Logic**:
```
ttttTotal    = sum(col16) where maTKGD NOT contains -A
ttttSpread   = sum(col16) where maTKGD ends -S
ttttLme      = sum(col16) where maTKGD ends L (trừ lmeExpired)
ttttOptions  = sum(col16) where loaiHD starts C./P.
ttttProduct  = ttttTotal - ttttSpread - ttttLme - ttttOptions
```

**CCP Logic (đề xuất)**:
```
-- Nguồn: file TTTT CCP
ccpKLTT      = sum(row[10])  per TVKD
ccpLaiLo     = sum(row[5])   per TVKD (lãi lỗ thực tế)
```

> **GAP #3**: Tương tự TTM, CCP không phân tách Spread/LME/Options trong TTTT.

---

## 8. Công Thức Thống Kê Giá Trị Giao Dịch: So Sánh MS vs CCP

### 8.1 MS Logic (value-statistics.service.ts)

```
-- Nguồn: DSGD.xlsx từ thư mục MS Futures backup
-- Tra cứu:
--   HH sheet: prefix(maTKGD) → baseHH
--   Hhoa Vlookup sheet: baseHH → { heSo, donVi }
--   Sheet1!D2 = tyGiaDefault, D3 = tyGiaTru, D4 = tyGiaMpo

Với mỗi dòng DSGD:
  prefixNormal = getMaHHFromDsgd(row)     -- Lấy mã HH từ mã kỳ hạn
  baseHH       = hhMap[prefixNormal]
  { heSo, donVi } = vlookupMap[baseHH]
  
  rate = tyGiaDefault | tyGiaTru | tyGiaMpo  (tuỳ baseHH)
  
  GTGD_Normal  = lot × price × heSo × donVi × rate
  GTGD_Spread  = lot × price × heSo × donVi × rate  (nếu maTKGD ends -S)
```

**Logic lấy mã SP (getMaHHFromDsgd)**:
```
if maTKGD ends 'L' (LME):
  maHH = loaiHD[0:3]                    -- Lấy 3 ký tự đầu mã kỳ hạn
else:
  idx = loaiHD.indexOf('2')
  maHH = loaiHD[0 : idx-1]              -- Lấy phần trước số 2 đầu tiên
```

### 8.2 CCP Logic (ccp-statistics.service.ts)

```
-- Nguồn: DSGD CCP (đã merged với DSGD MM CCP)
-- Không có sheet HH / Hhoa Vlookup
-- Tính trực tiếp:

giaTri = sum(row[10] × row[13] × 1000) per TVKD
```

> **GAP #4 (Quan trọng nhất)**: MS cần bảng tra tỷ giá + hệ số nhân (HH, Vlookup) để quy đổi
> giá sang VND theo từng loại hàng hóa. CCP tính trực tiếp `lot × giá × 1000`.
>
> **Cần xác nhận**: Đơn vị giá trong CCP DSGD (row[13]) là gì?
> - Nếu là giá USD/lô đã nhân sẵn hệ số → dùng công thức hiện tại của CCP
> - Nếu là giá theo đơn vị hàng hóa (đồng/kg, USD/toz...) → cần bảng tỷ giá tương tự MS

---

## 9. Báo Cáo CCP "Pilot Bạc Thỏi" vs Báo Cáo Thống Kê Năm

### 9.1 Báo cáo CCP hiện tại (5 sheets)

| Sheet | Nội dung | File nguồn CCP |
|---|---|---|
| Giao dịch | Lot + GTGD per TVKD per ngày | DSGD CCP + DSGD MM CCP |
| Tài khoản | TKGD mở mới trong ngày | DSTKGD |
| Nộp Rút | Số lệnh + giá trị nộp rút | NR |
| Trạng thái mở | TTM Mua + Bán + Lãi lỗ dự kiến | TTM |
| Trạng thái tất toán | KLTT + Lãi lỗ thực tế | TTTT |

### 9.2 Báo cáo Thống kê Năm (MS-based, cần migrate)

**Thống kê Số Lot** (`M:\...\Thong ke so lot giao dich`):
- File lũy kế: `Thong ke so lot giao dich Normal {year}.xlsx`
- File ACM: `Thong ke so lot giao dich ACM {year}.xlsx`
- File LME: `Thong ke so lot giao dich LME {year}.xlsx`
- File Options: `Thong ke so lot giao dich Options {year}.xlsx`
- File Spread: `Thong ke so lot giao dich Spread {year}.xlsx`

**Thống kê Giá Trị** (`M:\...\Thong ke gia tri giao dich`):
- File chính: `Thong ke gia tri giao dich {year}.xlsx`
- File ACM: `Thong ke gia tri giao dich ACM {year}.xlsx`
- File LME: `Thong ke gia tri giao dich LME {year}.xlsx`
- File Options: `Thong ke gia tri giao dich Options {year}.xlsx`
- File Spread: `Thong ke gia tri giao dich Spread {year}.xlsx`
- File theo TVKD: `Thong ke gia tri giao dich {year} theo TVKD.xlsx`

---

## 10. Các GAP Cần Xác Nhận Trước Khi Code

| # | GAP | Câu hỏi cần trả lời | Ảnh hưởng |
|---|---|---|---|
| **G1** | Phân loại Spread/LME/Options | File DSGD CCP có cột Mã TKGD kết thúc `-S`/`L` không? | Nếu không → không thể phân tách 4 nhóm |
| **G2** | Đơn vị giá trong DSGD CCP | `row[13]` là USD hay VND? Giá raw hay đã quy đổi? | Ảnh hưởng công thức GTGD |
| **G3** | Bảng tỷ giá / hệ số | CCP có bảng tỷ giá riêng không? Hay dùng chung macro HH với MS? | Nếu không → cần tích hợp bảng vlookup HH vào CCP pipeline |
| **G4** | File FR/OP/PS tương đương | CCP có file thanh toán bù trừ (FR) hay cross-check không? | Nếu không → bỏ validation DSGD vs FR |
| **G5** | ACM trong CCP | CCP có tài khoản ACM (kết thúc -A) không? Hay tách riêng? | Ảnh hưởng acmLot calculation |
| **G6** | TK MM (Market Maker) | Mã TK MM trong CCP là gì? Có format `082E9999999-M` không? | Grouping MM vs TVKD thường |

---

## 11. Đề Xuất Kiến Trúc Migration

### Phương án A: Thống kê thuần CCP (Đơn giản hóa)

> Phù hợp nếu CCP đã chuẩn hóa dữ liệu và không cần phân tách Spread/LME/Options.

```
CcpLotStatisticsService
  ├─ Input: dsgdCcp + dsgdMmCcp (merged) + ttm + tttt
  ├─ Group by: maThanhVien (row[21]) hoặc maTKGD cho TK MM
  ├─ Output:
  │    soLot = sum(row[10])
  │    giaTri = sum(row[10] × row[13] × 1000)
  │    ttmTotal = sum(row[8] + row[9])   ← từ TTM
  │    kltt = sum(row[10])               ← từ TTTT
  │    laiLo = sum(row[5])               ← từ TTTT
  └─ Ghi vào file lũy kế năm
```

### Phương án B: Phân tách đầy đủ như MS (Phức tạp)

> Chỉ khả thi nếu DSGD CCP chứa cột Mã TKGD có suffix `-S`, `L`, `-A`.

```
CcpFullClassifier
  ├─ classifyDsgdCcp()    → product / spread / lme / options / acm
  ├─ classifyTtmCcp()     → giống MS nếu có cột maTKGD
  ├─ classifyTtttCcp()    → giống MS nếu có cột maTKGD
  ├─ Không cần FR/OP/PS   → bỏ validation cross-check
  └─ Cần bảng HH + tỷ giá → dùng lại macro HH hoặc hardcode vào DB
```

### Phương án C: Hybrid (Khuyến nghị)

```
Dùng CCP cho:
  ✓ Thống kê theo TVKD (lot + GTGD per thành viên)
  ✓ Báo cáo CCP Pilot (5 sheets đã có)
  ✓ Nộp rút tiền (chỉ có trong CCP)

Giữ MS/CQG cho:
  ✓ Phân loại Spread/LME/Options (nếu CCP không hỗ trợ)
  ✓ File lũy kế năm chi tiết theo HH/loại hợp đồng
  ✓ Cross-validation (khi CCP còn đang pilot)
```

---

## 12. Kế Hoạch Implementation

### Phase 1: Kiểm tra cấu trúc thực tế file CCP

**Bước 1**: Mở file DSGD CCP thực tế và xác nhận:
- Tên các cột (header row)
- Index cột thực tế cho: Mã TKGD, Mã thành viên, Số lot, Giá khớp
- Có cột phân loại loại lệnh (MKT/LMT/STP/STL) không?

**Bước 2**: Xác nhận đơn vị giá (VND hay foreign currency)

**Bước 3**: Xác nhận cấu trúc TTM CCP (row[8]=TTM Mua, row[9]=TTM Bán có đúng không)

### Phase 2: Tạo CcpLotStatisticsService mới

```typescript
// Đề xuất interface mới
export interface CcpLotInput {
  dsgdCcp: Buffer;      // DSGD thường
  dsgdMmCcp: Buffer;    // DSGD TK MM
  ttm?: Buffer;          // Trạng thái mở
  tttt?: Buffer;         // Trạng thái tất toán
  selectedDate: Date;
}

export interface CcpLotResult {
  byTvkd: {
    tvkd: string;
    soLot: number;
    giaTri: number;
    ttmMua: number;
    ttmBan: number;
    kltt: number;
    laiLo: number;
    isFull4Types: boolean;   // Đủ 4 loại lệnh STP/STL/LMT/MKT?
    missingTypes: string[];
  }[];
  totalSoLot: number;
  totalGiaTri: number;
}
```

### Phase 3: Tạo bot job handler cho CCP Lot Statistics

```typescript
// Trong bot-engine handlers
// botCheckType: 'RUN_CCP_LOT_STATS'
// Tự động đọc file CCP từ SFTP/local path đã download
// Ghi kết quả vào file lũy kế năm
```

### Phase 4: UI cập nhật trong Trading Manager

- Thêm tab/section "Thống kê CCP" trong trang Trading Manager
- Cho phép trigger thủ công hoặc tự động sau khi download file CCP

---

## 13. Files Cần Tạo Mới / Chỉnh Sửa

| File | Hành động | Mô tả |
|---|---|---|
| `backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts` | **TẠO MỚI** | Service xử lý thống kê lot từ CCP |
| `backend/src/modules/ccp-statistics/helpers/ccp-classifier.helper.ts` | **TẠO MỚI** | Phân loại giao dịch từ file CCP |
| `backend/src/modules/ccp-statistics/ccp-statistics.module.ts` | **CHỈNH SỬA** | Đăng ký service mới |
| `backend/src/modules/ccp-statistics/ccp-statistics.controller.ts` | **CHỈNH SỬA** | Thêm endpoint `/lot-statistics` |
| `backend/src/modules/bot-engine/handlers/ccp-lot-jobs.handler.ts` | **TẠO MỚI** | Handler bot job cho CCP lot stats |
| `frontend/src/app/trading-manager/page.tsx` | **CHỈNH SỬA** | Thêm UI cho CCP lot statistics |

---

## 14. Câu Hỏi Xác Nhận Từ User (Cần trả lời trước khi code)

> [!IMPORTANT]
> **Hãy trả lời các câu hỏi này trước khi tiến hành implementation:**

1. **File DSGD CCP có cột Mã TKGD với suffix `-S` (Spread), `L` (LME), `-A` (ACM) như MS không?**
   → Quyết định có phân tách được 4 nhóm (Product/Spread/LME/Options) hay không

2. **Đơn vị giá tại cột `row[13]` trong DSGD CCP là gì?**
   (a) Giá bằng VND đã quy đổi → dùng công thức `lot × giá × 1000`
   (b) Giá theo đơn vị ngoại tệ → cần bảng tỷ giá (như MS)

3. **Cần ghi kết quả vào file lũy kế năm nào?**
   (a) File riêng CCP mới (chưa có) → cần tạo file mẫu
   (b) Ghép vào file lũy kế MS đang dùng → cần thêm cột source

4. **CCP có bao giờ có tài khoản ACM không?**
   → Quyết định có cần tính `acmLot` từ CCP hay không

5. **Khi nào bắt đầu stop dùng MS, chuyển sang CCP hoàn toàn?**
   → Định ngày cutover để biết có cần chạy song song không

---

## 10. Xác Nhận Cuối Cùng (Đã Resolved — 14/09/2026)

### 10.1 Tất cả GAPs đã được giải quyết

| GAP | Câu hỏi | Kết quả xác nhận |
|---|---|---|
| **G1** | CCP có suffix -S/L không? | **Hiện tại chỉ có -A (ACM). Future-ready: -S, L được thiết kế sẵn** |
| **G2** | Đơn vị giá `row[13]` là VND hay ngoại tệ? | **Ngoại tệ (USD/Pound). Cần tra tỷ giá CCP** |
| **G3** | Nguồn tỷ giá? | **API `CURRENCYEXCHANGERATE` hoặc upload file Tỷ giá.xlsx. USD=25920, JPY=170, MYR=6383** |
| **G4** | Không có FR/OP/PS trong CCP? | **Đúng. Bỏ cross-validation, thiết kế chờ Phase 2** |
| **G5** | CCP có tài khoản ACM không? | **Có. Hiện tại 100% là ACM (-A)** |
| **G6** | Format mã HH? | **5 ký tự đầu của Mã HĐ: SI5COZ26→SI5CO, CP2COZ26→CP2CO, PL1NYZ26→PL1NY** |

### 10.2 Mapping Chính Xác Đã Xác Nhận

#### DSGD CCP (25 cột) — Đã đọc từ file thực tế DSGD_14.6.xlsx
| col | Header | Dùng để |
|---|---|---|
| `col[0]` | `Ngày hệ thống` | Ngày hệ thống |
| `col[1]` | `Ngày phiên` | Ngày giao dịch (filter theo ngày) |
| `col[5]` | `Mã TKGD` | Phân loại ACM (-A) / Spread (-S) / LME (L) |
| `col[6]` | `Mã HĐ` | Tên HH = `maHD.substring(0,5)` |
| `col[7]` | `Mua/Bán` | Chiều GD: "Mua" hoặc "Bán" |
| `col[8]` | `Loại lệnh` | MKT / LMT / STP / STL |
| `col[10]` | `KL khớp` | **Số lot giao dịch** |
| `col[13]` | `Giá khớp trung bình` | **Giá (ngoại tệ, đơn vị theo HH)** |
| `col[21]` | `Mã thành viên` | **TVKD 3 ký tự (041, 011...)** |

#### TTM CCP (24 cột) — Đã đọc từ file TTM_14.06.xlsx
| col | Header | Dùng để |
|---|---|---|
| `col[0]` | `Mã thành viên` | TVKD (group by) |
| `col[3]` | `Mã TKGD` | Phân loại ACM/Spread/LME |
| `col[5]` | `Mã hợp đồng` | Tên HH |
| `col[8]` | `Khối lượng mua` | **KLM (TTM mua)** |
| `col[9]` | `Khối lượng bán` | **KLB (TTM bán)** |
| `col[14]` | `Lãi lỗ dự kiến(VND)` | Lãi lỗ VND |

#### TTTT CCP (31 cột) — Đã đọc từ file TTTT_14.06.xlsx
| col | Header | Dùng để |
|---|---|---|
| `col[0]` | `Mã thành viên` | TVKD (group by) |
| `col[3]` | `Mã TKGD` | Phân loại |
| `col[4]` | `Lãi lỗ thực tế` | Lãi lỗ ngoại tệ |
| `col[5]` | `Lãi lỗ thực tế(VND)` | **Lãi lỗ VND** |
| `col[7]` | `Mã hợp đồng` | Tên HH |
| `col[9]` | `Khối lượng mua` | **KLTT mua** |
| `col[10]` | `Khối lượng bán` | **KLTT bán** |

#### Tỷ Giá CCP (file Tỷ giá.xlsx) — Đã xác nhận
| col | Header | Dùng để |
|---|---|---|
| `col[0]` | `Nguyên tệ` | Currency code: USD, JPY, MYR, CNY, VND |
| `col[1]` | `Tỷ giá quy đổi` | **Dùng để tính GTGD** |

### 10.3 Bảng HH ACM (Đã xác nhận từ Mã HĐ CCP_14_06.xlsx)

| Mã HH | Tên | Độ lớn HĐ | Đơn vị | Tiền tệ |
|---|---|---|---|---|
| `SI5CO` | Bạc Nano ACM | 100 | Pound | USD |
| `CP2CO` | Đồng Nano ACM | 1000 | Pound | USD |
| `PL1NY` | Bạch Kim Nano ACM | 5 | Pound | USD |

### 10.4 Công Thức GTGD Đã Xác Nhận

```
GTGD (VND) = KL_khớp × Giá_khớp_TB × doCao × tyGia_VND

Ví dụ: SI5COZ26, KL=1, Giá=6.485 USD/Pound, doCao=100, tyGia(USD)=25920
GTGD = 1 × 6.485 × 100 × 25920 = 16,806,720 VND
```

### 10.5 Trạng Thái Implementation

| File | Trạng thái | Mô tả |
|---|---|---|
| `ccp-classifier.helper.ts` |  Hoàn thành | Parser DSGD/TTM/TTTT, classifier ACM/Spread/LME, `getMaHHFromCcpMaHD` (5 ký tự đầu), `CCP_HH_DEFAULTS` |
| `ccp-lot-statistics.service.ts` |  Hoàn thành | Service chính: tính lot/GTGD/TTM/TTTT per TVKD, kiểm tra 4 loại lệnh, parse tỷ giá |
| `ccp-statistics.module.ts` |  Đã đăng ký | `CcpLotStatisticsService` đã vào providers + exports |
| `ccp-statistics.controller.ts` |  Hoàn thành | 3 endpoints mới: `GET/POST lot-statistics/config` + `POST lot-statistics` |
| TypeScript check |  Pass | Không có lỗi TS trong các file mới |
