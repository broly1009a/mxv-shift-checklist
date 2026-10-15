# ĐẶC TẢ KỸ THUẬT PHÂN HỆ M-SYSTEM API INGRESS CLIENT

## 1. Kiến Trúc Xác Thực 2 Lớp (2-Step Authentication) của Newgen Admin

```mermaid
sequenceDiagram
    autonumber
    actor Client as MsClient (Backend)
    participant AuthAPI as Newgen Auth Server (/am/admin/users)
    participant DataAPI as Newgen Data Engine (/am, /approval, /om, /pm)

    Note over Client,AuthAPI: BƯỚC 1: XÁC THỰC MẬT KHẨU
    Client->>AuthAPI: POST /login { username, password }
    AuthAPI-->>Client: 200 OK { user: { id: "userId", accessToken: "tempToken (60s)" } }

    Note over Client,AuthAPI: BƯỚC 2: XÁC THỰC MÃ PIN BẢO MẬT
    Client->>AuthAPI: POST /verifyPin/:userId { pin }<br/>Header: Authorization: Bearer tempToken
    AuthAPI-->>Client: 200 OK { user: { accessToken: "officialToken (12h)" } }

    Note over Client,DataAPI: BƯỚC 3: TẢI FILE BÁO CÁO NHỊ PHÂN
    Client->>DataAPI: GET /am/admin/investors/excel?subInvestorType[eq]=NULL<br/>Header: Authorization: Bearer officialToken
    DataAPI-->>Client: 200 OK (Content-Type: application/vnd.ms-excel)<br/>Binary Stream (.xlsx)
```

---

## 2. Thông Số Cấu Hình

| Tham Số | Giá Trị Mặc Định DEV | Ý Nghĩa |
| :--- | :--- | :--- |
| `baseUrl` | `https://api-dev.newgen.dev` | Host REST API backend |
| `adminUrl` | `https://admin-dev.msystem.newgen.dev` | Host frontend web admin (dùng làm Origin/Referer) |
| `username` | `mxvhieptruong` | Tên đăng nhập quản trị viên |
| `password` | `Taovipko0!` | Mật khẩu tài khoản |
| `pin` | `269696` | Mã PIN 6 chữ số xác thực lớp 2 |

---

## 3. Danh Mục Headers Bắt Buộc

Khi gửi request tải file từ M-System API, backend Newgen yêu cầu các headers sau:
```http
Authorization: Bearer <officialToken>
Origin: https://admin-dev.msystem.newgen.dev
Referer: https://admin-dev.msystem.newgen.dev/
Accept: application/json, text/plain, */*
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
```
