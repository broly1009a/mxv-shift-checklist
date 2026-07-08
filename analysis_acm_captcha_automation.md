# Phân tích & Đề xuất Giải pháp Tự động hóa Backup ACM (Vượt Captcha)

Tài liệu này phân tích các phương án khả thi để tự động hóa luồng tải dữ liệu backup từ hệ thống **ACM (Asia Commodity Marketplace)**, khắc phục rào cản captcha dạng ảnh chữ/số có nhiễu (`text captcha`) khi đăng nhập.

---

## 1. Phân tích Captcha của Hệ thống ACM

* **Dạng Captcha**: Ảnh chứa chuỗi ký tự chữ và số (gồm 5 ký tự), chữ viết có màu sắc khác nhau, có đường vẽ đè đứt đoạn/liên tục để chống robot quét (Text Captcha with noise lines).
* **Độ phức tạp**: Trung bình. Không đổi font quá phức tạp nhưng có nhiễu đường thẳng cắt ngang qua ký tự.
* **Tần suất yêu cầu**: Bắt buộc nhập mỗi lần đăng nhập mới. Captcha thay đổi (reload) sau mỗi lần gửi yêu cầu hoặc tải lại trang.

---

## 2. Đề xuất các Phương án Giải quyết (Vượt Captcha)

Dưới đây là 4 phương án đề xuất với đầy đủ ưu/nhược điểm, độ phức tạp và chi phí để anh cân nhắc lựa chọn:

### Phương án 1: Bán tự động (Human-in-the-Loop) qua UI Checklist
* **Luồng xử lý**:
  1. Trình duyệt Playwright chạy ngầm (headless) mở trang ACM, nhập sẵn Username và Password.
  2. Playwright chụp ảnh riêng phần tử Captcha (`ElementScreenshot`) và gửi chuỗi Base64 về cho Backend.
  3. Giao diện Web Checklist của ca trực sẽ hiển thị một Modal nhỏ chứa ảnh Captcha kèm ô nhập văn bản.
  4. Nhân viên trực ca chỉ cần gõ 5 ký tự nhìn thấy và bấm "Gửi".
  5. Backend nhận mã captcha, điền tiếp vào trình duyệt và nhấn nút Login để tải file.
* **Độ khả thi**: Rất cao.
* **Ưu điểm**:
  * **Chính xác 100%**: Không sợ nhận diện sai, không sợ hệ thống ACM nâng cấp cấu trúc captcha.
  * **An toàn & Offline**: Chạy nội bộ 100% trên server/máy local, không cần kết nối internet ra ngoài, bảo mật tuyệt đối thông tin.
  * **Chi phí 0đ**: Không mất phí duy trì dịch vụ giải captcha.
* **Nhược điểm**: Cần tương tác của con người (mất khoảng 2-3 giây của nhân sự để gõ mã).

---

### Phương án 2: Tự động hóa 100% sử dụng thư viện OCR cục bộ (ddddocr / Python)
* **Luồng xử lý**:
  1. Playwright chụp lại ảnh Captcha và lưu tạm vào thư mục.
  2. Backend NestJS gọi tiến trình con (Child Process) chạy một script Python nhỏ.
  3. Script Python sử dụng thư viện **`ddddocr`** (một thư viện Deep Learning mã nguồn mở chuyên trị các loại captcha chữ/số có nhiễu của Trung Quốc/Việt Nam với độ chính xác cực cao) để đọc ảnh và trả về kết quả dạng text.
  4. Playwright điền văn bản đó để đăng nhập. Nếu sai, hệ thống tự động reload captcha và thử lại (tối đa 3 lần).
* **Độ khả thi**: Cao.
* **Ưu điểm**:
  * **Tự động hóa 100%**: Không cần con người can thiệp.
  * **Chi phí 0đ**: Thư viện miễn phí, chạy offline hoàn toàn trên máy local.
* **Nhược điểm**:
  * Yêu cầu máy chủ chạy tool phải cài đặt môi trường **Python** và các package phụ thuộc (`ddddocr`, `pillow`).
  * Có tỷ lệ sai số nhỏ (thường độ chính xác đạt khoảng 85-95% với dạng captcha này), cần thiết lập logic thử lại nếu sai.

---

