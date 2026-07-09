# Kế hoạch chuyển Macro VBA → Python thuần (ACM Lot Calculator)

## Bối cảnh & Vấn đề

Macro Excel COM (`run_lot_macro.py` + `Macro thong ke so lot giao dich có ACM.xlsm`) đang **FAILED liên tục** do không truy cập được ổ `M:\` (network drive offline trong môi trường dev), dẫn tới lỗi:

```
VBA Runtime Error '1004':
Cannot access 'M:\Quanlygiaodich\...\Thong ke so lot giao dich 2026.xlsx'
```

**Giải pháp:** Viết script Python thuần `acm_lot_calculator.py` dùng `pandas` + `openpyxl` để tính toán trực tiếp, không cần qua Excel COM.

---

## ✅ Những gì đã Research xong

### 1. Cấu trúc file Input

| File | Cột quan trọng | Ghi chú |
|---|---|---|
| `DSGD.xlsx` | Col 4 (D): Mã TKGD, Col 13 (M): KL giao dịch | Source chính |
| `TTM.xlsx` | Col 8 (H): Mã TKGD, Col 14 (N): KL Mua, Col 15 (O): KL Bán | Tất toán phiên trước |
| `TTTT.xlsx` | Col 8 (H): Mã TKGD, Col 16 (P): KL Mua, Col 17 (Q): KL Bán | Tất toán phiên này |

### 2. Logic lọc ACM (đã phân tích VBA)

```
Từ DSGD.xlsx:
  → DSGD    : filter Col 4 KHÔNG chứa "-A"    (twb.Sheets("DSGD"))
  → ACM     : filter Col 4 chứa "*-A*"         (twb.Sheets("ACM"))
  → DSGD ACM: từ ACM, filter Col 4 KHÔNG bắt đầu bằng "999"   (twb.Sheets("DSGD ACM"))
  → Test ACM: từ ACM, filter Col 4 bắt đầu bằng "999*"        (twb.Sheets("Test ACM"))

Từ TTM.xlsx:
  → TTM-ACM : filter Col 8 chứa "*-A*"
  → TTM ACM : từ TTM-ACM, filter Col 8 KHÔNG bắt đầu bằng "999"

Từ TTTT.xlsx:
  → TTTT-ACM: filter Col 8 chứa "*-A*"
  → TTTT ACM: từ TTTT-ACM, filter Col 8 KHÔNG bắt đầu bằng "999"
```

### 3. Công thức tính kết quả cuối (ghi vào file đích)

| Giá trị | Nguồn | Ghi vào cột |
|---|---|---|
| KL giao dịch ACM chuẩn | `SUM(DSGD ACM!Q:Q)` — tức SUM của Col 13 (KL giao dịch) của DSGD ACM sau khi insert cột | Col C (cột 3) |
| KL tất toán ACM (TTTT) | `SUM(TTTT ACM!P:P)` — tức SUM của Col 16 (KL Mua) TTTT ACM | Col D (cột 4) |
| KL vị thế mở ACM (TTM) | `SUM(TTM ACM!N:O)` — tức SUM Col 14 + Col 15 TTM ACM | Col E (cột 5) |
| Test ACM volume | `SUM(Test ACM!M:M)` — Col 13 (KL giao dịch) của Test ACM | → `Sheet2!AF3` → Col I (cột 9) nếu > 0 |

> **Lưu ý quan trọng về cột Q trong DSGD ACM:**  
> Col 13 (M) trong file gốc DSGD.xlsx là "KL giao dịch".  
> Nhưng trong VBA, trước khi copy vào DSGD ACM, macro chèn thêm:  
> - 1 cột tại G (SP)  
> - 1 cột tại D (TVKD)  
> - 2 cột tại N:O (KLM, KLB)  
> → Col M dịch thành Col Q (cột 17).  
> **Trong Python thuần: đọc trực tiếp Col 13 của file gốc, không cần insert.**

### 4. File đích

- **Production:** `M:\Quanlygiaodich\Tai lieu hoat dong\Thong ke so lot giao dich\Thong ke so lot giao dich ACM 2026.xlsx`
- **Local fallback:** `C:\Users\hiepth\Downloads\Quanlygiaodich\Tai lieu hoat dong\Thong ke so lot giao dich\Thong ke so lot giao dich ACM 2026.xlsx` (tự tạo nếu chưa có)
- **Sheet đích:** Sheet cuối cùng của workbook (e.g. `T07.2026`)
- **Cách match hàng:** `MATCH(targetDate, nwb.Sheets(last).Columns("B:B"), 0)` → Tìm hàng có cột B = ngày chạy

### 5. Cấu trúc sheet đích `T07.2026`

```
Row 2: Headers - STT | Ngày/phiên GD | M-System | ... | CQG | ... | Ghi chú | THỐNG KÊ SỐ LOT THEO TVKD
Row 3:           | | Futures | | | Spread | | | LME | | | Options | | | Tổng M-System | Vị thế mở | ...
Row 5: Ngày 01/07/2026
Row 6: Ngày 02/07/2026
...
Row 10: Ngày 08/07/2026  ← đây là hàng cần ghi
```

Cột B chứa `datetime` (2026-07-08 00:00:00).

### 6. Đường dẫn file Input theo ngày

Từ `Sheet2` của macro workbook:
```
A1  = "M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\"  (backupMs)
A5  = A1 & YYYY & "\" & "T" & mm.YYYY & "\" & dd.mm & "\DSGD.xlsx"
A10 = A1 & YYYY & "\" & "T" & mm.YYYY & "\" & dd.mm & "\TTM.xlsx"
A11 = A1 & YYYY & "\" & "T" & mm.YYYY & "\" & dd.mm & "\TTTT.xlsx"
A200 = "M:\...\Thong ke so lot giao dich ACM 2026.xlsx"
```

Trong Python: các đường dẫn này được tính từ `backup_path_ms`, `target_date` và `target_root`.

### 7. Job FAILED vì gì

Tất cả 5 job gần nhất đều FAILED với lỗi COM:
- `M:\ drive offline` → VBA không truy cập được file đích
- Hoặc: `The remote procedure call failed` → Excel COM bị treo

---

## ❌ Chưa làm được

- [ ] Tạo file `C:\POC\scripts\acm_lot_calculator.py` (script Python thuần)
- [ ] Update `bot-job-queue.service.ts` để gọi script mới thay vì `run_lot_macro.py`
- [ ] Kiểm thử và so sánh kết quả với file Excel thực tế
- [ ] Xử lý file đích chưa tồn tại (tạo từ template)

---

## 📋 Việc cần làm buổi chiều

### Bước 1: Viết `acm_lot_calculator.py`

Script nhận tham số:
```bash
python acm_lot_calculator.py <target_date_yyyy-mm-dd> <backup_path_ms> <target_acm_path>
```

Logic chính:
```python
# 1. Build đường dẫn file input từ ngày
dsgd_path  = backup_path_ms / YYYY / T{mm}.{YYYY} / {dd}.{mm} / DSGD.xlsx
ttm_path   = backup_path_ms / YYYY / T{mm}.{YYYY} / {dd}.{mm} / TTM.xlsx
tttt_path  = backup_path_ms / YYYY / T{mm}.{YYYY} / {dd}.{mm} / TTTT.xlsx

