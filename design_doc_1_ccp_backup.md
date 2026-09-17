# THIẾT KẾ CHI TIẾT: PHÂN HỆ BACKUP CCP
## Tài liệu 1/2 — Hoàn thiện Backup Bot CCP (8 → 16 File)

> **Phiên bản**: v1.0 | **Ngày**: 17/09/2026
> **Trạng thái**: Bản thiết kế — Cần USER duyệt trước khi triển khai
>
> **Nguồn bằng chứng**:
> - [`ccp-ce-downloader.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/ccp-ce-downloader.service.ts) — `DEFAULT_CCP_REPORTS` hiện tại (L74-L141)
> - [`file-audit.handler.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/file-audit.handler.ts) — `REQUIRED_CCP_FILES` hiện tại (L43-L97)
> - URL Routes xác thực bởi crawler Playwright chạy thực tế 17/09/2026

---

## 1. TỔNG QUAN PHẠM VI

### Hiện Trạng

Bot backup CCP hiện tại tải và kiểm tra **8 file** mỗi ngày:

```
QLTTTKGD.csv  EOD.csv  NR.csv  DSL.csv  DSGD.csv  TTTT.csv  TTM.csv  LSGTT.csv
```

### Mục Tiêu Sau Hoàn Thiện

Tải và kiểm tra **16 file** (thêm 8 file mới, tất cả URL đã xác thực):

```
Nhóm Giao Dịch (Orders):    + LSGD.csv    DSL_MM.csv   LSGD_MM.csv
Nhóm Rủi Ro (Risk):         + FORCESELL.csv
Nhóm Tài Khoản (Accounts):  + DSTKGD.csv  DSTRADER.csv
Nhóm Sản Phẩm (Product):    + GTTCP.csv
Nhóm Giao Nhận (Delivery):  + GNNHAN.csv
```

---

## 2. THIẾT KẾ CHI TIẾT — FILE CẦN SỬA

### 2A. [`ccp-ce-downloader.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/ccp-ce-downloader.service.ts) — Thêm vào `DEFAULT_CCP_REPORTS`

**Vị trí chèn**: Sau entry `LSGTT` (dòng L140), trước dấu `];` đóng mảng.

Thêm theo thứ tự ưu tiên:

```typescript
// ── Ưu tiên 🔴 CAO ─────────────────────────────────────────────────────────

  {
    // Tương đương DSQLKQ.xlsx của M-System
    // Lịch sử giao dịch toàn phần (không lọc theo ngày như DSGD)
    code: 'LSGD',
    name: 'Lịch sử giao dịch',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Lịch sử giao dịch',
    cachedUrl: '/ORDERS/ORDERMATCH_ALL',
    enabled: true,
  },
  {
    // Gộp 4 file DSTKGD-Futures/ACM/LME/Spread của M-System thành 1 file tổng
    // 16 cột: Mã TK, Loại TK, Họ tên, FCM, Trạng thái...
    code: 'DSTKGD',
    name: 'Danh sách tài khoản giao dịch',
    parentMenu: 'Quản lý tài khoản',
    childMenu: 'Danh sách tài khoản giao dịch',
    cachedUrl: '/ACCOUNTMNG/ACCOUNTS_INFO',
    enabled: true,
  },
  {
    // Tương đương QLTKGDAmKQ.xlsx của M-System (TK có tỷ lệ KQ âm/vi phạm)
    // 16 cột: Force Sell history
    code: 'FORCESELL',
    name: 'Lịch sử Force Sell',
    parentMenu: 'Quản lý rủi ro',
    childMenu: 'Tra cứu lịch sử Force Sell',
    cachedUrl: '/RISKMNG/FORCESELL',
    enabled: true,
  },

// ── Ưu tiên 🟡 TRUNG BÌNH ──────────────────────────────────────────────────

  {
    // Thay thế DSTrader.xlsx của M-System
    // 12 cột: Mã TVKD, Tên, Loại, FCM, Trạng thái...
    code: 'DSTRADER',
    name: 'Danh sách Trader',
    parentMenu: 'Người dùng và phân quyền',
    childMenu: 'Người sử dụng',
    cachedUrl: '/USERMNG/TLPROFILES',
    enabled: true,
  },
  {
    // Lệnh Market Maker — KHÔNG có trong M-System, CCP-native
    // 27 cột, giống DSL nhưng dành cho TK MM
    code: 'DSL_MM',
    name: 'Danh sách lệnh MM',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Danh sách lệnh MM',
    cachedUrl: '/ORDERS/ORDERBOOK_MM',
    enabled: true,
  },
  {
    // Lịch sử GD Market Maker — CCP-native
    // 27 cột
    code: 'LSGD_MM',
    name: 'Lịch sử giao dịch MM',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Lịch sử giao dịch MM',
    cachedUrl: '/ORDERS/ORDERBOOK_ALL_MM',
    enabled: true,
  },
  {
    // Giá thanh toán ngày hiện tại (M-System chỉ có giá trước 6h từ nguồn ngoài)
    // 17 cột, cùng cấu trúc với LSGTT
    code: 'GTTCP',
    name: 'Giá thanh toán',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý giá thanh toán',
    cachedUrl: '/PRODUCT/SETTLEMENT',
    enabled: true,
  },

// ── Ưu tiên 🟢 THẤP ────────────────────────────────────────────────────────

  {
    // Giao nhận vật chất — chỉ bật khi có hoạt động giao nhận thực tế
    // 14 cột: Mã GN, Ngày GN, Mã HH, Khối lượng, Trạng thái...
    code: 'GNNHAN',
    name: 'Trạng thái giao nhận vật chất',
    parentMenu: 'Giao nhận',
    childMenu: 'Trạng thái giao nhận vật chất',
    cachedUrl: '/DELIVERY/PHYSICAL_MARKET_ALL',
    enabled: false,  // ← Tắt mặc định, bật thủ công khi cần
  },
```

