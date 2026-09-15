# AGENTS.md - Rule & Change Audit Guidelines for AI Assistant

## 1. Strict Change Audit Rule (Quy tắc Ghi vết Thay đổi & Kiểm soát AI)

Mỗi khi AI Assistant thực hiện bất kỳ thay đổi, chỉnh sửa code (Frontend, Backend), cấu hình Bot, hoặc sửa logic nghiệp vụ, AI MUST tuân thủ các nguyên tắc nghiêm ngặt sau:

1. **Không tự ý suy diễn hoặc mở rộng logic ngoài chỉ đạo**:
   - AI chỉ thực hiện đúng theo yêu cầu rõ ràng của USER.
   - Tuyệt đối không tự ý thêm/bớt các fallback, pattern tìm kiếm rác hoặc logic phát triển theo giả định cá nhân.

2. **Ghi vết Thay đổi (Change Log Audit)**:
   - Khi hoàn thành bất kỳ lượt chỉnh sửa nào, AI MUST ghi vết chi tiết vào file [CHANGELOG_AI.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/CHANGELOG_AI.md) và báo cáo lại chi tiết bao gồm:
     - **Mục tiêu thay đổi**: Lý do và yêu cầu cụ thể từ USER.
     - **Danh sách file chỉnh sửa**: Đưa link trực tiếp tới các file bị tác động.
     - **Tóm tắt nội dung code đã sửa**: Nêu rõ trước và sau khi sửa.
     - **Xác nhận Build/Kiểm thử**: Đảm bảo cả Frontend và Backend đều chạy build thành công (`npx tsc --noEmit` & `npm run build`).

3. **Tuyệt đối không tự ý can thiệp vào Database của hệ thống**:
   - AI tuyệt đối không được viết và chạy các script tự phát để xóa (delete), sửa đổi (update) hoặc reset các bảng ghi dữ liệu thực tế đang chạy (như Checklist templates, ShiftLogs, Users...) nếu không có chỉ đạo bằng văn bản rõ ràng từ USER. Phải bảo vệ tính toàn vẹn của dữ liệu ca trực đang kiểm thử/vận hành của USER.

4. **Quy tắc Kiểm thử & Chạy File Test Script (USER Tự Chạy Test)**:
   - Đối với các file test script (như `test_tkgd_module...`, script RPA cào dữ liệu, Playwright, bot crawler hoặc test tool độc lập...), AI chuẩn bị code hoàn chỉnh, kiểm tra tính đúng đắn và viết hướng dẫn chi tiết lệnh chạy (kèm các cờ tham số như chạy có giao diện `--headed` hoặc không giao diện).
   - **AI tuyệt đối không tự ý kích hoạt chạy ngầm các file test script**; **PHẢI ĐỂ USER TỰ CHẠY** trực tiếp trên terminal của mình để USER chủ động quan sát log, giao diện trình duyệt và kiểm thử thực tế.

---


## 2. Standard Business Rules for MXV Shift Checklist

1. **Đối chiếu ACM (Nano)**:
   - Duy nhất nhận diện file chuẩn **Straits CSV** (chứa từ khóa `Straits`, ví dụ `Straits.csv`, `Straits_23072026.csv`).
   - Tuyệt đối không tự ý thay bằng file `Fill.xlsx` hay `Order.xlsx`.

2. **CQG Raw Files Auto-Merging**:
   - Tự động ghép nối các cặp file thô từ 2 tài khoản CQG khi chưa có file gộp:
     - `FR1` + `FR2` $\rightarrow$ `FR.xlsx` (Giao dịch khớp lệnh)
     - `PS1` + `PS2` $\rightarrow$ `PS.xlsx` (Vị thế ròng & Tất toán)
     - `OP1` + `OP2` $\rightarrow$ `OP.xlsx` (Trạng thái mở)
     - `OD1` + `OD2` $\rightarrow$ `Od.xlsx` (Sổ lệnh)

