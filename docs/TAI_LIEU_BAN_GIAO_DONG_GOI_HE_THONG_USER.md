# TÀI LIỆU BÀN GIAO & HƯỚNG DẪN VẬN HÀNH HỆ THỐNG ĐỐI SOÁT & THỐNG KÊ (TRADING MANAGER)

> **Dành cho**: Đội ngũ Trực ca Vận hành Giao dịch & Quản trị Hệ thống MXV  
> **Môi trường triển khai**: Ubuntu Server (`10.0.0.26`)  
> **Địa chỉ truy cập Web**: `http://10.0.0.26:3000/trading-manager`  
> **Phiên bản đóng gói**: Bản cập nhật tách biệt tỷ giá & đa nguyên tệ động CoreCCP (23/09/2026)

---

## 1. MÀN HÌNH CẤU HÌNH HỆ THỐNG & TỶ GIÁ (TAB CẤU HÌNH)

Màn hình này quản lý toàn bộ các thông số vận hành mà trước đây phải can thiệp vào code C# hoặc file cấu hình tĩnh.

### Các tính năng chính:

1. **Thẻ Tỷ giá M-System (MXV)**:
   - **Mục đích**: Phục vụ đối soát khớp lệnh trong phiên và đối chiếu EOD ca trực M-System / CQG.
   - **Các ô nhập**: Tỷ giá thanh toán (Bán / Mua) và Tỷ giá quy đổi (USD/VND). Mặc định 26,100.
   - **Nút "Đồng bộ từ M-System"**: Bot tự đăng nhập M-System cào tỷ giá ngày mới nhất.
   - **Điểm quan trọng**: Tỷ giá này **hoàn toàn độc lập**, không bao giờ bị ghi đè khi làm việc với CoreCCP.

2. **Thẻ Ma trận Tỷ giá Đa nguyên tệ CoreCCP (VNCLEAR)**:
   - **Mục đích**: Phục vụ thống kê Lot, thống kê Giá trị giao dịch và đối soát tài khoản ký quỹ VNCLEAR.
   - **Bảng ma trận trực quan**:
     - Hiển thị các đồng tiền đang áp dụng (`USD`, `JPY`, `MYR`, `RMB`...).
     - Có đủ 3 cột theo chuẩn màn hình CoreCCP: **Tỷ giá Quy đổi**, **Tỷ giá Mua**, **Tỷ giá Bán**.
     - Cho phép click vào từng ô để sửa số trực tiếp khi thị trường biến động.
   - **Nút "+ Thêm nguyên tệ"**:
     - Khi phát sinh sản phẩm niêm yết bằng đồng tiền mới (như `EUR`, `SGD`, `CAD`...), trực ca chỉ cần nhập mã và tỷ giá rồi bấm thêm.
     - Hệ thống tự nhận diện và tính toán ngay lập tức trong 5 giây, không cần nhờ IT sửa code hay restart server.
   - **Nút "Đồng bộ từ CoreCCP"**: Tự động bóc tách tỷ giá từ file ngày TTTT/TTM của CoreCCP.

3. **Cấu hình phiên giao dịch**:
   - Khung giờ Bắt đầu và Kết thúc phiên (ví dụ: `05:00` - `05:00`).
   - Dùng để tự động loại trừ các lệnh xuyên đêm T-1 khi đối chiếu khớp lệnh.

4. **Hai bảng nghiệp vụ chuyên sâu**:
   - **Bảng Danh sách TKGD âm ký quỹ cần giám sát**: Thêm/bớt mã tài khoản trực tiếp trên giao diện để bot tự động quét và gửi cảnh báo khi âm IMR.
   - **Bảng Lịch nghỉ lễ LME**: Cấu hình các ngày sàn LME nghỉ để bot tự động trượt ngày lấy file đối chiếu thay thế.

5. **Hệ thống 12 Đường dẫn Thư mục (Paths)**:
   - Khai báo các thư mục chứa dữ liệu M-System, CQG, ACM, CCP, file Macro.
   - Mỗi ô đường dẫn đều có nút **Kiểm tra** để báo ngay đường dẫn có tồn tại và ghi được file hay không.

> **Thao tác lưu**: Sau khi chỉnh sửa bất kỳ thông số nào, bấm nút **Lưu Cấu Hình** ở góc trên bên phải để áp dụng ngay lập tức cho toàn bộ các Robot.

---

## 2. MÀN HÌNH ĐỐI SOÁT KHỚP LỆNH TRONG PHIÊN & PRE-EOD (TAB 1)

Màn hình thay thế hoàn toàn công cụ C# cũ, trực ca sử dụng liên tục trong phiên giao dịch.

### Các tính năng chính:

1. **Khối Giám sát & Điều khiển Bot**:
   - Hiển thị trạng thái ca trực, số lượng lệnh đã xử lý, tổng số chênh lệch (nếu có).
   - Nút **"Chạy đối soát ngay"**: Kích hoạt bot chạy đối chiếu tức thì.
   - Nút **"Dừng bot" (Emergency Stop)**: Nút viền đỏ cảnh báo nằm ngay trên thanh công cụ. Khi bot bị kẹt trang hoặc muốn dừng gấp, trực ca bấm dừng ngay tại đây mà không cần chuyển sang tab khác.

2. **Tự động ghép file thô CQG**:
   - Hệ thống tự động nhận diện và ghép các cặp file từ 2 tài khoản CQG (`FR1` + `FR2` $\rightarrow$ `FR`, `PS1` + `PS2` $\rightarrow$ `PS`, `OP1` + `OP2` $\rightarrow$ `OP`, `OD1` + `OD2` $\rightarrow$ `OD`). Trực ca không cần ghép tay bằng Excel như trước.

