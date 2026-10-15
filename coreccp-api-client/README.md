# CoreCCP API Client (@mxv/coreccp-api-client)

Gói thư viện và công cụ độc lập (Standalone Package) chuyên dụng thu thập dữ liệu và tải báo cáo từ hệ thống **CoreCCP MXV Clearing**.

Thư mục này được đóng gói **100% độc lập**, không phụ thuộc vào mã nguồn bên ngoài. Bạn có thể copy toàn bộ thư mục `coreccp-api-client` sang bất kỳ máy chủ, project hay repo nào khác để sử dụng ngay!

---

## 1. Cấu Trúc Thư Mục

```
coreccp-api-client/
├── README.md               # Hướng dẫn sử dụng & tích hợp
├── SPECIFICATION.md        # Đặc tả kỹ thuật chi tiết 3 cơ chế & 25 báo cáo Maker
├── package.json            # Cấu hình package độc lập
├── tsconfig.json           # Cấu hình TypeScript độc lập
├── src/
│   ├── index.ts            # Public API exports
│   ├── types.ts            # Type definitions & Registry 25 Báo cáo Maker
│   ├── auth.service.ts     # Xác thực Bearer JWT, Cookie SESSION & user_id
│   ├── socket.client.ts    # WebSocket NotiSocket Engine.IO v4, bắt reportId
│   ├── rest.client.ts      # REST Search (pageSize 200k), Export Create & ExcelJS
│   ├── crawler.service.ts  # Playwright Headless Fallback cho Modal Hợp đồng Nano
│   └── client.service.ts   # Unified Facade Engine
└── scripts/
    ├── test_quick_api.js   # Script test siêu tốc trực tiếp bằng Node.js (Zero build)
    └── run_download_all_25.js # Script tải trọn gói toàn bộ 25 file Maker
```

---

## 2. Hướng Dẫn Cài Đặt & Sử Dụng Ngay

### Bước 1: Copy thư mục
Copy toàn bộ thư mục `coreccp-api-client` vào project hoặc server của bạn.

### Bước 2: Cài đặt thư viện
```bash
cd coreccp-api-client
npm install
```
*(Chỉ cần thư viện duy nhất là `exceljs` để ghi file Excel cho Kiểu 1; WebSocket và HTTPS đã tích hợp sẵn trong Node.js)*.

### Bước 3: Chạy thử nghiệm ngay (Không cần build)
Chạy script kiểm thử trực tiếp:
```bash
node scripts/test_quick_api.js
```
Script sẽ:
1. Đăng nhập CoreCCP lấy Token + Session Cookie.
2. Thử Kiểu 1 (`SETTLEMENT`) qua `pageSize: 200,000` $\rightarrow$ Trả về JSON trong ~200ms.
3. Thử Kiểu 2 (`ACCOUNTS_INFO`) $\rightarrow$ Kích hoạt `export/create` kèm `fekey` $\rightarrow$ Lắng nghe NotiSocket bắt `reportId` $\rightarrow$ Tải file nhị phân `DSTKGD_ACM_test.xlsx` lưu vào thư mục `output/`.

---

## 3. Cách Tích Hợp Vào Code Dự Án Khác

### Cách A: Dùng trong TypeScript / NestJS
```typescript
import { CoreCcpClient } from './coreccp-api-client/src';

const client = new CoreCcpClient();

// Tải 1 file bất kỳ (Hệ thống tự động phân loại Kiểu 1, Kiểu 2 hay Kiểu 3)
const result = await client.downloadReport('DSL CCP.xlsx', {
  outputDirectory: 'C:/Trading/Data/CCP',
  credentials: {
    username: 'hieptruong',
    password: 'Taovipko0!',
  }
});
console.log('Tải thành công:', result.filePath);

// Hoặc tải trọn gói 25 báo cáo hàng ngày
await client.downloadAll25MakerReports({
  outputDirectory: 'C:/Trading/Data/CCP',
  concurrency: 3,
});
```

### Cách B: Dùng trong Node.js thuần (CommonJS / Express)
Sau khi chạy `npm run build`:
```javascript
const { CoreCcpClient } = require('./coreccp-api-client/dist');

const client = new CoreCcpClient();
async function main() {
  const result = await client.downloadReport('GTT CCP.xlsx', {
    outputDirectory: './downloads'
  });
  console.log('Result:', result);
}
main();
```

---

## 4. Cơ Chế Giải Quyết Report ID Động Của Kiểu 2
CoreCCP sử dụng cơ chế xuất bất đồng bộ (Asynchronous Export):
1. Client gửi `POST /ccp/export/create` với một mã tự sinh: `"fekey": "ORDERBOOK_1791886096348"`.
2. Client kết nối WebSocket tới NotiSocket: `wss://.../notisocket/socket.io/?userId=...`.
3. Khi server render xong file Excel, NotiSocket bắn thông báo chứa đúng `fekey` đó và kèm `reportId` (ví dụ `37671`).
4. Client bắt lấy `reportId` và gọi `GET /ccp/report/download/37671` để lưu file `.xlsx` nguyên bản về máy.
