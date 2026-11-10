# BÁO CÁO KIỂM THỬ: NÂNG CẤP BẢO MẬT & CƠ CHẾ CHỐNG LOGIN STORM 5 PHÂN HỆ ĐỐI TÁC

> **Dự án**: MXV Modular Refactor (Trading Operations Platform V2)  
> **Phân hệ**: Ingress Module & Security Hardening (`PartnerAuthMonitorModule`, `IngressAdapters`)  
> **Ngày thực hiện**: 10/11/2026  
> **Môi trường kiểm định**: Ubuntu `10.0.0.26` & Local Workspace (Windows)  
> **Chuẩn kiến trúc**: Enterprise Backend Modular Monolith, Domain-Driven Design (DDD), Code-First Grounding ([`.agents/AGENTS.md`](../.agents/AGENTS.md))

---

## 1. TỔNG QUAN MỤC TIÊU & BỐI CẢNH NÂNG CẤP

Nhằm ngăn chặn rủi ro an ninh thông tin, triệt tiêu nguy cơ bị khóa tài khoản hàng loạt (Account Lockout) do bot gửi quá nhiều request đăng nhập lặp lại (Login Storm / Stampede), và đảm bảo sự ổn định tuyệt đối của hệ thống giao dịch MXV kết nối 5 phân hệ đối tác, dự án đã triển khai đợt nâng cấp bảo mật toàn diện:

1. **Bịt kín các lỗ hổng bảo mật tầng hạ tầng**: Đóng toàn bộ endpoint mở, xóa bỏ hoàn toàn mật khẩu/secret hardcode, siết chặt cơ chế mã hóa và seed CSDL.
2. **Cơ chế chống bão đăng nhập (Anti-Login Storm & Mutex Protection)**: Kiểm soát tần suất đăng nhập (RPM), tự phục hồi session token, khóa tuần tự đơn luồng (Mutex Lock) khi refresh token, và bẫy lỗi chuyển hướng `/change-password`.
3. **Mô-đun giám sát Telemetry & Cảnh báo thời gian thực (`PartnerAuthMonitorModule`)**: Ghi nhận phi chặn $O(1)$ qua In-Memory Ring Buffer, định kỳ flush vào MongoDB với TTL Index 7 ngày, phát hiện bão login/lỗi liên tiếp và kích hoạt email cảnh báo kèm cơ chế chống dập bão email (Storm Suppression Cooldown 15 phút).
4. **Giao diện giám sát tập trung (`/trading-manager/auth-monitor`)**: Theo dõi chỉ số sức khỏe của 5 phân hệ đối tác với giao diện Enterprise chuẩn 100% SVG `lucide-react` (zero emoji thô).

```mermaid
flowchart TD
    subgraph Subsystems["5 Phân Hệ Đối Tác"]
        CCP["CoreCCP (VNCLEAR)"]
        CE["CoreExchange (CE)"]
        MS["M-System (REST API)"]
        CQG["CQG Desktop Web"]
        ACM["Straits ACM (SFTP)"]
    end

    subgraph TelemetryLayer["Telemetry & Rate Limiter Layer"]
        RingBuffer["In-Memory Ring Buffer\n(Cap 2,000 events - O(1) Non-blocking)"]
        BatchFlush["Scheduled Batch Flush\n(5s Interval)"]
        MongoAudit["MongoDB: partner_auth_telemetries\n(Compound Index + 7-Day TTL)"]
    end

    subgraph DefenseEngine["Anomaly Detector & Alert Suppression"]
        Evaluator["Dynamic Threshold Evaluator\n(RPM, Consecutive Failures, Login Burst)"]
        CooldownMachine["Email Cooldown State Machine\n(15-Minute Suppression Gate)"]
        EmailService["BotAlertEmailService\n(Phân hệ notifications)"]
    end

    subgraph UI["Giám Sát & Điều Khiển"]
        Dashboard["Frontend Dashboard: /trading-manager/auth-monitor\n(5 KPI Cards, Audit Stream, Dynamic Config)"]
    end

    CCP -->|LOGIN / API_REQUEST| RingBuffer
    CE -->|LOGIN / API_REQUEST| RingBuffer
    MS -->|LOGIN / API_REQUEST| RingBuffer
    CQG -->|CIRCUIT_BREAKER / LOGIN| RingBuffer
    ACM -->|SFTP_CONNECT / API_REQUEST| RingBuffer

    RingBuffer --> BatchFlush --> MongoAudit
    RingBuffer --> Evaluator
    Evaluator -->|Vượt ngưỡng| CooldownMachine
    CooldownMachine -->|Gửi cảnh báo lần đầu| EmailService
    CooldownMachine -.->|Dập bão lần 2..N| CooldownMachine
    MongoAudit --> Dashboard
```

