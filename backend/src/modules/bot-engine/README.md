# Phân Hệ Bot-Engine (Automation Infrastructure)

## 1. Giới thiệu
Phân hệ `bot-engine` đóng vai trò là **Hạ tầng Hàng đợi (Queue Manager)** và **Bộ hẹn giờ (Scheduler)** cho toàn bộ hệ thống MXV Shift Checklist.
Phân hệ này hoàn toàn **không chứa logic tính toán tài chính** hay **thuật toán đối chiếu giao dịch** (các logic đó nằm ở phân hệ `trading-ops`).

---

## 2. Cấu trúc thư mục

```text
backend/src/modules/bot-engine/
├── controllers/                   # 6 Controllers tiếp nhận HTTP API (Đã chia nhỏ theo Domain)
│   ├── bot-jobs.controller.ts     # Quản lý vòng đời job (/jobs, /cancel, /trigger...)
│   ├── bot-ingress.controller.ts  # Trigger tải báo cáo & audit tệp backup
│   ├── bot-config.controller.ts   # Cấu hình kết nối bot & kiểm tra agent liveness
│   ├── bot-gtt.controller.ts      # Đối soát Giá thanh toán (GTT)
│   ├── bot-macro.controller.ts    # Cấu hình & trigger chạy Excel Macro
│   ├── bot-agent.controller.ts    # Nhận heartbeat & poll job từ RPA Agent
│   └── index.ts                   # Barrel export cho toàn bộ Controllers
│
├── watchers/                      # Lính gác nền (System Watchers)
│   ├── email-watcher.service.ts   # Canh hòm thư Outlook nhận email đáo hạn
│   ├── oms-watcher.service.ts     # Canh cổng kết nối OMS (CoreCCP/CoreEX)
│   ├── file-watcher.service.ts    # Canh file thay đổi trên ổ đĩa
│   ├── api-watcher.service.ts     # Canh HTTP API health
│   ├── mock-emails.json           # Dữ liệu email mẫu kiểm thử
│   └── index.ts                   # Barrel export cho toàn bộ Watchers
│
├── handlers/                      # 5 Ingress & Audit Job Handlers thực thi nền
│   ├── file-audit.handler.ts      # Kiểm tra tính sẵn sàng của file backup
│   ├── cast-download.handler.ts   # Tải số dư CAST
│   ├── ccp-ce-download.handler.ts # Tải báo cáo CoreCCP & CoreEX
│   ├── rpa-download.handler.ts    # Tải báo cáo M-System
│   └── verify-email.handler.ts    # Xác nhận email
│
├── core/                          # Job Handler Registry & Base Interfaces
├── helpers/                       # Helpers đường dẫn và xử lý ngày tháng
├── constants/                     # Danh mục năng lực Bot (BOT_TASK_REGISTRY)
├── utils/                         # Tiện ích mã hóa Crypto AES-256
│
├── bot-job-queue.service.ts       # Xếp hàng MongoDB, Atomic Lock (findOneAndUpdate)
├── scheduler.service.ts           # Cron Scheduler điều phối hẹn giờ
├── bot-engine.service.ts          # Parser bóc tách email đáo hạn hợp đồng (~180 dòng)
├── bot-engine.module.ts           # NestJS Module Metadata
└── README.md                      # Tài liệu hướng dẫn này
```

---

## 3. Quy tắc bảo trì (Maintainer Guide)

1. **Khi nào sửa `bot-job-queue.service.ts`?**
   - Khi cần điều chỉnh thời gian Timeout của Job, cơ chế Retry hoặc Atomic Lock trên MongoDB.
2. **Khi nào sửa `scheduler.service.ts`?**
   - Khi cần thay đổi tần suất hoặc thêm khung giờ hẹn chạy tác vụ tự động.
3. **Khi nào sửa `watchers/`?**
   - Khi phòng ban thay đổi hòm thư email thông báo hoặc thay đổi cổng kết nối OMS.
4. **Tuyệt đối không sửa nghiệp vụ tại đây**:
   - Mọi thay đổi về công thức đối chiếu, lọc tài khoản, làm tròn số lot/giá trị $\rightarrow$ Thực hiện tại phân hệ `trading-ops`.
   - Mọi thay đổi về trình cào Playwright hay SFTP $\rightarrow$ Thực hiện tại phân hệ `ingress`.
