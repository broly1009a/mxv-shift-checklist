# TÀI LIỆU QUY TẮC PHÁT HIỆN CCCD GIẢ MẠO
### Hệ Thống Đối Soát Mở TKGD - MXV (Sở Giao Dịch Hàng Hóa Việt Nam)
**Phiên bản**: 1.0 | **Cập nhật**: 2026-09-14 | **Phân loại**: Nội bộ - Kiểm soát rủi ro

---

## 1. BỐI CẢNH & NGUỒN GỐC TÀI LIỆU

Tài liệu này được xây dựng từ kết quả điều tra thực tế **14 tài khoản TKGD** thuộc TVKD 003 (Công ty CP Giao Dịch Hàng Hóa Gia Cát Lợi), quét và phân tích ảnh CCCD/Hợp đồng trực tiếp từ hộp thư `clearing.acc@mxv.vn` qua Microsoft Graph API vào ngày 12/09/2026.

> **Kết quả phát hiện**: 1/14 tài khoản có CCCD làm giả bằng đồ họa; 12/14 tài khoản không có ảnh CCCD thật, hồ sơ mở theo quy trình cũ. TVKD 003 chủ động nộp công văn giải trình và đề nghị đóng/hủy kích hoạt toàn bộ.

---

## 2. SO SÁNH TRỰC QUAN: CCCD THẬT vs CCCD GIẢ

### 2.1 Mặt Trước

````carousel
![CCCD THẬT - Mặt trước: NGUYỄN VĂN THỊNH (085C0947827) - Ảnh chụp thẻ vật lý thật](C:\Users\hiepth\.gemini\antigravity-ide\brain\bec17626-a0e5-4d71-a552-7005f70a217d\cccd_that_truoc.jpg)
<!-- slide -->
![CCCD GIẢ - Mặt trước: HOÀNG KIM CÔNG (003C2311200) - Phôi đồ họa Photoshop/Tool làm giả](C:\Users\hiepth\.gemini\antigravity-ide\brain\bec17626-a0e5-4d71-a552-7005f70a217d\cccd_gia_truoc.jpg)
````

### 2.2 Mặt Sau

````carousel
![CCCD THẬT - Mặt sau: NGUYỄN VĂN THỊNH - Có dải MRZ 3 dòng, vân tay mực thật, dấu đỏ C06, chữ ký sống](C:\Users\hiepth\.gemini\antigravity-ide\brain\bec17626-a0e5-4d71-a552-7005f70a217d\cccd_that_sau.jpg)
<!-- slide -->
![CCCD GIẢ - Mặt sau: HOÀNG KIM CÔNG - Vùng MRZ TRỐNG TRẮNG, chip clipart phẳng, không có dấu/chữ ký](C:\Users\hiepth\.gemini\antigravity-ide\brain\bec17626-a0e5-4d71-a552-7005f70a217d\cccd_gia_sau.jpg)
````

---

## 3. BẢNG PHÂN TÍCH SO SÁNH CHI TIẾT

| Tiêu chí kiểm tra | CCCD THẬT | CCCD GIẢ (Phôi đồ họa) | Mức độ rủi ro |
| :--- | :--- | :--- | :---: |
| **Vùng MRZ (3 dòng mã máy)** | Có đủ 3 dòng `IDVNM...` ở phần đáy mặt sau | **TRẮNG TINH - Không có MRZ** | CRITICAL |
| **Nền ảnh khi chụp** | Phản quang tự nhiên, bóng đổ mặt bàn, hạt ảnh số thật | Nền trắng đồng nhất, không bóng 3D, không hạt nhiễu | CRITICAL |
| **Font chữ số CCCD** | In laser sâu vào thẻ, font chuẩn Bộ Công An | Font Arial/Sans-serif kỹ thuật số nổi rõ, sắc cạnh bất thường | CRITICAL |
| **Chip kim loại** | Ánh vàng đồng tự nhiên, có vi mạch rãnh nhỏ 3D rõ ràng | Hình vector clipart phẳng 2D, màu vàng đồng nhất | CRITICAL |
| **Dấu vân tay** | Mực đen hữu cơ thật, nét xoáy ngẫu nhiên, không đều | Không có hoặc in kỹ thuật số giả (pattern đều) | CRITICAL |
| **Dấu đỏ cơ quan cấp** | Dấu tròn đỏ mộc thật của Cục C06 + Chữ ký tay sống | Không có dấu hoặc dấu in kỹ thuật số | HIGH |
| **Hoa văn bảo an Guilloche** | Đường nét Guilloche phủ tràn qua mép ảnh chân dung | Hoa văn phẳng, không đè qua mép ảnh, ảnh chân dung viền vuông vức | HIGH |
| **Phản quang hologram** | Bề mặt thẻ lóa ánh sáng flash theo góc chiếu | Không có phản quang, bề mặt phẳng đồng đều | HIGH |
| **Quốc huy / Logo** | Vector chuẩn nhà nước, chi tiết sắc nét | Vector chuẩn hoặc hơi mờ (dấu hiệu copy-paste) | MEDIUM |
| **QR Code góc phải** | QR code thật có thể scan được | QR code có thể hiển thị nhưng không decode đúng | MEDIUM |
| **Bố cục tổng thể** | Có các yếu tố bản in offset tinh tế, chìm | Bố cục đối xứng quá hoàn hảo, "sạch" bất thường | MEDIUM |

