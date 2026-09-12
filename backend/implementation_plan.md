# Kế Hoạch Triển Khai Chi Tiết

## Tổng quan

Có **2 đầu việc** cần thực hiện sau khi USER thực hiện thay đổi `rpa-downloader.service.ts` (loại bỏ hardcode ACM URL và thêm `orderUrl`/`fillUrl` động):

1. **[TASK-1] Bổ sung trường `orderUrl` / `fillUrl` vào UI Cấu hình kết nối ACM** — Frontend + Backend nhỏ, hoàn chỉnh vòng lặp cấu hình động.
2. **[TASK-2] Port logic tải báo cáo CCP/CE từ Python sang NestJS TypeScript** — Đưa toàn bộ luồng RPA tải file từ VNCLEAR CoreCCP và CoreEX vào `RpaDownloaderService`.

---

## TASK-1: Bổ Sung `orderUrl` / `fillUrl` Cho ACM Trong UI Cấu Hình

### Bối cảnh & Vấn đề

Sau khi USER sửa `downloadAcmBackup()` để đọc `creds.orderUrl` / `creds.fillUrl` từ `bot_credentials_acm`, hiện tại chưa có ô nhập liệu nào trên UI để Admin điền 2 trường này. Nếu Admin cần thay đổi domain ACM hoặc đường dẫn báo cáo Order/Fill, họ **không thể làm qua giao diện** — phải sửa thẳng vào database.

### Phạm vi thay đổi

#### [MODIFY] Frontend — `ConnectionSettings.tsx`

**File:** [`frontend/src/app/admin/bot-config/components/ConnectionSettings.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/frontend/src/app/admin/bot-config/components/ConnectionSettings.tsx)

Cần thực hiện 4 điểm sửa đổi không liên tục:

**Điểm 1 — Thêm 2 state mới** (sau dòng `const [acmUrl, setAcmUrl]`):
```tsx
const [acmOrderUrl, setAcmOrderUrl] = useState('');
const [acmFillUrl, setAcmFillUrl] = useState('');
```

**Điểm 2 — Đọc từ API response** (trong `fetchConfig`, khối `if (data.acm)`):
```tsx
setAcmOrderUrl(data.acm.orderUrl || '');
setAcmFillUrl(data.acm.fillUrl || '');
```

**Điểm 3 — Đưa vào body khi lưu** (trong `handleSaveConfig`, khối `acm: { ... }`):
```tsx
orderUrl: acmOrderUrl.trim(),
fillUrl: acmFillUrl.trim(),
```

**Điểm 4 — Render UI** (trong phần form HTML khu vực ACM, sau ô `acmUrl`):
```tsx
{/* URL báo cáo Order (tùy chọn) */}
<div style={{ /* style tương đương các ô khác */ }}>
  <label>URL Báo cáo Order (tùy chọn)</label>
  <input
    id="acm-order-url"
    type="text"
    value={acmOrderUrl}
    onChange={(e) => setAcmOrderUrl(e.target.value)}
    placeholder="Mặc định tự ghép từ URL đăng nhập (ACM #/business-tetporder)"
  />
  <small>Chỉ điền khi URL báo cáo Order khác với domain đăng nhập ACM</small>
</div>

{/* URL báo cáo Fill/Trade (tùy chọn) */}
<div>
  <label>URL Báo cáo Fill/Trade (tùy chọn)</label>
  <input
    id="acm-fill-url"
    type="text"
    value={acmFillUrl}
    onChange={(e) => setAcmFillUrl(e.target.value)}
    placeholder="Mặc định tự ghép từ URL đăng nhập (ACM #/business-tetptrade)"
  />
  <small>Chỉ điền khi URL báo cáo Fill khác với domain đăng nhập ACM</small>
</div>
```

> **Lưu ý UI**: Tuân thủ AGENTS.md Mục 5 — Không dùng emoji. Chỉ dùng icon từ `lucide-react` (`Link2`, `ExternalLink`) nếu cần icon.

#### [MODIFY] Backend — `bot-engine.controller.ts`

**File:** [`backend/src/modules/bot-engine/bot-engine.controller.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.controller.ts)

