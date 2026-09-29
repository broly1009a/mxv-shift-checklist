# TÀI LIỆU KHẢO SÁT & ĐẶC TẢ DANH MỤC TRANG, BÁO CÁO CORE EXCHANGE (CE)

> **Tài liệu chuẩn bị**: Phục vụ thiết kế và phát triển tính năng Backup tự động Core Exchange (CE) cho ca trực MXV  
> **Môi trường**: Core Exchange UAT (`https://uat-coreexchange.mxv.com.vn`)  
> **Tài khoản kiểm thử**: `hieptruong`  
> **Thời điểm quét thực tế**: 2026-09-22T12:16:54.699Z  
> **Tổng số màn hình chức năng khảo sát**: 47 trang (Direct Routing 100%)  

---

## 1. TỔNG HỢP CÁC TRANG CÓ HỖ TRỢ KẾT XUẤT DỮ LIỆU (EXPORT / BACKUP)

Bảng dưới đây liệt kê toàn bộ các màn hình trên Core Exchange (CE) có nút **"Kết xuất" (Export)** sẵn sàng phục vụ quy trình tải báo cáo và sao lưu định kỳ:

| STT | Phân Hệ / Nhóm | Tên Màn Hình Nghiệp Vụ | URL Route Chuẩn | Nút Kết Xuất & Định Dạng | Bộ Lọc Tìm Kiếm Chính |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | Trang chủ & Báo cáo | **Dashboard trung tâm** | `/DASHBOARD` | Xuất trang hiện tại, Xuất tất cả | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 2 | Trang chủ & Báo cáo | **Trung tâm Báo cáo CE** | `/REPORTS` | Xuất PDF, Xuất Excel | Mặc định |
| 3 | Trang chủ & Báo cáo | **Monitor Matching Engine** | `/MONITOR_ME` | Xuất trang hiện tại, Xuất tất cả | Mã hợp đồng, Mã hàng hóa |
| 4 | Quản lý sổ lệnh | **Danh sách lệnh trong phiên** | `/ORDERS/ORDERBOOK` | Xuất trang hiện tại, Xuất tất cả | Mã phiên, (Từ) Ngày phiên, (Đến) Ngày phiên |
| 5 | Quản lý sổ lệnh | **Danh sách lệnh Market Maker** | `/ORDERS/ORDERBOOK_MM` | Kết xuất | Mã phiên, (Từ) Ngày phiên, (Đến) Ngày phiên |
| 6 | Quản lý sổ lệnh | **Danh sách lệnh liên thông ACM** | `/ORDERS/ORDERBOOK_ACM` | Kết xuất | (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh gốc |
| 7 | Quản lý sổ lệnh | **Lịch sử sổ lệnh liên thông** | `/ORDERS/ORDERBOOK_ALL_ACM` | Xuất trang hiện tại, Xuất tất cả | (Từ) Ngày phiên, (Đến) Ngày phiên, Mã lệnh gốc |
| 8 | Quản lý sổ lệnh | **Lịch sử sổ lệnh Market Maker** | `/ORDERS/ORDERBOOK_ALL_MM` | Kết xuất | Mã phiên, (Từ) Ngày phiên, (Đến) Ngày phiên |
| 9 | Quản lý sổ lệnh | **Danh sách khớp lệnh liên thông** | `/ORDERS/ORDERMATCH_ALL_ACM` | Xuất trang hiện tại, Xuất tất cả | (Từ) Ngày phiên, (Đến) Ngày phiên, Số tài khoản |
| 10 | Quản lý sổ lệnh | **Danh sách khớp lệnh Market Maker** | `/ORDERS/ORDERMATCH_ALL_MM` | Kết xuất | Mã phiên, (Từ) Ngày phiên, (Đến) Ngày phiên |
| 11 | Quản lý sổ lệnh | **Lịch sử khớp lệnh liên thông chi tiết** | `/ORDERS/ORDERMATCH_DETAIL_ACM` | Kết xuất | (Từ) Ngày phiên, (Đến) Ngày phiên, Số tài khoản |
| 12 | Quản lý sổ lệnh | **Lịch sử khớp lệnh MM chi tiết** | `/ORDERS/ORDERMATCH_DETAIL_MM` | Kết xuất | Mã phiên, (Từ) Ngày phiên, (Đến) Ngày phiên |
| 13 | Quản lý sổ lệnh | **Báo cáo phân hệ sổ lệnh** | `/ORDERS/REPORTS` | Xuất trang hiện tại, Xuất tất cả | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 14 | Quản lý sản phẩm | **Quản lý hàng hóa, hợp đồng** | `/PRODUCT/COMMODITY` | Xuất trang hiện tại, Xuất tất cả | Mã hàng hóa, Nhóm hàng hóa, Tên hàng hóa tiếng Việt |
| 15 | Quản lý sản phẩm | **Quản lý hàng hóa liên thông (ACM)** | `/PRODUCT/COMMODITY_ACM` | Kết xuất | Mã hàng hóa, Tên hàng hóa tiếng Việt, Mã hàng hóa từ sở |
| 16 | Quản lý phiên giao dịch | **Cấu hình phiên giao dịch** | `/SESSIONMNG/TRADING_SESSION` | Xuất trang hiện tại, Xuất tất cả | Hàng hóa, Trạng thái |
| 17 | Quản lý phiên giao dịch | **Danh sách cấu hình phiên** | `/SESSIONMNG/SESSION_CONFIG_ALL` | Kết xuất | Hàng hóa, Tên phiên, Trạng thái |
| 18 | Quản lý phiên giao dịch | **Thông tin phiên trong ngày** | `/SESSIONMNG/SESSION_INFO` | Xuất trang hiện tại, Xuất tất cả | Hàng hóa, Tên cấu hình, Trạng thái |
| 19 | Quản lý phiên giao dịch | **Lịch sử phiên giao dịch quá khứ** | `/SESSIONMNG/TRADING_SESSION_HIST` | Xuất trang hiện tại, Xuất tất cả | Ngày phiên, Hàng hóa |
| 20 | Quản lý phiên giao dịch | **Báo cáo phiên giao dịch** | `/SESSIONMNG/REPORTS` | Xuất trang hiện tại, Xuất tất cả | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 21 | Quản lý tài khoản | **Quản lý khách hàng** | `/ACCOUNTMNG/CUSTOMERS` | Xuất trang hiện tại, Xuất tất cả | Tên thành viên, Mã khách hàng, Số điện thoại |
| 22 | Quản lý tài khoản | **Quản lý khách hàng (đầy đủ)** | `/ACCOUNTMNG/CUSTOMERS_PUBLIC` | Kết xuất | Tên thành viên, Mã khách hàng, Số điện thoại |
| 23 | Quản lý tài khoản | **Danh sách tài khoản giao dịch** | `/ACCOUNTMNG/ACCOUNTS_INFO` | Kết xuất | Mã khách hàng, Số TKGD |
| 24 | Quản lý tài khoản | **Yêu cầu mở tài khoản** | `/ACCOUNTMNG/OPENACCREQ` | Xuất trang hiện tại, Xuất tất cả | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 25 | Quản lý thành viên | **Thông tin thành viên** | `/MEMBERSMNG/MEMBERS` | Xuất trang hiện tại, Xuất tất cả | Trạng thái, Mã thành viên, Tên thành viên |
| 26 | Quản lý thành viên | **Báo cáo thành viên** | `/MEMBERSMNG/REPORTS` | Xuất trang hiện tại, Xuất tất cả | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 27 | Quản lý FCM | **Khai báo FCM** | `/FCMMNG/FCM_INFORMATION` | Xuất trang hiện tại, Xuất tất cả | Mã FCM |
| 28 | Quản lý vận hành | **SOD Quy trình đầu ngày** | `/EOD/SODPROCESS` | Xuất trang hiện tại, Xuất tất cả | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 29 | Quản lý vận hành | **EOD Quy trình cuối ngày** | `/EODEXCHANGE/EODPROCESS` | Kết xuất | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 30 | Quản lý vận hành | **Đối chiếu dữ liệu liên thông CSV** | `/EOD/COMPARECSV` | Kết xuất | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 31 | Quản lý vận hành | **Đối chiếu lệnh liên thông** | `/EOD/ACM_RECON_ORDERS` | Xuất trang hiện tại, Xuất tất cả | Mã lệnh, Mã lệnh Sở LT, Hợp đồng |
| 32 | Quản lý vận hành | **Truy vấn dữ liệu liên thông ACM** | `/EOD/ACM_SYNC_REQUEST_LOG` | Xuất trang hiện tại, Xuất tất cả | Ngày phiên, Giờ truy vấn, Loại nghiệp vụ |
| 33 | Quản lý vận hành | **Đối chiếu lệnh Active** | `/EOD/COMPARE_ORDER_ACTIVE` | Xuất trang hiện tại, Xuất tất cả | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 34 | Quản lý tham số | **Tham số hệ thống** | `/SYSCONFIGMNG/SYSCONFIG` | Xuất trang hiện tại, Xuất tất cả | Tên tham số, Giá trị, Mô tả |
| 35 | Quản lý tham số | **Cấu hình Noti / SMS / Email** | `/SYSCONFIGMNG/NOTIFICATION` | Xuất trang hiện tại, Xuất tất cả | Mô tả, Loại |
| 36 | Quản lý tham số | **Tỷ giá tiền tệ** | `/SYSCONFIGMNG/CURRENCYEXCHANGERATE` | Xuất trang hiện tại, Xuất tất cả | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 37 | Quản lý tham số | **Phân khúc giao dịch** | `/TRANSPARAMMNG/TRADESEGMENTS` | Kết xuất | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 38 | Quản lý tham số | **Biểu phí giao dịch** | `/TRANSPARAMMNG/FEETYPE` | Kết xuất | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 39 | Quản lý tham số | **Rổ ký quỹ ban đầu** | `/TRANSPARAMMNG/IMBASKETS` | Kết xuất | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 40 | Quản lý tham số | **Rổ hạn mức vị thế** | `/TRANSPARAMMNG/POSLIMITBASKETS` | Kết xuất | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 41 | Quản lý tham số | **Tài khoản mặc định** | `/TRANSPARAMMNG/DEFACCOUNTS` | Kết xuất | Trạng thái, Ngày giao dịch, Tên nghiệp vụ |
| 42 | Quản lý người dùng | **Quản lý nhóm quyền** | `/USERMNG/TLGROUPS` | Xuất trang hiện tại, Xuất tất cả | Tên nhóm quyền |
| 43 | Quản lý người dùng | **Người sử dụng** | `/USERMNG/TLPROFILES` | Xuất trang hiện tại, Xuất tất cả | Họ và tên, Trạng thái |

> **Nhận định quan trọng cho luồng phát triển Backup CE**:
> 1. **Direct Routing**: Toàn bộ hệ thống Core Exchange (CE) hỗ trợ Direct Routing bằng đường dẫn tuyệt đối (như `/ORDERS/ORDERBOOK`, `/ORDERS/ORDERMATCH_DETAIL`, `/REPORTS`, `/SESSIONMNG/SESSION_CONFIG_ALL`, `/PRODUCT/COMMODITY`, v.v.). Bot hoàn toàn có thể điều hướng trực tiếp bằng `page.goto(baseUrl + route)` mà không cần click mở từng cấp Sidebar, tốc độ mỗi trang chỉ mất **1.0s - 1.5s**, miễn nhiễm 100% với lỗi kẹt giao diện.
> 2. **Component Kết xuất tương đồng CoreCCP**: Nút "Kết xuất" của CE sử dụng chung thư viện giao diện VNCLEAR (Material React Table) với CoreCCP, hỗ trợ 2 chế độ: **"Xuất trang hiện tại"** và **"Xuất tất cả"** (kèm xuất Excel và CSV). Có thể tái sử dụng trực tiếp các hàm bóc tách và tải file từ `ccp-ce-downloader.service.ts`.
> 3. **Các báo cáo trọng điểm của ca trực**:
>    - **Sổ lệnh & Giao dịch**: `/ORDERS/ORDERBOOK`, `/ORDERS/ORDERMATCH`, `/ORDERS/ORDERBOOK_ALL_ACM`, `/ORDERS/ORDERMATCH_DETAIL_ACM`, `/ORDERS/ORDERBOOK_MM`.
>    - **Phiên giao dịch**: `/SESSIONMNG/SESSION_INFO` (thông tin phiên trong ngày), `/SESSIONMNG/SESSION_CONFIG_ALL`.
>    - **Sản phẩm & Hợp đồng**: `/PRODUCT/COMMODITY`, `/PRODUCT/COMMODITY_ACM`.
>    - **Báo cáo định kỳ**: `/REPORTS` (Trung tâm báo cáo tổng hợp).

---

## 2. MA TRẬN CHI TIẾT TẤT CẢ 47 MÀN HÌNH CHỨC NĂNG CORE EXCHANGE (CE)

###  TRANG CHỦ & BÁO CÁO (4 màn hình)

#### 1. Dashboard trung tâm (`/DASHBOARD`)
- **URL Route**: `/DASHBOARD`
- **Tiêu đề / Breadcrumbs**: Dashboard trung tâm
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối] [Clear]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

