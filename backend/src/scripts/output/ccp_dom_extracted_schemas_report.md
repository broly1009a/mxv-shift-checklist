# BÁO CÁO QUÉT THỰC TẾ DOM CÁC MÀN HÌNH CORECCP (GROUND TRUTH AUDIT)

> **Thời gian quét:** 10:08:56 14/10/2026
> **Môi trường:** `https://uat-coreccp.mxv.com.vn`
> **Phương pháp:** Trích xuất tự động qua Playwright `th.id` (JSON Field Key) và `th.innerText` (Tiêu đề cột tiếng Việt) từ DOM thực tế trên trình duyệt.
> **Cam kết:** 100% dữ liệu gốc từ DOM hệ thống CoreCCP, tuyệt đối không phỏng đoán, không tự chế, không suy diễn tên cột.

## 1. TỔNG QUAN KẾT QUẢ QUÉT

| STT | Schema Key | Tên Màn Hình / Tab | URL Route | File Excel Dự Kiến | Số Cột DOM | Trạng Thái |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| 1 | `ORDERBOOK` | Sổ lệnh - Tất cả (DSL CCP) | `/ORDERS/ORDERBOOK` | `DSL CCP.xlsx` | **29** | ✅ Thành công |
| 2 | `ORDERBOOK_MATCH` | Sổ lệnh - Đã khớp (DSLDK CCP) | `/ORDERS/ORDERBOOK` | `DSLDK CCP.xlsx` | **29** | ✅ Thành công |
| 3 | `ORDERBOOK_PENDING` | Sổ lệnh - Chờ khớp (DSLCK CCP) | `/ORDERS/ORDERBOOK` | `DSLCK CCP.xlsx` | **29** | ✅ Thành công |
| 4 | `ORDERBOOK_CANCEL` | Sổ lệnh - Đã hủy (DSLDH CCP) | `/ORDERS/ORDERBOOK` | `DSLDH CCP.xlsx` | **29** | ✅ Thành công |
| 5 | `ORDERMATCH_DETAIL` | Khớp lệnh chi tiết (DSGD CCP) | `/ORDERS/ORDERMATCH_DETAIL` | `DSGD CCP.xlsx` | **27** | ✅ Thành công |
| 6 | `ORDERBOOK_MM` | Sổ lệnh MM - Tất cả (DSL MM CCP) | `/ORDERS/ORDERBOOK_MM` | `DSL MM CCP.xlsx` | **29** | ✅ Thành công |
| 7 | `ORDERBOOK_MATCH_MM` | Sổ lệnh MM - Đã khớp (DSLDK MM CCP) | `/ORDERS/ORDERBOOK_MM` | `DSLDK MM CCP.xlsx` | **29** | ✅ Thành công |
| 8 | `ORDERBOOK_PENDING_MM` | Sổ lệnh MM - Chờ khớp (DSLCK MM CCP) | `/ORDERS/ORDERBOOK_MM` | `DSLCK MM CCP.xlsx` | **29** | ✅ Thành công |
| 9 | `ORDERBOOK_CANCEL_MM` | Sổ lệnh MM - Đã hủy (DSLDH MM CCP) | `/ORDERS/ORDERBOOK_MM` | `DSLDH MM CCP.xlsx` | **29** | ✅ Thành công |
| 10 | `ORDERBOOK_ALL_MM` | Lịch sử giao dịch MM (DSGD MM CCP) | `/ORDERS/ORDERBOOK_ALL_MM` | `DSGD MM CCP.xlsx` | **29** | ✅ Thành công |
| 11 | `OPEN_POSITION_EXPORT` | Vị thế mở (TTM CCP) | `/ORDERS/OPEN_POSITION` | `TTM CCP.xlsx` | **24** | ✅ Thành công |
| 12 | `PNL_EXECUTED` | Lịch sử tất toán (TTTT) | `/ORDERS/PNL_EXECUTED` | `TTTT.xlsx` | **31** | ✅ Thành công |
| 13 | `ACCTMARGIN_ALL` | Quản lý TT TKGD (QL TT TKGD.xlsx) | `/RISKMNG/ACCTMARGIN_ALL` | `QL TT TKGD.xlsx` | **49** | ✅ Thành công |
| 14 | `MEMBERMARGIN_ALL` | Quản lý TT TVKD (QL TT TVKD.xlsx) | `/RISKMNG/ACCTMARGIN_ALL` | `QL TT TVKD.xlsx` | **48** | ✅ Thành công |
| 15 | `MARGIN_MNG_TRANSACTION` | Quản lý Ký quỹ TKGD (DSQLKQ TKGD.xlsx) | `/RISKMNG/MARGIN_MNG` | `DSQLKQ TKGD.xlsx` | **29** | ✅ Thành công |
| 16 | `MARGIN_MNG_MEMBER` | Quản lý Ký quỹ TVKD (DSQLKQ TVKD.xlsx) | `/RISKMNG/MARGIN_MNG` | `DSQLKQ TVKD.xlsx` | **16** | ✅ Thành công |
| 17 | `CASHTRANFER_HIST` | Lịch sử nộp rút tiền (NR.xlsx) | `/CASHTRANFER/CASHTRANFER_HIST` | `NR.xlsx` | **14** | ✅ Thành công |
| 18 | `ACCOUNTS_INFO` | Danh sách tài khoản (DSTKGD ACM.xlsx) | `/ACCOUNTMNG/ACCOUNTS_INFO` | `DSTKGD ACM.xlsx` | **16** | ✅ Thành công |
| 19 | `SETTLEMENT` | Giá thanh toán (GTT CCP.xlsx) | `/PRODUCT/SETTLEMENT` | `GTT CCP.xlsx` | **16** | ✅ Thành công |
| 20 | `COMMODITY` | Hàng hóa (HH.xlsx) | `/PRODUCT/COMMODITY` | `HH.xlsx` | **36** | ✅ Thành công |

## 2. CHI TIẾT DANH MỤC CỘT (KEY & HEADER) TỪNG MÀN HÌNH

