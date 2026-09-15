# TÀI LIỆU THIẾT KẾ KIẾN TRÚC HỆ THỐNG QUÉT & BÓC TÁCH HỒ SƠ TKGD
## (TKGD Document Scanning & Intelligent OCR Processing System)
### Tiêu chuẩn kỹ thuật: ICAO Doc 9303 Part 5 • ISO/IEC 7810 ID-1 • OpenCV Vision Pipeline • IEEE NRIQA

---

## 1. TỔNG QUAN & MỤC TIÊU KIẾN TRÚC

### 1.1. Bối cảnh nghiệp vụ
Trong quy trình kiểm soát ca trực tại Sở Giao dịch Hàng hóa Việt Nam (MXV), Cán bộ Giám sát Vận hành chịu trách nhiệm đối soát hồ sơ mở Tài khoản Giao dịch (TKGD) giữa 3 nguồn thông tin:
1. **Email Outlook**: Email yêu cầu mở TKGD từ các Thành viên Kinh doanh (TVKD), đính kèm file Hợp đồng mở TKGD (PDF), Phụ lục bổ sung tài khoản ACM/LME (PDF), và ảnh chụp Căn cước công dân (CCCD).
2. **Hệ thống M-System (M-Web)**: Dữ liệu hồ sơ do TVKD nhập liệu trực tuyến kèm ảnh CCCD và chữ ký tải lên hệ thống lõi.
3. **Cơ sở dữ liệu quản lý ca trực**: Lưu trữ lịch sử đối soát, kết luận kiểm toán và dấu vết can thiệp (Audit Trail).

### 1.2. Mục tiêu kỹ thuật của Module Scan
* **Độ chính xác bóc tách (Field-level Accuracy)**: Đạt $\ge 99.5\%$ trên toàn bộ các trường định danh cốt lõi (Số TKGD, Số Hợp đồng, Số CCCD, Họ và tên, Ngày sinh, Ngày cấp, Nơi cấp, Chữ ký).
* **Tốc độ xử lý (Processing Throughput)**: Thời gian bóc tách trung bình $\le 0.25\text{ giây}$ / tài khoản đối với hồ sơ chuẩn; $\le 0.8\text{ giây}$ đối với hồ sơ phức tạp (ảnh mờ hoặc chụp lệch).
* **Triệt tiêu nhận diện sai lệch oan (Zero False Positive)**: Không bao giờ gắn cờ cảnh báo lỗi đối với các định dạng ảnh hợp lệ (như ảnh ghép 2 mặt, ảnh chụp có lề đen padding, ngày cấp in chữ nhỏ đè nền vân hoa văn).
* **Bảo mật & On-Premise 100%**: Xử lý hoàn toàn cục bộ trên máy chủ nội bộ MXV (Ubuntu `10.0.0.26`), không rò rỉ dữ liệu định danh khách hàng ra mạng Internet công cộng.

---

## 2. CƠ SỞ KHOA HỌC & TIÊU CHUẨN QUỐC TẾ (THEORETICAL FOUNDATION)

### 2.1. Tiêu chuẩn Kích thước Hình học Thẻ: ISO/IEC 7810 ID-1
Tất cả các loại thẻ Căn cước công dân và Căn cước của Việt Nam (từ 1999 đến 2024) đều tuân thủ định dạng vật lý **ID-1** theo chuẩn quốc tế **ISO/IEC 7810:2019**:
* **Kích thước danh định**: Chiều dài $W_0 = 85.60\text{ mm} \pm 0.12\text{ mm}$, Chiều rộng $H_0 = 53.98\text{ mm} \pm 0.05\text{ mm}$.
* **Tỉ lệ khung hình chuẩn (Nominal Aspect Ratio)**:
  $$R_{ID-1} = \frac{W_0}{H_0} = \frac{85.60}{53.98} \approx 1.58577 \approx 1.586$$
* **Bán kính bo cong 4 góc (Corner Radius)**:
  $$r = 3.18\text{ mm} \pm 0.30\text{ mm} \quad (\approx 0.125\text{ inch})$$
* **Độ dày tiêu chuẩn**: $0.76\text{ mm} \pm 0.08\text{ mm}$.

> **Ứng dụng trong Module Scan**:
> 1. Ma trận phối cảnh chuẩn hóa (`cv2.warpPerspective`) luôn đưa ảnh thẻ về kích thước phân giải cao cố định $1000 \times 630\text{ px}$ (tương ứng tỉ lệ $\approx 1.587$, độ sai lệch $< 0.08\%$).
> 2. Bất kỳ ảnh chụp đơn nào có tỉ lệ $W / H \notin [1.35, 1.85]$ sẽ lập tức được kiểm tra xem có phải ảnh ghép 2 mặt dọc ($H \ge 0.85W$) hay không trước khi xử lý.

---

### 2.2. Đo lường Độ nét Ảnh (No-Reference Image Quality Assessment)
Để phát hiện ảnh bị rung tay, nhòe mờ hoặc mất nét (Out-of-Focus) mà không cần ảnh tham chiếu, hệ thống sử dụng **toán tử Laplacian biến thiên (Variance of Laplacian - LAPV)** theo nghiên cứu kinh điển của **Pech-Pacheco et al. (2000)**:

Toán tử vi phân bậc hai Laplacian 2D của ảnh độ xám $I(x, y)$:
$$\nabla^2 I(x, y) = \frac{\partial^2 I}{\partial x^2} + \frac{\partial^2 I}{\partial y^2}$$

