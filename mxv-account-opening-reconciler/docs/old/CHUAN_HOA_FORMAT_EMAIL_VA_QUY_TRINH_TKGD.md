# ĐẶC TẢ CHUẨN HÓA ĐỊNH DẠNG EMAIL & TÁI CẤU TRÚC TOÀN DIỆN HỆ THỐNG ĐỐI SOÁT TKGD
*(STANDARD EMAIL SPECIFICATION & CODEBASE REFACTORING BLUEPRINT FOR TKGD RECONCILIATION)*

> **Căn cứ chỉ đạo**: Thống nhất giữa Lãnh đạo và Bộ phận Nghiệp vụ Giám sát / Quản lý Giao dịch MXV.  
> **Mục tiêu cốt lõi**: Chấm dứt vĩnh viễn tình trạng "mỗi TVKD gửi một kiểu", loại bỏ hoàn toàn ma trận regex đoán mò và các rule chắp vá trong mã nguồn. Thiết lập **1 FORMAT EMAIL CHUẨN DUY NHẤT** và **1 BỘ LUẬT ĐỐI SOÁT PHÂN MINH (DETERMINISTIC RECONCILIATION)**.

---

## PHẦN 1: BỨC TRANH HIỆN TRẠNG & CÁC ĐIỂM NGHẼN TRONG SOURCE CODE HIỆN TẠI (CODE-FIRST GROUNDING)

Khảo sát toàn bộ mã nguồn hiện tại của dự án cho thấy hệ thống đang phải duy trì hơn **4.000 dòng code chỉ để "chịu đựng" sự tùy tiện và lộn xộn của các TVKD**:

```
                               MA TRẬN HỖN LOẠN HIỆN TẠI
                               
  TVKD gửi mail tự do                Hệ thống phải gánh chịu (Codebase)
┌───────────────────────────┐      ┌────────────────────────────────────────────────────────┐
│ - Tiêu đề không quy chuẩn │ ───► │ [tkgd-mail-parser.helper.ts#L602-L650]: Hàng chục     │
│ - Tên file: 1.jpg, HXH.jpg│      │ regex bóc tách body, cố đoán xem mở phân hệ nào.       │
│   image001.png, .paint    │      ├────────────────────────────────────────────────────────┤
│ - Logo, banner, chữ ký    │ ───► │ [tkgd-mail-parser.helper.ts#L224-L323]: Đo byte PNG,  │
│   nhúng lẫn lộn           │      │ JPEG để đoán xem ảnh có phải là CCCD hay là Logo!      │
│ - TVKD gõ thiếu CCCD trên │      ├────────────────────────────────────────────────────────┤
│   M-System                │ ───► │ [tkgd_extractor_worker.py#L79-L100]: 2.534 dòng Python │
│ - Ngày cấp chip != gõ tay │      │ chỉ để khử nhiễu, xoay ảnh, ghép MRZ đảo cụm số.       │
│ - CCCD scan ghép 2 mặt    │      ├────────────────────────────────────────────────────────┤
│   nghiêng ngả             │ ───► │ [tkgd-reconcile-rules.helper.ts#L98-L135]: Phải code   │
└───────────────────────────┘      │ luật "Đồng thuận 2/3" và "Fuzzy Swap" để né lỗi lệch!  │
                                   └────────────────────────────────────────────────────────┘
```

### 1. Sự quá tải tại tầng Bóc tách Email ([tkgd-mail-parser.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts))
* **Dòng 43 – 54 (`isNamedContractImage`)**: Phải dùng 6 regex phức tạp để nhận diện tên file hợp đồng (`hd`, `hđ`, `mtk`, `hopdong`, `hop_dong`, `contract`, `hdmtk`...).
* **Dòng 86 – 120 (`isNamedCccdFront`, `isNamedCccdBack`)**: Phải phỏng đoán hàng loạt biến thể tên mặt trước/mặt sau (`truoc`, `front`, `mat1`, `mattruoc`, `mt`, `mt.`, `sau`, `back`, `mat2`, `matsau`, `ms`, `ms.`...).
* **Dòng 224 – 257 (`isDecorativeOrLogoAttachment`)**: Phải viết danh sách đen tới **25 pattern regex rác** (`facebook`, `zalo`, `telegram`, `signature`, `banner`, `footer`, `icon`, `button_`, `spacer`, `tracking`...) chỉ để tránh việc bot lấy nhầm logo công ty của TVKD làm ảnh CCCD!
* **Dòng 262 – 323 (`probeImageDimensions`)**: Phải can thiệp đọc từng byte nhị phân header của PNG, JPEG, WEBP để đo kích thước pixel (loại các ảnh có chiều ngắn < 300px hoặc chiều dài < 420px).
* **Dòng 507 – 546 (Pass 3 Fallback)**: Khi TVKD gửi ảnh đặt tên vô nghĩa (`1.jpg`, `2.jpg`, `HXH.jpg`, `HXH1.jpg`), code phải dùng logic xếp hạng phỏng đoán xem file nào là mặt trước, file nào là mặt sau.