#### 2. Trung tâm Báo cáo CE (`/REPORTS`)
- **URL Route**: `/REPORTS`
- **Tiêu đề / Breadcrumbs**: Trung tâm Báo cáo CE
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất PDF, Xuất Excel)
- **Nút thao tác trên màn hình**: [Tìm kiếm] [Tạo] [Xem] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Trạng thái 0
  * Tên báo cáo 0
  * Ngày tạo 0

#### 3. Monitor Matching Engine (`/MONITOR_ME`)
- **URL Route**: `/MONITOR_ME`
- **Tiêu đề / Breadcrumbs**: Monitor Matching Engine
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Tra cứu hợp đồng`, `Tra cứu lệnh`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã hợp đồng`, `Mã hàng hóa`
- **Nút thao tác trên màn hình**: [Tra cứu hợp đồng] [Tra cứu lệnh] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Phiên (tăng dần)] [Sắp xếp theo IsCB (tăng dần)] [Sắp xếp theo Halt (tăng dần)] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Mã hợp đồng 0
  * Mã hàng hóa 0
  * Tên hàng hóa 0
  * Phiên 0
  * Giá trần 0
  * Giá sàn 0
  * Giá tham chiếu 0
  * Bước giá tối thiểu 0
  * Đơn vị giao dịch (lô) 0
  * Loại CB 0
  * IsCB 0
  * Halt 0
  * Ngày phiên hiện tại 0
  * Ngày phiên tiếp theo 0
  * Ngày giao dịch cuối cùng 0