Trong miền rời rạc, toán tử được xấp xỉ bằng phép tích chập ma trận (Kernel Convolution) $3 \times 3$:
$$L(x, y) = I(x, y) * \begin{bmatrix} 0 & 1 & 0 \\ 1 & -4 & 1 \\ 0 & 1 & 0 \end{bmatrix}$$

Chỉ số đo độ tập trung nét (Focus Measure Score - $F_{LAPV}$) là phương sai của đáp ứng vi phân trên toàn bộ $M \times N$ điểm ảnh:
$$\bar{L} = \frac{1}{M \cdot N} \sum_{x=0}^{M-1} \sum_{y=0}^{N-1} L(x, y)$$
$$F_{LAPV} = \sigma^2_L = \frac{1}{M \cdot N} \sum_{x=0}^{M-1} \sum_{y=0}^{N-1} \left( L(x, y) - \bar{L} \right)^2$$

* **Ngưỡng quyết định (Decision Threshold)**:
  * $F_{LAPV} \ge 60.0$: Ảnh rất sắc nét, đọc OCR đạt độ tin cậy tuyệt đối.
  * $35.0 \le F_{LAPV} < 60.0$: Ảnh mức độ trung bình, kích hoạt bộ lọc tăng cường cạnh trước khi OCR.
  * $F_{LAPV} < 35.0$: **Ảnh bị nhòe nét/rung tay nghiêm trọng** $\rightarrow$ Hệ thống lập tức gắn cờ cảnh báo:
    `"Ảnh chụp bị mờ, rung tay (Focus Score: X < 35.0)"`.

---

### 2.3. Khử Lóa Phản Xạ Đèn Flash (Specular Glare Removal via Inpainting)
Khi chụp ảnh thẻ căn cước có lớp cán bóng (plastic laminate), ánh sáng đèn flash thường tạo ra các vệt lóa trắng (specular highlights) làm mất thông tin ký tự số hoặc ngày sinh. Hệ thống áp dụng phương pháp **Telea Fast Marching Inpainting (Telea, 2004)**:

#### Bước 1: Trích xuất mặt nạ vùng lóa trong không gian màu HSV
Chuyển ảnh sang không gian màu $HSV$. Điểm ảnh lóa được đặc trưng bởi độ sáng cực đại (Value $V \to 255$) và độ bão hòa màu cực thấp (Saturation $S \to 0$ do ánh sáng trắng khử màu nền):
$$\Omega_{glare} = \left\{ (x, y) \;\middle|\; V(x, y) \ge 230 \;\land\; S(x, y) \le 40 \right\}$$

#### Bước 2: Giãn nở hình thái học (Morphological Dilation)
Để bao phủ cả vùng chuyển tiếp hào quang (halo boundary), mặt nạ $\Omega_{glare}$ được giãn nở bằng phần tử cấu trúc chữ thập $3 \times 3$:
$$\Omega_{mask} = \Omega_{glare} \oplus \begin{bmatrix} 0 & 1 & 0 \\ 1 & 1 & 1 \\ 0 & 1 & 0 \end{bmatrix}$$

#### Bước 3: Lan truyền phục hồi theo phương pháp Fast Marching (Telea Algorithm)
Giá trị phục hồi tại điểm ảnh $p \in \Omega_{mask}$ được tính toán bằng trung bình có trọng số từ các điểm lân cận $q \in B_\epsilon(p)$ nằm ngoài vùng lóa:
$$I(p) = \frac{\sum_{q \in B_\epsilon(p)} w(p, q) \cdot \left[ I(q) + \nabla I(q) \cdot (p - q) \right]}{\sum_{q \in B_\epsilon(p)} w(p, q)}$$
Trọng số $w(p, q)$ kết hợp khoảng cách hình học, gradient định hướng và hàm mức độ biên (Level Set distance):
$$w(p, q) = \text{dir}(p, q) \cdot \text{dst}(p, q) \cdot \text{lev}(p, q)$$
Thuật toán này giúp xóa sạch đốm lóa flash mà vẫn bảo tồn cấu trúc viền nét chữ bên dưới.

---

### 2.4. Cân Bằng Biểu Đồ Thích Ứng Có Giới Hạn Tương Phản (CLAHE)
Đối với vùng in ngày cấp / nơi cấp mặt sau CCCD (chữ in nhỏ trên nền vân hoa văn bảo an phức tạp), phương pháp cân bằng histogram toàn cục truyền thống làm khuếch đại nhiễu nền. Hệ thống sử dụng **CLAHE (Contrast-Limited Adaptive Histogram Equalization - Zuiderveld, 1994)**:

1. **Phân vùng lưới (Grid Tiling)**: Chia ảnh xám thành các khối cục bộ (Tiles) kích thước $8 \times 8$ điểm ảnh.
2. **Cắt ngưỡng giới hạn tương phản (Clip Limit)**:
   Để ngăn chặn việc khuếch đại quá mức các vân bảo an lặp lại, số lượng điểm ảnh trong mỗi bin của biểu đồ tần suất bị chặn ở ngưỡng $\beta$:
   $$\beta = \frac{N_{pixels}}{N_{bins}} \left( 1 + \frac{\alpha}{100} (\beta_{max} - 1) \right)$$
   Với $\beta_{limit} = 3.0$, số lượng điểm ảnh vượt quá ngưỡng cắt được phân phối đều (redistributed) lại cho tất cả $N_{bins} = 256$.
