# Hướng Dẫn Deploy: MXV Shift Checklist (Hybrid: Linux Core + Windows RPA Agent)

---

## Tổng quan Kiến trúc

```
Internet / Mạng nội bộ
        │
        ▼
   [Nginx :80]  ← Reverse Proxy
   ┌────┴────┐
   │         │
[Frontend] [Backend :3001]
(Next.js)  (NestJS)
               │
           [MongoDB]
               │
     REST Polling (5s)
               │
        [Windows RPA Agent]
          run_lot_macro.py
          run_value_macro.py
```

---

## PHẦN 1 — LINUX SERVER (Docker Compose)

### 1.1. Yêu cầu

| Phần mềm | Phiên bản |
|----------|-----------|
| Ubuntu 22.04 LTS | hoặc Debian 12 |
| Docker Engine | 24.x |
| Docker Compose | v2.x |
| RAM | ≥ 2 GB |
| Disk | ≥ 20 GB |

```bash
# Cài Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

### 1.2. Đưa code lên server

```bash
git clone <your-repo-url> /opt/mxv-checklist
cd /opt/mxv-checklist
```

### 1.3. Cấu hình biến môi trường

Mở `deployment/docker-compose.yml` và thay thế:

| Biến | Cần đổi |
|------|---------|
| `JWT_SECRET` | Chuỗi ngẫu nhiên 32+ ký tự (`openssl rand -base64 32`) |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram thực |
| `RPA_AGENT_API_KEY` | Key bí mật — **phải giống** `api_key` trong `config.json` Agent |

### 1.4. Build và khởi động

```bash
cd /opt/mxv-checklist/deployment
docker compose up -d --build

# Theo dõi logs
docker compose logs -f backend
docker compose ps
```

**Kết quả mong đợi:**
```
mxv-mongodb    Up
mxv-backend    Up
mxv-frontend   Up
mxv-nginx      Up
```

### 1.5. Kiểm tra

```bash
# API Backend sống (401 = đang chạy, cần JWT)
curl http://localhost/api/v1/bot-engine/config

# Agent status endpoint
curl -H "x-agent-api-key: <API_KEY>" \
  http://localhost/api/v1/bot-engine/agent/status
```

### 1.6. Cập nhật Settings trên Web UI

Đăng nhập Web → **Settings** → đổi đường dẫn backup từ Windows sang Linux:

| Setting Key | Giá trị trên Linux |
|-------------|-------------------|
| `bot_backup_path_ms` | `/app/uploads/backup/ms/Futures` |
| `bot_backup_path_cqg` | `/app/uploads/backup/cqg/Futures` |
| `bot_lot_macro_target_root` | `/app/uploads/macro-output` |

---

## PHẦN 2 — WINDOWS RPA AGENT

### 2.1. Yêu cầu

- Windows 10/11 hoặc Server 2019+
- Python 3.10–3.12 (64-bit, thêm vào PATH)
- Microsoft Excel 2016+ (có VBA Macros)
- WinSCP CLI (nếu có tác vụ SFTP)
- Quyền Administrator (để đăng ký Scheduled Task)

### 2.2. Cấu hình `deployment\rpa-agent\config.json`

```json
{
  "backend_url": "http://<IP_LINUX_SERVER>",
  "api_key": "mxv_rpa_secure_agent_key_2026",
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

> **Quan trọng:** `backend_url` là IP thực của Linux Server, không phải `localhost`.

### 2.3. Chạy Setup (lần đầu)

```cmd
:: Mở CMD với quyền Administrator
cd D:\sontayweb\mxv-shift-checklist\deployment\rpa-agent
setup_agent.bat
```

Script sẽ tự động:
1. Tạo Python venv
2. Cài `requests`, `psutil`, `pywin32`
3. Test kết nối backend
4. Đăng ký Windows Task Scheduler (tự chạy khi khởi động)

### 2.4. Chạy thử Agent

```cmd
venv\Scripts\python.exe agent.py
```

**Log mong đợi:**
```
[INFO] MXV RPA Agent started.
[INFO] Backend: http://192.168.1.100
[INFO] Heartbeat from WINDOWS-PC
```

---

## PHẦN 3 — TEST END-TO-END

### 3.1. Kiểm tra Agent Online

```bash
# Từ Linux server
curl -H "x-agent-api-key: mxv_rpa_secure_agent_key_2026" \
  http://localhost/api/v1/bot-engine/agent/status
# {"online": true, "hostname": "WINDOWS-PC", ...}
```

### 3.2. Test luồng Macro

```bash
TOKEN="<jwt_token>"

# Enqueue RUN_LOT_MACRO
curl -X POST http://localhost/api/v1/bot-engine/run-lot-macro \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetDate": "2026-07-15"}'
# {"success": true, "jobId": "<id>"}

# Xem log job (Agent sẽ tự nhận và chạy sau 5s)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/v1/bot-engine/jobs/<id>
```

### 3.3. Bảng trạng thái Job

| Trạng thái | Ý nghĩa |
|-----------|---------|
| `PENDING` | Chờ Agent poll (do `RPA_AGENT_MODE=remote`) |
| `PROCESSING` | Agent đang chạy macro |
| `AWAITING_CAPTCHA` | Chờ người dùng nhập captcha trên Web UI |
| `COMPLETED` | Hoàn thành, file đã upload lên Linux |
| `FAILED` | Thất bại sau khi hết số lần thử |

---

## PHẦN 4 — VẬN HÀNH

### Lệnh Docker thường dùng

```bash
docker compose restart backend      # Restart backend
docker compose logs -f backend      # Xem log live
docker compose down && docker compose up -d --build  # Full rebuild

# Backup MongoDB
docker exec mxv-mongodb mongodump --db checklist --out /tmp/dump
docker cp mxv-mongodb:/tmp/dump ./backup/$(date +%Y%m%d)
```

### Lệnh Agent Windows

```powershell
# Xem trạng thái task
Get-ScheduledTask -TaskName "MXV_RPA_Agent"

# Xem log
Get-Content D:\sontayweb\mxv-shift-checklist\deployment\rpa-agent\agent.log -Tail 50
```

### Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| Agent: "Heartbeat failed" | Kiểm tra `backend_url` trong `config.json` |
| Job mãi ở `PENDING`, không ai xử lý | Đảm bảo `RPA_AGENT_MODE=remote` trong compose và Agent đang chạy |
| Poll trả về 401 | Đồng bộ `api_key` trong `config.json` với `RPA_AGENT_API_KEY` trong compose |
| `win32com.client` import error | Chạy lại `setup_agent.bat` để cài pywin32 |
| Docker build fail ở `npm ci` | Commit `package-lock.json` lên git trước khi build |

---

## Cấu trúc File Deployment

```
deployment/
├── docker-compose.yml        ← Orchestration chính
├── Dockerfile.backend        ← NestJS multi-stage build  
├── Dockerfile.frontend       ← Next.js multi-stage build
├── nginx.conf                ← Reverse proxy
└── rpa-agent/
    ├── agent.py              ← Windows Agent (polling + dispatch)
    ├── config.json           ← Cấu hình (IP, Key, Paths)
    ├── requirements.txt      ← Python deps
    └── setup_agent.bat       ← Cài đặt & đăng ký Task
```