> [!IMPORTANT]
> `GNNHAN` được đặt `enabled: false` theo mặc định vì chỉ cần tải khi có giao nhận vật chất thực tế. Có thể bật qua cấu hình Bot Job hoặc UI Admin.

---

### 2B. [`file-audit.handler.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/file-audit.handler.ts) — Thêm vào `REQUIRED_CCP_FILES`

**Vị trí chèn**: Sau entry `TTM` (dòng L87-L96), trước dấu `];` đóng mảng.

```typescript
// ── Ưu tiên 🔴 CAO ─────────────────────────────────────────────────────────

  {
    key: 'LSGD',
    name: 'Lịch sử giao dịch',
    filename: 'LSGD.csv',
    patterns: [/lsgd/i, /ordermatch_all/i, /lich.*su.*giao.*dich/i],
  },
  {
    key: 'DSTKGD',
    name: 'Danh sách tài khoản giao dịch',
    filename: 'DSTKGD.csv',
    patterns: [/dstkgd/i, /accounts_info/i, /danh.*sach.*tkgd/i],
  },
  {
    key: 'FORCESELL',
    name: 'Lịch sử Force Sell',
    filename: 'FORCESELL.csv',
    patterns: [/forcesell/i, /force.*sell/i],
  },

// ── Ưu tiên 🟡 TRUNG BÌNH ──────────────────────────────────────────────────

  {
    key: 'DSTRADER',
    name: 'Danh sách Trader',
    filename: 'DSTRADER.csv',
    patterns: [/dstrader/i, /tlprofiles/i, /danh.*sach.*trader/i],
  },
  {
    key: 'DSL_MM',
    name: 'Danh sách lệnh MM',
    filename: 'DSL_MM.csv',
    patterns: [/dsl_mm/i, /orderbook_mm/i, /lenh.*mm/i],
  },
  {
    key: 'LSGD_MM',
    name: 'Lịch sử giao dịch MM',
    filename: 'LSGD_MM.csv',
    patterns: [/lsgd_mm/i, /orderbook_all_mm/i, /lich.*su.*gd.*mm/i],
  },
  {
    key: 'GTTCP',
    name: 'Giá thanh toán',
    filename: 'GTTCP.csv',
    patterns: [/gttcp/i, /settlement[^_]/i, /gia.*thanh.*toan/i],
  },
  {
    // Không bắt buộc (enabled: false trong downloader)
    // Chỉ kiểm tra tồn tại nếu file được cấu hình tải
    key: 'GNNHAN',
    name: 'Trạng thái giao nhận vật chất',
    filename: 'GNNHAN.csv',
    patterns: [/gnnhan/i, /physical_market/i, /giao.*nhan/i],
  },
```

> [!NOTE]
> Pattern `settlement[^_]` cho GTTCP nhằm phân biệt với `LSGTT` (vốn là `/PRODUCT/SETTLEMENT_HIST`). Pattern `settlement_hist` đã được LSGTT nắm giữ.

