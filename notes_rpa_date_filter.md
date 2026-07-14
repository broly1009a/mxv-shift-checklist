# Tài liệu Hướng dẫn Cấu hình Lọc ngày tự động trên M-System (RPA Email History)

Tài liệu này ghi chú thông tin về tính năng tự động lọc ngày ca trực trên giao diện M-System Admin trước khi tải báo cáo lịch sử gửi email.

## 📌 Lý do tạm thời đóng tính năng:
Theo nghiệp vụ thực tế trao đổi với phòng vận hành:
1. Trường hợp quên đóng ca trực cũ cực kỳ thấp hoặc gần như không xảy ra.
2. Nếu có trường hợp quên gửi email tự động và gửi bù vào ngày hôm sau, việc đối soát có thể thực hiện thủ công hoặc chấp nhận dữ liệu ngày hiện tại.
3. Để đảm bảo tính đồng bộ và đơn giản hóa quy trình vận hành giống như các tác vụ RPA khác (luôn tải dữ liệu mặc định của phiên giao dịch hiện tại), tính năng này tạm thời được **comment đóng lại**.

---

## 📂 Vị trí File & Code đóng:
* **File nguồn**: `backend/src/modules/bot-engine/rpa-downloader.service.ts`
* **Hàm sửa đổi**: `downloadEmailHistoryReport(downloadDir: string, targetDate?: string)`
* **Vị trí code**: Từ dòng `982` đến dòng `1048` (trong khối comment `/* ... */`).

---

## 🛠️ Hướng dẫn Kích hoạt lại (Uncomment):
Nếu sau này bộ phận nghiệp vụ yêu cầu robot phải tự động lọc về ngày ca trực cũ để tải báo cáo lịch sử chính xác của ngày hôm đó:

1. Mở file [rpa-downloader.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/rpa-downloader.service.ts).
2. Tìm đến khối lệnh:
   ```typescript
   /*
   // NOTE: Tạm thời đóng phần tự động lọc ngày (RangePicker) để đồng bộ với các tác vụ khác.
   // Do nghiệp vụ rất ít khi quên đóng ca (hoặc có gửi bù thì đối soát thủ công).
   // Khi cần mở lại đối chiếu lịch sử ca cũ tự động, chỉ cần uncomment đoạn code dưới đây.
   if (targetDate) {
     ...
   }
   */
   ```
3. Xóa ký hiệu comment `/*` và `*/` bao quanh khối `if (targetDate)` để đưa mã nguồn hoạt động bình thường.
4. Chạy biên dịch lại backend:
   ```powershell
   powershell -ExecutionPolicy Bypass -Command "npm run build"
   ```