#### 4. Monitor ME Resend Order (`/MONITOR_ME/RESEND_ORDER`)
- **URL Route**: `/MONITOR_ME/RESEND_ORDER`
- **Tiêu đề / Breadcrumbs**: Monitor ME Resend Order
- **Nút Kết xuất (Export)**: ❌ Không

---

###  QUẢN LÝ SỔ LỆNH (10 màn hình)

#### 5. Danh sách lệnh trong phiên (`/ORDERS/ORDERBOOK`)
- **URL Route**: `/ORDERS/ORDERBOOK`
- **Tiêu đề / Breadcrumbs**: Danh sách lệnh trong phiên
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Tất cả`, `Lệnh đã khớp`, `Lệnh chờ khớp`, `Lệnh đã hủy`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã phiên`, `(Từ) Ngày phiên`, `(Đến) Ngày phiên`, `Mã lệnh gốc`, `Mã lệnh của sở`, `Số tài khoản`, `Số tiểu khoản`, `Mã hợp đồng`, `Trạng thái`, `Loại lệnh`, `Sàn giao dịch`
- **Nút thao tác trên màn hình**: [Tất cả] [Lệnh đã khớp] [Lệnh chờ khớp] [Lệnh đã hủy] [Choose date] [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết] [Giải tỏa lệnh] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Mã phiên 0
  * Ngày phiên 0
  * Mã lệnh 0
  * ClorID TVKD 0
  * Mã lệnh của sở 0
  * Số tài khoản 0
  * Số tiểu khoản 0
  * Mã hợp đồng 0
  * Trạng thái 0
  * Mua/Bán 0
  * Loại lệnh 0
  * Khối lượng đặt 0
  * Khối lượng khớp 0
  * Giá đặt 0
  * Giá dừng 0
  * Giá khớp trung bình 0
  * Khối lượng còn lại 0
  * Khối lượng hủy 0
  * Thời gian đặt 0
  * Hiệu lực 0
  * Ngày hiệu lực 0
  * Sàn giao dịch 0
  * Thời gian thực hiện 0
  * Tên TKGD 0
  * Tên hợp đồng 0