**Điểm 1 — `getConfig()` (khoảng dòng 112–125)**: Thêm `orderUrl` và `fillUrl` vào object `acm` mặc định và vào block decode:
```typescript
let acm = {
  url: '', username: '', password: '', geminiApiKey: '',
  downloadUrl: '', downloadBtnSelector: '',
  sftpHost: '', sftpPort: '2231', sftpUsername: '', sftpPassword: '',
  sftpRemoteDir: '', sftpFileExtensions: '',
  orderUrl: '',   // MỚI
  fillUrl: '',    // MỚI
};
// Trong khối decode (dòng ~183-186):
orderUrl: decrypted.orderUrl || '',   // MỚI
fillUrl:  decrypted.fillUrl  || '',   // MỚI
```

**Điểm 2 — `saveConfig()` (khoảng dòng 410–450)**: Thêm 2 trường vào `mergedAcm`:
```typescript
orderUrl: acm.orderUrl !== undefined ? acm.orderUrl.trim() : (currentAcm.orderUrl || ''),
fillUrl:  acm.fillUrl  !== undefined ? acm.fillUrl.trim()  : (currentAcm.fillUrl  || ''),
```

---

## TASK-2: Port Logic Tải Báo Cáo CCP/CE Từ Python Sang NestJS TypeScript

### Bối cảnh & Mục tiêu

Tool Python `cpp-ce-downloader` (Playwright sync + PyQt6) hiện đang tải các báo cáo từ 2 hệ thống VNCLEAR:
- **CoreCCP** (`https://coreccp.mxv.com.vn`): Báo cáo `NR`, `TTTT`, `LSGTT`
- **CoreEX** (`https://coreexchange.mxv.com.vn`): Báo cáo `DSL`, `DSGD`

Mục tiêu: Tích hợp logic này vào `RpaDownloaderService` (NestJS) để Bot có thể tự động tải các file báo cáo này theo lịch ca trực, phục vụ đối chiếu EOD.

### Phạm vi thay đổi

#### [NEW] `ccp-ce-downloader.service.ts`

