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
