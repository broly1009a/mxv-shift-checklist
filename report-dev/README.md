# MRS Report Service (@mrs/report)

## Tổng quan
Service report thuộc hệ thống Market Surveillance System (MSS/MRS).
**Từ Phase 39 (2026-07)**: Monolith tích hợp 3 module chính (Auth, Audit, Notification) thay vì microservice riêng lẻ.

## Kiến trúc tổng quan
- **Express REST API** cho xác thực (Authentication), phân quyền (Authorization), audit trail, và notification.
- **MongoDB** lưu trữ thông tin người dùng, vai trò, nhóm quyền, log audit, lịch sử notification.
- **Redis** hỗ trợ session, caching layout, rate-limiting auth.
- **EventBus (in-process)** thay thế Kafka cho giao tiếp nội bộ giữa auth → audit, auth → notification (U6 decision).
- **Kafka** giữ lại cho report domain nếu cần (không dùng cho auth/audit/notification).

## Yêu cầu hệ thống
- Node.js 20+
- npm
- MongoDB
- Kafka
- Redis
- Docker & Docker Compose (để chạy môi trường dev)

## Cài đặt
```bash
npm install
npm link @mss/common @svl/share
```

## Khởi chạy
Chạy môi trường phát triển (Development):
```bash
npm run dev
```

Chạy qua Docker Compose:
```bash
docker compose -f docker-compose.dev.yml up -d --build
```

## Biến môi trường
Cấu hình các biến trong file `.env.development`, `.env.local` hoặc `.env.staging` (tùy môi trường).

### Bắt buộc
- `NODE_ENV` (development, staging, production)
- `SERVICE_PORT` (mặc định: 6000)
- `MONGO_URI` (mongodb://10.0.4.21/mrs-report)
- `MONGO_USERNAME`, `MONGO_PASSWORD`
- `REDIS_URL`, `REDIS_PASS`
- `JWT_KEY` (32+ ký tự hex, dùng cho auth + WS token)

### Notification (Mail)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`
- `EMAIL_FROM` (địa chỉ gửi)
- `EMAIL_SERVICE` (optional, e.g. gmail)

### Notification (SMS/Teams/Zalo - Optional)
- `SMS_PROVIDER_KEY`, `SMS_PROVIDER_SECRET`
- `TEAMS_WEBHOOK_URL`
- `ZALO_PROVIDER_ID`, `ZALO_PROVIDER_SECRET`, `ZALO_ACCESS_TOKEN`

### Audit (Optional - Tuning)
- `AUDIT_STALE_PENDING_MINUTES` (mặc định: 15)

### Report Domain (Nếu cần)
- `KAFKA_BROKERS` (giữ lại cho report, không dùng cho auth/audit/notification)

## Scripts
- `npm run dev`: Chạy ở môi trường local (ts-node-dev).
- `npm run start`: Chạy production (node build/src/index.js).
- `npm run build`: Build TypeScript → JavaScript (thư mục `build`).
- `npm run test`: Chạy test suite với Jest (111+ tests).

## Route Prefix Convention
- **Global `/api` prefix** được mount 1 lần ở `src/app.ts`
- **Module routes** giữ legacy root paths (ví dụ: auth router định nghĩa `POST /auth/login` → access as `POST /api/auth/login`)
- **Health check**: `GET /health` ngoài `/api` prefix, không cần auth

## Xác thực & Phân quyền
- **requireAuth** middleware: verify JWT (`JWT_KEY`) + validate Redis session, không cần gateway
- **requireRole** từ @svl/share: check permission từ user roles + groupRoles
- **SUPER_ADMIN bypass**: vượt qua tất cả role checks

## Deployment & Rollout
Xem chi tiết tại: **[docs/ROLLOUT_AND_OPERATIONS.md](docs/ROLLOUT_AND_OPERATIONS.md)**

Tóm tắt:
1. Deploy monolith cùng lúc với old services (parallel run)
2. Smoke test: auth login, audit query, notification history
3. Switch client routes từ old services → monolith
4. Retired old identity/audit/notification services
5. Monitor logs & provider health
6. Rollback plan: route traffic trở lại old services nếu cần

## Modules và chức năng chính

### 1. Auth Module (`src/modules/auth/`)
Quản lý xác thực, phân quyền, người dùng, vai trò, nhóm quyền, phê duyệt, layout.

**Các chức năng:**
- Đăng nhập (login + 2FA PIN), đăng xuất
- Đổi/reset password + PIN, gửi mail reset
- Quản lý người dùng (create, read, update, delete, assign roles)
- Quản lý vai trò (sync từ shared contract, catalog, list, update metadata)
- Quản lý nhóm quyền (create, update, assign roles, export Excel)
- Workflow phê duyệt (create, list, update status)
- Layout per-user (set, get với fallback to default)

**Collections**: Users, roles, groupRoles, approvals, layouts

**Endpoints**: `/api/auth/...`, `/api/user/...`, `/api/role/...`, `/api/group-role/...`, `/api/approval/...`, `/api/layouts`

### 2. Audit Module (`src/modules/audit/`)
Ghi lại audit trail, cung cấp query API, tự động cleanup log cũ.

**Các chức năng:**
- Ghi nhận audit log từ auth mutations (user create/delete, role assign, password reset)
- Query audit trail (admin/user view, detail search)
- Tự động đánh dấu log PENDING quá hạn → SYSTEM_ERROR
- EventBus subscriber (best-effort, không làm gián đoạn business logic)

**Collections**: audit_logs

**Endpoints**: `/api/logs/admin`, `/api/logs/user`, `/api/logs/detail`

### 3. Notification Module (`src/modules/notification/`)
Gửi thông báo đa kênh (Mail, WebSocket, SMS, Teams, Zalo), lưu lịch sử.

**Các chức năng:**
- Gửi mail qua SMTP (nodemailer)
- Push thông báo qua WebSocket real-time
- Gửi SMS (provider configurable)
- Gửi Teams webhook
- Gửi Zalo OpenAPI
- Lưu history tất cả kênh
- Fan-out best-effort (tất cả kênh thử, chỉ throw nếu tất cả fail)

**Collections**: MailHistories, SmsHistories, TeamsHistories, ZaloHistories

**Endpoints** (optional): `/api/mail/...`, `/api/sms/...`, `/api/teams/...`, `/api/zalo/...`

**WebSocket**: `ws://localhost:6000?token=<jwt>`