3. **Nội suy song tuyến tính (Bilinear Interpolation)**:
   Để loại bỏ hiện tượng đứt gãy đường biên giữa các ô lưới $8 \times 8$, giá trị điểm ảnh cuối cùng được nội suy mượt mà giữa 4 tâm khối lân cận:
   $$I_{out}(x, y) = (1 - s)(1 - t) T_{TL} + s(1 - t) T_{TR} + (1 - s)t T_{BL} + st T_{BR}$$
   trong đó $(s, t)$ là tọa độ chuẩn hóa tương đối của điểm ảnh so với 4 tâm khối bao quanh.

---

### 2.5. Tiêu Chuẩn Quốc Tế ICAO Doc 9303 Part 5: Dải Ký Tự Cơ Học MRZ (TD1)
Mặt sau thẻ CCCD gắn chip (2021-2024) và thẻ Căn cước (2024) của Việt Nam tuân thủ nghiêm ngặt định dạng **TD1 (Size 1 Machine Readable Official Travel Document)** theo chuẩn **ICAO Doc 9303 Part 5**:
* **Bố cục hình học**: Gồm đúng 3 dòng $\times$ 30 ký tự (Tổng cộng 90 ký tự), in bằng phông chữ quang học tiêu chuẩn **OCR-B**.

```
┌──────────────────────────────────────────────────────────────┐
│ Dòng 1: IDVNMA123456781014201005533<<<<              (30 ký tự)│
│ Dòng 2: 0105156M3105158VNM<<<<<<<<<<<8              (30 ký tự)│
│ Dòng 3: HOANG<<VAN<LONG<<<<<<<<<<<<<                 (30 ký tự)│
└──────────────────────────────────────────────────────────────┘
```

#### A. Chi tiết trường dữ liệu theo vị trí (Character Offsets)
| Dòng | Vị trí (1-based) | Độ dài | Trường dữ liệu (Field Name) | Định dạng / Ví dụ |
| :--- | :--- | :--- | :--- | :--- |
| **Dòng 1** | $1 - 2$ | 2 | Mã loại giấy tờ (Document Code) | `ID` (Identity Card) |
| | $3 - 5$ | 3 | Quốc gia phát hành (Issuing State) | `VNM` (Việt Nam) |
| | $6 - 14$ | 9 | Số giấy tờ / Định danh chính | `A12345678` hoặc 9 số đầu |
| | **15** | **1** | **Mã kiểm tra số giấy tờ (Check Digit 1)** | Số nguyên $[0 - 9]$ |
| | $16 - 30$ | 15 | Dữ liệu tùy chọn (Optional Data) | Số định danh 12 chữ số |
| **Dòng 2** | $1 - 6$ | 6 | Ngày sinh người mang thẻ | `YYMMDD` (Ví dụ: `010515` = 15/05/2001) |
| | **7** | **1** | **Mã kiểm tra ngày sinh (Check Digit 2)** | Số nguyên $[0 - 9]$ |
| | 8 | 1 | Giới tính (Sex) | `M` (Nam), `F` (Nữ), `<` (Chưa xác định) |
| | $9 - 14$ | 6 | Ngày hết hạn hiệu lực thẻ | `YYMMDD` (Ví dụ: `310515` = 15/05/2031) |
| | **15** | **1** | **Mã kiểm tra hạn dùng (Check Digit 3)** | Số nguyên $[0 - 9]$ |
| | $16 - 18$ | 3 | Quốc tịch người mang thẻ | `VNM` (Việt Nam) |
| | $19 - 29$ | 11 | Dữ liệu tùy chọn dòng 2 | Ký tự đệm filler `<<<<<<<<<<<` |
| | **30** | **1** | **Mã kiểm tra tổng thể (Composite Check Digit)** | Số nguyên $[0 - 9]$ bao quát toàn bộ thẻ |
| **Dòng 3** | $1 - 30$ | 30 | Họ và tên người mang thẻ | `HỌ<<TÊN<ĐỆM<VÀ<TÊN<<<<` |

#### B. Thuật toán Kiểm tra Check Digit (ICAO 9303 Modulo 10 Checksum Algorithm)
Mỗi chữ số kiểm tra $c$ được tính toán trên chuỗi ký tự nguồn $a_1 a_2 \dots a_k$ theo nguyên tắc:

1. **Bảng ánh xạ giá trị ký tự $v(a)$**:
   $$v(a) = \begin{cases} 
   \text{ord}(a) - \text{ord}('0') & \text{với } a \in ['0' \dots '9'] \quad (0 \dots 9) \\
   \text{ord}(a) - \text{ord}('A') + 10 & \text{với } a \in ['A' \dots 'Z'] \quad (10 \dots 35) \\
   0 & \text{với } a = '<' \text{ (ký tự đệm filler)}
   \end{cases}$$

2. **Dãy trọng số lặp chu kỳ 3 bước (Repeating Weight Sequence $w_i$)**:
   Chuỗi trọng số chuẩn hóa của ICAO luôn lặp lại:
   $$w = [7, 3, 1, 7, 3, 1, 7, 3, 1, \dots] \implies w_i = \begin{cases} 7 & \text{nếu } i \pmod 3 = 1 \\ 3 & \text{nếu } i \pmod 3 = 2 \\ 1 & \text{nếu } i \pmod 3 = 0 \end{cases}$$