### Sổ lệnh - Tất cả (DSL CCP) (`ORDERBOOK`)

- **Route:** `/ORDERS/ORDERBOOK`
- **Tab:** `Tất cả`
- **File Excel:** `DSL CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **29 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ROOTORDERID` | ClorID MXV |
| 4 | `REQUESTID` | ClorID TVKD |
| 5 | `ODORDERID` | Mã lệnh |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `AFACCTNO` | Mã TKGD |
| 8 | `SYMBOL` | Mã HĐ |
| 9 | `STATUS_DESC` | Trạng thái |
| 10 | `SIDE_DESC` | Mua/Bán |
| 11 | `PRICETYPE_DESC` | Loại lệnh |
| 12 | `QTTY` | KL đặt |
| 13 | `EXECQTTY` | KL khớp |
| 14 | `PRICE` | Giá đặt |
| 15 | `STOP_PRICE` | Giá dừng |
| 16 | `EXECPRICE` | Giá khớp trung bình |
| 17 | `REMAINQTTY` | KL còn lại |
| 18 | `CANCELQTTY` | KL hủy |
| 19 | `FEEAMT` | Phí giao dịch |
| 20 | `TRANSACTTIME` | Thời gian đặt |
| 21 | `TIMETYPE_DESC` | Hiệu lực |
| 22 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 23 | `EXPDATE` | Ngày hiệu lực |
| 24 | `FULLNAME` | Tên TKGD |
| 25 | `INS_FULLNAME` | Tên hợp đồng |
| 26 | `MEMBERCODE` | Mã thành viên |
| 27 | `MEMBERNAME` | Tên thành viên |
| 28 | `TLNAME` | Người đặt lệnh |
| 29 | `UPDATETIME` | Thời gian thực hiện |

---

### Sổ lệnh - Đã khớp (DSLDK CCP) (`ORDERBOOK_MATCH`)

- **Route:** `/ORDERS/ORDERBOOK`
- **Tab:** `Lệnh đã khớp`
- **File Excel:** `DSLDK CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **29 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ROOTORDERID` | ClorID MXV |
| 4 | `REQUESTID` | ClorID TVKD |
| 5 | `ODORDERID` | Mã lệnh |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `AFACCTNO` | Mã TKGD |
| 8 | `SYMBOL` | Mã HĐ |
| 9 | `STATUS_DESC` | Trạng thái |
| 10 | `SIDE_DESC` | Mua/Bán |
| 11 | `PRICETYPE_DESC` | Loại lệnh |
| 12 | `QTTY` | KL đặt |
| 13 | `EXECQTTY` | KL khớp |
| 14 | `PRICE` | Giá đặt |
| 15 | `STOP_PRICE` | Giá dừng |
| 16 | `EXECPRICE` | Giá khớp trung bình |
| 17 | `REMAINQTTY` | KL còn lại |
| 18 | `CANCELQTTY` | KL hủy |
| 19 | `FEEAMT` | Phí giao dịch |
| 20 | `TRANSACTTIME` | Thời gian đặt |
| 21 | `TIMETYPE_DESC` | Hiệu lực |
| 22 | `EXPDATE` | Ngày hiệu lực |
| 23 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 24 | `FULLNAME` | Tên TKGD |
| 25 | `INS_FULLNAME` | Tên hợp đồng |
| 26 | `MEMBERCODE` | Mã thành viên |
| 27 | `MEMBERNAME` | Tên thành viên |
| 28 | `TLNAME` | Người đặt lệnh |
| 29 | `UPDATETIME` | Thời gian khớp lệnh |

---

### Sổ lệnh - Chờ khớp (DSLCK CCP) (`ORDERBOOK_PENDING`)

- **Route:** `/ORDERS/ORDERBOOK`
- **Tab:** `Lệnh chờ khớp`
- **File Excel:** `DSLCK CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **29 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ROOTORDERID` | ClorID MXV |
| 4 | `REQUESTID` | ClorID TVKD |
| 5 | `ODORDERID` | Mã lệnh |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `AFACCTNO` | Mã TKGD |
| 8 | `SYMBOL` | Mã HĐ |
| 9 | `STATUS_DESC` | Trạng thái |
| 10 | `SIDE_DESC` | Mua/Bán |
| 11 | `PRICETYPE_DESC` | Loại lệnh |
| 12 | `QTTY` | KL đặt |
| 13 | `EXECQTTY` | KL khớp |
| 14 | `PRICE` | Giá đặt |
| 15 | `STOP_PRICE` | Giá dừng |
| 16 | `EXECPRICE` | Giá khớp trung bình |
| 17 | `REMAINQTTY` | KL còn lại |
| 18 | `CANCELQTTY` | KL hủy |
| 19 | `FEEAMT` | Phí giao dịch |
| 20 | `TRANSACTTIME` | Thời gian đặt |
| 21 | `TIMETYPE_DESC` | Hiệu lực |
| 22 | `EXPDATE` | Ngày hiệu lực |
| 23 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 24 | `FULLNAME` | Tên TKGD |
| 25 | `INS_FULLNAME` | Tên hợp đồng |
| 26 | `MEMBERCODE` | Mã thành viên |
| 27 | `MEMBERNAME` | Tên thành viên |
| 28 | `TLNAME` | Người đặt lệnh |
| 29 | `UPDATETIME` | Thời gian thực hiện |

---

### Sổ lệnh - Đã hủy (DSLDH CCP) (`ORDERBOOK_CANCEL`)

