# Tool Tải Báo Cáo Tự Động CPP & CE Theo Tháng (Standalone Project)

Ứng dụng Python độc lập giúp tự động hóa việc đăng nhập vào hệ thống **CPP & CE (Clearing System)**, phân tách khoảng thời gian chọn (Ví dụ: `01/01/2025` đến `30/08/2026`) thành từng tháng, và xuất 5 loại báo cáo dạng CSV lưu vào cấu trúc thư mục quy chuẩn.

---

## 📂 Cấu Trúc Thư Mục Xuất Báo Cáo

Người dùng chỉ định 1 **Thư mục to (Root Folder)** (Ví dụ: `D:\BaoCao_CPP_CE`). Ứng dụng sẽ tự tạo các thư mục con và lưu các file CSV theo từng tháng:

```text
Thư mục to (Ví dụ: D:/BaoCao_CPP_CE)
├── DSL/    (Danh sách lệnh)
│    ├── DSL0125.csv   (Tháng 01/2025: 01/01/2025 -> 31/01/2025)
│    ├── DSL0225.csv   (Tháng 02/2025: 01/02/2025 -> 28/02/2025)
│    └── DSL0826.csv   (Tháng 08/2026: 01/08/2026 -> 30/08/2026)
├── NR/     (Lịch sử nộp rút tiền)
│    ├── NR0125.csv
│    └── NR0225.csv
├── DSGD/   (Danh sách giao dịch)
│    ├── DSGD0125.csv
│    └── DSGD0225.csv
├── TTTT/   (Trạng thái tất toán)
│    ├── TTTT0125.csv
│    └── TTTT0225.csv
└── LSGTT/  (Lịch sử giá thanh toán)
     ├── LSGTT0125.csv
     └── LSGTT0225.csv
```

---

## 🚀 Hướng Dẫn Sử Dụng Nhanh (1-Click)

### Cách 1: Chạy trực tiếp bằng File Batch (Dành cho Windows)
- Đơn giản chỉ cần **Double-click file `run.bat`**.
- File bat sẽ tự tạo môi trường ảo Python (`venv`), cài thư viện phụ thuộc và bật giao diện ứng dụng GUI.

### Cách 2: Chạy qua giao diện dòng lệnh (CLI)
```bash
# Cài đặt thư viện
pip install -r requirements.txt
playwright install chromium

# Chạy giao diện đồ họa (GUI)
python main.py

# Hoặc chạy dòng lệnh (CLI)
python main.py --cli --url https://clearing.mxv.com.vn --user admin --pass secret --start 01/01/2025 --end 30/08/2026 --output "D:\BaoCao_CPP_CE"
```

---

## 📦 Cách Đóng Gói Thành File `.exe` Để Gửi Cho End-User

Nếu muốn gửi cho người dùng cuối không có sẵn Python trên máy:
1. Double-click file `build_exe.bat`.
2. Truy cập thư mục `dist\CPP_CE_Report_Downloader\`.
3. Nén toàn bộ thư mục này thành file `.zip` và gửi cho End-User sử dụng ngay!

---

## 📋 Danh Sách File Dự Án
- `main.py`: Entry point khởi chạy GUI/CLI.
- `gui.py`: Giao diện người dùng đồ họa bằng PyQt6.
- `downloader.py`: Logic tự động hóa trình duyệt (Playwright) và xử lý ngày tháng.
- `config.json`: File lưu cấu hình tài khoản & danh sách báo cáo.
- `requirements.txt`: Danh sách thư viện Python.
- `run.bat`: Script khởi chạy nhanh 1-click.
- `build_exe.bat`: Script đóng gói ứng dụng thành file `.exe`.
