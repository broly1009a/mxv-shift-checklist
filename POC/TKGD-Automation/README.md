# TKGD Automation Project — Input Collection Index

> **Mục đích thư mục này:** Tập hợp toàn bộ tài liệu đầu vào cần thiết để AI phân tích, thiết kế và xây dựng hệ thống tự động hóa xử lý hồ sơ mở Tài khoản Giao Dịch (TKGD) từ Outlook.

---

## HƯỚNG DẪN SỬ DỤNG

**Kéo thả / copy file vào đúng thư mục con tương ứng bên dưới, sau đó thông báo để AI tiếp tục phân tích.**

---

## CẤU TRÚC THƯ MỤC & FILE CẦN CUNG CẤP

```
POC/TKGD-Automation/
│
├── 📄 README.md                     ← File này (hướng dẫn)
│
├── 📂 inputs/
│   │
│   ├── 📂 mail-samples/             ← [NHÓM 1] File mẫu email đã nhận
│   │   └── (Kéo file .eml, .msg, hoặc screenshot email vào đây)
│   │
│   ├── 📂 pdf-samples/              ← [NHÓM 2] File PDF hợp đồng & phụ lục mẫu
│   │   └── (Kéo file PDF Hợp đồng mở TK, Phụ lục PL01 vào đây)
│   │
│   ├── 📂 cccd-samples/             ← [NHÓM 3] Ảnh CCCD mẫu (đã che thông tin)
│   │   └── (Kéo ảnh CCCD mặt trước, mặt sau vào đây)
│   │
│   ├── 📂 excel-templates/          ← [NHÓM 4] File Excel template đầu ra
│   │   └── (Kéo file Excel template chuẩn cần xuất kết quả vào đây)
│   │
│   └── 📂 msystem-specs/            ← [NHÓM 5] Tài liệu đặc tả M-System & API
│       └── (Kéo tài liệu API MXV, ảnh chụp màn hình M-System vào đây)
│
└── 📂 analysis/                     ← AI sẽ ghi kết quả phân tích vào đây
    ├── field_mapping.md             (Bảng mapping các trường dữ liệu)
    ├── regex_patterns.md            (Các pattern Regex bóc tách Body Mail)
    ├── ocr_strategy.md              (Chiến lược OCR từng loại tài liệu)
    └── reconciliation_rules.md      (Quy tắc đối chiếu chi tiết)
```

---

## DANH SÁCH FILE CẦN CUNG CẤP (CHI TIẾT)

### 📂 NHÓM 1: `inputs/mail-samples/` — Email Mẫu
_Mục tiêu: Để AI học pattern body mail và cách TVKD viết form_

| # | File cần cung cấp | Mô tả | Mức ưu tiên |
|---|---|---|---|
| 1 | `mail_tvkd_003_sample.eml` hoặc `.msg` | 1-2 email mẫu từ TVKD 003 (Gia Cát Lợi) | 🔴 Bắt buộc |
| 2 | `mail_tvkd_other_sample.eml` | Email mẫu từ TVKD khác (nếu có) | 🟡 Nên có |
| 3 | `screenshot_mail_body.png` | Screenshot nội dung body mail trong Outlook | 🟡 Nên có |

**Thông tin AI cần phân tích từ mail:**
- Mã TKGD Futures (VD: `003C0895953`)
- Mã TKGD ACM (VD: `003C0895953-A`)
- Tên khách hàng (VD: `NGUYỄN THỊ YẾN`)
- Mã TVKD (VD: `003`)
- Danh sách tên file đính kèm

---

### 📂 NHÓM 2: `inputs/pdf-samples/` — File PDF Hợp Đồng & Phụ Lục
_Mục tiêu: Để AI phân tích cấu trúc PDF, xác định vị trí các trường cần trích xuất_

| # | File cần cung cấp | Mô tả | Mức ưu tiên |
|---|---|---|---|
| 1 | `*-mxv.pdf` | File Hợp đồng mở TKGD (VD: `NGUYEN-THI-YEN-mxv.pdf`) | 🔴 Bắt buộc |
| 2 | `*-PL01.pdf` | File Phụ lục 01 đăng ký tiểu khoản ACM | 🔴 Bắt buộc (nếu có ACM) |

**Thông tin AI cần trích xuất từ PDF:**
- Số hợp đồng / mã phụ lục
- Tên và mã tài khoản khách hàng
- Vùng chữ ký khách hàng (có ký chưa)
- Vùng con dấu TVKD (có đóng dấu chưa)
- Ngày ký hợp đồng

---

### 📂 NHÓM 3: `inputs/cccd-samples/` — Ảnh CCCD Mẫu
_Mục tiêu: Để AI kiểm thử chiến lược OCR 3 lớp (Text / QR Code / MRZ)_

> ⚠️ **Lưu ý bảo mật:** Dùng ảnh CCCD mẫu **đã được che/làm mờ số định danh cá nhân**, hoặc dùng ảnh CCCD giả (fake) để test. Không upload CCCD thật của khách hàng.

| # | File cần cung cấp | Mô tả | Mức ưu tiên |
|---|---|---|---|
| 1 | `cccd_mat_truoc_sample.jpg` | Ảnh CCCD gắn chip mặt trước (có QR code) | 🔴 Bắt buộc |
| 2 | `cccd_mat_sau_sample.jpg` | Ảnh CCCD gắn chip mặt sau (có dòng MRZ) | 🔴 Bắt buộc |
| 3 | `cccd_mo_sample.jpg` | Ảnh CCCD bị mờ/lóa (để test edge case) | 🟡 Nên có |

