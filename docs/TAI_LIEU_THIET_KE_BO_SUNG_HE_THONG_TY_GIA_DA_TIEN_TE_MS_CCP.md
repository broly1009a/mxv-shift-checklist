# TÀI LIỆU THIẾT KẾ BỔ SUNG: HỆ THỐNG QUẢN LÝ TỶ GIÁ ĐA TIỀN TỆ (M-SYSTEM & CORECCP / VNCLEAR)

- **Mã tài liệu**: `MXV-DOC-MULTI-CURRENCY-EXCHANGE-RATES-v2.0`
- **Dự án**: Phân hệ Trading Manager - Hệ Thống Vận Hành Ca Trực & Đối Soát MXV (Shift Checklist)
- **Màn hình tác động**: `Trading Manager` -> `Tab 3: Cấu hình & Đường dẫn` (`TradingManagerConfigSection.tsx`)
- **Ngày lập**: 23/09/2026
- **Trạng thái**: Đã phê duyệt phương án thiết kế (Ready for Implementation)

---

## I. NGUYÊN NHÂN HIỆN TẠI GIAO DIỆN CHỈ CÓ SELECT "USD/VND"

Trên giao diện hiện tại của `TradingManagerConfigSection.tsx` (dòng 403-411), phần tỷ giá thanh toán chỉ có duy nhất một thẻ `<select>` với `<option value="USD/VND">USD/VND</option>`. Lý do kỹ thuật và lịch sử phát triển như sau:

1. **Kế thừa 1:1 từ phần mềm WinForms C# cũ (`operate-transaction-app`)**:
   - Ứng dụng Desktop C# trước đây (`FormConfig.cs`) chỉ phục vụ việc đối soát giao dịch quốc tế qua cổng CQG (thanh toán hoàn toàn bằng đồng USD). Vì vậy, các lập trình viên ban đầu chỉ khai báo các trường `usd_settlement_rate_sell`, `usd_settlement_rate_buy`, `usd_exchange_rate`.
   - Khi chuyển đổi giao diện sang Web Next.js, component `TradingManagerConfigSection.tsx` được port nguyên trạng layout của WinForms C# để trực ca không bị bỡ ngỡ, dẫn đến thẻ `<select>` bị để cứng giá trị `USD/VND`.

2. **Thực tế vận hành sản xuất hiện nay của MXV**:
   - Thị trường hàng hóa phái sinh MXV đã mở rộng liên thông nhiều sàn quốc tế với các đồng tiền tệ khác nhau:
     * **Sàn LME (London Metal Exchange)**: Kim loại cơ bản.
     * **Sàn BMD (Bursa Malaysia Derivatives)**: Dầu cọ, thanh toán bằng Ringgit Malaysia (**MYR**).
     * **Sàn OSE / TOCOM (Nhật Bản)**: Cao su, thanh toán bằng Yên Nhật (**JPY**).
     * **Sàn INE (Thượng Hải)**: Dầu thô, thanh toán bằng Nhân Dân Tệ (**RMB**).
   - Cả hai hệ thống cốt lõi của Sở là **M-System** và **CoreCCP (VNCLEAR)** đều đã vận hành ma trận đa tiền tệ hoàn chỉnh. Do đó, việc mở rộng cấu hình tỷ giá trên Trading Manager từ đơn tệ (USD) sang **Đa tiền tệ (Multi-Currency)** là yêu cầu cấp thiết.

---

## II. BÓC TÁCH CHI TIẾT TỪ HÌNH ẢNH THỰC TẾ CỦA 2 HỆ THỐNG

### 1. Hệ Thống 1: M-System (`msadmin.mxv.com.vn`)

- **Đường dẫn màn hình**: `Home / QL tiền tệ & tỷ giá / Tỷ giá`
- **URL**: `https://msadmin.mxv.com.vn/#/currencyManagement/exchangeRate`
- **Cơ chế nghiệp vụ**: M-System phân tách rõ ràng thành **2 Tab nghiệp vụ độc lập**:

#### Tab 1: "Tỷ giá quy đổi" (Exchange Rate / Conversion Rate)
| STT | Đồng tiền yết giá | Đồng tiền định giá | Tỷ giá quy đổi | Ngày phiên hiệu lực | Trạng thái | Ngày phê duyệt |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | **JPY** (Yên Nhật) | VND | **168.00** | 18/09/2026 | Hoạt động | 17/09/2026 17:23:09 |
| 2 | **MYR** (Ringgit Malaysia) | VND | **6,268.00** | 18/09/2026 | Hoạt động | 17/09/2026 17:22:55 |
| 3 | **RMB** (Nhân Dân Tệ) | VND | **3,881.00** | 18/09/2026 | Hoạt động | 17/09/2026 17:22:33 |
| 4 | **USD** (Đô la Mỹ) | VND | **26,000.00** | 18/09/2026 | Hoạt động | 17/09/2026 17:21:33 |