#### 6. Danh sách lệnh Market Maker (`/ORDERS/ORDERBOOK_MM`)
- **URL Route**: `/ORDERS/ORDERBOOK_MM`
- **Tiêu đề / Breadcrumbs**: Danh sách lệnh Market Maker
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Sub-tabs**: `Tất cả`, `Lệnh đã khớp`, `Lệnh chờ khớp`, `Lệnh đã hủy`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã phiên`, `(Từ) Ngày phiên`, `(Đến) Ngày phiên`, `Mã lệnh gốc`, `Mã lệnh của sở`, `Số tài khoản`, `Số tiểu khoản`, `Mã hợp đồng`, `Trạng thái`, `Loại lệnh`, `Sàn giao dịch`
- **Nút thao tác trên màn hình**: [Tất cả] [Lệnh đã khớp] [Lệnh chờ khớp] [Lệnh đã hủy] [Choose date] [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết] [Giải tỏa lệnh] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Mã phiên 0
  * Ngày phiên 0
  * Mã lệnh 0
  * ClorID TVKD 0
  * Mã lệnh của sở 0
  * Số tài khoản 0
  * Số tiểu khoản 0
  * Mã hợp đồng 0
  * Trạng thái 0
  * Mua/Bán 0
  * Loại lệnh 0
  * Khối lượng đặt 0
  * Khối lượng khớp 0
  * Giá đặt 0
  * Giá dừng 0
  * Giá khớp trung bình 0
  * Khối lượng còn lại 0
  * Khối lượng hủy 0
  * Thời gian đặt 0
  * Hiệu lực 0
  * Ngày hiệu lực 0
  * Sàn giao dịch 0
  * Thời gian thực hiện 0
  * Tên TKGD 0
  * Tên hợp đồng 0

#### 7. Danh sách lệnh liên thông ACM (`/ORDERS/ORDERBOOK_ACM`)
- **URL Route**: `/ORDERS/ORDERBOOK_ACM`
- **Tiêu đề / Breadcrumbs**: Danh sách lệnh liên thông ACM
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Sub-tabs**: `Tất cả`, `Lệnh đã khớp`, `Lệnh chờ khớp`, `Lệnh đã hủy`
- **Bộ lọc / Tiêu chí tìm kiếm**: `(Từ) Ngày phiên`, `(Đến) Ngày phiên`, `Mã lệnh gốc`, `Mã lệnh liên thông`, `Số tài khoản`, `Số tiểu khoản`, `Mã hợp đồng`, `Trạng thái`, `Loại lệnh`, `Sàn giao dịch`
- **Nút thao tác trên màn hình**: [Tất cả] [Lệnh đã khớp] [Lệnh chờ khớp] [Lệnh đã hủy] [Choose date] [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết] [Giải tỏa lệnh] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Ngày phiên 0
  * ClorID MXV 0
  * Mã lệnh OMS 0
  * ClorID TVKD 0
  * Mã lệnh liên thông 0
  * Số tài khoản 0
  * Số tiểu khoản 0
  * Mã hợp đồng 0
  * Trạng thái 0
  * Mua/Bán 0
  * Loại lệnh 0
  * Khối lượng đặt 0
  * Khối lượng khớp 0
  * Giá đặt 0
  * Giá dừng 0
  * Giá khớp trung bình 0
  * Khối lượng còn lại 0
  * Khối lượng hủy 0
  * Thời gian đặt 0
  * Hiệu lực 0
  * Ngày hiệu lực 0
  * Sàn giao dịch 0
  * Thời gian thực hiện 0
  * Tên TKGD 0
  * Tên hợp đồng 0

#### 8. Lịch sử sổ lệnh liên thông (`/ORDERS/ORDERBOOK_ALL_ACM`)
- **URL Route**: `/ORDERS/ORDERBOOK_ALL_ACM`
- **Tiêu đề / Breadcrumbs**: Lịch sử sổ lệnh liên thông
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `(Từ) Ngày phiên`, `(Đến) Ngày phiên`, `Mã lệnh gốc`, `Mã lệnh liên thông`, `Số tài khoản`, `Số tiểu khoản`, `Mã hợp đồng`, `Trạng thái`, `Loại lệnh`, `Sàn giao dịch`
- **Nút thao tác trên màn hình**: [Clear] [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Ngày phiên 0
  * ClorID MXV 0
  * Mã lệnh OMS 0
  * ClorID TVKD 0
  * Mã lệnh liên thông 0
  * Số tài khoản 0
  * Số tiểu khoản 0
  * Mã hợp đồng 0
  * Trạng thái 0
  * Mua/Bán 0
  * Loại lệnh 0
  * Khối lượng đặt 0
  * Khối lượng khớp 0
  * Giá đặt 0
  * Giá dừng 0
  * Giá khớp trung bình 0
  * Khối lượng còn lại 0
  * Khối lượng hủy 0
  * Thời gian đặt 0
  * Hiệu lực 0
  * Ngày hiệu lực 0
  * Sàn giao dịch 0
  * Thời gian thực hiện 0
  * Tên TKGD 0
  * Tên hợp đồng 0

#### 9. Lịch sử sổ lệnh Market Maker (`/ORDERS/ORDERBOOK_ALL_MM`)
- **URL Route**: `/ORDERS/ORDERBOOK_ALL_MM`
- **Tiêu đề / Breadcrumbs**: Lịch sử sổ lệnh Market Maker
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã phiên`, `(Từ) Ngày phiên`, `(Đến) Ngày phiên`, `Mã lệnh gốc`, `Mã lệnh của sở`, `Số tài khoản`, `Số tiểu khoản`, `Mã hợp đồng`, `Trạng thái`, `Loại lệnh`, `Sàn giao dịch`
- **Nút thao tác trên màn hình**: [Clear] [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Mã phiên 0
  * Ngày phiên 0
  * Mã lệnh 0
  * ClorID TVKD 0
  * Mã lệnh của sở 0
  * Số tài khoản 0
  * Số tiểu khoản 0
  * Mã hợp đồng 0
  * Trạng thái 0
  * Mua/Bán 0
  * Loại lệnh 0
  * Khối lượng đặt 0
  * Khối lượng khớp 0
  * Giá đặt 0
  * Giá dừng 0
  * Giá khớp trung bình 0
  * Khối lượng còn lại 0
  * Khối lượng hủy 0
  * Thời gian đặt 0
  * Hiệu lực 0
  * Ngày hiệu lực 0
  * Sàn giao dịch 0
  * Thời gian thực hiện 0
  * Tên TKGD 0
  * Tên hợp đồng 0

#### 10. Danh sách khớp lệnh liên thông (`/ORDERS/ORDERMATCH_ALL_ACM`)
- **URL Route**: `/ORDERS/ORDERMATCH_ALL_ACM`
- **Tiêu đề / Breadcrumbs**: Danh sách khớp lệnh liên thông
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `(Từ) Ngày phiên`, `(Đến) Ngày phiên`, `Số tài khoản`
- **Nút thao tác trên màn hình**: [Clear] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Ngày phiên 0
  * Mã lệnh OMS 0
  * Mã lệnh liên thông 0
  * Mã giao dịch OMS 0
  * Mã giao dịch liên thông 0
  * Số tài khoản 0
  * Thời gian khớp 0
  * Mã hợp đồng 0
  * Loại lệnh 0
  * Khối lượng khớp 0
  * Giá khớp 0
  * Mua/bán 0
  * Ngày giờ đặt lệnh 0
  * Tên TKGD 0
  * Tên hợp đồng 0

#### 11. Danh sách khớp lệnh Market Maker (`/ORDERS/ORDERMATCH_ALL_MM`)
- **URL Route**: `/ORDERS/ORDERMATCH_ALL_MM`
- **Tiêu đề / Breadcrumbs**: Danh sách khớp lệnh Market Maker
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã phiên`, `(Từ) Ngày phiên`, `(Đến) Ngày phiên`, `Số tài khoản bên mua`, `Số tài khoản bên bán`
- **Nút thao tác trên màn hình**: [Clear] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Mã phiên 0
  * Ngày phiên 0
  * SHL bên mua 0
  * Mã giao dịch mua 0
  * Số tài khoản bên mua 0
  * SHL bên bán 0
  * Mã giao dịch bán 0
  * Số tài khoản bên bán 0
  * Thời gian khớp 0
  * Mã hợp đồng 0
  * Loại lệnh bên mua 0
  * Loại lệnh bên bán 0
  * Khối lượng khớp 0
  * Giá khớp 0
  * Ngày giờ đặt lệnh mua 0
  * Ngày giờ đặt lệnh bán 0
  * Tên TKGD bên mua 0
  * Tên TKGD bên bán 0
  * Tên hợp đồng 0

#### 12. Lịch sử khớp lệnh liên thông chi tiết (`/ORDERS/ORDERMATCH_DETAIL_ACM`)
- **URL Route**: `/ORDERS/ORDERMATCH_DETAIL_ACM`
- **Tiêu đề / Breadcrumbs**: Lịch sử khớp lệnh liên thông chi tiết
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Bộ lọc / Tiêu chí tìm kiếm**: `(Từ) Ngày phiên`, `(Đến) Ngày phiên`, `Số tài khoản`
- **Nút thao tác trên màn hình**: [Clear] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Hủy kết quả giao dịch] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Ngày phiên 0
  * Mã lệnh OMS 0
  * Mã lệnh liên thông 0
  * Mã giao dịch OMS 0
  * Mã giao dịch liên thông 0
  * Số tài khoản 0
  * Thời gian khớp 0
  * Mã hợp đồng 0
  * Loại lệnh 0
  * Khối lượng khớp 0
  * Giá khớp 0
  * Mua/bán 0
  * Ngày giờ đặt lệnh 0
  * Tên TKGD 0
  * Tên hợp đồng 0

#### 13. Lịch sử khớp lệnh MM chi tiết (`/ORDERS/ORDERMATCH_DETAIL_MM`)
- **URL Route**: `/ORDERS/ORDERMATCH_DETAIL_MM`
- **Tiêu đề / Breadcrumbs**: Lịch sử khớp lệnh MM chi tiết
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã phiên`, `(Từ) Ngày phiên`, `(Đến) Ngày phiên`, `Số tài khoản bên mua`, `Số tài khoản bên bán`
- **Nút thao tác trên màn hình**: [Clear] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Mã phiên 0
  * Ngày phiên 0
  * Mã lệnh bên mua 0
  * Mã giao dịch mua 0
  * Số tài khoản bên mua 0
  * Mã lệnh bên bán 0
  * Mã giao dịch bán 0
  * Số tài khoản bên bán 0
  * Thời gian khớp 0
  * Mã hợp đồng 0
  * Loại lệnh bên mua 0
  * Loại lệnh bên bán 0
  * Khối lượng khớp 0
  * Giá khớp 0
  * Ngày giờ đặt lệnh mua 0
  * Ngày giờ đặt lệnh bán 0
  * Tên TKGD bên mua 0
  * Tên TKGD bên bán 0
  * Tên hợp đồng 0

#### 14. Báo cáo phân hệ sổ lệnh (`/ORDERS/REPORTS`)
- **URL Route**: `/ORDERS/REPORTS`
- **Tiêu đề / Breadcrumbs**: Báo cáo phân hệ sổ lệnh
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối] [Clear]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

