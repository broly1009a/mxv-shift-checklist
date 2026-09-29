# TÀI LIỆU THIẾT KẾ KỸ THUẬT: TÁCH ĐỘC LẬP TÁC VỤ THỐNG KÊ SỐ LOT VÀ GIÁ TRỊ GIAO DỊCH (CORECCP)

> **Dự án**: MXV Shift Checklist / Investigation CQG & CoreCCP  
> **Module**: CoreCCP VNCLEAR - Thống kê Số Lot & Giá Trị Giao Dịch  
> **Tác giả**: AI Assistant & Đội ngũ Kỹ thuật Vận hành MXV  
> **Ngày lập**: 24/09/2026  
> **Trạng thái**: Bản Thiết Kế Chi Tiết Triển Khai (Ready for Implementation)  

---

## 1. BỐI CẢNH & MỤC TIÊU NGHIỆP VỤ

### 1.1. Hiện Trạng Hệ Thống
Hệ thống hiện tại trên màn hình CoreCCP ([CcpLotStatisticsSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx)) đang áp dụng cơ chế **2 bước thủ công**:
1. **Bước 1**: Nhấn nút `Bước 1: Tổng Hợp Dữ Liệu Ngày` ([L573-L602](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx#L573-L602)) $\rightarrow$ Backend đọc file ngày và tính toán cả Số Lot lẫn Giá Trị trong bộ nhớ RAM, trả về bảng Preview.
2. **Bước 2**: Nhấn nút `Bước 2: Ghi Vào 10 File Lũy Kế Excel` ([L604-L636](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx#L604-L636)) $\rightarrow$ Backend mở đồng thời 10 file Excel (5 file Lot + 5 file GTGD) để ghi số liệu.

### 1.2. Nhược Điểm của Cơ Chế Hiện Tại
1. **Thao tác rườm rà**: Ca trực bắt buộc phải bấm 2 lần mới ghi được vào file. Nếu quên bấm Bước 2 thì các sổ Excel lũy kế hoàn toàn chưa có số liệu.
2. **Bị ràng buộc chéo vào Tỷ giá**: Để tổng hợp được ở Bước 1, hệ thống bắt buộc phải tính cả Giá Trị. Nếu file tỷ giá của ngày đó chưa kịp xuất từ CoreCCP hoặc bị lỗi mạng, ca trực **bị chặn luôn, không thể chốt và ghi được Số Lot**.
3. **Hiệu năng & Độ trễ**: Mỗi lần ghi phải mở, xử lý và lưu 10 workbook Excel cùng lúc, tốn nhiều thời gian (4–7 giây) và dễ gặp lỗi khóa file (`EBUSY`) nếu có ai đó đang mở xem 1 trong 10 file.
4. **Không đồng nhất với tab Legacy MS-CQG**: Bên tab Legacy M-System/CQG ([LegacyBackupThongKeSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx#L1258-L1279)) và Tool C# gốc ([FormMain.cs](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/FormMain.cs#L1685-L1712)) luôn chia thành 2 nút độc lập: **"Thống kê số lot"** và **"Thống kê giá trị"**.

### 1.3. Mục Tiêu Thiết Kế Mới
* **Tách thành 2 nút độc lập "1 chạm" (One-Click Execute)**:
  * 🟢 **"Thống Kê Số Lot (CoreCCP)"**: Đọc dữ liệu ngày $\rightarrow$ Tính toán số lot $\rightarrow$ Ghi trực tiếp vào 5 file Excel Số Lot (Normal, ACM, Spread, LME, Options). Hoàn toàn **độc lập với tỷ giá**.
  * 🟡 **"Thống Kê Giá Trị (CoreCCP)"**: Kiểm tra tỷ giá $\rightarrow$ Tính toán GTGD quy đổi $\rightarrow$ Ghi trực tiếp vào 5 file Excel Giá Trị (Normal, ACM, Spread, LME, Options).
* **Bảo toàn 100% luồng cũ (Backwards Compatibility)**:
  * Toàn bộ API và Handler của luồng 2 bước cũ được giữ nguyên vẹn trong mã nguồn Backend và Frontend (chỉ comment lại hoặc chuyển vào khu vực nâng cao) để sẵn sàng rollback nếu cần.

---

## 2. ĐỐI CHIẾU MÃ NGUỒN HIỆN TẠI (GROUND TRUTH AUDIT)

### 2.1. Tool C# Gốc (`operate-transaction-app`)
* **Nút bấm UI**: [FormMain.cs#L1685-L1712](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/FormMain.cs#L1685-L1712):
  ```csharp
  // 1. Thống kê Số Lot
  private void btnCountTradingLot_Click(object sender, EventArgs e) {
      var result = _backupService.LotStactics(dtpLotsStaticsSession.Value.ToString("dd/MM/yyyy"));
      ...
  }
  // 2. Thống kê Giá Trị
  private void btnCountTradingValue_Click(object sender, EventArgs e) {
      var result = _backupService.ValueStactics(dtpTradingStaticsSession.Value.ToString("dd/MM/yyyy"));
      ...
  }
  ```
* **Logic ghi file Số Lot**: [BackupService.cs#L1270-L1315](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/BackupService.cs#L1270-L1315) $\rightarrow$ Ghi vào 5 file Số Lot (`FOM - Thong ke so lot giao dich...`).
* **Logic ghi file Giá Trị**: [BackupService.cs#L1560-L1650](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/BackupService.cs#L1560-L1650) $\rightarrow$ Ghi vào 5 file Giá Trị (`Thong ke gia tri giao dich...`).

### 2.2. Backend NestJS Hiện Tại
* **Controller**: [ccp-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-statistics.controller.ts)
  * `POST lot-statistics/process-daily` ([L175-L235](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-statistics.controller.ts#L175-L235)): Nhận `{ date }` $\rightarrow$ gọi `processDailyBackup(date)`.
  * `POST lot-statistics/write-accumulator` ([L251-L325](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-statistics.controller.ts#L251-L325)): Nhận `{ result, paths }` $\rightarrow$ gọi `writeToAccumulator(result, paths)`.
* **Service**: [ccp-lot-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts)
  * Hàm `writeToAccumulator` ([L490-L620](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts#L490-L620)) đã phân chia rất rõ ràng thành các Phase:
    * **Phase 1 & Phase 2** (Lines 500–564): Ghi các file Số Lot:
      - ACM Lot: `writeCcpLotToAccumulator`
      - Normal Lot, Spread Lot, LME Lot, Options Lot: `writeCcpTypedLotToAccumulator`
    * **Phase 3** (Lines 567–595): Ghi các file Giá Trị:
      - ACM GTGD: `writeCcpGtgdToAccumulator`
      - Normal GTGD, Spread GTGD, LME GTGD, Options GTGD: `writeCcpTypedValueToAccumulator`
    * **Phase 4 & 5** (Lines 598–630): Ghi Raw DSGD lũy kế & Bạc thỏi Audit.

### 2.3. Frontend Next.js Hiện Tại
* **File**: [CcpLotStatisticsSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx)
  * `handleProcessDaily` ([L435-L466](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx#L435-L466)): Gọi `POST /process-daily`.
  * `handleWriteAccumulator` ([L398-L432](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx#L398-L432)): Gọi `POST /write-accumulator`.
  * Giao diện nút bấm 2 bước ([L573-L637](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx#L573-L637)).

---

## 3. KIẾN TRÚC THIẾT KẾ MỚI (DETAILED SPECIFICATION)

### 3.1. Thiết Kế Backend (NestJS)

#### A. Mở rộng Service `writeToAccumulator`
Cập nhật chữ ký hàm `writeToAccumulator` với tham số tùy chọn `targetScope?: 'ALL' | 'LOT_ONLY' | 'VALUE_ONLY'`:

```typescript
async writeToAccumulator(
  result: CcpLotResult,
  paths: CcpAccumulatorPaths,
  dsgdBuffer?: Buffer,
  jobLogs?: string[],
  targetScope: 'ALL' | 'LOT_ONLY' | 'VALUE_ONLY' = 'ALL',
): Promise<{ lotUpdated: boolean; gtgdUpdated: boolean; errors: string[] }> {
  const errors: string[] = [];
  let lotUpdated = false;
  let gtgdUpdated = false;

  const shouldWriteLot = targetScope === 'ALL' || targetScope === 'LOT_ONLY';
  const shouldWriteValue = targetScope === 'ALL' || targetScope === 'VALUE_ONLY';

  // 1. Ghi các file Số Lot (ACM, Normal, Spread, LME, Options)
  if (shouldWriteLot) {
    // Phase 1 (ACM Lot) + Phase 2 (Typed Lots)
    ...
    lotUpdated = true;
  }

  // 2. Ghi các file Giá Trị (ACM GTGD, Normal GTGD, Spread, LME, Options)
  if (shouldWriteValue) {
    // Phase 3 (ACM GTGD + Typed Values)
    ...
    gtgdUpdated = true;
  }

  // 3. Raw DSGD & Bạc Thỏi Audit (chỉ chạy khi scope là ALL hoặc LOT_ONLY)
  if (shouldWriteLot) {
    ...
  }

  return { lotUpdated, gtgdUpdated, errors };
}
```

#### B. Thêm 2 Method Chuyên Biệt trong `ccp-lot-statistics.service.ts`
1. **`runLotStatisticsDirect(dateStr: string)`**:
   - Quét file thư mục ngày qua `scanDailyFiles(dateStr)`.
   - Gọi `processDailyBackup(dateStr)` để bóc tách các dòng khớp lệnh từ `DSGD.xlsx` và tính toán số lot theo TVKD, Hàng hóa, Phân hệ.
   - Lấy cấu hình đường dẫn (`getConfig()`).
   - Gọi `writeToAccumulator(result, paths, dsgdBuffer, jobLogs, 'LOT_ONLY')`.
   - Trả về: `{ success: boolean, result, logs: jobLogs, errors }`.
2. **`runValueStatisticsDirect(dateStr: string)`**:
   - Quét file thư mục ngày.
   - Xác thực tỷ giá: Kiểm tra xem đã có tỷ giá trong DB MongoDB hoặc tệp ngày chưa. Nếu chưa có $\rightarrow$ ném lỗi rõ ràng yêu cầu cập nhật tỷ giá.
   - Gọi `processDailyBackup(dateStr)` để tính giá trị giao dịch quy đổi VND.
   - Lấy cấu hình đường dẫn.
   - Gọi `writeToAccumulator(result, paths, dsgdBuffer, jobLogs, 'VALUE_ONLY')`.
   - Trả về: `{ success: boolean, result, logs: jobLogs, errors }`.

#### C. Thêm 2 Controller Endpoints trong `ccp-statistics.controller.ts`
```typescript
/**
 * POST /api/v1/ccp-statistics/lot-statistics/run-lot
 * Tự động tổng hợp và ghi trực tiếp vào các file Số Lot
 */
@Post('lot-statistics/run-lot')
@Permissions('ACCESS_AUTO_SHIFT')
async runLotDirect(@Body() body: { date?: string }) {
  const dateStr = body?.date || new Date().toISOString().split('T')[0];
  return await this.ccpLotStatisticsService.runLotStatisticsDirect(dateStr);
}

/**
 * POST /api/v1/ccp-statistics/lot-statistics/run-value
 * Tự động quy đổi tỷ giá và ghi trực tiếp vào các file Giá Trị
 */
@Post('lot-statistics/run-value')
@Permissions('ACCESS_AUTO_SHIFT')
async runValueDirect(@Body() body: { date?: string }) {
  const dateStr = body?.date || new Date().toISOString().split('T')[0];
  return await this.ccpLotStatisticsService.runValueStatisticsDirect(dateStr);
}
```

---

### 3.2. Thiết Kế Frontend (Next.js - `CcpLotStatisticsSection.tsx`)

#### A. State Quản Lý Loading Độc Lập
```typescript
const [runningLot, setRunningLot] = useState<boolean>(false);
const [runningValue, setRunningValue] = useState<boolean>(false);
const [lotLogs, setLotLogs] = useState<string[]>([]);
const [valueLogs, setValueLogs] = useState<string[]>([]);
```

#### B. Handler Chạy 1-Chạm
```typescript
// 1. Chạy Thống Kê Số Lot
const handleRunLotDirect = async () => {
  if (!token || !scanResult?.canProcess) return;
  setRunningLot(true);
  setLotLogs([]);
  const toastId = toast.loading(`Đang tính toán và ghi file Số Lot ngày ${ngayGD}...`);
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/ccp-statistics/lot-statistics/run-lot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date: ngayGD }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      setResult(data.result);
      setLotLogs(data.logs || []);
      toast.success(`Đã ghi thành công các file Số Lot (${data.result?.totalSoLot?.toLocaleString('vi-VN')} lot)`, { id: toastId });
    } else {
      toast.error(data?.message || 'Có lỗi khi ghi file Số Lot', { id: toastId });
    }
  } catch (err: any) {
    toast.error(`Lỗi: ${err.message}`, { id: toastId });
  } finally {
    setRunningLot(false);
  }
};

// 2. Chạy Thống Kê Giá Trị
const handleRunValueDirect = async () => {
  if (!token || !scanResult?.canProcess) return;
  setRunningValue(true);
  setValueLogs([]);
  const toastId = toast.loading(`Đang tính toán và ghi file Giá Trị ngày ${ngayGD}...`);
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/ccp-statistics/lot-statistics/run-value`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date: ngayGD }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      setResult(data.result);
      setValueLogs(data.logs || []);
      toast.success(`Đã ghi thành công các file Giá Trị Giao Dịch`, { id: toastId });
    } else {
      toast.error(data?.message || 'Có lỗi khi ghi file Giá Trị', { id: toastId });
    }
  } catch (err: any) {
    toast.error(`Lỗi: ${err.message}`, { id: toastId });
  } finally {
    setRunningValue(false);
  }
};
```

#### C. Giao Diện Nút Bấm Mới (UI Component)
Thay thế cụm nút tại dòng [571-637](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx#L571-L637):

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
  {/* NÚT 1: THỐNG KÊ SỐ LOT (1-CHẠM) */}
  <button
    type="button"
    onClick={handleRunLotDirect}
    disabled={runningLot || runningValue || !scanResult?.canProcess}
    className="btn btn-primary"
    style={{
      fontSize: '0.86rem',
      fontWeight: 800,
      padding: '10px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      borderRadius: '8px',
      backgroundColor: '#10b981',
      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
      cursor: runningLot || !scanResult?.canProcess ? 'not-allowed' : 'pointer',
    }}
  >
    {runningLot ? (
      <>
        <Loader2 size={16} className="animate-spin" />
        <span>Đang Ghi File Số Lot...</span>
      </>
    ) : (
      <>
        <Layers size={16} />
        <span>Thống Kê Số Lot (CoreCCP)</span>
      </>
    )}
  </button>

  {/* NÚT 2: THỐNG KÊ GIÁ TRỊ (1-CHẠM) */}
  <button
    type="button"
    onClick={handleRunValueDirect}
    disabled={runningLot || runningValue || !scanResult?.canProcess}
    className="btn btn-secondary"
    style={{
      fontSize: '0.86rem',
      fontWeight: 800,
      padding: '10px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      borderRadius: '8px',
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      borderColor: 'rgba(245, 158, 11, 0.4)',
      color: '#f59e0b',
      boxShadow: '0 4px 14px rgba(245, 158, 11, 0.2)',
      cursor: runningValue || !scanResult?.canProcess ? 'not-allowed' : 'pointer',
    }}
  >
    {runningValue ? (
      <>
        <Loader2 size={16} className="animate-spin" />
        <span>Đang Ghi File Giá Trị...</span>
      </>
    ) : (
      <>
        <Coins size={16} />
        <span>Thống Kê Giá Trị (CoreCCP)</span>
      </>
    )}
  </button>
</div>

{/* KHỐI GIỮ LẠI LUỒNG CŨ 2 BƯỚC (DỰ PHÒNG HOẶC COMMENT LẠI) */}
{/* 
  <div style={{ display: 'none' }}>
    <button onClick={handleProcessDaily}>Bước 1: Tổng Hợp Dữ Liệu Ngày</button>
    <button onClick={handleWriteAccumulator}>Bước 2: Ghi Vào 10 File Lũy Kế Excel</button>
  </div>
*/}
```

---

## 4. MA TRẬN TÁC ĐỘNG TỆP TIN (FILE IMPACT MATRIX)

| Tệp tin | Vị trí thay đổi | Chi tiết tác động |
| :--- | :--- | :--- |
| **`ccp-lot-statistics.service.ts`** | Dòng 490 & dòng 350+ | Thêm `targetScope` vào `writeToAccumulator`; triển khai `runLotStatisticsDirect` và `runValueStatisticsDirect`. |
| **`ccp-statistics.controller.ts`** | Dòng 240+ | Bổ sung 2 route `@Post('lot-statistics/run-lot')` và `@Post('lot-statistics/run-value')`. |
| **`CcpLotStatisticsSection.tsx`** | Dòng 435–640 | Thêm 2 state loading, 2 hàm gọi API 1-chạm, thay thế cụm nút bấm Header; đóng gói comment giữ lại luồng 2 bước cũ. |

---

## 5. KẾ HOẠCH KIỂM THỬ & XÁC MINH CHẤT LƯỢNG

1. **Kiểm thử độc lập Nút "Thống Kê Số Lot"**:
   * Xóa tạm thời file tỷ giá hoặc không đồng bộ tỷ giá.
   * Nhấn nút **"Thống Kê Số Lot (CoreCCP)"**.
   * **Kỳ vọng**: 5 file Excel Số Lot (`Normal`, `ACM`, `Spread`, `LME`, `Options`) được ghi chính xác vào dòng ngày chỉ định; không báo lỗi tỷ giá; không tác động vào 5 file Giá Trị.
2. **Kiểm thử độc lập Nút "Thống Kê Giá Trị"**:
   * Kiểm tra tỷ giá hợp lệ trong DB / tệp ngày.
   * Nhấn nút **"Thống Kê Giá Trị (CoreCCP)"**.
   * **Kỳ vọng**: 5 file Excel Giá Trị được ghi chính xác giá trị quy đổi VND vào dòng ngày chỉ định; không ghi đè lại 5 file Số Lot.
3. **Kiểm thử an toàn Sheet tháng mới**:
   * Chọn ngày đầu tháng mới (ví dụ `01/10/2026`).
   * **Kỳ vọng**: Tự động sinh sheet `T10.2026` sạch sẽ qua `excel_sheet_cloner.py` và ghi đúng vào dòng ngày đầu tiên của tháng mới.
4. **Kiểm thử tương thích ngược**:
   * Mở lại luồng cũ (nếu gọi trực tiếp qua API test Postman/CURL tới `process-daily` và `write-accumulator`).
   * **Kỳ vọng**: Vẫn hoạt động hoàn hảo 100% như trước.
