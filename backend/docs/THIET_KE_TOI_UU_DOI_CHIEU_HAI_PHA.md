# TÀI LIỆU THIẾT KẾ KỸ THUẬT CHI TIẾT: KIẾN TRÚC ĐỐI SOÁT GIAO DỊCH HAI PHA
## (TWO-PHASE SYNCHRONIZED RECONCILIATION ARCHITECTURE)
### Phân hệ: Trading Manager & Bot Engine — Mercantile Exchange of Vietnam (MXV)
*Tài liệu kỹ thuật được xây dựng 100% dựa trên dữ liệu thực nghiệm đo đạc trực tiếp từ môi trường máy chủ và log vận hành thực tế.*

---

## I. DỮ LIỆU ĐO ĐẠC THỰC TẾ & NGUYÊN NHÂN GỐC RỄ (EMPIRICAL ROOT CAUSE)

### 1. Dữ liệu Thực Nghiệm Đo Đạc Trực Tiếp trên Máy Chủ Ubuntu (10.0.0.26)
Vào lúc **09:15 ngày 15/09/2026**, hệ thống đã thực hiện bài kiểm thử Stress-Test mở đồng thời **4 trình duyệt Chromium riêng biệt** truy cập 4 cổng đăng nhập thực tế của hệ thống (`msadmin.mxv.com.vn`, `m.cqg.com`, `acm-etp.acmmex.com`, `coreccp.vnclear.vn`).

Kết quả đo đạc trực tiếp từ kernel Linux (`/proc/meminfo` và `ps aux`):
- **Tổng dung lượng RAM vật lý**: **3,868 MB** (~4 GB).
- **RAM khả dụng trước khi mở 4 Chromium**: **2,165 MB** (~2.1 GB trống).
- **Thời gian khởi chạy và tải xong cả 4 trang cùng lúc**: **4.68 giây**.
- **Mức RAM tiêu hao thêm của cả 4 Chromium riêng biệt**: **353 MB** (RAM khả dụng giảm từ 2,165 MB xuống 1,812 MB).
- **Mức chiếm dụng Swap Disk**: **Tăng 0 MB** (không hề bị tràn Swap).
- **Sau 10 giây duy trì tải đồng thời**: RAM khả dụng vẫn còn tới **1,650 MB**.
- **Sau khi đóng 4 Chromium**: Bộ nhớ lập tức được thu hồi sạch sẽ, RAM khả dụng trở về **2,108 MB**.

> **KẾT LUẬN THỰC NGHIỆM**: 
> Máy chủ Ubuntu 4GB RAM **hoàn toàn có đủ năng lực phần cứng để chạy 4 trình duyệt Chromium riêng biệt đồng thời** mà không gây tràn RAM hay gián đoạn các dịch vụ khác (`mongodb`, `mxv-frontend`, `mock-sftp`). Mức tiêu thụ tối đa của 4 Chromium chỉ dao động từ **350 MB – 500 MB**, máy chủ luôn còn dư hơn **1.6 GB RAM khả dụng**.

---

### 2. Dữ liệu Thực Tế về Thời Gian Thực Thi Từng Nguồn (Trích từ Bot Job Log 15/09/2026)

| Nguồn Dữ Liệu | Bước Chiếm Nhiều Thời Gian Nhất | Thời Gian Thực Tế | Đặc Tính Kỹ Thuật |
| :--- | :--- | :---: | :--- |
| **CQG** | Chuyển đổi 2 tài khoản, đợi render giao diện Angular, tải 6 file (`FR1, PS1, OP1, FR2, PS2, OP2`) | **120s – 180s** | Nguồn tốn thời gian lâu nhất. Dùng `launchPersistentContext` để giữ cache bundle. |
| **ACM** | Điều hướng login, chụp ảnh Captcha gửi Gemini API nhận diện (hỗ trợ retry khi 429 hoặc sai mã) | **45s – 80s** | **Thời gian bấm nút Export chỉ mất 7 – 10 giây**. Toàn bộ thời gian chờ là ở khâu Login. |
| **M-System** | Vượt bàn phím PIN ảo, tải 3 file (`DSGD.xlsx`, `TTM.xlsx`, `TTTT.xlsx`) | **25s – 35s** | Mạng nội bộ tốc độ cao, tải nhanh và ổn định. |
| **CoreCCP** | Đăng nhập tài khoản, lọc ngày và xuất 3 file (`DSGD.csv`, `TTTT.csv`, `TTM.csv`) | **25s – 30s** | Không có Captcha, thời gian xuất file sau khi login chỉ mất ~10 giây. |

