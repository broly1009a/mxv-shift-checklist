# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG (DEPLOYMENT GUIDE)
## MXV SHIFT CHECKLIST SYSTEM

Tài liệu này hướng dẫn chi tiết từng bước triển khai hệ thống MXV Shift Checklist lên môi trường thử nghiệm (UAT) và sản xuất (Production).

---

## 1. Yêu Cầu Cài Đặt Ban Đầu (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy chủ chạy hệ thống (Windows Server hoặc Linux) đã cài đặt các phần mềm sau:

1. **Node.js**: Phiên bản LTS mới nhất (Khuyến nghị **v20.x** hoặc **v22.x**).
2. **MongoDB**: Phiên bản **v6.x** trở lên. (Có thể dùng MongoDB Community Server cục bộ hoặc MongoDB Atlas đám mây).
3. **Python (Tùy chọn)**: Phiên bản **3.10.x** trở lên nếu chạy các script đối chiếu số lot hoặc RPA viết bằng Python.
4. **PM2**: Bộ quản lý tiến trình Node.js chạy ngầm (`npm install -g pm2`).

---

## 2. Cấu Hình Biến Môi Trường (`.env`)

Tạo file `.env` tại thư mục gốc của **backend** (`backend/.env`) với nội dung như sau:

```ini
PORT=3001
NODE_ENV=production

# Kết nối cơ sở dữ liệu MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/trading_mxv

# Cấu hình bảo mật JWT Token
JWT_SECRET=ThayTheBangMotChuoiBiMatSieuKho123!
JWT_EXPIRATION=24h

# Cấu hình Telegram Bot để gửi cảnh báo lỗi tức thời
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=YOUR_TELEGRAM_CHAT_ID

# Đường dẫn bộ chạy Python (nếu dùng script Python)
PYTHON_PATH=python
```

Tạo file `.env.production` tại thư mục gốc của **frontend** (`frontend/.env.production`):

```ini
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

## 3. Triển Khai Backend (NestJS)

Di chuyển vào thư mục `backend` và thực hiện các lệnh sau:

### Bước 3.1: Cài đặt thư viện phụ thuộc
```bash
cd backend
npm install
```

### Bước 3.2: Biên dịch code sang JavaScript
```bash
npm run build
```
*Lưu ý*: Lệnh này sẽ tạo ra thư mục `backend/dist/` chứa mã nguồn đã biên dịch.

### Bước 3.3: Cài đặt môi trường chạy Playwright (nếu dùng Playwright trong Backend NodeJS)
```bash
npx playwright install chromium
npx playwright install-deps
```

### Bước 3.4: Chạy Backend dưới dạng dịch vụ ngầm bằng PM2
```bash
pm2 start dist/main.js --name "mxv-backend"
pm2 save
```

---

## 4. Triển Khai Frontend (Next.js)

Di chuyển vào thư mục `frontend` và thực hiện các lệnh sau:

### Bước 4.1: Cài đặt thư viện phụ thuộc
```bash
cd ../frontend
npm install
```

### Bước 4.2: Build tối ưu hóa ứng dụng Production
```bash
npm run build
```

### Bước 4.3: Chạy Frontend bằng PM2
```bash
pm2 start npm --name "mxv-frontend" -- start
pm2 save
```

---

## 5. Cài đặt Kịch Bản RPA & Cấu Hình Đường Dẫn File

### Bước 5.1: Đặt các file Script tự động hóa
* Sao chép toàn bộ thư mục chứa kịch bản chạy bot (`run_lot_macro.py`, `download_cast.py`...) vào thư mục cố định trên máy chủ, ví dụ: `C:\POC\scripts\` hoặc `/opt/poc/scripts/`.

### Bước 5.2: Khai báo đường dẫn trên giao diện Admin
1. Đăng nhập vào hệ thống bằng tài khoản Quản trị viên (Admin).
2. Vào phần cài đặt hệ thống để cập nhật các tham số sau khớp với thực tế máy chủ:
   * **Đường dẫn thư mục sao lưu MS**: Ví dụ `M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures`
   * **Đường dẫn thư mục sao lưu CQG**: Ví dụ `M:\Quanlygiaodich\Tai lieu hoat dong\Backup CQG\Futures`
   * **Đường dẫn bộ dịch Python**: `python` hoặc đường dẫn đến file `python.exe`.
   * **Đường dẫn file Macro Excel**: Ví dụ `C:\POC\macros\Macro thong ke so lot giao dich co ACM.xlsm`.

---

## 6. Lệnh PM2 Hữu Ích Để Giám Sát Hệ Thống

Sau khi deploy thành công, sử dụng các lệnh sau để kiểm tra trạng thái hoạt động của các dịch vụ:

* **Xem danh sách dịch vụ đang chạy**:
  ```bash
  pm2 list
  ```
* **Theo dõi log lỗi thời gian thực**:
  ```bash
  pm2 logs
  ```
* **Khởi động lại dịch vụ**:
  ```bash
  pm2 restart mxv-backend
  pm2 restart mxv-frontend
  ```
* **Theo dõi hiệu năng sử dụng CPU/RAM của server**:
  ```bash
  pm2 monit
  ```
