# 📘 Hướng Dẫn Triển Khai Native Hệ Thống Đối Soát & Thẩm Định Mở TKGD (VNC-CIC-01)

Tài liệu này hướng dẫn chi tiết các bước triển khai độc lập phân hệ **Đối Soát & Thẩm Định Hồ Sơ Mở Tài Khoản Giao Dịch (MXV TKGD Reconciler)** trực tiếp trên hệ điều hành Ubuntu máy chủ mới **VNC-CIC-01**, tách biệt hoàn toàn khỏi hệ thống Checklist hiện tại.

---

## 📌 Thông Tin Hạ Tầng & Quy Hoạch Tài Nguyên

- **Tên máy chủ:** `VNC-CIC-01`
- **Địa chỉ IP:** `10.1.0.16`
- **Tài khoản đăng nhập (SSH / SFTP):** `vncadmin` / `CiC=,!2o26`
- **Đường dẫn triển khai độc lập:** `/opt/mxv-tkgd`
  - **Backend API (NestJS + Python OCR + Playwright):** `/opt/mxv-tkgd/backend` (Cổng nội bộ `3005`)
  - **Frontend UI (Next.js Dashboard):** `/opt/mxv-tkgd/frontend` (Cổng nội bộ `3006`)
- **Web Gateway (Nginx Reverse Proxy):** Cổng `80`
  - `http://10.1.0.16/` $\rightarrow$ Điều hướng tới Giao diện Next.js (`http://127.0.0.1:3006`)
  - `http://10.1.0.16/api/` $\rightarrow$ Điều hướng tới API NestJS (`http://127.0.0.1:3005/api/`)
- **Cơ sở dữ liệu:** MongoDB Community Edition (v8.0) chạy local trên `10.1.0.16:27017` (Database: `mxv_tkgd_reconciler`)

---

## 1. Chuẩn Bị & Kết Nối Máy Chủ

1. Mở **MobaXterm** (hoặc SSH Client), tạo một SSH Session mới:
   - **Remote host:** `10.1.0.16`
   - **Specify username:** `vncadmin`
   - **Port:** `22`
   - **Password:** `CiC=,!2o26`
2. Cập nhật danh sách gói hệ thống:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 2. Cài Đặt Các Thành Phần Nền Tảng (Prerequisites)

### Bước 1: Cài đặt Node.js (v20.x LTS) & PM2

```bash
# 1. Thêm kho lưu trữ NodeSource v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 2. Cài đặt Node.js và npm
sudo apt install -y nodejs

# 3. Kiểm tra phiên bản
node -v   # Kỳ vọng: v20.x.x
npm -v    # Kỳ vọng: v10.x.x

# 4. Cài đặt PM2 toàn cục
sudo npm install -g pm2
```

---

### Bước 2: Cài đặt Python 3, Tesseract OCR Tiếng Việt & Chromium

> [!IMPORTANT]
> Phân hệ TKGD bắt buộc sử dụng **Tesseract OCR (vie + eng)** để bóc tách thông tin thẻ CCCD/hộ chiếu và **Chromium/Chrome** cho dịch vụ cào dữ liệu M-System (`playwright-core`).

Thực hiện cài đặt đầy đủ các gói thư viện C và công cụ OCR:

```bash
# 1. Cài đặt Python, pip, Tesseract OCR kèm từ điển tiếng Việt và Poppler
sudo apt install -y python3 python3-pip python3-venv tesseract-ocr tesseract-ocr-vie libgl1 poppler-utils chromium-browser

# 2. Kiểm tra ngôn ngữ Tesseract OCR khả dụng
tesseract --list-langs
# Kết quả kỳ vọng phải chứa cả "eng" và "vie"

# 3. Kiểm tra đường dẫn trình duyệt Chromium
which chromium-browser || which chromium
# Kết quả: /usr/bin/chromium-browser hoặc /usr/bin/chromium
```

---

### Bước 3: Cài đặt MongoDB Community Edition (v8.0)

Cài đặt MongoDB cục bộ để hệ thống tự chủ dữ liệu, tối ưu tốc độ đọc ghi IOPS:

```bash
# 1. Nhập khóa GPG chính thức của MongoDB v8.0
curl -fsSL https://pgp.mongodb.com/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor

# 2. Thêm repository MongoDB v8.0 (Ubuntu Noble 24.04)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# 3. Cập nhật và cài đặt MongoDB
sudo apt update
sudo apt install -y mongodb-org

# 4. Khởi động và bật tự chạy MongoDB cùng hệ thống
sudo systemctl start mongod
sudo systemctl enable mongod

# 5. Kiểm tra trạng thái MongoDB
sudo systemctl status mongod   # Trạng thái kỳ vọng: active (running)
```

---

### Bước 4: Cài đặt Nginx làm Web Gateway

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 3. Tạo Thư Mục Triển Khai & Phân Quyền

Tạo cấu trúc thư mục độc lập `/opt/mxv-tkgd` và phân quyền cho người dùng `vncadmin`:

```bash
# 1. Tạo thư mục chứa Backend, Frontend, Thư mục File đính kèm và Logs
sudo mkdir -p /opt/mxv-tkgd/backend
sudo mkdir -p /opt/mxv-tkgd/frontend
sudo mkdir -p /opt/mxv-tkgd/backend/data/attachments
sudo mkdir -p /opt/mxv-tkgd/backend/logs
sudo mkdir -p /opt/mxv-tkgd/frontend/logs

# 2. Phân quyền sở hữu toàn bộ cho vncadmin
sudo chown -R $USER:$USER /opt/mxv-tkgd
```

---

## 4. (Tùy chọn) Ánh Xạ Ổ Mạng Dữ Liệu Hồ Sơ (`/mnt/qlgd-it`)

Nếu hệ thống dùng chung kho lưu trữ hồ sơ đính kèm với phòng Quản lý Giao dịch qua giao thức SMB/CIFS:

```bash
# 1. Cài đặt cifs-utils
sudo apt install -y cifs-utils

# 2. Tạo điểm gắn kết
sudo mkdir -p /mnt/qlgd-it

# 3. Mount ổ mạng (Ví dụ ánh xạ từ server dữ liệu nội bộ)
# sudo mount -t cifs "//10.0.0.26/Tailieuchung/QLGD-IT" /mnt/qlgd-it -o username=YOUR_USER,password=YOUR_PASS,iocharset=utf8,file_mode=0777,dir_mode=0777
```

_(Nếu lưu trữ trực tiếp trên đĩa local của máy chủ `10.1.0.16`, hệ thống sẽ tự động lưu vào `/opt/mxv-tkgd/backend/data/attachments`)._

---

## 5. Upload Mã Nguồn Lên Máy Chủ

Sử dụng khung truyền file **SFTP** bên trái giao diện MobaXterm:

1. **Upload Backend:**
   - Kéo toàn bộ nội dung thư mục `mxv-account-opening-reconciler` vào `/opt/mxv-tkgd/backend/`.
   - _Lưu ý bỏ qua:_ thư mục `node_modules`, `dist`, `.cache`, `.git`.
2. **Upload Frontend:**
   - Kéo toàn bộ nội dung thư mục `mxv-account-opening-reconciler-ui` vào `/opt/mxv-tkgd/frontend/`.
   - _Lưu ý bỏ qua:_ thư mục `node_modules`, `.next`, `.git`.

---

## 6. Cấu Hình File Môi Trường (`.env`)

### 1. Cấu hình Backend:

Tạo file cấu hình `/opt/mxv-tkgd/backend/.env`:

```bash
nano /opt/mxv-tkgd/backend/.env
```

Dán nội dung sau:

```env
# Cổng API Backend
PORT=3005

# Kết nối CSDL MongoDB Local
MONGODB_URI=mongodb://127.0.0.1:27017/mxv_tkgd_reconciler

# Thông tin đăng nhập M-System (Duy trì phiên cào dữ liệu)
MS_URL=https://msadmin.mxv.com.vn/
MS_USERNAME=mxvsupport
MS_PASSWORD=YourPasswordHere
MS_PIN=123456

# Microsoft Graph API (Đọc hòm thư clearing.acc@mxv.vn thời gian thực)
MICROSOFT_CLIENT_ID=c35a8ea2-a975-4b22-bd22-f490f80931ce
MICROSOFT_CLIENT_SECRET=vgq8Q~KG65lizTdASJOphg~06XRlVDZadMf_daD8
MICROSOFT_TENANT_ID=b83638b2-3312-4ed3-84dd-fcc24c5d76a2

# Đường dẫn lưu trữ tài liệu, hợp đồng và ảnh CCCD bóc tách
ATTACHMENT_STORAGE_PATH=/opt/mxv-tkgd/backend/data/attachments

# Bật tác vụ quét tự động (Scheduler)
ENABLE_TKGD_BACKGROUND_WORKER=true

# Múi giờ chuẩn Việt Nam
TZ=Asia/Ho_Chi_Minh
```