3. **Công thức Modulo 10 Checksum**:
   $$c = \left( \sum_{i=1}^{k} w_i \cdot v(a_i) \right) \pmod{10}$$

> **Ý nghĩa kiểm soát chất lượng**:
> Nếu $c_{tính\_toán} \neq c_{in\_trên\_thẻ}$, hệ thống khẳng định **100% OCR đã đọc sai ký tự quang học** (ví dụ nhầm giữa `8` và `B`, `0` và `O`, `1` và `I`).
> Hệ thống sẽ kích hoạt bộ sửa lỗi quang học (Heuristic Char Substitution) để thay thế tương đương cho đến khi Check Digit khớp hoàn toàn, đảm bảo tính toàn vẹn toán học tuyệt đối của dữ liệu đầu ra!

---

### 2.6. Khoảng Cách Chỉnh Sửa Chuỗi Ngữ Nghĩa (Levenshtein & Jaro-Winkler)
Khi so khớp họ tên tiếng Việt và cơ quan cấp giữa ảnh bóc tách và cơ sở dữ liệu M-System:

#### Khoảng cách Levenshtein Chuẩn Hóa (Normalized Levenshtein Similarity)
Số lượng phép biến đổi cơ bản tối thiểu (Chèn $\text{ins}$, Xóa $\text{del}$, Thay thế $\text{sub}$) để chuyển chuỗi $s_1$ thành $s_2$:
$$\text{Sim}_{Lev}(s_1, s_2) = 1 - \frac{\text{Lev}(s_1, s_2)}{\max(|s_1|, |s_2|)}$$

#### Độ tương đồng Jaro-Winkler (Jaro-Winkler Metric)
Dành riêng cho việc so khớp Họ và tên người (ưu tiên trùng khớp cụm từ đầu):
$$\text{Sim}_J = \frac{1}{3} \left( \frac{m}{|s_1|} + \frac{m}{|s_2|} + \frac{m - t}{m} \right)$$
$$\text{Sim}_{JW}(s_1, s_2) = \text{Sim}_J + l \cdot p \cdot (1 - \text{Sim}_J)$$
với $m$ là số ký tự trùng nhau, $t$ là số phép đổi vị trí, $l$ là độ dài tiền tố chung tối đa ($l \le 4$), hệ số tỉ lệ $p = 0.1$.
* Nếu $\text{Sim}_{JW} \ge 0.92 \implies$ Tự động chấp nhận trùng khớp (khử qua các lỗi sai dấu thanh tiếng Việt do OCR).

---

### 2.7. Đặc Tả Hình Học 4 Thế Hệ Thẻ Định Danh Việt Nam (1999 - 2026)

| Tiêu chí phân loại | Thế hệ 1: CMND 9 số | Thế hệ 2: CCCD Mã vạch | Thế hệ 3: CCCD Gắn chip | Thế hệ 4: Thẻ Căn cước 2024 |
| :--- | :--- | :--- | :--- | :--- |
| **Căn cứ pháp lý** | Nghị định 05/1999/NĐ-CP | Luật CCCD 2014 (cấp 2016-2020) | Thông tư 06/2021/TT-BCA | Luật Căn cước số 26/2023/QH15 |
| **Chất liệu & Cấu trúc** | Giấy ép màng plastic dẻo | Nhựa composite PET bóng | Nhựa PVC/PET nhiều lớp | Nhựa Polycarbonate cao cấp |
| **Ký hiệu phân loại** | `CMND_9_SO` | `CCCD_MA_VACH` | `CCCD_CHIP_2021` | `CAN_CUOC_2024` |
| **Số định danh** | 9 chữ số | 12 chữ số | 12 chữ số | 12 chữ số |
| **Tiêu đề mặt trước** | `CHỨNG MINH NHÂN DÂN` | `CĂN CƯỚC CÔNG DÂN` | `CĂN CƯỚC CÔNG DÂN` | `CĂN CƯỚC` *(bỏ "CÔNG DÂN")* |
| **Trường nhân thân** | Quê quán, Dân tộc, Tôn giáo | Quê quán, Quốc tịch | Quê quán, Quốc tịch | *Đổi thành*: Nơi ĐK khai sinh & Nơi cư trú |
| **Mã vạch / QR Code** | Không có | Mã vạch 2D mặt sau | QR mặt trước (góc trên phải) | QR chuyển sang **MẶT SAU** |
| **Chip điện tử** | Không có | Không có | **MẶT TRƯỚC** (phôi vàng) | Chuyển sang **MẶT SAU** (cạnh QR) |
| **Vùng MRZ ICAO** | Không có | Không có | **Có (Mặt sau, TD1 3 dòng)** | **Có (Mặt sau, TD1 3 dòng)** |
| **Cơ quan cấp in thẻ** | CÔNG AN TỈNH/TP... | CỤC CẢNH SÁT ĐKQL CƯ TRÚ... | CỤC TRƯỞNG CỤC C06 | **BỘ CÔNG AN** |
| **Hiệu lực mở TKGD** | ⛔ **Hết hiệu lực từ 01/01/2025** |  Vẫn còn giá trị nếu chưa hết hạn | ✅ Hợp lệ 100% | ✅ Hợp lệ 100% |

---

## 3. BỨC TRANH KIẾN TRÚC TỔNG THỂ (5-TIER PIPELINE ARCHITECTURE)

