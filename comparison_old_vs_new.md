# So sánh phương pháp xử lý số lot: VBA (Cũ) vs Python Thuần (Mới)

Dưới đây là bảng so sánh chi tiết giữa phương pháp tự động hóa bằng cách gọi Excel COM/VBA (cũ) và giải pháp thay thế hoàn toàn bằng mã nguồn Python thuần sử dụng thư viện `pandas` và `openpyxl` (mới).

| Tiêu chí | Phương pháp cũ (Excel COM/VBA) | Phương pháp mới (Python Thuần) |
| :--- | :--- | :--- |
| **Phụ thuộc phần mềm** | Yêu cầu máy chủ/máy trạm chạy backend **phải cài đặt Microsoft Excel** bản quyền. | **Không cần cài đặt Excel**. Chỉ cần thư viện nhẹ `pandas` và `openpyxl` chạy trên môi trường Python tiêu chuẩn. |
| **Tương thích OneDrive / SharePoint** | Thường xuyên bị lỗi chặn quyền truy cập (VBA Run-time error '1004', RPC Server Unavailable) khi file nằm trong thư mục đồng bộ OneDrive. | **Hoạt động ổn định 100%**. Python đọc ghi trực tiếp bằng luồng file hệ thống (File Stream) nên bỏ qua cơ chế bảo mật hạn chế của Excel COM. |
| **Hiệu năng & Tốc độ** | Chậm. Phải khởi động ứng dụng Excel chạy ẩn, mở lần lượt các tệp nguồn, thực hiện copy-paste và chạy Pivot Table ảo trên sheet. | Rất nhanh (chỉ mất vài giây). Dữ liệu được tải và lọc hoàn toàn trong bộ nhớ (In-memory) trước khi ghi đè trực tiếp kết quả. |
| **Khả năng cấu hình** | Hạn chế. Đường dẫn tệp và thư mục đích (`M:\...`) được viết cứng dưới dạng công thức Excel trong `Sheet2` của file Macro. | **Linh hoạt hoàn toàn**. Đường dẫn gốc (`targetRoot`) được cấu hình trực tiếp từ giao diện Admin Bot Config và truyền động từ backend xuống script Python. |
| **Xử lý tiến trình chạy ẩn** | Dễ bị treo. Nếu có hộp thoại thông báo (MsgBox) xuất hiện hoặc Excel bị lỗi, tiến trình Excel.exe sẽ bị treo vô hạn trong Windows. | Ổn định. Không có giao diện (Headless). Tiến trình được giám sát trực tiếp bởi NodeJS Queue, tự động giải phóng tài nguyên khi hoàn tất. |
| **Ghi nhận Lỗi (Logging)** | Rất khó debug lỗi phát sinh bên trong VBA. Phải dùng kỹ thuật bắt Dialog Box phức tạp để lấy thông tin lỗi. | Dễ dàng. Sử dụng cơ chế ghi log chuẩn của Python và trả kết quả cấu trúc dạng JSON trực tiếp cho backend NestJS hiển thị trên UI. |

---

### 💡 Tại sao phương án mới tối ưu hơn?
Bằng cách chuyển đổi logic lọc và cộng dồn từ VBA sang Python thuần:
1. **Bypass hoàn toàn lỗi OneDrive**: Không còn lo ngại lỗi `1004` khi Excel cố gắng mở các file trong thư mục đồng bộ.
2. **Hỗ trợ chạy Offline/Local**: Khi ổ đĩa mạng `M:\` không khả dụng (ví dụ khi chạy thử nghiệm trên máy cá nhân), hệ thống sẽ tự động chuyển hướng đọc/ghi sang thư mục thay thế được cấu hình trên giao diện thay vì báo lỗi.
