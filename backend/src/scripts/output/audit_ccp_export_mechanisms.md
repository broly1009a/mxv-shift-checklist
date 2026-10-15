# BÁO CÁO TOÀN DIỆN: CƠ CHẾ TẢI FILE & REST API CỦA HỆ THỐNG CORECCP

> Thời điểm quét thực tế: 16:13:29 13/10/2026 | Môi trường: `uat-coreccp.mxv.com.vn`

## 1. Bảng Tổng Hợp Phân Loại Cơ Chế Từng Trang

| STT | Mã Module | Tên Màn Hình Nghiệp Vụ | URL Route | Server Export (/export/create)? | Search API (JSON)? | Tổng Bản Ghi Hiện Tại | Cơ Chế Đề Xuất Cho Bot |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| 1 | `ORDERBOOK` | **Danh sách lệnh (DSL)** | `/ORDERS/ORDERBOOK` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 2 | `ORDERMATCH_DETAIL` | **Lịch sử giao dịch chi tiết (DSGD)** | `/ORDERS/ORDERMATCH_DETAIL` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 3 | `ORDERMATCH_ALL` | **Lịch sử giao dịch gộp** | `/ORDERS/ORDERMATCH_ALL` |  Có (XLSX) | ❌ | - | `SERVER_SIDE_EXPORT (Tải .XLSX qua /export/create)` |
| 4 | `OPEN_POSITION` | **Trạng thái mở (TTM)** | `/ORDERS/OPEN_POSITION` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 5 | `PNL_EXECUTED` | **Trạng thái tất toán (TTTT)** | `/ORDERS/PNL_EXECUTED` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 6 | `ORDERBOOK_MM` | **Danh sách lệnh MM** | `/ORDERS/ORDERBOOK_MM` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 7 | `ORDERBOOK_ALL_MM` | **Lịch sử lệnh MM** | `/ORDERS/ORDERBOOK_ALL_MM` |  Có (XLSX) | ❌ | - | `SERVER_SIDE_EXPORT (Tải .XLSX qua /export/create)` |
| 8 | `CASHTRANFER_HIST` | **Lịch sử Nộp/ Rút tiền (NR)** | `/CASHTRANFER/CASHTRANFER_HIST` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 9 | `ACCOUNTS_INFO` | **Danh sách tài khoản (DSTKGD)** | `/ACCOUNTMNG/ACCOUNTS_INFO` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 10 | `ACCTMARGIN_ALL` | **Quản lý trạng thái TKGD (Ký quỹ)** | `/RISKMNG/ACCTMARGIN_ALL` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 11 | `MARGIN_MNG` | **Quản lý ký quỹ TKGD** | `/RISKMNG/MARGIN_MNG` |  Có (XLSX) | ❌ | - | `SERVER_SIDE_EXPORT (Tải .XLSX qua /export/create)` |
| 12 | `SETTLEMENT` | **Quản lý giá thanh toán (GTT)** | `/PRODUCT/SETTLEMENT` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 13 | `SETTLEMENT_HIST` | **Lịch sử giá thanh toán** | `/PRODUCT/SETTLEMENT_HIST` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 14 | `COMMODITY` | **Quản lý hàng hóa, hợp đồng (HH)** | `/PRODUCT/COMMODITY` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 15 | `FCM_INFORMATION` | **Danh sách FCM** | `/FCMMNG/FCM_INFORMATION` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |
| 16 | `TLPROFILES` | **Người sử dụng** | `/USERMNG/TLPROFILES` |  Có (XLSX) | ❌ | - | `SERVER_SIDE_EXPORT (Tải .XLSX qua /export/create)` |
| 17 | `CURRENCYEXCHANGERATE` | **Tỷ giá nguyên tệ** | `/SYSCONFIGMNG/CURRENCYEXCHANGERATE` |  Có (XLSX) |  Có (REST) | - | `HYBRID (API JSON siêu tốc & Server-Side XLSX)` |

---

## 2. Chi Tiết Cấu Trúc Các Trường Của Search API

### • [ORDERBOOK] Danh sách lệnh (DSL)
- **Endpoint**: `/ccp/inquiry/maintain/ORDERBOOK/search/ORDERBOOK`
- **Route Giao Diện**: `/ORDERS/ORDERBOOK`
- **Các trường dữ liệu mẫu**: `ID, CUSTODYCD, TXDATE, TXTIME, EXECTIME, UPDATETIME, TRANSACTTIME, AFACCTNO`

### • [ORDERMATCH_DETAIL] Lịch sử giao dịch chi tiết (DSGD)
- **Endpoint**: `/ccp/inquiry/maintain/ORDERMATCH_DETAIL/search/ORDERMATCH_DETAIL`
- **Route Giao Diện**: `/ORDERS/ORDERMATCH_DETAIL`
- **Các trường dữ liệu mẫu**: `TRADEID, SESSION_DATE, ODORDERID, AFACCTNO, TXDATE, ROOTORDERID, ORIGINORDERID, ORDERID`

### • [OPEN_POSITION] Trạng thái mở (TTM)
- **Endpoint**: `/ccp/inquiry/maintain/OPEN_POSITION/search/OPEN_POSITION`
- **Route Giao Diện**: `/ORDERS/OPEN_POSITION`
- **Các trường dữ liệu mẫu**: `UACODE, ACCTNO, SYMBOL, CUSTODYCD, FULLNAME, MEMBERCODE, MEMBER_NAME, LONGQTTY`

