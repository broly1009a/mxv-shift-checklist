# Kế Hoạch Triển Khai: Tự Động Hóa Quy Trình Kiểm Tra GTT (Giá Thanh Toán)

## 1. Tổng Quan Nghiệp Vụ

Quy trình kiểm tra GTT hiện tại gồm **7 bước thủ công** phức tạp, mục tiêu là **tự động hóa hoàn toàn** thành 1 nút bấm "Chạy Kiểm Tra GTT" trên Web Admin.

### Luồng Dữ Liệu Hiện Tại

```
M-System (CSV Bảng Giá)
        ↓ market.csv (GTT: cột S, VLOOKUP cột 19)
Marco Macro (ghep_file_GTT)
        ↓ Ghép file TTM + market.csv → file GTT.xlsx
CQG Desktop (Quote Spreadsheet)
        ↓ Tra giá từ list hợp đồng mở
Đối Chiếu GTT: MS vs CQG → Kết Quả Chênh Lệch
```

---

## 2. Phân Tích Kỹ Thuật

### 2.1 File market.csv - Nguồn GTT từ M-System

**Nguồn:** `https://msadmin.mxv.com.vn/#/orderManagement/orderCreating`

**Cấu trúc:** File CSV có ít nhất 19 cột
- **Cột A**: Mã hợp đồng (Contract Symbol)
- **Cột S (cột thứ 19)**: Giá Thanh Toán (GTT / Settlement Price)

**VBA Macro tham chiếu:**
```vba
=VLOOKUP(B2, market.csv!$A:$S, 19, 0)
```

> [!IMPORTANT]
> Cần inspect DOM thực tế trên trang `orderCreating` để xác định chính xác button/link download CSV và tên header cột S. Hiện chưa biết tên cột chính xác (settlement price / last price / settlement).

---

### 2.2 File GTT.xlsx - Danh Sách Hợp Đồng Cần Kiểm Tra

**Nguồn:** Marco VBA macro `ghep_file_GTT` ghép từ:
- File TTM (Tình Trạng Mở) từ backup CQG Futures
- File market.csv từ M-System

**Cấu trúc sheet GTT.xlsx cần tạo:**
| Cột A | Cột B | Cột C |
|---|---|---|
| Mã HĐ (từ TTM) | GTT (VLOOKUP từ market.csv) | Chuỗi tích lũy (dùng cho CQG search) |

**Logic cột C (dùng để search trên CQG):**
- `C2 = A2`
- `C3 = C2 & ", " & A3` (copy xuống đến hết)
- `C100 = tối đa 100 hợp đồng/sheet CQG`
- Nếu > 100 hợp đồng: chia 2 nhóm, nhóm 2 bắt đầu từ C101

---

### 2.3 CQG Desktop - Lấy GTT từ Quote Spreadsheet

**URL CQG:** `https://desktop.cqg.com/cqg/desktop/logon?ref=forced`
**Tài khoản:** `mxvprice / M#x!v@202502`

**Các bước tự động hóa bằng Playwright:**
1. Đăng nhập CQG (đã có `loginCQG`)
2. Click nút "+" ở góc phải trên để mở tab mới
3. Chọn **Quotes > Quote Spreadsheet**
4. Trong Quote Spreadsheet: Click **"New List"** hoặc **"Open a list"**
5. Nhập chuỗi hợp đồng vào **"Search Symbol"** (comma-separated, max 100)
6. Đọc giá GTT từ cột **"S" (Settlement Price)** trong bảng
7. Nếu có > 100 hợp đồng: mở thêm 1 Quote Spreadsheet tab nữa (bước 2-6 lặp lại cho nhóm 2)
8. Xuất/scrape dữ liệu giá từ màn hình CQG

> [!WARNING]
> CQG Desktop là ứng dụng web phức tạp dạng SPA (Angular/React). Playwright cần chờ render đúng các phần tử động. Các selector cần verify thực tế sau khi đăng nhập.

---

### 2.4 Đối Chiếu GTT

**Đầu vào:**
- Bảng MS: `{ symbol: string, gtt_ms: number }`
- Bảng CQG: `{ symbol: string, gtt_cqg: number }`

**Kết quả so sánh:**
- Chênh lệch (CQG_GTT - MS_GTT)
- Đánh dấu các hợp đồng có chênh lệch > 0 (khác nhau)
- Xuất ra file Excel hoặc hiển thị bảng trên Web

---

## 3. Kiến Trúc Hệ Thống Đề Xuất

### Phân Kỳ A: Backend NestJS

#### [MODIFY] `rpa-downloader.service.ts`
Bổ sung các phương thức:

