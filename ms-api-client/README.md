# M-System API Ingress Client (@mxv/ms-api-client)

Gói thư viện và công cụ độc lập (Standalone Package) chuyên dụng xác thực và tải báo cáo từ hệ thống **M-System (Vendor Newgen Admin)** qua REST API trực tiếp.

Thư mục này được đóng gói **100% độc lập**, không phụ thuộc vào mã nguồn bên ngoài. Bạn có thể copy toàn bộ thư mục `ms-api-client` sang bất kỳ máy chủ, project hay repo nào khác để sử dụng ngay!

---

## 1. Cấu Trúc Thư Mục

```text
ms-api-client/
├── README.md               # Hướng dẫn sử dụng & tích hợp
├── SPECIFICATION.md        # Đặc tả kỹ thuật xác thực 2 bước & danh mục API Endpoint
├── package.json            # Cấu hình package độc lập
├── tsconfig.json           # Cấu hình TypeScript độc lập
├── src/
│   ├── index.ts            # Public API exports
│   ├── types.ts            # Type definitions & Registry 20 Báo cáo M-System
│   ├── auth.service.ts     # Xác thực 2 bước (Password + PIN), decode & cache JWT
│   ├── rest.client.ts      # REST API Client tải file nhị phân trực tiếp (.xlsx, .csv)
│   └── client.service.ts   # Unified Facade Engine
└── scripts/
    ├── test_quick_api.js   # Script test nhanh Node.js (Zero build, chạy là chạy)
    └── run_download_all.js # Script tải trọn gói toàn bộ báo cáo M-System
```

---

## 2. Hướng Dẫn Sử Dụng Nhanh

### Bước 1: Copy thư mục
Copy toàn bộ thư mục `ms-api-client` vào dự án của bạn (ví dụ: `mxv-cqg-download-investigation`).

```powershell
Copy-Item -Recurse -Force "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor\ms-api-client" "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation\"
```

### Bước 2: Chạy thử nghiệm ngay (Không cần build)
```bash
cd ms-api-client
node scripts/test_quick_api.js
```

Script sẽ:
1. Đăng nhập 2 bước (Mật khẩu $\rightarrow$ Xác thực PIN).
2. Tải 3 file báo cáo mẫu (`DSTKGD-Futures`, `DSTKGD-Spread`, `NKTTHT`) qua REST API.
3. Lưu file nhị phân vào thư mục `output/`.

---

## 3. Cách Tích Hợp Vào Code Dự Án (TypeScript / NestJS)

```typescript
import { MsClient } from './ms-api-client/src';

const msClient = new MsClient({
  baseUrl: 'https://api-dev.newgen.dev',
  adminUrl: 'https://admin-dev.msystem.newgen.dev',
  username: 'mxvhieptruong',
  password: 'Taovipko0!',
  pin: '269696',
});

// 1. Tải một file bất kỳ
const result = await msClient.downloadReport('DSTKGD-Futures', './output/danh_sach_tkgd.xlsx');
console.log(`Tải thành công: ${result.fileName} (${result.sizeBytes} bytes)`);

// 2. Tải toàn bộ báo cáo
const allResults = await msClient.downloadAllReports('./output');
```

---

## 4. Danh Mục 18 Endpoint API Đã Giải Mã Thành Công 100% (Ground Truth)

| STT | Mã Báo Cáo | Tên Báo Cáo Nghiệp Vụ | HTTP Method | Endpoint REST API Chính Xác | Tên File Thực Tế |
| :---: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`NKTTHT`** | Nhật ký thao tác hệ thống | `GET` | `/approval/admin/activities/excel?sort_by=desc(datetime)` | `nhat_ky_thao_tac_...xlsx` |
| 2 | **`DSTKGD-Futures`** | Danh sách TKGD Futures | `GET` | `/am/admin/investors/excel?subInvestorType%5Beq%5D=NULL` | `danh_sach_TKGD.xlsx` |
| 3 | **`DSTKGD-Spread`** | Danh sách TKGD Spread | `GET` | `/am/admin/investors/excel?subInvestorType%5Beq%5D=S` | `danh_sach_TKGD.xlsx` |
| 4 | **`DSTKGD-LME`** | Danh sách TKGD LME | `GET` | `/am/admin/investors/excel?subInvestorType%5Beq%5D=LME` | `danh_sach_TKGD.xlsx` |
| 5 | **`DSTKGD-ACM`** | Danh sách TKGD ACM | `GET` | `/am/admin/investors/excel?subInvestorType%5Beq%5D=ACM` | `danh_sach_TKGD.xlsx` |
| 6 | **`TLQHSKQ`** | Thiết lập quan hệ số ký quỹ | `GET` | `/am/admin/margin-ratio-multiplier/investors/excel?sort_by=desc(createdDate)` | `TLQHSKQ.xlsx` |
| 7 | **`NR`** | Danh sách nộp rút tiền | `GET` | `/am/admin/investors/marginTransactionHistory/excel` | `DS_lich_su_GD_tien_TKGD.xlsx` |
| 8 | **`DSTrader`** | Danh sách Trader | `GET` | `/am/admin/traders/excel?sort_by=desc(createdDate)` | `danh_sach_Trader.xlsx` |
| 9 | **`DSLDK`** | Danh sách lệnh đã khớp | `GET` | `/order/admin/list/excel?status%5Bin%5D=PARTIALLY_FILLED,FILLED` | `danh-sach-lenh-....xlsx` |
| 10 | **`DSLCK`** | Danh sách lệnh chờ khớp | `GET` | `/order/admin/list/excel?status%5Bin%5D=WORKING` | `danh-sach-lenh-....xlsx` |
| 11 | **`DSLH`** | Danh sách lệnh hủy | `GET` | `/order/admin/list/excel?status%5Bin%5D=CANCELLED` | `danh-sach-lenh-....xlsx` |
| 12 | **`DSGD`** | Danh sách giao dịch | `GET` | `/transaction/admin/list/excel` | `danh-sach-giao-dich-....xlsx` |
| 13 | **`TTM`** | Trạng thái mở (Vị thế mở) | `GET` | `/position/admin/open/excel` | `trang-thai-mo-....xlsx` |
| 14 | **`TTTT`** | Trạng thái tất toán | `GET` | `/position/admin/settle/excel` | `trang-thai-tat-toan-....xlsx` |
| 15 | **`TTCDH`** | Trạng thái tất toán chờ đáo hạn LME | `GET` | `/position/admin/settleLME/excel` | `trang-thai-tat-toan-....xlsx` |
| 16 | **`DSQLKQ`** | Danh sách quản lý ký quỹ | `GET` | `/margin/admin/list/excel?limit=20&offset=0` | `danh-sach-quan-ly-ky-quy-....xlsx` |
| 17 | **`QLTKGD`** | Quản lý tài khoản giao dịch | `GET` | `/margin/admin/status/excel` | `QLTKGD.xlsx` |
| 18 | **`QLTKGD âm KQ`** | Quản lý TKGD âm ký quỹ | `GET` | `/margin/admin/status/negative/excel` | `danh-sach-quan-ly-tt-tkgd-am-ky-quy-....xlsx` |
