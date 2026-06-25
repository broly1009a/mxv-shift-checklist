# Phân Tích Tác Vụ: Tự Động vs. Thủ Công

## Tiêu chí phân loại

| Phân loại | Định nghĩa |
| :--- | :--- |
| 🟢 **Tự động hóa được** | Hệ thống có thể tự thực hiện dựa trên lịch trình (cron), sự kiện (event trigger), hoặc API mà không cần con người thao tác. |
| 🟡 **Bán tự động** | Hệ thống tự kiểm tra và cảnh báo / nhắc nhở, nhưng con người vẫn cần xem kết quả và xác nhận thực hiện hành động cuối cùng. |
| 🔴 **Bắt buộc thủ công** | Yêu cầu phán đoán chuyên môn, phê duyệt con người, phối hợp đa bên, hoặc thao tác trực tiếp trên hệ thống bên thứ 3 (Newgen, CQG Cast...) mà không có API. |

---

## 1. Phân Tích Quy Trình Vận Hành Chính Theo Timeline

| Mốc Thời Gian | Tác vụ chính | Phân loại | Lý do phân loại & Yêu cầu chi tiết cho hệ thống |
| :--- | :--- | :---: | :--- |
| **05h00** | Kiểm tra Job Snapshot | 🟡 Bán tự động | Hệ thống **tự động kiểm tra email** kết quả Job Snapshot (qua email parser hoặc API email). Nếu không có email thành công → **tự động gửi cảnh báo** cho trực ca. Nhân viên xem cảnh báo rồi **tự phán đoán có cần phối hợp Newgen** không. |
| **05h00** | Kiểm tra EOD OMS, lệnh MM OMS | 🟡 Bán tự động | Hệ thống **tự query API** trạng thái EOD CCP/CE và lệnh MM vào mốc 05h00. Trả ra dashboard/cảnh báo. Nhân viên **xem kết quả và xác nhận** tác vụ checklist. |
| **06h00 - 07h00** | Đối chiếu & Chạy EOD MS | 🔴 Bắt buộc thủ công | **Đối chiếu** yêu cầu so sánh dữ liệu thực tế M-System vs CQG vs ACM → cần chuyên môn để xử lý lệch. **Chạy EOD thủ công** là thao tác trực tiếp trên phần mềm M-System của Newgen, không có API để gọi từ bên ngoài. |
| **Sau EOD thành công** | Backup file kết quả EOD | 🟢 Tự động hóa được | Bot/script **tự download** file kết quả EOD từ hệ thống M-System về máy chủ lưu trữ theo lịch (triggered sau khi EOD = thành công). |
| **Sau EOD thành công** | Kiểm tra tài khoản âm ký quỹ & thông báo | 🟡 Bán tự động | Hệ thống **tự query danh sách TKGD âm ký quỹ** qua API M-System hoặc file EOD. Tự tổng hợp và **gửi email cảnh báo nội bộ** tự động. Nhân viên xác nhận và theo dõi xử lý. |
| **Sau EOD (trong 30p)** | Thực hiện SOD | 🔴 Bắt buộc thủ công | SOD (Start of Day) là thao tác trực tiếp trong phần mềm M-System (Newgen). Không có API ngoài để kích hoạt. Nhân viên bắt buộc **thao tác thủ công trên giao diện M-System**. |
| **01 - 02 giờ sau EOD** | Đồng bộ CQG (Sync CQG) | 🔴 Bắt buộc thủ công | Sync CQG Cast là thao tác **trực tiếp trên phần mềm CQG Cast**. Cần kiểm tra bằng mắt xem CQG đã reset xong chưa, sau đó mới nhấn Sync. Không thể tự động hoàn toàn nếu không có API CQG Cast. |
| **Sau EOD (trước 08h00)** | Gửi Sao kê TKGD thủ công | 🟡 Bán tự động | Hệ thống **tự tổng hợp dữ liệu Sao kê** từ file EOD và **tự gửi email** theo danh sách TKGD. Nhân viên **chỉ cần trigger lệnh gửi** hoặc xác nhận trước khi gửi hàng loạt. Hoặc cấu hình tự động sau khi EOD xác nhận OK. |
| **08h00** | Thay đổi ký quỹ hàng hoá | 🔴 Bắt buộc thủ công | **Maker-Checker 4 mắt bắt buộc.** Ca 1 tạo bản ghi → Ca 2 duyệt. Phải có mặt Trưởng bộ phận. Yêu cầu phán đoán nghiệp vụ tài chính. Hệ thống chỉ **hỗ trợ luồng Maker-Checker** (đã có trong mxv-shift-checklist). |
| **Định kỳ 01 giờ / lần** | Giám sát & Đối chiếu M-System vs CQG | 🟡 Bán tự động | Hệ thống **tự so sánh số liệu** M-System vs CQG theo cron mỗi 1 giờ. **Tự phát cảnh báo** nếu phát hiện lệch. Nhân viên **xem cảnh báo và xử lý** phần lệch (xử lý lệch là thủ công). |
| **Định kỳ 01 tháng / lần** | Mở mới hợp đồng giao dịch | 🔴 Bắt buộc thủ công | Mở mới hợp đồng Futures/Spreads/ACM cần **thiết lập nhiều tham số phức tạp** trực tiếp trên M-System và CQG. Yêu cầu chuyên môn nghiệp vụ để thiết lập đúng. Không thể tự động hóa hoàn toàn. |
| **Khi phát sinh** | Hỗ trợ & Xử lý sự cố | 🔴 Bắt buộc thủ công | Toàn bộ các hành động phản ứng (tiếp nhận, phán đoán, phối hợp, sửa lỗi) đều cần con người. Hệ thống chỉ **ghi nhận sự cố (Incident)** và **tracking trạng thái xử lý** (đã có module Incidents). |
| **Theo mốc đáo hạn** | Giám sát tất toán hợp đồng | 🟡 Bán tự động | Hệ thống **tự tính mốc đáo hạn** và **tự gửi thông báo nhắc nhở** cho TVKD. Nếu hết hạn mà TVKD chưa tự xử lý → **cảnh báo nhân viên** để hủy lệnh/đóng vị thế bắt buộc (bước này vẫn thủ công). |
| **16h00; 23h00; 05h00** | Báo cáo Ban giám sát | 🟡 Bán tự động | Hệ thống **tự tổng hợp thống kê** DSGD, TTM... theo các mốc giờ định sẵn. Tự tạo file báo cáo. Nhân viên **chỉ cần gửi file đã tổng hợp** lên nhóm Whatsapp (bước gửi Whatsapp cần người). |
| **04h00 - 05h00** | Backup dữ liệu cuối phiên | 🟡 Bán tự động | **Backup M-System, CQG, ACM**: script tự động download/export. **CE và ACM ưu tiên trước** → cần cấu hình thứ tự. Tổng hợp thành báo cáo mẫu có thể bán tự động qua template. Nhân viên xác nhận kết quả. |