---

### 2. Cấu hình Frontend:

Tạo file cấu hình `/opt/mxv-tkgd/frontend/.env.local`:

```bash
nano /opt/mxv-tkgd/frontend/.env.local
```

Dán nội dung sau:

```env
# Cổng ứng dụng Next.js
PORT=3006

# URL API của Backend (Trỏ qua cổng Nginx 80 hoặc IP máy chủ)
NEXT_PUBLIC_API_URL=http://10.1.0.16
TZ=Asia/Ho_Chi_Minh
```

---

## 7. Cài Đặt Thư Viện, Build & Khởi Chạy PM2

### 1. Khởi động Backend (NestJS + Python Worker):

```bash
cd /opt/mxv-tkgd/backend

# 1. Cài đặt các thư viện Python cho tác vụ bóc tách OCR
pip3 install -r requirements.txt --break-system-packages

# 2. Cài đặt npm dependencies
npm install

# 3. Biên dịch dự án NestJS
npm run build

# 4. Khởi chạy bằng PM2
pm2 start ecosystem.config.js
```

---

### 2. Khởi động Frontend (Next.js):

```bash
cd /opt/mxv-tkgd/frontend

# 1. Cài đặt npm dependencies
npm install

# 2. Biên dịch giao diện Next.js
npm run build

# 3. Khởi chạy bằng PM2
pm2 start ecosystem.config.js
```

---

### 3. Kiểm tra trạng thái PM2 & Lưu cấu hình tự chạy:

```bash
# Kiểm tra danh sách tiến trình
pm2 status
```

_Kết quả hiển thị kỳ vọng:_

```text
┌────┬─────────────────────────────────┬──────────┬─────────┬─────────┬──────────┬────────┐
│ id │ name                            │ mode     │ status  │ cpu     │ memory   │ user   │
├────┼─────────────────────────────────┼──────────┼─────────┼─────────┼──────────┼────────┤
│ 0  │ mxv-account-opening-reconciler  │ fork     │ online  │ 0%      │ 78.4mb   │ vncadm │
│ 1  │ mxv-account-opening-reconciler-ui│ fork    │ online  │ 0%      │ 62.1mb   │ vncadm │
└────┴─────────────────────────────────┴──────────┴─────────┴─────────┴──────────┴────────┘
```

Thiết lập khởi động tự động khi reboot máy chủ:

```bash
pm2 startup
# Copy và thực thi dòng lệnh hiển thị trên màn hình nếu có, sau đó chạy:
pm2 save
```

---

## 8. Cấu Hình Nginx Reverse Proxy (Cổng 80)

Mở file cấu hình Nginx:

```bash
sudo nano /etc/nginx/sites-available/default
```

