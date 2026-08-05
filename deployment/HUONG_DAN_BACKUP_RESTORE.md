# 🗄️ Hướng Dẫn Sao Lưu & Khôi Phục Database MongoDB (Atlas Cloud ➜ Local ➜ Server Ubuntu)

Tài liệu này ghi lại chi tiết các bước và câu lệnh chuẩn để sao lưu cơ sở dữ liệu từ MongoDB Atlas (Cloud) của dự án này về máy cá nhân (Windows Desktop) và khôi phục lên Server Ubuntu.

---

## 💻 LUỒNG 1: Backup qua máy cá nhân (Windows Desktop) rồi đẩy lên Server
*Áp dụng khi muốn lưu trữ bản backup tại máy cá nhân hoặc chuyển tiếp thủ công.*

### Bước 1: Sao lưu từ Atlas về thư mục Desktop máy Windows
1. Mở **Git Bash** trên máy Windows của anh/chị.
2. Di chuyển đến thư mục backup đã được tạo sẵn trên Desktop (nơi chứa file công cụ `mongodump.exe`):
   ```bash
   cd /c/Users/hiepth/Desktop/db-backup-all
   ```
3. Chạy lệnh dump dữ liệu từ MongoDB Atlas (lấy connection string từ file `backend/.env`):
   ```bash
   ./mongodump.exe --uri="mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist" --out="."
   ```
   *Kết quả:* Một thư mục con tên là `mxv_shift_checklist` chứa các file dữ liệu dạng `.bson` và `.metadata.json` sẽ được tạo ra tại `C:\Users\hiepth\Desktop\db-backup-all\mxv_shift_checklist`.

---

### Bước 2: Đẩy dữ liệu lên Server Ubuntu
1. Mở công cụ **MobaXterm** kết nối với Server Ubuntu (`10.0.0.26`).
2. Sử dụng khung điều hướng SFTP bên trái, tìm tới thư mục `/opt/mxv-checklist/backup/`.
3. Kéo thả thư mục **`mxv_shift_checklist`** vừa tạo ở Desktop vào thư mục `/opt/mxv-checklist/backup/` trên Server.

---

### Bước 3: Khôi phục dữ liệu (Restore) trên Server Ubuntu
1. Tại cửa sổ Terminal SSH của con Ubuntu, chạy lệnh sau để khôi phục dữ liệu vào database local (`checklist`):
   ```bash
   mongorestore --db checklist /opt/mxv-checklist/backup/mxv_shift_checklist
   ```

---

## ⚡ LUỒNG 2: Đồng bộ trực tiếp trên Server Ubuntu (Không cần thông qua Windows)
*Áp dụng khi Server Ubuntu có kết nối internet ra ngoài để gọi tới Atlas trực tiếp (nhanh nhất, không cần tạo file).*

SSH vào Server Ubuntu (`10.0.0.26`) và chạy **một lệnh duy nhất** sau để tự động dump từ Atlas và import thẳng vào database local:

```bash
mongodump --uri="mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist" --archive --gzip | mongorestore --db checklist --archive --gzip
```
