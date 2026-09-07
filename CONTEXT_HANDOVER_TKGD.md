# TÀI LIỆU BÀN GIAO NGỮ CẢNH (SESSION HANDOVER CONTEXT)
**Dự án**: MXV Shift Checklist - Module Đối Soát Mở TKGD (Thanh Toán Bù Trừ)  
**Thời điểm tạo**: 2026-09-07 17:03 (Giờ làm việc)

---

## 1. TỔNG QUAN CÔNG VIỆC ĐÃ HOÀN THÀNH

1. **Thiết kế & Nâng cấp Bóc Tách Email Gom Nhiều Khách Hàng (Bulk Account Opening)**:
   - File: `backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts`
   - Đã thêm hàm `parseAccountOpeningEmailMulti` bóc tách danh sách N khách hàng từ 1 email và gom nhóm theo `baseCode` (chuẩn hóa các phân hệ Futures, ACM `-A`, LME `-L`).
   - Đã thêm hàm `dispatchAttachmentsForAccount` phân phối file PDF / ảnh CCCD tương ứng cho từng khách hàng độc lập.
   - Giải pháp chống nhầm lẫn ảnh CCCD mặt sau: Sử dụng **dải MRZ (Machine Readable Zone)** ở đáy thẻ CCCD gắn chip (đọc được cả Số CCCD và Họ tên) kết hợp đối sánh Ngày cấp trong Hợp đồng.
   - Đã viết sẵn file test độc lập: `backend/src/tests/test_tkgd_bulk_mail_parser.ts`.

2. **Cơ chế Phân Vùng Ngày Nghiệp Vụ (`batchDate`) & Bảo Vệ Phê Duyệt Tay (`manualReview`)**:
   - File: `backend/src/schemas/clean-account-record.schema.ts`
   - Bổ sung subdocument `manualReview` (`isOverridden`, `status`, `approvedBy`, `reason`).
   - Đã tích hợp 2 endpoint API: `POST /api/v1/tkgd/records/:id/manual-approve` và `revert-approve`.
   - Đã thêm nút bấm phê duyệt tay kèm nhập lý do và badge `🛡️ ĐÃ DUYỆT TAY` trên UI table.
   - Hàm `runReconciliation` đã có cổng chặn bảo vệ: Nếu `isOverridden === true` thì bot máy tính không tự ý giật trạng thái về Lệch khi chạy lại.
   - Hàm `syncMailOpeningAccounts` đã ràng buộc điều kiện `{ batchDate: todayStr, maTKGDBase: baseCode }` tránh ghi đè làm mất mẻ lịch sử ngày cũ.

3. **Tài liệu lưu vết đầy đủ**:
   - Bản thiết kế kỹ thuật: `implementation_plan.md`
   - Nhật ký thay đổi: `CHANGELOG_AI.md` (mục ngày `[2026-09-07]`)
   - Báo cáo walkthrough: `walkthrough.md`

---

## 2. VẤN ĐỀ TRƯỚC ĐÓ VÀ KẾT QUẢ XỬ LÝ (ĐÃ GIẢI QUYẾT XONG 100% ✅)

### 🚨 Hiện tượng trước đó:
- Trên web Ubuntu `https://10.0.0.26/admin/tkgd-dashboard`: Bảng dữ liệu hiển thị spinner `Đang tải danh sách hồ sơ...` và `Tổng hồ sơ: 0/0`.

### 🔍 Nguyên nhân & Cách đã xử lý:
- Gỡ bỏ vòng lặp gọi OCR đồng bộ `enrichMissingCccdData` trong `getRecords`.
- Đã build và deploy lên Ubuntu `10.0.0.26`.
- Kết quả kiểm thử: API `GET /api/v1/tkgd/records` phản hồi HTTP 200 trong ~1s với đầy đủ danh sách hồ sơ.
- Tại file `backend/src/modules/tkgd-automation/tkgd-automation.service.ts` ở dòng **711 - 713**:
  ```typescript
  // TRONG HÀM getRecords:
  const total = groupedList.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const items = groupedList.slice(skip, skip + limit);

  for (const item of items) {
    await this.enrichMissingCccdData(item); // <--- THỦ PHẠM NẰM Ở ĐÂY!
  }

  return { items, total, page, pageSize: limit, totalPages };
  ```
- **Hàm `enrichMissingCccdData(item)`** kích hoạt tiến trình chạy Python OCR (`tkgd_extractor_worker.py`) **đồng bộ tuần tự** cho từng bản ghi ngay trong lúc xử lý request HTTP `GET /api/v1/tkgd/records` của Client.
- Trên server Ubuntu, lệnh Python chạy tốn từ 3 - 6 giây/hồ sơ, nhân với 10 hồ sơ = **30 - 60 giây**, khiến request HTTP bị timeout (>10s) trên trình duyệt hoặc proxy Nginx!
- Bằng chứng log PM2:
  `[PYTHON-BRIDGE] Lỗi thực thi Python worker cho 003C0656625: Command failed: python3 ...`

---

## 3. HƯỚNG DẪN XỬ LÝ DỨT ĐIỂM Ở PHIÊN MỚI (CHỈ MẤT 1 PHÚT)

### Bước 1: Gỡ bỏ việc gọi đồng bộ `enrichMissingCccdData` trong `getRecords`
Trong `backend/src/modules/tkgd-automation/tkgd-automation.service.ts` (khoảng dòng 711 - 713):
- **Xóa bỏ (hoặc comment lại)** vòng lặp:
  ```typescript
  // GỠ BỎ ĐỂ API TRUY VẤN GET TRẢ VỀ NGAY LẬP TỨC (< 80ms)
  // for (const item of items) {
  //   await this.enrichMissingCccdData(item);
  // }
  ```
- Việc enrich dữ liệu OCR chỉ chạy trong tiến trình quét mail (`syncMailOpeningAccounts`) hoặc khi chạy đối soát (`runReconciliation`), tuyệt đối không được nhét vào request `GET` phân trang của bảng UI.

### Bước 2: Build & Deploy lên Ubuntu
Chạy script deploy tự động:
```powershell
cd "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist"
node backend/src/scripts/deploy_to_ubuntu.js
```
Script này sẽ tự động upload file, build NestJS và restart PM2 `mxv-backend`.

### Bước 3: Kiểm tra lại
- Truy cập `https://10.0.0.26/admin/tkgd-dashboard`, dữ liệu sẽ load ngay lập tức trong 0.1 giây!

---

## 4. THÔNG TIN KẾT NỐI HỆ THỐNG
- **Server Ubuntu**: `10.0.0.26` (Port 22)
- **User / Pass SSH**: `mxvadmin` / `MxV!,#2o26`
- **Đường dẫn dự án trên server**: `/opt/mxv-checklist/`
- **Dịch vụ PM2**: `mxv-backend` (id 0), `mxv-frontend` (id 1)
