# 📘 Hướng Dẫn Triển Khai Native (Không Docker): Node.js, PM2, MongoDB & Nginx

Tài liệu này hướng dẫn chi tiết các bước cài đặt hệ thống **MXV Shift Checklist** trực tiếp trên hệ điều hành Ubuntu (mô hình Native), sử dụng **PM2** quản lý ứng dụng, **MongoDB** lưu trữ database và **Nginx** làm reverse proxy. 

Đây là mô hình triển khai truyền thống và tối ưu tài nguyên nhất (đặc biệt cho máy chủ cấu hình RAM ≤ 4GB), hoàn toàn thống nhất theo chỉ đạo hướng dẫn của anh **Trần Văn Tú (Lead)**.

---

## 1. Chuẩn Bị Công Cụ

* **SSH Client:** Tải và cài đặt **MobaXterm** (bản Free Home Edition) tại [mobaxterm.mobatek.net](https://mobaxterm.mobatek.net/download.html). 
  * *Lý do:* MobaXterm hỗ trợ thanh điều hướng SFTP bên trái giúp kéo thả, upload mã nguồn từ máy cá nhân lên server cực kỳ tiện lợi.

---

## 2. Các Bước Cài Đặt Chi Tiết trên Ubuntu

Kết nối vào máy chủ bằng MobaXterm qua IP `10.0.0.26` (user `mxvadmin`, password `MxV!,#2o26`). Thực hiện chạy các lệnh sau:

### Bước 1: Cài đặt Node.js (Phiên bản LTS v20.x)
Sử dụng NodeSource PPA chính thức để cài đặt Node.js ổn định:

```bash
# 1. Tải và thiết lập repository NodeSource v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 2. Cài đặt Node.js và npm
sudo apt-get install -y nodejs

# 3. Kiểm tra phiên bản
node -v  # Mong muốn: v20.x.x
npm -v   # Mong muốn: v10.x.x
```

---

### Bước 2: Cài đặt MongoDB Community Edition (v8.0)
Do Ubuntu 24.04 (Noble) mới ra mắt, MongoDB khuyến nghị sử dụng phiên bản **v8.0** để hỗ trợ tốt nhất trên hệ điều hành này. 

Thực hiện các lệnh sau để cài đặt:

```bash
# 1. Xoá file cấu hình lỗi 404 của bản 7.0 (nếu đã lỡ tạo ở bước trước)
sudo rm -f /etc/apt/sources.list.d/mongodb-org-7.0.list

# 2. Nhập khóa GPG chính thức của MongoDB v8.0
curl -fsSL https://pgp.mongodb.com/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor

# 3. Tạo danh sách repository MongoDB v8.0 cho Ubuntu 24.04
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# 4. Cập nhật danh sách gói và cài đặt MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# 5. Khởi động và kích hoạt dịch vụ MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# 6. Kiểm tra trạng thái hoạt động của MongoDB
sudo systemctl status mongod  # Kỳ vọng thấy dòng màu xanh: active (running)
```

---

### Bước 3: Cài đặt Nginx làm Web Gateway
```bash
# 1. Cài đặt Nginx
sudo apt install -y nginx

# 2. Khởi động Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

### Bước 4: Cài đặt PM2 (Process Manager)
Cài đặt PM2 toàn cục để quản lý các tiến trình Node.js chạy ngầm, tự động restart khi crash:
```bash
sudo npm install -g pm2
```

---

### Bước 5: Upload và Cấu Hình Dự Án

*Lưu ý quan trọng:* Thư mục `/opt` trên Linux mặc định chỉ có quyền `root` được ghi dữ liệu. Để có thể kéo thả upload code qua SFTP MobaXterm bằng tài khoản `mxvadmin`, anh/chị cần đăng nhập Terminal gõ lệnh tạo thư mục và phân quyền trước:
```bash
# 1. Tạo thư mục chứa dự án
sudo mkdir -p /opt/mxv-checklist

# 2. Phân quyền sở hữu thư mục cho tài khoản hiện tại (mxvadmin)
sudo chown -R $USER:$USER /opt/mxv-checklist
```

Sau đó thực hiện:
1. Sử dụng thanh công cụ SFTP của **MobaXterm** bên tay trái, điều hướng đến thư mục vừa tạo `/opt/mxv-checklist`.
2. Kéo thả toàn bộ các file và thư mục source code dự án vào đây.
3. Tạo file cấu hình môi trường `.env` cho Backend và Frontend:

#### Cấu hình Backend:
Tạo file `/opt/mxv-checklist/backend/.env` bằng lệnh `nano /opt/mxv-checklist/backend/.env`:
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/checklist
JWT_SECRET=Chuoi_Khoa_Bao_Mat_Ngau_Nhien_32_Ky_Tu
RPA_AGENT_MODE=remote
RPA_AGENT_API_KEY=mxv_rpa_secure_agent_key_2026
TELEGRAM_BOT_TOKEN=Token_Telegram_Bot_Neu_Co
TZ=Asia/Ho_Chi_Minh
```

#### Cấu hình Frontend:
Tạo file `/opt/mxv-checklist/frontend/.env` bằng lệnh `nano /opt/mxv-checklist/frontend/.env`:
```env
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost/api
TZ=Asia/Ho_Chi_Minh
```

---

### Bước 6: Build & Khởi Chạy Ứng Dụng với PM2

#### 1. Khởi động Backend (NestJS):
```bash
cd /opt/mxv-checklist/backend

# Cài đặt thư viện dependencies
npm install

# Build dự án (kết quả biên dịch nằm trong thư mục /dist)
npm run build

# Khởi chạy NestJS bằng PM2
pm2 start dist/main.js --name "mxv-backend"
```

#### 2. Khởi động Frontend (Next.js):
```bash
cd /opt/mxv-checklist/frontend

# Cài đặt thư viện dependencies
npm install

# Build dự án
npm run build

# Khởi chạy Next.js bằng PM2 (chạy trực tiếp file bin của next để PM2 giám sát tiến trình chuẩn nhất)
pm2 start node_modules/next/dist/bin/next --name "mxv-frontend" -- start -- -p 3000
```

#### 3. Kiểm tra trạng thái PM2:
```bash
pm2 status
```
**Kết quả hiển thị mong đợi:**
```text
┌────┬─────────────────┬──────────┬─────────┬─────────┬──────────┬────────┐
│ id │ name            │ mode     │ status  │ cpu     │ memory   │ user   │
├────┼─────────────────┼──────────┼─────────┼─────────┼──────────┼────────┤
│ 0  │ mxv-backend     │ fork     │ online  │ 0%      │ 45.2mb   │ root   │
│ 1  │ mxv-frontend    │ fork     │ online  │ 0%      │ 52.1mb   │ root   │
└────┴─────────────────┴──────────┴─────────┴─────────┴──────────┴────────┘
```

#### 4. Cấu hình PM2 tự động khởi chạy khi Server Reboot:
```bash
pm2 startup
# Chạy lệnh xuất hiện trên màn hình hiển thị sau lệnh trên, sau đó gõ:
pm2 save
```

---

### Bước 7: Cấu Hình Nginx Reverse Proxy

Mở cấu hình Nginx để điều hướng cổng 80 vào các port ứng dụng:
```bash
sudo nano /etc/nginx/sites-available/default
```

Thay thế nội dung file bằng cấu hình sau:
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    client_max_body_size 50M;

    # Frontend Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend NestJS API
    location /api {
        proxy_pass http://127.0.0.1:3001/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.io WebSockets
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Kiểm tra và tải lại cấu hình Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```
