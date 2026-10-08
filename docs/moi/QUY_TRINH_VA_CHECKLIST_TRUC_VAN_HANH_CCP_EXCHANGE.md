# TÀI LIỆU QUY TRÌNH & CHECKLIST TRỰC VẬN HÀNH HỆ THỐNG CCP & EXCHANGE

> **Tài liệu gốc tham chiếu:** [`Checklist trực vận hành.docx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/Checklist%20tr%E1%BB%B1c%20v%E1%BA%ADn%20h%C3%A0nh.docx)  
> **Quy chuẩn đối chiếu:** Tuân thủ nghiêm ngặt Quy tắc Kiểm soát AI & Chứng cứ Ràng buộc (Proof of Ground Truth).  
> **Cấu trúc tài liệu:**
> - **PHẦN A:** Nguyên văn Quy chuẩn gốc (Ground Truth 100% - Bảo toàn từng câu chữ từ file Word gốc, không thêm thắt suy đoán).
> - **PHẦN B:** Đề xuất kỹ thuật & Ánh xạ tham số số hóa (Dành cho Admin/Lập trình viên tham khảo khi tạo Task Template và cấu hình Bot).

---

# PHẦN A: NGUYÊN VĂN QUY CHUẨN GỐC (GROUND TRUTH 100%)
*(Toàn bộ nội dung dưới đây được trích xuất nguyên mẫu từ văn bản chính thức `Checklist trực vận hành.docx`)*

---

## 1. PHÂN HỆ CCP

### 1.1. CCP - CHECKLIST VẬN HÀNH ĐẦU NGÀY

* **Ngày:** ……………
* **Ca trực / Nhân sự thực hiện:** ………………………
* **Lưu ý:** Cột “Kết quả” dùng để đánh dấu **Đạt / Không đạt**; cột “Ghi chú/Xử lý” ghi rõ nguyên nhân, thao tác thủ công hoặc đầu mối phối hợp khi có lỗi.

| STT | Hạng mục kiểm tra | Kết quả | Ghi chú/Xử lý *(Nguyên văn Word)* |
| :---: | :--- | :---: | :--- |
| **1** | Kiểm tra trạng thái máy chủ/hạ tầng | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **2** | Kiểm tra tài nguyên CPU/RAM/Disk | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **3** | Kiểm tra dịch vụ ứng dụng trọng yếu | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **4** | Kiểm tra cơ sở dữ liệu/replication | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **5** | Kiểm tra monitoring và alerting | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **6** | Kiểm tra log tập trung | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **7** | Kiểm tra đồng bộ thời gian | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **8** | Kiểm tra kết nối với đối tác/hệ thống ngoài | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **9** | Kiểm tra batch/job đầu ngày | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **10** | Kiểm tra tồn đọng sự cố/cảnh báo từ ca trước | Đạt / Không đạt | *(Trống trong văn bản gốc)* |

* **Kết luận đầu ngày:** ………………………………………………………………………………………………………………………………………………………………………………
* **Người thực hiện:** ………………………
* **Người kiểm tra/xác nhận:** ………………………

---

### 1.2. CCP - CHECKLIST VẬN HÀNH CUỐI NGÀY

* **Ngày:** ……………
* **Ca trực / Nhân sự thực hiện:** ………………………
* **Lưu ý:** Cột “Kết quả” dùng để đánh dấu **Đạt / Không đạt**; cột “Ghi chú/Xử lý” ghi rõ nguyên nhân, thao tác thủ công hoặc đầu mối phối hợp khi có lỗi.

| STT | Hạng mục kiểm tra | Kết quả | Ghi chú/Xử lý *(Nguyên văn Word)* |
| :---: | :--- | :---: | :--- |
| **1** | Kiểm tra hoàn thành job cuối ngày | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **2** | Kiểm tra trạng thái đồng bộ dữ liệu | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **3** | Kiểm tra log lỗi/batch lỗi | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **4** | Kiểm tra sao lưu dữ liệu | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **5** | Kiểm tra lưu trữ log/nghiệp vụ kỹ thuật | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **6** | Kiểm tra cảnh báo tồn đọng | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **7** | Ghi nhận sự cố phát sinh trong ngày | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **8** | Xác nhận trạng thái hệ thống cuối ngày | Đạt / Không đạt | *(Trống trong văn bản gốc)* |

* **Kết luận cuối ngày:** ………………………………………………………………………………………………………………………………………………………………………………
* **Người thực hiện:** ………………………
* **Người kiểm tra/xác nhận:** ………………………

---

### 1.3. CCP - CHECKLIST VẬN HÀNH CHI TIẾT
*(Bảo toàn nguyên vẹn số thứ tự STT và nội dung theo văn bản gốc)*

* **Lưu ý:** Cột “Kết quả” dùng để đánh dấu **Đạt / Không đạt**; cột “Ghi chú/Xử lý” ghi rõ nguyên nhân, thao tác thủ công hoặc đầu mối phối hợp khi có lỗi.

| STT *(gốc)* | Mốc thời gian | Nội dung vận hành | Điểm kiểm tra/xác nhận | Kết quả | Ghi chú/Xử lý *(Nguyên văn Word)* |
| :---: | :---: | :--- | :--- | :---: | :--- |
| **3** | **04:00 (CLOSE)** | CCP giải tỏa lệnh theo Exchange | Kiểm tra danh sách lệnh tại CCP sau đồng bộ Exchange | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **4** | **04:15 (Reconcile Orders)** | Reconcile tự động | Có thông báo chạy reconcile thành công | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **5** | **04:15 (Reconcile Orders)** | Đối chiếu lệnh khớp và lệnh còn hiệu lực | Kiểm tra màn hình tra cứu đối chiếu lệnh | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **6** | **04:15 (Reconcile Orders)** | Cập nhật giá thanh toán mới | Kiểm tra tại cửa sổ giá thanh toán | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **7** | **04:15 (Reconcile Orders)** | Cập nhật hàng hóa, hợp đồng mới theo Exchange | Kiểm tra cửa sổ hàng hóa/hợp đồng | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **8** | **04:15 (Reconcile Orders)** | Trường hợp CCP khớp nhiều hơn Exchange | Xác định và ghi nhận nếu phải xử lý hủy khớp thủ công | Đạt / Không đạt | **Phối hợp với IT, đối tác công nghệ để kiểm tra nếu cần** |
| **9** | **04:15 (Reconcile Orders)** | Trường hợp CCP khớp ít hơn Exchange | Xác nhận đã khớp bù tự động trong tiến trình reconcile | Đạt / Không đạt | **Phối hợp với IT, đối tác công nghệ để kiểm tra nếu cần** |
| **10** | **04:15 (Reconcile Orders)** | Gửi csv về thành viên | Kiểm tra các file csv trên SFTP | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **11** | **04:35 (SOD)** | SOD hệ thống tự động | Có thông báo snapshot dữ liệu ngày T thành công | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **14** | **04:35 (SOD)** | Chuyển phiên làm việc T+1 | Có thông báo đổi ngày phiên T+1 thành công | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **15** | **04:35 (SOD)** | Backup dữ liệu sang lịch sử | Xác nhận job backup dữ liệu lịch sử hoàn thành | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **16** | **05:30 (EOD)** | EOD hệ thống tự động | Tự động thanh toán lãi lỗ T-1 thành công | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **17** | **05:30 (EOD)** | Tự động sinh file csv nộp/rút tiền | Kiểm tra file trên SFTP | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **18** | **Trong phiên 05:00–04:00** | Các tác vụ, thiết lập tại CCP hoạt động bình thường | Thực hiện giao dịch bình thường trên toàn bộ Core CCP | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **20** | **Trong phiên 05:00–04:00** | Monitor thủ công lệnh giữa CCP và Exchange | Kiểm tra đối chiếu thủ công tại các mốc 09:00, 11:30, 14:00, 17:30 hoặc định kỳ 02h một lần | Đạt / Không đạt | *(Trống trong văn bản gốc)* |

---

### 1.4. CCP - MẪU NHẬT KÝ TRỰC VẬN HÀNH

* **Thời gian bắt đầu ca trực:** ……………
* **Thời gian kết thúc ca trực:** ……………
* **Nhân sự trực:** ......................................................................................................................................................

| Thời gian | Nội dung theo dõi/xử lý | Mức độ | Kết quả | Người thực hiện |
| :---: | :--- | :---: | :---: | :---: |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

* **Bàn giao ca:** ………………………………………………………………………………………………………………………………………………………………………………

---

### 1.5. CCP - MẪU BIÊN BẢN SỰ CỐ CNTT

| Nội dung | Thông tin |
| :--- | :--- |
| **Mã sự cố** | ……………………… |
| **Thời gian phát hiện** | ……………………… |
| **Người phát hiện** | ……………………… |
| **Hệ thống bị ảnh hưởng** | ……………………… |
| **Mức độ sự cố** | M1 / M2 / M3 |

* **Mô tả sự cố:**
  ......................................................................................................................................................
* **Phạm vi ảnh hưởng:**
  ......................................................................................................................................................
* **Biện pháp xử lý ban đầu:**
  ......................................................................................................................................................
* **Kết quả khắc phục:**
  ......................................................................................................................................................
* **Nguyên nhân sơ bộ / nguyên nhân gốc:**
  ......................................................................................................................................................
* **Kiến nghị phòng ngừa tái diễn:**
  ......................................................................................................................................................

| Người lập biên bản | Người phê duyệt/xác nhận |
| :---: | :---: |
| *(Ký, ghi rõ họ tên)* | *(Ký, ghi rõ họ tên)* |

---

## 2. PHÂN HỆ EXCHANGE

### 2.1. EXCHANGE - CHECKLIST VẬN HÀNH ĐẦU NGÀY

* **Ngày:** ……………
* **Ca trực / Nhân sự thực hiện:** ………………………
* **Lưu ý:** Cột “Kết quả” dùng để đánh dấu **Đạt / Không đạt**; cột “Ghi chú/Xử lý” ghi rõ nguyên nhân, thao tác thủ công hoặc đầu mối phối hợp khi có lỗi.

| STT | Hạng mục kiểm tra | Kết quả | Ghi chú/Xử lý *(Nguyên văn Word)* |
| :---: | :--- | :---: | :--- |
| **1** | Kiểm tra trạng thái máy chủ/hạ tầng | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **2** | Kiểm tra tài nguyên CPU/RAM/Disk | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **3** | Kiểm tra dịch vụ ứng dụng trọng yếu | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **4** | Kiểm tra cơ sở dữ liệu/replication | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **5** | Kiểm tra monitoring và alerting | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **6** | Kiểm tra log tập trung | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **7** | Kiểm tra đồng bộ thời gian | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **8** | Kiểm tra kết nối với đối tác/hệ thống ngoài | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **9** | Kiểm tra batch/job đầu ngày | Đạt / Không đạt | *(Trống trong văn bản gốc)* |
| **10** | Kiểm tra tồn đọng sự cố/cảnh báo từ ca trước | Đạt / Không đạt | *(Trống trong văn bản gốc)* |

* **Kết luận đầu ngày:** ………………………………………………………………………………………………………………………………………………………………………………

---

### 2.2. EXCHANGE - MẪU NHẬT KÝ TRỰC VẬN HÀNH

* **Thời gian bắt đầu ca trực:** ……………
* **Thời gian kết thúc ca trực:** ……………
* **Nhân sự trực:** ......................................................................................................................................................

| Thời gian | Nội dung theo dõi/xử lý | Mức độ | Kết quả | Người thực hiện |
| :---: | :--- | :---: | :---: | :---: |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

* **Bàn giao ca:** ………………………………………………………………………………………………………………………………………………………………………………

---

### 2.3. EXCHANGE - MẪU BIÊN BẢN SỰ CỐ CNTT

| Nội dung | Thông tin |
| :--- | :--- |
| **Mã sự cố** | ……………………… |
| **Thời gian phát hiện** | ……………………… |
| **Người phát hiện** | ……………………… |
| **Hệ thống bị ảnh hưởng** | ……………………… |
| **Mức độ sự cố** | M1 / M2 / M3 |

* **Mô tả sự cố:**
  ......................................................................................................................................................
* **Phạm vi ảnh hưởng:**
  ......................................................................................................................................................
* **Biện pháp xử lý ban đầu:**
  ......................................................................................................................................................
* **Kết quả khắc phục:**
  ......................................................................................................................................................
* **Nguyên nhân sơ bộ / nguyên nhân gốc:**
  ......................................................................................................................................................
* **Kiến nghị phòng ngừa tái diễn:**
  ......................................................................................................................................................

| Người lập biên bản | Người phê duyệt/xác nhận |
| :---: | :---: |
| *(Ký, ghi rõ họ tên)* | *(Ký, ghi rõ họ tên)* |

---

# PHẦN B: ĐỀ XUẤT KỸ THUẬT & ÁNH XẠ SỐ HÓA ĐỂ TẠO TASK TRÊN HỆ THỐNG
*(LƯU Ý: Phần này là **Đề xuất kỹ thuật của đội ngũ phát triển** dựa trên kiến trúc hệ thống `mxv-shift-checklist`, KHÔNG PHẢI quy định chính thức trong văn bản Word gốc. Admin cần rà soát trước khi cấu hình vào CSDL).*

---

### B.1. BẢNG ĐỀ XUẤT ÁNH XẠ THAM SỐ CẤU HÌNH TASK TEMPLATE

| Mã Task Đề Xuất | Tên Task Trên Hệ Thống | Mốc Giờ | Phân Loại Đề Xuất | Gợi Ý `botCheckType` | Gợi Ý SLA | Ghi Chú Kỹ Thuật |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `TASK_CCP_INFRA_OPEN` | Kiểm tra hạ tầng máy chủ CCP đầu ngày | 05:00 | 🤝 Bot + Maker | `CHECK_INFRA_HEALTH` | 15 phút | Kiểm tra CPU, RAM, Disk qua monitor API |
| `TASK_CCP_DB_OPEN` | Kiểm tra DB Replication & Dịch vụ CCP đầu ngày | 05:00 | 🤝 Bot + Maker | `CHECK_DB_HEALTH` | 15 phút | Kiểm tra trạng thái Cluster DB |
| `TASK_CCP_TIME_NTP` | Kiểm tra đồng bộ thời gian NTP | 05:15 |  Bot 100% | `CHECK_NTP_SYNC` | 10 phút | So khớp sai số thời gian hệ thống |
| `TASK_CCP_CLOSE_UNFREEZE`| CCP giải tỏa lệnh theo Exchange | 04:00 | 🤝 Bot + Maker | `VERIFY_ORDER_UNFREEZE` | 15 phút | Kiểm tra danh sách lệnh giải tỏa |
| `TASK_CCP_AUTO_RECON` | Tiến trình Reconcile lệnh tự động CCP | 04:15 |  Bot 100% | `CHECK_AUTO_RECON` | 10 phút | Assert kết quả execution job reconcile |
| `TASK_CCP_MATCH_ORDER_RECON`| Đối chiếu lệnh khớp & Lệnh còn hiệu lực | 04:15 | 🤝 Bot + Maker | `CHECK_ORDER_RECON` | 15 phút | Xem màn hình tra cứu đối chiếu lệnh |
| `TASK_CCP_SETTLEMENT_PRICE` | Cập nhật giá thanh toán mới (Settlement Price) | 04:15 | 🤝 Bot + Maker | `VERIFY_SETTLEMENT_PRICE`| 15 phút | Xác minh cửa sổ giá thanh toán |
| `TASK_CCP_SYNC_COMMODITIES` | Cập nhật hàng hóa, hợp đồng mới theo Exchange | 04:15 | 👤 Maker thủ công | — | 15 phút | Thao tác kiểm tra cửa sổ hàng hóa |
| `TASK_CCP_SFTP_CSV_MEMBER` | Kiểm tra file CSV gửi Thành viên trên SFTP | 04:15 |  Bot 100% | `CHECK_SFTP_MEMBER_FILES`| 15 phút | Bot quét file CSV trên máy chủ SFTP |
| `TASK_CCP_SOD_SNAPSHOT` | SOD hệ thống tự động (Snapshot ngày T) | 04:35 |  Bot 100% | `CHECK_SOD_SNAPSHOT` | 10 phút | Kiểm tra snapshot thành công |
| `TASK_CCP_SWITCH_T1` | Chuyển phiên làm việc sang T+1 | 04:35 | 🤝 Bot + Maker | `VERIFY_T1_SWITCH` | 10 phút | Kiểm tra thông báo đổi ngày phiên T+1 |
| `TASK_CCP_ARCHIVE_BACKUP` | Backup dữ liệu Core CCP sang lịch sử | 04:35 |  Bot 100% | `CHECK_BACKUP_ARCHIVE` | 15 phút | Xác nhận job backup lịch sử hoàn tất |
| `TASK_CCP_EOD_PNL` | EOD tự động (Thanh toán lãi/lỗ T-1) | 05:30 | 🤝 Bot + Maker | `CHECK_EOD_PNL` | 20 phút | Xác nhận thanh toán PnL hoàn tất |
| `TASK_CCP_CSV_CASH_FLOW` | Sinh file CSV nộp/rút tiền trên SFTP | 05:30 |  Bot 100% | `CHECK_SFTP_CASH_FLOW` | 15 phút | Quét kiểm tra file CSV nộp rút SFTP |
| `TASK_CCP_PERIODIC_MONITOR`| Monitor thủ công lệnh CCP vs Exchange | Định kỳ 2h | 🤝 Bot + Maker | `PERIODIC_ORDER_MONITOR` | Trong phiên | Khung giờ: 09:00, 11:30, 14:00, 17:30 |

---

### B.2. NGUYÊN TẮC ÁP DỤNG
1. **Phần A** là văn bản pháp lý & nghiệp vụ chuẩn mực – không được tự ý diễn giải thêm.
2. **Phần B** là cấu hình tham chiếu trên phần mềm: Khi Admin tạo Template trên Web, nếu quy trình thực tế của MXV thay đổi mốc giờ hay thời hạn SLA thì Admin chỉnh sửa trực tiếp trên giao diện `/admin/templates` mà không ảnh hưởng đến tính trung thực của Phần A.