---

## 4. CÁC RULE PHÁT HIỆN TỰ ĐỘNG

### RULE 01 — Kiểm tra Vùng MRZ Mặt Sau (CRITICAL)

Mọi CCCD gắn chip Việt Nam (chuẩn ICAO 9303) đều BẮT BUỘC có 3 dòng mã OCR-B ở đáy mặt sau.

**Cấu trúc chuẩn MRZ của CCCD Việt Nam:**
```
Dòng 1: IDVNM{soCCCD padded to 9 chars}{check_digit}{optional_data}
Dòng 2: {DOB_YYMMDD}{check}{sex}{expiry_YYMMDD}{check}{nationality}{pad}
Dòng 3: {HO_VA_TEN_LATINH} (dấu < thay khoảng trắng)
```

**Ví dụ MRZ thật (NGUYỄN VĂN THỊNH - 085C0947827):**
```
IDVNM0760005219027076000521<<2
7604245M3604247VNM<<<<<<<<<<<6
NGUYEN<<VAN<THINH<<<<<<<<<<<<
```

**Điều kiện phát hiện giả:**
- Dòng 1 không tồn tại hoặc vùng đó bị trắng → `FAKE_NO_MRZ`
- MRZ tồn tại nhưng Check Digit không hợp lệ (thuật toán modulo-10 Luhn) → `FAKE_MRZ_INVALID_CHECKSUM`
- Ký tự MRZ không phải A-Z, 0-9, dấu `<` → `FAKE_MRZ_INVALID_CHARS`

```typescript
function checkMRZ(mrzText: string): string[] {
  const flags: string[] = [];
  const lines = mrzText.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) { flags.push('FAKE_NO_MRZ'); return flags; }
  const line1 = lines[0];
  if (!line1.startsWith('IDVNM')) flags.push('FAKE_MRZ_INVALID_FORMAT');
  if (!/^[A-Z0-9<]{44}$/.test(line1)) flags.push('FAKE_MRZ_INVALID_CHARS');
  if (!verifyCheckDigits(lines)) flags.push('FAKE_MRZ_INVALID_CHECKSUM');
  return flags;
}
```

---

### RULE 02 — Kiểm tra Tính Hợp Lý Ngày Cấp & Ngày Hết Hạn (CRITICAL)

**Dữ liệu thực tế phát hiện được từ OCR:**

| Tài khoản | Ngày cấp OCR | Lý do bất thường |
| :--- | :--- | :--- |
| 003C1684184 (Nguyễn Triệu Hưng) | **2027-09-16** | Ngày tương lai! Chưa xảy ra |
| 003C1669379 (Trương Huy Hoàng) | **2032-09-22** | Ngày tương lai 6 năm sau |
| 003C0094629 (Nguyên Hoàng Mai) | **2032-07-12** | Ngày tương lai |
| 003C9052476 (Huỳnh Thị Kim Ngân) | **3030-10-29** | Ngày hoàn toàn bịa đặt (1000 năm sau) |

