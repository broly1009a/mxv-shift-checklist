# 📋 Hướng Dẫn Triển Khai: MXV Shift Checklist
## Mô hình Hybrid — Core Linux Server + Windows RPA Agent

> **Phiên bản:** 1.0 | **Ngày:** 2026-07-15

---

## 1. Tổng Quan Kiến Trúc

```
┌─────────────────────── LINUX SERVER ──────────────────────────┐
│                                                                │
│   [Nginx :80/443]  ←── Reverse Proxy                         │
│        │                                                       │
│   ┌────┴──────────┐                                           │
│   │               │                                           │
│ [Next.js :3000] [NestJS :3001]  ←── Core Backend             │
│                      │                                        │
│                 [MongoDB :27017]  ←── Cơ sở dữ liệu          │
└──────────────────────────────────────────────────────────────-┘
                         │
              HTTP REST Polling (mỗi 5 giây)
                         │
┌──────────────── WINDOWS PC (máy IT cũ) ───────────────────────┐
│                                                                │
│   [agent.py]  ←── Python script chạy ngầm                    │
│        │                                                       │
│   ┌────┴──────────────┐                                       │
│   │                   │                                       │
│ [run_lot_macro.py]  [Playwright Browser]                      │
│ [run_value_macro.py] [WinSCP CLI]                             │
│        │                                                       │
│   [Microsoft Excel + VBA Macros (.xlsm)]                      │
└──────────────────────────────────────────────────────────────-┘
```

### Phân chia trách nhiệm

| Thành phần | Chạy trên | Nhiệm vụ |
|------------|-----------|----------|
| NestJS Backend | Linux Docker | Quản lý job queue, API, đối chiếu SOD/EOD |
| Next.js Frontend | Linux Docker | Giao diện Web cho ca trực |
| MongoDB | Linux Docker | Lưu trữ dữ liệu, logs, trạng thái job |
| Nginx | Linux Docker | Reverse proxy, cân bằng tải |
| RPA Agent (`agent.py`) | Windows | Nhận job, chạy Excel Macro, Playwright, upload kết quả |

---

## 2. Yêu Cầu Hệ Thống

### 2.1. Linux Server

| Thành phần | Tối thiểu |
|------------|-----------|
| Hệ điều hành | Ubuntu 22.04 LTS hoặc Debian 12 |
| CPU | 2 vCPU |
| RAM | 2 GB (khuyến nghị 4 GB) |
| Disk | 20 GB SSD |
| Docker Engine | 24.x+ |
| Docker Compose | v2.x+ |
| Cổng mở | 80 (HTTP), 443 (HTTPS, tuỳ chọn), 27017 (chỉ nội bộ) |

### 2.2. Windows PC (máy RPA Agent)

| Thành phần | Yêu cầu |
|------------|---------|
| Hệ điều hành | Windows 10/11 hoặc Windows Server 2019+ |
| Python | 3.10 — 3.12 (64-bit), thêm vào PATH |
| Microsoft Excel | 2016+ với tính năng VBA Macros được bật |
| WinSCP | Phiên bản mới nhất, CLI `WinSCP.com` thêm vào PATH |
| RAM | ≥ 4 GB (để Excel + Playwright hoạt động tốt) |
| Quyền | Administrator (để đăng ký Windows Scheduled Task) |
| Kết nối mạng | Phải kết nối được tới IP của Linux Server |

---

## 3. Cấu Trúc Thư Mục Deployment

```
mxv-shift-checklist/
└── deployment/
    ├── docker-compose.yml        ← Kịch bản orchestration Docker
    ├── Dockerfile.backend        ← Build image cho NestJS
    ├── Dockerfile.frontend       ← Build image cho Next.js
    ├── nginx.conf                ← Cấu hình Reverse Proxy
    └── rpa-agent/
        ├── agent.py              ← Script Python chính (Agent)
        ├── config.json           ← Cấu hình Agent (IP, Key, Đường dẫn)
        ├── requirements.txt      ← Thư viện Python cần cài
        └── setup_agent.bat       ← Script cài đặt tự động (chạy 1 lần)
```

