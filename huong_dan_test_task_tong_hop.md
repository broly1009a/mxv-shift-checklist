# HƯỚNG DẪN KIỂM THỬ TÍNH NĂNG TÁC VỤ TỔNG HỢP (PARENT-CHILD TASKS)

Tính năng **Tác vụ tổng hợp** cho phép chia nhỏ một công việc bán tự động thành nhiều tác vụ con (ví dụ: một tác vụ do Bot chạy, một tác vụ do Ca trực phê duyệt). Tác vụ cha (tổng hợp) sẽ tự động hoàn thành khi tất cả tác vụ con hoàn tất, và tự động mở ra nếu có tác vụ con bị hủy check.

---

## Cách 1: Chạy kịch bản kiểm thử tự động (Recomended)

Chúng tôi đã viết sẵn một script kiểm thử tự động để chạy thử toàn bộ luồng nghiệp vụ trên Database Test.

1. Mở terminal tại thư mục dự án `backend`.
2. Chạy lệnh sau:
   ```powershell
   npm run test:parent-child
   ```
3. Xem kết quả in ra màn hình. Kịch bản sẽ tự động chạy 4 bước:
   * **Test 1**: Thử check thủ công tác vụ cha $\rightarrow$ Hệ thống sẽ chặn và báo lỗi (Thành công).
   * **Test 2**: Check tác vụ con thứ nhất $\rightarrow$ Tác vụ cha vẫn giữ nguyên trạng thái chưa hoàn thành (Thành công).
   * **Test 3**: Check tác vụ con thứ hai (đủ tất cả con) $\rightarrow$ Tác vụ cha tự động chuyển sang hoàn thành (`PASSED`) (Thành công).
   * **Test 4**: Bỏ check một tác vụ con $\rightarrow$ Tác vụ cha tự động quay lại trạng thái chưa hoàn thành (`PENDING`) (Thành công).

---

## Cách 2: Kiểm thử thủ công trên Giao diện Web (UAT / Local)

Để cấu hình và kiểm thử trực tiếp trên giao diện:

### Bước 1: Cấu hình Mẫu Checklist (Checklist Template)
Hiện tại, cơ sở dữ liệu đã hỗ trợ trường liên kết tác vụ cha-con. Anh có thể cấu hình bằng cách cập nhật Mẫu Template trong Database (hoặc qua tool Admin):
* **Tác vụ cha (Tác vụ tổng hợp)**: Khai báo bình thường. Ví dụ:
  ```json
  {
    "taskId": "task_tong_hop_sod",
    "taskName": "Đối chiếu số dư đầu ngày (SOD) - Tổng hợp"
  }
  ```
* **Các tác vụ con**: Cấu hình trường `parentTaskId` trỏ về `taskId` của tác vụ cha. Ví dụ:
  * Tác vụ con 1 (Bot làm):
    ```json
    {
      "taskId": "task_bot_download_cast",
      "taskName": "[RPA] Tải báo cáo CQG CAST Balances",
      "parentTaskId": "task_tong_hop_sod",
      "isBotCheck": true,
      "botCheckType": "DOWNLOAD_CAST"
    }
    ```
  * Tác vụ con 2 (Người làm):
    ```json
    {
      "taskId": "task_ca_truc_verify_sod",
      "taskName": "[Ca trực] Kiểm tra & Xác nhận chênh lệch SOD",
      "parentTaskId": "task_tong_hop_sod"
    }
    ```

### Bước 2: Bắt đầu ca trực và Kiểm thử
1. Khởi tạo một ca trực mới từ mẫu đã cấu hình ở Bước 1.
2. Truy cập trang chi tiết Checklist ca trực đó.
3. **Kiểm tra tính năng chặn**: Click chuột vào ô checkbox của tác vụ cha (`Đối chiếu số dư đầu ngày (SOD) - Tổng hợp`).
   * *Kết quả mong đợi*: Hệ thống hiển thị thông báo lỗi cảnh báo tác vụ tổng hợp không thể check thủ công.
4. **Kiểm tra tự động hoàn thành**:
   * Click check tác vụ con 1 (hoặc trigger Bot chạy hoàn tất).
   * Click check tác vụ con 2.
   * *Kết quả mong đợi*: Ngay khi tác vụ con cuối cùng được tích chọn, tác vụ cha sẽ tự động chuyển sang màu xanh (hoàn thành) và tiến trình ca trực tăng lên.
5. **Kiểm tra tự động reset**:
   * Click bỏ check tác vụ con 2.
   * *Kết quả mong đợi*: Tác vụ cha tự động mất tích chọn và quay về màu xám (chưa hoàn thành).
