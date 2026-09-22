# THIẾT KẾ CHI TIẾT: PHÂN HỆ THỐNG KÊ LOT & GTGD CCP PHASE 2
## Tài liệu 2/2 — Hoàn thiện 9 File Lũy Kế Còn Thiếu

> **Phiên bản**: v1.0 | **Ngày**: 17/09/2026
> **Trạng thái**: Bản thiết kế — Cần USER duyệt trước khi triển khai
>
> **Nguồn bằng chứng**:
> - [`ccp-accumulator.helper.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/helpers/ccp-accumulator.helper.ts) — Accumulator CCP hiện tại (L16-L21, L98-L381)
> - [`ccp-lot-statistics.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts) — Service chính (L272-L355)
> - [`excel-accumulator.helper.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/lot-statistics/helpers/excel-accumulator.helper.ts) — Logic tham chiếu CQG (L359-L517)
> - [`excel-value-accumulator.helper.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/lot-statistics/helpers/excel-value-accumulator.helper.ts) — Logic GTGD CQG (L269-L588)

---

## 1. TỔNG QUAN PHẠM VI

### Hiện Trạng (Phase 1 — đã hoàn thiện)

```
CcpAccumulatorPaths:
  pathAcmLot   → "Thong ke so lot giao dich ACM [year].xlsx"   ✅
  pathAcmGtgd  → "Thong ke gia tri giao dich ACM [year].xlsx"  ✅
```

### Mục Tiêu Phase 2

```
CcpAccumulatorPaths (mở rộng):
  pathAcmLot          ✅ Giữ nguyên
  pathAcmGtgd         ✅ Giữ nguyên
  pathNormalLot    → "Thong ke so lot giao dich [year].xlsx"               ❌ Cần làm
  pathSpreadLot    → "Thong ke so lot giao dich Spread [year].xlsx"        ❌ Cần làm
  pathLmeLot       → "Thong ke so lot giao dich LME [year].xlsx"           ❌ Cần làm
  pathOptionsLot   → "Thong ke so lot giao dich Options [year].xlsx"       ❌ Cần làm
  pathDsgdCumulative→ "DSGD T[MM].[YYYY] CCP.xlsx"                         ❌ Cần làm
  pathGtgdNormal   → "Thong ke gia tri giao dich [year].xlsx"              ❌ Cần làm
  pathGtgdSpread   → "Thong ke gia tri giao dich Spread [year].xlsx"       ❌ Cần làm
  pathGtgdLme      → "Thong ke gia tri giao dich LME [year].xlsx"          ❌ Cần làm
  pathGtgdOptions  → "Thong ke gia tri giao dich Options [year].xlsx"      ❌ Cần làm
```

**Điều kiện kích hoạt Phase 2**: CCP phải có tài khoản Spread (`-S`), LME (tài khoản `L`), hoặc Futures nội địa (tài khoản `F`/không có hậu tố `-A`) active. Khi `classifyCcpDsgd()` trả về `classified.spread.length > 0 || classified.lme.length > 0 || classified.normal.length > 0`.

---

## 2. THIẾT KẾ INTERFACE — `CcpAccumulatorPaths`