Hệ thống bóc tách tài liệu TKGD được cấu trúc thành 5 tầng độc lập, tuần tự và khép kín:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: TIẾP NHẬN & PHÂN LOẠI ĐA NGUỒN (Ingestion & Layout Classifier)                 │
│ ├─ Tệp PDF Hợp đồng (Born-digital Text vs Scanned Image PDF)                          │
│ ├─ Tệp PDF Phụ lục PL01 (ACM / LME / Spread)                                           │
│ └─ Ảnh CCCD (Mặt trước đơn / Mặt sau đơn / Ảnh ghép 2 mặt dọc-ngang / Nền đệm canvas) │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: TIỀN XỬ LÝ HÌNH HỌC & CĂN CHỈNH THÍCH ỨNG (Adaptive Preprocessing)             │
│ ├─ Phân loại bố cục (Horizontal Single vs Vertical Dual-Stack Composite)              │
│ ├─ Auto-Deskew & 4-Point Perspective Transform (Chuẩn hóa về 1000x630px ISO 7810)      │
│ ├─ Glare Suppression via Fast Marching Inpainting (Telea 2004 trên vùng lóa flash)    │
│ ├─ Focus Metric Assessment (Laplacian Variance LAPV < 35.0 gắn cờ mờ nét)             │
│ └─ Bicubic Upscaling x2 + CLAHE (Tile 8x8, ClipLimit 3.0 cho vùng chữ in nhỏ)          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: BỘ MÁY BÓC TÁCH HYBRID THÁC NƯỚC (Cascade Multi-Engine Extraction)            │
│ ├─ Bước 1 (10ms): Hardware Decoders (QR Code Mặt trước / Mặt sau Căn cước 2024)        │
│ ├─ Bước 2 (20ms): ICAO 9303 TD1 Checksum (3 dòng MRZ bóc tách Số thẻ, Ngày sinh, Hạn) │
│ ├─ Bước 3 (50ms): Specialized Vietnamese OCR (VietOCR/Tesseract trên vùng ROI)         │
│ └─ Bước 4 (Smart Fallback): Cloud AI Vision (Chỉ gọi khi độ tin cậy < 85%)             │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 4: GIÁM SÁT CHẤT LƯỢNG & BẢO VỆ TOÀN VẸN (Image Quality & Integrity Guardian)    │
│ ├─ Phân biệt Zero-Margin Over-Cropped thật sự (mất góc bo) vs Padded Canvas an toàn    │
│ ├─ Edge-to-Text Proximity Checker (Khoảng cách chữ cốt lõi tới mép ảnh < 8px)          │
│ ├─ Truncated Text Detector (Phát hiện cụm chữ bị xén đứt đuôi "Việt N", "trỏ phả")     │
│ └─ Card Generation Validation (Cảnh báo CMND 9 số hết hạn / CCCD mã vạch không chip)   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 5: SO SÁNH NGỮ NGHĨA & TÍNH ĐIỂM TIN CẬY (Semantic Reconciliation & Scoring)     │
│ ├─ Từ điển tương đương: Nơi cấp (BCA ≡ C06), Giới tính (Nam/Nữ ≡ Male/Female)          │
│ ├─ Hệ số tin cậy tổng thể (Confidence Score: 0 - 100% dựa trên trọng số trường)        │
│ ├─ Phân định cấp độ cảnh báo: Fatal Error (Lệch đỏ) vs Advisory Warning (Lưu ý vàng)   │
│ └─ Bounding Box Coordinates Export (Xuất tọa độ hiển thị trực quan trên Web Dashboard) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. THIẾT KẾ CHI TIẾT TỪNG MODULE CHỨC NĂNG

### 4.1. Module Tiền Xử Lý Hình Học (Geometric & Adaptive Preprocessing)

#### A. Phân loại bố cục ảnh thông minh (Layout Classifier)
Trước khi xử lý bóc tách, ảnh đầu vào được đưa qua bộ phân tích hình học sơ cấp:
* **Tỉ lệ khung hình ($R = W / H$)**:
  * $R \in [1.35, 1.85]$: Nhận diện là **Ảnh thẻ đơn nằm ngang** chuẩn ISO/IEC 7810 ID-1 ($85.6 \times 53.98\text{ mm} \approx 1.586$).
  * $R \le 1.15$ hoặc $H \ge W \times 0.85$: Nhận diện là **Ảnh thẻ xếp chồng theo chiều dọc (Vertical Stack Composite)** hoặc ảnh chụp tài liệu khổ đứng.
* **Phân tích cường độ 4 cạnh ($E_{top}, E_{bot}, E_{left}, E_{right}$)**:
  * Nếu $E_{left} < 80$ và $E_{right} < 80$ (2 mép là màu tối/đen) kết hợp $H \ge W \times 0.85$:
    $\rightarrow$ Gắn nhãn: `COMPOSITE_DUAL_CARD` (Ảnh ghép 2 mặt trên canvas đen như case Hoàng Văn Long `012C0074622`).
  * **Hành vi xử lý**: Tự động chia đôi ảnh:
    * `front_img = im[0 : int(h * 0.52), :]`
    * `back_img = im[int(h * 0.48) : h, :]`
    * Chuyển 2 ảnh con độc lập vào pipeline bóc tách, triệt tiêu hoàn toàn nguy cơ mép ảnh chạm vào khung hình!

