# TỔNG HỢP TOÀN DIỆN LOGIC CHECK EOD & QUÉT ÂM KÝ QUỸ (M-SYSTEM & CORECCP)

Tài liệu này được biên soạn nhằm lưu vết ngữ cảnh chuẩn xác 100% dựa trên mã nguồn thực tế và đối chiếu với Tool C# gốc (`operate-transaction-app`). Dùng làm căn cứ kỹ thuật để bảo trì, cập nhật và nâng cấp nghiệp vụ đối chiếu EOD và âm ký quỹ.

---

## 1. Bản Đồ Thành Phần Kiến Trúc (Architecture & File Mapping)

```
                            [User / Web UI / Autonomous Scheduler]
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
       [Phân hệ M-System (MS)]                             [Phân hệ CoreCCP (CCP)]
                    │                                                   │
  ┌─────────────────┴─────────────────┐               ┌─────────────────┴─────────────────┐
  ▼                                   ▼               ▼                                   ▼
[klgd-recon.controller.ts]    [eod-ms.worker.ts]   [trading-ops-misc.controller]  [ccp-eod.worker.ts]
  │ (API Test/Auto)             │ (Bot Worker)        │ (API Run)                    │ (Bot Worker)
  └───────────────┬───────────────────┘               └─────────────────┬─────────────────┘
                  ▼                                                     ▼
      [ms-eod-recon.service.ts]                             [ccp-eod.service.ts]
                  │                                                     │
                  └─────────────────────────┬───────────────────────────┘
                                            ▼
                               [margin-excel.parser.ts]
                             (Parser Excel/CSV dùng chung)
                                            │
                        ┌───────────────────┴───────────────────┐
                        ▼                                       ▼
            QLTKGD.xlsx / QLTTTKGD_CCP                  eod.csv / EOD_CCP.xlsx
           -> negativeBalanceAccs                      -> negativeIMRAcc
```

### Bảng tra cứu tệp nguồn & Trách nhiệm:

| Phân hệ / Vai trò | Đường dẫn mã nguồn | Lớp / Hàm phụ trách chính |
| :--- | :--- | :--- |
| **MS Controller** | [`klgd-recon.controller.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/controllers/klgd-recon.controller.ts) | `runTestLocal()`, `runAutoReconciliation()` |
| **MS Worker** | [`eod-ms.worker.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/workers/eod-ms.worker.ts) | `EodMsWorker` (`capabilityType = 'CHECK_EOD_MS'`) |
| **MS Recon Service** | [`ms-eod-recon.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/services/recon/ms-eod-recon.service.ts) | `getPreviousTradingSession()`, `runAutoCheckEodMs()`, `checkEOD()` |
| **CCP Worker** | [`ccp-eod.worker.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/workers/ccp-eod.worker.ts) | `CcpEodWorker` (`capabilityType = 'CCP_EOD_RECON'`) |
| **CCP Recon Service** | [`ccp-eod.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/services/recon/ccp-eod.service.ts) | `checkEODCCP()`, `runAutoCheckEodCcp()` |
| **Core Parser** | [`margin-excel.parser.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/parsers/margin-excel.parser.ts) | `parseQltkgd()`, `parseEodMargin()` |
| **Quét Ký Quỹ Rời** | [`margin-checker.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/services/recon/margin-checker.service.ts) & [`negative-margin.worker.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/workers/negative-margin.worker.ts) | `scanNegativeMarginAccounts()`, `checkNegativeMargin()` |
| **C# Ground Truth** | [`TransactionCheckingService.cs`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/TransactionCheckingService.cs) | `CheckEOD()` (L480-L555) |

---

## 2. Chi Tiết Logic Nhận Diện Âm Ký Quỹ (Negative Margin Logic)

Hệ thống quản lý **2 loại âm ký quỹ/số dư khác nhau**:

### Loại 1: Âm Số Dư Tiền Mặt Hiện Tại (`negativeBalanceAccs`)
* **Nguồn tệp**: `QLTKGD.xlsx` (MS) hoặc `QLTTTKGD_CCP.xlsx` (CCP).
* **Vị trí trích xuất**: [`MarginExcelParser.parseQltkgd#L236-L239`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/parsers/margin-excel.parser.ts#L236-L239).
* **Cột dữ liệu**: *Số dư TKKQ hiện tại* (tìm theo header: `Số dư TKKQ hiện tại`, `Số dư hiện tại`, `Current Balance`...).
* **Điều kiện nhận diện**:
  $$\text{balanceVal} < 0$$
* **Ý nghĩa**: Tài khoản có số dư tiền mặt ký quỹ thực tế bị âm.

---

### Loại 2: Âm Ký Quỹ Khả Dụng Mới (`negativeIMRAcc` / IMR)
* **Nguồn tệp**: `eod.csv` / `eod.*.csv` (MS) hoặc `EOD_CCP.xlsx` (CCP).
* **Vị trí trích xuất**: [`MarginExcelParser.parseEodMargin#L393-L406`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/parsers/margin-excel.parser.ts#L393-L406).
* **Căn cứ C# Ground Truth**: [`TransactionCheckingService.cs#L491`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/TransactionCheckingService.cs#L491).
* **Điều kiện bắt buộc (6 điều kiện đồng thời)**:
  ```ts
  const isNegativeIMR =
    initialRequiredMargin === 0 &&     // Ký quỹ ban đầu = 0
    estimatedProfitVND === 0 &&        // Lãi lỗ dự kiến VND = 0
    optionsEstimatedProfitVND === 0 && // Lãi lỗ quyền chọn = 0
    netMargin === availableMargin &&   // Ký quỹ ròng = Ký quỹ khả dụng
    availableMargin < 0 &&             // Ký quỹ khả dụng < 0
    additionalMargin > 0;              // Mức bổ sung ký quỹ > 0
  ```
* **Ý nghĩa**: Nhận diện chính xác tài khoản không có vị thế mở nhưng bị âm ký quỹ khả dụng và yêu cầu nộp bổ sung ký quỹ (IMR).

---

## 3. Khác Biệt Giữa Cơ Chế Lọc Tài Khoản Âm Của MS vs CoreCCP

| Cơ chế | M-System (`eod-ms.worker.ts`) | CoreCCP (`ccp-eod.service.ts` & `ccp-eod.worker.ts`) |
| :--- | :--- | :--- |
| **Cách xử lý tài khoản âm cũ** | Lọc qua cấu hình tĩnh: `negative_margin_monitored_accounts` trong bảng `system_settings`. Nếu tài khoản nằm trong danh sách này thì **bỏ qua không cảnh báo**. | **So sánh động với phiên T-2**: Tự động tìm và đọc file EOD của ngày phiên trước đó (T-2), so sánh danh sách âm. Nếu tài khoản đã âm ở phiên trước thì đưa vào `ignoredAccounts` và **chỉ cảnh báo tài khoản âm MỚI phát sinh**. |
| **Nguồn nạp file EOD** | Thư mục `Backup MS\Futures\...`. Nếu thiếu $\rightarrow$ Tự kích hoạt lấy file EOD từ hòm thư Outlook M365 (`reconPipeline.fetchEodEmail`). | Thư mục `Backup CCP\Futures\...` (`09_*.xlsx` hoặc `EOD_*.xlsx`). |

---

## 4. Công Thức Đối Chiếu Số Dư EOD (Balance Reconciliation)

Cả hai phân hệ đều so sánh **Số dư tính toán lại từ các cấu phần giao dịch** với **Số dư chốt cuối ngày trong file EOD**:

### Công thức chung (Chuẩn 100% C# `TransactionCheckingService.cs#L528-L534`):
$$\text{CalculatedBalance} = \text{SốDưĐầuNgày} + \text{NộpRút} - \text{PhíGD} - \text{PhíDVTT} + \text{TotalProfitVND}$$

Trong đó:
1. **Quy tắc áp Tỷ giá Thanh toán (Payment Exchange Rates)**:
   - Nếu $(\text{PhíQC} + \text{LãiLỗUSD}) < 0 \rightarrow$ Áp tỷ giá Mua (Buy Rate), ngược lại áp tỷ giá Bán (Sell Rate).
   - Nếu $\text{LãiLỗJPY} < 0 \rightarrow$ Áp tỷ giá Mua JPY, ngược lại áp tỷ giá Bán JPY.
   - Nếu $\text{LãiLỗMYR} < 0 \rightarrow$ Áp tỷ giá Mua MYR, ngược lại áp tỷ giá Bán MYR.
2. **`TotalProfitVND`**:
   - Nếu báo cáo `QLTKGD` đã có sẵn cột *Lãi lỗ thực tế Futures (VND)*: Ưu tiên lấy trực tiếp.
   - Nếu chưa có: Quy đổi ngoại tệ:
     $$\text{TotalProfitVND} = (\text{PhíQC} + \text{LãiLỗUSD}) \times \text{TỷGiáUSD} + \text{LãiLỗJPY} \times \text{TỷGiáJPY} + \text{LãiLỗMYR} \times \text{TỷGiáMYR}$$
3. **Ngưỡng chấp nhận sai lệch (Tolerance Threshold)**:
   $$\text{differ} = |\text{EODBalance} - \text{CalculatedBalance}| \ge 1.000\text{ VNĐ}$$
   *(Nếu sai lệch $\ge 1.000$ VNĐ mới ghi nhận vào danh sách `mismatchedEOD`)*.

---

## 5. Các Điểm Cần Lưu Ý Khi Cập Nhật / Refactor

1. **Không tự ý sửa công thức 6 điều kiện IMR**:
   - Công thức `initialRequiredMargin == 0 && ... && additionalMargin > 0` là chuẩn nghiệp vụ đã được kiểm chứng từ tool C# và vận hành thực tế nhiều năm.
2. **Phí Dịch Vụ Thanh Toán CCP**:
   - Trong CCP, phí DVTT bắt buộc lấy từ cột *Phí dịch vụ thanh toán (VND)* của file `QLTTTKGD_CCP.xlsx`. Tuyệt đối không lấy từ file `TTTT_CCP.xlsx` vì sẽ làm lệch số dư 6,993 VNĐ (0.27 USD) do CoreCCP không trừ khoản này vào EOD Balance.
3. **Múi giờ & Phiên T-1**:
   - Luôn sử dụng `getPreviousTradingSession()` kết hợp `WorkingCalendarService` để bỏ qua các ngày nghỉ lễ/Tết khi xác định phiên T-1 cần check EOD.

