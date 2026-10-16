# Core Exchange (CE) API Ingress Client (@mxv/coreexchange-api-client)

Gói thư viện và công cụ độc lập (**Standalone Package**) chuyên dụng xác thực và tải báo cáo từ hệ thống **Core Exchange (CE)** (`https://coreexchange.mxv.com.vn` hoặc `https://coreexchange.mxv.com.vn`).

Thư mục này được đóng gói **100% độc lập**, không phụ thuộc vào mã nguồn bên ngoài. Bạn có thể copy toàn bộ thư mục `coreexchange-api-client` sang bất kỳ máy chủ, project hay repo nào khác để sử dụng ngay!

---

## 1. Cấu Trúc Thư Mục

```text
coreexchange-api-client/
├── README.md               # Hướng dẫn sử dụng & tích hợp
├── SPECIFICATION.md        # Đặc tả kỹ thuật phiên CSRF, Session Cookie & OAuth2
├── package.json            # Cấu hình package độc lập (@mxv/coreexchange-api-client)
├── tsconfig.json           # Cấu hình TypeScript độc lập
├── coreexchange_session.json # Cache token và Session Cookie
├── output/                 # Thư mục lưu các file báo cáo Excel tải về
├── dist/                   # File bundle JavaScript & Types sau khi biên dịch
├── src/
│   ├── index.ts            # Public API exports
│   ├── types.ts            # Type definitions & Registry danh mục báo cáo CE
│   ├── cookie-jar.ts       # Quản lý Cookie Jar & Session Cookie
│   ├── auth.service.ts     # Xác thực CSRF, POST /login, OAuth2 Code & cache session
│   ├── rest.client.ts      # HTTP Client tra cứu dữ liệu JSON & xuất file Excel
│   └── client.service.ts   # Unified Facade Engine (CoreExchangeClient)
└── scripts/
    ├── test_login_ce.js    # Script kiểm thử đăng nhập & lấy Session Cookie
    └── run_download_all.js # Script tải trọn gói các báo cáo cốt lõi của Core Exchange
```

---

## 2. Hướng Dẫn Sử Dụng Nhanh

### Bước 1: Sao chép thư mục sang dự án đích

Sao chép toàn bộ thư mục `coreexchange-api-client` vào dự án của bạn (ví dụ: `mxv-cqg-download-investigation`):

```powershell
Copy-Item -Recurse -Force "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor\coreexchange-api-client" "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation\"
```

### Bước 2: Chạy kiểm thử đăng nhập

```bash
cd coreexchange-api-client
node scripts/test_login_ce.js
```

Script sẽ:

1. Tự động bẫy `_csrf` từ form HTML `/login`.
2. Gửi thông tin đăng nhập và bẫy `SESSION` Cookie (HTTP 302 Found).
3. Lấy `oauthCode` từ `/oauth2/authorize`.
4. Verify `/dashboard` và lưu cache vào `coreexchange_session.json`.

### Bước 3: Tải trọn gói các báo cáo

```bash
node scripts/run_download_all.js
```

---

## 3. Cách Tích Hợp Vào Code Dự Án (TypeScript / NestJS)

```typescript
import { CoreExchangeClient } from "./coreexchange-api-client/src";

const ceClient = new CoreExchangeClient({
  baseUrl: "https://coreexchange.mxv.com.vn",
  username: "hieptruong",
  password: "Taovipko0!",
});

// 1. Tải Sổ lệnh tổng hợp CE (DSL)
const ordersResult = await ceClient.downloadOrders("./output/dsl.xlsx");
console.log(`Đã tải Sổ lệnh: ${ordersResult.sizeBytes} bytes`);

// 2. Tải Danh sách giao dịch CE (DSGD)
const tradesResult = await ceClient.downloadTrades("./output/dsgd.xlsx");
console.log(`Đã tải Giao dịch: ${tradesResult.sizeBytes} bytes`);

// 3. Tải toàn bộ báo cáo
const allResults = await ceClient.downloadAllReports("./output");
```
