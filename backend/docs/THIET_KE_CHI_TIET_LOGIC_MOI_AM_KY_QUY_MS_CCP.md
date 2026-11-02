# ĐẶC TẢ KỸ THUẬT CHI TIẾT: HỢP NHẤT CƠ CHẾ ĐỐI SOÁT & QUẢN LÝ TÀI KHOẢN ÂM KÝ QUỸ (M-SYSTEM & CORECCP)

Tài liệu này đóng vai trò là **Bản Đặc Tả Kỹ Thuật (Technical Specification & Implementation Blueprint)** cho việc triển khai logic mới theo chỉ đạo của USER:
> *"mình có thêm cái DS này, máy tự thêm sau mỗi phiên có TK âm mới. Nếu đã có sẵn / đã nạp tiền thì thôi"*
> *"và đặc biệt sẽ có thêm nút chi tiết ở danh sách TKGD âm KQ của cả CCP và MS để có thể show modal thành bảng chi tiết các TKGD ÂM KQ này (với các tham số cột cần thiết) còn bên ngoài vẫn hiển thị như cấu hình bình thường"*

---

## 1. Mục Tiêu & Nguyên Tắc Cốt Lõi (Core Principles)

1. **Đồng nhất 100% cơ chế vận hành**:
   - Cả phân hệ M-System (MS) và CoreCCP (CCP) đều có **Bảng danh sách tài khoản âm ký quỹ độc lập** được lưu trữ trong CSDL `system_settings`.
   - **Xóa bỏ triệt để sự phụ thuộc vào file EOD ngày T-2 của CoreCCP** ([`ccp-eod.service.ts#L518-L593`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/services/recon/ccp-eod.service.ts#L518-L593)).
2. **Nguyên tắc "3 Thôi" trong vận hành tự động (Zero-Intervention Workflow)**:
   - **Phát hiện TK âm MỚI trong phiên**: Máy **tự động thêm** vào CSDL và phát cảnh báo (`status: 'WARNING'`).
   - **Nếu ĐÃ CÓ SẴN trong CSDL**: Máy coi là âm cũ đang theo dõi $\rightarrow$ **Thôi** không cảnh báo lặp lại, không thêm trùng.
   - **Nếu ĐÃ NẠP TIỀN (hết âm trong phiên)**: Máy coi là đã xử lý xong $\rightarrow$ **Thôi theo dõi**, tự động dọn dẹp xóa khỏi CSDL.
3. **Trải nghiệm người dùng 2 lớp (Dual-Layer UX)**:
   - **Lớp ngoài (Config Widget)**: Giữ nguyên giao diện gọn gàng, dạng lưới mã tài khoản (`088C...`) cho phép thêm/xóa nhanh bằng tay.
   - **Lớp trong (Detail Modal)**: Nút "Chi tiết" mở bảng dữ liệu toàn diện với đầy đủ các chỉ số tài chính (Số dư, Available Margin, Additional Margin, Loại âm, Phiên ghi nhận).

---

## 2. Đặc Tả Dữ Liệu & Hợp Đồng Giao Tiếp (Data Contract)

### 2.1. Khóa cấu hình trong CSDL (`system_settings`)

| Khóa CSDL (Key) | Phân hệ | Ý nghĩa | Kiểu dữ liệu |
| :--- | :--- | :--- | :--- |
| `negative_margin_monitored_accounts` | **M-System & CQG** | Danh sách tài khoản âm ký quỹ đang theo dõi của MS | JSON String (Array) |
| `negative_margin_monitored_accounts_ccp` | **CoreCCP & CoreEX** | Danh sách tài khoản âm ký quỹ đang theo dõi của CCP | JSON String (Array) |

### 2.2. Cấu trúc một bản ghi tài khoản âm ký quỹ (Schema Definition)

Hệ thống lưu trữ dạng Object chi tiết nhưng hỗ trợ **tương thích ngược 100%** (nếu trước đó là chuỗi String đơn giản hoặc người dùng nhập tay mã TK):

```typescript
export interface MonitoredNegativeAccount {
  account: string;                       // Mã TKGD (ví dụ: '088C123456')
  negativeType: 'IMR' | 'BALANCE' | 'BOTH' | 'MANUAL'; // Phân loại âm
  currentBalance: number;                 // Số dư TKKQ hiện tại (VND)
  availableMargin: number;                // Ký quỹ khả dụng (VND)
  additionalMargin: number;               // Mức bổ sung ký quỹ (VND)
  initialRequiredMargin?: number;         // Ký quỹ ban đầu IMR (VND)
  recordedSessionDate: string;            // Phiên ghi nhận (YYYY-MM-DD)
  system: 'MS' | 'CCP';                   // Nguồn hệ thống
  updatedAt: string;                      // Thời điểm cập nhật ISO timestamp
  note?: string;                          // Ghi chú (nếu thêm thủ công)
}
```

*Cơ chế tự chuẩn hóa (Auto-Normalization Helper)*:
- Khi đọc từ DB ra: Nếu phần tử là `string` (`"088C123456"`), helper tự động convert thành Object với các trường mặc định (`negativeType: 'MANUAL'`, `currentBalance: 0`, ...).
- Khi render ngoài widget UI: Dễ dàng lấy `acc.account` để hiển thị.

---

## 3. Bản Đồ Mã Nguồn & Kế Hoạch Chỉnh Sửa Chi Tiết (File Matrix)

### 3.1. Phân hệ Backend

#### 1. [`backend/src/modules/trading-ops/workers/eod-ms.worker.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/workers/eod-ms.worker.ts)
* **Vị trí tác động**: Dòng 130 - 160.
* **Logic hiện tại**: Đọc setting `negative_margin_monitored_accounts`, lọc bỏ các tài khoản theo dõi nhưng **không tự cập nhật CSDL**.
* **Logic mới cần triển khai**:
  1. Trích xuất danh sách âm thực tế của phiên hôm nay từ kết quả `msEodReconService.checkEOD()`:
     - Tập hợp `currentNegativeMap`: Map từ `account` sang thông tin chi tiết (`currentBalance`, `availableMargin`, `additionalMargin`, `negativeType`).
  2. Đọc danh sách đang theo dõi từ CSDL `system_settings`: `savedMonitoredList`.
  3. **Bước 1 - Dọn dẹp TK đã nạp tiền**:
     - Lọc `savedMonitoredList`: Nếu tài khoản trong DB mà hôm nay không còn nằm trong `currentNegativeMap` $\rightarrow$ Đã nạp tiền xong $\rightarrow$ Xóa khỏi danh sách.
  4. **Bước 2 - Phân loại TK âm**:
     - Tài khoản trong `currentNegativeMap` nếu đã có trong `savedMonitoredList` $\rightarrow$ Âm cũ $\rightarrow$ Giữ nguyên.
     - Tài khoản trong `currentNegativeMap` nếu CHƯA có trong `savedMonitoredList` $\rightarrow$ **Âm MỚI** $\rightarrow$ Thêm vào danh sách theo dõi với đầy đủ tham số cột tài chính.
  5. **Bước 3 - Lưu lại CSDL & Báo cáo kết quả**:
     - Lưu danh sách đã cập nhật vào setting `negative_margin_monitored_accounts`.
     - Nếu có TK âm MỚI $\rightarrow$ `status: 'WARNING'`, ghi chi tiết số lượng TK âm mới và số lượng TK đã nạp tiền được gỡ bỏ.

---

#### 2. [`backend/src/modules/trading-ops/services/recon/ccp-eod.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/services/recon/ccp-eod.service.ts)
* **Vị trí tác động**: Dòng 517 - 635 (`runAutoCheckEodCcp`).
* **Logic hiện tại**: Tìm thư mục T-2, gọi API CoreCCP tải file EOD của ngày T-2, đọc và so sánh với phiên T-1.
* **Logic mới cần triển khai**:
  1. **Xóa bỏ hoàn toàn đoạn đọc/tải file EOD ngày T-2** (loại bỏ phụ thuộc `prevSession`, `prevEodCcpFile`, `this.coreCcpApiAdapter.download(T-2)`).
  2. Đọc danh sách theo dõi của CCP từ CSDL: `negative_margin_monitored_accounts_ccp`.
  3. Trích xuất thông tin chi tiết các tài khoản âm từ file `EOD_CCP.xlsx` và `QLTTTKGD_CCP.xlsx` của phiên hiện tại.
  4. Thực hiện thuật toán đồng nhất với MS:
     - Dọn dẹp các tài khoản đã hết âm khỏi CSDL.
     - Xác định tài khoản âm MỚI (chưa có trong CSDL).
     - Tự động thêm tài khoản âm mới vào CSDL `negative_margin_monitored_accounts_ccp`.
  5. Báo cáo số liệu minh bạch trong log và cảnh báo `WARNING` nếu có tài khoản âm mới.

---

#### 3. [`backend/src/modules/trading-ops/workers/ccp-eod.worker.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/workers/ccp-eod.worker.ts)
* **Vị trí tác động**: Dòng 65 - 125.
* **Logic mới**: Đồng bộ log và metric kết quả: hiển thị rõ số lượng TK âm mới, số lượng TK âm cũ được giữ lại và số lượng TK đã nạp tiền hết âm.

---

### 3.2. Phân hệ Frontend

#### 4. [`frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx)
* **Vị trí tác động**:
  - Dòng 100 - 105: Khai báo state cho cả 2 danh sách (`negativeAccountsMs` và `negativeAccountsCcp`).
  - Dòng 220 - 230: Load cả 2 key `negative_margin_monitored_accounts` và `negative_margin_monitored_accounts_ccp`.
  - Dòng 420 - 430: Lưu cả 2 danh sách khi bấm nút "Lưu Cấu Hình".
  - Dòng 1175 - 1220:
    - Bổ sung nút **"Chi tiết"** (`Eye` icon từ `lucide-react`) cạnh tiêu đề "Danh sách TKGD âm KQ" của MS.
    - Mở rộng hiển thị bảng "Danh sách TKGD âm KQ (CoreCCP)" khi người dùng đang ở tab CoreCCP (`isCcpCeScope`), kèm nút "Chi tiết" tương ứng.
* **Component mới: Modal Xem Chi Tiết Tài Khoản Âm Ký Quỹ**:
  - Xây dựng component Modal chuẩn: `NegativeMarginDetailModal.tsx`.
  - Hiển thị bảng dữ liệu với các cột:
    1. STT
    2. Mã TKGD
    3. Phân hệ (`MS` hoặc `CCP`)
    4. Loại âm (`Âm số dư` / `Âm Ký quỹ IMR`)
    5. Số dư hiện tại (VND) - format tiền tệ
    6. Ký quỹ khả dụng (VND) - format tiền tệ
    7. Mức bổ sung ký quỹ (VND) - format tiền tệ
    8. Phiên ghi nhận (DD/MM/YYYY)
    9. Thao tác: Nút "Xóa" từng dòng nếu muốn gỡ bỏ thủ công.

---

## 4. Thuật Toán Xử Lý Dữ Liệu Đồng Bộ (Unified Algorithm Pseudocode)

```typescript
function reconcileMonitoredNegativeAccounts(
  currentNegativeMap: Map<string, NegativeAccountDetail>,
  savedAccounts: MonitoredNegativeAccount[],
  sessionDateStr: string,
  systemType: 'MS' | 'CCP'
): {
  updatedSavedList: MonitoredNegativeAccount[];
  newNegativeAccounts: MonitoredNegativeAccount[];
  resolvedAccounts: string[];
} {
  const savedMap = new Map(savedAccounts.map((a) => [a.account.toUpperCase(), a]));
  const updatedSavedList: MonitoredNegativeAccount[] = [];
  const newNegativeAccounts: MonitoredNegativeAccount[] = [];
  const resolvedAccounts: string[] = [];

  // 1. Kiểm tra tài khoản cũ: Nếu hôm nay không còn âm -> Đã nạp tiền thì thôi (Loại bỏ)
  for (const saved of savedAccounts) {
    const accKey = saved.account.toUpperCase();
    if (currentNegativeMap.has(accKey)) {
      // Vẫn còn âm -> Cập nhật số liệu mới nhất
      const latest = currentNegativeMap.get(accKey)!;
      updatedSavedList.push({
        ...saved,
        currentBalance: latest.currentBalance,
        availableMargin: latest.availableMargin,
        additionalMargin: latest.additionalMargin,
        negativeType: latest.negativeType,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Đã nạp tiền hết âm -> Thôi theo dõi
      resolvedAccounts.push(saved.account);
    }
  }

  // 2. Kiểm tra tài khoản âm hôm nay: Nếu chưa có trong danh sách -> Âm MỚI (Tự động thêm)
  for (const [accKey, detail] of currentNegativeMap.entries()) {
    if (!savedMap.has(accKey)) {
      const newAcc: MonitoredNegativeAccount = {
        account: detail.account,
        negativeType: detail.negativeType,
        currentBalance: detail.currentBalance,
        availableMargin: detail.availableMargin,
        additionalMargin: detail.additionalMargin,
        recordedSessionDate: sessionDateStr,
        system: systemType,
        updatedAt: new Date().toISOString(),
      };
      newNegativeAccounts.push(newAcc);
      updatedSavedList.push(newAcc);
    }
  }

  return { updatedSavedList, newNegativeAccounts, resolvedAccounts };
}
```

---

## 5. Quy Chuẩn Kiểm Thử & Tiêu Chí Nghiệm Thu (Acceptance Criteria)

1. **Test Scenario 1 (Âm Mới Phát Sinh)**:
   - File EOD có TK `088C999999` bị âm, trong CSDL chưa có.
   - *Kỳ vọng*: Job báo `WARNING`, thêm `088C999999` vào CSDL kèm đầy đủ số dư, ký quỹ.
2. **Test Scenario 2 (Đã Có Sẵn Thì Thôi)**:
   - File EOD phiên tiếp theo vẫn có TK `088C999999` bị âm.
   - *Kỳ vọng*: Job nhận diện đã có trong CSDL $\rightarrow$ Báo `SUCCESS` (hoặc không cảnh báo lặp), cập nhật số dư mới nhất.
3. **Test Scenario 3 (Đã Nạp Tiền Thì Thôi)**:
   - Khách hàng nạp tiền, file EOD phiên sau đó không còn TK `088C999999` âm nữa.
   - *Kỳ vọng*: Job tự động gỡ `088C999999` ra khỏi CSDL, ghi log `Đã loại bỏ 1 tài khoản đã nạp tiền hết âm`.
4. **Test Scenario 4 (UI & Modal)**:
   - Bên ngoài hiển thị danh sách thẻ tài khoản gọn gàng.
   - Bấm nút "Chi tiết" $\rightarrow$ Modal mở lên hiển thị đầy đủ các cột số liệu, format số chuẩn và phân loại âm chính xác.

