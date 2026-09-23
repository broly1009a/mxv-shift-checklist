# BẢN THIẾT KẾ KIẾN TRÚC & ĐÁNH GIÁ CHUYÊN SÂU
# TÁCH BIỆT HOÀN TOÀN CẤU HÌNH TỶ GIÁ M-SYSTEM VÀ CORECCP (VNCLEAR)

- **Mã tài liệu**: `MXV-ARCH-EXCHANGE-RATE-ISOLATION-2026`
- **Mức độ quan trọng**: **CRITICAL (Ảnh hưởng trực tiếp đến toàn bộ logic đối soát số dư tiền)**
- **Ngày lập**: 23/09/2026
- **Phân hệ tác động**: 
  - Backend: `reconciliation`, `bot-engine`, `ccp-statistics`, `system-settings`
  - Frontend: `TradingManagerConfigSection.tsx`, `CoreCcpBackupSection.tsx`, `LegacyReconSection.tsx`

---

## I. ĐÁNH GIÁ THỰC TẾ & BẰNG CHỨNG XUNG ĐỘT MÃ NGUỒN (CODE-FIRST GROUNDING)

Sau khi rà soát toàn bộ các service trong backend, chúng tôi phát hiện một **lỗi kiến trúc tiềm ẩn cực kỳ nguy hiểm (Architectural Cross-Contamination Bug)** nếu không tách biệt cấu hình tỷ giá của hai hệ thống:

