# TỔNG HỢP TOÀN BỘ NGỮ CẢNH CÔNG VIỆC: BACKUP CE & CẤU HÌNH TỆP SAO LƯU

> **Thời điểm lập tài liệu:** 28/10/2026  
> **Workspace:** `c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor`  
> **Repository:** `broly1009a/mxv-shift-checklist` (Branch: `v4-refactor`)  
> **Mục tiêu:** Tổng hợp toàn bộ bối cảnh phân tích, số liệu thực tế, hiện trạng lỗi và tài liệu thiết kế từ các phiên làm việc ngày 27/10/2026 để phục vụ việc fix code và phát triển tính năng hôm nay.

---

## I. HIỆN TRẠNG ĐỐI CHIẾU BACKUP CE (GROUND TRUTH NGÀY 26.10)

### 1. Thông tin lưu trữ trên ổ đĩa mạng `M:`
- **Thư mục gốc:** `M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CE\Futures\2026\T10.2026`
- **Thư mục tải thủ công đối chứng:** `26.10 - Check` (**12 file**, chuẩn nghiệp vụ IT)
- **Thư mục tải tự động (Modular Ingress V2):** `26.10` (**21 file**, phát sinh nhiều file thừa/rỗng)

---

### 2. Bảng Đối Chiếu Chi Tiết 12 File Nghiệp Vụ Cốt Lõi

| # | Tên File Chuẩn | Thủ công (`26.10 - Check`) | Tự động (`26.10`) | Trạng thái | Đánh giá & Nguyên nhân gốc rễ |
| :-: | :--- | :--- | :--- | :---: | :--- |
| **1** | **`DSTKGD ACM.xlsx`** | **10,185 dòng** (6.54 MB) | ❌ **KHÔNG CÓ** | ⛔ **Thiếu hoàn toàn** | Thiếu định nghĩa trong [coreex-reports.config.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/domain-configs/coreex-reports.config.ts). Bot mới chỉ tải file này về thư mục CCP (`10,186 dòng`), chưa có bước sao chép hoặc tải bổ sung sang thư mục CE. |
| **2** | **`DSGD ACM CE.xlsx`** | **1,017 dòng** (102.3 KB) | ⚠️ **0 dòng (6.3 KB)** | ⚠️ **File rỗng** | `ORDERMATCH_DETAIL_ACM` trong phiên chưa lấy được dữ liệu; fallback sang `convertJsonToExcel()` tạo file trắng chỉ có header. Cần kiểm tra endpoint API và payload tham số thời gian/trạng thái khớp lệnh. |
| **3** | **`DSLCK ACM CE.xlsx`** | **240 dòng** (39.1 KB) | ⚠️ **0 dòng (6.3 KB)** | ⚠️ **File rỗng** | Sổ lệnh `/ORDERS/ORDERBOOK_ACM` chưa trích xuất đúng tab *Lệnh chờ khớp* hoặc thiếu filter trạng thái `PENDING` / `WAITING_MATCH`. |
| **4** | **`GTT ACM.xlsx`** | **12 dòng** (25.1 KB) | ⚠️ **0 dòng (6.3 KB)** | ⚠️ **File rỗng** | SearchCode `SETTLEMENT_ACM` qua direct API trả về mảng rỗng `[]` tại thời điểm quét. Cần kiểm tra lại tham số ngày phiên hoặc thời điểm lấy giá thanh toán bù trừ. |
| **5** | **`TTM CE.xlsx`** | **3,163 dòng** (356.6 KB) | ⚠️ **746 dòng (55.2 KB)** | ⚠️ **Lệch bản chất** | **Lệch cấp độ dữ liệu:** Thủ công lấy mức Giao dịch (*Trade-level*, 3,163 dòng); Auto lấy mức Tài khoản (*Account-level*, 746 dòng). Cần đổi endpoint hoặc tham số gom nhóm sang chi tiết giao dịch. |
| **6** | **`DSLDK ACM CE.xlsx`** | **1,009 dòng** (151.2 KB) | **1,406 dòng** (303.8 KB) | ⚠️ Lệch biên thời gian | Lệch biên thời gian quét/tiêu chí lọc giữa 2 bên. Cần chốt lại khoảng thời gian quét chuẩn của phiên. |
| **7** | **`DSLH ACM CE.xlsx`** | **2,476 dòng** (315.6 KB) | **2,476 dòng** (318.5 KB) | ✅ **Khớp 100%** | Danh sách lệnh hủy lấy dữ liệu hoàn toàn chính xác. |
| **8** | **`DSL ACM CE.xlsx`** | **3,722 dòng** (475.2 KB) | **3,722 dòng** (480.8 KB) | ✅ **Khớp 100%** | Danh sách sổ lệnh tổng thể lấy dữ liệu chuẩn xác. |
| **9** | **`HH ACM CE.xlsx`** | **36 dòng** (12.3 KB) | **36 dòng** (12.1 KB) | ✅ **Khớp 100%** | Hàng hóa lấy chuẩn. |
| **10** | **`HD ACM CE.xlsx`** | **122 dòng** (21.7 KB) | **122 dòng** (21.3 KB) | ✅ **Khớp 100%** | Hợp đồng lấy chuẩn. |
| **11** | **`SESSION_CONFIG`** | ❌ Không dùng | 1 dòng (7.4 KB) | 🗑️ File thừa | Không cần thiết trong bộ sao lưu chuẩn của vận hành. |
| **12** | **`SESSION_INFO`** | ❌ Không dùng | 1 dòng (7.5 KB) | 🗑️ File thừa | Không cần thiết trong bộ sao lưu chuẩn của vận hành. |

