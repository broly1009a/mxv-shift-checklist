# BÁO CÁO THỰC THI PLAYWRIGHT: PHÂN BIỆT 2 KIỂU GỌI API KHI TẢI FILE CORECCP

> Thời điểm test thực tế: 16:51:18 13/10/2026 | Trình duyệt: Playwright Chromium/Edge Headless

## 1. Bảng Tổng Hợp Phân Loại Thực Tế Khi Bấm "Xuất Tất Cả"

| STT | Mã Màn Hình | Tên Nghiệp Vụ | URL Route | Cơ Chế Thực Tế Trên FE | Endpoint Kích Hoạt | Tham Số Đặc Trưng |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `CUSTOMERS_COMPANY` | **Khách hàng tổ chức/DN** | `/ACCOUNTMNG/CUSTOMERS_COMPANY` |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/CUSTOMERS_COMPANY/search/CUSTOMERS_COMPANY` | `pageSize: 200000` |
| 2 | `ORDERBOOK` | **Danh sách lệnh (DSL)** | `/ORDERS/ORDERBOOK` |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ `/report/download/{id}` |
| 3 | `ORDERMATCH_DETAIL` | **Khớp lệnh chi tiết (DSGD)** | `/ORDERS/ORDERMATCH_DETAIL` |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ `/report/download/{id}` |
| 4 | `OPEN_POSITION` | **Trạng thái mở (TTM)** | `/ORDERS/OPEN_POSITION` |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ `/report/download/{id}` |
| 5 | `PNL_EXECUTED` | **Trạng thái tất toán (TTTT)** | `/ORDERS/PNL_EXECUTED` |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ `/report/download/{id}` |
| 6 | `CASHTRANFER_HIST` | **Lịch sử nộp rút tiền (NR)** | `/CASHTRANFER/CASHTRANFER_HIST` |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ `/report/download/{id}` |
| 7 | `ACCOUNTS_INFO` | **Danh sách tài khoản (DSTKGD)** | `/ACCOUNTMNG/ACCOUNTS_INFO` |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ `/report/download/{id}` |
| 8 | `ACCTMARGIN_ALL` | **Trạng thái TKGD (Ký quỹ)** | `/RISKMNG/ACCTMARGIN_ALL` |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/ACCTMARGIN_ALL/search/ACCTMARGIN_ALL` | `pageSize: 200000` |
| 9 | `MARGIN_MNG` | **Quản lý ký quỹ TKGD** | `/RISKMNG/MARGIN_MNG` |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/DASHBOARD/search/TRANSACTION` | `pageSize: 200000` |
| 10 | `SETTLEMENT` | **Quản lý giá thanh toán (GTT)** | `/PRODUCT/SETTLEMENT` |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/SETTLEMENT/search/SETTLEMENT` | `pageSize: 200000` |
| 11 | `COMMODITY` | **Hàng hóa & Hợp đồng (HH)** | `/PRODUCT/COMMODITY` |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/COMMODITY/search/COMMODITY` | `pageSize: 200000` |
| 12 | `ORDERBOOK_MM` | **Danh sách lệnh MM** | `/ORDERS/ORDERBOOK_MM` |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ `/report/download/{id}` |

---

## 2. Kết Luận & Hướng Dẫn Tối Ưu Cho Bot Tự Động Hóa

1. **Các trang thuộc KIỂU 1 (gọi với `pageSize: 200000`)**:
   - Bot **không cần** gọi `/ccp/export/create` hay chờ `/report/download/{id}`.
   - Chỉ cần gửi đúng request `POST /ccp/inquiry/maintain/{CODE}/search/{CODE}` với `"pageSize": 200000`.
   - Nhận về toàn bộ JSON sạch trong RAM trong **vài trăm mili-giây**, sau đó tự lưu Excel nếu cần.

2. **Các trang thuộc KIỂU 2 (gọi `/ccp/export/create`)**:
   - Frontend bắt buộc server render vì dữ liệu lớn.
   - Bot gọi `POST /ccp/export/create` $\rightarrow$ nhận `reportId` $\rightarrow$ gọi `GET /ccp/report/download/{id}` để lưu file `.xlsx` gốc.

