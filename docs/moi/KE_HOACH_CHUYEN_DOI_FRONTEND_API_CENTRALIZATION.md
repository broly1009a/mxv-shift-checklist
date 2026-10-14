# KẾ HOẠCH CHUẨN HÓA: FRONTEND API CENTRALIZATION & LỘ TRÌNH BACKEND V2
**Dự án**: MXV Shift Checklist — Modular Monolith V2  
**Ngày soạn ban đầu**: 2026-10-14  
**Ngày hiệu đính chuẩn hóa**: 2026-10-14  
**Trạng thái hiện tại**:
- ✅ **Frontend API Centralization**: HOÀN THÀNH 100% (Zero Raw Fetch, Next.js Build 35/35 Routes Pass, tập trung toàn bộ endpoint vào `frontend/src/services/api/endpoints.ts`).
- 🛡️ **Backend Runtime**: BẢO TOÀN NGUYÊN TRẠNG V1 ĐỂ ĐẢM BẢO AN TOÀN TUYỆT ĐỐI (Giữ nguyên toàn bộ Controllers, Handlers và Services V1, chưa thực hiện xóa hay gỡ bỏ bất kỳ file nào).

---

## 1. BỐI CẢNH & KẾT QUẢ ĐÃ ĐẠT ĐƯỢC

### 1.1 Vấn đề kỹ thuật đã giải quyết ở Frontend
Trước khi chuẩn hóa, hệ thống Frontend gặp vấn đề phân mảnh nghiêm trọng:
- Toàn bộ Frontend gọi API bằng `fetch(${API_BASE_URL}/api/v1/...)` thô trực tiếp rải rác trên **~35 component** với hơn **280+ lệnh fetch**.
- Không có Single Source of Truth cho các đường dẫn API, gây khó khăn cho việc bảo trì và nâng cấp.

### 1.2 Kết quả hoàn thành (Frontend Centralization)
1. **100% các lệnh gọi API** trên toàn bộ ứng dụng (Checklist, Trading Manager, Bot Config, Dashboard, Admin, Profile, Settings) đã được quy tụ về tầng dịch vụ tập trung tại `frontend/src/services/api/`:
   - `auth.api.ts`: Xác thực, Token, Profile.
   - `ingress.api.ts`: Trigger tải báo cáo sàn, audit file backup, kiểm tra kết nối.
   - `trading-ops.api.ts`: Đối chiếu KLGD, Pre-EOD, Kiểm tra ký quỹ âm, DSGD, Console summary.
   - `ccp-clearing.api.ts`: Bù trừ CCP, Tỷ giá USD/đa tiền tệ, Thống kê Lot/Giá trị Macro.
   - `checklist-hub.api.ts`: Quản lý ca trực, chi tiết task, sự cố, bot jobs, GTT.
   - `dashboard.api.ts`: Trạng thái hệ thống, hoạt động ca trực, tóm tắt.
   - `admin.api.ts`: Quản trị User, Department, Template ca, Phân quyền.
2. **File [endpoints.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/services/api/endpoints.ts)** là Single Source of Truth duy nhất quản lý toàn bộ URL endpoint trong dự án.
3. **Build Frontend xác thực**: `npm run build` thành công 100% (Exit Code 0, 35/35 routes SSG/SSR hợp lệ).

---

## 2. NGUYÊN TẮC KIẾN TRÚC CHUẨN (MODULAR MONOLITH V2)

Căn cứ theo [BAN_THIET_KE_CHI_TIET_CHUAN_HOA_BACKEND_MODULAR_MONOLITH.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/BAN_THIET_KE_CHI_TIET_CHUAN_HOA_BACKEND_MODULAR_MONOLITH.md), kiến trúc backend tuân thủ nghiêm ngặt **Quy tắc 4 Phân Tầng Độc Lập**:

```
┌────────────────────────────────────────────────────────┐
│ TẦNG 4: ORCHESTRATION & DISPATCHING                    │
│ (modules/checklist-hub: BotDispatcher, Job Queue)      │  ← NƠI TIẾP NHẬN YÊU CẦU ĐIỀU PHỐI TỪ UI
└──────────────────────────┬─────────────────────────────┘
                           │ (Điều phối / Gọi Worker)
┌──────────────────────────▼─────────────────────────────┐
│ TẦNG 3: DOMAIN OPERATIONS & BUSINESS LOGIC             │
│ (trading-ops, ccp-clearing, shifts)                    │  ← THỰC THI THUẬT TOÁN ĐỐI SOÁT & THỐNG KÊ
└──────────────────────────┬─────────────────────────────┘
                           │ (Yêu cầu kéo file thô)
┌──────────────────────────▼─────────────────────────────┐
│ TẦNG 2: INGRESS & DATA ADAPTERS                        │
│ (modules/ingress: MS, CQG, CoreCCP, ACM)               │  ← CHỈ KÉO FILE THÔ (INTERNAL PORT)
└────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Định vị chuẩn của Phân hệ `ingress` (Tầng 2)**:
> - `ingress` là **Cổng thu thập dữ liệu nội bộ (Internal Port)**. Nhiệm vụ duy nhất là kết nối và kéo file thô (qua Playwright Scrapers hoặc REST/SFTP API Adapters) về đĩa hoặc Buffer.
> - **Tuyệt đối KHÔNG tạo `IngressController`**: UI không bao giờ gọi trực tiếp vào tầng Ingress. Việc người dùng bấm nút trên Web thực chất là yêu cầu tạo một **Bot Job** trong ca trực, việc này phải do **Tầng 4 (`checklist-hub`)** tiếp nhận để quản lý lifecycle, hàng đợi, tiến độ và log kiểm toán.

---

## 3. HIỆN TRẠNG BACKEND & NGUYÊN TẮC AN TOÀN (ZERO-DELETION)

### 3.1 Hiện trạng thực tế của Backend V1
Hệ thống Backend hiện tại đang vận hành ổn định trên nền **Monolith V1**:
- Các file `rpa-downloader.service.ts`, `ccp-ce-downloader.service.ts`, `post-eod-handler.service.ts` đang được import và phục vụ trực tiếp cho `bot-engine.controller.ts`, `bot-engine.service.ts` cùng toàn bộ các Job Handlers (`recon-jobs.handler`, `rpa-download.handler`, `ccp-ce-download.handler`, `verify-email.handler`).
- File [endpoints.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/services/api/endpoints.ts) hiện tại đang trỏ chuẩn xác vào các Controller V1 này để đảm bảo tính năng vận hành thông suốt 100%.

### 3.2 Kỷ luật an toàn tuyệt đối
- ⛔ **Tuyệt đối không xóa hay di dời các Service V1** (`rpa-downloader.service.ts`, `ccp-ce-downloader.service.ts`, `post-eod-handler.service.ts`) vào lúc này.
- Mọi thao tác dọn dẹp nóng vội sẽ làm gãy build và gây crash runtime toàn bộ luồng ca trực.

---

## 4. LỘ TRÌNH HÀNH ĐỘNG TIẾP THEO

### Bước 1 (Hiện tại): Kiểm thử nghiệm thu Frontend E2E (Verification Gate)
- **Mục tiêu**: Xác nhận việc gom ~280 lệnh fetch sang `services/api/` không gây bất kỳ lỗi regression nào trên giao diện người dùng.
- **Phạm vi kiểm thử**:
  1. Giao diện **Dashboard**: Hiển thị widget, summary, system status.
  2. Giao diện **Trading Manager**: Kiểm tra các tab MS-CQG, CCP-CE, nút bấm trigger đối soát, pop-up kết quả.
  3. Giao diện **Bot Config**: Kiểm tra kết nối sàn (MS, CQG, ACM, CCP), cấu hình scheduler.
  4. Giao diện **Checklist**: Mở modal đối soát, cập nhật trạng thái task.
- **Tiêu chuẩn pass**: Giao diện hoạt động trơn tru, không có lỗi console hay crash component.

### Bước 2: Chuyển đổi Backend theo mô hình Strangler Fig (Facade Delegation)
- **Mục tiêu**: Từng bước chuyển giao công việc từ V1 sang V2 mà không làm gián đoạn hệ thống.
- **Nguyên tắc thực hiện**:
  1. **Giữ nguyên URL Controllers**: Không thay đổi endpoint để tránh làm xáo trộn Frontend.
  2. **Chuyển tiếp nội bộ (Delegation)**:
     - Trong thân hàm của `bot-engine.service.ts` hoặc các Handlers cũ, thay vì tự chạy logic cũ, ta ủy thác (delegate) sang gọi `BotDispatcherService` hoặc `IngressService`.
     - Code cũ đóng vai trò là vỏ bọc tương thích ngược (Facade Adapter).
  3. **Kiểm thử đối chiếu kép (Twin-Run Validation)**: Đảm bảo kết quả trả về từ V2 khớp 100% với V1 trước khi tắt hoàn toàn luồng cũ.
