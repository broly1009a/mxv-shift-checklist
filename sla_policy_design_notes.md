# Tài Liệu Cấu Trúc Thiết Kế & Đánh Giá Chính Sách SLA (SLA Policy Design Notes)

Tài liệu này ghi lại toàn bộ các đánh giá, thiết kế kiến trúc và định hướng phát triển cho tính năng **SLA Policy (Giám sát cam kết dịch vụ & Cảnh báo leo thang)** để phục vụ công tác lập trình và nâng cấp hệ thống trong tương lai.

---

## 1. Ý nghĩa Nghiệp vụ của SLA Policy
SLA Policy (Service Level Agreement Policy) giúp tự động hóa quá trình giám sát thời gian hoàn thành các tác vụ trong ca trực và tự động gửi thông báo nhắc nhở/cảnh báo leo thang qua các kênh truyền thông (Telegram, Email, Web Notification) khi có sự cố trễ hạn.

* **Schema tham chiếu**: [sla-policy.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/schemas/sla-policy.schema.ts) (Đang để ở trạng thái "Chờ" - Draft).

---

## 2. Phân biệt SLA Tác vụ (Task SLA) vs Chính sách SLA (SLA Policy)

Khi thiết kế tiếp, cần hiểu rõ sự phân tách trách nhiệm giữa hai thực thể:

| Tiêu chí | SLA trong Template (Task SLA) | SLA Policy (Bảng cấu hình chính sách) |
| :--- | :--- | :--- |
| **Nơi lưu trữ** | Thuộc tính của từng Tác vụ (`TaskItem.slaDeadline`, `TaskItem.slaType`) | Bản ghi độc lập (`sla_policies` trong MongoDB) |
| **Vai trò** | Định nghĩa **Mốc thời hạn** (Ví dụ: Tác vụ A phải xong trước 19:15) | Định nghĩa **Quy chế xử lý & Kênh cảnh báo** khi vi phạm mốc thời hạn |
| **Đối tượng áp dụng** | Duy nhất tác vụ chứa nó (Tĩnh) | Cả nhóm tác vụ dựa theo phòng ban, ca trực hoặc độ ưu tiên (Động) |
| **Bảo trì** | Khó sửa đổi hàng loạt (phải sửa từng task) | Dễ thay đổi cấu hình cảnh báo toàn hệ thống bằng 1 dòng DB |

* **Ví dụ thực tế**:
  * **SLA trong template**: Tác vụ *"Đối chiếu khớp lệnh Straits"* có độ ưu tiên `CRITICAL` và hạn chót `slaDeadline` là `19:15`.
  * **SLA Policy**: Cấu hình quy tắc: *"Nếu bất cứ tác vụ `CRITICAL` nào của phòng `IT` quá hạn `15 phút` mà chưa hoàn thành $\rightarrow$ Bắn Telegram cảnh báo leo thang tới Giám đốc Khối."*

---

## 3. Kiến trúc Đăng ký Timer: So sánh Giải pháp Kỹ thuật

Để giải quyết bài toán cảnh báo quá hạn (vốn là sự kiện **không xảy ra** - nhân viên quên không bấm tích hoàn thành), chúng ta đánh giá các phương án sau:

### Phương án A: Quét mù định kỳ (Cron Job 1 phút)
* **Cơ chế**: Hệ thống chạy một Cron Job rà soát toàn bộ database mỗi phút để tìm các task trễ hạn.
* **Đánh giá**: Gây lãng phí tài nguyên CPU/Database rất lớn nếu số lượng mốc SLA trong ngày thưa thớt (ví dụ cả ngày chỉ có 3-4 mốc deadline nhưng hệ thống phải chạy quét 1.440 lần/ngày).
* *Lưu ý*: Chỉ nên dùng Cron Job 1 phút cho **Bot Scheduler** vì Bot Scheduler cần cập nhật tức thời các cấu hình giờ chạy động thay đổi liên tục từ UI của Admin.

