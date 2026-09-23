# BÁO CÁO PHÂN TÍCH TỔNG HỢP LỖI HỆ THỐNG BOT RPA TẢI BÁO CÁO VÀ ĐỐI CHIẾU DỮ LIỆU
**Dự án:** MXV Shift Checklist / CQG Download Investigation  
**Ngày lập:** 23/09/2026  
**Môi trường:** Backend NestJS chạy trên Ubuntu Linux Server (CIFS/SMB Mount `/mnt/qlgd-it/`), Frontend Next.js, Trình duyệt Playwright Headless/Headed, Windows Client (Ổ mạng `M:\`).

---

## MỤC LỤC
1. [Tổng quan hiện tượng và Tác động vận hành](#1-tổng-quan-hiện-tượng-và-tác-động-vận-hành)
2. [Bug 1: Lỗi Timeout 90s khi tải Báo cáo TTM (Vị thế mở) M-System](#2-bug-1-lỗi-timeout-90s-khi-tải-báo-cáo-ttm-vị-thế-mở-m-system)
3. [Bug 2: Bot báo "1/3 Thành công" dù thiếu file (Nuốt lỗi & Không Retry)](#3-bug-2-bot-báo-13-thành-công-dù-thiếu-file-nuốt-lỗi--không-retry)
4. [Bug 3: Lỗi Phân tách Đường dẫn Lai Windows/Linux dẫn đến Lưu File Ma và Đối Chiếu Sai](#4-bug-3-lỗi-phân-tách-đường-dẫn-lai-windowslinux-dẫn-đến-lưu-file-ma-và-đối-chiếu-sai)
5. [Bug 4: Bất đồng bộ Cấu hình Đường dẫn giữa Trading Manager và Bot Config](#5-bug-4-bất-đồng-bộ-cấu-hình-đường-dẫn-giữa-trading-manager-và-bot-config)
6. [Ma trận Đối chiếu So sánh (File Test vs Backend Production)](#6-ma-trận-đối-chiếu-so-sánh-file-test-vs-backend-production)
7. [Kế hoạch và Giải pháp Khắc phục Triệt để](#7-kế-hoạch-và-giải-pháp-khắc-phục-triệt-để)

---

## 1. TỔNG QUAN HIỆN TƯỢNG VÀ TÁC ĐỘNG VẬN HÀNH

Trong quá trình vận hành bot tự động và thao tác thủ công trên giao diện Web (màn hình **Trading Manager** và **Bot Config**), đội ngũ vận hành ghi nhận 3 bất thường nghiêm trọng:
1. **Tải báo cáo M-System bị treo/timeout tại báo cáo `TTM`**: Dù 19/20 báo cáo khác tải rất nhanh (2-5s), báo cáo TTM luôn kẹt 90 giây và báo lỗi `Timeout 90000ms exceeded while waiting for event "download"`.
2. **Báo cáo thành công ảo**: Dù bị thiếu file TTM, Job vẫn thông báo "Lần thử: 1/3 Thành công" và kết thúc mà không chạy lần thử 2 và 3 để bù file lỗi.
3. **Mất file trên ổ `M:\` và Kết quả Đối chiếu bị LỆCH giả**: Bot báo đã tải thành công tất cả dữ liệu (MS, CQG, ACM, CoreCCP), nhưng khi mở ổ mạng `M:\` trên máy Windows thì hoàn toàn không thấy file mới. Đồng thời, bước đối chiếu khớp lệnh tự động `CHECK_KLGD` luôn báo kết quả **LỆCH**.

---

## 2. BUG 1: LỖI TIMEOUT 90S KHI TẢI BÁO CÁO TTM (VỊ THẾ MỞ) M-SYSTEM

### 2.1. Hiện tượng & Log thực tế
```text
[2026-09-23T02:55:29.829Z] Downloading report: NKTTHT (as NKTTHT.xlsx)... -> Thành công
... (19 báo cáo tải thành công)
[2026-09-23T02:59:15.120Z] Downloading report: TTM (as TTM.xlsx)...
page.waitForEvent: Timeout 90000ms exceeded while waiting for event "download"
```

### 2.2. Bằng chứng mã nguồn & Nguyên nhân gốc rễ (Root Cause)
1. **Selector xuất file bị tranh chấp**:
   Tại [msystem-tab-navigator.helper.ts#L49-L60](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/helpers/msystem-tab-navigator.helper.ts#L49-L60):
   ```typescript
   export const MS_EXPORT_BUTTON_SELECTORS = [
     'button.ladda-button:has(i.fa-file-excel)',
     'button:has(i.fa-file-excel)',
     'button.ladda-button:has(i.fa-file-csv)',
     'button:has(i.fa-file-csv)',
     'button.btn-info', // ⛔ Nguy cơ tranh chấp selector
     'i.fa-file-excel',
     'i.fa-file-csv',
     "button:has-text('Xuất file')",
     "button:has-text('Xuất Excel')",
     "button[title*='Export' i]",
   ].join(', ');
   ```
2. **Thao tác Click nhầm Element**:
   Tại [rpa-downloader.service.ts#L759-L775](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/rpa-downloader.service.ts#L759-L775):
   ```typescript
   const downloadPromise = page.waitForEvent('download', { timeout: customTimeoutMs });
   await page.locator(MS_EXPORT_BUTTON_SELECTORS).first().click({ force: true });
   const download = await downloadPromise;
   ```
   - Trang TTM (`#/positionManagement/openPositionInfo`) chứa khối lượng dữ liệu lớn (>8.600 dòng vị thế).
   - Trong DOM của trang này, có các button mang class `btn-info` (như nút "Tìm kiếm" hoặc nút trạng thái) xuất hiện trước nút xuất Excel trong cấu trúc DOM tree.
   - Khi gọi `.first()`, Playwright click trúng button này thay vì nút xuất file. Vì element này không phát sinh sự kiện tải file, `page.waitForEvent('download')` chờ đến khi hết hạn 90s và throw TimeoutError.
3. **Kiểm chứng khắc phục**:
   Trong script kiểm thử [test_ms_tab_downloads.js#L474-L480](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/scripts/test_ms_tab_downloads.js#L474-L480), khi tách riêng và ưu tiên selector icon cụ thể (`button:has(i.fa-file-excel), button.ladda-button:has(i.fa-file-excel)...`), báo cáo TTM tải thành công **936.1 KB chỉ trong 20.3 giây**.

---

## 3. BUG 2: BOT BÁO "1/3 THÀNH CÔNG" DÙ THIẾU FILE (NUỐT LỖI & KHÔNG RETRY)

### 3.1. Hiện tượng & Log thực tế
- Giao diện Hàng đợi Job hiển thị: **Lần thử: 1/3 - Thành công (COMPLETED)**.
- Người dùng kiểm tra thư mục thì thấy thiếu file `TTM.xlsx`.

### 3.2. Bằng chứng mã nguồn & Nguyên nhân gốc rễ
1. **Quy tắc kiểm tra hoàn thành lỏng lẻo**:
   Tại [rpa-download.handler.ts#L271-L278](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/rpa-download.handler.ts#L271-L278):
   ```typescript
   // ⛔ LỖI: Chỉ ném ngoại lệ khi 0 có file nào tải thành công
   if (successfulTargets.length === 0) {
     throw new Error(
       `Tất cả ${targets.length} báo cáo đều tải thất bại: ${failedTargets.map((f) => `${f.target}: ${f.error}`).join('; ')}`,
     );
   }
   return { success: true, successfulTargets, failedTargets };
   ```
   Vì 19 báo cáo trước đó đã tải thành công, `successfulTargets.length = 19 > 0`. Hàm xử lý return bình thường mà không throw Error.
2. **Hàng đợi đánh dấu Job thành công**:
   Tại [bot-job-queue.service.ts#L422-L435](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/bot-job-queue.service.ts#L422-L435):
   ```typescript
   job.status = 'COMPLETED';
   job.completedAt = new Date();
   await job.save();
   ```
   Do không có lỗi nào bắn ra ngoài, khối `catch` phụ trách tăng `attempt` lên 2/3 không được kích hoạt. Job kết thúc ngay ở lần 1/3.
   *Vi phạm:* Quy tắc Fail-Fast & Zero-Silent-Swallow (Mục 1.4 AGENTS.md).

---

## 4. BUG 3: LỖI PHÂN TÁCH ĐƯỜNG DẪN LAI WINDOWS/LINUX DẪN ĐẾN LƯU FILE MA VÀ ĐỐI CHIẾU SAI

### 4.1. Hiện tượng & Log thực tế
Trong log Job `6ab397f80ba2c3fca59e1fac` (Đối chiếu khớp lệnh định kỳ):
```text
[2026-09-23T09:13:09.171Z] ACM: Tải và lưu file thành công: M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup ACM\Futures/2026/T09.2026/23.09/Order.xlsx
[2026-09-23T09:16:03.467Z] Hoàn thành đối chiếu khớp lệnh định kỳ trong phiên.
[2026-09-23T09:16:03.467Z] Kết quả: LỆCH
```
Đường dẫn xuất hiện hiện tượng lai: phần đầu dùng dấu gạch chéo ngược Windows `\`, phần sau dùng dấu gạch chéo xuôi Linux `/`.

### 4.2. Bằng chứng mã nguồn & Nguyên nhân gốc rễ
1. **Môi trường thực thi:**
   Backend NestJS chạy trên hệ điều hành **Ubuntu Linux**. Ký tự phân cách đường dẫn chuẩn của hệ thống `path.sep` là dấu `/`.
2. **Đường dẫn gốc trong CSDL:**
   Biến `bot_backup_path_ms`, `bot_backup_path_cqg`, `bot_backup_path_acm` lưu dạng Windows:
   `M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures`.
3. **Nối chuỗi không chuẩn hóa:**
   Tại [recon-jobs.handler.ts#L148-L182](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L148-L182) và [rpa-download.handler.ts#L107-L122](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/rpa-download.handler.ts#L107-L122):
   ```typescript
   const msBackupBase = await this.settingsService.getSetting('bot_backup_path_ms', defaultMsPath);
   // ⛔ THIẾU resolveStoragePathCrossPlatform(msBackupBase)
   const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
   const msDailyPath = path.join(msBackupBase, subFolder);
   ```
   - Đối với Linux, ký tự `\` không phải là dấu phân cách thư mục mà là ký tự hợp lệ trong tên file.
   - Hàm `path.join` nối thêm `/2026/T09.2026/23.09` vào đuôi $\rightarrow$ Node.js tạo một thư mục ma cục bộ ngay trong thư mục chạy của server Ubuntu: `/home/ubuntu/mxv-shift-checklist/backend/M:\Tailieuchung\...`.
   - File tải mới được lưu vào thư mục ma này trên server, **hoàn toàn không được đẩy vào ổ đĩa mạng chia sẻ `/mnt/qlgd-it/` (tương ứng ổ `M:\` trên Windows)**.
4. **Tại sao đối chiếu lại báo LỆCH?**
   Tại [klgd-recon.service.ts#L698-L710](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/klgd-recon.service.ts#L698-L710):
   ```typescript
   const msBackupBase = resolveStoragePathCrossPlatform(
     await this.settingsService.getSetting('bot_backup_path_ms', ...),
   );
   ```
   Hàm đối chiếu lại **CÓ BỌC** `resolveStoragePathCrossPlatform`, do đó nó đọc file từ `/mnt/qlgd-it/...`.
   Vì các file tải mới bị lưu lạc trong thư mục ma, tại `/mnt/qlgd-it/...` chỉ tồn tại file cũ từ phiên trước $\rightarrow$ **Kết quả so khớp bị LỆCH giả hoàn toàn!**

---

## 5. BUG 4: BẤT ĐỒNG BỘ CẤU HÌNH ĐƯỜNG DẪN GIỮA TRADING MANAGER VÀ BOT CONFIG

### 5.1. Bằng chứng mã nguồn
Tại màn hình Trading Manager ([TradingManagerConfigSection.tsx#L153-L165](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx#L153-L165)):
```typescript
// Giao diện tự động convert ngược /mnt/qlgd-it/ thành M:\ khi tải lên màn hình:
setBotBackupPathMs(toWindowsM(map.bot_backup_path_ms || ''));
setBotBackupPathCqg(toWindowsM(map.bot_backup_path_cqg || ''));
setBotBackupPathAcm(toWindowsM(map.bot_backup_path_acm || ''));
```
Khi người dùng bấm **"Lưu cấu hình"** tại [TradingManagerConfigSection.tsx#L344-L355](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx#L344-L355):
Nó gửi toàn bộ chuỗi Windows `M:\Tailieuchung\...` lưu đè vào MongoDB `system_settings`.

### 5.2. Sự khác biệt giải thích tại sao trước đó chạy được
- **Trước khi lưu trên Trading Manager:** Cấu hình trong MongoDB có thể đang chứa đường dẫn Linux `/mnt/qlgd-it/...` (do Admin nhập trực tiếp trên server hoặc ở màn cấu hình khác). Khi đó, các handler chưa bọc hàm chuyển đổi vẫn tình cờ chạy đúng vì chuỗi là `/mnt/qlgd-it/...`.
- **Sau khi bấm Lưu trên Trading Manager:** Chuỗi trong MongoDB bị ghi đè thành `M:\Tailieuchung\...`. Từ thời điểm này, cả nút bấm tải trên Trading Manager và Bot chạy đối chiếu định kỳ đều bị dính lỗi đường dẫn lai và ghi file vào thư mục ma.

---

## 6. MA TRẬN ĐỐI CHIẾU SO SÁNH (FILE TEST VS BACKEND PRODUCTION)

| Tiêu chí | File Test `test_ms_tab_downloads.js` (20/20 PASS) | Backend Production (`rpa-downloader.service.ts` & Handlers) | Trạng thái & Giải pháp |
| :--- | :--- | :--- | :--- |
| **URL Navigation** | Direct Hash `#/...` + Click SubTab | Direct Hash `#/...` + Click SubTab |  Đồng nhất 100% |
| **Selector nút Xuất file** | Ưu tiên `button:has(i.fa-file-excel), i.fa-file-excel...` loại trừ nút generic | Dùng `MS_EXPORT_BUTTON_SELECTORS` gộp chung `button.btn-info` | ❌ Production click nhầm $\rightarrow$ Cần đồng bộ selector từ file test |
| **Xử lý Timeout TTM** | Thành công trong **20.3s** (file 936 KB) | Bị timeout sau **90s** | ❌ Cần sửa selector và chờ bảng render |
| **Đường dẫn Lưu file** | Lưu theo path tham số truyền vào (`--dest`) | Lấy từ DB nhưng **thiếu** `resolveStoragePathCrossPlatform` | ❌ Ghi file vào thư mục ma $\rightarrow$ Cần bọc hàm chuyển đổi chéo OS |
| **Cơ chế Báo lỗi & Retry** | Log chi tiết từng file, báo đúng PASS/FAIL | Nếu `successfulTargets > 0` thì nuốt lỗi, không retry lần 2/3 | ❌ Cần throw Error khi còn file lỗi để kích hoạt retry 2/3 |

---

## 7. KẾ HOẠCH VÀ GIẢI PHÁP KHẮC PHỤC TRIỆT ĐỂ

### 7.1. Chuẩn hóa Bộ chuyển đổi Đường dẫn Đa nền tảng (Cross-Platform Path Resolution)
Bọc `resolveStoragePathCrossPlatform(...)` cho toàn bộ các điểm tiếp nhận cấu hình đường dẫn tại Backend:
1. **[recon-jobs.handler.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L148-L158)**:
   ```typescript
   const msBackupBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting('bot_backup_path_ms', defaultMsPath));
   const cqgBackupBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting('bot_backup_path_cqg', defaultCqgPath));
   const acmBackupBase = resolveStoragePathCrossPlatform((await this.settingsService.getSetting('bot_backup_path_acm', '')) || path.join(path.dirname(msBackupBase), 'ACM'));
   ```
2. **[rpa-download.handler.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/rpa-download.handler.ts#L107-L109)**:
   ```typescript
   const rawBackupMs = payload.backupPathMs || (await getMsBackupBase(this.settingsService));
   const backupMsBase = resolveStoragePathCrossPlatform(rawBackupMs);
   ```
3. **[bot-path.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/helpers/bot-path.helper.ts#L116-L153)**:
   Bọc `resolveStoragePathCrossPlatform` bên trong `getMsBackupBase`, `getCqgBackupBase`, `getAcmBackupBase`.

### 7.2. Tối ưu Selector Xuất file & Ngăn chặn Click Nhầm
Trong [msystem-tab-navigator.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/helpers/msystem-tab-navigator.helper.ts) và [rpa-downloader.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/rpa-downloader.service.ts):
- Tách riêng danh sách selector đặc hiệu cao:
  ```typescript
  const SPECIFIC_EXPORT_SELECTORS = [
    'button.ladda-button:has(i.fa-file-excel)',
    'button:has(i.fa-file-excel)',
    'button.ladda-button:has(i.fa-file-csv)',
    'button:has(i.fa-file-csv)',
    'i.fa-file-excel',
    'i.fa-file-csv',
    "button:has-text('Xuất file')",
    "button:has-text('Xuất Excel')",
    "button[title*='Export' i]",
  ].join(', ');
  ```
- Kiểm tra `SPECIFIC_EXPORT_SELECTORS` hiển thị trước khi fallback sang `button.btn-info`.

### 7.3. Sửa Logic Báo lỗi & Kích hoạt Retry Thông minh
Tại [rpa-download.handler.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/rpa-download.handler.ts#L271):
- Nếu `failedTargets.length > 0`: ném ngoại lệ mô tả danh sách các file thất bại để hàng đợi bot kích hoạt **lần thử 2/3 và 3/3**.
- Ở lần thử tiếp theo, bot chỉ tải lại danh sách các file trong `failedTargets` thay vì tải lại toàn bộ 20 file từ đầu.