---

### 3. Quy Tắc Xử Lý File Giá Thanh Toán CCP (`GTT trước 6h.xlsx` vs `GTT CCP.xlsx`)
- **Yêu cầu nghiệp vụ:**
  - Nếu backup định kỳ **trước 06:00 sáng**: Tự động tạo file `GTT trước 6h.xlsx` (chứa dữ liệu giá thanh toán tạm tính).
  - Nếu backup **sau 06:00 sáng**: Tạo file chuẩn `GTT CCP.xlsx`.
  - **Quy tắc bảo vệ dữ liệu:** Nếu đã qua mốc 06:00 sáng, tuyệt đối **không được ghi đè** đè lại nội dung tạm tính của file trước 6h.

---

## II. THIẾT KẾ NÚT & MODAL CẤU HÌNH TỆP SAO LƯU (BACKUP CONFIG SPEC)

### 1. Bối cảnh & Mục tiêu
- **Trang áp dụng:**
  1. `https://10.0.0.26/trading-manager/backup/ms-cqg` (quản lý MS, CQG, Straits)
  2. `https://10.0.0.26/trading-manager/backup/ccp-ce` (quản lý CoreCCP, CoreEX)
- **Mục tiêu:** Cho phép người dùng trực tiếp tích chọn/bỏ chọn danh mục tệp sao lưu mặc định cho từng phân hệ qua giao diện Web, lưu cấu hình vào MongoDB `system_settings`, không hardcode danh mục tệp tĩnh trong mã nguồn backend.

---

### 2. Thiết Kế Lưu Trữ CSDL (MongoDB `system_settings`)

| Key Cấu hình | Phân hệ | Kiểu dữ liệu | Giá trị khuyến nghị mặc định |
| :--- | :--- | :--- | :--- |
| `bot_backup_selected_reports_ms` | M-System | JSON Array String | `["DSGD","KQGD_TOAN_THI_TRUONG","KQGD_THEO_TAI_KHOAN","VI_THE_MO"]` |
| `bot_backup_selected_reports_cqg` | CQG | JSON Array String | `["FR","PS","OP","OD"]` *(Tự động gộp cặp FR1+FR2, PS1+PS2...)* |
| `bot_backup_selected_reports_ccp` | CoreCCP | JSON Array String | `["BC01","BC02","BC05","BC06","BC08","BC12","BC14","BC20","BC21","BC22","BC25","DSTKGD_ACM"]` |
| `bot_backup_selected_reports_ce` | CoreEX | JSON Array String | `["DSGD","DSL","DSLCK","DSLDK","DSLH","GTT","HH","HD","TTM","DSTKGD_ACM"]` *(Loại bỏ file rỗng MM)* |
| `bot_backup_selected_reports_acm` | ACM Straits | JSON Array String | `["FILL","ORDER","SFTP_CSV"]` |

---

### 3. Thiết Kế Giao Diện Frontend

#### 3.1. Vị trí Icon Cấu hình
- Sử dụng icon `Pencil` từ `lucide-react` (kích thước `13px-14px`), đặt cạnh tiêu đề của từng Card phân hệ:
  - Header Card `Backup MS`, `Backup CQG`, `Backup CoreCCP`, `Backup CoreEX`, `Backup ACM`.
- Bổ sung nút `Cấu hình tệp mặc định` (icon `Sliders`) trên Header Bar chính cạnh bộ chọn ngày.

#### 3.2. Modal `BackupFileConfigModal.tsx`
- **Đường dẫn:** `frontend/src/app/trading-manager/components/modals/BackupFileConfigModal.tsx`
- **Tabs:** `M-System`, `CQG`, `CoreCCP`, `CoreEX`, `ACM`.
- **Hiển thị từng tệp:** Checkbox, Tên mã (`key`), Tên file vật lý (`filename`), Tag phân loại:
  - `Cốt lõi (Bắt buộc)`: Tag xanh lá (`#10b981`)
  - `Khuyên dùng`: Tag xanh dương (`#3b82f6`)
  - `Chưa dùng / Có thể bỏ`: Tag vàng cam (`#f59e0b`)
  - `Market Maker (Rỗng)`: Tag xám (`#6b7280`)
- **Tác vụ nhanh:** `Chọn tất cả`, `Bỏ chọn file thừa/rỗng`, `Khôi phục mặc định`.

---

