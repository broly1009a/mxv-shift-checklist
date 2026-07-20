# Kế hoạch triển khai UAT — operate-checklist

## Mục tiêu
Deploy hệ thống NestJS lên Linux server để chạy UAT từ nay đến cuối tháng 7/2026.
App đọc dữ liệu từ ổ M:\ (Windows File Server) và ghi kết quả vào folder output riêng biệt để QLGD đối soát — **không đụng vào dữ liệu gốc**.

---

## Kiến trúc tổng thể

```
Windows File Server
├── M:\Quanlygiaodich\         ← mount read-only trên Linux
│   └── Tai lieu hoat dong\
│       ├── Backup CQG\        ← App chỉ đọc
│       ├── Backup MS\         ← App chỉ đọc
│       └── ...
│
└── M:\OperateChecklist_UAT\    ← mount read-write riêng
    └── Quanlygiaodich\
        └── Tai lieu hoat dong\
            ├── Thong ke gia tri giao dich\   ← App ghi ra đây
            ├── Thong ke so lot giao dich\    ← App ghi ra đây
            ├── Backup MS\Spread\             ← App ghi ra đây
            ├── Backup CQG\LME\              ← App ghi ra đây
            └── Gửi team bản tin\            ← App ghi ra đây

Linux Server
├── /mnt/qlgd/                    ← mount từ M:\Quanlygiaodich (read-only)
├── /mnt/oc-uat/                  ← mount từ M:\OperateChecklist_UAT (read-write)
├── /app/operate-checklist/data/  ← bản sao local của /mnt/qlgd (rsync về)
└── /app/operate-checklist/       ← NestJS app
```

**Luồng dữ liệu:**
```
M:\Quanlygiaodich\ → (rsync) → /app/operate-checklist/data/ → App xử lý → /mnt/oc-uat/Quanlygiaodich/Tai lieu hoat dong/
```

---

## Phần 1 — Yêu cầu từ IT / Vận hành

> [!IMPORTANT]
> Cần xác nhận và hoàn thành phần này với anh vận hành trước khi bắt đầu cài đặt.

### Checklist yêu cầu IT

- [ ] Cấp tài khoản domain có quyền đọc toàn bộ `M:\Quanlygiaodich\`
- [ ] Tạo folder `M:\OperateChecklist_UAT\` ở root của ổ M (không nằm trong Quanlygiaodich)
- [ ] Cấp quyền ghi vào `M:\OperateChecklist_UAT\` cho tài khoản trên
- [ ] Cung cấp IP hoặc hostname của Windows File Server
- [ ] Cung cấp thông tin Linux server: IP, SSH access, OS version
- [ ] Confirm creds SFTP: host, port, username, password (cho backup_winscp.py)
- [ ] Xác nhận Linux server có thể ping/kết nối vào File Server

---

## Phần 2 — Cài đặt Linux Server

### Task 2.1 — Cài đặt dependencies

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 (process manager)
sudo npm install -g pm2

# CIFS utils (để mount ổ mạng Windows)
sudo apt-get install -y cifs-utils

# Python3 + pip (cho backup_winscp.py)
sudo apt-get install -y python3 python3-pip

# rsync
sudo apt-get install -y rsync

# Playwright Browser Dependencies (cho RPA Bot chạy Headless Chrome)
npx playwright install-deps
# Hoặc cài đặt các thư viện Chrome bằng apt-get:
sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

### Task 2.2 — Tạo user riêng chạy app

```bash
# Tạo user không có shell login (bảo mật)
sudo useradd -r -s /usr/sbin/nologin oc-app

# Tạo thư mục app
sudo mkdir -p /app/operate-checklist /app/operate-checklist/data /app/operate-checklist/logs
sudo chown -R oc-app:oc-app /app/operate-checklist
```

### Task 2.3 — Mount ổ mạng Windows

```bash
# Tạo file credentials (không để password trong fstab)
sudo nano /etc/cifs-credentials
```

Nội dung file `/etc/cifs-credentials`:
```
username=<TEN_TAI_KHOAN_DOMAIN>
password=<MAT_KHAU>
domain=<TEN_DOMAIN>
```

```bash
sudo chmod 600 /etc/cifs-credentials

# Tạo mount points
sudo mkdir -p /mnt/qlgd /mnt/oc-uat

# Thêm vào /etc/fstab (tự động mount khi reboot)
sudo nano /etc/fstab
```

Thêm 2 dòng vào `/etc/fstab`:
```
//<FILE_SERVER_IP>/Quanlygiaodich      /mnt/qlgd    cifs  credentials=/etc/cifs-credentials,ro,uid=oc-app,gid=oc-app,iocharset=utf8  0  0
//<FILE_SERVER_IP>/OperateChecklist_UAT /mnt/oc-uat  cifs  credentials=/etc/cifs-credentials,rw,uid=oc-app,gid=oc-app,iocharset=utf8  0  0
```

```bash
# Mount ngay (không cần reboot)
sudo mount /mnt/qlgd
sudo mount /mnt/oc-uat