3. **Phân định Tác vụ Đối chiếu trong phiên vs Pre-EOD**:
   - **Task `[TASK_CHECK_KLGD]`** (*Giám sát & Đối chiếu MS vs CQG trong phiên*): Dùng `botCheckType: 'CHECK_KLGD'` và hàm `runAutoCheckKLGD` (định kỳ 1 giờ/lần).
   - **Task Pre-EOD** (*Chốt đối chiếu 3 bên cuối ngày*): Dùng `botCheckType: 'CHECK_PRE_EOD'` và hàm `runAutoCheckPreEOD`.

---

## 3. Reference Mapping: C# IT Tool vs NestJS/Next.js System

| Chức năng Nghiệp vụ | C# Source File & Method | NestJS / Next.js Service & Method |
| :--- | :--- | :--- |
| **Đối chiếu KLGD Trong Phiên** | `TransactionCheckingService.cs` $\rightarrow$ `CheckKLGD()` | `reconciliation.service.ts` $\rightarrow$ `checkKLGD()` & `runAutoCheckKLGD()` |
| **Đối chiếu Pre-EOD (T-1)** | `TransactionCheckingService.cs` $\rightarrow$ `CheckKLGD()` / `CheckEOD()` | `reconciliation.service.ts` $\rightarrow$ `checkPreEOD()` & `runAutoCheckPreEOD()` |
| **Đọc File Straits CSV (ACM)** | `FileUtils.cs` $\rightarrow$ `GetTradingNanoData()` | `reconciliation.service.ts` $\rightarrow$ `parseStraitsCsv()` |
| **Tự động ghép file thô CQG** | `TransactionCheckingService.cs` / `FileUtils.cs` | `reconciliation.service.ts` $\rightarrow$ `mergeCqgRawFiles()` & `cqg-sync.service.ts` |
| **Quét Ký quỹ Âm (Negative Margin)**| `margin-checker` $\rightarrow$ `MarginChecking.cs` | `post-eod-handler.service.ts` $\rightarrow$ `scanNegativeMarginAccounts()` |
| **Tải báo cáo RPA M-System/CQG** | `operate-transaction-app` $\rightarrow$ `ChromeBot.cs` | `rpa-downloader.service.ts` $\rightarrow$ `loginMSystem()`, `downloadTTM()`, `downloadDSGD()` |
| **Thống kê Báo cáo CCP (Macro)** | `CCP-Statistics-Tool` $\rightarrow$ `ExcelDataService.cs` | `bot-job-queue.service.ts` $\rightarrow$ `handleRunLotMacroJob()`, `handleRunValueMacroJob()` |

---

## 4. Critical Technical Guidelines & Code Patterns (Quy tắc Kỹ thuật Quan trọng)

Để tránh tái diễn các lỗi nghiêm trọng về logic chạy bot và hiển thị UI, AI Assistant phải tuân thủ tuyệt đối các quy tắc sau khi sửa đổi code:

1. **Chuyển đổi Mongoose Map sang Object (`.toObject()`)**:
   - Khi truy xuất trường `payload` hoặc các nested map từ Mongoose Model, **bắt buộc** dùng `job.toObject().payload` thay vì `Object.fromEntries(job.payload)`.
   - `Object.fromEntries` chỉ chuyển đổi được cấp ngoài cùng, làm các trường lồng nhau (như `payload.result`) vẫn giữ cấu trúc Map của Mongoose dẫn tới việc truy xuất `payload.result.isWaitingFiles` bị trả về `undefined`.

2. **Quy tắc React Hooks (Rules of Hooks)**:
   - Các React hooks (`useState`, `useMemo`, `useEffect`...) phải luôn được khai báo ở trên cùng (top-level) của component, trước mọi câu lệnh return sớm (early returns). Không bao giờ đặt hook bên trong hoặc bên dưới các điều kiện `if (!isOpen) return null;`.

3. **Cơ chế Cooldown tránh lặp Job**:
   - Khi bot quét các tác vụ chưa có file hoặc gặp sự cố, phải dùng phương thức helper `shouldEnqueueNewJob(task, existingJob)` trong [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/modules/bot-engine/bot-engine.service.ts) để áp dụng khoảng nghỉ (cooldown 15 phút hoặc theo tần suất) nhằm ngăn việc tạo hàng loạt Job chạy trùng lặp mỗi phút.

