# 🚀 HƯỚNG DẪN ĐÓNG GÓI & TÁCH DỰ ÁN TKGD THÀNH TOOL ĐỘC LẬP (STANDALONE)
## HỆ THỐNG TỰ ĐỘNG HÓA ĐỐI SOÁT MỞ TÀI KHOẢN GIAO DỊCH (DÀNH RIÊNG CHO PHÒNG THANH TOÁN BÙ TRỪ)

> **Mục tiêu tài liệu:**  
> Hướng dẫn chi tiết từng bước để tách toàn bộ tính năng tự động hóa Mở TKGD ra khỏi dự án `mxv-shift-checklist` thành một **Ứng dụng Độc Lập Hoàn Toàn (Standalone App / Microservice)** dành riêng cho Phòng Thanh toán bù trừ (TTBT), không còn bất kỳ phụ thuộc nào vào hệ thống Ca trực QLGD.

---

## 1. TỔNG QUAN KIẾN TRÚC ĐỘC LẬP (STANDALONE ARCHITECTURE)

Hệ thống đã được thiết kế sẵn theo nguyên lý **Đóng gói Độc lập (Self-Contained & Zero-Coupling)**:
- **Không dùng chung tài khoản Bot**: Sử dụng tài khoản M-System cá nhân của chuyên viên TTBT và hộp thư `clearing.acc@mxv.vn`.
- **Không dùng chung Service**: Toàn bộ logic bóc tách mail, Playwright scraper và Excel engine nằm trọn vẹn trong module TKGD.
- **Không dính dữ liệu ca trực**: Toàn bộ dữ liệu nằm trên 3 Collection riêng (`tkgd_user_configs`, `raw_account_mails`, `clean_account_records`).

```mermaid
graph TD
    subgraph StandaloneApp [Dự Án Độc Lập: mxv-tkgd-clearing]
        UI[Web UI Next.js: Cấu hình & Dashboard]
        API[NestJS / Node.js Backend API]
        RPA[Playwright Scraper M-System]
        Mail[Microsoft 365 Graph Client]
        Excel[ExcelJS Engine]
    end

    subgraph Data [Lưu Trữ Riêng Của TTBT]
        DB[(MongoDB Riêng: mxv_tkgd_db)]
        Drive[Ổ M:\Tailieuchung\QLGD-IT\...\Mo TKGD]
    end

    UI --> API
    API --> RPA
    API --> Mail
    API --> Excel
    API --> DB
    Excel --> Drive
```

---

## 2. DANH SÁCH CÁC FILE CẦN SAO CHÉP (STANDALONE ASSETS)

Khi tạo thư mục dự án mới (ví dụ `mxv-tkgd-clearing/`), chỉ cần sao chép các thành phần sau:

### A. Backend Core & Schemas:
| Đường Dẫn Nguồn (Source) | Vị Trí Đích (Destination) | Chức Năng |
| :--- | :--- | :--- |
| `backend/src/modules/tkgd-automation/` | `src/modules/tkgd-automation/` | Toàn bộ Controller, Service xử lý API |
| `backend/src/schemas/tkgd-user-config.schema.ts` | `src/schemas/tkgd-user-config.schema.ts` | Schema cấu hình tài khoản TTBT |
| `backend/src/schemas/raw-account-mail.schema.ts` | `src/schemas/raw-account-mail.schema.ts` | Schema lưu nguyên vẹn email |
| `backend/src/schemas/clean-account-record.schema.ts` | `src/schemas/clean-account-record.schema.ts` | Schema lưu dữ liệu sạch 5 sheet |
| `backend/src/modules/bot-engine/helpers/msystem-scraper.helper.ts` | `src/helpers/msystem-scraper.helper.ts` | Scraper M-System (Playwright) |
| `backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts` | `src/helpers/tkgd-mail-parser.helper.ts` | Helper bóc tách email regex |
| `backend/src/modules/bot-engine/helpers/tkgd-reconcile-exporter.helper.ts` | `src/helpers/tkgd-reconcile-exporter.helper.ts` | Helper đối soát & xuất file Excel |
| `backend/src/modules/bot-engine/utils/crypto.ts` | `src/utils/crypto.ts` | Mã hóa AES-256 mật khẩu & PIN |

