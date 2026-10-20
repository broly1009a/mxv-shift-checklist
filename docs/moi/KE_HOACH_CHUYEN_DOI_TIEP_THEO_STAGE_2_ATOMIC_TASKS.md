# KẾ HOẠCH CHUYỂN ĐỔI TIẾP THEO (STAGE 2: RUNTIME INTEGRATION & PRODUCTION CUTOVER)

## CHUYỂN GIAO TOÀN DIỆN: TÁCH LOG ĐỘC LẬP — CẤU HÌNH RIÊNG TỪNG KHỐI — ĐA INSTANCE CONCURRENCY — TẮT PLAYWRIGHT THAY BẰNG REST API

---

> **Mã kế hoạch**: `MXV-MODULAR-STAGE-2-ATOMIC-TASKS-2026`  
> **Kế thừa trực tiếp từ**: [KE_HOACH_TONG_CHUYEN_DOI_MODULAR_MONOLITH_ATOMIC_TASKS.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/KE_HOACH_TONG_CHUYEN_DOI_MODULAR_MONOLITH_ATOMIC_TASKS.md)  
> **Nguyên tắc bất biến**: **"KHÔNG LÀM CẢ CỤC — CHIA NHỎ TỪNG TASK — XÁC MINH TEST/BUILD SAU MỖI BƯỚC — KHÔNG MẤT CODE HAY LOẠN LOGIC"**  
> **Tiêu chuẩn kiểm soát**: [AGENTS.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/.agents/AGENTS.md).

---

## 1. MỤC TIÊU CỐT LÕI & ĐỊNH HƯỚNG KIẾN TRÚC GIAI ĐOẠN 2

Giai đoạn 1 đã xây dựng thành công 100% khung sườn và lõi nghiệp vụ của 4 module V2 (`ingress`, `trading-ops`, `ccp-clearing`, `checklist-hub`).  
**Giai đoạn 2 này tập trung vào 4 bài toán vận hành thực tế then chốt:**

1. 📂 **Log Độc Lập Cho Tool Module (Domain Execution Logs)**:
   - Toàn bộ bảng kê chi tiết so khớp lệnh, bảng kê diff, dữ liệu thống kê thô được lưu vào collection riêng (`trading_recon_logs`, `ccp_clearing_logs`).
   - CSDL Ca trực (`ShiftLog`) chỉ lưu ID tham chiếu `domainLogRefId` và các chỉ số tóm tắt (metrics) $\rightarrow$ **Bảo vệ tuyệt đối giới hạn MongoDB 16MB document limit và chống lag UI Web**.

2. 🔐 **Cấu Hình Riêng Biệt Từng Khối (Domain Configuration Namespaces)**:
   - Tách biệt hoàn toàn tài khoản mật khẩu, thư mục lưu trữ, endpoint giữa các khối: **QLGD** (M-System, CQG, ACM), **CCP** (CoreCCP, Clearing), **IT Ops** (Mail, Telegram, SSH).
   - Triệt tiêu 100% nguy cơ tranh chấp tài nguyên, ghi đè đường dẫn hay xung đột credential.

3. **Mở Rộng Đa Instance Không Xung Đột (Horizontal Multi-Instance Concurrency)**:
   - Đưa cơ chế khóa nguyên tử MongoDB (`findOneAndUpdate({ status: 'PENDING' }, { $set: { status: 'PROCESSING', lockedBy: instanceId } })`) của `BotDispatcherService` vào vận hành thực tế.
   - Hỗ trợ triển khai nhiều Node.js worker/container cùng lúc để xử lý song song các tác vụ nặng (vừa cào dữ liệu, vừa tính toán lot, vừa đọc email) mà **không bị tranh chấp hay chạy trùng Job (Zero Race Conditions)**.

4. 🌐 **Tắt Hẳn Playwright — Chuyển Sang Gọi REST/gRPC API (Playwright Sunsetting)**:
   - Xây dựng sẵn các REST/gRPC API Adapters (`CoreExApiAdapter`, `CoreCcpApiAdapter`, `AcmApiAdapter`) tuân thủ `IIngressPort`.
   - Kết nối qua cờ Feature Flag: Khi sàn chính thức mở API, hệ thống tự động ngắt trình duyệt Playwright và chuyển 100% sang HTTP calls mà không phải sửa bất kỳ dòng code tính toán nào.