- **Route:** `/ORDERS/ORDERBOOK`
- **Tab:** `Lệnh đã hủy`
- **File Excel:** `DSLDH CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **29 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ROOTORDERID` | ClorID MXV |
| 4 | `REQUESTID` | ClorID TVKD |
| 5 | `ODORDERID` | Mã lệnh |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `AFACCTNO` | Mã TKGD |
| 8 | `SYMBOL` | Mã HĐ |
| 9 | `STATUS_DESC` | Trạng thái |
| 10 | `SIDE_DESC` | Mua/Bán |
| 11 | `PRICETYPE_DESC` | Loại lệnh |
| 12 | `QTTY` | KL đặt |
| 13 | `EXECQTTY` | KL khớp |
| 14 | `PRICE` | Giá đặt |
| 15 | `STOP_PRICE` | Giá dừng |
| 16 | `EXECPRICE` | Giá khớp trung bình |
| 17 | `REMAINQTTY` | KL còn lại |
| 18 | `CANCELQTTY` | KL hủy |
| 19 | `FEEAMT` | Phí giao dịch |
| 20 | `TRANSACTTIME` | Thời gian đặt |
| 21 | `TIMETYPE_DESC` | Hiệu lực |
| 22 | `EXPDATE` | Ngày hiệu lực |
| 23 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 24 | `FULLNAME` | Tên TKGD |
| 25 | `INS_FULLNAME` | Tên hợp đồng |
| 26 | `MEMBERCODE` | Mã thành viên |
| 27 | `MEMBERNAME` | Tên thành viên |
| 28 | `TLNAME` | Người đặt lệnh |
| 29 | `UPDATETIME` | Thời gian hủy lệnh |

---

### Khớp lệnh chi tiết (DSGD CCP) (`ORDERMATCH_DETAIL`)

- **Route:** `/ORDERS/ORDERMATCH_DETAIL`
- **Tab:** `Mặc định`
- **File Excel:** `DSGD CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **27 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ODORDERID` | Mã lệnh |
| 4 | `EXECID` | Mã giao dịch OMS |
| 5 | `EXCHANGEEXECID` | Mã giao dịch EX |
| 6 | `AFACCTNO` | Mã TKGD |
| 7 | `SYMBOL` | Mã HĐ |
| 8 | `SIDE_DESC` | Mua/Bán |
| 9 | `PRICETYPE_DESC` | Loại lệnh |
| 10 | `QTTY` | KL đặt |
| 11 | `EXECQTTY` | KL khớp |
| 12 | `PRICE` | Giá đặt |
| 13 | `STOP_PRICE` | Giá dừng |
| 14 | `EXECPRICE` | Giá khớp trung bình |
| 15 | `REMAINQTTY` | KL còn lại |
| 16 | `CANCELQTTY` | KL hủy |
| 17 | `FEEAMT` | Phí giao dịch |
| 18 | `TRANSACTTIME` | Thời gian đặt |
| 19 | `TIMETYPE_DESC` | Hiệu lực |
| 20 | `EXPDATE` | Ngày hiệu lực |
| 21 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 22 | `FULLNAME` | Tên TKGD |
| 23 | `INS_FULLNAME` | Tên hợp đồng |
| 24 | `MEMBERCODE` | Mã thành viên |
| 25 | `MEMBERNAME` | Tên thành viên |
| 26 | `TLNAME` | Người đặt lệnh |
| 27 | `UPDATETIME` | Thời gian khớp lệnh |

---

### Sổ lệnh MM - Tất cả (DSL MM CCP) (`ORDERBOOK_MM`)

- **Route:** `/ORDERS/ORDERBOOK_MM`
- **Tab:** `Tất cả`
- **File Excel:** `DSL MM CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **29 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ROOTORDERID` | ClorID MXV |
| 4 | `REQUESTID` | ClorID TVKD |
| 5 | `ODORDERID` | Mã lệnh |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `AFACCTNO` | Mã TKGD |
| 8 | `SYMBOL` | Mã HĐ |
| 9 | `STATUS_DESC` | Trạng thái |
| 10 | `SIDE_DESC` | Mua/Bán |
| 11 | `PRICETYPE_DESC` | Loại lệnh |
| 12 | `QTTY` | KL đặt |
| 13 | `EXECQTTY` | KL khớp |
| 14 | `PRICE` | Giá đặt |
| 15 | `STOP_PRICE` | Giá dừng |
| 16 | `EXECPRICE` | Giá khớp trung bình |
| 17 | `REMAINQTTY` | KL còn lại |
| 18 | `CANCELQTTY` | KL hủy |
| 19 | `FEEAMT` | Phí giao dịch |
| 20 | `TRANSACTTIME` | Thời gian đặt |
| 21 | `TIMETYPE_DESC` | Hiệu lực |
| 22 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 23 | `EXPDATE` | Ngày hiệu lực |
| 24 | `FULLNAME` | Tên TKGD |
| 25 | `INS_FULLNAME` | Tên hợp đồng |
| 26 | `MEMBERCODE` | Mã thành viên |
| 27 | `MEMBERNAME` | Tên thành viên |
| 28 | `TLNAME` | Người đặt lệnh |
| 29 | `UPDATETIME` | Thời gian thực hiện |

---

### Sổ lệnh MM - Đã khớp (DSLDK MM CCP) (`ORDERBOOK_MATCH_MM`)

- **Route:** `/ORDERS/ORDERBOOK_MM`
- **Tab:** `Lệnh đã khớp`
- **File Excel:** `DSLDK MM CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **29 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ROOTORDERID` | ClorID MXV |
| 4 | `REQUESTID` | ClorID TVKD |
| 5 | `ODORDERID` | Mã lệnh |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `AFACCTNO` | Mã TKGD |
| 8 | `SYMBOL` | Mã HĐ |
| 9 | `STATUS_DESC` | Trạng thái |
| 10 | `SIDE_DESC` | Mua/Bán |
| 11 | `PRICETYPE_DESC` | Loại lệnh |
| 12 | `QTTY` | KL đặt |
| 13 | `EXECQTTY` | KL khớp |
| 14 | `PRICE` | Giá đặt |
| 15 | `STOP_PRICE` | Giá dừng |
| 16 | `EXECPRICE` | Giá khớp trung bình |
| 17 | `REMAINQTTY` | KL còn lại |
| 18 | `CANCELQTTY` | KL hủy |
| 19 | `FEEAMT` | Phí giao dịch |
| 20 | `TRANSACTTIME` | Thời gian đặt |
| 21 | `TIMETYPE_DESC` | Hiệu lực |
| 22 | `EXPDATE` | Ngày hiệu lực |
| 23 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 24 | `FULLNAME` | Tên TKGD |
| 25 | `INS_FULLNAME` | Tên hợp đồng |
| 26 | `MEMBERCODE` | Mã thành viên |
| 27 | `MEMBERNAME` | Tên thành viên |
| 28 | `TLNAME` | Người đặt lệnh |
| 29 | `UPDATETIME` | Thời gian khớp lệnh |