---

### 3. Nguyên Nhân Gốc Rễ Sinh Ra 10 Lot Lệch Giả trong Thực Tế

Trong lượt chạy tuần tự `01:16:46 UTC` ngày 15/09/2026:
- **01:16:59**: M-System tải xong file `DSGD.xlsx` $\rightarrow$ Ghi nhận khớp lệnh tự doanh: **160 lot**.
- **01:17:26**: Bắt đầu tải CQG $\rightarrow$ Tải 2 tài khoản kéo dài tới **01:20:45** (hơn 3 phút).
- **01:20:48**: Bắt đầu tải ACM $\rightarrow$ Giải Captcha và xuất file `Fill.xlsx` lúc **01:21:26** $\rightarrow$ Ghi nhận: **170 lot**.

👉 **Khoảng cách trễ giữa thời điểm chụp snapshot của M-System và ACM là 4 phút 27 giây!**
Trong 4.5 phút trễ này, sàn nước ngoài đã khớp thêm đúng 6 lệnh:
- `TK 003C3176868-A`: 3 lot + 3 lot = 6 lot
- `TK 085C5474810-A`: 1 lot
- `TK 003C6361486-A`: 1 lot
- `TK 001C6939898-A`: 1 lot
- `TK 046C0002750-A`: 1 lot
$\Rightarrow$ **Tổng cộng đúng bằng 10 lot!**

File ACM tải lúc phút thứ 4.5 có 10 lot này, nhưng file M-System tải từ phút 0 chưa thể có $\rightarrow$ **100% sinh ra LỆCH GIẢ (False Positive)**.

---

## II. THIẾT KẾ KIẾN TRÚC HAI PHA (TWO-PHASE COMMIT PATTERN)

Dựa trên kết quả đo đạc thực nghiệm rằng **máy chủ hoàn toàn chạy tốt 4 Chromium riêng biệt**, kiến trúc tối ưu sẽ triển khai theo mô hình **4 Trình Duyệt Độc Lập (Isolated Instances) kết hợp Điều Phối Hai Pha (Two-Phase Orchestration)**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PHA 1: PRE-FLIGHT READINESS GATE                                │
│                   (4 Chromium Mở Riêng Biệt & Đăng Nhập Đón Đầu)                       │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┬────────────────────┐
    ▼                               ▼                               ▼                    ▼
[Chromium 1: CQG]           [Chromium 2: ACM]              [Chromium 3: CCP]     [Chromium 4: MS]
(Khởi chạy ngay T0)         (Khởi chạy ngay T0)            (Khởi chạy ngay T0)   (Khởi chạy T0 + 60s)
- Mở profile cache          - Login ACM & giải Captcha     - Login CoreCCP       - Login M-System
- Tải trước TK 1 (FR1/PS1)  - Điều hướng tới trang Fill    - Đứng chờ trang DSGD - Đứng chờ trang DSGD
- Đang tải TK 2             - ĐỨNG CHỜ (Standby)           - ĐỨNG CHỜ (Standby)  - ĐỨNG CHỜ (Standby)
    │                               │                               │                    │
    └───────────────────────────────┼───────────────────────────────┴────────────────────┘
                                    │
                                    ▼
                    { KIỂM TRA ĐỘ SẴN SÀNG (READINESS GATE) }
                                    │
                     ├── [CÓ NGUỒN CHÍNH LỖI] ──► 🛑 DỪNG NGAY (Fail-Fast tại giây 25-30)
                     │                            Báo lỗi đích danh, không chạy tiếp dữ liệu rác.
                     └── [TẤT CẢ SẴN SÀNG]
                                    │
┌───────────────────────────────────▼────────────────────────────────────────────────────┐
│                    PHA 2: SYNCHRONIZED BULK EXPORT BARRIER                             │
│                  (Đồng Loạt Kích Hoạt Nút Tải Trong 3-5 Giây)                          │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┬────────────────────┐
    ▼                               ▼                               ▼                    ▼