---

## 3. CÁC FILE CẦN ĐIỀU TRA THỦ CÔNG (4 file)

Trước khi viết code, cần xác thực thủ công trực tiếp trên VNCLEAR UAT:

### 3A. `NKTHT` — Nhật ký thao tác hệ thống

**Hành động**: Mở VNCLEAR → Menu **Vận hành** → Tìm mục "File Monitor" hoặc "Nhật ký hệ thống"
- Nếu có route `/EOD/MONITORCSV` hoặc tương tự: thêm entry với `cachedUrl` đó
- Nếu không có: loại khỏi danh sách CCP (không có tương đương)

**Cột kỳ vọng**: Ngày, User, Loại thao tác, Module, Nội dung, Kết quả, Thời gian

### 3B. `TTCDH` — Trạng thái chờ duyệt hủy

**Hành động**: Mở VNCLEAR → **Lệnh và vị thế** → **Danh sách lệnh** (`/ORDERS/ORDERBOOK`)
- Click lần lượt từng Tab con: "Tất cả" / "Lệnh chờ khớp" / "Lệnh đã khớp" / "Lệnh đã hủy" / ??? (có Tab "Chờ duyệt hủy" không?)
- Với từng Tab: bấm nút **Kết xuất → Xuất tất cả** → xem tên file download
- Nếu Tab "Chờ duyệt hủy" export ra file riêng: thêm entry `code: 'TTCDH'`, `tabName: 'Chờ duyệt hủy'`, `cachedUrl: '/ORDERS/ORDERBOOK'`

### 3C. `TLKQHSKQ` — Tỷ lệ ký quỹ & lịch sử ký quỹ

**Hành động**: Mở VNCLEAR → **Quản lý rủi ro** → **Quản lý trạng thái TKGD** (`/RISKMNG/ACCTMARGIN_ALL`)
- Click Tab **"Danh sách trạng thái TKTVKD"** (nếu có)
- Kiểm tra xem Tab này có nút Kết xuất riêng không
- Nếu có: thêm entry `code: 'TLKQHSKQ'`, `tabName: 'Danh sách trạng thái TKTVKD'`, `cachedUrl: '/RISKMNG/ACCTMARGIN_ALL'`

### 3D. `DSLCK` / `DSLDK` / `DSLH` — Danh sách lệnh theo trạng thái

**Hành động**: Giống 3B — trong từng Tab "Lệnh chờ khớp" / "Lệnh đã khớp" / "Lệnh đã hủy":
- Bấm **Kết xuất → Xuất tất cả**
- Nếu file download ra với tên chứa trạng thái (ví dụ: `cho_khop_...csv`): 3 file này đều có pattern riêng → thêm 3 entry
- Nếu tất cả đều xuất ra file có tên giống nhau (`orderbook_...csv`): không thể phân biệt → chỉ giữ `DSL` tổng

---

## 4. XỬ LÝ ĐẶC BIỆT: QLTTTKGD — Lọc Âm Ký Quỹ

File `QLTTTKGD.csv` (49 cột, `/RISKMNG/ACCTMARGIN_ALL`) là tập cha, bao gồm tất cả trạng thái TK.
Trong M-System có file `QLTKGDAmKQ.xlsx` — chỉ chứa TK âm ký quỹ.

**Phương án xử lý**:
- **Bot tải**: Tải toàn bộ `QLTTTKGD.csv` bình thường (đã làm).
- **File `FORCESELL.csv`** (`/RISKMNG/FORCESELL`): Tải riêng — đây là lịch sử Force Sell thực tế (16 cột).
- **Nếu cần báo cáo "âm ký quỹ hiện tại"**: Lọc `QLTTTKGD.csv` theo cột `Trạng thái` = "Vi phạm" / "Cảnh báo" / "Force Sell" ở tầng xử lý nghiệp vụ, không cần tải thêm file riêng.

---

## 5. KIẾN TRÚC SAU KHI HOÀN THIỆN

```
DEFAULT_CCP_REPORTS (16 file tổng)
├── Vận hành:              EOD
├── Quản lý rủi ro:        QLTTTKGD, FORCESELL
├── Quản lý tiền:          NR
├── Lệnh và vị thế:        DSL, DSGD, TTTT, TTM, LSGD, DSL_MM, LSGD_MM
├── Quản lý sản phẩm:      LSGTT, GTTCP
├── Quản lý tài khoản:     DSTKGD
├── Người dùng/phân quyền: DSTRADER
└── Giao nhận:             GNNHAN (disabled default)
```