---

###  QUẢN LÝ SẢN PHẨM (3 màn hình)

#### 15. Quản lý hàng hóa, hợp đồng (`/PRODUCT/COMMODITY`)
- **URL Route**: `/PRODUCT/COMMODITY`
- **Tiêu đề / Breadcrumbs**: Quản lý hàng hóa, hợp đồng
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã hàng hóa`, `Nhóm hàng hóa`, `Tên hàng hóa tiếng Việt`, `Tên hàng hóa tiếng Anh`
- **Nút thao tác trên màn hình**: [Mở] [Tìm kiếm] [Kết xuất] [Thêm mới] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Xem] [Sửa] [Xóa] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Trạng thái 0
  * Mã hàng hóa 0
  * Nhóm hàng hóa 0
  * Loại công cụ 0
  * Tên hàng hóa tiếng Việt 0
  * Tên hàng hóa tiếng Anh 0
  * Sở giao dịch 0
  * Độ lớn hợp đồng 0
  * Đơn vị đo lường 0
  * Đơn vị yết giá 0
  * Tick giá thay đổi 0
  * Đơn vị giao dịch(lô/lot) 0
  * Khối lượng tối thiểu 0
  * Khối lượng tối đa 1 lệnh 0
  * Biên độ được phép giao dịch trong ngày 0
  * Bước giá tối thiểu 0
  * Tỷ lệ điều chỉnh giá khi CB 0
  * Số phút ngừng trong CB 0
  * Giá biên độ chặn dưới 0
  * Tiền tệ 0
  * Trạng thái duyệt 0
  * Ngày tạo 0
  * Ngày duyệt 0

#### 16. Quản lý hàng hóa liên thông (ACM) (`/PRODUCT/COMMODITY_ACM`)
- **URL Route**: `/PRODUCT/COMMODITY_ACM`
- **Tiêu đề / Breadcrumbs**: Quản lý hàng hóa liên thông (ACM)
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã hàng hóa`, `Tên hàng hóa tiếng Việt`, `Mã hàng hóa từ sở`, `Tên hàng hóa tiếng Anh`, `Nhóm hàng hóa`
- **Nút thao tác trên màn hình**: [Mở] [Tìm kiếm] [Kết xuất] [Thêm mới] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Xem] [Sửa] [Xóa] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Trạng thái 0
  * Mã hàng hóa 0
  * Tên hàng hóa tiếng Việt 0
  * Mã hàng hóa từ sở 0
  * Tên hàng hóa tiếng Anh 0
  * Nhóm hàng hóa 0
  * Loại công cụ 0
  * Sở giao dịch 0
  * Độ lớn hợp đồng 0
  * Đơn vị đo lường 0
  * Đơn vị yết giá 0
  * Tick giá thay đổi 0
  * Đơn vị giao dịch(lô/lot) 0
  * Khối lượng tối thiểu 0
  * Tiền tệ 0
  * Trạng thái duyệt 0
  * Ngày tạo 0
  * Ngày duyệt 0

#### 17. Báo cáo phân hệ sản phẩm (`/PRODUCT/REPORTS`)
- **URL Route**: `/PRODUCT/REPORTS`
- **Tiêu đề / Breadcrumbs**: Báo cáo phân hệ sản phẩm
- **Nút Kết xuất (Export)**: ❌ Không

---

###  QUẢN LÝ PHIÊN GIAO DỊCH (5 màn hình)

