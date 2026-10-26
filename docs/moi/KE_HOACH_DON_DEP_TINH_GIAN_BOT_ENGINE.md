# KẾ HOẠCH TRIỂN KHAI: DỌN DẸP & TINH GIẢN PHÂN HỆ BOT-ENGINE (MODULAR MONOLITH V2)

> **Mục tiêu**: Chấm dứt tình trạng Flat Clutter (thư mục gốc lộn xộn) và loại bỏ 1.700 dòng code chết kế thừa từ Monolith V1 trong phân hệ `bot-engine`. Đưa module trở về đúng 100% bản chất: **Hạ tầng Hàng đợi (Queue) & Hẹn giờ (Scheduler)**.  
> **Thời gian lập**: 26/10/2026  
> **Nguyên tắc tuân thủ**: Strict Ground Truth Guard (AGENTS.md) — 100% không đổi API URL, 100% không gãy hàng đợi `bot_jobs`, không phỏng đoán.

---

## 1. THỰC TRẠNG MÃ NGUỒN HIỆN TẠI (GROUND TRUTH AUDIT)

Qua kiểm tra toàn bộ mã nguồn `backend/src/modules/bot-engine/`:

### 1.1. Thư mục gốc bị bừa bộn (Flat Clutter)
- 4 Watcher services (`email-watcher.service.ts`, `oms-watcher.service.ts`, `file-watcher.service.ts`, `api-watcher.service.ts`) nằm lẫn lộn cùng các core services.
- Controller vệ tinh `bot-agent.controller.ts` nằm lẻ loi ở root thay vì nằm chung trong `controllers/`.
- File fixture `mock-emails.json` nằm trực tiếp ở thư mục code.

### 1.2. File "quái vật" `bot-engine.service.ts` (1.941 dòng)
- **Hơn 1.500 dòng code chết (Dòng 53 - 1623)**: Hàm `handleBotChecks()` là bộ quét ca trực cũ của Monolith V1. Hàm này **hoàn toàn không có `@Cron`** và **không có bất kỳ controller/service nào trong production gọi tới**. Runner quét ca thực tế đã được chuyển giao cho `ShiftScannerService` (`checklist-hub/scheduler/shift-scanner.service.ts#L33`) có `@Cron('* * * * *')`.
- **Thực tế chỉ dùng 2 hàm (Dòng 1624 - 1786)**: `parseMaturityEmail()` và `parseEmailText()` (được gọi từ `bot-jobs.controller.ts#L417`).
- **Gánh nặng 12 Constructor Dependencies**: Tiêm hàng loạt model và service không cần thiết (`MarginCheckerService`, `MarginChangeRequestsService`, `TelegramService`, `RpaScraperService`, `ShiftLogModel`...), gây ra nguy cơ nghẽn bộ nhớ và Circular Dependency.

### 1.3. Thư mục `handlers/` (8 Handlers)
- Vẫn đang được `BotJobQueueService` thông qua `BotJobHandlerRegistry` sử dụng để chạy các job nền (`DOWNLOAD_CAST`, `FILE_AUDIT`, `RUN_MACRO`, `RECON_PIPELINE_PORT`).
- **Quyết định**: Giữ nguyên vẹn 100% vì đã nằm gọn trong thư mục con `handlers/`, không gây ảnh hưởng đến thư mục gốc.

---

## 2. NỘI DUNG TRIỂN KHAI CHI TIẾT (3 BƯỚC)

### Bước 1: Gom nhóm Watchers & Di chuyển Controller vệ tinh
1. Tạo thư mục con: `backend/src/modules/bot-engine/watchers/`.
2. Di chuyển 4 files vào `watchers/`:
   - `email-watcher.service.ts`
   - `oms-watcher.service.ts`
   - `file-watcher.service.ts`
   - `api-watcher.service.ts`
   - `mock-emails.json` (đặt trong `watchers/` để `path.join(__dirname, 'mock-emails.json')` của `email-watcher` tiếp tục chạy chuẩn 100%).