---

## 2. Phân Tích Kịch Bản Xử Lý Sự Cố

### 1. Trường hợp EOD / SOD Lỗi

| Mốc | Nội dung | Phân loại | Ghi chú cho hệ thống |
| :--- | :--- | :---: | :--- |
| Quá 07h30 vẫn chưa EOD xong | Thông báo lùi EOD + gửi Sao kê cho TVKD | 🟡 Bán tự động | Hệ thống **tự phát hiện EOD chưa hoàn thành vào mốc 07h30** → tự gửi thông báo template cho TVKD. Nhân viên xác nhận nội dung trước khi gửi. |
| Trong 05p sau EOD lại thành công | Gửi email thông báo EOD hoàn tất | 🟢 Tự động hóa được | **Triggered tự động** khi trạng thái EOD chuyển sang SUCCESS. Gửi email theo mẫu đã định sẵn. |
| Trong 30p sau EOD được xác nhận | Gửi Sao kê TKGD thủ công | 🟡 Bán tự động | Như phân tích ở trên. Nhân viên trigger hoặc xác nhận trước khi gửi hàng loạt. |

### 2. Trường hợp Có Lỗi / Sự Cố Hệ Thống

| Mốc | Nội dung | Phân loại | Ghi chú cho hệ thống |
| :--- | :--- | :---: | :--- |
| Trong 05p từ khi phát hiện lỗi | Thông báo lỗi cho Newgen & CNTT | 🔴 Bắt buộc thủ công | Cần nhân viên **mô tả bản chất lỗi** trước khi thông báo. Hệ thống hỗ trợ **template thông báo sự cố** và **log sự cố tự động**. |
| Trong 10p từ khi phát hiện lỗi | Gửi email thông báo sự cố cho ĐVNV & TVKD | 🟡 Bán tự động | Hệ thống **chuẩn bị sẵn email template** theo loại sự cố. Nhân viên điền thông tin cụ thể và **bấm gửi**. |
| Sau khi xử lý xong | Thông báo sự cố đã khắc phục | 🟡 Bán tự động | Hệ thống **tự gửi email khắc phục** khi nhân viên đánh dấu Incident = RESOLVED. |
| Sau khi xử lý xong trong phiên | Cập nhật Báo cáo lỗi giao dịch (Mẫu 01/QT/TVH) | 🔴 Bắt buộc thủ công | Điền biểu mẫu nghiệp vụ chính thức, cần mô tả chi tiết sự cố. Chỉ có thể hỗ trợ **pre-fill dữ liệu từ Incident log**. |

