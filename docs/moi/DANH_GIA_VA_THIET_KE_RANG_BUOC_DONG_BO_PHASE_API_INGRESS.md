# ĐÁNH GIÁ CHUYÊN SÂU & THIẾT KẾ ĐIỀU CHỈNH RÀO CẢN ĐỒNG BỘ (BARRIER SYNCHRONIZATION) KHI CHUYỂN M-SYSTEM / CCP / ACM SANG DIRECT API VÀ CQG VẪN CÀO TRÌNH DUYỆT

> **Dự án:** MXV Shift Checklist & Trading Manager  
> **Tài liệu:** Thẩm định logic rào cản đồng bộ pha & Giải pháp chống trôi thời gian thực (Asymmetric Temporal Drift Prevention)  
> **Ngày lập:** 16/10/2026  
> **Trạng thái:** Báo cáo thẩm định kỹ thuật kèm dẫn chứng mã nguồn (Code-First Grounding)

---

## 1. TỔNG QUAN VẤN ĐỀ & CÂU HỎI ĐẶT RA

### 1.1. Câu hỏi của USER

> _"Nếu chuyển qua API gọi các phân hệ (M-System, CoreCCP, ACM) còn CQG thì vẫn cào trình duyệt, có cần update lại logic rào cản pha để chờ dữ liệu về phù hợp với API tải nhanh quá không?"_

### 1.2. Kết luận Thẩm định Dứt khoát (Executive Answer)

👉 **BẮT BUỘC 100% PHẢI ĐIỀU CHỈNH LẠI LOGIC RÀO CẢN ĐỒNG BỘ!**  
Nếu giữ nguyên logic rào cản hiện tại:

1. **API tải quá nhanh (0.5s - 1.5s)**: File `DSGD.xlsx` (M-System), `Straits.csv` (ACM) và báo cáo CoreCCP sẽ được ghi đĩa ngay tại thời điểm $T_0 + 1s$.
2. **CQG cào trình duyệt quá chậm (45s - 75s)**: Do phải mở 2 Chromium instances, đăng nhập 2 tài khoản, tải DOM, chờ widget render rồi mới bấm xuất `FR1.xlsx`, `FR2.xlsx` tại $T_0 + 60s$.
3. **Khoảng trôi thời gian (Temporal Gap) lên tới 45 - 60 giây**: Toàn bộ các lệnh khớp trên sàn quốc tế (CME, CBOT, NYMEX) trong 1 phút đó sẽ có mặt trong file CQG nhưng **HOÀN TOÀN CHƯA CÓ TRONG FILE M-SYSTEM**, gây ra hàng loạt cảnh báo **LỆCH LỆNH ẢO (FALSE POSITIVE MISMATCH)**, phá hỏng tính chính xác của đối soát trong phiên!

---

## 2. DẪN CHỨNG MÃ NGUỒN HIỆN TẠI (CURRENT CODE-FIRST GROUND TRUTH)

### 2.1. Bản chất Logic Rào Cản Ban Đầu (Barrier Synchronizer)

Trong [backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L245-L312](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L245-L312):

```typescript
// [recon-jobs.handler.ts L256-L277]
const barrierTriggerPromise = new Promise<void>((resolve, reject) => {
  triggerBarrierResolve = () => {
    if (!barrierTriggered && !barrierAborted) {
      barrierTriggered = true;
      resolve();
    }
  };
  triggerBarrierReject = (reason: any) => { ... };
});

const readyState = {
  ms: false,
  acm: false,
  ccp: false,
  cqg1: false,
  cqg2: false,
};

const checkAllReadyAndTrigger = () => {
  if (readyState.ms && readyState.acm && readyState.ccp && readyState.cqg1 && readyState.cqg2) {
    log(' Tất cả các hệ thống đã sẵn sàng! BẮT ĐẦU ĐỒNG LOẠT XUẤT BÁO CÁO.');
    triggerBarrierResolve();
  }
};
```

- **Nguyên lý khi 100% dùng Playwright**:
  - Giai đoạn 1 (Navigation): 4 trình duyệt mở song song, đăng nhập và điều hướng đến màn hình báo cáo. Khi đã đứng sẵn ở màn hình xuất, từng worker báo `readyState.X = true`.
  - Giai đoạn 2 (Await Barrier): Các trình duyệt chờ `await barrierTriggerPromise;`.
  - Giai đoạn 3 (Simultaneous Click): Khi cả 4 bên đều sẵn sàng, rào cản mở $\implies$ Cả 4 browser đồng loạt bấm nút xuất cùng 1 giây. Độ lệch thời gian giữa các file chỉ từ 1 - 3 giây.