- **Mục đích nghiệp vụ của Tab Quy đổi**:
  * Dùng để định giá lại (Mark-to-Market) toàn bộ tài sản ký quỹ, tính toán hạn mức rủi ro, và đối soát quy đổi số dư tài khoản giao dịch quốc tế (CQG, Straits ACM) về đồng tiền cơ sở VND.
  * Chỉ có **1 mức tỷ giá duy nhất** cho mỗi cặp tiền.

#### Tab 2: "Tỉ giá thanh toán" (Settlement Exchange Rate)
- **Cấu trúc cột**: `STT`, `Đồng tiền yết giá`, `Đồng tiền định giá`, `Tỷ giá Mua`, `Tỷ giá Bán`, `Ngày tạo`, `Ngày phê duyệt`.
- **Mục đích nghiệp vụ của Tab Thanh toán**:
  * Dùng khi hạch toán dòng tiền thực tế phát sinh: Nộp tiền ngoại tệ, Rút tiền ngoại tệ, Thu phí giao dịch, Thanh toán chênh lệch Lãi/Lỗ thực tế khi tất toán hợp đồng.
  * Phân biệt rõ chiều **Mua** (Bid) và chiều **Bán** (Ask).

---

### 2. Hệ Thống 2: CoreCCP / VNCLEAR (`coreccp.vnclear.vn`)

- **Đường dẫn màn hình**: `Trang chủ / Tỷ giá nguyên tệ`
- **URL**: `https://coreccp.vnclear.vn/SYSCONFIGMNG/CURRENCYEXCHANGERATE`
- **Bảng dữ liệu thực tế trích xuất từ giao diện**:

| Thao tác | Nguyên tệ | Tỷ giá quy đổi | Tỷ giá Mua | Tỷ giá Bán | Ngày tạo | Trạng thái duyệt | Người tạo | Người duyệt |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 📝 | **JPY** | **170** | **168** | **168** | 12/09/2026 13:10:06 | Hoạt động | giangdoan | phuongbui |
| 📝 | **MYR** | **6,383** | **6,268** | **6,268** | 12/09/2026 13:09:50 | Hoạt động | giangdoan | phuongbui |
| 📝 | **USD** | **26,000** | **26,000** | **26,000** | 04/09/2026 18:27:35 | Hoạt động | giangdoan | phuongbui |

- **Điểm đặc thù quan trọng của CoreCCP (VNCLEAR)**:
  * VNCLEAR tích hợp cả 3 giá trị trên cùng 1 dòng dữ liệu: **`Tỷ giá quy đổi`**, **`Tỷ giá Mua`**, và **`Tỷ giá Bán`**.
  * **Sự chênh lệch giữa Tỷ giá quy đổi và Tỷ giá Mua/Bán**:
    - Đối với **USD**: Quy đổi = Mua = Bán = `26,000`.
    - Đối với **JPY**: Tỷ giá quy đổi là `170`, trong khi Tỷ giá Mua/Bán thanh toán là `168` (chênh 2 đồng).
    - Đối với **MYR**: Tỷ giá quy đổi là `6,383`, trong khi Tỷ giá Mua/Bán thanh toán là `6,268` (chênh 115 đồng).
  * Điều này chứng minh rằng: Nếu hệ thống đối soát dùng lẫn lộn giữa Tỷ giá quy đổi và Tỷ giá thanh toán sẽ gây ra **lệch số dư tiền hàng trăm triệu đồng** khi thanh toán bù trừ đa tiền tệ.

---

## III. TỔNG HỢP CÁC LOẠI TỶ GIÁ TRONG HỆ THỐNG MXV