4. **Chuẩn hóa Tiền tố API ở Frontend (`/api/v1`)**:
   - Tất cả các lệnh gọi fetch dữ liệu từ Frontend lên Backend đều phải prepend tiền tố `/api/v1` (ví dụ: `${API_BASE_URL}/api/v1/reconciliation/...`). Không gọi trực tiếp qua URL không có versioning.

5. **Tuyệt đối Không Dùng Unicode Emojis trên Giao diện UI (`📁`, `💡`, `⚡`, ``, `🔘`, `👁️`...)**:
   - Trên toàn bộ giao diện Frontend (Modal, Button, Card, Tag, Preview...), **tuyệt đối KHÔNG** chèn các ký tự icon emoji thô dạng Unicode (như `📁`, `💡`, `⚡`, ``, `🔘`, `👁️`, `🟢`, `🔵`...).
   - **Bắt buộc 100%** sử dụng các icon SVG chuẩn từ thư viện **`lucide-react`** (ví dụ: `import { Folder, Sparkles, Info, Calendar } from 'lucide-react'`) hoặc văn bản rõ nghĩa. Việc dùng emoji thô làm mất tính chuyên nghiệp (Enterprise Look & Feel) và gây vỡ layout/lỗi hiển thị màu sắc trên các nền tảng khác nhau.

---

## 5. Dynamic Mock & Environment Rules (Quy tắc Giả lập & Động hóa Môi trường)

1. **Tuyệt đối không hardcode dữ liệu / ngày tháng mẫu cố định**:
   - Khi tạo script mock, server giả lập hoặc helper test (như SFTP Mock Server, Mock Services), **tuyệt đối không hardcode ngày tháng mẫu cố định** (như `08.07` hay các ngày cũ) vào code.
   - Tất cả dữ liệu giả lập phải **động 100% (Dynamic & On-The-Fly)**: Tự động lấy theo `new Date()` hiện tại hoặc tự động nhận diện chuỗi ngày/pattern từ request của Client để sinh dữ liệu tương ứng.

2. **Đóng gói Độc lập (Self-Contained & Zero External Dependencies)**:
   - Các thư mục/tool giả lập (như `mock-sftp/`) phải nằm trong một thư mục riêng biệt độc lập, chứa đầy đủ code và dữ liệu mẫu cần thiết. Tuyệt đối không được tham chiếu tương đối ra các thư mục ngoài (như `../../../08.07 ACM`).
   - Phải đảm bảo khi copy duy nhất thư mục đó sang môi trường khác (như Server Ubuntu sản xuất/test), nó chạy được ngay 100% và khi xóa chỉ cần `rm -rf` thư mục đó là không để lại bất kỳ dữ liệu rác nào.

3. **Phân tích kỹ lưỡng kiến trúc & tài liệu trước khi trả lời**:
   - AI phải luôn kiểm tra đối chiếu kiến trúc thực tế (như `HUONG_DAN_DEPLOY_NATIVE.md`, `bot_credentials_acm`, NestJS Backend PM2) trước khi đưa ra hướng dẫn, tránh nhầm lẫn giữa vai trò SFTP Server và Client.

---

## 6. TKGD Reconciliation & OCR Best Practices (Quy tắc Đối Soát Hồ Sơ Mở TKGD & Bóc Tách Ảnh)

Để tránh tái diễn các lỗi lệch giả (False Positive) khi bóc tách hồ sơ và quét lại (reparse) trên module TKGD:

1. **Phân cấp File Đính Kèm Khách Hàng vs Bằng Chứng M-System (`_MS_`)**:
   - Thư mục hồ sơ (`HoSo_DinhKem/<Ngày>/<Mã TKGD>/`) chứa 2 nguồn ảnh:
     - **File gốc đính kèm email của khách hàng** (ví dụ: `HOANG-THANH-TUNG-CCCD-truoc.jpg`, `LE-TRONG-HUY-CCCD-...` độ phân giải cao ~1000px).
     - **File thumbnail bằng chứng do Bot RPA cào về từ web M-System** (ví dụ: `003C2886699_MS_CCCD_truoc.jpg` kích thước siêu nhỏ chỉ **270x172px**).
   - **Quy tắc tuyệt đối**: Hàm quét file (`scanDirForFiles`, `scanSingleAccountFiles`) **phải lọc bỏ các file có tiền tố `_MS_`, `chuky`, `signature`, `sign`**. Luôn ưu tiên 100% file ảnh gốc của khách hàng (`customerFiles`). Chỉ fallback sang ảnh thumbnail M-System khi khách hàng hoàn toàn không gửi kèm file ảnh. Việc OCR trên ảnh thumbnail 270px sẽ gây mờ nhòe chữ số, đọc nhầm số CCCD (ví dụ `5` thành `6`) và hạ thấp độ tin cậy AI xuống < 50%.

2. **Quy tắc Bóc Tách MRZ 2 Dòng (Dòng 2 kiểm tra Dòng 1)**:
   - Thẻ CCCD gắn chip (2021–nay) có mã MRZ gồm 2 dòng ở mặt sau:
     - Dòng 1: `IDVNM<12 chữ số CCCD><mã bổ sung>...`
     - Dòng 2: Ngày sinh dạng `YYMMDD` + Giới tính `M/F` + Ngày hết hạn.
   - **Quy tắc**: Trong [tkgd_extractor_worker.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/src/scripts/python/tkgd_extractor_worker.py), **luôn xử lý Dòng 2 trước Dòng 1**. Khi tìm số CCCD ứng viên từ Dòng 1 bằng Regex, **bắt buộc kiểm tra 2 chữ số năm sinh (`cccd[4:6]`) phải trùng khớp với `YY` của Dòng 2**. Không sử dụng regex tham lam `0\d{11}` độc lập để tránh hiện tượng cắt nhầm chuỗi số ma (Phantom CCCD, ví dụ: `087035120803` gây suy luận sai năm sinh về 1935 và giới tính Nữ).

3. **Bảo Chứng Chéo Hash Ảnh (`verifyAndHealWithImageHash`) & Thứ Tự Ưu Tiên Trường**:
   - Khi mã MD5 của ảnh đính kèm mail trùng khớp 100% với ảnh upload trên M-System, danh tính đã được kiểm chứng chuẩn xác qua M-System.
   - **Thứ tự ưu tiên trường thông tin khi heal**: Luôn ưu tiên trường dữ liệu đã được M-System xác thực (`record.ms?.ngaySinh || record.canCuoc?.ngaySinh || record.hopDong?.ngaySinh`), tuyệt đối không để trường dữ liệu OCR lỗi đè lên trường của M-System.
   - Kích hoạt `verifyAndHealWithImageHash` cho cả tài khoản cơ sở và tiểu khoản (`-A`, `-L`, `-S` / PL01) trước khi gọi hàm thẩm định đối soát `evaluateRecordReconciliation`.

---

## 7. Zero Hardcoded Task IDs & Dynamic Bot Resolver Rule (Quy tắc Tuyệt đối Không Hardcode Task ID)

Để đảm bảo hệ thống hoàn toàn linh hoạt khi người dùng tạo/sửa Template ca trực trên giao diện Web mà không cần can thiệp vào code:

1. **Tuyệt đối KHÔNG hardcode Task ID, Alias hay Pattern ID vào mã nguồn**:
   - Nghiêm cấm đưa các chuỗi Task ID cụ thể (như `TASK_CHECK_KLGD`, `TASK_CHECK_KLGD_s1`, `TASK_CHECK_EOD_sb2`, `ops_open_04_s4`, `TASK_CCP_STATISTICS_s1`...) vào constants, mảng alias (`aliasTaskIds`), pattern (`parentTaskIdPattern`, `subTaskIdPattern`) hoặc các câu lệnh `if/else` để định tuyến nghiệp vụ.
   - Khi Admin tạo mới Template ca trực trong CSDL, Task ID có thể là bất kỳ chuỗi nào (UUID, `task_dem_01`, `task_1725...`). Code tuyệt đối không được phép phụ thuộc vào Task ID cụ thể.