---

## 4. Triển Khai Linux Server

### Bước 4.1. Cài đặt Docker trên Linux

```bash
# Cài Docker Engine
curl -fsSL https://get.docker.com | sh

# Thêm user hiện tại vào group docker (không cần sudo mỗi lần)
sudo usermod -aG docker $USER
newgrp docker

# Kiểm tra
docker --version          # Docker version 24.x.x
docker compose version    # Docker Compose version v2.x.x
```

### Bước 4.2. Đưa mã nguồn lên Linux Server

**Cách A: Clone từ Git (khuyến nghị)**
```bash
git clone <url-repository> /opt/mxv-checklist
cd /opt/mxv-checklist
```

**Cách B: Copy thủ công từ Windows qua SCP**
```powershell
# Chạy trên Windows PowerShell
scp -r "D:\sontayweb\mxv-shift-checklist" user@<IP_LINUX>:/opt/mxv-checklist
```

### Bước 4.3. Cấu hình biến môi trường

Mở file `/opt/mxv-checklist/deployment/docker-compose.yml` và **bắt buộc** thay đổi các giá trị sau:

```yaml
# Phần backend → environment:
- JWT_SECRET=<THAY_BẰNG_CHUỖI_BÍ_MẬT_DÀI_32_KÝ_TỰ>
- TELEGRAM_BOT_TOKEN=<THAY_BẰNG_TOKEN_BOT_TELEGRAM_THẬT>
- RPA_AGENT_API_KEY=<KEY_BÍ_MẬT_PHẢI_KHỚP_VỚI_AGENT>
```

> **Cách tạo JWT_SECRET ngẫu nhiên:**
> ```bash
> openssl rand -base64 32
> # Ví dụ kết quả: xK9mN3pQ7rT2vY6wZ1aB8cD5eF4gH0iJ
> ```

> **Lưu ý bảo mật:** `RPA_AGENT_API_KEY` phải đặt **giống hệt** giá trị `api_key` trong file `config.json` của Windows Agent. Đây là chìa khóa xác thực giữa hai hệ thống.

### Bước 4.4. Build và Khởi động Docker

```bash
cd /opt/mxv-checklist/deployment

# Lần đầu tiên (hoặc khi có thay đổi code):
docker compose up -d --build

# Các lần sau (không có thay đổi code):
docker compose up -d
```

**Theo dõi quá trình build và khởi động:**
```bash
# Xem trạng thái tất cả container
docker compose ps

# Xem logs của backend (Ctrl+C để thoát)
docker compose logs -f backend

# Xem logs của frontend
docker compose logs -f frontend
```

**Kết quả thành công cần thấy:**
```
NAME           IMAGE              STATUS
mxv-mongodb    mongo:6.0          Up (healthy)
mxv-backend    deployment-backend Up
mxv-frontend   deployment-frontend Up
mxv-nginx      nginx:alpine       Up
```

### Bước 4.5. Kiểm tra Hệ thống Linux

```bash
# Kiểm tra Backend API đang chạy (401 = đang chạy, chỉ cần đăng nhập)
curl -I http://localhost/api/v1/bot-engine/config
# Kỳ vọng: HTTP/1.1 401 Unauthorized

# Kiểm tra Frontend đang chạy
curl -I http://localhost
# Kỳ vọng: HTTP/1.1 200 OK

# Kiểm tra MongoDB đã kết nối trong backend
docker compose exec backend node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('✅ MongoDB kết nối thành công');
  process.exit(0);
}).catch(e => { console.error('❌ Lỗi:', e.message); process.exit(1); });
"
```

### Bước 4.6. Đăng nhập và Cấu hình Settings

1. Mở trình duyệt vào `http://<IP_LINUX_SERVER>`
2. Đăng nhập bằng tài khoản admin
3. Vào menu **Cài đặt hệ thống (Settings)**
4. Cập nhật các đường dẫn thư mục từ định dạng Windows sang Linux:

| Setting Key | Giá trị cũ (Windows) | Giá trị mới (Linux) |
|-------------|---------------------|---------------------|
| `bot_backup_path_ms` | `C:\Quanlygiaodich\...\Backup MS\Futures` | `/app/uploads/backup/ms/Futures` |
| `bot_backup_path_cqg` | `C:\Quanlygiaodich\...\Backup CQG\Futures` | `/app/uploads/backup/cqg/Futures` |
| `bot_lot_macro_target_root` | `M:\Quanlygiaodich\...` | `/app/uploads/macro-output` |

> **Giải thích:** `/app/uploads` trong container tương ứng với Docker volume `backend_uploads` được lưu bền vững trên Linux Server. Dữ liệu không mất khi restart container.

---

## 5. Cài Đặt Windows RPA Agent

### Bước 5.1. Kiểm tra Python trên Windows

Mở **Command Prompt** hoặc **PowerShell**:
```cmd
python --version
```
Nếu chưa cài: Tải Python từ https://python.org/downloads (chọn **Add Python to PATH** khi cài).

### Bước 5.2. Cấu hình file `config.json`

Mở file `deployment\rpa-agent\config.json` và chỉnh sửa:

```json
{
  "backend_url": "http://192.168.1.100",
  "api_key": "KEY_BÍ_MẬT_PHẢI_KHỚP_VỚI_DOCKER_COMPOSE",
  "polling_interval": 5,
  "heartbeat_interval": 30,
  "paths": {
    "lot_macro_path": "D:\\sontayweb\\mxv-shift-checklist\\marco\\Thong ke so lot giao dich có ACM\\Macro thong ke so lot giao dich có ACM.xlsm",
    "value_macro_path": "D:\\sontayweb\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm",
    "ms_backup_futures": "C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures",
    "acm_backup": "C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\ACM"
  }
}
```

**Các trường quan trọng cần thay đổi:**

| Trường | Mô tả |
|--------|-------|
| `backend_url` | **Địa chỉ IP thực của Linux Server**, không phải `localhost` |
| `api_key` | **Phải giống hệt** `RPA_AGENT_API_KEY` trong `docker-compose.yml` |
| `lot_macro_path` | Đường dẫn đầy đủ đến file `.xlsm` macro số lot trên máy Windows |
| `value_macro_path` | Đường dẫn đầy đủ đến file `.xlsm` macro giá trị trên máy Windows |

### Bước 5.3. Chạy Script Cài Đặt

Nhấn chuột phải vào `setup_agent.bat` → **Run as Administrator**

Hoặc mở Command Prompt với quyền Admin:
```cmd
cd D:\sontayweb\mxv-shift-checklist\deployment\rpa-agent
setup_agent.bat
```

Script sẽ tự động thực hiện:
1. ✅ Kiểm tra Python đã cài
2. ✅ Tạo Python virtual environment (`venv/`)
3. ✅ Cài `requests`, `psutil`
4. ✅ Cài `pywin32` (cho Excel COM automation)
5. ✅ Test kết nối thử tới Backend Linux
6. ✅ Hỏi có muốn đăng ký Windows Task Scheduler không

### Bước 5.4. Chạy thử Agent để kiểm tra

```cmd
cd D:\sontayweb\mxv-shift-checklist\deployment\rpa-agent
venv\Scripts\python.exe agent.py
```

**Log mong đợi thấy:**
```
2026-07-15 19:00:00 [INFO] ============================================================
2026-07-15 19:00:00 [INFO] MXV RPA Agent started.
2026-07-15 19:00:00 [INFO] Backend: http://192.168.1.100
2026-07-15 19:00:00 [INFO] Poll interval: 5s | Heartbeat: 30s
2026-07-15 19:00:00 [INFO] ============================================================
2026-07-15 19:00:30 [INFO] Heartbeat from WINDOWS-PC-IT
```

