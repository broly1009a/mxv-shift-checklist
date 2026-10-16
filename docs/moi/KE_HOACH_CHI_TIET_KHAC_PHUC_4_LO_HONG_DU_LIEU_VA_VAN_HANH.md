# KẾ HOẠCH CHI TIẾT & THIẾT KẾ KỸ THUẬT KHẮC PHỤC 4 LỖ HỔNG VẬN HÀNH & DỮ LIỆU
> **Dự án:** MXV Shift Checklist & Trading Manager  
> **Tài liệu:** Thiết kế chuyên sâu theo chuẩn Atomic Phases (Sửa độc lập từng phần - Zero Silent Swallow)  
> **Ngày lập:** 16/10/2026  
> **Trạng thái:** Sẵn sàng triển khai theo từng Phase  

---

## 1. TỔNG QUAN & BỐI CẢNH KIỂM TOÁN

Sau khi thực hiện rà soát chuyên gia và kiểm chứng trực tiếp từ mã nguồn thực tế, hệ sinh thái đối chiếu và vận hành dữ liệu giao dịch của MXV ghi nhận tình trạng sau:
- ✅ **Lỗ hổng 2 (Lệch Cutoff thời gian thực trong phiên)**: **ĐÃ HOÀN TẤT** (Bổ sung bộ lọc lệch ảo hai chiều Bi-directional Cutoff tại [klgd-recon.service.ts#L210-L237](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/klgd-recon.service.ts#L210-L237) và Direct REST API Ingress tại [recon-jobs.handler.ts#L324-L368](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts#L324-L368)).
- ✅ **Lỗ hổng 3 (Chặn chạy EOD CoreCCP trước khi VNCLEAR chốt sổ)**: **ĐÃ HOÀN TẤT Ở BACKEND CORE** (Date Assertion nghiêm ngặt tại [ccp-eod.service.ts#L310-L333](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/ccp-eod.service.ts#L310-L333)).

Còn lại **4 LỖ HỔNG TIỀM ẨN RỦI RO DỮ LIỆU VÀ VẬN HÀNH** cần được phân rã thành các **Phase chuyên sâu độc lập (Atomic Phases)** để khắc phục tuần tự, có kiểm thử chứng minh ground truth trước khi bàn giao:

| Thứ tự Phase | Mã Lỗ hổng | Tên Lỗ hổng / Rủi ro Kỹ thuật | Phân hệ chịu tác động | Mức độ rủi ro |
| :---: | :---: | :--- | :--- | :---: |
| **Phase 1** | **Lỗ hổng 5** | Ghép file CQG thô bất đồng bộ (`FR1` mới + `FR2` cũ) | `trading-ops` (`cqg-merger.service.ts`) | 🔴 **Khẩn cấp** |
| **Phase 2** | **Lỗ hổng 4** | Báo thành công ảo & Ghi đè file Baseline DSGD Trước EOD | `trading-ops` (`dsgd-before-eod.service.ts`) | 🔴 **Khẩn cấp** |
| **Phase 3** | **Lỗ hổng 6** | Tính ngày T-1 mù quáng bỏ qua ngày Lễ/Tết | `trading-ops` & `working-calendar` | 🔴 **Nghiêm trọng** |
| **Phase 4** | **Lỗ hổng 1 & 3** | Động hóa mốc tải Mùa đông (DST) & UI Guard VNCLEAR | `bot-engine` (`scheduler`) & `frontend` | 🟡 **Vận hành** |

---

## 2. PHASE 1: KHẮC PHỤC LỖ HỔNG 5 - BẢO VỆ GHÉP FILE CQG THÔ (CQG RAW MERGING ASYNCHRONY)

### 2.1. Căn cứ mã nguồn hiện tại (Ground Truth)
- File tác động: [backend/src/modules/trading-ops/services/cqg-merger.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/cqg-merger.service.ts)
- Đoạn code có lỗ hổng (Dòng 77-120 và 340-398):
  ```typescript
  // Trong mergeFR(src1, src2, dest):
  let rows1: any[][] = [];
  if (fs.existsSync(src1)) { ... }
  let rows2: any[][] = [];
  if (fs.existsSync(src2)) { ... }
  mergedData.push(...data1, ...data2);
  
  // Trong autoMergeFolder(folder):
  const fr1 = path.join(folder, 'FR1.xlsx');
  const fr2 = path.join(folder, 'FR2.xlsx');
  if (fs.existsSync(fr1) || fs.existsSync(fr2)) {
    this.mergeFR(fr1, fr2, frDest);
  }
  ```

### 2.2. Phân tích sự cố thực tế
1. Phân hệ CQG sử dụng 2 tài khoản riêng biệt để tải:
   - Tài khoản 1: `FR1.xlsx`, `PS1.xlsx`, `OP1.xlsx`, `OD1.xlsx`
   - Tài khoản 2: `FR2.xlsx`, `PS2.xlsx`, `OP2.xlsx`, `OD2.xlsx`
2. **Kịch bản lỗi**:
   - Lúc 04:00 AM hôm nay, Tài khoản 1 tải thành công `FR1.xlsx`.
   - Tài khoản 2 gặp sự cố mạng, tài khoản bị tạm khóa hoặc browser bị crash nên **không tải được `FR2.xlsx` mới**.
   - Trong thư mục vẫn còn file `FR2.xlsx` được tải từ **ngày hôm qua**.
   - Do `cqg-merger.service.ts` chỉ kiểm tra `fs.existsSync(src2)` mà không kiểm tra thời điểm sửa đổi (`mtime`), hệ thống sẽ **ghép `FR1` (hôm nay) với `FR2` (hôm qua)**.
   - **Hậu quả**: File gộp `FR.xlsx` bị trộn lẫn 50% dữ liệu cũ, số lot lệch hoàn toàn so với M-System, bot liên tục báo lỗi mismatch giả hoặc tính sai phí vị thế ròng của toàn bộ thành viên thị trường!

### 2.3. Thiết kế giải pháp kỹ thuật (Atomic Remediation)
1. **Xây dựng Hàm Kiểm Định Độ Tươi & Tính Đồng Bộ File (File Freshness & Window Guard)**:
   ```typescript
   export interface CqgPairValidationResult {
     isValid: boolean;
     error?: string;
     stat1?: fs.Stats;
     stat2?: fs.Stats;
     mtimeDiffMinutes?: number;
   }
   
   export function validateCqgPairFreshness(
     src1: string,
     src2: string,
     options?: {
       maxTimeGapMinutes?: number; // Mặc định: tối đa 30 phút giữa 2 TK
       maxAgeHours?: number;       // Mặc định: file không được cũ hơn 12 tiếng
       requireBothFiles?: boolean; // Bắt buộc phải có đủ cả 2 tài khoản
     }
   ): CqgPairValidationResult;
   ```
2. **Quy tắc Kiểm Định Bắt Buộc Trước Khi Ghép (Fail-Fast Rules)**:
   - **Rule 1 (Missing Account Check)**: Nếu `requireBothFiles = true` mà 1 trong 2 file không tồn tại $\implies$ Ném lỗi `MissingCqgAccountFileException`, không sinh file gộp chắp vá.
   - **Rule 2 (Time Window Gap Check)**: Tính `Math.abs(stat1.mtimeMs - stat2.mtimeMs) / (60 * 1000)`. Nếu khoảng cách giữa 2 file vượt quá 30 phút $\implies$ Nghi ngờ một file bị treo hoặc là file tồn từ phiên cũ $\implies$ Từ chối ghép và bắn cảnh báo khẩn.
   - **Rule 3 (Stale File Check)**: File không được có thời gian tạo/sửa đổi cách thời điểm hiện tại quá 12 tiếng (`now - mtime > 12 * 3600 * 1000`).
3. **Áp dụng đồng bộ cho cả 4 cặp file**: `FR (FR1, FR2)`, `PS (PS1, PS2)`, `OP (OP1, OP2)`, `OD (OD1, OD2)`.

### 2.4. Danh sách file thay đổi
- `backend/src/modules/trading-ops/services/cqg-merger.service.ts`
- `backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts` (Bắt lỗi khi gọi merger)

---

## 3. PHASE 2: KHẮC PHỤC LỖ HỔNG 4 - CHỐNG THÀNH CÔNG ẢO & GHI ĐÈ BASELINE DSGD BEFORE EOD

### 3.1. Căn cứ mã nguồn hiện tại (Ground Truth)
- File tác động: [backend/src/modules/trading-ops/services/dsgd-before-eod.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/dsgd-before-eod.service.ts)
- Đoạn code có lỗ hổng (Dòng 313-319):
  ```typescript
  } else {
    this.logger.warn(
      `Không tìm thấy file snapshot DSGD${timeSuffix}.xlsx, so sánh với chính file DSGD.xlsx gốc`,
    );
    dsgdTempPath = dsgdOriginalPath;
    dsgdTempBuffer = dsgdOriginalBuffer; // ⛔ So sánh file với chính nó!
  }
  ```

### 3.2. Phân tích sự cố thực tế
1. **Bản chất nghiệp vụ của `CheckDSGDBeforeEOD`**:
   - Cần 1 file **`DSGD.xlsx` gốc** (lấy ở mốc đầu phiên / đầu ngày, lưu trong `Backup MS/...`).
   - Cần 1 file **`DSGD{time}.xlsx` snapshot** (lấy ở mốc trước giờ EOD, ví dụ lúc 17h00, lưu trong `TradingCheck/...`).
2. **Kịch bản lỗi 1 (Báo thành công ảo - Silent Swallow)**:
   - Nếu bot RPA tải snapshot trước EOD bị lỗi hoặc nhân viên gõ sai `timeSuffix`, code rơi vào nhánh `else` dòng 313.
   - Code tự gán `dsgdTempBuffer = dsgdOriginalBuffer` $\implies$ Đọc file gốc đem trừ cho chính file gốc $\implies$ `totalOriginal - totalTemp = 0 lot`!
   - Hệ thống trả về thông báo: *"Không có chênh lệch khối lượng giao dịch"* $\implies$ Người trực ca tin rằng khớp lệnh 100%, bỏ qua kiểm tra, trong khi thực tế chưa đối soát được gì!
3. **Kịch bản lỗi 2 (Ghi đè file Baseline)**:
   - Nếu một Job RPA khác (như audit file định kỳ) tải file về và đặt tên trùng là `DSGD.xlsx` lưu thẳng vào thư mục `Backup MS\...`.
   - File gốc ban đầu bị ghi đè thành file snapshot mới nhất $\implies$ Khi chạy hàm đối chiếu, file gốc và snapshot là một.

### 3.3. Thiết kế giải pháp kỹ thuật (Atomic Remediation)
1. **Triệt tiêu 100% việc gán file so với chính nó**:
   - Khi không tìm thấy file snapshot khớp `timeSuffix` hoặc file snapshot gần nhất:
     ```typescript
     if (!matchedCandidate) {
       this.logger.error(`[DSGD Before EOD] Không tìm thấy bất kỳ file snapshot nào phù hợp với timeSuffix=${timeSuffix}`);
       return {
         success: false,
         isSnapshotMissing: true,
         message: `Không tìm thấy file snapshot DSGD${timeSuffix ? timeSuffix : ''}.xlsx để đối chiếu trước EOD. Vui lòng kiểm tra lại thư mục TradingCheck hoặc kích hoạt bot tải snapshot.`,
         details: {
           totalOriginal,
           totalTemp: 0,
           differTotal: 0,
           totalACMMS: 0,
           totalACMSFTP: 0,
           differACM: 0,
         },
         results: [`LỖI: Thiếu file snapshot đối chiếu trước EOD`],
       };
     }
     ```
2. **Phân định rạch ròi 2 vùng lưu trữ (Isolation by Directory)**:
   - File **Gốc (Baseline)**: Bắt buộc chỉ nằm trong `Backup MS/Futures/YYYY/TMM.YYYY/DD.MM/DSGD.xlsx`. Các job tải trong phiên TUYỆT ĐỐI KHÔNG ĐƯỢC ghi đè vào file này.
   - File **Snapshot**: Bắt buộc lưu vào `TradingCheck/Futures/YYYY/TMM.YYYY/DD.MM/DSGD_bak_{timestamp}.xlsx` hoặc `DSGD{time}.xlsx`.
3. **Cập nhật UI `CheckDsgdBeforeEodModal.tsx`**:
   - Nhận diện cờ `isSnapshotMissing: true` để hiển thị Alert màu đỏ với nút *"Tải Snapshot Ngay"* thay vì hiển thị thẻ màu xanh lá "Không có chênh lệch".

---

## 4. PHASE 3: KHẮC PHỤC LỖ HỔNG 6 - CHUẨN HÓA TÍNH NGÀY T-1 VỚI WORKING CALENDAR (LỄ/TẾT)

### 4.1. Căn cứ mã nguồn hiện tại (Ground Truth)
- File tác động: [backend/src/modules/trading-ops/services/dsgd-before-eod.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/dsgd-before-eod.service.ts)
- Đoạn code có lỗ hổng (Dòng 69-74):
  ```typescript
  const d = inputDate ? new Date(inputDate) : new Date();
  d.setDate(d.getDate() - 1);
  // ⚠️ LOGIC BẮT BUỘC: Bỏ qua Thứ Bảy (6) và Chủ Nhật (0)
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  ```

### 4.2. Phân tích sự cố thực tế
1. Đoạn code trên giả định ngây thơ rằng: Cứ sau Thứ Hai là Thứ Sáu tuần trước, và mọi ngày trong tuần từ Thứ Hai đến Thứ Sáu đều là ngày có phiên giao dịch.
2. **Kịch bản lỗi thực tế**:
   - **Tết Nguyên Đán**: Thị trường nghỉ giao dịch 5-7 ngày liên tục (Thứ Hai đến Thứ Sáu). Vào ngày mở cửa đầu tiên sau Tết, code lùi 1 ngày và rơi trúng vào ngày Mùng 5 Tết!
   - **Ngày Lễ Quốc Khánh 2/9, 30/4 - 1/5**: Nếu ngày 2/9 rơi vào Thứ Ba, code lùi T-1 rơi vào Thứ Hai (vẫn là ngày nghỉ bù).
   - **Hậu quả**: Thư mục ngày đó trên ổ `M:\` hoặc server backup hoàn toàn không tồn tại file giao dịch $\implies$ Hệ thống quăng lỗi `FileNotFoundException` hoặc đọc nhầm một thư mục rỗng, làm sập toàn bộ luồng kiểm tra đầu ngày.

### 4.3. Thiết kế giải pháp kỹ thuật (Atomic Remediation)
1. **Tái Sử Dụng Module Có Sẵn `WorkingCalendarService`**:
   - Trong repo đã có sẵn [working-calendar.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/working-calendar/working-calendar.service.ts) kết nối CSDL MongoDB (`working_calendar`, `exchange_holidays`).
2. **Nâng cấp `calculatePreviousSessionDate` thành Async có kiểm tra Lịch Giao Dịch**:
   ```typescript
   public async getPreviousTradingSession(inputDate?: Date | string): Promise<{
     dateObj: Date;
     day: string;
     month: string;
     year: string;
     dateFormatted: string;
   }> {
     const d = inputDate ? new Date(inputDate) : new Date();
     d.setDate(d.getDate() - 1);
     
     // Lặp lùi tối đa 15 ngày để tìm ngày giao dịch hợp lệ gần nhất
     for (let i = 0; i < 15; i++) {
       const isWeekend = d.getDay() === 0 || d.getDay() === 6;
       if (!isWeekend) {
         const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
         let isHoliday = false;
         if (this.workingCalendarService) {
           const cal = await this.workingCalendarService.validateDate(ymd);
           isHoliday = cal.isHoliday || !cal.isTradingDay;
         }
         if (!isHoliday) {
           break; // Tìm thấy ngày phiên giao dịch hợp lệ gần nhất
         }
       }
       d.setDate(d.getDate() - 1);
     }
     
     const day = String(d.getDate()).padStart(2, '0');
     const month = String(d.getMonth() + 1).padStart(2, '0');
     const year = d.getFullYear().toString();
     return { dateObj: d, day, month, year, dateFormatted: `${day}/${month}/${year}` };
   }
   ```
3. **Đăng ký module**: Import `WorkingCalendarModule` vào `TradingOpsModule` để inject `WorkingCalendarService` an toàn theo chuẩn NestJS Dependency Injection.

---

## 5. PHASE 4: KHẮC PHỤC LỖ HỔNG 1 & 3 - ĐỘNG HÓA MỐC TẢI MÙA ĐÔNG (DST) & UI GUARD VNCLEAR

### 5.1. Căn cứ mã nguồn hiện tại (Ground Truth)
- File tác động:
  - [backend/src/modules/bot-engine/scheduler.service.ts#L156-L159](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/scheduler.service.ts#L156-L159)
  - [frontend/src/app/trading-manager/page.tsx#L1266-L1300](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/page.tsx#L1266-L1300)

### 5.2. Phân tích sự cố thực tế
1. **Lỗ hổng 1 (Gán cứng 04:00 AM)**:
   - Trong `scheduler.service.ts`, code cố tình ép `if (rpaTask.time !== '04:00') rpaTask.time = '04:00'`.
   - Vào mùa đông tại Mỹ (từ Chủ Nhật đầu tiên của tháng 11 đến Chủ Nhật thứ hai của tháng 3 năm sau), giờ đóng cửa sàn CBOT/CME bị lùi 1 tiếng (thành 05:00 AM hoặc 06:00 AM giờ VN).
   - Tải lúc 04:00 AM sẽ làm rơi toàn bộ lệnh khớp trong 1-2 tiếng cuối phiên!
2. **Lỗ hổng 3 (UI Guard CoreCCP EOD)**:
   - Backend đã có rào chắn ném lỗi nếu ngày trong `EOD.xlsx` là ngày cũ.
   - Nhưng trên Frontend, các nút bấm "Bóc tách CoreCCP" và "Macro Khối Lượng" không có thông báo trạng thái, người dùng bấm sớm lúc 15:30 vẫn phải đợi tải rồi mới thấy popup báo lỗi từ Backend.

### 5.3. Thiết kế giải pháp kỹ thuật (Atomic Remediation)
1. **Động hóa Scheduler Configuration**:
   - Xóa bỏ việc ép cứng `rpaTask.time = '04:00'` và `existingCqg.time = '04:00'` khi server boot.
   - Cho phép người dùng cấu hình trực tiếp giờ tải qua giao diện Cấu hình Hệ thống (`system_configs`).
   - Bổ sung helper `isUsDaylightSavingTime(date: Date): boolean` để tự động tính toán giờ gợi ý (Mùa hè: `04:00`, Mùa đông: `05:00`).
2. **Bổ sung UI Guard & Tooltip trên Frontend Tab `CCP_CLEARING`**:
   - Kiểm tra giờ hiện tại của Client: Nếu trước 16:30, hiển thị Badge cảnh báo màu cam:
     > `Clock Icon` *"VNCLEAR chốt sổ sau 16:30 - Chạy đối soát sớm có thể nhận dữ liệu ngày cũ (T-1)"*
   - Vẫn cho phép bấm nếu người dùng cố tình muốn chạy lại cho ngày cũ, nhưng có confirm modal cảnh báo rõ ràng.

---

## 6. MA TRẬN PHÂN CÔNG & THỨ TỰ THỰC HIỆN NGHIÊM NGẶT

```
[BẮT ĐẦU]
   │
   ▼
[PHASE 1: CQG Merger Guard] ──(Test với file lệch ngày)──► [BUILD & PASS 100%]
   │
   ▼
[PHASE 2: DSGD Snapshot Guard] ──(Test không có snapshot)──► [BUILD & PASS 100%]
   │
   ▼
[PHASE 3: Working Calendar T-1] ──(Test ngày sau Lễ/Tết)──► [BUILD & PASS 100%]
   │
   ▼
[PHASE 4: Scheduler DST & UI Guard] ──(Test đổi giờ & UI)──► [BUILD & PASS 100%]
   │
   ▼
[HOÀN TẤT & ĐÓNG GÓI BÀN GIAO]
```

### Tiêu chuẩn nghiệm thu từng Phase (Gate Checklist)
- [ ] Mỗi Phase chỉ sửa đúng các file trong phạm vi, không lan man sang module khác.
- [ ] Không có Unicode emoji thô trên Frontend (100% dùng Lucide-react).
- [ ] Backend biên dịch thành công 0 lỗi (`npm run build` -> `nest build` exit code 0).
- [ ] Có ghi vết chi tiết vào `CHANGELOG_AI.md`.