Hệ thống ghi nhận tổng cộng **3 nhóm tỷ giá** và **4 đồng tiền niêm yết chính thức**:

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │           HỆ THỐNG TỶ GIÁ PHÁI SINH MXV               │
                                    └──────────────────────────┬─────────────────────────────┘
                                                               │
                     ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
                     ▼                                         ▼                                         ▼
       ┌───────────────────────────┐             ┌───────────────────────────┐             ┌───────────────────────────┐
       │   1. TỶ GIÁ QUY ĐỔI       │             │   2. TỶ GIÁ THANH TOÁN    │             │   3. TỶ GIÁ VNCLEAR       │
       │   (Mark-to-Market / IMR)  │             │   (Settlement Buy / Sell) │             │   (CoreCCP Multi-Currency)│
       ├───────────────────────────┤             ├───────────────────────────┤             ├───────────────────────────┤
       │ Áp dụng: Quy đổi số dư    │             │ Áp dụng: Quyết toán dòng  │             │ Áp dụng: Đối chiếu EOD 4  │
       │ tài sản ký quỹ CQG/Straits│             │ tiền thực tế Lãi/Lỗ, Phí  │             │ thành phần và ký quỹ bù trừ│
       │ Đơn giá: 1 cột duy nhất   │             │ Đơn giá: Mua (Bid) & Bán  │             │ Đơn giá: Quy đổi / Mua/Bán│
       │ Nguồn: M-System Tab 1     │             │ Nguồn: M-System Tab 2     │             │ Nguồn: CoreCCP SysConfig  │
       └───────────────────────────┘             └───────────────────────────┘             └───────────────────────────┘
```

### Danh mục 4 đồng tiền ngoại tệ niêm yết:
1. **USD / VND**: Đô la Mỹ (giao dịch CME, CBOT, NYMEX, COMEX, ICE US).
2. **JPY / VND**: Yên Nhật (giao dịch OSE, TOCOM cao su).
3. **MYR / VND**: Ringgit Malaysia (giao dịch BMD dầu cọ).
4. **RMB / VND**: Nhân Dân Tệ (giao dịch INE dầu thô).

---

## IV. PHƯƠNG ÁN THIẾT KẾ NÂNG CẤP TOÀN DIỆN CHO TRADING MANAGER

### 1. Nâng cấp Giao diện Frontend (`TradingManagerConfigSection.tsx`)

Thay vì chỉ có 1 thẻ `<select>` đơn lẻ và 2 ô nhập cho USD, giao diện sẽ được nâng cấp thành **Khối Quản Lý Tỷ Giá Đa Tiền Tệ Tích Hợp (Multi-Currency Matrix Panel)**:

#### A. Tùy chọn 1: Cho phép chuyển đổi linh hoạt qua `<select>` (Quick Switch)
Cho phép người dùng chọn đơn vị tiền tệ muốn cấu hình:
```tsx
<select
  value={selectedCurrency}
  onChange={(e) => setSelectedCurrency(e.target.value)}
  className="form-input"
>
  <option value="USD">USD/VND - Đô la Mỹ</option>
  <option value="JPY">JPY/VND - Yên Nhật</option>
  <option value="MYR">MYR/VND - Ringgit Malaysia</option>
  <option value="RMB">RMB/VND - Nhân Dân Tệ</option>