---

## 2. BẢN ĐỒ LỘ TRÌNH 6 PHA & 18 NHIỆM VỤ NGUYÊN TỬ (ATOMIC TASKS)

```mermaid
flowchart TD
    subgraph P7["PHA 7: Tách Biệt Log Chuyên Biệt (Domain Execution Logs)"]
        T71["Task 7.1: Schema trading_recon_logs"] --> T72["Task 7.2: Schema ccp_clearing_logs"]
        T72 --> T73["Task 7.3: Tích hợp Workers ghi Log độc lập"]
        T73 --> T74["Task 7.4: API tra cứu chi tiết Log theo domainLogRefId"]
    end

    subgraph P8["PHA 8: Phân Vùng Cấu Hình Độc Lập Theo Khối (Config Namespaces)"]
        T81["Task 8.1: Schema Domain Config (QLGD, CCP, IT)"] --> T82["Task 8.2: Service TradingOpsConfig (QLGD)"]
        T82 --> T83["Task 8.3: Service CcpClearingConfig (CCP)"]
        T83 --> T84["Task 8.4: Service ItOpsConfig (IT Support)"]
    end

    subgraph P9["PHA 9: Đấu Nối Runtime V2 & Đa Instance Concurrency"]
        T91["Task 9.1: Import V2 Modules vào app.module.ts"] --> T92["Task 9.2: Đấu nối BotDispatcherService vào BotJobQueueService (Strangler Fig)"]
        T92 --> T93["Task 9.3: Multi-Instance Concurrency Test (2 Worker Processes)"]
    end

    subgraph P10["PHA 10: Khung REST API Adapters (Tắt Hẳn Playwright)"]
        T101["Task 10.1: CoreExApiAdapter (M-System REST Ingress)"] --> T102["Task 10.2: CoreCcpApiAdapter (CoreCCP REST Ingress)"]
        T102 --> T103["Task 10.3: AcmSftpAdapter (ACM Ingress)"]
        T103 --> T104["Task 10.4: Feature Flag Switching (Playwright vs REST API)"]
    end

    subgraph P11["PHA 11: Mở Rộng Workers Độc Lập (Mail, Calendar, Maintenance)"]
        T111["Task 11.1: EmailWatcherWorker (capabilityType: 'EMAIL_INGRESS')"] --> T112["Task 11.2: CalendarSyncWorker (capabilityType: 'CALENDAR_SYNC')"]
    end

    subgraph P12["PHA 12: Kiểm Thử Toàn Trình & Nghiệm Thu Bàn Giao"]
        T121["Task 12.1: End-to-End Twin-Run 24h Shift Simulation"] --> T122["Task 12.2: Dọn dẹp & Khép lại Monolith V1"]
    end

    P7 --> P8 --> P9 --> P10 --> P11 --> P12
```

---

## 3. CHI TIẾT TỪNG NHIỆM VỤ NGUYÊN TỬ (ATOMIC SPECIFICATIONS)

---

### PHA 7: TÁCH BIỆT LOG CHUYÊN BIỆT & BẢO VỆ CSDL CA TRỰC (`domain-logs`)

> **Mục tiêu**: Tuyệt đối không nhét bảng kê so khớp hàng nghìn dòng lệnh vào `ShiftLog`. Tạo các collection lưu log chuyên ngành độc lập.

#### Task 7.1: Tạo Mongoose Schema `TradingReconLog` (`trading_recon_logs`)

