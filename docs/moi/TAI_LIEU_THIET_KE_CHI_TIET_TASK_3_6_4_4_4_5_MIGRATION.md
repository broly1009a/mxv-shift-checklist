# TÀI LIỆU THIẾT KẾ CHI TIẾT: NHÓM TASK NGUYÊN TỬ KẾ TIẾP

## Task 3.6 + Task 4.4 + Task 4.5 — Di Dời Logic V1 Sang Domain V2 (Strangler Fig)

---

> **Mã tài liệu**: `MXV-DESIGN-TASK-3.6-4.4-4.5-2026-V1`
> **Ngày ban hành**: 14/10/2026
> **Phiên bản**: 1.0
> **Tài liệu cha**: [KE_HOACH_TONG_CHUYEN_DOI_MODULAR_MONOLITH_ATOMIC_TASKS.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/KE_HOACH_TONG_CHUYEN_DOI_MODULAR_MONOLITH_ATOMIC_TASKS.md)
> **Nguyen tac bat bien**: Bao toan 100% logic V1. Strangler Fig — V1 giu nguyen signature, ben trong uy quyen sang V2. KHONG lam gian doan he thong dang chay.

---

## 1. BOI CANH & MUC TIEU

Sau khi hoan thanh Phase 3.1-3.5 (Trading-Ops core) va Phase 4.1-4.3 (CCP Clearing Lot), ba task tiep theo theo dung thu tu lo trinh la:

| Thu tu | Task         | Mo ta ngan                        | V1 Source                                                       | V2 Target                                           |
| :----: | :----------- | :-------------------------------- | :-------------------------------------------------------------- | :-------------------------------------------------- |
| **1**  | **Task 3.6** | Di doi `DsgdBeforeEodService`     | `reconciliation/services/dsgd-before-eod.service.ts` (314 dong) | `trading-ops/services/dsgd-before-eod.service.ts`   |
| **2**  | **Task 4.4** | Xay dung `ValueStatisticsService` | `reconciliation/services/ccp-recon.service.ts` (logic ty gia)   | `ccp-clearing/services/value-statistics.service.ts` |
| **3**  | **Task 4.5** | Di doi `CcpEodService`            | `reconciliation/services/ccp-recon.service.ts` (1189 dong)      | `ccp-clearing/services/ccp-eod.service.ts`          |

---

## 2. TASK 3.6: DI DOI `DsgdBeforeEodService` VAO `trading-ops`

### 2.1. Phan Tich Code V1 (Ground Truth)

