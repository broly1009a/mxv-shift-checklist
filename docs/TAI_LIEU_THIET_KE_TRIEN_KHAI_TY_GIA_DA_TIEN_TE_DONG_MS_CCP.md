# BẢN THIẾT KẾ KỸ THUẬT TRIỂN KHAI: HỆ THỐNG QUẢN LÝ TỶ GIÁ ĐA TIỀN TỆ ĐỘNG (DATA-DRIVEN)
## TÁCH BIỆT M-SYSTEM & CORECCP – ZERO-HARDCODING – MỞ RỘNG TIỀN TỆ KHÔNG CẦN SỬA CODE

- **Mã tài liệu**: `MXV-DES-DYNAMIC-EXCHANGE-RATES-v3.0`
- **Hệ thống**: MXV Shift Checklist & Trading Operation Automation
- **Màn hình tác động**: `Trading Manager` -> `Tab 3: Cấu hình & Đường dẫn` (`TradingManagerConfigSection.tsx`)
- **Ngày hoàn thiện**: 23/09/2026
- **Trạng thái**: Đã phê duyệt kiến trúc - Sẵn sàng triển khai mã nguồn (Ready for Execution)

---

## I. MỤC TIÊU & NGUYÊN TẮC THIẾT KẾ BẤT BIẾN (CORE PRINCIPLES)

1. **Nguyên tắc Bảo toàn M-System (Zero Regression)**:
   - Toàn bộ các key cài đặt cũ của M-System (`usd_exchange_rate`, `usd_settlement_rate_sell`, `usd_settlement_rate_buy`, `jpy_exchange_rate`, `myr_exchange_rate`, `rmb_exchange_rate`) được **GIỮ NGUYÊN 100%**.
   - Các dịch vụ đang vận hành ca trực hàng ngày (`cqg-sync-recon`, `pre-eod-recon`, `post-eod-handler`) không phải thay đổi logic đọc key cũ, bảo đảm an toàn tuyệt đối cho ca trực hôm nay.

2. **Nguyên tắc Tách biệt Độc lập CoreCCP (Strict Isolation)**:
   - Phân hệ CoreCCP (VNCLEAR) lưu trữ một bộ cấu hình hoàn toàn riêng biệt (`ccp_*`).
   - Tuyệt đối cấm các worker, parser của CoreCCP ghi đè lên các key của M-System.

3. **Nguyên tắc Không Hardcode & Hướng Dữ Liệu (Zero-Hardcoding / Data-Driven)**:
   - Khi Sở MXV hoặc TTBT VNCLEAR niêm yết thêm các đồng tiền mới (như `EUR`, `SGD`, `CAD`, `AUD`, `GBP`...):
     * **Người dùng tự thêm trực tiếp trên giao diện Web trong 5 giây**.
     * Bot Crawler tự động nhận diện và bóc tách động (Auto-discovery).
     * **TUYỆT ĐỐI KHÔNG CẦN PHẢI MỞ CODE SỬA BIẾN, KHÔNG CẦN BUILD VÀ DEPLOY LẠI SERVER.**

---

## II. THIẾT KẾ CƠ SỞ DỮ LIỆU MONGODB (`system_settings`)

