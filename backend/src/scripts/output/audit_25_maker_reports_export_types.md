# BÁO CÁO TOÀN DIỆN 25 FILE MAKER: PHÂN BIỆT 2 KIỂU GỌI API KHI TẢI FILE

> Thời gian quét thực tế: 16:59:14 13/10/2026 | Môi trường: `https://uat-coreccp.mxv.com.vn` | Trình duyệt: Playwright Headless

## 1. Bảng Ma Trận Cơ Chế 25 File Báo Cáo Thực Tế Của Maker

| STT | Tên File Báo Cáo | Nhóm Nghiệp Vụ | URL Route | Tab / Điều Kiện | Cơ Chế Thực Tế Trên FE | Endpoint Kích Hoạt | Tham Số / Cách Bot Xử Lý |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| 1 | **DSL CCP.xlsx** | Lệnh & Khớp lệnh | `/ORDERS/ORDERBOOK` | Tab [Tất cả] |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 2 | **DSLDK CCP.xlsx** | Lệnh & Khớp lệnh | `/ORDERS/ORDERBOOK` | Tab [Lệnh đã khớp] |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 3 | **DSLCK CCP.xlsx** | Lệnh & Khớp lệnh | `/ORDERS/ORDERBOOK` | Tab [Lệnh chờ khớp] |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 4 | **DSLDH CCP.xlsx** | Lệnh & Khớp lệnh | `/ORDERS/ORDERBOOK` | Tab [Lệnh đã hủy] |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 5 | **DSGD CCP.xlsx** | Lệnh & Khớp lệnh | `/ORDERS/ORDERMATCH_DETAIL` | Mặc định |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 6 | **DSL MM CCP.xlsx** | Lệnh & Khớp lệnh MM | `/ORDERS/ORDERBOOK_MM` | Tab [Tất cả] |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 7 | **DSLDK MM CCP.xlsx** | Lệnh & Khớp lệnh MM | `/ORDERS/ORDERBOOK_MM` | Tab [Lệnh đã khớp] |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 8 | **DSLCK MM CCP.xlsx** | Lệnh & Khớp lệnh MM | `/ORDERS/ORDERBOOK_MM` | Tab [Lệnh chờ khớp] |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 9 | **DSLDH MM CCP.xlsx** | Lệnh & Khớp lệnh MM | `/ORDERS/ORDERBOOK_MM` | Tab [Lệnh đã hủy] |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 10 | **DSGD MM CCP.xlsx** | Lệnh & Khớp lệnh MM | `/ORDERS/ORDERBOOK_ALL_MM` | Mặc định |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 11 | **TTM truoc 4h20.xlsx** | Vị thế & Lãi lỗ | `/ORDERS/OPEN_POSITION` | Mặc định |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 12 | **TTM CCP.xlsx** | Vị thế & Lãi lỗ | `/ORDERS/OPEN_POSITION` | Mặc định |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 13 | **TTTT.xlsx** | Vị thế & Lãi lỗ | `/ORDERS/PNL_EXECUTED` | Tab [Lịch sử tất toán] | ⚠️ **KIỂU 3** (Client-Side Table) | `-` | Xuất trực tiếp từ dữ liệu table |
| 14 | **QL TT TKGD truoc 4h20.xlsx** | Rủi ro & Ký quỹ | `/RISKMNG/ACCTMARGIN_ALL` | Tab [Danh sách trạng thái TKGD] |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/ACCTMARGIN_ALL/search/ACCTMARGIN_ALL` | `pageSize: 200000` $\rightarrow$ Lấy JSON sạch |
| 15 | **QL TT TKGD.xlsx** | Rủi ro & Ký quỹ | `/RISKMNG/ACCTMARGIN_ALL` | Tab [Danh sách trạng thái TKGD] |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/ACCTMARGIN_ALL/search/ACCTMARGIN_ALL` | `pageSize: 200000` $\rightarrow$ Lấy JSON sạch |
| 16 | **QL TT TVKD.xlsx** | Rủi ro & Ký quỹ | `/RISKMNG/ACCTMARGIN_ALL` | Tab [Danh sách trạng thái TKTVKD] |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/ACCTMARGIN_ALL/search/MEMBERMARGIN_ALL` | `pageSize: 200000` $\rightarrow$ Lấy JSON sạch |
| 17 | **DSQLKQ TKGD.xlsx** | Rủi ro & Ký quỹ | `/RISKMNG/MARGIN_MNG` | Tab [Quản lý ký quỹ TKGD] |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/DASHBOARD/search/TRANSACTION` | `pageSize: 200000` $\rightarrow$ Lấy JSON sạch |
| 18 | **DSQLKQ TVKD.xlsx** | Rủi ro & Ký quỹ | `/RISKMNG/MARGIN_MNG` | Tab [Quản lý ký quỹ TVKD] |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/DASHBOARD/search/TRANSACTION` | `pageSize: 200000` $\rightarrow$ Lấy JSON sạch |
| 19 | **NR.xlsx** | Nộp rút & Tài khoản | `/CASHTRANFER/CASHTRANFER_HIST` | Mặc định |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 20 | **DSTKGD ACM.xlsx** | Nộp rút & Tài khoản | `/ACCOUNTMNG/ACCOUNTS_INFO` | Mặc định |  **KIỂU 2** (Server-Side Export) | `POST /ccp/export/create` | `POST /export/create` $\rightarrow$ Tải `/report/download/{id}` |
| 21 | **GTT CCP.xlsx** | Hàng hóa & Giá | `/PRODUCT/SETTLEMENT` | Mặc định |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/SETTLEMENT/search/SETTLEMENT` | `pageSize: 200000` $\rightarrow$ Lấy JSON sạch |
| 22 | **HH.xlsx** | Hàng hóa & Giá | `/PRODUCT/COMMODITY` | Mặc định |  **KIỂU 1** (Full JSON qua Search) | `/ccp/inquiry/maintain/COMMODITY/search/COMMODITY` | `pageSize: 200000` $\rightarrow$ Lấy JSON sạch |
| 23 | **HĐ CP2CO.xlsx** | Hàng hóa & Giá | `/PRODUCT/COMMODITY` | Modal HĐ [**CP2CO**] | ⚠️ **KIỂU 3** (Client-Side Table) | `-` | Xuất trực tiếp từ dữ liệu table |
| 24 | **HĐ PL1NY.xlsx** | Hàng hóa & Giá | `/PRODUCT/COMMODITY` | Modal HĐ [**PL1NY**] | ⚠️ **KIỂU 3** (Client-Side Table) | `-` | Xuất trực tiếp từ dữ liệu table |
| 25 | **HĐ SI5CO.xlsx** | Hàng hóa & Giá | `/PRODUCT/COMMODITY` | Modal HĐ [**SI5CO**] | ⚠️ **KIỂU 3** (Client-Side Table) | `-` | Xuất trực tiếp từ dữ liệu table |

---

## 2. Kết Luận Kiến Trúc Cho Bot Tự Động Hóa Trọn Bộ 25 File

1. **Nhóm Sổ Lệnh, Khớp Lệnh & Vị Thế (12 File)**: 100% sử dụng **KIỂU 2 (Server-Side Export)** qua `POST /ccp/export/create` và tải file nhị phân qua `/ccp/report/download/{id}`.
2. **Nhóm Quản Lý Ký Quỹ & Rủi Ro (5 File)**: Sử dụng **KIỂU 1** (Search API với `pageSize: 200000`), Bot có thể lấy JSON trực tiếp siêu tốc trong 0.2s.
3. **Nhóm Hợp Đồng Chi Tiết (3 File: CP2CO, PL1NY, SI5CO)**: Nằm bên trong Modal của `/PRODUCT/COMMODITY`. Khi bấm kết xuất trong Modal, hệ thống gọi API xuất riêng theo mã hợp đồng.