### B. Frontend Pages & Components:
| Đường Dẫn Nguồn (Source) | Vị Trí Đích (Destination) | Chức Năng |
| :--- | :--- | :--- |
| `frontend/src/app/admin/tkgd-config/page.tsx` | `src/app/config/page.tsx` | Trang Cấu hình riêng của TTBT |
| `frontend/src/app/admin/tkgd-dashboard/page.tsx` | `src/app/dashboard/page.tsx` | Trang Giám sát & Bấm chạy đối soát |

### C. Mẫu Template Excel:
| Đường Dẫn Nguồn (Source) | Vị Trí Đích (Destination) | Chức Năng |
| :--- | :--- | :--- |
| `POC/TKGD-Automation/inputs/excel-templates/Auto Data mail.xlsm` | `templates/Auto Data mail.xlsm` | File mẫu 5 sheet chuẩn của MXV |

---

## 3. CẤU HÌNH MÔI TRƯỜNG TÁCH BIỆT (`.env`)

Tạo file `.env` riêng biệt cho dự án độc lập:

```env
# 1. Cổng chạy Backend riêng (tránh trùng port 5000 của MXV Checklist)
PORT=5050
NODE_ENV=production

# 2. Database MongoDB riêng biệt (hoặc cụm riêng của TTBT)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mxv_clearing_tkgd?retryWrites=true&w=majority

# 3. Khóa bí mật mã hóa AES (Mã hóa mật khẩu & PIN M-System)
JWT_SECRET=mxv_clearing_tkgd_secret_key_2026

# 4. Cấu hình Microsoft 365 OAuth (Hộp thư TTBT)
MICROSOFT_CLIENT_ID=your_azure_client_id_here
MICROSOFT_TENANT_ID=your_azure_tenant_id_here
MICROSOFT_CLIENT_SECRET=your_azure_client_secret_here
MICROSOFT_WATCHER_EMAIL=clearing.acc@mxv.vn

# 5. Đường dẫn thư mục mạng lưu file Excel
TKGD_OUTPUT_ROOT=/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD
```

---

## 4. QUY TRÌNH 4 BƯỚC TRIỂN KHAI ĐỘC LẬP TRÊN SERVER

### Bước 1: Khởi tạo thư mục dự án mới
```bash
mkdir mxv-tkgd-standalone
cd mxv-tkgd-standalone
npm init -y
```

### Bước 2: Cài đặt các thư viện cần thiết (Tối giản & Siêu nhẹ)
```bash
npm install @nestjs/common @nestjs/core @nestjs/mongoose mongoose playwright-core exceljs dotenv
npm install --save-dev typescript @types/node ts-node
```

### Bước 3: Cài đặt trình duyệt Playwright Chromium
```bash
npx playwright install chromium
```

### Bước 4: Khởi chạy bằng PM2 (Chạy ngầm 24/7)
```bash
pm2 start "npm run start:prod" --name "mxv-tkgd-service"
pm2 save
```

---

## 5. CÁC KỊCH BẢN VẬN HÀNH SAU KHI TÁCH

1. **Vận hành tự động hoàn toàn (Auto Scheduled Cron)**:
   - Cứ mỗi 15 phút hoặc 30 phút trong ca làm việc:
   - Bot tự động thức dậy ➔ Kiểm tra mail mới từ `clearing.acc@mxv.vn` ➔ Đăng nhập M-System ➔ Bóc tách và xuất file Excel vào `M:\Tailieuchung\QLGD-IT\...\Mo TKGD`.
   - Chuyên viên TTBT chỉ cần mở file Excel làm việc.

2. **Vận hành qua Web Dashboard (On-Demand)**:
   - Chuyên viên TTBT mở trình duyệt tại: `http://tkgd.mxv.vn` (hoặc IP server nội bộ).
   - Bấm nút **[ Chạy Đối Soát Ngay]** bất cứ khi nào có đợt hồ sơ mới gửi sang.

---

## 🎯 KẾT LUẬN

Nhờ việc tuân thủ triệt để nguyên tắc **tách rời tài khoản, tách rời Schema và đóng gói độc lập**, khi anh muốn tách riêng dự án này ra, công việc chỉ đơn giản là:
1. Sao chép đúng danh sách file ở Mục 2.
2. Cấu hình file `.env` ở Mục 3.
3. Chạy lệnh cài đặt ở Mục 4.

Toàn bộ quá trình chỉ mất **dưới 10 phút** và đảm bảo 100% không làm ảnh hưởng đến bất kỳ dòng code hay dữ liệu nào của hệ thống `mxv-shift-checklist`!