---

### Sổ lệnh MM - Chờ khớp (DSLCK MM CCP) (`ORDERBOOK_PENDING_MM`)

- **Route:** `/ORDERS/ORDERBOOK_MM`
- **Tab:** `Lệnh chờ khớp`
- **File Excel:** `DSLCK MM CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **29 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ROOTORDERID` | ClorID MXV |
| 4 | `REQUESTID` | ClorID TVKD |
| 5 | `ODORDERID` | Mã lệnh |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `AFACCTNO` | Mã TKGD |
| 8 | `SYMBOL` | Mã HĐ |
| 9 | `STATUS_DESC` | Trạng thái |
| 10 | `SIDE_DESC` | Mua/Bán |
| 11 | `PRICETYPE_DESC` | Loại lệnh |
| 12 | `QTTY` | KL đặt |
| 13 | `EXECQTTY` | KL khớp |
| 14 | `PRICE` | Giá đặt |
| 15 | `STOP_PRICE` | Giá dừng |
| 16 | `EXECPRICE` | Giá khớp trung bình |
| 17 | `REMAINQTTY` | KL còn lại |
| 18 | `CANCELQTTY` | KL hủy |
| 19 | `FEEAMT` | Phí giao dịch |
| 20 | `TRANSACTTIME` | Thời gian đặt |
| 21 | `TIMETYPE_DESC` | Hiệu lực |
| 22 | `EXPDATE` | Ngày hiệu lực |
| 23 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 24 | `FULLNAME` | Tên TKGD |
| 25 | `INS_FULLNAME` | Tên hợp đồng |
| 26 | `MEMBERCODE` | Mã thành viên |
| 27 | `MEMBERNAME` | Tên thành viên |
| 28 | `TLNAME` | Người đặt lệnh |
| 29 | `UPDATETIME` | Thời gian thực hiện |

---

### Sổ lệnh MM - Đã hủy (DSLDH MM CCP) (`ORDERBOOK_CANCEL_MM`)

- **Route:** `/ORDERS/ORDERBOOK_MM`
- **Tab:** `Lệnh đã hủy`
- **File Excel:** `DSLDH MM CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **29 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ROOTORDERID` | ClorID MXV |
| 4 | `REQUESTID` | ClorID TVKD |
| 5 | `ODORDERID` | Mã lệnh |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `AFACCTNO` | Mã TKGD |
| 8 | `SYMBOL` | Mã HĐ |
| 9 | `STATUS_DESC` | Trạng thái |
| 10 | `SIDE_DESC` | Mua/Bán |
| 11 | `PRICETYPE_DESC` | Loại lệnh |
| 12 | `QTTY` | KL đặt |
| 13 | `EXECQTTY` | KL khớp |
| 14 | `PRICE` | Giá đặt |
| 15 | `STOP_PRICE` | Giá dừng |
| 16 | `EXECPRICE` | Giá khớp trung bình |
| 17 | `REMAINQTTY` | KL còn lại |
| 18 | `CANCELQTTY` | KL hủy |
| 19 | `FEEAMT` | Phí giao dịch |
| 20 | `TRANSACTTIME` | Thời gian đặt |
| 21 | `TIMETYPE_DESC` | Hiệu lực |
| 22 | `EXPDATE` | Ngày hiệu lực |
| 23 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 24 | `FULLNAME` | Tên TKGD |
| 25 | `INS_FULLNAME` | Tên hợp đồng |
| 26 | `MEMBERCODE` | Mã thành viên |
| 27 | `MEMBERNAME` | Tên thành viên |
| 28 | `TLNAME` | Người đặt lệnh |
| 29 | `UPDATETIME` | Thời gian hủy lệnh |

---

### Lịch sử giao dịch MM (DSGD MM CCP) (`ORDERBOOK_ALL_MM`)

- **Route:** `/ORDERS/ORDERBOOK_ALL_MM`
- **Tab:** `Mặc định`
- **File Excel:** `DSGD MM CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **29 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ROOTORDERID` | ClorID MXV |
| 4 | `REQUESTID` | ClorID TVKD |
| 5 | `ODORDERID` | Mã lệnh |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `AFACCTNO` | Mã TKGD |
| 8 | `SYMBOL` | Mã HĐ |
| 9 | `STATUS_DESC` | Trạng thái |
| 10 | `SIDE_DESC` | Mua/Bán |
| 11 | `PRICETYPE_DESC` | Loại lệnh |
| 12 | `QTTY` | KL đặt |
| 13 | `EXECQTTY` | KL khớp |
| 14 | `PRICE` | Giá đặt |
| 15 | `STOP_PRICE` | Giá dừng |
| 16 | `EXECPRICE` | Giá khớp trung bình |
| 17 | `REMAINQTTY` | KL còn lại |
| 18 | `CANCELQTTY` | KL hủy |
| 19 | `FEEAMT` | Phí giao dịch |
| 20 | `TRANSACTTIME` | Thời gian đặt |
| 21 | `TIMETYPE_DESC` | Hiệu lực |
| 22 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 23 | `EXPDATE` | Ngày hiệu lực |
| 24 | `FULLNAME` | Tên TKGD |
| 25 | `INS_FULLNAME` | Tên hợp đồng |
| 26 | `MEMBERCODE` | Mã thành viên |
| 27 | `MEMBERNAME` | Tên thành viên |
| 28 | `TLNAME` | Người đặt lệnh |
| 29 | `UPDATETIME` | Thời gian thực hiện |

---

### Vị thế mở (TTM CCP) (`OPEN_POSITION_EXPORT`)