```typescript
function checkDateValidity(ngayCap: Date, ngaySinh: Date): string[] {
  const flags: string[] = [];
  const now = new Date();

  if (ngayCap > now) flags.push('INVALID_ISSUE_DATE_IN_FUTURE');

  const minAgeAtIssue = new Date(ngaySinh);
  minAgeAtIssue.setFullYear(minAgeAtIssue.getFullYear() + 14);
  if (ngayCap < minAgeAtIssue) flags.push('INVALID_TOO_YOUNG_AT_ISSUE');

  if (ngayCap.getFullYear() < 2001 || ngayCap.getFullYear() > now.getFullYear()) {
    flags.push('INVALID_ISSUE_YEAR_OUT_OF_RANGE');
  }

  // Luật Căn cước: cấp tại mốc tuổi 14, 25, 40, 60
  const ageAtIssue = ngayCap.getFullYear() - ngaySinh.getFullYear();
  const validMilestones = [14, 25, 40, 60];
  if (!validMilestones.some(m => Math.abs(ageAtIssue - m) <= 1)) {
    flags.push('SUSPICIOUS_AGE_AT_ISSUE');
  }

  return flags;
}
```

---

### RULE 03 — Kiểm tra Số CCCD theo Cấu Trúc Mã Tỉnh (HIGH)

Số CCCD 12 chữ số có cấu trúc mã hóa: `{Mã tỉnh: 3 số}{Mã giới tính + thập kỷ sinh: 1 số}{Năm sinh: 2 số}{Số tuần tự: 6 số}`

**Mã giới tính + thập kỷ:**
- Số chẵn (0,2,4,6,8) = Nam; Số lẻ (1,3,5,7,9) = Nữ
- Mỗi cặp chẵn/lẻ tương ứng một thập kỷ: 0/1=190x, 2/3=191x, 4/5=192x, 6/7=200x, 8/9=201x

**Ví dụ**: `027076000521` = Vĩnh Phúc (027) + Nam 1976 (0→Nam, 76→thập kỷ 7→200x... thực tế `07`=Nam + thập kỷ 3→1970s + năm 76) → hợp lệ với Nguyễn Văn Thịnh sinh 24/04/1976.

```typescript
function checkCCCDStructure(soCCCD: string, gioiTinh: string, namSinh: number): string[] {
  const flags: string[] = [];
  if (!/^\d{12}$/.test(soCCCD)) { flags.push('INVALID_CCCD_FORMAT'); return flags; }

  const maGioiTinhThapKy = parseInt(soCCCD[3]);
  const namSinhShort = parseInt(soCCCD.substring(4, 6));

  const isNamFromCode = maGioiTinhThapKy % 2 === 0;
  const isNamFromInput = gioiTinh?.toLowerCase().includes('nam');
  if (isNamFromCode !== isNamFromInput) flags.push('CCCD_GENDER_MISMATCH');

  if (namSinh % 100 !== namSinhShort) flags.push('CCCD_BIRTH_YEAR_MISMATCH');

  return flags;
}
```

---

### RULE 04 — Phát Hiện Ảnh Phôi Đồ Họa qua Phân Tích Hình Ảnh (HIGH)

**4a. Kiểm tra Nền ảnh (Background Context)**
```
THẬT: Thẻ nằm trên bề mặt vật lý → có bóng đổ, phản quang, độ nghiêng, grain camera thật
GIẢ:  Background trắng hoàn toàn → không có vật lý học thật
```

**4b. Kiểm tra Vùng Chip**
```
THẬT: Chip có rãnh vi mạch chi tiết, ánh đồng không đồng nhất, bề mặt phản quang 3D
GIẢ:  Chip là clipart vàng đồng nhất, hình vuông phẳng, không có vi mạch chi tiết
```

**4c. Kiểm tra Mép Ảnh Chân Dung**
```
THẬT: Hoa văn Guilloche đè qua mép ảnh chân dung (anti-tamper overlay)
GIẢ:  Ảnh chân dung có viền rõ ràng, vuông vức, không có hoa văn đè qua
```

**4d. Kiểm tra Chất Lượng Font**
```
THẬT: Font in laser thẻ nhựa bị nhiễu lens tự nhiên, không hoàn toàn sắc nét pixel-perfect
GIẢ:  Font kỹ thuật số hoàn hảo, nét sắc 100%, render pixel-perfect không có hạt ảnh
```

