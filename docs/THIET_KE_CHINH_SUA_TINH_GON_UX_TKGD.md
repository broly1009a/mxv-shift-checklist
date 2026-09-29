# TÀI LIỆU CẬP NHẬT THIẾT KẾ TINH GỌN GIAO DIỆN & BỘ LỌC THỐNG KÊ NGHIỆP VỤ MỞ TKGD

**Dự án**: Hệ thống Thẩm định & Giám sát Mở Tài Khoản Giao Dịch (MXV Account Opening Reconciler)  
**Tác giả**: MXV Engineering & IT Operation  
**Ngày cập nhật**: 24/09/2026  
**Trạng thái**: Đã nghiệm thu & Triển khai thực tế  

---

## 1. Bối Cảnh & Vấn Đề Thực Tế (Problem Statement)

Trước đây, giao diện Dashboard Thống Kê ban đầu được thiết kế theo tư duy kỹ thuật (Dev-oriented), mang nặng các thuật ngữ của phân hệ ca trực và thiếu linh hoạt trong việc đánh giá tổng quan:

1. **Giao diện dùng nhiều thuật ngữ ca trực cứng nhắc**:
   - Tiêu đề: *"Bảng Thống Kê & Bàn Giao Ca Trực"*, *"Biên Bản Bàn Giao Ca"*, *"Hồ sơ tồn đọng cần bàn giao ca sau"*.
   - Trong thực tế nghiệp vụ thẩm định hồ sơ mở TKGD, cán bộ phòng Quản lý Giao dịch (QLGD) và Trung tâm Bù trừ (TTBT) không làm việc theo ca kíp nhà máy mà làm việc theo **giờ hành chính và phiên giao dịch của Sở** (Phiên Sáng: 08h00 - 12h00, Phiên Chiều: 13h00 - 17h30, Ngoài giờ: sau 17h30).
2. **Thiếu tính năng thống kê nhanh theo Tuần và theo Tháng**:
   - Hệ thống chỉ lọc được dữ liệu theo từng ngày riêng lẻ (`batchDate`).
   - Lãnh đạo Sở và Quản lý không có góc nhìn tổng quan (Scope) về khối lượng hồ sơ mở mới trong **7 ngày qua (Tuần)** hoặc **từ đầu tháng đến hiện tại (Tháng)** để đánh giá năng suất và tỷ lệ sai lệch của từng TVKD.
3. **Phân đoạn ca trực chưa phản ánh đúng khung giờ tiếp nhận thực tế**:
   - Chia thành: Ca Sáng (06h - 14h), Ca Chiều (14h - 22h), Ca Đêm (22h - 06h).
   - Khung giờ này lệch hoàn toàn so với chu kỳ làm việc thực tế của các Thành viên Kinh doanh và Sở.

---

## 2. Thiết Kế Mới: Đúng Chuẩn Nghiệp Vụ Sở Giao Dịch

### 2.1. Chuẩn Hóa Thuật Ngữ Nghiệp Vụ (Business Microcopy)

| Thành phần giao diện | Thuật ngữ cũ (Dev/Ca Trực) | Thuật ngữ mới (Chuẩn Nghiệp Vụ MXV) |
| :--- | :--- | :--- |
| **Tab chính** | `Thống Kê & Bàn Giao Ca` | **`Báo Cáo & Thống Kê`** |
| **Tiêu đề Dashboard** | `Bảng Thống Kê & Bàn Giao Ca Trực` | **`Báo Cáo Thống Kê Giám Sát Mở TKGD`** |
| **Bộ lọc thời gian** | `Phân đoạn ca trực` | **`Khung giờ tiếp nhận`** |
| **Phiên 1** | `Ca Sáng (06h - 14h)` | **`Phiên Sáng (08h00 – 12h00)`** |
| **Phiên 2** | `Ca Chiều (14h - 22h)` | **`Phiên Chiều (13h00 – 17h30) 🔥 Cao điểm`** |
| **Phiên 3** | `Ca Đêm (22h - 06h)` | **`Ngoài Giờ Hành Chính (Sau 17h30)`** |
| **Thẻ KPI 1** | `Toàn bộ hồ sơ trong ca` | **`Toàn bộ hồ sơ tiếp nhận`** |
| **Danh sách Watchlist** | `Hồ sơ tồn đọng cần bàn giao ca sau` | **`Danh sách hồ sơ tồn đọng cần xử lý`** |
| **Cột bảng Watchlist** | `Hành động ca sau` | **`Biện pháp xử lý`** |
| **Nút hành động chính**| `Xuất Biên Bản Bàn Giao Ca` | **`Xuất Báo Cáo Đối Soát`** |
| **Modal Báo Cáo** | `Biên Bản Bàn Giao Ca Trực TKGD` | **`Báo Cáo Thẩm Định & Đối Soát Hồ Sơ Mở TKGD`** |