Click Export CQG            Click Export ACM               Click Export CCP      Click Export MS
(FR2, PS2, OP2)             (Fill.xlsx)                    (DSGD, TTM, TTTT)     (DSGD, TTM, TTTT)
    │                               │                               │                    │
    └───────────────────────────────┼───────────────────────────────┴────────────────────┘
                                    │
                                    ▼
            CẢ 4 NGUỒN CÙNG XUẤT FILE TẠI MỐC THỜI GIAN TRÙNG KHÍT
                          (Độ chênh lệch mtime < 5 giây)
                                    │
                                    ▼
              ĐÓNG NGAY 4 CHROMIUM ĐỂ THU HỒI 350MB - 500MB RAM
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             BỘ LỌC BẢO HIỂM KÉP: SNAPSHOT CUTOFF TIMESTAMP FILTER                      │
│        Loại bỏ các lệnh sàn nước ngoài phát sinh sau thời điểm chốt của M-System       │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
                                    ▼
                  HÀM ĐỐI CHIẾU CHUẨN XÁC: checkKLGD()
```

---

## III. ĐẶC TẢ CHI TIẾT TỪNG PHA XỬ LÝ

### 1. Pha 1: Pre-Flight Readiness Gate (Xác Thực & Mở Trang Đón Đầu)

#### A. Khởi tạo Đồng thời 4 Chromium Riêng Biệt:
- **Cấu hình launch an toàn cho mỗi tiến trình**:
  ```javascript
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-gpu',
      '--js-flags="--max-old-space-size=256"', // Chặn Chromium phình to bộ nhớ
      '--window-size=1280,800',
    ],
  };
  ```

#### B. Trình tự công việc trong Pha 1:
1. **CQG Worker (Bắt đầu tại $T_0$)**:
   - Sử dụng `launchPersistentContext` với thư mục `temp/cqg_profile_2` để tận dụng 100% cache Angular.
   - Đăng nhập và bắt đầu tải các file của Tài khoản 1 (`FR1, PS1, OP1`).
2. **ACM Worker (Bắt đầu tại $T_0$)**:
   - Khởi chạy Chromium riêng.
   - Truy cập trang Login, cắt ảnh Captcha gửi Gemini API nhận diện (hỗ trợ chuyển model dự phòng nếu gặp lỗi 429).
   - Đăng nhập thành công, điều hướng thẳng tới URL: `#/business-tetptrade`.
   - **Đứng chờ (Standby)**: Giữ trang ở trạng thái sẵn sàng click nút `.el-button:has-text("Export")`.
3. **CoreCCP Worker (Bắt đầu tại $T_0$)**:
   - Khởi chạy Chromium riêng.
   - Đăng nhập `coreccp.vnclear.vn`, điều hướng sẵn tới trang `/ORDERS/ORDERMATCH_ALL`.
   - **Đứng chờ (Standby)**: Giữ trang ở trạng thái sẵn sàng click xuất file.
4. **M-System Worker (Bắt đầu tại $T_0 + 60s$ hoặc khi CQG sắp xong)**:
   - Khởi chạy Chromium riêng.
   - Đăng nhập M-System (vượt bàn phím số ảo), mở sẵn tab báo cáo `DSGD`.

#### C. Logic Đánh giá Cổng Sẵn Sàng (Readiness Gate Logic):
```typescript
interface ReadinessReport {
  isCriticalReady: boolean; // Bắt buộc: MS và CQG phải OK
  msReady: boolean;
  cqgReady: boolean;
  acmReady: boolean;
  ccpReady: boolean;
  failureReasons: string[];
}
```
- **Quy tắc Fail-Fast (Dừng sớm tại giây 25–30)**:
  - Nếu `msReady === false` (M-System sập/đổi mật khẩu) HOẶC `cqgReady === false` (CQG khóa tài khoản/sai pass):
    $\rightarrow$ **HỦY TOÀN BỘ JOB NGAY LẬP TỨC**. 
    Đóng toàn bộ browser, ghi log lỗi đích danh vào checklist. Tuyệt đối không để bot chạy tiếp rồi đối chiếu dữ liệu rác.
  - Nếu `acmReady === false` (Sàn quốc tế bảo trì hoặc giải Captcha quá 4 lần thất bại):
    $\rightarrow$ **Chuyển sang chế độ Chạy Suy Biến (Graceful Degradation)**: Tiếp tục đối chiếu cặp chính (MS vs CQG), tạm hoãn cặp tự doanh ACM và đánh dấu trạng thái rõ ràng, **tuyệt đối không báo đỏ lệch giả**.

---

### 2. Pha 2: Synchronized Bulk Export Barrier (Bấm Tải Đồng Loạt Trong 3 Giây)