# 2. Đọc + lọc ACM rows
dsgd_df   = pd.read_excel(dsgd_path)
acm_df    = dsgd_df[dsgd_df['Mã TKGD'].str.contains('-A', na=False)]
dsgd_acm  = acm_df[~acm_df['Mã TKGD'].str.startswith('999')]
test_acm  = acm_df[acm_df['Mã TKGD'].str.startswith('999')]

ttm_df    = pd.read_excel(ttm_path)
ttm_acm   = ttm_df[ttm_df['Mã TKGD'].str.contains('-A', na=False) &
                   ~ttm_df['Mã TKGD'].str.startswith('999')]

tttt_df   = pd.read_excel(tttt_path)
tttt_acm  = tttt_df[tttt_df['Mã TKGD'].str.contains('-A', na=False) &
                    ~tttt_df['Mã TKGD'].str.startswith('999')]

# 3. Tính tổng
kl_gd_acm    = dsgd_acm['KL giao dịch'].sum()    # → ghi cột C
kl_tt_acm    = tttt_acm['KL Mua'].sum()           # → ghi cột D
kl_vtmo_acm  = ttm_acm['KL Mua'].sum() + ttm_acm['KL Bán'].sum()  # → ghi cột E
kl_test_acm  = test_acm['KL giao dịch'].sum()     # → ghi cột I (nếu > 0)

# 4. Mở file đích, tìm hàng = target_date, ghi giá trị
wb = openpyxl.load_workbook(target_acm_path)
sheet = wb.worksheets[-1]
# Tìm row i có cột B = target_date
# Ghi i, C = kl_gd_acm; D = kl_tt_acm; E = kl_vtmo_acm; I = kl_test_acm (nếu >0)
wb.save(target_acm_path)

# 5. In kết quả JSON cho Node.js
print(json.dumps({"success": True, "kl_gd_acm": kl_gd_acm, ...}))
```

### Bước 2: Update `bot-job-queue.service.ts`

Thay `const scriptPath = path.join('C:', 'POC', 'scripts', 'run_lot_macro.py')` bằng:
```ts
const scriptPath = path.join('C:', 'POC', 'scripts', 'acm_lot_calculator.py');
```

Và truyền thêm tham số `target_acm_path` (path đến file đích).

### Bước 3: Test chạy thủ công

```bash
python C:\POC\scripts\acm_lot_calculator.py 2026-07-08 \
  "C:\Users\hiepth\Downloads\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures" \
  "C:\Users\hiepth\Downloads\Quanlygiaodich\Tai lieu hoat dong\Thong ke so lot giao dich\Thong ke so lot giao dich ACM 2026.xlsx"
```

---

## ⚠️ Lưu ý kỹ thuật quan trọng

1. **File đích `Thong ke so lot giao dich ACM 2026.xlsx` chưa tồn tại local** → Cần tạo template hoặc copy từ workspace `marco/` trước khi chạy test.

2. **TTTT.xlsx: KL Mua = KL Bán** cho mỗi row (đã verify) → Chỉ cần sum `KL Mua` (Col P/16).

3. **TTM.xlsx: sum cả Col N + Col O** (KL Mua + KL Bán).

4. **DSGD ACM col Q trong VBA** = Col M trong file gốc (do VBA insert thêm cột) → Python đọc thẳng tên cột `KL giao dịch` là đúng.

5. **Cột B trong file đích** chứa kiểu `datetime`, cần so sánh với `target_date.date()`.

---

## 📁 File scripts hiện tại tại `backend/`

Các file `.py` trong `backend/` là **scripts phân tích tạm thời** (research), **không phải code chính thức**.  
Code chính thức sẽ đặt tại `C:\POC\scripts\acm_lot_calculator.py`.
