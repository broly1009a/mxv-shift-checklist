# AGENTS.md - Rule & Change Audit Guidelines for AI Assistant

## 1. Strict Change Audit Rule (Quy tắc Ghi vết Thay đổi & Kiểm soát AI)

Mỗi khi AI Assistant thực hiện bất kỳ thay đổi, chỉnh sửa code (Frontend, Backend), cấu hình Bot, hoặc sửa logic nghiệp vụ, AI MUST tuân thủ các nguyên tắc nghiêm ngặt sau:

1. **Không tự ý suy diễn hoặc mở rộng logic ngoài chỉ đạo**:
   - AI chỉ thực hiện đúng theo yêu cầu rõ ràng của USER.
   - Tuyệt đối không tự ý thêm/bớt các fallback, pattern tìm kiếm rác hoặc logic phát triển theo giả định cá nhân.

2. **Quy Tắc Chứng Cứ Ràng Buộc (Proof of Ground Truth - Bắt Buộc Dừng & Hỏi)**:
   - Mọi thay đổi tham số kỹ thuật liên quan đến: **URL, XPath, CSS Selector, Tên Menu, Tên File, Tên Cột Excel, Logic Crawler/RPA** BẮT BUỘC phải thỏa mãn ít nhất 1 trong 3 điều kiện:
     1. Trích dẫn được đường dẫn file và dòng code từ một test script/code gốc đang hoạt động chuẩn trong repo; **HOẶC**
     2. Được USER chỉ đạo bằng văn bản rõ ràng; **HOẶC**
     3. Được trích xuất từ log chạy thực tế của hệ thống.
   - ⛔ **NẾU KHÔNG CÓ ĐỦ 1 TRONG 3 CHỨNG CỨ TRÊN: AI BẮT BUỘC PHẢI DỪNG LẠI VÀ ĐẶT CÂU HỎI CHO USER (STOP & ASK), TUYỆT ĐỐI CẤM TỰ Ý SỬA CODE HOẶC PHỎNG ĐOÁN.**

3. **Quy Tắc Kiểm Chứng Mã Nguồn Trước Khi Trả Lời (Verify Before Answer - Code-First Grounding)**:
   - Khi USER đặt bất kỳ câu hỏi nào về: **Hành vi/Cơ chế của nút bấm (Button `onClick`), trạng thái UI, luồng xử lý API, Job, Scheduler, Logic nghiệp vụ hay cách hoạt động của hệ thống**:
     - ⛔ **AI BẮT BUỘC PHẢI DÙNG TOOL (`view_file`, `grep_search`) ĐỌC TRỰC TIẾP DÒNG CODE LIÊN QUAN TRƯỚC KHI TRẢ LỜI.**
     - **Tuyệt đối cấm trả lời dựa trên phỏng đoán trí nhớ, suy diễn từ tên gọi bề mặt của giao diện hoặc thói quen thông thường.**
     - **Mọi câu trả lời giải thích cơ chế/hành vi BẮT BUỘC PHẢI CÓ BẰNG CHỨNG DẪN CHỨNG**: Trích dẫn đường dẫn file và số dòng code cụ thể (ví dụ: `[LegacyReconSection.tsx#L1316-L1328](...)`).
     - Nếu câu trả lời không có link trích dẫn dòng code kiểm chứng thực tế $\rightarrow$ Bị xem là câu trả lời suy diễn vô căn cứ và vi phạm nghiêm trọng quy chuẩn.

4. **Quy Tắc Fail-Fast & Zero-Silent-Swallow (Tuyệt Đối Cấm Nuốt Lỗi / Báo Thành Công Ảo)**:
   - Tuyệt đối không viết block `try/catch` rỗng nuốt lỗi để tiếp tục dòng chảy sai lệch.
   - Khi điều hướng (Navigation), bắt buộc phải assert URL hoặc kiểm tra sự tồn tại của Table/Header/Element đặc trưng của màn hình con mục tiêu.
   - Nếu sau điều hướng mà URL vẫn ở Dashboard (`/` hoặc `/DASHBOARD`) hoặc không tìm thấy trang con $\rightarrow$ **BẮT BUỘC PHẢI `throw new Error(...)` ĐỂ DỪNG JOB VÀ CẢNH BÁO NGAY LẬP TỨC**, nghiêm cấm việc chạy tiếp xuống hàm thao tác dữ liệu hay bấm nút (như "Kết xuất") trên màn hình sai.

