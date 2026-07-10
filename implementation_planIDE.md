# Implementation Plan: Tự động tải Accounts_Balances.xlsx từ CQG CAST

## Mục tiêu
Playwright script tự động hóa toàn bộ quy trình:
**Login → Reports → Reporting Tool → Accounts: Balances → Fill filters → Create Report → Lưu file**

---

## Phân tích kỹ thuật từ Screenshots

### ⚠️ Vấn đề quan trọng: Trang dùng FRAMESET (3-frame layout)
CAST dùng classic ASP frameset:
- **Frame trái**: Navigation menu (Customer Service, Customers, Accounts, FCMs, Reports...)
- **Frame trên**: Search bar
- **Frame giữa (main)**: Nội dung chính (Reporting Tool, form filter...)

> Playwright cần target **đúng frame** khi interact, không thể dùng `page.click()` trực tiếp.

### Selectors xác nhận từ screenshots

| Field | Selector | Giá trị |
|-------|----------|---------|
| Username input | `input[name="userNameInput"]` | `mxvhoangvan` |
| Password input | `input[name="passwordInput"]` | *** |
| Template dropdown | `select` đầu tiên trong main frame | `Accounts: Balances` |
| FCM row (row 1) - Operation | select trong row có text "FCM" | `Equals` |
| FCM row (row 1) - Value | input trong row có text "FCM" | `MXV` |
| Currency row (row 5) - Operation | select trong row có text "Currency" | `Like` |
| Currency row (row 5) - Value | input trong row có text "Currency" | `USD` |
| Record Description (row 11) - Op | select trong row có text "Record Description" | `Like` |
| Record Description (row 11) - Val | input trong row có text "Record Description" | `current` |
| Create Report button | `button:has-text("Create Report")` hoặc `input[value="Create Report"]` | — |

---

## Luồng thực hiện (7 bước)

```
BƯỚC 1: Login
  → POST form với userNameInput / passwordInput (bypass IE JS)
  → Chờ redirect sang frameset chính

BƯỚC 2: Detect frames sau login
  → page.frames() → log URL từng frame
  → Xác định navFrame và mainFrame

BƯỚC 3: Navigate đến Reporting Tool
  → navFrame.click('a:has-text("Reporting Tool")')
  → Chờ mainFrame load form

BƯỚC 4: Chọn Template "Accounts: Balances"
  → templateSelect.selectOption({ label: 'Accounts: Balances' })
  → Chờ filter table render

BƯỚC 5: Điền các filter
  → FCM: Equals = MXV
  → Currency: Like = USD
  → Record Description: Like = current

BƯỚC 6: Click "Create Report" + chờ download
  → context.waitForEvent('download', timeout: 120s)
  → Sau khi server generate, file tự download

BƯỚC 7: Lưu file
  → download.saveAs(path với timestamp)
  → Log đường dẫn để service tiếp theo dùng
```

---

## Xử lý Frameset

```typescript
// Sau khi login và frameset load:
const allFrames = page.frames();
console.log('Frames:', allFrames.map(f => ({ url: f.url(), name: f.name() })));

// Tìm đúng frame
const navFrame  = allFrames.find(f =>
  f.url().includes('/Nav') || f.url().includes('/nav') || f.url().includes('navigation')
);
const mainFrame = allFrames.find(f =>
  f.url().includes('/Main') || f.url().includes('/Content') || f.url().includes('Welcome')
);
```

---

## Xử lý Filter Table

```typescript
async function setFilterRow(frame, colName: string, operation: string, value: string) {
  // Tìm row theo tên cột
  const row = frame.locator(`tr:has(td:has-text("${colName}"))`).first();

  // Set Filter Operation dropdown
  const opSelect = row.locator('select').first();
  await opSelect.selectOption({ label: operation });
  await frame.waitForTimeout(300);

  // Set Filter Value input
  const valInput = row.locator('input[type="text"]').first();
  await valInput.fill(value);
}
```

---

## Rủi ro và Phương án dự phòng

| Rủi ro | Phòng tránh |
|--------|-------------|
| Login fail (sai pass) | Detect URL vẫn là logon.asp, log lỗi rõ ràng |
| Frame URL không đoán được | Explore mode: log tất cả frame URLs, chụp screenshot |
| Template dropdown load chậm | `waitForSelector` trước khi select |
| Filter row không match | Thử index cứng (row 1, 5, 11) nếu text match fail |
| Download timeout (server chậm) | Timeout 120 giây, retry 1 lần |
| Session timeout giữa chừng | Detect redirect về login, re-login tự động |

---

## Output

```
backend/temp/cast-downloads/Accounts_Balances_20260710_175500.xlsx
```

Script log ra đường dẫn tuyệt đối để ReconciliationService có thể đọc tiếp.

---

## Checklist thực hiện (5 Phase)

### Phase 1 - Login ✅ (Gần xong)
- [ ] Xác nhận selectors: `userNameInput`, `passwordInput`
- [ ] Bypass `doLogon()` IE JS bằng `form.submit()`
- [ ] Xác nhận URL sau login + liệt kê tất cả frames

### Phase 2 - Navigate Reporting Tool
- [ ] Log URL của từng frame sau login
- [ ] Click "Reporting Tool" trong nav frame
- [ ] Hoặc navigate trực tiếp nếu biết URL

### Phase 3 - Chọn template + fill form
- [ ] Select "Accounts: Balances" từ dropdown
- [ ] Chờ filter table render
- [ ] Fill FCM = MXV (Equals)
- [ ] Fill Currency = USD (Like)
- [ ] Fill Record Description = current (Like)

### Phase 4 - Download
- [ ] Click "Create Report"
- [ ] `waitForEvent('download', timeout: 120000)`
- [ ] Lưu file với timestamp

### Phase 5 - Test & Tích hợp
- [ ] Test end-to-end thành công
- [ ] Tích hợp vào BotJobQueue nếu cần tự động hàng ngày

---

## Lệnh chạy

```powershell
# Chạy thông thường (tự động download):
$env:CAST_USER="mxvhoangvan"; $env:CAST_PASS="mat_khau"; npm.cmd run test:cast-download

# Explore mode (xem trang 90 giây):
$env:CAST_EXPLORE="1"; $env:CAST_USER="mxvhoangvan"; $env:CAST_PASS="mat_khau"; npm.cmd run test:cast-download
```