3. Tạo barrel export: `backend/src/modules/bot-engine/watchers/index.ts`.
4. Di chuyển `bot-agent.controller.ts` vào `backend/src/modules/bot-engine/controllers/`.
5. Cập nhật barrel export `backend/src/modules/bot-engine/controllers/index.ts` re-export `AgentController`.
6. Cập nhật dynamic require tại `bot-job-queue.service.ts#L119`:
   - Từ: `require('./bot-agent.controller')`
   - Thành: `require('./controllers/bot-agent.controller')`

### Bước 2: Tinh giản `bot-engine.service.ts` (1.941 dòng $\rightarrow$ ~180 dòng)
1. Cắt bỏ toàn bộ 1.570 dòng code chết của `handleBotChecks()`.
2. Giữ lại trọn vẹn:
   - `parseMaturityEmail(htmlBody: string): ExpiringContract[]`
   - `parseEmailText(content: string): ExpiringContract[]`
   - `isWaitingFilesCooldownActive(...)` & `shouldEnqueueNewJob(...)` (giữ dạng helper gọn nhẹ nếu cần).
3. Loại bỏ 12 dependency tiêm thừa khỏi constructor $\rightarrow$ Constructor trở nên siêu nhẹ (`constructor() {}`), triệt tiêu 100% circular dependencies.

### Bước 3: Cập nhật Import & Tạo tài liệu hướng dẫn `README.md`
1. Cập nhật các import trong `bot-engine.module.ts`, `bot-jobs.controller.ts`, `bot-ingress.controller.ts`, `bot-config.controller.ts`.
2. Tạo file `backend/src/modules/bot-engine/README.md` mô tả tường minh vai trò từng thư mục, chuẩn hóa Mental Model cho mọi lập trình viên.
3. Thực thi build kiểm tra toàn diện:
   - Backend: `npm run build` (`nest build`) $\rightarrow$ Exit Code 0.
   - Frontend: `npm run build` (`next build`) $\rightarrow$ Exit Code 0.
4. Ghi vết kiểm toán thay đổi vào `CHANGELOG_AI.md`.

---

## 3. CẤU TRÚC SAU KHI HOÀN TẤT (TARGET ARCHITECTURE)

```text
backend/src/modules/bot-engine/
├── controllers/                   # 6 Controllers độc lập (Đã gom cả AgentController)
│   ├── bot-jobs.controller.ts
│   ├── bot-ingress.controller.ts
│   ├── bot-config.controller.ts
│   ├── bot-gtt.controller.ts
│   ├── bot-macro.controller.ts
│   ├── bot-agent.controller.ts
│   └── index.ts
│
├── watchers/                      # 4 Watchers hệ thống được gom nhóm riêng
│   ├── email-watcher.service.ts
│   ├── oms-watcher.service.ts
│   ├── file-watcher.service.ts
│   ├── api-watcher.service.ts
│   ├── mock-emails.json
│   └── index.ts
│
├── handlers/                      # 8 Job Handlers chạy ngầm (Bảo toàn 100%)
│   ├── recon-jobs.handler.ts
│   ├── file-audit.handler.ts
│   └── ...
│
├── core/                          # Job Strategy Pattern Registry
├── helpers/                       # Path & Date Resolvers
├── constants/                     # Task capability definitions
├── utils/                         # Crypto (AES-256)
│
├── bot-job-queue.service.ts       # Core Queue Manager (Atomic Lock)
├── scheduler.service.ts           # Core Cron Scheduler
├── bot-engine.service.ts          # Core Maturity Email Parser (~180 dòng)
├── bot-engine.module.ts           # NestJS Module Metadata
└── README.md                      # Tài liệu hướng dẫn kiến trúc module
```

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

1. **Zero Breaking Changes**: Không sửa đổi bất kỳ endpoint API nào của Frontend.
2. **Zero Circular Dependencies**: Loại bỏ hoàn toàn các `forwardRef()` rác trong `BotEngineService`.
3. **Clean Codebase**: Thư mục gốc `bot-engine` chỉ còn 4 files typescript chính (`bot-job-queue`, `scheduler`, `bot-engine.service`, `bot-engine.module`).
4. **Build Verification**: Cả Backend và Frontend biên dịch với Exit Code 0.
