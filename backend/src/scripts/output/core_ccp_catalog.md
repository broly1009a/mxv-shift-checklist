# BẢN ĐỒ TỪ ĐIỂN DỮ LIỆU & ROUTE MÀN HÌNH CORECCP (VNCLEAR)

> Ngày trích xuất: 11:49:00 17/9/2026 | Tổng số màn hình đã quét thành công: **60**

## 1. Bảng Tổng Hợp 100% Tuyến Đường & Nút Kết Xuất

| STT | Menu Cha | Nhóm Con | Menu Con | URL Route (Path) | Có Nút Kết Xuất? | Số Tab Con | Số Cột Bảng |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| 1 | **Quản lý FCM** | - | [Danh sách FCM](#danh-s-ch-fcm) | `/FCMMNG/FCM_INFORMATION` | CÓ (Sẵn sàng) | 3 | 6 |
| 2 | **Quản lý FCM** | - | [Quản lý cấu hình báo cáo offset](#qu-n-l--c-u-h-nh-b-o-c-o-offset) | `/FCMMNG/FCM_INFORMATION` | CÓ (Sẵn sàng) | 3 | 6 |
| 3 | **Quản lý FCM** | - | [Quản lý file báo cáo offset](#qu-n-l--file-b-o-c-o-offset) | `/FCMMNG/FCM_INFORMATION` | CÓ (Sẵn sàng) | 3 | 6 |
| 4 | **Người dùng và phân quyền** | - | [Người sử dụng](#ng--i-s--d-ng) | `/USERMNG/TLPROFILES` | CÓ (Sẵn sàng) | 3 | 12 |
| 5 | **Tham số hệ thống** | - | [Tỷ giá nguyên tệ](#t--gi--nguy-n-t-) | `/SYSCONFIGMNG/CURRENCYEXCHANGERATE` | CÓ (Sẵn sàng) | 3 | 10 |
| 6 | **Tham số hệ thống** | - | [Tham số hệ thống](#tham-s--h--th-ng) | `/SYSCONFIGMNG/CURRENCYEXCHANGERATE` | CÓ (Sẵn sàng) | 3 | 10 |
| 7 | **Tham số hệ thống** | - | [Cấu hình Noti/SMS/Email](#c-u-h-nh-noti-sms-email) | `/SYSCONFIGMNG/CURRENCYEXCHANGERATE` | CÓ (Sẵn sàng) | 3 | 10 |
| 8 | **Loại hình giao dịch** | - | [Quản lý loại hình giao dịch](#qu-n-l--lo-i-h-nh-giao-d-ch) | `/SYSCONFIGMNG/CURRENCYEXCHANGERATE` | CÓ (Sẵn sàng) | 3 | 10 |
| 9 | **Loại hình giao dịch** | - | [Rổ hệ số ký quỹ](#r--h--s--k--qu-) | `/TRANSPARAMMNG/IMBASKETS` | CÓ (Sẵn sàng) | 3 | 12 |
| 10 | **Loại hình giao dịch** | - | [Rổ hạn mức](#r--h-n-m-c) | `/TRANSPARAMMNG/IMBASKETS` | CÓ (Sẵn sàng) | 3 | 12 |
| 11 | **Loại hình giao dịch** | - | [Biểu phí giao dịch](#bi-u-ph--giao-d-ch) | `/TRANSPARAMMNG/IMBASKETS` | CÓ (Sẵn sàng) | 3 | 12 |
| 12 | **Quản lý sản phẩm** | - | [Quản lý giá thanh toán](#qu-n-l--gi--thanh-to-n) | `/PRODUCT/SETTLEMENT` | CÓ (Sẵn sàng) | 3 | 17 |
| 13 | **Quản lý sản phẩm** | - | [Quản lý lịch sử giá thanh toán](#qu-n-l--l-ch-s--gi--thanh-to-n) | `/PRODUCT/SETTLEMENT` | CÓ (Sẵn sàng) | 3 | 17 |
| 14 | **Quản lý thành viên** | - | [Gửi email cho thành viên](#g-i-email-cho-th-nh-vi-n) | `/MEMBERSMNG/MEMBERSEND` | CÓ (Sẵn sàng) | 3 | 10 |
| 15 | **Quản lý tài khoản** | - | [Danh sách tài khoản giao dịch](#danh-s-ch-t-i-kho-n-giao-d-ch) | `/ACCOUNTMNG/ACCOUNTS_INFO` | CÓ (Sẵn sàng) | 3 | 16 |
| 16 | **Quản lý tài khoản** | - | [Yêu cầu mở tiểu khoản](#y-u-c-u-m--ti-u-kho-n) | `/ACCOUNTMNG/ACCOUNTS_INFO` | CÓ (Sẵn sàng) | 3 | 16 |
| 17 | **Quản lý tài khoản** | - | [Lịch sử phê duyệt yêu cầu mở tiểu khoản](#l-ch-s--ph--duy-t-y-u-c-u-m--ti-u-kho-n) | `/ACCOUNTMNG/ACCOUNTS_INFO` | CÓ (Sẵn sàng) | 3 | 16 |
| 18 | **Quản lý tài khoản** | - | [Quản lý khách hàng (đầy đủ)](#qu-n-l--kh-ch-h-ng----y----) | `/ACCOUNTMNG/ACCOUNTS_INFO` | CÓ (Sẵn sàng) | 3 | 16 |
| 19 | **Nộp rút tiền** | - | [Yêu cầu rút tiền](#y-u-c-u-r-t-ti-n) | `/CASHTRANFER/CASHTRANFER_WITHDRAW` | CÓ (Sẵn sàng) | 3 | 18 |
| 20 | **Nộp rút tiền** | - | [Lịch sử Nộp/ Rút tiền](#l-ch-s--n-p--r-t-ti-n) | `/CASHTRANFER/CASHTRANFER_WITHDRAW` | CÓ (Sẵn sàng) | 3 | 18 |
| 21 | **Nộp rút tiền** | - | [Gửi yêu cầu rút tiền sang ngân hàng](#g-i-y-u-c-u-r-t-ti-n-sang-ng-n-h-ng) | `/CASHTRANFER/CASHTRANFER_WITHDRAW` | CÓ (Sẵn sàng) | 3 | 18 |
| 22 | **Nộp rút tiền** | - | [Tài khoản ngân hàng](#t-i-kho-n-ng-n-h-ng) | `/CASHTRANFER/CASHTRANFER_WITHDRAW` | CÓ (Sẵn sàng) | 3 | 18 |
| 23 | **Nộp rút tiền** | - | [Tài khoản VA](#t-i-kho-n-va) | `/CASHTRANFER/CASHTRANFER_WITHDRAW` | CÓ (Sẵn sàng) | 3 | 18 |
| 24 | **Nộp rút tiền** | - | [Theo dõi yêu cầu mở VA với MSB](#theo-d-i-y-u-c-u-m--va-v-i-msb) | `/CASHTRANFER/CASHTRANFER_WITHDRAW` | CÓ (Sẵn sàng) | 3 | 18 |
| 25 | **Nộp rút tiền** | - | [Danh sách ngân hàng](#danh-s-ch-ng-n-h-ng) | `/CASHTRANFER/CASHTRANFER_WITHDRAW` | CÓ (Sẵn sàng) | 3 | 18 |
| 26 | **Nộp rút tiền** | - | [Chênh lệch phí TVKD](#ch-nh-l-ch-ph--tvkd) | `/CASHTRANFER/CASHTRANFER_WITHDRAW` | CÓ (Sẵn sàng) | 3 | 18 |
| 27 | **Nộp rút tiền** | - | [Đối soát nộp rút tiền MSB](#--i-so-t-n-p-r-t-ti-n-msb) | `/CASHTRANFER/CASHTRANFER_WITHDRAW` | CÓ (Sẵn sàng) | 3 | 18 |
| 28 | **Lệnh và vị thế** | *Tra cứu tổng hợp* | [Danh sách lệnh](#danh-s-ch-l-nh) | `/ORDERS/ORDERBOOK` | CÓ (Sẵn sàng) | 7 | 29 |
| 29 | **Lệnh và vị thế** | *Tra cứu tổng hợp* | [Danh sách giao dịch](#danh-s-ch-giao-d-ch) | `/ORDERS/ORDERMATCH_DETAIL` | CÓ (Sẵn sàng) | 5 | 26 |
| 30 | **Lệnh và vị thế** | *Tra cứu tổng hợp* | [Lịch sử lệnh](#l-ch-s--l-nh) | `/ORDERS/ORDERMATCH_DETAIL` | CÓ (Sẵn sàng) | 5 | 26 |
| 31 | **Lệnh và vị thế** | *Tra cứu tổng hợp* | [Lịch sử giao dịch](#l-ch-s--giao-d-ch) | `/ORDERS/ORDERMATCH_ALL` | CÓ (Sẵn sàng) | 5 | 25 |
| 32 | **Lệnh và vị thế** | *Tra cứu tổng hợp* | [Danh sách lệnh MM](#danh-s-ch-l-nh-mm) | `/ORDERS/ORDERBOOK_MM` | CÓ (Sẵn sàng) | 7 | 27 |
| 33 | **Lệnh và vị thế** | *Tra cứu tổng hợp* | [Lịch sử lệnh MM](#l-ch-s--l-nh-mm) | `/ORDERS/ORDERBOOK_ALL_MM` | CÓ (Sẵn sàng) | 3 | 27 |
| 34 | **Lệnh và vị thế** | *Tra cứu tổng hợp* | [Danh sách giao dịch MM](#danh-s-ch-giao-d-ch-mm) | `/ORDERS/ORDERBOOK_ALL_MM` | CÓ (Sẵn sàng) | 3 | 27 |
| 35 | **Lệnh và vị thế** | *Tra cứu tổng hợp* | [Lịch sử giao dịch MM](#l-ch-s--giao-d-ch-mm) | `/ORDERS/ORDERBOOK_ALL_MM` | CÓ (Sẵn sàng) | 3 | 27 |
| 36 | **Lệnh và vị thế** | *Tra cứu tổng hợp* | [Trạng thái mở](#tr-ng-th-i-m-) | `/ORDERS/ORDERBOOK_ALL_MM` | CÓ (Sẵn sàng) | 3 | 27 |
| 37 | **Lệnh và vị thế** | *Tra cứu tổng hợp* | [Trạng thái tất toán](#tr-ng-th-i-t-t-to-n) | `/ORDERS/ORDERBOOK_ALL_MM` | CÓ (Sẵn sàng) | 3 | 27 |
| 38 | **Giao nhận** | - | [Tra cứu hạn mức giao nhận](#tra-c-u-h-n-m-c-giao-nh-n) | `/ORDERS/ORDERBOOK_ALL_MM` | CÓ (Sẵn sàng) | 3 | 14 |
| 39 | **Giao nhận** | - | [Yêu cầu đăng ký giao nhận](#y-u-c-u---ng-k--giao-nh-n) | `/DELIVERY/PHYSICAL_MARKET_ALL` | CÓ (Sẵn sàng) | 3 | 14 |
| 40 | **Giao nhận** | - | [Yêu cầu đăng ký lưu ký](#y-u-c-u---ng-k--l-u-k-) | `/DELIVERY/PHYSICAL_MARKET_ALL` | CÓ (Sẵn sàng) | 3 | 14 |
| 41 | **Giao nhận** | - | [Trạng thái giao nhận vật chất](#tr-ng-th-i-giao-nh-n-v-t-ch-t) | `/DELIVERY/PHYSICAL_MARKET_ALL` | CÓ (Sẵn sàng) | 3 | 14 |
| 42 | **Giao nhận** | - | [Tra cứu đối chiếu MSB](#tra-c-u---i-chi-u-msb) | `/DELIVERY/PHYSICAL_MARKET_ALL` | CÓ (Sẵn sàng) | 3 | 14 |
| 43 | **Giao nhận** | - | [Chỉ định yêu cầu giao nhận vật chất](#ch----nh-y-u-c-u-giao-nh-n-v-t-ch-t) | `/DELIVERY/PHYSICAL_MARKET_ALL` | CÓ (Sẵn sàng) | 3 | 14 |
| 44 | **Giao nhận** | - | [Quản lý tiền giao nhận](#qu-n-l--ti-n-giao-nh-n) | `/DELIVERY/PHYSICAL_MARKET_ALL` | CÓ (Sẵn sàng) | 3 | 14 |
| 45 | **Giao nhận** | - | [Yêu cầu giao hàng chỉ định bị từ chối](#y-u-c-u-giao-h-ng-ch----nh-b--t--ch-i) | `/DELIVERY/PHYSICAL_MARKET_ALL` | CÓ (Sẵn sàng) | 3 | 14 |
| 46 | **Quản lý rủi ro** | - | [Quản lý trạng thái TKGD](#qu-n-l--tr-ng-th-i-tkgd) | `/RISKMNG/ACCTMARGIN_ALL` | CÓ (Sẵn sàng) | 5 | 49 |
| 47 | **Quản lý rủi ro** | - | [Danh sách Tài khoản vi phạm ký quỹ](#danh-s-ch-t-i-kho-n-vi-ph-m-k--qu-) | `/RISKMNG/ACCTMARGIN_ALL` | CÓ (Sẵn sàng) | 5 | 49 |
| 48 | **Quản lý rủi ro** | - | [Tra cứu lịch sử Force Sell](#tra-c-u-l-ch-s--force-sell) | `/RISKMNG/FORCESELL` | CÓ (Sẵn sàng) | 3 | 16 |
| 49 | **Quản lý rủi ro** | - | [Thiết lập tài khoản loại trừ xử lý tự động](#thi-t-l-p-t-i-kho-n-lo-i-tr--x--l--t----ng) | `/RISKMNG/FORCESELL_HIST` | CÓ (Sẵn sàng) | 3 | 11 |
| 50 | **Báo cáo** | - | [Báo cáo](#b-o-c-o) | `/RISKMNG/FORCESELL_HIST` | CÓ (Sẵn sàng) | 3 | 11 |
| 51 | **Monitor OMS** | - | [Monitor OMS ACM](#monitor-oms-acm) | `/RISKMNG/FORCESELL_HIST` | CÓ (Sẵn sàng) | 3 | 11 |
| 52 | **Vận hành** | - | [EOD hệ thống](#eod-h--th-ng) | `/MONITOR_OMS/MONITOR_OMS_ACM` | CÓ (Sẵn sàng) | 12 | 20 |
| 53 | **Vận hành** | - | [EOD giao nhận](#eod-giao-nh-n) | `/EOD/EODPROCESS` | Không | 6 | 0 |
| 54 | **Vận hành** | - | [File Monitor (CSV)](#file-monitor--csv-) | `/EOD/MONITORCSV` | Không | 3 | 14 |
| 55 | **Vận hành** | - | [Truy vấn thông tin từ core Exchange](#truy-v-n-th-ng-tin-t--core-exchange) | `/EOD/MONITORCSV` | CÓ (Sẵn sàng) | 3 | 14 |
| 56 | **Vận hành** | - | [Đối chiếu lệnh với core Exchange](#--i-chi-u-l-nh-v-i-core-exchange) | `/EOD/COMPARECSV` | Không | 3 | 6 |
| 57 | **Vận hành** | - | [Lịch sử đối chiếu lệnh với core Exchange](#l-ch-s----i-chi-u-l-nh-v-i-core-exchange) | `/EOD/COMPARECSV` | Không | 3 | 0 |
| 58 | **Vận hành** | - | [Kết quả EOD](#k-t-qu--eod) | `/EOD/ACCTMARGIN_HIST` | CÓ (Sẵn sàng) | 3 | 27 |
| 59 | **Vận hành** | - | [Đối chiếu lệnh liên thông](#--i-chi-u-l-nh-li-n-th-ng) | `/EOD/ACCTMARGIN_HIST` | CÓ (Sẵn sàng) | 3 | 27 |
| 60 | **Vận hành** | - | [Lịch sử đối chiếu lệnh liên thông](#l-ch-s----i-chi-u-l-nh-li-n-th-ng) | `/EOD/ACCTMARGIN_HIST` | CÓ (Sẵn sàng) | 3 | 27 |

---

## 2. Chi Tiết Từng Màn Hình Nghiệp Vụ

### 1. Danh sách FCM

- **Cây Menu**: `Quản lý FCM > Danh sách FCM`
- **URL Route**: `/FCMMNG/FCM_INFORMATION`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã FCM
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (6 cột)**:

```text
Thao tác | Mã FCM | Tên FCM | Tài khoản Omnibus | Tài khoản Omnibus dùng cho báo cáo offset | Trạng thái
```

- **Dữ liệu mẫu dòng đầu**:
```text
FCM001 | FCM001 | 00017890001 | 00017890002 | Hoạt động
```

---

### 2. Quản lý cấu hình báo cáo offset

- **Cây Menu**: `Quản lý FCM > Quản lý cấu hình báo cáo offset`
- **URL Route**: `/FCMMNG/FCM_INFORMATION`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã FCM
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (6 cột)**:

```text
Thao tác | Mã FCM | Tên FCM | Tài khoản Omnibus | Tài khoản Omnibus dùng cho báo cáo offset | Trạng thái
```

- **Dữ liệu mẫu dòng đầu**:
```text
FCM001 | FCM001 | 00017890001 | 00017890002 | Hoạt động
```

---

### 3. Quản lý file báo cáo offset

- **Cây Menu**: `Quản lý FCM > Quản lý file báo cáo offset`
- **URL Route**: `/FCMMNG/FCM_INFORMATION`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã FCM
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (6 cột)**:

```text
Thao tác | Mã FCM | Tên FCM | Tài khoản Omnibus | Tài khoản Omnibus dùng cho báo cáo offset | Trạng thái
```

- **Dữ liệu mẫu dòng đầu**:
```text
FCM001 | FCM001 | 00017890001 | 00017890002 | Hoạt động
```

---

### 4. Người sử dụng

- **Cây Menu**: `Người dùng và phân quyền > Người sử dụng`
- **URL Route**: `/USERMNG/TLPROFILES`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Họ và tên, Trạng thái
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (12 cột)**:

```text
Thao tác | Phân quyền | Tên đăng nhập | Họ và tên | Số CMT | Số điện thoại | Email | Phòng ban | Chức danh | Trạng thái | Ghi chú | Mật khẩu
```

- **Dữ liệu mẫu dòng đầu**:
```text
Phân quyềnResetpass | tiennguyen | Nguyễn Khắc Tiến | 0123789456 | 0961616161 | khac.tiennguyen@mxv.vn
```

---

### 5. Tỷ giá nguyên tệ

- **Cây Menu**: `Tham số hệ thống > Tỷ giá nguyên tệ`
- **URL Route**: `/SYSCONFIGMNG/CURRENCYEXCHANGERATE`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Nguyên tệ, Ngày tạo
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (10 cột)**:

```text
Thao tác | Nguyên tệ | Tỷ giá quy đổi | Tỷ giá Mua | Tỷ giá Bán | Ngày tạo | Trạng thái duyệt | Người tạo | Người duyệt | Ngày duyệt
```

- **Dữ liệu mẫu dòng đầu**:
```text
VND | 1 | 1 | 1 | 06/03/2026 09:54:00 | Hoạt động
```

---

### 6. Tham số hệ thống

- **Cây Menu**: `Tham số hệ thống > Tham số hệ thống`
- **URL Route**: `/SYSCONFIGMNG/CURRENCYEXCHANGERATE`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Nguyên tệ, Ngày tạo
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (10 cột)**:

```text
Thao tác | Nguyên tệ | Tỷ giá quy đổi | Tỷ giá Mua | Tỷ giá Bán | Ngày tạo | Trạng thái duyệt | Người tạo | Người duyệt | Ngày duyệt
```

- **Dữ liệu mẫu dòng đầu**:
```text
VND | 1 | 1 | 1 | 06/03/2026 09:54:00 | Hoạt động
```

---

### 7. Cấu hình Noti/SMS/Email

- **Cây Menu**: `Tham số hệ thống > Cấu hình Noti/SMS/Email`
- **URL Route**: `/SYSCONFIGMNG/CURRENCYEXCHANGERATE`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Nguyên tệ, Ngày tạo
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (10 cột)**:

```text
Thao tác | Nguyên tệ | Tỷ giá quy đổi | Tỷ giá Mua | Tỷ giá Bán | Ngày tạo | Trạng thái duyệt | Người tạo | Người duyệt | Ngày duyệt
```

- **Dữ liệu mẫu dòng đầu**:
```text
VND | 1 | 1 | 1 | 06/03/2026 09:54:00 | Hoạt động
```

---

### 8. Quản lý loại hình giao dịch

- **Cây Menu**: `Loại hình giao dịch > Quản lý loại hình giao dịch`
- **URL Route**: `/SYSCONFIGMNG/CURRENCYEXCHANGERATE`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Nguyên tệ, Ngày tạo
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (10 cột)**:

```text
Thao tác | Nguyên tệ | Tỷ giá quy đổi | Tỷ giá Mua | Tỷ giá Bán | Ngày tạo | Trạng thái duyệt | Người tạo | Người duyệt | Ngày duyệt
```

- **Dữ liệu mẫu dòng đầu**:
```text
VND | 1 | 1 | 1 | 06/03/2026 09:54:00 | Hoạt động
```

---

### 9. Rổ hệ số ký quỹ

- **Cây Menu**: `Loại hình giao dịch > Rổ hệ số ký quỹ`
- **URL Route**: `/TRANSPARAMMNG/IMBASKETS`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Trạng thái, Mã rổ, Tên rổ
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (12 cột)**:

```text
Thao tác | Trạng thái | Mã rổ | Loại tiểu khoản giao dịch | Tên rổ | Ngày hiệu lực | Ngày hết hạn | Ngày tạo | Ngày duyệt | Người tạo | Người duyệt | Trạng thái duyệt
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hoạt động | 0001 | MXV | Rổ hệ số KQ VNC1 | 16/01/2026 | 31/12/2099 | 16/01/2026 11:49:00
```

---

### 10. Rổ hạn mức

- **Cây Menu**: `Loại hình giao dịch > Rổ hạn mức`
- **URL Route**: `/TRANSPARAMMNG/IMBASKETS`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Trạng thái, Mã rổ, Tên rổ
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (12 cột)**:

```text
Thao tác | Trạng thái | Mã rổ | Loại tiểu khoản giao dịch | Tên rổ | Ngày hiệu lực | Ngày hết hạn | Ngày tạo | Ngày duyệt | Người tạo | Người duyệt | Trạng thái duyệt
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hoạt động | 0001 | MXV | Rổ hệ số KQ VNC1 | 16/01/2026 | 31/12/2099 | 16/01/2026 11:49:00
```

---

### 11. Biểu phí giao dịch

- **Cây Menu**: `Loại hình giao dịch > Biểu phí giao dịch`
- **URL Route**: `/TRANSPARAMMNG/IMBASKETS`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Trạng thái, Mã rổ, Tên rổ
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (12 cột)**:

```text
Thao tác | Trạng thái | Mã rổ | Loại tiểu khoản giao dịch | Tên rổ | Ngày hiệu lực | Ngày hết hạn | Ngày tạo | Ngày duyệt | Người tạo | Người duyệt | Trạng thái duyệt
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hoạt động | 0001 | MXV | Rổ hệ số KQ VNC1 | 16/01/2026 | 31/12/2099 | 16/01/2026 11:49:00
```

---

### 12. Quản lý giá thanh toán

- **Cây Menu**: `Quản lý sản phẩm > Quản lý giá thanh toán`
- **URL Route**: `/PRODUCT/SETTLEMENT`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã hàng hóa, Mã hợp đồng, Nhóm hàng hóa, Tên hàng hóa tiếng Việt
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (17 cột)**:

```text
Thao tác | Mã hàng hóa | Mã hợp đồng | Nhóm hàng hóa | Loại công cụ | Tên hàng hóa tiếng Việt | Tên hàng hóa tiếng Anh | Tên hợp đồng | Tháng đáo hạn | Năm đáo hạn | Giá thanh toán | Giá trần | Giá sàn | Giá mở cửa | Ngày phiên giao dịch | Ngừng giao dịch | Tiền tệ
```

- **Dữ liệu mẫu dòng đầu**:
```text
Điều chỉnh | VNC | VNC1F28 | Kim loại | Futures | VNC | VNC | Bạc VNC08 02/2028
```

---

### 13. Quản lý lịch sử giá thanh toán

- **Cây Menu**: `Quản lý sản phẩm > Quản lý lịch sử giá thanh toán`
- **URL Route**: `/PRODUCT/SETTLEMENT`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã hàng hóa, Mã hợp đồng, Nhóm hàng hóa, Tên hàng hóa tiếng Việt
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (17 cột)**:

```text
Thao tác | Mã hàng hóa | Mã hợp đồng | Nhóm hàng hóa | Loại công cụ | Tên hàng hóa tiếng Việt | Tên hàng hóa tiếng Anh | Tên hợp đồng | Tháng đáo hạn | Năm đáo hạn | Giá thanh toán | Giá trần | Giá sàn | Giá mở cửa | Ngày phiên giao dịch | Ngừng giao dịch | Tiền tệ
```

- **Dữ liệu mẫu dòng đầu**:
```text
Điều chỉnh | VNC | VNC1F28 | Kim loại | Futures | VNC | VNC | Bạc VNC08 02/2028
```

---

### 14. Gửi email cho thành viên

- **Cây Menu**: `Quản lý thành viên > Gửi email cho thành viên`
- **URL Route**: `/MEMBERSMNG/MEMBERSEND`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã thành viên, Ngày/Tháng thực hiện, Mã báo cáo, Trạng thái
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (10 cột)**:

```text
Thao tác | Mã thành viên | Ngày/Tháng thực hiện | Mã báo cáo | Trạng thái | Người tạo | Ngày giờ tạo file | Ngày giờ gửi mail | Thao tác | file báo cáo
```

- **Dữ liệu mẫu dòng đầu**:
```text
Xem báo cáo | 001 | 16/09/2026 | BC08A | Chờ gửi | SYSTEM | 17/09/2026 05:32:20
```

---

### 15. Danh sách tài khoản giao dịch

- **Cây Menu**: `Quản lý tài khoản > Danh sách tài khoản giao dịch`
- **URL Route**: `/ACCOUNTMNG/ACCOUNTS_INFO`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã khách hàng
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (16 cột)**:

```text
Mã khách hàng | Số TKGD | Tên khách hàng | Mã thành viên | Tên thành viên | Loại tiểu khoản | Trạng thái tiểu khoản | Ngày mở | Ngày đóng | Loại hình | Rổ ký quỹ | Rổ hạn mức | Biểu phí | Tỷ lệ an toàn | Tỷ lệ cảnh báo | Tỷ lệ xử lý
```

- **Dữ liệu mẫu dòng đầu**:
```text
012C0000204 | 012C0000204-M | Lê Thị Trang | 012 | TVKD-012 | MXV | Hoạt động | 01/01/2026
```

---

### 16. Yêu cầu mở tiểu khoản

- **Cây Menu**: `Quản lý tài khoản > Yêu cầu mở tiểu khoản`
- **URL Route**: `/ACCOUNTMNG/ACCOUNTS_INFO`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã khách hàng
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (16 cột)**:

```text
Mã khách hàng | Số TKGD | Tên khách hàng | Mã thành viên | Tên thành viên | Loại tiểu khoản | Trạng thái tiểu khoản | Ngày mở | Ngày đóng | Loại hình | Rổ ký quỹ | Rổ hạn mức | Biểu phí | Tỷ lệ an toàn | Tỷ lệ cảnh báo | Tỷ lệ xử lý
```

- **Dữ liệu mẫu dòng đầu**:
```text
012C0000204 | 012C0000204-M | Lê Thị Trang | 012 | TVKD-012 | MXV | Hoạt động | 01/01/2026
```

---

### 17. Lịch sử phê duyệt yêu cầu mở tiểu khoản

- **Cây Menu**: `Quản lý tài khoản > Lịch sử phê duyệt yêu cầu mở tiểu khoản`
- **URL Route**: `/ACCOUNTMNG/ACCOUNTS_INFO`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã khách hàng
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (16 cột)**:

```text
Mã khách hàng | Số TKGD | Tên khách hàng | Mã thành viên | Tên thành viên | Loại tiểu khoản | Trạng thái tiểu khoản | Ngày mở | Ngày đóng | Loại hình | Rổ ký quỹ | Rổ hạn mức | Biểu phí | Tỷ lệ an toàn | Tỷ lệ cảnh báo | Tỷ lệ xử lý
```

- **Dữ liệu mẫu dòng đầu**:
```text
012C0000204 | 012C0000204-M | Lê Thị Trang | 012 | TVKD-012 | MXV | Hoạt động | 01/01/2026
```

---

### 18. Quản lý khách hàng (đầy đủ)

- **Cây Menu**: `Quản lý tài khoản > Quản lý khách hàng (đầy đủ)`
- **URL Route**: `/ACCOUNTMNG/ACCOUNTS_INFO`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã khách hàng
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (16 cột)**:

```text
Mã khách hàng | Số TKGD | Tên khách hàng | Mã thành viên | Tên thành viên | Loại tiểu khoản | Trạng thái tiểu khoản | Ngày mở | Ngày đóng | Loại hình | Rổ ký quỹ | Rổ hạn mức | Biểu phí | Tỷ lệ an toàn | Tỷ lệ cảnh báo | Tỷ lệ xử lý
```

- **Dữ liệu mẫu dòng đầu**:
```text
012C0000204 | 012C0000204-M | Lê Thị Trang | 012 | TVKD-012 | MXV | Hoạt động | 01/01/2026
```

---

### 19. Yêu cầu rút tiền

- **Cây Menu**: `Nộp rút tiền > Yêu cầu rút tiền`
- **URL Route**: `/CASHTRANFER/CASHTRANFER_WITHDRAW`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày yêu cầu, (Đến) Ngày yêu cầu, Tên thành viên, Mã yêu cầu, Số tài khoản
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (18 cột)**:

```text
Ngày yêu cầu | Ngày tạo | Giờ tạo | Mã thành viên | Tên thành viên | Mã yêu cầu | Số tài khoản | Tiểu khoản giao dịch | Tên NĐT | Số tiền | Người tạo | Ngân hàng rút tiền | Trạng thái MXV | Trạng thái ngân hàng | Mô tả lỗi | Mô tả lỗi ngân hàng | Hình thức | Diễn giải
```

- **Dữ liệu mẫu dòng đầu**:
```text
17/09/2026 | 17/09/2026 | 10:28:34 | 782 | 782 MxPro UAT | 78220260917387 | 782C4555784
```

---

### 20. Lịch sử Nộp/ Rút tiền

- **Cây Menu**: `Nộp rút tiền > Lịch sử Nộp/ Rút tiền`
- **URL Route**: `/CASHTRANFER/CASHTRANFER_WITHDRAW`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày yêu cầu, (Đến) Ngày yêu cầu, Tên thành viên, Mã yêu cầu, Số tài khoản
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (18 cột)**:

```text
Ngày yêu cầu | Ngày tạo | Giờ tạo | Mã thành viên | Tên thành viên | Mã yêu cầu | Số tài khoản | Tiểu khoản giao dịch | Tên NĐT | Số tiền | Người tạo | Ngân hàng rút tiền | Trạng thái MXV | Trạng thái ngân hàng | Mô tả lỗi | Mô tả lỗi ngân hàng | Hình thức | Diễn giải
```

- **Dữ liệu mẫu dòng đầu**:
```text
17/09/2026 | 17/09/2026 | 10:28:34 | 782 | 782 MxPro UAT | 78220260917387 | 782C4555784
```

---

### 21. Gửi yêu cầu rút tiền sang ngân hàng

- **Cây Menu**: `Nộp rút tiền > Gửi yêu cầu rút tiền sang ngân hàng`
- **URL Route**: `/CASHTRANFER/CASHTRANFER_WITHDRAW`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày yêu cầu, (Đến) Ngày yêu cầu, Tên thành viên, Mã yêu cầu, Số tài khoản
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (18 cột)**:

```text
Ngày yêu cầu | Ngày tạo | Giờ tạo | Mã thành viên | Tên thành viên | Mã yêu cầu | Số tài khoản | Tiểu khoản giao dịch | Tên NĐT | Số tiền | Người tạo | Ngân hàng rút tiền | Trạng thái MXV | Trạng thái ngân hàng | Mô tả lỗi | Mô tả lỗi ngân hàng | Hình thức | Diễn giải
```

- **Dữ liệu mẫu dòng đầu**:
```text
17/09/2026 | 17/09/2026 | 10:28:34 | 782 | 782 MxPro UAT | 78220260917387 | 782C4555784
```

---

### 22. Tài khoản ngân hàng

- **Cây Menu**: `Nộp rút tiền > Tài khoản ngân hàng`
- **URL Route**: `/CASHTRANFER/CASHTRANFER_WITHDRAW`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày yêu cầu, (Đến) Ngày yêu cầu, Tên thành viên, Mã yêu cầu, Số tài khoản
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (18 cột)**:

```text
Ngày yêu cầu | Ngày tạo | Giờ tạo | Mã thành viên | Tên thành viên | Mã yêu cầu | Số tài khoản | Tiểu khoản giao dịch | Tên NĐT | Số tiền | Người tạo | Ngân hàng rút tiền | Trạng thái MXV | Trạng thái ngân hàng | Mô tả lỗi | Mô tả lỗi ngân hàng | Hình thức | Diễn giải
```

- **Dữ liệu mẫu dòng đầu**:
```text
17/09/2026 | 17/09/2026 | 10:28:34 | 782 | 782 MxPro UAT | 78220260917387 | 782C4555784
```

---

### 23. Tài khoản VA

- **Cây Menu**: `Nộp rút tiền > Tài khoản VA`
- **URL Route**: `/CASHTRANFER/CASHTRANFER_WITHDRAW`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày yêu cầu, (Đến) Ngày yêu cầu, Tên thành viên, Mã yêu cầu, Số tài khoản
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (18 cột)**:

```text
Ngày yêu cầu | Ngày tạo | Giờ tạo | Mã thành viên | Tên thành viên | Mã yêu cầu | Số tài khoản | Tiểu khoản giao dịch | Tên NĐT | Số tiền | Người tạo | Ngân hàng rút tiền | Trạng thái MXV | Trạng thái ngân hàng | Mô tả lỗi | Mô tả lỗi ngân hàng | Hình thức | Diễn giải
```

- **Dữ liệu mẫu dòng đầu**:
```text
17/09/2026 | 17/09/2026 | 10:28:34 | 782 | 782 MxPro UAT | 78220260917387 | 782C4555784
```

---

### 24. Theo dõi yêu cầu mở VA với MSB

- **Cây Menu**: `Nộp rút tiền > Theo dõi yêu cầu mở VA với MSB`
- **URL Route**: `/CASHTRANFER/CASHTRANFER_WITHDRAW`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày yêu cầu, (Đến) Ngày yêu cầu, Tên thành viên, Mã yêu cầu, Số tài khoản
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (18 cột)**:

```text
Ngày yêu cầu | Ngày tạo | Giờ tạo | Mã thành viên | Tên thành viên | Mã yêu cầu | Số tài khoản | Tiểu khoản giao dịch | Tên NĐT | Số tiền | Người tạo | Ngân hàng rút tiền | Trạng thái MXV | Trạng thái ngân hàng | Mô tả lỗi | Mô tả lỗi ngân hàng | Hình thức | Diễn giải
```

- **Dữ liệu mẫu dòng đầu**:
```text
17/09/2026 | 17/09/2026 | 10:28:34 | 782 | 782 MxPro UAT | 78220260917387 | 782C4555784
```

---

### 25. Danh sách ngân hàng

- **Cây Menu**: `Nộp rút tiền > Danh sách ngân hàng`
- **URL Route**: `/CASHTRANFER/CASHTRANFER_WITHDRAW`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày yêu cầu, (Đến) Ngày yêu cầu, Tên thành viên, Mã yêu cầu, Số tài khoản
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (18 cột)**:

```text
Ngày yêu cầu | Ngày tạo | Giờ tạo | Mã thành viên | Tên thành viên | Mã yêu cầu | Số tài khoản | Tiểu khoản giao dịch | Tên NĐT | Số tiền | Người tạo | Ngân hàng rút tiền | Trạng thái MXV | Trạng thái ngân hàng | Mô tả lỗi | Mô tả lỗi ngân hàng | Hình thức | Diễn giải
```

- **Dữ liệu mẫu dòng đầu**:
```text
17/09/2026 | 17/09/2026 | 10:28:34 | 782 | 782 MxPro UAT | 78220260917387 | 782C4555784
```

---

### 26. Chênh lệch phí TVKD

- **Cây Menu**: `Nộp rút tiền > Chênh lệch phí TVKD`
- **URL Route**: `/CASHTRANFER/CASHTRANFER_WITHDRAW`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày yêu cầu, (Đến) Ngày yêu cầu, Tên thành viên, Mã yêu cầu, Số tài khoản
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (18 cột)**:

```text
Ngày yêu cầu | Ngày tạo | Giờ tạo | Mã thành viên | Tên thành viên | Mã yêu cầu | Số tài khoản | Tiểu khoản giao dịch | Tên NĐT | Số tiền | Người tạo | Ngân hàng rút tiền | Trạng thái MXV | Trạng thái ngân hàng | Mô tả lỗi | Mô tả lỗi ngân hàng | Hình thức | Diễn giải
```

- **Dữ liệu mẫu dòng đầu**:
```text
17/09/2026 | 17/09/2026 | 10:28:34 | 782 | 782 MxPro UAT | 78220260917387 | 782C4555784
```

---

### 27. Đối soát nộp rút tiền MSB

- **Cây Menu**: `Nộp rút tiền > Đối soát nộp rút tiền MSB`
- **URL Route**: `/CASHTRANFER/CASHTRANFER_WITHDRAW`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày yêu cầu, (Đến) Ngày yêu cầu, Tên thành viên, Mã yêu cầu, Số tài khoản
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (18 cột)**:

```text
Ngày yêu cầu | Ngày tạo | Giờ tạo | Mã thành viên | Tên thành viên | Mã yêu cầu | Số tài khoản | Tiểu khoản giao dịch | Tên NĐT | Số tiền | Người tạo | Ngân hàng rút tiền | Trạng thái MXV | Trạng thái ngân hàng | Mô tả lỗi | Mô tả lỗi ngân hàng | Hình thức | Diễn giải
```

- **Dữ liệu mẫu dòng đầu**:
```text
17/09/2026 | 17/09/2026 | 10:28:34 | 782 | 782 MxPro UAT | 78220260917387 | 782C4555784
```

---

### 28. Danh sách lệnh

- **Cây Menu**: `Lệnh và vị thế > Tra cứu tổng hợp > Danh sách lệnh`
- **URL Route**: `/ORDERS/ORDERBOOK`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: **[Tất cả]**, Lệnh đã khớp, Lệnh chờ khớp, Lệnh đã hủy, Hệ thống0, Hàng hóa0, Tài khoản0
  + *Chi tiết cột từng Tab*:
    * **Tab [Tất cả]** (29 cột): `Chi tiết | Ngày hệ thống | Ngày phiên | Mã lệnh MXV gửi lên Sở | Mã lệnh TVKD gửi lên MXV | Mã lệnh | Mã KH | Mã TKGD | Mã HĐ | Trạng thái | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Sàn giao dịch | Ngày hiệu lực | Tên TKGD | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian thực hiện`
    * **Tab [Lệnh đã khớp]** (29 cột): `Chi tiết | Ngày hệ thống0 | Ngày phiên0 | Mã lệnh MXV gửi lên Sở0 | Mã lệnh TVKD gửi lên MXV0 | Mã lệnh0 | Mã KH0 | Mã TKGD0 | Mã HĐ0 | Trạng thái0 | Mua/Bán0 | Loại lệnh0 | KL đặt0 | KL khớp0 | Giá đặt0 | Giá dừng0 | Giá khớp trung bình0 | KL còn lại0 | KL hủy0 | Phí giao dịch0 | Thời gian đặt0 | Hiệu lực0 | Sàn giao dịch0 | Ngày hiệu lực0 | Tên TKGD0 | Mã thành viên0 | Tên thành viên0 | Người đặt lệnh0 | Thời gian thực hiện0`
    * **Tab [Lệnh chờ khớp]** (29 cột): `Chi tiết | Ngày hệ thống0 | Ngày phiên0 | Mã lệnh MXV gửi lên Sở0 | Mã lệnh TVKD gửi lên MXV0 | Mã lệnh0 | Mã KH0 | Mã TKGD0 | Mã HĐ0 | Trạng thái0 | Mua/Bán0 | Loại lệnh0 | KL đặt0 | KL khớp0 | Giá đặt0 | Giá dừng0 | Giá khớp trung bình0 | KL còn lại0 | KL hủy0 | Phí giao dịch0 | Thời gian đặt0 | Hiệu lực0 | Ngày hiệu lực0 | Sàn giao dịch0 | Tên TKGD0 | Mã thành viên0 | Tên thành viên0 | Người đặt lệnh0 | Thời gian thực hiện0`
    * **Tab [Lệnh đã hủy]** (29 cột): `Chi tiết | Ngày hệ thống0 | Ngày phiên0 | Mã lệnh MXV gửi lên Sở0 | Mã lệnh TVKD gửi lên MXV0 | Mã lệnh0 | Mã KH0 | Mã TKGD0 | Mã HĐ0 | Trạng thái0 | Mua/Bán0 | Loại lệnh0 | KL đặt0 | KL khớp0 | Giá đặt0 | Giá dừng0 | Giá khớp trung bình0 | KL còn lại0 | KL hủy0 | Phí giao dịch0 | Thời gian đặt0 | Hiệu lực0 | Ngày hiệu lực0 | Sàn giao dịch0 | Tên TKGD0 | Mã thành viên0 | Tên thành viên0 | Người đặt lệnh0 | Thời gian hủy lệnh0`
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Ngày hệ thống, (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh, Mã KH, Mã TKGD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (29 cột)**:

```text
Chi tiết | Ngày hệ thống | Ngày phiên | Mã lệnh MXV gửi lên Sở | Mã lệnh TVKD gửi lên MXV | Mã lệnh | Mã KH | Mã TKGD | Mã HĐ | Trạng thái | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Sàn giao dịch | Ngày hiệu lực | Tên TKGD | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian thực hiện
```

- **Dữ liệu mẫu dòng đầu**:
```text
Giải tỏa lệnh | 17/09/2026 | 17/09/2026 | 06202609170000045241 | 06202609170000045241 | 712C3341632 | 712C3341632-M
```

---

### 29. Danh sách giao dịch

- **Cây Menu**: `Lệnh và vị thế > Tra cứu tổng hợp > Danh sách giao dịch`
- **URL Route**: `/ORDERS/ORDERMATCH_DETAIL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: **[Danh sách giao dịch]**, Giao dịch bị hủy, Hệ thống0, Hàng hóa0, Tài khoản0
  + *Chi tiết cột từng Tab*:
    * **Tab [Danh sách giao dịch]** (26 cột): `Thao tác | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã giao dịch OMS | Mã giao dịch EX | Mã TKGD | Mã HĐ | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Ngày hiệu lực | Sàn giao dịch | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian khớp lệnh`
    * **Tab [Giao dịch bị hủy]** (26 cột): `Thao tác | Ngày hệ thống0 | Ngày phiên0 | Mã lệnh0 | Mã giao dịch OMS0 | Mã giao dịch EX0 | Mã TKGD0 | Mã HĐ0 | Mua/Bán0 | Loại lệnh0 | KL đặt0 | KL khớp0 | Giá đặt0 | Giá dừng0 | Giá khớp trung bình0 | KL còn lại0 | KL hủy0 | Phí giao dịch0 | Thời gian đặt0 | Hiệu lực0 | Ngày hiệu lực0 | Sàn giao dịch0 | Mã thành viên0 | Tên thành viên0 | Người đặt lệnh0 | Thời gian khớp lệnh0`
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Ngày hệ thống, (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh, Mã giao dịch OMS, Mã giao dịch EX
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (26 cột)**:

```text
Thao tác | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã giao dịch OMS | Mã giao dịch EX | Mã TKGD | Mã HĐ | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Ngày hiệu lực | Sàn giao dịch | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian khớp lệnh
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hủy kết quả giao dịch | 17/09/2026 | 17/09/2026 | 12202609170000000271 | TVKD659-12202609170000000271-567 | 20260917128616 | 659C2222333-A | PL1NYV26
```

---

### 30. Lịch sử lệnh

- **Cây Menu**: `Lệnh và vị thế > Tra cứu tổng hợp > Lịch sử lệnh`
- **URL Route**: `/ORDERS/ORDERMATCH_DETAIL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: **[Danh sách giao dịch]**, Giao dịch bị hủy, Hệ thống0, Hàng hóa0, Tài khoản0
  + *Chi tiết cột từng Tab*:
    * **Tab [Danh sách giao dịch]** (26 cột): `Thao tác | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã giao dịch OMS | Mã giao dịch EX | Mã TKGD | Mã HĐ | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Ngày hiệu lực | Sàn giao dịch | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian khớp lệnh`
    * **Tab [Giao dịch bị hủy]** (29 cột): `Chi tiết | Ngày hệ thống0 | Ngày phiên0 | Mã lệnh MXV gửi lên Sở0 | Mã lệnh TVKD gửi lên MXV0 | Mã lệnh0 | Mã KH0 | Mã TKGD0 | Mã HĐ0 | Trạng thái0 | Mua/Bán0 | Loại lệnh0 | KL đặt0 | KL khớp0 | Giá đặt0 | Giá dừng0 | Giá khớp trung bình0 | KL còn lại0 | KL hủy0 | Phí giao dịch0 | Thời gian đặt0 | Hiệu lực0 | Sàn giao dịch0 | Ngày hiệu lực0 | Tên TKGD0 | Mã thành viên0 | Tên thành viên0 | Người đặt lệnh0 | Thời gian thực hiện0`
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Ngày hệ thống, (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh, Mã giao dịch OMS, Mã giao dịch EX
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (26 cột)**:

```text
Thao tác | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã giao dịch OMS | Mã giao dịch EX | Mã TKGD | Mã HĐ | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Ngày hiệu lực | Sàn giao dịch | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian khớp lệnh
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hủy kết quả giao dịch | 17/09/2026 | 17/09/2026 | 12202609170000000271 | TVKD659-12202609170000000271-567 | 20260917128616 | 659C2222333-A | PL1NYV26
```

---

### 31. Lịch sử giao dịch

- **Cây Menu**: `Lệnh và vị thế > Tra cứu tổng hợp > Lịch sử giao dịch`
- **URL Route**: `/ORDERS/ORDERMATCH_ALL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: **[Tất cả]**, Giao dịch bị hủy, Hệ thống0, Hàng hóa0, Tài khoản0
  + *Chi tiết cột từng Tab*:
    * **Tab [Tất cả]** (25 cột): `Ngày hệ thống | Ngày phiên | Mã lệnh | Mã giao dịch OMS | Mã giao dịch EX | Mã TKGD | Mã HĐ | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Ngày hiệu lực | Sàn giao dịch | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian khớp lệnh`
    * **Tab [Giao dịch bị hủy]** (25 cột): `Ngày hệ thống0 | Ngày phiên0 | Mã lệnh0 | Mã giao dịch OMS0 | Mã giao dịch EX0 | Mã TKGD0 | Mã HĐ0 | Mua/Bán0 | Loại lệnh0 | KL đặt0 | KL khớp0 | Giá đặt0 | Giá dừng0 | Giá khớp trung bình0 | KL còn lại0 | KL hủy0 | Phí giao dịch0 | Thời gian đặt0 | Hiệu lực0 | Ngày hiệu lực0 | Sàn giao dịch0 | Mã thành viên0 | Tên thành viên0 | Người đặt lệnh0 | Thời gian khớp lệnh0`
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Ngày hệ thống, (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh, Mã giao dịch OMS, Mã giao dịch EX
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (25 cột)**:

```text
Ngày hệ thống | Ngày phiên | Mã lệnh | Mã giao dịch OMS | Mã giao dịch EX | Mã TKGD | Mã HĐ | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Ngày hiệu lực | Sàn giao dịch | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian khớp lệnh
```

- **Dữ liệu mẫu dòng đầu**:
```text
16/09/2026 | 16/09/2026 | 12202609160000001551 | TVKD659-12202609160000001551-7915 | 20260916179962 | 659C2222333-A | PL1NYF27 | Bán
```

---

### 32. Danh sách lệnh MM

- **Cây Menu**: `Lệnh và vị thế > Tra cứu tổng hợp > Danh sách lệnh MM`
- **URL Route**: `/ORDERS/ORDERBOOK_MM`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: **[Tất cả]**, Lệnh đã khớp, Lệnh chờ khớp, Lệnh đã hủy, Hệ thống0, Hàng hóa0, Tài khoản0
  + *Chi tiết cột từng Tab*:
    * **Tab [Tất cả]** (27 cột): `Chi tiết | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã KH | Mã TKGD | Mã HĐ | Trạng thái | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Sàn giao dịch | Ngày hiệu lực | Tên TKGD | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian thực hiện`
    * **Tab [Lệnh đã khớp]** (27 cột): `Chi tiết | Ngày hệ thống0 | Ngày phiên0 | Mã lệnh0 | Mã KH0 | Mã TKGD0 | Mã HĐ0 | Trạng thái0 | Mua/Bán0 | Loại lệnh0 | KL đặt0 | KL khớp0 | Giá đặt0 | Giá dừng0 | Giá khớp trung bình0 | KL còn lại0 | KL hủy0 | Phí giao dịch0 | Thời gian đặt0 | Hiệu lực0 | Sàn giao dịch0 | Ngày hiệu lực0 | Tên TKGD0 | Mã thành viên0 | Tên thành viên0 | Người đặt lệnh0 | Thời gian thực hiện0`
    * **Tab [Lệnh chờ khớp]** (27 cột): `Chi tiết | Ngày hệ thống0 | Ngày phiên0 | Mã lệnh0 | Mã KH0 | Mã TKGD0 | Mã HĐ0 | Trạng thái0 | Mua/Bán0 | Loại lệnh0 | KL đặt0 | KL khớp0 | Giá đặt0 | Giá dừng0 | Giá khớp trung bình0 | KL còn lại0 | KL hủy0 | Phí giao dịch0 | Thời gian đặt0 | Hiệu lực0 | Ngày hiệu lực0 | Sàn giao dịch0 | Tên TKGD0 | Mã thành viên0 | Tên thành viên0 | Người đặt lệnh0 | Thời gian thực hiện0`
    * **Tab [Lệnh đã hủy]** (27 cột): `Chi tiết | Ngày hệ thống0 | Ngày phiên0 | Mã lệnh0 | Mã KH0 | Mã TKGD0 | Mã HĐ0 | Trạng thái0 | Mua/Bán0 | Loại lệnh0 | KL đặt0 | KL khớp0 | Giá đặt0 | Giá dừng0 | Giá khớp trung bình0 | KL còn lại0 | KL hủy0 | Phí giao dịch0 | Thời gian đặt0 | Hiệu lực0 | Ngày hiệu lực0 | Sàn giao dịch0 | Tên TKGD0 | Mã thành viên0 | Tên thành viên0 | Người đặt lệnh0 | Thời gian hủy lệnh0`
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Ngày hệ thống, (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh, Mã KH, Mã TKGD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (27 cột)**:

```text
Chi tiết | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã KH | Mã TKGD | Mã HĐ | Trạng thái | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Sàn giao dịch | Ngày hiệu lực | Tên TKGD | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian thực hiện
```

- **Dữ liệu mẫu dòng đầu**:
```text
Giải tỏa lệnh | 17/09/2026 | 17/09/2026 | 06202609170000028754 | 682C6666669 | 682C6666669-M | DTV0627 | Khớp hết
```

---

### 33. Lịch sử lệnh MM

- **Cây Menu**: `Lệnh và vị thế > Tra cứu tổng hợp > Lịch sử lệnh MM`
- **URL Route**: `/ORDERS/ORDERBOOK_ALL_MM`
- **Nút Kết xuất**: Có (`Kết xuất`)
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Ngày hệ thống, (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh, Mã KH, Mã TKGD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (27 cột)**:

```text
Chi tiết | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã KH | Mã TKGD | Mã HĐ | Trạng thái | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Sàn giao dịch | Ngày hiệu lực | Tên TKGD | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian thực hiện
```

- **Dữ liệu mẫu dòng đầu**:
```text
16/09/2026 | 16/09/2026 | 06202609160000061155 | 682C6666663 | 682C6666663-M | CHV0627 | Khớp hết
```

---

### 34. Danh sách giao dịch MM

- **Cây Menu**: `Lệnh và vị thế > Tra cứu tổng hợp > Danh sách giao dịch MM`
- **URL Route**: `/ORDERS/ORDERBOOK_ALL_MM`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Ngày hệ thống, (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh, Mã KH, Mã TKGD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (27 cột)**:

```text
Chi tiết | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã KH | Mã TKGD | Mã HĐ | Trạng thái | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Sàn giao dịch | Ngày hiệu lực | Tên TKGD | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian thực hiện
```

- **Dữ liệu mẫu dòng đầu**:
```text
16/09/2026 | 16/09/2026 | 06202609160000061155 | 682C6666663 | 682C6666663-M | CHV0627 | Khớp hết
```

---

### 35. Lịch sử giao dịch MM

- **Cây Menu**: `Lệnh và vị thế > Tra cứu tổng hợp > Lịch sử giao dịch MM`
- **URL Route**: `/ORDERS/ORDERBOOK_ALL_MM`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Ngày hệ thống, (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh, Mã KH, Mã TKGD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (27 cột)**:

```text
Chi tiết | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã KH | Mã TKGD | Mã HĐ | Trạng thái | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Sàn giao dịch | Ngày hiệu lực | Tên TKGD | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian thực hiện
```

- **Dữ liệu mẫu dòng đầu**:
```text
16/09/2026 | 16/09/2026 | 06202609160000061155 | 682C6666663 | 682C6666663-M | CHV0627 | Khớp hết
```

---

### 36. Trạng thái mở

- **Cây Menu**: `Lệnh và vị thế > Tra cứu tổng hợp > Trạng thái mở`
- **URL Route**: `/ORDERS/ORDERBOOK_ALL_MM`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Ngày hệ thống, (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh, Mã KH, Mã TKGD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (27 cột)**:

```text
Chi tiết | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã KH | Mã TKGD | Mã HĐ | Trạng thái | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Sàn giao dịch | Ngày hiệu lực | Tên TKGD | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian thực hiện
```

- **Dữ liệu mẫu dòng đầu**:
```text
16/09/2026 | 16/09/2026 | 06202609160000061155 | 682C6666663 | 682C6666663-M | CHV0627 | Khớp hết
```

---

### 37. Trạng thái tất toán

- **Cây Menu**: `Lệnh và vị thế > Tra cứu tổng hợp > Trạng thái tất toán`
- **URL Route**: `/ORDERS/ORDERBOOK_ALL_MM`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Ngày hệ thống, (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh, Mã KH, Mã TKGD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (27 cột)**:

```text
Chi tiết | Ngày hệ thống | Ngày phiên | Mã lệnh | Mã KH | Mã TKGD | Mã HĐ | Trạng thái | Mua/Bán | Loại lệnh | KL đặt | KL khớp | Giá đặt | Giá dừng | Giá khớp trung bình | KL còn lại | KL hủy | Phí giao dịch | Thời gian đặt | Hiệu lực | Sàn giao dịch | Ngày hiệu lực | Tên TKGD | Mã thành viên | Tên thành viên | Người đặt lệnh | Thời gian thực hiện
```

- **Dữ liệu mẫu dòng đầu**:
```text
16/09/2026 | 16/09/2026 | 06202609160000061155 | 682C6666663 | 682C6666663-M | CHV0627 | Khớp hết
```

---

### 38. Tra cứu hạn mức giao nhận

- **Cây Menu**: `Giao nhận > Tra cứu hạn mức giao nhận`
- **URL Route**: `/ORDERS/ORDERBOOK_ALL_MM`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Kho, Mã hàng hóa, Hợp đồng kỳ hạn, Trạng thái duyệt
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (14 cột)**:

```text
Khu vực | Kho | Mã hàng hóa | Hợp đồng kỳ hạn | Tổng dung lượng kho | Hạn mức tiếp nhận của kho theo ngày | Tổng số lượng bán đã đăng ký lưu ký | Tổng số lượng bán đã giao thực tế | Số lượng còn đăng ký bán | Số lượng còn bán phải giao vào kho | Hạn mức nhận | Tổng số lượng bên mua đã đăng ký nhận hàng | Tổng số lượng bên mua thực tế đã nhận hàng | Số lượng còn lại có thể đăng ký mua
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hồ Chí Minh | MSB chi nhánh TP.Hồ Chí Minh | AOC | AOC0127 | 70 | 70 | 0 | 0
```

---

### 39. Yêu cầu đăng ký giao nhận

- **Cây Menu**: `Giao nhận > Yêu cầu đăng ký giao nhận`
- **URL Route**: `/DELIVERY/PHYSICAL_MARKET_ALL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Kho, Mã hàng hóa, Hợp đồng kỳ hạn, Trạng thái duyệt
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (14 cột)**:

```text
Khu vực | Kho | Mã hàng hóa | Hợp đồng kỳ hạn | Tổng dung lượng kho | Hạn mức tiếp nhận của kho theo ngày | Tổng số lượng bán đã đăng ký lưu ký | Tổng số lượng bán đã giao thực tế | Số lượng còn đăng ký bán | Số lượng còn bán phải giao vào kho | Hạn mức nhận | Tổng số lượng bên mua đã đăng ký nhận hàng | Tổng số lượng bên mua thực tế đã nhận hàng | Số lượng còn lại có thể đăng ký mua
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hồ Chí Minh | MSB chi nhánh TP.Hồ Chí Minh | AOC | AOC0127 | 70 | 70 | 0 | 0
```

---

### 40. Yêu cầu đăng ký lưu ký

- **Cây Menu**: `Giao nhận > Yêu cầu đăng ký lưu ký`
- **URL Route**: `/DELIVERY/PHYSICAL_MARKET_ALL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Kho, Mã hàng hóa, Hợp đồng kỳ hạn, Trạng thái duyệt
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (14 cột)**:

```text
Khu vực | Kho | Mã hàng hóa | Hợp đồng kỳ hạn | Tổng dung lượng kho | Hạn mức tiếp nhận của kho theo ngày | Tổng số lượng bán đã đăng ký lưu ký | Tổng số lượng bán đã giao thực tế | Số lượng còn đăng ký bán | Số lượng còn bán phải giao vào kho | Hạn mức nhận | Tổng số lượng bên mua đã đăng ký nhận hàng | Tổng số lượng bên mua thực tế đã nhận hàng | Số lượng còn lại có thể đăng ký mua
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hồ Chí Minh | MSB chi nhánh TP.Hồ Chí Minh | AOC | AOC0127 | 70 | 70 | 0 | 0
```

---

### 41. Trạng thái giao nhận vật chất

- **Cây Menu**: `Giao nhận > Trạng thái giao nhận vật chất`
- **URL Route**: `/DELIVERY/PHYSICAL_MARKET_ALL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Kho, Mã hàng hóa, Hợp đồng kỳ hạn, Trạng thái duyệt
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (14 cột)**:

```text
Khu vực | Kho | Mã hàng hóa | Hợp đồng kỳ hạn | Tổng dung lượng kho | Hạn mức tiếp nhận của kho theo ngày | Tổng số lượng bán đã đăng ký lưu ký | Tổng số lượng bán đã giao thực tế | Số lượng còn đăng ký bán | Số lượng còn bán phải giao vào kho | Hạn mức nhận | Tổng số lượng bên mua đã đăng ký nhận hàng | Tổng số lượng bên mua thực tế đã nhận hàng | Số lượng còn lại có thể đăng ký mua
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hồ Chí Minh | MSB chi nhánh TP.Hồ Chí Minh | AOC | AOC0127 | 70 | 70 | 0 | 0
```

---

### 42. Tra cứu đối chiếu MSB

- **Cây Menu**: `Giao nhận > Tra cứu đối chiếu MSB`
- **URL Route**: `/DELIVERY/PHYSICAL_MARKET_ALL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Kho, Mã hàng hóa, Hợp đồng kỳ hạn, Trạng thái duyệt
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (14 cột)**:

```text
Khu vực | Kho | Mã hàng hóa | Hợp đồng kỳ hạn | Tổng dung lượng kho | Hạn mức tiếp nhận của kho theo ngày | Tổng số lượng bán đã đăng ký lưu ký | Tổng số lượng bán đã giao thực tế | Số lượng còn đăng ký bán | Số lượng còn bán phải giao vào kho | Hạn mức nhận | Tổng số lượng bên mua đã đăng ký nhận hàng | Tổng số lượng bên mua thực tế đã nhận hàng | Số lượng còn lại có thể đăng ký mua
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hồ Chí Minh | MSB chi nhánh TP.Hồ Chí Minh | AOC | AOC0127 | 70 | 70 | 0 | 0
```

---

### 43. Chỉ định yêu cầu giao nhận vật chất

- **Cây Menu**: `Giao nhận > Chỉ định yêu cầu giao nhận vật chất`
- **URL Route**: `/DELIVERY/PHYSICAL_MARKET_ALL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Kho, Mã hàng hóa, Hợp đồng kỳ hạn, Trạng thái duyệt
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (14 cột)**:

```text
Khu vực | Kho | Mã hàng hóa | Hợp đồng kỳ hạn | Tổng dung lượng kho | Hạn mức tiếp nhận của kho theo ngày | Tổng số lượng bán đã đăng ký lưu ký | Tổng số lượng bán đã giao thực tế | Số lượng còn đăng ký bán | Số lượng còn bán phải giao vào kho | Hạn mức nhận | Tổng số lượng bên mua đã đăng ký nhận hàng | Tổng số lượng bên mua thực tế đã nhận hàng | Số lượng còn lại có thể đăng ký mua
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hồ Chí Minh | MSB chi nhánh TP.Hồ Chí Minh | AOC | AOC0127 | 70 | 70 | 0 | 0
```

---

### 44. Quản lý tiền giao nhận

- **Cây Menu**: `Giao nhận > Quản lý tiền giao nhận`
- **URL Route**: `/DELIVERY/PHYSICAL_MARKET_ALL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Kho, Mã hàng hóa, Hợp đồng kỳ hạn, Trạng thái duyệt
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (14 cột)**:

```text
Khu vực | Kho | Mã hàng hóa | Hợp đồng kỳ hạn | Tổng dung lượng kho | Hạn mức tiếp nhận của kho theo ngày | Tổng số lượng bán đã đăng ký lưu ký | Tổng số lượng bán đã giao thực tế | Số lượng còn đăng ký bán | Số lượng còn bán phải giao vào kho | Hạn mức nhận | Tổng số lượng bên mua đã đăng ký nhận hàng | Tổng số lượng bên mua thực tế đã nhận hàng | Số lượng còn lại có thể đăng ký mua
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hồ Chí Minh | MSB chi nhánh TP.Hồ Chí Minh | AOC | AOC0127 | 70 | 70 | 0 | 0
```

---

### 45. Yêu cầu giao hàng chỉ định bị từ chối

- **Cây Menu**: `Giao nhận > Yêu cầu giao hàng chỉ định bị từ chối`
- **URL Route**: `/DELIVERY/PHYSICAL_MARKET_ALL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Kho, Mã hàng hóa, Hợp đồng kỳ hạn, Trạng thái duyệt
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (14 cột)**:

```text
Khu vực | Kho | Mã hàng hóa | Hợp đồng kỳ hạn | Tổng dung lượng kho | Hạn mức tiếp nhận của kho theo ngày | Tổng số lượng bán đã đăng ký lưu ký | Tổng số lượng bán đã giao thực tế | Số lượng còn đăng ký bán | Số lượng còn bán phải giao vào kho | Hạn mức nhận | Tổng số lượng bên mua đã đăng ký nhận hàng | Tổng số lượng bên mua thực tế đã nhận hàng | Số lượng còn lại có thể đăng ký mua
```

- **Dữ liệu mẫu dòng đầu**:
```text
Hồ Chí Minh | MSB chi nhánh TP.Hồ Chí Minh | AOC | AOC0127 | 70 | 70 | 0 | 0
```

---

### 46. Quản lý trạng thái TKGD

- **Cây Menu**: `Quản lý rủi ro > Quản lý trạng thái TKGD`
- **URL Route**: `/RISKMNG/ACCTMARGIN_ALL`
- **Nút Kết xuất**: Có (`Kết xuất`)
- **Danh sách Tab con**: **[Danh sách trạng thái TKGD]**, Danh sách trạng thái TKTVKD, Hệ thống0, Hàng hóa0, Tài khoản0
  + *Chi tiết cột từng Tab*:
    * **Tab [Danh sách trạng thái TKGD]** (49 cột): `Mã TKGD | Tên TKGD | Mã TVKD | Tên TVKD | Trạng thái | Tỷ lệ ký quỹ (%) | Số dư TKKQ | Mức bổ sung ký quỹ | KQ ban đầu yêu cầu | KQ ban đầu yêu cầu (USD) | KQ ban đầu yêu cầu tạm tính | KQ ban đầu yêu cầu tạm tính (USD) | Lãi lỗ thực tế Future (VND) | Lãi lỗ thực tế Future (USD) | Lãi lỗ dự kiến Future (VND) | Lãi lỗ dự kiến Future (USD) | Lãi lỗ thực tế T-1 Future (VND) | Lãi lỗ thực tế T-1 Future (USD) | Giá trị ròng ký quỹ | Giá trị ròng ký quỹ (USD) | Ký quỹ khả dụng tạm tính | Ký quỹ khả dụng | Ký quỹ khả dụng (USD) | Phí giao dịch | Nộp rút trong phiên | Nộp rút trong phiên (USD) | Ký quỹ giao nhận | Phí giao nhận | Phí thực hiện thay nghĩa vụ | Phí dịch vụ thanh toán | Phí thanh toán đáo hạn bằng tiền | Lãi lỗ vị thế đáo hạn | Số dư đầu ngày | Số dư đầu ngày (USD) | Số dư cuối ngày | Số dư cuối ngày (USD) | Phương thức xử lý | Phí quyền chọn | Phí quyền chọn (USD) | MVO | MVO (USD) | Lãi lỗ chờ đáo hạn | Lãi lỗ chờ đáo hạn (USD) | Lãi lỗ Options | Lãi lỗ Options (USD) | Lãi lỗ dự kiến Options | Lãi lỗ dự kiến Options (USD) | Số dư đầu ngày tạm tính | Số dư đầu ngày tạm tính (USD)`
    * **Tab [Danh sách trạng thái TKTVKD]** (49 cột): `Mã TKGD0 | Tên TKGD0 | Mã TVKD0 | Tên TVKD0 | Trạng thái0 | Tỷ lệ ký quỹ (%)0 | Số dư TKKQ0 | Mức bổ sung ký quỹ0 | KQ ban đầu yêu cầu0 | KQ ban đầu yêu cầu (USD)0 | KQ ban đầu yêu cầu tạm tính0 | KQ ban đầu yêu cầu tạm tính (USD)0 | Lãi lỗ thực tế Future (VND)0 | Lãi lỗ thực tế Future (USD)0 | Lãi lỗ dự kiến Future (VND)0 | Lãi lỗ dự kiến Future (USD)0 | Lãi lỗ thực tế T-1 Future (VND)0 | Lãi lỗ thực tế T-1 Future (USD)0 | Giá trị ròng ký quỹ0 | Giá trị ròng ký quỹ (USD)0 | Ký quỹ khả dụng tạm tính0 | Ký quỹ khả dụng0 | Ký quỹ khả dụng (USD)0 | Phí giao dịch0 | Nộp rút trong phiên0 | Nộp rút trong phiên (USD)0 | Ký quỹ giao nhận0 | Phí giao nhận0 | Phí thực hiện thay nghĩa vụ0 | Phí dịch vụ thanh toán0 | Phí thanh toán đáo hạn bằng tiền0 | Lãi lỗ vị thế đáo hạn0 | Số dư đầu ngày0 | Số dư đầu ngày (USD)0 | Số dư cuối ngày0 | Số dư cuối ngày (USD)0 | Phương thức xử lý0 | Phí quyền chọn0 | Phí quyền chọn (USD)0 | MVO0 | MVO (USD)0 | Lãi lỗ chờ đáo hạn0 | Lãi lỗ chờ đáo hạn (USD)0 | Lãi lỗ Options0 | Lãi lỗ Options (USD)0 | Lãi lỗ dự kiến Options0 | Lãi lỗ dự kiến Options (USD)0 | Số dư đầu ngày tạm tính0 | Số dư đầu ngày tạm tính (USD)0`
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã TKGD, Mã TVKD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (49 cột)**:

```text
Mã TKGD | Tên TKGD | Mã TVKD | Tên TVKD | Trạng thái | Tỷ lệ ký quỹ (%) | Số dư TKKQ | Mức bổ sung ký quỹ | KQ ban đầu yêu cầu | KQ ban đầu yêu cầu (USD) | KQ ban đầu yêu cầu tạm tính | KQ ban đầu yêu cầu tạm tính (USD) | Lãi lỗ thực tế Future (VND) | Lãi lỗ thực tế Future (USD) | Lãi lỗ dự kiến Future (VND) | Lãi lỗ dự kiến Future (USD) | Lãi lỗ thực tế T-1 Future (VND) | Lãi lỗ thực tế T-1 Future (USD) | Giá trị ròng ký quỹ | Giá trị ròng ký quỹ (USD) | Ký quỹ khả dụng tạm tính | Ký quỹ khả dụng | Ký quỹ khả dụng (USD) | Phí giao dịch | Nộp rút trong phiên | Nộp rút trong phiên (USD) | Ký quỹ giao nhận | Phí giao nhận | Phí thực hiện thay nghĩa vụ | Phí dịch vụ thanh toán | Phí thanh toán đáo hạn bằng tiền | Lãi lỗ vị thế đáo hạn | Số dư đầu ngày | Số dư đầu ngày (USD) | Số dư cuối ngày | Số dư cuối ngày (USD) | Phương thức xử lý | Phí quyền chọn | Phí quyền chọn (USD) | MVO | MVO (USD) | Lãi lỗ chờ đáo hạn | Lãi lỗ chờ đáo hạn (USD) | Lãi lỗ Options | Lãi lỗ Options (USD) | Lãi lỗ dự kiến Options | Lãi lỗ dự kiến Options (USD) | Số dư đầu ngày tạm tính | Số dư đầu ngày tạm tính (USD)
```

- **Dữ liệu mẫu dòng đầu**:
```text
012C0000204-M | Lê Thị Trang | 012 | TVKD 012 | An toàn | 256.32 | 1,027,849,422 | 0
```

---

### 47. Danh sách Tài khoản vi phạm ký quỹ

- **Cây Menu**: `Quản lý rủi ro > Danh sách Tài khoản vi phạm ký quỹ`
- **URL Route**: `/RISKMNG/ACCTMARGIN_ALL`
- **Nút Kết xuất**: Có (`Kết xuất`)
- **Danh sách Tab con**: **[Danh sách trạng thái TKGD]**, Danh sách trạng thái TKTVKD, Hệ thống0, Hàng hóa0, Tài khoản0
  + *Chi tiết cột từng Tab*:
    * **Tab [Danh sách trạng thái TKGD]** (49 cột): `Mã TKGD | Tên TKGD | Mã TVKD | Tên TVKD | Trạng thái | Tỷ lệ ký quỹ (%) | Số dư TKKQ | Mức bổ sung ký quỹ | KQ ban đầu yêu cầu | KQ ban đầu yêu cầu (USD) | KQ ban đầu yêu cầu tạm tính | KQ ban đầu yêu cầu tạm tính (USD) | Lãi lỗ thực tế Future (VND) | Lãi lỗ thực tế Future (USD) | Lãi lỗ dự kiến Future (VND) | Lãi lỗ dự kiến Future (USD) | Lãi lỗ thực tế T-1 Future (VND) | Lãi lỗ thực tế T-1 Future (USD) | Giá trị ròng ký quỹ | Giá trị ròng ký quỹ (USD) | Ký quỹ khả dụng tạm tính | Ký quỹ khả dụng | Ký quỹ khả dụng (USD) | Phí giao dịch | Nộp rút trong phiên | Nộp rút trong phiên (USD) | Ký quỹ giao nhận | Phí giao nhận | Phí thực hiện thay nghĩa vụ | Phí dịch vụ thanh toán | Phí thanh toán đáo hạn bằng tiền | Lãi lỗ vị thế đáo hạn | Số dư đầu ngày | Số dư đầu ngày (USD) | Số dư cuối ngày | Số dư cuối ngày (USD) | Phương thức xử lý | Phí quyền chọn | Phí quyền chọn (USD) | MVO | MVO (USD) | Lãi lỗ chờ đáo hạn | Lãi lỗ chờ đáo hạn (USD) | Lãi lỗ Options | Lãi lỗ Options (USD) | Lãi lỗ dự kiến Options | Lãi lỗ dự kiến Options (USD) | Số dư đầu ngày tạm tính | Số dư đầu ngày tạm tính (USD)`
    * **Tab [Danh sách trạng thái TKTVKD]** (16 cột): `Thao tác | Mã TKGD0 | Mã TVKD0 | Tên TKGD0 | Tỷ lệ ký quỹ (%)0 | Trạng thái0 | Số dư TKKQ0 | Mức bổ sung ký quỹ0 | KQ ban đầu yêu cầu0 | KQ ban đầu yêu cầu (USD)0 | KQ ban đầu yêu cầu tạm tính0 | KQ ban đầu yêu cầu tạm tính (USD)0 | Lãi lỗ thực tế Future (VND)0 | Lãi lỗ thực tế Future (USD)0 | Lãi lỗ dự kiến Future (VND)0 | Lãi lỗ dự kiến Future (USD)0`
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã TKGD, Mã TVKD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (49 cột)**:

```text
Mã TKGD | Tên TKGD | Mã TVKD | Tên TVKD | Trạng thái | Tỷ lệ ký quỹ (%) | Số dư TKKQ | Mức bổ sung ký quỹ | KQ ban đầu yêu cầu | KQ ban đầu yêu cầu (USD) | KQ ban đầu yêu cầu tạm tính | KQ ban đầu yêu cầu tạm tính (USD) | Lãi lỗ thực tế Future (VND) | Lãi lỗ thực tế Future (USD) | Lãi lỗ dự kiến Future (VND) | Lãi lỗ dự kiến Future (USD) | Lãi lỗ thực tế T-1 Future (VND) | Lãi lỗ thực tế T-1 Future (USD) | Giá trị ròng ký quỹ | Giá trị ròng ký quỹ (USD) | Ký quỹ khả dụng tạm tính | Ký quỹ khả dụng | Ký quỹ khả dụng (USD) | Phí giao dịch | Nộp rút trong phiên | Nộp rút trong phiên (USD) | Ký quỹ giao nhận | Phí giao nhận | Phí thực hiện thay nghĩa vụ | Phí dịch vụ thanh toán | Phí thanh toán đáo hạn bằng tiền | Lãi lỗ vị thế đáo hạn | Số dư đầu ngày | Số dư đầu ngày (USD) | Số dư cuối ngày | Số dư cuối ngày (USD) | Phương thức xử lý | Phí quyền chọn | Phí quyền chọn (USD) | MVO | MVO (USD) | Lãi lỗ chờ đáo hạn | Lãi lỗ chờ đáo hạn (USD) | Lãi lỗ Options | Lãi lỗ Options (USD) | Lãi lỗ dự kiến Options | Lãi lỗ dự kiến Options (USD) | Số dư đầu ngày tạm tính | Số dư đầu ngày tạm tính (USD)
```

- **Dữ liệu mẫu dòng đầu**:
```text
012C0000204-M | Lê Thị Trang | 012 | TVKD 012 | An toàn | 256.32 | 1,027,849,422 | 0
```

---

### 48. Tra cứu lịch sử Force Sell

- **Cây Menu**: `Quản lý rủi ro > Tra cứu lịch sử Force Sell`
- **URL Route**: `/RISKMNG/FORCESELL`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Mã TKGD, Mã TVKD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (16 cột)**:

```text
Thao tác | Mã TKGD | Mã TVKD | Tên TKGD | Tỷ lệ ký quỹ (%) | Trạng thái | Số dư TKKQ | Mức bổ sung ký quỹ | KQ ban đầu yêu cầu | KQ ban đầu yêu cầu (USD) | KQ ban đầu yêu cầu tạm tính | KQ ban đầu yêu cầu tạm tính (USD) | Lãi lỗ thực tế Future (VND) | Lãi lỗ thực tế Future (USD) | Lãi lỗ dự kiến Future (VND) | Lãi lỗ dự kiến Future (USD)
```

- **Dữ liệu mẫu dòng đầu**:
```text
Xử lý | 601C9998889-M | 601 | MXV 89 | -2,841,893.34% | Xử lý | -1,818,650,500,000 | 1,818,875,740,000
```

---

### 49. Thiết lập tài khoản loại trừ xử lý tự động

- **Cây Menu**: `Quản lý rủi ro > Thiết lập tài khoản loại trừ xử lý tự động`
- **URL Route**: `/RISKMNG/FORCESELL_HIST`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., ID Force Sell, TKGD, Mã TVKD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (11 cột)**:

```text
Thao tác | ID Force Sell | Phương thức | TKGD | Khách hàng | Mã TVKD | Thời gian bắt đầu | Tỷ lệ ký quỹ (%) | Mức bổ sung KQ | Lệnh Force | Thời gian kết thúc
```

- **Dữ liệu mẫu dòng đầu**:
```text
Xem chi tiết | FS-2026-259-155353 | Thủ công | 641C0365489-A | Quỳnh 4 | 641 | 16/09/2026 15:53:53 | 27.65%
```

---

### 50. Báo cáo

- **Cây Menu**: `Báo cáo > Báo cáo`
- **URL Route**: `/RISKMNG/FORCESELL_HIST`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., ID Force Sell, TKGD, Mã TVKD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (11 cột)**:

```text
Thao tác | ID Force Sell | Phương thức | TKGD | Khách hàng | Mã TVKD | Thời gian bắt đầu | Tỷ lệ ký quỹ (%) | Mức bổ sung KQ | Lệnh Force | Thời gian kết thúc
```

- **Dữ liệu mẫu dòng đầu**:
```text
Xem chi tiết | FS-2026-259-155353 | Thủ công | 641C0365489-A | Quỳnh 4 | 641 | 16/09/2026 15:53:53 | 27.65%
```

---

### 51. Monitor OMS ACM

- **Cây Menu**: `Monitor OMS > Monitor OMS ACM`
- **URL Route**: `/RISKMNG/FORCESELL_HIST`
- **Nút Kết xuất**: Có (`Kết xuất`)
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., ID Force Sell, TKGD, Mã TVKD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (11 cột)**:

```text
Thao tác | ID Force Sell | Phương thức | TKGD | Khách hàng | Mã TVKD | Thời gian bắt đầu | Tỷ lệ ký quỹ (%) | Mức bổ sung KQ | Lệnh Force | Thời gian kết thúc
```

- **Dữ liệu mẫu dòng đầu**:
```text
Xem chi tiết | FS-2026-259-155353 | Thủ công | 641C0365489-A | Quỳnh 4 | 641 | 16/09/2026 15:53:53 | 27.65%
```

---

### 52. EOD hệ thống

- **Cây Menu**: `Vận hành > EOD hệ thống`
- **URL Route**: `/MONITOR_OMS/MONITOR_OMS_ACM`
- **Nút Kết xuất**: Có (`Kết xuất`)
- **Danh sách Tab con**: **[Phiên]**, Tài khoản, Lệnh, Hợp đồng/ HH, Rổ ký quỹ, Rổ hạn mức, Phí giao dịch, Lãi lỗ thực tế, Trạng thái mở, Hệ thống0, Hàng hóa0, Tài khoản0
  + *Chi tiết cột từng Tab*:
    * **Tab [Phiên]** (20 cột): `Bước | Công việc | Trạng thái | Bắt đầu | Kết thúc | Chi tiết lỗi | Bước | Công việc | Trạng thái | Bắt đầu | Kết thúc | Chi tiết lỗi | Thao tác | Ngày hệ thống | Sàn giao dịch | Người thực hiện | Trạng thái | Phương thức | Thời gian bắt đầu | Thời gian kết thúc`
- **Bộ lọc tìm kiếm**: Tìm kiếm...
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (20 cột)**:

```text
Bước | Công việc | Trạng thái | Bắt đầu | Kết thúc | Chi tiết lỗi | Bước | Công việc | Trạng thái | Bắt đầu | Kết thúc | Chi tiết lỗi | Thao tác | Ngày hệ thống | Sàn giao dịch | Người thực hiện | Trạng thái | Phương thức | Thời gian bắt đầu | Thời gian kết thúc
```

- **Dữ liệu mẫu dòng đầu**:
```text
1 | Tổng hợp csv cuối ngày | Chưa chạy | - | - | -
```

---

### 53. EOD giao nhận

- **Cây Menu**: `Vận hành > EOD giao nhận`
- **URL Route**: `/EOD/EODPROCESS`
- **Nút Kết xuất**: Không có
- **Danh sách Tab con**: **[Vận hành EOD - MXV]**, Vận hành EOD - ACM, Lịch sử EOD, Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm...
- **Bảng dữ liệu**: Màn hình cấu hình / Form nhập liệu (không có table grid).

---

### 54. File Monitor (CSV)

- **Cây Menu**: `Vận hành > File Monitor (CSV)`
- **URL Route**: `/EOD/MONITORCSV`
- **Nút Kết xuất**: Không có
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Loại file
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (14 cột)**:

```text
Thao tác | Loại file | Thời gian bắt đầu | Thời gian kết thúc | Trạng thái | Người thực hiện | Thao tác | Loại file | Loại file | Ngày hệ thống | Thời gian bắt đầu | Thời gian kết thúc | Trạng thái | Người thực hiện
```

- **Dữ liệu mẫu dòng đầu**:
```text
Tạo fileXem chi tiết | Đăng ký giao nhận | 17/09/2026 08:30:01 | 17/09/2026 08:30:03 | Thành công | SYSTEM
```

---

### 55. Truy vấn thông tin từ core Exchange

- **Cây Menu**: `Vận hành > Truy vấn thông tin từ core Exchange`
- **URL Route**: `/EOD/MONITORCSV`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., Loại file, Ngày hệ thống
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (14 cột)**:

```text
Thao tác | Loại file | Thời gian bắt đầu | Thời gian kết thúc | Trạng thái | Người thực hiện | Thao tác | Loại file | Loại file | Ngày hệ thống | Thời gian bắt đầu | Thời gian kết thúc | Trạng thái | Người thực hiện
```

- **Dữ liệu mẫu dòng đầu**:
```text
Tạo fileXem chi tiết | Đăng ký giao nhận | 17/09/2026 08:30:01 | 17/09/2026 08:30:03 | Thành công | SYSTEM
```

---

### 56. Đối chiếu lệnh với core Exchange

- **Cây Menu**: `Vận hành > Đối chiếu lệnh với core Exchange`
- **URL Route**: `/EOD/COMPARECSV`
- **Nút Kết xuất**: Không có
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm...
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (6 cột)**:

```text
Loại truy vấn | Thao tác | Thời gian bắt đầu | Thời gian kết thúc | Trạng thái | Người thực hiện
```

- **Dữ liệu mẫu dòng đầu**:
```text
Thông tin hàng hóa | Lấy dữ liệu | 04:45:21 | 04:45:22 | Thành công | SYSTEM
```

---

### 57. Lịch sử đối chiếu lệnh với core Exchange

- **Cây Menu**: `Vận hành > Lịch sử đối chiếu lệnh với core Exchange`
- **URL Route**: `/EOD/COMPARECSV`
- **Nút Kết xuất**: Không có
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm...
- **Bảng dữ liệu**: Màn hình cấu hình / Form nhập liệu (không có table grid).

---

### 58. Kết quả EOD

- **Cây Menu**: `Vận hành > Kết quả EOD`
- **URL Route**: `/EOD/ACCTMARGIN_HIST`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày giao dịch, (Đến) Ngày giao dịch, Mã TKGD, Mã TVKD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (27 cột)**:

```text
Ngày giao dịch | Mã TKGD | Tên TKGD | Mã TVKD | Số dư đầu ngày | Nộp rút trong ngày | Lãi lỗ thực tế (VND) | Lãi lỗ dự kiến (VND) | Lãi lỗ chờ đáo hạn (VND) | KQ ban đầu yêu cầu | Ký quỹ khả dụng | Giá trị ròng ký quỹ | Lãi lỗ thực tế Option | Lãi lỗ dự kiến Option | Phí giao dịch | Phí quyền chọn | Số dư cuối ngày | MVO (VND) | Mức bổ sung ký quỹ | Tỷ lệ ký quỹ | Phí thanh toán đáo hạn bằng tiền | Lãi lỗ vị thế đáo hạn | Ký quỹ giao nhận | Phí giao nhận | Phí dịch vụ thanh toán | Phí thực hiện thay nghĩa vụ | Trạng thái
```

- **Dữ liệu mẫu dòng đầu**:
```text
16/09/2026 | 012C0000204-M | Lê Thị Trang | 012 | 1,027,849,422 | 0 | 0 | -545,400,000
```

---

### 59. Đối chiếu lệnh liên thông

- **Cây Menu**: `Vận hành > Đối chiếu lệnh liên thông`
- **URL Route**: `/EOD/ACCTMARGIN_HIST`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày giao dịch, (Đến) Ngày giao dịch, Mã TKGD, Mã TVKD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (27 cột)**:

```text
Ngày giao dịch | Mã TKGD | Tên TKGD | Mã TVKD | Số dư đầu ngày | Nộp rút trong ngày | Lãi lỗ thực tế (VND) | Lãi lỗ dự kiến (VND) | Lãi lỗ chờ đáo hạn (VND) | KQ ban đầu yêu cầu | Ký quỹ khả dụng | Giá trị ròng ký quỹ | Lãi lỗ thực tế Option | Lãi lỗ dự kiến Option | Phí giao dịch | Phí quyền chọn | Số dư cuối ngày | MVO (VND) | Mức bổ sung ký quỹ | Tỷ lệ ký quỹ | Phí thanh toán đáo hạn bằng tiền | Lãi lỗ vị thế đáo hạn | Ký quỹ giao nhận | Phí giao nhận | Phí dịch vụ thanh toán | Phí thực hiện thay nghĩa vụ | Trạng thái
```

- **Dữ liệu mẫu dòng đầu**:
```text
16/09/2026 | 012C0000204-M | Lê Thị Trang | 012 | 1,027,849,422 | 0 | 0 | -545,400,000
```

---

### 60. Lịch sử đối chiếu lệnh liên thông

- **Cây Menu**: `Vận hành > Lịch sử đối chiếu lệnh liên thông`
- **URL Route**: `/EOD/ACCTMARGIN_HIST`
- **Nút Kết xuất**: Có (`Kết xuất`)
  + *Định dạng xuất hỗ trợ*: Xuất trang hiện tại, Xuất tất cả
- **Danh sách Tab con**: Hệ thống0, Hàng hóa0, Tài khoản0
- **Bộ lọc tìm kiếm**: Tìm kiếm..., (Từ) Ngày giao dịch, (Đến) Ngày giao dịch, Mã TKGD, Mã TVKD
- **Phân trang / Bản ghi**: Không hiển thị
- **Danh sách cột (27 cột)**:

```text
Ngày giao dịch | Mã TKGD | Tên TKGD | Mã TVKD | Số dư đầu ngày | Nộp rút trong ngày | Lãi lỗ thực tế (VND) | Lãi lỗ dự kiến (VND) | Lãi lỗ chờ đáo hạn (VND) | KQ ban đầu yêu cầu | Ký quỹ khả dụng | Giá trị ròng ký quỹ | Lãi lỗ thực tế Option | Lãi lỗ dự kiến Option | Phí giao dịch | Phí quyền chọn | Số dư cuối ngày | MVO (VND) | Mức bổ sung ký quỹ | Tỷ lệ ký quỹ | Phí thanh toán đáo hạn bằng tiền | Lãi lỗ vị thế đáo hạn | Ký quỹ giao nhận | Phí giao nhận | Phí dịch vụ thanh toán | Phí thực hiện thay nghĩa vụ | Trạng thái
```

- **Dữ liệu mẫu dòng đầu**:
```text
16/09/2026 | 012C0000204-M | Lê Thị Trang | 012 | 1,027,849,422 | 0 | 0 | -545,400,000
```

---