### 3. Trường hợp Lệnh Không Cân Giữa Các Nền Tảng

| Mốc | Nội dung | Phân loại | Ghi chú cho hệ thống |
| :--- | :--- | :---: | :--- |
| Trong 30p từ khi phát hiện lệch | Xác định nguyên nhân & tài khoản lệch | 🟡 Bán tự động | Hệ thống **tự so sánh và highlight các TKGD bị lệch** trong báo cáo đối chiếu. Nhân viên **phân tích nguyên nhân**. |
| Sau khi tìm ra nguyên nhân | Thông báo TVKD bổ sung tham số + báo Newgen kéo lệnh | 🔴 Bắt buộc thủ công | Yêu cầu giao tiếp, phối hợp con người. Hệ thống hỗ trợ **ghi nhận kết quả xử lý** vào Incident log. |

### 4. Trường hợp Tiếp Nhận Thắc Mắc TVKD

| Mốc | Nội dung | Phân loại | Ghi chú cho hệ thống |
| :--- | :--- | :---: | :--- |
| Trong 15p từ khi tiếp nhận | Tìm hiểu nguyên nhân & tiếp nhận phản ánh | 🔴 Bắt buộc thủ công | Phán đoán nghiệp vụ, phân tích case. Hệ thống hỗ trợ **tạo ticket theo dõi** (Incident) và **ghi nhận SLA 15 phút**. |

---

## 3. Tổng Kết & Ưu Tiên Triển Khai

| Phân loại | Số tác vụ | Ưu tiên |
| :--- | :---: | :--- |
| 🟢 Tự động hóa được hoàn toàn | **2** | Triển khai ngay: Backup file EOD, Email thông báo EOD thành công |
| 🟡 Bán tự động (bot hỗ trợ + người xác nhận) | **9** | Ưu tiên cao: Dashboard giám sát, cảnh báo tự động, template email |
| 🔴 Bắt buộc thủ công (con người) | **7** | Hệ thống checklist hỗ trợ tracking, SLA, Maker-Checker flow |

> [!TIP]
> **Khuyến nghị chiến lược**: Các tác vụ 🟡 Bán tự động chính là mảnh đất màu mỡ nhất cho hệ thống `mxv-shift-checklist`. Thay vì cố tự động hóa hoàn toàn, hệ thống nên tập trung vào việc **hiện thị kết quả kiểm tra tự động + nhắc nhở đúng mốc giờ** để nhân viên chỉ cần xác nhận, không bỏ sót.

> [!IMPORTANT]
> **Các tác vụ 🔴 Thủ công cốt lõi** (chạy EOD, SOD, Sync CQG, Mở hợp đồng) **phụ thuộc hoàn toàn vào phần mềm của Newgen và CQG Cast** - là các hệ thống bên thứ 3 không có API công khai. Đây là giới hạn kỹ thuật cứng, không thể tự động hóa mà không có sự đồng ý và hỗ trợ từ phía nhà cung cấp.
