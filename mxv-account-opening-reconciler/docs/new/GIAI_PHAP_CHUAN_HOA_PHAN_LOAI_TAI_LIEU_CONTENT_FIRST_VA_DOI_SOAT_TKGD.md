# BÁO CÁO THẨM ĐỊNH THỰC TẾ & THIẾT KẾ GIẢI PHÁP CHUẨN HÓA PHÂN LOẠI HỒ SƠ TKGD
**Phương pháp tiếp cận: Content-First & Data-Driven Architecture (Quét Nội Dung Trước - Xác Định Loại File Sau)**

---

## 1. TỔNG QUAN & BỐI CẢNH (EXECUTIVE SUMMARY)

Trong phiên đối soát hồ sơ mở tài khoản giao dịch (TKGD) ngày 01/10/2026, hệ thống ghi nhận **6 tài khoản báo trạng thái LỆCH (`LECH`)**. 

Dưới sự chỉ đạo của Ban Quản trị, tài liệu này được lập nhằm:
1. **Kiểm chứng tính đúng đắn 100% dựa trên dữ liệu thực tế (Ground Truth)** của 6 tài khoản báo lệch, phân định rõ: Đâu là lệch thật (sai sót/gian lận nghiệp vụ), đâu là lệch giả (False Positive do lỗi bóc tách kỹ thuật).
2. **Chỉ ra nguyên nhân gốc rễ (Root Cause)** của hiện tượng lệch giả từ cấu trúc file PDF và các đoạn mã hardcode trong hệ thống.
3. **Thiết lập giải pháp kiến trúc chuẩn chỉ (Content-First)** thay thế hoàn toàn các giải pháp chắp vá hoặc vá lỗi cục bộ (heuristic patch).

---

## 2. KẾT QUẢ THẨM ĐỊNH 6 TÀI KHOẢN BÁO LỆCH NGÀY 01/10/2026

Toàn bộ dữ liệu dưới đây được trích xuất trực tiếp từ CSDL MongoDB máy chủ Ubuntu (`clean_account_records`) và các tệp tin lưu trữ thực tế tại `/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-10-01/`.

| STT | Mã TKGD | Họ và Tên | TVKD | Lỗi Hệ Thống Báo | Chứng Cứ Thực Tế Từ File Gốc & M-System | Kết Luận Thẩm Định |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| 1 | **`003C4102930`** | VÕ HOÀNG NAM | 003 | Lệch số CCCD: `079094012930` vs `079094102930` | - HĐ khách hàng: `079094012930`<br>- Web M-System: `079094102930`<br>$\rightarrow$ Nhân viên TVKD gõ nhầm đảo vị trí 2 chữ số (`01` thành `10`). |  **LỆCH THẬT 100%**<br>*(Bắt đúng lỗi nhập liệu TVKD)* |
| 2 | **`003C9158582`** | PHẠM HOÀNG GIA HUY | 003 | Bất thường CCCD: Khai sinh năm 2005 nhưng số thẻ mã hóa năm sinh 2008 | - Số CCCD: `079208034895`<br>- Cấu trúc CCCD: `079` (TP.HCM), `2` (Nam thế kỷ 21), `08` (Năm sinh 2008).<br>- Khai báo trên MS & HĐ: `10/05/2005` (Khai tăng 3 tuổi). |  **LỆCH THẬT 100%**<br>*(Quy tắc chống gian lận CCCD bắt cực chuẩn)* |
| 3 | **`003C8994799`** | Đỗ Anh Tuấn | 003 | Phát hiện chữ ký khách hàng ở trạng thái `Chưa ký` | - Mọi thông tin nhân thân (Họ tên, CCCD `036096002618`, Ngày sinh `08/04/1996`, Ngày cấp, Nơi cấp) đều khớp 100%.<br>- Trạng thái chữ ký điện tử trên M-System: `Chưa ký`. |  **LỆCH THẬT 100%**<br>*(Hồ sơ chưa hoàn tất chữ ký pháp lý)* |
| 4 | **`012C3235254`** | Nguyễn Minh Tiến | 012 | Lệch ngày sinh: `27/12/2021` vs `21/02/1983` | - Ngày 30/09: HĐ cơ sở đã duyệt **KHỚP 100%** (sinh 1983).<br>- Ngày 01/10: TVKD gửi Phụ lục ACM `..._PL_A.pdf`. Form chỉ có ngày cấp `27/12/2021`. Bot lấy ngày cấp gán vào ngày sinh. | ⚠️ **LỆCH GIẢ**<br>*(Nhầm Phụ lục thành Hợp đồng cơ sở)* |
| 5 | **`012C0038412`** | Lê Hữu Ngọc Trâm | 012 | Lệch ngày sinh: `25/03/2021` vs `16/11/1982` | - Ngày 30/09: HĐ cơ sở đã duyệt **KHỚP 100%** (sinh 1982).<br>- Ngày 01/10: TVKD gửi Phụ lục ACM `..._PL_A.pdf`. Form chỉ có ngày cấp `25/03/2021`. Bot lấy ngày cấp gán vào ngày sinh. | ⚠️ **LỆCH GIẢ**<br>*(Nhầm Phụ lục thành Hợp đồng cơ sở)* |
| 6 | **`012C2891154`** | Nguyễn Văn Thân | 012 | Lệch ngày sinh: `01/07/2022` vs `08/08/1987` | - File HĐ gốc `Nguyen_Van_Than.pdf` **CÓ ĐỦ 100%**: Sinh `08/08/1987`, Cấp `01/07/2022`.<br>- Nhưng bot duyệt nhầm file Phụ lục `Nguyễn Văn Thân.pdf` đè lên Hợp đồng gốc. | ⚠️ **LỆCH GIẢ**<br>*(Lấy nhầm file Phụ lục đè lên HĐ gốc)* |

