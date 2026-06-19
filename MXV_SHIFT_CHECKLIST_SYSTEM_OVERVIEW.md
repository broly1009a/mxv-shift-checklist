# OVERVIEW NGHIỆP VỤ - HỆ THỐNG SỐ HÓA CHECKLIST CA TRỰC MXV

# 1. Mục tiêu hệ thống

Hệ thống được xây dựng nhằm thay thế hoàn toàn quy trình checklist giấy, Excel và ghi nhận thủ công trong công tác trực vận hành của MXV.

Các đơn vị sử dụng:

* IT_CORE
* QLGD_OPS
* QLRR_RISK

Mục tiêu chính:

* Số hóa toàn bộ checklist vận hành
* Tự động sinh checklist theo ngày giao dịch
* Hỗ trợ Bot tự động thực hiện các tác vụ có thể tự động hóa
* Ghi nhận đầy đủ lịch sử thao tác phục vụ kiểm toán và hậu kiểm
* Theo dõi tiến độ thực hiện checklist theo thời gian thực
* Làm nền tảng để mở rộng các chức năng giám sát vận hành trong tương lai

---

# 2. Luồng nghiệp vụ tổng quan

## Bước 1 - Xác định ngày giao dịch

Hệ thống quản lý lịch làm việc (Working Calendar).

Mỗi ngày hệ thống sẽ xác định:

* Có phải ngày giao dịch hay không
* Có thuộc ngày nghỉ lễ hay không
* Có thuộc ngày nghỉ cuối tuần hay không

Nếu không phải ngày giao dịch:

* Không sinh checklist trực ca

Nếu là ngày giao dịch:

* Chuyển sang bước sinh Job

---

## Bước 2 - Tự động sinh Job trực ca

Cron Job chạy tự động:

```text
00:01 hàng ngày
```

Nếu là Trading Day:

Hệ thống tự động sinh các Job trực ca dựa trên:

* Phòng ban
* Ca trực
* Checklist Template

Mỗi Job được tạo bằng cách clone dữ liệu từ Template đã cấu hình.

---

## Bước 3 - Nhân viên thực hiện Checklist

Người dùng thuộc phòng ban tương ứng truy cập hệ thống.

Thực hiện checklist:

* Truy cập chức năng nghiệp vụ
* Đối chiếu dữ liệu
* Kiểm tra hệ thống
* Tick hoàn thành checklist

Mọi thao tác đều được ghi nhận Activity Log.

---

## Bước 4 - Bot Automation (Giai đoạn sau)

Đối với các checklist có khả năng tự động hóa:

Ví dụ:

* Kiểm tra backup
* Kiểm tra file dữ liệu
* Kiểm tra đối soát
* Kiểm tra trạng thái dịch vụ

Bot sẽ tự động chạy theo lịch cấu hình.

### Trường hợp thành công

```text
Task Status = PASSED
Updated By = SYSTEM_BOT
```

### Trường hợp lỗi

```text
Task Status = FAILED
```

Bot ghi nhận lỗi và phát sinh cảnh báo.

Người trực ca sẽ xử lý thủ công và xác nhận lại kết quả.

---

# 3. Mô hình ca trực

Hiện tại hệ thống được thiết kế theo hướng cấu hình động nhưng seed sẵn các ca mặc định.

## Ca 1

```text
14:00 → 22:00
```

## Ca 2

```text
22:00 → 06:00 (ngày hôm sau)
```

## Ca 3

```text
06:00 → 14:00
```

## Ca hành chính

```text
08:00 → 17:30
```

Các ca trực sẽ được lưu trong collection riêng:

```text
shift_slots
```

để có thể thay đổi trong tương lai mà không cần sửa code.

---

# 4. Các module đã rõ yêu cầu và có thể triển khai ngay

## Module 1 - Authentication & Authorization

Bao gồm:

* Login
* Logout
* User Management
* Department Management
* Role Management
* Permission Management

---

## Module 2 - Working Calendar

Quản lý:

* Ngày nghỉ
* Ngày lễ
* Ngày giao dịch

Chức năng:

* CRUD Calendar
* Check Trading Day
* Hỗ trợ Cron Generate Job

---

## Module 3 - Shift Slot Management

Quản lý danh sách ca trực.

