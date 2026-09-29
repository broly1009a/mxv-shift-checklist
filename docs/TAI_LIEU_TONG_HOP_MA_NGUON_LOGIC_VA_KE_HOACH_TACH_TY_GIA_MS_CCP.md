# TÀI LIỆU TỔNG HỢP MÃ NGUỒN, LOGIC NGHIỆP VỤ & PHƯƠNG ÁN UPDATE TÁCH BIỆT TỶ GIÁ M-SYSTEM VÀ CORECCP (VNCLEAR)

- **Mã tài liệu**: `MXV-TECH-DOC-EXCHANGE-RATE-ISOLATION-2026`
- **Mức độ ảnh hưởng**: **CRITICAL** (Ảnh hưởng đến toàn bộ công thức đối chiếu số dư tiền và hạch toán đa tiền tệ)
- **Hệ thống**: MXV Shift Checklist & Trading Operation Platform
- **Màn hình chính**: `Trading Manager` -> `Tab 3: Cấu hình & Đường dẫn` (`TradingManagerConfigSection.tsx`)
- **Ngày lập**: 23/09/2026
- **Trạng thái**: Đã rà soát 100% mã nguồn thực tế & Lập phương án an toàn tuyệt đối (Zero-Regression)

---

## I. THÔNG TIN NGỮ CẢNH TỪ HỆ THỐNG SẢN XUẤT THỰC TẾ