5. **Quy Tắc Cấm Tự Sinh Mảng Fallback Rác (No Speculative Fallback Arrays)**:
   - Mỗi báo cáo/màn hình chỉ có **DUY NHẤT 1 bộ định danh chuẩn** (Tên menu chuẩn và URL chuẩn đã kiểm chứng).
   - Nghiêm cấm việc nhồi nhét nhiều tên phỏng đoán vào mảng candidate (ví dụ: `['Danh sách giao dịch', 'Danh sách giao dịch MM', ...]`) để "cầu may". Nếu giao diện hệ thống đối tác thay đổi, bot phải fail để con người cập nhật cấu hình, tuyệt đối không code kiểu chắp vá.

6. **Ghi vết Thay đổi (Change Log Audit)**:
   - Khi hoàn thành bất kỳ lượt chỉnh sửa nào, AI MUST ghi vết chi tiết vào file [CHANGELOG_AI.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/CHANGELOG_AI.md) và báo cáo lại chi tiết bao gồm:
     - **Mục tiêu thay đổi**: Lý do và yêu cầu cụ thể từ USER.
     - **Danh sách file chỉnh sửa**: Đưa link trực tiếp tới các file bị tác động.
     - **Tóm tắt nội dung code đã sửa**: Nêu rõ trước và sau khi sửa.
     - **Xác nhận Build/Kiểm thử**: Đảm bảo cả Frontend và Backend đều chạy build thành công (`npx tsc --noEmit` & `npm run build`).

7. **Tuyệt đối không tự ý can thiệp vào Database của hệ thống**:
   - AI tuyệt đối không được viết và chạy các script tự phát để xóa (delete), sửa đổi (update) hoặc reset các bảng ghi dữ liệu thực tế đang chạy (như Checklist templates, ShiftLogs, Users...) nếu không có chỉ đạo bằng văn bản rõ ràng từ USER. Phải bảo vệ tính toàn vẹn của dữ liệu ca trực đang kiểm thử/vận hành của USER.

8. **Quy tắc Kiểm thử & Chạy File Test Script (USER Tự Chạy Test)**:
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
   - **Tác vụ Trong phiên (CHECK_KLGD)** (*Giám sát & Đối chiếu MS vs CQG trong phiên*):
     - Định danh nghiệp vụ duy nhất: `botCheckType: 'CHECK_KLGD'`.
     - Monolith V1: Thực thi qua `runAutoCheckKLGD()` ([recon-jobs.handler.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts)).
     - Modular Monolith V2: Thực thi qua `KlgdReconWorker` ([klgd-recon.worker.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/workers/klgd-recon.worker.ts)) thuộc phân hệ `trading-ops`.
   - **Tác vụ Cuối ngày (CHECK_PRE_EOD)** (*Chốt đối chiếu 3 bên cuối ngày*):
     - Định danh nghiệp vụ duy nhất: `botCheckType: 'CHECK_PRE_EOD'`.
     - Monolith V1: Thực thi qua `runAutoCheckPreEOD()` ([recon-jobs.handler.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts)).
     - Modular Monolith V2: Thực thi qua `PreEodReconWorker` ([pre-eod-recon.worker.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/workers/pre-eod-recon.worker.ts)) thuộc phân hệ `trading-ops`.

---

## 3. Reference Mapping: C# IT Tool vs Monolith V1 vs Modular Monolith V2