---

### 2.2. Bổ Sung Bộ Chọn Phạm Vi Thời Gian Nhanh (Scope: Ngày / Tuần / Tháng)

Tại thanh công cụ trên cùng (Top Control Bar), bổ sung bộ 3 nút chuyển đổi phạm vi thống kê:

1. **`[Theo Ngày]` (`DAY`)**:
   - Xem chi tiết hồ sơ trong ngày cụ thể (mặc định hôm nay).
   - Cho phép chọn bất kỳ ngày nào trong quá khứ qua Date Picker.
2. **`[Tuần Này (7 Ngày)]` (`WEEK`)**:
   - Tự động quét toàn bộ hồ sơ tiếp nhận trong **7 ngày gần nhất** tính từ mốc ngày được chọn.
   - Hiển thị badge trực quan: `📅 DD/MM/YYYY - DD/MM/YYYY (7 ngày qua)`.
   - Giúp đánh giá xu hướng mở tài khoản trong tuần của các TVKD.
3. **`[Tháng Này]` (`MONTH`)**:
   - Tự động quét từ ngày 01 của tháng đến ngày hiện tại.
   - Hiển thị badge trực quan: `📅 01/MM/YYYY - DD/MM/YYYY (Tháng MM/YYYY)`.
   - Giúp tổng hợp báo cáo định kỳ tháng cho Ban Lãnh đạo mà không cần xuất Excel thủ công.

---

### 2.3. Báo Cáo Xuất Ra Dưới Dạng Văn Bản Chuẩn Nghiệp Vụ

Nội dung báo cáo dạng text khi bấm **[Xuất Báo Cáo Đối Soát]** được cấu trúc trang trọng:

```text
========================================================================================
                        SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM (MXV)
              BÁO CÁO THẨM ĐỊNH & ĐỐI SOÁT HỒ SƠ MỞ TÀI KHOẢN GIAO DỊCH
========================================================================================

1. THÔNG TIN BÁO CÁO:
   - Thời gian đối soát : 17/09/2026 - 24/09/2026 (7 ngày qua)
   - Khung giờ tiếp nhận: PHIÊN CHIỀU (13:00 - 17:30)
   - Cán bộ lập báo cáo : Trương Hoàng Hiệp (TTBT)
   - Kính gửi           : Lãnh đạo Phòng QLGD / TTBT
   - Thời gian xuất     : 10:45:00

2. TỔNG KẾT KHỐI LƯỢNG TIẾP NHẬN & ĐỐI SOÁT:
   - Tổng hồ sơ tiếp nhận      : 32 hồ sơ
   - Đã xử lý & Khớp 100%      : 30 hồ sơ (93.8%) -> Đủ điều kiện kích hoạt
   - Cần kiểm tra lại / Lệch   : 2 hồ sơ
   - Hồ sơ Vi phạm quy chuẩn   : 0 hồ sơ (Đã yêu cầu TVKD chuẩn hóa)
   - Hồ sơ tồn đọng cần xử lý  : 2 hồ sơ (Chi tiết mục 3)

3. DANH SÁCH CHI TIẾT HỒ SƠ TỒN ĐỌNG CẦN XỬ LÝ (2 hồ sơ):
┌────┬──────────────┬──────────────────┬──────┬────────────────────────────────┬───────────────────────────┐
│STT │   MÃ TKGD    │ HỌ VÀ TÊN KH     │ TVKD │       LÝ DO CẦN XỬ LÝ          │     BIỆN PHÁP XỬ LÝ       │
├────┼──────────────┼──────────────────┼──────┼────────────────────────────────┼───────────────────────────┤
│ 1  │ 003C2886699  │ HOÀNG THANH TÙNG │ 003  │ Lệch số CCCD (00120... # ...4) │ Đôn đốc TVKD bổ sung CCCD │
│ 2  │ 038C1234567  │ NGUYỄN VĂN AN    │ 038  │ Chưa upload ảnh CCCD mặt sau   │ Yêu cầu gửi lại qua mail  │
└────┴──────────────┴──────────────────┴──────┴────────────────────────────────┴───────────────────────────┘

4. ĐÁNH GIÁ HIỆU NĂNG HỆ THỐNG ĐỐI SOÁT:
   - Tốc độ xử lý bình quân : 10.4 giây/hồ sơ (Mục tiêu: < 20s)
   - Năng lực xử lý ước tính: ~340 hồ sơ/giờ
   - Đánh giá hạ tầng       : 🟢 Hạ tầng ổn định, luồng xử lý thông suốt
========================================================================================
```