- **Route:** `/ORDERS/OPEN_POSITION`
- **Tab:** `Mặc định`
- **File Excel:** `TTM CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **24 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `SYMBOL` | Mã hợp đồng |
| 2 | `MEMBERCODE` | Mã thành viên |
| 3 | `MEMBER_NAME` | Tên thành viên |
| 4 | `CUSTODYCD` | Mã KH |
| 5 | `ACCTNO` | Mã TKGD |
| 6 | `FULLNAME` | Tên KH |
| 7 | `INS_NAME` | Tên hợp đồng |
| 8 | `MARKETPRICE` | Giá thị trường |
| 9 | `LONGQTTY` | Khối lượng mua |
| 10 | `SHORTQTTY` | Khối lượng bán |
| 11 | `REMAIN_LQTTY` | KL Mua chờ khớp |
| 12 | `REMAIN_SQTTY` | KL Bán chờ khớp |
| 13 | `VWAP` | Giá TB |
| 14 | `EVRPLAMT` | Lãi lỗ dự kiến |
| 15 | `EVRPLAMT_VND` | Lãi lỗ dự kiến(VND) |
| 16 | `ORDERID` | Mã lệnh |
| 17 | `EXECID` | Mã giao dịch OMS |
| 18 | `EXCHANGEEXECID` | Mã giao dịch EX |
| 19 | `TIME_CREATED` | Ngày giờ đặt lệnh |
| 20 | `TXDATE` | Ngày giờ thực hiện |
| 21 | `FCM_ID` | Mã FCM |
| 22 | `FCM_NAME` | Tên FCM |
| 23 | `MVO` | MVO |
| 24 | `MVO_VND` | MVO (VND) |

---

### Lịch sử tất toán (TTTT) (`PNL_EXECUTED`)

- **Route:** `/ORDERS/PNL_EXECUTED`
- **Tab:** `Lịch sử tất toán`
- **File Excel:** `TTTT.xlsx`
- **Tổng số cột trích xuất từ DOM:** **31 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `SYMBOL` | Mã hợp đồng |
| 2 | `PNLEXCUTED_USD` | Lãi lỗ thực tế |
| 3 | `PNLEXCUTED_VND` | Lãi lỗ thực tế(VND) |
| 4 | `MEMBERID` | Mã thành viên |
| 5 | `MEMBERNAME` | Tên thành viên |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `ACCTNO` | Mã TKGD |
| 8 | `FULLNAME` | Tên KH |
| 9 | `INS_FULLNAME` | Tên hợp đồng |
| 10 | `LONGQTTY` | Khối lượng mua |
| 11 | `SHORTQTTY` | Khối lượng bán |
| 12 | `BUYPRICE` | Giá mua |
| 13 | `SELLPRICE` | Giá bán |
| 14 | `ID_BUY` | Mã lệnh mua |
| 15 | `ID_SELL` | Mã lệnh bán |
| 16 | `FCM_ID` | Mã FCM |
| 17 | `FCM_NAME` | Tên FCM |
| 18 | `PART_ID` | Mã ĐT |
| 19 | `PART_NAME` | Tên ĐT |
| 20 | `TIME_CREATED` | Ngày giờ đặt lệnh mở vị thế |
| 21 | `EXECTIME_OPEN` | Ngày giờ khớp lệnh mở |
| 22 | `TIMECREATE_CLOSE` | Ngày giờ đặt lệnh đóng |
| 23 | `MATCHTIME` | Ngày giờ ghép |
| 24 | `TXDATE` | Ngày phiên |
| 25 | `SETTLEMENT_VND` | Phí dịch vụ thanh toán (VND) |
| 26 | `SETTLEMENT_USD` | Phí dịch vụ thanh toán |
| 27 | `EXECID_BUY` | Mã giao dịch mua OMS |
| 28 | `EXECID_SELL` | Mã giao dịch bán OMS |
| 29 | `EX_EXECID_BUY` | Mã giao dịch mua EX |
| 30 | `EX_EXECID_SELL` | Mã giao dịch bán EX |
| 31 | `CLOSE_SIDE` | Chiều mở vị thế |

---

### Quản lý TT TKGD (QL TT TKGD.xlsx) (`ACCTMARGIN_ALL`)

- **Route:** `/RISKMNG/ACCTMARGIN_ALL`
- **Tab:** `Danh sách trạng thái TKGD`
- **File Excel:** `QL TT TKGD.xlsx`
- **Tổng số cột trích xuất từ DOM:** **49 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `INVESTORCODE` | Mã TKGD |
| 2 | `FULLNAME` | Tên TKGD |
| 3 | `MEMBERCODE` | Mã TVKD |
| 4 | `MEMBERNAME` | Tên TVKD |
| 5 | `STATUS` | Trạng thái |
| 6 | `RTT` | Tỷ lệ ký quỹ (%) |
| 7 | `IMCASH` | Số dư TKKQ |
| 8 | `REQADDSECURED` | Mức bổ sung ký quỹ |
| 9 | `REQSECURED` | KQ ban đầu yêu cầu |
| 10 | `REQSECURED_USD` | KQ ban đầu yêu cầu (USD) |
| 11 | `EREQSECURED` | KQ ban đầu yêu cầu tạm tính |
| 12 | `EREQSECURED_USD` | KQ ban đầu yêu cầu tạm tính (USD) |
| 13 | `RVRPLAMT_F` | Lãi lỗ thực tế Future (VND) |
| 14 | `RVRPLAMT_USD_F` | Lãi lỗ thực tế Future (USD) |
| 15 | `EVRPLAMT_F` | Lãi lỗ dự kiến Future (VND) |
| 16 | `EVRPLAMT_USD_F` | Lãi lỗ dự kiến Future (USD) |
| 17 | `RVRPLAMT_F_T1` | Lãi lỗ thực tế T-1 Future (VND) |
| 18 | `RVRPLAMT_USD_F_T1` | Lãi lỗ thực tế T-1 Future (USD) |
| 19 | `NAV` | Giá trị ròng ký quỹ |
| 20 | `NAV_USD` | Giá trị ròng ký quỹ (USD) |
| 21 | `AVLSECURED` | Ký quỹ khả dụng tạm tính |
| 22 | `AVLSECURED_EXEC` | Ký quỹ khả dụng |
| 23 | `AVLSECURED_USD` | Ký quỹ khả dụng (USD) |
| 24 | `FEEAMT` | Phí giao dịch |
| 25 | `NETAMT` | Nộp rút trong phiên |
| 26 | `NETAMT_USD` | Nộp rút trong phiên (USD) |
| 27 | `DELIVERY_MARGIN` | Ký quỹ giao nhận |
| 28 | `DELIVERY_FEE` | Phí giao nhận |
| 29 | `SUBSTITUTE_FEE` | Phí thực hiện thay nghĩa vụ |
| 30 | `PAID_SETTLEMENT_FEEAMT` | Phí dịch vụ thanh toán |
| 31 | `SETTLEMENTCASHFEE` | Phí thanh toán đáo hạn bằng tiền |
| 32 | `EVRPLAMT_LTD_BUYSELLRATE` | Lãi lỗ vị thế đáo hạn |
| 33 | `BOD_IMCASH` | Số dư đầu ngày |
| 34 | `BOD_IMCASH_USD` | Số dư đầu ngày (USD) |
| 35 | `EOD_IMCASH` | Số dư cuối ngày |
| 36 | `EOD_IMCASH_USD` | Số dư cuối ngày (USD) |
| 37 | `SECURED_PROCESS_METHOD` | Phương thức xử lý |
| 38 | `OPTION_FEE` | Phí quyền chọn |
| 39 | `OPTION_FEE_VSD` | Phí quyền chọn (USD) |
| 40 | `MVO` | MVO |
| 41 | `MVO_USD` | MVO (USD) |
| 42 | `RVRPLAMT_WFM` | Lãi lỗ chờ đáo hạn |
| 43 | `RVRPLAMT_WFM_USD` | Lãi lỗ chờ đáo hạn (USD) |
| 44 | `RVRPLAMT_OPTION` | Lãi lỗ Options |
| 45 | `RVRPLAMT_OPTION_USD` | Lãi lỗ Options (USD) |
| 46 | `EVRPLAMT_OPTION` | Lãi lỗ dự kiến Options |
| 47 | `EVRPLAMT_OPTION_USD` | Lãi lỗ dự kiến Options (USD) |
| 48 | `BOD_EIMCASH` | Số dư đầu ngày tạm tính |
| 49 | `BOD_EIMCASH_USD` | Số dư đầu ngày tạm tính (USD) |

---

### Quản lý TT TVKD (QL TT TVKD.xlsx) (`MEMBERMARGIN_ALL`)

- **Route:** `/RISKMNG/ACCTMARGIN_ALL`
- **Tab:** `Danh sách trạng thái TKTVKD`
- **File Excel:** `QL TT TVKD.xlsx`
- **Tổng số cột trích xuất từ DOM:** **48 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `MEMBERCODE` | Mã TVKD |
| 2 | `MEMBERNAME` | Tên TVKD |
| 3 | `ACTYPE` | Loại hình tiểu khoản |
| 4 | `STATUS` | Trạng thái |
| 5 | `RTT` | Tỷ lệ ký quỹ (%) |
| 6 | `IMCASH` | Số dư TKKQ hiện tại |
| 7 | `REQADDSECURED` | Mức bổ sung ký quỹ |
| 8 | `REQSECURED` | KQ ban đầu yêu cầu |
| 9 | `REQSECURED_USD` | KQ ban đầu yêu cầu (USD) |
| 10 | `EREQSECURED` | KQ ban đầu yêu cầu tạm tính |
| 11 | `EREQSECURED_USD` | KQ ban đầu yều cầu tạm tính (USD) |
| 12 | `RVRPLAMT_F` | Lãi lỗ thực tế Future (VND) |
| 13 | `RVRPLAMT_USD_F` | Lãi lỗ thực tế Future (USD) |
| 14 | `EVRPLAMT_F` | Lãi lỗ dự kiến Future (VND) |
| 15 | `EVRPLAMT_USD_F` | Lãi lỗ dự kiến Future (USD) |
| 16 | `RVRPLAMT_F_T1` | Lãi lỗ thực tế T-1 Future (VND) |
| 17 | `RVRPLAMT_USD_F_T1` | Lãi lỗ thực tế T-1 Future (USD) |
| 18 | `NAV` | Giá trị ròng ký quỹ |
| 19 | `NAV_USD` | Giá trị ròng ký quỹ (USD) |
| 20 | `AVLSECURED` | Ký quỹ khả dụng tạm tính |
| 21 | `AVLSECURED_EXEC` | Ký quỹ khả dụng |
| 22 | `AVLSECURED_USD` | Ký quỹ khả dụng (USD) |
| 23 | `FEEAMT` | Phí giao dịch |
| 24 | `DELIVERY_MARGIN` | Ký quỹ giao nhận |
| 25 | `DELIVERY_FEE` | Phí giao nhận |
| 26 | `SUBSTITUTE_FEE` | Phí thực hiện thay nghĩa vụ |
| 27 | `PAID_SETTLEMENT_FEEAMT` | Phí dịch vụ thanh toán |
| 28 | `SETTLEMENTCASHFEE` | Phí thanh toán đáo hạn bằng tiền |
| 29 | `EVRPLAMT_LTD_BUYSELLRATE` | Lãi lỗ vị thế đáo hạn |
| 30 | `NETAMT` | Nộp rút trong phiên |
| 31 | `NETAMT_USD` | Nộp rút trong phiên (USD) |
| 32 | `BOD_IMCASH` | Số dư đầu ngày |
| 33 | `BOD_IMCASH_USD` | Số dư đầu ngày (USD) |
| 34 | `EOD_IMCASH` | Số dư cuối ngày |
| 35 | `EOD_IMCASH_USD` | Số dư cuối ngày (USD) |
| 36 | `SECURED_PROCESS_METHOD` | Phương thức xử lý |
| 37 | `OPTION_FEE` | Phí quyền chọn |
| 38 | `OPTION_FEE_VSD` | Phí quyền chọn (USD) |
| 39 | `MVO` | MVO |
| 40 | `MVO_USD` | MVO (USD) |
| 41 | `RVRPLAMT_WFM` | Lãi lỗ chờ đáo hạn |
| 42 | `RVRPLAMT_WFM_USD` | Lãi lỗ chờ đáo hạn (USD) |
| 43 | `RVRPLAMT_OPTION` | Lãi lỗ Options |
| 44 | `RVRPLAMT_OPTION_USD` | Lãi lỗ Options (USD) |
| 45 | `EVRPLAMT_OPTION` | Lãi lỗ dự kiến Options |
| 46 | `EVRPLAMT_OPTION_USD` | Lãi lỗ dự kiến Options (USD) |
| 47 | `BOD_EIMCASH` | Số dư đầu ngày tạm tính |
| 48 | `BOD_EIMCASH_USD` | Số dư đầu ngày tạm tính (USD) |

---

### Quản lý Ký quỹ TKGD (DSQLKQ TKGD.xlsx) (`MARGIN_MNG_TRANSACTION`)

- **Route:** `/RISKMNG/MARGIN_MNG`
- **Tab:** `Quản lý ký quỹ TKGD`
- **File Excel:** `DSQLKQ TKGD.xlsx`
- **Tổng số cột trích xuất từ DOM:** **29 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày hệ thống |
| 2 | `SESSION_DATE` | Ngày phiên |
| 3 | `ROOTORDERID` | ClorID MXV |
| 4 | `REQUESTID` | ClorID TVKD |
| 5 | `ODORDERID` | Mã lệnh |
| 6 | `CUSTODYCD` | Mã KH |
| 7 | `AFACCTNO` | Mã TKGD |
| 8 | `SYMBOL` | Mã HĐ |
| 9 | `STATUS_DESC` | Trạng thái |
| 10 | `SIDE_DESC` | Mua/Bán |
| 11 | `PRICETYPE_DESC` | Loại lệnh |
| 12 | `QTTY` | KL đặt |
| 13 | `EXECQTTY` | KL khớp |
| 14 | `PRICE` | Giá đặt |
| 15 | `STOP_PRICE` | Giá dừng |
| 16 | `EXECPRICE` | Giá khớp trung bình |
| 17 | `REMAINQTTY` | KL còn lại |
| 18 | `CANCELQTTY` | KL hủy |
| 19 | `FEEAMT` | Phí giao dịch |
| 20 | `TRANSACTTIME` | Thời gian đặt |
| 21 | `TIMETYPE_DESC` | Hiệu lực |
| 22 | `TRADINGEXCHANGE_DESC` | Sàn giao dịch |
| 23 | `EXPDATE` | Ngày hiệu lực |
| 24 | `FULLNAME` | Tên TKGD |
| 25 | `INS_FULLNAME` | Tên hợp đồng |
| 26 | `MEMBERCODE` | Mã thành viên |
| 27 | `MEMBERNAME` | Tên thành viên |
| 28 | `TLNAME` | Người đặt lệnh |
| 29 | `UPDATETIME` | Thời gian thực hiện |

---

### Quản lý Ký quỹ TVKD (DSQLKQ TVKD.xlsx) (`MARGIN_MNG_MEMBER`)

- **Route:** `/RISKMNG/MARGIN_MNG`
- **Tab:** `Quản lý ký quỹ TVKD`
- **File Excel:** `DSQLKQ TVKD.xlsx`
- **Tổng số cột trích xuất từ DOM:** **16 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `Trạng thái` | Trạng thái |
| 2 | `Cấu hình tham số` | Cấu hình tham số |
| 3 | `Nộp tiền` | Nộp tiền |
| 4 | `Rút tiền` | Rút tiền |
| 5 | `Tài khoản` | Tài khoản |
| 6 | `TXSTATUS_DESC` | Trạng thái |
| 7 | `TXDATE` | Ngày giao dịch |
| 8 | `TXTIME` | Giờ giao dịch |
| 9 | `TXDESC` | Tên nghiệp vụ |
| 10 | `TLNAME` | Người tạo |
| 11 | `OFFID` | Người duyệt |
| 12 | `CHECKERDATE` | Ngày duyệt |
| 13 | `CHECKERTIME` | Giờ duyệt |
| 14 | `ACCTNO` | Số tài khoản |
| 15 | `AMOUNT` | Số tiền |
| 16 | `TXNUM` | Số chứng từ |

---

### Lịch sử nộp rút tiền (NR.xlsx) (`CASHTRANFER_HIST`)

- **Route:** `/CASHTRANFER/CASHTRANFER_HIST`
- **Tab:** `Mặc định`
- **File Excel:** `NR.xlsx`
- **Tổng số cột trích xuất từ DOM:** **14 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `TXDATE` | Ngày yêu cầu |
| 2 | `MEMBER_CODE` | Mã thành viên |
| 3 | `MEMBER_NAME` | Tên thành viên |
| 4 | `ACCTNO` | Số TKGD |
| 5 | `FULLNAME` | Họ và tên |
| 6 | `TYPE` | Loại giao dịch |
| 7 | `AMOUNT` | Số tiền nộp/rút |
| 8 | `CURRENCY` | Tiền tệ |
| 9 | `MAKERDT` | Ngày tạo |
| 10 | `MAKERTM` | Giờ tạo |
| 11 | `MAKERNAME` | Người tạo |
| 12 | `CHECKERDT` | Ngày duyệt |
| 13 | `CHECKERTM` | Giờ duyệt |
| 14 | `CHECKERNAME` | Người duyệt |

---

### Danh sách tài khoản (DSTKGD ACM.xlsx) (`ACCOUNTS_INFO`)

- **Route:** `/ACCOUNTMNG/ACCOUNTS_INFO`
- **Tab:** `Mặc định`
- **File Excel:** `DSTKGD ACM.xlsx`
- **Tổng số cột trích xuất từ DOM:** **16 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `CUSTODYCD` | Mã khách hàng |
| 2 | `INVESTORCODE` | Số TKGD |
| 3 | `FULLNAME` | Tên khách hàng |
| 4 | `MEMBERCODE` | Mã thành viên |
| 5 | `MEMBERNAME` | Tên thành viên |
| 6 | `TRADESEGMENT_DESC` | Loại tiểu khoản |
| 7 | `STATUS_DESC` | Trạng thái tiểu khoản |
| 8 | `OPENEDDATE` | Ngày mở |
| 9 | `CLOSEDDATE` | Ngày đóng |
| 10 | `ACTYPE` | Loại hình |
| 11 | `IMBASKETID` | Rổ ký quỹ |
| 12 | `POSLIMITBASKETID` | Rổ hạn mức |
| 13 | `TRADINGFEEID` | Biểu phí |
| 14 | `RSAFE` | Tỷ lệ an toàn |
| 15 | `RALERT` | Tỷ lệ cảnh báo |
| 16 | `RSUSPEND` | Tỷ lệ xử lý |

---

### Giá thanh toán (GTT CCP.xlsx) (`SETTLEMENT`)

- **Route:** `/PRODUCT/SETTLEMENT`
- **Tab:** `Mặc định`
- **File Excel:** `GTT CCP.xlsx`
- **Tổng số cột trích xuất từ DOM:** **16 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `UACODE` | Mã hàng hóa |
| 2 | `SYMBOL` | Mã hợp đồng |
| 3 | `SECTORCODE_DESC` | Nhóm hàng hóa |
| 4 | `EXCHANGE_DESC` | Loại công cụ |
| 5 | `VN_FULLNAME` | Tên hàng hóa tiếng Việt |
| 6 | `EN_FULLNAME` | Tên hàng hóa tiếng Anh |
| 7 | `FULLNAME` | Tên hợp đồng |
| 8 | `EXPIRY_MONTH` | Tháng đáo hạn |
| 9 | `EXPIRY_YEAR` | Năm đáo hạn |
| 10 | `PRICE_RF` | Giá thanh toán |
| 11 | `PRICE_CE` | Giá trần |
| 12 | `PRICE_FL` | Giá sàn |
| 13 | `OPEN` | Giá mở cửa |
| 14 | `FINAL_SETTLEDT` | Ngày phiên giao dịch |
| 15 | `HALT` | Ngừng giao dịch |
| 16 | `TRADEUNIT` | Tiền tệ |

---

### Hàng hóa (HH.xlsx) (`COMMODITY`)

- **Route:** `/PRODUCT/COMMODITY`
- **Tab:** `Mặc định`
- **File Excel:** `HH.xlsx`
- **Tổng số cột trích xuất từ DOM:** **36 cột**

| Thứ Tự | JSON Key (`th.id`) | Tiêu Đề Tiếng Việt (`th.innerText`) |
| :---: | :--- | :--- |
| 1 | `STATUS_DESC` | Trạng thái |
| 2 | `UACODE` | Mã hàng hóa |
| 3 | `UACODE_EX` | Mã hàng hóa tại sở |
| 4 | `SECTORCODE_DESC` | Nhóm hàng hóa |
| 5 | `EXCHANGE_DESC` | Loại công cụ |
| 6 | `VN_FULLNAME` | Tên hàng hóa tiếng Việt |
| 7 | `TRADINGEXCHANGE` | Sở giao dịch |
| 8 | `NVALUE` | Độ lớn hợp đồng |
| 9 | `PHYSICAL_UNIT_DESC` | Đơn vị đo lường |
| 10 | `TRADEUNIT_DESC` | Đơn vị yết giá |
| 11 | `PRICETICKVALUE` | Tick giá thay đổi |
| 12 | `TRADELOT` | Đơn vị giao dịch(lô/lot) |
| 13 | `MINQTTY` | Khối lượng tối thiểu |
| 14 | `MAXQTTY` | Khối lượng tối đa 1 lệnh |
| 15 | `CURRENCYCODE` | Tiền tệ |
| 16 | `STD_RULE` | Ngày thanh toán |
| 17 | `VRIMAMT` | Mức ký quỹ ban đầu nguyên tệ |
| 18 | `VRIMAMT_VND` | Mức ký quỹ ban đầu VND |
| 19 | `CIMRATE` | Hệ số ký quỹ cho TKGD cá nhân |
| 20 | `BIMRATE` | Hệ số ký quỹ cho TKGD tổ chức |
| 21 | `CPIMRATE` | Hệ số ký quỹ cho TVKD |
| 22 | `FEAMT_ACC` | Phí giao dịch TKGD |
| 23 | `FEAMT_CUS` | Phí giao dịch TVKD |
| 24 | `DELIVERYFEE` | Phí giao nhận |
| 25 | `SETTLEMENTCASHFEE` | Phí thanh toán tiền |
| 26 | `SETTLEMENTFEE` | Phí dịch vụ thanh toán (%) |
| 27 | `FND_DAYS` | Số ngày phải thực hiện tất toán trước FND |
| 28 | `SUBFEE` | Phí thực hiện thay nghĩa vụ |
| 29 | `CALTYPE_DESC` | Cách tính phí khớp lệnh |
| 30 | `LTD_DAYS` | Số ngày phải thực hiện tất toán trước LTD |
| 31 | `NOTI_DAYS` | Số ngày gửi thông báo |
| 32 | `NOTI_TIME` | Thời gian hiển thị trong thông báo |
| 33 | `PRELTD_DAYSLIMIT` | Số ngày giới hạn trước LTD |
| 34 | `PRELTD_LIMIT` | Hạn mức giới hạn trước LTD |
| 35 | `LTD_DAYSLIMIT` | Số ngày giới hạn LTD limit |
| 36 | `APPRV_STS` | Trạng thái duyệt |

---

