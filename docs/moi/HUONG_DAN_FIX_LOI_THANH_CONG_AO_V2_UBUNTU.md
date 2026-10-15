# HƯỚNG DẪN KỸ THUẬT: KHẮC PHỤC TRIỆT ĐỂ LỖI BÁO THÀNH CÔNG ẢO (KHỚP 100% VỚI 0 LỆNH) TRÊN BOT DISPATCHER V2

---

## 1. TỔNG QUAN SỰ CỐ & HIỆN TƯỢNG (INCIDENT OVERVIEW)

### 1.1. Hiện tượng thực tế trên Ubuntu
- **Job ID**: `6ad081c0ca23ca5ea2ed212f`
- **Thời điểm**: `14:33:20 15/10/2026` (`2026-10-15T07:33:20.498Z`)
- **Thời gian chạy**: Chỉ mất **45 mili-giây** (07:33:24.019 $\rightarrow$ 07:33:24.064)
- **Log ghi nhận**:
  ```text
  [2026-10-15T07:33:20.498Z] Job enqueued.
  [2026-10-15T07:33:24.019Z] Starting attempt 1/3...
  [2026-10-15T07:33:24.064Z] [BotDispatcher V2] Khớp 100% (DSGD: 0, FR: 0, Nano: 0)
  ```
- **Hậu quả**:
  - Bot Job được đánh dấu `COMPLETED` (Thành công).
  - Tác vụ trên Checklist ca trực bị chuyển sang `PASSED` (Tick xanh hoàn thành).
  - Người vận hành nhìn giao diện tưởng rằng số liệu 3 bên đã khớp tuyệt đối, nhưng **thực tế hệ thống chưa đọc được bất kỳ dòng dữ liệu nào** (`DSGD: 0`, `FR: 0`, `Nano: 0`) do thiếu file nguồn trên máy chủ Ubuntu.

---

## 2. NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE ANALYSIS)