### • [PNL_EXECUTED] Trạng thái tất toán (TTTT)
- **Endpoint**: `/ccp/inquiry/maintain/PNL_EXECUTED/search/PNL_EXECUTED`
- **Route Giao Diện**: `/ORDERS/PNL_EXECUTED`
- **Các trường dữ liệu mẫu**: `ACCTNO, ACCOUNT_ID, SYMBOL, LONGQTTY, SHORTQTTY, PNLEXCUTED, PNLEXCUTED_VND, PNLEXCUTED_USD`

### • [ORDERBOOK_MM] Danh sách lệnh MM
- **Endpoint**: `/ccp/inquiry/maintain/ORDERBOOK_MM/search/ORDERBOOK_MM`
- **Route Giao Diện**: `/ORDERS/ORDERBOOK_MM`
- **Các trường dữ liệu mẫu**: `ID, CUSTODYCD, TXDATE, TXTIME, EXECTIME, UPDATETIME, TRANSACTTIME, AFACCTNO`

### • [CASHTRANFER_HIST] Lịch sử Nộp/ Rút tiền (NR)
- **Endpoint**: `/ccp/inquiry/maintain/CASHTRANFER_HIST/search/CASHTRANFER_HIST`
- **Route Giao Diện**: `/CASHTRANFER/CASHTRANFER_HIST`
- **Các trường dữ liệu mẫu**: `TXDATE, MEMBER_CODE, MEMBER_NAME, ACCTNO, FULLNAME, TYPE, AMOUNT, CURRENCY`

### • [ACCOUNTS_INFO] Danh sách tài khoản (DSTKGD)
- **Endpoint**: `/ccp/inquiry/maintain/ACCOUNTS_INFO/search/ACCOUNTS_INFO`
- **Route Giao Diện**: `/ACCOUNTMNG/ACCOUNTS_INFO`
- **Các trường dữ liệu mẫu**: `CUSTODYCD, INVESTORCODE, ACCTNO, CUSTID, FULLNAME, MEMBERCODE, MEMBERNAME, STATUS`

### • [ACCTMARGIN_ALL] Quản lý trạng thái TKGD (Ký quỹ)
- **Endpoint**: `/ccp/inquiry/maintain/ACCTMARGIN_ALL/search/ACCTMARGIN_ALL`
- **Route Giao Diện**: `/RISKMNG/ACCTMARGIN_ALL`
- **Các trường dữ liệu mẫu**: `DELIVERY_FEE, SUBSTITUTE_FEE, DELIVERY_MARGIN, INVESTORCODE, ACCTNO, FULLNAME, MEMBERCODE, MEMBERNAME`

### • [SETTLEMENT] Quản lý giá thanh toán (GTT)
- **Endpoint**: `/ccp/inquiry/maintain/SETTLEMENT/search/SETTLEMENT`
- **Route Giao Diện**: `/PRODUCT/SETTLEMENT`
- **Các trường dữ liệu mẫu**: `UACODE, SECTORCODE, SECTORCODE_DESC, EXCHANGE, EXCHANGE_DESC, VN_FULLNAME, EN_FULLNAME, SYMBOL`

### • [SETTLEMENT_HIST] Lịch sử giá thanh toán
- **Endpoint**: `/ccp/inquiry/maintain/SETTLEMENT_HIST/search/SETTLEMENT_HIST`
- **Route Giao Diện**: `/PRODUCT/SETTLEMENT_HIST`
- **Các trường dữ liệu mẫu**: `UACODE, SECTORCODE, SECTORCODE_DESC, EXCHANGE, EXCHANGE_DESC, VN_FULLNAME, EN_FULLNAME, SYMBOL`

### • [COMMODITY] Quản lý hàng hóa, hợp đồng (HH)
- **Endpoint**: `/ccp/inquiry/maintain/COMMODITY/search/COMMODITY`
- **Route Giao Diện**: `/PRODUCT/COMMODITY`
- **Các trường dữ liệu mẫu**: `UACODE, UACODE_EX, SECTORCODE, SECTORCODE_DESC, EXCHANGE, EXCHANGE_DESC, VN_FULLNAME, EN_FULLNAME`

### • [FCM_INFORMATION] Danh sách FCM
- **Endpoint**: `/ccp/inquiry/maintain/FCM_INFORMATION/search/FCM_INFORMATION`
- **Route Giao Diện**: `/FCMMNG/FCM_INFORMATION`
- **Các trường dữ liệu mẫu**: `FCMCODE, FCMNAME, OMNIBUS, ISUSETAN, ISUSETAN_DESC, STATUS, STATUS_DESC, APR_STATUS`

### • [CURRENCYEXCHANGERATE] Tỷ giá nguyên tệ
- **Endpoint**: `/ccp/inquiry/maintain/CURRENCYEXCHANGERATE/search/CURRENCYEXCHANGERATE`
- **Route Giao Diện**: `/SYSCONFIGMNG/CURRENCYEXCHANGERATE`
- **Các trường dữ liệu mẫu**: `BASECURRENCY, EXCHANGERATE, BUYRATE, SELLRATE, CREATEDDATE, LASTCHANGE, STATUS_DESC, APPRV_STS`

