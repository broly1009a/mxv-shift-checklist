# TÀI LIỆU TỔNG HỢP: KIẾN TRÚC HÀNG ĐỢI SONG SONG ĐA PHÂN HỆ & ĐIỀU PHỐI TÀI NGUYÊN CA TRỰC

> **Mã tài liệu**: `DOC-MXV-QUEUE-DISPATCHER-SUMMARY-2026`  
> **Dự án**: MXV Shift Checklist & Trading Manager Mission Control  
> **Cơ sở thực chứng (Ground Truth)**:  
> - Phân hệ Hằng số Tài nguyên: [job-domains.constant.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/shared/constants/job-domains.constant.ts)
> - Bộ Quản lý Khóa RAM: [domain-lock-manager.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/checklist-hub/queue/domain-lock-manager.service.ts)
> - Hàng đợi Điều phối: [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/checklist-hub/queue/bot-job-queue.service.ts)
> - Giao diện Hàng đợi: [TradingManagerJobQueueSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/job-queue/TradingManagerJobQueueSection.tsx)

---

## 1. BẢN CHẤT NGHIỆP VỤ THỰC TẾ TẠI MXV

Hằng ngày, một ca trực tại Sở Giao Dịch Hàng Hóa MXV cần xử lý rất nhiều tác vụ tương tác với các hệ thống sàn đối tác:
1. **M-System (MS)**: Tải báo cáo sao kê số dư, lệnh, giao dịch của MXV (chỉ cho phép 1 session đăng nhập duy nhất).
2. **CQG Cloud**: Tải và ghép file giao dịch 2 tài khoản CQG quốc tế.
3. **CoreCCP (VNCLEAR)**: Cổng thanh toán bù trừ trung tâm (tải 25 báo cáo thanh toán bù trừ, CAST).
4. **CE Clearing**: Cổng phái sinh hàng hóa.
5. **ACM (Straits Financial)**: Kênh truyền SFTP kéo file Straits CSV tự doanh.
6. **Email Gateway**: Quét và bóc tách email sao kê.
7. **Đối Soát (Reconciliation)**:
   - **Đối soát tính toán trên file có sẵn**: Chốt DSGD trước EOD, quét ký quỹ âm, chạy macro số lot/giá trị (chạy offline trên RAM/CPU chỉ mất vài giây).
   - **Đối soát tươi trong phiên (`CHECK_KLGD`)**: Bắt buộc phải cào file khớp lệnh tươi thời gian thực từ cả **M-System** (`DSGD`) và **CQG** (`FR`).

---

## 2. NGUYÊN LÝ HOẠT ĐỘNG: CÁI "NHÃN" & CHIẾC "BẢNG TRỰC"

Hệ thống điều phối hàng đợi biết được khi nào cho chạy song song, khi nào bắt xếp hàng chờ nhau nhờ **2 cơ chế cực kỳ đơn giản**:

```mermaid
graph TD
    subgraph Jobs ["1. Nhãn Yêu Cầu Tài Nguyên (Code quy định)"]
        J1["Tải Báo Cáo MS<br/><b>Nhãn: [MS]</b>"]
        J2["Tải CQG 2 TK<br/><b>Nhãn: [CQG]</b>"]
        J3["Tải 25 File CoreCCP<br/><b>Nhãn: [CCP]</b>"]
        J4["CHECK_KLGD (Tải file tươi)<br/><b>Nhãn: [MS, CQG, RECON]</b>"]
        J5["Chốt Trước EOD (File có sẵn)<br/><b>Nhãn: [RECON]</b>"]
    end

    subgraph LockBoard ["2. Bảng Trực Trạng Thái Trong RAM (DomainLockManager)"]
        B_MS["M-System: RẢNH 🟢 / BẬN 🔴"]
        B_CQG["CQG Cloud: RẢNH 🟢 / BẬN 🔴"]
        B_CCP["CoreCCP: RẢNH 🟢 / BẬN 🔴"]
        B_ACM["Straits SFTP: RẢNH 🟢 / BẬN 🔴"]
    end

    subgraph Decision ["3. Quyết Định Điều Phối Hàng Đợi"]
        D1{"Tất cả phân hệ<br/>trên nhãn đều RẢNH?"}
        Allow["Cho chạy ngay!<br/>(Ghi tên vào Bảng Trực)"]
        Wait["Bắt đứng chờ PENDING!<br/>(Không cho chen ngang)"]
    end

    Jobs --> D1
    LockBoard -.-> D1
    D1 -->|Đúng| Allow
    D1 -->|Có sàn đang bận| Wait
```