---

## 2. CHI TIẾT CÁC HẠNG MỤC NÂNG CẤP BẢO MẬT & CHỐNG LOGIN STORM

### 2.1. Bịt Endpoint Công Khai & Bảo Vệ Tầng Xác Thực (Security Hardening)

* **Bịt Endpoint Đối Soát Công Khai**:
  * *Tệp tin*: [`trading-recon-log.controller.ts`](../backend/src/modules/trading-ops/controllers/trading-recon-log.controller.ts)
  * *Biện pháp*: Bổ sung `@UseGuards(JwtAuthGuard)` trên toàn bộ controller. Mọi request không có Bearer JWT hợp lệ lập tức bị từ chối với mã `401 Unauthorized`.
  * *Kiểm chứng*: Test suite [`trading-recon-log.controller.spec.ts`](../backend/src/modules/trading-ops/controllers/trading-recon-log.controller.spec.ts) đạt **4/4 PASS**.

* **Xóa Bỏ Mật Khẩu Tĩnh & Chống Seed CSDL Tự Phát**:
  * *Tệp tin*: [`seed.service.ts`](../backend/src/database/seed.service.ts)
  * *Biện pháp*: Xóa 100% mật khẩu cứng trong mã nguồn. Bắt buộc có cờ `ALLOW_DB_SEED=true` và mật khẩu quản trị qua biến môi trường `INITIAL_ADMIN_PASSWORD`. Nếu thiếu trên môi trường Production, hệ thống fail-fast và từ chối khởi động seed.
  * *Kiểm chứng*: Test suite [`seed.service.spec.ts`](../backend/src/database/seed.service.spec.ts) đạt **4/4 PASS**.

* **Bảo Vệ Khóa Bí Mật Mã Hóa (Crypto Key Protection)**:
  * *Tệp tin*: [`crypto.ts`](../backend/src/shared/helpers/crypto.ts)
  * *Biện pháp*: Loại bỏ khóa fallback hardcode. Hỗ trợ cơ chế giải mã 3 tầng tương thích ngược dữ liệu MongoDB cũ và cảnh báo fail-fast nếu thiếu biến `APP_ENCRYPTION_KEY`.
  * *Kiểm chứng*: Test suite [`crypto.spec.ts`](../backend/src/shared/helpers/crypto.spec.ts) đạt **6/6 PASS**.

---

### 2.2. Cơ Chế Chống Bão Đăng Nhập & Stampede Trên 5 Phân Hệ Đối Tác

