# QUY TRÌNH & HƯỚNG DẪN DI CHUYỂN MÃ NGUỒN CŨ VÀO LEGACY KHI HỆ THỐNG V2 ỔN ĐỊNH
> **Tài liệu chuyển giao kỹ thuật (Migration & Retirement Playbook)**  
> **Dự án**: MXV Shift Checklist & Trading Operation System  
> **Kiến trúc áp dụng**: Strangler Fig Pattern (Giai đoạn 3: Deprecation & Archiving)  
> **Ngày lập**: 13/10/2026

---

## 1. Điều Kiện Kích Hoạt Dọn Dẹp (Readiness Criteria / Exit Gate)

> [!IMPORTANT]
> **Tuyệt đối KHÔNG thực hiện dọn dẹp hoặc xóa mã nguồn cũ** cho đến khi thỏa mãn đầy đủ **3 điều kiện tiên quyết** dưới đây:

1. **Điều kiện 1 (Thời gian chạy song song - Parallel Run)**:
   - Giao diện mới [`/trading-manager-v2`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager-v2/page.tsx) đã được đội ngũ Trực ca / Vận hành sử dụng thực tế trong ít nhất **01 - 02 tuần giao dịch liên tục** (tối thiểu 5 - 10 phiên).
   - Kết quả đối soát KLGD, TTM, TTTT và Pre-EOD trên V2 khớp **100%** với kết quả thực tế của công cụ C# gốc và phiên trực.

2. **Điều kiện 2 (Zero Critical Bugs trên V2 API)**:
   - Lớp API tập trung tại [`frontend/src/features/trading/`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/features/trading/) hoạt động ổn định, không có lỗi Unhandled Promise Rejection, không có lỗi mất kết nối Token hoặc sai lệch định dạng dữ liệu DTO.

3. **Điều kiện 3 (Phê duyệt từ Tech Lead / User)**:
   - Có xác nhận đồng ý chính thức từ Trưởng ca / Quản trị viên hệ thống để chuyển đổi hoàn toàn sang bản V2 làm màn hình mặc định.

---

## 2. Ma Trận Đối Chiếu Mã Nguồn: Cũ (Legacy) $\rightarrow$ Mới (V2 Target)

### 2.1. Phân Hệ Backend (NestJS)

| Phân hệ / Nghiệp vụ | Vị trí Cũ Cần Đóng Gói Sang `legacy/` | Vị trí Mới Thay Thế Vĩnh Viễn (Modular V2) |
| :--- | :--- | :--- |
| **Thống kê Khối lượng Lot CCP** | [`backend/src/modules/lot-statistics/`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/lot-statistics/) | [`backend/src/modules/ccp-clearing/services/lot-statistics.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-clearing/services/lot-statistics.service.ts) (`CcpLotWorker`) |
| **Báo cáo CCP Thống kê** | [`backend/src/modules/ccp-statistics/`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/) | [`backend/src/modules/ccp-clearing/`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-clearing/) |
| **Ghép nối File Thô CQG** | [`backend/src/modules/cqg-sync/`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/cqg-sync/) | [`backend/src/modules/trading-ops/services/cqg-merger.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/cqg-merger.service.ts) (`CqgMergerService`) |
| **Quét Ký Quỹ Âm / IMR** | [`backend/src/modules/margin-checker/`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/margin-checker/) | [`backend/src/modules/trading-ops/services/margin-checker.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/margin-checker.service.ts) (`NegativeMarginWorker`) |
| **Thin Adapter Đối Soát** | [`backend/src/modules/reconciliation/`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/) | [`backend/src/modules/trading-ops/`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/) |

*(Ghi chú: Tệp backup 6.000 dòng `reconciliation.service.backup.ts` đã được dọn sang [`backend/src/legacy/archive/`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/legacy/archive/) từ Giai đoạn 1).*

---

### 2.2. Phân Hệ Frontend (Next.js React)

| Tệp tin Cũ Cần Đóng Gói | Dung lượng | Vị trí Mới Thay Thế Vĩnh Viễn |
| :--- | :--- | :--- |
| [`frontend/src/app/trading-manager/page.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/page.tsx) | 505 dòng | Thay thế bằng [`frontend/src/app/trading-manager-v2/page.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager-v2/page.tsx) |
| [`LegacyReconSection.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx) | 112 KB (2.329 dòng) | [`tradingOpsApi.getConsoleSummary()`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/features/trading/services/trading-ops.api.ts) & UI V2 Tab 1 |
| [`LegacyBackupThongKeSection.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx) | 87 KB (2.000 dòng) | [`tradingBotApi`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/features/trading/services/trading-bot.api.ts) & UI V2 Tab 3 |
| [`CcpLotStatisticsSection.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx) | 100 KB (2.248 dòng) | [`ccpClearingApi`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/features/trading/services/ccp-clearing.api.ts) & UI V2 Tab 2 |
| Toàn bộ thư mục con `legacy-ms-cqg/` | 9 files | Lưu trữ vào `frontend/src/legacy/components/legacy-ms-cqg/` |
| Toàn bộ thư mục con `core-ccp/` | 4 files | Lưu trữ vào `frontend/src/legacy/components/core-ccp/` |

---

## 3. Quy Trình Thực Hiện Từng Bước (Step-by-Step Runbook)

### BƯỚC 1: Hoán Đổi Route Frontend (Chuyển V2 Thành Trang Chính)

Khi đội vận hành muốn chuyển URL chính `/trading-manager` sang giao diện V2:

1. **Tạo thư mục lưu trữ legacy**:
   ```powershell
   New-Item -ItemType Directory -Force "frontend\src\legacy\app\trading-manager-v1"
   New-Item -ItemType Directory -Force "frontend\src\legacy\components"
   ```

