# 📘 Hướng Dẫn Triển Khai Ứng Dụng AML Sanction Search (Python + venv + PM2)

Tài liệu này hướng dẫn chi tiết các bước triển khai ứng dụng tra cứu cấm vận **AML Sanction Search** trên máy chủ Ubuntu chạy chung với hệ thống MXV Shift Checklist.

---

## 1. Đánh Giá Ảnh Hưởng Khi Chạy Chung Server VM

Việc chạy chung ứng dụng Python này trên cùng một VM đang chạy dự án Checklist là **hoàn toàn khả thi và an toàn**.

Theo kết quả kiểm tra tài nguyên hệ thống thực tế trên server `mxv-devop-srv-01` (`free -h`):
- **RAM vật lý:** Tổng 3.8Gi, đang sử dụng 1.0Gi, còn trống thực tế **2.0Gi (Available: 2.8Gi)**.
- **RAM ảo (Swap):** Đã được cấu hình sẵn **3.8Gi** (còn trống 3.4Gi).

Với thông số này, hệ thống **cực kỳ an toàn** để vận hành song song cả Checklist (BE, FE, MongoDB) và ứng dụng AML Python mà **không cần cấu hình thêm Swap**.

Các lưu ý kỹ thuật khi chạy chung:
1. **Tiêu thụ RAM của ứng dụng:** AML Search sử dụng thư viện `pandas` để load dữ liệu cấm vận lớn trực tiếp vào RAM, tiêu tốn khoảng **200MB - 500MB RAM** khi chạy. Với 2.0Gi RAM trống hiện tại, hệ thống hoàn toàn đáp ứng tốt.
2. **Về sự xung đột thư viện (Isolation):** Do sử dụng môi trường ảo **`venv`**, toàn bộ các thư viện Python (Flask, Pandas, Apscheduler) sẽ được cài đặt cô lập trong thư mục `/opt/AML/venv/`. Việc này đảm bảo **không gây xung đột** với bất kỳ thư viện Python nào khác trên hệ thống.
3. **Về cổng mạng (Port):** Ứng dụng chạy trên cổng **`8845`**, hoàn toàn độc lập với các cổng `3000` (Next.js) và `3001` (NestJS) của Checklist, do đó **không có xung đột Port**.

---

## 2. Các Bước Triển Khai Chi Tiết trên Ubuntu

### Bước 1: Tạo thư mục chứa ứng dụng và phân quyền
Truy cập SSH vào Server Ubuntu và chạy lệnh sau:
```bash
sudo mkdir -p /opt/AML
sudo chown -R mxvadmin:mxvadmin /opt/AML
```

### Bước 2: Upload mã nguồn lên Server
Sử dụng thanh công cụ SFTP của **MobaXterm** (hoặc công cụ truyền file bất kỳ), upload file `app_sanction_search.py` vào thư mục `/opt/AML`.

*(Lưu ý: Không cần upload các file dữ liệu `.csv`, `.xml` nặng lên vì ứng dụng sẽ tự động tải các file cấm vận mới nhất từ internet về khi khởi chạy).*

### Bước 3: Tạo môi trường ảo (venv) và cài đặt dependencies
Chạy các lệnh sau tại terminal của Server để cài đặt môi trường ảo cô lập:
```bash
cd /opt/AML

# 1. Cài đặt các gói hỗ trợ của Python (nếu server chưa có)
sudo apt update
sudo apt install -y python3-pip python3-venv

# 2. Tạo môi trường ảo tên là 'venv' (đảm bảo không cài package global)
python3 -m venv venv

# 3. Kích hoạt môi trường ảo
source venv/bin/activate

# 4. Nâng cấp pip và cài đặt các thư viện cần thiết
pip install --upgrade pip
pip install flask pandas apscheduler
```

### Bước 4: Khởi chạy ngầm ứng dụng bằng PM2
Sử dụng PM2 để quản lý tiến trình chạy ngầm của Python (chỉ định interpreter trỏ đúng vào Python của venv):
```bash
# Đang đứng tại thư mục /opt/AML
pm2 start app_sanction_search.py --name "mxv-aml" --interpreter ./venv/bin/python

# Lưu cấu hình PM2 để tự khởi động lại khi reboot server
pm2 save
```

---

## 3. Các Lệnh Quản Lý Vận Hành AML App

```bash
# Xem trạng thái chạy của app
pm2 status

# Xem log hoạt động (Đặc biệt để xem tiến trình tải danh sách cấm vận lúc khởi động)
pm2 logs mxv-aml

# Khởi động lại app
pm2 restart mxv-aml

# Dừng chạy app
pm2 stop mxv-aml
```

---

## 4. Cấu Hình Nginx Reverse Proxy (Khuyên Dùng)

Để người dùng truy cập trực tiếp qua cổng Web tiêu chuẩn `80` (đường dẫn đẹp `http://10.0.0.26/aml/`) mà **không cần mở cổng phụ 8845 trên thiết bị mạng**, hãy cấu hình Nginx làm Reverse Proxy:

1. **Mở file cấu hình Nginx:**
   ```bash
   sudo nano /etc/nginx/sites-available/default
   ```
2. **Thêm cấu hình location sau vào bên trong block `server` (ngay dưới block `/api`):**
   ```nginx
       # AML Sanction Search
       location /aml/ {
           proxy_pass http://127.0.0.1:8845/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   ```
3. **Kiểm tra cú pháp và khởi động lại Nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## 5. Mẫu Email Yêu Cầu IT/Mạng Mở Cổng (Gửi anh Long)

Khi đã cấu hình Nginx Reverse Proxy thành công, bạn chỉ cần nhờ bộ phận IT mở cổng Web tiêu chuẩn (80/443). Dưới đây là mẫu yêu cầu gửi anh Long:

```text
Dear Anh Long,

Nhờ anh cấu hình mở cổng kết nối trên tường lửa để truy cập hệ thống nội bộ văn phòng như sau ạ:
- IP máy chủ (Đích): 10.0.0.26
- Cổng cần mở: 80 (HTTP) và 443 (HTTPS)
- IP nguồn cho phép: Mạng nội bộ văn phòng (hoặc toàn bộ dải IP văn phòng).
- Mục đích: Truy cập giao diện ứng dụng Web MXV Operate-Checklist và công cụ tra cứu cấm vận AML của phòng Quản lý Rủi ro.

Cảm ơn anh đã hỗ trợ!
```