### 1. Bằng chứng xung đột đè dữ liệu (Overwrite Collision)
Trong mã nguồn hiện tại:
- **Crawler M-System** tại [recon-console-summary.service.ts#L240-L252](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/reconciliation/services/recon-console-summary.service.ts#L240-L252):
  ```typescript
  // Cào từ web M-System và ghi vào system_settings:
  await this.settingsService.setSetting('usd_exchange_rate', usdRate.toString());
  if (rates['MYR']) await this.settingsService.setSetting('myr_exchange_rate', rates['MYR'].toString());
  if (rates['JPY']) await this.settingsService.setSetting('jpy_exchange_rate', rates['JPY'].toString());
  if (rates['RMB']) await this.settingsService.setSetting('rmb_exchange_rate', rates['RMB'].toString());
  ```
- **Parser CoreCCP** tại [ccp-lot-statistics.service.ts#L215-L222](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ccp-statistics/ccp-lot-statistics.service.ts#L215-L222):
  ```typescript
  // Đọc từ file VNCLEAR và CŨNG GHI VÀO CÙNG CÁC KEY ĐÓ:
  if (tyGiaMap['USD']) {
    await this.settingsService.setSetting('usd_exchange_rate', String(tyGiaMap['USD']));
    await this.settingsService.setSetting('ccp_usd_exchange_rate', String(tyGiaMap['USD']));
  }
  if (tyGiaMap['JPY']) await this.settingsService.setSetting('jpy_exchange_rate', String(tyGiaMap['JPY']));
  if (tyGiaMap['MYR']) await this.settingsService.setSetting('myr_exchange_rate', String(tyGiaMap['MYR']));
  if (tyGiaMap['CNY']) await this.settingsService.setSetting('rmb_exchange_rate', String(tyGiaMap['CNY']));
  ```

### 2. Hậu quả sai lệch toán học từ dữ liệu thực tế (Chứng minh qua 2 ảnh của USER)
So sánh trực tiếp các con số thực tế đang chạy trên sản xuất:

| Cặp tiền | Tỷ giá M-System (Ảnh 1) | Tỷ giá CoreCCP VNCLEAR (Ảnh 2) | Độ lệch chênh lệch | Hậu quả nếu dùng chung |
| :---: | :---: | :---: | :---: | :--- |
| **JPY** | **`168.00`** | Quy đổi: **`170.00`**<br>Mua/Bán: **`168.00`** | **`+2.00 VND`** | Khi tính số dư Yên Nhật, nếu lấy nhầm tỷ giá CoreCCP (170) áp vào M-System sẽ làm sai lệch **2,000,000 VND trên mỗi 1,000,000 JPY**. |
| **MYR** | **`6,268.00`** | Quy đổi: **`6,383.00`**<br>Mua/Bán: **`6,268.00`** | **`+115.00 VND`** | Khi đối chiếu Dầu cọ (BMD), nếu CoreCCP đè `6,383` vào `myr_exchange_rate`, toàn bộ lệnh đối chiếu của M-System sẽ bị **vênh 115 VND/MYR**, bùng phát cảnh báo giả hàng loạt tài khoản! |
| **RMB** | **`3,881.00`** | *(Chưa niêm yết trên VNCLEAR)* | -- | VNCLEAR không có RMB. Nếu CoreCCP chạy đè `null` hoặc fallback sẽ làm mất tỷ giá RMB của M-System. |
| **USD** | **`26,000.00`** | Quy đổi: **`26,000.00`** | **`0.00 VND`** | Riêng USD hiện tại 2 bên bằng nhau, nhưng trong tương lai nếu ngày hiệu lực cắt phiên của VNCLEAR lệch 1 ngày so với M-System, giá trị cũng sẽ khác nhau. |

👉 **KẾT LUẬN CỦA ĐỘI NGŨ KỸ THUẬT**: Nhận định của USER là **HOÀN TOÀN CHÍNH XÁC VÀ CỰC KỲ SÁNG SUỐT**. M-System và CoreCCP (VNCLEAR) là **hai pháp nhân và hai hệ thống tính toán độc lập**. Việc gom chung hoặc để đè tỷ giá lên nhau sẽ dẫn tới lỗi logic sai lệch số dư tiền nghiêm trọng sau này!

---

## II. MA TRẬN PHÂN ĐỊNH TRÁCH NHIỆM TỶ GIÁ (RACI MAPPING)

Hệ thống bắt buộc phải cô lập thành 2 miền nghiệp vụ độc lập tuyệt đối (Data Isolation):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 HỆ THỐNG TRADING MANAGER                               │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
┌───────────────────────────────────────────────┐       ┌───────────────────────────────────────────────┐
│          1. MIỀN TỶ GIÁ M-SYSTEM               │       │          2. MIỀN TỶ GIÁ CORECCP (VNCLEAR)     │
├───────────────────────────────────────────────┤       ├───────────────────────────────────────────────┤
│ • Thẩm quyền: Sở Giao dịch Hàng hóa VN (MXV) │       │ • Thẩm quyền: TT Bù trừ VNCLEAR               │
│ • Nguồn: msadmin.mxv.com.vn                   │       │ • Nguồn: coreccp.vnclear.vn                   │
│ • Gồm 2 tập con:                              │       │ • Gồm 1 bảng nguyên tệ (3 cột):               │
│   - Tỷ giá quy đổi (Conversion Rate)          │       │   - Tỷ giá quy đổi (Mark-to-Market)           │
│   - Tỉ giá thanh toán (Settlement Buy / Sell) │       │   - Tỷ giá Mua (Bid) & Bán (Ask)              │
├───────────────────────────────────────────────┤       ├───────────────────────────────────────────────┤
│ ÁP DỤNG CHO CÁC LOGIC SAU:                    │       │ ÁP DỤNG CHO CÁC LOGIC SAU:                    │
│ 1. Đối chiếu số dư CQG vs M-System:           │       │ 1. Đối chiếu 4 thành phần EOD VNCLEAR:        │
│    (cqg-sync-recon.service.ts)                │       │    QLTTTKGD + NR + TTTT - Phí = EOD           │
│    Công thức: (soDu + choDaoHan - laiLo)/tyGia│       │    (ccp-recon.service.ts)                     │
│ 2. Đối chiếu số dư EOD nội bộ M-System:       │       │ 2. Thống kê Số Lot & Giá trị Giao dịch TVKD:  │
│    QLTKGD vs eod.csv (pre-eod-recon.service)  │       │    Bóc tách tỷ giá tính doanh số theo TVKD    │
│ 3. Quét ký quỹ âm IMR/MMR:                    │       │    (ccp-lot-statistics.service.ts)            │
│    (post-eod-handler.service.ts)              │       │ 3. Giám sát ký quỹ thành viên bù trừ tại CCP  │
└───────────────────────────────────────────────┘       └───────────────────────────────────────────────┘
```

---

## III. THIẾT KẾ CƠ SỞ DỮ LIỆU MỚI (DATABASE SCHEMA RE-DESIGN)

Trong MongoDB collection `system_settings`, tách biệt 100% các key lưu trữ bằng tiền tố rõ ràng (`ms_` và `ccp_`):

### 1. Các Key dành riêng cho M-System (`ms_*`):
- `ms_rate_usd_conversion`: Tỷ giá quy đổi USD (Mặc định `26000.00`).
- `ms_rate_usd_buy`: Tỷ giá thanh toán Mua USD (Mặc định `26000.00`).
- `ms_rate_usd_sell`: Tỷ giá thanh toán Bán USD (Mặc định `26000.00`).
- `ms_rate_jpy_conversion`: Tỷ giá quy đổi JPY (Mặc định `168.00`).
- `ms_rate_jpy_buy` / `ms_rate_jpy_sell`: Tỷ giá thanh toán JPY.
- `ms_rate_myr_conversion`: Tỷ giá quy đổi MYR (Mặc định `6268.00`).
- `ms_rate_myr_buy` / `ms_rate_myr_sell`: Tỷ giá thanh toán MYR.
- `ms_rate_rmb_conversion`: Tỷ giá quy đổi RMB (Mặc định `3881.00`).
- `ms_rate_last_synced`: Thời gian cào gần nhất từ M-System.

### 2. Các Key dành riêng cho CoreCCP VNCLEAR (`ccp_*`):
- `ccp_rate_usd_conversion`: Tỷ giá quy đổi USD VNCLEAR (`26000`).
- `ccp_rate_usd_buy` / `ccp_rate_usd_sell`: Tỷ giá Mua/Bán USD VNCLEAR (`26000`).
- `ccp_rate_jpy_conversion`: Tỷ giá quy đổi JPY VNCLEAR (`170`).
- `ccp_rate_jpy_buy` / `ccp_rate_jpy_sell`: Tỷ giá Mua/Bán JPY VNCLEAR (`168`).
- `ccp_rate_myr_conversion`: Tỷ giá quy đổi MYR VNCLEAR (`6383`).
- `ccp_rate_myr_buy` / `ccp_rate_myr_sell`: Tỷ giá Mua/Bán MYR VNCLEAR (`6268`).
- `ccp_rate_last_synced`: Thời gian đồng bộ gần nhất từ VNCLEAR.

### 3. Tương thích ngược an toàn (Safe Fallback):
Để đảm bảo các code cũ không bị lỗi trong giai đoạn chuyển đổi:
- Biến cũ `usd_exchange_rate` sẽ được map trỏ tới `ms_rate_usd_conversion`.
- Biến cũ `ccp_usd_exchange_rate` sẽ được map trỏ tới `ccp_rate_usd_conversion`.

---

## IV. THIẾT KẾ LẠI GIAO DIỆN NGƯỜI DÙNG (FRONTEND UI RE-DESIGN)

Tại [TradingManagerConfigSection.tsx#L385-L500](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx#L385-L500), xóa bỏ việc nhồi nhét 3 cụm vào 1 hàng duy nhất. Thay vào đó, thiết kế thành **2 Khối Card Độc Lập Hoàn Toàn (2 Separate Enterprise Cards)**:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ KHỐI 1: CẤU HÌNH TỶ GIÁ M-SYSTEM (M.SYSTEM EXCHANGE RATES)                                             │
│ [Badge: Áp dụng đối chiếu CQG, Straits ACM & EOD M-System]           [Nút: Đồng bộ từ M-System]        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ TAB A: TỶ GIÁ QUY ĐỔI (Định giá tài sản & Ký quỹ)       │ TAB B: TỈ GIÁ THANH TOÁN (Lãi/Lỗ & Phí)     │
│  - USD/VND: [ 26,000.00 ]                               │  - USD: Mua [ 26,000.00 ] | Bán [ 26,000.00 ]│
│  - JPY/VND: [    168.00 ]                               │  - JPY: Mua [    168.00 ] | Bán [    168.00 ]│
│  - MYR/VND: [  6,268.00 ]                               │  - MYR: Mua [  6,268.00 ] | Bán [  6,268.00 ]│
│  - RMB/VND: [  3,881.00 ]                               │  - RMB: Mua [  3,881.00 ] | Bán [  3,881.00 ]│
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ KHỐI 2: CẤU HÌNH TỶ GIÁ CORECCP (VNCLEAR SETTLEMENT RATES)                                             │
│ [Badge: Áp dụng đối chiếu 4 thành phần EOD VNCLEAR & TVKD]          [Nút: Đồng bộ từ CoreCCP]          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ BẢNG NGUYÊN TỆ CHUẨN VNCLEAR (3 CỘT ĐỘC LẬP):                                                         │
│  • USD: Quy đổi [ 26,000 ]  │  Tỷ giá Mua [ 26,000 ]  │  Tỷ giá Bán [ 26,000 ]                         │
│  • JPY: Quy đổi [    170 ]  │  Tỷ giá Mua [    168 ]  │  Tỷ giá Bán [    168 ]                         │
│  • MYR: Quy đổi [  6,383 ]  │  Tỷ giá Mua [  6,268 ]  │  Tỷ giá Bán [  6,268 ]                         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## V. KẾ HOẠCH TRIỂN KHAI THEO TỪNG BƯỚC AN TOÀN

1. **Bước 1 (Đã hoàn thành)**: Bóc tách chính xác toàn bộ các điểm xuất hiện của tỷ giá trong Backend, phát hiện lỗ hổng ghi đè chéo giữa `recon-console-summary.service.ts` và `ccp-lot-statistics.service.ts`.
2. **Bước 2**: Tái cấu trúc Backend:
   - Sửa `ccp-lot-statistics.service.ts` và `ccp-recon.service.ts` để đọc/ghi vào các key `ccp_*`, tuyệt đối không ghi đè vào `usd_exchange_rate` hay `jpy_exchange_rate` của M-System.
   - Sửa `cqg-sync-recon.service.ts` để chỉ đọc từ các key `ms_*`.
3. **Bước 3**: Cập nhật Frontend UI `TradingManagerConfigSection.tsx`:
   - Phân tách giao diện thành 2 Card riêng biệt trực quan, hiển thị đầy đủ cả 4 đồng tiền.
4. **Bước 4**: Kiểm thử xác thực:
   - Kiểm tra `npx.cmd tsc --noEmit` và `nest build`.
   - Chạy thử nghiệm đồng bộ độc lập từ cả 2 nguồn và xác nhận không còn hiện tượng ghi đè chéo.