> **Nếu thấy `Heartbeat failed`:** Kiểm tra lại `backend_url` trong `config.json` và firewall Linux có mở cổng 80 không.

### Bước 5.5. Kiểm tra Agent Online từ Linux

```bash
# Từ Linux Server
curl -H "x-agent-api-key: <API_KEY>" \
  http://localhost/api/v1/bot-engine/agent/status
```

**Kết quả thành công:**
```json
{
  "online": true,
  "hostname": "WINDOWS-PC-IT",
  "platform": "Windows",
  "lastSeenMs": 8234
}
```

---

## 6. Kiểm Tra End-to-End

### Bước 6.1. Lấy JWT Token

```bash
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your_password"}'
# Lưu lại giá trị "access_token"
TOKEN="eyJhbGci..."
```

### Bước 6.2. Enqueue Job RUN_LOT_MACRO

```bash
curl -X POST http://localhost/api/v1/bot-engine/run-lot-macro \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetDate": "2026-07-15"}'
# Kết quả: {"success": true, "jobId": "6876abc..."}
JOB_ID="6876abc..."
```

### Bước 6.3. Theo dõi tiến trình

```bash
# Xem trạng thái job (chạy nhiều lần)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/v1/bot-engine/jobs/$JOB_ID

# Xem logs job
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/v1/bot-engine/jobs/$JOB_ID/logs
```

**Luồng trạng thái bình thường:**

```
PENDING  →  (Agent poll, nhận job)
    ↓
PROCESSING  →  (Agent chạy Excel Macro trên Windows)
    ↓
COMPLETED  →  (Agent upload kết quả, Backend lưu file)
```

### Bảng trạng thái Job

| Trạng thái | Ý nghĩa | Hành động |
|-----------|---------|-----------|
| `PENDING` | Đang chờ Agent poll (tối đa 5 giây) | Chờ |
| `PROCESSING` | Agent đang thực thi Macro/Playwright | Chờ, xem logs |
| `AWAITING_CAPTCHA` | Captcha xuất hiện, cần người nhập | Vào Web UI nhập captcha |
| `COMPLETED` | Thành công, file đã upload về Linux | ✅ |
| `FAILED` | Thất bại sau khi hết số lần thử | Xem logs, fix lỗi, enqueue lại |

---

## 7. Vận Hành Hàng Ngày

### 7.1. Lệnh Docker thường dùng

```bash
# Xem trạng thái tất cả container
docker compose ps

# Xem logs realtime (Ctrl+C để thoát)
docker compose logs -f backend

# Restart khi có vấn đề
docker compose restart backend

# Restart toàn bộ hệ thống
docker compose restart

# Update code mới và rebuild
cd /opt/mxv-checklist
git pull
docker compose up -d --build

# Dừng toàn bộ hệ thống
docker compose down

# Dừng và xoá volume (XOÁ DỮ LIỆU - NGUY HIỂM!)
docker compose down -v
```

### 7.2. Backup MongoDB

```bash
# Backup dữ liệu MongoDB
docker exec mxv-mongodb mongodump \
  --db checklist \
  --out /tmp/backup_$(date +%Y%m%d)

# Copy backup ra ngoài container
docker cp mxv-mongodb:/tmp/backup_$(date +%Y%m%d) \
  /opt/backups/mongodb/

# Restore từ backup (nếu cần)
docker cp /opt/backups/mongodb/backup_20260715 mxv-mongodb:/tmp/restore
docker exec mxv-mongodb mongorestore \
  --db checklist \
  /tmp/restore/checklist
```

### 7.3. Quản lý Agent trên Windows

```powershell
# Kiểm tra Agent có đang chạy không (qua Task Scheduler)
Get-ScheduledTask -TaskName "MXV_RPA_Agent" | Select-Object State

# Xem log Agent (50 dòng cuối)
Get-Content "D:\sontayweb\mxv-shift-checklist\deployment\rpa-agent\agent.log" -Tail 50

# Dừng Agent tạm thời
Stop-ScheduledTask -TaskName "MXV_RPA_Agent"

# Khởi động lại Agent
Start-ScheduledTask -TaskName "MXV_RPA_Agent"

# Chạy Agent thủ công (để test/debug, thấy log trực tiếp)
cd D:\sontayweb\mxv-shift-checklist\deployment\rpa-agent
venv\Scripts\python.exe agent.py
```

