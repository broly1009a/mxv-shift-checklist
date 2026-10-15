# KẾ HOẠCH TỔNG THỂ & LỘ TRÌNH CHIA NHỎ NHIỆM VỤ NGUYÊN TỬ (ATOMIC TASKS)
## CHUYỂN ĐỔI HỆ THỐNG: MONOLITH V1 ➔ MODULAR MONOLITH V2

---

> **Mã kế hoạch**: `MXV-ATOMIC-MIGRATION-PLAN-2026`  
> **Phương pháp tiếp cận**: **Strangler Fig Pattern (Cây đa bóp cổ)** — Xây song song, kiểm chứng đối ứng 1:1, không đập bỏ code cũ khi chưa pass 100%.  
> **Nguyên tắc cốt lõi**: "Làm đâu chắc đó — Chia nhỏ từng Task — Không làm cả cục — Bảo toàn 100% logic ngầm & hằng số".  
> **Cơ sở thực chứng**: [report-dev](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/report-dev) & Quy chuẩn [AGENTS.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/.agents/AGENTS.md).

---

## MỤC LỤC LỘ TRÌNH 6 PHA (6 PHASES)

1. [PHA 0: Chuẩn Bị & Đóng Băng Mẫu Kiểm Thử Bảo Chứng (Baseline & Golden Dataset)](#pha-0)
2. [PHA 1: Xây Dựng Tầng Hợp Đồng Dùng Chung (Shared Ports & Contracts)](#pha-1)
3. [PHA 2: Phân Rã Tầng Kéo Dữ Liệu (Ingress Layer & Scrapers)](#pha-2)
4. [PHA 3: Độc Lập Hóa Khối Nghiệp Vụ Quản Lý Giao Dịch (Trading Ops Domain)](#pha-3)
5. [PHA 4: Độc Lập Hóa Khối Nghiệp Vụ Bù Trừ CCP (CCP Clearing Domain)](#pha-4)
6. [PHA 5: Tái Cấu Trúc Khối Ca Trực & Bộ Điều Phối Động (Checklist Hub & Dispatcher)](#pha-5)
7. [PHA 6: Tích Hợp Atomic Queue Multi-Instance & Sẵn Sàng Off Playwright](#pha-6)

---

<a name="pha-0"></a>
## PHA 0: CHUẨN BỊ & ĐÓNG BĂNG MẪU KIỂM THỬ BẢO CHỨNG (BASELINE)
*Mục tiêu: Đảm bảo có bộ dữ liệu mẫu chuẩn (Golden Dataset) và test benchmark để so sánh kết quả 1:1, không phỏng đoán số liệu.*

### Task 0.1: Đóng Băng Mẫu Dữ Liệu Đối Soát (Golden Dataset Freezing)
- **Nội dung**: Lưu trữ snapshot dữ liệu ngày `08.07` và ngày `13.10.2026` gần nhất (file MS, CQG, ACM, CCP) vào thư mục test mẫu.
- **File tác động**: `backend/src/tests/fixtures/golden_dataset/`
- **Logic cần bảo tồn**: Bảng số liệu chuẩn: Tổng số lệnh khớp, số lot chênh lệch, trạng thái PASSED/FAILED.
- **Tiêu chí hoàn thành (DoD)**: Có file script `test_golden_baseline.ts` chạy ra kết quả chuẩn làm thước đo đối chiếu.

### Task 0.2: Khởi Tạo Test Rào Chắn Cách Ly (Module Isolation Test)
- **Nội dung**: Viết Unit Test tự động quét mã nguồn bắt lỗi Deep Import (học theo [report-dev/test/boundary/module-isolation.test.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/report-dev/test/boundary/module-isolation.test.ts)).
- **File tác động**: `backend/test/boundary/module-isolation.spec.ts`
- **Tiêu chí hoàn thành (DoD)**: Test chạy pass với cấu trúc hiện tại, sẵn sàng fail nếu ai đó viết deep import xuyên module.

---

<a name="pha-1"></a>
## PHA 1: XÂY DỰNG TẦNG HỢP ĐỒNG DÙNG CHUNG (SHARED PORTS & CONTRACTS)
*Mục tiêu: Thiết lập các cổng giao tiếp chuẩn hóa (Ports) trước khi viết bất kỳ logic nào.*

### Task 1.1: Tạo Ingress Port & Result Contract
- **Nội dung**: Định nghĩa interface `IIngressPort` và DTO `IngressResult`, `IngressFileDetail`.
- **File tác động**:
  - `backend/src/shared/ports/ingress.port.ts`
  - `backend/src/shared/contracts/ingress-result.contract.ts`
- **Logic cốt lõi**: `IngressResult` **bắt buộc mang theo `outputDir` và `absolutePath`** của từng file tải về.
- **Tiêu chí hoàn thành (DoD)**: Biên dịch TypeScript thành công (`nest build` Exit code 0).

### Task 1.2: Tạo Bot Worker Port & Execution Contract
- **Nội dung**: Định nghĩa interface `IBotWorker` và DTO `TaskExecutionContext`, `TaskExecutionResult`.
- **File tác động**:
  - `backend/src/shared/ports/bot-worker.port.ts`
  - `backend/src/shared/contracts/bot-execution.contract.ts`
- **Logic cốt lõi**: `TaskExecutionResult` chỉ trả về `{ status, summary, metrics, domainLogRefId }`, **tuyệt đối không chứa logic cập nhật database ca trực**.
- **Tiêu chí hoàn thành (DoD)**: `nest build` Pass.

### Task 1.3: Thiết Lập Namespace Cấu Hình Độc Lập Cho Từng Khối
- **Nội dung**: Định nghĩa các Interface cấu hình riêng cho từng Domain:
  - `ITradingOpsConfig` (đường dẫn lưu trữ QLGD, account sàn)
  - `ICcpClearingConfig` (đường dẫn lưu trữ CCP, account bù trừ)
  - `IItOpsConfig` (đường dẫn backup, account IT)
- **File tác động**: `backend/src/shared/domain-configs/`
- **Tiêu chí hoàn thành (DoD)**: Không dùng chung biến môi trường, phân vùng rõ ràng.

---

<a name="pha-2"></a>
## PHA 2: PHÂN RÃ TẦNG KÉO DỮ LIỆU (INGRESS LAYER & SCRAPERS)
*Mục tiêu: Xé nhỏ "God Service" `rpa-downloader.service.ts` (204KB) thành 4 Scraper độc lập, nhưng giữ Wrapper cũ để hệ thống đang chạy không bị ảnh hưởng.*

### Task 2.1: Tách M-System Scraper (`ms-scraper.service.ts`)
- **Nội dung**: Bóc tách toàn bộ code cào web M-System (ASP.NET) từ `rpa-downloader.service.ts` ra file riêng.
- **File tạo mới**: `backend/src/modules/ingress/scrapers/ms-scraper.service.ts`
- **Logic ngầm bắt buộc giữ nguyên 100%**:
  - Cơ chế giữ session cookie `AWSELB` / `AWSELBCORS`.
  - Hàm `ensureLoggedIn()` tự phát hiện và bypass phiên đăng nhập trùng.
  - Tải đủ các file: `TTM`, `TTTT`, `DSGD`, `DSGD_LME`.
- **Tiêu chí hoàn thành (DoD)**: Chạy test độc lập `node src/scripts/test_ms_download_ttm_tttt.js` tải file thành công.

### Task 2.2: Tách CQG Scraper Song Song 2 Tài Khoản (`cqg-scraper.service.ts`)
- **Nội dung**: Bóc tách logic khởi chạy song song 2 trình duyệt CQG1 và CQG2.
- **File tạo mới**: `backend/src/modules/ingress/scrapers/cqg-scraper.service.ts`
- **Logic ngầm bắt buộc giữ nguyên 100%**:
  - Tải đồng thời 2 bộ file (`FR1+FR2`, `OP1+OP2`, `PS1+PS2`, `OD1+OD2`).
  - Đo benchmark thời gian và độ lệch `mtime`.
- **Tiêu chí hoàn thành (DoD)**: Chạy test độc lập `node src/scripts/test_cqg_parallel_standalone.js` tải thành công.

### Task 2.3: Tách ACM Scraper (`acm-scraper.service.ts`)
- **Nội dung**: Bóc tách logic tải file `Straits.csv` (Web ETP + Giải Captcha AI hoặc SFTP Client).
- **File tạo mới**: `backend/src/modules/ingress/scrapers/acm-scraper.service.ts`
- **Logic ngầm bắt buộc giữ nguyên 100%**:
  - Nhận diện đúng file `Straits*.csv` (không nhầm với Fill/Order).
  - Tự động fallback giữa SFTP và Web.
- **Tiêu chí hoàn thành (DoD)**: Test tải ACM ra file chuẩn.

### Task 2.4: Tách CoreCCP Scraper (`ccp-scraper.service.ts`)
- **Nội dung**: Bóc tách logic tải 25 báo cáo từ CoreCCP.
- **File tạo mới**: `backend/src/modules/ingress/scrapers/ccp-scraper.service.ts`
- **Logic ngầm bắt buộc giữ nguyên 100%**:
  - Xử lý phân trang và chọn rổ báo cáo 25 file.
- **Tiêu chí hoàn thành (DoD)**: Chạy test `node src/scripts/test_ccp_download_25_files.js` thành công.

### Task 2.5: Xây Dựng Ingress Facade & Wrapping Adapter Cho Code Cũ
- **Nội dung**:
  - Tạo `IngressService` (Facade) implement `IIngressPort`.
  - Trong file cũ [rpa-downloader.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/rpa-downloader.service.ts), giữ nguyên tên các hàm cũ nhưng bên trong gọi ủy quyền sang `IngressService`.
- **Lợi ích**: Code cũ ở Monolith V1 vẫn chạy trơn tru 100%, không bị gãy bất kỳ flow nào.
- **Tiêu chí hoàn thành (DoD)**: `nest build` Exit code 0, dev server chạy bình thường.

---

<a name="pha-3"></a>
## PHA 3: ĐỘC LẬP HÓA KHỐI NGHIỆP VỤ QUẢN LÝ GIAO DỊCH (TRADING OPS DOMAIN)
*Mục tiêu: Đưa toàn bộ thuật toán so khớp lệnh tài chính về Pure Logic, tách biệt hoàn toàn khỏi Playwright và ca trực.*

### Task 3.1: Di Dời CQG Raw Merger (`cqg-merger.service.ts`)
- **Nội dung**: Bóc tách logic ghép 4 cặp file thô CQG từ `cqg-sync.service.ts` và `reconciliation.service.ts`.
- **File tạo mới**: `backend/src/modules/trading-ops/services/cqg-merger.service.ts`
- **Logic ngầm bắt buộc giữ nguyên 100%**:
  - Cắt bỏ chính xác 2 dòng footer tổng kết của `FR1` và `FR2` (`row.values.slice(0, -2)`).
  - Quy tắc đổi đuôi tài khoản: `F$` $\rightarrow$ `""`, `L$` $\rightarrow$ `"-L"`, `S$` $\rightarrow$ `"-S"`.
  - Nhận trực tiếp `outputDir` từ `IngressResult`, không đoán mò đường dẫn.
- **Tiêu chí hoàn thành (DoD)**: Ghép file `FR.xlsx`, `PS.xlsx` cho ra kết quả khớp 100% với file C# ghép.

### Task 3.2: Di Dời Logic Đối Chiếu Khớp Lệnh Trong Phiên (`klgd-recon.service.ts`)
- **Nội dung**: Bóc tách logic so khớp MS vs CQG trong phiên (`CheckKLGD`).
- **File tạo mới**: `backend/src/modules/trading-ops/services/klgd-recon.service.ts`
- **Logic ngầm bắt buộc giữ nguyên 100%**:
  - Pure Logic tính toán (không import Playwright).
  - So khớp mã hàng hóa, kỳ hạn, số lot, giá, loại lệnh mua/bán.
- **Tiêu chí hoàn thành (DoD)**: Chạy đối chiếu Golden Dataset ngày `08.07` ra đúng 0 lệch.

### Task 3.3: Di Dời Logic Đối Chiếu Pre-EOD 3 Bên (`pre-eod-recon.service.ts`)
- **Nội dung**: Bóc tách logic chốt 3 bên MS vs CQG vs Straits/ACM cuối ngày (`CheckEOD`).
- **File tạo mới**: `backend/src/modules/trading-ops/services/pre-eod-recon.service.ts`
- **Logic ngầm bắt buộc giữ nguyên 100%**:
  - Quy tắc ngày làm việc T-1 từ `WorkingCalendarService`.
  - Quy tắc trừ các giao dịch EFP, phân bổ theo kỳ hạn.
- **Tiêu chí hoàn thành (DoD)**: Khớp số 100% với file C# `CheckPreEodRunner.exe`.

### Task 3.4: Di Dời Logic Quét Ký Quỹ Âm (`margin-checker.service.ts`)
- **Nội dung**: Bóc tách logic quét tài khoản vi phạm tỷ lệ ký quỹ sau EOD.
- **File tạo mới**: `backend/src/modules/trading-ops/services/margin-checker.service.ts`
- **Tiêu chí hoàn thành (DoD)**: Đọc file `Balances` và phát hiện đúng các tài khoản âm.

### Task 3.5: Đóng Gói KlgdReconWorker & PreEodReconWorker (`IBotWorker`)
- **Nội dung**: Tạo các Worker implement `IBotWorker` để Checklist Hub có thể gọi qua Interface chuẩn.
- **File tạo mới**:
  - `backend/src/modules/trading-ops/workers/klgd-recon.worker.ts`
  - `backend/src/modules/trading-ops/workers/pre-eod-recon.worker.ts`
- **Tiêu chí hoàn thành (DoD)**: Worker nhận `TaskExecutionContext` và trả về `TaskExecutionResult`.

### Task 3.6: Tách Riêng Database Log Cho Trading Ops (`trading_recon_logs`)
- **Nội dung**: Tạo collection MongoDB riêng `trading_recon_logs` để lưu trữ chi tiết bảng lệnh, diff breakdown.
- **Lợi ích**: Checklist ca trực không bị phình to document quá 16MB.
- **Tiêu chí hoàn thành (DoD)**: Log chi tiết được lưu riêng và trả về `domainLogRefId`.

---

<a name="pha-4"></a>
## PHA 4: ĐỘC LẬP HÓA KHỐI NGHIỆP VỤ BÙ TRỪ CCP (CCP CLEARING DOMAIN)
*Mục tiêu: Đưa phân hệ tính toán Macro Lot và Giá trị CCP về module độc lập.*

### Task 4.1: Di Dời Thống Kê Lot & Giá Trị Giao Dịch CCP
- **Nội dung**: Chuyển đổi logic tính toán thống kê từ `bot-job-queue.service.ts` và helper C# sang TypeScript service.
- **File tạo mới**: `backend/src/modules/ccp-clearing/services/lot-statistics.service.ts`
- **Logic ngầm bắt buộc giữ nguyên 100%**:
  - Công thức tính số lot theo từng rổ hàng hóa, từng nhóm thành viên kinh doanh.
  - Tỷ giá quy đổi tiền tệ.
- **Tiêu chí hoàn thành (DoD)**: Chạy test so sánh với file Excel gốc ra sai số = 0.

### Task 4.2: Đóng Gói CcpLotWorker & Tách Log Riêng
- **Nội dung**: 
  - Tạo `CcpLotWorker` implement `IBotWorker`.
  - Tạo collection riêng `ccp_clearing_logs`.
- **Tiêu chí hoàn thành (DoD)**: Chạy test độc lập không phụ thuộc vào ca trực.

---

<a name="pha-5"></a>
## PHA 5: TÁI CẤU TRÚC KHỐI CA TRỰC & BỘ ĐIỀU PHỐI ĐỘNG (CHECKLIST HUB & DISPATCHER)
*Mục tiêu: Làm sạch Checklist Core, triệt tiêu toàn bộ mã nguồn nghiệp vụ sàn ra khỏi ca trực.*

### Task 5.1: Xây Dựng Bot Dispatcher Service (Mô Hình Tương Tự `report-dev`)
- **Nội dung**: Viết `BotDispatcherService` tại `src/modules/checklist-hub/dispatcher/`:
  - Đăng ký dynamic các Worker thông qua Registry.
  - Khi có lệnh chạy bot, Dispatcher tìm Worker theo `botCheckType` và gọi `worker.execute(context)`.
- **Logic ngầm bắt buộc giữ nguyên**:
  - Cơ chế Cooldown 15 phút tránh spam job.
  - Nhận diện cha-con động qua CSDL (`parentTaskIdSnapshot`).
- **Tiêu chí hoàn thành (DoD)**: Checklist Hub không import bất kỳ class nào của `trading-ops` hay `ccp-clearing`.

### Task 5.2: Triệt Tiêu Circular Dependency (`forwardRef`)
- **Nội dung**: Gỡ bỏ toàn bộ 2 `forwardRef()` trong `recon-jobs.handler.ts` và các module liên quan bằng cách chuyển sang inject Interface qua Token hoặc Dispatcher.
- **Tiêu chí hoàn thành (DoD)**: Không còn cảnh báo vòng lặp phụ thuộc khi khởi động NestJS.

---

<a name="pha-6"></a>
## PHA 6: TÍCH HỢP ATOMIC QUEUE MULTI-INSTANCE & SẴN SÀNG OFF PLAYWRIGHT
*Mục tiêu: Sẵn sàng mở rộng nhiều Instance và chuẩn bị sẵn hạ tầng đón nhận CoreEX / CoreCCP API.*

### Task 6.1: Nâng Cấp Atomic Lock Trên MongoDB `bot_jobs`
- **Nội dung**: Thay thế cờ RAM `this.isProcessing = true` trong `bot-job-queue.service.ts` bằng lệnh nguyên tử:
  `botJobModel.findOneAndUpdate({ status: 'PENDING' }, { $set: { status: 'PROCESSING', lockedBy: instanceId } })`.
- **Tiêu chí hoàn thành (DoD)**: Bật thử 2 tiến trình Node.js song song, cả 2 tự động chia việc mà không chạy đè job của nhau.

### Task 6.2: Xây Dựng Khung CoreEx & CoreCcp API Adapters (Playwright Sunsetting Bridge)
- **Nội dung**: Tạo sẵn 2 adapter `CoreExApiAdapter` và `CoreCcpApiAdapter` implement `IIngressPort`. Khi sàn cấp API thật, chỉ việc điền URL và Token là hệ thống tự động tắt hẳn Playwright.
- **Tiêu chí hoàn thành (DoD)**: Khung interface khớp 100% với `IIngressPort`.

### Task 6.3: Kiểm Thử Toàn Trình E2E & Chạy Thẩm Định Ranh Giới (Boundary Audit)
- **Nội dung**:
  - Chạy `npm run test:boundary` để assert 0% deep-import vi phạm.
  - Chạy toàn bộ luồng ca trực thực tế trên nhánh test.
- **Tiêu chí hoàn thành (DoD)**: Toàn bộ hệ thống xanh, `nest build` Exit code 0, không có hồi quy lỗi.

---

## 🎯 BẢNG CAM KẾT CHẤT LƯỢNG (QUALITY ASSURANCE INVARIANTS)

1. **Không Làm Cả Cục (One Task at a Time)**: Mỗi lần chỉ làm đúng 1 Task nhỏ, commit và verify build trước khi sang Task kế tiếp.
2. **Bảo Tồn 100% Logic Cũ (Zero Logic Loss)**: Mọi regex, footer slicing, account suffix, sticky cookie phải được giữ nguyên vẹn.
3. **An Toàn Ca Trực Đang Chạy (Zero Downtime)**: Nhánh chính `dev-minhle` tiếp tục phục vụ ca trực bình thường; toàn bộ quá trình bóc tách diễn ra độc lập trên nhánh `refactor/modular-architecture`.