2. **Nhận diện Tác vụ Bot duy nhất qua `botCheckType` (Data-Driven 100%)**:
   - Bot chỉ nhận diện tác vụ mục tiêu thông qua trường dữ liệu được cấu hình trên Template: `isBotCheck === true` (hoặc `isBotCheckSnapshot === true`) và `botCheckType === '<LOẠI_BOT>'`.
   - Danh mục Bot (`BOT_TASK_REGISTRY`) chỉ được phép chứa thông tin năng lực (Capabilities/Enum) như: `botCheckType`, `jobType`, `displayName`, `description` và handler thực thi.

3. **Cây Gia Phả Tác Vụ (Cha - Con - Anh em) Được Giải Quyết Động Qua CSDL**:
   - Mối quan hệ giữa Task Cha và Task Con phải được giải quyết 100% động dựa trên trường `parentTaskIdSnapshot` trong mảng `details` của ca trực (`shift_log`):
     - Đứng ở Task Cha $\rightarrow$ Tự động tìm tất cả Task Con có `parentTaskIdSnapshot === parentTask.taskId`.
     - Đứng ở Task Con $\rightarrow$ Tự động tìm Task Cha có `taskId === subTask.parentTaskIdSnapshot` và các Task anh em cùng cha.
   - Khi truy vấn `bot_jobs` trong MongoDB, danh sách `relatedTaskIds` phải được tính toán động từ cấu trúc cây này, nghiêm cấm dùng alias tĩnh trong code.

---

## 8. Universal Zero-Hardcoding & Data-Driven Architecture Standard (Quy Chuẩn Chung Về Thiết Kế Động & Chống Hardcode)

Quy chuẩn này là kim chỉ nam **bắt buộc áp dụng cho toàn bộ các module phần mềm** (Checklist, Bot Engine, Reconciliation, TKGD, Trading Manager, Admin Config...) trong dự án hiện tại và tất cả các dự án phát triển về sau:

### 1. Nhận Diện 4 Dạng Hardcode Nguy Hiểm Cần Tuyệt Đối Tránh

1. **Entity ID Hardcoding (Gán cứng mã thực thể)**:
   - *Biểu hiện*: Đưa các chuỗi ID cụ thể (`taskId: 'TASK_CHECK_KLGD'`, `roleId: 'ADMIN_01'`, `deptId: 'DEPT_IT'`, `userId: 'user_123'`) vào logic `if/else`, switch-case, constants hoặc mảng tĩnh.
   - *Tác hại*: Khi người dùng tạo Template mới, ca mới, phòng ban mới hoặc CSDL dùng UUID tự sinh, code lập tức bị gãy và phát sinh bug ngầm.
2. **Business Threshold Hardcoding (Gán cứng hằng số/ngưỡng nghiệp vụ)**:
   - *Biểu hiện*: Gán cứng các giá trị tần suất chạy (`frequency = 60`), hạn mức cảnh báo (`threshold = 0.85`), số ngày hết hạn (`expireDays = 30`), tỷ lệ phí vào sâu trong hàm xử lý.
   - *Tác hại*: Mỗi lần thay đổi quy định nghiệp vụ phải mở code sửa, chạy lại kiểm thử, build bundle và deploy lại toàn bộ hệ thống.
3. **Infrastructure & Path Hardcoding (Gán cứng hạ tầng & đường dẫn)**:
   - *Biểu hiện*: Gán cứng IP server (`10.0.0.26`), cổng (`3001`), đường dẫn ổ đĩa tuyệt đối (`C:\Trading\Backup\...`), URL dịch vụ bên ngoài vào code.
   - *Tác hại*: Triệt tiêu khả năng portability; không thể chuyển đổi môi trường DEV/STAGING/PROD và gây sập hệ thống khi chuyển từ Windows sang Linux.
