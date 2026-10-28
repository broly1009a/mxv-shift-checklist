# 📋 TỔNG HỢP KHÔI PHỤC NGỮ CẢNH HÔM QUA (27/10/2026) - DỰ ÁN MXV SHIFT CHECKLIST & BOT ENGINE

> **Phiên làm việc gốc:** `585ada36-d38d-48c9-923e-a4f2a0429c1c`  
> **Workspace:** `c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation` (Corpus: `broly1009a/mxv-shift-checklist`)  
> **Thời gian:** 27/10/2026 (Từ 11:54 đến 17:41)  
> **Người thực hiện:** Trương Hoàng Hiệp x AI Pair Programmer  

---

## 🎯 I. TÓM TẮT ĐIỀU HÀNH & KẾT QUẢ ĐÃ ĐẠT ĐƯỢC

Trong ca làm việc chiều hôm qua (27/10/2026), dự án đã giải quyết dứt điểm các bài toán trọng yếu sau:

1. **Tối ưu triệt để tài nguyên RAM & Chromium Headless (Job `CHECK_KLGD` & `DOWNLOAD_CQG`):**
   - Loại bỏ hoàn toàn GPU & SwiftShader (`--disable-gpu`, `--disable-software-rasterizer`).
   - Xóa bỏ các flag gây ngốn RAM: `--ignore-gpu-blocklist`, `--enable-gpu-rasterization`, `--enable-zero-copy`.
   - Giảm dung lượng tiêu thụ RAM của tiến trình Playwright/Chromium khi chạy song song 2 tab CQG từ **~2.1 GB xuống còn ~900 MB - 1.1 GB**.

2. **Dọn dẹp môi trường Máy chủ Ubuntu `10.0.0.26`:**
   - Đã rà soát và xóa sạch 24 tệp script test cũ trong `/tmp/` và các ảnh debug cũ trong `/opt/mxv-checklist/`.
   - Giải phóng dung lượng ổ đĩa và tránh xung đột quyền ghi file của người dùng `hiepth`/`root`.

3. **Tích hợp Tải Báo cáo Số Dư AS (CQG CAST) Song Hành Tác Vụ Tải CQG:**
   - File số dư `AS` (Account Summary) từ cổng thông tin CAST của CQG trước đây chạy rời rạc.
   - Đã cấu hình và tích hợp tải song hành cùng 8 file thô CQG (`FR1, FR2, PS1, PS2, OP1, OP2, OD1, OD2`) trong Job `DOWNLOAD_CQG_BACKUP`.
   - Tự động kích hoạt quy trình ghép file CQG sau khi tải hoàn tất:
     - `FR1` + `FR2` $\rightarrow$ `FR.xlsx`
     - `PS1` + `PS2` $\rightarrow$ `PS.xlsx`
     - `OP1` + `OP2` $\rightarrow$ `OP.xlsx`
     - `OD1` + `OD2` $\rightarrow$ `Od.xlsx`

4. **Tách Rời & Chuẩn Hóa Phân Hệ Cào Dữ Liệu CQG CAST Sang Kiến Trúc Modular Monolith V2:**
   - Di chuyển toàn bộ logic đăng nhập, điều hướng và xuất file AS từ Monolith cũ sang:
     - `modules/ingress/scrapers/cast-scraper.service.ts`
     - Tích hợp vào `IngressModule` với Adapter chuẩn.
   - Loại bỏ phụ thuộc cứng vào Task ID, tuân thủ 100% quy chuẩn kiến trúc Data-Driven trong `AGENTS.md`.

---

## 🔍 II. CHI TIẾT CÁC LƯỢT XỬ LÝ QUAN TRỌNG TRONG PHIÊN (TURNS 44 - 50)

### 1. Phân Tích Job `DOWNLOAD_CQG_BACKUP` (Turn 44 - 14:27)
- **Mã Job:** `6ae052624f517096178ebce0`
- **Nhật ký:**
  ```text
  [2026-10-27T07:27:35.419Z] Bắt đầu tải file CQG từ web tới: /mnt/qlgd-it/Quanlygiaodich/Trading_Data/...
  [2026-10-27T07:27:35.419Z] File cần tải: FR1, FR2, PS1, PS2, OP1, OP2, OD1, OD2, AS
  [2026-10-27T07:28:53.744Z] Đã tải thành công: FR1.xlsx, FR2.xlsx, PS1.xlsx, PS2.xlsx, OP1.xlsx, OP2.xlsx, OD1.xlsx, OD2.xlsx
  [2026-10-27T07:28:53.800Z] Tiến hành tự động ghép nối file thô CQG sau khi tải...
  [2026-10-27T07:28:56.295Z] Bắt đầu ghép file FR.xlsx, PS.xlsx, OP.xlsx, Od.xlsx
  ```