Dựa trên dữ liệu và hình ảnh chụp trực tiếp từ 2 hệ thống đang vận hành tại Sở Giao dịch Hàng hóa Việt Nam:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. HỆ THỐNG M-SYSTEM (msadmin.mxv.com.vn/#/currencyManagement/exchangeRate)                           │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Pháp nhân: Sở Giao dịch Hàng hóa Việt Nam (MXV)                                                      │
│ • Gồm 2 Tab nghiệp vụ riêng:                                                                          │
│   - Tab 1 "Tỷ giá quy đổi": Dùng định giá tài sản, ký quỹ IMR/MMR, đối chiếu số dư CQG/Straits về VND.  │
│     * JPY / VND = 168.00  |  MYR / VND = 6,268.00  |  RMB / VND = 3,881.00  |  USD / VND = 26,000.00   │
│   - Tab 2 "Tỉ giá thanh toán": Dùng hạch toán dòng tiền thực tế Lãi/Lỗ, Phí (có giá Mua và giá Bán).    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. HỆ THỐNG CORECCP / VNCLEAR (coreccp.vnclear.vn/SYSCONFIGMNG/CURRENCYEXCHANGERATE)                  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Pháp nhân: Công ty CP Thanh toán Bù trừ Hàng hóa Việt Nam (VNCLEAR)                                 │
│ • Bảng "Tỷ giá nguyên tệ" gồm 3 cột độc lập:                                                           │
│   - USD: Quy đổi = 26,000  │  Mua = 26,000  │  Bán = 26,000                                            │
│   - JPY: Quy đổi = 170     │  Mua = 168     │  Bán = 168     (Tỷ giá quy đổi lệch 2 đồng so với M-Sys)│
│   - MYR: Quy đổi = 6,383   │  Mua = 6,268   │  Bán = 6,268   (Tỷ giá quy đổi lệch 115đ so với M-Sys)  │
│ • Áp dụng: Đối chiếu 4 thành phần EOD VNCLEAR và thống kê doanh số TVKD bù trừ.                       │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## II. TỔNG HỢP MÃ NGUỒN LIÊN QUAN TRONG DỰ ÁN (CODE-FIRST AUDIT)

### 1. Phân hệ Frontend (FE)
| STT | Tệp tin & Đường dẫn | Vị trí dòng code | Vai trò & Logic hiện tại |
| :---: | :--- | :--- | :--- |
| **1** | [TradingManagerConfigSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx) | [L102-L108](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx#L102-L108) | Khai báo state tỷ giá: `usdSettlementRateSell`, `usdSettlementRateBuy`, `usdExchangeRate`, `ccpUsdExchangeRate`. |
| **2** | [TradingManagerConfigSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx) | [L150-L174](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx#L150-L174) | `handleSyncMsRate`: Gọi API `/api/v1/reconciliation/sync-usd-rate` để cào web M-System. |
| **3** | [TradingManagerConfigSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx) | [L177-L205](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx#L177-L205) | `handleSyncCcpRate`: Gọi API trích xuất tỷ giá CoreCCP. **Lỗi L194**: Ghi đè luôn `setUsdExchangeRate(rate)`. |
| **4** | [TradingManagerConfigSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx) | [L215-L221](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx#L215-L221) | `handleSaveConfig`: Lưu danh sách key vào MongoDB `system_settings`. |
| **5** | [TradingManagerConfigSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx) | [L396-L475](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx#L396-L475) | Giao diện hiển thị: 3 ô dồn cục, select chỉ có `USD/VND`, không có JPY/MYR/RMB. |
| **6** | [CoreCcpBackupSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CoreCcpBackupSection.tsx) | [L150-L190](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/core-ccp/CoreCcpBackupSection.tsx#L150-L190) | Sub-tab 4.1: Đối soát ký quỹ & EOD VNCLEAR, hiển thị trạng thái tỷ giá VNCLEAR. |

---

### 2. Phân hệ Backend (BE)
| STT | Tệp tin & Đường dẫn | Vị trí dòng code | Vai trò & Logic hiện tại |
| :---: | :--- | :--- | :--- |
| **1** | [cqg-sync-recon.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/cqg-sync-recon.service.ts) | [L209-L220](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/cqg-sync-recon.service.ts#L209-L220), [L408-L417](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/cqg-sync-recon.service.ts#L408-L417) | Đọc `usd_exchange_rate`. Công thức quy đổi CQG: `(soDu + choDaoHan - laiLoVND) / effectiveRate`. Nếu lệch > $100 thì cảnh báo đỏ. |
| **2** | [recon-console-summary.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/recon-console-summary.service.ts) | [L174-L255](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/recon-console-summary.service.ts#L174-L255) | Bot Playwright đăng nhập web M-System, cào bảng ag-Grid và lưu vào `usd_exchange_rate`, `jpy_exchange_rate`, `myr_exchange_rate`, `rmb_exchange_rate`. |
| **3** | [ccp-lot-statistics.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts) | [L204-L228](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts#L204-L228) | **LỖI XUNG ĐỘT GỐC**: Khi đọc file/báo cáo VNCLEAR, tự ý ghi đè vào `usd_exchange_rate`, `jpy_exchange_rate`, `myr_exchange_rate` của M-System. |
| **4** | [ccp-recon.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/ccp-recon.service.ts) | [L46-L76](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/ccp-recon.service.ts#L46-L76) | Đọc `usd_exchange_rate`, `myr_exchange_rate`, `jpy_exchange_rate` để tính đối chiếu 4 thành phần EOD VNCLEAR. |
| **5** | [ccp-statistics.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-statistics.controller.ts) | [L424-L425](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-statistics.controller.ts#L424-L425) | API đồng bộ tỷ giá CoreCCP lưu đè cả 2 key `ccp_usd_exchange_rate` và `usd_exchange_rate`. |

---

## III. NGUY CƠ KỸ THUẬT NẾU KHÔNG TÁCH BIỆT (ROOT CAUSE ANALYSIS)

```
        M-System Playwright Crawler                           CoreCCP File / Report Parser
  [recon-console-summary.service.ts#L240]               [ccp-lot-statistics.service.ts#L215]
                   │                                                     │
                   ▼ (Ghi: JPY=168, MYR=6268)                            ▼ (Ghi đè: JPY=170, MYR=6383)
        ┌────────────────────────────────────────────────────────────────────────┐
        │                 MONGODB: system_settings Collection                    │
        │   • usd_exchange_rate   • jpy_exchange_rate   • myr_exchange_rate      │
        └───────────────────────────────────┬────────────────────────────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
        cqg-sync-recon.service.ts                         ccp-recon.service.ts
        [Đối chiếu số dư CQG vs MS]                       [Đối chiếu EOD 4 phần VNCLEAR]
        Đọc trúng số JPY=170 (của CCP)                    Đọc trúng số MYR=6268 (của MS)
        ➔ LỆCH GIẢ 2,000,000 VND / 1M JPY                ➔ LỆCH GIẢ CÔNG THỨC EOD VNCLEAR!
```

---

## IV. PHƯƠNG ÁN GIẢI QUYẾT: GIỮ NGUYÊN MS, TẠO BỘ MỚI RIÊNG CHO CORECCP

Tuân thủ triệt để chỉ đạo của USER:
> **"Giữ nguyên setting cũ cho M-System, còn CoreCCP sẽ lưu một bộ cấu hình mới riêng."**

### 1. Phân định CSDL MongoDB (`system_settings`)
- **Phân hệ M-System (GIỮ NGUYÊN 100% TẤT CẢ KEY CŨ)**:
  * `usd_exchange_rate`: Tỷ giá quy đổi USD (26,000).
  * `usd_settlement_rate_sell`: Tỷ giá thanh toán Bán USD (26,000).
  * `usd_settlement_rate_buy`: Tỷ giá thanh toán Mua USD (26,000).
  * `jpy_exchange_rate`: Tỷ giá quy đổi JPY (168.00).
  * `myr_exchange_rate`: Tỷ giá quy đổi MYR (6,268.00).
  * `rmb_exchange_rate`: Tỷ giá quy đổi RMB (3,881.00).
  * *Cam kết*: Toàn bộ các service `cqg-sync-recon`, `pre-eod-recon`, `post-eod-handler` **KHÔNG PHẢI SỬA BẤT KỲ DÒNG CODE NÀO**.

- **Phân hệ CoreCCP (TẠO BỘ CẤU HÌNH MỚI ĐỘC LẬP)**:
  * `ccp_usd_exchange_rate`: Tỷ giá quy đổi USD VNCLEAR (26,000).
  * `ccp_jpy_exchange_rate`: Tỷ giá quy đổi JPY VNCLEAR (**170**).
  * `ccp_myr_exchange_rate`: Tỷ giá quy đổi MYR VNCLEAR (**6,383**).
  * `ccp_usd_buy_rate` / `ccp_usd_sell_rate`: Tỷ giá Mua/Bán USD VNCLEAR (26,000).
  * `ccp_jpy_buy_rate` / `ccp_jpy_sell_rate`: Tỷ giá Mua/Bán JPY VNCLEAR (**168**).
  * `ccp_myr_buy_rate` / `ccp_myr_sell_rate`: Tỷ giá Mua/Bán MYR VNCLEAR (**6,268**).
  * `ccp_rates_last_synced`: Thời gian đồng bộ gần nhất từ VNCLEAR.

---

### 2. Xử lý Logic Backend (Sửa 2 điểm nghẽn)
1. **Sửa [ccp-lot-statistics.service.ts#L215-L222](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts#L215-L222)**:
   - Xóa bỏ việc ghi vào `usd_exchange_rate`, `jpy_exchange_rate`, `myr_exchange_rate`.
   - Chuyển sang ghi vào: `ccp_usd_exchange_rate`, `ccp_jpy_exchange_rate`, `ccp_myr_exchange_rate`.
2. **Sửa [ccp-recon.service.ts#L55-L65](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/ccp-recon.service.ts#L55-L65)**:
   - Đổi thứ tự ưu tiên: Đọc `ccp_*_exchange_rate` trước, nếu rỗng thì mới fallback sang `*_exchange_rate`.

---

### 3. Thiết kế Giao diện Tab 3 ([TradingManagerConfigSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx))

Tách thành **2 Card độc lập**:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CARD 1: CẤU HÌNH TỶ GIÁ M-SYSTEM (MXV)                                                                 │
│ [M-System Official Rates - Áp dụng đối chiếu CQG, Straits ACM & EOD MS]   [Nút: Đồng bộ từ M-System]   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tỷ giá thanh toán (Bán/Mua):          Tỷ giá quy đổi M-System (Đơn giá):                              │
│ • Bán USD: [ 26,000 ]                 • USD/VND: [ 26,000.00 ]                                         │
│ • Mua USD: [ 26,000 ]                 • JPY/VND: [    168.00 ]                                         │
│ • Dropdown: [ USD/VND ▼ ]             • MYR/VND: [  6,268.00 ]                                         │
│                                       • RMB/VND: [  3,881.00 ]                                         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CARD 2: CẤU HÌNH TỶ GIÁ BÙ TRỪ CORECCP (VNCLEAR)                                                       │
│ [VNCLEAR Multi-Currency Clearing Rates - Áp dụng đối chiếu Tab 4 & TVKD]   [Nút: Đồng bộ từ CoreCCP]   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ BẢNG NGUYÊN TỆ CHUẨN VNCLEAR (3 CỘT ĐỘC LẬP):                                                         │
│ Nguyên tệ        │  Tỷ giá Quy đổi       │  Tỷ giá Mua (Bid)     │  Tỷ giá Bán (Ask)                  │
│ • USD            │  [ 26,000.00 ]        │  [ 26,000.00 ]        │  [ 26,000.00 ]                     │
│ • JPY            │  [    170.00 ]        │  [    168.00 ]        │  [    168.00 ]                     │
│ • MYR            │  [  6,383.00 ]        │  [  6,268.00 ]        │  [  6,268.00 ]                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## V. KẾ HOẠCH TRIỂN KHAI VÀ MA TRẬN KIỂM THỬ (TEST PLAN)

| Bước | Hạng mục thực hiện | Tệp tin tác động | Tiêu chí nghiệm thu |
| :---: | :--- | :--- | :--- |
| **1** | Cập nhật Backend CCP Parser | `ccp-lot-statistics.service.ts`<br>`ccp-statistics.controller.ts` | Khi cào tỷ giá CCP, chỉ ghi vào `ccp_*`, **không thay đổi** `usd_exchange_rate`. |
| **2** | Cập nhật Backend CCP Recon | `ccp-recon.service.ts` | Đọc ưu tiên `ccp_*`, tính toán công thức EOD chính xác với JPY=170/168, MYR=6383/6268. |
| **3** | Cập nhật Frontend UI | `TradingManagerConfigSection.tsx` | Hiển thị 2 Card riêng biệt, tách rời nút đồng bộ MS và nút đồng bộ CCP. |
| **4** | Biên dịch & Kiểm thử | Frontend & Backend | `npx.cmd tsc --noEmit` và `nest build` đều đạt **Exit Code 0**. |
