# Nhật ký Cuộc đối thoại - Quét Email (EMAIL_PARSE) & Rename File

**Thời gian:** Thứ Hai, ngày 03/08/2026

---

### 💬 Người dùng (10:13)
bạn có thể giúp tôi đọc lại logic 
 Quét Email (EMAIL_PARSE) với Tham số Email (JSON: subject, sender, downloadDir)

---

### 🤖 Trợ lý (10:13)
Dưới đây là chi tiết logic xử lý **Quét Email (`EMAIL_PARSE`)** dựa trên cấu hình tham số JSON (bao gồm `subject`, `sender`, `downloadDir`) trong hệ thống:

Luồng xử lý chính được điều hướng từ class [BotEngineService](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts#L201-L206) thông qua phương thức [checkEmailTaskDelegated](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts#L468-L648) thuộc class [EmailWatcherService](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts).

#### 1. Phân tích Tham số Target (JSON: `subject`, `sender`, `downloadDir`)
Phương thức [safeParseJson](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts#L708-L734) sẽ cố gắng phân tích chuỗi `target` được cấu hình từ Task:
*   Nếu `target` là một chuỗi JSON hợp lệ (hoặc viết dạng lỏng lẻo không nháy kép):
    *   `filterSubject`: Lấy từ thuộc tính `subject`.
    *   `filterSender`: Lấy từ thuộc tính `sender`.
    *   `customDownloadDir`: Lấy từ thuộc tính `downloadDir` (Thư mục tải file đính kèm riêng cho task).
*   Nếu `target` không phải dạng JSON (chỉ là text thuần), hệ thống sẽ coi toàn bộ chuỗi đó là `filterSubject`, còn `filterSender` và `customDownloadDir` sẽ để trống.

#### 2. Xác thực và Lấy Access Token (Delegated Flow)
Hệ thống sử dụng cơ chế **Microsoft Graph API Delegated Permission** thay vì Application Permission:
1.  Hệ thống đọc các cài đặt kết nối Microsoft 365 từ Database/Env (`m365_client_id`, `m365_client_secret`, `m365_tenant_id`, `m365_watcher_email`).
2.  Nếu thiếu thông tin cấu hình hoặc biến `SIMULATE_BOT_CHECKS === 'true'`, hệ thống chuyển sang chế độ **Mô Phỏng (Simulation)** qua hàm [checkMockEmail](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts#L247-L343).
3.  Ở chế độ chạy thật: Phương thức [getAccessTokenDelegated](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts#L654-L703) sử dụng **Refresh Token** (`m365_refresh_token`) để yêu cầu Microsoft cấp Access Token mới.
4.  **Tự động quay vòng (Auto-rotate) Token**: Khi Microsoft trả về một `refresh_token` mới trong phản hồi, hệ thống sẽ tự động cập nhật lại giá trị này vào Database để dùng cho các lần chạy tiếp theo.

#### 3. Quét và Lọc Thư trong Inbox
1.  Hệ thống gửi yêu cầu lấy danh sách thư nhận được trong **12 giờ qua** (`receivedDateTime ge {12_hours_ago}`) qua API:
    ```http
    GET https://graph.microsoft.com/v1.0/users/{watcherEmail}/messages
    ```
2.  Giới hạn lấy tối đa **30 thư** gần nhất, bao gồm các trường: `subject`, `sender`, `bodyPreview`, `body`.
3.  Duyệt qua từng email và kiểm tra điều kiện lọc:
    *   **Tiêu đề (`subject`)**: So khớp không phân biệt chữ hoa thường (Case-insensitive substring match).
    *   **Người gửi (`sender`)**: So khớp chính xác địa chỉ email của người gửi (Case-insensitive exact match).

#### 4. Kiểm tra Điều kiện Thành công (`condition`)
Khi một email khớp với `subject` và `sender`, hệ thống tiếp tục kiểm tra nội dung thư (`body`) với tham số điều kiện (`condition`):
*   `body_contains:{keyword}`: Nội dung thư phải chứa `{keyword}`.
*   `body_regex:{pattern}`: Nội dung thư phải khớp với biểu thức chính quy `{pattern}`.
*   `body_line_match:{string}`: Nội dung thư phải có ít nhất một dòng chứa `{string}`.
*   *Mặc định (hoặc không tiền tố)*: Tìm kiếm chuỗi con chứa giá trị của `condition`.

#### 5. Tải File Đính kèm (Attachments)
Nếu email thỏa mãn tất cả điều kiện trên:
1.  **Xác định thư mục lưu trữ**: Lấy `customDownloadDir` từ cấu hình JSON của Task, nếu không cấu hình thì dùng thư mục mặc định từ cấu hình hệ thống (`m365_download_directory`).
2.  **Định dạng ngày tháng**: Định dạng đường dẫn thư mục lưu trữ bằng cách thay thế các mẫu placeholder `${YYYY}`, `${MM}`, `${DD}` thành ngày/tháng/năm hiện tại theo giờ Việt Nam (GMT+7).
3.  **Tải file**: Tải toàn bộ file đính kèm dạng File Attachment (`#microsoft.graph.fileAttachment`) qua Graph API và ghi trực tiếp vào thư mục chỉ định dưới dạng Buffer Base64.

---

### 💬 Người dùng (10:56)
tôi vừa trao đổi với QLRR thì phần này trường downloadDir họ sẽ dùng nhiều và khi tải file về đúng thư mục họ sẽ đổi tên file đồng thời phải nhé đúng thư mục với định dạng ngày tháng năm thì logic của tôi chưa xử lý phần này đúng không. tại vì đây là tính năng linh hoạt mở rộng sau này

---

### 🤖 Trợ lý (10:56)
Dạ đúng rồi ạ, logic hiện tại của anh **mới chỉ xử lý được một nửa yêu cầu** đó, cụ thể như sau:

#### 1. Phần ĐÃ XỬ LÝ: Định dạng ngày tháng năm của thư mục (`downloadDir`)
Hệ thống **đã tự động xử lý** việc đưa file vào đúng thư mục theo ngày tháng năm. 
Trong hàm [formatDownloadDir](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts#L229-L242), hệ thống sẽ tìm các placeholder trong đường dẫn thư mục và thay thế bằng ngày tháng năm hiện tại (theo giờ Việt Nam GMT+7):
*   `${YYYY}` hoặc `${yyyy}` $\rightarrow$ Năm (ví dụ: `2026`)
*   `${MM}` hoặc `${mm}` $\rightarrow$ Tháng (ví dụ: `08`)
*   `${DD}` hoặc `${dd}` $\rightarrow$ Ngày (ví dụ: `03`)

#### 2. Phần CHƯA XỬ LÝ: Đổi tên file khi tải về
Hiện tại, trong hàm [downloadAttachments](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/email-watcher.service.ts#L187-L224), hệ thống đang lưu file với **tên gốc** của file đính kèm gửi trong email (`attachment.name`):
```typescript
const filePath = path.join(downloadDir, attachment.name);
```
Chưa có logic hỗ trợ đổi tên file (ví dụ: đổi thành `Straits.csv` hoặc định dạng `Straits_03082026.csv`).

#### 3. Đề xuất giải pháp mở rộng (Nếu anh muốn bổ sung luôn bây giờ hoặc sau này)
Chúng ta có thể thêm một thuộc tính là `fileNamePattern` vào tham số JSON ở `target`. Ví dụ:
```json
{
  "subject": "Straits Report",
  "sender": "backoffice@straitsfinancial.com",
  "downloadDir": "C:/Reports/${yyyy}/${mm}/${dd}",
  "fileNamePattern": "Straits_${dd}${mm}${yyyy}.csv"
}
```

Khi đó trong code xử lý tải file, ta chỉ cần format lại trường `fileNamePattern` (nếu có cấu hình) theo ngày tháng năm tương tự như cách làm với `downloadDir`, sau đó lưu file với tên mới đó.

---

### 💬 Người dùng (15:18)
tôi thấy là theo kiểu giữ nguyên tên file tải về rồi rename phần đuôi ngày hay sao ấy

---

### 🤖 Trợ lý (15:18)
Dạ đúng vậy ạ. Trong nghiệp vụ đối chiếu (Reconciliation), các phòng ban như Quét Lỗi Rủi Ro (QLRR) thường yêu cầu file đầu vào có một định dạng tên cố định hoặc chuẩn hóa theo ngày (ví dụ: `Straits_03082026.csv` hoặc đổi hẳn về `Straits.csv`) để các công cụ đối chiếu tự động ở bước sau (như tool C# hay dịch vụ NestJS) có thể nhận diện chính xác mà không bị lệch tên file chứa timestamp ngẫu nhiên khi tải từ email về.

Để giải quyết bài toán này một cách linh hoạt nhất (đúng tinh thần "tính năng linh hoạt mở rộng sau này"), em đề xuất chúng ta có thể bổ sung thêm tham số **`renamePattern`** vào JSON cấu hình ở `target`.

#### Cách hoạt động đề xuất:
Nếu cấu hình JSON trong Task dạng:
```json
{
  "subject": "Straits.csv",
  "sender": "straits@example.com",
  "downloadDir": "C:/Reports/${yyyy}/${mm}/${dd}",
  "renamePattern": "Straits_${dd}${mm}${yyyy}.csv"
}
```
Hoặc nếu muốn giữ tên gốc và chỉ chèn thêm ngày tháng:
```json
{
  "subject": "Straits.csv",
  "sender": "straits@example.com",
  "downloadDir": "C:/Reports/${yyyy}/${mm}/${dd}",
  "renamePattern": "${originalName}_${dd}${mm}${yyyy}.${ext}"
}
```

Hệ thống sẽ hỗ trợ các biến động sau cho `renamePattern`:
*   `${originalName}`: Tên gốc của file đính kèm (không kèm đuôi mở rộng).
*   `${ext}`: Phần mở rộng (đuôi file, ví dụ `csv`, `xlsx`).
*   `${yyyy}`, `${mm}`, `${dd}`: Ngày tháng năm hiện tại (GMT+7).

---

### 💬 Người dùng (15:19)
để tôi xin rule cụ thể rồi bạn đề xuất nhé

---

### 🤖 Trợ lý (15:19)
Dạ vâng anh, khi nào anh có thông tin hoặc quy tắc đặt tên file cụ thể từ phòng QLRR, anh cứ gửi cho em nhé. 

Em sẽ dựa vào đó để đề xuất giải pháp chuẩn xác nhất và cập nhật hệ thống cho anh ngay lập tức!

---

### 💬 Người dùng (17:36)
tạm thời bạn tại file log toàn bộ cuộc đối thoại của tôi và bạn vào mai tôi trao đổi tiếp chứ hiện tại tôi bận quá chưa đưa rule cho bạn được
