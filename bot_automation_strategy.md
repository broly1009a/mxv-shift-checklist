# Chiến lược Tự động hóa bằng Bot cho MXV Shift Checklist

Tài liệu này phân tích tính khả thi, khó khăn, giải pháp và đánh giá ưu/nhược điểm khi phát triển Bot tự động kiểm tra (Auto-check Bot) dựa trên tài liệu backlog `AGILE_USER_STORIES_SOP_BACKLOG.md` và quy trình nghiệp vụ ca trực của MXV.

---

## 1. Tính khả thi của việc xây dựng Bot Auto-check

**Hoàn toàn khả thi và cực kỳ cần thiết.** 

Bản chất của việc số hóa SOP thành các User Stories với cấu trúc dữ liệu rõ ràng (như `triggerTime`, `slaDeadline`, `dependsOnTaskIds`, `exceptionCode`) chính là xây dựng **"luật chơi"** cho Bot. Khi các đầu việc được định nghĩa dưới dạng dữ liệu trong MongoDB, Bot engine chỉ cần truy vấn cấu hình để thực hiện kiểm tra tự động thay thế con người.

### Các nhóm tác vụ Bot có thể tự động hóa:
1.  **Bot Đọc Email (US 1.2):** Tự động kết nối Mailbox (IMAP/Microsoft Graph API) lúc 05h00 để quét email kết quả "Job Snapshot". Nếu tìm thấy email thành công, Bot tự động gọi API `PATCH /api/v1/shifts/items/status` để chuyển trạng thái task sang `PASSED`. Nếu không có email hoặc email báo lỗi, Bot chuyển trạng thái task sang `FAILED` và tự động tạo Exception `IF_SNAPSHOT_FAILED`.
2.  **Bot Đối chiếu dữ liệu (US 1.3 & 2.2):** Tự động gọi API đối chiếu (Reconciliation Service) giữa M-System, CQG và ACM định kỳ mỗi 1 tiếng. Nếu lệch dữ liệu, Bot tự động tạo Incident `UNBALANCED_DATA`.
3.  **Bot Giám sát SLA & Cảnh báo (US 5.2):** Cron-job chạy ngầm quét các task sắp quá hạn SLA (ví dụ: EOD quá 07h30), tự động bắn thông báo khẩn cấp lên Telegram/Slack của ca trực và cấp quản lý.

---

## 2. Những khó khăn lớn khi triển khai & Giải pháp kỹ thuật

### Khó khăn 1: Sự không ổn định của định dạng dữ liệu đầu vào (E.g. Email, Reports)
*   **Chi tiết:** Email "Job Snapshot" hoặc các file Sao kê có thể thay đổi tiêu đề, cấu trúc bảng biểu hoặc định dạng file do Newgen/CQG nâng cấp hệ thống. Nếu parser của Bot viết cứng (hardcode), Bot sẽ đọc sai kết quả hoặc bị crash.
*   **Giải pháp:** 
    *   Sử dụng cơ chế **Template Parsing** động hoặc cấu hình Regex trong Database để Admin có thể tự cập nhật mẫu email/file quét khi đối tác thay đổi cấu trúc.
    *   Thiết lập **Fallback to Operator**: Nếu Bot không thể parse dữ liệu hoặc nghi ngờ kết quả (confidence score thấp), Bot không được tự ý ghi nhận thành công mà phải chuyển task thành trạng thái `NEEDS_ATTENTION` để người trực ca kiểm tra lại thủ công.

### Khó khăn 2: Độ trễ API và Cảnh báo giả (False Positive)
*   **Chi tiết:** CQG và M-System lệch nhau vài giây/mili-giây do độ trễ truyền tải mạng, dẫn đến việc Bot chạy đối chiếu định kỳ báo lệch lệnh (nhưng thực tế 1 giây sau dữ liệu đã tự cân bằng). Điều này gây ra rất nhiều "cảnh báo rác", làm loãng sự tập trung của Operator.
*   **Giải pháp:**
    *   Áp dụng **Grace Period / Retry Mechanism**: Khi phát hiện lệch lệnh, Bot không tạo sự cố ngay lập tức. Bot sẽ tự động thử lại (retry) 3 lần, mỗi lần cách nhau 30 giây. Chỉ khi sau 3 lần vẫn lệch thì mới chính thức kích hoạt Incident.

### Khó khăn 3: Rủi ro pháp lý và tài chính từ các hành động nguy hiểm (Force Close, Duyệt Ký quỹ)
*   **Chi tiết:** Các hành động như hủy lệnh chờ, đóng vị thế bắt buộc (Force Close) khi đáo hạn hợp đồng, hoặc duyệt ký quỹ hàng hóa nếu để Bot tự động thực hiện hoàn toàn có thể dẫn đến thiệt hại tài chính khổng lồ cho Thành viên Kinh doanh (TVKD) nếu Bot bị lỗi logic.
*   **Giải pháp (Bắt buộc):**
    *   Áp dụng mô hình **Human-in-the-loop (Bán tự động)**. Bot thực hiện các bước chuẩn bị (quét tài khoản vi phạm, chuẩn bị sẵn lệnh đóng vị thế) và hiển thị nút phê duyệt kèm cảnh báo đỏ rực trên UI. Operator hoặc Approver bắt buộc phải nhấn "Xác nhận hành động" bằng tay thì lệnh mới được gửi đi.

---

## 3. Đánh giá Ưu điểm & Nhược điểm của giải pháp Bot tự động