Thay thế toàn bộ nội dung file bằng cấu hình dưới đây:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # Cho phép upload hợp đồng PDF / ảnh CCCD dung lượng lớn
    client_max_body_size 100M;

    # 1. Frontend Dashboard Next.js (Port 3006)
    location / {
        proxy_pass http://127.0.0.1:3006;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 2. Backend NestJS API (Port 3005)
    location /api {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Timeout dự phòng cho các tác vụ OCR / bóc tách hồ sơ PDF nặng
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
}
```

Kiểm tra cú pháp và tải lại Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔟 Công Cụ Tự Động Đồng Bộ 1-Click (`sync_to_server.bat` / `sync_to_server.py`)

Hệ thống đã được tích hợp sẵn công cụ đồng bộ tự động trực tiếp từ máy cá nhân lên server `10.1.0.16` mà **không cần kéo thả file thủ công**:

* **Cách 1 (Nhanh nhất trên Windows):** Click đúp vào file [`sync_to_server.bat`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/sync_to_server.bat) ở thư mục gốc:
  * `[1]`: Đồng bộ TOÀN BỘ CODE (Backend + Frontend)
  * `[2]`: Chỉ đồng bộ BACKEND CODE
  * `[3]`: Chỉ đồng bộ FRONTEND CODE
  * `[4]`: Chỉ copy file nhanh (không build)
  * `[5]`: **SAO LƯU & ĐỒNG BỘ DATABASE TKGD** (Từ server cũ `10.0.0.26` sang `10.1.0.16` chỉ mất 5 giây)
  * `[6]`: **SAO LƯU TOÀN BỘ DATABASE** (Gồm cả ca trực, user, checklist)
* **Cách 2 (Click đúp chuyên biệt cho Database):**
  * Click đúp file [`sync_db_to_server.bat`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/sync_db_to_server.bat) để tự động backup và restore sang server mới ngay lập tức.
* **Cách 3 (Gõ lệnh terminal):**
  ```bash
  python sync_to_server.py            # Đồng bộ cả 2 phân hệ code (~20s)
  python sync_db_to_server.py         # Đồng bộ dữ liệu TKGD sang server mới (~5s)
  python sync_db_to_server.py --all   # Đồng bộ toàn bộ Database (~10s)
  ```
* **Cơ chế bảo vệ dữ liệu:** Mỗi lần chạy sao lưu database, hệ thống sẽ tự động lưu 1 bản nén có đóng dấu thời gian vào thư mục [`backups/db/`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backups/db) trên máy tính của bạn để phòng ngừa rủi ro.


1. **Kiểm tra phản hồi Backend API:**

```bash
curl http://localhost:3005/api/v1/tkgd/config
```

## 11. Hướng Dẫn Truy Cập Giao Diện Web Dashboard

Do máy chủ `10.1.0.16` nằm ở phân vùng mạng máy chủ (Server VLAN) và máy tính cá nhân nằm ở phân vùng nhân viên (`10.0.19.x`), cổng mạng **80 (HTTP)** bị chặn bởi Firewall nội bộ trong khi cổng **22 (SSH)** đã được mở sẵn.

Bạn có 2 cách để mở và sử dụng Dashboard:

### 🌟 Cách 1: 1-Click Mở Ngay Lập Tức (Khuyên Dùng)
Không cần cấu hình mạng hay xin IT mở port, hệ thống đã chuẩn bị sẵn file kết nối thông minh:
1. Nhấp đúp chuột vào file: [`open_tkgd_web.bat`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/open_tkgd_web.bat)
2. Script sẽ tự động thiết lập đường truyền mã hóa SSH an toàn tới cổng 80 của server và **tự động bật trình duyệt web** đưa bạn thẳng tới:
   👉 **`http://localhost:8080`**
3. Giữ cửa sổ terminal chạy ngầm trong lúc làm việc. Khi xong việc, chỉ cần nhấn `Ctrl + C` hoặc đóng cửa sổ terminal.

---

### 🌐 Cách 2: Truy Cập Trực Tiếp Qua IP `http://10.1.0.16`
- **Điều kiện**: Nhờ bộ phận IT / Hạ tầng mạng MXV mở Policy Firewall cho phép dải IP máy tính của bạn truy cập cổng **80 (HTTP)** tới đích `10.1.0.16`.
- Sau khi IT mở cổng, bạn và các đồng nghiệp trong phòng có thể gõ trực tiếp trên trình duyệt:
  👉 **`http://10.1.0.16`**

---

### 🛠️ Cách 3: Dùng SSH Tunnel trên MobaXterm
Nếu bạn đang mở sẵn MobaXterm:
1. Vào menu **Tunneling** $\rightarrow$ Chọn **New SSH tunnel**.
2. Chọn **Local port forwarding**:
   - `Forwarded port`: `8080`
   - `SSH server`: `10.1.0.16`, `Port`: `22`, `User`: `vncadmin`
   - `Remote server`: `127.0.0.1`, `Remote port`: `80`
3. Bấm **Save** $\rightarrow$ Bấm nút **Start** (biểu tượng Play màu xanh).
4. Mở trình duyệt gõ: `http://localhost:8080`.

---

## 12. Theo Dõi Log & Giám Sát Hoạt Động

```bash
# Xem log Backend (M-System crawler, OCR, Microsoft Graph sync)
pm2 logs mxv-account-opening-reconciler

# Xem log Frontend (Next.js Dashboard)
pm2 logs mxv-account-opening-reconciler-ui

# Xem trạng thái tài nguyên CPU / RAM
pm2 monit
```

