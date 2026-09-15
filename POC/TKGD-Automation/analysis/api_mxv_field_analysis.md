# PHÂN TÍCH API MXV v2.13 — Trường Dữ Liệu Liên Quan Mở TKGD

> Trích xuất từ: `KetNoiAPI_WS.v2.13.md`  
> Mục đích: Mapping các trường API MXV với dữ liệu bóc tách từ Email/OCR/PDF

---

## 1. API MỞ TÀI KHOẢN TỪ THÀNH VIÊN (POST /api/v1/am/customer)

Đây là API quan trọng nhất. TVKD gửi hồ sơ mở TK lên MXV qua API này.
Hệ thống của chúng ta cần **đọc mail → trích xuất dữ liệu → so sánh xem dữ liệu đã được gửi API này chưa và có khớp không**.

### Các trường bắt buộc (M) cần bóc tách & đối chiếu:

| Trường API | Nguồn bóc tách | Cách lấy | Độ ưu tiên |
|---|---|---|---|
| `investorCode` | Body Mail | Regex: `Mã TKGD.*: ([\w-]+)` |  Cao |
| `investorName` | Body Mail | Regex: `Tên tài khoản.*: (.+)` |  Cao |
| `memberCode` | Body Mail (3 số đầu của mã TK) | Auto-extract |  Cao |
| `individual.identityCard` | OCR CCCD / QR Code / MRZ | 12 số định danh |  Cao |
| `individual.fullName` | OCR CCCD mặt trước | Text recognition |  Cao |
| `individual.birthDay` | OCR CCCD / MRZ | DD/MM/YYYY |  Cao |
| `individual.sex` | OCR CCCD mặt trước | M/F | 🟡 Trung bình |
| `individual.idCreatedDate` | OCR CCCD mặt trước | Ngày cấp | 🟡 Trung bình |
| `individual.idExpiredDate` | OCR CCCD mặt trước | Ngày hết hạn (null nếu vô thời hạn) | 🟡 Trung bình |
| `individual.idCreatedLocation` | OCR CCCD mặt trước | Nơi cấp (Cục CS QLHC) | 🟡 Trung bình |
| `individual.address` | OCR CCCD mặt trước | Nơi thường trú | 🟡 Trung bình |
| `individual.scannedFrontIdCard` | File ảnh đính kèm mail | Base64 |  Cao (gửi API) |
| `individual.scannedBackIdCard` | File ảnh đính kèm mail | Base64 |  Cao (gửi API) |
| `individual.scannedSignature` | PDF Hợp đồng (chữ ký scan) | Base64, không bắt buộc | 🟢 Thấp |

---

## 2. WEBSOCKET EVENT: MỞ MỚI TÀI KHOẢN (createCustomerStatus)

Sau khi TVKD gửi API, MXV phản hồi qua WebSocket sự kiện `createCustomerStatus`.

**Payload sự kiện từ WS:**
```json
{
  "event": "createCustomerStatus",
  "payload": {
    "requestCode": "003YYYYMMDD001",
    "investorCode": "003C0895953",
    "status": "APPROVED | REJECTED | PENDING",
    "rejectReason": "...",
    "confirmationCode": "MXV-CONFIRM-XXXX"
  }
}
```

**→ Hệ thống cần:** Lắng nghe WS event này để cập nhật trạng thái vào Excel/Dashboard tự động.

---

## 3. API TRUY VẤN TRẠNG THÁI YÊU CẦU MỞ TK (GET /api/v1/am/investors)

Dùng để kiểm tra trạng thái phê duyệt sau khi gửi:

| Query Param | Ý nghĩa |
|---|---|
| `investorCode` | Lọc theo mã TK |
| `status` | Lọc theo trạng thái: PENDING/APPROVED/REJECTED |
| `limit`, `offset` | Phân trang |

---

## 4. MAPPING TRƯỜNG: OCR ↔ API MXV

```
CCCD QR Code Data Format (Bộ Công An):
[12 số CCCD] | [9 số CMND cũ] | [Họ tên] | [Ngày sinh DDMMYYYY] | [Giới tính] | [Địa chỉ thường trú] | [Ngày cấp DDMMYYYY]

VD: "040187030831|041873123|NGUYỄN THỊ YẾN|26031987|Nữ|Số 25, Phường Láng Hạ, Đống Đa, Hà Nội|20102022"

Mapping sang API MXV:
- QR[0] → individual.identityCard   = "040187030831"
- QR[2] → individual.fullName       = "NGUYỄN THỊ YẾN"
- QR[3] → individual.birthDay       = "26031987" → "26/03/1987"
- QR[4] → individual.sex            = "Nữ" → "F"
- QR[5] → individual.address        = "Số 25, Phường Láng Hạ..."
- QR[6] → individual.idCreatedDate  = "20102022" → "20/10/2022"
```

```
CCCD MRZ Data Format (ICAO):
Line 1: IDVNM040187030831<<5
Line 2: 8703260F2703268VNM<<<<<<<<<<<8
Line 3: NGUYEN<<THI<YEN<<<<<<<<<<<<<<<<

Mapping:
- MRZ Line 1, pos 5-17 → identityCard = "040187030831"
- MRZ Line 2, pos 0-5  → birthDay     = "870326" → "26/03/1987"
- MRZ Line 2, pos 7    → sex          = "F" (Female)
- MRZ Line 3           → fullName     = "NGUYEN THI YEN" (không dấu)
```

---

## 5. CÁC TRẠNG THÁI TÀI KHOẢN CẦN TRACK

Theo WS event `createCustomerStatus` và `updateCustomerStatus`:

| Status | Ý nghĩa | Màu hiển thị Excel |
|--------|---------|-------------------|
| `PENDING` | Chờ phê duyệt từ MXV | 🟦 Xanh dương |
| `APPROVED` | Đã phê duyệt, TK mở thành công | 🟩 Xanh lá |
| `REJECTED` | Bị từ chối (có lý do) | 🟥 Đỏ |
| `NOT_SUBMITTED` | Chưa gửi lên MXV API | ⬜ Trắng |

---

## 6. ĐIỂM LƯU Ý KỸ THUẬT TỪ API DOC

1. **Authentication:** OAuth2 Client Credentials, token có thời hạn 8h (10799 giây)
2. **requestCode:** Format bắt buộc: `[Mã TVKD][YYYYMMDD][Số tự tăng]` — VD: `00120231105001`
3. **Ảnh Base64:** Dung lượng mỗi ảnh < **200KB** sau khi encode Base64
4. **idExpiredDate:** Bắt buộc gửi; nếu CCCD vô thời hạn → truyền `null`
5. **Cut-off time:** Yêu cầu gửi sau giờ cut-off sẽ bị từ chối tự động