### Phương án B: Hàng đợi phân tán (Redis + BullMQ)
* **Cơ chế**: Sử dụng một database Redis làm hàng đợi hẹn giờ quá hạn (Delayed Queue).
* **Đánh giá**: Quá phức tạp (Over-engineering) đối với quy mô ứng dụng nội bộ hiện tại. Phát sinh chi phí vận hành, cài đặt và giám sát service phụ thuộc (Redis server).

### Phương án C: Hẹn giờ động trong RAM (NestJS `SchedulerRegistry`) - 🌟 KHUYÊN DÙNG
* **Cơ chế**: Sử dụng tính năng quản lý timer trong bộ nhớ RAM của chính Node.js/NestJS thông qua `SchedulerRegistry`.
* **Đánh giá**: Là giải pháp tối ưu, sạch sẽ và phù hợp nhất về mặt kiến trúc:
  * **0% chi phí hạ tầng**: Không cần cài thêm bất cứ DB phụ thuộc nào như Redis.
  * **Tối ưu tài nguyên 100%**: Chỉ thức dậy và truy vấn Database đúng số lần bằng số mốc SLA cấu hình (ví dụ 3 lần/ngày thay vì 1.440 lần/ngày).
  * **Chi phí RAM cực nhỏ**: Mỗi timer chạy ngầm chỉ chiếm khoảng **1 - 2 KB RAM**. Kể cả khi có 1.000 tác vụ chờ cùng lúc, tổng RAM tiêu thụ chỉ vỏn vẹn **1 MB**.
  * **Dọn dẹp tự động**: Khi timer chạy xong hoặc bị chủ động hủy (`deleteTimeout()`), V8 Engine sẽ giải phóng RAM ngay lập tức, ngăn ngừa rò rỉ bộ nhớ (Memory Leak).

---

## 4. Hướng dẫn Lập trình 3 Bước tích hợp `SchedulerRegistry`

Khi bắt tay vào code thực tế, hãy áp dụng quy trình 3 bước tối giản sau:

### Bước 1: Đăng ký hẹn giờ (Khi mở ca trực hoặc khi Server Restart)
Tính toán thời gian còn lại (ms) từ lúc hiện tại đến hạn chót SLA và đăng ký timer:

```typescript
const delayMs = targetSlaTime.getTime() - Date.now();

if (delayMs > 0) {
  const timer = setTimeout(() => {
    this.sendSlaAlert(shiftLogId, taskId);
  }, delayMs);

  // Đăng ký vào Registry của NestJS với mã định danh duy nhất
  this.schedulerRegistry.addTimeout(`sla-${shiftLogId}-${taskId}`, timer);
}
```

### Bước 2: Hủy hẹn giờ (Khi nhân viên tích xanh Hoàn thành)
Khi nhân viên hoàn thành việc đúng hạn, hủy bộ hẹn giờ tương ứng trong RAM để dừng cảnh báo:

```typescript
const timerName = `sla-${shiftLogId}-${taskId}`;

if (this.schedulerRegistry.hasTimeout(timerName)) {
  this.schedulerRegistry.deleteTimeout(timerName);
}
```

### Bước 3: Hàm xử lý bắn cảnh báo (Khi hết giờ hẹn)
Được tự động gọi bởi timer ở Bước 1 nếu timer đó không bị hủy ở Bước 2:

```typescript
async sendSlaAlert(shiftLogId: string, taskId: string) {
  // 1. Kiểm tra lại DB xem thực sự tác vụ vẫn chưa hoàn thành
  const task = await this.shiftLogModel.findOne({ _id: shiftLogId, 'details.taskId': taskId });
  const taskDetail = task?.details.find(d => d.taskId === taskId);

  if (taskDetail && !taskDetail.isChecked) {
    // 2. Kích hoạt thông báo leo thang qua các kênh cấu hình trong NotificationRule
    await this.notificationService.triggerSlaNotification(shiftLogId, taskDetail);
  }
}
```

*Lưu ý*: Để đảm bảo các timer không bị mất khi ứng dụng khởi động lại (restart server), tại hàm `onModuleInit()` của Service, hãy viết thêm logic quét các active shifts (`status: 'PENDING'`) trong database và tự động đăng ký lại các timer cho những tác vụ chưa hoàn thành.