**File cần sửa**: [`ccp-accumulator.helper.ts#L16-L21`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/helpers/ccp-accumulator.helper.ts#L16-L21)

```typescript
// THAY THẾ interface hiện tại:
export interface CcpAccumulatorPaths {
  /** Phase 1 — Đã hoàn thiện */
  pathAcmLot?: string;          // "Thong ke so lot giao dich ACM [year].xlsx"
  pathAcmGtgd?: string;         // "Thong ke gia tri giao dich ACM [year].xlsx"

  /** Phase 2 — Số Lot */
  pathNormalLot?: string;       // "Thong ke so lot giao dich [year].xlsx"
  pathSpreadLot?: string;       // "Thong ke so lot giao dich Spread [year].xlsx"
  pathLmeLot?: string;          // "Thong ke so lot giao dich LME [year].xlsx"
  pathOptionsLot?: string;      // "Thong ke so lot giao dich Options [year].xlsx"
  pathDsgdCumulative?: string;  // "DSGD T[MM].[YYYY] CCP.xlsx" — raw DSGD lũy kế

  /** Phase 2 — Giá Trị Giao Dịch (GTGD) */
  pathGtgdNormal?: string;      // "Thong ke gia tri giao dich [year].xlsx"
  pathGtgdSpread?: string;      // "Thong ke gia tri giao dich Spread [year].xlsx"
  pathGtgdLme?: string;         // "Thong ke gia tri giao dich LME [year].xlsx"
  pathGtgdOptions?: string;     // "Thong ke gia tri giao dich Options [year].xlsx"
}
```

---

## 3. THIẾT KẾ HÀM MỚI — `ccp-accumulator.helper.ts`

### 3A. Hàm: `writeCcpTypedLotToAccumulator()`

**Mục đích**: Ghi số lot theo loại (Normal/Spread/LME/Options) vào file lũy kế — tái sử dụng logic `updateTvkdTrackerFile()` từ CQG ([excel-accumulator.helper.ts#L359-L435](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/lot-statistics/helpers/excel-accumulator.helper.ts#L359-L435)).

**Cấu trúc Excel file lũy kế (Normal/Spread/LME/Options)**:

| Cột | Nội Dung | Ghi Chú |
| :--- | :--- | :--- |
| Cột 1 (A) | STT | Auto increment từ row 5 |
| Cột 2 (B) | Ngày giao dịch | `ngayGD` — `findOrCreateTargetRow()` |
| Cột 3-N | Lot per TVKD | Header row 4: "HN 001", "SF 002"... — map theo 3 ký tự số |
| Cột "Tổng" | SUM formula | Dynamic tìm header "Tổng" trong row 4 |
| Cột N+1-M | Lot per Sản phẩm | Header row 4: "ZLE", "ZCE"... — match tên SP |

```typescript
/**
 * Ghi số lot theo loại (Normal/Spread/LME/Options) vào file lũy kế CCP.
 * Tái sử dụng logic updateTvkdTrackerFile() từ CQG.
 *
 * @param result    - CcpLotResult từ processCcpLotStatistics()
 * @param filePath  - Đường dẫn file lũy kế tương ứng
 * @param tradeType - Loại để lọc từ classified: 'normal' | 'spread' | 'lme' | 'options'
 * @param jobLogs   - Optional: mảng log để append vào
 */
export async function writeCcpTypedLotToAccumulator(
  result: CcpLotResult,
  filePath: string,
  tradeType: 'normal' | 'spread' | 'lme' | 'options',
  jobLogs?: string[],
): Promise<void> {
  // 1. Kiểm tra file tồn tại
  ensureBaseFileExists(filePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File lũy kế lot ${tradeType} không tồn tại: "${filePath}". ` +
      `Vui lòng tạo file template trước.`,
    );
  }
  backupFile(filePath);

  const ngayGD = new Date(result.ngayGD);
  const log = (msg: string) => jobLogs?.push(`[CCP-LOT-${tradeType.toUpperCase()}] ${msg}`);

  // 2. Lọc byTvkd theo loại — dùng CcpLotResult.byTvkd + filter theo mã TK
  // Normal: TK không có -A, -S, -L suffix
  // Spread: TK có -S suffix
  // LME: TK có loại LME (cần thêm field `accountType` vào CcpTvkdStat Phase 2)
  // Options: TK có Options product
  const filteredTvkd = filterTvkdByType(result.byTvkd, tradeType);

  // 3. Load workbook
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheetName = getSheetName(path.basename(filePath), ngayGD);
  let ws = wb.getWorksheet(sheetName);
  if (!ws) {
    const cloned = ensureMonthSheetExists(filePath, sheetName, jobLogs);
    if (cloned) {
      await wb.xlsx.readFile(filePath);
      ws = wb.getWorksheet(sheetName);
    }
  }
  if (!ws) {
    throw new Error(
      `File "${path.basename(filePath)}" chưa có Sheet "${sheetName}". ` +
      `Vui lòng tạo Sheet tháng mới trong file template trước.`,
    );
  }

  // 4. Tìm hoặc tạo dòng ngày
  const targetRowIndex = findOrCreateTargetRow(ws, ngayGD);

  // 5. Ghi lot per TVKD — scan header row 4, cột 3 đến 63
  const headerRow = ws.getRow(4);
  for (let col = 3; col <= 63; col++) {
    const headerVal = headerRow.getCell(col).value;
    if (!headerVal) continue;
    const headerText = String(headerVal);
    const tvkdCode = headerText.replace(/\s+/g, '').match(/\d{3}/)?.[0];
    if (!tvkdCode) continue;
    const tvkdStat = filteredTvkd.find(t => t.tvkd === tvkdCode);
    ws.getCell(targetRowIndex, col).value = tvkdStat?.soLot ?? 0;
  }
  log(`Ghi lot ${tradeType} per TVKD: ${filteredTvkd.length} TVKD có data`);

  // 6. Ghi lot per Sản phẩm — scan header row 4, cột 66 đến 90
  for (let col = 66; col <= 90; col++) {
    const headerVal = headerRow.getCell(col).value;
    if (!headerVal) continue;
    const spCode = String(headerVal).replace(/\s+/g, '').toUpperCase();
    let sumLot = 0;
    for (const tvkd of filteredTvkd) {
      for (const hh of tvkd.byHH ?? []) {
        if (hh.maHH.toUpperCase() === spCode) sumLot += hh.soLot;
      }
    }
    ws.getCell(targetRowIndex, col).value = sumLot;
  }

  fixSharedFormulas(wb);
  await safeWriteExcel(wb, filePath);
  log(`Đã lưu: ${path.basename(filePath)}`);
}
```

> [!IMPORTANT]
> **Yêu cầu bổ sung để Phase 2 hoạt động**: `CcpTvkdStat` cần thêm trường `accountType: 'acm' | 'spread' | 'lme' | 'normal'` để hàm `filterTvkdByType()` lọc đúng. Hiện tại `classifyCcpDsgd()` đã phân loại nhưng kết quả chưa được gắn vào `byTvkd`.

---

### 3B. Hàm: `writeCcpTypedValueToAccumulator()`

**Mục đích**: Ghi GTGD theo loại (Normal/Spread/LME/Options) vào file lũy kế — tái sử dụng logic `updateValueTrackerFile()` từ CQG ([excel-value-accumulator.helper.ts#L269-L346](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/lot-statistics/helpers/excel-value-accumulator.helper.ts#L269-L346)).

**Cấu trúc Excel file GTGD lũy kế (Normal/Spread/LME/Options)**:

| Cột | Nội Dung | Ghi Chú |
| :--- | :--- | :--- |
| Cột 1 (A) | Ngày giao dịch | `ngayGD` — KHÔNG có cột STT (khác với file Lot) |
| Cột 2-N | GTGD per Hàng hoá (VND) | Header row 5: mã HH (ZLE, ZCE...) — theo thứ tự commodity list |
| Cột "Tổng" | SUM formula | Dynamic tìm "Tổng" trong row 5 |

**Danh sách commodity theo loại** (tái sử dụng từ [`excel-value-accumulator.helper.ts#L16-L128`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/lot-statistics/helpers/excel-value-accumulator.helper.ts#L16-L128)):