| Chức năng Nghiệp vụ | C# Source File & Method | Monolith V1 (Cũ - Đang Chạy) | Modular Monolith V2 (Mới - Chuẩn Kiến Trúc) |
| :--- | :--- | :--- | :--- |
| **Tải Báo cáo M-System (RPA / API)** | `ChromeBot.cs` | `rpa-downloader.service.ts` | `modules/ingress/scrapers/ms-scraper.service.ts` & `ms-api.adapter.ts` |
| **Tải Báo cáo CQG (Song song 2 TK)** | `ChromeBot.cs` | `rpa-downloader.service.ts` | `modules/ingress/scrapers/cqg-scraper.service.ts` & `cqg-api.adapter.ts` |
| **Tải Báo cáo ACM (Straits CSV)** | SFTP / Web | `rpa-downloader.service.ts` | `modules/ingress/scrapers/acm-scraper.service.ts` |
| **Tải Báo cáo CCP (25 file)** | Browser | `rpa-downloader.service.ts` | `modules/ingress/scrapers/ccp-scraper.service.ts` & `coreccp-api.adapter.ts` |
| **Ghép file thô CQG (`FR, PS, OP, Od`)**| `FileUtils.cs` | `cqg-sync.service.ts` | `modules/trading-ops/services/cqg-merger.service.ts` |
| **Đối chiếu KLGD Trong Phiên** | `TransactionCheckingService.cs` $\rightarrow$ `CheckKLGD()` | `reconciliation.service.ts` $\rightarrow$ `checkKLGD()` | `modules/trading-ops/services/klgd-recon.service.ts` (`KlgdReconWorker`) |
| **Đối chiếu Pre-EOD 3 Bên** | `TransactionCheckingService.cs` $\rightarrow$ `CheckEOD()` | `reconciliation.service.ts` $\rightarrow$ `checkPreEOD()` | `modules/trading-ops/services/pre-eod-recon.service.ts` (`PreEodReconWorker`) |
| **Quét Ký Quỹ Âm (Post-EOD)** | `margin-checker` $\rightarrow$ `MarginChecking.cs` | `post-eod-handler.service.ts` $\rightarrow$ `scanNegativeMarginAccounts()` | `modules/trading-ops/services/margin-checker.service.ts` (`NegativeMarginWorker`) |
| **Thống kê Lot & Giá trị CCP (Macro)** | `CCP-Statistics-Tool` $\rightarrow$ `ExcelDataService.cs` | `bot-job-queue.service.ts` $\rightarrow$ `handleRun*MacroJob()` | `modules/ccp-clearing/services/lot-statistics.service.ts` (`CcpLotWorker`) |
| **Điều phối Job Bot & Cập nhật Ca** | Windows Task Scheduler | `bot-engine.service.ts` & `bot-job-queue.service.ts` | `modules/checklist-hub/dispatcher/bot-dispatcher.service.ts` |

---

## 4. Critical Technical Guidelines & Code Patterns (Quy tắc Kỹ thuật Quan trọng)

Để tránh tái diễn các lỗi nghiêm trọng về logic chạy bot và hiển thị UI, AI Assistant phải tuân thủ tuyệt đối các quy tắc sau khi sửa đổi code:

1. **Chuyển đổi Mongoose Map sang Object (`.toObject()`)**:
   - Khi truy xuất trường `payload` hoặc các nested map từ Mongoose Model, **bắt buộc** dùng `job.toObject().payload` thay vì `Object.fromEntries(job.payload)`.
   - `Object.fromEntries` chỉ chuyển đổi được cấp ngoài cùng, làm các trường lồng nhau (như `payload.result`) vẫn giữ cấu trúc Map của Mongoose dẫn tới việc truy xuất `payload.result.isWaitingFiles` bị trả về `undefined`.

2. **Quy tắc React Hooks (Rules of Hooks)**:
   - Các React hooks (`useState`, `useMemo`, `useEffect`...) phải luôn được khai báo ở trên cùng (top-level) của component, trước mọi câu lệnh return sớm (early returns). Không bao giờ đặt hook bên trong hoặc bên dưới các điều kiện `if (!isOpen) return null;`.