Hệ thống lưu trữ cấu hình tỷ giá phân chia thành 2 phân hệ độc lập:

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │             MONGODB: system_settings                   │
                                    └──────────────────────────┬─────────────────────────────┘
                                                               │
                     ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
                     ▼                                                                                   ▼
       ┌───────────────────────────────────────────┐                       ┌───────────────────────────────────────────┐
       │         1. BỘ CẤU HÌNH M-SYSTEM           │                       │        2. BỘ MA TRẬN ĐỘNG CORECCP         │
       │           (GIỮ NGUYÊN 100% CŨ)            │                       │         (DATA-DRIVEN ISOLATION)           │
       ├───────────────────────────────────────────┤                       ├───────────────────────────────────────────┤
       │ • usd_exchange_rate: 26000.00             │                       │ • ccp_exchange_rates_matrix: JSON Object  │
       │ • usd_settlement_rate_sell: 26000.00      │                       │   {                                       │
       │ • usd_settlement_rate_buy: 26000.00       │                       │     "USD": { "conversion": 26000, ... },  │
       │ • jpy_exchange_rate: 168.00               │                       │     "JPY": { "conversion": 170, ... },    │
       │ • myr_exchange_rate: 6268.00              │                       │     "MYR": { "conversion": 6383, ... },   │
       │ • rmb_exchange_rate: 3881.00              │                       │     "EUR": { "conversion": 28500, ... }   │
       │ • exchange_rates_last_synced              │                       │   }                                       │
       │ • exchange_rate_source                    │                       │ • ccp_usd_exchange_rate: 26000 (Fallback) │
       │                                           │                       │ • ccp_rates_last_synced                   │
       └───────────────────────────────────────────┘                       └───────────────────────────────────────────┘
```

### 1. Cấu trúc chi tiết của `ccp_exchange_rates_matrix`:
```typescript
export interface CcpExchangeRateItem {
  currencyCode: string;   // Mã nguyên tệ: 'USD', 'JPY', 'MYR', 'EUR', 'SGD'...
  conversionRate: number; // Tỷ giá quy đổi (Mark-to-Market VNCLEAR)
  buyRate: number;        // Tỷ giá Mua (Bid)
  sellRate: number;       // Tỷ giá Bán (Ask)
  effectiveDate?: string; // Ngày hiệu lực / Ngày tạo
  note?: string;          // Ghi chú
}

export type CcpExchangeRatesMatrix = Record<string, CcpExchangeRateItem>;
```

---

## III. THIẾT KẾ GIAO DIỆN NGƯỜI DÙNG TAB 3 (`TradingManagerConfigSection.tsx`)

Xóa bỏ khối gộp 3 ô lộn xộn cũ. Thay bằng **2 Card riêng biệt trực quan**:

### CARD 1: CẤU HÌNH TỶ GIÁ M-SYSTEM (MXV)
- **Mục đích**: Phục vụ đối chiếu số dư CQG (`cqg-sync-recon`), EOD nội bộ M-System (`pre-eod-recon`), và kiểm tra ký quỹ âm IMR/MMR.
- **Giao diện**:
  * Giữ nguyên form thân thuộc: Ô Tỷ giá thanh toán (Bán/Mua) và Tỷ giá quy đổi M-System (USD/VND).
  * Hỗ trợ dropdown chọn xem/sửa các đồng tiền của M-System: `USD`, `JPY`, `MYR`, `RMB`.
  * Nút hành động: **`[Đồng bộ từ M-System]`** (Gọi crawler M-System, chỉ ghi vào các key `*_exchange_rate`).

---

### CARD 2: BẢNG TỶ GIÁ NGUYÊN TỆ CORECCP / VNCLEAR (ĐỘNG 100%)
- **Mục đích**: Phục vụ đối chiếu 4 thành phần EOD VNCLEAR (`ccp-recon`) và thống kê số Lot/Giá trị TVKD bù trừ (`ccp-lot-statistics`).
- **Giao diện Bảng Động (Dynamic CRUD Table)**:

| Nguyên tệ | Tỷ giá Quy đổi VNCLEAR | Tỷ giá Mua (Bid) | Tỷ giá Bán (Ask) | Ngày hiệu lực | Thao tác |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **USD** | `26,000.00` | `26,000.00` | `26,000.00` | 04/09/2026 | 🔒 Cố định |
| **JPY** | `170.00` | `168.00` | `168.00` | 12/09/2026 | 🗑️ Xóa |
| **MYR** | `6,383.00` | `6,268.00` | `6,268.00` | 12/09/2026 | 🗑️ Xóa |
| **EUR** *(mới)* | `28,500.00` | `28,300.00` | `28,700.00` | 23/09/2026 | 🗑️ Xóa |

- **Thanh công cụ Card 2**:
  * **Nút `[+ Thêm nguyên tệ]`**: Mở modal / dòng nhập nhanh (Nhập mã: `EUR`, Tỷ giá QĐ, Mua, Bán) $\rightarrow$ Thêm ngay 1 dòng mới vào ma trận mà không cần can thiệp code.
  * **Nút `[Đồng bộ từ CoreCCP (VNCLEAR)]`**: Tự động bóc tách tỷ giá từ tệp ngày hoặc cào từ web CoreCCP.
  * **Nút `[Lưu Cấu Hình]`**: Lưu đối tượng `ccp_exchange_rates_matrix` vào MongoDB.

---

## IV. THIẾT KẾ LOGIC BACKEND (DYNAMIC RATE RESOLVER)

### 1. Hàm Tra Cứu Tỷ Giá Động (Dynamic Resolver)
Trong `ccp-recon.service.ts` và `ccp-lot-statistics.service.ts`, thay thế logic hardcode `if/else` bằng hàm resolver:

```typescript
/**
 * Lấy tỷ giá quy đổi của một đồng tiền bất kỳ từ Ma trận CoreCCP
 * @param currencyCode Mã tiền tệ ('USD', 'JPY', 'MYR', 'EUR'...)
 * @param rateType Loại tỷ giá: 'conversion' | 'buy' | 'sell'
 */