- **Vị trí file**: `backend/src/modules/trading-ops/schemas/trading-recon-log.schema.ts`
- **Mục tiêu**: Lưu trữ toàn bộ dữ liệu đối soát chi tiết của QLGD.
- **Cấu trúc trường dữ liệu (Schema Definition)**:
  - `reconType`: `'KLGD' | 'DSGD_BEFORE_EOD' | 'NEGATIVE_MARGIN'`
  - `tradingDate`: `string` (YYYY-MM-DD)
  - `shiftLogId?: string`
  - `taskId?: string`
  - `passed: boolean`
  - `totals: Record<string, number>`
  - `mismatchedTrades`: Mảng chi tiết lệnh lệch
  - `mismatchedPositions`: Mảng chi tiết vị thế lệch
  - `negativeMarginAccounts`: Mảng tài khoản vi phạm ký quỹ
  - `cutoffTime?: Date`
- **Tiêu chuẩn nghiệm thu (DoD)**: Schema được export sạch sẽ, có đầy đủ indexes cho `tradingDate`, `reconType`, `shiftLogId`.

#### Task 7.2: Tạo Mongoose Schema `CcpClearingLog` (`ccp_clearing_logs`)

- **Vị trí file**: `backend/src/modules/ccp-clearing/schemas/ccp-clearing-log.schema.ts`
- **Mục tiêu**: Lưu trữ toàn bộ bảng kê thống kê Lot, giá trị giao dịch bù trừ CCP.
- **Tiêu chuẩn nghiệm thu (DoD)**: Schema export sạch sẽ, index `tradingDate`.

#### Task 7.3: Cập Nhật Workers Ghi Log Độc Lập & Trả Về `domainLogRefId`

- **File tác động**:
  - `backend/src/modules/trading-ops/workers/klgd-recon.worker.ts`
  - `backend/src/modules/trading-ops/workers/dsgd-before-eod-recon.worker.ts`
  - `backend/src/modules/trading-ops/workers/negative-margin.worker.ts`
  - `backend/src/modules/ccp-clearing/workers/ccp-lot.worker.ts`
- **Quy tắc chuyển đổi**:
  1. Worker nhận kết quả tính toán thô.
  2. Ghi bản ghi chi tiết vào `TradingReconLog` hoặc `CcpClearingLog`.
  3. Lấy `_id` của bản ghi vừa lưu gắn vào `domainLogRefId` của `TaskExecutionResult`.
  4. Trả về `summary` ngắn gọn và `metrics` tổng quan (tuyệt đối không nhồi nhét mảng hàng nghìn phần tử vào `TaskExecutionResult`).
- **Tiêu chuẩn nghiệm thu (DoD)**:
  - `TaskExecutionResult.domainLogRefId` luôn có giá trị ObjectId hợp lệ.

#### Task 7.4: Xây Dựng REST API Tra Cứu Log Chi Tiết Theo `domainLogRefId`

- **Vị trí file**:
  - `backend/src/modules/trading-ops/controllers/trading-recon-log.controller.ts`
  - `backend/src/modules/ccp-clearing/controllers/ccp-clearing-log.controller.ts`
- **Mục tiêu**: Cung cấp endpoint cho Frontend bấm "Xem chi tiết đối soát" hoặc "Tải Excel kết quả" mà không làm nặng payload của ca trực:
  - `GET /api/v1/trading-ops/recon-logs/:id`
  - `GET /api/v1/ccp-clearing/logs/:id`
- **Tiêu chuẩn nghiệm thu (DoD)**: Endpoint trả về chi tiết bảng kê khớp lệnh theo chuẩn REST JSON.

---

### PHA 8: PHÂN VÙNG CẤU HÌNH ĐỘC LẬP THEO KHỐI (`domain-configs`)

> **Mục tiêu**: Loại bỏ việc nhồi nhét cấu hình của tất cả các phòng ban vào một mớ hỗn độn trong `system_settings`. Phân chia rõ ràng thành 3 khối tự quản: QLGD, CCP, IT Support.

#### Task 8.1: Schema Cấu Hình Phân Vùng `DomainConfig`

- **Vị trí file**: `backend/src/schemas/domain-config.schema.ts`
- **Mục tiêu**: Quản lý cấu hình có namespace theo khối (`QLGD`, `CCP`, `IT_OPS`, `RISK`).
- **Tiêu chuẩn nghiệm thu (DoD)**: Schema có unique index trên trường `namespace`.