3. **Cơ chế Cooldown tránh lặp Job**:
   - Khi bot quét các tác vụ chưa có file hoặc gặp sự cố, phải dùng phương thức helper `shouldEnqueueNewJob(task, existingJob)` (trong Monolith V1: [bot-engine.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/bot-engine.service.ts); trong Modular V2: `modules/checklist-hub/dispatcher/bot-dispatcher.service.ts`) để áp dụng khoảng nghỉ (cooldown 15 phút hoặc theo tần suất) nhằm ngăn việc tạo hàng loạt Job chạy trùng lặp mỗi phút.

4. **Chuẩn hóa Tiền tố API ở Frontend (`/api/v1`)**:
   - Tất cả các lệnh gọi fetch dữ liệu từ Frontend lên Backend đều phải prepend tiền tố `/api/v1` (ví dụ: `${API_BASE_URL}/api/v1/reconciliation/...`). Không gọi trực tiếp qua URL không có versioning.

5. **Tuyệt đối Không Dùng Unicode Emojis trên Giao diện UI (`📁`, `💡`, ``, ``, `🔘`, `👁️`...)**:
   - Trên toàn bộ giao diện Frontend (Modal, Button, Card, Tag, Preview...), **tuyệt đối KHÔNG** chèn các ký tự icon emoji thô dạng Unicode (như `📁`, `💡`, ``, ``, `🔘`, `👁️`, `🟢`, `🔵`...).
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

## 6. Zero Hardcoded Task IDs & Dynamic Bot Resolver Rule (Quy tắc Tuyệt đối Không Hardcode Task ID)

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

## 7. Universal Zero-Hardcoding & Data-Driven Architecture Standard (Quy Chuẩn Chung Về Thiết Kế Động & Chống Hardcode)

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

---

## 8. Danh Mục Test Scripts Chuẩn Hóa Của Dự Án (Standard Test Scripts Registry)

Để tránh việc phải viết lại test script mới mỗi lần debug hoặc kiểm thử, AI Assistant và Lập trình viên BẮT BUỘC tra cứu và ưu tiên gợi ý các file test chuẩn hóa đã có sẵn trong dự án:

### 1. Nhóm Crawler / RPA M-System
| Tên File Test | Lệnh Chạy (Terminal / NPM) | Mục Đích & Phạm Vi Kiểm Thử |
| :--- | :--- | :--- |
| **`test_ms_download_all_20_reports.js`** | `node src/scripts/test_ms_download_all_20_reports.js --headed`<br/>*hoặc* `npm run test:ms-20` | Tải và kiểm chứng toàn bộ **20 báo cáo M-System** (Bao gồm selector FontAwesome 5 `fas fa-file-csv`, tự động đăng nhập lại khi trùng phiên `ensureLoggedIn`, fallback Sidebar). Lưu file tại `temp/test_20_reports/`. |
| **`test_ms_download_ttm_tttt.js`** | `node src/scripts/test_ms_download_ttm_tttt.js --headed`<br/>*hoặc* `npm run test:ms-ttm` | Chuyên biệt kiểm tra tải nhanh 2 file cốt lõi **`TTM` (Trạng thái mở)** và **`TTTT` (Trạng thái tất toán)**, chụp ảnh snapshot màn hình và đọc thẩm định cấu trúc cột Excel. |
| **`test_ms_tab_downloads.js`** | `node src/scripts/test_ms_tab_downloads.js --headed` | Kiểm tra điều hướng và tải các sub-tab con đặc thù trên M-System (Spreads, LME, ACM, Chờ đáo hạn). |