#### 18. Cấu hình phiên giao dịch (`/SESSIONMNG/TRADING_SESSION`)
- **URL Route**: `/SESSIONMNG/TRADING_SESSION`
- **Tiêu đề / Breadcrumbs**: Cấu hình phiên giao dịch
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Hàng hóa`, `Trạng thái`
- **Nút thao tác trên màn hình**: [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Halt (tăng dần)] [Kích hoạt] [Điều chỉnh] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Ngày phiên 0
  * Ngày kích hoạt phiên 0
  * Mã Phiên 0
  * Số thứ tự phiên 0
  * Loại phiên 0
  * Giờ bắt đầu 0
  * Giờ kết thúc 0
  * Hàng hóa 0
  * Trạng thái 0
  * Halt 0
  * Người tạo 0
  * Người duyệt 0

#### 19. Danh sách cấu hình phiên (`/SESSIONMNG/SESSION_CONFIG_ALL`)
- **URL Route**: `/SESSIONMNG/SESSION_CONFIG_ALL`
- **Tiêu đề / Breadcrumbs**: Danh sách cấu hình phiên
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Hàng hóa`, `Tên phiên`, `Trạng thái`
- **Nút thao tác trên màn hình**: [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Hàng hóa 0
  * Tên phiên 0
  * Số thứ tự phiên 0
  * Ngày áp dụng 0
  * Loại phiên 0
  * Giờ bắt đầu 0
  * Giờ kết thúc 0
  * Loại lệnh cho phép 0
  * Hiệu lực lệnh 0
  * Quy tắc hủy/sửa lệnh 0
  * Thuật toán khớp lệnh 0
  * Trạng thái duyệt 0
  * Ngày tạo 0
  * Ngày duyệt 0
  * Trạng thái 0

#### 20. Thông tin phiên trong ngày (`/SESSIONMNG/SESSION_INFO`)
- **URL Route**: `/SESSIONMNG/SESSION_INFO`
- **Tiêu đề / Breadcrumbs**: Thông tin phiên trong ngày
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Hàng hóa`, `Tên cấu hình`, `Trạng thái`
- **Nút thao tác trên màn hình**: [Mở] [Tìm kiếm] [Kết xuất] [Thêm mới] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Xem] [Sửa] [Xóa] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Hàng hóa 0
  * Tên cấu hình 0
  * Ngày hiệu lực 0
  * Ngày hết hiệu lực 0
  * Circuit Breaker (%) 0
  * Trạng thái 0
  * Trạng thái duyệt 0
  * Ngày tạo 0
  * Ngày duyệt 0
  * Người tạo 0
  * Người duyệt 0

#### 21. Lịch sử phiên giao dịch quá khứ (`/SESSIONMNG/TRADING_SESSION_HIST`)
- **URL Route**: `/SESSIONMNG/TRADING_SESSION_HIST`
- **Tiêu đề / Breadcrumbs**: Lịch sử phiên giao dịch quá khứ
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Ngày phiên`, `Hàng hóa`
- **Nút thao tác trên màn hình**: [Choose date] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Halt (tăng dần)] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Ngày phiên 0
  * Ngày kích hoạt phiên 0
  * Mã Phiên 0
  * Số thứ tự phiên 0
  * Loại phiên 0
  * Giờ bắt đầu 0
  * Giờ kết thúc 0
  * Hàng hóa 0
  * Trạng thái 0
  * Halt 0
  * Người tạo 0
  * Người duyệt 0

#### 22. Báo cáo phiên giao dịch (`/SESSIONMNG/REPORTS`)
- **URL Route**: `/SESSIONMNG/REPORTS`
- **Tiêu đề / Breadcrumbs**: Báo cáo phiên giao dịch
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

---

###  QUẢN LÝ TÀI KHOẢN (4 màn hình)

#### 23. Quản lý khách hàng (`/ACCOUNTMNG/CUSTOMERS`)
- **URL Route**: `/ACCOUNTMNG/CUSTOMERS`
- **Tiêu đề / Breadcrumbs**: Quản lý khách hàng
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Tên thành viên`, `Mã khách hàng`, `Số điện thoại`, `Số giấy tờ`
- **Nút thao tác trên màn hình**: [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Email (tăng dần)] [Xem] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Mã thành viên 0
  * Tên thành viên 0
  * Mã khách hàng 0
  * Tên khách hàng 0
  * Ngày sinh 0
  * Mã số thuế 0
  * Loại hình 0
  * Địa chỉ 0
  * Số điện thoại 0
  * Email 0
  * Loại giấy tờ 0
  * Số giấy tờ 0
  * Ngày cấp 0
  * Nơi cấp 0
  * Trạng thái tài khoản 0
  * Ngày mở 0
  * Ngày đóng 0
  * Số CIF khách hàng 0

#### 24. Quản lý khách hàng (đầy đủ) (`/ACCOUNTMNG/CUSTOMERS_PUBLIC`)
- **URL Route**: `/ACCOUNTMNG/CUSTOMERS_PUBLIC`
- **Tiêu đề / Breadcrumbs**: Quản lý khách hàng (đầy đủ)
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Tên thành viên`, `Mã khách hàng`, `Số điện thoại`, `Số giấy tờ`
- **Nút thao tác trên màn hình**: [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Email (tăng dần)] [Xem] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Mã thành viên 0
  * Tên thành viên 0
  * Mã khách hàng 0
  * Tên khách hàng 0
  * Ngày sinh 0
  * Mã số thuế 0
  * Loại hình 0
  * Địa chỉ 0
  * Số điện thoại 0
  * Email 0
  * Loại giấy tờ 0
  * Số giấy tờ 0
  * Ngày cấp 0
  * Nơi cấp 0
  * Trạng thái tài khoản 0
  * Ngày mở 0
  * Ngày đóng 0
  * Số CIF khách hàng 0

#### 25. Danh sách tài khoản giao dịch (`/ACCOUNTMNG/ACCOUNTS_INFO`)
- **URL Route**: `/ACCOUNTMNG/ACCOUNTS_INFO`
- **Tiêu đề / Breadcrumbs**: Danh sách tài khoản giao dịch
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã khách hàng`, `Số TKGD`
- **Nút thao tác trên màn hình**: [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Mã khách hàng 0
  * Số TKGD 0
  * Tên khách hàng 0
  * Mã thành viên 0
  * Tên thành viên 0
  * Loại tiểu khoản 0
  * Trạng thái tiểu khoản 0
  * Ngày mở 0
  * Ngày đóng 0
  * Loại hình 0
  * Rổ ký quỹ 0
  * Rổ hạn mức 0
  * Biểu phí 0
  * Tỷ lệ an toàn 0
  * Tỷ lệ cảnh báo 0
  * Tỷ lệ xử lý 0

#### 26. Yêu cầu mở tài khoản (`/ACCOUNTMNG/OPENACCREQ`)
- **URL Route**: `/ACCOUNTMNG/OPENACCREQ`
- **Tiêu đề / Breadcrumbs**: Yêu cầu mở tài khoản
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

---

###  QUẢN LÝ THÀNH VIÊN (3 màn hình)

#### 27. Thông tin thành viên (`/MEMBERSMNG/MEMBERS`)
- **URL Route**: `/MEMBERSMNG/MEMBERS`
- **Tiêu đề / Breadcrumbs**: Thông tin thành viên
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Mã thành viên`, `Tên thành viên`
- **Nút thao tác trên màn hình**: [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Email (tăng dần)] [Sắp xếp theo Fax (giảm dần)] [Xem] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Trạng thái 0
  * Mã thành viên 0
  * Tên thành viên 0
  * Tên doanh nghiệp 0
  * Mã số thuế 0
  * Email 0
  * Địa chỉ 0
  * Số điện thoại 0
  * Fax 0
  * Người tạo 0
  * Người duyệt 0
  * Trạng thái duyệt 0

