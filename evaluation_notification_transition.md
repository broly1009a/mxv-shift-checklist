# Báo Cáo Tổng Hợp & Phương Án Đồng Bộ Hệ Thống Cảnh Báo
*(Summary Report & Unified Alert System Design)*

Tài liệu này tổng hợp toàn bộ thông tin trao đổi, đánh giá hiện trạng và thiết kế chi tiết phương án tối ưu hóa hệ thống cảnh báo (Emails & Telegram) cho các Bot nghiệp vụ (Margin Checker) của dự án **MXV Shift Checklist**.

---

## 1. Nhật Ký Khắc Phục Lỗi TypeScript (Bug Fix)
* **Lỗi phát sinh**: `Argument of type 'null' is not assignable to parameter of type 'string | undefined'` tại dòng 310 file [margin-checker.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/margin-checker/margin-checker.service.ts).
* **Nguyên nhân**: Hàm `updateDeliveryStatus` yêu cầu tham số lỗi (`errorMsg`) là tùy chọn (`errorMsg?: string`), tương đương kiểu `string | undefined`. Tuy nhiên, dòng code cũ đã truyền cứng giá trị `null` khi gửi mail thành công, gây lỗi biên dịch khi bật chế độ kiểm tra nghiêm ngặt (`strictNullChecks`).
* **Giải pháp khắc phục**: Đã thay thế `null` bằng `undefined`. Cấu trúc logic Backend tự động xử lý fallback `undefined` thành `null` khi ghi vào Database, giúp hệ thống biên dịch thành công 100% bằng lệnh `npm run build` mà không làm thay đổi logic nghiệp vụ.

---

## 2. Phân Tích Hiện Trạng & Sự Mâu Thuẫn Giữa 2 Logic

Hệ thống hiện tại có 2 cấu phần cấu hình cảnh báo chạy hoàn toàn độc lập và không đồng bộ:

### Cấu phần A: Cấu hình trực tiếp tại Bot (Margin Checker Modal)
* **Giao diện**: Các thẻ Card trực quan (*SOD*, *Pre-EOD*, *EOD*, *On-Order*,...) hiển thị trực tiếp trong Modal khi người dùng trực ca mở ca trực.
* **Lưu trữ**: Dữ liệu cấu hình (email, Telegram ID, SMTP) được lưu dưới dạng **một chuỗi JSON duy nhất** (`margin_checker_config`) trong bảng `SystemSetting`.
* **Vận hành**: **Đang chạy thực tế ổn định**. Bot đọc trực tiếp cấu hình này từ database để gửi mail/Telegram.

### Cấu phần B: Luật cấu hình thông báo chung (Admin)
* **Giao diện**: Quản lý dạng bảng cơ sở dữ liệu chung (CRUD Kênh và Luật) trong trang Admin.
* **Lưu trữ**: Lưu trong các bảng dữ liệu chuyên biệt (`NotificationRule`, `NotificationChannel`).
* **Vận hành**: **Chưa hoạt động**. Mới chỉ có giao diện thô ở Frontend, Backend chưa đấu nối logic với các Bot. Lựa chọn sự kiện lỗi Bot ở đây thực chất chỉ là một Placeholder.

> [!WARNING]
> **Hệ quả**: Người dùng thiết lập cấu hình nhận email lỗi Bot ở mục B (Admin) nhưng không bao giờ nhận được email, vì Bot chỉ đọc cấu hình của mục A (Modal). Việc có 2 màn hình độc lập gây rối loạn trong việc quản lý và vận hành.

---

## 3. Đánh Giá Sự Chuyển Đổi Tối Ưu (Định Hướng Từ Người Vận Hành)

Dựa trên thực tế vận hành của MXV:
* Các khối nghiệp vụ (QLGD, QLRR, IT) **chỉ có nhu cầu nhận cảnh báo qua Email Outlook** (và Telegram đi kèm trên từng card) chứ không có nhu cầu mở rộng sang các kênh nhắn tin đa phương tiện khác.
* Giao diện **Margin Checker Modal (A)** đang hoạt động rất tốt, trực quan và dễ dùng đối với Operator, cần được giữ nguyên để không làm thay đổi thói quen sử dụng.