### 2. Sự quá tải tại tầng Đối soát chéo ([tkgd-reconcile-rules.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts))
* **Dòng 98 – 135 (`isCccdChunkSwapOrFuzzyMatch`)**: Phải code thuật toán kiểm tra hoán vị 6 số đầu và 6 số cuối (Chunk Swap) vì OCR đọc ngược dòng MRZ.
* **Dòng 270 – 297**: Phải sinh ra **"Nguyên tắc Đồng Thuận 2/3 (Consensus)"** để chữa cháy: Nếu Hợp đồng khớp với M-System thì tự động coi ảnh OCR là mờ và bỏ qua lỗi lệch; nếu Ảnh khớp với M-System thì coi Hợp đồng là gõ sai.
* **Hậu quả**: Che giấu các sai phạm nghiệp vụ thực tế, code ngày càng phình to và phát sinh bug dây chuyền mỗi khi có TVKD mới tham gia.

### 3. Sự phức tạp hóa tại Worker Python ([tkgd_extractor_worker.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/scripts/python/tkgd_extractor_worker.py))
* File dài tới **2.534 dòng code**: Phải chứa hàng chục bộ lọc từ khóa rác HĐ (dòng 91-99: `để thực hiện`, `thành lập`, `bên b`, `đại diện`...), các hàm xử lý giải nén zlib cho định dạng `.paint` của Samsung/iPhone, và các vòng lặp xoay góc ảnh 90°/180°/270°.

---

## PHẦN 2: ĐẶC TẢ QUY CHUẨN EMAIL DUY NHẤT CHO TOÀN BỘ TVKD (THE GOLDEN SPECIFICATION)

Để hệ thống chạy mượt mà, chính xác 100% và không cần code fallback, ban hành **1 Quy chuẩn Email thống nhất** áp dụng bắt buộc cho tất cả các TVKD khi gửi yêu cầu mở TKGD về MXV:

### 1. Quy Chuẩn Tiêu Đề Email (Subject Line Standard)
Tiêu đề email bắt buộc tuân theo định dạng chuẩn hóa nghiêm ngặt:

```
[MỞ TKGD] - [MÃ_TVKD] - [HỌ VÀ TÊN KHÁCH HÀNG] - [MÃ_TK_FUTURES] [CÁC_TIỂU_KHOẢN_NẾU_CÓ]
```

* **Ví dụ 1 (Chỉ mở Futures)**:  
  `[MỞ TKGD] - 003 - NGUYỄN VĂN AN - 003C1234567`
* **Ví dụ 2 (Mở Futures + ACM + LME)**:  
  `[MỞ TKGD] - 012 - TRẦN THỊ BÍCH - 012C7654321 (-A, -L)`
* **Ví dụ 3 (Mở Futures + ACM + LME + Spread)**:  
  `[MỞ TKGD] - 682 - LÊ HOÀNG NAM - 682C9998888 (-A, -L, -S)`

> **Quy tắc kiểm tra**:  
> Nếu tiêu đề không bắt đầu bằng `[MỞ TKGD]` hoặc không tách đúng các trường bằng dấu gạch ngang `-` $\rightarrow$ **Hệ thống đánh dấu ngay trạng thái: `[VI_PHAM_FORMAT_TIEU_DE]` và tự động gửi phản hồi yêu cầu TVKD chuẩn hóa lại**.

---