Khi CQG hoàn tất tải xong Tài khoản 1 và chuẩn bị tải xong Tài khoản 2:
1. **Phát tín hiệu Barrier Event**:
   ```typescript
   await Promise.allSettled([
     rpaService.triggerClickExportMs(msPage),
     rpaService.triggerClickExportCqg(cqgPage),
     rpaService.triggerClickExportAcm(acmPage),
     rpaService.triggerClickExportCcp(ccpPage),
   ]);
   ```
2. **Thời gian ghi nhận file thực tế**:
   - Cả 4 file (`DSGD.xlsx`, `FR.xlsx`, `Fill.xlsx`, `DSGD.csv`) được ghi xuống ổ đĩa `/mnt/qlgd-it/...` với khoảng cách thời gian giữa các file: **$\Delta t \le 3 - 5$ giây**.
3. **Thu hồi tài nguyên ngay lập tức**:
   - Đóng toàn bộ 4 tiến trình Chromium qua `await Promise.all(browsers.map(b => b.close()))`.
   - Thu hồi toàn bộ 353 MB RAM về lại cho hệ điều hành trước khi gọi hàm tính toán đối chiếu Excel.

---

### 3. Lớp Bảo Hiểm Kép: Snapshot Cutoff Timestamp Filter

Để triệt tiêu 100% rủi ro sàn nước ngoài khớp lệnh trong vài giây chênh lệch nhỏ còn lại:
- Xác định mốc thời gian chốt sổ của hệ thống lõi:
  $$T_{cutoff} = \text{mtime}(DSGD.xlsx)$$
- Trong hàm `reconciliation.service.ts::checkKLGD`:
  - Đọc trường `tradeTime` của từng dòng lệnh trong file ACM (`Fill.xlsx`).
  - Nếu $\text{tradeTime} > T_{cutoff}$: Lệnh này được phân loại vào mảng `pendingSyncTrades` (Lệnh mới phát sinh sau thời điểm chốt của M-System, chờ ca sau).
  - Không đưa các lệnh này vào danh sách `mismatchedTrades` (Lệnh lệch).

---

## IV. QUẢN LÝ TIẾN TRÌNH & CHỐNG RÒ RỈ RAM TRÊN UBUNTU

Để máy chủ Linux vận hành trơn tru dài hạn mà không phát sinh tiến trình rác:

1. **Bộ Dọn Dẹp Tiến Trình Mồ Côi (Zombie Cleanup Routine)**:
   - Trước khi bắt đầu một Job đối soát mới, hệ thống tự động kiểm tra và giải phóng các tiến trình Chromium renderer bị treo từ các job cũ (như tiến trình 777MB phát hiện ở bài kiểm thử):
     ```bash
     pkill -f "chrome-headless-shell.*--user-data-dir=.*test" || true
     ```
2. **Cơ chế Keep-Alive trong thời gian Standby**:
   - Trong thời gian ACM hoặc CCP đứng chờ (khoảng 30–60 giây), gửi heartbeat nhẹ:
     ```javascript
     setInterval(async () => {
       if (page && !page.isClosed()) {
         await page.evaluate(() => 1).catch(() => {});
       }
     }, 20000);
     ```

---

## V. CƠ CHẾ NGHIỆP VỤ CHUYỂN ĐỔI (ACM + CORECCP = NANO) & GIAO DIỆN BÀN GIÁM SÁT

### 1. Bản Chất Nghiệp Vụ Chuyển Đổi Hệ Thống tại MXV
Trong giai đoạn chuyển đổi (Migration) các sản phẩm giao dịch Nano tự doanh giữa sàn đối tác nước ngoài (ACM) và hệ thống Bù trừ Trung tâm trong nước (CoreCCP - VNCLEAR), hệ thống ghi nhận mối quan hệ đối soát khối lượng giao dịch (KLGD) thực tế như sau:

- **Trường hợp 1 (Sản phẩm chưa chuyển đổi hoặc ngày chưa có KLGD trên CCP)**:
  - Toàn bộ giao dịch Nano được thực hiện qua sàn ACM:
    $$\mathbf{ACM = Nano} \quad \text{và} \quad \mathbf{CoreCCP = 0}$$
- **Trường hợp 2 (Giai đoạn chuyển đổi, xuất hiện giao dịch phân bổ trên cả CCP)**:
  - Khối lượng Nano ghi nhận lớn hơn ACM ($\text{Nano} > \text{ACM}$), khi đó tổng khối lượng giao dịch tự doanh sẽ cân bằng chính xác theo công thức:
    $$\mathbf{ACM + CoreCCP = Nano}$$