### 4. Kiến Trúc Tầng Backend (Data-Driven Helper)

Xây dựng helper tiện ích tại `backend/src/modules/ingress/helpers/ingress-helper.ts`:
```typescript
export async function getEffectiveReportTargets(
  settingsService: SystemSettingsService,
  systemKey: 'MS' | 'CQG' | 'CCP' | 'CE' | 'ACM',
  explicitReports?: string[],
): Promise<string[]> {
  // 1. Ưu tiên danh mục truyền trực tiếp từ client khi bấm tải tức thời
  if (explicitReports && explicitReports.length > 0) {
    return explicitReports;
  }

  // 2. Đọc từ CSDL MongoDB system_settings
  const settingKey = `bot_backup_selected_reports_${systemKey.toLowerCase()}`;
  const savedConfig = await settingsService.getSetting(settingKey, '');
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {}
  }

  // 3. Fallback danh mục mặc định chuẩn nếu DB chưa cấu hình
  return RECOMMENDED_DEFAULT_TARGETS[systemKey];
}
```

---

## III. BẢN ĐỒ MÃ NGUỒN LIÊN QUAN TRONG WORKSPACE

| Thành phần | Đường dẫn File trong Dự án | Trách nhiệm chính |
| :--- | :--- | :--- |
| **CE Reports Config** | [coreex-reports.config.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/domain-configs/coreex-reports.config.ts) | Định nghĩa mã báo cáo, URL, API endpoint và tên file xuất cho CoreEX. |
| **CCP Reports Config** | [coreccp-reports.config.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/domain-configs/coreccp-reports.config.ts) | Định nghĩa 25 báo cáo CCP và cơ chế tải `DSTKGD ACM`. |
| **CCP/CE Scraper** | [ccp-ce-scraper.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/scrapers/ccp-ce-scraper.service.ts) | Crawler Playwright / API Client tải báo cáo từ hệ thống CoreCCP và CoreEX. |
| **Download Handler** | [ccp-ce-download.handler.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/handlers/ccp-ce-download.handler.ts) | Điều phối Job tải CCP và CE theo hàng đợi. |
| **Ingress Controller** | [ingress-download.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/controllers/ingress-download.controller.ts) | Tiếp nhận các lệnh trigger download từ giao diện người dùng. |
| **UI Backup MS/CQG** | [LegacyBackupThongKeSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx) | Giao diện quản lý sao lưu MS, CQG, Straits. |
| **UI Backup CCP/CE** | [CcpCeBackupThongKeSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/frontend/src/app/trading-manager/components/core-ccp/CcpCeBackupThongKeSection.tsx) | Giao diện quản lý sao lưu CCP và CE. |

---

## IV. KẾ HOẠCH HÀNH ĐỘNG CHI TIẾT (ACTION PLAN)

### 📌 Bước 1: Fix triệt để 5 file Backup CE bị lỗi / thiếu
1. **Bổ sung `DSTKGD ACM.xlsx` sang CE:** Thêm cấu hình copy hoặc tải trực tiếp vào thư mục CE trong [ccp-ce-scraper.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/scrapers/ccp-ce-scraper.service.ts).
2. **Sửa `DSGD ACM CE.xlsx` (bị 0 dòng):** Kiểm tra lại tham số gọi `ORDERMATCH_DETAIL_ACM`, đảm bảo nhận đúng dữ liệu khớp lệnh thay vì rỗng.
3. **Sửa `DSLCK ACM CE.xlsx` (bị 0 dòng):** Cập nhật filter tab *Lệnh chờ khớp* trên `ORDERBOOK_ACM`.
4. **Sửa `GTT ACM.xlsx` (bị 0 dòng):** Kiểm tra lại payload SearchCode `SETTLEMENT_ACM`.
5. **Chỉnh lại cấp độ `TTM CE.xlsx`:** Chuyển từ cấp độ gom nhóm tài khoản sang cấp độ chi tiết từng giao dịch (*Trade-level*, kỳ vọng ~3,163 dòng).

### 📌 Bước 2: Tích hợp logic tệp GTT trước/sau 06:00
- Áp dụng kiểm tra mốc thời gian: trước 06:00 lưu `GTT trước 6h.xlsx`, sau 06:00 lưu `GTT CCP.xlsx` (không ghi đè file trước 6h).

### 📌 Bước 3: Triển khai Modal cấu hình tệp sao lưu
- Xây dựng component `BackupFileConfigModal.tsx`.
- Gắn icon `Pencil` vào các Card header trên [LegacyBackupThongKeSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx) và [CcpCeBackupThongKeSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/frontend/src/app/trading-manager/components/core-ccp/CcpCeBackupThongKeSection.tsx).
- Tích hợp API đọc/ghi MongoDB `system_settings`.

### 📌 Bước 4: Kiểm thử & Quality Gates
- Chạy `npx tsc --noEmit` & `npm run build` trên cả Backend và Frontend.
- Đối chiếu lại toàn bộ file sinh ra với thư mục `26.10 - Check`.