| Loại | Danh Sách Hàng Hoá |
| :--- | :--- |
| Normal | `NORMAL_COMMODITIES` (50+ mã: ZLE, ZCE, ZSE, ...) |
| Spread | `SPREAD_COMMODITIES` (8 mã: ZSE, ZCE, ZLE, ZRE, XC, TRU, MHG, C.ZCE) |
| LME | `LME_COMMODITIES` (9 mã: CAD, AHD, PBD, SND, ZDS, NID, SSC, SSR, LHC) |
| Options | `OPTIONS_COMMODITIES` (16 mã: C.ZCE, P.ZCE, C.ZSE, ...) |

```typescript
/**
 * Ghi GTGD theo loại (Normal/Spread/LME/Options) vào file lũy kế CCP.
 * Tái sử dụng logic updateValueTrackerFile() từ CQG.
 */
export async function writeCcpTypedValueToAccumulator(
  result: CcpLotResult,
  filePath: string,
  tradeType: 'normal' | 'spread' | 'lme' | 'options',
  jobLogs?: string[],
): Promise<void> {
  ensureBaseFileExists(filePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File lũy kế GTGD ${tradeType} không tồn tại: "${filePath}". ` +
      `Vui lòng tạo file template trước.`,
    );
  }
  backupFile(filePath);

  const ngayGD = new Date(result.ngayGD);
  const log = (msg: string) => jobLogs?.push(`[CCP-GTGD-${tradeType.toUpperCase()}] ${msg}`);

  // Import danh sách commodity theo loại
  const commodityList = getCommodityListByType(tradeType);
  // 'normal' → NORMAL_COMMODITIES, 'spread' → SPREAD_COMMODITIES, etc.

  // Tổng hợp GTGD per mã HH từ byTvkd đã lọc theo loại
  const filteredTvkd = filterTvkdByType(result.byTvkd, tradeType);
  const gtgdByHh = new Map<string, number>();
  for (const tvkd of filteredTvkd) {
    for (const hh of tvkd.byHH ?? []) {
      const key = hh.maHH.toUpperCase();
      gtgdByHh.set(key, (gtgdByHh.get(key) || 0) + hh.giaTri);
    }
  }

  // Load workbook, find/create sheet tháng
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheetName = getSheetName(path.basename(filePath), ngayGD);
  let ws = wb.getWorksheet(sheetName);
  if (!ws) {
    const cloned = ensureMonthSheetExists(filePath, sheetName, jobLogs);
    if (cloned) {
      await wb.xlsx.readFile(filePath);
      ws = wb.getWorksheet(sheetName);
    }
  }
  if (!ws) {
    throw new Error(
      `File "${path.basename(filePath)}" chưa có Sheet "${sheetName}".`,
    );
  }

  // Tìm dòng ngày (cột A là ngày — dùng findOrCreateValueTargetRow)
  const targetRowIndex = findOrCreateValueTargetRow(ws, ngayGD);

  // Ghi GTGD từng HH vào cột bắt đầu từ Col 2 (B)
  for (let i = 0; i < commodityList.length; i++) {
    const code = commodityList[i];
    const val = Math.round(gtgdByHh.get(code) || 0);
    ws.getCell(targetRowIndex, 2 + i).value = val;
    if (val > 0) log(`${code} = ${val.toLocaleString('vi-VN')} VND`);
  }

  // Ghi SUM formula cho cột "Tổng" (tìm động theo header row 5)
  const lastDataCol = 1 + commodityList.length;
  const tongCol = lastDataCol + 1;
  ws.getCell(targetRowIndex, tongCol).value = {
    formula: `SUM(B${targetRowIndex}:${getColLetter(lastDataCol)}${targetRowIndex})`,
    result: [...gtgdByHh.values()].reduce((s, v) => s + v, 0),
  };

  // LME: xóa cell M1 (theo quy ước CQG)
  if (tradeType === 'lme') {
    ws.getCell(1, 13).value = null;
  }

  fixSharedFormulas(wb);
  await safeWriteExcel(wb, filePath);
  log(`Đã lưu: ${path.basename(filePath)}`);
}
```

---

### 3C. Hàm: `appendCcpRawDsgd()`

**Mục đích**: Ghi thêm raw rows DSGD CCP vào file lũy kế tháng — tái sử dụng `appendRawDsgd()` từ CQG.

```typescript
/**
 * Append raw DSGD CCP rows vào file lũy kế tháng.
 * Tái sử dụng trực tiếp appendRawDsgd() từ excel-accumulator.helper.ts
 */