### 2. Yếu Tố Quyết Định Tính Cân Bằng: Tải Đa Luồng Đồng Thời Gian
Như thực tế vận hành ca trực đã chứng minh, để công thức trên luôn luôn khớp và cân nhau, **điều kiện tiên quyết là phải tải đa luồng đồng thời gian giữa cả 4 nguồn (M-System, CQG, ACM, CoreCCP)**. 
- Khi độ lệch thời gian snapshot được co ngắn tối đa ($\Delta t \le 3 - 5$ giây), các giao dịch vừa khớp trên các sàn sẽ được gom chụp cùng lúc, tự khắc đưa số liệu 4 bên về trạng thái cân bằng tuyệt đối!

### 3. Cấu Trúc Bảng Ma Trận Đối Soát (Table 1 - Trading Manager)

| Cột | Tên Cột | Nguồn File Dữ Liệu | Bản Chất Nghiệp Vụ Đối Soát |
| :---: | :--- | :--- | :--- |
| **Cột 2** | **`M-System`** | `DSGD.xlsx` (MS) | Khối lượng tài khoản thường (Non-A) trên M-System |
| **Cột 3** | **`CQG`** | `FR.xlsx` (CQG 1 & 2) | Khối lượng khớp lệnh hợp đồng thường trên CQG |
| **Cột 4** | **`ACM`** | `Fill.xlsx` / `Straits.csv` | Khối lượng khớp lệnh thực tế từ sàn đối tác ACM (Straits) |
| **Cột 5** | **`Nano`** | `DSGD.xlsx` (đuôi `-A`) | Khối lượng tự doanh Nano ghi nhận trên hệ thống M-System |
| **Cột 6** | **`CoreCCP`** | `DSGD.csv` (VNCLEAR) | Khối lượng bù trừ thanh toán từ hệ thống CoreCCP |

- **Quy tắc kiểm soát đối chiếu**:
  - **Cặp Thường**: So khớp `M-System` vs `CQG` (khớp $100\% \rightarrow$ Xanh lá).
  - **Cặp Tự doanh Chuyển đổi**: Kiểm tra sự cân bằng giữa `ACM + CoreCCP` với `Nano`. Khớp hoàn toàn $\rightarrow$ Xanh lá.

---

## VI. KẾ HOẠCH TRIỂN KHAI MÃ NGUỒN (ACTION ITEMS)

| STT | File Cần Thay Đổi | Nội Dung Sửa Đổi Cụ Thể |
| :---: | :--- | :--- |
| **1** | [recon-jobs.handler.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts) | Thay thế luồng 4 lệnh `await` tuần tự cũ bằng 2 Pha: `preparePreFlightSessions()` và `executeSynchronizedBulkExport()`. |
| **2** | [rpa-downloader.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/rpa-downloader.service.ts) | Bổ sung phương thức `standbyAtExport()` và `triggerFastExport()` cho ACM và M-System. |
| **3** | [reconciliation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/reconciliation.service.ts) | Thêm bộ lọc `cutoffTimestamp` theo mtime của `DSGD.xlsx` trong hàm `checkKLGD()`. |
| **4** | [trading-manager/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/page.tsx) | Cập nhật nhãn tiêu đề 5 cột chuẩn: `M-System`, `CQG`, `ACM`, `Nano`, `CoreCCP` và logic so khớp chuyển đổi `ACM + CoreCCP = Nano`. |

---

## VII. TIÊU CHUẨN NGHIỆM THU (ACCEPTANCE CRITERIA)

1. **Tổng thời gian chạy**: Giảm từ **4.5 – 5.5 phút** xuống còn **$\le 1.5 – 2.0$ phút**.
2. **Độ lệch thời gian snapshot**: Khoảng cách mtime giữa `DSGD.xlsx` và `Fill.xlsx` / `FR.xlsx` **$\le 5$ giây**.
3. **Tính chính xác**: Triệt tiêu hoàn toàn con số 10 lot lệch giả giữa M-System và ACM.
4. **An toàn tài nguyên**: Mức tiêu thụ RAM tối đa của 4 Chromium không vượt quá **500 MB**, giải phóng 100% RAM sau khi tải xong.
5. **Kiểm thử nghiệm thu**: Frontend và Backend biên dịch sạch sẽ (`npx tsc --noEmit` và `npm run build` exit code 0).