#### Task 8.2: Service Cấu Hình Khối Quản Lý Giao Dịch (`TradingOpsConfigService`)

- **Vị trí file**: `backend/src/modules/trading-ops/services/trading-ops-config.service.ts`
- **Phạm vi quản lý**:
  - Đường dẫn Backup M-System, CQG, ACM.
  - Tài khoản bot cào M-System, CQG TK1, CQG TK2.
  - Ngưỡng giờ cắt phiên (`sessionStartTime`, mặc định `05:00`).
- **Tiêu chuẩn nghiệm thu (DoD)**: Method `getConfig(): Promise<ITradingOpsConfig>`, fallback `.env`.

#### Task 8.3: Service Cấu Hình Khối Bù Trừ CCP (`CcpClearingConfigService`)

- **Vị trí file**: `backend/src/modules/ccp-clearing/services/ccp-clearing-config.service.ts`
- **Phạm vi quản lý**:
  - Đường dẫn Backup 25 báo cáo CCP.
  - Tài khoản đăng nhập cổng CoreCCP.
  - Danh mục hàng hóa và tỷ lệ tính lot bù trừ.
- **Tiêu chuẩn nghiệm thu (DoD)**: Method `getConfig(): Promise<ICcpClearingConfig>`.

#### Task 8.4: Service Cấu Hình Khối Kỹ Thuật IT (`ItOpsConfigService`)

- **Vị trí file**: `backend/src/modules/checklist-hub/services/it-ops-config.service.ts`
- **Phạm vi quản lý**:
  - Thông số SMTP gửi mail cảnh báo.
  - Telegram Bot Token & Chat ID kênh trực ca.
  - Tần suất quét Job ngầm (`queuePollIntervalMs`).
- **Tiêu chuẩn nghiệm thu (DoD)**: Method `getConfig(): Promise<IItOpsConfig>`.

---

### PHA 9: ĐẤU NỐI RUNTIME V2 VÀO `AppModule` & BẬT ĐIỀU PHỐI ĐA INSTANCE

> **Mục tiêu**: Đưa toàn bộ các Module V2 vào đồ thị phụ thuộc (DI Graph) của ứng dụng chính và kích hoạt khả năng chạy song song đa instance.

#### Task 9.1: Import V2 Modules Vào `backend/src/app.module.ts`

- **File tác động**: `backend/src/app.module.ts`
- **Nội dung thay đổi**: Thêm `IngressModule`, `TradingOpsModule`, `CcpClearingModule`, `ChecklistHubModule` vào mảng `imports`.
- **Tiêu chuẩn nghiệm thu (DoD)**: `npm run build` Exit code 0, dev server reload mượt mà.

#### Task 9.2: Tích Hợp `BotDispatcherService` Vào `BotJobQueueService` (Strangler Fig Delegation)

- **File tác động**: `backend/src/modules/bot-engine/bot-job-queue.service.ts`
- **Nội dung thay đổi**:
  - Inject `BotDispatcherService`.
  - Khóa nguyên tử MongoDB Atomic Lock (`status: 'PROCESSING', lockedBy: instanceId`) thay vì cờ RAM `this.isProcessing = true`.
- **Tiêu chuẩn nghiệm thu (DoD)**: Khóa nguyên tử được kích hoạt, ghi nhận `lockedBy`.

#### Task 9.3: Kiểm Thử Đa Instance Song Song (Multi-Instance Concurrency Test)

- **Vị trí file**: `backend/src/tests/concurrency/multi-instance-queue.spec.ts`
- **Kịch bản kiểm thử**:
  1. Khởi tạo 2 instance `BotDispatcherService` độc lập.
  2. Tạo 10 jobs `PENDING`.
  3. Cả 2 instance cùng gọi vòng lặp xử lý đồng thời.
  4. Assert: **CHÍNH XÁC 0 JOB BỊ XỬ LÝ TRÙNG LẶP (Zero Double-Execution)**.
- **Tiêu chuẩn nghiệm thu (DoD)**: Jest test `PASS src/tests/concurrency/multi-instance-queue.spec.ts`.