**File:** [`backend/src/modules/bot-engine/ccp-ce-downloader.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/ccp-ce-downloader.service.ts)

Service mới, inject `SystemSettingsService`. Cấu trúc class:

```typescript
@Injectable()
export class CcpCeDownloaderService {
  // === AUTHENTICATION ===
  async loginVnclear(page: Page, systemUrl: string, username: string, password: string): Promise<void>

  // === NAVIGATION ===
  async navigateToReport(page: Page, reportCfg: CcpReportConfig, systemUrl: string): Promise<string>
  // - Ưu tiên 1: Direct URL (cached_url từ config)
  // - Ưu tiên 2: Menu click (sidebar expand + parent_menu + child_menu)

  // === FILTERING ===
  async setDateRangeAndSearch(page: Page, startDate: string, endDate: string, opts: FilterOptions): Promise<void>
  // - Xóa "Ngày hệ thống" (DSGD)
  // - Click tab "Lịch sử tất toán" (TTTT)
  // - Điền Từ/Đến ngày (MUI DatePicker)
  // - Filter member_code & acct_no (Top Form hoặc Column Filter MRT)
  // - Click "Tìm kiếm" + chờ spinner sạch

  // === EXPORT ===
  async triggerExportDownload(page: Page, opts: ExportOptions): Promise<Download | 'NO_DATA' | null>
  // - Hover -> "Xuất tất cả"
  // - Fallback: Double-click "Kết xuất"
  // - Bắt toast NO_DATA sớm

  // === SAFETY NET ===
  async downloadWithAdaptiveSplit(page: Page, reportCfg: CcpReportConfig, interval: DateInterval, depth?: number): Promise<boolean>
  // - Chia đôi khoảng ngày đệ quy đến khi thành công hoặc xuống 1 ngày đơn
  // - Ghi MISSING_DATES.txt

  // === MERGE ===
  mergeCsvFiles(subFilePaths: string[], outputPath: string): boolean
  // - Giữ header dòng 1 của file đầu tiên

  // === ORCHESTRATOR ===
  async downloadReport(reportCfg: CcpReportConfig, interval: DateInterval, destDir: string, opts: DownloadOptions): Promise<boolean>
  async run(runOpts: CcpRunOptions): Promise<void>
}
```

**Interface & Types cần định nghĩa:**

```typescript
interface CcpReportConfig {
  code: 'NR' | 'DSL' | 'DSGD' | 'TTTT' | 'LSGTT';
  name: string;
  parentMenu: string;
  childMenu: string;
  tabName?: string;          // Dùng cho TTTT: "Lịch sử tất toán"
  cachedUrl?: string;        // Direct navigation URL
  systemType: 'CORE_CCP' | 'CORE_EX';
  enabled: boolean;
}

interface DateInterval {
  startStr: string;   // dd/mm/yyyy
  endStr: string;     // dd/mm/yyyy
  mmyy: string;       // mmyy label, ví dụ: "0726"
}

interface FilterOptions {
  exchange?: string;
  memberCode?: string;
  acctNo?: string;
}

interface DownloadOptions extends FilterOptions {
  headless: boolean;
  overwriteExisting: boolean;
  downloadTimeoutMs: number;
  autoSplitOnTimeout: boolean;
}

interface CcpRunOptions {
  systemUrl: string;
  username: string;
  password: string;
  startDate: string;
  endDate: string;
  outputDir: string;
  reports: CcpReportConfig[];
  options: DownloadOptions;
}
```

**Logic chi tiết từng hàm quan trọng:**

##### `waitForTableLoadingComplete(page, maxTimeoutMs = 60000)`
```
Spinner selector: MuiCircularProgress-root | MuiLinearProgress-root |
                  MuiBackdrop-root | [role=progressbar] | MuiSkeleton-root
- Sleep 800ms ban đầu để React kịp mount spinner
- Vòng lặp 300ms/tick
- Ổn định 2 tick liên tiếp không có spinner → return true
```

##### `setDateRangeAndSearch()` — Các thủ thuật đặc biệt
```
1. Nếu URL chứa PNL_EXECUTED (TTTT):
   → Click tab "Lịch sử tất toán" trước

2. Nếu có ô "Ngày hệ thống" (DSGD):
   → Xóa trắng: click → Ctrl+A → Backspace → Tab

3. DatePicker MUI:
   - Selector ưu tiên: label[contains(text(), 'Từ')] → input
   - Fallback: picker_inputs.nth(1) khi count >= 3, nth(0) khi count == 2
   - Clear: Ctrl+A + Backspace → type(date, delay=40ms) → Tab

4. Filter Mã thành viên:
   - Ưu tiên: Top Form input (label 'Mã thành viên')
   - Fallback: Column input trong thead MRT (//th[contains(.,'Mã thành viên')]//input)
   
5. Filter Số tiểu khoản / Mã TKGD:
   - Ưu tiên: Top Form input
   - Fallback: //th[contains(.,'Số tiểu khoản')]//input | //th[contains(.,'Mã TKGD')]//input
   - TUYỆT ĐỐI không bắt nhầm 'Số tài khoản'
   
6. Nếu header inputs = 0, click nút "Ẩn/hiện bộ lọc" trước:
   - //button[contains(@aria-label,'bộ lọc')]

7. Fast-skip: Nếu bảng có text "Không có dữ liệu" sau Tìm kiếm → return sớm
```

##### `triggerExportDownload()` — Phương án 1 & 2
```
Phương án 1 (Hover + Dropdown):
  - export_btn.hover()
  - Wait 400ms
  - Tìm: //li[contains(text(),'Xuất tất cả')]
  - Nếu visible: click + waitForEvent('download', timeout)
  - Check toast NO_DATA trong 400ms ngay sau click

Phương án 2 (Fallback Double-click):
  - export_btn.dblclick()
  - waitForEvent('download', timeout)
  - Check toast NO_DATA

Toast NO_DATA selector:
  //*[contains(@class,'notistack-Snackbar') or contains(@class,'MuiAlert-message')]
  [contains(text(),'dữ liệu') or contains(text(),'Không')]
```

##### `downloadWithAdaptiveSplit()` — Safety Net
```
Nếu tải nguyên tháng timeout:
  Lần 1: Split → Nửa 1 (01→mid) + Nửa 2 (mid+1→end)
  Nếu nửa nào vẫn timeout → Split tiếp (max depth = 4)
  Nếu xuống 1 ngày đơn → Retry 5 lần với backoff 15s, 30s, 45s, 45s, 45s
  Nếu 5 lần thất bại → Ghi vào MISSING_DATES.txt

Merge: Giữ header dòng 1 file đầu, bỏ header các file tiếp theo
File đặt tên: temp_{code}_{DDMMYYYY}_{DDMMYYYY}{suffix}.csv
Output cuối: {code}{MMYY}{suffix}.csv
```

#### [MODIFY] `bot-engine.module.ts`

Đăng ký `CcpCeDownloaderService` vào module providers/exports.

#### [MODIFY] `bot-engine.controller.ts`

Thêm 2 endpoint (hoặc mở rộng endpoint hiện có) để Admin có thể trigger thủ công:
- `POST /bot-engine/download-ccp-report` — Kích hoạt tải báo cáo CoreCCP
- `POST /bot-engine/download-ce-report` — Kích hoạt tải báo cáo CoreEX

Cấu hình đọc từ `bot_credentials_ccp` và `bot_credentials_ce` (đã có trong DB).

---

## Thứ Tự Thực Hiện

```
TASK-1 (nhỏ, độc lập, hoàn thành trước)
  ├── 1a. Sửa ConnectionSettings.tsx (Frontend)
  └── 1b. Sửa bot-engine.controller.ts (Backend)

TASK-2 (lớn hơn, sau TASK-1)
  ├── 2a. Tạo file ccp-ce-downloader.service.ts
  ├── 2b. Đăng ký vào bot-engine.module.ts
  └── 2c. Thêm endpoints vào bot-engine.controller.ts
```

---

## Kế Hoạch Kiểm Thử

### TASK-1
- ✅ `tsc --noEmit` Backend & Frontend không lỗi mới
- ✅ Vào UI Admin → Cấu hình kết nối → ACM: Thấy 2 ô mới `orderUrl` / `fillUrl`
- ✅ Lưu config → Reload lại trang → 2 ô vẫn giữ giá trị
- ✅ Xóa trống `orderUrl`/`fillUrl` → Bot vẫn tự ghép từ `url` base

### TASK-2
- ✅ `tsc --noEmit` Backend không lỗi mới
- ✅ (USER tự chạy) Trigger thủ công endpoint CCP/CE report với khoảng ngày 1 tuần → File CSV xuất hiện đúng thư mục
- ✅ Log hiển thị đúng URL điều hướng, trạng thái bộ lọc, kết quả tải

---

## Câu Hỏi Mở Cần USER Xác Nhận

> [!IMPORTANT]
> **Câu hỏi 1**: Khi Bot chạy tự động tải báo cáo CCP/CE, file CSV được lưu vào thư mục nào trên máy chủ Linux? Cần USER xác nhận đường dẫn (lấy từ `system_configs` hay tham số cố định trong job)?

> [!IMPORTANT]
> **Câu hỏi 2**: Tại TASK-2, Bot chạy tải file CCP/CE có cần tích hợp vào hệ thống Job Queue (`BotJob`) hiện tại như các tác vụ RPA khác không, hay chỉ cần expose API để gọi thủ công trước?

> [!NOTE]
> **Câu hỏi 3**: Các báo cáo nào trong số `NR`, `DSL`, `DSGD`, `TTTT`, `LSGTT` là **ưu tiên triển khai trước** phục vụ đối chiếu EOD ngay? (Để tập trung port phần đó trước, phần còn lại sau.)