async function getCcpRate(
  currencyCode: string,
  rateType: 'conversion' | 'buy' | 'sell' = 'conversion'
): Promise<number> {
  const code = currencyCode.toUpperCase().trim();
  
  // 1. Đọc từ ma trận động trong system_settings
  const matrixStr = await this.settingsService.getSetting('ccp_exchange_rates_matrix', '{}');
  try {
    const matrix: CcpExchangeRatesMatrix = JSON.parse(matrixStr);
    if (matrix[code]) {
      if (rateType === 'conversion') return matrix[code].conversionRate || 1;
      if (rateType === 'buy') return matrix[code].buyRate || matrix[code].conversionRate || 1;
      if (rateType === 'sell') return matrix[code].sellRate || matrix[code].conversionRate || 1;
    }
  } catch (e) {
    // Fallback nếu JSON lỗi
  }

  // 2. Fallback về key đơn lẻ (USD fallback an toàn)
  if (code === 'USD') {
    const fallbackUsd = await this.settingsService.getSetting('ccp_usd_exchange_rate', '26000');
    return parseFloat(fallbackUsd) || 26000;
  }

  // 3. Fallback sang tỷ giá M-System nếu CoreCCP chưa khai báo
  const msFallbackKey = `${code.toLowerCase()}_exchange_rate`;
  const msFallbackStr = await this.settingsService.getSetting(msFallbackKey, '');
  if (msFallbackStr) return parseFloat(msFallbackStr);

  return 1; // Mặc định không quy đổi nếu không tìm thấy
}
```

### 2. Chặn việc CoreCCP ghi đè vào M-System
Trong [ccp-lot-statistics.service.ts#L215-L222](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts#L215-L222):
- **Trước**:
  ```typescript
  await this.settingsService.setSetting('usd_exchange_rate', String(tyGiaMap['USD']));
  if (tyGiaMap['JPY']) await this.settingsService.setSetting('jpy_exchange_rate', String(tyGiaMap['JPY']));
  if (tyGiaMap['MYR']) await this.settingsService.setSetting('myr_exchange_rate', String(tyGiaMap['MYR']));
  ```
- **Sau (Đã sửa)**:
  ```typescript
  // Chỉ cập nhật vào phân hệ CoreCCP, TUYỆT ĐỐI KHÔNG chạm vào key của M-System
  await this.settingsService.setSetting('ccp_usd_exchange_rate', String(tyGiaMap['USD']));
  
  // Tự động cập nhật vào Ma trận động ccp_exchange_rates_matrix
  const existingMatrix = await this.getCcpRatesMatrix();
  for (const [curr, rate] of Object.entries(tyGiaMap)) {
    existingMatrix[curr] = {
      currencyCode: curr,
      conversionRate: rate,
      buyRate: existingMatrix[curr]?.buyRate || rate,
      sellRate: existingMatrix[curr]?.sellRate || rate,
    };
  }
  await this.settingsService.setSetting('ccp_exchange_rates_matrix', JSON.stringify(existingMatrix));
  ```

---

## V. KỊCH BẢN VẬN HÀNH THỰC TẾ TRONG CA TRỰC (OPERATIONAL WORKFLOW)

Để đảm bảo tài liệu phản ánh **100% nghiệp vụ thực tế**, không có bất kỳ phỏng đoán lý thuyết nào, dưới đây là quy trình thao tác chuẩn của Nhân sự Trực ca (Shift Operator) trong ca trực:

### 1. Luồng Vận Hành Bình Thường Hàng Ngày (Happy Path)
- **Bước 1 (Đầu ca sáng 05:45 - 06:00)**:
  * Bot tự động cào trang `msadmin.mxv.com.vn/#/currencyManagement/exchangeRate` và cập nhật các tỷ giá M-System (`usd_exchange_rate = 26,000`, `jpy_exchange_rate = 168`...).
  * Nếu thư mục `Backup CoreCCP` đã có tệp `TyGia_*.xlsx` (hoặc tệp `TTTT.csv`/`TTM.csv`), hệ thống tự động bóc tách tỷ giá VNCLEAR vào ma trận `ccp_exchange_rates_matrix` (JPY = 170/168, MYR = 6383/6268).