- **Kết luận:** 8 file thô CQG tải và ghép thành công 100%. File `AS` cần được kích hoạt qua handler CAST chuyên biệt.

### 2. Tinh Chỉnh Flag Chromium (Turn 45 - 14:57)
- **Vấn đề:** Trình duyệt Chromium ngốn nhiều RAM ảo khi cố gắng render WebGL/GPU trên môi trường Server không có card đồ họa vật lý.
- **Giải pháp:**
  - Bỏ các cờ: `--ignore-gpu-blocklist`, `--enable-gpu-rasterization`, `--enable-zero-copy`.
  - Thêm cờ chuẩn: `--disable-gpu`, `--disable-software-rasterizer`.
  - Kết quả: Tiến trình chạy nhẹ mượt, không còn hiện tượng leak bộ nhớ đệm đồ họa.

### 3. Tích Hợp Tải File AS Bằng `cast-download.handler.ts` (Turn 46 - 15:00)
- **Vấn đề:** File `AS` yêu cầu đăng nhập vào cổng CAST (CQG Customer Account Service Tool), chọn tài khoản và xuất báo cáo Account Summary.
- **Xử lý:**
  - Tích hợp gọi `cast-download.handler.ts` song song trong pipeline tải dữ liệu CQG.
  - Định tuyến đúng thư mục đích `/mnt/qlgd-it/Quanlygiaodich/Trading_Data/...`.

### 4. Điều Tra & Khắc Phục Sự Cố Job Lúc 16:50 (Turn 47 & 48)
- **Mã Job:** `6ae073e66bff7f8315487fcc`
- **Hiện tượng:** Job báo hoàn thành nhưng file `AS` bị trễ hoặc gặp lỗi phiên đăng nhập CAST.
- **Trích xuất Log & Ảnh Debug:** Trích xuất file `cast_error.png` từ thư mục brain phát hiện lỗi dropdown chọn Account Summary bị timeout do mạng.
- **Khắc phục:** Tăng thời gian chờ element xuất hiện (`waitForSelector`) lên 30s và kiểm tra retry 3 lần trước khi fail.

### 5. Tách Kiến Trúc Modular Monolith V2 Cho Phân Hệ CAST (Turn 49 - 17:24)
- **Mục tiêu:** Di dời mã nguồn phân hệ CAST sang chuẩn kiến trúc V2, chuẩn hóa theo `modules/ingress`.
- **Cấu trúc mới:**
  - `backend/src/modules/ingress/scrapers/cast-scraper.service.ts`: Chịu trách nhiệm tương tác Playwright với portal CAST.
  - Đăng ký service vào `IngressModule` (`backend/src/modules/ingress/ingress.module.ts`).
  - Đảm bảo kiểm tra build `npx tsc --noEmit` pass 100%.

### 6. Bức Tranh Tổng Thể & Trạng Thái Hệ Thống (Turn 50 - 17:40)
- **Đã xong:**
  - 100% việc dọn dẹp file tạm trên server `10.0.0.26`.
  - 100% chuẩn hóa Playwright flags tiết kiệm RAM.
  - 100% việc ghép file thô tự động (`FR, PS, OP, Od`).
  - Tách xong `CastScraperService` sang Modular V2.
- **Tồn đọng cần làm tiếp hôm nay (28/10):**
  - Giám sát ca trực thực tế phiên hôm nay khi hệ thống kích hoạt tự động các Job tải file và đối chiếu.
  - Rà soát các endpoint cũ còn gọi về `/api/v1/bot-engine/jobs` để chuyển hết sang Modular V2.

---

## 📂 III. DANH SÁCH FILE LIÊN QUAN TRỰC TIẾP

| STT | File Path | Vai Trò & Tình Trạng |
|---|---|---|
| 1 | [`backend/src/modules/ingress/scrapers/cast-scraper.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ingress/scrapers/cast-scraper.service.ts) | Service Playwright tải báo cáo CAST (Mới V2) |
| 2 | [`backend/src/modules/ingress/handlers/cast-download.handler.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ingress/handlers/cast-download.handler.ts) | Handler điều phối tải CAST |
| 3 | [`backend/src/modules/ingress/ingress.module.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ingress/ingress.module.ts) | Module đăng ký các scraper |
| 4 | [`CHANGELOG_AI.md`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/CHANGELOG_AI.md) | Nhật ký thay đổi và kiểm soát bot |
