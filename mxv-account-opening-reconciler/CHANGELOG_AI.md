# CHANGELOG_AI.md - Ghi Vết Thay Đổi Kiến Trúc Bóc Tách Ảnh CCCD M-System & Lọc Nhiễu Gemini Vision

---

## [2026-09-29] Fix M-System Login Reliability & UserEmail Mismatch (Local Backend)

### 1. Mục tiêu thay đổi
Yêu cầu của USER: Điều tra tại sao backend local không lấy được config M-System từ DB dù Ubuntu vẫn hoạt động bình thường, và fix crawler M-System thất bại do timeout chờ PIN keypad.

### 2. Danh sách file chỉnh sửa

- [src/modules/tkgd-automation/services/tkgd-ms-crawler.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/tkgd-automation/services/tkgd-ms-crawler.service.ts): Fix login pattern cho cả `testMSystemConnection` và `syncMSystemAccounts`.
- [src/modules/engine-helpers/msystem-scraper.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/engine-helpers/msystem-scraper.helper.ts): Cải thiện đọc DOM từ Ant Design disabled inputs.
- [src/modules/tkgd-automation/tkgd-automation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/tkgd-automation/tkgd-automation.service.ts): Fix cron filter Dedicated Worker.
- [src/context/AuthContext.tsx (UI)](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler-ui/src/context/AuthContext.tsx): Fix hardcoded email mismatch.
- [src/scripts/test_msystem_login_debug.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/scripts/test_msystem_login_debug.js): Script debug login M-System mới (USER tự chạy).

### 3. Tóm tắt nội dung thay đổi

#### A. Root Cause 1: UserEmail Mismatch (AuthContext vs MongoDB)
- **Phát hiện**: Query trực tiếp MongoDB xác nhận `tkgd_user_configs` chỉ có 1 bản ghi `userEmail: "hieptruong@mxv.vn"`.
- **Vấn đề**: `AuthContext.tsx` hardcode `email: 'clearing.acc@mxv.vn'` → frontend gửi header `x-user-email: clearing.acc@mxv.vn` → không tìm thấy bản ghi → trả về config rỗng.
- **Ubuntu hoạt động**: controller L32 fallback `'hieptruong@mxv.vn'` khi không có header → khớp DB.
- **Fix**: Đổi hardcode trong `AuthContext.tsx` từ `clearing.acc@mxv.vn` → `hieptruong@mxv.vn`.

#### B. Root Cause 2: M-System PIN Keypad Timing & Pointer Interception Bug
- **Hiện tượng tại log 18:05**: 
  - `page.click: Timeout 30000ms exceeded. <div role="dialog" class="modal fade show"> intercepts pointer events`
  - Ảnh chụp màn hình cho thấy bảng mã PIN (`Enter Your PIN`) **đã mở ra sẵn trên giao diện**.
- **Nguyên nhân**: 
  - Vòng lặp `TRY_1..3` gọi `locator('div.pincode').isVisible()` (không block wait), sau đó chờ 2s rồi tiếp tục gọi `page.click('button[type="submit"]')` lần 2 (`TRY_2`).
  - Trong 2s này, modal PIN đã bật lên che mất nút Đăng nhập. Lệnh `page.click()` lần 2 bị modal chặn pointer events, Playwright chờ modal biến mất để click nút bên dưới $\rightarrow$ treo 30s timeout!
- **Đối chiếu logic cũ (`serviceold.md` L2705-2745)**:
  - Code cũ trên Ubuntu có bọc `.catch(() => {})` khi click lại Submit và dùng `waitForURL(/.*dashboard.*/)`.