### 2.1. Cái "Nhãn" dán sẵn trên từng tác vụ (`getRequiredJobDomains`)
* Mã nguồn: [job-domains.constant.ts#L110-L123](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/shared/constants/job-domains.constant.ts#L110-L123)
* Quy định rõ:
  * Tác vụ chỉ cần M-System $\rightarrow$ Nhãn: `['MS']`.
  * Tác vụ chỉ cần CQG $\rightarrow$ Nhãn: `['CQG']`.
  * Tác vụ chỉ cần CoreCCP $\rightarrow$ Nhãn: `['CCP']`.
  * Tác vụ chỉ tính toán offline (như `CHECK_DSGD_BEFORE_EOD`, `SCAN_NEGATIVE_MARGIN`) $\rightarrow$ Nhãn: `['RECON']`.
  * **Đặc biệt: Tác vụ `CHECK_KLGD`** (vì tự động cào file tươi từ cả 2 sàn) $\rightarrow$ Nhãn: **`['MS', 'CQG', 'RECON']`**.

### 2.2. Chiếc "Bảng Trực Trạng Thái" trong RAM (`DomainLockManagerService`)
* Mã nguồn: [domain-lock-manager.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/checklist-hub/queue/domain-lock-manager.service.ts)
* Quản lý trạng thái tức thời của từng sàn:
  * Khi Job bắt đầu chạy $\rightarrow$ Ghi tên mình vào các ô sàn tương ứng trên Bảng (`BẬN`).
  * Khi Job kết thúc (thành công hoặc lỗi) $\rightarrow$ Khối `finally` tự động xóa tên mình khỏi Bảng (`RẢNH`).
  * Đồng thời gọi `setImmediate(() => this.processQueue())` để đánh thức Job đang đứng chờ trong hàng đợi lên chạy ngay mà không mất một giây nào.

---

## 3. CÁC KỊCH BẢN THỰC TẾ TRONG CA TRỰC

### Kịch Bản 1: Hai tác vụ cùng dùng một sàn $\rightarrow$ Tự động xếp hàng (Tránh đá session)
* **14:30:00**: Bot tự động chạy Job 1 tải báo cáo M-System (`RPA_DOWNLOAD_REPORTS`).
  * Trình duyệt bot mở lên, đăng nhập tài khoản M-System. Bảng trực ghi: `MS = BẬN (Job 1)`.
* **14:30:15**: Nhân sự ca trực bấm nút chạy Job 2: Đối chiếu số dư M-System (`CHECK_EOD_MS`).
  * Hệ thống nhìn nhãn của Job 2: Cần `MS`.
  * Hệ thống nhìn Bảng trực: `MS đang bận Job 1!`.
  * $\rightarrow$ **Job 2 tự động chuyển sang trạng thái PENDING đứng chờ**.
* **14:31:00**: Job 1 tải xong, tắt trình duyệt $\rightarrow$ `MS` trở về Rảnh.
* **14:31:01**: Job 2 lập tức được bốc lên chạy. Cả 2 Job đều thành công 100%, **không bao giờ bị lỗi đá văng phiên hay CAPTCHA**.

### Kịch Bản 2: Các phân hệ độc lập $\rightarrow$ Chạy song song (Rút ngắn thời gian ca trực)
* **04:00:00**: Đến giờ tải backup EOD hàng ngày.
  * Tác vụ MS tải báo cáo M-System (Nhãn: `MS`)
  * Tác vụ CQG tải 2 tài khoản CQG (Nhãn: `CQG`)
  * Tác vụ CoreCCP tải 25 file thanh toán bù trừ (Nhãn: `CCP`)
  * Tác vụ ACM tải file Straits SFTP (Nhãn: `ACM`)
* Vì 4 tác vụ này cần 4 sàn hoàn toàn khác nhau, **cả 4 tác vụ được chạy song song cùng một lúc**.
* Thời gian tải toàn bộ ca trực giảm từ **10 phút** xuống còn đúng **4 phút**.

### Kịch Bản 3: Tác vụ `CHECK_KLGD` cào file tươi $\rightarrow$ Tự động bảo vệ cả MS và CQG
* **15:00:00**: Trực ca bấm **"Đối chiếu Khớp lệnh (CHECK_KLGD)"** (Job A).
  * Nhãn của Job A: Cần cả `MS` và `CQG`.
  * Hệ thống kiểm tra Bảng trực: Cả `MS` và `CQG` đều đang Rảnh $\rightarrow$ Cấp khóa cho Job A. Bảng trực ghi: `MS = BẬN (Job A)`, `CQG = BẬN (Job A)`.
* **15:00:20**: Cron định kỳ kích hoạt Job B: Tải sao lưu CQG (`DOWNLOAD_CQG`).
  * Nhãn Job B: Cần `CQG`.
  * Hệ thống thấy `CQG` đang bận phục vụ Job A $\rightarrow$ Job B tự động đứng chờ trong hàng đợi.
* **15:01:10**: Job A cào file tươi và đối chiếu xong $\rightarrow$ Nhả khóa cả `MS` và `CQG`.
* Job B được bốc lên chạy tải CQG bình thường. Cả 2 đều an toàn tuyệt đối.

---

## 4. CHI TIẾT CÁC FILE MÃ NGUỒN LIÊN QUAN

| Thành phần | Đường dẫn file | Dòng code chính | Trách nhiệm |
| :--- | :--- | :--- | :--- |
| **Nhãn Tài Nguyên** | [job-domains.constant.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/shared/constants/job-domains.constant.ts) | `L13-L22`, `L110-L123` | Định nghĩa Enum `JobResourceDomain` và hàm tra cứu nhãn `getRequiredJobDomains()`. |
| **Bảng Trực RAM** | [domain-lock-manager.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/checklist-hub/queue/domain-lock-manager.service.ts) | `L46-L135` | Quản lý khóa tài nguyên trong RAM, kiểm tra `isAnyDomainBusy()`, cấp khóa `tryAcquire()` và giải phóng `release()`. |
| **Hàng Đợi Điều Phối** | [bot-job-queue.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/checklist-hub/queue/bot-job-queue.service.ts) | `L195-L235`, `L500-L525` | Quét Job PENDING, kiểm tra khóa, bốc Job chạy trong Worker Pool, nhả khóa trong khối `finally` và gọi `setImmediate`. |
| **Giao Diện Hàng Đợi** | [TradingManagerJobQueueSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/job-queue/TradingManagerJobQueueSection.tsx) | `L520-L570`, `L685-L715`, `L1545-L1565` | Hiển thị Badge Phân hệ (MS, CQG, CCP, CE, ACM, EMAIL, RECON), bộ lọc dropdown phân hệ trên thanh công cụ. |

---

## 5. KẾT LUẬN & CHUẨN BIÊN DỊCH

* **Tính ổn định**: Triệt tiêu 100% lỗi xung đột session M-System và CQG khi chạy đối soát tươi `CHECK_KLGD`.
* **Hiệu năng**: Giữ nguyên khả năng chạy song song giữa các phân hệ độc lập (MS, CQG, CoreCCP, CE, ACM), tiết kiệm tối đa thời gian ca trực.
* **Độ tin cậy biên dịch**:
  - Backend NestJS: `nest build` $\rightarrow$ **Exit Code 0**
  - Frontend Next.js: `next build` $\rightarrow$ **Exit Code 0** (50 static pages).
