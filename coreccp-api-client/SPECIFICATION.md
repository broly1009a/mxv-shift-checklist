# CORECCP API CLIENT & DATA INGRESS SPECIFICATION

---

## 1. TỔNG QUAN 3 CƠ CHẾ XUẤT DỮ LIỆU
1. **KIỂU 1 (Direct JSON Search)**:
   - Endpoint: `POST /ccp/inquiry/maintain/{CODE}/search/{CODE}`
   - Header: `connectkey: fsscssiam2021`, `Authorization: Bearer <token>`, `Cookie: SESSION=<session_id>`
   - Body: `{"searchcode":"...","page":{"pageIndex":1,"pageSize":200000}}`
   - Áp dụng cho: `ACCTMARGIN_ALL`, `MARGIN_MNG`, `SETTLEMENT`, `COMMODITY`, `INSTRUMENTS` (Hợp đồng chi tiết theo mã), `CUSTOMERS_COMPANY`.
   - **Tốc độ thực tế**: ~87 ms.

2. **KIỂU 2 (Server-Side Export & Socket.IO Notification)**:
   - Bước 1: Lấy vé WebSocket từ SSO: `POST /sso/api/v1/oauth/issue-ws-ticket` nhận `ticket_uuid`.
   - Bước 2: Kết nối WebSocket NotiSocket Engine.IO v4 tại `wss://<host>/notisocket/socket.io/?ticket=<ticket_uuid>&userId=<user_id>&EIO=4&transport=websocket`.
   - Bước 3: Gửi gói tin subscribe kênh: `42["SUBSCRIBE",{"action":"SUBSCRIBE","userID":<user_id>,"room":["NOTI","REPORT","SOCKET"]}]`.
   - Bước 4: Gửi `POST /ccp/export/create` kèm `"fekey": "MãBáoCáo_Timestamp"` và payload bộ lọc.
   - Bước 5: Nhận bản tin socket sự kiện `"REPORT"` chứa `content.fekey` trùng khớp $\rightarrow$ bóc tách `reportId = content.autoid`.
   - Bước 6: Gọi `GET /ccp/report/download/{autoid}` để lưu file Excel nguyên bản.
   - Áp dụng cho: `ORDERBOOK`, `ORDERBOOK_MM`, `ORDERMATCH_DETAIL`, `OPEN_POSITION_EXPORT` (TTM chi tiết), `PNL_EXECUTED_EXPORT` (TTTT chi tiết), `CASHTRANFER_HIST` (NR - lọc theo `CHECKERDT`), `ACCOUNTS_INFO`.
   - **Tốc độ thực tế**: ~737 ms.

> **GHI CHÚ KIẾN TRÚC ĐỘT PHÁ (100% PURE API - KHÔNG CẦN PLAYWRIGHT)**:
> Hệ thống đã chuyển hóa toàn bộ các báo cáo trước đây dùng Playwright sang API:
> - Hợp đồng chi tiết (`CP2CO`, `PL1NY`, `SI5CO`) $\rightarrow$ Gọi trực tiếp qua **KIỂU 1** (`INSTRUMENTS`).
> - Lịch sử tất toán (`TTTT.xlsx`) $\rightarrow$ Gọi trực tiếp qua **KIỂU 2** (`PNL_EXECUTED_EXPORT`).
> $\rightarrow$ **Loại bỏ hoàn toàn KIỂU 3 (Headless Browser Playwright cồng kềnh)**, tiết kiệm 100% tài nguyên RAM/CPU cho server.

---

## 2. ĐẶC TẢ CHI TIẾT GIAO THỨC SOCKET.IO & BẢN TIN NHẬN DIỆN
### 2.1. Handshake & Đăng Ký Phòng
1. Engine.IO v4 Greeting: `0{"sid":"...","pingInterval":25000,"pingTimeout":60000}`
2. Client Connect Namespace: `40`
3. Server Confirm: `40{"sid":"..."}`
4. Client Subscribe: `42["SUBSCRIBE",{"action":"SUBSCRIBE","userID":<user_id>,"room":["NOTI","REPORT","SOCKET"]}]`

### 2.2. Bản Tin Báo Hoàn Tất Render File Excel
```json
42["REPORT",{
  "eventID": "EXPORT_45173",
  "eventType": "REPORT",
  "eventChannel": "REPORT",
  "format": "text",
  "content": {
    "autoid": 32995,
    "fekey": "ACCOUNTS_INFO_1791892244414",
    "searchcode": "ACCOUNTS_INFO",
    "status": "SUCCESS",
    "fileName": "Danh_sach_tai_khoan_13102026.xlsx"
  }
}]
```
- Trường tải file: `content.autoid` (ví dụ `32995`).
- Gọi tải file: `GET /ccp/report/download/32995`.

---

## 3. KẾT QUẢ ĐO LƯỜNG TỐC ĐỘ THỰC TẾ (BENCHMARK)
| Tiêu Chí | Cào Bằng Playwright | KIỂU 1 (JSON Search) | KIỂU 2 (Server Export + Socket.IO) |
| :--- | :---: | :---: | :---: |
| **Thời gian tải 1 file** | 15 - 30 giây | **87 ms** | **737 ms** |
| **Tài nguyên sử dụng** | Tốn RAM/CPU mở browser | Siêu nhẹ (REST) | Siêu nhẹ (WebSocket + REST) |
| **Tải trọn 25 file** | ~ 5 - 10 phút | Không áp dụng cho 25 file | **~ 10 - 15 giây** |