#### 28. Thành viên ngừng hoạt động (`/MEMBERSMNG/MEMBERSEND`)
- **URL Route**: `/MEMBERSMNG/MEMBERSEND`
- **Tiêu đề / Breadcrumbs**: Thành viên ngừng hoạt động
- **Nút Kết xuất (Export)**: ❌ Không

#### 29. Báo cáo thành viên (`/MEMBERSMNG/REPORTS`)
- **URL Route**: `/MEMBERSMNG/REPORTS`
- **Tiêu đề / Breadcrumbs**: Báo cáo thành viên
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối] [Clear]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

---

###  QUẢN LÝ FCM (1 màn hình)

#### 30. Khai báo FCM (`/FCMMNG/FCM_INFORMATION`)
- **URL Route**: `/FCMMNG/FCM_INFORMATION`
- **Tiêu đề / Breadcrumbs**: Khai báo FCM
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã FCM`
- **Nút thao tác trên màn hình**: [Tìm kiếm] [Kết xuất] [Thêm mới] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Xem] [Sửa] [Xóa] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Mã FCM 0
  * Tên FCM 0
  * Tài khoản Omnibus 0
  * Tài khoản Omnibus dùng cho báo cáo offset 0
  * Trạng thái 0
  * Trạng thái duyệt 0
  * Ngày tạo 0
  * Ngày duyệt 0
  * Người tạo 0
  * Người duyệt 0

---

###  QUẢN LÝ VẬN HÀNH (6 màn hình)

#### 31. SOD Quy trình đầu ngày (`/EOD/SODPROCESS`)
- **URL Route**: `/EOD/SODPROCESS`
- **Tiêu đề / Breadcrumbs**: SOD Quy trình đầu ngày
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

#### 32. EOD Quy trình cuối ngày (`/EODEXCHANGE/EODPROCESS`)
- **URL Route**: `/EODEXCHANGE/EODPROCESS`
- **Tiêu đề / Breadcrumbs**: EOD Quy trình cuối ngày
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

#### 33. Đối chiếu dữ liệu liên thông CSV (`/EOD/COMPARECSV`)
- **URL Route**: `/EOD/COMPARECSV`
- **Tiêu đề / Breadcrumbs**: Đối chiếu dữ liệu liên thông CSV
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

#### 34. Đối chiếu lệnh liên thông (`/EOD/ACM_RECON_ORDERS`)
- **URL Route**: `/EOD/ACM_RECON_ORDERS`
- **Tiêu đề / Breadcrumbs**: Đối chiếu lệnh liên thông
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Đối chiếu lệnh đặt liên thông`, `Đối chiếu lệnh khớp liên thông`, `Lịch sử đối chiếu lệnh đặt liên thông`, `Lịch sử đối chiếu lệnh khớp liên thông`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mã lệnh`, `Mã lệnh Sở LT`, `Hợp đồng`, `Tài khoản`, `Chiều`, `Loại lệnh`, `Trạng thái đối chiếu`, `Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Đối chiếu lệnh đặt liên thông] [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Chiều (tăng dần)] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Trạng thái 0
  * Mã lệnh 0
  * Mã lệnh Sở LT 0
  * Hợp đồng 0
  * Tài khoản 0
  * Chiều 0
  * Loại lệnh 0
  * Giá đặt 0
  * Giá dừng 0
  * KL đặt 0
  * KL đặt Sở LT 0
  * KL chờ khớp 0
  * KL chờ khớp LT 0
  * KL khớp 0
  * KL khớp Sở LT 0
  * KL hủy 0
  * KL hủy Sở LT 0

#### 35. Truy vấn dữ liệu liên thông ACM (`/EOD/ACM_SYNC_REQUEST_LOG`)
- **URL Route**: `/EOD/ACM_SYNC_REQUEST_LOG`
- **Tiêu đề / Breadcrumbs**: Truy vấn dữ liệu liên thông ACM
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Lịch sử truy vấn liên thông`, `Tra cứu lệnh đặt liên thông`, `Tra cứu lệnh khớp liên thông`, `Tra cứu vị thế liên thông`, `Truy vấn hàng hóa liên thông`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Ngày phiên`, `Giờ truy vấn`, `Loại nghiệp vụ`, `Trạng thái`, `Hình thức`, `Người truy vấn`
- **Nút thao tác trên màn hình**: [Lịch sử truy vấn liên thông] [Tra cứu lệnh đặt liên thông] [Tra cứu lệnh khớp liên thông] [Tra cứu vị thế liên thông] [Truy vấn hàng hóa liên thông] [Choose date] [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Xem chi tiết] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Ngày phiên 0
  * Giờ truy vấn 0
  * Loại nghiệp vụ 0
  * Số bản ghi 0
  * Trạng thái 0
  * Hình thức 0
  * Người truy vấn 0

#### 36. Đối chiếu lệnh Active (`/EOD/COMPARE_ORDER_ACTIVE`)
- **URL Route**: `/EOD/COMPARE_ORDER_ACTIVE`
- **Tiêu đề / Breadcrumbs**: Đối chiếu lệnh Active
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

---

###  QUẢN LÝ THAM SỐ (9 màn hình)

#### 37. Lịch làm việc / Ngày nghỉ (`/SYSCONFIGMNG/CALENDAR`)
- **URL Route**: `/SYSCONFIGMNG/CALENDAR`
- **Tiêu đề / Breadcrumbs**: Lịch làm việc / Ngày nghỉ
- **Nút Kết xuất (Export)**: ❌ Không
- **Bộ lọc / Tiêu chí tìm kiếm**: `Loại hàng hóa`
- **Nút thao tác trên màn hình**: [Mở] [Thêm năm]