```typescript
// Bước 1: Tải market.csv từ M-System orderCreating
async downloadMarketCsv(downloadDir: string): Promise<string>

// Bước 2: Đọc file GTT.xlsx (danh sách hợp đồng mở từ TTM)
async readGttContractList(gttFilePath: string): Promise<string[]>

// Bước 3: Đăng nhập CQG, mở Quote Spreadsheet, search symbols, đọc giá
async fetchGttFromCQG(symbols: string[]): Promise<{ symbol: string; gtt: number }[]>

// Bước 4: So sánh GTT giữa MS và CQG
async compareGtt(msData: GttData[], cqgData: GttData[]): Promise<GttCompareResult[]>
```

#### [NEW] `gtt-checker.service.ts`
Service orchestrator điều phối toàn bộ 4 bước trên thành 1 pipeline:

```typescript
async runGttCheck(): Promise<GttReport>
```

#### [MODIFY] `bot-engine.controller.ts`
```
POST /api/v1/bot-engine/run-gtt-check     → Trigger toàn bộ pipeline
GET  /api/v1/bot-engine/gtt-report/latest → Lấy kết quả gần nhất
```

---

### Phân Kỳ B: Frontend Admin UI

#### [MODIFY] `admin/bot-config/page.tsx`
- Thêm section **"Kiểm Tra GTT"** riêng biệt
- Nút **"Chạy Kiểm Tra GTT"** (trigger pipeline)
- Bảng hiển thị kết quả so sánh MS vs CQG với highlight đỏ/xanh theo chênh lệch

---

## 4. Kế Hoạch Thực Thi Chi Tiết

### Giai đoạn 1 - Nghiên cứu DOM (Cần làm đầu tiên)
- [ ] Đăng nhập M-System, truy cập trang `orderCreating` và inspect DOM
  - Xác định **button download CSV** (CSS selector)
  - Xác định **tên cột GTT** trong file CSV (cột thứ 19)
- [ ] Đăng nhập CQG Desktop với `mxvprice`, inspect DOM các element:
  - Nút **"+"** để thêm tab mới
  - Menu **Quotes > Quote Spreadsheet**
  - Nút **"New List"**
  - Ô nhập **"Search Symbol"**
  - Cột giá **Settlement** trong bảng kết quả

### Giai đoạn 2 - Backend Core
- [ ] Implement `downloadMarketCsv()` - Playwright download CSV từ M-System
- [ ] Implement `readGttContractList()` - Đọc GTT.xlsx lấy danh sách mã HĐ
- [ ] Implement `fetchGttFromCQG()` - Playwright scrape giá từ CQG Quote Spreadsheet
- [ ] Implement `compareGtt()` - So sánh 2 nguồn và xuất kết quả

### Giai đoạn 3 - API & Frontend
- [ ] Tạo endpoint trigger và lấy kết quả
- [ ] UI: Bảng đối chiếu kết quả + export Excel

---

## 5. Điểm Cần Xác Nhận (Open Questions)

> [!IMPORTANT]
> **Câu hỏi 1:** File GTT.xlsx (danh sách hợp đồng mở) được tạo thủ công bằng VBA macro `ghep_file_GTT` từ file TTM backup. Trong luồng tự động hóa, file TTM sẽ được:
> - **Phương án A**: Download tự động từ CQG/M-System → merge → sinh ra GTT list
> - **Phương án B**: Upload thủ công file GTT.xlsx vào hệ thống → bot chỉ lo phần check CQG và so sánh
>
> **→ Bạn muốn chọn phương án nào?**

> [!IMPORTANT]
> **Câu hỏi 2:** Trong CQG Quote Spreadsheet sau khi search symbols xong, giá GTT nằm ở cột nào? Trong ảnh chụp màn hình thấy có các cột: `T` (Trade), `B` (Bid), `A` (Ask), `ΔT` (Delta Trade), `S` (Settlement?). Cần xác nhận **cột S** là settlement price hay không?

> [!WARNING]
> **Câu hỏi 3:** CQG giới hạn max **100 hợp đồng** mỗi list. Số lượng hợp đồng mở thực tế hàng ngày thường là bao nhiêu? Nếu > 100, sẽ cần mở 2 Quote Spreadsheet song song.

> [!NOTE]
> **Câu hỏi 4:** Kết quả cuối cùng cần:
> - Chỉ xem trên Web (không lưu file)?
> - Xuất ra file Excel?
> - Gửi notification qua Telegram/Email nếu có chênh lệch?

---

## 6. Bước Tiếp Theo Ngay Bây Giờ

**Bước ngắn nhất để bắt đầu:** Chạy CLI test script headful mode để inspect DOM thực tế:

```powershell
# Kiểm tra trang download CSV M-System
$env:MS_URL="https://msadmin.mxv.com.vn/#/orderManagement/orderCreating"; npm.cmd run test:ms-login

# Kiểm tra CQG Quote Spreadsheet
npm.cmd run test:cqg-login
```

Sau đó chụp màn hình và observe các DOM element cần thiết.
