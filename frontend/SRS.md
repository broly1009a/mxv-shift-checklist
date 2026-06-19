TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
HỆ THỐNG SỐ HÓA CHECKLIST CA TRỰC VẬN HÀNH
1. MỤC TIÊU SPRINT: THÔNG BÁO & NHẮC NHỞ
Mục tiêu duy nhất của Sprint này là xây dựng cơ chế thông báo, nhắc nhở nội bộ và hỗ trợ tự động điền checkbox dựa theo kết quả đối soát để hỗ trợ 3 bộ phận (IT Vận Hành, Quản Lý Giao Dịch, Quản Lý Rủi Ro) thực hiện checklist ca trực hàng ngày, không in giấy.
2. ĐẶC TẢ CHI TIẾT NGHIỆP VỤ BÁM SÁT NOTE THU THẬP
2.1. Yêu cầu Note 1: Lịch làm việc 1 ngày theo 3 ca
Hệ thống chia luồng công việc theo các đầu mục của Lịch làm việc hàng ngày, vận hành theo 2 cấp độ:
Cấp 1: Tự tạo (thủ công):
Nhân viên trực ca tự tạo thủ công các đầu mục công việc của ngày/ca đó.
Báo cáo hoàn toàn được kiểm tra bằng tay (check tay).
Cấp 2: Tự động hóa hỗ trợ con người:
Thiết lập thời gian: Hệ thống có phần cài đặt mốc thời gian cho các đầu việc.
Bot nhắc nhở: Cứ đến giờ đã thiết lập, một con bot sẽ đưa ra cảnh báo, nhắc nhở nhân viên trực thực hiện đầu việc để không bị sót. Con bot này cũng hỗ trợ tạo sẵn các đầu mục công việc cho ca trực.
Ăn liền job tự động chạy: Đến đúng khung giờ, hệ thống tự động kích hoạt job chạy ngầm để hỗ trợ thực hiện tác vụ (Ví dụ cụ thể: Bot tự động chạy job quét kiểm tra dữ liệu backup hệ thống xem đã thành công hay chưa để đưa ra cảnh báo hoặc hỗ trợ điền trạng thái cho nhân viên).
2.2. Yêu cầu Note 2: Quản lý quy trình & Đối soát chéo
Mô tả cách thức nhân viên nghiệp vụ cấu hình công việc và giải pháp kiểm soát khi không in giấy:
Số hóa danh mục việc từ Người nghiệp vụ:
Sẽ có một nhân sự bên phía nghiệp vụ chịu trách nhiệm nhập và note đầy đủ toàn bộ các thông tin bắt buộc cho từng đầu việc, bao gồm: tên task, các đầu việc nhỏ, đường dẫn (URL) chức năng hệ thống, tài liệu đặc tả (URD), vị trí lấy file dữ liệu ở đâu, và danh sách khung giờ (list timetable).
Lưu ý cấu trúc tương lai (Hiện tại chưa cần): Chưa làm hệ thống tự cấu hình sinh workflow; chưa làm chức năng đánh giá/review cuối của người quản lý.
Cơ chế Check đối soát chéo (Điền checkbox hộ):
Hệ thống sẽ móc sang chức năng/dữ liệu của hệ thống đối soát để tự động kiểm tra quy tắc (check rule).
Nếu dữ liệu quét qua khớp hoàn toàn và hoàn thành, hệ thống sẽ tự động tích chọn vào ô checkbox (Auto-check) cho đầu việc đó, xác nhận hoàn thành mà nhân viên không cần tích tay.
Cơ chế này hoạt động theo nguyên tắc: "Cứ đến giờ là chạy => hoàn toàn tự động".
3. THIẾT KẾ CƠ SỞ DỮ LIỆU PHẲNG (MONGODB SCHEMAS)
Sử dụng cấu trúc tài liệu lồng nhau (Embedded Document) để lưu trọn vẹn danh mục việc của ca trực trong một bản ghi duy nhất, phân tách cho 3 bộ phận độc lập (IT_CORE, QLGD_OPS, QLRR_RISK).
3.1. Collection: checklist_templates (Mẫu cấu hình việc của nghiệp vụ)
JSON
{
  "_id": "ObjectId",
  "departmentCode": "String", // "IT_CORE" | "QLGD_OPS" | "QLRR_RISK"
  "sessionType": "String",    // "OPEN" | "DURING" | "CLOSE"
  "tasks": [
    {
      "taskId": "String",
      "taskName": "String",
      "priority": "String",   // "CRITICAL" | "HIGH" | "MEDIUM"
      "timetable": "String",   // Khung giờ thực hiện (list timetable)
      "checkMethod": "String", // "MANUAL" (Check tay) | "AUTO_CHECK" (Bot đối soát chạy tự động)
      "instructions": {
        "urlReference": "String",    // Đường dẫn chức năng (url)
        "urdReference": "String",    // Tài liệu đặc tả (urd)
        "fileLocation": "String"     // Lấy file ở đâu
      }
    }
  ]
}

3.2. Collection: shift_logs (Nhật ký ca trực chạy thực tế)
JSON
{
  "_id": "ObjectId",
  "date": "String",           // YYYY-MM-DD
  "departmentCode": "String", // "IT_CORE" | "QLGD_OPS" | "QLRR_RISK"
  "status": "String",         // "OPENING" | "CLOSED"
  "createdAt": "Date",        // Tạo thủ công (Cấp 1) hoặc Bot tự động tạo hộ (Cấp 2)
  "details": [
    {
      "taskId": "String",
      "taskName": "String",
      "status": "String",     // "PENDING" | "PASSED"
      "checkedAt": "Date",
      "updatedBy": "String",  // "STAFF" (Tích tay) | "AUTOMATION_JOB" (Hệ thống tự động điền hộ)
      "note": "String"
    }
  ]
}

4. LOGIC XỬ LÝ HỆ THỐNG (SYSTEM LOGIC)
Chức năng Nhắc nhở (Cấp độ 2):
Hệ thống dựa vào dữ liệu thiết lập thời gian (timetable). Đến giờ cấu hình, Job ngầm (NestJS) tự động chạy, gửi lệnh kích hoạt con Bot đưa ra cảnh báo nhắc nhở cho nhân viên trực ca.
Chức năng Tự động điền Checkbox (Đối soát chéo):
Đến giờ quy định ("Cứ đến giờ là chạy"), hệ thống tự động chạy các job quét ngầm (Ví dụ: quét đối soát dữ liệu hệ thống hoặc dữ liệu file backup nội bộ).
Nếu kết quả quét qua khớp rule và hoàn thành, hệ thống tự động cập nhật trạng thái ô checkbox tương ứng trong mảng details thành PASSED, trường updatedBy ghi nhận là AUTOMATION_JOB để nhân viên nhìn thấy trạng thái thay đổi theo thời gian thực trên giao diện Web.