**Dữ liệu AI cần bóc tách từ CCCD:**
- Số định danh cá nhân (12 số)
- Họ và tên đầy đủ
- Ngày sinh (DD/MM/YYYY)
- Giới tính
- Quê quán / Nơi thường trú
- Ngày cấp / Nơi cấp
- _(Từ QR Code):_ Toàn bộ chuỗi data chuẩn Bộ Công An
- _(Từ MRZ mặt sau):_ Số CCCD, tên không dấu, ngày sinh mã hóa

---

### 📂 NHÓM 4: `inputs/excel-templates/` — File Excel Template Đầu Ra
_Mục tiêu: Để AI thiết kế đúng cấu trúc file Excel kết quả đối chiếu_

| # | File cần cung cấp | Mô tả | Mức ưu tiên |
|---|---|---|---|
| 1 | `Template_Doi_Chieu_TKGD.xlsx` | File Excel template đang dùng thủ công (nếu có) | 🔴 Bắt buộc |
| 2 | `Sample_DSGD_MS.xlsx` | File DSGD xuất từ M-System (dạng danh sách tổng) | 🔴 Bắt buộc |
| 3 | `Sample_DSGD_Chi_Tiet.xlsx` | File chi tiết 1 TK từ M-System (nếu có thể xuất) | 🟡 Nên có |

**Các trường Excel cần mapping:**

| Trường Cần Có | Nguồn Dữ Liệu |
|---|---|
| Mã TK Futures | Body mail |
| Mã TK ACM | Body mail |
| Tên KH (Mail) | Body mail |
| Số CCCD (OCR) | CCCD - QR/MRZ/OCR |
| Ngày sinh (OCR) | CCCD |
| Tên KH (M-System) | DSGD / Chi tiết MS |
| Số CCCD (M-System) | Chi tiết MS |
| Trạng thái Hợp đồng | PDF Hợp đồng |
| Trạng thái PL01 | PDF Phụ lục |
| Kết luận đối chiếu | Tự động tính |
| Link mở file ảnh CCCD | Đường dẫn file |
| Link mở PDF HĐ | Đường dẫn file |

---

### 📂 NHÓM 5: `inputs/msystem-specs/` — Tài Liệu M-System & API
_Mục tiêu: Để AI hiểu cấu trúc màn hình M-System và cách gọi API mở TK_

| # | File cần cung cấp | Mô tả | Mức ưu tiên |
|---|---|---|---|
| 1 | `KetNoiAPI_WS.v2.13.md` ← **đã có!** | Tài liệu đặc tả MXV API v2.13 | ✅ Đã có |
| 2 | `screenshot_msystem_danhsach_tk.png` | Ảnh chụp màn hình danh sách TK trên MS | 🔴 Bắt buộc |
| 3 | `screenshot_msystem_chi_tiet_tk.png` | Ảnh chụp màn hình **chi tiết 1 TK** trên MS (thấy CCCD, Ngày sinh) | 🔴 Bắt buộc |
| 4 | `screenshot_msystem_tim_kiem.png` | Ảnh chụp màn hình thanh tìm kiếm TK theo mã | 🟡 Nên có |

---

## TRẠNG THÁI HIỆN TẠI

| Nhóm | Tình trạng | Ghi chú |
|------|-----------|---------|
| 📂 mail-samples | ⏳ Chờ input | Cần ít nhất 1-2 file email mẫu |
| 📂 pdf-samples | ⏳ Chờ input | Cần file HĐ và PL01 mẫu |
| 📂 cccd-samples | ⏳ Chờ input | Cần ảnh CCCD mẫu (đã che thông tin) |
| 📂 excel-templates | ⏳ Chờ input | Cần template và file DSGD |
| 📂 msystem-specs | 🟡 Một phần | Đã có API doc, cần thêm screenshot MS |

---

## SAU KHI CÓ ĐỦ INPUT, AI SẼ TỰ ĐỘNG TẠO

Trong thư mục `analysis/`:

1. **`field_mapping.md`** — Bảng mapping đầy đủ: Mail → OCR CCCD → PDF → M-System → Excel
2. **`regex_patterns.md`** — Danh sách các Regex chuẩn bóc tách body mail từng TVKD
3. **`ocr_strategy.md`** — Hướng dẫn chi tiết xử lý OCR cho từng loại tài liệu  
4. **`reconciliation_rules.md`** — Bảng quy tắc đối chiếu 3 chiều với mức độ nghiêm trọng
5. **Prototype Python scripts** — Code mẫu cho từng module

---

## LIÊN KẾT TÀI LIỆU ĐÃ CÓ

- 📄 [Đề xuất Giải pháp Kỹ thuật](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/docs/DE_XUAT_GIAI_PHAP_TU_DONG_HOA_MO_TKGD_OUTLOOK_OCR_MS.md)
- 📄 [Đánh giá Web vs Desktop](file:///C:/Users/hiepth/.gemini/antigravity-ide/brain/79abac46-2c3d-40bd-9c42-1e8ad51c5b08/danhgia_web_vs_desktop_tkgd.md)
- 📄 [API Spec MXV v2.13](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/TestFuture/S%E1%BA%A3n%20ph%E1%BA%A9m%20MXV%20ni%C3%AAm%20y%E1%BA%BFt/KetNoiAPI_WS.v2.13.md)

---

_Cập nhật lần cuối: 03/09/2026_