### 2.1. Bản chất hàm tính toán gốc `runAutoCheckKLGD`
Tại [klgd-recon.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/services/klgd-recon.service.ts#L821-L839):
Khi thư mục ngày trên Ubuntu thiếu các file nguồn (`DSGD.xlsx`, `CQG FR`, `Straits.csv`), hàm trả về:
```typescript
if (missingFiles.length > 0) {
  return {
    passed: true,          // Quy ước: passed=true để báo không có lệnh nào bị lệch
    isWaitingFiles: true,  // Cờ nghiệp vụ cốt lõi: ĐANG THIẾU TỆP / CHỜ FILE
    message: `[Đang chờ dữ liệu] Thư mục backup... đang chờ cập nhật đầy đủ file đối chiếu...`,
    totals: { totalDSGD: 0, totalFR: 0, totalACM: 0, totalNano: 0, differ: 0, differACM: 0 },
    mismatchedTrades: [],
    mismatchedTTM: [],
  };
}
```

### 2.2. So sánh đối chiếu V1 (Cũ) vs V2 (Mới)

| Bước xử lý | Logic Monolith V1 (`ReconJobsHandler`) | Logic Modular V2 (`KlgdReconWorker`) |
| :--- | :--- | :--- |
| **Kiểm tra kết quả** | [recon-jobs.handler.ts#L875](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L875):<br/>`if (result.isWaitingFiles)` $\rightarrow$ Chỉ ghi log `[Đang chờ dữ liệu]`, **tuyệt đối không in "Khớp 100%"**. | [klgd-recon.worker.ts#L43-L47](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/workers/klgd-recon.worker.ts#L43-L47):<br/>**Bỏ qua hoàn toàn `res.isWaitingFiles`**, thấy `res.passed === true` $\rightarrow$ tự động gán `status = 'SUCCESS'` và sinh chuỗi **`Khớp 100% (DSGD: 0, FR: 0, Nano: 0)`**. |
| **Bảo toàn cờ `isWaitingFiles`** | Lưu trực tiếp `job.payload.result = result` $\rightarrow$ giữ nguyên cờ `isWaitingFiles: true`. | Gói sang `TaskExecutionResult` bị **rơi rụng mất trường `isWaitingFiles`**. |
| **Đồng bộ Checklist ca trực** | [bot-job-queue.service.ts#L766](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/bot-engine/bot-job-queue.service.ts#L766):<br/>Kiểm tra thấy `payload.result.isWaitingFiles === true` $\rightarrow$ **Giữ task ở trạng thái `PENDING`** (để chu kỳ sau quét lại). | [bot-job-queue.service.ts#L446](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/bot-job-queue.service.ts#L446):<br/>Thấy `dispatchRes.status === 'SUCCESS'` và không có `isWaitingFiles` $\rightarrow$ **Đánh dấu task thành `PASSED` (Tick xanh thành công ảo)**. |

---

## 3. DANH SÁCH CÁC FILE CẦN SỬA ĐỔI

1. **`backend/src/shared/contracts/bot-execution.contract.ts`**:
   - Thêm trạng thái `'WAITING'` vào `TaskExecutionStatus`.
   - Thêm trường `isWaitingFiles?: boolean` vào `TaskExecutionResult`.
2. **`backend/src/modules/trading-ops/workers/klgd-recon.worker.ts`**:
   - Bổ sung kiểm tra `res.isWaitingFiles` trước khi kết luận trạng thái.
   - Trả về `status = 'WAITING'` và giữ nguyên thông báo chờ file khi số liệu = 0.
3. **`backend/src/modules/trading-ops/workers/pre-eod-recon.worker.ts`**:
   - Khắc phục tương tự cho tác vụ đối chiếu chốt 3 bên cuối ngày (`CHECK_PRE_EOD`).
4. **`backend/src/modules/bot-engine/bot-job-queue.service.ts`**:
   - Bảo toàn cờ `isWaitingFiles` từ `dispatchRes` vào `job.payload.result`.
   - Giữ trạng thái task ca trực là `PENDING` khi `dispatchRes.status === 'WAITING'`.

---

## 4. CODE CHI TIẾT TỪNG FILE (COPY - PASTE SỬA ĐỔI)

### File 1: `backend/src/shared/contracts/bot-execution.contract.ts`
> **Mục tiêu**: Mở rộng kiểu dữ liệu chuẩn của Worker để hỗ trợ trạng thái Chờ File.

```typescript
export type TaskExecutionStatus = 'SUCCESS' | 'FAILED' | 'WARNING' | 'WAITING';

export interface TaskExecutionContext {
  taskId: string;
  shiftId?: string;
  botCheckType: string;
  targetDate?: string;
  parameters?: Record<string, any>;
  triggeredBy?: string;
}

export interface TaskExecutionResult {
  status: TaskExecutionStatus;
  summary: string;
  isWaitingFiles?: boolean;             // <-- BỔ SUNG CỜ CHỜ FILE
  metrics?: Record<string, any>;
  details?: Record<string, any>;        // <-- BỔ SUNG THÔNG TIN CHI TIẾT
  domainLogRefId?: string;
  error?: string;
  durationMs?: number;
  executedAt: Date;
}
```

---

### File 2: `backend/src/modules/trading-ops/workers/klgd-recon.worker.ts`
> **Mục tiêu**: Bắt đúng cờ `res.isWaitingFiles`. Tuyệt đối không sinh chuỗi "Khớp 100%" khi thiếu file.

Tìm đoạn `async execute(context: TaskExecutionContext)` và sửa như sau:

```typescript
    try {
      const targetDate = context.targetDate ? new Date(context.targetDate) : new Date();
      const res = await this.klgdReconService.runAutoCheckKLGD(targetDate, {
        cutoffTime: context.parameters?.cutoffTime ? new Date(context.parameters.cutoffTime) : undefined,
        customDataDir: context.parameters?.dataDir,
      });

      // ── BƯỚC 1: XỬ LÝ TRƯỜNG HỢP ĐANG CHỜ FILE (FAIL-SAFE / ZERO FALSE-POSITIVE) ──
      if (res.isWaitingFiles) {
        this.logger.warn(`[KlgdReconWorker] ${res.message || 'Đang chờ cập nhật file đối chiếu.'}`);
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: res.message || '[Đang chờ dữ liệu] Thư mục backup đang chờ cập nhật đầy đủ file đối chiếu.',
          metrics: {
            totalDSGD: 0,
            totalFR: 0,
            totalACM: 0,
            totalNano: 0,
            differ: 0,
            differACM: 0,
            mismatchedTradesCount: 0,
            mismatchedTTMCount: 0,
            mismatchedTTTTCount: 0,
          },
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      // ── BƯỚC 2: ĐỐI SOÁT KHI ĐÃ CÓ ĐỦ DỮ LIỆU THỰC TẾ ──
      const hasDiscrepancy = !res.passed;
      const status = hasDiscrepancy ? 'WARNING' : 'SUCCESS';
      const summary = res.passed
        ? `Khớp 100% (DSGD: ${res.totals.totalDSGD}, FR: ${res.totals.totalFR}, Nano: ${res.totals.totalNano})`
        : `Phát hiện lệch: Lệch CQG=${res.totals.differ}, Lệch ACM=${res.totals.differACM}, Lệch khớp lệnh=${res.mismatchedTrades.length}`;

      let domainLogRefId: string | undefined;

      // Lưu log chi tiết vào collection độc lập trading_recon_logs
      if (this.reconLogModel) {
        try {
          const logRecord = await this.reconLogModel.create({
            reconType: 'KLGD',
            tradingDate: targetDate.toISOString().split('T')[0],
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed: res.passed,
            totals: res.totals,
            mismatchedTrades: res.mismatchedTrades,
            mismatchedPositions: [],
            cutoffTime: context.parameters?.cutoffTime ? new Date(context.parameters.cutoffTime) : undefined,
          });
          domainLogRefId = (logRecord as any)?._id?.toString();
        } catch (dbErr: any) {
          this.logger.warn(`[KlgdReconWorker] Lỗi lưu TradingReconLog: ${dbErr.message}`);
        }
      }

      return {
        status,
        summary,
        isWaitingFiles: false,
        metrics: {
          totalDSGD: res.totals.totalDSGD,
          totalFR: res.totals.totalFR,
          totalACM: res.totals.totalACM,
          totalNano: res.totals.totalNano,
          differ: res.totals.differ,
          differACM: res.totals.differACM,
          mismatchedTradesCount: res.mismatchedTrades.length,
          mismatchedTTMCount: res.mismatchedTTM.length,
          mismatchedTTTTCount: res.mismatchedTTTT?.length || 0,
        },
        domainLogRefId,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
```

---

### File 3: `backend/src/modules/trading-ops/workers/pre-eod-recon.worker.ts`
> **Mục tiêu**: Bắt đúng cờ `res.isWaitingFiles` cho tác vụ đối chiếu Pre-EOD cuối ngày.

Sửa phương thức `execute` trong `PreEodReconWorker`:

```typescript
    try {
      const targetDate = context.targetDate ? new Date(context.targetDate) : new Date();
      const res = await this.preEodReconService.runAutoCheckPreEOD(
        targetDate,
        context.parameters?.dataDir,
      );

      // ── BƯỚC 1: XỬ LÝ TRƯỜNG HỢP CHỜ FILE PRE-EOD ──
      if (res.isWaitingFiles) {
        this.logger.warn(`[PreEodReconWorker] ${res.message || 'Đang chờ cập nhật file Pre-EOD.'}`);
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: res.message || '[Đang chờ dữ liệu Pre-EOD] Đang chờ cập nhật đầy đủ file đối chiếu cuối ngày.',
          metrics: {
            totalACM_MS: 0,
            totalACM_Straits: 0,
            differACM: 0,
            totalCQG_MS: 0,
            totalCQG_FR: 0,
            differCQG: 0,
            mismatchedTradesCount: 0,
            mismatchedPositionsCount: 0,
          },
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      // ── BƯỚC 2: ĐỐI SOÁT KHI ĐÃ CÓ ĐỦ FILE PRE-EOD ──
      const status = res.passed ? 'SUCCESS' : 'WARNING';
      const summary = res.passed
        ? `Pre-EOD Khớp 100% (CQG: ${res.totals.totalCQG_FR}, ACM: ${res.totals.totalACM_Straits})`
        : `Phát hiện lệch Pre-EOD: Lệch CQG=${res.totals.differCQG}, Lệch ACM=${res.totals.differACM}, Lệch lệnh=${res.mismatchedTrades.length}, Lệch vị thế=${res.mismatchedPositions.length}`;
```

---

### File 4: `backend/src/modules/bot-engine/bot-job-queue.service.ts`
> **Mục tiêu**: Bảo toàn cờ `isWaitingFiles` tại tầng Facade khi nhận kết quả từ BotDispatcher V2.

Tại khoảng dòng 435 - 455 trong phương thức `processQueue()`:

```typescript
        const dispatchRes = await this.botDispatcher.dispatch(taskContext);
        job.logs.push(
          `[${new Date().toISOString()}] [BotDispatcher V2] ${dispatchRes.summary}`,
        );

        const isWaiting = dispatchRes.status === 'WAITING' || !!dispatchRes.isWaitingFiles;
        const enrichedResult = {
          ...(dispatchRes.metrics || {}),
          ...(dispatchRes.details || {}),
          status: dispatchRes.status,
          summary: dispatchRes.summary,
          passed: dispatchRes.status === 'SUCCESS',
          isWaitingFiles: isWaiting, // <-- BẢO TOÀN CỜ isWaitingFiles CHO CHECKLIST SYNC
          message: dispatchRes.summary,
        };
        job.payload = { ...contextPayload, result: enrichedResult };

        const isSuccess = dispatchRes.status !== 'FAILED';
        const finalStatus = isSuccess ? 'COMPLETED' : 'FAILED';
        if (!isSuccess) {
          job.error = dispatchRes.error || dispatchRes.summary;
        }
        await job.save();

        const freshJob = await this.botJobModel.findById(job._id).select('status').exec();
        if (freshJob?.status === 'CANCELLED') {
          this.logger.log(`[QUEUE] Job ${job.jobType} (${job._id}) đã bị hủy giữa chừng.`);
          return;
        }

        await this.syncJobToChecklist(job, finalStatus);
        this.logger.log(
          `Job ${job.jobType} (ID: ${job._id}) hoàn thành (${finalStatus}) qua BotDispatcher V2.`,
        );
        return;
```

---

## 5. KỊCH BẢN KIỂM THỬ THẨM ĐỊNH (VERIFICATION & TEST PLAN)

### Test Case 1: Thư mục chưa có file (Mô phỏng máy chủ Ubuntu lúc 14:33)
- **Hành vi mong đợi**:
  - Log xuất hiện: `[BotDispatcher V2] [Đang chờ dữ liệu] Thư mục backup ngày... đang chờ cập nhật đầy đủ file đối chiếu (Đang thiếu: DSGD.xlsx, ACM Trades, CQG FR)`.
  - **TUYỆT ĐỐI KHÔNG** xuất hiện chuỗi text `"Khớp 100% (DSGD: 0, FR: 0, Nano: 0)"`.
  - Tác vụ trên giao diện Checklist giữ nguyên màu vàng cam / `PENDING` (Chờ file).
  - Không sinh tick xanh giả mạo.

### Test Case 2: Đã tải đủ 3 file nguồn (`DSGD.xlsx`, `FR.xlsx`, `Straits.csv`)
- **Hành vi mong đợi**:
  - Bot đọc đúng dữ liệu, tổng số lot `totalDSGD`, `totalFR`, `totalNano` > 0.
  - Kết luận `Khớp 100%` đúng thực chất số liệu thị trường.
  - Tác vụ ca trực được đánh dấu `PASSED`.

---
*Tài liệu được biên soạn phục vụ chuyển giao và đồng bộ mã nguồn giữa `mxv-modular-refactor` và `mxv-cqg-download-investigation`.*