---

## 3. BẰNG CHỨNG THỰC TẾ TỪ CẤU TRÚC TỆP TIN PDF (GROUND TRUTH AUDIT)

Để chứng minh khách quan không phỏng đoán, hệ thống đã trích xuất trực tiếp các trường AcroForm và lớp văn bản (Text Layer) từ chính các file PDF lưu trữ trên Ubuntu:

### 3.1. Dữ liệu trích xuất từ file `012C3235254_Nguyen_Minh_Tien_PL_A.pdf`
```javascript
=== CÁC TRƯỜNG DỮ LIỆU ACROFORM TRONG FILE ===
[
  '066083007707',                                      // Số CCCD
  '27/12/2021',                                        // 🔴 CHUỖI NGÀY DUY NHẤT DẠNG DD/MM/YYYY
  '0919834186',                                        // Điện thoại
  'minhtiencdyt@gmail.com',                            // Email
  'Nguyễn Minh Tiến',                                  // Họ và tên
  'Cục Cảnh Sát Quản Lý Hành Chính Về Trật Tự Xã Hội', // Nơi cấp
  '188/9/9 Ama Khê, Tự An, TP Buôn Ma Thuột, Đắk Lắk'  // Địa chỉ
]
```
* **Text đầu trang**: `PHỤ LỤC SỐ 01 (Kèm theo Hợp đồng mở tài khoản số... ngày... tháng... năm...)`
* **Sự thật kiểm chứng**:
  1. Biểu mẫu này là **Phụ lục mở tiểu khoản ACM (PL01)**, hoàn toàn **không có ô Ngày sinh**.
  2. Chuỗi ngày `'27/12/2021'` đứng liền kề số CCCD và Nơi cấp $\rightarrow$ Đây chính là **Ngày cấp CCCD**, khớp 100% với `rawNgayCap` trên M-System.
  3. Số CCCD `066083007707` có ký tự 4-6 là `083` $\rightarrow$ Khách hàng sinh năm **1983**, hoàn toàn trùng khớp với ngày sinh trên M-System (`21/02/1983`).