---

### PHA 10: XÂY DỰNG KHUNG REST/gRPC API ADAPTERS (PLAYWRIGHT SUNSETTING)

> **Mục tiêu**: Hiện thực hóa chỉ đạo "về sau sẽ off Playwright hết, viết mới hết theo gọi API". Xây dựng cầu nối để chuyển đổi không gián đoạn.

#### Task 10.1: Xây Dựng `CoreExApiAdapter` (M-System Direct Ingress)

- **Vị trí file**: `backend/src/modules/ingress/adapters/coreex-api.adapter.ts`
- **Tiêu chuẩn nghiệm thu (DoD)**: Implement đầy đủ `IIngressPort.downloadReport()`.

#### Task 10.2: Xây Dựng `CoreCcpApiAdapter` (CoreCCP Direct Ingress)

- **Vị trí file**: `backend/src/modules/ingress/adapters/coreccp-api.adapter.ts`
- **Tiêu chuẩn nghiệm thu (DoD)**: Implement đầy đủ `IIngressPort.downloadReport()`.

#### Task 10.3: Xây Dựng `AcmSftpAdapter` (ACM Native Ingress)

- **Vị trí file**: `backend/src/modules/ingress/adapters/acm-sftp.adapter.ts`
- **Tiêu chuẩn nghiệm thu (DoD)**: Tải đúng file Straits CSV theo ngày phiên qua SFTP Client.

#### Task 10.4: Cơ Chế Chuyển Đổi Tức Thì Qua Feature Flag (Zero-Downtime Sunsetting Switch)

- **File tác động**: `backend/src/modules/ingress/ingress.service.ts`
- **Logic chuyển đổi**: Đọc cấu hình `INGRESS_MODE`: nếu là `'REST_API'` thì gọi HTTP REST API; nếu là `'PLAYWRIGHT'` thì gọi browser crawler.
- **Tiêu chuẩn nghiệm thu (DoD)**: Chuyển đổi runtime không cần build lại code hay restart server.

---

### PHA 11: MỞ RỘNG WORKERS ĐỘC LẬP (MAIL, CALENDAR, OCR)

#### Task 11.1: Tạo `EmailWatcherWorker`

- **Vị trí file**: `backend/src/modules/checklist-hub/workers/email-watcher.worker.ts`
- **Năng lực định danh**: `capabilityType: 'EMAIL_ATTACHMENT_INGRESS'`
- **Nhiệm vụ**: Tự động quét hòm thư, bóc tách file đính kèm.

#### Task 11.2: Tạo `CalendarSyncWorker`

- **Vị trí file**: `backend/src/modules/checklist-hub/workers/calendar-sync.worker.ts`
- **Năng lực định danh**: `capabilityType: 'CALENDAR_SYNC'`
- **Nhiệm vụ**: Đồng bộ lịch nghỉ lễ và ngày bù trừ từ các sở giao dịch quốc tế.

---

### PHA 12: KIỂM THỬ KHÉP KÍN TOÀN TRÌNH & NGHIỆM THU BÀN GIAO (FULL CUTOVER)

#### Task 12.1: Kịch Bản Test Mô Phỏng Toàn Trình Ca Trực 24h (End-to-End Shift Simulation)

- **Vị trí file**: `backend/src/tests/e2e/modular-shift-e2e.spec.ts`
- **Tiêu chuẩn nghiệm thu (DoD)**: `PASS src/tests/e2e/modular-shift-e2e.spec.ts`.

#### Task 12.2: Đồng Bộ Lên Nhánh Refactor & Khép Lại Kế Hoạch

- **Nhiệm vụ**: Đồng bộ mã nguồn, ghi log [CHANGELOG_AI.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/CHANGELOG_AI.md).

---

## 4. MA TRẬN PHÂN CHIA NHIỆM VỤ NGUYÊN TỬ (ATOMIC TASKS SUMMARY TABLE)