### Ưu điểm (Pros)
*   **Giảm thiểu lỗi con người (Human Errors):** Đặc biệt là trong ca trực đêm/sáng sớm (04h00 - 06h00) khi Operator dễ bị mệt mỏi và bỏ sót các chi tiết nhỏ trong sao kê hoặc email snapshot.
*   **Thời gian phản hồi tức thì (Realtime SLA):** Bot phát hiện lỗi hệ thống, lệch lệnh trong vòng vài giây và bắn cảnh báo ngay lập tức, giúp xử lý sự cố trong "khung giờ vàng" (ví dụ: thông báo sự cố trong 5 phút theo quy trình).
*   **Tập trung hóa nguồn lực:** Operator không cần ngồi làm các công việc lặp đi lặp lại (click tick chọn, gõ copy báo cáo), họ chỉ đóng vai trò giám sát và tập trung xử lý các sự cố phức tạp.

### Nhược điểm (Cons) & Giải pháp khắc phục

*   **Chi phí phát triển và bảo trì cao:** Bot phụ thuộc rất nhiều vào các hệ thống bên thứ ba (CQG Cast, Newgen, M-System, Mail server). Chỉ cần một trong các bên này thay đổi API, cơ chế bảo mật (OAuth2, MFA) hoặc cấu trúc dữ liệu, Bot sẽ bị hỏng và cần kỹ sư lập trình vào sửa lại code.
    *   **💡 Giải pháp:**
        *   **Adapter / Gateway Pattern:** Không gọi trực tiếp API của CQG hay Newgen từ Bot logic. Thiết lập một lớp Adapter trung gian làm nhiệm vụ dịch chuyển dữ liệu (Data Transformer). Khi bên thứ ba đổi API, bạn chỉ cần viết lại Adapter mà không phải sửa lõi của Bot.
        *   **Low-code Parser Configuration:** Lưu các cấu hình parse dữ liệu (Regex lấy nội dung email, JSON Path lấy kết quả API) vào database dưới dạng cấu hình động. Khi họ thay đổi mẫu mail hay định dạng JSON, chỉ cần sửa cấu hình regex trên Admin UI mà không cần deploy lại code.
        *   **Contract Testing:** Viết các bộ test tự động (sử dụng mock data hoặc API sandbox) chạy định kỳ hàng giờ để kiểm tra xem API của bên thứ ba có trả về đúng format cam kết không. Điều này giúp phát hiện lỗi API của đối tác trước khi đến thời điểm trực ca.
*   **Rủi ro lỗi dây chuyền (Cascade Failure):** Nếu hệ thống tự động hóa không có cơ chế cách ly tốt, lỗi của Bot có thể làm nghẽn hàng đợi (Queue), dẫn đến việc trễ SLA của toàn bộ các task khác trong checklist ca trực.
    *   **💡 Giải pháp:**
        *   **Queue Isolation (Cô lập hàng đợi):** Không dùng chung một Queue cho tất cả các tác vụ. Chia làm nhiều Queue độc lập (ví dụ: `email-scan-queue`, `data-reconcile-queue`, `alert-telegram-queue`). Lỗi ở queue quét email không thể làm chậm hàng đợi gửi cảnh báo.
        *   **Circuit Breaker Pattern (Bộ ngắt mạch):** Nếu API đối tác bị sập liên tiếp (ví dụ: gọi API CQG lỗi 5 lần liên tục), Circuit Breaker sẽ tự động ngắt kết nối tạm thời trong 15 phút. Trong thời gian này, Bot tự động chuyển task tương ứng sang trạng thái `FAILED` hoặc `MANUAL_REQUIRED` để Operator trực làm tay, tránh việc liên tục gửi request lỗi làm treo hàng đợi và tài nguyên CPU.
        *   **Dead Letter Queue (DLQ) & Timeouts:** Bắt buộc áp dụng HTTP Timeout ngắn (tối đa 5-10 giây) cho mọi kết nối bên thứ ba để tránh treo thread. Nếu một job trong queue bị lỗi và retry quá 3 lần, tự động chuyển job đó sang một hàng đợi lỗi riêng (DLQ) để phân tích sau, giải phóng ngay hàng đợi chính cho các task tiếp theo.

---

## 4. Lời khuyên thiết kế hệ thống để tương thích với Bot (Không phải đập đi xây lại)

Để ngày mai bạn viết code (NestJS + NextJS) mà sau này tích hợp Bot dễ dàng, hãy tuân thủ các nguyên tắc sau:

1.  **Thiết kế API hướng sự kiện (Event-Driven API):**
    *   Tất cả các API cập nhật trạng thái checklist phải hỗ trợ nhận diện tác nhân (`actorType`: `OPERATOR` hoặc `BOT`).
    *   Lưu lịch sử audit log rõ ràng: *"Bot tự động chuyển trạng thái task sang PASSED do tìm thấy email Snapshot lúc 05:01"*.
2.  **Sử dụng hàng đợi Queue (E.g. BullMQ trong NestJS):**
    *   Các tác vụ quét email, gọi API đối chiếu định kỳ nên được đẩy vào Queue xử lý bất đồng bộ để tránh làm block API chính của người dùng trực ca.
3.  **Thiết kế UI hỗ trợ trạng thái "Auto-checked by Bot":**
    *   Trên giao diện NextJS, các task được bot check tự động cần có biểu tượng riêng (ví dụ: hình Robot nhỏ màu xanh) để người trực ca biết task nào đã được tự động hóa, task nào cần làm tay.