4. **Pseudo-Constants / Alias Hiding (Hardcode trá hình dạng danh mục)**:
   - *Biểu hiện*: Gom hàng loạt ID cụ thể vào một object dictionary (`aliasTaskIds`, `patternTaskIds`) rồi ngụy biện là "đã cấu hình tập trung". Bản chất đây vẫn là hardcode, chỉ dọn rác từ file này sang file khác.

---

### 2. 5 Nguyên Tắc Vàng Của Kiến Trúc Động (Data-Driven Architecture)

1. **Nguyên Tắc 1: Quản Lý Năng Lực (Capabilities) Thay Vì Quản Lý Thực Thể (Entities)**:
   - Code chỉ quản lý ENUM danh mục năng lực/loại nghiệp vụ mà hệ thống có thể thực thi (ví dụ: `BOT_TYPES`, `EXPORT_FORMATS`, `NOTIFICATION_CHANNELS`).
   - Các bản ghi thực tế trong CSDL (Task, Template, User, Role) được gán liên kết tới Năng lực này bằng một trường định danh chuẩn (như `botCheckType`, `channelType`). Code chỉ tương tác với loại Năng lực, không bao giờ tương tác với ID của bản ghi.
2. **Nguyên Tắc 2: Quan Hệ Cây/Đồ Thị Dữ Liệu Thay Vì Logic Rẽ Nhánh Trong Code**:
   - Mọi quan hệ giữa các thực thể (Cha - Con, Phụ thuộc `dependsOn`, Nhóm phân quyền, Thứ tự hiển thị `sortOrder`) bắt buộc phải được giải quyết qua cây quan hệ trong CSDL (`parentTaskId`, `dependsOnTaskId`, `groupId`).
   - Tuyệt đối không suy diễn quan hệ bằng quy tắc cắt/nối chuỗi string (ví dụ: cấm suy luận `subTask = parentId + '_s1'`).
3. **Nguyên Tắc 3: Configuration-First & Runtime Adjustability (Cấu hình Động)**:
   - Tất cả tham số vận hành (đường dẫn sao lưu, tần suất quét, tài khoản bot, URL kết nối, cờ bật/tắt tính năng) phải nằm trong bảng CSDL Cấu hình (`system_configs`, `bot_credentials`) hoặc biến môi trường (`.env`), có màn hình UI trực quan để Quản trị viên thay đổi trực tiếp lúc đang chạy (runtime) mà không cần can thiệp code.
4. **Nguyên Tắc 4: Fail Fast & Graceful Dynamic Fallback (Không bao giờ Fallback về ID cụ thể)**:
   - Khi không tìm thấy cấu hình hoặc quan hệ trong CSDL, hệ thống phải xử lý bằng cách: Báo lỗi có ý nghĩa (Meaningful Error), ghi log cảnh báo hoặc dùng giá trị mặc định theo loại hình (Default by Type).
   - **Nghiêm cấm tuyệt đối** việc âm thầm fallback về một ID bản ghi cụ thể hoặc giả định một ID mặc định.
5. **Nguyên Tắc 5: The "New Template / New Tenant" Acid Test (Bài Test Tự Kiểm Tra Bắt Buộc)**:
   - Trước khi hoàn thành bất kỳ task chỉnh sửa nào, Lập trình viên / AI Assistant **bắt buộc phải tự trả lời 2 câu hỏi**:
     - *Câu hỏi 1*: "Nếu Admin vào giao diện Web tạo một Template mới hoàn toàn với các ID sinh ngẫu nhiên (UUID), module này có tự động nhận diện và hoạt động trơn tru 100% không?"
     - *Câu hỏi 2*: "Nếu người dùng đổi tên, đổi mã task, hoặc phân cấp lại cây cha - con trong Database, hệ thống có tự thích ứng mà không bị gãy không?"
   - Nếu câu trả lời cho bất kỳ câu nào là **"KHÔNG (phải vào code thêm ID/sửa mảng)"** $\rightarrow$ Đoạn code đó **VI PHẠM NGUYÊN TẮC** và bắt buộc phải được tái cấu trúc lại ngay lập tức.





