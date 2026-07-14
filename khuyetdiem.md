Dưới đây là một đánh giá khách quan về các nhược điểm / điểm cần lưu ý (Trade-offs) của hệ thống MXV Shift Checklist hiện tại để anh nắm rõ khi đưa vào vận hành thực tế:

1. Cơ chế hàng đợi trong bộ nhớ (In-Memory Queue)
Khuyết điểm: Hệ thống điều phối và xử lý tác vụ ngầm (Bot Jobs, tải báo cáo) hiện tại chạy trực tiếp trong bộ nhớ RAM của ứng dụng NestJS (In-Memory). Nếu máy chủ bị khởi động lại đột ngột hoặc crash khi đang chạy ca trực, các Job đang xếp hàng sẽ bị mất hoặc gián đoạn.
Cách khắc phục hiện tại: Trạng thái Job được lưu vào MongoDB để đối chiếu.
Định hướng nâng cấp: Nếu quy mô vận hành phình to hơn 100 người dùng cùng lúc, cần tích hợp Redis (BullMQ) để quản lý hàng đợi bền vững (Persistent Queue).
2. Sự phụ thuộc vào ổ cứng cục bộ (Local File System)
Khuyết điểm: Hệ thống lưu trữ các file báo cáo tải về (EOD, Ký quỹ) trực tiếp trên ổ đĩa của server. Nếu sau này anh chạy cụm máy chủ nhiều instance để chịu tải (Scale ngang - Horizontal Scaling), các server khác nhau sẽ không chia sẻ được file với nhau.
Cách khắc phục hiện tại: Hiện tại quy mô chạy trên 1 VPS đơn lẻ (dùng PM2) thì hoàn toàn bình thường và ổn định.
Định hướng nâng cấp: Chuyển sang lưu trữ đám mây như AWS S3 / MinIO hoặc ổ đĩa mạng dùng chung (NAS) nếu triển khai Multi-server.
3. Chính sách Autoplay âm thanh của Trình duyệt
Khuyết điểm: Âm thanh cảnh báo (Chime) khi có Checklist mới phụ thuộc vào chính sách bảo mật của các trình duyệt hiện đại (Chrome, Edge). Nếu người dùng mở web ra rồi bỏ đi ngay mà chưa click chuột hoặc tương tác gì với trang web, trình duyệt sẽ chặn không cho phát âm thanh cảnh báo đầu tiên.
Cách khắc phục hiện tại: Hệ thống luôn hiển thị thông báo nổi (Toast Alert) song song để nhắc nhở trực quan bằng hình ảnh, không bị ảnh hưởng bởi chính sách âm thanh.
4. File cấu hình SSO dạng thô (Plaintext JSON)
Khuyết điểm: File sso-auto-assign.config.json lưu dưới dạng text thường trên server. Nếu hacker chiếm được quyền điều khiển máy chủ VPS ở mức cao nhất, họ có thể sửa file này để tự cấp quyền ADMIN cho một email bất kỳ.
Cách khắc phục hiện tại: Phân quyền thư mục chạy app trên VPS chặt chẽ (chỉ cho phép user chạy NodeJS được đọc ghi thư mục này). Bản thân Microsoft AD đã xác thực danh tính email rất an toàn nên không sợ bị giả mạo Email từ bên ngoài.
📢 Tổng kết:
Các khuyết điểm trên thực chất là những lựa chọn thiết kế tối giản hợp lý ở giai đoạn này để giúp hệ thống chạy nhanh, nhẹ, không tốn tài nguyên cài đặt thêm các hạ tầng phức tạp (như Redis, S3). Đối với quy mô vận hành hiện tại của MXV, hệ thống hoàn toàn đảm bảo độ tin cậy cực kỳ cao.