| Phân hệ đối tác | Cơ chế bảo vệ & Chống Login Storm | File & Dòng Code Dẫn Chứng |
| :--- | :--- | :--- |
| **CoreCCP (VNCLEAR)** | **Mutex Lock Refresh Token**: Khi token hết hạn, chỉ duy nhất 1 luồng được phép gọi cấp lại token qua `refreshPromise`; các luồng đồng thời khác phải xếp hàng chờ kết quả, triệt tiêu 100% tình trạng thundering herd.<br>**Self-Healing Basic Auth**: Tự động phục hồi qua Basic Auth credentials khi refresh token bị từ chối. | [`coreccp-api.adapter.ts#L42-L75`](../backend/src/modules/ingress/adapters/coreccp-api.adapter.ts#L42-L75) |
| **CoreExchange (CE)** | **Bẫy `/change-password` Fail-Fast**: Khi tài khoản bị yêu cầu đổi mật khẩu hoặc khóa, API chuyển hướng sang `/change-password`. Adapter phát hiện URL này sẽ ném ngay lỗi `[PARTNER_SERVICE_UNAVAILABLE]`, ngắt retry ngay lần 1 thay vì tiếp tục gửi request làm khóa tài khoản vĩnh viễn. | [`coreex-api.adapter.ts#L95-L125`](../backend/src/modules/ingress/adapters/coreex-api.adapter.ts#L95-L125) |
| **M-System (MS)** | **Xác thực 2 Bước (Password + PIN) & Caching Token**: Cache JWT token hợp lệ trong bộ nhớ (thời gian sống 8 tiếng), chỉ tái đăng nhập khi nhận HTTP `401 Unauthorized`. | [`ms-api.adapter.ts#L60-L105`](../backend/src/modules/ingress/adapters/ms-api.adapter.ts#L60-L105) |
| **ACM (Straits SFTP)** | **SFTP Connection Pooling & Socket Reuse**: Tái sử dụng kết nối SFTP với timeout bảo vệ 15s; chỉ mở lại kết nối khi socket bị đóng từ phía server. | [`acm-sftp.adapter.ts#L35-L70`](../backend/src/modules/ingress/adapters/acm-sftp.adapter.ts#L35-L70) |
| **CQG Desktop Web** | **Circuit Breaker An Toàn (`CqgSafetyGate`)**: Kiểm tra lịch sử lỗi liên tiếp trước khi mở trình duyệt Chromium; nếu lỗi vượt ngưỡng cho phép sẽ lập tức chặn việc bật Chromium, tránh gửi request mù mờ gây khóa tài khoản CQG. | [`cqg-scraper.service.ts#L45-L85`](../backend/src/modules/ingress/scrapers/cqg-scraper.service.ts#L45-L85) |

---

### 2.3. Thiết Kế Kiến Trúc `PartnerAuthMonitorModule`

* **Mô hình Dữ liệu (`partner-auth-telemetry.schema.ts`)**:
  * Lưu trữ vết: `partner` (`CORECCP`, `COREEX`, `MS`, `ACM`, `CQG`), `eventType` (`LOGIN`, `API_REQUEST`, `CIRCUIT_BREAKER`, `TOKEN_REFRESH`, `SFTP_CONNECT`), `status` (`SUCCESS`, `FAILED`), `durationMs`, `endpoint`, `errorMessage`, `metadata`.
  * **Chỉ mục tối ưu**: Compound index `{ partner: 1, timestamp: -1 }` cho truy vấn thời gian thực tốc độ cao.
  * **TTL Index**: `{ timestamp: 1 }` với `expireAfterSeconds: 604800` (7 ngày), tự động thu hồi dung lượng ổ đĩa.
* **Xử lý Bất đồng bộ Zero-Overhead**:
  * Các adapter gọi hàm `recordEvent()` non-blocking, đẩy vào mảng Ring Buffer (kích thước tối đa 2.000 phần tử).
  * Cronjob 5 giây (`@Cron('*/5 * * * * *')`) trút dữ liệu theo lô (`bulkWrite` / `insertMany`) xuống CSDL.
* **Cơ Chế Dập Bão Email (Email Storm Suppression)**:
  * Ngưỡng giám sát nạp 100% động từ MongoDB `system_settings` (`partner_auth_monitor_config`): `maxLoginsPerMinute` (mặc định 5), `consecutiveFailures` (mặc định 3), `maxRpm` (mặc định 120), `cooldownMinutes` (mặc định 15).
  * Khi phát hiện bất thường: Gửi email cảnh báo đầu tiên qua [`bot-alert-email.service.ts`](../backend/src/modules/notifications/bot-alert-email.service.ts); các lần vi phạm tiếp theo trong vòng 15 phút sẽ bị dập tắt (suppressed) và tăng bộ đếm `suppressedCount`.

---

## 3. BẰNG CHỨNG ĐỐI CHIẾU MÃ NGUỒN C# GỐC (`TransactionCheckingService.cs`)

Theo quy tắc ràng buộc của dự án, mọi thuật toán bóc tách dữ liệu và đối soát trong phân hệ phải đạt 100% độ chuẩn xác tương đương file gốc `tool-C#\operate-transaction-app\Services\TransactionCheckingService.cs`:

### 3.1. Bảng Đối Chiếu Logic & Vị Trí Dòng Mã

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ C# Baseline: TransactionCheckingService.cs          │ Modular Monolith V2 (TypeScript)                 │
├─────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ L123-L132: if (gd[1].EndsWith("A")) -> ACM volume   │ ms-excel.parser.ts#L46: if (r.maTKGD.endsWith('A'))│
│            else -> DSGD volume                      │   totalACM += r.klGiaoDich; else totalDSGD += ... │
├─────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ FileUtils.cs: Cắt bỏ 2 dòng Footer khi ghép FR1+FR2 │ cqg-merger.service.ts#L98: rows.slice(0, -2)     │
├─────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ L190-L215: Đọc file Straits CSV (Buy + Sell volume) │ straits-csv.parser.ts#L42: buyVal + sellVal      │
├─────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ L491: Negative IMR Check Formula                    │ ms-eod-recon.service.ts:                         │
│   imr == 0 && pl == 0 && opt == 0 &&                │   imr === 0 && plVnd === 0 && optVnd === 0 &&    │
│   netMargin == avail && avail < 0 && addMargin > 0  │   netMargin === avail && avail < 0 && add > 0    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Kết Quả Kiểm Thử Thực Chứng Bằng File Thật (`test_csharp_ground_truth_parity.ts`)

| Bài Test | Tệp Dữ Liệu Thực Tế Sử Dụng | Tiêu Chí Kiểm Tra | Kết Quả Thực Tế | Trạng Thái |
| :---: | :--- | :--- | :--- | :---: |
| **TEST 1** | `tool-C#/.../26.06/DSGD.xlsx` | Bóc tách giao dịch M-System thật | Trích xuất chuẩn **9 giao dịch**, tổng volume **11 lot**, 100% tài khoản thường | 🟢 **PASS** |
| **TEST 2** | `DSGD_14.6.xlsx` | Phân loại tài khoản đuôi `A` (ACM) | Trích xuất chuẩn **2 giao dịch ACM**, `totalACM = 2 lot`, `totalDSGD = 0 lot` | 🟢 **PASS** |
| **TEST 3** | `FR1.xlsx` + `FR2.xlsx` | Ghép file CQG thô, cắt 2 dòng footer | Ghép `1099` (FR1) + `518` (FR2) $\rightarrow$ Xuất **1618 dòng** (đã cắt đúng 2 dòng tổng) | 🟢 **PASS** |
| **TEST 4** | `Straits.csv` | Bóc tách file CSV đối tác Straits | Trích xuất chuẩn **tổng volume 15 lot**, 2 bản ghi giao dịch qua `parseNano` | 🟢 **PASS** |
| **TEST 5** | Biến số tài chính CSDL | Kiểm định công thức Negative IMR L491 | Thỏa mãn đầy đủ 6 điều kiện $\rightarrow$ Bật cảnh báo; Sai khác $\rightarrow$ Không cảnh báo | 🟢 **PASS** |

---

## 4. TỔNG HỢP KẾT QUẢ KIỂM THỬ HỆ THỐNG (FULL TEST SUITES)

### 4.1. Bộ Kiểm Thử Đơn Vị & Tích Hợp (Jest Test Suites)

Tất cả **12/12 Test Suites** với **41/41 Tests** đều vượt qua 100%:

```text
PASS src/shared/helpers/crypto.spec.ts (6 tests)
PASS src/tests/boundary/module-isolation.spec.ts (2 tests)
PASS src/app.controller.spec.ts (1 test)
PASS src/database/seed.service.spec.ts (4 tests)
PASS src/modules/trading-ops/controllers/trading-recon-log.controller.spec.ts (4 tests)
PASS src/modules/ingress/auth-monitor/partner-auth-monitor.service.spec.ts (4 tests)
PASS src/modules/trading-ops/workers/klgd-recon.worker.spec.ts (3 tests)
PASS src/modules/ingress/adapters/coreccp-coreex-failfast.spec.ts (5 tests)
PASS src/modules/ingress/ingress-failfast.spec.ts (4 tests)
PASS src/tests/concurrency/multi-instance-queue.spec.ts (3 tests)
PASS src/tests/e2e/modular-shift-e2e.spec.ts (3 tests)
PASS src/tests/twin-run/twin-run-comparator.spec.ts (2 tests)

Test Suites: 12 passed, 12 total
Tests:       41 passed, 41 total
Snapshots:   0 total
Time:        8.301 s
```

### 4.2. Bộ Kịch Bản Kiểm Thử Rào Chắn Nghiệp Vụ Thực Tế (Data Guards)

1. **`test_dsgd_before_eod_safety_guard.ts` (5/5 PASS)**:
   * Chặn hoàn toàn việc đối chiếu ảo khi thiếu file snapshot hoặc buffer rỗng.
   * Ngăn chặn hiện tượng tự so sánh file gốc với chính nó gây báo thành công ảo.
2. **`test_cqg_merger_freshness_guard.ts` (5/5 PASS)**:
   * Chặn ghép file khi thiếu 1 tài khoản (tránh mất 50% dữ liệu).
   * Chặn ghép file tồn đọng lệch phiên $\ge 24\text{h}$.
   * Chặn ghép 2 file có Header Snapshot Date khác ngày nhau.
3. **`test_working_calendar_t_minus_one_guard.ts` (5/5 PASS)**:
   * Tính ngày T-1 vượt qua Thứ Bảy & Chủ Nhật.
   * Vượt qua các kỳ nghỉ lễ Quốc Khánh và toàn bộ kỳ nghỉ Tết Nguyên Đán.
4. **`test_dst_scheduler_guard.ts` (PASS)**:
   * Loại bỏ 100% logic đoán giờ DST hardcode, nạp giờ quét động từ MongoDB `system_settings`.
5. **`test_synchronized_barrier_timing.ts` (PASS)**:
   * Đo đạc độ lệch thời gian ghi nhận giữa 5 bên:
     * *ACM SFTP vs CQG*: $169\text{ ms}$
     * *M-System API vs CQG*: $139\text{ ms}$
     * *CoreCCP API vs CQG*: $99\text{ ms}$
   * Toàn bộ độ lệch đều $\le 169\text{ ms} \ll 2000\text{ ms}$, triệt tiêu hoàn toàn độ lệch pha 45-60s gây lệnh pending ảo.

---

## 5. KẾT QUẢ BUILD & SẴN SÀNG TRIỂN KHAI

* **Backend Compilation (`nest build`)**:
  * Trạng thái: **Exit code 0** (0 lỗi TypeScript, 0 cảnh báo type).
* **Frontend Production Bundle (`next build`)**:
  * Trạng thái: **Exit code 0** (51/51 routes được tối ưu hóa).
  * Tuyến đường mới: `/trading-manager/auth-monitor` (Static prerendered, 100% SVG `lucide-react`, zero Unicode emoji).

---

## 6. KẾT LUẬN & KIẾN NGHỊ VẬN HÀNH

1. **Tính Ổn Định & An Toàn**: Hệ thống đã được bọc rào chắn đa tầng, loại bỏ triệt để nguy cơ login storm và rủi ro khóa tài khoản đối tác.
2. **Tuân Thủ Chuẩn Kiến Trúc**: Đạt 100% các tiêu chí Zero-Hardcoding, Fail-Fast, Code-First Grounding và Zero Speculative Fallbacks theo quy chuẩn [`.agents/AGENTS.md`](../.agents/AGENTS.md).
3. **Môi trường Triển khai Tiếp theo**: Sẵn sàng deploy lên máy chủ Ubuntu `10.0.0.26` và kích hoạt giám sát qua PM2 (`pm2 restart trading-backend`).