export async function appendCcpRawDsgd(
  dsgdCcpBuffer: Buffer,          // dsgdCcp từ CcpLotInput
  targetFilePath: string,         // pathDsgdCumulative
  ngayGD: Date,
  jobLogs?: string[],
): Promise<void> {
  // Import và tái sử dụng hoàn toàn từ module CQG
  const { appendRawDsgd } = await import(
    '../../lot-statistics/helpers/excel-accumulator.helper'
  );
  await appendRawDsgd(dsgdCcpBuffer, targetFilePath, ngayGD);
  jobLogs?.push(`[CCP-RAW-DSGD] Appended DSGD rows ngày ${ngayGD.toISOString()} → ${path.basename(targetFilePath)}`);
}
```

> [!NOTE]
> Hàm `appendRawDsgd()` hiện tại đọc từ file Excel (`.xlsx`). File DSGD CCP là `.csv`. Cần chuyển đổi trước: `parseExcelBuffer(dsgdCcpBuffer)` trả về rows, sau đó ghi lại ra Buffer Excel trước khi gọi `appendRawDsgd()`. Hoặc viết hàm `appendCcpRawDsgdFromCsv()` riêng dùng thư viện `csv-parse`.

---

## 4. CẬP NHẬT `writeToAccumulator()` — Gọi Các Hàm Mới

**File cần sửa**: [`ccp-lot-statistics.service.ts#L272-L315`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts#L272-L315)