| Mã Task       | Phân Hệ         | File Thực Hiện                   | Nhiệm Vụ Cụ Thể                                              | Lệnh Kiểm Chứng       |
| :------------ | :-------------- | :------------------------------- | :----------------------------------------------------------- | :-------------------- |
| **Task 7.1**  | `trading-ops`   | `trading-recon-log.schema.ts`    | Tạo Schema lưu log đối soát QLGD độc lập                     | `nest build`          |
| **Task 7.2**  | `ccp-clearing`  | `ccp-clearing-log.schema.ts`     | Tạo Schema lưu log thống kê CCP độc lập                      | `nest build`          |
| **Task 7.3**  | `workers`       | Cập nhật 4 Workers               | Ghi chi tiết vào collection riêng, trả `domainLogRefId`      | `jest twin-run`       |
| **Task 7.4**  | `controllers`   | 2 Log Controllers                | REST API xem chi tiết log theo ID                            | `nest build`          |
| **Task 8.1**  | `shared`        | `domain-config.schema.ts`        | Schema quản lý cấu hình phân vùng theo namespace             | `nest build`          |
| **Task 8.2**  | `trading-ops`   | `trading-ops-config.service.ts`  | Service quản lý cấu hình riêng khối QLGD                     | `nest build`          |
| **Task 8.3**  | `ccp-clearing`  | `ccp-clearing-config.service.ts` | Service quản lý cấu hình riêng khối CCP                      | `nest build`          |
| **Task 8.4**  | `checklist-hub` | `it-ops-config.service.ts`       | Service quản lý cấu hình riêng khối IT                       | `nest build`          |
| **Task 9.1**  | `core`          | `backend/src/app.module.ts`      | Đấu nối 4 V2 Modules vào đồ thị DI chính                     | `nest build` (Exit 0) |
| **Task 9.2**  | `bot-engine`    | `bot-job-queue.service.ts`       | Ủy quyền xử lý Job sang `BotDispatcherService`               | `nest build`          |
| **Task 9.3**  | `tests`         | `multi-instance-queue.spec.ts`   | Test chứng minh 0% race condition trên 2 workers             | `jest multi-instance` |
| **Task 10.1** | `ingress`       | `coreex-api.adapter.ts`          | REST API Adapter cho M-System (thay Playwright)              | `nest build`          |
| **Task 10.2** | `ingress`       | `coreccp-api.adapter.ts`         | REST API Adapter cho CoreCCP (thay Playwright)               | `nest build`          |
| **Task 10.3** | `ingress`       | `acm-sftp.adapter.ts`            | SFTP Native Adapter cho ACM Straits CSV                      | `nest build`          |
| **Task 10.4** | `ingress`       | `ingress.service.ts`             | Feature Flag chuyển đổi tức thì Playwright $\rightarrow$ API | `nest build`          |
| **Task 11.1** | `checklist-hub` | `email-watcher.worker.ts`        | Worker độc lập tải đính kèm email ca trực                    | `nest build`          |
| **Task 11.2** | `checklist-hub` | `calendar-sync.worker.ts`        | Worker độc lập đồng bộ lịch giao dịch sàn                    | `nest build`          |
| **Task 12.1** | `tests`         | `modular-shift-e2e.spec.ts`      | Mô phỏng toàn trình 24h ca trực V2                           | `jest e2e`            |
| **Task 12.2** | `git`           | CHANGELOG & Git Commit           | Nghiệm thu và đóng băng mốc hoàn thành                       | `git status`          |

---

## 5. CAM KẾT KỶ LUẬT THỰC THI (DISCIPLINE PROTOCOL)

1. **Tuyệt đối không gộp code (Atomic Execution)**: Mỗi lượt thực thi chỉ xử lý duy nhất 1 Task nguyên tử.
2. **Kiểm chứng sau từng bước**: Sau mỗi Task, AI bắt buộc chạy `nest build` và test liên quan trước khi chuyển task.
3. **Bảo tồn Server nền**: Không bao giờ gây gián đoạn tiến trình `npm run start:dev` đang chạy trên máy người dùng.
4. **Không động vào Database thật**: Mọi bài test dùng database giả lập / test schema riêng biệt, bảo vệ tuyệt đối dữ liệu ca trực thật.