### 2. Quy Chuẩn Nội Dung Email (Body Template Standard)
Nội dung email bắt buộc sử dụng **Bảng thông tin chuẩn (Data Table)** hoặc cấu trúc **Cặp Khóa - Giá Trị (Key-Value Form)** rõ ràng:

```html
--- THÔNG TIN YÊU CẦU MỞ TÀI KHOẢN GIAO DỊCH ---
1. Thành viên kinh doanh : [Mã số TVKD] - [Tên TVKD]
2. Họ và tên khách hàng : [Họ và tên viết hoa có dấu]
3. Số CCCD / Hộ chiếu    : [Số 12 chữ số CCCD hoặc số HC]
4. Ngày sinh             : DD/MM/YYYY
5. Giới tính             : Nam / Nữ
6. Ngày cấp CCCD         : DD/MM/YYYY
7. Nơi cấp CCCD          : [Cục Cảnh sát QLHC về TTXH / ...]
8. Mã TKGD Futures       : [Mã 0xxCxxxxxxx]
9. Tiểu khoản đăng ký    : [ACM (-A) / LME (-L) / Spread (-S) / Không]
10. Ngày ký hợp đồng     : DD/MM/YYYY
------------------------------------------------
```

> **Lợi ích tuyệt đối**:  
> Parser chỉ cần đọc chính xác 10 dòng này (dùng split theo key), **loại bỏ 100% các regex tìm kiếm mù trong body HTML**.

---

### 3. Quy Chuẩn Đặt Tên & Định Dạng Tệp Đính Kèm (Attachment Policy)

Mỗi email mở tài khoản **chỉ được phép đính kèm chính xác 3 đến 5 tệp**, đặt tên theo quy tắc bất di bất dịch:

| Tên File Bắt Buộc | Nội Dung Tệp | Định Dạng Chấp Nhận | Yêu Cầu Kỹ Thuật |
| :--- | :--- | :---: | :--- |
| **`CCCD_truoc.jpg`** | Mặt trước thẻ Căn cước công dân | `.jpg`, `.jpeg`, `.png` | Chụp thẳng góc, đủ 4 góc, rõ chữ, độ phân giải $\ge$ 1000px. |
| **`CCCD_sau.jpg`** | Mặt sau thẻ Căn cước (chứa chip & MRZ) | `.jpg`, `.jpeg`, `.png` | Chụp thẳng góc, rõ mã vạch MRZ và chip. |
| **`HD_MoTK.pdf`** | Hợp đồng mở tài khoản giao dịch | `.pdf` | File scan hoặc file ký số PDF chuẩn, đầy đủ chữ ký 2 bên. |
| **`PL01_ACM.pdf`** *(Nếu có)* | Phụ lục mở tiểu khoản ACM | `.pdf` | Bắt buộc khi có đăng ký tiểu khoản ACM (`-A`). |
| **`PL02_LME.pdf`** *(Nếu có)* | Phụ lục mở tiểu khoản LME | `.pdf` | Bắt buộc khi có đăng ký tiểu khoản LME (`-L`). |

#### ⛔ Các điều cấm tuyệt đối (Strict Prohibitions):
1. **Cấm đặt tên file tùy tiện**: Không chấp nhận `1.jpg`, `2.jpg`, `photo.png`, `HXH.jpg`, `IMG_001.jpg`...
2. **Cấm đính kèm ảnh Logo / Banner / Icon chữ ký vào Email**: TVKD phải cấu hình gửi email nghiệp vụ sạch (Plain signature), không chèn ảnh chữ ký mạng xã hội gây nhiễu bot.
3. **Cấm gửi file dị biệt**: Tuyệt đối không gửi file raw stream `.paint`, container `.heic/.heif`, hoặc file nén zip/rar.

---

### 4. Quy Chuẩn Dữ Liệu Trên M-System (M-System Integrity Policy)
Trước khi gửi email về MXV, TVKD bắt buộc phải:
* Tạo tài khoản trên M-System và **nhập đầy đủ 100% Số CCCD/Hộ chiếu**.
* **Nghiêm cấm** việc tạo tài khoản trên MS nhưng bỏ trống trường CMND/Hộ chiếu (hiện tại đang chiếm tới 135 ca lỗi của TVKD 003 và 012).
* Họ tên gõ trên MS phải viết hoa có dấu và đúng khoảng trắng đơn.