---

## 3. Kiến Trúc Kỹ Thuật (Data-Driven Architecture)

### 3.1. API Backend Hỗ Trợ Đa Chiều (`getAnalyticsSummary`)
- **Endpoint**: `GET /api/v1/tkgd/analytics/summary?batchDate=...&shift=...&range=DAY|WEEK|MONTH`
- **Bộ lọc Backend**:
  - `range === 'WEEK'`:
    ```typescript
    const pastDate = new Date(baseDate);
    pastDate.setDate(pastDate.getDate() - 6);
    query['batchDate'] = { $gte: pastDate.toISOString().slice(0, 10), $lte: baseDate.toISOString().slice(0, 10) };
    ```
  - `range === 'MONTH'`:
    ```typescript
    const startStr = `${year}-${month}-01`;
    query['batchDate'] = { $gte: startStr, $lte: endStr };
    ```
  - `shift === 'MORNING'`: Lọc giờ nhận email $8 \le h < 12$.
  - `shift === 'AFTERNOON'`: Lọc giờ nhận email $13 \le h < 18$.
  - `shift === 'OVERTIME'`: Lọc ngoài giờ hành chính $h \ge 18 \lor h < 8 \lor (12 \le h < 13)$.

### 3.2. Đồng Bộ Hóa Hệ Thống
- Áp dụng song song trên cả 2 phân hệ:
  1. `backend/` & `frontend/` (Hệ thống tích hợp hiện hữu).
  2. `mxv-account-opening-reconciler/` & `mxv-account-opening-reconciler-ui/` (Dịch vụ độc lập).

---

## 4. Thiết Kế Tinh Gọn Bảng Đối Soát Ca Trực (Zero-Clutter Operation UI)

### 4.1. Phê Phán Thiết Kế Kỹ Thuật (Dev-Centric) & Nguyên Tắc Chuyển Đổi
Trong các phiên bản thử nghiệm ban đầu, giao diện bị "nhồi nhét" quá nhiều nút tính năng và thuật ngữ kỹ thuật sinh ra phục vụ mục đích debug của đội ngũ lập trình:
- Các thuật ngữ như: *"Chạy Lại Toàn Trình E2E"*, *"Chỉ Cào Lại M-System"*, *"Chỉ Tái Thẩm Định Luật Mới"*, *"Chế Độ Bóc Tách: Nhanh (Text) vs Đầy Đủ (Tệp/Ảnh)"*, *"Khắc Phục Bug (Dev)"*...
- **Tác động tiêu cực tới người dùng nghiệp vụ**:
  - Gây hoang mang, sợ bấm nhầm hoặc làm hỏng dữ liệu hệ thống.
  - Làm rối mắt người dùng ca trực vốn cần tốc độ thao tác nhanh và độ tập trung cao.
  - Cán bộ nghiệp vụ chỉ cần biết: Hồ sơ nào khớp, hồ sơ nào lệch; nếu cần kiểm tra lại thì chỉ cần bấm một thao tác duy nhất và rõ ràng.