```typescript
async writeToAccumulator(
  result: CcpLotResult,
  paths: CcpAccumulatorPaths,
  dsgdBuffer?: Buffer,          // ← Thêm tham số này cho appendCcpRawDsgd
  jobLogs?: string[],
): Promise<{ lotUpdated: boolean; gtgdUpdated: boolean; errors: string[] }> {
  const errors: string[] = [];
  let lotUpdated = false;
  let gtgdUpdated = false;

  // ── Phase 1 (giữ nguyên) ────────────────────────────────────────────────────
  if (paths.pathAcmLot) {
    const resolved = resolveStoragePathCrossPlatform(
      resolveDynamicPath(paths.pathAcmLot, result.ngayGD)
    );
    try {
      await writeCcpLotToAccumulator(result, resolved, jobLogs);
      lotUpdated = true;
    } catch (err: any) { errors.push(`Lỗi AcmLot: ${err.message}`); }
  }

  if (paths.pathAcmGtgd) {
    const resolved = resolveStoragePathCrossPlatform(
      resolveDynamicPath(paths.pathAcmGtgd, result.ngayGD)
    );
    try {
      await writeCcpGtgdToAccumulator(result, resolved, jobLogs);
      gtgdUpdated = true;
    } catch (err: any) { errors.push(`Lỗi AcmGtgd: ${err.message}`); }
  }

  // ── Phase 2 — Số Lot ────────────────────────────────────────────────────────
  for (const [key, tradeType] of [
    ['pathNormalLot',  'normal'],
    ['pathSpreadLot',  'spread'],
    ['pathLmeLot',     'lme'],
    ['pathOptionsLot', 'options'],
  ] as const) {
    const rawPath = paths[key];
    if (!rawPath) continue;
    const resolved = resolveStoragePathCrossPlatform(resolveDynamicPath(rawPath, result.ngayGD));
    try {
      await writeCcpTypedLotToAccumulator(result, resolved, tradeType, jobLogs);
      lotUpdated = true;
    } catch (err: any) { errors.push(`Lỗi ${key}: ${err.message}`); }
  }

  // ── Phase 2 — GTGD ──────────────────────────────────────────────────────────
  for (const [key, tradeType] of [
    ['pathGtgdNormal',  'normal'],
    ['pathGtgdSpread',  'spread'],
    ['pathGtgdLme',     'lme'],
    ['pathGtgdOptions', 'options'],
  ] as const) {
    const rawPath = paths[key];
    if (!rawPath) continue;
    const resolved = resolveStoragePathCrossPlatform(resolveDynamicPath(rawPath, result.ngayGD));
    try {
      await writeCcpTypedValueToAccumulator(result, resolved, tradeType, jobLogs);
      gtgdUpdated = true;
    } catch (err: any) { errors.push(`Lỗi ${key}: ${err.message}`); }
  }

  // ── Phase 2 — Raw DSGD lũy kế ───────────────────────────────────────────────
  if (paths.pathDsgdCumulative && dsgdBuffer) {
    const resolved = resolveStoragePathCrossPlatform(
      resolveDynamicPath(paths.pathDsgdCumulative, result.ngayGD)
    );
    try {
      await appendCcpRawDsgd(dsgdBuffer, resolved, result.ngayGD, jobLogs);
    } catch (err: any) { errors.push(`Lỗi DsgdCumulative: ${err.message}`); }
  }

  return { lotUpdated, gtgdUpdated, errors };
}
```

---

## 5. CẬP NHẬT `getConfig()` VÀ `saveConfig()`