---

## 8. Xử Lý Sự Cố (Troubleshooting)

### Agent không kết nối được Backend

**Triệu chứng:** Log Agent hiện `Heartbeat failed: Connection refused`

**Kiểm tra:**
1. Linux Server có đang chạy không: `docker compose ps`
2. Cổng 80 trên Linux có mở không: `curl http://<IP_LINUX>/`
3. `backend_url` trong `config.json` có đúng IP không
4. Firewall Windows/Linux có chặn không

### Job mãi ở trạng thái `PENDING`, Agent không nhận

**Nguyên nhân:** Thiếu biến `RPA_AGENT_MODE=remote` hoặc Agent không chạy

**Kiểm tra:**
```bash
# Xem biến môi trường của backend container
docker compose exec backend env | grep RPA
# Phải thấy: RPA_AGENT_MODE=remote và RPA_AGENT_API_KEY=...

# Kiểm tra Agent online
curl -H "x-agent-api-key: <KEY>" http://localhost/api/v1/bot-engine/agent/status
```

### Lỗi 401 Unauthorized khi Agent gọi API

**Nguyên nhân:** `api_key` trong `config.json` không khớp `RPA_AGENT_API_KEY` trong `docker-compose.yml`

**Cách fix:** Đảm bảo 2 giá trị này hoàn toàn giống nhau (phân biệt HOA/thường).

### Macro Excel không chạy được

**Triệu chứng:** Agent log hiện lỗi `win32com.client` hoặc Excel không mở được

**Kiểm tra:**
```cmd
# Kiểm tra pywin32 đã cài chưa
venv\Scripts\python.exe -c "import win32com.client; print('OK')"

# Nếu lỗi, cài lại
venv\Scripts\pip install pywin32
venv\Scripts\python.exe venv\Scripts\pywin32_postinstall.py -install
```

### Docker build thất bại ở bước `npm ci`

**Nguyên nhân:** `package-lock.json` không được commit lên Git

**Cách fix:**
```bash
# Trên Windows, trong thư mục backend hoặc frontend
npm install
git add package-lock.json
git commit -m "fix: update package-lock.json"
git push
```

---

## 9. Checklist Trước Khi Go-Live

### Linux Server
- [ ] Docker và Docker Compose đã cài
- [ ] `JWT_SECRET` đã đổi sang chuỗi bí mật mới
- [ ] `TELEGRAM_BOT_TOKEN` đã cấu hình đúng
- [ ] `RPA_AGENT_API_KEY` đã đặt (giống với Agent)
- [ ] Tất cả 4 container đang `Up` (`docker compose ps`)
- [ ] Web UI truy cập được qua trình duyệt
- [ ] Đã cập nhật đường dẫn backup trong Settings
- [ ] MongoDB backup tự động đã thiết lập

### Windows Agent
- [ ] Python 3.10+ đã cài và thêm vào PATH
- [ ] `backend_url` trong `config.json` trỏ đúng IP Linux
- [ ] `api_key` trong `config.json` khớp với `docker-compose.yml`
- [ ] Đường dẫn file `.xlsm` macro đúng và file tồn tại
- [ ] `setup_agent.bat` đã chạy thành công
- [ ] Agent log hiện `Heartbeat from <hostname>`
- [ ] Status endpoint trả về `"online": true`
- [ ] Windows Scheduled Task đã đăng ký

### End-to-End Test
- [ ] Enqueue `RUN_LOT_MACRO` từ Web UI → Agent nhận và chạy thành công
- [ ] Logs từ Windows hiện thời gian thực trên Web UI
- [ ] File kết quả đã được upload lên Linux
