# ĐẶC TẢ BỘ QUY TẮC NHẬN DIỆN NHIỄU TỪNG TRƯỜNG & CƠ CHẾ KÍCH HOẠT GEMINI VISION AI THẨM ĐỊNH
*(FIELD-LEVEL ANOMALY DETECTION RULES & DYNAMIC GEMINI VISION AI FALLBACK SPECIFICATION)*

> **Phiên bản**: 1.0 - Chuẩn hóa quy tắc xử lý ngoại lệ bóc tách dữ liệu CCCD M-System  
> **Áp dụng cho**: [mxv-account-opening-reconciler](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler)  
> **Nguyên tắc cốt lõi**: **"Tiết kiệm chi phí & Tối ưu tốc độ"**: Các ca bóc tách chuẩn xác qua QR/MRZ chạy siêu tốc nội bộ (< 3.5s); **CHỈ KHI** phát hiện bất kỳ trường nào có dấu hiệu nhiễu/bất thường toán học mới tự động chuyển sang **Gemini Vision AI** làm trọng tài thẩm định và chữa lành dữ liệu.

---

## MỤC LỤC
1. [Mô Hình Kiến Trúc Lọc Nhiễu 2 Lớp (Two-Tier Arbitration)](#1-mô-hình-kiến-trúc-lọc-nhiễu-2-lớp-two-tier-arbitration)
2. [Chi Tiết Bộ Quy Tắc Nhận Diện Nhiễu Từng Trường (Field-by-Field Rules)](#2-chi-tiết-bộ-quy-tắc-nhận-diện-nhiễu-từng-trường-field-by-field-rules)
   - [2.1 Trường SỐ CCCD (12 chữ số)](#21-trường-số-cccd-12-chữ-số)
   - [2.2 Trường HỌ VÀ TÊN (Tiếng Việt)](#22-trường-họ-và-tên-tiếng-việt)
   - [2.3 Trường NGÀY SINH (DD/MM/YYYY)](#23-trường-ngày-sinh-ddmmyyyy)
   - [2.4 Trường GIỚI TÍNH (Nam / Nữ)](#24-trường-giới-tính-nam--nữ)
   - [2.5 Trường NGÀY CẤP & NƠI CẤP](#25-trường-ngày-cấp--nơi-cấp)
3. [Quy Trình Tự Động Kích Hoạt & Prompt Mẫu Cho Gemini Vision AI](#3-quy-trình-tự-động-kích-hoạt--prompt-mẫu-cho-gemini-vision-ai)
4. [Cơ Chế Hợp Nhất & Chữa Lành Dữ Liệu (Consensus & Auto-Healing)](#4-cơ-chế-hợp-nhất--chữa-lành-dữ-liệu-consensus--auto-healing)

---

## 1. MÔ HÌNH KIẾN TRÚC LỌC NHIỄU 2 LỚP (TWO-TIER ARBITRATION)

```
                     ┌────────────────────────────────────────┐
                     │          ẢNH CCCD TỪ M-SYSTEM          │
                     │  (_MS_CCCD_truoc.jpg & _MS_CCCD_sau)   │
                     └───────────────────┬────────────────────┘
                                         │
                                         ▼
                     ┌────────────────────────────────────────┐
                     │    LỚP 1: BỘ SCAN NỘI BỘ SIÊU TỐC      │
                     │  • Quét QR Code mặt trước (Tốn ~0.8s)  │
                     │  • Quét MRZ ICAO mặt sau (Tốn ~1.5s)   │
                     │  • OCR Otsu / Tesseract (Tốn ~1.5s)    │
                     └───────────────────┬────────────────────┘
                                         │
                                         ▼
                     ┌────────────────────────────────────────┐
                     │   BỘ KIỂM SOÁT LỌC NHIỄU TỪNG TRƯỜNG   │
                     │   (FIELD-BY-FIELD ANOMALY DETECTOR)    │
                     └───────────────────┬────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
         [100% TRƯỜNG HỢP LỆ]                        [PHÁT HIỆN DẤU HIỆU NHIỄU]
         (Không có lỗi logic)                        (Dính KK, sai năm sinh, thiếu ngày cấp...)
                    │                                         │
                    ▼                                         ▼
       ┌─────────────────────────┐               ┌─────────────────────────┐
       │   XÁC NHẬN KẾT QUẢ      │               │ LỚP 2: TRỌNG TÀI GEMINI │
       │  • Trả về ngay trong 3s │               │      VISION AI MODEL    │
       │  • Tiết kiệm 100% token │               │  • Gửi ảnh gốc sang AI  │
       │  • Không gọi mạng ngoài │               │  • Thẩm định trường lỗi │
       └─────────────────────────┘               │  • Chữa lành (Heal 100%)│
                                                 └────────────┬────────────┘
                                                              │
                                                              ▼
                                                 ┌─────────────────────────┐
                                                 │   DỮ LIỆU ĐÃ CHỮA LÀNH  │
                                                 │  (source: GEMINI_HEALED)│
                                                 └─────────────────────────┘
```

---

## 2. CHI TIẾT BỘ QUY TẮC NHẬN DIỆN NHIỄU TỪNG TRƯỜNG (FIELD-BY-FIELD RULES)

### 2.1 Trường SỐ CCCD (`soCCCD`)
Thẻ Căn cước công dân gắn chip tuân thủ thuật toán mã hóa 12 chữ số của Bộ Công An:
* **3 số đầu**: Mã tỉnh/thành phố khai sinh (từ `001` đến `096`).
* **Số thứ 4**: Mã thế kỷ và giới tính:
  * Thế kỷ 20 (sinh 1900 - 1999): `0` (Nam), `1` (Nữ).
  * Thế kỷ 21 (sinh 2000 - 2099): `2` (Nam), `3` (Nữ).
* **Số thứ 5 - 6**: Hai chữ số cuối của năm sinh (`YY`).
* **6 số cuối**: Dãy số ngẫu nhiên.

#### ⛔ Dấu hiệu nhiễu bất thường (KÍCH HOẠT GEMINI NGAY):
1. **Lỗi hình thái (Morphological Error)**:
   - Chuỗi không đủ hoặc thừa chữ số (`soCCCD.length !== 12`).
   - Dính chữ cái hoặc ký tự đặc biệt do OCR nhầm lẫn (ví dụ: nhầm `0` thành `O`/`D`, nhầm `1` thành `I`/`l`, nhầm `8` thành `B`).
2. **Lỗi logic toán học BCA (BCA Mathematical Violation)**:
   - Hai chữ số năm sinh `soCCCD.slice(4, 6)` **KHÔNG KHỚP** với 2 số cuối của năm sinh (`ngaySinh.slice(-2)` hoặc năm sinh trong Hợp đồng).
   - Mã thế kỷ/giới tính `soCCCD[3]` mâu thuẫn với giới tính khai báo (ví dụ khách hàng là Nữ sinh năm 1995 nhưng số CCCD lại có ký tự thứ 4 là `0`).
3. **Bất đồng nội bộ 2 mặt thẻ (Front vs Back Mismatch)**:
   - Số CCCD đọc ở mặt trước (OCR) khác với số CCCD đọc ở mặt sau (dải MRZ).

---

### 2.2 Trường HỌ VÀ TÊN (`hoTen`)
* **Quy chuẩn chuẩn hóa**: Chuỗi gồm 2 đến 5 từ tiếng Việt, không chứa chữ số hoặc ký tự phân cách rác.

#### ⛔ Dấu hiệu nhiễu bất thường (KÍCH HOẠT GEMINI NGAY):
1. **Lỗi đọc nhầm dải phân cách `<` của MRZ (MRZ Separator Noise)**:
   - Đuôi tên xuất hiện chuỗi ký tự lạ: `KK`, `KKK`, `K`, `C` (ví dụ: `HOANG DUC KK KKK`, `TRANK DUCCTAMK`, `NGUYEN THI VAN LANK`).
2. **Lỗi ký tự phi chữ cái (Non-alphabet Noise)**:
   - Chứa chữ số hoặc ký hiệu lạ do hoa văn bảo an nền gây nhiễu (ví dụ: `NGUY3N TH! HUE`, `TRAN THI 8ICH`).
3. **Lỗi độ dài bất thường (Length Anomaly)**:
   - Họ tên bóc tách chỉ có 1 từ (ví dụ `HUONG`) hoặc tên quá ngắn `< 4 ký tự` (ví dụ `LE A`).
4. **Bất đồng với Hợp đồng (Name Discrepancy)**:
   - Độ tương đồng chuỗi (Levenshtein / Jaro-Winkler) giữa Tên bóc tách từ ảnh và Tên trong Hợp đồng PDF **< 80%**.

---

### 2.3 Trường NGÀY SINH (`ngaySinh`)
* **Quy chuẩn chuẩn hóa**: Định dạng `DD/MM/YYYY`, năm sinh hợp lệ cho công dân mở tài khoản giao dịch (từ 18 tuổi trở lên: `1940 <= YYYY <= 2008`).

#### ⛔ Dấu hiệu nhiễu bất thường (KÍCH HOẠT GEMINI NGAY):
1. **Lỗi ngày tháng vô lý (Calendar Invalidation)**:
   - Ngày `DD > 31` hoặc `DD == 00`.
   - Tháng `MM > 12` hoặc `MM == 00`.
2. **Lỗi độ tuổi pháp lý (Underage / Future Anomaly)**:
   - Năm sinh ở tương lai (`> 2026`).
   - Năm sinh khiến khách hàng chưa đủ 18 tuổi tính đến thời điểm mở tài khoản.
3. **Lỗi xung đột nguồn dữ liệu (Source Conflict)**:
   - Ngày sinh trên Mặt trước khác Ngày sinh trích xuất từ Dòng 2 dải MRZ mặt sau.
   - Ngày sinh từ ảnh khác Ngày sinh ghi trên Hợp đồng mở tài khoản.

---

### 2.4 Trường GIỚI TÍNH (`gioiTinh`)
* **Quy chuẩn chuẩn hóa**: Giá trị duy nhất: `Nam` hoặc `Nữ`.

#### ⛔ Dấu hiệu nhiễu bất thường (KÍCH HOẠT GEMINI NGAY):
1. **Giá trị rỗng hoặc không xác định**: `gioiTinh === null` hoặc `gioiTinh === undefined`.
2. **Ký tự OCR bị biến dạng**: Chuỗi OCR ra các từ biến dạng như `Ntt`, `Nar`, `Nu'`, `Fema1e`...
3. **Xung đột giới tính**: Giới tính đọc được mâu thuẫn với mã thế kỷ `soCCCD[3]`.

---

### 2.5 Trường NGÀY CẤP & NƠI CẤP (`ngayCap`, `noiCap`)
* **Quy chuẩn chuẩn hóa**:
  * `ngayCap`: Định dạng `DD/MM/YYYY`, thời điểm cấp phải sau ngày sinh và nằm trong khoảng từ `01/01/2016` đến hiện tại (`<= 2026`).
  * `noiCap`: Phải thuộc 3 mốc chuẩn của Bộ Công An (*Cục CSQLHC về TTXH / Cục CSQLCT và DLQG về DC / BỘ CÔNG AN*).

#### ⛔ Dấu hiệu nhiễu bất thường (KÍCH HOẠT GEMINI NGAY):
1. **Thiếu hoàn toàn ngày cấp (`ngayCap === null`)**:
   - Thường xuyên xảy ra với 64% ca quét qua MRZ vì MRZ không có ngày cấp, và vùng chữ nhỏ tiếng Việt mặt sau bị mờ.
2. **Ngày cấp ở tương lai (`ngayCap > 2026`)**:
   - Thường do OCR nhầm lẫn dòng "Có giá trị đến / Date of expiry" ở mặt trước làm Ngày cấp.
3. **Ngày cấp nhỏ hơn ngày sinh**: Vô lý toán học.

---

## 3. QUY TRÌNH TỰ ĐỘNG KÍCH HOẠT & PROMPT MẪU CHO GEMINI VISION AI

Khi bộ kiểm tra phát hiện **bất kỳ 1 trong các dấu hiệu nhiễu trên**, cờ `should_call_gemini` lập tức bật `true`. Hệ thống tự động đóng gói cả 2 ảnh `_MS_CCCD_truoc.jpg` và `_MS_CCCD_sau.jpg` gửi đến Gemini API với System Prompt chuẩn hóa cấu trúc JSON:

```python
GEMINI_SYSTEM_PROMPT = """
Bạn là Chuyên gia Giám định Căn cước công dân (CCCD) tối cao của Sở Giao dịch Hàng hóa Việt Nam (MXV).
Nhiệm vụ của bạn là thẩm định 2 ảnh mặt trước và mặt sau của thẻ CCCD gắn chip (hoặc Căn cước 2024), sửa chữa toàn bộ các lỗi mờ nhòe, nhiễu dải phân cách MRZ, và xuất ra kết quả JSON chuẩn xác 100%.

QUY TẮC BẮT BUỘC:
1. Số CCCD: Phải đúng 12 chữ số. Đối chiếu số thứ 4 với giới tính, số thứ 5-6 với năm sinh để loại bỏ nhầm lẫn số 3/5/8.
2. Họ và tên: Viết hoa tiếng Việt có dấu (ví dụ: NGUYỄN THỊ VÂN LAN, TRẦN ĐỨC TÂM). TUYỆT ĐỐI KHÔNG để sót các ký tự nhiễu như KK, KKK ở đuôi tên.
3. Ngày sinh, Ngày cấp, Có giá trị đến: Định dạng chuẩn DD/MM/YYYY.
4. Ngày cấp: Đọc kỹ dòng chữ nhỏ ở mặt sau (bên cạnh chip điện tử hoặc góc dưới). Không nhầm với ngày hết hạn mặt trước.

TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON SAU (KHÔNG KÈM TEXT GIẢI THÍCH):
{
  "soCCCD": "12_chu_so",
  "hoTen": "HO_VA_TEN_DAY_DU",
  "ngaySinh": "DD/MM/YYYY",
  "gioiTinh": "Nam hoặc Nữ",
  "ngayCap": "DD/MM/YYYY",
  "noiCap": "Ten_co_quan_cap",
  "diaChi": "Dia_chi_thuong_tru"
}
"""
```

---

## 4. CƠ CHẾ HỢP NHẤT & CHỮA LÀNH DỮ LIỆU (CONSENSUS & AUTO-HEALING)

Sau khi Gemini Vision trả về kết quả, hệ thống thực thi thuật toán **Trọng Tài Đối Soát Kép (Dual Arbitration)**:

1. **Chữa lành Số CCCD (`source: 'GEMINI_HEALED'`)**:
   - Nếu Tool scan đọc nhầm `001191058073` (sai năm sinh 05), nhưng Gemini đọc ra `001191038073` (khớp năm sinh 1903) và trùng với Hợp đồng $\rightarrow$ **Tự động thay thế bằng số của Gemini**, gắn cờ `autoHealed = True`.
2. **Chữa lành Họ và Tên**:
   - Nếu Tool scan ra `HOANG DUC KK KKK`, Gemini đọc ra `HOÀNG ĐỨC ANH` (trùng Hợp đồng) $\rightarrow$ **Cập nhật ngay tên chuẩn**, triệt tiêu vĩnh viễn lỗi Lệch Tên giả mạo.
3. **Bổ sung Ngày cấp**:
   - Cập nhật trường `ngayCap` do Gemini trích xuất từ vùng ảnh mặt sau vào bản ghi đối soát.

---

### BẢNG TỔNG KẾT QUY TẮC VẬN HÀNH

| Trường Dữ Liệu | Bộ Kiểm Soát Lỗi Nội Bộ (Phát Hiện Nhiễu) | Hành Động Xử Lý Khi Có Nhiễu |
| :--- | :--- | :--- |
| **Số CCCD** | `len != 12` OR `cid[4:6] != dob[yy]` OR `is_alpha` | **Gọi Gemini Vision thẩm định & chữa lành** |
| **Họ và tên** | Dính `KK`, `KKK`, `K$` OR `Levenshtein(name, hd_name) < 0.8` | **Lọc regex + Gọi Gemini Vision thẩm định** |
| **Ngày sinh** | Lệch giữa MRZ vs Mặt trước OR Lệch với Hợp đồng | **Gọi Gemini Vision làm trọng tài** |
| **Giới tính** | Giới tính rỗng OR Khác với mã thế kỷ `cid[3]` | **Tự động sửa theo `cid[3]` + Xác nhận qua Gemini** |
| **Ngày cấp** | `ngayCap == null` OR `ngayCap > 2026` | **Kế thừa HĐ PDF $\rightarrow$ Nếu thiếu gọi Gemini** |