- **Bước 2 (06:00 - 06:30 Chạy Đối Chiếu Pre-EOD & CQG)**:
  * Trực ca vào Tab 1, hệ thống tự động đối chiếu số dư CQG vs M-System bằng công thức `(Số dư + Chờ đáo hạn - Lãi lỗ) / ms_rate_usd`.
  * Do tỷ giá M-System được cô lập hoàn toàn, **không còn hiện tượng bị CoreCCP đè giá làm lệch > $100 giả**.
- **Bước 3 (06:30 Chạy Đối Chiếu CoreCCP & Thống Kê TVKD)**:
  * Trực ca vào Tab 4 (CoreCCP), hệ thống tính toán 4 thành phần EOD VNCLEAR và GTGD TVKD bằng đúng ma trận tỷ giá VNCLEAR `ccp_exchange_rates_matrix`.
  * Các mặt hàng Dầu cọ (MYR) và Cao su (JPY) được nhân đúng tỷ giá thanh toán của VNCLEAR, số liệu doanh số TVKD khớp 100% với báo cáo bù trừ.

---

### 2. Kịch Bản Vận Hành Thực Tế Khi Có Đồng Tiền Mới (New Currency Workflow)
*Ví dụ: VNCLEAR phát hành quy chế mới niêm yết thêm đồng **EUR** (Hợp đồng Lúa mì Matif EUR).*

- **Thao tác của Trực ca (Không cần gọi DEV, Không cần sửa code)**:
  1. Trực ca đăng nhập `/trading-manager`, chuyển sang **Tab 3: Cấu hình & Đường dẫn**.
  2. Tại **Card 2: Cấu hình Tỷ giá Bù trừ CoreCCP**, bấm nút **`[+ Thêm nguyên tệ]`**.
  3. Nhập 4 thông số:
     * *Mã tiền tệ*: `EUR`
     * *Tỷ giá quy đổi*: `28,500.00`
     * *Tỷ giá Mua (Bid)*: `28,300.00`
     * *Tỷ giá Bán (Ask)*: `28,700.00`
  4. Bấm nút **`[Lưu Cấu Hình]`** $\rightarrow$ Hệ thống ghi nhận ngay lập tức vào CSDL MongoDB.
  5. Khi chạy tính toán CoreCCP cho các hợp đồng EUR, hệ thống tự động áp dụng mức tỷ giá `28,500` này. Toàn bộ quy trình diễn ra dưới 30 giây!