### Phương án 3: Tự động hóa 100% sử dụng dịch vụ bên thứ ba (2Captcha / Anti-Captcha)
* **Luồng xử lý**:
  1. Playwright chụp ảnh Captcha.
  2. Backend gửi ảnh Base64 lên API của bên thứ 3 (ví dụ 2captcha.com).
  3. Hệ thống của họ (kết hợp AI và người giải) trả về kết quả dạng text sau 5-10 giây.
  4. Playwright điền text để đăng nhập.
* **Độ khả thi**: Rất cao (kỹ thuật cực kỳ đơn giản).
* **Ưu điểm**:
  * Tự động hóa 100%, code NestJS rất đơn giản, không cần cài đặt Python hay thư viện OCR nặng nề trên máy chủ.
  * Độ chính xác gần như tuyệt đối.
* **Nhược điểm**:
  * **Mất phí**: Khoảng $0.5 - $1.0 cho mỗi 1000 lượt giải captcha (cần nạp tiền trước vào tài khoản).
  * **Cần Internet**: Máy chủ chạy tool bắt buộc phải có kết nối internet để gọi API ra ngoài (không chạy được offline hoàn toàn).

---

### Phương án 4: Duy trì phiên đăng nhập bằng cách Chia sẻ Cookie/Session
* **Luồng xử lý**:
  1. Đầu ngày hoặc đầu ca trực, nhân viên đăng nhập thủ công vào ACM trên một trình duyệt Chrome thông thường một lần duy nhất.
  2. Tool sẽ trích xuất (export) danh sách Cookies và Session của ACM lưu vào Database hoặc file cấu hình của Bot.
  3. Playwright khi chạy tự động tải báo cáo sẽ nạp trực tiếp bộ cookie này vào ngữ cảnh (`browserContext.addCookies()`) để bỏ qua bước đăng nhập và vào thẳng trang tải file.
* **Độ khả thi**: Trung bình (phụ thuộc vào thời gian hết hạn session của ACM).
* **Ưu điểm**:
  * Bỏ qua hoàn toàn bước đăng nhập và giải captcha khi chạy tự động.
  * Code đơn giản, không cần dịch vụ ngoài.
* **Nhược điểm**:
  * Nếu hệ thống ACM cấu hình thời gian hết hạn Session quá ngắn (ví dụ chỉ 1-2 tiếng), nhân viên sẽ phải đăng nhập thủ công lại liên tục, gây phiền toái.

---

## 3. Đánh giá & Khuyến nghị Lựa chọn

| Tiêu chí | Phương án 1 (Bán tự động) | Phương án 2 (Python OCR local) | Phương án 3 (API dịch vụ) | Phương án 4 (Cookie/Session) |
| :--- | :--- | :--- | :--- | :--- |
| **Mức độ tự động** | 70% (Nhập tay captcha) | **100% (Hoàn toàn)** | **100% (Hoàn toàn)** | 90% (Đăng nhập lần đầu) |
| **Độ chính xác** | **100%** | ~90% (Cần thử lại nếu sai) | ~99% | **100%** |
| **Yêu cầu Internet**| Không (Offline 100%) | Không (Offline 100%) | **Bắt buộc có Internet** | Không (Offline 100%) |
| **Cài đặt hệ thống**| Rất đơn giản | Phức tạp (Cần Python) | Rất đơn giản | Đơn giản |
| **Chi phí vận hành**| **0đ** | **0đ** | Trả phí theo lượt | **0đ** |

### Khuyến nghị triển khai:

1. **Nếu máy chủ chạy tool của anh không bị chặn Internet**: 
   * **Phương án 3 (API Dịch vụ)** là giải pháp nhanh, rẻ và ổn định nhất. Với tần suất backup vài lần một ngày, chi phí thực tế chỉ khoảng vài nghìn đồng mỗi tháng.
2. **Nếu máy chủ chạy tool bắt buộc chạy Offline / bảo mật cao**:
   * Nên ưu tiên **Phương án 1 (Bán tự động)** trước: Vừa dễ phát triển, vừa an toàn tuyệt đối, nhân viên trực ca chỉ cần nhìn màn hình gõ 5 ký tự khi có thông báo yêu cầu tải file.
   * Hoặc triển khai **Phương án 2 (Python OCR)** nếu muốn tự động hóa hoàn toàn và chấp nhận cài thêm môi trường Python lên máy chủ.