#### 38. Tham số hệ thống (`/SYSCONFIGMNG/SYSCONFIG`)
- **URL Route**: `/SYSCONFIGMNG/SYSCONFIG`
- **Tiêu đề / Breadcrumbs**: Tham số hệ thống
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Tên tham số`, `Giá trị`, `Mô tả`
- **Nút thao tác trên màn hình**: [Tìm kiếm] [Kết xuất] [Thêm mới] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Mô tả (tăng dần)] [Xem] [Sửa] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác
  * Tên tham số 0
  * Giá trị 0
  * Mô tả 0
  * Trạng thái duyệt 0
  * Trạng thái 0

#### 39. Cấu hình Noti / SMS / Email (`/SYSCONFIGMNG/NOTIFICATION`)
- **URL Route**: `/SYSCONFIGMNG/NOTIFICATION`
- **Tiêu đề / Breadcrumbs**: Cấu hình Noti / SMS / Email
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Mô tả`, `Loại`
- **Nút thao tác trên màn hình**: [Mở] [Tìm kiếm] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Loại (tăng dần)] [Sắp xếp theo Mã (tăng dần)] [Sắp xếp theo Mô tả (tăng dần)] [Cấu hình] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * On/Off 0
  * Thao tác 0
  * Loại 0
  * Mã 0
  * Loại noti 0
  * Mô tả 0
  * Người thay đổi 0
  * Ngày thay đổi 0

#### 40. Tỷ giá tiền tệ (`/SYSCONFIGMNG/CURRENCYEXCHANGERATE`)
- **URL Route**: `/SYSCONFIGMNG/CURRENCYEXCHANGERATE`
- **Tiêu đề / Breadcrumbs**: Tỷ giá tiền tệ
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

#### 41. Phân khúc giao dịch (`/TRANSPARAMMNG/TRADESEGMENTS`)
- **URL Route**: `/TRANSPARAMMNG/TRADESEGMENTS`
- **Tiêu đề / Breadcrumbs**: Phân khúc giao dịch
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

#### 42. Biểu phí giao dịch (`/TRANSPARAMMNG/FEETYPE`)
- **URL Route**: `/TRANSPARAMMNG/FEETYPE`
- **Tiêu đề / Breadcrumbs**: Biểu phí giao dịch
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

#### 43. Rổ ký quỹ ban đầu (`/TRANSPARAMMNG/IMBASKETS`)
- **URL Route**: `/TRANSPARAMMNG/IMBASKETS`
- **Tiêu đề / Breadcrumbs**: Rổ ký quỹ ban đầu
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

#### 44. Rổ hạn mức vị thế (`/TRANSPARAMMNG/POSLIMITBASKETS`)
- **URL Route**: `/TRANSPARAMMNG/POSLIMITBASKETS`
- **Tiêu đề / Breadcrumbs**: Rổ hạn mức vị thế
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

#### 45. Tài khoản mặc định (`/TRANSPARAMMNG/DEFACCOUNTS`)
- **URL Route**: `/TRANSPARAMMNG/DEFACCOUNTS`
- **Tiêu đề / Breadcrumbs**: Tài khoản mặc định
- **Nút Kết xuất (Export)**:  **CÓ** (Kết xuất)
- **Sub-tabs**: `Thống kê giao dịch trong ngày`, `Thông tin phiên giao dịch trong ngày`, `Giao dịch trong ngày`, `Giao dịch quá khứ`
- **Bộ lọc / Tiêu chí tìm kiếm**: `Trạng thái`, `Ngày giao dịch`, `Tên nghiệp vụ`, `Người tạo`, `Số chứng từ`, `(Từ) Ngày giao dịch`, `(Đến) Ngày giao dịch`
- **Nút thao tác trên màn hình**: [Mở] [Choose date] [Tìm kiếm] [Duyệt] [Từ chối] [Kết xuất] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Chi tiết duyệt] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * ID
  * Số thứ tự phiên
  * Loại phiên
  * Mã Phiên
  * Giờ bắt đầu
  * Giờ kết thúc
  * Hàng hóa
  * Trạng thái
  * Trạng thái 0
  * Ngày giao dịch 0
  * Giờ giao dịch 0
  * Tên nghiệp vụ 0
  * Người tạo 0
  * Người duyệt 0
  * Ngày duyệt 0
  * Giờ duyệt 0
  * Số tài khoản 0
  * Số tiền 0
  * Số chứng từ 0
  * Trạng thái0
  * Ngày giao dịch0
  * Giờ giao dịch0
  * Tên nghiệp vụ0
  * Người tạo0
  * Người duyệt0
  * Ngày duyệt0
  * Giờ duyệt0
  * Số tài khoản0
  * Số tiền0
  * Số chứng từ0

---

###  QUẢN LÝ NGƯỜI DÙNG (2 màn hình)

#### 46. Quản lý nhóm quyền (`/USERMNG/TLGROUPS`)
- **URL Route**: `/USERMNG/TLGROUPS`
- **Tiêu đề / Breadcrumbs**: Quản lý nhóm quyền
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Tên nhóm quyền`
- **Nút thao tác trên màn hình**: [Tìm kiếm] [Kết xuất] [Thêm mới] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Mô tả (tăng dần)] [Gán NSD] [Phân quyền] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác 0
  * Phân quyền 0
  * Tên nhóm quyền 0
  * Mã nhóm 0
  * Trạng thái 0
  * Mô tả 0

#### 47. Người sử dụng (`/USERMNG/TLPROFILES`)
- **URL Route**: `/USERMNG/TLPROFILES`
- **Tiêu đề / Breadcrumbs**: Người sử dụng
- **Nút Kết xuất (Export)**:  **CÓ** (Xuất trang hiện tại, Xuất tất cả)
- **Bộ lọc / Tiêu chí tìm kiếm**: `Họ và tên`, `Trạng thái`
- **Nút thao tác trên màn hình**: [Mở] [Tìm kiếm] [Kết xuất] [Thêm mới] [Ẩn/hiện bộ lọc] [Ẩn/hiện cột] [Di chuyển] [Lựa chọn] [Sắp xếp theo Email (tăng dần)] [Phân quyền] [Resetpass] [Tới trang đầu] [Tới trang trước] [Tới trang tiếp theo] [Tới trang cuối]
- **Các cột dữ liệu của bảng**: 
  * Thao tác 0
  * Phân quyền 0
  * Tên đăng nhập 0
  * Họ và tên 0
  * Số CMT 0
  * Số điện thoại 0
  * Email 0
  * Phòng ban 0
  * Chức danh 0
  * Trạng thái 0
  * Ghi chú 0
  * Mật khẩu 0

---