2. **Sao lưu trang V1 cũ sang thư mục legacy**:
   ```powershell
   # Di chuyển trang chính V1 cũ
   Move-Item -Force "frontend\src\app\trading-manager\page.tsx" "frontend\src\legacy\app\trading-manager-v1\page.old.tsx"

   # Di chuyển các component cũ cồng kềnh
   Move-Item -Force "frontend\src\app\trading-manager\components\legacy-ms-cqg" "frontend\src\legacy\components\"
   Move-Item -Force "frontend\src\app\trading-manager\components\core-ccp" "frontend\src\legacy\components\"
   ```

3. **Gán nội dung của V2 thành trang `/trading-manager` chính thức**:
   - Copy toàn bộ nội dung của [`frontend/src/app/trading-manager-v2/page.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager-v2/page.tsx) đè vào [`frontend/src/app/trading-manager/page.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/page.tsx).
   - Xóa bỏ nút chuyển đổi *"Xem Bản V1 Cũ"* trên header.
   - Xóa thư mục tạm `frontend/src/app/trading-manager-v2/` (hoặc giữ lại redirect vĩnh viễn về `/trading-manager`).

4. **Kiểm tra biên dịch Frontend**:
   ```powershell
   cd frontend
   npx.cmd tsc --noEmit
   # Kết quả bắt buộc: Exit code 0
   ```

---

### BƯỚC 2: Đóng Gói Các Module Cũ Ở Backend Sang `backend/src/legacy/`

Sau khi Frontend đã 100% không còn tham chiếu tới các API cũ:

1. **Di chuyển các module cũ vào `backend/src/legacy/archive/`**:
   ```powershell
   # 1. Module lot-statistics
   Move-Item -Force "backend\src\modules\lot-statistics" "backend\src\legacy\archive\"

   # 2. Module ccp-statistics
   Move-Item -Force "backend\src\modules\ccp-statistics" "backend\src\legacy\archive\"

   # 3. Module margin-checker (nếu còn)
   Move-Item -Force "backend\src\modules\margin-checker" "backend\src\legacy\archive\"

   # 4. Module trading-report (nếu không còn dùng)
   Move-Item -Force "backend\src\modules\trading-report" "backend\src\legacy\archive\"
   ```

2. **Tháo gỡ các module đã di chuyển khỏi [`backend/src/app.module.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/app.module.ts)**:
   - Xóa bỏ các dòng import:
     ```diff
     - import { MarginCheckerModule } from './modules/margin-checker/margin-checker.module';
     - import { CcpStatisticsModule } from './modules/ccp-statistics/ccp-statistics.module';
     - import { TradingReportModule } from './modules/trading-report/trading-report.module';
     - import { LotStatisticsModule } from './modules/lot-statistics/lot-statistics.module';
     ```
   - Xóa bỏ các module tương ứng trong mảng `imports: [...]` của `AppModule`:
     ```diff
     - MarginCheckerModule,
     - CcpStatisticsModule,
     - TradingReportModule,
     - LotStatisticsModule,
     ```

3. **Kiểm tra biên dịch và test Backend**:
   ```powershell
   cd backend
   npm.cmd run build
   # Kết quả bắt buộc: Exit code 0 (nest build thành công)

   npm.cmd test
   # Kết quả bắt buộc: Tất cả test suites PASS
   ```

---

### BƯỚC 3: Dọn Dẹp Module `reconciliation` (Bước Cuối Cùng)

Khi toàn bộ các nút bấm và Job ca trực tự động chuyển sang gọi trực tiếp API của [`TradingOpsModule`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/trading-ops.module.ts) và [`ChecklistHubModule`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/checklist-hub/checklist-hub.module.ts):

1. Di chuyển toàn bộ thư mục `backend/src/modules/reconciliation` sang `backend/src/legacy/archive/`.
2. Gỡ `ReconciliationModule` khỏi `backend/src/app.module.ts`.
3. Kiểm tra biên dịch lại Backend: `npm.cmd run build`.

---

## 4. Phương Án Rollback Khẩn Cấp (Emergency Rollback Playbook)

> [!CAUTION]
> Nếu trong quá trình dọn dẹp hoặc sau khi deploy mà phát sinh sự cố bất ngờ ngoài dự kiến, thực hiện Rollback ngay trong **vòng 2 phút** theo lệnh Git:

```powershell
# 1. Khôi phục lại trạng thái commit trước khi dọn dẹp
git restore .
git clean -fd

# 2. Hoặc khôi phục riêng lẻ Frontend / Backend
git checkout HEAD -- frontend/src/app/trading-manager/
git checkout HEAD -- backend/src/app.module.ts

# 3. Khởi động lại dịch vụ Backend & Frontend
cd backend
npm.cmd run start:dev
```

---

## 5. Danh Sách Kiểm Tra Hoàn Tất (Checklist Sau Khi Dọn Dẹp)

- [ ] `frontend/src/app/trading-manager/page.tsx` sử dụng 100% `tradingOpsApi`, `ccpClearingApi`, `tradingBotApi`.
- [ ] Không còn file rác nào nằm phân tán ngoài thư mục `legacy/archive/`.
- [ ] `app.module.ts` chỉ còn chứa 4 Bounded Contexts mới chuẩn Modular Monolith: `IngressModule`, `TradingOpsModule`, `CcpClearingModule`, `ChecklistHubModule`.
- [ ] Frontend build thành công: `npx tsc --noEmit` exit code 0.
- [ ] Backend build thành công: `npm run build` exit code 0.
- [ ] Backend tests vượt qua 100%: `npm test` pass tất cả test suites.
- [ ] Ghi vết chi tiết hành động vào [`CHANGELOG_AI.md`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/CHANGELOG_AI.md).