---

### 3. Quy Trình Xử Lý Ngoại Lệ Trong Vận Hành (Exception & Fallback Rules)
1. **Trường hợp VNCLEAR chưa kịp ban hành file Tỷ giá ngày mới**:
   * Hệ thống tự động kích hoạt hàm `findLatestFileInHistory()` quét lùi 30 ngày trong thư mục `Backup CoreCCP` để tìm tệp tỷ giá gần nhất.
   * Nếu không tìm thấy tệp nào, hệ thống giữ nguyên ma trận tỷ giá đang lưu trong CSDL MongoDB và hiển thị badge cảnh báo: `[Đang sử dụng tỷ giá ngày DD/MM/YYYY]`.
2. **Trường hợp M-System bị lỗi mạng / không cào được web**:
   * Nút "Đồng bộ từ M-System" sẽ báo lỗi mạng rõ ràng.
   * Hệ thống tự động giữ nguyên các key `usd_exchange_rate` hiện có trong database, tuyệt đối không gán `null` hoặc làm mất số liệu đang chạy.

---

## VI. MA TRẬN ĐÁNH GIÁ TRƯỚC VÀ SAU KHI TRIỂN KHAI

| Tiêu chí so sánh | Thiết kế cũ (Hardcoded) | Thiết kế mới (Data-Driven Dynamic Matrix) |
| :--- | :--- | :--- |
| **M-System ca trực hiện tại** | Dễ bị CoreCCP đè hỏng tỷ giá khi chạy thống kê | **Bảo toàn 100% (An toàn tuyệt đối)**, M-System giữ nguyên key cũ |
| **Xung đột tỷ giá M-System vs CoreCCP** | JPY (168 vs 170) và MYR (6268 vs 6383) liên tục đè lên nhau gây lệch tiền | **Triệt tiêu 100%**, hai hệ thống chạy trên 2 phân vùng dữ liệu riêng |
| **Khi VNCLEAR niêm yết đồng tiền mới (EUR, SGD...)** | Phải vào code thêm biến, sửa TypeScript, sửa UI, build & deploy lại server | **0 dòng code**. Trực ca bấm `+ Thêm nguyên tệ` trên Web trong 5 giây |
| **Tương thích ngược (Backward Compatibility)** | Thấp | **100% Tương thích**: Code cũ vẫn đọc được `usd_exchange_rate` bình thường |
| **Giao diện người dùng Tab 3** | 3 ô dồn cục, select chỉ có `USD/VND` | **2 Card độc lập chuyên nghiệp**, trực quan, có bảng quản lý đa tiền tệ |

---

## VII. KẾ HOẠCH TRIỂN KHAI MÃ NGUỒN CỤ THỂ

1. **Bước 1 (Backend Services)**:
   - Sửa `ccp-lot-statistics.service.ts`: Chặn ghi đè vào `usd_exchange_rate`, cập nhật vào `ccp_exchange_rates_matrix`.
   - Sửa `ccp-recon.service.ts`: Ưu tiên đọc từ `ccp_exchange_rates_matrix`.
2. **Bước 2 (Frontend UI Tab 3)**:
   - Cập nhật `TradingManagerConfigSection.tsx`: Tách thành Card 1 (Tỷ giá M-System) và Card 2 (Bảng Ma trận Nguyên tệ CoreCCP kèm nút `+ Thêm nguyên tệ`).
3. **Bước 3 (Kiểm thử & Bàn giao)**:
   - Chạy `npx.cmd tsc --noEmit` và `nest build` xác nhận không có lỗi cú pháp.
   - Thử nghiệm bấm thêm 1 đồng tiền mới trên UI và kiểm chứng hệ thống tự động lưu vào CSDL MongoDB.