Thông tin:

* Tên ca
* Mã ca
* Giờ bắt đầu
* Giờ kết thúc
* Trạng thái hoạt động

Hiện có thể seed dữ liệu mặc định trước.

Chưa cần UI quản trị.

---

## Module 4 - Checklist Template

Quản lý mẫu checklist.

Mỗi Template bao gồm:

* Department
* Shift Slot
* Danh sách Task

Thông tin Task:

* Tên task
* URL chức năng
* URD tham chiếu
* File Location
* Timetable
* Is Bot Check
* Bot Trigger Time

---

## Module 5 - Shift Job

Quản lý checklist thực tế được sinh ra theo ngày.

Chức năng:

* Sinh Job tự động
* Danh sách Job
* Chi tiết Job
* Tick hoàn thành
* Cập nhật trạng thái

---

## Module 6 - Activity Logs

Ghi nhận toàn bộ thao tác hệ thống.

Bao gồm:

### Auth Logs

* Login
* Logout
* Login Failed

### Activity Logs

* Tick checklist
* Chỉnh sửa checklist
* Tạo template
* Cập nhật dữ liệu

### System Logs

* Cron Job
* Bot Execution
* Notification Error

---

## Module 7 - Dashboard

Theo dõi:

* Tổng số Job
* Tổng số Task
* Tiến độ hoàn thành
* Checklist lỗi
* Checklist chưa hoàn thành
* Thống kê theo phòng ban
* Thống kê theo ca trực

Hiện có thể triển khai API mock trước.

---

# 5. Các phần nghiệp vụ đã chốt

Đã có đủ thông tin để triển khai:

✅ Authentication

✅ Department Management

✅ Working Calendar

✅ Shift Slot

✅ Checklist Template

✅ Shift Job Generation

✅ Activity Logs

✅ Dashboard

---

# 6. Các phần đang chờ nghiệp vụ bổ sung

## 6.1 Nội dung Checklist chi tiết

Đội nghiệp vụ đang bổ sung:

* Tên task
* Các bước thực hiện
* URL chức năng
* URD
* File Location
* Timetable

Hiện tại chỉ cần xây dựng module quản lý dữ liệu.

Chưa cần nhập dữ liệu cứng.

---

## 6.2 Bot Automation

Chưa có đầy đủ:

* Rule kiểm tra
* Input dữ liệu
* Output dữ liệu
* Điều kiện PASS
* Điều kiện FAIL
* Điều kiện cảnh báo

Hiện chỉ cần thiết kế schema:

```text
isBotCheck
botTriggerTime
```

---

## 6.3 Notification

Chưa xác nhận kênh gửi:

* Telegram
* Email
* Notification Web

Tạm thời chỉ thiết kế Notification Module và Database Schema.

---

## 6.4 SLA

Chưa có yêu cầu nghiệp vụ.

Chưa triển khai.

---

## 6.5 Phân công ca trực

Hiện tại chưa có yêu cầu cấu hình người trực.

Bất kỳ thành viên nào thuộc phòng ban tương ứng đều có thể xử lý checklist.

Chưa triển khai Shift Assignment.

---

## 6.6 Quy tắc xử lý ca đêm

Ca 2:

```text
22:00 → 06:00
```

Cần xác nhận thêm:

Ví dụ:

```text
19/06 22:00
→
20/06 06:00
```

Job sẽ được tính cho:

```text
Ngày 19/06
```

hay

```text
Ngày 20/06
```

Requirement này cần được chốt trước khi triển khai báo cáo và dashboard.

---

# 7. Lộ trình triển khai

## Sprint 1

* Authentication
* Department Management
* Working Calendar
* Shift Slot
* Checklist Template
* Shift Job
* Activity Logs

Mục tiêu:

```text
Calendar
→ Generate Shift Job
→ Execute Checklist
→ Save Activity Log
```

---

## Sprint 2

* Dashboard API thật
* Notification Module
* WebSocket Realtime

---

## Sprint 3

* Bot Engine
* Auto Check
* Auto Reconciliation
* Rule Engine

Mục tiêu cuối cùng:

```text
Calendar
→ Generate Shift Job
→ Bot Auto Check
→ Manual Verification
→ Activity Log
→ Dashboard Monitoring
```