### Giải pháp lựa chọn: "Đấu nối logic B vào A dưới Database"
Để triệt tiêu sự phức tạp của hệ thống điều phối tin trung tâm nhưng vẫn làm sạch kiến trúc dữ liệu, chúng ta sử dụng giải pháp **B đấu nối ngầm vào A**:

```
+--------------------------------------------------------+
| Giao diện Frontend (Thẻ Card trực quan của Bot)        |
| - Người dùng nhập Email, bật/tắt trên từng Card        |
+--------------------------------------------------------+
                           │ (Frontend tự dịch chuyển dữ liệu)
                           ▼
+--------------------------------------------------------+
| Cơ sở dữ liệu chuẩn hóa của B (NotificationRule)       |
| - eodCheck  --> Document 'EOD_CHECK_RULE'              |
| - sodCheck  --> Document 'SOD_CHECK_RULE'              |
+--------------------------------------------------------+
                           │ (Bot truy vấn trực tiếp)
                           ▼
+--------------------------------------------------------+
| Logic vận hành lõi của Bot (A)                         |
| - Giữ nguyên 100% thuật toán đối soát                  |
| - Gửi email theo SMTP và danh sách lấy từ Rule         |
+--------------------------------------------------------+
```

---

## 4. Chi Tiết Thiết Kế Kỹ Thuật (Phương Án Đấu Nối)

Khi thực hiện đấu nối, logic vận hành lõi của Bot (thuật toán đối soát) **hoàn toàn không bị ảnh hưởng**. Chúng ta chỉ thay đổi nguồn đọc dữ liệu cấu hình.

### 4.1. Điều chỉnh dưới Database & Backend:
Thay vì Bot đọc cấu hình từ JSON `margin_checker_config` của bảng `SystemSetting`, các Service Backend của Bot sẽ thực hiện câu lệnh truy vấn Mongoose đơn giản để lấy danh sách email từ bảng của B:

* **Ví dụ trước đây (Đọc JSON)**:
  ```typescript
  const config = JSON.parse(await this.settingsService.getSetting('margin_checker_config', '{}'));
  const emails = config.eodCheck.email;
  ```
* **Ví dụ sau khi đấu nối (Đọc từ Rule Model)**:
  ```typescript
  const eodRule = await this.notificationRuleModel.findOne({ code: 'EOD_CHECK' });
  const emails = eodRule.recipient; // Lấy mảng email trực tiếp từ Luật thông báo tương ứng
  ```

### 4.2. Điều chỉnh trên Frontend (Đảm bảo tính trực quan):
* **Giữ nguyên giao diện**: Người dùng vẫn cấu hình qua các thẻ Card trực quan của Margin Checker.
* **Đồng bộ ngầm**: Khi người dùng nhấn nút **Lưu** trên Card:
  * Frontend sẽ gọi API tự động cập nhật đè danh sách email và trạng thái kích hoạt vào tài liệu `NotificationRule` tương ứng của Bot đó dưới Database.
  * Người dùng không cần phải biết sự tồn tại của bảng Luật thông báo phức tạp ở trang Admin.
* **Dọn dẹp**: Ẩn liên kết "Cấu hình thông báo" chung trên Sidebar của Admin để loại bỏ hoàn toàn sự rối rắm.

---

## 5. Kế Hoạch & Phân Phối Tác Vụ Dự Kiến (Phía Frontend & Admin)
* **Quy hoạch trang Cấu hình Bot/RPA (`/admin/bot-config`)**:
  * Tạo một Tab tên là **"Khối QLGD (Giao dịch)"**: Nơi hiển thị các Card đối soát giống như trong Modal.
  * Tạo một Tab tên là **"Hệ thống IT"**: Nơi Admin cấu hình SMTP Mail Server và Email nhận lỗi khi Bot sập.
  * Các khối **QLRR (Rủi ro)** hoặc khối khác sau này phát triển thêm sẽ được hiển thị dưới dạng các Tab chờ (hoặc card cấu hình riêng biệt) kết nối vào các Rule tương ứng của khối đó.
* **Thời gian thực hiện**: Dự kiến khoảng **4 - 6 giờ làm việc** cho toàn bộ quá trình tái cấu trúc Frontend và đấu nối API Backend mà không gây ảnh hưởng đến thuật toán chạy của Bot.
