# ACM ETP API Ingress Client (@mxv/acm-etp-client)

Gói thư viện và công cụ độc lập (**Standalone Package**) chuyên dụng xác thực và tải báo cáo từ hệ thống **ACM ETP Exchange Management** (`https://acm-etp.acmmex.com`) qua REST API trực tiếp.

Thư mục này được đóng gói **100% độc lập**, không phụ thuộc vào mã nguồn bên ngoài. Bạn có thể copy toàn bộ thư mục `acm-etp-client` sang bất kỳ máy chủ, project hay repo nào khác để sử dụng ngay!

---

## 1. Cấu Trúc Thư Mục

```text
acm-etp-client/
├── README.md               # Hướng dẫn sử dụng & tích hợp
├── SPECIFICATION.md        # Đặc tả kỹ thuật phiên AWS ALB & danh mục Endpoint
├── package.json            # Cấu hình package độc lập
├── tsconfig.json           # Cấu hình TypeScript độc lập
├── acm_session.json        # Cache token và cookie phiên làm việc
├── output/                 # Thư mục lưu các file báo cáo Excel tải về
│   ├── ACM_ETP_ORDERS.xlsx # File Sổ lệnh ETP (480 KB)
│   └── ACM_ETP_TRADES.xlsx # File Khớp lệnh ETP (203 KB)
├── src/
│   ├── index.ts            # Public API exports
│   ├── types.ts            # Type definitions & Registry danh mục báo cáo
│   ├── cookie-jar.ts       # Quản lý AWS ALB Sticky Cookies
│   ├── auth.service.ts     # Xác thực tự sinh UUID, Captcha Solver hook & verify token
│   ├── rest.client.ts      # HTTP Client chuyên dụng tải file export và gọi paging API
│   └── client.service.ts   # Unified Facade Engine
└── scripts/
    ├── test_login_acm.js   # Script kiểm thử đăng nhập & lấy token
    └── run_download_all.js # Script tải trọn gói Sổ lệnh và Khớp lệnh ETP
```

---

## 2. Hướng Dẫn Sử Dụng Nhanh

### Bước 1: Copy thư mục sang dự án đích
Copy toàn bộ thư mục `acm-etp-client` vào dự án của bạn (ví dụ: `mxv-cqg-download-investigation`):

```powershell
Copy-Item -Recurse -Force "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor\acm-etp-client" "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation\"
```

### Bước 2: Chạy tải báo cáo ngay (Zero Build)
```bash
cd acm-etp-client
node scripts/run_download_all.js
```

Script sẽ:
1. Đọc và kiểm tra hiệu lực của token từ `acm_session.json`.
2. Nếu hợp lệ, tự động tải ngay **Sổ lệnh (`ACM_ETP_ORDERS.xlsx`)** và **Khớp lệnh (`ACM_ETP_TRADES.xlsx`)** trong 2 giây.
3. Nếu session hết hạn, script sẽ tự động khởi tạo phiên mới, tải ảnh captcha và hướng dẫn bạn nhập mã để tái đăng nhập.

---

## 3. Cách Tích Hợp Vào Code Dự Án (TypeScript / NestJS)

```typescript
import { AcmEtpClient } from './acm-etp-client/src';

const acmClient = new AcmEtpClient({
  baseUrl: 'https://acm-etp.acmmex.com',
  username: 'MXVRO',
  password: "BT'$2=09_1Vm46$S",
});

// 1. Tải Sổ lệnh ETP
const ordersResult = await acmClient.downloadOrders('./output/orders.xlsx');
console.log(`Đã tải Sổ lệnh: ${ordersResult.sizeBytes} bytes`);

// 2. Tải Khớp lệnh ETP
const tradesResult = await acmClient.downloadTrades('./output/trades.xlsx');
console.log(`Đã tải Khớp lệnh: ${tradesResult.sizeBytes} bytes`);

// 3. Tải toàn bộ báo cáo
const allResults = await acmClient.downloadAllReports('./output');

// 4. Truy vấn phân trang dạng JSON (Không cần tải file)
const pagedTrades = await acmClient.getPagedTrades({ page: 1, limit: 50 });
console.log(`Tổng số trade: ${pagedTrades.page?.totalCount}`);
```

---

## 4. Danh Mục Báo Cáo & Kết Quả Tải Thực Tế (Ground Truth Verified)

| STT | Mã Báo Cáo | Tên Nghiệp Vụ | Endpoint Export File | Kích Thước File | Thời Gian Tải |
| :---: | :--- | :--- | :--- | :---: | :---: |
| 1 | **`ACM_ETP_ORDERS`** | Sổ lệnh ACM ETP | `/exchange/business/tetporder/export` | **480.0 KB** | **942 ms** |
| 2 | **`ACM_ETP_TRADES`** | Khớp lệnh ACM ETP | `/exchange/business/tetptrade/export` | **203.0 KB** | **1,100 ms** |