**AI Prompt đề xuất cho tích hợp:**
```
Phân tích ảnh CCCD này:
1. Thẻ có đặt trên bề mặt vật lý thật không? Có bóng đổ tự nhiên không?
2. Chip kim loại có rãnh vi mạch 3D không hay là hình phẳng đồng nhất?
3. Hoa văn Guilloche có đè qua mép ảnh chân dung không?
4. Font số CCCD có sắc nét pixel-perfect bất thường không?
→ Kết luận: ẢNH THẬT hay ẢNH ĐỒ HỌA?
```

---

### RULE 05 — Phát Hiện Mâu Thuẫn Dữ Liệu Chéo (HIGH)

Đối chiếu thông tin giữa 3 nguồn: OCR ảnh CCCD ↔ Nội dung Hợp đồng ↔ Dữ liệu M-System.

```typescript
function crossCheckData(cccdOcr: DataSource, hopDong: DataSource, mSystem: DataSource) {
  const issues = [];

  if (cccdOcr.soCCCD !== hopDong.soCCCD)
    issues.push({ flag: 'CCCD_NUMBER_MISMATCH_HOPDONG', severity: 'CRITICAL' });
  if (cccdOcr.soCCCD !== mSystem.soCCCD)
    issues.push({ flag: 'CCCD_NUMBER_MISMATCH_MSYSTEM', severity: 'CRITICAL' });

  const normalize = (s: string) => s?.normalize('NFC').toUpperCase().trim();
  if (normalize(cccdOcr.hoVaTen) !== normalize(mSystem.hoVaTen))
    issues.push({ flag: 'NAME_MISMATCH', severity: 'HIGH' });

  const diffDays = Math.abs(
    new Date(cccdOcr.ngaySinh).getTime() - new Date(mSystem.ngaySinh).getTime()
  ) / (1000 * 60 * 60 * 24);
  if (diffDays > 30) issues.push({ flag: 'DOB_MAJOR_MISMATCH', severity: 'HIGH' });
  else if (diffDays > 1) issues.push({ flag: 'DOB_MINOR_MISMATCH', severity: 'LOW' });

  return issues;
}
```

---

### RULE 06 — Kiểm tra Nguồn Gốc & Bối Cảnh Email (MEDIUM)

**Điều kiện nghi ngờ:**
- Email từ domain lạ, không phải domain đăng ký của TVKD
- Chủ đề email không chứa mã TKGD
- Tất cả ảnh CCCD đều có tên generic: `image001.jpg`, `image002.jpg`
- File ảnh CCCD dung lượng nhỏ bất thường (< 30KB)
- Hợp đồng PDF không có ảnh CCCD nhúng

```typescript
function checkEmailArtifacts(attachments: Attachment[]): string[] {
  const flags: string[] = [];
  const imgs = attachments.filter(a => /\.(jpg|jpeg|png|webp)$/i.test(a.name));

  const genericImgs = imgs.filter(a =>
    /^image\d*\.(jpg|png)$/i.test(a.name) || /^img_\d+/i.test(a.name)
  );
  if (genericImgs.length > 0 && genericImgs.length === imgs.length)
    flags.push('ALL_IMAGES_GENERIC_NAME');

  if (imgs.some(a => a.size < 30000)) flags.push('SUSPICIOUS_SMALL_IMAGE_SIZE');
  if (imgs.length === 0) flags.push('NO_CCCD_IMAGE_ATTACHED');

  return flags;
}
```

---

### RULE 07 — Kiểm tra Danh Sách Đen Tổng Hợp (MEDIUM)

```typescript
// Danh sách đen từ Công văn TVKD 003 (Gia Cát Lợi) tháng 09/2026
const BLACKLIST_ACCOUNTS = [
  '003C2311200', // HOÀNG KIM CÔNG      - CCCD giả Photoshop (Type A)
  '003C0879444', // LÊ HUỲNH HÙNG      - Không qua eKYC (Type D)
  '003C0534241', // PHAN TẤN NHỰT      - Không qua eKYC (Type D)
  '003C1564927', // NGUYỄN HUỲNH NHƯ  - Không qua eKYC (Type D)
  '003C0807375', // TRƯƠNG CẨM TÚ     - Không qua eKYC (Type D)
  '003C1731326', // TRƯƠNG NGỌC THU    - Không qua eKYC (Type D)
  '003C1684879', // NGUYỄN VĂN HỢI    - Không qua eKYC (Type D)
  '003C6550243', // HUỲNH TUYẾT MAI   - Tuổi OCR bất thường 2012 (Type B)
  '003C1684184', // NGUYỄN TRIỆU HƯNG - Ngày cấp 2027 tương lai (Type B)
  '003C1669379', // TRƯƠNG HUY HOÀNG  - Ngày cấp 2032 tương lai (Type B)
  '003C0094629', // NGUYÊN HOÀNG MAI  - Ngày cấp 2032 tương lai (Type B)
  '003C9052476', // HUỲNH THỊ KIM NGÂN- Ngày cấp 3030 vô lý (Type B)
  '003C1719053', // LÊ THỊ THU HÒA    - Không qua eKYC (Type D)
  '085C0947827', // NGUYỄN VĂN THỊNH  - Ảnh CCCD thật, cần xác minh TVKD
];
```