### 2. Nhóm Crawler / RPA CQG
| Tên File Test | Lệnh Chạy (Terminal / NPM) | Mục Đích & Phạm Vi Kiểm Thử |
| :--- | :--- | :--- |
| **`test_cqg_parallel_standalone.js`** | `node src/scripts/test_cqg_parallel_standalone.js --headed`<br/>*hoặc* `npm run test:cqg-parallel` | Khởi chạy song song 2 tài khoản CQG1 và CQG3/CQG2 tải file `FR1` và `FR2` đồng thời, đo benchmark thời gian xuất và độ lệch mtime giữa 2 file. |
| **`test_cqg_tab_downloads.js`** | `node src/scripts/test_cqg_tab_downloads.js --headed` | Kiểm tra tải các tab widget CQG: `FR` (Fills), `PS` (Positions), `OP` (Open Positions), `OD` (Orders). |

### 3. Nhóm Email M365 Graph API & Báo Cáo EOD
| Tên File Test | Lệnh Chạy (Terminal / NPM) | Mục Đích & Phạm Vi Kiểm Thử |
| :--- | :--- | :--- |
| **`test_m365_eod_email.ts`** | `ts-node src/scripts/test_m365_eod_email.ts`<br/>*hoặc* `npm run test:eod-email` | Chẩn đoán toàn diện kết nối Microsoft 365, kiểm tra hiệu lực Refresh Token, quyền Graph API `/me/messages`, quét và tải thử file `EOD.csv` từ `it.support@mxv.vn`. |

### 4. Nhóm Core CCP & Thống Kê Lot / Giá Trị (Macro)
| Tên File Test | Lệnh Chạy (Terminal / NPM) | Mục Đích & Phạm Vi Kiểm Thử |
| :--- | :--- | :--- |
| **`test_ccp_download_25_files.js`** | `node src/scripts/test_ccp_download_25_files.js --headed`<br/>*hoặc* `npm run test:ccp-25` | Tải toàn bộ 25 báo cáo từ CoreCCP (`https://uat-coreccp.mxv.com.vn`), tự động xử lý phân trang và chọn rổ báo cáo. |
| **`test_ccp_statistics_suite.ts`** | `ts-node src/scripts/test_ccp_statistics_suite.ts` | Bộ kiểm thử nghiệp vụ tính toán Thống kê Lot và Giá trị giao dịch CCP theo logic C# Macro sang TypeScript. |

### 5. Nhóm Đối Chiếu Số Liệu Pre-EOD 3 Bên
| Tên File Test | Lệnh Chạy (Terminal / NPM) | Mục Đích & Phạm Vi Kiểm Thử |
| :--- | :--- | :--- |
| **`run_auto_check_pre_eod_active.ts`** | `ts-node src/scripts/run_auto_check_pre_eod_active.ts`<br/>*hoặc* `npm run test:pre-eod` | Kích hoạt và kiểm thử toàn trình quy trình Đối chiếu Pre-EOD 3 bên (MS vs CQG vs Straits/ACM). |

---

## 9. Backend Modular Architecture Standard & AI Engineering Laws (Quy Chuẩn Kiến Trúc Modular Monolith & Luật Cho AI Khi Đọc/Sửa Backend)

Quy chuẩn này là **luật bắt buộc (Strict Invariant)** cho mọi AI Assistant và Lập trình viên khi tiếp cận, đọc, bảo trì hoặc phát triển mã nguồn Backend. AI TUYỆT ĐỐI KHÔNG ĐƯỢC MÒ MẪM, PHỎNG ĐOÁN HAY TỰ CHẾ PATTERN.

### 1. Phân Tầng Trách Nhiệm Rạch Ròi (Strict 3-Tier Layering)