```
REQUIRED_CCP_FILES (16 key) — Tương ứng 1:1 với DEFAULT_CCP_REPORTS
File audit sẽ đánh dấu ❌ nếu thiếu bất kỳ file nào trong 15 file required
(GNNHAN không bắt buộc → không thêm vào REQUIRED hoặc thêm với flag optional)
```

---

## 6. KẾ HOẠCH KIỂM THỬ

### 6A. Kiểm Tra Sau Khi Sửa Code

| Bước | Mô Tả | Kết Quả Kỳ Vọng |
| :---: | :--- | :--- |
| 1 | Build TypeScript: `npx tsc --noEmit` | Không có lỗi biên dịch |
| 2 | Chạy bot backup CCP cho 1 ngày cụ thể (ngày có dữ liệu) | Download thành công 15 file (16 nếu GNNHAN có dữ liệu) |
| 3 | Kiểm tra thư mục Backup CCP sau chạy | Tồn tại đủ 15/16 file `.csv` đúng tên |
| 4 | Chạy File Audit | Báo cáo audit hiển thị đủ 15 file ✅ (GNNHAN optional) |
| 5 | Thử nghiệm khi server CCP trả về lỗi timeout cho 1 file | Bot ghi log cảnh báo, không crash toàn bộ batch |

### 6B. Kiểm Tra Thủ Công (USER Tự Thực Hiện)

| File | URL | Thao Tác Cần Làm |
| :--- | :--- | :--- |
| `LSGD.csv` | `/ORDERS/ORDERMATCH_ALL` | Mở → Filter ngày → Kết xuất → Xác nhận 25 cột |
| `DSTKGD.csv` | `/ACCOUNTMNG/ACCOUNTS_INFO` | Mở → Kết xuất tất cả → Xác nhận 16 cột |
| `FORCESELL.csv` | `/RISKMNG/FORCESELL` | Mở → Kết xuất → Xác nhận 16 cột |
| `DSTRADER.csv` | `/USERMNG/TLPROFILES` | Mở → Kết xuất → Xác nhận 12 cột |
| `DSL_MM.csv` | `/ORDERS/ORDERBOOK_MM` | Mở → Kết xuất → Xác nhận 27 cột |
| `LSGD_MM.csv` | `/ORDERS/ORDERBOOK_ALL_MM` | Mở → Kết xuất → Xác nhận 27 cột |
| `GTTCP.csv` | `/PRODUCT/SETTLEMENT` | Mở → Kết xuất → Xác nhận 17 cột |
| `GNNHAN.csv` | `/DELIVERY/PHYSICAL_MARKET_ALL` | Mở → Kết xuất → Xác nhận 14 cột |

---

## 7. CHANGELOG CẦN GHI KHI TRIỂN KHAI

Mỗi lần chỉnh sửa, AI/Dev phải ghi vào [`CHANGELOG_AI.md`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/CHANGELOG_AI.md) theo mẫu:

```markdown
## [v?.?.?] — DD/MM/YYYY
### Thêm file Backup CCP Phase 2 (8 → 16 file)
**File tác động**:
- `ccp-ce-downloader.service.ts`: Thêm 8 entry vào DEFAULT_CCP_REPORTS
- `file-audit.handler.ts`: Thêm 8 key vào REQUIRED_CCP_FILES

**Nội dung thay đổi**:
- Trước: 8 file (EOD, QLTTTKGD, NR, DSL, DSGD, TTTT, TTM, LSGTT)
- Sau: 16 file (thêm LSGD, DSTKGD, FORCESELL, DSTRADER, DSL_MM, LSGD_MM, GTTCP, GNNHAN)

**Xác nhận Build**: `npx tsc --noEmit` ✅
```

---

> [!CAUTION]
> **Tuyệt đối không sửa code trước khi**:
> 1. USER xác nhận kết quả kiểm tra thủ công 4 file điều tra (NKTHT, TTCDH, TLKQHSKQ, DSLCK/DSLDK/DSLH)
> 2. USER xác nhận 8 URL trong bảng 6B đều mở được và có nút Kết xuất trên UAT
> 3. Build TypeScript pass sau khi thêm code
