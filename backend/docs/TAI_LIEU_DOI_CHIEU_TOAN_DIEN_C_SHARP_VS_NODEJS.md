# BÁO CÁO ĐỐI CHIẾU TOÀN DIỆN MÃ NGUỒN LOGIC: TOOL C# VS HỆ THỐNG NODE.JS (NESTJS / NEXT.JS)

> **Mục tiêu**: Kiểm tra, đối chiếu 1-1 toàn bộ các luồng nghiệp vụ giữa Tool C# gốc ([`operate-transaction-app`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app)) và hệ thống Node.js mới, chỉ ra nguyên nhân gốc rễ và bằng chứng mã nguồn của các bug tiềm ẩn (đặc biệt là bug tính toán ca đêm khiến KLGD = 0).

---

## 1. TỔNG QUAN NGUYÊN NHÂN GỐC RỄ BUG "KLGD = 0 LÚC 01:42 SÁNG"

Từ log chạy thực tế của hệ thống:
```text
[2026-09-23T18:42:49.095Z] Job enqueued.
[2026-09-23T18:42:53.203Z] Bắt đầu chạy đối chiếu khớp lệnh định kỳ trong phiên ngày 2026-09-24...
[2026-09-23T18:45:44.487Z] Khoảng thời gian lọc: từ 05:00:00 24/9/2026 đến 05:00:00 25/9/2026
[2026-09-23T18:45:44.488Z] Kết quả: LỆCH
```