#### B. Tự động nắn phẳng phối cảnh (4-Point Perspective Transform)
Đối với ảnh chụp bằng điện thoại bị xiên góc:
1. Chuyển ảnh xám $\rightarrow$ Làm mờ Gaussian Blur ($5 \times 5$) $\rightarrow$ Canny Edge Detection (`threshold1=50, threshold2=150`).
2. Tìm đường bao lớn nhất (`cv2.findContours`) có 4 đỉnh thỏa mãn xấp xỉ đa giác (`cv2.approxPolyDP` với sai số $\epsilon = 0.02 \times \text{Perimeter}$).
3. Sắp xếp 4 tọa độ theo thứ tự: Trên-Trái ($TL$), Trên-Phải ($TR$), Dưới-Phải ($BR$), Dưới-Trái ($BL$).
4. Tính ma trận biến đổi phối cảnh $M = \text{cv2.getPerspectiveTransform}(pts_{src}, pts_{dst})$ với kích thước đích chuẩn $1000 \times 630\text{ px}$.
5. Áp dụng `cv2.warpPerspective` $\rightarrow$ Thu được ảnh thẻ phẳng phiu, các góc bo tròn được bảo toàn nguyên vẹn.

---

### 4.2. Module Bóc Tách Thẻ Căn Cước Theo Cơ Chế Thác Nước (Cascade Extraction Engine)

Để tối ưu hóa cả về **tốc độ (Throughput)** và **độ chính xác (Precision)**, hệ thống không quét OCR mù trên toàn bộ ảnh mà thực hiện theo 4 bước thác nước:

```
               [ ẢNH CCCD ĐÃ QUA TIỀN XỬ LÝ ]
                              │
                              ▼
                ┌───────────────────────────┐
                │ Bước 1: Quét Mã QR (10ms) │
                └─────────────┬─────────────┘
                              │
               Có mã QR? ────► Có ────► [Trích xuất 100% Số CCCD, Họ tên, NS, GT, Địa chỉ]
                              │
                             Không
                              │
                              ▼
                ┌───────────────────────────┐
                │ Bước 2: Quét MRZ (20ms)   │
                └─────────────┬─────────────┘
                              │
               Có MRZ?   ────► Có ────► [Trích xuất Số CCCD, Ngày sinh, Giới tính, Hạn dùng]
                              │
                             Không
                              │
                              ▼
                ┌───────────────────────────┐
                │ Bước 3: ROI-OCR + CLAHE   │
                │         (50ms)            │
                └─────────────┬─────────────┘
                              │
             Đủ thông tin?───► Có ────► [Trích xuất Ngày cấp, Nơi cấp, Họ tên có dấu]
                              │
                             Không
                              │
                              ▼
                ┌───────────────────────────┐
                │ Bước 4: Fallback Vision   │
                │         (Nếu < 85%)       │
                └───────────────────────────┘
```

#### Bước 1: Quét Mã QR phần cứng
* Hỗ trợ 2 vị trí theo phôi thẻ:
  * **Phôi 2021-2023**: QR ở góc trên bên phải mặt trước.
  * **Phôi Luật Căn cước 2024**: QR chuyển sang **MẶT SAU** (bên cạnh chip điện tử).
* Cấu trúc giải mã chuỗi QR chuẩn BCA:
  `Số CCCD|Số CMND cũ|Họ và tên|Ngày sinh (DDMMYYYY)|Giới tính|Địa chỉ thường trú|Ngày cấp (DDMMYYYY)`
* Khi giải mã thành công: Tỉ lệ chính xác đạt **100% tuyệt đối**, không phụ thuộc vào chất lượng in mực hay font chữ.

#### Bước 2: Quét dải ký tự cơ học MRZ (Machine Readable Zone)
* Cấu trúc 3 dòng ICAO 9303 TD1 ở mặt sau thẻ.
* Áp dụng thuật toán Modulo 10 Check Digit (trọng số 7-3-1) để tự động sửa lỗi và xác nhận độ toàn vẹn 100%.

#### Bước 3: Tiền xử lý khoanh vùng (ROI) + CLAHE bóc tách Ngày cấp & Nơi cấp
* Vùng Ngày cấp mặt sau CCCD gắn chip nằm ở:
  $Y \in [0.08H, 0.65H]$, $X \in [0.25W, 0.98W]$.
* Áp dụng CLAHE + Otsu Binarization + Tesseract `--oem 3 --psm 6`.
* **Van an toàn (Safety Gate)**: Chỉ chấp nhận ngày cấp thỏa mãn:
  $1 \le DD \le 31$, $1 \le MM \le 12$, $2015 \le YYYY \le 2026$. Nếu không chắc chắn, giữ nguyên trạng thái `None` (Chưa quét) để Cán bộ đối soát bằng mắt, tuyệt đối không đoán bừa làm lệch hồ sơ.

---

### 4.3. Module Bóc Tách Hợp Đồng Mở TKGD & Chữ Ký (PDF Extractor)

#### A. Chiến lược bóc tách PDF Kép (Hybrid Dual-Strategy)
* **Nhánh 1: PDF số nguyên bản (Born-Digital Text Layer)**:
  * Sử dụng PyMuPDF (`fitz`) trích xuất text block trong $0.03\text{ giây}$.
  * Định vị các mốc neo (Anchor Regex):
    * Số TKGD: `\b([0-9]{3}[A-Z]\d{7})\b`
    * Số Hợp đồng: `(?:Số hợp đồng|Contract No\.?|Số)[\s:]+([A-Z0-9\-/]+)`
    * Họ tên: Tìm kiếm sau cụm từ `BÊN B (Khách hàng)` hoặc `Tên khách hàng`.
    * Số CCCD: `(?:CCCD|CMND|Số định danh)[\s:]+(\d{9,12})`.