**File cần sửa**: [`ccp-lot-statistics.service.ts#L321-L368`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts#L321-L368)

Bổ sung 9 key mới vào `getConfig()` — thêm sau `pathGtgdNormal`:

```typescript
// Thêm vào object return của getConfig():
pathNormalCumulative:  p.pathNormalCumulative  || '',  // pathNormalLot
pathSpreadCumulative:  p.pathSpreadCumulative  || '',  // pathSpreadLot
pathLmeCumulative:     p.pathLmeCumulative     || '',  // pathLmeLot
pathOptionsCumulative: p.pathOptionsCumulative || '',  // pathOptionsLot
pathDsgdCumulative:    p.pathDsgdCumulative    || '',  // raw DSGD lũy kế
pathGtgdNormal:        p.pathGtgdNormal        || '',  //  Đã có key, cần chắc chắn map đúng
pathGtgdSpread:        p.pathGtgdSpread        || '',  // Mới
pathGtgdLme:           p.pathGtgdLme           || '',  // Mới
pathGtgdOptions:       p.pathGtgdOptions       || '',  // Mới
```

**Mapping key config → path trong `writeToAccumulator()`**:

| Key MongoDB (`getConfig()`) | Trường trong `CcpAccumulatorPaths` | File Lũy Kế |
| :--- | :--- | :--- |
| `pathAcmCumulative` | `pathAcmLot` | Thong ke so lot giao dich ACM |
| `pathNormalCumulative` | `pathNormalLot` | Thong ke so lot giao dich |
| `pathSpreadCumulative` | `pathSpreadLot` | Thong ke so lot giao dich Spread |
| `pathLmeCumulative` | `pathLmeLot` | Thong ke so lot giao dich LME |
| `pathOptionsCumulative` | `pathOptionsLot` | Thong ke so lot giao dich Options |
| `pathDsgdCumulative` | `pathDsgdCumulative` | DSGD T[MM].[YYYY] CCP |
| `pathGtgdAcm` | `pathAcmGtgd` | Thong ke gia tri giao dich ACM |
| `pathGtgdNormal` | `pathGtgdNormal` | Thong ke gia tri giao dich |
| `pathGtgdSpread` | `pathGtgdSpread` | Thong ke gia tri giao dich Spread |
| `pathGtgdLme` | `pathGtgdLme` | Thong ke gia tri giao dich LME |
| `pathGtgdOptions` | `pathGtgdOptions` | Thong ke gia tri giao dich Options |

---

## 6. CẬP NHẬT CONTROLLER

**File cần sửa**: [`ccp-statistics.controller.ts#L245-L295`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-statistics.controller.ts#L245-L295)

Bổ sung các path mới vào body type và mapping:

```typescript
// Request body type — thêm các path mới:
body: {
  ngayGD: string;
  pathAcmLot?: string;           // ✅ Đã có
  pathAcmGtgd?: string;          // ✅ Đã có
  pathNormalLot?: string;        // ❌ Thêm mới
  pathSpreadLot?: string;        // ❌ Thêm mới
  pathLmeLot?: string;           // ❌ Thêm mới
  pathOptionsLot?: string;       // ❌ Thêm mới
  pathDsgdCumulative?: string;   // ❌ Thêm mới
  pathGtgdNormal?: string;       // ❌ Thêm mới (đã có key config, chưa nhận từ body)
  pathGtgdSpread?: string;       // ❌ Thêm mới
  pathGtgdLme?: string;          // ❌ Thêm mới
  pathGtgdOptions?: string;      // ❌ Thêm mới
}

// Trong handler: tương tự cách resolve pathAcmLot, áp dụng cho 9 key mới
// Ưu tiên: body.pathXxx > config.pathXxxCumulative
```

---

## 7. HƯỚNG DẪN TẠO FILE TEMPLATE EXCEL MẪU (8 file cần tạo)

Trước khi code có thể ghi lũy kế, USER/BO cần tạo 8 file Excel mẫu:

| STT | Tên File | Sheet | Cấu Trúc Row 4 (Header) | Tham Chiếu Mẫu |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `Thong ke so lot giao dich [year].xlsx` | `T[MM].[YYYY]` | Cột 1: STT, Cột 2: Ngày, Cột 3-63: TVKD (001, 002...), "Tổng", Cột 66-90: SP (ZLE, ZCE...) | Copy template CQG hiện có |
| 2 | `Thong ke so lot giao dich Spread [year].xlsx` | `T[MM].[YYYY]` | Cột 1: STT, Cột 2: Ngày, Cột 3-63: TVKD, "Tổng", Cột 66-74: SP (ZSE, ZLE, ZCE, ZRE, XC, TRU, MHG, C.ZCE) | Giống Normal nhưng ít cột SP |
| 3 | `Thong ke so lot giao dich LME [year].xlsx` | `T[MM].[YYYY]` | Cột 1: STT, Cột 2: Ngày, Cột 3-63: TVKD, "Tổng", Cột 66-74: SP (CAD, AHD, PBD, SND, ZDS, NID, SSC, SSR, LHC) | 9 mã SP LME |
| 4 | `Thong ke so lot giao dich Options [year].xlsx` | `T[MM].[YYYY]` | Cột 1: STT, Cột 2: Ngày, Cột 3-63: TVKD, "Tổng", Cột 66-81: SP (C.ZCE, P.ZCE, C.ZSE...) | 16 mã SP Options |
| 5 | `Thong ke gia tri giao dich [year].xlsx` | `T[MM].[YYYY]` | Row 4: "Phiên GD", tên HH dài, "Tổng" \| Row 5: mã HH (ZLE, ZCE...) | Format giá trị VND, không có cột STT |
| 6 | `Thong ke gia tri giao dich Spread [year].xlsx` | `T[MM].[YYYY]` | Row 4: "Phiên GD", tên HH Spread, "Tổng" \| Row 5: mã SP Spread | 8 mã SP Spread |
| 7 | `Thong ke gia tri giao dich LME [year].xlsx` | `T[MM].[YYYY]` | Row 4: "Phiên GD", tên HH LME, "Tổng" \| Row 5: mã SP LME | 9 mã SP LME |
| 8 | `Thong ke gia tri giao dich Options [year].xlsx` | `T[MM].[YYYY]` | Row 4: "Phiên GD", tên HH Options, "Tổng" \| Row 5: mã SP Options | 16 mã SP Options |

> [!IMPORTANT]
> Các file mẫu có thể copy từ bộ template M-System đang dùng cho CQG và chỉnh sửa tiêu đề cột để phù hợp với CCP. Đặc biệt cần đảm bảo:
> - Sheet tháng đầu tiên đặt tên đúng dạng `T[MM].[YYYY]` (ví dụ: `T09.2026`)
> - Header dòng 4 phải có mã TVKD 3 số đúng theo danh sách FCM của CCP
> - Header dòng 5 (file GTGD) phải chứa đúng mã SP (`ZLE`, `ZCE`...)

---

## 8. CẤU TRÚC DATA FLOW ĐẦY ĐỦ SAU PHASE 2

```
INPUT CCP (5 file):
  DSGD.csv (required) ──→ dsgdCcp: Buffer
  DSL_MM.csv (opt)    ──→ dsgdMmCcp: Buffer
  TTM.csv (opt)       ──→ ttm: Buffer
  TTTT.csv (opt)      ──→ tttt: Buffer
  Tỷ giá.xlsx (opt)   ──→ tyGia: Buffer

processCcpLotStatistics() ──→ CcpLotResult:
  byTvkd[]: { tvkd, accountType, soLot, giaTri, byHH[], ttmMua, ttmBan, kltt }
  classified: { acm[], spread[], lme[], normal[], options[] }

writeToAccumulator(result, paths, dsgdBuffer):
  [Phase 1 - đã có]
  ├─ writeCcpLotToAccumulator()    → pathAcmLot   → Thong ke so lot ACM.xlsx    ✅
  └─ writeCcpGtgdToAccumulator()   → pathAcmGtgd  → Thong ke gia tri ACM.xlsx   ✅

  [Phase 2 - cần làm]
  ├─ writeCcpTypedLotToAccumulator('normal')   → pathNormalLot    → ...giao dich [year].xlsx
  ├─ writeCcpTypedLotToAccumulator('spread')   → pathSpreadLot    → ...giao dich Spread.xlsx
  ├─ writeCcpTypedLotToAccumulator('lme')      → pathLmeLot       → ...giao dich LME.xlsx
  ├─ writeCcpTypedLotToAccumulator('options')  → pathOptionsLot   → ...giao dich Options.xlsx
  ├─ appendCcpRawDsgd()                        → pathDsgdCumulative→ DSGD T[MM].[YYYY] CCP.xlsx
  ├─ writeCcpTypedValueToAccumulator('normal') → pathGtgdNormal   → ...gia tri giao dich.xlsx
  ├─ writeCcpTypedValueToAccumulator('spread') → pathGtgdSpread   → ...gia tri Spread.xlsx
  ├─ writeCcpTypedValueToAccumulator('lme')    → pathGtgdLme      → ...gia tri LME.xlsx
  └─ writeCcpTypedValueToAccumulator('options')→ pathGtgdOptions  → ...gia tri Options.xlsx
```

---

## 9. KẾ HOẠCH KIỂM THỬ

### 9A. Unit Test Logic

| Test Case | Input | Kết Quả Kỳ Vọng |
| :--- | :--- | :--- |
| `writeCcpTypedLotToAccumulator('normal')` với result có TK normal | CcpLotResult có byTvkd[0].accountType = 'normal' | File Normal Lot được cập nhật, các TK ACM (-A) bị loại |
| `writeCcpTypedValueToAccumulator('lme')` với gtgdByHh có CAD | CcpLotResult có hh.maHH = 'CAD' | Cột CAD trong file LME GTGD có giá trị, cell M1 = null |
| `writeToAccumulator()` khi path không cấu hình | `paths.pathNormalLot = undefined` | Không throw lỗi, tiếp tục xử lý các path khác |
| `writeToAccumulator()` khi file template chưa tồn tại | `paths.pathNormalLot = 'D:/xxx.xlsx'` (file không có) | Throw `Error` rõ ràng, `errors[]` chứa message, không crash toàn bộ |

### 9B. Integration Test

1. Chạy `processAndSaveCcpStatistics()` với `updateCumulative: true` và đủ 9 path
2. Kiểm tra: 11 file lũy kế đều được cập nhật (timestamp `mtime` thay đổi)
3. Mở từng file Excel: xác nhận row ngày được ghi đúng, số liệu khớp với log
4. Chạy lại lần 2 cùng ngày: giá trị được ghi đè (upsert), không thêm dòng trùng lặp

### 9C. Build Verification

```bash
# Sau khi sửa code, chạy kiểm tra:
npx tsc --noEmit
npm run build
```

---

## 10. CHANGELOG CẦN GHI KHI TRIỂN KHAI

```markdown
## [v?.?.?] — DD/MM/YYYY
### Phase 2: Thống kê Lot & GTGD CCP — 9 file lũy kế mới

**File tác động**:
- `ccp-accumulator.helper.ts`: Mở rộng CcpAccumulatorPaths (+9 path);
   Thêm writeCcpTypedLotToAccumulator(), writeCcpTypedValueToAccumulator(), appendCcpRawDsgd()
- `ccp-lot-statistics.service.ts`: Cập nhật writeToAccumulator() gọi Phase 2;
   Cập nhật getConfig()/saveConfig() nhận 9 key mới
- `ccp-statistics.controller.ts`: Bổ sung body nhận 9 path mới

**Trước**: 2 file lũy kế (AcmLot + AcmGtgd)
**Sau**: 11 file lũy kế (2 Phase 1 + 9 Phase 2)

**Xác nhận Build**: `npx tsc --noEmit` ✅
```

---

> [!CAUTION]
> **Điều kiện tiên quyết bắt buộc trước khi triển khai**:
> 1. CCP phải có tài khoản Spread/LME/Normal active (kiểm tra với CCP team)
> 2. USER/BO phải tạo sẵn 8 file Excel template (xem mục 7) và đặt vào đường dẫn đã cấu hình
> 3. Build TypeScript pass không lỗi
> 4. `filterTvkdByType()` chỉ viết được sau khi `CcpTvkdStat` có thêm trường `accountType`