Hệ thống được chia làm 3 tầng độc lập, nghiêm cấm xâm lấn trách nhiệm:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. CHECKLIST HUB (Workflow & Audit Core)                              │
│    • Thư mục: `src/modules/checklist-hub/`                             │
│    • Trách nhiệm: Quản lý ca trực, lịch trực, đổi ca, trạng thái task. │
│    • ⛔ CẤM: Tuyệt đối KHÔNG chứa code Playwright, KHÔNG chứa công      │
│      thức so khớp lệnh hay mã nguồn nghiệp vụ của từng sàn.           │
├────────────────────────────────────────────────────────────────────────┤
│ 2. INGRESS LAYER (Thu Thập Dữ Liệu)                                   │
│    • Thư mục: `src/modules/ingress/`                                   │
│    • Trách nhiệm: Playwright Scrapers (hiện tại) và API Adapters (CoreEX│
│      & CoreCCP). Tải dữ liệu và trả về `IngressResult`.                │
│    • ⛔ CẤM: Không chứa công thức tính toán tài chính; luôn trả về      │
│      `absolutePath` chuẩn xác trên ổ đĩa, cấm để domain tự đoán path.  │
├────────────────────────────────────────────────────────────────────────┤
│ 3. BUSINESS DOMAIN MODULES (Khối Nghiệp Vụ Chuyên Ngành Tự Chủ 100%)  │
│    • Thư mục: `src/modules/trading-ops/`, `it-ops/`, `ccp-clearing/`...│
│    • Trách nhiệm: Nhận dữ liệu sạch từ Ingress ➔ Tính toán ➔ Trả về    │
│      `TaskExecutionResult` qua `IBotWorker`.                          │
│    • ⛔ CẤM: Không tự ý truy vấn hay cập nhật trực tiếp `ShiftLog` của  │
│      ca trực; không import trực tiếp Playwright.                      │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. Bản Đồ Định Vị File Cho AI (Where To Look - Zero Guesswork)

Khi gặp bất kỳ yêu cầu/lỗi nào, AI BẮT BUỘC tra cứu đúng file mục tiêu, tuyệt đối không tìm lan man:

| Vấn Đề / Chức Năng Cần Sửa | Thư Mục / File Mục Tiêu Duy Nhất | Tuyệt Đối CẤM Làm |
| :--- | :--- | :--- |
| **Lỗi cào web M-System** (đổi nút, rớt session) | `src/modules/ingress/scrapers/ms-scraper.service.ts` | CẤM sửa vào file của QLGD hay Checklist. |
| **Lỗi tải song song CQG1 & CQG2** | `src/modules/ingress/scrapers/cqg-scraper.service.ts` | CẤM sửa vào file tính toán khớp lệnh. |
| **Lỗi đăng nhập ACM / Giải Captcha Gemini** | `src/modules/ingress/scrapers/acm-scraper.service.ts` | CẤM hardcode cookie hay đoán session. |
| **Lỗi ghép file thô CQG** (`FR, OP, PS, Od`) | `src/modules/trading-ops/services/cqg-merger.service.ts` | CẤM đoán mò thư mục; dùng `outputDir` từ Ingress. |
| **Lỗi công thức so khớp lệnh trong phiên** | `src/modules/trading-ops/services/klgd-recon.service.ts` | CẤM nhồi code Playwright vào hàm này. |
| **Lỗi chốt đối chiếu cuối ngày Pre-EOD** | `src/modules/trading-ops/services/pre-eod-recon.service.ts`| CẤM hardcode ngày T-1; dùng `working-calendar`. |
| **Lỗi quét ký quỹ âm sau EOD** | `src/modules/trading-ops/services/margin-checker.service.ts`| CẤM thay đổi ngưỡng cảnh báo khi chưa có lệnh. |
| **Lỗi đo CPU/RAM/Disk, Backup DB (IT)** | `src/modules/it-ops/` | CẤM đụng chạm vào thư mục `trading-ops`. |
| **Lỗi Reconcile 04:15, SFTP CSV (Bù trừ)** | `src/modules/ccp-clearing/` | CẤM đụng chạm vào thư mục `trading-ops`. |
| **Lỗi ca trực không mở/đóng được, giao ca** | `src/modules/checklist-hub/shifts/` | CẤM sửa vào logic nghiệp vụ của các Bot. |

### 3. Năm "Tối Kỵ" AI Tuyệt Đối Không Được Vi Phạm (Strict Prohibitions)