---

## 5. PHÂN LOẠI MỨC ĐỘ & HÀNH ĐỘNG XỬ LÝ

| Mức độ | Điều kiện | Hành động bắt buộc |
| :---: | :--- | :--- |
| **CRITICAL** | Phát hiện >= 1 flag CRITICAL (MRZ thiếu, ngày cấp tương lai) | Từ chối kích hoạt ngay lập tức. Báo cáo Kiểm soát rủi ro. Lưu hồ sơ vi phạm. Thông báo TVKD bằng văn bản. |
| **HIGH** | Phát hiện >= 2 flag HIGH hoặc tổ hợp bất thường | Tạm giữ, chuyển chuyên viên TTBT kiểm tra tay. Không kích hoạt cho đến khi xác minh. |
| **MEDIUM** | Phát hiện 1 flag MEDIUM / dữ liệu không khớp nhỏ | Gắn cờ `CAN_KIEM_TRA`, cho phép chuyên viên xem xét và quyết định thủ công. |
| **CLEAR** | Không phát hiện flag nào | Tiến hành duyệt theo quy trình chuẩn. |

---

## 6. CHECKLIST KIỂM TRA THỦ CÔNG (dành cho Chuyên Viên TTBT)

### 6.1 Kiểm tra Ảnh Mặt Sau CCCD — 5 điểm PHẢI CÓ
- [ ] Dải MRZ 3 dòng chữ `IDVNM...` ở đáy dưới
- [ ] Chip kim loại vàng với vi mạch rãnh nhỏ rõ ràng (không phẳng)
- [ ] 2 ô dấu vân tay mực đen (ngón trỏ trái + phải)
- [ ] Dấu đỏ tròn và chữ ký tay của Cục C06 / Cục QLHCVTTXH
- [ ] Tên người cấp in nghiêng (ví dụ: *Nguyễn Quốc Hùng*)

### 6.2 Kiểm tra Ảnh Mặt Trước CCCD — 5 điểm PHẢI CÓ
- [ ] Thẻ đặt trên bề mặt vật lý thật (mặt bàn, tờ giấy) — không trắng/ảo
- [ ] Hoa văn Guilloche đan xen đè qua mép ảnh chân dung
- [ ] Font chữ số và tên không quá sắc nét, có hạt ảnh tự nhiên
- [ ] QR code góc phải scan được (nội dung khớp với số CCCD)
- [ ] Số CCCD 12 chữ số khớp cấu trúc mã tỉnh-giới tính-năm sinh

### 6.3 Đối Chiếu Chéo — 4 điểm bắt buộc
- [ ] Số CCCD trên ảnh = Số CCCD trong Hợp đồng = Số CCCD trong M-System
- [ ] Họ tên trên ảnh CCCD = Họ tên trong Hợp đồng (bỏ dấu + chuẩn Unicode)
- [ ] Ngày sinh không mâu thuẫn giữa 3 nguồn (dung sai tối đa 1 ngày do OCR)
- [ ] Ngày cấp trong quá khứ, năm cấp hợp lý (2001–hiện tại)

---

## 7. PATTERN LIBRARY — CÁC MẪU CCCD GIẢ ĐÃ GHI NHẬN

### Type A — Phôi Đồ Họa Photoshop / Online Tool
**Đặc trưng**: Nền trắng sạch, chip clipart vàng phẳng, MRZ trống, font sắc nét pixel-perfect.
**Phát hiện thực tế**: HOÀNG KIM CÔNG - 003C2311200 (phân tích 12/09/2026).
**Rule kích hoạt**: RULE 01 (FAKE_NO_MRZ), RULE 04 (phân tích ảnh).

