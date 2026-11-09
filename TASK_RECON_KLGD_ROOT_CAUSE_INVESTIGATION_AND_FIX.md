# BÁO CÁO ĐIỀU TRA NGUYÊN NHÂN GỐC RỄ & KẾ HOẠCH XỬ LÝ (ROOT CAUSE TASK)
## Tác Vụ: Đối Chiếu Khớp Lệnh Trong Phiên (CHECK_KLGD)

> **Mã tác vụ:** `TASK-RECON-KLGD-01`  
> **Phân hệ:** `trading-ops` & `ingress`  
> **Đối tượng:** Đối chiếu 4 nguồn (M-System, CQG, Straits ACM, CoreCCP VNclear)  
> **Môi trường điều tra:** Server Ubuntu Native `10.0.0.26` (PM2 Service: `mxv-backend`, MongoDB: `mxv_shift_checklist`)  
> **Ngày lập báo cáo:** 04/11/2026  

---

## 1. Tổng Quan Sự Cố & Phân Định Hai Hiện Tượng Khác Nhau

Trong phiên giao dịch ngày 03/11/2026, bot đối chiếu khớp lệnh trong phiên (`CHECK_KLGD`) đã ghi nhận 2 sự cố báo lệch số liệu:

| Sự Cố | Thời điểm & Job ID | Triệu chứng cảnh báo | Bản chất kỹ thuật | Kết luận |
| :--- | :--- | :--- | :--- | :--- |
| **Sự cố 1** | **22:07:05 03/11/2026**<br>`ID: 6ae9f899f4de057626355884` | `Lệch CQG=0, Lệch ACM=2689, Lệch khớp lệnh=0`<br>(CoreCCP hiển thị `0` / `null`) | **Race Condition ghi đè file đĩa mạng SMB** (`/mnt/qlgd-it/`) làm file ZIP bị dở dang $\rightarrow$ Parser XLSX ném `Unsupported ZIP Compression method NaN`. | **Lệch ảo** do nuốt lỗi parser CoreCCP. |
| **Sự cố 2** | **04:45 & 04:58 04/11/2026**<br>`ID: 6aea55dc...` (04:45)<br>`ID: 6aea58ec...` (04:58) | `Lệch CQG=0, Lệch ACM=93` (04:45)<br>`Lệch CQG=0, Lệch ACM=94` (04:58)<br>(CoreCCP đọc đủ 2,962 và 2,963 lots) | **Dòng lọc `tradeTime < sessionStart` tự ý thêm vào** (vốn không có trong tool C# gốc dòng 165). | **Lệch ảo** do loại bỏ oan 53 lệnh (94 lots) phát sinh sau 24:00 đêm. |

---

## 2. Chi Tiết Sự Cố 1: Job 22:07 (Lệch Ảo 2,689 lots do Race Condition SMB)

### 2.1. Dẫn chứng từ Log PM2 thực tế trên máy chủ Ubuntu `10.0.0.26`
Tại mốc thời gian `10:08:39 PM` (15:08:39 UTC), log PM2 của máy chủ ghi nhận cảnh báo tại dòng 428040 / 428315:
```text
[Nest] 3906925 - 11/03/2026, 10:08:39 PM WARN [KlgdReconService] [Recon] Lỗi parse DSGD CoreCCP: Unsupported ZIP Compression method NaN
```

### 2.2. Cơ chế phát sinh lỗi
1. **Trùng lặp luồng tải**: Tại mốc `10:07:30 PM`, có 2 luồng cùng kích hoạt tải CoreCCP đồng thời (Job định kỳ `CHECK_KLGD` và API `GET /api/v1/trading-ops/executive-dashboard?refresh=true`).
2. **Ghi đè trực tiếp (Non-Atomic Write)**:
   - Trong `coreccp-api.adapter.ts#L576-L583`, adapter dùng lệnh `fs.writeFileSync(targetPath, buffer)` ghi đè trực tiếp lên tệp `DSGD CCP.xlsx` trên thư mục mạng `/mnt/qlgd-it/`.
   - File `.xlsx` là kho lưu trữ nén ZIP; thao tác `writeFileSync` trên ổ đĩa mạng SMB làm file bị truncate về 0 bytes và stream từng chunk buffer.
3. **Đọc tệp dở dang**:
   - Đúng tích tắc file đang stream ghi dở, tiến trình đối soát gọi `fs.readFileSync(dsgdCcpPath)`.
   - Thư viện `xlsx` đọc header ZIP dở dang, giải mã compression method ra `NaN` và ném lỗi: `Unsupported ZIP Compression method NaN`.
4. **Nuốt lỗi và gán `undefined`**:
   - Khối `try/catch` tại `klgd-recon.service.ts#L485-L498` bắt lỗi này, khiến biến `totalCCP_DSGD` giữ nguyên giá trị `undefined` (trên DB lưu là `null`).
5. **Hệ quả đối soát**:
   - Toàn bộ 2,689 lots Bạc Nano đối trừ với CoreCCP không được bù trừ:
     $$\text{evaluatedDifferACM} = |\text{totalNano} (2689) - \text{totalACM} (0)| = 2689$$
   - Bot thông báo cảnh báo ảo: `Phát hiện lệch: Lệch CQG=0, Lệch ACM=2689, Lệch khớp lệnh=0`.

---

## 3. Chi Tiết Sự Cố 2: 2 Job 04:45 & 04:58 (Lệch Ảo 93 và 94 lots do Lọc Nhầm Lệnh Xuyên Đêm)

### 3.1. Dữ liệu trích xuất trực tiếp từ CSDL MongoDB trên máy chủ
- **Job lúc 04:45 (ID: `6aea55dc25ead5abb3071e9a`)**:
  - `totalDSGD`: 5,515 | `totalFR`: 5,515 (`differ = 0`)
  - `totalNano`: 2,869 | `totalACM`: 0
  - `totalCCP_DSGD`: 2,962
  - `differACM`: $2,962 - 2,869 = \mathbf{93\ lots}$!
- **Job lúc 04:58 (ID: `6aea58ec25ead5abb3071ea5`)**:
  - `totalDSGD`: 5,517 | `totalFR`: 5,517 (`differ = 0`)
  - `totalNano`: 2,869 | `totalACM`: 0
  - `totalCCP_DSGD`: 2,963
  - `differACM`: $2,963 - 2,869 = \mathbf{94\ lots}$!

### 3.2. Dữ liệu thực tế đối soát 1,805 dòng trong file gốc `Fill.xls`
Phân tích toàn bộ file `Fill.xls` lưu tại `/mnt/qlgd-it/.../Backup ACM/Futures/2026/T11.2026/03.11/`:
```text
- Các lệnh phát sinh trước 24:00 (Trade Date: 20261103): 1,752 lệnh  -> Khối lượng: 2,869 lots
- Các lệnh phát sinh sau 24:00 (Trade Date: 20261104):     53 lệnh  -> Khối lượng:    94 lots (lúc 04:45 là 93 lots)
----------------------------------------------------------------------------------------------------------------
=> TỔNG KHỐI LƯỢNG THỰC TẾ TRONG FILE FILL.XLS:                     ->             2,963 lots
=> TỔNG KHỐI LƯỢNG THỰC TẾ TRONG FILE DSGD CCP.XLSX:                 ->             2,963 lots
=> CHÊNH LỆCH THỰC TẾ GIỮA HAI BÊN:                                 ->                 0 lots (KHỚP TUYỆT ĐỐI)
```

---

## 4. Đối Soát Trực Tiếp Với Mã Nguồn C# Gốc & Logic "ACM Quên Cắt Lệnh"

### 4.1. Tool C# gốc xử lý thế nào?
Kiểm chứng trực tiếp tại `TransactionCheckingService.cs#L158-L172`:
```csharp
foreach (var gd in nanoData)
{
    DateTime timeMatched = DateTime.ParseExact(
        gd[5],
        "yyyyMMdd HH:mm:ss",
        CultureInfo.InvariantCulture
    );
    if (timeMatched > time) // CHỈ LỌC MỐC CHẶN TRÊN (checkTime)
    {
        continue;
    }

    if (decimal.TryParse(gd[3], out decimal klgdACM))
        totalNano += klgdACM;
}
```
- **Tool C# gốc HOÀN TOÀN KHÔNG có điều kiện `if (timeMatched < sessionStart) continue;` đối với Nano!**
- Khi chạy rạng sáng (`time` = `04:58` ngày `04/11`), `timeMatched` = `2026-11-03 04:47:06` < `2026-11-04 04:58:00`.
- Điều kiện `timeMatched > time` là `false` $\rightarrow$ **C# không bỏ qua bất kỳ lệnh nào, tính trọn vẹn 100% file!**

### 4.2. Cơ chế "ACM quên cắt lệnh / chưa cắt phiên" trong mã nguồn hiện tại
Đoạn code do User xây dựng trước đây **VẪN CÒN NGUYÊN VẸN** tại `klgd-recon.service.ts#L270-L296`:
```typescript
let acmSessionAnomaly = false;
let acmAnomalyNote = '';

if (totalNano === 0 && totalACM > 0 && rawNanoData.length > 0) {
  const candidates = rawNanoData.filter((gd) => {
    if (!gd.tradeDateStr) return false;
    const tradeTime = parseTradeDateTime(gd.tradeDateStr, tradingDate);
    if (!tradeTime) return false;
    if (tradeTime < sessionStart) return false;
    return tradeTime <= checkTime;
  });

  if (candidates.length > 0) {
    acmSessionAnomaly = true;
    let recheckLots = 0;
    candidates.forEach((c) => {
      recheckLots += c.klGiaoDich;
    });

    acmAnomalyNote = `[ACM CHƯA CẮT PHIÊN] Phát hiện sàn ACM chưa cắt phiên kế toán. Đã tự động đối soát theo Trade Date: ghi nhận ${recheckLots} lots Nano.`;
    this.logger.warn(`[Recon KLGD] ${acmAnomalyNote}`);

    nanoData.length = 0;
    nanoData.push(...candidates);
    totalNano = recheckLots;
  }
}
```
- Vẫn bảo lưu trọn vẹn, không chỉnh sửa.

---

## 5. Kế Hoạch Xử Lý Triệt Để (Clean 100%, Ground Truth Thực Nghiệm)

### Điểm 1: Chuẩn Hóa Ngày Khớp Lệnh Thực Tế (Trade Date) Cho ACM Nano
- **Vị trí**: [`backend/src/modules/trading-ops/parsers/straits-csv.parser.ts#L107-L121`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/parsers/straits-csv.parser.ts#L107-L121)
- **Thực hiện**:
  File `Fill.xls` từ sàn ACM Web ETP có 2 cột ngày:
  - `Trading Day`: Phiên kế toán của sàn (`20261103` cho mọi lệnh của phiên, kể cả lệnh xuyên đêm sau 24:00).
  - `Trade Date`: Ngày khớp lệnh thực tế (`20261103` cho các lệnh trước 24:00 và `20261104` cho các lệnh sau 24:00).
  Nếu chỉ dùng `Trading Day`, lệnh khớp lúc 04:47 AM ngày 04/11 bị gán nhãn `2026-11-03 04:47:06` (biến thành sáng hôm trước).
  Do đó, parser ưu tiên lấy `Trade Date`:
  ```typescript
  const effectiveDate = tradeDateVal || ngay;
  ngayGio: `${effectiveDate} ${gio}`,
  ```
  Nhờ đó:
  - Lệnh sau 24:00 mang đúng ngày `2026-11-04 04:47:06`.
  - Bộ lọc vừa kiểm tra được `sessionStart` (`06:00:00 03/11`) để chặn các lệnh rác của phiên trước, vừa kiểm tra được `checkTime` chính xác tuyệt đối mà không bị đếm nhầm lệnh xuyên đêm vào ca tối hôm trước!

### Điểm 2: Cơ Chế Atomic File Write & Chống Nuốt Lỗi (Zero-Silent-Swallow)
- **Vị trí**:
  - [`backend/src/modules/ingress/adapters/coreccp-api.adapter.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ingress/adapters/coreccp-api.adapter.ts)
  - [`backend/src/modules/ingress/adapters/ms-api.adapter.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ingress/adapters/ms-api.adapter.ts)
  - [`backend/src/modules/trading-ops/services/recon/klgd-recon.service.ts#L494-L498`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/recon/klgd-recon.service.ts#L494-L498)
- **Thực hiện**:
  1. **Atomic Write**: Khi lưu file qua mạng SMB `/mnt/qlgd-it/`, luôn ghi buffer ra file tạm `.tmp` trước, sau khi ghi hoàn tất 100% mới thực hiện `fs.renameSync` sang file chính thức:
  ```typescript
  const tmpPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).substring(7)}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, targetPath);
  ```
  2. **Fail-Fast**: Khi parse file CoreCCP gặp sự cố, cập nhật `ccpStatus = 'FAILED'` và cảnh báo rõ ràng thay vì nuốt lỗi âm thầm rồi giả định CoreCCP = 0.

### Điểm 3: Cơ Chế Fallback Loại Trừ File Rỗng Do Rollover
- **Vị trí**: [`backend/src/modules/trading-ops/services/recon/klgd-recon.service.ts#L684-L700`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/recon/klgd-recon.service.ts#L684-L700)
- **Thực hiện**:
  Sàn ACM rollover lúc 05:20 AM làm file `TradingCheck/ACM/Futures/.../Fill.xls` bị xuất file rỗng 4,608 bytes (0 lệnh).
  Cơ chế tìm kiếm file `resolveAcmFile` tự động kiểm tra dung lượng: Ưu tiên chọn file có dữ liệu (> 5,000 bytes) từ thư mục `Backup ACM`, tránh bị ghi đè bởi file rỗng.

---

## 6. Kết Quả Kiểm Thử Thực Tế Toàn Diện Sau Khi Fix

Chạy test runner thực nghiệm trực tiếp trên máy chủ Ubuntu `10.0.0.26` đọc các tệp dữ liệu thật phiên 03/11 trên ổ mạng SMB `/mnt/qlgd-it/`:

| Kịch Bản Kiểm Thử | Mốc Thời Gian (Cutoff) | MS (totalDSGD) | CQG (totalFR) | Lệch CQG | CoreCCP (totalCCP) | Nano ACM | Lệch ACM | Kết Quả |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Test 1: Ca Tối (Job 22:07)** | `2026-11-03 22:07:00` | 4,472 lots | 4,472 lots | **0** | 2,689 lots | 2,689 lots | **0** | **PASSED 100%** |
| **Test 2: Rạng Sáng (Job 04:45)** | `2026-11-04 04:45:00` | 5,515 lots | 5,515 lots | **0** | 2,962 lots | 2,962 lots | **0** | **PASSED 100%** |
| **Test 3: Chốt Phiên (Job 04:58)** | `2026-11-04 04:58:00` | 5,517 lots | 5,517 lots | **0** | 2,963 lots | 2,963 lots | **0** | **PASSED 100%** |

### Xác Nhận Build Hệ Thống
- **Backend**: `nest build` thành công 100% (Exit code 0).
- **Frontend**: `next build` thành công 100% (Exit code 0, 52/52 routes).