Doc truc tiep tu [`reconciliation/services/dsgd-before-eod.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/dsgd-before-eod.service.ts) (314 dong):

| Thanh phan                               | Mo ta                                            | Logic Bat Buoc Bao Ton                                                                                                                  |
| :--------------------------------------- | :----------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------- |
| **Interface `CheckDSGDBeforeEODResult`** | Kieu tra ve chuan                                | `{ passed, totalOriginal, totalTemp, totalACMMS, totalACMSFTP, differTotal, differACM, messages, sessionDate, timeSuffix, filesFound }` |
| **`calculatePreviousSessionDate()`**     | Tinh ngay T-1, bo qua T7+CN                      | Logic `while (d.getDay() === 0                                                                                                          |     | d.getDay() === 6)` — bat buoc giu nguyen |
| **`checkDSGDBeforeEODFromBuffers()`**    | Doi chieu tu Buffer (API Upload)                 | `parseDSGD()`, `parseStraitsCsv()`, thuat toan loc tai khoan `.endsWith('A')` cho ACM, lam tron 4 chu so thap phan                      |
| **`runAutoCheckDSGDBeforeEOD()`**        | Tu dong quet tu thu muc Backup                   | `getMsBackupBase()`, `getAcmBackupBase()`, nhan dien file DSGD snapshot `DSGD{timeSuffix}.xlsx`                                         |
| **Nguong chenh lech**                    | `differTotal <= 0.0001` && `differACM <= 0.0001` | Nguong nay la chuan C# — KHONG duoc tu y thay doi                                                                                       |

### 2.2. Kho Logic Nguy Hiem Can Dac Biet Chu Y

```typescript
// LOGIC 1: Loc tai khoan ACM theo hau to 'A' (Dac thu nghiep vu MXV)
const acc = String(gd.maTKGD || "")
  .trim()
  .toUpperCase();
if (acc.endsWith("A")) {
  totalACMMS += kl;
}

// LOGIC 2: Lam tron 4 chu so thap phan de tranh loi floating point
totalOriginal = Math.round(totalOriginal * 10000) / 10000;
totalACMMS = Math.round(totalACMMS * 10000) / 10000;
const differTotal =
  Math.round(Math.abs(totalOriginal - totalTemp) * 10000) / 10000;
const differACM =
  Math.round(Math.abs(totalACMMS - totalACMSFTP) * 10000) / 10000;

// LOGIC 3: Nhan dien file ACM Straits — Pattern chuan, khong duoc mo rong
const matched =
  acmFiles.find(
    (f) =>
      /straits/i.test(f) &&
      f.includes(`${day}${month}${year}`) &&
      f.endsWith(".csv"),
  ) || acmFiles.find((f) => /straits/i.test(f) && f.endsWith(".csv")); // Fallback 1 cap

// LOGIC 4: Tim file DSGD snapshot linh hoat -> DSGD*.xlsx moi nhat
const candidates = files
  .filter(
    (f) =>
      /^DSGD.+\.xlsx$/i.test(f) &&
      !f.startsWith("~$") &&
      f.toLowerCase() !== "dsgd.xlsx",
  )
  .sort((a, b) => b.mtime - a.mtime);
```

### 2.3. Ke Hoach Trien Khai (3 Buoc)

**Buoc 1**: Tao file V2 moi tai `backend/src/modules/trading-ops/services/dsgd-before-eod.service.ts`

- Di chuyen NGUYEN TRANG toan bo code tu V1
- KHONG import `RpaDownloaderService` vao V2 (De Dispatcher xu ly o Pha 5)
- Them prefix logger: `[V2-DsgdBeforeEod]`

**Buoc 2**: Dang ky vao `trading-ops.module.ts`

```typescript
providers: [
  CqgMergerService, KlgdReconService, DsgdBeforeEodReconService,
  MarginCheckerService, TradingOpsConfigService,
  DsgdBeforeEodService,   // THEM MOI
],
exports: [..., DsgdBeforeEodService],  // EXPORT de Facade V1 inject duoc
```

**Buoc 3**: Chuyen `reconciliation/services/dsgd-before-eod.service.ts` thanh Facade uy quyen:

```typescript
@Injectable()
export class DsgdBeforeEodService {
  constructor(private readonly v2Service: TradingOpsDsgdBeforeEodService) {}

  public checkDSGDBeforeEODFromBuffers(files, options) {
    return this.v2Service.checkDSGDBeforeEODFromBuffers(files, options);
  }
  public async runAutoCheckDSGDBeforeEOD(options?) {
    return this.v2Service.runAutoCheckDSGDBeforeEOD(options);
  }
  public calculatePreviousSessionDate(inputDate?) {
    return this.v2Service.calculatePreviousSessionDate(inputDate);
  }
}
```

### 2.4. Tieu Chuan Nghiem Thu (DoD)

- [ ] `npm run build` -> Exit code 0
- [ ] API `POST /api/v1/reconciliation/check-dsgd-before-eod` voi file upload thuc te -> Tra ve ket qua dung
- [ ] `runAutoCheckDSGDBeforeEOD()` tu bot -> Tim file va tinh toan giong het V1 (Sai so = 0)
- [ ] Khong co loi Circular Dependency khi khoi dong NestJS

---

## 3. TASK 4.4: XAY DUNG `ValueStatisticsService` & `CcpValueWorker`

### 3.1. Phan Tich Code V1 (Ground Truth)

**Nguon**: [`reconciliation/services/ccp-recon.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/ccp-recon.service.ts) (1189 dong, 48.75KB) — Ham `getCurrentExchangeRates()` dong 47-132.

**Kho Logic Bat Buoc Bao Ton**:

```typescript
// LOGIC TY GIA: Uu tien lop mat tran da tien te
// Uu tien 1: setting 'ccp_exchange_rates_matrix' (JSON object day du)
// Fallback 1: 'ccp_usd_exchange_rate', 'ccp_myr_exchange_rate', 'ccp_jpy_exchange_rate', 'ccp_rmb_exchange_rate'
// Fallback 2: 'usd_exchange_rate', 'myr_exchange_rate', ... (cau hinh M-System)
// Fallback 3: Gia tri mac dinh an toan (USD=23000, MYR=5200, JPY=155, RMB=3200)

// LOGIC GIA TRI: Cong thuc tu CCP-Statistics-Tool/ExcelDataService.cs
// Gia tri VND = So Lot x Buoc gia hop dong x Ty gia USD->VND
// Rieng JPY: Gia tri VND = So Lot x Buoc gia / 100 x Ty gia JPY->VND
//             (Do JPY niem yet theo 100 Yen)
```