* **Nhánh 2: PDF Scan từ bản in giấy (Scanned Document Fallback)**:
  * Nếu tổng số ký tự text trích xuất được $< 50$ ký tự $\rightarrow$ Kích hoạt `fitz.Page.get_pixmap(dpi=300)`.
  * Chuyển trang văn bản thành ảnh quét độ phân giải cao và đưa qua engine OCR với từ điển form mẫu HĐ MXV để bóc tách thông tin.

#### B. Nhận diện & Xác thực Khối Chữ Ký (Signature Box Detector)
* Định vị tọa độ vùng chữ ký: Nằm ở 1/3 cuối trang cuối của Hợp đồng / Phụ lục PL01, dưới dòng chữ:
  `"ĐẠI DIỆN KHÁCH HÀNG"` hoặc `"BÊN B (Ký, ghi rõ họ tên)"`.
* Thuật toán phân tích mực ký (Ink Density Analysis):
  1. Loại bỏ các đường kẻ bảng (Hough Line Transform).
  2. Đếm mật độ điểm ảnh mực đen/xanh trong khung ký (Pixel Ratio $> 0.5\%$).
  3. Nếu mật độ pixel $> 0.5\%$ $\rightarrow$ Đánh dấu: `"Đã ký"`.
  4. Nếu khung hoàn toàn trắng $\rightarrow$ Cảnh báo: `"Thiếu chữ ký khách hàng trên HĐ"`.

---

### 4.4. Module Kiểm Tra Chất Lượng & Chống Phạt Oan (Quality Guardian)

Để đảm bảo không tái diễn các lỗi nhận diện sai lầm (như bắt oan Hoàng Văn Long hay bỏ lọt Nguyễn Đức Chinh), Module áp dụng bộ quy tắc phân định rõ ràng:

| Tình huống kiểm tra | Thuật toán xác định | Kết luận hệ thống |
| :--- | :--- | :--- |
| **Cắt xén sát mép thực sự (Zero-Margin / Over-Cropped)**<br>*(Case Nguyễn Đức Chinh `003C8622268`)* | • Thẻ đơn ($W > H \times 1.2$).<br>• Cả 4 mép viền ($6\text{ px}$) đều sáng ($> 95$).<br>• Cả 4 góc ($10 \times 10\text{ px}$) đều sáng ($> 90$).<br>• Mất hoàn toàn 4 góc bo tròn chuẩn ID-1 ($r=3.18\text{ mm}$). |  **Cảnh báo lỗi**: *"CCCD bị crop chạm sát khung hình, mất góc bo tròn an toàn"*. |
| **Ảnh ghép 2 mặt hợp lệ (Composite Dual-Card)**<br>*(Case Hoàng Văn Long `012C0074622`)* | • Chiều cao $H \ge W \times 0.82$.<br>• Hai mép bên trái & phải có lề đệm đen/tối ($< 80$).<br>• Chữ quốc hiệu, căn cước, MRZ cách mép ảnh $> 8\text{ px}$. | ✅ **Hợp lệ 100%**: Gán nhãn `✓ Đủ 4 góc viền`. Không phạt viền canvas. |
| **Ảnh thẻ đơn chụp có lề đen padding**<br>*(Case Ngô Đức Hải `003C2333888`)* | • Cả 4 mép đều có nền đen bao quanh ($dark\_count = 4$).<br>• Thẻ nằm lọt thỏm an toàn bên trong. | ✅ **Hợp lệ 100%**: Gán nhãn `✓ Đủ 4 góc viền`. |
| **Chữ bị cắt lẹm vào biên ảnh (Proximity Alert)** | Bounding box của từ khóa (`CỘNG HÒA`, `CĂN CƯỚC`, số định danh, MRZ) có tọa độ cách mép ảnh $< 8\text{ px}$. |  **Cảnh báo lẹm chữ**: *"Chữ '[Từ]' chạm sát viền ảnh (<8px)"*. |
| **Chữ bị xén đứt đuôi (Truncated Pattern)** | OCR phát hiện các chuỗi cụt đặc trưng: `Việt N\n`, `trỏ phả\n`, `Hồ Chí Mir\n`. |  **Cảnh báo xén chữ**: *"Dòng chữ bị xén cụt ở mép"*. |
| **Thẻ căn cước cũ hết hiệu lực** | Bóc tách được chuỗi 9 chữ số (CMND) hoặc CCCD 12 số cấp trước 2021 không có chip. | ⛔ **Lỗi nghiệp vụ**: *"Căn cước cũ, ktra lại (CMND 9 số đã hết hiệu lực từ 01/01/2025)"*. |

---

### 4.5. Module Chuẩn Hóa Dữ Liệu & Điểm Tin Cậy (Reconciliation & Confidence Scoring)

#### A. Từ điển chuẩn hóa thực thể tương đương (Semantic Equivalence Dictionary)
* **Nơi cấp**:
  `["BỘ CÔNG AN", "BO CONG AN", "CỤC CẢNH SÁT QLHC VỀ TTXH", "CUC CANH SAT...", "C06"]` $\longrightarrow$ Chuẩn hóa về mã chung: `bca_c06` $\rightarrow$ **Hiển thị tích xanh `✓ Khớp`**.
