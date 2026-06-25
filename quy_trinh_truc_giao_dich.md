# Quy Trình Trực Giao Dịch (Theo Timeline & Nghiệp Vụ Phát Sinh)

Tài liệu này hệ thống hóa toàn bộ quy trình trực ca giao dịch và các bước xử lý sự cố phát sinh của phòng vận hành.

---

## 1. Quy Trình Vận Hành Theo Timeline Phiên Giao Dịch (T)

| Giai đoạn | Mốc Thời Gian | Tác vụ chính | Nội dung thực hiện chi tiết |
| :--- | :--- | :--- | :--- |
| **Đầu phiên** | **05h00** | Kiểm tra Job Snapshot | Kiểm tra email kết quả "Job Snapshot". Nếu không thành công, phối hợp với Newgen xử lý kết chuyển dữ liệu. |
| | **05h00** | Kiểm tra EOD OMS, lệnh MM OMS | Kiểm tra kết quả EOD của CCP / CE. Kiểm tra lệnh Market Maker (MM) đã lên CCP / CE hay chưa. |
| | **06h00 - 07h00** | Đối chiếu & Chạy EOD MS | Kiểm tra đối chiếu dữ liệu phiên T-1 giữa M-System, CQG và ACM; kiểm tra giá thanh toán; thực hiện chạy EOD thủ công. |
| | **Sau EOD thành công** | Xử lý sau EOD | Backup file kết quả EOD; kiểm tra EOD và thông báo các tài khoản bị âm ký quỹ đầu ngày. Nếu lỗi, phối hợp Newgen chỉnh sửa và chạy lại. |
| | **Sau EOD (trong 30p)** | Thực hiện SOD | Cập nhật Start of Day (SOD) cho hệ thống M-System. Nếu lỗi, phối hợp Newgen chỉnh sửa và chạy lại. |
| | **01 - 02 giờ sau EOD** | Đồng bộ CQG (Sync CQG) | Kiểm tra việc reset dữ liệu trên CQG; sau khi reset xong, thực hiện đồng bộ số dư (Sync CQG) thủ công lên CQG Cast. |
| | **Sau EOD (trước 08h00)**| Gửi Sao kê TKGD thủ công | Gửi email Sao kê tài khoản giao dịch (TKGD) thủ công cho khách hàng/thành viên. |
| **Trong phiên** | **08h00** | Thay đổi ký quỹ hàng hoá | Nếu có Quyết định thay đổi ký quỹ có hiệu lực từ phiên T, người trực ca 1 thực hiện tạo bản ghi thay đổi, người trực ca 2 duyệt bản ghi (chỉ thực hiện khi có mặt Trưởng bộ phận). |
| | **Định kỳ 01 giờ / lần**| Giám sát & Đối chiếu | Kiểm tra tính cân bằng dữ liệu giữa M-System và CQG. Xử lý các lỗi lệch do thiết lập tham số hoặc mất kết nối API. |
| | **Định kỳ 01 tháng / lần**| Mở mới hợp đồng giao dịch | Thực hiện mở mới hợp đồng Futures, Spreads, ACM. *Lưu ý: Mở tối đa 1 năm tính từ thời điểm hiện tại.* |
| | **Khi có yêu cầu phát sinh**| Hỗ trợ & Xử lý sự cố | Tiếp nhận thắc mắc của TVKD; thông báo lỗi hệ thống; sửa lỗi giao dịch; gán hàng hóa (mặt hàng có điều kiện/API); đình chỉ TVKD. |
| | **Theo mốc đáo hạn** | Giám sát tất toán hợp đồng | Gửi thông báo thời hạn tất toán hợp đồng; thực hiện hủy lệnh chờ và đóng vị thế bắt buộc nếu TVKD không tự thực hiện đúng hạn. |
| | **16h00; 23h00; 05h00** | Báo cáo Ban giám sát | Thống kê các dữ liệu giao dịch trong phiên: Danh sách giao dịch (DSGD), Trạng thái mở (TTM)... gửi Ban giám sát qua nhóm Whatsapp. |
| **Cuối phiên (T)**| **04h00 - 05h00** | Backup dữ liệu | Sao lưu toàn bộ dữ liệu giao dịch, lệnh, trạng thái, ký quỹ, nộp rút tiền... trên M-System, CQG, ACM, CE / CCP. (Ưu tiên CE và ACM backup trước). Tổng hợp dữ liệu thành các báo cáo theo mẫu. |

---

## 2. Kịch Bản Xử Lý Sự Cố & Nghiệp Vụ Phát Sinh Trong Phiên

### 1. Trường hợp: EOD / SOD Gặp Lỗi
| Mốc thời hạn thực hiện | Nội dung thực hiện chi tiết |
| :--- | :--- |
| **Nếu quá trình xử lý kéo dài quá 07h30** | Thông báo lùi thời gian EOD và gửi Sao kê cho Thành viên Kinh doanh (TVKD). |
| **Trong vòng 05 phút sau khi EOD thành công** | Gửi email thông báo kết quả sau khi chạy lại EOD thành công. |
| **Trong vòng 30 phút sau khi EOD được xác nhận chính xác** | Thao tác gửi email Sao kê tài khoản giao dịch (TKGD) thủ công cho Khách hàng. |

### 2. Trường hợp: Có Lỗi / Sự Cố Hệ Thống
*(Mất kết nối, lỗi phần mềm M-System, CQG, ACM, CE...)*
| Mốc thời hạn thực hiện | Nội dung thực hiện chi tiết |
| :--- | :--- |
| **Trong vòng 05 phút kể từ khi phát hiện lỗi** | Thông báo lỗi/sự cố hệ thống cho Newgen và Khối Công nghệ thông tin (CNTT). |
| **Trong vòng 10 phút kể từ khi phát hiện lỗi** | Gửi email thông báo sự cố cho các Đơn vị nghiệp vụ (ĐVNV) và Thành viên Kinh doanh (TVKD). |
| **Ngay sau khi hoàn tất kiểm tra hệ thống** | Thông báo lỗi/sự cố đã được khắc phục sau khi kiểm tra dữ liệu chính xác giữa các nền tảng. |
| **Sau khi hoàn thành xử lý sự cố trong phiên** | Cập nhật vào **Báo cáo ghi nhận lỗi giao dịch (Mẫu số: 01/QT/TVH)**. |

### 3. Trường hợp: Lệnh / Giao Dịch Giữa Các Nền Tảng Không Cân
| Mốc thời hạn thực hiện | Nội dung thực hiện chi tiết |
| :--- | :--- |
| **Trong vòng 30 phút kể từ khi đối chiếu phát hiện lệch** | Xác định nguyên nhân và các tài khoản bị lệch giao dịch. |
| **Sau khi tìm ra nguyên nhân lệch giao dịch** | 1. Thông báo cho TVKD (qua room Hỗ trợ nghiệp vụ giao dịch) thực hiện thiết lập bổ sung các tham số còn thiếu của TKGD.<br>2. Báo cho Newgen kéo lệnh còn thiếu về M-System. |

### 4. Trường hợp: Tiếp Nhận Thông Tin Từ Thành Viên Kinh Doanh (TVKD)
| Mốc thời hạn thực hiện | Nội dung thực hiện chi tiết |
| :--- | :--- |
| **Trong vòng 15 phút kể từ khi tiếp nhận** | Tiếp nhận và tìm hiểu nguyên nhân khiếu nại / thắc mắc của TVKD qua các kênh liên lạc (Teams/Email). |