### 3.2. Interface Chuan `ValueStatisticsService`

```typescript
export interface CcpExchangeRates {
  usdLoss: number;
  usdGain: number;
  myrLoss: number;
  myrGain: number;
  jpyLoss: number;
  jpyGain: number;
  rmbLoss: number;
  rmbGain: number;
}

export interface CcpTransactionValueResult {
  sessionDate: string;
  totalLots: number;
  totalValueVnd: number;
  breakdownByProduct: Array<{
    product: string; // Ma hang hoa (DCE_A, SHFE_CU, ...)
    lots: number;
    valueVnd: number;
    currency: "USD" | "MYR" | "JPY" | "RMB";
    exchangeRate: number;
  }>;
  rates: CcpExchangeRates;
}
```

### 3.3. Cau Truc File V2 Can Tao

```
backend/src/modules/ccp-clearing/
├── services/
│   ├── lot-statistics.service.ts     [DA CO]
│   ├── ccp-clearing-config.service.ts [DA CO]
│   └── value-statistics.service.ts   <- TAO MOI (Task 4.4)
└── workers/
    └── ccp-value.worker.ts           <- TAO MOI (Task 4.4)
```

**`CcpValueWorker`** — implement `IBotWorker`:

```typescript
@Injectable()
export class CcpValueWorker implements IBotWorker {
  readonly botCheckType = "CHECK_CCP_VALUE"; // Data-driven, khong hardcode Task ID

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    // 1. Lay ty gia (ValueStatisticsService)
    // 2. Doc file CCP tu duong dan dong (SystemSettingsService)
    // 3. Tinh gia tri VND
    // 4. Luu log vao ccp_clearing_logs
    // 5. Tra ve TaskExecutionResult chuan
  }
}
```

### 3.4. Tieu Chuan Nghiem Thu (DoD)

- [ ] `npm run build` -> Exit code 0
- [ ] Unit test: Tinh gia tri voi ty gia co dinh -> Khop 100% voi output Excel macro C# goc
- [ ] Worker tu dang ky voi `BotDispatcherService` (OnModuleInit) theo `botCheckType = 'CHECK_CCP_VALUE'`
- [ ] Log duoc ghi vao `ccp_clearing_logs` collection MongoDB

---

## 4. TASK 4.5: DI DOI LOGIC DOI SOAT CCP EOD VAO `ccp-clearing`

### 4.1. Phan Tich Code V1 (Ground Truth)