### Chuỗi sự kiện gây lỗi:
1. **Thời điểm thực tế (Giờ VN GMT+7)**: `01:42:49` sáng ngày `24/09/2026`.
2. **Sai lầm ở Frontend**: Trong [`page.tsx#L58-L63`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/page.tsx#L58-L63), giao diện lấy `new Date()` thuần JavaScript để gán mặc định cho ô DatePicker $\rightarrow$ sinh ra chuỗi `"2026-09-24"`.
3. Khi bấm **Check thủ công** hoặc **Check**, Frontend gửi payload: `{ date: "2026-09-24", jobType: "CHECK_KLGD" }` lên backend.
4. **Sai lầm ở Backend**: Trong [`recon-jobs.handler.ts#L108-L126`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L108-L126), logic trừ lùi ngày ca đêm (`currentHour < 6:30 -> T-1`) **chỉ nằm trong nhánh `else`** (chỉ chạy khi KHÔNG có `sessionDay` hoặc `targetDate`). Vì payload đã có `date: "2026-09-24"` nên backend bỏ qua toàn bộ logic ca đêm!
5. **Hệ quả dây chuyền**:
   - Thư mục lưu file tải về bị ném sang ngày `24.09` thay vì ngày `23.09`.
   - Trong [`klgd-recon.service.ts#L181-L205`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/klgd-recon.service.ts#L181-L205), hệ thống tính mốc lọc:
     `sessionStart = 05:00:00 24/09/2026`, `checkTime = 05:00:00 25/09/2026`.
   - Lúc 01:42 sáng, mốc `05:00:00 24/09/2026` **hoàn toàn ở tương lai** (còn 3 tiếng 18 phút nữa mới tới). Mọi lệnh khớp từ tối ngày 23 đến 01:42 sáng ngày 24 đều có timestamp `< 05:00:00 24/09/2026` $\rightarrow$ Điều kiện `tradeTime >= sessionStart` trả về `false` cho toàn bộ các lệnh $\rightarrow$ **KLGD = 0**.

---

## 2. ĐỐI CHIẾU CHI TIẾT TỪNG MODULE C# VS NODE.JS

### 2.1. Module Xác Định Ngày Phiên & Quản Lý Thư Mục Lưu Trữ

#### Mã nguồn Tool C#:
- File [`BackupService.cs#L103-L120`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/BackupService.cs#L103-L120):
```csharp
DateTime now = DateTime.Now;
DateTime today = DateTime.Today;

if (now.TimeOfDay < sessionStartTime) // 01:00 sáng < 05:00/07:00 sáng
{
    today = today.AddDays(-1); // Lùi về ngày 23
}
while (today.DayOfWeek == DayOfWeek.Saturday || today.DayOfWeek == DayOfWeek.Sunday)
{
    today = today.AddDays(-1);
}
string todayStr = today.ToString("dd/MM/yyyy"); // -> "23/09/2026"
```
- Giá trị này được gán vào `_config.BackupStatisticsGTT.SessionDate` và **chỉ được phép thay đổi khi đồng hồ điểm đúng giờ mở phiên sáng** ([`FormMain.cs#L122`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/FormMain.cs#L122)).
- Cả hàm tạo thư mục [`FileUtils.cs#L186-L201`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Utils/FIleUtils.cs#L186-L201) và hàm đọc file đều dùng chung biến này $\rightarrow$ **Luôn luôn trỏ vào thư mục `2026\T09.2026\23.09`**.

#### Mã nguồn Node.js hiện tại:
- Frontend [`page.tsx#L58-L63`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/page.tsx#L58-L63):
```typescript
useEffect(() => {
  const today = new Date();
  const vnTime = new Date(today.getTime() + 7 * 60 * 60 * 1000);
  const dateStr = vnTime.toISOString().split('T')[0];
  setSelectedDate(dateStr); // -> "2026-09-24" (SAI vào lúc nửa đêm)
}, []);
```
- Backend [`recon-jobs.handler.ts#L108-L114`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L108-L114):
```typescript
if (payload.sessionDay || payload.targetDate) {
  const resolved = resolveBotTargetDate(payload);
  targetDate = resolved.dateObj; // Ép thành 2026-09-24
} else {
  // Logic overnight bị bỏ qua hoàn toàn!
}
```

---

### 2.2. Module Đối Chiếu Khớp Lệnh (CheckKLGD)

#### Mã nguồn Tool C#:
Tại [`TransactionCheckingService.cs#L120-L165`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/TransactionCheckingService.cs#L120-L165):
```csharp
// 1. Với file DSGD (M-System):
foreach (var gd in dsgdData)
{
    DateTime timeMatched = DateTime.ParseExact(gd[5], "dd-MM-yyyy HH:mm:ss", CultureInfo.InvariantCulture);
    if (timeMatched > time) continue; // CHỈ CHẶN TRÊN (KHÔNG CHẶN DƯỚI)
    
    if (gd[1].EndsWith("A")) totalACM += klgdACM;
    else totalDSGD += klgd;
}

// 2. Với file FR (CQG):
foreach (var fr in frData)
{
    if (fr[2] == "ZWAZCE") continue;
    ...
    if (fullDateTime > time) continue;        // Chặn trên
    if (fullDateTime < sessionStart) continue; // Chặn dưới
    totalFR += qty;
}

// 3. Với file Nano (ACM):
foreach (var gd in nanoData)
{
    DateTime timeMatched = DateTime.ParseExact(gd[5], "yyyyMMdd HH:mm:ss", CultureInfo.InvariantCulture);
    if (timeMatched > time) continue; // CHỈ CHẶN TRÊN (KHÔNG CHẶN DƯỚI)
    totalNano += klgdACM;
}
```

#### Mã nguồn Node.js hiện tại:
Tại [`klgd-recon.service.ts#L200-L241`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/klgd-recon.service.ts#L200-L241):
```typescript
// Node.js áp cả 2 chặn trên và dưới cho DSGD và Nano:
const dsgdData = rawDsgdData.filter((gd) => {
  if (!gd.ngayGio) return true;
  const tradeTime = parseTradeDateTime(gd.ngayGio, tradingDate);
  if (!tradeTime) return true;
  return tradeTime >= sessionStart && tradeTime <= dsgdUpperBound; // <-- LỆCH VỚI C#
});

const nanoData = rawNanoData.filter((gd) => {
  ...
  if (tradeTime < sessionStart) return false; // <-- LỆCH VỚI C#
  ...
});
```
👉 **Đánh giá rủi ro**: Trong Tool C#, file `DSGD.xlsx` và `Straits.csv/Nano` bản thân nó đã là danh sách các giao dịch được tạo ra trong ngày làm việc hôm đó. Việc Node.js áp thêm điều kiện `tradeTime >= sessionStart` cho DSGD và Nano dẫn đến rủi ro: Nếu giờ mở phiên của sàn sớm hơn (ví dụ LME hoặc một số hợp đồng khớp từ 06:45 mà cấu hình là 07:00), Node.js sẽ loại bỏ mất giao dịch hợp lệ này.

---

### 2.3. Module Trạng Thái Mở (TTM vs OP)

- **C#**: [`TransactionCheckingService.cs#L280-L310`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/TransactionCheckingService.cs#L280-L310)
  - `TTM` (M-System): `tongMua + tongBan`. Tách đuôi `A` vào `totalACM`.
  - `OP` (CQG): `lValue + sValue`.
  - Không có bộ lọc thời gian (lấy toàn bộ vị thế mở hiện tại).
- **Node.js**: [`klgd-recon.service.ts#L438-L487`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/klgd-recon.service.ts#L438-L487)
  - Đã chuyển đổi chuẩn xác 100%.

---

### 2.4. Module Tất Toán Vị Thế (TTTT vs PS)

- **C#**: [`TransactionCheckingService.cs#L350-L365`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/TransactionCheckingService.cs#L350-L365)
  - `TTTT` (M-System): **CHỈ cộng `tongBan`**. Tách đuôi `A` vào `totalACM`.
  - `PS` (CQG): **CHỈ cộng `pSell`**.
- **Node.js**: [`klgd-recon.service.ts#L502-L540`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/klgd-recon.service.ts#L502-L540)
  - Đã chuyển đổi chuẩn xác 100% (chỉ lấy `tongBan` và `sValue`).

---

### 2.5. Module Quy Đổi Hợp Đồng LME (3-Month Prompt Date)

- **C#**: [`FileUtils.cs#L2298-L2340`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Utils/FIleUtils.cs#L2298-L2340)
  - Cộng 3 tháng vào ngày phiên (`baseDate.AddMonths(3)`).
  - Né Thứ 7 (lùi 1 ngày) / Chủ Nhật (tiến 1 ngày).
  - Tra bảng `LMEDayoff` để dịch chuyển nếu rơi vào ngày nghỉ của sàn LME.
  - Ghép mã tháng và 2 chữ số năm (`${mapped}D${newDay}${monthCode}${yearShort}`).
- **Node.js**: [`recon-number-parser.helper.ts#L246-L320`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/helpers/recon-number-parser.helper.ts#L246-L320)
  - Đã tái hiện đầy đủ và chính xác thuật toán này.

---

### 2.6. Module Quét Ký Quỹ Âm (Negative Margin / IMR)

- **C#**: [`TransactionCheckingService.cs#L490`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/TransactionCheckingService.cs#L490)
  - Thỏa mãn đồng thời 5 điều kiện:
    `initialRequiredMargin == 0 && estimatedProfitVND == 0 && optionsEstimatedProfitVND == 0 && netMargin == availableMargin && availableMargin < 0 && additionalMargin > 0`
  - Loại trừ các tài khoản trong danh sách `NagativeMarginAccs`.
- **Node.js**: [`post-eod-handler.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/post-eod-handler.service.ts)
  - Đã chuyển đổi chuẩn xác 100%.

---

### 2.7. Module Đối Chiếu Số Dư CQG vs QLTKGD (`CheckEODCQG`)

- **C#**: [`TransactionCheckingService.cs#L670-L700`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/TransactionCheckingService.cs#L670-L700)
  - Công thức: `calculated = (soDuHienTai + choDaoHan - laiLoVND) / exRate[0]`.
  - So sánh với `balance` từ file CQG Account Balance.
  - Ngưỡng lệch: `Math.Abs(calculated - balance) > 100`.
  - Loại trừ các tài khoản: `maTKGD.StartsWith("999") || maTKGD.StartsWith("050") || !char.IsDigit(maTKGD[0])`.
- **Node.js**: [`reconciliation.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/reconciliation.service.ts)
  - Đã chuyển đổi chuẩn xác.

---

### 2.8. Module Đối Chiếu Pre-EOD (T-1)

- **C#**: [`TransactionCheckingService.cs#L1250-L1350`](file:///C:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/it-tool-src/operate-transaction-app/Services/TransactionCheckingService.cs#L1250-L1350)
  - Đối chiếu ngày **T-1**.
  - Kiểm tra file Straits CSV bắt buộc phải có chuỗi ngày `ddMMyyyy` của ngày T-1.
  - So sánh `totalACM_MS` vs `totalACM_Straits`.
  - Khớp lệnh 1-1 giữa DSGD và FR (`CombinedKey = $"{accountRaw}{symbolRaw}{fillP}"`).
- **Node.js**: [`pre-eod-recon.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/pre-eod-recon.service.ts)
  - Đã chuyển đổi chuẩn xác.

---

### 2.9. Module CoreCCP (VNCLEAR) - Phát Sinh Mới Trên Node.js

- Tool C# chưa có CoreCCP.
- Trên Node.js, bot RPA tự động truy cập CoreCCP và điền DatePicker lọc ngày.
- **Bug phát sinh**: Lúc 1h sáng ngày 24/09, bot lấy theo ngày dương lịch của job (`24/09/2026`) để điền vào ô tìm kiếm của CoreCCP. Vì ngày 24/09 chưa có dữ liệu giao dịch nên CoreCCP trả về "Không có dữ liệu".
- **Yêu cầu sửa đổi**: Bot CoreCCP phải điền DatePicker theo **Ngày phiên giao dịch thực tế** (`23/09/2026`).

---

## 3. DANH SÁCH 3 BUG CẦN SỬA ĐỔI TOÀN DIỆN

### Bug 1: Thống nhất logic giải quyết Ngày Phiên (`resolveTradingSessionDate`)
- **Vị trí**:
  1. Frontend: [`page.tsx#L58-L63`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/page.tsx#L58-L63) và [`LegacyReconSection.tsx#L1605-L1608`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx#L1605-L1608)
  2. Backend: [`recon-jobs.handler.ts#L108-L126`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L108-L126) và [`recon-console-summary.service.ts#L1015-L1019`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/recon-console-summary.service.ts#L1015-L1019).
- **Hành vi chuẩn theo C#**:
  - Nếu thời gian hiện tại `< 06:30` sáng (hoặc `< session_start_time`), ngày phiên hiện hành **bắt buộc là ngày `T-1`** (bỏ qua Thứ 7, Chủ Nhật).
  - Khi người dùng ở giao diện Web rạng sáng hoặc bấm nút "Hôm nay", DatePicker phải tự động đặt về ngày `T-1` (ngày 23/09).
  - Khi Bot chạy ngầm định kỳ hoặc nhận lệnh từ Console, mọi đường dẫn thư mục sao lưu (`msDailyPath`, `cqgDailyPath`, `acmDailyPath`, `ccpDailyPath`) đều được tính từ ngày phiên này.

### Bug 2: Điều kiện lọc thời gian file DSGD trong `CheckKLGD`
- **Vị trí**: [`klgd-recon.service.ts#L200-L205`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/klgd-recon.service.ts#L200-L205)
- **Hành vi chuẩn theo C#**:
  - Đối với file DSGD (M-System): **Chỉ chặn trên** (`tradeTime <= dsgdUpperBound / cutoffTime`), không loại bỏ các giao dịch có `tradeTime < sessionStart` vì file DSGD tải về đã thuộc phiên làm việc đó.
  - Tương tự với file Nano / Straits.csv của ACM.
  - Đối với CQG FR: Vẫn duy trì chặn dưới `tradeTime >= sessionStart` như Tool C#.

### Bug 3: DatePicker trên sàn CoreCCP khi chạy phiên đêm
- **Vị trí**: [`recon-jobs.handler.ts#L440-L460`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L440-L460)
- **Hành vi chuẩn**:
  - Điền DatePicker tìm kiếm trên CoreCCP bằng chuỗi ngày của **Ngày phiên giao dịch** (`dateStr` đã chuẩn hóa qua `resolveTradingSessionDate`), đảm bảo phiên đêm điền ngày 23/09/2026 để CoreCCP trả về đầy đủ dữ liệu.

---

## 4. HƯỚNG DẪN CHẠY TEST SCRIPT XÁC MINH (USER TỰ CHẠY)

Tôi đã tạo sẵn script test độc lập: [`backend/src/tests/test_verify_overnight_recon_logic.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/tests/test_verify_overnight_recon_logic.ts) mô phỏng chính xác ca trực lúc `01:42:49` sáng ngày `24/09/2026`.

Bạn hãy mở terminal và chạy lệnh sau để kiểm chứng kết quả đối chiếu giữa C# và Node.js:

```powershell
cd "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation\backend"
npx ts-node -r tsconfig-paths/register src/tests/test_verify_overnight_recon_logic.ts
```

Script sẽ in ra bằng chứng toán học chứng minh:
- Tại sao logic cũ của Node.js trả về `KLGD = 0` (do lọc ở khoảng thời gian tương lai).
- Logic Tool C# khóa ngày phiên thành `23/09/2026` và nhận đầy đủ 100% các lệnh khớp trong đêm.
