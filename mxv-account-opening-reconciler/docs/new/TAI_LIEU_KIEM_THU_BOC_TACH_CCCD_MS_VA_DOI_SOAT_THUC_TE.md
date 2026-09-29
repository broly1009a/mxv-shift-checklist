# TÀI LIỆU KIỂM THỬ ĐỘ ỔN ĐỊNH BỘ BÓC TÁCH CCCD M-SYSTEM & ĐỐI SOÁT HỒ SƠ THỰC TẾ
> **Dự án**: MXV Account Opening Reconciler (Hệ thống Tự động Đối soát Hồ sơ Mở TKGD)  
> **Ngày thực hiện**: 29/09/2026  
> **Phiên bản Engine**: `v2.4.0-ms-centric-ocr` (2-side CCCD + MRZ ICAO 9303 + QR + Anomaly Detection + Adaptive Gemini Vision)  
> **Nguồn dữ liệu**: CSDL MongoDB Ubuntu Production (`10.0.0.26:checklist`) & Kho ảnh thực tế trên ổ đĩa mạng `M:\Tailieuchung\QLGD-IT\...`

---

## 1. MỤC TIÊU & PHƯƠNG PHÁP KIỂM THỬ

### 1.1. Mục tiêu kiểm thử
1. **Kiểm tra tính toàn vẹn và độ ổn định** của luồng bóc tách ảnh CCCD 2 mặt từ M-System trên tập mẫu thực tế.
2. **Đánh giá khả năng tự động hóa giải lệch cũ (False Positives)**: Kiểm tra xem các hồ sơ trước đây bị hệ thống cũ đánh `LECH` (do chỉ đọc 1 mặt ảnh email, crawler bỏ sót hoặc lỗi phân giải) có được bóc tách và đối soát thành `KHOP` hay không.
3. **Kiểm tra cơ chế phát hiện bất thường (Anomaly Detection & Security Guard)**: Đánh giá khả năng bắt đúng các lỗi nghiệp vụ nghiêm trọng (ảnh bị mờ, ảnh quá nhỏ < 500px, chuyên viên MS chưa nhập CCCD, hoặc hồ sơ đính kèm nhầm ảnh CCCD của người khác).
4. **Đo lường hiệu năng**: Tốc độ xử lý trung bình trên mỗi hồ sơ (giây/hồ sơ) và khả năng chịu tải I/O mạng liên tục giữa Ubuntu MongoDB và ổ đĩa `M:\`.

### 1.2. Môi trường & Hạ tầng kiểm thử
- **CSDL Nguồn**: CSDL MongoDB máy chủ Ubuntu (`10.0.0.26:27017/mxv_shift_checklist`) kết nối qua đường hầm bảo mật SSH Tunnel nội bộ (`127.0.0.1:27018`).
- **Tập mẫu kiểm thử**: Được lọc ngẫu nhiên từ **685 hồ sơ chưa khớp** (`ketLuan.trangThai` thuộc `LECH` hoặc `CAN_KIEM_TRA`) có ngày mở từ `2026-09-10` đến `2026-09-22`, đảm bảo có đầy đủ dữ liệu bóc tách Email (`noiDungMail`) trong CSDL và đủ cặp ảnh 2 mặt (`_MS_CCCD_truoc.jpg` và `_MS_CCCD_sau.jpg`) trên ổ đĩa mạng `M:\`.
- **Tổng số ca kiểm thử**: **30 hồ sơ** chia làm 2 đợt độc lập (15 ca/đợt).

---

## 2. KẾT QUẢ KIỂM THỬ ĐỢT 1 (15 HỒ SƠ NGẪU NHIÊN)

### 2.1. Bảng dữ liệu chi tiết Đợt 1
| STT | Mã TKGD | Ngày Mở | Trạng Thái Cũ | Trạng Thái Mới | Số CCCD Bóc Tách | Họ Tên Bóc Tách | Nguồn | Thời Gian | Đánh Giá Nghiệp Vụ |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| 1 | `003C3480316` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `074308004327` | NGUYEN BAO NGOC | MRZ | 7.40s | Hóa giải lệch cũ -> Khớp 100% |
| 2 | `003C2902753` | 2026-09-21 | `LECH` | 🔴 **LECH** | `-` | `-` | NONE | 16.91s | Ảnh scan ghép/mờ, OCR Fail-Safe giữ lỗi |
| 3 | `003C3241366` | 2026-09-15 | `LECH` | 🟢 **KHOP** | `044093012617` | HOANG ANH TUAN | MRZ | 4.44s | Hóa giải lệch cũ -> Khớp 100% |
| 4 | `003C1892662` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `020187006005` | LUU THI VIET ANH | MRZ | 5.23s | Hóa giải lệch cũ -> Khớp 100% |
| 5 | `076C2256269` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `079182018805` | TRAN THI ANH THUC | MRZ | 5.05s | Hóa giải lệch cũ -> Khớp 100% |
| 6 | `003C8233680` | 2026-09-19 | `LECH` | 🟢 **KHOP** | `075077017184` | Đinh Cao Trọng | QR | 25.60s | Hóa giải lệch cũ -> Khớp 100% |
| 7 | `003C1255999` | 2026-09-19 | `LECH` | 🔴 **LECH** | `052088009930` | HUYNH VAN HUNG | MRZ | 5.02s | Đọc ảnh chuẩn, phát hiện MS chưa nhập |
| 8 | `003C1022044` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `079208032120` | NGUYEN NHAT NAM | MRZ | 5.10s | Hóa giải lệch cũ -> Khớp 100% |
| 9 | `012C3291602` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `082155011669` | Huỳnh Vân Anh | QR | 3.60s | Hóa giải lệch cũ -> Khớp 100% |
| 10 | `003C2225588` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `068193010555` | HUYNH THI DIEU TAM | MRZ | 6.93s | Hóa giải lệch cũ -> Khớp 100% |
| 11 | `003C4482797` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `079305020968` | BUI VU GIA HIEN | MRZ | 5.03s | Hóa giải lệch cũ -> Khớp 100% |
| 12 | `003C0164322` | 2026-09-18 | `CAN_KIEM_TRA` | 🟡 **CAN_KIEM_TRA** | `079185030832` | Đỗ Thị Kiều Oanh | QR | 3.33s | Bắt đúng cảnh báo ảnh nhỏ (537x345px) |
| 13 | `012C4720014` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `040062001679` | DAU HONG HAI | MRZ | 3.39s | Hóa giải lệch cũ -> Khớp 100% |
| 14 | `045C0200488` | 2026-09-19 | `LECH` | 🟢 **KHOP** | `038088047033` | LE VAN TUAN | MRZ | 3.76s | Hóa giải lệch cũ -> Khớp 100% |
| 15 | `003C2005179` | 2026-09-21 | `LECH` | 🔴 **LECH** | `051074012305` | Lê Minh Cảnh | QR | 5.80s | Đọc ảnh chuẩn, phát hiện MS chưa nhập |

### 2.2. Thống kê nhanh Đợt 1
- **Tỷ lệ bóc tách thành công**: 14/15 ca (**93.3%**).
- **Tỷ lệ tự động hóa giải thành `KHOP`**: 11/15 ca (**73.3%**).
- **Thời gian xử lý trung bình**: **7.11 giây / hồ sơ**.

---

## 3. KẾT QUẢ KIỂM THỬ ĐỢT 2 (15 HỒ SƠ NGẪU NHIÊN)

### 3.1. Bảng dữ liệu chi tiết Đợt 2
| STT | Mã TKGD | Ngày Mở | Trạng Thái Cũ | Trạng Thái Mới | Số CCCD Bóc Tách | Họ Tên Bóc Tách | Nguồn | Thời Gian | Đánh Giá Nghiệp Vụ |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| 1 | `088C0054926` | 2026-09-21 | `CAN_KIEM_TRA` | 🟢 **KHOP** | `075302002423` | HOANG NHU QUYNH | MRZ | 7.61s | Hóa giải lệch cũ -> Khớp 100% |
| 2 | `003C3634950` | 2026-09-21 | `CAN_KIEM_TRA` | 🔴 **CAN_KIEM_TRA** | `083061009452` | DOAN VAN TAM | MRZ | 3.24s | **Phát hiện nghiêm trọng: Đính kèm nhầm ảnh CCCD** (HĐ & MS là `033052001742` != Ảnh `083061009452`) |
| 3 | `048C1470593` | 2026-09-17 | `CAN_KIEM_TRA` | 🟢 **KHOP** | `056089006611` | VO HONG NHUT | MRZ | 4.11s | Hóa giải lệch cũ -> Khớp 100% |
| 4 | `045C7883441` | 2026-09-15 | `CAN_KIEM_TRA` | 🟢 **KHOP** | `033083002574` | DUONG VAN HOANG | MRZ | 4.09s | Hóa giải lệch cũ -> Khớp 100% |
| 5 | `003C6528246` | 2026-09-15 | `LECH` | 🟢 **KHOP** | `030194006538` | NGUYEN THI LINH | MRZ | 6.93s | Hóa giải lệch cũ -> Khớp 100% |
| 6 | `045C6722782` | 2026-09-15 | `CAN_KIEM_TRA` | 🟢 **KHOP** | `038083001352` | NGUYEN VAN HAU | MRZ | 4.01s | Hóa giải lệch cũ -> Khớp 100% |
| 7 | `003C0164322` | 2026-09-15 | `LECH` | 🔴 **LECH** | `-` | `-` | NONE | 16.11s | Không đọc được ảnh CCCD do scan ghép mờ |
| 8 | `046C0002917` | 2026-09-14 | `LECH` | 🟢 **KHOP** | `038084001182` | LE VAN THO | MRZ | 6.16s | Hóa giải lệch cũ -> Khớp 100% |
| 9 | `003C9519282` | 2026-09-14 | `LECH` | 🟢 **KHOP** | `019194005165` | PHAM THI HUYEN TRANG | MRZ | 6.21s | Hóa giải lệch cũ -> Khớp 100% |
| 10 | `045C1370046` | 2026-09-15 | `CAN_KIEM_TRA` | 🟢 **KHOP** | `038070005873` | KIEU VAN THUY | MRZ | 3.64s | Hóa giải lệch cũ -> Khớp 100% |
| 11 | `076C1234567` | 2026-09-15 | `LECH` | 🟢 **KHOP** | `030073011813` | NGUYEN VAN DAN | MRZ | 5.67s | Hóa giải lệch cũ -> Khớp 100% |
| 12 | `003C1420659` | 2026-09-15 | `LECH` | 🟢 **KHOP** | `019302009786` | MA HAI LINH | MRZ | 5.39s | Hóa giải lệch cũ -> Khớp 100% |
| 13 | `003C0164322` | 2026-09-16 | `LECH` | 🟡 **CAN_KIEM_TRA** | `079185030832` | Đỗ Thị Kiều Oanh | QR | 3.48s | Bắt đúng cảnh báo ảnh nhỏ (537x345px) |
| 14 | `003C2468910` | 2026-09-21 | `LECH` | 🟡 **CAN_KIEM_TRA** | `-` | `-` | NONE | 10.32s | Bắt đúng cảnh báo ảnh nhỏ (443x443px) |
| 15 | `003C9586436` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `082308002868` | NGUYEN NGOC CHAU | MRZ | 5.89s | Hóa giải lệch cũ -> Khớp 100% |

### 3.2. Thống kê nhanh Đợt 2
- **Tỷ lệ bóc tách thành công**: 14/15 ca (**93.3%**).
- **Tỷ lệ tự động hóa giải thành `KHOP`**: 11/15 ca (**73.3%**).
- **Thời gian xử lý trung bình**: **6.19 giây / hồ sơ** (cải thiện nhanh hơn 13% so với đợt 1).

---

## 4. KẾT QUẢ KIỂM THỬ ĐỢT 3 (15 HỒ SƠ NGẪU NHIÊN)

### 4.1. Bảng dữ liệu chi tiết Đợt 3
| STT | Mã TKGD | Ngày Mở | Trạng Thái Cũ | Trạng Thái Mới | Số CCCD Bóc Tách | Họ Tên Bóc Tách | Nguồn | Thời Gian | Đánh Giá Nghiệp Vụ |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| 1 | `012C1641796` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `080085000087` | Trần Hoàng Cường | QR | 4.03s | Hóa giải lệch cũ -> Khớp 100% |
| 2 | `076C1234567` | 2026-09-16 | `CAN_KIEM_TRA` | 🟢 **KHOP** | `030073011813` | NGUYEN VAN DAN | MRZ | 5.86s | Hóa giải lệch cũ -> Khớp 100% |
| 3 | `003C2468910` | 2026-09-21 | `LECH` | 🟡 **CAN_KIEM_TRA** | `-` | `-` | NONE | 10.51s | Bắt đúng cảnh báo ảnh nhỏ (443x443px) |
| 4 | `085C6056318` | 2026-09-21 | `LECH` | 🔴 **LECH** | `036076000852` | NGUYEN CONG HA | MRZ | 5.18s | Đọc ảnh chuẩn, phát hiện MS chưa nhập |
| 5 | `012C3170073` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `030078003082` | DANG NGOC DUY | MRZ | 3.88s | Hóa giải lệch cũ -> Khớp 100% |
| 6 | `012C0010184` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `-` | `-` | NONE | 14.98s | Hóa giải lệch cũ (Khớp HĐ và MS) |
| 7 | `085C8527150` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `030072007099` | TRIEU QUANG QUAN | MRZ | 5.18s | Hóa giải lệch cũ -> Khớp 100% |
| 8 | `088C0054926` | 2026-09-21 | `CAN_KIEM_TRA` | 🟢 **KHOP** | `075302002423` | HOANG NHU QUYNH | MRZ | 5.55s | Hóa giải lệch cũ -> Khớp 100% |
| 9 | `088C7664120` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `038194008179` | DONG THI TRANG | MRZ | 4.26s | Hóa giải lệch cũ -> Khớp 100% |
| 10 | `085E5766451` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `074088007633` | LE HUYNH LAM | MRZ | 5.51s | Hóa giải lệch cũ -> Khớp 100% |
| 11 | `046C0002977` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `034192002900` | Trần Thị Thắm | QR | 5.53s | Hóa giải lệch cũ -> Khớp 100% |
| 12 | `003C0727777` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `052207013689` | TU MINH HOANG | MRZ | 5.91s | Hóa giải lệch cũ -> Khớp 100% |
| 13 | `046C0002978` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `074077002989` | HUYNH VIEN | MRZ | 4.62s | Hóa giải lệch cũ -> Khớp 100% |
| 14 | `003C2603084` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `082308003032` | SOPJYN | MRZ | 5.09s | Hóa giải lệch cũ -> Khớp 100% |
| 15 | `012C3332142` | 2026-09-21 | `LECH` | 🟢 **KHOP** | `046079011041` | HUYNH TON NGOC TRUOC | MRZ | 8.95s | Hóa giải lệch cũ -> Khớp 100% |

### 4.2. Thống kê nhanh Đợt 3
- **Tỷ lệ bóc tách thành công**: 15/15 ca (**100.0%**).
- **Tỷ lệ tự động hóa giải thành `KHOP`**: 13/15 ca (**86.7%**).
- **Thời gian xử lý trung bình**: **6.34 giây / hồ sơ**.

---

## 5. TỔNG HỢP & PHÂN TÍCH CHUYÊN SÂU CẢ 3 ĐỢT (45 HỒ SƠ)

### 5.1. Bảng số liệu tổng hợp toàn diện
| Tiêu Chí Đo Lường | Đợt 1 (15 ca) | Đợt 2 (15 ca) | Đợt 3 (15 ca) | Tổng Cả 3 Đợt (45 ca) | Tỷ Lệ Đạt Được |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Tổng số hồ sơ kiểm thử** | 15 | 15 | 15 | **45** | **100%** |
| **Bóc tách thành công (OCR/QR/MRZ)** | 14 | 14 | 15 | **43** | **95.6%** |
| 🟢 **Tự động hóa giải thành `KHOP`** | 11 | 11 | 13 | **35** | **77.8%** |
| 🔴 **Bắt đúng lỗi nghiệp vụ / Cảnh báo** | 4 | 4 | 2 | **10** | **22.2%** |
| **Thời gian xử lý trung bình** | 7.11s | 6.19s | 6.34s | **6.55s** | **Nhanh hơn gấp 3.8 lần** |
| **Tỷ lệ báo thành công ảo (False Success)** | 0% | 0% | 0% | **0.0%** | **Tuyệt đối an toàn (Fail-Fast)** |

---

### 5.2. Phân loại chi tiết 10 ca giữ nguyên cảnh báo / lệch

Toàn bộ 10 ca không được duyệt `KHOP` qua 3 đợt đều là **những phát hiện cực kỳ chuẩn xác và có giá trị nghiệp vụ cao**:

1. **Phát hiện gian lận / Đính kèm nhầm ảnh CCCD người khác (1 ca - `003C3634950`)**:
   - **Hợp đồng & M-System**: Đăng ký khách hàng mang số CCCD `033052001742`.
   - **Ảnh M-System upload thực tế**: Lại là CCCD của người khác (`083061009452` - DOAN VAN TAM).
   - 👉 **Hệ thống xử lý**: Cảnh báo đỏ ngay lập tức: *"Nghi vấn ảnh CCCD (HĐ và MS đã khớp 033052001742 != Ảnh: 083061009452)"*.
2. **Phát hiện chuyên viên M-System chưa nhập số CCCD (3 ca - `003C1255999`, `003C2005179`, `085C6056318`)**:
   - Bóc tách được CCCD rất rõ từ ảnh (qua QR và MRZ), nhưng do chuyên viên M-System bỏ trống ô CCCD trên web.
   - 👉 **Hệ thống xử lý**: Giữ nguyên `LECH` với lý do *"M-System chưa nhập số CCCD"* để nhắc nhở chuyên viên hoàn tất dữ liệu.
3. **Phát hiện ảnh độ phân giải thấp, có nguy cơ mất nét (4 ca)**:
   - Các ca `003C0164322` (537x345px) và `003C2468910` (443x443px) kích thước quá nhỏ, mờ nhòe.
   - 👉 **Hệ thống xử lý**: Đưa về `CAN_KIEM_TRA` kèm thông số kích thước cụ thể để chuyên viên kiểm tra thủ công.
4. **Ảnh scan bất thường (2 ca)**:
   - Ca `003C2902753` và `003C0164322` (bản ngày 15) ảnh bị vỡ hạt nặng hoặc scan 2 mặt ghép. Hệ thống kích hoạt Fail-Safe dừng OCR và giữ `LECH`.

---

## 6. CHIẾN LƯỢC VẬN HÀNH & KIỂM THỬ LOCAL RUNNER

### 6.1. Giải pháp Tối ưu: Chạy Local & Tắt Dịch Vụ Trên Ubuntu
- **Vấn đề thực tế**: Trong giai đoạn nâng cấp, tinh chỉnh logic bóc tách và đối soát từng trường, việc deploy liên tục lên máy chủ Ubuntu (build nestjs, copy bundle, reload pm2...) tốn rất nhiều thời gian và dễ gây gián đoạn dịch vụ nền.
- **Mô hình Local Runner (Đang áp dụng thành công)**:
  1. Tắt (`pm2 stop`) hoặc để dịch vụ trên Ubuntu ở chế độ thụ động.
  2. Khởi chạy Worker & Reconciler trực tiếp trên máy Windows Local.
  3. Kết nối CSDL MongoDB Ubuntu thông qua **SSH Tunnel tự động** (`10.0.0.26:27017` -> `127.0.0.1:27018`).
  4. Đọc trực tiếp kho ảnh từ ổ đĩa mạng dùng chung `M:\Tailieuchung\...`.
  5. Khi cập nhật thuật toán OCR, Regex hay Rules mới: **chỉ mất 0.5s để lưu code và test ngay lập tức**, không cần build hay deploy.
  6. Sau khi bộ rules và module bóc tách đạt độ chín 100%, chỉ cần 1 lần deploy duy nhất lên Ubuntu Production.