1. **CẤM DEEP IMPORT XUYÊN THẤU**:  
   Module A muốn giao tiếp với Module B BẮT BUỘC phải đi qua Cổng `src/shared/ports/` (`IIngressPort`, `IBotWorker`) hoặc EventBus. Tuyệt đối cấm viết `import { ... } from '@/modules/trading-ops/internal/...'` từ bên ngoài module.
2. **CẤM TỰ ĐOÁN ĐƯỜNG DẪN Ổ ĐĨA (NO SPECULATIVE PATH RESOLUTION)**:  
   Mọi đường dẫn file xử lý phải được lấy trực tiếp từ `IngressResult.outputDir` hoặc `IngressDownloadedFile.absolutePath`. Cấm mọi hành vi tự nối chuỗi hoặc tự suy đoán giữa `TradingCheck` và `Backup`.
3. **CẤM TỰ SỬA TRẠNG THÁI CA TRỰC TỪ DOMAIN SERVICE**:  
   Domain Service (QLGD, IT, CCP) chỉ trả về kết quả `{ status: 'PASSED' | 'FAILED', summary, detailUrl }`. Việc lưu vết vào `shift_logs` là quyền hạn DUY NHẤT của `BotDispatcherService` thuộc Checklist Hub.
4. **CẤM NHỒI CODE CÀO GIAO DIỆN VÀO HÀM TÍNH TOÁN**:  
   Các hàm nghiệp vụ so khớp lệnh phải là Pure Logic. Tuyệt đối không được import Playwright `Page`, `BrowserContext` vào trong thư mục `trading-ops/services/`.
5. **CẤM PHÁ VỠ TÍNH TƯƠNG THÍCH KHI CHUYỂN SANG API**:  
   Khi chuyển từ cào Playwright sang gọi API CoreEX & CoreCCP, chỉ được thay thế Adapter trong `ingress/`. Toàn bộ công thức so khớp bên trong `trading-ops/` phải được bảo tồn nguyên vẹn 100%.
6. **CẤM NHỒI LOG CHI TIẾT CỦA TOOL VÀO DOCUMENT CA TRỰC (ISOLATED DOMAIN LOGS)**:  
   Chi tiết log thực thi, raw API request/response, trace lỗi chuyên ngành và bảng so khớp chi tiết phải được lưu trữ độc lập tại database/collection riêng của từng phân hệ (`trading_recon_logs`, `ccp_clearing_logs`...). `ShiftLog` của Checklist Hub chỉ lưu trạng thái `status`, `summary` ngắn gọn và `domainLogRefId`. Tuyệt đối cấm nhồi megabyte text log thô vào `ShiftLog` làm phình to BSON chạm trần 16MB và gây nghẽn giao diện ca trực.
7. **CẤM DÙNG CHUNG CẤU HÌNH, ĐƯỜNG DẪN & TÀI KHOẢN GIỮA CÁC KHỐI (DOMAIN CONFIG & CREDENTIAL ISOLATION)**:  
   Mỗi khối nghiệp vụ (QLGD, CCP, IT, Rủi ro...) phải sở hữu riêng namespace cấu hình, đường dẫn thư mục lưu trữ (`storagePaths.domain`) và tài khoản mật khẩu bot (`domain_credentials`). Tuyệt đối cấm dùng chung một tài khoản bot hoặc ghi chung vào một thư mục không phân cấp, tránh triệt để việc ghi đè file, xung đột phiên đăng nhập (session collision) và tranh chấp quyền hạn giữa các phòng ban.

### 4. Quy Trình Kiểm Chứng Bắt Buộc Trước Khi Hoàn Thành Nhiệm Vụ

Mỗi khi AI thực hiện chỉnh sửa Backend, bắt buộc phải:
1. Đọc code hiện tại bằng `view_file` trước khi sửa (Verify-Before-Answer).
2. Chạy kiểm tra biên dịch: `nest build` đạt Exit code 0.
3. Ghi vết đầy đủ vào `CHANGELOG_AI.md`.

---