</select>
```
Khi chọn đồng tiền nào, các ô nhập `Tỷ giá quy đổi`, `Tỷ giá Mua`, `Tỷ giá Bán`, và `Tỷ giá VNCLEAR` tương ứng sẽ tự động hiển thị số liệu của đồng tiền đó.

#### B. Tùy chọn 2: Hiển thị Bảng Ma Trận Tỷ Giá Tổng Hợp (Enterprise Matrix Table - Khuyến nghị)
Hiển thị bảng trực quan ngay dưới cụm cấu hình:

| Nguyên tệ | Tỷ giá Quy đổi MS | Tỷ giá Mua MS | Tỷ giá Bán MS | Quy đổi VNCLEAR | Mua VNCLEAR | Bán VNCLEAR | Chênh lệch (MS vs CCP) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **USD** | 26,000 | 26,000 | 26,000 | 26,000 | 26,000 | 26,000 | 0 (Khớp) |
| **JPY** | 168.00 | 168.00 | 168.00 | 170.00 | 168.00 | 168.00 | -2.00 (Lệch QĐ) |
| **MYR** | 6,268.00 | 6,268.00 | 6,268.00 | 6,383.00 | 6,268.00 | 6,268.00 | -115.00 (Lệch QĐ) |
| **RMB** | 3,881.00 | 3,881.00 | 3,881.00 | -- | -- | -- | Chưa niêm yết CCP |

---

### 2. Thiết kế Database Schema (`system_settings`)

Hệ thống lưu cấu hình dạng JSON có cấu trúc trong MongoDB collection `system_settings`:

- **Key**: `multi_currency_exchange_rates`
- **Value (JSON String)**:
```json
{
  "USD": {
    "currencyCode": "USD",
    "name": "Đô la Mỹ",
    "msConversionRate": 26000,
    "msBuyRate": 26000,
    "msSellRate": 26000,
    "ccpConversionRate": 26000,
    "ccpBuyRate": 26000,
    "ccpSellRate": 26000,
    "effectiveDate": "2026-09-23"
  },
  "JPY": {
    "currencyCode": "JPY",
    "name": "Yên Nhật",
    "msConversionRate": 168.0,
    "msBuyRate": 168.0,
    "msSellRate": 168.0,
    "ccpConversionRate": 170.0,
    "ccpBuyRate": 168.0,
    "ccpSellRate": 168.0,
    "effectiveDate": "2026-09-23"
  },
  "MYR": {
    "currencyCode": "MYR",
    "name": "Ringgit Malaysia",
    "msConversionRate": 6268.0,
    "msBuyRate": 6268.0,
    "msSellRate": 6268.0,
    "ccpConversionRate": 6383.0,
    "ccpBuyRate": 6268.0,
    "ccpSellRate": 6268.0,
    "effectiveDate": "2026-09-23"
  },
  "RMB": {
    "currencyCode": "RMB",
    "name": "Nhân Dân Tệ",
    "msConversionRate": 3881.0,
    "msBuyRate": 3881.0,
    "msSellRate": 3881.0,
    "ccpConversionRate": null,
    "ccpBuyRate": null,
    "ccpSellRate": null,
    "effectiveDate": "2026-09-23"
  }
}
```

- **Bảo toàn tính tương thích ngược (Backward Compatibility)**:
  Hệ thống vẫn tự động trích xuất và đồng bộ các trường đơn tệ cũ:
  * `usd_exchange_rate` = `multi_currency_exchange_rates.USD.msConversionRate` (26,000)
  * `usd_settlement_rate_buy` = `multi_currency_exchange_rates.USD.msBuyRate` (26,000)
  * `usd_settlement_rate_sell` = `multi_currency_exchange_rates.USD.msSellRate` (26,000)
  * `ccp_usd_exchange_rate` = `multi_currency_exchange_rates.USD.ccpConversionRate` (26,000)

---

### 3. Tự Động Hóa Đồng Bộ Bằng Bot Playwright (RPA Sync)

Hệ thống đã có sẵn service cào tự động và chỉ cần mở rộng selectors để lấy cả 4 đồng tiền:

1. **RPA M-System**:
   - Truy cập `https://msadmin.mxv.com.vn/#/currencyManagement/exchangeRate`.
   - Quét bảng ag-Grid: Lấy đồng thời cả 4 dòng (JPY, MYR, RMB, USD).
   - Chuyển sang Tab "Tỉ giá thanh toán" để lấy thêm `Tỷ giá Mua` và `Tỷ giá Bán`.
2. **RPA CoreCCP / VNCLEAR**:
   - Truy cập `https://coreccp.vnclear.vn/SYSCONFIGMNG/CURRENCYEXCHANGERATE`.
   - Quét bảng: Bóc tách cả 3 cột `Tỷ giá quy đổi`, `Tỷ giá Mua`, `Tỷ giá Bán` cho 3 mã JPY, MYR, USD.

---

## V. LỘ TRÌNH TRIỂN KHAI & ĐỀ XUẤT CHO USER

1. **Giai đoạn 1 (Ngay hôm nay - Bàn giao V2.0)**:
   - Giữ nguyên luồng xử lý ổn định của USD cho phiên bàn giao hôm nay để không gây xáo trộn quy trình của ca trực.
   - Bàn giao tài liệu thiết kế này cho USER và Trưởng ca để thống nhất ma trận tỷ giá và các cặp tiền tệ thực tế.
2. **Giai đoạn 2 (Bản nâng cấp V2.1)**:
   - Cập nhật UI `TradingManagerConfigSection.tsx`: Thay `<select>` 1 tùy chọn thành dropdown đầy đủ 4 cặp tiền (`USD`, `JPY`, `MYR`, `RMB`) và bảng đối chiếu tỷ giá đa tiền tệ.
   - Bổ sung nút **"Đồng bộ tất cả tỷ giá từ M-System & VNCLEAR"** để cập nhật 1 chạm toàn bộ ma trận tỷ giá cho ca trực.