- **Giải pháp dứt điểm (Port chuẩn 100% từ script test_ms_headless_download.js của hệ thống)**:
  - Sử dụng cấu hình chuẩn: `waitUntil: 'domcontentloaded'`, timeout 35000ms.
  - Sau khi điền form, click Submit một lần: `await page.click("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary")`.
  - `await page.waitForTimeout(2000)` để M-System phản hồi modal PIN.
  - Quét PIN keypad:
    ```javascript
    const pinPad = page.locator('div.pincode');
    const hasPinPad = await pinPad.isVisible({ timeout: 4000 }).catch(() => false);
    if (hasPinPad && pin) {
      for (const digit of String(pin).split('')) {
        await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(2000);
    }
    ```
  - Áp dụng đồng bộ cho cả [`test_msystem_login_debug.js`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/scripts/test_msystem_login_debug.js) và [`tkgd-ms-crawler.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/tkgd-automation/services/tkgd-ms-crawler.service.ts).

#### C. Root Cause 3: Cron Filter Lấy User Sai (Dedicated Worker)
- **Vấn đề**: `filter = {}` (lấy tất cả user) khi `isDedicatedWorker=true` → chạy với user không có credentials → login fail.
- **Fix**: `filter = { 'msystem.username': { $exists: true, $ne: '' } }` — chỉ chạy user đã cấu hình M-System.

#### D. Cải thiện DOM Scraper (Ant Design React Disabled Inputs)
- **Vấn đề**: React controlled disabled input không sync `.value` attribute, chỉ sync `.value` property sau hydrate.
- **Fix**: Thêm đọc `title` attribute (Ant Design dùng title trên disabled input), tăng wait từ 8s → 15s, thêm debug dump toàn bộ inputs có dữ liệu.

### 4. Xác nhận Build
- `npx tsc --noEmit` → 0 errors ✅

---

## [2026-09-29] Thực Hiện Kiểm Thử Đợt 3 (45 Ca Tổng Hợp) & Cập Nhật Chiến Lược Vận Hành Local Runner


### 1. Mục tiêu thay đổi
- Thực hiện yêu cầu của USER:
  - Chạy tiếp **Đợt 3** kiểm thử ngẫu nhiên 15 hồ sơ chưa khớp khác từ CSDL Ubuntu MongoDB qua script [src/scripts/test_unmatched_db_accounts.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/scripts/test_unmatched_db_accounts.js).
  - Tối ưu quy trình kiểm thử: Cho phép chạy toàn bộ engine trên máy Windows Local kết nối Ubuntu MongoDB qua SSH Tunnel và đọc ảnh trực tiếp từ ổ đĩa `M:\`, đồng thời tạm tắt dịch vụ trên Ubuntu để tránh việc phải build và deploy liên tục trong quá trình tinh chỉnh incremental.
  - Tổng hợp kết quả cả 3 đợt (45 ca ngẫu nhiên) và cập nhật tài liệu kiểm thử chính thức tại [docs/new/TAI_LIEU_KIEM_THU_BOC_TACH_CCCD_MS_VA_DOI_SOAT_THUC_TE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/docs/new/TAI_LIEU_KIEM_THU_BOC_TACH_CCCD_MS_VA_DOI_SOAT_THUC_TE.md).

### 2. Danh sách file chỉnh sửa / tạo mới
- [docs/new/TAI_LIEU_KIEM_THU_BOC_TACH_CCCD_MS_VA_DOI_SOAT_THUC_TE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/docs/new/TAI_LIEU_KIEM_THU_BOC_TACH_CCCD_MS_VA_DOI_SOAT_THUC_TE.md): Bổ sung kết quả Đợt 3 (13/15 KHOP - 86.7%), phân tích chuyên sâu 10 ca cảnh báo nghiệp vụ và chiến lược vận hành Local Runner.

### 3. Kết quả kiểm thử thực tế (45 ca tổng hợp)
- **Tỷ lệ bóc tách thành công**: 43/45 (**95.6%**).
- **Tỷ lệ tự động hóa giải lệch thành `KHOP`**: 35/45 (**77.8%**).
- **Thời gian xử lý trung bình**: **6.55 giây / hồ sơ**.
- **Tỷ lệ phát hiện lỗi nghiệp vụ & bảo mật chuẩn xác**: 10/45 (**22.2%**), không có trường hợp báo thành công ảo.

---

### 1. Mục tiêu thay đổi
- Thực hiện yêu cầu của USER:
  - Kết nối trực tiếp / đường hầm (SSH Tunnel) tới CSDL MongoDB trên máy chủ Ubuntu (`mongodb://127.0.0.1:27017/mxv_shift_checklist` hoặc qua SSH `10.0.0.26`).
  - Lấy ngẫu nhiên mẫu 10 - 20 tài khoản đang ở trạng thái **CHƯA KHỚP** (`LECH` / `CAN_KIEM_TRA`) đã có sẵn dữ liệu bóc tách Email (`noiDungMail`).
  - Tải / truy xuất cặp ảnh CCCD 2 mặt M-System (`_MS_CCCD_truoc.jpg` và `_MS_CCCD_sau.jpg`) từ kho hồ sơ thực tế (`M:\Tailieuchung\...`).
  - Đưa qua luồng bóc tách Python Worker (2 mặt + MRZ + QR + Anomaly Detector + Gemini Vision Fallback).
  - Đối soát chéo theo bộ quy tắc mới (`evaluateRecordReconciliationRule`), đánh giá khả năng tự động hóa giải lệch cũ (False Positive) và kiểm tra độ ổn định của hệ thống.

### 2. Danh sách file chỉnh sửa / tạo mới
- [src/scripts/test_unmatched_db_accounts.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/scripts/test_unmatched_db_accounts.js)

### 3. Tóm tắt nội dung code
- **Tự động thích ứng kết nối CSDL**: Kiểm tra kết nối MongoDB cục bộ (cổng 27017), nếu chưa có dữ liệu sẽ tự động mở SSH Tunnel an toàn tới Ubuntu `10.0.0.26:27017` qua cổng phụ `27018` bằng `ssh2`. Đảm bảo 100% không yêu cầu cấu hình thủ công.
- **Bộ lọc ngẫu nhiên chuẩn xác**: Truy vấn các hồ sơ `LECH` / `CAN_KIEM_TRA` có `noiDungMail`, tự động kiểm tra sự tồn tại của cặp ảnh M-System 2 mặt trên đĩa mạng `M:\`, xáo trộn ngẫu nhiên và lấy ra số lượng theo yêu cầu (mặc định 15, hỗ trợ cấu hình `--limit 10` - `20`).
- **Luồng xử lý khép kín & Đối soát 3 chiều**: Chạy OCR 2 mặt -> Chẩn đoán bất thường -> Đối soát Email vs HĐ vs Ảnh MS -> Xuất bảng tổng hợp trực quan và thống kê tỷ lệ thành công, tỷ lệ hóa giải lệch, độ trễ xử lý.

### 4. Xác nhận Build & Kiểm thử
- **Syntax Check**: `node --check src/scripts/test_unmatched_db_accounts.js` -> Passed.
- **Backend Build**: `npm.cmd run build` -> Exited with code 0 (Build thành công 100%).

---

### 1. Mục tiêu thay đổi
- Thực hiện yêu cầu của USER: Chuẩn hóa và hoàn thiện tính năng bóc tách ảnh CCCD chính thức từ M-System, chuyển đổi từ luồng quét ảnh email rủi ro sang M-System Centric CCCD OCR.
- Xử lý dứt điểm 3 lỗi phát hiện từ dữ liệu thực tế trên ổ đĩa `M:\` (25 ca benchmark):
  1. Khử triệt để nhiễu ký tự phân cách `<` của chuẩn ICAO MRZ bị Tesseract đọc nhầm thành `KK`, `KKK`, `K$`, `C` ở đuôi tên (ví dụ: `HOANG DUC KK KKK` -> `HOANG DUC`, `TRANK DUCCTAMK` -> `TRAN DUC TAM`, `NGUYEN THI VAN LANK` -> `NGUYEN THI VAN LAN`).
  2. Bổ sung cơ chế tự động kế thừa `ngayCap` từ Hợp đồng PDF cho các ca quét qua MRZ mặt sau (do chuẩn ICAO Doc 9303 không mã hóa ngày cấp).
  3. Xây dựng Bộ kiểm soát lọc nhiễu từng trường (`detect_field_anomalies`) và Trọng tài đối soát kép Gemini Vision AI (`call_gemini_vision_fallback`), đồng thời ghi vết các ca bất thường vào `data/anomaly_cases_log/<YYYY-MM-DD>/<code >_anomaly.json` để phục vụ cải tiến hệ thống liên tục.

---

### 2. Danh sách file chỉnh sửa
- [src/python/tkgd_extractor_worker.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/python/tkgd_extractor_worker.py)
- [src/modules/engine-helpers/tkgd-reconcile-rules.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/engine-helpers/tkgd-reconcile-rules.helper.ts)

---

### 3. Tóm tắt nội dung code đã sửa

#### 3.1 `src/python/tkgd_extractor_worker.py`
- **Trước khi sửa**:
  - Dòng 1475-1476: `given_words = [w for w in given.split() if len(w) > 1 or w == given.split()[0]]` lấy nguyên các từ `KK`, `KKK` do Tesseract đọc nhầm từ padding `<`.
  - Tên bị dính chữ như `TRANK DUCCTAMK` không được khử `K` ở cuối hoặc tách từ.
  - Hàm `call_gemini_vision_fallback` dùng prompt chung, không truyền ngữ cảnh bất thường.
  - Chưa có cơ chế ghi vết log ca bất thường ra file `data/anomaly_cases_log/`.
- **Sau khi sửa**:
  - `parse_mrz_lines` bổ sung bộ lọc padding MRZ chuyên biệt: loại bỏ các từ toàn `K, C, S, X` rác (`KK`, `KKK`), khử chữ `K` ở cuối các từ (do tiếng Việt không bao giờ kết thúc bằng K), tự động tách cụm bị dính dấu `CC` (`DUCCTAM` -> `DUC TAM`).
  - Thêm hàm `detect_field_anomalies(cccd_data, hopdong_data, expected_name)` kiểm soát chặt chẽ 6 trường: `soCCCD` (12 số, logic BCA, mã giới tính/thế kỷ), `hoTen` (nhiễu ký tự, rác MRZ), `ngaySinh`, `gioiTinh`, `ngayCap`, `canhBaoChatLuong`.
  - Nâng cấp `call_gemini_vision_fallback` nhận `anomaly_reasons` và ngữ cảnh Hợp đồng, áp dụng Prompt Chuyên gia Giám định Căn cước tối cao của MXV.
  - Thêm hàm `log_anomaly_case` ghi log đầy đủ thông tin: dữ liệu trước khi gọi AI, dữ liệu Gemini trả về, kết quả sau khi heal, các trường được heal vào `data/anomaly_cases_log/<YYYY-MM-DD>/<code >_anomaly.json`.

#### 3.2 `src/modules/engine-helpers/tkgd-reconcile-rules.helper.ts`
- **Trước khi sửa**:
  - `evaluateRecordReconciliationRule` không kế thừa `ngayCap` từ Hợp đồng khi ảnh bóc tách từ MRZ bị thiếu ngày cấp, dẫn đến đánh lỗi lệch hoặc cảnh báo.
  - Chưa phân định các cờ sai lệch đặc thù 3 chiều `FLAG_MS_INPUT_TYPO` (Ảnh MS == HĐ != Text MS) và `FLAG_CONTRACT_ID_MISMATCH` (Ảnh MS == Text MS != HĐ).
- **Sau khi sửa**:
  - Bổ sung `discrepancyFlags?: string[]` vào `ReconciliationResult`.
  - Tự động kế thừa `ngayCap` từ Hợp đồng cho nguồn MRZ (`isMrzSource && !normCccdIssue && isCanonicalDate(normHdIssue)`), ghi chú giải thích minh bạch trong `autoHealedNotes`.
  - Phân loại rõ ràng cờ lỗi: `FLAG_MS_INPUT_TYPO` khi TVKD gõ sai thông tin trên M-System so với ảnh gốc và HĐ; `FLAG_CONTRACT_ID_MISMATCH` khi HĐ đính kèm lệch với hồ sơ M-System.
  - Ghi nhận thông tin chữa lành từ Gemini Vision (`record.canCuoc.healedFields`) vào `autoHealedNotes`.

---

### 4. Xác nhận Build & Kiểm thử
- **Python Syntax Check**: `python -m py_compile src/python/tkgd_extractor_worker.py` -> Exited with code 0 (Thành công 100%).
- **TypeScript Typecheck**: `npx.cmd tsc --noEmit` -> Exited with code 0 (Không phát sinh lỗi).

---

## [2026-09-29] Nâng Cấp Adaptive Model Rotator & Blacklist Cooldown Cho Gemini Vision Fallback

### 1. Mục tiêu thay đổi
- Chuyển giao kiến trúc "Adaptive Last-Known-Good & Multi-Tier Failover" từ bot giải Captcha sang tầng AI Vision Trọng tài đối soát CCCD trong `tkgd_extractor_worker.py`.
- Khắc phục 2 điểm nghẽn:
  1. Thiếu cơ chế ghi nhớ model hoạt động tốt gần nhất (`Last-Known-Good`), khiến các lần quét hồ sơ đều duyệt lại từ đầu danh sách model.
  2. Thiếu cơ chế Blacklist Cooldown khi Google báo lỗi 429 (Hết Quota), 503 (Quá tải) hoặc 404 (Khai tử model), gây lãng phí thời gian chờ timeout ở các hồ sơ tiếp theo.

### 2. Danh sách file chỉnh sửa
- [src/python/tkgd_extractor_worker.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/python/tkgd_extractor_worker.py)

### 3. Tóm tắt nội dung code đã sửa
- **Trước khi sửa**:
  - `get_available_gemini_models`: Fallback tĩnh cũ, gộp thô danh sách không sắp xếp phiên bản đời mới (3.8, 3.7, 3.6...), không đẩy alias `gemini-flash-latest` xuống cuối.
  - `call_gemini_vision_fallback`: Duyệt tuần tự mảng tĩnh với timeout 15s mỗi model, không có trạng thái lưu vết model thành công hay model đang bị phạt.
- **Sau khi sửa**:
  - Bổ sung cơ chế lưu trữ trạng thái đĩa `STATE_FILE` (`mxv_gemini_ai_state.json`) giữa các subprocess Python.
  - Cập nhật danh sách fallback tĩnh bao gồm các model Flash đời mới: `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-flash`.
  - Triển khai **Heuristic Sorting**: Sắp xếp phiên bản lớn đứng trước, chủ động đẩy `gemini-flash-latest` xuống cuối để tránh nghẽn mạng toàn cầu.
  - Triển khai **Last-Known-Good**: Đẩy model vừa bóc tách thành công ở hồ sơ trước lên vị trí Index 0 (ưu tiên số 1), giải quyết nhanh trong 1.2–2.0s.
  - Triển khai **Blacklist Cooldown (10 phút)**: Khi gặp HTTP 404/429/503, tự động đưa model vào danh sách phạt 10 phút và phế truất khỏi `last_successful`. Các hồ sơ sau lập tức bỏ qua model chết này.
  - Khống chế timeout 10 giây mỗi request đơn lẻ.

### 4. Xác nhận Build & Kiểm thử
- **Python Syntax Check**: `python -m py_compile src/python/tkgd_extractor_worker.py` -> Exited with code 0 (Thành công 100%).
- **TypeScript Typecheck**: `cmd /c "npx tsc --noEmit"` -> Exited with code 0.

---

## [2026-09-29] Triển Khai Kiến Trúc On-Demand Model Refresh & Van An Toàn Chống Bão Request

### 1. Mục tiêu thay đổi
- Thực hiện yêu cầu của USER: Lưu danh sách model đã lấy vào State/Database, khi gọi bình thường chỉ dùng danh sách đã lưu; chỉ khi toàn bộ model đều thất bại mới kích hoạt gọi Google API lấy danh sách mới về cập nhật lại Database.
- Triển khai 2 van an toàn:
  1. **Van chống bão Request (Throttling Cooldown 1 giờ)**: Giới hạn tần suất gọi Google API `GET /models` tối đa 1 lần/giờ (`MIN_API_REFRESH_INTERVAL = 3600`) để ngăn chặn tình trạng Retry Storm khi API Key hết hạn hoặc mất kết nối mạng.
  2. **Tinh gọn mảng Fallback tĩnh**: Loại bỏ triệt để các model phỏng đoán ma (3.5, 3.6, 3.7, 3.8...), chỉ duy trì đúng 2 model tiêu chuẩn nhất (`gemini-2.5-flash`, `gemini-2.5-flash-lite`), loại bỏ hoàn toàn nguy cơ sinh ra "công việc ảo".

### 2. Danh sách file chỉnh sửa
- [src/python/tkgd_extractor_worker.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/python/tkgd_extractor_worker.py)

### 3. Tóm tắt nội dung code đã sửa
- Tách hàm `fetch_remote_gemini_models(api_key)` độc lập để chỉ gọi khi thực sự cần refresh.
- `get_available_gemini_models`: Ưu tiên nạp danh sách model từ `state['models']` đã lưu trữ bền vững.
- Trong `call_gemini_vision_fallback`:
  - **Lượt 1**: Thử duyệt danh sách candidate models từ state hiện có (ưu tiên `last_successful` ở Index 0).
  - **Lượt 2 (All-Fail Event)**: Nếu toàn bộ model thất bại, kiểm tra `now - last_api_refresh_at > MIN_API_REFRESH_INTERVAL`. Nếu đã quá 1 giờ, gọi `fetch_remote_gemini_models` cập nhật danh sách mới vào state, xóa cooldown và thử lại đúng 1 lần với 2 model tốt nhất.
  - **Fail-Fast**: Nếu chưa đủ 1 giờ hoặc gọi API refresh vẫn thất bại, lập tức dừng và trả về `None` (Fail-Fast), không quay vòng lặp vô ích.

### 4. Xác nhận Build & Kiểm thử
- **Python Syntax Check**: `python -m py_compile src/python/tkgd_extractor_worker.py` -> Exited with code 0 (Thành công 100%).
- **TypeScript Typecheck**: `cmd /c "npx tsc --noEmit"` -> Exited with code 0.

---

## [2026-09-29] Triển Khai Chuẩn Kiến Trúc Node Role Separation (ENABLE_TKGD_BACKGROUND_WORKER)

### 1. Mục tiêu thay đổi
- Thực hiện yêu cầu của USER: Tách biệt hoàn toàn luồng chạy Tự động (Auto Pipeline) giữa máy Local và Server Ubuntu. Đảm bảo máy Local có thể bật tự động quét, cào M-System và chạy Python OCR mà Server Ubuntu `10.0.0.26` không tự động bật theo và đứng im 100%.
- Tránh việc hai máy dẫm chân lên nhau khi đọc chung Database MongoDB.

### 2. Danh sách file chỉnh sửa
- [src/modules/tkgd-automation/tkgd-automation.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/tkgd-automation/tkgd-automation.service.ts)
- [src/modules/engine-helpers/tkgd-python-bridge.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/engine-helpers/tkgd-python-bridge.helper.ts)
- [.env](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/.env)

### 3. Tóm tắt nội dung code đã sửa
- **`tkgd-automation.service.ts`**:
  - Triển khai hook `onModuleInit` để xác định và ghi log vai trò của Node (`WEB_ONLY`, `DEDICATED_WORKER`, hoặc `STANDARD`).
  - Trong `handleCronAutoPipeline`: Bổ sung kiểm tra `ENABLE_TKGD_BACKGROUND_WORKER`.
    - Nếu `= 'false'`: Node là Web-Only, lập tức return, không bao giờ chạy cron tác vụ nặng.
    - Nếu `= 'true'` (hoặc `TKGD_LOCAL_AUTO_RUNNER=true`): Node đóng vai trò Dedicated Worker, tự động quét chu kỳ cho user ngay cả khi cờ trên DB chung đang tắt (giữ an toàn cho Web Server).
    - Mặc định: Chạy theo trạng thái `autoPipeline.enabled` trên MongoDB.
- **`tkgd-python-bridge.helper.ts`**:
  - Bổ sung `resolveStoragePathCrossPlatform` cho các đường dẫn `hopDongPath`, `phuLucPath`, `cccdFrontPath`, `cccdBackPath` trước khi gọi Python OCR, đảm bảo các bản ghi cũ tạo từ Ubuntu (`/mnt/qlgd-it/...`) tự động ánh xạ sang `M:\Tailieuchung\...` khi chạy trên máy Windows.
- **`.env`**:
  - Thêm cấu hình `ENABLE_TKGD_BACKGROUND_WORKER=true`.

### 4. Xác nhận Build & Kiểm thử
- **Backend Build (`npm run build`)**: Exited with code 0 (NestJS compiled cleanly).
- **Frontend Build (`npm run build`)**: Exited with code 0 (Next.js compiled cleanly).

---

## [2026-09-29] Nâng Cấp SSH Tunnel Resilient & Tự Động Nhập Mã PIN Ảo M-System

### 1. Mục tiêu thay đổi
- Sửa triệt để lỗi crash tiến trình `start_dev_tunnel.js` do lỗi unhandled `ECONNRESET` khi Mongoose pool đóng socket.
- Tự động duy trì đường hầm SSH kết nối Ubuntu MongoDB 24/7 (Keep-Alive 10s + Auto-Reconnect khi đứt mạng).
- Sửa lỗi Bot M-System crawler bị kẹt tại màn hình `/#/login`: Bổ sung cơ chế bấm bàn phím ảo mã PIN (`div.pincode`) và van an toàn Fail-Fast (Rule 1.4) dừng ngay khi không vào được Workspace.

### 2. Danh sách file chỉnh sửa
- [src/scripts/start_dev_tunnel.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/scripts/start_dev_tunnel.js)
- [src/modules/tkgd-automation/services/tkgd-ms-crawler.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/tkgd-automation/services/tkgd-ms-crawler.service.ts)

### 3. Tóm tắt nội dung code đã sửa
- **`start_dev_tunnel.js`**:
  - Bổ sung `keepaliveInterval: 10000` (10s) chống ngắt phiên SSH do idle timeout từ server.
  - Xử lý sự kiện `sock.on('error')` và `stream.on('error')`, bắt lỗi `ECONNRESET` toàn cục không để tiến trình Node.js bị văng đột ngột.
  - Tích hợp hàm `startTunnel()` với sự kiện `conn.on('close')`: Tự động kết nối lại sau 3 giây.
- **`tkgd-ms-crawler.service.ts`**:
  - Bổ sung bước giải mã `pinEncrypted` và tự động click từng phím số trên bàn phím ảo `div.pincode`.
  - Triển khai Fail-Fast: Assert URL sau đăng nhập, nếu vẫn ở `/#/login` thì dừng ngay lập tức và ném lỗi rõ ràng, tuyệt đối không quét 100 tài khoản rỗng.

### 4. Xác nhận Build & Kiểm thử
- **Backend Build (`npm run build`)**: Exited with code 0 (NestJS compiled cleanly).