## 10. Migration & Co-existence Safety Rules (Quy Tắc Quá Độ & An Toàn Tuyệt Đối Khi Chuyển Đổi V1 sang V2)

Để quá trình chuyển đổi (Refactoring) sang Modular Monolith V2 trên nhánh `refactor/modular-architecture` không làm gián đoạn ca trực thực tế hoặc làm thất thoát nghiệp vụ:

### 1. Nguyên Tắc Strangler Fig (Xây Mới Song Song - Tuyệt Đối Cấm Đập Đi Xây Lại)
- Các module mới (`modules/ingress/`, `modules/trading-ops/`, `modules/checklist-hub/`) được triển khai song song bên cạnh code hiện hữu (`modules/bot-engine/`).
- Tuyệt đối **KHÔNG xóa đè hay phá vỡ code V1** khi module V2 chưa được kiểm chứng 100% qua bộ test so sánh kết quả.
- Điều phối chạy chuyển đổi thông qua Dispatcher và Adapter bọc ngoài (Wrapping Pattern).

### 2. Nguyên Tắc Bảo Toàn 100% Logic Lõi & Hằng Số Ẩn (Business Logic Invariants)
Khi di dời code từ `reconciliation.service.ts` sang `trading-ops/`:
- **Loại trừ Footer CQG**: Luôn cắt bỏ 2 dòng tổng kết cuối của file `FR1` và `FR2` (`row.values.slice(0, -2)`).
- **Chuẩn hóa Account Suffix**: Giữ nguyên quy tắc thay thế: đuôi `F$` $\rightarrow$ `""` (bỏ chữ F), đuôi `L$` $\rightarrow$ `"-L"`, đuôi `S$` $\rightarrow$ `"-S"`.
- **Thư mục Ngày T-1**: Quy tắc ngày làm việc `DD.MM` (bỏ qua Thứ 7, CN) phải được lấy từ `WorkingCalendarService`.
- **AWS ALB Sticky Cookies**: Giữ nguyên cơ chế bắt và duy trì cookie `AWSELB` / `AWSELBCORS` khi cào web M-System để không bị rớt về login page.

### 3. Nguyên Tắc Kiểm Chứng So Sánh Kết Quả 1:1 (Twin-Run Validation)
- Mỗi Worker mới sau khi viết xong phải được kiểm chứng bằng cách chạy song song với kết quả cũ trên cùng 1 bộ dữ liệu đầu vào (Golden Dataset ngày `08.07` hoặc dữ liệu thực tế gần nhất).
- Độ khớp số liệu giữa V1 và V2 phải đạt **100.00%** (zero variance). Nếu có bất kỳ sự sai lệch nào về số lot, giá trị hoặc trạng thái $\rightarrow$ BẮT BUỘC dừng lại kiểm tra công thức trước khi tích hợp vào ca trực.

### 4. Chiến Lược Tắt Hẳn Playwright & Chuyển Dịch Toàn Diện Sang API (Playwright Sunsetting)
- **Bảo tồn vĩnh viễn Pure Logic**: Các thuật toán tính toán so khớp lệnh (`klgd-recon.service.ts`, `pre-eod-recon.service.ts`) được thiết kế hoàn toàn độc lập với phương thức lấy dữ liệu.
- **Hoán đổi Adapter không xâm lấn**: Khi tắt Playwright, chỉ việc thay thế hoặc bổ sung Ingress Adapter mới (`CoreExApiAdapter`, `CoreCcpApiAdapter`) nạp vào Cổng `IIngressPort`. Toàn bộ mã nguồn nghiệp vụ của các Domain Worker được giữ nguyên vẹn 100%.
- **Giải phóng tài nguyên**: Việc loại bỏ Playwright sẽ triệt tiêu 100% rủi ro ngốn RAM (giảm từ 1.5GB Chromium xuống vài chục MB HTTP Client) và tăng tốc thời gian lấy dữ liệu từ hàng chục giây xuống dưới 500ms.