### 4.2. Quy Chuẩn Nút Kích Hoạt Chính: Đổi Thành "Check"
- Toàn bộ các cụm từ dài dòng như *"Quét & Chạy Ngay"*, *"Chạy Tự Động Toàn Bộ"*, *"Bắt Đầu Chạy Ngay"* trên thanh công cụ và trong Modal cấu hình đã được thay thế đồng nhất bằng chữ **`[Check]`** (kèm icon `Zap` hoặc `PlayCircle`).
- **Lý do**: Ngắn gọn, súc tích, mang tính hành động trực diện, chuẩn xác với tư duy nghiệp vụ kiểm tra đối soát hồ sơ.

### 4.3. Thiết Kế Cột Checkbox & Thanh Thao Tác Nổi Tinh Gọn (Floating Bulk Action Bar)
- **Cột Checkbox**:
  - Checkbox ở Header: Cho phép tick chọn hoặc bỏ chọn toàn bộ danh sách hiển thị trên trang.
  - Checkbox ở từng hàng: Cho phép tick chọn từng tài khoản cụ thể cần xử lý.
- **Thanh thao tác nổi (Floating Bar)**:
  - Chỉ xuất hiện khi người dùng tick chọn $\ge 1$ tài khoản.
  - Đặt cố định ở góc dưới màn hình (`bottom-6 right-6`), bo tròn hiện đại, đổ bóng nổi bật.
  - **Thành phần hiển thị tối giản chuẩn nghiệp vụ**:
    1. **Badge số lượng**: `Đã chọn X tài khoản`.
    2. **Nút duy nhất [Check lại]**: Nền xanh ngọc gradient (`#10b981` $\rightarrow$ `#059669`), icon `RefreshCw` xoay nhẹ khi đang xử lý. Khi bấm, hệ thống tự động gọi chuỗi tác vụ đối soát toàn trình cho đúng danh sách tài khoản đã chọn.
    3. **Nút [Bỏ chọn]**: Xóa trạng thái chọn của tất cả các checkbox.
  - **Mã nguồn các nút kỹ thuật chi tiết** (`Chỉ cào M-System`, `Chỉ tái thẩm định`): Đã được đóng trong khối comment JSX `{/* ... */}` để bảo toàn 100% logic backend/frontend cho lập trình viên khi cần debug, nhưng hoàn toàn ẩn khỏi tầm mắt người dùng vận hành.

### 4.4. Minh Bạch Nguồn Gốc Dữ Liệu (Data Provenance Tooltip `(i)`)
- Bên cạnh mỗi trường thông tin đối soát trong Modal chi tiết tài khoản (`TabDataComparison.tsx`), gắn một biểu tượng thông tin `(i)` nhỏ gọn.
- Khi người dùng rê chuột (hover) vào, tooltip hiển thị rõ ràng:
  - **Nguồn gốc dữ liệu**: Trích xuất từ file Hợp đồng PDF (Text Layer) / Bóc tách từ ảnh CCCD (OCR Engine) / Cào từ web M-System.
  - **Tên tệp gốc đính kèm**: Ví dụ `HOANG-THANH-TUNG-CCCD-truoc.jpg`.
  - **Độ tin cậy (Confidence Score)**: Ví dụ `98.5%`.
- Giúp cán bộ nghiệp vụ nắm được nguồn gốc số liệu mà không làm rối bố cục bảng so sánh.

---

## 5. Danh Mục Thành Phần Đã Ẩn (Commented Out - Do Not Delete)

Để bảo đảm nguyên tắc bảo toàn mã nguồn và sẵn sàng phục hồi khi bảo trì kỹ thuật, các thành phần sau được comment ẩn bằng cú pháp JSX `{/* ... */}` trong `frontend/src/features/tkgd/components/TkgdActionToolbar.tsx`:

1. **Dropdown Menu "Nâng Cao"**:
   - Chế độ bóc tách: *Nhanh (Text)* vs *Đầy đủ (Tệp/Ảnh)*.
   - Chạy thủ công từng bước:
     + *Bước 1: Quét Mail Riêng*
     + *Bước 2: Cào M-System Riêng*
     + *Bước 3: Chạy Đối Soát Riêng*
2. **Nút "Khắc Phục Bug (Dev)"**: Nút mở Modal hồi tố `TkgdDevRemediationModal`.
3. **Các nút tác vụ phụ trên Floating Bulk Action Bar**:
   - Nút *[Chỉ Cào Lại M-System]*
   - Nút *[Chỉ Tái Thẩm Định Luật Mới]*