---

## PHẦN 3: BẢN ĐỒ TÁI CẤU TRÚC MÃ NGUỒN (CODE REFACTORING MAP)

Khi chuẩn hóa định dạng email thành công, hệ thống sẽ được tái cấu trúc toàn diện, loại bỏ toàn bộ mã rác:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        KIẾN TRÚC MÃ NGUỒN SAU KHI CHUẨN HÓA                            │
│                                                                                        │
│  [Mail Ingestion]                                                                      │
│         │                                                                              │
│         ▼                                                                              │
│  [Deterministic Parser] ──► Kiểm tra Tiêu đề & Cặp Key-Value chuẩn                     │
│         │                   (Nếu sai cú pháp: Đánh dấu [VI_PHAM_FORMAT] & Dừng ngay)   │
│         ▼                                                                              │
│  [Exact Attachment Classifier] ──► Nhận diện trực tiếp theo tên file chuẩn:           │
│         │                          CCCD_truoc.jpg, CCCD_sau.jpg, HD_MoTK.pdf           │
│         │                          (Không cần probe byte, không cần tính tỉ lệ ratio)   │
│         ▼                                                                              │
│  [Focused Python OCR] ──► OCR đúng file chuẩn, bóc tách MRZ dòng 2 + dòng 1            │
│         │                                                                              │
│         ▼                                                                              │
│  [Clean Reconcile Engine] ──► So khớp chính xác 1-1 (Deterministic 100%):              │
│         │                     Họ tên, Số CCCD, Ngày sinh, Ngày cấp, Mã TK              │
│         │                     (Bỏ hoàn toàn luật 2/3, bỏ fuzzy chunk swap)             │
│         ▼                                                                              │
│  [Database & UI] ──► 2 Trạng thái rõ ràng: [KHOP 100%] hoặc [VI_PHAM_QUY_CHUAN]        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Tinh Giản Backend: `tkgd-mail-parser.helper.ts` (Giảm 80% dung lượng)
* **Xóa bỏ hoàn toàn**:
  * Các hàm phân loại aspect ratio phức tạp: `isLikelyCccdAspect`, `isLikelyCccdOrCompositeAspect` ([dòng 329-348](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts#L329-L348)).
  * Hàm đo byte nhị phân header: `probeImageDimensions` ([dòng 262-323](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts#L262-L323)).
  * Danh sách 25 regex rác: `isDecorativeOrLogoAttachment` ([dòng 224-257](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts#L224-L257)).
  * Vòng lặp đoán tên file mặt trước/sau: `pickCccdImagePaths` Pass 3 ([dòng 507-546](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts#L507-L546)).
* **Thay thế bằng 1 hàm phân loại tất định (Deterministic Match)**:
  ```typescript
  export function classifyStandardAttachment(filename: string): 'CCCD_FRONT' | 'CCCD_BACK' | 'CONTRACT' | 'PL01' | 'INVALID' {
    const fn = filename.trim().toLowerCase();
    if (fn === 'cccd_truoc.jpg' || fn === 'cccd_truoc.jpeg' || fn === 'cccd_truoc.png') return 'CCCD_FRONT';
    if (fn === 'cccd_sau.jpg' || fn === 'cccd_sau.jpeg' || fn === 'cccd_sau.png') return 'CCCD_BACK';
    if (fn === 'hd_motk.pdf') return 'CONTRACT';
    if (fn.startsWith('pl01') && fn.endsWith('.pdf')) return 'PL01';
    return 'INVALID';
  }
  ```

### 2. Tinh Giản Backend: `tkgd-reconcile-rules.helper.ts` (Giảm 75% dung lượng)
* **Xóa bỏ hoàn toàn**:
  * Hàm đảo cụm số phỏng đoán: `isCccdChunkSwapOrFuzzyMatch` ([dòng 98-135](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts#L98-L135)).
  * Khối logic đồng thuận 2/3 mập mờ ([dòng 270-297](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts#L270-L297)).
* **Thay thế bằng 1 Bộ Luật Chuẩn 5 Tiêu Chí (Assert All 5 Criteria)**:
  1. `assert(Họ tên HĐ == Họ tên CCCD == Họ tên MS)`
  2. `assert(Số CCCD HĐ == Số CCCD Ảnh == Số CCCD MS)`
  3. `assert(Ngày sinh HĐ == Ngày sinh CCCD == Ngày sinh MS)`
  4. `assert(Mã TKGD trên Mail == Mã TKGD trên HĐ == Mã TKGD trên MS)`
  5. `assert(M-System đã được TVKD nhập số CCCD đầy đủ)`
  * Nếu thỏa mãn đủ 5 tiêu chí $\rightarrow$ **`KHOP` 100%**.
  * Nếu vi phạm bất kỳ tiêu chí nào $\rightarrow$ **Báo lỗi đích danh, không tự động chữa lành mập mờ**.

### 3. Tinh Giản Worker Python: `tkgd_extractor_worker.py`
* Bỏ toàn bộ code giải mã `.paint`, các heuristics đoán tên người trong HĐ dài hàng trăm dòng.
* Tập trung tối đa năng lực vào:
  * OCR trực tiếp file `CCCD_truoc.jpg` lấy: Họ tên, Số CCCD, Ngày sinh, Ngày hết hạn.
  * OCR trực tiếp file `CCCD_sau.jpg` giải mã dòng MRZ ICAO dòng 2 kiểm tra dòng 1 lấy: Ngày cấp, Ngày sinh, Giới tính.
  * Đọc text trực tiếp từ layer text của file PDF `HD_MoTK.pdf` (không cần OCR PDF giúp tốc độ tăng gấp 10 lần).

### 4. Tinh Giản Frontend: `TkgdRecordsTable.tsx` & `TkgdFilterBar.tsx`
* Bảng danh sách phân định rõ ràng 3 trạng thái duy nhất:
  * 🟢 **`KHỚP 100%`**: Hồ sơ chuẩn chỉ, sẵn sàng duyệt.
  * 🔴 **`SAI LỆCH THÔNG TIN`**: Thông tin giữa HĐ/CCCD/M-System không trùng khớp.
  * 🟡 **`VI PHẠM QUY CHUẨN EMAIL`**: TVKD gửi sai tiêu đề, thiếu file chuẩn, hoặc M-System chưa nhập CCCD (có nút bấm xuất danh sách vi phạm gửi thông báo nhắc nhở TVKD).

---

## PHẦN 4: LỘ TRÌNH TRIỂN KHAI & HÀNH ĐỘNG CỤ THỂ

| Giai Đoạn | Nhiệm Vụ Cụ Thể | Sản Phẩm Đầu Ra |
| :--- | :--- | :--- |
| **Giai đoạn 1** *(Ban hành chính sách)* | Phòng Nghiệp vụ Giám sát & QLGD ban hành văn bản chính thức tới toàn bộ TVKD về **"Quy chuẩn Định dạng Email & Hồ sơ Mở TKGD"**. Cho TVKD thời gian chuyển tiếp 3–5 ngày. | Văn bản thông báo & Mẫu email chuẩn gửi TVKD. |
| **Giai đoạn 2** *(Refactor Mã Nguồn)* | Dọn dẹp toàn bộ các hàm regex rác trong `tkgd-mail-parser.helper.ts`, `tkgd-reconcile-rules.helper.ts` và Python worker. Chuyển sang parser chuẩn xác. | Mã nguồn sạch sẽ, giảm từ 4.000 dòng xuống < 800 dòng. |
| **Giai đoạn 3** *(Kiểm thử & Go-Live)* | Sử dụng công cụ kỹ thuật Dev Remediation Tool kiểm thử với các email chuẩn mới. Khóa các luồng parser cũ. | Hệ thống vận hành tự động 100%, không còn lỗi vặt. |

---

> **Kết luận**: Khi chuẩn hóa được đầu vào, toàn bộ bài toán đối soát TKGD sẽ trở về đúng bản chất là một **phép so khớp chuỗi chính xác (Exact Matching)** đơn giản và ổn định tuyệt đối. Đội ngũ kỹ thuật sẽ hoàn toàn giải phóng khỏi việc phải "chạy theo sửa bug cho từng TVKD".