3. **Bảng Báo cáo Lệch & Chi tiết Giao dịch**:
   - Liệt kê chi tiết từng lệnh lệch giữa M-System và CQG (lệch số hợp đồng, lệch giá, lệch chiều Mua/Bán).
   - Hỗ trợ bộ lọc nhanh theo mã hàng hóa, mã tài khoản, loại lệnh.
   - Nút xuất file Excel kết quả đối soát chuẩn mẫu quy định.

---

## 3. MÀN HÌNH THỐNG KÊ LOT & GIÁ TRỊ GIAO DỊCH VNCLEAR (TAB 2)

Thay thế Macro Excel cũ của phòng Vận hành, tự động hóa toàn bộ việc tổng hợp báo cáo ngày CoreCCP.

### Các tính năng chính:

1. **Xử lý số liệu tự động**:
   - Nạp các file báo cáo ngày của CoreCCP (`DSGD`, `TTTT`, `TTM`).
   - Tự động phân loại 4 loại lệnh: MKT, LMT, STP, STL.
   - Tự động bóc tách số lot khớp lệnh, số lot tất toán và vị thế mở qua đêm.

2. **Quy đổi Giá trị giao dịch (GTGD) chuẩn xác**:
   - Tự động nhân đúng tỷ giá của từng loại đồng tiền từ Ma trận CoreCCP (USD, JPY, MYR, EUR...).
   - Đảm bảo số liệu khớp 100% với báo cáo tài chính thanh toán bù trừ VNCLEAR.

3. **Ghi lũy kế Excel tự động**:
   - Tự động tìm đúng dòng ngày trong file sổ cái lũy kế để ghi số lot của từng Thành viên Kinh doanh (TVKD).
   - Bảo toàn toàn bộ công thức SUM và định dạng gốc của file Excel báo cáo.

---

## 4. MÀN HÌNH ĐỐI SOÁT EOD CORECCP vs QLTKGD (TAB 3)

Phục vụ công tác chốt sổ cuối ngày, đối chiếu chéo giữa hệ thống M-System và CoreCCP.

### Các tính năng chính:

1. **Công thức Đối chiếu Chuẩn**:
   - Kiểm tra số dư đầu ngày, nộp rút trong phiên, phí giao dịch, phí thanh toán.
   - Áp dụng chuẩn tỷ giá **Mua** cho các khoản lỗ (`Loss`) và tỷ giá **Bán** cho các khoản lãi (`Gain`) theo đúng quy định kế toán của sàn VNCLEAR.
2. **Cảnh báo Lệch Số Dư**:
   - Tự động đánh dấu đỏ các tài khoản có độ lệch vượt ngưỡng quy định ($\ge 1,000$ VND) để trực ca kiểm tra lại trước khi ký chốt ca.

---

## 5. MÀN HÌNH HÀNG ĐỢI & NHẬT KÝ BOT (TAB 5)

Màn hình trung tâm quản trị kỹ thuật dành cho quản trị viên và người theo dõi hệ thống.

### Các tính năng chính:

1. **Quản lý danh sách tác vụ (Job Queue)**:
   - Theo dõi trạng thái từng bot đang chạy, đang chờ hoặc đã xong.
   - Xem thời gian thực hiện, kết quả chi tiết từng lần chạy.
2. **Cơ chế Cooldown chống lặp rác**:
   - Khi sàn đối tác bị thiếu file, bot sẽ tự động vào trạng thái nghỉ 15 phút thay vì tạo job spam liên tục mỗi phút, giúp server luôn nhẹ và ổn định.
3. **Xem Log Trực tiếp**:
   - Xem chi tiết từng bước bot crawler thao tác trên trình duyệt, đọc file hay tính toán để phát hiện ngay nguyên nhân nếu có sự cố.

---

## 6. HƯỚNG DẪN XỬ LÝ NHANH MỘT SỐ TÌNH HUỐNG THƯỜNG GẶP

| Tình huống | Cách xử lý trên giao diện |
| :--- | :--- |
| **Sàn VNCLEAR thêm đồng tiền mới (ví dụ EUR)** | Vào **Tab Cấu hình** $\rightarrow$ Thẻ **Ma trận Tỷ giá CoreCCP** $\rightarrow$ Nhập mã `EUR`, Tỷ giá quy đổi, Tỷ giá Mua/Bán $\rightarrow$ Bấm **+ Thêm nguyên tệ** $\rightarrow$ Bấm **Lưu Cấu Hình**. |
| **Tỷ giá CoreCCP hôm nay đổi khác hôm qua** | Vào **Tab Cấu hình** $\rightarrow$ Bấm nút **Đồng bộ từ CoreCCP** (hoặc gõ sửa trực tiếp vào ô số trên bảng) $\rightarrow$ Bấm **Lưu Cấu Hình**. |
| **Bot đang chạy bị kẹt hoặc quay spinner lâu** | Tại **Tab 1**, bấm ngay nút **Dừng bot** (viền đỏ) $\rightarrow$ Xác nhận dừng $\rightarrow$ Hệ thống sẽ ngắt job ngay lập tức. |
| **Cần chạy lại đối soát sau khi bổ sung file** | Đặt file vào đúng thư mục $\rightarrow$ Bấm **Chạy đối soát ngay** tại Tab 1. |