**Nguon**: [`reconciliation/services/ccp-recon.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/ccp-recon.service.ts) (1189 dong, 48.75KB)

Day la service phuc tap nhat vi:

- Dung `forwardRef()` voi 3 service: `CcpCeDownloaderService`, `EmailWatcherService`, `MarginCheckerService`
- Co `getCurrentExchangeRates()` (se tach sang `ValueStatisticsService` o Task 4.4)
- Co logic doi soat EOD CCP thuc su

**Logic chinh can boc tach sang `ccp-eod.service.ts`**:

```
1. checkEODCCP()         — Doi chieu ky quy CCP vs MS cuoi ngay (EODMismatchedItem[])
2. runAutoCheckEodCcp()  — Tu dong quet file va chay doi chieu
3. parseBalanceSheet()   — Boc tach bang can doi ky quy CoreCCP tu Excel
```

### 4.2. Kho Logic Nguy Hiem Bat Buoc Bao Ton

```typescript
// LOGIC 1: Thuat toan so khop IMR (Initial Margin Requirement) giua MS va CCP
// Sai lech: |MS_Balance - CCP_Balance| > threshold(0.01 VND)
// EODMismatchedItem: { system: 'MS' | 'CCP', maTKGD, calculatedBalance, eodBalance, differ }

// LOGIC 2: Chuan hoa so du tien mat — xu ly ky tu phan cach khac nhau
// Mot so file CCP dung dau phay thap phan (European format), can normalize

// LOGIC 3: Tim file CCP theo resolveCcpDailyPath() va resolveTradingCheckCcpDailyPath()
// Hai duong dan doc lap: CCP Backup goc va TradingCheck (da copy qua)
// Uu tien TradingCheck neu ton tai — Fallback ve CCP Backup goc

// LOGIC 4: Phan loai chenh lech theo loai tai khoan (F=Futures, O=Options, P=Proprietary)
```

### 4.3. Cau Truc File V2 Can Tao

```
backend/src/modules/ccp-clearing/
├── services/
│   ├── lot-statistics.service.ts      [DA CO - Task 4.1]
│   ├── value-statistics.service.ts    [Task 4.4 - PHAI XONG TRUOC]
│   └── ccp-eod.service.ts             <- TAO MOI (Task 4.5)
└── workers/
    ├── ccp-lot.worker.ts              [DA CO - Task 4.2]
    ├── ccp-value.worker.ts            [Task 4.4 - PHAI XONG TRUOC]
    └── ccp-eod.worker.ts             <- TAO MOI (Task 4.5)
```

> **PHU THUOC BAT BUOC**: Task 4.5 PHAI sau Task 4.4 vi `CcpEodService` inject `ValueStatisticsService`.

### 4.4. Facade V1 Sau Khi Di Doi

Sau khi Task 4.5 hoan thanh, `reconciliation/services/ccp-recon.service.ts` se tro thanh Facade mong:

- Toan bo signature public giu nguyen
- Ben trong chi goi `this.ccpEodServiceV2.method()`
- V1 van la source of truth cho controllers/handlers cu
- V2 la noi chua toan bo logic nghiep vu thuc su

### 4.5. Tieu Chuan Nghiem Thu (DoD)

- [ ] `npm run build` -> Exit code 0
- [ ] `runAutoCheckEodCcp()` tu V1 Facade -> Ket qua doi chieu giong het V1 (Sai so = 0)
- [ ] `CcpEodWorker` tu dang ky voi `BotDispatcherService` theo `botCheckType = 'CHECK_EOD_CCP'`
- [ ] Khong con `forwardRef()` nao trong `ccp-clearing` module
- [ ] Log duoc ghi vao `ccp_clearing_logs` collection MongoDB

---

## 5. MA TRAN PHU THUOC (DEPENDENCY MATRIX)

```
[NHOM TASK DANG TRIEN KHAI - XANH DUONG]
  Task 3.6 (DsgdBeforeEodService V2)
    -> Task 4.4 (ValueStatisticsService V2)
        -> Task 4.5 (CcpEodService V2)

[NHOM TASK TIEP THEO - TIM]
            -> Task 2.6 (Ingress Facade noi V1)
                -> Task 5.2 (Go forwardRef)
                    -> Task 5.3 (Task Hierarchy Helper)

[NHOM TASK CUOI - CAM]
                        -> Task 6.1 (Atomic Queue Lock)
                            -> Task 6.3 (Twin-Run E2E Validation)
```

---

## 6. CHECKLIST KIEM TRA TRUOC KHI BAT DAU MOI TASK

Theo Quy tac "Bai Test Tu Kiem Tra Bat Buoc" (AGENTS.md Section 7.2.5):

**Cau hoi 1**: "Neu Admin tao Template moi voi ID ngau nhien, module nay co tu nhan dien khong?"

- Task 3.6: Khong dung bat ky Task ID cung nao [PASS]
- Task 4.4: Worker dang ky qua `botCheckType = 'CHECK_CCP_VALUE'` (data-driven) [PASS]
- Task 4.5: Worker dang ky qua `botCheckType = 'CHECK_EOD_CCP'` (data-driven) [PASS]

**Cau hoi 2**: "Toan bo logic tai chinh co duoc chuyen nguyen trang khong?"

- Moi thuat toan deu trich dan file nguon V1 lam Ground Truth [PASS]

---

## 7. KET QUA KY VONG SAU KHI HOAN THANH 3 TASKS NAY

| Task                     | Truoc     | Sau        |
| :----------------------- | :-------- | :--------- |
| Task 3.6                 | TIEP THEO | HOAN THANH |
| Task 4.4                 | TIEP THEO | HOAN THANH |
| Task 4.5                 | TIEP THEO | HOAN THANH |
| **Tong Task Hoan Thanh** | **17/27** | **20/27**  |
| **Tong Task Con Lai**    | **10**    | **7**      |

**Trang thai kien truc sau 3 tasks nay**:

- `trading-ops` domain: HOAN CHINH (6/6 tasks xong)
- `ccp-clearing` domain: HOAN CHINH (5/5 tasks xong)
- `ingress` domain: 80% (Task 2.6 con cho)
- `checklist-hub` domain: 33% (Task 5.2, 5.3 con cho)
- `multi-instance` & `sunsetting`: 0% (Task 6.1, 6.3 — ke hoach cuoi)