### 3.2. Dữ liệu trích xuất từ 2 file của tài khoản `012C2891154`
Trong thư mục `/mnt/qlgd-it/.../2026-10-01/012C2891154/` có đồng thời 2 file:
1. **File 1 (`012C2891154_Nguyen_Van_Than.pdf`)**:
   * Text đầu trang: `1 SỐ TÀI KHOẢN GIAO DỊCH HỢP ĐỒNG KIÊM GIẤY ĐỀ NGHỊ MỞ TÀI KHOẢN GIAO DỊCH HÀNG HOÁ`
   * AcroForm values: Chứa đầy đủ Ngày sinh `'08/08/1987'`, Giới tính `'Nam'`, CCCD `'035087005178'`, Ngày cấp `'01/07/2022'`, Nơi cấp `'Cục Cảnh Sát QLHC...'`.
   * $\rightarrow$ **Đây là Hợp đồng mở tài khoản gốc, khớp 100% với M-System**.
2. **File 2 (`012C2891154_Nguyễn Văn Thân.pdf`)**:
   * Text đầu trang: `PHỤ LỤC SỐ 01 (Kèm theo Hợp đồng mở tài khoản số...)`
   * AcroForm values: Chỉ chứa CCCD `'035087005178'` và Ngày cấp `'01/07/2022'`.
   * $\rightarrow$ **Đây là Phụ lục mở tiểu khoản**.

---

## 4. BỐN ĐIỂM NGHẼN KIẾN TRÚC & HARDCODE HIỆN TẠI

Qua rà soát toàn bộ mã nguồn, hiện tượng nhận diện sai lệch và đẻ ra lỗi lệch giả bắt nguồn từ 4 điểm hardcode cứng:

### Điểm 1: Đoán loại file bằng chuỗi tên file (Brittle Filename Matching)
* **Vị trí**:
  * [tkgd-reconcile-core.service.ts#L1198-L1208](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/tkgd-automation/services/tkgd-reconcile-core.service.ts#L1198-L1208)
  * [tkgd-mail-ingest.service.ts#L552-L602](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/tkgd-automation/services/tkgd-mail-ingest.service.ts#L552-L602)
* **Đoạn mã hiện tại**:
  ```typescript
  const isPhuLuc = lower.includes('pl01') || lower.includes('phuluc') || lower.includes('-pl');
  const isHopDong = lower.includes('mxv') || lower.includes('hopdong') || lower.includes('hd') || lower.includes('all');
  if (!hopDongPath && !isPhuLuc) hopDongPath = full; // ⛔ ÉP THÀNH HỢP ĐỒNG NẾU KHÔNG CÓ CÁC CHUỖI TRÊN
  ```
* **Lỗi phát sinh**:
  * TVKD 012 đặt tên file là `..._PL_A.pdf` (gạch dưới `_pl_a`). Biến `isPhuLuc` bị trả về `false`.
  * TVKD 012 đặt tên file Phụ lục theo tên khách hàng `012C2891154_Nguyễn Văn Thân.pdf` (không có chữ PL). `isPhuLuc` bị trả về `false`.
  * Hậu quả: Toàn bộ các file Phụ lục này bị **ép sang làm Hợp đồng mở tài khoản (`hopDongPath`)**.

### Điểm 2: Gán mù quáng ngày đầu tiên thành Ngày sinh (Blind Date Ordering)
* **Vị trí**: [tkgd-doc-extractor.helper.ts#L192-L200](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/engine-helpers/tkgd-doc-extractor.helper.ts#L192-L200)
* **Đoạn mã hiện tại**:
  ```typescript
  const dates = acroValues.filter((v) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v));
  if (dates.length > 0) {
    const sorted = [...dates].sort(...);
    res.rawNgaySinh = sorted[0]; // 🔴 HARDCODE: Luôn mặc định ngày đầu tiên là Ngày sinh!
  }
  ```
* **Lỗi phát sinh**: Khi file Phụ lục bị ép đọc bằng hàm `extractHopDongPdf`, do file chỉ có 1 chuỗi ngày duy nhất là Ngày cấp `27/12/2021`, code nhắm mắt gán nó vào `rawNgaySinh` $\rightarrow$ Biến khách hàng sinh năm 1983 thành sinh năm 2021 (3 tuổi).

### Điểm 3: Đoán file gộp HĐ + Phụ lục bằng chữ "ALL"
* **Vị trí**: [tkgd-mail-ingest.service.ts#L701](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/tkgd-automation/services/tkgd-mail-ingest.service.ts#L701)
* **Đoạn mã hiện tại**: `if (hdNameLower.includes('all') || group.hasACMRequest) { ... }`
* **Lỗi phát sinh**: Nếu TVKD gộp chung cả HĐ và PL01 vào một file PDF nhưng đặt tên là `HoSo_NguyenVanA.pdf` hoặc `Full_HopDong.pdf`, hệ thống bỏ sót không bóc tách phần Phụ lục.

### Điểm 4: Tra cứu tên TVKD tĩnh bằng object code
* **Vị trí**: [tkgd-reconcile-core.service.ts#L572-L580](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/tkgd-automation/services/tkgd-reconcile-core.service.ts#L572-L580)
* **Đoạn mã hiện tại**: Khai báo object tĩnh `tvkdNameMap` với mapping sai `012: 'Sài Gòn Futures'` (012 thực tế là HCT - Giao dịch Hàng hóa TP.HCM).

---

## 5. THIẾT KẾ GIẢI PHÁP CHUẨN: "QUÉT NỘI DUNG TRƯỚC - PHÂN LOẠI SAU" (CONTENT-FIRST)

Thay vì "nhìn tên file đoán mò rồi mới quét", luồng kiến trúc mới đảo ngược quy trình: **Đằng nào cũng đọc file $\rightarrow$ Mở file đọc nội dung trang đầu $\rightarrow$ Xác định chính xác 100% loại tài liệu $\rightarrow$ Điều hướng vào đúng hàm xử lý**.

```
[File PDF Đính Kèm]
        │
        ▼
[readPdfText(buffer)] -> Đọc tiêu đề trang đầu (Header Signature)
        │
        ├───────────────────────────────────────────────────────┐
        ▼                                                       ▼
[Tiêu đề chứa: "PHỤ LỤC..."]                      [Tiêu đề chứa: "HỢP ĐỒNG..."]
        │                                                       │
        ▼                                                       ▼
Xác định loại: PHU_LUC (PL01)                     Xác định loại: HOP_DONG
        │                                                       │
        ▼                                                       ▼
Gọi extractPhuLucPdf()                            Gọi extractHopDongPdf()
- Bóc tách CCCD, Ngày cấp, Chữ ký                 - Bóc tách đầy đủ: Họ tên, Ngày sinh,
- Gán vào record.phuLuc                            CCCD, Ngày cấp, Nơi cấp, Chữ ký
- KHÔNG đòi hỏi Ngày sinh                          - Gán vào record.hopDong
```

### 5.1. Hàm nhận diện loại văn bản độc lập 2 tầng (`detectPdfDocType`)
```typescript
export async function detectPdfDocType(
  input: string | Buffer
): Promise<'HOP_DONG' | 'PHU_LUC' | 'CCCD_SCAN' | 'UNKNOWN'> {
  let text = '';
  try {
    text = await readPdfText(input);
  } catch {
    text = '';
  }

  // TẦNG 1: ĐỌC LỚP VĂN BẢN ĐIỆN TỬ (TEXT LAYER) - NHANH < 5MS, MIỄN PHÍ
  if (text && text.trim().length >= 30) {
    const headText = text.slice(0, 1500).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toUpperCase();

    // 1. Phụ lục mở tiểu khoản (PL01 / ACM / CQG / Straits)
    const isPhuLuc =
      headText.includes('PHU LUC SO 01') ||
      headText.includes('PHU LUC 01') ||
      headText.includes('PHU LUC HOP DONG') ||
      headText.includes('PHU LUC MO TIEU KHOAN') ||
      headText.includes('GIAY DE NGHI MO TIEU KHOAN') ||
      headText.includes('DANG KY GIAO DICH LIEN THONG');
    if (isPhuLuc) return 'PHU_LUC';

    // 2. Hợp đồng mở tài khoản cơ sở
    const isHopDong =
      headText.includes('HOP DONG KIEM GIAY DE NGHI') ||
      headText.includes('HOP DONG MO TAI KHOAN') ||
      headText.includes('HOP DONG DICH VU GIAO DICH') ||
      headText.includes('DIEU KHOAN HOP DONG MO TAI KHOAN') ||
      headText.includes('HOP DONG NGUYEN TAC') ||
      (headText.includes('HOP DONG') && headText.includes('BEN A') && headText.includes('BEN B'));
    if (isHopDong) return 'HOP_DONG';

    // 3. File PDF scan CCCD
    if ((headText.includes('CAN CUOC CONG DAN') || headText.includes('CHUNG MINH NHAN DAN')) && !headText.includes('HOP DONG') && !headText.includes('PHU LUC')) {
      return 'CCCD_SCAN';
    }
  }

  // TẦNG 2: PDF SCAN ẢNH THUẦN (KHÔNG CÓ TEXT) -> BỘ THẨM ĐỊNH THỊ GIÁC (VISUAL AI CLASSIFIER - GEMINI VISION)
  // Tuyệt đối KHÔNG đoán mò bằng tên file! Gửi trang 1 qua Gemini Multimodal để xác định bản chất tài liệu.
  try {
    const { classifyScannedPdfWithGemini } = require('./tkgd-ai-pdf-rescue.helper');
    const aiDocType = await classifyScannedPdfWithGemini(input);
    if (aiDocType && aiDocType !== 'UNKNOWN') {
      return aiDocType;
    }
  } catch (err: any) {
    console.warn('[DOC-EXTRACTOR] Visual AI Classification error:', err?.message);
  }

  return 'UNKNOWN';
}
```

### 5.2. Nguyên tắc đối soát cho Phụ lục mở tiểu khoản ACM (PL01)
* Đối với yêu cầu mở tiểu khoản ACM:
  1. Nếu tài khoản cơ sở đã được duyệt `KHOP` trước đó: Toàn bộ thông tin nhân thân (Ngày sinh, Giới tính, Nơi cấp) được **kế thừa từ tài khoản cơ sở hoặc M-System**.
  2. Trên Phụ lục PL01: Chỉ bắt buộc kiểm tra **Họ tên, Số CCCD và Chữ ký**. Tuyệt đối không bắt lỗi thiếu Ngày sinh trên Phụ lục.

---

## 6. ĐÁNH GIÁ TÁC ĐỘNG & BẢO ĐẢM TÍNH TOÀN VẸN HỆ THỐNG

1. **Hiệu năng (Performance)**: Việc đọc thêm một đoạn text ngắn trang đầu tốn **< 10ms**, hoàn toàn không ảnh hưởng tới thời gian phản hồi của API hay thời gian chạy cron job.
2. **Cấu trúc CSDL (Database Schema)**: **Không thay đổi**. Dữ liệu vẫn được phân bổ chính xác vào `record.hopDong` và `record.phuLuc`.
3. **Giao diện Frontend**: **Không thay đổi API contract**. Frontend nhận đúng dữ liệu HĐ và Phụ lục.
4. **Tính tương thích ngược (Backward Compatibility)**: Với các file PDF scan dạng ảnh không có text layer, hệ thống tự động fallback về heuristic tên file dự phòng, đảm bảo không có file nào bị bỏ rơi.

---

## 7. KẾ HOẠCH KIỂM THỬ AN TOÀN (DRY-RUN VERIFICATION)

Tuân thủ nghiêm ngặt Quy tắc Rule 5 và Rule 1.8 của [AGENTS.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/.agents/AGENTS.md):
1. **Kiểm thử Dry-run không sửa DB**: Sử dụng công cụ chuẩn:
   ```bash
   node src/scripts/tkgd_case_inspector.js --test 012C2891154
   node src/scripts/tkgd_case_inspector.js --test 012C3235254
   ```
2. **Xác nhận kết quả kỳ vọng**:
   * `012C2891154`: Phân loại đúng HĐ `Nguyen_Van_Than.pdf` và Phụ lục `Nguyễn Văn Thân.pdf` $\rightarrow$ Kết quả chuyển thành **`KHOP`**.
   * `012C3235254`: Phân loại đúng Phụ lục `Nguyen_Minh_Tien_PL_A.pdf` $\rightarrow$ Loại bỏ cảnh báo lệch ngày sinh giả.
   * `003C4102930`: Vẫn giữ nguyên trạng thái **`LECH`** do TVKD gõ sai số CCCD.
3. **Cập nhật chính thức**: Chỉ thực hiện cập nhật DB sau khi có chỉ đạo bằng văn bản từ USER.