### Type B — Chỉnh Sửa Thông Tin Thẻ Thật (Data Tampering)
**Đặc trưng**: Ảnh thẻ thật nhưng số CCCD / tên / ngày sinh / ngày cấp bị Photoshop chỉnh.
**Phát hiện thực tế**: Ngày cấp tương lai bất thường (2027, 2032, 3030) trong 4 tài khoản.
**Rule kích hoạt**: RULE 02 (INVALID_ISSUE_DATE_IN_FUTURE, INVALID_ISSUE_YEAR_OUT_OF_RANGE).

### Type C — Ảnh CCCD Người Khác Ghép Tên (Identity Swap)
**Đặc trưng**: Ảnh chân dung không khớp với thông tin trên thẻ.
**Phát hiện**: Cần xác minh khi hệ thống báo CCCD_GENDER_MISMATCH hoặc CCCD_BIRTH_DECADE_MISMATCH.
**Rule kích hoạt**: RULE 03, RULE 05.

### Type D — Không Có Ảnh CCCD (Missing Document)
**Đặc trưng**: Hồ sơ chỉ có Hợp đồng scan, không có ảnh CCCD đính kèm. Mở TKGD theo quy trình cũ không có eKYC.
**Phát hiện thực tế**: 11/14 tài khoản TVKD 003 (chỉ có `hop-dong-*.pdf`, không có ảnh CCCD).
**Rule kích hoạt**: RULE 06 (NO_CCCD_IMAGE_ATTACHED).

---

## 8. GHI CHÚ KỸ THUẬT: TÍCH HỢP VÀO HỆ THỐNG

Điểm tích hợp trong [`tkgd-automation.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/tkgd-automation.service.ts):

```typescript
// Trong hàm analyzeExtractedData() sau khi OCR xong
const fraudFlags: string[] = [
  ...checkMRZ(cccdData.mrzText || ''),
  ...checkDateValidity(cccdData.ngayCap, cccdData.ngaySinh),
  ...checkCCCDStructure(cccdData.soCCCD, cccdData.gioiTinh, cccdData.namSinh),
  ...checkEmailArtifacts(rawMail.attachments),
  ...crossCheckData(cccdData, hopDongData, msData).map(i => i.flag),
];

const criticalFlags = fraudFlags.filter(f => CRITICAL_RULE_FLAGS.includes(f));
const highFlags    = fraudFlags.filter(f => HIGH_RULE_FLAGS.includes(f));

if (criticalFlags.length > 0) {
  result.status     = 'FRAUD_DETECTED';
  result.fraudLevel = 'CRITICAL';
  result.fraudFlags = fraudFlags;
  await notifyRiskControl(account, fraudFlags); // Gửi alert ngay
} else if (highFlags.length >= 2) {
  result.status     = 'SUSPICIOUS';
  result.fraudLevel = 'HIGH';
} else if (fraudFlags.length > 0) {
  result.status     = 'NEED_REVIEW';
  result.fraudLevel = 'MEDIUM';
}
```

---

## 9. TÀI LIỆU THAM CHIẾU

| Nguồn | Nội dung |
| :--- | :--- |
| **Luật Căn cước 2023 (Luật số 26/2023/QH15)** | Quy định cấp CCCD gắn chip, thời hạn, mốc tuổi 14/25/40/60 |
| **ICAO Doc 9303 Part 5** | Chuẩn Machine Readable Travel Documents, cấu trúc MRZ |
| **Công văn Gia Cát Lợi - TVKD 003** | Danh sách 14 TK đề nghị đóng/hủy kích hoạt (09/2026) |
| **Phân tích hình ảnh 14 TK - MXV TTBT** | Kết quả điều tra từ Outlook `clearing.acc@mxv.vn` (12/09/2026) |
| **CCCD thật mẫu** | Nguyễn Văn Thịnh - 085C0947827, ảnh lưu tại `extracted_cccd_local/` |
| **CCCD giả mẫu** | Hoàng Kim Công - 003C2311200, ảnh lưu tại `extracted_cccd_local/` |

---

*Tài liệu được lập bởi Bộ phận Thanh Toán Bù Trừ (TTBT) / Hệ thống AI đối soát MXV. Cập nhật khi có thêm mẫu giả mới phát hiện.*