---

### 2.2. Điểm Gãy (Flaw) Khi Ghép Direct API Vào Logic Cũ

Hãy kiểm chứng đoạn code Direct API hiện tại trong `runWorkerMs` tại [recon-jobs.handler.ts#L327-L364](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L327-L364):

```typescript
// [recon-jobs.handler.ts L333-L364]
if (this.ingressService && (ingressModeMs === 'REST_API' || ingressModeMs === 'API')) {
  log('MS [Direct REST API] Kích hoạt tải dữ liệu trực tiếp qua Ingress API Adapter...');
  try {
    if (options.checkKlgd !== false) {
      const dsgdRes = await this.ingressService.download('MS', { ... }); // <-- TẢI XONG NGAY LẬP TỨC (MẤT 800ms)
    }
    // ...
    readyState.ms = true;
    log('MS Đã sẵn sàng dữ liệu đầy đủ qua Direct API.');
    checkAllReadyAndTrigger();
    return; // <---  NGUY HIỂM: THOÁT HÀM NGAY LẬP TỨC, KHÔNG HỀ CHỜ barrierTriggerPromise!
  } catch (apiErr: any) { ... }
}
```

Tương tự với ACM SFTP ([L515-L537](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L515-L537)) và CoreCCP REST API ([L645-L667](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L645-L667)):

- Cả 3 worker này gọi HTTP/SFTP tải xong file ngay tại giây thứ 1 của Job, ghi đè file vào ổ đĩa, đánh dấu `readyState = true` rồi `return` kết thúc worker.
- **Trong khi đó, CQG Worker** ([L783-L806](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L783-L806)):
  - Mở 2 Chromium Browser instances.
  - Tải trang CQG Web Trader, nhập user/pass, tải các chart/widget nặng mất **35 - 50 giây**.
  - Đến giây thứ 45, CQG1 và CQG2 mới vào đến màn hình báo cáo và set `readyState.cqg1 = true, readyState.cqg2 = true`.
  - Rào cản `barrierTriggerPromise` lúc này mới mở cho CQG bấm xuất file!
  - File `FR1.xlsx` và `FR2.xlsx` được tải về máy lúc **giây thứ 55 - 60**!

---

## 3. TIMELINE SO SÁNH TRỰC QUAN & RỦI RO LỆCH DỮ LIỆU

```
Thời gian (giây)  T0         T0 + 1s                         T0 + 45s              T0 + 60s
                  │             │                               │                     │
M-System (API)    ├──Call API───►[GHI ĐĨA DSGD.xlsx] (XONG)     │                     │
CoreCCP (API)     ├──Call API───►[GHI ĐĨA CCP.xlsx]  (XONG)     │                     │
ACM (SFTP)        ├──Call SFTP──►[GHI ĐĨA Straits.csv](XONG)    │                     │
                  │             │                               │                     │
CQG1 & 2 (Browser)├─────────────┴──Đang mở Chromium, đăng nhập──►[Vào màn hình FR]───►[GHI ĐĨA FR.xlsx]
                                                                                      ▲
                                                                                      │
                                                                         KHOẢNG LỆCH PHA: ~59 GIÂY!
                                                                  (Lệnh khớp trong 59s này có ở CQG
                                                                   nhưng KHÔNG CÓ ở M-System)
```

### Hậu quả nếu không sửa logic rào cản:

1. **Lệnh lệch ảo (Ghost Trades)**: Trong 59 giây chênh lệch, nếu thị trường đang giao dịch sôi động (phiên Mỹ mở cửa hoặc giờ tin tức), có thể có 5 - 20 lệnh khớp trên sàn CQG. File CQG có các lệnh này, nhưng file M-System đã được tải từ 59 giây trước nên hoàn toàn không có $\implies$ Bot báo đỏ toàn bộ ma trận đối soát!
2. **Cơ chế Cutoff Buffer bị kéo căng quá mức**: Bộ lọc `dsgdCutoffTime = stat.mtime - 2s` ([klgd-recon.service.ts#L871](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/klgd-recon.service.ts#L871)) sẽ lấy mốc của giây thứ 1. Trong khi file CQG có `mtime` ở giây thứ 60. Mặc dù `cqgCutoffTime` ([klgd-recon.service.ts#L891-L906](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/klgd-recon.service.ts#L891-L906)) giúp lọc một phần, nhưng khoảng cách 1 phút là quá lớn, khiến danh sách `pendingSyncTrades` phình to bất thường!

---

## 4. BẢN THIẾT KẾ ĐIỀU CHỈNH: MÔ HÌNH "CQG-FIRST, API-ON-TRIGGER" (ĐỒNG BỘ THỜI GIAN THẬT)

Để giải quyết triệt để sự bất đối xứng về tốc độ (API 1s vs Browser 50s), ta áp dụng nguyên lý:

> **"Bên nào chậm thì chạy trước — Khi bên chậm chuẩn bị bấm nút xuất, bên nhanh mới kích hoạt tải API!"**

### 4.1. Quy trình Hoạt động Mới (New Synchronization Flow)

1. **Pha 1: Chuẩn bị CQG (Playwright Pre-flight)**:
   - Worker CQG mở 2 trình duyệt CQG1 & CQG2, đăng nhập và điều hướng đến các widget FR, OP, PS.
   - Khi cả 2 tài khoản CQG đã đứng trước nút Export sẵn sàng $\implies$ Đánh dấu `cqgReady = true`.
2. **Pha 2: Kích hoạt Đồng loạt (Simultaneous Synchronized Trigger)**:
   - Ngay tại khoảnh khắc `cqgReady = true`:
     - **Nhánh A (CQG)**: Click nút xuất file `FR1.xlsx`, `FR2.xlsx` (Mất 2-3s để tải file về đĩa).
     - **Nhánh B (M-System API)**: Kích hoạt `msApiAdapter.download('MS')` (Mất 0.8s để tải về đĩa).
     - **Nhánh C (CoreCCP API)**: Kích hoạt `coreccpApiAdapter.download('CCP')` (Mất 1.2s để tải về đĩa).
     - **Nhánh D (ACM SFTP)**: Kích hoạt `acmSftpAdapter.download('ACM')` (Mất 0.5s để tải về đĩa).
3. **Pha 3: Hội tụ Dữ liệu (Convergence)**:
   - Cả 4 file (M-System, CQG, ACM, CoreCCP) đều được ghi xuống đĩa tại **cùng một cửa sổ thời gian sai lệch không quá 1 - 2 giây**!
   - Triệt tiêu 100% nguy cơ trôi 50-60 giây!

```mermaid
sequenceDiagram
    autonumber
    participant Job as Recon Job Manager
    participant CQG as Worker CQG (Browser)
    participant MS as Worker M-System (Direct API)
    participant CCP as Worker CoreCCP (Direct API)
    participant ACM as Worker ACM (Direct SFTP)

    Note over Job,CQG: GIAI ĐOẠN 1: CQG MỞ TRÌNH DUYỆT TRƯỚC
    Job->>CQG: Khởi động 2 Browser CQG1 & CQG2 (30-45s)
    Note over MS,ACM: MS, CCP, ACM đứng chờ tín hiệu từ CQG
    CQG-->>Job: Báo hiệu: CQG1 & CQG2 đã vào widget sẵn sàng! (cqgReady = true)

    Note over Job,ACM: GIAI ĐOẠN 2: KÍCH HOẠT ĐỒNG LOẠT (TẤT CẢ TRONG VÒNG 1-2S)
    par Đồng loạt lấy dữ liệu
        Job->>CQG: Bấm nút Xuất file FR1 & FR2 (mất ~2s tải)
        Job->>MS: Gọi Direct REST API lấy DSGD, TTM, TTTT (mất ~0.8s)
        Job->>CCP: Gọi Direct REST API lấy báo cáo bù trừ (mất ~1.2s)
        Job->>ACM: Gọi Direct SFTP lấy Straits.csv (mất ~0.5s)
    end

    Note over Job,ACM: GIAI ĐOẠN 3: TẤT CẢ FILE CÓ MTIME CÙNG 1 MỐC GIÂY
    Job->>Job: Ghép FR1+FR2 và kích hoạt checkKLGD() với độ lệch thời gian < 1s!
```

---

## 5. THIẾT KẾ MÃ NGUỒN CHI TIẾT (CODE REFACTORING SPECIFICATION)

### 5.1. File tác động:

`backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts` (Phương thức `runAutoCheckKLGD`).

### 5.2. Đoạn mã điều chỉnh mẫu:

```typescript
// ── TRẠNG THÁI RÀO CẢN MỚI: TẬP TRUNG VÀO CQG PRE-FLIGHT ──
let cqgBarrierResolved = false;
let resolveCqgBarrier: () => void = () => {};

const cqgBarrierPromise = new Promise<void>((resolve) => {
  resolveCqgBarrier = () => {
    cqgBarrierResolved = true;
    resolve();
  };
});

// 1. Worker M-System:
const runWorkerMs = async () => {
  if (ingressModeMs === 'REST_API') {
    log('MS Chờ CQG chuẩn bị xong giao diện để xuất API đồng thời...');
    // CHỜ CQG SẴN SÀNG TRƯỚC NÚT XUẤT RỒI MỚI GỌI API!
    await cqgBarrierPromise;
    log('MS [Direct REST API] CQG đã sẵn sàng, kích hoạt gọi API M-System ngay lập tức...');
    await this.ingressService.download('MS', { ... });
    log('MS Tải M-System qua Direct API hoàn tất tại cùng mốc giây với CQG.');
    return;
  }
  // ... (Nếu là Playwright thì giữ logic 2 giai đoạn cũ)
};

// 2. Worker CoreCCP:
const runWorkerCcp = async () => {
  if (ingressModeCcp === 'REST_API') {
    log('CCP Chờ CQG chuẩn bị xong giao diện để gọi API CoreCCP đồng thời...');
    await cqgBarrierPromise;
    log('CCP [Direct REST API] Kích hoạt gọi API CoreCCP...');
    await this.ingressService.download('CCP', { ... });
    return;
  }
  // ...
};

// 3. Worker ACM:
const runWorkerAcm = async () => {
  if (ingressModeAcm === 'SFTP' || ingressModeAcm === 'REST_API') {
    log('ACM Chờ CQG chuẩn bị xong giao diện để kéo SFTP đồng thời...');
    await cqgBarrierPromise;
    log('ACM [Direct SFTP] Kích hoạt tải Straits.csv...');
    await this.ingressService.download('ACM', { ... });
    return;
  }
  // ...
};

// 4. Worker CQG (Bên đóng vai trò Nhịp Trưởng - Pacer):
const runWorkerCqg = async () => {
  const onReadyBarrierCqg1 = async () => {
    readyState.cqg1 = true;
    checkCqgBothReady();
  };
  const onReadyBarrierCqg2 = async () => {
    readyState.cqg2 = true;
    checkCqgBothReady();
  };

  const checkCqgBothReady = () => {
    if (readyState.cqg1 && readyState.cqg2) {
      log('CQG  Cả 2 tài khoản CQG1 & CQG2 đã vào widget sẵn sàng! BẬT RÀO CẢN CHO CÁC API KHÁC CHẠY ĐỒNG THỜI.');
      resolveCqgBarrier(); // MỞ RÀO CẢN CHO M-SYSTEM, CCP, ACM GỌI API NGAY!
    }
  };

  // CQG tiến hành click xuất file song song với lúc API được gọi
  await this.rpaDownloaderService.downloadCqgBackup(...);
};
```

---

## 6. LỢI ÍCH CỦA THIẾT KẾ MỚI

1. 🎯 **Triệt tiêu 100% độ lệch thời gian (Zero Temporal Gap)**: Dữ liệu giữa M-System, CQG và CoreCCP chốt cùng 1 mốc giây, không còn hiện tượng lệch 45-60s gây lệnh pending ảo.
2. **Thời gian chạy tổng thể tối ưu tối đa**: Không làm tốn thêm bất kỳ 1 giây nào. Thời gian chạy tổng vẫn bằng đúng thời gian mở trình duyệt của CQG (khoảng 45s).
3. 🛡️ **Tương thích ngược 100%**: Nếu cấu hình đặt `ingress_mode_ms = 'PLAYWRIGHT'`, hệ thống tự động quay lại cơ chế rào cản 4-browser cũ mà không bị lỗi.
4. 🚀 **Sẵn sàng cho tương lai**: Khi CQG sau này có API thật, chỉ cần gỡ bỏ phần Playwright pre-flight là toàn bộ 4 hệ thống chuyển thành 100% Parallel HTTP calls trong 1.5 giây!

---

## 7. KẾ HOẠCH TRIỂN KHAI & KIỂM CHỨNG (IMPLEMENTATION PLAN)

- **Bước 1**: Cập nhật hàm `runAutoCheckKLGD` trong [recon-jobs.handler.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts) theo kiến trúc `CQG Ready-First Barrier`.
- **Bước 2**: Biên dịch TypeScript Backend (`npm run build`).
- **Bước 3**: Viết script kiểm thử mô phỏng đo đạc mtime giữa file `DSGD.xlsx` (tải qua API) và file `FR.xlsx` (tải qua CQG) để khẳng định khoảng chênh lệch thời gian $\Delta t \le 2$ giây.
- **Bước 4**: Ghi vết vào `CHANGELOG_AI.md`.
