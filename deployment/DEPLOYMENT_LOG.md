# 📝 NHẬT KÝ TRIỂN KHAI & CẬP NHẬT HỆ THỐNG
## Môi trường: Native Linux (Ubuntu) | Dự án: MXV Shift Checklist

Tài liệu này dùng để ghi lại tiến độ triển khai thực tế trên máy chủ, các bước đã thực hiện thành công và các ghi chú quan trọng trong quá trình vận hành.

---

## 1. Thông Tin Máy Chủ & Cấu Hỏi
* **IP Server:** `10.0.0.26`
* **Hệ điều hành:** Ubuntu 24.04 LTS
* **Tài khoản SSH:** `mxvadmin`
* **Người thực hiện:** `hiepth` (IT Shift)
* **Thời gian bắt đầu:** 27/07/2026

---

## 2. Bảng Theo Dõi Tiến Độ Triển Khai (Checklist)

| Bước | Nội dung công việc | Trạng thái | Thời gian hoàn thành | Ghi chú / Kết quả |
| :--- | :--- | :---: | :---: | :--- |
| **1** | Cài đặt Node.js v20.x LTS | `[x]` | 27/07/2026 | Đã cài đặt xong Node.js & npm |
| **2** | Cài đặt MongoDB v8.0 | `[x]` | 27/07/2026 | Service `mongod` đang chạy (Active) |
| **3** | Cài đặt Nginx làm Web Gateway | `[x]` | 27/07/2026 | Nginx khởi động thành công |
| **4** | Cài đặt PM2 quản lý tiến trình | `[x]` | 27/07/2026 | Đã cài đặt PM2 global |
| **5** | Upload Source Code lên `/opt/mxv-checklist` | `[x]` | 27/07/2026 | Kéo code qua SFTP MobaXterm |
| **6** | Cấu hình biến môi trường `.env` | `[x]` | 27/07/2026 | Đã thiết lập `.env` cho cả Backend và Frontend |
| **7** | Khởi chạy ứng dụng bằng PM2 | `[x]` | 27/07/2026 | `mxv-backend` và `mxv-frontend` online |
| **8** | Cấu hình Nginx Reverse Proxy | `[x]` | 27/07/2026 | Redirect port 3000 & 3001 qua cổng 80 |
| **9** | **Khôi phục dữ liệu (Database Restore)** | `[ ]` |  | Đã upload file `mxv_shift_checklist.zip` lên `/opt/mxv-checklist/backup/` |

---

## 3. Nhật Ký Chi Tiết Từng Lượt Cập Nhật (Update Log)

*Điền thông tin nhật ký cập nhật vào bảng dưới đây mỗi khi bạn thay đổi code, cấu hình hoặc restore database:*

| Ngày / Giờ | Nội dung thực hiện | Trạng thái | Người thực hiện | Ghi chú thêm |
| :--- | :--- | :--- | :---: | :--- |
| **27/07/2026 08:20** | Thực hiện trích xuất (export) database `mxv_shift_checklist` từ local Atlas thành công. | Hoàn thành | `hiepth` | File zip lưu tại `/opt/mxv-checklist/backup/mxv_shift_checklist.zip` |
| **27/07/2026 08:30** | Giải nén file zip database trên máy Linux. | Hoàn thành | `hiepth` | Chạy lệnh `unzip` tại `/opt/mxv-checklist/backup/` |
| **[Điền giờ]** | Chạy lệnh `mongorestore` khôi phục dữ liệu vào database `checklist`. | *[Đang làm / Đã xong]* | `hiepth` | Lệnh: `mongorestore --db checklist ...` |

---

## 4. Nhật Ký Sự Cố & Cách Xử Lý (Troubleshooting Log)

*Ghi lại các lỗi gặp phải và cách bạn đã sửa để làm tài liệu vận hành về sau:*

* **Sự cố 1 (27/07/2026):** Dữ liệu database hiển thị trống sau khi mở lại.
  * *Nguyên nhân:* Do trước đó restore nhầm tên database (`trading_mxv` thay vì `checklist`), hoặc chưa mount volume đúng cấu hình.
  * *Cách xử lý:* Đã export lại database chuẩn `mxv_shift_checklist` từ cloud Atlas và đang thực hiện restore chính xác vào database `checklist` của Native Deploy.