---

## 4. MA TRẬN 25 BÁO CÁO MAKER
| STT | File Name | Route | Searchcode | Cơ Chế |
| :---: | :--- | :--- | :--- | :---: |
| 1 | `DSL CCP.xlsx` | `/ORDERS/ORDERBOOK` | `ORDERBOOK` (Tất cả lệnh thường) | KIỂU 2 |
| 2 | `DSLDK CCP.xlsx` | `/ORDERS/ORDERBOOK` | `ORDERBOOK_MATCH` (Lệnh đã khớp) | KIỂU 2 |
| 3 | `DSLCK CCP.xlsx` | `/ORDERS/ORDERBOOK` | `ORDERBOOK_PENDING` (Lệnh chờ khớp) | KIỂU 2 |
| 4 | `DSLDH CCP.xlsx` | `/ORDERS/ORDERBOOK` | `ORDERBOOK_CANCEL` (Lệnh đã hủy) | KIỂU 2 |
| 5 | `DSGD CCP.xlsx` | `/ORDERS/ORDERMATCH_DETAIL` | `ORDERMATCH_DETAIL` | KIỂU 2 |
| 6 | `DSL MM CCP.xlsx` | `/ORDERS/ORDERBOOK_MM` | `ORDERBOOK_MM` (Tất cả lệnh MM) | KIỂU 2 |
| 7 | `DSLDK MM CCP.xlsx` | `/ORDERS/ORDERBOOK_MM` | `ORDERBOOK_MM_MATCH` (Lệnh MM đã khớp) | KIỂU 2 |
| 8 | `DSLCK MM CCP.xlsx` | `/ORDERS/ORDERBOOK_MM` | `ORDERBOOK_MM_PENDING` (Lệnh MM chờ khớp) | KIỂU 2 |
| 9 | `DSLDH MM CCP.xlsx` | `/ORDERS/ORDERBOOK_MM` | `ORDERBOOK_MM_CANCEL` (Lệnh MM đã hủy) | KIỂU 2 |
| 10 | `DSGD MM CCP.xlsx` | `/ORDERS/ORDERBOOK_ALL_MM` | `ORDERBOOK_ALL_MM` (Khớp lệnh MM) | KIỂU 2 |
| 11 | `TTM truoc 4h20.xlsx` | `/ORDERS/OPEN_POSITION` | `OPEN_POSITION` | KIỂU 2 |
| 12 | `TTM CCP.xlsx` / `TTM.xlsx` | `/ORDERS/OPEN_POSITION` | `OPEN_POSITION_EXPORT` (Chi tiết) | KIỂU 2 |
| 13 | `TTTT.xlsx` | `/ORDERS/PNL_EXECUTED` | `PNL_EXECUTED_EXPORT` (Lịch sử chi tiết) | KIỂU 2 |
| 14 | `QL TT TKGD truoc 4h20.xlsx` | `/RISKMNG/ACCTMARGIN_ALL` | `ACCTMARGIN_ALL` | KIỂU 1 |
| 15 | `QL TT TKGD.xlsx` | `/RISKMNG/ACCTMARGIN_ALL` | `ACCTMARGIN_ALL` (Tab TKGD) | KIỂU 1 |
| 16 | `QL TT TVKD.xlsx` | `/RISKMNG/ACCTMARGIN_ALL` | `ACCTMARGIN_ALL` (Tab TVKD) | KIỂU 1 |
| 17 | `DSQLKQ TKGD.xlsx` | `/RISKMNG/ACCTMARGIN_POS` | `ACCTMARGIN_POS` (Tab TKGD) | KIỂU 1 |
| 18 | `DSQLKQ TVKD.xlsx` | `/RISKMNG/ACCTMARGIN_POS` | `MEMBERMARGIN_POS` (Tab TVKD) | KIỂU 1 |
| 19 | `NR.xlsx` | `/CASHTRANFER/CASHTRANFER_HIST` | `CASHTRANFER_HIST` (Lọc `CHECKERDT`) | KIỂU 2 |
| 20 | `DSTKGD ACM.xlsx` | `/ACCOUNTMNG/ACCOUNTS_INFO` | `ACCOUNTS_INFO` | KIỂU 2 |
| 21 | `GTT CCP.xlsx` / `GTT trước 6h.xlsx` | `/PRODUCT/SETTLEMENT` | `SETTLEMENT` | KIỂU 1 |
| 22 | `HH.xlsx` | `/PRODUCT/COMMODITY` | `COMMODITY` | KIỂU 1 |
| 23 | `HĐ CP2CO.xlsx` | `/PRODUCT/COMMODITY` | `INSTRUMENTS` (KEYVAL: `CP2CO`) | KIỂU 1 |
| 24 | `HĐ PL1NY.xlsx` | `/PRODUCT/COMMODITY` | `INSTRUMENTS` (KEYVAL: `PL1NY`) | KIỂU 1 |
| 25 | `HĐ SI5CO.xlsx` | `/PRODUCT/COMMODITY` | `INSTRUMENTS` (KEYVAL: `SI5CO`) | KIỂU 1 |