* **Giới tính**:
  `["Nam", "nam", "Male", "M", "0", "2", "4", "6", "8"]` $\longrightarrow$ `Nam`.
  `["Nữ", "nu", "Female", "F", "1", "3", "5", "7", "9"]` $\longrightarrow$ `Nữ`.
* **Họ và tên**:
  Khử dấu tiếng Việt, loại bỏ khoảng trắng kép, chuyển chữ hoa, chấp nhận đảo họ/tên do chuẩn nhập quốc tế.

#### B. Công thức tính Điểm Tin Cậy Tổng Thể (Confidence Scoring)
Mỗi hồ sơ sau bóc tách được gắn một trọng số tin cậy từ $0 \sim 100\%$:
$$\text{Score} = (W_{cccd} \times 0.35) + (W_{ten} \times 0.25) + (W_{dob} \times 0.20) + (W_{issue} \times 0.10) + (W_{place} \times 0.10)$$

* **$\text{Score} \ge 95\%$**: Hồ sơ tự động xếp vào nhóm **"Khớp 100% (Green)"**, Cán bộ có thể phê duyệt nhanh chỉ bằng 1 phím tắt.
* **$80\% \le \text{Score} < 95\%$**: Nhóm **"Cần kiểm tra lại (Yellow)"**, hệ thống tự động highlight đúng ô trường dữ liệu có nghi vấn.
* **$\text{Score} < 80\%$** hoặc sai lệch Số CCCD/Họ tên: Nhóm **"Lệch (Red)"**, bắt buộc Cán bộ từ chối hoặc yêu cầu TVKD bổ sung.

---

## 5. ĐẶC TẢ HỢP ĐỒNG DỮ LIỆU (DATA CONTRACTS & JSON SCHEMAS)

### 5.1. Cấu trúc Output chuẩn từ Python Extractor Worker
```json
{
  "accountCode": "012C0074622",
  "status": "SUCCESS",
  "executionTimeMs": 142,
  "hopDong": {
    "soHopDong": "012/2026/HDGD-0074622",
    "maTKGD": "012C0074622",
    "hoTen": "HOÀNG VĂN LONG",
    "soCCCD": "014201005533",
    "ngaySinh": "15/05/2001",
    "gioiTinh": "Nam",
    "ngayCap": "25/11/2024",
    "noiCap": "BỘ CÔNG AN",
    "chuKy": "Đã ký",
    "dinhDangLoi": []
  },
  "phuLuc": {
    "loai": "PL01_ACM",
    "maTKGD_ACM": "012C0074622-A",
    "chuKy": "Đã ký"
  },
  "canCuoc": {
    "soCCCD": "014201005533",
    "hoTen": "HOÀNG VĂN LONG",
    "ngaySinh": "15/05/2001",
    "gioiTinh": "Nam",
    "ngayCap": "25/11/2024",
    "noiCap": "BỘ CÔNG AN",
    "theGeneration": "CAN_CUOC_2024",
    "source": "MRZ_AND_OCR",
    "isCompositeCard": true,
    "canhBaoChatLuong": [],
    "confidenceScore": 0.98,
    "boundingBoxes": {
      "soCCCD": [140, 210, 320, 45],
      "hoTen": [140, 265, 410, 40],
      "ngaySinh": [280, 310, 160, 35]
    }
  }
}
```

---

## 6. KẾ HOẠCH BẢO TRÌ, GIÁM SÁT & TỐI ƯU TÀI NGUYÊN (NFRs)

1. **Quản lý tiến trình Worker (Zero-Leak Subprocess Management)**:
   * Python Worker chạy dưới dạng worker tiến trình con (Child Process) được quản lý qua bộ đệm `tkgd-python-bridge.helper.ts`.
   * Thiết lập `timeout = 15000ms` (15 giây) cho mỗi tài khoản để ngăn chặn triệt để tình trạng treo process do file PDF bị lỗi mã hóa cấu trúc.
2. **Bộ nhớ đệm thông minh (Cache Invalidation)**:
   * Sau khi đối soát thành công, các file ảnh tạm tạo ra trong quá trình nắn phối cảnh được tự động dọn dẹp khỏi thư mục `/tmp` hoặc `scratch/`, giải phóng 100% dung lượng đĩa cứng.
3. **Audit Log Đầy Đủ (Auditability)**:
   * Mọi quyết định thay đổi trạng thái hoặc bỏ qua cảnh báo của Cán bộ đều được ghi nhận vào schema `ManualReviewSubDoc` kèm:
     `{ approvedBy: string, approvedAt: Date, reason: string, originalStatus: string }`.

---

## 7. KẾT LUẬN & ĐỀ XUẤT THỰC HIỆN

Tài liệu thiết kế trên cung cấp giải pháp **toàn diện, khép kín và có tính khả thi 100%** trên chính môi trường hiện tại của MXV. Việc áp dụng kiến trúc thác nước kết hợp tiền xử lý hình học thích ứng, các công thức toán học chuẩn quốc tế (ICAO 9303, ISO/IEC 7810, Pech-Pacheco LAPV, Telea Inpainting) không chỉ giúp giải quyết dứt điểm các ca khó mà còn tạo ra nền tảng vững chắc để tự động hóa toàn bộ quy trình hậu kiểm ca trực trong tương lai.