# Verify
ls /mnt/qlgd/
ls /mnt/oc-uat/
```

### Task 2.4 — Cài đặt rsync sync dữ liệu nguồn

Tạo script `/app/operate-checklist/scripts/sync-data.sh`:

```bash
#!/bin/bash
LOG=/app/operate-checklist/logs/sync-data.log
echo "$(date '+%Y-%m-%d %H:%M:%S') START sync" >> $LOG

rsync -av --delete \
  /mnt/qlgd/ \
  /app/operate-checklist/data/ \
  >> $LOG 2>&1

EXIT=$?
if [ $EXIT -eq 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') DONE sync OK" >> $LOG
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') FAIL sync exit=$EXIT" >> $LOG
fi
```

```bash
sudo chmod +x /app/operate-checklist/scripts/sync-data.sh

# Cấu hình cron chạy mỗi 15 phút
sudo crontab -e -u oc-app
```

Thêm vào crontab:
```
*/15 * * * * /app/operate-checklist/scripts/sync-data.sh
```

---

## Phần 3 — Deploy ứng dụng NestJS

### Task 3.1 — Upload code lên server

```bash
# Clone từ GitLab (khuyến nghị)
git clone https://<GITLAB_URL>/operate-checklist.git /app/operate-checklist

# Hoặc copy thủ công từ máy Windows
scp -r "C:\Users\hiepth\...\mxv-shift-checklist\backend" user@<SERVER_IP>:/app/operate-checklist/backend
scp -r "C:\Users\hiepth\...\mxv-shift-checklist\frontend" user@<SERVER_IP>:/app/operate-checklist/frontend
scp -r "C:\Users\hiepth\...\mxv-shift-checklist\marco" user@<SERVER_IP>:/app/operate-checklist/marco
```

### Task 3.2 — Cấu hình biến môi trường

Tạo file `/app/operate-checklist/backend/.env`:

```env
# === ENVIRONMENT ===
NODE_ENV=uat

# === DATABASE ===
MONGODB_URI=mongodb://localhost:27017/operate_checklist_uat

# === PATHS ===
# Đọc dữ liệu nguồn từ bản sao local (KHÔNG đọc thẳng từ /mnt/qlgd)
DATA_ROOT=/app/operate-checklist/data

# Ghi output vào OperateChecklist_UAT trên M:\
BOT_LOT_MACRO_TARGET_ROOT=/mnt/oc-uat/Quanlygiaodich/Tai lieu hoat dong

# Marco file path (local)
BOT_MACRO_VALUE_PATH=/app/operate-checklist/marco/Thong ke gia tri giao dich co ACM/Macro thong ke gia tri giao dich co ACM.xlsm

# === FEATURES ===
# Tắt gửi email thật trong UAT
ENABLE_EMAIL_SEND=false

# === SFTP BACKUP ===
SFTP_HOST=sftp.mxv.com.vn
SFTP_PORT=2231
SFTP_USER=testuser
SFTP_PASS=<PASSWORD>
```

### Task 3.3 — Cập nhật setting trong Database

Sau khi app khởi động, cập nhật settings:

```
bot_lot_macro_target_root  →  /mnt/oc-uat/Quanlygiaodich/Tai lieu hoat dong
bot_macro_value_path       →  /app/operate-checklist/marco/...
```

Có thể cập nhật qua Admin UI hoặc MongoDB trực tiếp:
```javascript
db.system_settings.updateOne(
  { key: 'bot_lot_macro_target_root' },
  { $set: { value: '/mnt/oc-uat/Quanlygiaodich/Tai lieu hoat dong' } },
  { upsert: true }
)
```

### Task 3.4 — Build và khởi động app

```bash
cd /app/operate-checklist/backend
npm ci --only=production
npm run build

# Frontend
cd /app/operate-checklist/frontend
npm ci
npm run build

# Khởi động bằng PM2
pm2 start dist/main.js --name operate-checklist-backend --user oc-app
pm2 start npm --name operate-checklist-frontend -- start --user oc-app
pm2 save
pm2 startup  # auto-start khi reboot
```

---

## Phần 4 — Bảo vệ dữ liệu gốc

### Task 4.1 — Thêm path guard vào code (✅ ĐÃ HOÀN THÀNH TRONG SOURCE CODE)

Đã tạo file `backend/src/common/file-guard.helper.ts` và tích hợp vào `excel-accumulator.helper.ts` & `value-statistics.service.ts`:

```typescript
import * as path from 'path';

/**
 * Chỉ cho phép ghi vào allowedOutputRoot.
 * Throw error ngay nếu path vượt ra ngoài.
 */
export function assertSafeWritePath(filePath: string, allowedOutputRoot: string): void {
  const resolved = path.resolve(filePath);
  const allowedResolved = path.resolve(allowedOutputRoot);

  if (!resolved.startsWith(allowedResolved)) {
    throw new Error(
      `[SECURITY] Từ chối ghi vào path không được phép.\n` +
      `  Allowed root: "${allowedResolved}"\n` +
      `  Attempted path: "${resolved}"`
    );
  }
}
```

Gọi hàm này trong `excel-accumulator.helper.ts` trước mỗi lần `writeFile`:

```typescript
import { assertSafeWritePath } from '../../../common/file-guard.helper';

// Trong appendRawDsgd, updateTvkdTrackerFile, updateAcmTrackerFile, updateNormalTrackerFile:
const outputRoot = process.env.BOT_LOT_MACRO_TARGET_ROOT || '';
assertSafeWritePath(targetFilePath, outputRoot);
await wb.xlsx.writeFile(targetFilePath);
```

### Task 4.2 — Verify mount read-only hoạt động

```bash
# Test thử ghi vào folder nguồn — phải báo lỗi
touch /mnt/qlgd/test.txt
# Expected: "Read-only file system"

# Test thử ghi vào UAT output — phải thành công
touch /mnt/oc-uat/test.txt && rm /mnt/oc-uat/test.txt
# Expected: OK
```

---

## Phần 5 — Cấu trúc output và đối soát

### Cấu trúc folder output QLGD sẽ thấy

```
M:\OperateChecklist_UAT\
└── Quanlygiaodich\
    └── Tai lieu hoat dong\
        ├── Thong ke gia tri giao dich\
        │   ├── Thong ke gia tri giao dich 2026.xlsx
        │   ├── Thong ke gia tri giao dich Options 2026.xlsx
        │   ├── Thong ke gia tri giao dich ACM 2026.xlsx
        │   └── Backup_Snapshots\           ← App tự tạo backup trước mỗi lần ghi
        │
        ├── Backup MS\Spread\2026\
        │   └── Thong ke gia tri giao dich Spread 2026.xlsx
        │
        ├── Backup CQG\LME\2026\
        │   └── Thong ke gia tri giao dich LME 2026.xlsx
        │
        └── Gửi team bản tin\
            └── Giá trị giao dịch phiên DD.MM.YYYY.xlsx
```

### Quy trình đối soát hàng ngày

1. QLGD chạy macro thủ công như bình thường → lưu kết quả vào folder gốc
2. App tự động chạy theo lịch → lưu kết quả vào `M:\OperateChecklist_UAT\...`
3. QLGD mở 2 file, so sánh số liệu
4. Ghi nhận chênh lệch (nếu có) vào sheet đối soát

---

## Phần 6 — Monitoring và log

### Xem log app
```bash
pm2 logs operate-checklist-backend --lines 100
tail -f /app/operate-checklist/logs/sync-data.log
```

### Xem log sync
```bash
tail -f /app/operate-checklist/logs/sync-data.log
```

### Check status
```bash
pm2 status
df -h /mnt/qlgd /mnt/oc-uat
```

---

## Tổng hợp task theo thứ tự thực hiện

- [ ] **[IT]** Tạo folder `M:\OperateChecklist_UAT\` ở root ổ M
- [ ] **[IT]** Cấp quyền read cho `M:\Quanlygiaodich\`
- [ ] **[IT]** Cấp quyền write cho `M:\OperateChecklist_UAT\`
- [ ] **[IT]** Cung cấp IP File Server, thông tin tài khoản domain
- [ ] **[IT]** SSH access vào Linux server
- [ ] **[Dev]** Cài Node.js, PM2, cifs-utils, rsync trên Linux
- [ ] **[Dev]** Tạo user `oc-app`
- [ ] **[Dev]** Mount `/mnt/qlgd` (read-only) và `/mnt/oc-uat` (read-write)
- [ ] **[Dev]** Clone repo `operate-checklist` từ GitLab về `/app/operate-checklist/`
- [ ] **[Dev]** Cấu hình rsync cron mỗi 15 phút
- [ ] **[Dev]** Tạo file `.env` với đúng paths
- [ ] **[Dev]** Build và khởi động app bằng PM2
- [ ] **[Dev]** Cập nhật `bot_lot_macro_target_root` trong DB
- [x] **[Dev]** Thêm `assertSafeWritePath()` guard vào code (Đã xong trong source code)
- [ ] **[Dev]** Verify mount read-only hoạt động đúng
- [ ] **[Dev]** Chạy thử 1 ca, kiểm tra file output có xuất hiện trong `M:\OperateChecklist_UAT\`
- [ ] **[QLGD]** So sánh kết quả file output vs kết quả thủ công ngày đầu tiên
- [ ] **[QLGD]** Xác nhận số liệu khớp → tiếp tục theo dõi các ngày tiếp theo

---

## Lộ trình production (sau UAT thành công)

1. Đổi `bot_lot_macro_target_root` → `M:\Quanlygiaodich\Tai lieu hoat dong`
2. Chạy song song với macro thủ công 1-2 tuần
3. Khi QLGD xác nhận khớp 100% → tắt macro, app thay thế hoàn toàn
